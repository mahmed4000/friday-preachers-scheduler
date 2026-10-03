import React from 'react';
import { MonthlySchedule } from '../../types/index.ts';
import { CalendarDays, Plus, ArrowLeft, CheckCircle2, Clock, Eye, AlertCircle, FileText, Lock, Calendar } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';

interface SchedulesListViewProps {
  schedules: MonthlySchedule[];
  onSelectSchedule: (scheduleId: number) => void;
  onOpenWizard: () => void;
}

export function SchedulesListView({
  schedules,
  onSelectSchedule,
  onOpenWizard,
}: SchedulesListViewProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">معتمد رسمياً 🟢</Badge>;
      case 'PUBLISHED':
        return <Badge variant="purple">منشور وموزع 🟣</Badge>;
      case 'REVIEW':
        return <Badge variant="info">قيد المراجعة 🔵</Badge>;
      case 'GENERATED':
        return <Badge variant="info">تم التوليد</Badge>;
      case 'NEEDS_REAPPROVAL':
        return <Badge variant="warning">تم تعديله بعد الاعتماد ⚠️</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="default">مسودة غير مولدة 🟡</Badge>;
    }
  };

  const getPeriodBadge = (schedule: MonthlySchedule) => {
    try {
      const details = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth);
      if (details.periodStatus === 'PAST') {
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
            <Lock className="w-2.5 h-2.5 text-slate-500" />
            <span>منتهي (أرشيف)</span>
          </span>
        );
      }
      if (details.periodStatus === 'CURRENT') {
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>الشهر الحالي</span>
          </span>
        );
      }
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
          <Calendar className="w-2.5 h-2.5 text-blue-600" />
          <span>شهر قادم</span>
        </span>
      );
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading">سجل الجداول الشهرية</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض وتوليد واعتماد ومراجعة جداول خطباء الجمعة لكل شهر هجري وفق تقويم أم القرى المعتمد
          </p>
        </div>

        <button
          onClick={onOpenWizard}
          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء جدول شهري جديد</span>
        </button>
      </div>

      {/* Grid of Schedules */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {schedules.map((schedule) => {
          let isPast = false;
          try {
            const details = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth);
            isPast = details.periodStatus === 'PAST';
          } catch {}

          return (
            <div
              key={schedule.id}
              className={`bg-white rounded-xl border shadow-2xs hover:shadow-xs transition-all p-5 flex flex-col justify-between ${
                isPast ? 'border-slate-200 bg-slate-50/40 opacity-95' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs text-slate-400 font-medium">#{schedule.id}</span>
                    {getPeriodBadge(schedule)}
                  </div>
                  {getStatusBadge(schedule.status)}
                </div>

                <h4 className="text-base font-bold text-slate-900 font-heading">
                  {schedule.monthName} {schedule.hijriYear} هـ
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {schedule.fridaysCount} جمعات في الشهر · الإصدار V{schedule.currentVersion}
                </p>

                {schedule.approvedBy && (
                  <div className="mt-3 text-[11px] text-emerald-800 bg-emerald-50/70 p-2 rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>معتمد بواسطة: {schedule.approvedBy}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {isPast ? 'أرشيف منتهي' : schedule.publishedAt ? 'تم النشر' : 'في مرحلة الإعداد'}
                </span>
                <button
                  onClick={() => onSelectSchedule(schedule.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isPast
                      ? 'bg-slate-700 hover:bg-slate-800 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{isPast ? 'عرض الأرشيف' : 'لوحة المراجعة'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

