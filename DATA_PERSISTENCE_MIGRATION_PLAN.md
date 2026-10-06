# خطة هجرة واستقرار طبقة البيانات (Data Persistence Migration Plan)
**المشروع:** منظّم خطباء الجمعة — Friday Preachers Scheduler  
**الهدف:** الهجرة الحتمية الآمنة من `memoryStore` و `localStorage` إلى PostgreSQL كمصدر حقيقة وحيد

---

## 1. حصر مكونات طبقة البيانات الحالية ومصير كل منها

| المكوّن الحالي | الغرض الحالي | المشاكل والمخاطر | البديل الدائم | معيار الاستبعاد النهائي |
| :--- | :--- | :--- | :--- | :--- |
| `src/server/memoryStore.ts` | محاكاة قاعدة بيانات بالذاكرة وحفظ ملف JSON | يفقد البيانات في Serverless، يستهلك الذاكرة | استعلامات Drizzle ORM المباشرة على PostgreSQL | عدم وجود أي استدعاء لـ `memoryStore` في كامل المشروع |
| `localStorage` | تخزين كاش للبيانات الأساسية في المتصفح | عرض بيانات قديمة وحجب التحديثات الحقيقية | الاستعلام المباشر عبر API مع كاش React Query | اقتصار استخدامه على تفضيلات العرض البسيطة (مثل Dark Mode) |
| `src/services/clientDataService.ts` | سلسلة محاولات بديلة (API -> Supabase -> LocalStorage -> Seed) | تعقيد مسار البيانات وإخفاء أخطاء الاتصال الحقيقية | عميل API قياسي يتعامل مع الخادم حصرياً | توحيد واجهات الاتصال عبر `fetchApi` |
| `src/db/initialSeed.json` | ملف بذور محلي يحاول الخادم الكتابة عليه | تعديل ملفات المستودع أثناء التشغيل وفشل السحابة | استخدامه كبذرة أولية للقراءة فقط عند إنشاء القاعدة | منعه من استقبال أي تعديلات أثناء وقت التشغيل |

---

## 2. مراحل خطة الهجرة خطوة بخطوة (Step-by-Step Migration)

### الخطوة 1: جرد وتوثيق كافة العمليات في `memoryStore.ts`
تحديد كافة الدوال المستخدمة:
* `getMosques`, `getMosqueDetails`, `createMosque`, `updateMosque`, `deleteMosque`, `bulkDeleteMosques`
* `getImams`, `createImam`, `updateImam`, `deleteImam`
* `getRules`, `upsertRule`, `deleteRule`
* `getSchedules`, `createSchedule`, `getScheduleDetails`, `updateAssignment`, `toggleLock`, `swapAssignments`
* `saveFixedPattern`, `getFixedPatterns`

### الخطوة 2: بناء واجهات Drizzle المقابلة لكل عملية في `src/db/`
* التأكد من وجود استعلامات Drizzle مكافئة لكل عملية من العمليات السابقة مع التحقق من المعاملات (Transactions) والمفاتيح الأجنبية.

### الخطوة 3: توجيه مسارات الـ API في `src/server/api.ts` حصرياً نحو قاعدة البيانات
* تعديل كل مسار ليتصل بقاعدة بيانات PostgreSQL مباشرة دون الرجوع لـ `memoryStore`.
* التحقق من إعادة كائن السجل المحدث الحقيقي الصادر من قاعدة البيانات.

### الخطوة 4: تنظيف طبقة العميل في `clientDataService.ts` و `App.tsx`
* إلغاء تخزين `cached_mosques`, `cached_imams`, `cached_rules`, `cached_schedules` في `localStorage`.
* توجيه العميل للقراءة الحصرية من مسارات الخادم المعتمدة.

### الخطوة 5: التحقق الشامل من استبقاء البيانات وحذف `memoryStore.ts`
* إجراء اختبارات الاستبقاء الكاملة عبر دورات (Create → Save → Refresh → Multi-session).
* إزالة ملف `memoryStore.ts` واستبعاده نهائياً من المشروع.

---
*نهاية خطة هجرة واستقرار طبقة البيانات.*
