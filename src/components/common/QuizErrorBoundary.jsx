import { Component } from 'react';
import { CircleAlert, RefreshCw } from 'lucide-react';

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
      return <main className="quiz-error-page"><div className="quiz-error-card">
        <div className="locked-icon"><CircleAlert size={23} /></div>
        <h1>Quiz load nahi hua</h1>
        <p>Test load karne mein dikkat hui. Dobara try karein.</p>
        <button type="button" className="button button-outline min-h-[44px]" onClick={() => window.location.reload()}>
          <RefreshCw size={15} /> Try again
        </button>
      </div></main>;
    }

    return this.props.children;
  }
}
