import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthMessage, mosqueMessage, relativeFriday, reminderMessage, signature } from '../src/lib/messages.ts';
import type { Month, Settings } from '../src/data/types.ts';

const settings: Settings = { org_name: 'الجمعية الشرعية', branch_name: 'فرع المنشية', admin_name: 'عبدالرحمن', admin_phone: '01000000000' };
const month: Month = { id: 1, hijri_year: 1448, hijri_month: 6, start_date: '2026-11-11', days_count: 30, status: 'published', published_at: null };
const item = { fridayIndex: 2, date: '2026-11-20', hijriDay: 10, mosqueName: 'مسجد النور' };

test('relativeFriday: اليوم / غدًا / القادم', () => {
  assert.equal(relativeFriday('2026-11-20', '2026-11-20'), 'اليوم');
  assert.equal(relativeFriday('2026-11-20', '2026-11-19'), 'غدًا');
  assert.equal(relativeFriday('2026-11-20', '2026-11-16'), 'القادمة');
});

test('reminder text matches the day it is sent', () => {
  const thu = reminderMessage(settings, 'أحمد', month, item, 'https://x/p/t', '2026-11-19');
  const mon = reminderMessage(settings, 'أحمد', month, item, 'https://x/p/t', '2026-11-16');
  assert.match(thu, /الجمعة غدًا/);
  assert.doesNotMatch(mon, /غدًا|بكرة/);
});

test('signature has admin and org, and skips empty parts', () => {
  assert.equal(signature(settings), 'عبدالرحمن\nمسؤول الدعوة\nالجمعية الشرعية - فرع المنشية');
  assert.equal(signature({ org_name: '', branch_name: '', admin_name: '', admin_phone: '' }), 'مسؤول الدعوة');
});

test('PDF note only when sent with a PDF', () => {
  const plain = monthMessage(settings, 'أحمد', month, [item], 'https://x/p/t');
  const withPdf = monthMessage(settings, 'أحمد', month, [item], 'https://x/p/t', { withPdf: true });
  assert.doesNotMatch(plain, /PDF/);
  assert.match(withPdf, /مرفق الجدول بصيغة PDF/);
  assert.match(withPdf, /https:\/\/x\/p\/t/);
  assert.doesNotMatch(withPdf, /\n{3,}/);
});

test('mosque message lists preachers with phones and contact', () => {
  const t = mosqueMessage(settings, 'مسجد النور', month, [{ ...item, preacher: 'محمود', phone: '01111111111' }]);
  assert.match(t, /الشيخ \*محمود\* · 01111111111/);
  assert.match(t, /01000000000/);
});
