import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../lib/api.ts';
import { ScrollText, Clock, User, ShieldCheck } from 'lucide-react';
import { AuditLog } from '../../types/index.ts';

export function AuditLogsView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = () => {
    setLoading(true);
    fetchApi<AuditLog[]>('/api/audit-logs')
      .then((res) => setLogs(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE_MOSQUE':
        return 'إضافة مسجد جديد';
      case 'UPDATE_MOSQUE':
        return 'تحديث بيانات مسجد';
      case 'DELETE_MOSQUE':
        return 'حذف مسجد';
      case 'UPDATE_MOSQUE_RULE':
        return 'تحديث تفضيلات / قيود مسجد';
      case 'CREATE_IMAM':
        return 'إضافة خطيب جديد';
      case 'UPDATE_IMAM':
        return 'تحديث بيانات خطيب';
      case 'DELETE_IMAM':
        return 'حذف خطيب';
      case 'CREATE_SCHEDULE':
        return 'إنشاء مسودة جدول شهر';
      case 'GENERATE_SCHEDULE':
        return 'توليد وتوزيع جدول خوارزمياً';
      case 'REDISTRIBUTE_SCHEDULE':
        return 'إعادة توزيع جزئي / شامل';
      case 'MANUAL_ASSIGNMENT_CHANGE':
        return 'تعديل تعيين يدوي';
      case 'APPROVE_SCHEDULE':
        return 'اعتماد رسمي للجدول الشهري';
      case 'PUBLISH_SCHEDULE':
        return 'نشر الجدول المعتمد';
      case 'DISPATCH_WHATSAPP_ALL':
        return 'إرسال جماعي عبر WhatsApp';
      case 'INITIAL_SEED':
      case 'RESET_DEMO_DATA':
        return 'تهيئة بيانات النظام';
      default:
        return action;
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-emerald-700" />
            <span>سجل العمليات والرقابة الإدارية (Audit Trail)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            توثيق تاريخي زمني غير قابل للحذف لجميع التعديلات والتعيينات والاعتمادات الرسمية
          </p>
        </div>

        <button
          onClick={loadLogs}
          className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
        >
          تحديث السجل
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">جارٍ جلب السجل الرقابي...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">لا توجد عمليات مسجلة حتى الآن.</div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
              <tr>
                <th className="py-3 px-4 w-44">الوقت والتاريخ</th>
                <th className="py-3 px-4">نوع العملية</th>
                <th className="py-3 px-4">الكيان والهدف</th>
                <th className="py-3 px-4">المستخدم المنفذ</th>
                <th className="py-3 px-4">تفاصيل إضافية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('ar-SA')}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                    {getActionLabel(log.action)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[11px]">
                      {log.entityType} {log.entityId ? `#${log.entityId}` : ''}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{log.userEmail || 'النظام المركزي'}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px] truncate max-w-xs">
                    {log.detailsJson || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
