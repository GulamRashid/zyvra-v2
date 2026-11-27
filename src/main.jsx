import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import AppErrorBoundary from './components/common/AppErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { StudentStatsProvider } from './context/StudentStatsContext';
import { ThemeLanguageProvider } from './context/ThemeLanguageContext';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh data caching
      gcTime: 1000 * 60 * 30, // keep cache for 30 minutes
      refetchOnWindowFocus: false, // avoid unwanted layout refetches during study
      retry: 1
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeLanguageProvider>
          <AuthProvider>
            <StudentStatsProvider>
              <BrowserRouter><App /></BrowserRouter>
            </StudentStatsProvider>
          </AuthProvider>
        </ThemeLanguageProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>
);
