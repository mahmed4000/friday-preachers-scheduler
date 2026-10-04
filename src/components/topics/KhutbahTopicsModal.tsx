import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calendar,
  Sparkles,
  Save,
  Check,
  X,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { MonthlySchedule, Friday } from '../../types/index.ts';

import {
  loadScheduleKhutbahTopics,
  saveScheduleKhutbahTopics,
  KhutbahTopicItem,
} from '../../services/khutbahTopicsService.ts';

interface KhutbahTopicsModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: MonthlySchedule;
  fridays: Friday[];
}

export function KhutbahTopicsModal({
  isOpen,
  onClose,
  schedule,
  fridays,
}: KhutbahTopicsModalProps) {
  const [topics, setTopics] = useState<Record<number, KhutbahTopicItem>>(() => {
    return loadScheduleKhutbahTopics(schedule.id, schedule.hijriYear, schedule.hijriMonth, fridays);
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTopics(loadScheduleKhutbahTopics(schedule.id, schedule.hijriYear, schedule.hijriMonth, fridays));
    }
  }, [isOpen, schedule.id, schedule.hijriYear, schedule.hijriMonth]);

  if (!isOpen) return null;

  const handleUpdate = (fridayIndex: number, field: keyof KhutbahTopicItem, value: any) => {
    setTopics((prev) => ({
      ...prev,
      [fridayIndex]: {
        ...prev[fridayIndex],
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    saveScheduleKhutbahTopics(schedule.id, schedule.hijriYear, schedule.hijriMonth, topics);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-emerald-950 p-5 text-white flex items-center justify-between islamic-pattern">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
                <Sparkles className="w-2.5 h-2.5" />
                <span>التوجيه الدعوي المعتمد</span>
              </span>
              <span className="text-xs text-emerald-200">
                شهر {schedule.monthName} {schedule.hijriYear} هـ
              </span>
            </div>
            <h3 className="text-lg font-bold font-heading text-white">
              موضوعات خطب الجمعة الموحدة والتوجيهات
            </h3>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              تحديد عناوين ومحاور الخطب المعتمدة لتظهر تلقائياً في بطاقات الخطباء ورسائل التكليف
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-right">
          {fridays.map((friday) => {
            const item = topics[friday.fridayIndex] || {
              fridayIndex: friday.fridayIndex,
              title: '',
              elements: '',
              hadithReference: '',
              durationMinutes: 20,
            };

            return (
              <div
                key={friday.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-800 text-white text-xs font-bold flex items-center justify-center">
                      {friday.fridayIndex}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 font-heading">
                      {friday.ordinalName} — {friday.hijriDate}
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {friday.gregorianDate || 'يوم الجمعة'}
                  </span>
                </div>

                {/* Topic Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عنوان الخطبة المعتمد:
                  </label>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => handleUpdate(friday.fridayIndex, 'title', e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-emerald-600 focus:border-emerald-600"
                    placeholder="اكتب عنوان خطبة الجمعة..."
                  />
                </div>

                {/* Sermon Elements */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    محاور وعناصر الخطبة المقترحة:
                  </label>
                  <textarea
                    rows={2}
                    value={item.elements}
                    onChange={(e) => handleUpdate(friday.fridayIndex, 'elements', e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-emerald-600 focus:border-emerald-600 leading-relaxed"
                    placeholder="العناصر الأساسية للخطبة مفصولة بنقاط..."
                  />
                </div>

                {/* Hadith / Reference & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      الشاهد النبوي / القرآني:
                    </label>
                    <input
                      type="text"
                      value={item.hadithReference}
                      onChange={(e) => handleUpdate(friday.fridayIndex, 'hadithReference', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-serif text-slate-700 focus:outline-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      المدة المقترحة:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        value={item.durationMinutes}
                        onChange={(e) => handleUpdate(friday.fridayIndex, 'durationMinutes', Number(e.target.value))}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center focus:outline-emerald-600"
                      />
                      <span className="text-slate-500 text-xs shrink-0">دقيقة</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            سيتم تضمين هذه الموضوعات في بطاقات الواتساب الموجهة للخطباء
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>تم حفظ وتعميم الموضوعات ✓</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>حفظ وتعميم الموضوعات</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
