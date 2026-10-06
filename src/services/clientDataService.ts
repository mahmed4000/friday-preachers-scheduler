import { Mosque, Imam, MosqueImamRule, MonthlySchedule } from '../types/index.ts';
import { fetchApi } from '../lib/api.ts';
import { getSupabaseClient } from '../lib/supabaseClient.ts';
import initialSeed from '../db/initialSeed.json';
import { CalendarService } from './calendar/calendarService.ts';

const CURRENT_CACHE_VERSION = 'v3_2026_10_06_direct_supabase';

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
  // 1. Primary: Direct Supabase Cloud Query (authoritative source of truth)
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
            fixedPattern: (m.fixed_imam_id ? 'ALL' : undefined) as any,
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
      console.warn('Direct Supabase fetch for mosques failed, falling back:', dbErr);
    }
  }

  // 2. Fallback: API Route
  try {
    const res = await fetchApi<Mosque[]>('/api/mosques');
    if (Array.isArray(res) && res.length > 0) {
      try { localStorage.setItem('cached_mosques', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/mosques failed:', err);
  }

  // 3. Fallback: LocalStorage Cache
  const cached = localStorage.getItem('cached_mosques');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.mosques || []) as unknown as Mosque[];
}

export async function fetchImamsResilient(): Promise<Imam[]> {
  // 1. Primary: Direct Supabase Cloud Query
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
      console.warn('Direct Supabase fetch for imams failed, falling back:', dbErr);
    }
  }

  // 2. Fallback: API Route
  try {
    const res = await fetchApi<Imam[]>('/api/imams');
    if (Array.isArray(res) && res.length > 0) {
      try { localStorage.setItem('cached_imams', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/imams failed:', err);
  }

  // 3. Fallback: LocalStorage Cache
  const cached = localStorage.getItem('cached_imams');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.imams || []) as unknown as Imam[];
}

export async function fetchRulesResilient(): Promise<MosqueImamRule[]> {
  // 1. Primary: Direct Supabase Cloud Query
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
      console.warn('Direct Supabase fetch for rules failed, falling back:', dbErr);
    }
  }

  // 2. Fallback: API Route
  try {
    const res = await fetchApi<MosqueImamRule[]>('/api/rules');
    if (Array.isArray(res)) {
      try { localStorage.setItem('cached_rules', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/rules failed:', err);
  }

  // 3. Fallback: LocalStorage Cache
  const cached = localStorage.getItem('cached_rules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return (initialSeed.mosqueImamRules || []) as unknown as MosqueImamRule[];
}

export async function fetchSchedulesResilient(): Promise<MonthlySchedule[]> {
  // 1. Primary: Direct Supabase Cloud Query
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
      console.warn('Direct Supabase fetch for schedules failed, falling back:', dbErr);
    }
  }

  // 2. Fallback: API Route
  try {
    const res = await fetchApi<MonthlySchedule[]>('/api/schedules');
    if (Array.isArray(res) && res.length > 0) {
      const sorted = CalendarService.sortSchedulesChronologically(res);
      try { localStorage.setItem('cached_schedules', JSON.stringify(sorted)); } catch {}
      return sorted;
    }
  } catch (err) {
    console.warn('API /api/schedules failed:', err);
  }

  // 3. Fallback: LocalStorage Cache
  const cached = localStorage.getItem('cached_schedules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return CalendarService.sortSchedulesChronologically(
    (initialSeed.monthlySchedules || []) as unknown as MonthlySchedule[]
  );
}

/**
 * Direct Supabase Mutators for instant, multi-device real-time sync
 */
export async function directUpdateMosque(id: number, data: Partial<Mosque>): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    const dbPayload: any = {};
    if (data.name !== undefined) dbPayload.name = data.name;
    if (data.code !== undefined) dbPayload.code = data.code;
    if (data.region !== undefined) dbPayload.region = data.region;
    if (data.address !== undefined) dbPayload.address = data.address;
    if (data.managerName !== undefined) dbPayload.manager_name = data.managerName;
    if (data.phone !== undefined) dbPayload.phone = data.phone;
    if (data.whatsapp !== undefined) dbPayload.whatsapp = data.whatsapp;
    if (data.fixedImamId !== undefined) dbPayload.fixed_imam_id = data.fixedImamId;
    if (data.notes !== undefined) dbPayload.notes = data.notes;
    if (data.isActive !== undefined) dbPayload.is_active = data.isActive;
    if (data.countryId !== undefined) dbPayload.country_id = data.countryId;
    if (data.governorateId !== undefined) dbPayload.governorate_id = data.governorateId;
    if (data.districtId !== undefined) dbPayload.district_id = data.districtId;
    if (data.areaId !== undefined) dbPayload.area_id = data.areaId;

    try {
      await client.from('mosques').update(dbPayload).eq('id', id);
    } catch (err) {
      console.warn('Direct Supabase mosque update failed:', err);
    }
  }

  // Also notify backend API
  try {
    await fetchApi(`/api/mosques/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('API patch mosque notification error:', err);
  }
}

export async function directUpsertRule(rule: { mosqueId: number; imamId: number; relationshipType: string; priority?: number; notes?: string | null }): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data: existing } = await client.from('mosque_imam_rules').select('id').eq('mosque_id', rule.mosqueId).eq('imam_id', rule.imamId);
      if (existing && existing.length > 0) {
        await client.from('mosque_imam_rules').update({
          relationship_type: rule.relationshipType,
          priority: rule.priority || 1,
          notes: rule.notes || null,
        }).eq('id', existing[0].id);
      } else {
        await client.from('mosque_imam_rules').insert({
          mosque_id: rule.mosqueId,
          imam_id: rule.imamId,
          relationship_type: rule.relationshipType,
          priority: rule.priority || 1,
          notes: rule.notes || null,
        });
      }
    } catch (err) {
      console.warn('Direct Supabase rule upsert failed:', err);
    }
  }

  // Also notify backend API
  try {
    await fetchApi(`/api/mosques/${rule.mosqueId}/rules`, {
      method: 'POST',
      body: JSON.stringify(rule),
    });
  } catch (err) {
    console.warn('API upsert rule notification error:', err);
  }
}

export async function directDeleteRule(mosqueId: number, ruleId: number): Promise<void> {
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('mosque_imam_rules').delete().eq('id', ruleId);
    } catch (err) {
      console.warn('Direct Supabase rule delete failed:', err);
    }
  }

  // Also notify backend API
  try {
    await fetchApi(`/api/mosques/${mosqueId}/rules/${ruleId}`, {
      method: 'DELETE',
    });
  } catch (err) {
    console.warn('API delete rule notification error:', err);
  }
}
