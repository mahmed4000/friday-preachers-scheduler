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
  // Read local cache first so local edits are never lost
  const localCachedStr = localStorage.getItem('cached_mosques');
  const localMap = new Map<number, Mosque>();
  if (localCachedStr) {
    try {
      const arr: Mosque[] = JSON.parse(localCachedStr);
      for (const m of arr) {
        if (m && m.id) localMap.set(m.id, m);
      }
    } catch {}
  }

  // 1. Primary: Direct Supabase Cloud Query
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
          const local = localMap.get(m.id);
          const mRules = rules.filter((r: any) => r.mosque_id === m.id);

          return {
            id: m.id,
            name: local?.name || m.name,
            code: local?.code || m.code,
            region: local?.region || m.region || 'منشأة البكاري',
            address: local?.address || m.address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
            formattedAddress: local?.formattedAddress || local?.address || m.address || 'منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية',
            managerName: local?.managerName !== undefined && local.managerName !== '' ? local.managerName : (m.manager_name || ''),
            phone: local?.phone !== undefined && local.phone !== '' ? local.phone : (m.phone || ''),
            whatsapp: local?.whatsapp !== undefined && local.whatsapp !== '' ? local.whatsapp : (m.whatsapp || m.phone || ''),
            fixedImamId: local?.fixedImamId !== undefined ? local.fixedImamId : (m.fixed_imam_id || null),
            fixedImamName: (local?.fixedImamId || m.fixed_imam_id) ? imamMap.get(local?.fixedImamId || m.fixed_imam_id) || null : null,
            fixedPattern: (local?.fixedPattern || m.fixed_pattern || (m.fixed_imam_id ? 'ALL' : undefined)) as any,
            fixedCount: local?.fixedCount !== undefined ? local.fixedCount : (m.fixed_count ?? (m.fixed_imam_id ? 5 : 0)),
            preferencesCount: local?.preferencesCount !== undefined ? local.preferencesCount : mRules.filter((r: any) => r.relationship_type === 'PREFERRED').length,
            forbiddenCount: local?.forbiddenCount !== undefined ? local.forbiddenCount : mRules.filter((r: any) => r.relationship_type === 'FORBIDDEN').length,
            isActive: local?.isActive !== undefined ? local.isActive : (m.is_active ?? true),
            notes: local?.notes !== undefined && local.notes !== '' ? local.notes : (m.notes || ''),
            countryId: local?.countryId || m.country_id || 1,
            governorateId: local?.governorateId || m.governorate_id || 1,
            districtId: local?.districtId !== undefined ? local.districtId : (m.district_id || 101),
            areaId: local?.areaId !== undefined ? local.areaId : (m.area_id || 1001),
            street: local?.street || m.street || '',
            buildingNumber: local?.buildingNumber || m.building_number || '',
            landmark: local?.landmark || m.landmark || '',
            latitude: local?.latitude || m.latitude || undefined,
            longitude: local?.longitude || m.longitude || undefined,
            createdAt: m.created_at,
            updatedAt: local?.updatedAt || m.updated_at,
          };
        });

        // Also preserve any newly added mosques from local cache that are not in remote yet
        for (const [lId, lMosque] of localMap.entries()) {
          if (!list.some((item) => item.id === lId)) {
            list.push(lMosque);
          }
        }

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
  const localCachedStr = localStorage.getItem('cached_imams');
  const localMap = new Map<number, Imam>();
  if (localCachedStr) {
    try {
      const arr: Imam[] = JSON.parse(localCachedStr);
      for (const i of arr) {
        if (i && i.id) localMap.set(i.id, i);
      }
    } catch {}
  }

  // 1. Primary: Direct Supabase Cloud Query
  const client = getSupabaseClient();
  if (client) {
    try {
      const [iRes, avRes] = await Promise.all([
        client.from('imams').select('*').order('id', { ascending: true }),
        client.from('imam_availabilities').select('*'),
      ]);
      if (iRes.data && iRes.data.length > 0) {
        const dbAvails = avRes.data || [];
        const list: Imam[] = iRes.data.map((i: any) => {
          const local = localMap.get(i.id);
          const excluded = new Set(
            dbAvails
              .filter((a: any) => a.imam_id === i.id && !a.is_available)
              .map((a: any) => a.friday_index)
          );
          const availableFridays = local?.availableFridays || [1, 2, 3, 4, 5].filter((f) => !excluded.has(f));
          return {
            id: i.id,
            name: local?.name || i.name,
            phone: local?.phone !== undefined && local.phone !== '' ? local.phone : (i.phone || ''),
            whatsapp: local?.whatsapp !== undefined && local.whatsapp !== '' ? local.whatsapp : (i.whatsapp || i.phone || ''),
            type: local?.type || ((availableFridays.length === 5 ? (i.type || 'FLEXIBLE') : 'PARTIAL_FIXED') as any),
            region: local?.region || i.region || 'منشأة البكاري',
            minFridays: local?.minFridays !== undefined ? local.minFridays : Math.min(1, availableFridays.length),
            maxFridays: local?.maxFridays !== undefined ? local.maxFridays : availableFridays.length,
            targetFridays: local?.targetFridays !== undefined ? local.targetFridays : availableFridays.length,
            availableFridays,
            isActive: local?.isActive !== undefined ? local.isActive : (i.is_active ?? true),
            notes: local?.notes !== undefined && local.notes !== '' ? local.notes : (i.notes || ''),
            createdAt: i.created_at,
            updatedAt: local?.updatedAt || i.updated_at,
          };
        });

        for (const [lId, lImam] of localMap.entries()) {
          if (!list.some((item) => item.id === lId)) {
            list.push(lImam);
          }
        }

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
  // 1. Synchronously update local cache FIRST so local edits are instantly persistent
  try {
    const cachedStr = localStorage.getItem('cached_mosques');
    if (cachedStr) {
      const list = JSON.parse(cachedStr);
      const idx = list.findIndex((m: any) => m.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem('cached_mosques', JSON.stringify(list));
      }
    }
  } catch {}

  // 2. Direct Supabase Cloud update (only columns that exist in Supabase mosques table)
  const client = getSupabaseClient();
  if (client) {
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) dbPayload.name = data.name;
    if (data.code !== undefined) dbPayload.code = data.code;
    if (data.region !== undefined) dbPayload.region = data.region;
    if (data.address !== undefined || data.formattedAddress !== undefined) {
      dbPayload.address = data.formattedAddress || data.address || null;
    }
    if (data.managerName !== undefined) dbPayload.manager_name = data.managerName;
    if (data.phone !== undefined) dbPayload.phone = data.phone;
    if (data.whatsapp !== undefined) dbPayload.whatsapp = data.whatsapp;
    if (data.fixedImamId !== undefined) dbPayload.fixed_imam_id = data.fixedImamId ? Number(data.fixedImamId) : null;
    if (data.notes !== undefined) dbPayload.notes = data.notes;
    if (data.isActive !== undefined) dbPayload.is_active = data.isActive;

    try {
      await client.from('mosques').update(dbPayload).eq('id', id);
    } catch (err) {
      console.warn('Direct Supabase mosque update failed:', err);
    }
  }

  // 3. Notify backend API
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

export async function directUpdateImam(
  id: number,
  data: Partial<Imam>,
  availableFridays?: number[]
): Promise<void> {
  // 1. Synchronously update local cache FIRST
  try {
    const cachedStr = localStorage.getItem('cached_imams');
    if (cachedStr) {
      const list = JSON.parse(cachedStr);
      const idx = list.findIndex((i: any) => i.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data, availableFridays, updatedAt: new Date().toISOString() };
        localStorage.setItem('cached_imams', JSON.stringify(list));
      }
    }
  } catch {}

  const client = getSupabaseClient();
  if (client) {
    const dbPayload: any = {
      updated_at: new Date().toISOString(),
    };
    if (data.name !== undefined) dbPayload.name = data.name;
    if (data.phone !== undefined) dbPayload.phone = data.phone;
    if (data.whatsapp !== undefined) dbPayload.whatsapp = data.whatsapp;
    if (data.type !== undefined) dbPayload.type = data.type;
    if (data.region !== undefined) dbPayload.region = data.region;
    if (data.minFridays !== undefined) dbPayload.min_fridays = Number(data.minFridays);
    if (data.maxFridays !== undefined) dbPayload.max_fridays = Number(data.maxFridays);
    if (data.targetFridays !== undefined) dbPayload.target_fridays = Number(data.targetFridays);
    if (data.notes !== undefined) dbPayload.notes = data.notes;
    if (data.isActive !== undefined) dbPayload.is_active = Boolean(data.isActive);

    try {
      await client.from('imams').update(dbPayload).eq('id', id);

      if (availableFridays && Array.isArray(availableFridays)) {
        await client.from('imam_availabilities').delete().eq('imam_id', id);

        const excluded = [1, 2, 3, 4, 5].filter((f) => !availableFridays.includes(f));
        if (excluded.length > 0) {
          const insertRows = excluded.map((f) => ({
            imam_id: id,
            hijri_year: 0,
            hijri_month: 0,
            friday_index: f,
            is_available: false,
            reason: 'حصر التكليف في جمعات محددة',
          }));
          await client.from('imam_availabilities').insert(insertRows);
        }
      }
    } catch (err) {
      console.warn('Direct Supabase imam update failed:', err);
    }
  }

  // Also notify backend API
  try {
    await fetchApi(`/api/imams/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...data, availableFridays }),
    });
  } catch (err) {
    console.warn('API patch imam notification error:', err);
  }
}

