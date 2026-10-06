import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

export async function applyRlsPolicies() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  console.log('--- STARTING IDEMPOTENT RLS POLICY APPLICATION (PHASE 6B) ---');

  await c.query('BEGIN');

  try {
    // 1. Ensure unprivileged application role exists
    const roleCheck = await c.query("SELECT rolname FROM pg_roles WHERE rolname = 'scheduler_app'");
    if (roleCheck.rows.length === 0) {
      console.log('Creating unprivileged application role "scheduler_app"...');
      await c.query(`
        CREATE ROLE scheduler_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN NOBYPASSRLS;
      `);
    }
    await c.query(`
      GRANT scheduler_app TO postgres;
      GRANT USAGE ON SCHEMA public TO scheduler_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scheduler_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scheduler_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scheduler_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO scheduler_app;
    `);

    // 2. Helper functions for transaction-local identity
    console.log('Creating current_app_role() and current_app_user_id() functions...');
    await c.query(`
      CREATE OR REPLACE FUNCTION current_app_role() RETURNS text AS $$
        SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anon');
      $$ LANGUAGE sql STABLE;

      CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS text AS $$
        SELECT COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), '');
      $$ LANGUAGE sql STABLE;

      GRANT EXECUTE ON FUNCTION current_app_role() TO public;
      GRANT EXECUTE ON FUNCTION current_app_user_id() TO public;
    `);

    // 3. Drop all existing policies on the 11 tables (including unsafe "Allow scheduler access")
    const tables = [
      'organization_settings',
      'mosques',
      'imams',
      'mosque_imam_rules',
      'monthly_schedules',
      'fridays',
      'assignments',
      'assignment_history',
      'conflicts',
      'overrides',
      'audit_logs'
    ];

    for (const t of tables) {
      const existingPols = await c.query(
        "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        [t]
      );
      for (const p of existingPols.rows) {
        console.log(`Dropping old policy "${p.policyname}" on "${t}"...`);
        await c.query(`DROP POLICY IF EXISTS "${p.policyname}" ON "${t}"`);
      }
      // Ensure RLS enabled
      await c.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
    }

    // 4. Create new fine-grained policies
    console.log('Creating 38 targeted RLS policies across 11 tables...');

    // A. Public SELECT (6 tables)
    await c.query(`
      CREATE POLICY "public_select_mosques" ON mosques FOR SELECT USING (true);
      CREATE POLICY "public_select_imams" ON imams FOR SELECT USING (true);
      CREATE POLICY "public_select_schedules" ON monthly_schedules FOR SELECT USING (true);
      CREATE POLICY "public_select_fridays" ON fridays FOR SELECT USING (true);
      CREATE POLICY "public_select_assignments" ON assignments FOR SELECT USING (true);
      CREATE POLICY "public_select_settings" ON organization_settings FOR SELECT USING (true);
    `);

    // B. Authenticated SELECT (4 tables)
    await c.query(`
      CREATE POLICY "auth_select_rules" ON mosque_imam_rules FOR SELECT
        USING (current_app_role() IN ('viewer', 'staff', 'admin'));
      CREATE POLICY "auth_select_conflicts" ON conflicts FOR SELECT
        USING (current_app_role() IN ('viewer', 'staff', 'admin'));
      CREATE POLICY "auth_select_overrides" ON overrides FOR SELECT
        USING (current_app_role() IN ('viewer', 'staff', 'admin'));
      CREATE POLICY "auth_select_history" ON assignment_history FOR SELECT
        USING (current_app_role() IN ('viewer', 'staff', 'admin'));
    `);

    // C. Admin SELECT (1 table)
    await c.query(`
      CREATE POLICY "admin_select_audit_logs" ON audit_logs FOR SELECT
        USING (current_app_role() = 'admin');
    `);

    // D. Staff & Admin INSERT / UPDATE (6 tables)
    await c.query(`
      CREATE POLICY "staff_admin_insert_mosques" ON mosques FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_mosques" ON mosques FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));

      CREATE POLICY "staff_admin_insert_imams" ON imams FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_imams" ON imams FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));

      CREATE POLICY "staff_admin_insert_rules" ON mosque_imam_rules FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_rules" ON mosque_imam_rules FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));

      CREATE POLICY "staff_admin_insert_schedules" ON monthly_schedules FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_schedules" ON monthly_schedules FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));

      CREATE POLICY "staff_admin_insert_fridays" ON fridays FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_fridays" ON fridays FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));

      CREATE POLICY "staff_admin_insert_assignments" ON assignments FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "staff_admin_update_assignments" ON assignments FOR UPDATE
        USING (current_app_role() IN ('staff', 'admin'))
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
    `);

    // E. Admin Only INSERT / UPDATE (3 tables)
    await c.query(`
      CREATE POLICY "admin_update_settings" ON organization_settings FOR UPDATE
        USING (current_app_role() = 'admin')
        WITH CHECK (current_app_role() = 'admin');

      CREATE POLICY "staff_admin_insert_conflicts" ON conflicts FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "admin_update_conflicts" ON conflicts FOR UPDATE
        USING (current_app_role() = 'admin')
        WITH CHECK (current_app_role() = 'admin');

      CREATE POLICY "admin_insert_overrides" ON overrides FOR INSERT
        WITH CHECK (current_app_role() = 'admin');
      CREATE POLICY "admin_update_overrides" ON overrides FOR UPDATE
        USING (current_app_role() = 'admin')
        WITH CHECK (current_app_role() = 'admin');
    `);

    // F. Immutable Server-Only Tables (INSERT only, UPDATE/DELETE forbidden)
    await c.query(`
      CREATE POLICY "server_insert_audit_logs" ON audit_logs FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
      CREATE POLICY "server_insert_history" ON assignment_history FOR INSERT
        WITH CHECK (current_app_role() IN ('staff', 'admin'));
    `);

    // G. Admin Only DELETE (8 operational tables)
    await c.query(`
      CREATE POLICY "admin_delete_mosques" ON mosques FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_imams" ON imams FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_rules" ON mosque_imam_rules FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_schedules" ON monthly_schedules FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_fridays" ON fridays FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_assignments" ON assignments FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_conflicts" ON conflicts FOR DELETE
        USING (current_app_role() = 'admin');
      CREATE POLICY "admin_delete_overrides" ON overrides FOR DELETE
        USING (current_app_role() = 'admin');
    `);

    await c.query('COMMIT');
    console.log('✅ ALL 38 RLS POLICIES APPLIED SUCCESSFULLY.');
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('❌ Failed to apply RLS policies:', err);
    throw err;
  } finally {
    await c.end();
  }
}

applyRlsPolicies()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
