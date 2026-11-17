import { useMemo, useState } from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import { LEVEL_LABEL } from '../data/types.ts';
import { Button, Card, Empty, PageTitle, Select, Stat, clsx } from '../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, sortMonths } from '../data/selectors.ts';
import { fridayOrdinal, gregShort, monthTitle } from '../lib/hijri.ts';
import { downloadWorkbook } from '../lib/excel.ts';
import { queryParam, printPage } from '../lib/router.ts';

export function ReportPage() {
  const { data, toast } = useStore();
  const months = sortMonths(data.months);
  const requested = Number(queryParam('month'));
  const [monthId, setMonthId] = useState<number | null>(() => (months.some((m) => m.id === requested) ? requested : currentMonth(months)?.id ?? null));
  const month = months.find((m) => m.id === monthId) ?? null;
  const mosques = byId(data.mosques);

  const rows = useMemo(() => {
    if (!month) return [];
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
          places: mine.sort((x, y) => x.friday_index - y.friday_index).map((a) => `${fridayOrdinal(a.friday_index).replace('الجمعة ', '')}: ${mosques.get(a.mosque_id)?.name ?? ''}`),
        };
      })
      .filter((r) => r.total > 0 || r.excuses > 0 || r.preacher.is_active)
      .sort((a, b) => b.total - a.total || a.preacher.name.localeCompare(b.preacher.name, 'ar'));
  }, [data, month, mosques]);

  if (!month) {
    return (
      <>
        <PageTitle title="التقرير الشهري" />
        <Card><Empty title="لسه مفيش شهور" /></Card>
      </>
    );
  }

  const fridays = fridaysOf(month);
  const totals = rows.reduce((t, r) => ({ total: t.total + r.total, confirmed: t.confirmed + r.confirmed, excuses: t.excuses + r.excuses }), { total: 0, confirmed: 0, excuses: 0 });
  const idle = rows.filter((r) => r.total === 0 && r.preacher.is_active);
  const title = monthTitle(month.hijri_year, month.hijri_month);

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
      ]);
      toast('اتنزل ملف الإكسل');
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="التقرير الشهري"
        subtitle={`عدد جمعات كل خطيب في ${title}`}
        actions={
          <>
            <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto min-w-[190px] font-medium">
              {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
            </Select>
            <Button variant="gold" onClick={exportExcel}><FileSpreadsheet className="w-4 h-4" />تصدير إكسل</Button>
            <Button variant="outline" onClick={printPage}><Printer className="w-4 h-4" />طباعة</Button>
          </>
        }
      />
      <div className="hidden print:block text-center font-display text-xl mb-3">{data.settings.org_name} — تقرير خطباء {title}</div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="إجمالي الجمعات" value={totals.total} />
        <Stat label="أكدوا" value={totals.confirmed} tone="ok" />
        <Stat label="اعتذارات" value={totals.excuses} tone={totals.excuses ? 'bad' : 'brown'} />
        <Stat label="خطباء ما أخدوش جمعات" value={idle.length} tone={idle.length ? 'wait' : 'brown'} />
      </div>
      <div className="bg-paper border border-sand rounded-2xl overflow-x-auto print-area shadow-[0_1px_2px_rgba(35,26,18,0.04)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-brown-50 border-b border-sand text-right text-[13px] text-muted">
              <th className="px-4 py-3 font-semibold">الخطيب</th>
              <th className="px-3 py-3 text-center font-semibold">الجمعات</th>
              <th className="px-3 py-3 text-center font-semibold">أكد</th>
              <th className="px-3 py-3 text-center font-semibold">منتظر</th>
              <th className="px-3 py-3 text-center font-semibold">اعتذارات</th>
              <th className="px-3 py-3 font-semibold">الأماكن</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.preacher.id} className={clsx('border-t border-sand hover:bg-brown-50/60', i === 0 && 'border-t-0')}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-ink">{r.preacher.name}</div>
                  <div className="text-[12px] text-muted">{LEVEL_LABEL[r.preacher.level]} · الحد {r.preacher.max_fridays}</div>
                </td>
                <td className="px-3 py-2 text-center tabular font-num font-bold text-brown-900 text-base">{r.total}</td>
                <td className="px-3 py-2 text-center tabular text-ok">{r.confirmed}</td>
                <td className="px-3 py-2 text-center tabular text-wait">{r.pending}</td>
                <td className={clsx('px-3 py-2 text-center tabular', r.excuses ? 'text-bad font-semibold' : 'text-muted')}>{r.excuses}</td>
                <td className="px-3 py-2 text-[13px] text-brown-700">{r.places.join(' · ') || <span className="text-muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
