import React from 'react';
import { Button } from './Button.tsx';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`text-center py-12 px-6 bg-white rounded-xl border border-slate-200/80 shadow-2xs relative overflow-hidden ${className}`}
    >
      {/* Subtle Islamic Motif Arch Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center">
        <svg width="320" height="320" viewBox="0 0 100 100" fill="currentColor">
          <polygon points="50 0, 62 38, 100 50, 62 62, 50 100, 38 62, 0 50, 38 38" />
        </svg>
      </div>

      <div className="relative z-10 max-w-md mx-auto space-y-3">
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mx-auto shadow-2xs">
            {icon}
          </div>
        )}

        <h3 className="text-base font-bold text-slate-900 font-heading">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{description}</p>

        {actionLabel && onAction && (
          <div className="pt-2">
            <Button variant="primary" size="md" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
