import os
from typing import Optional
from tavily import AsyncTavilyClient
from openai import AsyncOpenAI
import redis.asyncio as redis

class ServiceProvider:
    """Provides singleton-like access to shared service clients."""
    
    _tavily_client: Optional[AsyncTavilyClient] = None
    _openai_client: Optional[AsyncOpenAI] = None
    _redis_client: Optional[redis.Redis] = None

    @classmethod
    def get_tavily(cls) -> AsyncTavilyClient:
        if cls._tavily_client is None:
            api_key = os.getenv("TAVILY_API_KEY")
            if not api_key:
                raise RuntimeError("TAVILY_API_KEY is not set")
            cls._tavily_client = AsyncTavilyClient(api_key=api_key)
        return cls._tavily_client

    @classmethod
    def get_openai(cls) -> AsyncOpenAI:
        if cls._openai_client is None:
            api_key = os.getenv("DEEPSEEK_API_KEY")
            if not api_key:
                raise RuntimeError("DEEPSEEK_API_KEY is not set")
            cls._openai_client = AsyncOpenAI(
                api_key=api_key,
                base_url=os.getenv("OPENAI_BASE_URL", "https://api.deepseek.com"),
                timeout=60.0,
            )
        return cls._openai_client

    @classmethod
    def get_redis(cls) -> redis.Redis:
        if cls._redis_client is None:
            redis_url = os.getenv("REDIS_URL")
            if not redis_url:
                raise RuntimeError("REDIS_URL is not set")
            cls._redis_client = redis.from_url(redis_url, decode_responses=True)
        return cls._redis_client
