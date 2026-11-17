import { useState } from 'react';
import { useStore } from '../../data/store.tsx';
import type { Month } from '../../data/types.ts';
import { Button, Input, Modal, clsx, normalizeAr } from '../../ui/kit.tsx';
import { fridaysOf } from '../../data/selectors.ts';
import { gregShort } from '../../lib/hijri.ts';

// ---------------------------------------------------------------------------
// اعتذارات الشهر (قبل التوزيع)
// ---------------------------------------------------------------------------
export function UnavailabilityModal({ month, onClose }: { month: Month; onClose: () => void }) {
  const { data, actions } = useStore();
  const [q, setQ] = useState('');
  const fridays = fridaysOf(month);
  const list = data.preachers
    .filter((p) => p.is_active && (!q || normalizeAr(p.name).includes(normalizeAr(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const daysOf = (pid: number) => data.unavailable.filter((u) => u.month_id === month.id && u.preacher_id === pid).map((u) => u.friday_index);
  const assigned = (pid: number, fi: number) => data.assignments.some((a) => a.month_id === month.id && a.preacher_id === pid && a.friday_index === fi && a.status !== 'excused');

  return (
    <Modal open onClose={onClose} title="اعتذارات الشهر" wide footer={<Button onClick={onClose}>تمام</Button>}>
      <p className="text-sm text-muted mb-3">علّم الجمعات اللي كل خطيب مش هيقدر يخطب فيها الشهر ده. التوزيع التلقائي مش هيحطه فيها.</p>
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الخطيب…" className="mb-3" />
      <div className="divide-y divide-sand border border-sand rounded-xl bg-white">
        {list.map((p) => {
          const days = daysOf(p.id);
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="flex-1 min-w-[140px] font-semibold text-brown-900">{p.name}</span>
              <div className="flex flex-wrap gap-1">
                {fridays.map((f) => {
                  const off = days.includes(f.index);
                  return (
                    <button
                      key={f.index}
                      type="button"
                      onClick={() => actions.setUnavailable(month.id, p.id, off ? days.filter((x) => x !== f.index) : [...days, f.index], '')}
                      className={clsx(
                        'w-14 py-1 rounded-md border text-[12px] cursor-pointer tabular',
                        off ? 'bg-bad-soft border-bad/40 text-bad font-bold line-through' : 'bg-paper border-sand-dark text-brown-700 hover:border-gold-500',
                        assigned(p.id, f.index) && off && 'ring-2 ring-bad'
                      )}
                      title={off ? 'مش متاح، دوس علشان تشيل الاعتذار' : 'متاح، دوس لو معتذر'}
                    >
                      {gregShort(f.date).split(' ')[0]}/{f.index}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-2">الرقم = يوم الجمعة الميلادي / ترتيبها في الشهر. المربع الأحمر المحاط معناه إن الخطيب متكلف فعلًا في الجمعة دي ومحتاج بديل.</p>
    </Modal>
  );
}
