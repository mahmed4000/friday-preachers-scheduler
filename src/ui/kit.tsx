import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { AssignmentStatus } from '../data/types.ts';

export { clsx };

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

type BtnVariant = 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brown-800 text-white hover:bg-brown-900 border border-transparent',
  gold: 'bg-gold-500 text-white hover:bg-gold-600 border border-transparent',
  outline: 'bg-white text-ink border border-sand-dark hover:bg-brown-50 hover:border-brown-600/30',
  ghost: 'text-brown-700 border border-transparent hover:bg-brown-100',
  danger: 'bg-white text-bad border border-bad/30 hover:bg-bad-soft',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap [&_svg]:shrink-0',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        BTN[variant],
        className
      )}
    />
  );
}

export function LinkButton({
  variant = 'outline',
  size = 'md',
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: BtnVariant; size?: 'sm' | 'md' }) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors whitespace-nowrap [&_svg]:shrink-0',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        BTN[variant],
        className
      )}
    />
  );
}

export function Card({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('bg-paper border border-sand rounded-2xl shadow-[0_1px_2px_rgba(35,26,18,0.04)]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 h-14 border-b border-sand">
          {title && <h2 className="text-[15px] font-semibold text-ink min-w-0 truncate">{title}</h2>}
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] sm:text-2xl font-bold text-brown-900">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full h-10 rounded-[10px] border border-sand-dark bg-white px-3 text-[15px] text-ink placeholder:text-muted/60 transition-shadow focus:outline-none focus:ring-[3px] focus:ring-gold-400/30 focus:border-gold-500';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, 'pl-8', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={clsx(inputCls, 'h-auto py-2', props.className)} />;
}

/** أزرار اختيار (بدل القوائم المنسدلة للاختيارات القليلة) */
export function Choice<T extends string | number>({
  value,
  options,
  onChange,
  multi = false,
}: {
  value: T | T[] | null;
  options: { value: T; label: string }[];
  onChange: (v: any) => void;
  multi?: boolean;
}) {
  const selected = (v: T) => (multi ? Array.isArray(value) && value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-1.5">
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
            'h-9 px-3.5 rounded-[10px] border text-sm transition-colors cursor-pointer',
            selected(o.value)
              ? 'bg-brown-800 border-brown-800 text-white font-medium'
              : 'bg-white border-sand-dark text-ink hover:bg-brown-50'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center no-print" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-brown-950/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full bg-paper shadow-[0_20px_60px_rgba(35,26,18,0.25)] flex flex-col max-h-[92dvh] rounded-t-3xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-sand shrink-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <button onClick={onClose} className="p-2 -me-2 rounded-lg hover:bg-brown-100 text-muted cursor-pointer" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-5 flex-1">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-sand flex flex-wrap gap-2 justify-end pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  confirmed: 'bg-ok-soft text-ok',
  pending: 'bg-wait-soft text-wait',
  excused: 'bg-bad-soft text-bad',
};
const STATUS_TEXT: Record<AssignmentStatus, string> = { confirmed: 'مؤكد', pending: 'منتظر', excused: 'معتذر' };

export function StatusPill({ status, className }: { status: AssignmentStatus; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-medium whitespace-nowrap', STATUS_STYLE[status], className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Tag({ children, tone = 'sand' }: { children: React.ReactNode; tone?: 'sand' | 'gold' | 'brown' | 'bad' }) {
  const t = {
    sand: 'bg-brown-100 text-brown-700',
    gold: 'bg-gold-200/70 text-gold-700',
    brown: 'bg-brown-800 text-white',
    bad: 'bg-bad-soft text-bad',
  }[tone];
  return <span className={clsx('inline-flex items-center gap-1 h-6 px-2 rounded-md text-[12px] font-medium whitespace-nowrap', t)}>{children}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-12 h-12 rounded-full bg-gold-200/60 text-gold-600 flex items-center justify-center mx-auto mb-3">
        <Star8 className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <p className="text-muted text-sm mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = 'brown',
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'brown' | 'ok' | 'wait' | 'bad';
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const color = { brown: 'text-brown-800', ok: 'text-ok', wait: 'text-wait', bad: 'text-bad' }[tone];
  const chip = { brown: 'bg-brown-100 text-brown-700', ok: 'bg-ok-soft text-ok', wait: 'bg-wait-soft text-wait', bad: 'bg-bad-soft text-bad' }[tone];
  return (
    <div className="bg-paper border border-sand rounded-2xl p-4 shadow-[0_1px_2px_rgba(35,26,18,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] text-muted">{label}</div>
        {Icon && (
          <span className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', chip)}>
            <Icon className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className={clsx('font-display text-[26px] font-bold tabular leading-tight mt-1', color)}>{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="max-w-xs" />;
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
