import * as XLSX from 'xlsx';
import type {
  ImportExportEntityType,
  ImportExportFormat,
  ImportMode,
  ImportPreviewResult,
  ParsedImportRow,
  ColumnMappingItem,
  AdministrativeMatchResult,
  ExportFilterOptions,
} from '../types/importExport.ts';

// -------------------------------------------------------------
// 1. Arabic Text Normalization & Fuzzy Similarity Utilities
// -------------------------------------------------------------

export function normalizeArabicText(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ـ\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array.from({ length: bn + 1 }, () => Array(an + 1).fill(0));
  for (let i = 0; i <= an; i++) matrix[0][i] = i;
  for (let j = 0; j <= bn; j++) matrix[j][0] = j;

  for (let j = 1; j <= bn; j++) {
    for (let i = 1; i <= an; i++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1];
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i - 1] + 1, // substitution
          matrix[j][i - 1] + 1,     // insertion
          matrix[j - 1][i] + 1      // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

export function calculateSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeArabicText(s1);
  const norm2 = normalizeArabicText(s2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(norm1, norm2);
  return Math.max(0, 1 - dist / maxLen);
}

export function normalizePhoneNumber(rawPhone?: any): string {
  if (rawPhone === undefined || rawPhone === null) return '';
  let str = String(rawPhone).trim();
  // Replace eastern arabic numerals
  str = str
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[^\d+]/g, '');

  if (str.startsWith('+20')) str = '0' + str.slice(3);
  if (str.startsWith('20') && str.length === 12) str = '0' + str.slice(2);
  if (str.length === 10 && str.startsWith('1')) str = '0' + str; // Egyptian mobile without leading 0
  return str;
}

export function isValidEgyptianPhone(phone: any): boolean {
  if (!phone) return true; // Optional field validity
  const clean = normalizePhoneNumber(phone);
  if (!clean) return true;
  // Egyptian mobiles: 010, 011, 012, 015 followed by 8 digits (11 digits total)
  if (/^01[0125][0-9]{8}$/.test(clean)) return true;
  // Egyptian landlines: 02, 03, 04x, etc. (8 to 10 digits)
  if (/^0[2-9][0-9]{7,8}$/.test(clean) && !clean.startsWith('01')) return true;
  return false;
}

// -------------------------------------------------------------
// 2. Canonical Column Dictionaries & Synonyms
// -------------------------------------------------------------

export interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  synonyms: string[];
}

export const MOSQUE_FIELDS: FieldDefinition[] = [
  {
    key: 'code',
    label: 'كود المسجد',
    required: false,
    synonyms: ['كود المسجد', 'الكود', 'كود', 'code', 'mosque_code', 'رمز المسجد', 'id_code'],
  },
  {
    key: 'name',
    label: 'اسم المسجد',
    required: true,
    synonyms: ['اسم المسجد', 'الاسم', 'اسم المسجد بالعربية', 'name', 'mosque_name', 'mosque_name_ar', 'جامع'],
  },
  {
    key: 'nameEn',
    label: 'اسم المسجد بالإنجليزية',
    required: false,
    synonyms: ['اسم المسجد بالإنجليزية', 'الاسم بالانجليزية', 'mosque_name_en', 'name_en'],
  },
  {
    key: 'status',
    label: 'حالة المسجد',
    required: false,
    synonyms: ['الحالة', 'حالة المسجد', 'نشط', 'status', 'is_active', 'active'],
  },
  {
    key: 'country',
    label: 'الدولة',
    required: false,
    synonyms: ['الدولة', 'البلد', 'country', 'country_name_ar', 'country_name'],
  },
  {
    key: 'countryId',
    label: 'كود الدولة',
    required: false,
    synonyms: ['country_id', 'كود الدولة', 'رقم الدولة'],
  },
  {
    key: 'governorate',
    label: 'المحافظة',
    required: true,
    synonyms: ['المحافظة', 'اسم المحافظة', 'governorate', 'governorate_name_ar', 'gov'],
  },
  {
    key: 'governorateId',
    label: 'كود المحافظة',
    required: false,
    synonyms: ['governorate_id', 'كود المحافظة', 'رقم المحافظة'],
  },
  {
    key: 'district',
    label: 'الحي / المركز / القسم',
    required: false,
    synonyms: ['الحي', 'القسم', 'المركز', 'المدينة / الحي', 'district', 'qism', 'markaz', 'district_name_ar'],
  },
  {
    key: 'districtId',
    label: 'كود الحي / القسم',
    required: false,
    synonyms: ['district_id', 'كود الحي', 'كود القسم', 'رقم الحي'],
  },
  {
    key: 'city',
    label: 'المدينة',
    required: false,
    synonyms: ['المدينة', 'city', 'city_name_ar'],
  },
  {
    key: 'area',
    label: 'المنطقة / الشياخة / القرية',
    required: false,
    synonyms: ['المنطقة', 'الشياخة', 'القرية', 'المنطقة الفرعية', 'area', 'sheikha', 'village', 'area_name_ar'],
  },
  {
    key: 'areaId',
    label: 'كود المنطقة',
    required: false,
    synonyms: ['area_id', 'كود المنطقة', 'رقم المنطقة'],
  },
  {
    key: 'street',
    label: 'الشارع',
    required: false,
    synonyms: ['الشارع', 'اسم الشارع', 'street'],
  },
  {
    key: 'buildingNumber',
    label: 'رقم المبنى / العقار',
    required: false,
    synonyms: ['رقم المبنى', 'رقم العقار', 'رقم', 'building_number', 'building_no'],
  },
  {
    key: 'landmark',
    label: 'العلامة المميزة',
    required: false,
    synonyms: ['العلامة المميزة', 'معلم مميز', 'بجوار', 'أقرب معلم', 'landmark'],
  },
  {
    key: 'formattedAddress',
    label: 'العنوان التفصيلي',
    required: false,
    synonyms: ['العنوان التفصيلي', 'العنوان', 'ملاحظات العنوان', 'formatted_address', 'address', 'address_notes'],
  },
  {
    key: 'latitude',
    label: 'خط العرض (Latitude)',
    required: false,
    synonyms: ['خط العرض', 'latitude', 'lat'],
  },
  {
    key: 'longitude',
    label: 'خط الطول (Longitude)',
    required: false,
    synonyms: ['خط الطول', 'longitude', 'lng', 'long'],
  },
  {
    key: 'managerName',
    label: 'اسم المشرف / المسؤول',
    required: false,
    synonyms: ['اسم المشرف', 'اسم المسؤول', 'المشرف', 'المسؤول', 'مدير المسجد', 'manager_name', 'manager'],
  },
  {
    key: 'phone',
    label: 'هاتف المسجد / المسؤول',
    required: false,
    synonyms: ['الهاتف', 'هاتف المسجد', 'رقم الهاتف', 'هاتف المسؤول', 'phone', 'manager_phone'],
  },
  {
    key: 'whatsapp',
    label: 'رقم الواتساب',
    required: false,
    synonyms: ['الواتساب', 'واتساب', 'رقم الواتساب', 'whatsapp'],
  },
  {
    key: 'capacity',
    label: 'سعة المصلين',
    required: false,
    synonyms: ['السعة', 'سعة المصلين', 'capacity'],
  },
  {
    key: 'notes',
    label: 'الملاحظات',
    required: false,
    synonyms: ['الملاحظات', 'ملاحظات', 'notes', 'تعليقات'],
  },
];

export const PREACHER_FIELDS: FieldDefinition[] = [
  {
    key: 'code',
    label: 'كود الخطيب',
    required: false,
    synonyms: ['كود الخطيب', 'الكود', 'كود', 'code', 'preacher_code', 'imam_code', 'رقم القيد'],
  },
  {
    key: 'name',
    label: 'اسم الخطيب',
    required: true,
    synonyms: ['اسم الخطيب', 'الاسم', 'الاسم الكامل', 'فضيلة الشيخ', 'name', 'full_name_ar', 'preacher_name', 'الشيخ'],
  },
  {
    key: 'nameEn',
    label: 'الاسم بالإنجليزية',
    required: false,
    synonyms: ['الاسم بالإنجليزية', 'full_name_en', 'name_en'],
  },
  {
    key: 'type',
    label: 'نوع الخطيب',
    required: false,
    synonyms: ['نوع الخطيب', 'التصنيف', 'النوع', 'type', 'preacher_type'],
  },
  {
    key: 'status',
    label: 'الحالة',
    required: false,
    synonyms: ['الحالة', 'نشط', 'status', 'is_active', 'active'],
  },
  {
    key: 'phone',
    label: 'رقم الهاتف / الجوال',
    required: false,
    synonyms: ['الهاتف', 'رقم الهاتف', 'المحمول', 'الجوال', 'phone', 'preacher_phone', 'mobile'],
  },
  {
    key: 'whatsapp',
    label: 'رقم الواتساب',
    required: false,
    synonyms: ['الواتساب', 'واتساب', 'رقم الواتساب', 'whatsapp'],
  },
  {
    key: 'email',
    label: 'البريد الإلكتروني',
    required: false,
    synonyms: ['البريد الإلكتروني', 'الإيميل', 'email'],
  },
  {
    key: 'nationalId',
    label: 'الرقم القومي',
    required: false,
    synonyms: ['الرقم القومي', 'national_id', 'بطاقة الرقم القومي', 'id_number'],
  },
  {
    key: 'minFridays',
    label: 'الحد الأدنى للجمعات',
    required: false,
    synonyms: ['الحد الأدنى', 'أقل جمعات', 'min_fridays', 'min'],
  },
  {
    key: 'targetFridays',
    label: 'العدد المستهدف',
    required: false,
    synonyms: ['المستهدف', 'العدد المستهدف', 'target_fridays', 'target'],
  },
  {
    key: 'maxFridays',
    label: 'الحد الأقصى للجمعات',
    required: false,
    synonyms: ['الحد الأقصى', 'أعلى جمعات', 'max_fridays', 'max'],
  },
  {
    key: 'country',
    label: 'الدولة',
    required: false,
    synonyms: ['الدولة', 'country', 'country_name_ar'],
  },
  {
    key: 'countryId',
    label: 'كود الدولة',
    required: false,
    synonyms: ['country_id'],
  },
  {
    key: 'governorate',
    label: 'المحافظة',
    required: false,
    synonyms: ['المحافظة', 'governorate', 'governorate_name_ar'],
  },
  {
    key: 'governorateId',
    label: 'كود المحافظة',
    required: false,
    synonyms: ['governorate_id'],
  },
  {
    key: 'district',
    label: 'الحي / القسم / المركز',
    required: false,
    synonyms: ['الحي', 'القسم', 'المركز', 'الحي / القسم', 'الحي/القسم', 'district', 'qism', 'district_name_ar'],
  },
  {
    key: 'districtId',
    label: 'كود الحي',
    required: false,
    synonyms: ['district_id', 'كود الحي الداخلي'],
  },
  {
    key: 'city',
    label: 'المدينة',
    required: false,
    synonyms: ['المدينة', 'city'],
  },
  {
    key: 'area',
    label: 'المنطقة / الشياخة',
    required: false,
    synonyms: ['المنطقة', 'الشياخة', 'القرية', 'المنطقة / الشياخة', 'المنطقة/الشياخة', 'area', 'sheikha', 'area_name_ar'],
  },
  {
    key: 'areaId',
    label: 'كود المنطقة',
    required: false,
    synonyms: ['area_id', 'كود المنطقة الداخلي'],
  },
  {
    key: 'street',
    label: 'الشارع',
    required: false,
    synonyms: ['الشارع', 'street'],
  },
  {
    key: 'buildingNumber',
    label: 'رقم المبنى',
    required: false,
    synonyms: ['رقم المبنى', 'رقم العقار', 'building_number'],
  },
  {
    key: 'landmark',
    label: 'العلامة المميزة',
    required: false,
    synonyms: ['العلامة المميزة', 'landmark'],
  },
  {
    key: 'formattedAddress',
    label: 'العنوان التفصيلي',
    required: false,
    synonyms: ['العنوان التفصيلي', 'العنوان', 'address', 'formatted_address'],
  },
  {
    key: 'qualification',
    label: 'المؤهل العلمي',
    required: false,
    synonyms: ['المؤهل', 'المؤهل العلمي', 'qualification'],
  },
  {
    key: 'specialization',
    label: 'التخصص',
    required: false,
    synonyms: ['التخصص', 'specialization'],
  },
  {
    key: 'notes',
    label: 'الملاحظات',
    required: false,
    synonyms: ['الملاحظات', 'ملاحظات', 'notes'],
  },
];

// -------------------------------------------------------------
// 3. Header Matcher & Column Mapper
// -------------------------------------------------------------

export function autoMapHeaders(
  fileHeaders: string[],
  entityType: ImportExportEntityType
): { columnMappings: ColumnMappingItem[]; unmappedHeaders: string[]; detectedEntityType: ImportExportEntityType } {
  let effectiveEntityType = entityType;

  // Header inspection to detect if the file contains preachers or mosques data
  let preacherMatches = 0;
  let mosqueMatches = 0;

  for (const header of fileHeaders) {
    const norm = normalizeArabicText(header);
    if (
      norm.includes('خطيب') ||
      norm.includes('دعاه') ||
      norm.includes('شيخ') ||
      norm.includes('موهل') ||
      norm.includes('تخصص') ||
      norm.includes('جمعات')
    ) {
      preacherMatches++;
    }
    if (
      norm.includes('مسجد') ||
      norm.includes('جامع') ||
      norm.includes('مشرف') ||
      norm.includes('سعه')
    ) {
      mosqueMatches++;
    }
  }

  if (preacherMatches > mosqueMatches && preacherMatches > 0) {
    effectiveEntityType = 'IMAMS';
  } else if (mosqueMatches > preacherMatches && mosqueMatches > 0) {
    effectiveEntityType = 'MOSQUES';
  }

  const definitions = effectiveEntityType === 'MOSQUES' ? MOSQUE_FIELDS : PREACHER_FIELDS;
  const columnMappings: ColumnMappingItem[] = [];
  const usedFields = new Set<string>();
  const unmapped: string[] = [];

  for (const header of fileHeaders) {
    const normHeader = normalizeArabicText(header);
    let bestMatch: FieldDefinition | null = null;
    let highestConf = 0;

    for (const def of definitions) {
      if (usedFields.has(def.key)) continue;

      for (const syn of def.synonyms) {
        const normSyn = normalizeArabicText(syn);
        if (normHeader === normSyn) {
          bestMatch = def;
          highestConf = 1.0;
          break;
        }
        const sim = calculateSimilarity(normHeader, normSyn);
        if (sim > highestConf && sim >= 0.75) {
          highestConf = sim;
          bestMatch = def;
        }
      }
      if (highestConf === 1.0) break;
    }

    if (bestMatch && highestConf >= 0.75) {
      usedFields.add(bestMatch.key);
      columnMappings.push({
        fileHeader: header,
        targetField: bestMatch.key,
        targetLabel: bestMatch.label,
        confidence: highestConf,
        isAutoMatched: true,
        isRequired: bestMatch.required,
      });
    } else {
      unmapped.push(header);
    }
  }

  return { columnMappings, unmappedHeaders: unmapped, detectedEntityType: effectiveEntityType };
}

// -------------------------------------------------------------
// 4. Egyptian Administrative Unit Hierarchy Matcher
// -------------------------------------------------------------

export function matchAdministrativeHierarchy(
  input: {
    country?: string;
    countryId?: number;
    governorate?: string;
    governorateId?: number;
    district?: string;
    districtId?: number;
    area?: string;
    areaId?: number;
    city?: string;
    street?: string;
    buildingNumber?: string;
    landmark?: string;
  },
  allUnits: any[]
): AdministrativeMatchResult {
  let govId = input.governorateId ? Number(input.governorateId) : 0;
  let distId = input.districtId ? Number(input.districtId) : undefined;
  let arId = input.areaId ? Number(input.areaId) : undefined;
  let isExact = true;
  let needsReview = false;
  let reviewReason = '';
  const suggested: any = {};

  const getParentId = (u: any) => u.parentId ?? u.parent_id;
  const getNameAr = (u: any) => u.nameAr ?? u.name_ar ?? '';
  const getNameEn = (u: any) => u.nameEn ?? u.name_en ?? '';

  const governorates = allUnits.filter((u) => u.level === 1);

  // 1. Resolve Governorate
  let resolvedGov = govId ? governorates.find((g) => Number(g.id) === Number(govId)) : null;
  if (!resolvedGov && input.governorate) {
    const normInputGov = normalizeArabicText(input.governorate).replace(/^محافظه\s+/, '');
    resolvedGov = governorates.find((g) => {
      const gNorm = normalizeArabicText(getNameAr(g)).replace(/^محافظه\s+/, '');
      return (
        gNorm === normInputGov ||
        gNorm.includes(normInputGov) ||
        normInputGov.includes(gNorm) ||
        (getNameEn(g) && normalizeArabicText(getNameEn(g)) === normInputGov)
      );
    });

    if (!resolvedGov) {
      // Fuzzy search
      let bestGov: any = null;
      let maxSim = 0;
      for (const g of governorates) {
        const sim = calculateSimilarity(g.nameAr, input.governorate);
        if (sim > maxSim) {
          maxSim = sim;
          bestGov = g;
        }
      }
      if (bestGov && maxSim >= 0.7) {
        resolvedGov = bestGov;
        isExact = false;
        needsReview = true;
        reviewReason = `تم اقتراح محافظة ${bestGov.nameAr} بناء على التطابق التقريبي مع (${input.governorate})`;
        suggested.governorateName = bestGov.nameAr;
      }
    }
  }

  // Default to Giza (1) if in our primary branch scope or completely omitted
  if (!resolvedGov) {
    resolvedGov = governorates.find((g) => g.id === 1) || governorates[0];
    if (input.governorate && resolvedGov) {
      needsReview = true;
      reviewReason = `تعذر العثور على محافظة (${input.governorate})، تم التعيين الافتراضي لمحافظة ${getNameAr(resolvedGov)}`;
    }
  }

  govId = resolvedGov ? Number(resolvedGov.id) : 1;
  const govName = resolvedGov ? getNameAr(resolvedGov) : 'الجيزة';

  // 2. Resolve District (under the resolved Governorate)
  const districtsInGov = allUnits.filter((u) => u.level === 2 && Number(getParentId(u)) === Number(govId));
  let resolvedDist = distId ? districtsInGov.find((d) => Number(d.id) === Number(distId)) : null;

  if (!resolvedDist && input.district) {
    const normDist = normalizeArabicText(input.district).replace(/^(حي|مركز|قسم|مدينة|مركز ومدينة)\s+/, '');
    resolvedDist = districtsInGov.find((d) => {
      const dNorm = normalizeArabicText(getNameAr(d)).replace(/^(حي|مركز|قسم|مدينة|مركز ومدينة)\s+/, '');
      return (
        dNorm === normDist ||
        dNorm.includes(normDist) ||
        normDist.includes(dNorm) ||
        (getNameEn(d) && normalizeArabicText(getNameEn(d)) === normDist)
      );
    });

    if (!resolvedDist) {
      // Fuzzy search
      let bestDist: any = null;
      let maxSim = 0;
      for (const d of districtsInGov) {
        const sim = calculateSimilarity(getNameAr(d), input.district);
        if (sim > maxSim) {
          maxSim = sim;
          bestDist = d;
        }
      }
      if (bestDist && maxSim >= 0.7) {
        resolvedDist = bestDist;
        isExact = false;
        needsReview = true;
        reviewReason = `تم اقتراح قسم/حي ${getNameAr(bestDist)} بناء على التطابق مع (${input.district})`;
        suggested.districtName = getNameAr(bestDist);
      }
    }
  }

  // If district still not found, search in all districts across Egypt to check if user specified a district that belongs to a different governorate
  if (!resolvedDist && input.district) {
    const allDistricts = allUnits.filter((u) => u.level === 2);
    const crossGovDist = allDistricts.find(
      (d) => normalizeArabicText(getNameAr(d)) === normalizeArabicText(input.district)
    );
    if (crossGovDist) {
      const actualGov = governorates.find((g) => Number(g.id) === Number(getParentId(crossGovDist)));
      needsReview = true;
      reviewReason = `تنبيه: حي/قسم (${input.district}) يتبع إدارياً محافظة ${getNameAr(actualGov) || 'أخرى'}`;
    }
  }

  distId = resolvedDist ? Number(resolvedDist.id) : undefined;
  const distName = resolvedDist ? getNameAr(resolvedDist) : input.district || undefined;

  // 3. Resolve Area / Sheikha (under resolved District)
  let resolvedArea: any = null;
  if (distId) {
    const areasInDist = allUnits.filter((u) => u.level === 3 && Number(getParentId(u)) === Number(distId));
    if (arId) {
      resolvedArea = areasInDist.find((a) => Number(a.id) === Number(arId));
    } else if (input.area) {
      const normArea = normalizeArabicText(input.area).replace(/^(منطقة|شياخة|قرية|حوض)\s+/, '');
      resolvedArea = areasInDist.find((a) => {
        const aNorm = normalizeArabicText(getNameAr(a)).replace(/^(منطقة|شياخة|قرية|حوض)\s+/, '');
        return (
          aNorm === normArea ||
          aNorm.includes(normArea) ||
          normArea.includes(aNorm) ||
          (getNameEn(a) && normalizeArabicText(getNameEn(a)) === normArea)
        );
      });

      if (!resolvedArea) {
        let bestArea: any = null;
        let maxSim = 0;
        for (const a of areasInDist) {
          const sim = calculateSimilarity(getNameAr(a), input.area);
          if (sim > maxSim) {
            maxSim = sim;
            bestArea = a;
          }
        }
        if (bestArea && maxSim >= 0.65) {
          resolvedArea = bestArea;
          isExact = false;
          needsReview = true;
          suggested.areaName = getNameAr(bestArea);
          reviewReason = `تم اقتراح منطقة ${getNameAr(bestArea)} (${input.area})`;
        }
      }
    }
  }

  arId = resolvedArea ? Number(resolvedArea.id) : undefined;
  const areaName = resolvedArea ? getNameAr(resolvedArea) : input.area || undefined;

  // Construct standard formatted Egyptian address
  const addressParts: string[] = [];
  if (input.buildingNumber) addressParts.push(`عقار ${input.buildingNumber}`);
  if (input.street) addressParts.push(`شارع ${input.street}`);
  if (input.landmark) addressParts.push(`بجوار ${input.landmark}`);
  if (areaName) addressParts.push(areaName);
  if (distName && distName !== areaName) {
    if (/^(حي|مركز|قسم|مدينة|مركز ومدينة)\s+/.test(distName)) {
      addressParts.push(distName);
    } else {
      addressParts.push(`حي ${distName}`);
    }
  }
  if (govName) {
    if (/^محافظة\s+/.test(govName)) {
      addressParts.push(govName);
    } else {
      addressParts.push(`محافظة ${govName}`);
    }
  }
  addressParts.push('جمهورية مصر العربية');

  const formattedAddress = addressParts.join('، ');

  return {
    countryId: 1,
    countryName: 'جمهورية مصر العربية',
    governorateId: govId,
    governorateName: govName,
    districtId: distId,
    districtName: distName,
    areaId: arId,
    areaName: areaName,
    formattedAddress,
    isExactMatch: isExact,
    needsReview,
    reviewReason: reviewReason || undefined,
    suggestedHierarchy: suggested,
  };
}

// -------------------------------------------------------------
// 5. Excel & CSV Builders with RTL & UTF-8 BOM
// -------------------------------------------------------------

export function buildExcelWorkbook(sheetsData: { name: string; data: any[]; instructions?: string[] }[]): Buffer {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheetsData) {
    const ws = XLSX.utils.json_to_sheet(sheet.data || []);

    // Apply RTL view
    ws['!views'] = [{ rightToLeft: true }];

    // Auto-fit column widths
    if (sheet.data && sheet.data.length > 0) {
      const keys = Object.keys(sheet.data[0]);
      ws['!cols'] = keys.map((k) => {
        const maxContentLen = Math.max(
          k.length,
          ...sheet.data.slice(0, 50).map((row) => (row[k] ? String(row[k]).length : 0))
        );
        return { wch: Math.min(Math.max(maxContentLen + 4, 12), 40) };
      });
    }

    const cleanSheetName = (sheet.name || 'Sheet').replace(/[\\/?*:[\]]/g, '').slice(0, 31) || 'Sheet1';
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function buildCsvWithBom(data: any[]): Uint8Array {
  if (!data || data.length === 0) {
    const emptyWithBom = new Uint8Array([0xef, 0xbb, 0xbf]);
    return emptyWithBom;
  }

  const ws = XLSX.utils.json_to_sheet(data);
  const csvContent = XLSX.utils.sheet_to_csv(ws);
  const encoder = new TextEncoder();
  const csvBytes = encoder.encode(csvContent);

  // Prepend UTF-8 BOM (EF BB BF)
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const combined = new Uint8Array(bom.length + csvBytes.length);
  combined.set(bom, 0);
  combined.set(csvBytes, bom.length);
  return combined;
}
