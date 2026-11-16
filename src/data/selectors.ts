import type { AppData, Assignment, Month } from './types.ts';
import { diffDays, monthFridays, todayIso, type FridayInfo } from '../lib/hijri.ts';
import type { EngineInput } from '../lib/engine.ts';

export function fridaysOf(m: Month): FridayInfo[] {
  return monthFridays(m.start_date, m.days_count);
}

export function monthEnd(m: Month): string {
  const d = new Date(`${m.start_date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + m.days_count - 1);
  return d.toISOString().slice(0, 10);
}

export function sortMonths(months: Month[]): Month[] {
  return [...months].sort((a, b) => a.start_date.localeCompare(b.start_date));
}

/** الشهر الحالي، أو أقرب شهر جاي، أو آخر شهر */
export function currentMonth(months: Month[], today = todayIso()): Month | null {
  const sorted = sortMonths(months);
  return (
    sorted.find((m) => m.start_date <= today && monthEnd(m) >= today) ??
    sorted.find((m) => m.start_date > today) ??
    sorted[sorted.length - 1] ??
    null
  );
}

/** الجمعة الجاية (أو النهارده لو جمعة) في أي شهر موجود */
export function nextFriday(months: Month[], today = todayIso()): { month: Month; friday: FridayInfo } | null {
  let best: { month: Month; friday: FridayInfo } | null = null;
  for (const m of months) {
    for (const f of fridaysOf(m)) {
      if (diffDays(f.date, today) < 0) continue;
      if (!best || f.date < best.friday.date) best = { month: m, friday: f };
    }
  }
  return best;
}

export function monthAssignments(data: AppData, monthId: number): Assignment[] {
  return data.assignments.filter((a) => a.month_id === monthId);
}

export function unavailableSet(data: AppData, monthId: number): Set<string> {
  return new Set(data.unavailable.filter((u) => u.month_id === monthId).map((u) => `${u.preacher_id}:${u.friday_index}`));
}

/** عدد مرات خطابة كل خطيب في كل مسجد في الشهرين اللي قبل الشهر ده */
export function historyFor(data: AppData, month: Month): Map<string, number> {
  const prev = sortMonths(data.months)
    .filter((m) => m.start_date < month.start_date)
    .slice(-2)
    .map((m) => m.id);
  const map = new Map<string, number>();
  for (const a of data.assignments) {
    if (!prev.includes(a.month_id) || !a.preacher_id || a.status === 'excused') continue;
    const k = `${a.preacher_id}:${a.mosque_id}`;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export function engineInput(data: AppData, month: Month): Omit<EngineInput, 'seed'> {
  return {
    fridayIndices: fridaysOf(month).map((f) => f.index),
    mosques: data.mosques,
    preachers: data.preachers,
    fixed: data.fixed,
    preferences: data.preferences,
    unavailable: unavailableSet(data, month.id),
    existing: monthAssignments(data, month.id),
    history: historyFor(data, month),
  };
}

export function byId<T extends { id: number }>(list: T[]): Map<number, T> {
  return new Map(list.map((x) => [x.id, x]));
}
