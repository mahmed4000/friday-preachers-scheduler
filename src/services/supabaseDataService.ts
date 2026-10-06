import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.ts';
import { memoryStore } from '../server/memoryStore.ts';
import { CalendarService } from './calendar/calendarService.ts';

export function mapDbMosque(m: any) {
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    code: m.code,
    region: m.region || 'الوسط',
    address: m.address || '',
    formattedAddress: m.address || '',
    managerName: m.manager_name || '',
    phone: m.phone || '',
    whatsapp: m.whatsapp || m.phone || '',
    fixedImamId: m.fixed_imam_id || null,
    fixedPattern: m.fixed_imam_id ? 'ALL' : undefined,
    isActive: m.is_active ?? true,
    notes: m.notes || '',
    countryId: m.country_id || 1,
    governorateId: m.governorate_id || 1,
    districtId: m.district_id || 101,
    areaId: m.area_id || 1001,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  };
}

export function mapDbImam(i: any) {
  if (!i) return null;
  return {
    id: i.id,
    name: i.name,
    phone: i.phone || '',
    whatsapp: i.whatsapp || i.phone || '',
    type: i.type || 'FLEXIBLE',
    region: i.region || 'الوسط',
    minFridays: i.min_fridays ?? 1,
    maxFridays: i.max_fridays ?? 4,
    targetFridays: i.target_fridays ?? 2,
    isActive: i.is_active ?? true,
    notes: i.notes || '',
    createdAt: i.created_at,
    updatedAt: i.updated_at,
  };
}

export function mapDbRule(r: any) {
  if (!r) return null;
  return {
    id: r.id,
    mosqueId: r.mosque_id,
    imamId: r.imam_id,
    relationshipType: r.relationship_type,
    priority: r.priority || 1,
    notes: r.notes || null,
    createdAt: r.created_at,
  };
}

let isHydrated = false;
let isHydrating = false;

export const SupabaseDataService = {
  isAvailable(): boolean {
    return isSupabaseConfigured && Boolean(getSupabaseClient());
  },

  /**
   * Hydrates memoryStore directly from Supabase so any in-memory algorithms
   * (such as SchedulingEngine) always reflect the true cloud state.
   */
  async hydrateMemoryStore(force: boolean = false): Promise<boolean> {
    if ((isHydrated && !force) || isHydrating) return true;
    const client = getSupabaseClient();
    if (!client) return false;

    isHydrating = true;
    try {
      const [mRes, iRes, rRes, sRes, fRes, aRes] = await Promise.all([
        client.from('mosques').select('*').order('id', { ascending: true }),
        client.from('imams').select('*').order('id', { ascending: true }),
        client.from('mosque_imam_rules').select('*').order('id', { ascending: true }),
        client.from('monthly_schedules').select('*').order('id', { ascending: true }),
        client.from('fridays').select('*').order('id', { ascending: true }),
        client.from('assignments').select('*').order('id', { ascending: true }),
      ]);

      const mosques = (mRes.data || []).map(mapDbMosque).filter(Boolean);
      const imams = (iRes.data || []).map(mapDbImam).filter(Boolean);
      const rules = (rRes.data || []).map(mapDbRule).filter(Boolean);
      const schedules = (sRes.data || []).map((s: any) => ({
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
      const fridays = (fRes.data || []).map((f: any) => ({
        id: f.id,
        scheduleId: f.schedule_id,
        fridayIndex: f.friday_index,
        hijriDate: f.hijri_date,
        gregorianDate: f.gregorian_date,
        gregorianIso: f.gregorian_iso,
        periodStatus: f.period_status || 'CURRENT',
        isPast: Boolean(f.is_past),
      }));
      const assignments = (aRes.data || []).map((a: any) => ({
        id: a.id,
        scheduleId: a.schedule_id,
        mosqueId: a.mosque_id,
        fridayIndex: a.friday_index,
        imamId: a.imam_id,
        isLocked: Boolean(a.is_locked),
        source: a.source || 'BALANCED',
        notes: a.notes || null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      memoryStore.hydrate({
        mosques,
        imams,
        rules,
        schedules,
        fridays,
        assignments,
      });

      isHydrated = true;
      return true;
    } catch (err: any) {
      console.warn('Hydration from Supabase encountered an issue:', err.message);
      return false;
    } finally {
      isHydrating = false;
    }
  },

  // -------------------------------------------------------------
  // MOSQUES OPERATIONS
  // -------------------------------------------------------------
  async getMosques(search: string = '', region: string = ''): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getMosques(search, region);

    try {
      let query = client.from('mosques').select('*').order('id', { ascending: true });
      if (region && region !== 'ALL') {
        query = query.eq('region', region);
      }

      const [mosquesRes, imamsRes, rulesRes] = await Promise.all([
        query,
        client.from('imams').select('id, name'),
        client.from('mosque_imam_rules').select('mosque_id, relationship_type'),
      ]);

      if (mosquesRes.error) throw mosquesRes.error;

      const imamMap = new Map((imamsRes.data || []).map((i: any) => [i.id, i.name]));
      const allRules = rulesRes.data || [];

      let list = (mosquesRes.data || []).map(mapDbMosque);

      if (search) {
        const s = search.toLowerCase();
        list = list.filter(
          (m: any) =>
            m.name?.includes(search) ||
            m.code?.toLowerCase().includes(s) ||
            (m.region && m.region.includes(search))
        );
      }

      return list.map((m: any) => {
        const rulesForMosque = allRules.filter((r: any) => r.mosque_id === m.id);
        return {
          ...m,
          fixedImamName: m.fixedImamId ? imamMap.get(m.fixedImamId) || 'غير محدد' : null,
          preferencesCount: rulesForMosque.filter((r: any) => r.relationship_type === 'PREFERRED').length,
          forbiddenCount: rulesForMosque.filter((r: any) => r.relationship_type === 'FORBIDDEN').length,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getMosques fallback to memoryStore:', err.message);
      return memoryStore.getMosques(search, region);
    }
  },

  async getMosqueDetails(id: number): Promise<any> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getMosqueDetails(id);

    try {
      const [mRes, rRes, iRes] = await Promise.all([
        client.from('mosques').select('*').eq('id', id).maybeSingle(),
        client.from('mosque_imam_rules').select('*').eq('mosque_id', id).order('priority', { ascending: true }),
        client.from('imams').select('*'),
      ]);

      if (mRes.error || !mRes.data) return memoryStore.getMosqueDetails(id);

      const mosque = mapDbMosque(mRes.data);
      const imamMap = new Map((iRes.data || []).map((i: any) => [i.id, i]));
      const rules = (rRes.data || []).map((r: any) => {
        const im = imamMap.get(r.imam_id);
        return {
          id: r.id,
          mosqueId: r.mosque_id,
          imamId: r.imam_id,
          relationshipType: r.relationship_type,
          priority: r.priority || 1,
          notes: r.notes || null,
          createdAt: r.created_at,
          imam: im?.name || undefined,
          imamName: im?.name || undefined,
          imamType: im?.type || undefined,
        };
      });

      return {
        ...mosque,
        rules,
      };
    } catch (err: any) {
      console.warn('Supabase getMosqueDetails fallback to memoryStore:', err.message);
      return memoryStore.getMosqueDetails(id);
    }
  },

  async updateMosque(id: number, data: any): Promise<any> {
    const client = getSupabaseClient();
    
    // Always update memoryStore synchronously
    memoryStore.updateMosque(id, data);

    if (!client) return memoryStore.getMosqueDetails(id);

    try {
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
      if (data.fixedImamId !== undefined) {
        dbPayload.fixed_imam_id = data.fixedImamId ? Number(data.fixedImamId) : null;
      }
      if (data.isActive !== undefined) dbPayload.is_active = Boolean(data.isActive);
      if (data.notes !== undefined) dbPayload.notes = data.notes;

      const { data: updated, error } = await client
        .from('mosques')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('Supabase updateMosque error, using memoryStore data:', error.message);
        return memoryStore.getMosqueDetails(id);
      }

      return mapDbMosque(updated);
    } catch (err: any) {
      console.warn('Supabase updateMosque error:', err.message);
      return memoryStore.getMosqueDetails(id);
    }
  },

  async createMosque(data: any): Promise<any> {
    const createdInMemory = memoryStore.createMosque(data);
    const client = getSupabaseClient();
    if (!client) return createdInMemory;

    try {
      const dbPayload: any = {
        id: createdInMemory.id,
        name: data.name,
        code: data.code,
        region: data.region || 'الوسط',
        address: data.formattedAddress || data.address || null,
        manager_name: data.managerName || null,
        phone: data.phone || null,
        whatsapp: data.whatsapp || data.phone || null,
        fixed_imam_id: data.fixedImamId ? Number(data.fixedImamId) : null,
        is_active: data.isActive ?? true,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await client
        .from('mosques')
        .upsert(dbPayload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.warn('Supabase createMosque warning:', error.message);
        return createdInMemory;
      }
      return mapDbMosque(created);
    } catch (err: any) {
      console.warn('Supabase createMosque catch:', err.message);
      return createdInMemory;
    }
  },

  async deleteMosque(id: number): Promise<boolean> {
    memoryStore.deleteMosque(id);
    const client = getSupabaseClient();
    if (!client) return true;

    try {
      await client.from('mosques').delete().eq('id', id);
      return true;
    } catch (err: any) {
      console.warn('Supabase deleteMosque error:', err.message);
      return true;
    }
  },

  async bulkDeleteMosques(ids: number[]): Promise<number> {
    memoryStore.bulkDeleteMosques(ids);
    const client = getSupabaseClient();
    if (!client) return ids.length;

    try {
      await client.from('mosques').delete().in('id', ids);
      return ids.length;
    } catch (err: any) {
      console.warn('Supabase bulkDeleteMosques error:', err.message);
      return ids.length;
    }
  },

  // -------------------------------------------------------------
  // RULES OPERATIONS
  // -------------------------------------------------------------
  async getRules(mosqueId?: number): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) {
      const memRules = memoryStore.getRules();
      return mosqueId ? memRules.filter((r: any) => r.mosqueId === mosqueId) : memRules;
    }

    try {
      let query = client.from('mosque_imam_rules').select('*').order('priority', { ascending: true });
      if (mosqueId) {
        query = query.eq('mosque_id', mosqueId);
      }

      const [rRes, iRes, mRes] = await Promise.all([
        query,
        client.from('imams').select('id, name, type'),
        client.from('mosques').select('id, name'),
      ]);

      if (rRes.error) throw rRes.error;

      const imamMap = new Map((iRes.data || []).map((i: any) => [i.id, i]));
      const mosqueMap = new Map((mRes.data || []).map((m: any) => [m.id, m.name]));

      return (rRes.data || []).map((r: any) => {
        const im = imamMap.get(r.imam_id);
        return {
          id: r.id,
          mosqueId: r.mosque_id,
          imamId: r.imam_id,
          relationshipType: r.relationship_type,
          priority: r.priority || 1,
          notes: r.notes || null,
          createdAt: r.created_at,
          imam: im?.name || undefined,
          imamName: im?.name || undefined,
          imamType: im?.type || undefined,
          mosque: mosqueMap.get(r.mosque_id) || undefined,
          mosqueName: mosqueMap.get(r.mosque_id) || undefined,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getRules error, using memoryStore:', err.message);
      const memRules = memoryStore.getRules();
      return mosqueId ? memRules.filter((r: any) => r.mosqueId === mosqueId) : memRules;
    }
  },

  async upsertRule(data: {
    mosqueId: number;
    imamId: number;
    relationshipType: string;
    priority?: number;
    notes?: string | null;
  }): Promise<any> {
    const mId = Number(data.mosqueId);
    const iId = Number(data.imamId);
    const relType = data.relationshipType;
    const prio = data.priority ? Number(data.priority) : 1;
    const n = data.notes || null;

    // Save to memoryStore immediately
    const memSaved = memoryStore.upsertRule({
      mosqueId: mId,
      imamId: iId,
      relationshipType: relType,
      priority: prio,
      notes: n,
    });

    const client = getSupabaseClient();
    if (!client) return memSaved;

    try {
      // Check if existing rule exists for this pair
      const { data: existing } = await client
        .from('mosque_imam_rules')
        .select('id')
        .eq('mosque_id', mId)
        .eq('imam_id', iId)
        .maybeSingle();

      let savedDbRule: any;

      if (existing) {
        const { data: updated, error } = await client
          .from('mosque_imam_rules')
          .update({
            relationship_type: relType,
            priority: prio,
            notes: n,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        savedDbRule = updated;
      } else {
        const { data: inserted, error } = await client
          .from('mosque_imam_rules')
          .insert({
            mosque_id: mId,
            imam_id: iId,
            relationship_type: relType,
            priority: prio,
            notes: n,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;
        savedDbRule = inserted;
      }

      // Fetch imam details for enriched response
      const { data: imam } = await client.from('imams').select('name, type').eq('id', iId).maybeSingle();

      return {
        id: savedDbRule.id,
        mosqueId: savedDbRule.mosque_id,
        imamId: savedDbRule.imam_id,
        relationshipType: savedDbRule.relationship_type,
        priority: savedDbRule.priority || 1,
        notes: savedDbRule.notes || null,
        createdAt: savedDbRule.created_at,
        imam: imam?.name || memSaved.imam,
        imamName: imam?.name || memSaved.imamName,
        imamType: imam?.type || memSaved.imamType,
      };
    } catch (err: any) {
      console.warn('Supabase upsertRule warning, using memoryStore saved:', err.message);
      return memSaved;
    }
  },

  async deleteRule(id: number): Promise<boolean> {
    memoryStore.deleteRule(id);
    const client = getSupabaseClient();
    if (!client) return true;

    try {
      await client.from('mosque_imam_rules').delete().eq('id', id);
      return true;
    } catch (err: any) {
      console.warn('Supabase deleteRule warning:', err.message);
      return true;
    }
  },

  // -------------------------------------------------------------
  // IMAMS OPERATIONS
  // -------------------------------------------------------------
  async getImams(search: string = '', type: string = ''): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getImams(search, type);

    try {
      let query = client.from('imams').select('*').order('id', { ascending: true });
      if (type && type !== 'ALL') {
        query = query.eq('type', type);
      }

      const [imamsRes, rulesRes, assignmentsRes] = await Promise.all([
        query,
        client.from('mosque_imam_rules').select('imam_id, relationship_type'),
        client.from('assignments').select('imam_id'),
      ]);

      if (imamsRes.error) throw imamsRes.error;

      const allRules = rulesRes.data || [];
      const allAssigns = assignmentsRes.data || [];

      let list = (imamsRes.data || []).map(mapDbImam);

      if (search) {
        list = list.filter(
          (i: any) =>
            i.name?.includes(search) ||
            i.phone?.includes(search) ||
            (i.region && i.region.includes(search))
        );
      }

      return list.map((i: any) => {
        const rulesForImam = allRules.filter((r: any) => r.imam_id === i.id);
        const assignedCount = allAssigns.filter((a: any) => a.imam_id === i.id).length;
        return {
          ...i,
          assignedFridaysCount: assignedCount,
          preferredMosquesCount: rulesForImam.filter((r: any) => r.relationship_type === 'PREFERRED').length,
          forbiddenMosquesCount: rulesForImam.filter((r: any) => r.relationship_type === 'FORBIDDEN').length,
        };
      });
    } catch (err: any) {
      console.warn('Supabase getImams fallback to memoryStore:', err.message);
      return memoryStore.getImams(search, type);
    }
  },

  async getImamDetails(id: number): Promise<any> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getImamDetails(id);

    try {
      const [iRes, rRes, mRes] = await Promise.all([
        client.from('imams').select('*').eq('id', id).maybeSingle(),
        client.from('mosque_imam_rules').select('*').eq('imam_id', id),
        client.from('mosques').select('id, name'),
      ]);

      if (iRes.error || !iRes.data) return memoryStore.getImamDetails(id);

      const imam = mapDbImam(iRes.data);
      const mosqueMap = new Map((mRes.data || []).map((m: any) => [m.id, m.name]));
      const rules = (rRes.data || []).map((r: any) => ({
        id: r.id,
        mosqueId: r.mosque_id,
        imamId: r.imam_id,
        relationshipType: r.relationship_type,
        priority: r.priority || 1,
        notes: r.notes || null,
        createdAt: r.created_at,
        mosque: mosqueMap.get(r.mosque_id) || undefined,
        mosqueName: mosqueMap.get(r.mosque_id) || undefined,
      }));

      return {
        ...imam,
        rules,
      };
    } catch (err: any) {
      console.warn('Supabase getImamDetails fallback:', err.message);
      return memoryStore.getImamDetails(id);
    }
  },

  async updateImam(id: number, data: any): Promise<any> {
    memoryStore.updateImam(id, data);
    const client = getSupabaseClient();
    if (!client) return memoryStore.getImamDetails(id);

    try {
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
      if (data.isActive !== undefined) dbPayload.is_active = Boolean(data.isActive);
      if (data.notes !== undefined) dbPayload.notes = data.notes;

      const { data: updated, error } = await client
        .from('imams')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.warn('Supabase updateImam error:', error.message);
        return memoryStore.getImamDetails(id);
      }
      return mapDbImam(updated);
    } catch (err: any) {
      console.warn('Supabase updateImam catch:', err.message);
      return memoryStore.getImamDetails(id);
    }
  },

  async createImam(data: any): Promise<any> {
    const createdInMemory = memoryStore.createImam(data);
    const client = getSupabaseClient();
    if (!client) return createdInMemory;

    try {
      const dbPayload: any = {
        id: createdInMemory.id,
        name: data.name,
        phone: data.phone || null,
        whatsapp: data.whatsapp || data.phone || null,
        type: data.type || 'FLEXIBLE',
        region: data.region || 'الوسط',
        min_fridays: data.minFridays ?? 1,
        max_fridays: data.maxFridays ?? 4,
        target_fridays: data.targetFridays ?? 2,
        is_active: data.isActive ?? true,
        notes: data.notes || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: created, error } = await client
        .from('imams')
        .upsert(dbPayload, { onConflict: 'id' })
        .select()
        .single();

      if (error) {
        console.warn('Supabase createImam warning:', error.message);
        return createdInMemory;
      }
      return mapDbImam(created);
    } catch (err: any) {
      console.warn('Supabase createImam catch:', err.message);
      return createdInMemory;
    }
  },

  async deleteImam(id: number): Promise<boolean> {
    memoryStore.deleteImam(id);
    const client = getSupabaseClient();
    if (!client) return true;

    try {
      await client.from('imams').delete().eq('id', id);
      return true;
    } catch (err: any) {
      console.warn('Supabase deleteImam catch:', err.message);
      return true;
    }
  },

  // -------------------------------------------------------------
  // SCHEDULES OPERATIONS
  // -------------------------------------------------------------
  async getSchedules(): Promise<any[]> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getSchedules();

    try {
      const { data, error } = await client
        .from('monthly_schedules')
        .select('*')
        .order('id', { ascending: false });

      if (error || !data || data.length === 0) return memoryStore.getSchedules();

      const enriched = data.map((s: any) => {
        const monthDetails = CalendarService.getHijriMonthDetails(s.hijri_year, s.hijri_month, {
          provider: s.calendar_provider || 'UMM_AL_QURA',
          timezone: s.timezone || 'Africa/Cairo',
        });
        return {
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
          periodStatus: monthDetails.periodStatus,
          statusLabelArabic: monthDetails.statusLabelArabic,
          isPast: monthDetails.isPast,
          isCurrent: monthDetails.isCurrent,
          isFuture: monthDetails.isFuture,
          isCreatable: monthDetails.isCreatable,
          isEditable: monthDetails.isEditable,
          pastFridaysCount: monthDetails.pastFridaysCount,
          futureFridaysCount: monthDetails.futureFridaysCount,
        };
      });

      return CalendarService.sortSchedulesChronologically(enriched);
    } catch (err: any) {
      console.warn('Supabase getSchedules fallback:', err.message);
      return memoryStore.getSchedules();
    }
  },

  async getScheduleDetails(id: number): Promise<any> {
    const client = getSupabaseClient();
    if (!client) return memoryStore.getScheduleDetails(id);

    try {
      const [sRes, fRes, aRes] = await Promise.all([
        client.from('monthly_schedules').select('*').eq('id', id).maybeSingle(),
        client.from('fridays').select('*').eq('schedule_id', id).order('friday_index', { ascending: true }),
        client.from('assignments').select('*').eq('schedule_id', id),
      ]);

      if (sRes.error || !sRes.data) return memoryStore.getScheduleDetails(id);

      const s = sRes.data;
      const fridays = (fRes.data || []).map((f: any) => ({
        id: f.id,
        scheduleId: f.schedule_id,
        fridayIndex: f.friday_index,
        hijriDate: f.hijri_date,
        gregorianDate: f.gregorian_date,
        gregorianIso: f.gregorian_iso,
        periodStatus: f.period_status || 'CURRENT',
        isPast: Boolean(f.is_past),
      }));
      const assignments = (aRes.data || []).map((a: any) => ({
        id: a.id,
        scheduleId: a.schedule_id,
        mosqueId: a.mosque_id,
        fridayIndex: a.friday_index,
        imamId: a.imam_id,
        isLocked: Boolean(a.is_locked),
        source: a.source || 'BALANCED',
        notes: a.notes || null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      const memDetails = memoryStore.getScheduleDetails(id);

      return {
        schedule: {
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
        },
        fridays,
        assignments,
        conflicts: memDetails?.conflicts || [],
        overrides: memDetails?.overrides || [],
      };
    } catch (err: any) {
      console.warn('Supabase getScheduleDetails fallback:', err.message);
      return memoryStore.getScheduleDetails(id);
    }
  },
};
