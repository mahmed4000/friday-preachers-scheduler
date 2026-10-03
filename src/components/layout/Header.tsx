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
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';

interface HeaderProps {
  activeTitle: string;
  activeSubtitle?: string;
  onOpenWizard: () => void;
  onResetDemo?: () => void;
  onOpenSettings?: () => void;
  alertCount?: number;
}

export function Header({
  activeTitle,
  activeSubtitle,
  onOpenWizard,
  onResetDemo,
  onOpenSettings,
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

  return (
    <header
      className="h-16 border-b border-slate-200/80 bg-white px-6 flex items-center justify-between shrink-0 sticky top-0 z-30 select-none shadow-2xs"
      dir="rtl"
    >
      {/* Right Zone: Page Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">الرئيسية</span>
            <span className="text-slate-300 text-xs">/</span>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 font-heading leading-tight">
              {activeTitle}
            </h2>
          </div>
          {activeSubtitle && (
            <p className="text-[11px] text-slate-500 font-normal leading-none mt-0.5">
              {activeSubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Left Zone: Actions, Notifications, User Menu */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {onResetDemo && (
          <button
            onClick={onResetDemo}
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 rounded-lg transition-colors border border-slate-200 cursor-pointer"
            title="تهيئة البيانات التجريبية"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>تهيئة البيانات</span>
          </button>
        )}

        <Button
          variant="primary"
          size="sm"
          onClick={onOpenWizard}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          <span>جدول جديد</span>
        </Button>

        <div className="h-5 w-px bg-slate-200 mx-1"></div>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
            title="التنبيهات"
            aria-label="التنبيهات"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute left-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-50 text-right animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold font-heading text-slate-900">
                  التنبيهات والجاهزية
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-bold">
                  {alertCount} نشطة
                </span>
              </div>
              <div className="py-3 text-xs text-slate-600 space-y-2">
                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200/60 text-emerald-900">
                  <span className="font-bold block">جاهزية الجمعة القادمة ✓</span>
                  <span className="text-[11px] text-emerald-700">
                    تم توزيع وتأكيد خطباء جميع المساجد الـ 20 بالكامل.
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  <span className="font-bold block">موعد اعتماد جدول شوال</span>
                  <span className="text-[11px] text-slate-500">
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
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/60 hover:bg-slate-100/70 transition-all cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-900 text-amber-300 flex items-center justify-center font-bold text-xs shadow-2xs">
              م
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-900 font-heading block leading-tight">
                محمد
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold block leading-tight">
                مدير النظام
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-0.5" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-right animate-in fade-in-50 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-900 block font-heading">
                  الشيخ محمد بن عبد العزيز
                </span>
                <span className="text-[11px] text-slate-500 block">مدير عام شؤون المساجد</span>
              </div>

              <div className="py-1 text-xs">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>الملف الشخصي والبيانات</span>
                </button>

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onOpenSettings?.();
                  }}
                  className="w-full px-4 py-2 text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>إعدادات النظام والجمعية</span>
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    window.location.reload();
                  }}
                  className="w-full px-4 py-2 text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer text-xs font-semibold"
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
