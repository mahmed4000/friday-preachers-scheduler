import React from 'react';
import { DEFAULT_SHARIA_LOGO } from '../../lib/defaultLogo.ts';
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Sliders,
  Send,
  BarChart3,
  ScrollText,
  Settings as SettingsIcon,
  ShieldCheck,
  Database,
} from 'lucide-react';

export type NavItem =
  | 'dashboard'
  | 'schedules'
  | 'mosques'
  | 'imams'
  | 'rules'
  | 'cloud'
  | 'publishing'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'imam-profile'
  | 'mosque-profile';

interface SidebarProps {
  currentTab: NavItem;
  onTabChange: (tab: NavItem) => void;
  logoUrl?: string;
  associationName?: string;
  branchName?: string;
}

export function Sidebar({
  currentTab,
  onTabChange,
  logoUrl,
  associationName,
  branchName,
}: SidebarProps) {
  const mainNavItems: {
    id: NavItem;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
    { id: 'schedules', label: 'الجداول الشهرية', icon: CalendarDays },
    { id: 'mosques', label: 'المساجد', icon: Building2 },
    { id: 'imams', label: 'الخطباء', icon: Users },
    { id: 'rules', label: 'القواعد والتفضيلات', icon: Sliders },
    { id: 'cloud', label: 'سحابة Supabase', icon: Database },
    { id: 'publishing', label: 'النشر والإرسال', icon: Send },
    { id: 'reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
    { id: 'audit', label: 'سجل العمليات', icon: ScrollText },
  ];

  const effectiveLogo = logoUrl || DEFAULT_SHARIA_LOGO;

  return (
    <aside
      className="w-72 bg-gradient-to-b from-[#03261e] via-[#053d30] to-[#021c15] text-slate-100 border-l border-emerald-900/70 flex flex-col h-screen shrink-0 sticky top-0 select-none shadow-2xl z-40 relative overflow-hidden"
      dir="rtl"
    >
      {/* Decorative Islamic Geometric Pattern Watermark */}
      <div className="absolute inset-0 pointer-events-none islamic-pattern opacity-20"></div>

      {/* Brand Zone - Centered Hierarchy: Emblem -> الجمعية الشرعية - فرع منشأة البكاري -> برنامج منظم الجمعة -> v2 */}
      <div className="relative p-5 pb-4 border-b border-emerald-900/80 bg-black/30 backdrop-blur-md flex flex-col items-center text-center">
        {/* Emblem / Logo Centered on Top */}
        <div
          className="relative mb-3 group cursor-pointer"
          onClick={() => onTabChange('dashboard')}
          title="الرئيسية - منظّم الجمعة"
        >
          <div className="w-20 h-20 rounded-full bg-white p-1.5 flex items-center justify-center overflow-hidden shadow-2xl border-2 border-amber-400/80 ring-4 ring-emerald-500/30 group-hover:scale-105 group-hover:border-amber-300 transition-all duration-300">
            <img
              src={effectiveLogo}
              alt="شعار الجمعية الشرعية"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          {/* Subtle Golden Glow behind logo */}
          <div className="absolute inset-0 rounded-full bg-amber-400/20 filter blur-md -z-10 group-hover:bg-amber-400/35 transition-all"></div>
        </div>

        {/* Text Stack Centered */}
        <div className="flex flex-col items-center w-full px-1">
          {/* الجمعية الشرعية - فرع منشأة البكاري */}
          <h1 className="font-heading font-extrabold text-white text-[14px] sm:text-[15px] leading-tight tracking-tight drop-shadow-sm">
            {associationName && branchName
              ? `${associationName.replace(/لـ?مدينة\s*/g, '')} - ${branchName.split('—')[0].trim()}`
              : 'الجمعية الشرعية - فرع منشأة البكاري'}
          </h1>

          {/* برنامج منظم الجمعة */}
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="text-xs font-bold text-amber-300 tracking-wide font-heading">
              برنامج منظّم الجمعة
            </span>
          </div>

          {/* v2 Pill Badge */}
          <div className="mt-1.5 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-amber-400/25 to-emerald-500/20 border border-amber-400/50 text-[11px] font-mono font-bold text-amber-200 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              v2
            </span>
          </div>
        </div>
      </div>

      {/* Golden Separator Accent */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent"></div>

      {/* Navigation Links Area */}
      <nav className="relative flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-amber-300/80 uppercase tracking-wider font-heading flex items-center justify-between">
          <span>القائمة الرئيسية</span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60"></span>
        </div>

        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-l from-emerald-800/90 to-emerald-900/95 text-amber-300 font-bold shadow-md shadow-emerald-950/50 border-r-4 border-amber-400 ring-1 ring-amber-400/30 translate-x-[-2px]'
                  : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/30 hover:translate-x-[-1px]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isActive ? 'text-amber-300 scale-110' : 'text-emerald-300/70'
                }`}
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="mr-auto w-2 h-2 rounded-full bg-amber-400 shadow-xs shadow-amber-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Area: Settings Button & Hijri Live Status */}
      <div className="relative p-3 bg-black/30 border-t border-emerald-900/70 space-y-2">
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-heading font-semibold transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-amber-900/60 text-amber-200 border border-amber-500/50 font-bold shadow-md'
              : 'text-emerald-100/80 hover:text-white hover:bg-emerald-800/40'
          }`}
        >
          <SettingsIcon
            className={`w-4 h-4 shrink-0 ${
              currentTab === 'settings' ? 'text-amber-300' : 'text-emerald-300/70'
            }`}
          />
          <span className="truncate">إعدادات الهوية والوزارة</span>
        </button>

        <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-800/60 text-[11px] text-emerald-200/90 flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="font-medium text-emerald-100">نظام موثق ومعتمد</span>
          </div>
          <span className="text-[11px] text-amber-300 font-bold font-heading">🌙 1448 هـ</span>
        </div>
      </div>
    </aside>
  );
}
