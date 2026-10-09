import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, User, Phone, ShieldBan } from 'lucide-react';
import { Imam } from '../../types/index.ts';

export interface DisabledImamInfo {
  reason: string;
  mosqueName?: string;
  fridayIndex?: number;
}

interface SearchablePreacherSelectProps {
  imams: Imam[];
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  disabledImams?: Record<number, DisabledImamInfo>;
  onAttemptDisabledSelect?: (imamId: number, info: DisabledImamInfo) => void;
}

export function SearchablePreacherSelect({
  imams,
  value,
  onChange,
  placeholder = '-- ابحث بالاسم واختر فضيلة الشيخ --',
  className = '',
  disabled = false,
  disabledImams = {},
  onAttemptDisabledSelect,
}: SearchablePreacherSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected Imam Object
  const selectedImam = useMemo(() => {
    if (!value) return null;
    return imams.find((i) => i.id === Number(value)) || null;
  }, [imams, value]);

  // Is selected imam currently disabled/conflicted?
  const selectedCollision = useMemo(() => {
    if (!value || !disabledImams) return null;
    return disabledImams[Number(value)] || null;
  }, [value, disabledImams]);

  // Filtered Imams
  const filteredImams = useMemo(() => {
    if (!searchTerm.trim()) return imams;
    const term = searchTerm.trim().toLowerCase();
    return imams.filter((i) => {
      const nameMatch = i.name.toLowerCase().includes(term);
      const phoneMatch = i.phone ? i.phone.toLowerCase().includes(term) : false;
      const typeLabel =
        i.type === 'FIXED'
          ? 'ثابت'
          : i.type === 'PARTIAL_FIXED'
          ? 'ثابت جزئي'
          : 'مرن';
      const typeMatch = typeLabel.includes(term);
      return nameMatch || phoneMatch || typeMatch;
    });
  }, [imams, searchTerm]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (imamId: number) => {
    const collision = disabledImams[imamId];
    if (collision) {
      if (onAttemptDisabledSelect) {
        onAttemptDisabledSelect(imamId, collision);
      }
      return;
    }
    onChange(imamId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'FIXED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-200">ثابت</span>;
      case 'PARTIAL_FIXED':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">ثابت جزئي</span>;
      default:
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">مرن</span>;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full text-right ${className}`} dir="rtl">
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[38px] p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
          disabled
            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs'
            : selectedCollision
            ? 'bg-rose-50/70 border-rose-300 text-rose-900 hover:border-rose-400'
            : selectedImam
            ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 hover:border-emerald-500'
            : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
          <User className={`w-4 h-4 shrink-0 ${selectedCollision ? 'text-rose-600' : selectedImam ? 'text-emerald-700' : 'text-slate-400'}`} />
          {selectedImam ? (
            <div className="flex items-center gap-1.5 truncate text-xs font-bold text-slate-900 flex-1">
              <span className="truncate">{selectedImam.name}</span>
              {getTypeBadge(selectedImam.type)}
              {selectedCollision && (
                <span className="shrink-0 text-[10px] font-bold text-rose-700 bg-rose-100/90 border border-rose-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <ShieldBan className="w-3 h-3 text-rose-600" />
                  <span>محجوز بمكان آخر</span>
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedImam && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-slate-200/70 rounded-md text-slate-400 hover:text-slate-700 transition-colors"
              title="إلغاء الاختيار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-emerald-700' : ''}`} />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 right-0 left-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden text-xs max-h-72 flex flex-col">
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 sticky top-0 z-10">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="اكتب اسم الخطيب أو رقم الهاتف للبحث السريع..."
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500 font-medium text-slate-900 placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute left-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-[10px] text-slate-500 mt-1 pr-1 font-medium">
                نتائج البحث: {filteredImams.length} من أصل {imams.length} خطيب
              </p>
            )}
          </div>

          {/* List Options */}
          <div className="overflow-y-auto flex-1 p-1 space-y-1">
            {filteredImams.length > 0 ? (
              filteredImams.map((imam) => {
                const isSelected = imam.id === Number(value);
                const collisionInfo = disabledImams[imam.id];
                const isDisabled = Boolean(collisionInfo);

                return (
                  <div
                    key={imam.id}
                    onClick={() => handleSelect(imam.id)}
                    className={`p-2.5 rounded-lg flex items-center justify-between transition-colors ${
                      isDisabled
                        ? 'bg-rose-50/50 hover:bg-rose-50/80 text-slate-400 cursor-not-allowed border border-rose-200/60'
                        : isSelected
                        ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 cursor-pointer'
                        : 'hover:bg-slate-50 text-slate-800 font-medium cursor-pointer'
                    }`}
                    title={collisionInfo ? `غير متاح: ${collisionInfo.reason}` : undefined}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <User className={`w-3.5 h-3.5 shrink-0 ${isDisabled ? 'text-rose-400' : isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                        <span className={`truncate text-xs font-semibold ${isDisabled ? 'line-through decoration-rose-400 text-slate-500' : ''}`}>
                          {imam.name}
                        </span>
                        {getTypeBadge(imam.type)}
                      </div>

                      {collisionInfo && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 border border-rose-200 px-1.5 py-0.5 rounded w-fit">
                          <ShieldBan className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>محجوز في: {collisionInfo.mosqueName || 'مسجد آخر'}{collisionInfo.fridayIndex ? ` (الجمعة ${collisionInfo.fridayIndex})` : ''}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 mr-2">
                      {imam.phone && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Phone className="w-2.5 h-2.5" />
                          {imam.phone}
                        </span>
                      )}
                      {isDisabled ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1 rounded">مغلق</span>
                      ) : isSelected ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-1">
                <Search className="w-6 h-6 mx-auto text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-medium text-slate-600">لا يوجد خطيب يطابق كلمة البحث "{searchTerm}"</p>
                <p className="text-[10px] text-slate-400">تأكد من كتابة الاسم بشكل صحيح أو ابحث برقم الهاتف</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
