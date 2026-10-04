import express, { Request, Response } from 'express';
import { db } from '../db/index.ts';
import {
  mosques,
  imams,
  mosqueImamRules,
  imamAvailabilities,
  monthlySchedules,
  fridays,
  assignments,
  conflicts,
  overrides,
  assignmentHistory,
  scheduleVersions,
  distributionLogs,
  auditLogs,
  users,
  fixedAssignmentPatterns,
  fixedAssignmentPatternItems,
  administrativeUnits,
  countries,
  importExportLogs,
  importSnapshots,
} from '../db/schema.ts';
import { eq, desc, asc, and, ilike, ne, inArray } from 'drizzle-orm';
import { SchedulingEngine } from '../services/schedulingEngine.ts';
import { seedDatabase, clearAllDatabaseData } from '../db/seed.ts';
import { optionalAuth, AuthRequest } from '../middleware/auth.ts';
import { DEFAULT_ORGANIZATION_SETTINGS } from '../lib/defaultLogo.ts';
import { OrganizationSettings } from '../types/index.ts';
import { CalendarService } from '../services/calendar/calendarService.ts';
import { EgyptAdministrativeProvider } from '../services/location/egyptLocationService.ts';
import {
  autoMapHeaders,
  matchAdministrativeHierarchy,
  normalizePhoneNumber,
  isValidEgyptianPhone,
  normalizeArabicText,
  buildExcelWorkbook,
  buildCsvWithBom,
  MOSQUE_FIELDS,
  PREACHER_FIELDS,
} from '../services/importExportService.ts';
import { ParsedImportRow, ImportPreviewResult } from '../types/importExport.ts';
import * as XLSX from 'xlsx';
import { memoryStore } from './memoryStore.ts';

const api = express.Router({ mergeParams: true });
api.use(express.json({ limit: '50mb' }));
api.use(express.urlencoded({ limit: '50mb', extended: true }));
api.use(optionalAuth);

// In-memory / persistent organization settings cache
let cachedOrganizationSettings: OrganizationSettings = {
  ...DEFAULT_ORGANIZATION_SETTINGS,
};

// Configure CalendarService defaults with organization settings (Africa/Cairo default)
CalendarService.configureDefaults(
  (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
  cachedOrganizationSettings.timezone || 'Africa/Cairo'
);

// Helper for audit logging
async function logAudit(req: AuthRequest, action: string, entityType: string, entityId?: number, details?: any) {
  try {
    await db.insert(auditLogs).values({
      userEmail: req.user?.email || 'admin@aljameya.org',
      action,
      entityType,
      entityId,
      detailsJson: details ? JSON.stringify(details) : null,
    });
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}

// -------------------------------------------------------------
// 1. Health & Dashboard & Calendar
// -------------------------------------------------------------
api.get('/health', async (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

api.get('/calendar/current', async (_req: Request, res: Response) => {
  try {
    const current = CalendarService.getCurrentDateTime();
    res.json(current);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر جلب بيانات التاريخ والوقت الحالية', details: error.message });
  }
});

api.get('/calendar/month-info', async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || 1448;
    const month = Number(req.query.month) || 9;
    const provider = (req.query.provider as any) || cachedOrganizationSettings.calendarProvider || 'UMM_AL_QURA';
    const timezone = (req.query.timezone as string) || cachedOrganizationSettings.timezone || 'Asia/Riyadh';

    const details = CalendarService.getHijriMonthDetails(year, month, { provider, timezone });
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر جلب بيانات التقويم للشهر الهجري', details: error.message });
  }
});

api.post('/calendar/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { provider, timezone } = req.body;
    if (provider || timezone) {
      CalendarService.configureDefaults(provider, timezone);
      if (provider) cachedOrganizationSettings.calendarProvider = provider;
      if (timezone) cachedOrganizationSettings.timezone = timezone;
    }
    const current = CalendarService.syncCalendar();
    cachedOrganizationSettings.lastCalendarSyncAt = current.lastSync;

    await logAudit(req, 'SYNC_CALENDAR', 'SYSTEM', undefined, { provider, timezone, lastSync: current.lastSync });
    res.json({ success: true, current });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر مزامنة التقويم', details: error.message });
  }
});

api.get('/dashboard', async (req: Request, res: Response) => {
  const currentDT = CalendarService.getCurrentDateTime();
  let hijriYear = req.query.hijriYear ? Number(req.query.hijriYear) : currentDT.hijri.year;
  let hijriMonth = req.query.hijriMonth ? Number(req.query.hijriMonth) : currentDT.hijri.month;

  if (isNaN(hijriYear) || hijriYear < 1300 || hijriYear > 1600) hijriYear = currentDT.hijri.year;
  if (isNaN(hijriMonth) || hijriMonth < 1 || hijriMonth > 12) hijriMonth = currentDT.hijri.month;

  try {

    // 1. Central Hijri Month Details from CalendarService
    const monthDetails = CalendarService.getHijriMonthDetails(hijriYear, hijriMonth);

    // 2. Fetch Mosques and Imams
    const allMosques = await db.select().from(mosques);
    const allImams = await db.select().from(imams);
    const activeMosques = allMosques.filter((m) => m.isActive);
    const activeImams = allImams.filter((i) => i.isActive);

    const mosqueMap = new Map(allMosques.map((m) => [m.id, m]));
    const imamMap = new Map(allImams.map((i) => [i.id, i]));

    // 3. Query Schedule for specified hijriYear & hijriMonth
    const matchingSchedules = await db
      .select()
      .from(monthlySchedules)
      .where(and(eq(monthlySchedules.hijriYear, hijriYear), eq(monthlySchedules.hijriMonth, hijriMonth)))
      .orderBy(desc(monthlySchedules.id));

    const schedule = matchingSchedules[0] || null;

    let scheduleAssignments: any[] = [];
    let scheduleConflicts: any[] = [];
    if (schedule) {
      scheduleAssignments = await db.select().from(assignments).where(eq(assignments.scheduleId, schedule.id));
      scheduleConflicts = await db.select().from(conflicts).where(eq(conflicts.scheduleId, schedule.id));
    }

    const totalRequiredAssignments = activeMosques.length * monthDetails.fridaysCount;
    const completedAssignments = scheduleAssignments.filter((a) => a.imamId !== null).length;
    const completionPercentage =
      totalRequiredAssignments > 0
        ? Math.min(100, Math.round((completedAssignments / totalRequiredAssignments) * 100))
        : 0;

    // 4. Detailed Friday List for Selected Month
    const fridaysWithStats = monthDetails.fridays.map((f) => {
      const fridayAssigns = scheduleAssignments.filter((a) => a.fridayIndex === f.fridayIndex);
      const assignedCount = fridayAssigns.filter((a) => a.imamId !== null).length;
      const vacantCount = Math.max(0, activeMosques.length - assignedCount);
      const fridayConflictsCount = scheduleConflicts.filter((c) => c.fridayIndex === f.fridayIndex).length;

      let status: 'COMPLETED' | 'REVIEW' | 'CONFLICTS' | 'PENDING' | 'PAST' = 'PENDING';
      if (f.isPast) {
        status = 'PAST';
      } else if (fridayConflictsCount > 0) {
        status = 'CONFLICTS';
      } else if (assignedCount === activeMosques.length && activeMosques.length > 0) {
        status = 'COMPLETED';
      } else if (assignedCount > 0) {
        status = 'REVIEW';
      }

      return {
        id: f.fridayIndex,
        fridayIndex: f.fridayIndex,
        ordinalName: f.ordinalName,
        hijriDate: f.hijriDate,
        gregorianDate: f.gregorianDate,
        isPast: f.isPast,
        isCurrent: f.periodStatus === 'CURRENT',
        isFuture: f.periodStatus === 'FUTURE',
        assignedCount,
        requiredCount: activeMosques.length,
        vacantCount,
        conflictsCount: fridayConflictsCount,
        status,
      };
    });

    // 5. Target Upcoming Friday calculation
    let targetFriday = monthDetails.fridays.find((f) => !f.isPast);
    let isAllMonthFridaysPast = false;

    if (!targetFriday) {
      isAllMonthFridaysPast = true;
      let nextM = hijriMonth + 1;
      let nextY = hijriYear;
      if (nextM > 12) {
        nextM = 1;
        nextY += 1;
      }
      const nextMonthDetails = CalendarService.getHijriMonthDetails(nextY, nextM);
      targetFriday = nextMonthDetails.fridays.find((f) => !f.isPast) || nextMonthDetails.fridays[0];
    }

    let nextFridayData: any = null;
    let nextFridayAssignments: any[] = [];

    if (targetFriday) {
      const targetFridayAssigns = scheduleAssignments.filter(
        (a) => a.fridayIndex === targetFriday!.fridayIndex
      );

      nextFridayAssignments = targetFridayAssigns.map((a) => {
        const m = mosqueMap.get(a.mosqueId);
        const i = a.imamId ? imamMap.get(a.imamId) : null;
        return {
          id: a.id,
          fridayIndex: a.fridayIndex,
          mosqueId: a.mosqueId,
          mosqueName: m?.name || 'مسجد غير معروف',
          mosqueCode: m?.code || '',
          mosqueRegion: m?.region || '',
          managerPhone: m?.phone || '',
          imamId: a.imamId,
          imamName: i?.name || 'شاغر (لم يعين)',
          imamPhone: i?.phone || '',
          isLocked: a.isLocked,
          assignmentSource: a.source,
        };
      });

      const vacantCount = Math.max(
        0,
        activeMosques.length - nextFridayAssignments.filter((a) => a.imamId).length
      );

      // Compute days remaining
      const targetDate = new Date(targetFriday.gregorianIso);
      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

      nextFridayData = {
        fridayIndex: targetFriday.fridayIndex,
        ordinalName: targetFriday.ordinalName,
        hijriDate: targetFriday.hijriDate,
        gregorianDate: targetFriday.gregorianDate,
        monthName: monthDetails.monthName,
        hijriYear,
        daysRemaining,
        totalRequired: activeMosques.length,
        totalAssigned: nextFridayAssignments.filter((a) => a.imamId).length,
        vacantCount,
        isAllMonthFridaysPast,
      };
    }

    // 6. Dynamic Alerts
    const alerts: any[] = [];
    if (!schedule) {
      alerts.push({
        id: 'alert-no-schedule',
        type: 'DEADLINE',
        severity: 'WARNING',
        title: `لم يتم إنشاء جدول لشهر ${monthDetails.monthName} ${hijriYear} هـ حتى الآن`,
        description: `يمكنك بدء التوليد والإنشاء الآلي لجدول ${monthDetails.monthName} لضمان التغطية المبكرة.`,
        actionLabel: 'إنشاء جدول الشهر',
        actionTab: 'schedules',
        timestamp: new Date().toISOString(),
      });
    } else if (schedule.status === 'DRAFT' || schedule.status === 'GENERATED') {
      alerts.push({
        id: 'alert-draft-schedule',
        type: 'DEADLINE',
        severity: 'INFO',
        title: `جدول شهر ${monthDetails.monthName} في مرحلة المسودة`,
        description: `جدول ${monthDetails.monthName} محفوض كمسودة ويتطلب مراجعة التوزيع واعتماده نهائياً.`,
        actionLabel: 'متابعة إعداد الجدول',
        actionTab: 'schedules',
        actionScheduleId: schedule.id,
        timestamp: new Date().toISOString(),
      });
    } else if (scheduleConflicts.length > 0) {
      alerts.push({
        id: 'alert-conflicts-schedule',
        type: 'CONFLICT',
        severity: 'CRITICAL',
        title: `تنبيه: يوجد ${scheduleConflicts.length} تعارضات في جدول شهر ${monthDetails.monthName}`,
        description: `يرجى حل تعارضات التعيين وإعادة تخصيص الخطباء في الجمع الشاغرة.`,
        actionLabel: 'فتح المراجعة وحل التعارضات',
        actionTab: 'schedules',
        actionScheduleId: schedule.id,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      period: {
        hijriYear,
        hijriMonth,
        monthNameAr: monthDetails.monthName,
        status: monthDetails.periodStatus,
        statusLabelArabic: monthDetails.statusLabelArabic,
        isPast: monthDetails.isPast,
        isCurrent: monthDetails.isCurrent,
        isFuture: monthDetails.isFuture,
        startDateHijri: `1 ${monthDetails.monthName} ${hijriYear} هـ`,
        endDateHijri: `${monthDetails.daysCount} ${monthDetails.monthName} ${hijriYear} هـ`,
        startDateGregorian: monthDetails.startDateGregorian,
        endDateGregorian: monthDetails.endDateGregorian,
        fridaysCount: monthDetails.fridaysCount,
        pastFridaysCount: monthDetails.pastFridaysCount,
        futureFridaysCount: monthDetails.futureFridaysCount,
      },
      stats: {
        totalMosques: allMosques.length,
        activeMosques: activeMosques.length,
        totalImams: allImams.length,
        activeImams: activeImams.length,
        totalAssignments: completedAssignments,
        totalRequiredAssignments,
        completedAssignments,
        completionPercentage,
        totalConflicts: scheduleConflicts.length,
      },
      schedule: schedule
        ? {
            id: schedule.id,
            monthName: schedule.monthName,
            hijriYear: schedule.hijriYear,
            hijriMonth: schedule.hijriMonth,
            status: schedule.status,
            currentVersion: schedule.currentVersion,
            updatedAt: schedule.updatedAt,
            publishedAt: schedule.publishedAt,
          }
        : null,
      fridays: fridaysWithStats,
      nextFriday: nextFridayData,
      nextFridayAssignments,
      alerts,
      liveDateTime: currentDT,
    });
  } catch (error: any) {
    console.warn('DB fetch for dashboard failed, falling back to memory store:', error?.message);
    const fallbackData = memoryStore.getDashboard(hijriYear, hijriMonth);
    res.json(fallbackData);
  }
});

api.get('/dashboard/alerts', async (req: Request, res: Response) => {
  try {
    const currentDT = CalendarService.getCurrentDateTime();
    let hijriYear = req.query.hijriYear ? Number(req.query.hijriYear) : currentDT.hijri.year;
    let hijriMonth = req.query.hijriMonth ? Number(req.query.hijriMonth) : currentDT.hijri.month;

    if (isNaN(hijriYear)) hijriYear = currentDT.hijri.year;
    if (isNaN(hijriMonth)) hijriMonth = currentDT.hijri.month;

    const allMosques = await db.select().from(mosques);
    const allImams = await db.select().from(imams);
    const mosqueMap = new Map(allMosques.map((m) => [m.id, m]));
    const imamMap = new Map(allImams.map((i) => [i.id, i]));

    const matchingSchedules = await db
      .select()
      .from(monthlySchedules)
      .where(and(eq(monthlySchedules.hijriYear, hijriYear), eq(monthlySchedules.hijriMonth, hijriMonth)))
      .orderBy(desc(monthlySchedules.id));

    const currentSchedule = matchingSchedules[0] || null;

    let nextFridayData: any = null;
    let nextFridayAssignments: any[] = [];
    const alerts: any[] = [];

    if (currentSchedule) {
      const scheduleFridays = await db
        .select()
        .from(fridays)
        .where(eq(fridays.scheduleId, currentSchedule.id))
        .orderBy(asc(fridays.fridayIndex));
      const scheduleAssignments = await db
        .select()
        .from(assignments)
        .where(eq(assignments.scheduleId, currentSchedule.id));

      if (scheduleFridays.length > 0) {
        const targetFriday = scheduleFridays[0];
        const fridayAssigns = scheduleAssignments.filter((a) => a.fridayIndex === targetFriday.fridayIndex);

        nextFridayAssignments = fridayAssigns.map((a) => {
          const m = mosqueMap.get(a.mosqueId);
          const i = a.imamId ? imamMap.get(a.imamId) : null;
          return {
            id: a.id,
            fridayIndex: a.fridayIndex,
            mosqueId: a.mosqueId,
            mosqueName: m?.name || 'مسجد غير معروف',
            mosqueCode: m?.code || '',
            mosqueRegion: m?.region || '',
            managerPhone: m?.phone || '',
            imamId: a.imamId,
            imamName: i?.name || 'شاغر (لم يعين)',
            imamPhone: i?.phone || '',
            isLocked: a.isLocked,
            assignmentSource: a.source,
          };
        });

        const vacantCount = nextFridayAssignments.filter((a) => !a.imamId).length;

        nextFridayData = {
          fridayIndex: targetFriday.fridayIndex,
          hijriDate: targetFriday.hijriDate,
          gregorianDate: targetFriday.gregorianDate,
          monthName: currentSchedule.monthName,
          hijriYear: currentSchedule.hijriYear,
          daysRemaining: 4,
          totalRequired: allMosques.filter((m) => m.isActive).length,
          totalAssigned: nextFridayAssignments.filter((a) => a.imamId).length,
          vacantCount,
        };

        alerts.push({
          id: 'alert-upcoming-friday',
          type: 'UPCOMING_FRIDAY',
          severity: vacantCount > 0 ? 'CRITICAL' : 'INFO',
          title: `تكليفات الجمعة القادمة (${targetFriday.fridayIndex}) - ${targetFriday.hijriDate}`,
          description:
            vacantCount > 0
              ? `يوجد ${vacantCount} مساجد شاغرة بدون خطيب في الجمعة القادمة بحاجة لتعيين عاجل!`
              : `تم اكتمال تكليف وتوزيع الخطباء على جميع مساجد المدينة (${nextFridayAssignments.length} مسجداً) بنجاح.`,
          dueDate: targetFriday.gregorianDate,
          daysRemaining: 4,
          relatedEntityType: 'SCHEDULE',
          relatedEntityId: currentSchedule.id,
          actionLabel: 'عرض تكليفات الجمعة',
          actionTab: 'schedules',
          actionScheduleId: currentSchedule.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({
      nextFriday: nextFridayData,
      nextFridayAssignments,
      alerts,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard alerts:', error);
    res.status(500).json({ error: 'تعذر جلب التنبيهات', details: error.message });
  }
});

// -------------------------------------------------------------
// 1.5. Egyptian Hierarchical Location Endpoints (CAPMAS Grounded)
// -------------------------------------------------------------
api.get('/locations/countries', async (_req: Request, res: Response) => {
  try {
    const countriesList = EgyptAdministrativeProvider.getCountries();
    res.json(countriesList);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب قائمة الدول', details: err.message });
  }
});

api.get('/locations/governorates', async (req: Request, res: Response) => {
  try {
    const countryId = Number(req.query.countryId) || 1;
    const governorates = EgyptAdministrativeProvider.getGovernorates(countryId);
    res.json(governorates);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب قائمة المحافظات المصرية', details: err.message });
  }
});

api.get('/locations/units', async (req: Request, res: Response) => {
  try {
    const parentId = Number(req.query.parentId);
    if (!parentId) {
      return res.status(400).json({ error: 'معرف المستوى الأب (parentId) مطلوب' });
    }
    const units = EgyptAdministrativeProvider.getUnitsByParent(parentId);
    res.json(units);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب الوحدات الإدارية التابعة', details: err.message });
  }
});

api.get('/locations/hierarchy/:id', async (req: Request, res: Response) => {
  try {
    const unitId = Number(req.params.id);
    const path = EgyptAdministrativeProvider.getHierarchyPath(unitId);
    res.json(path);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب التسلسل الهرمي للعنوان', details: err.message });
  }
});

api.get('/locations/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || '';
    const results = EgyptAdministrativeProvider.searchUnits(q, 25);
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر البحث في التقسيمات الإدارية', details: err.message });
  }
});

api.post('/locations/validate', async (req: Request, res: Response) => {
  try {
    const { governorateId, districtId, areaId } = req.body;
    const validation = EgyptAdministrativeProvider.validateHierarchy(
      Number(governorateId),
      districtId ? Number(districtId) : null,
      areaId ? Number(areaId) : null
    );
    res.json(validation);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر التحقق من صحة التسلسل الإداري', details: err.message });
  }
});

api.get('/locations/default', async (_req: Request, res: Response) => {
  try {
    const defaultLoc = EgyptAdministrativeProvider.getDefaultAssociationLocation();
    res.json(defaultLoc);
  } catch (err: any) {
    res.status(500).json({ error: 'تعذر جلب الموقع الافتراضي للجمعية', details: err.message });
  }
});

// Settings Endpoints
api.get('/settings', async (_req: Request, res: Response) => {
  res.json(cachedOrganizationSettings);
});

api.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const updatedData = req.body;

    // If Egyptian address components are provided, generate structured display address
    if (updatedData.governorateId) {
      const formattedAddress = EgyptAdministrativeProvider.formatStructuredAddress({
        countryId: updatedData.countryId || 1,
        governorateId: Number(updatedData.governorateId),
        districtId: updatedData.districtId ? Number(updatedData.districtId) : null,
        areaId: updatedData.areaId ? Number(updatedData.areaId) : null,
        street: updatedData.street,
        buildingNumber: updatedData.buildingNumber,
        landmark: updatedData.landmark,
      });
      updatedData.formattedAddress = formattedAddress;
      updatedData.address = formattedAddress;
    }

    cachedOrganizationSettings = {
      ...cachedOrganizationSettings,
      ...updatedData,
    };

    if (cachedOrganizationSettings.calendarProvider || cachedOrganizationSettings.timezone) {
      CalendarService.configureDefaults(
        (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
        cachedOrganizationSettings.timezone || 'Africa/Cairo'
      );
    }

    await logAudit(req, 'UPDATE_SETTINGS', 'SETTINGS', 1, {
      associationName: cachedOrganizationSettings.associationName,
      branchName: cachedOrganizationSettings.branchName,
      formattedAddress: cachedOrganizationSettings.formattedAddress,
    });
    res.json({ success: true, settings: cachedOrganizationSettings });
  } catch (err: any) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'تعذر حفظ الإعدادات', details: err.message });
  }
});

// -------------------------------------------------------------
// 2. Mosques Endpoints
// -------------------------------------------------------------
api.get('/mosques', async (req: Request, res: Response) => {
  const search = (req.query.search as string) || '';
  const region = (req.query.region as string) || '';

  try {
    const list = await db.select().from(mosques).orderBy(asc(mosques.id));
    const allImams = await db.select().from(imams);
    const imamMap = new Map(allImams.map((i) => [i.id, i.name]));
    const allRules = await db.select().from(mosqueImamRules);

    let filtered = list;
    if (search) {
      filtered = filtered.filter(
        (m) =>
          m.name.includes(search) ||
          m.code.toLowerCase().includes(search.toLowerCase()) ||
          (m.region && m.region.includes(search))
      );
    }
    if (region && region !== 'ALL') {
      filtered = filtered.filter((m) => m.region === region);
    }

    const enhanced = filtered.map((m) => {
      const rulesForMosque = allRules.filter((r) => r.mosqueId === m.id);
      return {
        ...m,
        fixedImamName: m.fixedImamId ? imamMap.get(m.fixedImamId) || 'غير محدد' : null,
        preferencesCount: rulesForMosque.filter((r) => r.relationshipType === 'PREFERRED').length,
        forbiddenCount: rulesForMosque.filter((r) => r.relationshipType === 'FORBIDDEN').length,
      };
    });

    res.json(enhanced);
  } catch (error: any) {
    console.warn('DB fetch for mosques failed, falling back to memory store:', error?.message);
    const fallback = memoryStore.getMosques(search, region);
    res.json(fallback);
  }
});

api.get('/mosques/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const found = await db.select().from(mosques).where(eq(mosques.id, id)).limit(1);
    if (!found[0]) {
      const fallbackFound = memoryStore.getMosqueDetails(id);
      if (fallbackFound) return res.json(fallbackFound);
      return res.status(404).json({ error: 'المسجد غير موجود' });
    }

    const rules = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.mosqueId, id)).orderBy(asc(mosqueImamRules.priority));
    const allImams = await db.select().from(imams);
    const imamMap = new Map(allImams.map((i) => [i.id, i]));

    const enrichedRules = rules.map((r) => ({
      ...r,
      imam: imamMap.get(r.imamId),
    }));

    res.json({
      ...found[0],
      rules: enrichedRules,
    });
  } catch (error: any) {
    console.warn('DB fetch for mosque details failed, falling back to memory store:', error?.message);
    const fallbackFound = memoryStore.getMosqueDetails(Number(req.params.id));
    if (fallbackFound) return res.json(fallbackFound);
    res.status(500).json({ error: 'تعذر جلب تفاصيل المسجد', details: error.message });
  }
});

// Full Mosque Profile Endpoint
api.get('/mosques/:id/profile', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const found = await db.select().from(mosques).where(eq(mosques.id, id)).limit(1);
    if (!found[0]) return res.status(404).json({ error: 'المسجد غير موجود' });
    const mosque = found[0];

    let fixedImam = null;
    if (mosque.fixedImamId) {
      const fixedFound = await db.select().from(imams).where(eq(imams.id, mosque.fixedImamId)).limit(1);
      fixedImam = fixedFound[0] || null;
    }

    // All assignments for this mosque
    const allAssignments = await db.select().from(assignments).where(eq(assignments.mosqueId, id));
    const allFridays = await db.select().from(fridays);
    const fridayMap = new Map(allFridays.map((f) => [f.id, f]));
    const allSchedules = await db.select().from(monthlySchedules).orderBy(desc(monthlySchedules.id));
    const scheduleMap = new Map(allSchedules.map((s) => [s.id, s]));
    const allImams = await db.select().from(imams);
    const imamMap = new Map(allImams.map((i) => [i.id, i]));

    // Determine target schedule (from query or active approved/published/latest)
    const requestedScheduleId = req.query.scheduleId ? Number(req.query.scheduleId) : undefined;
    const activeSchedule =
      (requestedScheduleId ? allSchedules.find((s) => s.id === requestedScheduleId) : null) ||
      allSchedules.find((s) => s.status === 'APPROVED' || s.status === 'PUBLISHED') ||
      allSchedules.find((s) => s.status === 'REVIEW' || s.status === 'DRAFT') ||
      allSchedules[0] ||
      null;

    const profileAssignments = allAssignments.map((a) => {
      const f = fridayMap.get(a.fridayId);
      const s = scheduleMap.get(a.scheduleId);
      const im = a.imamId ? imamMap.get(a.imamId) : null;
      const isUpcoming = activeSchedule ? a.scheduleId === activeSchedule.id : s?.status !== 'ARCHIVED';

      return {
        id: a.id,
        scheduleId: a.scheduleId,
        fridayId: a.fridayId,
        fridayIndex: a.fridayIndex,
        hijriDate: f?.hijriDate || `جمعة ${a.fridayIndex}`,
        gregorianDate: f?.gregorianDate || undefined,
        monthName: s?.monthName || 'غير محدد',
        hijriYear: s?.hijriYear || 1448,
        scheduleStatus: s?.status || 'APPROVED',
        mosqueId: mosque.id,
        mosqueName: mosque.name,
        mosqueCode: mosque.code,
        mosqueRegion: mosque.region,
        imamId: a.imamId,
        imamName: im?.name,
        imamType: im?.type,
        imamPhone: im?.phone || undefined,
        isLocked: a.isLocked,
        source: a.source,
        isUpcoming,
      };
    }).sort((x, y) => {
      if (x.scheduleId !== y.scheduleId) return y.scheduleId - x.scheduleId;
      return x.fridayIndex - y.fridayIndex;
    });

    // Upcoming assignments strictly for the targeted monthly schedule
    const upcomingAssignments = activeSchedule
      ? profileAssignments
          .filter((a) => a.scheduleId === activeSchedule.id)
          .sort((x, y) => x.fridayIndex - y.fridayIndex)
      : profileAssignments.filter((a) => a.isUpcoming);

    // Rules
    const allRules = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.mosqueId, id));
    const rulesGrouped = {
      preferred: allRules.filter((r) => r.relationshipType === 'PREFERRED').map((r) => ({ ...r, imamName: imamMap.get(r.imamId)?.name, imamType: imamMap.get(r.imamId)?.type })),
      allowed: allRules.filter((r) => r.relationshipType === 'ALLOWED').map((r) => ({ ...r, imamName: imamMap.get(r.imamId)?.name, imamType: imamMap.get(r.imamId)?.type })),
      discouraged: allRules.filter((r) => r.relationshipType === 'DISCOURAGED').map((r) => ({ ...r, imamName: imamMap.get(r.imamId)?.name, imamType: imamMap.get(r.imamId)?.type })),
      forbidden: allRules.filter((r) => r.relationshipType === 'FORBIDDEN').map((r) => ({ ...r, imamName: imamMap.get(r.imamId)?.name, imamType: imamMap.get(r.imamId)?.type })),
      fixed: allRules.filter((r) => r.relationshipType === 'FIXED').map((r) => ({ ...r, imamName: imamMap.get(r.imamId)?.name, imamType: imamMap.get(r.imamId)?.type })),
    };

    // Linked imams aggregation
    const imamCounts = new Map<number, { count: number; lastDate?: string; nextDate?: string }>();
    for (const a of profileAssignments) {
      if (a.imamId) {
        const curr = imamCounts.get(a.imamId) || { count: 0 };
        curr.count += 1;
        if (a.isUpcoming && !curr.nextDate) curr.nextDate = a.hijriDate;
        if (!a.isUpcoming && !curr.lastDate) curr.lastDate = a.hijriDate;
        imamCounts.set(a.imamId, curr);
      }
    }

    const linkedImams = Array.from(imamCounts.entries()).map(([imId, data]) => {
      const im = imamMap.get(imId);
      const rule = allRules.find((r) => r.imamId === imId);
      return {
        imamId: imId,
        imamName: im?.name || `خطيب #${imId}`,
        imamType: im?.type || 'FLEXIBLE',
        imamPhone: im?.phone || undefined,
        relationshipType: rule?.relationshipType || (mosque.fixedImamId === imId ? 'FIXED' : undefined),
        assignedCount: data.count,
        lastDate: data.lastDate,
        nextDate: data.nextDate,
      };
    }).sort((x, y) => y.assignedCount - x.assignedCount);

    // Audit logs
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entityType, 'MOSQUE'), eq(auditLogs.entityId, id))).orderBy(desc(auditLogs.id)).limit(20);

    const stats = {
      totalAssigned: profileAssignments.length,
      currentMonthCount: upcomingAssignments.length,
      imamsCount: linkedImams.length,
      upcomingCount: upcomingAssignments.length,
      currentScheduleFridaysTotal: activeSchedule?.fridaysCount || 5,
      currentMonthName: activeSchedule?.monthName || '',
      currentHijriYear: activeSchedule?.hijriYear || 1448,
    };

    res.json({
      mosque,
      fixedImam,
      activeSchedule,
      availableSchedules: allSchedules.map((s) => ({
        id: s.id,
        monthName: s.monthName,
        hijriYear: s.hijriYear,
        fridaysCount: s.fridaysCount,
        status: s.status,
      })),
      stats,
      assignments: profileAssignments,
      upcomingAssignments,
      linkedImams,
      rules: rulesGrouped,
      auditLogs: logs,
    });
  } catch (error: any) {
    console.warn('DB fetch for mosque profile failed, falling back to memory store:', error?.message);
    const fallback = memoryStore.getMosqueProfile(Number(req.params.id), req.query.scheduleId ? Number(req.query.scheduleId) : undefined);
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: 'تعذر جلب الملف التعريفي للمسجد', details: error.message });
  }
});

api.post('/mosques', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      code,
      region,
      address,
      countryId,
      governorateId,
      districtId,
      areaId,
      street,
      buildingNumber,
      landmark,
      latitude,
      longitude,
      managerName,
      phone,
      whatsapp,
      fixedImamId,
      fixedPattern,
      fixedCount,
      notes,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'الاسم والكود حقول مطلوبة' });
    }

    let finalFormatted = address;
    let finalRegion = region;

    if (governorateId) {
      finalFormatted = EgyptAdministrativeProvider.formatStructuredAddress({
        countryId: countryId || 1,
        governorateId: Number(governorateId),
        districtId: districtId ? Number(districtId) : null,
        areaId: areaId ? Number(areaId) : null,
        street,
        buildingNumber,
        landmark,
      });

      // Derive region name if not specified
      if (!finalRegion || finalRegion === 'الوسط') {
        if (areaId) {
          const a = EgyptAdministrativeProvider.getUnitById(Number(areaId));
          if (a) finalRegion = a.nameAr;
        } else if (districtId) {
          const d = EgyptAdministrativeProvider.getUnitById(Number(districtId));
          if (d) finalRegion = d.nameAr;
        }
      }
    }

    const [created] = await db.insert(mosques).values({
      name,
      code,
      region: finalRegion || 'منشأة البكاري',
      address: finalFormatted || address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
      countryId: countryId ? Number(countryId) : 1,
      governorateId: governorateId ? Number(governorateId) : 1,
      districtId: districtId ? Number(districtId) : 101,
      areaId: areaId ? Number(areaId) : 1001,
      street: street || null,
      buildingNumber: buildingNumber || null,
      landmark: landmark || null,
      formattedAddress: finalFormatted || address || null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      managerName,
      phone,
      whatsapp,
      fixedImamId: fixedImamId ? Number(fixedImamId) : null,
      fixedPattern: fixedPattern || 'ALL',
      fixedCount: fixedCount ? Number(fixedCount) : 0,
      notes,
    }).returning();

    await logAudit(req, 'CREATE_MOSQUE', 'MOSQUE', created.id, { name, code });
    res.status(201).json(created);
  } catch (error: any) {
    console.warn('DB create mosque failed, falling back to memoryStore:', error?.message);
    try {
      const created = memoryStore.createMosque(req.body);
      return res.status(201).json(created);
    } catch (fbErr) {
      console.error('Fallback createMosque failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر إنشاء المسجد', details: error.message });
  }
});

api.patch('/mosques/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = req.body;

    if (data.governorateId) {
      const finalFormatted = EgyptAdministrativeProvider.formatStructuredAddress({
        countryId: data.countryId || 1,
        governorateId: Number(data.governorateId),
        districtId: data.districtId ? Number(data.districtId) : null,
        areaId: data.areaId ? Number(data.areaId) : null,
        street: data.street,
        buildingNumber: data.buildingNumber,
        landmark: data.landmark,
      });
      data.formattedAddress = finalFormatted;
      data.address = finalFormatted;

      if (!data.region || data.region === 'الوسط') {
        if (data.areaId) {
          const a = EgyptAdministrativeProvider.getUnitById(Number(data.areaId));
          if (a) data.region = a.nameAr;
        } else if (data.districtId) {
          const d = EgyptAdministrativeProvider.getUnitById(Number(data.districtId));
          if (d) data.region = d.nameAr;
        }
      }
    }

    const [updated] = await db.update(mosques)
      .set({
        ...data,
        countryId: data.countryId !== undefined ? (data.countryId ? Number(data.countryId) : 1) : undefined,
        governorateId: data.governorateId !== undefined ? (data.governorateId ? Number(data.governorateId) : null) : undefined,
        districtId: data.districtId !== undefined ? (data.districtId ? Number(data.districtId) : null) : undefined,
        areaId: data.areaId !== undefined ? (data.areaId ? Number(data.areaId) : null) : undefined,
        fixedImamId: data.fixedImamId !== undefined ? (data.fixedImamId ? Number(data.fixedImamId) : null) : undefined,
        fixedCount: data.fixedCount !== undefined ? Number(data.fixedCount) : undefined,
      })
      .where(eq(mosques.id, id))
      .returning();

    await logAudit(req, 'UPDATE_MOSQUE', 'MOSQUE', id, data);
    res.json(updated);
  } catch (error: any) {
    console.warn('DB patch mosque failed, falling back to memoryStore:', error?.message);
    try {
      const updated = memoryStore.updateMosque(Number(req.params.id), req.body);
      if (updated) return res.json(updated);
    } catch (fbErr) {
      console.error('Fallback updateMosque failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر تحديث بيانات المسجد', details: error.message });
  }
});

api.delete('/mosques/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(mosques).where(eq(mosques.id, id));
    await logAudit(req, 'DELETE_MOSQUE', 'MOSQUE', id);
    res.json({ success: true });
  } catch (error: any) {
    console.warn('DB delete mosque failed, falling back to memoryStore:', error?.message);
    memoryStore.deleteMosque(Number(req.params.id));
    return res.json({ success: true });
  }
});

api.post('/mosques/bulk-delete', async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد المساجد المراد حذفها' });
    }
    const numIds = ids.map(Number).filter((n) => !isNaN(n));
    await db.delete(mosques).where(inArray(mosques.id, numIds));
    await logAudit(req, 'BULK_DELETE_MOSQUES', 'MOSQUE', 0, { deletedCount: numIds.length });
    res.json({ success: true, count: numIds.length });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حذف المساجد المحددة', details: error.message });
  }
});

api.post('/mosques/:id/rules', async (req: AuthRequest, res: Response) => {
  try {
    const mosqueId = Number(req.params.id);
    const { imamId, relationshipType, priority, notes } = req.body;
    if (!imamId || !relationshipType) {
      return res.status(400).json({ error: 'الخطيب ونوع العلاقة مطلوبان' });
    }

    // Check if rule already exists for this pair
    const existing = await db.select().from(mosqueImamRules).where(
      and(eq(mosqueImamRules.mosqueId, mosqueId), eq(mosqueImamRules.imamId, Number(imamId)))
    );

    let saved;
    if (existing[0]) {
      [saved] = await db.update(mosqueImamRules)
        .set({
          relationshipType,
          priority: priority ? Number(priority) : 1,
          notes,
        })
        .where(eq(mosqueImamRules.id, existing[0].id))
        .returning();
    } else {
      [saved] = await db.insert(mosqueImamRules).values({
        mosqueId,
        imamId: Number(imamId),
        relationshipType,
        priority: priority ? Number(priority) : 1,
        notes,
      }).returning();
    }

    await logAudit(req, 'UPDATE_MOSQUE_RULE', 'MOSQUE_RULE', saved.id, { mosqueId, imamId, relationshipType });
    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حفظ قاعدة المسجد', details: error.message });
  }
});

api.delete('/mosques/:id/rules/:ruleId', async (req: AuthRequest, res: Response) => {
  try {
    const ruleId = Number(req.params.ruleId);
    await db.delete(mosqueImamRules).where(eq(mosqueImamRules.id, ruleId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حذف القاعدة', details: error.message });
  }
});

// -------------------------------------------------------------
// 2.4. Monthly Fixed Assignment Patterns per Mosque (Friday-Specific)
// -------------------------------------------------------------
api.get('/mosques/:id/fixed-patterns', async (req: Request, res: Response) => {
  try {
    const mosqueId = Number(req.params.id);
    const year = req.query.year ? Number(req.query.year) : 1448;
    const month = req.query.month ? Number(req.query.month) : 9;

    const [mosque] = await db.select().from(mosques).where(eq(mosques.id, mosqueId));
    if (!mosque) return res.status(404).json({ error: 'المسجد غير موجود' });

    const monthDetails = CalendarService.getHijriMonthDetails(year, month);
    const actualFridaysCount = monthDetails.fridaysCount;

    const foundPatterns = await db.select().from(fixedAssignmentPatterns).where(
      and(
        eq(fixedAssignmentPatterns.mosqueId, mosqueId),
        eq(fixedAssignmentPatterns.hijriYear, year),
        eq(fixedAssignmentPatterns.hijriMonth, month)
      )
    );

    const allImams = await db.select().from(imams);
    const imamMap = new Map(allImams.map((i) => [i.id, i]));

    if (foundPatterns.length === 0) {
      // Return default pattern preview based on legacy or blank
      return res.json({
        exists: false,
        pattern: null,
        monthDetails,
        availableImams: allImams.filter((i) => i.isActive),
      });
    }

    const pattern = foundPatterns[0];
    const items = await db.select().from(fixedAssignmentPatternItems).where(
      eq(fixedAssignmentPatternItems.patternId, pattern.id)
    ).orderBy(asc(fixedAssignmentPatternItems.fridayIndex));

    const enrichedItems = items.map((item) => {
      const im = imamMap.get(item.imamId);
      const fridayObj = monthDetails.fridays.find((f) => f.fridayIndex === item.fridayIndex);
      return {
        ...item,
        imamName: im?.name || `خطيب #${item.imamId}`,
        imamPhone: im?.phone || null,
        hijriDate: fridayObj?.hijriDate,
        gregorianDate: fridayObj?.gregorianDate,
      };
    });

    res.json({
      exists: true,
      pattern: {
        ...pattern,
        fridaysCount: actualFridaysCount,
        items: enrichedItems,
      },
      monthDetails,
      availableImams: allImams.filter((i) => i.isActive),
    });
  } catch (error: any) {
    console.warn('DB fetch for fixed patterns failed, falling back to memory store:', error?.message);
    const mId = Number(req.params.id);
    const yr = req.query.year ? Number(req.query.year) : 1448;
    const mo = req.query.month ? Number(req.query.month) : 4;
    const fallback = memoryStore.getFixedPatterns(mId, yr, mo);
    const monthDetails = CalendarService.getHijriMonthDetails(yr, mo);
    res.json({
      ...fallback,
      monthDetails,
      availableImams: memoryStore.getImams().filter((i: any) => i.isActive),
    });
  }
});

api.post('/mosques/:id/fixed-patterns', async (req: AuthRequest, res: Response) => {
  try {
    const mosqueId = Number(req.params.id);
    const { hijriYear, hijriMonth, patternType, fridaysCount, items, notes, applyToFullYear } = req.body;

    if (!hijriYear || (!hijriMonth && !applyToFullYear) || !patternType || !Array.isArray(items)) {
      return res.status(400).json({ error: 'السنة الهجرية والشهر ونوع النمط وقائمة الجمعات مطلوبة' });
    }

    const hYear = Number(hijriYear);
    const targetMonths = applyToFullYear ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [Number(hijriMonth)];

    const [mosque] = await db.select().from(mosques).where(eq(mosques.id, mosqueId));
    if (!mosque) return res.status(404).json({ error: 'المسجد غير موجود' });

    let lastPatternId: number = 0;

    for (const hMonth of targetMonths) {
      let mFridaysCount = Number(fridaysCount) || 5;
      try {
        const details = CalendarService.getHijriMonthDetails(hYear, hMonth);
        if (details && details.fridaysCount) {
          mFridaysCount = details.fridaysCount;
        }
      } catch {
        // fallback
      }

      // Check if pattern exists for this mosque and month
      const existing = await db.select().from(fixedAssignmentPatterns).where(
        and(
          eq(fixedAssignmentPatterns.mosqueId, mosqueId),
          eq(fixedAssignmentPatterns.hijriYear, hYear),
          eq(fixedAssignmentPatterns.hijriMonth, hMonth)
        )
      );

      let patternId: number;

      if (existing.length > 0) {
        patternId = existing[0].id;
        await db.update(fixedAssignmentPatterns)
          .set({
            patternType,
            fridaysCount: mFridaysCount,
            isActive: true,
            notes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(fixedAssignmentPatterns.id, patternId));

        // Remove existing items to replace with updated ones
        await db.delete(fixedAssignmentPatternItems).where(
          eq(fixedAssignmentPatternItems.patternId, patternId)
        );
      } else {
        const [inserted] = await db.insert(fixedAssignmentPatterns).values({
          mosqueId,
          hijriYear: hYear,
          hijriMonth: hMonth,
          patternType,
          fridaysCount: mFridaysCount,
          isActive: true,
          notes: notes || null,
        }).returning();
        patternId = inserted.id;
      }

      lastPatternId = patternId;

      // Filter and insert items for this month's Friday count
      const itemsToInsert = items
        .filter((it: any) => Number(it.fridayIndex) <= mFridaysCount)
        .map((item: any, idx: number) => ({
          patternId,
          fridayIndex: Number(item.fridayIndex),
          imamId: Number(item.imamId),
          sequence: idx + 1,
          notes: item.notes || null,
        }));

      if (itemsToInsert.length > 0) {
        await db.insert(fixedAssignmentPatternItems).values(itemsToInsert);
      }
    }

    // Also update legacy fixed pattern on mosque for backwards compatibility
    if (patternType === 'SAME_ALL' && items[0]?.imamId) {
      await db.update(mosques).set({
        fixedImamId: Number(items[0].imamId),
        fixedPattern: 'ALL',
        fixedCount: Number(fridaysCount) || 5,
      }).where(eq(mosques.id, mosqueId));
    }

    await logAudit(req, 'SAVE_FIXED_PATTERN', 'MOSQUE', mosqueId, {
      hijriYear: hYear,
      monthsCount: targetMonths.length,
      patternType,
    });

    res.json({
      success: true,
      message: applyToFullYear
        ? `تم تثبيت النمط المعتمد للمسجد لجميع أشهر العام الهجري ${hYear} هـ بالكامل (12 شهراً)`
        : 'تم حفظ نمط التثبيت للمسجد بنجاح',
      patternId: lastPatternId,
    });
  } catch (error: any) {
    console.error('Error saving fixed pattern:', error);
    res.status(500).json({ error: 'تعذر حفظ نمط التثبيت', details: error.message });
  }
});

api.post('/mosques/:id/fixed-patterns/copy', async (req: AuthRequest, res: Response) => {
  try {
    const mosqueId = Number(req.params.id);
    const { sourceYear, sourceMonth, targetYear, targetMonth } = req.body;

    if (!sourceYear || !sourceMonth || !targetYear || !targetMonth) {
      return res.status(400).json({ error: 'الشهر والسنة المصدر والهدف حقول مطلوبة' });
    }

    const sYear = Number(sourceYear);
    const sMonth = Number(sourceMonth);
    const tYear = Number(targetYear);
    const tMonth = Number(targetMonth);

    // Validate target period
    const targetPeriod = CalendarService.validateSchedulePeriod(tYear, tMonth);
    if (!targetPeriod.isValid) {
      return res.status(400).json({ error: 'لا يمكن نسخ النمط لشهر ماضٍ انتهى بالفعل' });
    }

    const sourcePattern = await db.select().from(fixedAssignmentPatterns).where(
      and(
        eq(fixedAssignmentPatterns.mosqueId, mosqueId),
        eq(fixedAssignmentPatterns.hijriYear, sYear),
        eq(fixedAssignmentPatterns.hijriMonth, sMonth)
      )
    );

    if (sourcePattern.length === 0) {
      return res.status(404).json({ error: 'لم يتم العثور على نمط محفوظ في الشهر المصدر' });
    }

    const pattern = sourcePattern[0];
    const sourceItems = await db.select().from(fixedAssignmentPatternItems).where(
      eq(fixedAssignmentPatternItems.patternId, pattern.id)
    ).orderBy(asc(fixedAssignmentPatternItems.fridayIndex));

    const targetDetails = targetPeriod.monthDetails;
    const targetFridaysCount = targetDetails.fridaysCount;

    // Check existing in target
    const existingTarget = await db.select().from(fixedAssignmentPatterns).where(
      and(
        eq(fixedAssignmentPatterns.mosqueId, mosqueId),
        eq(fixedAssignmentPatterns.hijriYear, tYear),
        eq(fixedAssignmentPatterns.hijriMonth, tMonth)
      )
    );

    let targetPatternId: number;
    if (existingTarget.length > 0) {
      targetPatternId = existingTarget[0].id;
      await db.update(fixedAssignmentPatterns).set({
        patternType: pattern.patternType,
        fridaysCount: targetFridaysCount,
        isActive: true,
        updatedAt: new Date(),
      }).where(eq(fixedAssignmentPatterns.id, targetPatternId));

      await db.delete(fixedAssignmentPatternItems).where(
        eq(fixedAssignmentPatternItems.patternId, targetPatternId)
      );
    } else {
      const [inserted] = await db.insert(fixedAssignmentPatterns).values({
        mosqueId,
        hijriYear: tYear,
        hijriMonth: tMonth,
        patternType: pattern.patternType,
        fridaysCount: targetFridaysCount,
        isActive: true,
      }).returning();
      targetPatternId = inserted.id;
    }

    // Build target items taking into account 4 vs 5 fridays
    const newItems: any[] = [];
    if (pattern.patternType === 'SAME_ALL' && sourceItems.length > 0) {
      const imamId = sourceItems[0].imamId;
      for (let f = 1; f <= targetFridaysCount; f++) {
        newItems.push({
          patternId: targetPatternId,
          fridayIndex: f,
          imamId,
          sequence: f,
        });
      }
    } else {
      // For CUSTOM / SPLIT: copy existing fridays up to target count
      for (const sItem of sourceItems) {
        if (sItem.fridayIndex <= targetFridaysCount) {
          newItems.push({
            patternId: targetPatternId,
            fridayIndex: sItem.fridayIndex,
            imamId: sItem.imamId,
            sequence: sItem.sequence,
            notes: sItem.notes,
          });
        }
      }

      // If target has 5 fridays and source had 4, copy last imam to 5th or require assignment
      if (targetFridaysCount === 5 && sourceItems.length === 4) {
        const lastImam = sourceItems[sourceItems.length - 1];
        if (lastImam) {
          newItems.push({
            patternId: targetPatternId,
            fridayIndex: 5,
            imamId: lastImam.imamId,
            sequence: 5,
            notes: 'تم نسخ الخطيب للجمعة الخامسة الإضافية تلقائياً',
          });
        }
      }
    }

    if (newItems.length > 0) {
      await db.insert(fixedAssignmentPatternItems).values(newItems);
    }

    await logAudit(req, 'COPY_FIXED_PATTERN', 'MOSQUE', mosqueId, {
      from: `${sMonth}/${sYear}`,
      to: `${tMonth}/${tYear}`,
      itemsCount: newItems.length,
    });

    res.json({
      success: true,
      message: `تم نسخ نمط التثبيت بنجاح إلى شهر ${targetDetails.monthName} ${tYear} هـ (${targetFridaysCount} جمعات)`,
      targetFridaysCount,
      copiedItemsCount: newItems.length,
    });
  } catch (error: any) {
    console.error('Error copying fixed pattern:', error);
    res.status(500).json({ error: 'تعذر نسخ نمط التثبيت', details: error.message });
  }
});

api.delete('/mosques/:id/fixed-patterns/:patternId', async (req: AuthRequest, res: Response) => {
  try {
    const patternId = Number(req.params.patternId);
    await db.delete(fixedAssignmentPatterns).where(eq(fixedAssignmentPatterns.id, patternId));
    await logAudit(req, 'DELETE_FIXED_PATTERN', 'MOSQUE', Number(req.params.id), { patternId });
    res.json({ success: true, message: 'تم حذف نمط التثبيت بنجاح' });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حذف نمط التثبيت', details: error.message });
  }
});

api.post('/mosques/import', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body; // Array of mosques
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'قائمة المساجد فارغة أو غير صالحة' });
    }

    let createdCount = 0;
    for (const item of items) {
      if (!item.name || !item.code) continue;
      await db.insert(mosques).values({
        name: item.name,
        code: item.code,
        region: item.region || 'الوسط',
        address: item.address || null,
        managerName: item.managerName || null,
        phone: item.phone || null,
        whatsapp: item.whatsapp || null,
        notes: item.notes || null,
      }).onConflictDoUpdate({
        target: mosques.code,
        set: {
          name: item.name,
          region: item.region || 'الوسط',
          address: item.address,
        },
      });
      createdCount++;
    }

    await logAudit(req, 'IMPORT_MOSQUES', 'MOSQUE', undefined, { count: createdCount });
    res.json({ success: true, imported: createdCount });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر استيراد المساجد', details: error.message });
  }
});

// -------------------------------------------------------------
// 2.5. Rules Matrix Endpoints
// -------------------------------------------------------------
api.get('/rules', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(mosqueImamRules).orderBy(asc(mosqueImamRules.id));
    res.json(list);
  } catch (error: any) {
    console.warn('DB fetch for rules failed, falling back to memory store:', error?.message);
    res.json(memoryStore.getRules());
  }
});

api.post('/rules', async (req: AuthRequest, res: Response) => {
  try {
    const { mosqueId, imamId, relationshipType, priority, notes } = req.body;
    if (!mosqueId || !imamId || !relationshipType) {
      return res.status(400).json({ error: 'المسجد والخطيب ونوع العلاقة حقول مطلوبة' });
    }

    const inserted = await db.insert(mosqueImamRules).values({
      mosqueId: Number(mosqueId),
      imamId: Number(imamId),
      relationshipType,
      priority: priority || 1,
      notes: notes || null,
    }).returning();

    await logAudit(req, 'CREATE', 'RULE', inserted[0].id, { mosqueId, imamId, relationshipType });
    res.status(201).json(inserted[0]);
  } catch (error: any) {
    console.warn('DB create rule failed, falling back to memoryStore:', error?.message);
    try {
      const created = memoryStore.createRule({
        mosqueId: Number(req.body.mosqueId),
        imamId: Number(req.body.imamId),
        relationshipType: req.body.relationshipType,
        priority: req.body.priority || 1,
        notes: req.body.notes || null,
      });
      return res.status(201).json(created);
    } catch (fbErr) {
      console.error('Fallback createRule failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر إضافة القاعدة', details: error.message });
  }
});

api.delete('/rules/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(mosqueImamRules).where(eq(mosqueImamRules.id, id));
    await logAudit(req, 'DELETE', 'RULE', id);
    res.json({ success: true, message: 'تم حذف القاعدة بنجاح' });
  } catch (error: any) {
    console.warn('DB delete rule failed, falling back to memoryStore:', error?.message);
    memoryStore.deleteRule(Number(req.params.id));
    return res.json({ success: true, message: 'تم حذف القاعدة بنجاح' });
  }
});

// -------------------------------------------------------------
// 3. Imams Endpoints
// -------------------------------------------------------------
api.get('/imams', async (req: Request, res: Response) => {
  const search = (req.query.search as string) || '';
  const type = (req.query.type as string) || '';

  try {
    const list = await db.select().from(imams).orderBy(asc(imams.id));
    let filtered = list;

    if (search) {
      filtered = filtered.filter(
        (i) => i.name.includes(search) || (i.phone && i.phone.includes(search)) || (i.region && i.region.includes(search))
      );
    }
    if (type && type !== 'ALL') {
      filtered = filtered.filter((i) => i.type === type);
    }

    res.json(filtered);
  } catch (error: any) {
    console.warn('DB fetch for imams failed, falling back to memory store:', error?.message);
    const fallback = memoryStore.getImams(search, type);
    res.json(fallback);
  }
});

api.get('/imams/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const found = await db.select().from(imams).where(eq(imams.id, id)).limit(1);
    if (!found[0]) {
      const fallbackFound = memoryStore.getImamDetails(id);
      if (fallbackFound) return res.json(fallbackFound);
      return res.status(404).json({ error: 'الخطيب غير موجود' });
    }

    const availabilities = await db.select().from(imamAvailabilities).where(eq(imamAvailabilities.imamId, id));
    const rules = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.imamId, id));
    const allMosques = await db.select().from(mosques);
    const mosqueMap = new Map(allMosques.map((m) => [m.id, m]));

    const enrichedRules = rules.map((r) => ({
      ...r,
      mosque: mosqueMap.get(r.mosqueId),
    }));

    res.json({
      ...found[0],
      availabilities,
      rules: enrichedRules,
    });
  } catch (error: any) {
    console.warn('DB fetch for imam details failed, falling back to memory store:', error?.message);
    const fallbackFound = memoryStore.getImamDetails(Number(req.params.id));
    if (fallbackFound) return res.json(fallbackFound);
    res.status(500).json({ error: 'تعذر جلب تفاصيل الخطيب', details: error.message });
  }
});

// Full Imam Profile Endpoint
api.get('/imams/:id/profile', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const found = await db.select().from(imams).where(eq(imams.id, id)).limit(1);
    if (!found[0]) return res.status(404).json({ error: 'الخطيب غير موجود' });
    const imam = found[0];

    // All assignments for this imam
    const allAssignments = await db.select().from(assignments).where(eq(assignments.imamId, id));
    const allFridays = await db.select().from(fridays);
    const fridayMap = new Map(allFridays.map((f) => [f.id, f]));
    const allSchedules = await db.select().from(monthlySchedules).orderBy(desc(monthlySchedules.id));
    const scheduleMap = new Map(allSchedules.map((s) => [s.id, s]));
    const allMosques = await db.select().from(mosques);
    const mosqueMap = new Map(allMosques.map((m) => [m.id, m]));

    // Determine target schedule (from query or active approved/published/latest)
    const requestedScheduleId = req.query.scheduleId ? Number(req.query.scheduleId) : undefined;
    const activeSchedule =
      (requestedScheduleId ? allSchedules.find((s) => s.id === requestedScheduleId) : null) ||
      allSchedules.find((s) => s.status === 'APPROVED' || s.status === 'PUBLISHED') ||
      allSchedules.find((s) => s.status === 'REVIEW' || s.status === 'DRAFT') ||
      allSchedules[0] ||
      null;

    const profileAssignments = allAssignments.map((a) => {
      const f = fridayMap.get(a.fridayId);
      const s = scheduleMap.get(a.scheduleId);
      const m = mosqueMap.get(a.mosqueId);
      const isUpcoming = activeSchedule ? a.scheduleId === activeSchedule.id : s?.status !== 'ARCHIVED';

      return {
        id: a.id,
        scheduleId: a.scheduleId,
        fridayId: a.fridayId,
        fridayIndex: a.fridayIndex,
        hijriDate: f?.hijriDate || `جمعة ${a.fridayIndex}`,
        gregorianDate: f?.gregorianDate || undefined,
        monthName: s?.monthName || 'غير محدد',
        hijriYear: s?.hijriYear || 1448,
        scheduleStatus: s?.status || 'APPROVED',
        mosqueId: a.mosqueId,
        mosqueName: m?.name || 'مسجد غير معروف',
        mosqueCode: m?.code || '',
        mosqueRegion: m?.region || '',
        imamId: imam.id,
        imamName: imam.name,
        imamType: imam.type,
        imamPhone: imam.phone || undefined,
        isLocked: a.isLocked,
        source: a.source,
        isUpcoming,
      };
    }).sort((x, y) => {
      if (x.scheduleId !== y.scheduleId) return y.scheduleId - x.scheduleId;
      return x.fridayIndex - y.fridayIndex;
    });

    // Upcoming assignments strictly for the targeted monthly schedule
    const upcomingAssignments = activeSchedule
      ? profileAssignments
          .filter((a) => a.scheduleId === activeSchedule.id)
          .sort((x, y) => x.fridayIndex - y.fridayIndex)
      : profileAssignments.filter((a) => a.isUpcoming);

    // Rules
    const allRules = await db.select().from(mosqueImamRules).where(eq(mosqueImamRules.imamId, id));
    const enrichedRules = allRules.map((r) => {
      const m = mosqueMap.get(r.mosqueId);
      return {
        ...r,
        mosqueName: m?.name,
        mosqueRegion: m?.region,
      };
    });

    // Linked mosques aggregation
    const mosqueCounts = new Map<number, { count: number; lastDate?: string; nextDate?: string }>();
    for (const a of profileAssignments) {
      const curr = mosqueCounts.get(a.mosqueId) || { count: 0 };
      curr.count += 1;
      if (a.isUpcoming && !curr.nextDate) curr.nextDate = a.hijriDate;
      if (!a.isUpcoming && !curr.lastDate) curr.lastDate = a.hijriDate;
      mosqueCounts.set(a.mosqueId, curr);
    }

    const linkedMosques = Array.from(mosqueCounts.entries()).map(([mId, data]) => {
      const m = mosqueMap.get(mId);
      const rule = allRules.find((r) => r.mosqueId === mId);
      return {
        mosqueId: mId,
        mosqueName: m?.name || `مسجد #${mId}`,
        mosqueCode: m?.code || '',
        mosqueRegion: m?.region || '',
        relationshipType: rule?.relationshipType || (m?.fixedImamId === id ? 'FIXED' : undefined),
        priority: rule?.priority,
        assignedCount: data.count,
        lastDate: data.lastDate,
        nextDate: data.nextDate,
      };
    }).sort((x, y) => y.assignedCount - x.assignedCount);

    // Availabilities
    const availabilities = await db.select().from(imamAvailabilities).where(eq(imamAvailabilities.imamId, id));

    // Audit logs
    const logs = await db.select().from(auditLogs).where(and(eq(auditLogs.entityType, 'IMAM'), eq(auditLogs.entityId, id))).orderBy(desc(auditLogs.id)).limit(20);

    const stats = {
      totalAssigned: upcomingAssignments.length, // strictly scoped to current monthly schedule
      currentMonthFridaysCount: upcomingAssignments.length,
      currentScheduleFridaysTotal: activeSchedule?.fridaysCount || 5,
      currentMonthName: activeSchedule?.monthName || '',
      currentHijriYear: activeSchedule?.hijriYear || 1448,
      currentScheduleStatus: activeSchedule?.status || 'APPROVED',
      lifetimeTotalAssigned: profileAssignments.length,
      mosquesCount: linkedMosques.length,
      upcomingCount: upcomingAssignments.length,
      pastCount: profileAssignments.length - upcomingAssignments.length,
      availabilitiesCount: availabilities.length,
      minFridays: imam.minFridays,
      targetFridays: imam.targetFridays,
      maxFridays: imam.maxFridays,
    };

    res.json({
      imam,
      activeSchedule,
      availableSchedules: allSchedules.map((s) => ({
        id: s.id,
        monthName: s.monthName,
        hijriYear: s.hijriYear,
        fridaysCount: s.fridaysCount,
        status: s.status,
      })),
      stats,
      assignments: profileAssignments,
      upcomingAssignments,
      linkedMosques,
      rules: enrichedRules,
      availabilities,
      auditLogs: logs,
    });
  } catch (error: any) {
    console.warn('DB fetch for imam profile failed, falling back to memory store:', error?.message);
    const fallback = memoryStore.getImamProfile(Number(req.params.id), req.query.scheduleId ? Number(req.query.scheduleId) : undefined);
    if (fallback) return res.json(fallback);
    res.status(500).json({ error: 'تعذر جلب الملف التعريفي للخطيب', details: error.message });
  }
});

api.post('/imams', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      type,
      minFridays,
      targetFridays,
      maxFridays,
      phone,
      whatsapp,
      region,
      address,
      countryId,
      governorateId,
      districtId,
      areaId,
      street,
      buildingNumber,
      landmark,
      latitude,
      longitude,
      notes,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'اسم الخطيب مطلوب' });

    let finalFormatted = address;
    let finalRegion = region;

    if (governorateId) {
      finalFormatted = EgyptAdministrativeProvider.formatStructuredAddress({
        countryId: countryId || 1,
        governorateId: Number(governorateId),
        districtId: districtId ? Number(districtId) : null,
        areaId: areaId ? Number(areaId) : null,
        street,
        buildingNumber,
        landmark,
      });

      if (!finalRegion || finalRegion === 'الوسط') {
        if (areaId) {
          const a = EgyptAdministrativeProvider.getUnitById(Number(areaId));
          if (a) finalRegion = a.nameAr;
        } else if (districtId) {
          const d = EgyptAdministrativeProvider.getUnitById(Number(districtId));
          if (d) finalRegion = d.nameAr;
        }
      }
    }

    const [created] = await db.insert(imams).values({
      name,
      type: type || 'FLEXIBLE',
      minFridays: minFridays ? Number(minFridays) : 1,
      targetFridays: targetFridays ? Number(targetFridays) : 4,
      maxFridays: maxFridays ? Number(maxFridays) : 5,
      phone,
      whatsapp,
      region: finalRegion || 'منشأة البكاري',
      address: finalFormatted || address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
      countryId: countryId ? Number(countryId) : 1,
      governorateId: governorateId ? Number(governorateId) : 1,
      districtId: districtId ? Number(districtId) : 101,
      areaId: areaId ? Number(areaId) : 1001,
      street: street || null,
      buildingNumber: buildingNumber || null,
      landmark: landmark || null,
      formattedAddress: finalFormatted || address || null,
      latitude: latitude ? String(latitude) : null,
      longitude: longitude ? String(longitude) : null,
      notes,
    }).returning();

    await logAudit(req, 'CREATE_IMAM', 'IMAM', created.id, { name });
    res.status(201).json(created);
  } catch (error: any) {
    console.warn('DB create imam failed, falling back to memoryStore:', error?.message);
    try {
      const created = memoryStore.createImam(req.body);
      return res.status(201).json(created);
    } catch (fbErr) {
      console.error('Fallback createImam failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر إضافة الخطيب', details: error.message });
  }
});

api.patch('/imams/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const data = req.body;

    if (data.governorateId) {
      const finalFormatted = EgyptAdministrativeProvider.formatStructuredAddress({
        countryId: data.countryId || 1,
        governorateId: Number(data.governorateId),
        districtId: data.districtId ? Number(data.districtId) : null,
        areaId: data.areaId ? Number(data.areaId) : null,
        street: data.street,
        buildingNumber: data.buildingNumber,
        landmark: data.landmark,
      });
      data.formattedAddress = finalFormatted;
      data.address = finalFormatted;

      if (!data.region || data.region === 'الوسط') {
        if (data.areaId) {
          const a = EgyptAdministrativeProvider.getUnitById(Number(data.areaId));
          if (a) data.region = a.nameAr;
        } else if (data.districtId) {
          const d = EgyptAdministrativeProvider.getUnitById(Number(data.districtId));
          if (d) data.region = d.nameAr;
        }
      }
    }

    const [updated] = await db.update(imams)
      .set({
        ...data,
        countryId: data.countryId !== undefined ? (data.countryId ? Number(data.countryId) : 1) : undefined,
        governorateId: data.governorateId !== undefined ? (data.governorateId ? Number(data.governorateId) : null) : undefined,
        districtId: data.districtId !== undefined ? (data.districtId ? Number(data.districtId) : null) : undefined,
        areaId: data.areaId !== undefined ? (data.areaId ? Number(data.areaId) : null) : undefined,
        minFridays: data.minFridays !== undefined ? Number(data.minFridays) : undefined,
        targetFridays: data.targetFridays !== undefined ? Number(data.targetFridays) : undefined,
        maxFridays: data.maxFridays !== undefined ? Number(data.maxFridays) : undefined,
      })
      .where(eq(imams.id, id))
      .returning();

    await logAudit(req, 'UPDATE_IMAM', 'IMAM', id, data);
    res.json(updated);
  } catch (error: any) {
    console.warn('DB patch imam failed, falling back to memoryStore:', error?.message);
    try {
      const updated = memoryStore.updateImam(Number(req.params.id), req.body);
      if (updated) return res.json(updated);
    } catch (fbErr) {
      console.error('Fallback updateImam failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر تحديث بيانات الخطيب', details: error.message });
  }
});

api.delete('/imams/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(imams).where(eq(imams.id, id));
    await logAudit(req, 'DELETE_IMAM', 'IMAM', id);
    res.json({ success: true });
  } catch (error: any) {
    console.warn('DB delete imam failed, falling back to memoryStore:', error?.message);
    memoryStore.deleteImam(Number(req.params.id));
    return res.json({ success: true });
  }
});

api.post('/imams/bulk-delete', async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'يرجى تحديد الخطباء المراد حذفهم' });
    }
    const numIds = ids.map(Number).filter((n) => !isNaN(n));
    await db.delete(imams).where(inArray(imams.id, numIds));
    await logAudit(req, 'BULK_DELETE_IMAMS', 'IMAM', 0, { deletedCount: numIds.length });
    res.json({ success: true, count: numIds.length });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حذف الخطباء المحددين', details: error.message });
  }
});

api.post('/imams/:id/availabilities', async (req: AuthRequest, res: Response) => {
  try {
    const imamId = Number(req.params.id);
    const { hijriYear, hijriMonth, fridayIndex, isAvailable, reason } = req.body;

    // Check existing
    const existing = await db.select().from(imamAvailabilities).where(
      and(
        eq(imamAvailabilities.imamId, imamId),
        eq(imamAvailabilities.hijriYear, Number(hijriYear)),
        eq(imamAvailabilities.hijriMonth, Number(hijriMonth)),
        eq(imamAvailabilities.fridayIndex, Number(fridayIndex))
      )
    );

    let saved;
    if (existing[0]) {
      [saved] = await db.update(imamAvailabilities)
        .set({
          isAvailable: Boolean(isAvailable),
          reason,
        })
        .where(eq(imamAvailabilities.id, existing[0].id))
        .returning();
    } else {
      [saved] = await db.insert(imamAvailabilities).values({
        imamId,
        hijriYear: Number(hijriYear),
        hijriMonth: Number(hijriMonth),
        fridayIndex: Number(fridayIndex),
        isAvailable: Boolean(isAvailable),
        reason,
      }).returning();
    }

    res.json(saved);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر تحديث التوفر', details: error.message });
  }
});

// -------------------------------------------------------------
// 4. Schedules & Wizard Endpoints
// -------------------------------------------------------------
api.get('/schedules', async (_req: Request, res: Response) => {
  try {
    const list = await db.select().from(monthlySchedules).orderBy(desc(monthlySchedules.id));
    const enrichedList = list.map((s) => {
      const monthDetails = CalendarService.getHijriMonthDetails(s.hijriYear, s.hijriMonth, {
        provider: (s.calendarProvider as any) || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
        timezone: s.timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
      });
      return {
        ...s,
        periodStatus: monthDetails.periodStatus,
        statusLabelArabic: monthDetails.statusLabelArabic,
        isPast: monthDetails.isPast,
        isCurrent: monthDetails.isCurrent,
        isFuture: monthDetails.isFuture,
        isCreatable: monthDetails.isCreatable,
        isEditable: monthDetails.isEditable,
        pastFridaysCount: monthDetails.pastFridaysCount,
        futureFridaysCount: monthDetails.futureFridaysCount,
      };
    });
    res.json(enrichedList);
  } catch (error: any) {
    console.warn('DB fetch for schedules failed, falling back to memory store:', error?.message);
    res.json(memoryStore.getSchedules());
  }
});

api.post('/schedules', async (req: AuthRequest, res: Response) => {
  try {
    const { hijriYear, hijriMonth, calendarProvider, timezone } = req.body;
    if (!hijriYear || !hijriMonth) {
      return res.status(400).json({ error: 'السنة الهجرية والشهر الهجري مطلوبان لإنشاء الجدول' });
    }

    const hYear = Number(hijriYear);
    const hMonth = Number(hijriMonth);

    // 1. Strict Temporal Policy Validation (Backend Authority)
    const periodValidation = CalendarService.validateSchedulePeriod(hYear, hMonth, {
      provider: calendarProvider || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
    });

    if (!periodValidation.isValid) {
      return res.status(400).json({
        error: periodValidation.error || 'هذا الشهر انتهى بالفعل ولا يمكن إنشاء جدول جديد له. يمكنك تعديل جدول الشهر الحالي أو إنشاء جدول لشهر قادم.',
        code: 'SCHEDULE_PERIOD_PAST',
        periodStatus: periodValidation.periodStatus,
      });
    }

    // 2. Check duplicate schedule for this year and month
    const existing = await db.select().from(monthlySchedules).where(
      and(
        eq(monthlySchedules.hijriYear, hYear),
        eq(monthlySchedules.hijriMonth, hMonth)
      )
    );

    if (existing.length > 0) {
      return res.status(400).json({
        error: `يوجد بالفعل جدول لشهر ${existing[0].monthName} ${hYear} هـ (الجدول #${existing[0].id})`,
      });
    }

    // Authoritative calculation from CalendarService
    const monthDetails = periodValidation.monthDetails;

    const [schedule] = await db.insert(monthlySchedules).values({
      hijriYear: hYear,
      hijriMonth: hMonth,
      monthName: monthDetails.monthName,
      fridaysCount: monthDetails.fridaysCount,
      daysCount: monthDetails.daysCount,
      calendarProvider: monthDetails.calendarProvider,
      timezone: monthDetails.timezone,
      startDateGregorian: monthDetails.startDateGregorian,
      endDateGregorian: monthDetails.endDateGregorian,
      status: 'DRAFT',
      currentVersion: 1,
      createdBy: req.user?.email || 'admin@aljameya.org',
    }).returning();

    // Create fridays records from the authoritative list with period annotations
    const fridaysToInsert = monthDetails.fridays.map((f) => ({
      scheduleId: schedule.id,
      fridayIndex: f.fridayIndex,
      hijriYear: f.hijriYear,
      hijriMonth: f.hijriMonth,
      hijriDay: f.hijriDay,
      hijriDate: f.hijriDate,
      gregorianDate: f.gregorianDate,
      dayOfWeek: f.dayOfWeek,
    }));

    if (fridaysToInsert.length > 0) {
      await db.insert(fridays).values(fridaysToInsert);
    }

    await logAudit(req, 'CREATE_SCHEDULE', 'SCHEDULE', schedule.id, {
      monthName: monthDetails.monthName,
      hijriYear: hYear,
      fridaysCount: monthDetails.fridaysCount,
      daysCount: monthDetails.daysCount,
      calendarProvider: monthDetails.calendarProvider,
      timezone: monthDetails.timezone,
      periodStatus: monthDetails.periodStatus,
    });

    res.status(201).json({
      ...schedule,
      periodStatus: monthDetails.periodStatus,
      statusLabelArabic: monthDetails.statusLabelArabic,
      monthDetails,
    });
  } catch (error: any) {
    console.warn('DB create schedule failed, falling back to memoryStore:', error?.message);
    try {
      const fallbackResult = memoryStore.createSchedule(
        Number(req.body.hijriYear),
        Number(req.body.hijriMonth),
        req.body.calendarProvider,
        req.body.timezone,
        req.user?.email
      );
      if (fallbackResult.isDuplicate) {
        return res.status(400).json({ error: fallbackResult.error });
      }
      return res.status(201).json(fallbackResult);
    } catch (fbError: any) {
      console.error('Fallback memoryStore create schedule failed:', fbError);
      res.status(500).json({ error: 'تعذر إنشاء الجدول الشهري', details: fbError.message });
    }
  }
});

api.get('/schedules/:id', async (req: Request, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    const monthDetails = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth, {
      provider: (schedule.calendarProvider as any) || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: schedule.timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
    });

    const scheduleFridays = await db.select().from(fridays).where(eq(fridays.scheduleId, scheduleId)).orderBy(asc(fridays.fridayIndex));
    
    // Annotate fridays with period status and locked state
    const annotatedFridays = scheduleFridays.map((sf) => {
      const matchItem = monthDetails.fridays.find((f) => f.fridayIndex === sf.fridayIndex);
      return {
        ...sf,
        periodStatus: matchItem?.periodStatus || (monthDetails.isPast ? 'PAST' : 'FUTURE'),
        isPast: matchItem?.isPast || monthDetails.isPast,
        isLocked: matchItem?.isPast || monthDetails.isPast,
      };
    });

    const scheduleAssignments = await db.select().from(assignments).where(eq(assignments.scheduleId, scheduleId));
    const scheduleConflicts = await db.select().from(conflicts).where(eq(conflicts.scheduleId, scheduleId));
    const scheduleOverrides = await db.select().from(overrides).where(eq(overrides.scheduleId, scheduleId)).orderBy(desc(overrides.createdAt));
    const versions = await db.select().from(scheduleVersions).where(eq(scheduleVersions.scheduleId, scheduleId)).orderBy(desc(scheduleVersions.versionNumber));

    const allMosques = await db.select().from(mosques);
    const allImams = await db.select().from(imams);
    const allRules = await db.select().from(mosqueImamRules);

    res.json({
      schedule: {
        ...schedule,
        periodStatus: monthDetails.periodStatus,
        statusLabelArabic: monthDetails.statusLabelArabic,
        isPast: monthDetails.isPast,
        isCurrent: monthDetails.isCurrent,
        isFuture: monthDetails.isFuture,
        isCreatable: monthDetails.isCreatable,
        isEditable: monthDetails.isEditable,
        pastFridaysCount: monthDetails.pastFridaysCount,
        futureFridaysCount: monthDetails.futureFridaysCount,
      },
      fridays: annotatedFridays,
      assignments: scheduleAssignments,
      conflicts: scheduleConflicts,
      overrides: scheduleOverrides,
      versions,
      mosques: allMosques,
      imams: allImams,
      rules: allRules,
    });
  } catch (error: any) {
    console.warn('DB fetch for schedule details failed, falling back to memory store:', error?.message);
    const fallback = memoryStore.getScheduleDetails(Number(req.params.id));
    if (fallback) {
      return res.json({
        ...fallback,
        mosques: memoryStore.getMosques(),
        imams: memoryStore.getImams(),
        rules: memoryStore.getRules(),
      });
    }
    res.status(500).json({ error: 'تعذر جلب تفاصيل الجدول', details: error.message });
  }
});

// Run Scheduling Engine for a schedule
api.post('/schedules/:id/generate', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { distributionMethod, seed } = req.body;

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    // Strict Temporal Policy Validation: Past schedule cannot be generated/regenerated
    const monthDetails = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth, {
      provider: (schedule.calendarProvider as any) || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: schedule.timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
    });

    if (monthDetails.periodStatus === 'PAST') {
      return res.status(400).json({
        error: 'هذا الجدول لشهر ماضٍ وانتهى بالفعل، وهو متاح للقراءة والتقارير فقط ولا يمكن إعادة توليده.',
        code: 'SCHEDULE_PERIOD_PAST',
      });
    }

    const activeMosques = await db.select().from(mosques).where(eq(mosques.isActive, true));
    const activeImams = await db.select().from(imams).where(eq(imams.isActive, true));
    const rules = await db.select().from(mosqueImamRules);
    const availabilities = await db.select().from(imamAvailabilities).where(
      and(
        eq(imamAvailabilities.hijriYear, schedule.hijriYear),
        eq(imamAvailabilities.hijriMonth, schedule.hijriMonth)
      )
    );

    // Identify past fridays (strictly before today) in current month
    const pastFridayIndices = new Set(
      monthDetails.fridays.filter((f) => f.isPast).map((f) => f.fridayIndex)
    );

    // Get existing assignments
    const existingAssignments = await db.select().from(assignments).where(eq(assignments.scheduleId, scheduleId));
    
    // Automatically lock: user-locked assignments + ALL assignments on past Fridays
    const lockedAssignments = existingAssignments
      .filter((a) => a.isLocked || pastFridayIndices.has(a.fridayIndex))
      .map((a) => ({
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
        source: a.source as any,
        notes: a.notes,
      }));

    // Load active fixed assignment patterns for this specific hijri month
    const patternRecords = await db.select().from(fixedAssignmentPatterns).where(
      and(
        eq(fixedAssignmentPatterns.hijriYear, schedule.hijriYear),
        eq(fixedAssignmentPatterns.hijriMonth, schedule.hijriMonth),
        eq(fixedAssignmentPatterns.isActive, true)
      )
    );
    const patternIds = patternRecords.map((p) => p.id);
    let patternItemsRecords: any[] = [];
    if (patternIds.length > 0) {
      const allPatternItems = await db.select().from(fixedAssignmentPatternItems);
      patternItemsRecords = allPatternItems.filter((item) => patternIds.includes(item.patternId));
    }

    const fixedPatternsInput = patternRecords.map((p) => ({
      mosqueId: p.mosqueId,
      patternType: p.patternType as any,
      fridaysCount: p.fridaysCount,
      items: patternItemsRecords
        .filter((item) => item.patternId === p.id)
        .map((item) => ({
          fridayIndex: item.fridayIndex,
          imamId: item.imamId,
          sequence: item.sequence,
          notes: item.notes,
        })),
    }));

    const result = SchedulingEngine.generate({
      monthName: schedule.monthName,
      hijriYear: schedule.hijriYear,
      hijriMonth: schedule.hijriMonth,
      fridaysCount: schedule.fridaysCount,
      mosques: activeMosques.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        isActive: m.isActive,
        fixedImamId: m.fixedImamId,
        fixedPattern: m.fixedPattern as any,
        fixedCount: m.fixedCount,
      })),
      imams: activeImams.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type as any,
        minFridays: i.minFridays,
        targetFridays: i.targetFridays,
        maxFridays: i.maxFridays,
        isActive: i.isActive,
        region: i.region,
      })),
      rules: rules.map((r) => ({
        mosqueId: r.mosqueId,
        imamId: r.imamId,
        relationshipType: r.relationshipType as any,
        priority: r.priority,
      })),
      availabilities: availabilities.map((a) => ({
        imamId: a.imamId,
        fridayIndex: a.fridayIndex,
        isAvailable: a.isAvailable,
        reason: a.reason,
      })),
      lockedAssignments,
      fixedPatterns: fixedPatternsInput,
      distributionMethod: distributionMethod || 'Balanced Random',
      seed: seed || `${schedule.monthName}-${schedule.hijriYear}-V${schedule.currentVersion}`,
    });

    // Delete ONLY unlocked assignments on FUTURE fridays (protect past fridays)
    for (const ea of existingAssignments) {
      if (!ea.isLocked && !pastFridayIndices.has(ea.fridayIndex)) {
        await db.delete(assignments).where(eq(assignments.id, ea.id));
      }
    }
    await db.delete(conflicts).where(eq(conflicts.scheduleId, scheduleId));

    // Get fridays list
    const scheduleFridays = await db.select().from(fridays).where(eq(fridays.scheduleId, scheduleId));
    const fridayMap = new Map(scheduleFridays.map((f) => [f.fridayIndex, f.id]));

    // Insert assignments only for slots that are not already locked / past
    const assignmentsToInsert = result.assignments
      .filter((a) => !lockedAssignments.some((l) => l.mosqueId === a.mosqueId && l.fridayIndex === a.fridayIndex))
      .map((a) => ({
        scheduleId,
        fridayId: fridayMap.get(a.fridayIndex) || scheduleFridays[0]?.id || 1,
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
        source: a.source,
        isLocked: a.isLocked || pastFridayIndices.has(a.fridayIndex),
        notes: a.notes,
      }));

    if (assignmentsToInsert.length > 0) {
      await db.insert(assignments).values(assignmentsToInsert);
    }

    // Insert conflicts
    if (result.conflicts.length > 0) {
      const conflictsToInsert = result.conflicts.map((c) => ({
        scheduleId,
        severity: c.severity,
        mosqueId: c.mosqueId,
        fridayIndex: c.fridayIndex,
        imamId: c.imamId,
        ruleCode: c.ruleCode,
        message: c.message,
        possibleResolutions: JSON.stringify(c.possibleResolutions),
      }));
      await db.insert(conflicts).values(conflictsToInsert);
    }

    // Update schedule status to REVIEW or GENERATED
    await db.update(monthlySchedules)
      .set({
        status: 'REVIEW',
        updatedAt: new Date(),
      })
      .where(eq(monthlySchedules.id, scheduleId));

    await logAudit(req, 'GENERATE_SCHEDULE', 'SCHEDULE', scheduleId, {
      stats: result.stats,
      protectedPastFridaysCount: pastFridayIndices.size,
    });
  } catch (error: any) {
    console.warn('DB generate schedule failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const fallbackResult = memoryStore.generateSchedule(
        scheduleId,
        req.body?.distributionMethod,
        req.body?.seed
      );
      return res.json(fallbackResult);
    } catch (fbError: any) {
      console.error('Fallback memoryStore generate schedule failed:', fbError);
      res.status(500).json({ error: 'تعذر إنشاء التوزيع', details: fbError.message });
    }
  }
});

// Redistribute (Full, Unlocked only, Single Mosque, or Single Friday)
api.post('/schedules/:id/redistribute', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { targetMosqueId, targetFridayIndex, distributionMethod, unlockedOnly } = req.body;

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    // Strict Temporal Policy Validation: Past schedule cannot be redistributed
    const monthDetails = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth, {
      provider: (schedule.calendarProvider as any) || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: schedule.timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
    });

    if (monthDetails.periodStatus === 'PAST') {
      return res.status(400).json({
        error: 'هذا الجدول لشهر ماضٍ وانتهى بالفعل، وهو متاح للقراءة فقط ولا يمكن إعادة توزيعه.',
        code: 'SCHEDULE_PERIOD_PAST',
      });
    }

    // If a specific Friday is targeted, verify it is not in the past
    if (targetFridayIndex) {
      const fCheck = CalendarService.validateFridayAction(
        schedule.hijriYear,
        schedule.hijriMonth,
        Number(targetFridayIndex),
        { provider: schedule.calendarProvider as any, timezone: schedule.timezone }
      );
      if (!fCheck.isAllowed) {
        return res.status(400).json({
          error: fCheck.reason || 'هذه الجمعة انتهت بالفعل ولا يمكن إعادة توزيعها.',
          code: 'FRIDAY_PERIOD_PAST',
        });
      }
    }

    const pastFridayIndices = new Set(
      monthDetails.fridays.filter((f) => f.isPast).map((f) => f.fridayIndex)
    );

    const activeMosques = await db.select().from(mosques).where(eq(mosques.isActive, true));
    const activeImams = await db.select().from(imams).where(eq(imams.isActive, true));
    const rules = await db.select().from(mosqueImamRules);
    const availabilities = await db.select().from(imamAvailabilities).where(
      and(
        eq(imamAvailabilities.hijriYear, schedule.hijriYear),
        eq(imamAvailabilities.hijriMonth, schedule.hijriMonth)
      )
    );

    const existingAssignments = await db.select().from(assignments).where(eq(assignments.scheduleId, scheduleId));
    
    // Automatically lock all past fridays as well as existing locked assignments
    const lockedAssignments = existingAssignments
      .filter((a) => a.isLocked || pastFridayIndices.has(a.fridayIndex))
      .map((a) => ({
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
        source: a.source as any,
        notes: a.notes,
      }));

    // Load active fixed assignment patterns for this specific hijri month
    const patternRecordsRedist = await db.select().from(fixedAssignmentPatterns).where(
      and(
        eq(fixedAssignmentPatterns.hijriYear, schedule.hijriYear),
        eq(fixedAssignmentPatterns.hijriMonth, schedule.hijriMonth),
        eq(fixedAssignmentPatterns.isActive, true)
      )
    );
    const patternIdsRedist = patternRecordsRedist.map((p) => p.id);
    let patternItemsRedist: any[] = [];
    if (patternIdsRedist.length > 0) {
      const allPatternItems = await db.select().from(fixedAssignmentPatternItems);
      patternItemsRedist = allPatternItems.filter((item) => patternIdsRedist.includes(item.patternId));
    }

    const fixedPatternsInputRedist = patternRecordsRedist.map((p) => ({
      mosqueId: p.mosqueId,
      patternType: p.patternType as any,
      fridaysCount: p.fridaysCount,
      items: patternItemsRedist
        .filter((item) => item.patternId === p.id)
        .map((item) => ({
          fridayIndex: item.fridayIndex,
          imamId: item.imamId,
          sequence: item.sequence,
          notes: item.notes,
        })),
    }));

    const result = SchedulingEngine.generate({
      monthName: schedule.monthName,
      hijriYear: schedule.hijriYear,
      hijriMonth: schedule.hijriMonth,
      fridaysCount: schedule.fridaysCount,
      mosques: activeMosques.map((m) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        isActive: m.isActive,
        fixedImamId: m.fixedImamId,
        fixedPattern: m.fixedPattern as any,
        fixedCount: m.fixedCount,
      })),
      imams: activeImams.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type as any,
        minFridays: i.minFridays,
        targetFridays: i.targetFridays,
        maxFridays: i.maxFridays,
        isActive: i.isActive,
        region: i.region,
      })),
      rules: rules.map((r) => ({
        mosqueId: r.mosqueId,
        imamId: r.imamId,
        relationshipType: r.relationshipType as any,
        priority: r.priority,
      })),
      availabilities: availabilities.map((a) => ({
        imamId: a.imamId,
        fridayIndex: a.fridayIndex,
        isAvailable: a.isAvailable,
        reason: a.reason,
      })),
      lockedAssignments,
      fixedPatterns: fixedPatternsInputRedist,
      targetMosqueId: targetMosqueId ? Number(targetMosqueId) : undefined,
      targetFridayIndex: targetFridayIndex ? Number(targetFridayIndex) : undefined,
      distributionMethod: distributionMethod || 'Balanced Random',
    });

    const scheduleFridays = await db.select().from(fridays).where(eq(fridays.scheduleId, scheduleId));
    const fridayMap = new Map(scheduleFridays.map((f) => [f.fridayIndex, f.id]));

    // Update modified assignments for future fridays only
    for (const a of result.assignments) {
      if (pastFridayIndices.has(a.fridayIndex)) continue; // Never overwrite past fridays
      if (targetMosqueId && a.mosqueId !== Number(targetMosqueId)) continue;
      if (targetFridayIndex && a.fridayIndex !== Number(targetFridayIndex)) continue;

      const existing = existingAssignments.find((ea) => ea.mosqueId === a.mosqueId && ea.fridayIndex === a.fridayIndex);
      if (existing) {
        if (!existing.isLocked && !pastFridayIndices.has(existing.fridayIndex)) {
          await db.update(assignments)
            .set({
              imamId: a.imamId,
              source: a.source,
              updatedAt: new Date(),
            })
            .where(eq(assignments.id, existing.id));
        }
      } else {
        await db.insert(assignments).values({
          scheduleId,
          fridayId: fridayMap.get(a.fridayIndex) || scheduleFridays[0]?.id || 1,
          fridayIndex: a.fridayIndex,
          mosqueId: a.mosqueId,
          imamId: a.imamId,
          source: a.source,
          isLocked: false,
        });
      }
    }

    // Refresh conflicts
    await db.delete(conflicts).where(eq(conflicts.scheduleId, scheduleId));
    if (result.conflicts.length > 0) {
      const conflictsToInsert = result.conflicts.map((c) => ({
        scheduleId,
        severity: c.severity,
        mosqueId: c.mosqueId,
        fridayIndex: c.fridayIndex,
        imamId: c.imamId,
        ruleCode: c.ruleCode,
        message: c.message,
        possibleResolutions: JSON.stringify(c.possibleResolutions),
      }));
      await db.insert(conflicts).values(conflictsToInsert);
    }

    // If schedule was approved, change to NEEDS_REAPPROVAL
    if (schedule.status === 'APPROVED' || schedule.status === 'PUBLISHED') {
      await db.update(monthlySchedules)
        .set({ status: 'NEEDS_REAPPROVAL', updatedAt: new Date() })
        .where(eq(monthlySchedules.id, scheduleId));
    }

    await logAudit(req, 'REDISTRIBUTE_SCHEDULE', 'SCHEDULE', scheduleId, { targetMosqueId, targetFridayIndex });
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر إعادة التوزيع', details: error.message });
  }
});

// Emergency Replacements Finder
api.post('/schedules/:id/emergency-replacements', async (req: Request, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { fridayIndex, mosqueId, currentImamId } = req.body;

    const allMosques = memoryStore.getMosques();
    const allImams = memoryStore.getImams();
    const allRules = memoryStore.getRules();
    const scheduleDetails = memoryStore.getScheduleDetails(scheduleId);

    const existingAssignments = scheduleDetails?.assignments || [];

    const replacements = SchedulingEngine.findEmergencyReplacements({
      scheduleId,
      fridayIndex: Number(fridayIndex),
      mosqueId: Number(mosqueId),
      currentImamId: currentImamId ? Number(currentImamId) : null,
      allMosques: allMosques.map((m: any) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        isActive: m.isActive,
        fixedImamId: m.fixedImamId,
        fixedPattern: m.fixedPattern,
        fixedCount: m.fixedCount,
      })),
      allImams: allImams.map((i: any) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        minFridays: i.minFridays,
        targetFridays: i.targetFridays,
        maxFridays: i.maxFridays,
        isActive: i.isActive,
        region: i.region,
      })),
      rules: allRules.map((r: any) => ({
        mosqueId: r.mosqueId,
        imamId: r.imamId,
        relationshipType: r.relationshipType,
        priority: r.priority || 1,
      })),
      existingAssignments: existingAssignments.map((a: any) => ({
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
      })),
      unavailabilities: [],
    });

    res.json({
      success: true,
      candidates: replacements,
      count: replacements.length,
    });
  } catch (error: any) {
    console.error('Error finding emergency replacements:', error);
    res.status(500).json({ error: 'تعذر استخراج المرشحين للطوارئ', details: error.message });
  }
});

// Manual assignment edit (Cell Drawer)
api.post('/schedules/:id/assignment', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { assignmentId, mosqueId, fridayIndex, newImamId, reason, isOverride } = req.body;

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    let assignmentRecord;
    if (assignmentId) {
      const [found] = await db.select().from(assignments).where(eq(assignments.id, Number(assignmentId)));
      assignmentRecord = found;
    } else {
      const [found] = await db.select().from(assignments).where(
        and(
          eq(assignments.scheduleId, scheduleId),
          eq(assignments.mosqueId, Number(mosqueId)),
          eq(assignments.fridayIndex, Number(fridayIndex))
        )
      );
      assignmentRecord = found;
    }

    if (!assignmentRecord) {
      return res.status(404).json({ error: 'التعيين غير موجود' });
    }

    const targetFridayIdx = assignmentRecord.fridayIndex;

    // Strict Temporal Policy Validation: Check Friday action
    const fridayValidation = CalendarService.validateFridayAction(
      schedule.hijriYear,
      schedule.hijriMonth,
      targetFridayIdx,
      {
        provider: (schedule.calendarProvider as any) || (cachedOrganizationSettings.calendarProvider as any) || 'UMM_AL_QURA',
        timezone: schedule.timezone || cachedOrganizationSettings.timezone || 'Asia/Riyadh',
      }
    );

    if (!fridayValidation.isAllowed) {
      return res.status(400).json({
        error: fridayValidation.reason || 'هذه الجمعة انتهت بالفعل ولا يمكن تعديل التعيين من خلال الجدولة الحالية. يمكنك الاطلاع عليها من سجل الجداول والتاريخ.',
        code: 'FRIDAY_PERIOD_PAST',
      });
    }

    const oldImamId = assignmentRecord.imamId;
    const targetImamId = newImamId ? Number(newImamId) : null;

    // Hard Constraint 1: Prevent assigning the same preacher to multiple mosques on the same Friday
    if (targetImamId) {
      const conflictingBooking = await db.select().from(assignments).where(
        and(
          eq(assignments.scheduleId, scheduleId),
          eq(assignments.fridayIndex, assignmentRecord.fridayIndex),
          eq(assignments.imamId, targetImamId),
          ne(assignments.id, assignmentRecord.id)
        )
      );
      if (conflictingBooking.length > 0) {
        const otherMosqueId = conflictingBooking[0].mosqueId;
        const [otherMosque] = await db.select().from(mosques).where(eq(mosques.id, otherMosqueId));
        return res.status(400).json({
          error: `تعارض حرج (Hard Constraint): لا يمكن تعيين نفس الخطيب في أكثر من مسجد في نفس الجمعة (الجمعة ${assignmentRecord.fridayIndex})! الخطيب مسند بالفعل في "${otherMosque?.name || `مسجد #${otherMosqueId}`}".`,
        });
      }

      // Hard Constraint 2: A preacher cannot exceed the month's total fridays
      const preacherMonthAssignments = await db.select().from(assignments).where(
        and(
          eq(assignments.scheduleId, scheduleId),
          eq(assignments.imamId, targetImamId),
          ne(assignments.id, assignmentRecord.id)
        )
      );
      if (preacherMonthAssignments.length >= schedule.fridaysCount) {
        return res.status(400).json({
          error: `تعارض حرج: الخطيب بلغ الحد الأقصى لجمعات الشهر (${schedule.fridaysCount} جمعات) ولا يمكن تكليفه بجمعة إضافية في هذا الشهر.`,
        });
      }
    }

    // Update assignment
    const [updated] = await db.update(assignments)
      .set({
        imamId: targetImamId,
        source: isOverride ? 'OVERRIDE' : 'MANUAL',
        isLocked: true, // manual edits default to locked
        updatedAt: new Date(),
      })
      .where(eq(assignments.id, assignmentRecord.id))
      .returning();

    // Record history
    await db.insert(assignmentHistory).values({
      scheduleId,
      assignmentId: assignmentRecord.id,
      oldImamId,
      newImamId: targetImamId,
      changedBy: req.user?.email || 'admin@aljameya.org',
      reason: reason || 'تعديل يدوي من شاشة المراجعة',
    });

    // Record override if flagged
    if (isOverride) {
      await db.insert(overrides).values({
        scheduleId,
        assignmentId: assignmentRecord.id,
        imamId: targetImamId,
        mosqueId: assignmentRecord.mosqueId,
        fridayIndex: assignmentRecord.fridayIndex,
        oldValue: oldImamId ? String(oldImamId) : 'لا يوجد',
        newValue: targetImamId ? String(targetImamId) : 'لا يوجد',
        reason: reason || 'استثناء إداري معتمد',
        createdBy: req.user?.email || 'مدير النظام',
      });
    }

    // Schedule status check
    if (schedule.status === 'APPROVED' || schedule.status === 'PUBLISHED') {
      await db.update(monthlySchedules)
        .set({ status: 'NEEDS_REAPPROVAL', updatedAt: new Date() })
        .where(eq(monthlySchedules.id, scheduleId));
    }

    await logAudit(req, 'MANUAL_ASSIGNMENT_CHANGE', 'ASSIGNMENT', assignmentRecord.id, {
      oldImamId,
      newImamId: targetImamId,
      reason,
    });

    res.json(updated);
  } catch (error: any) {
    console.warn('DB assignment update failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const { assignmentId, newImamId, reason } = req.body;
      const fallbackUpdated = memoryStore.updateAssignment(
        scheduleId,
        Number(assignmentId),
        newImamId ? Number(newImamId) : null,
        reason
      );
      if (fallbackUpdated) {
        return res.json(fallbackUpdated);
      }
    } catch (fbErr) {
      console.error('Fallback updateAssignment failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر تعديل التعيين', details: error.message });
  }
});

// Toggle Lock
api.post('/schedules/:id/lock-toggle', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { assignmentId } = req.body;
    const [found] = await db.select().from(assignments).where(eq(assignments.id, Number(assignmentId)));
    if (!found) return res.status(404).json({ error: 'التعيين غير موجود' });

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId || found.scheduleId));
    if (schedule) {
      const fCheck = CalendarService.validateFridayAction(
        schedule.hijriYear,
        schedule.hijriMonth,
        found.fridayIndex,
        { provider: schedule.calendarProvider as any, timezone: schedule.timezone }
      );
      if (!fCheck.isAllowed) {
        return res.status(400).json({
          error: 'هذه الجمعة انتهت بالفعل وهي مقفلة دائماً ولا يمكن تعديل قفلها.',
          code: 'FRIDAY_PERIOD_PAST',
        });
      }
    }

    const [updated] = await db.update(assignments)
      .set({ isLocked: !found.isLocked })
      .where(eq(assignments.id, found.id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    console.warn('DB toggle lock failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const { assignmentId } = req.body;
      const fallbackUpdated = memoryStore.toggleLock(scheduleId, Number(assignmentId));
      if (fallbackUpdated) {
        return res.json(fallbackUpdated);
      }
    } catch (fbErr) {
      console.error('Fallback toggleLock failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر تغيير حالة القفل', details: error.message });
  }
});

// Mutual Swap or Drag-and-Drop Move of Assignments
api.post('/schedules/:id/swap-assignments', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { sourceAssignmentId, targetAssignmentId, reason } = req.body;

    if (!sourceAssignmentId || !targetAssignmentId) {
      return res.status(400).json({ error: 'معرفات التعيينات المصدر والهدف مطلوبة' });
    }

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    const [sourceAssign] = await db.select().from(assignments).where(eq(assignments.id, Number(sourceAssignmentId)));
    const [targetAssign] = await db.select().from(assignments).where(eq(assignments.id, Number(targetAssignmentId)));

    if (!sourceAssign || !targetAssign) {
      return res.status(404).json({ error: 'أحد التعيينات غير موجود' });
    }

    // Constraint: Locked cells cannot be moved or swapped
    if (sourceAssign.isLocked || targetAssign.isLocked) {
      return res.status(400).json({ error: 'لا يمكن نقل أو تبديل خطيب في خلية مقفلة (Locked) 🔒' });
    }

    // Constraint: Past fridays cannot be modified
    const provider = (schedule.calendarProvider as any) || 'UMM_AL_QURA';
    const tz = schedule.timezone || 'Asia/Riyadh';
    const srcCheck = CalendarService.validateFridayAction(schedule.hijriYear, schedule.hijriMonth, sourceAssign.fridayIndex, { provider, timezone: tz });
    const tgtCheck = CalendarService.validateFridayAction(schedule.hijriYear, schedule.hijriMonth, targetAssign.fridayIndex, { provider, timezone: tz });

    if (!srcCheck.isAllowed || !tgtCheck.isAllowed) {
      return res.status(400).json({ error: 'لا يمكن تعديل جمعة منتهية بالفعل وفق السياسة الزمنية.' });
    }

    // If across DIFFERENT Fridays, ensure neither imam is booked in multiple mosques on the other Friday
    if (sourceAssign.fridayIndex !== targetAssign.fridayIndex) {
      if (sourceAssign.imamId) {
        const conflict = await db.select().from(assignments).where(
          and(
            eq(assignments.scheduleId, scheduleId),
            eq(assignments.fridayIndex, targetAssign.fridayIndex),
            eq(assignments.imamId, sourceAssign.imamId),
            ne(assignments.id, targetAssign.id)
          )
        );
        if (conflict.length > 0) {
          return res.status(400).json({ error: `الخطيب في المصدر مرتبط بالفعل بمسجد آخر في الجمعة ${targetAssign.fridayIndex}` });
        }
      }
      if (targetAssign.imamId) {
        const conflict = await db.select().from(assignments).where(
          and(
            eq(assignments.scheduleId, scheduleId),
            eq(assignments.fridayIndex, sourceAssign.fridayIndex),
            eq(assignments.imamId, targetAssign.imamId),
            ne(assignments.id, sourceAssign.id)
          )
        );
        if (conflict.length > 0) {
          return res.status(400).json({ error: `الخطيب في الهدف مرتبط بالفعل بمسجد آخر في الجمعة ${sourceAssign.fridayIndex}` });
        }
      }
    }

    // Execute swap
    const oldSourceImam = sourceAssign.imamId;
    const oldTargetImam = targetAssign.imamId;

    const [updatedSource] = await db.update(assignments)
      .set({ imamId: oldTargetImam, source: 'MANUAL', updatedAt: new Date() })
      .where(eq(assignments.id, sourceAssign.id))
      .returning();

    const [updatedTarget] = await db.update(assignments)
      .set({ imamId: oldSourceImam, source: 'MANUAL', updatedAt: new Date() })
      .where(eq(assignments.id, targetAssign.id))
      .returning();

    // Log history
    await db.insert(assignmentHistory).values([
      {
        scheduleId,
        assignmentId: sourceAssign.id,
        oldImamId: oldSourceImam,
        newImamId: oldTargetImam,
        changedBy: req.user?.email || 'admin@aljameya.org',
        reason: reason || 'تبديل تفاعلي بالسحب والإفلات (Drag & Drop)',
      },
      {
        scheduleId,
        assignmentId: targetAssign.id,
        oldImamId: oldTargetImam,
        newImamId: oldSourceImam,
        changedBy: req.user?.email || 'admin@aljameya.org',
        reason: reason || 'تبديل تفاعلي بالسحب والإفلات (Drag & Drop)',
      },
    ]);

    if (schedule.status === 'APPROVED' || schedule.status === 'PUBLISHED') {
      await db.update(monthlySchedules)
        .set({ status: 'NEEDS_REAPPROVAL', updatedAt: new Date() })
        .where(eq(monthlySchedules.id, scheduleId));
    }

    await logAudit(req, 'SWAP_ASSIGNMENTS', 'ASSIGNMENT', sourceAssign.id, {
      sourceAssignmentId,
      targetAssignmentId,
      sourceImam: oldSourceImam,
      targetImam: oldTargetImam,
    });

    res.json({ success: true, sourceAssignment: updatedSource, targetAssignment: updatedTarget });
  } catch (error: any) {
    console.warn('DB swap assignments failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const { sourceAssignmentId, targetAssignmentId, reason } = req.body;
      const fallbackResult = memoryStore.swapAssignments(
        scheduleId,
        Number(sourceAssignmentId),
        Number(targetAssignmentId),
        reason
      );
      if (fallbackResult) {
        return res.json({ success: true, ...fallbackResult });
      }
    } catch (fbErr) {
      console.error('Fallback swapAssignments failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر تبديل التكليفات', details: error.message });
  }
});

// Approve Schedule
api.post('/schedules/:id/approve', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const { approvedBy, note } = req.body;

    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    // Checklist check
    const currentAssignments = await db.select().from(assignments).where(eq(assignments.scheduleId, scheduleId));
    const emptyCount = currentAssignments.filter((a) => !a.imamId).length;
    if (emptyCount > 0) {
      return res.status(400).json({
        error: `لا يمكن اعتماد الجدول: يوجد ${emptyCount} مسجداً بدون خطيب`,
      });
    }

    // Hard Constraint Check 1: Ensure no preacher is booked in two mosques on the same Friday
    const preacherFridayMap = new Map<string, number>();
    for (const a of currentAssignments) {
      if (a.imamId) {
        const key = `${a.imamId}:${a.fridayIndex}`;
        if (preacherFridayMap.has(key)) {
          const otherMosqueId = preacherFridayMap.get(key);
          return res.status(400).json({
            error: `تعارض حرج يمنع الاعتماد: الخطيب #${a.imamId} تم تعيينه في أكثر من مسجد في الجمعة (${a.fridayIndex}) - مسجدي #${otherMosqueId} و #${a.mosqueId}`,
          });
        }
        preacherFridayMap.set(key, a.mosqueId);
      }
    }

    // Hard Constraint Check 2: Ensure no preacher exceeds the total fridays of the month
    const preacherCountMap = new Map<number, number>();
    for (const a of currentAssignments) {
      if (a.imamId) {
        const count = (preacherCountMap.get(a.imamId) || 0) + 1;
        preacherCountMap.set(a.imamId, count);
        if (count > schedule.fridaysCount) {
          return res.status(400).json({
            error: `تعارض حرج يمنع الاعتماد: الخطيب #${a.imamId} تم تكليفه بـ ${count} جمعات بينما الشهر يحتوي على ${schedule.fridaysCount} جمعات فقط!`,
          });
        }
      }
    }

    const currentConflicts = await db.select().from(conflicts).where(eq(conflicts.scheduleId, scheduleId));
    const criticalConflicts = currentConflicts.filter((c) => c.severity === 'CRITICAL');
    if (criticalConflicts.length > 0) {
      return res.status(400).json({
        error: `لا يمكن اعتماد الجدول: يوجد ${criticalConflicts.length} تعارضات حرجة بحاجة لحل أولاً`,
      });
    }

    const nextVersion = schedule.currentVersion + 1;

    // Snapshot version
    await db.insert(scheduleVersions).values({
      scheduleId,
      versionNumber: nextVersion,
      snapshotJson: JSON.stringify({
        assignments: currentAssignments,
        conflicts: currentConflicts,
      }),
      note: note || `اعتماد رسمي للإصدار ${nextVersion}`,
    });

    const [approved] = await db.update(monthlySchedules)
      .set({
        status: 'APPROVED',
        currentVersion: nextVersion,
        approvedBy: approvedBy || req.user?.email || 'مدير الشؤون الدينية',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(monthlySchedules.id, scheduleId))
      .returning();

    await logAudit(req, 'APPROVE_SCHEDULE', 'SCHEDULE', scheduleId, { version: nextVersion });
    res.json(approved);
  } catch (error: any) {
    console.warn('DB approve schedule failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const fallbackApproved = memoryStore.approveSchedule(scheduleId);
      if (fallbackApproved) {
        return res.json(fallbackApproved);
      }
    } catch (fbErr) {
      console.error('Fallback approveSchedule failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر اعتماد الجدول', details: error.message });
  }
});

// Publish Schedule
api.post('/schedules/:id/publish', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.id);
    const [schedule] = await db.select().from(monthlySchedules).where(eq(monthlySchedules.id, scheduleId));
    if (!schedule) return res.status(404).json({ error: 'الجدول غير موجود' });

    if (schedule.status !== 'APPROVED') {
      return res.status(400).json({ error: 'لا يمكن نشر جدول لم يتم اعتماده رسمياً' });
    }

    // Populate distribution logs for all active mosques and imams
    const activeMosques = await db.select().from(mosques).where(eq(mosques.isActive, true));
    const activeImams = await db.select().from(imams).where(eq(imams.isActive, true));

    // Clear old distribution logs for this schedule
    await db.delete(distributionLogs).where(eq(distributionLogs.scheduleId, scheduleId));

    const logsToInsert: any[] = [];
    for (const m of activeMosques) {
      logsToInsert.push({
        scheduleId,
        recipientType: 'MOSQUE',
        recipientId: m.id,
        recipientName: m.name,
        phone: m.whatsapp || m.phone || null,
        status: (m.whatsapp || m.phone) ? 'READY' : 'MISSING_PHONE',
      });
    }

    for (const i of activeImams) {
      logsToInsert.push({
        scheduleId,
        recipientType: 'IMAM',
        recipientId: i.id,
        recipientName: i.name,
        phone: i.whatsapp || i.phone || null,
        status: (i.whatsapp || i.phone) ? 'READY' : 'MISSING_PHONE',
      });
    }

    if (logsToInsert.length > 0) {
      await db.insert(distributionLogs).values(logsToInsert);
    }

    const [published] = await db.update(monthlySchedules)
      .set({
        status: 'PUBLISHED',
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(monthlySchedules.id, scheduleId))
      .returning();

    await logAudit(req, 'PUBLISH_SCHEDULE', 'SCHEDULE', scheduleId);
    res.json({ success: true, published, recipientsCount: logsToInsert.length });
  } catch (error: any) {
    console.warn('DB publish schedule failed, falling back to memoryStore:', error?.message);
    try {
      const scheduleId = Number(req.params.id);
      const fallbackPublished = memoryStore.publishSchedule(scheduleId);
      if (fallbackPublished) {
        return res.json({ success: true, published: fallbackPublished, recipientsCount: 0 });
      }
    } catch (fbErr) {
      console.error('Fallback publishSchedule failed:', fbErr);
    }
    res.status(500).json({ error: 'تعذر نشر الجدول', details: error.message });
  }
});

// -------------------------------------------------------------
// 5. Distribution & WhatsApp Endpoints
// -------------------------------------------------------------
api.get('/distribution/:scheduleId', async (req: Request, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const logs = await db.select().from(distributionLogs).where(eq(distributionLogs.scheduleId, scheduleId));
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر جلب سجلات التوزيع', details: error.message });
  }
});

api.post('/distribution/:scheduleId/dispatch-all', async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const readyLogs = await db.select().from(distributionLogs).where(
      and(eq(distributionLogs.scheduleId, scheduleId), eq(distributionLogs.status, 'READY'))
    );

    let sentCount = 0;
    for (const log of readyLogs) {
      await db.update(distributionLogs)
        .set({ status: 'SENT', sentAt: new Date() })
        .where(eq(distributionLogs.id, log.id));
      sentCount++;
    }

    await logAudit(req, 'DISPATCH_WHATSAPP_ALL', 'DISTRIBUTION', scheduleId, { sentCount });
    res.json({ success: true, sentCount });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر تنفيذ الإرسال', details: error.message });
  }
});

api.patch('/distribution/log/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status, errorMessage } = req.body;

    const [updated] = await db.update(distributionLogs)
      .set({
        status,
        errorMessage,
        sentAt: status === 'SENT' ? new Date() : undefined,
      })
      .where(eq(distributionLogs.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر تحديث المستلم', details: error.message });
  }
});

// -------------------------------------------------------------
// 6. Reports & Audit Trail
// -------------------------------------------------------------
api.get('/reports/summary', async (_req: Request, res: Response) => {
  try {
    const allAssignments = await db.select().from(assignments);
    const allImams = await db.select().from(imams);
    const allMosques = await db.select().from(mosques);
    const allConflicts = await db.select().from(conflicts);
    const allOverrides = await db.select().from(overrides);
    const allHistory = await db.select().from(assignmentHistory);

    // Imam loads
    const imamLoads = allImams.map((i) => {
      const assigned = allAssignments.filter((a) => a.imamId === i.id).length;
      return {
        id: i.id,
        name: i.name,
        type: i.type,
        min: i.minFridays,
        target: i.targetFridays,
        max: i.maxFridays,
        assigned,
        status: assigned < i.minFridays ? 'UNDER' : assigned > i.maxFridays ? 'OVER' : 'BALANCED',
      };
    });

    // Mosque distribution
    const mosqueLoads = allMosques.map((m) => {
      const assignedCount = allAssignments.filter((a) => a.mosqueId === m.id).length;
      return {
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        assignedCount,
      };
    });

    res.json({
      imamLoads,
      mosqueLoads,
      totalConflicts: allConflicts.length,
      criticalConflicts: allConflicts.filter((c) => c.severity === 'CRITICAL').length,
      warningConflicts: allConflicts.filter((c) => c.severity === 'WARNING').length,
      overridesCount: allOverrides.length,
      manualChangesCount: allHistory.length,
    });
  } catch (error: any) {
    console.warn('DB fetch for reports summary failed, falling back to memory store:', error?.message);
    res.json(memoryStore.getReportsSummary());
  }
});

api.get('/audit-logs', async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
    res.json(logs);
  } catch (error: any) {
    console.warn('DB fetch for audit-logs failed, falling back to memory store:', error?.message);
    res.json(memoryStore.getAuditLogs());
  }
});

// -------------------------------------------------------------
// 7. Advanced Import / Export Engine & Management Center
// -------------------------------------------------------------

// 7.1 Import Preview & Validation Endpoint
api.post('/import-export/preview', async (req: AuthRequest, res: Response) => {
  try {
    const {
      entityType = 'MOSQUES',
      rawRows = [],
      fileName = 'uploaded_data.xlsx',
      fileFormat = 'XLSX',
      customMappings = [],
    } = req.body;

    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return res.status(400).json({ error: 'الملف المرفوع فارغ أو لا يحتوي على صفوف صالحة للقراءة' });
    }

    const batchId = `IMPORT-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;
    const allUnits = await db.select().from(administrativeUnits);
    const fileHeaders = Object.keys(rawRows[0] || {});

    // Compute column mappings and auto-detect entity type
    const autoRes = autoMapHeaders(fileHeaders, entityType);
    const effectiveEntityType = autoRes.detectedEntityType;
    let columnMappings = customMappings;
    if (!columnMappings || columnMappings.length === 0) {
      columnMappings = autoRes.columnMappings;
    }

    // Existing entities for duplicate detection
    const existingMosques = await db.select().from(mosques);
    const existingImams = await db.select().from(imams);

    const parsedRows: ParsedImportRow[] = [];
    let newCount = 0;
    let updateCount = 0;
    let reviewCount = 0;
    let errorCount = 0;

    for (let idx = 0; idx < rawRows.length; idx++) {
      const raw = rawRows[idx];
      const rowNum = idx + 2; // Excel row numbering (1-indexed + header)
      const mappedData: Record<string, any> = {};

      for (const m of columnMappings) {
        if (m.targetField && raw[m.fileHeader] !== undefined) {
          const val = typeof raw[m.fileHeader] === 'string' ? raw[m.fileHeader].trim() : raw[m.fileHeader];
          mappedData[m.targetField] = val;
        }
      }

      const errors: string[] = [];
      const warnings: string[] = [];
      let status: any = 'NEW';
      let targetId: number | undefined = undefined;
      let matchedBy: any = undefined;
      const diffSummary: any[] = [];

      // Hierarchy Matcher
      const adminMatch = matchAdministrativeHierarchy(
        {
          country: mappedData.country,
          countryId: mappedData.countryId ? Number(mappedData.countryId) : undefined,
          governorate: mappedData.governorate,
          governorateId: mappedData.governorateId ? Number(mappedData.governorateId) : undefined,
          district: mappedData.district,
          districtId: mappedData.districtId ? Number(mappedData.districtId) : undefined,
          city: mappedData.city,
          area: mappedData.area,
          areaId: mappedData.areaId ? Number(mappedData.areaId) : undefined,
          street: mappedData.street,
          buildingNumber: mappedData.buildingNumber,
          landmark: mappedData.landmark,
        },
        allUnits
      );

      if (adminMatch.needsReview) {
        warnings.push(adminMatch.reviewReason || 'يحتاج مطابقة إدارية');
      }

      if (effectiveEntityType === 'MOSQUES') {
        const name = mappedData.name || '';
        let code = mappedData.code || '';

        if (!name) {
          errors.push('اسم المسجد حقل إجباري مطلوب');
        }

        if (mappedData.phone && !isValidEgyptianPhone(mappedData.phone)) {
          errors.push(`رقم هاتف غير صالح (${mappedData.phone})`);
        }

        // Duplicate identification
        let existing: any = null;
        if (code) {
          existing = existingMosques.find((m) => m.code.toLowerCase() === String(code).toLowerCase());
          if (existing) matchedBy = 'CODE';
        }
        if (!existing && name) {
          const normName = normalizeArabicText(name);
          existing = existingMosques.find((m) => normalizeArabicText(m.name) === normName);
          if (existing) matchedBy = 'NAME_ADDRESS';
        }

        if (existing) {
          status = 'UPDATE';
          targetId = existing.id;
          if (!code) code = existing.code;

          // Diff calculation (Blank != Delete)
          if (name && name !== existing.name) {
            diffSummary.push({ field: 'name', label: 'اسم المسجد', oldValue: existing.name, newValue: name });
          }
          if (mappedData.phone && mappedData.phone !== existing.phone) {
            diffSummary.push({ field: 'phone', label: 'الهاتف', oldValue: existing.phone || '—', newValue: mappedData.phone });
          }
          if (mappedData.managerName && mappedData.managerName !== existing.managerName) {
            diffSummary.push({ field: 'managerName', label: 'اسم المشرف', oldValue: existing.managerName || '—', newValue: mappedData.managerName });
          }
          if (adminMatch.governorateId !== existing.governorateId) {
            diffSummary.push({ field: 'governorateId', label: 'المحافظة', oldValue: existing.region || '—', newValue: adminMatch.governorateName });
          }
        } else {
          status = adminMatch.needsReview ? 'NEEDS_REVIEW' : 'NEW';
          if (!code) {
            code = `MSQ-${Math.floor(100 + Math.random() * 900)}`;
          }
        }

        if (errors.length > 0) {
          status = 'ERROR';
          errorCount++;
        } else if (status === 'UPDATE') {
          updateCount++;
        } else if (status === 'NEEDS_REVIEW') {
          reviewCount++;
        } else {
          newCount++;
        }

        parsedRows.push({
          rowNumber: rowNum,
          raw,
          status,
          targetId,
          matchedBy,
          entityCode: code,
          displayName: name || `مسجد صف #${rowNum}`,
          data: {
            ...mappedData,
            code,
            name,
            phone: normalizePhoneNumber(mappedData.phone),
            whatsapp: normalizePhoneNumber(mappedData.whatsapp || mappedData.phone),
            formattedAddress: mappedData.formattedAddress || adminMatch.formattedAddress,
            countryId: adminMatch.countryId,
            governorateId: adminMatch.governorateId,
            districtId: adminMatch.districtId,
            areaId: adminMatch.areaId,
            region: adminMatch.areaName || adminMatch.districtName || adminMatch.governorateName || 'منشأة البكاري',
            isActive: mappedData.status !== undefined ? (String(mappedData.status).toLowerCase().includes('غير') ? false : true) : true,
          },
          diffSummary,
          adminMatch,
          errors,
          warnings,
        });
      } else {
        // PREACHERS (IMAMS)
        const name = mappedData.name || '';
        let code = mappedData.code || '';
        const rawPhone = mappedData.phone || '';
        const cleanPhone = normalizePhoneNumber(rawPhone);

        if (!name) {
          errors.push('اسم الخطيب حقل إجباري مطلوب');
        }

        if (rawPhone && !isValidEgyptianPhone(rawPhone)) {
          errors.push(`رقم هاتف غير صالح (${rawPhone})`);
        }

        // Duplicate identification
        let existing: any = null;
        if (code) {
          existing = existingImams.find((i) => (i as any).code && (i as any).code === code);
          if (existing) matchedBy = 'CODE';
        }
        if (!existing && cleanPhone) {
          existing = existingImams.find((i) => i.phone && normalizePhoneNumber(i.phone) === cleanPhone);
          if (existing) matchedBy = 'PHONE';
        }
        if (!existing && name) {
          const normName = normalizeArabicText(name);
          existing = existingImams.find((i) => normalizeArabicText(i.name) === normName);
          if (existing) matchedBy = 'NAME_PHONE';
        }

        if (existing) {
          status = 'UPDATE';
          targetId = existing.id;
          if (name && name !== existing.name) {
            diffSummary.push({ field: 'name', label: 'اسم الخطيب', oldValue: existing.name, newValue: name });
          }
          if (cleanPhone && cleanPhone !== existing.phone) {
            diffSummary.push({ field: 'phone', label: 'الهاتف', oldValue: existing.phone || '—', newValue: cleanPhone });
          }
          if (mappedData.type && mappedData.type !== existing.type) {
            diffSummary.push({ field: 'type', label: 'نوع الخطيب', oldValue: existing.type, newValue: mappedData.type });
          }
        } else {
          status = adminMatch.needsReview ? 'NEEDS_REVIEW' : 'NEW';
          if (!code) {
            code = `PRE-${Math.floor(100 + Math.random() * 900)}`;
          }
        }

        if (errors.length > 0) {
          status = 'ERROR';
          errorCount++;
        } else if (status === 'UPDATE') {
          updateCount++;
        } else if (status === 'NEEDS_REVIEW') {
          reviewCount++;
        } else {
          newCount++;
        }

        // Parse Preacher Type
        let pType = 'FLEXIBLE';
        if (mappedData.type) {
          const normT = String(mappedData.type).trim();
          if (normT.includes('جزئي') || normT.includes('PARTIAL')) pType = 'PARTIAL_FIXED';
          else if (normT.includes('ثابت') || normT.includes('FIXED')) pType = 'FIXED';
        }

        parsedRows.push({
          rowNumber: rowNum,
          raw,
          status,
          targetId,
          matchedBy,
          entityCode: code,
          displayName: name || `خطيب صف #${rowNum}`,
          data: {
            ...mappedData,
            code,
            name,
            type: pType,
            minFridays: mappedData.minFridays ? Number(mappedData.minFridays) : 1,
            targetFridays: mappedData.targetFridays ? Number(mappedData.targetFridays) : 4,
            maxFridays: mappedData.maxFridays ? Number(mappedData.maxFridays) : 5,
            phone: cleanPhone || mappedData.phone || '',
            whatsapp: normalizePhoneNumber(mappedData.whatsapp || rawPhone),
            formattedAddress: mappedData.formattedAddress || adminMatch.formattedAddress,
            countryId: adminMatch.countryId,
            governorateId: adminMatch.governorateId,
            districtId: adminMatch.districtId,
            areaId: adminMatch.areaId,
            region: adminMatch.areaName || adminMatch.districtName || 'منشأة البكاري',
            isActive: mappedData.status !== undefined ? (String(mappedData.status).toLowerCase().includes('غير') ? false : true) : true,
          },
          diffSummary,
          adminMatch,
          errors,
          warnings,
        });
      }
    }

    const previewResult: ImportPreviewResult = {
      batchId,
      entityType: effectiveEntityType,
      fileName,
      fileFormat,
      totalRows: parsedRows.length,
      newCount,
      updateCount,
      reviewCount,
      errorCount,
      columnMappings,
      unmappedHeaders: [],
      rows: parsedRows,
    };

    res.json(previewResult);
  } catch (error: any) {
    console.error('Import preview error:', error);
    res.status(500).json({ error: 'تعذر تحليل ومعاينة ملف الاستيراد', details: error.message });
  }
});

// 7.2 Import Execution with Backup Snapshot & Transactional Upsert
api.post('/import-export/execute', async (req: AuthRequest, res: Response) => {
  try {
    const {
      batchId,
      entityType = 'MOSQUES',
      fileName = 'data.xlsx',
      fileFormat = 'XLSX',
      mode = 'UPSERT',
      rows = [],
    } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'لا توجد صفوف لتنفيذ الاستيراد' });
    }

    // 1. Create Backup Snapshot prior to mutation
    try {
      const currentSnapshot = entityType === 'MOSQUES'
        ? await db.select().from(mosques)
        : await db.select().from(imams);

      await db.insert(importSnapshots).values({
        batchId: batchId || `BATCH-${Date.now()}`,
        entityType,
        snapshotJson: JSON.stringify(currentSnapshot),
      });
    } catch (snapErr) {
      console.warn('Could not store import snapshot:', snapErr);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errorReport: any[] = [];

    // 2. Process rows
    for (const row of rows) {
      // If row has critical validation errors, log to errorReport
      if (row.status === 'ERROR' || (row.errors && row.errors.length > 0)) {
        errorCount++;
        errorReport.push({
          rowNumber: row.rowNumber,
          code: row.entityCode,
          name: row.displayName,
          field: 'validation',
          rawValue: JSON.stringify(row.raw),
          errorMessage: row.errors.join(' · '),
        });
        continue;
      }

      // Check Import Mode constraints
      if (mode === 'INSERT_ONLY' && row.status === 'UPDATE') {
        skippedCount++;
        continue;
      }
      if (mode === 'UPDATE_ONLY' && (row.status === 'NEW' || row.status === 'NEEDS_REVIEW')) {
        skippedCount++;
        continue;
      }

      try {
        if (entityType === 'MOSQUES') {
          const d = row.data;
          if (row.targetId && (row.status === 'UPDATE' || mode === 'UPDATE_ONLY')) {
            // Update existing (Blank != Delete)
            const [existing] = await db.select().from(mosques).where(eq(mosques.id, row.targetId));
            if (existing) {
              const patchPayload: Record<string, any> = {};
              if (d.name) patchPayload.name = d.name;
              if (d.phone !== undefined && d.phone !== '') patchPayload.phone = d.phone;
              if (d.whatsapp !== undefined && d.whatsapp !== '') patchPayload.whatsapp = d.whatsapp;
              if (d.managerName !== undefined && d.managerName !== '') patchPayload.managerName = d.managerName;
              if (d.region) patchPayload.region = d.region;
              if (d.formattedAddress) patchPayload.formattedAddress = d.formattedAddress;
              if (d.countryId) patchPayload.countryId = d.countryId;
              if (d.governorateId) patchPayload.governorateId = d.governorateId;
              if (d.districtId) patchPayload.districtId = d.districtId;
              if (d.areaId) patchPayload.areaId = d.areaId;
              if (d.street) patchPayload.street = d.street;
              if (d.buildingNumber) patchPayload.buildingNumber = d.buildingNumber;
              if (d.landmark) patchPayload.landmark = d.landmark;
              if (d.latitude) patchPayload.latitude = String(d.latitude);
              if (d.longitude) patchPayload.longitude = String(d.longitude);
              if (d.isActive !== undefined) patchPayload.isActive = Boolean(d.isActive);
              if (d.notes) patchPayload.notes = d.notes;

              await db.update(mosques).set(patchPayload).where(eq(mosques.id, row.targetId));
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Insert New Mosque
            // Ensure unique code
            let finalCode = d.code;
            const duplicateCode = await db.select().from(mosques).where(eq(mosques.code, finalCode));
            if (duplicateCode.length > 0) {
              finalCode = `${d.code}-${Math.floor(10 + Math.random() * 90)}`;
            }

            await db.insert(mosques).values({
              name: d.name,
              code: finalCode,
              region: d.region || 'منشأة البكاري',
              address: d.formattedAddress || 'منشأة البكاري، حي الهرم، الجيزة',
              formattedAddress: d.formattedAddress || 'منشأة البكاري، حي الهرم، الجيزة',
              countryId: d.countryId || 1,
              governorateId: d.governorateId || 1,
              districtId: d.districtId || 101,
              areaId: d.areaId || 1001,
              street: d.street || '',
              buildingNumber: d.buildingNumber || '',
              landmark: d.landmark || '',
              latitude: d.latitude ? String(d.latitude) : '',
              longitude: d.longitude ? String(d.longitude) : '',
              managerName: d.managerName || '',
              phone: d.phone || '',
              whatsapp: d.whatsapp || '',
              isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
              notes: d.notes || '',
            });
            createdCount++;
          }
        } else {
          // PREACHERS (IMAMS)
          const d = row.data;
          if (row.targetId && (row.status === 'UPDATE' || mode === 'UPDATE_ONLY')) {
            const [existing] = await db.select().from(imams).where(eq(imams.id, row.targetId));
            if (existing) {
              const patchPayload: Record<string, any> = {};
              if (d.name) patchPayload.name = d.name;
              if (d.phone !== undefined && d.phone !== '') patchPayload.phone = d.phone;
              if (d.whatsapp !== undefined && d.whatsapp !== '') patchPayload.whatsapp = d.whatsapp;
              if (d.type) patchPayload.type = d.type;
              if (d.minFridays !== undefined) patchPayload.minFridays = Number(d.minFridays);
              if (d.targetFridays !== undefined) patchPayload.targetFridays = Number(d.targetFridays);
              if (d.maxFridays !== undefined) patchPayload.maxFridays = Number(d.maxFridays);
              if (d.region) patchPayload.region = d.region;
              if (d.formattedAddress) patchPayload.formattedAddress = d.formattedAddress;
              if (d.countryId) patchPayload.countryId = d.countryId;
              if (d.governorateId) patchPayload.governorateId = d.governorateId;
              if (d.districtId) patchPayload.districtId = d.districtId;
              if (d.areaId) patchPayload.areaId = d.areaId;
              if (d.street) patchPayload.street = d.street;
              if (d.buildingNumber) patchPayload.buildingNumber = d.buildingNumber;
              if (d.landmark) patchPayload.landmark = d.landmark;
              if (d.isActive !== undefined) patchPayload.isActive = Boolean(d.isActive);
              if (d.notes) patchPayload.notes = d.notes;

              await db.update(imams).set(patchPayload).where(eq(imams.id, row.targetId));
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else {
            // Insert New Imam
            await db.insert(imams).values({
              name: d.name,
              type: d.type || 'FLEXIBLE',
              minFridays: d.minFridays ? Number(d.minFridays) : 1,
              targetFridays: d.targetFridays ? Number(d.targetFridays) : 4,
              maxFridays: d.maxFridays ? Number(d.maxFridays) : 5,
              phone: d.phone || '',
              whatsapp: d.whatsapp || '',
              region: d.region || 'منشأة البكاري',
              address: d.formattedAddress || 'منشأة البكاري، حي الهرم، الجيزة',
              formattedAddress: d.formattedAddress || 'منشأة البكاري، حي الهرم، الجيزة',
              countryId: d.countryId || 1,
              governorateId: d.governorateId || 1,
              districtId: d.districtId || 101,
              areaId: d.areaId || 1001,
              street: d.street || '',
              buildingNumber: d.buildingNumber || '',
              landmark: d.landmark || '',
              isActive: d.isActive !== undefined ? Boolean(d.isActive) : true,
              notes: d.notes || '',
            });
            createdCount++;
          }
        }
      } catch (rowErr: any) {
        errorCount++;
        errorReport.push({
          rowNumber: row.rowNumber,
          code: row.entityCode,
          name: row.displayName,
          field: 'execution',
          rawValue: JSON.stringify(row.data),
          errorMessage: rowErr.message || 'خطأ أثناء الحفظ في قاعدة البيانات',
        });
      }
    }

    const logStatus = errorCount === 0 ? 'COMPLETED' : createdCount + updatedCount > 0 ? 'COMPLETED_WITH_WARNINGS' : 'FAILED';

    // 3. Store in Import/Export Log
    await db.insert(importExportLogs).values({
      batchId: batchId || `BATCH-${Date.now()}`,
      operationType: 'IMPORT',
      entityType,
      fileName,
      fileFormat,
      userEmail: req.user?.email || 'admin@aljameya.org',
      mode,
      status: logStatus,
      totalRows: rows.length,
      createdRows: createdCount,
      updatedRows: updatedCount,
      skippedRows: skippedCount,
      errorRows: errorCount,
      summaryJson: JSON.stringify({ created: createdCount, updated: updatedCount, skipped: skippedCount, errors: errorCount }),
      errorReportJson: errorReport.length > 0 ? JSON.stringify(errorReport) : null,
      completedAt: new Date(),
    });

    await logAudit(req, 'EXECUTE_IMPORT', entityType, undefined, {
      batchId,
      mode,
      createdCount,
      updatedCount,
      skippedCount,
      errorCount,
    });

    res.json({
      batchId,
      success: true,
      message: `اكتملت عملية الاستيراد بنجاح (تم إنشاء: ${createdCount}، تم تحديث: ${updatedCount}، تم تخطي: ${skippedCount}، أخطاء: ${errorCount})`,
      totalRows: rows.length,
      createdRows: createdCount,
      updatedRows: updatedCount,
      skippedRows: skippedCount,
      errorRows: errorCount,
      errorReport: errorReport.length > 0 ? errorReport : undefined,
    });
  } catch (error: any) {
    console.error('Import execution error:', error);
    res.status(500).json({ error: 'تعذر تنفيذ عملية الاستيراد', details: error.message });
  }
});

// 7.3 Export Data Endpoint (XLSX & UTF-8 BOM CSV)
api.post('/import-export/export', async (req: AuthRequest, res: Response) => {
  try {
    const {
      entityType = 'MOSQUES',
      format = 'XLSX',
      scope = 'ALL',
      governorateId,
      districtId,
      areaId,
      selectedIds = [],
      singleEntityId,
    } = req.body;

    const allUnits = await db.select().from(administrativeUnits);
    const unitMap = new Map(allUnits.map((u) => [u.id, u]));

    if (entityType === 'MOSQUES') {
      let query = db.select().from(mosques);
      let mosqueList = await query;

      // Apply Filters
      if (singleEntityId) {
        mosqueList = mosqueList.filter((m) => m.id === Number(singleEntityId));
      } else if (selectedIds && selectedIds.length > 0) {
        mosqueList = mosqueList.filter((m) => selectedIds.includes(m.id));
      } else if (scope === 'ACTIVE') {
        mosqueList = mosqueList.filter((m) => m.isActive);
      } else if (scope === 'INACTIVE') {
        mosqueList = mosqueList.filter((m) => !m.isActive);
      } else if (scope === 'GOVERNORATE' && governorateId) {
        mosqueList = mosqueList.filter((m) => m.governorateId === Number(governorateId));
      } else if (scope === 'DISTRICT' && districtId) {
        mosqueList = mosqueList.filter((m) => m.districtId === Number(districtId));
      } else if (scope === 'AREA' && areaId) {
        mosqueList = mosqueList.filter((m) => m.areaId === Number(areaId));
      }

      // Format Export Rows
      const rows = mosqueList.map((m) => {
        const gov = m.governorateId ? unitMap.get(m.governorateId)?.nameAr || 'الجيزة' : 'الجيزة';
        const dist = m.districtId ? unitMap.get(m.districtId)?.nameAr || 'الهرم' : 'الهرم';
        const area = m.areaId ? unitMap.get(m.areaId)?.nameAr || m.region : m.region;

        return {
          'كود المسجد': m.code,
          'اسم المسجد': m.name,
          'الحالة': m.isActive ? 'نشط' : 'غير نشط',
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': gov,
          'الحي / القسم': dist,
          'المنطقة / الشياخة': area,
          'الشارع': m.street || '',
          'رقم المبنى': m.buildingNumber || '',
          'العلامة المميزة': m.landmark || '',
          'العنوان التفصيلي الكامل': m.formattedAddress || m.address || '',
          'اسم المسؤول': m.managerName || '',
          'هاتف المسجد / المسؤول': m.phone ? `'${m.phone}` : '',
          'واتساب': m.whatsapp ? `'${m.whatsapp}` : '',
          'خط العرض': m.latitude || '',
          'خط الطول': m.longitude || '',
          'الملاحظات': m.notes || '',
          'كود المحافظة الداخلي': m.governorateId || 1,
          'كود الحي الداخلي': m.districtId || 101,
          'كود المنطقة الداخلي': m.areaId || 1001,
        };
      });

      const fileName = `mosques_export_${Date.now()}.${format === 'CSV' ? 'csv' : 'xlsx'}`;

      if (format === 'CSV') {
        const csvBytes = buildCsvWithBom(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(csvBytes));
      } else {
        const xlsxBuffer = buildExcelWorkbook([
          { name: 'المساجد والجوامع', data: rows },
          {
            name: 'دليل التقسيم الإداري المصري',
            data: allUnits.map((u) => ({
              'كود الوحدة': u.id,
              'الاسم بالعربية': u.nameAr,
              'النوع': u.type,
              'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
              'الكود الإداري': u.code || '',
            })),
          },
        ]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(xlsxBuffer));
      }
    } else if (entityType === 'IMAMS' || entityType === 'PREACHERS') {
      // PREACHERS EXPORT ONLY
      let query = db.select().from(imams);
      let imamList = await query;

      if (singleEntityId) {
        imamList = imamList.filter((i) => i.id === Number(singleEntityId));
      } else if (selectedIds && selectedIds.length > 0) {
        imamList = imamList.filter((i) => selectedIds.includes(i.id));
      } else if (scope === 'ACTIVE') {
        imamList = imamList.filter((i) => i.isActive);
      } else if (scope === 'INACTIVE') {
        imamList = imamList.filter((i) => !i.isActive);
      }

      const rows = imamList.map((i) => {
        const gov = i.governorateId ? unitMap.get(i.governorateId)?.nameAr || 'الجيزة' : 'الجيزة';
        const dist = i.districtId ? unitMap.get(i.districtId)?.nameAr || 'الهرم' : 'الهرم';
        const area = i.areaId ? unitMap.get(i.areaId)?.nameAr || i.region : i.region;

        return {
          'كود الخطيب': `PRE-${i.id}`,
          'اسم الخطيب': i.name,
          'نوع الخطيب': i.type === 'FIXED' ? 'ثابت' : i.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن',
          'الحالة': i.isActive ? 'نشط' : 'غير نشط',
          'الهاتف': i.phone ? `'${i.phone}` : '',
          'واتساب': i.whatsapp ? `'${i.whatsapp}` : '',
          'الحد الأدنى للجمعات': i.minFridays,
          'العدد المستهدف': i.targetFridays,
          'الحد الأقصى للجمعات': i.maxFridays,
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': gov,
          'الحي / القسم': dist,
          'المنطقة / الشياخة': area,
          'العنوان التفصيلي': i.formattedAddress || i.address || '',
          'الملاحظات': i.notes || '',
          'كود المحافظة الداخلي': i.governorateId || 1,
          'كود الحي الداخلي': i.districtId || 101,
          'كود المنطقة الداخلي': i.areaId || 1001,
        };
      });

      const fileName = `preachers_export_${Date.now()}.${format === 'CSV' ? 'csv' : 'xlsx'}`;

      if (format === 'CSV') {
        const csvBytes = buildCsvWithBom(rows);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(csvBytes));
      } else {
        const xlsxBuffer = buildExcelWorkbook([
          { name: 'سجل الخطباء والدعاة', data: rows },
          {
            name: 'دليل التقسيم الإداري المصري',
            data: allUnits.map((u) => ({
              'كود الوحدة': u.id,
              'الاسم بالعربية': u.nameAr,
              'النوع': u.type,
              'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
            })),
          },
        ]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(xlsxBuffer));
      }
    } else {
      // FULL COMBINED EXPORT (MOSQUES + PREACHERS)
      const mosqueList = await db.select().from(mosques);
      const imamList = await db.select().from(imams);

      const mosqueRows = mosqueList.map((m) => {
        const gov = m.governorateId ? unitMap.get(m.governorateId)?.nameAr || 'الجيزة' : 'الجيزة';
        const dist = m.districtId ? unitMap.get(m.districtId)?.nameAr || 'الهرم' : 'الهرم';
        const area = m.areaId ? unitMap.get(m.areaId)?.nameAr || m.region : m.region;

        return {
          'كود المسجد': m.code,
          'اسم المسجد': m.name,
          'الحالة': m.isActive ? 'نشط' : 'غير نشط',
          'المحافظة': gov,
          'الحي / القسم': dist,
          'المنطقة / الشياخة': area,
          'اسم المسؤول': m.managerName || '',
          'هاتف المسجد / المسؤول': m.phone ? `'${m.phone}` : '',
          'العنوان التفصيلي': m.formattedAddress || m.address || '',
        };
      });

      const preacherRows = imamList.map((i) => {
        const gov = i.governorateId ? unitMap.get(i.governorateId)?.nameAr || 'الجيزة' : 'الجيزة';
        const dist = i.districtId ? unitMap.get(i.districtId)?.nameAr || 'الهرم' : 'الهرم';
        const area = i.areaId ? unitMap.get(i.areaId)?.nameAr || i.region : i.region;

        return {
          'كود الخطيب': `PRE-${i.id}`,
          'اسم الخطيب': i.name,
          'نوع الخطيب': i.type === 'FIXED' ? 'ثابت' : i.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن',
          'الحالة': i.isActive ? 'نشط' : 'غير نشط',
          'الهاتف': i.phone ? `'${i.phone}` : '',
          'المحافظة': gov,
          'الحي / القسم': dist,
          'المنطقة / الشياخة': area,
        };
      });

      const fileName = `full_system_export_${Date.now()}.${format === 'CSV' ? 'csv' : 'xlsx'}`;

      if (format === 'CSV') {
        const csvBytes = buildCsvWithBom([...mosqueRows, ...preacherRows]);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(csvBytes));
      } else {
        const xlsxBuffer = buildExcelWorkbook([
          { name: 'المساجد والجوامع', data: mosqueRows },
          { name: 'الخطباء والدعاة', data: preacherRows },
          {
            name: 'دليل التقسيم الإداري المصري',
            data: allUnits.map((u) => ({
              'كود الوحدة': u.id,
              'الاسم بالعربية': u.nameAr,
              'النوع': u.type,
              'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
            })),
          },
        ]);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        return res.send(Buffer.from(xlsxBuffer));
      }
    }
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'تعذر تصدير البيانات', details: error.message });
  }
});

// 7.4 Templates Download Endpoint
api.get('/import-export/templates/:type', async (req: Request, res: Response) => {
  try {
    const rawType = String(req.params.type || '').toLowerCase();
    const allUnits = await db.select().from(administrativeUnits);

    if (rawType === 'mosques') {
      const sampleMosques = [
        {
          'كود المسجد': 'MOS-001',
          'اسم المسجد': 'مسجد النور والإيمان',
          'الحالة': 'نشط',
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': 'الجيزة',
          'الحي / القسم': 'الهرم',
          'المنطقة / الشياخة': 'منشأة البكاري',
          'الشارع': 'شارع العروبة الرئيسي',
          'رقم المبنى': '12',
          'العلامة المميزة': 'بجوار مدرسة منشأة البكاري الابتدائية',
          'اسم المسؤول': 'أ. محمود عبد الرحمن',
          'هاتف المسجد / المسؤول': '01012345678',
          'واتساب': '01012345678',
          'سعة المصلين': 600,
          'الملاحظات': 'المسجد الرئيسي لفرع الجمعية الشرعية',
        },
        {
          'كود المسجد': 'MOS-002',
          'اسم المسجد': 'جامع الرحمن الرحيم',
          'الحالة': 'نشط',
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': 'الجيزة',
          'الحي / القسم': 'الهرم',
          'المنطقة / الشياخة': 'منشأة البكاري',
          'الشارع': 'شارع المنشية الجديدة',
          'رقم المبنى': '5',
          'العلامة المميزة': 'أمام مجمع الخدمات',
          'اسم المسؤول': 'أ. إبراهيم خليل',
          'هاتف المسجد / المسؤول': '01123456789',
          'واتساب': '01123456789',
          'سعة المصلين': 450,
          'الملاحظات': 'يوجد مصلى للسيدات',
        },
      ];

      const instructions = [
        {
          'اسم العمود': 'كود المسجد',
          'النوع': 'نص (إجباري أو اختياري)',
          'الوصف': 'كود المسجد الفريد (مثل MOS-001). إن ترك فارغاً سيقوم النظام بتوليده تلقائياً.',
        },
        {
          'اسم العمود': 'اسم المسجد',
          'النوع': 'نص (إجباري)',
          'الوصف': 'الاسم الرسمي للمسجد أو الجامع.',
        },
        {
          'اسم العمود': 'المحافظة',
          'النوع': 'نص (إجباري)',
          'الوصف': 'المحافظة المصرية الرسمية (الجيزة، القاهرة، الإسكندرية...) وفق الدليل المرفق.',
        },
        {
          'اسم العمود': 'الحي / القسم',
          'النوع': 'نص (موصى به)',
          'الوصف': 'الحي أو القسم التابع للمحافظة (الهرم، الدقي، العمرانية، العجوزة...).',
        },
        {
          'اسم العمود': 'المنطقة / الشياخة',
          'النوع': 'نص (موصى به)',
          'الوصف': 'المنطقة أو الشياخة (منشأة البكاري، كفر الجبل، نزلة السيسي...).',
        },
        {
          'اسم العمود': 'هاتف المسجد / المسؤول',
          'النوع': 'نص / أرقام',
          'الوصف': 'رقم هاتف مصري صحيح (11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015).',
        },
      ];

      const buffer = buildExcelWorkbook([
        { name: 'قالب استيراد المساجد', data: sampleMosques },
        { name: 'دليل الحقول والتعليمات', data: instructions },
        {
          name: 'دليل الوحدات الإدارية المعتمدة',
          data: allUnits.slice(0, 100).map((u) => ({
            'المحافظة / الوحدة': u.nameAr,
            'النوع': u.type,
            'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
            'الكود': u.id,
          })),
        },
      ]);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="mosques-import-template.xlsx"');
      return res.send(Buffer.from(buffer));
    } else if (rawType === 'preachers' || rawType === 'imams') {
      const samplePreachers = [
        {
          'كود الخطيب': 'PRE-001',
          'اسم الخطيب': 'الشيخ أحمد محمد علي',
          'نوع الخطيب': 'ثابت',
          'الحالة': 'نشط',
          'الهاتف': '01001234567',
          'واتساب': '01001234567',
          'البريد الإلكتروني': 'ahmed.ali@example.com',
          'الحد الأدنى للجمعات': 2,
          'العدد المستهدف': 4,
          'الحد الأقصى للجمعات': 5,
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': 'الجيزة',
          'الحي / القسم': 'الهرم',
          'المنطقة / الشياخة': 'منشأة البكاري',
          'المؤهل العلمي': 'ليسانس أصول دين - جامعة الأزهر',
          'التخصص': 'تفسير وعلوم قرآن',
          'الملاحظات': 'خطيب معتمد لدى فرع الجمعية',
        },
        {
          'كود الخطيب': 'PRE-002',
          'اسم الخطيب': 'الشيخ خالد محمود السيد',
          'نوع الخطيب': 'مرن',
          'الحالة': 'نشط',
          'الهاتف': '01198765432',
          'واتساب': '01198765432',
          'البريد الإلكتروني': '',
          'الحد الأدنى للجمعات': 1,
          'العدد المستهدف': 3,
          'الحد الأقصى للجمعات': 4,
          'الدولة': 'جمهورية مصر العربية',
          'المحافظة': 'الجيزة',
          'الحي / القسم': 'العمرانية',
          'المنطقة / الشياخة': 'العمرانية الغربية',
          'المؤهل العلمي': 'ليسانس شريعة وقانون',
          'التخصص': 'فقه وأصوله',
          'الملاحظات': 'مستعد للتوزيع في مساجد قطاع الهرم',
        },
      ];

      const instructions = [
        {
          'اسم العمود': 'اسم الخطيب',
          'النوع': 'نص (إجباري)',
          'الوصف': 'الاسم الكامل لفضيلة الشيخ الخطيب.',
        },
        {
          'اسم العمود': 'نوع الخطيب',
          'النوع': 'خيارات (ثابت / ثابت جزئي / مرن)',
          'الوصف': 'نمط تثبيت أو حركة الخطيب في الجداول الشهرية.',
        },
        {
          'اسم العمود': 'الهاتف',
          'النوع': 'نص (إجباري أو موصى به)',
          'الوصف': 'رقم هاتف محمول لإرسال إشعارات التكليف والواتساب.',
        },
      ];

      const buffer = buildExcelWorkbook([
        { name: 'قالب استيراد الخطباء', data: samplePreachers },
        { name: 'دليل الحقول والتعليمات', data: instructions },
        {
          name: 'دليل الوحدات الإدارية المعتمدة',
          data: allUnits.slice(0, 100).map((u) => ({
            'المحافظة / الوحدة': u.nameAr,
            'النوع': u.type,
            'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
            'الكود': u.id,
          })),
        },
      ]);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="preachers-import-template.xlsx"');
      return res.send(Buffer.from(buffer));
    } else {
      // FULL COMBINED TEMPLATE
      const buffer = buildExcelWorkbook([
        {
          name: 'المساجد',
          data: [
            {
              'كود المسجد': 'MOS-001',
              'اسم المسجد': 'مسجد النور والإيمان',
              'الحالة': 'نشط',
              'المحافظة': 'الجيزة',
              'الحي / القسم': 'الهرم',
              'المنطقة / الشياخة': 'منشأة البكاري',
              'هاتف المسجد / المسؤول': '01012345678',
              'اسم المسؤول': 'أ. محمود عبد الرحمن',
              'سعة المصلين': 600,
            },
          ],
        },
        {
          name: 'الخطباء',
          data: [
            {
              'كود الخطيب': 'PRE-001',
              'اسم الخطيب': 'الشيخ أحمد محمد علي',
              'نوع الخطيب': 'ثابت',
              'الحالة': 'نشط',
              'الهاتف': '01001234567',
              'المحافظة': 'الجيزة',
              'الحي / القسم': 'الهرم',
              'المنطقة / الشياخة': 'منشأة البكاري',
            },
          ],
        },
        {
          name: 'دليل الوحدات الإدارية المصرية',
          data: allUnits.slice(0, 100).map((u) => ({
            'الوحدة': u.nameAr,
            'النوع': u.type,
            'المستوى': u.level === 1 ? 'محافظة' : u.level === 2 ? 'قسم / حي' : 'شياخة / منطقة',
            'الكود': u.id,
          })),
        },
      ]);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="mosques-preachers-import-template.xlsx"');
      return res.send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('Template generation error:', error);
    res.status(500).json({ error: 'تعذر توليد القالب', details: error.message });
  }
});

// 7.5 Import / Export Logs
api.get('/import-export/logs', async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(importExportLogs).orderBy(desc(importExportLogs.id)).limit(50);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر جلب سجل العمليات', details: error.message });
  }
});

// 7.6 Download Error Report for specific batch
api.get('/import-export/logs/:id/error-report', async (req: Request, res: Response) => {
  try {
    const logId = Number(req.params.id);
    const [log] = await db.select().from(importExportLogs).where(eq(importExportLogs.id, logId));
    if (!log || !log.errorReportJson) {
      return res.status(404).json({ error: 'لا يوجد تقرير أخطاء لهذه العملية' });
    }

    const errorsList = JSON.parse(log.errorReportJson);
    const formattedErrors = errorsList.map((err: any) => ({
      'رقم الصف بالملف': err.rowNumber,
      'الكود': err.code || '—',
      'الاسم': err.name || '—',
      'نوع الخطأ': err.field,
      'رسالة الخطأ': err.errorMessage,
      'القيمة المدخلة': typeof err.rawValue === 'object' ? JSON.stringify(err.rawValue) : String(err.rawValue),
    }));

    const buffer = buildExcelWorkbook([
      { name: 'تقرير أخطاء الاستيراد', data: formattedErrors },
    ]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="import-errors-${log.batchId}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر توليد تقرير الأخطاء', details: error.message });
  }
});

// Backward-compatible legacy mosques import
api.post('/mosques/import', async (req: AuthRequest, res: Response) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'بيانات غير صالحة' });
    }
    let count = 0;
    for (const item of items) {
      if (item.name) {
        await db.insert(mosques).values({
          name: item.name,
          code: item.code || `MSQ-${Math.floor(100 + Math.random() * 900)}`,
          region: item.region || 'منشأة البكاري',
          address: item.address || 'منشأة البكاري، حي الهرم، الجيزة',
          formattedAddress: item.address || 'منشأة البكاري، حي الهرم، الجيزة',
          countryId: 1,
          governorateId: 1,
          districtId: 101,
          areaId: 1001,
          managerName: item.managerName || '',
          phone: item.phone || '',
          whatsapp: item.whatsapp || '',
          isActive: true,
        });
        count++;
      }
    }
    res.json({ success: true, importedCount: count });
  } catch (error: any) {
    res.status(500).json({ error: 'فشل استيراد المساجد', details: error.message });
  }
});

// System Reset & Clear Data Endpoints
api.post('/system/clear-all', async (req: AuthRequest, res: Response) => {
  try {
    await clearAllDatabaseData();
    await logAudit(req, 'CLEAR_ALL_DATA', 'SYSTEM', 1);
    res.json({ success: true, message: 'تم تصفير كافة المساجد والخطباء والجداول بنجاح (0 مساجد، 0 خطباء)' });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر تصفير بيانات النظام', details: error.message });
  }
});

api.post('/system/reset-demo', async (req: AuthRequest, res: Response) => {
  try {
    memoryStore.reset();
    await seedDatabase().catch((e) => console.warn('seedDatabase DB error (using memoryStore):', e?.message));
    await logAudit(req, 'RESET_DEMO_DATA', 'SYSTEM', 1);
    res.json({ success: true, message: 'تمت إعادة ضبط النظام إلى الحالة الافتراضية بنجاح' });
  } catch (error: any) {
    memoryStore.reset();
    res.json({ success: true, message: 'تمت إعادة ضبط النظام إلى الحالة الافتراضية بنجاح' });
  }
});

// System Seed Freeze & Export for GitHub / External Server Deployment
api.post('/system/export-seed', async (req: AuthRequest, res: Response) => {
  try {
    const { exportCurrentDatabaseToSeedJson } = await import('../../scripts/exportSeed.ts');
    const result = await exportCurrentDatabaseToSeedJson();
    await logAudit(req, 'EXPORT_SYSTEM_SEED', 'SYSTEM', 1, result.counts);
    res.json({
      success: true,
      message: 'تم تثبيت وتجميد المعطيات الحالية في ملف الأساس (src/db/initialSeed.json) بنجاح جاهزة للرفع على GitHub والنقل لأي سيرفر خارجي!',
      stats: result.counts,
      exportDate: result.exportDate,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'تعذر حفظ وتثبيت المعطيات الحالية', details: error.message });
  }
});

// -------------------------------------------------------------
// 8. Supabase Cloud Database Integration & Sync Endpoints
// -------------------------------------------------------------
api.get('/supabase/status', async (_req: Request, res: Response) => {
  try {
    const { SupabaseSyncService } = await import('../services/supabaseSyncService.ts');
    const status = await SupabaseSyncService.checkConnection();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ configured: false, connected: false, error: err.message, message: 'فشل فحص اتصال Supabase' });
  }
});

api.post('/supabase/test', async (_req: Request, res: Response) => {
  try {
    const { SupabaseSyncService } = await import('../services/supabaseSyncService.ts');
    const result = await SupabaseSyncService.checkConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

api.post('/supabase/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { SupabaseSyncService } = await import('../services/supabaseSyncService.ts');
    const result = await SupabaseSyncService.pushLocalToSupabase();
    await logAudit(req, 'SUPABASE_SYNC', 'SYSTEM', 1, result);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message, message: 'تعذر إتمام المزامنة مع سحابة Supabase' });
  }
});

export default api;
