import { Component, ErrorInfo, ReactNode } from 'react';
import { Score } from '../core/model';
import { serializeScore } from '../io/json';
import { logToErrorRingBuffer } from '../io/storage';

export interface ErrorBoundaryProps {
  children: ReactNode;
  score?: Score;
  onRestoreAutosave?: () => void;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copiedToast: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copiedToast: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    try {
      this.setState({ errorInfo });
    } catch {
      this.state = { ...this.state, errorInfo };
    }
    logToErrorRingBuffer(
      'error',
      error.message || 'Render Error in ErrorBoundary',
      error.stack || errorInfo.componentStack || undefined,
      'ErrorBoundary'
    );
  }

  handleRestoreAutosave = (): void => {
    if (this.props.onRestoreAutosave) {
      this.props.onRestoreAutosave();
      this.state = { ...this.state, hasError: false, error: null, errorInfo: null };
      try {
        this.setState({ hasError: false, error: null, errorInfo: null });
      } catch {
        // Safe in isolated test instantiations
      }
    } else {
      window.location.reload();
    }
  };

  handleDownloadCurrentScore = (): void => {
    try {
      const score = this.props.score;
      if (!score) return;
      const json = serializeScore(score, 2, true);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kurtarilan_eser_${Date.now()}.sfscore`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download emergency score:', err);
    }
  };

  handleCopyErrorReport = async (): Promise<void> => {
    try {
      const { error, errorInfo } = this.state;
      const report = {
        error: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        timestamp: new Date().toISOString(),
        recentLogs: typeof window !== 'undefined' ? window.__errorLog ?? [] : [],
      };
      const text = JSON.stringify(report, null, 2);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      this.setState({ copiedToast: true });
      setTimeout(() => {
        this.setState({ copiedToast: false });
      }, 2000);
    } catch (err) {
      console.warn('Failed to copy error report to clipboard:', err);
    }
  };

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          data-testid="error-boundary-fallback"
          style={{
            padding: '2rem',
            margin: '2rem auto',
            maxWidth: '650px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '2px solid #ef4444',
            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.15)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#0f172a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
            <span style={{ fontSize: '2rem', color: '#ef4444' }}>⚠️</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#b91c1c' }}>
                {this.props.fallbackTitle || 'Bir Hata Oluştu (ScoreForge Kurtarma)'}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                Nota çizimi veya durum işlenirken beklenmeyen bir hata yakalandı.
              </p>
            </div>
          </div>

          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '1.5rem',
              maxHeight: '160px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
              color: '#334155',
            }}
          >
            {this.state.error?.message || 'Bilinmeyen Hata'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                data-testid="btn-restore-autosave"
                onClick={this.handleRestoreAutosave}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Son otomatik kaydı geri yükle
              </button>

              <button
                type="button"
                data-testid="btn-download-emergency-score"
                onClick={this.handleDownloadCurrentScore}
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Mevcut eseri dosya olarak indir
              </button>

              <button
                type="button"
                data-testid="btn-copy-error-report"
                onClick={this.handleCopyErrorReport}
                style={{
                  backgroundColor: '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {this.state.copiedToast ? 'Rapor Kopyalandı ✓' : 'Hata raporunu kopyala'}
              </button>

              <button
                type="button"
                data-testid="btn-retry-render"
                onClick={this.handleRetry}
                style={{
                  backgroundColor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Tekrar dene
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
