import type { Settings } from './types.ts';

export const DEFAULT_SETTINGS: Settings = {
  org_name: 'الجمعية الشرعية',
  branch_name: 'فرع منشأة البكاري',
  admin_name: 'عبدالرحمن',
  admin_phone: '',
};

/** الإعدادات المحفوظة فوق الافتراضية؛ الخانة الفاضية بتاخد القيمة الافتراضية */
export function withDefaults(saved: Partial<Settings> | null | undefined): Settings {
  const out = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(out) as (keyof Settings)[]) {
    const v = saved?.[k];
    if (typeof v === 'string' && v.trim()) out[k] = v;
  }
  return out;
}
