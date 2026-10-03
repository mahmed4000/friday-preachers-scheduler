import { matchAdministrativeHierarchy } from '../src/services/importExportService.ts';

const mockUnits = [
  { id: 1, countryId: 1, parentId: null, level: 1, type: 'GOVERNORATE', nameAr: 'الجيزة', nameEn: 'Giza' },
  { id: 101, countryId: 1, parentId: 1, level: 2, type: 'DISTRICT', nameAr: 'حي الهرم', nameEn: 'Al-Haram District' },
  { id: 1001, countryId: 1, parentId: 101, level: 3, type: 'AREA', nameAr: 'منشأة البكاري', nameEn: "Munsha'at Al-Bakkari" },
];

const res1 = matchAdministrativeHierarchy(
  { governorate: 'الجيزة', district: 'الهرم', area: 'منشأة البكاري' },
  mockUnits
);
console.log('Result 1 (district=الهرم):', res1);

const res2 = matchAdministrativeHierarchy(
  { governorate: 'الجيزة', district: 'حي الهرم', area: 'منشأة البكاري' },
  mockUnits
);
console.log('Result 2 (district=حي الهرم):', res2);
