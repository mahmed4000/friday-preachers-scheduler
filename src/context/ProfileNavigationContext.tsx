import React, { createContext, useContext } from 'react';
import { Mosque, Imam } from '../types/index.ts';

export interface ProfileNavigationContextType {
  openImamProfile: (id: number) => void;
  openMosqueProfile: (id: number) => void;
  openEditImam?: (imam: Imam) => void;
  openEditMosque?: (mosque: Mosque) => void;
  navigateBack?: () => void;
}

export const ProfileNavigationContext = createContext<ProfileNavigationContextType>({
  openImamProfile: () => {},
  openMosqueProfile: () => {},
});

export const useProfileNavigation = () => useContext(ProfileNavigationContext);

// Clickable Imam Component
export interface ClickableImamProps {
  id?: number | null;
  name?: string | null;
  className?: string;
  badge?: React.ReactNode;
  showIcon?: boolean;
}

export function ClickableImam({
  id,
  name,
  className = '',
  badge,
  showIcon = false,
}: ClickableImamProps) {
  const { openImamProfile } = useProfileNavigation();

  if (!id || !name) {
    return <span className={className}>{name || '—'}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openImamProfile(id);
      }}
      className={`text-right group inline-flex items-center gap-1 hover:text-emerald-800 transition-colors cursor-pointer select-none ${className}`}
      title={`عرض الملف التعريفي الكامل للشيخ: ${name}`}
    >
      <span className="font-bold underline decoration-slate-300 group-hover:decoration-emerald-700 underline-offset-2">
        {name}
      </span>
      {badge && <span className="shrink-0">{badge}</span>}
    </button>
  );
}

// Clickable Mosque Component
export interface ClickableMosqueProps {
  id?: number | null;
  name?: string | null;
  code?: string | null;
  className?: string;
  showCode?: boolean;
}

export function ClickableMosque({
  id,
  name,
  code,
  className = '',
  showCode = false,
}: ClickableMosqueProps) {
  const { openMosqueProfile } = useProfileNavigation();

  if (!id || !name) {
    return <span className={className}>{name || '—'}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openMosqueProfile(id);
      }}
      className={`text-right group inline-flex items-center gap-1 hover:text-emerald-800 transition-colors cursor-pointer select-none ${className}`}
      title={`عرض الملف التعريفي الشامل لمسجد: ${name}`}
    >
      <span className="font-bold underline decoration-slate-300 group-hover:decoration-emerald-700 underline-offset-2">
        {name}
      </span>
      {showCode && code && (
        <span className="text-[10px] text-slate-400 font-mono">({code})</span>
      )}
    </button>
  );
}
