import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  console.log('--- Testing Role Creation and Switching ---');
  // Check if scheduler_app role already exists
  const roleCheck = await c.query("SELECT rolname FROM pg_roles WHERE rolname = 'scheduler_app'");
  if (roleCheck.rows.length === 0) {
    console.log('Creating role scheduler_app...');
    await c.query(`
      CREATE ROLE scheduler_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOLOGIN NOBYPASSRLS;
      GRANT scheduler_app TO postgres;
      GRANT USAGE ON SCHEMA public TO scheduler_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO scheduler_app;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO scheduler_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO scheduler_app;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO scheduler_app;
    `);
    console.log('Role scheduler_app created and granted.');
  } else {
    console.log('Role scheduler_app already exists.');
  }

  // Test transaction with role switch and GUC
  await c.query('BEGIN');
  await c.query("SELECT set_config('app.current_user_id', 'usr_admin_01', true)");
  await c.query("SELECT set_config('app.current_user_role', 'admin', true)");
  await c.query('SET LOCAL ROLE scheduler_app');

  const testRes = await c.query(`
    SELECT
      current_user,
      session_user,
      current_setting('app.current_user_id', true) as uid,
      current_setting('app.current_user_role', true) as role
  `);
  console.log('Inside Transaction:', testRes.rows[0]);

  await c.query('COMMIT');

  // Verify connection reverted to postgres and GUC is cleared
  const afterRes = await c.query(`
    SELECT
      current_user,
      session_user,
      current_setting('app.current_user_id', true) as uid,
      current_setting('app.current_user_role', true) as role
  `);
  console.log('After Commit (clean connection):', afterRes.rows[0]);

  await c.end();
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
