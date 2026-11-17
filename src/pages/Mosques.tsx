import { useMemo, useState } from 'react';
import { Eye, FileSpreadsheet, Landmark, Pencil, Plus, Power, Trash2, X } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Mosque, MosqueSize } from '../data/types.ts';
import { SIZE_LABEL } from '../data/types.ts';
import { Button, Choice, DataTable, Empty, Field, FilterBar, FilterSelect, IconButton, Input, Modal, PageTitle, Search, Select, Tag, Textarea, clsx, normalizeAr, useTable, type Column } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { fridayOrdinal, monthTitle } from '../lib/hijri.ts';
import { byId, currentMonth, monthAssignments } from '../data/selectors.ts';
import { queryParam } from '../lib/router.ts';
import { downloadWorkbook } from '../lib/excel.ts';
import { MosqueProfile, mosqueTotals } from './profiles.tsx';

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
  const { data, actions, toast } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [size, setSize] = useState('all');
  const [cover, setCover] = useState('all');
  const [form, setForm] = useState<FormState | null>(() => (queryParam('new') ? emptyForm() : null));
  const [profileId, setProfileId] = useState<number | null>(null);
  const preachers = byId(data.preachers);
  const pname = (id: number) => preachers.get(id)?.name ?? '—';
  const month = currentMonth(data.months);
  const totals = useMemo(() => mosqueTotals(data), [data]);

  // خطباء الشهر الحالي لكل مسجد
  const monthPreachers = useMemo(() => {
    const m = new Map<number, number[]>();
    if (!month) return m;
    for (const a of monthAssignments(data, month.id).sort((x, y) => x.friday_index - y.friday_index)) {
      if (!a.preacher_id || a.status === 'excused') continue;
      m.set(a.mosque_id, [...(m.get(a.mosque_id) ?? []), a.preacher_id]);
    }
    return m;
  }, [data, month]);

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

  const list = useMemo(() => {
    const n = normalizeAr(q);
    return data.mosques.filter((m) => {
      if (n && !normalizeAr(m.name).includes(n) && !normalizeAr(m.contact_name).includes(n) && String(m.id) !== q.replace('#', '')) return false;
      if (status === 'active' && !m.is_active) return false;
      if (status === 'inactive' && m.is_active) return false;
      if (size !== 'all' && m.size !== size) return false;
      if (cover === 'fixed' && !data.fixed.some((f) => f.mosque_id === m.id)) return false;
      if (cover === 'empty' && (!m.is_active || (monthPreachers.get(m.id)?.length ?? 0) > 0)) return false;
      return true;
    });
  }, [data.mosques, data.fixed, q, status, size, cover, monthPreachers]);

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

  // الإيقاف/التنشيط بيحافظ على الخطيب الثابت والرغبات زي ما هي
  const toggle = async (m: Mosque) => {
    const fixed = data.fixed.filter((r) => r.mosque_id === m.id).map((r) => ({ preacher_id: r.preacher_id, friday_index: r.friday_index }));
    const prefs = data.preferences.filter((r) => r.mosque_id === m.id).map((r) => ({ preacher_id: r.preacher_id, kind: r.kind }));
    await actions.saveMosque({ ...m, is_active: !m.is_active }, fixed, prefs);
  };

  const exportExcel = async () => {
    try {
      await downloadWorkbook('المساجد.xlsx', [
        {
          name: 'المساجد',
          rows: [
            ['الكود', 'المسجد', 'الحجم', 'المسؤول', 'التليفون', 'محتاج خطيب في', 'الخطيب الثابت', month ? `خطباء ${monthTitle(month.hijri_year, month.hijri_month)}` : 'خطباء الشهر', 'إجمالي التكليفات', 'الحالة', 'ملاحظات'],
            ...list.map((m) => [
              m.id, m.name, SIZE_LABEL[m.size], m.contact_name, m.phone, fridaysText(m.needed_fridays), fixedText(m) ?? '',
              [...new Set((monthPreachers.get(m.id) ?? []).map(pname))].join('، '), totals.get(m.id) ?? 0, m.is_active ? 'نشط' : 'متوقف', m.notes,
            ]),
          ],
        },
      ]);
      toast(`اتنزل ملف بـ ${list.length} مسجد`);
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };

  const Actions = ({ m }: { m: Mosque }) => (
    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
      <IconButton aria-label={`ملف ${m.name}`} onClick={() => setProfileId(m.id)} className="w-9 h-9"><Eye className="w-4 h-4" /></IconButton>
      <IconButton aria-label={`تعديل ${m.name}`} onClick={() => open(m)} className="w-9 h-9"><Pencil className="w-4 h-4" /></IconButton>
      <IconButton aria-label={m.is_active ? `إيقاف ${m.name} مؤقتًا` : `تنشيط ${m.name}`} onClick={() => toggle(m)} className={clsx('w-9 h-9', m.is_active ? 'text-muted' : 'text-ok')}><Power className="w-4 h-4" /></IconButton>
    </div>
  );

  const preachersCell = (m: Mosque) => {
    const fixed = fixedText(m);
    const cur = [...new Set((monthPreachers.get(m.id) ?? []).map(pname))];
    return (
      <span className="block text-[13px] min-w-0">
        {fixed && <span className="block text-gold-700 font-medium truncate">{fixed}</span>}
        {cur.length ? <span className="block text-brown-700 line-clamp-2">{cur.join('، ')}</span> : !fixed && <span className="text-muted">—</span>}
      </span>
    );
  };

  const columns: Column<Mosque>[] = [
    { key: 'id', header: 'الكود', cell: (m) => <span className="tabular text-muted text-[13px]">#{m.id}</span>, sort: (m) => m.id, className: 'w-20' },
    {
      key: 'name',
      header: 'المسجد',
      cell: (m) => (
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-[10px] bg-brown-100 text-brown-700 inline-flex items-center justify-center"><Landmark className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{m.name}</span>
            <span className="block text-[12px] text-muted">{fridaysText(m.needed_fridays)}{m.contact_name ? ` · ${m.contact_name}` : ''}</span>
          </span>
        </span>
      ),
      sort: (m) => m.name,
    },
    { key: 'size', header: 'الحجم', cell: (m) => <Tag tone={m.size === 'large' ? 'gold' : 'sand'}>{SIZE_LABEL[m.size]}</Tag>, sort: (m) => ({ large: 0, medium: 1, small: 2 })[m.size], className: 'w-24' },
    { key: 'phone', header: 'التليفون', cell: (m) => (m.phone ? <span dir="ltr" className="tabular text-[13px]">{m.phone}</span> : <span className="text-muted">—</span>), className: 'w-36' },
    { key: 'preachers', header: month ? `الخطباء (${monthTitle(month.hijri_year, month.hijri_month)})` : 'الخطباء', cell: preachersCell },
    { key: 'count', header: 'التكليفات', cell: (m) => <span className="font-num font-bold tabular text-brown-900">{totals.get(m.id) ?? 0}</span>, sort: (m) => totals.get(m.id) ?? 0, align: 'center', className: 'w-24' },
    { key: 'status', header: 'الحالة', cell: (m) => (m.is_active ? <Tag tone="ok">نشط</Tag> : <Tag tone="bad">متوقف</Tag>), sort: (m) => Number(m.is_active), className: 'w-24' },
    { key: 'actions', header: 'الإجراءات', cell: (m) => <Actions m={m} />, className: 'w-36 text-left' },
  ];
  const table = useTable(list, columns, { pageSize: 20, initialSort: { key: 'name', dir: 'asc' } });
  const profile = profileId ? data.mosques.find((m) => m.id === profileId) : null;
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); table.setPage(1); };

  return (
    <>
      <PageTitle
        title="المساجد"
        subtitle={`${data.mosques.filter((m) => m.is_active).length} مسجد نشط من ${data.mosques.length}`}
        actions={
          <>
            <Button variant="outline" onClick={exportExcel} disabled={!list.length}><FileSpreadsheet className="w-4 h-4" />تصدير</Button>
            <Button onClick={() => open()}><Plus className="w-4 h-4" />مسجد جديد</Button>
          </>
        }
      />
      <FilterBar>
        <Search value={q} onChange={resetPage(setQ)} placeholder="ابحث بالاسم أو المسؤول أو الكود…" />
        <FilterSelect label="الحالة" value={status} onChange={resetPage(setStatus)} options={[{ value: 'all', label: 'الكل' }, { value: 'active', label: 'نشط' }, { value: 'inactive', label: 'متوقف' }]} />
        <FilterSelect label="الحجم" value={size} onChange={resetPage(setSize)} options={[{ value: 'all', label: 'الكل' }, ...SIZES.map((s) => ({ value: s.value, label: s.label }))]} />
        <FilterSelect label="الخطباء" value={cover} onChange={resetPage(setCover)} options={[{ value: 'all', label: 'الكل' }, { value: 'fixed', label: 'ليه خطيب ثابت' }, ...(month ? [{ value: 'empty', label: 'من غير خطيب الشهر ده' }] : [])]} />
      </FilterBar>
      <DataTable
        columns={columns}
        table={table}
        rowKey={(m) => m.id}
        onRowClick={(m) => setProfileId(m.id)}
        minWidth={980}
        empty={
          <Empty title={data.mosques.length ? 'مفيش مسجد بالبحث ده' : 'لسه مفيش مساجد'} icon={Landmark} action={!data.mosques.length && <Button onClick={() => open()}><Plus className="w-4 h-4" />ضيف أول مسجد</Button>}>
            {data.mosques.length ? 'جرّب تغيّر البحث أو الفلاتر.' : 'ضيف المساجد اللي الجمعية بتبعت لها خطباء.'}
          </Empty>
        }
        card={(m) => (
          <div className={clsx('px-4 py-3', !m.is_active && 'bg-brown-50/60')}>
            <button onClick={() => setProfileId(m.id)} className="w-full flex items-start gap-3 text-right cursor-pointer">
              <span className="w-10 h-10 shrink-0 rounded-[10px] bg-brown-100 text-brown-700 inline-flex items-center justify-center"><Landmark className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-ink leading-snug">{m.name}</span>
                <span className="flex flex-wrap gap-1 mt-1 items-center">
                  <Tag tone={m.size === 'large' ? 'gold' : 'sand'}>{SIZE_LABEL[m.size]}</Tag>
                  <Tag>{fridaysText(m.needed_fridays)}</Tag>
                  {!m.is_active && <Tag tone="bad">متوقف</Tag>}
                  <span className="text-[12px] text-muted tabular">#{m.id}</span>
                </span>
              </span>
            </button>
            <div className="mt-2">{preachersCell(m)}</div>
            <div className="mt-1 -mb-1"><Actions m={m} /></div>
          </div>
        )}
      />
      {profile && <MosqueProfile mosque={profile} onClose={() => setProfileId(null)} onEdit={() => open(profile)} onToggle={() => toggle(profile)} />}
      {form && <MosqueForm initial={form} onClose={() => setForm(null)} />}
    </>
  );
}
