import { useMemo, useState } from 'react';
import { Eye, FileSpreadsheet, Link2, MessageCircle, Pencil, Plus, Power, Trash2, UserRound, Users } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Preacher, PreacherLevel } from '../data/types.ts';
import { LEVEL_LABEL } from '../data/types.ts';
import { Button, Choice, DataTable, Empty, Field, FilterBar, FilterSelect, IconButton, Input, Modal, PageTitle, Search, Tag, Textarea, clsx, normalizeAr, useTable, type Column } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { byId, currentMonth, monthAssignments } from '../data/selectors.ts';
import { fridayOrdinal, monthTitle } from '../lib/hijri.ts';
import { isValidPhone, portalUrl, waLink } from '../lib/whatsapp.ts';
import { queryParam } from '../lib/router.ts';
import { downloadWorkbook } from '../lib/excel.ts';
import { PreacherProfile, preacherTotals } from './profiles.tsx';

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
  const { data, toast, actions } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(() => (queryParam('filter') === 'nophone' ? 'nophone' : 'all'));
  const [level, setLevel] = useState('all');
  const [load, setLoad] = useState('all');
  const [form, setForm] = useState<FormState | null>(() =>
    queryParam('new') ? { name: '', phone: '', level: 'mid', max_fridays: 2, available_fridays: null, is_active: true, notes: '', allFridays: true } : null
  );
  const [profileId, setProfileId] = useState<number | null>(null);
  const month = currentMonth(data.months);
  const mosques = byId(data.mosques);
  const totals = useMemo(() => preacherTotals(data), [data]);

  const monthInfo = useMemo(() => {
    const loads = new Map<number, number>();
    const at = new Map<number, Set<number>>();
    if (month) {
      for (const a of monthAssignments(data, month.id)) {
        if (!a.preacher_id || a.status === 'excused') continue;
        loads.set(a.preacher_id, (loads.get(a.preacher_id) ?? 0) + 1);
        if (!at.has(a.preacher_id)) at.set(a.preacher_id, new Set());
        at.get(a.preacher_id)!.add(a.mosque_id);
      }
    }
    for (const f of data.fixed) {
      if (!at.has(f.preacher_id)) at.set(f.preacher_id, new Set());
      at.get(f.preacher_id)!.add(f.mosque_id);
    }
    return { loads, at };
  }, [data, month]);

  const linked = (p: Preacher) => [...(monthInfo.at.get(p.id) ?? [])].map((id) => mosques.get(id)?.name).filter(Boolean) as string[];

  const list = useMemo(() => {
    const n = normalizeAr(q);
    return data.preachers.filter((p) => {
      if (n && !normalizeAr(p.name).includes(n) && !p.phone.includes(q) && String(p.id) !== q.replace('#', '')) return false;
      if (status === 'active' && !p.is_active) return false;
      if (status === 'inactive' && p.is_active) return false;
      if (status === 'nophone' && isValidPhone(p.phone)) return false;
      if (level !== 'all' && p.level !== level) return false;
      const l = monthInfo.loads.get(p.id) ?? 0;
      if (load === 'none' && (l > 0 || !p.is_active)) return false;
      if (load === 'full' && l < p.max_fridays) return false;
      return true;
    });
  }, [data.preachers, q, status, level, load, monthInfo]);

  const open = (p?: Preacher) =>
    setForm(
      p
        ? { ...p, allFridays: !p.available_fridays || p.available_fridays.length === 0 }
        : { name: '', phone: '', level: 'mid', max_fridays: 2, available_fridays: null, is_active: true, notes: '', allFridays: true }
    );

  const toggle = async (p: Preacher) => {
    const { portal_token: _t, ...rest } = p;
    await actions.savePreacher({ ...rest, is_active: !p.is_active });
  };

  const copyLink = async (p: Preacher) => {
    try {
      await navigator.clipboard.writeText(portalUrl(p.portal_token));
      toast(`اتنسخ رابط صفحة ${p.name}`);
    } catch {
      toast('ما قدرتش أنسخ الرابط', 'error');
    }
  };

  const exportExcel = async () => {
    try {
      await downloadWorkbook(`الخطباء.xlsx`, [
        {
          name: 'الخطباء',
          rows: [
            ['الكود', 'الاسم', 'الموبايل', 'الخبرة', 'أقصى جمعات', 'متاح في', 'المساجد المرتبطة', month ? `جمعات ${monthTitle(month.hijri_year, month.hijri_month)}` : 'جمعات الشهر', 'إجمالي التكليفات', 'الحالة', 'ملاحظات'],
            ...list.map((p) => [
              p.id, p.name, p.phone, LEVEL_LABEL[p.level], p.max_fridays,
              !p.available_fridays?.length ? 'كل الجمعات' : p.available_fridays.map((x) => fridayOrdinal(x)).join('، '),
              linked(p).join('، '), monthInfo.loads.get(p.id) ?? 0, totals.get(p.id) ?? 0, p.is_active ? 'نشط' : 'متوقف', p.notes,
            ]),
          ],
        },
      ]);
      toast(`اتنزل ملف بـ ${list.length} خطيب`);
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };

  const LoadCell = ({ p }: { p: Preacher }) => {
    const l = monthInfo.loads.get(p.id) ?? 0;
    return (
      <span className="tabular whitespace-nowrap" title="جمعات الشهر من الحد الأقصى">
        <b className={clsx('font-num text-[15px]', l >= p.max_fridays ? 'text-gold-700' : 'text-brown-900')}>{l}</b>
        <span className="text-muted text-[12.5px]"> / {p.max_fridays}</span>
        <span className="block text-[11.5px] text-muted">الإجمالي {totals.get(p.id) ?? 0}</span>
      </span>
    );
  };

  const Actions = ({ p }: { p: Preacher }) => (
    <div className="flex items-center gap-0.5 justify-end" onClick={(e) => e.stopPropagation()}>
      <IconButton aria-label={`ملف ${p.name}`} onClick={() => setProfileId(p.id)} className="w-9 h-9"><Eye className="w-4 h-4" /></IconButton>
      <IconButton aria-label={`تعديل ${p.name}`} onClick={() => open(p)} className="w-9 h-9"><Pencil className="w-4 h-4" /></IconButton>
      <IconButton aria-label={`نسخ رابط صفحة ${p.name}`} onClick={() => copyLink(p)} className="w-9 h-9"><Link2 className="w-4 h-4" /></IconButton>
      {p.phone && (
        <a href={waLink(p.phone, `السلام عليكم ورحمة الله يا شيخ ${p.name}`)} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${p.name}`} title="واتساب" className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center text-green hover:bg-ok-soft">
          <MessageCircle className="w-4 h-4" />
        </a>
      )}
      <IconButton aria-label={p.is_active ? `إيقاف ${p.name} مؤقتًا` : `تنشيط ${p.name}`} onClick={() => toggle(p)} className={clsx('w-9 h-9', p.is_active ? 'text-muted' : 'text-ok')}><Power className="w-4 h-4" /></IconButton>
    </div>
  );

  const columns: Column<Preacher>[] = [
    { key: 'id', header: 'الكود', cell: (p) => <span className="tabular text-muted text-[13px]">#{p.id}</span>, sort: (p) => p.id, className: 'w-20' },
    {
      key: 'name',
      header: 'الاسم',
      cell: (p) => (
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 shrink-0 rounded-full bg-brown-100 text-brown-700 inline-flex items-center justify-center"><UserRound className="w-4 h-4" /></span>
          <span className="min-w-0">
            <span className="block font-semibold text-ink">{p.name}</span>
            <span className="flex flex-wrap gap-1 mt-0.5">
              <Tag tone={p.level === 'senior' ? 'gold' : p.level === 'new' ? 'wait' : 'sand'}>{LEVEL_LABEL[p.level]}</Tag>
              {p.available_fridays && p.available_fridays.length < 5 && <Tag>متاح: {p.available_fridays.map((x) => fridayOrdinal(x).replace('الجمعة ', '')).join(' و')}</Tag>}
            </span>
          </span>
        </span>
      ),
      sort: (p) => p.name,
    },
    { key: 'phone', header: 'الموبايل', cell: (p) => (p.phone ? <span dir="ltr" className={clsx('tabular text-[13px]', !isValidPhone(p.phone) && 'text-bad')}>{p.phone}</span> : <span className="text-bad text-[13px]">مش مسجل</span>), className: 'w-36' },
    {
      key: 'mosques',
      header: 'المساجد المرتبطة',
      cell: (p) => {
        const l = linked(p);
        return l.length ? <span className="text-[13px] text-brown-700 line-clamp-2">{l.join('، ')}</span> : <span className="text-muted">—</span>;
      },
    },
    { key: 'load', header: 'التكليفات', cell: (p) => <LoadCell p={p} />, sort: (p) => monthInfo.loads.get(p.id) ?? 0, align: 'center', className: 'w-28' },
    { key: 'status', header: 'الحالة', cell: (p) => (p.is_active ? <Tag tone="ok">نشط</Tag> : <Tag tone="bad">متوقف</Tag>), sort: (p) => Number(p.is_active), className: 'w-24' },
    { key: 'actions', header: 'الإجراءات', cell: (p) => <Actions p={p} />, className: 'w-52 text-left' },
  ];
  const table = useTable(list, columns, { pageSize: 20, initialSort: { key: 'name', dir: 'asc' } });
  const profile = profileId ? data.preachers.find((p) => p.id === profileId) : null;
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); table.setPage(1); };

  return (
    <>
      <PageTitle
        title="الخطباء"
        subtitle={`${data.preachers.filter((p) => p.is_active).length} خطيب نشط من ${data.preachers.length}${month ? ` · التكليفات لشهر ${monthTitle(month.hijri_year, month.hijri_month)}` : ''}`}
        actions={
          <>
            <Button variant="outline" onClick={exportExcel} disabled={!list.length}><FileSpreadsheet className="w-4 h-4" />تصدير</Button>
            <Button onClick={() => open()}><Plus className="w-4 h-4" />خطيب جديد</Button>
          </>
        }
      />
      <FilterBar>
        <Search value={q} onChange={resetPage(setQ)} placeholder="ابحث بالاسم أو الرقم أو الكود…" />
        <FilterSelect label="الحالة" value={status} onChange={resetPage(setStatus)} options={[{ value: 'all', label: 'الكل' }, { value: 'active', label: 'نشط' }, { value: 'inactive', label: 'متوقف' }, { value: 'nophone', label: 'من غير رقم صحيح' }]} />
        <FilterSelect label="الخبرة" value={level} onChange={resetPage(setLevel)} options={[{ value: 'all', label: 'الكل' }, ...LEVELS.map((l) => ({ value: l.value, label: l.label }))]} />
        {month && <FilterSelect label="الشهر" value={load} onChange={resetPage(setLoad)} options={[{ value: 'all', label: 'الكل' }, { value: 'none', label: 'ما أخدش جمعات' }, { value: 'full', label: 'وصل لحده' }]} />}
      </FilterBar>
      <DataTable
        columns={columns}
        table={table}
        rowKey={(p) => p.id}
        onRowClick={(p) => setProfileId(p.id)}
        minWidth={980}
        empty={
          <Empty title={data.preachers.length ? 'مفيش خطيب بالبحث ده' : 'لسه مفيش خطباء'} icon={Users} action={!data.preachers.length && <Button onClick={() => open()}><Plus className="w-4 h-4" />ضيف أول خطيب</Button>}>
            {data.preachers.length ? 'جرّب تغيّر البحث أو الفلاتر.' : undefined}
          </Empty>
        }
        card={(p) => (
          <div className={clsx('px-4 py-3', !p.is_active && 'bg-brown-50/60')}>
            <button onClick={() => setProfileId(p.id)} className="w-full flex items-start gap-3 text-right cursor-pointer">
              <span className="w-10 h-10 shrink-0 rounded-full bg-brown-100 text-brown-700 inline-flex items-center justify-center"><UserRound className="w-5 h-5" /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-ink leading-snug">{p.name}</span>
                <span className="flex flex-wrap gap-1 mt-1">
                  <Tag tone={p.level === 'senior' ? 'gold' : p.level === 'new' ? 'wait' : 'sand'}>{LEVEL_LABEL[p.level]}</Tag>
                  {!p.is_active && <Tag tone="bad">متوقف</Tag>}
                  <span className="text-[12px] text-muted tabular">#{p.id}</span>
                </span>
              </span>
              <LoadCell p={p} />
            </button>
            {linked(p).length > 0 && <div className="text-[12.5px] text-muted mt-2 truncate">{linked(p).join('، ')}</div>}
            <div className="mt-2 -mb-1"><Actions p={p} /></div>
          </div>
        )}
      />
      {profile && <PreacherProfile preacher={profile} onClose={() => setProfileId(null)} onEdit={() => open(profile)} onToggle={() => toggle(profile)} />}
      {form && <PreacherForm initial={form} onClose={() => setForm(null)} />}
    </>
  );
}
