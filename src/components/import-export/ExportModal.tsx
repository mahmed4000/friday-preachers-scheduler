import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.tsx';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users2,
  Layers,
  MapPin,
} from 'lucide-react';
import { fetchApi, getAuthToken } from '../../lib/api.ts';
import { ImportExportEntityType, ImportExportFormat } from '../../types/importExport.ts';
import { Button } from '../ui/Button.tsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEntityType?: ImportExportEntityType;
  selectedIds?: number[];
  singleEntityId?: number;
  singleEntityName?: string;
}

export function ExportModal({
  isOpen,
  onClose,
  defaultEntityType = 'MOSQUES',
  selectedIds = [],
  singleEntityId,
  singleEntityName,
}: ExportModalProps) {
  const [entityType, setEntityType] = useState<ImportExportEntityType>(defaultEntityType);
  const [format, setFormat] = useState<ImportExportFormat>('XLSX');
  const [scope, setScope] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'GOVERNORATE' | 'DISTRICT' | 'AREA' | 'SELECTED'>('ALL');
  const [governorateId, setGovernorateId] = useState<number>(1);
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [areaId, setAreaId] = useState<number | undefined>(undefined);
  const [governorates, setGovernorates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEntityType(defaultEntityType);
    }
  }, [isOpen, defaultEntityType]);

  useEffect(() => {
    if (selectedIds.length > 0) {
      setScope('SELECTED');
    }
  }, [selectedIds]);

  useEffect(() => {
    fetchApi<any[]>('/api/locations/governorates')
      .then((data) => setGovernorates(data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (governorateId) {
      fetchApi<any[]>(`/api/locations/units?parentId=${governorateId}`)
        .then((data) => setDistricts(data || []))
        .catch(() => {});
    }
  }, [governorateId]);

  useEffect(() => {
    if (districtId) {
      fetchApi<any[]>(`/api/locations/units?parentId=${districtId}`)
        .then((data) => setAreas(data || []))
        .catch(() => {});
    }
  }, [districtId]);

  const handleExecuteExport = async () => {
    setExporting(true);
    setErrorMsg(null);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/import-export/export', {
        method: 'POST',
        credentials: 'same-origin',
        headers,
        body: JSON.stringify({
          entityType,
          format,
          scope: singleEntityId ? 'SELECTED' : scope,
          governorateId: scope === 'GOVERNORATE' ? governorateId : undefined,
          districtId: scope === 'DISTRICT' ? districtId : undefined,
          areaId: scope === 'AREA' ? areaId : undefined,
          selectedIds: selectedIds.length > 0 ? selectedIds : undefined,
          singleEntityId: singleEntityId || undefined,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'فشل تصدير البيانات من الخادم');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileExt = format === 'CSV' ? 'csv' : 'xlsx';
      const entityLabel = entityType === 'MOSQUES' ? 'mosques' : 'preachers';
      a.download = singleEntityName
        ? `${entityLabel}_${singleEntityName}_export.${fileExt}`
        : `${entityLabel}_export_${new Date().toISOString().slice(0, 10)}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تحميل ملف التصدير');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        singleEntityName
          ? `تصدير بيانات: ${singleEntityName}`
          : `تصدير بيانات ${entityType === 'MOSQUES' ? 'المساجد' : entityType === 'IMAMS' ? 'الخطباء والدعاة' : 'المركز الشامل (المساجد والخطباء)'}`
      }
      subtitle="تصدير مصنف Excel معتمد RTL أو CSV بترميز UTF-8 شامل للتقسيم الإداري"
      maxWidth="lg"
    >
      <div className="space-y-4 text-xs" dir="rtl">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Entity Type Selection (if not single entity) */}
        {!singleEntityId && (
          <div className="space-y-1">
            <label className="block font-bold text-slate-800">بيانات التصدير المطلوب:</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEntityType('MOSQUES')}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                  entityType === 'MOSQUES'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>المساجد والجوامع</span>
              </button>

              <button
                type="button"
                onClick={() => setEntityType('IMAMS')}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                  entityType === 'IMAMS'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Users2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>الخطباء والدعاة</span>
              </button>

              <button
                type="button"
                onClick={() => setEntityType('ALL')}
                className={`p-2.5 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                  entityType === 'ALL'
                    ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>الشامل (المساجد والخطباء)</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. Format Selection */}
        <div className="space-y-1">
          <label className="block font-bold text-slate-800">صيغة الملف:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFormat('XLSX')}
              className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                format === 'XLSX'
                  ? 'bg-white border-emerald-600 text-slate-900 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <div>
                  <span className="block font-bold">مصنف Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-500 font-normal">تنسيق RTL مع ورقة الدليل الإداري</span>
                </div>
              </div>
              {format === 'XLSX' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </button>

            <button
              type="button"
              onClick={() => setFormat('CSV')}
              className={`p-2.5 rounded-xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                format === 'CSV'
                  ? 'bg-white border-emerald-600 text-slate-900 font-bold ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <div>
                  <span className="block font-bold">ملف CSV (.csv)</span>
                  <span className="text-[10px] text-slate-500 font-normal">ترميز UTF-8 مع BOM لفتح سليم</span>
                </div>
              </div>
              {format === 'CSV' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            </button>
          </div>
        </div>

        {/* 3. Scope & Filtering (if not single entity) */}
        {!singleEntityId && (
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <label className="block font-bold text-slate-800">نطاق التصدير والتصفية:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'ALL'}
                  onChange={() => setScope('ALL')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-slate-800">جميع السجلات</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'ACTIVE'}
                  onChange={() => setScope('ACTIVE')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-slate-800">النشطة فقط</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'INACTIVE'}
                  onChange={() => setScope('INACTIVE')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-slate-800">غير النشطة فقط</span>
              </label>

              {selectedIds.length > 0 && (
                <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'SELECTED'}
                    onChange={() => setScope('SELECTED')}
                    className="text-emerald-600"
                  />
                  <span className="font-semibold text-slate-800">السجلات المحددة ({selectedIds.length})</span>
                </label>
              )}

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'GOVERNORATE'}
                  onChange={() => setScope('GOVERNORATE')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-slate-800">حسب المحافظة</span>
              </label>

              <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === 'DISTRICT'}
                  onChange={() => setScope('DISTRICT')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-slate-800">حسب الحي / القسم</span>
              </label>
            </div>

            {/* Sub Filters for Location */}
            {(scope === 'GOVERNORATE' || scope === 'DISTRICT') && (
              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">المحافظة:</label>
                  <select
                    value={governorateId}
                    onChange={(e) => setGovernorateId(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {governorates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {scope === 'DISTRICT' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">الحي / القسم:</label>
                    <select
                      value={districtId || ''}
                      onChange={(e) => setDistrictId(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">-- كافة أقسام المحافظة --</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-emerald-900 text-[11px] leading-relaxed">
          ✓ سيتم تصدير أرقام الهواتف كنصوص تحافظ على الصفر في البداية (<code className="font-bold">010...</code>) وتصدير المعرفات الإدارية المرجعية لضمان إمكانية إعادة الاستيراد دون فقدان العلاقات.
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <Button variant="secondary" size="sm" onClick={onClose}>
            إلغاء
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExecuteExport}
            isLoading={exporting}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            تصدير وتنزيل الملف الآن
          </Button>
        </div>
      </div>
    </Modal>
  );
}
