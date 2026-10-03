import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type AlertVariant = 'info' | 'warning' | 'error' | 'success';

interface AlertProps {
  title?: string;
  children: React.ReactNode;
  variant?: AlertVariant;
  onClose?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function Alert({
  title,
  children,
  variant = 'info',
  onClose,
  action,
  className = '',
}: AlertProps) {
  const variantStyles: Record<
    AlertVariant,
    { bg: string; border: string; text: string; icon: React.ReactNode }
  > = {
    info: {
      bg: 'bg-sky-50/80',
      border: 'border-sky-300',
      text: 'text-sky-950',
      icon: <Info className="w-4 h-4 text-sky-700 shrink-0" />,
    },
    warning: {
      bg: 'bg-amber-50/90',
      border: 'border-amber-400/80',
      text: 'text-amber-950',
      icon: <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />,
    },
    error: {
      bg: 'bg-rose-50/90',
      border: 'border-rose-400/80',
      text: 'text-rose-950',
      icon: <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />,
    },
    success: {
      bg: 'bg-emerald-50/90',
      border: 'border-emerald-300',
      text: 'text-emerald-950',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />,
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      className={`p-4 rounded-xl border ${style.bg} ${style.border} ${style.text} flex items-start justify-between gap-3 text-xs shadow-2xs ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{style.icon}</div>
        <div className="space-y-1">
          {title && <h4 className="font-bold font-heading text-slate-900">{title}</h4>}
          <div className="text-slate-700 leading-relaxed">{children}</div>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
          aria-label="إغلاق"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
