import { useState } from 'react';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, FileSpreadsheet, List, Lock, Plus, Printer, Send, Settings2, Sparkles, UserX, Wand2 } from 'lucide-react';
import { useStore } from '../../data/store.tsx';
import type { Assignment } from '../../data/types.ts';
import { Button, Card, Empty, IconButton, PageTitle, Select, StatusPill, Tabs, Tag, clsx, type Tone } from '../../ui/kit.tsx';
import { monthStats, scheduleStage, type ScheduleStage } from '../../data/alerts.ts';
import { LEVEL_LABEL, SIZE_LABEL } from '../../data/types.ts';

const STAGE_LABEL: Record<ScheduleStage, string> = { empty: 'مسودة · لسه ما اتوزعش', incomplete: 'مسودة · ناقص', ready: 'مسودة · جاهز للنشر', published: 'منشور' };
const STAGE_TONE: Record<ScheduleStage, Tone> = { empty: 'sand', incomplete: 'wait', ready: 'gold', published: 'ok' };
import { useConfirm } from '../../ui/confirm.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, sortMonths, unavailableSet } from '../../data/selectors.ts';
import { neededFridays } from '../../lib/engine.ts';
import { downloadWorkbook } from '../../lib/excel.ts';
import { DistributionPreview, planDistribution, type DistributionPlan } from './DistributionPreview.tsx';
import { ReviewPanel } from './ReviewPanel.tsx';
import { addDays, fridayOrdinal, gregLong, gregShort, hijriShort, monthTitle } from '../../lib/hijri.ts';
import { navigate, queryParam, printPage } from '../../lib/router.ts';
import { AssignmentModal } from './AssignmentModal.tsx';
import { MonthSettingsModal, NewMonthModal } from './MonthModals.tsx';
import { UnavailabilityModal } from './UnavailabilityModal.tsx';

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
  const monthPos = month ? months.findIndex((m) => m.id === month.id) : -1;
  const [modal, setModal] = useState<'new' | 'settings' | 'unavail' | null>(() => (queryParam('new') ? 'new' : null));
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

  const [plan, setPlan] = useState<DistributionPlan | null>(null);
  const [view, setView] = useState<'month' | 'week'>('month');

  const runDistribution = (mode: 'fill' | 'full') => {
    if (!month) return;
    setPlan(planDistribution(data, month, mode));
  };

  const applyPlan = async () => {
    if (!month || !plan) return;
    setBusy(true);
    if (plan.stale.length) await actions.deleteAssignments(plan.stale.map((a) => a.id));
    const saved = await actions.upsertAssignments(plan.rows);
    setBusy(false);
    if (saved) {
      await actions.log(month.id, null, 'distribute', `توزيع ${plan.mode === 'fill' ? 'الأماكن الفاضية' : 'كامل'}: ${plan.changes.length} تغيير من ${saved.length} تكليف`);
      toast(plan.unfilled ? `اتوزّع. فيه ${plan.unfilled} مكان فاضي محتاج تختار له يدوي` : 'اتوزّع الشهر كله ✓');
      setPlan(null);
    }
  };

  const askDistribution = () => runDistribution('full');

  const exportExcel = async () => {
    if (!month) return;
    try {
      const title = monthTitle(month.hijri_year, month.hijri_month);
      await downloadWorkbook(`جدول-الخطباء-${title}.xlsx`, [
        {
          name: 'الجدول',
          rows: [
            ['المسجد', ...fridays.map((f) => `${fridayOrdinal(f.index)} ${gregShort(f.date)}`)],
            ...mosques.map((m) => [
              m.name,
              ...fridays.map((f) => {
                if (!neededFridays(m, fridayIdx).includes(f.index)) return '—';
                const a = cell(m.id, f.index);
                const p = a?.preacher_id ? preachers.get(a.preacher_id) : null;
                return p ? `${p.name}${a?.status === 'excused' ? ' (معتذر)' : a?.status === 'confirmed' ? ' ✓' : ''}` : '';
              }),
            ]),
          ],
        },
      ]);
      toast('اتنزل ملف الإكسل');
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
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

  const CellButton = ({ mosqueId, fi, row = false }: { mosqueId: number; fi: number; row?: boolean }) => {
    const a = cell(mosqueId, fi);
    const p = a?.preacher_id ? preachers.get(a.preacher_id) : null;
    const problem = a?.status === 'excused' || Boolean(p && unavail.has(`${p.id}:${fi}`));
    const mosque = mosques.find((m) => m.id === mosqueId);
    const lock = a?.source === 'fixed' ? <Lock className="w-3 h-3 text-gold-600 shrink-0" aria-label="ثابت" /> : a?.locked ? <Lock className="w-3 h-3 text-muted shrink-0" aria-label="مثبت" /> : null;

    if (row) {
      return (
        <button
          onClick={() => setSlot({ mosqueId, fridayIndex: fi })}
          className={clsx('w-full text-right flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-brown-50', problem && 'bg-bad-soft/50')}
        >
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] text-muted truncate">{mosque?.name}</span>
            {p ? (
              <span className={clsx('flex items-center gap-1.5 text-[15px] font-medium text-ink', a?.status === 'excused' && 'line-through text-bad')}>
                {lock}
                <span className="truncate">{p.name}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[14px] text-gold-700 font-medium"><Plus className="w-4 h-4" />اختار خطيب</span>
            )}
          </span>
          {p && <StatusPill status={a!.status} />}
        </button>
      );
    }

    return (
      <button
        onClick={() => setSlot({ mosqueId, fridayIndex: fi })}
        className={clsx(
          'w-full min-h-[60px] text-right rounded-xl border px-3 py-2 transition cursor-pointer',
          !p ? 'border-dashed border-sand-dark bg-transparent text-muted hover:border-gold-500 hover:text-gold-700 hover:bg-gold-200/20' : 'bg-white border-sand hover:border-gold-400 hover:shadow-[0_2px_8px_rgba(35,26,18,0.06)]',
          problem && '!border-bad/40 !bg-bad-soft/40'
        )}
      >
        {p ? (
          <>
            <span className="flex items-center gap-1 font-medium text-[14px] text-ink leading-snug">
              {lock}
              <span className={clsx('truncate', a?.status === 'excused' && 'line-through text-bad')}>{p.name}</span>
            </span>
            <span className="flex items-center gap-1.5 mt-1.5">
              <StatusPill status={a!.status} className="!h-5 !px-2 !text-[11px]" />
              {a?.status === 'excused' && <span className="text-[11px] text-bad font-medium">محتاج بديل</span>}
            </span>
          </>
        ) : (
          <span className="flex items-center justify-center gap-1 text-[13px] h-full min-h-[42px]">
            <Plus className="w-4 h-4" />
            اختار
          </span>
        )}
      </button>
    );
  };

  const stage = scheduleStage(monthStats(data, month));

  const WeekView = () => {
    const rows = mosques.filter((m) => neededFridays(m, fridayIdx).includes(mobileFriday));
    const f = fridays.find((x) => x.index === mobileFriday);
    const load = new Map<number, number>();
    for (const a of assignments) if (a.preacher_id && a.status !== 'excused') load.set(a.preacher_id, (load.get(a.preacher_id) ?? 0) + 1);
    return (
      <div className="hidden md:block print:hidden bg-card border border-border rounded-[var(--radius-card)] overflow-hidden shadow-[var(--shadow-card)]">
        <div className="px-4 h-12 flex items-center justify-between border-b border-border bg-brown-50">
          <b className="text-sm">{fridayOrdinal(mobileFriday)}</b>
          {f && <span className="text-[13px] text-muted tabular">{hijriShort(f.hijriDay, month.hijri_month)} · {gregLong(f.date)} · {rows.length} مسجد</span>}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-[12.5px] text-muted border-b border-border">
              <th className="px-4 h-11 font-semibold">المسجد</th>
              <th className="px-3 h-11 font-semibold">الخطيب</th>
              <th className="px-3 h-11 font-semibold">المصدر</th>
              <th className="px-3 h-11 font-semibold text-center">جمعاته الشهر ده</th>
              <th className="px-3 h-11 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const a = cell(m.id, mobileFriday);
              const p = a?.preacher_id ? preachers.get(a.preacher_id) : null;
              return (
                <tr key={m.id} onClick={() => setSlot({ mosqueId: m.id, fridayIndex: mobileFriday })} className={clsx('border-t border-border first:border-t-0 cursor-pointer hover:bg-brown-50/70', a?.status === 'excused' && 'bg-bad-soft/40')}>
                  <td className="px-4 py-3"><span className="font-medium">{m.name}</span> <span className="text-[12px] text-muted">· {SIZE_LABEL[m.size]}</span></td>
                  <td className="px-3 py-3">{p ? <span className={clsx(a?.status === 'excused' && 'line-through text-bad')}>{p.name} <span className="text-[12px] text-muted">· {LEVEL_LABEL[p.level]}</span></span> : <span className="text-gold-700 inline-flex items-center gap-1"><Plus className="w-4 h-4" />اختار خطيب</span>}</td>
                  <td className="px-3 py-3">{a?.preacher_id && <Tag>{a.source === 'fixed' ? 'ثابت' : a.source === 'manual' ? 'يدوي' : 'تلقائي'}{a.locked && ' · مثبت'}</Tag>}</td>
                  <td className="px-3 py-3 text-center tabular">{p ? <>{load.get(p.id) ?? 0} / {p.max_fridays}</> : '—'}</td>
                  <td className="px-3 py-3">{p && a && <StatusPill status={a.status} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <>
      <PageTitle
        title="جدول الشهر"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{gregLong(month.start_date)} — {gregLong(addDays(month.start_date, month.days_count - 1))}</span>
            <Tag tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Tag>
          </span>
        }
        actions={
          <>
            <div className="flex items-center gap-1">
              <IconButton aria-label="الشهر السابق" disabled={monthPos <= 0} onClick={() => setMonthId(months[monthPos - 1].id)} className="border border-border bg-card"><ChevronRight className="w-4 h-4" /></IconButton>
              <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto min-w-[190px] font-medium" aria-label="اختيار الشهر الهجري">
                {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
              </Select>
              <IconButton aria-label="الشهر التالي" disabled={monthPos >= months.length - 1} onClick={() => setMonthId(months[monthPos + 1].id)} className="border border-border bg-card"><ChevronLeft className="w-4 h-4" /></IconButton>
            </div>
            <Button variant="outline" onClick={() => setModal('new')}><CalendarPlus className="w-4 h-4" />شهر جديد</Button>
          </>
        }
      />

      {/* الشريط: الإحصائيات والأوامر */}
      <div className="bg-paper border border-sand rounded-2xl mb-5 no-print shadow-[0_1px_2px_rgba(35,26,18,0.04)] overflow-hidden">
        <div className="grid grid-cols-4 gap-px bg-sand border-b border-sand">
          {[
            { label: 'متغطي', value: `${filled}/${totalSlots}`, cls: 'text-brown-900' },
            { label: 'مؤكد', value: confirmed, cls: 'text-ok' },
            { label: 'منتظر', value: filled - confirmed, cls: 'text-wait' },
            { label: 'محتاج بديل', value: excused, cls: excused ? 'text-bad' : 'text-muted' },
          ].map((x) => (
            <div key={x.label} className="bg-paper px-3 sm:px-4 py-2.5 sm:py-3">
              <div className="text-[11.5px] sm:text-[12px] text-muted truncate">{x.label}</div>
              <div className={clsx('font-num text-lg sm:text-xl font-bold tabular leading-tight', x.cls)}>{x.value}</div>
            </div>
          ))}
        </div>
        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="grid grid-cols-2 sm:flex gap-2">
            <Button variant="gold" onClick={askDistribution} disabled={busy || !mosques.length || !data.preachers.length}>
              <Wand2 className="w-4 h-4" />
              {assignments.some((a) => a.preacher_id) ? 'وزّع من جديد' : 'وزّع تلقائي'}
            </Button>
            {month.status === 'draft' ? (
              <Button onClick={publish} disabled={!filled}>
                <Send className="w-4 h-4" />
                نشر الجدول
              </Button>
            ) : (
              <Button onClick={() => navigate(`/messages?month=${month.id}`)}>
                <Send className="w-4 h-4" />
                إرسال للخطباء
              </Button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 sm:mr-auto pb-0.5">
            {assignments.some((a) => a.preacher_id) && filled < totalSlots && (
              <Button size="sm" variant="outline" onClick={() => runDistribution('fill')} disabled={busy}>
                <Sparkles className="w-4 h-4" />
                املا الفاضي
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setModal('unavail')}>
              <UserX className="w-4 h-4" />
              اعتذارات الشهر
            </Button>
            <Button size="sm" variant="outline" onClick={() => setModal('settings')}>
              <Settings2 className="w-4 h-4" />
              بداية الشهر
            </Button>
            <Button size="sm" variant="outline" onClick={printPage}>
              <Printer className="w-4 h-4" />
              طباعة
            </Button>
            <Button size="sm" variant="outline" onClick={exportExcel}>
              <FileSpreadsheet className="w-4 h-4" />
              تصدير
            </Button>
          </div>
        </div>
      </div>

      <ReviewPanel data={data} month={month} onOpen={setSlot} />

      {month.status === 'published' && (
        <p className="text-[12.5px] text-muted mb-3 no-print">الجدول منشور: أي تغيير بيتسجل في سجل العمليات، وابعت للخطيب الجديد خطاب التكليف من نافذة المكان.</p>
      )}

      {mosques.length > 0 && (
        <div className="hidden md:flex items-center justify-between gap-3 mb-3 no-print">
          <Tabs value={view} onChange={setView} tabs={[{ value: 'month', label: 'عرض الشهر', icon: CalendarDays }, { value: 'week', label: 'عرض الجمعة', icon: List }]} />
          {view === 'week' && (
            <div className="flex gap-1">
              {fridays.map((f) => (
                <Button key={f.index} size="sm" variant={mobileFriday === f.index ? 'primary' : 'outline'} onClick={() => setMobileFriday(f.index)}>
                  {fridayOrdinal(f.index).replace('الجمعة ', '')} · <span className="tabular">{gregShort(f.date)}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

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
          <div className={clsx(view === 'month' ? 'md:block' : '', 'hidden print:block bg-card border border-border rounded-[var(--radius-card)] overflow-x-auto scroll-soft print-area shadow-[var(--shadow-card)]')}>
            <table className="w-full border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-brown-50 border-b border-sand">
                  <th className="sticky right-0 z-10 bg-brown-50 text-right px-4 py-3 text-[13px] font-semibold text-muted w-52">المسجد</th>
                  {fridays.map((f) => (
                    <th key={f.index} className="px-2 py-3 text-right font-normal">
                      <div className="text-[14px] font-semibold text-ink">{fridayOrdinal(f.index)}</div>
                      <div className="text-[12px] text-muted tabular">{hijriShort(f.hijriDay, month.hijri_month)} · {gregShort(f.date)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mosques.map((m, i) => {
                  const needed = neededFridays(m, fridayIdx);
                  return (
                    <tr key={m.id} className={clsx(i > 0 && 'border-t border-sand')}>
                      <th className="sticky right-0 z-10 bg-paper text-right px-4 py-2 font-medium text-ink align-middle">
                        <div className="leading-snug">{m.name}</div>
                        {m.size === 'large' && <div className="text-[11.5px] text-gold-700 font-normal mt-0.5">مسجد كبير</div>}
                      </th>
                      {fridays.map((f) => (
                        <td key={f.index} className="p-1.5 align-top">
                          {needed.includes(f.index) ? <CellButton mosqueId={m.id} fi={f.index} /> : <div className="text-center text-sand-dark py-4" title="المسجد مش محتاج خطيب الجمعة دي">—</div>}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* عرض الجمعة (كمبيوتر) */}
          {view === 'week' && <WeekView />}

          {/* موبايل: جمعة جمعة */}
          <div className="md:hidden print:hidden">
            <div className="grid gap-1 p-1 rounded-xl bg-brown-100/70 mb-3" style={{ gridTemplateColumns: `repeat(${fridays.length}, minmax(0, 1fr))` }}>
              {fridays.map((f) => (
                <button
                  key={f.index}
                  onClick={() => setMobileFriday(f.index)}
                  className={clsx(
                    'rounded-lg py-1.5 text-center cursor-pointer transition',
                    mobileFriday === f.index ? 'bg-white text-ink shadow-[0_1px_3px_rgba(35,26,18,0.12)]' : 'text-muted'
                  )}
                >
                  <div className="text-[13px] font-semibold">{fridayOrdinal(f.index).replace('الجمعة ', '')}</div>
                  <div className="text-[11px] tabular opacity-80">{gregShort(f.date)}</div>
                </button>
              ))}
            </div>
            <div className="bg-paper border border-sand rounded-2xl divide-y divide-sand overflow-hidden">
              {mosques
                .filter((m) => neededFridays(m, fridayIdx).includes(mobileFriday))
                .map((m) => (
                  <CellButton key={m.id} mosqueId={m.id} fi={mobileFriday} row />
                ))}
            </div>
          </div>
        </>
      )}

      {modal === 'new' && <NewMonthModal onClose={() => setModal(null)} onCreated={(m) => { setMonthId(m.id); setModal(null); }} />}
      {modal === 'settings' && <MonthSettingsModal month={month} onClose={() => setModal(null)} />}
      {modal === 'unavail' && <UnavailabilityModal month={month} onClose={() => setModal(null)} />}
      {plan && <DistributionPreview data={data} plan={plan} busy={busy} onApply={applyPlan} onRetry={() => runDistribution(plan.mode)} onClose={() => setPlan(null)} />}
      {slot && <AssignmentModal month={month} slot={slot} onClose={() => setSlot(null)} />}
    </>
  );
}

export type { Assignment };

