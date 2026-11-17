import { useState } from 'react';
import { Building2, CalendarDays, Database, Download, FlaskConical, Image, LogOut, MessageCircle, Scale, ShieldCheck, FileJson } from 'lucide-react';
import { useStore, setDemoMode } from '../data/store.tsx';
import { LocalRepo } from '../data/localRepo.ts';
import { SUPABASE_PROJECT } from '../data/supabaseRepo.ts';
import { LEVEL_LABEL, SIZE_LABEL } from '../data/types.ts';
import { Button, Card, Field, Input, PageTitle, Tag, clsx } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { signOut, currentUserEmail } from '../auth/session.ts';
import { byId, currentMonth, fridaysOf, sortMonths } from '../data/selectors.ts';
import { fridayOrdinal, gregLong, monthTitle } from '../lib/hijri.ts';
import { navigate } from '../lib/router.ts';
import { downloadWorkbook } from '../lib/excel.ts';
import { isValidPhone } from '../lib/whatsapp.ts';

type Section = 'org' | 'identity' | 'calendar' | 'rules' | 'comms' | 'users' | 'backup';

const SECTIONS: { value: Section; label: string; icon: typeof Building2 }[] = [
  { value: 'org', label: 'بيانات الجمعية', icon: Building2 },
  { value: 'identity', label: 'الهوية والشعار', icon: Image },
  { value: 'calendar', label: 'التقويم الهجري', icon: CalendarDays },
  { value: 'rules', label: 'الجداول والتوزيع', icon: Scale },
  { value: 'comms', label: 'التواصل', icon: MessageCircle },
  { value: 'users', label: 'المستخدمون والصلاحيات', icon: ShieldCheck },
  { value: 'backup', label: 'النسخ الاحتياطي', icon: Database },
];

/** قواعد التوزيع الحالية كما هي في src/lib/engine.ts (للعرض بس) */
const HARD_RULES = [
  'الخطيب في مسجد واحد بس في نفس الجمعة.',
  'الخطيب المعتذر أو المتوقف أو اللي مش متاح في الجمعة دي ما يتحطش.',
  'المسجد الرافض لخطيب ما يتحطش فيه.',
  'الخطيب ما يتكررش في نفس المسجد في نفس الشهر (ما عدا الخطيب الثابت).',
  'الخطيب ما يعدّيش أقصى عدد جمعات حدده (ما عدا الخطيب الثابت).',
  'الخطيب الجديد ما يروحش المسجد الكبير.',
];
const PRIORITIES = [
  'الخطيب الثابت الأول.',
  'العدالة: اللي أخد جمعات أقل ياخد الأول.',
  'التنوع: المسجد يسمع خطباء مختلفين عن آخر شهرين.',
  'الخبرة الكبيرة للمساجد الكبيرة، والجديد للمساجد الصغيرة.',
  'رغبة المسجد في خطيب معين.',
  'لما الخطباء يقلوا، المساجد الكبيرة تتملي الأول.',
];

export function SettingsPage() {
  const { data, actions, repo, toast } = useStore();
  const confirm = useConfirm();
  const [section, setSection] = useState<Section>('org');
  const [s, setS] = useState(data.settings);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof s, v: string) => setS((x) => ({ ...x, [k]: v }));
  const email = currentUserEmail();
  const dirty = JSON.stringify(s) !== JSON.stringify(data.settings);
  const phoneErr = s.admin_phone && !isValidPhone(s.admin_phone) ? 'الرقم مش بصيغة صحيحة (مثال: 01012345678)' : undefined;
  const month = currentMonth(data.months);

  const save = async () => {
    if (!s.org_name.trim()) return toast('اسم الجمعية مطلوب', 'error');
    setSaving(true);
    await actions.saveSettings({ ...s, org_name: s.org_name.trim(), branch_name: s.branch_name.trim(), admin_name: s.admin_name.trim(), admin_phone: s.admin_phone.trim() });
    setSaving(false);
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const backupExcel = async () => {
    try {
      const mosques = byId(data.mosques);
      const preachers = byId(data.preachers);
      const months = byId(data.months);
      await downloadWorkbook(`نسخة-احتياطية-${stamp}.xlsx`, [
        { name: 'المساجد', rows: [['الكود', 'الاسم', 'الحجم', 'التليفون', 'المسؤول', 'الجمعات المطلوبة', 'نشط', 'ملاحظات'], ...data.mosques.map((m) => [m.id, m.name, SIZE_LABEL[m.size], m.phone, m.contact_name, (m.needed_fridays ?? []).join(',') || 'الكل', m.is_active ? 'نعم' : 'لا', m.notes])] },
        { name: 'الخطباء', rows: [['الكود', 'الاسم', 'الموبايل', 'الخبرة', 'أقصى جمعات', 'متاح في', 'نشط', 'ملاحظات'], ...data.preachers.map((p) => [p.id, p.name, p.phone, LEVEL_LABEL[p.level], p.max_fridays, (p.available_fridays ?? []).join(',') || 'الكل', p.is_active ? 'نعم' : 'لا', p.notes])] },
        { name: 'الثوابت', rows: [['المسجد', 'الخطيب', 'الجمعة'], ...data.fixed.map((f) => [mosques.get(f.mosque_id)?.name ?? f.mosque_id, preachers.get(f.preacher_id)?.name ?? f.preacher_id, f.friday_index ? fridayOrdinal(f.friday_index) : 'كل الجمعات'])] },
        { name: 'الرغبات', rows: [['المسجد', 'الخطيب', 'النوع'], ...data.preferences.map((f) => [mosques.get(f.mosque_id)?.name ?? f.mosque_id, preachers.get(f.preacher_id)?.name ?? f.preacher_id, f.kind === 'prefer' ? 'طالبه' : 'رافضه'])] },
        { name: 'الشهور', rows: [['الشهر', 'البداية', 'الأيام', 'الحالة'], ...sortMonths(data.months).map((m) => [monthTitle(m.hijri_year, m.hijri_month), m.start_date, m.days_count, m.status === 'published' ? 'منشور' : 'مسودة'])] },
        {
          name: 'التكليفات',
          rows: [
            ['الشهر', 'المسجد', 'الجمعة', 'الخطيب', 'الحالة', 'المصدر', 'سبب الاعتذار'],
            ...data.assignments.map((a) => {
              const m = months.get(a.month_id);
              return [m ? monthTitle(m.hijri_year, m.hijri_month) : a.month_id, mosques.get(a.mosque_id)?.name ?? a.mosque_id, fridayOrdinal(a.friday_index), a.preacher_id ? preachers.get(a.preacher_id)?.name ?? a.preacher_id : '', { pending: 'منتظر', confirmed: 'مؤكد', excused: 'معتذر' }[a.status], { fixed: 'ثابت', auto: 'تلقائي', manual: 'يدوي' }[a.source], a.excuse_reason];
            }),
          ],
        },
      ]);
      toast('اتنزلت النسخة الاحتياطية');
    } catch (e) {
      toast(`ما قدرتش أعمل الملف: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };

  const backupJson = () => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة-احتياطية-${stamp}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('اتنزل ملف JSON');
  };

  const content = () => {
    switch (section) {
      case 'org':
        return (
          <Card title="بيانات الجمعية" subtitle="بتظهر في البرنامج والرسائل وملفات PDF وصفحة الخطيب">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="اسم الجمعية" error={!s.org_name.trim() ? 'الاسم مطلوب' : undefined}>
                <Input id="org-name" value={s.org_name} onChange={(e) => set('org_name', e.target.value)} aria-invalid={!s.org_name.trim()} />
              </Field>
              <Field label="الفرع (اختياري)">
                <Input id="branch-name" value={s.branch_name} onChange={(e) => set('branch_name', e.target.value)} />
              </Field>
              <Field label="اسم مسؤول الدعوة" hint="بيظهر في التحية وتوقيع الرسائل وصفحة الخطيب">
                <Input id="admin-name" value={s.admin_name} onChange={(e) => set('admin_name', e.target.value)} />
              </Field>
              <Field label="موبايل مسؤول الدعوة (واتساب)" hint="الخطيب يقدر يكلمك منه من صفحته" error={phoneErr}>
                <Input id="admin-phone" value={s.admin_phone} onChange={(e) => set('admin_phone', e.target.value)} dir="ltr" className="text-right" inputMode="tel" aria-invalid={Boolean(phoneErr)} />
              </Field>
            </div>
            <div className="flex items-center gap-3 mt-5">
              <Button onClick={save} loading={saving} disabled={!dirty || !s.org_name.trim()}>حفظ التغييرات</Button>
              {dirty && <Button variant="ghost" onClick={() => setS(data.settings)}>تراجع</Button>}
              {!dirty && <span className="text-[12.5px] text-muted">كل التغييرات محفوظة</span>}
            </div>
          </Card>
        );
      case 'identity':
        return (
          <Card title="الهوية والشعار">
            <div className="flex flex-wrap items-center gap-5">
              <img src="/aljameya-logo.png" alt="شعار الجمعية" className="w-24 h-24 rounded-full bg-paper ring-2 ring-gold-400 p-1 object-contain" />
              <div className="text-sm space-y-1.5">
                <div><b>الألوان:</b> بني داكن، ذهبي، رق، أخضر إسلامي (نظام الألوان الرسمي).</div>
                <div><b>الخطوط:</b> IBM Plex Sans Arabic للواجهة، وأميري للعناوين.</div>
                <div className="text-muted">الشعار ملف ثابت في البرنامج (public/aljameya-logo.png). تغييره بيكون بتحديث الملف ده.</div>
              </div>
            </div>
          </Card>
        );
      case 'calendar':
        return (
          <Card title="التقويم الهجري">
            <div className="text-sm space-y-3">
              <p>بداية كل شهر بتتحسب مبدئيًا بتقويم <b>أم القرى</b>. بعد إعلان <b>دار الإفتاء</b>، تقدر تقدّم أو تأخر بداية الشهر يوم، وتختار 29 أو 30 يوم، من "بداية الشهر" في صفحة الجدول.</p>
              {month && (
                <div className="rounded-xl border border-border bg-paper p-4">
                  <div className="font-semibold">{monthTitle(month.hijri_year, month.hijri_month)}</div>
                  <div className="text-muted text-[13px]">يبدأ {gregLong(month.start_date)} · {month.days_count} يوم · {fridaysOf(month).length} جمعات</div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate(`/schedule?month=${month.id}`)}>افتح الجدول وعدّل البداية</Button>
                </div>
              )}
              <p className="text-[12.5px] text-muted">التاريخ اللي فوق في الشريط العلوي تقريبي حسب أم القرى، وبيتحسب بتوقيت القاهرة.</p>
            </div>
          </Card>
        );
      case 'rules':
        return (
          <Card title="قواعد الجداول والتوزيع" subtitle="القواعد المطبقة حاليًا في التوزيع التلقائي (للعرض)">
            <div className="grid lg:grid-cols-2 gap-5 text-sm">
              <div>
                <div className="font-semibold text-bad mb-2">قواعد لازمة</div>
                <ul className="space-y-1.5 list-disc pr-5 marker:text-gold-500">{HARD_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
              <div>
                <div className="font-semibold text-brown-800 mb-2">أولويات الترتيب</div>
                <ul className="space-y-1.5 list-disc pr-5 marker:text-gold-500">{PRIORITIES.map((r) => <li key={r}>{r}</li>)}</ul>
              </div>
            </div>
            <p className="text-[12.5px] text-muted mt-4">الإعدادات الخاصة بكل خطيب (الحد الأقصى، الجمعات المتاحة، الخبرة) وكل مسجد (الحجم، الجمعات المطلوبة، الخطيب الثابت، الرغبات) بتتعدل من صفحاتهم. التوزيع التلقائي اقتراح، والقرار النهائي ليك.</p>
          </Card>
        );
      case 'comms':
        return (
          <Card title="التواصل">
            <div className="text-sm space-y-2">
              <p>الرسائل بتتبعت على <b>واتساب</b> من جهازك، ومعاها ملف PDF بالجدول أو خطاب التكليف. البرنامج بيجهز الرسالة وانت اللي بتدوس إرسال.</p>
              <p>توقيع الرسائل: <b>{data.settings.admin_name || 'مسؤول الدعوة'}</b> · {data.settings.org_name}{data.settings.branch_name && ` — ${data.settings.branch_name}`}</p>
              <p className="text-[12.5px] text-muted">تعديل الاسم ورقم المسؤول من "بيانات الجمعية".</p>
              <Button size="sm" variant="outline" onClick={() => navigate('/messages')}>افتح مركز الإرسال</Button>
            </div>
          </Card>
        );
      case 'users':
        return (
          <Card title="المستخدمون والصلاحيات">
            <div className="text-sm space-y-3">
              {repo.kind === 'demo' ? (
                <p>وضع تجريبي: مفيش تسجيل دخول.</p>
              ) : (
                <p>داخل بحساب <b dir="ltr">{email}</b> <Tag tone="ok">مسؤول</Tag></p>
              )}
              <p className="text-muted text-[12.5px]">الدخول بالبريد وكلمة المرور (Supabase). المسؤولين المسموح لهم متسجلين في جدول <span dir="ltr">fs_admins</span>، ومحدش غيرهم يقدر يقرا أو يعدّل البيانات. إضافة مسؤول جديد بتتعمل من Supabase. صفحة كل خطيب بتشتغل برابطه الخاص بس، ومش بتكشف بيانات حد تاني.</p>
              {email && (
                <Button variant="outline" onClick={() => signOut().then(() => location.reload())}>
                  <LogOut className="w-4 h-4" />
                  تسجيل الخروج
                </Button>
              )}
            </div>
          </Card>
        );
      case 'backup':
        return (
          <Card title="النسخ الاحتياطي">
            <ul className="text-sm space-y-1.5 mb-4">
              <li>{data.mosques.length} مسجد، {data.preachers.length} خطيب، {data.fixed.length} خطيب ثابت، {data.preferences.length} رغبة</li>
              <li>{data.months.length} شهر، {data.assignments.length} تكليف، {data.log.length} عملية في السجل (آخر 500)</li>
              <li className="flex items-center gap-1.5 text-muted">
                {repo.kind === 'demo' ? <FlaskConical className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                {repo.kind === 'demo' ? 'وضع تجريبي: البيانات في المتصفح ده بس' : <>محفوظة في Supabase · مشروع <b dir="ltr">{SUPABASE_PROJECT}</b></>}
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button variant="gold" onClick={backupExcel}><Download className="w-4 h-4" />تنزيل نسخة إكسل</Button>
              <Button variant="outline" onClick={backupJson}><FileJson className="w-4 h-4" />تنزيل نسخة JSON</Button>
            </div>
            <p className="text-[12.5px] text-muted mt-3">النسخة بتنزل على جهازك بس. Supabase كمان بيعمل نسخ احتياطية يومية من لوحة التحكم بتاعته.</p>
            {repo.kind === 'demo' && (
              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => { setDemoMode(false); location.href = '/'; }}>الخروج من الوضع التجريبي</Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (await confirm({ title: 'إعادة البيانات التجريبية', body: 'كل اللي عملته في الوضع التجريبي هيتمسح ويرجع لأوله.', confirmText: 'رجّعها', danger: true })) {
                      LocalRepo.reset();
                      location.reload();
                    }
                  }}
                >
                  رجّع البيانات التجريبية لأولها
                </Button>
              </div>
            )}
          </Card>
        );
    }
  };

  return (
    <>
      <PageTitle title="الإعدادات" />
      <div className="grid lg:grid-cols-[240px_1fr] gap-4 items-start">
        <nav className="bg-card border border-border rounded-[var(--radius-card)] p-1.5 shadow-[var(--shadow-card)] flex lg:flex-col gap-1 overflow-x-auto scroll-soft" aria-label="أقسام الإعدادات">
          {SECTIONS.map((x) => (
            <button
              key={x.value}
              onClick={() => setSection(x.value)}
              aria-current={section === x.value ? 'page' : undefined}
              className={clsx('shrink-0 flex items-center gap-2.5 h-11 px-3 rounded-[10px] text-sm cursor-pointer text-right', section === x.value ? 'bg-brown-800 text-white font-medium' : 'text-ink hover:bg-brown-50')}
            >
              <x.icon className={clsx('w-4 h-4', section === x.value ? 'text-gold-300' : 'text-muted')} />
              {x.label}
            </button>
          ))}
        </nav>
        <div>{content()}</div>
      </div>
    </>
  );
}
