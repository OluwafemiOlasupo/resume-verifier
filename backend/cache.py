import json
import hashlib
from typing import Optional, Any
from clients import ServiceProvider
from models import Evidence, ClaimResult

class CacheService:
    @staticmethod
    def _get_redis():
        return ServiceProvider.get_redis()

    @classmethod
    async def get_full_results(cls, file_hash: str) -> Optional[dict]:
        data = await cls._get_redis().get(f"verifier:result:{file_hash}")
        return json.loads(data) if data else None

    @classmethod
    async def set_full_results(cls, file_hash: str, data: dict, expire: int = 604800):
        await cls._get_redis().set(f"verifier:result:{file_hash}", json.dumps(data), ex=expire)

    @classmethod
    async def get_search_evidence(cls, claim_hash: str) -> Optional[list[Evidence]]:
        data = await cls._get_redis().get(f"verifier:search:{claim_hash}")
        if data:
            raw_list = json.loads(data)
            return [Evidence(**e) for e in raw_list]
        return None

    @classmethod
    async def set_search_evidence(cls, claim_hash: str, evidence: list[Evidence], expire: int = 259200):
        data = [e.model_dump() for e in evidence]
        await cls._get_redis().set(f"verifier:search:{claim_hash}", json.dumps(data), ex=expire)

    @classmethod
    async def get_claim_result(cls, score_hash: str) -> Optional[ClaimResult]:
        data = await cls._get_redis().get(f"verifier:score:{score_hash}")
        if data:
            return ClaimResult.model_validate_json(data)
        return None

    @classmethod
    async def set_claim_result(cls, score_hash: str, result: ClaimResult, expire: int = 259200):
        await cls._get_redis().set(f"verifier:score:{score_hash}", result.model_dump_json(), ex=expire)

    @staticmethod
    def generate_hash(*args) -> str:
        combined = "".join(str(arg) for arg in args)
        return hashlib.sha256(combined.encode()).hexdigest()
