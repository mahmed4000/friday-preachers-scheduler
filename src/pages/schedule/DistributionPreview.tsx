// اقتراح التوزيع التلقائي: بيتحسب الأول ويتعرض للمراجعة، وما بيتحفظش غير لما المسؤول يعتمده.
// قواعد التوزيع نفسها في src/lib/engine.ts ومش بتتغير هنا.
import { ArrowLeft, CheckCircle2, Wand2 } from 'lucide-react';
import type { AppData, Assignment, Month } from '../../data/types.ts';
import type { AssignmentRow } from '../../data/repo.ts';
import { Button, Modal, Tag, clsx } from '../../ui/kit.tsx';
import { byId, engineInput, monthAssignments } from '../../data/selectors.ts';
import { generate } from '../../lib/engine.ts';
import { fridayOrdinal } from '../../lib/hijri.ts';

export interface DistributionPlan {
  mode: 'fill' | 'full';
  rows: AssignmentRow[];
  stale: Assignment[];
  unfilled: number;
  changes: { mosqueId: number; fridayIndex: number; from: number | null; to: number | null; wasConfirmed: boolean }[];
}

export function planDistribution(data: AppData, month: Month, mode: 'fill' | 'full'): DistributionPlan {
  const input = engineInput(data, month);
  const assignments = monthAssignments(data, month.id);
  const cell = (mosqueId: number, fi: number) => assignments.find((a) => a.mosque_id === mosqueId && a.friday_index === fi);
  if (mode === 'fill') {
    input.existing = input.existing.map((a) => (a.preacher_id && a.status !== 'excused' ? { ...a, locked: true } : a));
  }
  const result = generate({ ...input, seed: Date.now() % 100000 });
  const changes: DistributionPlan['changes'] = [];
  const rows = result.assignments
    .filter((p) => !p.kept)
    .map((p) => {
      const old = cell(p.mosqueId, p.fridayIndex);
      const same = old && old.preacher_id === p.preacherId && old.status !== 'excused';
      if (!same) changes.push({ mosqueId: p.mosqueId, fridayIndex: p.fridayIndex, from: old?.status === 'excused' ? null : old?.preacher_id ?? null, to: p.preacherId, wasConfirmed: old?.status === 'confirmed' });
      return {
        month_id: month.id,
        mosque_id: p.mosqueId,
        friday_index: p.fridayIndex,
        preacher_id: p.preacherId,
        source: p.source,
        locked: false,
        status: same ? old!.status : ('pending' as const),
        excuse_reason: '',
        status_at: same ? old!.status_at : null,
        notified_at: same ? old!.notified_at : null,
        reminded_at: same ? old!.reminded_at : null,
      };
    });
  // تكليفات لمساجد أو جمعات مبقتش مطلوبة
  const neededKeys = new Set(result.assignments.map((a) => `${a.mosqueId}:${a.fridayIndex}`));
  const stale = assignments.filter((a) => !neededKeys.has(`${a.mosque_id}:${a.friday_index}`) && !a.locked && a.source !== 'manual');
  return { mode, rows, stale, unfilled: result.unfilled.length, changes };
}

export function DistributionPreview({ data, plan, busy, onApply, onRetry, onClose }: { data: AppData; plan: DistributionPlan; busy: boolean; onApply: () => void; onRetry: () => void; onClose: () => void }) {
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);
  const name = (id: number | null) => (id ? preachers.get(id)?.name ?? '—' : null);
  const confirmedLost = plan.changes.filter((c) => c.wasConfirmed).length;
  const added = plan.changes.filter((c) => !c.from && c.to).length;
  const replaced = plan.changes.filter((c) => c.from && c.to).length;

  // توازن الاقتراح: عدد جمعات كل خطيب بعد التطبيق
  const load = new Map<number, number>();
  const kept = monthAssignmentsAfter(data, plan);
  for (const a of kept) if (a.preacher_id) load.set(a.preacher_id, (load.get(a.preacher_id) ?? 0) + 1);
  const activeAvail = data.preachers.filter((p) => p.is_active && p.max_fridays > 0);
  const idle = activeAvail.filter((p) => !load.get(p.id)).length;
  const maxLoad = Math.max(0, ...activeAvail.map((p) => load.get(p.id) ?? 0));

  return (
    <Modal
      open
      onClose={onClose}
      title={plan.mode === 'fill' ? 'اقتراح ملء الأماكن الفاضية' : 'اقتراح التوزيع'}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onRetry} disabled={busy} className="ml-auto"><Wand2 className="w-4 h-4" />اقتراح تاني</Button>
          <Button variant="outline" onClick={onClose} disabled={busy}>إلغاء</Button>
          <Button onClick={onApply} loading={busy} disabled={!plan.changes.length && !plan.stale.length}><CheckCircle2 className="w-4 h-4" />اعتمد الاقتراح</Button>
        </>
      }
    >
      <p className="text-sm text-muted mb-4">ده اقتراح بس، ومش هيتحفظ غير لما تدوس "اعتمد". التكليفات اليدوية والمثبتة والخطيب الثابت مش بتتغير.</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {[
          { l: 'تكليف جديد', v: added, c: 'text-ok' },
          { l: 'تغيير خطيب', v: replaced, c: replaced ? 'text-wait' : 'text-muted' },
          { l: 'هيفضل فاضي', v: plan.unfilled, c: plan.unfilled ? 'text-bad' : 'text-muted' },
          { l: 'خطباء من غير جمعة', v: idle, c: idle ? 'text-wait' : 'text-muted' },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-border bg-paper p-3 text-center">
            <div className={clsx('font-num text-2xl font-bold tabular', x.c)}>{x.v}</div>
            <div className="text-[12px] text-muted">{x.l}</div>
          </div>
        ))}
      </div>
      {confirmedLost > 0 && <p className="text-sm text-bad bg-bad-soft rounded-lg p-3 mb-3">تنبيه: {confirmedLost} تكليف مؤكد من الخطباء هيتغير. الأفضل تستخدم "املا الفاضي" بدل التوزيع الكامل.</p>}
      {idle > 0 && maxLoad >= 2 && <p className="text-sm text-wait bg-wait-soft rounded-lg p-3 mb-3">عدم توازن: {idle} خطيب متاح ما أخدش جمعة، وفيه خطباء أخدوا {maxLoad}. غالبًا بسبب القواعد (الحد الأقصى، الجمعات المتاحة، الخبرة وحجم المسجد). ممكن تدوس "اقتراح تاني" أو تعدّل يدوي.</p>}
      {plan.changes.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">مفيش تغييرات: الجدول الحالي هو نفس الاقتراح.</p>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="max-h-[42vh] overflow-y-auto scroll-soft">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-brown-50">
                <tr className="text-right text-[12px] text-muted border-b border-border">
                  <th className="px-3 h-10 font-semibold">المسجد</th>
                  <th className="px-3 h-10 font-semibold">الجمعة</th>
                  <th className="px-3 h-10 font-semibold">التغيير</th>
                </tr>
              </thead>
              <tbody>
                {plan.changes
                  .sort((a, b) => a.fridayIndex - b.fridayIndex || (mosques.get(a.mosqueId)?.name ?? '').localeCompare(mosques.get(b.mosqueId)?.name ?? '', 'ar'))
                  .map((c) => (
                    <tr key={`${c.mosqueId}:${c.fridayIndex}`} className="border-t border-border first:border-t-0">
                      <td className="px-3 py-2 font-medium">{mosques.get(c.mosqueId)?.name}</td>
                      <td className="px-3 py-2 text-muted whitespace-nowrap">{fridayOrdinal(c.fridayIndex).replace('الجمعة ', '')}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {c.from && <del className="text-muted">{name(c.from)}</del>}
                          {c.from && <ArrowLeft className="w-3.5 h-3.5 text-muted" />}
                          {c.to ? <span className="text-ink font-medium">{name(c.to)}</span> : <Tag tone="bad">فاضي</Tag>}
                          {c.wasConfirmed && <Tag tone="bad">كان مؤكد</Tag>}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** التكليفات بعد تطبيق الاقتراح (للحساب بس) */
function monthAssignmentsAfter(data: AppData, plan: DistributionPlan): { preacher_id: number | null }[] {
  const monthId = plan.rows[0]?.month_id;
  if (!monthId) return [];
  const byKey = new Map(plan.rows.map((r) => [`${r.mosque_id}:${r.friday_index}`, r]));
  const staleIds = new Set(plan.stale.map((s) => s.id));
  const out: { preacher_id: number | null }[] = [];
  for (const a of monthAssignments(data, monthId)) {
    if (staleIds.has(a.id) || byKey.has(`${a.mosque_id}:${a.friday_index}`)) continue;
    if (a.status !== 'excused') out.push(a);
  }
  for (const r of plan.rows) out.push(r);
  return out;
}
