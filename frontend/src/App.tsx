import { useState, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { ProgressTracker } from './components/ProgressTracker';
import { ResultsDashboard } from './components/ResultsDashboard';
import type { ProgressStep, Claim, ClaimResult, VerificationResponse } from './types';
import { ShieldCheck } from 'lucide-react';

type AppState = 'upload' | 'processing' | 'results' | 'error';

function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [currentStep, setCurrentStep] = useState<ProgressStep>('idle');
  const [progressMessage, setProgressMessage] = useState('');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [claimResults, setClaimResults] = useState<ClaimResult[]>([]);
  const [results, setResults] = useState<VerificationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const handleVerify = useCallback(async (file: File) => {
    setAppState('processing');
    setCurrentStep('parsing');
    setProgressMessage('Uploading resume...');
    setClaims([]);
    setClaimResults([]);
    setResults(null);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
    try {
      const response = await fetch(`${API_BASE_URL}/api/verify`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Upload failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || line.startsWith(':')) continue; // skip heartbeats/empty

          if (line.startsWith('event:')) {
            // event type is processed in the data: line by checking the next lines
            // but sse-starlette usually sends event then data
            continue;
          }

          if (line.startsWith('data:')) {
            const rawData = line.slice(5).trim();
            if (!rawData) continue;

            try {
              const data = JSON.parse(rawData);

              // Determine event type from JSON structure
              if (data.step) {
                setCurrentStep(data.step as ProgressStep);
                setProgressMessage(data.message || '');
              } else if (data.claims && !data.success) {
                // claims list event
                setClaims(data.claims);
              } else if (data.claim && data.score !== undefined) {
                // partial claim result
                setClaimResults(prev => [...prev, data as ClaimResult]);
              } else if (data.success !== undefined && data.overall_score !== undefined) {
                setResults(data as VerificationResponse);
                setAppState('results');
              } else if (data.message && !data.step) {
                // Error event
                setErrorMessage(data.message);
                setAppState('error');
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setAppState('error');
    }
  }, []);

  const handleReset = useCallback(() => {
    setAppState('upload');
    setCurrentStep('idle');
    setProgressMessage('');
    setClaims([]);
    setResults(null);
    setErrorMessage('');
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <ShieldCheck size={22} className="text-accent" />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">
              Resume Verifier
            </h1>
          </div>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            Upload your resume to verify claims against real web evidence.
            Each claim is scored 0-100 based on how well the evidence supports it.
          </p>
        </header>

        {/* Main content */}
        <main>
          {appState === 'upload' && (
            <UploadZone onFileSelect={handleVerify} isProcessing={false} />
          )}

          {appState === 'processing' && (
            <ProgressTracker
              currentStep={currentStep}
              message={progressMessage}
              claims={claims}
              claimResults={claimResults}
            />
          )}

          {appState === 'results' && results && (
            <ResultsDashboard data={results} onReset={handleReset} />
          )}

          {appState === 'error' && (
            <div className="w-full max-w-xl mx-auto animate-fade-in">
              <div className="glass-card p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-danger text-2xl">!</span>
                </div>
                <h2 className="text-text-primary font-semibold text-lg mb-2">Verification Failed</h2>
                <p className="text-text-secondary text-sm mb-6">{errorMessage}</p>
                <button
                  onClick={handleReset}
                  className="px-6 py-2.5 rounded-xl font-medium text-accent border border-accent/30 hover:bg-accent/10 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="text-center mt-16">
          <p className="text-text-muted text-xs">
            Powered by DeepSeek AI & Tavily Search • Confidence scores are estimates
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
