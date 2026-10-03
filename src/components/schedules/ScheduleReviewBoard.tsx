import React, { useState } from 'react';
import {
  MonthlySchedule,
  Friday,
  Assignment,
  Conflict,
  OverrideRecord,
  Mosque,
  Imam,
} from '../../types/index.ts';
import {
  Building2,
  Users2,
  Calendar,
  Lock,
  Star,
  Scale,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Send,
  Eye,
  ArrowRight,
  Filter,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../common/Badge.tsx';
import { AssignmentCellDrawer } from './AssignmentCellDrawer.tsx';
import { ConflictCenterModal } from './ConflictCenterModal.tsx';
import { fetchApi } from '../../lib/api.ts';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';

interface ScheduleReviewBoardProps {
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  conflicts: Conflict[];
  overrides: OverrideRecord[];
  mosques: Mosque[];
  imams: Imam[];
  onBackToList: () => void;
  onRefreshData: () => void;
  onNavigateToPublishing: () => void;
}

export function ScheduleReviewBoard({
  schedule,
  fridays,
  assignments,
  conflicts,
  overrides,
  mosques,
  imams,
  onBackToList,
  onRefreshData,
  onNavigateToPublishing,
}: ScheduleReviewBoardProps) {
  // View mode: byMosque | byImam | byFriday
  const [viewMode, setViewMode] = useState<'byMosque' | 'byImam' | 'byFriday'>('byMosque');
  const [selectedFridayFilter, setSelectedFridayFilter] = useState<number>(1);

  // Drawer & Modal states
  const [selectedCell, setSelectedCell] = useState<{ mosqueId: number; fridayIndex: number } | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isRedistributeModalOpen, setIsRedistributeModalOpen] = useState(false);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Redistribution options
  const [redistScope, setRedistScope] = useState<'ALL' | 'UNLOCKED_ONLY' | 'SINGLE_MOSQUE' | 'SINGLE_FRIDAY'>('UNLOCKED_ONLY');
  const [targetMosqueId, setTargetMosqueId] = useState<number>(mosques[0]?.id || 1);
  const [targetFridayIdx, setTargetFridayIdx] = useState<number>(1);
  const [redistMethod, setRedistMethod] = useState<'Balanced Random' | 'Balanced' | 'Random'>('Balanced Random');
  const [redistributing, setRedistributing] = useState(false);

  // Approval state
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Maps for fast lookup
  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));

  // Grid index: "mosqueId:fridayIndex" -> Assignment
  const assignmentMap = new Map<string, Assignment>();
  for (const a of assignments) {
    assignmentMap.set(`${a.mosqueId}:${a.fridayIndex}`, a);
  }

  // Count empty assignments & critical conflicts
  const emptyAssignmentsCount = assignments.filter((a) => !a.imamId).length;
  const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL');

  // Cell Drawer item
  const activeAssignment = selectedCell
    ? assignmentMap.get(`${selectedCell.mosqueId}:${selectedCell.fridayIndex}`) || null
    : null;
  const activeMosque = selectedCell ? mosqueMap.get(selectedCell.mosqueId) || null : null;
  const activeFriday = selectedCell
    ? fridays.find((f) => f.fridayIndex === selectedCell.fridayIndex) || null
    : null;

  // Handler: Manual Assignment Change
  const handleSaveCellChange = async (newImamId: number | null, reason: string, isOverride: boolean) => {
    if (!activeAssignment || !selectedCell) return;
    await fetchApi(`/api/schedules/${schedule.id}/assignment`, {
      method: 'POST',
      body: JSON.stringify({
        assignmentId: activeAssignment.id,
        mosqueId: selectedCell.mosqueId,
        fridayIndex: selectedCell.fridayIndex,
        newImamId,
        reason,
        isOverride,
      }),
    });
    onRefreshData();
  };

  // Handler: Toggle Lock
  const handleToggleLock = async (assignmentId: number) => {
    await fetchApi(`/api/schedules/${schedule.id}/lock-toggle`, {
      method: 'POST',
      body: JSON.stringify({ assignmentId }),
    });
    onRefreshData();
  };

  // Handler: Redistribute
  const handleExecuteRedistribute = async () => {
    setRedistributing(true);
    try {
      await fetchApi(`/api/schedules/${schedule.id}/redistribute`, {
        method: 'POST',
        body: JSON.stringify({
          unlockedOnly: redistScope === 'UNLOCKED_ONLY',
          targetMosqueId: redistScope === 'SINGLE_MOSQUE' ? targetMosqueId : undefined,
          targetFridayIndex: redistScope === 'SINGLE_FRIDAY' ? targetFridayIdx : undefined,
          distributionMethod: redistMethod,
        }),
      });
      setIsRedistributeModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'تعذر إعادة التوزيع');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setRedistributing(false);
    }
  };

  // Handler: Approve Schedule
  const handleApproveSchedule = async () => {
    setApproving(true);
    setActionError(null);
    try {
      await fetchApi(`/api/schedules/${schedule.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          approvedBy: 'مدير أمانة الشؤون الدينية',
          note: `اعتماد رسمي للإصدار V${schedule.currentVersion + 1}`,
        }),
      });
      setIsApproveModalOpen(false);
      onRefreshData();
    } catch (err: any) {
      setActionError(err.message || 'تعذر اعتماد الجدول');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setApproving(false);
    }
  };

  const getSourceIconBadge = (source: string) => {
    switch (source) {
      case 'FIXED':
        return (
          <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            🔒 ثابت
          </span>
        );
      case 'PREFERENCE':
        return (
          <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-amber-50 text-amber-800 border border-amber-200">
            ⭐ تفضيل
          </span>
        );
      case 'BALANCED':
      case 'BALANCED_RANDOM':
        return (
          <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-sky-50 text-sky-800 border border-sky-200">
            ⚖️ متوازن
          </span>
        );
      case 'MANUAL':
        return (
          <span className="text-[10px] px-1 py-0.2 rounded font-medium bg-purple-50 text-purple-800 border border-purple-200">
            ✏️ يدوي
          </span>
        );
      case 'OVERRIDE':
        return (
          <span className="text-[10px] px-1 py-0.2 rounded font-bold bg-rose-50 text-rose-800 border border-rose-200">
            ⚡ استثناء
          </span>
        );
      default:
        return null;
    }
  };

  const isScheduleApproved = schedule.status === 'APPROVED' || schedule.status === 'PUBLISHED';

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="underline text-[11px] cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToList}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الجداول</span>
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <h3 className="text-lg font-bold text-slate-900 font-heading">
              جدول شهر {schedule.monthName} {schedule.hijriYear} هـ
            </h3>
            <span className="text-xs font-mono text-slate-500">· الإصدار V{schedule.currentVersion}</span>
            {schedule.status === 'APPROVED' && <Badge variant="success">معتمد 🟢</Badge>}
            {schedule.status === 'PUBLISHED' && <Badge variant="purple">منشور 🟣</Badge>}
            {schedule.status === 'NEEDS_REAPPROVAL' && <Badge variant="warning">بحاجة لإعادة اعتماد ⚠️</Badge>}
            {schedule.status === 'REVIEW' && <Badge variant="info">قيد المراجعة 🔵</Badge>}
          </div>

          <p className="text-xs text-slate-500 mt-1">
            {schedule.fridaysCount} جمعات · {mosques.filter((m) => m.isActive).length} مسجداً ·{' '}
            {assignments.length} تعييناً
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            <button
              onClick={() => setViewMode('byMosque')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'byMosque' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>حسب المساجد</span>
            </button>
            <button
              onClick={() => setViewMode('byImam')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'byImam' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users2 className="w-3.5 h-3.5" />
              <span>حسب الخطباء</span>
            </button>
            <button
              onClick={() => setViewMode('byFriday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'byFriday' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>حسب الجمعة</span>
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200"></div>

          {/* Conflict Center Trigger */}
          <button
            onClick={() => setIsConflictModalOpen(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border ${
              criticalConflicts.length > 0
                ? 'bg-rose-50 text-rose-800 border-rose-300 shadow-xs animate-pulse'
                : conflicts.length > 0
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>مركز التعارضات ({conflicts.length})</span>
          </button>

          {/* Redistribute Trigger */}
          <button
            onClick={() => setIsRedistributeModalOpen(true)}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-200"
          >
            <RotateCw className="w-3.5 h-3.5 text-slate-600" />
            <span>إعادة التوزيع</span>
          </button>

          {/* Approval Trigger */}
          <button
            onClick={() => setIsApproveModalOpen(true)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
              isScheduleApproved
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-emerald-700 hover:bg-emerald-800 text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isScheduleApproved ? 'معتمد رسمي (إعادة اعتماد)' : 'اعتماد الجدول'}</span>
          </button>

          {/* Publishing Center */}
          <button
            onClick={onNavigateToPublishing}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>النشر والطباعة</span>
          </button>
        </div>
      </div>

      {/* Conflict Callout Banner */}
      {conflicts.length > 0 && (
        <div className="p-3.5 bg-amber-50/95 border border-amber-300 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-950 font-heading block">
                تنبيه: يوجد {conflicts.length} حالات تحتاج إلى تدقيق في جدول هذا الشهر
              </span>
              <span className="text-[11px] text-amber-800">
                يمكنك مراجعة البدلاء المتاحين وحل التعارضات فورياً أو تعديل التعيين بالنقر على أي خلية.
              </span>
            </div>
          </div>
          <button
            onClick={() => setIsConflictModalOpen(true)}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold transition-colors self-end sm:self-center cursor-pointer shrink-0"
          >
            مركز حل التعارضات ({conflicts.length})
          </button>
        </div>
      )}

      {/* VIEW 1: BY MOSQUE (The Grid) */}
      {viewMode === 'byMosque' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold sticky top-0 z-30 shadow-2xs">
                <tr>
                  <th className="py-3 px-4 w-64 border-l border-slate-200 sticky right-0 bg-slate-100 z-40 font-heading">المسجد والمنطقة</th>
                  {fridays.map((friday) => (
                    <th key={friday.id} className="py-3 px-3 text-center border-l border-slate-200 min-w-44">
                      <span className="font-bold text-slate-900 block font-heading">
                        الجمعة ({friday.fridayIndex})
                      </span>
                      <span className="text-[11px] font-normal text-slate-500 font-mono">
                        {friday.hijriDate}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mosques
                  .filter((m) => m.isActive)
                  .map((mosque) => (
                    <tr key={mosque.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 border-l border-slate-200 bg-white sticky right-0 z-20 shadow-2xs">
                        <ClickableMosque
                          id={mosque.id}
                          name={mosque.name}
                          code={mosque.code}
                          className="font-bold text-slate-900 block font-heading"
                        />
                        <span className="text-[11px] text-slate-500">
                          {mosque.region} · كود {mosque.code}
                          {mosque.fixedImamId && ' · ثابت'}
                        </span>
                      </td>

                      {fridays.map((friday) => {
                        const cellKey = `${mosque.id}:${friday.fridayIndex}`;
                        const assignment = assignmentMap.get(cellKey);
                        const assignedImam = assignment?.imamId ? imamMap.get(assignment.imamId) : null;
                        const isLocked = assignment?.isLocked || false;

                        return (
                          <td
                            key={friday.id}
                            onClick={() => setSelectedCell({ mosqueId: mosque.id, fridayIndex: friday.fridayIndex })}
                            className="p-2 border-l border-slate-200 text-center cursor-pointer hover:bg-emerald-50/40 transition-colors"
                          >
                            {!assignedImam ? (
                              <div className="p-2 rounded-lg border-2 border-dashed border-rose-300 bg-rose-50/30 text-rose-700 text-xs font-bold flex items-center justify-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                <span>شاغر (بدون خطيب)</span>
                              </div>
                            ) : (
                              <div
                                className={`p-2 rounded-lg border text-right transition-all ${
                                  isLocked
                                    ? 'bg-purple-50/40 border-purple-200'
                                    : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  {getSourceIconBadge(assignment?.source || 'BALANCED')}
                                  {isLocked && <Lock className="w-3 h-3 text-purple-700 shrink-0" />}
                                </div>
                                <ClickableImam
                                  id={assignedImam.id}
                                  name={assignedImam.name}
                                  className="font-bold text-slate-900 text-xs block truncate leading-tight"
                                />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: BY IMAM */}
      {viewMode === 'byImam' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-60">الخطيب</th>
                  <th className="py-3 px-4 text-center">النوع</th>
                  <th className="py-3 px-4 text-center">المستهدف (Target)</th>
                  <th className="py-3 px-4 text-center">المعيّن الفعلي</th>
                  <th className="py-3 px-4">تفاصيل التكليفات في جمعات الشهر</th>
                  <th className="py-3 px-4 text-center">حالة الحمل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {imams
                  .filter((i) => i.isActive)
                  .map((imam) => {
                    const imamAssignments = assignments.filter((a) => a.imamId === imam.id);
                    const assignedCount = imamAssignments.length;

                    let loadStatus = 'BALANCED';
                    if (assignedCount < imam.minFridays) loadStatus = 'UNDER';
                    else if (assignedCount > imam.maxFridays) loadStatus = 'OVER';

                    return (
                      <tr key={imam.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <ClickableImam
                            id={imam.id}
                            name={imam.name}
                            className="font-bold text-slate-900 block hover:text-emerald-700"
                          />
                          <span className="block text-[11px] font-normal text-slate-400">
                            {imam.region || 'الوسط'} · حد أقصى: {imam.maxFridays}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {imam.type === 'FIXED' && <Badge variant="success">ثابت</Badge>}
                          {imam.type === 'PARTIAL_FIXED' && <Badge variant="warning">جزئي</Badge>}
                          {imam.type === 'FLEXIBLE' && <Badge variant="info">مرن</Badge>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700 tabular-nums">
                          {imam.targetFridays}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-800 tabular-nums text-sm">
                          {assignedCount}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {imamAssignments.map((a) => {
                              const m = mosqueMap.get(a.mosqueId);
                              return (
                                <span
                                  key={a.id}
                                  onClick={() => setSelectedCell({ mosqueId: a.mosqueId, fridayIndex: a.fridayIndex })}
                                  className="cursor-pointer text-[11px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1"
                                >
                                  <span className="font-bold text-emerald-800">ج{a.fridayIndex}:</span>
                                  {m ? (
                                    <ClickableMosque
                                      id={m.id}
                                      name={m.name}
                                      className="hover:text-emerald-700 text-xs"
                                    />
                                  ) : (
                                    <span>مسجد</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {loadStatus === 'BALANCED' && <Badge variant="success">متوازن ✓</Badge>}
                          {loadStatus === 'UNDER' && <Badge variant="warning">أقل من الأدنى ({assignedCount}/{imam.minFridays})</Badge>}
                          {loadStatus === 'OVER' && <Badge variant="danger">تجاوز الأقصى ({assignedCount}/{imam.maxFridays})</Badge>}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: BY FRIDAY */}
      {viewMode === 'byFriday' && (
        <div className="space-y-4">
          {/* Friday selector tabs */}
          <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200">
            <span className="text-xs font-bold text-slate-700">اختر الجمعة:</span>
            <div className="flex items-center gap-1">
              {fridays.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFridayFilter(f.fridayIndex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedFridayFilter === f.fridayIndex
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  الجمعة {f.fridayIndex} ({f.hijriDate})
                </button>
              ))}
            </div>
          </div>

          {/* Mosques on this Friday */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mosques
              .filter((m) => m.isActive)
              .map((mosque) => {
                const cellKey = `${mosque.id}:${selectedFridayFilter}`;
                const assignment = assignmentMap.get(cellKey);
                const assignedImam = assignment?.imamId ? imamMap.get(assignment.imamId) : null;

                return (
                  <div
                    key={mosque.id}
                    onClick={() => setSelectedCell({ mosqueId: mosque.id, fridayIndex: selectedFridayFilter })}
                    className={`p-4 rounded-xl border cursor-pointer hover:shadow-xs transition-all flex flex-col justify-between ${
                      !assignedImam
                        ? 'bg-rose-50/50 border-rose-300'
                        : assignment?.isLocked
                        ? 'bg-purple-50/30 border-purple-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400 font-medium">{mosque.code}</span>
                        {assignment && getSourceIconBadge(assignment.source)}
                      </div>

                      <ClickableMosque
                        id={mosque.id}
                        name={mosque.name}
                        code={mosque.code}
                        className="text-sm font-bold text-slate-900 block hover:text-emerald-700"
                      />
                      <p className="text-[11px] text-slate-500">{mosque.region}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      {assignedImam ? (
                        <ClickableImam
                          id={assignedImam.id}
                          name={assignedImam.name}
                          className="text-xs font-bold text-emerald-900 hover:text-emerald-700"
                        />
                      ) : (
                        <span className="text-xs font-bold text-rose-600">شاغر ⚠️</span>
                      )}
                      <span className="text-[10px] text-slate-400 underline">تعديل</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Cell Drawer for editing assignment */}
      <AssignmentCellDrawer
        isOpen={Boolean(selectedCell)}
        onClose={() => setSelectedCell(null)}
        assignment={activeAssignment}
        mosque={activeMosque}
        friday={activeFriday}
        imams={imams.filter((i) => i.isActive)}
        allAssignments={assignments}
        conflicts={conflicts}
        onSaveChange={handleSaveCellChange}
        onToggleLock={handleToggleLock}
      />

      {/* Conflict Center Modal */}
      <ConflictCenterModal
        isOpen={isConflictModalOpen}
        onClose={() => setIsConflictModalOpen(false)}
        conflicts={conflicts}
        mosques={mosques}
        imams={imams}
        onSelectAssignmentCell={(mId, fIdx) => {
          setSelectedCell({ mosqueId: mId, fridayIndex: fIdx });
        }}
      />

      {/* Redistribution Modal */}
      {isRedistributeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                إعادة توزيع الخطباء (Re-distribute)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إعادة تشغيل المحرك لتغطية الشواغر مع الحفاظ التام على التعيينات المقفولة
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">نطاق إعادة التوزيع:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRedistScope('UNLOCKED_ONLY')}
                  className={`p-2.5 rounded-lg border text-right ${
                    redistScope === 'UNLOCKED_ONLY'
                      ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  التعيينات غير المقفولة فقط
                  <span className="block text-[10px] text-slate-500 font-normal">يحافظ على المثبت يدوياً</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('ALL')}
                  className={`p-2.5 rounded-lg border text-right ${
                    redistScope === 'ALL'
                      ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  كامل الجدول من البداية
                  <span className="block text-[10px] text-slate-500 font-normal">يعيد بناء التعيينات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('SINGLE_MOSQUE')}
                  className={`p-2.5 rounded-lg border text-right ${
                    redistScope === 'SINGLE_MOSQUE'
                      ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  مسجد محدد فقط
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('SINGLE_FRIDAY')}
                  className={`p-2.5 rounded-lg border text-right ${
                    redistScope === 'SINGLE_FRIDAY'
                      ? 'bg-emerald-50 border-emerald-600 font-bold text-emerald-900'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  جمعة محددة فقط
                </button>
              </div>

              {redistScope === 'SINGLE_MOSQUE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">اختر المسجد:</label>
                  <select
                    value={targetMosqueId}
                    onChange={(e) => setTargetMosqueId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                  >
                    {mosques.filter((m) => m.isActive).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.region})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {redistScope === 'SINGLE_FRIDAY' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">اختر الجمعة:</label>
                  <select
                    value={targetFridayIdx}
                    onChange={(e) => setTargetFridayIdx(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                  >
                    {fridays.map((f) => (
                      <option key={f.id} value={f.fridayIndex}>
                        الجمعة {f.fridayIndex} ({f.hijriDate})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">طريقة التوزيع:</label>
                <select
                  value={redistMethod}
                  onChange={(e) => setRedistMethod(e.target.value as any)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="Balanced Random">Balanced Random — متوازن عشوائي (الأمثل)</option>
                  <option value="Balanced">Balanced — متوازن تماماً</option>
                  <option value="Random">Random — عشوائي ضمن القيود</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-between">
              <button
                type="button"
                onClick={() => setIsRedistributeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={redistributing}
                onClick={handleExecuteRedistribute}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{redistributing ? 'جارٍ المعالجة...' : 'بدء إعادة التوزيع'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Checklist Modal */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 font-heading">
                اعتماد جدول شهر {schedule.monthName} {schedule.hijriYear} هـ
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                التدقيق النهائي للضوابط الشرعية والإدارية قبل إقرار النسخة الرسمية
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800">1. تغطية كافة المساجد بخطباء:</span>
                {emptyAssignmentsCount === 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> مكتمل 100%
                  </span>
                ) : (
                  <span className="text-rose-700 font-bold">
                    يوجد {emptyAssignmentsCount} مسجداً شاغراً ✕
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800">2. خلو الجدول من التعارضات الحرجة:</span>
                {criticalConflicts.length === 0 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> سليم تماماً
                  </span>
                ) : (
                  <span className="text-rose-700 font-bold">
                    يوجد {criticalConflicts.length} تعارضات حرجة ✕
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800">3. احترام الثوابت والأنماط المعتمدة:</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> محققة
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800">4. تدقيق الاستثناءات الإدارية (Overrides):</span>
                <span className="text-slate-700 font-mono font-medium">
                  {overrides.length} استثناء مسجل
                </span>
              </div>
            </div>

            {emptyAssignmentsCount > 0 || criticalConflicts.length > 0 ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  لا يمكن إتمام الاعتماد الرسمي قبل حل التعارضات وتغطية كافة المساجد الشاغرة.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  الجدول مكتمل ومستوفٍ لكافة الشروط. بعد الاعتماد ستصبح النسخة رسمية وجاهزة للطباعة والإرسال.
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-between">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={emptyAssignmentsCount > 0 || criticalConflicts.length > 0 || approving}
                onClick={handleApproveSchedule}
                className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{approving ? 'جارٍ الاعتماد...' : 'إقرار واعتماد النسخة الرسمية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
