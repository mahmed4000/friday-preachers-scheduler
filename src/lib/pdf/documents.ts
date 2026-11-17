/** ملفات PDF الجاهزة للإرسال: جدول الخطيب، جدول المسجد، تكليف/تذكير جمعة واحدة */
import type { Month, Settings } from '../../data/types.ts';
import type { MosqueRow, MsgItem } from '../messages.ts';
import type { Attachment } from '../share.ts';
import { fridayOrdinal, gregLong, hijriShort, monthTitle } from '../hijri.ts';
import { sheetPdf, type SheetColumn } from './sheet.ts';

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

const contact = (s: Settings, lead: string) =>
  s.admin_name || s.admin_phone ? `${lead}: ${s.admin_name ? `أ. ${s.admin_name}` : 'مسؤول الدعوة'}${s.admin_phone ? ` · ${s.admin_phone}` : ''}` : '';

const PREACHER_COLUMNS: SheetColumn[] = [
  { label: 'الجمعة', width: 2 },
  { label: 'التاريخ الهجري', width: 2.4 },
  { label: 'التاريخ الميلادي', width: 2.4 },
  { label: 'المسجد', width: 3.6, strong: true },
];

const preacherRow = (month: Month, i: MsgItem) => [fridayOrdinal(i.fridayIndex), hijriShort(i.hijriDay, month.hijri_month), gregLong(i.date), i.mosqueName];

const portalNotes = (portal?: string) => (portal ? ['للتأكيد أو الاعتذار افتح صفحتك الخاصة:', portal] : []);

/** جدول الخطيب للشهر */
export async function preacherPdf(s: Settings, month: Month, name: string, items: MsgItem[], portal?: string): Promise<Attachment> {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const blob = await sheetPdf({
    orgName: s.org_name,
    branchName: s.branch_name,
    kicker: 'جدول خطب الجمعة',
    monthTitle: title,
    name: `فضيلة الشيخ ${name}`,
    subtitle: `عدد الجمعات: ${items.length}`,
    columns: PREACHER_COLUMNS,
    rows: items.map((i) => preacherRow(month, i)),
    notes: [...portalNotes(portal), contact(s, 'للتواصل'), 'برجاء الحضور قبل الأذان بوقت كافٍ.'].filter(Boolean),
    closing: 'جزاكم الله خيرًا ونفع بكم',
  });
  return { blob, filename: `جدول ${safe(name)} - ${safe(title)}.pdf` };
}

/** جمعة واحدة: تكليف جديد أو تذكير قبل الجمعة */
export async function fridayPdf(
  kind: 'assignment' | 'reminder',
  s: Settings,
  month: Month,
  name: string,
  item: MsgItem,
  portal?: string
): Promise<Attachment> {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const reminder = kind === 'reminder';
  const blob = await sheetPdf({
    orgName: s.org_name,
    branchName: s.branch_name,
    kicker: reminder ? 'تذكير بخطبة الجمعة' : 'تكليف بخطبة الجمعة',
    monthTitle: title,
    name: `فضيلة الشيخ ${name}`,
    subtitle: item.mosqueName,
    columns: PREACHER_COLUMNS,
    rows: [preacherRow(month, item)],
    notes: [
      ...(reminder ? ['إن طرأ ما يمنعكم نرجو إبلاغنا في أقرب وقت من صفحتكم:', ...(portal ? [portal] : [])] : portalNotes(portal)),
      contact(s, 'للتواصل'),
      'برجاء الحضور قبل الأذان بوقت كافٍ.',
    ].filter(Boolean),
    closing: reminder ? 'نسأل الله أن يفتح عليكم وأن ينفع بكم' : 'جزاكم الله خيرًا ونفع بكم',
  });
  const label = reminder ? 'تذكير' : 'تكليف';
  return { blob, filename: `${label} ${safe(name)} - ${fridayOrdinal(item.fridayIndex)} ${safe(title)}.pdf` };
}

/** جدول خطباء المسجد للشهر */
export async function mosquePdf(s: Settings, month: Month, mosqueName: string, items: MosqueRow[]): Promise<Attachment> {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const hasPhones = items.some((i) => i.phone);
  const blob = await sheetPdf({
    orgName: s.org_name,
    branchName: s.branch_name,
    kicker: 'جدول خطباء الجمعة',
    monthTitle: title,
    name: mosqueName,
    columns: [
      { label: 'الجمعة', width: 2 },
      { label: 'التاريخ الهجري', width: 2.3 },
      { label: 'التاريخ الميلادي', width: 2.3 },
      { label: 'الخطيب', width: 3.4, strong: true },
      ...(hasPhones ? [{ label: 'الموبايل', width: 2.2, ltr: true }] : []),
    ],
    rows: items.map((i) => [
      fridayOrdinal(i.fridayIndex),
      hijriShort(i.hijriDay, month.hijri_month),
      gregLong(i.date),
      `الشيخ ${i.preacher}`,
      ...(hasPhones ? [i.phone ?? ''] : []),
    ]),
    notes: [contact(s, 'لأي تغيير') || 'لأي تغيير برجاء التواصل مع مسؤول الدعوة.'],
    closing: 'نسأل الله القبول',
  });
  return { blob, filename: `جدول ${safe(mosqueName)} - ${safe(title)}.pdf` };
}
