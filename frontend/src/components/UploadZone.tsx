import { useCallback, useState, useRef } from 'react';
import { Upload, FileText, X } from 'lucide-react';

interface UploadZoneProps {
    onFileSelect: (file: File) => void;
    isProcessing: boolean;
}

export function UploadZone({ onFileSelect, isProcessing }: UploadZoneProps) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const ALLOWED = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const MAX_SIZE = 10 * 1024 * 1024;

    const validateFile = useCallback((file: File): boolean => {
        setError(null);
        if (!ALLOWED.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.docx')) {
            setError('Please upload a PDF or DOCX file');
            return false;
        }
        if (file.size > MAX_SIZE) {
            setError('File is too large. Maximum size is 10MB');
            return false;
        }
        return true;
    }, []);

    const handleFile = useCallback((file: File) => {
        if (validateFile(file)) {
            setSelectedFile(file);
            setError(null);
        }
    }, [validateFile]);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, [handleFile]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
        }
    }, [handleFile]);

    const clearFile = () => {
        setSelectedFile(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = '';
    };

    const handleVerify = () => {
        if (selectedFile) {
            onFileSelect(selectedFile);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="w-full max-w-xl mx-auto animate-fade-in">
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !selectedFile && inputRef.current?.click()}
                className={`
          relative glass-card p-10 text-center cursor-pointer
          transition-all duration-300 ease-out
          ${dragActive
                        ? 'border-accent bg-accent/5 scale-[1.02] shadow-lg shadow-accent/10'
                        : selectedFile
                            ? 'border-border'
                            : 'border-border hover:border-accent/50 hover:bg-bg-card-hover'
                    }
          ${!selectedFile ? 'border-dashed border-2' : ''}
        `}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx"
                    onChange={handleChange}
                    className="hidden"
                />

                {!selectedFile ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className={`
              w-16 h-16 rounded-2xl flex items-center justify-center
              transition-all duration-300
              ${dragActive
                                ? 'bg-accent/20 text-accent scale-110'
                                : 'bg-bg-card-hover text-text-secondary'
                            }
            `}>
                            <Upload size={28} strokeWidth={1.5} />
                        </div>
                        <div>
                            <p className="text-text-primary font-medium text-lg">
                                {dragActive ? 'Drop your resume here' : 'Upload your resume'}
                            </p>
                            <p className="text-text-muted text-sm mt-1">
                                Drag & drop a PDF or DOCX file, or click to browse
                            </p>
                        </div>
                        <p className="text-text-muted text-xs">Max 10MB</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shrink-0">
                            <FileText size={22} />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-text-primary font-medium truncate">{selectedFile.name}</p>
                            <p className="text-text-muted text-sm">{formatSize(selectedFile.size)}</p>
                        </div>
                        {!isProcessing && (
                            <button
                                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <p className="text-danger text-sm mt-3 text-center animate-fade-in">{error}</p>
            )}

            {selectedFile && !isProcessing && (
                <button
                    onClick={handleVerify}
                    className="
            mt-6 w-full py-3.5 px-6 rounded-xl font-semibold text-white
            bg-accent hover:bg-accent-hover
            transition-all duration-200 ease-out
            hover:shadow-lg hover:shadow-accent/25
            active:scale-[0.98]
            animate-fade-in
          "
                >
                    Verify Resume
                </button>
            )}
        </div>
    );
}
