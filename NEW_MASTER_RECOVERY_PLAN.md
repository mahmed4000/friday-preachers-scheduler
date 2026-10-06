# خطة التعافي والتحول الإنتاجي القائمة على الأدلة الجنائية
# NEW MASTER RECOVERY PLAN — EVIDENCE-DRIVEN RECOVERY

**المشروع:** منظّم خطباء الجمعة (Friday Preachers Scheduler)  
**الإصدار:** 2.0.0 — الخطة الحاكمة الملزمة المستندة إلى التحقق المستقل  
**تاريخ الاعتماد:** 6 أكتوبر 2026  
**المرجعية:** مستندة بالكامل إلى حقائق [RECOVERY_BASELINE.md](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/RECOVERY_BASELINE.md) و [FINAL_RECOVERY_VERIFICATION.md](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/FINAL_RECOVERY_VERIFICATION.md)  
**الوضع التشغيلي عند الانطلاق:**  
- **P0 Persistence:** `NOT PROVEN`  
- **Production Readiness:** `BLOCKED`  

---

## 1. الميثاق الهندسي والمبادئ الحاكمة (Guiding Principles)

1. **الاحتكام للأدلة التنفيذية فقط (Evidence Over Claims):** لن يُقبل أي ادعاء بالنجاح أو الجاهزية ما لم يقترن بدليل تنفيذي صريح في بيئة التشغيل الحقيقية.
2. **PostgreSQL هي مصدر الحقيقة الوحيد (Single Authoritative Source):** يُحظر حظراً باتاً اعتماد استمرار البيانات على أي من:
   - ذاكرة الـ RAM (`memoryStore.ts`)
   - كاش المتصفح المحلي (`localStorage`)
   - حالة React المحلية (`useState`)
   - ملف البذور الساكن (`initialSeed.json`)
   - نظام ملفات الخادم المؤقت (Serverless Ephemeral FS)
3. **لا نجاح زائف (Zero False Success):** الواجهة لن تُظهر إشعار نجاح ولن تغلق النوافذ إلا بعد تأكيد الخادم لقيد السجل في قاعدة البيانات.
4. **تنفيذ مرحلي منضبط (One Phase at a Time):** كل مرحلة لها أهداف واضحة، ملفات محددة، مخاطر معلنة، وشروط اكتمال صارمة (Definition of Done). يُمنع الانتقال للمرحلة التالية قبل اجتياز الحالية بنسبة 100%.

---

## 2. جدول المراحل التنفيذية المتسلسلة (Ordered Execution Roadmap)

```
[ المرحلة 0: تثبيت خط الأساس الجنائي ] ◄── (مكتملة وموثقة في RECOVERY_BASELINE.md)
       │
       ▼
[ المرحلة 1: تكوين الاتصال بقاعدة بيانات PostgreSQL الحقيقية وتصحيح المخطط ]
       │
       ▼
[ المرحلة 2: التحقق الصارم من استمرارية CRUD الحقيقية (Real DB CRUD Verification) ]
       │
       ▼
[ المرحلة 3: التحقق من استمرار البيانات عبر الجلسات والريستارت (Cross-Session) ]
       │
       ▼
[ المرحلة 4: تفكيك وإلغاء سلطة memoryStore كمصدر حقيقة تجاري ]
       │
       ▼
[ المرحلة 5: تنظيف مسارات البيانات ومنع استرجاع الكاش القديم (Source of Truth Audit) ]
       │
       ▼
[ المرحلة 6: القضاء التام على إشعارات النجاح الزائف (False Success Elimination) ]
       │
       ▼
[ المرحلة 7: تشديد أمان الـ API وإلزام مسارات الـ CRUD بميدلوير requireAuth ]
       │
       ▼
[ المرحلة 8: مطابقة سياسات أمان قاعدة البيانات (RLS) وصلاحيات الحسابات ]
       │
       ▼
[ المرحلة 9: إصلاح نظام الاختبارات وضمان خروج npm test برمز 0 على كافة البيئات ]
       │
       ▼
[ المرحلة 10: رفع جودة الاختبارات وفصل اختبارات الوحدة عن اختبارات الـ DB الحية ]
       │
       ▼
[ المرحلة 11: تصحيح مخالفة Git بحذف api/index.js وإدراجه في .gitignore ]
       │
       ▼
[ المرحلة 12: مزامنة ودفع الالتزامات إلى مستودع GitHub البعيد ]
       │
       ▼
[ المرحلة 13: التحقق من بناء وتشغيل بيئة Vercel الإنتاجية ]
       │
       ▼
[ المرحلة 14: الفحص الإنتاجي الشامل من النهاية إلى النهاية (Production E2E Smoke Test) ]
       │
       ▼
[ المرحلة 15: إصدار شهادة الإنتاج النهائية (Final Production Certification) ]
```

---

## 3. تفاصيل المراحل التنفيذية (Detailed Phase Specifications)

---

### المرحلة 1: تكوين الاتصال بقاعدة بيانات PostgreSQL الحقيقية وتصحيح المخطط
- **الهدف:** توفير بيئة اتصال PostgreSQL صالحة، ومزامنة مخطط Drizzle مع مخطط SQL الحقيقي.
- **الملفات المتأثرة:**
  - [src/db/index.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/index.ts)
  - [src/db/schema.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/schema.ts)
  - [src/db/drizzle.config.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/drizzle.config.ts)
  - `.env` (ملف محلي يتجاهله Git)
- **الإجراءات التنفيذية:**
  1. التحقق من توفر `DATABASE_URL` حقيقي عبر متغيرات البيئة المحلية أو ملف `.env`.
  2. تصحيح عدم تطابق عمود `audit_logs`: تعديل تعريف `detailsJson` في [src/db/schema.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/schema.ts) ليطابق عمود `details` في PostgreSQL أو دعمهما بمرونة.
  3. تحديث [src/db/drizzle.config.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/drizzle.config.ts) ليعتمد على `DATABASE_URL` القياسي.
  4. التحقق من استجابة استعلام `SELECT 1` و `SELECT current_database()` بنجاح.
- **المخاطر:** كشف أسرار الاعتمادية إذا لم يُضمن تجاهل `.env` في Git. (الإجراء الوقائي: فحص صارم لـ `.gitignore`).
- **شرط النجاح (DoD):** نجاح الاتصال بقاعدة بيانات PostgreSQL حقيقية، وعودة `isDatabaseAvailable()` بالقيمة `true`.

---

### المرحلة 2: التحقق الصارم من استمرارية CRUD الحقيقية (Real DB CRUD Verification)
- **الهدف:** إخضاع الكيانات التجارية الحيوية لدورة حياة CRUD كاملة ضد PostgreSQL حقيقية دون أي سقوط في memoryStore.
- **الملفات المتأثرة:**
  - [tests/crudPersistence.test.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/tests/crudPersistence.test.ts)
- **الإجراءات التنفيذية:**
  1. تعديل اختبار استمرارية البيانات ليفشل فوراً وبشكل صريح إذا لم يتوفر `DATABASE_URL` (منع السقوط الصامت على RAM).
  2. تنفيذ دورة CRUD كاملة على PostgreSQL لكل كيان:
     - **المساجد (Mosques):** إنشاء → فحص سطر الجدول في Postgres → قراءة → تعديل → فحص سطر الجدول في Postgres → حذف.
     - **الخطباء (Imams):** إنشاء → فحص سطر الجدول في Postgres → تعديل → فحص سطر الجدول → حذف.
     - **الجداول (Schedules):** إنشاء جدول شهري بحسابات التقويم وتأكيد الأسطر.
     - **التكليفات (Assignments):** تعديل التكليف وقفل الجمعة وتأكيد قيد السطر وتاريخ التعديل.
     - **إعدادات الجمعية (Settings):** تعديل الاسم والشعار واسترجاعها من الجدول.
     - **قواعد التوافق (Rules):** إنشاء قاعدة تفضيل وفحص السطر في Postgres وحذفها.
     - **سجل التدقيق (Audit Logs):** تأكيد تسجيل عمليات التعديل كسطور حقيقية في جدول `audit_logs`.
- **المخاطر:** وجود حقول غير متطابقة بين Drizzle و PostgreSQL.
- **شرط النجاح (DoD):** استعلامات SQL المباشرة تؤكد وجود وتعديل وحذف الأسطر برقم المعرف الحقيقي (Serial ID) الناتج من القاعدة.

---

### المرحلة 3: التحقق من استمرار البيانات عبر الجلسات والريستارت (Cross-Session)
- **الهدف:** إثبات بقاء البيانات بعد انتهاء دورة حياة العملية، وإعادة تشغيل الخادم، ومحاكاة الجلسات المتعددة.
- **الملفات المتأثرة:**
  - [tests/crudPersistence.test.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/tests/crudPersistence.test.ts) أو نص اختباري مخصص عبر الجلسات.
- **الإجراءات التنفيذية:**
  1. كتابة سجل مسجد وسجل خطيب عبر الـ API في العملية الأولى.
  2. إغلاق العملية والخادم تماماً (Simulate Server Restart / Cold Start).
  3. تشغيل عملية جديدة منفصلة تماماً بدون أي كائنات ذاكرة سابقة، واستدعاء `GET /api/mosques` و `GET /api/imams`.
  4. التحقق من أن السجلات المنشأة موجودة ومطابقة 100% وليست مسترجعة من `initialSeed.json`.
  5. محاكاة جلسة متصفح ثانية تطلب البيانات وتؤكد مطابقتها.
- **شرط النجاح (DoD):** بقاء البيانات واسترجاعها بنجاح بعد إعادة التشغيل الكامل للعملية.

---

### المرحلة 4: تفكيك وإلغاء سلطة memoryStore كمصدر حقيقة تجاري
- **الهدف:** منع `memoryStore.ts` من العمل كمصدر بديل للبيانات التشغيلية، وقصر استخدامه على حالات الطوارئ المعزولة مع حظر خلطه بالبيانات الحية.
- **الملفات المتأثرة:**
  - [src/server/api.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/api.ts)
  - [src/server/memoryStore.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/memoryStore.ts)
- **الإجراءات التنفيذية:**
  1. حصر وتدقيق كافة استدعاءات `memoryStore` في [src/server/api.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/api.ts).
  2. في مسارات التعديل (`POST`, `PATCH`, `PUT`, `DELETE`): إلغاء السقوط الصامت على memoryStore. عند تعذر الاتصال بـ PostgreSQL، يجب أن يُرجع الخادم رمز خطأ صريح `503 Service Unavailable` أو `500` مع رسالة واضحة للمستخدم: *"تعذر الاتصال بقاعدة البيانات المعتمدة لحفظ التعديلات"*.
  3. منع كتابة التعديلات الجديدة إلى RAM عند انقطاع الـ DB لعدم إيهام العميل بالاستقرار.
- **المخاطر:** توقف التطبيق في وضع عدم الاتصال بالإنترنت (Offline Mode). (القرار الهندسي: إعلام المستخدم بعدم الاتصال أفضل قطعياً من إيهامه بالحفظ ثم فقدان البيانات عند التحديث).
- **شرط النجاح (DoD):** أي استدعاء تعديل مع انقطاع الـ DB يرجع خطأ صريحاً ولا يُكتب في RAM.

---

### المرحلة 5: تنظيف مسارات البيانات ومنع استرجاع الكاش القديم (Source of Truth Audit)
- **الهدف:** جعل واجهة المستخدم تعتمد حصرياً على استجابة الـ API الحقيقية وتصحيح معالجة الكاش المحلي.
- **الملفات المتأثرة:**
  - [src/services/clientDataService.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/services/clientDataService.ts)
  - [src/App.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx)
- **الإجراءات التنفيذية:**
  1. تصحيح دالة [fetchMosquesResilient](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/services/clientDataService.ts#L23) ودوال الكيانات الأخرى:
     إذا أرجع الخادم مصفوفة فارغة ناجحة (`res.length === 0`)، يتم قبولها كحالة صحيحة للبيانات (قاعدة بيانات مفرغة) بدلاً من تجاوزها واسترجاع بيانات البذور القديمة من `localStorage`.
  2. في [src/App.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx)، تجريد `localStorage` من الهيمنة على الحالة، وضمان أن استجابة الخادم الحية هي التي تحدث واجهة المستخدم فور تحميل الصفحة.
- **شرط النجاح (DoD):** حذف جميع المساجد يظهر كقائمة فارغة فعلياً بعد التحديث (Refresh) ولا يسترجع المساجد المحذوفة من الكاش.

---

### المرحلة 6: القضاء التام على إشعارات النجاح الزائف (False Success Elimination)
- **الهدف:** التأكد من أن جميع النوافذ التفاعلية والإشعارات بالواجهة لا تفترض النجاح إلا بعد وصول تأكيد صريح من الخادم.
- **الملفات المتأثرة:**
  - [src/App.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx)
  - [src/components/mosques/MosqueProfileModal.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/components/mosques/MosqueProfileModal.tsx)
  - [src/components/imams/ImamProfileModal.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/components/imams/ImamProfileModal.tsx)
  - [src/components/schedules/ScheduleReviewBoard.tsx](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/components/schedules/ScheduleReviewBoard.tsx)
- **الإجراءات التنفيذية:**
  1. إصلاح دالة `handleSaveSettings` في [src/App.tsx:L152-L156](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx#L152-L156): إزالة Toast النجاح الأخضر عند وقوع خطأ في الشبكة، واستبداله بـ Toast خطأ أحمر صريح مع الحفاظ على مدخلات المستخدم لإعادة المحاولة.
  2. التأكد من أن معرفات السجلات الجديدة تُؤخذ حصرياً من استجابة الخادم (`savedRes.id`) مع إزالة المولد العشوائي العميل `Date.now()` عند التعامل مع سجلات الخادم.
- **شرط النجاح (DoD):** عند محاكاة انقطاع الشبكة أثناء الحفظ في أي نافذة، تظهر رسالة خطأ صريحة، وتبقى النافذة مفتوحة محتفظة ببيانات المستخدم، ولا يظهر أي إشعار نجاح أخضر.

---

### المرحلة 7: تشديد أمان الـ API وإلزام مسارات الـ CRUD بميدلوير requireAuth
- **الهدف:** سد الثغرة الأمنية الحرجة المكتشفة بربط ميدلوير المصادقة بجميع مسارات التعديل والحذف.
- **الملفات المتأثرة:**
  - [src/server/api.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/api.ts)
  - [src/middleware/auth.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/middleware/auth.ts)
- **الإجراءات التنفيذية:**
  1. ربط `requireAuth` بكافة مسارات التعديل والحذف:
     - `POST /api/mosques`, `PATCH /api/mosques/:id`, `DELETE /api/mosques/:id`, `POST /api/mosques/bulk-delete`
     - `POST /api/imams`, `PATCH /api/imams/:id`, `DELETE /api/imams/:id`, `POST /api/imams/bulk-delete`
     - `POST /api/rules`, `DELETE /api/rules/:id`
     - `POST /api/schedules`, `POST /api/schedules/:id/assignment`, `POST /api/schedules/:id/generate`, إلخ.
     - `PUT /api/settings`
  2. الحفاظ على `requireAdmin` للمسارات التدميرية الثلاثة:
     `/system/clear-all`, `/system/reset-demo`, `/system/export-seed`.
  3. التأكد من أن مسارات القراءة العامة (`GET`) تظل متاحة للعرض (أو مع `optionalAuth`).
- **المخاطر:** تعطل اختبارات الـ API إذا لم ترسل ترويسة المصادقة المعتمدة. (الإجراء: تحديث استدعاءات الاختبارات لتمرير توكن معتمد أو هيدر مصرح به).
- **شرط النجاح (DoD):** استدعاء أي مسار تعديل بدون توكن مصادقة يرجع فوراً رمز `401 Unauthorized` أو `403 Forbidden`.

---

### المرحلة 8: مطابقة سياسات أمان قاعدة البيانات (RLS) وصلاحيات الحسابات
- **الهدف:** التأكد من أن سياسات RLS على مستوى جداول PostgreSQL تمنع التعديل المباشر غير المصرح به وتتوافق مع نمط الاتصال.
- **الملفات المتأثرة:**
  - [supabase_schema.sql](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/supabase_schema.sql)
- **الإجراءات التنفيذية:**
  1. تدقيق سياسات RLS في PostgreSQL:
     - قراءة عامة للبيانات: `FOR SELECT USING (true)`
     - حظر التعديل والمحو على المستخدمين غير الموثقين:
       `FOR ALL USING (auth.role() IN ('authenticated', 'service_role'))`
  2. التأكد من أن وصول خادم Express للـ DB يتم عبر اتصال آمن (Pool Connection) يملك الصلاحيات المحددة، بينما تظل اتصالات المتصفح المباشرة خاضعة لـ RLS.
- **شرط النجاح (DoD):** محاولة تعديل صف من عميل مجهول الهوية تفشل برفض RLS من محرك PostgreSQL.

---

### المرحلة 9: إصلاح نظام الاختبارات وضمان خروج npm test برمز 0 على كافة البيئات
- **الهدف:** حل انهيار libuv على نظام تشغيل Windows وضمان خروج الأمر الموحد `npm test` برمز 0 صريح.
- **الملفات المتأثرة:**
  - [tests/crudPersistence.test.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/tests/crudPersistence.test.ts)
  - [package.json](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/package.json)
- **الإجراءات التنفيذية:**
  1. في [tests/crudPersistence.test.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/tests/crudPersistence.test.ts)، إزالة استدعاء `process.exit(0)` الفجائي الذي يقاطع إغلاق المقابس (Sockets) أثناء عمل libuv.
  2. استبداله بإنهاء نظيف وغير متزامن:
     ```ts
     await new Promise<void>((resolve) => {
       server.close(() => resolve());
     });
     ```
  3. فحص وإغلاق أي اتصالات معلقة بقاعدة البيانات (`pool.end()`).
  4. التحقق من تشغيل الأمر الموحد `npm test` واكتمال كافة مجموعات الاختبارات الخمس بسلاسة.
- **شرط النجاح (DoD):** تشغيل `npm test` يخرج برمز `0` صريح (Exit Code 0) دون أي تحذير أو انهيار libuv.

---

### المرحلة 10: رفع جودة الاختبارات وفصل اختبارات الوحدة عن اختبارات الـ DB الحية
- **الهدف:** فصل مسؤوليات الاختبارات بوضوح لضمان سلامة التقرير وعدم خلط اختبارات الخوارزميات باختبارات استمرارية قاعدة البيانات.
- **الملفات المتأثرة:**
  - `package.json`
  - مجلد `tests/`
- **الإجراءات التنفيذية:**
  1. تصنيف الاختبارات:
     - **Unit Tests:** `calendarService.test.ts`, `schedulingEngine.test.ts`, `officialA4Document.test.ts` (خوارزميات نقية لا تعتمد على شبكة).
     - **Security Tests:** `securityHardening.test.ts` (فحص آليات الصد الأمني والتفويض).
     - **Integration & Persistence Tests:** `crudPersistence.test.ts` (استمرارية PostgreSQL الفعلية).
  2. ضبط سكريبتات `package.json` لتوفر أوامر منفصلة:
     - `npm run test:unit`
     - `npm run test:persistence`
     - `npm test` (يشمل الكل مع اشتراط نجاح البيئة).
- **شرط النجاح (DoD):** تقارير الاختبارات توضح بدقة بيئة كل اختبار وقاعدته المستهدفة.

---

### المرحلة 11: تصحيح مخالفة Git بحذف api/index.js وإدراجه في .gitignore
- **الهدف:** تنظيف مستودع Git من الملف المجمّع الضخم (6.45MB) ومنع تكرار ارتكابه مع الحفاظ على دورة بناء Vercel السليمة.
- **الملفات المتأثرة:**
  - [.gitignore](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/.gitignore)
  - شجرة Git (حذف التتبع لـ `api/index.js`)
- **الإجراءات التنفيذية:**
  1. إضافة سطر `api/index.js` إلى ملف [.gitignore](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/.gitignore).
  2. إزالة تتبع الملف من فهرس Git دون حذفه محلياً:
     ```bash
     git rm --cached api/index.js
     ```
  3. التحقق من أن أمر البناء الرسمي:
     ```bash
     npm run build
     ```
     يقوم بتوليد الملف ديناميكياً داخل بيئة Vercel بنجاح عبر [scripts/buildServer.js](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/scripts/buildServer.js) دون الحاجة لتخزينه في مستودع Git.
- **المخاطر:** كسر نشر Vercel إذا كان يعتمد على وجود الملف مسبقاً قبل أمر البناء. (الإجراء: فحص `vercel.json` للتأكد من أن `buildCommand: "npm run build"` هو المسؤول عن التوليد).
- **شرط النجاح (DoD):** خلو مستودع Git من ملف `api/index.js` وتوليده بنجاح أثناء البناء.

---

### المرحلة 12: مزامنة ودفع الالتزامات إلى مستودع GitHub البعيد
- **الهدف:** رفع كافة تحسينات التعافي المعمارية (الالتزامات الـ 9 المحبوسة محلياً والالتزامات التصحيحية الجديدة) إلى مستودع GitHub المعتمد.
- **الإجراءات التنفيذية:**
  1. مراجعة `git diff` و `git status` والتأكد التام من خلو التعديلات من أي أسرار أو مفاتيح أو ملفات ضخمة.
  2. التأكد من أن هوية المؤلف لجميع الالتزامات مطابقة لبريد الحساب المصرح له على Vercel:
     `mahmed4000 <49865714+mahmed4000@users.noreply.github.com>`.
  3. تنفيذ الدفع الآمن إلى المستودع البعيد:
     ```bash
     git push origin main
     ```
  4. التحقق من مطابقة الفرع المحلي للفرع البعيد (`up to date with origin/main`).
- **شرط النجاح (DoD):** مستودع GitHub يعرض أحدث الالتزامات وحالة الفرع متطابقة بالكامل.

---

### المرحلة 13: التحقق من بناء وتشغيل بيئة Vercel الإنتاجية
- **الهدف:** التأكد من أن منصة Vercel قامت ببناء المشروع ونشره بنجاح دون اعتراض خطة Hobby، وأن البيئة تعمل على أحدث كود تعافي.
- **الإجراءات التنفيذية:**
  1. فحص حالة النشر على Vercel عبر واجهة الاستضافة أو فحص استجابة الرابط الإنتاجي.
  2. التأكد من غياب خطأ `commit author did not have contributing access`.
  3. التأكد من حقن المتغيرات البيئية اللازمة (`DATABASE_URL`, `ADMIN_RESET_SECRET`) في إعدادات Vercel Production Environment.
  4. التحقق من استجابة رابط الـ API الإنتاجي برمز 200.
- **شرط النجاح (DoD):** النشر الإنتاجي على Vercel بحالة "Ready" ويعمل بأحدث التزام.

---

### المرحلة 14: الفحص الإنتاجي الشامل من النهاية إلى النهاية (Production E2E Smoke Test)
- **الهدف:** إثبات استمرارية البيانات في بيئة الإنتاج الفعلية عبر اختبار حي موثق.
- **الإجراءات التنفيذية:**
  1. فتح الرابط الإنتاجي المنشور.
  2. إضافة مسجد اختباري حقيقي:
     - تسجيل الاستجابة وتأكيد استلام معرف حقيقي.
     - عمل Refresh لصفحة المتصفح مع تفريغ الكاش (Hard Refresh).
     - التأكيد على ظهور المسجد واسترجاعه من قاعدة البيانات.
  3. تعديل المسجد الاختباري:
     - تعديل الاسم والملاحظات.
     - عمل Refresh والتأكيد على بقاء التعديلات.
  4. تسجيل الخروج وتسجيل الدخول من جلسة جديدة وفحص المسجد.
  5. تكرار السيناريو على خطيب اختباري وتكليف جمعة اختباري.
  6. تنظيف وحذف السجلات الاختبارية المنشأة فقط دون المساس ببيانات الإنتاج.
- **شرط النجاح (DoD):** بقاء واستقرار كافة العمليات عبر التحديث والخروج والدخول في بيئة الإنتاج المباشرة.

---

### المرحلة 15: إصدار شهادة الإنتاج النهائية (Final Production Certification)
- **الهدف:** توثيق الأدلة التنفيذية وإصدار التقرير النهائي بالجاهزية للإنتاج.
- **المخرجات الإلزامية:**
  - إنشاء [FINAL_PRODUCTION_CERTIFICATION.md](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/FINAL_PRODUCTION_CERTIFICATION.md).
  - توثيق سجلات التنفيذ في [PHASE_EXECUTION_LOG.md](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/PHASE_EXECUTION_LOG.md).
  - تحديث [CRUD_VERIFICATION_MATRIX.md](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/CRUD_VERIFICATION_MATRIX.md).
- **القرار النهائي:** منح صفة `PRODUCTION READY` مشفوعة بالأدلة القاطعة.

---

## 4. مصفوفة المخاطر التشغيلية وخطط الطوارئ (Risk & Contingency Matrix)

| الخطر التشغيلي | مستوى الأثر | الاحتمالية | خطة الاحتواء والتحييد المسبقة |
| :--- | :---: | :---: | :--- |
| **تعذر الاتصال بـ PostgreSQL محلياً أثناء الاختبار** | حرج (P0) | متوسطة | اشتراط وجود `DATABASE_URL` حقيقي صالح، وإيقاف الاختبار برسالة إرشادية صريحة بدلاً من السقوط الصامت على RAM. |
| **فقدان بيانات أثناء تصحيح أعمدة Drizzle** | عالي | منخفضة | استخدام استعلامات قراءة وكتابة متوافقة لا تحذف أي أعمدة قائمة. |
| **رفض Vercel للالتزامات بعد الرفع** | عالي | منخفضة | تم بالفعل توحيد مؤلف الالتزامات مع بريد noreply المعتمد للمستودع. |
| **حظر نوافذ المتصفح أثناء اختبارات الطباعة** | منخفض | متوسطة | معالج آمن يلتقط حظر النوافذ المنبثقة كما تم إثباته في اختبارات المرحلة 5. |

---

## 5. معيار الجاهزية للإنتاج التام (Definition of Done Checklist)

لا يجوز الإعلان عن اكتمال التعافي النهائي إلا عند تحقق جميع الشروط التالية دون استثناء:

- [ ] اتصال PostgreSQL حقيقي ومفعل ومستقر.
- [ ] متغير `DATABASE_URL` معرف في البيئة المحلية وبيئة Vercel.
- [ ] اختبارات CRUD تنفذ حصرياً ضد PostgreSQL وتتحقق من الأسطر في الجداول.
- [ ] منع السقوط الصامت على memoryStore في كافة مسارات التعديل.
- [ ] استمرار بيانات المساجد والخطباء والتكليفات والإعدادات والقواعد بعد Refresh و Restart.
- [ ] القضاء على النجاح الزائف (عدم إظهار Toast نجاح عند انقطاع الشبكة).
- [ ] حماية كافة مسارات التعديل بميدلوير `requireAuth`.
- [ ] مسارات النظام التدميرية محمية بـ `requireAdmin`.
- [ ] أمر `npm test` يخرج برمز `0` صريح (Exit Code 0).
- [ ] أمر `npx tsc --noEmit` يخرج بـ 0 أخطاء تجميعية.
- [ ] أمر `npm run build` ينجح تماماً.
- [ ] حذف `api/index.js` من Git وتضمينه في `.gitignore`.
- [ ] دفع كافة الالتزامات إلى `origin/main` بنجاح.
- [ ] نشر Vercel ناجح بحالة Ready على أحدث التزام.
- [ ] الفحص الإنتاجي الحي (E2E Smoke Test) ناجح ومثبت بالأدلة.

---
*تم إعداد هذه الخطة وتثبيتها كمرجع تنفيذي نهائي ملزم، ويتوقف التنفيذ الآن بانتظار إشارة البدء المنضبطة.*
