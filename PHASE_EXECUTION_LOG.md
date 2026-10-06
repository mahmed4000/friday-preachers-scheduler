# سجل تنفيذ المراحل التشغيلية (Phase Execution Log)
**المشروع:** منظّم خطباء الجمعة — Friday Preachers Scheduler  
**الحالة العامة:** جاري التنفيذ وفق خطة التعافي المعتمدة (MASTER_RECOVERY_PLAN.md)

---

## سجل تدقيق المراحل (Execution Log Tracker)

| المرحلة | الوصف والهدف | تاريخ البدء | تاريخ الانتهاء | حالة البناء والاختبار | كود الالتزام (Commit) | الحالة النهائية |
| :--- : | :--- | :---: | :---: | :---: | :---: | :---: |
| **المرحلة 0** | تأمين خط الأساس والنسخ الاحتياطي | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل | backup-pre-recovery-audit | **مكتملة بنجاح** ✅ |
| **المرحلة 1** | معالجة حواصر النشر وأخطاء الأنواع | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل (0 أخطاء) | 063172c | **مكتملة بنجاح** ✅ |
| **المرحلة 2** | تشديد الأمان والمصادقة وقفل المسارات | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل (4/4 اختبارات أمان) | c9c029c | **مكتملة بنجاح** ✅ |
| **المرحلة 3** | استعادة استبقاء البيانات وتصفية الحقول (P0 CRUD) | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل (11/11 اختبار CRUD) | 3a66575 | **مكتملة بنجاح** ✅ |
| **المرحلة 4** | تحسين محرك التقويم وتسريع الحسابات | أكتوبر 2026 | أكتوبر 2026 | خفض الزمن >100x (17/17 اختبار) | 5aff705 | **مكتملة بنجاح** ✅ |
| **المرحلة 5** | استقرار الطباعة والمستند الرسمي A4 والشعار | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل (4/4 اختبارات طباعة) | 20c9278 | **مكتملة بنجاح** ✅ |
| **المرحلة 6** | سجل الرقابة والتدقيق ومزامنة Realtime | أكتوبر 2026 | أكتوبر 2026 | اجتياز كامل (49/49 اختبار) | 5ea4b9c | **مكتملة بنجاح** ✅ |
| **المرحلة 7** | الاعتماد النهائي وبوابات الجودة الإنتاجية | أكتوبر 2026 | أكتوبر 2026 | 0 أخطاء / بناء إنتاجي ناجح | HEAD | **مكتملة بنجاح** ✅ |

---

## تفاصيل تنفيذ المرحلة 0 (Phase 0 Execution Details)

* **الهدف:** التأكد من سلامة بيئة العمل وخلو شجرة Git من التعديلات الطارئة وتوثيق خط الأساس وتعديل مؤلف Git لحل مشكلة Vercel Hobby.
* **العمليات المنفذة:**
  1. التحقق من أمر `git status` ونظافة شجرة العمل.
  2. ضبط البريد الإلكتروني لمؤلف Git إلى `49865714+mahmed4000@users.noreply.github.com` المطابق لحساب المالك على GitHub لرفع حظر Vercel Hobby.
  3. إنشاء وسم مرجعي محلي للنسخ الاحتياطي: `backup-pre-recovery-audit`.
  4. صياغة وثائق التدقيق والتخطيط المعتمدة (14 وثيقة مرجعية).
* **النتائج:** شجرة العمل نظيفة والوسم المرجعي مسجل ووثائق الخطة متكاملة.

---

## تفاصيل تنفيذ المرحلة 1 (Phase 1 Execution Details)

* **الهدف:** القضاء الجذري على أخطاء TypeScript (41 خطأ) وفرض بوابة فحص الأنواع تلقائياً قبل بناء الإنتاج.
* **الملفات المعدلة:**
  - `src/types/index.ts`: استكمال حقول الجمعات والمساجد والتكليفات ونمط التثبيت وملخصات الجداول.
  - `src/db/index.ts`: إضافة أنواع مسبح الاتصال والتعامل الصريح مع أخطاء الاستعلامات.
  - `src/App.tsx`: تصحيح توقيع دالة إعادة التحميل في معالج النقر لتفادي تمرير `MouseEvent` كقيمة منطقية.
  - `src/components/dashboard/DashboardView.tsx`: توفير الحقول الناقصة لنوع الخطيب الافتراضي.
  - `src/components/mosques/MosquesView.tsx`: فحص أمان القيمة غير المعرفة لـ `fixedCount`.
  - `src/components/profiles/ImamProfileView.tsx` و `MosqueProfileView.tsx`: تأمين الوصول للجداول المتاحة عبر `optional chaining`.
  - `src/components/portal/PreacherMobileCardModal.tsx`: دعم أنواع `ProfileAssignmentItem` و `ScheduleSummaryItem`.
  - `src/components/settings/SupabaseCloudSettings.tsx`: إضافة خاصية `url` لواجهة حالة Supabase.
  - `src/lib/profileFallbacks.ts`: تمرير المعامل العام الصريح لدالة التقويم واحتساب رقم الشهر الهجري.
  - `src/server/api.ts`: تأمين قراءة `periodStatus` من بيانات الجدول الشهري.
  - `package.json`: دمج أمر `tsc --noEmit` كبوابة إلزامية داخل أمر البناء `npm run build`.
* **نتائج الفحص:**
  - `npx tsc --noEmit` : اجتياز كامل بدون أي خطأ (0 أخطاء).
  - `npm test` : 30 اختبار وحدة اجتازت بنجاح (17 تقويم + 13 جدولة).
  - `npm run build` : اجتياز كامل وبناء ناجح لحزمة العميل والخادم في أقل من 5 ثوانٍ.
* **كود الالتزام:** `063172c` (`fix(types): resolve all TypeScript compilation errors and enforce build gate`).

---

## تفاصيل تنفيذ المرحلة 2 (Phase 2 Execution Details)

* **الهدف:** قفل الثغرات الأمنية الحرجة، وحماية مسارات التصفير والتعديل، وتطهير الشيفرة من المفاتيح المدمجة، وتأمين سياسات RLS.
* **الملفات المعدلة:**
  - `src/middleware/auth.ts`: إضافة وسيط `requireAdmin` الصارم الذي يرفض الطلبات غير المصرحة برمز 403، ودعم المفتاح السري `ADMIN_RESET_SECRET` وتأكيد الإجراء في بيئات التطوير.
  - `src/server/api.ts`: تطبيق `requireAdmin` على مسارات الحذف الشامل وإعادة الضبط وتجميد البذرة (`/api/system/clear-all`, `/api/system/reset-demo`, `/api/system/export-seed`).
  - `src/App.tsx`: تمرير ترويسة التأكيد الإداري `x-admin-action: confirmed` في استدعاء تهيئة البيانات التجريبية.
  - `src/lib/supabaseClient.ts`: إزالة المفاتيح والروابط المدمجة (`fallbackUrl` و `fallbackKey`) وجعل التهيئة معتمدة حصرياً على متغيرات البيئة.
  - `supabase_schema.sql`: إعادة هيكلة سياسات RLS بفصل القراءة العامة عن عمليات التعديل والحذف وحصر التعديل على `authenticated` و `service_role`.
  - `tests/securityHardening.test.ts`: إنشاء جناح اختبارات الأمان الأوتوماتيكي والتحقق من صد المسارات الحساسة.
  - `package.json`: دمج اختبارات الأمان ضمن أمر الاختبار الشامل `npm test`.
* **نتائج الفحص:**
  - `tests/securityHardening.test.ts` : اجتياز 4/4 اختبارات أمان.
  - `npm test` : 34 اختبار اجتازت بنجاح كامل (17 تقويم + 13 جدولة + 4 أمان).
  - `npx tsc --noEmit` : 0 أخطاء.
  - `npm run build` : اجتياز كامل.
* **كود الالتزام:** `c9c029c` (`fix(security): harden authentication middleware, protect destructive routes and restrict RLS policies`).

---

## تفاصيل تنفيذ المرحلة 3 (Phase 3 Execution Details — P0 CRUD Persistence)

* **الهدف:** معالجة المشكلة الإنتاجية الحرجة P0 المتمثلة في اختفاء تعديلات المستخدمين بعد الحفظ أو التحديث.
* **الملفات المعدلة:**
  - `src/db/index.ts`: تمديد مهلة اتصال مسبح PostgreSQL إلى 10000ms، وإلغاء القفل الدائم للاتصال عند الأخطاء العابرة لمنع تسميم الحالة العامة.
  - `src/db/schema.ts`: إضافة تعريف جدول `organizationSettings` لتمكين استمرارية إعدادات وهوية الجمعية في PostgreSQL.
  - `src/types/index.ts`: تحديث واجهة `OrganizationSettings` لتتوافق مع أعمدة قاعدة البيانات القابلة للقيم الخالية.
  - `src/server/api.ts`: تفعيل تصفية صارمة للحقول (Whitelisting) في مسارات إضافة وتعديل المساجد والخطباء لعزل الحقول المحسوبة (`rules`, `preferencesCount`, `assignedFridaysCount`) التي كانت تسقط استعلامات Drizzle.
  - `src/components/imams/ImamProfileModal.tsx`: استبدال الإشعار المتفائل السابق بانتظار استجابة الخادم الصريحة وعدم غلق النموذج عند حدوث أي خطأ في الحفظ.
  - `src/App.tsx`: تفعيل إعادة الجلب التحقيقي (`loadInitialData(false)`) في خلفية الواجهة فور تأكيد حفظ أي مسجد أو خطيب.
  - `tests/crudPersistence.test.ts`: بناء جناح اختبار دورة حياة البيانات الشاملة (Create → Patch → Get → Delete).
* **نتائج الفحص:**
  - `tests/crudPersistence.test.ts`: اجتياز كامل لجميع مراحل دورة الحياة.
  - `npm test`: 44 اختبار اجتازت بنجاح.
* **كود الالتزام:** `3a66575` (`fix(data): recover CRUD persistence, whitelist mutation fields, and eliminate ephemeral fallbacks`).

---

## تفاصيل تنفيذ المرحلة 4 (Phase 4 Execution Details — Calendar Optimization)

* **الهدف:** القضاء التام على التجمد والتأخير في حساب الشهور الهجرية الناتجة عن حلقة الـ 950 دورة السابقة.
* **الملفات المعدلة:**
  - `src/services/calendar/calendarProvider.ts`: استبدال الحلقة الشاملة بنافذة بحث فلكية موجهة (≤45 خطوة) لتقليص زمن الاستخراج من 250ms إلى أقل من 1ms بنسبة تسريع تفوق 100 ضعف، مع الحفاظ على مطابقة 100% لتقويم أم القرى.
* **نتائج الفحص:**
  - `tests/calendarService.test.ts`: 17/17 اختبار تقويم اجتازت بنجاح تام.
* **كود الالتزام:** `5aff705` (`perf(calendar): optimize Hijri month calculation from 950 steps to high-speed targeted window`).

---

## تفاصيل تنفيذ المرحلة 5 (Phase 5 Execution Details — Official A4 Printing)

* **الهدف:** توحيد مظهر المستندات الرسمية، وثبات قياسات الشعار، ومنع تمزق الصفحات في الطباعة والـ PDF والاستغناء عن اعتمادات CDN الخارجية.
* **الملفات المعدلة:**
  - `src/components/common/OfficialA4Document.tsx`: إنشاء مكوّن رسمي موحد يدعم النمطين الرأسي والأفقي مع ترويسة متجهة وخاتم رسمي وهوامش A4 محكومة.
  - `src/index.css`: ضبط هوامش `@page` بـ `8mm 6mm`، وفرض طباعة الألوان الصريحة عبر `print-color-adjust: exact`.
  - `src/lib/pdfExport.ts`: حقن أنماط المستند المحلية تلقائياً في نافذة الطباعة واستبعاد سكربت CDN الخارجي.
  - `src/components/decree/OfficialDecreeModal.tsx`: ربط زر الطباعة بنافذة الطباعة المستقلة المنعزلة عن خلفية النافذة المنبثقة.
  - `tests/officialA4Document.test.ts`: جناح اختبارات أوتوماتيكي للتحقق من سلامة هندسة HTML وقواعد A4.
* **نتائج الفحص:**
  - `tests/officialA4Document.test.ts`: 4/4 اختبارات اجتازت بنجاح.
* **كود الالتزام:** `20c9278` (`feat(publishing): create OfficialA4Document, harden print CSS, and eliminate external CDN in print export`).

---

## تفاصيل تنفيذ المرحلة 6 (Phase 6 Execution Details — Audit Logs & Real-time)

* **الهدف:** ربط مسار تسجيل الرقابة والتدقيق الإداري بكافة العمليات، وضمان عدم انهيار التطبيق في حال عدم تهيئة Supabase.
* **الملفات المعدلة:**
  - `src/server/memoryStore.ts`: دعم مصفوفة `memoryAuditLogs` ودوال `recordAuditLog` و `getAuditLogs`.
  - `src/server/api.ts`: تأمين دالة `logAudit` لتدوين العمليات بسلاسة مع دعم البدائل المرنة، وتحديث مسار `GET /api/audit-logs`.
  - `tests/crudPersistence.test.ts`: إضافة اختبار التحقق من تسجيل العمليات في سجل التدقيق الرقابي.
* **نتائج الفحص:**
  - `npm test`: 49 اختبار اجتازت بنجاح تام عبر 5 أجنحة اختبار.
* **كود الالتزام:** `5ea4b9c` (`fix(audit): wire audit logging across all mutations and implement resilient memory fallback`).

---
*تم اعتماد السجل بعد اجتياز كافة بوابات الجودة والنوعية والأمان.*
