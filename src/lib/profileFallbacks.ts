import initialSeed from '../db/initialSeed.json';
import {
  ImamProfileData,
  MosqueProfileData,
  ProfileAssignmentItem,
  ScheduleSummaryItem,
  Imam,
  Mosque,
} from '../types/index.ts';
import { CalendarService } from '../services/calendar/calendarService.ts';

const seed = initialSeed as any;

export function getFallbackImamProfile(
  id: number,
  scheduleId?: number
): ImamProfileData | null {
  const imam = (seed.imams || []).find((i: any) => i.id === id);
  if (!imam) return null;

  const mosques = seed.mosques || [];
  const fridays = seed.fridays || [];
  const schedules = seed.monthlySchedules || [];
  const assignments = seed.assignments || [];
  const rules = seed.mosqueImamRules || [];

  const mosqueMap = new Map<number, any>(mosques.map((m: any) => [m.id, m]));
  const fridayMap = new Map<number, any>(fridays.map((f: any) => [f.id, f]));
  const scheduleMap = new Map<number, any>(schedules.map((s: any) => [s.id, s]));

  const allAssignments = assignments.filter((a: any) => a.imamId === id);

  const activeSchedule = CalendarService.resolveCanonicalSchedule<ScheduleSummaryItem>(schedules as any, scheduleId);

  const profileAssignments: ProfileAssignmentItem[] = allAssignments.map((a: any) => {
    const f = fridayMap.get(a.fridayId);
    const m = mosqueMap.get(a.mosqueId);
    const s = scheduleMap.get(a.scheduleId);
    const isUpcoming = CalendarService.isFridayUpcoming(
      s?.hijriYear || 1448,
      s?.hijriMonth || 1,
      a.fridayIndex,
      s?.periodStatus
    );

    return {
      id: a.id,
      scheduleId: a.scheduleId,
      fridayId: a.fridayId,
      fridayIndex: a.fridayIndex,
      hijriDate: f?.hijriDate || `جمعة ${a.fridayIndex}`,
      gregorianDate: f?.gregorianDate || undefined,
      monthName: s?.monthName || 'غير محدد',
      hijriYear: s?.hijriYear || 1448,
      hijriMonth: s?.hijriMonth,
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

  const pastAssignments = profileAssignments.filter((a: any) => !a.isUpcoming);

  const imamRules = rules
    .filter((r: any) => r.imamId === id)
    .map((r: any) => {
      const m = mosqueMap.get(r.mosqueId);
      return {
        ...r,
        mosqueName: m?.name || `مسجد #${r.mosqueId}`,
        mosqueRegion: m?.region || '',
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
    const m = mosqueMap.get(mId);
    const rule = imamRules.find((r: any) => r.mosqueId === mId);
    return {
      mosqueId: mId,
      mosqueName: m?.name || `مسجد #${mId}`,
      mosqueCode: m?.code || '',
      mosqueRegion: m?.region || '',
      relationshipType: rule?.relationshipType,
      priority: rule?.priority,
      assignedCount: data.count,
      lastDate: data.lastDate,
      nextDate: data.nextDate,
    };
  }).sort((x, y) => y.assignedCount - x.assignedCount);

  const stats = {
    totalAssigned: profileAssignments.length,
    currentMonthFridaysCount: upcomingAssignments.length,
    currentScheduleFridaysTotal: activeSchedule?.fridaysCount || 4,
    currentMonthName: activeSchedule?.monthName || '',
    currentHijriYear: activeSchedule?.hijriYear || 1448,
    currentScheduleStatus: activeSchedule?.status || 'APPROVED',
    lifetimeTotalAssigned: profileAssignments.length,
    mosquesCount: linkedMosques.length,
    upcomingCount: upcomingAssignments.length,
    pastCount: pastAssignments.length,
    availabilitiesCount: 0,
    minFridays: imam.minFridays || 0,
    targetFridays: imam.targetFridays || 4,
    maxFridays: imam.maxFridays || 5,
  };

  return {
    imam,
    activeSchedule,
    availableSchedules: CalendarService.sortSchedulesForSelection(schedules).map((s: any) => ({
      id: s.id,
      monthName: s.monthName,
      hijriYear: s.hijriYear,
      hijriMonth: s.hijriMonth || 1,
      fridaysCount: s.fridaysCount,
      status: s.status,
    })),
    stats,
    assignments: profileAssignments,
    upcomingAssignments,
    linkedMosques,
    rules: imamRules,
    availabilities: [],
    auditLogs: [],
  };
}

export function getFallbackMosqueProfile(
  id: number,
  scheduleId?: number
): MosqueProfileData | null {
  const mosque = (seed.mosques || []).find((m: any) => m.id === id);
  if (!mosque) return null;

  const imams = seed.imams || [];
  const fridays = seed.fridays || [];
  const schedules = seed.monthlySchedules || [];
  const assignments = seed.assignments || [];
  const rules = seed.mosqueImamRules || [];

  const imamMap = new Map<number, any>(imams.map((i: any) => [i.id, i]));
  const fridayMap = new Map<number, any>(fridays.map((f: any) => [f.id, f]));
  const scheduleMap = new Map<number, any>(schedules.map((s: any) => [s.id, s]));

  const fixedImam = mosque.fixedImamId ? imamMap.get(mosque.fixedImamId) || null : null;
  const allAssignments = assignments.filter((a: any) => a.mosqueId === id);

  const activeSchedule = CalendarService.resolveCanonicalSchedule<ScheduleSummaryItem>(schedules as any, scheduleId);

  const profileAssignments: ProfileAssignmentItem[] = allAssignments.map((a: any) => {
    const f = fridayMap.get(a.fridayId);
    const s = scheduleMap.get(a.scheduleId);
    const i = a.imamId ? imamMap.get(a.imamId) : null;
    const isUpcoming = CalendarService.isFridayUpcoming(
      s?.hijriYear || 1448,
      s?.hijriMonth || 1,
      a.fridayIndex,
      s?.periodStatus
    );

    return {
      id: a.id,
      scheduleId: a.scheduleId,
      fridayId: a.fridayId,
      fridayIndex: a.fridayIndex,
      hijriDate: f?.hijriDate || `جمعة ${a.fridayIndex}`,
      gregorianDate: f?.gregorianDate || undefined,
      monthName: s?.monthName || 'غير محدد',
      hijriYear: s?.hijriYear || 1448,
      hijriMonth: s?.hijriMonth,
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

  const allRules = rules.filter((r: any) => r.mosqueId === id);
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
    availableSchedules: CalendarService.sortSchedulesForSelection(schedules).map((s: any) => ({
      id: s.id,
      monthName: s.monthName,
      hijriYear: s.hijriYear,
      hijriMonth: s.hijriMonth || 1,
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
}
