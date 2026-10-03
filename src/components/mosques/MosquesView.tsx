import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Edit2,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  CheckSquare,
  Square,
  FileDown,
} from 'lucide-react';
import { Mosque, Imam } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import { Badge } from '../common/Badge.tsx';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { ImportWizardModal } from '../import-export/ImportWizardModal.tsx';
import { ExportModal } from '../import-export/ExportModal.tsx';
import { BatchPdfExportModal } from '../import-export/BatchPdfExportModal.tsx';
import { FileText } from 'lucide-react';

interface MosquesViewProps {
  mosques: Mosque[];
  imams: Imam[];
  onAddMosque: () => void;
  onEditMosque: (mosque: Mosque) => void;
  onOpenImport?: () => void;
  onRefresh?: () => void;
}

export function MosquesView({
  mosques,
  onAddMosque,
  onEditMosque,
  onRefresh,
}: MosquesViewProps) {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedMosqueIds, setSelectedMosqueIds] = useState<number[]>([]);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [batchPdfModalOpen, setBatchPdfModalOpen] = useState(false);

  const filteredMosques = mosques.filter((m) => {
    const matchSearch =
      m.name.includes(search) ||
      m.code.toLowerCase().includes(search.toLowerCase()) ||
      (m.managerName && m.managerName.includes(search));
    const matchRegion = regionFilter === 'ALL' || m.region === regionFilter;
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? m.isActive : !m.isActive);
    return matchSearch && matchRegion && matchStatus;
  });

  const regions = ['الوسط', 'الشمال', 'الجنوب', 'الشرق', 'الغرب', 'منشأة البكاري', 'الهرم'];

  const toggleSelectAll = () => {
    if (selectedMosqueIds.length === filteredMosques.length) {
      setSelectedMosqueIds([]);
    } else {
      setSelectedMosqueIds(filteredMosques.map((m) => m.id));
    }
  };

  const toggleSelectMosque = (id: number) => {
    setSelectedMosqueIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = async (mosque: Mosque) => {
    if (confirm(`هل أنت تأكد من حذف مسجد "${mosque.name}" نهائياً من النظام؟`)) {
      try {
        await fetchApi(`/api/mosques/${mosque.id}`, { method: 'DELETE' });
        setSelectedMosqueIds((prev) => prev.filter((id) => id !== mosque.id));
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(err.message || 'تعذر حذف المسجد');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `هل أنت تأكد من حذف ${selectedMosqueIds.length} مساجد محددة نهائياً؟ سيتم إلغاء سجلاتها وتكليفاتها.`
      )
    ) {
      try {
        await fetchApi('/api/mosques/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: selectedMosqueIds }),
        });
        setSelectedMosqueIds([]);
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(err.message || 'تعذر حذف المساجد المحددة');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading">قائمة مساجد وجوامع المدينة</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة مساجد فرع الجمعية الشرعية، الخطباء الثابتون، والاستيراد/التصدير المعتمد
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setExportModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 border border-slate-300 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>تصدير Excel/CSV</span>
          </button>

          <button
            onClick={() => setImportModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-300 shadow-2xs cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-800" />
            <span>استيراد مساجد</span>
          </button>

          <button
            onClick={onAddMosque}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مسجد جديد</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Selection Bar */}
      {selectedMosqueIds.length > 0 && (
        <div className="bg-emerald-900 text-white p-3 rounded-xl shadow-md flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-amber-300" />
            <span>تم تحديد <strong>{selectedMosqueIds.length}</strong> مسجداً من القائمة</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchPdfModalOpen(true)}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-900" />
              <span>تصدير PDF (صفحة لكل مسجد) ({selectedMosqueIds.length})</span>
            </button>

            <button
              onClick={() => setExportModalOpen(true)}
              className="px-3 py-1 bg-white text-emerald-950 hover:bg-emerald-50 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>تصدير Excel/CSV</span>
            </button>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف المحددين ({selectedMosqueIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedMosqueIds([])}
              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث باسم المسجد، الكود، المشرف، أو العنوان..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Status Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({mosques.length})
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === 'ACTIVE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              النشطة ({mosques.filter((m) => m.isActive).length})
            </button>
          </div>
        </div>
      </div>

      {/* Mosques Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredMosques.length > 0 && selectedMosqueIds.length === filteredMosques.length}
                    onChange={toggleSelectAll}
                    className="rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">كود المسجد</th>
                <th className="py-3 px-4">اسم المسجد</th>
                <th className="py-3 px-4">المنطقة والحي</th>
                <th className="py-3 px-4">الخطيب الثابت والنمط</th>
                <th className="py-3 px-4">التفضيلات والقيود</th>
                <th className="py-3 px-4">التواصل والمشرف</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMosques.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">لا توجد مساجد مطابقة للبحث أو الفلتر المحدد</p>
                  </td>
                </tr>
              ) : (
                filteredMosques.map((mosque) => {
                  const isSelected = selectedMosqueIds.includes(mosque.id);
                  return (
                    <tr
                      key={mosque.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectMosque(mosque.id)}
                          className="rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        {mosque.code}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <ClickableMosque
                          id={mosque.id}
                          name={mosque.name}
                          code={mosque.code}
                          className="font-bold text-slate-900 hover:text-emerald-700"
                        />
                        {(mosque.formattedAddress || mosque.address) && (
                          <span className="block text-[11px] font-normal text-slate-400 truncate max-w-xs">
                            {mosque.formattedAddress || mosque.address}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-slate-600 font-medium">{mosque.region}</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {mosque.fixedImamId ? (
                          <div className="space-y-0.5">
                            <ClickableImam
                              id={mosque.fixedImamId}
                              name={mosque.fixedImamName}
                              className="font-medium text-emerald-800 hover:text-emerald-950"
                            />
                            <span className="block text-[10px] text-slate-500">
                              نمط: {mosque.fixedPattern} {mosque.fixedCount > 0 ? `(${mosque.fixedCount} جمعات)` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">مرن (بدون خطيب ثابت)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {mosque.preferencesCount && mosque.preferencesCount > 0 ? (
                            <Badge variant="info">
                              ⭐ {mosque.preferencesCount} تفضيلات
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-[11px]">بدون تفضيل</span>
                          )}
                          {mosque.forbiddenCount && mosque.forbiddenCount > 0 ? (
                            <Badge variant="danger">
                              <ShieldAlert className="w-3 h-3 ml-0.5" />
                              {mosque.forbiddenCount} ممنوع
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        <div>
                          <span>{mosque.managerName || 'غير مسجل'}</span>
                          {(mosque.phone || mosque.whatsapp) && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="font-mono">{mosque.whatsapp || mosque.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {mosque.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <XCircle className="w-3.5 h-3.5 text-slate-400" />
                            معطل
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onEditMosque(mosque)}
                            className="px-2.5 py-1 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors text-xs font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>الملف والقواعد</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(mosque)}
                            title="حذف المسجد"
                            className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer border border-slate-200"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import & Export Modals */}
      <ImportWizardModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        defaultEntityType="MOSQUES"
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultEntityType="MOSQUES"
        selectedIds={selectedMosqueIds}
      />

      <BatchPdfExportModal
        isOpen={batchPdfModalOpen}
        onClose={() => setBatchPdfModalOpen(false)}
        entityType="MOSQUES"
        selectedIds={selectedMosqueIds}
        allMosques={mosques}
      />
    </div>
  );
}
