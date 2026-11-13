import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeLanguageProvider } from './context/ThemeLanguageContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeLanguageProvider>
      <AuthProvider>
        <BrowserRouter><App /></BrowserRouter>
      </AuthProvider>
    </ThemeLanguageProvider>
  </React.StrictMode>
);
