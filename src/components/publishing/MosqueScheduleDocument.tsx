import React from 'react';
import { MonthlySchedule, Friday, Assignment, Mosque, Imam, OrganizationSettings } from '../../types/index.ts';
import {
  Building2,
  MapPin,
  User,
  CalendarDays,
  Phone,
} from 'lucide-react';
import {
  MosqueHeaderArch,
  IslamicStarNumber,
  MosqueSkylineSilhouette,
  IslamicPatternOverlay,
  IslamicFooterOrnament,
} from './ReportAssets.tsx';

interface MosqueScheduleDocumentProps {
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  mosque: Mosque;
  imams: Imam[];
  settings: OrganizationSettings;
  id?: string;
  forwardedRef?: React.Ref<HTMLDivElement>;
}

const FRIDAY_ORDINALS = [
  'الجمعة الأولى',
  'الجمعة الثانية',
  'الجمعة الثالثة',
  'الجمعة الرابعة',
  'الجمعة الخامسة',
];

export const MosqueScheduleDocument = React.forwardRef<HTMLDivElement, MosqueScheduleDocumentProps>(
  ({ schedule, fridays, assignments, mosque, imams, settings, id = 'mosque-schedule-document' }, ref) => {
    // Map assignments for this mosque
    const assignmentMap = new Map<number, Assignment>();
    for (const a of assignments) {
      if (a.mosqueId === mosque.id) {
        assignmentMap.set(a.fridayIndex, a);
      }
    }

    const imamMap = new Map<number, Imam>(imams.map((i) => [i.id, i]));

    // Compute Gregorian Month Range from fridays
    const gregorianDates = fridays.map((f) => f.gregorianDate).filter(Boolean);
    let gregorianRange = 'فبراير - مارس 2027 م';
    if (gregorianDates.length > 0) {
      const firstParts = gregorianDates[0].split(' ');
      const lastParts = gregorianDates[gregorianDates.length - 1].split(' ');
      const firstMonth = firstParts[1] || '';
      const lastMonth = lastParts[1] || '';
      const year = lastParts[2] || firstParts[2] || '2027';
      if (firstMonth && lastMonth && firstMonth !== lastMonth) {
        gregorianRange = `${firstMonth} - ${lastMonth} ${year} م`;
      } else if (firstMonth) {
        gregorianRange = `${firstMonth} ${year} م`;
      }
    }

    const firstFriday = fridays[0];
    const footerDate = firstFriday
      ? `${firstFriday.hijriDate} / ${firstFriday.gregorianDate}`
      : '1 رمضان 1448 هـ / 19 فبراير 2027 م';

    return (
      <div
        id={id}
        ref={ref}
        dir="rtl"
        lang="ar"
        className="relative bg-[#fcfaf6] text-slate-900 rounded-2xl border border-[#c4a468] shadow-md print:shadow-none print:border-none print:m-0 w-full max-w-[1060px] min-h-[740px] p-6 sm:p-8 flex flex-col justify-between pdf-report-document"
        style={{
          boxSizing: 'border-box',
          fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif",
        }}
      >
        {/* Subtle Islamic Geometric Pattern Overlay */}
        <IslamicPatternOverlay className="opacity-[0.04]" />

        {/* Bottom Mosque & Palm Silhouette Accent */}
        <MosqueSkylineSilhouette className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" />

        {/* Inner Fine Gold Border Frame with Corner Indents */}
        <div
          className="pointer-events-none absolute inset-3 rounded-xl border border-[#d8c399]/60"
          aria-hidden="true"
        />

        {/* ============================================================== */}
        {/* 1. TOP HEADER (Logo Left | Title Center | Mosque Arch Right)    */}
        {/* ============================================================== */}
        <div className="relative z-10 flex items-start justify-between gap-4 pb-3 border-b border-[#e9dfcf]/80">
          {/* Top-Left: Association Logo & Branch Details */}
          <div className="w-[220px] shrink-0 text-right space-y-1">
            <div className="flex items-center gap-3">
              {settings.logoUrl && (
                <div className="w-14 h-14 shrink-0 flex items-center justify-center p-1 rounded-xl bg-white border border-[#c5a059]/40 shadow-2xs">
                  <img
                    src={settings.logoUrl}
                    alt="شعار الجمعية"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold font-heading text-[#103b2c] leading-tight">
                  {settings.associationName || 'الجمعية الشرعية'}
                </h3>
                <p className="text-xs font-semibold text-slate-600 mt-0.5 leading-tight">
                  {settings.departmentName || 'أمانة شؤون المساجد'}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">
                  {settings.branchName || 'منطقة الوسط'}
                </p>
              </div>
            </div>
          </div>

          {/* Top-Center: Main Document Titles */}
          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl sm:text-[27px] font-bold font-heading text-[#124233] tracking-tight leading-snug">
              جدول خطباء الجمعة
            </h1>

            <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-900 mt-0.5">
              <span className="text-[#b58c3f] font-semibold ml-1">لمسجد:</span>
              <span>{mosque.name}</span>
            </h2>

            <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1 font-heading">
              شهر {schedule.monthName} لعام {schedule.hijriYear} هـ
            </p>

            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              (الموافق: {gregorianRange})
            </p>
          </div>

          {/* Top-Right: Grand Mosque Arch Artwork (framed Islamic arch cutout) */}
          <div className="w-[200px] sm:w-[220px] h-[105px] sm:h-[115px] shrink-0 rounded-bl-3xl rounded-tr-xl overflow-hidden border border-[#c5a059]/70 shadow-xs bg-[#f4eee3]">
            <MosqueHeaderArch className="w-full h-full" />
          </div>
        </div>

        {/* ============================================================== */}
        {/* 2. HORIZONTAL MOSQUE INFO BAR (4 Sections matching reference)   */}
        {/* ============================================================== */}
        <div className="relative z-10 my-3">
          <div className="bg-white/90 backdrop-blur-xs rounded-xl border border-[#e5ddcf] shadow-2xs py-2 px-3 sm:px-4 grid grid-cols-4 divide-x divide-x-reverse divide-[#eee5d5]">
            {/* 1. Mosque Name (Rightmost in RTL) */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50/80 border border-[#e2d4b9] flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-[#a8823b]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 font-medium block leading-tight">
                  اسم المسجد
                </span>
                <span className="text-xs sm:text-sm font-bold font-heading text-slate-900 block truncate leading-tight mt-0.5">
                  {mosque.name}
                </span>
              </div>
            </div>

            {/* 2. Region & Mosque Code */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50/80 border border-[#e2d4b9] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-[#a8823b]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 font-medium block leading-tight">
                  المنطقة
                </span>
                <span className="text-xs sm:text-sm font-bold font-heading text-slate-900 block truncate leading-tight mt-0.5">
                  {mosque.region}
                </span>
                <span className="text-[10px] text-slate-500 font-mono block leading-tight">
                  الكود: {mosque.code}
                </span>
              </div>
            </div>

            {/* 3. Mosque Manager & Phone */}
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50/80 border border-[#e2d4b9] flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-[#a8823b]" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-slate-400 font-medium block leading-tight">
                  مسؤول المسجد
                </span>
                <span className="text-xs sm:text-sm font-bold font-heading text-slate-900 block truncate leading-tight mt-0.5">
                  {mosque.managerName || 'أ. فهد المنصور'}
                </span>
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 leading-tight">
                  <Phone className="w-2.5 h-2.5 text-slate-400" />
                  <span>{mosque.phone || mosque.whatsapp || '0505551234'}</span>
                </span>
              </div>
            </div>

            {/* 4. Total Fridays Count (Leftmost in RTL) */}
            <div className="flex items-center justify-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-lg bg-amber-50/80 border border-[#e2d4b9] flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-[#a8823b]" />
              </div>
              <div className="text-center">
                <span className="text-[11px] text-slate-400 font-medium block leading-tight">
                  عدد جمعات الشهر
                </span>
                <div className="flex items-baseline justify-center gap-1 mt-0.5">
                  <span className="text-base sm:text-lg font-bold font-heading text-[#103b2c] tabular-nums leading-none">
                    {fridays.length}
                  </span>
                  <span className="text-[11px] font-medium text-slate-600">جمعات</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 3. MAIN SCHEDULE TABLE (Identical to reference layout)          */}
        {/* ============================================================== */}
        <div className="relative z-10 my-2 flex-1 flex flex-col justify-start">
          {/* Table Header Bar: Dark Islamic Green with Gold borders */}
          <div className="bg-[#124233] text-white rounded-xl border border-[#c5a059] shadow-2xs overflow-hidden">
            <div className="flex items-center text-xs font-bold font-heading py-2.5 px-4">
              {/* الجمعة (يشمل الرقم والاسم) */}
              <div className="w-56 text-center shrink-0 text-white font-heading">
                الجمعة
              </div>

              {/* التاريخ (هجري | ميلادي) */}
              <div className="w-72 shrink-0 border-r border-[#1d5b47]">
                <div className="text-center text-[11px] text-amber-200/90 pb-0.5 border-b border-[#1d5b47]">
                  التاريخ
                </div>
                <div className="grid grid-cols-2 text-center text-[11px] text-white pt-0.5">
                  <span className="border-l border-[#1d5b47]/80">هجري</span>
                  <span>ميلادي</span>
                </div>
              </div>

              {/* خطيب الجمعة (Title Centered in Preacher Column) */}
              <div className="flex-1 text-center text-white font-heading border-r border-[#1d5b47]">
                خطيب الجمعة
              </div>
            </div>
          </div>

          {/* Table Rows (Dynamic 4 or 5 Fridays) */}
          <div className="space-y-2 mt-2">
            {fridays.map((friday, index) => {
              const assignment = assignmentMap.get(friday.fridayIndex);
              const assignedImam = assignment?.imamId ? imamMap.get(assignment.imamId) : null;
              const ordinalName = FRIDAY_ORDINALS[index] || `الجمعة ${friday.fridayIndex}`;

              return (
                <div
                  key={friday.id}
                  className="bg-white/95 rounded-xl border border-[#e8dfcf] shadow-2xs py-2 px-4 flex items-center hover:bg-[#fffdf9] transition-colors"
                >
                  {/* Column 1: Friday Ordinal + Star Number Badge */}
                  <div className="w-56 shrink-0 flex items-center justify-center gap-3 px-2 border-l border-[#f0e7d8]/60">
                    <IslamicStarNumber number={index + 1} />
                    <span className="text-xs sm:text-sm font-bold font-heading text-slate-900 block leading-tight">
                      {ordinalName}
                    </span>
                  </div>

                  {/* Column 2 & 3: Hijri & Gregorian Dates */}
                  <div className="w-72 shrink-0 grid grid-cols-2 text-center text-xs font-medium border-l border-[#f0e7d8]/60">
                    {/* Hijri Date */}
                    <div className="px-2 py-1 text-slate-800 font-heading">
                      {friday.hijriDate}
                    </div>

                    {/* Gregorian Date */}
                    <div className="px-2 py-1 text-slate-600 font-mono text-[11px] border-r border-[#f0e7d8]">
                      {friday.gregorianDate}
                    </div>
                  </div>

                  {/* Column 4: PREACHER (CENTERED HORIZONTALLY & VERTICALLY AS EXPLICITLY REQUESTED) */}
                  <div className="flex-1 flex items-center justify-center text-center px-4">
                    {assignedImam ? (
                      <div className="w-full max-w-[360px] mx-auto py-1.5 px-3 rounded-lg bg-emerald-50/70 border border-emerald-700/20 text-center flex flex-col items-center justify-center shadow-2xs">
                        <span className="font-bold text-sm sm:text-base font-heading text-[#0f382a] block leading-snug">
                          {assignedImam.name}
                        </span>
                        {assignedImam.phone && (
                          <span className="text-[11px] text-slate-600 font-mono flex items-center justify-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-[#a8823b]" />
                            <span dir="ltr">{assignedImam.phone}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="py-1 px-3 rounded-lg bg-rose-50 border border-rose-200 text-center">
                        <span className="text-xs font-bold text-rose-700 block">
                          شاغر (بانتظار التكليف) ⚠️
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 4. FOOTER (Signatures & Verification matching reference)       */}
        {/* ============================================================== */}
        <div className="relative z-10 pt-3 border-t border-[#e8dfcf]/90 flex items-end justify-between text-xs mt-3">
          {/* Footer Right: System Details & Date */}
          <div className="text-right space-y-0.5">
            <p className="font-bold font-heading text-[#103b2c] text-xs">
              {settings.associationName || 'الجمعية الشرعية'} — {settings.branchName || 'منطقة الوسط'}
            </p>
            <p className="text-[11px] text-slate-500">
              تم إعداد هذا الجدول بواسطة نظام إدارة خطباء الجمعة
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              التاريخ: {footerDate}
            </p>
          </div>

          {/* Footer Center: Golden Arabesque Ornament */}
          <IslamicFooterOrnament className="pb-1" />

          {/* Footer Left: Official Stamp & Approval */}
          <div className="text-left space-y-0.5 pl-2">
            <span className="font-bold font-heading text-slate-900 block text-xs">
              الختم والاعتماد
            </span>
            <span className="text-[11px] text-slate-600 font-medium block">
              {settings.departmentName || 'أمانة شؤون المساجد'}
            </span>
            <div className="w-28 h-8 rounded border border-dashed border-[#c5a059]/40 bg-[#fdfbf7]/60 flex items-center justify-center text-[9px] text-slate-400 mt-1">
              [مكان الختم الرسمي]
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MosqueScheduleDocument.displayName = 'MosqueScheduleDocument';
