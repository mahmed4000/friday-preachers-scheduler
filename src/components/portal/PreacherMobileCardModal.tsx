import React, { useState, useEffect } from 'react';
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
  Award,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Edit3,
  Save,
} from 'lucide-react';
import { Mosque, Imam, Friday, Assignment, MonthlySchedule, ProfileAssignmentItem, ScheduleSummaryItem } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import { buildWhatsAppLink } from '../../lib/whatsapp.ts';
import { CalendarService } from '../../services/calendar/calendarService.ts';
import {
  getKhutbahTopic,
  setAssignmentCustomKhutbahTopic,
  POPULAR_SUGGESTED_TOPICS,
} from '../../services/khutbahTopicsService.ts';

export interface PreacherCardAssignmentItem {
  assignment: Assignment | ProfileAssignmentItem;
  mosque: Mosque;
  friday: Friday;
}

export interface PreacherMobileCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment?: Assignment | ProfileAssignmentItem | null;
  mosque?: Mosque | null;
  imam: Imam;
  friday?: Friday | null;
  schedule?: MonthlySchedule | ScheduleSummaryItem | null;
  assignmentsList?: PreacherCardAssignmentItem[];
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
  assignmentsList = [],
  onStatusUpdated,
}: PreacherMobileCardModalProps) {
  const currentHijri = CalendarService.getCurrentDateTime().hijri;
  const hYear = schedule?.hijriYear || currentHijri.year;
  const hMonth = schedule?.hijriMonth || currentHijri.month;

  // If list is provided, track active index
  const [selectedIdx, setSelectedIdx] = useState(0);

  // Auto-select clicked Friday or first active / upcoming Friday when opening
  useEffect(() => {
    if (isOpen && assignmentsList.length > 0) {
      if (friday) {
        const matchingIdx = assignmentsList.findIndex(
          (item) => item.friday.fridayIndex === friday.fridayIndex
        );
        if (matchingIdx !== -1) {
          setSelectedIdx(matchingIdx);
          return;
        }
      }
      const firstUpcomingIdx = assignmentsList.findIndex((item) => {
        const v = CalendarService.validateFridayAction(hYear, hMonth, item.friday.fridayIndex);
        return !v.isPastFriday;
      });
      if (firstUpcomingIdx !== -1) {
        setSelectedIdx(firstUpcomingIdx);
      } else {
        setSelectedIdx(assignmentsList.length - 1);
      }
    }
  }, [isOpen, assignmentsList.length, friday?.fridayIndex, hYear, hMonth]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Active assignment & mosque & friday
  const activeItem =
    assignmentsList.length > 0 && selectedIdx < assignmentsList.length
      ? assignmentsList[selectedIdx]
      : assignment && mosque && friday
      ? { assignment, mosque, friday }
      : null;

  const currentAssignment = activeItem?.assignment || null;
  const currentMosque = activeItem?.mosque || null;
  const currentFriday = activeItem?.friday || null;

  // Determine if selected Friday is already in the past
  const isPastFriday = currentFriday
    ? CalendarService.validateFridayAction(hYear, hMonth, currentFriday.fridayIndex).isPastFriday
    : false;

  const [confirmationStatus, setConfirmationStatus] = useState<string>(
    currentAssignment?.confirmationStatus || 'PENDING'
  );
  const [updating, setUpdating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showApologyReason, setShowApologyReason] = useState(false);
  const [apologyReason, setApologyReason] = useState('');

  // Sermon topic state (customizable directly on card or global)
  const [sermonTopic, setSermonTopic] = useState<string>('فضل الاستقامة ورعاية الأمانة في المعاملات');
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');

  // Sync confirmation status when switching assignment
  useEffect(() => {
    if (currentAssignment) {
      setConfirmationStatus(currentAssignment.confirmationStatus || 'PENDING');
    }
  }, [currentAssignment]);

  // Sync sermon topic when switching Friday
  useEffect(() => {
    if (currentFriday) {
      const topic = getKhutbahTopic(
        currentFriday.fridayIndex,
        schedule?.id,
        currentAssignment?.id,
        hYear,
        hMonth
      );
      setSermonTopic(topic);
      setTopicDraft(topic);
      setIsEditingTopic(false);
    }
  }, [currentFriday?.fridayIndex, currentAssignment?.id, schedule?.id, hYear, hMonth]);

  const handleSaveTopic = () => {
    if (!topicDraft.trim() || !currentFriday) return;
    if (currentAssignment?.id) {
      setAssignmentCustomKhutbahTopic(currentAssignment.id, topicDraft.trim());
    }
    setSermonTopic(topicDraft.trim());
    setIsEditingTopic(false);
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Google Maps link
  const mapQuery =
    currentMosque?.latitude && currentMosque?.longitude
      ? `${currentMosque.latitude},${currentMosque.longitude}`
      : currentMosque
      ? encodeURIComponent(currentMosque.formattedAddress || currentMosque.address || currentMosque.name)
      : '';
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

  // Pre-filled WhatsApp message text
  const shareText = currentAssignment && currentMosque && currentFriday
    ? isPastFriday
      ? `السلام عليكم ورحمة الله وبركاته،\nفضيلة الشيخ / ${imam.name} المحترم،\n\nنشارك مع فضيلتكم بيانات الجمعة المؤرشفة السابقة:\n🕌 المسجد: ${currentMosque.name} (${currentMosque.region || 'المنطقة'})\n📅 التاريخ: ${currentFriday.hijriDate} (الموافق: ${currentFriday.gregorianDate || 'الجمعة'})\n📖 موضوع الخطبة: ${sermonTopic}\n📍 موقع المسجد: ${mapsUrl}\n\nتقبل الله منا ومنكم صالح الأعمال وجزاكم الله خيراً.\nالجمعية الشرعية — فرع منشأة البكاري`
      : `السلام عليكم ورحمة الله وبركاته،\nفضيلة الشيخ / ${imam.name} المحترم،\n\nنحيط فضيلتكم علماً بتكليفكم بخطبة وصلاة الجمعة القادمة:\n🕌 المسجد: ${currentMosque.name} (${currentMosque.region || 'المنطقة'})\n📅 التاريخ: ${currentFriday.hijriDate} (الموافق: ${currentFriday.gregorianDate || 'الجمعة'})\n📖 موضوع الخطبة: ${sermonTopic}\n📍 موقع المسجد: ${mapsUrl}\n👤 مسؤول المسجد: ${currentMosque.managerName || 'إدارة المسجد'} (${currentMosque.phone || '—'})\n\nشاكرين لفضيلتكم حسن التعاون ونسأل الله لكم السداد والتوفيق.\nأمانة الشؤون الدينية — الجمعية الشرعية`
    : `السلام عليكم ورحمة الله وبركاته،\nفضيلة الشيخ / ${imam.name} المحترم،\nتحية طيبة مباركة من أمانة شؤون المساجد والدعوة بالجمعية الشرعية.\n\nكود الخطيب: PRE-${imam.id}\nالنوع: ${imam.type === 'FIXED' ? 'خطيب راتب' : 'خطيب مرن'}\n\nنسأل الله لكم دوام التوفيق والسداد.`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleConfirm = async () => {
    if (!currentAssignment) return;
    setUpdating(true);
    try {
      await fetchApi(`/api/assignments/${currentAssignment.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'CONFIRMED',
          scheduleId: schedule?.id,
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
    if (!currentAssignment) return;
    setUpdating(true);
    try {
      await fetchApi(`/api/assignments/${currentAssignment.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'DECLINED',
          notes: apologyReason || 'اعتذار لعذر طارئ',
          scheduleId: schedule?.id,
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

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2.5rem)] flex flex-col bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-amber-300/60 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header Ribbon & Close */}
        <div className="shrink-0 bg-gradient-to-l from-emerald-950 via-emerald-900 to-emerald-950 p-4 sm:p-5 text-white relative border-b-2 border-amber-400">
          <button
            onClick={onClose}
            className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-all shadow-xs border border-white/20 cursor-pointer z-10"
            title="إغلاق البطاقة (الرد لاحقاً)"
          >
            <X className="w-3.5 h-3.5" />
            <span>إغلاق</span>
          </button>

          <div className="flex items-center gap-2 mb-2 pr-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-300 text-slate-950 flex items-center gap-1 shadow-xs border border-amber-500/30">
              <Sparkles className="w-2.5 h-2.5 text-amber-950" />
              <span>الكارت الذهبي للخطيب 📱</span>
            </span>
            <span className="text-[11px] text-amber-200 font-mono font-bold">
              PRE-{imam.id}
            </span>
          </div>

          <h3 className="text-lg font-black font-heading text-white flex items-center gap-2">
            <span>بطاقة التكليف والتعريف الذكية</span>
          </h3>
          <p className="text-xs text-emerald-200/90 mt-0.5 font-medium">
            الجمعية الشرعية — فرع منشأة البكاري • أمانة شؤون المساجد
          </p>

          {/* Multiple Assignments Tabs (if any) */}
          {assignmentsList.length > 1 && (
            <div className="mt-3 pt-3 border-t border-emerald-800/80 flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="text-[10px] text-emerald-300 font-bold shrink-0">اختر الجمعة:</span>
              {assignmentsList.map((item, idx) => {
                const itemCheck = CalendarService.validateFridayAction(hYear, hMonth, item.friday.fridayIndex);
                const isItemPast = itemCheck.isPastFriday;
                return (
                  <button
                    key={item.assignment.id || idx}
                    onClick={() => setSelectedIdx(idx)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      selectedIdx === idx
                        ? 'bg-amber-400 text-slate-950 shadow-xs ring-2 ring-amber-300'
                        : isItemPast
                        ? 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900'
                        : 'bg-emerald-800 text-white hover:bg-emerald-700'
                    }`}
                  >
                    <span>جمعة {item.friday.fridayIndex}</span>
                    {isItemPast ? (
                      <span className="text-[9px] bg-slate-900/60 text-slate-300 px-1 py-0.2 rounded font-normal">منتهية ⏱️</span>
                    ) : (
                      <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded font-normal">قادمة 🟢</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5 space-y-4 text-right overflow-y-auto flex-1 overscroll-contain">
          {/* Preacher Block */}
          <div className="p-3.5 bg-gradient-to-r from-amber-50/60 to-emerald-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between shadow-2xs">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Award className="w-3.5 h-3.5 text-amber-700" />
                <span className="text-[11px] text-emerald-900 block font-bold">فضيلة الشيخ الداعية:</span>
              </div>
              <h4 className="text-base font-black text-slate-900 font-heading">
                {imam.name}
              </h4>
              <span className="text-xs text-slate-600 font-mono font-bold" dir="ltr">
                {imam.phone || 'غير مسجل هاتف'}
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 text-amber-300 flex items-center justify-center font-black text-lg shadow-xs shrink-0 border border-amber-400/50">
              {imam.name.charAt(0)}
            </div>
          </div>

          {/* Condition 1: When Preacher has an active Friday assignment */}
          {currentAssignment && currentMosque && currentFriday ? (
            <>
              {/* Date & Friday Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-1 flex items-center gap-1 font-semibold">
                    <Calendar className="w-3 h-3 text-emerald-700" />
                    <span>الجمعة المباركة:</span>
                  </span>
                  <span className="font-black text-slate-900 block font-heading">{currentFriday.ordinalName}</span>
                  <span className="text-emerald-800 font-bold text-[11px] block mt-0.5">
                    {currentFriday.hijriDate}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block text-[11px] mb-1 flex items-center gap-1 font-semibold">
                    <Clock className="w-3 h-3 text-amber-700" />
                    <span>الموافق ميلادياً:</span>
                  </span>
                  <span className="font-black text-slate-900 block">
                    {currentFriday.gregorianDate || 'يوم الجمعة'}
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
                      مسجد {currentMosque.name}
                    </h5>
                  </div>
                  <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-600">
                    {currentMosque.code || 'MSQ'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{currentMosque.formattedAddress || currentMosque.address || currentMosque.region || 'منشأة البكاري — الجيزة'}</span>
                </p>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500 text-[11px]">
                    المسؤول: {currentMosque.managerName || 'إدارة المسجد'}
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

              {/* Unified / Custom Khutbah Topic */}
              <div className="p-3.5 bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-300 rounded-2xl text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 font-heading">
                    <BookOpen className="w-4 h-4 text-amber-700" />
                    <span>موضوع خطبة الجمعة:</span>
                  </div>
                  {!isPastFriday && (
                    <button
                      onClick={() => setIsEditingTopic(!isEditingTopic)}
                      className="text-[11px] font-bold text-amber-900 hover:text-amber-950 bg-amber-200/80 hover:bg-amber-300 px-2 py-0.5 rounded-lg border border-amber-400/50 flex items-center gap-1 transition-all cursor-pointer"
                      title="تحديد أو تغيير موضوع الخطبة لهذا التكليف"
                    >
                      <Edit3 className="w-3 h-3 text-amber-800" />
                      <span>{isEditingTopic ? 'إلغاء' : 'تحديد / تغيير الموضوع ✏️'}</span>
                    </button>
                  )}
                </div>

                {isEditingTopic ? (
                  <div className="space-y-2 pt-1 border-t border-amber-200">
                    <input
                      type="text"
                      value={topicDraft}
                      onChange={(e) => setTopicDraft(e.target.value)}
                      placeholder="اكتب عنوان وموضوع الخطبة..."
                      className="w-full p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                    {/* Popular suggestions */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-amber-900 font-bold block">موضوعات مقترحة سريعة:</span>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                        {POPULAR_SUGGESTED_TOPICS.slice(0, 6).map((sugg, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            onClick={() => setTopicDraft(sugg)}
                            className="text-[10px] bg-white hover:bg-amber-100 text-slate-800 px-2 py-0.5 rounded-md border border-amber-200 transition-colors text-right cursor-pointer"
                          >
                            {sugg}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingTopic(false)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveTopic}
                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>حفظ واعتماد</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-900 font-black pr-5 text-sm leading-snug">{sermonTopic}</p>
                    <p className="text-[11px] text-amber-900 pr-5">
                      يرجى الالتزام بالوقت المحدد (15-20 دقيقة) ومحاور الخطبة الشرعية المعتمدة.
                    </p>
                  </>
                )}
              </div>

              {/* Attendance Confirmation Section */}
              <div className="pt-1 space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  حالة استلام وتأكيد التكليف:
                </span>

                {isPastFriday ? (
                  <div className="p-3.5 bg-slate-100/90 border border-slate-300 rounded-2xl space-y-2 text-xs text-slate-700">
                    <div className="flex items-center gap-2 font-black text-slate-800">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>جمعة منتهية / مؤرشفة (انقضى موعدها) ⏱️</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed pr-6">
                      انقضى موعد هذه الجمعة وانتهت في الواقع، وأزرار التأكيد أو الاعتذار غير مفعلة للجمع السابقة لحماية دقة السجلات.
                    </p>
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px] font-bold">
                      <span className="text-slate-500">حالة التكليف المسجلة:</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full ${
                          confirmationStatus === 'CONFIRMED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : confirmationStatus === 'DECLINED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {confirmationStatus === 'CONFIRMED'
                          ? 'حاضر (تم بنجاح ✓)'
                          : confirmationStatus === 'DECLINED'
                          ? 'معتذر ✕'
                          : 'قيد المراجعة'}
                      </span>
                    </div>
                  </div>
                ) : confirmationStatus === 'CONFIRMED' ? (
                  <div className="p-3 bg-emerald-100/90 border border-emerald-300 text-emerald-950 rounded-xl flex items-center justify-between text-xs font-bold">
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
                  <div className="space-y-2">
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

                    <button
                      onClick={onClose}
                      className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>سأجيب لاحقاً (إبقاء التكليف معلقاً)</span>
                    </button>
                  </div>
                )}

                {/* Apology Reason Drawer */}
                {!isPastFriday && showApologyReason && (
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
            </>
          ) : (
            /* Condition 2: Preacher Golden Identity Card (General / Standby) */
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] text-slate-500 block font-medium">تصنيف الخطيب:</span>
                  <span className="font-bold text-emerald-900 block mt-0.5">
                    {imam.type === 'FIXED'
                      ? 'خطيب راتب (ثابت)'
                      : imam.type === 'PARTIAL_FIXED'
                      ? 'ثابت جزئي'
                      : 'خطيب مرن (توزيع)'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block font-medium">المنطقة والسكن:</span>
                  <span className="font-bold text-slate-900 block mt-0.5">
                    {imam.region || 'فرع منشأة البكاري'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block font-medium">الهدف الشهري:</span>
                  <span className="font-bold text-amber-900 block mt-0.5">
                    {imam.targetFridays || 4} جمعات
                  </span>
                </div>

                <div>
                  <span className="text-[11px] text-slate-500 block font-medium">النطاق المسموح:</span>
                  <span className="font-mono text-slate-700 block mt-0.5">
                    {imam.minFridays || 1} إلى {imam.maxFridays || 5} جمعات
                  </span>
                </div>
              </div>

              {/* Status info box */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950 font-heading">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>حالة الخطيب في سجل الجدولة:</span>
                </div>
                <p className="text-slate-800 pr-5 font-medium leading-relaxed">
                  فضيلة الشيخ معتمد ونشط في المنظومة، وهو حالياً على قائمة الاستعداد للتكليف بجمعات الشهر أو سد الشواغر الطارئة فورياً.
                </p>
              </div>

              {imam.notes && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                  <strong>ملاحظات وشروط خاصة:</strong> {imam.notes}
                </div>
              )}
            </div>
          )}

          {/* Quick Share to WhatsApp Button */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <a
              href={buildWhatsAppLink(imam.phone || '', shareText)}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {isPastFriday
                  ? 'مشاركة تفاصيل الجمعة المؤرشفة عبر واتساب'
                  : currentAssignment
                  ? 'إرسال التكليف عبر واتساب'
                  : 'مراسلة الخطيب عبر واتساب'}
              </span>
            </a>

            <button
              onClick={handleCopyLink}
              title="نسخ نص التكليف"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Dedicated Close / Answer Later Bottom Button */}
          <div className="pt-1">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200"
            >
              <Clock className="w-4 h-4 text-slate-500" />
              <span>إغلاق الكارت والرد لاحقاً</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
