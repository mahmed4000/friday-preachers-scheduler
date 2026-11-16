import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import { installApiAuthHeader } from './auth/session.ts';
import './index.css';

installApiAuthHeader();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </ThemeProvider>
  </ErrorBoundary>
);
