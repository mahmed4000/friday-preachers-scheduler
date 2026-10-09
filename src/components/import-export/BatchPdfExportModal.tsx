import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal.tsx';
import {
  FileText,
  Printer,
  Download,
  Building2,
  Users2,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { Button } from '../ui/Button.tsx';
import { Imam, Mosque } from '../../types/index.ts';
import { DEFAULT_ORGANIZATION_SETTINGS, DEFAULT_SHARIA_LOGO } from '../../lib/defaultLogo.ts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface BatchPdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityType: 'IMAMS' | 'MOSQUES';
  selectedIds: number[];
  allImams?: Imam[];
  allMosques?: Mosque[];
  scheduleId?: number;
}

export function BatchPdfExportModal({
  isOpen,
  onClose,
  entityType,
  selectedIds,
  allImams = [],
  allMosques = [],
  scheduleId,
}: BatchPdfExportModalProps) {
  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [detailedItems, setDetailedItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || selectedIds.length === 0) return;

    async function loadBatchDetails() {
      setLoading(true);
      setError(null);
      try {
        const queryParam = scheduleId ? `?scheduleId=${scheduleId}` : '';
        if (entityType === 'IMAMS') {
          const promises = selectedIds.map((id) =>
            fetchApi<any>(`/api/imams/${id}/profile${queryParam}`).catch(() => null)
          );
          const results = await Promise.all(promises);
          const valid = results.filter(Boolean);
          if (valid.length === 0) {
            // Fallback to local imams if profile fetch failed
            const localList = allImams.filter((i) => selectedIds.includes(i.id)).map((i) => ({ imam: i, assignments: [] }));
            setDetailedItems(localList);
          } else {
            setDetailedItems(valid);
          }
        } else {
          const promises = selectedIds.map((id) =>
            fetchApi<any>(`/api/mosques/${id}/profile${queryParam}`).catch(() => null)
          );
          const results = await Promise.all(promises);
          const valid = results.filter(Boolean);
          if (valid.length === 0) {
            const localList = allMosques.filter((m) => selectedIds.includes(m.id)).map((m) => ({ mosque: m, assignments: [] }));
            setDetailedItems(localList);
          } else {
            setDetailedItems(valid);
          }
        }
      } catch (err: any) {
        console.error('Error fetching batch PDF items:', err);
        setError('تعذر تحميل البيانات المطلوبة للـ PDF');
      } finally {
        setLoading(false);
      }
    }

    loadBatchDetails();
  }, [isOpen, entityType, selectedIds, scheduleId]);

  // Generate real PDF download directly in browser
  const handleDownloadPdf = async () => {
    if (!printContainerRef.current) return;
    setIsDownloading(true);
    try {
      const pageItems = printContainerRef.current.querySelectorAll<HTMLElement>('.pdf-page-item');
      if (pageItems.length === 0) {
        throw new Error('لا توجد بطاقات جاهزة للتحميل');
      }

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      const itemsArray = Array.from(pageItems);

      for (let i = 0; i < itemsArray.length; i++) {
        const itemEl = itemsArray[i];

        // Render card into Canvas image with clean background
        const canvas = await html2canvas(itemEl, {
          scale: 2, // High resolution crisp rendering
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (i > 0) {
          pdf.addPage();
        }

        // Fit image cleanly on A4 page
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight, pdfHeight));
      }

      const firstObj = detailedItems[0];
      const defaultFileName =
        entityType === 'IMAMS'
          ? selectedIds.length === 1 && firstObj?.imam
            ? `بطاقة_الخطيب_${firstObj.imam.name.replace(/\s+/g, '_')}.pdf`
            : `سجل_بطاقات_الخطباء_${selectedIds.length}_سجل.pdf`
          : selectedIds.length === 1 && firstObj?.mosque
            ? `بطاقة_مسجد_${firstObj.mosque.name.replace(/\s+/g, '_')}.pdf`
            : `سجل_بطاقات_المساجد_${selectedIds.length}_مسجد.pdf`;

      pdf.save(defaultFileName);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      // Fallback: Open print popup
      handleOpenPrintWindow();
    } finally {
      setIsDownloading(false);
    }
  };

  // Popup Window Print Fallback
  const handleOpenPrintWindow = () => {
    if (!printContainerRef.current) return;
    const printContent = printContainerRef.current.innerHTML;
    const win = window.open('', '_blank');
    if (!win) {
      window.print();
      return;
    }

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <title>بطاقات التصدير المعمدة - PDF</title>
          <meta charset="utf-8" />
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            body { font-family: 'Cairo', sans-serif; background-color: white; margin: 0; padding: 20px; color: #0f172a !important; }
            table, td, th { color: #0f172a !important; }
            .pdf-page-item {
              page-break-after: always;
              break-after: page;
              margin-bottom: 2rem;
              color: #0f172a !important;
            }
            .pdf-page-item img { width: 56px !important; height: 56px !important; max-width: 56px !important; max-height: 56px !important; object-fit: contain !important; border-radius: 9999px !important; }
            @media print {
              body { padding: 0; color: #0f172a !important; }
              .pdf-page-item {
                page-break-after: always;
                break-after: page;
                margin-bottom: 0;
                box-shadow: none !important;
                border: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div>${printContent}</div>
          <script>
            setTimeout(() => {
              window.print();
            }, 600);
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        entityType === 'IMAMS'
          ? `تصدير وتحميل بطاقات الخطباء كـ PDF (عدد ${selectedIds.length})`
          : `تصدير وتحميل بطاقات المساجد كـ PDF (عدد ${selectedIds.length})`
      }
      subtitle="توليد صفحة واحدة مستقلة لكل سجل معتمدة للطباعة والتنزيل المباشر كملف PDF"
      maxWidth="6xl"
    >
      <div className="space-y-4" dir="rtl">
        {/* Top Control Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl no-print">
          <div className="flex items-center gap-2 text-xs text-emerald-950 font-bold">
            <FileText className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
            <span>
              جاهز لتنزيل <strong>{detailedItems.length}</strong> بطاقة معتمدة كملف PDF مستقل (صفحة لكل {entityType === 'IMAMS' ? 'خطيب' : 'مسجد'}).
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="secondary" size="sm" onClick={onClose}>
              إلغاء
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleOpenPrintWindow}
              leftIcon={<ExternalLink className="w-3.5 h-3.5 text-slate-700" />}
              title="فتح طباعة في نافذة جديدة مباشرة"
            >
              طباعة في نافذة جديدة
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleDownloadPdf}
              isLoading={isDownloading || loading}
              leftIcon={<Download className="w-4 h-4" />}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold"
            >
              {isDownloading ? 'جارٍ توليد وتنزيل ملف PDF...' : 'تنزيل ملف PDF مباشرة 📥'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-600">جارٍ تجهيز وصياغة صفحة PDF لكل سجل...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          /* Printable Document Pages Wrapper */
          <div ref={printContainerRef} className="space-y-6 max-h-[60vh] overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-100/50 print:max-h-none print:p-0 print:border-none print:bg-transparent">
            {entityType === 'IMAMS'
              ? detailedItems.map((item, idx) => {
                  const imam = item.imam || item;
                  const activeSchedule = item.activeSchedule;
                  const assignments = (item.upcomingAssignments && item.upcomingAssignments.length > 0)
                    ? item.upcomingAssignments
                    : (item.assignments || []).filter((a: any) => !activeSchedule || a.scheduleId === activeSchedule.id);

                  return (
                    <div
                      key={imam.id || idx}
                      className="pdf-page-item bg-white p-8 rounded-xl border border-slate-300 shadow-xs space-y-5 print:rounded-none print:shadow-none print:border-none print:p-6 print:m-0"
                      style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                    >
                      {/* Official Header */}
                      <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={DEFAULT_SHARIA_LOGO}
                            alt="شعار الجمعية الشرعية"
                            width={56}
                            height={56}
                            className="w-14 h-14 rounded-full object-cover border-2 border-amber-600/40 shadow-xs"
                            style={{ width: '56px', height: '56px', maxWidth: '56px', maxHeight: '56px', objectFit: 'cover' }}
                          />
                          <div>
                            <h2 className="text-base font-black text-emerald-950 font-heading">
                              {DEFAULT_ORGANIZATION_SETTINGS.branchName}
                            </h2>
                            <p className="text-xs font-bold text-slate-600">
                              {DEFAULT_ORGANIZATION_SETTINGS.appName} v2
                            </p>
                          </div>
                        </div>

                        <div className="text-left font-mono text-[11px] text-slate-600 space-y-0.5">
                          <p className="font-bold text-slate-900">بطاقة تعريف وتكليفات خطيب</p>
                          <p>كود الخطيب: <strong className="text-emerald-900">#{imam.id}</strong></p>
                          <p>تاريخ الاصدار: {new Date().toLocaleDateString('ar-EG')}</p>
                        </div>
                      </div>

                      {/* Main Preacher Profile Banner */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">اسم الخطيب والداعية:</span>
                          <span className="text-sm font-black text-slate-900 block font-heading">{imam.name}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">التصنيف والتكليف:</span>
                          <span className="font-bold text-emerald-900 block">
                            {imam.type === 'FIXED' ? 'خطيب راتب (ثابت)' : imam.type === 'PARTIAL_FIXED' ? 'خطيب ثابت جزئي' : 'خطيب مرن'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">رقم الهاتف التواصل:</span>
                          <span className="font-bold text-slate-900 block font-mono">{imam.phone || 'غير مسجل'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">المنطقة والمحافظة:</span>
                          <span className="font-bold text-slate-900 block">{imam.region || 'محافظة الجيزة'}</span>
                        </div>
                      </div>

                      {/* Assignments Limits */}
                      <div className="grid grid-cols-3 gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 text-center text-xs">
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block">الحد الأدنى للجمعات:</span>
                          <strong className="text-emerald-950 font-black">{imam.minFridays || 1} جمعات</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block">العدد المستهدف شهرياً:</span>
                          <strong className="text-emerald-950 font-black">{imam.targetFridays || 4} جمعات</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-800 font-semibold block">الحد الأقصى للجمعات:</span>
                          <strong className="text-emerald-950 font-black">{imam.maxFridays || 5} جمعات</strong>
                        </div>
                      </div>

                      {/* Schedule Assignments Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <h4 className="text-xs font-bold text-slate-900 font-heading flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                            <span>جدول التكليفات للجمع بالمسجد ({activeSchedule ? `${activeSchedule.monthName || activeSchedule.hijriMonthName || 'الجدول الحالي'} ${activeSchedule.hijriYear} هـ` : 'الجدول الحالي'})</span>
                          </h4>
                          <span className="text-[10px] text-slate-600 font-bold">إجمالي التكليفات: {assignments.length} جمعة</span>
                        </div>

                        <table className="w-full text-right text-xs border-collapse border border-slate-300 text-slate-900 bg-white">
                          <thead>
                            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                              <th className="p-2 border-r border-slate-300 w-12 text-center text-slate-900 font-bold">الجمعة</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">التاريخ الهجري / الموعد</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">المسجد المكلف به</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">كود المسجد</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">المنطقة والحي</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-900">
                            {assignments.length > 0 ? (
                              assignments.map((as: any, aIdx: number) => (
                                <tr key={as.id || aIdx} className="border-b border-slate-200 hover:bg-slate-50 text-slate-900">
                                  <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-900">{as.fridayIndex || aIdx + 1}</td>
                                  <td className="p-2 border-r border-slate-200 font-semibold text-slate-900">{as.hijriDate || `الجمعة ${aIdx + 1}`}</td>
                                  <td className="p-2 border-r border-slate-200 font-black text-emerald-950 text-sm">{as.mosqueName || 'مسجد معتمد'}</td>
                                  <td className="p-2 border-r border-slate-200 font-mono text-xs font-bold text-slate-900">{as.mosqueCode || '—'}</td>
                                  <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{as.region || 'الجيزة'}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-500 font-bold">
                                  لا توجد تكليفات مسجلة في هذا الشهر بانتظار الاعتماد
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Notes / Remarks */}
                      {imam.notes && (
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-700">
                          <strong>ملاحظات وشروط خاصة:</strong> {imam.notes}
                        </div>
                      )}

                      {/* Footer Stamp & Signatures */}
                      <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-3 text-center text-[11px] font-bold text-slate-800">
                        <div>
                          <p className="text-slate-500 font-normal mb-8">مسؤول المتابعة والتوزيع</p>
                          <p>.......................................</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-normal mb-8">أمانة شؤون المساجد</p>
                          <p>.......................................</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-normal mb-8">خاتم الاعتماد الرسمي</p>
                          <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mx-auto flex items-center justify-center text-[9px] text-slate-400 font-normal">
                            الختم
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              : detailedItems.map((item, idx) => {
                  const mosque = item.mosque || item;
                  const activeSchedule = item.activeSchedule;
                  const assignments = (item.upcomingAssignments && item.upcomingAssignments.length > 0)
                    ? item.upcomingAssignments
                    : (item.assignments || []).filter((a: any) => !activeSchedule || a.scheduleId === activeSchedule.id);

                  return (
                    <div
                      key={mosque.id || idx}
                      className="pdf-page-item bg-white p-8 rounded-xl border border-slate-300 shadow-xs space-y-5 print:rounded-none print:shadow-none print:border-none print:p-6 print:m-0"
                      style={{ pageBreakAfter: 'always', breakAfter: 'page' }}
                    >
                      {/* Official Header */}
                      <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={DEFAULT_SHARIA_LOGO}
                            alt="شعار الجمعية الشرعية"
                            width={56}
                            height={56}
                            className="w-14 h-14 rounded-full object-cover border-2 border-amber-600/40 shadow-xs"
                            style={{ width: '56px', height: '56px', maxWidth: '56px', maxHeight: '56px', objectFit: 'cover' }}
                          />
                          <div>
                            <h2 className="text-base font-black text-emerald-950 font-heading">
                              {DEFAULT_ORGANIZATION_SETTINGS.branchName}
                            </h2>
                            <p className="text-xs font-bold text-slate-600">
                              {DEFAULT_ORGANIZATION_SETTINGS.appName} v2
                            </p>
                          </div>
                        </div>

                        <div className="text-left font-mono text-[11px] text-slate-600 space-y-0.5">
                          <p className="font-bold text-slate-900">بطاقة تعريف وجدول كشوف مسجد</p>
                          <p>كود المسجد: <strong className="text-emerald-900">{mosque.code}</strong></p>
                          <p>تاريخ الاصدار: {new Date().toLocaleDateString('ar-EG')}</p>
                        </div>
                      </div>

                      {/* Main Mosque Profile Banner */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">اسم المسجد / الجامع:</span>
                          <span className="text-sm font-black text-slate-900 block font-heading">{mosque.name}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">المشرف / المسؤول:</span>
                          <span className="font-bold text-emerald-900 block">{mosque.managerName || 'غير مسجل'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">هاتف التواصل:</span>
                          <span className="font-bold text-slate-900 block font-mono">{mosque.phone || 'غير مسجل'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">العنوان والتسجيل:</span>
                          <span className="font-bold text-slate-900 block">{mosque.formattedAddress || mosque.region || 'محافظة الجيزة'}</span>
                        </div>
                      </div>

                      {/* Schedule Assignments Table */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                          <h4 className="text-xs font-bold text-slate-900 font-heading flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                            <span>جدول خطباء الجمعة المعتمد ({activeSchedule ? `${activeSchedule.monthName || activeSchedule.hijriMonthName || 'الشهر الحالي'} ${activeSchedule.hijriYear} هـ` : 'الشهر الحالي'})</span>
                          </h4>
                          <span className="text-[10px] text-slate-600 font-bold">إجمالي الجمعات: {assignments.length}</span>
                        </div>

                        <table className="w-full text-right text-xs border-collapse border border-slate-300 text-slate-900 bg-white">
                          <thead>
                            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                              <th className="p-2 border-r border-slate-300 w-12 text-center text-slate-900 font-bold">الجمعة</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">التاريخ الهجري / الموعد</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">اسم الخطيب المكلف</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">هاتف التواصل</th>
                              <th className="p-2 border-r border-slate-300 text-slate-900 font-bold">نوع التكليف</th>
                            </tr>
                          </thead>
                          <tbody className="text-slate-900">
                            {assignments.length > 0 ? (
                              assignments.map((as: any, aIdx: number) => (
                                <tr key={as.id || aIdx} className="border-b border-slate-200 hover:bg-slate-50 text-slate-900">
                                  <td className="p-2 border-r border-slate-200 text-center font-bold text-slate-900">{as.fridayIndex || aIdx + 1}</td>
                                  <td className="p-2 border-r border-slate-200 font-semibold text-slate-900">{as.hijriDate || `الجمعة ${aIdx + 1}`}</td>
                                  <td className="p-2 border-r border-slate-200 font-black text-emerald-950 text-sm">{as.imamName || 'خطيب معتمد'}</td>
                                  <td className="p-2 border-r border-slate-200 font-mono text-xs font-bold text-slate-900">{as.imamPhone || '—'}</td>
                                  <td className="p-2 border-r border-slate-200 font-bold text-slate-900">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                      as.assignmentSource === 'FIXED'
                                        ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                        : 'bg-emerald-50 text-emerald-950 border border-emerald-300'
                                    }`}>
                                      {as.assignmentSource === 'FIXED' ? 'خطيب ثابت' : 'توزيع تلقائي'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={5} className="p-4 text-center text-slate-500 font-bold">
                                  لا توجد تكليفات مسجلة لهذا المسجد في الشهر المعتمد
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer Stamp & Signatures */}
                      <div className="pt-6 border-t-2 border-slate-200 grid grid-cols-3 text-center text-[11px] font-bold text-slate-800">
                        <div>
                          <p className="text-slate-500 font-normal mb-8">مشرف المسجد</p>
                          <p>.......................................</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-normal mb-8">أمانة شؤون المساجد</p>
                          <p>.......................................</p>
                        </div>
                        <div>
                          <p className="text-slate-500 font-normal mb-8">خاتم الاعتماد الرسمي</p>
                          <div className="w-16 h-16 border-2 border-dashed border-slate-300 rounded-full mx-auto flex items-center justify-center text-[9px] text-slate-400 font-normal">
                            الختم
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        )}
      </div>
    </Modal>
  );
}
