import { Component } from 'react';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

function isChunkLoadError(error) {
  const message = typeof error?.message === 'string' ? error.message : String(error || '');
  return (
    error?.name === 'ChunkLoadError' ||
    /chunk|dynamically imported module|failed to fetch dynamically imported module/i.test(message)
  );
}

export default class AppErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Zyvra App Catch Boundary:', error, errorInfo);
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('zyvra_chunk_retry_pending');
    } catch {}
    window.location.reload();
  };

  handleGoHome = () => {
    try {
      sessionStorage.removeItem('zyvra_chunk_retry_pending');
      sessionStorage.removeItem('zyvra_active_route');
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const chunkError = isChunkLoadError(this.state.error);
      const isHindi =
        typeof document !== 'undefined' &&
        (document.documentElement.lang === 'hi' || localStorage.getItem('zyvra_language') === 'hi');

      return (
        <main className="min-h-screen w-full flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100 font-sans transition-colors">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-5 animate-fade-in">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 dark:bg-amber-400/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <AlertCircle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight">
                {isHindi ? 'पेज लोड करने में अस्थायी समस्या आई' : 'Something went wrong loading this page'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                {chunkError
                  ? isHindi
                    ? 'ऐप का नया संस्करण उपलब्ध है या नेटवर्क रुकावट हुई है। पुनः लोड करने पर यह तुरंत ठीक हो जाएगा।'
                    : 'A newer version of the app is available or a network disruption occurred. Reloading will fix this.'
                  : isHindi
                    ? 'एक अप्रत्याशित समस्या हुई है। कृपया पृष्ठ को पुनः लोड करें या होम स्क्रीन पर वापस जाएं।'
                    : 'An unexpected issue occurred. Please reload or return to the home screen.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>{isHindi ? 'पुनः लोड करें' : 'Reload Page'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 transition-all border border-slate-300 dark:border-slate-700 active:scale-95 cursor-pointer"
              >
                <Home size={15} />
                <span>{isHindi ? 'होम स्क्रीन' : 'Go Home'}</span>
              </button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
