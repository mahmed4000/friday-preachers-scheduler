import 'dotenv/config';
import { db, createPool, isDatabaseConfigured } from '../src/db/index.ts';
import {
  organizationSettings,
  mosques,
  imams,
  mosqueImamRules,
  monthlySchedules,
  fridays,
  assignments,
  assignmentHistory,
  conflicts,
  overrides,
  auditLogs,
} from '../src/db/schema.ts';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('===============================================================');
  console.log('--- PHASE 3A: PREFLIGHT POSTGRESQL & DRIZZLE VERIFICATION ---');
  console.log('===============================================================');

  if (!isDatabaseConfigured) {
    console.error('❌ DATABASE_URL is missing or not configured!');
    process.exit(1);
  }
  console.log('✅ DATABASE_URL is configured.');

  const pool = createPool();
  const rawClient = await pool.connect();
  let dbIdentity: any = {};
  try {
    const identRes = await rawClient.query(`
      SELECT current_database() as db_name, current_user as db_user, version() as pg_version
    `);
    dbIdentity = identRes.rows[0];
    console.log(`✅ Connected to PostgreSQL!`);
    console.log(`   Database Name : ${dbIdentity.db_name}`);
    console.log(`   Database User : ${dbIdentity.db_user}`);
    console.log(`   PostgreSQL Ver: ${dbIdentity.pg_version.split(' ')[0]} ${dbIdentity.pg_version.split(' ')[1]}`);

    // Verify host
    const connStr = process.env.DATABASE_URL || '';
    if (connStr.includes('tctaqmtvypibxsaehawf')) {
      console.log(`   Host Project  : tctaqmtvypibxsaehawf (Verified Production Neon/Supabase DB)`);
    } else {
      console.warn(`   Host Project  : Custom/Other connection`);
    }
  } finally {
    rawClient.release();
  }

  console.log('\n--- EXACT PRODUCTION BASELINE COUNTS (11 PRODUCTION TABLES) ---');
  const [
    mSettings,
    mMosques,
    mImams,
    mRules,
    mSchedules,
    mFridays,
    mAssignments,
    mHistory,
    mConflicts,
    mOverrides,
    mAudit,
  ] = await Promise.all([
    db.select().from(organizationSettings),
    db.select().from(mosques),
    db.select().from(imams),
    db.select().from(mosqueImamRules),
    db.select().from(monthlySchedules),
    db.select().from(fridays),
    db.select().from(assignments),
    db.select().from(assignmentHistory),
    db.select().from(conflicts),
    db.select().from(overrides),
    db.select().from(auditLogs),
  ]);

  const baseline = {
    organization_settings: mSettings.length,
    mosques: mMosques.length,
    imams: mImams.length,
    mosque_imam_rules: mRules.length,
    monthly_schedules: mSchedules.length,
    fridays: mFridays.length,
    assignments: mAssignments.length,
    assignment_history: mHistory.length,
    conflicts: mConflicts.length,
    overrides: mOverrides.length,
    audit_logs: mAudit.length,
  };

  console.table(baseline);

  console.log('\nBASELINE_JSON=' + JSON.stringify(baseline));
  console.log('===============================================================');
  console.log('✅ PHASE 3A PREFLIGHT VERIFICATION PASSED');
  console.log('===============================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Preflight failed:', err);
  process.exit(1);
});
