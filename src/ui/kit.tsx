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
  primary: 'bg-brown-800 text-gold-200 hover:bg-brown-700 border border-brown-900 shadow-sm',
  gold: 'bg-gold-500 text-brown-950 hover:bg-gold-400 border border-gold-600 shadow-sm',
  outline: 'bg-paper text-brown-800 border border-sand-dark hover:border-gold-500 hover:bg-gold-200/40',
  ghost: 'text-brown-700 hover:bg-brown-100',
  danger: 'bg-paper text-bad border border-bad/40 hover:bg-bad-soft',
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-[13px]' : 'px-4 py-2 text-sm',
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
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1.5 text-[13px]' : 'px-4 py-2 text-sm',
        BTN[variant],
        className
      )}
    />
  );
}

export function Card({ title, action, children, className }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('bg-paper border border-sand rounded-xl shadow-[0_1px_0_rgba(69,42,22,0.04)]', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-sand/80">
          {title && (
            <h2 className="flex items-center gap-2 text-lg text-brown-800 min-w-0">
              <Star8 className="w-3.5 h-3.5 text-gold-500 shrink-0" />
              <span className="truncate">{title}</span>
            </h2>
          )}
          {action}
        </header>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="text-[28px] sm:text-3xl text-brown-900">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-sm font-semibold text-brown-800 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-lg border border-sand-dark bg-white px-3 py-2 text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-500';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, 'pl-8', props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={2} {...props} className={clsx(inputCls, props.className)} />;
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
            'px-3 py-1.5 rounded-lg border text-sm transition-colors cursor-pointer',
            selected(o.value)
              ? 'bg-brown-800 border-brown-900 text-gold-200 font-semibold'
              : 'bg-white border-sand-dark text-brown-800 hover:border-gold-500'
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
      <div className="absolute inset-0 bg-brown-950/55" onClick={onClose} />
      <div
        className={clsx(
          'relative w-full bg-paper border border-gold-400/60 shadow-2xl flex flex-col max-h-[92dvh] rounded-t-2xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-sand bg-brown-100/60 rounded-t-2xl">
          <h2 className="text-xl text-brown-900 flex items-center gap-2">
            <Star8 className="w-3.5 h-3.5 text-gold-500" />
            {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sand text-brown-700 cursor-pointer" aria-label="إغلاق">
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <footer className="px-5 py-3 border-t border-sand flex flex-wrap gap-2 justify-end pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  confirmed: 'bg-ok-soft text-ok border-ok/25',
  pending: 'bg-wait-soft text-wait border-wait/25',
  excused: 'bg-bad-soft text-bad border-bad/25',
};
const STATUS_TEXT: Record<AssignmentStatus, string> = { confirmed: 'مؤكد', pending: 'منتظر', excused: 'معتذر' };

export function StatusPill({ status, className }: { status: AssignmentStatus; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-semibold', STATUS_STYLE[status], className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_TEXT[status]}
    </span>
  );
}

export function Tag({ children, tone = 'sand' }: { children: React.ReactNode; tone?: 'sand' | 'gold' | 'brown' | 'bad' }) {
  const t = {
    sand: 'bg-brown-100 text-brown-700 border-sand-dark/60',
    gold: 'bg-gold-200 text-gold-700 border-gold-400/50',
    brown: 'bg-brown-800 text-gold-200 border-brown-900',
    bad: 'bg-bad-soft text-bad border-bad/25',
  }[tone];
  return <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[12px] font-semibold', t)}>{children}</span>;
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      <Star8 className="w-8 h-8 text-gold-400 mx-auto mb-3" />
      <h3 className="text-xl text-brown-800">{title}</h3>
      {children && <p className="text-muted text-sm mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone = 'brown', hint }: { label: string; value: React.ReactNode; tone?: 'brown' | 'ok' | 'wait' | 'bad'; hint?: string }) {
  const color = { brown: 'text-brown-800', ok: 'text-ok', wait: 'text-wait', bad: 'text-bad' }[tone];
  return (
    <div className="bg-paper border border-sand rounded-xl px-4 py-3">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={clsx('text-2xl font-bold tabular mt-0.5', color)}>{value}</div>
      {hint && <div className="text-xs text-muted mt-0.5">{hint}</div>}
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
