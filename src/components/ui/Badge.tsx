import React from 'react';

export type BadgeVariant =
  | 'approved'     // 🟢 معتمد
  | 'review'       // 🟡 يحتاج مراجعة
  | 'conflict'     // 🔴 يوجد تعارض
  | 'draft'        // 🔵 مسودة
  | 'inactive'     // ⚪ غير نشط
  | 'gold'         // ⚜️ ذهبي تراثي
  | 'fixed'        // ثابت
  | 'preferred'    // مفضل
  | 'balanced';    // متوازن

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  className?: string;
}

export function Badge({
  children,
  variant = 'approved',
  size = 'md',
  icon,
  className = '',
}: BadgeProps) {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles: Record<BadgeVariant, string> = {
    // 🟢 معتمد
    approved:
      'bg-emerald-50 text-emerald-900 border border-emerald-300/80 font-semibold',
    // 🟡 يحتاج مراجعة
    review:
      'bg-amber-50 text-amber-900 border border-amber-300/80 font-semibold',
    // 🔴 يوجد تعارض
    conflict:
      'bg-rose-50 text-rose-900 border border-rose-300/80 font-semibold',
    // 🔵 مسودة
    draft:
      'bg-sky-50 text-sky-900 border border-sky-300/80 font-semibold',
    // ⚪ غير نشط
    inactive:
      'bg-slate-100 text-slate-700 border border-slate-300/80 font-medium',
    // ⚜️ ذهبي تراثي
    gold:
      'bg-amber-50/70 text-amber-950 border border-amber-400/60 font-semibold',
    // ثابت
    fixed:
      'bg-emerald-100/70 text-emerald-950 border border-emerald-400/60 font-bold',
    // مفضل
    preferred:
      'bg-amber-100/70 text-amber-950 border border-amber-400/60 font-bold',
    // متوازن
    balanced:
      'bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold',
  };

  // Indicators
  const dotIndicators: Partial<Record<BadgeVariant, string>> = {
    approved: 'bg-emerald-600',
    review: 'bg-amber-500',
    conflict: 'bg-rose-600',
    draft: 'bg-sky-500',
    inactive: 'bg-slate-400',
    gold: 'bg-amber-600',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-md transition-colors ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon ? (
        <span className="shrink-0">{icon}</span>
      ) : dotIndicators[variant] ? (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotIndicators[variant]}`}
          aria-hidden="true"
        />
      ) : null}
      <span className="leading-none">{children}</span>
    </span>
  );
}
