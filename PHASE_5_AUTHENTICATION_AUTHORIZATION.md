# وثيقة توثيق المرحلة الخامسة: المصادقة والتفويض البرمجي الصارم من جهة الخادم
# PHASE 5 — AUTHENTICATION & SERVER-SIDE AUTHORIZATION REPORT

**تاريخ التوثيق:** 06 أكتوبر 2026  
**حالة الاعتماد:** منجز ومجتاز بنسبة 100% (PASS)  
**الأمان ومطابقة قواعد البيانات:** 0 تعديلات في الجداول (Zero Schema Changes)، 0 سجلات تم العبث بها، 0 ترحيلات (Zero Migrations)

---

## 1. الفحص الجنائي الأولي للبنية السابقة (Forensic Audit & Baseline State)

قبل البدء بالتعديل، تم فحص الشيفرة المصدرية والمستودع بدقة:

| العنصر | الحالة السابقة | المخاطر المكتشفة | الإجراء المتخذ في المرحلة 5 |
| :--- | :--- | :--- | :--- |
| **واجهة الدخول والخروج** | صورية بالكامل (`Header.tsx` يعرض اسماً ثابتاً، والزر ينفذ `location.reload()`) | عدم وجود جلسة حقيقية أو إمكانية للتحقق من هوية المستخدم | بناء `AuthContext.tsx` ومكوّن `LoginModal.tsx` وربطهما بدورة حياة الخادم |
| **وسيط المصادقة (`auth.ts`)** | وسيط معزول محلياً مع تجاوزات غير آمنة (`dev-admin`) ومحاولة غير مهيأة للاتصال بـ Firebase Admin | إمكانية تجاوز الحماية في بيئات التطوير إذا تم إرسال معلمات بالحمولة | إعادة هيكلة الوسيط (`requireAuth`, `requireAdmin`, `requireRole`) والاعتماد على توقيعات مشفرة لا يمكن تزويرها |
| **نقاط مسارات التعديل (`api.ts`)** | معظم مسارات `POST/PATCH/DELETE` كانت مفتوحة تماماً دون أي وسيط مصادقة | إمكانية إرسال أي مستخدم مجهول لطلبات `POST /mosques` أو `POST /schedules` مباشرة وحفظها بالـ DB | إرفاق وسيطي `requireAuth` و `requireAdmin` لكافة مسارات التعديل الحساسة |
| **حفظ الجلسات** | لا يوجد حفظ للجلسات من جهة الخادم | فقدان السياق وسهولة التخمين | استخدام جلسات ذاتية التوثيق مشفرة بـ HMAC-SHA256 عبر كوكيز `HttpOnly` وترويسة `Bearer` |
| **ثقة الخادم في هوية العميل** | بعض المسارات كانت تعتمد على `req.body.approvedBy` أو `req.body.userId` | انتحال الهوية وتصعيد الصلاحيات (Privilege Escalation) | الاعتماد الحصري والقطعي على الكائن المشفر `req.user` الصادر من الخادم |

---

## 2. القرارات المعمارية المعتمدة (Architectural Decisions)

1. **الالتزام بالقيد الأمني الصارم لخط الأساس لقاعدة البيانات:**
   - جدول `users` الفيزيائي غير موجود في قاعدة بيانات PostgreSQL الإنتاجية (تتكون قاعدة البيانات حصرياً من 11 جدولاً معتمداً).
   - التزاماً بالشرط الحاسم بعدم إنشاء جداول جديدة أو تشغيل ترحيلات Drizzle، تم اعتماد بنية التوثيق المشفرة عديمة الحالة (Cryptographic Signed Token Architecture) باستخدام مكتبة Node.js الأصلية `crypto` (تشفير HMAC-SHA256 وتجزئة كلمات المرور عبر `scryptSync`).
2. **منع هجمات التوقيت (Timing Attacks):**
   - مطابقة التوقيعات المشفرة ومطابقة كلمات المرور تتم حصرياً عبر `crypto.timingSafeEqual`.
3. **سجل إبطال الجلسات عند تسجيل الخروج (Session Revocation Registry):**
   - عند استدعاء `POST /api/auth/logout`، يتم تسجيل توقيع الجلسة في سجل الإلغاء الفوري، مما يجعل الرمز المميز ملغياً فوراً حتى قبل انتهاء صلاحيته الزمنية.
4. **تعدد طبقات التحقق (Defense in Depth):**
   - دعم التوثيق عبر الكوكيز الآمنة `HttpOnly; SameSite=Lax` للواجهات والمتصفحات لمنع سرقة الرموز عبر ثغرات XSS.
   - دعم التوثيق عبر ترويسة `Authorization: Bearer <token>` لأدوات الاختبار والواجهات البرمجية.

---

## 3. تصنيف مسارات الخادم (API Routes Classification Matrix)

### أ. مسارات القراءة العامة (`PUBLIC / READ`):
- `GET /api/health`
- `GET /api/calendar/current`
- `GET /api/calendar/month-info`
- `GET /api/locations/*`
- `GET /api/settings`
- `GET /api/mosques`
- `GET /api/mosques/:id`
- `GET /api/mosques/:id/profile`
- `GET /api/mosques/:id/rules`
- `GET /api/mosques/:id/fixed-patterns`
- `GET /api/rules`
- `GET /api/imams`
- `GET /api/imams/:id`
- `GET /api/imams/:id/profile`
- `GET /api/schedules`
- `GET /api/schedules/:id`
- `GET /api/dashboard`
- `GET /api/dashboard/alerts`
- `GET /api/reports/summary`
- `GET /api/distribution/:scheduleId`
- `GET /api/import-export/templates/:type`
- `GET /api/supabase/status`

### ب. مسارات العمليات المشروطة بمصادقة صالحة (`AUTHENTICATED — Staff & Admin`):
- `POST /api/mosques`
- `PATCH /api/mosques/:id`
- `POST /api/mosques/:id/rules`
- `DELETE /api/mosques/:id/rules/:ruleId`
- `POST /api/mosques/:id/fixed-patterns`
- `POST /api/mosques/:id/fixed-patterns/copy`
- `POST /api/imams`
- `PATCH /api/imams/:id`
- `POST /api/imams/:id/availabilities`
- `POST /api/rules`
- `POST /api/schedules`
- `POST /api/schedules/:id/generate`
- `POST /api/schedules/:id/redistribute`
- `POST /api/schedules/:id/emergency-replacements`
- `POST /api/schedules/:id/assignment`
- `POST /api/schedules/:id/lock-toggle`
- `POST /api/schedules/:id/swap-assignments`
- `POST /api/assignments/:id/confirm`
- `POST /api/import-export/preview`
- `POST /api/import-export/export`
- `POST /api/calendar/sync`

### ج. مسارات الصلاحيات الإدارية الحصرية (`ADMIN PRIVILEGED ONLY — 403 for Staff/Viewer`):
- `DELETE /api/mosques/:id`
- `POST /api/mosques/bulk-delete`
- `DELETE /api/mosques/:id/fixed-patterns/:patternId`
- `POST /api/mosques/import`
- `DELETE /api/imams/:id`
- `POST /api/imams/bulk-delete`
- `DELETE /api/rules/:id`
- `PUT /api/settings`
- `POST /api/schedules/:id/approve`
- `POST /api/schedules/:id/publish`
- `POST /api/distribution/:scheduleId/dispatch-all`
- `GET /api/audit-logs`
- `POST /api/import-export/execute`
- `GET /api/import-export/logs`
- `GET /api/import-export/logs/:id/error-report`
- `POST /api/system/*` (`clear-all`, `reset-demo`, `export-seed`)
- `POST /api/supabase/sync`

---

## 4. نموذج الأدوار والصلاحيات (Role Model)

تم تحديد ثلاثة أدوار وظيفية قياسية تعكس طبيعة العمل الحقيقية بالجمعية:

| الدور (Role) | البريد المعتمد | الصلاحيات (Permissions) |
| :--- | :--- | :--- |
| **مدير النظام (`admin`)** | `admin@aljameya.org` | صلاحيات كاملة: تعديل، اعتماد ونشر الجداول، حذف المساجد والخطباء، إدارة الإعدادات، الاطلاع على سجلات التدقيق والعمليات الحساسة. |
| **مشرف الجداول (`staff`)** | `staff@aljameya.org` | صلاحيات تشغيلية: إنشاء وتعديل المساجد والخطباء والقواعد، توليد الجداول وإعادة توزيعها، تعديل وتأكيد التكليفات وتبديلها. يُحظر عليه الاعتماد الرسمي والحذف الكلي والتعديل على الإعدادات العامة. |
| **مشاهد ومراقب (`viewer`)** | `viewer@aljameya.org` | صلاحيات قراءة واطلاع فقط: لا يُسمح له بأي عمليات تعديل تجارية على البيانات (POST/PATCH/DELETE). |

---

## 5. نتائج الاختبارات المعيارية والتحقق (Test Results & Verification)

### أ. اختبارات الأمان والمصادقة الميدانية (`tests/authSecurity.test.ts`):
1. ✅ **تسجيل الدخول الصحيح:** تم بنجاح مع إصدار رمز جلسة مشفر ومعلومات المستخدم.
2. ✅ **كلمة المرور الخاطئة:** تم رفضها برمز `401 Unauthorized`.
3. ✅ **استمرارية الجلسة (Session Persistence):** تم التحقق منها خادمياً عبر المفتاح المشفر.
4. ✅ **طلب المسار الموثق:** نجح عبر ترويسة `Authorization: Bearer <token>`.
5. ✅ **طلب التعديل لمجهول:** تم رفض `POST /api/mosques` مباشرة برمز `401 Unauthorized`.
6. ✅ **رمز الجلسة المتلاعب به:** تم رفضه برمز `401 Unauthorized` فور فشل التحقق من التوقيع.
7. ✅ **تسجيل الخروج الحقيقي:** نجح وأبطل صلاحية التوقيع في الخادم فوراً.
8. ✅ **طلب برمز مبطل بعد الخروج:** تم رفضه برمز `401 Unauthorized`.
9. ✅ **دور غير مصرح له (Viewer -> Admin Action):** تم رفضه برمز `403 Forbidden`.
10. ✅ **دور مصرح له (Admin -> Admin Action):** تم السماح له بنجاح تام.
11. ✅ **انتحال هوية المستخدم بالحمولة (Body Spoofing):** تم إحباطه بالكامل؛ الخادم يعتمد حصرياً على الجلسة الموثقة.
12. ✅ **تصعيد الصلاحيات المتلاعب بها (Role Elevation):** تم إحباطه عبر التحقق من التوقيع المشفر برمز `401`.
13. ✅ **تجاوز الواجهة لعمليات التعديل:** محظور؛ الخادم يرفض العمليات المباشرة غير المصرح بها.
14. ✅ **استقلالية حماية الخادم:** الخادم يفرض المصادقة والتفويض بشكل مستقل وتام.
15. ✅ **فشل قاعدة البيانات يظل Fail-Closed:** لا يتم تحويل أي فشل إلى نجاح مزيف أو بيانات مؤقتة.

### ب. عدم انكسار التوافقية السابقة (Regression Suite Verification):
- **فحص الأنواع الصارم (TypeScript):** 0 أخطاء (`npx tsc --noEmit` -> PASS).
- **حزمة الاختبارات الشاملة (`npm test`):** 58/58 نجحت بالكامل (Calendar: 17, Engine: 13, Security: 4, CRUD: 5, Official A4: 4, Auth: 15).
- **فحوصات الفشل المنضبط (`controlledFailure.test.ts`):** 9/9 نجحت بالكامل (Exit Code 0).
- **شهادة استمرارية البيانات P0 (`p0PersistenceCertification.ts`):** 100% نجاح واجتياز لكافة سيناريوهات الاستمرارية وإعادة تشغيل الخادم والجلسات المنفصلة.
- **تطابق خط الأساس لقاعدة البيانات:** تطابق 100% لكافة الجداول الـ 11 بعد إتمام الاختبارات.

---

## 6. قائمة التدقيق الأمني (Security Checklist)

- [x] كلمات المرور لا تُسجل أبداً في سجلات التدقيق أو الطباعة (Passwords never logged).
- [x] الرموز المميزة لا تُسجل أبداً في السجلات (Tokens never logged).
- [x] الأسرار البرمجية غير مدمجة في الشيفرة (Secrets never hardcoded).
- [x] لا توجد بيانات اعتماد أو كلمات مرور في `localStorage` (No credentials in localStorage).
- [x] الخادم يتحقق من صلاحية الجلسات في كل طلب (Server validates session).
- [x] واجهات الـ API لا تثق في أدوار العميل المرسلة بالحمولة (API does not trust client role).
- [x] واجهات الـ API لا تثق في معرفات المستخدمين المرسلة بالحمولة (API does not trust client user ID).
- [x] تسجيل الخروج يبطل الجلسة فورياً (Logout invalidates session).
- [x] الجلسات المنتهية الصلاحية تُرفض فوراً (Expired session rejected).
- [x] عمليات التعديل المجهولة تُرفض برمز 401 (Anonymous mutation rejected).
- [x] التفويض مفروض من جانب الخادم (Authorization enforced server-side).
- [x] لا توجد أي ثغرات أو تجاوزات للبيئة الإنتاجية (No production auth bypass).
- [x] رسائل الخطأ معقمة ومحمية من تسريب سلاسل الاتصال (Error messages sanitized).
