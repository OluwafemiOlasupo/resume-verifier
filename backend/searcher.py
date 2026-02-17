import os
import asyncio
from urllib.parse import urlparse
from tavily import AsyncTavilyClient
from models import Claim, Evidence
from cache import CacheService


async def search_single_claim(claim: Claim, first_name: str, last_name: str, social_links: list[str], client: AsyncTavilyClient) -> list[Evidence]:
    claim_hash = CacheService.generate_hash(claim.claim, first_name, last_name, "".join(social_links))
    cached_evidence = await CacheService.get_search_evidence(claim_hash)
    if cached_evidence:
        return cached_evidence

    formal_name = f"{first_name} {last_name}"
    names = {formal_name}
    
    for link in social_links:
        parsed = urlparse(link.lower())
        path = parsed.path.strip("/")
        if path:
            # Handle forms like /in/mofeoluwa or just /mofeoluwa
            handle = path.split("/")[-1]
            if len(handle) > 3 and handle not in names:
                # Add handle + last name as a potential variation
                names.add(f"{handle.capitalize()} {last_name}")

    social_queries = []
    for link in social_links:
        parsed = urlparse(link)
        domain = parsed.netloc
        path = parsed.path.strip("/")
        if domain and path:
            social_queries.append(f"site:{domain} \"{path}\" {claim.claim}")
    
    name_clause = " OR ".join([f'"{n}"' for n in names])
    broad_query = f"({name_clause}) {claim.claim}"
    
    primary_query = broad_query
    if social_queries:
        primary_query = social_queries[0]
    
    try:
        response = await client.search(
            query=primary_query,
            search_depth="advanced",
            max_results=15,
            include_domains=[urlparse(l).netloc for l in social_links if l] if social_links else None
        )
        
        results = response.get("results", [])
        if len(results) < 3 and primary_query != broad_query:
            extra = await client.search(
                query=broad_query,
                search_depth="advanced",
                max_results=10
            )
            results.extend(extra.get("results", []))

        evidence = []
        seen_urls = set()
        for result in results:
            url = result.get("url", "")
            if url in seen_urls: continue
            seen_urls.add(url)
            
            evidence.append(Evidence(
                title=result.get("title", ""),
                url=url,
                snippet=result.get("content", "")[:500],
            ))
        final_evidence = evidence[:10]
        await CacheService.set_search_evidence(claim_hash, final_evidence)
        return final_evidence
    except Exception as e:
        print(f"Search error: {e}")
        return []


async def search_all_claims(
    claims: list[Claim], 
    first_name: str, 
    last_name: str, 
    social_links: list[str],
    client: AsyncTavilyClient
) -> dict[str, list[Evidence]]:
    tasks = [search_single_claim(claim, first_name, last_name, social_links, client) for claim in claims]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    evidence_map: dict[str, list[Evidence]] = {}
    for claim, result in zip(claims, results):
        evidence_map[claim.claim] = result if not isinstance(result, Exception) else []

    return evidence_map
