# لقطة الحالة الأمنية قبل تطبيق RLS (Phase 6B Pre-RLS Security Snapshot)
## PHASE 6B PRE-RLS SECURITY SNAPSHOT

**تاريخ الالتقاط:** 2026-10-06  
**محرك قاعدة البيانات:** PostgreSQL 17.11 on x86_64-pc-linux-gnu  
**قاعدة البيانات:** `postgres` (مستضافة على Supabase Cloud / Neon)  
**الغرض:** حفظ الحالة الأمنية والصلاحيات والسياسات السابقة بدقة لتمكين الاستعادة والرجوع (Rollback) في حال الحاجة.

---

## 1. أدوار قاعدة البيانات الحالية (PostgreSQL Roles & Attributes)

| الدور (Role) | SUPERUSER | INHERIT | CREATEROLE | CREATEDB | CANLOGIN | REPLICATION | BYPASSRLS |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `anon` | false | true | false | false | false | false | **false** |
| `authenticated` | false | true | false | false | false | false | **false** |
| `authenticator` | false | false | false | false | true | false | **false** |
| `dashboard_user` | false | true | true | true | false | true | **false** |
| `postgres` | false | true | true | true | true | true | **true** |
| `service_role` | false | true | false | false | false | false | **true** |
| `supabase_admin` | true | true | true | true | true | true | **true** |
| `supabase_auth_admin` | false | false | true | false | true | false | **false** |
| `supabase_etl_admin` | false | true | false | false | true | true | **true** |
| `supabase_privileged_role` | false | true | false | false | false | false | **false** |
| `supabase_read_only_user` | false | true | false | false | true | false | **true** |
| `supabase_realtime_admin` | false | false | false | false | false | false | **false** |
| `supabase_replication_admin` | false | true | false | false | true | true | **false** |
| `supabase_storage_admin` | false | false | true | false | true | false | **false** |

---

## 2. ملكية الجداول وحالة RLS السابقة (Table Ownership & RLS State)

| الجدول (Table) | المالك (Owner) | RLS مفعل (`relrowsecurity`) | FORCE RLS مفعل (`relforcerowsecurity`) |
| :--- | :--- | :---: | :---: |
| `assignment_history` | `postgres` | true | false |
| `assignments` | `postgres` | true | false |
| `audit_logs` | `postgres` | true | false |
| `conflicts` | `postgres` | true | false |
| `fridays` | `postgres` | true | false |
| `imams` | `postgres` | true | false |
| `monthly_schedules` | `postgres` | true | false |
| `mosque_imam_rules` | `postgres` | true | false |
| `mosques` | `postgres` | true | false |
| `organization_settings` | `postgres` | true | false |
| `overrides` | `postgres` | true | false |

---

## 3. السياسات القائمة السابقة في قاعدة البيانات (`pg_policies`)

إجمالي السياسات المسجلة: **11 سياسات**.

| الجدول | اسم السياسة | Permissive | الأدوار | الأمر | شرط القراءة (`qual`) | شرط الفحص (`with_check`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `assignment_history` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `assignments` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `audit_logs` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `conflicts` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `fridays` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `imams` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `monthly_schedules` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `mosque_imam_rules` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `mosques` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `organization_settings` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |
| `overrides` | `Allow scheduler access` | `PERMISSIVE` | `"{public}"` | `ALL` | `true` | `true` |

---

## 4. أعداد سجلات الجداول الـ 11 (Physical Table Baseline Counts)

| الجدول (Table) | عدد السجلات الحالي |
| :--- | :---: |
| `organization_settings` | 0 |
| `mosques` | 24 |
| `imams` | 108 |
| `mosque_imam_rules` | 4 |
| `monthly_schedules` | 7 |
| `fridays` | 30 |
| `assignments` | 813 |
| `assignment_history` | 0 |
| `conflicts` | 0 |
| `overrides` | 0 |
| `audit_logs` | 0 |
| **الإجمالي (Total)** | **986** |

---

## 5. الصلاحيات الممنوحة على الجداول (`role_table_grants` Sample)

### الجدول: `assignment_history`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `assignments`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `audit_logs`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `conflicts`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `fridays`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `imams`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `monthly_schedules`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `mosque_imam_rules`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `mosques`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `organization_settings`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

### الجدول: `overrides`
- الدور `anon`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `authenticated`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `postgres`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
- الدور `service_role`: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE

