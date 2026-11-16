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

function NavLink({ path, label, icon: Icon, active, onClick }: { path: string; label: string; icon: typeof Home; active: boolean; onClick?: () => void }) {
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
        'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[15px] transition-colors',
        active ? 'bg-gold-500/15 text-gold-300 font-semibold ring-1 ring-gold-500/40' : 'text-brown-100/80 hover:text-gold-200 hover:bg-white/5'
      )}
    >
      <Icon className={clsx('w-[18px] h-[18px]', active ? 'text-gold-400' : 'text-gold-500/70')} />
      {label}
    </a>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePath();
  const { data, repo } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const isActive = (p: string) => (p === '/' ? path === '/' : path.startsWith(p));

  return (
    <div className="min-h-dvh lg:flex">
      {/* الشريط الجانبي (كمبيوتر) */}
      <aside className="hidden lg:flex no-print w-64 shrink-0 flex-col bg-brown-900 text-brown-100 relative sticky top-0 h-dvh">
        <div className="absolute inset-0 pattern-stars opacity-[0.07] pointer-events-none" />
        <div className="relative px-5 pt-6 pb-5 text-center border-b border-gold-500/25">
          <img src="/aljameya-logo.png" alt="" className="w-20 h-20 mx-auto rounded-full ring-2 ring-gold-500/70 bg-paper object-contain p-1" />
          <div className="font-display text-xl text-gold-300 mt-3 leading-snug">{data.settings.org_name || 'منظّم الجمعة'}</div>
          {data.settings.branch_name && <div className="text-[13px] text-brown-100/70">{data.settings.branch_name}</div>}
          <div className="ornament text-[10px] mt-3">
            <Star8 className="w-2.5 h-2.5" />
          </div>
          <div className="text-[12px] text-gold-400/80 tracking-wide">جدول خطباء الجمعة</div>
        </div>
        <nav className="relative flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => (
            <NavLink key={n.path} {...n} active={isActive(n.path)} />
          ))}
        </nav>
        {repo.kind === 'demo' && (
          <div className="relative m-3 rounded-lg bg-gold-500/15 ring-1 ring-gold-500/40 px-3 py-2 text-[12px] text-gold-200 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 shrink-0" />
            وضع تجريبي: البيانات في المتصفح بس
          </div>
        )}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* الشريط العلوي (موبايل) */}
        <header className="lg:hidden no-print sticky top-0 z-30 bg-brown-900 text-gold-200 relative overflow-hidden pt-[env(safe-area-inset-top)]">
          <div className="absolute inset-0 pattern-stars opacity-[0.08] pointer-events-none" />
          <div className="relative flex items-center gap-3 px-4 py-2.5">
            <img src="/aljameya-logo.png" alt="" className="w-9 h-9 rounded-full ring-1 ring-gold-500/70 bg-paper object-contain p-0.5" />
            <div className="min-w-0">
              <div className="font-display text-lg leading-tight truncate">{data.settings.org_name || 'منظّم الجمعة'}</div>
              <div className="text-[11px] text-gold-400/80">جدول خطباء الجمعة{repo.kind === 'demo' ? ' · وضع تجريبي' : ''}</div>
            </div>
          </div>
          <div className="h-[3px] bg-gradient-to-l from-gold-600 via-gold-400 to-gold-600" />
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-28 lg:pb-10">{children}</main>
      </div>

      {/* الشريط السفلي (موبايل) */}
      <nav className="lg:hidden no-print fixed bottom-0 inset-x-0 z-30 bg-brown-900 border-t border-gold-500/40 pb-[env(safe-area-inset-bottom)]">
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
                className={clsx('flex flex-col items-center gap-0.5 py-2 text-[11px]', active ? 'text-gold-300 font-semibold' : 'text-brown-100/70')}
              >
                <Icon className={clsx('w-5 h-5', active ? 'text-gold-400' : '')} />
                {'short' in n ? n.short : n.label}
              </a>
            );
          })}
          <button
            onClick={() => setMoreOpen(true)}
            className={clsx('flex flex-col items-center gap-0.5 py-2 text-[11px] cursor-pointer', !MOBILE_MAIN.some((p) => isActive(p)) ? 'text-gold-300 font-semibold' : 'text-brown-100/70')}
          >
            <MoreHorizontal className="w-5 h-5" />
            المزيد
          </button>
        </div>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="المزيد">
        <div className="bg-brown-900 rounded-xl p-2 space-y-1">
          {NAV.filter((n) => !MOBILE_MAIN.includes(n.path)).map((n) => (
            <NavLink key={n.path} {...n} active={isActive(n.path)} onClick={() => setMoreOpen(false)} />
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
            'pointer-events-auto max-w-md w-full sm:w-auto px-4 py-2.5 rounded-xl shadow-lg border text-sm font-semibold',
            t.tone === 'error' ? 'bg-bad text-white border-bad' : 'bg-brown-900 text-gold-200 border-gold-500/50'
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
