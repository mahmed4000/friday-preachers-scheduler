import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Repo, AssignmentRow } from './repo.ts';
import type { AppData, Assignment, FixedRule, Month, Mosque, Preacher, Preference, Settings } from './types.ts';
import { SupabaseRepo, SetupRequiredError } from './supabaseRepo.ts';
import { LocalRepo } from './localRepo.ts';
import { diffMosque, diffPreacher, diffSettings } from './audit.ts';
import { gregLong, monthTitle } from '../lib/hijri.ts';

const MODE_KEY = 'fs_mode';

export function isDemoMode(): boolean {
  try {
    if (new URLSearchParams(location.search).has('demo')) {
      localStorage.setItem(MODE_KEY, 'demo');
      return true;
    }
    return localStorage.getItem(MODE_KEY) === 'demo';
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MODE_KEY, 'demo');
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* ignore */
  }
}

export function createRepo(): Repo {
  return isDemoMode() ? new LocalRepo() : new SupabaseRepo();
}

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error';
}

interface StoreValue {
  repo: Repo;
  data: AppData;
  status: 'loading' | 'ready' | 'setup' | 'error';
  error: string;
  reload: () => Promise<void>;
  toast: (text: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  /** ينفذ عملية حفظ ويعرض رسالة خطأ لو فشلت */
  run: <T>(fn: () => Promise<T>, okText?: string) => Promise<T | undefined>;
  actions: {
    saveSettings: (s: Settings) => Promise<void>;
    saveMosque: (m: Omit<Mosque, 'id'> & { id?: number }, fixed: Omit<FixedRule, 'id' | 'mosque_id'>[], prefs: Omit<Preference, 'id' | 'mosque_id'>[]) => Promise<Mosque | undefined>;
    deleteMosque: (id: number) => Promise<void>;
    savePreacher: (p: Omit<Preacher, 'id' | 'portal_token'> & { id?: number }) => Promise<Preacher | undefined>;
    deletePreacher: (id: number) => Promise<void>;
    createMonth: (m: Omit<Month, 'id' | 'status' | 'published_at'>) => Promise<Month | undefined>;
    updateMonth: (id: number, patch: Partial<Omit<Month, 'id'>>) => Promise<void>;
    deleteMonth: (id: number) => Promise<void>;
    setUnavailable: (monthId: number, preacherId: number, fridays: number[], reason: string) => Promise<void>;
    upsertAssignments: (rows: AssignmentRow[], okText?: string) => Promise<Assignment[] | undefined>;
    deleteAssignments: (ids: number[]) => Promise<void>;
    log: (monthId: number | null, preacherId: number | null, action: string, details: string) => Promise<void>;
  };
}

const EMPTY: AppData = {
  settings: { org_name: '', branch_name: '', admin_name: '', admin_phone: '' },
  mosques: [], preachers: [], fixed: [], preferences: [], months: [], unavailable: [], assignments: [], log: [],
};

const Ctx = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const repoRef = useRef<Repo>(createRepo());
  const repo = repoRef.current;
  const [data, setData] = useState<AppData>(EMPTY);
  const [status, setStatus] = useState<StoreValue['status']>('loading');
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  // نسخة من البيانات للمقارنة قبل وبعد التعديل (لسجل العمليات)
  const dataRef = useRef(data);
  dataRef.current = data;

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3000);
  }, []);

  // عدّاد التعديلات: لو حصل تعديل أثناء تحديث في الخلفية، بنتجاهل نتيجة التحديث علشان ما ترجّعش بيانات قديمة
  const writes = useRef(0);
  const lastLoad = useRef(0);

  const reload = useCallback(async () => {
    try {
      const d = await repo.loadAll();
      lastLoad.current = Date.now();
      setData(d);
      setStatus('ready');
    } catch (e) {
      if (e instanceof SetupRequiredError) setStatus('setup');
      else {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }
  }, [repo]);

  useEffect(() => {
    reload();
  }, [reload]);

  // لما المسؤول يرجع للصفحة، نجيب آخر تأكيدات واعتذارات الخطباء من صفحاتهم
  useEffect(() => {
    if (status !== 'ready') return;
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastLoad.current < 30_000) return;
      lastLoad.current = Date.now();
      const before = writes.current;
      try {
        const d = await repo.loadAll();
        if (writes.current === before) setData(d);
      } catch {
        // التحديث في الخلفية مش لازم يوقف الشغل
      }
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [status, repo]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okText?: string) => {
      writes.current++;
      try {
        const v = await fn();
        if (okText) toast(okText);
        return v;
      } catch (e) {
        toast(`ما اتحفظش: ${e instanceof Error ? e.message : String(e)}`, 'error');
        return undefined;
      }
    },
    [toast]
  );

  const actions = useMemo<StoreValue['actions']>(() => {
    const replaceById = <T extends { id: number }>(list: T[], row: T) =>
      list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row];
    // تسجيل العملية في السجل؛ فشل السجل ما يوقفش الحفظ
    const audit = async (monthId: number | null, preacherId: number | null, action: string, details: string) => {
      try {
        const row = await repo.addLog({ month_id: monthId, preacher_id: preacherId, action, details });
        setData((d) => ({ ...d, log: [row, ...d.log] }));
      } catch {
        /* السجل مش أساسي */
      }
    };
    const d0 = () => dataRef.current;
    return {
      saveSettings: async (s) => {
        const before = d0().settings;
        const ok = await run(async () => {
          await repo.saveSettings(s);
          setData((d) => ({ ...d, settings: s }));
          return true;
        }, 'اتحفظت الإعدادات');
        const changes = diffSettings(before, s);
        if (ok && changes.length) await audit(null, null, 'settings', changes.join(' · '));
      },
      saveMosque: async (m, fixed, prefs) => {
        const before = m.id ? d0().mosques.find((x) => x.id === m.id) : undefined;
        const row = await run(async () => {
          const row = await repo.saveMosque(m);
          const [f, p] = await Promise.all([repo.setFixed(row.id, fixed), repo.setPreferences(row.id, prefs)]);
          setData((d) => ({
            ...d,
            mosques: replaceById(d.mosques, row),
            fixed: [...d.fixed.filter((x) => x.mosque_id !== row.id), ...f],
            preferences: [...d.preferences.filter((x) => x.mosque_id !== row.id), ...p],
          }));
          return row;
        }, 'اتحفظ المسجد');
        if (row) {
          if (!before) await audit(null, null, 'mosque_add', row.name);
          else {
            const changes = diffMosque(before, row);
            if (changes.length) await audit(null, null, 'mosque_edit', `${row.name}: ${changes.join(' · ')}`);
          }
        }
        return row;
      },
      deleteMosque: async (id) => {
        const name = d0().mosques.find((x) => x.id === id)?.name ?? '';
        const ok = await run(async () => {
          await repo.deleteMosque(id);
          setData((d) => ({
            ...d,
            mosques: d.mosques.filter((x) => x.id !== id),
            fixed: d.fixed.filter((x) => x.mosque_id !== id),
            preferences: d.preferences.filter((x) => x.mosque_id !== id),
            assignments: d.assignments.filter((x) => x.mosque_id !== id),
          }));
          return true;
        }, 'اتمسح المسجد');
        if (ok) await audit(null, null, 'mosque_delete', name);
      },
      savePreacher: async (p) => {
        const before = p.id ? d0().preachers.find((x) => x.id === p.id) : undefined;
        const row = await run(async () => {
          const row = await repo.savePreacher(p);
          setData((d) => ({ ...d, preachers: replaceById(d.preachers, row) }));
          return row;
        }, 'اتحفظ الخطيب');
        if (row) {
          if (!before) await audit(null, row.id, 'preacher_add', row.name);
          else {
            const changes = diffPreacher(before, row);
            if (changes.length) await audit(null, row.id, 'preacher_edit', `${row.name}: ${changes.join(' · ')}`);
          }
        }
        return row;
      },
      deletePreacher: async (id) => {
        const name = d0().preachers.find((x) => x.id === id)?.name ?? '';
        const ok = await run(async () => {
          await repo.deletePreacher(id);
          setData((d) => ({
            ...d,
            preachers: d.preachers.filter((x) => x.id !== id),
            fixed: d.fixed.filter((x) => x.preacher_id !== id),
            preferences: d.preferences.filter((x) => x.preacher_id !== id),
            unavailable: d.unavailable.filter((x) => x.preacher_id !== id),
            assignments: d.assignments.map((a) => (a.preacher_id === id ? { ...a, preacher_id: null } : a)),
          }));
          return true;
        }, 'اتمسح الخطيب');
        if (ok) await audit(null, null, 'preacher_delete', name);
      },
      createMonth: async (m) => {
        const row = await run(async () => {
          const row = await repo.createMonth(m);
          setData((d) => ({ ...d, months: [...d.months, row] }));
          return row;
        }, 'اتعمل الشهر');
        if (row) await audit(row.id, null, 'month_create', `${monthTitle(row.hijri_year, row.hijri_month)}: يبدأ ${gregLong(row.start_date)} (${row.days_count} يوم)`);
        return row;
      },
      updateMonth: async (id, patch) => {
        const before = d0().months.find((x) => x.id === id);
        const row = await run(async () => {
          const row = await repo.updateMonth(id, patch);
          setData((d) => ({ ...d, months: replaceById(d.months, row) }));
          return row;
        });
        if (row && before && (before.start_date !== row.start_date || before.days_count !== row.days_count)) {
          await audit(row.id, null, 'month_edit', `${monthTitle(row.hijri_year, row.hijri_month)}: ${gregLong(before.start_date)} (${before.days_count}) ← ${gregLong(row.start_date)} (${row.days_count})`);
        }
      },
      deleteMonth: async (id) => {
        const m = d0().months.find((x) => x.id === id);
        const ok = await run(async () => {
          await repo.deleteMonth(id);
          setData((d) => ({
            ...d,
            months: d.months.filter((x) => x.id !== id),
            assignments: d.assignments.filter((x) => x.month_id !== id),
            unavailable: d.unavailable.filter((x) => x.month_id !== id),
          }));
          return true;
        }, 'اتمسح الشهر');
        if (ok && m) await audit(null, null, 'month_delete', monthTitle(m.hijri_year, m.hijri_month));
      },
      setUnavailable: async (monthId, preacherId, fridays, reason) => {
        await run(async () => {
          const rows = await repo.setUnavailable(monthId, preacherId, fridays, reason);
          setData((d) => ({
            ...d,
            unavailable: [...d.unavailable.filter((x) => !(x.month_id === monthId && x.preacher_id === preacherId)), ...rows],
          }));
        });
      },
      upsertAssignments: (rows, okText) =>
        run(async () => {
          const saved = await repo.upsertAssignments(rows);
          setData((d) => {
            let list = d.assignments;
            for (const r of saved) {
              const i = list.findIndex((a) => a.month_id === r.month_id && a.mosque_id === r.mosque_id && a.friday_index === r.friday_index);
              list = i >= 0 ? list.map((a, j) => (j === i ? r : a)) : [...list, r];
            }
            return { ...d, assignments: list };
          });
          return saved;
        }, okText),
      deleteAssignments: async (ids) => {
        await run(async () => {
          await repo.deleteAssignments(ids);
          setData((d) => ({ ...d, assignments: d.assignments.filter((a) => !ids.includes(a.id)) }));
        });
      },
      log: audit,
    };
  }, [repo, run]);

  const value: StoreValue = { repo, data, status, error, reload, toast, toasts, run, actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside provider');
  return v;
}
