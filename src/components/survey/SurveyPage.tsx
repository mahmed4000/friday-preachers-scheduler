import React, { useEffect, useMemo, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient.ts';

// صفحة مؤقتة: استبيان المستخدم الأساسي عن طريقة توزيع الخطباء.
// الإجابات بتتحفظ في جدول audit_logs في Supabase بالنوع SURVEY_RESPONSE.
// تُحذف الصفحة بعد جمع الإجابات.

type Q =
  | { id: string; type: 'text' | 'long'; label: string; hint?: string }
  | { id: string; type: 'single' | 'multi'; label: string; hint?: string; options: string[]; other?: boolean }
  | { id: string; type: 'grid'; label: string; hint?: string; rows: string[]; cols: string[] };

interface Section {
  title: string;
  why?: string;
  questions: Q[];
}

const SECTIONS: Section[] = [
  {
    title: 'عنك',
    questions: [
      { id: 'name', type: 'text', label: 'اسمك ودورك في الجمعية' },
      { id: 'mosques_count', type: 'text', label: 'عدد المساجد تقريبًا' },
      { id: 'imams_count', type: 'text', label: 'عدد الخطباء تقريبًا' },
      { id: 'current_tool', type: 'multi', label: 'بتعمل الجدول إزاي دلوقتي؟', options: ['ورقة وقلم', 'إكسل', 'البرنامج الحالي', 'في دماغي وبكتب على واتساب'], other: true },
      { id: 'hardest', type: 'long', label: 'إيه أصعب حاجة في توزيع الخطباء كل شهر؟', hint: 'مثال: طلبات المساجد، الاعتذارات في آخر لحظة، إن حد ياخد جمعات أكتر من غيره.' },
    ],
  },
  {
    title: 'الجدول والتاريخ',
    questions: [
      { id: 'period', type: 'single', label: 'الجدول بيتعمل لأي فترة؟', options: ['شهر هجري', 'شهر ميلادي', '3 شهور', 'كل أسبوع'], other: true },
      { id: 'month_start', type: 'single', label: 'بداية الشهر الهجري بتعتمدوا فيها على إيه؟', options: ['تقويم أم القرى', 'إعلان دار الإفتاء المصرية', 'التاريخ الميلادي بس', 'مش فارقة'] },
      { id: 'deadline', type: 'single', label: 'الجدول لازم يكون جاهز قبل أول جمعة بقد إيه؟', options: ['أسبوع', 'أسبوعين', 'شهر', 'مفيش موعد ثابت'] },
    ],
  },
  {
    title: 'المساجد',
    questions: [
      { id: 'fixed_full', type: 'single', label: 'فيه مساجد ليها خطيب ثابت كل الجمعات؟', options: ['أيوه، كتير', 'أيوه، قليل', 'لأ'] },
      { id: 'fixed_partial', type: 'long', label: 'فيه مساجد ليها خطيب ثابت في جزء من الشهر بس؟ اكتب مثال', hint: 'مثال: الشيخ فلان أول جمعتين في مسجد النور، والباقي متغير.' },
      { id: 'mosque_rank', type: 'single', label: 'فيه مساجد أهم من غيرها ومحتاجة خطيب بمستوى معين؟', options: ['أيوه، ودي قاعدة أساسية', 'أحيانًا', 'لأ، كلهم زي بعض'] },
      { id: 'mosque_requests', type: 'single', label: 'المسجد ممكن يطلب خطيب معين أو يرفض خطيب؟', options: ['أيوه، وبلتزم بطلبه', 'أيوه، وبحاول على قد ما أقدر', 'لأ'] },
      { id: 'distance', type: 'single', label: 'قرب المسجد من بيت الخطيب مهم؟', options: ['مهم جدًا', 'مهم شوية', 'مش مهم'] },
    ],
  },
  {
    title: 'الخطباء',
    questions: [
      { id: 'imam_types', type: 'multi', label: 'عندكم أنواع إيه من الخطباء؟', options: ['خطيب متفرغ تابع للجمعية', 'متطوع', 'إمام أوقاف', 'تحت التدريب', 'احتياطي'], other: true },
      { id: 'imam_limits', type: 'single', label: 'كل خطيب ليه عدد جمعات محدد في الشهر؟', options: ['أيوه، حد أدنى وحد أقصى', 'حد أقصى بس', 'لأ، حسب الظروف'] },
      { id: 'repeat_rule', type: 'single', label: 'نفس الخطيب ينفع يخطب في نفس المسجد كام مرة؟', options: ['مفيش مانع', 'مش جمعتين ورا بعض', 'مرة واحدة في الشهر', 'مرة كل شهرين أو أكتر'], other: true },
      { id: 'availability', type: 'single', label: 'الخطيب بيبلغك إنه مش فاضي إمتى غالبًا؟', options: ['قبل ما الجدول يتعمل', 'بعد ما الجدول ينزل', 'قبل الجمعة بيوم أو يومين'] },
      { id: 'imam_level', type: 'single', label: 'الخطباء ليهم مستويات (خبرة، علم، أسلوب) بتأثر في المسجد اللي يروحه؟', options: ['أيوه، وده مهم', 'شوية', 'لأ'] },
    ],
  },
  {
    title: 'الأولويات',
    why: 'لما القواعد تتعارض مع بعض، البرنامج لازم يعرف يقدّم إيه على إيه.',
    questions: [
      {
        id: 'priorities',
        type: 'grid',
        label: 'حدد أهمية كل حاجة لما تعمل الجدول',
        rows: ['ثبات خطيب المسجد', 'العدالة في عدد الجمعات بين الخطباء', 'المسجد يسمع خطباء مختلفين', 'قرب المسجد من الخطيب', 'رغبة المسجد', 'رغبة الخطيب', 'مستوى الخطيب يناسب المسجد'],
        cols: ['أساسي', 'مهم', 'ثانوي', 'مش مهم'],
      },
      { id: 'shortage', type: 'single', label: 'لو الخطباء أقل من المساجد في جمعة، بتعمل إيه؟', options: ['إمام المسجد يخطب', 'الأولوية للمساجد الكبيرة', 'خطيب ياخد جمعة زيادة', 'المسجد يفضل من غير خطيب منكم'], other: true },
      { id: 'payment', type: 'single', label: 'فيه مكافأة أو بدل انتقال للخطيب؟', options: ['أيوه، حسب عدد الجمعات', 'أيوه، حسب المسافة', 'أيوه، مبلغ ثابت', 'لأ'] },
    ],
  },
  {
    title: 'الطوارئ وإرسال الجدول',
    questions: [
      { id: 'late_cancel', type: 'single', label: 'لو خطيب اعتذر قبل الجمعة بيوم، بتعمل إيه؟', options: ['عندي قائمة احتياطي', 'بكلم أي حد فاضي', 'إمام المسجد يخطب'], other: true },
      { id: 'publish', type: 'multi', label: 'الجدول بيوصل للخطباء والمساجد إزاي؟', options: ['واتساب لكل واحد', 'جروب واتساب', 'ورق مطبوع', 'ملف PDF', 'صورة'], other: true },
      { id: 'confirm', type: 'single', label: 'محتاج الخطيب يأكد إنه استلم جمعته؟', options: ['أيوه، ضروري', 'يبقى كويس', 'لأ'] },
      { id: 'reminder', type: 'single', label: 'تذكير للخطيب قبل الجمعة؟', options: ['أيوه، يوم الخميس', 'أيوه، قبلها بأسبوع', 'لأ'] },
    ],
  },
  {
    title: 'البرنامج',
    questions: [
      { id: 'device', type: 'single', label: 'بتستخدم البرنامج أكتر من إيه؟', options: ['الموبايل', 'الكمبيوتر', 'الاتنين'] },
      { id: 'users', type: 'text', label: 'مين هيستخدم البرنامج غيرك؟ وكل واحد هيعمل إيه؟', hint: 'مثال: أنا أعمل الجدول، ورئيس اللجنة يعتمده بس.' },
      { id: 'preacher_access', type: 'single', label: 'الخطيب نفسه يدخل يشوف جدوله ويبلغ باعتذاره؟', options: ['أيوه، هيسهّل كتير', 'مش محتاجين'] },
      { id: 'top3', type: 'long', label: 'أهم 3 حاجات عايزها في البرنامج الجديد' },
      { id: 'notes', type: 'long', label: 'أي ملاحظات تانية' },
    ],
  },
];

const OTHER = '__other';
const DRAFT_KEY = 'survey_draft_v1';
type Answers = Record<string, string | string[]>;

function answersToText(a: Answers): string {
  const lines: string[] = ['استبيان توزيع الخطباء', ''];
  SECTIONS.forEach((s, si) => {
    lines.push(`== ${si + 1}. ${s.title} ==`);
    s.questions.forEach((q) => {
      lines.push(`• ${q.label}`);
      if (q.type === 'grid') {
        q.rows.forEach((r, ri) => lines.push(`  - ${r}: ${(a[`${q.id}.${ri}`] as string) || '—'}`));
      } else {
        const v = a[q.id];
        const other = (a[`${q.id}__other`] as string) || '';
        const fmt = (x: string) => (x === OTHER ? `أخرى: ${other}` : x);
        lines.push(`  ${Array.isArray(v) ? (v.length ? v.map(fmt).join('، ') : '—') : v ? fmt(v) : '—'}`);
      }
    });
    lines.push('');
  });
  return lines.join('\n');
}

// عرض الإجابات اللي وصلت: /survey?results
function SurveyResults() {
  const [rows, setRows] = useState<{ id: number; created_at: string; text: string }[] | null>(null);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  useEffect(() => {
    document.title = 'إجابات الاستبيان';
    const client = getSupabaseClient();
    if (!client) {
      setError('قاعدة البيانات مش متصلة.');
      return;
    }
    client
      .from('audit_logs')
      .select('id, created_at, details')
      .eq('action', 'SURVEY_RESPONSE')
      .order('id', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setRows((data || []).map((r: any) => ({ id: r.id, created_at: r.created_at, text: r.details?.text || JSON.stringify(r.details) })));
      });
  }, []);
  const copy = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
    } catch {}
  };
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <h1 className="text-2xl font-bold font-heading">إجابات الاستبيان</h1>
        {error && <p className="text-rose-700 dark:text-rose-400 text-sm">تعذر تحميل الإجابات: {error}</p>}
        {!error && rows === null && <p className="text-sm text-slate-500">جاري التحميل…</p>}
        {rows && rows.length === 0 && <p className="text-sm text-slate-500">لسه مفيش إجابات وصلت.</p>}
        {rows?.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500 tabular-nums">{new Date(r.created_at).toLocaleString('ar-EG')}</span>
              <button onClick={() => copy(r.id, r.text)} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-800 text-white cursor-pointer">
                {copiedId === r.id ? 'اتنسخت ✓' : 'نسخ الإجابة'}
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{r.text}</pre>
          </div>
        ))}
      </main>
    </div>
  );
}

export function SurveyPage() {
  const showResults = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('results');
  return showResults ? <SurveyResults /> : <SurveyForm />;
}

function SurveyForm() {
  const [answers, setAnswers] = useState<Answers>(() => {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = 'استبيان توزيع الخطباء';
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {}
  }, [answers]);

  const total = useMemo(() => SECTIONS.reduce((n, s) => n + s.questions.length, 0), []);
  const done = useMemo(
    () =>
      SECTIONS.reduce(
        (n, s) =>
          n +
          s.questions.filter((q) => {
            if (q.type === 'grid') return q.rows.some((_, ri) => answers[`${q.id}.${ri}`]);
            const v = answers[q.id];
            return Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim());
          }).length,
        0
      ),
    [answers]
  );

  const set = (k: string, v: string | string[]) => setAnswers((p) => ({ ...p, [k]: v }));
  const toggle = (k: string, opt: string) => {
    const cur = Array.isArray(answers[k]) ? (answers[k] as string[]) : [];
    set(k, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  };

  const submit = async () => {
    setStatus('sending');
    try {
      const client = getSupabaseClient();
      if (!client) throw new Error('no client');
      const name = (answers.name as string) || 'بدون اسم';
      const { error } = await client.from('audit_logs').insert({
        user_email: `survey: ${name}`.slice(0, 200),
        action: 'SURVEY_RESPONSE',
        entity_type: 'SURVEY',
        details: { answers, text: answersToText(answers), submittedAt: new Date().toISOString() },
      });
      if (error) throw error;
      setStatus('sent');
    } catch (e) {
      console.warn('Survey submit failed:', e);
      setStatus('failed');
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answersToText(answers));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(answersToText(answers))}`;

  const chip = (active: boolean) =>
    `inline-flex items-center px-3.5 py-2 rounded-lg border text-sm cursor-pointer transition-colors select-none ${
      active
        ? 'border-emerald-700 bg-emerald-50 text-emerald-900 font-bold dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-500'
        : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-400 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700'
    }`;
  const field =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700';

  if (status === 'sent') {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-2xl">✓</div>
          <h1 className="text-xl font-bold font-heading text-slate-900 dark:text-slate-100">وصلت إجاباتك، شكرًا جزيلًا</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">إجاباتك هتساعدنا نبني البرنامج على طريقتك في التوزيع.</p>
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <button onClick={() => setStatus('idle')} className="px-4 py-2 text-sm font-bold rounded-lg border border-emerald-700 text-emerald-800 dark:text-emerald-200 cursor-pointer">
              تعديل الإجابات
            </button>
            <a href="/" className="px-4 py-2 text-sm font-bold rounded-lg bg-emerald-800 text-white">
              الرجوع للبرنامج
            </a>
          </div>
        </div>
      </div>
    );
  }

  let qNo = 0;
  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      <div className="sticky top-0 z-20 bg-[#043328] text-white shadow">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <a href="/" className="text-xs text-emerald-200 hover:text-white shrink-0">← البرنامج</a>
          <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-emerald-100 shrink-0">
            {done} من {total}
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-40">
        <header className="py-8 space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading leading-snug">استبيان: إزاي بتوزّع الخطباء على المساجد؟</h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            بنطوّر البرنامج، وعايزين نبنيه على طريقتك الحقيقية في التوزيع. الأسئلة بسيطة وأغلبها اختيارات، وبتاخد حوالي 10 دقايق. كل الأسئلة اختيارية، ولو عندك مثال اكتبه.
          </p>
        </header>

        {SECTIONS.map((s, si) => (
          <section key={s.title} className="py-6 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-baseline gap-3 mb-1">
              <span className="text-amber-600 dark:text-amber-400 font-bold tabular-nums">{si + 1}</span>
              <h2 className="text-lg font-bold font-heading">{s.title}</h2>
            </div>
            {s.why && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{s.why}</p>}

            <div className="space-y-6 mt-4">
              {s.questions.map((q) => {
                qNo++;
                return (
                  <div key={q.id}>
                    <label className="block font-semibold mb-1" htmlFor={`sv_${q.id}`}>
                      <span className="text-slate-400 tabular-nums ml-1.5">{qNo}.</span>
                      {q.label}
                    </label>
                    {q.hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{q.hint}</p>}

                    {q.type === 'text' && (
                      <input id={`sv_${q.id}`} type="text" className={field} value={(answers[q.id] as string) || ''} onChange={(e) => set(q.id, e.target.value)} />
                    )}
                    {q.type === 'long' && (
                      <textarea id={`sv_${q.id}`} rows={3} className={field} value={(answers[q.id] as string) || ''} onChange={(e) => set(q.id, e.target.value)} />
                    )}

                    {(q.type === 'single' || q.type === 'multi') && (
                      <>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {[...q.options, ...(q.other ? [OTHER] : [])].map((o) => {
                            const active = q.type === 'single' ? answers[q.id] === o : Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(o);
                            return (
                              <button
                                type="button"
                                key={o}
                                className={chip(active)}
                                aria-pressed={active}
                                onClick={() => (q.type === 'single' ? set(q.id, active ? '' : o) : toggle(q.id, o))}
                              >
                                {o === OTHER ? 'أخرى' : o}
                              </button>
                            );
                          })}
                        </div>
                        {q.type === 'multi' && <p className="text-[11px] text-slate-400 mt-1">ممكن تختار أكتر من اختيار</p>}
                        {q.other &&
                          (q.type === 'single' ? answers[q.id] === OTHER : Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(OTHER)) && (
                            <input
                              type="text"
                              placeholder="اكتبها هنا"
                              className={`${field} mt-2`}
                              value={(answers[`${q.id}__other`] as string) || ''}
                              onChange={(e) => set(`${q.id}__other`, e.target.value)}
                            />
                          )}
                      </>
                    )}

                    {q.type === 'grid' && (
                      <div className="mt-2 space-y-3">
                        {q.rows.map((r, ri) => (
                          <div key={r} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                            <div className="text-sm font-semibold mb-2">{r}</div>
                            <div className="flex flex-wrap gap-2">
                              {q.cols.map((c) => {
                                const k = `${q.id}.${ri}`;
                                const active = answers[k] === c;
                                return (
                                  <button type="button" key={c} className={chip(active)} aria-pressed={active} onClick={() => set(k, active ? '' : c)}>
                                    {c}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-20 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={status === 'sending'}
            className="px-5 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60 cursor-pointer"
          >
            {status === 'sending' ? 'جاري الإرسال…' : 'إرسال الإجابات'}
          </button>
          {status === 'failed' && (
            <>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="px-4 py-2.5 rounded-lg border border-emerald-700 text-emerald-800 dark:text-emerald-200 text-sm font-bold">
                ابعتها على واتساب
              </a>
              <button type="button" onClick={copy} className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-bold cursor-pointer">
                {copied ? 'اتنسخت ✓' : 'نسخ الإجابات'}
              </button>
              <span className="text-xs text-rose-700 dark:text-rose-400 basis-full sm:basis-auto">الإرسال ما نجحش. ابعت الإجابات على واتساب أو انسخها.</span>
            </>
          )}
          {status === 'idle' && <span className="text-xs text-slate-500 dark:text-slate-400">إجاباتك بتتحفظ على جهازك أول بأول.</span>}
        </div>
      </div>
    </div>
  );
}

export default SurveyPage;
