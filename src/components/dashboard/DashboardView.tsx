import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Building2,
  Users,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  Send,
  RefreshCw,
  Copy,
  Search,
  Phone,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Plus,
  Upload,
  Check,
  Smartphone,
  Printer,
  FileText,
  Award,
} from 'lucide-react';
import {
  MonthlySchedule,
  DashboardAlert,
  Mosque,
  Imam,
  Friday,
  Assignment,
} from '../../types/index.ts';
import { fetchApi } from '../../lib/api.ts';
import initialSeed from '../../db/initialSeed.json';
import { buildWhatsAppLink } from '../../lib/whatsapp.ts';
import { CalendarService } from '../../services/calendar/calendarService.ts';
import { CurrentDateTimeInfo } from '../../services/calendar/types.ts';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/Badge.tsx';
import { Card } from '../ui/Card.tsx';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';
import { OfficialDecreeModal } from '../decree/OfficialDecreeModal.tsx';
import { PreacherMobileCardModal } from '../portal/PreacherMobileCardModal.tsx';

interface DashboardProps {
  stats: {
    totalMosques: number;
    activeMosques: number;
    totalImams: number;
    activeImams: number;
    totalAssignments: number;
    totalConflicts: number;
  };
  currentSchedule: MonthlySchedule | null;
  upcomingSchedule: MonthlySchedule | null;
  mosques?: Mosque[];
  imams?: Imam[];
  onNavigateToSchedule: (scheduleId: number) => void;
  onOpenWizard: () => void;
  onNavigateToTab: (tab: any) => void;
  onRefreshData?: () => void;
}

interface DashboardPeriod {
  hijriYear: number;
  hijriMonth: number;
  monthNameAr: string;
  status: 'PAST' | 'CURRENT' | 'FUTURE';
  statusLabelArabic: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  startDateHijri: string;
  endDateHijri: string;
  startDateGregorian: string;
  endDateGregorian: string;
  fridaysCount: number;
  pastFridaysCount: number;
  futureFridaysCount: number;
}

interface DashboardStats {
  totalMosques: number;
  activeMosques: number;
  totalImams: number;
  activeImams: number;
  totalAssignments: number;
  totalRequiredAssignments: number;
  completedAssignments: number;
  completionPercentage: number;
  totalConflicts: number;
}

interface DashboardFridayItem {
  id: number | null;
  fridayIndex: number;
  ordinalName: string;
  hijriDate: string;
  gregorianDate: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  assignedCount: number;
  requiredCount: number;
  vacantCount: number;
  conflictsCount: number;
  status: 'COMPLETED' | 'REVIEW' | 'CONFLICTS' | 'PENDING' | 'PAST';
}

interface NextFridayAssignment {
  id: number;
  fridayIndex: number;
  mosqueId: number;
  mosqueName: string;
  mosqueCode: string;
  mosqueRegion: string;
  managerPhone: string;
  imamId: number | null;
  imamName: string;
  imamPhone: string;
  isLocked: boolean;
  assignmentSource: string;
}

interface NextFridayData {
  fridayIndex: number;
  ordinalName: string;
  hijriDate: string;
  gregorianDate: string;
  monthName: string;
  hijriYear: number;
  daysRemaining: number;
  totalRequired: number;
  totalAssigned: number;
  vacantCount: number;
  isAllMonthFridaysPast?: boolean;
}

export function DashboardView({
  onNavigateToSchedule,
  onOpenWizard,
  onNavigateToTab,
  mosques = [],
  imams = [],
  onRefreshData,
}: DashboardProps) {
  // Live Date Time State
  const [liveDT, setLiveDT] = useState<CurrentDateTimeInfo>(() =>
    CalendarService.getCurrentDateTime()
  );

  // Modal states for Official Decree and Preacher Mobile Card
  const [mobileCardData, setMobileCardData] = useState<{
    assignment: Assignment;
    mosque: Mosque;
    imam: Imam;
    friday: Friday;
  } | null>(null);
  const [isDecreeModalOpen, setIsDecreeModalOpen] = useState(false);
  const [fullScheduleForDecree, setFullScheduleForDecree] = useState<{
    schedule: MonthlySchedule;
    fridays: Friday[];
    assignments: Assignment[];
    mosques: Mosque[];
    imams: Imam[];
  } | null>(null);
  const [loadingDecree, setLoadingDecree] = useState(false);

  const handleOpenOfficialDecree = async () => {
    if (!scheduleData?.id) return;
    setLoadingDecree(true);
    try {
      const res = await fetchApi<any>(`/api/schedules/${scheduleData.id}`);
      if (res && res.schedule) {
        setFullScheduleForDecree({
          schedule: res.schedule,
          fridays: res.fridays || [],
          assignments: res.assignments || [],
          mosques: res.mosques || mosques,
          imams: res.imams || imams,
        });
        setIsDecreeModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to load schedule for decree:', e);
    } finally {
      setLoadingDecree(false);
    }
  };

  // Selected Hijri Year and Month (Default to current real-time month)
  const [selectedYear, setSelectedYear] = useState<number>(() => liveDT.hijri.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(() => liveDT.hijri.month);

  // API Data States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [scheduleData, setScheduleData] = useState<any | null>(null);
  const [fridaysList, setFridaysList] = useState<DashboardFridayItem[]>([]);
  const [nextFriday, setNextFriday] = useState<NextFridayData | null>(null);
  const [nextFridayAssignments, setNextFridayAssignments] = useState<NextFridayAssignment[]>([]);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);

  // Local UI Filter States
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);

  // Live Timer Update
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveDT(CalendarService.getCurrentDateTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Dashboard Data whenever selectedYear or selectedMonth changes
  const loadDashboardData = async (year: number, month: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<any>(`/api/dashboard?hijriYear=${year}&hijriMonth=${month}`);
      if (data) {
        setPeriod(data.period);
        setDashboardStats(data.stats);
        setScheduleData(data.schedule);
        setFridaysList(data.fridays || []);
        setNextFriday(data.nextFriday);
        setNextFridayAssignments(data.nextFridayAssignments || []);
        setAlerts(data.alerts || []);
      }
    } catch (err: any) {
      console.warn('Dashboard fetch failed, computing from local calendar & seed:', err?.message || err);
      try {
        const monthDetails = CalendarService.getHijriMonthDetails(year, month);
        const seedMosques = (initialSeed.mosques || []) as any[];
        const seedImams = (initialSeed.imams || []) as any[];
        const seedSched = initialSeed.monthlySchedules?.find(
          (s: any) => s.hijriYear === year && s.hijriMonth === month
        ) || initialSeed.monthlySchedules?.[0] || null;
        const seedAssigns = (initialSeed.assignments || []) as any[];

        setPeriod({
          hijriYear: year,
          hijriMonth: month,
          monthNameAr: monthDetails.monthName,
          status: monthDetails.periodStatus,
          statusLabelArabic: monthDetails.statusLabelArabic,
          isPast: monthDetails.isPast,
          isCurrent: monthDetails.isCurrent,
          isFuture: monthDetails.isFuture,
          startDateHijri: `1 ${monthDetails.monthName} ${year} هـ`,
          endDateHijri: `${monthDetails.daysCount} ${monthDetails.monthName} ${year} هـ`,
          startDateGregorian: monthDetails.startDateGregorian,
          endDateGregorian: monthDetails.endDateGregorian,
          fridaysCount: monthDetails.fridaysCount,
          pastFridaysCount: monthDetails.pastFridaysCount,
          futureFridaysCount: monthDetails.futureFridaysCount,
        });

        const activeMosquesCount = seedMosques.filter((m: any) => m.isActive).length;
        const activeImamsCount = seedImams.filter((i: any) => i.isActive).length;
        const totalReq = activeMosquesCount * monthDetails.fridaysCount;
        const completedCount = seedAssigns.filter((a: any) => a.imamId !== null).length;

        setDashboardStats({
          totalMosques: seedMosques.length,
          activeMosques: activeMosquesCount,
          totalImams: seedImams.length,
          activeImams: activeImamsCount,
          totalAssignments: completedCount,
          totalRequiredAssignments: totalReq,
          completedAssignments: completedCount,
          completionPercentage: totalReq > 0 ? Math.min(100, Math.round((completedCount / totalReq) * 100)) : 100,
          totalConflicts: 0,
        });

        setScheduleData(seedSched);

        const fridaysWithStats: DashboardFridayItem[] = monthDetails.fridays.map((f: any) => ({
          id: f.fridayIndex,
          fridayIndex: f.fridayIndex,
          ordinalName: f.ordinalName,
          hijriDate: f.hijriDate,
          gregorianDate: f.gregorianDate,
          isPast: f.isPast,
          isCurrent: f.periodStatus === 'CURRENT',
          isFuture: f.periodStatus === 'FUTURE',
          assignedCount: activeMosquesCount,
          requiredCount: activeMosquesCount,
          vacantCount: 0,
          conflictsCount: 0,
          status: f.isPast ? 'PAST' : 'COMPLETED',
        }));
        setFridaysList(fridaysWithStats);

        const targetF = monthDetails.fridays.find((f: any) => !f.isPast) || monthDetails.fridays[0];
        if (targetF) {
          const mosqueMap = new Map(seedMosques.map((m: any) => [m.id, m]));
          const imamMap = new Map(seedImams.map((i: any) => [i.id, i]));
          const assigns = seedAssigns
            .filter((a: any) => a.fridayIndex === targetF.fridayIndex)
            .map((a: any) => {
              const m = mosqueMap.get(a.mosqueId);
              const i = imamMap.get(a.imamId);
              return {
                id: a.id,
                fridayIndex: a.fridayIndex,
                mosqueId: a.mosqueId,
                mosqueName: m?.name || 'مسجد',
                mosqueCode: m?.code || '',
                mosqueRegion: m?.region || '',
                managerPhone: m?.phone || '',
                imamId: a.imamId,
                imamName: i?.name || 'شاغر',
                imamPhone: i?.phone || '',
                isLocked: a.isLocked || false,
                assignmentSource: a.source || 'FIXED',
              };
            });
          setNextFridayAssignments(assigns);

          const targetDate = new Date(targetF.gregorianIso);
          const now = new Date();
          const diffMs = targetDate.getTime() - now.getTime();
          const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

          setNextFriday({
            fridayIndex: targetF.fridayIndex,
            ordinalName: targetF.ordinalName,
            hijriDate: targetF.hijriDate,
            gregorianDate: targetF.gregorianDate,
            monthName: monthDetails.monthName,
            hijriYear: year,
            daysRemaining,
            totalRequired: activeMosquesCount,
            totalAssigned: assigns.length,
            vacantCount: 0,
          });
        }
      } catch (fallbackErr) {
        console.error('Local calculation error:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Quick Month Navigation
  const handlePrevMonth = () => {
    let newM = selectedMonth - 1;
    let newY = selectedYear;
    if (newM < 1) {
      newM = 12;
      newY -= 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
  };

  const handleNextMonth = () => {
    let newM = selectedMonth + 1;
    let newY = selectedYear;
    if (newM > 12) {
      newM = 1;
      newY += 1;
    }
    setSelectedMonth(newM);
    setSelectedYear(newY);
  };

  const handleResetToCurrentMonth = () => {
    const cur = CalendarService.getCurrentDateTime();
    setSelectedYear(cur.hijri.year);
    setSelectedMonth(cur.hijri.month);
  };

  const isSelectedCurrentMonth =
    selectedYear === liveDT.hijri.year && selectedMonth === liveDT.hijri.month;

  const handleCopyAssignment = (a: NextFridayAssignment) => {
    const text = `تكليف خطبة الجمعة (${nextFriday?.ordinalName}):\nالمسجد: ${a.mosqueName} (${a.mosqueRegion})\nالخطيب: ${a.imamName}\nالتاريخ: ${nextFriday?.hijriDate} (${nextFriday?.gregorianDate})`;
    navigator.clipboard.writeText(text);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredAssignments = nextFridayAssignments.filter((a) => {
    const matchSearch =
      a.mosqueName.includes(assignmentSearch) ||
      a.imamName.includes(assignmentSearch) ||
      a.mosqueCode.toLowerCase().includes(assignmentSearch.toLowerCase());
    const matchRegion = regionFilter === 'ALL' || a.mosqueRegion === regionFilter;
    return matchSearch && matchRegion;
  });

  const regions = Array.from(
    new Set(nextFridayAssignments.map((a) => a.mosqueRegion).filter(Boolean))
  );

  const hijriMonthsList = CalendarService.getHijriMonthsList();

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* 1. Official Header & Live Date Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-emerald-950 bg-emerald-50 px-3 py-0.5 rounded-full border border-emerald-300 inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span>
                {liveDT.dayName} {liveDT.hijri.formatted}
              </span>
              <span className="text-emerald-700 font-normal">
                | الموافق {liveDT.gregorian.formatted}
              </span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{liveDT.timeString}</span>
              <span className="text-[10px]">({liveDT.timezoneLabel})</span>
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900 leading-tight">
              لوحة التحكم
            </h2>
            <span className="text-base sm:text-lg font-bold font-heading text-emerald-900">
              — {period?.monthNameAr || ''} {selectedYear} هـ
            </span>
            {period && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                  period.isCurrent
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : period.isPast
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                }`}
              >
                {period.isCurrent
                  ? 'الشهر الحالي ⭐'
                  : period.isPast
                  ? 'الشهر السابق 🔒'
                  : 'الشهر القادم 🔮'}
              </span>
            )}
          </div>
        </div>

        {/* Month Navigation & Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
          {/* Month Selector Control */}
          <div className="relative inline-flex items-center bg-white rounded-xl border border-slate-300 p-0.5 shadow-2xs">
            <button
              onClick={handlePrevMonth}
              title="الشهر السابق"
              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
              className="px-3 py-1 text-xs font-bold font-heading text-slate-900 flex items-center gap-1.5 cursor-pointer hover:bg-slate-50 rounded-lg"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-800" />
              <span>
                {period?.monthNameAr || ''} {selectedYear} هـ
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={handleNextMonth}
              title="الشهر القادم"
              className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Dropdown Menu for Month Selection */}
            {monthDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-2 space-y-2 text-xs">
                <div className="p-1 border-b border-slate-100 flex items-center justify-between font-bold text-slate-700 font-heading">
                  <span>اختر الشهر الهجري:</span>
                  <button
                    onClick={handleResetToCurrentMonth}
                    className="text-[11px] text-emerald-800 hover:underline cursor-pointer"
                  >
                    الشهر الحالي
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto p-1">
                  {hijriMonthsList.map((m) => {
                    const isCur =
                      m.number === liveDT.hijri.month && selectedYear === liveDT.hijri.year;
                    const isSel = m.number === selectedMonth;
                    return (
                      <button
                        key={m.number}
                        onClick={() => {
                          setSelectedMonth(m.number);
                          setMonthDropdownOpen(false);
                        }}
                        className={`p-2 text-right rounded-lg font-medium transition-all cursor-pointer ${
                          isSel
                            ? 'bg-emerald-800 text-white font-bold'
                            : isCur
                            ? 'bg-emerald-50 text-emerald-900 font-bold border border-emerald-300'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="block">{m.name}</span>
                        {isCur && <span className="text-[9px] opacity-80 block">الشهر الحالي</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                  <span className="font-semibold text-slate-600">السنة الهجرية:</span>
                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      setSelectedYear(Number(e.target.value));
                      setMonthDropdownOpen(false);
                    }}
                    className="p-1 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:outline-none"
                  >
                    {CalendarService.getAvailableHijriYears().map((y) => (
                      <option key={y} value={y}>
                        {y} هـ
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {!isSelectedCurrentMonth && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetToCurrentMonth}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-emerald-800" />}
            >
              العودة للشهر الحالي
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadDashboardData(selectedYear, selectedMonth)}
            leftIcon={
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            }
          >
            تحديث
          </Button>

          <Button
            variant="accent"
            size="sm"
            onClick={onOpenWizard}
            leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
          >
            إنشاء جدول جديد
          </Button>
        </div>
      </div>

      {/* 2. Zero Data State Banner if no Mosques or Imams */}
      {dashboardStats &&
        dashboardStats.totalMosques === 0 &&
        dashboardStats.totalImams === 0 && (
          <div className="bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 rounded-2xl border-2 border-dashed border-amber-300 shadow-2xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                <Info className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 font-heading">
                  مرحباً بك في نظام "منظّم الجمعة" — مرحلة استيراد البيانات
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                  النظام جاهز تماماً للعمل. لا توجد مساجد أو خطباء مسجلون في الوقت الحالي. يمكنك
                  رفع البيانات الحقيقية للجمعية عبر مركز الاستيراد التلقائي أو إضافة المساجد
                  والخطباء فردياً.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onNavigateToTab('import-export')}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                مركز استيراد وتصدير البيانات (Excel / CSV)
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigateToTab('mosques')}
                leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-800" />}
              >
                إضافة مساجد
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onNavigateToTab('imams')}
                leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-800" />}
              >
                إضافة خطباء
              </Button>
            </div>
          </div>
        )}

      {/* 3. Hero Card for Selected Month Schedule */}
      <div className="rounded-3xl bg-gradient-to-br from-[#022c22] via-[#054536] to-[#011c15] text-white p-6 sm:p-8 shadow-2xl border-2 border-amber-400/30 ring-2 ring-emerald-500/20 relative overflow-hidden">
        {/* Subtle Islamic Geometric Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none islamic-pattern opacity-15"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            {/* Quranic Verse Banner */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-amiri tracking-wide">
              <span className="font-bold">﷽</span>
              <span>﴿ يَا أَيُّهَا الَّذِينَ آمَنُوا إِذَا نُودِيَ لِلصَّلَاةِ مِن يَوْمِ الْجُمُعَةِ فَاسْعَوْا إِلَىٰ ذِكْرِ اللَّهِ ﴾</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                جدول شهر {period?.monthNameAr || ''} {selectedYear} هـ
              </span>

              {scheduleData ? (
                <Badge
                  variant={
                    scheduleData.status === 'PUBLISHED'
                      ? 'approved'
                      : scheduleData.status === 'APPROVED'
                      ? 'approved'
                      : scheduleData.status === 'REVIEW'
                      ? 'review'
                      : 'draft'
                  }
                >
                  {scheduleData.status === 'PUBLISHED'
                    ? 'منشور رسمياً ✓'
                    : scheduleData.status === 'APPROVED'
                    ? 'معتمد رسمياً'
                    : scheduleData.status === 'REVIEW'
                    ? 'قيد المراجعة'
                    : 'مسودة'}
                </Badge>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-rose-500/20 text-rose-200 border border-rose-400/30">
                  لم يتم إنشاء جدول الشهر بعد ⚠️
                </span>
              )}

              {period?.isPast && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800/80 text-slate-300 font-mono flex items-center gap-1 border border-slate-700">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>شهر سابق (وضع الاطلاع)</span>
                </span>
              )}
            </div>

            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-white drop-shadow-sm">
                منظومة توزيع خطباء الجمعة — {period?.monthNameAr || ''} {selectedYear} هـ
              </h3>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-2xl leading-relaxed">
                {scheduleData
                  ? `جدول خطباء الجمعة لشهر ${period?.monthNameAr} معتمد بالإصدار (V${scheduleData.currentVersion || 1}). يحتوي الشهر على ${period?.fridaysCount || 5} جمعات متتالية لجميع جوامع ومساجد الجمعية.`
                  : `لم يتم إنشاء أو توليد جدول لتكليفات خطباء الجمعة لشهر ${period?.monthNameAr} ${selectedYear} هـ حتى الآن.`}
              </p>
            </div>

            {/* Month Dates Info Row */}
            {period && (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-emerald-100 font-mono">
                <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-xs flex items-center gap-1.5">
                  <span className="text-emerald-200/80">تاريخ الشهر:</span>
                  <span className="font-bold text-amber-300">
                    {period.startDateHijri} — {period.endDateHijri}
                  </span>
                </div>

                <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-xs flex items-center gap-1.5">
                  <span className="text-emerald-200/80">الموافق ميلادياً:</span>
                  <span className="font-bold text-white">
                    {period.startDateGregorian} حتى {period.endDateGregorian}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            {scheduleData ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenOfficialDecree}
                  disabled={loadingDecree}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold font-heading shadow-md shadow-amber-950/40 flex items-center justify-center gap-2 border border-amber-400/40 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText className="w-4 h-4 text-amber-200" />
                  <span>{loadingDecree ? 'جارٍ التجهيز...' : 'الكشف الوزاري الرسمي (A4) 📄'}</span>
                </button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => onNavigateToSchedule(scheduleData.id)}
                  leftIcon={<CalendarDays className="w-4 h-4 text-emerald-800" />}
                >
                  عرض شبكة الجدول
                </Button>

                <Button
                  variant="accent"
                  size="md"
                  onClick={() => onNavigateToTab('publishing')}
                  leftIcon={<Send className="w-4 h-4" />}
                >
                  مركز النشر والطباعة
                </Button>
              </>
            ) : (
              !period?.isPast && (
                <Button
                  variant="accent"
                  size="md"
                  onClick={onOpenWizard}
                  leftIcon={<Sparkles className="w-4 h-4 text-amber-300" />}
                >
                  إنشاء جدول الشهر الآن
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 4. Month Details Card & Completion Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Selected Month Details */}
        <Card variant="warm" className="p-5 space-y-3 lg:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h3 className="text-sm font-bold font-heading text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-800" />
              <span>معلومات الشهر الهجري</span>
            </h3>
            <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {period?.monthNameAr} {selectedYear} هـ
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">عدد جمعات الشهر:</span>
              <span className="font-bold text-slate-900 font-heading tabular-nums text-sm">
                {period?.fridaysCount || 5} جمعات
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">بداية الشهر الهجري:</span>
              <span className="font-bold text-slate-800 font-mono">
                {period?.startDateHijri}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">نهاية الشهر الهجري:</span>
              <span className="font-bold text-slate-800 font-mono">
                {period?.endDateHijri}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">النطاق الميلادي:</span>
              <span className="font-bold text-slate-700 font-mono text-[11px]">
                {period?.startDateGregorian} — {period?.endDateGregorian}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500 font-medium">حالة التوقيت:</span>
              <span className="font-bold text-emerald-900">
                {period?.statusLabelArabic || 'الشهر الحالي'}
              </span>
            </div>
          </div>
        </Card>

        {/* Card 2: Schedule Status & Completion Progress */}
        <Card variant="warm" className="p-5 space-y-4 lg:col-span-2 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
            <div>
              <span className="text-xs text-slate-500 block">حالة ونسبة اكتمال جدول الشهر</span>
              <h3 className="text-base font-bold font-heading text-slate-900 mt-0.5">
                {scheduleData
                  ? `جدول ${period?.monthNameAr} ${selectedYear} هـ`
                  : 'جدول غير مُنشأ بعد'}
              </h3>
            </div>

            <div className="text-left">
              <span className="text-2xl font-bold font-heading text-emerald-950 tabular-nums block leading-none">
                {dashboardStats?.completionPercentage || 0}%
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {dashboardStats?.completedAssignments || 0} / {dashboardStats?.totalRequiredAssignments || 0} تعيين
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-emerald-800 to-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${dashboardStats?.completionPercentage || 0}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>0%</span>
              <span>50%</span>
              <span>100% مكتمل</span>
            </div>
          </div>

          {/* Status Details Box */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between text-xs">
            {scheduleData ? (
              scheduleData.status === 'PUBLISHED' ? (
                <div className="flex items-center gap-2 text-emerald-950 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>جدول الشهر منشور ومعتمد رسمياً لعموم المساجد والخطباء.</span>
                </div>
              ) : scheduleData.status === 'APPROVED' ? (
                <div className="flex items-center gap-2 text-emerald-950 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>جدول الشهر معتمد ومستعد للنشر والطباعة.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-900 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>جدول الشهر قيد الإعداد والمراجعة لم يكتمل اعتماده بعد.</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-rose-900 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>لم يتم إنشاء جدول هذا الشهر حتى الآن.</span>
              </div>
            )}

            {scheduleData && (
              <button
                onClick={() => onNavigateToSchedule(scheduleData.id)}
                className="text-emerald-800 hover:text-emerald-950 font-bold underline cursor-pointer text-xs shrink-0"
              >
                التفاصيل والشبكة
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* 5. Four Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="warm" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">إجمالي المساجد والجوامع</span>
            <span className="text-2xl font-bold font-heading text-slate-900 tabular-nums">
              {dashboardStats?.totalMosques || 0}
            </span>
            <span className="text-[11px] text-emerald-800 block mt-0.5">
              {dashboardStats?.activeMosques || 0} مسجداً نشطاً
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-900 border border-emerald-200">
            <Building2 className="w-5 h-5" />
          </div>
        </Card>

        <Card variant="warm" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">سجل الخطباء والدعاة</span>
            <span className="text-2xl font-bold font-heading text-slate-900 tabular-nums">
              {dashboardStats?.totalImams || 0}
            </span>
            <span className="text-[11px] text-sky-800 block mt-0.5">
              {dashboardStats?.activeImams || 0} متاحاً ومستعداً
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-sky-100/70 text-sky-900 border border-sky-200">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card variant="warm" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">جمعات الشهر الهجري</span>
            <span className="text-2xl font-bold font-heading text-slate-900 tabular-nums">
              {period?.fridaysCount || 5}
            </span>
            <span className="text-[11px] text-emerald-800 font-semibold block mt-0.5">
              {period?.pastFridaysCount || 0} منتهية · {period?.futureFridaysCount || 0} متبقية
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-100/70 text-amber-900 border border-amber-200">
            <CalendarDays className="w-5 h-5" />
          </div>
        </Card>

        <Card variant="warm" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">حالة التعارضات والشغور</span>
            <span className="text-2xl font-bold font-heading text-slate-900 tabular-nums">
              {dashboardStats?.totalConflicts || 0}
            </span>
            <span
              className={`text-[11px] block mt-0.5 font-semibold ${
                (dashboardStats?.totalConflicts || 0) === 0
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }`}
            >
              {(dashboardStats?.totalConflicts || 0) === 0
                ? 'الجدول خالٍ من أي تعارض ✓'
                : 'يتطلب التدقيق والتعديل'}
            </span>
          </div>
          <div
            className={`p-2.5 rounded-xl border ${
              (dashboardStats?.totalConflicts || 0) === 0
                ? 'bg-emerald-100/70 text-emerald-900 border-emerald-200'
                : 'bg-rose-100 text-rose-900 border-rose-200'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* 6. Upcoming Friday Focus Section */}
      {nextFriday && (
        <Card variant="default" className="border-slate-200 shadow-2xs overflow-hidden">
          {/* Header with Countdown */}
          <div className="p-5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-400/20 text-amber-300 rounded border border-amber-300/30">
                  الجمعة القادمة ({nextFriday.ordinalName})
                </span>
                <span className="text-xs text-slate-300 font-mono">
                  {nextFriday.hijriDate} · {nextFriday.gregorianDate}
                </span>
              </div>
              <h3 className="text-lg font-bold font-heading">
                بيان تكليفات صلاة الجمعة القادمة — شهر {nextFriday.monthName} {selectedYear} هـ
              </h3>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                تغطية شاملة لـ {nextFriday.totalAssigned} من أصل {nextFriday.totalRequired}{' '}
                مسجداً في عموم المدينة
              </p>
            </div>

            {/* Countdown Badges */}
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 rounded-xl text-center">
                <span className="text-2xl font-bold font-heading block tabular-nums leading-none">
                  {nextFriday.daysRemaining}
                </span>
                <span className="text-[10px] text-slate-300">أيام متبقية للجمعة</span>
              </div>

              <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2 rounded-xl text-center">
                <span className="text-2xl font-bold font-heading block tabular-nums leading-none text-amber-300">
                  {nextFriday.vacantCount === 0 ? '100%' : `${nextFriday.totalAssigned} / ${nextFriday.totalRequired}`}
                </span>
                <span className="text-[10px] text-slate-300">
                  {nextFriday.vacantCount === 0 ? 'مكتملة التغطية ✓' : 'مكلفين'}
                </span>
              </div>
            </div>
          </div>

          {/* Search & Region Filter Bar */}
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="بحث عن مسجد أو خطيب..."
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-700 text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs">
              <span className="text-slate-500 font-medium">المنطقة:</span>
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="p-1.5 text-xs bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:outline-none"
              >
                <option value="ALL">جميع المناطق ({nextFridayAssignments.length})</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table of Upcoming Friday Assignments */}
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-right text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-10 text-center">م</th>
                  <th className="py-2.5 px-3 font-semibold">المسجد / الجامع</th>
                  <th className="py-2.5 px-3 font-semibold w-24">المنطقة</th>
                  <th className="py-2.5 px-3 font-semibold">الخطيب المكلف</th>
                  <th className="py-2.5 px-3 font-semibold w-32">هاتف الخطيب</th>
                  <th className="py-2.5 px-3 font-semibold w-28 text-center">مصدر التكليف</th>
                  <th className="py-2.5 px-3 font-semibold w-28 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد تعيينات مطابقة للمسجد أو الخطيب المحدد
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a, idx) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <ClickableMosque
                          id={a.mosqueId}
                          name={a.mosqueName}
                          code={a.mosqueCode}
                          className="font-bold text-slate-900 block font-heading text-xs"
                        />
                        <span className="text-[10px] text-slate-400 font-mono">
                          كود: {a.mosqueCode}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-medium">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                          {a.mosqueRegion}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {a.imamId ? (
                          <>
                            <ClickableImam
                              id={a.imamId}
                              name={a.imamName}
                              className="font-bold text-emerald-950 block font-heading text-xs"
                            />
                            <span className="text-[10px] text-emerald-800">مؤكد ومعتمد ✓</span>
                          </>
                        ) : (
                          <span className="text-rose-700 font-bold italic text-xs">
                            شاغر (لم يعين) ⚠️
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                        {a.imamPhone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{a.imamPhone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={
                            a.assignmentSource === 'FIXED'
                              ? 'fixed'
                              : a.assignmentSource === 'PREFERENCE'
                              ? 'preferred'
                              : 'balanced'
                          }
                          size="sm"
                        >
                          {a.assignmentSource === 'FIXED'
                            ? 'خطيب راتب'
                            : a.assignmentSource === 'PREFERENCE'
                            ? 'تفضيل مسجد'
                            : a.assignmentSource === 'BALANCED'
                            ? 'توزيع عادل'
                            : 'آلي معتمد'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleCopyAssignment(a)}
                            title="نسخ بيانات التكليف"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                          >
                            {copiedId === a.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            title="بطاقة الخطيب الذكية وتأكيد الحضور"
                            onClick={() => {
                              const m = mosques.find((item) => item.id === a.mosqueId) || ({
                                id: a.mosqueId,
                                name: a.mosqueName,
                                code: a.mosqueCode,
                                region: a.mosqueRegion,
                                phone: a.managerPhone,
                                address: '',
                                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.mosqueName)}`,
                                isActive: true,
                                capacity: 500,
                              } as Mosque);
                              const im = imams.find((item) => item.id === a.imamId) || ({
                                id: a.imamId || 1,
                                name: a.imamName,
                                type: 'FLEXIBLE',
                                minFridays: 1,
                                targetFridays: 4,
                                maxFridays: 4,
                                phone: a.imamPhone,
                                email: '',
                                tier: 'PRIMARY',
                                preferredMosqueIds: [],
                                forbiddenMosqueIds: [],
                                maxFridaysPerMonth: 4,
                                isActive: true,
                              } as unknown as Imam);
                              const fr: Friday = {
                                id: a.fridayIndex,
                                scheduleId: scheduleData?.id || 1,
                                fridayIndex: a.fridayIndex,
                                ordinalName: nextFriday?.ordinalName || 'الجمعة',
                                hijriDate: nextFriday?.hijriDate || '',
                                gregorianDate: nextFriday?.gregorianDate || '',
                                gregorianIso: '',
                                isHoliday: false,
                              };
                              const assign: Assignment = {
                                id: a.id,
                                scheduleId: scheduleData?.id || 1,
                                mosqueId: a.mosqueId,
                                imamId: a.imamId,
                                fridayIndex: a.fridayIndex,
                                source: a.assignmentSource as any,
                                isLocked: a.isLocked,
                                status: 'CONFIRMED',
                              };
                              setMobileCardData({ assignment: assign, mosque: m, imam: im, friday: fr });
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                          </button>

                          {a.imamPhone && (
                            <a
                              href={buildWhatsAppLink(
                                a.imamPhone,
                                `السلام عليكم ورحمة الله، فضيلة ${a.imamName}، تذكير بموعد تكليفكم لإلقاء خطبة الجمعة (${nextFriday.ordinalName}) في ${a.mosqueName} يوم ${nextFriday.hijriDate} (${nextFriday.gregorianDate}). جزاكم الله خيراً.`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="إرسال تذكير عبر واتساب"
                              className="p-1.5 text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              عرض {filteredAssignments.length} من أصل {nextFridayAssignments.length} مسجداً
            </span>
            <button
              onClick={() => onNavigateToTab('publishing')}
              className="text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1 text-xs cursor-pointer"
            >
              <span>الانتقال لمركز النشر والواتساب الموحد</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>
      )}

      {/* 7. Brief Fridays Table for the Month */}
      <Card variant="default" className="p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4.5 h-4.5 text-emerald-800" />
              <span>جدول جمعات شهر {period?.monthNameAr || ''} {selectedYear} هـ</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              بيان تفصيلي لجمعات الشهر ونسبة التغطية وتوزيع الخطباء لكل جمعة
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-900 font-bold rounded-lg border border-emerald-200">
              إجمالي {fridaysList.length} جمعات
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">م</th>
                <th className="py-2.5 px-3 font-heading">الجمعة</th>
                <th className="py-2.5 px-3">التاريخ الهجري</th>
                <th className="py-2.5 px-3">التاريخ الميلادي</th>
                <th className="py-2.5 px-3 text-center">التعيينات</th>
                <th className="py-2.5 px-3 text-center">حالة الوقت</th>
                <th className="py-2.5 px-3 text-center">حالة التغطية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fridaysList.map((f, idx) => (
                <tr key={f.fridayIndex} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 text-center font-bold text-slate-500 tabular-nums">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-900 font-heading">
                    {f.ordinalName}
                  </td>
                  <td className="py-3 px-3 font-bold text-slate-800 font-heading">
                    {f.hijriDate}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600">
                    {f.gregorianDate}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="font-bold text-slate-900 tabular-nums">
                      {f.assignedCount} / {f.requiredCount}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.isPast ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        <Lock className="w-3 h-3 text-slate-400" />
                        منتهية
                      </span>
                    ) : f.isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 font-bold border border-emerald-300">
                        الجمعة القادمة ⭐
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-medium border border-indigo-200">
                        مستقبلية
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {f.status === 'COMPLETED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        مكتملة 100%
                      </span>
                    ) : f.status === 'CONFLICTS' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        توجد تعارضات ({f.conflictsCount})
                      </span>
                    ) : f.assignedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-800 font-semibold">
                        شاغرة ({f.vacantCount})
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px] italic">
                        — بانتشار التوزيع
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Official Certified Decree Modal */}
      {fullScheduleForDecree && (
        <OfficialDecreeModal
          isOpen={isDecreeModalOpen}
          onClose={() => setIsDecreeModalOpen(false)}
          schedule={fullScheduleForDecree.schedule}
          fridays={fullScheduleForDecree.fridays}
          assignments={fullScheduleForDecree.assignments}
          mosques={fullScheduleForDecree.mosques}
          imams={fullScheduleForDecree.imams}
        />
      )}

      {/* Instant Preacher Mobile Portal Modal */}
      {mobileCardData && (
        <PreacherMobileCardModal
          isOpen={Boolean(mobileCardData)}
          onClose={() => setMobileCardData(null)}
          assignment={mobileCardData.assignment}
          mosque={mobileCardData.mosque}
          imam={mobileCardData.imam}
          friday={mobileCardData.friday}
          schedule={
            scheduleData ||
            ({
              id: 1,
              hijriMonth: selectedMonth,
              hijriYear: selectedYear,
              name: period?.monthNameAr,
              status: 'APPROVED',
            } as any)
          }
          onStatusUpdated={() => {
            if (onRefreshData) onRefreshData();
            loadDashboardData(selectedYear, selectedMonth);
          }}
        />
      )}
    </div>
  );
}
