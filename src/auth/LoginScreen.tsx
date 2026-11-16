import React, { useState } from 'react';
import { signIn } from './session.ts';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const err = await signIn(email, password);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#043328] to-[#021f18] p-4 font-sans">
      <form onSubmit={submit} className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-7 space-y-5">
        <div className="text-center space-y-1">
          <img src="/logo.png" alt="" className="w-16 h-16 mx-auto rounded-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
          <h1 className="text-xl font-bold font-heading text-slate-900 dark:text-slate-100">منظّم الجمعة</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">سجّل دخولك علشان تدير جدول الخطباء</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">البريد الإلكتروني</span>
          <input
            id="login-email"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">كلمة المرور</span>
          <input
            id="login-password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </label>

        {error && <p className="text-sm text-rose-700 dark:text-rose-400" role="alert">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold disabled:opacity-60 cursor-pointer"
        >
          {busy ? 'جاري الدخول…' : 'دخول'}
        </button>
      </form>
    </div>
  );
}
