import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conflicts, monthStats, opsAlerts, scheduleStage } from '../src/data/alerts.ts';
import { diffMosque, diffPreacher, diffSettings, actionLabel } from '../src/data/audit.ts';
import type { AppData, Assignment, Month, Mosque, Preacher } from '../src/data/types.ts';

// شهر فيه 4 جمعات: يبدأ الأحد 2026-11-01 → الجمع 6، 13، 20، 27 نوفمبر
const month: Month = { id: 1, hijri_year: 1448, hijri_month: 5, start_date: '2026-11-01', days_count: 30, status: 'draft', published_at: null };
const mosque = (id: number, extra: Partial<Mosque> = {}): Mosque => ({ id, name: `مسجد ${id}`, size: 'medium', phone: '', contact_name: '', needed_fridays: null, is_active: true, notes: '', ...extra });
const preacher = (id: number, extra: Partial<Preacher> = {}): Preacher => ({ id, name: `خطيب ${id}`, phone: '01012345678', level: 'mid', max_fridays: 2, available_fridays: null, is_active: true, notes: '', portal_token: `t${id}`, ...extra });
let nextId = 1;
const asg = (mosque_id: number, friday_index: number, preacher_id: number | null, extra: Partial<Assignment> = {}): Assignment => ({
  id: nextId++, month_id: 1, mosque_id, friday_index, preacher_id, source: 'auto', locked: false, status: 'pending', excuse_reason: '', status_at: null, notified_at: null, reminded_at: null, ...extra,
});

function data(over: Partial<AppData> = {}): AppData {
  return {
    settings: { org_name: 'الجمعية', branch_name: '', admin_name: '', admin_phone: '' },
    mosques: [mosque(1), mosque(2, { needed_fridays: [1, 3] })],
    preachers: [preacher(1), preacher(2), preacher(3)],
    fixed: [], preferences: [], months: [month], unavailable: [], assignments: [], log: [],
    ...over,
  };
}

test('إحصائيات الشهر: المطلوب والمتغطي والنسبة والمساجد', () => {
  const d = data({
    assignments: [
      asg(1, 1, 1, { status: 'confirmed', notified_at: '2026-10-30T10:00:00Z' }),
      asg(1, 2, 2),
      asg(1, 3, 3, { status: 'excused' }),
      asg(2, 1, 2),
      asg(2, 3, 3),
    ],
  });
  const s = monthStats(d, month);
  assert.equal(s.total, 6); // 4 + 2
  assert.equal(s.filled, 4); // المعتذر مش محسوب
  assert.equal(s.confirmed, 1);
  assert.equal(s.excused, 1);
  assert.equal(s.pct, 67);
  assert.equal(s.mosquesCovered, 1);
  assert.equal(s.mosquesUncovered, 1);
  assert.equal(s.notified, 1);
  assert.equal(s.preachersToNotify, 2);
  assert.equal(scheduleStage(s), 'incomplete');
});

test('مراحل الجدول: فاضي، جاهز، منشور', () => {
  assert.equal(scheduleStage(monthStats(data(), month)), 'empty');
  const full = data({ assignments: [1, 2, 3, 4].map((f) => asg(1, f, f === 4 ? 3 : f)).concat([asg(2, 1, 2), asg(2, 3, 1)]) });
  assert.equal(scheduleStage(monthStats(full, month)), 'ready');
  assert.equal(scheduleStage(monthStats({ ...full, months: [{ ...month, status: 'published' }] }, { ...month, status: 'published' })), 'published');
});

test('التعارضات: نفس الخطيب مرتين في نفس الجمعة، ومعتذر ومتكلف، وفوق الحد، وموقوف', () => {
  const d = data({
    preachers: [preacher(1, { max_fridays: 1 }), preacher(2), preacher(3, { is_active: false })],
    unavailable: [{ id: 1, month_id: 1, preacher_id: 2, friday_index: 2, reason: '' }],
    assignments: [asg(1, 1, 1), asg(2, 1, 1), asg(1, 2, 2), asg(1, 3, 3)],
  });
  const reasons = conflicts(d, month).map((c) => c.reason);
  assert.equal(reasons.filter((r) => r.includes('مسجدين')).length, 2);
  assert.ok(reasons.some((r) => r.includes('معتذر')));
  assert.ok(reasons.some((r) => r.includes('متوقف')));
});

test('الخطيب الثابت مش بيتحسب فوق حده', () => {
  const d = data({
    preachers: [preacher(1, { max_fridays: 1 })],
    fixed: [{ id: 1, mosque_id: 1, preacher_id: 1, friday_index: null }],
    assignments: [asg(1, 1, 1, { source: 'fixed' }), asg(1, 2, 1, { source: 'fixed' })],
  });
  assert.equal(conflicts(d, month).length, 0);
});

test('التنبيهات: اعتذار جاي محتاج بديل، وخطيب من غير رقم', () => {
  const d = data({
    preachers: [preacher(1), preacher(2, { phone: '' })],
    assignments: [asg(1, 4, 1, { status: 'excused' })],
  });
  const alerts = opsAlerts(d, '2026-11-15');
  assert.ok(alerts.some((a) => a.id === 'excused-1' && a.level === 'critical'));
  assert.ok(alerts.some((a) => a.id === 'no-phone'));
  // العاجل الأول
  assert.equal(alerts[0].level, 'critical');
  // الاعتذار في جمعة فاتت مش بيظهر
  assert.ok(!opsAlerts(d, '2026-11-30').some((a) => a.id === 'excused-1'));
});

test('سجل العمليات: الفرق بين القيم القديمة والجديدة', () => {
  assert.deepEqual(diffPreacher(preacher(1), preacher(1)), []);
  const d = diffPreacher(preacher(1), preacher(1, { max_fridays: 3, is_active: false, available_fridays: [1, 2] }));
  assert.deepEqual(d, ['أقصى جمعات: 2 ← 3', 'متاح في: كل الجمعات ← الأولى والثانية', 'الحالة: نشط ← متوقف']);
  assert.deepEqual(diffMosque(mosque(1), mosque(1, { size: 'large' })), ['الحجم: متوسط ← كبير']);
  assert.deepEqual(diffSettings({ org_name: 'أ' }, { org_name: 'ب' }), ['اسم الجمعية: أ ← ب']);
  assert.equal(actionLabel('replace'), 'تغيير تكليف');
  assert.equal(actionLabel('unknown_action'), 'unknown_action');
});
