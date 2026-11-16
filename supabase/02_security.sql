-- =====================================================================
-- منظّم الجمعة: قفل قاعدة البيانات (آخر خطوة)
-- شغّله بعد ما:
--   1) تشغّل 01_new_schema.sql
--   2) تعمل حساب المسؤول من Supabase > Authentication > Users > Add user
--   3) تكتب بريد المسؤول تحت مكان admin@example.com
-- بعده: محدش يقدر يقرا أو يعدّل البيانات غير البريد المسجل هنا.
-- صفحة الخطيب (/p/...) بتفضل شغالة لأنها بتستخدم دوال portal_get و portal_set_status بس.
-- آمن لو اتشغّل أكتر من مرة.
-- =====================================================================

-- قايمة المسؤولين المسموح لهم
CREATE TABLE IF NOT EXISTS fs_admins (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fs_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fs_admins FROM anon, authenticated;

-- ✏️ غيّر البريد ده لبريد المسؤول (ولو فيه أكتر من مسؤول كرر السطر)
INSERT INTO fs_admins (email) VALUES (lower('admin@example.com')) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION fs_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM fs_admins WHERE email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
REVOKE ALL ON FUNCTION fs_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fs_is_admin() TO authenticated;

-- الجداول الجديدة: نشيل السماح المؤقت، ونسمح للمسؤول بس
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fs_settings','fs_mosques','fs_preachers','fs_fixed','fs_preferences','fs_months','fs_unavailable','fs_assignments','fs_log'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS temp_open ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS admin_only ON %I', t);
    EXECUTE format('CREATE POLICY admin_only ON %I FOR ALL TO authenticated USING (fs_is_admin()) WITH CHECK (fs_is_admin())', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

-- الجداول القديمة (نسخة احتياطية): نقفلها كمان، والمسؤول يقدر يقراها بس
DO $$
DECLARE t TEXT; p RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT LIKE 'fs\_%'
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY admin_read ON %I FOR SELECT TO authenticated USING (fs_is_admin())', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon', t);
  END LOOP;
END $$;

-- للتأكد: لازم يطلع بريدك هنا
SELECT email AS "المسؤولين" FROM fs_admins;
