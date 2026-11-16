import type { Session } from '@supabase/supabase-js';
import { supabase } from '../data/supabaseRepo.ts';

// جلسة المسؤول (Supabase Auth: بريد + كلمة مرور)
let email: string | null = null;

export function currentUserEmail(): string | null {
  return email;
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase().auth.getSession();
  email = data.session?.user.email ?? null;
  return data.session;
}

export function onSessionChange(cb: (s: Session | null) => void): () => void {
  const { data } = supabase().auth.onAuthStateChange((_e, s) => {
    email = s?.user.email ?? null;
    cb(s);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(mail: string, password: string): Promise<string | null> {
  const { error } = await supabase().auth.signInWithPassword({ email: mail.trim(), password });
  if (!error) return null;
  if (/invalid login credentials/i.test(error.message)) return 'البريد أو كلمة المرور مش صح.';
  if (/email not confirmed/i.test(error.message)) return 'الحساب ده لسه ما اتأكدش من Supabase.';
  return error.message;
}

export async function signOut(): Promise<void> {
  email = null;
  await supabase().auth.signOut();
}
