import { useMemo, useState } from 'react';
import { BarChart3, FileSpreadsheet, Landmark, Mail, Printer, Scale, TrendingUp, Users } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import { LEVEL_LABEL, SIZE_LABEL } from '../data/types.ts';
import type { AppData, Month } from '../data/types.ts';
import { Button, Card, Empty, PageTitle, Select, Stat, Tabs, clsx } from '../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, sortMonths } from '../data/selectors.ts';
import { monthStats } from '../data/alerts.ts';
import { neededFridays } from '../lib/engine.ts';
import { fridayOrdinal, gregShort, monthTitle } from '../lib/hijri.ts';
import { downloadWorkbook } from '../lib/excel.ts';
import { queryParam, printPage } from '../lib/router.ts';

type Tab = 'preachers' | 'mosques' | 'fairness' | 'comms' | 'compare';

// ---------------------------------------------------------------------
// رسوم بسيطة (SVG/CSS) من غير مكتبة. كل رقم ظاهر جنب العمود، فمش بنعتمد على اللون.
// ---------------------------------------------------------------------
function HBar({ label, value, max, tone = 'gold', suffix }: { label: string; value: number; max: number; tone?: 'gold' | 'ok' | 'wait' | 'bad' | 'brown'; suffix?: string }) {
  const bar = { gold: 'bg-gold-500', ok: 'bg-ok', wait: 'bg-wait', bad: 'bg-bad', brown: 'bg-brown-700' }[tone];
  return (
    <div className="grid grid-cols-[minmax(90px,170px)_1fr_auto] items-center gap-3 text-[13px]">
      <span className="truncate text-ink">{label}</span>
      <span className="h-3 rounded-full bg-brown-100 overflow-hidden">
        <span className={clsx('block h-full rounded-full', bar)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </span>
      <span className="tabular font-semibold text-brown-900 min-w-8 text-left">{value}{suffix}</span>
    </div>
  );
}

/** عمود مكدس: أجزاء بنسب، مع مفتاح بالأرقام */
function Stacked({ parts }: { parts: { label: string; value: number; cls: string }[] }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <div>
      <div className="flex h-5 rounded-full overflow-hidden bg-brown-100" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join('، ')}>
        {parts.map((p) => p.value > 0 && <span key={p.label} className={p.cls} style={{ width: `${(p.value / Math.max(total, 1)) * 100}%` }} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12.5px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={clsx('w-2.5 h-2.5 rounded-sm', p.cls)} />
            {p.label} <b className="tabular">{p.value}</b>
            <span className="text-muted tabular">({total ? Math.round((p.value / total) * 100) : 0}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** دائرة نسبة */
function Donut({ pct, label }: { pct: number; label: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90" role="img" aria-label={`${label} ${pct}%`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-brown-100)" strokeWidth="11" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={pct >= 100 ? 'var(--color-ok)' : 'var(--color-gold-500)'} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
      </svg>
      <div className="-mt-[74px] mb-[38px] font-num text-2xl font-bold text-brown-900 tabular">{pct}%</div>
      <div className="text-[12.5px] text-muted">{label}</div>
    </div>
  );
}

function preacherRows(data: AppData, month: Month) {
  const mosques = byId(data.mosques);
  const list = monthAssignments(data, month.id);
  const excuses = data.log.filter((l) => l.month_id === month.id && l.action === 'excuse');
  return data.preachers
    .map((p) => {
      const mine = list.filter((a) => a.preacher_id === p.id && a.status !== 'excused');
      return {
        preacher: p,
        total: mine.length,
        confirmed: mine.filter((a) => a.status === 'confirmed').length,
        pending: mine.filter((a) => a.status === 'pending').length,
        excuses: Math.max(excuses.filter((l) => l.preacher_id === p.id).length, list.filter((a) => a.preacher_id === p.id && a.status === 'excused').length),
        places: [...mine].sort((x, y) => x.friday_index - y.friday_index).map((a) => `${fridayOrdinal(a.friday_index).replace('الجمعة ', '')}: ${mosques.get(a.mosque_id)?.name ?? ''}`),
      };
    })
    .filter((r) => r.total > 0 || r.excuses > 0 || r.preacher.is_active)
    .sort((a, b) => b.total - a.total || a.preacher.name.localeCompare(b.preacher.name, 'ar'));
}

export function ReportPage() {
  const { data, toast } = useStore();
  const months = sortMonths(data.months);
  const requested = Number(queryParam('month'));
  const [monthId, setMonthId] = useState<number | null>(() => (months.some((m) => m.id === requested) ? requested : currentMonth(months)?.id ?? null));
  const [tab, setTab] = useState<Tab>('preachers');
  const month = months.find((m) => m.id === monthId) ?? null;

  const rows = useMemo(() => (month ? preacherRows(data, month) : []), [data, month]);
  const stats = useMemo(() => (month ? monthStats(data, month) : null), [data, month]);

  const mosqueRows = useMemo(() => {
    if (!month) return [];
    const idx = fridaysOf(month).map((f) => f.index);
    const list = monthAssignments(data, month.id);
    return data.mosques
      .filter((m) => m.is_active)
      .map((m) => {
        const need = neededFridays(m, idx);
        const mine = list.filter((a) => a.mosque_id === m.id);
        const covered = mine.filter((a) => a.preacher_id && a.status !== 'excused').length;
        return { mosque: m, need: need.length, covered, confirmed: mine.filter((a) => a.preacher_id && a.status === 'confirmed').length, distinct: new Set(mine.filter((a) => a.preacher_id && a.status !== 'excused').map((a) => a.preacher_id)).size };
      })
      .filter((r) => r.need > 0)
      .sort((a, b) => a.covered / a.need - b.covered / b.need || a.mosque.name.localeCompare(b.mosque.name, 'ar'));
  }, [data, month]);

  const compare = useMemo(() => months.slice(-6).map((m) => ({ m, s: monthStats(data, m) })), [data, months]);

  if (!month || !stats) {
    return (
      <>
        <PageTitle title="التقارير الشهرية" />
        <Card><Empty title="لسه مفيش شهور" icon={BarChart3} /></Card>
      </>
    );
  }

  const fridays = fridaysOf(month);
  const totals = rows.reduce((t, r) => ({ total: t.total + r.total, confirmed: t.confirmed + r.confirmed, excuses: t.excuses + r.excuses }), { total: 0, confirmed: 0, excuses: 0 });
  const idle = rows.filter((r) => r.total === 0 && r.preacher.is_active);
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const maxLoad = Math.max(1, ...rows.map((r) => r.total));

  // العدالة: توزيع عدد الجمعات على الخطباء النشطين
  const active = rows.filter((r) => r.preacher.is_active);
  const hist = new Map<number, number>();
  for (const r of active) hist.set(r.total, (hist.get(r.total) ?? 0) + 1);
  const histKeys = [...hist.keys()].sort((a, b) => a - b);
  const mean = active.length ? active.reduce((n, r) => n + r.total, 0) / active.length : 0;
  const sd = active.length ? Math.sqrt(active.reduce((n, r) => n + (r.total - mean) ** 2, 0) / active.length) : 0;
  const atMax = active.filter((r) => r.total >= r.preacher.max_fridays).length;

  const exportExcel = async () => {
    try {
      const grid = data.mosques
        .filter((m) => m.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
        .map((m) => [
          m.name,
          ...fridays.map((f) => {
            const a = monthAssignments(data, month.id).find((x) => x.mosque_id === m.id && x.friday_index === f.index);
            const p = a?.preacher_id ? data.preachers.find((x) => x.id === a.preacher_id) : null;
            return p ? `${p.name}${a?.status === 'excused' ? ' (معتذر)' : ''}` : '';
          }),
        ]);
      await downloadWorkbook(`تقرير-الخطباء-${title}.xlsx`, [
        {
          name: 'الخطباء',
          rows: [
            ['الخطيب', 'الخبرة', 'عدد الجمعات', 'أكد', 'منتظر', 'اعتذارات', 'الأماكن'],
            ...rows.map((r) => [r.preacher.name, LEVEL_LABEL[r.preacher.level], r.total, r.confirmed, r.pending, r.excuses, r.places.join(' | ')]),
          ],
        },
        { name: 'الجدول', rows: [['المسجد', ...fridays.map((f) => `${fridayOrdinal(f.index)} ${gregShort(f.date)}`)], ...grid] },
        { name: 'المساجد', rows: [['المسجد', 'الحجم', 'المطلوب', 'متغطي', 'مؤكد', 'خطباء مختلفين'], ...mosqueRows.map((r) => [r.mosque.name, SIZE_LABEL[r.mosque.size], r.need, r.covered, r.confirmed, r.distinct])] },
        { name: 'مقارنة الشهور', rows: [['الشهر', 'المطلوب', 'متغطي', 'النسبة', 'مؤكد', 'اعتذارات', 'رسائل اتبعت'], ...compare.map(({ m, s }) => [monthTitle(m.hijri_year, m.hijri_month), s.total, s.filled, `${s.pct}%`, s.confirmed, s.excused, s.notified])] },
      ]);
      toast('اتنزل ملف الإكسل');
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="التقارير الشهرية"
        subtitle={`${title} · ${fridays.length} جمعات · كل الأرقام من الجدول الفعلي`}
        actions={
          <>
            <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto min-w-[190px] font-medium" aria-label="الشهر">
              {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
            </Select>
            <Button variant="gold" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4" />تصدير إكسل</Button>
            <Button variant="outline" onClick={printPage}><Printer className="w-4 h-4" />طباعة</Button>
          </>
        }
      />

      {/* غلاف الطباعة */}
      <div className="hidden print:block mb-4 frame-gold rounded-xl p-6 text-center">
        <div className="font-display text-2xl">{data.settings.org_name}{data.settings.branch_name && ` — ${data.settings.branch_name}`}</div>
        <div className="font-display text-xl mt-1">تقرير خطباء الجمعة · {title}</div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Stat label="اكتمال التوزيع" value={`${stats.pct}%`} progress={stats.pct} />
        <Stat label="إجمالي الجمعات" value={totals.total} hint={`من ${stats.total} مكان`} />
        <Stat label="أكدوا" value={totals.confirmed} tone="ok" />
        <Stat label="اعتذارات" value={totals.excuses} tone={totals.excuses ? 'bad' : 'brown'} />
        <Stat label="خطباء ما أخدوش جمعات" value={idle.length} tone={idle.length ? 'wait' : 'brown'} />
      </div>

      <div className="mb-4">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'preachers', label: 'توزيع الخطباء', icon: Users },
            { value: 'mosques', label: 'المساجد', icon: Landmark },
            { value: 'fairness', label: 'عدالة التوزيع', icon: Scale },
            { value: 'comms', label: 'التواصل والتأكيد', icon: Mail },
            { value: 'compare', label: 'مقارنة الشهور', icon: TrendingUp },
          ]}
        />
      </div>

      {tab === 'preachers' && (
        <div className="space-y-4">
          <Card title="تكليفات كل خطيب">
            <div className="grid md:grid-cols-2 gap-x-10 gap-y-2.5">
              {rows.map((r) => <HBar key={r.preacher.id} label={r.preacher.name} value={r.total} max={maxLoad} tone={r.total === 0 ? 'wait' : r.total >= r.preacher.max_fridays ? 'brown' : 'gold'} />)}
            </div>
          </Card>
          <div className="bg-card border border-border rounded-[var(--radius-card)] overflow-x-auto scroll-soft print-area shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-brown-50 border-b border-border text-right text-[12.5px] text-muted">
                  <th className="px-4 h-11 font-semibold">الخطيب</th>
                  <th className="px-3 text-center font-semibold">الجمعات</th>
                  <th className="px-3 text-center font-semibold">أكد</th>
                  <th className="px-3 text-center font-semibold">منتظر</th>
                  <th className="px-3 text-center font-semibold">اعتذارات</th>
                  <th className="px-3 font-semibold">الأماكن</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.preacher.id} className="border-t border-border first:border-t-0 hover:bg-brown-50/60">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-ink">{r.preacher.name}</div>
                      <div className="text-[12px] text-muted">{LEVEL_LABEL[r.preacher.level]} · الحد {r.preacher.max_fridays}</div>
                    </td>
                    <td className="px-3 py-2 text-center tabular font-num font-bold text-brown-900 text-base">{r.total}</td>
                    <td className="px-3 py-2 text-center tabular text-ok">{r.confirmed}</td>
                    <td className="px-3 py-2 text-center tabular text-wait">{r.pending}</td>
                    <td className={clsx('px-3 py-2 text-center tabular', r.excuses ? 'text-bad font-semibold' : 'text-muted')}>{r.excuses}</td>
                    <td className="px-3 py-2 text-[12.5px] text-brown-700">{r.places.join(' · ') || <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'mosques' && (
        <div className="grid xl:grid-cols-3 gap-4">
          <Card title="المساجد المغطاة وغير المغطاة">
            <div className="flex justify-center py-2"><Donut pct={stats.mosquesNeeded ? Math.round((stats.mosquesCovered / stats.mosquesNeeded) * 100) : 0} label="مساجد متغطية بالكامل" /></div>
            <Stacked parts={[{ label: 'متغطي بالكامل', value: stats.mosquesCovered, cls: 'bg-ok' }, { label: 'ناقص', value: stats.mosquesUncovered, cls: 'bg-wait' }]} />
          </Card>
          <div className="xl:col-span-2 bg-card border border-border rounded-[var(--radius-card)] overflow-x-auto scroll-soft shadow-[var(--shadow-card)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-brown-50 border-b border-border text-right text-[12.5px] text-muted">
                  <th className="px-4 h-11 font-semibold">المسجد</th>
                  <th className="px-3 font-semibold">التغطية</th>
                  <th className="px-3 text-center font-semibold">مؤكد</th>
                  <th className="px-3 text-center font-semibold">خطباء مختلفين</th>
                </tr>
              </thead>
              <tbody>
                {mosqueRows.map((r) => (
                  <tr key={r.mosque.id} className="border-t border-border first:border-t-0">
                    <td className="px-4 py-2.5"><span className="font-medium">{r.mosque.name}</span> <span className="text-[12px] text-muted">· {SIZE_LABEL[r.mosque.size]}</span></td>
                    <td className="px-3 py-2.5 w-[40%]"><HBar label={`${r.covered} من ${r.need}`} value={r.covered} max={r.need} tone={r.covered >= r.need ? 'ok' : 'wait'} /></td>
                    <td className="px-3 py-2.5 text-center tabular text-ok">{r.confirmed}</td>
                    <td className="px-3 py-2.5 text-center tabular">{r.distinct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'fairness' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <Card title="عدد الخطباء حسب عدد الجمعات" subtitle="الخطباء النشطين بس">
            <div className="space-y-2.5">
              {histKeys.map((k) => <HBar key={k} label={k === 0 ? 'من غير جمعات' : `${k} ${k === 1 ? 'جمعة' : k === 2 ? 'جمعتين' : 'جمعات'}`} value={hist.get(k)!} max={active.length} tone={k === 0 ? 'wait' : 'gold'} suffix=" خطيب" />)}
            </div>
          </Card>
          <Card title="مؤشرات العدالة">
            <dl className="grid grid-cols-2 gap-3">
              {[
                { l: 'متوسط الجمعات للخطيب', v: mean.toFixed(1) },
                { l: 'الانحراف المعياري', v: sd.toFixed(2), h: 'كل ما يقل، التوزيع أعدل' },
                { l: 'وصلوا لحدهم الأقصى', v: atMax },
                { l: 'من غير جمعات', v: idle.length },
              ].map((x) => (
                <div key={x.l} className="rounded-xl border border-border bg-paper p-3">
                  <dt className="text-[12.5px] text-muted">{x.l}</dt>
                  <dd className="font-num text-2xl font-bold tabular text-brown-900">{x.v}</dd>
                  {x.h && <dd className="text-[11.5px] text-muted">{x.h}</dd>}
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] text-muted mt-3">الخطيب ممكن ما ياخدش جمعات بسبب حده الأقصى أو الجمعات اللي متاح فيها أو قاعدة "الجديد ما يروحش مسجد كبير".</p>
          </Card>
        </div>
      )}

      {tab === 'comms' && (
        <div className="grid xl:grid-cols-2 gap-4">
          <Card title="حالات التأكيد">
            <Stacked parts={[{ label: 'مؤكد', value: stats.confirmed, cls: 'bg-ok' }, { label: 'منتظر', value: stats.pending, cls: 'bg-wait' }, { label: 'معتذر', value: stats.excused, cls: 'bg-bad' }]} />
          </Card>
          <Card title="رسائل جدول الشهر">
            <Stacked parts={[{ label: 'اتبعت', value: stats.notified, cls: 'bg-ok' }, { label: 'ما اتبعتش', value: stats.notNotified, cls: 'bg-sand-dark' }]} />
            <p className="text-[12.5px] text-muted mt-3">الإرسال يدوي من واتساب، فالبرنامج بيعرف "اتبعت" بس. مفيش بيانات عن نجاح أو فشل الوصول.</p>
          </Card>
        </div>
      )}

      {tab === 'compare' && (
        <Card title="مقارنة آخر الشهور" bodyClassName="p-0">
          {compare.length < 2 && <p className="text-sm text-muted px-5 pt-4">المقارنة بتبقى أوضح لما يبقى فيه أكتر من شهر.</p>}
          <div className="overflow-x-auto scroll-soft">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="bg-brown-50 border-b border-border text-right text-[12.5px] text-muted">
                  <th className="px-4 h-11 font-semibold">الشهر</th>
                  <th className="px-3 font-semibold w-[34%]">اكتمال التوزيع</th>
                  <th className="px-3 text-center font-semibold">متغطي</th>
                  <th className="px-3 text-center font-semibold">مؤكد</th>
                  <th className="px-3 text-center font-semibold">اعتذارات</th>
                  <th className="px-3 text-center font-semibold">رسائل اتبعت</th>
                </tr>
              </thead>
              <tbody>
                {compare.map(({ m, s }) => (
                  <tr key={m.id} className={clsx('border-t border-border first:border-t-0', m.id === month.id && 'bg-gold-200/30')}>
                    <td className="px-4 py-2.5 font-medium">{monthTitle(m.hijri_year, m.hijri_month)} <span className="text-[12px] text-muted">· {m.status === 'published' ? 'منشور' : 'مسودة'}</span></td>
                    <td className="px-3 py-2.5"><HBar label="" value={s.pct} max={100} suffix="%" tone={s.pct >= 100 ? 'ok' : 'gold'} /></td>
                    <td className="px-3 py-2.5 text-center tabular">{s.filled} / {s.total}</td>
                    <td className="px-3 py-2.5 text-center tabular text-ok">{s.confirmed}</td>
                    <td className="px-3 py-2.5 text-center tabular text-bad">{s.excused}</td>
                    <td className="px-3 py-2.5 text-center tabular">{s.notified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
