import { FileSearch, Brain, Search, BarChart3, CheckCircle2 } from 'lucide-react';
import type { ProgressStep, Claim, ClaimResult } from '../types';

interface ProgressTrackerProps {
    currentStep: ProgressStep;
    message: string;
    claims: Claim[];
    claimResults: ClaimResult[];
}

const STEPS = [
    { key: 'parsing', label: 'Parsing Resume', icon: FileSearch },
    { key: 'extracting', label: 'Extracting Claims', icon: Brain },
    { key: 'searching', label: 'Finding Evidence', icon: Search },
    { key: 'scoring', label: 'Scoring Claims', icon: BarChart3 },
] as const;

const STEP_ORDER: Record<string, number> = {
    parsing: 0,
    extracting: 1,
    searching: 2,
    scoring: 3,
    complete: 4,
};

export function ProgressTracker({ currentStep, message, claims, claimResults }: ProgressTrackerProps) {
    const currentIndex = STEP_ORDER[currentStep] ?? -1;

    return (
        <div className="w-full max-w-xl mx-auto animate-fade-in">
            <div className="glass-card p-8">
                {/* Steps */}
                <div className="flex items-center justify-between mb-8">
                    {STEPS.map((step, i) => {
                        const isActive = currentIndex === i;
                        const isDone = currentIndex > i;
                        const Icon = isDone ? CheckCircle2 : step.icon;

                        return (
                            <div key={step.key} className="flex items-center flex-1">
                                <div className="flex flex-col items-center relative">
                                    <div
                                        className={`
                      w-12 h-12 rounded-full flex items-center justify-center
                      transition-all duration-500 ease-out
                      ${isDone
                                                ? 'bg-success/20 text-success'
                                                : isActive
                                                    ? 'bg-accent/20 text-accent animate-pulse-glow'
                                                    : 'bg-bg-card-hover text-text-muted'
                                            }
                    `}
                                    >
                                        <Icon size={20} strokeWidth={1.5} />
                                    </div>
                                    <span className={`
                    text-xs mt-2 font-medium whitespace-nowrap
                    ${isDone ? 'text-success' : isActive ? 'text-accent' : 'text-text-muted'}
                  `}>
                                        {step.label}
                                    </span>
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div className="flex-1 mx-3 h-0.5 mt-[-20px]">
                                        <div
                                            className={`
                        h-full rounded-full transition-all duration-700
                        ${isDone ? 'bg-success' : 'bg-border'}
                      `}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Current message */}
                <div className="text-center">
                    <p className="text-text-secondary text-sm">{message}</p>
                    {currentStep !== 'complete' && (
                        <div className="mt-4 h-1 bg-bg-card-hover rounded-full overflow-hidden">
                            <div className="h-full w-full animate-shimmer rounded-full" />
                        </div>
                    )}
                </div>

                {/* Extracted claims preview */}
                {claims.length > 0 && currentIndex >= 1 && (
                    <div className="mt-6 pt-6 border-t border-border">
                        <p className="text-text-muted text-xs uppercase tracking-wider mb-3">
                            {claims.length} claims identified
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {claims.map((c, i) => {
                                const result = claimResults.find(r => r.claim === c.claim);
                                const isScored = !!result;

                                return (
                                    <span
                                        key={i}
                                        className={`
                                            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium 
                                            border transition-all duration-300
                                            ${isScored
                                                ? 'bg-success/10 text-success border-success/30'
                                                : 'bg-bg-card-hover text-text-secondary border-border'}
                                            animate-fade-in
                                        `}
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        {isScored ? (
                                            <CheckCircle2 size={12} className="text-success" />
                                        ) : (
                                            <span className={`w-1.5 h-1.5 rounded-full ${c.category === 'employment' ? 'bg-accent' :
                                                c.category === 'education' ? 'bg-success' :
                                                    c.category === 'certification' ? 'bg-warning' :
                                                        'bg-text-muted'
                                                }`} />
                                        )}
                                        {c.claim.length > 50 ? c.claim.slice(0, 50) + '…' : c.claim}
                                        {isScored && <span className="ml-1 opacity-70 font-bold">{result.score}</span>}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
