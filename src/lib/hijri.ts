// التاريخ الهجري: الحساب المبدئي بتقويم أم القرى، والمسؤول يعدّل بداية الشهر حسب إعلان دار الإفتاء.

export const HIJRI_MONTHS = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

const GREG_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const ORDINALS = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة'];

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
});

/** تاريخ ميلادي بصيغة YYYY-MM-DD → كائن Date في منتصف اليوم UTC */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

/** التاريخ الهجري (أم القرى) لتاريخ ميلادي */
export function umalqura(iso: string): { year: number; month: number; day: number } {
  const parts = fmt.formatToParts(parseDate(iso));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** أول يوم في الشهر الهجري وعدد أيامه حسب أم القرى */
export function umalquraMonth(year: number, month: number): { start: string; days: 29 | 30 } {
  // تقدير قريب ثم بحث حوالين التقدير
  const approx = new Date(Date.UTC(622, 6, 19) + ((year - 1) * 354.367 + (month - 1) * 29.53) * 86400000);
  let iso = toIso(approx);
  for (let i = 0; i < 80; i++) {
    const h = umalqura(iso);
    const cmp = h.year * 12 + h.month - (year * 12 + month);
    if (cmp === 0 && h.day === 1) break;
    if (cmp === 0) iso = addDays(iso, -(h.day - 1));
    else iso = addDays(iso, cmp < 0 ? 15 : -15);
  }
  const next = umalqura(addDays(iso, 29));
  return { start: iso, days: next.day === 1 ? 29 : 30 };
}

export function todayIso(): string {
  // اليوم بتوقيت القاهرة
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
}

export interface FridayInfo {
  index: number; // 1..5
  date: string; // YYYY-MM-DD
  hijriDay: number;
}

/** جمعات الشهر من أول يوم وعدد الأيام */
export function monthFridays(startIso: string, days: number): FridayInfo[] {
  const out: FridayInfo[] = [];
  for (let i = 0; i < days; i++) {
    const iso = addDays(startIso, i);
    if (parseDate(iso).getUTCDay() === 5) out.push({ index: out.length + 1, date: iso, hijriDay: i + 1 });
  }
  return out;
}

export function monthName(m: number): string {
  return HIJRI_MONTHS[(m - 1 + 12) % 12];
}

export function monthTitle(year: number, month: number): string {
  return `${monthName(month)} ${year} هـ`;
}

export function fridayOrdinal(index: number): string {
  return `الجمعة ${ORDINALS[index - 1] ?? index}`;
}

/** 27 نوفمبر */
export function gregShort(iso: string): string {
  const d = parseDate(iso);
  return `${d.getUTCDate()} ${GREG_MONTHS[d.getUTCMonth()]}`;
}

export function gregLong(iso: string): string {
  const d = parseDate(iso);
  return `${d.getUTCDate()} ${GREG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** 6 جمادى الآخرة */
export function hijriShort(day: number, month: number): string {
  return `${day} ${monthName(month)}`;
}

export function nextHijriMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}
