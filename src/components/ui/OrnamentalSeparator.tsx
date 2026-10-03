import React from 'react';

interface OrnamentalSeparatorProps {
  className?: string;
  variant?: 'gold' | 'emerald' | 'subtle';
  label?: string;
}

export function OrnamentalSeparator({
  className = '',
  variant = 'gold',
  label,
}: OrnamentalSeparatorProps) {
  const variantColors = {
    gold: {
      line: 'border-amber-600/30',
      icon: 'text-amber-700/80',
    },
    emerald: {
      line: 'border-emerald-800/30',
      icon: 'text-emerald-800/80',
    },
    subtle: {
      line: 'border-slate-200',
      icon: 'text-slate-400',
    },
  };

  const colors = variantColors[variant];

  return (
    <div className={`flex items-center justify-center my-4 ${className}`} aria-hidden="true">
      <div className={`flex-1 border-t ${colors.line}`}></div>
      <div className={`px-3 flex items-center gap-2 ${colors.icon}`}>
        <span className="text-[10px] leading-none select-none">❖</span>
        {label && (
          <span className="text-xs font-heading font-medium tracking-wide text-slate-600">
            {label}
          </span>
        )}
        <span className="text-[10px] leading-none select-none">❖</span>
      </div>
      <div className={`flex-1 border-t ${colors.line}`}></div>
    </div>
  );
}
