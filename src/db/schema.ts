import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

// ====================================================================
// AUTHORITATIVE DATABASE SCHEMA (PostgreSQL / Supabase)
// Matches supabase_schema.sql and live database pg_catalog 100%
// ====================================================================

// 1. Organization Settings
export const organizationSettings = pgTable('organization_settings', {
  id: serial('id').primaryKey(),
  associationName: text('association_name').default('جمعية العناية بالمساجد'),
  branchName: text('branch_name').default('الإدارة العامة لشؤون الخطباء'),
  calendarProvider: text('calendar_provider').default('UMM_AL_QURA'),
  timezone: text('timezone').default('Asia/Riyadh'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  website: text('website'),
  address: text('address'),
  formattedAddress: text('formatted_address'),
  defaultDistributionMethod: text('default_distribution_method').default('Balanced Random'),
  autoLockFixed: boolean('auto_lock_fixed').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 2. Mosques
export const mosques = pgTable('mosques', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  region: text('region').default('الوسط'),
  address: text('address'),
  managerName: text('manager_name'),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  fixedImamId: integer('fixed_imam_id'),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 3. Imams
export const imams = pgTable('imams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  whatsapp: text('whatsapp'),
  type: text('type').default('FLEXIBLE'),
  region: text('region').default('الوسط'),
  minFridays: integer('min_fridays').default(1),
  maxFridays: integer('max_fridays').default(4),
  targetFridays: integer('target_fridays').default(2),
  isActive: boolean('is_active').default(true),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 4. Mosque-Imam Rules
export const mosqueImamRules = pgTable('mosque_imam_rules', {
  id: serial('id').primaryKey(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'cascade' }).notNull(),
  relationshipType: text('relationship_type').notNull(),
  priority: integer('priority').default(1),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 5. Monthly Schedules
export const monthlySchedules = pgTable('monthly_schedules', {
  id: serial('id').primaryKey(),
  hijriYear: integer('hijri_year').notNull(),
  hijriMonth: integer('hijri_month').notNull(),
  monthName: text('month_name').notNull(),
  calendarProvider: text('calendar_provider').default('UMM_AL_QURA'),
  timezone: text('timezone').default('Asia/Riyadh'),
  fridaysCount: integer('fridays_count').notNull(),
  status: text('status').default('DRAFT'),
  currentVersion: integer('current_version').default(1),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 6. Fridays
export const fridays = pgTable('fridays', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(),
  hijriDate: text('hijri_date').notNull(),
  gregorianDate: text('gregorian_date').notNull(),
  gregorianIso: text('gregorian_iso').notNull(),
  periodStatus: text('period_status').default('FUTURE'),
  isPast: boolean('is_past').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 7. Assignments
export const assignments = pgTable('assignments', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'set null' }),
  isLocked: boolean('is_locked').default(false),
  source: text('source').default('BALANCED'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// 8. Assignment History
export const assignmentHistory = pgTable('assignment_history', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: integer('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }).notNull(),
  oldImamId: integer('old_imam_id').references(() => imams.id, { onDelete: 'set null' }),
  newImamId: integer('new_imam_id').references(() => imams.id, { onDelete: 'set null' }),
  changedBy: text('changed_by').default('admin@aljameya.org'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 9. Conflicts
export const conflicts = pgTable('conflicts', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  conflictType: text('conflict_type').notNull(),
  severity: text('severity').default('WARNING'),
  description: text('description').notNull(),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'set null' }),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'set null' }),
  fridayIndex: integer('friday_index'),
  status: text('status').default('OPEN'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 10. Overrides
export const overrides = pgTable('overrides', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').references(() => monthlySchedules.id, { onDelete: 'cascade' }).notNull(),
  assignmentId: integer('assignment_id').references(() => assignments.id, { onDelete: 'cascade' }).notNull(),
  imamId: integer('imam_id').references(() => imams.id, { onDelete: 'set null' }),
  mosqueId: integer('mosque_id').references(() => mosques.id, { onDelete: 'cascade' }).notNull(),
  fridayIndex: integer('friday_index').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  reason: text('reason').notNull(),
  createdBy: text('created_by').default('مدير النظام'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 11. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: integer('entity_id'),
  detailsJson: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ====================================================================
// DRIZZLE RELATIONS (For 11 Authoritative Tables)
// ====================================================================

export const mosquesRelations = relations(mosques, ({ many }) => ({
  rules: many(mosqueImamRules),
  assignments: many(assignments),
}));

export const imamsRelations = relations(imams, ({ many }) => ({
  rules: many(mosqueImamRules),
  assignments: many(assignments),
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
  history: many(assignmentHistory),
}));

export const fridaysRelations = relations(fridays, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [fridays.scheduleId],
    references: [monthlySchedules.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [assignments.scheduleId],
    references: [monthlySchedules.id],
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

export const assignmentHistoryRelations = relations(assignmentHistory, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [assignmentHistory.scheduleId],
    references: [monthlySchedules.id],
  }),
  assignment: one(assignments, {
    fields: [assignmentHistory.assignmentId],
    references: [assignments.id],
  }),
}));

export const conflictsRelations = relations(conflicts, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [conflicts.scheduleId],
    references: [monthlySchedules.id],
  }),
  mosque: one(mosques, {
    fields: [conflicts.mosqueId],
    references: [mosques.id],
  }),
  imam: one(imams, {
    fields: [conflicts.imamId],
    references: [imams.id],
  }),
}));

export const overridesRelations = relations(overrides, ({ one }) => ({
  schedule: one(monthlySchedules, {
    fields: [overrides.scheduleId],
    references: [monthlySchedules.id],
  }),
  assignment: one(assignments, {
    fields: [overrides.assignmentId],
    references: [assignments.id],
  }),
  mosque: one(mosques, {
    fields: [overrides.mosqueId],
    references: [mosques.id],
  }),
  imam: one(imams, {
    fields: [overrides.imamId],
    references: [imams.id],
  }),
}));

// ====================================================================
// NON-DATABASE AUXILIARY SCHEMA STUBS
// Preserved strictly for module import compatibility.
// These tables DO NOT exist in the PostgreSQL database.
// ====================================================================

export const countries = pgTable('countries', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  nameAr: text('name_ar').notNull(),
});

export const administrativeUnits = pgTable('administrative_units', {
  id: serial('id').primaryKey(),
  countryId: integer('country_id').notNull(),
  level: integer('level').notNull(),
  nameAr: text('name_ar').notNull(),
});

export const addresses = pgTable('addresses', {
  id: serial('id').primaryKey(),
  formattedAddress: text('formatted_address').notNull(),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  role: text('role').default('admin').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const fixedAssignmentPatterns = pgTable('fixed_assignment_patterns', {
  id: serial('id').primaryKey(),
  mosqueId: integer('mosque_id').notNull(),
  hijriYear: integer('hijri_year').notNull(),
  hijriMonth: integer('hijri_month').notNull(),
});

export const fixedAssignmentPatternItems = pgTable('fixed_assignment_pattern_items', {
  id: serial('id').primaryKey(),
  patternId: integer('pattern_id').notNull(),
  fridayIndex: integer('friday_index').notNull(),
  imamId: integer('imam_id').notNull(),
});

export const imamAvailabilities = pgTable('imam_availabilities', {
  id: serial('id').primaryKey(),
  imamId: integer('imam_id').notNull(),
  hijriYear: integer('hijri_year').notNull().default(0),
  hijriMonth: integer('hijri_month').notNull().default(0),
  fridayIndex: integer('friday_index').notNull(),
  isAvailable: boolean('is_available').default(false).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const scheduleVersions = pgTable('schedule_versions', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
});

export const distributionLogs = pgTable('distribution_logs', {
  id: serial('id').primaryKey(),
  scheduleId: integer('schedule_id').notNull(),
  recipientType: text('recipient_type').notNull(),
  recipientId: integer('recipient_id').notNull(),
  recipientName: text('recipient_name').notNull(),
});

export const importExportLogs = pgTable('import_export_logs', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  operationType: text('operation_type').notNull(),
  entityType: text('entity_type').notNull(),
  fileName: text('file_name').notNull(),
});

export const importSnapshots = pgTable('import_snapshots', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull(),
  entityType: text('entity_type').notNull(),
  snapshotJson: text('snapshot_json').notNull(),
});
