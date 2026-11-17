import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { StoreProvider } from './data/store.tsx';
import { ConfirmProvider } from './ui/confirm.tsx';
import { PortalPage } from './pages/Portal.tsx';
import { AuthGate } from './auth/AuthGate.tsx';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-700.css';
import '@fontsource/ibm-plex-sans-arabic/latin-400.css';
import '@fontsource/ibm-plex-sans-arabic/latin-600.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/amiri/latin-700.css';
import './index.css';

// صفحة الخطيب (/p/<الرابط الخاص>) مستقلة تمامًا عن صفحات المسؤول
const portalMatch = location.pathname.match(/^\/p\/([0-9a-f-]{8,})\/?$/i);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {portalMatch ? (
      <PortalPage token={portalMatch[1]} />
    ) : (
      <AuthGate>
        <StoreProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </StoreProvider>
      </AuthGate>
    )}
  </StrictMode>
);
