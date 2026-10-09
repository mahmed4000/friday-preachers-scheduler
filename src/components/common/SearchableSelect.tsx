import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, User, Building2 } from 'lucide-react';

export interface SearchableOption {
  id: number;
  label: string;
  sublabel?: string;
  badge?: string;
  code?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: number;
  onChange: (id: number) => void;
  placeholder?: string;
  label?: string;
  iconType?: 'IMAM' | 'MOSQUE';
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'بحث بالاسم، الكود، أو المنطقة...',
  label,
  iconType = 'IMAM',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  // Filter options based on label, sublabel, code
  const filteredOptions = options.filter((opt) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      opt.label.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
      (opt.code && opt.code.toLowerCase().includes(q)) ||
      (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (id: number) => {
    onChange(id);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} dir="rtl">
      {label && (
        <label className="block text-xs font-bold text-slate-700 font-heading mb-1">
          {label}
        </label>
      )}

      {/* Select Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-medium text-slate-800 shadow-2xs transition-colors cursor-pointer min-w-[220px]"
      >
        <div className="flex items-center gap-2 truncate">
          {iconType === 'IMAM' ? (
            <User className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          ) : (
            <Building2 className="w-3.5 h-3.5 text-sky-700 shrink-0" />
          )}
          <span className="truncate font-bold">
            {selectedOption ? selectedOption.label : 'اختر من القائمة...'}
          </span>
          {selectedOption?.sublabel && (
            <span className="text-[11px] text-slate-400 truncate">
              ({selectedOption.sublabel})
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Floating Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pr-8 pl-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 font-medium text-slate-900 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto p-1 divide-y divide-slate-50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 font-medium">
                لم يتم العثور على نتائج تطابق "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-right px-3 py-2 text-xs rounded-lg flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex flex-col truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.code && (
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                            #{opt.code}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <span className="text-[10px] text-slate-500 truncate font-normal">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
