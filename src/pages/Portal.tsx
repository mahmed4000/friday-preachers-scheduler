import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, MessageCircle, UserX } from 'lucide-react';
import { createRepo } from '../data/store.tsx';
import type { PortalData, PortalItem } from '../data/repo.ts';
import { Button, Input, StatusPill, Star8, clsx } from '../ui/kit.tsx';
import { diffDays, fridayOrdinal, gregLong, hijriShort, todayIso } from '../lib/hijri.ts';
import { waLink } from '../lib/whatsapp.ts';

/** صفحة الخطيب: بيفتحها من الرابط الخاص بيه، من غير تسجيل دخول */
export function PortalPage({ token }: { token: string }) {
  const repo = useMemo(() => createRepo(), []);
  const [data, setData] = useState<PortalData | null | undefined>(undefined);
  const [error, setError] = useState('');
  const [excuseFor, setExcuseFor] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ item: PortalItem; status: 'confirmed' | 'excused'; reason: string } | null>(null);

  const load = () =>
    repo
      .portalGet(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    document.title = 'جمعاتي';
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (item: PortalItem, status: 'confirmed' | 'excused') => {
    setBusy(item.id);
    try {
      const why = status === 'excused' ? reason.trim() : '';
      const ok = await repo.portalSetStatus(token, item.id, status, why);
      if (!ok) throw new Error('ما اتسجلش. ممكن الجدول اتغير، حدّث الصفحة.');
      setNotice({ item, status, reason: why });
      setExcuseFor(null);
      setReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const today = todayIso();
  const upcoming = data?.items.filter((i) => diffDays(i.date, today) >= 0) ?? [];
  const past = data?.items.filter((i) => diffDays(i.date, today) < 0) ?? [];

  // السبب بييجي من الإشعار، لأن خانة السبب بتتفضى بعد التسجيل
  const adminMsg = (item: PortalItem, status: 'confirmed' | 'excused', reason: string) =>
    status === 'excused'
      ? `السلام عليكم، معذرة يا ${data?.admin_name ? `أ. ${data.admin_name}` : 'أستاذنا'}، أنا ${data?.preacher.name} ومعتذر عن ${fridayOrdinal(item.friday_index)} (${gregLong(item.date)}) في ${item.mosque_name}${reason ? `، والسبب: ${reason}` : ''}.`
      : `السلام عليكم، أنا ${data?.preacher.name}، أكدت خطبة ${fridayOrdinal(item.friday_index)} (${gregLong(item.date)}) في ${item.mosque_name} إن شاء الله.`;

  return (
    <div className="min-h-dvh bg-parchment">
      <header className="relative overflow-hidden bg-brown-900 text-gold-200 pt-[env(safe-area-inset-top)]">
        <div className="absolute inset-0 pattern-stars opacity-[0.09]" />
        <div className="relative max-w-lg mx-auto px-5 py-6 text-center">
          <img src="/aljameya-logo.png" alt="" className="w-16 h-16 mx-auto rounded-full ring-2 ring-gold-500 bg-paper object-contain p-1" />
          <div className="text-[13px] text-gold-400/90 mt-2">{data?.org_name ?? ''}</div>
          <h1 className="text-3xl mt-1">{data ? `فضيلة الشيخ ${data.preacher.name}` : 'جمعاتي'}</h1>
          <div className="ornament text-[10px] mt-2 max-w-[200px] mx-auto"><Star8 className="w-2.5 h-2.5" /></div>
        </div>
        <div className="h-[3px] bg-gradient-to-l from-gold-600 via-gold-400 to-gold-600" />
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {error && <div className="rounded-xl bg-bad-soft border border-bad/30 text-bad p-3 text-sm">{error}</div>}
        {data === undefined && !error && <p className="text-center text-muted py-10">جاري التحميل…</p>}
        {data === null && (
          <div className="text-center py-10">
            <Star8 className="w-8 h-8 text-gold-400 mx-auto mb-3" />
            <h2 className="text-xl text-brown-900">الرابط ده مش شغال</h2>
            <p className="text-sm text-muted mt-1">اطلب من مسؤول الدعوة يبعتلك الرابط تاني.</p>
          </div>
        )}

        {notice && data && (
          <div className={clsx('rounded-xl border p-4', notice.status === 'confirmed' ? 'bg-ok-soft border-ok/30' : 'bg-wait-soft border-wait/30')}>
            <div className="font-semibold">{notice.status === 'confirmed' ? 'جزاكم الله خيرًا، اتسجل تأكيدك ✓' : 'اتسجل اعتذارك، وهنرتب بديل إن شاء الله.'}</div>
            {data.admin_phone && (
              <a href={waLink(data.admin_phone, adminMsg(notice.item, notice.status, notice.reason))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-[#1f7a4d] underline">
                <MessageCircle className="w-4 h-4" />
                بلّغ مسؤول الدعوة على واتساب كمان
              </a>
            )}
          </div>
        )}

        {data && (
          <>
            <h2 className="text-xl text-brown-800 flex items-center gap-2"><CalendarCheck className="w-5 h-5 text-gold-600" />جمعاتك الجاية</h2>
            {upcoming.length === 0 && <p className="text-muted text-sm bg-paper border border-sand rounded-xl p-4">مفيش جمعات متسجلة لك الفترة الجاية.</p>}
            {upcoming.map((item) => {
              const days = diffDays(item.date, today);
              return (
                <article key={item.id} className={clsx('bg-paper border rounded-2xl overflow-hidden shadow-sm', item.status === 'excused' ? 'border-bad/30' : 'border-gold-400/60')}>
                  <div className="bg-brown-100/70 border-b border-sand px-4 py-2 flex items-center justify-between gap-2">
                    <span className="text-[15px] font-semibold text-brown-900">{fridayOrdinal(item.friday_index)}</span>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="p-4">
                    <div className="font-display text-xl font-bold text-brown-900">{item.mosque_name}</div>
                    <div className="text-sm text-muted mt-0.5 tabular">
                      {hijriShort(item.hijri_day, item.hijri_month)} {item.hijri_year} هـ · {gregLong(item.date)}
                      {days <= 1 && <b className="text-gold-700"> · {days === 0 ? 'النهارده' : 'بكرة'}</b>}
                    </div>
                    {item.status === 'excused' && item.excuse_reason && <div className="text-sm text-bad mt-2">سبب الاعتذار: {item.excuse_reason}</div>}

                    {item.status !== 'excused' && (
                      excuseFor === item.id ? (
                        <div className="mt-4 space-y-2">
                          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الاعتذار (اختياري)" autoFocus />
                          <div className="flex gap-2">
                            <Button variant="danger" className="flex-1" disabled={busy === item.id} onClick={() => act(item, 'excused')}>تأكيد الاعتذار</Button>
                            <Button variant="ghost" onClick={() => setExcuseFor(null)}>رجوع</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex gap-2">
                          {item.status !== 'confirmed' && (
                            <Button className="flex-1 !py-2.5" disabled={busy === item.id} onClick={() => act(item, 'confirmed')}>
                              <Check className="w-4 h-4" />
                              إن شاء الله، أكّد
                            </Button>
                          )}
                          <Button variant="outline" className={clsx('!py-2.5', item.status === 'confirmed' && 'flex-1')} onClick={() => setExcuseFor(item.id)}>
                            <UserX className="w-4 h-4" />
                            معتذر
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </article>
              );
            })}

            {past.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">جمعات فاتت ({past.length})</summary>
                <ul className="mt-2 space-y-1">
                  {past.map((i) => (
                    <li key={i.id} className="flex justify-between bg-paper border border-sand rounded-lg px-3 py-2">
                      <span>{i.mosque_name}</span>
                      <span className="text-muted tabular">{gregLong(i.date)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="text-center text-xs text-muted pt-4">الرابط ده خاص بفضيلتك، من فضلك ما تشاركوش.</p>
          </>
        )}
      </main>
    </div>
  );
}
