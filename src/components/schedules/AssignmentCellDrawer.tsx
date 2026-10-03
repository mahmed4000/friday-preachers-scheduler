import React, { useState, useMemo } from 'react';
import { Assignment, Mosque, Imam, Friday, Conflict } from '../../types/index.ts';
import {
  X,
  Lock,
  Unlock,
  Star,
  ShieldAlert,
  Calendar,
  AlertTriangle,
  Save,
  CheckCircle2,
  FileCheck2,
  Zap,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { Badge } from '../common/Badge.tsx';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { SchedulingEngine } from '../../services/schedulingEngine.ts';

interface AssignmentCellDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment | null;
  mosque: Mosque | null;
  friday: Friday | null;
  imams: Imam[];
  allAssignments: Assignment[];
  conflicts: Conflict[];
  onSaveChange: (newImamId: number | null, reason: string, isOverride: boolean) => Promise<void>;
  onToggleLock: (assignmentId: number) => Promise<void>;
}

export function AssignmentCellDrawer({
  isOpen,
  onClose,
  assignment,
  mosque,
  friday,
  imams,
  allAssignments,
  conflicts,
  onSaveChange,
  onToggleLock,
}: AssignmentCellDrawerProps) {
  if (!isOpen || !assignment || !mosque || !friday) return null;

  const [selectedImamId, setSelectedImamId] = useState<number | null>(assignment.imamId);
  const [overrideReason, setOverrideReason] = useState<string>('');
  const [isOverrideMode, setIsOverrideMode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'emergency'>('all');

  const emergencyReplacements = useMemo(() => {
    return SchedulingEngine.findEmergencyReplacements({
      fridayIndex: assignment.fridayIndex,
      mosqueId: mosque.id,
      currentImamId: assignment.imamId,
      allMosques: [
        {
          id: mosque.id,
          name: mosque.name,
          code: mosque.code,
          region: mosque.region,
          isActive: mosque.isActive,
          fixedImamId: mosque.fixedImamId,
        },
      ],
      allImams: imams.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type as any,
        minFridays: i.minFridays,
        targetFridays: i.targetFridays,
        maxFridays: i.maxFridays,
        isActive: i.isActive,
        region: i.region,
      })),
      rules: (mosque.rules || []).map((r) => ({
        mosqueId: mosque.id,
        imamId: r.imamId,
        relationshipType: r.relationshipType as any,
        priority: r.priority || 1,
      })),
      existingAssignments: allAssignments.map((a) => ({
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
      })),
      unavailabilities: imams.flatMap((i) =>
        (i.availabilities || []).map((av) => ({
          imamId: i.id,
          fridayIndex: av.fridayIndex,
          isAvailable: av.isAvailable,
        }))
      ),
    });
  }, [assignment, mosque, imams, allAssignments]);

  const currentImam = imams.find((i) => i.id === assignment.imamId);

  // Analyze candidates for this Friday & Mosque
  // Other bookings on this Friday
  const bookedOnThisFriday = new Map<number, number>();
  for (const a of allAssignments) {
    if (a.fridayIndex === assignment.fridayIndex && a.id !== assignment.id && a.imamId) {
      bookedOnThisFriday.set(a.imamId, a.mosqueId);
    }
  }

  // Count current assignments in month for each imam
  const imamUsageCounts: Record<number, number> = {};
  for (const a of allAssignments) {
    if (a.imamId) {
      imamUsageCounts[a.imamId] = (imamUsageCounts[a.imamId] || 0) + 1;
    }
  }

  // Mosque rules
  const mosqueRules = mosque.rules || [];

  interface CandidateInfo {
    imam: Imam;
    status: 'OPTIMAL' | 'ALLOWED' | 'DISCOURAGED' | 'BLOCKED';
    reason: string;
    isPreferred: boolean;
    preferencePriority?: number;
    isForbidden: boolean;
    isUnavailable: boolean;
    isDoubleBooked: boolean;
    isOverMax: boolean;
    assignedCount: number;
  }

  const evaluatedCandidates: CandidateInfo[] = imams.map((imam) => {
    const isBooked = bookedOnThisFriday.has(imam.id);
    const rule = mosqueRules.find((r) => r.imamId === imam.id);
    const isForbidden = rule?.relationshipType === 'FORBIDDEN';
    const isDiscouraged = rule?.relationshipType === 'DISCOURAGED';
    const isPreferred = rule?.relationshipType === 'PREFERRED';
    const priority = rule?.priority;

    // Availability check
    const isUnavailable = (imam.availabilities || []).some(
      (av) => av.fridayIndex === assignment.fridayIndex && !av.isAvailable
    );

    const count = imamUsageCounts[imam.id] || 0;
    const isOverMax = count >= imam.maxFridays && imam.id !== assignment.imamId;

    let status: CandidateInfo['status'] = 'ALLOWED';
    let reason = 'متاح وضمن الحدود';

    if (isForbidden) {
      status = 'BLOCKED';
      reason = 'ممنوع بقرار إدارة المسجد (FORBIDDEN)';
    } else if (isUnavailable) {
      status = 'BLOCKED';
      reason = `معتذر وغير متاح في الجمعة (${assignment.fridayIndex})`;
    } else if (isBooked) {
      status = 'BLOCKED';
      reason = `مرتبط بمسجد آخر في نفس الجمعة (${assignment.fridayIndex})`;
    } else if (isOverMax) {
      status = 'BLOCKED';
      reason = `تجاوز الحد الأقصى المسموح (${imam.maxFridays} جمعات)`;
    } else if (isPreferred) {
      status = 'OPTIMAL';
      reason = `مفضل لدى المسجد (أولوية رقم ${priority || 1})`;
    } else if (isDiscouraged) {
      status = 'DISCOURAGED';
      reason = 'غير مفضل لدى المسجد (DISCOURAGED)';
    }

    return {
      imam,
      status,
      reason,
      isPreferred,
      preferencePriority: priority,
      isForbidden,
      isUnavailable,
      isDoubleBooked: isBooked,
      isOverMax,
      assignedCount: count,
    };
  });

  // Sort candidates: OPTIMAL first, then ALLOWED, then DISCOURAGED, then BLOCKED
  evaluatedCandidates.sort((a, b) => {
    const order = { OPTIMAL: 1, ALLOWED: 2, DISCOURAGED: 3, BLOCKED: 4 };
    if (order[a.status] !== order[b.status]) {
      return order[a.status] - order[b.status];
    }
    if (a.isPreferred && b.isPreferred) {
      return (a.preferencePriority || 99) - (b.preferencePriority || 99);
    }
    return a.imam.name.localeCompare(b.imam.name);
  });

  const isFridayPast = (friday as any).isPast || (friday as any).periodStatus === 'PAST';

  const handleApplyChange = async () => {
    if (isFridayPast) {
      setDrawerError('هذه الجمعة انتهت بالفعل ولا يمكن تعديل التعيين من خلال الجدولة الحالية. يمكنك الاطلاع عليها من سجل الجداول والتاريخ.');
      return;
    }

    setSaving(true);
    setDrawerError(null);
    try {
      await onSaveChange(
        selectedImamId,
        overrideReason || (isOverrideMode ? 'استثناء إداري معتمد' : 'تعديل يدوي'),
        isOverrideMode
      );
      onClose();
    } catch (err: any) {
      setDrawerError(err.message || 'تعذر حفظ التعديل');
    } finally {
      setSaving(false);
    }
  };

  const getSourceLabel = (src: string) => {
    switch (src) {
      case 'FIXED':
        return 'ثابت بموجب نمط';
      case 'PREFERENCE':
        return 'تفضيل مسجد';
      case 'BALANCED':
      case 'BALANCED_RANDOM':
        return 'توزيع متوازن';
      case 'MANUAL':
        return 'تعديل يدوي';
      case 'OVERRIDE':
        return 'استثناء إداري';
      default:
        return src;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-r border-slate-200 animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClickableMosque
                id={mosque.id}
                name={mosque.name}
                code={mosque.code}
                showCode
                className="text-xs font-bold text-slate-900 font-heading hover:text-emerald-800"
              />
            </div>
            <p className="text-xs text-emerald-800 font-medium mt-0.5">
              الجمعة ({assignment.fridayIndex}) — {friday.hijriDate} ({friday.gregorianDate})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-5">
          {isFridayPast && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>جمعة منتهية (مقفلة ومحمية من التعديل)</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed pr-6">
                هذه الجمعة انتهت بالفعل ولا يمكن تعديل التعيين من خلال الجدولة الحالية. يمكنك الاطلاع عليها من سجل الجداول والتاريخ.
              </p>
            </div>
          )}

          {drawerError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
              <span className="font-bold">تنبيه: </span>
              <span>{drawerError}</span>
            </div>
          )}

          {/* Current Assignment Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">الخطيب الحالي المعين:</span>
              <div className="flex items-center gap-2">
                <Badge variant={assignment.isLocked ? 'purple' : 'default'}>
                  {assignment.isLocked ? (
                    <span className="flex items-center gap-1 font-semibold">
                      <Lock className="w-3 h-3 text-purple-700" /> مقفول
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Unlock className="w-3 h-3 text-slate-500" /> غير مقفول
                    </span>
                  )}
                </Badge>
                <button
                  type="button"
                  onClick={() => onToggleLock(assignment.id)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                >
                  {assignment.isLocked ? 'فك القفل' : 'قفل التعيين'}
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              {currentImam ? (
                <ClickableImam
                  id={currentImam.id}
                  name={currentImam.name}
                  className="text-base font-bold text-slate-900 font-heading hover:text-emerald-800"
                />
              ) : (
                <span className="text-base font-bold text-rose-700 font-heading">
                  شاغر (بدون خطيب)
                </span>
              )}
              <span className="text-xs text-slate-500 font-mono">
                المصدر: {getSourceLabel(assignment.source)}
              </span>
            </div>

            {/* Quick Metrics Grid */}
            {currentImam && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">جمعات الشهر الحالي:</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {imamUsageCounts[currentImam.id] || 0} جمعات
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">المستهدف:</span>
                  <span className="font-bold text-emerald-900 tabular-nums">
                    {currentImam.targetFridays}
                  </span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 block">الحد الأقصى:</span>
                  <span className="font-bold text-amber-900 tabular-nums">
                    {currentImam.maxFridays}
                  </span>
                </div>
              </div>
            )}

            {assignment.notes && (
              <p className="text-xs text-slate-500 italic pt-1">{assignment.notes}</p>
            )}
          </div>

          {/* Qualified Candidates List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  جميع الخطباء ({evaluatedCandidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('emergency')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'emergency'
                      ? 'bg-amber-600 text-white shadow-2xs ring-2 ring-amber-300'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>خطباء الطوارئ والاحتياط</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 font-mono">
                    {emergencyReplacements.length}
                  </span>
                </button>
              </div>
            </div>

            {activeTab === 'emergency' ? (
              <div className="space-y-2 max-h-72 overflow-y-auto border border-amber-200 rounded-xl p-2.5 bg-amber-50/20">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    تم حصر الخطباء غير المكلفين في الجمعة ({assignment.fridayIndex}) وترتيبهم آلياً وفق معايير الجاهزية، التقارب الجغرافي، والتوافق الإداري لمعالجة أي اعتذار طارئ فوراً.
                  </p>
                </div>

                {emergencyReplacements.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    لا يتوفر حالياً خطباء طوارئ متاحون في هذه الجمعة بدون تعارض.
                  </div>
                ) : (
                  emergencyReplacements.map((cand) => {
                    const isSelected = selectedImamId === cand.imam.id;
                    return (
                      <div
                        key={cand.imam.id}
                        onClick={() => {
                          setSelectedImamId(cand.imam.id);
                          setOverrideReason(`استبدال طارئ معتمد: ${cand.reason}`);
                        }}
                        className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-500 shadow-2xs ring-1 ring-amber-400'
                            : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center">
                              {isSelected && <span className="w-2 h-2 rounded-full bg-amber-600" />}
                            </span>
                            <span className="font-bold text-xs text-slate-900 font-heading">
                              {cand.imam.name}
                            </span>
                            {cand.isNearby && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 border border-sky-200">
                                <MapPin className="w-2.5 h-2.5" /> نفس المنطقة
                              </span>
                            )}
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cand.compatibilityScore >= 75
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            ⭐ {cand.compatibilityScore}% ملاءمة
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 pr-5 flex items-center gap-1">
                          <span>{cand.reason}</span>
                        </p>
                        <div className="text-[10px] text-slate-400 pr-5 flex items-center gap-3">
                          <span>جمعات الشهر: {cand.currentMonthLoad} من {cand.maxFridays}</span>
                          <span>المستهدف: {cand.targetFridays}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/30">
              {/* Option for Unassigned */}
              <label
                onClick={() => setSelectedImamId(null)}
                className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                  selectedImamId === null
                    ? 'bg-rose-50 border-rose-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center">
                    {selectedImamId === null && <span className="w-2 h-2 rounded-full bg-rose-600" />}
                  </span>
                  <div>
                    <span className="text-xs font-bold text-rose-800">شاغر (ترك المسجد بدون خطيب)</span>
                    <span className="block text-[10px] text-slate-400">سيولد تعارضاً حرجاً للتنبيه</span>
                  </div>
                </div>
              </label>

              {evaluatedCandidates.map((cand) => {
                const isSelected = selectedImamId === cand.imam.id;
                const isBlocked = cand.status === 'BLOCKED';

                return (
                  <label
                    key={cand.imam.id}
                    onClick={() => {
                      if (!isBlocked || isOverrideMode) {
                        setSelectedImamId(cand.imam.id);
                      }
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-600 shadow-2xs'
                        : isBlocked && !isOverrideMode
                        ? 'bg-slate-100/60 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                        {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-600" />}
                      </span>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900">{cand.imam.name}</span>
                          {cand.status === 'OPTIMAL' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              ⭐ مفضل #{cand.preferencePriority}
                            </span>
                          )}
                          {cand.status === 'DISCOURAGED' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                              غير مفضل
                            </span>
                          )}
                        </div>

                        <span
                          className={`block text-[11px] mt-0.5 ${
                            isBlocked ? 'text-rose-600 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {cand.reason} · ({cand.assignedCount}/{cand.imam.maxFridays} جمعات)
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Override Checkbox */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isOverrideMode}
                onChange={(e) => setIsOverrideMode(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <span className="text-xs font-bold text-amber-900">
                تسجيل استثناء إداري معتمد (Administrative Override)
              </span>
            </label>
            {isOverrideMode && (
              <div className="pt-2 space-y-1">
                <label className="block text-[11px] font-medium text-amber-800">
                  سبب الاستثناء (سيسجل في الأرشيف الرقابي):
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="مثال: تغطية عجز طارئ بموافقة الشؤون الدينية"
                  className="w-full text-xs p-2 bg-white border border-amber-300 rounded-lg focus:outline-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            إلغاء
          </button>

          <button
            type="button"
            disabled={saving || isFridayPast}
            onClick={handleApplyChange}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'جارٍ الحفظ...' : isFridayPast ? 'جمعة منتهية (للقراءة فقط)' : 'تثبيت التعيين'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
