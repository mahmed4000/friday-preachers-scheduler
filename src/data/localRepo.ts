import type { Repo, PortalData, AssignmentRow } from './repo.ts';
import type { AppData, Assignment, FixedRule, LogEntry, Month, Mosque, Preacher, Preference, Settings, Unavailable } from './types.ts';
import { DEFAULT_SETTINGS } from './defaults.ts';
import { addDays, diffDays, monthFridays, todayIso, umalqura, umalquraMonth } from '../lib/hijri.ts';

// الوضع التجريبي: البيانات بتتحفظ في المتصفح بس، علشان تجرب البرنامج من غير ما تلمس البيانات الحقيقية.
const KEY = 'fs_demo_data_v1';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoData(): AppData {
  const mosqueNames: [string, Mosque['size']][] = [
    ['مسجد الرحمن الرحيم', 'large'], ['مسجد الحبيب', 'medium'], ['مسجد النور', 'large'], ['مسجد التوحيد', 'medium'],
    ['مسجد الهدى', 'small'], ['مسجد السلام', 'medium'], ['مسجد الفتح', 'small'], ['مسجد الإيمان', 'medium'],
    ['مسجد الرحمة', 'small'], ['مسجد التقوى', 'medium'], ['مسجد الفرقان', 'large'], ['مسجد الصحابة', 'small'],
  ];
  const preacherNames = [
    'أشرف مصطفى', 'محمود عبد الحليم', 'أحمد السيد', 'خالد إبراهيم', 'عمر فاروق', 'ياسر عبد الله', 'حسن الشافعي', 'مصطفى كامل',
    'إبراهيم سعد', 'عبد الرحمن جمال', 'طارق منصور', 'سامح عبد العزيز', 'وليد حمدي', 'هشام فتحي', 'رضا عبد السلام', 'أيمن رشاد',
    'محمد عادل', 'عبد الله يوسف', 'كريم صلاح', 'أنس محمود',
  ];
  const mosques: Mosque[] = mosqueNames.map(([name, size], i) => ({
    id: i + 1, name, size, phone: `0100000${String(i + 1).padStart(4, '0')}`, contact_name: '',
    needed_fridays: i === 11 ? [1, 3] : null, is_active: true, notes: '',
  }));
  const preachers: Preacher[] = preacherNames.map((name, i) => ({
    id: i + 1, name, phone: `0111000${String(i + 1).padStart(4, '0')}`,
    level: i < 6 ? 'senior' : i > 15 ? 'new' : 'mid',
    max_fridays: i % 5 === 0 ? 3 : 2, available_fridays: i === 7 ? [1, 2] : null,
    is_active: true, notes: '', portal_token: uuid(),
  }));
  const fixed: FixedRule[] = [
    { id: 1, mosque_id: 1, preacher_id: 1, friday_index: 1 },
    { id: 2, mosque_id: 2, preacher_id: 1, friday_index: 2 },
    { id: 3, mosque_id: 3, preacher_id: 2, friday_index: null },
  ];
  const preferences: Preference[] = [
    { id: 1, mosque_id: 11, preacher_id: 3, kind: 'prefer' },
    { id: 2, mosque_id: 5, preacher_id: 9, kind: 'avoid' },
  ];
  const h = umalqura(todayIso());
  const cur = umalquraMonth(h.year, h.month);
  const months: Month[] = [{ id: 1, hijri_year: h.year, hijri_month: h.month, start_date: cur.start, days_count: cur.days, status: 'draft', published_at: null }];
  return {
    settings: { ...DEFAULT_SETTINGS, admin_name: 'عبدالرحمن', admin_phone: '01000000000' },
    mosques, preachers, fixed, preferences, months, unavailable: [], assignments: [], log: [],
  };
}

export class LocalRepo implements Repo {
  readonly kind = 'demo' as const;
  private data: AppData;

  constructor() {
    let stored: AppData | null = null;
    try {
      stored = JSON.parse(localStorage.getItem(KEY) || 'null');
    } catch {
      stored = null;
    }
    this.data = stored ?? demoData();
    this.persist();
  }

  static reset() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* ignore */
    }
  }

  private nextId(list: { id: number }[]) {
    return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
  }

  private done<T>(v: T): Promise<T> {
    this.persist();
    return Promise.resolve(structuredClone(v));
  }

  async loadAll() {
    return structuredClone(this.data);
  }

  async saveSettings(s: Settings) {
    this.data.settings = { ...s };
    return this.done(undefined);
  }

  async saveMosque(m: Omit<Mosque, 'id'> & { id?: number }) {
    const list = this.data.mosques;
    const row: Mosque = { ...(m as Mosque), id: m.id ?? this.nextId(list) };
    const i = list.findIndex((x) => x.id === row.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
    return this.done(row);
  }

  async deleteMosque(id: number) {
    const d = this.data;
    d.mosques = d.mosques.filter((x) => x.id !== id);
    d.fixed = d.fixed.filter((x) => x.mosque_id !== id);
    d.preferences = d.preferences.filter((x) => x.mosque_id !== id);
    d.assignments = d.assignments.filter((x) => x.mosque_id !== id);
    return this.done(undefined);
  }

  async savePreacher(p: Omit<Preacher, 'id' | 'portal_token'> & { id?: number }) {
    const list = this.data.preachers;
    const existing = list.find((x) => x.id === p.id);
    const row: Preacher = { ...(p as Preacher), id: p.id ?? this.nextId(list), portal_token: existing?.portal_token ?? uuid() };
    if (existing) list[list.indexOf(existing)] = row;
    else list.push(row);
    return this.done(row);
  }

  async deletePreacher(id: number) {
    const d = this.data;
    d.preachers = d.preachers.filter((x) => x.id !== id);
    d.fixed = d.fixed.filter((x) => x.preacher_id !== id);
    d.preferences = d.preferences.filter((x) => x.preacher_id !== id);
    d.unavailable = d.unavailable.filter((x) => x.preacher_id !== id);
    d.assignments = d.assignments.map((a) => (a.preacher_id === id ? { ...a, preacher_id: null } : a));
    return this.done(undefined);
  }

  async setFixed(mosqueId: number, rules: Omit<FixedRule, 'id' | 'mosque_id'>[]) {
    const d = this.data;
    d.fixed = d.fixed.filter((x) => x.mosque_id !== mosqueId);
    let id = this.nextId(d.fixed);
    const rows = rules.map((r) => ({ ...r, mosque_id: mosqueId, id: id++ }));
    d.fixed.push(...rows);
    return this.done(rows);
  }

  async setPreferences(mosqueId: number, prefs: Omit<Preference, 'id' | 'mosque_id'>[]) {
    const d = this.data;
    d.preferences = d.preferences.filter((x) => x.mosque_id !== mosqueId);
    let id = this.nextId(d.preferences);
    const rows = prefs.map((p) => ({ ...p, mosque_id: mosqueId, id: id++ }));
    d.preferences.push(...rows);
    return this.done(rows);
  }

  async createMonth(m: Omit<Month, 'id' | 'status' | 'published_at'>) {
    if (this.data.months.some((x) => x.hijri_year === m.hijri_year && x.hijri_month === m.hijri_month)) {
      throw new Error('الشهر ده موجود بالفعل');
    }
    const row: Month = { ...m, id: this.nextId(this.data.months), status: 'draft', published_at: null };
    this.data.months.push(row);
    return this.done(row);
  }

  async updateMonth(id: number, patch: Partial<Omit<Month, 'id'>>) {
    const m = this.data.months.find((x) => x.id === id);
    if (!m) throw new Error('الشهر مش موجود');
    Object.assign(m, patch);
    return this.done(m);
  }

  async deleteMonth(id: number) {
    const d = this.data;
    d.months = d.months.filter((x) => x.id !== id);
    d.assignments = d.assignments.filter((x) => x.month_id !== id);
    d.unavailable = d.unavailable.filter((x) => x.month_id !== id);
    return this.done(undefined);
  }

  async setUnavailable(monthId: number, preacherId: number, fridays: number[], reason: string) {
    const d = this.data;
    d.unavailable = d.unavailable.filter((x) => !(x.month_id === monthId && x.preacher_id === preacherId));
    let id = this.nextId(d.unavailable);
    const rows: Unavailable[] = fridays.map((f) => ({ id: id++, month_id: monthId, preacher_id: preacherId, friday_index: f, reason }));
    d.unavailable.push(...rows);
    return this.done(rows);
  }

  async upsertAssignments(rows: AssignmentRow[]) {
    const list = this.data.assignments;
    const out: Assignment[] = [];
    for (const r of rows) {
      const existing = list.find((a) => a.month_id === r.month_id && a.mosque_id === r.mosque_id && a.friday_index === r.friday_index);
      if (existing) {
        const { id: _id, ...rest } = r;
        Object.assign(existing, rest);
        out.push(existing);
      } else {
        const row = { ...r, id: this.nextId(list) } as Assignment;
        list.push(row);
        out.push(row);
      }
    }
    return this.done(out);
  }

  async deleteAssignments(ids: number[]) {
    this.data.assignments = this.data.assignments.filter((a) => !ids.includes(a.id));
    return this.done(undefined);
  }

  async addLog(e: Omit<LogEntry, 'id' | 'created_at'>) {
    const row: LogEntry = { ...e, id: this.nextId(this.data.log), created_at: new Date().toISOString() };
    this.data.log.unshift(row);
    return this.done(row);
  }

  async portalGet(token: string): Promise<PortalData | null> {
    const d = this.data;
    const p = d.preachers.find((x) => x.portal_token === token);
    if (!p) return null;
    const since = addDays(todayIso(), -7);
    const items = d.assignments
      .filter((a) => a.preacher_id === p.id)
      .flatMap((a) => {
        const m = d.months.find((x) => x.id === a.month_id && x.status === 'published');
        if (!m) return [];
        const f = monthFridays(m.start_date, m.days_count).find((x) => x.index === a.friday_index);
        if (!f || diffDays(f.date, since) < 0) return [];
        return [{
          id: a.id, friday_index: a.friday_index, status: a.status, excuse_reason: a.excuse_reason,
          date: f.date, hijri_day: f.hijriDay, hijri_month: m.hijri_month, hijri_year: m.hijri_year,
          mosque_name: d.mosques.find((x) => x.id === a.mosque_id)?.name ?? '',
        }];
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    return { preacher: { id: p.id, name: p.name }, org_name: d.settings.org_name, admin_name: d.settings.admin_name, admin_phone: d.settings.admin_phone, items };
  }

  async portalSetStatus(token: string, assignmentId: number, status: 'confirmed' | 'excused', reason: string) {
    const d = this.data;
    const p = d.preachers.find((x) => x.portal_token === token);
    const a = d.assignments.find((x) => x.id === assignmentId && x.preacher_id === p?.id);
    if (!p || !a) return false;
    a.status = status;
    a.excuse_reason = status === 'excused' ? reason : '';
    a.status_at = new Date().toISOString();
    if (status === 'excused' && !d.unavailable.some((u) => u.month_id === a.month_id && u.preacher_id === p.id && u.friday_index === a.friday_index)) {
      d.unavailable.push({ id: this.nextId(d.unavailable), month_id: a.month_id, preacher_id: p.id, friday_index: a.friday_index, reason });
    }
    await this.addLog({ month_id: a.month_id, preacher_id: p.id, action: status === 'excused' ? 'excuse' : 'confirm', details: `من صفحة الخطيب${reason ? `: ${reason}` : ''}` });
    this.persist();
    return true;
  }
}
