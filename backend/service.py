import json
import time
import asyncio
import logging
from typing import AsyncGenerator

from parser import extract_text
from extractor import extract_claims
from searcher import search_all_claims
from scorer import calculate_overall_score, score_single_claim
from models import VerificationResponse
from clients import ServiceProvider
from cache import CacheService

logger = logging.getLogger(__name__)

class VerificationService:
    @staticmethod
    async def run_verification(file_bytes: bytes, filename: str) -> AsyncGenerator[dict, None]:
        start_time = time.time()
        
        file_hash = CacheService.generate_hash(file_bytes)
        cached_res = await CacheService.get_full_results(file_hash)
        
        if cached_res:
            logger.info(f"Cache HIT for file: {filename}")
            if "claims" in cached_res:
                yield {"event": "claims", "data": json.dumps({
                    "first_name": cached_res.get("first_name"),
                    "last_name": cached_res.get("last_name"),
                    "social_links": cached_res.get("social_links"),
                    "claims": [{"claim": c["claim"], "category": c["category"], "importance": c["importance"]} for c in cached_res["claims"]],
                })}
                for claim_res in cached_res["claims"]:
                    yield {"event": "claim_result", "data": json.dumps(claim_res)}
            
            yield {"event": "complete", "data": json.dumps(cached_res)}
            return

        tavily = ServiceProvider.get_tavily()
        openai = ServiceProvider.get_openai()

        try:
            yield {"event": "progress", "data": json.dumps({"step": "parsing", "message": "Extracting text..."})}
            step_start = time.time()
            resume_text = extract_text(file_bytes, filename)
            if not resume_text or len(resume_text.strip()) < 50:
                yield {"event": "error", "data": json.dumps({"message": "Could not extract text."})}
                return
            logger.info(f"Parsing took {time.time() - step_start:.2f}s")

            yield {"event": "progress", "data": json.dumps({"step": "extracting", "message": "Identifying claims..."})}
            step_start = time.time()
            first_name, last_name, social_links, claims = await extract_claims(resume_text, openai)
            if not claims:
                yield {"event": "error", "data": json.dumps({"message": "No claims found."})}
                return
            
            yield {
                "event": "claims",
                "data": json.dumps({
                    "first_name": first_name,
                    "last_name": last_name,
                    "social_links": social_links,
                    "claims": [{"claim": c.claim, "category": c.category.value, "importance": c.importance} for c in claims],
                }),
            }

            yield {"event": "progress", "data": json.dumps({"step": "searching", "message": "Searching web..."})}
            step_start = time.time()
            evidence_map = await search_all_claims(claims, first_name, last_name, social_links, tavily)
            logger.info(f"Search took {time.time() - step_start:.2f}s")
            yield {"event": "progress", "data": json.dumps({"step": "scoring", "message": "Evaluating evidence..."})}
            step_start = time.time()
            
            scoring_tasks = [
                score_single_claim(claim, evidence_map.get(claim.claim, []), first_name, last_name, social_links, openai)
                for claim in claims
            ]
            
            results = []
            for coro in asyncio.as_completed(scoring_tasks):
                res = await coro
                results.append(res)
                yield {"event": "claim_result", "data": res.model_dump_json()}

            response = VerificationResponse(
                success=True,
                overall_score=calculate_overall_score(results),
                claims=results,
                resume_name=filename,
                first_name=first_name,
                last_name=last_name,
                social_links=social_links,
            )

            await CacheService.set_full_results(file_hash, response.model_dump())
            
            yield {"event": "complete", "data": response.model_dump_json()}
            logger.info(f"Total verification took {time.time() - start_time:.2f}s")

        except Exception as e:
            logger.exception("Service error")
            yield {"event": "error", "data": json.dumps({"message": f"Service failed: {str(e)}"})}
