import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { FileSpreadsheet, Download, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import * as XLSX from 'xlsx';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExcelImportModal({ isOpen, onClose, onSuccess }: ExcelImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sampleTemplateData = [
    { 'اسم المسجد': 'جامع الفتح', 'كود المسجد': 'MSQ-31', 'المنطقة': 'الوسط', 'العنوان': 'شارع الملك فهد', 'اسم المشرف': 'أ. أحمد علي', 'الهاتف': '0501234567' },
    { 'اسم المسجد': 'جامع الإخلاص', 'كود المسجد': 'MSQ-32', 'المنطقة': 'الشمال', 'العنوان': 'حي الملقا', 'اسم المشرف': 'أ. خالد سعيد', 'الهاتف': '0507654321' },
    { 'اسم المسجد': 'جامع النور', 'كود المسجد': 'MSQ-33', 'المنطقة': 'الجنوب', 'العنوان': 'حي الشفاء', 'اسم المشرف': 'أ. محمود ناصر', 'الهاتف': '0551122334' },
  ];

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(sampleTemplateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المساجد');
    XLSX.writeFile(wb, 'نموذج_استيراد_المساجد.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawJson = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setErrorMsg('الملف فارغ أو لا يحتوي على صفوف صالحة');
          return;
        }

        // Map columns
        const mapped = rawJson.map((row: any, idx: number) => {
          return {
            name: row['اسم المسجد'] || row['الاسم'] || row['name'] || `مسجد جديد ${idx + 1}`,
            code: row['كود المسجد'] || row['الكود'] || row['code'] || `MSQ-${Math.floor(1000 + Math.random() * 9000)}`,
            region: row['المنطقة'] || row['region'] || 'الوسط',
            address: row['العنوان'] || row['address'] || '',
            managerName: row['اسم المشرف'] || row['المشرف'] || row['manager'] || '',
            phone: row['الهاتف'] || row['whatsapp'] || row['phone'] || '',
            whatsapp: row['الهاتف'] || row['whatsapp'] || '',
          };
        });

        setParsedData(mapped);
        setStep(2);
      } catch (err: any) {
        setErrorMsg('فشل تحليل ملف Excel، يرجى التأكد من الصيغة');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLoadSample = () => {
    const mapped = sampleTemplateData.map((row) => ({
      name: row['اسم المسجد'],
      code: row['كود المسجد'],
      region: row['المنطقة'],
      address: row['العنوان'],
      managerName: row['اسم المشرف'],
      phone: row['الهاتف'],
      whatsapp: row['الهاتف'],
    }));
    setParsedData(mapped);
    setStep(2);
  };

  const handleExecuteImport = async () => {
    setImporting(true);
    setErrorMsg(null);
    try {
      await fetchApi('/api/mosques/import', {
        method: 'POST',
        body: JSON.stringify({ items: parsedData }),
      });
      setStep(3);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل الاستيراد');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="معالج استيراد المساجد من ملف Excel"
      subtitle="رفع وتحديث قائمة المساجد دفعة واحدة من جداول البيانات"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'font-bold text-emerald-800' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>1</span>
            <span>اختيار الملف</span>
          </div>
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'font-bold text-emerald-800' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>2</span>
            <span>مطابقة ومعاينة الأعمدة</span>
          </div>
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'font-bold text-emerald-800' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'}`}>3</span>
            <span>اكتمال الاستيراد</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-xl p-8 text-center bg-slate-50/50 transition-colors">
              <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
              <h4 className="text-sm font-bold text-slate-800 mb-1">اختر ملف Excel (.xlsx أو .xls) أو CSV</h4>
              <p className="text-xs text-slate-500 mb-4">
                يجب أن يحتوي الملف على أعمدة (اسم المسجد، كود المسجد، المنطقة، العنوان...)
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs">
                <span>تصفح ملف من جهازك</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-100 rounded-lg text-xs">
              <span className="text-slate-600">ليس لديك ملف جاهز؟ يمكنك تحميل النموذج القياسي:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تنزيل قالب Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded font-medium transition-colors"
                >
                  تجربة عينة فورية
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Map */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800 font-heading">معاينة البيانات المستخرجة</h4>
                <p className="text-xs text-slate-500">تم التعرف على {parsedData.length} مسجداً جاهزاً للإدراج</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                تغيير الملف
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 sticky top-0 font-semibold text-slate-700">
                  <tr>
                    <th className="p-2">الكود</th>
                    <th className="p-2">الاسم</th>
                    <th className="p-2">المنطقة</th>
                    <th className="p-2">المشرف</th>
                    <th className="p-2">الهاتف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-mono">{row.code}</td>
                      <td className="p-2 font-bold">{row.name}</td>
                      <td className="p-2">{row.region}</td>
                      <td className="p-2 text-slate-500">{row.managerName || '-'}</td>
                      <td className="p-2 font-mono text-slate-500">{row.phone || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{importing ? 'جارٍ الاستيراد...' : `تأكيد استيراد ${parsedData.length} مسجداً`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Completed */}
        {step === 3 && (
          <div className="text-center py-8 space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-900 font-heading">تم استيراد المساجد بنجاح!</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              تمت إضافة وتحديث سجلات المساجد في قاعدة البيانات وأصبحت متاحة في جدول التوزيع.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                العودة لقائمة المساجد
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
