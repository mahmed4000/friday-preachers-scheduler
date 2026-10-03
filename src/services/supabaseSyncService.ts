import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabaseClient.ts';
import { memoryStore } from '../server/memoryStore.ts';

export interface SupabaseStatusResult {
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  message: string;
  error?: string;
  url?: string;
  counts?: {
    mosques: number;
    imams: number;
    schedules: number;
    assignments: number;
  };
}

export interface SyncStatsResult {
  success: boolean;
  message: string;
  syncedAt: string;
  mosquesCount: number;
  imamsCount: number;
  schedulesCount: number;
  assignmentsCount: number;
}

export const SupabaseSyncService = {
  /**
   * Health-check the Supabase connection
   */
  async checkConnection(): Promise<SupabaseStatusResult> {
    if (!isSupabaseConfigured) {
      return {
        configured: false,
        connected: false,
        message: 'إعدادات Supabase غير مهيأة بعد. يعمل النظام الآن بكفاءة كاملة على المحرك المحلي وقرص التخزين.',
      };
    }

    const client = getSupabaseClient();
    if (!client) {
      return {
        configured: false,
        connected: false,
        message: 'تعذر إنشاء عميل Supabase.',
      };
    }

    const startTime = Date.now();
    try {
      // Check query with a 5-second timeout
      const { data, error } = await Promise.race([
        client.from('mosques').select('id', { count: 'exact', head: true }),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('انتهت مهلة انتظار الاتصال بسحابة Supabase (5s)')), 5000)
        ),
      ]);

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache') || error.message?.includes('not find')) {
          const latencyMs = Date.now() - startTime;
          return {
            configured: true,
            connected: true,
            latencyMs,
            message: `تم التحقق من الاتصال بسحابة Supabase بنجاح (${latencyMs} ms). يرجى الآن تشغيل ملف supabase_schema.sql في SQL Editor لإنشاء الجداول.`,
            error: 'TABLES_NOT_CREATED_YET',
          };
        }
        return {
          configured: true,
          connected: false,
          error: error.message,
          message: `خطأ في الاتصال بسحابة Supabase: ${error.message}`,
        };
      }

      const latencyMs = Date.now() - startTime;
      return {
        configured: true,
        connected: true,
        latencyMs,
        message: `متصل بسحابة Supabase بنجاح (زمن الاستجابة: ${latencyMs} ملي ثانية)`,
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        error: err.message,
        message: `تعذر الاتصال بسحابة Supabase: ${err.message}`,
      };
    }
  },

  /**
   * Push all current local data (Mosques, Imams, Rules, Schedules, Assignments) to Supabase
   */
  async pushLocalToSupabase(): Promise<SyncStatsResult> {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Supabase غير مهيأ. يرجى إضافة SUPABASE_URL و SUPABASE_ANON_KEY في ملف البيئة .env أولاً.');
    }

    const mosques = memoryStore.getMosques();
    const imams = memoryStore.getImams();
    const schedules = memoryStore.getSchedules();

    // 1. Sync Mosques
    if (mosques.length > 0) {
      const dbMosques = mosques.map((m: any) => ({
        id: m.id,
        name: m.name,
        code: m.code,
        region: m.region || 'الوسط',
        address: m.address || null,
        manager_name: m.managerName || null,
        phone: m.phone || null,
        whatsapp: m.whatsapp || null,
        fixed_imam_id: m.fixedImamId || null,
        is_active: m.isActive ?? true,
        notes: m.notes || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: mosqueErr } = await client.from('mosques').upsert(dbMosques, { onConflict: 'id' });
      if (mosqueErr) throw new Error(`فشل رفع المساجد إلى السحابة: ${mosqueErr.message}`);
    }

    // 2. Sync Imams
    if (imams.length > 0) {
      const dbImams = imams.map((i: any) => ({
        id: i.id,
        name: i.name,
        phone: i.phone || null,
        whatsapp: i.whatsapp || null,
        type: i.type || 'FLEXIBLE',
        region: i.region || 'الوسط',
        min_fridays: i.minFridays || 1,
        max_fridays: i.maxFridays || 4,
        target_fridays: i.targetFridays || 2,
        is_active: i.isActive ?? true,
        notes: i.notes || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: imamErr } = await client.from('imams').upsert(dbImams, { onConflict: 'id' });
      if (imamErr) throw new Error(`فشل رفع الخطباء إلى السحابة: ${imamErr.message}`);
    }

    // 3. Sync Schedules & Assignments
    let totalAssignmentsSynced = 0;
    if (schedules.length > 0) {
      for (const s of schedules) {
        const { error: schedErr } = await client.from('monthly_schedules').upsert(
          {
            id: s.id,
            hijri_year: s.hijriYear,
            hijri_month: s.hijriMonth,
            month_name: s.monthName,
            calendar_provider: s.calendarProvider || 'UMM_AL_QURA',
            timezone: s.timezone || 'Asia/Riyadh',
            fridays_count: s.fridaysCount,
            status: s.status,
            current_version: s.currentVersion || 1,
            approved_by: s.approvedBy || null,
            approved_at: s.approvedAt || null,
            published_at: s.publishedAt || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        if (schedErr) throw new Error(`فشل رفع الجدول ${s.id}: ${schedErr.message}`);

        const details = memoryStore.getScheduleDetails(s.id);
        if (details?.assignments && details.assignments.length > 0) {
          const dbAssignments = details.assignments.map((a: any) => ({
            id: a.id,
            schedule_id: a.scheduleId,
            mosque_id: a.mosqueId,
            friday_index: a.fridayIndex,
            imam_id: a.imamId || null,
            is_locked: a.isLocked || false,
            source: a.source || 'BALANCED',
            notes: a.notes || null,
            updated_at: new Date().toISOString(),
          }));

          const { error: assignErr } = await client
            .from('assignments')
            .upsert(dbAssignments, { onConflict: 'id' });
          if (assignErr) throw new Error(`فشل رفع التكليفات للجدول ${s.id}: ${assignErr.message}`);
          totalAssignmentsSynced += dbAssignments.length;
        }
      }
    }

    return {
      success: true,
      message: 'تمت مزامنة ورفع كافة البيانات بنجاح إلى سحابة Supabase ☁️',
      syncedAt: new Date().toISOString(),
      mosquesCount: mosques.length,
      imamsCount: imams.length,
      schedulesCount: schedules.length,
      assignmentsCount: totalAssignmentsSynced,
    };
  },
};
