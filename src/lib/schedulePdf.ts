import type { Month, Settings } from '../data/types.ts';
import { fridayOrdinal, gregLong, hijriShort, monthTitle } from './hijri.ts';
import { sheetPdf } from './sheet.ts';
import { waLink } from './whatsapp.ts';

export type PdfFile = { blob: Blob; filename: string; text: string };

type PreacherItem = { fridayIndex: number; date: string; hijriDay: number; mosqueName: string };
type MosqueItem = { fridayIndex: number; date: string; hijriDay: number; preacher: string; phone?: string };

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').trim();

export async function preacherPdf(settings: Settings, month: Month, name: string, items: PreacherItem[], portal?: string): Promise<PdfFile> {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const notes = [
    portal ? 'للتأكيد أو الاعتذار افتح صفحتك الخاصة:' : '',
    portal ?? '',
    settings.admin_name || settings.admin_phone
      ? `للتواصل: ${settings.admin_name ? `أ. ${settings.admin_name}` : 'مسؤول الدعوة'}${settings.admin_phone ? ` · ${settings.admin_phone}` : ''}`
      : '',
    'برجاء الحضور قبل الأذان بوقت كافٍ.',
  ].filter(Boolean);
  const blob = await sheetPdf({
    orgName: settings.org_name,
    branchName: settings.branch_name,
    kicker: 'جدول خطب الجمعة',
    monthTitle: title,
    name: `فضيلة الشيخ ${name}`,
    subtitle: `عدد الجمعات: ${items.length}`,
    columns: [
      { label: 'الجمعة', width: 2 },
      { label: 'التاريخ الهجري', width: 2.4 },
      { label: 'التاريخ الميلادي', width: 2.4 },
      { label: 'المسجد', width: 3.6, strong: true },
    ],
    rows: items.map((i) => [fridayOrdinal(i.fridayIndex), hijriShort(i.hijriDay, month.hijri_month), gregLong(i.date), i.mosqueName]),
    notes,
    closing: 'جزاكم الله خيرًا ونفع بكم',
  });
  return {
    blob,
    filename: `جدول ${safe(name)} - ${safe(title)}.pdf`,
    text: `السلام عليكم ورحمة الله، فضيلة الشيخ ${name}، مرفق جدول خطبكم لشهر ${title}. جزاكم الله خيرًا.`,
  };
}

export async function mosquePdf(settings: Settings, month: Month, mosqueName: string, items: MosqueItem[]): Promise<PdfFile> {
  const title = monthTitle(month.hijri_year, month.hijri_month);
  const hasPhones = items.some((i) => i.phone);
  const blob = await sheetPdf({
    orgName: settings.org_name,
    branchName: settings.branch_name,
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
    notes: [
      settings.admin_name || settings.admin_phone
        ? `لأي تغيير: ${settings.admin_name ? `أ. ${settings.admin_name}` : 'مسؤول الدعوة'}${settings.admin_phone ? ` · ${settings.admin_phone}` : ''}`
        : 'لأي تغيير برجاء التواصل مع مسؤول الدعوة.',
    ],
    closing: 'نسأل الله القبول',
  });
  return {
    blob,
    filename: `جدول ${safe(mosqueName)} - ${safe(title)}.pdf`,
    text: `السلام عليكم ورحمة الله، مرفق جدول خطباء الجمعة في ${mosqueName} لشهر ${title}.`,
  };
}

/** هل الجهاز يقدر يبعت ملفات من خلال قايمة المشاركة (الموبايل غالبًا) */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type ShareResult = 'shared' | 'cancelled' | 'needs-tap' | 'downloaded';

/** على الموبايل: يفتح قايمة المشاركة بالملف (تختار واتساب ثم الشخص). */
export async function shareFile(file: PdfFile): Promise<ShareResult> {
  const f = new File([file.blob], file.filename, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [f], text: file.text, title: file.filename });
    return 'shared';
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'needs-tap';
    throw e;
  }
}

/** على الكمبيوتر: ينزّل الملف ويفتح محادثة الواتساب بالرسالة، وانت تسحب الملف فيها. */
export function downloadAndOpenChat(file: PdfFile, phone: string, win: Window | null) {
  downloadBlob(file.blob, file.filename);
  const link = waLink(phone, `${file.text}\n(الملف مرفق)`);
  if (win) win.location.href = link;
  else window.open(link, '_blank', 'noopener');
}
