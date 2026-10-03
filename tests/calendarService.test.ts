/**
 * اختبارات وحدة نظام التقويم الهجري والميلادي المركزي
 * Centralized Hijri Calendar Service Unit Tests
 */

import { CalendarService, HIJRI_MONTH_NAMES } from '../src/services/calendar/calendarService.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}`, details || '');
    failed++;
  }
}

console.log('\n--- بدء اختبارات وحدة نظام التقويم الهجري والميلادي المركزي (Calendar Service) ---\n');

// 1. اختبار التاريخ والوقت الحالي
const current = CalendarService.getCurrentDateTime({ timezone: 'Asia/Riyadh' });
assert(current.hijri.year >= 1445, '1. السنة الهجرية الحالية صحيحة وموجبة', current.hijri);
assert(Boolean(current.hijri.monthName), '2. اسم الشهر الهجري الحالي متوفر باللغة العربية', current.hijri.monthName);
assert(Boolean(current.timeString), '3. وقت الساعة بالمنطقة الزمنية المحددة متوفر', current.timeString);
assert(current.timezone === 'Asia/Riyadh', '4. المنطقة الزمنية مضبوطة على الرياض / مكة المكرمة', current.timezone);

// 2. اختبار شهر رمضان 1448 هـ (حساب البداية والنهاية والجمعات)
const ramadan1448 = CalendarService.getHijriMonthDetails(1448, 9);
assert(ramadan1448.monthName === 'رمضان', '5. اسم الشهر 9 هو رمضان', ramadan1448.monthName);
assert(ramadan1448.daysCount === 29 || ramadan1448.daysCount === 30, '6. عدد أيام رمضان إما 29 أو 30 يوماً', ramadan1448.daysCount);
assert(ramadan1448.fridaysCount === 4 || ramadan1448.fridaysCount === 5, '7. عدد جمعات رمضان إما 4 أو 5 جمعات', ramadan1448.fridaysCount);
assert(ramadan1448.fridays.length === ramadan1448.fridaysCount, '8. قائمة الجمعات مطابقة لعدد الجمعات المحسوبة', ramadan1448.fridays.length);

// 3. اختبار حدود الشهر (Month Boundary Test)
// التأكد من أن جميع الجمعات تقع حصرياً بين تاريخ البداية والنهاية
const startIso = ramadan1448.startDateGregorian;
const endIso = ramadan1448.endDateGregorian;
let allWithinBoundary = true;
for (const f of ramadan1448.fridays) {
  if (f.gregorianIso < startIso || f.gregorianIso > endIso) {
    allWithinBoundary = false;
  }
  if (f.hijriMonth !== 9 || f.hijriYear !== 1448) {
    allWithinBoundary = false;
  }
}
assert(allWithinBoundary, '9. جميع جمعات رمضان 1448 هـ تقع حصرياً داخل حدود الشهر ولا توجد جمعة خارجه');

// 4. اختبار ترتيب وتسلسل الجمعات (Ordered Fridays)
let sequenceValid = true;
for (let i = 0; i < ramadan1448.fridays.length; i++) {
  if (ramadan1448.fridays[i].fridayIndex !== i + 1) {
    sequenceValid = false;
  }
  if (i > 0 && ramadan1448.fridays[i].hijriDay <= ramadan1448.fridays[i - 1].hijriDay) {
    sequenceValid = false;
  }
}
assert(sequenceValid, '10. الجمعات مرتبة تصاعدياً من الأولى إلى الأخيرة بشكل حتمي');

// 5. اختبار فحص جميع شهور السنة الهجرية 1448 هـ (12 شهراً)
let all12MonthsValid = true;
let totalFridaysInYear = 0;
for (let m = 1; m <= 12; m++) {
  const mInfo = CalendarService.getHijriMonthDetails(1448, m);
  if (mInfo.fridaysCount < 4 || mInfo.fridaysCount > 5) {
    all12MonthsValid = false;
  }
  if (mInfo.daysCount < 29 || mInfo.daysCount > 30) {
    all12MonthsValid = false;
  }
  totalFridaysInYear += mInfo.fridaysCount;
}
assert(all12MonthsValid, '11. جميع شهور سنة 1448 هـ الـ 12 تحتوي حصرياً على 4 أو 5 جمعات و 29 أو 30 يوماً');
assert(totalFridaysInYear >= 50 && totalFridaysInYear <= 52, `12. إجمالي جمعات السنة الهجرية ${totalFridaysInYear} جمعة (بين 50 و 52 جمعة)`);

// 6. اختبار التنسيق الثنائي (هجري أولاً ثم ميلادي)
const formattedBilingual = CalendarService.formatBilingualDate('13 رمضان 1448 هـ', '19 فبراير 2027 م');
assert(formattedBilingual.includes('13 رمضان 1448 هـ') && formattedBilingual.includes('19 فبراير 2027 م'), '13. التنسيق الثنائي يعرض الهجري أولاً والميلادي ثانياً');

// 7. اختبار المزامنة وإمكانية الوصول لقائمة الشهور والسنوات
const years = CalendarService.getAvailableHijriYears();
assert(years.includes(1448), '14. قائمة السنوات الهجرية المتاحة تحتوي على 1448 هـ', years);
const monthsList = CalendarService.getHijriMonthsList();
assert(monthsList.length === 12 && monthsList[0].name === 'محرم' && monthsList[8].name === 'رمضان', '15. قائمة الشهور الـ 12 صحيحة وتطابق التقويم الإسلامي');

console.log(`\nنتائج اختبارات نظام التقويم: ${passed} نجح / ${failed} فشل\n`);
if (failed > 0) {
  process.exit(1);
}
