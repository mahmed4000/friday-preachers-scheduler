import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthFridays, umalqura, umalquraMonth, addDays } from '../src/lib/hijri.ts';

test('بداية الشهر الهجري حسب أم القرى', () => {
  const { start, days } = umalquraMonth(1448, 6);
  assert.deepEqual(umalqura(start), { year: 1448, month: 6, day: 1 });
  assert.equal(umalqura(addDays(start, -1)).month, 5);
  assert.ok(days === 29 || days === 30);
  assert.equal(umalqura(addDays(start, days)).day, 1);
});

test('كل شهور سنة كاملة', () => {
  for (let m = 1; m <= 12; m++) {
    const { start } = umalquraMonth(1449, m);
    assert.deepEqual(umalqura(start), { year: 1449, month: m, day: 1 });
  }
});

test('جمعات الشهر', () => {
  const f = monthFridays('2026-11-22', 30);
  assert.equal(f[0].date, '2026-11-27');
  assert.equal(f[0].hijriDay, 6);
  assert.equal(f.length, 4);
  assert.equal(monthFridays('2026-10-30', 30).length, 5); // 30 أكتوبر جمعة
});
