-- ====================================================================
-- نظام جدولة خطباء الجمعة - مخطط قاعدة بيانات سحابة Supabase (PostgreSQL)
-- الجمعية الخيرية لرعاية المساجد والدعوة والإرشاد
-- ====================================================================

-- 1. جدول إعدادات الجمعية (Organization Settings)
CREATE TABLE IF NOT EXISTS organization_settings (
  id SERIAL PRIMARY KEY,
  association_name TEXT NOT NULL DEFAULT 'جمعية العناية بالمساجد',
  branch_name TEXT DEFAULT 'الإدارة العامة لشؤون الخطباء',
  calendar_provider TEXT DEFAULT 'UMM_AL_QURA',
  timezone TEXT DEFAULT 'Asia/Riyadh',
  contact_phone TEXT,
  contact_email TEXT,
  website TEXT,
  address TEXT,
  formatted_address TEXT,
  default_distribution_method TEXT DEFAULT 'Balanced Random',
  auto_lock_fixed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. جدول المساجد والجوامع (Mosques)
CREATE TABLE IF NOT EXISTS mosques (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  region TEXT DEFAULT 'الوسط',
  address TEXT,
  manager_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  fixed_imam_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. جدول الخطباء والمشايخ (Imams)
CREATE TABLE IF NOT EXISTS imams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  type TEXT DEFAULT 'FLEXIBLE', -- 'FIXED' | 'PARTIAL_FIXED' | 'FLEXIBLE'
  region TEXT DEFAULT 'الوسط',
  min_fridays INTEGER DEFAULT 1,
  max_fridays INTEGER DEFAULT 4,
  target_fridays INTEGER DEFAULT 2,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول قواعد التوافق والمفاضلة (Mosque-Imam Rules Matrix)
CREATE TABLE IF NOT EXISTS mosque_imam_rules (
  id SERIAL PRIMARY KEY,
  mosque_id INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  imam_id INTEGER NOT NULL REFERENCES imams(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- 'PREFERRED' | 'FORBIDDEN'
  priority INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. جدول الجداول الشهرية (Monthly Schedules)
CREATE TABLE IF NOT EXISTS monthly_schedules (
  id SERIAL PRIMARY KEY,
  hijri_year INTEGER NOT NULL,
  hijri_month INTEGER NOT NULL,
  month_name TEXT NOT NULL,
  calendar_provider TEXT DEFAULT 'UMM_AL_QURA',
  timezone TEXT DEFAULT 'Asia/Riyadh',
  fridays_count INTEGER NOT NULL,
  status TEXT DEFAULT 'DRAFT', -- 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'NEEDS_REAPPROVAL'
  current_version INTEGER DEFAULT 1,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. جدول جمعات الشهر (Fridays)
CREATE TABLE IF NOT EXISTS fridays (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  friday_index INTEGER NOT NULL,
  hijri_date TEXT NOT NULL,
  gregorian_date TEXT NOT NULL,
  gregorian_iso TEXT NOT NULL,
  period_status TEXT DEFAULT 'FUTURE', -- 'PAST' | 'CURRENT' | 'FUTURE'
  is_past BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. جدول التكليفات والتعيينات (Assignments)
CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  mosque_id INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  friday_index INTEGER NOT NULL,
  imam_id INTEGER REFERENCES imams(id) ON DELETE SET NULL,
  is_locked BOOLEAN DEFAULT false,
  source TEXT DEFAULT 'BALANCED', -- 'FIXED' | 'PREFERENCE' | 'BALANCED' | 'BALANCED_RANDOM' | 'MANUAL' | 'OVERRIDE'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. سجل التاريخ للتعديلات والتبديل (Assignment History)
CREATE TABLE IF NOT EXISTS assignment_history (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  old_imam_id INTEGER REFERENCES imams(id) ON DELETE SET NULL,
  new_imam_id INTEGER REFERENCES imams(id) ON DELETE SET NULL,
  changed_by TEXT DEFAULT 'admin@aljameya.org',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. جدول التعارضات (Conflicts Center)
CREATE TABLE IF NOT EXISTS conflicts (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  conflict_type TEXT NOT NULL,
  severity TEXT DEFAULT 'WARNING', -- 'CRITICAL' | 'WARNING' | 'INFO'
  description TEXT NOT NULL,
  mosque_id INTEGER REFERENCES mosques(id) ON DELETE SET NULL,
  imam_id INTEGER REFERENCES imams(id) ON DELETE SET NULL,
  friday_index INTEGER,
  status TEXT DEFAULT 'OPEN', -- 'OPEN' | 'RESOLVED' | 'IGNORED'
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. جدول الاستثناءات الإدارية المعتمدة (Overrides)
CREATE TABLE IF NOT EXISTS overrides (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES monthly_schedules(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  imam_id INTEGER REFERENCES imams(id) ON DELETE SET NULL,
  mosque_id INTEGER NOT NULL REFERENCES mosques(id) ON DELETE CASCADE,
  friday_index INTEGER NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT NOT NULL,
  created_by TEXT DEFAULT 'مدير النظام',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. سجل التدقيق الرقابي والأمني (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس تحسين الأداء والبحث (Performance Indexes)
CREATE INDEX IF NOT EXISTS idx_assignments_schedule ON assignments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_assignments_friday ON assignments(friday_index);
CREATE INDEX IF NOT EXISTS idx_assignments_imam ON assignments(imam_id);
CREATE INDEX IF NOT EXISTS idx_fridays_schedule ON fridays(schedule_id);
CREATE INDEX IF NOT EXISTS idx_conflicts_schedule ON conflicts(schedule_id);
CREATE INDEX IF NOT EXISTS idx_rules_mosque ON mosque_imam_rules(mosque_id);
CREATE INDEX IF NOT EXISTS idx_rules_imam ON mosque_imam_rules(imam_id);

-- سياسات الأمان (Row Level Security) - إتاحة القراءة والكتابة لنظام الجدولة
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mosques ENABLE ROW LEVEL SECURITY;
ALTER TABLE imams ENABLE ROW LEVEL SECURITY;
ALTER TABLE mosque_imam_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fridays ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- سياسة سماح عامة للتطبيق (Permissive for Service/Scheduler operations)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow scheduler access') THEN
    CREATE POLICY "Allow scheduler access" ON organization_settings FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON mosques FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON imams FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON mosque_imam_rules FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON monthly_schedules FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON fridays FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON assignments FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON assignment_history FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON conflicts FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON overrides FOR ALL USING (true) WITH CHECK (true);
    CREATE POLICY "Allow scheduler access" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
