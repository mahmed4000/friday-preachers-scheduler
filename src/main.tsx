import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { StoreProvider } from './data/store.tsx';
import { ConfirmProvider } from './ui/confirm.tsx';
import { PortalPage } from './pages/Portal.tsx';
import './index.css';

// صفحة الخطيب (/p/<الرابط الخاص>) مستقلة تمامًا عن صفحات المسؤول
const portalMatch = location.pathname.match(/^\/p\/([0-9a-f-]{8,})\/?$/i);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {portalMatch ? (
      <PortalPage token={portalMatch[1]} />
    ) : (
      <StoreProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </StoreProvider>
    )}
  </StrictMode>
);
