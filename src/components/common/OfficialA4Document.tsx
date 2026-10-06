import React, { useState } from 'react';
import { OrganizationSettings } from '../../types/index.ts';
import {
  MosqueHeaderArch,
  MosqueSkylineSilhouette,
  IslamicPatternOverlay,
  IslamicFooterOrnament,
} from '../publishing/ReportAssets.tsx';
import { Building2 } from 'lucide-react';

export interface SignatureSlot {
  title: string;
  name?: string;
}

export interface OfficialA4DocumentProps {
  id?: string;
  forwardedRef?: React.Ref<HTMLDivElement>;
  orientation?: 'portrait' | 'landscape';
  settings?: Partial<OrganizationSettings>;
  title: string;
  subtitle?: React.ReactNode;
  hijriPeriod?: string;
  gregorianPeriod?: string;
  metaBar?: React.ReactNode;
  headerRight?: React.ReactNode;
  headerLeft?: React.ReactNode;
  footerSignatures?: SignatureSlot[] | React.ReactNode;
  footerDate?: string;
  footerNote?: string;
  stampText?: string;
  className?: string;
  children: React.ReactNode;
}

export const OfficialA4Document = React.forwardRef<HTMLDivElement, OfficialA4DocumentProps>(
  (
    {
      id = 'official-a4-document',
      orientation = 'landscape',
      settings = {},
      title,
      subtitle,
      hijriPeriod,
      gregorianPeriod,
      metaBar,
      headerRight,
      headerLeft,
      footerSignatures,
      footerDate,
      footerNote,
      stampText = 'مكان الختم الرسمي',
      className = '',
      children,
    },
    ref
  ) => {
    const [logoLoadError, setLogoLoadError] = useState(false);

    const isLandscape = orientation === 'landscape';

    const associationName = settings.associationName || 'الجمعية الشرعية الرئيسية';
    const departmentName = settings.departmentName || 'أمانة شؤون المساجد والخطباء';
    const branchName = settings.branchName || 'منطقة الجيزة والوسط';

    // Default 3 official signatures if none specified
    const defaultSignatures: SignatureSlot[] = [
      {
        title: settings.schedulePreparerTitle || 'إعداد وتنسيق الجداول',
        name: settings.schedulePreparerName || 'لجنة شؤون الخطباء',
      },
      {
        title: settings.managerTitle || 'مدير إدارة شؤون المساجد',
        name: settings.managerName || 'فضيلة الشيخ / مدير الإدارة',
      },
      {
        title: settings.boardPresidentTitle || 'رئيس مجلس الإدارة والاعتماد',
        name: settings.boardPresidentName || 'رئيس الفرع والمشرف العام',
      },
    ];

    return (
      <div
        id={id}
        ref={ref}
        dir="rtl"
        lang="ar"
        className={`relative bg-[#fcfaf6] text-slate-900 rounded-2xl border border-[#c4a468] shadow-md print:shadow-none print:border-none print:m-0 w-full flex flex-col justify-between pdf-report-document ${
          isLandscape ? 'max-w-[1060px] min-h-[740px]' : 'max-w-[794px] min-h-[1050px]'
        } p-6 sm:p-8 ${className}`}
        style={{
          boxSizing: 'border-box',
          fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', 'Cairo', sans-serif",
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        {/* Subtle Islamic Geometric Pattern Overlay */}
        <IslamicPatternOverlay className="opacity-[0.04] no-print pointer-events-none" />

        {/* Bottom Mosque & Palm Skyline Silhouette */}
        <MosqueSkylineSilhouette
          className={`absolute bottom-0 left-0 right-0 ${
            isLandscape ? 'h-40' : 'h-32'
          } pointer-events-none no-print`}
        />

        {/* Inner Fine Gold Border Frame */}
        <div
          className="pointer-events-none absolute inset-3 rounded-xl border border-[#d8c399]/60 no-print"
          aria-hidden="true"
        />

        {/* ============================================================== */}
        {/* 1. TOP HEADER                                                  */}
        {/* ============================================================== */}
        <div className="relative z-10 flex items-start justify-between gap-4 pb-3 border-b border-[#e9dfcf]/80">
          {/* Header Left (Association Logo & Details) */}
          {headerLeft !== undefined ? (
            headerLeft
          ) : (
            <div className="w-[220px] shrink-0 text-right space-y-1">
              <div className="flex items-center gap-3">
                <div
                  className="print-logo-box w-14 h-14 shrink-0 flex items-center justify-center p-0.5 rounded-full bg-white border-2 border-[#c5a059]/70 shadow-xs overflow-hidden"
                  style={{
                    width: '56px',
                    height: '56px',
                    minWidth: '56px',
                    minHeight: '56px',
                    maxWidth: '56px',
                    maxHeight: '56px',
                  }}
                >
                  {settings.logoUrl && !logoLoadError ? (
                    <img
                      src={settings.logoUrl}
                      alt="شعار الجمعية"
                      width={52}
                      height={52}
                      onError={() => setLogoLoadError(true)}
                      className="print-logo-img w-full h-full object-contain rounded-full"
                      style={{
                        width: '52px',
                        height: '52px',
                        minWidth: '52px',
                        minHeight: '52px',
                        maxWidth: '52px',
                        maxHeight: '52px',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-emerald-900/10 flex items-center justify-center text-[#124233]">
                      <Building2 className="w-6 h-6 text-[#a8823b]" />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold font-heading text-[#103b2c] leading-tight">
                    {associationName}
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 mt-0.5 leading-tight">
                    {departmentName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-tight">
                    {branchName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Header Center (Title & Dates) */}
          <div className="flex-1 text-center px-2">
            <h1 className="text-2xl sm:text-[27px] font-bold font-heading text-[#124233] tracking-tight leading-snug">
              {title}
            </h1>

            {subtitle && (
              <div className="text-base sm:text-lg font-bold font-heading text-slate-900 mt-0.5">
                {subtitle}
              </div>
            )}

            {hijriPeriod && (
              <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1 font-heading">
                {hijriPeriod}
              </p>
            )}

            {gregorianPeriod && (
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                ({gregorianPeriod})
              </p>
            )}
          </div>

          {/* Header Right (Islamic Arch / Emblem) */}
          {headerRight !== undefined ? (
            headerRight
          ) : (
            <div className="w-[180px] sm:w-[220px] h-[100px] sm:h-[115px] shrink-0 rounded-bl-3xl rounded-tr-xl overflow-hidden border border-[#c5a059]/70 shadow-xs bg-[#f4eee3]">
              <MosqueHeaderArch className="w-full h-full" />
            </div>
          )}
        </div>

        {/* ============================================================== */}
        {/* 2. META BAR (Optional Info Badges/Bar)                         */}
        {/* ============================================================== */}
        {metaBar && <div className="relative z-10 my-3">{metaBar}</div>}

        {/* ============================================================== */}
        {/* 3. MAIN DOCUMENT BODY                                          */}
        {/* ============================================================== */}
        <div className="relative z-10 my-2 flex-1 flex flex-col justify-start">
          {children}
        </div>

        {/* ============================================================== */}
        {/* 4. FOOTER (Signatures, Stamps, System Info)                    */}
        {/* ============================================================== */}
        <div className="relative z-10 pt-4 border-t border-[#e8dfcf]/90 flex flex-col gap-3 mt-4 text-xs">
          {/* Signatures Row */}
          {footerSignatures !== undefined ? (
            Array.isArray(footerSignatures) ? (
              <div className="grid grid-cols-3 gap-4 text-center items-start">
                {footerSignatures.map((sig, idx) => (
                  <div key={idx} className="space-y-1">
                    <span className="font-bold font-heading text-slate-900 block text-xs">
                      {sig.title}
                    </span>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {sig.name || '................................'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              footerSignatures
            )
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center items-start">
              {defaultSignatures.map((sig, idx) => (
                <div key={idx} className="space-y-1">
                  <span className="font-bold font-heading text-slate-900 block text-xs">
                    {sig.title}
                  </span>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {sig.name}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Info Bar: Left Stamp, Center Ornament, Right Info */}
          <div className="flex items-end justify-between pt-2 border-t border-[#f0e7d8]/60">
            {/* System Details & Date */}
            <div className="text-right space-y-0.5">
              <p className="font-bold font-heading text-[#103b2c] text-xs">
                {associationName} — {branchName}
              </p>
              <p className="text-[11px] text-slate-500">
                {footerNote || 'تم إعداد واعتماد هذا المستند عبر نظام إدارة خطباء الجمعة'}
              </p>
              {footerDate && (
                <p className="text-[10px] text-slate-400 font-mono">
                  التاريخ: {footerDate}
                </p>
              )}
            </div>

            {/* Arabesque Golden Ornament */}
            <IslamicFooterOrnament className="pb-1 no-print" />

            {/* Stamp Slot */}
            <div className="text-left space-y-0.5 pl-2">
              <span className="font-bold font-heading text-slate-900 block text-[11px]">
                الختم والاعتماد
              </span>
              <div className="w-28 h-8 rounded border border-dashed border-[#c5a059]/50 bg-[#fdfbf7]/70 flex items-center justify-center text-[9px] text-slate-400">
                [{stampText}]
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

OfficialA4Document.displayName = 'OfficialA4Document';
