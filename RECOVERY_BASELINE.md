# خط الأساس الفني الجنائي المحدث (RECOVERY BASELINE)
# FORENSIC TECHNICAL BASELINE — POST-VERIFICATION

**تاريخ التوثيق:** 6 أكتوبر 2026  
**المشروع:** منظّم خطباء الجمعة (Friday Preachers Scheduler)  
**الحالة التشغيلية العامة:**  
- **P0 Persistence:** `NOT PROVEN` (غير مثبت على PostgreSQL)  
- **Production Readiness:** `BLOCKED` (محظور النشر لعدم اكتمال متطلبات الإنتاج الحقيقية)  
- **حالة الاختبارات:** `npm test` يخرج برمز خطأ 1 (انهيار libuv على Windows)

---

## 1. حالة مستودع Git والتزامن البعيد (Git State & Remote Synchronization)

### 1.1. الفرع المحلي والارتباط البعيد
- **الفرع الحالي:** `main`
- **حالة التتبع:** `Your branch is ahead of 'origin/main' by 9 commits.` (الفرع المحلي متقدم بـ 9 التزامات كاملة لم تُدفع إلى المستودع البعيد).
- **المستودع البعيد (Remote Origin):** `https://github.com/mahmed4000/friday-preachers-scheduler`
- **حالة المستودع البعيد (`origin/main`):**  
  يقف عند الالتزام:  
  `bf67845 fix: world-class resilient data architecture with direct Supabase sync and clean cache migration`  
  بواسطة: `Mohamed Ahmed <mahmed4000@gmail.com>`

### 1.2. الالتزامات المحلية الـ 9 غير المرفوعة (Unpushed Commits)
1. `beee89f` docs: update CRUD_VERIFICATION_MATRIX, PHASE_EXECUTION_LOG, and PROJECT_HEALTH_SUMMARY with post-recovery certification
2. `5ea4b9c` fix(audit): wire audit logging across all mutations and implement resilient memory fallback
3. `20c9278` feat(publishing): create OfficialA4Document, harden print CSS, and eliminate external CDN in print export
4. `5aff705` perf(calendar): optimize Hijri month calculation from 950 steps to high-speed targeted window
5. `3a66575` fix(data): recover CRUD persistence, whitelist mutation fields, and eliminate ephemeral fallbacks
6. `07e0cd3` docs(log): record Phase 2 security hardening execution completion
7. `c9c029c` fix(security): harden authentication middleware, protect destructive routes and restrict RLS policies
8. `a9099d6` docs(log): record Phase 1 execution completion
9. `063172c` fix(types): resolve all TypeScript compilation errors and enforce build gate

### 1.3. مؤلف الالتزامات ونزاع Vercel Hobby
- تم تعديل مؤلف الالتزامات محلياً في الالتزامات الـ 9 ليصبح:  
  `mahmed4000 <49865714+mahmed4000@users.noreply.github.com>`
- **الأثر التشغيلي:** بما أن الالتزامات لم تُدفع إلى GitHub، فإن سيرفر Vercel لا يزال يعالج الكود القديم عند الالتزام `bf67845` ببريده القديم المرفوض (`mahmed4000@gmail.com`). Vercel لم يستقبل كود التعافي حتى اللحظة.

### 1.4. مخالفة ارتكاب الحزمة المجمّعة (`api/index.js`)
- تم ارتكاب الملف المجمّع [api/index.js](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/api/index.js) بحجم **6,454,387 بايت (6.45 MB)** داخل مستودع Git في الالتزام `5ea4b9c`.
- ملف [.gitignore](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/.gitignore) لا يحتوي على مسار `api/index.js`.
- شجرة العمل تحتوي على تنبيه اختلاف سطر CRLF في الملف [src/db/initialSeed.json](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/initialSeed.json).

---

## 2. الوضع التشغيلي الحقيقي لقاعدة البيانات (Database & Persistence Reality)

### 2.1. غياب متغيرات البيئة الحقيقية
- لا يوجد ملف `.env` في المشروع. يوجد فقط [.env.example](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/.env.example).
- المتغيرات `DATABASE_URL` و `POSTGRES_URL` و `VERCEL_POSTGRES_URL` **غير موجودة إطلاقاً في بيئة التشغيل**.
- نتيجة كود الفحص في [src/db/index.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/index.ts#L12-L23):
  ```ts
  isDatabaseConfigured === false
  isDatabaseAvailable() === false
  ```

### 2.2. مسار التراجع القسري (Silent Fallback to RAM)
بسبب غياب `DATABASE_URL`، فإن كافة الروابط في [src/server/api.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/server/api.ts) تدخل في هذا الفرع:
```ts
if (!isDatabaseAvailable()) {
  const created = memoryStore.createMosque(req.body);
  return res.status(201).json(created);
}
```
**الأثر الحقيقي:**
- يتم حفظ البيانات فقط في ذاكرة الـ RAM للعملية الجارية (`memoryStore.ts`).
- عند إعادة تشغيل الخادم (Server Restart) أو في دوال Vercel Serverless (التي تخضع لـ Cold Starts متكررة)، **تُمسح كافة البيانات فوراً** وتُسترجع من [src/db/initialSeed.json](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/initialSeed.json).
- هذا هو التفسير العلمي القاطع لشكوى المستخدم المستمرة: *"Entered data does not remain after saving"*.

### 2.3. عدم تطابق مخطط Drizzle مع مخطط SQL الحقيقي
- في [supabase_schema.sql:L167](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/supabase_schema.sql#L167)، جدول `audit_logs` يحتوي على عمود:
  `details JSONB`
- في [src/db/schema.ts:L298](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/schema.ts#L298)، يعرف Drizzle العمود كـ:
  `detailsJson: text('details_json')`
- **الأثر:** استعلامات Drizzle الحقيقية ضد PostgreSQL تفشل بخطأ `column "details_json" does not exist`.

### 2.4. تكوين Drizzle Kit المتناقض
- الملف [src/db/drizzle.config.ts](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/db/drizzle.config.ts) يتطلب متغيرات قديمة لـ Google Cloud SQL:
  `SQL_HOST`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`.
  ولا يدعم `DATABASE_URL` القياسي المعمول به في Vercel و Supabase.

---

## 3. تدقيق مسارات البيانات ومصادر الحقيقة المتنافسة (Split-Brain Architecture)

```
                            [ المتصفح / العميل (React 19 SPA) ]
                                    │                │
            ┌───────────────────────┴────────┐       │ (استعلامات مباشرة وفاشلة)
            ▼                                ▼       ▼
  [ localStorage (كاش محلي) ]       [ Express API ]───► [ Supabase Client ]
            │                                │                   │
            ▼                                ▼                   │
  [ initialSeed.json ] ◄─────────── [ memoryStore.ts ]             │
                                             │                   │
                                             ▼                   │
                                   [ Drizzle ORM / pgPool ]       │
                                             │                   │
                                             ▼                   ▼
                                 [ PostgreSQL Database (غائبة) ]
```

1. **`localStorage`:** يخزن `cached_mosques`, `cached_imams`, `cached_rules`, `cached_schedules`, `sharia_org_settings`. عند تحميل التطبيق في [src/App.tsx:L68-L88](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx#L68-L88)، يتم جلب البيانات الأولية من `localStorage` بدلاً من الخادم، مما يعطي المستخدم وهماً بأن بياناته مستمرة حتى لو لم تُحفظ في الخادم.
2. **`clientDataService.ts`:**
   في السطر 26:
   ```ts
   if (Array.isArray(res) && res.length > 0) { ... }
   ```
   إذا كانت قاعدة البيانات فارغة (`res.length === 0`)، يفترض الكود أن الطلب فشل ويسقط على الكاش القديم أو ملف البذور، مانعاً تفريغ البيانات.
3. **النجاح الزائف (False Success):**
   في [src/App.tsx:L152-L156](file:///c:/Users/mahme/Desktop/preachers/friday-preachers-scheduler/src/App.tsx#L152-L156)، عند فشل الاتصال بالخادم لحفظ إعدادات الجمعية، يلتقط الكود الخطأ ويخزن في `localStorage` ويعرض إشعاراً أخضر:
   `"تم حفظ إعدادات الجمعية محلياً"`!

---

## 4. الحالة الأمنية الحقيقية (Security & Middleware Reality)

| المجال الأمني | الحالة الحقيقية | التقييم الرقابي |
| :--- | :--- | :--- |
| **ميدلوير `requireAdmin`** | مطبق على مسارات `/system/clear-all` و `/system/reset-demo` و `/system/export-seed` | ✅ محمي |
| **ميدلوير `requireAuth`** | **مستورد في السطر 29 من `api.ts` وغير مربوط بأي مسار في النظام بأكمله!** | ❌ **ثغرة أمنية حرجة (High Risk)** |
| **روابط التعديل اليومية (CRUD)** | مسارات الإضافة والتعديل والحذف للمساجد والخطباء والتكليفات مفتوحة للعامة دون توثيق | ❌ **غير محمية** |
| **سياسات Supabase RLS** | معرفة في `supabase_schema.sql` لكن تطبيقها غير مثبت لعدم الاتصال بقاعدة البيانات | ⚠️ غير مثبتة |
| **المفاتيح الحساسة في الكود** | لا توجد مفاتيح صلبة مكشوفة في Git | ✅ نظيف |

---

## 5. حالة الاختبارات والبناء (Test & Build Reality)

### 5.1. فشل أمر `npm test`
- عند تشغيل الأمر الرسمي المعتمد `npm test`:
  ```text
  The command exited with code 1.
  Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
  ```
- **السبب:** استدعاء `process.exit(0)` داخل `tests/crudPersistence.test.ts` أثناء إغلاق خادم Express على نظام Windows يسبب انهياراً في libuv.
- **الأثر:** يفشل الأمر الموحد، ولا يتم تنفيذ اختبار `tests/officialA4Document.test.ts` التابع له في السلسلة.

### 5.2. طبيعة اختبارات الـ CRUD السابقة
- تم تشغيل `tests/crudPersistence.test.ts` بالكامل ضد كائنات JavaScript في ذاكرة الـ RAM (`memoryStore.ts`) وليس ضد PostgreSQL.
- **القيمة الإثباتية:** الاختبار يثبت سلامة واجهات الـ API الشكلية، لكنه **لا يثبت إطلاقاً استمرارية البيانات في PostgreSQL**.

### 5.3. حالة تجميع TypeScript وبناء الإنتاج
- `npx tsc --noEmit`: 0 أخطاء (ناجح تماماً).
- `npm run build`: ناجح تماماً (ينشئ `dist/` ويجمّع `api/index.js`).

---

## 6. جدول مقارنة: المدعى (Claimed) مقابل الواقع المثبت (Proven)

| البند | ما تم ادعاؤه سابقاً (Claimed) | الواقع الحقيقي المثبت جنائياً (Proven) |
| :--- | :--- | :--- |
| **P0 Persistence** | معتمد وناجح في الإنتاج | **غير مثبت (Not Proven)** — تم في ذاكرة RAM فقط |
| **الاختبارات** | 49/49 PASS | **يفشل `npm test` برمز 1** بسبب libuv على Windows |
| **نشر Vercel** | تم حل مشكلة المؤلف والإنتاج يعمل | **محظور (Blocked)** — 9 التزامات محبوسة محلياً وغير مرفوعة |
| **نظافة Git** | شجرة عمل نظيفة | **مخالفة (Violation)** — ارتكاب ملف 6.45MB (`api/index.js`) |
| **الأمان** | تشديد أمني كامل | **خطر أمني (High Risk)** — عمليات CRUD غير محمية بـ `requireAuth` |
| **الإنتاج** | Production Ready | **BLOCKED / NOT READY** |

---
*تم إنشاء وتثبيت خط الأساس هذا كمرجع تشريحي ملزم غير قابل للتحريف قبل البدء في أي خطوة تنفيذية.*
