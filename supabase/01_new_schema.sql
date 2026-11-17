-- =====================================================================
-- منظّم الجمعة: الجداول الجديدة + نقل البيانات من الجداول القديمة
-- شغّل الملف ده مرة واحدة من: Supabase > SQL Editor > New query > الصق > Run
-- آمن لو اتشغّل أكتر من مرة: مش بيمسح ولا بيكرر بيانات.
-- الجداول القديمة (mosques, imams, ...) مش بتتغير، وبتفضل نسخة احتياطية.
-- =====================================================================

-- الإعدادات العامة (صف واحد)
CREATE TABLE IF NOT EXISTS fs_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  org_name TEXT NOT NULL DEFAULT 'الجمعية الشرعية',
  branch_name TEXT DEFAULT '',
  admin_name TEXT DEFAULT '',
  admin_phone TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO fs_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- المساجد
CREATE TABLE IF NOT EXISTS fs_mosques (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'medium' CHECK (size IN ('large','medium','small')),
  phone TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  needed_fridays INTEGER[],            -- NULL = كل الجمعات، أو مثلاً {1,3}
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  legacy_id INTEGER UNIQUE,            -- رقمه في جدول mosques القديم
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- الخطباء
CREATE TABLE IF NOT EXISTS fs_preachers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  level TEXT NOT NULL DEFAULT 'mid' CHECK (level IN ('senior','mid','new')),
  max_fridays INTEGER NOT NULL DEFAULT 2 CHECK (max_fridays BETWEEN 0 AND 5),
  available_fridays INTEGER[],         -- NULL = متاح كل الجمعات
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT DEFAULT '',
  portal_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,  -- رابط صفحة الخطيب
  legacy_id INTEGER UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- الخطيب الثابت: لكل الجمعات (friday_index NULL) أو لجمعة معينة
CREATE TABLE IF NOT EXISTS fs_fixed (
  id BIGSERIAL PRIMARY KEY,
  mosque_id BIGINT NOT NULL REFERENCES fs_mosques(id) ON DELETE CASCADE,
  preacher_id BIGINT NOT NULL REFERENCES fs_preachers(id) ON DELETE CASCADE,
  friday_index INTEGER CHECK (friday_index BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fs_fixed_uniq ON fs_fixed (mosque_id, COALESCE(friday_index, 0));

-- رغبات المسجد: خطيب مفضل أو مرفوض
CREATE TABLE IF NOT EXISTS fs_preferences (
  id BIGSERIAL PRIMARY KEY,
  mosque_id BIGINT NOT NULL REFERENCES fs_mosques(id) ON DELETE CASCADE,
  preacher_id BIGINT NOT NULL REFERENCES fs_preachers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('prefer','avoid')),
  UNIQUE (mosque_id, preacher_id)
);

-- الشهور الهجرية (بداية الشهر حسب إعلان دار الإفتاء)
CREATE TABLE IF NOT EXISTS fs_months (
  id BIGSERIAL PRIMARY KEY,
  hijri_year INTEGER NOT NULL,
  hijri_month INTEGER NOT NULL CHECK (hijri_month BETWEEN 1 AND 12),
  start_date DATE NOT NULL,            -- أول يوم في الشهر (ميلادي)
  days_count INTEGER NOT NULL DEFAULT 30 CHECK (days_count IN (29,30)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (hijri_year, hijri_month)
);

-- اعتذار الخطيب عن جمعة في شهر معين (قبل التوزيع)
CREATE TABLE IF NOT EXISTS fs_unavailable (
  id BIGSERIAL PRIMARY KEY,
  month_id BIGINT NOT NULL REFERENCES fs_months(id) ON DELETE CASCADE,
  preacher_id BIGINT NOT NULL REFERENCES fs_preachers(id) ON DELETE CASCADE,
  friday_index INTEGER NOT NULL CHECK (friday_index BETWEEN 1 AND 5),
  reason TEXT DEFAULT '',
  UNIQUE (month_id, preacher_id, friday_index)
);

-- التكليفات
CREATE TABLE IF NOT EXISTS fs_assignments (
  id BIGSERIAL PRIMARY KEY,
  month_id BIGINT NOT NULL REFERENCES fs_months(id) ON DELETE CASCADE,
  mosque_id BIGINT NOT NULL REFERENCES fs_mosques(id) ON DELETE CASCADE,
  friday_index INTEGER NOT NULL CHECK (friday_index BETWEEN 1 AND 5),
  preacher_id BIGINT REFERENCES fs_preachers(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'auto' CHECK (source IN ('fixed','auto','manual')),
  locked BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','excused')),
  excuse_reason TEXT DEFAULT '',
  status_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,             -- آخر مرة اتبعتت رسالة الجمعة دي
  reminded_at TIMESTAMPTZ,             -- آخر تذكير الخميس
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (month_id, mosque_id, friday_index)
);
CREATE INDEX IF NOT EXISTS fs_assignments_preacher ON fs_assignments (preacher_id);

-- سجل التغييرات (تبديل خطيب، اعتذار، تأكيد)
CREATE TABLE IF NOT EXISTS fs_log (
  id BIGSERIAL PRIMARY KEY,
  month_id BIGINT REFERENCES fs_months(id) ON DELETE CASCADE,
  preacher_id BIGINT REFERENCES fs_preachers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                -- excuse | replace | confirm | publish ...
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- نقل البيانات من الجداول القديمة (لو موجودة)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.mosques') IS NOT NULL THEN
    INSERT INTO fs_mosques (name, phone, contact_name, is_active, notes, legacy_id)
    SELECT m.name, COALESCE(m.phone, ''), COALESCE(m.manager_name, ''), COALESCE(m.is_active, true), COALESCE(m.notes, ''), m.id
    FROM mosques m
    ON CONFLICT (legacy_id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي نقل المساجد: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF to_regclass('public.imams') IS NOT NULL THEN
    INSERT INTO fs_preachers (name, phone, max_fridays, is_active, notes, legacy_id)
    SELECT i.name, COALESCE(i.phone, ''), LEAST(GREATEST(COALESCE(i.max_fridays, 2), 0), 5), COALESCE(i.is_active, true), COALESCE(i.notes, ''), i.id
    FROM imams i
    ON CONFLICT (legacy_id) DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي نقل الخطباء: %', SQLERRM;
END $$;

-- الجمعات المتاحة الدائمة للخطيب (كانت مسجلة بسنة 0 وشهر 0)
DO $$
BEGIN
  IF to_regclass('public.imam_availabilities') IS NOT NULL THEN
    UPDATE fs_preachers p SET available_fridays = sub.days
    FROM (
      SELECT a.imam_id, ARRAY(SELECT d FROM generate_series(1,5) d
                              WHERE d NOT IN (SELECT x.friday_index FROM imam_availabilities x
                                              WHERE x.imam_id = a.imam_id AND x.hijri_year = 0 AND x.hijri_month = 0 AND x.is_available = false)) AS days
      FROM imam_availabilities a WHERE a.hijri_year = 0 AND a.hijri_month = 0 AND a.is_available = false
      GROUP BY a.imam_id
    ) sub
    WHERE p.legacy_id = sub.imam_id AND p.available_fridays IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي الجمعات المتاحة: %', SQLERRM;
END $$;

-- الخطيب الثابت لكل الجمعات (mosques.fixed_imam_id)
DO $$
BEGIN
  IF to_regclass('public.mosques') IS NOT NULL THEN
    INSERT INTO fs_fixed (mosque_id, preacher_id, friday_index)
    SELECT fm.id, fp.id, NULL
    FROM mosques m
    JOIN fs_mosques fm ON fm.legacy_id = m.id
    JOIN fs_preachers fp ON fp.legacy_id = m.fixed_imam_id
    WHERE m.fixed_imam_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي الخطيب الثابت: %', SQLERRM;
END $$;

-- الخطيب الثابت لجمعات معينة (آخر نمط ثابت محفوظ لكل مسجد)
DO $$
BEGIN
  IF to_regclass('public.fixed_assignment_patterns') IS NOT NULL THEN
    INSERT INTO fs_fixed (mosque_id, preacher_id, friday_index)
    SELECT DISTINCT ON (fm.id, it.friday_index) fm.id, fp.id, it.friday_index
    FROM fixed_assignment_patterns pt
    JOIN fixed_assignment_pattern_items it ON it.pattern_id = pt.id
    JOIN fs_mosques fm ON fm.legacy_id = pt.mosque_id
    JOIN fs_preachers fp ON fp.legacy_id = it.imam_id
    WHERE COALESCE(pt.is_active, true)
      AND NOT EXISTS (SELECT 1 FROM fs_fixed f WHERE f.mosque_id = fm.id AND f.friday_index IS NULL)
    ORDER BY fm.id, it.friday_index, pt.hijri_year DESC, pt.hijri_month DESC
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي الأنماط الثابتة: %', SQLERRM;
END $$;

-- رغبات المساجد (مفضل / ممنوع)
DO $$
BEGIN
  IF to_regclass('public.mosque_imam_rules') IS NOT NULL THEN
    INSERT INTO fs_preferences (mosque_id, preacher_id, kind)
    SELECT DISTINCT ON (fm.id, fp.id) fm.id, fp.id,
           CASE WHEN r.relationship_type IN ('FORBIDDEN','DISCOURAGED') THEN 'avoid' ELSE 'prefer' END
    FROM mosque_imam_rules r
    JOIN fs_mosques fm ON fm.legacy_id = r.mosque_id
    JOIN fs_preachers fp ON fp.legacy_id = r.imam_id
    WHERE r.relationship_type IN ('PREFERRED','FORBIDDEN','DISCOURAGED')
    ORDER BY fm.id, fp.id, CASE WHEN r.relationship_type = 'FORBIDDEN' THEN 0 ELSE 1 END
    ON CONFLICT DO NOTHING;
  END IF;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'تخطي رغبات المساجد: %', SQLERRM;
END $$;


-- ---------------------------------------------------------------------
-- صفحة الخطيب: دوال بتشتغل بالرابط الخاص بس، ومش بتكشف بيانات أي حد تاني
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fs_friday_date(p_start DATE, p_index INTEGER)
RETURNS DATE LANGUAGE sql IMMUTABLE AS $$
  SELECT p_start + ((5 - EXTRACT(DOW FROM p_start)::INT + 7) % 7) + 7 * (p_index - 1)
$$;

CREATE OR REPLACE FUNCTION portal_get(p_token UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_preacher fs_preachers%ROWTYPE;
  v_result JSON;
BEGIN
  SELECT * INTO v_preacher FROM fs_preachers WHERE portal_token = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'preacher', json_build_object('id', v_preacher.id, 'name', v_preacher.name),
    'org_name', (SELECT org_name FROM fs_settings WHERE id = 1),
    'admin_name', (SELECT admin_name FROM fs_settings WHERE id = 1),
    'admin_phone', (SELECT admin_phone FROM fs_settings WHERE id = 1),
    'items', COALESCE((
      SELECT json_agg(x ORDER BY x.date)
      FROM (
        SELECT a.id, a.friday_index, a.status, a.excuse_reason,
               fs_friday_date(mo.start_date, a.friday_index) AS date,
               (fs_friday_date(mo.start_date, a.friday_index) - mo.start_date + 1) AS hijri_day,
               mo.hijri_month, mo.hijri_year,
               m.name AS mosque_name
        FROM fs_assignments a
        JOIN fs_months mo ON mo.id = a.month_id AND mo.status = 'published'
        JOIN fs_mosques m ON m.id = a.mosque_id
        WHERE a.preacher_id = v_preacher.id
          AND fs_friday_date(mo.start_date, a.friday_index) >= CURRENT_DATE - 7
      ) x
    ), '[]'::json)
  ) INTO v_result;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION portal_set_status(p_token UUID, p_assignment_id BIGINT, p_status TEXT, p_reason TEXT DEFAULT '')
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_preacher_id BIGINT;
  v_a fs_assignments%ROWTYPE;
BEGIN
  IF p_status NOT IN ('confirmed', 'excused') THEN RETURN FALSE; END IF;
  SELECT id INTO v_preacher_id FROM fs_preachers WHERE portal_token = p_token;
  IF v_preacher_id IS NULL THEN RETURN FALSE; END IF;

  SELECT a.* INTO v_a FROM fs_assignments a
  JOIN fs_months mo ON mo.id = a.month_id AND mo.status = 'published'
  WHERE a.id = p_assignment_id AND a.preacher_id = v_preacher_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE fs_assignments
     SET status = p_status,
         excuse_reason = CASE WHEN p_status = 'excused' THEN LEFT(COALESCE(p_reason, ''), 300) ELSE '' END,
         status_at = NOW(), updated_at = NOW()
   WHERE id = v_a.id;

  IF p_status = 'excused' THEN
    INSERT INTO fs_unavailable (month_id, preacher_id, friday_index, reason)
    VALUES (v_a.month_id, v_preacher_id, v_a.friday_index, LEFT(COALESCE(p_reason, ''), 300))
    ON CONFLICT (month_id, preacher_id, friday_index) DO NOTHING;
  END IF;

  INSERT INTO fs_log (month_id, preacher_id, action, details)
  VALUES (v_a.month_id, v_preacher_id, CASE WHEN p_status = 'excused' THEN 'excuse' ELSE 'confirm' END,
          'من صفحة الخطيب' || CASE WHEN COALESCE(p_reason, '') <> '' THEN ': ' || LEFT(p_reason, 300) ELSE '' END);
  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION portal_get(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION portal_set_status(UUID, BIGINT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- صلاحيات مؤقتة مفتوحة (زي الجداول القديمة) لحد مرحلة الأمان،
-- ملف 02_security.sql بيقفلها للمسؤول بس.
-- ---------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['fs_settings','fs_mosques','fs_preachers','fs_fixed','fs_preferences','fs_months','fs_unavailable','fs_assignments','fs_log']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'temp_open') THEN
      EXECUTE format('CREATE POLICY temp_open ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END IF;
  END LOOP;
END $$;

SELECT
  (SELECT count(*) FROM fs_mosques)   AS "المساجد",
  (SELECT count(*) FROM fs_preachers) AS "الخطباء",
  (SELECT count(*) FROM fs_fixed)     AS "الثوابت",
  (SELECT count(*) FROM fs_preferences) AS "الرغبات";
