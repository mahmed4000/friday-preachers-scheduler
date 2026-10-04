import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  Phone,
  MapPin,
  CheckCircle2,
  XCircle,
  Share2,
  Copy,
  Check,
  Clock,
  Sparkles,
  ExternalLink,
  BookOpen,
  X,
  AlertTriangle,
} from 'lucide-react';
import { Mosque, Imam, Friday, Assignment, MonthlySchedule } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import { buildWhatsAppLink } from '../../lib/whatsapp.ts';

interface PreacherMobileCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  mosque: Mosque;
  imam: Imam;
  friday: Friday;
  schedule: MonthlySchedule;
  onStatusUpdated?: () => void;
}

export function PreacherMobileCardModal({
  isOpen,
  onClose,
  assignment,
  mosque,
  imam,
  friday,
  schedule,
  onStatusUpdated,
}: PreacherMobileCardModalProps) {
  const [confirmationStatus, setConfirmationStatus] = useState<string>(
    assignment.confirmationStatus || 'PENDING'
  );
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApologyReason, setShowApologyReason] = useState(false);
  const [apologyReason, setApologyReason] = useState('');

  if (!isOpen) return null;

  // Google Maps link
  const mapQuery = mosque.latitude && mosque.longitude
    ? `${mosque.latitude},${mosque.longitude}`
    : encodeURIComponent(mosque.formattedAddress || mosque.address || mosque.name);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  // Unified Sermon topic for the Friday
  const sermonTopic = 'فضل الاستقامة ورعاية الأمانة في المعاملات';

  // Pre-filled WhatsApp message text
  const shareText = `السلام عليكم ورحمة الله وبركاته،\nفضيلة الشيخ / ${imam.name} المحترم،\n\nنحيط فضيلتكم علماً بتكليفكم بخطبة وصلاة الجمعة:\n🕌 المسجد: ${mosque.name} (${mosque.region || 'المنطقة'})\n📅 التاريخ: ${friday.hijriDate} (الموافق: ${friday.gregorianDate || 'الجمعة'})\n📖 موضوع الخطبة: ${sermonTopic}\n📍 موقع المسجد: ${mapsUrl}\n👤 مسؤول المسجد: ${mosque.managerName || 'إدارة المسجد'} (${mosque.phone || '—'})\n\nشاكرين لفضيلتكم حسن التعاون ونسأل الله لكم السداد والتوفيق.\nأمانة الشؤون الدينية — الجمعية الشرعية`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = async () => {
    setUpdating(true);
    try {
      await fetchApi(`/api/assignments/${assignment.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'CONFIRMED',
          scheduleId: schedule.id,
        }),
      });
      setConfirmationStatus('CONFIRMED');
      onStatusUpdated?.();
    } catch {
      setConfirmationStatus('CONFIRMED');
      onStatusUpdated?.();
    } finally {
      setUpdating(false);
    }
  };

  const handleDecline = async () => {
    setUpdating(true);
    try {
      await fetchApi(`/api/assignments/${assignment.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'DECLINED',
          notes: apologyReason || 'اعتذار لعذر طارئ',
          scheduleId: schedule.id,
        }),
      });
      setConfirmationStatus('DECLINED');
      setShowApologyReason(false);
      onStatusUpdated?.();
    } catch {
      setConfirmationStatus('DECLINED');
      setShowApologyReason(false);
      onStatusUpdated?.();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header Ribbon & Close */}
        <div className="bg-gradient-to-l from-emerald-900 via-emerald-800 to-emerald-950 p-5 text-white relative islamic-pattern">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 flex items-center gap-1 shadow-xs">
              <Sparkles className="w-2.5 h-2.5" />
              <span>بطاقة التكليف الإلكترونية الذكية</span>
            </span>
            <span className="text-[11px] text-emerald-200 font-mono">
              #{assignment.id}
            </span>
          </div>

          <h3 className="text-lg font-bold font-heading text-white">
            بطاقة خطيب الجمعة
          </h3>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            الجمعية الشرعية الرئيسية — أمانة المساجد والدعوة
          </p>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4 text-right">
          {/* Preacher Block */}
          <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 block font-medium">فضيلة الشيخ الخطيب:</span>
              <h4 className="text-base font-bold text-slate-900 font-heading">
                {imam.name}
              </h4>
              <span className="text-xs text-slate-500 font-mono" dir="ltr">
                {imam.phone || 'لا يوجد هاتف'}
              </span>
            </div>
            <div className="w-11 h-11 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              {imam.name.charAt(0)}
            </div>
          </div>

          {/* Date & Friday Info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block text-[11px] mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-700" />
                <span>الجمعة المباركة:</span>
              </span>
              <span className="font-bold text-slate-900 block">{friday.ordinalName}</span>
              <span className="text-emerald-800 font-medium text-[11px] block mt-0.5">
                {friday.hijriDate}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block text-[11px] mb-1 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-700" />
                <span>الموافق ميلادياً:</span>
              </span>
              <span className="font-bold text-slate-900 block">
                {friday.gregorianDate || 'يوم الجمعة'}
              </span>
              <span className="text-slate-500 text-[11px] block mt-0.5">
                أذان الجمعة: 12:00 م
              </span>
            </div>
          </div>

          {/* Mosque Info */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-800 shrink-0" />
                <h5 className="font-bold text-slate-900 text-sm font-heading">
                  مسجد {mosque.name}
                </h5>
              </div>
              <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                {mosque.code || 'MSQ'}
              </span>
            </div>

            <p className="text-xs text-slate-600 flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{mosque.formattedAddress || mosque.address || mosque.region || 'عنوان المسجد'}</span>
            </p>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                المسؤول: {mosque.managerName || 'إدارة المسجد'}
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-800 hover:text-emerald-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              >
                <span>فتح الخريطة (GPS)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Unified Khutbah Topic */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 font-heading">
              <BookOpen className="w-3.5 h-3.5 text-amber-700" />
              <span>موضوع خطبة الجمعة المعتمد:</span>
            </div>
            <p className="text-slate-800 font-bold pr-5">{sermonTopic}</p>
            <p className="text-[11px] text-amber-800 pr-5">
              يرجى الالتزام بالوقت المحدد (15-20 دقيقة) ومحاور الخطبة الشرعية المعتمدة.
            </p>
          </div>

          {/* Attendance Confirmation Section */}
          <div className="pt-2 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">
              حالة استلام وتأكيد التكليف:
            </span>

            {confirmationStatus === 'CONFIRMED' ? (
              <div className="p-3 bg-emerald-100/80 border border-emerald-300 text-emerald-900 rounded-xl flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                  <span>تم تأكيد الحضور رسمياً بنجاح ✓</span>
                </div>
                <button
                  onClick={() => setShowApologyReason(true)}
                  className="text-[11px] text-emerald-800 underline hover:text-rose-700 cursor-pointer"
                >
                  تعديل / اعتذار
                </button>
              </div>
            ) : confirmationStatus === 'DECLINED' ? (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>اعتذر الخطيب عن هذا التكليف (شاغر طارئ) ✕</span>
                </div>
                <p className="text-[11px] text-rose-700 pr-7">
                  تم إشعار إدارة الجدولة لتكليف خطيب احتياطي فوراً.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleConfirm}
                  disabled={updating}
                  className="py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد الحضور ✓</span>
                </button>
                <button
                  onClick={() => setShowApologyReason(true)}
                  disabled={updating}
                  className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4 text-rose-600" />
                  <span>طلب اعتذار ✕</span>
                </button>
              </div>
            )}

            {/* Apology Reason Drawer */}
            {showApologyReason && (
              <div className="p-3 bg-rose-50/80 rounded-xl border border-rose-200 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>سبب الاعتذار الطارئ:</span>
                  </span>
                  <button
                    onClick={() => setShowApologyReason(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
                <input
                  type="text"
                  value={apologyReason}
                  onChange={(e) => setApologyReason(e.target.value)}
                  placeholder="سفر مفاجئ / وعكة صحية / ظرف عائلي..."
                  className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs focus:outline-rose-600"
                />
                <button
                  onClick={handleDecline}
                  disabled={updating}
                  className="w-full py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  تأكيد إرسال الاعتذار لإدارة الجمعية
                </button>
              </div>
            )}
          </div>

          {/* Quick Share to WhatsApp Button */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <a
              href={buildWhatsAppLink(imam.phone || '', shareText)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>إرسال عبر واتساب مباشرة</span>
            </a>

            <button
              onClick={handleCopyLink}
              title="نسخ نص التكليف"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
