import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import 'leaflet/dist/leaflet.css';
import './index.css';

// Global error handler to catch opaque cross-origin script errors or unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    // Prevent unhandled errors from crashing the top-level window when inside iframes
    console.error('[BrewBound Error Handler]', event.message, event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[BrewBound Unhandled Rejection]', event.reason);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

