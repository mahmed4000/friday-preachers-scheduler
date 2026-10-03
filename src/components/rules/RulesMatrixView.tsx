import React, { useState } from 'react';
import { Mosque, Imam, MosqueImamRule } from '../../types/index.ts';
import { Sliders, Search, Trash2, ShieldAlert, Star, ThumbsDown } from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { ClickableMosque, ClickableImam } from '../../context/ProfileNavigationContext.tsx';

interface RulesMatrixViewProps {
  mosques: Mosque[];
  imams: Imam[];
  rules: MosqueImamRule[];
  onRefresh: () => void;
}

export function RulesMatrixView({ mosques, imams, rules, onRefresh }: RulesMatrixViewProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [ruleError, setRuleError] = useState<string | null>(null);

  const mosqueMap = new Map(mosques.map((m) => [m.id, m]));
  const imamMap = new Map(imams.map((i) => [i.id, i]));

  const filteredRules = rules.filter((r) => {
    const mosque = mosqueMap.get(r.mosqueId);
    const imam = imamMap.get(r.imamId);
    const matchSearch =
      (mosque && mosque.name.includes(search)) ||
      (imam && imam.name.includes(search));
    const matchType = typeFilter === 'ALL' || r.relationshipType === typeFilter;
    return matchSearch && matchType;
  });

  const handleDeleteRule = async (ruleId: number, mosqueId: number) => {
    setRuleError(null);
    try {
      await fetchApi(`/api/mosques/${mosqueId}/rules/${ruleId}`, { method: 'DELETE' });
      onRefresh();
    } catch (err: any) {
      setRuleError(err.message || 'تعذر حذف القاعدة');
    }
  };

  return (
    <div className="space-y-4">
      {ruleError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
          <span>{ruleError}</span>
          <button onClick={() => setRuleError(null)} className="underline text-[11px]">إغلاق</button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 font-heading">مصفوفة القواعد والتفضيلات (Rules Matrix)</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض وإدارة العلاقات المباشرة بين المساجد والخطباء (المفضلون، الممنوعون، وغير المرغوب فيهم)
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث باسم المسجد أو اسم الخطيب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center p-0.5 bg-slate-100 rounded-lg shrink-0">
          <button
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الكل ({rules.length})
          </button>
          <button
            onClick={() => setTypeFilter('PREFERRED')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              typeFilter === 'PREFERRED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            المفضلون ⭐ ({rules.filter((r) => r.relationshipType === 'PREFERRED').length})
          </button>
          <button
            onClick={() => setTypeFilter('FORBIDDEN')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              typeFilter === 'FORBIDDEN' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            الممنوعون 🚫 ({rules.filter((r) => r.relationshipType === 'FORBIDDEN').length})
          </button>
          <button
            onClick={() => setTypeFilter('DISCOURAGED')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
              typeFilter === 'DISCOURAGED' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            غير مرغوب ({rules.filter((r) => r.relationshipType === 'DISCOURAGED').length})
          </button>
        </div>
      </div>

      {/* Rules list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
            <tr>
              <th className="py-3 px-4">المسجد</th>
              <th className="py-3 px-4">الخطيب</th>
              <th className="py-3 px-4">نوع القاعدة</th>
              <th className="py-3 px-4 text-center">درجة الأولوية</th>
              <th className="py-3 px-4">ملاحظات</th>
              <th className="py-3 px-4 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredRules.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <Sliders className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm">لا توجد قواعد مسجلة مطابقة للبحث</p>
                </td>
              </tr>
            ) : (
              filteredRules.map((rule) => {
                const mosque = mosqueMap.get(rule.mosqueId);
                const imam = imamMap.get(rule.imamId);
                return (
                  <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {mosque ? (
                        <ClickableMosque
                          id={mosque.id}
                          name={mosque.name}
                          code={mosque.code}
                          className="font-bold text-slate-900 hover:text-emerald-700"
                        />
                      ) : (
                        <span>مسجد #{rule.mosqueId}</span>
                      )}
                      <span className="block text-[11px] font-normal text-slate-400">
                        {mosque?.region} · كود {mosque?.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {imam ? (
                        <ClickableImam
                          id={imam.id}
                          name={imam.name}
                          className="font-medium text-slate-800 hover:text-emerald-700"
                        />
                      ) : (
                        <span>خطيب #{rule.imamId}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {rule.relationshipType === 'PREFERRED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
                          <Star className="w-3 h-3 text-amber-600" />
                          مفضل
                        </span>
                      )}
                      {rule.relationshipType === 'FORBIDDEN' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-xs font-semibold">
                          <ShieldAlert className="w-3 h-3 text-rose-600" />
                          ممنوع (FORBIDDEN)
                        </span>
                      )}
                      {rule.relationshipType === 'DISCOURAGED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold">
                          <ThumbsDown className="w-3 h-3 text-slate-500" />
                          غير مرغوب
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                      {rule.relationshipType === 'PREFERRED' ? `#${rule.priority}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {rule.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDeleteRule(rule.id, rule.mosqueId)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                        title="حذف القاعدة"
                      >
                        <Trash2 className="w-4 h-4 mx-auto" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
