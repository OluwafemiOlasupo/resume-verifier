import os
import re
import json
import logging
from datetime import datetime
from urllib.parse import urlparse
from openai import AsyncOpenAI
from models import Claim, Evidence, ClaimResult
from cache import CacheService

logger = logging.getLogger(__name__)


async def score_single_claim(
    claim: Claim,
    evidence_list: list[Evidence],
    first_name: str,
    last_name: str,
    social_links: list[str],
    client: AsyncOpenAI
) -> ClaimResult:
    score_hash = CacheService.generate_hash(claim.claim, first_name, last_name, "".join([e.url for e in evidence_list]))
    cached_score = await CacheService.get_claim_result(score_hash)
    if cached_score:
        return cached_score

    full_name = f"{first_name} {last_name}"
    current_date = datetime.now().strftime("%B %Y")
    
    context = {
        "candidate": full_name,
        "social_links": social_links,
        "claim": claim.claim,
        "evidence": [{"title": e.title, "snippet": e.snippet[:300], "url": e.url} for e in evidence_list],
        "current_date": current_date
    }

    try:
        response = await client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": f"You are a professional fact-checker. Current date: {current_date}. Verify if {full_name} is linked to the claim. Finding Name + Entity in a professional profile is worth 30+ points."},
                {"role": "user", "content": f"Assess this claim for {full_name}:\n{json.dumps(context, indent=2)}\n\nBase Scoring (0-70):\n- 0: NOISE (Category mismatch or absolute nonsense)\n- 1-25: WEAK (Entity found but name is missing or ambiguous in snippet)\n- 26-45: PLAUSIBLE (Name and Entity both present in a professional context)\n- 46-70: CONFIRMED (Verified by independent news, govt, or company registries)\n\nReturn JSON: {{\"base_score\": int, \"explanation\": \"short reason\"}}"},
            ],
            temperature=0.1,
        )
        content = re.sub(r'^```(?:json)?\s*\n?|\n?```\s*$', '', response.choices[0].message.content.strip())
        if not content.startswith('{'):
            content = re.search(r'\{.*\}', content, re.DOTALL).group(0)
        
        score_data = json.loads(content)
    except Exception as e:
        logger.error(f"Scoring error: {e}")
        score_data = {"base_score": 5, "explanation": "Verification stalls."}

    base_score = min(max(int(score_data.get("base_score", 5)), 0), 70)
    explanation = score_data.get("explanation", "")

    source_count = len(evidence_list)
    boost = 10 if source_count >= 3 else (5 if source_count >= 2 else 0)

    identity_bonus = 0
    global_trusted = {"github.com", "linkedin.com", "vercel.app", "medium.com", "twitter.com", "x.com"}
    
    seed_data = []
    for link in social_links:
        if not link: continue
        parsed = urlparse(link.lower().rstrip("/"))
        domain_parts = parsed.netloc.split(".")
        main_domain = ".".join(domain_parts[-2:]) if len(domain_parts) >= 2 else parsed.netloc
        seed_data.append((main_domain, parsed.path))

    name_parts = [p.lower() for p in (first_name + " " + last_name).split() if len(p) > 2]
    
    for e in evidence_list:
        url_parsed = urlparse(e.url.lower())
        url_domain = url_parsed.netloc
        url_path = url_parsed.path.rstrip("/")
        snippet_lower = e.snippet.lower()
        
        is_mirror_match = False
        for s_domain, s_path in seed_data:
            if s_domain in url_domain and url_path.startswith(s_path):
                is_mirror_match = True
                break
        
        is_authority = any(d in url_domain for d in global_trusted)
        name_in_snippet = any(part in snippet_lower for part in name_parts)
        
        if is_mirror_match:
            identity_bonus = 40 # Direct Mirror Match
            explanation += f" [Mirror Match: {url_domain}]"
            break
        elif is_authority:
            # Verified hit on a major profile site
            identity_bonus = 25 
            explanation += f" [Verified Domain: {url_domain}]"
            break
        elif name_in_snippet:
            identity_bonus = 15 # Name match

    if base_score <= 0:
        final_score = 0
        explanation = f"UNVERIFIED: {explanation}"
    else:
        final_score = min(base_score + boost + identity_bonus, 100)
        
        if base_score < 46:
            final_score = min(final_score, 85)

    res = ClaimResult(
        claim=claim.claim,
        category=claim.category,
        importance=claim.importance,
        score=final_score,
        evidence=evidence_list,
        explanation=explanation,
    )
    await CacheService.set_claim_result(score_hash, res)
    return res


async def score_claims(
    claims: list[Claim],
    evidence_map: dict[str, list[Evidence]],
    first_name: str,
    last_name: str,
    social_links: list[str]
) -> list[ClaimResult]:
    import asyncio
    tasks = [
        score_single_claim(claim, evidence_map.get(claim.claim, []), first_name, last_name, social_links)
        for claim in claims
    ]
    return await asyncio.gather(*tasks)


def calculate_overall_score(results: list[ClaimResult]) -> int:
    if not results:
        return 0
    total_weight = sum(r.importance for r in results)
    if total_weight == 0:
        return 0
    weighted_sum = sum(r.score * r.importance for r in results)
    return round(weighted_sum / total_weight)
