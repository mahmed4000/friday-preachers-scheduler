-- =====================================================================
-- قفل قاعدة البيانات: القراءة والكتابة للمسؤول المسجّل دخوله فقط
-- شغّل الملف ده مرة واحدة من Supabase > SQL Editor
-- بعد ما تدمج تحديث تسجيل الدخول وتتأكد إنك قادر تدخل البرنامج.
-- =====================================================================
DO $$
DECLARE
  t RECORD;
  p RECORD;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);

    -- نشيل كل السياسات القديمة المفتوحة للجميع
    FOR p IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t.tablename);
    END LOOP;

    -- سياسة واحدة: المستخدم المسجّل دخوله بس
    EXECUTE format(
      'CREATE POLICY "admin_only" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t.tablename
    );
  END LOOP;
END $$;

-- للتأكد: لازم كل الجداول تظهر بسياسة admin_only بس
SELECT tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
