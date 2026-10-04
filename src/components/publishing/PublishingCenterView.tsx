import React, { useState, useRef } from 'react';
import {
  MonthlySchedule,
  Friday,
  Assignment,
  Mosque,
  Imam,
  OrganizationSettings,
} from '../../types/index.ts';
import {
  Printer,
  Building2,
  Users,
  Download,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings as SettingsIcon,
  Eye,
  Check,
  Calendar,
} from 'lucide-react';
import { exportElementToPdf, triggerPrintWindow, downloadPrintableHtml } from '../../lib/pdfExport.ts';
import { exportScheduleToExcel } from '../../lib/excelExport.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { OrnamentalSeparator } from '../ui/OrnamentalSeparator.tsx';
import { SearchableSelect, SearchableOption } from '../common/SearchableSelect.tsx';
import { MosqueScheduleDocument } from './MosqueScheduleDocument.tsx';
import {
  IslamicPatternOverlay,
  MosqueSkylineSilhouette,
  IslamicStarNumber,
  IslamicFooterOrnament,
} from './ReportAssets.tsx';

interface PublishingCenterViewProps {
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  mosques: Mosque[];
  imams: Imam[];
  settings: OrganizationSettings;
  onOpenSettings?: () => void;
}

export function PublishingCenterView({
  schedule,
  fridays,
  assignments,
  mosques,
  imams,
  settings,
  onOpenSettings,
}: PublishingCenterViewProps) {
  // Document selector: City, Mosque, Imam
  const [activePrintDoc, setActivePrintDoc] = useState<'CITY' | 'MOSQUE' | 'IMAM'>('CITY');
  const [previewMode, setPreviewMode] = useState<'SCREEN' | 'PRINT_PREVIEW' | 'PDF_VIEW'>('SCREEN');

  const [selectedMosqueId, setSelectedMosqueId] = useState<number>(mosques[0]?.id || 1);
  const [selectedImamId, setSelectedImamId] = useState<number>(imams[0]?.id || 1);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const printDocumentRef = useRef<HTMLDivElement>(null);

  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));

  const assignmentMap = new Map<string, Assignment>();
  for (const a of assignments) {
    assignmentMap.set(`${a.mosqueId}:${a.fridayIndex}`, a);
  }

  const selectedMosque = mosqueMap.get(selectedMosqueId);
  const selectedImam = imamMap.get(selectedImamId);

  const imamOptions: SearchableOption[] = imams
    .filter((i) => i.isActive)
    .map((i) => ({
      id: i.id,
      label: i.name,
      sublabel: i.region || 'محافظة الجيزة',
      badge: i.type === 'FIXED' ? 'خطيب ثابت' : i.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن',
      code: String(i.id),
    }));

  const mosqueOptions: SearchableOption[] = mosques
    .filter((m) => m.isActive)
    .map((m) => ({
      id: m.id,
      label: m.name,
      sublabel: m.region || 'محافظة الجيزة',
      code: m.code,
    }));

  // Arabic ordinals for fridays
  const fridayOrdinals = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة'];

  // Download PDF directly
  const handleDownloadPdf = async () => {
    if (!printDocumentRef.current) return;
    setIsExportingPdf(true);
    setStatusMessage(null);

    try {
      let fileName = '';
      let orientation: 'portrait' | 'landscape' = 'portrait';

      if (activePrintDoc === 'CITY') {
        fileName = `جدول_المدينة_الشامل_${schedule.monthName.replace(/\s+/g, '_')}_${schedule.hijriYear}هـ.pdf`;
        orientation = 'landscape';
      } else if (activePrintDoc === 'MOSQUE' && selectedMosque) {
        fileName = `جدول_${selectedMosque.name.replace(/\s+/g, '_')}_${schedule.monthName.replace(/\s+/g, '_')}_${schedule.hijriYear}هـ.pdf`;
        orientation = 'landscape';
      } else if (activePrintDoc === 'IMAM' && selectedImam) {
        fileName = `تكليفات_الشيخ_${selectedImam.name.replace(/\s+/g, '_')}_${schedule.monthName.replace(/\s+/g, '_')}_${schedule.hijriYear}هـ.pdf`;
        orientation = 'portrait';
      }

      await exportElementToPdf(printDocumentRef.current, {
        fileName,
        orientation,
      });

      setStatusMessage({
        text: `تم تصدير وتحميل ملف الـ PDF بنجاح (${fileName})`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      console.error('PDF export error:', err);
      setStatusMessage({
        text: `تعذر إنشاء ملف الـ PDF (${err.message || 'خطأ في المعالجة'}). يمكنك استخدام زر "تقرير للطباعة (HTML)" أو "طباعة مباشرة".`,
        type: 'error',
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Standalone printable HTML report download
  const handleDownloadHtml = () => {
    if (!printDocumentRef.current) return;
    const orientation: 'portrait' | 'landscape' =
      activePrintDoc === 'IMAM' ? 'portrait' : 'landscape';
    const title =
      activePrintDoc === 'CITY'
        ? `جدول خطباء الجمعة - شهر ${schedule.monthName} ${schedule.hijriYear} هـ`
        : activePrintDoc === 'MOSQUE' && selectedMosque
        ? `جدول خطباء ${selectedMosque.name}`
        : `تكليفات خطباء الجمعة`;
    const fileName =
      activePrintDoc === 'CITY'
        ? `تقرير_طباعة_المدينة_${schedule.monthName.replace(/\s+/g, '_')}_${schedule.hijriYear}هـ.html`
        : activePrintDoc === 'MOSQUE' && selectedMosque
        ? `تقرير_طباعة_${selectedMosque.name.replace(/\s+/g, '_')}.html`
        : `تقرير_طباعة_تكليف.html`;

    downloadPrintableHtml(printDocumentRef.current, title, fileName, orientation);
    setStatusMessage({
      text: 'تم تنزيل ملف التقرير الجاهز للطباعة (HTML) بنجاح!',
      type: 'success',
    });
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Browser print trigger
  const handlePrint = async () => {
    if (!printDocumentRef.current) return;
    const orientation: 'portrait' | 'landscape' =
      activePrintDoc === 'IMAM' ? 'portrait' : 'landscape';
    const title =
      activePrintDoc === 'CITY'
        ? `جدول خطباء الجمعة - شهر ${schedule.monthName} ${schedule.hijriYear} هـ`
        : activePrintDoc === 'MOSQUE' && selectedMosque
        ? `جدول خطباء ${selectedMosque.name}`
        : `تكليفات خطباء الجمعة`;

    const success = triggerPrintWindow(printDocumentRef.current, title, orientation);
    if (!success) {
      setStatusMessage({
        text: 'جارٍ تنزيل المستند كـ PDF تلقائياً بصيغة ممتازة للطباعة...',
        type: 'success',
      });
      await handleDownloadPdf();
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    try {
      exportScheduleToExcel(schedule, fridays, assignments, mosques, imams, settings);
      setStatusMessage({
        text: `تم تصدير ملف Excel بنجاح لشهر ${schedule.monthName}`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      console.error('Excel export error:', err);
      setStatusMessage({
        text: 'تعذر تصدير ملف Excel',
        type: 'error',
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Control Panel Bar (Hidden on print) */}
      <div className="no-print bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300">
                تقارير رسمية معتمدة
              </span>
              <span className="text-xs text-slate-500 font-mono">{settings.city}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 font-heading">
              مركز النشر والطباعة وتوليد الجداول
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              طباعة وتصدير جداول الجمعية الرسمية عالية الدقة، جدول المدينة الشامل أو جداول المساجد والخطباء المستقلة.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              طباعة مباشرة
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={handleDownloadPdf}
              isLoading={isExportingPdf}
              leftIcon={<Download className="w-4 h-4 text-emerald-800" />}
            >
              تحميل ملف PDF
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={handleDownloadHtml}
              title="تنزيل صفحة تقرير HTML مستقلة للطباعة"
              leftIcon={<FileText className="w-4 h-4 text-slate-600" />}
            >
              تقرير HTML
            </Button>

            {activePrintDoc === 'CITY' && (
              <Button
                variant="secondary"
                size="md"
                onClick={handleExportExcel}
                leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-700" />}
              >
                تصدير Excel
              </Button>
            )}

            {onOpenSettings && (
              <Button
                variant="ghost"
                size="md"
                onClick={onOpenSettings}
                leftIcon={<SettingsIcon className="w-4 h-4 text-slate-500" />}
              >
                إعدادات الشعار
              </Button>
            )}
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="underline text-[11px] cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Document Selector & Preview Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Document Tabs */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActivePrintDoc('CITY')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activePrintDoc === 'CITY'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-emerald-800" />
              <span>جدول المدينة العام (Landscape)</span>
            </button>

            <button
              onClick={() => setActivePrintDoc('MOSQUE')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activePrintDoc === 'MOSQUE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-sky-700" />
              <span>جدول المسجد المعتمد (A4 Landscape)</span>
            </button>

            <button
              onClick={() => setActivePrintDoc('IMAM')}
              className={`px-3 py-1.5 text-xs font-heading font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activePrintDoc === 'IMAM'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-700" />
              <span>تكليف الخطيب المستقل (Portrait)</span>
            </button>
          </div>

          {/* Sub-selectors with Searchable Combobox */}
          {activePrintDoc === 'MOSQUE' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 font-heading">المسجد:</span>
              <SearchableSelect
                options={mosqueOptions}
                value={selectedMosqueId}
                onChange={setSelectedMosqueId}
                placeholder="ابحث باسم المسجد أو الكود أو المنطقة..."
                iconType="MOSQUE"
              />
            </div>
          )}

          {activePrintDoc === 'IMAM' && (
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-700 font-heading">الخطيب:</span>
              <SearchableSelect
                options={imamOptions}
                value={selectedImamId}
                onChange={setSelectedImamId}
                placeholder="ابحث باسم الخطيب، الكود، أو المنطقة..."
                iconType="IMAM"
              />
            </div>
          )}

          {/* Preview Modes */}
          <div className="flex items-center gap-1.5 text-xs font-heading">
            <span className="text-slate-500 font-medium ml-1">المعاينة:</span>
            <button
              onClick={() => setPreviewMode('SCREEN')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                previewMode === 'SCREEN'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              عرض الشاشة
            </button>
            <button
              onClick={() => setPreviewMode('PRINT_PREVIEW')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer ${
                previewMode === 'PRINT_PREVIEW'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              معاينة الطباعة
            </button>
          </div>
        </div>
      </div>

      {/* 2. THE OFFICIAL REPORT CONTAINER */}
      <div
        className={`flex justify-center overflow-x-auto print:overflow-visible pb-12 ${
          previewMode === 'PRINT_PREVIEW' ? 'bg-slate-200/60 p-6 rounded-2xl' : ''
        }`}
        dir="rtl"
      >
        {/* ============================================================== */}
        {/* DOCUMENT 1: CITY SCHEDULE (Landscape View)                     */}
        {/* ============================================================== */}
        {activePrintDoc === 'CITY' && (
          <div
            id="city-schedule-document"
            ref={printDocumentRef}
            className="relative bg-[#fcfaf6] text-slate-900 rounded-2xl border border-[#c4a468] shadow-md print:p-0 print:border-none print:shadow-none w-full max-w-6xl p-8 sm:p-10 pdf-report-document"
            dir="rtl"
            style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" }}
          >
            <IslamicPatternOverlay className="opacity-[0.04]" />
            <MosqueSkylineSilhouette className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none" />
            <div className="pointer-events-none absolute inset-3 rounded-xl border border-[#d8c399]/60" aria-hidden="true" />

            {/* 1. Official Header */}
            <div className="relative z-10 text-center space-y-2 pb-3">
              {/* Logo in top center */}
              {settings.logoUrl && (
                <div className="w-16 h-16 mx-auto mb-2 flex items-center justify-center p-0.5 rounded-full bg-white border-2 border-[#c5a059]/70 shadow-xs overflow-hidden">
                  <img
                    src={settings.logoUrl}
                    alt="شعار الجمعية"
                    className="w-full h-full object-contain rounded-full"
                  />
                </div>
              )}

              <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-950 tracking-tight">
                {settings.associationName}
              </h1>

              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-600">
                <span>{settings.departmentName}</span>
                <span className="text-amber-700 select-none">❖</span>
                <span>{settings.branchName}</span>
              </div>

              <div className="pt-2">
                <span className="inline-block px-4 py-1 rounded-md bg-emerald-900 text-white font-bold text-sm font-heading shadow-2xs">
                  جدول خطباء الجمعة لشهر {schedule.monthName} {schedule.hijriYear} هـ
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-500 pt-1 font-mono">
                <span>{fridays.length} جمعات</span>
                <span className="text-slate-300">•</span>
                <span>{mosques.length} مسجداً</span>
                <span className="text-slate-300">•</span>
                <span>{imams.length} خطيباً</span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-800 font-bold">الإصدار: V{schedule.currentVersion}</span>
              </div>
            </div>

            {/* Subtle Ornamental Divider */}
            <OrnamentalSeparator variant="gold" className="my-3" />

            {/* 2. Official Table (Dark Emerald Header + Fine Gold Line) */}
            <div className="overflow-x-auto print:overflow-visible pdf-table-container mt-4">
              <table className="w-full text-right text-xs border border-slate-300 border-collapse pdf-table">
                <thead>
                  <tr className="bg-emerald-950 text-white font-bold border-b-2 border-amber-500">
                    <th className="py-2.5 px-3 border border-emerald-900 w-12 text-center font-heading">
                      م
                    </th>
                    <th className="py-2.5 px-3 border border-emerald-900 w-56 font-heading">
                      اسم المسجد / الجامع
                    </th>
                    <th className="py-2.5 px-3 border border-emerald-900 w-24 font-heading">
                      المنطقة
                    </th>
                    {fridays.map((f, i) => (
                      <th
                        key={f.id}
                        className="py-2 px-3 border border-emerald-900 text-center font-heading"
                      >
                        <span className="block font-bold text-white text-xs">
                          الجمعة {fridayOrdinals[i] || f.fridayIndex}
                        </span>
                        <span className="block text-[11px] font-normal text-amber-200 mt-0.5">
                          {f.hijriDate}
                        </span>
                        {f.gregorianDate && (
                          <span className="block text-[10px] font-light text-slate-300 font-mono">
                            {f.gregorianDate}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {mosques
                    .filter((m) => m.isActive)
                    .map((mosque, idx) => (
                      <tr
                        key={mosque.id}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-[#faf9f6]'}
                      >
                        <td className="py-2.5 px-3 border border-slate-200 text-center font-bold text-slate-600 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200">
                          <span className="font-bold text-slate-900 block font-heading">
                            {mosque.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            كود: {mosque.code}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border border-slate-200 text-slate-700 font-medium">
                          {mosque.region}
                        </td>

                        {fridays.map((f) => {
                          const assign = assignmentMap.get(`${mosque.id}:${f.fridayIndex}`);
                          const imam = assign?.imamId ? imamMap.get(assign.imamId) : null;
                          return (
                            <td
                              key={f.id}
                              className="py-2.5 px-2 border border-slate-200 text-center"
                            >
                              {imam ? (
                                <div className="space-y-0.5">
                                  <span className="font-bold text-slate-900 block font-heading text-xs">
                                    {imam.name}
                                  </span>
                                  <div className="flex items-center justify-center gap-1">
                                    {assign?.source === 'FIXED' && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-950 border border-emerald-300">
                                        راتب
                                      </span>
                                    )}
                                    {assign?.source === 'PREFERENCE' && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-100 text-amber-950 border border-amber-300">
                                        مفضل
                                      </span>
                                    )}
                                    {assign?.isLocked && (
                                      <span className="text-[9px] text-slate-400">🔒</span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-rose-700 font-bold italic text-[11px] bg-rose-50 px-2 py-0.5 rounded">
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

            {/* 3. Official Signatures Footer */}
            <div className="mt-8 pt-6 border-t-2 border-slate-200 flex items-center justify-between text-xs text-slate-800">
              <div className="text-center space-y-6">
                <span className="font-bold block font-heading">{settings.schedulePreparerTitle}</span>
                <p className="text-[11px] text-slate-500 font-mono">{settings.schedulePreparerName}</p>
              </div>

              <div className="text-center space-y-6">
                <span className="font-bold block font-heading text-emerald-950">{settings.managerTitle}</span>
                <p className="text-[11px] text-slate-500">{settings.managerName}</p>
              </div>

              <div className="text-center space-y-6">
                <span className="font-bold block font-heading">{settings.boardPresidentTitle}</span>
                <p className="text-[11px] text-slate-500">{settings.boardPresidentName}</p>
              </div>
            </div>

            {/* Bottom Meta & Page numbering */}
            <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>{settings.associationName} — {settings.city}</span>
              <span>تم إعداد وتوثيق الجدول عبر نظام منظّم الجمعة</span>
              <span>صفحة 1 من 1</span>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* DOCUMENT 2: MOSQUE SCHEDULE (Landscape View - Ref Design)      */}
        {/* ============================================================== */}
        {activePrintDoc === 'MOSQUE' && selectedMosque && (
          <MosqueScheduleDocument
            ref={printDocumentRef}
            schedule={schedule}
            fridays={fridays}
            assignments={assignments}
            mosque={selectedMosque}
            imams={imams}
            settings={settings}
          />
        )}

        {/* ============================================================== */}
        {/* DOCUMENT 3: IMAM SCHEDULE (Portrait View)                      */}
        {/* ============================================================== */}
        {activePrintDoc === 'IMAM' && selectedImam && (
          <div
            id="imam-schedule-document"
            ref={printDocumentRef}
            className="relative bg-[#fcfaf6] text-slate-900 rounded-2xl border border-[#c4a468] shadow-md print:p-0 print:border-none print:shadow-none w-full max-w-2xl p-8 sm:p-10 pdf-report-document"
            dir="rtl"
            style={{ fontFamily: "'IBM Plex Sans Arabic', 'Tajawal', sans-serif" }}
          >
            <IslamicPatternOverlay className="opacity-[0.04]" />
            <MosqueSkylineSilhouette className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none" />
            <div className="pointer-events-none absolute inset-3 rounded-xl border border-[#d8c399]/60" aria-hidden="true" />

            {/* Header */}
            <div className="relative z-10 text-center space-y-2 pb-3">
              {settings.logoUrl && (
                <div className="w-14 h-14 mx-auto mb-1 flex items-center justify-center p-0.5 rounded-full bg-white border-2 border-[#c5a059]/70 shadow-xs overflow-hidden">
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain rounded-full" />
                </div>
              )}
              <h2 className="text-lg font-bold font-heading text-slate-900">
                {settings.associationName}
              </h2>
              <p className="text-xs text-slate-600 font-semibold">
                {settings.departmentName} — {settings.branchName}
              </p>

              <div className="pt-2">
                <span className="inline-block px-4 py-1.5 rounded-lg bg-[#124233] text-white font-bold text-sm font-heading shadow-2xs">
                  بيان تكليفات خطب الجمعة لفضيلة الشيخ / {selectedImam.name}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                شهر {schedule.monthName} لعام {schedule.hijriYear} هـ
              </p>
            </div>

            <OrnamentalSeparator variant="gold" className="my-3 relative z-10" />

            {/* Assignments List */}
            <div className="relative z-10 space-y-3 mt-4">
              {fridays.map((f, i) => {
                const assign = assignments.find(
                  (a) => a.imamId === selectedImam.id && a.fridayIndex === f.fridayIndex
                );
                const mosque = assign ? mosqueMap.get(assign.mosqueId) : null;

                return (
                  <div
                    key={f.id}
                    className="p-3.5 rounded-xl border border-[#e8dfcf] bg-white/95 flex items-center justify-between shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <IslamicStarNumber number={i + 1} />
                      <div>
                        <span className="text-xs font-bold text-[#103b2c] font-heading block">
                          الجمعة {fridayOrdinals[i] || f.fridayIndex}
                        </span>
                        <span className="text-xs text-slate-500 font-mono block mt-0.5">
                          {f.hijriDate}
                        </span>
                        {f.gregorianDate && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {f.gregorianDate}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left">
                      {mosque ? (
                        <div>
                          <span className="text-sm font-bold text-slate-900 font-heading block">
                            {mosque.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {mosque.region} · {mosque.address || ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">راحة / غير مكلف</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preacher Blessing Footer */}
            <div className="relative z-10 mt-8 pt-5 border-t border-[#e8dfcf] text-center text-xs text-slate-700 leading-relaxed font-heading">
              {settings.footerNote ||
                'نسأل الله لفضيلتكم التوفيق والسداد والقبول، وجزاكم الله عنا وعن المسلمين خير الجزاء.'}
            </div>

            <div className="relative z-10 mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>{settings.associationName} — {settings.city}</span>
              <span>أمانة شؤون المساجد والخطباء</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
