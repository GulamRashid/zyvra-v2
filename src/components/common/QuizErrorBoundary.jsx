import { Component } from 'react';
import { ArrowLeft, CircleAlert, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

function isChunkLoadError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  return error?.name === 'ChunkLoadError' || /chunk|dynamically imported module|failed to fetch dynamically imported module/i.test(message);
}

export default class QuizErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Quiz render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);
      return (
        <main className="quiz-error-page">
          <div className="quiz-error-card">
            <div className="locked-icon"><CircleAlert size={23} /></div>
            <h1>We couldn’t open this test</h1>
            <p>
              {chunkError
                ? 'A newer version of the app or a network glitch prevented this test from loading. Please reload and try again.'
                : 'Something went wrong while loading the test. Please return to the test list and try again.'}
            </p>
            {chunkError ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  className="button button-outline min-h-[44px]"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={15} /> Reload
                </button>
                <Link className="button button-outline min-h-[44px]" to="/tests">
                  <ArrowLeft size={15} /> Back to tests
                </Link>
              </div>
            ) : (
              <Link className="button button-outline min-h-[44px]" to="/tests">
                <ArrowLeft size={15} /> Back to tests
              </Link>
            )}
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
