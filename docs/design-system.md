# نظام التصميم — Islamic Heritage · Modern Administration

المصدر الوحيد للأنماط: `src/index.css` (الـ tokens) و`src/ui/kit.tsx` (المكونات). الصفحات ما بتكتبش ألوان أو مقاسات خاصة بيها.

## الألوان

| الاسم | القيمة | الاستخدام | اسم Tailwind |
|---|---|---|---|
| Primary Dark | `#24150D` | السايدبار، الهيدر الداكن، اللوحات | `brown-950` / `primary-dark` |
| Primary Brown | `#58351F` | الزرار الأساسي، الاختيار النشط | `brown-800` / `primary` |
| Gold | `#B58A36` | الزرار الذهبي، النجوم، المؤشر النشط | `gold-500` / `gold` |
| Gold Light | `#D7B56D` | الزخارف، الحدود الذهبية | `gold-400` / `gold-light` |
| Parchment | `#F4EBDD` | خلفية الصفحة | `parchment` |
| Warm Beige / Border | `#E5D6BD` | الحدود | `sand` / `border` / `beige` |
| Card | `#FBF8F1` | الكروت والنوافذ | `card` / `paper` |
| Islamic Green / Success | `#365B45` | النجاح، المؤكد، زرار واتساب | `ok` / `green` / `success` |
| Text Primary | `#2C2119` | النص | `ink` |
| Text Secondary | `#76634F` | النص الثانوي | `muted` |
| Error | `#8F3434` | الأخطاء، المعتذر | `bad` / `error` |
| Warning | `#A96B24` | التنبيه، المنتظر | `wait` / `warning` |

الدرجات المشتقة (`brown-50..900`, `gold-200..700`, `*-soft`) خلفيات للحالات بس. أسماء الألوان القديمة متربوطة بالقيم الرسمية، فكل الصفحات أخدت الهوية من مكان واحد.

## الخطوط

- **IBM Plex Sans Arabic** (400/500/600/700): كل الواجهة والجداول والأرقام (`font-sans`, `font-num`).
- **Amiri** (700): عناوين الصفحات، واسم الجمعية، وعناوين الملفات بس (`font-display`).
- الحجم الأساسي 15px، وتباعد الأسطر 1.7.

## المقاسات

- الأزرار: `md` 44px (الافتراضي)، `lg` 48px، `sm` 36px للأوامر الثانوية جوه الصفوف.
- الحقول والقوائم: 44px.
- الكروت: زوايا 14px (`--radius-card`)، والحقول 10px.
- السايدبار 260px (76px لما تتطوى)، والهيدر 76px على الكمبيوتر و64px على الموبايل.
- الظلال: `--shadow-card` خفيف، `--shadow-raised`، `--shadow-overlay` للنوافذ.

## الزخارف

| الكلاس | الوصف | مكانه |
|---|---|---|
| `pattern-girih` | نجوم ثمانية متلاقية | خلفية السايدبار، طرف بطاقة الترحيب، رأس الملف التفصيلي (شفافية 6–10%) |
| `border-band` | شريط تراثي رفيع | أسفل بطاقة الترحيب، أعلى النوافذ، تحت رأس الملف |
| `Star8` / `Star8Outline` | نجمة ثمانية | قبل عناوين الصفحات، الحالات الفاضية |
| قوس المحراب | SVG | التاريخ الهجري في الرئيسية |
| `frame-gold` | إطار ذهبي مزدوج | غلاف التقرير المطبوع |

القاعدة: مفيش زخرفة ورا نصوص أو جداول، والزخرفة في الأطراف بس.

## المكونات (`src/ui/kit.tsx`)

`Button` (primary/gold/outline/ghost/danger/success/whatsapp + loading) · `IconButton` · `LinkButton` · `Card` · `PageTitle` · `SectionTitle` · `Field` (hint/error) · `Input` · `Select` · `Textarea` · `Choice` · `Search` · `FilterBar` · `FilterSelect` · `Modal` · `Drawer` · `StatusPill` (أيقونة + نص) · `Tag` · `Progress` · `Stat` · `Tabs` · `DataTable` + `useTable` (ترتيب، صفحات، كروت على الموبايل) · `Pagination` · `Empty` · `Skeleton` · `useConfirm` (`src/ui/confirm.tsx`) · `Toasts` (`src/layout/Shell.tsx`).

- النوافذ بتقفل بـ Escape، وبتحبس التركيز جواها، وبترجّعه مكانه بعد ما تتقفل.
- الحالات مش معتمدة على اللون لوحده: كل حالة ليها أيقونة ونص.
- التقويم: الشهر الهجري بيتختار من قايمة + أسهم، وبداية الشهر بتتعدل يوم قبل/بعد (مفيش date picker حر، علشان التاريخ الهجري يفضل مضبوط).
