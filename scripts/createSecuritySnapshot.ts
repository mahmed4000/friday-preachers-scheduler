import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
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

  // 1. Roles
  const rolesRes = await c.query(`
    SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
    FROM pg_roles
    WHERE rolname NOT LIKE 'pg_%'
    ORDER BY rolname;
  `);

  // 2. Table RLS & Ownership
  const rlsRes = await c.query(`
    SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1)
    ORDER BY c.relname;
  `, [tables]);

  // 3. Policies
  const polRes = await c.query(`
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `);

  // 4. Grants on tables
  const grantsRes = await c.query(`
    SELECT grantee, table_schema, table_name, privilege_type, is_grantable
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = ANY($1)
    ORDER BY table_name, grantee, privilege_type;
  `, [tables]);

  // 5. Counts
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const r = await c.query(`SELECT count(*)::int as count FROM "${t}"`);
    counts[t] = r.rows[0].count;
  }

  await c.end();

  let md = `# لقطة الحالة الأمنية قبل تطبيق RLS (Phase 6B Pre-RLS Security Snapshot)
## PHASE 6B PRE-RLS SECURITY SNAPSHOT

**تاريخ الالتقاط:** 2026-10-06  
**محرك قاعدة البيانات:** PostgreSQL 17.11 on x86_64-pc-linux-gnu  
**قاعدة البيانات:** \`postgres\` (مستضافة على Supabase Cloud / Neon)  
**الغرض:** حفظ الحالة الأمنية والصلاحيات والسياسات السابقة بدقة لتمكين الاستعادة والرجوع (Rollback) في حال الحاجة.

---

## 1. أدوار قاعدة البيانات الحالية (PostgreSQL Roles & Attributes)

| الدور (Role) | SUPERUSER | INHERIT | CREATEROLE | CREATEDB | CANLOGIN | REPLICATION | BYPASSRLS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
`;

  for (const r of rolesRes.rows) {
    md += `| \`${r.rolname}\` | ${r.rolsuper} | ${r.rolinherit} | ${r.rolcreaterole} | ${r.rolcreatedb} | ${r.rolcanlogin} | ${r.rolreplication} | **${r.rolbypassrls}** |\n`;
  }

  md += `
---

## 2. ملكية الجداول وحالة RLS السابقة (Table Ownership & RLS State)

| الجدول (Table) | المالك (Owner) | RLS مفعل (\`relrowsecurity\`) | FORCE RLS مفعل (\`relforcerowsecurity\`) |
| :--- | :--- | :---: | :---: |
`;

  for (const r of rlsRes.rows) {
    md += `| \`${r.relname}\` | \`${r.owner}\` | ${r.relrowsecurity} | ${r.relforcerowsecurity} |\n`;
  }

  md += `
---

## 3. السياسات القائمة السابقة في قاعدة البيانات (\`pg_policies\`)

إجمالي السياسات المسجلة: **${polRes.rows.length} سياسات**.

| الجدول | اسم السياسة | Permissive | الأدوار | الأمر | شرط القراءة (\`qual\`) | شرط الفحص (\`with_check\`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
`;

  for (const p of polRes.rows) {
    md += `| \`${p.tablename}\` | \`${p.policyname}\` | \`${p.permissive}\` | \`${JSON.stringify(p.roles)}\` | \`${p.cmd}\` | \`${p.qual}\` | \`${p.with_check}\` |\n`;
  }

  md += `
---

## 4. أعداد سجلات الجداول الـ 11 (Physical Table Baseline Counts)

| الجدول (Table) | عدد السجلات الحالي |
| :--- | :---: |
`;

  let totalRecords = 0;
  for (const [t, cnt] of Object.entries(counts)) {
    totalRecords += cnt;
    md += `| \`${t}\` | ${cnt} |\n`;
  }
  md += `| **الإجمالي (Total)** | **${totalRecords}** |\n\n---\n\n## 5. الصلاحيات الممنوحة على الجداول (\`role_table_grants\` Sample)\n\n`;

  // Aggregate grants per table and grantee
  const grantMap: Record<string, Record<string, string[]>> = {};
  for (const g of grantsRes.rows) {
    if (!grantMap[g.table_name]) grantMap[g.table_name] = {};
    if (!grantMap[g.table_name][g.grantee]) grantMap[g.table_name][g.grantee] = [];
    grantMap[g.table_name][g.grantee].push(g.privilege_type);
  }

  for (const [tbl, grs] of Object.entries(grantMap)) {
    md += `### الجدول: \`${tbl}\`\n`;
    for (const [grantee, privs] of Object.entries(grs)) {
      md += `- الدور \`${grantee}\`: ${privs.join(', ')}\n`;
    }
    md += '\n';
  }

  fs.writeFileSync('PHASE_6B_PRE_RLS_SECURITY_SNAPSHOT.md', md, 'utf8');
  console.log('✅ Created PHASE_6B_PRE_RLS_SECURITY_SNAPSHOT.md');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
