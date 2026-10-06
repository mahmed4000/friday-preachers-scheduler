import { Mosque, Imam, MosqueImamRule, MonthlySchedule } from '../types/index.ts';
import { fetchApi } from '../lib/api.ts';
import { CalendarService } from './calendar/calendarService.ts';

const CURRENT_CACHE_VERSION = 'v3_2026_10_06_authoritative';

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
    if (Array.isArray(res)) {
      try { localStorage.setItem('cached_mosques', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/mosques failed, falling back to client cache:', err);
  }

  const cached = localStorage.getItem('cached_mosques');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return [];
}

export async function fetchImamsResilient(): Promise<Imam[]> {
  try {
    const res = await fetchApi<Imam[]>('/api/imams');
    if (Array.isArray(res)) {
      try { localStorage.setItem('cached_imams', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/imams failed, falling back to client cache:', err);
  }

  const cached = localStorage.getItem('cached_imams');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return [];
}

export async function fetchRulesResilient(): Promise<MosqueImamRule[]> {
  try {
    const res = await fetchApi<MosqueImamRule[]>('/api/rules');
    if (Array.isArray(res)) {
      try { localStorage.setItem('cached_rules', JSON.stringify(res)); } catch {}
      return res;
    }
  } catch (err) {
    console.warn('API /api/rules failed, falling back to client cache:', err);
  }

  const cached = localStorage.getItem('cached_rules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return [];
}

export async function fetchSchedulesResilient(): Promise<MonthlySchedule[]> {
  try {
    const res = await fetchApi<MonthlySchedule[]>('/api/schedules');
    if (Array.isArray(res)) {
      const sorted = CalendarService.sortSchedulesChronologically(res);
      try { localStorage.setItem('cached_schedules', JSON.stringify(sorted)); } catch {}
      return sorted;
    }
  } catch (err) {
    console.warn('API /api/schedules failed, falling back to client cache:', err);
  }

  const cached = localStorage.getItem('cached_schedules');
  if (cached) {
    try { return JSON.parse(cached); } catch {}
  }

  return [];
}
