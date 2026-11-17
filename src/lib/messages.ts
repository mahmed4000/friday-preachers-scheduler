/**
 * نصوص رسائل واتساب بصيغة رسمية موحّدة.
 * كل رسالة: تحية، مخاطبة، المحتوى، طلب الإجراء، ثم توقيع مسؤول الدعوة والجمعية.
 * لما الرسالة تتبعت مع ملف PDF بنضيف سطر بيشير للمرفق.
 * (*نص* في واتساب بيظهر بخط عريض)
 */
import type { Month, Settings } from '../data/types.ts';
import { diffDays, fridayOrdinal, gregLong, hijriShort, monthTitle } from './hijri.ts';

export interface MsgItem {
  fridayIndex: number;
  date: string;
  hijriDay: number;
  mosqueName: string;
}

export interface MosqueRow {
  fridayIndex: number;
  date: string;
  hijriDay: number;
  preacher: string;
  phone?: string;
}

export type MsgOptions = { withPdf?: boolean };

const GREETING = 'السلام عليكم ورحمة الله وبركاته';

/** توقيع الرسائل: اسم المسؤول + الجمعية والفرع */
export function signature(s: Settings): string {
  const who = s.admin_name ? `${s.admin_name}\nمسؤول الدعوة` : 'مسؤول الدعوة';
  const org = [s.org_name, s.branch_name].filter(Boolean).join(' - ');
  return [who, org].filter(Boolean).join('\n');
}

/** وسيلة التواصل مع المسؤول (للمساجد) */
function contactLine(s: Settings): string {
  return s.admin_phone ? `للتواصل أو أي تعديل: ${s.admin_phone}` : 'لأي تعديل نرجو التواصل مع مسؤول الدعوة.';
}

const when = (month: Month, i: { fridayIndex: number; date: string; hijriDay: number }) =>
  `${fridayOrdinal(i.fridayIndex)} · ${hijriShort(i.hijriDay, month.hijri_month)} · ${gregLong(i.date)}`;

const join = (...blocks: (string | false | undefined)[]) => blocks.filter(Boolean).join('\n\n');

/** موعد الجمعة بالنسبة للنهارده، بيتكتب بعد "خطبة الجمعة": اليوم / غدًا / القادمة */
export function relativeFriday(date: string, today: string): string {
  const d = diffDays(date, today);
  if (d === 0) return 'اليوم';
  if (d === 1) return 'غدًا';
  if (d > 1 && d < 7) return 'القادمة';
  return `يوم ${gregLong(date)}`;
}

/** جدول الخطيب للشهر كله + رابط التأكيد */
export function monthMessage(s: Settings, name: string, month: Month, items: MsgItem[], link: string, o: MsgOptions = {}): string {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const lines = items.map((i) => `▪️ *${i.mosqueName}*\n     ${when(month, i)}`);
  return join(
    `${GREETING}\nفضيلة الشيخ/ ${name}، حفظه الله`,
    `يسعدنا أن نرسل لفضيلتكم جدول خطب الجمعة لشهر *${title}*:`,
    lines.join('\n'),
    o.withPdf && '📎 مرفق الجدول بصيغة PDF.',
    `نرجو التكرم بتأكيد الجمعات أو الاعتذار عن أيٍّ منها من صفحتكم الخاصة:\n${link}`,
    'جزاكم الله خيرًا ونفع بكم.',
    signature(s)
  );
}

/** تكليف بجمعة واحدة (مثلًا بعد تعيين بديل) */
export function fridayMessage(s: Settings, name: string, month: Month, item: MsgItem, link: string, o: MsgOptions = {}): string {
  return join(
    `${GREETING}\nفضيلة الشيخ/ ${name}، حفظه الله`,
    `نرجو من فضيلتكم التكرم بإلقاء خطبة الجمعة في:\n*${item.mosqueName}*\n${when(month, item)}`,
    o.withPdf && '📎 مرفق خطاب التكليف بصيغة PDF.',
    `نرجو التأكيد أو الاعتذار من صفحتكم الخاصة:\n${link}`,
    'جزاكم الله خيرًا.',
    signature(s)
  );
}

/** تذكير الخميس (أو قبل الجمعة بأيام) */
export function reminderMessage(s: Settings, name: string, month: Month, item: MsgItem, link: string, today: string, o: MsgOptions = {}): string {
  return join(
    `${GREETING}\nفضيلة الشيخ/ ${name}، حفظه الله`,
    `نذكّر فضيلتكم بخطبة الجمعة ${relativeFriday(item.date, today)} إن شاء الله:\n*${item.mosqueName}*\n${when(month, item)}`,
    o.withPdf && '📎 مرفق بطاقة التذكير بصيغة PDF.',
    'نسأل الله أن يفتح عليكم وأن ينفع بكم.',
    `وإن طرأ ما يمنعكم، نرجو إبلاغنا في أقرب وقت من صفحتكم:\n${link}`,
    signature(s)
  );
}

/** جدول خطباء المسجد للشهر */
export function mosqueMessage(s: Settings, mosqueName: string, month: Month, rows: MosqueRow[], o: MsgOptions = {}): string {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const lines = rows.map((r) => `▪️ ${when(month, r)}\n     الشيخ *${r.preacher}*${r.phone ? ` · ${r.phone}` : ''}`);
  return join(
    `${GREETING}\nالإخوة الأفاضل القائمون على ${mosqueName}، حفظكم الله`,
    `نرسل إليكم جدول خطباء الجمعة لشهر *${title}*:`,
    lines.join('\n'),
    o.withPdf && '📎 مرفق الجدول بصيغة PDF، ويمكن طباعته وتعليقه في لوحة المسجد.',
    contactLine(s),
    'جزاكم الله خيرًا.',
    signature(s)
  );
}
