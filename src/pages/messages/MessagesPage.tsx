import { useMemo, useState } from 'react';
import { BellRing, Check, History, Landmark, PenLine, Users } from 'lucide-react';
import { ComposeTab } from './ComposeTab.tsx';
import { SentLogTab } from './SentLogTab.tsx';
import { useStore } from '../../data/store.tsx';
import type { AppData, Assignment, Month } from '../../data/types.ts';
import { Card, Empty, PageTitle, Select, StatusPill, Tabs, Tag, clsx } from '../../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, nextFriday, sortMonths } from '../../data/selectors.ts';
import { diffDays, fridayOrdinal, gregLong, gregShort, hijriShort, monthTitle, todayIso } from '../../lib/hijri.ts';
import { portalUrl } from '../../lib/whatsapp.ts';
import { monthMessage, mosqueMessage, reminderMessage, type MosqueRow, type MsgItem } from '../../lib/messages.ts';
import { fridayPdf, mosquePdf, preacherPdf } from '../../lib/pdf/documents.ts';
import { queryParam } from '../../lib/router.ts';
import { SendActions } from '../../components/SendActions.tsx';

type Tab = 'month' | 'reminder' | 'mosques' | 'compose' | 'log';
type MarkSent = (rows: Assignment[], field: 'notified_at' | 'reminded_at') => void;

const byName = (a: string, b: string) => a.localeCompare(b, 'ar');

/** سطر في قايمة الإرسال: الاسم والتفاصيل وأزرار الإرسال */
function Row({ title, subtitle, sent, extra, children }: { title: string; subtitle: React.ReactNode; sent: boolean; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className={clsx('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', sent && 'bg-ok-soft/40')}>
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium text-ink flex items-center gap-2 flex-wrap">
          {title}
          {sent && <Tag><Check className="w-3 h-3 text-ok" />اتبعت</Tag>}
          {extra}
        </div>
        <div className="text-[13px] text-muted mt-0.5">{subtitle}</div>
      </div>
      {children}
    </li>
  );
}

function Summary({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-2.5 border-b border-sand text-sm text-muted">{children}</div>;
}

// ---------------------------------------------------------------------------
// جدول الشهر لكل خطيب
// ---------------------------------------------------------------------------
function MonthTab({ data, month, markSent }: { data: AppData; month: Month; markSent: MarkSent }) {
  const groups = useMemo(() => {
    const preachers = byId(data.preachers);
    const mosques = byId(data.mosques);
    const fridays = fridaysOf(month);
    const map = new Map<number, Assignment[]>();
    for (const a of monthAssignments(data, month.id)) {
      if (!a.preacher_id || a.status === 'excused') continue;
      map.set(a.preacher_id, [...(map.get(a.preacher_id) ?? []), a]);
    }
    return [...map.entries()]
      .map(([pid, rows]) => {
        rows.sort((x, y) => x.friday_index - y.friday_index);
        const items: MsgItem[] = rows.map((a) => {
          const fr = fridays.find((x) => x.index === a.friday_index)!;
          return { fridayIndex: a.friday_index, date: fr.date, hijriDay: fr.hijriDay, mosqueName: mosques.get(a.mosque_id)?.name ?? '' };
        });
        return { preacher: preachers.get(pid)!, rows, items };
      })
      .filter((g) => g.preacher)
      .sort((a, b) => byName(a.preacher.name, b.preacher.name));
  }, [data, month]);

  if (month.status !== 'published') {
    return (
      <Empty title="الجدول لسه مسودة">
        انشر الجدول من صفحة "جدول الشهر" الأول، علشان الخطيب لما يفتح رابطه يلاقي جمعاته ويقدر يأكد.
      </Empty>
    );
  }
  if (!groups.length) return <Empty title="مفيش تكليفات في الشهر ده" />;
  const sentCount = groups.filter((g) => g.rows.every((r) => r.notified_at)).length;

  return (
    <>
      <Summary>
        اتبعت لـ <b className="text-brown-900 tabular">{sentCount}</b> من <span className="tabular">{groups.length}</span> خطيب. كل رسالة فيها جمعات الخطيب وملف PDF بالجدول ورابط يأكد منه أو يعتذر.
      </Summary>
      <ul className="divide-y divide-sand">
        {groups.map(({ preacher: p, rows, items }) => {
          const link = portalUrl(p.portal_token);
          const sent = rows.every((r) => r.notified_at);
          return (
            <Row
              key={p.id}
              title={p.name}
              subtitle={items.map((i) => `${fridayOrdinal(i.fridayIndex).replace('الجمعة ', '')}: ${i.mosqueName}`).join(' · ')}
              sent={sent}
            >
              <SendActions
                phone={p.phone}
                sent={sent}
                message={(withPdf) => monthMessage(data.settings, p.name, month, items, link, { withPdf })}
                pdf={() => preacherPdf(data.settings, month, p.name, items, link)}
                onSent={() => markSent(rows, 'notified_at')}
              />
            </Row>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// تذكير الجمعة الجاية
// ---------------------------------------------------------------------------
function ReminderTab({ data, markSent }: { data: AppData; markSent: MarkSent }) {
  const today = todayIso();
  const next = nextFriday(data.months, today);
  if (!next) return <Empty title="مفيش جمعة جاية في الجداول" />;
  const { month: m, friday } = next;
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);
  const rows = monthAssignments(data, m.id)
    .filter((a) => a.friday_index === friday.index && a.preacher_id && a.status !== 'excused')
    .sort((x, y) => byName(preachers.get(x.preacher_id!)?.name ?? '', preachers.get(y.preacher_id!)?.name ?? ''));
  const days = diffDays(friday.date, today);
  // التذكير محسوب لو اتبعت في آخر يومين قبل الجمعة دي
  const reminded = (a: Assignment) => Boolean(a.reminded_at && diffDays(friday.date, a.reminded_at.slice(0, 10)) <= 2);
  const sentCount = rows.filter(reminded).length;

  return (
    <>
      <div className="px-4 py-3 border-b border-sand bg-brown-100/50 text-sm">
        <b className="text-[15px] font-semibold text-ink">{fridayOrdinal(friday.index)} من {monthTitle(m.hijri_year, m.hijri_month)}</b>
        <span className="text-muted"> · {hijriShort(friday.hijriDay, m.hijri_month)} · {gregLong(friday.date)} · {days === 0 ? 'النهارده' : days === 1 ? 'بكرة' : `بعد ${days} أيام`}</span>
        {rows.length > 0 && <div className="text-muted text-[13px] mt-1">اتفكّر <b className="text-brown-900 tabular">{sentCount}</b> من <span className="tabular">{rows.length}</span> خطيب.{days > 1 && <span className="text-wait"> التذكير بيتبعت يوم الخميس عادة.</span>}</div>}
      </div>
      {rows.length === 0 ? (
        <Empty title="الجمعة دي لسه ما اتوزعتش" />
      ) : (
        <ul className="divide-y divide-sand">
          {rows.map((a) => {
            const p = preachers.get(a.preacher_id!)!;
            const item: MsgItem = { fridayIndex: a.friday_index, date: friday.date, hijriDay: friday.hijriDay, mosqueName: mosques.get(a.mosque_id)?.name ?? '' };
            const link = portalUrl(p.portal_token);
            const sent = reminded(a);
            return (
              <Row key={a.id} title={p.name} subtitle={item.mosqueName} sent={sent} extra={<StatusPill status={a.status} />}>
                <SendActions
                  phone={p.phone}
                  sent={sent}
                  message={(withPdf) => reminderMessage(data.settings, p.name, m, item, link, today, { withPdf })}
                  pdf={() => fridayPdf('reminder', data.settings, m, p.name, item, link)}
                  onSent={() => markSent([a], 'reminded_at')}
                />
              </Row>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// جدول كل مسجد
// ---------------------------------------------------------------------------
const SENT_KEY = 'fs_mosque_sent';
function readSent(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || '{}');
  } catch {
    return {};
  }
}

function MosquesTab({ data, month }: { data: AppData; month: Month }) {
  // المساجد مالهاش عمود "اتبعت" في قاعدة البيانات، فبنفتكرها على الجهاز ده
  const [sentMap, setSentMap] = useState(readSent);
  const markSent = (key: string) => {
    const next = { ...readSent(), [key]: new Date().toISOString() };
    try {
      localStorage.setItem(SENT_KEY, JSON.stringify(next));
    } catch {
      // التخزين مش متاح: نكتفي بالحالة الحالية
    }
    setSentMap(next);
  };

  const preachers = byId(data.preachers);
  const fridays = fridaysOf(month);
  const list = data.mosques
    .filter((m) => m.is_active)
    .sort((a, b) => byName(a.name, b.name))
    .map((mosque) => {
      const rows: MosqueRow[] = monthAssignments(data, month.id)
        .filter((a) => a.mosque_id === mosque.id && a.preacher_id && a.status !== 'excused')
        .sort((x, y) => x.friday_index - y.friday_index)
        .map((a) => {
          const fr = fridays.find((x) => x.index === a.friday_index)!;
          const pr = preachers.get(a.preacher_id!);
          return { fridayIndex: a.friday_index, date: fr.date, hijriDay: fr.hijriDay, preacher: pr?.name ?? '', phone: pr?.phone ?? '' };
        });
      return { mosque, rows };
    })
    .filter((x) => x.rows.length);

  if (!list.length) return <Empty title="مفيش تكليفات في الشهر ده" />;
  const keyOf = (id: number) => `${month.id}:${id}`;
  const sentCount = list.filter((x) => sentMap[keyOf(x.mosque.id)]).length;

  return (
    <>
      <Summary>
        اتبعت لـ <b className="text-brown-900 tabular">{sentCount}</b> من <span className="tabular">{list.length}</span> مسجد. الملف فيه خطيب كل جمعة ورقمه، ومناسب للطباعة في لوحة المسجد.
      </Summary>
      <ul className="divide-y divide-sand">
        {list.map(({ mosque, rows }) => {
          const sent = Boolean(sentMap[keyOf(mosque.id)]);
          return (
            <Row key={mosque.id} title={mosque.name} subtitle={rows.map((r) => `${gregShort(r.date)}: ${r.preacher}`).join(' · ')} sent={sent}>
              <SendActions
                phone={mosque.phone}
                sent={sent}
                message={(withPdf) => mosqueMessage(data.settings, mosque.name, month, rows, { withPdf })}
                pdf={() => mosquePdf(data.settings, month, mosque.name, rows)}
                onSent={() => markSent(keyOf(mosque.id))}
              />
            </Row>
          );
        })}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// الصفحة
// ---------------------------------------------------------------------------
const TABS: { value: Tab; label: string; icon: typeof Users }[] = [
  { value: 'month', label: 'رسائل التكليف', icon: Users },
  { value: 'reminder', label: 'تذكير الخميس', icon: BellRing },
  { value: 'mosques', label: 'جداول المساجد', icon: Landmark },
  { value: 'compose', label: 'رسالة مخصصة', icon: PenLine },
  { value: 'log', label: 'سجل الإرسال', icon: History },
];

export function MessagesPage() {
  const { data, actions } = useStore();
  const months = sortMonths(data.months);
  const requested = Number(queryParam('month'));
  const [monthId, setMonthId] = useState<number | null>(() => (months.some((m) => m.id === requested) ? requested : currentMonth(months)?.id ?? null));
  const [tab, setTab] = useState<Tab>(() => {
    const t = queryParam('tab') as Tab;
    return TABS.some((x) => x.value === t) ? t : 'month';
  });
  const month = months.find((m) => m.id === monthId) ?? null;

  const markSent: MarkSent = (rows, field) => {
    const now = new Date().toISOString();
    actions.upsertAssignments(rows.map(({ id: _id, ...r }) => ({ ...r, [field]: now })));
    const mosques = byId(data.mosques);
    const pid = rows[0]?.preacher_id ?? null;
    actions.log(rows[0]?.month_id ?? null, pid, 'message_sent', `${field === 'reminded_at' ? 'تذكير الخميس' : 'تكليف / جدول الشهر'}: ${rows.map((r) => `${mosques.get(r.mosque_id)?.name ?? ''} (${fridayOrdinal(r.friday_index).replace('الجمعة ', '')})`).join('، ')}`);
  };

  const content = () => {
    if (tab === 'reminder') return <ReminderTab data={data} markSent={markSent} />;
    if (tab === 'log') return <SentLogTab data={data} />;
    if (tab === 'compose') return <ComposeTab data={data} month={month} />;
    if (!month) return <Empty title="لسه مفيش شهور" />;
    if (tab === 'mosques') return <MosquesTab data={data} month={month} />;
    return <MonthTab data={data} month={month} markSent={markSent} />;
  };

  return (
    <>
      <PageTitle
        title="مركز الإرسال"
        subtitle="رسائل التكليف والتذكير وجداول المساجد على واتساب مع ملف PDF، والرسائل المخصصة وسجل الإرسال"
        actions={
          tab !== 'reminder' && tab !== 'log' &&
          month && (
            <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto min-w-[190px] font-medium" aria-label="الشهر">
              {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
            </Select>
          )
        }
      />
      <div className="mb-3"><Tabs value={tab} onChange={setTab} tabs={TABS} /></div>
      <Card className="overflow-hidden [&>div]:p-0">{content()}</Card>
    </>
  );
}
