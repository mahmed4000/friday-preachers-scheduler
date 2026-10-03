import fs from 'fs';
import path from 'path';
import { CalendarService } from '../services/calendar/calendarService.ts';

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
    return memorySchedules.map((s: any) => {
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
};
