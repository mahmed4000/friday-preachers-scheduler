import React, { useState, useEffect } from 'react';
import {
  Users,
  Building2,
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
  ExternalLink,
  ChevronLeft,
  FileText,
  Sparkles,
  Smartphone,
  ArrowUpDown,
} from 'lucide-react';
import { BatchPdfExportModal } from '../import-export/BatchPdfExportModal.tsx';
import { PreacherMobileCardModal, PreacherCardAssignmentItem } from '../portal/PreacherMobileCardModal.tsx';
import { ImamProfileData, Imam, Mosque } from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import initialSeed from '../../db/initialSeed.json';
import { buildWhatsAppLink } from '../../lib/whatsapp.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Card } from '../ui/Card.tsx';
import { Tabs } from '../ui/Tabs.tsx';
import { OrnamentalSeparator } from '../ui/OrnamentalSeparator.tsx';
import { ClickableMosque } from '../../context/ProfileNavigationContext.tsx';

import { getFallbackImamProfile } from '../../lib/profileFallbacks.ts';
import { DEFAULT_ORGANIZATION_SETTINGS, DEFAULT_SHARIA_LOGO } from '../../lib/defaultLogo.ts';
import { CalendarService } from '../../services/calendar/calendarService.ts';

interface ImamProfileViewProps {
  imamId: number;
  onBack: () => void;
  onEditImam?: (imam: Imam) => void;
  onOpenMosqueProfile: (mosqueId: number) => void;
}

export function ImamProfileView({
  imamId,
  onBack,
  onEditImam,
  onOpenMosqueProfile,
}: ImamProfileViewProps) {
  const [data, setData] = useState<ImamProfileData | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('upcoming');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [smartCardOpen, setSmartCardOpen] = useState(false);
  const [selectedSmartCardAssign, setSelectedSmartCardAssign] = useState<any>(null);
  const [scheduleSortDirection, setScheduleSortDirection] = useState<'asc' | 'desc'>('asc');
  const [scheduleFilterStatus, setScheduleFilterStatus] = useState<'ALL' | 'UPCOMING' | 'PAST'>('ALL');
  const [scheduleFilterMonth, setScheduleFilterMonth] = useState<string>('ALL');

  const handleOpenSmartCard = (targetAssign?: any) => {
    setSelectedSmartCardAssign(targetAssign || null);
    setSmartCardOpen(true);
  };

  const loadProfile = async (schedId?: number) => {
    setLoading(true);
    setError(null);
    try {
      const url = schedId
        ? `/api/imams/${imamId}/profile?scheduleId=${schedId}`
        : selectedScheduleId
        ? `/api/imams/${imamId}/profile?scheduleId=${selectedScheduleId}`
        : `/api/imams/${imamId}/profile`;
      const res = await fetchApi<ImamProfileData>(url);
      setData(res);
      if (schedId) {
        setSelectedScheduleId(schedId);
      } else if (!selectedScheduleId && res.activeSchedule) {
        setSelectedScheduleId(res.activeSchedule.id);
      }
    } catch (err: any) {
      console.warn('Backend unavailable, attempting local seed fallback for imam profile:', err);
      const fallback = getFallbackImamProfile(imamId, schedId || selectedScheduleId);
      if (fallback) {
        setData(fallback);
        if (schedId) {
          setSelectedScheduleId(schedId);
        } else if (!selectedScheduleId && fallback.activeSchedule) {
          setSelectedScheduleId(fallback.activeSchedule.id);
        }
      } else {
        console.error('Error fetching imam profile and no local fallback found:', err);
        setError(err.message || 'تعذر تحميل الملف التعريفي للخطيب');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedScheduleId(undefined);
    loadProfile(undefined);
  }, [imamId]);

  const handlePrint = () => {
    if (!data?.imam) {
      setPdfModalOpen(true);
      return;
    }

    try {
      let orgSettings = DEFAULT_ORGANIZATION_SETTINGS;
      try {
        const saved = localStorage.getItem('sharia_org_settings');
        if (saved) orgSettings = { ...DEFAULT_ORGANIZATION_SETTINGS, ...JSON.parse(saved) };
      } catch {
        // fallback to defaults
      }
      const logoUrl = orgSettings.logoUrl && !orgSettings.logoUrl.startsWith('data:image/svg+xml')
        ? orgSettings.logoUrl
        : DEFAULT_SHARIA_LOGO;

      // Strict chronological sorting: Current month FIRST, then upcoming ASC, then archive last
      const currentDT = CalendarService.getCurrentDateTime();
      const currVal = currentDT.hijri.year * 12 + currentDT.hijri.month;

      const sortedAssignments = [...(data.assignments || [])].sort((x: any, y: any) => {
        const xVal = (x.hijriYear || 1448) * 12 + (x.hijriMonth || 1);
        const yVal = (y.hijriYear || 1448) * 12 + (y.hijriMonth || 1);

        // Current month strictly first
        const xIsCurrent = xVal === currVal;
        const yIsCurrent = yVal === currVal;
        if (xIsCurrent && !yIsCurrent) return -1;
        if (!xIsCurrent && yIsCurrent) return 1;

        // Future vs Past
        const xIsPast = xVal < currVal;
        const yIsPast = yVal < currVal;
        if (!xIsPast && yIsPast) return -1;
        if (xIsPast && !yIsPast) return 1;

        if (xVal !== yVal) {
          if (xIsPast && yIsPast) return yVal - xVal; // Most recent past first
          return xVal - yVal; // Nearest future first!
        }
        return (x.fridayIndex || 0) - (y.fridayIndex || 0);
      });

      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <title>بطاقة الخطيب - ${data.imam.name}</title>
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
                      <p class="text-[11px] font-semibold text-slate-500 leading-tight mt-0.5">${orgSettings.departmentName || 'أمانة شؤون المساجد والدعوة'}</p>
                    </div>
                  </div>

                  <div class="text-left font-mono text-xs text-slate-600 shrink-0">
                    <p class="font-bold text-slate-900 text-sm">بطاقة تعريف وتكليفات خطيب</p>
                    <p class="mt-0.5">كود الخطيب: <strong class="text-emerald-900 font-bold">#${data.imam.id}</strong></p>
                    <p class="text-[11px] text-slate-500">تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>

                <!-- Preacher Details Card -->
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-xs">
                  <div><span class="text-slate-500 font-semibold block">اسم الخطيب والداعية:</span><strong class="text-base text-slate-900">${data.imam.name}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">التصنيف والتكليف:</span><strong class="text-emerald-800">${data.imam.type === 'FIXED' ? 'خطيب راتب (ثابت)' : data.imam.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن'}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">هاتف التواصل:</span><strong class="text-slate-900 font-mono">${data.imam.phone || '—'}</strong></div>
                  <div><span class="text-slate-500 font-semibold block">المنطقة والمحافظة:</span><strong class="text-slate-900">${data.imam.region || 'منشأة البكاري — الجيزة'}</strong></div>
                </div>

                <!-- Chronological Assignments Table (Starting with Current / Nearest months) -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-bold text-slate-900">
                      جدول التكليفات المسجلة للخطيب (مرتبة زمنياً من الشهر الحالي والقريب إلى الشهور القادمة):
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
                        <th class="p-2 border-r border-slate-200">المسجد المكلف به</th>
                        <th class="p-2 border-r border-slate-200 text-center w-24">كود المسجد</th>
                        <th class="p-2 border-r border-slate-200">المنطقة والحي</th>
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
                            <td class="p-2 border-r border-slate-200 font-bold text-emerald-950">${as.mosqueName || 'مسجد معتمد'}</td>
                            <td class="p-2 border-r border-slate-200 font-mono text-center">${as.mosqueCode || '—'}</td>
                            <td class="p-2 border-r border-slate-200">${as.mosqueRegion || as.region || 'منشأة البكاري'}</td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>

                <!-- Signatures Footer -->
                <div class="pt-8 border-t-2 border-slate-200 grid grid-cols-3 text-center text-xs font-bold text-slate-800">
                  <div>
                    <p class="text-slate-500 font-normal mb-8">${orgSettings.schedulePreparerTitle || 'مسؤول المتابعة والتوزيع'}</p>
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
        <p className="text-xs font-semibold">جارٍ تحميل الملف التعريفي للخطيب...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4" dir="rtl">
        <AlertTriangle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 font-heading">خطأ في جلب بيانات الخطيب</h3>
        <p className="text-xs text-rose-700">{error || 'لم يتم العثور على الخطيب المطلوب'}</p>
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

  const { imam, activeSchedule, availableSchedules, stats, assignments, linkedMosques, rules, availabilities, auditLogs } = data;

  const upcomingAssignments = CalendarService.deduplicateAssignmentsByFriday(data.upcomingAssignments || []);

  const profileTabs = [
    { id: 'upcoming', label: 'الجمعات القادمة', badge: upcomingAssignments.length },
    { id: 'schedule', label: 'جدول الجمعات الكامل', badge: assignments.length },
    { id: 'mosques', label: 'المساجد المرتبطة', badge: linkedMosques.length },
    { id: 'rules', label: 'التفضيلات والقواعد', badge: rules.length },
    { id: 'availability', label: 'التوفر والاستثناءات', badge: availabilities.length },
    { id: 'history', label: 'سجل العمليات والتدقيق', badge: auditLogs.length },
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
            <span className="text-slate-500">سجل الخطباء</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">{imam.name}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {onEditImam && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEditImam(imam)}
                leftIcon={<Edit className="w-3.5 h-3.5 text-slate-600" />}
              >
                تعديل الملف
              </Button>
            )}

            <button
              onClick={() => handleOpenSmartCard()}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-black rounded-lg transition-all text-xs flex items-center gap-1.5 cursor-pointer shadow-xs border border-amber-500/40"
              title="فتح الكارت الذهبي الذكي للخطيب"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-950" />
              <span>الكارت الذهبي 📱</span>
            </button>

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
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5 text-slate-600" />}
            >
              طباعة الملف
            </Button>

            {imam.phone && (
              <a
                href={buildWhatsAppLink(
                  imam.phone,
                  `السلام عليكم ورحمة الله، فضيلة الشيخ ${imam.name}، تحية طيبة من أمانة شؤون المساجد بالجمعية الشرعية.`
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="accent"
                  size="sm"
                  leftIcon={<Send className="w-3.5 h-3.5" />}
                >
                  مراسلة واتساب
                </Button>
              </a>
            )}
          </div>
        </div>

        {/* Profile Card Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 text-amber-300 flex items-center justify-center font-bold text-xl font-heading shadow-sm shrink-0 border-2 border-amber-500/20">
              {imam.name.charAt(0) || 'خ'}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
                  {imam.name}
                </h1>
                <Badge variant={imam.isActive ? 'approved' : 'inactive'}>
                  {imam.isActive ? 'نشط ومعتمد' : 'غير نشط'}
                </Badge>
                <Badge variant={imam.type === 'FIXED' ? 'fixed' : 'balanced'}>
                  {imam.type === 'FIXED'
                    ? 'خطيب راتب (ثابت)'
                    : imam.type === 'PARTIAL_FIXED'
                    ? 'ثابت جزئي'
                    : 'خطيب مرن'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-0.5">
                {imam.region && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>المنطقة: {imam.region}</span>
                  </span>
                )}
                {imam.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{imam.phone}</span>
                  </span>
                )}
                {imam.notes && (
                  <span className="text-slate-500 italic max-w-md truncate">
                    ملاحظات: {imam.notes}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-left hidden lg:block text-xs text-slate-500 font-mono">
            <span>كود الخطيب: #{imam.id}</span>
            <br />
            <span>تاريخ التسجيل: {imam.createdAt ? new Date(imam.createdAt).toLocaleDateString('ar-SA') : '—'}</span>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">جمعات الشهر المحدد</span>
          <span className="text-xl font-bold font-heading text-slate-900 tabular-nums">
            {stats.currentMonthFridaysCount ?? stats.totalAssigned} من {stats.currentScheduleFridaysTotal ?? 5}
          </span>
          <span className="text-[10px] text-emerald-800 block mt-0.5 font-medium">
            {(stats.currentMonthFridaysCount ?? stats.totalAssigned) >= stats.targetFridays ? 'مكتمل المستهدف ✓' : 'ضمن التكليف'}
          </span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">الجمعات القادمة</span>
          <span className="text-xl font-bold font-heading text-emerald-950 tabular-nums">
            {stats.upcomingCount}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">جاهزة ومؤكدة</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">المساجد المكلف بها</span>
          <span className="text-xl font-bold font-heading text-slate-900 tabular-nums">
            {stats.mosquesCount}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">مساجد وجوامع</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">المستهدف شهرياً</span>
          <span className="text-xl font-bold font-heading text-amber-900 tabular-nums">
            {stats.targetFridays}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">جمعات مستهدفة</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">النطاق المسموح</span>
          <span className="text-sm font-bold font-heading text-slate-800 block mt-1 tabular-nums">
            {stats.minFridays} إلى {stats.maxFridays}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">الحد الأدنى والأقصى</span>
        </Card>

        <Card variant="warm" className="p-3 text-center">
          <span className="text-[11px] text-slate-500 block">إجمالي الأرشيف</span>
          <span className="text-xl font-bold font-heading text-slate-800 tabular-nums">
            {stats.lifetimeTotalAssigned ?? stats.totalAssigned}
          </span>
          <span className="text-[10px] text-slate-500 block mt-0.5">كافة الأشهر المسجلة</span>
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
                    جمعات وتكليفات الخطيب لشهر {activeSchedule?.monthName || stats.currentMonthName || 'الحالي'} {activeSchedule?.hijriYear || stats.currentHijriYear || 1448} هـ
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  بيان جمعات الشهر المعتمدة (يحتوي الشهر على {activeSchedule?.fridaysCount || stats.currentScheduleFridaysTotal || 5} جمعات — الجمع المنتهية تظهر بلون رمادي مؤرشف والجمعة القادمة بلون أخضر زمردي مميز)
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
                لا توجد جمعات مسندة لهذا الخطيب في الوقت الحالي.
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
                          <span className="text-[11px] text-slate-500 block">المسجد المكلف به:</span>
                          <ClickableMosque
                            id={a.mosqueId}
                            name={a.mosqueName}
                            code={a.mosqueCode}
                            showCode
                            className="text-sm font-semibold text-slate-800 hover:text-slate-950"
                          />
                          <span className="text-[11px] text-slate-400 block font-normal mt-0.5">
                            المنطقة: {a.mosqueRegion}
                          </span>
                        </div>
                      </div>

                      <div className="text-left space-y-1.5 flex flex-col items-end shrink-0">
                        <Badge variant="inactive" size="sm">
                          {a.source === 'FIXED' ? 'راتب' : a.source === 'PREFERENCE' ? 'مفضل' : 'متوازن'}
                        </Badge>
                        <button
                          onClick={() => handleOpenSmartCard(a)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-md text-[11px] flex items-center gap-1 cursor-pointer border border-slate-300 transition-colors shadow-2xs"
                          title="عرض أرشيف الكارت لهذه الجمعة المنتهية"
                        >
                          <Clock className="w-2.5 h-2.5 text-slate-500" />
                          <span>أرشيف الكارت 📱</span>
                        </button>
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
                          <span className="text-[11px] text-emerald-800 font-bold block">المسجد المكلف به:</span>
                          <ClickableMosque
                            id={a.mosqueId}
                            name={a.mosqueName}
                            code={a.mosqueCode}
                            showCode
                            className="text-sm font-bold text-slate-900 hover:text-emerald-800"
                          />
                          <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                            المنطقة: {a.mosqueRegion}
                          </span>
                        </div>
                      </div>

                      <div className="text-left space-y-1.5 flex flex-col items-end shrink-0">
                        <Badge variant={a.source === 'FIXED' ? 'fixed' : a.source === 'PREFERENCE' ? 'preferred' : 'balanced'} size="sm">
                          {a.source === 'FIXED' ? 'راتب' : a.source === 'PREFERENCE' ? 'مفضل' : 'متوازن'}
                        </Badge>
                        <button
                          onClick={() => handleOpenSmartCard(a)}
                          className="px-2.5 py-1 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-200 hover:from-amber-300 hover:to-amber-100 text-slate-950 font-black rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs border border-amber-500/50 ring-1 ring-amber-400/40"
                          title="فتح الكارت الذهبي لهذه الجمعة القادمة"
                        >
                          <Sparkles className="w-3 h-3 text-amber-950" />
                          <span>الكارت الذهبي 📱</span>
                        </button>
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

      {/* TAB 2: FULL SCHEDULE */}
      {activeTab === 'schedule' && (() => {
        // Collect unique months
        const availableMonthsInAssignments: Array<{ key: string; label: string; year: number; month: number }> = [];
        const seenKeys = new Set<string>();
        for (const a of assignments) {
          const mNum = a.hijriMonth || 1;
          const key = `${a.hijriYear}-${mNum}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            availableMonthsInAssignments.push({
              key,
              label: `شهر ${a.monthName} ${a.hijriYear} هـ`,
              year: a.hijriYear,
              month: mNum,
            });
          }
        }
        availableMonthsInAssignments.sort((x, y) => (x.year * 12 + x.month) - (y.year * 12 + y.month));

        // Filter & sort assignments
        let filtered = [...assignments];
        if (scheduleFilterMonth !== 'ALL') {
          filtered = filtered.filter((a) => `${a.hijriYear}-${a.hijriMonth || 1}` === scheduleFilterMonth);
        }
        if (scheduleFilterStatus === 'UPCOMING') {
          filtered = filtered.filter((a) => a.isUpcoming);
        } else if (scheduleFilterStatus === 'PAST') {
          filtered = filtered.filter((a) => !a.isUpcoming);
        }

        filtered.sort((x, y) => {
          const xVal = (x.hijriYear || 1448) * 12 + (x.hijriMonth || 1);
          const yVal = (y.hijriYear || 1448) * 12 + (y.hijriMonth || 1);
          let diff = 0;
          if (xVal !== yVal) {
            diff = xVal - yVal;
          } else {
            diff = (x.fridayIndex || 1) - (y.fridayIndex || 1);
          }
          return scheduleSortDirection === 'asc' ? diff : -diff;
        });

        const upcomingCount = assignments.filter((a) => a.isUpcoming).length;
        const pastCount = assignments.filter((a) => !a.isUpcoming).length;

        return (
          <Card variant="default" className="overflow-hidden space-y-0">
            {/* Table Header & Controls Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-emerald-800" />
                  <span>جدول الجمعات الكامل (مرتب زمنياً)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  عرض تسلسلي منتظم لكافة تكليفات الخطيب مرتبة زمنياً شهراً فشهراً (إجمالي {assignments.length} تكليفاً مسجلاً)
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Sort Toggle Button */}
                <button
                  type="button"
                  onClick={() => setScheduleSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 hover:border-emerald-700 text-slate-800 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="تغيير اتجاه ترتيب الجدول"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                    {scheduleSortDirection === 'asc' ? 'الترتيب: من الأقدم للأحدث ⬇️' : 'الترتيب: من الأحدث للأقدم ⬆️'}
                  </span>
                </button>

                {/* Filter by Month Select */}
                {availableMonthsInAssignments.length > 1 && (
                  <select
                    value={scheduleFilterMonth}
                    onChange={(e) => setScheduleFilterMonth(e.target.value)}
                    className="text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-700 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">كافة الأشهر المسجلة ({assignments.length})</option>
                    {availableMonthsInAssignments.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Quick Filter Status Tabs */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-semibold ml-1">تصفية:</span>
                <button
                  type="button"
                  onClick={() => setScheduleFilterStatus('ALL')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    scheduleFilterStatus === 'ALL'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  الكل ({assignments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleFilterStatus('UPCOMING')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    scheduleFilterStatus === 'UPCOMING'
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-950 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  <span>الجمعات القادمة ({upcomingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleFilterStatus('PAST')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    scheduleFilterStatus === 'PAST'
                      ? 'bg-slate-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>الجمعات السابقة ({pastCount})</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-medium">
                معروض الآن: {filtered.length} من أصل {assignments.length} تكليفاً
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  لا توجد تكليفات مطابقة للتصفية المحددة.
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">م</th>
                      <th
                        onClick={() => setScheduleSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors select-none"
                        title="اضغط لعكس الترتيب"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>الجمعة والتاريخ</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th
                        onClick={() => setScheduleSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                        className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/70 transition-colors select-none"
                        title="اضغط لعكس الترتيب"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>الشهر والسنة</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3">المسجد والمنطقة</th>
                      <th className="py-2.5 px-3 text-center">مصدر التعيين</th>
                      <th className="py-2.5 px-3 text-center">القفل</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((a, idx) => (
                      <tr
                        key={a.id}
                        className={`transition-colors ${
                          a.isUpcoming
                            ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`font-bold block font-heading ${
                              a.isUpcoming ? 'text-emerald-950 font-bold' : 'text-slate-900'
                            }`}
                          >
                            الجمعة ({a.fridayIndex})
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">{a.hijriDate}</span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          <span className="font-bold text-slate-900">شهر {a.monthName}</span>
                          <span className="text-slate-500 mr-1">{a.hijriYear} هـ</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <ClickableMosque
                            id={a.mosqueId}
                            name={a.mosqueName}
                            code={a.mosqueCode}
                            showCode
                            className="text-xs font-bold text-slate-900 hover:text-emerald-800"
                          />
                          <span className="text-[10px] text-slate-400 block">{a.mosqueRegion}</span>
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
                            {a.isUpcoming ? '🟢 قادمة ومؤكدة' : '⏱️ سابقة'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        );
      })()}

      {/* TAB 3: LINKED MOSQUES */}
      {activeTab === 'mosques' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {linkedMosques.map((m) => (
              <Card key={m.mosqueId} variant="default" className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <ClickableMosque
                      id={m.mosqueId}
                      name={m.mosqueName}
                      code={m.mosqueCode}
                      showCode
                      className="text-sm font-bold text-slate-900 hover:text-emerald-800 font-heading block"
                    />
                    <span className="text-[11px] text-slate-400 font-medium">المنطقة: {m.mosqueRegion}</span>
                  </div>
                  {m.relationshipType && (
                    <Badge variant={m.relationshipType === 'FIXED' ? 'fixed' : 'preferred'} size="sm">
                      {m.relationshipType === 'FIXED' ? 'راتب' : m.relationshipType}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-50 text-slate-700">
                    <span className="text-[10px] text-slate-400 block">إجمالي الجمعات:</span>
                    <span className="font-bold text-sm text-slate-900 tabular-nums">
                      {m.assignedCount} جمعات
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-50 text-slate-700">
                    <span className="text-[10px] text-slate-400 block">الجمعة القادمة:</span>
                    <span className="font-semibold text-[11px] text-emerald-950 truncate block">
                      {m.nextDate || 'لا يوجد'}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    onClick={() => onOpenMosqueProfile(m.mosqueId)}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                  >
                    <span>فتح ملف المسجد</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: RULES & PREFERENCES */}
      {activeTab === 'rules' && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold font-heading text-slate-900">
              قواعد وتفضيلات التعيين المرتبطة بالمساجد
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تفضيلات المساجد التي تفضل هذا الخطيب أو العلاقات الخاصة المسجلة في المصفوفة
            </p>
          </div>

          {rules.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              لا توجد قواعد تفضيلية خاصة مسجلة لهذا الخطيب حتى الآن، يخضع للتوزيع العادل الافتراضي.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rules.map((r) => (
                <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <ClickableMosque
                      id={r.mosqueId}
                      name={r.mosqueName}
                      className="font-bold text-slate-900 hover:text-emerald-800"
                    />
                    <span className="text-[11px] text-slate-400 block">
                      المنطقة: {r.mosqueRegion || '—'} {r.notes && `· ${r.notes}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        r.relationshipType === 'FIXED'
                          ? 'fixed'
                          : r.relationshipType === 'PREFERRED'
                          ? 'preferred'
                          : 'balanced'
                      }
                      size="sm"
                    >
                      {r.relationshipType === 'PREFERRED'
                        ? `مفضل (أولوية ${r.priority})`
                        : r.relationshipType}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 5: AVAILABILITY EXCEPTIONS */}
      {activeTab === 'availability' && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold font-heading text-slate-900">
              استثناءات عدم التوفر والاعتذارات
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              الأيام والجمعات التي تم استثناء الخطيب من التعيين فيها
            </p>
          </div>

          {availabilities.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              الخطيب متاح افتراضياً في جميع جمعات الشهور بدون أي اعتذارات مسجلة.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {availabilities.map((av) => (
                <div key={av.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-rose-900 block font-heading">
                      الجمعة ({av.fridayIndex}) — شهر {av.hijriMonth} هـ
                    </span>
                    <span className="text-[11px] text-slate-500">
                      السبب: {av.reason || 'اعتذار رسمي مسجل'}
                    </span>
                  </div>

                  <Badge variant="conflict" size="sm">
                    غير متاح للخطبة
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'history' && (
        <Card variant="default" className="p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-600" />
              <span>سجل التدقيق والتعديلات التاريخية</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              توثيق العمليات والتغييرات الإدارية التي تمت على هذا الخطيب
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              لا توجد عمليات تعديل مسجلة في الأرشيف لهذا الخطيب.
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

      <BatchPdfExportModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        entityType="IMAMS"
        selectedIds={[imamId]}
        allImams={[imam]}
      />

      {/* Preacher Golden Smart Card Modal */}
      {smartCardOpen && (
        <PreacherMobileCardModal
          isOpen={smartCardOpen}
          onClose={() => {
            setSmartCardOpen(false);
            setSelectedSmartCardAssign(null);
          }}
          imam={imam}
          assignment={
            selectedSmartCardAssign ||
            (upcomingAssignments.length > 0
              ? upcomingAssignments[0]
              : assignments.length > 0
              ? assignments[0]
              : null)
          }
          mosque={
            selectedSmartCardAssign
              ? ({
                  id: selectedSmartCardAssign.mosqueId,
                  name: selectedSmartCardAssign.mosqueName,
                  code: selectedSmartCardAssign.mosqueCode,
                  region: selectedSmartCardAssign.mosqueRegion || selectedSmartCardAssign.region,
                  formattedAddress: selectedSmartCardAssign.formattedAddress,
                  address: selectedSmartCardAssign.address,
                  latitude: selectedSmartCardAssign.latitude,
                  longitude: selectedSmartCardAssign.longitude,
                  managerName: selectedSmartCardAssign.managerName,
                  phone: selectedSmartCardAssign.mosquePhone || selectedSmartCardAssign.phone,
                } as any)
              : upcomingAssignments.length > 0
              ? ({
                  id: upcomingAssignments[0].mosqueId,
                  name: upcomingAssignments[0].mosqueName,
                  code: upcomingAssignments[0].mosqueCode,
                  region: upcomingAssignments[0].mosqueRegion || upcomingAssignments[0].region,
                  formattedAddress: upcomingAssignments[0].formattedAddress,
                  address: upcomingAssignments[0].address,
                  latitude: upcomingAssignments[0].latitude,
                  longitude: upcomingAssignments[0].longitude,
                  managerName: upcomingAssignments[0].managerName,
                  phone: upcomingAssignments[0].mosquePhone || upcomingAssignments[0].phone,
                } as any)
              : null
          }
          friday={
            selectedSmartCardAssign
              ? ({
                  id: selectedSmartCardAssign.id,
                  fridayIndex: selectedSmartCardAssign.fridayIndex,
                  ordinalName: `الجمعة ${selectedSmartCardAssign.fridayIndex}`,
                  hijriDate: selectedSmartCardAssign.hijriDate,
                  gregorianDate: selectedSmartCardAssign.gregorianDate,
                } as any)
              : upcomingAssignments.length > 0
              ? ({
                  id: upcomingAssignments[0].id,
                  fridayIndex: upcomingAssignments[0].fridayIndex,
                  ordinalName: `الجمعة ${upcomingAssignments[0].fridayIndex}`,
                  hijriDate: upcomingAssignments[0].hijriDate,
                  gregorianDate: upcomingAssignments[0].gregorianDate,
                } as any)
              : null
          }
          schedule={activeSchedule || null}
          assignmentsList={
            (upcomingAssignments.length > 0 ? upcomingAssignments : assignments).map((a) => ({
              assignment: a,
              mosque: {
                id: a.mosqueId,
                name: a.mosqueName,
                code: a.mosqueCode,
                region: a.mosqueRegion || a.region,
                formattedAddress: a.formattedAddress,
                address: a.address,
                latitude: a.latitude,
                longitude: a.longitude,
                managerName: a.managerName,
                phone: a.mosquePhone || a.phone,
              } as any,
              friday: {
                id: a.id,
                fridayIndex: a.fridayIndex,
                ordinalName: `الجمعة ${a.fridayIndex}`,
                hijriDate: a.hijriDate,
                gregorianDate: a.gregorianDate,
              } as any,
            }))
          }
          onStatusUpdated={() => loadProfile()}
        />
      )}
    </div>
  );
}
