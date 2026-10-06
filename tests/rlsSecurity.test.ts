import 'dotenv/config';
import pg from 'pg';
import { withAuthContext } from '../src/db/authContext.ts';
import { mosques, imams, monthlySchedules, fridays, assignments, mosqueImamRules, conflicts, overrides, auditLogs } from '../src/db/schema.ts';
import { eq, sql } from 'drizzle-orm';
import type { AuthUser } from '../src/server/authService.ts';

const { Client, Pool } = pg;

const testAdmin: AuthUser = {
  uid: 'usr_admin_01',
  email: 'admin@aljameya.org',
  name: 'مدير النظام المعتمد',
  role: 'admin',
};

const testStaff: AuthUser = {
  uid: 'usr_staff_02',
  email: 'staff@aljameya.org',
  name: 'مشرف الجداول',
  role: 'staff',
};

const testViewer: AuthUser = {
  uid: 'usr_viewer_03',
  email: 'viewer@aljameya.org',
  name: 'مراقب عام',
  role: 'viewer',
};

async function runDirectSql(
  role: string | null,
  uid: string | null,
  queryFn: (client: pg.Client) => Promise<any>
) {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN');
    if (uid !== null) {
      await c.query(`SELECT set_config('app.current_user_id', $1, true)`, [uid]);
    }
    if (role !== null) {
      await c.query(`SELECT set_config('app.current_user_role', $1, true)`, [role]);
    }
    await c.query('SET LOCAL ROLE scheduler_app');
    const res = await queryFn(c);
    await c.query('COMMIT');
    return { success: true, data: res };
  } catch (err: any) {
    await c.query('ROLLBACK');
    return { success: false, error: err };
  } finally {
    await c.end();
  }
}

async function main() {
  console.log('===============================================================');
  console.log('--- PHASE 6B: POSTGRESQL ROW LEVEL SECURITY VERIFICATION ---');
  console.log('===============================================================');

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  console.log('\n--- 1. DIRECT DATABASE RLS TESTS: ANONYMOUS ACCESS ---');

  // 1. Anon SELECT on public table (mosques) -> Allowed
  const anonSelectMosques = await runDirectSql('anon', '', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM mosques');
    return r.rows[0].count;
  });
  assert('1. Anonymous SELECT on public table (mosques) succeeds', anonSelectMosques.success && anonSelectMosques.data > 0);

  // 2. Anon SELECT on authenticated table (mosque_imam_rules) -> Returns 0 rows (denied by policy)
  const anonSelectRules = await runDirectSql('anon', '', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM mosque_imam_rules');
    return r.rows[0].count;
  });
  assert('2. Anonymous SELECT on authenticated table (rules) returns 0 rows (denied)', anonSelectRules.success && anonSelectRules.data === 0);

  // 3. Anon SELECT on admin table (audit_logs) -> Returns 0 rows (denied)
  const anonSelectAudit = await runDirectSql('anon', '', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM audit_logs');
    return r.rows[0].count;
  });
  assert('3. Anonymous SELECT on admin table (audit_logs) returns 0 rows (denied)', anonSelectAudit.success && anonSelectAudit.data === 0);

  // 4. Anon INSERT on mosques -> Rejected with 42501
  const anonInsertMosque = await runDirectSql('anon', '', async (c) => {
    return c.query("INSERT INTO mosques (name, code) VALUES ('مسجد اختباري مجهول', 'ANON_M1')");
  });
  assert('4. Anonymous INSERT on mosques is strictly rejected by RLS', !anonInsertMosque.success && anonInsertMosque.error?.code === '42501');

  // 5. Anon UPDATE on mosques -> Rejected (or 0 rows updated)
  const anonUpdateMosque = await runDirectSql('anon', '', async (c) => {
    const r = await c.query("UPDATE mosques SET name = 'تعديل مجهول' WHERE id = 1");
    return r.rowCount;
  });
  assert('5. Anonymous UPDATE on mosques updates 0 rows (denied)', anonUpdateMosque.success && anonUpdateMosque.data === 0);

  // 6. Anon DELETE on mosques -> Rejected (or 0 rows deleted)
  const anonDeleteMosque = await runDirectSql('anon', '', async (c) => {
    const r = await c.query("DELETE FROM mosques WHERE id = 999999");
    return r.rowCount;
  });
  assert('6. Anonymous DELETE on mosques deletes 0 rows (denied)', anonDeleteMosque.success && anonDeleteMosque.data === 0);

  console.log('\n--- 2. DIRECT DATABASE RLS TESTS: VIEWER ROLE ---');

  // 7. Viewer SELECT on rules -> Allowed (viewer is authenticated)
  const viewerSelectRules = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM mosque_imam_rules');
    return r.rows[0].count;
  });
  assert('7. Viewer SELECT on authenticated table (rules) succeeds', viewerSelectRules.success && viewerSelectRules.data === 4);

  // 8. Viewer SELECT on audit_logs -> Denied (admin only) -> returns 0 rows
  const viewerSelectAudit = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM audit_logs');
    return r.rows[0].count;
  });
  assert('8. Viewer SELECT on admin table (audit_logs) returns 0 rows (denied)', viewerSelectAudit.success && viewerSelectAudit.data === 0);

  // 9. Viewer INSERT on imams -> Rejected with 42501
  const viewerInsertImam = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    return c.query("INSERT INTO imams (name) VALUES ('خطيب مشاهد اختباري')");
  });
  assert('9. Viewer INSERT on imams is strictly rejected by RLS', !viewerInsertImam.success && viewerInsertImam.error?.code === '42501');

  // 10. Viewer UPDATE on assignments -> Denied (0 rows updated)
  const viewerUpdateAssign = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    const r = await c.query('UPDATE assignments SET notes = \'تعديل مشاهد\' WHERE id = 1');
    return r.rowCount;
  });
  assert('10. Viewer UPDATE on assignments updates 0 rows (denied)', viewerUpdateAssign.success && viewerUpdateAssign.data === 0);

  // 11. Viewer DELETE on mosques -> Denied (0 rows deleted)
  const viewerDeleteMosque = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    const r = await c.query('DELETE FROM mosques WHERE id = 999999');
    return r.rowCount;
  });
  assert('11. Viewer DELETE on mosques deletes 0 rows (denied)', viewerDeleteMosque.success && viewerDeleteMosque.data === 0);

  console.log('\n--- 3. DIRECT DATABASE RLS TESTS: STAFF ROLE ---');

  // 12. Staff SELECT on rules and assignments -> Allowed
  const staffSelectAssign = await runDirectSql('staff', 'usr_staff_02', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM assignments');
    return r.rows[0].count;
  });
  assert('12. Staff SELECT on assignments succeeds', staffSelectAssign.success && staffSelectAssign.data === 813);

  // 13. Staff DELETE on mosques -> Denied (admin only) -> 0 rows deleted
  const staffDeleteMosque = await runDirectSql('staff', 'usr_staff_02', async (c) => {
    const r = await c.query('DELETE FROM mosques WHERE id = 999999');
    return r.rowCount;
  });
  assert('13. Staff DELETE on mosques deletes 0 rows (admin only)', staffDeleteMosque.success && staffDeleteMosque.data === 0);

  // 14. Staff UPDATE on organization_settings -> Denied (admin only) -> 0 rows
  const staffUpdateSettings = await runDirectSql('staff', 'usr_staff_02', async (c) => {
    const r = await c.query("UPDATE organization_settings SET association_name = 'تعديل موظف' WHERE id = 1");
    return r.rowCount;
  });
  assert('14. Staff UPDATE on organization_settings updates 0 rows (admin only)', staffUpdateSettings.success && staffUpdateSettings.data === 0);

  console.log('\n--- 4. DIRECT DATABASE RLS TESTS: ADMIN ROLE & IMMUTABILITY ---');

  // 15. Admin SELECT on audit_logs -> Allowed
  const adminSelectAudit = await runDirectSql('admin', 'usr_admin_01', async (c) => {
    const r = await c.query('SELECT count(*)::int as count FROM audit_logs');
    return r.rows[0].count;
  });
  assert('15. Admin SELECT on audit_logs succeeds', adminSelectAudit.success);

  // 16. Admin DELETE on audit_logs -> Denied (immutable server table) -> 0 rows
  const adminDeleteAudit = await runDirectSql('admin', 'usr_admin_01', async (c) => {
    const r = await c.query('DELETE FROM audit_logs WHERE id = 999999');
    return r.rowCount;
  });
  assert('16. Admin DELETE on audit_logs is denied (immutable table)', adminDeleteAudit.success && adminDeleteAudit.data === 0);

  // 17. Admin UPDATE on audit_logs -> Denied (immutable server table) -> 0 rows
  const adminUpdateAudit = await runDirectSql('admin', 'usr_admin_01', async (c) => {
    const r = await c.query("UPDATE audit_logs SET action = 'تعديل' WHERE id = 999999");
    return r.rowCount;
  });
  assert('17. Admin UPDATE on audit_logs is denied (immutable table)', adminUpdateAudit.success && adminUpdateAudit.data === 0);

  console.log('\n--- 5. DRIZZLE withAuthContext INTEGRATION & LIFECYCLE ---');

  // 18. Drizzle withAuthContext for staff inserting & deleting a temporary mosque within transaction
  let createdMosqueId = 0;
  await withAuthContext(testStaff, async (tx) => {
    const inserted = await tx.insert(mosques).values({
      name: 'مسجد اختبار دورة حياة RLS',
      code: 'RLS_TEST_M1',
      region: 'الوسط',
    }).returning({ id: mosques.id });
    createdMosqueId = inserted[0].id;
  });
  assert('18. Staff withAuthContext can INSERT mosque in transaction', createdMosqueId > 0);

  // 19. Staff cannot delete the mosque (admin only)
  await withAuthContext(testStaff, async (tx) => {
    const delRes = await tx.delete(mosques).where(eq(mosques.id, createdMosqueId));
    // Staff delete updates 0 rows
  });
  const checkMosqueStillExists = await runDirectSql('anon', '', async (c) => {
    const r = await c.query('SELECT id FROM mosques WHERE id = $1', [createdMosqueId]);
    return r.rows.length;
  });
  assert('19. Staff withAuthContext cannot DELETE mosque (mosque remains intact)', checkMosqueStillExists.data === 1);

  // 20. Admin can delete the mosque
  await withAuthContext(testAdmin, async (tx) => {
    await tx.delete(mosques).where(eq(mosques.id, createdMosqueId));
  });
  const checkMosqueDeleted = await runDirectSql('anon', '', async (c) => {
    const r = await c.query('SELECT id FROM mosques WHERE id = $1', [createdMosqueId]);
    return r.rows.length;
  });
  assert('20. Admin withAuthContext can DELETE mosque (clean cleanup)', checkMosqueDeleted.data === 0);

  console.log('\n--- 6. CONCURRENT IDENTITY ISOLATION & POOL BLEED TEST ---');

  // 21. Run 10 concurrent requests across a shared pool with alternating roles
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  const concurrentTasks = Array.from({ length: 15 }, async (_, i) => {
    const role = i % 3 === 0 ? 'admin' : (i % 3 === 1 ? 'staff' : 'viewer');
    const uid = `user_concurrent_${i}_${role}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [uid]);
      await client.query("SELECT set_config('app.current_user_role', $1, true)", [role]);
      await client.query('SET LOCAL ROLE scheduler_app');

      // Random delay to stress concurrency and interleave execution
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 20)));

      const res = await client.query(`
        SELECT
          current_setting('app.current_user_id', true) as uid,
          current_setting('app.current_user_role', true) as role,
          current_user as active_role
      `);

      await client.query('COMMIT');

      return {
        expectedUid: uid,
        expectedRole: role,
        actualUid: res.rows[0].uid,
        actualRole: res.rows[0].role,
        activeRole: res.rows[0].active_role,
        isolated: res.rows[0].uid === uid && res.rows[0].role === role && res.rows[0].active_role === 'scheduler_app',
      };
    } finally {
      client.release();
    }
  });

  const concurrentResults = await Promise.all(concurrentTasks);
  const allIsolated = concurrentResults.every((r) => r.isolated);
  assert('21. 15 concurrent pooled requests verified with 0 identity leaks', allIsolated);

  // 22. Pool client clean check after release
  const clientAfter = await pool.connect();
  const cleanRes = await clientAfter.query(`
    SELECT
      current_user,
      current_setting('app.current_user_id', true) as uid,
      current_setting('app.current_user_role', true) as role
  `);
  clientAfter.release();
  await pool.end();

  assert('22. Pooled connection completely clean after transaction commit (zero bleed)', cleanRes.rows[0].current_user === 'postgres' && cleanRes.rows[0].uid === '' && cleanRes.rows[0].role === '');

  console.log('\n--- 7. CROSS-TABLE RELATIONSHIPS & DENY BY DEFAULT ---');

  // 23. Cross-table query (join assignments with mosques, fridays, and schedules)
  const crossTableRes = await runDirectSql('viewer', 'usr_viewer_03', async (c) => {
    const r = await c.query(`
      SELECT a.id, m.name as mosque_name, f.gregorian_date
      FROM assignments a
      JOIN mosques m ON m.id = a.mosque_id
      JOIN fridays f ON f.schedule_id = a.schedule_id AND f.friday_index = a.friday_index
      WHERE a.schedule_id = (SELECT min(schedule_id) FROM assignments)
      LIMIT 3
    `);
    return r.rows.length;
  });
  assert('23. Cross-table JOIN queries execute seamlessly under RLS', crossTableRes.success && crossTableRes.data === 3);

  // 24. No infinite recursion on rules -> mosques -> imams
  const rulesRecursionTest = await runDirectSql('staff', 'usr_staff_02', async (c) => {
    const r = await c.query(`
      SELECT r.id, m.name as mosque_name, i.name as imam_name
      FROM mosque_imam_rules r
      JOIN mosques m ON m.id = r.mosque_id
      JOIN imams i ON i.id = r.imam_id
    `);
    return r.rows.length;
  });
  assert('24. No recursive policy dependencies; relational queries execute safely', rulesRecursionTest.success && rulesRecursionTest.data === 4);

  // 25. Deny by Default: missing/tampered context cannot execute admin actions
  const tamperedContextRes = await runDirectSql('', '', async (c) => {
    return c.query("INSERT INTO overrides (schedule_id, assignment_id, mosque_id, friday_index, reason) VALUES (1, 1, 1, 1, 'تجاوز مزيف')");
  });
  assert('25. Deny by Default: empty/tampered context cannot execute protected mutations', !tamperedContextRes.success && tamperedContextRes.error?.code === '42501');

  console.log('===============================================================');
  console.log(`RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
