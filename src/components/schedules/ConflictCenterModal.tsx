import React, { useState, useMemo } from 'react';
import { Conflict, Mosque, Imam } from '../../types/index.ts';
import { Modal } from '../common/Modal.tsx';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ArrowLeft,
  Search,
  User,
  Building2,
  Sparkles,
  Phone,
  HelpCircle,
} from 'lucide-react';
import { useProfileNavigation } from '../../context/ProfileNavigationContext.tsx';

interface ConflictCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  mosques: Mosque[];
  imams: Imam[];
  onSelectAssignmentCell?: (mosqueId: number, fridayIndex: number) => void;
}

export function ConflictCenterModal({
  isOpen,
  onClose,
  conflicts,
  mosques,
  imams,
  onSelectAssignmentCell,
}: ConflictCenterModalProps) {
  const { openImamProfile, openMosqueProfile } = useProfileNavigation();
  const [activeTab, setActiveTab] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'INFO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const mosqueMap = useMemo(() => new Map(mosques.map((m) => [m.id, m])), [mosques]);
  const imamMap = useMemo(() => new Map(imams.map((i) => [i.id, i])), [imams]);

  const criticalConflicts = useMemo(() => conflicts.filter((c) => c.severity === 'CRITICAL'), [conflicts]);
  const warningConflicts = useMemo(() => conflicts.filter((c) => c.severity === 'WARNING'), [conflicts]);
  const infoConflicts = useMemo(() => conflicts.filter((c) => c.severity === 'INFO'), [conflicts]);

  // Filtered conflicts list
  const filteredConflicts = useMemo(() => {
    let list = conflicts;
    if (activeTab === 'CRITICAL') list = criticalConflicts;
    else if (activeTab === 'WARNING') list = warningConflicts;
    else if (activeTab === 'INFO') list = infoConflicts;

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) => {
      const msg = (c.message || c.description || '').toLowerCase();
      const code = (c.ruleCode || c.conflictType || '').toLowerCase();
      const imam = c.imamId ? imamMap.get(c.imamId) : null;
      const mosque = c.mosqueId ? mosqueMap.get(c.mosqueId) : null;
      const imamName = imam?.name?.toLowerCase() || '';
      const mosqueName = mosque?.name?.toLowerCase() || '';

      return (
        msg.includes(q) ||
        code.includes(q) ||
        imamName.includes(q) ||
        mosqueName.includes(q) ||
        (c.fridayIndex && `الجمعة ${c.fridayIndex}`.includes(q))
      );
    });
  }, [conflicts, activeTab, criticalConflicts, warningConflicts, infoConflicts, searchQuery, imamMap, mosqueMap]);

  // Check if there are quota / under minimum capacity warnings
  const hasUnderMinimumWarnings = useMemo(() => {
    return warningConflicts.some((c) => (c.ruleCode || c.conflictType) === 'UNDER_MINIMUM');
  }, [warningConflicts]);

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />;
      case 'INFO':
      default:
        return <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            تعارض حرج (CRITICAL) — يمنع الاعتماد
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            تحذير أحمال (WARNING) — إداري
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            ملاحظة (INFO)
          </span>
        );
    }
  };

  const getRuleTitleArabic = (code?: string) => {
    switch (code) {
      case 'UNDER_MINIMUM':
        return 'أقل من النصاب والحد الأدنى للجمعات';
      case 'OVER_MAXIMUM':
        return 'تجاوز الحد الأقصى للجمعات المسموح بها';
      case 'NOT_AVAILABLE':
        return 'الخطيب غير متاح أو معتذر في هذا التاريخ';
      case 'FORBIDDEN':
        return 'خطيب مستبعد أو محظور في هذا المسجد';
      case 'DOUBLE_BOOKING':
        return 'تعيين مزدوج لنفس الخطيب في جمعة واحدة';
      case 'CONSECUTIVE_LIMIT':
        return 'توالي الخطب أكثر من الحد المسموح';
      case 'CAPACITY_LIMIT':
        return 'تجاوز السعة الاستيعابية للمسجد';
      case 'UNASSIGNED_MOSQUE':
        return 'مسجد شاغر لم يُعين له خطيب';
      default:
        return code || 'تنبيه متعلق بضوابط التوزيع';
    }
  };

  const getSmartResolutions = (conflict: Conflict, imam?: Imam | null, mosque?: Mosque | null): string[] => {
    let existing: string[] = [];
    if (conflict.possibleResolutions) {
      if (Array.isArray(conflict.possibleResolutions)) {
        existing = conflict.possibleResolutions;
      } else if (typeof conflict.possibleResolutions === 'string') {
        try {
          const parsed = JSON.parse(conflict.possibleResolutions);
          if (Array.isArray(parsed)) existing = parsed;
          else if (typeof parsed === 'string') existing = [parsed];
        } catch {
          existing = [conflict.possibleResolutions];
        }
      }
    } else if ((conflict as any).details?.resolutions && Array.isArray((conflict as any).details.resolutions)) {
      existing = (conflict as any).details.resolutions;
    }

    if (existing.length > 0) return existing;

    const code = conflict.ruleCode || conflict.conflictType;
    switch (code) {
      case 'UNDER_MINIMUM':
        return [
          `تعديل الحد الأدنى للخطيب (${imam?.name || 'الخطيب'}) في ملفه ليتناسب مع وفرة الخطباء ومحدودية المساجد (مثلاً: تعيين الحد الأدنى إلى 1 أو 0 جمعة شهرياً).`,
          `التبديل اليدوي في خلايا الجدول لمنح هذا الخطيب جمعة إضافية من خطيب آخر حاصل على عدد أكبر من الجمعات.`,
          `اعتماد الجدول الحالي كما هو، مع منح الأولوية للخطيب (${imam?.name || 'الخطيب'}) في الشهر التالي تطبيقاً لقاعدة المداورة العادلة.`,
          `تسجيل استثناء إداري معتمد (تنبيهات الأحمال والحد الأدنى لا تمنع اعتماد الجدول الرسمي ونشره).`,
        ];
      case 'OVER_MAXIMUM':
        return [
          `نقل الجمعات الزائدة إلى أحد الخطباء الذين لم يستوفوا حدهم الأدنى.`,
          `رفع الحد الأقصى للخطيب في ملفه التعريفي إذا كان متطوعاً ومستعداً لتغطية مساجد إضافية.`,
          `تسجيل استثناء إداري معتمد لتجاوز الحد الأقصى.`,
        ];
      case 'NOT_AVAILABLE':
        return [
          `استبدال الخطيب بخطيب بديل متاح في هذه الجمعة من قائمة الخطباء الاحتياطيين.`,
          `تحديث جدول عدم التوفر للخطيب في حال زال سبب الاعتذار وأصبح متاحاً.`,
        ];
      case 'FORBIDDEN':
        return [
          `إلغاء تكليف هذا الخطيب في هذا المسجد وإسناد المسجد لخطيب مفضل أو مسموح به.`,
          `مراجعة وتعديل قاعدة الاستبعاد للمسجد في حال زالت أسباب الاستبعاد السابقة.`,
        ];
      case 'DOUBLE_BOOKING':
        return [
          `إلغاء أحد التكليفين المزدوجين فوراً وإسناد المسجد الشاغر لخطيب بديل مؤهل.`,
        ];
      case 'UNASSIGNED_MOSQUE':
        return [
          `إسناد المسجد الشاغر (${mosque?.name || 'المسجد'}) لأحد الخطباء المتاحين في الجمعة (${conflict.fridayIndex || 1}).`,
        ];
      default:
        return [
          'مراجعة التعيين في جدول الشهر وإجراء التعديل اليدوي المناسب.',
          'تسجيل استثناء إداري معتمد في سجل التدقيق.',
        ];
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مركز حل التعارضات والاستثناءات (Conflict Center)"
      subtitle="حصر دقيق للمشاكل التي واجهت الجدولة وتقديم المقترحات والحلول الممكنة"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Interactive Filter Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`p-3 rounded-xl border transition-all text-center cursor-pointer ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/20'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            <span className="block text-xl font-bold font-heading tabular-nums">
              {conflicts.length}
            </span>
            <span className="text-[11px] font-semibold block mt-0.5">جميع التنبيهات</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CRITICAL')}
            className={`p-3 rounded-xl border transition-all text-center cursor-pointer ${
              activeTab === 'CRITICAL'
                ? 'bg-rose-700 text-white border-rose-700 shadow-sm ring-2 ring-rose-700/20'
                : 'bg-rose-50 hover:bg-rose-100/80 text-rose-900 border-rose-200'
            }`}
          >
            <span className="block text-xl font-bold font-heading tabular-nums">
              {criticalConflicts.length}
            </span>
            <span className="text-[11px] font-semibold block mt-0.5">تعارضات حرجة (تمنع الاعتماد)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('WARNING')}
            className={`p-3 rounded-xl border transition-all text-center cursor-pointer ${
              activeTab === 'WARNING'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm ring-2 ring-amber-600/20'
                : 'bg-amber-50 hover:bg-amber-100/80 text-amber-900 border-amber-200'
            }`}
          >
            <span className="block text-xl font-bold font-heading tabular-nums">
              {warningConflicts.length}
            </span>
            <span className="text-[11px] font-semibold block mt-0.5">تحذيرات أحمال وحدود (إدارية)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INFO')}
            className={`p-3 rounded-xl border transition-all text-center cursor-pointer ${
              activeTab === 'INFO'
                ? 'bg-sky-700 text-white border-sky-700 shadow-sm ring-2 ring-sky-700/20'
                : 'bg-sky-50 hover:bg-sky-100/80 text-sky-900 border-sky-200'
            }`}
          >
            <span className="block text-xl font-bold font-heading tabular-nums">
              {infoConflicts.length}
            </span>
            <span className="text-[11px] font-semibold block mt-0.5">ملاحظات تفضيلات</span>
          </button>
        </div>

        {/* Administrative Guidance Banner for Capacity / Under Minimum */}
        {hasUnderMinimumWarnings && (
          <div className="p-3.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-xl space-y-1.5 text-xs text-amber-950 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>إيضاح إداري حول تحذيرات النصاب والحد الأدنى (الطاقة الاستيعابية للمساجد):</span>
            </div>
            <p className="leading-relaxed text-[11px] text-amber-900/90 font-medium pr-6">
              يضم النظام <strong>{imams.length} خطيباً</strong> بينما عدد المساجد المسجلة <strong>{mosques.length} مسجداً</strong> (ما يعادل {mosques.length * 4} خطبة شهرياً). لتوزيع الخطب بعدالة على جميع الخطباء، فإن النصيب الطبيعي هو (1 إلى 2 جمعة لكل خطيب). 
              التحذيرات الظاهرة تُنبه الإدارة إلى أن بعض الخطباء حُدد في بياناتهم حد أدنى (2 أو 4 جمعات) يفوق عدد المساجد المتاحة.
            </p>
            <div className="flex items-center gap-2 pr-6 pt-1 text-[11px] font-bold text-amber-800">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
              <span>📌 معلومة هامة: هذه التحذيرات هي إشعارات توضيحية، <strong>ولا تمنع اعتماد الجدول الرسمي ونشره نهائياً</strong>.</span>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {conflicts.length > 0 && (
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث باسم الخطيب، اسم المسجد، الجمعة، أو تفاصيل التنبيه..."
              className="w-full pl-3 pr-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all text-slate-800"
            />
          </div>
        )}

        {/* Content List */}
        {conflicts.length === 0 ? (
          <div className="p-10 text-center bg-emerald-50/50 rounded-xl border border-emerald-200 text-emerald-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <h4 className="text-base font-bold font-heading">الجدول خالٍ من أي تعارضات تماماً!</h4>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              جميع المساجد مغطاة بخطباء مؤهلين، وجميع القيود الصارمة محترمة بنسبة 100%.
            </p>
          </div>
        ) : filteredConflicts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold">
            لا توجد تعارضات أو تنبيهات مطابقة لبحثك في هذا القسم.
          </div>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredConflicts.map((conflict, idx) => {
              const ruleCode = conflict.ruleCode || conflict.conflictType || 'GENERAL_CONFLICT';
              const messageText = conflict.message || conflict.description || 'تنبيه متعلق بضوابط التوزيع';
              const mosque = conflict.mosqueId ? mosqueMap.get(conflict.mosqueId) : null;
              const imam = conflict.imamId ? imamMap.get(conflict.imamId) : null;
              const resolutions = getSmartResolutions(conflict, imam, mosque);

              return (
                <div
                  key={conflict.id || idx}
                  className={`p-4 rounded-xl border transition-all ${
                    conflict.severity === 'CRITICAL'
                      ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                      : conflict.severity === 'WARNING'
                      ? 'bg-amber-50/30 border-amber-200/90 shadow-2xs'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 w-full">
                      {getSeverityIcon(conflict.severity)}
                      <div className="space-y-2 w-full">
                        {/* Tags Header */}
                        <div className="flex flex-wrap items-center gap-2">
                          {getSeverityBadge(conflict.severity)}
                          <span className="text-xs font-bold text-slate-900 font-heading">
                            {getRuleTitleArabic(ruleCode)}
                          </span>
                          {conflict.fridayIndex && (
                            <span className="text-xs font-semibold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              الجمعة ({conflict.fridayIndex})
                            </span>
                          )}
                        </div>

                        {/* Entities Pills */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {imam && (
                            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-500 font-semibold">الخطيب:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  openImamProfile(imam.id);
                                  onClose();
                                }}
                                className="font-bold text-emerald-900 hover:text-emerald-700 underline underline-offset-2 cursor-pointer"
                                title="فتح ملف الخطيب"
                              >
                                {imam.name}
                              </button>
                              {imam.phone && (
                                <span className="text-[11px] font-mono text-slate-500 flex items-center gap-0.5 mr-1">
                                  <Phone className="w-2.5 h-2.5" />
                                  {imam.phone}
                                </span>
                              )}
                              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {imam.type === 'FIXED' ? 'راتب' : imam.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن'}
                              </span>
                            </div>
                          )}

                          {mosque && (
                            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                              <Building2 className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-slate-500 font-semibold">المسجد:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  openMosqueProfile(mosque.id);
                                  onClose();
                                }}
                                className="font-bold text-emerald-900 hover:text-emerald-700 underline underline-offset-2 cursor-pointer"
                                title="فتح ملف المسجد"
                              >
                                {mosque.name}
                              </button>
                              <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                                {mosque.code}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Description Box */}
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200/90 text-xs text-slate-900 leading-relaxed font-semibold">
                          {messageText}
                        </div>

                        {/* Proposed Resolutions */}
                        {resolutions.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                            <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              <span>الحلول والمقترحات الممكنة للإدارة:</span>
                            </span>
                            <div className="space-y-1 bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/50">
                              {resolutions.map((resText, rIdx) => (
                                <div key={rIdx} className="text-xs text-slate-700 flex items-start gap-2">
                                  <span className="text-emerald-800 font-bold shrink-0 mt-0.5">({rIdx + 1})</span>
                                  <span className="leading-relaxed font-medium">{resText}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex sm:flex-col items-center gap-1.5 shrink-0 self-end sm:self-start mt-2 sm:mt-0">
                      {conflict.mosqueId && conflict.fridayIndex && onSelectAssignmentCell && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectAssignmentCell(conflict.mosqueId!, conflict.fridayIndex!);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>فتح التعيين</span>
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {conflict.imamId && (
                        <button
                          type="button"
                          onClick={() => {
                            openImamProfile(conflict.imamId!);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>ملف الخطيب</span>
                        </button>
                      )}

                      {conflict.mosqueId && !conflict.fridayIndex && (
                        <button
                          type="button"
                          onClick={() => {
                            openMosqueProfile(conflict.mosqueId!);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <span>ملف المسجد</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            عدد النتائج المعروضة: {filteredConflicts.length} من أصل {conflicts.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
