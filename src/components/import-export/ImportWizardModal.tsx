import React, { useState, useRef } from 'react';
import { Modal } from '../common/Modal.tsx';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  ArrowRight,
  ArrowLeft,
  Download,
  Trash2,
  FileText,
  Search,
  Filter,
  Eye,
  SlidersHorizontal,
  Check,
  X,
  Layers,
  ShieldAlert,
  Users2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { fetchApi } from '../../lib/api.ts';
import { downloadImportTemplate } from '../../lib/downloadTemplate.ts';
import {
  ImportExportEntityType,
  ImportMode,
  ImportPreviewResult,
  ParsedImportRow,
  ColumnMappingItem,
  ImportExecuteResult,
} from '../../types/importExport.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEntityType?: ImportExportEntityType;
  onSuccess: () => void;
}

export function ImportWizardModal({
  isOpen,
  onClose,
  defaultEntityType = 'MOSQUES',
  onSuccess,
}: ImportWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [entityType, setEntityType] = useState<ImportExportEntityType>(defaultEntityType);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<'XLSX' | 'CSV'>('XLSX');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);

  // Preview & Mapping
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMappingItem[]>([]);
  const [importMode, setImportMode] = useState<ImportMode>('UPSERT');
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ImportExecuteResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Table Preview Filters
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'NEW' | 'UPDATE' | 'DUPLICATES' | 'NEEDS_REVIEW' | 'ERROR'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowDetail, setSelectedRowDetail] = useState<ParsedImportRow | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setEntityType(defaultEntityType || 'MOSQUES');
      resetWizard();
    }
  }, [isOpen, defaultEntityType]);

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setFileName('');
    setRawRows([]);
    setFileHeaders([]);
    setPreviewResult(null);
    setColumnMappings([]);
    setExecuteResult(null);
    setErrorMsg(null);
    setSelectedRowDetail(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processSelectedFile(f);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) processSelectedFile(f);
  };

  const processSelectedFile = (f: File) => {
    setFile(f);
    setFileName(f.name);
    const isCsv = f.name.toLowerCase().endsWith('.csv');
    setFileFormat(isCsv ? 'CSV' : 'XLSX');
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'binary' });
        setAvailableSheets(wb.SheetNames);
        const firstSheetName = wb.SheetNames[0];
        setSelectedSheet(firstSheetName);
        parseSheet(wb, firstSheetName, isCsv ? 'CSV' : 'XLSX');
      } catch (err: any) {
        setErrorMsg('فشل قراءة الملف، يرجى التأكد من أن الملف بصيغة Excel أو CSV صالحة.');
      }
    };
    reader.readAsBinaryString(f);
  };

  const parseSheet = (wb: XLSX.WorkBook, sheetName: string, format: 'XLSX' | 'CSV') => {
    try {
      const ws = wb.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (json.length === 0) {
        setErrorMsg('ورقة العمل المحددة فارغة.');
        return;
      }
      setRawRows(json);
      const headers = Object.keys(json[0] || {});
      setFileHeaders(headers);
      setStep(2);
      // Auto analyze
      handleAnalyzeRows(json, headers, format);
    } catch (err: any) {
      setErrorMsg('تعذر استخراج البيانات من ورقة العمل.');
    }
  };

  const handleAnalyzeRows = async (rows: any[], headers: string[], format: 'XLSX' | 'CSV', customMaps?: ColumnMappingItem[]) => {
    setAnalyzing(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi<ImportPreviewResult>('/api/import-export/preview', {
        method: 'POST',
        timeoutMs: 90000,
        body: JSON.stringify({
          entityType,
          rawRows: rows,
          fileName,
          fileFormat: format,
          customMappings: customMaps || columnMappings,
        }),
      });
      setPreviewResult(res);
      if (res.entityType) {
        setEntityType(res.entityType);
      }
      setColumnMappings(res.columnMappings);
      setStep(3); // Jump to interactive preview
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل تحليل البيانات والتحقق من الوحدات الإدارية');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewResult) return;
    setExecuting(true);
    setStep(4);
    setErrorMsg(null);

    try {
      const res = await fetchApi<ImportExecuteResult>('/api/import-export/execute', {
        method: 'POST',
        timeoutMs: 120000,
        body: JSON.stringify({
          batchId: previewResult.batchId,
          entityType: previewResult.entityType || entityType,
          fileName,
          fileFormat,
          mode: importMode,
          rows: previewResult.rows,
        }),
      });
      setExecuteResult(res);
      setStep(5);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تنفيذ عملية الاستيراد');
      setStep(3);
    } finally {
      setExecuting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!executeResult?.errorReport) return;
    const ws = XLSX.utils.json_to_sheet(
      executeResult.errorReport.map((e) => ({
        'رقم الصف': e.rowNumber,
        'الكود': e.code,
        'الاسم': e.name,
        'نوع الخطأ': e.field,
        'تفاصيل ورسالة الخطأ': e.errorMessage,
        'القيمة المدخلة': e.rawValue,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أخطاء الاستيراد');
    XLSX.writeFile(wb, `import-errors-${executeResult.batchId}.xlsx`);
  };

  const handleBulkDuplicateResolution = (resolution: 'MERGE' | 'DUPLICATE') => {
    if (!previewResult) return;
    const updatedRows = previewResult.rows.map((row) => {
      if (row.duplicateMatch?.isDuplicate) {
        if (resolution === 'MERGE') {
          return {
            ...row,
            resolution: 'MERGE' as const,
            status: 'UPDATE' as const,
            targetId: row.duplicateMatch.existingRecord?.id || row.targetId,
          };
        } else {
          return {
            ...row,
            resolution: 'DUPLICATE' as const,
            status: 'NEW' as const,
            targetId: undefined,
          };
        }
      }
      return row;
    });

    const newCount = updatedRows.filter((r) => r.status === 'NEW').length;
    const updateCount = updatedRows.filter((r) => r.status === 'UPDATE').length;
    const reviewCount = updatedRows.filter((r) => r.status === 'NEEDS_REVIEW').length;
    const errorCount = updatedRows.filter((r) => r.status === 'ERROR').length;

    setPreviewResult({
      ...previewResult,
      rows: updatedRows,
      newCount,
      updateCount,
      reviewCount,
      errorCount,
    });
  };

  const handleRowDuplicateResolution = (rowNumber: number, resolution: 'MERGE' | 'DUPLICATE') => {
    if (!previewResult) return;
    const updatedRows = previewResult.rows.map((row) => {
      if (row.rowNumber === rowNumber) {
        if (resolution === 'MERGE') {
          return {
            ...row,
            resolution: 'MERGE' as const,
            status: 'UPDATE' as const,
            targetId: row.duplicateMatch?.existingRecord?.id || row.targetId,
          };
        } else {
          return {
            ...row,
            resolution: 'DUPLICATE' as const,
            status: 'NEW' as const,
            targetId: undefined,
          };
        }
      }
      return row;
    });

    const newCount = updatedRows.filter((r) => r.status === 'NEW').length;
    const updateCount = updatedRows.filter((r) => r.status === 'UPDATE').length;
    const reviewCount = updatedRows.filter((r) => r.status === 'NEEDS_REVIEW').length;
    const errorCount = updatedRows.filter((r) => r.status === 'ERROR').length;

    setPreviewResult({
      ...previewResult,
      rows: updatedRows,
      newCount,
      updateCount,
      reviewCount,
      errorCount,
    });
  };

  // Filtered rows for Preview
  const filteredRows = (previewResult?.rows || []).filter((r) => {
    let matchFilter = true;
    if (previewFilter === 'DUPLICATES') {
      matchFilter = Boolean(r.duplicateMatch?.isDuplicate);
    } else if (previewFilter !== 'ALL') {
      matchFilter = r.status === previewFilter;
    }

    const matchSearch =
      !searchTerm ||
      r.displayName.includes(searchTerm) ||
      r.entityCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.data.phone && r.data.phone.includes(searchTerm)) ||
      (r.data.region && r.data.region.includes(searchTerm));
    return matchFilter && matchSearch;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`مركز استيراد ${entityType === 'MOSQUES' ? 'المساجد' : 'الخطباء والدعاة'}`}
      subtitle="استيراد آمن مع معالجة التكرار والتحقق من التقسيم الإداري المصري"
      maxWidth="4xl"
    >
      <div className="space-y-5" dir="rtl">
        {/* Step Indicator Header */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between overflow-x-auto text-xs font-semibold">
          <div className={`flex items-center gap-1.5 ${step >= 1 ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 1 ? 'bg-emerald-700 text-white' : 'bg-slate-200'}`}>1</span>
            <span>اختيار الملف</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <div className={`flex items-center gap-1.5 ${step >= 2 ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 2 ? 'bg-emerald-700 text-white' : 'bg-slate-200'}`}>2</span>
            <span>مطابقة الحقول</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <div className={`flex items-center gap-1.5 ${step >= 3 ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 3 ? 'bg-emerald-700 text-white' : 'bg-slate-200'}`}>3</span>
            <span>المعاينة والتحقق</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <div className={`flex items-center gap-1.5 ${step >= 4 ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step >= 4 ? 'bg-emerald-700 text-white' : 'bg-slate-200'}`}>4</span>
            <span>التنفيذ والنسخ</span>
          </div>
          <ArrowLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />

          <div className={`flex items-center gap-1.5 ${step === 5 ? 'text-emerald-800 font-bold' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 5 ? 'bg-emerald-700 text-white' : 'bg-slate-200'}`}>5</span>
            <span>النتائج والتقرير</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-900 text-xs">إغلاق</button>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* STAGE 1: FILE SELECTION & TEMPLATE DOWNLOAD */}
        {/* ----------------------------------------------------------- */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Entity Type Toggle */}
            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-800">نوع البيانات المراد استيرادها:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEntityType('MOSQUES')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    entityType === 'MOSQUES' ? 'bg-emerald-800 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  🕌 المساجد والجوامع
                </button>
                <button
                  type="button"
                  onClick={() => setEntityType('IMAMS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    entityType === 'IMAMS' ? 'bg-emerald-800 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  🎙 الخطباء والدعاة
                </button>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-300 hover:border-emerald-600 hover:bg-emerald-50/30 bg-slate-50/50 rounded-2xl p-8 text-center cursor-pointer transition-all space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-2xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 font-heading">
                  اضغط لاختيار ملف Excel أو CSV، أو اسحب الملف وأفلته هنا
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  الصيغ المدعومة: <strong className="text-slate-700">.xlsx, .xls, .csv</strong> (يدعم الترميز العربي UTF-8 و UTF-8 BOM)
                </p>
              </div>
            </div>

            {/* Template Download Recommendation */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-bold text-amber-950 font-heading">توصية: استخدم القالب الرسمي المعتمد</h5>
                  <p className="text-[11px] text-amber-900 mt-0.5">
                    يحتوي القالب على أمثلة جاهزة لفرع منشأة البكاري وقائمة المحافظات والأحياء المعتمدة رسمياً.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadImportTemplate(entityType === 'MOSQUES' ? 'mosques' : 'preachers')}
                  className="px-3 py-1.5 bg-white hover:bg-amber-100/70 border border-amber-300 text-amber-950 font-bold rounded-lg transition-all flex items-center gap-1.5 text-xs shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-700" />
                  <span>تحميل قالب {entityType === 'MOSQUES' ? 'المساجد' : 'الخطباء'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* STAGE 2: COLUMN MAPPING & SHEET SELECTION */}
        {/* ----------------------------------------------------------- */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                <div>
                  <span className="text-xs font-bold text-slate-900">{fileName}</span>
                  <span className="block text-[11px] text-slate-500">
                    عدد الصفوف: <strong>{rawRows.length}</strong> صفاً · الأعمدة: <strong>{fileHeaders.length}</strong>
                  </span>
                </div>
              </div>

              {availableSheets.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">ورقة العمل:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => {
                      setSelectedSheet(e.target.value);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          const wb = XLSX.read(evt.target?.result, { type: 'binary' });
                          parseSheet(wb, e.target.value, fileFormat);
                        };
                        reader.readAsBinaryString(file);
                      }
                    }}
                    className="text-xs p-1.5 border border-slate-300 rounded-lg bg-white"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 font-heading">مطابقة أعمدة الملف مع حقول النظام:</span>
                <span className="text-[11px] text-slate-500">تمت المطابقة الذكية تلقائياً بنسبة عالية</span>
              </div>

              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {columnMappings.map((cm, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">عمود الملف:</span>
                        <strong className="text-slate-900">{cm.fileHeader}</strong>
                      </div>

                      <ArrowLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />

                      <div>
                        <span className="text-emerald-700 block text-[10px]">الحقل المطابق:</span>
                        <strong className="text-emerald-950">{cm.targetLabel}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="sm" onClick={() => setStep(1)} leftIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                اختيار ملف آخر
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleAnalyzeRows(rawRows, fileHeaders, fileFormat)}
                isLoading={analyzing}
                leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
              >
                متابعة والمعاينة الذكية
              </Button>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* STAGE 3: INTERACTIVE PREVIEW, DUPLICATE CHECK & RESOLUTION */}
        {/* ----------------------------------------------------------- */}
        {step === 3 && previewResult && (
          <div className="space-y-4">
            {/* Top Counters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center">
              <div
                onClick={() => setPreviewFilter('ALL')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-2xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="block text-[11px]">إجمالي الصفوف</span>
                <span className="text-lg font-bold font-mono">{previewResult.totalRows}</span>
              </div>

              <div
                onClick={() => setPreviewFilter('NEW')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'NEW' ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                }`}
              >
                <span className="block text-[11px]">سجلات جديدة</span>
                <span className="text-lg font-bold font-mono">+{previewResult.newCount}</span>
              </div>

              <div
                onClick={() => setPreviewFilter('UPDATE')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'UPDATE' ? 'bg-blue-800 text-white border-blue-800 shadow-2xs' : 'bg-blue-50/70 border-blue-200 text-blue-900 hover:bg-blue-100'
                }`}
              >
                <span className="block text-[11px]">تحديث موجود</span>
                <span className="text-lg font-bold font-mono">↻ {previewResult.updateCount}</span>
              </div>

              <div
                onClick={() => setPreviewFilter('DUPLICATES')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'DUPLICATES' ? 'bg-amber-600 text-white border-amber-600 shadow-2xs' : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <span className="block text-[11px]">أسماء مكررة</span>
                <span className="text-lg font-bold font-mono">{previewResult.duplicateCount || 0}</span>
              </div>

              <div
                onClick={() => setPreviewFilter('NEEDS_REVIEW')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'NEEDS_REVIEW' ? 'bg-amber-800 text-white border-amber-800 shadow-2xs' : 'bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <span className="block text-[11px]">يحتاج مراجعة</span>
                <span className="text-lg font-bold font-mono">⚠ {previewResult.reviewCount}</span>
              </div>

              <div
                onClick={() => setPreviewFilter('ERROR')}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  previewFilter === 'ERROR' ? 'bg-rose-800 text-white border-rose-800 shadow-2xs' : 'bg-rose-50/70 border-rose-200 text-rose-900 hover:bg-rose-100'
                }`}
              >
                <span className="block text-[11px]">أخطاء بالملف</span>
                <span className="text-lg font-bold font-mono">✕ {previewResult.errorCount}</span>
              </div>
            </div>

            {/* Duplicate Names Prompt Banner */}
            {Boolean(previewResult.duplicateCount && previewResult.duplicateCount > 0) && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Users2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-amber-950 font-heading text-xs sm:text-sm flex items-center gap-1.5">
                      <span>تنبيه: تم اكتشاف {previewResult.duplicateCount} اسم مكرر أثناء فحص الملف</span>
                    </h5>
                    <p className="text-[11px] text-amber-900 mt-0.5 leading-relaxed">
                      هل ترغب في <strong>دمج البيانات (Merge)</strong> مع السجلات الموجودة لتحديثها، أم <strong>السماح بالتكرار (Duplicate)</strong> وإضافتها كسجلات جديدة؟ يمكنك الاختيار جماعياً من الأزرار أو تخصيص كل اسم في الجدول أدناه:
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleBulkDuplicateResolution('MERGE')}
                    className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="تطبيق خيار الدمج والتحديث على جميع الأسماء المكررة"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>دمج الكل (Merge)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBulkDuplicateResolution('DUPLICATE')}
                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                    title="تطبيق خيار التكرار وإضافة سجل جديد لجميع الأسماء المكررة"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تكرار الكل كجديد (Duplicate)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Mode Selector & Filter Bar */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
              {/* Import Mode */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">وضع الاستيراد:</span>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as ImportMode)}
                  className="text-xs font-bold p-1.5 border border-slate-300 rounded-lg bg-emerald-50/50 text-slate-900"
                >
                  <option value="UPSERT">تحديث وإضافة (UPSERT) - موصى به</option>
                  <option value="INSERT_ONLY">إضافة الجديد فقط وتخطي الموجود (INSERT ONLY)</option>
                  <option value="UPDATE_ONLY">تحديث الموجود فقط وعدم إنشاء جديد (UPDATE ONLY)</option>
                </select>
              </div>

              {/* Search in preview */}
              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="بحث في المعاينة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Interactive Preview Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                      <th className="p-2.5 w-12 text-center">الصف</th>
                      <th className="p-2.5">الكود</th>
                      <th className="p-2.5">الاسم</th>
                      <th className="p-2.5">المحافظة / العنوان</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">الحالة والإجراء</th>
                      <th className="p-2.5 w-16 text-center">تفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 text-xs">
                          لا توجد نتائج مطابقة للتصفية الحالية
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row.rowNumber} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 text-center font-mono text-slate-500">{row.rowNumber}</td>
                          <td className="p-2.5 font-mono font-bold text-slate-800">{row.entityCode}</td>
                          <td className="p-2.5 font-bold text-slate-900">{row.displayName}</td>
                          <td className="p-2.5 text-slate-600 text-[11px] truncate max-w-xs">
                            {row.data.formattedAddress || `${row.data.region} - ${row.data.governorate || 'الجيزة'}`}
                          </td>
                          <td className="p-2.5 font-mono text-slate-700 text-[11px]">{row.data.phone || '—'}</td>
                          <td className="p-2.5">
                            {row.duplicateMatch?.isDuplicate ? (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                                  <span>اسم مكرر ({row.duplicateMatch.type === 'DB_MATCH' ? 'بالنظام' : `صف #${row.duplicateMatch.existingRecord?.rowNumber}`})</span>
                                </span>

                                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => handleRowDuplicateResolution(row.rowNumber, 'MERGE')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                      row.status === 'UPDATE' || row.resolution === 'MERGE'
                                        ? 'bg-blue-700 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="دمج البيانات مع السجل الموجود وتحديثه"
                                  >
                                    ↻ دمج (Merge)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRowDuplicateResolution(row.rowNumber, 'DUPLICATE')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                      row.status === 'NEW' || row.resolution === 'DUPLICATE'
                                        ? 'bg-emerald-700 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                    title="السماح بالتكرار وإضافة سجل جديد"
                                  >
                                    ＋ تكرار (Duplicate)
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {row.status === 'NEW' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    ✓ إضافة جديد
                                  </span>
                                )}
                                {row.status === 'UPDATE' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                    ↻ تحديث موجود
                                  </span>
                                )}
                                {row.status === 'NEEDS_REVIEW' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    ⚠ مطابقة تقريبية
                                  </span>
                                )}
                                {row.status === 'ERROR' && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                    ✕ خطأ بالصف
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedRowDetail(row)}
                              className="text-emerald-700 hover:text-emerald-900 p-1 hover:bg-emerald-50 rounded"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="secondary" size="sm" onClick={() => setStep(2)} leftIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                رجوع لمطابقة الأعمدة
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteImport}
                  disabled={previewResult.totalRows === 0 || (previewResult.newCount === 0 && previewResult.updateCount === 0 && previewResult.reviewCount === 0)}
                  leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
                >
                  بدء الاستيراد الفعلي الآن ({previewResult.newCount + previewResult.updateCount + previewResult.reviewCount} سجل)
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* STAGE 4: EXECUTING IN PROGRESS */}
        {/* ----------------------------------------------------------- */}
        {step === 4 && (
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto animate-spin">
              <RefreshCw className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900 font-heading">جارٍ تنفيذ عملية الاستيراد بأمان...</h4>
              <p className="text-xs text-slate-500 mt-1">
                تم إنشاء نسخة احتياطية Snapshot برقم المعاملة (
                <strong className="font-mono text-slate-700">{previewResult?.batchId}</strong>). جارٍ حفظ السجلات دون المساس بالعلاقات السابقة.
              </p>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* STAGE 5: RESULTS & OUTCOME REPORT */}
        {/* ----------------------------------------------------------- */}
        {step === 5 && executeResult && (
          <div className="space-y-4">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h4 className="text-base font-bold text-emerald-950 font-heading">
                اكتملت عملية استيراد {entityType === 'MOSQUES' ? 'المساجد' : 'الخطباء'} بنجاح!
              </h4>
              <p className="text-xs text-emerald-900">{executeResult.message}</p>
            </div>

            {/* Results Counters */}
            <div className="grid grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="block text-[11px] text-slate-500">تمت الإضافة</span>
                <span className="text-xl font-bold font-mono text-emerald-700">+{executeResult.createdRows}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="block text-[11px] text-slate-500">تم التحديث</span>
                <span className="text-xl font-bold font-mono text-blue-700">↻ {executeResult.updatedRows}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="block text-[11px] text-slate-500">تم التخطي</span>
                <span className="text-xl font-bold font-mono text-slate-600">{executeResult.skippedRows}</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-slate-200">
                <span className="block text-[11px] text-slate-500">الأخطاء</span>
                <span className="text-xl font-bold font-mono text-rose-600">{executeResult.errorRows}</span>
              </div>
            </div>

            {executeResult.errorRows > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-rose-900">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>توجد بعض الصفوف التي احتوت على أخطاء وتم تخطيها دون تعطيل باقي البيانات.</span>
                </div>
                <Button variant="danger" size="sm" onClick={downloadErrorReport} leftIcon={<Download className="w-3.5 h-3.5" />}>
                  تحميل تقرير الأخطاء Excel
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button variant="secondary" size="sm" onClick={resetWizard}>
                استيراد ملف آخر
              </Button>
              <Button variant="primary" size="sm" onClick={onClose}>
                إغلاق والعودة
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Row Detail Inspector Modal */}
      {selectedRowDetail && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedRowDetail(null)}
          title={`تفاصيل الصف #${selectedRowDetail.rowNumber}: ${selectedRowDetail.displayName}`}
          subtitle={`الكود: ${selectedRowDetail.entityCode}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs" dir="rtl">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900">العنوان والتقسيم الإداري المطابق:</span>
              <p className="text-slate-700">{selectedRowDetail.adminMatch?.formattedAddress}</p>
              {selectedRowDetail.adminMatch?.needsReview && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-900">
                  ⚠ {selectedRowDetail.adminMatch.reviewReason}
                </div>
              )}
            </div>

            {selectedRowDetail.duplicateMatch?.isDuplicate && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>تطابق اسم مكرر ({selectedRowDetail.duplicateMatch.type === 'DB_MATCH' ? 'مسجل مسبقاً في النظام' : `مكرر مع الصف #${selectedRowDetail.duplicateMatch.existingRecord?.rowNumber}`})</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-300">
                    {selectedRowDetail.status === 'UPDATE' ? 'الإجراء الحالي: دمج' : 'الإجراء الحالي: تكرار كجديد'}
                  </span>
                </div>
                <div className="text-[11px] text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-200 space-y-0.5">
                  <p>الاسم المطابق: <strong className="text-slate-900">{selectedRowDetail.duplicateMatch.existingRecord?.name}</strong></p>
                  {selectedRowDetail.duplicateMatch.existingRecord?.code && (
                    <p>الكود: <strong className="font-mono">{selectedRowDetail.duplicateMatch.existingRecord.code}</strong></p>
                  )}
                  {selectedRowDetail.duplicateMatch.existingRecord?.phone && (
                    <p>الهاتف: <strong className="font-mono">{selectedRowDetail.duplicateMatch.existingRecord.phone}</strong></p>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700">تغيير الإجراء لهذا الاسم:</span>
                  <button
                    type="button"
                    onClick={() => {
                      handleRowDuplicateResolution(selectedRowDetail.rowNumber, 'MERGE');
                      setSelectedRowDetail((prev) => prev ? { ...prev, status: 'UPDATE', resolution: 'MERGE' } : null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      selectedRowDetail.status === 'UPDATE' || selectedRowDetail.resolution === 'MERGE'
                        ? 'bg-blue-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ↻ دمج البيانات (Merge)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleRowDuplicateResolution(selectedRowDetail.rowNumber, 'DUPLICATE');
                      setSelectedRowDetail((prev) => prev ? { ...prev, status: 'NEW', resolution: 'DUPLICATE' } : null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                      selectedRowDetail.status === 'NEW' || selectedRowDetail.resolution === 'DUPLICATE'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    ＋ السماح بالتكرار (Duplicate)
                  </button>
                </div>
              </div>
            )}

            {selectedRowDetail.diffSummary && selectedRowDetail.diffSummary.length > 0 && (
              <div className="space-y-2">
                <span className="font-bold text-slate-900">التغييرات المقترحة على السجل الموجود:</span>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
                  {selectedRowDetail.diffSummary.map((diff, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between">
                      <span className="text-slate-600 font-semibold">{diff.label}:</span>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-slate-400">{String(diff.oldValue)}</span>
                        <ArrowLeft className="w-3 h-3 text-slate-400" />
                        <span className="font-bold text-emerald-800">{String(diff.newValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedRowDetail.errors.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-1">
                <span className="font-bold">الأخطاء المكتشفة:</span>
                <ul className="list-disc list-inside">
                  {selectedRowDetail.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedRowDetail(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
