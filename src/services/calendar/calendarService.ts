/**
 * خدمة التقويم والتاريخ المركزية (Centralized Hijri-First Calendar Service)
 * المرجع الموحد والوحيد للتاريخ والوقت والجمعات لجميع مكونات التطبيق والجدولة والتقارير.
 */

import {
  CalendarProviderFactory,
  HIJRI_MONTH_NAMES,
  GREGORIAN_MONTH_NAMES,
  ARABIC_WEEKDAYS,
  FRIDAY_ORDINALS,
  TIMEZONE_LABELS,
} from './calendarProvider.ts';
import type {
  CalendarProviderType,
  CurrentDateTimeInfo,
  FridayCalendarItem,
  HijriDateInfo,
  HijriMonthDetails,
  MonthPeriodSummaryItem,
  SchedulePeriodStatus,
} from './types.ts';

export interface CalendarServiceOptions {
  provider?: CalendarProviderType;
  timezone?: string;
}

export class CalendarService {
  private static defaultProvider: CalendarProviderType = 'UMM_AL_QURA';
  private static defaultTimezone: string = 'Africa/Cairo';
  private static lastSyncTimestamp: string = new Date().toISOString();

  /**
   * تعيين الإعدادات الافتراضية المركزية للخدمة
   */
  public static configureDefaults(provider?: CalendarProviderType, timezone?: string) {
    if (provider) this.defaultProvider = provider;
    if (timezone) this.defaultTimezone = timezone;
    this.lastSyncTimestamp = new Date().toISOString();
  }

  public static getDefaultProvider(): CalendarProviderType {
    return this.defaultProvider;
  }

  public static getDefaultTimezone(): string {
    return this.defaultTimezone;
  }

  public static getLastSyncTimestamp(): string {
    return this.lastSyncTimestamp;
  }

  /**
   * الحصول على معلومات وتفاصيل الشهر الهجري وجمعاته الفعلية وحالته الزمنية
   * هذه الدالة هي مصدر الحقيقة الرئيسي لإنشاء الجداول والتحقق الزمني
   */
  public static getHijriMonthDetails(
    hijriYear: number,
    hijriMonth: number,
    options?: CalendarServiceOptions
  ): HijriMonthDetails {
    const providerType = options?.provider || this.defaultProvider;
    const timezone = options?.timezone || this.defaultTimezone;
    const provider = CalendarProviderFactory.getProvider(providerType);

    return provider.getHijriMonthInfo(hijriYear, hijriMonth, timezone);
  }

  /**
   * الحصول على قائمة الجمعات الحقيقية للشهر الهجري المحدد
   * يستخدم مباشرة في محرك الجدولة (Scheduling Engine)
   */
  public static getHijriMonthFridays(
    hijriYear: number,
    hijriMonth: number,
    options?: CalendarServiceOptions
  ): FridayCalendarItem[] {
    const details = this.getHijriMonthDetails(hijriYear, hijriMonth, options);
    return details.fridays;
  }

  /**
   * الحصول على التاريخ والوقت الحالي الموحد وفق التقويم والمنطقة الزمنية
   */
  public static getCurrentDateTime(options?: CalendarServiceOptions): CurrentDateTimeInfo {
    const providerType = options?.provider || this.defaultProvider;
    const timezone = options?.timezone || this.defaultTimezone;
    const provider = CalendarProviderFactory.getProvider(providerType);

    const info = provider.getCurrentDateTime(timezone);
    info.lastSync = this.lastSyncTimestamp;
    return info;
  }

  /**
   * التحقق الصارم من حالة الشهر قبل الإنشاء أو التعديل (Strict Time Policy Validation)
   */
  public static validateSchedulePeriod(
    hijriYear: number,
    hijriMonth: number,
    options?: CalendarServiceOptions
  ): {
    isValid: boolean;
    periodStatus: SchedulePeriodStatus;
    error?: string;
    monthDetails: HijriMonthDetails;
  } {
    const monthDetails = this.getHijriMonthDetails(hijriYear, hijriMonth, options);
    if (monthDetails.periodStatus === 'PAST') {
      return {
        isValid: false,
        periodStatus: 'PAST',
        error: 'هذا الشهر انتهى بالفعل ولا يمكن إنشاء جدول جديد له. يمكنك تعديل جدول الشهر الحالي أو إنشاء جدول لشهر قادم.',
        monthDetails,
      };
    }

    return {
      isValid: true,
      periodStatus: monthDetails.periodStatus,
      monthDetails,
    };
  }

  /**
   * التحقق من جمعة معينة هل هي في الماضي ومحمية من التعديل (Past Friday Locked)
   */
  public static validateFridayAction(
    hijriYear: number,
    hijriMonth: number,
    fridayIndex: number,
    options?: CalendarServiceOptions
  ): {
    isAllowed: boolean;
    isPastFriday: boolean;
    reason?: string;
    fridayItem?: FridayCalendarItem;
  } {
    const monthDetails = this.getHijriMonthDetails(hijriYear, hijriMonth, options);
    if (monthDetails.periodStatus === 'PAST') {
      return {
        isAllowed: false,
        isPastFriday: true,
        reason: 'هذا الشهر انتهى بالكامل وهو متاح للاطلاع والتقارير فقط.',
      };
    }

    const fridayItem = monthDetails.fridays.find((f) => f.fridayIndex === fridayIndex);
    if (!fridayItem) {
      return {
        isAllowed: false,
        isPastFriday: false,
        reason: `الجمعة رقم (${fridayIndex}) غير موجودة في هذا الشهر.`,
      };
    }

    if (fridayItem.isPast) {
      return {
        isAllowed: false,
        isPastFriday: true,
        reason: 'هذه الجمعة انتهت بالفعل ولا يمكن تعديل التعيين من خلال الجدولة الحالية. يمكنك الاطلاع عليها من سجل الجداول والتاريخ.',
        fridayItem,
      };
    }

    return {
      isAllowed: true,
      isPastFriday: false,
      fridayItem,
    };
  }

  /**
   * قائمة الشهور الـ 12 لسنة هجرية مع حالة كل شهر (منتهي / الحالي / قادم)
   */
  public static getHijriMonthsWithStatus(
    hijriYear: number,
    options?: CalendarServiceOptions
  ): MonthPeriodSummaryItem[] {
    const list: MonthPeriodSummaryItem[] = [];
    for (let m = 1; m <= 12; m++) {
      const details = this.getHijriMonthDetails(hijriYear, m, options);
      list.push({
        number: m,
        name: details.monthName,
        hijriYear,
        periodStatus: details.periodStatus,
        statusLabelArabic: details.statusLabelArabic,
        isPast: details.isPast,
        isCurrent: details.isCurrent,
        isFuture: details.isFuture,
        isCreatable: details.isCreatable,
        isEditable: details.isEditable,
        startDateGregorian: details.startDateGregorian,
        endDateGregorian: details.endDateGregorian,
        fridaysCount: details.fridaysCount,
        pastFridaysCount: details.pastFridaysCount,
        futureFridaysCount: details.futureFridaysCount,
      });
    }
    return list;
  }

  /**
   * اختيار الشهر الافتراضي الذكي عند فتح معالج إنشاء الجداول:
   * 1. الشهر الحالي إذا لم يكن قد أُنشئ له جدول بعد.
   * 2. أول شهر قادم متاح للجدولة إذا كان الشهر الحالي مُنشأ بالفعل.
   */
  public static getDefaultWizardMonth(
    existingSchedules: Array<{ hijriYear: number; hijriMonth: number }> = [],
    options?: CalendarServiceOptions
  ): { hijriYear: number; hijriMonth: number } {
    const current = this.getCurrentDateTime(options);
    const curYear = current.hijri.year;
    const curMonth = current.hijri.month;

    // Check if current month exists in existingSchedules
    const curExists = existingSchedules.some(
      (s) => s.hijriYear === curYear && s.hijriMonth === curMonth
    );

    if (!curExists) {
      const curDetails = this.getHijriMonthDetails(curYear, curMonth, options);
      if (curDetails.periodStatus !== 'PAST') {
        return { hijriYear: curYear, hijriMonth: curMonth };
      }
    }

    // Search upcoming future months
    let testYear = curYear;
    let testMonth = curMonth + 1;
    if (testMonth > 12) {
      testMonth = 1;
      testYear += 1;
    }

    for (let step = 0; step < 12; step++) {
      const exists = existingSchedules.some(
        (s) => s.hijriYear === testYear && s.hijriMonth === testMonth
      );
      if (!exists) {
        return { hijriYear: testYear, hijriMonth: testMonth };
      }
      testMonth++;
      if (testMonth > 12) {
        testMonth = 1;
        testYear++;
      }
    }

    return { hijriYear: curYear, hijriMonth: curMonth < 12 ? curMonth + 1 : 1 };
  }

  /**
   * تحديد ما إذا كانت جمعة أو تكليف زمني يقع في المستقبل/القادم أم انتهى بالفعل
   * وفق الحساب الزمني الدقيق للتقويم الهجري المركزي
   */
  public static isFridayUpcoming(
    hijriYear: number,
    hijriMonth: number,
    fridayIndex: number,
    periodStatus?: string
  ): boolean {
    if (periodStatus === 'PAST') return false;
    if (periodStatus === 'FUTURE') return true;

    const currentDT = this.getCurrentDateTime();
    const curVal = currentDT.hijri.year * 12 + currentDT.hijri.month;
    const targetVal = hijriYear * 12 + hijriMonth;

    if (targetVal > curVal) return true;
    if (targetVal < curVal) return false;

    // نفس الشهر الحالي: التحقق هل مضت هذه الجمعة فعلياً
    const validation = this.validateFridayAction(hijriYear, hijriMonth, fridayIndex);
    return !validation.isPastFriday;
  }

  /**
   * تحويل تاريخ ميلادي إلى هجري موحد
   */
  public static gregorianToHijri(date: Date, options?: CalendarServiceOptions): HijriDateInfo {
    const providerType = options?.provider || this.defaultProvider;
    const timezone = options?.timezone || this.defaultTimezone;
    const provider = CalendarProviderFactory.getProvider(providerType);

    return provider.gregorianToHijri(date, timezone);
  }

  /**
   * تنسيق التاريخ الثنائي (هجري أولاً ثم ميلادي)
   * مثال: "13 رمضان 1448 هـ الموافق 19 فبراير 2027 م"
   */
  public static formatBilingualDate(hijriDate: string, gregorianDate?: string): string {
    if (!gregorianDate) return hijriDate;
    return `${hijriDate} (الموافق: ${gregorianDate})`;
  }

  /**
   * قائمة السنوات الهجرية المتاحة للاختيار
   */
  public static getAvailableHijriYears(): number[] {
    const currentYear = this.getCurrentDateTime().hijri.year;
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 4; y++) {
      years.push(y);
    }
    return years;
  }

  /**
   * قائمة الشهور الهجرية الـ 12 مع الأسماء
   */
  public static getHijriMonthsList(): Array<{ id: number; number: number; name: string }> {
    return Object.entries(HIJRI_MONTH_NAMES).map(([num, name]) => ({
      id: Number(num),
      number: Number(num),
      name,
    }));
  }

  /**
   * جلب اسم الشهر الهجري بدلالة رقمه
   */
  public static getHijriMonthName(monthNumber: number): string {
    return HIJRI_MONTH_NAMES[monthNumber] || `الشهر ${monthNumber}`;
  }

  /**
   * مزامنة وتحديث حالة التقويم والوقت
   */
  public static syncCalendar(options?: CalendarServiceOptions): CurrentDateTimeInfo {
    this.lastSyncTimestamp = new Date().toISOString();
    return this.getCurrentDateTime(options);
  }

  /**
   * ترتيب الجداول الشهرية بحسب السياسة المعتمدة:
   * 1. الشهر الحالي في المقدمة دائماً (Rank 0).
   * 2. الشهور القادمة تالياً مرتبة تصاعدياً بحسب التاريخ الهجري (Rank 1).
   * 3. الشهور السابقة (الأرشيف) في النهاية مرتبة تنازلياً (الأحدث ماضياً أولاً) (Rank 2).
   */
  public static sortSchedulesChronologically<T extends {
    hijriYear?: number;
    hijriMonth?: number;
    isCurrent?: boolean;
    isPast?: boolean;
    isFuture?: boolean;
    periodStatus?: string;
  }>(schedules: T[]): T[] {
    return [...schedules].sort((a, b) => {
      const aIsCurrent = a.isCurrent ?? (a.periodStatus === 'CURRENT');
      const bIsCurrent = b.isCurrent ?? (b.periodStatus === 'CURRENT');
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      const aIsPast = a.isPast ?? (a.periodStatus === 'PAST');
      const bIsPast = b.isPast ?? (b.periodStatus === 'PAST');

      if (!aIsPast && bIsPast) return -1;
      if (aIsPast && !bIsPast) return 1;

      const aVal = (a.hijriYear || 0) * 12 + (a.hijriMonth || 0);
      const bVal = (b.hijriYear || 0) * 12 + (b.hijriMonth || 0);

      if (aIsPast && bIsPast) {
        return bVal - aVal;
      }

      return aVal - bVal;
    });
  }

  /**
   * اختيار الجدول المعتمد الافتراضي (المركزي) وفق التقويم الهجري الحالي
   * يضمن البدء بالشهر الحالي، ثم أقرب شهر مستقبلي معتمد، وتجنب القفز لشهور بعيدة
   */
  public static resolveCanonicalSchedule<
    T extends { id: number; hijriYear: number; hijriMonth: number; status?: string }
  >(schedules: T[], requestedScheduleId?: number): T | null {
    if (!schedules || schedules.length === 0) return null;

    if (requestedScheduleId) {
      const found = schedules.find((s) => s.id === requestedScheduleId);
      if (found) return found;
    }

    const currentDT = this.getCurrentDateTime();
    const currYear = currentDT.hijri.year;
    const currMonth = currentDT.hijri.month;
    const currVal = currYear * 12 + currMonth;

    const statusWeight: Record<string, number> = {
      PUBLISHED: 4,
      APPROVED: 3,
      REVIEW: 2,
      DRAFT: 1,
    };

    // 1. الشهر الحالي تماماً
    const currentMonthSchedules = schedules.filter(
      (s) => s.hijriYear === currYear && s.hijriMonth === currMonth
    );
    if (currentMonthSchedules.length > 0) {
      return [...currentMonthSchedules].sort(
        (a, b) => (statusWeight[b.status || ''] || 0) - (statusWeight[a.status || ''] || 0)
      )[0];
    }

    // 2. أقرب جدول مستقبلي معتمد أو منشور (Upcoming Active)
    const upcomingActive = schedules
      .filter(
        (s) =>
          s.hijriYear * 12 + s.hijriMonth >= currVal &&
          (s.status === 'APPROVED' || s.status === 'PUBLISHED')
      )
      .sort((a, b) => {
        const aVal = a.hijriYear * 12 + a.hijriMonth;
        const bVal = b.hijriYear * 12 + b.hijriMonth;
        if (aVal !== bVal) return aVal - bVal; // الأقرب زمنياً أولاً
        return (statusWeight[b.status || ''] || 0) - (statusWeight[a.status || ''] || 0);
      });
    if (upcomingActive.length > 0) {
      return upcomingActive[0];
    }

    // 3. أقرب جدول مستقبلي عام (حتى لو مسودة أو مراجعة)
    const upcomingAll = schedules
      .filter((s) => s.hijriYear * 12 + s.hijriMonth >= currVal)
      .sort((a, b) => {
        const aVal = a.hijriYear * 12 + a.hijriMonth;
        const bVal = b.hijriYear * 12 + b.hijriMonth;
        if (aVal !== bVal) return aVal - bVal;
        return (statusWeight[b.status || ''] || 0) - (statusWeight[a.status || ''] || 0);
      });
    if (upcomingAll.length > 0) {
      return upcomingAll[0];
    }

    // 4. أحدث جدول في الماضي
    const pastSchedules = schedules
      .filter((s) => s.hijriYear * 12 + s.hijriMonth < currVal)
      .sort((a, b) => {
        const aVal = a.hijriYear * 12 + a.hijriMonth;
        const bVal = b.hijriYear * 12 + b.hijriMonth;
        return bVal - aVal; // الأحدث ماضياً أولاً
      });
    if (pastSchedules.length > 0) {
      return pastSchedules[0];
    }

    return schedules[0] || null;
  }

  /**
   * ترتيب قائمة الجداول المتاحة في القوائم المنسدلة:
   * الشهر الحالي أولاً، ثم الشهور المستقبلية تصاعدياً، ثم الشهور الماضية تنازلياً
   */
  public static sortSchedulesForSelection<
    T extends { id: number; hijriYear: number; hijriMonth: number; status?: string }
  >(schedules: T[]): T[] {
    if (!schedules || schedules.length === 0) return [];
    const currentDT = this.getCurrentDateTime();
    const currVal = currentDT.hijri.year * 12 + currentDT.hijri.month;

    return [...schedules].sort((a, b) => {
      const aVal = a.hijriYear * 12 + a.hijriMonth;
      const bVal = b.hijriYear * 12 + b.hijriMonth;

      const aIsCurrent = aVal === currVal;
      const bIsCurrent = bVal === currVal;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      const aIsUpcoming = aVal > currVal;
      const bIsUpcoming = bVal > currVal;
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (!aIsUpcoming && bIsUpcoming) return 1;

      if (aIsUpcoming && bIsUpcoming) {
        return aVal - bVal; // Nearest future first
      }
      return bVal - aVal; // Most recent past first
    });
  }

  /**
   * إزالة التكرارات وضمان وجود تكليف واحد فقط لكل جمعة في الشهر
   */
  public static deduplicateAssignmentsByFriday<
    T extends { fridayIndex: number; id?: number; isLocked?: boolean }
  >(assignments: T[]): T[] {
    if (!assignments || assignments.length === 0) return [];
    const map = new Map<number, T>();
    for (const a of assignments) {
      const existing = map.get(a.fridayIndex);
      if (!existing) {
        map.set(a.fridayIndex, a);
      } else {
        if (a.isLocked && !existing.isLocked) {
          map.set(a.fridayIndex, a);
        } else if (!existing.isLocked || a.isLocked === existing.isLocked) {
          if ((a.id || 0) >= (existing.id || 0)) {
            map.set(a.fridayIndex, a);
          }
        }
      }
    }
    return Array.from(map.values()).sort((x, y) => x.fridayIndex - y.fridayIndex);
  }
}

export {
  HIJRI_MONTH_NAMES,
  GREGORIAN_MONTH_NAMES,
  ARABIC_WEEKDAYS,
  FRIDAY_ORDINALS,
  TIMEZONE_LABELS,
};
