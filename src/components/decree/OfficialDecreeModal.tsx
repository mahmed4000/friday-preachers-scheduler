import React, { useRef } from 'react';
import {
  Printer,
  Download,
  X,
  CheckCircle2,
  Calendar,
  Building2,
  Users2,
  ShieldCheck,
  QrCode,
  Award,
} from 'lucide-react';
import { MonthlySchedule, Friday, Assignment, Mosque, Imam } from '../../types/index.ts';
import { triggerPrintWindow } from '../../lib/pdfExport.ts';

interface OfficialDecreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  mosques: Mosque[];
  imams: Imam[];
}

export function OfficialDecreeModal({
  isOpen,
  onClose,
  schedule,
  fridays,
  assignments,
  mosques,
  imams,
}: OfficialDecreeModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));
  const assignmentMap = new Map<string, Assignment>();
  for (const a of assignments) {
    assignmentMap.set(`${a.mosqueId}:${a.fridayIndex}`, a);
  }

  const handlePrint = () => {
    if (printAreaRef.current) {
      const ok = triggerPrintWindow(
        printAreaRef.current,
        `محضر التوزيع والاعتماد الرسمي - شهر ${schedule.monthName} ${schedule.hijriYear} هـ`,
        'landscape'
      );
      if (!ok) {
        window.print();
      }
    } else {
      window.print();
    }
  };

  const activeMosques = mosques.filter((m) => m.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-300 overflow-hidden my-2 sm:my-6 flex flex-col max-h-[92vh]">
        {/* Modal Top Bar (Screen Only) */}
        <div className="p-3 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 no-print shrink-0">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold font-heading">
                كشف التوزيع والاعتماد الرسمي المعتمد (جاهز للطباعة والتوثيق A4)
              </h3>
              <p className="text-[11px] text-slate-400">
                جدول شهر {schedule.monthName} {schedule.hijriYear} هـ · الإصدار V{schedule.currentVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الكشف الرسمي</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body */}
        <div
          ref={printAreaRef}
          className="p-8 overflow-y-auto flex-1 text-slate-900 bg-white font-serif leading-relaxed text-right space-y-6"
        >
          {/* Official Waqf Header */}
          <div className="border-b-2 border-emerald-900 pb-4 flex items-center justify-between text-xs">
            {/* Right: Ministry / Association Title */}
            <div className="space-y-1 font-heading">
              <span className="text-[11px] font-bold text-slate-600 block">جمهورية مصر العربية</span>
              <h2 className="text-base font-extrabold text-emerald-900 block">
                الجمعية الشرعية الرئيسية لتعاون العاملين بالكتاب والسنة
              </h2>
              <span className="text-xs font-bold text-slate-700 block">
                أمانة المساجد والشؤون الدينية والدعوية — فرع منشأة البكاري
              </span>
            </div>

            {/* Middle: Emblems & Decree Badge */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-2 border-emerald-800 mx-auto flex items-center justify-center p-1 bg-emerald-50">
                <ShieldCheck className="w-10 h-10 text-emerald-800" />
              </div>
              <span className="text-[10px] font-bold text-emerald-900 mt-1 block">
                معتمد رسمي وموثق
              </span>
            </div>

            {/* Left: Metadata & Dates */}
            <div className="text-left space-y-1 font-sans text-[11px]" dir="ltr">
              <div><span className="font-bold">Doc Ref:</span> PREACH-{schedule.hijriYear}-{schedule.hijriMonth}-V{schedule.currentVersion}</div>
              <div><span className="font-bold">Hijri Period:</span> {schedule.monthName} {schedule.hijriYear} AH</div>
              <div><span className="font-bold">Fridays:</span> {schedule.fridaysCount} Fridays</div>
              <div><span className="font-bold">Printed At:</span> {new Date().toLocaleDateString('ar-EG')}</div>
            </div>
          </div>

          {/* Title Banner */}
          <div className="text-center py-2 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <h1 className="text-xl font-bold font-heading text-emerald-950">
              محضر التوزيع الرسمي لخطباء الجمعة لشهر {schedule.monthName} لسنة {schedule.hijriYear} هـ
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              موزع ومعتمد وفق الضوابط الشرعية والقواعد الوقفية المعتمدة لمدينة منشأة البكاري
            </p>
          </div>

          {/* Table of Mosques and Assigned Preachers */}
          <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-emerald-900 text-white font-heading text-center">
                  <th className="py-2.5 px-3 border border-emerald-800 w-12">م</th>
                  <th className="py-2.5 px-3 border border-emerald-800 text-right w-48">المسجد والمنطقة</th>
                  {fridays.map((f) => (
                    <th key={f.id} className="py-2.5 px-3 border border-emerald-800 min-w-[130px]">
                      <div>{f.ordinalName}</div>
                      <div className="text-[10px] font-normal opacity-90">{f.hijriDate}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                {activeMosques.map((mosque, idx) => (
                  <tr key={mosque.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                    <td className="py-2 px-2 text-center font-bold text-slate-500 border border-slate-200">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border border-slate-200 font-bold text-slate-900">
                      <div className="flex items-center justify-between gap-1">
                        <span>{mosque.name}</span>
                        <span className="text-[10px] font-mono font-normal text-slate-500 bg-slate-100 px-1 rounded">
                          {mosque.code}
                        </span>
                      </div>
                      <span className="text-[10px] font-normal text-slate-500 block">
                        {mosque.region || 'المنطقة'}
                      </span>
                    </td>

                    {fridays.map((f) => {
                      const assign = assignmentMap.get(`${mosque.id}:${f.fridayIndex}`);
                      const imam = assign?.imamId ? imamMap.get(assign.imamId) : null;

                      return (
                        <td
                          key={f.id}
                          className="py-2 px-2 border border-slate-200 text-center align-middle"
                        >
                          {imam ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-900 block text-[11px] leading-tight">
                                {imam.name}
                              </span>
                              <span className="text-[9px] text-slate-500 block">
                                {imam.type === 'FIXED' ? '(راتب)' : '(منتدب)'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-rose-700 font-bold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded">
                              شاغر
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Footer: Signatures & QR Seal */}
          <div className="pt-6 border-t-2 border-emerald-900 grid grid-cols-4 gap-4 text-center text-xs">
            {/* Signature 1 */}
            <div className="space-y-8">
              <span className="font-bold text-slate-800 block">مقرر لجنة المساجد:</span>
              <span className="text-slate-400 block">..................................</span>
            </div>

            {/* Signature 2 */}
            <div className="space-y-8">
              <span className="font-bold text-slate-800 block">أمين الشؤون الدينية:</span>
              <span className="text-emerald-900 font-bold block">
                {schedule.approvedBy || 'فضيلة الشيخ / مدير الأمانة'}
              </span>
            </div>

            {/* Signature 3 */}
            <div className="space-y-8">
              <span className="font-bold text-slate-800 block">رئيس مجلس الإدارة:</span>
              <span className="text-slate-400 block">..................................</span>
            </div>

            {/* Waqf Verification Stamp & QR Code */}
            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="w-16 h-16 bg-white p-1 rounded-lg border border-emerald-300 flex items-center justify-center">
                <QrCode className="w-14 h-14 text-emerald-900" />
              </div>
              <span className="text-[9px] font-bold text-emerald-900 mt-1">
                رمز التحقق الإلكتروني
              </span>
              <span className="text-[8px] text-slate-500">
                وثيقة رسمية معتمدة
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
