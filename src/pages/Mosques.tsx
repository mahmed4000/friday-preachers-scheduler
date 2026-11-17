import { useMemo, useState } from 'react';
import { Landmark, Phone, Plus, Trash2, X } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Mosque, MosqueSize } from '../data/types.ts';
import { SIZE_LABEL } from '../data/types.ts';
import { Button, Card, Choice, Empty, Field, Input, Modal, PageTitle, Search, Select, Tag, Textarea, normalizeAr } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { fridayOrdinal } from '../lib/hijri.ts';

const FRIDAYS = [1, 2, 3, 4, 5];
const SIZES: { value: MosqueSize; label: string }[] = [
  { value: 'large', label: 'كبير' },
  { value: 'medium', label: 'متوسط' },
  { value: 'small', label: 'صغير' },
];

type FixedMode = 'none' | 'all' | 'some';

interface FormState {
  id?: number;
  name: string;
  size: MosqueSize;
  phone: string;
  contact_name: string;
  allFridays: boolean;
  needed: number[];
  is_active: boolean;
  notes: string;
  fixedMode: FixedMode;
  fixedAll: number | '';
  fixedBy: Record<number, number | ''>;
  prefer: number[];
  avoid: number[];
}

function emptyForm(): FormState {
  return {
    name: '', size: 'medium', phone: '', contact_name: '', allFridays: true, needed: [1, 2, 3, 4, 5], is_active: true, notes: '',
    fixedMode: 'none', fixedAll: '', fixedBy: {}, prefer: [], avoid: [],
  };
}

export function fridaysText(needed: number[] | null): string {
  if (!needed || needed.length === 0 || needed.length === 5) return 'كل الجمعات';
  return needed.map((f) => fridayOrdinal(f).replace('الجمعة ', '')).join(' و');
}

function PreacherChips({ ids, onChange, exclude, placeholder }: { ids: number[]; onChange: (ids: number[]) => void; exclude: number[]; placeholder: string }) {
  const { data } = useStore();
  const name = (id: number) => data.preachers.find((p) => p.id === id)?.name ?? '—';
  const options = data.preachers.filter((p) => !ids.includes(p.id) && !exclude.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  return (
    <div className="space-y-2">
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 pr-2.5 pl-1 py-1 rounded-lg bg-brown-100 border border-sand-dark text-sm">
              {name(id)}
              <button type="button" onClick={() => onChange(ids.filter((x) => x !== id))} className="p-0.5 rounded hover:bg-sand cursor-pointer" aria-label={`شيل ${name(id)}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select value="" onChange={(e) => e.target.value && onChange([...ids, Number(e.target.value)])}>
        <option value="">{placeholder}</option>
        {options.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>
    </div>
  );
}

function MosqueForm({ initial, onClose }: { initial: FormState; onClose: () => void }) {
  const { data, actions } = useStore();
  const confirm = useConfirm();
  const [f, setF] = useState<FormState>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const preachers = [...data.preachers].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const neededList = f.allFridays ? FRIDAYS : f.needed;

  const save = async () => {
    if (!f.name.trim()) return;
    setSaving(true);
    const fixed =
      f.fixedMode === 'all' && f.fixedAll
        ? [{ preacher_id: Number(f.fixedAll), friday_index: null }]
        : f.fixedMode === 'some'
          ? Object.entries(f.fixedBy)
              .filter(([fi, pid]) => pid && neededList.includes(Number(fi)))
              .map(([fi, pid]) => ({ preacher_id: Number(pid), friday_index: Number(fi) }))
          : [];
    const prefs = [
      ...f.prefer.map((id) => ({ preacher_id: id, kind: 'prefer' as const })),
      ...f.avoid.map((id) => ({ preacher_id: id, kind: 'avoid' as const })),
    ];
    const row = await actions.saveMosque(
      {
        ...(f.id ? { id: f.id } : {}),
        name: f.name.trim(),
        size: f.size,
        phone: f.phone.trim(),
        contact_name: f.contact_name.trim(),
        needed_fridays: f.allFridays || f.needed.length === 5 ? null : [...f.needed].sort(),
        is_active: f.is_active,
        notes: f.notes.trim(),
      },
      fixed,
      prefs
    );
    setSaving(false);
    if (row) onClose();
  };

  const remove = async () => {
    if (!f.id) return;
    const ok = await confirm({ title: 'مسح المسجد', body: `هيتمسح "${f.name}" وكل تكليفاته في الجداول. متأكد؟`, confirmText: 'امسح', danger: true });
    if (ok) {
      await actions.deleteMosque(f.id);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={f.id ? 'تعديل المسجد' : 'مسجد جديد'}
      wide
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
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="اسم المسجد" className="sm:col-span-2">
          <Input id="mosque-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="مثال: مسجد النور" autoFocus />
        </Field>
        <Field label="حجم المسجد" hint="الخطيب الجديد ما بيروحش المسجد الكبير">
          <Choice value={f.size} options={SIZES} onChange={(v) => set('size', v)} />
        </Field>
        <Field label="تليفون المسجد (اختياري)">
          <Input id="mosque-phone" value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
        </Field>
        <Field label="المسجد محتاج خطيب منكم في" className="sm:col-span-2">
          <div className="space-y-2">
            <Choice value={f.allFridays ? 'all' : 'some'} options={[{ value: 'all', label: 'كل الجمعات' }, { value: 'some', label: 'جمعات معينة بس' }]} onChange={(v) => set('allFridays', v === 'all')} />
            {!f.allFridays && (
              <Choice multi value={f.needed} options={FRIDAYS.map((x) => ({ value: x, label: fridayOrdinal(x) }))} onChange={(v) => set('needed', v)} />
            )}
          </div>
        </Field>

        <div className="sm:col-span-2 border-t border-sand pt-4">
          <Field label="الخطيب الثابت">
            <Choice
              value={f.fixedMode}
              options={[
                { value: 'none', label: 'مفيش' },
                { value: 'all', label: 'نفس الخطيب كل الجمعات' },
                { value: 'some', label: 'خطيب لجمعات معينة' },
              ]}
              onChange={(v) => set('fixedMode', v)}
            />
          </Field>
          {f.fixedMode === 'all' && (
            <Select className="mt-2" value={f.fixedAll} onChange={(e) => set('fixedAll', e.target.value ? Number(e.target.value) : '')}>
              <option value="">اختار الخطيب</option>
              {preachers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
          {f.fixedMode === 'some' && (
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {neededList.map((fi) => (
                <label key={fi} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 text-sm text-brown-700">{fridayOrdinal(fi)}</span>
                  <Select value={f.fixedBy[fi] ?? ''} onChange={(e) => set('fixedBy', { ...f.fixedBy, [fi]: e.target.value ? Number(e.target.value) : '' })}>
                    <option value="">متغير (توزيع تلقائي)</option>
                    {preachers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label="خطباء المسجد طالبهم" hint="بيتقدموا في الترتيب على قد ما نقدر">
          <PreacherChips ids={f.prefer} onChange={(v) => set('prefer', v)} exclude={f.avoid} placeholder="ضيف خطيب…" />
        </Field>
        <Field label="خطباء المسجد رافضهم" hint="ما بيتحطوش في المسجد ده خالص">
          <PreacherChips ids={f.avoid} onChange={(v) => set('avoid', v)} exclude={f.prefer} placeholder="ضيف خطيب…" />
        </Field>

        <Field label="ملاحظات (اختياري)" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2 cursor-pointer">
          <input type="checkbox" checked={!f.is_active} onChange={(e) => set('is_active', !e.target.checked)} className="w-4 h-4 accent-brown-700" />
          المسجد متوقف مؤقتًا (مش هيدخل في التوزيع)
        </label>
      </div>
    </Modal>
  );
}

export function MosquesPage() {
  const { data } = useStore();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const pname = (id: number) => data.preachers.find((p) => p.id === id)?.name ?? '—';

  const list = useMemo(() => {
    const n = normalizeAr(q);
    return [...data.mosques]
      .filter((m) => !n || normalizeAr(m.name).includes(n))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'ar'));
  }, [data.mosques, q]);

  const open = (m?: Mosque) => {
    if (!m) return setForm(emptyForm());
    const fx = data.fixed.filter((r) => r.mosque_id === m.id);
    const all = fx.find((r) => r.friday_index === null);
    setForm({
      id: m.id, name: m.name, size: m.size, phone: m.phone, contact_name: m.contact_name,
      allFridays: !m.needed_fridays || m.needed_fridays.length === 0, needed: m.needed_fridays ?? [1, 2, 3, 4, 5],
      is_active: m.is_active, notes: m.notes,
      fixedMode: all ? 'all' : fx.length ? 'some' : 'none',
      fixedAll: all?.preacher_id ?? '',
      fixedBy: Object.fromEntries(fx.filter((r) => r.friday_index !== null).map((r) => [r.friday_index, r.preacher_id])),
      prefer: data.preferences.filter((p) => p.mosque_id === m.id && p.kind === 'prefer').map((p) => p.preacher_id),
      avoid: data.preferences.filter((p) => p.mosque_id === m.id && p.kind === 'avoid').map((p) => p.preacher_id),
    });
  };

  const fixedText = (m: Mosque) => {
    const fx = data.fixed.filter((r) => r.mosque_id === m.id);
    if (!fx.length) return null;
    const all = fx.find((r) => r.friday_index === null);
    if (all) return `ثابت: ${pname(all.preacher_id)}`;
    return fx
      .sort((a, b) => (a.friday_index ?? 0) - (b.friday_index ?? 0))
      .map((r) => `${fridayOrdinal(r.friday_index!).replace('الجمعة ', '')}: ${pname(r.preacher_id)}`)
      .join(' · ');
  };

  return (
    <>
      <PageTitle
        title="المساجد"
        subtitle={`${data.mosques.filter((m) => m.is_active).length} مسجد في التوزيع`}
        actions={
          <Button onClick={() => open()}>
            <Plus className="w-4 h-4" />
            مسجد جديد
          </Button>
        }
      />
      <div className="mb-4">
        <Search value={q} onChange={setQ} placeholder="ابحث باسم المسجد…" />
      </div>
      {list.length === 0 ? (
        <Card>
          <Empty title={q ? 'مفيش مسجد بالاسم ده' : 'لسه مفيش مساجد'} action={!q && <Button onClick={() => open()}><Plus className="w-4 h-4" />ضيف أول مسجد</Button>}>
            {!q && 'ضيف المساجد اللي الجمعية بتبعت لها خطباء.'}
          </Empty>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map((m) => {
            const fixed = fixedText(m);
            return (
              <button
                key={m.id}
                onClick={() => open(m)}
                className="text-right bg-paper border border-sand rounded-xl p-4 hover:border-gold-500 hover:shadow-sm transition cursor-pointer flex flex-col gap-2"
              >
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-brown-100 text-brown-700 flex items-center justify-center">
                    <Landmark className="w-5 h-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[16px] font-semibold text-ink leading-snug">{m.name}</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Tag tone={m.size === 'large' ? 'gold' : 'sand'}>{SIZE_LABEL[m.size]}</Tag>
                      <Tag>{fridaysText(m.needed_fridays)}</Tag>
                      {!m.is_active && <Tag tone="bad">متوقف</Tag>}
                    </div>
                  </div>
                </div>
                {fixed && <div className="text-[13px] text-brown-700 bg-gold-200/50 border border-gold-300 rounded-lg px-2.5 py-1">{fixed}</div>}
                {m.phone && (
                  <div className="text-[13px] text-muted flex items-center gap-1.5" dir="ltr">
                    <Phone className="w-3.5 h-3.5" />
                    {m.phone}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      {form && <MosqueForm initial={form} onClose={() => setForm(null)} />}
    </>
  );
}
