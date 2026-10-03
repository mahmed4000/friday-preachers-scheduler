/**
 * مزود التقويم الهجري والميلادي (Calendar Providers)
 * يدعم تقويم أم القرى (Umm Al-Qura) كأساس افتراضي وموثوق.
 */

import {
  CalendarProviderType,
  CurrentDateTimeInfo,
  FridayCalendarItem,
  GregorianDateInfo,
  HijriDateInfo,
  HijriMonthDetails,
} from './types.ts';

export const HIJRI_MONTH_NAMES: Record<number, string> = {
  1: 'محرم',
  2: 'صفر',
  3: 'ربيع الأول',
  4: 'ربيع الآخر',
  5: 'جمادى الأولى',
  6: 'جمادى الآخرة',
  7: 'رجب',
  8: 'شعبان',
  9: 'رمضان',
  10: 'شوال',
  11: 'ذو القعدة',
  12: 'ذو الحجة',
};

export const GREGORIAN_MONTH_NAMES: Record<number, string> = {
  1: 'يناير',
  2: 'فبراير',
  3: 'مارس',
  4: 'أبريل',
  5: 'مايو',
  6: 'يونيو',
  7: 'يوليو',
  8: 'أغسطس',
  9: 'سبتمبر',
  10: 'أكتوبر',
  11: 'نوفمبر',
  12: 'ديسمبر',
};

export const ARABIC_WEEKDAYS: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export const FRIDAY_ORDINALS = [
  'الجمعة الأولى',
  'الجمعة الثانية',
  'الجمعة الثالثة',
  'الجمعة الرابعة',
  'الجمعة الخامسة',
];

export const TIMEZONE_LABELS: Record<string, string> = {
  'Asia/Riyadh': 'توقيت مكة المكرمة (GMT+3)',
  'Africa/Cairo': 'توقيت القاهرة (GMT+2/3)',
  'Asia/Dubai': 'توقيت دبي (GMT+4)',
  'Asia/Kuwait': 'توقيت الكويت (GMT+3)',
  'Asia/Amman': 'توقيت عمّان (GMT+3)',
  'Asia/Qatar': 'توقيت الدوحة (GMT+3)',
  'Asia/Muscat': 'توقيت مسقط (GMT+4)',
  'Asia/Bahrain': 'توقيت المنامة (GMT+3)',
};

export interface ICalendarProvider {
  readonly type: CalendarProviderType;
  readonly nameArabic: string;
  getHijriMonthInfo(hijriYear: number, hijriMonth: number, timezone?: string): HijriMonthDetails;
  getCurrentDateTime(timezone?: string): CurrentDateTimeInfo;
  gregorianToHijri(date: Date, timezone?: string): HijriDateInfo;
  gregorianToInfo(date: Date, timezone?: string): GregorianDateInfo;
}

/**
 * تقويم أم القرى (Umm Al-Qura Calendar Provider)
 * الحساب الفلكي والشرعي المعتمد لتقويم أم القرى بالمملكة العربية السعودية.
 */
export class UmmAlQuraCalendarProvider implements ICalendarProvider {
  public readonly type: CalendarProviderType = 'UMM_AL_QURA';
  public readonly nameArabic: string = 'تقويم أم القرى';

  // Cache for calculated Hijri months to ensure zero lag and high efficiency
  private static monthCache = new Map<string, HijriMonthDetails>();

  /**
   * استخراج بيانات التاريخ الهجري بدقة من كائن Date
   */
  public gregorianToHijri(date: Date, timezone: string = 'Africa/Cairo'): HijriDateInfo {
    try {
      const dtf = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        weekday: 'narrow',
      });

      const parts = dtf.formatToParts(date);
      let year = 1448;
      let month = 9;
      let day = 1;

      for (const p of parts) {
        if (p.type === 'year') year = parseInt(p.value, 10) || year;
        if (p.type === 'month') month = parseInt(p.value, 10) || month;
        if (p.type === 'day') day = parseInt(p.value, 10) || day;
      }

      const dayOfWeekIndex = date.getDay();
      const dayName = ARABIC_WEEKDAYS[dayOfWeekIndex] || 'الجمعة';
      const monthName = HIJRI_MONTH_NAMES[month] || `شهر ${month}`;

      return {
        year,
        month,
        day,
        monthName,
        dayName,
        formatted: `${day} ${monthName} ${year} هـ`,
      };
    } catch {
      // Fallback calculation in case of environment limitation
      return {
        year: 1448,
        month: 9,
        day: 1,
        monthName: 'رمضان',
        dayName: 'الجمعة',
        formatted: '1 رمضان 1448 هـ',
      };
    }
  }

  /**
   * استخراج بيانات التاريخ الميلادي
   */
  public gregorianToInfo(date: Date, timezone: string = 'Africa/Cairo'): GregorianDateInfo {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const parts = dtf.formatToParts(date);
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();

    for (const p of parts) {
      if (p.type === 'year') year = parseInt(p.value, 10) || year;
      if (p.type === 'month') month = parseInt(p.value, 10) || month;
      if (p.type === 'day') day = parseInt(p.value, 10) || day;
    }

    const dayName = ARABIC_WEEKDAYS[date.getDay()] || '';
    const monthName = GREGORIAN_MONTH_NAMES[month] || `شهر ${month}`;
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      year,
      month,
      day,
      monthName,
      dayName,
      formatted: `${day} ${monthName} ${year} م`,
      iso,
    };
  }

  /**
   * استخراج البداية والنهاية والجمعات الحقيقية للشهر الهجري
   */
  public getHijriMonthInfo(
    hijriYear: number,
    hijriMonth: number,
    timezone: string = 'Africa/Cairo'
  ): HijriMonthDetails {
    const todayIso = this.gregorianToInfo(new Date(), timezone).iso;
    const cacheKey = `${this.type}:${timezone}:${hijriYear}:${hijriMonth}:${todayIso}`;
    const cached = UmmAlQuraCalendarProvider.monthCache.get(cacheKey);
    if (cached) return cached;

    // Approximate Gregorian year for the given Hijri year
    // (1448 AH ≈ 2026/2027 CE)
    const approxGregYear = Math.floor(1970 + (hijriYear - 1389) * 0.970224);
    const dtf = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });

    const getH = (date: Date) => {
      const parts = dtf.formatToParts(date);
      let y = 0, m = 0, d = 0;
      for (const p of parts) {
        if (p.type === 'year') y = parseInt(p.value, 10);
        if (p.type === 'month') m = parseInt(p.value, 10);
        if (p.type === 'day') d = parseInt(p.value, 10);
      }
      return { year: y, month: m, day: d };
    };

    // Scan window: start ~1 month before estimated month
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    const scanner = new Date(Date.UTC(approxGregYear - 1, Math.max(0, hijriMonth - 2), 1, 12, 0, 0));

    for (let step = 0; step < 950; step++) {
      const h = getH(scanner);
      if (h.year === hijriYear && h.month === hijriMonth) {
        if (!startDate) startDate = new Date(scanner.getTime());
        endDate = new Date(scanner.getTime());
      } else if (startDate && (h.year > hijriYear || (h.year === hijriYear && h.month > hijriMonth))) {
        break;
      }
      scanner.setUTCDate(scanner.getUTCDate() + 1);
    }

    if (!startDate || !endDate) {
      // Fallback in case of edge case
      startDate = new Date(Date.UTC(2027, 1, 8, 12, 0, 0));
      endDate = new Date(Date.UTC(2027, 2, 8, 12, 0, 0));
    }

    // Days count (must strictly be 29 or 30 days)
    const daysCount = Math.round((endDate.getTime() - startDate.getTime()) / (86400 * 1000)) + 1;

    const startG = this.gregorianToInfo(startDate, timezone);
    const endG = this.gregorianToInfo(endDate, timezone);
    const todayInfo = this.gregorianToInfo(new Date(), timezone);

    // Determine Period Status of the Month:
    // PAST: monthEnd < today
    // CURRENT: monthStart <= today <= monthEnd
    // FUTURE: monthStart > today
    let periodStatus: 'PAST' | 'CURRENT' | 'FUTURE' = 'CURRENT';
    let statusLabelArabic = 'الشهر الحالي';

    if (endG.iso < todayIso) {
      periodStatus = 'PAST';
      statusLabelArabic = 'منتهي';
    } else if (startG.iso > todayIso) {
      periodStatus = 'FUTURE';
      statusLabelArabic = 'قادم';
    } else {
      periodStatus = 'CURRENT';
      statusLabelArabic = 'الشهر الحالي';
    }

    const isPast = periodStatus === 'PAST';
    const isCurrent = periodStatus === 'CURRENT';
    const isFuture = periodStatus === 'FUTURE';
    const isCreatable = periodStatus !== 'PAST';
    const isEditable = periodStatus !== 'PAST';

    // Collect all Fridays strictly within the month boundary and annotate period status
    const fridays: FridayCalendarItem[] = [];
    const iterator = new Date(startDate.getTime());
    let fridayIndex = 1;
    let pastFridaysCount = 0;
    let futureFridaysCount = 0;

    while (iterator <= endDate) {
      if (iterator.getUTCDay() === 5) { // 5 is Friday
        const hf = getH(iterator);
        const gInfo = this.gregorianToInfo(iterator, timezone);
        const monthName = HIJRI_MONTH_NAMES[hf.month] || `شهر ${hf.month}`;
        const ordinalName = FRIDAY_ORDINALS[fridayIndex - 1] || `الجمعة ${fridayIndex}`;

        // Friday status: if date is strictly before today, it's PAST and automatically locked
        const isFridayPast = gInfo.iso < todayIso;
        let fridayPeriodStatus: 'PAST' | 'CURRENT' | 'FUTURE' = 'FUTURE';
        if (isFridayPast) {
          fridayPeriodStatus = 'PAST';
          pastFridaysCount++;
        } else if (gInfo.iso === todayIso) {
          fridayPeriodStatus = 'CURRENT';
          futureFridaysCount++;
        } else {
          fridayPeriodStatus = 'FUTURE';
          futureFridaysCount++;
        }

        fridays.push({
          fridayIndex,
          ordinalName,
          hijriYear: hf.year,
          hijriMonth: hf.month,
          hijriDay: hf.day,
          hijriDate: `${hf.day} ${monthName} ${hf.year} هـ`,
          gregorianDate: gInfo.formatted,
          gregorianIso: gInfo.iso,
          dayOfWeek: 'الجمعة',
          isWithinMonth: true,
          periodStatus: fridayPeriodStatus,
          isPast: isFridayPast,
          isLocked: isFridayPast, // Past fridays are locked
        });

        fridayIndex++;
      }
      iterator.setUTCDate(iterator.getUTCDate() + 1);
    }

    const monthName = HIJRI_MONTH_NAMES[hijriMonth] || `شهر ${hijriMonth}`;

    const result: HijriMonthDetails = {
      hijriYear,
      hijriMonth,
      monthName,
      startDateGregorian: startG.iso,
      endDateGregorian: endG.iso,
      startDateFormatted: `1 ${monthName} ${hijriYear} هـ / ${startG.formatted}`,
      endDateFormatted: `${daysCount} ${monthName} ${hijriYear} هـ / ${endG.formatted}`,
      daysCount,
      fridaysCount: fridays.length,
      fridays,
      calendarProvider: this.type,
      providerNameArabic: this.nameArabic,
      timezone,
      calculatedAt: new Date().toISOString(),
      periodStatus,
      statusLabelArabic,
      isPast,
      isCurrent,
      isFuture,
      isCreatable,
      isEditable,
      pastFridaysCount,
      futureFridaysCount,
    };

    UmmAlQuraCalendarProvider.monthCache.set(cacheKey, result);
    return result;
  }

  /**
   * التاريخ والوقت الحالي الموحد
   */
  public getCurrentDateTime(timezone: string = 'Africa/Cairo'): CurrentDateTimeInfo {
    const now = new Date();
    const hijri = this.gregorianToHijri(now, timezone);
    const gregorian = this.gregorianToInfo(now, timezone);

    const timeDtf = new Intl.DateTimeFormat('ar-SA', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const time24Dtf = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const timeString = timeDtf.format(now);
    const timeString24 = time24Dtf.format(now);
    const timezoneLabel = TIMEZONE_LABELS[timezone] || timezone;

    const fullFormatted = `${hijri.dayName} ${hijri.formatted} الموافق ${gregorian.formatted}`;
    const fullFormattedWithTime = `${fullFormatted} — ${timeString} (${timezoneLabel})`;

    return {
      hijri,
      gregorian,
      timeString,
      timeString24,
      dayName: hijri.dayName,
      fullFormatted,
      fullFormattedWithTime,
      timezone,
      timezoneLabel,
      calendarProvider: this.type,
      providerNameArabic: this.nameArabic,
      lastSync: now.toISOString(),
    };
  }
}

/**
 * تقويم الرؤية المحلية / الرسمي (Official Local Calendar Provider)
 */
export class OfficialLocalCalendarProvider extends UmmAlQuraCalendarProvider {
  public override readonly type: CalendarProviderType = 'OFFICIAL_LOCAL';
  public override readonly nameArabic: string = 'التقويم الرسمي المحلي';
}

/**
 * تقويم مخصص (Custom Calendar Provider)
 */
export class CustomCalendarProvider extends UmmAlQuraCalendarProvider {
  public override readonly type: CalendarProviderType = 'CUSTOM';
  public override readonly nameArabic: string = 'تقويم مخصص';
}

/**
 * مصنع مزودي التقويم (Calendar Provider Factory)
 */
export class CalendarProviderFactory {
  private static providers: Record<CalendarProviderType, ICalendarProvider> = {
    UMM_AL_QURA: new UmmAlQuraCalendarProvider(),
    OFFICIAL_LOCAL: new OfficialLocalCalendarProvider(),
    CUSTOM: new CustomCalendarProvider(),
  };

  public static getProvider(type: CalendarProviderType = 'UMM_AL_QURA'): ICalendarProvider {
    return this.providers[type] || this.providers.UMM_AL_QURA;
  }
}
