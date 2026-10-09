import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../lib/api.ts';
import {
  BarChart3,
  Users2,
  Building2,
  Sliders,
  ShieldAlert,
  Award,
  Calendar,
  Lock,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ClickableImam } from '../../context/ProfileNavigationContext.tsx';

export function ReportsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BALANCED' | 'UNDER' | 'OVER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadReports = (scheduleId?: number | string) => {
    setLoading(true);
    const query = scheduleId ? `?scheduleId=${scheduleId}` : '';
    fetchApi<any>(`/api/reports/summary${query}`)
      .then((res) => {
        setData(res);
        if (res?.selectedSchedule) {
          setSelectedScheduleId(res.selectedSchedule.id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleSelectSchedule = (id: number | string) => {
    setSelectedScheduleId(id);
    loadReports(id);
  };

  if (loading && !data) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        جارٍ تحميل تقارير ومؤشرات عدالة التوزيع...
      </div>
    );
  }

  if (!data) return null;

  const {
    selectedSchedule,
    availableSchedules = [],
    imamLoads = [],
    mosqueLoads = [],
    overridesCount = 0,
    manualChangesCount = 0,
    totalConflicts = 0,
    balancedCount = 0,
    underCount = 0,
    overCount = 0,
    totalAssigned = 0,
    isAll = false,
  } = data;

  const filteredImams = imamLoads.filter((i: any) => {
    const matchesSearch = !searchQuery || i.name?.includes(searchQuery);
    const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const fairnessRate = imamLoads.length > 0 ? Math.round((balancedCount / imamLoads.length) * 100) : 100;

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-800" />
            <span>تقارير الأداء ومؤشرات عدالة التوزيع الرقابية</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            تحليل أحمال الخطباء ومعدلات تحقيق التفضيلات والعدالة لكل شهر هجري وفق التسلسل الزمني المعتمد
          </p>
        </div>

        {selectedSchedule && (
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span className="font-bold text-slate-800">
              {isAll ? 'الإجمالي التراكمي' : `شهر: ${selectedSchedule.monthName} ${selectedSchedule.hijriYear} هـ`}
            </span>
            {selectedSchedule.isCurrent && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                الشهر الحالي 🟢
              </span>
            )}
            {selectedSchedule.isPast && (
              <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                <span>أرشيف منتهي</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Month Selector Pills (Ordered: Current Month first, then future chronologically, then past archive, then all) */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 font-heading flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>اختر الشهر لإظهار التقرير الرقابي:</span>
          </span>
          <span className="text-[11px] text-slate-400">مرتبة تاريخياً بدءاً من الشهر الحالي</span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {availableSchedules.map((s: any) => {
            const isSelected = selectedScheduleId === s.id;
            const isCur = s.isCurrent || s.periodStatus === 'CURRENT';
            const isPst = s.isPast || s.periodStatus === 'PAST';

            return (
              <button
                key={s.id}
                onClick={() => handleSelectSchedule(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? isCur
                      ? 'bg-emerald-800 text-white shadow-xs'
                      : isPst
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'bg-blue-700 text-white shadow-xs'
                    : isCur
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
                    : isPst
                    ? 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {isCur && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                {isPst && <Lock className="w-3 h-3 text-slate-400" />}
                <span>{s.monthName} {s.hijriYear} هـ</span>
                {isCur && <span className="text-[10px] opacity-90">(الحالي)</span>}
                {isPst && <span className="text-[10px] opacity-80">(أرشيف)</span>}
              </button>
            );
          })}

          <button
            onClick={() => handleSelectSchedule('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedScheduleId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>الإجمالي التراكمي لكافة الشهور</span>
          </button>
        </div>
      </div>

      {/* High-level Metrics for Selected Scope */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">عدالة توزيع الخطباء</span>
          <span className="text-2xl font-bold text-emerald-800 tabular-nums">
            {fairnessRate}%
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {balancedCount} خطيباً في النطاق المتوازن
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">الجمعات المعينة</span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {totalAssigned}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {isAll ? 'إجمالي كافة الشهور' : `تكليفات شهر ${selectedSchedule?.monthName || ''}`}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">التعديلات والاستثناءات</span>
          <span className="text-2xl font-bold text-amber-800 tabular-nums">
            {overridesCount + manualChangesCount}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {overridesCount} استثناء · {manualChangesCount} تعديل يدوي
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 block mb-1">التعارضات المسجلة</span>
          <span className={`text-2xl font-bold tabular-nums ${totalConflicts > 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
            {totalConflicts}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {totalConflicts === 0 ? 'جميع القيود محترمة ومطابقة' : 'تعارضات تحتاج معالجة'}
          </span>
        </div>
      </div>

      {/* Imams Workload Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 font-heading">
              مؤشر أحمال الخطباء — {isAll ? 'الإجمالي التراكمي' : `شهر ${selectedSchedule?.monthName} ${selectedSchedule?.hijriYear} هـ`}
            </h4>
            <span className="text-xs text-slate-500 mt-0.5 block">
              {balancedCount} متوازن · {underCount} دون الأدنى · {overCount} فوق الأقصى
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث باسم الخطيب..."
                className="pr-8 pl-3 py-1 text-xs border border-slate-300 rounded-lg focus:outline-emerald-600 bg-white text-slate-900 font-medium placeholder:text-slate-400"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-2 py-1 text-[11px] rounded font-medium cursor-pointer ${
                  statusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                الكل ({imamLoads.length})
              </button>
              <button
                onClick={() => setStatusFilter('BALANCED')}
                className={`px-2 py-1 text-[11px] rounded font-medium cursor-pointer ${
                  statusFilter === 'BALANCED' ? 'bg-emerald-700 text-white' : 'text-emerald-800 hover:bg-emerald-50'
                }`}
              >
                متوازن ({balancedCount})
              </button>
              <button
                onClick={() => setStatusFilter('UNDER')}
                className={`px-2 py-1 text-[11px] rounded font-medium cursor-pointer ${
                  statusFilter === 'UNDER' ? 'bg-amber-700 text-white' : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                دون الأدنى ({underCount})
              </button>
              <button
                onClick={() => setStatusFilter('OVER')}
                className={`px-2 py-1 text-[11px] rounded font-medium cursor-pointer ${
                  statusFilter === 'OVER' ? 'bg-rose-700 text-white' : 'text-rose-800 hover:bg-rose-50'
                }`}
              >
                فوق الأقصى ({overCount})
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3">الخطيب</th>
                <th className="py-2.5 px-3 text-center">النوع</th>
                <th className="py-2.5 px-3 text-center">الحد الأدنى الشهري</th>
                <th className="py-2.5 px-3 text-center">المستهدف (Target)</th>
                <th className="py-2.5 px-3 text-center">الحد الأقصى الشهري</th>
                <th className="py-2.5 px-3 text-center">الجمعات المعينة بهذا الشهر</th>
                <th className="py-2.5 px-3 text-center">حالة العدالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredImams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    لا يوجد خطباء مطابقون للبحث أو الفلتر المحدد
                  </td>
                </tr>
              ) : (
                filteredImams.map((i: any) => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <ClickableImam
                        id={i.id}
                        name={i.name}
                        className="font-bold text-slate-900 hover:text-emerald-700"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px]">{i.type}</td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{i.min}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 tabular-nums">{i.target}</td>
                    <td className="py-2.5 px-3 text-center tabular-nums">{i.max}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-800 tabular-nums text-sm">
                      {i.assigned}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {i.status === 'BALANCED' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          متوازن ✓
                        </span>
                      )}
                      {i.status === 'UNDER' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          دون الأدنى
                        </span>
                      )}
                      {i.status === 'OVER' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          فوق الأقصى
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
