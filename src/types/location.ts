/**
 * أنماط وأنواع التقسيم الإداري والجغرافي المصري (Egyptian Administrative Hierarchy Types)
 * مستندة إلى الهيكل الإداري الرسمي للجهاز المركزي للتعبئة العامة والإحصاء (CAPMAS)
 */

export type AdministrativeUnitType =
  | 'GOVERNORATE' // محافظة
  | 'MARKAZ'      // مركز
  | 'CITY'        // مدينة
  | 'DISTRICT'    // حي
  | 'QISM'        // قسم
  | 'SHEIKHA'     // شياخة
  | 'VILLAGE'     // قرية
  | 'AREA'        // منطقة
  | 'LOCALITY';   // تجمع سكني / محلية

export interface Country {
  id: number;
  code: string; // 'EG'
  nameAr: string; // 'جمهورية مصر العربية'
  nameEn?: string | null; // 'Arab Republic of Egypt'
  defaultTimezone: string; // 'Africa/Cairo'
  isDefault: boolean;
  isActive: boolean;
}

export interface AdministrativeUnit {
  id: number;
  countryId: number;
  parentId: number | null;
  level: number; // 1 = محافظة, 2 = مركز/حي/قسم/مدينة, 3 = شياخة/قرية/منطقة, 4 = منطقة فرعية
  type: AdministrativeUnitType;
  code: string | null; // كود التقسيم الإداري (مثال: 'GZ-HRM-MBK')
  nameAr: string; // الاسم العربي المعتمد (مثال: 'منشأة البكاري')
  nameEn?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  sortOrder: number;
  childrenCount?: number;
}

export interface StructuredAddress {
  id?: number;
  countryId: number;
  governorateId: number;
  districtId?: number | null; // الحي / المركز / القسم
  areaId?: number | null;     // المنطقة / الشياخة / القرية
  subAreaId?: number | null;  // المنطقة الفرعية
  street?: string | null;
  buildingNumber?: string | null;
  landmark?: string | null;
  floor?: string | null;
  apartment?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress: string;
  legacyAddress?: string | null;
  needsReview?: boolean;
  // Hydrated Display Labels
  countryName?: string;
  governorateName?: string;
  districtName?: string;
  areaName?: string;
}

export interface LocationSearchResult {
  id: number;
  nameAr: string;
  type: AdministrativeUnitType;
  typeLabelArabic: string;
  level: number;
  code: string | null;
  fullPathArabic: string; // "منشأة البكاري، حي الهرم، محافظة الجيزة"
  governorateId: number;
  districtId?: number | null;
  areaId?: number | null;
}

export interface DefaultEgyptianLocation {
  country: Country;
  governorate: AdministrativeUnit;
  district: AdministrativeUnit;
  area: AdministrativeUnit;
  formattedAddress: string;
  timezone: string;
}
