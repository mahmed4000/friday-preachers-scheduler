// سجل العمليات: أنواع العمليات ووصف التغييرات (القيمة القديمة ← الجديدة).
// بيتسجل في جدول fs_log الموجود (action + details) من غير أي تغيير في قاعدة البيانات.
import type { Mosque, Preacher, Settings } from './types.ts';
import { LEVEL_LABEL, SIZE_LABEL } from './types.ts';
import { fridayOrdinal } from '../lib/hijri.ts';

export type LogKind = 'assignment' | 'schedule' | 'data' | 'message' | 'settings';

export const ACTIONS: Record<string, { label: string; kind: LogKind }> = {
  excuse: { label: 'اعتذار', kind: 'assignment' },
  confirm: { label: 'تأكيد', kind: 'assignment' },
  replace: { label: 'تغيير تكليف', kind: 'assignment' },
  distribute: { label: 'توزيع', kind: 'schedule' },
  publish: { label: 'نشر جدول', kind: 'schedule' },
  month_create: { label: 'إنشاء شهر', kind: 'schedule' },
  month_edit: { label: 'تعديل بداية الشهر', kind: 'schedule' },
  month_delete: { label: 'مسح شهر', kind: 'schedule' },
  preacher_add: { label: 'إضافة خطيب', kind: 'data' },
  preacher_edit: { label: 'تعديل خطيب', kind: 'data' },
  preacher_delete: { label: 'مسح خطيب', kind: 'data' },
  mosque_add: { label: 'إضافة مسجد', kind: 'data' },
  mosque_edit: { label: 'تعديل مسجد', kind: 'data' },
  mosque_delete: { label: 'مسح مسجد', kind: 'data' },
  settings: { label: 'تعديل الإعدادات', kind: 'settings' },
  message_sent: { label: 'إرسال رسالة', kind: 'message' },
};

export const KIND_LABEL: Record<LogKind, string> = {
  assignment: 'التكليفات',
  schedule: 'الجداول',
  data: 'الخطباء والمساجد',
  message: 'الرسائل',
  settings: 'الإعدادات',
};

export function actionLabel(action: string): string {
  return ACTIONS[action]?.label ?? action;
}

const fridays = (v: number[] | null) => (!v || !v.length ? 'كل الجمعات' : v.map((x) => fridayOrdinal(x).replace('الجمعة ', '')).join(' و'));
const yesNo = (v: boolean) => (v ? 'نشط' : 'متوقف');
const text = (v: string) => (v?.trim() ? v.trim() : '—');

type Diff<T> = { [K in keyof T]?: [label: string, fmt: (v: any) => string] };

const PREACHER_FIELDS: Diff<Preacher> = {
  name: ['الاسم', text],
  phone: ['الموبايل', text],
  level: ['الخبرة', (v) => LEVEL_LABEL[v as Preacher['level']]],
  max_fridays: ['أقصى جمعات', String],
  available_fridays: ['متاح في', fridays],
  is_active: ['الحالة', yesNo],
  notes: ['الملاحظات', text],
};

const MOSQUE_FIELDS: Diff<Mosque> = {
  name: ['الاسم', text],
  size: ['الحجم', (v) => SIZE_LABEL[v as Mosque['size']]],
  phone: ['التليفون', text],
  contact_name: ['المسؤول', text],
  needed_fridays: ['محتاج خطيب في', fridays],
  is_active: ['الحالة', yesNo],
  notes: ['الملاحظات', text],
};

const SETTINGS_FIELDS: Diff<Settings> = {
  org_name: ['اسم الجمعية', text],
  branch_name: ['الفرع', text],
  admin_name: ['اسم المسؤول', text],
  admin_phone: ['موبايل المسؤول', text],
};

function diff<T>(fields: Diff<T>, before: Partial<T>, after: Partial<T>): string[] {
  const out: string[] = [];
  for (const k of Object.keys(fields) as (keyof T)[]) {
    const [label, fmt] = fields[k]!;
    const a = fmt(before[k] ?? null);
    const b = fmt(after[k] ?? null);
    if (a !== b) out.push(`${label}: ${a} ← ${b}`);
  }
  return out;
}

export const diffPreacher = (a: Partial<Preacher>, b: Partial<Preacher>) => diff(PREACHER_FIELDS, a, b);
export const diffMosque = (a: Partial<Mosque>, b: Partial<Mosque>) => diff(MOSQUE_FIELDS, a, b);
export const diffSettings = (a: Partial<Settings>, b: Partial<Settings>) => diff(SETTINGS_FIELDS, a, b);
