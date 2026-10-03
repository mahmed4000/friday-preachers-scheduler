import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'pills' | 'underline' | 'segment';
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  className = '',
  variant = 'segment',
}: TabsProps) {
  if (variant === 'underline') {
    return (
      <div className={`flex border-b border-slate-200 gap-6 ${className}`} dir="rtl">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`pb-3 font-heading text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'text-emerald-900 border-b-2 border-emerald-800'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Default: Segmented container
  return (
    <div
      className={`inline-flex items-center p-1 bg-slate-100/90 rounded-lg border border-slate-200/80 ${className}`}
      dir="rtl"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-heading font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-emerald-50 text-emerald-900' : 'bg-slate-200/70 text-slate-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
