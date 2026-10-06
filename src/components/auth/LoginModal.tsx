import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { Shield, Lock, Mail, AlertCircle, X, Check, Eye, EyeOff, UserCheck } from 'lucide-react';

export function LoginModal() {
  const { isLoginModalOpen, closeLoginModal, login } = useAuth();
  const [email, setEmail] = useState('admin@aljameya.org');
  const [password, setPassword] = useState('Admin@123456');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'فشل تسجيل الدخول: تحقق من البريد وكلمة المرور');
    }
  };

  const setPreset = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setErrorMessage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-800/40 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-l from-[#043328] via-[#032b21] to-[#021f18] text-white p-6 relative">
          <button
            onClick={closeLoginModal}
            className="absolute top-4 left-4 p-1.5 rounded-lg text-emerald-200/80 hover:text-white hover:bg-emerald-800/50 transition-colors"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading">تسجيل الدخول للنظام</h3>
              <p className="text-xs text-emerald-200/80">منظّم الجمعة — الجمعية الخيرية الرئيسية</p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-start gap-2.5 text-rose-800 dark:text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                البريد الإلكتروني المعتمد
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@aljameya.org"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-hidden text-right"
                  dir="ltr"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-hidden text-right"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>جارٍ التحقق والتوثيق...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>دخول آمن</span>
                </>
              )}
            </button>
          </form>

          {/* Role Presets for Testing & Demonstration */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
              الحسابات المعتمدة للاختبار والمعاينة:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPreset('admin@aljameya.org', 'Admin@123456')}
                className="p-2 rounded-lg border border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20 text-right hover:border-amber-400 transition-colors cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-amber-900 dark:text-amber-200">مدير النظام</span>
                <span className="block text-[9px] text-amber-700/80 dark:text-amber-300/70 truncate">صلاحيات كاملة</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('staff@aljameya.org', 'Staff@123456')}
                className="p-2 rounded-lg border border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20 text-right hover:border-emerald-400 transition-colors cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-200">مشرف الجداول</span>
                <span className="block text-[9px] text-emerald-700/80 dark:text-emerald-300/70 truncate">تعديل وتوزيع</span>
              </button>

              <button
                type="button"
                onClick={() => setPreset('viewer@aljameya.org', 'Viewer@123456')}
                className="p-2 rounded-lg border border-slate-300/40 bg-slate-50/50 dark:bg-slate-800/40 text-right hover:border-slate-400 transition-colors cursor-pointer"
              >
                <span className="block text-[11px] font-bold text-slate-900 dark:text-slate-200">مشاهد فقط</span>
                <span className="block text-[9px] text-slate-500 dark:text-slate-400 truncate">اطلاع وقراءة</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
