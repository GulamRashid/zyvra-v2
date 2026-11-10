import { Component } from 'react';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export default class QuizErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Quiz render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <main className="quiz-error-page"><div className="quiz-error-card">
        <div className="locked-icon"><CircleAlert size={23} /></div>
        <h1>We couldn’t open this test</h1>
        <p>Something went wrong while loading the test. Please return to the test list and try again.</p>
        <Link className="button button-outline" to="/tests"><ArrowLeft size={15} /> Back to tests</Link>
      </div></main>;
    }

    return this.props.children;
  }
}
