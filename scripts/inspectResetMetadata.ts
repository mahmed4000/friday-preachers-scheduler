import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function inspect() {
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

  console.log('--- 1. CURRENT ROW COUNTS ---');
  for (const t of tables) {
    const res = await c.query(`SELECT count(*)::int as count FROM "${t}"`);
    console.log(`${t}: ${res.rows[0].count}`);
  }

  console.log('\n--- 2. FOREIGN KEYS ---');
  const fkRes = await c.query(`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      AND tc.table_name = ANY($1)
    ORDER BY tc.table_name;
  `, [tables]);
  for (const r of fkRes.rows) {
    console.log(`${r.table_name}.${r.column_name} -> ${r.foreign_table_name}.${r.foreign_column_name}`);
  }

  console.log('\n--- 4. ALL PUBLIC TABLES ---');
  const allTablesRes = await c.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('All public tables:', allTablesRes.rows.map(r => r.table_name).join(', '));

  console.log('\n--- 5. EXTERNAL REFERENCES ---');
  const extFkRes = await c.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      AND ccu.table_name = ANY(ARRAY['mosques', 'imams', 'monthly_schedules', 'assignments'])
      AND tc.table_name != ALL($1);
  `, [tables]);
  console.log('Foreign keys from external tables:', extFkRes.rows);

  await c.end();
}

inspect().catch(err => {
  console.error('Inspect error:', err);
  process.exit(1);
});
