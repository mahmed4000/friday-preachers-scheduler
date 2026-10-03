import { OrganizationSettings } from '../types/index.ts';

// Clean, high-resolution SVG emblem for the Sharia Association (الجمعية الشرعية)
export const DEFAULT_SHARIA_LOGO = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" width="140" height="140">
  <defs>
    <linearGradient id="logoGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c5a059" />
      <stop offset="50%" stop-color="#f5e7b2" />
      <stop offset="100%" stop-color="#a47a1e" />
    </linearGradient>
    <linearGradient id="logoGreen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a3828" />
      <stop offset="50%" stop-color="#114b37" />
      <stop offset="100%" stop-color="#082b1f" />
    </linearGradient>
  </defs>
  
  <!-- Outer Arch Frame with Gold Contour -->
  <path d="M70 12 C82 28 108 50 108 78 L108 126 L32 126 L32 78 C32 50 58 28 70 12 Z" fill="url(#logoGreen)" stroke="url(#logoGold)" stroke-width="2.5" />
  
  <!-- Inner Fine Gold Arch Line -->
  <path d="M70 20 C80 34 100 54 100 78 L100 120 L40 120 L40 78 C40 54 60 34 70 20 Z" fill="none" stroke="url(#logoGold)" stroke-width="1.2" opacity="0.8" />
  
  <!-- Top Crescent Finial -->
  <path d="M70 4 A5 5 0 1 1 66 12 A6.5 6.5 0 0 0 70 4 Z" fill="url(#logoGold)" />
  <circle cx="70" cy="12" r="1.5" fill="url(#logoGold)" />
  
  <!-- Pillars on left & right -->
  <rect x="36" y="80" width="4" height="40" fill="url(#logoGold)" />
  <rect x="100" y="80" width="4" height="40" fill="url(#logoGold)" />
  
  <!-- Central Mosque Dome in Gold -->
  <path d="M70 54 C74 65 85 75 85 88 L55 88 C55 75 66 65 70 54 Z" fill="url(#logoGold)" />
  <rect x="68.5" y="47" width="3" height="7" fill="url(#logoGold)" />
  <circle cx="70" cy="45" r="2.5" fill="url(#logoGold)" />
  <path d="M70 41 A3 3 0 1 1 68 46 A3.8 3.8 0 0 0 70 41 Z" fill="url(#logoGold)" />
  
  <!-- Minaret silhouettes inside arch -->
  <rect x="48" y="72" width="3.5" height="18" fill="url(#logoGold)" />
  <polygon points="48,72 49.75,64 51.5,72" fill="url(#logoGold)" />
  <rect x="88.5" y="72" width="3.5" height="18" fill="url(#logoGold)" />
  <polygon points="88.5,72 90.25,64 92,72" fill="url(#logoGold)" />
  
  <!-- Base Quran / Plinth Silhouette -->
  <path d="M70 94 C76 91 84 93 90 98 L90 106 C84 102 76 100 70 102 C64 100 56 102 50 106 L50 98 C56 93 64 91 70 94 Z" fill="#ffffff" />
  <line x1="70" y1="95" x2="70" y2="103" stroke="#0a3c2c" stroke-width="1.2" />
</svg>
`)}`;

export const DEFAULT_ORGANIZATION_SETTINGS: OrganizationSettings = {
  logoUrl: DEFAULT_SHARIA_LOGO,
  associationName: 'الجمعية الشرعية لمدينة منشأة البكاري',
  branchName: 'فرع منشأة البكاري — قطاع حي الهرم',
  departmentName: 'أمانة شؤون المساجد والخطباء والدعوة',
  city: 'منشأة البكاري',
  managerName: 'فضيلة الشيخ د. المنشاوي',
  managerTitle: 'أمين شؤون المساجد والدعوة',
  boardPresidentTitle: 'اعتماد رئيس مجلس الإدارة',
  boardPresidentName: 'الجمعية الشرعية لمدينة منشأة البكاري',
  schedulePreparerTitle: 'مُعدّ ومبرمج الجداول',
  schedulePreparerName: 'أمانة الجدولة والمتابعة الدعوية',
  phone: '02-37712345',
  whatsapp: '01012345678',
  email: 'contact@alsharia-bakkari.org.eg',
  address: 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
  countryId: 1,
  countryName: 'جمهورية مصر العربية',
  governorateId: 1,
  governorateName: 'الجيزة',
  districtId: 101,
  districtName: 'حي الهرم',
  areaId: 1001,
  areaName: 'منشأة البكاري',
  street: 'شارع الجمعية الشرعية الرئيسي',
  buildingNumber: '1',
  landmark: 'مقر إدارة الجمعية وفرع التحفيظ',
  formattedAddress: 'عقار 1، شارع الجمعية الشرعية الرئيسي، (علامة مميزة: مقر إدارة الجمعية وفرع التحفيظ)، منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
  footerNote: 'نسأل الله لفضيلتكم التوفيق والسداد والقبول، وجزاكم الله عنا وعن المسلمين خير الجزاء.',
  calendarProvider: 'UMM_AL_QURA',
  timezone: 'Africa/Cairo',
  lastCalendarSyncAt: new Date().toISOString(),
};
