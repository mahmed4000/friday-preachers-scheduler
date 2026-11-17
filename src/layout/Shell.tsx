import React, { useState } from 'react';
import { CalendarDays, Home, Landmark, MessageCircle, MoreHorizontal, BarChart3, Settings as SettingsIcon, Users, FlaskConical } from 'lucide-react';
import { navigate, usePath } from '../lib/router.ts';
import { useStore } from '../data/store.tsx';
import { clsx, Modal, Star8 } from '../ui/kit.tsx';

const NAV = [
  { path: '/', label: 'الرئيسية', short: 'الرئيسية', icon: Home },
  { path: '/schedule', label: 'جدول الشهر', short: 'الجدول', icon: CalendarDays },
  { path: '/messages', label: 'الإرسال والتذكير', short: 'الإرسال', icon: MessageCircle },
  { path: '/preachers', label: 'الخطباء', short: 'الخطباء', icon: Users },
  { path: '/mosques', label: 'المساجد', icon: Landmark },
  { path: '/report', label: 'التقرير الشهري', icon: BarChart3 },
  { path: '/settings', label: 'الإعدادات', icon: SettingsIcon },
];

const MOBILE_MAIN = ['/', '/schedule', '/messages', '/preachers'];

function NavLink({ path, label, icon: Icon, active, onClick, light = false }: { path: string; label: string; icon: typeof Home; active: boolean; onClick?: () => void; light?: boolean }) {
  return (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        navigate(path);
        onClick?.();
      }}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex items-center gap-3 h-11 px-3 rounded-[10px] text-[14px] transition-colors',
        light
          ? active
            ? 'bg-brown-100 text-brown-900 font-semibold'
            : 'text-ink hover:bg-brown-50'
          : active
            ? 'bg-white/[0.08] text-white font-semibold'
            : 'text-brown-100/70 hover:text-white hover:bg-white/[0.04]'
      )}
    >
      {active && !light && <span className="absolute right-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-gold-400" />}
      <Icon className={clsx('w-[18px] h-[18px]', active ? 'text-gold-400' : light ? 'text-muted' : 'text-brown-100/45')} />
      {label}
    </a>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const { data } = useStore();
  return (
    <div className="flex items-center gap-3 min-w-0">
      <img
        src="/aljameya-logo.png"
        alt=""
        className={clsx('rounded-full bg-white object-contain ring-1 ring-gold-400/60 shrink-0', compact ? 'w-9 h-9 p-0.5' : 'w-11 h-11 p-0.5')}
      />
      <div className="min-w-0">
        <div className={clsx('font-display font-semibold text-gold-200 truncate leading-snug', compact ? 'text-[14px]' : 'text-[15px]')}>
          {data.settings.org_name || 'منظّم الجمعة'}
        </div>
        <div className="text-[12px] text-brown-100/55 truncate">{data.settings.branch_name || 'جدول خطباء الجمعة'}</div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePath();
  const { repo } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <div className="min-h-dvh lg:flex">
      {/* الشريط الجانبي (كمبيوتر) */}
      <aside className="hidden lg:flex no-print w-[260px] shrink-0 flex-col bg-brown-950 relative sticky top-0 h-dvh">
        <div className="absolute inset-0 pattern-stars opacity-[0.045] pointer-events-none" />
        <div className="relative px-5 h-[76px] flex items-center border-b border-white/[0.07]">
          <Brand />
        </div>
        <nav className="relative flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-medium text-brown-100/35">القائمة</div>
          {NAV.map((n) => (
            <NavLink key={n.path} {...n} active={isActive(n.path)} />
          ))}
        </nav>
        <div className="relative p-4 border-t border-white/[0.07]">
          {repo.kind === 'demo' ? (
            <div className="rounded-[10px] bg-gold-500/10 px-3 py-2.5 text-[12px] text-gold-200 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 shrink-0 text-gold-400" />
              وضع تجريبي: البيانات في المتصفح بس
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-brown-100/40">
              <Star8 className="w-3 h-3 text-gold-500/70" />
              جدول خطباء الجمعة
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* الشريط العلوي (موبايل) */}
        <header className="lg:hidden no-print sticky top-0 z-30 bg-brown-950 relative overflow-hidden pt-[env(safe-area-inset-top)] border-b border-gold-500/30">
          <div className="absolute inset-0 pattern-stars opacity-[0.05] pointer-events-none" />
          <div className="relative flex items-center justify-between gap-3 px-4 h-14">
            <Brand compact />
            {repo.kind === 'demo' && <span className="shrink-0 text-[11px] text-gold-200 bg-gold-500/15 rounded-full px-2.5 h-6 inline-flex items-center">تجريبي</span>}
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 lg:pt-8 pb-28 lg:pb-12">{children}</main>
      </div>

      {/* الشريط السفلي (موبايل) */}
      <nav className="lg:hidden no-print fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-sand pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(35,26,18,0.05)]">
        <div className="grid grid-cols-5">
          {NAV.filter((n) => MOBILE_MAIN.includes(n.path)).map((n) => {
            const active = isActive(n.path);
            const Icon = n.icon;
            return (
              <a
                key={n.path}
                href={n.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(n.path);
                }}
                className={clsx('relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px]', active ? 'text-brown-900 font-semibold' : 'text-muted')}
              >
                {active && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b-full bg-gold-500" />}
                <Icon className={clsx('w-[22px] h-[22px]', active ? 'text-gold-600' : '')} />
                {'short' in n ? n.short : n.label}
              </a>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx('relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] cursor-pointer', !MOBILE_MAIN.some((p) => isActive(p)) ? 'text-brown-900 font-semibold' : 'text-muted')}
          >
            {!MOBILE_MAIN.some((p) => isActive(p)) && <span className="absolute top-0 inset-x-5 h-[3px] rounded-b-full bg-gold-500" />}
            <MoreHorizontal className="w-[22px] h-[22px]" />
            المزيد
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <div className="space-y-1">
          {NAV.filter((n) => !MOBILE_MAIN.includes(n.path)).map((n) => (
            <NavLink key={n.path} {...n} light active={isActive(n.path)} onClick={() => setMoreOpen(false)} />
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="fixed z-[60] bottom-24 lg:bottom-6 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none no-print" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'pointer-events-auto max-w-md w-full sm:w-auto px-4 py-3 rounded-xl shadow-[0_10px_30px_rgba(35,26,18,0.25)] text-sm font-medium',
            t.tone === 'error' ? 'bg-bad text-white' : 'bg-brown-950 text-white'
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
