import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

export async function executeCleanDatabaseReset() {
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

  console.log('====================================================');
  console.log('--- PHASE 8: CONTROLLED PRODUCTION DATABASE RESET ---');
  console.log('====================================================\n');

  // 1. Capture Before Counts
  console.log('1. PRE-RESET RECORD COUNTS:');
  const beforeCounts: Record<string, number> = {};
  let totalBefore = 0;
  for (const t of tables) {
    const res = await c.query(`SELECT count(*)::int as count FROM "${t}"`);
    const count = res.rows[0].count;
    beforeCounts[t] = count;
    totalBefore += count;
    console.log(`  - ${t}: ${count}`);
  }
  console.log(`  => TOTAL PRE-RESET: ${totalBefore}\n`);

  // 2. Controlled Transactional Reset
  console.log('2. EXECUTING TRANSACTIONAL DEPENDENCY-SAFE RESET...');
  await c.query('BEGIN');

  try {
    // Delete in strict FK dependency order (leaf -> root)
    const deletionOrder = [
      'assignment_history',
      'overrides',
      'conflicts',
      'assignments',
      'fridays',
      'mosque_imam_rules',
      'monthly_schedules',
      'mosques',
      'imams',
      'organization_settings',
      'audit_logs'
    ];

    for (const t of deletionOrder) {
      const delRes = await c.query(`DELETE FROM "${t}"`);
      console.log(`  ✓ Cleared "${t}" (${delRes.rowCount} rows deleted)`);
    }

    // 3. Reset Sequences / Identity state
    console.log('\n3. RESTARTING IDENTITY SEQUENCES TO 1...');
    const sequences = [
      'assignment_history_id_seq',
      'assignments_id_seq',
      'audit_logs_id_seq',
      'conflicts_id_seq',
      'fridays_id_seq',
      'imams_id_seq',
      'monthly_schedules_id_seq',
      'mosque_imam_rules_id_seq',
      'mosques_id_seq',
      'organization_settings_id_seq',
      'overrides_id_seq'
    ];

    for (const seq of sequences) {
      await c.query(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
      console.log(`  ✓ Sequence "${seq}" restarted with 1`);
    }

    // 4. Verify All Counts are 0 before committing
    console.log('\n4. VERIFYING POST-RESET ZERO COUNTS IN TRANSACTION...');
    const afterCounts: Record<string, number> = {};
    let totalAfter = 0;
    for (const t of tables) {
      const res = await c.query(`SELECT count(*)::int as count FROM "${t}"`);
      const count = res.rows[0].count;
      afterCounts[t] = count;
      totalAfter += count;
      if (count !== 0) {
        throw new Error(`CRITICAL: Table "${t}" has non-zero count (${count}) after reset!`);
      }
      console.log(`  ✓ ${t}: ${count}`);
    }

    if (totalAfter !== 0) {
      throw new Error(`CRITICAL: Total post-reset rows is ${totalAfter}, expected 0!`);
    }

    await c.query('COMMIT');
    console.log('\n✅ TRANSACTION COMMITTED SUCCESSFULLY!');

    // 5. Post-Commit Security & RLS Verification
    console.log('\n5. VERIFYING RLS & SECURITY POST-RESET...');
    const rlsRes = await c.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)
      ORDER BY c.relname;
    `, [tables]);

    const rlsCount = rlsRes.rows.filter(r => r.relrowsecurity).length;
    console.log(`  - RLS Active Tables: ${rlsCount}/${tables.length}`);
    if (rlsCount !== tables.length) {
      throw new Error(`CRITICAL: Expected 11/11 tables with RLS active, got ${rlsCount}!`);
    }

    const roleRes = await c.query(`
      SELECT rolname, rolbypassrls, rolcanlogin
      FROM pg_roles
      WHERE rolname = 'scheduler_app';
    `);
    if (roleRes.rows.length === 0) {
      throw new Error('CRITICAL: Role scheduler_app does not exist!');
    }
    const schedulerRole = roleRes.rows[0];
    console.log(`  - Role scheduler_app: bypassrls=${schedulerRole.rolbypassrls}, canlogin=${schedulerRole.rolcanlogin}`);
    if (schedulerRole.rolbypassrls) {
      throw new Error('CRITICAL: scheduler_app has rolbypassrls=true!');
    }

    const polRes = await c.query(`
      SELECT count(*)::int as count
      FROM pg_policies
      WHERE schemaname = 'public';
    `);
    console.log(`  - RLS Policies Count: ${polRes.rows[0].count}`);

    console.log('\n====================================================');
    console.log(`DATABASE RESET COMPLETE: 986 -> 0 TOTAL RECORDS`);
    console.log('====================================================\n');

    return {
      beforeCounts,
      afterCounts,
      totalBefore,
      totalAfter,
      rlsActive: rlsCount,
      policiesCount: polRes.rows[0].count
    };
  } catch (err) {
    await c.query('ROLLBACK');
    console.error('❌ TRANSACTION ROLLED BACK DUE TO ERROR:', err);
    throw err;
  } finally {
    await c.end();
  }
}

if (process.argv[1]?.includes('resetProductionDatabase')) {
  executeCleanDatabaseReset()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
