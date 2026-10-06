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

  console.log('=== PRIMARY KEYS ===');
  const pkRes = await c.query(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = ANY($1)
    ORDER BY tc.table_name;
  `, [tables]);
  console.log(JSON.stringify(pkRes.rows, null, 2));

  console.log('\n=== FOREIGN KEYS ===');
  const fkRes = await c.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.update_rule,
      rc.delete_rule,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON rc.unique_constraint_name = ccu.constraint_name AND rc.constraint_schema = ccu.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' AND tc.table_name = ANY($1)
    ORDER BY tc.table_name, kcu.column_name;
  `, [tables]);
  console.log(JSON.stringify(fkRes.rows, null, 2));

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
