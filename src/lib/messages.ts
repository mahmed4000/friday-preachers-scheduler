// نصوص رسائل واتساب
import { fridayOrdinal, gregShort, hijriShort, monthTitle } from './hijri.ts';
import type { Month } from '../data/types.ts';

export interface MsgItem {
  fridayIndex: number;
  date: string;
  hijriDay: number;
  mosqueName: string;
}

const sign = (org: string) => (org ? `\n\n${org}` : '');

/** جدول الخطيب للشهر كله + رابط التأكيد */
export function monthMessage(name: string, month: Month, items: MsgItem[], link: string, org: string): string {
  const lines = items.map((i) => `• ${fridayOrdinal(i.fridayIndex)} (${hijriShort(i.hijriDay, month.hijri_month)} - ${gregShort(i.date)}): ${i.mosqueName}`);
  return (
    `السلام عليكم ورحمة الله وبركاته\nفضيلة الشيخ ${name}، جزاكم الله خيرًا.\n\n` +
    `جمعاتكم في شهر ${monthTitle(month.hijri_year, month.hijri_month)}:\n${lines.join('\n')}\n\n` +
    `برجاء التأكيد أو الاعتذار من الرابط ده:\n${link}` +
    sign(org)
  );
}

/** تكليف جمعة واحدة (مثلًا بعد تعيين بديل) */
export function fridayMessage(name: string, month: Month, item: MsgItem, link: string, org: string): string {
  return (
    `السلام عليكم ورحمة الله وبركاته\nفضيلة الشيخ ${name}،\n\n` +
    `نرجو من فضيلتكم خطبة ${fridayOrdinal(item.fridayIndex)} (${hijriShort(item.hijriDay, month.hijri_month)} - ${gregShort(item.date)}) في ${item.mosqueName}.\n\n` +
    `برجاء التأكيد من الرابط:\n${link}` +
    sign(org)
  );
}

/** تذكير الخميس */
export function reminderMessage(name: string, month: Month, item: MsgItem, link: string, org: string): string {
  return (
    `السلام عليكم ورحمة الله\nفضيلة الشيخ ${name}، تذكير بخطبة الجمعة بكرة إن شاء الله ` +
    `(${hijriShort(item.hijriDay, month.hijri_month)} - ${gregShort(item.date)}) في ${item.mosqueName}.\n` +
    `بارك الله فيكم ونفع بكم.\n\nلو فيه أي ظرف بلّغنا من الرابط:\n${link}` +
    sign(org)
  );
}

/** جدول المسجد للشهر */
export function mosqueMessage(mosqueName: string, month: Month, rows: { fridayIndex: number; date: string; hijriDay: number; preacher: string }[], org: string): string {
  const lines = rows.map((r) => `• ${fridayOrdinal(r.fridayIndex)} (${gregShort(r.date)}): الشيخ ${r.preacher}`);
  return `السلام عليكم ورحمة الله\nجدول خطباء ${mosqueName} لشهر ${monthTitle(month.hijri_year, month.hijri_month)}:\n${lines.join('\n')}` + sign(org);
}
