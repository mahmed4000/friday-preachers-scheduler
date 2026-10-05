import fs from 'fs';
import path from 'path';
import { CalendarService } from '../services/calendar/calendarService.ts';
import { SchedulingEngine } from '../services/schedulingEngine.ts';

// Load initial seed data
let seedData: any = {
  mosques: [],
  imams: [],
  mosqueImamRules: [],
  monthlySchedules: [],
  fridays: [],
  assignments: [],
  conflicts: [],
  overrides: [],
  fixedAssignmentPatterns: [],
  fixedAssignmentPatternItems: [],
  users: [],
};

try {
  const seedPath = path.resolve('src/db/initialSeed.json');
  if (fs.existsSync(seedPath)) {
    const raw = fs.readFileSync(seedPath, 'utf8');
    seedData = JSON.parse(raw);
  }
} catch (err) {
  console.warn('Could not load initialSeed.json for memoryStore:', err);
}

// In-memory working copies
let memoryMosques = [...(seedData.mosques || [])];
let memoryImams = [...(seedData.imams || [])];
let memoryRules = [...(seedData.mosqueImamRules || [])];
let memorySchedules = [...(seedData.monthlySchedules || [])];
let memoryFridays = [...(seedData.fridays || [])];
let memoryAssignments = [...(seedData.assignments || [])];
let memoryConflicts = [...(seedData.conflicts || [])];
let memoryOverrides = [...(seedData.overrides || [])];
let memoryPatterns = [...(seedData.fixedAssignmentPatterns || [])];
let memoryPatternItems = [...(seedData.fixedAssignmentPatternItems || [])];

export const memoryStore = {
  reset() {
    memoryMosques = [...(seedData.mosques || [])];
    memoryImams = [...(seedData.imams || [])];
    memoryRules = [...(seedData.mosqueImamRules || [])];
    memorySchedules = [...(seedData.monthlySchedules || [])];
    memoryFridays = [...(seedData.fridays || [])];
    memoryAssignments = [...(seedData.assignments || [])];
    memoryConflicts = [...(seedData.conflicts || [])];
    memoryOverrides = [...(seedData.overrides || [])];
    memoryPatterns = [...(seedData.fixedAssignmentPatterns || [])];
    memoryPatternItems = [...(seedData.fixedAssignmentPatternItems || [])];
  },

  getMosques(search: string = '', region: string = '') {
    const imamMap = new Map(memoryImams.map((i: any) => [i.id, i.name]));
    let list = [...memoryMosques];

    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (m: any) =>
          m.name?.includes(search) ||
          m.code?.toLowerCase().includes(s) ||
          (m.region && m.region.includes(search))
      );
    }
    if (region && region !== 'ALL') {
      list = list.filter((m: any) => m.region === region);
    }

    return list.map((m: any) => {
      const rulesForMosque = memoryRules.filter((r: any) => r.mosqueId === m.id);
      return {
        ...m,
        fixedImamName: m.fixedImamId ? imamMap.get(m.fixedImamId) || 'غير محدد' : null,
        preferencesCount: rulesForMosque.filter((r: any) => r.relationshipType === 'PREFERRED').length,
        forbiddenCount: rulesForMosque.filter((r: any) => r.relationshipType === 'FORBIDDEN').length,
      };
    });
  },

  getMosqueDetails(id: number) {
    const mosque = memoryMosques.find((m: any) => m.id === id);
    if (!mosque) return null;
    const imamMap = new Map(memoryImams.map((i: any) => [i.id, i.name]));
    const rules = memoryRules
      .filter((r: any) => r.mosqueId === id)
      .map((r: any) => ({
        ...r,
        imam: imamMap.get(r.imamId),
      }));
    return {
      ...mosque,
      rules,
    };
  },

  getImams(search: string = '', type: string = '') {
    let list = [...memoryImams];
    if (search) {
      list = list.filter(
        (i: any) =>
          i.name?.includes(search) ||
          i.phone?.includes(search) ||
          (i.region && i.region.includes(search))
      );
    }
    if (type && type !== 'ALL') {
      list = list.filter((i: any) => i.type === type);
    }

    return list.map((i: any) => {
      const rulesForImam = memoryRules.filter((r: any) => r.imamId === i.id);
      const assignedCount = memoryAssignments.filter((a: any) => a.imamId === i.id).length;
      return {
        ...i,
        assignedFridaysCount: assignedCount,
        preferredMosquesCount: rulesForImam.filter((r: any) => r.relationshipType === 'PREFERRED').length,
        forbiddenMosquesCount: rulesForImam.filter((r: any) => r.relationshipType === 'FORBIDDEN').length,
      };
    });
  },

  getImamDetails(id: number) {
    const imam = memoryImams.find((i: any) => i.id === id);
    if (!imam) return null;
    const mosqueMap = new Map(memoryMosques.map((m: any) => [m.id, m.name]));
    const rules = memoryRules
      .filter((r: any) => r.imamId === id)
      .map((r: any) => ({
        ...r,
        mosque: mosqueMap.get(r.mosqueId),
      }));
    return {
      ...imam,
      rules,
    };
  },

  getRules() {
    return [...memoryRules];
  },

  getSchedules() {
    const enriched = memorySchedules.map((s: any) => {
      const monthDetails = CalendarService.getHijriMonthDetails(s.hijriYear, s.hijriMonth, {
        provider: s.calendarProvider || 'UMM_AL_QURA',
        timezone: s.timezone || 'Africa/Cairo',
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
    return CalendarService.sortSchedulesChronologically(enriched);
  },

  getScheduleDetails(id: number) {
    const schedule = memorySchedules.find((s: any) => s.id === id) || memorySchedules[0];
    if (!schedule) return null;
    const fridays = memoryFridays.filter((f: any) => f.scheduleId === schedule.id);
    const assigns = memoryAssignments.filter((a: any) => a.scheduleId === schedule.id);
    const confs = memoryConflicts.filter((c: any) => c.scheduleId === schedule.id);
    const overs = memoryOverrides.filter((o: any) => o.scheduleId === schedule.id);

    return {
      schedule,
      fridays,
      assignments: assigns,
      conflicts: confs,
      overrides: overs,
    };
  },

  getDashboard(hijriYear?: number, hijriMonth?: number) {
    const currentDT = CalendarService.getCurrentDateTime();
    const hYear = hijriYear || currentDT.hijri.year;
    const hMonth = hijriMonth || currentDT.hijri.month;

    const monthDetails = CalendarService.getHijriMonthDetails(hYear, hMonth);
    const activeMosques = memoryMosques.filter((m: any) => m.isActive);
    const activeImams = memoryImams.filter((i: any) => i.isActive);

    const mosqueMap = new Map(memoryMosques.map((m: any) => [m.id, m]));
    const imamMap = new Map(memoryImams.map((i: any) => [i.id, i]));

    const schedule =
      memorySchedules.find((s: any) => s.hijriYear === hYear && s.hijriMonth === hMonth) ||
      memorySchedules[0] ||
      null;

    let scheduleAssignments: any[] = [];
    let scheduleConflicts: any[] = [];
    if (schedule) {
      scheduleAssignments = memoryAssignments.filter((a: any) => a.scheduleId === schedule.id);
      scheduleConflicts = memoryConflicts.filter((c: any) => c.scheduleId === schedule.id);
    }

    const totalRequiredAssignments = activeMosques.length * monthDetails.fridaysCount;
    const completedAssignments = scheduleAssignments.filter((a: any) => a.imamId !== null).length;
    const completionPercentage =
      totalRequiredAssignments > 0
        ? Math.min(100, Math.round((completedAssignments / totalRequiredAssignments) * 100))
        : 0;

    const fridaysWithStats = monthDetails.fridays.map((f: any) => {
      const fridayAssigns = scheduleAssignments.filter((a: any) => a.fridayIndex === f.fridayIndex);
      const assignedCount = fridayAssigns.filter((a: any) => a.imamId !== null).length;
      const vacantCount = Math.max(0, activeMosques.length - assignedCount);
      const fridayConflictsCount = scheduleConflicts.filter((c: any) => c.fridayIndex === f.fridayIndex).length;

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

    let targetFriday = monthDetails.fridays.find((f: any) => !f.isPast) || monthDetails.fridays[0];
    let nextFridayData: any = null;
    let nextFridayAssignments: any[] = [];

    if (targetFriday) {
      const targetFridayAssigns = scheduleAssignments.filter(
        (a: any) => a.fridayIndex === targetFriday.fridayIndex
      );

      nextFridayAssignments = targetFridayAssigns.map((a: any) => {
        const m = mosqueMap.get(a.mosqueId) as any;
        const i = a.imamId ? (imamMap.get(a.imamId) as any) : null;
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
        activeMosques.length - nextFridayAssignments.filter((a: any) => a.imamId).length
      );

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
        hijriYear: hYear,
        daysRemaining,
        totalRequired: activeMosques.length,
        totalAssigned: nextFridayAssignments.filter((a: any) => a.imamId).length,
        vacantCount,
        isAllMonthFridaysPast: false,
      };
    }

    return {
      period: {
        hijriYear: hYear,
        hijriMonth: hMonth,
        monthNameAr: monthDetails.monthName,
        status: monthDetails.periodStatus,
        statusLabelArabic: monthDetails.statusLabelArabic,
        isPast: monthDetails.isPast,
        isCurrent: monthDetails.isCurrent,
        isFuture: monthDetails.isFuture,
        startDateHijri: `1 ${monthDetails.monthName} ${hYear} هـ`,
        endDateHijri: `${monthDetails.daysCount} ${monthDetails.monthName} ${hYear} هـ`,
        startDateGregorian: monthDetails.startDateGregorian,
        endDateGregorian: monthDetails.endDateGregorian,
        fridaysCount: monthDetails.fridaysCount,
        pastFridaysCount: monthDetails.pastFridaysCount,
        futureFridaysCount: monthDetails.futureFridaysCount,
      },
      stats: {
        totalMosques: memoryMosques.length,
        activeMosques: activeMosques.length,
        totalImams: memoryImams.length,
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
      alerts: [],
      liveDateTime: currentDT,
    };
  },

  getImamProfile(id: number, scheduleId?: number) {
    const imam = memoryImams.find((i: any) => i.id === id);
    if (!imam) return null;

    const allAssignments = memoryAssignments.filter((a: any) => a.imamId === id);
    const fridayMap = new Map(memoryFridays.map((f: any) => [f.id, f]));
    const scheduleMap = new Map(memorySchedules.map((s: any) => [s.id, s]));
    const mosqueMap = new Map(memoryMosques.map((m: any) => [m.id, m]));

    const activeSchedule = CalendarService.resolveCanonicalSchedule(memorySchedules, scheduleId);

    const profileAssignments = allAssignments.map((a: any) => {
      const f = fridayMap.get(a.fridayId) as any;
      const s = scheduleMap.get(a.scheduleId) as any;
      const m = mosqueMap.get(a.mosqueId) as any;
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
        hijriMonth: s?.hijriMonth || 1,
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
    }).sort((x: any, y: any) => {
      const xVal = (x.hijriYear || 1448) * 12 + (x.hijriMonth || 1);
      const yVal = (y.hijriYear || 1448) * 12 + (y.hijriMonth || 1);
      if (xVal !== yVal) return xVal - yVal;
      return (x.fridayIndex || 1) - (y.fridayIndex || 1);
    });

    const rawUpcoming = activeSchedule
      ? profileAssignments.filter((a: any) => a.scheduleId === activeSchedule.id)
      : profileAssignments.filter((a: any) => a.isUpcoming);
    const upcomingAssignments = CalendarService.deduplicateAssignmentsByFriday(rawUpcoming);

    const rules = memoryRules
      .filter((r: any) => r.imamId === id)
      .map((r: any) => {
        const m = mosqueMap.get(r.mosqueId) as any;
        return {
          ...r,
          mosqueName: m?.name,
          mosqueRegion: m?.region,
        };
      });

    const mosqueCounts = new Map<number, { count: number; lastDate?: string; nextDate?: string }>();
    for (const a of profileAssignments) {
      const curr = mosqueCounts.get(a.mosqueId) || { count: 0 };
      curr.count += 1;
      if (a.isUpcoming && !curr.nextDate) curr.nextDate = a.hijriDate;
      if (!a.isUpcoming && !curr.lastDate) curr.lastDate = a.hijriDate;
      mosqueCounts.set(a.mosqueId, curr);
    }

    const linkedMosques = Array.from(mosqueCounts.entries()).map(([mId, data]) => {
      const m = mosqueMap.get(mId) as any;
      const rule = rules.find((r: any) => r.mosqueId === mId);
      return {
        mosqueId: mId,
        mosqueName: m?.name || `مسجد #${mId}`,
        mosqueCode: m?.code || '',
        mosqueRegion: m?.region || '',
        relationshipType: rule?.relationshipType,
        assignedCount: data.count,
        lastDate: data.lastDate,
        nextDate: data.nextDate,
      };
    }).sort((x, y) => y.assignedCount - x.assignedCount);

    const stats = {
      currentMonthCount: upcomingAssignments.length,
      currentMonthName: activeSchedule?.monthName || '',
      currentHijriYear: activeSchedule?.hijriYear || 1448,
      currentScheduleStatus: activeSchedule?.status || 'APPROVED',
      lifetimeTotalAssigned: profileAssignments.length,
      mosquesCount: linkedMosques.length,
      upcomingCount: upcomingAssignments.length,
      pastCount: profileAssignments.length - upcomingAssignments.length,
      availabilitiesCount: 0,
      minFridays: imam.minFridays,
      targetFridays: imam.targetFridays,
      maxFridays: imam.maxFridays,
    };

    return {
      imam,
      activeSchedule,
      availableSchedules: CalendarService.sortSchedulesForSelection(memorySchedules).map((s: any) => ({
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
      rules,
      availabilities: [],
      auditLogs: [],
    };
  },

  getMosqueProfile(id: number, scheduleId?: number) {
    const mosque = memoryMosques.find((m: any) => m.id === id);
    if (!mosque) return null;

    const imamMap = new Map(memoryImams.map((i: any) => [i.id, i]));
    const fridayMap = new Map(memoryFridays.map((f: any) => [f.id, f]));
    const scheduleMap = new Map(memorySchedules.map((s: any) => [s.id, s]));

    const fixedImam = mosque.fixedImamId ? imamMap.get(mosque.fixedImamId) || null : null;
    const allAssignments = memoryAssignments.filter((a: any) => a.mosqueId === id);

    const activeSchedule = CalendarService.resolveCanonicalSchedule(memorySchedules, scheduleId);

    const profileAssignments = allAssignments.map((a: any) => {
      const f = fridayMap.get(a.fridayId) as any;
      const s = scheduleMap.get(a.scheduleId) as any;
      const i = a.imamId ? (imamMap.get(a.imamId) as any) : null;
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
        hijriMonth: s?.hijriMonth || 1,
        scheduleStatus: s?.status || 'APPROVED',
        mosqueId: mosque.id,
        mosqueName: mosque.name,
        mosqueCode: mosque.code,
        mosqueRegion: mosque.region,
        imamId: a.imamId,
        imamName: i?.name || 'شاغر (لم يعين)',
        imamType: i?.type || 'FLEXIBLE',
        imamPhone: i?.phone || undefined,
        isLocked: a.isLocked,
        source: a.source,
        isUpcoming,
      };
    }).sort((x: any, y: any) => {
      const xVal = (x.hijriYear || 1448) * 12 + (x.hijriMonth || 1);
      const yVal = (y.hijriYear || 1448) * 12 + (y.hijriMonth || 1);
      if (xVal !== yVal) return xVal - yVal;
      return (x.fridayIndex || 1) - (y.fridayIndex || 1);
    });

    const rawUpcoming = activeSchedule
      ? profileAssignments.filter((a: any) => a.scheduleId === activeSchedule.id)
      : profileAssignments.filter((a: any) => a.isUpcoming);
    const upcomingAssignments = CalendarService.deduplicateAssignmentsByFriday(rawUpcoming);

    const allRules = memoryRules.filter((r: any) => r.mosqueId === id);
    const rulesGrouped = {
      preferred: allRules.filter((r: any) => r.relationshipType === 'PREFERRED').map((r: any) => ({ ...r, imamName: (imamMap.get(r.imamId) as any)?.name })),
      allowed: allRules.filter((r: any) => r.relationshipType === 'ALLOWED').map((r: any) => ({ ...r, imamName: (imamMap.get(r.imamId) as any)?.name })),
      discouraged: allRules.filter((r: any) => r.relationshipType === 'DISCOURAGED').map((r: any) => ({ ...r, imamName: (imamMap.get(r.imamId) as any)?.name })),
      forbidden: allRules.filter((r: any) => r.relationshipType === 'FORBIDDEN').map((r: any) => ({ ...r, imamName: (imamMap.get(r.imamId) as any)?.name })),
      fixed: allRules.filter((r: any) => r.relationshipType === 'FIXED').map((r: any) => ({ ...r, imamName: (imamMap.get(r.imamId) as any)?.name })),
    };

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
      const im = imamMap.get(imId) as any;
      const rule = allRules.find((r: any) => r.imamId === imId);
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

    const stats = {
      totalAssigned: profileAssignments.length,
      currentMonthCount: upcomingAssignments.length,
      imamsCount: linkedImams.length,
      upcomingCount: upcomingAssignments.length,
      currentScheduleFridaysTotal: activeSchedule?.fridaysCount || 4,
      currentMonthName: activeSchedule?.monthName || '',
      currentHijriYear: activeSchedule?.hijriYear || 1448,
    };

    return {
      mosque,
      fixedImam,
      activeSchedule,
      availableSchedules: CalendarService.sortSchedulesForSelection(memorySchedules).map((s: any) => ({
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
      auditLogs: [],
    };
  },

  getFixedPatterns(mosqueId: number, year: number, month: number) {
    const pattern = memoryPatterns.find(
      (p: any) => p.mosqueId === mosqueId && p.hijriYear === year && p.hijriMonth === month
    );
    const monthDetails = CalendarService.getHijriMonthDetails(year, month);
    const imamMap = new Map(memoryImams.map((i: any) => [i.id, i]));

    if (!pattern) {
      return {
        exists: false,
        fridaysCount: monthDetails.fridaysCount,
        pattern: {
          patternType: 'NONE',
          items: monthDetails.fridays.map((f: any) => ({
            fridayIndex: f.fridayIndex,
            imamId: null,
            imamName: null,
          })),
        },
      };
    }

    const items = memoryPatternItems
      .filter((pi: any) => pi.patternId === pattern.id)
      .map((pi: any) => {
        const im = pi.imamId ? (imamMap.get(pi.imamId) as any) : null;
        return {
          ...pi,
          imamName: im?.name || null,
        };
      });

    return {
      exists: true,
      pattern: {
        ...pattern,
        items,
      },
      fridaysCount: pattern.fridaysCount,
    };
  },

  getReportsSummary(scheduleIdParam?: number | string) {
    const allSchedules = this.getSchedules();
    const currentDT = CalendarService.getCurrentDateTime();

    // Find default current month schedule
    const currentSchedule =
      allSchedules.find((s: any) => s.isCurrent || (s.hijriYear === currentDT.hijri.year && s.hijriMonth === currentDT.hijri.month)) ||
      allSchedules[0] ||
      null;

    const isAll = scheduleIdParam === 'all' || scheduleIdParam === 'ALL' || scheduleIdParam === 0 || scheduleIdParam === '0';
    let targetSchedule: any = null;

    if (!isAll) {
      if (scheduleIdParam !== undefined && scheduleIdParam !== null && scheduleIdParam !== '') {
        const parsedId = Number(scheduleIdParam);
        targetSchedule = allSchedules.find((s: any) => s.id === parsedId) || currentSchedule;
      } else {
        targetSchedule = currentSchedule;
      }
    }

    const filteredAssignments = targetSchedule
      ? memoryAssignments.filter((a: any) => a.scheduleId === targetSchedule.id)
      : memoryAssignments;

    const filteredConflicts = targetSchedule
      ? memoryConflicts.filter((c: any) => c.scheduleId === targetSchedule.id)
      : memoryConflicts;

    const filteredOverrides = targetSchedule
      ? memoryOverrides.filter((o: any) => o.scheduleId === targetSchedule.id)
      : memoryOverrides;

    const imamLoads = memoryImams.map((i: any) => {
      const assigned = filteredAssignments.filter((a: any) => a.imamId === i.id).length;
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

    const mosqueLoads = memoryMosques.map((m: any) => {
      const assignedCount = filteredAssignments.filter((a: any) => a.mosqueId === m.id).length;
      return {
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        assignedCount,
      };
    });

    const underCount = imamLoads.filter((i: any) => i.status === 'UNDER').length;
    const balancedCount = imamLoads.filter((i: any) => i.status === 'BALANCED').length;
    const overCount = imamLoads.filter((i: any) => i.status === 'OVER').length;
    const totalAssigned = filteredAssignments.filter((a: any) => a.imamId !== null).length;

    return {
      selectedSchedule: targetSchedule
        ? {
            id: targetSchedule.id,
            monthName: targetSchedule.monthName,
            hijriYear: targetSchedule.hijriYear,
            hijriMonth: targetSchedule.hijriMonth,
            fridaysCount: targetSchedule.fridaysCount,
            status: targetSchedule.status,
            periodStatus: targetSchedule.periodStatus,
            isCurrent: targetSchedule.isCurrent,
            isPast: targetSchedule.isPast,
            isFuture: targetSchedule.isFuture,
          }
        : {
            id: 'all',
            monthName: 'الإجمالي التراكمي لكافة الشهور',
            hijriYear: 0,
            hijriMonth: 0,
            fridaysCount: 0,
            status: 'ALL',
            periodStatus: 'ALL',
            isCurrent: false,
            isPast: false,
            isFuture: false,
          },
      availableSchedules: allSchedules.map((s: any) => ({
        id: s.id,
        monthName: s.monthName,
        hijriYear: s.hijriYear,
        hijriMonth: s.hijriMonth,
        fridaysCount: s.fridaysCount,
        status: s.status,
        periodStatus: s.periodStatus,
        isCurrent: s.isCurrent,
        isPast: s.isPast,
        isFuture: s.isFuture,
      })),
      isAll,
      imamLoads,
      mosqueLoads,
      balancedCount,
      underCount,
      overCount,
      totalAssigned,
      totalConflicts: filteredConflicts.length,
      criticalConflicts: 0,
      warningConflicts: 0,
      overridesCount: filteredOverrides.length,
      manualChangesCount: filteredAssignments.filter((a: any) => a.source === 'MANUAL').length,
    };
  },

  getAuditLogs() {
    return [
      {
        id: 1,
        userEmail: 'admin@aljameya.org',
        action: 'INITIAL_SEED',
        entityType: 'SYSTEM',
        entityId: 1,
        detailsJson: JSON.stringify({ message: 'تهيئة البيانات المعتمدة لمنظّم الجمعة' }),
        createdAt: new Date().toISOString(),
      },
    ];
  },

  updateAssignment(scheduleId: number, assignmentId: number, imamId: number | null, reason?: string) {
    const assign = memoryAssignments.find((a: any) => a.id === assignmentId && a.scheduleId === scheduleId);
    if (!assign) return null;
    assign.imamId = imamId;
    assign.source = 'MANUAL';
    assign.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return assign;
  },

  swapAssignments(scheduleId: number, sourceAssignmentId: number, targetAssignmentId: number, reason?: string) {
    const a1 = memoryAssignments.find((a: any) => a.id === sourceAssignmentId && a.scheduleId === scheduleId);
    const a2 = memoryAssignments.find((a: any) => a.id === targetAssignmentId && a.scheduleId === scheduleId);
    if (!a1 || !a2) return null;
    const tempImamId = a1.imamId;
    a1.imamId = a2.imamId;
    a2.imamId = tempImamId;
    a1.source = 'MANUAL';
    a2.source = 'MANUAL';
    a1.updatedAt = new Date().toISOString();
    a2.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return { assignment1: a1, assignment2: a2 };
  },

  toggleLock(scheduleId: number, assignmentId: number) {
    const assign = memoryAssignments.find((a: any) => a.id === assignmentId && a.scheduleId === scheduleId);
    if (!assign) return null;
    assign.isLocked = !assign.isLocked;
    assign.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return assign;
  },

  approveSchedule(scheduleId: number) {
    const sched = memorySchedules.find((s: any) => s.id === scheduleId);
    if (!sched) return null;
    sched.status = 'APPROVED';
    sched.approvedAt = new Date().toISOString();
    sched.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return sched;
  },

  publishSchedule(scheduleId: number) {
    const sched = memorySchedules.find((s: any) => s.id === scheduleId);
    if (!sched) return null;
    sched.status = 'PUBLISHED';
    sched.publishedAt = new Date().toISOString();
    sched.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return sched;
  },

  createSchedule(
    hijriYear: number,
    hijriMonth: number,
    calendarProvider?: string,
    timezone?: string,
    createdBy?: string
  ) {
    const periodValidation = CalendarService.validateSchedulePeriod(hijriYear, hijriMonth, {
      provider: (calendarProvider as any) || 'UMM_AL_QURA',
      timezone: timezone || 'Asia/Riyadh',
    });

    const existing = memorySchedules.find(
      (s: any) => s.hijriYear === hijriYear && s.hijriMonth === hijriMonth
    );
    if (existing) {
      return {
        isDuplicate: true,
        schedule: existing,
        error: `يوجد بالفعل جدول لشهر ${existing.monthName} ${hijriYear} هـ (الجدول #${existing.id})`,
      };
    }

    const monthDetails = periodValidation.monthDetails;
    const nextId = memorySchedules.reduce((max: number, s: any) => Math.max(max, s.id || 0), 0) + 1;

    const newSchedule = {
      id: nextId,
      hijriYear,
      hijriMonth,
      monthName: monthDetails.monthName,
      fridaysCount: monthDetails.fridaysCount,
      daysCount: monthDetails.daysCount,
      calendarProvider: monthDetails.calendarProvider,
      timezone: monthDetails.timezone,
      startDateGregorian: monthDetails.startDateGregorian,
      endDateGregorian: monthDetails.endDateGregorian,
      status: 'DRAFT',
      currentVersion: 1,
      createdBy: createdBy || 'admin@aljameya.org',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    memorySchedules.unshift(newSchedule);

    let nextFridayId = memoryFridays.reduce((max: number, f: any) => Math.max(max, f.id || 0), 0) + 1;
    const fridaysToInsert = monthDetails.fridays.map((f: any) => ({
      id: nextFridayId++,
      scheduleId: newSchedule.id,
      fridayIndex: f.fridayIndex,
      hijriYear: f.hijriYear,
      hijriMonth: f.hijriMonth,
      hijriDay: f.hijriDay,
      hijriDate: f.hijriDate,
      gregorianDate: f.gregorianDate,
      dayOfWeek: f.dayOfWeek,
    }));

    memoryFridays.push(...fridaysToInsert);
    this.persistToDisk();

    return {
      ...newSchedule,
      periodStatus: monthDetails.periodStatus,
      statusLabelArabic: monthDetails.statusLabelArabic,
      monthDetails,
    };
  },

  generateSchedule(scheduleId: number, distributionMethod?: string, seed?: string) {
    const schedule = memorySchedules.find((s: any) => s.id === scheduleId);
    if (!schedule) {
      throw new Error('الجدول غير موجود');
    }

    const activeMosques = memoryMosques.filter((m: any) => m.isActive);
    const activeImams = memoryImams.filter((i: any) => i.isActive);
    const rules = memoryRules;

    const monthDetails = CalendarService.getHijriMonthDetails(schedule.hijriYear, schedule.hijriMonth, {
      provider: (schedule.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: schedule.timezone || 'Asia/Riyadh',
    });

    const pastFridayIndices = new Set(
      monthDetails.fridays.filter((f: any) => f.isPast).map((f: any) => f.fridayIndex)
    );

    const existingAssignments = memoryAssignments.filter((a: any) => a.scheduleId === scheduleId);
    const lockedAssignments = existingAssignments
      .filter((a: any) => a.isLocked || pastFridayIndices.has(a.fridayIndex))
      .map((a: any) => ({
        fridayIndex: a.fridayIndex,
        mosqueId: a.mosqueId,
        imamId: a.imamId,
        source: a.source,
        notes: a.notes,
      }));

    const patternRecords = memoryPatterns.filter(
      (p: any) =>
        p.hijriYear === schedule.hijriYear &&
        p.hijriMonth === schedule.hijriMonth &&
        p.isActive !== false
    );
    const patternIds = patternRecords.map((p: any) => p.id);
    const patternItemsRecords = memoryPatternItems.filter((item: any) => patternIds.includes(item.patternId));

    const fixedPatternsInput = patternRecords.map((p: any) => ({
      mosqueId: p.mosqueId,
      patternType: p.patternType,
      fridaysCount: p.fridaysCount,
      items: patternItemsRecords
        .filter((item: any) => item.patternId === p.id)
        .map((item: any) => ({
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
      mosques: activeMosques.map((m: any) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region,
        isActive: m.isActive,
        fixedImamId: m.fixedImamId,
        fixedPattern: m.fixedPattern,
        fixedCount: m.fixedCount,
      })),
      imams: activeImams.map((i: any) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        minFridays: i.minFridays,
        targetFridays: i.targetFridays,
        maxFridays: i.maxFridays,
        isActive: i.isActive,
        region: i.region,
      })),
      rules: rules.map((r: any) => ({
        mosqueId: r.mosqueId,
        imamId: r.imamId,
        relationshipType: r.relationshipType,
        priority: r.priority || 1,
      })),
      availabilities: [],
      lockedAssignments,
      fixedPatterns: fixedPatternsInput,
      distributionMethod: (distributionMethod as any) || 'Balanced Random',
      seed: seed || `${schedule.monthName}-${schedule.hijriYear}`,
    });

    const lockedIds = new Set(existingAssignments.filter((a: any) => a.isLocked).map((a: any) => a.id));
    memoryAssignments = memoryAssignments.filter((a: any) => a.scheduleId !== scheduleId || lockedIds.has(a.id));

    let nextAssignId = memoryAssignments.reduce((max: number, a: any) => Math.max(max, a.id || 0), 0) + 1;
    const scheduleFridays = memoryFridays.filter((f: any) => f.scheduleId === scheduleId);
    const fridayMap = new Map(scheduleFridays.map((f: any) => [f.fridayIndex, f.id]));

    const newAssignmentsToInsert = result.assignments.map((ea: any) => ({
      id: nextAssignId++,
      scheduleId,
      fridayId: fridayMap.get(ea.fridayIndex) || 0,
      fridayIndex: ea.fridayIndex,
      mosqueId: ea.mosqueId,
      imamId: ea.imamId,
      isLocked: ea.isLocked || false,
      source: ea.source,
      notes: ea.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    memoryAssignments.push(...newAssignmentsToInsert);

    if (result.conflicts && result.conflicts.length > 0) {
      let nextConflictId = memoryConflicts.reduce((max: number, c: any) => Math.max(max, c.id || 0), 0) + 1;
      const newConflicts = result.conflicts.map((c: any) => ({
        id: nextConflictId++,
        scheduleId,
        fridayIndex: c.fridayIndex || null,
        mosqueId: c.mosqueId || null,
        imamId: c.imamId || null,
        ruleCode: c.ruleCode,
        severity: c.severity,
        message: c.message,
        possibleResolutions: JSON.stringify(c.possibleResolutions || []),
        createdAt: new Date().toISOString(),
      }));
      memoryConflicts = memoryConflicts.filter((c: any) => c.scheduleId !== scheduleId);
      memoryConflicts.push(...newConflicts);
    }

    schedule.status = 'REVIEW';
    schedule.updatedAt = new Date().toISOString();
    this.persistToDisk();

    return { success: true, result };
  },

  createMosque(data: any) {
    const nextId = memoryMosques.reduce((max: number, m: any) => Math.max(max, m.id || 0), 0) + 1;
    const newMosque = {
      id: nextId,
      isActive: true,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryMosques.push(newMosque);
    this.persistToDisk();
    return newMosque;
  },

  updateMosque(id: number, data: any) {
    const index = memoryMosques.findIndex((m: any) => m.id === id);
    if (index === -1) return null;
    memoryMosques[index] = {
      ...memoryMosques[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.persistToDisk();
    return memoryMosques[index];
  },

  deleteMosque(id: number) {
    memoryMosques = memoryMosques.filter((m: any) => m.id !== id);
    this.persistToDisk();
    return true;
  },

  createImam(data: any) {
    const nextId = memoryImams.reduce((max: number, i: any) => Math.max(max, i.id || 0), 0) + 1;
    const newImam = {
      id: nextId,
      isActive: true,
      minFridays: data.minFridays ?? 1,
      targetFridays: data.targetFridays ?? 4,
      maxFridays: data.maxFridays ?? 5,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryImams.push(newImam);
    this.persistToDisk();
    return newImam;
  },

  updateImam(id: number, data: any) {
    const index = memoryImams.findIndex((i: any) => i.id === id);
    if (index === -1) return null;
    memoryImams[index] = {
      ...memoryImams[index],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    this.persistToDisk();
    return memoryImams[index];
  },

  deleteImam(id: number) {
    memoryImams = memoryImams.filter((i: any) => i.id !== id);
    this.persistToDisk();
    return true;
  },

  createRule(data: any) {
    return this.upsertRule(data);
  },

  upsertRule(data: any) {
    const mosqueId = Number(data.mosqueId);
    const imamId = Number(data.imamId);
    const existingIndex = memoryRules.findIndex(
      (r: any) => Number(r.mosqueId) === mosqueId && Number(r.imamId) === imamId
    );
    if (existingIndex >= 0) {
      memoryRules[existingIndex] = {
        ...memoryRules[existingIndex],
        relationshipType: data.relationshipType,
        priority: data.priority ? Number(data.priority) : 1,
        notes: data.notes || null,
        updatedAt: new Date().toISOString(),
      };
      this.persistToDisk();
      return memoryRules[existingIndex];
    }
    const nextId = memoryRules.reduce((max: number, r: any) => Math.max(max, r.id || 0), 0) + 1;
    const newRule = {
      id: nextId,
      mosqueId,
      imamId,
      relationshipType: data.relationshipType,
      priority: data.priority ? Number(data.priority) : 1,
      notes: data.notes || null,
      createdAt: new Date().toISOString(),
    };
    memoryRules.push(newRule);
    this.persistToDisk();
    return newRule;
  },

  deleteRule(id: number) {
    memoryRules = memoryRules.filter((r: any) => Number(r.id) !== Number(id));
    this.persistToDisk();
    return true;
  },

  saveFixedPattern(mosqueId: number, body: any) {
    const { hijriYear, hijriMonth, patternType, fridaysCount, items = [], notes, applyToFullYear } = body;
    const hYear = Number(hijriYear);
    const targetMonths = applyToFullYear ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [Number(hijriMonth)];

    let lastPatternId = 0;

    for (const hMonth of targetMonths) {
      let mFridaysCount = Number(fridaysCount) || 5;
      try {
        const details = CalendarService.getHijriMonthDetails(hYear, hMonth);
        if (details && details.fridaysCount) {
          mFridaysCount = details.fridaysCount;
        }
      } catch {}

      const existingIndex = memoryPatterns.findIndex(
        (p: any) => Number(p.mosqueId) === mosqueId && Number(p.hijriYear) === hYear && Number(p.hijriMonth) === hMonth
      );

      let patternId: number;
      if (existingIndex >= 0) {
        patternId = memoryPatterns[existingIndex].id;
        memoryPatterns[existingIndex] = {
          ...memoryPatterns[existingIndex],
          patternType,
          fridaysCount: mFridaysCount,
          notes: notes || null,
          updatedAt: new Date().toISOString(),
        };
        // Remove existing items
        memoryPatternItems = memoryPatternItems.filter((pi: any) => Number(pi.patternId) !== patternId);
      } else {
        patternId = memoryPatterns.reduce((max: number, p: any) => Math.max(max, p.id || 0), 0) + 1;
        memoryPatterns.push({
          id: patternId,
          mosqueId,
          hijriYear: hYear,
          hijriMonth: hMonth,
          patternType,
          fridaysCount: mFridaysCount,
          isActive: true,
          notes: notes || null,
          createdAt: new Date().toISOString(),
        });
      }

      lastPatternId = patternId;

      // Filter and insert items for this month's Friday count
      const itemsToInsert = items
        .filter((it: any) => Number(it.fridayIndex) <= mFridaysCount)
        .map((item: any, idx: number) => ({
          id: memoryPatternItems.reduce((max: number, pi: any) => Math.max(max, pi.id || 0), 0) + idx + 1,
          patternId,
          fridayIndex: Number(item.fridayIndex),
          imamId: Number(item.imamId),
          sequence: idx + 1,
          notes: item.notes || null,
        }));

      memoryPatternItems.push(...itemsToInsert);
    }

    // Update legacy fixed pattern on mosque if SAME_ALL
    if (patternType === 'SAME_ALL' && items[0]?.imamId) {
      this.updateMosque(mosqueId, {
        fixedImamId: Number(items[0].imamId),
        fixedPattern: 'ALL',
        fixedCount: Number(fridaysCount) || 5,
      });
    }

    this.persistToDisk();
    return {
      success: true,
      message: applyToFullYear
        ? `تم تثبيت النمط المعتمد للمسجد لجميع أشهر العام الهجري ${hYear} هـ بالكامل (12 شهراً)`
        : 'تم حفظ نمط التثبيت للمسجد بنجاح',
      patternId: lastPatternId,
    };
  },

  copyFixedPattern(mosqueId: number, sourceYear: number, sourceMonth: number, targetYear: number, targetMonth: number) {
    const sYear = Number(sourceYear);
    const sMonth = Number(sourceMonth);
    const tYear = Number(targetYear);
    const tMonth = Number(targetMonth);

    const sourcePattern = memoryPatterns.find(
      (p: any) => Number(p.mosqueId) === mosqueId && Number(p.hijriYear) === sYear && Number(p.hijriMonth) === sMonth
    );

    if (!sourcePattern) {
      throw new Error('لم يتم العثور على نمط محفوظ في الشهر المصدر');
    }

    const sourceItems = memoryPatternItems.filter((pi: any) => Number(pi.patternId) === sourcePattern.id);
    const targetDetails = CalendarService.getHijriMonthDetails(tYear, tMonth);
    const targetFridaysCount = targetDetails.fridaysCount;

    return this.saveFixedPattern(mosqueId, {
      hijriYear: tYear,
      hijriMonth: tMonth,
      patternType: sourcePattern.patternType,
      fridaysCount: targetFridaysCount,
      items: sourceItems.map((si: any) => ({
        fridayIndex: si.fridayIndex,
        imamId: si.imamId,
        notes: si.notes,
      })),
    });
  },

  deleteFixedPattern(patternId: number) {
    const pId = Number(patternId);
    memoryPatterns = memoryPatterns.filter((p: any) => Number(p.id) !== pId);
    memoryPatternItems = memoryPatternItems.filter((pi: any) => Number(pi.patternId) !== pId);
    this.persistToDisk();
    return true;
  },

  bulkDeleteMosques(ids: number[]) {
    const idSet = new Set(ids.map(Number));
    memoryMosques = memoryMosques.filter((m: any) => !idSet.has(Number(m.id)));
    this.persistToDisk();
    return ids.length;
  },

  bulkDeleteImams(ids: number[]) {
    const idSet = new Set(ids.map(Number));
    memoryImams = memoryImams.filter((i: any) => !idSet.has(Number(i.id)));
    this.persistToDisk();
    return ids.length;
  },

  persistToDisk() {
    try {
      const seedPath = path.resolve('src/db/initialSeed.json');
      const payload = {
        ...seedData,
        mosques: memoryMosques,
        imams: memoryImams,
        mosqueImamRules: memoryRules,
        monthlySchedules: memorySchedules,
        fridays: memoryFridays,
        assignments: memoryAssignments,
        conflicts: memoryConflicts,
        overrides: memoryOverrides,
        fixedAssignmentPatterns: memoryPatterns,
        fixedAssignmentPatternItems: memoryPatternItems,
      };
      fs.writeFileSync(seedPath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (e) {
      console.warn('Could not persist memoryStore to initialSeed.json:', e);
    }
  },
};

