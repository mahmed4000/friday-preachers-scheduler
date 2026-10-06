import { Mosque, Imam, MosqueImamRule, MonthlySchedule } from '../types/index.ts';
import { fetchApi } from '../lib/api.ts';
import { getSupabaseClient } from '../lib/supabaseClient.ts';
import initialSeed from '../db/initialSeed.json';
import { CalendarService } from './calendar/calendarService.ts';

const CURRENT_CACHE_VERSION = 'v2_2026_10_06_clean';

export function ensureCleanCache() {
  try {
    const v = localStorage.getItem('app_cache_version');
    if (v !== CURRENT_CACHE_VERSION) {
      console.log('Migrating cache to', CURRENT_CACHE_VERSION);
      localStorage.removeItem('cached_mosques');
      localStorage.removeItem('cached_imams');
      localStorage.removeItem('cached_rules');
      localStorage.removeItem('cached_schedules');
      localStorage.setItem('app_cache_version', CURRENT_CACHE_VERSION);
    }
  } catch {}
}

export async function fetchMosquesResilient(): Promise<Mosque[]> {
  try {
    const res = await fetchApi<Mosque[]>('/api/mosques');
    if (Array.isArray(res) && res.length > 0) {
      try { localStorage.setItem('cached_mosques', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/mosques failed, attempting direct Supabase query:', err);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const [mRes, iRes, rRes] = await Promise.all([
        client.from('mosques').select('*').order('id', { ascending: true }),
        client.from('imams').select('id, name'),
        client.from('mosque_imam_rules').select('mosque_id, relationship_type'),
      ]);

      if (mRes.data && mRes.data.length > 0) {
        const imamMap = new Map((iRes.data || []).map((i: any) => [i.id, i.name]));
        const rules = rRes.data || [];

        const list: Mosque[] = mRes.data.map((m: any) => {
          const mRules = rules.filter((r: any) => r.mosque_id === m.id);
          return {
            id: m.id,
            name: m.name,
            code: m.code,
            region: m.region || 'منشأة البكاري',
            address: m.address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
            formattedAddress: m.address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
            managerName: m.manager_name || '',
            phone: m.phone || '',
            whatsapp: m.whatsapp || m.phone || '',
            fixedImamId: m.fixed_imam_id || null,
            fixedImamName: m.fixed_imam_id ? imamMap.get(m.fixed_imam_id) || null : null,
            fixedPattern: m.fixed_imam_id ? 'ALL' : undefined,
            fixedCount: m.fixed_imam_id ? 5 : 0,
            preferencesCount: mRules.filter((r: any) => r.relationship_type === 'PREFERRED').length,
            forbiddenCount: mRules.filter((r: any) => r.relationship_type === 'FORBIDDEN').length,
            isActive: m.is_active ?? true,
            notes: m.notes || '',
            countryId: m.country_id || 1,
            governorateId: m.governorate_id || 1,
            districtId: m.district_id || 101,
            areaId: m.area_id || 1001,
            createdAt: m.created_at,
            updatedAt: m.updated_at,
          };
        });

        try { localStorage.setItem('cached_mosques', JSON.stringify(list)); } catch {}
        return list;
      }
    } catch (dbErr) {
      console.warn('Direct Supabase fetch for mosques failed:', dbErr);
    }
  }

  const cached = localStorage.getItem('cached_mosques');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.mosques || []) as unknown as Mosque[];
}

export async function fetchImamsResilient(): Promise<Imam[]> {
  try {
    const res = await fetchApi<Imam[]>('/api/imams');
    if (Array.isArray(res) && res.length > 0) {
      try { localStorage.setItem('cached_imams', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/imams failed, attempting direct Supabase query:', err);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: dbImams } = await client.from('imams').select('*').order('id', { ascending: true });
      if (dbImams && dbImams.length > 0) {
        const list: Imam[] = dbImams.map((i: any) => ({
          id: i.id,
          name: i.name,
          phone: i.phone || '',
          whatsapp: i.whatsapp || i.phone || '',
          type: i.type || 'FLEXIBLE',
          region: i.region || 'منشأة البكاري',
          minFridays: i.min_fridays ?? 1,
          maxFridays: i.max_fridays ?? 4,
          targetFridays: i.target_fridays ?? 2,
          isActive: i.is_active ?? true,
          notes: i.notes || '',
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        }));
        try { localStorage.setItem('cached_imams', JSON.stringify(list)); } catch {}
        return list;
      }
    } catch (dbErr) {
      console.warn('Direct Supabase fetch for imams failed:', dbErr);
    }
  }

  const cached = localStorage.getItem('cached_imams');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.imams || []) as unknown as Imam[];
}

export async function fetchRulesResilient(): Promise<MosqueImamRule[]> {
  try {
    const res = await fetchApi<MosqueImamRule[]>('/api/rules');
    if (Array.isArray(res)) {
      try { localStorage.setItem('cached_rules', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/rules failed, attempting direct Supabase query:', err);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: dbRules } = await client.from('mosque_imam_rules').select('*').order('priority', { ascending: true });
      if (dbRules) {
        const list: MosqueImamRule[] = dbRules.map((r: any) => ({
          id: r.id,
          mosqueId: r.mosque_id,
          imamId: r.imam_id,
          relationshipType: r.relationship_type,
          priority: r.priority || 1,
          notes: r.notes || null,
          createdAt: r.created_at,
        }));
        try { localStorage.setItem('cached_rules', JSON.stringify(list)); } catch {}
        return list;
      }
    } catch (dbErr) {
      console.warn('Direct Supabase fetch for rules failed:', dbErr);
    }
  }

  const cached = localStorage.getItem('cached_rules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.mosqueImamRules || []) as unknown as MosqueImamRule[];
}

export async function fetchSchedulesResilient(): Promise<MonthlySchedule[]> {
  try {
    const res = await fetchApi<MonthlySchedule[]>('/api/schedules');
    if (Array.isArray(res) && res.length > 0) {
      const sorted = CalendarService.sortSchedulesChronologically(res);
      try { localStorage.setItem('cached_schedules', JSON.stringify(sorted)); } catch {}
      return sorted;
    }
  } catch (err) {
    console.warn('API /api/schedules failed, attempting direct Supabase query:', err);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: dbSchedules } = await client.from('monthly_schedules').select('*').order('id', { ascending: true });
      if (dbSchedules && dbSchedules.length > 0) {
        const list: MonthlySchedule[] = dbSchedules.map((s: any) => ({
          id: s.id,
          hijriYear: s.hijri_year,
          hijriMonth: s.hijri_month,
          monthName: s.month_name,
          calendarProvider: s.calendar_provider || 'UMM_AL_QURA',
          timezone: s.timezone || 'Africa/Cairo',
          fridaysCount: s.fridays_count,
          status: s.status,
          currentVersion: s.current_version || 1,
          approvedBy: s.approved_by,
          approvedAt: s.approved_at,
          publishedAt: s.published_at,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        }));
        const sorted = CalendarService.sortSchedulesChronologically(list);
        try { localStorage.setItem('cached_schedules', JSON.stringify(sorted)); } catch {}
        return sorted;
      }
    } catch (dbErr) {
      console.warn('Direct Supabase fetch for schedules failed:', dbErr);
    }
  }

  const cached = localStorage.getItem('cached_schedules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return CalendarService.sortSchedulesChronologically(
    (initialSeed.monthlySchedules || []) as unknown as MonthlySchedule[]
  );
}
