// التنبيهات التشغيلية: محسوبة من البيانات الحقيقية بس (مفيش جدول إشعارات).
// بتظهر في جرس الهيدر وفي الرئيسية.
import type { AppData, Assignment, Month } from './types.ts';
import { byId, currentMonth, fridaysOf, monthAssignments, nextFriday } from './selectors.ts';
import { neededFridays } from '../lib/engine.ts';
import { diffDays, fridayOrdinal, monthTitle, todayIso } from '../lib/hijri.ts';
import { isValidPhone } from '../lib/whatsapp.ts';

export type AlertLevel = 'critical' | 'warning' | 'info';

export interface OpsAlert {
  id: string;
  level: AlertLevel;
  title: string;
  detail: string;
  /** المسار اللي يحل المشكلة */
  href: string;
  action: string;
}

export interface MonthStats {
  month: Month;
  /** الأماكن المطلوبة (مسجد × جمعة) */
  total: number;
  /** فيها خطيب ومش معتذر */
  filled: number;
  confirmed: number;
  pending: number;
  excused: number;
  /** نسبة اكتمال التوزيع */
  pct: number;
  mosquesCovered: number;
  mosquesUncovered: number;
  mosquesNeeded: number;
  /** رسائل جدول الشهر اللي اتبعتت (تكليفات فيها notified_at) */
  notified: number;
  notNotified: number;
  /** خطباء اتكلفوا ولسه ما اتبعتلهمش */
  preachersToNotify: number;
}

export function monthStats(data: AppData, month: Month): MonthStats {
  const idx = fridaysOf(month).map((f) => f.index);
  const list = monthAssignments(data, month.id);
  const active = data.mosques.filter((m) => m.is_active);
  const slot = (a: Assignment) => `${a.mosque_id}:${a.friday_index}`;
  const bySlot = new Map(list.map((a) => [slot(a), a]));
  let total = 0;
  let mosquesCovered = 0;
  let mosquesNeeded = 0;
  for (const m of active) {
    const need = neededFridays(m, idx);
    if (!need.length) continue;
    mosquesNeeded++;
    total += need.length;
    const full = need.every((f) => {
      const a = bySlot.get(`${m.id}:${f}`);
      return a?.preacher_id && a.status !== 'excused';
    });
    if (full) mosquesCovered++;
  }
  const live = list.filter((a) => a.preacher_id && a.status !== 'excused');
  const filled = live.length;
  const confirmed = live.filter((a) => a.status === 'confirmed').length;
  const notified = live.filter((a) => a.notified_at).length;
  const toNotify = new Set(live.filter((a) => !a.notified_at).map((a) => a.preacher_id));
  return {
    month,
    total,
    filled,
    confirmed,
    pending: filled - confirmed,
    excused: list.filter((a) => a.status === 'excused').length,
    pct: total ? Math.round((Math.min(filled, total) / total) * 100) : 0,
    mosquesCovered,
    mosquesUncovered: mosquesNeeded - mosquesCovered,
    mosquesNeeded,
    notified,
    notNotified: filled - notified,
    preachersToNotify: toNotify.size,
  };
}

/** حالة الجدول للعرض: مسودة لسه ما اتوزعتش / مسودة ناقصة / جاهز للنشر / منشور */
export type ScheduleStage = 'empty' | 'incomplete' | 'ready' | 'published';

export function scheduleStage(s: MonthStats): ScheduleStage {
  if (s.month.status === 'published') return 'published';
  if (s.filled === 0) return 'empty';
  return s.filled < s.total ? 'incomplete' : 'ready';
}

/** تعارضات التوزيع: نفس الخطيب في مسجدين في نفس الجمعة، أو متكلف في جمعة معتذر عنها، أو فوق حده، أو موقوف */
export function conflicts(data: AppData, month: Month): { a: Assignment; reason: string }[] {
  const list = monthAssignments(data, month.id).filter((a) => a.preacher_id && a.status !== 'excused');
  const preachers = byId(data.preachers);
  const out: { a: Assignment; reason: string }[] = [];
  const seen = new Map<string, number>();
  const load = new Map<number, number>();
  const unavailable = new Set(data.unavailable.filter((u) => u.month_id === month.id).map((u) => `${u.preacher_id}:${u.friday_index}`));
  for (const a of list) {
    const k = `${a.preacher_id}:${a.friday_index}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
    load.set(a.preacher_id!, (load.get(a.preacher_id!) ?? 0) + 1);
  }
  const fixedIds = new Set(data.fixed.map((f) => `${f.mosque_id}:${f.preacher_id}`));
  for (const a of list) {
    const p = preachers.get(a.preacher_id!);
    if (!p) continue;
    if ((seen.get(`${a.preacher_id}:${a.friday_index}`) ?? 0) > 1) out.push({ a, reason: 'متكلف في مسجدين في نفس الجمعة' });
    else if (unavailable.has(`${a.preacher_id}:${a.friday_index}`)) out.push({ a, reason: 'معتذر عن الجمعة دي ولسه متكلف' });
    else if (!p.is_active) out.push({ a, reason: 'الخطيب متوقف مؤقتًا' });
    else if ((load.get(p.id) ?? 0) > p.max_fridays && !fixedIds.has(`${a.mosque_id}:${p.id}`)) out.push({ a, reason: `عدّى حده (${p.max_fridays} جمعات)` });
  }
  return out;
}

export function opsAlerts(data: AppData, today = todayIso()): OpsAlert[] {
  const out: OpsAlert[] = [];
  const month = currentMonth(data.months, today);
  const preachers = byId(data.preachers);
  const mosques = byId(data.mosques);

  // اعتذارات في جمعات جاية محتاجة بديل (في كل الشهور)
  for (const m of data.months) {
    const fr = fridaysOf(m);
    const ex = monthAssignments(data, m.id).filter((a) => {
      const f = fr.find((x) => x.index === a.friday_index);
      return a.status === 'excused' && f && diffDays(f.date, today) >= 0;
    });
    if (ex.length) {
      out.push({
        id: `excused-${m.id}`,
        level: 'critical',
        title: `${ex.length} اعتذار محتاج بديل`,
        detail: ex
          .slice(0, 3)
          .map((a) => `${preachers.get(a.preacher_id ?? 0)?.name ?? 'خطيب'} · ${mosques.get(a.mosque_id)?.name ?? ''} · ${fridayOrdinal(a.friday_index)}`)
          .join('، '),
        href: `/schedule?month=${m.id}`,
        action: 'اختار بديل',
      });
    }
  }

  if (month) {
    const s = monthStats(data, month);
    const title = monthTitle(month.hijri_year, month.hijri_month);
    const firstFriday = fridaysOf(month)[0];
    const daysToFirst = firstFriday ? diffDays(firstFriday.date, today) : 99;

    // أماكن من غير خطيب في الجمعات الجاية
    const fr = fridaysOf(month).filter((f) => diffDays(f.date, today) >= 0).map((f) => f.index);
    const list = monthAssignments(data, month.id);
    let empty = 0;
    for (const mo of data.mosques.filter((x) => x.is_active)) {
      for (const f of neededFridays(mo, fridaysOf(month).map((x) => x.index))) {
        if (!fr.includes(f)) continue;
        const a = list.find((x) => x.mosque_id === mo.id && x.friday_index === f);
        if (!a?.preacher_id) empty++;
      }
    }
    if (s.filled > 0 && empty > 0) {
      out.push({ id: `empty-${month.id}`, level: 'warning', title: `${empty} مكان من غير خطيب`, detail: `في جمعات ${title} الجاية`, href: `/schedule?month=${month.id}`, action: 'املا الأماكن' });
    }

    const cf = conflicts(data, month);
    if (cf.length) {
      out.push({
        id: `conflict-${month.id}`,
        level: 'critical',
        title: `${cf.length} تعارض في التوزيع`,
        detail: cf.slice(0, 2).map((c) => `${preachers.get(c.a.preacher_id!)?.name}: ${c.reason}`).join('، '),
        href: `/schedule?month=${month.id}`,
        action: 'راجع الجدول',
      });
    }

    if (month.status === 'draft' && s.filled === 0) {
      out.push({ id: `undistributed-${month.id}`, level: daysToFirst <= 7 ? 'critical' : 'warning', title: `جدول ${title} لسه ما اتوزعش`, detail: daysToFirst >= 0 ? `أول جمعة بعد ${daysToFirst} يوم` : 'الشهر بدأ', href: `/schedule?month=${month.id}`, action: 'وزّع الآن' });
    } else if (month.status === 'draft' && daysToFirst <= 7) {
      out.push({ id: `unpublished-${month.id}`, level: 'warning', title: `جدول ${title} لسه مسودة`, detail: 'الخطباء مش هيشوفوا جمعاتهم غير بعد النشر', href: `/schedule?month=${month.id}`, action: 'راجع وانشر' });
    }

    if (month.status === 'published' && s.preachersToNotify > 0) {
      out.push({ id: `notify-${month.id}`, level: 'info', title: `${s.preachersToNotify} خطيب لسه ما اتبعتلهمش الجدول`, detail: title, href: `/messages?month=${month.id}`, action: 'ابعت' });
    }
  }

  // الجمعة الجاية: لسه ما أكدوش / التذكير
  const next = nextFriday(data.months, today);
  if (next) {
    const days = diffDays(next.friday.date, today);
    const rows = monthAssignments(data, next.month.id).filter((a) => a.friday_index === next.friday.index && a.preacher_id && a.status !== 'excused');
    const pending = rows.filter((a) => a.status === 'pending').length;
    if (days <= 3 && pending > 0) {
      out.push({ id: 'next-pending', level: 'warning', title: `${pending} خطيب لسه ما أكدش الجمعة الجاية`, detail: days === 0 ? 'النهارده' : days === 1 ? 'بكرة' : `بعد ${days} أيام`, href: '/messages?tab=reminder', action: 'ذكّرهم' });
    }
    const notReminded = rows.filter((a) => !(a.reminded_at && diffDays(next.friday.date, a.reminded_at.slice(0, 10)) <= 2)).length;
    if (days <= 1 && notReminded > 0) {
      out.push({ id: 'next-reminder', level: 'info', title: `تذكير الخميس: ${notReminded} لسه ما اتفكروش`, detail: 'الجمعة الجاية', href: '/messages?tab=reminder', action: 'تذكير' });
    }
  }

  // خطباء نشطين من غير رقم واتساب صحيح
  const noPhone = data.preachers.filter((p) => p.is_active && !isValidPhone(p.phone)).length;
  if (noPhone) out.push({ id: 'no-phone', level: 'info', title: `${noPhone} خطيب من غير رقم واتساب صحيح`, detail: 'ما ينفعش يتبعتلهم', href: '/preachers?filter=nophone', action: 'كمّل البيانات' });

  const order: Record<AlertLevel, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
