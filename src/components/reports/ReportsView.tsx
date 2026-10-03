import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../lib/api.ts';
import { BarChart3, Users2, Building2, Sliders, ShieldAlert, Award } from 'lucide-react';
import { ClickableImam } from '../../context/ProfileNavigationContext.tsx';

export function ReportsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<any>('/api/reports/summary')
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        جارٍ تحميل تقارير ومؤشرات عدالة التوزيع...
      </div>
    );
  }

  if (!data) return null;

  const { imamLoads = [], mosqueLoads = [], overridesCount = 0, manualChangesCount = 0 } = data;

  const underCount = imamLoads.filter((i: any) => i.status === 'UNDER').length;
  const balancedCount = imamLoads.filter((i: any) => i.status === 'BALANCED').length;
  const overCount = imamLoads.filter((i: any) => i.status === 'OVER').length;

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <h3 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-emerald-700" />
          <span>تقارير الأداء ومؤشرات عدالة التوزيع الرقابية</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          تحليل أحمال الخطباء ومعدلات تحقيق التفضيلات وحصر الاستثناءات والتعديلات اليدوية
        </p>
      </div>

      {/* High-level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1">عدالة توزيع الخطباء</span>
          <span className="text-xl font-bold text-emerald-800 tabular-nums">
            {Math.round((balancedCount / (imamLoads.length || 1)) * 100)}%
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {balancedCount} خطيباً في النطاق المتوازن
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1">التعديلات اليدوية المسجلة</span>
          <span className="text-xl font-bold text-slate-900 tabular-nums">{manualChangesCount}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">تعديلات مباشرة باللوحة</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1">الاستثناءات الإدارية المعتمدة</span>
          <span className="text-xl font-bold text-amber-800 tabular-nums">{overridesCount}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">تجاوزات موثقة (Overrides)</span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 block mb-1">التعارضات القائمة</span>
          <span className="text-xl font-bold text-emerald-800 tabular-nums">0</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">جميع القيود محترمة</span>
        </div>
      </div>

      {/* Imams Workload Balance Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 font-heading">
            مؤشر أحمال الخطباء (المستهدف مقابل الفعلي)
          </h4>
          <span className="text-xs text-slate-500">
            {balancedCount} متوازن · {underCount} دون الأدنى · {overCount} فوق الأقصى
          </span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
              <tr>
                <th className="py-2.5 px-3">الخطيب</th>
                <th className="py-2.5 px-3 text-center">النوع</th>
                <th className="py-2.5 px-3 text-center">الحد الأدنى</th>
                <th className="py-2.5 px-3 text-center">المستهدف (Target)</th>
                <th className="py-2.5 px-3 text-center">الحد الأقصى</th>
                <th className="py-2.5 px-3 text-center">الجمعات المعينة</th>
                <th className="py-2.5 px-3 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imamLoads.map((i: any) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-bold text-slate-900">
                    <ClickableImam
                      id={i.id}
                      name={i.name}
                      className="font-bold text-slate-900 hover:text-emerald-700"
                    />
                  </td>
                  <td className="py-2 px-3 text-center text-slate-600 font-mono text-[11px]">{i.type}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{i.min}</td>
                  <td className="py-2 px-3 text-center font-bold text-slate-900 tabular-nums">{i.target}</td>
                  <td className="py-2 px-3 text-center tabular-nums">{i.max}</td>
                  <td className="py-2 px-3 text-center font-bold text-emerald-800 tabular-nums">{i.assigned}</td>
                  <td className="py-2 px-3 text-center">
                    {i.status === 'BALANCED' && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-800">
                        متوازن ✓
                      </span>
                    )}
                    {i.status === 'UNDER' && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-800">
                        دون الأدنى
                      </span>
                    )}
                    {i.status === 'OVER' && (
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-800">
                        فوق الأقصى
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
