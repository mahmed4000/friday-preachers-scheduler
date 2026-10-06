import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const tables = [
    'organization_settings', 'mosques', 'imams', 'mosque_imam_rules',
    'monthly_schedules', 'fridays', 'assignments', 'assignment_history',
    'conflicts', 'overrides', 'audit_logs'
  ];

  for (const t of tables) {
    const res = await c.query(
      "SELECT column_name, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
      [t]
    );
    console.log(`\n### TABLE: ${t}`);
    for (const r of res.rows) {
      console.log(`- ${r.column_name}: ${r.data_type} (${r.udt_name}) | nullable: ${r.is_nullable} | default: ${r.column_default}`);
    }
  }

  await c.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
