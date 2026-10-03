import * as XLSX from 'xlsx';
import { MonthlySchedule, Friday, Assignment, Mosque, Imam, OrganizationSettings } from '../types/index.ts';

export function exportScheduleToExcel(
  schedule: MonthlySchedule,
  fridays: Friday[],
  assignments: Assignment[],
  mosques: Mosque[],
  imams: Imam[],
  settings?: OrganizationSettings
): void {
  const imamMap = new Map(imams.map((i) => [i.id, i]));
  const assignMap = new Map<string, Assignment>();
  for (const a of assignments) {
    assignMap.set(`${a.mosqueId}:${a.fridayIndex}`, a);
  }

  const associationTitle = settings?.associationName || 'الجمعية الشرعية الرئيسية لتعاون العاملين بالكتاب والسنة المحمدية';
  const branchTitle = settings?.branchName || 'فرع منطقة المدينة المنورة — أمانة شؤون المساجد والدعوة';

  // Table headers (Arabic RTL)
  const headers = ['م', 'كود المسجد', 'اسم المسجد / الجامع', 'المنطقة'];
  fridays.forEach((f) => {
    headers.push(`الجمعة (${f.fridayIndex}) - ${f.hijriDate}`);
  });

  const rows: (string | number)[][] = [];
  mosques
    .filter((m) => m.isActive)
    .forEach((m, idx) => {
      const row: (string | number)[] = [idx + 1, m.code, m.name, m.region];
      fridays.forEach((f) => {
        const assign = assignMap.get(`${m.id}:${f.fridayIndex}`);
        const imam = assign?.imamId ? imamMap.get(assign.imamId) : null;
        row.push(imam ? imam.name : 'شاغر');
      });
      rows.push(row);
    });

  const worksheetData = [
    [associationTitle],
    [branchTitle],
    [`جدول توزيع خطباء الجمعة لشهر ${schedule.monthName} ${schedule.hijriYear} هـ`],
    [`الحالة: ${schedule.status === 'APPROVED' ? 'معتمد رسمياً ✓' : schedule.status} | الإصدار: V${schedule.currentVersion} | عدد الجمعات: ${fridays.length} | تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`],
    [],
    headers,
    ...rows,
    [],
    [`مُعدّ الجداول: ${settings?.schedulePreparerName || 'قسم الجدولة'} | ${settings?.managerTitle || 'أمين المساجد'}: ${settings?.managerName || ''} | الاعتماد: ${settings?.boardPresidentName || 'مجلس الإدارة'}`],
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set RTL on the sheet view
  ws['!views'] = [{ RTL: true }];

  // Set column widths
  ws['!cols'] = [
    { wch: 6 },  // م
    { wch: 12 }, // كود
    { wch: 32 }, // اسم المسجد
    { wch: 16 }, // المنطقة
    ...fridays.map(() => ({ wch: 24 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `جدول ${schedule.monthName}`);

  const fileName = `جدول_خطباء_${schedule.monthName.replace(/\s+/g, '_')}_${schedule.hijriYear}هـ.xlsx`;
  XLSX.writeFile(wb, fileName);
}
