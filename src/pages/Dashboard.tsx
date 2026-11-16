import { AlertTriangle, BellRing, CalendarDays, CalendarPlus, CheckCircle2, Clock, History } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import { Button, Card, Empty, StatusPill, Star8, Stat, clsx } from '../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, nextFriday } from '../data/selectors.ts';
import { neededFridays } from '../lib/engine.ts';
import { diffDays, fridayOrdinal, gregLong, hijriShort, monthTitle, todayIso, umalqura, monthName } from '../lib/hijri.ts';
import { navigate } from '../lib/router.ts';

const ACTION_LABEL: Record<string, string> = {
  excuse: 'اعتذار',
  confirm: 'تأكيد',
  replace: 'تبديل',
  publish: 'نشر',
  distribute: 'توزيع',
};

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'دلوقتي';
  if (mins < 60) return `من ${mins} دقيقة`;
  const h = Math.round(mins / 60);
  if (h < 24) return `من ${h} ساعة`;
  const d = Math.round(h / 24);
  return `من ${d} يوم`;
}

export function Dashboard() {
  const { data } = useStore();
  const today = todayIso();
  const h = umalqura(today);
  const month = currentMonth(data.months);
  const next = nextFriday(data.months, today);
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);

  const header = (
    <div className="relative overflow-hidden rounded-2xl bg-brown-900 text-gold-200 px-5 sm:px-7 py-6 mb-5">
      <div className="absolute inset-0 pattern-stars opacity-[0.09]" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[13px] text-gold-400/90">السلام عليكم ورحمة الله{data.settings.admin_name ? `، أ. ${data.settings.admin_name}` : ''}</div>
          <h1 className="text-3xl sm:text-4xl text-gold-200 mt-1">{h.day} {monthName(h.month)} {h.year} هـ</h1>
          <div className="text-brown-100/80 text-sm mt-1">{gregLong(today)} · التاريخ الهجري تقريبي حسب أم القرى</div>
        </div>
        <Star8 className="w-14 h-14 text-gold-500/40 hidden sm:block" />
      </div>
    </div>
  );

  if (!month) {
    return (
      <>
        {header}
        <Card>
          <Empty title="ابدأ بأول شهر" action={<Button onClick={() => navigate('/schedule')}><CalendarPlus className="w-4 h-4" />اعمل جدول الشهر</Button>}>
            {data.mosques.length === 0 || data.preachers.length === 0
              ? 'ضيف المساجد والخطباء، وبعدين اعمل الشهر والبرنامج يوزّع.'
              : `عندك ${data.mosques.length} مسجد و${data.preachers.length} خطيب. اعمل الشهر والبرنامج يوزّع الخطباء في ثواني.`}
          </Empty>
        </Card>
      </>
    );
  }

  const fridays = fridaysOf(month);
  const idx = fridays.map((f) => f.index);
  const list = monthAssignments(data, month.id);
  const total = data.mosques.filter((m) => m.is_active).reduce((n, m) => n + neededFridays(m, idx).length, 0);
  const filled = list.filter((a) => a.preacher_id && a.status !== 'excused').length;
  const confirmed = list.filter((a) => a.preacher_id && a.status === 'confirmed').length;
  const excused = list.filter((a) => a.status === 'excused');
  const upcomingExcused = excused.filter((a) => {
    const f = fridays.find((x) => x.index === a.friday_index);
    return f && diffDays(f.date, today) >= 0;
  });

  const nextList = next ? monthAssignments(data, next.month.id).filter((a) => a.friday_index === next.friday.index && a.preacher_id) : [];
  const nextPending = nextList.filter((a) => a.status === 'pending').length;
  const daysToNext = next ? diffDays(next.friday.date, today) : null;

  return (
    <>
      {header}

      {/* تنبيهات */}
      {(upcomingExcused.length > 0 || (month.status === 'draft' && list.length === 0)) && (
        <div className="space-y-2 mb-5">
          {upcomingExcused.length > 0 && (
            <button onClick={() => navigate(`/schedule?month=${month.id}`)} className="w-full text-right flex items-center gap-3 rounded-xl border border-bad/40 bg-bad-soft px-4 py-3 cursor-pointer hover:border-bad">
              <AlertTriangle className="w-5 h-5 text-bad shrink-0" />
              <span className="flex-1">
                <b className="text-bad">{upcomingExcused.length} اعتذار محتاج بديل</b>
                <span className="block text-sm text-ink/80">
                  {upcomingExcused.slice(0, 3).map((a) => `${preachers.get(a.preacher_id!)?.name ?? ''} (${mosques.get(a.mosque_id)?.name ?? ''}، ${fridayOrdinal(a.friday_index)})`).join(' · ')}
                </span>
              </span>
              <span className="text-sm font-semibold text-bad">اختار بديل ←</span>
            </button>
          )}
          {month.status === 'draft' && list.length === 0 && (
            <button onClick={() => navigate(`/schedule?month=${month.id}`)} className="w-full text-right flex items-center gap-3 rounded-xl border border-gold-400 bg-gold-200/50 px-4 py-3 cursor-pointer">
              <CalendarDays className="w-5 h-5 text-gold-700 shrink-0" />
              <span className="flex-1"><b>شهر {monthTitle(month.hijri_year, month.hijri_month)} لسه ما اتوزعش.</b> دوس هنا ووزّع بضغطة.</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label={`المتغطي من ${monthTitle(month.hijri_year, month.hijri_month)}`} value={`${filled} / ${total}`} hint={total - filled > 0 ? `${total - filled} مكان فاضي` : 'كل الأماكن متغطية'} />
        <Stat label="أكدوا" value={confirmed} tone="ok" />
        <Stat label="في انتظار التأكيد" value={filled - confirmed} tone="wait" />
        <Stat label="اعتذارات الشهر" value={excused.length} tone={excused.length ? 'bad' : 'brown'} />
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Card
          className="lg:col-span-3"
          title={next ? `${fridayOrdinal(next.friday.index)}: ${hijriShort(next.friday.hijriDay, next.month.hijri_month)}` : 'الجمعة الجاية'}
          action={
            next && (
              <Button size="sm" variant={daysToNext !== null && daysToNext <= 1 ? 'gold' : 'outline'} onClick={() => navigate(`/messages?tab=reminder`)}>
                <BellRing className="w-4 h-4" />
                تذكير الخميس
              </Button>
            )
          }
        >
          {!next ? (
            <p className="text-muted text-sm">مفيش جمعات جاية في الشهور الموجودة.</p>
          ) : nextList.length === 0 ? (
            <p className="text-muted text-sm">الجمعة دي لسه ما اتوزعتش.</p>
          ) : (
            <>
              <div className="text-sm text-muted mb-3">
                {gregLong(next.friday.date)} · {daysToNext === 0 ? 'النهارده' : daysToNext === 1 ? 'بكرة' : `بعد ${daysToNext} أيام`}
                {nextPending > 0 && <span className="text-wait font-semibold"> · {nextPending} لسه ما أكدوش</span>}
              </div>
              <ul className="divide-y divide-sand">
                {nextList
                  .sort((x, y) => (mosques.get(x.mosque_id)?.name ?? '').localeCompare(mosques.get(y.mosque_id)?.name ?? '', 'ar'))
                  .map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-brown-900 truncate">{mosques.get(a.mosque_id)?.name}</span>
                        <span className={clsx('block text-sm truncate', a.status === 'excused' ? 'text-bad line-through' : 'text-muted')}>{preachers.get(a.preacher_id!)?.name}</span>
                      </span>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="lg:col-span-2" title="آخر التحديثات">
          {data.log.length === 0 ? (
            <p className="text-muted text-sm">لسه مفيش تحديثات. التأكيدات والاعتذارات من الخطباء هتظهر هنا.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.log.slice(0, 8).map((l) => {
                const Icon = l.action === 'excuse' ? AlertTriangle : l.action === 'confirm' ? CheckCircle2 : l.action === 'replace' ? History : Clock;
                const tone = l.action === 'excuse' ? 'text-bad' : l.action === 'confirm' ? 'text-ok' : 'text-gold-600';
                return (
                  <li key={l.id} className="flex gap-2.5 text-sm">
                    <Icon className={clsx('w-4 h-4 mt-1 shrink-0', tone)} />
                    <span className="min-w-0">
                      <span className="font-semibold text-brown-900">{ACTION_LABEL[l.action] ?? l.action}</span>
                      {l.preacher_id && preachers.get(l.preacher_id) && <span> · الشيخ {preachers.get(l.preacher_id)!.name}</span>}
                      <span className="block text-muted text-[13px] truncate">{l.details}</span>
                      <span className="block text-[11px] text-muted/80">{timeAgo(l.created_at)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
