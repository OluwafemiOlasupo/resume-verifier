from pydantic import BaseModel, Field
from enum import Enum


class ClaimCategory(str, Enum):
    EMPLOYMENT = "employment"
    EDUCATION = "education"
    SKILL = "skill"
    CERTIFICATION = "certification"
    ACHIEVEMENT = "achievement"
    PROJECT = "project"


class Claim(BaseModel):
    claim: str = Field(description="The verifiable claim extracted from the resume")
    category: ClaimCategory = Field(description="Category of the claim")
    importance: int = Field(ge=1, le=5, description="Importance level 1-5")


class Evidence(BaseModel):
    title: str
    url: str
    snippet: str
    relevance: str = ""


class ClaimResult(BaseModel):
    claim: str
    category: ClaimCategory
    importance: int
    score: int = Field(ge=0, le=100)
    evidence: list[Evidence] = []
    explanation: str = ""


class VerificationResponse(BaseModel):
    success: bool = True
    overall_score: int = 0
    claims: list[ClaimResult] = []
    resume_name: str = ""
    first_name: str = ""
    last_name: str = ""
    social_links: list[str] = []
