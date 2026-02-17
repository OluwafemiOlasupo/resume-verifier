export interface Claim {
    claim: string;
    category: string;
    importance: number;
}

export interface Evidence {
    title: string;
    url: string;
    snippet: string;
    relevance: string;
}

export interface ClaimResult {
    claim: string;
    category: string;
    importance: number;
    score: number;
    evidence: Evidence[];
    explanation: string;
}

export interface VerificationResponse {
    success: boolean;
    overall_score: number;
    claims: ClaimResult[];
    resume_name: string;
}

export type ProgressStep = 'idle' | 'parsing' | 'extracting' | 'searching' | 'scoring' | 'complete' | 'error';

export interface ProgressEvent {
    step: ProgressStep;
    message: string;
}
