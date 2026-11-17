import { useState } from 'react';
import { SUPABASE_PROJECT } from '../data/supabaseRepo.ts';
import { Copy, Database, FlaskConical, RefreshCw } from 'lucide-react';
import schemaSql from '../../supabase/01_new_schema.sql?raw';
import { Button, Card, Star8 } from '../ui/kit.tsx';
import { setDemoMode, useStore } from '../data/store.tsx';

/** بتظهر لو جداول البرنامج الجديد لسه ما اتعملتش في Supabase */
export function Setup() {
  const { reload } = useStore();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-dvh bg-brown-900 relative flex items-center justify-center p-4">
      <div className="absolute inset-0 pattern-stars opacity-[0.07]" />
      <div className="relative w-full max-w-2xl space-y-4">
        <div className="text-center text-gold-200">
          <img src="/aljameya-logo.png" alt="" className="w-20 h-20 mx-auto rounded-full ring-2 ring-gold-500 bg-paper object-contain p-1" />
          <h1 className="text-3xl mt-3">تجهيز البرنامج الجديد</h1>
          <p className="text-brown-100/80 text-sm mt-1">خطوة واحدة بتتعمل مرة واحدة بس</p>
        </div>
        <Card title="شغّل ملف الإعداد في Supabase">
          <ol className="space-y-3 text-[15px] list-none">
            {[
              <>افتح مشروع <b dir="ltr">{SUPABASE_PROJECT}</b> على <b>supabase.com</b> (ده المشروع اللي البرنامج متوصل بيه)، ومن القائمة اختار <b>SQL Editor</b>، وبعدين <b>New query</b>.</>,
              <>دوس الزرار اللي تحت علشان تنسخ ملف الإعداد، والزقه في المحرر.</>,
              <>دوس <b>Run</b>. هيظهر في الآخر عدد المساجد والخطباء اللي اتنقلوا من البرنامج القديم.</>,
              <>ارجع هنا ودوس <b>"خلصت، افتح البرنامج"</b>.</>,
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 w-7 h-7 rounded-full bg-brown-800 text-gold-300 flex items-center justify-center text-sm font-bold tabular">{i + 1}</span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted mt-4 flex gap-1.5 items-start">
            <Star8 className="w-3 h-3 text-gold-500 mt-1 shrink-0" />
            الملف بيعمل جداول جديدة بس، والبيانات القديمة بتفضل زي ما هي كنسخة احتياطية. ولو اتشغّل مرتين مش هيكرر حاجة.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Button variant="gold" onClick={copy}>
              <Copy className="w-4 h-4" />
              {copied ? 'اتنسخ ✓' : 'نسخ ملف الإعداد'}
            </Button>
            <Button onClick={() => reload()}>
              <RefreshCw className="w-4 h-4" />
              خلصت، افتح البرنامج
            </Button>
          </div>
        </Card>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3 items-start">
              <FlaskConical className="w-5 h-5 text-gold-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-brown-800">عايز تتفرج الأول؟</div>
                <div className="text-sm text-muted">جرّب البرنامج ببيانات تجريبية محفوظة في المتصفح بس، من غير ما تلمس Supabase.</div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setDemoMode(true);
                location.reload();
              }}
            >
              <Database className="w-4 h-4" />
              جرّب ببيانات تجريبية
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
