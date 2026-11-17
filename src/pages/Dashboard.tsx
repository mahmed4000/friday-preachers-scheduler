import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BellRing, CalendarCheck, CalendarDays, CalendarPlus, CheckCircle2, ClipboardList, History, Info,
  Landmark, Mail, MailWarning, Percent, Send, UserPlus, Users, Wand2,
} from 'lucide-react';
import { useStore } from '../data/store.tsx';
import { Button, Card, Empty, Progress, Select, Stat, StatusPill, Tag, clsx, Star8Outline } from '../ui/kit.tsx';
import { byId, currentMonth, fridaysOf, monthAssignments, nextFriday, sortMonths } from '../data/selectors.ts';
import { monthStats, opsAlerts, scheduleStage, type OpsAlert, type ScheduleStage } from '../data/alerts.ts';
import { actionLabel } from '../data/audit.ts';
import { diffDays, fridayOrdinal, gregLong, gregShort, hijriShort, monthName, monthTitle, todayIso, umalqura } from '../lib/hijri.ts';
import { navigate } from '../lib/router.ts';

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'دلوقتي';
  if (mins < 60) return `من ${mins} دقيقة`;
  const h = Math.round(mins / 60);
  if (h < 24) return `من ${h} ساعة`;
  return `من ${Math.round(h / 24)} يوم`;
}

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

/** قوس محراب فيه اليوم الهجري */
function MihrabDate({ day, month, year }: { day: number; month: number; year: number }) {
  return (
    <div className="relative w-[118px] h-[138px] shrink-0 hidden sm:block" aria-hidden="true">
      <svg viewBox="0 0 118 138" className="absolute inset-0 w-full h-full">
        <path d="M6 136V58C6 28 30 6 59 2c29 4 53 26 53 56v78" fill="rgba(215,181,109,0.08)" stroke="#d7b56d" strokeWidth="1.4" />
        <path d="M14 136V60C14 35 34 16 59 11c25 5 45 24 45 49v76" fill="none" stroke="#b58a36" strokeWidth="0.8" strokeDasharray="2 3" />
      </svg>
      <div className="absolute inset-x-0 top-[44px] text-center">
        <div className="font-num text-[40px] font-bold text-gold-200 leading-none tabular">{day}</div>
        <div className="font-display text-[17px] text-gold-300 mt-1.5 leading-tight">{monthName(month)}</div>
        <div className="text-[11px] text-brown-100/60 tabular mt-0.5">{year} هـ</div>
      </div>
    </div>
  );
}

const STAGE: Record<ScheduleStage, { label: string; tone: 'sand' | 'wait' | 'gold' | 'ok'; desc: string; cta: string; icon: typeof Wand2 }> = {
  empty: { label: 'مسودة · لسه ما اتوزعش', tone: 'sand', desc: 'اعمل التوزيع التلقائي، وبعدين راجع وعدّل يدوي.', cta: 'وزّع الخطباء', icon: Wand2 },
  incomplete: { label: 'مسودة · ناقص', tone: 'wait', desc: 'فيه أماكن من غير خطيب. املاها قبل النشر.', cta: 'استكمل الجدول', icon: ClipboardList },
  ready: { label: 'مسودة · جاهز للنشر', tone: 'gold', desc: 'كل الأماكن متغطية. راجع الجدول وانشره علشان الخطباء يشوفوه.', cta: 'راجع وانشر', icon: Send },
  published: { label: 'منشور', tone: 'ok', desc: 'الجدول ظاهر للخطباء في صفحاتهم. تابع التأكيدات والاعتذارات.', cta: 'افتح الجدول', icon: CalendarCheck },
};

const ALERT_STYLE: Record<OpsAlert['level'], { box: string; icon: typeof AlertTriangle; iconCls: string; label: string }> = {
  critical: { box: 'border-bad/25 bg-bad-soft/50 hover:bg-bad-soft', icon: AlertTriangle, iconCls: 'text-bad', label: 'عاجل' },
  warning: { box: 'border-wait/25 bg-wait-soft/50 hover:bg-wait-soft', icon: AlertTriangle, iconCls: 'text-wait', label: 'تنبيه' },
  info: { box: 'border-border bg-paper hover:bg-brown-50', icon: Info, iconCls: 'text-brown-700', label: 'للمتابعة' },
};

export function Dashboard() {
  const { data } = useStore();
  const today = todayIso();
  const h = umalqura(today);
  const months = sortMonths(data.months);
  const [monthId, setMonthId] = useState<number | null>(() => currentMonth(data.months)?.id ?? null);
  const month = months.find((m) => m.id === monthId) ?? currentMonth(data.months);
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);
  const alerts = useMemo(() => opsAlerts(data, today), [data, today]);
  const stats = useMemo(() => (month ? monthStats(data, month) : null), [data, month]);
  const next = nextFriday(data.months, today);
  const activeMosques = data.mosques.filter((m) => m.is_active).length;
  const activePreachers = data.preachers.filter((p) => p.is_active).length;

  const quick = [
    { label: 'إضافة خطيب', icon: UserPlus, href: '/preachers?new=1' },
    { label: 'إضافة مسجد', icon: Landmark, href: '/mosques?new=1' },
    { label: 'إنشاء جدول شهر', icon: CalendarPlus, href: '/schedule?new=1' },
    { label: 'توزيع الخطباء', icon: Wand2, href: month ? `/schedule?month=${month.id}` : '/schedule' },
    { label: 'إرسال تذكيرات', icon: BellRing, href: '/messages?tab=reminder' },
  ];

  const hero = (
    <section className="relative overflow-hidden rounded-[18px] bg-brown-950 text-white mb-6 shadow-[var(--shadow-raised)]">
      {/* الزخرفة في الطرف بس، بعيد عن النص */}
      <div className="absolute inset-y-0 left-0 w-[45%] pattern-girih opacity-[0.10] [mask-image:linear-gradient(to_right,black_20%,transparent)] pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 border-band opacity-50" aria-hidden="true" />
      <div className="relative flex items-center gap-6 px-5 sm:px-8 py-6 sm:py-7">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <img src="/aljameya-logo.png" alt="شعار الجمعية" className="w-12 h-12 rounded-full bg-paper p-0.5 ring-1 ring-gold-400/70 object-contain" />
            <div className="min-w-0">
              <div className="font-display text-[20px] sm:text-[22px] text-gold-200 leading-tight truncate">{data.settings.org_name || 'الجمعية الشرعية'}</div>
              <div className="text-[12.5px] text-brown-100/65 truncate">{data.settings.branch_name ? `${data.settings.branch_name} · ` : ''}منظومة إدارة خطباء الجمعة</div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-4">
            {/* صورة مسؤول الجدول جنب الترحيب */}
            <img
              src="/admin-photo.jpg"
              alt={data.settings.admin_name ? `م. ${data.settings.admin_name}` : 'مسؤول الدعوة'}
              className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 rounded-full object-cover ring-2 ring-gold-400 ring-offset-2 ring-offset-brown-950 shadow-lg"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-[26px] font-semibold leading-snug">
                {greeting()}{data.settings.admin_name ? `، م. ${data.settings.admin_name}` : ''}
              </h1>
              <div className="text-[13px] text-gold-300/90">مسؤول جدول خطباء الجمعة</div>
            </div>
          </div>
          <p className="text-brown-100/75 text-sm mt-3">
            {gregLong(today)}
            {next && (
              <>
                {' · '}
                الجمعة الجاية {diffDays(next.friday.date, today) === 0 ? 'النهارده' : diffDays(next.friday.date, today) === 1 ? 'بكرة' : `بعد ${diffDays(next.friday.date, today)} أيام`}
              </>
            )}
          </p>
          {months.length > 0 && month && (
            <label className="mt-4 inline-flex items-center gap-2 text-[13px] text-brown-100/75">
              الشهر الإداري
              <Select
                value={month.id}
                onChange={(e) => setMonthId(Number(e.target.value))}
                className="!w-auto !h-10 min-w-[180px] !bg-white/[0.08] !border-gold-500/30 !text-white font-medium [&>option]:text-ink"
              >
                {months.map((m) => <option key={m.id} value={m.id}>{monthTitle(m.hijri_year, m.hijri_month)}</option>)}
              </Select>
            </label>
          )}
        </div>
        <MihrabDate day={h.day} month={h.month} year={h.year} />
      </div>
    </section>
  );

  const quickActions = (
    <Card title="إجراءات سريعة">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
        {quick.map((q) => (
          <a
            key={q.label}
            href={q.href}
            onClick={(e) => { e.preventDefault(); navigate(q.href); }}
            className="group flex flex-col items-center justify-center gap-2 h-[92px] rounded-xl border border-border bg-paper hover:border-gold-400 hover:bg-gold-200/30 transition-colors text-center px-2"
          >
            <span className="w-10 h-10 rounded-[10px] bg-brown-800 text-gold-300 inline-flex items-center justify-center group-hover:bg-brown-900">
              <q.icon className="w-[18px] h-[18px]" />
            </span>
            <span className="text-[13px] font-medium text-ink leading-tight">{q.label}</span>
          </a>
        ))}
      </div>
    </Card>
  );

  if (!month || !stats) {
    return (
      <>
        {hero}
        <Card className="mb-5">
          <Empty
            title="ابدأ بأول جدول شهر"
            icon={CalendarPlus}
            action={<Button onClick={() => navigate('/schedule?new=1')}><CalendarPlus className="w-4 h-4" />إنشاء جدول الشهر</Button>}
          >
            {activeMosques === 0 || activePreachers === 0
              ? 'ضيف المساجد والخطباء، وبعدين اعمل الشهر والبرنامج يوزّع.'
              : `عندك ${activeMosques} مسجد و${activePreachers} خطيب. اعمل الشهر والبرنامج يوزّع الخطباء في ثواني.`}
          </Empty>
        </Card>
        {quickActions}
      </>
    );
  }

  const stage = scheduleStage(stats);
  const st = STAGE[stage];
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const fr = fridaysOf(month);

  const nextRows = next
    ? monthAssignments(data, next.month.id)
        .filter((a) => a.friday_index === next.friday.index)
        .sort((x, y) => (mosques.get(x.mosque_id)?.name ?? '').localeCompare(mosques.get(y.mosque_id)?.name ?? '', 'ar'))
    : [];
  const nextConfirmed = nextRows.filter((a) => a.preacher_id && a.status === 'confirmed').length;
  const nextLive = nextRows.filter((a) => a.preacher_id && a.status !== 'excused').length;

  return (
    <>
      {hero}

      {/* المؤشرات */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <Stat icon={Landmark} label="المساجد النشطة" value={activeMosques} hint={`${stats.mosquesNeeded} محتاجين خطيب الشهر ده`} onClick={() => navigate('/mosques')} />
        <Stat icon={Users} label="الخطباء النشطين" value={activePreachers} hint={`من ${data.preachers.length} مسجلين`} onClick={() => navigate('/preachers')} />
        <Stat icon={CalendarDays} label="تكليفات الشهر" value={<>{stats.filled}<span className="text-[16px] text-muted font-medium"> / {stats.total}</span></>} hint={`${stats.confirmed} مؤكد · ${stats.pending} منتظر`} onClick={() => navigate(`/schedule?month=${month.id}`)} />
        <Stat icon={Percent} label="اكتمال التوزيع" value={`${stats.pct}%`} progress={stats.pct} tone={stats.pct >= 100 ? 'ok' : 'gold'} />
        <Stat icon={Mail} label="رسائل الجدول المرسلة" value={stats.notified} hint={month.status === 'published' ? `من ${stats.filled} تكليف` : 'بعد النشر'} tone="ok" onClick={() => navigate(`/messages?month=${month.id}`)} />
        <Stat
          icon={MailWarning}
          label="محتاجة معالجة"
          value={stats.excused + (month.status === 'published' ? stats.notNotified : 0)}
          hint={`${stats.excused} اعتذار${month.status === 'published' ? ` · ${stats.notNotified} ما اتبعتش` : ''}`}
          tone={stats.excused ? 'bad' : stats.notNotified && month.status === 'published' ? 'wait' : 'brown'}
          onClick={() => navigate(stats.excused ? `/schedule?month=${month.id}` : `/messages?month=${month.id}`)}
        />
      </div>

      <div className="grid xl:grid-cols-3 gap-4 mb-4">
        {/* حالة الجدول */}
        <Card title={`جدول ${title}`} subtitle={`${gregShort(month.start_date)} — ${fr.length} جمعات`} action={<Tag tone={st.tone}>{st.label}</Tag>}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12.5px] text-muted">نسبة اكتمال التوزيع</div>
              <div className="font-num text-[34px] font-bold text-brown-900 tabular leading-tight">{stats.pct}%</div>
            </div>
            <Star8Outline className="w-12 h-12 text-gold-400/70" />
          </div>
          <Progress value={stats.pct} tone={stats.pct >= 100 ? 'ok' : 'gold'} className="mt-2 h-2.5" label="اكتمال التوزيع" />
          <dl className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="rounded-lg bg-paper border border-border py-2">
              <dt className="text-[11.5px] text-muted">مساجد متغطية</dt>
              <dd className="font-num font-bold text-ok tabular text-lg">{stats.mosquesCovered}</dd>
            </div>
            <div className="rounded-lg bg-paper border border-border py-2">
              <dt className="text-[11.5px] text-muted">مش متغطية</dt>
              <dd className={clsx('font-num font-bold tabular text-lg', stats.mosquesUncovered ? 'text-wait' : 'text-muted')}>{stats.mosquesUncovered}</dd>
            </div>
            <div className="rounded-lg bg-paper border border-border py-2">
              <dt className="text-[11.5px] text-muted">أماكن فاضية</dt>
              <dd className={clsx('font-num font-bold tabular text-lg', stats.total - stats.filled ? 'text-wait' : 'text-muted')}>{Math.max(0, stats.total - stats.filled)}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted mt-4">{st.desc}</p>
          <Button className="w-full mt-3" variant={stage === 'published' ? 'outline' : 'primary'} onClick={() => navigate(`/schedule?month=${month.id}`)}>
            <st.icon className="w-4 h-4" />
            {st.cta}
          </Button>
        </Card>

        {/* الجمعة الجاية */}
        <Card
          className="xl:col-span-2"
          title={next ? `${fridayOrdinal(next.friday.index)} · ${hijriShort(next.friday.hijriDay, next.month.hijri_month)}` : 'الجمعة الجاية'}
          subtitle={next ? `${gregLong(next.friday.date)}${nextLive ? ` · ${nextConfirmed} من ${nextLive} أكدوا` : ''}` : undefined}
          action={next && <Button size="sm" variant="outline" onClick={() => navigate('/messages?tab=reminder')}><BellRing className="w-4 h-4" />تذكير الخميس</Button>}
          bodyClassName="p-0"
        >
          {!next ? (
            <p className="text-muted text-sm p-5">مفيش جمعات جاية في الشهور الموجودة.</p>
          ) : nextRows.length === 0 ? (
            <Empty title="الجمعة دي لسه ما اتوزعتش" action={<Button size="sm" onClick={() => navigate(`/schedule?month=${next.month.id}`)}>افتح الجدول</Button>} />
          ) : (
            <div className="max-h-[380px] overflow-y-auto scroll-soft" tabIndex={0} role="region" aria-label="خطباء الجمعة الجاية">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-brown-50 z-[1]">
                  <tr className="text-right text-[12px] text-muted border-b border-border">
                    <th className="px-4 h-10 font-semibold">المسجد</th>
                    <th className="px-3 h-10 font-semibold">الخطيب</th>
                    <th className="px-3 h-10 font-semibold hidden sm:table-cell">التكليف</th>
                    <th className="px-3 h-10 font-semibold">التأكيد</th>
                  </tr>
                </thead>
                <tbody>
                  {nextRows.map((a) => {
                    const p = a.preacher_id ? preachers.get(a.preacher_id) : null;
                    return (
                      <tr key={a.id} className="border-t border-border first:border-t-0 hover:bg-brown-50/60">
                        <td className="px-4 py-2.5 font-medium text-ink">{mosques.get(a.mosque_id)?.name}</td>
                        <td className={clsx('px-3 py-2.5', a.status === 'excused' ? 'text-bad line-through' : 'text-ink')}>{p?.name ?? <span className="text-wait">من غير خطيب</span>}</td>
                        <td className="px-3 py-2.5 hidden sm:table-cell">
                          <Tag>{a.source === 'fixed' ? 'ثابت' : a.source === 'manual' ? 'يدوي' : 'تلقائي'}</Tag>
                        </td>
                        <td className="px-3 py-2.5">{p ? <StatusPill status={a.status} /> : <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mb-4">{quickActions}</div>

      <div className="grid xl:grid-cols-5 gap-4">
        {/* التنبيهات */}
        <Card className="xl:col-span-3" title="التنبيهات التشغيلية" subtitle="محسوبة من الجداول والتكليفات الحالية" action={alerts.length > 0 && <Tag tone={alerts.some((a) => a.level === 'critical') ? 'bad' : 'wait'}>{alerts.length}</Tag>}>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 text-sm text-ok bg-ok-soft rounded-xl p-4">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              مفيش حاجة محتاجة متابعة دلوقتي.
            </div>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => {
                const s = ALERT_STYLE[a.level];
                return (
                  <li key={a.id}>
                    <a href={a.href} onClick={(e) => { e.preventDefault(); navigate(a.href); }} className={clsx('flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors', s.box)}>
                      <span className="w-9 h-9 rounded-full bg-card flex items-center justify-center shrink-0 border border-border">
                        <s.icon className={clsx('w-[18px] h-[18px]', s.iconCls)} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="sr-only">{s.label}: </span>
                          <b className="text-[14px] font-semibold text-ink">{a.title}</b>
                        </span>
                        <span className="block text-[12.5px] text-muted truncate">{a.detail}</span>
                      </span>
                      <span className="text-[13px] font-semibold text-brown-800 inline-flex items-center gap-1 shrink-0">
                        <span className="hidden sm:inline">{a.action}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* آخر العمليات */}
        <Card
          className="xl:col-span-2"
          title="آخر العمليات"
          action={<Button size="sm" variant="ghost" onClick={() => navigate('/log')}><History className="w-4 h-4" />السجل كامل</Button>}
        >
          {data.log.length === 0 ? (
            <p className="text-muted text-sm">لسه مفيش عمليات. التأكيدات والاعتذارات والتعديلات هتظهر هنا.</p>
          ) : (
            <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:right-[15px] before:w-px before:bg-border">
              {data.log.slice(0, 7).map((l) => {
                const tone = l.action === 'excuse' ? 'text-bad' : l.action === 'confirm' ? 'text-ok' : 'text-gold-600';
                return (
                  <li key={l.id} className="relative flex gap-3 text-sm">
                    <span className={clsx('relative z-[1] w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shrink-0', tone)}>
                      <span className="w-2 h-2 rotate-45 bg-current" />
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium text-ink">{actionLabel(l.action)}</span>
                      {l.preacher_id && preachers.get(l.preacher_id) && <span className="text-muted"> · {preachers.get(l.preacher_id)!.name}</span>}
                      <span className="block text-muted text-[12.5px] truncate">{l.details}</span>
                      <span className="block text-[11px] text-muted/80">{timeAgo(l.created_at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
