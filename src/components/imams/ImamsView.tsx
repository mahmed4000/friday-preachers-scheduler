import React, { useState } from 'react';
import {
  Users2,
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  CheckCircle2,
  XCircle,
  Download,
  Upload,
  CheckSquare,
} from 'lucide-react';
import { Imam, Mosque, MonthlyScheduleData, Assignment, Friday, MonthlySchedule } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import { Badge } from '../common/Badge.tsx';
import { ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { ImportWizardModal } from '../import-export/ImportWizardModal.tsx';
import { ExportModal } from '../import-export/ExportModal.tsx';
import { BatchPdfExportModal } from '../import-export/BatchPdfExportModal.tsx';
import { PreacherMobileCardModal, PreacherCardAssignmentItem } from '../portal/PreacherMobileCardModal.tsx';
import { FileText, Sparkles, Smartphone } from 'lucide-react';

interface ImamsViewProps {
  imams: Imam[];
  onAddImam: () => void;
  onEditImam: (imam: Imam) => void;
  onRefresh?: () => void;
  activeScheduleData?: MonthlyScheduleData | null;
  mosques?: Mosque[];
}

export function ImamsView({
  imams,
  onAddImam,
  onEditImam,
  onRefresh,
  activeScheduleData,
  mosques = [],
}: ImamsViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedImamIds, setSelectedImamIds] = useState<number[]>([]);

  // Modals
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [batchPdfModalOpen, setBatchPdfModalOpen] = useState(false);
  const [smartCardData, setSmartCardData] = useState<{
    imam: Imam;
    assignment?: Assignment | null;
    mosque?: Mosque | null;
    friday?: Friday | null;
    schedule?: MonthlySchedule | null;
    assignmentsList?: PreacherCardAssignmentItem[];
  } | null>(null);

  const handleOpenSmartCard = (imam: Imam) => {
    const imamAssignments =
      activeScheduleData?.assignments?.filter((a) => a.imamId === imam.id) || [];

    if (imamAssignments.length > 0) {
      const items: PreacherCardAssignmentItem[] = [];
      for (const a of imamAssignments) {
        const m = mosques?.find((x) => x.id === a.mosqueId) || null;
        const f =
          activeScheduleData?.fridays?.find((x) => x.fridayIndex === a.fridayIndex) || null;
        if (m && f) {
          items.push({ assignment: a, mosque: m, friday: f });
        }
      }

      const firstItem = items[0] || null;
      setSmartCardData({
        imam,
        assignment: firstItem?.assignment || null,
        mosque: firstItem?.mosque || null,
        friday: firstItem?.friday || null,
        schedule: activeScheduleData?.schedule || null,
        assignmentsList: items,
      });
    } else {
      setSmartCardData({
        imam,
        assignment: null,
        mosque: null,
        friday: null,
        schedule: activeScheduleData?.schedule || null,
        assignmentsList: [],
      });
    }
  };

  const filteredImams = imams.filter((i) => {
    const matchSearch =
      i.name.includes(search) ||
      (i.phone && i.phone.includes(search)) ||
      (i.region && i.region.includes(search));
    const matchType = typeFilter === 'ALL' || i.type === typeFilter;
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? i.isActive : !i.isActive);
    return matchSearch && matchType && matchStatus;
  });

  const toggleSelectAll = () => {
    if (selectedImamIds.length === filteredImams.length) {
      setSelectedImamIds([]);
    } else {
      setSelectedImamIds(filteredImams.map((i) => i.id));
    }
  };

  const toggleSelectImam = (id: number) => {
    setSelectedImamIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = async (imam: Imam) => {
    if (confirm(`هل أنت تأكد من حذف الخطيب "${imam.name}" نهائياً من النظام؟`)) {
      try {
        await fetchApi(`/api/imams/${imam.id}`, { method: 'DELETE' });
        setSelectedImamIds((prev) => prev.filter((id) => id !== imam.id));
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(err.message || 'تعذر حذف الخطيب');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (
      confirm(
        `هل أنت تأكد من حذف ${selectedImamIds.length} خطباء محددين نهائياً؟ سيتم إلغاء سجلاتهم وتكليفاتهم.`
      )
    ) {
      try {
        await fetchApi('/api/imams/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids: selectedImamIds }),
        });
        setSelectedImamIds([]);
        if (onRefresh) onRefresh();
      } catch (err: any) {
        alert(err.message || 'تعذر حذف الخطباء المحددين');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading">سجل الخطباء والدعاة</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة بيانات الخطباء، حدود التوزيع (الأدنى، المستهدف، الأقصى)، والاستيراد والتصدير
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
            <span>استيراد خطباء</span>
          </button>

          <button
            onClick={onAddImam}
            className="px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة خطيب جديد</span>
          </button>
        </div>
      </div>

      {/* Floating Bulk Selection Bar */}
      {selectedImamIds.length > 0 && (
        <div className="bg-emerald-900 text-white p-3 rounded-xl shadow-md flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-amber-300" />
            <span>تم تحديد <strong>{selectedImamIds.length}</strong> خطيباً من القائمة</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setBatchPdfModalOpen(true)}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5 text-slate-900" />
              <span>تصدير PDF (صفحة لكل خطيب) ({selectedImamIds.length})</span>
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
              <span>حذف المحددين ({selectedImamIds.length})</span>
            </button>

            <button
              onClick={() => setSelectedImamIds([])}
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
            placeholder="بحث باسم الخطيب، الهاتف، أو المنطقة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Type Tabs */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({imams.length})
            </button>
            <button
              onClick={() => setTypeFilter('FIXED')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                typeFilter === 'FIXED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ثابت ({imams.filter((i) => i.type === 'FIXED').length})
            </button>
            <button
              onClick={() => setTypeFilter('PARTIAL_FIXED')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                typeFilter === 'PARTIAL_FIXED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ثابت جزئي ({imams.filter((i) => i.type === 'PARTIAL_FIXED').length})
            </button>
            <button
              onClick={() => setTypeFilter('FLEXIBLE')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                typeFilter === 'FLEXIBLE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مرن ({imams.filter((i) => i.type === 'FLEXIBLE').length})
            </button>
          </div>
        </div>
      </div>

      {/* Imams Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredImams.length > 0 && selectedImamIds.length === filteredImams.length}
                    onChange={toggleSelectAll}
                    className="rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">كود الخطيب</th>
                <th className="py-3 px-4">اسم الخطيب</th>
                <th className="py-3 px-4">النوع والتصنيف</th>
                <th className="py-3 px-4">حدود الجمعات (أدنى / مستهدف / أقصى)</th>
                <th className="py-3 px-4">رقم الهاتف والتواصل</th>
                <th className="py-3 px-4">المنطقة والسكن</th>
                <th className="py-3 px-4 text-center">الحالة</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredImams.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm">لا يوجد خطباء مطابقون للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredImams.map((imam) => {
                  const isSelected = selectedImamIds.includes(imam.id);
                  return (
                    <tr
                      key={imam.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectImam(imam.id)}
                          className="rounded text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 whitespace-nowrap">
                        PRE-{imam.id}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <ClickableImam
                          id={imam.id}
                          name={imam.name}
                          className="font-bold text-slate-900 hover:text-emerald-700"
                        />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {imam.type === 'FIXED' ? (
                          <Badge variant="warning">ثابت</Badge>
                        ) : imam.type === 'PARTIAL_FIXED' ? (
                          <Badge variant="info">ثابت جزئي</Badge>
                        ) : (
                          <Badge variant="default">مرن</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-700">
                          <span className="text-slate-400 text-[10px]">أدنى:</span>
                          <span className="font-bold">{imam.minFridays}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-emerald-700 text-[10px] font-bold">هدف:</span>
                          <span className="font-bold text-emerald-800">{imam.targetFridays}</span>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-400 text-[10px]">أقصى:</span>
                          <span className="font-bold">{imam.maxFridays}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        {imam.phone ? (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{imam.phone}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 italic">بدون هاتف</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        <span>{imam.region || 'منشأة البكاري'}</span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {imam.isActive ? (
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
                            onClick={() => handleOpenSmartCard(imam)}
                            className="px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-black rounded-md transition-all text-xs flex items-center gap-1 cursor-pointer shadow-xs border border-amber-500/40"
                            title="فتح الكارت الذهبي الذكي للخطيب"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-950" />
                            <span>الكارت الذهبي 📱</span>
                          </button>
                          <button
                            onClick={() => onEditImam(imam)}
                            className="px-2.5 py-1 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors text-xs font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>الملف والتوفر</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSingle(imam)}
                            title="حذف الخطيب"
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
        defaultEntityType="IMAMS"
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        defaultEntityType="IMAMS"
        selectedIds={selectedImamIds}
      />

      <BatchPdfExportModal
        isOpen={batchPdfModalOpen}
        onClose={() => setBatchPdfModalOpen(false)}
        entityType="IMAMS"
        selectedIds={selectedImamIds}
        allImams={imams}
      />

      {/* Preacher Golden Smart Card Modal */}
      {smartCardData && (
        <PreacherMobileCardModal
          isOpen={!!smartCardData}
          onClose={() => setSmartCardData(null)}
          imam={smartCardData.imam}
          assignment={smartCardData.assignment}
          mosque={smartCardData.mosque}
          friday={smartCardData.friday}
          schedule={smartCardData.schedule}
          assignmentsList={smartCardData.assignmentsList}
          onStatusUpdated={onRefresh}
        />
      )}
    </div>
  );
}
