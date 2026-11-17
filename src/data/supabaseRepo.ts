import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Repo, PortalData } from './repo.ts';
import type { AppData, Assignment, FixedRule, LogEntry, Month, Mosque, Preacher, Preference, Settings, Unavailable } from './types.ts';
import { DEFAULT_SETTINGS } from './defaults.ts';

// عنوان المشروع والمفتاح العام (publishable). المفتاح ده مصمم إنه يتحط في المتصفح؛
// الحماية الحقيقية من سياسات Supabase (ملف supabase/02_security.sql).
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_KEY__: string;

// المشروع الافتراضي (للتطوير المحلي بس). على Vercel القيم بتيجي من SUPABASE_URL و SUPABASE_ANON_KEY.
const DEV_URL = 'https://tctaqmtvypibxsaehawf.supabase.co';
const DEV_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRjdGFxbXR2eXBpYnhzYWVoYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjUyNDAsImV4cCI6MjEwNjY0MTI0MH0.LKXvP_kpWNiVmMZK9zWdJev43a489IPtffNqbldnFlg';
const hasEnv = Boolean(__SUPABASE_URL__ && __SUPABASE_KEY__);
const URL = hasEnv ? __SUPABASE_URL__ : DEV_URL;
const KEY = hasEnv ? __SUPABASE_KEY__ : DEV_KEY;

/** رقم مشروع Supabase اللي البرنامج متوصل بيه (بيظهر في الإعدادات علشان تتأكد) */
export const SUPABASE_PROJECT = URL.replace(/^https?:\/\//, '').split('.')[0];

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!client) client = createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}

/** خطأ بيوضح إن جداول البرنامج الجديد لسه ما اتعملتش في Supabase */
export class SetupRequiredError extends Error {
  constructor() {
    super('جداول البرنامج لسه ما اتعملتش في Supabase');
  }
}

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const code = res.error.code || '';
    if (code === '42P01' || code === 'PGRST205' || /does not exist|schema cache/i.test(res.error.message)) throw new SetupRequiredError();
    throw new Error(res.error.message);
  }
  return res.data;
}

const num = (r: any): any => ({ ...r, id: Number(r.id) });

export class SupabaseRepo implements Repo {
  readonly kind = 'supabase' as const;
  private db = supabase();

  async loadAll(): Promise<AppData> {
    const q = (t: string) => this.db.from(t).select('*').order('id');
    const [s, mosques, preachers, fixed, preferences, months, unavailable, assignments, log] = await Promise.all([
      this.db.from('fs_settings').select('*').eq('id', 1).maybeSingle(),
      q('fs_mosques'), q('fs_preachers'), q('fs_fixed'), q('fs_preferences'), q('fs_months'), q('fs_unavailable'), q('fs_assignments'),
      this.db.from('fs_log').select('*').order('id', { ascending: false }).limit(500),
    ]);
    const settingsRow = check(s) as Partial<Settings> | null;
    const ids = (rows: any[], fields: string[] = []) =>
      rows.map((r) => {
        const o = num(r);
        for (const f of fields) if (o[f] != null) o[f] = Number(o[f]);
        return o;
      });
    return {
      settings: { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) },
      mosques: ids(check(mosques) as any[]) as Mosque[],
      preachers: ids(check(preachers) as any[]) as Preacher[],
      fixed: ids(check(fixed) as any[], ['mosque_id', 'preacher_id']) as FixedRule[],
      preferences: ids(check(preferences) as any[], ['mosque_id', 'preacher_id']) as Preference[],
      months: ids(check(months) as any[]) as Month[],
      unavailable: ids(check(unavailable) as any[], ['month_id', 'preacher_id']) as Unavailable[],
      assignments: ids(check(assignments) as any[], ['month_id', 'mosque_id', 'preacher_id']) as Assignment[],
      log: ids(check(log) as any[], ['month_id', 'preacher_id']) as LogEntry[],
    };
  }

  async saveSettings(s: Settings) {
    check(await this.db.from('fs_settings').upsert({ id: 1, ...s, updated_at: new Date().toISOString() }));
  }

  async saveMosque(m: Omit<Mosque, 'id'> & { id?: number }) {
    const row = check(await this.db.from('fs_mosques').upsert(m).select().single());
    return num(row) as Mosque;
  }

  async deleteMosque(id: number) {
    check(await this.db.from('fs_mosques').delete().eq('id', id));
  }

  async savePreacher(p: Omit<Preacher, 'id' | 'portal_token'> & { id?: number }) {
    const row = check(await this.db.from('fs_preachers').upsert(p).select().single());
    return num(row) as Preacher;
  }

  async deletePreacher(id: number) {
    check(await this.db.from('fs_preachers').delete().eq('id', id));
  }

  async setFixed(mosqueId: number, rules: Omit<FixedRule, 'id' | 'mosque_id'>[]) {
    check(await this.db.from('fs_fixed').delete().eq('mosque_id', mosqueId));
    if (!rules.length) return [];
    const rows = check(await this.db.from('fs_fixed').insert(rules.map((r) => ({ ...r, mosque_id: mosqueId }))).select()) as any[];
    return rows.map((r) => ({ ...num(r), mosque_id: Number(r.mosque_id), preacher_id: Number(r.preacher_id) }));
  }

  async setPreferences(mosqueId: number, prefs: Omit<Preference, 'id' | 'mosque_id'>[]) {
    check(await this.db.from('fs_preferences').delete().eq('mosque_id', mosqueId));
    if (!prefs.length) return [];
    const rows = check(await this.db.from('fs_preferences').insert(prefs.map((p) => ({ ...p, mosque_id: mosqueId }))).select()) as any[];
    return rows.map((r) => ({ ...num(r), mosque_id: Number(r.mosque_id), preacher_id: Number(r.preacher_id) }));
  }

  async createMonth(m: Omit<Month, 'id' | 'status' | 'published_at'>) {
    return num(check(await this.db.from('fs_months').insert(m).select().single())) as Month;
  }

  async updateMonth(id: number, patch: Partial<Omit<Month, 'id'>>) {
    return num(check(await this.db.from('fs_months').update(patch).eq('id', id).select().single())) as Month;
  }

  async deleteMonth(id: number) {
    check(await this.db.from('fs_months').delete().eq('id', id));
  }

  async setUnavailable(monthId: number, preacherId: number, fridays: number[], reason: string) {
    check(await this.db.from('fs_unavailable').delete().eq('month_id', monthId).eq('preacher_id', preacherId));
    if (!fridays.length) return [];
    const rows = check(
      await this.db
        .from('fs_unavailable')
        .insert(fridays.map((f) => ({ month_id: monthId, preacher_id: preacherId, friday_index: f, reason })))
        .select()
    ) as any[];
    return rows.map((r) => ({ ...num(r), month_id: Number(r.month_id), preacher_id: Number(r.preacher_id) }));
  }

  async upsertAssignments(rows: (Omit<Assignment, 'id'> & { id?: number })[]) {
    if (!rows.length) return [];
    const clean = rows.map(({ id: _id, ...r }) => ({ ...r, updated_at: new Date().toISOString() }));
    const out = check(await this.db.from('fs_assignments').upsert(clean, { onConflict: 'month_id,mosque_id,friday_index' }).select()) as any[];
    return out.map((r) => ({ ...num(r), month_id: Number(r.month_id), mosque_id: Number(r.mosque_id), preacher_id: r.preacher_id == null ? null : Number(r.preacher_id) })) as Assignment[];
  }

  async deleteAssignments(ids: number[]) {
    if (!ids.length) return;
    check(await this.db.from('fs_assignments').delete().in('id', ids));
  }

  async addLog(e: Omit<LogEntry, 'id' | 'created_at'>) {
    return num(check(await this.db.from('fs_log').insert(e).select().single())) as LogEntry;
  }

  async portalGet(token: string) {
    return check(await this.db.rpc('portal_get', { p_token: token })) as PortalData | null;
  }

  async portalSetStatus(token: string, assignmentId: number, status: 'confirmed' | 'excused', reason: string) {
    return Boolean(check(await this.db.rpc('portal_set_status', { p_token: token, p_assignment_id: assignmentId, p_status: status, p_reason: reason })));
  }
}
