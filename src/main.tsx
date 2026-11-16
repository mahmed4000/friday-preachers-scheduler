import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { SurveyPage } from './components/survey/SurveyPage.tsx';
import './index.css';

// صفحة الاستبيان المؤقتة على /survey
const isSurvey = window.location.pathname.replace(/\/+$/, '') === '/survey';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      {isSurvey ? <SurveyPage /> : <App />}
    </ThemeProvider>
  </ErrorBoundary>
);
