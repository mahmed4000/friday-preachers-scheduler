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
      className="w-64 bg-slate-900 text-slate-200 border-l border-slate-800/80 flex flex-col h-screen shrink-0 sticky top-0 select-none shadow-xl z-40"
      dir="rtl"
    >
      {/* Brand Zone */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="w-11 h-11 rounded-xl bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-xs border border-amber-500/20">
              <img src={logoUrl} alt="شعار الجمعية" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-md shadow-emerald-950/50 shrink-0 border border-emerald-700/50">
              <Building2 className="w-5 h-5 text-amber-300" />
            </div>
          )}

          <div className="min-w-0">
            <h1 className="font-heading font-bold text-white text-sm leading-tight truncate">
              {associationName || 'الجمعية الشرعية'}
            </h1>
            <p className="text-[11px] text-amber-400 font-medium truncate mt-0.5">
              منظّم الجمعة — {branchName || 'إدارة المساجد'}
            </p>
          </div>
        </div>
      </div>

      {/* Decorative Thin Islamic Line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-amber-600/40 to-transparent"></div>

      {/* Navigation Links Area */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-heading">
          القائمة الرئيسية
        </div>

        {mainNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-heading font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-emerald-800 text-white shadow-sm border border-emerald-700/50 font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-amber-300' : 'text-slate-400 group-hover:text-slate-200'
                }`}
              />
              <span className="truncate">{item.label}</span>
              {isActive && (
                <span className="mr-auto w-1.5 h-1.5 rounded-full bg-amber-400 shadow-xs" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Section Separator */}
      <div className="px-4 py-2">
        <div className="border-t border-slate-800/80"></div>
      </div>

      {/* Bottom Area: Settings Button & Status */}
      <div className="p-3 bg-slate-950/50 space-y-2">
        <button
          onClick={() => onTabChange('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-heading font-semibold transition-all cursor-pointer ${
            currentTab === 'settings'
              ? 'bg-amber-900/60 text-amber-200 border border-amber-600/50 font-bold'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
        >
          <SettingsIcon
            className={`w-4 h-4 shrink-0 ${
              currentTab === 'settings' ? 'text-amber-300 animate-spin-slow' : 'text-slate-400'
            }`}
          />
          <span className="truncate">الإعدادات العامة</span>
        </button>

        <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-slate-300">النظام جاهز وموثق</span>
          </div>
          <span className="text-[10px] text-amber-400 font-mono">1448 هـ</span>
        </div>
      </div>
    </aside>
  );
}
