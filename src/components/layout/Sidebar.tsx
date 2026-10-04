import React from 'react';
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

  return (
    <aside
      className="w-68 bg-gradient-to-b from-[#03261e] via-[#053d30] to-[#021c15] text-slate-100 border-l border-emerald-900/70 flex flex-col h-screen shrink-0 sticky top-0 select-none shadow-2xl z-40 relative overflow-hidden"
      dir="rtl"
    >
      {/* Decorative Islamic Geometric Pattern Watermark */}
      <div className="absolute inset-0 pointer-events-none islamic-pattern opacity-20"></div>

      {/* Brand Zone */}
      <div className="relative p-4 border-b border-emerald-900/80 bg-black/20 backdrop-blur-xs">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="w-12 h-12 rounded-xl bg-white p-1.5 flex items-center justify-center overflow-hidden shrink-0 shadow-lg border border-amber-400/40 ring-2 ring-emerald-500/20">
              <img src={logoUrl} alt="شعار الجمعية" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-950 text-white flex items-center justify-center shadow-lg shadow-emerald-950/80 shrink-0 border border-amber-400/30 ring-2 ring-amber-400/20">
              <Building2 className="w-6 h-6 text-amber-300 drop-shadow-xs" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="font-heading font-extrabold text-white text-sm leading-tight truncate tracking-tight">
              {associationName || 'الجمعية الشرعية'}
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-medium">
                منظّم الجمعة
              </span>
              <span className="text-[10px] text-emerald-200/70 truncate">
                {branchName || 'إدارة المساجد'}
              </span>
            </div>
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
