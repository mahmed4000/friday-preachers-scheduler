import { useMemo, useState } from 'react';
import { BellRing, Check, Copy, FileDown, FileText, Landmark, Loader2, MessageCircle, PhoneOff, Users } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Assignment, Month } from '../data/types.ts';
import { Button, Card, Empty, Modal, PageTitle, Select, StatusPill, Tag, clsx } from '../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, nextFriday, sortMonths } from '../data/selectors.ts';
import { diffDays, fridayOrdinal, gregLong, gregShort, hijriShort, monthTitle, todayIso } from '../lib/hijri.ts';
import { isValidPhone, portalUrl, waLink } from '../lib/whatsapp.ts';
import { monthMessage, mosqueMessage, reminderMessage } from '../lib/messages.ts';
import { queryParam } from '../lib/router.ts';
import { canShareFiles, downloadAndOpenChat, downloadBlob, mosquePdf, preacherPdf, shareFile, type PdfFile } from '../lib/schedulePdf.ts';

/** زرار PDF: على الموبايل بيفتح المشاركة بالملف (واتساب)، وعلى الكمبيوتر بينزّله ويفتح المحادثة */
function PdfButton({ build, phone, onSent }: { build: () => Promise<PdfFile>; phone: string; onSent?: () => void }) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<PdfFile | null>(null);

  const go = async () => {
    const mobile = canShareFiles();
    // لازم نفتح النافذة قبل أي انتظار، وإلا المتصفح بيمنعها
    const win = !mobile && phone ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    try {
      const file = await build();
      if (mobile) {
        const r = await shareFile(file);
        if (r === 'shared') onSent?.();
        if (r === 'needs-tap') setReady(file);
      } else if (phone) {
        downloadAndOpenChat(file, phone, win);
        onSent?.();
        toast('الملف اتنزل. اسحبه جوه محادثة الواتساب اللي اتفتحت.');
      } else {
        downloadBlob(file.blob, file.filename);
        toast('اتنزل ملف الـ PDF');
      }
    } catch (e) {
      win?.close();
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        title="ملف PDF بالجدول، يتبعت على واتساب"
        className="inline-flex items-center gap-1.5 rounded-[10px] h-8 px-3 text-[13px] font-medium border bg-white text-brown-800 border-sand-dark hover:bg-brown-50 disabled:opacity-60 cursor-pointer"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        PDF
      </button>
      {ready && (
        <Modal open title="الملف جاهز" onClose={() => setReady(null)}>
          <p className="text-sm text-muted mb-4">{ready.filename}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                const r = await shareFile(ready).catch(() => 'cancelled' as const);
                if (r === 'shared') onSent?.();
                if (r !== 'needs-tap') setReady(null);
              }}
            >
              <MessageCircle className="w-4 h-4" />
              ابعته على واتساب
            </Button>
            <Button variant="outline" onClick={() => { downloadBlob(ready.blob, ready.filename); setReady(null); }}>
              <FileDown className="w-4 h-4" />
              تنزيل
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

type Tab = 'month' | 'reminder' | 'mosques';

function Row({
  title,
  subtitle,
  phone,
  text,
  sent,
  onSent,
  extra,
  pdf,
}: {
  title: string;
  subtitle: React.ReactNode;
  phone: string;
  text: string;
  sent: boolean;
  onSent?: () => void;
  extra?: React.ReactNode;
  pdf?: () => Promise<PdfFile>;
}) {
  const { toast } = useStore();
  const hasPhone = phone && isValidPhone(phone);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast('اتنسخت الرسالة');
    } catch {
      toast('ما قدرتش أنسخ', 'error');
    }
  };
  return (
    <li className={clsx('flex flex-wrap items-center gap-3 px-4 py-3', sent && 'bg-ok-soft/40')}>
      <div className="flex-1 min-w-[200px]">
        <div className="font-medium text-ink flex items-center gap-2 flex-wrap">
          {title}
          {sent && <Tag><Check className="w-3 h-3 text-ok" />اتبعت</Tag>}
          {extra}
        </div>
        <div className="text-[13px] text-muted mt-0.5">{subtitle}</div>
      </div>
      <div className="flex gap-1.5">
        {pdf && <PdfButton build={pdf} phone={hasPhone ? phone : ''} onSent={onSent} />}
        <Button size="sm" variant="ghost" onClick={copy} title="نسخ نص الرسالة">
          <Copy className="w-4 h-4" />
        </Button>
        {hasPhone ? (
          <a
            href={waLink(phone, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onSent?.()}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-[10px] h-8 px-3 text-[13px] font-medium border',
              sent ? 'bg-paper text-brown-700 border-sand-dark' : 'bg-[#1f7a4d] text-white border-[#17603c] hover:bg-[#1a6942]'
            )}
          >
            <MessageCircle className="w-4 h-4" />
            {sent ? 'ابعت تاني' : 'واتساب'}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-[12px] text-bad px-2"><PhoneOff className="w-4 h-4" />مفيش رقم</span>
        )}
      </div>
    </li>
  );
}

export function MessagesPage() {
  const { data, actions } = useStore();
  const months = sortMonths(data.months);
  const requested = Number(queryParam('month'));
  const [monthId, setMonthId] = useState<number | null>(() => (months.some((m) => m.id === requested) ? requested : currentMonth(months)?.id ?? null));
  const [tab, setTab] = useState<Tab>((queryParam('tab') as Tab) || 'month');
  const month = months.find((m) => m.id === monthId) ?? null;
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);
  const org = data.settings.org_name;

  const markSent = (rows: Assignment[], field: 'notified_at' | 'reminded_at') => {
    const now = new Date().toISOString();
    actions.upsertAssignments(rows.map(({ id: _id, ...r }) => ({ ...r, [field]: now })));
  };

  const tabs: { value: Tab; label: string; icon: typeof Users }[] = [
    { value: 'month', label: 'جدول الشهر للخطباء', icon: Users },
    { value: 'reminder', label: 'تذكير الخميس', icon: BellRing },
    { value: 'mosques', label: 'جداول المساجد', icon: Landmark },
  ];

  const byPreacher = useMemo(() => {
    if (!month) return [];
    const f = fridaysOf(month);
    const groups = new Map<number, Assignment[]>();
    for (const a of monthAssignments(data, month.id)) {
      if (!a.preacher_id || a.status === 'excused') continue;
      groups.set(a.preacher_id, [...(groups.get(a.preacher_id) ?? []), a]);
    }
    return [...groups.entries()]
      .map(([pid, rows]) => ({
        preacher: preachers.get(pid)!,
        rows: rows.sort((x, y) => x.friday_index - y.friday_index),
        items: rows
          .sort((x, y) => x.friday_index - y.friday_index)
          .map((a) => {
            const fr = f.find((x) => x.index === a.friday_index)!;
            return { fridayIndex: a.friday_index, date: fr.date, hijriDay: fr.hijriDay, mosqueName: mosques.get(a.mosque_id)?.name ?? '' };
          }),
      }))
      .filter((g) => g.preacher)
      .sort((a, b) => a.preacher.name.localeCompare(b.preacher.name, 'ar'));
  }, [data, month, preachers, mosques]);

  const content = () => {
    if (tab === 'reminder') {
      const next = nextFriday(data.months, todayIso());
      if (!next) return <Empty title="مفيش جمعة جاية في الجداول" />;
      const m: Month = next.month;
      const rows = monthAssignments(data, m.id).filter((a) => a.friday_index === next.friday.index && a.preacher_id && a.status !== 'excused');
      const days = diffDays(next.friday.date, todayIso());
      return (
        <>
          <div className="px-4 py-3 border-b border-sand bg-brown-100/50 text-sm">
            <b className="text-[15px] font-semibold text-ink">{fridayOrdinal(next.friday.index)} من {monthTitle(m.hijri_year, m.hijri_month)}</b>
            <span className="text-muted"> · {hijriShort(next.friday.hijriDay, m.hijri_month)} · {gregLong(next.friday.date)} · {days === 0 ? 'النهارده' : days === 1 ? 'بكرة' : `بعد ${days} أيام`}</span>
            {days > 1 && <div className="text-wait text-[13px] mt-1">التذكير بيتبعت يوم الخميس عادة.</div>}
          </div>
          {rows.length === 0 ? (
            <Empty title="الجمعة دي لسه ما اتوزعتش" />
          ) : (
            <ul className="divide-y divide-sand">
              {rows
                .sort((x, y) => (preachers.get(x.preacher_id!)?.name ?? '').localeCompare(preachers.get(y.preacher_id!)?.name ?? '', 'ar'))
                .map((a) => {
                  const p = preachers.get(a.preacher_id!)!;
                  const mosque = mosques.get(a.mosque_id)?.name ?? '';
                  const sentToday = Boolean(a.reminded_at && diffDays(next.friday.date, a.reminded_at.slice(0, 10)) <= 2);
                  return (
                    <Row
                      key={a.id}
                      title={p.name}
                      subtitle={mosque}
                      phone={p.phone}
                      text={reminderMessage(p.name, m, { fridayIndex: a.friday_index, date: next.friday.date, hijriDay: next.friday.hijriDay, mosqueName: mosque }, portalUrl(p.portal_token), org)}
                      sent={sentToday}
                      onSent={() => markSent([a], 'reminded_at')}
                      extra={<StatusPill status={a.status} />}
                    />
                  );
                })}
            </ul>
          )}
        </>
      );
    }

    if (!month) return <Empty title="لسه مفيش شهور" />;

    if (tab === 'mosques') {
      const f = fridaysOf(month);
      const list = data.mosques.filter((m) => m.is_active).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      return (
        <ul className="divide-y divide-sand">
          {list.map((m) => {
            const rows = monthAssignments(data, month.id)
              .filter((a) => a.mosque_id === m.id && a.preacher_id && a.status !== 'excused')
              .sort((x, y) => x.friday_index - y.friday_index)
              .map((a) => {
                const fr = f.find((x) => x.index === a.friday_index)!;
                const pr = preachers.get(a.preacher_id!);
                return { fridayIndex: a.friday_index, date: fr.date, hijriDay: fr.hijriDay, preacher: pr?.name ?? '', phone: pr?.phone ?? '' };
              });
            if (!rows.length) return null;
            return (
              <Row
                key={m.id}
                title={m.name}
                subtitle={rows.map((r) => `${gregShort(r.date)}: ${r.preacher}`).join(' · ')}
                phone={m.phone}
                text={mosqueMessage(m.name, month, rows, org)}
                sent={false}
                pdf={() => mosquePdf(data.settings, month, m.name, rows)}
              />
            );
          })}
        </ul>
      );
    }

    if (month.status !== 'published') {
      return (
        <Empty title="الجدول لسه مسودة">
          انشر الجدول من صفحة "جدول الشهر" الأول، علشان الخطيب لما يفتح رابطه يلاقي جمعاته ويقدر يأكد.
        </Empty>
      );
    }
    if (!byPreacher.length) return <Empty title="مفيش تكليفات في الشهر ده" />;
    const sentCount = byPreacher.filter((g) => g.rows.every((r) => r.notified_at)).length;
    return (
      <>
        <div className="px-4 py-2.5 border-b border-sand text-sm text-muted">
          اتبعت لـ <b className="text-brown-900 tabular">{sentCount}</b> من <span className="tabular">{byPreacher.length}</span> خطيب. كل رسالة فيها جمعات الخطيب ورابط يأكد منه أو يعتذر.
        </div>
        <ul className="divide-y divide-sand">
          {byPreacher.map((g) => (
            <Row
              key={g.preacher.id}
              title={g.preacher.name}
              subtitle={g.items.map((i) => `${fridayOrdinal(i.fridayIndex).replace('الجمعة ', '')}: ${i.mosqueName}`).join(' · ')}
              phone={g.preacher.phone}
              text={monthMessage(g.preacher.name, month, g.items, portalUrl(g.preacher.portal_token), org)}
              sent={g.rows.every((r) => r.notified_at)}
              onSent={() => markSent(g.rows, 'notified_at')}
              pdf={() => preacherPdf(data.settings, month, g.preacher.name, g.items, portalUrl(g.preacher.portal_token))}
            />
          ))}
        </ul>
      </>
    );
  };

  return (
    <>
      <PageTitle
        title="الإرسال والتذكير"
        subtitle="كل زرار بيفتح واتساب برسالة جاهزة، وانت تدوس إرسال"
        actions={
          tab !== 'reminder' &&
          month && (
            <Select value={month.id} onChange={(e) => setMonthId(Number(e.target.value))} className="!w-auto min-w-[190px] font-medium">
              {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
            </Select>
          )
        }
      />
      <div className="flex gap-1.5 mb-3 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              'shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border text-sm cursor-pointer transition-colors',
              tab === t.value ? 'bg-brown-800 border-brown-800 text-white font-medium' : 'bg-paper border-sand text-ink hover:bg-brown-50'
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden [&>div]:p-0">{content()}</Card>
    </>
  );
}
