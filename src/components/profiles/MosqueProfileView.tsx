import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Calendar,
  Phone,
  Send,
  Printer,
  ArrowRight,
  Edit,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Star,
  Scale,
  ShieldCheck,
  History,
  MapPin,
  CalendarDays,
  UserCheck,
  ChevronLeft,
  XCircle,
  ThumbsDown,
  Plus,
  Download,
} from 'lucide-react';
import { MosqueProfileData, Mosque, Imam } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import { buildWhatsAppLink } from '../../lib/whatsapp.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Card } from '../ui/Card.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { OrnamentalSeparator } from '../ui/OrnamentalSeparator.tsx';
import { ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { ExportModal } from '../import-export/ExportModal.tsx';
import { BatchPdfExportModal } from '../import-export/BatchPdfExportModal.tsx';
import { FileText } from 'lucide-react';

import { getFallbackMosqueProfile } from '../../lib/profileFallbacks.ts';
import { DEFAULT_ORGANIZATION_SETTINGS, DEFAULT_SHARIA_LOGO } from '../../lib/defaultLogo.ts';
import { CalendarService } from '../../services/calendar/calendarService.ts';

interface MosqueProfileViewProps {
  mosqueId: number;
  onBack: () => void;
  onEditMosque?: (mosque: Mosque) => void;
  onOpenImamProfile: (imamId: number) => void;
}

export function MosqueProfileView({
  mosqueId,
  onBack,
  onEditMosque,
  onOpenImamProfile,
}: MosqueProfileViewProps) {
  const [data, setData] = useState<MosqueProfileData | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upcoming');

  const [fixedPatternData, setFixedPatternData] = useState<any>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  const loadProfile = async (schedId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const url = schedId
        ? `/api/mosques/${mosqueId}/profile?scheduleId=${schedId}`
        : selectedScheduleId
        ? `/api/mosques/${mosqueId}/profile?scheduleId=${selectedScheduleId}`
        : `/api/mosques/${mosqueId}/profile`;
      const res = await fetchApi<MosqueProfileData>(url);
      setData(res);
      if (schedId) {
        setSelectedScheduleId(schedId);
      } else if (!selectedScheduleId && res.activeSchedule) {
        setSelectedScheduleId(res.activeSchedule.id);
      }

      // Load fixed pattern for the active schedule
      const targetYear = res.activeSchedule?.hijriYear || 1448;
      const targetMonth = res.activeSchedule?.hijriMonth || 9;
      try {
        const pRes = await fetchApi<any>(`/api/mosques/${mosqueId}/fixed-patterns?year=${targetYear}&month=${targetMonth}`);
        setFixedPatternData(pRes);
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.warn('Backend unavailable, attempting local seed fallback for mosque profile:', err);
      const fallback = getFallbackMosqueProfile(mosqueId, schedId || selectedScheduleId);
      if (fallback) {
        setData(fallback);
        if (schedId) {
          setSelectedScheduleId(schedId);
        } else if (!selectedScheduleId && fallback.activeSchedule) {
          setSelectedScheduleId(fallback.activeSchedule.id);
        }
      } else {
        console.error('Error fetching mosque profile and no fallback found:', err);
        setError(err.message || 'تعذر تحميل الملف التعريفي للمسجد');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedScheduleId(undefined);
    loadProfile(undefined);
  }, [mosqueId]);

  const handlePrint = () => {
    if (!data?.mosque) {
      setPdfModalOpen(true);
      return;
    }

    try {
      let orgSettings = DEFAULT_ORGANIZATION_SETTINGS;
      try {
        const saved = localStorage.getItem('sharia_org_settings');
        if (saved) orgSettings = { ...DEFAULT_ORGANIZATION_SETTINGS, ...JSON.parse(saved) };
      } catch {
        // fallback
      }
      const logoUrl = orgSettings.logoUrl && !orgSettings.logoUrl.startsWith('data:image/svg+xml')
        ? orgSettings.logoUrl
        : DEFAULT_SHARIA_LOGO;

      const currentDT = CalendarService.getCurrentDateTime();
      const currVal = currentDT.hijri.year * 12 + currentDT.hijri.month;

      const sortedAssignments = [...(data.assignments || [])].sort((x: any, y: any) => {
        const xVal = (x.hijriYear || 1448) * 12 + (x.hijriMonth || 1);
        const yVal = (y.hijriYear || 1448) * 12 + (y.hijriMonth || 1);

        const xIsCurrent = xVal === currVal;
        const yIsCurrent = yVal === currVal;
        if (xIsCurrent && !yIsCurrent) return -1;
        if (!xIsCurrent && yIsCurrent) return 1;

        const xIsPast = xVal < currVal;
        const yIsPast = yVal < currVal;
        if (!xIsPast && yIsPast) return -1;
        if (xIsPast && !yIsPast) return 1;

        if (xVal !== yVal) {
          if (xIsPast && yIsPast) return yVal - xVal;
          return xVal - yVal;
        }
        return (x.fridayIndex || 0) - (y.fridayIndex || 0);
      });

      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <title>بطاقة المسجد - ${data.mosque.name}</title>
              <meta charset="utf-8" />
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                body { font-family: 'Cairo', sans-serif; background-color: white; margin: 0; padding: 20px; }
                .print-logo-box, .print-logo-box * { width: 60px !important; height: 60px !important; max-width: 60px !important; max-height: 60px !important; }
                @media print { body { padding: 0; } .no-print { display: none !important; } }
              </style>
            </head>
            <body>
              <div class="max-w-4xl mx-auto p-6 space-y-6">
                <!-- Official Header with Association Logo & Hierarchy -->
                <div class="flex items-center justify-between border-b-2 border-emerald-800 pb-4 gap-4">
                  <div class="flex items-center gap-3.5">
                    <div class="print-logo-box w-16 h-16 rounded-full bg-white border-2 border-amber-500 p-0.5 flex items-center justify-center overflow-hidden shrink-0 shadow-sm" style="width:60px; height:60px; min-width:60px; min-height:60px; max-width:60px; max-height:60px;">
                      <img src="${logoUrl}" alt="شعار الجمعية" width="56" height="56" class="w-full h-full object-contain rounded-full" style="width:56px; height:56px; max-width:56px; max-height:56px; object-fit:contain;" />
                    </div>
                    <div>
                      <h1 class="text-lg font-black text-emerald-950 font-heading leading-tight">${orgSettings.associationName || 'الجمعية الشرعية'}</h1>
                      <p class="text-xs font-bold text-emerald-800 leading-tight mt-0.5">${orgSettings.branchName || 'فرع منشأة البكاري'}</p>
                      <p class="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">${orgSettings.departmentName || 'أمانة شؤون المساجد والجوامع'}</p>
                    </div>
                  </div>

                  <div class="text-left font-mono text-xs text-slate-600 shrink-0">
                    <p class="font-bold text-slate-900 text-sm">بطاقة تعريف وجدول كشوف مسجد</p>
                    <p class="mt-0.5">كود المسجد: <strong class="text-emerald-900 font-bold">${data.mosque.code}</strong></p>
                    <p class="text-[11px] text-slate-500">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>

                <!-- Mosque Details Card -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div><span class="text-slate-500 font-semibold block">اسم المسجد:</span><strong class="text-base text-slate-900">${data.mosque.name}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">المشرف المسؤول:</span><strong class="text-emerald-800">${data.mosque.managerName || '—'}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">هاتف التواصل:</span><strong class="text-slate-900 font-mono">${data.mosque.phone || '—'}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">العنوان والتسجيل:</span><strong class="text-slate-900">${data.mosque.formattedAddress || data.mosque.region || 'منشأة البكاري — الجيزة'}</strong></div>
                </div>

                <!-- Chronological Assignments Table -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-slate-900">
                      جدول الخطباء المعتمد للمسجد (مرتب زمنياً من الشهر الحالي والقريب):
                    </h3>
                    <span class="text-[11px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      إجمالي ${sortedAssignments.length} جمعة مسجلة
                    </span>
                  </div>

                  <table class="w-full text-right text-xs border-collapse border border-slate-200">
                    <thead>
                      <tr class="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                        <th class="p-2 border-r border-slate-200 text-center w-20">الجمعة</th>
                        <th class="p-2 border-r border-slate-200">التاريخ الهجري والشهر</th>
                        <th class="p-2 border-r border-slate-200">اسم الخطيب المكلف</th>
                        <th class="p-2 border-r border-slate-200 text-center w-28">هاتف التواصل</th>
                        <th class="p-2 border-r border-slate-200">نوع التكليف</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${sortedAssignments.map((as: any, idx: number) => {
                        const isCurrentMonth = as.hijriYear === currentDT.hijri.year && as.hijriMonth === currentDT.hijri.month;
                        return `
                          <tr class="border-b border-slate-100 ${isCurrentMonth ? 'bg-emerald-50/50' : ''}">
                            <td class="p-2 border-r border-slate-200 text-center font-bold">
                              ${as.fridayIndex || idx + 1}
                              ${isCurrentMonth ? '<span class="block text-[9px] text-emerald-700 font-bold font-sans">(الشهر الحالي)</span>' : ''}
                            </td>
                            <td class="p-2 border-r border-slate-200 font-medium">
                              <span class="font-bold text-slate-900 block">${as.hijriDate || `الجمعة ${idx + 1}`}</span>
                              <span class="text-[10px] text-slate-500 font-normal">شهر ${as.monthName || ''} ${as.hijriYear || 1448} هـ</span>
                            </td>
                            <td class="p-2 border-r border-slate-200 font-bold text-emerald-950">${as.imamName || 'خطيب معتمد'}</td>
                            <td class="p-2 border-r border-slate-200 font-mono text-center">${as.imamPhone || '—'}</td>
                            <td class="p-2 border-r border-slate-200">${as.assignmentSource === 'FIXED' ? 'خطيب راتب (ثابت)' : 'توزيع واعتماد تلقائي'}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Signatures Footer -->
                <div class="pt-8 border-t-2 border-slate-200 grid grid-cols-3 text-center text-xs font-bold text-slate-800">
                  <div>
                    <p class="text-slate-500 font-normal mb-8">${orgSettings.schedulePreparerTitle || 'مشرف المساجد'}</p>
                    <p>.......................................</p>
                  </div>
                  <div>
                    <p class="text-slate-500 font-normal mb-8">${orgSettings.managerTitle || 'أمانة شؤون المساجد'}</p>
                    <p>.......................................</p>
                  </div>
                  <div>
                    <p class="text-slate-500 font-normal mb-8">${orgSettings.boardPresidentTitle || 'خاتم الاعتماد الرسمي'}</p>
                    <p class="text-emerald-900 font-bold">[ الختم الرسمي ]</p>
                  </div>
                </div>
              </div>
              <script>
                setTimeout(() => { window.print(); }, 500);
              </script>
            </body>
          </html>
        `);
        printWin.document.close();
      } else {
        setPdfModalOpen(true);
      }
    } catch (e) {
      setPdfModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 space-y-3" dir="rtl">
        <div className="w-10 h-10 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-xs font-semibold">جارٍ تحميل الملف التعريفي للمسجد...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4" dir="rtl">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 font-heading">خطأ في جلب بيانات المسجد</h3>
        <p className="text-xs text-rose-700">{error || 'لم يتم العثور على المسجد المطلوب'}</p>
        <div className="flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={onBack}>
            العودة
          </Button>
          <Button variant="primary" size="sm" onClick={() => loadProfile()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  const { mosque, fixedImam, activeSchedule, availableSchedules, stats, assignments, linkedImams, rules, auditLogs } = data;

  const upcomingAssignments = CalendarService.deduplicateAssignmentsByFriday(data.upcomingAssignments || []);

  const profileTabs = [
    { id: 'upcoming', label: 'الجمعات القادمة', badge: upcomingAssignments.length },
    { id: 'fixed-pattern', label: 'نمط الخطباء الثابت', badge: fixedPatternData?.exists ? 'مثبت' : undefined },
    { id: 'schedule', label: 'جدول المسجد الكامل', badge: assignments.length },
    { id: 'preferences', label: 'تفضيلات الخطباء', badge: rules.preferred.length + rules.forbidden.length },
    { id: 'history', label: 'سجل الخطباء السابقين', badge: linkedImams.length },
    { id: 'audit', label: 'سجل العمليات', badge: auditLogs.length },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* 1. Header Profile Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs space-y-5 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 no-print">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onBack}
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة للقائمة</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-500">سجل المساجد</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">{mosque.name}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {onEditMosque && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEditMosque(mosque)}
                leftIcon={<Edit className="w-3.5 h-3.5 text-slate-600" />}
              >
                تعديل المسجد
              </Button>
            )}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPdfModalOpen(true)}
              leftIcon={<FileText className="w-3.5 h-3.5 text-emerald-700" />}
            >
              تحميل PDF
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setExportModalOpen(true)}
              leftIcon={<Download className="w-3.5 h-3.5 text-slate-600" />}
            >
              تصدير البيانات
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5 text-slate-600" />}
            >
              طباعة الملف
            </Button>

            {mosque.phone && (
              <a
                href={buildWhatsAppLink(
                  mosque.phone,
                  `السلام عليكم ورحمة الله، إدارة مسجد ${mosque.name}، تحية طيبة من أمانة شؤون المساجد بالجمعية الشرعية.`
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="accent"
                  size="sm"
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  واتساب المسجد
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Profile Details */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Mosque Icon */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-amber-300 flex items-center justify-center font-bold shadow-sm shrink-0 border-2 border-amber-500/20">
              <Building2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                  {mosque.name}
                </h1>
                <Badge variant={mosque.isActive ? 'approved' : 'inactive'}>
                  {mosque.isActive ? 'مفعل ونشط' : 'غير نشط'}
                </Badge>
                <span className="text-xs px-2.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                  كود: {mosque.code}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>المنطقة: {mosque.region}</span>
                </span>
                {mosque.address && (
                  <span className="text-slate-500 truncate max-w-sm">العنوان: {mosque.address}</span>
                )}
                {mosque.managerName && (
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-800" />
                    <span>المسؤول: {mosque.managerName}</span>
                  </span>
                )}
                {mosque.phone && (
                  <span className="flex items-center gap-1 font-mono text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{mosque.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-left hidden lg:block text-xs text-slate-500 font-mono">
            <span>كود المسجد: {mosque.code}</span>
            <br />
            <span>تاريخ التسجيل: {mosque.createdAt ? new Date(mosque.createdAt).toLocaleDateString('ar-SA') : '—'}</span>
          </div>
        </div>

        {/* Month Selector Bar */}
        {availableSchedules && availableSchedules.length > 0 && (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 font-heading block">
                  نطاق توزيع الخطب حسب الشهر الهجري
                </span>
                <span className="text-[11px] text-slate-600 block">
                  {activeSchedule
                    ? `شهر ${activeSchedule.monthName} ${activeSchedule.hijriYear} هـ (${activeSchedule.fridaysCount} جمعات للشهر)`
                    : 'جدول الشهر الحالي'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">عرض جدول شهر:</span>
              <select
                value={selectedScheduleId || activeSchedule?.id || ''}
                onChange={(e) => {
                  const sId = Number(e.target.value);
                  setSelectedScheduleId(sId);
                  loadProfile(sId);
                }}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer shadow-2xs"
              >
                {availableSchedules.map((s) => {
                  const currentDT = CalendarService.getCurrentDateTime();
                  const isCurrent = s.hijriYear === currentDT.hijri.year && s.hijriMonth === currentDT.hijri.month;
                  return (
                    <option key={s.id} value={s.id}>
                      {s.monthName} {s.hijriYear} هـ {isCurrent ? '⭐ (الشهر الحالي)' : ''} ({s.fridaysCount} جمعات) — {s.status === 'APPROVED' ? 'معتمد' : s.status === 'PUBLISHED' ? 'منشور' : s.status === 'REVIEW' ? 'قيد المراجعة' : 'مسودة'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. Key Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">جمعات الشهر المحدد</span>
          <span className="text-xl font-bold font-heading text-slate-900 tabular-nums">
            {stats.currentMonthCount} من {stats.currentScheduleFridaysTotal ?? 5}
          </span>
          <span className="text-[10px] text-emerald-800 block mt-0.5 font-medium">جمعات مسندة</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">الجمعات القادمة</span>
          <span className="text-xl font-bold font-heading text-emerald-950 tabular-nums">
            {stats.upcomingCount}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">جاهزة ومؤكدة</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">الخطباء المتعاقبون</span>
          <span className="text-xl font-bold font-heading text-slate-900 tabular-nums">
            {stats.imamsCount}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">خطيباً متميزاً</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">الخطيب الراتب الثابت</span>
          {fixedImam ? (
            <div className="pt-1">
              <ClickableImam
                id={fixedImam.id}
                name={fixedImam.name}
                className="text-xs font-bold text-emerald-950 hover:underline block truncate"
              />
              <span className="text-[10px] text-emerald-800 block">خطيب راتب معتمد</span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-400 block pt-1">
              لا يوجد (خطباء دوريون)
            </span>
          )}
        </Card>
      </div>

      {/* 3. Section Tabs */}
      <div className="no-print">
        <Tabs tabs={profileTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* 4. Tab Contents */}
      {/* TAB 1: UPCOMING FRIDAYS */}
      {activeTab === 'upcoming' && (() => {
        const currentDT = CalendarService.getCurrentDateTime();
        const selectedScheduleObj = availableSchedules.find((s) => s.id === (activeSchedule?.id || selectedScheduleId));
        const activeHijriYear = activeSchedule?.hijriYear || selectedScheduleObj?.hijriYear || currentDT.hijri.year;
        const activeHijriMonth = (activeSchedule as any)?.hijriMonth || selectedScheduleObj?.hijriMonth || currentDT.hijri.month;

        const pastAssignmentsCount = upcomingAssignments.filter((a) => {
          const y = a.hijriYear || activeHijriYear;
          const m = (a as any).hijriMonth || activeHijriMonth;
          return CalendarService.validateFridayAction(y, m, a.fridayIndex).isPastFriday;
        }).length;

        const futureAssignmentsCount = upcomingAssignments.length - pastAssignmentsCount;

        return (
          <Card variant="default" className="p-5 space-y-4">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-800" />
                  <span>
                    جمعات وتكليفات المسجد لشهر {activeSchedule?.monthName || stats.currentMonthName || 'الحالي'} {activeSchedule?.hijriYear || stats.currentHijriYear || 1448} هـ
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  الخطباء المكلفون بإلقاء خطبة الجمعة في هذا المسجد خلال الشهر المحدد (الجمع المنتهية تظهر بلون رمادي مؤرشف والجمعة القادمة بلون أخضر زمردي مميز)
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto flex-wrap">
                <span className="text-xs font-bold text-emerald-950 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse"></span>
                  <span>{futureAssignmentsCount} قادمة نشطة</span>
                </span>
                {pastAssignmentsCount > 0 && (
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{pastAssignmentsCount} منتهية</span>
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">
                  (إجمالي {upcomingAssignments.length} جمعات)
                </span>
              </div>
            </div>

            {upcomingAssignments.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                لا توجد جمعات مستقبلية مجدولة لهذا المسجد حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {upcomingAssignments.map((a) => {
                  const y = a.hijriYear || activeHijriYear;
                  const m = (a as any).hijriMonth || activeHijriMonth;
                  const fridayCheck = CalendarService.validateFridayAction(y, m, a.fridayIndex);
                  const isPast = fridayCheck.isPastFriday;

                  return isPast ? (
                    /* PAST FRIDAY - MUTED ARCHIVED SLATE STYLING */
                    <div
                      key={a.id}
                      className="p-4 rounded-xl border border-slate-300/80 bg-slate-100/85 hover:bg-slate-100 flex items-center justify-between shadow-2xs transition-all relative overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-700 font-heading">
                            الجمعة ({a.fridayIndex})
                          </span>
                          <span className="text-xs text-slate-500 font-mono">{a.hijriDate}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                            <Clock className="w-2.5 h-2.5 text-slate-500" />
                            <span>جمعة منتهية</span>
                          </span>
                        </div>

                        <div className="pt-0.5">
                          <span className="text-[11px] text-slate-500 block">الخطيب المكلف:</span>
                          {a.imamId && a.imamName ? (
                            <ClickableImam
                              id={a.imamId}
                              name={a.imamName}
                              className="text-sm font-semibold text-slate-800 hover:text-slate-950"
                            />
                          ) : (
                            <span className="text-xs text-slate-500 italic">شاغر (بدون خطيب)</span>
                          )}
                          {a.imamPhone && (
                            <span className="text-[11px] text-slate-400 block font-mono">
                              هاتف: {a.imamPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-left space-y-1.5 flex flex-col items-end shrink-0">
                        <Badge variant="inactive" size="sm">
                          {a.source === 'FIXED' ? 'راتب' : a.source === 'PREFERENCE' ? 'مفضل' : 'متوازن'}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          شهر {a.monthName}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* UPCOMING FRIDAY - VIBRANT GLOWING EMERALD & GOLD STYLING */
                    <div
                      key={a.id}
                      className="p-4 rounded-xl border-2 border-emerald-500/90 bg-gradient-to-br from-emerald-50/90 via-white to-amber-50/60 flex items-center justify-between shadow-md ring-2 ring-emerald-500/20 hover:border-emerald-600 transition-all relative overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-emerald-950 font-heading">
                            الجمعة ({a.fridayIndex})
                          </span>
                          <span className="text-xs text-emerald-800 font-mono font-bold">{a.hijriDate}</span>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                            <span>الجمعة القادمة (نشطة)</span>
                          </span>
                        </div>

                        <div className="pt-0.5">
                          <span className="text-[11px] text-emerald-800 font-bold block">الخطيب المكلف:</span>
                          {a.imamId && a.imamName ? (
                            <ClickableImam
                              id={a.imamId}
                              name={a.imamName}
                              className="text-sm font-bold text-slate-900 hover:text-emerald-800"
                            />
                          ) : (
                            <span className="text-xs text-rose-700 font-bold italic">شاغر (بدون خطيب)</span>
                          )}
                          {a.imamPhone && (
                            <span className="text-[11px] text-slate-500 block font-mono">
                              هاتف: {a.imamPhone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-left space-y-1.5 flex flex-col items-end shrink-0">
                        <Badge variant={a.source === 'FIXED' ? 'fixed' : a.source === 'PREFERENCE' ? 'preferred' : 'balanced'} size="sm">
                          {a.source === 'FIXED' ? 'راتب' : a.source === 'PREFERENCE' ? 'مفضل' : 'متوازن'}
                        </Badge>
                        <span className="text-[10px] text-emerald-800 font-bold block font-mono">
                          شهر {a.monthName}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })()}

      {/* TAB 1.5: FIXED PATTERN */}
      {activeTab === 'fixed-pattern' && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>
                  نمط الخطباء الثابت لمسجد ({mosque.name}) لشهر {activeSchedule?.monthName || 'الحالي'} {activeSchedule?.hijriYear || 1448} هـ
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                تثبيت محدد للخطباء على مستوى كل جمعة داخل الشهر المختار (قيد صارم Hard Constraint).
              </p>
            </div>

            <div className="flex items-center gap-2">
              {onEditMosque && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onEditMosque(mosque)}
                  leftIcon={<Edit className="w-3.5 h-3.5" />}
                >
                  تعديل نمط التثبيت
                </Button>
              )}
            </div>
          </div>

          {!fixedPatternData?.exists || !fixedPatternData?.pattern ? (
            <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-500 space-y-2">
              <Lock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold">لا يوجد نمط تثبيت خاص محفوظ لهذا الشهر.</p>
              <p className="text-[11px] text-slate-400">
                يتم توزيع خطباء هذا المسجد دورياً ومرناً حسب التفضيلات ومصفوفة القواعد وعدالة الأحمال.
              </p>
              {onEditMosque && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-2"
                  onClick={() => onEditMosque(mosque)}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  إنشاء وتثبيت نمط لهذا الشهر
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-950">نوع النمط:</span>
                  <Badge variant="fixed" size="sm">
                    {fixedPatternData.pattern.patternType === 'SAME_ALL'
                      ? 'نفس الخطيب لكافة جمعات الشهر'
                      : fixedPatternData.pattern.patternType === 'SPLIT_COUNTS'
                      ? 'توزيع الخطباء على عدد من الجمع'
                      : fixedPatternData.pattern.patternType === 'SPECIFIC_FRIDAYS'
                      ? 'تحديد خطيب لكل جمعة'
                      : 'نمط مخصص'}
                  </Badge>
                </div>
                <span className="text-slate-600 font-medium">
                  إجمالي جمعات الشهر: <strong>{fixedPatternData.pattern.fridaysCount || 5} جمعات</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {fixedPatternData.pattern.items?.map((item: any) => (
                  <div
                    key={item.id || item.fridayIndex}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 hover:border-emerald-600/40 transition-all"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-emerald-950 font-heading">
                        الجمعة ({item.fridayIndex})
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{item.hijriDate || `جمعة ${item.fridayIndex}`}</span>
                    </div>

                    <div>
                      <span className="text-[11px] text-slate-400 block">الخطيب المثبت:</span>
                      <ClickableImam
                        id={item.imamId}
                        name={item.imamName}
                        className="text-xs font-bold text-slate-900 hover:text-emerald-800"
                      />
                      {item.imamPhone && (
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          هاتف: {item.imamPhone}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: FULL SCHEDULE */}
      {activeTab === 'schedule' && (
        <Card variant="default" className="overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h3 className="text-sm font-bold font-heading text-slate-900">
              سجل خطباء الجمعة في المسجد عبر الشهور
            </h3>
            <span className="text-xs text-slate-500">إجمالي {assignments.length} جمعة</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">م</th>
                  <th className="py-2.5 px-3">الجمعة والتاريخ</th>
                  <th className="py-2.5 px-3">الشهر والسنة</th>
                  <th className="py-2.5 px-3">الخطيب المكلف</th>
                  <th className="py-2.5 px-3 text-center">مصدر التعيين</th>
                  <th className="py-2.5 px-3 text-center">القفل</th>
                  <th className="py-2.5 px-3 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center font-bold text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 block font-heading">
                        الجمعة ({a.fridayIndex})
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">{a.hijriDate}</span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">
                      شهر {a.monthName} {a.hijriYear} هـ
                    </td>
                    <td className="py-2.5 px-3">
                      {a.imamId && a.imamName ? (
                        <ClickableImam
                          id={a.imamId}
                          name={a.imamName}
                          className="text-xs font-bold text-slate-900 hover:text-emerald-800"
                        />
                      ) : (
                        <span className="text-rose-700 font-bold italic">شاغر</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={a.source === 'FIXED' ? 'fixed' : 'balanced'} size="sm">
                        {a.source === 'FIXED'
                          ? 'خطيب راتب'
                          : a.source === 'PREFERENCE'
                          ? 'تفضيل مسجد'
                          : a.source === 'BALANCED'
                          ? 'توزيع عادل'
                          : a.source}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs">
                      {a.isLocked ? <Lock className="w-3.5 h-3.5 text-purple-700 mx-auto" /> : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant={a.isUpcoming ? 'approved' : 'inactive'} size="sm">
                        {a.isUpcoming ? 'قادمة ومؤكدة' : 'سابقة'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: PREFERENCES & RULES */}
      {activeTab === 'preferences' && (
        <div className="space-y-4">
          {/* Preferred Imams */}
          <Card variant="default" className="p-5 space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold font-heading text-emerald-950 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>الخطباء المفضلون للمسجد (Preferred)</span>
              </h4>
              <span className="text-xs text-slate-500">{rules.preferred.length} خطيب</span>
            </div>

            {rules.preferred.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">لا يوجد خطباء مفضلون محددون.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rules.preferred.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-amber-200/80 bg-amber-50/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <ClickableImam
                        id={r.imamId}
                        name={r.imamName}
                        className="font-bold text-slate-900 hover:text-emerald-800"
                      />
                      <span className="text-[10px] text-slate-500 block">
                        أولوية الاختيار: {r.priority}
                      </span>
                    </div>
                    <Badge variant="preferred" size="sm">
                      مفضل
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Forbidden Imams */}
          <Card variant="default" className="p-5 space-y-3">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <h4 className="text-sm font-bold font-heading text-rose-950 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>الخطباء المحظورون (Forbidden — لا يعينون في هذا المسجد)</span>
              </h4>
              <span className="text-xs text-slate-500">{rules.forbidden.length} خطيب</span>
            </div>

            {rules.forbidden.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">لا يوجد أي خطيب محظور في هذا المسجد.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rules.forbidden.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <ClickableImam
                        id={r.imamId}
                        name={r.imamName}
                        className="font-bold text-slate-900 hover:text-emerald-800"
                      />
                      {r.notes && <span className="text-[10px] text-slate-500 block">{r.notes}</span>}
                    </div>
                    <Badge variant="conflict" size="sm">
                      ممنوع
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 4: PREACHER HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {linkedImams.map((im) => (
              <Card key={im.imamId} variant="default" className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <ClickableImam
                      id={im.imamId}
                      name={im.imamName}
                      className="text-sm font-bold text-slate-900 hover:text-emerald-800 font-heading block"
                    />
                    <span className="text-[11px] text-slate-400 font-medium">
                      {im.imamType === 'FIXED' ? 'راتب' : 'مرن'}
                    </span>
                  </div>
                  {im.relationshipType && (
                    <Badge variant={im.relationshipType === 'FIXED' ? 'fixed' : 'preferred'} size="sm">
                      {im.relationshipType === 'FIXED' ? 'راتب' : im.relationshipType}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 text-slate-700">
                    <span className="text-[10px] text-slate-400 block">إجمالي الجمعات:</span>
                    <span className="font-bold text-sm text-slate-900 tabular-nums">
                      {im.assignedCount} جمعة
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 text-slate-700">
                    <span className="text-[10px] text-slate-400 block">الجمعة القادمة:</span>
                    <span className="font-semibold text-[11px] text-emerald-950 truncate block">
                      {im.nextDate || 'لا يوجد'}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => onOpenImamProfile(im.imamId)}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <span>فتح ملف الخطيب</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <span>سجل العمليات والتدقيق التاريخي للمسجد</span>
            </h3>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              لا توجد عمليات تعديل مسجلة في الأرشيف لهذا المسجد.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block">{log.action}</span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      بواسطة: {log.userEmail || 'النظام'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {new Date(log.createdAt).toLocaleString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {exportModalOpen && mosque && (
        <ExportModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          defaultEntityType="MOSQUES"
          singleEntityId={mosque.id}
          singleEntityName={mosque.name}
        />
      )}

      {pdfModalOpen && mosque && (
        <BatchPdfExportModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          entityType="MOSQUES"
          selectedIds={[mosque.id]}
          allMosques={[mosque]}
        />
      )}
    </div>
  );
}
