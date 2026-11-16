import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, rankCandidates, type EngineInput } from '../src/lib/engine.ts';
import type { Mosque, Preacher } from '../src/data/types.ts';

const mosque = (id: number, size: Mosque['size'] = 'medium', extra: Partial<Mosque> = {}): Mosque => ({
  id, name: `مسجد ${id}`, size, phone: '', contact_name: '', needed_fridays: null, is_active: true, notes: '', ...extra,
});
const preacher = (id: number, extra: Partial<Preacher> = {}): Preacher => ({
  id, name: `خطيب ${id}`, phone: '', level: 'mid', max_fridays: 2, available_fridays: null, is_active: true, notes: '', portal_token: `t${id}`, ...extra,
});

function base(over: Partial<EngineInput> = {}): EngineInput {
  return {
    fridayIndices: [1, 2, 3, 4],
    mosques: [mosque(1, 'large'), mosque(2), mosque(3, 'small')],
    preachers: Array.from({ length: 8 }, (_, i) => preacher(i + 1, { level: i < 2 ? 'senior' : i > 5 ? 'new' : 'mid' })),
    fixed: [], preferences: [], unavailable: new Set(), existing: [], history: new Map(),
    ...over,
  };
}

function check(input: EngineInput) {
  const res = generate(input);
  const perFriday = new Map<number, number[]>();
  const perMosque = new Set<string>();
  const load = new Map<number, number>();
  for (const a of res.assignments) {
    if (!a.preacherId) continue;
    const list = perFriday.get(a.fridayIndex) ?? [];
    assert.ok(!list.includes(a.preacherId), `خطيب ${a.preacherId} مكرر في الجمعة ${a.fridayIndex}`);
    list.push(a.preacherId);
    perFriday.set(a.fridayIndex, list);
    if (a.source !== 'fixed') {
      const k = `${a.preacherId}:${a.mosqueId}`;
      assert.ok(!perMosque.has(k), `خطيب ${a.preacherId} مكرر في مسجد ${a.mosqueId}`);
      perMosque.add(k);
    }
    load.set(a.preacherId, (load.get(a.preacherId) ?? 0) + 1);
  }
  return { res, load };
}

test('يملا كل الأماكن من غير تكرار ولا تعدي الحد الأقصى', () => {
  const input = base();
  const { res, load } = check(input);
  assert.equal(res.unfilled.length, 0);
  assert.equal(res.assignments.filter((a) => a.preacherId).length, 12);
  for (const p of input.preachers) assert.ok((load.get(p.id) ?? 0) <= p.max_fridays);
});

test('العدالة: الفرق بين أكتر وأقل خطيب جمعة واحدة بالكتير', () => {
  const { load } = check(base());
  const counts = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => load.get(id) ?? 0);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join(','));
});

test('الخطيب الثابت لجمعة معينة وفي مسجدين مختلفين', () => {
  const input = base({
    fixed: [
      { id: 1, mosque_id: 1, preacher_id: 1, friday_index: 1 },
      { id: 2, mosque_id: 2, preacher_id: 1, friday_index: 2 },
    ],
  });
  const { res } = check(input);
  const at = (m: number, f: number) => res.assignments.find((a) => a.mosqueId === m && a.fridayIndex === f);
  assert.equal(at(1, 1)?.preacherId, 1);
  assert.equal(at(1, 1)?.source, 'fixed');
  assert.equal(at(2, 2)?.preacherId, 1);
});

test('الخطيب الثابت لكل الجمعات بيتكرر في نفس المسجد عادي', () => {
  const { res } = check(base({ fixed: [{ id: 1, mosque_id: 3, preacher_id: 4, friday_index: null }] }));
  assert.deepEqual(res.assignments.filter((a) => a.mosqueId === 3).map((a) => a.preacherId), [4, 4, 4, 4]);
});

test('الاعتذار والجمعات غير المتاحة والرفض بيتحترموا', () => {
  const input = base({
    unavailable: new Set(['1:1', '2:1']),
    preachers: base().preachers.map((p) => (p.id === 3 ? { ...p, available_fridays: [4] } : p)),
    preferences: [{ id: 1, mosque_id: 2, preacher_id: 5, kind: 'avoid' }],
  });
  const { res } = check(input);
  for (const a of res.assignments) {
    if (a.fridayIndex === 1) assert.ok(a.preacherId !== 1 && a.preacherId !== 2);
    if (a.preacherId === 3) assert.equal(a.fridayIndex, 4);
    if (a.mosqueId === 2) assert.notEqual(a.preacherId, 5);
  }
});

test('الخطيب الجديد ما يروحش المسجد الكبير', () => {
  const { res } = check(base());
  for (const a of res.assignments.filter((x) => x.mosqueId === 1)) assert.ok(a.preacherId !== 7 && a.preacherId !== 8);
});

test('لو الخطباء قليلين، المسجد الكبير يتملي الأول', () => {
  const input = base({ preachers: [preacher(1, { max_fridays: 5 }), preacher(2, { max_fridays: 5 })], mosques: [mosque(1, 'small'), mosque(2, 'large'), mosque(3)] });
  const { res } = check(input);
  for (const f of [1, 2]) assert.ok(res.assignments.find((a) => a.mosqueId === 2 && a.fridayIndex === f)?.preacherId);
  assert.ok(res.unfilled.length > 0);
});

test('مسجد محتاج جمعات معينة بس', () => {
  const { res } = check(base({ mosques: [mosque(1, 'medium', { needed_fridays: [1, 3] })] }));
  assert.deepEqual(res.assignments.map((a) => a.fridayIndex), [1, 3]);
});

test('التكليفات المقفولة واليدوية بتفضل زي ما هي', () => {
  const { res } = check(base({ existing: [{ mosque_id: 2, friday_index: 3, preacher_id: 8, source: 'manual', locked: false, status: 'pending' }] }));
  const a = res.assignments.find((x) => x.mosqueId === 2 && x.fridayIndex === 3);
  assert.equal(a?.preacherId, 8);
  assert.equal(a?.kept, true);
});

test('رغبة المسجد ترفع الخطيب في الترتيب', () => {
  const input = base({ preferences: [{ id: 1, mosque_id: 2, preacher_id: 6, kind: 'prefer' }] });
  const ranked = rankCandidates({ mosqueId: 2, fridayIndex: 1 }, input);
  assert.equal(ranked[0].preacher.id, 6);
});

test('ترتيب البدلاء يحط المخالفين في الآخر مع السبب', () => {
  const input = base({ existing: [{ mosque_id: 1, friday_index: 1, preacher_id: 2, source: 'auto', locked: false, status: 'pending' }] });
  const ranked = rankCandidates({ mosqueId: 2, fridayIndex: 1 }, input);
  const p2 = ranked.find((c) => c.preacher.id === 2)!;
  assert.equal(p2.blocker, 'عنده مسجد تاني في نفس الجمعة');
  assert.ok(ranked.indexOf(p2) > ranked.findIndex((c) => !c.blocker));
});

test('نفس المدخلات بتدي نفس النتيجة', () => {
  assert.deepEqual(generate(base()), generate(base()));
});
