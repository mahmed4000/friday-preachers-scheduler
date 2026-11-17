// محرك التوزيع: قواعد الأستاذ عبدالرحمن (مسؤول الدعوة)
//
// قواعد لازمة (ما ينفعش تتكسر):
//  - الخطيب في مسجد واحد بس في نفس الجمعة.
//  - الخطيب مش متاح (اعتذار للشهر، أو جمعات مش متاح فيها دائمًا، أو موقوف) ما يتحطش.
//  - المسجد رافض الخطيب ما يتحطش.
//  - الخطيب ما يتكررش في نفس المسجد في نفس الشهر (ما عدا الخطيب الثابت).
//  - الخطيب ما يعدّيش أقصى عدد جمعات حدده بنفسه (ما عدا الثابت).
//  - الخطيب الجديد ما يروحش المسجد الكبير.
//
// أولويات (بتأثر في الترتيب):
//  - الخطيب الثابت الأول.
//  - العدالة: اللي أخد جمعات أقل ياخد الأول.
//  - التنوع: المسجد يسمع خطباء مختلفين عن الشهور اللي فاتت.
//  - مستوى الخطيب يناسب حجم المسجد.
//  - رغبة المسجد في خطيب معين.
//  - لو الخطباء قليلين: المساجد الكبيرة تتملي الأول.

import type { Assignment, FixedRule, Mosque, MosqueSize, Preacher, Preference } from '../data/types.ts';

export interface Slot {
  mosqueId: number;
  fridayIndex: number;
}

export interface EngineInput {
  fridayIndices: number[];
  mosques: Mosque[];
  preachers: Preacher[];
  fixed: FixedRule[];
  preferences: Preference[];
  /** اعتذارات الشهر: `${preacherId}:${fridayIndex}` */
  unavailable: Set<string>;
  /** التكليفات الحالية في الشهر (المقفولة واليدوية بتتساب زي ما هي) */
  existing: Pick<Assignment, 'mosque_id' | 'friday_index' | 'preacher_id' | 'source' | 'locked' | 'status'>[];
  /** عدد مرات خطابة كل خطيب في كل مسجد في الشهور اللي فاتت: `${preacherId}:${mosqueId}` */
  history: Map<string, number>;
  seed?: number;
}

export interface PlannedAssignment extends Slot {
  preacherId: number | null;
  source: 'fixed' | 'auto' | 'manual';
  kept: boolean;
}

export interface EngineResult {
  assignments: PlannedAssignment[];
  unfilled: (Slot & { reason: string })[];
}

const SIZE_ORDER: Record<MosqueSize, number> = { large: 0, medium: 1, small: 2 };

export function neededFridays(m: Mosque, fridayIndices: number[]): number[] {
  if (!m.needed_fridays || m.needed_fridays.length === 0) return fridayIndices;
  return fridayIndices.filter((f) => m.needed_fridays!.includes(f));
}

export function isPreacherAvailable(p: Preacher, fridayIndex: number, unavailable: Set<string>): boolean {
  if (!p.is_active) return false;
  if (p.available_fridays && p.available_fridays.length > 0 && !p.available_fridays.includes(fridayIndex)) return false;
  return !unavailable.has(`${p.id}:${fridayIndex}`);
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/** حالة الشهر أثناء التوزيع */
class MonthState {
  byFriday = new Map<number, Set<number>>(); // جمعة → الخطباء المشغولين
  load = new Map<number, number>(); // خطيب → عدد جمعاته
  atMosque = new Set<string>(); // `${preacherId}:${mosqueId}`

  add(preacherId: number, mosqueId: number, fridayIndex: number) {
    if (!this.byFriday.has(fridayIndex)) this.byFriday.set(fridayIndex, new Set());
    this.byFriday.get(fridayIndex)!.add(preacherId);
    this.load.set(preacherId, (this.load.get(preacherId) ?? 0) + 1);
    this.atMosque.add(`${preacherId}:${mosqueId}`);
  }

  busy(preacherId: number, fridayIndex: number) {
    return this.byFriday.get(fridayIndex)?.has(preacherId) ?? false;
  }
}

export interface Candidate {
  preacher: Preacher;
  score: number;
  /** سبب يمنع (لو موجود، المرشح مخالف لقاعدة لازمة) */
  blocker: string | null;
  notes: string[];
}

interface ScoreContext {
  mosque: Mosque;
  fridayIndex: number;
  state: MonthState;
  prefs: Map<string, 'prefer' | 'avoid'>;
  unavailable: Set<string>;
  history: Map<string, number>;
  random: () => number;
}

function evaluate(p: Preacher, ctx: ScoreContext): Candidate {
  const { mosque, fridayIndex, state } = ctx;
  const notes: string[] = [];
  let blocker: string | null = null;
  const load = state.load.get(p.id) ?? 0;
  const pref = ctx.prefs.get(`${mosque.id}:${p.id}`);

  if (!p.is_active) blocker = 'موقوف';
  else if (ctx.unavailable.has(`${p.id}:${fridayIndex}`)) blocker = 'معتذر عن الجمعة دي';
  else if (p.available_fridays?.length && !p.available_fridays.includes(fridayIndex)) blocker = 'مش متاح في الجمعة دي';
  else if (state.busy(p.id, fridayIndex)) blocker = 'عنده مسجد تاني في نفس الجمعة';
  else if (pref === 'avoid') blocker = 'المسجد رافضه';
  else if (state.atMosque.has(`${p.id}:${mosque.id}`)) blocker = 'خطب في المسجد ده الشهر ده';
  else if (load >= p.max_fridays) blocker = `وصل لأقصى عدد (${p.max_fridays})`;
  else if (p.level === 'new' && mosque.size === 'large') blocker = 'خطيب جديد ومسجد كبير';

  // كل ما الرقم يقل، المرشح أنسب
  let score = load * 100 + (load / Math.max(p.max_fridays, 1)) * 40;
  const past = ctx.history.get(`${p.id}:${mosque.id}`) ?? 0;
  if (past > 0) {
    score += past * 25;
    notes.push(past === 1 ? 'خطب هنا قريب' : `خطب هنا ${past} مرات قريب`);
  }
  if (pref === 'prefer') {
    score -= 45;
    notes.push('المسجد طالبه');
  }
  if (mosque.size === 'large') {
    if (p.level === 'senior') { score -= 25; notes.push('خبرة كبيرة تناسب المسجد'); }
  } else if (mosque.size === 'small') {
    if (p.level === 'new') { score -= 20; notes.push('مسجد صغير يناسب خطيب جديد'); }
    if (p.level === 'senior') score += 10;
  }
  if (load === 0) notes.push('لسه ما أخدش جمعة الشهر ده');
  score += ctx.random() * 3;
  return { preacher: p, score, blocker, notes };
}

function buildPrefs(preferences: Preference[]) {
  const m = new Map<string, 'prefer' | 'avoid'>();
  for (const p of preferences) m.set(`${p.mosque_id}:${p.preacher_id}`, p.kind);
  return m;
}

export function generate(input: EngineInput): EngineResult {
  const random = rng(input.seed ?? 20261116);
  const prefs = buildPrefs(input.preferences);
  const state = new MonthState();
  const preacherById = new Map(input.preachers.map((p) => [p.id, p]));
  const activeMosques = input.mosques.filter((m) => m.is_active);

  const result: PlannedAssignment[] = [];
  const filled = new Set<string>();
  const key = (s: Slot) => `${s.mosqueId}:${s.fridayIndex}`;

  // 1) التكليفات المقفولة أو اليدوية بتفضل زي ما هي
  for (const a of input.existing) {
    if (!a.preacher_id || !(a.locked || a.source === 'manual')) continue;
    if (a.status === 'excused') continue;
    const mosque = activeMosques.find((m) => m.id === a.mosque_id);
    if (!mosque || !input.fridayIndices.includes(a.friday_index)) continue;
    const slot = { mosqueId: a.mosque_id, fridayIndex: a.friday_index };
    state.add(a.preacher_id, a.mosque_id, a.friday_index);
    filled.add(key(slot));
    result.push({ ...slot, preacherId: a.preacher_id, source: a.source, kept: true });
  }

  // 2) الخطيب الثابت
  for (const mosque of activeMosques) {
    for (const f of neededFridays(mosque, input.fridayIndices)) {
      const slot = { mosqueId: mosque.id, fridayIndex: f };
      if (filled.has(key(slot))) continue;
      const rule =
        input.fixed.find((r) => r.mosque_id === mosque.id && r.friday_index === f) ??
        input.fixed.find((r) => r.mosque_id === mosque.id && r.friday_index === null);
      if (!rule) continue;
      const p = preacherById.get(rule.preacher_id);
      if (!p || !isPreacherAvailable(p, f, input.unavailable) || state.busy(p.id, f)) continue;
      state.add(p.id, mosque.id, f);
      filled.add(key(slot));
      result.push({ ...slot, preacherId: p.id, source: 'fixed', kept: false });
    }
  }

  // 3) باقي الأماكن: جمعة جمعة، والمساجد الكبيرة الأول، والأصعب في المرشحين الأول
  const unfilled: EngineResult['unfilled'] = [];
  for (const f of input.fridayIndices) {
    const open = activeMosques
      .filter((m) => neededFridays(m, input.fridayIndices).includes(f) && !filled.has(`${m.id}:${f}`))
      .map((m) => ({ mosque: m, ctx: { mosque: m, fridayIndex: f, state, prefs, unavailable: input.unavailable, history: input.history, random } }));

    const eligibleCount = (ctx: ScoreContext) => input.preachers.filter((p) => !evaluate(p, ctx).blocker).length;
    open.sort((a, b) => SIZE_ORDER[a.mosque.size] - SIZE_ORDER[b.mosque.size] || eligibleCount(a.ctx) - eligibleCount(b.ctx) || a.mosque.id - b.mosque.id);

    for (const { mosque, ctx } of open) {
      const ranked = input.preachers.map((p) => evaluate(p, ctx)).filter((c) => !c.blocker).sort((a, b) => a.score - b.score);
      const best = ranked[0];
      const slot = { mosqueId: mosque.id, fridayIndex: f };
      if (!best) {
        unfilled.push({ ...slot, reason: 'مفيش خطيب متاح يناسب القواعد' });
        result.push({ ...slot, preacherId: null, source: 'auto', kept: false });
        continue;
      }
      state.add(best.preacher.id, mosque.id, f);
      filled.add(key(slot));
      result.push({ ...slot, preacherId: best.preacher.id, source: 'auto', kept: false });
    }
  }

  return { assignments: result, unfilled };
}

/** ترتيب البدلاء لمكان معين، مع بيان سبب أي مخالفة */
export function rankCandidates(
  slot: Slot,
  input: Omit<EngineInput, 'fridayIndices' | 'seed'> & { fridayIndices?: number[] }
): Candidate[] {
  const mosque = input.mosques.find((m) => m.id === slot.mosqueId);
  if (!mosque) return [];
  const state = new MonthState();
  for (const a of input.existing) {
    if (!a.preacher_id || a.status === 'excused') continue;
    if (a.mosque_id === slot.mosqueId && a.friday_index === slot.fridayIndex) continue; // المكان نفسه
    state.add(a.preacher_id, a.mosque_id, a.friday_index);
  }
  const ctx: ScoreContext = {
    mosque,
    fridayIndex: slot.fridayIndex,
    state,
    prefs: buildPrefs(input.preferences),
    unavailable: input.unavailable,
    history: input.history,
    random: () => 0,
  };
  return input.preachers
    .filter((p) => p.is_active)
    .map((p) => evaluate(p, ctx))
    .sort((a, b) => Number(Boolean(a.blocker)) - Number(Boolean(b.blocker)) || a.score - b.score);
}
