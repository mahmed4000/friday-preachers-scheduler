import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Sparkles,
  Bell,
  ChevronDown,
  User,
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
  Check,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';

interface HeaderProps {
  activeTitle: string;
  activeSubtitle?: string;
  onOpenWizard: () => void;
  onResetDemo?: () => void;
  onOpenSettings?: () => void;
  onOpenCloud?: () => void;
  alertCount?: number;
}

export function Header({
  activeTitle,
  activeSubtitle,
  onOpenWizard,
  onResetDemo,
  onOpenSettings,
  onOpenCloud,
  alertCount = 0,
}: HeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="h-16 border-b border-emerald-900/80 bg-gradient-to-l from-[#043328] via-[#032b21] to-[#021f18] text-slate-100 px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 select-none shadow-lg relative overflow-hidden backdrop-blur-md"
      dir="rtl"
    >
      {/* Decorative Islamic Geometric Pattern Watermark */}
      <div className="absolute inset-0 pointer-events-none islamic-pattern opacity-10"></div>

      {/* Golden Separator Accent at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent"></div>

      {/* Right Zone: Page Title & Breadcrumb */}
      <div className="relative flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-300/80">الرئيسية</span>
            <span className="text-amber-400/50 text-xs">/</span>
            <h2 className="text-sm sm:text-base font-bold text-white font-heading leading-tight drop-shadow-xs">
              {activeTitle}
            </h2>
          </div>
          {activeSubtitle && (
            <p className="text-[11px] text-emerald-200/70 font-normal leading-none mt-0.5">
              {activeSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Left Zone: Actions, Notifications, User Menu */}
      <div className="relative flex items-center gap-2.5 sm:gap-3">
        {onResetDemo && (
          <button
            onClick={onResetDemo}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:text-white bg-emerald-900/50 hover:bg-emerald-800/70 rounded-lg transition-colors border border-emerald-700/60 cursor-pointer shadow-2xs"
            title="تهيئة البيانات التجريبية"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>تهيئة البيانات</span>
          </button>
        )}

        <button
          onClick={onOpenWizard}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 rounded-lg shadow-md shadow-emerald-950/40 border border-amber-200/60 transition-all cursor-pointer hover:scale-102"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>جدول جديد</span>
        </button>

        {onOpenCloud && (
          <button
            onClick={onOpenCloud}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/90 rounded-lg transition-colors border border-emerald-700/60 cursor-pointer shadow-2xs"
            title="سحابة Supabase ومزامنة البيانات"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden sm:inline">سحابة Supabase ☁️</span>
          </button>
        )}

        <div className="h-5 w-px bg-emerald-800/70 mx-1"></div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-emerald-200/80 hover:text-white hover:bg-emerald-800/50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-700/50"
          title={theme === 'dark' ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الليلي'}
          aria-label="تبديل المظهر"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-emerald-200" />
          )}
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="p-2 text-emerald-200/80 hover:text-white hover:bg-emerald-800/50 rounded-lg transition-colors relative cursor-pointer border border-transparent hover:border-emerald-700/50"
            title="التنبيهات"
            aria-label="التنبيهات"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-emerald-950"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 z-50 text-right animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold font-heading text-slate-900 dark:text-slate-100">
                  التنبيهات والجاهزية
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded font-bold">
                  {alertCount} نشطة
                </span>
              </div>
              <div className="py-3 text-xs text-slate-600 dark:text-slate-300 space-y-2">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-850 text-emerald-900 dark:text-emerald-200">
                  <span className="font-bold block">جاهزية الجمعة القادمة ✓</span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    تم توزيع وتأكيد خطباء جميع المساجد الـ 20 بالكامل.
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                  <span className="font-bold block">موعد اعتماد جدول شوال</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    متبقي 5 أيام للمراجعة النهائية وإرسال الرسائل.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-emerald-800/70 hover:border-emerald-700 bg-emerald-950/60 hover:bg-emerald-900/70 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-emerald-950 flex items-center justify-center font-bold text-xs shadow-md">
              م
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-white font-heading block leading-tight">
                محمد
              </span>
              <span className="text-[10px] text-amber-300 font-semibold block leading-tight">
                مدير النظام
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-emerald-300/70 mr-0.5" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute left-0 mt-2 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 text-right animate-in fade-in-50 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block font-heading">
                  الشيخ محمد بن عبد العزيز
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">مدير عام شؤون المساجد</span>
              </div>

              <div className="py-1 text-xs">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>الملف الشخصي والبيانات</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>إعدادات النظام والجمعية</span>
                </button>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
