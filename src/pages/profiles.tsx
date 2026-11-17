// الملفات التفصيلية للخطيب والمسجد (لوحة جانبية).
// كل البيانات من الجداول الحالية: التكليفات، الثوابت، الرغبات، السجل، وتواريخ الإرسال.
import { useMemo } from 'react';
import { Check, Copy, History, Landmark, Link2, Mail, MessageCircle, NotebookPen, Pencil, Phone, Power, UserRound } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { AppData, Assignment, Mosque, Preacher } from '../data/types.ts';
import { LEVEL_LABEL, SIZE_LABEL } from '../data/types.ts';
import { Button, Drawer, LinkButton, SectionTitle, StatusPill, Tag, clsx } from '../ui/kit.tsx';
import { byId, fridaysOf, sortMonths } from '../data/selectors.ts';
import { actionLabel } from '../data/audit.ts';
import { fridayOrdinal, gregShort, monthTitle } from '../lib/hijri.ts';
import { portalUrl, waLink } from '../lib/whatsapp.ts';
import { navigate } from '../lib/router.ts';
import { formatDateTime } from './ActivityLog.tsx';

export interface HistoryRow {
  a: Assignment;
  monthTitle: string;
  monthId: number;
  date: string;
  start: string;
}

/** كل تكليفات خطيب أو مسجد في كل الشهور، الأحدث الأول */
export function historyOf(data: AppData, pred: (a: Assignment) => boolean): HistoryRow[] {
  const months = byId(data.months);
  return data.assignments
    .filter(pred)
    .map((a) => {
      const m = months.get(a.month_id);
      if (!m) return null;
      const f = fridaysOf(m).find((x) => x.index === a.friday_index);
      return { a, monthTitle: monthTitle(m.hijri_year, m.hijri_month), monthId: m.id, date: f?.date ?? m.start_date, start: m.start_date };
    })
    .filter((x): x is HistoryRow => Boolean(x))
    .sort((x, y) => y.date.localeCompare(x.date));
}

/** عدد تكليفات الخطيب (غير المعتذر عنها) في كل الشهور */
export function preacherTotals(data: AppData): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of data.assignments) if (a.preacher_id && a.status !== 'excused') m.set(a.preacher_id, (m.get(a.preacher_id) ?? 0) + 1);
  return m;
}

export function mosqueTotals(data: AppData): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of data.assignments) if (a.preacher_id && a.status !== 'excused') m.set(a.mosque_id, (m.get(a.mosque_id) ?? 0) + 1);
  return m;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-t border-border first:border-t-0 text-sm">
      <dt className="text-muted shrink-0">{label}</dt>
      <dd className="text-ink text-left min-w-0">{children}</dd>
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)]">
      <SectionTitle action={action}>{title}</SectionTitle>
      {children}
    </section>
  );
}

function HistoryList({ rows, label }: { rows: HistoryRow[]; label: (r: HistoryRow) => React.ReactNode }) {
  if (!rows.length) return <p className="text-sm text-muted">لسه مفيش تكليفات.</p>;
  return (
    <ul className="divide-y divide-border -mx-1 max-h-[320px] overflow-y-auto scroll-soft">
      {rows.slice(0, 40).map((r) => (
        <li key={r.a.id}>
          <button onClick={() => navigate(`/schedule?month=${r.monthId}`)} className="w-full text-right flex items-center gap-3 px-1 py-2.5 hover:bg-brown-50 rounded-lg cursor-pointer">
            <span className="w-12 text-center shrink-0">
              <span className="block font-num font-bold text-brown-900 tabular leading-tight">{gregShort(r.date).split(' ')[0]}</span>
              <span className="block text-[11px] text-muted">{gregShort(r.date).split(' ')[1]}</span>
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-ink truncate">{label(r)}</span>
              <span className="block text-[12px] text-muted truncate">{fridayOrdinal(r.a.friday_index)} · {r.monthTitle}</span>
            </span>
            <StatusPill status={r.a.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function MessageList({ rows, name }: { rows: HistoryRow[]; name: (r: HistoryRow) => string }) {
  const events = rows
    .flatMap((r) => [
      r.a.notified_at ? { at: r.a.notified_at, kind: 'تكليف / جدول الشهر', r } : null,
      r.a.reminded_at ? { at: r.a.reminded_at, kind: 'تذكير الخميس', r } : null,
    ])
    .filter((x): x is { at: string; kind: string; r: HistoryRow } => Boolean(x))
    .sort((x, y) => y.at.localeCompare(x.at));
  if (!events.length) return <p className="text-sm text-muted">مفيش رسائل متسجلة لسه.</p>;
  return (
    <ul className="space-y-2 max-h-[240px] overflow-y-auto scroll-soft">
      {events.slice(0, 20).map((e, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <Mail className="w-4 h-4 text-ok mt-1 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-ink">{e.kind}</span>
            <span className="text-muted"> · {name(e.r)} · {fridayOrdinal(e.r.a.friday_index)}</span>
            <span className="block text-[12px] text-muted tabular">{formatDateTime(e.at)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function LogList({ entries }: { entries: AppData['log'] }) {
  if (!entries.length) return <p className="text-sm text-muted">مفيش عمليات مسجلة.</p>;
  return (
    <ul className="space-y-2.5 max-h-[260px] overflow-y-auto scroll-soft">
      {entries.slice(0, 25).map((l) => (
        <li key={l.id} className="text-sm">
          <span className="font-medium text-ink">{actionLabel(l.action)}</span>
          <span className="block text-[12.5px] text-muted break-words">{l.details}</span>
          <span className="block text-[11.5px] text-muted/80 tabular">{formatDateTime(l.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------
// ملف الخطيب
// ---------------------------------------------------------------------
export function PreacherProfile({ preacher: p, onClose, onEdit, onToggle }: { preacher: Preacher; onClose: () => void; onEdit: () => void; onToggle: () => void }) {
  const { data, toast } = useStore();
  const mosques = byId(data.mosques);
  const rows = useMemo(() => historyOf(data, (a) => a.preacher_id === p.id), [data, p.id]);
  const fixed = data.fixed.filter((f) => f.preacher_id === p.id);
  const prefs = data.preferences.filter((f) => f.preacher_id === p.id);
  const visited = useMemo(() => {
    const c = new Map<number, number>();
    for (const r of rows) if (r.a.status !== 'excused') c.set(r.a.mosque_id, (c.get(r.a.mosque_id) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const log = data.log.filter((l) => l.preacher_id === p.id);
  const done = rows.filter((r) => r.a.status !== 'excused').length;
  const excuses = rows.filter((r) => r.a.status === 'excused').length;
  const confirmed = rows.filter((r) => r.a.status === 'confirmed').length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl(p.portal_token));
      toast(`اتنسخ رابط صفحة ${p.name}`);
    } catch {
      toast('ما قدرتش أنسخ الرابط', 'error');
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={p.name}
      subtitle={<>كود الخطيب <span className="tabular">#{p.id}</span> · {LEVEL_LABEL[p.level]} · {p.is_active ? 'نشط' : 'متوقف مؤقتًا'}</>}
      footer={
        <>
          <Button variant="outline" onClick={onToggle} className="ml-auto"><Power className="w-4 h-4" />{p.is_active ? 'إيقاف مؤقت' : 'تنشيط'}</Button>
          <Button onClick={onEdit}><Pencil className="w-4 h-4" />تعديل البيانات</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { l: 'جمعات خطبها/متكلف بيها', v: done, c: 'text-brown-900' },
          { l: 'أكد', v: confirmed, c: 'text-ok' },
          { l: 'اعتذارات', v: excuses, c: excuses ? 'text-bad' : 'text-muted' },
        ].map((x) => (
          <div key={x.l} className="bg-card border border-border rounded-xl py-3">
            <div className={clsx('font-num text-2xl font-bold tabular', x.c)}>{x.v}</div>
            <div className="text-[11.5px] text-muted leading-tight px-1">{x.l}</div>
          </div>
        ))}
      </div>

      <Section title="البيانات الأساسية">
        <dl>
          <InfoRow label="الخبرة">{LEVEL_LABEL[p.level]}</InfoRow>
          <InfoRow label="أقصى جمعات في الشهر"><span className="tabular">{p.max_fridays}</span></InfoRow>
          <InfoRow label="متاح في">{!p.available_fridays?.length || p.available_fridays.length === 5 ? 'كل الجمعات' : p.available_fridays.map((x) => fridayOrdinal(x).replace('الجمعة ', '')).join(' و')}</InfoRow>
          <InfoRow label="الحالة">{p.is_active ? <Tag tone="ok"><Check className="w-3 h-3" />نشط</Tag> : <Tag tone="bad">متوقف مؤقتًا</Tag>}</InfoRow>
        </dl>
      </Section>

      <Section title="بيانات الاتصال">
        <dl>
          <InfoRow label="الموبايل">{p.phone ? <span dir="ltr" className="tabular">{p.phone}</span> : <span className="text-bad">مش مسجل</span>}</InfoRow>
        </dl>
        <div className="flex flex-wrap gap-2 mt-3">
          {p.phone && <LinkButton size="sm" variant="whatsapp" href={waLink(p.phone, `السلام عليكم ورحمة الله يا شيخ ${p.name}`)}><MessageCircle className="w-4 h-4" />واتساب</LinkButton>}
          {p.phone && <LinkButton size="sm" href={`tel:${p.phone}`} target="_self"><Phone className="w-4 h-4" />اتصال</LinkButton>}
          <Button size="sm" variant="outline" onClick={copyLink}><Link2 className="w-4 h-4" />نسخ رابط صفحته</Button>
        </div>
      </Section>

      <Section title="المساجد المرتبطة">
        {fixed.length === 0 && prefs.length === 0 && visited.length === 0 ? (
          <p className="text-sm text-muted">مش مرتبط بمسجد معين.</p>
        ) : (
          <div className="space-y-3 text-sm">
            {fixed.length > 0 && (
              <div>
                <div className="text-[12px] text-muted mb-1">خطيب ثابت في</div>
                <div className="flex flex-wrap gap-1.5">
                  {fixed.map((f) => <Tag key={f.id} tone="gold">{mosques.get(f.mosque_id)?.name} · {f.friday_index ? fridayOrdinal(f.friday_index) : 'كل الجمعات'}</Tag>)}
                </div>
              </div>
            )}
            {prefs.length > 0 && (
              <div>
                <div className="text-[12px] text-muted mb-1">رغبات المساجد</div>
                <div className="flex flex-wrap gap-1.5">
                  {prefs.map((f) => <Tag key={f.id} tone={f.kind === 'prefer' ? 'ok' : 'bad'}>{mosques.get(f.mosque_id)?.name} · {f.kind === 'prefer' ? 'طالبه' : 'رافضه'}</Tag>)}
                </div>
              </div>
            )}
            {visited.length > 0 && (
              <div>
                <div className="text-[12px] text-muted mb-1">خطب في</div>
                <div className="flex flex-wrap gap-1.5">
                  {visited.slice(0, 12).map(([id, n]) => <Tag key={id}><Landmark className="w-3 h-3" />{mosques.get(id)?.name ?? '—'} <span className="tabular text-muted">×{n}</span></Tag>)}
                </div>
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="سجل التكليفات" action={<span className="text-[12px] text-muted tabular">{rows.length}</span>}>
        <HistoryList rows={rows} label={(r) => mosques.get(r.a.mosque_id)?.name ?? '—'} />
      </Section>

      <Section title="سجل الرسائل">
        <MessageList rows={rows} name={(r) => mosques.get(r.a.mosque_id)?.name ?? ''} />
        <p className="text-[11.5px] text-muted mt-2">بيتسجل لما تدوس إرسال من البرنامج. الإرسال نفسه بيتم من واتساب.</p>
      </Section>

      <Section title="الملاحظات الإدارية" action={<NotebookPen className="w-4 h-4 text-muted" />}>
        <p className="text-sm whitespace-pre-wrap">{p.notes || <span className="text-muted">مفيش ملاحظات.</span>}</p>
      </Section>

      <Section title="سجل التعديلات" action={<History className="w-4 h-4 text-muted" />}>
        <LogList entries={log} />
      </Section>
    </Drawer>
  );
}

// ---------------------------------------------------------------------
// ملف المسجد
// ---------------------------------------------------------------------
export function MosqueProfile({ mosque: m, onClose, onEdit, onToggle }: { mosque: Mosque; onClose: () => void; onEdit: () => void; onToggle: () => void }) {
  const { data, toast } = useStore();
  const preachers = byId(data.preachers);
  const rows = useMemo(() => historyOf(data, (a) => a.mosque_id === m.id), [data, m.id]);
  const fixed = data.fixed.filter((f) => f.mosque_id === m.id);
  const prefs = data.preferences.filter((f) => f.mosque_id === m.id);
  const today = new Date().toISOString().slice(0, 10);
  const current = rows.filter((r) => r.date >= today && r.a.preacher_id && r.a.status !== 'excused');
  const past = useMemo(() => {
    const c = new Map<number, number>();
    for (const r of rows) if (r.date < today && r.a.preacher_id && r.a.status !== 'excused') c.set(r.a.preacher_id, (c.get(r.a.preacher_id) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, today]);
  const perMonth = useMemo(() => {
    const out: { id: number; title: string; filled: number; total: number }[] = [];
    for (const mo of sortMonths(data.months).reverse()) {
      const list = rows.filter((r) => r.monthId === mo.id);
      if (!list.length) continue;
      out.push({ id: mo.id, title: list[0].monthTitle, filled: list.filter((r) => r.a.preacher_id && r.a.status !== 'excused').length, total: list.length });
    }
    return out;
  }, [rows, data.months]);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(m.phone);
      toast('اتنسخ الرقم');
    } catch {
      toast('ما قدرتش أنسخ', 'error');
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={m.name}
      subtitle={<>كود المسجد <span className="tabular">#{m.id}</span> · مسجد {SIZE_LABEL[m.size]} · {m.is_active ? 'نشط' : 'متوقف مؤقتًا'}</>}
      footer={
        <>
          <Button variant="outline" onClick={onToggle} className="ml-auto"><Power className="w-4 h-4" />{m.is_active ? 'إيقاف مؤقت' : 'تنشيط'}</Button>
          <Button onClick={onEdit}><Pencil className="w-4 h-4" />تعديل البيانات</Button>
        </>
      }
    >
      <Section title="البيانات الأساسية">
        <dl>
          <InfoRow label="الحجم">{SIZE_LABEL[m.size]}</InfoRow>
          <InfoRow label="محتاج خطيب في">{!m.needed_fridays?.length || m.needed_fridays.length === 5 ? 'كل الجمعات' : m.needed_fridays.map((x) => fridayOrdinal(x).replace('الجمعة ', '')).join(' و')}</InfoRow>
          <InfoRow label="الحالة">{m.is_active ? <Tag tone="ok"><Check className="w-3 h-3" />نشط</Tag> : <Tag tone="bad">متوقف مؤقتًا</Tag>}</InfoRow>
          <InfoRow label="إجمالي التكليفات"><span className="tabular">{rows.filter((r) => r.a.preacher_id && r.a.status !== 'excused').length}</span></InfoRow>
        </dl>
      </Section>

      <Section title="بيانات التواصل">
        <dl>
          <InfoRow label="المسؤول">{m.contact_name || <span className="text-muted">—</span>}</InfoRow>
          <InfoRow label="التليفون">{m.phone ? <span dir="ltr" className="tabular">{m.phone}</span> : <span className="text-muted">مش مسجل</span>}</InfoRow>
        </dl>
        {m.phone && (
          <div className="flex flex-wrap gap-2 mt-3">
            <LinkButton size="sm" variant="whatsapp" href={waLink(m.phone, 'السلام عليكم ورحمة الله')}><MessageCircle className="w-4 h-4" />واتساب</LinkButton>
            <LinkButton size="sm" href={`tel:${m.phone}`} target="_self"><Phone className="w-4 h-4" />اتصال</LinkButton>
            <Button size="sm" variant="outline" onClick={copyPhone}><Copy className="w-4 h-4" />نسخ الرقم</Button>
          </div>
        )}
        <p className="text-[11.5px] text-muted mt-3">المنطقة والعنوان مش متسجلين في قاعدة البيانات الحالية.</p>
      </Section>

      <Section title="الخطباء الحاليون والسابقون">
        <div className="space-y-3 text-sm">
          {fixed.length > 0 && (
            <div>
              <div className="text-[12px] text-muted mb-1">الخطيب الثابت</div>
              <div className="flex flex-wrap gap-1.5">
                {fixed.map((f) => <Tag key={f.id} tone="gold"><UserRound className="w-3 h-3" />{preachers.get(f.preacher_id)?.name} · {f.friday_index ? fridayOrdinal(f.friday_index) : 'كل الجمعات'}</Tag>)}
              </div>
            </div>
          )}
          <div>
            <div className="text-[12px] text-muted mb-1">الجمعات الجاية</div>
            {current.length ? (
              <ul className="space-y-1">
                {current.slice().reverse().map((r) => (
                  <li key={r.a.id} className="flex items-center justify-between gap-2">
                    <span><span className="tabular text-muted">{gregShort(r.date)}</span> · {preachers.get(r.a.preacher_id!)?.name}</span>
                    <StatusPill status={r.a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">مفيش تكليفات جاية.</p>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <div className="text-[12px] text-muted mb-1">خطبوا هنا قبل كده</div>
              <div className="flex flex-wrap gap-1.5">
                {past.slice(0, 16).map(([id, n]) => <Tag key={id}>{preachers.get(id)?.name ?? '—'} <span className="tabular text-muted">×{n}</span></Tag>)}
              </div>
            </div>
          )}
          {prefs.length > 0 && (
            <div>
              <div className="text-[12px] text-muted mb-1">رغبات المسجد</div>
              <div className="flex flex-wrap gap-1.5">
                {prefs.map((f) => <Tag key={f.id} tone={f.kind === 'prefer' ? 'ok' : 'bad'}>{preachers.get(f.preacher_id)?.name} · {f.kind === 'prefer' ? 'طالبه' : 'رافضه'}</Tag>)}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="سجل الجداول">
        {perMonth.length === 0 ? (
          <p className="text-sm text-muted">لسه مفيش جداول.</p>
        ) : (
          <ul className="divide-y divide-border">
            {perMonth.map((x) => (
              <li key={x.id}>
                <button onClick={() => navigate(`/schedule?month=${x.id}`)} className="w-full flex items-center justify-between gap-2 py-2.5 text-sm hover:text-gold-700 cursor-pointer">
                  <span>{x.title}</span>
                  <span className={clsx('tabular', x.filled < x.total ? 'text-wait' : 'text-ok')}>{x.filled} / {x.total} متغطي</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="سجل التكليفات" action={<span className="text-[12px] text-muted tabular">{rows.length}</span>}>
        <HistoryList rows={rows} label={(r) => (r.a.preacher_id ? preachers.get(r.a.preacher_id)?.name ?? '—' : 'من غير خطيب')} />
      </Section>

      <Section title="الملاحظات" action={<NotebookPen className="w-4 h-4 text-muted" />}>
        <p className="text-sm whitespace-pre-wrap">{m.notes || <span className="text-muted">مفيش ملاحظات.</span>}</p>
      </Section>
    </Drawer>
  );
}
