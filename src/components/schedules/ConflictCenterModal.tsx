import React from 'react';
import { Conflict, Mosque, Imam } from '../../types/index.ts';
import { Modal } from '../common/Modal.tsx';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, ArrowLeft } from 'lucide-react';

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
  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));

  const criticalConflicts = conflicts.filter((c) => c.severity === 'CRITICAL');
  const warningConflicts = conflicts.filter((c) => c.severity === 'WARNING');
  const infoConflicts = conflicts.filter((c) => c.severity === 'INFO');

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
      case 'INFO':
      default:
        return <Info className="w-5 h-5 text-sky-600 shrink-0" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            حرِج (CRITICAL)
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            تحذير (WARNING)
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            معلومة (INFO)
          </span>
        );
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
      <div className="space-y-5">
        {/* Conflict Summary Counters */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="block text-xl font-bold text-rose-800 tabular-nums">
              {criticalConflicts.length}
            </span>
            <span className="text-[11px] text-rose-700 font-semibold">تعارضات حرجة (تمنع الاعتماد)</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="block text-xl font-bold text-amber-800 tabular-nums">
              {warningConflicts.length}
            </span>
            <span className="text-[11px] text-amber-700 font-semibold">تحذيرات أحمال وحدود</span>
          </div>

          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
            <span className="block text-xl font-bold text-sky-800 tabular-nums">
              {infoConflicts.length}
            </span>
            <span className="text-[11px] text-sky-700 font-semibold">ملاحظات تفضيلات</span>
          </div>
        </div>

        {/* Empty State */}
        {conflicts.length === 0 ? (
          <div className="p-10 text-center bg-emerald-50/50 rounded-xl border border-emerald-200 text-emerald-800 space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
            <h4 className="text-base font-bold font-heading">الجدول خالٍ من أي تعارضات تماماً!</h4>
            <p className="text-xs text-emerald-700 max-w-md mx-auto">
              جميع المساجد مغطاة بخطباء مؤهلين، وجميع القيود الصارمة محترمة بنسبة 100%.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
            {conflicts.map((conflict) => {
              const mosque = conflict.mosqueId ? mosqueMap.get(conflict.mosqueId) : null;
              const imam = conflict.imamId ? imamMap.get(conflict.imamId) : null;
              let resolutions: string[] = [];
              if (conflict.possibleResolutions) {
                try {
                  resolutions = JSON.parse(conflict.possibleResolutions);
                } catch {}
              }

              return (
                <div
                  key={conflict.id}
                  className={`p-4 rounded-xl border transition-all ${
                    conflict.severity === 'CRITICAL'
                      ? 'bg-rose-50/40 border-rose-200'
                      : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(conflict.severity)}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(conflict.severity)}
                          <span className="text-xs font-bold text-slate-900 font-heading">
                            {conflict.ruleCode}
                          </span>
                          {conflict.fridayIndex && (
                            <span className="text-xs text-slate-500">· الجمعة ({conflict.fridayIndex})</span>
                          )}
                          {mosque && (
                            <span className="text-xs font-semibold text-slate-800">· {mosque.name}</span>
                          )}
                        </div>

                        <p className="text-xs text-slate-800 leading-relaxed font-medium">
                          {conflict.message}
                        </p>

                        {/* Proposed Resolutions */}
                        {resolutions.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-200/60">
                            <span className="text-[11px] font-bold text-slate-700 block mb-1">
                              الحلول والمقترحات الممكنة:
                            </span>
                            <div className="space-y-1">
                              {resolutions.map((resText, rIdx) => (
                                <div key={rIdx} className="text-xs text-slate-600 flex items-center gap-1.5">
                                  <span className="text-emerald-700 font-bold">•</span>
                                  <span>{resText}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {conflict.mosqueId && conflict.fridayIndex && onSelectAssignmentCell && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectAssignmentCell(conflict.mosqueId!, conflict.fridayIndex!);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <span>فتح التعيين</span>
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
