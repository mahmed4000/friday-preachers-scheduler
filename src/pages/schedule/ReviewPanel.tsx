// مراجعة الجدول قبل النشر: التعارضات، وعدم التوازن، والأماكن الفاضية، والاعتذارات.
// كله محسوب من القواعد الحالية (src/lib/engine.ts و src/data/alerts.ts) من غير قواعد جديدة.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Scale } from 'lucide-react';
import type { AppData, Month } from '../../data/types.ts';
import { conflicts } from '../../data/alerts.ts';
import { byId, fridaysOf, monthAssignments } from '../../data/selectors.ts';
import { neededFridays } from '../../lib/engine.ts';
import { fridayOrdinal } from '../../lib/hijri.ts';
import { clsx } from '../../ui/kit.tsx';

export function reviewItems(data: AppData, month: Month) {
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);
  const list = monthAssignments(data, month.id);
  const idx = fridaysOf(month).map((f) => f.index);
  const cf = conflicts(data, month).map((c) => ({
    key: `c${c.a.id}`,
    slot: { mosqueId: c.a.mosque_id, fridayIndex: c.a.friday_index },
    text: `${preachers.get(c.a.preacher_id!)?.name}: ${c.reason}`,
    where: `${mosques.get(c.a.mosque_id)?.name} · ${fridayOrdinal(c.a.friday_index)}`,
  }));
  const excused = list
    .filter((a) => a.status === 'excused')
    .map((a) => ({ key: `e${a.id}`, slot: { mosqueId: a.mosque_id, fridayIndex: a.friday_index }, text: `${preachers.get(a.preacher_id ?? 0)?.name ?? 'خطيب'} معتذر`, where: `${mosques.get(a.mosque_id)?.name} · ${fridayOrdinal(a.friday_index)}` }));
  const empty: { key: string; slot: { mosqueId: number; fridayIndex: number }; text: string; where: string }[] = [];
  for (const m of data.mosques.filter((x) => x.is_active)) {
    for (const f of neededFridays(m, idx)) {
      const a = list.find((x) => x.mosque_id === m.id && x.friday_index === f);
      if (!a?.preacher_id) empty.push({ key: `n${m.id}:${f}`, slot: { mosqueId: m.id, fridayIndex: f }, text: 'من غير خطيب', where: `${m.name} · ${fridayOrdinal(f)}` });
    }
  }
  // عدم التوازن: خطباء متاحين ما أخدوش جمعات، في وقت فيه خطباء أخدوا أكتر من جمعة
  const load = new Map<number, number>();
  for (const a of list) if (a.preacher_id && a.status !== 'excused') load.set(a.preacher_id, (load.get(a.preacher_id) ?? 0) + 1);
  const active = data.preachers.filter((p) => p.is_active && p.max_fridays > 0);
  const values = active.map((p) => load.get(p.id) ?? 0);
  const max = values.length ? Math.max(...values) : 0;
  const idle = list.some((a) => a.preacher_id) ? active.filter((p) => !load.get(p.id)) : [];
  const imbalance = max >= 2 && idle.length ? { idle: idle.map((p) => p.name), max } : null;
  return { cf, excused, empty, imbalance };
}

export function ReviewPanel({ data, month, onOpen }: { data: AppData; month: Month; onOpen: (slot: { mosqueId: number; fridayIndex: number }) => void }) {
  const { cf, excused, empty, imbalance } = reviewItems(data, month);
  const total = cf.length + excused.length + empty.length + (imbalance ? 1 : 0);
  const [open, setOpen] = useState(total > 0 && total <= 12);
  const hasAny = monthAssignments(data, month.id).some((a) => a.preacher_id);
  if (!hasAny) return null;

  if (total === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-ok/25 bg-ok-soft/60 px-4 py-3 mb-5 text-sm text-ok no-print">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        المراجعة: مفيش تعارضات، وكل الأماكن متغطية، والتوزيع متوازن.
      </div>
    );
  }

  const group = (title: string, tone: 'bad' | 'wait', items: typeof cf) =>
    items.length > 0 && (
      <div>
        <div className={clsx('text-[12.5px] font-semibold mb-1.5', tone === 'bad' ? 'text-bad' : 'text-wait')}>{title} ({items.length})</div>
        <ul className="flex flex-wrap gap-1.5">
          {items.slice(0, 30).map((i) => (
            <li key={i.key}>
              <button
                onClick={() => onOpen(i.slot)}
                className={clsx('text-right rounded-lg border px-2.5 py-1.5 text-[12.5px] cursor-pointer transition-colors', tone === 'bad' ? 'border-bad/25 bg-bad-soft/50 hover:bg-bad-soft' : 'border-wait/25 bg-wait-soft/50 hover:bg-wait-soft')}
              >
                <span className="font-medium text-ink">{i.where}</span>
                <span className="text-muted"> · {i.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className="rounded-[var(--radius-card)] border border-wait/30 bg-card mb-5 no-print shadow-[var(--shadow-card)]">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 h-12 text-right cursor-pointer" aria-expanded={open}>
        <AlertTriangle className="w-[18px] h-[18px] text-wait shrink-0" />
        <span className="flex-1 text-sm">
          <b className="text-ink">مراجعة قبل النشر:</b>
          <span className="text-muted">
            {' '}
            {[cf.length && `${cf.length} تعارض`, excused.length && `${excused.length} اعتذار`, empty.length && `${empty.length} مكان فاضي`, imbalance && 'عدم توازن'].filter(Boolean).join(' · ')}
          </span>
        </span>
        <ChevronDown className={clsx('w-4 h-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {group('تعارضات', 'bad', cf)}
          {group('اعتذارات محتاجة بديل', 'bad', excused)}
          {group('أماكن فاضية', 'wait', empty)}
          {imbalance && (
            <div className="flex items-start gap-2 text-[13px] text-wait">
              <Scale className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <b>عدم توازن:</b> فيه خطباء أخدوا {imbalance.max} جمعات، و{imbalance.idle.length} خطيب متاح ما أخدش ولا جمعة
                <span className="text-muted"> ({imbalance.idle.slice(0, 6).join('، ')}{imbalance.idle.length > 6 ? '…' : ''})</span>
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
