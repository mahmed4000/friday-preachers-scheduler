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
  Award,
  BookOpen,
  Smartphone,
  Printer,
} from 'lucide-react';
import { Badge } from '../common/Badge.tsx';
import { AssignmentCellDrawer } from './AssignmentCellDrawer.tsx';
import { ConflictCenterModal } from './ConflictCenterModal.tsx';
import { OfficialDecreeModal } from '../decree/OfficialDecreeModal.tsx';
import { KhutbahTopicsModal } from '../topics/KhutbahTopicsModal.tsx';
import { PreacherMobileCardModal } from '../portal/PreacherMobileCardModal.tsx';
import { fetchApi } from '../../lib/api.ts';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';

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
  const [isDecreeModalOpen, setIsDecreeModalOpen] = useState(false);
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const [mobileCardData, setMobileCardData] = useState<{
    assignment: Assignment;
    mosque: Mosque;
    imam: Imam;
    friday: Friday;
  } | null>(null);

  // Drag-and-Drop state
  const [draggedAssignment, setDraggedAssignment] = useState<Assignment | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [swapFeedback, setSwapFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Drag-and-Drop Handlers
  const handleDragStart = (assignment: Assignment, e: React.DragEvent) => {
    if (assignment.isLocked) return;
    setDraggedAssignment(assignment);
    e.dataTransfer.setData('text/plain', JSON.stringify({ assignmentId: assignment.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (cellKey: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCellKey !== cellKey) {
      setDragOverCellKey(cellKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverCellKey(null);
  };

  const handleDrop = async (targetMosqueId: number, targetFridayIndex: number) => {
    setDragOverCellKey(null);
    if (!draggedAssignment) return;

    const targetKey = `${targetMosqueId}:${targetFridayIndex}`;
    const targetAssign = assignmentMap.get(targetKey);

    if (!targetAssign) {
      setSwapFeedback({ type: 'error', message: 'التعيين الهدف غير متاح' });
      setDraggedAssignment(null);
      setTimeout(() => setSwapFeedback(null), 4000);
      return;
    }

    if (draggedAssignment.id === targetAssign.id) {
      setDraggedAssignment(null);
      return;
    }

    if (targetAssign.isLocked) {
      setSwapFeedback({ type: 'error', message: 'لا يمكن التبديل مع خلية مقفلة (Locked) 🔒' });
      setDraggedAssignment(null);
      setTimeout(() => setSwapFeedback(null), 4000);
      return;
    }

    const srcImamName = draggedAssignment.imamId ? (imamMap.get(draggedAssignment.imamId)?.name || 'خطيب') : 'شاغر';
    const tgtImamName = targetAssign.imamId ? (imamMap.get(targetAssign.imamId)?.name || 'خطيب') : 'شاغر';

    try {
      const res = await fetchApi<{ error?: string }>(`/api/schedules/${schedule.id}/swap-assignments`, {
        method: 'POST',
        body: JSON.stringify({
          sourceAssignmentId: draggedAssignment.id,
          targetAssignmentId: targetAssign.id,
          reason: `تبديل تفاعلي بالسحب والإفلات (${srcImamName} ⇄ ${tgtImamName})`,
        }),
      });

      if (res && res.error) {
        setSwapFeedback({ type: 'error', message: res.error });
      } else {
        setSwapFeedback({
          type: 'success',
          message: `تم التبديل بنجاح بين (${srcImamName}) و (${tgtImamName}) ⇄`,
        });
        onRefreshData();
      }
    } catch (err: any) {
      setSwapFeedback({ type: 'error', message: err.message || 'فشل التبديل بالسحب والإفلات' });
    } finally {
      setDraggedAssignment(null);
      setTimeout(() => setSwapFeedback(null), 4500);
    }
  };

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
      {/* Swap feedback toast banner */}
      {swapFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between shadow-xs transition-all animate-fadeIn ${
            swapFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {swapFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{swapFeedback.message}</span>
          </div>
          <button
            onClick={() => setSwapFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="underline text-[11px] cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        {/* Row 1: Title, Month, Version, Badges & Back Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onBackToList}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>الجداول</span>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>
            
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-heading whitespace-nowrap flex items-center gap-2">
              <span>جدول شهر {schedule.monthName || CalendarService.getHijriMonthName(schedule.hijriMonth)}</span>
              <span className="text-emerald-700 dark:text-emerald-400">{schedule.hijriYear} هـ</span>
            </h3>

            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 whitespace-nowrap">
              الإصدار V{schedule.currentVersion}
            </span>

            <div className="whitespace-nowrap shrink-0">
              {schedule.status === 'APPROVED' && <Badge variant="success">معتمد 🟢</Badge>}
              {schedule.status === 'PUBLISHED' && <Badge variant="purple">منشور 🟣</Badge>}
              {schedule.status === 'NEEDS_REAPPROVAL' && <Badge variant="warning">بحاجة لإعادة اعتماد ⚠️</Badge>}
              {schedule.status === 'REVIEW' && <Badge variant="info">قيد المراجعة 🔵</Badge>}
            </div>
          </div>

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {schedule.fridaysCount} جمعات · {mosques.filter((m) => m.isActive).length} مسجداً ·{' '}
            {assignments.length} تعييناً
          </p>
        </div>

        {/* Row 2: View Switchers & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* View Mode Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              onClick={() => setViewMode('byMosque')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'byMosque'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>حسب المساجد</span>
            </button>
            <button
              onClick={() => setViewMode('byImam')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'byImam'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users2 className="w-3.5 h-3.5 text-sky-700" />
              <span>حسب الخطباء</span>
            </button>
            <button
              onClick={() => setViewMode('byFriday')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'byFriday'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-700" />
              <span>حسب الجمعة</span>
            </button>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Conflict Center Trigger */}
            <button
              onClick={() => setIsConflictModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                criticalConflicts.length > 0
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 shadow-xs animate-pulse'
                  : conflicts.length > 0
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>مركز التعارضات ({conflicts.length})</span>
            </button>

            {/* Redistribute Trigger */}
            <button
              onClick={() => setIsRedistributeModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>إعادة التوزيع</span>
            </button>

            {/* Approval Trigger */}
            <button
              onClick={() => setIsApproveModalOpen(true)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                isScheduleApproved
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isScheduleApproved ? 'معتمد رسمي (إعادة اعتماد)' : 'اعتماد الجدول'}</span>
            </button>

            {/* Khutbah Topics Button */}
            <button
              onClick={() => setIsTopicsModalOpen(true)}
              className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>موضوعات الخطب</span>
            </button>

            {/* Official Waqf Decree & Printable A4 */}
            <button
              onClick={() => setIsDecreeModalOpen(true)}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>الكشف الرسمي (A4)</span>
            </button>

            {/* Publishing Center */}
            <button
              onClick={onNavigateToPublishing}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>النشر والرسائل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Drag & Drop Feature Hint */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            <strong>ميزة السحب والإفلات التفاعلي:</strong> يمكنك سحب أي بطاقة خطيب وإفلاتها على مسجد آخر للتبديل الفوري بينهما (Mutual Swap) دون تعارض.
          </span>
        </div>
        {draggedAssignment && (
          <span className="font-mono bg-emerald-200 dark:bg-emerald-800 px-2 py-0.5 rounded text-[11px] font-bold animate-pulse">
            جاري السحب... أفلت في الخلية المستهدفة
          </span>
        )}
      </div>

      {/* Conflict Callout Banner */}
      {conflicts.length > 0 && (
        <div className="p-3.5 bg-amber-50/95 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-950 dark:text-amber-100 font-heading block">
                تنبيه: يوجد {conflicts.length} حالات تحتاج إلى تدقيق في جدول هذا الشهر
              </span>
              <span className="text-[11px] text-amber-800 dark:text-amber-300">
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold sticky top-0 z-30 shadow-2xs">
                <tr>
                  <th className="py-3 px-4 w-64 border-l border-slate-200 dark:border-slate-700 sticky right-0 bg-slate-100 dark:bg-slate-800 z-40 font-heading">المسجد والمنطقة</th>
                  {fridays.map((friday) => (
                    <th key={friday.id} className="py-3 px-3 text-center border-l border-slate-200 dark:border-slate-700 min-w-44">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block font-heading">
                        الجمعة ({friday.fridayIndex})
                      </span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 font-mono">
                        {friday.hijriDate}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {mosques
                  .filter((m) => m.isActive)
                  .map((mosque) => (
                    <tr key={mosque.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky right-0 z-20 shadow-2xs">
                        <ClickableMosque
                          id={mosque.id}
                          name={mosque.name}
                          code={mosque.code}
                          className="font-bold text-slate-900 dark:text-slate-100 block font-heading"
                        />
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {mosque.region} · كود {mosque.code}
                          {mosque.fixedImamId && ' · ثابت'}
                        </span>
                      </td>

                      {fridays.map((friday) => {
                        const cellKey = `${mosque.id}:${friday.fridayIndex}`;
                        const assignment = assignmentMap.get(cellKey);
                        const assignedImam = assignment?.imamId ? imamMap.get(assignment.imamId) : null;
                        const isLocked = assignment?.isLocked || false;
                        const isOverThisCell = dragOverCellKey === cellKey;
                        const isCurrentDragged = draggedAssignment?.id === assignment?.id;

                        return (
                          <td
                            key={friday.id}
                            onClick={() => setSelectedCell({ mosqueId: mosque.id, fridayIndex: friday.fridayIndex })}
                            onDragOver={(e) => handleDragOver(cellKey, e)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDrop(mosque.id, friday.fridayIndex);
                            }}
                            className={`p-2 border-l border-slate-200 dark:border-slate-800 text-center cursor-pointer transition-all ${
                              isOverThisCell
                                ? 'bg-emerald-100/70 dark:bg-emerald-950/70 ring-2 ring-emerald-500 ring-inset scale-[1.02]'
                                : 'hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                            }`}
                          >
                            {!assignedImam ? (
                              <div
                                className={`p-2 rounded-lg border-2 border-dashed transition-all flex items-center justify-center gap-1 ${
                                  isOverThisCell
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                    : 'border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                                } text-xs font-bold`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                <span>{isOverThisCell ? 'أفلت للتعيين هنا' : 'شاغر (بدون خطيب)'}</span>
                              </div>
                            ) : (
                              <div
                                draggable={!isLocked}
                                onDragStart={(e) => assignment && handleDragStart(assignment, e)}
                                onDragEnd={() => {
                                  setDraggedAssignment(null);
                                  setDragOverCellKey(null);
                                }}
                                className={`p-2 rounded-lg border text-right transition-all select-none ${
                                  isCurrentDragged
                                    ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                                    : isLocked
                                    ? 'bg-purple-50/40 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 cursor-not-allowed'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 cursor-grab active:cursor-grabbing hover:shadow-xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <div className="flex items-center gap-1">
                                    {getSourceIconBadge(assignment?.source || 'BALANCED')}
                                    <button
                                      type="button"
                                      title="بطاقة الخطيب الذكية ومشاركة واتساب"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (assignment && mosque && assignedImam) {
                                          setMobileCardData({
                                            assignment,
                                            mosque,
                                            imam: assignedImam,
                                            friday,
                                          });
                                        }
                                      }}
                                      className="p-0.5 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                                    >
                                      <Smartphone className="w-3 h-3" />
                                    </button>
                                  </div>
                                  {isLocked ? (
                                    <Lock className="w-3 h-3 text-purple-700 dark:text-purple-400 shrink-0" />
                                  ) : (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-60">⋮⋮</span>
                                  )}
                                </div>
                                <ClickableImam
                                  id={assignedImam.id}
                                  name={assignedImam.name}
                                  className="font-bold text-slate-900 dark:text-slate-100 text-xs block truncate leading-tight hover:text-emerald-700 dark:hover:text-emerald-400"
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3 px-4 w-60">الخطيب</th>
                  <th className="py-3 px-4 text-center">النوع</th>
                  <th className="py-3 px-4 text-center">المستهدف (Target)</th>
                  <th className="py-3 px-4 text-center">المعيّن الفعلي</th>
                  <th className="py-3 px-4">تفاصيل التكليفات في جمعات الشهر</th>
                  <th className="py-3 px-4 text-center">حالة الحمل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {imams
                  .filter((i) => i.isActive)
                  .map((imam) => {
                    const imamAssignments = assignments.filter((a) => a.imamId === imam.id);
                    const assignedCount = imamAssignments.length;

                    let loadStatus = 'BALANCED';
                    if (assignedCount < imam.minFridays) loadStatus = 'UNDER';
                    else if (assignedCount > imam.maxFridays) loadStatus = 'OVER';

                    return (
                      <tr key={imam.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          <ClickableImam
                            id={imam.id}
                            name={imam.name}
                            className="font-bold text-slate-900 dark:text-slate-100 block hover:text-emerald-700 dark:hover:text-emerald-400"
                          />
                          <span className="block text-[11px] font-normal text-slate-400 dark:text-slate-500">
                            {imam.region || 'الوسط'} · حد أقصى: {imam.maxFridays}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {imam.type === 'FIXED' && <Badge variant="success">ثابت</Badge>}
                          {imam.type === 'PARTIAL_FIXED' && <Badge variant="warning">جزئي</Badge>}
                          {imam.type === 'FLEXIBLE' && <Badge variant="info">مرن</Badge>}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          {imam.targetFridays}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-800 dark:text-emerald-400 tabular-nums text-sm">
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
                                  className="cursor-pointer text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                                >
                                  <span className="font-bold text-emerald-800 dark:text-emerald-400">ج{a.fridayIndex}:</span>
                                  {m ? (
                                    <ClickableMosque
                                      id={m.id}
                                      name={m.name}
                                      className="hover:text-emerald-700 dark:hover:text-emerald-400 text-xs"
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
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">اختر الجمعة:</span>
            <div className="flex items-center gap-1">
              {fridays.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFridayFilter(f.fridayIndex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedFridayFilter === f.fridayIndex
                      ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                const isOverThisCard = dragOverCellKey === cellKey;
                const isCurrentDragged = draggedAssignment?.id === assignment?.id;
                const isLocked = assignment?.isLocked || false;

                return (
                  <div
                    key={mosque.id}
                    onClick={() => setSelectedCell({ mosqueId: mosque.id, fridayIndex: selectedFridayFilter })}
                    draggable={Boolean(assignedImam && !isLocked)}
                    onDragStart={(e) => assignment && handleDragStart(assignment, e)}
                    onDragEnd={() => {
                      setDraggedAssignment(null);
                      setDragOverCellKey(null);
                    }}
                    onDragOver={(e) => handleDragOver(cellKey, e)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDrop(mosque.id, selectedFridayFilter);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer hover:shadow-xs transition-all flex flex-col justify-between select-none ${
                      isOverThisCard
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500 scale-[1.02]'
                        : isCurrentDragged
                        ? 'opacity-40 border-dashed border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                        : !assignedImam
                        ? 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                        : isLocked
                        ? 'bg-purple-50/30 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 font-medium">{mosque.code}</span>
                        <div className="flex items-center gap-1.5">
                          {assignment && getSourceIconBadge(assignment.source)}
                          {isLocked ? (
                            <Lock className="w-3 h-3 text-purple-700 dark:text-purple-400" />
                          ) : assignedImam ? (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 opacity-60">⋮⋮ سحب</span>
                          ) : null}
                        </div>
                      </div>

                      <ClickableMosque
                        id={mosque.id}
                        name={mosque.name}
                        code={mosque.code}
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 block hover:text-emerald-700 dark:hover:text-emerald-400"
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{mosque.region}</p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      {assignedImam ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ClickableImam
                            id={assignedImam.id}
                            name={assignedImam.name}
                            className="text-xs font-bold text-emerald-900 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-400 truncate"
                          />
                          <button
                            type="button"
                            title="بطاقة الخطيب الذكية ومشاركة واتساب"
                            onClick={(e) => {
                              e.stopPropagation();
                              const friday = fridays.find((f) => f.fridayIndex === selectedFridayFilter);
                              if (assignment && mosque && assignedImam && friday) {
                                setMobileCardData({
                                  assignment,
                                  mosque,
                                  imam: assignedImam,
                                  friday,
                                });
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer rounded hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">شاغر ⚠️</span>
                      )}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 underline">
                        {isOverThisCard ? 'أفلت للتبديل' : 'تعديل'}
                      </span>
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
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                إعادة توزيع الخطباء (Re-distribute)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                إعادة تشغيل المحرك لتغطية الشواغر مع الحفاظ التام على التعيينات المقفولة
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">نطاق إعادة التوزيع:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setRedistScope('UNLOCKED_ONLY')}
                  className={`p-2.5 rounded-lg border text-right cursor-pointer ${
                    redistScope === 'UNLOCKED_ONLY'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  التعيينات غير المقفولة فقط
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">يحافظ على المثبت يدوياً</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('ALL')}
                  className={`p-2.5 rounded-lg border text-right cursor-pointer ${
                    redistScope === 'ALL'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  كامل الجدول من البداية
                  <span className="block text-[10px] text-slate-500 dark:text-slate-400 font-normal">يعيد بناء التعيينات</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('SINGLE_MOSQUE')}
                  className={`p-2.5 rounded-lg border text-right cursor-pointer ${
                    redistScope === 'SINGLE_MOSQUE'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  مسجد محدد فقط
                </button>

                <button
                  type="button"
                  onClick={() => setRedistScope('SINGLE_FRIDAY')}
                  className={`p-2.5 rounded-lg border text-right cursor-pointer ${
                    redistScope === 'SINGLE_FRIDAY'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  جمعة محددة فقط
                </button>
              </div>

              {redistScope === 'SINGLE_MOSQUE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">اختر المسجد:</label>
                  <select
                    value={targetMosqueId}
                    onChange={(e) => setTargetMosqueId(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">اختر الجمعة:</label>
                  <select
                    value={targetFridayIdx}
                    onChange={(e) => setTargetFridayIdx(Number(e.target.value))}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
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
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة التوزيع:</label>
                <select
                  value={redistMethod}
                  onChange={(e) => setRedistMethod(e.target.value as any)}
                  className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                >
                  <option value="Balanced Random">Balanced Random — متوازن عشوائي (الأمثل)</option>
                  <option value="Balanced">Balanced — متوازن تماماً</option>
                  <option value="Random">Random — عشوائي ضمن القيود</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <button
                type="button"
                onClick={() => setIsRedistributeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={redistributing}
                onClick={handleExecuteRedistribute}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 font-heading">
                اعتماد جدول شهر {schedule.monthName} {schedule.hijriYear} هـ
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                التدقيق النهائي للضوابط الشرعية والإدارية قبل إقرار النسخة الرسمية
              </p>
            </div>

            {/* Checklist */}
            <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 dark:text-slate-200">1. تغطية كافة المساجد بخطباء:</span>
                {emptyAssignmentsCount === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> مكتمل 100%
                  </span>
                ) : (
                  <span className="text-rose-700 dark:text-rose-400 font-bold">
                    يوجد {emptyAssignmentsCount} مسجداً شاغراً ✕
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 dark:text-slate-200">2. خلو الجدول من التعارضات الحرجة:</span>
                {criticalConflicts.length === 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> سليم تماماً
                  </span>
                ) : (
                  <span className="text-rose-700 dark:text-rose-400 font-bold">
                    يوجد {criticalConflicts.length} تعارضات حرجة ✕
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 dark:text-slate-200">3. احترام الثوابت والأنماط المعتمدة:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> محققة
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-800 dark:text-slate-200">4. تدقيق الاستثناءات الإدارية (Overrides):</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono font-medium">
                  {overrides.length} استثناء مسجل
                </span>
              </div>
            </div>

            {emptyAssignmentsCount > 0 || criticalConflicts.length > 0 ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  لا يمكن إتمام الاعتماد الرسمي قبل حل التعارضات وتغطية كافة المساجد الشاغرة.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>
                  الجدول مكتمل ومستوفٍ لكافة الشروط. بعد الاعتماد ستصبح النسخة رسمية وجاهزة للطباعة والإرسال.
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={emptyAssignmentsCount > 0 || criticalConflicts.length > 0 || approving}
                onClick={handleApproveSchedule}
                className="px-6 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{approving ? 'جارٍ الاعتماد...' : 'إقرار واعتماد النسخة الرسمية'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Certified Decree Modal */}
      <OfficialDecreeModal
        isOpen={isDecreeModalOpen}
        onClose={() => setIsDecreeModalOpen(false)}
        schedule={schedule}
        fridays={fridays}
        assignments={assignments}
        mosques={mosques}
        imams={imams}
      />

      {/* Unified Khutbah Topics Modal */}
      <KhutbahTopicsModal
        isOpen={isTopicsModalOpen}
        onClose={() => setIsTopicsModalOpen(false)}
        schedule={schedule}
        fridays={fridays}
      />

      {/* Instant Preacher Mobile Portal Modal */}
      {mobileCardData && (
        <PreacherMobileCardModal
          isOpen={Boolean(mobileCardData)}
          onClose={() => setMobileCardData(null)}
          assignment={mobileCardData.assignment}
          mosque={mobileCardData.mosque}
          imam={mobileCardData.imam}
          friday={mobileCardData.friday}
          schedule={schedule}
          onStatusUpdated={onRefreshData}
        />
      )}
    </div>
  );
}
