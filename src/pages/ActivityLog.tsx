import { useMemo, useState } from 'react';
import { CalendarDays, Database, History, MessageCircle, Settings2, UserCheck } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { LogEntry } from '../data/types.ts';
import { ACTIONS, KIND_LABEL, actionLabel, type LogKind } from '../data/audit.ts';
import { DataTable, Empty, FilterBar, FilterSelect, PageTitle, Search, Tag, normalizeAr, useTable, type Column, type Tone } from '../ui/kit.tsx';
import { byId, sortMonths } from '../data/selectors.ts';
import { monthTitle } from '../lib/hijri.ts';

const KIND_ICON: Record<LogKind, typeof History> = { assignment: UserCheck, schedule: CalendarDays, data: Database, message: MessageCircle, settings: Settings2 };
const KIND_TONE: Record<LogKind, Tone> = { assignment: 'gold', schedule: 'brown', data: 'sand', message: 'ok', settings: 'sand' };

function kindOf(action: string): LogKind {
  return ACTIONS[action]?.kind ?? 'data';
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { timeZone: 'Africa/Cairo', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
}

/** مين عمل العملية: المسؤول، أو الخطيب من صفحته */
function actorOf(l: LogEntry): string {
  return l.details.startsWith('من صفحة الخطيب') ? 'الخطيب (من صفحته)' : 'المسؤول';
}

/** تفاصيل التغيير: كل "قديم ← جديد" في سطر */
function Details({ text }: { text: string }) {
  const [head, ...rest] = text.includes(': ') && text.includes('←') ? [text.slice(0, text.indexOf(': ')), text.slice(text.indexOf(': ') + 2)] : [text];
  if (!rest.length) return <span className="text-ink">{text || '—'}</span>;
  return (
    <span className="block">
      <span className="font-medium text-ink">{head}</span>
      <span className="block mt-1 space-y-0.5">
        {rest[0].split(' · ').map((c, i) => {
          const [label, values] = c.includes(': ') ? [c.slice(0, c.indexOf(': ')), c.slice(c.indexOf(': ') + 2)] : ['', c];
          const [from, to] = values.split(' ← ');
          return (
            <span key={i} className="block text-[12.5px] text-muted">
              {label && <span className="text-brown-700">{label}: </span>}
              {to !== undefined ? (
                <>
                  <del className="text-bad/80 decoration-bad/40">{from}</del> <span aria-hidden="true">←</span> <ins className="no-underline text-ok font-medium">{to}</ins>
                </>
              ) : (
                values
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

export function ActivityLogPage() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [monthId, setMonthId] = useState('all');
  const preachers = byId(data.preachers);
  const months = byId(data.months);

  const rows = useMemo(() => {
    const n = normalizeAr(q);
    return data.log.filter((l) => {
      if (kind !== 'all' && kindOf(l.action) !== kind) return false;
      if (monthId !== 'all' && String(l.month_id) !== monthId) return false;
      if (!n) return true;
      const p = l.preacher_id ? preachers.get(l.preacher_id)?.name ?? '' : '';
      return normalizeAr(`${l.details} ${p} ${actionLabel(l.action)}`).includes(n);
    });
  }, [data.log, q, kind, monthId, preachers]);

  const columns: Column<LogEntry>[] = [
    { key: 'time', header: 'التاريخ والوقت', cell: (l) => <span className="tabular text-[13px] text-muted whitespace-nowrap">{formatDateTime(l.created_at)}</span>, sort: (l) => l.created_at, className: 'w-44' },
    {
      key: 'action',
      header: 'العملية',
      cell: (l) => {
        const k = kindOf(l.action);
        const Icon = KIND_ICON[k];
        return <Tag tone={KIND_TONE[k]}><Icon className="w-3.5 h-3.5" />{actionLabel(l.action)}</Tag>;
      },
      sort: (l) => actionLabel(l.action),
      className: 'w-40',
    },
    { key: 'details', header: 'العنصر والتغيير', cell: (l) => <Details text={l.details} /> },
    {
      key: 'preacher',
      header: 'الخطيب',
      cell: (l) => <span className="text-[13px]">{l.preacher_id ? preachers.get(l.preacher_id)?.name ?? '—' : '—'}</span>,
      sort: (l) => (l.preacher_id ? preachers.get(l.preacher_id)?.name ?? '' : ''),
      className: 'w-40',
    },
    {
      key: 'month',
      header: 'الشهر',
      cell: (l) => {
        const m = l.month_id ? months.get(l.month_id) : null;
        return <span className="text-[13px] text-muted whitespace-nowrap">{m ? monthTitle(m.hijri_year, m.hijri_month) : '—'}</span>;
      },
      className: 'w-36',
    },
    { key: 'actor', header: 'بواسطة', cell: (l) => <span className="text-[13px] text-muted whitespace-nowrap">{actorOf(l)}</span>, className: 'w-36' },
  ];
  const table = useTable(rows, columns, { pageSize: 20, initialSort: { key: 'time', dir: 'desc' } });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of data.log) c[kindOf(l.action)] = (c[kindOf(l.action)] ?? 0) + 1;
    return c;
  }, [data.log]);

  return (
    <>
      <PageTitle title="سجل العمليات" subtitle={`آخر ${data.log.length} عملية: التكليفات والجداول والبيانات والإعدادات`} />
      <FilterBar>
        <Search value={q} onChange={(v) => { setQ(v); table.setPage(1); }} placeholder="ابحث في السجل…" />
        <FilterSelect
          label="النوع"
          value={kind}
          onChange={(v) => { setKind(v); table.setPage(1); }}
          options={[{ value: 'all', label: 'الكل' }, ...(Object.keys(KIND_LABEL) as LogKind[]).map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${counts[k] ?? 0})` }))]}
        />
        <FilterSelect
          label="الشهر"
          value={monthId}
          onChange={(v) => { setMonthId(v); table.setPage(1); }}
          options={[{ value: 'all', label: 'كل الشهور' }, ...sortMonths(data.months).reverse().map((m) => ({ value: String(m.id), label: monthTitle(m.hijri_year, m.hijri_month) }))]}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        table={table}
        rowKey={(l) => l.id}
        minWidth={900}
        empty={<Empty title={data.log.length ? 'مفيش عمليات بالفلتر ده' : 'لسه مفيش عمليات مسجلة'} icon={History}>العمليات بتتسجل تلقائي: الإضافة والتعديل والمسح، والتوزيع والنشر، والتأكيد والاعتذار.</Empty>}
        card={(l) => {
          const k = kindOf(l.action);
          const Icon = KIND_ICON[k];
          return (
            <div className="px-4 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Tag tone={KIND_TONE[k]}><Icon className="w-3.5 h-3.5" />{actionLabel(l.action)}</Tag>
                <span className="tabular text-[12px] text-muted">{formatDateTime(l.created_at)}</span>
              </div>
              <div className="text-sm"><Details text={l.details} /></div>
              <div className="text-[12px] text-muted">
                {l.preacher_id && preachers.get(l.preacher_id) ? `${preachers.get(l.preacher_id)!.name} · ` : ''}
                {actorOf(l)}
              </div>
            </div>
          );
        }}
      />
      <p className="text-[12px] text-muted mt-4">العمليات اللي حصلت قبل التحديث ده متسجل منها التكليفات والتوزيع والنشر بس.</p>
    </>
  );
}
