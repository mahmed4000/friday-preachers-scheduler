export type MosqueSize = 'large' | 'medium' | 'small';
export type PreacherLevel = 'senior' | 'mid' | 'new';
export type AssignmentStatus = 'pending' | 'confirmed' | 'excused';
export type AssignmentSource = 'fixed' | 'auto' | 'manual';

export interface Settings {
  org_name: string;
  branch_name: string;
  admin_name: string;
  admin_phone: string;
}

export interface Mosque {
  id: number;
  name: string;
  size: MosqueSize;
  phone: string;
  contact_name: string;
  /** null = كل الجمعات */
  needed_fridays: number[] | null;
  is_active: boolean;
  notes: string;
}

export interface Preacher {
  id: number;
  name: string;
  phone: string;
  level: PreacherLevel;
  max_fridays: number;
  /** null = متاح كل الجمعات */
  available_fridays: number[] | null;
  is_active: boolean;
  notes: string;
  portal_token: string;
}

export interface FixedRule {
  id: number;
  mosque_id: number;
  preacher_id: number;
  /** null = كل الجمعات */
  friday_index: number | null;
}

export interface Preference {
  id: number;
  mosque_id: number;
  preacher_id: number;
  kind: 'prefer' | 'avoid';
}

export interface Month {
  id: number;
  hijri_year: number;
  hijri_month: number;
  /** YYYY-MM-DD أول يوم في الشهر الهجري */
  start_date: string;
  days_count: 29 | 30;
  status: 'draft' | 'published';
  published_at: string | null;
}

export interface Unavailable {
  id: number;
  month_id: number;
  preacher_id: number;
  friday_index: number;
  reason: string;
}

export interface Assignment {
  id: number;
  month_id: number;
  mosque_id: number;
  friday_index: number;
  preacher_id: number | null;
  source: AssignmentSource;
  locked: boolean;
  status: AssignmentStatus;
  excuse_reason: string;
  status_at: string | null;
  notified_at: string | null;
  reminded_at: string | null;
}

export interface LogEntry {
  id: number;
  month_id: number | null;
  preacher_id: number | null;
  action: string;
  details: string;
  created_at: string;
}

export interface AppData {
  settings: Settings;
  mosques: Mosque[];
  preachers: Preacher[];
  fixed: FixedRule[];
  preferences: Preference[];
  months: Month[];
  unavailable: Unavailable[];
  assignments: Assignment[];
  log: LogEntry[];
}

export const SIZE_LABEL: Record<MosqueSize, string> = { large: 'كبير', medium: 'متوسط', small: 'صغير' };
export const LEVEL_LABEL: Record<PreacherLevel, string> = { senior: 'خبرة كبيرة', mid: 'خبرة متوسطة', new: 'جديد' };
export const STATUS_LABEL: Record<AssignmentStatus, string> = { pending: 'في انتظار التأكيد', confirmed: 'مؤكد', excused: 'معتذر' };
