/**
 * أنماط وأنواع نظام التقويم والتاريخ المركزي (Hijri-First Calendar System)
 */

export type CalendarProviderType = 'UMM_AL_QURA' | 'OFFICIAL_LOCAL' | 'CUSTOM';

export type SchedulePeriodStatus = 'PAST' | 'CURRENT' | 'FUTURE';

export interface HijriDateInfo {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayName: string;
  formatted: string; // e.g. "13 رمضان 1448 هـ"
}

export interface GregorianDateInfo {
  year: number;
  month: number;
  day: number;
  monthName: string;
  dayName: string;
  formatted: string; // e.g. "19 فبراير 2027 م"
  iso: string; // e.g. "2027-02-19"
}

export interface FridayCalendarItem {
  fridayIndex: number; // 1..5
  ordinalName: string; // "الجمعة الأولى", "الجمعة الثانية", ...
  hijriYear: number;
  hijriMonth: number;
  hijriDay: number;
  hijriDate: string; // e.g. "5 رمضان 1448 هـ"
  gregorianDate: string; // e.g. "12 فبراير 2027 م"
  gregorianIso: string; // "2027-02-12"
  dayOfWeek: string; // "الجمعة"
  isWithinMonth: boolean;
  periodStatus: SchedulePeriodStatus; // 'PAST' | 'CURRENT' | 'FUTURE'
  isPast: boolean;
  isLocked: boolean; // True if Friday is in the past
}

export interface HijriMonthDetails {
  hijriYear: number;
  hijriMonth: number;
  monthName: string;
  startDateGregorian: string; // ISO "2027-02-08"
  endDateGregorian: string; // ISO "2027-03-08"
  startDateFormatted: string; // "1 رمضان 1448 هـ / 8 فبراير 2027 م"
  endDateFormatted: string; // "29 رمضان 1448 هـ / 8 مارس 2027 م"
  daysCount: number; // 29 or 30
  fridaysCount: number; // 4 or 5
  fridays: FridayCalendarItem[];
  calendarProvider: CalendarProviderType;
  providerNameArabic: string;
  timezone: string;
  calculatedAt: string;
  // Strict Time Policy fields
  periodStatus: SchedulePeriodStatus;
  statusLabelArabic: string; // 'منتهي' | 'الشهر الحالي' | 'قادم'
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isCreatable: boolean; // false for PAST
  isEditable: boolean; // false for PAST
  pastFridaysCount: number;
  futureFridaysCount: number;
}

export interface MonthPeriodSummaryItem {
  number: number;
  name: string;
  hijriYear: number;
  periodStatus: SchedulePeriodStatus;
  statusLabelArabic: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
  isCreatable: boolean;
  isEditable: boolean;
  startDateGregorian: string;
  endDateGregorian: string;
  fridaysCount: number;
  pastFridaysCount: number;
  futureFridaysCount: number;
}

export interface CurrentDateTimeInfo {
  hijri: HijriDateInfo;
  gregorian: GregorianDateInfo;
  timeString: string; // "03:45 م"
  timeString24: string; // "15:45"
  dayName: string; // "السبت"
  fullFormatted: string; // "السبت 22 ربيع الآخر 1448 هـ الموافق 3 أكتوبر 2026 م"
  fullFormattedWithTime: string; // "السبت 22 ربيع الآخر 1448 هـ الموافق 3 أكتوبر 2026 م - 03:45 م"
  timezone: string;
  timezoneLabel: string; // "توقيت مكة المكرمة (GMT+3)"
  calendarProvider: CalendarProviderType;
  providerNameArabic: string;
  lastSync: string;
}

export interface CalendarSettingsConfig {
  provider: CalendarProviderType;
  timezone: string;
  hijriAdjustmentDays?: number; // 0, +1, -1 for local sighting adjustment if needed
  lastSyncAt: string;
}
