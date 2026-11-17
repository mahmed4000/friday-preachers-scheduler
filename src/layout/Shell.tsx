import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, Bell, CalendarDays, ChevronDown, FlaskConical, History, Home, Landmark, LogOut, Menu, MessageCircle,
  MoreHorizontal, PanelRightClose, PanelRightOpen, Settings as SettingsIcon, UserRound, Users, X,
} from 'lucide-react';
import { navigate, usePath } from '../lib/router.ts';
import { useStore } from '../data/store.tsx';
import { opsAlerts, type OpsAlert } from '../data/alerts.ts';
import { clsx, Star8 } from '../ui/kit.tsx';
import { gregLong, monthName, todayIso, umalqura } from '../lib/hijri.ts';
import { currentUserEmail, signOut } from '../auth/session.ts';

type NavItem = { path: string; label: string; short?: string; icon: typeof Home; group: 'main' | 'admin' };

export const NAV: NavItem[] = [
  { path: '/', label: 'لوحة التحكم', short: 'الرئيسية', icon: Home, group: 'main' },
  { path: '/schedule', label: 'جدول الشهر والتوزيع', short: 'الجدول', icon: CalendarDays, group: 'main' },
  { path: '/messages', label: 'مركز الإرسال', short: 'الإرسال', icon: MessageCircle, group: 'main' },
  { path: '/preachers', label: 'الخطباء', short: 'الخطباء', icon: Users, group: 'main' },
  { path: '/mosques', label: 'المساجد', icon: Landmark, group: 'main' },
  { path: '/report', label: 'التقارير الشهرية', icon: BarChart3, group: 'admin' },
  { path: '/log', label: 'سجل العمليات', icon: History, group: 'admin' },
  { path: '/settings', label: 'الإعدادات', icon: SettingsIcon, group: 'admin' },
];

const MOBILE_MAIN = ['/', '/schedule', '/messages', '/preachers'];
const COLLAPSE_KEY = 'fs_sidebar_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function useIsActive() {
  const path = usePath();
  return (p: string) => (p === '/' ? path === '/' : path.startsWith(p));
}

function go(e: React.MouseEvent, path: string, after?: () => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  navigate(path);
  after?.();
}

// ---------------------------------------------------------------------
// الشعار
// ---------------------------------------------------------------------
function Brand({ collapsed = false }: { collapsed?: boolean }) {
  const { data } = useStore();
  return (
    <a href="/" onClick={(e) => go(e, '/')} className="flex items-center gap-3 min-w-0" aria-label="لوحة التحكم">
      <span className="relative shrink-0">
        <img src="/aljameya-logo.png" alt="" className="w-11 h-11 rounded-full bg-paper object-contain p-0.5 ring-1 ring-gold-400/70" />
        <span className="absolute -inset-1 rounded-full border border-gold-500/25" aria-hidden="true" />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block font-display text-[19px] text-gold-200 truncate">{data.settings.org_name || 'الجمعية الشرعية'}</span>
          <span className="block text-[11.5px] text-brown-100/60 truncate mt-0.5">{data.settings.branch_name || 'منظومة إدارة خطباء الجمعة'}</span>
        </span>
      )}
    </a>
  );
}

// ---------------------------------------------------------------------
// السايدبار (كمبيوتر: ثابتة وقابلة للطي، تابلت/موبايل: درج)
// ---------------------------------------------------------------------
function SideNav({ collapsed, onNavigate, badges }: { collapsed: boolean; onNavigate?: () => void; badges: Record<string, number> }) {
  const isActive = useIsActive();
  const section = (title: string, items: NavItem[]) => (
    <div className="space-y-1">
      {!collapsed && <div className="px-3 pt-1 pb-2 text-[11px] font-medium tracking-wide text-gold-400/60">{title}</div>}
      {collapsed && <div className="mx-auto my-2 w-6 h-px bg-gold-500/25" aria-hidden="true" />}
      {items.map((n) => {
        const active = isActive(n.path);
        const badge = badges[n.path] ?? 0;
        return (
          <a
            key={n.path}
            href={n.path}
            onClick={(e) => go(e, n.path, onNavigate)}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? n.label : undefined}
            className={clsx(
              'group relative flex items-center gap-3 h-11 rounded-[10px] text-[14px] transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3',
              active ? 'bg-gradient-to-l from-gold-500/20 to-gold-500/5 text-white font-semibold' : 'text-brown-100/75 hover:text-white hover:bg-white/[0.05]'
            )}
          >
            {active && <span className="absolute right-0 top-2 bottom-2 w-[3px] rounded-full bg-gold-400" aria-hidden="true" />}
            <n.icon className={clsx('w-[19px] h-[19px] shrink-0', active ? 'text-gold-400' : 'text-brown-100/50 group-hover:text-gold-300')} />
            {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
            {badge > 0 && (
              <span className={clsx('tabular text-[11px] font-semibold rounded-full bg-bad text-white min-w-5 h-5 px-1.5 inline-flex items-center justify-center', collapsed && 'absolute top-1 left-1')}>
                {badge}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
  return (
    <nav className="relative flex-1 px-3 py-4 space-y-4 overflow-y-auto scroll-soft" aria-label="القائمة الرئيسية">
      {section('الإدارة اليومية', NAV.filter((n) => n.group === 'main'))}
      {section('المتابعة والإعدادات', NAV.filter((n) => n.group === 'admin'))}
    </nav>
  );
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { repo } = useStore();
  if (repo.kind === 'demo') {
    return (
      <div className={clsx('rounded-[10px] bg-gold-500/10 border border-gold-500/20 text-[12px] text-gold-200 flex items-center gap-2', collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5')} title="وضع تجريبي">
        <FlaskConical className="w-4 h-4 shrink-0 text-gold-400" />
        {!collapsed && 'وضع تجريبي: البيانات في المتصفح بس'}
      </div>
    );
  }
  return (
    <div className={clsx('flex items-center gap-2 text-[11.5px] text-brown-100/45', collapsed && 'justify-center')}>
      <Star8 className="w-3 h-3 text-gold-500/70 shrink-0" />
      {!collapsed && 'منظومة إدارة خطباء الجمعة'}
    </div>
  );
}

function SidebarBody({ collapsed, onNavigate, badges, onToggle }: { collapsed: boolean; onNavigate?: () => void; badges: Record<string, number>; onToggle?: () => void }) {
  return (
    <>
      <div className="absolute inset-0 pattern-girih opacity-[0.06] pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-gold-500/[0.07] to-transparent pointer-events-none" aria-hidden="true" />
      <div className={clsx('relative h-[76px] flex items-center border-b border-gold-500/15', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Brand collapsed={collapsed} />
      </div>
      <SideNav collapsed={collapsed} onNavigate={onNavigate} badges={badges} />
      <div className="relative p-3 border-t border-gold-500/15 space-y-2">
        {onToggle && (
          <button
            onClick={onToggle}
            className={clsx('w-full h-10 rounded-[10px] text-[13px] text-brown-100/60 hover:text-white hover:bg-white/[0.05] inline-flex items-center gap-2 cursor-pointer', collapsed ? 'justify-center' : 'px-3')}
            aria-label={collapsed ? 'فرد القائمة' : 'طي القائمة'}
          >
            {collapsed ? <PanelRightOpen className="w-[18px] h-[18px]" /> : <PanelRightClose className="w-[18px] h-[18px]" />}
            {!collapsed && 'طي القائمة'}
          </button>
        )}
        <SidebarFooter collapsed={collapsed} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// قوائم الهيدر: الإشعارات والحساب
// ---------------------------------------------------------------------
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const LEVEL_STYLE: Record<OpsAlert['level'], string> = {
  critical: 'bg-bad text-white',
  warning: 'bg-wait text-white',
  info: 'bg-brown-700 text-white',
};
const LEVEL_TEXT: Record<OpsAlert['level'], string> = { critical: 'عاجل', warning: 'تنبيه', info: 'للمتابعة' };

function Notifications({ alerts }: { alerts: OpsAlert[] }) {
  const { open, setOpen, ref } = usePopover();
  const urgent = alerts.filter((a) => a.level !== 'info').length;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-11 h-11 rounded-[10px] inline-flex items-center justify-center text-brown-700 hover:bg-brown-100 cursor-pointer"
        aria-label={`التنبيهات (${alerts.length})`}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {alerts.length > 0 && (
          <span className={clsx('absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10.5px] font-bold tabular inline-flex items-center justify-center ring-2 ring-card', urgent ? 'bg-bad text-white' : 'bg-gold-500 text-brown-950')}>
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-[min(380px,calc(100vw-24px))] bg-card border border-border rounded-2xl shadow-[var(--shadow-overlay)] overflow-hidden">
          <div className="px-4 h-12 flex items-center justify-between border-b border-border">
            <span className="font-semibold text-sm">التنبيهات التشغيلية</span>
            <span className="text-[12px] text-muted">محسوبة من البيانات الحالية</span>
          </div>
          {alerts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">مفيش حاجة محتاجة متابعة دلوقتي.</div>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto scroll-soft divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.id}>
                  <a href={a.href} onClick={(e) => go(e, a.href, () => setOpen(false))} className="flex gap-3 px-4 py-3 hover:bg-brown-50">
                    <span className={clsx('shrink-0 mt-0.5 h-5 px-1.5 rounded text-[10.5px] font-semibold inline-flex items-center', LEVEL_STYLE[a.level])}>{LEVEL_TEXT[a.level]}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{a.title}</span>
                      <span className="block text-[12.5px] text-muted truncate">{a.detail}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AccountMenu() {
  const { data, repo } = useStore();
  const { open, setOpen, ref } = usePopover();
  const email = currentUserEmail();
  const name = data.settings.admin_name || 'المسؤول';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 h-11 ps-1.5 pe-2 rounded-[10px] hover:bg-brown-100 cursor-pointer" aria-expanded={open} aria-label="قائمة الحساب">
        <span className="w-8 h-8 rounded-full bg-brown-800 text-gold-300 inline-flex items-center justify-center">
          <UserRound className="w-4 h-4" />
        </span>
        <span className="hidden xl:block text-right leading-tight">
          <span className="block text-[13px] font-semibold text-ink">{name}</span>
          <span className="block text-[11px] text-muted">مسؤول الدعوة</span>
        </span>
        <ChevronDown className="w-4 h-4 text-muted hidden sm:block" />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-40 w-64 bg-card border border-border rounded-2xl shadow-[var(--shadow-overlay)] overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="font-semibold text-sm">{name}</div>
            <div className="text-[12px] text-muted truncate" dir="ltr">{repo.kind === 'demo' ? 'وضع تجريبي' : email ?? ''}</div>
          </div>
          <div className="p-1.5">
            <a href="/settings" onClick={(e) => go(e, '/settings', () => setOpen(false))} className="flex items-center gap-2 h-10 px-3 rounded-lg text-sm hover:bg-brown-50">
              <SettingsIcon className="w-4 h-4 text-muted" />
              الإعدادات
            </a>
            {email && (
              <button onClick={() => signOut().then(() => location.reload())} className="w-full flex items-center gap-2 h-10 px-3 rounded-lg text-sm text-bad hover:bg-bad-soft cursor-pointer">
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TopBar({ alerts, onMenu }: { alerts: OpsAlert[]; onMenu: () => void }) {
  const today = todayIso();
  const h = umalqura(today);
  return (
    <header className="no-print sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="h-16 lg:h-[76px] flex items-center gap-2 sm:gap-3 px-3 sm:px-6 lg:px-8">
        <button onClick={onMenu} className="lg:hidden w-11 h-11 rounded-[10px] inline-flex items-center justify-center text-brown-800 hover:bg-brown-100 cursor-pointer" aria-label="فتح القائمة">
          <Menu className="w-5 h-5" />
        </button>
        <a href="/" onClick={(e) => go(e, '/')} className="lg:hidden flex items-center gap-2 min-w-0" aria-label="لوحة التحكم">
          <img src="/aljameya-logo.png" alt="" className="w-9 h-9 rounded-full ring-1 ring-gold-400/70 bg-paper object-contain p-0.5 shrink-0" />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] sm:text-sm">
            <Star8 className="w-3 h-3 text-gold-500 shrink-0 hidden sm:block" />
            <span className="font-semibold text-brown-900 truncate">{h.day} {monthName(h.month)} {h.year} هـ</span>
            <span className="text-muted hidden sm:inline">·</span>
            <span className="text-muted truncate hidden sm:inline">{gregLong(today)}</span>
          </div>
          <div className="text-[11.5px] text-muted hidden lg:block">التاريخ الهجري تقريبي (أم القرى)، وبداية كل شهر بتتظبط حسب دار الإفتاء</div>
        </div>
        <Notifications alerts={alerts} />
        <AccountMenu />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------
// الإطار
// ---------------------------------------------------------------------
export function Shell({ children }: { children: React.ReactNode }) {
  const { data } = useStore();
  const isActive = useIsActive();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawer, setDrawer] = useState(false);
  const alerts = useMemo(() => opsAlerts(data), [data]);
  const critical = alerts.filter((a) => a.level === 'critical' && a.href.startsWith('/schedule')).length;
  const badges = { '/schedule': critical };

  const toggle = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, v ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !v;
    });

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:right-2 focus:z-[70] bg-card px-3 py-2 rounded-lg">تخطي للمحتوى</a>

      {/* السايدبار (كمبيوتر) */}
      <aside className={clsx('hidden lg:flex no-print shrink-0 flex-col bg-brown-950 sticky top-0 h-dvh overflow-hidden transition-[width] duration-200', collapsed ? 'w-[76px]' : 'w-[260px]')}>
        <SidebarBody collapsed={collapsed} badges={badges} onToggle={toggle} />
        <span className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/10 to-gold-500/40" aria-hidden="true" />
      </aside>

      {/* الدرج (تابلت وموبايل) */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label="القائمة">
          <div className="absolute inset-0 bg-brown-950/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 right-0 w-[280px] max-w-[85vw] bg-brown-950 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]">
            <SidebarBody collapsed={false} badges={badges} onNavigate={() => setDrawer(false)} />
            <button onClick={() => setDrawer(false)} className="absolute top-4 left-3 w-10 h-10 rounded-lg text-brown-100 hover:bg-white/10 inline-flex items-center justify-center cursor-pointer" aria-label="إغلاق القائمة">
              <X className="w-5 h-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar alerts={alerts} onMenu={() => setDrawer(true)} />
        <main id="main" className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 pb-28 md:pb-12">{children}</main>
      </div>

      {/* الشريط السفلي (موبايل) */}
      <nav className="md:hidden no-print fixed bottom-0 inset-x-0 z-30 bg-card/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(36,21,13,0.06)]" aria-label="التنقل السريع">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.path)).map((n) => {
            const active = isActive(n.path);
            return (
              <a
                key={n.path}
                href={n.path}
                onClick={(e) => go(e, n.path)}
                aria-current={active ? 'page' : undefined}
                className={clsx('relative flex flex-col items-center justify-center gap-1 h-[60px] text-[11px]', active ? 'text-brown-900 font-semibold' : 'text-muted')}
              >
                {active && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b-full bg-gold-500" />}
                <n.icon className={clsx('w-[22px] h-[22px]', active && 'text-gold-600')} />
                {n.short ?? n.label}
                {(badges as Record<string, number>)[n.path] > 0 && <span className="absolute top-2 left-1/2 -translate-x-4 w-2 h-2 rounded-full bg-bad" />}
              </a>
            );
          })}
          <button
            onClick={() => setDrawer(true)}
            className={clsx('relative flex flex-col items-center justify-center gap-1 h-[60px] text-[11px] cursor-pointer', !MOBILE_MAIN.some((p) => isActive(p)) ? 'text-brown-900 font-semibold' : 'text-muted')}
          >
            {!MOBILE_MAIN.some((p) => isActive(p)) && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b-full bg-gold-500" />}
            <MoreHorizontal className="w-[22px] h-[22px]" />
            المزيد
          </button>
        </div>
      </nav>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="fixed z-[60] bottom-24 md:bottom-6 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none no-print" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto max-w-md w-full sm:w-auto flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-[var(--shadow-overlay)] text-sm font-medium border',
            t.tone === 'error' ? 'bg-bad text-white border-bad' : 'bg-brown-950 text-white border-gold-500/30'
          )}
        >
          {t.tone === 'error' ? <X className="w-4 h-4 shrink-0" /> : <Star8 className="w-3.5 h-3.5 text-gold-400 shrink-0" />}
          {t.text}
        </div>
      ))}
    </div>
  );
}
