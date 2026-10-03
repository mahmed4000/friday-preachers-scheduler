import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users2,
  FileSpreadsheet,
  Download,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  RefreshCw,
  FileText,
  FileDown,
  Database,
  Lock,
  GitBranch,
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { downloadImportTemplate } from '../../lib/downloadTemplate.ts';
import { ImportExportEntityType, ImportExportLogItem } from '../../types/importExport.ts';
import { ImportWizardModal } from './ImportWizardModal.tsx';
import { ExportModal } from './ExportModal.tsx';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { Badge } from '../ui/Badge.tsx';

export function ImportExportCenter() {
  const [logs, setLogs] = useState<ImportExportLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [stats, setStats] = useState<{ mosquesCount: number; imamsCount: number }>({
    mosquesCount: 0,
    imamsCount: 0,
  });

  // Modal states
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importEntityType, setImportEntityType] = useState<ImportExportEntityType>('MOSQUES');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportEntityType, setExportEntityType] = useState<ImportExportEntityType>('MOSQUES');

  const [isFreezingSeed, setIsFreezingSeed] = useState(false);
  const [freezeMessage, setFreezeMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleFreezeSeed = async () => {
    setIsFreezingSeed(true);
    setFreezeMessage(null);
    try {
      const res = await fetchApi<any>('/api/system/export-seed', { method: 'POST' });
      setFreezeMessage({
        text: `تم تثبيت وتجميد البيانات بنجاح (${res.stats?.mosques || 0} مسجد، ${res.stats?.imams || 0} خطيب، ${res.stats?.assignments || 0} تكليف) في ملف (src/db/initialSeed.json) المعتمد للرفع على GitHub والنقل للخادم الخارجي!`,
        type: 'success',
      });
    } catch (err: any) {
      setFreezeMessage({
        text: err.message || 'تعذر تجميد وتثبيت المعطيات الحالية',
        type: 'error',
      });
    } finally {
      setIsFreezingSeed(false);
    }
  };

  const loadData = async () => {
    setLoadingLogs(true);
    try {
      const [logsData, mosquesData, imamsData] = await Promise.all([
        fetchApi<ImportExportLogItem[]>('/api/import-export/logs'),
        fetchApi<any[]>('/api/mosques'),
        fetchApi<any[]>('/api/imams'),
      ]);
      setLogs(logsData || []);
      setStats({
        mosquesCount: mosquesData?.length || 0,
        imamsCount: imamsData?.length || 0,
      });
    } catch (err) {
      console.error('Failed to load import/export logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openImport = (type: ImportExportEntityType) => {
    setImportEntityType(type);
    setImportWizardOpen(true);
  };

  const openExport = (type: ImportExportEntityType) => {
    setExportEntityType(type);
    setExportModalOpen(true);
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Top Welcome Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-950 border border-emerald-300">
              مركز التكامل وتبادل البيانات
            </span>
          </div>
          <h3 className="text-xl font-bold font-heading text-slate-900">
            استيراد وتصدير بيانات المساجد والخطباء
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            استيراد آمن مع معالجة التكرار والتحقق من التقسيم الإداري المصري المعتمد، وتصدير مصنفات Excel احترافية RTL بترميز سليم وتنسيق نصوص لأرقام الهواتف.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            isLoading={loadingLogs}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            تحديث السجل
          </Button>
        </div>
      </div>

      {/* 3 DISTINCT SECTIONS FOR IMPORT & EXPORT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SECTION 1: MOSQUES ONLY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-600/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-emerald-900 flex items-center justify-center font-bold shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">1. المساجد والجوامع</h4>
                <p className="text-[11px] text-slate-500">
                  إجمالي المسجلة: <strong>{stats.mosquesCount} مسجداً</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              خاص بإدارة واستيراد وتصدير بيانات المساجد وحدها مع ربط العنوان بالحي والمنطقة.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openImport('MOSQUES')}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                استيراد مساجد
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openExport('MOSQUES')}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                تصدير المساجد
              </Button>
            </div>

            <button
              type="button"
              onClick={() => downloadImportTemplate('mosques')}
              className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-700" />
              <span>تحميل قالب المساجد (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* SECTION 2: PREACHERS ONLY */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-600/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-900 flex items-center justify-center font-bold shrink-0">
                <Users2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">2. الخطباء والدعاة</h4>
                <p className="text-[11px] text-slate-500">
                  إجمالي المسجلين: <strong>{stats.imamsCount} خطيباً</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              خاص بإدارة واستيراد وتصدير بيانات الخطباء وحدها مع حدود الجمعات والواتساب.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openImport('IMAMS')}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                استيراد خطباء
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openExport('IMAMS')}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                تصدير الخطباء
              </Button>
            </div>

            <button
              type="button"
              onClick={() => downloadImportTemplate('preachers')}
              className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-700" />
              <span>تحميل قالب الخطباء (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* SECTION 3: FULL COMBINED */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-600/40 transition-all flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100/70 text-sky-900 flex items-center justify-center font-bold shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">3. المركز الشامل</h4>
                <p className="text-[11px] text-slate-500">
                  المساجد + الخطباء معاً
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              استيراد وتصدير شامل لجميع بيانات النظام (مساجد وخطباء) في مصنف موحد.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => openImport('ALL')}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                استيراد شامل
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openExport('ALL')}
                leftIcon={<Download className="w-3.5 h-3.5" />}
              >
                تصدير شامل
              </Button>
            </div>

            <button
              type="button"
              onClick={() => downloadImportTemplate('full')}
              className="w-full py-1.5 px-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/50 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-700" />
              <span>تحميل القالب الشامل (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* CARD 3.5: GITHUB & EXTERNAL SERVER DATA FREEZE */}
      <div className="bg-emerald-950 text-white rounded-2xl p-5 border border-emerald-800/80 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-800 text-emerald-100 text-[10px] font-bold flex items-center gap-1">
                <GitBranch className="w-3 h-3 text-emerald-300" />
                تثبيت المعطيات مع GitHub والخادم الخارجي
              </span>
            </div>
            <h4 className="text-base font-bold font-heading text-emerald-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400" />
              تجميد وتثبيت كافة المعطيات والجداول الحالية (Data Freeze & Seed)
            </h4>
            <p className="text-xs text-emerald-200/80 leading-relaxed max-w-3xl">
              يقوم هذا الخيار باستخراج كافة المساجد والخطباء والتكليفات والقواعد الحالية وتثبيتها في ملف المرجع المعتمد <code className="bg-emerald-900 px-1.5 py-0.5 rounded text-amber-300 font-mono text-[11px]">src/db/initialSeed.json</code>. عند رفع المشروع إلى GitHub وتثبيته على أي سيرفر جديد، سيتعرف النظام تلقائياً على هذه المعطيات ويستعيدها كاملة.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={handleFreezeSeed}
            isLoading={isFreezingSeed}
            leftIcon={<Lock className="w-4 h-4 text-emerald-950" />}
            className="bg-amber-400 hover:bg-amber-500 text-emerald-950 font-extrabold shrink-0"
          >
            تثبيت وحفظ المعطيات الحالية 🚀
          </Button>
        </div>

        {freezeMessage && (
          <div
            className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
              freezeMessage.type === 'success'
                ? 'bg-emerald-900/90 text-emerald-100 border border-emerald-700'
                : 'bg-rose-900/90 text-rose-100 border border-rose-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {freezeMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{freezeMessage.text}</span>
            </div>
            <button
              onClick={() => setFreezeMessage(null)}
              className="text-[10px] text-emerald-300 hover:text-white underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}
      </div>

      {/* CARD 4: OPERATION LOGS & ERROR REPORTS TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs space-y-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-700" />
            <h4 className="text-sm font-bold text-slate-900 font-heading">سجل عمليات الاستيراد والتصدير</h4>
          </div>
          <span className="text-xs text-slate-500">آخر 50 عملية منفذة مع إمكانية تحميل تقارير الأخطاء</span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                <th className="p-3">رقم المعاملة</th>
                <th className="p-3">النوع</th>
                <th className="p-3">الكيان</th>
                <th className="p-3">اسم الملف</th>
                <th className="p-3">الإحصائيات</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3 text-center">التقرير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 text-xs">
                    لم يتم تسجيل عمليات استيراد أو تصدير حتى الآن.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-800">{log.batchId}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.operationType === 'IMPORT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {log.operationType === 'IMPORT' ? 'استيراد' : 'تصدير'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-800">
                      {log.entityType === 'MOSQUES' ? 'المساجد' : log.entityType === 'IMAMS' ? 'الخطباء' : 'الكل'}
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px] truncate max-w-xs">{log.fileName}</td>
                    <td className="p-3 text-[11px] text-slate-700">
                      <span>إجمالي: {log.totalRows}</span>
                      {log.createdRows > 0 && <span className="text-emerald-700 font-bold mr-1.5">(+{log.createdRows})</span>}
                      {log.updatedRows > 0 && <span className="text-blue-700 font-bold mr-1.5">(↻{log.updatedRows})</span>}
                      {log.errorRows > 0 && <span className="text-rose-600 font-bold mr-1.5">(✕{log.errorRows})</span>}
                    </td>
                    <td className="p-3">
                      {log.status === 'COMPLETED' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          مكتمل بنجاح
                        </span>
                      )}
                      {log.status === 'COMPLETED_WITH_WARNINGS' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          مكتمل بتحذيرات
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          فشل
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-[11px] text-slate-500 font-mono">
                      {new Date(log.startedAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="p-3 text-center">
                      {log.errorRows > 0 && log.errorReportJson ? (
                        <a
                          href={`/api/import-export/logs/${log.id}/error-report`}
                          download
                          className="px-2 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded text-[10px] font-bold border border-rose-200 inline-flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>الأخطاء</span>
                        </a>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ImportWizardModal
        isOpen={importWizardOpen}
        onClose={() => {
          setImportWizardOpen(false);
          loadData();
        }}
        defaultEntityType={importEntityType}
        onSuccess={loadData}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          loadData();
        }}
        defaultEntityType={exportEntityType}
      />
    </div>
  );
}
