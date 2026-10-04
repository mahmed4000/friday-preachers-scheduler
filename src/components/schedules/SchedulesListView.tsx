import React, { useState } from 'react';
import { MonthlySchedule } from '../../types/index.ts';
import {
  CalendarDays,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  AlertCircle,
  FileText,
  Lock,
  Calendar,
  Archive,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Badge } from '../common/Badge.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';

interface SchedulesListViewProps {
  schedules: MonthlySchedule[];
  onSelectSchedule: (scheduleId: number) => void;
  onOpenWizard: () => void;
}

type TabType = 'ACTIVE_UPCOMING' | 'ARCHIVE' | 'ALL';

export function SchedulesListView({
  schedules,
  onSelectSchedule,
  onOpenWizard,
}: SchedulesListViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE_UPCOMING');

  // Strict chronological sorting: Current month FIRST (top-right in RTL), then upcoming ASC, then past archive
  const sortedSchedules = CalendarService.sortSchedulesChronologically(schedules || []);

  const enrichedWithPeriod = sortedSchedules.map((schedule) => {
    try {
      const details = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth);
      return {
        ...schedule,
        periodStatus: details.periodStatus,
        isPast: details.isPast,
        isCurrent: details.isCurrent,
        isFuture: details.isFuture,
        pastFridaysCount: details.pastFridaysCount,
        futureFridaysCount: details.futureFridaysCount,
      };
    } catch {
      return {
        ...schedule,
        periodStatus: (schedule.status as any) === 'ARCHIVED' ? 'PAST' : 'FUTURE',
        isPast: (schedule.status as any) === 'ARCHIVED',
        isCurrent: false,
        isFuture: (schedule.status as any) !== 'ARCHIVED',
      };
    }
  });

  const activeAndUpcomingList = enrichedWithPeriod.filter((s) => !s.isPast && s.periodStatus !== 'PAST');
  const archivedSchedules = enrichedWithPeriod.filter((s) => s.isPast || s.periodStatus === 'PAST');

  const displayedSchedules =
    activeTab === 'ACTIVE_UPCOMING'
      ? activeAndUpcomingList
      : activeTab === 'ARCHIVE'
      ? archivedSchedules
      : enrichedWithPeriod;

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
      case 'ARCHIVED':
        return <Badge variant="default">مؤرشف 🗄️</Badge>;
      case 'DRAFT':
      default:
        return <Badge variant="default">مسودة غير مولدة 🟡</Badge>;
    }
  };

  const getPeriodBadge = (schedule: any) => {
    if (schedule.isPast || schedule.periodStatus === 'PAST') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
          <Lock className="w-2.5 h-2.5 text-slate-500" />
          <span>منتهي (أرشيف)</span>
        </span>
      );
    }
    if (schedule.isCurrent || schedule.periodStatus === 'CURRENT') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
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
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading">سجل الجداول الشهرية</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض وتوليد واعتماد ومراجعة جداول خطباء الجمعة مرتبة من اليمين إلى الشمال بدءاً من الشهر الحالي، مع عزل الشهور المنتهية في الأرشيف
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

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('ACTIVE_UPCOMING')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold font-heading flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ACTIVE_UPCOMING'
              ? 'bg-emerald-800 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>الشهور النشطة والقادمة</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'ACTIVE_UPCOMING' ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {activeAndUpcomingList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ARCHIVE')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold font-heading flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ARCHIVE'
              ? 'bg-slate-800 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-slate-400" />
          <span>أرشيف الشهور السابقة</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'ARCHIVE' ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {archivedSchedules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold font-heading flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>كافة الجداول</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              activeTab === 'ALL' ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {enrichedWithPeriod.length}
          </span>
        </button>
      </div>

      {/* Grid of Schedules (Ordered strictly from right to left in RTL: Current Month first at top-right, then future ASC) */}
      {displayedSchedules.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-700">لا توجد جداول في هذا القسم حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSchedules.map((schedule) => {
            const isCur = schedule.isCurrent || schedule.periodStatus === 'CURRENT';
            const isPast = schedule.isPast || schedule.periodStatus === 'PAST';

            return (
              <div
                key={schedule.id}
                className={`bg-white rounded-xl border shadow-2xs hover:shadow-xs transition-all p-5 flex flex-col justify-between ${
                  isCur
                    ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-linear-to-bl from-emerald-50/40 via-white to-white'
                    : isPast
                    ? 'border-slate-300/80 bg-slate-50/60'
                    : 'border-slate-200 hover:border-slate-300'
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

                  <h4 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
                    <span>{schedule.monthName} {schedule.hijriYear} هـ</span>
                    {isCur && <span className="text-emerald-700 text-xs font-normal">🟢 (مباشر)</span>}
                    {isPast && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {schedule.fridaysCount} جمعات في الشهر · الإصدار V{schedule.currentVersion}
                  </p>

                  {schedule.approvedBy && (
                    <div
                      className={`mt-3 text-[11px] p-2 rounded-lg flex items-center gap-1.5 ${
                        isPast
                          ? 'text-slate-700 bg-slate-100'
                          : 'text-emerald-800 bg-emerald-50/70'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${isPast ? 'text-slate-500' : 'text-emerald-600'}`}
                      />
                      <span>معتمد بواسطة: {schedule.approvedBy}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {isPast
                      ? 'أرشيف منتهي'
                      : isCur
                      ? 'الشهر المباشر حالياً'
                      : schedule.publishedAt
                      ? 'تم النشر والتوزيع'
                      : 'في مرحلة الإعداد'}
                  </span>
                  <button
                    onClick={() => onSelectSchedule(schedule.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isCur
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs font-bold'
                        : isPast
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
      )}
    </div>
  );
}
