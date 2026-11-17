import { useState } from 'react';
import { Copy, FileDown, Loader2, MessageCircle, PhoneOff, Send } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import { Button, LinkButton, Modal } from '../ui/kit.tsx';
import { isValidPhone, waLink } from '../lib/whatsapp.ts';
import { canShareFiles, downloadBlob, openChat, shareFile, type Attachment } from '../lib/share.ts';

/**
 * أزرار إرسال رسالة على واتساب:
 * - الأساسي: "إرسال مع PDF" — على الموبايل بيفتح المشاركة بالملف والرسالة مع بعض،
 *   وعلى الكمبيوتر بينزّل الملف ويفتح المحادثة بالرسالة (تسحب الملف فيها).
 * - ثانوي: الرسالة نص بس، ونسخ النص.
 */
export function SendActions({
  phone,
  message,
  pdf,
  sent = false,
  onSent,
}: {
  phone: string;
  /** نص الرسالة، مع إشارة للمرفق لما withPdf */
  message: (withPdf: boolean) => string;
  pdf?: () => Promise<Attachment>;
  sent?: boolean;
  onSent?: () => void;
}) {
  const { toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState<Attachment | null>(null);
  const hasPhone = Boolean(phone) && isValidPhone(phone);
  const mobile = canShareFiles();

  const sendPdf = async () => {
    if (!pdf) return;
    // لازم نفتح النافذة قبل أي انتظار، وإلا المتصفح بيمنعها
    const win = !mobile && hasPhone ? window.open('about:blank', '_blank') : null;
    setBusy(true);
    try {
      const file = await pdf();
      const text = message(true);
      if (mobile) {
        const r = await shareFile(file, text);
        if (r === 'shared') onSent?.();
        if (r === 'needs-tap') setReady(file);
      } else if (hasPhone) {
        downloadBlob(file);
        openChat(phone, text, win);
        onSent?.();
        toast('اتنزل الملف واتفتحت المحادثة. اسحب الملف جوه الرسالة وابعت.');
      } else {
        downloadBlob(file);
        toast('اتنزل ملف الـ PDF. مفيش رقم واتساب مسجل.');
      }
    } catch (e) {
      win?.close();
      toast(`ما قدرتش أجهز الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message(false));
      toast('اتنسخت الرسالة');
    } catch {
      toast('ما قدرتش أنسخ', 'error');
    }
  };

  const canPrimary = pdf && (mobile || hasPhone);

  return (
    <div className="flex items-center gap-1.5">
      {pdf && (
        <Button
          size="sm"
          variant={sent ? 'outline' : canPrimary ? 'whatsapp' : 'outline'}
          onClick={sendPdf}
          disabled={busy}
          title={canPrimary ? 'الرسالة ومعاها ملف PDF على واتساب' : 'تنزيل ملف PDF'}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : canPrimary ? <Send className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
          {canPrimary ? (sent ? 'ابعت تاني' : 'إرسال مع PDF') : 'تنزيل PDF'}
        </Button>
      )}
      {hasPhone ? (
        <LinkButton
          size="sm"
          variant={pdf ? 'ghost' : sent ? 'outline' : 'whatsapp'}
          href={waLink(phone, message(false))}
          onClick={() => onSent?.()}
          title="الرسالة نص بس من غير ملف"
          aria-label="رسالة نص على واتساب"
        >
          <MessageCircle className="w-4 h-4" />
          {pdf ? <span className="hidden sm:inline">نص فقط</span> : sent ? 'ابعت تاني' : 'واتساب'}
        </LinkButton>
      ) : (
        <span className="inline-flex items-center gap-1 text-[12px] text-bad px-1.5"><PhoneOff className="w-4 h-4" />مفيش رقم</span>
      )}
      <Button size="sm" variant="ghost" onClick={copy} title="نسخ نص الرسالة" aria-label="نسخ نص الرسالة">
        <Copy className="w-4 h-4" />
      </Button>

      {ready && (
        <Modal open title="الملف جاهز للإرسال" onClose={() => setReady(null)}>
          <p className="text-sm text-muted mb-4">{ready.filename}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="whatsapp"
              className="flex-1"
              onClick={async () => {
                const r = await shareFile(ready, message(true)).catch(() => 'cancelled' as const);
                if (r === 'shared') onSent?.();
                if (r !== 'needs-tap') setReady(null);
              }}
            >
              <Send className="w-4 h-4" />
              ابعته على واتساب
            </Button>
            <Button variant="outline" onClick={() => { downloadBlob(ready); setReady(null); }}>
              <FileDown className="w-4 h-4" />
              تنزيل
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
