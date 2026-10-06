/**
 * مزود التقسيم الإداري والجغرافي المصري (Egypt Administrative Provider)
 * الخدمة المركزية الموحدة لإدارة العناوين والمواقع الإدارية لجمهورية مصر العربية
 */

import {
  Country,
  AdministrativeUnit,
  AdministrativeUnitType,
  StructuredAddress,
  LocationSearchResult,
  DefaultEgyptianLocation,
} from '../../types/location.ts';
import {
  EGYPT_COUNTRY,
  COUNTRIES_LIST,
  EGYPT_GOVERNORATES,
  EGYPT_ADMINISTRATIVE_UNITS,
} from './egyptAdministrativeData.ts';

export class EgyptAdministrativeProvider {
  private static allUnitsMap = new Map<number, AdministrativeUnit>();
  private static childrenByParentMap = new Map<number, AdministrativeUnit[]>();
  private static governoratesMap = new Map<number, AdministrativeUnit>();

  static {
    // بناء فهارس البحث والوصول السريع في الذاكرة (In-Memory Fast Indexing)
    for (const gov of EGYPT_GOVERNORATES) {
      this.allUnitsMap.set(gov.id, gov);
      this.governoratesMap.set(gov.id, gov);
    }

    for (const unit of EGYPT_ADMINISTRATIVE_UNITS) {
      this.allUnitsMap.set(unit.id, unit);
      if (unit.parentId !== null) {
        const list = this.childrenByParentMap.get(unit.parentId) || [];
        list.push(unit);
        this.childrenByParentMap.set(unit.parentId, list);
      }
    }
  }

  /**
   * قائمة جميع الوحدات الإدارية والمحافظات المصرية المعتمدة
   */
  public static getAllUnits(): AdministrativeUnit[] {
    return Array.from(this.allUnitsMap.values());
  }

  /**
   * قائمة الدول المدعومة (افتراضياً: جمهورية مصر العربية)
   */
  public static getCountries(): Country[] {
    return COUNTRIES_LIST;
  }

  public static getDefaultCountry(): Country {
    return EGYPT_COUNTRY;
  }

  /**
   * قائمة محافظات مصر الـ 27
   */
  public static getGovernorates(countryId: number = 1): AdministrativeUnit[] {
    return EGYPT_GOVERNORATES.filter((g) => g.countryId === countryId && g.isActive);
  }

  /**
   * الوحدات الإدارية التابعة لمستوى إداري محدد (الأحياء/المراكز أو الشياخات/المناطق)
   */
  public static getUnitsByParent(parentId: number): AdministrativeUnit[] {
    const units = this.childrenByParentMap.get(parentId) || [];
    return units.filter((u) => u.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * الحصول على وحدة إدارية بمعرفها الثابت (ID)
   */
  public static getUnitById(id: number): AdministrativeUnit | undefined {
    return this.allUnitsMap.get(id);
  }

  /**
   * استخراج المسار الهرمي الكامل للوحدة الإدارية (مثل: منشأة البكاري -> حي الهرم -> محافظة الجيزة)
   */
  public static getHierarchyPath(unitId: number): AdministrativeUnit[] {
    const path: AdministrativeUnit[] = [];
    let current = this.getUnitById(unitId);
    while (current) {
      path.unshift(current);
      if (current.parentId !== null) {
        current = this.getUnitById(current.parentId);
      } else {
        break;
      }
    }
    return path;
  }

  /**
   * نوع الوحدة باللغة العربية
   */
  public static getTypeLabelArabic(type: AdministrativeUnitType): string {
    switch (type) {
      case 'GOVERNORATE':
        return 'محافظة';
      case 'DISTRICT':
        return 'حي';
      case 'MARKAZ':
        return 'مركز';
      case 'QISM':
        return 'قسم';
      case 'CITY':
        return 'مدينة';
      case 'SHEIKHA':
        return 'شياخة';
      case 'VILLAGE':
        return 'قرية';
      case 'AREA':
        return 'منطقة';
      case 'LOCALITY':
        return 'محلية';
      default:
        return 'وحدة إدارية';
    }
  }

  /**
   * البحث اللحظي السريع في التقسيمات الإدارية والمناطق والشياخات
   */
  public static searchUnits(query: string, limit: number = 20): LocationSearchResult[] {
    if (!query || query.trim().length === 0) return [];
    const normalized = query.trim().toLowerCase();

    const results: LocationSearchResult[] = [];

    // Search in Governorates & Units
    for (const unit of this.allUnitsMap.values()) {
      const matchAr = unit.nameAr.toLowerCase().includes(normalized);
      const matchEn = unit.nameEn?.toLowerCase().includes(normalized);
      const matchCode = unit.code?.toLowerCase().includes(normalized);

      if (matchAr || matchEn || matchCode) {
        const hierarchy = this.getHierarchyPath(unit.id);
        const fullPathArabic = hierarchy.map((h) => h.nameAr).join('، ');

        let govId = 1;
        let distId: number | null = null;
        let areaId: number | null = null;

        if (hierarchy.length >= 1) govId = hierarchy[0].id;
        if (hierarchy.length >= 2) distId = hierarchy[1].id;
        if (hierarchy.length >= 3) areaId = hierarchy[2].id;

        results.push({
          id: unit.id,
          nameAr: unit.nameAr,
          type: unit.type,
          typeLabelArabic: this.getTypeLabelArabic(unit.type),
          level: unit.level,
          code: unit.code,
          fullPathArabic,
          governorateId: govId,
          districtId: distId,
          areaId,
        });

        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * التحقق الصارم من صحة العلاقات الهرمية (Hierarchy Validation)
   */
  public static validateHierarchy(
    governorateId: number,
    districtId?: number | null,
    areaId?: number | null
  ): { isValid: boolean; error?: string } {
    const gov = this.getUnitById(governorateId);
    if (!gov || gov.level !== 1) {
      return { isValid: false, error: 'المحافظة المحددة غير صحيحة أو غير موجودة في قاعدة البيانات المصرية.' };
    }

    if (districtId) {
      const dist = this.getUnitById(districtId);
      if (!dist || dist.parentId !== governorateId) {
        return { isValid: false, error: `الحي/المركز المختار (${dist?.nameAr || districtId}) لا يتبع لمحافظة ${gov.nameAr}.` };
      }

      if (areaId) {
        const area = this.getUnitById(areaId);
        if (!area || area.parentId !== districtId) {
          return { isValid: false, error: `المنطقة/الشياخة المختارة (${area?.nameAr || areaId}) لا تتبع للحي/المركز المحدد (${dist.nameAr}).` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * بناء العنوان المهيكل الصريح (Authoritative Display Address Generation)
   * مثال: "عقار رقم 15، شارع الجمعية، منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية"
   */
  public static formatStructuredAddress(data: {
    countryId?: number;
    governorateId: number;
    districtId?: number | null;
    areaId?: number | null;
    street?: string | null;
    buildingNumber?: string | null;
    landmark?: string | null;
  }): string {
    const parts: string[] = [];

    if (data.buildingNumber && data.buildingNumber.trim()) {
      parts.push(`عقار ${data.buildingNumber.trim()}`);
    }

    if (data.street && data.street.trim()) {
      parts.push(data.street.trim());
    }

    if (data.landmark && data.landmark.trim()) {
      parts.push(`(علامة مميزة: ${data.landmark.trim()})`);
    }

    if (data.areaId) {
      const area = this.getUnitById(data.areaId);
      if (area) parts.push(area.nameAr);
    }

    if (data.districtId) {
      const district = this.getUnitById(data.districtId);
      if (district) {
        const prefix = district.type === 'DISTRICT' || district.type === 'QISM' ? 'حي ' : district.type === 'MARKAZ' ? 'مركز ' : '';
        parts.push(district.nameAr.startsWith('حي') || district.nameAr.startsWith('مركز') || district.nameAr.startsWith('مدينة') ? district.nameAr : `${prefix}${district.nameAr}`);
      }
    }

    const gov = this.getUnitById(data.governorateId);
    if (gov) {
      parts.push(`محافظة ${gov.nameAr}`);
    } else {
      parts.push('محافظة الجيزة');
    }

    parts.push('جمهورية مصر العربية');

    return parts.join('، ');
  }

  /**
   * الموقع الافتراضي لمقر الجمعية الشرعية الرئيسي:
   * منشأة البكاري — حي الهرم — محافظة الجيزة — جمهورية مصر العربية
   */
  public static getDefaultAssociationLocation(): DefaultEgyptianLocation {
    const country = EGYPT_COUNTRY;
    const gov = this.getUnitById(1)!; // الجيزة
    const dist = this.getUnitById(101)!; // حي الهرم
    const area = this.getUnitById(1001)!; // منشأة البكاري

    const formattedAddress = 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية';

    return {
      country,
      governorate: gov,
      district: dist,
      area,
      formattedAddress,
      timezone: 'Africa/Cairo',
    };
  }
}
