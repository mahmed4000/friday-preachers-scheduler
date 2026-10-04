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
  ChevronLeft,
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

  // Ensure schedules are strictly ordered: Current first, then future chronological, then archive past
  const sortedSchedules = CalendarService.sortSchedulesChronologically(schedules);

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
        isPast: schedule.status === 'ARCHIVED',
        isCurrent: false,
        isFuture: true,
      };
    }
  });

  const currentMonthSchedule = enrichedWithPeriod.find((s) => s.isCurrent || s.periodStatus === 'CURRENT');
  const upcomingSchedules = enrichedWithPeriod.filter(
    (s) => (!s.isPast && s.periodStatus !== 'PAST') && s.id !== currentMonthSchedule?.id
  );
  const archivedSchedules = enrichedWithPeriod.filter((s) => s.isPast || s.periodStatus === 'PAST');
  const activeAndUpcomingList = enrichedWithPeriod.filter((s) => !s.isPast && s.periodStatus !== 'PAST');

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
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-800" />
            <h3 className="text-base font-bold text-slate-900 font-heading">سجل الجداول الشهرية</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            إدارة وتوليد واعتماد ومراجعة جداول خطباء الجمعة مرتبة زمنياً، مع عزل الشهور المنتهية في الأرشيف
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

      {/* VIEW: Active & Upcoming */}
      {activeTab === 'ACTIVE_UPCOMING' && (
        <div className="space-y-6">
          {/* Hero Section: Current Month */}
          {currentMonthSchedule && (
            <div className="bg-linear-to-l from-emerald-50/70 via-white to-emerald-50/40 border-2 border-emerald-600/60 rounded-2xl p-5 shadow-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[10px] font-bold px-3 py-1 rounded-br-xl flex items-center gap-1 shadow-2xs">
                <Sparkles className="w-3 h-3" />
                <span>الشهر المباشر قيد التنفيذ الآن</span>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs text-emerald-800 font-bold">#{currentMonthSchedule.id}</span>
                    {getPeriodBadge(currentMonthSchedule)}
                    {getStatusBadge(currentMonthSchedule.status)}
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 font-heading flex items-center gap-2">
                    <span>جدول شهر {currentMonthSchedule.monthName} {currentMonthSchedule.hijriYear} هـ</span>
                  </h3>

                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                    <span>📅 {currentMonthSchedule.fridaysCount} جمعات في الشهر</span>
                    <span>•</span>
                    <span>نسخة معتمدة V{currentMonthSchedule.currentVersion}</span>
                    {currentMonthSchedule.approvedBy && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-800 font-medium">معتمد بواسطة: {currentMonthSchedule.approvedBy}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSelectSchedule(currentMonthSchedule.id)}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>فتح لوحة توزيع الشهر الحالي</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section: Upcoming Months (Chronological Order) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-slate-800 font-heading flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>الشهور القادمة (مرتبة حسب التاريخ تصاعدياً)</span>
              </h4>
              <span className="text-xs text-slate-500">{upcomingSchedules.length} شهور مجدولة مستقبلاً</span>
            </div>

            {upcomingSchedules.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                لا توجد شهور قادمة مجدولة بعد. يمكنك النقر على &quot;إنشاء جدول شهري جديد&quot; لجدولة الشهر القادم.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="bg-white rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between"
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
                        {schedule.publishedAt ? 'تم النشر والتوزيع' : 'في مرحلة الإعداد والمراجعة'}
                      </span>
                      <button
                        onClick={() => onSelectSchedule(schedule.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>لوحة المراجعة</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: Past Archive */}
      {activeTab === 'ARCHIVE' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <Archive className="w-5 h-5 text-slate-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-slate-800 font-heading">أرشيف الشهور السابقة المنتهية</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                سجلات تاريخية موثقة ومقفلة رقابياً. يمكنك استعراض التوزيعات السابقة للتوثيق واستخراج التقارير دون تعديل.
              </p>
            </div>
          </div>

          {archivedSchedules.length === 0 ? (
            <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
              <Archive className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">لا توجد شهور مؤرشفة سابقة حالياً</p>
              <p className="text-[11px] text-slate-400 mt-1">
                عند انتهاء فترة الشهر الحالي وانقضاء جمعاته، سيتم تحويله تلقائياً إلى هذا الأرشيف.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {archivedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="bg-slate-50/60 rounded-xl border border-slate-300/80 shadow-2xs hover:shadow-xs transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-slate-400 font-medium">#{schedule.id}</span>
                        {getPeriodBadge(schedule)}
                      </div>
                      {getStatusBadge(schedule.status)}
                    </div>

                    <h4 className="text-base font-bold text-slate-800 font-heading flex items-center gap-2">
                      <span>{schedule.monthName} {schedule.hijriYear} هـ</span>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {schedule.fridaysCount} جمعات منتهية · الإصدار V{schedule.currentVersion}
                    </p>

                    {schedule.approvedBy && (
                      <div className="mt-3 text-[11px] text-slate-700 bg-slate-100 p-2 rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>معتمد تاريخياً: {schedule.approvedBy}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium">أرشيف للقراءة فقط</span>
                    <button
                      onClick={() => onSelectSchedule(schedule.id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-700 hover:bg-slate-800 text-white"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>عرض سجل الأرشيف</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: All Schedules */}
      {activeTab === 'ALL' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedWithPeriod.map((schedule) => {
            const isPast = schedule.isPast || schedule.periodStatus === 'PAST';
            const isCur = schedule.isCurrent || schedule.periodStatus === 'CURRENT';

            return (
              <div
                key={schedule.id}
                className={`bg-white rounded-xl border shadow-2xs hover:shadow-xs transition-all p-5 flex flex-col justify-between ${
                  isCur
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : isPast
                    ? 'border-slate-200 bg-slate-50/40'
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
                        : isCur
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
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
