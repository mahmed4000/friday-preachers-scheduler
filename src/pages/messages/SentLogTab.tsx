// سجل الإرسال: من تواريخ الإرسال المتسجلة على التكليفات + الرسائل المخصصة في السجل.
import { useMemo, useState } from 'react';
import { Info, Mail } from 'lucide-react';
import type { AppData } from '../../data/types.ts';
import { DataTable, Empty, FilterBar, FilterSelect, Search, Tag, normalizeAr, useTable, type Column } from '../../ui/kit.tsx';
import { byId } from '../../data/selectors.ts';
import { fridayOrdinal, monthTitle } from '../../lib/hijri.ts';
import { formatDateTime } from '../ActivityLog.tsx';

interface SendEvent {
  key: string;
  at: string;
  kind: 'assignment' | 'reminder' | 'custom';
  preacher: string;
  about: string;
}

const KIND: Record<SendEvent['kind'], { label: string; tone: 'gold' | 'ok' | 'sand' }> = {
  assignment: { label: 'تكليف / جدول الشهر', tone: 'gold' },
  reminder: { label: 'تذكير الخميس', tone: 'ok' },
  custom: { label: 'رسالة مخصصة', tone: 'sand' },
};

export function SentLogTab({ data }: { data: AppData }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const events = useMemo(() => {
    const preachers = byId(data.preachers);
    const mosques = byId(data.mosques);
    const months = byId(data.months);
    const out: SendEvent[] = [];
    for (const a of data.assignments) {
      if (!a.preacher_id) continue;
      const m = months.get(a.month_id);
      const about = `${mosques.get(a.mosque_id)?.name ?? ''} · ${fridayOrdinal(a.friday_index)}${m ? ` · ${monthTitle(m.hijri_year, m.hijri_month)}` : ''}`;
      const name = preachers.get(a.preacher_id)?.name ?? '—';
      if (a.notified_at) out.push({ key: `n${a.id}`, at: a.notified_at, kind: 'assignment', preacher: name, about });
      if (a.reminded_at) out.push({ key: `r${a.id}`, at: a.reminded_at, kind: 'reminder', preacher: name, about });
    }
    for (const l of data.log) {
      if (l.action !== 'message_sent') continue;
      out.push({ key: `l${l.id}`, at: l.created_at, kind: 'custom', preacher: l.preacher_id ? preachers.get(l.preacher_id)?.name ?? '—' : '—', about: l.details.replace(/^رسالة مخصصة: ?/, '') });
    }
    return out;
  }, [data]);

  const rows = useMemo(() => {
    const n = normalizeAr(q);
    return events.filter((e) => (kind === 'all' || e.kind === kind) && (!n || normalizeAr(`${e.preacher} ${e.about}`).includes(n)));
  }, [events, q, kind]);

  const columns: Column<SendEvent>[] = [
    { key: 'at', header: 'وقت الإرسال', cell: (e) => <span className="tabular text-[13px] text-muted whitespace-nowrap">{formatDateTime(e.at)}</span>, sort: (e) => e.at, className: 'w-44' },
    { key: 'kind', header: 'النوع', cell: (e) => <Tag tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Tag>, sort: (e) => e.kind, className: 'w-40' },
    { key: 'preacher', header: 'الخطيب', cell: (e) => <span className="font-medium">{e.preacher}</span>, sort: (e) => e.preacher },
    { key: 'about', header: 'بخصوص', cell: (e) => <span className="text-[13px] text-muted">{e.about}</span> },
  ];
  const table = useTable(rows, columns, { pageSize: 20, initialSort: { key: 'at', dir: 'desc' } });

  return (
    <div className="p-4 sm:p-5">
      <div className="flex items-start gap-2 text-[12.5px] text-muted bg-brown-50 border border-border rounded-xl p-3 mb-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        الإرسال بيتم من واتساب يدوي، فالبرنامج بيسجل وقت ما دوست "إرسال". مش بيقدر يعرف لو الرسالة وصلت أو فشلت، فمفيش قايمة "رسائل فاشلة". علشان كده كمان بيتسجل آخر إرسال بس لكل تكليف.
      </div>
      <FilterBar>
        <Search value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="ابحث بالخطيب أو المسجد…" />
        <FilterSelect label="النوع" value={kind} onChange={(v) => { setKind(v); table.setPage(1); }} options={[{ value: 'all', label: 'الكل' }, ...Object.entries(KIND).map(([k, v]) => ({ value: k, label: v.label }))]} />
      </FilterBar>
      <DataTable
        columns={columns}
        table={table}
        rowKey={(e) => e.key}
        minWidth={720}
        empty={<Empty title="لسه مفيش رسائل متسجلة" icon={Mail} />}
        card={(e) => (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{e.preacher}</span>
              <Tag tone={KIND[e.kind].tone}>{KIND[e.kind].label}</Tag>
            </div>
            <div className="text-[12.5px] text-muted mt-0.5">{e.about}</div>
            <div className="text-[11.5px] text-muted tabular mt-0.5">{formatDateTime(e.at)}</div>
          </div>
        )}
      />
    </div>
  );
}
