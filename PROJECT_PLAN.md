# خطة مشروع: منظّم الجمعة — Friday Preachers Scheduler

نظام متكامل لإدارة وتنظيم وتوزيع جداول خطباء الجمعة للجمعية الشرعية على مستوى مدينة، مبني بنهج SaaS مؤسسي حديث، عربي بالكامل (RTL First).

---

## 1. بنية النظام (System Architecture)

### 1.1 الطبقات (Layers)
1. **Frontend (الواجهة)**:
   - React 19 + TypeScript + Vite
   - Tailwind CSS v4 مع نظام تصميم مؤسسي رصين (Design System)
   - توجيه RTL أصيل مع خط `Tajawal` للعناوين والنصوص العربية و`tabular-nums` للجداول
   - Lucide React للأيقونات الوظيفية حصراً

2. **Backend (الخادم والخدمات)**:
   - خادم Express متكامل مع معالجة آمنة لجلسات العمل والتحقق
   - Endpoints موحدة تحت `/api/*` لإدارة المساجد، الخطباء، القواعد، الجداول، والتعيينات
   - طبقة وصول بيانات معزولة عبر Drizzle ORM مع Connection Pool للـ PostgreSQL
   - محرك جدولة مستقل تماماً (Standalone Scheduling Engine) يمكن تشغيله على الخادم وفي الاختبارات

3. **Database (قاعدة البيانات)**:
   - Google Cloud SQL (PostgreSQL) Developer Edition
   - مخطط بيانات مهيكل (Normalized Relational Schema)
   - دعم كامل للـ Foreign Keys وفهارس البحث والقيود (Constraints)

4. **Security & Identity (الهوية والأمان)**:
   - Firebase Authentication مدمج مع Google Sign-In
   - التحقق من التوكنات (Bearer ID Token) عبر `firebase-admin`
   - تسجيل عمليات المراجعة (Audit Log) مع هوية المستخدم والطابع الزمني

---

## 2. كيانات قاعدة البيانات (Database Entities)

1. `users`: المستخدمين الإداريين (uid, email, name, role, created_at)
2. `mosques`: المساجد في المدينة (id, name, code, region, address, manager_name, phone, whatsapp, is_active, fixed_imam_id, fixed_pattern, fixed_count, notes)
3. `imams`: الخطباء والدعاة (id, name, type [FIXED, PARTIAL_FIXED, FLEXIBLE], min_fridays, target_fridays, max_fridays, phone, whatsapp, region, is_active, notes)
4. `mosque_imam_rules`: العلاقات والتفضيلات بين المسجد والخطيب (id, mosque_id, imam_id, relationship_type [FIXED, PREFERRED, ALLOWED, DISCOURAGED, FORBIDDEN], priority [1..N], notes)
5. `imam_availabilities`: استثناءات عدم التوفر (id, imam_id, hijri_year, hijri_month, friday_index [1..5], is_available, reason)
6. `monthly_schedules`: السجل الشهري للجداول (id, hijri_year, hijri_month, name, fridays_count, status [DRAFT, GENERATED, REVIEW, APPROVED, PUBLISHED, MODIFIED, NEEDS_REAPPROVAL], current_version, created_by, approved_by, approved_at)
7. `fridays`: جمعات الشهر (id, schedule_id, friday_index, hijri_date, gregorian_date)
8. `assignments`: تعيينات الخطباء في المساجد لكل جمعة (id, schedule_id, friday_id, friday_index, mosque_id, imam_id, source [FIXED, PREFERENCE, BALANCED, RANDOM, BALANCED_RANDOM, MANUAL, OVERRIDE], is_locked, notes)
9. `conflicts`: سجل التعارضات المكتشفة (id, schedule_id, severity [CRITICAL, WARNING, INFO], mosque_id, friday_index, imam_id, rule_code, message, possible_resolutions)
10. `overrides`: سجل الاستثناءات والتجاوزات الإدارية (id, schedule_id, assignment_id, imam_id, mosque_id, friday_index, old_value, new_value, reason, created_by, created_at)
11. `assignment_history`: الأرشيف التاريخي للتعديلات اليدوية (id, schedule_id, assignment_id, old_imam_id, new_imam_id, changed_by, changed_at, reason)
12. `schedule_versions`: إصدارات الجداول للاعتماد والنشر (id, schedule_id, version_number, snapshot_json, note, created_at)
13. `message_templates`: قوالب رسائل الواتساب للخطباء والمساجد
14. `distribution_logs`: سجل إرسال الجداول للمستلمين (id, schedule_id, recipient_type, recipient_id, recipient_name, phone, status [READY, SENT, FAILED, MISSING_PHONE], sent_at, error_message)
15. `audit_logs`: سجل العمليات الشامل (id, user_email, action, entity_type, entity_id, details_json, created_at)

---

## 3. محرك الجدولة وتوزيع الخطباء (Scheduling Engine)

### 3.1 أولويات الخوارزمية (Scheduling Priorities)
- **الأولوية 1 (Hard Constraints - قيود صارمة لا يمكن كسرها)**:
  - عدم توفر الخطيب في جمعة محددة (`imam_availabilities`).
  - الخطباء الممنوعون لمسجد معين (`FORBIDDEN`).
  - عدم تكرار نفس الخطيب في أكثر من مسجد في نفس الجمعة.
  - عدم ترك أي مسجد بدون خطيب.
  - الالتزام بنمط الخطيب الثابت التام.
  - عدم تجاوز الحد الأقصى الصارم للخطيب (`max_fridays`) دون استثناء إداري صريح.

- **الأولوية 2 (Fixed Assignments - الثوابت)**:
  - تطبيق الأنماط: `ALL` (كافة جمعات الشهر)، `FIRST_N` (أول N جمعات)، `LAST_N` (آخر N جمعات)، `SPECIFIC_FRIDAYS`، و`ANY_N`.

- **الأولوية 3 (Target / Minimum / Maximum)**:
  - استهداف `target_fridays` لكل خطيب، والوفاء بالحد الأدنى `min_fridays`.

- **الأولوية 4 (Mosque Preferences - تفضيلات المسجد)**:
  - احترام أولويات الخطباء المفضلين مرتبة بالأولية (1, 2, 3...) مع دعم استبعاد غير المرغوب فيهم (`DISCOURAGED`).

- **الأولوية 5 (Balance - عدالة التوزيع)**:
  - توزيع الأحمال التراكمية وتجنب إرهاق خطباء وتهميش آخرين.

- **الأولوية 6 (Balanced Randomness)**:
  - كسر التعادل عشوائياً بشكل متوازن مع دعم Seed قابل لإعادة الإنتاج (`Ramadan-1448-V1`).

### 3.2 توثيق مصدر التعيين (Assignment Source Tracking)
لكل تعيين حقل مصدر واضح: `FIXED`, `PREFERENCE`, `BALANCED`, `BALANCED_RANDOM`, `MANUAL`, `OVERRIDE`.

---

## 4. مسار المستخدم والواجهات (User Flows & UI Architecture)

1. **Dashboard (لوحة القيادة)**:
   - كارت الجدول الحالي للشهر المعتمد + كارت الشهر القادم غير المنشأ
   - مقاييس رئيسية: عدد المساجد، الخطباء، التعيينات، التعارضات الجارية
   - اختصارات سريعة للبدء والإنشاء

2. **Mosques Module (إدارة المساجد)**:
   - قائمة بحث، تصفية، وترتيب، مع إضافة وتعديل واستيراد Excel
   - بروفايل المسجد: البيانات الأساسية، الخطيب الثابت ونمطه، ترتيب التفضيلات Drag & Drop، المسموح، غير المرغوب، الممنوع

3. **Imams Module (إدارة الخطباء)**:
   - قائمة شاملة ببيانات الخطباء وحدودهم (Min, Target, Max) ونوعهم والحالة
   - بروفايل الخطيب: البيانات الأساسية، استثناءات عدم التوفر بالجمعات، والمساجد المرتبطة

4. **Schedule Wizard (معالج إنشاء الجدول)**:
   - الخطوة 1: اختيار الشهر والسنة الهجرية وحساب عدد الجمعات وتواريخها (4 أو 5 جمعات)
   - الخطوة 2: فحص الجاهزية (Health Check) وتصنيف التحذيرات إلى Blocking و Warnings
   - الخطوة 3: استعراض وتأكيد التعيينات الثابتة
   - الخطوة 4: التوزيع الآلي مع مؤشر تقدم تفاعلي واقعي
   - الخطوة 5: ملخص الناتج والتعارضات المحلولة

5. **Schedule Review Board (شاشة المراجعة الكبرى)**:
   - عرض حسب المساجد (Rows = مساجد، Cols = جمعات)
   - عرض حسب الخطباء (Rows = خطباء، Cols = جمعات)
   - عرض حسب جمعة محددة (جمعة 1، 2، 3، 4، 5)
   - التفاعل مع الخلية: عرض المصدر، القفل/فك القفل، تغيير الخطيب بدرج جانبي يعرض المرشحين المؤهلين والمفضلين والمانعين بوضوح
   - إعادة التوزيع الجزئي للغير مقفول أو جمعة محددة
   - مركز التعارضات وحلولها والاستثناءات الإدارية المسجلة
   - مسار الاعتماد الرسمي (Approval Workflow)

6. **Publishing & WhatsApp Center (مركز النشر والواتساب)**:
   - توليد PDF جدول المدينة العريض (Landscape)
   - توليد PDF مستقل لكل مسجد
   - توليد PDF مستقل لكل خطيب
   - قوالب رسائل الواتساب الديناميكية
   - فحص أرقام الهواتف وجاهزية المستلمين والإرسال الفردي والجماعي

7. **Reports & Audit Log (التقارير وسجل العمليات)**:
   - إحصائيات عدالة التوزيع، التعديلات اليدوية، والاستثناءات
   - سجل رقابي كامل للعمليات والتعديلات

---

## 5. خطة التنفيذ المرحلية (Implementation Phases)

- **Phase 1: Foundation & Data Architecture**
  - ملفات الإعداد والمستندات (`PROJECT_PLAN.md`, `DECISIONS.md`, `metadata.json`, `index.html`)
  - مخطط قاعدة بيانات Cloud SQL PostgreSQL وتهيئة Drizzle ORM
  - خادم Express مع تكامل Firebase Auth وإعداد المسارات العامة

- **Phase 2: Master Data & Seed Engine**
  - واجهات وإدارة المساجد، الخطباء، القواعد، والتفضيلات
  - استيراد وتصدير Excel
  - تضمين بيانات واقعية تجريبية شاملة (20 مسجد، 25 خطيب، حالات ثابتة ومرنة وممنوعة)

- **Phase 3: Scheduling Engine & Wizard**
  - تنفيذ محرك الجدولة الحسابي المكتمل مع الأولويات الست
  - معالج إنشاء الجدول التدريجي بخطواته الخمس

- **Phase 4: Review Board, Conflicts & Overrides**
  - لوحة المراجعة التفاعلية متعددة الأنماط
  - القفل وإعادة التوزيع الجزئي والاستثناء الإداري وتاريخ التعديل
  - تدقيق شروط الاعتماد

- **Phase 5: Publishing, PDF Generation & WhatsApp Dispatch**
  - توليد ملفات PDF العربية للمدينة والمساجد والخطباء
  - مركز الواتساب مع قوالب الرسائل والمحاكاة والمشاركة المباشرة

- **Phase 6: Verification, Testing & Polish**
  - تشغيل الاختبارات وفحص السيناريو الشامل (20 مسجد × 25 خطيب × 5 جمعات)
  - التدقيق على الـ Responsive، الـ RTL، وتحسين التغذية الراجعة
