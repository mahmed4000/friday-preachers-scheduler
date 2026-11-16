import { useMemo, useState } from 'react';
import { Link2, MessageCircle, Plus, Trash2, UserRound } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Preacher, PreacherLevel } from '../data/types.ts';
import { LEVEL_LABEL } from '../data/types.ts';
import { Button, Card, Choice, Empty, Field, Input, LinkButton, Modal, PageTitle, Search, Tag, Textarea, clsx, normalizeAr } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { currentMonth, monthAssignments } from '../data/selectors.ts';
import { fridayOrdinal, monthTitle } from '../lib/hijri.ts';
import { portalUrl, waLink } from '../lib/whatsapp.ts';

const LEVELS: { value: PreacherLevel; label: string }[] = [
  { value: 'senior', label: 'خبرة كبيرة' },
  { value: 'mid', label: 'خبرة متوسطة' },
  { value: 'new', label: 'جديد' },
];

type FormState = Omit<Preacher, 'id' | 'portal_token'> & { id?: number; allFridays: boolean };

function PreacherForm({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const { actions } = useStore();
  const confirm = useConfirm();
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    const { allFridays, ...rest } = f;
    const avail = allFridays || !f.available_fridays || f.available_fridays.length === 5 ? null : [...f.available_fridays].sort();
    const row = await actions.savePreacher({ ...rest, name: f.name.trim(), phone: f.phone.trim(), notes: f.notes.trim(), available_fridays: avail });
    setSaving(false);
    if (row) onClose();
  };

  const remove = async () => {
    if (!f.id) return;
    const ok = await confirm({
      title: 'مسح الخطيب',
      body: <>هيتمسح "{f.name}" وتكليفاته هتفضى. لو هو بس مش متاح الفترة دي، الأفضل تخليه <b>متوقف مؤقتًا</b> بدل المسح.</>,
      confirmText: 'امسح',
      danger: true,
    });
    if (ok) {
      await actions.deletePreacher(f.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? 'تعديل الخطيب' : 'خطيب جديد'}
      footer={
        <>
          {f.id && (
            <Button variant="danger" onClick={remove} className="ml-auto">
              <Trash2 className="w-4 h-4" />
              مسح
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={!f.name.trim() || saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="اسم الخطيب">
          <Input id="preacher-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="مثال: الشيخ أحمد محمد" autoFocus />
        </Field>
        <Field label="رقم الموبايل (واتساب)">
          <Input id="preacher-phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
        </Field>
        <Field label="الخبرة" hint="الخبرة الكبيرة بتتقدم للمساجد الكبيرة، والجديد بيروح المساجد الصغيرة">
          <Choice value={f.level} options={LEVELS} onChange={(v) => set('level', v)} />
        </Field>
        <Field label="أقصى عدد جمعات في الشهر" hint="الخطيب نفسه بيحدده">
          <Choice value={f.max_fridays} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} onChange={(v) => set('max_fridays', v)} />
        </Field>
        <Field label="متاح في">
          <div className="space-y-2">
            <Choice value={f.allFridays ? 'all' : 'some'} options={[{ value: 'all', label: 'كل الجمعات' }, { value: 'some', label: 'جمعات معينة بس' }]} onChange={(v) => set('allFridays', v === 'all')} />
            {!f.allFridays && (
              <Choice multi value={f.available_fridays ?? []} options={[1, 2, 3, 4, 5].map((x) => ({ value: x, label: fridayOrdinal(x) }))} onChange={(v) => set('available_fridays', v)} />
            )}
          </div>
        </Field>
        <Field label="ملاحظات (اختياري)">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!f.is_active} onChange={(e) => set('is_active', !e.target.checked)} className="w-4 h-4 accent-brown-700" />
          متوقف مؤقتًا (مش هيدخل في التوزيع)
        </label>
      </div>
    </Modal>
  );
}

export function PreachersPage() {
  const { data, toast } = useStore();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const month = currentMonth(data.months);
  const loads = useMemo(() => {
    const m = new Map<number, number>();
    if (!month) return m;
    for (const a of monthAssignments(data, month.id)) if (a.preacher_id && a.status !== 'excused') m.set(a.preacher_id, (m.get(a.preacher_id) ?? 0) + 1);
    return m;
  }, [data, month]);

  const list = useMemo(() => {
    const n = normalizeAr(q);
    return [...data.preachers]
      .filter((p) => !n || normalizeAr(p.name).includes(n) || p.phone.includes(q))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'ar'));
  }, [data.preachers, q]);

  const open = (p?: Preacher) =>
    setForm(
      p
        ? { ...p, allFridays: !p.available_fridays || p.available_fridays.length === 0 }
        : { name: '', phone: '', level: 'mid', max_fridays: 2, available_fridays: null, is_active: true, notes: '', allFridays: true }
    );

  const copyLink = async (p: Preacher) => {
    try {
      await navigator.clipboard.writeText(portalUrl(p.portal_token));
      toast(`اتنسخ رابط صفحة ${p.name}`);
    } catch {
      toast('ما قدرتش أنسخ الرابط', 'error');
    }
  };

  return (
    <>
      <PageTitle
        title="الخطباء"
        subtitle={`${data.preachers.filter((p) => p.is_active).length} خطيب متاح للتوزيع${month ? ` · الأرقام لشهر ${monthTitle(month.hijri_year, month.hijri_month)}` : ''}`}
        actions={
          <Button onClick={() => open()}>
            <Plus className="w-4 h-4" />
            خطيب جديد
          </Button>
        }
      />
      <div className="mb-4">
        <Search value={q} onChange={setQ} placeholder="ابحث بالاسم أو الرقم…" />
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty title={q ? 'مفيش خطيب بالاسم ده' : 'لسه مفيش خطباء'} action={!q && <Button onClick={() => open()}><Plus className="w-4 h-4" />ضيف أول خطيب</Button>} />
        </Card>
      ) : (
        <div className="bg-paper border border-sand rounded-xl divide-y divide-sand">
          {list.map((p) => {
            const load = loads.get(p.id) ?? 0;
            return (
              <div key={p.id} className={clsx('flex flex-wrap items-center gap-3 px-4 py-3', !p.is_active && 'opacity-60')}>
                <button onClick={() => open(p)} className="flex items-center gap-3 min-w-0 flex-1 text-right cursor-pointer group">
                  <span className="w-10 h-10 shrink-0 rounded-full bg-brown-100 border border-sand-dark text-brown-700 flex items-center justify-center">
                    <UserRound className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-brown-900 group-hover:text-gold-700 truncate">{p.name}</span>
                    <span className="flex flex-wrap gap-1.5 mt-0.5">
                      <Tag tone={p.level === 'senior' ? 'gold' : 'sand'}>{LEVEL_LABEL[p.level]}</Tag>
                      {p.available_fridays && p.available_fridays.length < 5 && (
                        <Tag>متاح: {p.available_fridays.map((x) => fridayOrdinal(x).replace('الجمعة ', '')).join(' و')}</Tag>
                      )}
                      {!p.is_active && <Tag tone="bad">متوقف</Tag>}
                    </span>
                  </span>
                </button>
                <div className="text-sm text-muted tabular w-24 text-center" title="جمعات الشهر من الحد الأقصى">
                  <span className={clsx('font-bold text-base', load >= p.max_fridays ? 'text-gold-700' : 'text-brown-800')}>{load}</span> من {p.max_fridays}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => copyLink(p)} title="نسخ رابط صفحة الخطيب">
                    <Link2 className="w-4 h-4" />
                    <span className="hidden sm:inline">رابطه</span>
                  </Button>
                  {p.phone && (
                    <LinkButton size="sm" href={waLink(p.phone, `السلام عليكم ورحمة الله يا شيخ ${p.name}`)} title="واتساب">
                      <MessageCircle className="w-4 h-4" />
                    </LinkButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {form && <PreacherForm initial={form} onClose={() => setForm(null)} />}
    </>
  );
}
