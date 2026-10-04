/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, NavItem } from './components/layout/Sidebar.tsx';
import { Header } from './components/layout/Header.tsx';
import { DashboardView } from './components/dashboard/DashboardView.tsx';
import { MosquesView } from './components/mosques/MosquesView.tsx';
import { MosqueProfileModal } from './components/mosques/MosqueProfileModal.tsx';
import { ExcelImportModal } from './components/mosques/ExcelImportModal.tsx';
import { ImamsView } from './components/imams/ImamsView.tsx';
import { ImamProfileModal } from './components/imams/ImamProfileModal.tsx';
import { RulesMatrixView } from './components/rules/RulesMatrixView.tsx';
import { SchedulesListView } from './components/schedules/SchedulesListView.tsx';
import { ScheduleWizardModal } from './components/schedules/ScheduleWizardModal.tsx';
import { ScheduleReviewBoard } from './components/schedules/ScheduleReviewBoard.tsx';
import { PublishingCenterView } from './components/publishing/PublishingCenterView.tsx';
import { WhatsAppCenterView } from './components/whatsapp/WhatsAppCenterView.tsx';
import { ReportsView } from './components/reports/ReportsView.tsx';
import { AuditLogsView } from './components/audit/AuditLogsView.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { SupabaseCloudSettings } from './components/settings/SupabaseCloudSettings.tsx';
import { MosqueProfileView } from './components/profiles/MosqueProfileView.tsx';
import { ImamProfileView } from './components/profiles/ImamProfileView.tsx';
import { ProfileNavigationContext } from './context/ProfileNavigationContext.tsx';

import {
  Mosque,
  Imam,
  MosqueImamRule,
  MonthlySchedule,
  Friday,
  Assignment,
  Conflict,
  OverrideRecord,
  OrganizationSettings,
} from './types/index.ts';
import { DEFAULT_ORGANIZATION_SETTINGS, DEFAULT_SHARIA_LOGO } from './lib/defaultLogo.ts';
import { CalendarService } from './services/calendar/calendarService.ts';
import { fetchApi } from './lib/api.ts';
import initialSeed from './db/initialSeed.json';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavItem>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master Data
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [imams, setImams] = useState<Imam[]>([]);
  const [rules, setRules] = useState<MosqueImamRule[]>([]);
  const [schedules, setSchedules] = useState<MonthlySchedule[]>([]);

  // Dashboard Stats
  const [dashboardStats, setDashboardStats] = useState({
    totalMosques: 0,
    activeMosques: 0,
    totalImams: 0,
    activeImams: 0,
    totalAssignments: 0,
    totalConflicts: 0,
  });
  const [currentSchedule, setCurrentSchedule] = useState<MonthlySchedule | null>(null);
  const [upcomingSchedule, setUpcomingSchedule] = useState<MonthlySchedule | null>(null);

  // Organization Settings (Logo, Branch, Signatures)
  const [organizationSettings, setOrganizationSettings] = useState<OrganizationSettings>(() => {
    try {
      const saved = localStorage.getItem('sharia_org_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.logoUrl || parsed.logoUrl.startsWith('data:image/svg+xml')) {
          parsed.logoUrl = DEFAULT_SHARIA_LOGO;
        }
        return parsed;
      }
      return DEFAULT_ORGANIZATION_SETTINGS;
    } catch {
      return DEFAULT_ORGANIZATION_SETTINGS;
    }
  });

  useEffect(() => {
    fetchApi<OrganizationSettings>('/api/settings')
      .then((res) => {
        if (res && res.associationName) {
          if (!res.logoUrl || res.logoUrl.startsWith('data:image/svg+xml')) {
            res.logoUrl = DEFAULT_SHARIA_LOGO;
          }
          setOrganizationSettings(res);
          localStorage.setItem('sharia_org_settings', JSON.stringify(res));
        }
      })
      .catch((err) => console.warn('Using local settings:', err));
  }, []);

  const handleSaveSettings = async (newSettings: OrganizationSettings) => {
    try {
      const res = await fetchApi<{ success: boolean; settings: OrganizationSettings }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      });
      const saved = res?.settings || newSettings;
      setOrganizationSettings(saved);
      localStorage.setItem('sharia_org_settings', JSON.stringify(saved));
      setToastMessage({ text: 'تم حفظ إعدادات وهوية الجمعية بنجاح!', type: 'success' });
      setTimeout(() => setToastMessage(null), 4000);
    } catch {
      setOrganizationSettings(newSettings);
      localStorage.setItem('sharia_org_settings', JSON.stringify(newSettings));
      setToastMessage({ text: 'تم حفظ إعدادات الجمعية محلياً', type: 'success' });
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Active Schedule Details (for Review Board & Publishing)
  const [activeScheduleId, setActiveScheduleId] = useState<number | null>(null);
  const [activeScheduleData, setActiveScheduleData] = useState<{
    schedule: MonthlySchedule;
    fridays: Friday[];
    assignments: Assignment[];
    conflicts: Conflict[];
    overrides: OverrideRecord[];
  } | null>(null);

  // Modal triggers
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingMosque, setEditingMosque] = useState<Mosque | null>(null);
  const [isMosqueModalOpen, setIsMosqueModalOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [editingImam, setEditingImam] = useState<Imam | null>(null);
  const [isImamModalOpen, setIsImamModalOpen] = useState(false);

  // Full Profile Navigation State & History
  const [selectedMosqueProfileId, setSelectedMosqueProfileId] = useState<number | null>(null);
  const [selectedImamProfileId, setSelectedImamProfileId] = useState<number | null>(null);
  const [navHistory, setNavHistory] = useState<Array<{ tab: NavItem; id?: number | null }>>([]);

  const openImamProfile = (id: number) => {
    setNavHistory((prev) => [
      ...prev,
      {
        tab: currentTab,
        id: currentTab === 'imam-profile' ? selectedImamProfileId : currentTab === 'mosque-profile' ? selectedMosqueProfileId : null,
      },
    ]);
    setSelectedImamProfileId(id);
    setCurrentTab('imam-profile');
  };

  const openMosqueProfile = (id: number) => {
    setNavHistory((prev) => [
      ...prev,
      {
        tab: currentTab,
        id: currentTab === 'imam-profile' ? selectedImamProfileId : currentTab === 'mosque-profile' ? selectedMosqueProfileId : null,
      },
    ]);
    setSelectedMosqueProfileId(id);
    setCurrentTab('mosque-profile');
  };

  const navigateBack = () => {
    setNavHistory((prev) => {
      const copy = [...prev];
      const last = copy.pop();
      if (last) {
        setCurrentTab(last.tab);
        if (last.tab === 'imam-profile' && last.id) {
          setSelectedImamProfileId(last.id);
        } else if (last.tab === 'mosque-profile' && last.id) {
          setSelectedMosqueProfileId(last.id);
        }
      } else {
        setCurrentTab('dashboard');
      }
      return copy;
    });
  };

  // Fallback to embedded verified seed data
  const fallbackToSeedData = () => {
    try {
      const seedMosques = (initialSeed.mosques || []) as unknown as Mosque[];
      const seedImams = (initialSeed.imams || []) as unknown as Imam[];
      const seedRules = (initialSeed.mosqueImamRules || []) as unknown as MosqueImamRule[];
      const seedSchedules = (initialSeed.monthlySchedules || []) as unknown as MonthlySchedule[];
      const seedFridays = (initialSeed.fridays || []) as unknown as Friday[];
      const seedAssignments = (initialSeed.assignments || []) as unknown as Assignment[];

      const sortedSeedSchedules = CalendarService.sortSchedulesChronologically(seedSchedules);
      setMosques(seedMosques);
      setImams(seedImams);
      setRules(seedRules);
      setSchedules(sortedSeedSchedules);

      const activeMosquesCount = seedMosques.filter((m) => m.isActive).length;
      const activeImamsCount = seedImams.filter((i) => i.isActive).length;

      setDashboardStats({
        totalMosques: seedMosques.length,
        activeMosques: activeMosquesCount,
        totalImams: seedImams.length,
        activeImams: activeImamsCount,
        totalAssignments: seedAssignments.filter((a) => a.imamId).length,
        totalConflicts: 0,
      });

      if (sortedSeedSchedules.length > 0) {
        const sched = sortedSeedSchedules.find((s: any) => s.isCurrent || (s.hijriYear === 1448 && s.hijriMonth === 4)) || sortedSeedSchedules[0];
        setCurrentSchedule(sched);
        setActiveScheduleId(sched.id);
        setActiveScheduleData({
          schedule: sched,
          fridays: seedFridays.filter((f) => f.scheduleId === sched.id),
          assignments: seedAssignments.filter((a) => a.scheduleId === sched.id),
          conflicts: [],
          overrides: [],
        });
      }
    } catch (e) {
      console.error('Error applying seed fallback:', e);
    }
  };

  // Fetch all base data
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mosquesRes, imamsRes, rulesRes, schedulesRes, dashRes] = await Promise.all([
        fetchApi<Mosque[]>('/api/mosques'),
        fetchApi<Imam[]>('/api/imams'),
        fetchApi<MosqueImamRule[]>('/api/rules'),
        fetchApi<MonthlySchedule[]>('/api/schedules'),
        fetchApi<any>('/api/dashboard'),
      ]);

      if (Array.isArray(mosquesRes) && mosquesRes.length > 0) {
        setMosques(mosquesRes);
      } else {
        setMosques((initialSeed.mosques || []) as unknown as Mosque[]);
      }

      if (Array.isArray(imamsRes) && imamsRes.length > 0) {
        setImams(imamsRes);
      } else {
        setImams((initialSeed.imams || []) as unknown as Imam[]);
      }

      if (Array.isArray(rulesRes)) setRules(rulesRes);
      
      let resolvedSchedules: MonthlySchedule[] = [];
      if (Array.isArray(schedulesRes) && schedulesRes.length > 0) {
        resolvedSchedules = CalendarService.sortSchedulesChronologically(schedulesRes);
      } else {
        resolvedSchedules = CalendarService.sortSchedulesChronologically(
          (initialSeed.monthlySchedules || []) as unknown as MonthlySchedule[]
        );
      }
      setSchedules(resolvedSchedules);

      if (dashRes && dashRes.stats) setDashboardStats(dashRes.stats);
      
      // Default to Current Month schedule
      const currSchedule =
        resolvedSchedules.find((s: any) => s.isCurrent || s.periodStatus === 'CURRENT') ||
        dashRes?.schedule ||
        dashRes?.currentSchedule ||
        resolvedSchedules[0] ||
        null;

      if (currSchedule) {
        setCurrentSchedule(currSchedule as any);
        if (!activeScheduleId) {
          setActiveScheduleId(currSchedule.id);
        }
      }
      if (dashRes?.upcomingSchedule) setUpcomingSchedule(dashRes.upcomingSchedule);
    } catch (err: any) {
      console.warn('API load failed, activating embedded seed fallback:', err?.message || err);
      fallbackToSeedData();
    } finally {
      setLoading(false);
    }
  };

  // Load active schedule details when activeScheduleId changes
  const loadScheduleDetails = async (scheduleId: number) => {
    try {
      const res = await fetchApi<any>(`/api/schedules/${scheduleId}`);
      if (res && res.schedule) {
        setActiveScheduleData({
          schedule: res.schedule,
          fridays: res.fridays || [],
          assignments: res.assignments || [],
          conflicts: res.conflicts || [],
          overrides: res.overrides || [],
        });
        return;
      }
    } catch (err) {
      console.warn('Error fetching schedule details, checking seed data:', err);
    }
    // Fallback to seed schedule if match
    const seedSched = initialSeed.monthlySchedules?.find((s: any) => s.id === scheduleId) || initialSeed.monthlySchedules?.[0];
    if (seedSched) {
      setActiveScheduleData({
        schedule: seedSched as any,
        fridays: (initialSeed.fridays || []) as any,
        assignments: (initialSeed.assignments || []) as any,
        conflicts: [],
        overrides: [],
      });
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Safety timer: ensure loading never hangs more than 3.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('Initial load safety timeout reached, activating seed fallback');
        fallbackToSeedData();
        setLoading(false);
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (activeScheduleId) {
      loadScheduleDetails(activeScheduleId);
    }
  }, [activeScheduleId]);

  // Handle Tab Switch
  const handleTabChange = (tab: NavItem) => {
    setCurrentTab(tab);
    // If switching to review or publishing, ensure active schedule is loaded
    if ((tab === 'schedules' || tab === 'publishing') && !activeScheduleData && schedules.length > 0) {
      const targetId = currentSchedule?.id || schedules[0].id;
      setActiveScheduleId(targetId);
    }
  };

  // Navigate directly to a schedule
  const handleNavigateToSchedule = (scheduleId: number) => {
    setActiveScheduleId(scheduleId);
    setCurrentTab('schedules');
  };

  // Handlers for Add/Edit Mosque
  const handleOpenAddMosque = () => {
    setEditingMosque(null);
    setIsMosqueModalOpen(true);
  };

  const handleOpenEditMosque = (m: Mosque) => {
    setEditingMosque(m);
    setIsMosqueModalOpen(true);
  };

  // Handlers for Add/Edit Imam
  const handleOpenAddImam = () => {
    setEditingImam(null);
    setIsImamModalOpen(true);
  };

  const handleOpenEditImam = (i: Imam) => {
    setEditingImam(i);
    setIsImamModalOpen(true);
  };

  // Reset Demo Trigger
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleResetDemo = async () => {
    try {
      await fetchApi('/api/system/reset-demo', { method: 'POST' });
      await loadInitialData();
      setToastMessage({ text: 'تمت إعادة تهيئة البيانات التجريبية بنجاح!', type: 'success' });
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'تعذر إعادة التهيئة', type: 'error' });
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Compute Header Title
  const getHeaderInfo = () => {
    switch (currentTab) {
      case 'dashboard':
        return { title: 'لوحة القيادة والمؤشرات العامة', subtitle: 'نظرة شاملة على مساجد وخطباء وجداول المدينة' };
      case 'schedules':
        return activeScheduleData
          ? {
              title: `لوحة مراجعة الجدول: ${activeScheduleData.schedule.monthName} ${activeScheduleData.schedule.hijriYear} هـ`,
              subtitle: 'فحص التعيينات، القفل، وتوزيع الخطباء على الجمعات',
            }
          : { title: 'إدارة الجداول الشهرية', subtitle: 'إنشاء ومتابعة واعتماد جداول جمعات الشهور' };
      case 'mosques':
        return { title: 'إدارة المساجد والجوامع', subtitle: 'تحديد الخطباء الثابتين وقواعد التفضيل والمنع' };
      case 'imams':
        return { title: 'سجل الخطباء والدعاة', subtitle: 'إدارة الحدود (Min/Target/Max) واستثناءات عدم التوفر' };
      case 'rules':
        return { title: 'مصفوفة التفضيلات والقواعد', subtitle: 'العلاقات المباشرة بين المساجد والخطباء' };
      case 'cloud':
        return { title: 'سحابة Supabase ومزامنة البيانات', subtitle: 'إدارة قاعدة البيانات السحابية والمزامنة الحية مع خوادم PostgreSQL' };
      case 'publishing':
        return { title: 'مركز النشر والطباعة والواتساب', subtitle: 'توليد ملفات PDF وإرسال رسائل التكليف الرسمية' };
      case 'reports':
        return { title: 'التقارير الرقابية وعدالة التوزيع', subtitle: 'إحصائيات أحمال الخطباء والاستثناءات الإدارية' };
      case 'audit':
        return { title: 'سجل العمليات والتدقيق التاريخي', subtitle: 'توثيق غير قابل للحذف لجميع التعديلات والقرارات' };
      case 'settings':
        return {
          title: 'إعدادات الجمعية وهوية الشعار',
          subtitle: 'إدارة الشعار الرسمي وبيانات الفرع والمسؤولين والتوقيعات المعتمدة',
        };
      case 'imam-profile': {
        const found = imams.find((i) => i.id === selectedImamProfileId);
        return {
          title: found ? `الملف التعريفي: ${found.name}` : 'الملف التعريفي للخطيب',
          subtitle: 'سجل الجمعات والتكليفات السابقة والقادمة وإحصائيات الالتزام',
        };
      }
      case 'mosque-profile': {
        const found = mosques.find((m) => m.id === selectedMosqueProfileId);
        return {
          title: found ? `الملف التعريفي: ${found.name}` : 'الملف التعريفي للمسجد',
          subtitle: 'سجل خطب الجمعة، الخطباء المتعاقبون، والقواعد والتفضيلات المعتمدة',
        };
      }
      default:
        return { title: 'منظّم الجمعة', subtitle: '' };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <ProfileNavigationContext.Provider
      value={{
        openImamProfile,
        openMosqueProfile,
        openEditImam: handleOpenEditImam,
        openEditMosque: handleOpenEditMosque,
        navigateBack,
      }}
    >
      <div className="flex h-screen overflow-hidden bg-[#FCFBF8] dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 print:h-auto print:overflow-visible print:bg-white selection:bg-emerald-200 selection:text-emerald-900" dir="rtl" lang="ar">
        {/* Sidebar */}
        <div className="no-print">
          <Sidebar
            currentTab={currentTab}
            onTabChange={handleTabChange}
            logoUrl={organizationSettings.logoUrl}
            associationName={organizationSettings.associationName}
            branchName={organizationSettings.branchName}
          />
        </div>

        {/* Main View Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
          {/* Top Header */}
          <div className="no-print">
            <Header
              activeTitle={headerInfo.title}
              activeSubtitle={headerInfo.subtitle}
              onOpenWizard={() => setIsWizardOpen(true)}
              onResetDemo={handleResetDemo}
              onOpenSettings={() => setCurrentTab('settings')}
              onOpenCloud={() => setCurrentTab('cloud')}
            />
          </div>

        {toastMessage && (
          <div
            className={`no-print px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="underline text-[11px] cursor-pointer">
              إغلاق
            </button>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
          {error ? (
            <div className="p-8 text-center bg-white rounded-xl border border-rose-200 shadow-sm max-w-lg mx-auto my-12 space-y-3">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 font-heading">تعذر تحميل بيانات النظام</h3>
              <p className="text-xs text-rose-700">{error}</p>
              <button
                onClick={loadInitialData}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          ) : loading ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin mx-auto"></div>
              <span>جارٍ تحميل بيانات منظّم الجمعة...</span>
            </div>
          ) : (
            <>
              {/* Dashboard */}
              {currentTab === 'dashboard' && (
                <DashboardView
                  stats={dashboardStats}
                  currentSchedule={currentSchedule}
                  upcomingSchedule={upcomingSchedule}
                  mosques={mosques}
                  imams={imams}
                  onNavigateToSchedule={handleNavigateToSchedule}
                  onOpenWizard={() => setIsWizardOpen(true)}
                  onNavigateToTab={handleTabChange}
                  onRefreshData={loadInitialData}
                />
              )}

              {/* Schedules / Review Board */}
              {currentTab === 'schedules' && (
                <>
                  {activeScheduleData ? (
                    <ScheduleReviewBoard
                      schedule={activeScheduleData.schedule}
                      fridays={activeScheduleData.fridays}
                      assignments={activeScheduleData.assignments}
                      conflicts={activeScheduleData.conflicts}
                      overrides={activeScheduleData.overrides}
                      mosques={mosques}
                      imams={imams}
                      onBackToList={() => setActiveScheduleData(null)}
                      onRefreshData={() => {
                        if (activeScheduleId) loadScheduleDetails(activeScheduleId);
                        loadInitialData();
                      }}
                      onNavigateToPublishing={() => setCurrentTab('publishing')}
                    />
                  ) : (
                    <SchedulesListView
                      schedules={schedules}
                      onSelectSchedule={handleNavigateToSchedule}
                      onOpenWizard={() => setIsWizardOpen(true)}
                    />
                  )}
                </>
              )}

              {/* Mosques */}
              {currentTab === 'mosques' && (
                <MosquesView
                  mosques={mosques}
                  imams={imams}
                  onAddMosque={handleOpenAddMosque}
                  onEditMosque={handleOpenEditMosque}
                  onRefresh={loadInitialData}
                />
              )}

              {/* Imams */}
              {currentTab === 'imams' && (
                <ImamsView
                  imams={imams}
                  onAddImam={handleOpenAddImam}
                  onEditImam={handleOpenEditImam}
                  onRefresh={loadInitialData}
                  activeScheduleData={activeScheduleData}
                  mosques={mosques}
                />
              )}

              {/* Rules Matrix */}
              {currentTab === 'rules' && (
                <RulesMatrixView
                  mosques={mosques}
                  imams={imams}
                  rules={rules}
                  onRefresh={loadInitialData}
                />
              )}

              {/* Publishing & WhatsApp */}
              {currentTab === 'publishing' && activeScheduleData && (
                <div className="space-y-6">
                  <PublishingCenterView
                    schedule={activeScheduleData.schedule}
                    fridays={activeScheduleData.fridays}
                    assignments={activeScheduleData.assignments}
                    mosques={mosques}
                    imams={imams}
                    settings={organizationSettings}
                    onOpenSettings={() => setCurrentTab('settings')}
                  />

                  <div className="no-print pt-4 border-t border-slate-200">
                    <WhatsAppCenterView
                      schedule={activeScheduleData.schedule}
                      fridays={activeScheduleData.fridays}
                      assignments={activeScheduleData.assignments}
                      mosques={mosques}
                      imams={imams}
                    />
                  </div>
                </div>
              )}

              {/* Reports */}
              {currentTab === 'reports' && <ReportsView />}

              {/* Audit Trail */}
              {currentTab === 'audit' && <AuditLogsView />}

              {/* Supabase Cloud View */}
              {currentTab === 'cloud' && <SupabaseCloudSettings />}

              {/* Organization & Logo Settings */}
              {currentTab === 'settings' && (
                <SettingsView
                  settings={organizationSettings}
                  onSaveSettings={handleSaveSettings}
                  onClose={() => setCurrentTab('publishing')}
                />
              )}

              {/* Preacher / Imam Profile View */}
              {currentTab === 'imam-profile' && selectedImamProfileId && (
                <ImamProfileView
                  imamId={selectedImamProfileId}
                  onBack={navigateBack}
                  onEditImam={handleOpenEditImam}
                  onOpenMosqueProfile={openMosqueProfile}
                />
              )}

              {/* Mosque Profile View */}
              {currentTab === 'mosque-profile' && selectedMosqueProfileId && (
                <MosqueProfileView
                  mosqueId={selectedMosqueProfileId}
                  onBack={navigateBack}
                  onEditMosque={handleOpenEditMosque}
                  onOpenImamProfile={openImamProfile}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      {/* 1. Schedule Creation Wizard */}
      <ScheduleWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        mosques={mosques}
        imams={imams}
        rules={rules}
        schedules={schedules}
        onScheduleCreated={(newId) => {
          setIsWizardOpen(false);
          loadInitialData().then(() => {
            setActiveScheduleId(newId);
            loadScheduleDetails(newId);
            setCurrentTab('schedules');
          });
        }}
      />

      {/* 2. Mosque Profile Modal */}
      <MosqueProfileModal
        isOpen={isMosqueModalOpen}
        onClose={() => setIsMosqueModalOpen(false)}
        mosque={editingMosque}
        imams={imams}
        onSaved={loadInitialData}
      />

      {/* 3. Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccess={loadInitialData}
      />

      {/* 4. Imam Profile Modal */}
      <ImamProfileModal
        isOpen={isImamModalOpen}
        onClose={() => setIsImamModalOpen(false)}
        imam={editingImam}
        onSaved={loadInitialData}
      />
    </div>
    </ProfileNavigationContext.Provider>
  );
}
