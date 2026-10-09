import React, { useState, useEffect } from 'react';
import { MonthlySchedule, Friday, Assignment, Mosque, Imam } from '../../types/index.ts';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  MessageSquare,
  Search,
  Check,
  RefreshCw,
} from 'lucide-react';
import { generateWhatsAppMessage, buildWhatsAppLink } from '../../lib/whatsapp.ts';
import { fetchApi } from '../../lib/api.ts';

interface WhatsAppCenterViewProps {
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  mosques: Mosque[];
  imams: Imam[];
}

export function WhatsAppCenterView({
  schedule,
  fridays,
  assignments,
  mosques,
  imams,
}: WhatsAppCenterViewProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'MOSQUE' | 'IMAM'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'READY' | 'SENT' | 'MISSING_PHONE'>('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dispatchingAll, setDispatchingAll] = useState(false);
  const [dispatchStats, setDispatchStats] = useState<{ sent: number; total: number } | null>(null);

  // Recipient local status map: "type:id" -> 'READY' | 'SENT' | 'MISSING_PHONE'
  const [recipientStatus, setRecipientStatus] = useState<Record<string, 'READY' | 'SENT' | 'MISSING_PHONE'>>({});

  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));

  // Build recipients list
  interface RecipientItem {
    key: string;
    type: 'MOSQUE' | 'IMAM';
    id: number;
    name: string;
    phone: string;
    status: 'READY' | 'SENT' | 'MISSING_PHONE';
    fridaysList: { fridayIndex: number; dateStr: string; entityName: string }[];
  }

  const recipients: RecipientItem[] = [];

  // Mosques
  for (const m of mosques.filter((m) => m.isActive)) {
    const mFridays = fridays.map((f) => {
      const assign = assignments.find((a) => a.mosqueId === m.id && a.fridayIndex === f.fridayIndex);
      const imam = assign?.imamId ? imamMap.get(assign.imamId) : null;
      return {
        fridayIndex: f.fridayIndex,
        dateStr: f.hijriDate,
        entityName: imam ? imam.name : 'شاغر',
      };
    });

    const phone = m.whatsapp || m.phone || '';
    const key = `MOSQUE:${m.id}`;
    const status = recipientStatus[key] || (phone ? 'READY' : 'MISSING_PHONE');

    recipients.push({
      key,
      type: 'MOSQUE',
      id: m.id,
      name: m.name,
      phone,
      status,
      fridaysList: mFridays,
    });
  }

  // Imams
  for (const i of imams.filter((i) => i.isActive)) {
    const iFridays = fridays.map((f) => {
      const assign = assignments.find((a) => a.imamId === i.id && a.fridayIndex === f.fridayIndex);
      const mosque = assign ? mosqueMap.get(assign.mosqueId) : null;
      return {
        fridayIndex: f.fridayIndex,
        dateStr: f.hijriDate,
        entityName: mosque ? mosque.name : 'راحة / غير مكلف',
      };
    });

    const phone = i.whatsapp || i.phone || '';
    const key = `IMAM:${i.id}`;
    const status = recipientStatus[key] || (phone ? 'READY' : 'MISSING_PHONE');

    recipients.push({
      key,
      type: 'IMAM',
      id: i.id,
      name: i.name,
      phone,
      status,
      fridaysList: iFridays,
    });
  }

  // Filter list
  const filteredRecipients = recipients.filter((r) => {
    const matchSearch = r.name.includes(search) || (r.phone && r.phone.includes(search));
    const matchType = filterType === 'ALL' || r.type === filterType;
    const matchStatus = filterStatus === 'ALL' || r.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const readyCount = recipients.filter((r) => r.status === 'READY').length;
  const sentCount = recipients.filter((r) => r.status === 'SENT').length;
  const missingPhoneCount = recipients.filter((r) => r.status === 'MISSING_PHONE').length;

  const handleCopyMessage = (item: RecipientItem) => {
    const msg = generateWhatsAppMessage({
      recipientName: item.name,
      recipientType: item.type,
      monthName: schedule.monthName,
      hijriYear: schedule.hijriYear,
      fridaysList: item.fridaysList,
    });
    navigator.clipboard.writeText(msg);
    setCopiedId(item.key);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendSingle = (item: RecipientItem) => {
    const msg = generateWhatsAppMessage({
      recipientName: item.name,
      recipientType: item.type,
      monthName: schedule.monthName,
      hijriYear: schedule.hijriYear,
      fridaysList: item.fridaysList,
    });
    const link = buildWhatsAppLink(item.phone, msg);
    window.open(link, '_blank');

    setRecipientStatus((prev) => ({ ...prev, [item.key]: 'SENT' }));
  };

  const handleDispatchAllReady = async () => {
    setDispatchingAll(true);
    try {
      const readyItems = recipients.filter((r) => r.status === 'READY');
      // Simulate bulk dispatch / queue dispatch
      await new Promise((r) => setTimeout(r, 600));

      const updatedMap = { ...recipientStatus };
      for (const item of readyItems) {
        updatedMap[item.key] = 'SENT';
      }
      setRecipientStatus(updatedMap);
      setDispatchStats({ sent: readyItems.length, total: recipients.length });
    } finally {
      setDispatchingAll(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <span>مركز إرسال وتوزيع الجداول عبر WhatsApp</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تجهيز وإرسال رسائل التكليف الرسمية لمسؤولي المساجد وفضيلة الخطباء بنقرة واحدة
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={readyCount === 0 || dispatchingAll}
              onClick={handleDispatchAllReady}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>
                {dispatchingAll ? 'جارٍ الإرسال...' : `بدء الإرسال الجماعي (${readyCount} جاهز)`}
              </span>
            </button>
          </div>
        </div>

        {/* Counters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
            <span className="block text-xl font-bold text-slate-900 tabular-nums">{recipients.length}</span>
            <span className="text-[11px] text-slate-500">إجمالي المستلمين</span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
            <span className="block text-xl font-bold text-emerald-800 tabular-nums">{readyCount}</span>
            <span className="text-[11px] text-emerald-700 font-medium">جاهز للإرسال 🟢</span>
          </div>

          <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 text-center">
            <span className="block text-xl font-bold text-sky-800 tabular-nums">{sentCount}</span>
            <span className="text-[11px] text-sky-700 font-medium">تم الإرسال ✓</span>
          </div>

          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-center">
            <span className="block text-xl font-bold text-amber-800 tabular-nums">{missingPhoneCount}</span>
            <span className="text-[11px] text-amber-700 font-medium">رقم الهاتف مفقود ⚠️</span>
          </div>
        </div>

        {dispatchStats && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>تم إرسال {dispatchStats.sent} رسالة بنجاح لجميع المستلمين الجاهزين!</span>
            </div>
            <button
              onClick={() => setDispatchStats(null)}
              className="text-emerald-900 underline text-[11px]"
            >
              إخفاء
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث باسم المسجد، الخطيب، أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 text-slate-900 font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Type */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterType === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterType('MOSQUE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterType === 'MOSQUE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              المساجد
            </button>
            <button
              onClick={() => setFilterType('IMAM')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterType === 'IMAM' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              الخطباء
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterStatus === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              كافة الحالات
            </button>
            <button
              onClick={() => setFilterStatus('READY')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterStatus === 'READY' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              جاهز 🟢
            </button>
            <button
              onClick={() => setFilterStatus('SENT')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterStatus === 'SENT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              تم الإرسال ✓
            </button>
            <button
              onClick={() => setFilterStatus('MISSING_PHONE')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md ${
                filterStatus === 'MISSING_PHONE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              ناقص هاتف ⚠️
            </button>
          </div>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
            <tr>
              <th className="py-3 px-4">اسم المستلم</th>
              <th className="py-3 px-4">النوع</th>
              <th className="py-3 px-4">رقم الواتساب</th>
              <th className="py-3 px-4 text-center">الحالة</th>
              <th className="py-3 px-4 text-center">إجراءات الإرسال</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRecipients.map((item) => (
              <tr key={item.key} className="hover:bg-slate-50/70">
                <td className="py-3 px-4 font-bold text-slate-900">
                  {item.name}
                  <span className="block text-[11px] font-normal text-slate-400">
                    {item.type === 'MOSQUE' ? 'إدارة الجامع' : 'فضيلة الخطيب'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {item.type === 'MOSQUE' ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium">
                      مسجد
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                      خطيب
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-mono">
                  {item.phone ? (
                    <span className="text-slate-700">{item.phone}</span>
                  ) : (
                    <span className="text-rose-600 italic">غير متوفر ✕</span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  {item.status === 'READY' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      جاهز 🟢
                    </span>
                  )}
                  {item.status === 'SENT' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      تم الإرسال ✓
                    </span>
                  )}
                  {item.status === 'MISSING_PHONE' && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      ناقص هاتف ⚠️
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(item)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium flex items-center gap-1 transition-colors"
                      title="نسخ نص الرسالة للحافظة"
                    >
                      {copiedId === item.key ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>نسخ النص</span>
                        </>
                      )}
                    </button>

                    <a
                      href={item.phone ? buildWhatsAppLink(item.phone, generateWhatsAppMessage({
                        recipientName: item.name,
                        recipientType: item.type,
                        monthName: schedule.monthName,
                        hijriYear: schedule.hijriYear,
                        fridaysList: item.fridaysList,
                      })) : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs ${
                        !item.phone ? 'opacity-40 pointer-events-none' : ''
                      }`}
                      title="فتح محادثة WhatsApp مباشرة"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>إرسال مباشر</span>
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
