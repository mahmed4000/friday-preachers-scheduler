import { useMemo, useState } from 'react';
import { useStore } from '../../data/store.tsx';
import type { Month } from '../../data/types.ts';
import { Button, Choice, Field, Input, Modal, Select } from '../../ui/kit.tsx';
import { useConfirm } from '../../ui/confirm.tsx';
import { monthAssignments, sortMonths } from '../../data/selectors.ts';
import { addDays, fridayOrdinal, gregLong, gregShort, monthFridays, monthTitle, nextHijriMonth, todayIso, umalqura, umalquraMonth, HIJRI_MONTHS } from '../../lib/hijri.ts';

// ---------------------------------------------------------------------------
// شهر جديد / تعديل بداية الشهر (حسب إعلان دار الإفتاء)
// ---------------------------------------------------------------------------
function MonthDatesEditor({ start, days, onChange }: { start: string; days: 29 | 30; onChange: (start: string, days: 29 | 30) => void }) {
  const fridays = monthFridays(start, days);
  return (
    <div className="space-y-4">
      <Field label="أول يوم في الشهر (حسب إعلان دار الإفتاء)" hint="البرنامج بيحسبه مبدئيًا بتقويم أم القرى. لو الإعلان مختلف، زوّد أو نقّص يوم.">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange(addDays(start, -1), days)}>يوم قبل</Button>
          <div className="flex-1 text-center font-semibold text-brown-900 bg-white border border-sand-dark rounded-lg py-2 tabular">{gregLong(start)}</div>
          <Button variant="outline" size="sm" onClick={() => onChange(addDays(start, 1), days)}>يوم بعد</Button>
        </div>
      </Field>
      <Field label="عدد أيام الشهر">
        <Choice value={days} options={[{ value: 29, label: '29 يوم' }, { value: 30, label: '30 يوم' }]} onChange={(v) => onChange(start, v)} />
      </Field>
      <div className="rounded-lg bg-brown-100/70 border border-sand p-3">
        <div className="text-sm font-semibold text-brown-800 mb-2">جمعات الشهر ({fridays.length})</div>
        <ul className="grid sm:grid-cols-2 gap-1 text-sm">
          {fridays.map((f) => (
            <li key={f.index} className="flex justify-between gap-2">
              <span>{fridayOrdinal(f.index)}</span>
              <span className="text-muted tabular">{f.hijriDay} هـ · {gregShort(f.date)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function NewMonthModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Month) => void }) {
  const { data, actions } = useStore();
  const initial = useMemo(() => {
    const sorted = sortMonths(data.months);
    const last = sorted[sorted.length - 1];
    const h = umalqura(todayIso());
    const target = last ? nextHijriMonth(last.hijri_year, last.hijri_month) : { year: h.year, month: h.month };
    return target;
  }, [data.months]);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const calc = useMemo(() => umalquraMonth(year, month), [year, month]);
  const [dates, setDates] = useState<{ start: string; days: 29 | 30; key: string }>({ start: calc.start, days: calc.days, key: `${year}-${month}` });
  const cur = dates.key === `${year}-${month}` ? dates : { start: calc.start, days: calc.days, key: `${year}-${month}` };
  const exists = data.months.some((m) => m.hijri_year === year && m.hijri_month === month);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    const row = await actions.createMonth({ hijri_year: year, hijri_month: month, start_date: cur.start, days_count: cur.days });
    setSaving(false);
    if (row) onCreated(row);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="شهر جديد"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={create} disabled={exists || saving}>{saving ? 'جاري الإنشاء…' : 'إنشاء الشهر'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="الشهر">
            <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {HIJRI_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
            </Select>
          </Field>
          <Field label="السنة">
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || year)} className="tabular" />
          </Field>
        </div>
        {exists && <p className="text-sm text-bad">الشهر ده موجود بالفعل.</p>}
        <MonthDatesEditor start={cur.start} days={cur.days} onChange={(start, days) => setDates({ start, days, key: `${year}-${month}` })} />
      </div>
    </Modal>
  );
}

export function MonthSettingsModal({ month, onClose }: { month: Month; onClose: () => void }) {
  const { data, actions } = useStore();
  const confirm = useConfirm();
  const [start, setStart] = useState(month.start_date);
  const [days, setDays] = useState<29 | 30>(month.days_count);
  const newCount = monthFridays(start, days).length;
  const lost = monthAssignments(data, month.id).filter((a) => a.friday_index > newCount);

  const save = async () => {
    if (lost.length) {
      const ok = await confirm({ title: 'عدد الجمعات هيقل', body: `فيه ${lost.length} تكليف في الجمعة الخامسة هيتمسحوا. تكمل؟`, confirmText: 'كمّل', danger: true });
      if (!ok) return;
      await actions.deleteAssignments(lost.map((a) => a.id));
    }
    await actions.updateMonth(month.id, { start_date: start, days_count: days });
    onClose();
  };

  const remove = async () => {
    const ok = await confirm({ title: 'مسح الشهر', body: `هيتمسح جدول ${monthTitle(month.hijri_year, month.hijri_month)} كله بكل تكليفاته. متأكد؟`, confirmText: 'امسح الشهر', danger: true });
    if (ok) {
      await actions.deleteMonth(month.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`إعدادات ${monthTitle(month.hijri_year, month.hijri_month)}`}
      footer={
        <>
          <Button variant="danger" onClick={remove} className="ml-auto">مسح الشهر</Button>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save}>حفظ</Button>
        </>
      }
    >
      <MonthDatesEditor start={start} days={days} onChange={(s, d) => { setStart(s); setDays(d); }} />
    </Modal>
  );
}

