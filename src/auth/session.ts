import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../lib/supabaseClient.ts';

// جلسة المسؤول: تسجيل الدخول بحساب Supabase Auth (بريد + كلمة مرور).
// التوكن بيتبعت تلقائيًا مع كل طلب لـ /api، وبيتبعت مع طلبات Supabase المباشرة.

let currentToken: string | null = null;

export async function getSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  currentToken = data.session?.access_token ?? null;
  return data.session;
}

export function onSessionChange(cb: (session: Session | null) => void): () => void {
  const client = getSupabaseClient();
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    currentToken = session?.access_token ?? null;
    cb(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return 'قاعدة البيانات غير متصلة.';
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) return 'البريد أو كلمة المرور غير صحيحة.';
    return error.message;
  }
  currentToken = data.session?.access_token ?? null;
  return null;
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  currentToken = null;
  await client?.auth.signOut();
}

/** يضيف توكن المسؤول لكل طلب رايح لـ /api على نفس الموقع. */
export function installApiAuthHeader(): void {
  if (typeof window === 'undefined' || (window as any).__apiAuthInstalled) return;
  (window as any).__apiAuthInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const isApi = url.startsWith('/api') || url.startsWith(`${window.location.origin}/api`);
    if (!isApi) return originalFetch(input, init);
    if (!currentToken) await getSession();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (currentToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${currentToken}`);
    const res = await originalFetch(input, { ...init, headers });
    if (res.status === 401 && currentToken) {
      // انتهت الجلسة: نجيب جلسة جديدة ونعيد المحاولة مرة واحدة
      const fresh = await getSession();
      if (fresh?.access_token) {
        headers.set('Authorization', `Bearer ${fresh.access_token}`);
        return originalFetch(input, { ...init, headers });
      }
    }
    return res;
  };
}
