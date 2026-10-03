import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../lib/api.ts';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server,
  FileCode,
  Download,
} from 'lucide-react';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';

interface SupabaseStatus {
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  message: string;
  error?: string;
  counts?: {
    mosques: number;
    imams: number;
    schedules: number;
    assignments: number;
  };
}

export function SupabaseCloudSettings() {
  const [status, setStatus] = useState<SupabaseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    setSyncFeedback(null);
    try {
      const res = await fetchApi<SupabaseStatus>('/api/supabase/status');
      setStatus(res);
    } catch (err: any) {
      setStatus({
        configured: false,
        connected: false,
        message: err.message || 'تعذر فحص حالة الاتصال بالسحابة',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await fetchApi<any>('/api/supabase/sync', { method: 'POST' });
      setSyncFeedback({
        success: true,
        message: res.message || 'تمت مزامنة كافة المساجد والخطباء والتكليفات بنجاح!',
      });
      await checkConnection();
    } catch (err: any) {
      setSyncFeedback({
        success: false,
        message: err.message || 'فشلت المزامنة مع سحابة Supabase',
      });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <Card variant="default" className="p-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold font-heading text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-800 dark:text-emerald-400" />
            <span>الربط السحابي ومزامنة البيانات مع Supabase</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            استضافة قاعدة البيانات سحابياً على خوادم PostgreSQL عالية الأداء مع استمرار العمل بدون إنترنت (Dual-Engine)
          </p>
        </div>

        <a
          href="https://supabase.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline"
        >
          <span>موقع Supabase الرسمي</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            syncFeedback.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{syncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Live Status Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                status?.connected
                  ? 'bg-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-950'
                  : status?.configured
                  ? 'bg-amber-500 ring-4 ring-amber-100 dark:ring-amber-950'
                  : 'bg-slate-400 ring-4 ring-slate-100 dark:ring-slate-800'
              }`}
            />
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading block">
                {status?.connected
                  ? 'متصل بسحابة Supabase السحابية بنجاح 🟢'
                  : status?.configured
                  ? 'تم إعداد المفاتيح وجارٍ الاتصال ⚠️'
                  : 'الوضع المحلي النشط (Offline / Local-First Engine) ⚪'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                {status?.message || 'جارٍ فحص حالة الخادم...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={checkConnection}
              isLoading={loading}
              leftIcon={<RotateCw className="w-3.5 h-3.5" />}
            >
              فحص الاتصال
            </Button>

            {status?.configured && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleSyncNow}
                isLoading={syncing}
                leftIcon={<Cloud className="w-3.5 h-3.5" />}
              >
                مزامنة البيانات الآن
              </Button>
            )}
          </div>
        </div>

        {status?.latencyMs !== undefined && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
            <span>⚡ سرعة الاستجابة (Latency): <strong>{status.latencyMs} ms</strong></span>
            <span>🔒 نوع الحماية: <strong>SSL / Row Level Security</strong></span>
          </div>
        )}
      </div>

      {/* Dual Engine Resilience Feature Banner */}
      <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 font-heading">
            بنية المحرك المزدوج (Dual-Engine Architecture)
          </h4>
        </div>
        <p className="text-[11px] text-emerald-900 dark:text-emerald-300 leading-relaxed">
          تم تصميم النظام ليعمل بنمط <strong>Offline-First</strong>: إذا لم تكن مفاتيح Supabase مهيأة أو انقطع الاتصال بالإنترنت،
          يواصل النظام العمل بسلاسة مطلقة وبدون أي أخطاء اعتماداً على قاعدة البيانات المحلية وملف التثبيت (<code className="px-1 bg-emerald-100 dark:bg-emerald-900 rounded font-mono">src/db/initialSeed.json</code>).
          وعند الربط مع سحابة Supabase، تتاح ميزة المزامنة السحابية للنسخ الاحتياطي والمشاركة بين مديري الجمعية.
        </p>
      </div>

      {/* Setup Guide Accordion */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-slate-700 dark:text-slate-300" />
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 font-heading">
            دليل إعداد سحابة Supabase في 3 خطوات بسيطة:
          </h4>
        </div>

        <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <li>
            أنشئ مشروعاً جديداً مجاناً على <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline">supabase.com</a>.
          </li>
          <li>
            افتح تبويب <strong>SQL Editor</strong> في لوحة تحكم Supabase، وانسخ المخطط الجاهز من ملف <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-emerald-800 dark:text-emerald-400">supabase_schema.sql</code> الموجود في المجلد الرئيسي، ثم اضغط <strong>Run</strong>.
          </li>
          <li>
            من إعدادات المشروع (<strong>Project Settings &gt; API</strong>)، انسخ كل من <strong>Project URL</strong> و <strong>anon public key</strong> وضعهما في ملف <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold">.env</code>:
            <pre className="mt-2 p-2.5 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto text-left" dir="ltr">
{`SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
            </pre>
          </li>
        </ol>
      </div>
    </Card>
  );
}
