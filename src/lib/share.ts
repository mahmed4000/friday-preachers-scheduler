/**
 * إرسال الملفات: على الموبايل من قايمة المشاركة (تختار واتساب ثم الشخص)،
 * وعلى الكمبيوتر بننزّل الملف ونفتح محادثة الواتساب بالرسالة.
 */
import { waLink } from './whatsapp.ts';

export type Attachment = { blob: Blob; filename: string };
export type ShareResult = 'shared' | 'cancelled' | 'needs-tap';

/** هل الجهاز يقدر يبعت ملفات من قايمة المشاركة (الموبايل غالبًا) */
export function canShareFiles(): boolean {
  try {
    const probe = new File([new Uint8Array(1)], 'x.pdf', { type: 'application/pdf' });
    return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

export function downloadBlob({ blob, filename }: Attachment) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** يفتح قايمة المشاركة بالملف ومعاه نص الرسالة */
export async function shareFile(file: Attachment, text: string): Promise<ShareResult> {
  const f = new File([file.blob], file.filename, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [f], text });
    return 'shared';
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'AbortError') return 'cancelled';
    // المتصفح بيطلب ضغطة جديدة لو التحضير أخد وقت
    if (name === 'NotAllowedError') return 'needs-tap';
    throw e;
  }
}

/**
 * يفتح محادثة واتساب بالنص. `win` نافذة اتفتحت قبل أي انتظار
 * (المتصفح بيمنع فتح نوافذ بعد await).
 */
export function openChat(phone: string, text: string, win?: Window | null) {
  const link = waLink(phone, text);
  if (win) win.location.href = link;
  else window.open(link, '_blank', 'noopener');
}
