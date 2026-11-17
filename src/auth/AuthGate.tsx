import { useEffect, useState } from 'react';
import { FlaskConical, LogIn, LogOut } from 'lucide-react';
import { isDemoMode, setDemoMode } from '../data/store.tsx';
import { supabase } from '../data/supabaseRepo.ts';
import { Button, Field, Input, Star8 } from '../ui/kit.tsx';
import { getSession, onSessionChange, signIn, signOut } from './session.ts';

type State = 'checking' | 'out' | 'denied' | 'in';

/** هل البريد ده مسموح له؟ لو دالة fs_is_admin لسه مش موجودة (قبل خطوة الأمان) بنسمح. */
async function checkAdmin(): Promise<boolean> {
  const { data, error } = await supabase().rpc('fs_is_admin');
  if (error) return /could not find|does not exist|PGRST202/i.test(`${error.code} ${error.message}`);
  return data === true;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-brown-950 relative flex items-center justify-center p-4">
      <div className="absolute inset-0 pattern-stars opacity-[0.08]" />
      <div className="relative w-full max-w-sm bg-paper rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-brown-900 text-gold-200 text-center px-6 pt-7 pb-5">
          <img src="/aljameya-logo.png" alt="" className="w-20 h-20 mx-auto rounded-full ring-2 ring-gold-500 bg-paper object-contain p-1" />
          <h1 className="font-display text-[28px] mt-3 leading-tight">الجمعية الشرعية</h1>
          <div className="text-[13px] text-brown-100/70 mt-0.5">منظومة إدارة خطباء الجمعة</div>
          <div className="ornament text-[10px] mt-2 max-w-[180px] mx-auto"><Star8 className="w-2.5 h-2.5" /></div>
        </div>
        <div className="h-[3px] bg-gradient-to-l from-gold-600 via-gold-400 to-gold-600" />
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await signIn(email, password).catch((x) => (x instanceof Error ? x.message : 'حصلت مشكلة في الاتصال.'));
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <Frame>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted text-center">دخول مسؤول الدعوة</p>
        <Field label="البريد الإلكتروني">
          <Input type="email" autoComplete="username" dir="ltr" className="text-right" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="كلمة المرور">
          <Input type="password" autoComplete="current-password" dir="ltr" className="text-right" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        {error && <div className="rounded-lg bg-bad-soft border border-bad/30 text-bad p-2.5 text-sm">{error}</div>}
        <Button type="submit" className="w-full" disabled={busy}>
          <LogIn className="w-4 h-4" />
          {busy ? 'جاري الدخول…' : 'دخول'}
        </Button>
        <button
          type="button"
          className="w-full text-[13px] text-muted hover:text-brown-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          onClick={() => {
            setDemoMode(true);
            location.reload();
          }}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          جرّب البرنامج ببيانات تجريبية
        </button>
      </form>
    </Frame>
  );
}

/** بيمنع فتح صفحات المسؤول من غير تسجيل دخول (الوضع التجريبي مستثنى) */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const demo = isDemoMode();
  const [state, setState] = useState<State>(demo ? 'in' : 'checking');

  useEffect(() => {
    if (demo) return;
    let alive = true;
    const evaluate = async (hasSession: boolean) => {
      if (!hasSession) return alive && setState('out');
      const ok = await checkAdmin().catch(() => true);
      if (alive) setState(ok ? 'in' : 'denied');
    };
    getSession()
      .then((s) => evaluate(Boolean(s)))
      .catch(() => alive && setState('out'));
    const off = onSessionChange((s) => {
      if (!s) setState('out');
      else evaluate(true);
    });
    return () => {
      alive = false;
      off();
    };
  }, [demo]);

  if (state === 'checking')
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Star8 className="w-8 h-8 text-gold-500 animate-spin [animation-duration:3s]" />
      </div>
    );
  if (state === 'out') return <LoginScreen />;
  if (state === 'denied')
    return (
      <Frame>
        <div className="text-center space-y-3">
          <p className="text-brown-900 font-semibold">الحساب ده مش مسجل كمسؤول.</p>
          <p className="text-sm text-muted">اطلب إضافة بريدك في جدول fs_admins على Supabase.</p>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="w-4 h-4" />
            خروج
          </Button>
        </div>
      </Frame>
    );
  return <>{children}</>;
}
