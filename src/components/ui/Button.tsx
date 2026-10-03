import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-heading font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none rounded-lg';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5',
    md: 'text-xs px-4 py-2 gap-2 font-semibold',
    lg: 'text-sm px-5 py-2.5 gap-2.5 font-bold',
  };

  const variantStyles = {
    // Primary: Deep Islamic Emerald
    primary:
      'bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs hover:shadow-xs focus-visible:ring-emerald-700 active:scale-[0.99] border border-emerald-900/30',
    // Secondary: Warm Ivory / White with warm slate border
    secondary:
      'bg-white hover:bg-amber-50/40 text-slate-800 border border-slate-300/80 shadow-2xs hover:border-amber-700/40 focus-visible:ring-emerald-600',
    // Accent: Antique Gold
    accent:
      'bg-amber-700 hover:bg-amber-800 text-white shadow-2xs hover:shadow-xs focus-visible:ring-amber-600 border border-amber-800/40 active:scale-[0.99]',
    // Danger: Soft Muted Red
    danger:
      'bg-rose-700 hover:bg-rose-800 text-white shadow-2xs hover:shadow-xs focus-visible:ring-rose-600 border border-rose-800/40',
    // Ghost: Subtle hover only
    ghost:
      'bg-transparent hover:bg-slate-100/80 text-slate-700 hover:text-slate-900 focus-visible:ring-slate-400',
    // Outline: Emerald border
    outline:
      'bg-transparent border border-emerald-700 text-emerald-800 hover:bg-emerald-50/60 focus-visible:ring-emerald-700',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
