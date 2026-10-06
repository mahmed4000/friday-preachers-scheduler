import { createPool, isDatabaseConfigured, isDatabaseAvailable, db } from '../src/db/index.ts';
import * as schema from '../src/db/schema.ts';

export async function verifyPhase1Database() {
  console.log('============================================================');
  console.log('PHASE 1 — REAL POSTGRESQL CONNECTION & SCHEMA VERIFICATION');
  console.log('============================================================\n');

  console.log('1. فحص تهيئة متغيرات البيئة (Environment Variables Check):');
  const hasDbUrl = Boolean(process.env.DATABASE_URL);
  const hasPostgresUrl = Boolean(process.env.POSTGRES_URL);
  const hasVercelUrl = Boolean(process.env.VERCEL_POSTGRES_URL);

  console.log(`- DATABASE_URL: ${hasDbUrl ? '[موجود - تم حجب القيمة للأمان]' : '[غير معرف]'}`);
  console.log(`- POSTGRES_URL: ${hasPostgresUrl ? '[موجود - تم حجب القيمة للأمان]' : '[غير معرف]'}`);
  console.log(`- VERCEL_POSTGRES_URL: ${hasVercelUrl ? '[موجود - تم حجب القيمة للأمان]' : '[غير معرف]'}`);
  console.log(`- isDatabaseConfigured: ${isDatabaseConfigured}`);
  console.log(`- isDatabaseAvailable(): ${isDatabaseAvailable()}\n`);

  if (!isDatabaseConfigured) {
    console.error('❌ [PHASE 1 RESULT: BLOCKED]');
    console.error('لم يتم العثور على متغير DATABASE_URL أو POSTGRES_URL في البيئة.');
    console.error('وفقاً للضابط الرقابي CONTROL 1: يُحظر اختراع أو تخمين بيانات الاعتماد أو استبدال قاعدة البيانات.');
    return {
      connected: false,
      reason: 'MISSING_DATABASE_URL',
      tablesVerified: 0,
    };
  }

  const pool = createPool();

  try {
    console.log('2. فحص الاتصال المباشر بقاعدة بيانات PostgreSQL (Handshake & Identity):');
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT current_database() AS db_name, current_user AS db_user, version() AS db_version');
      const row = res.rows[0];
      console.log(`✅ تم الاتصال بنجاح بقاعدة البيانات: ${row.db_name}`);
      console.log(`✅ المستخدم المتصل: ${row.db_user}`);
      console.log(`✅ إصدار PostgreSQL: ${row.db_version.split(' on ')[0]}\n`);
    } finally {
      client.release();
    }

    console.log('3. فحص وجود الجداول المطلوبة وتوافق Drizzle ORM (Schema Verification):');
    const tablesToCheck = [
      { name: 'organization_settings', model: schema.organizationSettings },
      { name: 'mosques', model: schema.mosques },
      { name: 'imams', model: schema.imams },
      { name: 'mosque_imam_rules', model: schema.mosqueImamRules },
      { name: 'monthly_schedules', model: schema.monthlySchedules },
      { name: 'fridays', model: schema.fridays },
      { name: 'assignments', model: schema.assignments },
      { name: 'assignment_history', model: schema.assignmentHistory },
      { name: 'conflicts', model: schema.conflicts },
      { name: 'overrides', model: schema.overrides },
      { name: 'audit_logs', model: schema.auditLogs },
      { name: 'fixed_assignment_patterns', model: schema.fixedAssignmentPatterns },
      { name: 'fixed_assignment_pattern_items', model: schema.fixedAssignmentPatternItems },
    ];

    let verifiedCount = 0;
    for (const t of tablesToCheck) {
      try {
        const rows = await db.select().from(t.model).limit(1);
        console.log(`✅ جدول [${t.name}]: موجود ويستجيب بنجاح لقراءة Drizzle ORM (Rows accessible)`);
        verifiedCount++;
      } catch (err: any) {
        console.error(`❌ جدول [${t.name}]: فشل استعلام Drizzle ORM - ${err.message}`);
      }
    }

    console.log(`\nنتيجة فحص الجداول: ${verifiedCount} من أصل ${tablesToCheck.length} جداول تم التحقق منها بنجاح.`);

    return {
      connected: true,
      tablesVerified: verifiedCount,
      totalTables: tablesToCheck.length,
      status: verifiedCount === tablesToCheck.length ? 'PASS' : 'SCHEMA_INCOMPATIBLE',
    };
  } catch (err: any) {
    console.error('\n❌ فشل الاتصال بقاعدة بيانات PostgreSQL:');
    console.error(err.message || err);
    return {
      connected: false,
      reason: err.message,
      tablesVerified: 0,
    };
  } finally {
    await pool.end().catch(() => {});
  }
}

verifyPhase1Database().then((res) => {
  if (!res.connected || res.status !== 'PASS') {
    process.exit(1);
  }
  process.exit(0);
});
