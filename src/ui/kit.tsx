import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronLeft, ChevronRight, Clock, Search as SearchIcon, X } from 'lucide-react';
import clsx from 'clsx';
import type { AssignmentStatus } from '../data/types.ts';

export { clsx };

// =====================================================================
// مكونات نظام التصميم. كل الصفحات بتستخدمها، ومفيش أنماط منفصلة لكل صفحة.
// المقاسات: أزرار وحقول 44px (الصغير 36px)، كروت بزوايا 14px.
// =====================================================================

/** نجمة ثمانية (رمز الهوية) */
export function Star8({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g fill="currentColor">
        <rect x="6" y="6" width="12" height="12" />
        <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
      </g>
    </svg>
  );
}

/** نجمة ثمانية مفرغة بخط رفيع (للزخرفة) */
export function Star8Outline({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M24 4.2 29.7 18.3 43.8 24 29.7 29.7 24 43.8 18.3 29.7 4.2 24 18.3 18.3Z" />
      <rect x="12" y="12" width="24" height="24" />
      <circle cx="24" cy="24" r="4.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------
// الأزرار
// ---------------------------------------------------------------------
type BtnVariant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger' | 'whatsapp' | 'success';
type BtnSize = 'sm' | 'md' | 'lg';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brown-800 text-white hover:bg-brown-900 active:bg-brown-950 border border-brown-800 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]',
  gold: 'bg-gold-500 text-brown-950 hover:bg-gold-400 active:bg-gold-600 border border-gold-600/40 font-semibold',
  outline: 'bg-paper text-ink border border-sand-dark hover:bg-brown-50 hover:border-brown-700/30',
  ghost: 'text-brown-700 border border-transparent hover:bg-brown-100',
  danger: 'bg-paper text-bad border border-bad/35 hover:bg-bad-soft',
  success: 'bg-ok text-white border border-ok hover:brightness-110',
  // زرار واتساب بالأخضر الإسلامي من نظام الألوان
  whatsapp: 'bg-green text-white border border-green hover:brightness-110',
};
const BTN_SIZE: Record<BtnSize, string> = {
  sm: 'h-9 px-3 text-[13px] rounded-[9px]',
  md: 'h-11 px-4 text-sm rounded-[10px]',
  lg: 'h-12 px-5 text-[15px] rounded-[11px]',
};
const BTN_BASE =
  'inline-flex items-center justify-center gap-2 font-medium transition-[background-color,border-color,filter,color] duration-150 cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap [&_svg]:shrink-0';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean }) {
  return (
    <button type="button" {...props} disabled={disabled || loading} aria-busy={loading || undefined} className={clsx(BTN_BASE, BTN_SIZE[size], BTN[variant], className)}>
      {loading && <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: BtnVariant; size?: BtnSize }) {
  return <a target="_blank" rel="noopener noreferrer" {...props} className={clsx(BTN_BASE, BTN_SIZE[size], BTN[variant], className)} />;
}

/** زرار أيقونة بس (لازم aria-label) */
export function IconButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { 'aria-label': string }) {
  return (
    <button
      type="button"
      title={props['aria-label']}
      {...props}
      className={clsx('inline-flex items-center justify-center w-11 h-11 rounded-[10px] text-brown-700 hover:bg-brown-100 transition-colors cursor-pointer disabled:opacity-50', className)}
    />
  );
}

// ---------------------------------------------------------------------
// الكروت والعناوين
// ---------------------------------------------------------------------
export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={clsx('bg-card border border-border rounded-[var(--radius-card)] shadow-[var(--shadow-card)]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 min-h-14 py-2 border-b border-border">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink truncate flex items-center gap-2">{title}</h2>}
            {subtitle && <div className="text-[12.5px] text-muted truncate">{subtitle}</div>}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={clsx('p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

/** عنوان الصفحة: نجمة صغيرة + عنوان بخط أميري + وصف + أوامر */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <Star8 className="w-4 h-4 text-gold-500 shrink-0" />
          <h1 className="font-display text-[26px] sm:text-[30px] text-brown-900 leading-tight">{title}</h1>
        </div>
        {subtitle && <div className="text-muted text-sm mt-1.5 ps-[26px]">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

/** عنوان قسم داخل الصفحة */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-[15px] font-semibold text-brown-900 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rotate-45 bg-gold-500" aria-hidden="true" />
        {children}
      </h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------
// النماذج
// ---------------------------------------------------------------------
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      {children}
      {error ? <span className="block text-xs text-bad mt-1" role="alert">{error}</span> : hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full h-11 rounded-[var(--radius-control)] border border-sand-dark bg-white px-3 text-[15px] text-ink placeholder:text-muted/60 transition-[box-shadow,border-color] focus:outline-none focus:ring-[3px] focus:ring-gold-400/35 focus:border-gold-500 disabled:bg-brown-50 disabled:text-muted aria-[invalid=true]:border-bad';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, 'pl-8 cursor-pointer', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={clsx(inputCls, 'h-auto py-2.5 leading-relaxed', props.className)} />;
}

/** أزرار اختيار (بدل القوائم المنسدلة للاختيارات القليلة) */
export function Choice<T extends string | number>({
  value,
  options,
  onChange,
  multi = false,
  size = 'md',
}: {
  value: T | T[] | null;
  options: { value: T; label: string; count?: number }[];
  onChange: (v: any) => void;
  multi?: boolean;
  size?: 'sm' | 'md';
}) {
  const selected = (v: T) => (multi ? Array.isArray(value) && value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-1.5" role={multi ? 'group' : 'radiogroup'}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={selected(o.value)}
          onClick={() => {
            if (!multi) return onChange(o.value);
            const cur = Array.isArray(value) ? value : [];
            onChange(cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value]);
          }}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-[10px] border transition-colors cursor-pointer',
            size === 'sm' ? 'h-9 px-3 text-[13px]' : 'h-11 px-4 text-sm',
            selected(o.value) ? 'bg-brown-800 border-brown-800 text-white font-medium' : 'bg-white border-sand-dark text-ink hover:bg-brown-50'
          )}
        >
          {selected(o.value) && multi && <Check className="w-3.5 h-3.5" />}
          {o.label}
          {o.count != null && <span className={clsx('tabular text-[12px]', selected(o.value) ? 'text-gold-300' : 'text-muted')}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** خانة بحث بأيقونة */
export function Search({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={clsx('relative w-full sm:max-w-xs', className)}>
      <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={clsx(inputCls, 'pr-9')} />
    </div>
  );
}

/** شريط البحث والفلاتر */
export function FilterBar({ children, end }: { children: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4 no-print">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">{children}</div>
      {end && <div className="flex flex-wrap gap-2">{end}</div>}
    </div>
  );
}

/** قائمة فلتر صغيرة */
export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted w-full sm:w-auto">
      <span className="shrink-0 w-14 sm:w-auto">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputCls, 'h-10 flex-1 sm:flex-none sm:!w-auto min-w-[120px] text-sm pl-8 cursor-pointer')}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------
// النوافذ: Modal و Drawer
// ---------------------------------------------------------------------
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // الحفاظ على التركيز جوه النافذة
      if (e.key === 'Tab' && ref.current) {
        const items = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // تركيز أول حقل لو مفيش autoFocus
    setTimeout(() => {
      if (ref.current && !ref.current.contains(document.activeElement)) {
        (ref.current.querySelector<HTMLElement>('[autofocus], input, select, textarea') ?? ref.current).focus();
      }
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-brown-950/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={clsx(
          'relative w-full bg-card shadow-[var(--shadow-overlay)] flex flex-col max-h-[92dvh] rounded-t-3xl sm:rounded-2xl outline-none overflow-hidden',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="border-band opacity-60 shrink-0" aria-hidden="true" />
        <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-ink flex items-center gap-2 min-w-0">
            <Star8 className="w-3 h-3 text-gold-500 shrink-0" />
            <span className="truncate">{title}</span>
          </h2>
          <button onClick={onClose} className="w-10 h-10 -me-2 rounded-lg hover:bg-brown-100 text-muted cursor-pointer inline-flex items-center justify-center" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto scroll-soft px-5 py-5 flex-1">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-border bg-paper flex flex-wrap gap-2 justify-end pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

/** لوحة جانبية (للملفات التفصيلية). على الموبايل بتفتح من تحت بعرض الشاشة. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-brown-950/45 backdrop-blur-[2px]" onClick={onClose} />
      {/* RTL: اللوحة بتطلع من الشمال (نهاية السطر) علشان ما تغطيش السايدبار */}
      <div
        ref={ref}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 w-full sm:w-[520px] bg-parchment shadow-[var(--shadow-overlay)] flex flex-col outline-none"
      >
        <header className="relative bg-brown-950 text-white px-5 pt-[max(16px,env(safe-area-inset-top))] pb-4 shrink-0 overflow-hidden">
          <div className="absolute inset-0 pattern-girih opacity-[0.07] pointer-events-none" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] text-gold-200 leading-snug truncate">{title}</h2>
              {subtitle && <div className="text-[13px] text-brown-100/75 mt-0.5">{subtitle}</div>}
            </div>
            <button onClick={onClose} className="w-10 h-10 -me-2 rounded-lg hover:bg-white/10 text-brown-100 cursor-pointer inline-flex items-center justify-center shrink-0" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="border-band opacity-70 shrink-0" aria-hidden="true" />
        <div className="overflow-y-auto scroll-soft flex-1 p-4 sm:p-5 space-y-4">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-border bg-card flex flex-wrap gap-2 justify-end pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// الحالات والشارات (مش بنعتمد على اللون لوحده: كل حالة ليها أيقونة ونص)
// ---------------------------------------------------------------------
const STATUS_STYLE: Record<AssignmentStatus, string> = {
  confirmed: 'bg-ok-soft text-ok border-ok/20',
  pending: 'bg-wait-soft text-wait border-wait/20',
  excused: 'bg-bad-soft text-bad border-bad/20',
};
const STATUS_TEXT: Record<AssignmentStatus, string> = { confirmed: 'مؤكد', pending: 'منتظر', excused: 'معتذر' };
const STATUS_ICON: Record<AssignmentStatus, typeof Check> = { confirmed: Check, pending: Clock, excused: X };

export function StatusPill({ status, className }: { status: AssignmentStatus; className?: string }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 h-6 px-2 rounded-full border text-[12px] font-medium whitespace-nowrap', STATUS_STYLE[status], className)}>
      <Icon className="w-3 h-3" strokeWidth={2.5} aria-hidden="true" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export type Tone = 'sand' | 'gold' | 'brown' | 'bad' | 'ok' | 'wait';
const TAG_TONE: Record<Tone, string> = {
  sand: 'bg-brown-100 text-brown-700',
  gold: 'bg-gold-200 text-gold-700',
  brown: 'bg-brown-800 text-white',
  bad: 'bg-bad-soft text-bad',
  ok: 'bg-ok-soft text-ok',
  wait: 'bg-wait-soft text-wait',
};

export function Tag({ children, tone = 'sand', className }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-medium whitespace-nowrap', TAG_TONE[tone], className)}>{children}</span>;
}

/** شريط نسبة (اكتمال التوزيع وغيره) */
export function Progress({ value, tone = 'gold', label, className }: { value: number; tone?: 'gold' | 'ok' | 'wait' | 'bad'; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const bar = { gold: 'bg-gold-500', ok: 'bg-ok', wait: 'bg-wait', bad: 'bg-bad' }[tone];
  return (
    <div className={clsx('h-2 rounded-full bg-brown-100 overflow-hidden', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={clsx('h-full rounded-full transition-[width] duration-500', bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Empty({ title, children, action, icon: Icon }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="relative w-16 h-16 mx-auto mb-4 text-gold-500">
        <Star8Outline className="absolute inset-0 w-16 h-16 opacity-60" />
        <span className="absolute inset-0 flex items-center justify-center text-brown-700">{Icon ? <Icon className="w-5 h-5" /> : <Star8 className="w-4 h-4 text-gold-500" />}</span>
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <p className="text-muted text-sm mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-5 flex flex-wrap gap-2 justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} aria-hidden="true" />;
}

/** مؤشر (KPI) */
export function Stat({
  label,
  value,
  tone = 'brown',
  hint,
  icon: Icon,
  progress,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'brown' | 'ok' | 'wait' | 'bad' | 'gold';
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  progress?: number;
  onClick?: () => void;
}) {
  const color = { brown: 'text-brown-900', ok: 'text-ok', wait: 'text-wait', bad: 'text-bad', gold: 'text-gold-700' }[tone];
  const chip = { brown: 'bg-brown-100 text-brown-700', ok: 'bg-ok-soft text-ok', wait: 'bg-wait-soft text-wait', bad: 'bg-bad-soft text-bad', gold: 'bg-gold-200 text-gold-700' }[tone];
  const El = onClick ? 'button' : 'div';
  return (
    <El
      onClick={onClick}
      className={clsx(
        'relative text-right w-full bg-card border border-border rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] overflow-hidden',
        onClick && 'cursor-pointer hover:border-gold-400 transition-colors'
      )}
    >
      <span className="absolute top-0 right-4 left-4 h-[2px] bg-gradient-to-l from-transparent via-gold-400/70 to-transparent" aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] text-muted leading-snug">{label}</div>
        {Icon && (
          <span className={clsx('w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0', chip)}>
            <Icon className="w-[18px] h-[18px]" />
          </span>
        )}
      </div>
      <div className={clsx('font-num text-[28px] font-bold tabular leading-tight mt-1', color)}>{value}</div>
      {progress != null && <Progress value={progress} className="mt-2" tone={progress >= 100 ? 'ok' : 'gold'} label={label} />}
      {hint && <div className="text-xs text-muted mt-1.5">{hint}</div>}
    </El>
  );
}

// ---------------------------------------------------------------------
// التبويبات
// ---------------------------------------------------------------------
export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; icon?: React.ComponentType<{ className?: string }>; count?: number }[] }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-brown-100/70 border border-border overflow-x-auto scroll-soft no-print" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-[9px] text-sm cursor-pointer transition-colors',
            value === t.value ? 'bg-card text-brown-900 font-semibold shadow-[0_1px_3px_rgba(36,21,13,0.12)]' : 'text-muted hover:text-ink'
          )}
        >
          {t.icon && <t.icon className={clsx('w-4 h-4', value === t.value && 'text-gold-600')} />}
          {t.label}
          {t.count != null && <span className="tabular text-[12px] rounded-full bg-brown-100 px-1.5 min-w-5 text-center">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// جدول البيانات: ترتيب + صفحات، ويتحول لكروت على الموبايل
// ---------------------------------------------------------------------
export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** قيمة الترتيب (لو موجودة، العمود قابل للترتيب) */
  sort?: (row: T) => string | number;
  className?: string;
  align?: 'start' | 'center';
  /** يتخفى على الشاشات الصغيرة في عرض الكروت */
  hideOnCard?: boolean;
}

export type SortState = { key: string; dir: 'asc' | 'desc' } | null;

export function useTable<T>(rows: T[], columns: Column<T>[], { pageSize = 15, initialSort = null as SortState } = {}) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [page, setPage] = useState(1);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const f = col.sort;
    const out = [...rows].sort((a, b) => {
      const x = f(a);
      const y = f(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar');
      return sort.dir === 'asc' ? c : -c;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages);
  const visible = sorted.slice((cur - 1) * pageSize, cur * pageSize);
  const toggle = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
    setPage(1);
  };
  return { sort, toggle, page: cur, pages, setPage, visible, total: sorted.length, pageSize };
}

export function DataTable<T>({
  columns,
  table,
  rowKey,
  onRowClick,
  card,
  empty,
  minWidth = 720,
}: {
  columns: Column<T>[];
  table: ReturnType<typeof useTable<T>>;
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  /** عرض الكارت على الموبايل */
  card?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  minWidth?: number;
}) {
  if (table.total === 0) return <div className="bg-card border border-border rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">{empty}</div>;
  return (
    <div>
      {/* كمبيوتر وتابلت */}
      <div className={clsx('bg-card border border-border rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-x-auto scroll-soft print-area', card && 'hidden md:block')}>
        <table className="w-full text-sm border-collapse" style={{ minWidth }}>
          <thead>
            <tr className="bg-brown-50 border-b border-border">
              {columns.map((c) => {
                const active = table.sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={clsx('px-4 h-12 text-[12.5px] font-semibold text-muted whitespace-nowrap', c.align === 'center' ? 'text-center' : 'text-right', c.className)} aria-sort={active ? (table.sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.sort ? (
                      <button onClick={() => table.toggle(c.key)} className={clsx('inline-flex items-center gap-1 cursor-pointer hover:text-ink', active && 'text-brown-900')}>
                        {c.header}
                        {active ? (table.sort!.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />) : <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.visible.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(r); } : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={clsx('border-t border-border first:border-t-0 transition-colors', onRowClick && 'cursor-pointer hover:bg-brown-50/70 focus-visible:bg-brown-50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx('px-4 py-3 align-middle', c.align === 'center' && 'text-center', c.className)}>{c.cell(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* موبايل: كروت */}
      {card && (
        <div className="md:hidden bg-card border border-border rounded-[var(--radius-card)] shadow-[var(--shadow-card)] divide-y divide-border overflow-hidden">
          {table.visible.map((r) => (
            <div key={rowKey(r)}>{card(r)}</div>
          ))}
        </div>
      )}
      <Pagination page={table.page} pages={table.pages} total={table.total} pageSize={table.pageSize} onChange={table.setPage} />
    </div>
  );
}

export function Pagination({ page, pages, total, pageSize, onChange }: { page: number; pages: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  if (pages <= 1) return <div className="text-[12.5px] text-muted mt-3 px-1 no-print">{total} نتيجة</div>;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex items-center justify-between gap-3 mt-3 px-1 no-print" aria-label="الصفحات">
      <span className="text-[12.5px] text-muted tabular">{from}–{to} من {total}</span>
      <div className="flex items-center gap-1">
        <IconButton aria-label="الصفحة السابقة" disabled={page <= 1} onClick={() => onChange(page - 1)} className="w-10 h-10 border border-border bg-card">
          <ChevronRight className="w-4 h-4" />
        </IconButton>
        <span className="text-sm tabular px-2">{page} / {pages}</span>
        <IconButton aria-label="الصفحة التالية" disabled={page >= pages} onClick={() => onChange(page + 1)} className="w-10 h-10 border border-border bg-card">
          <ChevronLeft className="w-4 h-4" />
        </IconButton>
      </div>
    </nav>
  );
}

/** بحث عربي يتجاهل الهمزات والتاء المربوطة */
export function normalizeAr(s: string): string {
  return (s || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ً-ْ]/g, '')
    .toLowerCase()
    .trim();
}
