import { useMemo, useState } from 'react';
import { Check, Lock, LockOpen, MessageCircle, RotateCcw, UserMinus, UserX } from 'lucide-react';
import { useStore } from '../data/store.tsx';
import type { Assignment, AssignmentStatus, Month } from '../data/types.ts';
import { LEVEL_LABEL, SIZE_LABEL } from '../data/types.ts';
import { Button, Input, LinkButton, Modal, StatusPill, Tag, clsx } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { engineInput, fridaysOf } from '../data/selectors.ts';
import { rankCandidates } from '../lib/engine.ts';
import { fridayOrdinal, gregLong, hijriShort } from '../lib/hijri.ts';
import { portalUrl, waLink } from '../lib/whatsapp.ts';
import { fridayMessage } from '../lib/messages.ts';

const SOURCE_LABEL = { fixed: 'خطيب ثابت', auto: 'توزيع تلقائي', manual: 'اختيار يدوي' } as const;

/** نافذة تكليف جمعة في مسجد: تأكيد، اعتذار، واختيار بديل */
export function AssignmentModal({ month, slot, onClose }: { month: Month; slot: { mosqueId: number; fridayIndex: number }; onClose: () => void }) {
  const { data, actions, toast } = useStore();
  const confirm = useConfirm();
  const [excusing, setExcusing] = useState(false);
  const [reason, setReason] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [lastPicked, setLastPicked] = useState<number | null>(null);

  const mosque = data.mosques.find((m) => m.id === slot.mosqueId)!;
  const friday = fridaysOf(month).find((f) => f.index === slot.fridayIndex)!;
  const a = data.assignments.find((x) => x.month_id === month.id && x.mosque_id === slot.mosqueId && x.friday_index === slot.fridayIndex);
  const current = a?.preacher_id ? data.preachers.find((p) => p.id === a.preacher_id) : null;
  const needsReplacement = !current || a?.status === 'excused';

  const candidates = useMemo(() => {
    const input = engineInput(data, month);
    return rankCandidates(slot, input).filter((c) => c.preacher.id !== current?.id);
  }, [data, month, slot, current?.id]);
  const ok = candidates.filter((c) => !c.blocker);
  const shown = showAll ? candidates : ok.slice(0, 8);

  const base = (): Omit<Assignment, 'id'> => ({
    month_id: month.id,
    mosque_id: slot.mosqueId,
    friday_index: slot.fridayIndex,
    preacher_id: a?.preacher_id ?? null,
    source: a?.source ?? 'manual',
    locked: a?.locked ?? false,
    status: a?.status ?? 'pending',
    excuse_reason: a?.excuse_reason ?? '',
    status_at: a?.status_at ?? null,
    notified_at: a?.notified_at ?? null,
    reminded_at: a?.reminded_at ?? null,
  });

  const setStatus = async (status: AssignmentStatus, why = '') => {
    if (!a || !current) return;
    await actions.upsertAssignments([{ ...base(), status, excuse_reason: status === 'excused' ? why : '', status_at: new Date().toISOString() }]);
    if (status === 'excused') {
      const days = data.unavailable.filter((u) => u.month_id === month.id && u.preacher_id === current.id).map((u) => u.friday_index);
      if (!days.includes(slot.fridayIndex)) await actions.setUnavailable(month.id, current.id, [...days, slot.fridayIndex], why);
      await actions.log(month.id, current.id, 'excuse', `${mosque.name} - ${fridayOrdinal(slot.fridayIndex)}${why ? `: ${why}` : ''}`);
      toast(`اتسجل اعتذار الشيخ ${current.name}. اختار بديل من القائمة`);
    } else if (status === 'confirmed') {
      await actions.log(month.id, current.id, 'confirm', `${mosque.name} - ${fridayOrdinal(slot.fridayIndex)} (من المسؤول)`);
      toast('اتأكد ✓');
    }
    setExcusing(false);
    setReason('');
  };

  const pick = async (preacherId: number, blocker: string | null) => {
    const p = data.preachers.find((x) => x.id === preacherId)!;
    if (blocker) {
      const go = await confirm({ title: 'الاختيار ده مخالف لقاعدة', body: <>الشيخ {p.name}: <b>{blocker}</b>. تحطه برضه؟</>, confirmText: 'أيوه، حطه' });
      if (!go) return;
    }
    const old = current;
    await actions.upsertAssignments([
      { ...base(), preacher_id: preacherId, source: 'manual', status: 'pending', excuse_reason: '', status_at: null, notified_at: null, reminded_at: null },
    ]);
    await actions.log(month.id, preacherId, 'replace', `${mosque.name} - ${fridayOrdinal(slot.fridayIndex)}: ${old ? `بدل ${old.name}` : 'تعيين'}`);
    setLastPicked(preacherId);
    toast(`اتحط الشيخ ${p.name}`);
  };

  const clear = async () => {
    if (!a) return;
    await actions.upsertAssignments([{ ...base(), preacher_id: null, source: 'manual', status: 'pending', excuse_reason: '', locked: false }]);
  };

  const toggleLock = async () => {
    if (!a) return;
    await actions.upsertAssignments([{ ...base(), locked: !a.locked }], a.locked ? 'اتفك التثبيت' : 'اتثبت: التوزيع التلقائي مش هيغيره');
  };

  const msgFor = (pid: number) => {
    const p = data.preachers.find((x) => x.id === pid)!;
    return waLink(p.phone, fridayMessage(p.name, month, { fridayIndex: friday.index, date: friday.date, hijriDay: friday.hijriDay, mosqueName: mosque.name }, portalUrl(p.portal_token), data.settings.org_name));
  };
  const picked = lastPicked ? data.preachers.find((p) => p.id === lastPicked) : null;

  return (
    <Modal open onClose={onClose} title={mosque.name} wide>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted -mt-1 mb-4">
        <span className="font-semibold text-brown-800">{fridayOrdinal(friday.index)}</span>
        <span className="tabular">{hijriShort(friday.hijriDay, month.hijri_month)} · {gregLong(friday.date)}</span>
        <Tag tone={mosque.size === 'large' ? 'gold' : 'sand'}>مسجد {SIZE_LABEL[mosque.size]}</Tag>
      </div>

      {/* الخطيب الحالي */}
      {current && a && (
        <div className={clsx('rounded-xl border p-4 mb-4', a.status === 'excused' ? 'border-bad/40 bg-bad-soft/60' : 'border-gold-400/60 bg-gold-200/30')}>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div>
              <div className="text-xs text-muted">الخطيب</div>
              <div className={clsx('font-display text-xl text-brown-900', a.status === 'excused' && 'line-through')}>{current.name}</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <StatusPill status={a.status} />
                <Tag>{SOURCE_LABEL[a.source]}</Tag>
                {a.locked && <Tag tone="brown"><Lock className="w-3 h-3" />مثبت</Tag>}
              </div>
              {a.status === 'excused' && a.excuse_reason && <div className="text-sm text-bad mt-1.5">السبب: {a.excuse_reason}</div>}
            </div>
            {current.phone && a.status !== 'excused' && (
              <LinkButton size="sm" href={msgFor(current.id)}>
                <MessageCircle className="w-4 h-4" />
                ابعت له
              </LinkButton>
            )}
          </div>

          {!excusing ? (
            <div className="flex flex-wrap gap-2 mt-3">
              {a.status !== 'confirmed' && a.status !== 'excused' && (
                <Button size="sm" variant="outline" onClick={() => setStatus('confirmed')}><Check className="w-4 h-4 text-ok" />أكّد إنه هيخطب</Button>
              )}
              {a.status !== 'excused' && (
                <Button size="sm" variant="outline" onClick={() => setExcusing(true)}><UserX className="w-4 h-4 text-bad" />اعتذر</Button>
              )}
              {a.status !== 'pending' && (
                <Button size="sm" variant="ghost" onClick={() => setStatus('pending')}><RotateCcw className="w-4 h-4" />رجّعه منتظر</Button>
              )}
              {a.status !== 'excused' && (
                <Button size="sm" variant="ghost" onClick={toggleLock}>
                  {a.locked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  {a.locked ? 'فك التثبيت' : 'ثبّته'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={clear}><UserMinus className="w-4 h-4" />فضّي المكان</Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الاعتذار (اختياري)" className="flex-1 min-w-[180px]" autoFocus />
              <Button size="sm" variant="danger" onClick={() => setStatus('excused', reason.trim())}>سجّل الاعتذار</Button>
              <Button size="sm" variant="ghost" onClick={() => setExcusing(false)}>رجوع</Button>
            </div>
          )}
        </div>
      )}

      {picked && (
        <div className="rounded-xl border border-ok/30 bg-ok-soft p-3 mb-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-ok font-semibold">اتحط الشيخ {picked.name}. ابعت له رسالة بالتكليف علشان يأكد.</span>
          {picked.phone && <LinkButton size="sm" variant="primary" href={msgFor(picked.id)}><MessageCircle className="w-4 h-4" />ابعت له على واتساب</LinkButton>}
        </div>
      )}

      {/* البدلاء */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-lg text-brown-800">{needsReplacement ? 'اختار خطيب' : 'تغيير الخطيب'}</h3>
          <span className="text-xs text-muted">مترتبين من الأنسب</span>
        </div>
        {ok.length === 0 && !showAll && <p className="text-sm text-wait bg-wait-soft rounded-lg p-3 mb-2">مفيش خطيب متاح يناسب كل القواعد. دوس "اعرض الكل" علشان تختار حد مع العلم بالمخالفة.</p>}
        <ul className="space-y-1.5">
          {shown.map((c, i) => (
            <li key={c.preacher.id} className={clsx('flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2', c.blocker ? 'border-sand bg-parchment/50 opacity-75' : i === 0 ? 'border-gold-400 bg-gold-200/30' : 'border-sand bg-white')}>
              <div className="flex-1 min-w-[160px]">
                <div className="font-semibold text-brown-900 flex items-center gap-1.5">
                  {c.preacher.name}
                  {!c.blocker && i === 0 && <Tag tone="gold">الأنسب</Tag>}
                </div>
                <div className="text-[12px] text-muted">
                  {LEVEL_LABEL[c.preacher.level]}
                  {c.blocker ? <span className="text-bad font-semibold"> · {c.blocker}</span> : c.notes.length ? ` · ${c.notes.join(' · ')}` : ''}
                </div>
              </div>
              <Button size="sm" variant={c.blocker ? 'ghost' : 'outline'} onClick={() => pick(c.preacher.id, c.blocker)}>اختار</Button>
            </li>
          ))}
        </ul>
        <button className="text-sm text-brown-700 underline mt-2 cursor-pointer" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'اعرض المناسبين بس' : `اعرض الكل (${candidates.length})`}
        </button>
      </div>
    </Modal>
  );
}
