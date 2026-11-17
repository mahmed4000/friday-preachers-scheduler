import type { AppData, Assignment, FixedRule, Month, Mosque, Preacher, Preference, Settings, Unavailable, LogEntry } from './types.ts';

export interface PortalItem {
  id: number;
  friday_index: number;
  status: Assignment['status'];
  excuse_reason: string;
  date: string;
  hijri_day: number;
  hijri_month: number;
  hijri_year: number;
  mosque_name: string;
}

export interface PortalData {
  preacher: { id: number; name: string };
  org_name: string;
  admin_name: string;
  admin_phone: string;
  items: PortalItem[];
}

export type AssignmentRow = Omit<Assignment, 'id'> & { id?: number };

/** طبقة الحفظ: Supabase في الحقيقة، أو المتصفح في الوضع التجريبي */
export interface Repo {
  readonly kind: 'supabase' | 'demo';
  loadAll(): Promise<AppData>;
  saveSettings(s: Settings): Promise<void>;
  saveMosque(m: Omit<Mosque, 'id'> & { id?: number }): Promise<Mosque>;
  deleteMosque(id: number): Promise<void>;
  savePreacher(p: Omit<Preacher, 'id' | 'portal_token'> & { id?: number }): Promise<Preacher>;
  deletePreacher(id: number): Promise<void>;
  /** يستبدل كل ثوابت المسجد */
  setFixed(mosqueId: number, rules: Omit<FixedRule, 'id' | 'mosque_id'>[]): Promise<FixedRule[]>;
  /** يستبدل كل رغبات المسجد */
  setPreferences(mosqueId: number, prefs: Omit<Preference, 'id' | 'mosque_id'>[]): Promise<Preference[]>;
  createMonth(m: Omit<Month, 'id' | 'status' | 'published_at'>): Promise<Month>;
  updateMonth(id: number, patch: Partial<Omit<Month, 'id'>>): Promise<Month>;
  deleteMonth(id: number): Promise<void>;
  /** يستبدل اعتذارات خطيب في شهر */
  setUnavailable(monthId: number, preacherId: number, fridays: number[], reason: string): Promise<Unavailable[]>;
  /** إضافة أو تعديل تكليفات (المفتاح: الشهر + المسجد + الجمعة) */
  upsertAssignments(rows: AssignmentRow[]): Promise<Assignment[]>;
  deleteAssignments(ids: number[]): Promise<void>;
  addLog(e: Omit<LogEntry, 'id' | 'created_at'>): Promise<LogEntry>;
  portalGet(token: string): Promise<PortalData | null>;
  portalSetStatus(token: string, assignmentId: number, status: 'confirmed' | 'excused', reason: string): Promise<boolean>;
}
