import { Component } from 'react';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

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
      const technicalMsg = this.state.error?.message || (this.state.error ? (typeof this.state.error === 'object' ? JSON.stringify(this.state.error) : String(this.state.error)) : '');
      return <main className="quiz-error-page"><div className="quiz-error-card">
        <div className="locked-icon"><CircleAlert size={23} /></div>
        <h1>We couldn’t open this test</h1>
        <p>Something went wrong while loading the test. Please return to the test list and try again.</p>
        {technicalMsg && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
            {technicalMsg}
          </p>
        )}
        <Link className="button button-outline" to="/tests"><ArrowLeft size={15} /> Back to tests</Link>
      </div></main>;
    }

    return this.props.children;
  }
}
