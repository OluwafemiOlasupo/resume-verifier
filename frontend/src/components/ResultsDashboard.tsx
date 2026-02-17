import { ExternalLink, ChevronDown, ChevronUp, Shield, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { VerificationResponse, ClaimResult } from '../types';

interface ResultsDashboardProps {
    data: VerificationResponse;
    onReset: () => void;
}

function getScoreColor(score: number) {
    if (score >= 65) return { text: 'text-success', bar: 'score-bar-high', bg: 'bg-success/10' };
    if (score >= 35) return { text: 'text-warning', bar: 'score-bar-medium', bg: 'bg-warning/10' };
    return { text: 'text-danger', bar: 'score-bar-low', bg: 'bg-danger/10' };
}

function getScoreLabel(score: number) {
    if (score >= 80) return 'Strongly Verified';
    if (score >= 65) return 'Verified';
    if (score >= 45) return 'Partially Verified';
    if (score >= 25) return 'Weakly Verified';
    return 'Unverified';
}

function getCategoryLabel(cat: string) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
}

function ScoreRing({ score, size = 160 }: { score: number; size?: number }) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const colors = getScoreColor(score);

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="8"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`${colors.text} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${colors.text}`}>{score}</span>
                <span className="text-text-muted text-xs mt-0.5">/ 100</span>
            </div>
        </div>
    );
}

function ClaimCard({ result, index }: { result: ClaimResult; index: number }) {
    const [expanded, setExpanded] = useState(false);
    const colors = getScoreColor(result.score);
    const Icon = result.score >= 65 ? ShieldCheck : result.score >= 35 ? Shield : ShieldAlert;

    return (
        <div
            className="glass-card overflow-hidden animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            {/* Header */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-5 flex items-start gap-4 text-left hover:bg-bg-card-hover transition-colors"
            >
                <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon size={18} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-bg-card-hover text-text-muted border border-border">
                            {getCategoryLabel(result.category)}
                        </span>
                        <span className="text-xs text-text-muted">
                            {result.evidence.length} source{result.evidence.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <p className="text-text-primary font-medium text-sm leading-relaxed">{result.claim}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                        <span className={`text-2xl font-bold ${colors.text}`}>{result.score}</span>
                        <p className={`text-xs ${colors.text} opacity-80`}>{getScoreLabel(result.score)}</p>
                    </div>
                    {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                </div>
            </button>

            {/* Score bar */}
            <div className="h-1 bg-bg-card-hover">
                <div
                    className={`h-full ${colors.bar} transition-all duration-700`}
                    style={{ width: `${result.score}%` }}
                />
            </div>

            {/* Expanded content */}
            {expanded && (
                <div className="p-5 pt-4 border-t border-border animate-fade-in">
                    {/* Explanation */}
                    {result.explanation && (
                        <p className="text-text-secondary text-sm mb-4 leading-relaxed">
                            {result.explanation}
                        </p>
                    )}

                    {/* Evidence cards */}
                    {result.evidence.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-text-muted text-xs uppercase tracking-wider">Evidence Sources</p>
                            {result.evidence.map((ev, i) => (
                                <a
                                    key={i}
                                    href={ev.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 rounded-lg bg-bg-secondary border border-border hover:border-accent/30 transition-colors group"
                                >
                                    <div className="flex items-start gap-2">
                                        <ExternalLink size={14} className="text-text-muted group-hover:text-accent mt-0.5 shrink-0 transition-colors" />
                                        <div className="min-w-0">
                                            <p className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">
                                                {ev.title || 'Source'}
                                            </p>
                                            <p className="text-text-muted text-xs mt-1 line-clamp-2">
                                                {ev.snippet}
                                            </p>
                                            <p className="text-accent/60 text-xs mt-1 truncate">{ev.url}</p>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-text-muted text-sm italic">No web evidence found for this claim.</p>
                    )}
                </div>
            )}
        </div>
    );
}

export function ResultsDashboard({ data, onReset }: ResultsDashboardProps) {
    const overallColors = getScoreColor(data.overall_score);
    const verifiedCount = data.claims.filter(c => c.score >= 65).length;
    const partialCount = data.claims.filter(c => c.score >= 35 && c.score < 65).length;
    const unverifiedCount = data.claims.filter(c => c.score < 35).length;

    return (
        <div className="w-full max-w-3xl mx-auto animate-fade-in">
            {/* Hero score */}
            <div className="glass-card p-8 mb-6 text-center">
                <p className="text-text-muted text-sm mb-4 uppercase tracking-wider">Verification Score</p>
                <div className="flex justify-center mb-4">
                    <ScoreRing score={data.overall_score} />
                </div>
                <p className={`text-lg font-semibold ${overallColors.text}`}>
                    {getScoreLabel(data.overall_score)}
                </p>
                <p className="text-text-muted text-sm mt-1">{data.resume_name}</p>

                {/* Stats row */}
                <div className="flex justify-center gap-6 mt-6 pt-6 border-t border-border">
                    <div className="text-center">
                        <p className="text-2xl font-bold text-success">{verifiedCount}</p>
                        <p className="text-text-muted text-xs mt-0.5">Verified</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-warning">{partialCount}</p>
                        <p className="text-text-muted text-xs mt-0.5">Partial</p>
                    </div>
                    <div className="text-center">
                        <p className="text-2xl font-bold text-danger">{unverifiedCount}</p>
                        <p className="text-text-muted text-xs mt-0.5">Unverified</p>
                    </div>
                </div>
            </div>

            {/* Claims list */}
            <div className="space-y-3 mb-8">
                <h2 className="text-text-secondary text-sm uppercase tracking-wider px-1">
                    Claim Breakdown ({data.claims.length})
                </h2>
                {data.claims
                    .sort((a, b) => b.importance - a.importance || b.score - a.score)
                    .map((result, i) => (
                        <ClaimCard key={i} result={result} index={i} />
                    ))}
            </div>

            {/* Reset */}
            <div className="text-center">
                <button
                    onClick={onReset}
                    className="
            px-8 py-3 rounded-xl font-medium
            text-text-secondary border border-border
            hover:text-text-primary hover:border-accent/50 hover:bg-bg-card
            transition-all duration-200
          "
                >
                    Verify Another Resume
                </button>
            </div>
        </div>
    );
}
