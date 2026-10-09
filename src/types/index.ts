export * from './location.ts';
export * from './importExport.ts';
import { StructuredAddress } from './location.ts';

export type RelationshipType = 'FIXED' | 'PREFERRED' | 'ALLOWED' | 'DISCOURAGED' | 'FORBIDDEN' | 'FLEXIBLE';
export type FixedPattern = 'ALL' | 'FIRST_N' | 'LAST_N' | 'ANY_N' | 'SPECIFIC_FRIDAYS';
export type FixedAssignmentPatternType = 'SAME_ALL' | 'SPLIT_COUNTS' | 'SPECIFIC_FRIDAYS' | 'CUSTOM';
export type AssignmentSource = 'FIXED' | 'PREFERENCE' | 'BALANCED' | 'RANDOM' | 'BALANCED_RANDOM' | 'MANUAL' | 'OVERRIDE';
export type ScheduleStatus = 'DRAFT' | 'GENERATED' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'MODIFIED' | 'NEEDS_REAPPROVAL';
export type ConflictSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface FixedAssignmentPatternItem {
  id?: number;
  patternId?: number;
  fridayIndex: number; // 1..5
  imamId: number;
  sequence?: number;
  notes?: string | null;
  imamName?: string;
  imamPhone?: string;
  hijriDate?: string;
  gregorianDate?: string;
}

export interface FixedAssignmentPattern {
  id: number;
  mosqueId: number;
  hijriYear: number;
  hijriMonth: number;
  patternType: FixedAssignmentPatternType;
  fridaysCount: number;
  isActive: boolean;
  notes?: string | null;
  items: FixedAssignmentPatternItem[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface Mosque {
  id: number;
  name: string;
  code: string;
  region: string;
  address?: string | null;
  // Egyptian Administrative Location Fields
  countryId?: number | null;
  governorateId?: number | null;
  districtId?: number | null;
  areaId?: number | null;
  street?: string | null;
  buildingNumber?: string | null;
  landmark?: string | null;
  formattedAddress?: string | null;
  legacyAddress?: string | null;
  needsReview?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  structuredAddress?: StructuredAddress | null;
  managerName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isActive: boolean;
  fixedImamId?: number | null;
  fixedPattern?: FixedPattern | null;
  fixedCount?: number;
  notes?: string | null;
  fixedImamName?: string | null;
  preferencesCount?: number;
  forbiddenCount?: number;
  rules?: MosqueImamRule[];
  createdAt?: string | Date;
}

export interface Imam {
  id: number;
  name: string;
  type: 'FIXED' | 'PARTIAL_FIXED' | 'FLEXIBLE';
  minFridays: number;
  targetFridays: number;
  maxFridays: number;
  phone?: string | null;
  whatsapp?: string | null;
  region?: string | null;
  address?: string | null;
  // Egyptian Administrative Location Fields
  countryId?: number | null;
  governorateId?: number | null;
  districtId?: number | null;
  areaId?: number | null;
  street?: string | null;
  buildingNumber?: string | null;
  landmark?: string | null;
  formattedAddress?: string | null;
  legacyAddress?: string | null;
  needsReview?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  structuredAddress?: StructuredAddress | null;
  isActive: boolean;
  notes?: string | null;
  fixedMosqueId?: number | null;
  fixedMosqueName?: string | null;
  fixedMosqueCode?: string | null;
  preferencesCount?: number;
  forbiddenCount?: number;
  linkedMosquesCount?: number;
  availabilities?: ImamAvailability[];
  rules?: MosqueImamRule[];
  createdAt?: string | Date;
}

export interface MosqueImamRule {
  id: number;
  mosqueId: number;
  imamId: number;
  relationshipType: RelationshipType;
  priority: number;
  notes?: string | null;
  imam?: Imam;
  mosque?: Mosque;
}

export interface ImamAvailability {
  id: number;
  imamId: number;
  hijriYear: number;
  hijriMonth: number;
  fridayIndex: number;
  isAvailable: boolean;
  reason?: string | null;
}

export interface MonthlySchedule {
  id: number;
  hijriYear: number;
  hijriMonth: number;
  monthName: string;
  fridaysCount: number;
  daysCount?: number;
  calendarProvider?: string;
  timezone?: string;
  startDateGregorian?: string | null;
  endDateGregorian?: string | null;
  status: ScheduleStatus;
  currentVersion: number;
  createdBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Friday {
  id: number;
  scheduleId: number;
  fridayIndex: number;
  ordinalName?: string;
  hijriYear?: number;
  hijriMonth?: number;
  hijriDay?: number;
  hijriDate: string;
  gregorianDate: string;
  gregorianIso?: string;
  dayOfWeek?: string;
  periodStatus?: string;
  isPast?: boolean;
  isHoliday?: boolean;
  notes?: string | null;
}

export interface Assignment {
  id: number;
  scheduleId: number;
  fridayId?: number;
  fridayIndex: number;
  mosqueId: number;
  imamId: number | null;
  source: AssignmentSource;
  isLocked: boolean;
  status?: string;
  notes?: string | null;
  confirmationStatus?: 'PENDING' | 'CONFIRMED' | 'DECLINED';
}

export interface MonthlyScheduleData {
  schedule: MonthlySchedule;
  fridays: Friday[];
  assignments: Assignment[];
  conflicts: Conflict[];
  overrides: OverrideRecord[];
}

export interface Conflict {
  id: number;
  scheduleId: number;
  severity: ConflictSeverity;
  mosqueId?: number | null;
  fridayIndex?: number | null;
  imamId?: number | null;
  ruleCode?: string;
  conflictType?: string;
  message?: string;
  description?: string;
  possibleResolutions?: string | string[] | null; // JSON string or string array
  details?: any;
  status?: string;
  createdAt?: string;
}

export interface OverrideRecord {
  id: number;
  scheduleId: number;
  assignmentId?: number | null;
  imamId?: number | null;
  mosqueId?: number | null;
  fridayIndex?: number | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason: string;
  createdBy?: string | null;
  createdAt: string;
}

export interface DistributionLog {
  id: number;
  scheduleId: number;
  recipientType: 'MOSQUE' | 'IMAM';
  recipientId: number;
  recipientName: string;
  phone?: string | null;
  status: 'READY' | 'SENT' | 'FAILED' | 'MISSING_PHONE';
  sentAt?: string | null;
  errorMessage?: string | null;
}

export interface AuditLog {
  id: number;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  detailsJson?: string | null;
  createdAt: string;
}

export interface DashboardAlert {
  id: string;
  type: 'UPCOMING_FRIDAY' | 'DEADLINE' | 'UNAVAILABILITY' | 'VACANCY' | 'QUOTA';
  severity: 'CRITICAL' | 'WARNING' | 'INFO' | 'SUCCESS';
  title: string;
  description: string;
  dueDate?: string;
  daysRemaining?: number;
  relatedEntityId?: number;
  relatedEntityType?: 'MOSQUE' | 'IMAM' | 'SCHEDULE';
  actionLabel?: string;
  actionTab?: string;
  actionScheduleId?: number;
  timestamp: string;
}

export interface OrganizationSettings {
  appName?: string;
  logoUrl: string;
  associationName: string;
  branchName: string;
  departmentName: string;
  city: string;
  managerName: string;
  managerTitle: string;
  boardPresidentTitle: string;
  boardPresidentName: string;
  schedulePreparerTitle: string;
  schedulePreparerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  // Egyptian Location Fields
  countryId?: number;
  countryName?: string;
  governorateId?: number;
  governorateName?: string;
  districtId?: number;
  districtName?: string;
  areaId?: number;
  areaName?: string;
  street?: string;
  buildingNumber?: string;
  landmark?: string;
  formattedAddress?: string;
  officialSealUrl?: string;
  footerNote: string;
  calendarProvider?: string;
  timezone?: string;
  lastCalendarSyncAt?: string;
  website?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  defaultDistributionMethod?: string | null;
  autoLockFixed?: boolean | null;
}

export type NavItem =
  | 'dashboard'
  | 'schedules'
  | 'mosques'
  | 'imams'
  | 'rules'
  | 'publishing'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'mosque-profile'
  | 'imam-profile';

export interface ProfileAssignmentItem {
  id: number;
  scheduleId: number;
  fridayId: number;
  fridayIndex: number;
  hijriDate: string;
  gregorianDate?: string;
  monthName: string;
  hijriYear: number;
  hijriMonth?: number;
  scheduleStatus: string;
  mosqueId: number;
  mosqueName: string;
  mosqueCode: string;
  mosqueRegion: string;
  region?: string;
  formattedAddress?: string;
  address?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  managerName?: string;
  mosquePhone?: string;
  phone?: string;
  imamId: number | null;
  imamName?: string;
  imamType?: string;
  imamPhone?: string;
  isLocked: boolean;
  source: string;
  isUpcoming: boolean;
  confirmationStatus?: string | null;
}

export interface ScheduleSummaryItem {
  id: number;
  monthName: string;
  hijriYear: number;
  hijriMonth: number;
  fridaysCount: number;
  status: string;
}

export interface ImamProfileData {
  imam: Imam;
  fixedMosque?: Mosque | null;
  activeSchedule?: ScheduleSummaryItem | null;
  availableSchedules?: ScheduleSummaryItem[];
  stats: {
    totalAssigned: number;
    currentMonthFridaysCount?: number;
    currentScheduleFridaysTotal?: number;
    currentMonthName?: string;
    currentHijriYear?: number;
    currentScheduleStatus?: string;
    lifetimeTotalAssigned?: number;
    mosquesCount: number;
    upcomingCount: number;
    pastCount: number;
    availabilitiesCount: number;
    minFridays: number;
    targetFridays: number;
    maxFridays: number;
  };
  assignments: ProfileAssignmentItem[];
  upcomingAssignments: ProfileAssignmentItem[];
  linkedMosques: Array<{
    mosqueId: number;
    mosqueName: string;
    mosqueCode: string;
    mosqueRegion: string;
    relationshipType?: string;
    priority?: number;
    assignedCount: number;
    lastDate?: string;
    nextDate?: string;
  }>;
  rules: Array<MosqueImamRule & { mosqueName?: string; mosqueRegion?: string }>;
  availabilities: ImamAvailability[];
  auditLogs: AuditLog[];
}

export interface MosqueProfileData {
  mosque: Mosque;
  fixedImam?: Imam | null;
  activeSchedule?: ScheduleSummaryItem | null;
  availableSchedules?: ScheduleSummaryItem[];
  stats: {
    totalAssigned: number;
    currentMonthCount: number;
    imamsCount: number;
    upcomingCount: number;
    currentScheduleFridaysTotal?: number;
    currentMonthName?: string;
    currentHijriYear?: number;
  };
  assignments: ProfileAssignmentItem[];
  upcomingAssignments: ProfileAssignmentItem[];
  linkedImams: Array<{
    imamId: number;
    imamName: string;
    imamType: string;
    imamPhone?: string;
    relationshipType?: string;
    assignedCount: number;
    lastDate?: string;
    nextDate?: string;
  }>;
  rules: {
    preferred: Array<MosqueImamRule & { imamName?: string; imamType?: string }>;
    allowed: Array<MosqueImamRule & { imamName?: string; imamType?: string }>;
    discouraged: Array<MosqueImamRule & { imamName?: string; imamType?: string }>;
    forbidden: Array<MosqueImamRule & { imamName?: string; imamType?: string }>;
    fixed: Array<MosqueImamRule & { imamName?: string; imamType?: string }>;
  };
  auditLogs: AuditLog[];
}



