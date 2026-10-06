import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

export async function rollbackRls() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

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

  console.log('--- STARTING ROLLBACK TO PHASE 6A SECURITY STATE ---');

  await c.query('BEGIN');

  try {
    // 1. Drop all new Phase 6B policies on all 11 tables
    for (const t of tables) {
      const pols = await c.query(
        "SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = $1",
        [t]
      );
      for (const p of pols.rows) {
        if (p.policyname !== 'Allow scheduler access') {
          console.log(`Dropping policy "${p.policyname}" on "${t}"...`);
          await c.query(`DROP POLICY IF EXISTS "${p.policyname}" ON "${t}"`);
        }
      }
    }

    // 2. Re-create original "Allow scheduler access" policies if missing
    for (const t of tables) {
      const hasOrig = await c.query(
        "SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = $1 AND policyname = 'Allow scheduler access'",
        [t]
      );
      if (hasOrig.rows.length === 0) {
        console.log(`Re-creating original policy "Allow scheduler access" on "${t}"...`);
        await c.query(`
          CREATE POLICY "Allow scheduler access" ON "${t}"
          FOR ALL TO public
          USING (true)
          WITH CHECK (true);
        `);
      }
    }

    // 3. Ensure RLS is enabled as in snapshot
    for (const t of tables) {
      await c.query(`ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY`);
      await c.query(`ALTER TABLE "${t}" NO FORCE ROW LEVEL SECURITY`);
    }

    await c.query('COMMIT');
    console.log('✅ ROLLBACK COMPLETED SUCCESSFULLY. Restored exact Phase 6A security state.');
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('❌ Rollback failed:', err);
    throw err;
  } finally {
    await c.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  rollbackRls().catch(() => process.exit(1));
}
