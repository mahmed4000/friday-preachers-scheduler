# تقرير مواءمة مخطط Drizzle مع قاعدة بيانات PostgreSQL الحقيقية
# PHASE 1B — DRIZZLE SCHEMA ALIGNMENT FORENSIC REPORT

**تاريخ التنفيذ:** 6 أكتوبر 2026  
**المرحلة:** Phase 1B (مواءمة مخطط Drizzle بأمان دون أي مساس بقاعدة البيانات)  
**الحالة الرقابية:** `PASS` (تمت المواءمة واجتياز قراءة Drizzle لجميع الجداول الـ 11 بنسبة 100%)  
**حالة قاعدة البيانات:** `READ-ONLY / UNTOUCHED` (لم يتم تنفيذ أي عملية تعديل أو ترحيل أو حذف نهائياً).

---

## 1. مصدر الحقيقة المعتمد (Source of Truth)

1. **قاعدة بيانات PostgreSQL الإنتاجية الحقيقية:**
   - **الخادم والمستأجر:** مسبح Supabase (`aws-0-eu-west-1.pooler.supabase.com:6543/postgres`).
   - **المشروع السحابي:** `tctaqmtvypibxsaehawf`.
   - **المستخدم والإصدار:** `postgres` على `PostgreSQL 17.11 on x86_64-pc-linux-gnu`.
   - **البيانات الحية المؤكدة:**
     - 24 مسجداً (Mosques)
     - 108 خطباء (Imams)
     - 7 جداول شهرية (Monthly Schedules)
     - 813 تكليف خطبة (Assignments)
     - 4 قواعد توافق ومفاضلة (Mosque-Imam Rules)
     - 30 جمعة (Fridays)
2. **المخطط المرجعي المعتمد:**
   - [supabase_schema.sql](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/supabase_schema.sql): يطابق جداول وأعمدة قاعدة البيانات الحقيقية بنسبة 100%.

---

## 2. سجل المقارنة الجنائية وحصر الفروقات المكتشفة (Schema Divergence Matrix)

تم فحص الفهرس الداخلي لقاعدة البيانات (`information_schema.columns` و `pg_catalog`) ومقارنته بما كان معرفاً في [src/db/schema.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/schema.ts):

| الجدول (Table) | الأعمدة الحقيقية في PostgreSQL | الأعمدة الوهمية/المتباينة في `schema.ts` القديم | نوع الإجراء التصحيحي |
| :--- | :--- | :--- | :--- |
| **`organization_settings`** | 14 عموداً: `id, association_name, branch_name, calendar_provider, timezone, contact_phone, contact_email, website, address, formatted_address, default_distribution_method, auto_lock_fixed, created_at, updated_at` | كان يحتوي على `logo_url` الزائد | حُذف `logo_url` من تعريف Drizzle لمطابقة الجدول الحقيقي |
| **`mosques`** | 13 عموداً: `id, name, code, region, address, manager_name, phone, whatsapp, fixed_imam_id, is_active, notes, created_at, updated_at` | كان يحتوي على 14 حقلاً وهمياً: `country_id, governorate_id, district_id, area_id, street, building_number, landmark, formatted_address, legacy_address, needs_review, latitude, longitude, fixed_pattern, fixed_count` | أزيلت الحقول الوهمية بالكامل من استعلام Drizzle |
| **`imams`** | 13 عموداً: `id, name, phone, whatsapp, type, region, min_fridays, max_fridays, target_fridays, is_active, notes, created_at, updated_at` | كان يحتوي على 12 حقلاً وهمياً: `address, country_id, governorate_id, district_id, area_id, street, building_number, landmark, formatted_address, legacy_address, needs_review, latitude, longitude` | أزيلت الحقول الوهمية لمطابقة جدول الخطباء الحقيقي |
| **`mosque_imam_rules`** | 7 أعمدة: `id, mosque_id, imam_id, relationship_type, priority, notes, created_at` | مطابق للقاعدة بنسبة 100% | تم تثبيت التعريف والعلاقات |
| **`monthly_schedules`** | 15 عموداً: `id, hijri_year, hijri_month, month_name, calendar_provider, timezone, fridays_count, status, current_version, approved_by, approved_at, published_at, notes, created_at, updated_at` | كان يحتوي على 4 حقول وهمية: `days_count, start_date_gregorian, end_date_gregorian, created_by` | أزيلت الحقول الوهمية لتمكين استعلام Drizzle |
| **`fridays`** | 10 أعمدة: `id, schedule_id, friday_index, hijri_date, gregorian_date, gregorian_iso, period_status, is_past, notes, created_at` | كان يعرف أعمدة غير موجودة: `hijri_year, hijri_month, hijri_day, day_of_week` | تم تعديل الأعمدة لتطابق الأعمدة الحقيقية 100% |
| **`assignments`** | 10 أعمدة: `id, schedule_id, mosque_id, friday_index, imam_id, is_locked, source, notes, created_at, updated_at` | كان يحتوي على `friday_id` الزائد | أزيل `friday_id`؛ الربط الحقيقي هو `schedule_id + mosque_id + friday_index` |
| **`assignment_history`** | 8 أعمدة: `id, schedule_id, assignment_id, old_imam_id, new_imam_id, changed_by, reason, created_at` | كان يعرف `changed_at` بدلاً من `created_at` | صُحح اسم العمود إلى `created_at` |
| **`conflicts`** | 13 عموداً: `id, schedule_id, conflict_type, severity, description, mosque_id, imam_id, friday_index, status, resolved_by, resolved_at, resolution_notes, created_at` | كان يعرف `rule_code, message, possible_resolutions` | صُححت كافة أسماء الأعمدة لتطابق PostgreSQL الحقيقي |
| **`overrides`** | 11 عموداً: `id, schedule_id, assignment_id, imam_id, mosque_id, friday_index, old_value, new_value, reason, created_by, created_at` | مطابق للقاعدة بنسبة 100% | تم تثبيت التعريف والعلاقات |
| **`audit_logs`** | 8 أعمدة: `id, user_email, action, entity_type, entity_id, details (jsonb), ip_address, created_at` | كان يعرف `details_json` (تم تصحيحه سابقاً) | تم ضبط النوع كـ `jsonb` ومطابقته 100% |

---

## 3. التعديلات المنفذة في كود المخطط ([src/db/schema.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/schema.ts))

1. تمت إعادة كتابة تعريف الجداول الـ 11 الحقيقية لتطابق مخطط PostgreSQL الحقيقي حرفياً.
2. تم الحفاظ على أسماء الأعمدة والأنواع الدقيقة (`text`, `integer`, `boolean`, `timestamptz`, `jsonb`).
3. تم الحفاظ على علاقات Drizzle Relations بين الجداول الـ 11 الحقيقية.
4. تم عزل الجداول الثانوية غير الموجودة في قاعدة البيانات الحالية (`countries`, `administrative_units`, `addresses`, `users`, `fixed_assignment_patterns`, `fixed_assignment_pattern_items`, `imam_availabilities`, `schedule_versions`, `distribution_logs`, `import_export_logs`, `import_snapshots`) ككيانات افتراضية لتفادي كسر استيرادات الموديولات القائمة.

---

## 4. حصر تأثير التغييرات على شيفرة التطبيق (Application Callers Impact Analysis)

أظهر البحث الشامل في المستودع أن الشيفرة البرمجية في بعض مسارات [src/server/api.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/api.ts) و [src/db/seed.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/seed.ts) كانت تعتمد على الحقول الوهمية التي لم تكن موجودة أساساً في قاعدة البيانات:

1. **حقول المساجد الجغرافية (`countryId`, `governorateId`, `districtId`, `areaId`):**
   - تُستخدم في مسار الاستيراد والتصدير المتقدم بمستوى التطبيق، بينما في قاعدة البيانات يتم تخزين العنوان كنص حر `address`.
2. **حقل نمط التثبيت (`fixedPattern`):**
   - في قاعدة البيانات الحقيقية يتم تثبيت الخطيب عبر المعرف المباشر `fixed_imam_id` (إذا وُجد فهو ثابت لكافة الجمعات).
3. **حقل معرف الجمعة في التكليفات (`fridayId`):**
   - التكليف في قاعدة البيانات يرتبط بـ `schedule_id` و `friday_index` وليس بمفتاح أجنبي مباشر لجمعة مستقلة.
4. **حقل شعار المؤسسة (`logoUrl`):**
   - جدول `organization_settings` في قاعدة البيانات لا يحتوي على عمود الشعار؛ الشعار يُدار عبر الذاكرة الافتراضية [defaultLogo.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/lib/defaultLogo.ts).

---

## 5. نتائج الفحص التشغيلي الحقيقي (Execution Evidence)

### 5.1. فحص قراءة Drizzle لجميع الجداول الـ 11
أمر التشغيل:
```bash
npx tsx scripts/verifyPhase1Database.ts
```
**النتيجة:**
- ✅ جدول `organization_settings`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `mosques`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `imams`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `mosque_imam_rules`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `monthly_schedules`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `fridays`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `assignments`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `assignment_history`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `conflicts`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `overrides`: تم التحقق وقراءة الأسطر بنجاح.
- ✅ جدول `audit_logs`: تم التحقق وقراءة الأسطر بنجاح.
**النتيجة الإجمالية:** `11 من أصل 11 جداول تم التحقق منها بنجاح` (رمز الخروج: 0).

### 5.2. التحقق من أعداد السجلات الإنتاجية الحقيقية عبر Drizzle
أمر التشغيل:
```bash
npx tsx scripts/verifyDrizzleCounts.ts
```
**النتيجة:**
- **المساجد (mosques count):** 24 مسجداً
- **الخطباء (imams count):** 108 خطباء
- **الجداول الشهرية (monthly_schedules count):** 7 جداول
- **التكليفات والخطب (assignments count):** 813 تكليفاً
- **قواعد التوافق (mosque_imam_rules count):** 4 قواعد
- **الجمعات (fridays count):** 30 جمعة

---

## 6. فحص الأنواع الصارم (TypeScript Typecheck Assessment)

أمر التشغيل:
```bash
npx tsc --noEmit
```
**النتيجة:** إجمالي 127 خطأ تصنيفي مصنفة كالآتي:
- **الصنف A (أخطاء خاصة بالمخطط schema-only errors):** **0 أخطاء** (ملف `src/db/schema.ts` نظيف بنسبة 100%).
- **الصنف B (تعارض تعاقد الشيفرة مع المخطط الحقيقي app-code/schema contract errors):** **81 خطأ** (في `src/server/api.ts` و `src/db/seed.ts` نتيجة محاولة قراءة أو إسناد حقول وهمية مثل `governorateId`, `fixedPattern`, `fridayId`, `logoUrl` التي لم توجد أصلاً في قاعدة البيانات).
- **الصنف C (أخطاء سابقة غير متعلقة بالمخطط unrelated pre-existing errors):** **46 خطأ** (في استدعاءات الواجهات وأنواع الاستجابات المتباينة).

*عملاً بالتعليمات الصارمة، لم يتم إجراء ترقيع عشوائي لشيفرة التطبيق في هذه المرحلة، وتم حصر وتوثيق هذه التعارضات تمهيداً لمعالجتها المنضبطة في المراحل المعتمدة.*

---

## 7. القرار الرقابي النهائي للمرحلة 1B

### ✅ **PHASE 1B RESULT: PASS**

- تم إثبات مطابقة مخطط Drizzle مع قاعدة بيانات PostgreSQL بنسبة 100%.
- تم التحقق من قراءة جميع الجداول الـ 11 بنجاح عبر محرك Drizzle دون السقوط في `memoryStore`.
- تم استرجاع كافة الإحصائيات الحقيقية للإنتاج بدقة تامة.
- لم يتم إجراء أي تعديل أو مساس بقاعدة البيانات الحقيقية.
- يتوقف النظام فوراً بانتظار الاعتماد الرسمي للانتقال إلى المرحلة التالية.
