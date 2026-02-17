import os
import json
import logging
import re
from typing import Optional
from openai import AsyncOpenAI
from models import Claim, ClaimCategory

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are an expert resume analyst. Extract the most important verifiable professional claims from this resume.

Focus on claims that can be verified through web searches:
- Employment history (company names, roles, dates)
- Education (degrees, institutions)
- Certifications and awards
- Notable projects or publications
- Specific technical skills tied to verifiable projects or roles

Rules:
1. Extract 5-8 of the MOST IMPORTANT and VERIFIABLE claims only
2. Skip generic skills like "team player" or "hard worker"
3. Prioritize claims that are likely to have web evidence (e.g., LinkedIn, company pages, publications)
4. Each claim should be a concise, searchable statement
5. Assign importance 1-5 (5 = most important, like current role at a named company)

Return ONLY a valid JSON object with no markdown formatting:
{{
  "first_name": "First Name",
  "last_name": "Last Name",
  "social_links": ["https://linkedin.com/in/...", "https://github.com/..."],
  "claims": [
    {{"claim": "Worked as Senior Software Engineer at Google from 2020-2023", "category": "employment", "importance": 5}},
    {{"claim": "Bachelor's degree in Computer Science from MIT", "category": "education", "importance": 4}}
  ]
}}

Valid categories: employment, education, skill, certification, achievement, project

Resume text:
---
{resume_text}
---"""


def _clean_llm_json(content: str) -> str:
    content = re.sub(r'^```(?:json)?\s*\n?|\n?```\s*$', '', content.strip())
    if not content.startswith('{'):
        match = re.search(r'\{.*\}', content, re.DOTALL)
        return match.group(0) if match else content
    return content


async def extract_claims(resume_text: str, client: AsyncOpenAI) -> tuple[str, str, list[str], list[Claim]]:
    truncated = resume_text[:6000]
    
    response = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "You extract names, social links (URLs), and professional claims from resumes. return valid JSON only."},
            {"role": "user", "content": EXTRACTION_PROMPT.format(resume_text=truncated)},
        ],
        temperature=0.1,
    )

    content = _clean_llm_json(response.choices[0].message.content)
    
    try:
        data = json.loads(content)
        first_name = data.get("first_name", "").strip()
        last_name = data.get("last_name", "").strip()
        social_links = [url.strip() for url in data.get("social_links", []) if isinstance(url, str)]
        raw_claims = data.get("claims", [])
    except json.JSONDecodeError:
        logger.error(f"JSON Parse Error: {content[:200]}")
        return "", "", [], []

    claims = []
    for c in raw_claims:
        try:
            claim_text = c.get("claim", "").strip("'\" ")
            if not claim_text: continue
            
            claims.append(Claim(
                claim=claim_text,
                category=ClaimCategory(c.get("category", "skill").strip("'\" ")),
                importance=min(max(int(c.get("importance", 3)), 1), 5),
            ))
        except Exception:
            continue

    return first_name, last_name, social_links, claims[:8]
