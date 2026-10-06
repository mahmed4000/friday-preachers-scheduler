# التوصيات المعمارية والهندسية للمشروع (Architecture Recommendations)
**المشروع:** منظّم خطباء الجمعة — Friday Preachers Scheduler  
**المستوى المستهدف:** منصة مؤسسية مستقرة وقابلة للتوسع (Enterprise-Grade Production Platform)

---

## 1. المعمارية الهندسية المستهدفة (Target Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 19 SPA)                         │
├────────────────────────────────────────────────────────────────────────┤
│  Presentation Layer:                                                   │
│   ├── Design System UI (Buttons, Badges, Modals, Tables, Forms)        │
│   ├── Feature Modules (Dashboard, Mosques, Imams, Schedules, Reports)  │
│   └── Document Viewers (Official A4 Decree, Mosque Schedule, Cards)    │
│                                                                        │
│  State & Synchronization Layer:                                        │
│   ├── TanStack Query (Server State, Caching, Stale-Time, Invalidation) │
│   ├── Navigation & Theme Context (Pure UI State)                       │
│   └── Centralized Calendar Service (Hijri-First Pure Engine)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / JSON (JWT Protected)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     BACKEND / API LAYER (Node.js)                      │
├────────────────────────────────────────────────────────────────────────┤
│  Express Modular Controllers & Middleware:                             │
│   ├── Auth Guard Middleware (JWT / Role-Based Access Control)          │
│   ├── Domain Routers (/mosques, /imams, /schedules, /rules, /reports)  │
│   ├── Domain Services (SchedulingEngine, CalendarService, ExportService│
│   └── Data Access Layer (Supabase PostgREST / Drizzle ORM Repository)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ TLS / SSL Pool
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER (PostgreSQL Cloud)                    │
├────────────────────────────────────────────────────────────────────────┤
│  Managed PostgreSQL (Supabase / Cloud SQL):                            │
│   ├── Foreign Key Constraints & Cascade Rules                          │
│   ├── Row-Level Security (Strict Policies for Admin/Auditor)          │
│   ├── Performance Indexes on Schedule/Mosque/Imam IDs                  │
│   └── Immutable Audit Trail (Triggers & Audit Logs)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. استراتيجية توحيد إدارة الحالة والبيانات (State Management Strategy)

### 2.1. الاستغناء التام عن التخزين اليدوي في `localStorage`
* **المشكلة الحالية:** تخزين كائنات كاملة في المتصفح تحت مفاتيح مثل `cached_mosques` أدى إلى انفصال العميل عن الخادم وظهور بيانات قديمة.
* **التوصية:** اعتماد **TanStack Query (React Query)** لإدارة البيانات القادمة من الخادم:
  * جلب ذكي مع مؤقت عدم حداثة (`staleTime: 5 * 60 * 1000`).
  * إلغاء الكاش التلقائي (`queryClient.invalidateQueries`) فور نجاح أي تعديل أو حذف.
  * تحديثات واجهة استباقية (Optimistic Updates) مدعومة بإمكانية التراجع التلقائي عند فشل الشبكة.

---

## 3. تفكيك واجهات الخادم واعتماد نمط المستودع (Repository Pattern)

### 3.1. تقسيم `src/server/api.ts` الأحادي الضخم
يتم تقسيم الملف الذي يحوي 4,900 سطر إلى هيكل مجلدات معياري ونظيف:
```
src/server/
├── index.ts                # نقطة تركيب المسارات وإعداد الوسائط العامة
├── middleware/
│   ├── auth.ts             # التحقق الصارم من التوكنات
│   ├── validate.ts         # التحقق من صحة المدخلات (Zod / Schemas)
│   └── errorHandler.ts     # معالج الأخطاء الموحد
└── routes/
    ├── mosques.routes.ts   # إدارة المساجد وأنماط التثبيت
    ├── imams.routes.ts     # إدارة الخطباء والاستثناءات
    ├── schedules.routes.ts # إنشاء الجداول والتعيينات والاعتماد
    ├── rules.routes.ts     # مصفوفة التفضيلات والقواعد
    ├── reports.routes.ts   # التقارير وسجلات التدقيق
    └── export.routes.ts    # تصدير واستيراد ملفات الإكسل
```

---

## 4. استراتيجية التقويم الهجري المعجّل (Optimized Hijri Calendar Engine)

1. **الاستغناء عن حلقة الـ 950 دورة:**
   * بناء جدول مرجعي مصغر (Epoch Lookup Matrix) لبدايات ونهايات شهور أم القرى لـ 10 سنوات هجرية (1445 هـ إلى 1455 هـ).
   * استخراج جمعات الشهر في **أقل من 0.1 مللي ثانية** بدلاً من استدعاء `dtf.formatToParts` 950 مرة.
2. **توحيد حقول الجمعة (`Friday` Schema):**
   * إضافة الحقول الثابتة:
     ```ts
     export interface Friday {
       id: number;
       scheduleId: number;
       fridayIndex: number; // 1..5
       ordinalName: string; // "الجمعة الأولى", "الجمعة الثانية"
       hijriDate: string;   // "1 رمضان 1448 هـ"
       gregorianDate: string;// "2027-02-19"
       dayOfWeek: string;   // "الجمعة"
       periodStatus: 'PAST' | 'CURRENT' | 'FUTURE';
       isPast: boolean;
     }
     ```

---

## 5. مكوّن المستندات الرسمية والطباعة الموحد (Unified Document Engine)

1. **مكوّن `OfficialA4Document`:**
   * مكوّن واجهة موحد يتضمن الترويسة الملكية للجمعية الشرعية، الشعار المتجهي بأبعاد صلبة (60×60 بكسل)، بيانات التاريخين الهجري والميلادي، وجدول التكليفات وخاتم الاعتماد.
2. **فصل الطباعة عن الالتقاط النقطي:**
   * استخدام `@media print` الصريح للطباعة الورقية المباشرة (Ctrl+P / زر الطباعة).
   * إبقاء `jspdf` للتنزيل الرقمي فقط، مع تطبيق أبعاد دقيقة تمنع تجزئة الصفوف.

---

## 6. حزمة أمان متكاملة (Security Hardening Architecture)

1. **إلغاء سياسة السماح العام في Supabase:**
   * استبدال سياسة `Allow scheduler access USING (true)` بسياسات قائمة على المصادقة والأدوار:
     * دور المدير (Super Admin): قراءة وكتابة كاملة.
     * دور المشرف (Scheduler Staff): قراءة وكتابة الجداول والتعيينات.
     * دور القراءة والمطالعة (Auditor / Viewer): قراءة الجداول المعتمدة والمنشورة فقط.
2. **إخفاء المفاتيح الحساسة:**
   * إزالة أي مفاتيح نصية احتياطية من ملفات العميل، والاعتماد الحصري على متغيرات البيئة `VITE_SUPABASE_URL` و `VITE_SUPABASE_ANON_KEY`.

---
*نهاية وثيقة التوصيات المعمارية والهندسية.*
