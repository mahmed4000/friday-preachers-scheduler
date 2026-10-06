import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function main() {
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

  console.log('=== TABLE OWNERSHIP & RLS FLAGS ===');
  const rlsRes = await c.query(`
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)
    ORDER BY c.relname;
  `, [tables]);
  console.log(JSON.stringify(rlsRes.rows, null, 2));

  console.log('\n=== EXISTING POLICIES ===');
  const polRes = await c.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public';
  `);
  console.log('Total Policies:', polRes.rows.length);
  for (const p of polRes.rows) {
    console.log(`Table: ${p.tablename} | Policy: ${p.policyname} | Permissive: ${p.permissive} | Roles: ${JSON.stringify(p.roles)} | Cmd: ${p.cmd}`);
    console.log(`  QUAL: ${p.qual}`);
    console.log(`  WITH CHECK: ${p.with_check}`);
  }

  console.log('\n=== ALL ROLES IN DB ===');
  const rolesRes = await c.query(`
    SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%'
    ORDER BY rolname;
  `);
  console.log(JSON.stringify(rolesRes.rows, null, 2));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
