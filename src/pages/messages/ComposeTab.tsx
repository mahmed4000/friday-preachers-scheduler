// رسالة مخصصة: اختيار المستلمين، كتابة الرسالة بمتغيرات، معاينة، ومراجعة قبل الإرسال الجماعي.
// الإرسال نفسه بيتم من واتساب (رابط wa.me لكل مستلم)، زي باقي الرسائل. مفيش مزود إرسال جديد.
import { useMemo, useState } from 'react';
import { ArrowRight, Eye, ListChecks, Users } from 'lucide-react';
import { useStore } from '../../data/store.tsx';
import type { AppData, Month, Preacher } from '../../data/types.ts';
import { Button, Choice, Empty, Field, Search, Tag, Textarea, clsx, normalizeAr } from '../../ui/kit.tsx';
import { byId, fridaysOf, monthAssignments, nextFriday } from '../../data/selectors.ts';
import { fridayOrdinal, gregShort, monthTitle, todayIso } from '../../lib/hijri.ts';
import { isValidPhone, portalUrl } from '../../lib/whatsapp.ts';
import { SendActions } from '../../components/SendActions.tsx';

const VARS: { key: string; label: string }[] = [
  { key: '{الاسم}', label: 'اسم الخطيب' },
  { key: '{جمعاته}', label: 'جمعاته في الشهر' },
  { key: '{الرابط}', label: 'رابط صفحته' },
  { key: '{المسؤول}', label: 'اسم المسؤول' },
  { key: '{الجمعية}', label: 'اسم الجمعية' },
];

type Audience = 'month' | 'next' | 'active' | 'custom';

function fill(tpl: string, data: AppData, month: Month | null, p: Preacher): string {
  let jamaat = '—';
  if (month) {
    const mosques = byId(data.mosques);
    const fr = fridaysOf(month);
    const mine = monthAssignments(data, month.id)
      .filter((a) => a.preacher_id === p.id && a.status !== 'excused')
      .sort((a, b) => a.friday_index - b.friday_index)
      .map((a) => `${fridayOrdinal(a.friday_index)} (${gregShort(fr.find((f) => f.index === a.friday_index)?.date ?? month.start_date)}): ${mosques.get(a.mosque_id)?.name ?? ''}`);
    if (mine.length) jamaat = mine.join('\n');
  }
  return tpl
    .replaceAll('{الاسم}', p.name)
    .replaceAll('{جمعاته}', jamaat)
    .replaceAll('{الرابط}', portalUrl(p.portal_token))
    .replaceAll('{المسؤول}', data.settings.admin_name || 'مسؤول الدعوة')
    .replaceAll('{الجمعية}', data.settings.org_name || 'الجمعية الشرعية');
}

export function ComposeTab({ data, month }: { data: AppData; month: Month | null }) {
  const { actions } = useStore();
  const [audience, setAudience] = useState<Audience>(month ? 'month' : 'active');
  const [picked, setPicked] = useState<number[]>([]);
  const [q, setQ] = useState('');
  const [tpl, setTpl] = useState('السلام عليكم ورحمة الله وبركاته\nفضيلة الشيخ {الاسم}،\n\n\n\nمع خالص التقدير،\n{المسؤول}\n{الجمعية}');
  const [step, setStep] = useState<'write' | 'review'>('write');
  const [sent, setSent] = useState<Set<number>>(new Set());

  const recipients = useMemo(() => {
    const active = data.preachers.filter((p) => p.is_active);
    if (audience === 'active') return active;
    if (audience === 'custom') return data.preachers.filter((p) => picked.includes(p.id));
    if (audience === 'month' && month) {
      const ids = new Set(monthAssignments(data, month.id).filter((a) => a.preacher_id && a.status !== 'excused').map((a) => a.preacher_id));
      return data.preachers.filter((p) => ids.has(p.id));
    }
    if (audience === 'next') {
      const nx = nextFriday(data.months, todayIso());
      if (!nx) return [];
      const ids = new Set(monthAssignments(data, nx.month.id).filter((a) => a.friday_index === nx.friday.index && a.preacher_id && a.status !== 'excused').map((a) => a.preacher_id));
      return data.preachers.filter((p) => ids.has(p.id));
    }
    return [];
  }, [audience, picked, data, month]);
  const sorted = [...recipients].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const noPhone = sorted.filter((p) => !isValidPhone(p.phone)).length;
  const sample = sorted[0];
  const insert = (v: string) => setTpl((t) => `${t}${t.endsWith('\n') || !t ? '' : ' '}${v}`);
  const blank = !tpl.replace(/\{[^}]+\}/g, '').trim();

  if (step === 'review') {
    return (
      <div>
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-brown-50">
          <span className="text-sm">
            مراجعة قبل الإرسال: <b className="tabular">{sorted.length}</b> مستلم · اتبعت <b className="tabular text-ok">{sent.size}</b>
            {noPhone > 0 && <span className="text-bad"> · {noPhone} من غير رقم</span>}
          </span>
          <Button size="sm" variant="outline" onClick={() => setStep('write')}><ArrowRight className="w-4 h-4" />رجوع للتعديل</Button>
        </div>
        <p className="px-4 py-2.5 text-[12.5px] text-muted border-b border-border">كل زرار بيفتح واتساب بالرسالة جاهزة للشخص ده، وانت اللي بتدوس إرسال. اللي اتبعتله بيتعلّم علشان ما تكررش.</p>
        <ul className="divide-y divide-border">
          {sorted.map((p) => {
            const text = fill(tpl, data, month, p);
            const done = sent.has(p.id);
            return (
              <li key={p.id} className={clsx('px-4 py-3 flex flex-col lg:flex-row lg:items-start gap-3', done && 'bg-ok-soft/40')}>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">{p.name}{done && <Tag tone="ok">اتبعت</Tag>}</div>
                  <pre className="mt-1 text-[12.5px] text-muted whitespace-pre-wrap font-sans line-clamp-3">{text}</pre>
                </div>
                <SendActions
                  phone={p.phone}
                  sent={done}
                  message={() => text}
                  onSent={() => {
                    setSent((s) => new Set(s).add(p.id));
                    actions.log(month?.id ?? null, p.id, 'message_sent', `رسالة مخصصة: ${text.split('\n').find((l) => l.trim() && !l.includes('السلام')) ?? ''}`.slice(0, 200));
                  }}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  const searchList = data.preachers.filter((p) => !q || normalizeAr(p.name).includes(normalizeAr(q))).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return (
    <div className="grid lg:grid-cols-2 gap-0 lg:divide-x lg:divide-x-reverse divide-border">
      <div className="p-4 sm:p-5 space-y-5">
        <Field label="المستلمين">
          <Choice
            size="sm"
            value={audience}
            onChange={setAudience}
            options={[
              ...(month ? [{ value: 'month' as const, label: `خطباء ${monthTitle(month.hijri_year, month.hijri_month)}` }] : []),
              { value: 'next' as const, label: 'خطباء الجمعة الجاية' },
              { value: 'active' as const, label: 'كل الخطباء النشطين' },
              { value: 'custom' as const, label: 'اختيار يدوي' },
            ]}
          />
        </Field>
        {audience === 'custom' && (
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="p-2 border-b border-border flex items-center gap-2">
              <Search value={q} onChange={setQ} placeholder="ابحث باسم الخطيب…" className="sm:max-w-none" />
              <Button size="sm" variant="ghost" onClick={() => setPicked(picked.length ? [] : searchList.map((p) => p.id))}>{picked.length ? 'شيل الكل' : 'اختار الكل'}</Button>
            </div>
            <ul className="max-h-56 overflow-y-auto scroll-soft divide-y divide-border">
              {searchList.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-3 px-3 h-11 text-sm cursor-pointer hover:bg-brown-50">
                    <input type="checkbox" className="w-4 h-4 accent-brown-800" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))} />
                    <span className="flex-1">{p.name}</span>
                    {!p.is_active && <Tag tone="bad">متوقف</Tag>}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="text-[13px] text-muted flex items-center gap-2">
          <Users className="w-4 h-4" />
          <b className="text-ink tabular">{sorted.length}</b> مستلم{noPhone > 0 && <span className="text-bad"> · {noPhone} من غير رقم واتساب صحيح</span>}
        </div>
        <Field label="نص الرسالة" hint="دوس على متغير يتضاف في آخر النص، وبيتبدل ببيانات كل خطيب.">
          <Textarea rows={9} value={tpl} onChange={(e) => setTpl(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {VARS.map((v) => (
            <button key={v.key} type="button" onClick={() => insert(v.key)} className="h-8 px-2.5 rounded-lg border border-gold-400/50 bg-gold-200/40 text-[12.5px] text-gold-700 hover:bg-gold-200 cursor-pointer" title={v.label}>
              {v.key} <span className="text-muted">· {v.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="p-4 sm:p-5 bg-paper/60 border-t lg:border-t-0 border-border flex flex-col">
        <div className="text-[13px] font-medium mb-2 flex items-center gap-2"><Eye className="w-4 h-4 text-gold-600" />معاينة{sample && <span className="text-muted font-normal">: {sample.name}</span>}</div>
        {sample ? (
          <div className="flex-1 rounded-2xl bg-[#efe7da] p-4 border border-border">
            <div className="max-w-[92%] mr-auto bg-white rounded-xl rounded-tl-sm px-3.5 py-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.08)]">
              <pre className="whitespace-pre-wrap font-sans text-[14px] leading-relaxed text-ink">{fill(tpl, data, month, sample)}</pre>
            </div>
          </div>
        ) : (
          <Empty title="مفيش مستلمين" icon={Users}>اختار مجموعة فيها خطباء.</Empty>
        )}
        <Button className="mt-4 w-full" onClick={() => { setSent(new Set()); setStep('review'); }} disabled={!sorted.length || blank}>
          <ListChecks className="w-4 h-4" />
          راجع قبل الإرسال ({sorted.length})
        </Button>
      </div>
    </div>
  );
}
