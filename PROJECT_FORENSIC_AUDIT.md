# تقرير التدقيق الفني الشامل والطب الشرعي البرمجي (Full Technical Forensic Audit)
**المشروع:** منظّم خطباء الجمعة — Friday Preachers Scheduler  
**التاريخ والوقت:** أكتوبر 2026  
**الفريق الهندسي:** كبير مهندسي البرمجيات وكبير المعماريين (Senior Staff Engineer / Chief Architect)  
**الحالة التشغيلية:** تدقيق شامل للقراءة والتحليل المعماري دون تعديل تعسفي (Read-Only Audit Phase)

---

## 1. الملخص التنفيذي للتدقيق (Executive Summary)

تم إجراء فحص برمجي ومعماري شرعي عميق (Deep Forensic Audit) لكامل مستودع الشيفرة المصدرية وسجل الالتزامات (Git History) وقواعد البيانات ونظام التقويم وواجهات المستخدم ومسار النشر السحابي لتطبيق **منظّم خطباء الجمعة**.

### الخلاصة الجوهرية (The Core Finding)
يعاني المشروع من **"تعدد طبقات البيانات المتصارعة" (Conflicting Multi-Tier Data Layer)**؛ حيث بدأ المشروع بتصميم موجه لـ Google Cloud SQL (PostgreSQL) مع Drizzle ORM ومصادقة Firebase Auth، ثم واجه تعثراً في النشر على منصة Vercel السحابية، مما دفع إلى استحداث مخزن محلي عابر في الذاكرة (`memoryStore`)، ثم أضيفت سحابة Supabase ومزامنة حية ومخزن متصفح محلي (`localStorage`) وملف بيانات بذرة مجمّد (`initialSeed.json`)، إلى جانب استدعاءات هجينة مباشرة من المتصفح إلى Supabase.

هذا الانشطار المعماري أدى إلى:
1. **تكرار الإصلاحات الترقيعية في نفس الملفات** (23 تعديلاً في `src/server/api.ts` و 20 في `api/index.js` و 15 في `src/App.tsx`).
2. **انعدام الحماية الأمنية وصفرية التوثيق (Zero Auth Enforcement)** عبر كافة واجهات برمجة التطبيقات الـ 69.
3. **تجاوز فحص الأنواع الصارم (TypeScript Errors Suppression)**؛ حيث ينجح بناء `vite build` بتخطي الأخطاء بينما يحتوي المشروع على أكثر من 40 خطأ نوع صريح عند تشغيل `tsc --noEmit`.
4. **تعليق مسار النشر على Vercel** نتيجة عدم تطابق البريد الإلكتروني للمؤلف في Git مع حساب مالك المستودع في بيئة Vercel Hobby.
5. **ازدواجية واختناق منطق التقويم الهجري** وتكرار آلاف العمليات الحسابية في الثانية على معالج المتصفح.

---

## 2. خريطة الجرد الهيكلي للمستودع (Repository Architecture Map)

```
friday-preachers-scheduler/
├── api/                          # خادم Vercel Serverless المجمّع
│   ├── index.js                  # حزمة esbuild مجمعة بحجم 6.5 ميجابايت (ملف تشغيلي مدمج في Git)
│   └── server.ts                 # نقطة الدخول لدوال الخادم السحابية
├── scripts/
│   ├── buildServer.js            # سكربت تجميع Express إلى ESM لـ Vercel
│   ├── exportSeed.ts             # تصدير البيانات إلى initialSeed.json
│   └── testFixedPreacherSystem.ts# اختبارات تكامل مخصصة للخطباء الثابتين
├── src/
│   ├── server/                   # طبقة واجهات الخادم (Express Router)
│   │   ├── api.ts                # ملف موحد ضخم (4,899 سطر / 200 كيلوبايت) يحوي 69 مساراً
│   │   └── memoryStore.ts        # مخزن مؤقت بالذاكرة (1,346 سطر) يحفظ على القرص عند التعديل
│   ├── db/                       # طبقة البيانات و Drizzle ORM
│   │   ├── schema.ts             # مخطط Drizzle Relational (403 أسطر)
│   │   ├── index.ts              # اتصال pg Pool مع معالجة الانقطاع
│   │   ├── seed.ts               # منطق تهيئة قاعدة البيانات بالتقسيمات المصرية
│   │   └── initialSeed.json      # نسخة بيانات مرجعية احتياطية (362 كيلوبايت)
│   ├── services/
│   │   ├── schedulingEngine.ts   # محرك الجدولة الحسابي المعزول (899 سطر - CSP Engine)
│   │   ├── calendar/             # نظام التقويم الهجري والميلادي المركزي (تقويم أم القرى)
│   │   │   ├── calendarProvider.ts
│   │   │   └── calendarService.ts
│   │   ├── location/             # شجرة التقسيم الإداري لمصر والجيزة
│   │   ├── importExportService.ts# معالجة ملفات Excel/CSV وتوفيق الأعمدة
│   │   ├── supabaseDataService.ts# طبقة الربط المباشر مع Supabase
│   │   ├── supabaseSyncService.ts# المزامنة في الخلفية والاشتراك الحي (Realtime)
│   │   └── clientDataService.ts  # جسر العميل المرن (Resilient Fallback: API -> Supabase -> LocalStorage -> Seed)
│   ├── lib/
│   │   ├── supabaseClient.ts     # عميل Supabase مع مفتاح مشفر احتياطي ثابت في الشيفرة
│   │   ├── pdfExport.ts          # تصدير PDF عبر html-to-image و jsPDF
│   │   ├── profileFallbacks.ts   # مولدات الملفات التعريفية عند انقطاع الاتصال
│   │   └── firebase*.ts          # بقايا إعدادات Firebase السابقة
│   ├── components/               # واجهات المستخدم (18 مجلداً فرعياً)
│   └── types/                    # تعريفات TypeScript
```

---

## 3. التدقيق المعماري وتنازع مصادر الحقيقة (Architectural Conflict Audit)

### 3.1. ثلاث طبقات بيانات متصارعة (Three-Tier Data Fracture)
في التطبيق الحالي، توجد أربعة مسارات متزامنة للوصول للبيانات وتحديثها:
1. **مسار الخادم التقليدي:** `Express API -> PostgreSQL (Drizzle)`.
2. **مسار الذاكرة العابرة:** `Express API -> memoryStore (In-Memory Maps)`، وعند أي تعديل يكتب الملف فوراً على القرص في `initialSeed.json` عبر `fs.writeFileSync`.
3. **مسار السحابة المباشر:** `React Component -> clientDataService -> Supabase Client (PostgREST)`.
4. **مسار التخزين المحلي:** `React Component -> localStorage ('cached_mosques', etc.)`.

### الآثار السلبية الجذرية:
* **تخبط الحالات (Stale State & Split-Brain):** عندما يقوم المستخدم بتعديل مسجد أو إضافة قاعدة، قد تنجح العملية في الذاكرة `memoryStore` وتفشل في مزامنة `Supabase`، أو تنجح في `Supabase` ويبقى `localStorage` محتفظاً بالنسخة القديمة.
* **فشل بيئات Serverless:** الاعتماد على `fs.writeFileSync(seedPath, ...)` داخل `memoryStore.ts` يتعارض تماماً مع معمارية Vercel و AWS Lambda؛ حيث تكون أنظمة الملفات للقراءة فقط (`Read-Only Filesystem`) وتفرغ الذاكرة بعد كل دورة تشغيل (Stateless Ephemeral Instances).

---

## 4. تدقيق الأمان والمصادقة والترخيص (Security & Authorization Audit)

| العنصر | التقييم | التصنيف | التفاصيل والسبب الجذري |
| :--- | :---: | :---: | :--- |
| **حماية مسارات الخادم (API Routes)** | **مخترق بالكامل** | **CRITICAL (P0)** | جميع مسارات `src/server/api.ts` البالغ عددها 69 مساراً لا تستخدم `requireAuth`، وتعتمد فقط على `optionalAuth` الذي يتجاهل التحقق إذا لم يتوفر مفتاح Firebase Admin. |
| **إمكانية تدمير البيانات (Data Purge Endpoint)** | **مكشوف للعامة** | **CRITICAL (P0)** | المسار `/api/system/reset-demo` يقوم بتصفير كافة الجداول وإعادة إدخال بيانات أولية دون اشتراط أي توكن أو كلمة مرور. |
| **سياسات الأمان في Supabase (RLS)** | **معطلة منطقياً** | **CRITICAL (P0)** | ملف `supabase_schema.sql` يُفعّل RLS ولكنه يمنح سياسة: `CREATE POLICY "Allow scheduler access" FOR ALL USING (true) WITH CHECK (true)` مما يسمح لأي مستخدم يملك الـ anon key بالقراءة والكتابة والحذف المباشر. |
| **مفاتيح الاعتماد الثابتة (Hardcoded Keys)** | **مكشوفة في العميل** | **HIGH (P1)** | يحتوي `src/lib/supabaseClient.ts` على عنوان URL ومفتاح JWT anon احتياطي مكتوبين نصياً داخل الشيفرة. |
| **تصدير واستيراد البيانات** | **انعدام فحص الصلاحيات** | **HIGH (P1)** | يمكن لأي زائر رفع ملفات إكسل أو سحب كامل قاعدة بيانات المساجد والخطباء وأرقام هواتفهم عبر `/api/import-export/import`. |

---

## 5. تدقيق جودة الشيفرة ونظام الأنواع (Code Quality & TypeScript Audit)

### 5.1. فشل التحقق البرمجي الصارم (`tsc --noEmit`)
عند تشغيل الفاحص البرمجي للأنواع، يسجل المشروع **41 خطأ تجميعياً صريحاً** تم إخفاؤها لأن سكربت `npm run build` يعتمد على `vite build` الذي يتجاهل Type-checking:

1. **تناقض بنية `Friday`:**
   * الحقل `ordinalName` يُستدعى في `DashboardView.tsx:1185` و `OfficialDecreeModal.tsx:143` و `PreacherMobileCardModal.tsx:358` و `KhutbahTopicsModal.tsx:120` رغم أنه غير موجود في واجهة `Friday` المعرفة في `types/index.ts`.
2. **استيراد أنواع وهمية:**
   * في `src/components/imams/ImamsView.tsx:15` يتم استيراد `MonthlyScheduleData` غير المصدرة من `types/index.ts`.
3. **عدم تطابق أنواع `AssignmentSource`:**
   * في `ImamProfileView.tsx:1266` يُمرر حقل `source` كنص عام `string` بينما تتوقع الواجهة نوع التعداد الصارم `AssignmentSource`.
4. **تضارب مخطط Drizzle مع استعلامات الخادم:**
   * في `src/server/api.ts:765` و `1926` يتم الاستعلام عن خاصية `periodStatus` من جدول `monthlySchedules`، في حين أن هذا الحقل موجود في جدول `fridays` فقط داخل Drizzle Schema.
5. **تضارب نوع نمط التثبيت:**
   * في `src/services/clientDataService.ts:47` يتم تعيين `fixedPattern: "ALL" | undefined` وهو ما يرفضه نوع `FixedPattern` الصارم.

---

## 6. تدقيق نظام التقويم والمواقيت الهجرية (Calendar & Date Logic Audit)

### 6.1. كفاءة الحساب الفلكي والتحويل
* يعتمد `UmmAlQuraCalendarProvider` على واجهة المتصفح المعيارية `Intl.DateTimeFormat` مع إضافة التحديد `u-ca-islamic-umalqura-nu-latn`.
* **العيب الأدائي الجذري:** تقوم الدالة `getHijriMonthInfo` بتشغيل حلقة مسح تصل إلى **950 خطوة يومية** وتستدعي `dtf.formatToParts()` في كل دورة لتحديد حدود الشهر الهجري وبدايته ونهايته.
* هذا يسبب تجميداً مؤقتاً للواجهة (UI Freezing / Latency) عند التبديل السريع بين الشهور أو حساب جداول متعددة، مما استدعى وضع ترقيعات لاحقة مثل مؤقت الأمان `safety timeout` في `App.tsx`.

### 6.2. المنطقة الزمنية
* تم ضبط المنطقة الزمنية افتراضياً على `Africa/Cairo` مع وجود مراجع سابقة لـ `Asia/Riyadh` في جداول Supabase.
* لا يوجد توحيد كامل لاختلاف التوقيت الصيفي/الشتوي بين الخادم ومتصفح العميل، مما قد يسبب خطأ اليوم الواحد (Off-by-one day) عند عبور منتصف الليل بالتوقيت العالمي UTC.

---

## 7. تدقيق الطباعة وتوليد مستندات PDF (Printing & PDF Export Audit)

### 7.1. الأسباب الجذرية للمشاكل المتكررة
1. **تضخم الشعار (Huge Logo Bug):**
   * يعود سببه إلى تصدير الشعارات بصيغة SVG مضمنة عبر Base64، والتي تفقد أبعاد العرض والارتفاع الثابتة داخل حاويات `html-to-image` العائمة.
   * تم علاجه مسبقاً بترقيع CSS غير مستقر (`.print-logo-box { width: 60px !important }`)، والذي يفشل فوراً عند استخدام أي مكوّن طباعة جديد لا يلتزم بذات أسماء الكلاسات.
2. **فقدان الهوامش وتقطيع الجداول (Broken Page Margins & Table Overflow):**
   * محرك `pdfExport.ts` يقوم بإزالة `overflow` و `max-height` ديناميكياً من كافة عناصر DOM لتحويل الشاشة إلى صورة عريضة. ينتج عن ذلك تمزق الصفوف عبر صفحات A4 وانقسام النصوص العربية رأسياً.
3. **عدم مطابقة الترتيب الزمني:**
   * كانت جداول الخطباء تطبع بترتيب عشوائي أو حسب كود المسجد، وقد تم إدخال فرز حتمي مخصص في `ImamProfileView.tsx`، إلا أن منطق الفرز هذا مكرر في 4 ملفات مختلفة بدلاً من كونه دالة موحدة في `CalendarService`.

---

## 8. تدقيق واجهة وتجربة المستخدم وتوافق الهواتف (UI/UX & Mobile Audit)

1. **غياب نظام عناصر أساسي موحد (Component Design System Absence):**
   * لا يوجد مجلد موحد للمدخلات والأزرار والمودالات؛ فمكونات الحوارات (`Modal`, `Drawer`) مكررة بنسخ مختلفة في كل مجلد وظيفي.
2. **تضخم المكونات (Component Bloat):**
   * تجاوزت الملفات الرئيسية حاجز الـ 1,200 سطر لكل ملف، مثل:
     * `DashboardView.tsx`: 1,384 سطر.
     * `MosqueProfileModal.tsx`: 1,441 سطر.
     * `ImamProfileView.tsx`: 1,296 سطر.
     * `ScheduleReviewBoard.tsx`: 1,194 سطر.
   * هذا التضخم يجعل إدارة دورة حياة React وإعادة التصيير (Re-renders) عصية على التتبع بدون أدوات قياس متخصصة.
3. **عزل حالات النماذج والمودالات:**
   * تم رصد مشاكل سابقة في إغلاق المودالات تلقائياً أو إعادة تحميل الصفحة وفقدان مدخلات المستخدم، وتم ترقيعها بتأجيل المزامنة الحية عند فتح المودال في `App.tsx:394`.

---

## 9. تدقيق محرك الجدولة والمنطق الرياضي (Scheduling Engine Audit)

* **التقييم:** **ممتاز ومستقر برمجياً (High Engineering Standard).**
* الفئة `SchedulingEngine` مبنية وفق مبادئ الفئات النقية المعزولة (Pure Domain Service):
  * حتمية تامة خاضعة للـ Seed.
  * احترام تام للقيود الصارمة (Hard Constraints): منع التعارض المزدوج، احترام أيام عدم التوفر، استبعاد الخطباء الممنوعين.
  * دعم كامل لأنماط التثبيت المتطورة (`ALL`, `FIRST_N`, `LAST_N`, `ANY_N`, `SPECIFIC_FRIDAYS`).
  * دعم توزيع الأحمال وتجنب التكرار في نفس المسجد لجمعات متتالية (Rotation Smoothing).
* **نقطة التحسين الوحيدة:** فصل واجهات الإدخال والإخراج الخاصة بالمحرك في ملف مستقل عن ملف الخوارزمية الرياضية لتقليل حجم الملف (`34 كيلوبايت`).

---

## 10. تدقيق مسار النشر السحابي و Vercel (Deployment & CI/CD Audit)

### 10.1. فك لغز حظر النشر على Vercel (The Vercel Contributing Access Blocker)
**نص الرسالة:**
> "The deployment was blocked because the commit author did not have contributing access to the project on Vercel. The Hobby Plan does not support collaboration for private repositories. Please upgrade to Pro to add team members."

**التحليل الفني للسبب الجذري:**
1. التزامات المشروع الأولى تم إنشاؤها عبر البريد المشفر التلقائي لـ GitHub:  
   `mahmed4000 <49865714+mahmed4000@users.noreply.github.com>`.
2. بعد ذلك، تم ضبط إعدادات Git المحلية على:  
   `user.name = Mohamed Ahmed`  
   `user.email = mahmed4000@gmail.com`.
3. حساب Vercel مرتبط بحساب GitHub `mahmed4000`. عندما يستقبل Vercel الـ Webhook الخاص بالالتزام، يبحث عن البريد `mahmed4000@gmail.com`.
4. إذا لم يكن البريد `mahmed4000@gmail.com` مسجلاً ومؤكداً كبريد معتمد داخل حساب GitHub (أو إذا كان مستودع GitHub خاصاً وخطة Vercel هي Hobby Plan)، فإن Vercel يعتبر مرسل الالتزام "عضواً مساهماً إضافياً خارجياً" (External Collaborator).
5. وبما أن خطة Hobby تمنع التعاون الجماعي في المستودعات الخاصة، فإن نظام Vercel يوقف النشر تلقائياً مطالباً بالترقية لخطة Pro.
6. **الحل الهندسي دون ترقية:**
   * إما إضافة البريد `mahmed4000@gmail.com` وتأكيده داخل إعدادات البريد في GitHub: `https://github.com/settings/emails`.
   * أو ضبط البريد المحلي في المستودع ليتطابق مع بريد الحساب الأساسي:  
     `git config user.email "49865714+mahmed4000@users.noreply.github.com"`.

---

## 11. تدقيق الاختبارات وضمان الجودة (Testing & QA Audit)

### 11.1. الوضع الحالي
* يحتوي مجلد `tests/` على 11 ملف اختبار وحدة وتكامل.
* الاختبارات الحسابية لمحرك الجدولة والتقويم تعمل بكفاءة عالية (نجاح 100% في اختبارات CSP واختبارات التقويم الـ 17).
* **الثغرات الحرجة في الاختبارات:**
  1. لا توجد أي اختبارات حقيقية لواجهات المستخدم (No Component / E2E Tests - Vitest / Playwright).
  2. لا توجد اختبارات تحقق من صحة تجميع الأنواع (`tsc --noEmit`).
  3. لا توجد اختبارات تتحقق من صلاحيات الأمان ومسارات الخادم المحمية (Zero API Auth Testing).
  4. اختبارات التصدير تفشل بسبب غياب ربط مكتبة `xlsx` مع أدوات الاختبار بدون تثبيت الحزم.

---
*نهاية وثيقة التدقيق الشرعي الفني الشامل.*
