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
import {
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
   * مزامنة وتحديث حالة التقويم والوقت
   */
  public static syncCalendar(options?: CalendarServiceOptions): CurrentDateTimeInfo {
    this.lastSyncTimestamp = new Date().toISOString();
    return this.getCurrentDateTime(options);
  }
}

export {
  HIJRI_MONTH_NAMES,
  GREGORIAN_MONTH_NAMES,
  ARABIC_WEEKDAYS,
  FRIDAY_ORDINALS,
  TIMEZONE_LABELS,
};
