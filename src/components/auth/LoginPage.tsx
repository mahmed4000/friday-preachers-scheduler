import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Shield, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { DEFAULT_SHARIA_LOGO } from '../../lib/defaultLogo.ts';

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    // Support both username (e.g. 'admin') and full email ('admin@aljameya.org')
    const finalEmail = username.includes('@') ? username.trim() : `${username.trim()}@aljameya.org`;
    const result = await login(finalEmail, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  const setPreset = (userVal: string, passVal: string) => {
    setUsername(userVal);
    setPassword(passVal);
    setErrorMessage(null);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-[#021f18] via-[#032b21] to-[#043328] relative overflow-hidden select-none"
      dir="rtl"
    >
      {/* Background Decorative Patterns */}
      <div className="absolute inset-0 pointer-events-none islamic-pattern opacity-10"></div>
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none"></div>

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-emerald-700/30 overflow-hidden backdrop-blur-md">
        {/* Header Branding */}
        <div className="bg-gradient-to-l from-[#043328] via-[#032b21] to-[#021f18] text-white p-7 text-center relative border-b border-amber-400/20">
          <div className="flex justify-center mb-3">
            <div className="w-20 h-20 rounded-2xl bg-white/10 p-2 border border-white/20 shadow-lg backdrop-blur-sm flex items-center justify-center">
              <img
                src={DEFAULT_SHARIA_LOGO}
                alt="شعار الجمعية الشرعية"
                className="w-full h-full object-contain filter drop-shadow-md"
              />
            </div>
          </div>
          <h2 className="text-xl font-bold font-heading text-amber-300 drop-shadow-xs">
            الجمعية الشرعية لقطاع منشأة البكاري
          </h2>
          <p className="text-xs text-emerald-200/90 mt-1 font-medium">
            برنامج منظّم الجمعة — الإدارة المركزية لشؤون الخطباء والمساجد
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/30 text-[11px] text-emerald-300">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>بوابة الدخول الموحدة للفرع</span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-7 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3 text-rose-800 dark:text-rose-200 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="font-medium leading-relaxed">{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                اسم المستخدم أو البريد الإلكتروني
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="admin أو admin@aljameya.org"
                  className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-hidden text-right font-medium"
                  dir="ltr"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-hidden text-right font-medium"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>جارٍ التحقق وتوثيق الدخول...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-amber-400" />
                  <span>تسجيل الدخول للنظام</span>
                </>
              )}
            </button>
          </form>

          {/* Preset Buttons for Quick Login */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
              الحسابات المعتمدة للنظام (اضغط للتعبئة التلقائية):
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPreset('admin', 'Admin@123456')}
                className="p-2.5 rounded-xl border border-amber-300/40 bg-amber-50/60 dark:bg-amber-950/30 text-right hover:border-amber-400 hover:bg-amber-100/60 transition-all cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-amber-950 dark:text-amber-200">مدير النظام</span>
                <span className="block text-[10px] text-amber-700 dark:text-amber-300">admin</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('staff', 'Staff@123456')}
                className="p-2.5 rounded-xl border border-emerald-300/40 bg-emerald-50/60 dark:bg-emerald-950/30 text-right hover:border-emerald-400 hover:bg-emerald-100/60 transition-all cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-emerald-950 dark:text-emerald-200">مشرف الجداول</span>
                <span className="block text-[10px] text-emerald-700 dark:text-emerald-300">staff</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('viewer', 'Viewer@123456')}
                className="p-2.5 rounded-xl border border-slate-300/40 bg-slate-100/60 dark:bg-slate-800/40 text-right hover:border-slate-400 hover:bg-slate-200/60 transition-all cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-slate-900 dark:text-slate-200">مشاهد فقط</span>
                <span className="block text-[10px] text-slate-600 dark:text-slate-400">viewer</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
