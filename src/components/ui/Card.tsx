import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'warm' | 'hero' | 'bordered';
  hasAccentBorder?: boolean;
}

export function Card({
  children,
  variant = 'default',
  hasAccentBorder = false,
  className = '',
  ...props
}: CardProps) {
  const variantStyles = {
    default: 'bg-white border-slate-200/90 shadow-2xs',
    warm: 'bg-[#fcfaf7] border-amber-900/10 shadow-2xs',
    hero: 'bg-gradient-to-l from-slate-900 via-emerald-950 to-slate-900 text-white border-slate-700/60 shadow-sm',
    bordered: 'bg-white border-emerald-900/20 shadow-2xs hover:border-emerald-800/40',
  };

  return (
    <div
      className={`rounded-xl border transition-all duration-200 relative overflow-hidden ${variantStyles[variant]} ${
        hasAccentBorder ? 'border-r-4 border-r-emerald-700' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-3 text-xs ${className}`}
    >
      {children}
    </div>
  );
}
