import { useState } from 'react';
import { Database, FlaskConical, LogOut } from 'lucide-react';
import { useStore, setDemoMode } from '../data/store.tsx';
import { LocalRepo } from '../data/localRepo.ts';
import { Button, Card, Field, Input, PageTitle } from '../ui/kit.tsx';
import { useConfirm } from '../ui/confirm.tsx';
import { signOut, currentUserEmail } from '../auth/session.ts';

export function SettingsPage() {
  const { data, actions, repo } = useStore();
  const confirm = useConfirm();
  const [s, setS] = useState(data.settings);
  const set = (k: keyof typeof s, v: string) => setS((x) => ({ ...x, [k]: v }));
  const email = currentUserEmail();

  return (
    <>
      <PageTitle title="الإعدادات" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="بيانات الجمعية">
          <div className="space-y-4">
            <Field label="اسم الجمعية">
              <Input id="org-name" value={s.org_name} onChange={(e) => set('org_name', e.target.value)} />
            </Field>
            <Field label="الفرع (اختياري)">
              <Input id="branch-name" value={s.branch_name} onChange={(e) => set('branch_name', e.target.value)} />
            </Field>
            <Field label="اسم مسؤول الدعوة" hint="بيظهر للخطيب في صفحته">
              <Input id="admin-name" value={s.admin_name} onChange={(e) => set('admin_name', e.target.value)} />
            </Field>
            <Field label="موبايل مسؤول الدعوة (واتساب)" hint="الخطيب يقدر يكلمك منه لما يعتذر أو يأكد من صفحته">
              <Input id="admin-phone" value={s.admin_phone} onChange={(e) => set('admin_phone', e.target.value)} dir="ltr" className="text-right" inputMode="tel" />
            </Field>
            <Button onClick={() => actions.saveSettings(s)}>حفظ</Button>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="البيانات">
            <ul className="text-sm space-y-1.5 mb-4">
              <li>{data.mosques.length} مسجد، {data.preachers.length} خطيب</li>
              <li>{data.months.length} شهر، {data.assignments.length} تكليف</li>
              <li className="flex items-center gap-1.5 text-muted">
                {repo.kind === 'demo' ? <FlaskConical className="w-4 h-4" /> : <Database className="w-4 h-4" />}
                {repo.kind === 'demo' ? 'وضع تجريبي: البيانات في المتصفح ده بس' : 'محفوظة في Supabase'}
              </li>
            </ul>
            {repo.kind === 'demo' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDemoMode(false);
                    location.href = '/';
                  }}
                >
                  الخروج من الوضع التجريبي
                </Button>
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

          {email && (
            <Card title="الحساب">
              <p className="text-sm mb-3">داخل بحساب <b dir="ltr">{email}</b></p>
              <Button variant="outline" onClick={() => signOut().then(() => location.reload())}>
                <LogOut className="w-4 h-4" />
                تسجيل الخروج
              </Button>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
