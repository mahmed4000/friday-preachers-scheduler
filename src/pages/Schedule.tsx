import { useMemo, useState } from 'react';
import { CalendarPlus, CircleSlash, Lock, Printer, Send, Settings2, Sparkles, UserX, Wand2 } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Assignment, Month } from '../data/types.ts';
import { Button, Card, Choice, Empty, Field, Input, Modal, PageTitle, Select, StatusPill, Tag, clsx, normalizeAr } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { byId, currentMonth, engineInput, fridaysOf, monthAssignments, sortMonths, unavailableSet } from '../data/selectors.ts';
import { generate, neededFridays } from '../lib/engine.ts';
import { addDays, fridayOrdinal, gregLong, gregShort, hijriShort, monthFridays, monthTitle, nextHijriMonth, todayIso, umalqura, umalquraMonth, HIJRI_MONTHS } from '../lib/hijri.ts';
import { navigate, queryParam } from '../lib/router.ts';
import { AssignmentModal } from './AssignmentModal.tsx';

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

function NewMonthModal({ onClose, onCreated }: { onClose: () => void; onCreated: (m: Month) => void }) {
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

function MonthSettingsModal({ month, onClose }: { month: Month; onClose: () => void }) {
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

// ---------------------------------------------------------------------------
// اعتذارات الشهر (قبل التوزيع)
// ---------------------------------------------------------------------------
function UnavailabilityModal({ month, onClose }: { month: Month; onClose: () => void }) {
  const { data, actions } = useStore();
  const [q, setQ] = useState('');
  const fridays = fridaysOf(month);
  const list = data.preachers
    .filter((p) => p.is_active && (!q || normalizeAr(p.name).includes(normalizeAr(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const daysOf = (pid: number) => data.unavailable.filter((u) => u.month_id === month.id && u.preacher_id === pid).map((u) => u.friday_index);
  const assigned = (pid: number, fi: number) => data.assignments.some((a) => a.month_id === month.id && a.preacher_id === pid && a.friday_index === fi && a.status !== 'excused');

  return (
    <Modal open onClose={onClose} title="اعتذارات الشهر" wide footer={<Button onClick={onClose}>تمام</Button>}>
      <p className="text-sm text-muted mb-3">علّم الجمعات اللي كل خطيب مش هيقدر يخطب فيها الشهر ده. التوزيع التلقائي مش هيحطه فيها.</p>
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الخطيب…" className="mb-3" />
      <div className="divide-y divide-sand border border-sand rounded-xl bg-white">
        {list.map((p) => {
          const days = daysOf(p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="flex-1 min-w-[140px] font-semibold text-brown-900">{p.name}</span>
              <div className="flex flex-wrap gap-1">
                {fridays.map((f) => {
                  const off = days.includes(f.index);
                  return (
                    <button
                      key={f.index}
                      type="button"
                      onClick={() => actions.setUnavailable(month.id, p.id, off ? days.filter((x) => x !== f.index) : [...days, f.index], '')}
                      className={clsx(
                        'w-14 py-1 rounded-md border text-[12px] cursor-pointer tabular',
                        off ? 'bg-bad-soft border-bad/40 text-bad font-bold line-through' : 'bg-paper border-sand-dark text-brown-700 hover:border-gold-500',
                        assigned(p.id, f.index) && off && 'ring-2 ring-bad'
                      )}
                      title={off ? 'مش متاح، دوس علشان تشيل الاعتذار' : 'متاح، دوس لو معتذر'}
                    >
                      {gregShort(f.date).split(' ')[0]}/{f.index}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-2">الرقم = يوم الجمعة الميلادي / ترتيبها في الشهر. المربع الأحمر المحاط معناه إن الخطيب متكلف فعلًا في الجمعة دي ومحتاج بديل.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// الصفحة
// ---------------------------------------------------------------------------
export function SchedulePage() {
  const { data, actions, toast } = useStore();
  const confirm = useConfirm();
  const months = sortMonths(data.months);
  const requested = Number(queryParam('month'));
  const [monthId, setMonthId] = useState<number | null>(() => (months.some((m) => m.id === requested) ? requested : currentMonth(months)?.id ?? null));
  const month = months.find((m) => m.id === monthId) ?? null;
  const [modal, setModal] = useState<'new' | 'settings' | 'unavail' | null>(null);
  const [slot, setSlot] = useState<{ mosqueId: number; fridayIndex: number } | null>(null);
  const [mobileFriday, setMobileFriday] = useState(1);
  const [busy, setBusy] = useState(false);

  const preachers = byId(data.preachers);
  const fridays = month ? fridaysOf(month) : [];
  const assignments = month ? monthAssignments(data, month.id) : [];
  const cell = (mosqueId: number, fi: number) => assignments.find((a) => a.mosque_id === mosqueId && a.friday_index === fi);
  const mosques = data.mosques.filter((m) => m.is_active).sort((a, b) => ({ large: 0, medium: 1, small: 2 })[a.size] - ({ large: 0, medium: 1, small: 2 })[b.size] || a.name.localeCompare(b.name, 'ar'));
  const fridayIdx = fridays.map((f) => f.index);
  const totalSlots = mosques.reduce((n, m) => n + neededFridays(m, fridayIdx).length, 0);
  const filled = assignments.filter((a) => a.preacher_id && a.status !== 'excused').length;
  const confirmed = assignments.filter((a) => a.preacher_id && a.status === 'confirmed').length;
  const excused = assignments.filter((a) => a.status === 'excused').length;
  const unavail = month ? unavailableSet(data, month.id) : new Set<string>();

  const runDistribution = async (mode: 'fill' | 'full') => {
    if (!month) return;
    setBusy(true);
    const input = engineInput(data, month);
    if (mode === 'fill') {
      input.existing = input.existing.map((a) => (a.preacher_id && a.status !== 'excused' ? { ...a, locked: true } : a));
    }
    const result = generate({ ...input, seed: Date.now() % 100000 });
    const rows = result.assignments
      .filter((p) => !p.kept)
      .map((p) => {
        const old = cell(p.mosqueId, p.fridayIndex);
        const same = old && old.preacher_id === p.preacherId && old.status !== 'excused';
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
    if (stale.length) await actions.deleteAssignments(stale.map((a) => a.id));
    const saved = await actions.upsertAssignments(rows);
    setBusy(false);
    if (saved) {
      await actions.log(month.id, null, 'distribute', `توزيع ${mode === 'fill' ? 'الأماكن الفاضية' : 'كامل'}: ${saved.length} تكليف`);
      toast(result.unfilled.length ? `اتوزّع. فيه ${result.unfilled.length} مكان فاضي محتاج تختار له يدوي` : 'اتوزّع الشهر كله ✓');
    }
  };

  const askDistribution = async () => {
    if (!month) return;
    const hasAuto = assignments.some((a) => a.preacher_id && a.source === 'auto' && !a.locked && a.status !== 'excused');
    if (!hasAuto) return runDistribution('full');
    const confirmedAuto = assignments.filter((a) => a.source === 'auto' && !a.locked && a.status === 'confirmed').length;
    const ok = await confirm({
      title: 'توزيع من جديد؟',
      body: (
        <div className="space-y-2">
          <p>التوزيع الكامل هيغيّر التكليفات التلقائية اللي مش مثبتة{confirmedAuto ? `، ومنهم ${confirmedAuto} مؤكدين من الخطباء` : ''}.</p>
          <p className="text-muted text-sm">التكليفات اليدوية والمثبتة والخطيب الثابت مش هيتغيروا. لو عايز تملا الأماكن الفاضية بس، استخدم "املا الفاضي".</p>
        </div>
      ),
      confirmText: 'وزّع من جديد',
      danger: confirmedAuto > 0,
    });
    if (ok) runDistribution('full');
  };

  const publish = async () => {
    if (!month) return;
    const empty = totalSlots - filled;
    const ok = await confirm({
      title: 'نشر الجدول',
      body: (
        <div className="space-y-2">
          <p>بعد النشر، كل خطيب هيقدر يشوف جمعاته من رابطه الخاص ويأكد أو يعتذر.</p>
          {empty > 0 && <p className="text-wait font-semibold">لسه فيه {empty} مكان من غير خطيب.</p>}
        </div>
      ),
      confirmText: 'انشر',
    });
    if (!ok) return;
    await actions.updateMonth(month.id, { status: 'published', published_at: new Date().toISOString() });
    await actions.log(month.id, null, 'publish', 'نشر الجدول');
    toast('اتنشر الجدول. ابعت للخطباء من صفحة الإرسال');
    navigate(`/messages?month=${month.id}`);
  };

  if (!month) {
    return (
      <>
        <PageTitle title="جدول الشهر" />
        <Card>
          <Empty title="لسه مفيش شهور" action={<Button onClick={() => setModal('new')}><CalendarPlus className="w-4 h-4" />اعمل أول شهر</Button>}>
            اعمل الشهر الهجري، وظبّط أول يوم فيه حسب إعلان دار الإفتاء، والبرنامج يوزّع الخطباء.
          </Empty>
        </Card>
        {modal === 'new' && <NewMonthModal onClose={() => setModal(null)} onCreated={(m) => { setMonthId(m.id); setModal(null); }} />}
      </>
    );
  }

  const CellButton = ({ mosqueId, fi, compact = false }: { mosqueId: number; fi: number; compact?: boolean }) => {
    const a = cell(mosqueId, fi);
    const p = a?.preacher_id ? preachers.get(a.preacher_id) : null;
    const problem = a?.status === 'excused' || Boolean(p && unavail.has(`${p.id}:${fi}`));
    return (
      <button
        onClick={() => setSlot({ mosqueId, fridayIndex: fi })}
        className={clsx(
          'w-full text-right rounded-lg border px-2.5 py-2 transition cursor-pointer group',
          !p ? 'border-dashed border-sand-dark bg-parchment/60 text-muted hover:border-gold-500' : 'bg-white border-sand hover:border-gold-500 hover:shadow-sm',
          problem && 'border-bad/50 bg-bad-soft/50',
          compact ? 'min-h-[52px]' : 'min-h-[58px]'
        )}
      >
        {p ? (
          <>
            <span className="flex items-center gap-1 font-semibold text-[14px] text-brown-900 leading-snug">
              {a?.source === 'fixed' && <Lock className="w-3 h-3 text-gold-600 shrink-0" aria-label="ثابت" />}
              {a?.locked && a.source !== 'fixed' && <Lock className="w-3 h-3 text-brown-600 shrink-0" aria-label="مثبت" />}
              <span className={clsx('truncate', a?.status === 'excused' && 'line-through text-bad')}>{p.name}</span>
            </span>
            <span className="flex items-center gap-1 mt-1">
              <StatusPill status={a!.status} className="!text-[11px] !px-1.5" />
              {a?.status === 'excused' && <span className="text-[11px] text-bad font-semibold">محتاج بديل</span>}
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1 text-[13px]">
            <CircleSlash className="w-3.5 h-3.5" />
            فاضي، دوس للاختيار
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      <PageTitle
        title="جدول الشهر"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{gregLong(month.start_date)} — {gregLong(addDays(month.start_date, month.days_count - 1))}</span>
            {month.status === 'published' ? <Tag tone="brown">منشور</Tag> : <Tag>مسودة</Tag>}
          </span>
        }
        actions={
          <>
            <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto font-display text-lg !py-1.5">
              {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
            </Select>
            <Button variant="outline" onClick={() => setModal('new')}><CalendarPlus className="w-4 h-4" />شهر جديد</Button>
          </>
        }
      />

      {/* الشريط: الإحصائيات والأوامر */}
      <div className="bg-paper border border-sand rounded-xl p-3 sm:p-4 mb-4 no-print">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm mb-3">
          <span><b className="tabular text-brown-900 text-base">{filled}</b> من <span className="tabular">{totalSlots}</span> مكان متغطي</span>
          <span className="text-ok"><b className="tabular">{confirmed}</b> مؤكد</span>
          <span className="text-wait"><b className="tabular">{filled - confirmed}</b> منتظر</span>
          {excused > 0 && <span className="text-bad font-semibold"><b className="tabular">{excused}</b> معتذر محتاج بديل</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="gold" onClick={askDistribution} disabled={busy || !mosques.length || !data.preachers.length}>
            <Wand2 className="w-4 h-4" />
            {assignments.some((a) => a.preacher_id) ? 'وزّع من جديد' : 'وزّع تلقائي'}
          </Button>
          {assignments.some((a) => a.preacher_id) && filled < totalSlots && (
            <Button variant="outline" onClick={() => runDistribution('fill')} disabled={busy}>
              <Sparkles className="w-4 h-4" />
              املا الفاضي
            </Button>
          )}
          <Button variant="outline" onClick={() => setModal('unavail')}>
            <UserX className="w-4 h-4" />
            اعتذارات الشهر
          </Button>
          <Button variant="outline" onClick={() => setModal('settings')}>
            <Settings2 className="w-4 h-4" />
            بداية الشهر
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            طباعة
          </Button>
          {month.status === 'draft' ? (
            <Button onClick={publish} disabled={!filled} className="sm:mr-auto">
              <Send className="w-4 h-4" />
              نشر الجدول
            </Button>
          ) : (
            <Button onClick={() => navigate(`/messages?month=${month.id}`)} className="sm:mr-auto">
              <Send className="w-4 h-4" />
              إرسال للخطباء
            </Button>
          )}
        </div>
      </div>

      {mosques.length === 0 ? (
        <Card>
          <Empty title="ضيف المساجد الأول" action={<Button onClick={() => navigate('/mosques')}>صفحة المساجد</Button>} />
        </Card>
      ) : (
        <>
          {/* عنوان الطباعة */}
          <div className="hidden print:block text-center mb-3">
            <div className="font-display text-2xl">{data.settings.org_name} {data.settings.branch_name && `— ${data.settings.branch_name}`}</div>
            <div className="font-display text-xl">جدول خطباء الجمعة لشهر {monthTitle(month.hijri_year, month.hijri_month)}</div>
          </div>

          {/* جدول (كمبيوتر وطباعة) */}
          <div className="hidden md:block print:block bg-paper border border-sand rounded-xl overflow-x-auto print-area">
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-brown-900 text-gold-200">
                  <th className="sticky right-0 z-10 bg-brown-900 text-right px-3 py-2.5 font-display text-base font-bold w-52">المسجد</th>
                  {fridays.map((f) => (
                    <th key={f.index} className="px-2 py-2 text-center font-normal">
                      <div className="font-display text-[15px] font-bold">{fridayOrdinal(f.index)}</div>
                      <div className="text-[12px] text-gold-300/90 tabular">{hijriShort(f.hijriDay, month.hijri_month)} · {gregShort(f.date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mosques.map((m, i) => {
                  const needed = neededFridays(m, fridayIdx);
                  return (
                    <tr key={m.id} className={i % 2 ? 'bg-parchment/40' : ''}>
                      <th className={clsx('sticky right-0 z-10 text-right px-3 py-2 font-semibold text-brown-900 border-t border-sand align-middle', i % 2 ? 'bg-[#faf5ea]' : 'bg-paper')}>
                        <div className="leading-snug">{m.name}</div>
                        {m.size === 'large' && <div className="text-[11px] text-gold-700 font-normal">مسجد كبير</div>}
                      </th>
                      {fridays.map((f) => (
                        <td key={f.index} className="p-1.5 border-t border-sand align-top">
                          {needed.includes(f.index) ? <CellButton mosqueId={m.id} fi={f.index} /> : <div className="text-center text-sand-dark py-4" title="المسجد مش محتاج خطيب الجمعة دي">—</div>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* موبايل: جمعة جمعة */}
          <div className="md:hidden print:hidden">
            <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
              {fridays.map((f) => (
                <button
                  key={f.index}
                  onClick={() => setMobileFriday(f.index)}
                  className={clsx(
                    'shrink-0 rounded-lg border px-3 py-1.5 text-center cursor-pointer',
                    mobileFriday === f.index ? 'bg-brown-800 text-gold-200 border-brown-900' : 'bg-paper border-sand text-brown-800'
                  )}
                >
                  <div className="text-[13px] font-semibold">{fridayOrdinal(f.index).replace('الجمعة ', '')}</div>
                  <div className="text-[11px] opacity-80 tabular">{gregShort(f.date)}</div>
                </button>
              ))}
            </div>
            <div className="space-y-2 mt-1">
              {mosques
                .filter((m) => neededFridays(m, fridayIdx).includes(mobileFriday))
                .map((m) => (
                  <div key={m.id} className="bg-paper border border-sand rounded-xl p-2.5">
                    <div className="text-[13px] font-semibold text-brown-700 mb-1.5 px-0.5">{m.name}</div>
                    <CellButton mosqueId={m.id} fi={mobileFriday} compact />
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {modal === 'new' && <NewMonthModal onClose={() => setModal(null)} onCreated={(m) => { setMonthId(m.id); setModal(null); }} />}
      {modal === 'settings' && <MonthSettingsModal month={month} onClose={() => setModal(null)} />}
      {modal === 'unavail' && <UnavailabilityModal month={month} onClose={() => setModal(null)} />}
      {slot && <AssignmentModal month={month} slot={slot} onClose={() => setSlot(null)} />}
    </>
  );
}

export type { Assignment };
