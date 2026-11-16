import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSession, onSessionChange } from './session.ts';
import { LoginScreen } from './LoginScreen.tsx';

/** يعرض شاشة الدخول لحد ما المسؤول يسجّل دخوله، وبعدها يعرض البرنامج. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    return onSessionChange(setSession);
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 font-sans" dir="rtl">
        جاري التحميل…
      </div>
    );
  }
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}
