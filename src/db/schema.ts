import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp, real } from 'drizzle-orm/pg-core';

// Countries (e.g. Egypt as default)
export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(), // 'EG'
  nameAr: text('name_ar').notNull(), // 'جمهورية مصر العربية'
  nameEn: text('name_en'), // 'Arab Republic of Egypt'
  defaultTimezone: text('default_timezone').default('Africa/Cairo').notNull(),
  isDefault: boolean('is_default').default(true).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Hierarchical Egyptian Administrative Units (Governorates -> Districts/Qisms/Markazes -> Sheikhas/Areas)
export const administrativeUnits = pgTable('administrative_units', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id').default(1).notNull(),
  parentId: integer('parent_id'),
  level: integer('level').notNull(), // 1=GOVERNORATE, 2=DISTRICT/QISM/MARKAZ, 3=SHEIKHA/AREA/VILLAGE
  type: text('type').notNull(), // GOVERNORATE, DISTRICT, QISM, MARKAZ, CITY, SHEIKHA, VILLAGE, AREA
  code: text('code'), // e.g. 'GZ', 'GZ-HRM', 'GZ-HRM-MBK'
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  postalCode: text('postal_code'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Structured Addresses
export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id').default(1).notNull(),
  governorateId: integer('governorate_id').notNull(),
  districtId: integer('district_id'),
  areaId: integer('area_id'),
  subAreaId: integer('sub_area_id'),
  street: text('street'),
  buildingNumber: text('building_number'),
  landmark: text('landmark'),
  floor: text('floor'),
  apartment: text('apartment'),
  postalCode: text('postal_code'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  formattedAddress: text('formatted_address').notNull(),
  legacyAddress: text('legacy_address'),
  needsReview: boolean('needs_review').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users table (authenticated admins and staff)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('admin').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Mosques in the city
export const mosques = pgTable('mosques', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  region: text('region').notNull(),
  address: text('address'),
  // Structured Egyptian Location columns
  countryId: integer('country_id'),
  governorateId: integer('governorate_id'),
  districtId: integer('district_id'),
  areaId: integer('area_id'),
  street: text('street'),
  buildingNumber: text('building_number'),
  landmark: text('landmark'),
  formattedAddress: text('formatted_address'),
  legacyAddress: text('legacy_address'),
  needsReview: boolean('needs_review').default(false).notNull(),
  latitude: text('latitude'),
  longitude: text('longitude'),
  managerName: text('manager_name'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  isActive: boolean('is_active').default(true).notNull(),
  fixedImamId: integer('fixed_imam_id'),
  fixedPattern: text('fixed_pattern').default('ALL').notNull(), // ALL, FIRST_N, LAST_N, ANY_N, SPECIFIC_FRIDAYS
  fixedCount: integer('fixed_count').default(0).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Imams and Preachers
export const imams = pgTable('imams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').default('FLEXIBLE').notNull(), // FIXED, PARTIAL_FIXED, FLEXIBLE
  minFridays: integer('min_fridays').default(1).notNull(),
  targetFridays: integer('target_fridays').default(4).notNull(),
  maxFridays: integer('max_fridays').default(5).notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  region: text('region'),
  address: text('address'),
  // Structured Egyptian Location columns
  countryId: integer('country_id'),
  governorateId: integer('governorate_id'),
  districtId: integer('district_id'),
  areaId: integer('area_id'),
  street: text('street'),
  buildingNumber: text('building_number'),
  landmark: text('landmark'),
  formattedAddress: text('formatted_address'),
  legacyAddress: text('legacy_address'),
  needsReview: boolean('needs_review').default(false).notNull(),
  latitude: text('latitude'),
  longitude: text('longitude'),
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Fixed Assignment Patterns per Mosque and Hijri Year/Month
export const fixedAssignmentPatterns = pgTable('fixed_assignment_patterns', {
  id: serial('id').primaryKey(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  hijriYear: integer('hijri_year').notNull(),
  hijriMonth: integer('hijri_month').notNull(),
  patternType: text('pattern_type').default('SAME_ALL').notNull(), // SAME_ALL, SPLIT_COUNTS, SPECIFIC_FRIDAYS, CUSTOM
  fridaysCount: integer('fridays_count').default(5).notNull(), // 4 or 5
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Items of a pattern (Friday index -> Imam ID)
export const fixedAssignmentPatternItems = pgTable('fixed_assignment_pattern_items', {
  id: serial('id').primaryKey(),
  patternId: integer('pattern_id').references(() => fixedAssignmentPatterns.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(), // 1..5
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }).notNull(),
  sequence: integer('sequence').default(1).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Explicit Imam <-> Mosque relationships and preferences
export const mosqueImamRules = pgTable('mosque_imam_rules', {
  id: serial('id').primaryKey(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }).notNull(),
  relationshipType: text('relationship_type').notNull(), // FIXED, PREFERRED, ALLOWED, DISCOURAGED, FORBIDDEN, FLEXIBLE
  priority: integer('priority').default(1).notNull(), // 1 is highest priority for PREFERRED
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Imam availability exceptions per specific Hijri month & Friday
export const imamAvailabilities = pgTable('imam_availabilities', {
  id: serial('id').primaryKey(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }).notNull(),
  hijriYear: integer('hijri_year').notNull(),
  hijriMonth: integer('hijri_month').notNull(),
  fridayIndex: integer('friday_index').notNull(), // 1 to 5
  isAvailable: boolean('is_available').default(false).notNull(), // false = unavailable
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Monthly schedules
export const monthlySchedules = pgTable('monthly_schedules', {
  id: serial('id').primaryKey(),
  hijriYear: integer('hijri_year').notNull(),
  hijriMonth: integer('hijri_month').notNull(),
  monthName: text('month_name').notNull(),
  fridaysCount: integer('fridays_count').notNull(), // 4 or 5
  daysCount: integer('days_count').default(30).notNull(), // 29 or 30 days
  calendarProvider: text('calendar_provider').default('UMM_AL_QURA').notNull(), // UMM_AL_QURA, OFFICIAL_LOCAL, CUSTOM
  timezone: text('timezone').default('Africa/Cairo').notNull(),
  startDateGregorian: text('start_date_gregorian'),
  endDateGregorian: text('end_date_gregorian'),
  status: text('status').default('DRAFT').notNull(), // DRAFT, GENERATED, REVIEW, APPROVED, PUBLISHED, MODIFIED, NEEDS_REAPPROVAL
  currentVersion: integer('current_version').default(1).notNull(),
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Fridays for a monthly schedule
export const fridays = pgTable('fridays', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(), // 1..5
  hijriYear: integer('hijri_year'),
  hijriMonth: integer('hijri_month'),
  hijriDay: integer('hijri_day'),
  hijriDate: text('hijri_date').notNull(),
  gregorianDate: text('gregorian_date').notNull(),
  dayOfWeek: text('day_of_week').default('الجمعة').notNull(),
});

// Assignments: Imam assigned to a Mosque for a Friday
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  fridayId: integer('friday_id').references(() => fridays.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'set null' }),
  source: text('source').default('BALANCED_RANDOM').notNull(), // FIXED, PREFERENCE, BALANCED, RANDOM, BALANCED_RANDOM, MANUAL, OVERRIDE
  isLocked: boolean('is_locked').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Conflicts detected by scheduling engine or manual edits
export const conflicts = pgTable('conflicts', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  severity: text('severity').notNull(), // CRITICAL, WARNING, INFO
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }),
  fridayIndex: integer('friday_index'),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }),
  ruleCode: text('rule_code').notNull(),
  message: text('message').notNull(),
  possibleResolutions: text('possible_resolutions'), // JSON string array of resolutions
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Administrative overrides
export const overrides = pgTable('overrides', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: integer('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }),
  fridayIndex: integer('friday_index'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Manual modification history
export const assignmentHistory = pgTable('assignment_history', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: integer('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }).notNull(),
  oldImamId: integer('old_imam_id'),
  newImamId: integer('new_imam_id'),
  changedBy: text('changed_by'),
  reason: text('reason'),
  changedAt: timestamp('changed_at').defaultNow().notNull(),
});

// Schedule versions snapshots for approval and publishing
export const scheduleVersions = pgTable('schedule_versions', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Distribution / WhatsApp logs
export const distributionLogs = pgTable('distribution_logs', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  recipientType: text('recipient_type').notNull(), // MOSQUE, IMAM
  recipientId: integer('recipient_id').notNull(),
  recipientName: text('recipient_name').notNull(),
  phone: text('phone'),
  status: text('status').default('READY').notNull(), // READY, SENT, FAILED, MISSING_PHONE
  sentAt: timestamp('sent_at'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit trail for administrative actions
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  detailsJson: text('details_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Import / Export operational audit logs and error reports
export const importExportLogs = pgTable('import_export_logs', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  operationType: text('operation_type').notNull(), // 'IMPORT' | 'EXPORT'
  entityType: text('entity_type').notNull(), // 'MOSQUES' | 'IMAMS' | 'ALL'
  fileName: text('file_name').notNull(),
  fileFormat: text('file_format').default('XLSX').notNull(), // 'XLSX' | 'CSV'
  userEmail: text('user_email'),
  mode: text('mode').default('UPSERT').notNull(), // 'UPSERT' | 'INSERT_ONLY' | 'UPDATE_ONLY'
  status: text('status').default('IN_PROGRESS').notNull(), // 'COMPLETED' | 'COMPLETED_WITH_WARNINGS' | 'FAILED' | 'IN_PROGRESS'
  totalRows: integer('total_rows').default(0).notNull(),
  createdRows: integer('created_rows').default(0).notNull(),
  updatedRows: integer('updated_rows').default(0).notNull(),
  skippedRows: integer('skipped_rows').default(0).notNull(),
  errorRows: integer('error_rows').default(0).notNull(),
  summaryJson: text('summary_json'),
  errorReportJson: text('error_report_json'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Snapshots created prior to import execution for backup and rollback audit
export const importSnapshots = pgTable('import_snapshots', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  entityType: text('entity_type').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relational mappings
export const mosquesRelations = relations(mosques, ({ many }) => ({
  rules: many(mosqueImamRules),
  assignments: many(assignments),
  fixedPatterns: many(fixedAssignmentPatterns),
}));

export const imamsRelations = relations(imams, ({ many }) => ({
  rules: many(mosqueImamRules),
  availabilities: many(imamAvailabilities),
  assignments: many(assignments),
  fixedPatternItems: many(fixedAssignmentPatternItems),
}));

export const fixedAssignmentPatternsRelations = relations(fixedAssignmentPatterns, ({ one, many }) => ({
  mosque: one(mosques, {
    fields: [fixedAssignmentPatterns.mosqueId],
    references: [mosques.id],
  }),
  items: many(fixedAssignmentPatternItems),
}));

export const fixedAssignmentPatternItemsRelations = relations(fixedAssignmentPatternItems, ({ one }) => ({
  pattern: one(fixedAssignmentPatterns, {
    fields: [fixedAssignmentPatternItems.patternId],
    references: [fixedAssignmentPatterns.id],
  }),
  imam: one(imams, {
    fields: [fixedAssignmentPatternItems.imamId],
    references: [imams.id],
  }),
}));

export const mosqueImamRulesRelations = relations(mosqueImamRules, ({ one }) => ({
  mosque: one(mosques, {
    fields: [mosqueImamRules.mosqueId],
    references: [mosques.id],
  }),
  imam: one(imams, {
    fields: [mosqueImamRules.imamId],
    references: [imams.id],
  }),
}));

export const monthlySchedulesRelations = relations(monthlySchedules, ({ many }) => ({
  fridays: many(fridays),
  assignments: many(assignments),
  conflicts: many(conflicts),
  overrides: many(overrides),
  versions: many(scheduleVersions),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [assignments.scheduleId],
    references: [monthlySchedules.id],
  }),
  friday: one(fridays, {
    fields: [assignments.fridayId],
    references: [fridays.id],
  }),
  mosque: one(mosques, {
    fields: [assignments.mosqueId],
    references: [mosques.id],
  }),
  imam: one(imams, {
    fields: [assignments.imamId],
    references: [imams.id],
  }),
}));
