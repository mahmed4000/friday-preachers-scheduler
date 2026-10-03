import {
  autoMapHeaders,
  matchAdministrativeHierarchy,
  normalizePhoneNumber,
  isValidEgyptianPhone,
  normalizeArabicText,
  buildExcelWorkbook,
  buildCsvWithBom,
  calculateSimilarity,
} from '../src/services/importExportService.ts';

async function runTests() {
  console.log('--- Starting Import & Export Engine Comprehensive Tests ---\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✕ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Arabic Text Normalization Tests
  assert(normalizeArabicText('مسجد الرَّحْمَنِ') === 'مسجد الرحمن', 'Arabic Tashkeel stripping');
  assert(normalizeArabicText('إبراهيم') === normalizeArabicText('ابراهيم'), 'Alef normalization (إ -> ا)');
  assert(normalizeArabicText('منشأة') === normalizeArabicText('منشأه'), 'Taa Marbouta normalization (ة -> ه)');
  assert(normalizeArabicText('علي') === normalizeArabicText('على'), 'Yaa / Alef Maksura normalization (ي -> ى)');

  // 2. Egyptian Phone Normalization & Validation Tests
  assert(normalizePhoneNumber('٠١٠١٢٣٤٥٦٧٨') === '01012345678', 'Eastern Arabic digits conversion to English');
  assert(normalizePhoneNumber('+20 101-234-5678') === '01012345678', 'International +20 mobile normalization');
  assert(isValidEgyptianPhone('01012345678') === true, 'Valid Egyptian Vodafone mobile');
  assert(isValidEgyptianPhone('01123456789') === true, 'Valid Egyptian Etisalat mobile');
  assert(isValidEgyptianPhone('01234567890') === true, 'Valid Egyptian Orange mobile');
  assert(isValidEgyptianPhone('01512345678') === true, 'Valid Egyptian WE mobile');
  assert(isValidEgyptianPhone('0233445566') === true, 'Valid Egyptian Giza/Cairo landline');
  assert(isValidEgyptianPhone('12345') === false, 'Invalid short phone number rejected');
  assert(isValidEgyptianPhone('01999999999') === false, 'Invalid non-existent prefix (019) rejected');

  // 3. Header Auto-Mapping Tests
  const mosqueHeaders = ['كود المسجد', 'اسم المسجد', 'المحافظة', 'الحي', 'المنطقة', 'الهاتف', 'اسم المشرف'];
  const mapRes1 = autoMapHeaders(mosqueHeaders, 'MOSQUES');
  assert(mapRes1.columnMappings.length === 7, 'Auto-mapped all 7 standard mosque headers');
  assert(mapRes1.columnMappings.find((m) => m.fileHeader === 'اسم المسجد')?.targetField === 'name', 'Mapped name correctly');
  assert(mapRes1.columnMappings.find((m) => m.fileHeader === 'المحافظة')?.targetField === 'governorate', 'Mapped governorate correctly');

  const preacherHeaders = ['الاسم الكامل', 'رقم الهاتف', 'نوع الخطيب', 'الحد الأدنى', 'العدد المستهدف'];
  const mapRes2 = autoMapHeaders(preacherHeaders, 'IMAMS');
  assert(mapRes2.columnMappings.find((m) => m.fileHeader === 'الاسم الكامل')?.targetField === 'name', 'Mapped preacher full name');
  assert(mapRes2.columnMappings.find((m) => m.fileHeader === 'نوع الخطيب')?.targetField === 'type', 'Mapped preacher type');

  // 4. Egyptian Administrative Hierarchy Matcher Tests
  const mockUnits = [
    { id: 1, countryId: 1, parentId: null, level: 1, type: 'GOVERNORATE', nameAr: 'الجيزة', nameEn: 'Giza' },
    { id: 2, countryId: 1, parentId: null, level: 1, type: 'GOVERNORATE', nameAr: 'القاهرة', nameEn: 'Cairo' },
    { id: 101, countryId: 1, parentId: 1, level: 2, type: 'DISTRICT', nameAr: 'الهرم', nameEn: 'Al Haram' },
    { id: 102, countryId: 1, parentId: 1, level: 2, type: 'DISTRICT', nameAr: 'العمرانية', nameEn: 'Al Omraneya' },
    { id: 1001, countryId: 1, parentId: 101, level: 3, type: 'AREA', nameAr: 'منشأة البكاري', nameEn: "Munsha'at Al Bakkari" },
  ];

  const adminMatch1 = matchAdministrativeHierarchy(
    { governorate: 'الجيزه', district: 'الهرم', area: 'منشأة البكاري', street: 'العروبة', buildingNumber: '10' },
    mockUnits
  );
  assert(adminMatch1.governorateId === 1, 'Exact/Normalized governorate matched ID 1 (Giza)');
  assert(adminMatch1.districtId === 101, 'District matched ID 101 (Haram)');
  assert(adminMatch1.areaId === 1001, 'Area matched ID 1001 (Munshaat Al-Bakkari)');
  assert(adminMatch1.formattedAddress.includes('عقار 10'), 'Formatted address includes building number');
  assert(adminMatch1.formattedAddress.includes('شارع العروبة'), 'Formatted address includes street');

  // 5. Excel & CSV with UTF-8 BOM Generation Tests
  const sampleData = [
    { 'كود المسجد': 'MOS-1', 'اسم المسجد': 'مسجد الفتح', 'الهاتف': '01012345678' },
    { 'كود المسجد': 'MOS-2', 'اسم المسجد': 'جامع النور', 'الهاتف': '01198765432' },
  ];

  const xlsxBuffer = buildExcelWorkbook([{ name: 'المساجد', data: sampleData }]);
  assert(xlsxBuffer.byteLength > 1000, 'Excel Workbook created with valid non-empty byte buffer');

  const csvBytes = buildCsvWithBom(sampleData);
  assert(csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf, 'CSV contains UTF-8 BOM bytes at start');

  console.log(`\nTests Summary: ${passed} Passed, ${failed} Failed\n`);
  if (failed > 0) process.exit(1);
}

runTests();
