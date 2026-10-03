import React, { useState, useEffect, useMemo } from 'react';
import { Mosque, Imam, MosqueImamRule, RelationshipType, FixedAssignmentPatternType } from '../../types/index.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Building2,
  Lock,
  Star,
  ShieldBan,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Copy,
  CalendarDays,
  Sparkles,
  Layers,
  ListOrdered,
  HelpCircle,
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { EgyptianAddressSelector, EgyptianAddressValue } from '../common/EgyptianAddressSelector.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';
import { SearchablePreacherSelect } from '../common/SearchablePreacherSelect.tsx';

interface MosqueProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mosque: Mosque | null;
  imams: Imam[];
  onSaved: () => void;
}

interface SplitGroup {
  id: string;
  imamId: number | '';
  count: number;
}

export function MosqueProfileModal({
  isOpen,
  onClose,
  mosque,
  imams,
  onSaved,
}: MosqueProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'fixed' | 'preferences' | 'restrictions'>('info');

  // Form states (Basic info)
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [region, setRegion] = useState('منشأة البكاري');
  const [address, setAddress] = useState('');
  const [countryId, setCountryId] = useState<number>(1);
  const [governorateId, setGovernorateId] = useState<number>(1);
  const [districtId, setDistrictId] = useState<number | null>(101);
  const [areaId, setAreaId] = useState<number | null>(1001);
  const [street, setStreet] = useState<string>('');
  const [buildingNumber, setBuildingNumber] = useState<string>('');
  const [landmark, setLandmark] = useState<string>('');
  const [formattedAddress, setFormattedAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');

  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  // -------------------------------------------------------------
  // Fixed Preacher per Friday System State
  // -------------------------------------------------------------
  const [hasFixedPattern, setHasFixedPattern] = useState(false);
  const [applyScope, setApplyScope] = useState<'MONTH' | 'YEAR'>('MONTH');
  const [patternYear, setPatternYear] = useState<number>(1448);
  const [patternMonth, setPatternMonth] = useState<number>(9); // Ramadan 1448 default
  const [patternType, setPatternType] = useState<FixedAssignmentPatternType>('SAME_ALL');
  const [singleImamId, setSingleImamId] = useState<number | ''>('');
  const [fridaySlots, setFridaySlots] = useState<{ fridayIndex: number; imamId: number | ''; notes?: string }[]>([]);
  const [splitGroups, setSplitGroups] = useState<SplitGroup[]>([
    { id: 'grp-1', imamId: '', count: 2 },
    { id: 'grp-2', imamId: '', count: 3 },
  ]);
  const [existingPatternId, setExistingPatternId] = useState<number | null>(null);
  const [patternConflictWarning, setPatternConflictWarning] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  // Rules list
  const [rules, setRules] = useState<MosqueImamRule[]>([]);
  const [selectedImamToAdd, setSelectedImamToAdd] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Month details from CalendarService
  const monthDetails = useMemo(() => {
    try {
      return CalendarService.getHijriMonthDetails(patternYear, patternMonth);
    } catch {
      return {
        monthName: 'رمضان',
        fridaysCount: 5,
        fridays: [1, 2, 3, 4, 5].map((idx) => ({
          fridayIndex: idx,
          hijriDate: `جمعة ${idx}`,
          gregorianDate: '',
        })),
      };
    }
  }, [patternYear, patternMonth]);

  const actualFridaysCount = monthDetails.fridaysCount;

  // Initialize slots when month or fridays count changes
  useEffect(() => {
    setFridaySlots((prev) => {
      const newSlots: { fridayIndex: number; imamId: number | ''; notes?: string }[] = [];
      for (let i = 1; i <= actualFridaysCount; i++) {
        const existing = prev.find((p) => p.fridayIndex === i);
        newSlots.push(existing || { fridayIndex: i, imamId: singleImamId || '' });
      }
      return newSlots;
    });
  }, [actualFridaysCount, patternYear, patternMonth]);

  // Load existing fixed pattern when mosque or selected month changes
  const loadFixedPattern = async (mId: number, yr: number, mo: number) => {
    try {
      setPatternConflictWarning(null);
      const res = await fetchApi<any>(`/api/mosques/${mId}/fixed-patterns?year=${yr}&month=${mo}`);
      if (res.exists && res.pattern) {
        setHasFixedPattern(true);
        setExistingPatternId(res.pattern.id);
        setPatternType(res.pattern.patternType || 'SAME_ALL');

        if (res.pattern.items && res.pattern.items.length > 0) {
          if (res.pattern.patternType === 'SAME_ALL') {
            setSingleImamId(res.pattern.items[0].imamId);
          }

          const loadedSlots = res.pattern.items.map((it: any) => ({
            fridayIndex: it.fridayIndex,
            imamId: it.imamId,
            notes: it.notes || '',
          }));

          // Fill any missing slots
          for (let f = 1; f <= actualFridaysCount; f++) {
            if (!loadedSlots.some((s: any) => s.fridayIndex === f)) {
              loadedSlots.push({ fridayIndex: f, imamId: '' });
            }
          }
          setFridaySlots(loadedSlots.sort((a: any, b: any) => a.fridayIndex - b.fridayIndex));
        }
      } else {
        setHasFixedPattern(Boolean(mosque?.fixedImamId));
        setExistingPatternId(null);
        if (mosque?.fixedImamId) {
          setSingleImamId(mosque.fixedImamId);
          setPatternType('SAME_ALL');
          const defSlots = [];
          for (let f = 1; f <= actualFridaysCount; f++) {
            defSlots.push({ fridayIndex: f, imamId: mosque.fixedImamId });
          }
          setFridaySlots(defSlots);
        }
      }
    } catch {
      // Ignore network errors on initial preview
    }
  };

  useEffect(() => {
    if (mosque) {
      setName(mosque.name);
      setCode(mosque.code);
      setRegion(mosque.region || 'منشأة البكاري');
      setAddress(mosque.formattedAddress || mosque.address || '');
      setCountryId(mosque.countryId || 1);
      setGovernorateId(mosque.governorateId || 1);
      setDistrictId(mosque.districtId !== undefined && mosque.districtId !== null ? mosque.districtId : 101);
      setAreaId(mosque.areaId !== undefined && mosque.areaId !== null ? mosque.areaId : 1001);
      setStreet(mosque.street || '');
      setBuildingNumber(mosque.buildingNumber || '');
      setLandmark(mosque.landmark || '');
      setFormattedAddress(mosque.formattedAddress || mosque.address || '');
      setLatitude(mosque.latitude ? String(mosque.latitude) : '');
      setLongitude(mosque.longitude ? String(mosque.longitude) : '');

      setManagerName(mosque.managerName || '');
      setPhone(mosque.phone || '');
      setWhatsapp(mosque.whatsapp || '');
      setIsActive(mosque.isActive);
      setNotes(mosque.notes || '');

      loadFixedPattern(mosque.id, patternYear, patternMonth);

      // Load rules for this mosque
      fetchApi<any>(`/api/mosques/${mosque.id}`)
        .then((res) => {
          if (res.rules) setRules(res.rules);
        })
        .catch(() => {});
    } else {
      // New Mosque Default (Munsha'at Al-Bakkari, Haram, Giza, Egypt)
      setName('');
      setCode(`MSQ-${Math.floor(100 + Math.random() * 900)}`);
      setRegion('منشأة البكاري');
      setAddress('منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية');
      setCountryId(1);
      setGovernorateId(1);
      setDistrictId(101);
      setAreaId(1001);
      setStreet('');
      setBuildingNumber('');
      setLandmark('');
      setFormattedAddress('منشأة البكاري، حي الهرم، محافظة الجيزة، جمهورية مصر العربية');
      setLatitude('');
      setLongitude('');

      setManagerName('');
      setPhone('');
      setWhatsapp('');
      setIsActive(true);
      setNotes('');
      setHasFixedPattern(false);
      setSingleImamId('');
      setPatternType('SAME_ALL');
      setFridaySlots([]);
      setRules([]);
    }
    setActiveTab('info');
    setFeedback(null);
    setErrorMessage(null);
  }, [mosque, isOpen]);

  // When pattern type or singleImamId changes, keep slots synchronized
  const handleSingleImamChange = (imId: number | '') => {
    setSingleImamId(imId);
    if (patternType === 'SAME_ALL') {
      const updated = [];
      for (let f = 1; f <= actualFridaysCount; f++) {
        updated.push({ fridayIndex: f, imamId: imId });
      }
      setFridaySlots(updated);
    }
  };

  // Split Groups Calculation
  const totalAllocatedInGroups = useMemo(() => {
    return splitGroups.reduce((acc, g) => acc + (Number(g.count) || 0), 0);
  }, [splitGroups]);

  const handleApplySplitGroups = () => {
    let currentFriday = 1;
    const newSlots: { fridayIndex: number; imamId: number | ''; notes?: string }[] = [];

    for (const grp of splitGroups) {
      if (!grp.imamId || !grp.count) continue;
      for (let c = 0; c < grp.count; c++) {
        if (currentFriday <= actualFridaysCount) {
          newSlots.push({
            fridayIndex: currentFriday,
            imamId: grp.imamId,
            notes: `توزيع المجموعات (${grp.count} جمعات)`,
          });
          currentFriday++;
        }
      }
    }

    // Fill remainder if any
    for (let f = currentFriday; f <= actualFridaysCount; f++) {
      newSlots.push({ fridayIndex: f, imamId: '' });
    }

    setFridaySlots(newSlots);
  };

  const handleAddressSelectorChange = (addr: EgyptianAddressValue) => {
    setCountryId(addr.countryId);
    setGovernorateId(addr.governorateId);
    setDistrictId(addr.districtId);
    setAreaId(addr.areaId);
    setStreet(addr.street);
    setBuildingNumber(addr.buildingNumber);
    setLandmark(addr.landmark);
    setFormattedAddress(addr.formattedAddress);
    setAddress(addr.formattedAddress);
    setLatitude(addr.latitude ? String(addr.latitude) : '');
    setLongitude(addr.longitude ? String(addr.longitude) : '');
    if (addr.areaName) {
      setRegion(addr.areaName);
    } else if (addr.districtName) {
      setRegion(addr.districtName);
    }
  };

  // Save Mosque Profile & Fixed Patterns
  const handleSaveBasicAndFixed = async () => {
    setErrorMessage(null);
    setPatternConflictWarning(null);
    if (!name || !code) {
      setErrorMessage('يرجى ملء الاسم والكود');
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name,
        code,
        region: region || 'منشأة البكاري',
        address: formattedAddress || address,
        countryId,
        governorateId,
        districtId,
        areaId,
        street,
        buildingNumber,
        landmark,
        formattedAddress: formattedAddress || address,
        latitude,
        longitude,
        managerName,
        phone,
        whatsapp,
        isActive,
        notes,
        fixedImamId: hasFixedPattern && singleImamId ? singleImamId : null,
        fixedPattern: hasFixedPattern ? (patternType === 'SAME_ALL' ? 'ALL' : 'SPECIFIC_FRIDAYS') : 'ALL',
        fixedCount: hasFixedPattern ? actualFridaysCount : 0,
      };

      let savedMosqueId = mosque?.id;

      if (mosque) {
        await fetchApi(`/api/mosques/${mosque.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback('تم تحديث بيانات المسجد والموقع الإداري بنجاح');
      } else {
        const created: any = await fetchApi('/api/mosques', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedMosqueId = created.id;
        setFeedback('تم تسجيل المسجد الجديد بنجاح');
      }

      // If Fixed Pattern is active, save pattern items for the selected month
      if (hasFixedPattern && savedMosqueId) {
        let itemsToSave: any[] = [];

        if (patternType === 'SAME_ALL') {
          if (!singleImamId) {
            throw new Error('يرجى اختيار الخطيب الثابت لكافة جمعات الشهر');
          }
          for (let f = 1; f <= actualFridaysCount; f++) {
            itemsToSave.push({ fridayIndex: f, imamId: singleImamId });
          }
        } else if (patternType === 'SPLIT_COUNTS') {
          if (totalAllocatedInGroups !== actualFridaysCount) {
            throw new Error(`مجموع جمعات المجموعات (${totalAllocatedInGroups}) لا يساوي إجمالي جمعات الشهر (${actualFridaysCount})`);
          }
          handleApplySplitGroups();
          let curr = 1;
          for (const grp of splitGroups) {
            if (!grp.imamId) throw new Error('يرجى تحديد الخطيب لجميع المجموعات');
            for (let c = 0; c < grp.count; c++) {
              if (curr <= actualFridaysCount) {
                itemsToSave.push({ fridayIndex: curr, imamId: Number(grp.imamId) });
                curr++;
              }
            }
          }
        } else {
          // SPECIFIC_FRIDAYS or CUSTOM
          itemsToSave = fridaySlots
            .filter((s) => s.imamId && s.fridayIndex <= actualFridaysCount)
            .map((s) => ({
              fridayIndex: s.fridayIndex,
              imamId: Number(s.imamId),
              notes: s.notes || null,
            }));

          if (patternType === 'SPECIFIC_FRIDAYS' && itemsToSave.length < actualFridaysCount) {
            throw new Error(`يرجى تحديد الخطيب لجميع جمعات الشهر (${actualFridaysCount} جمعات)`);
          }
        }

        const patternSaveRes: any = await fetchApi(`/api/mosques/${savedMosqueId}/fixed-patterns`, {
          method: 'POST',
          body: JSON.stringify({
            hijriYear: patternYear,
            hijriMonth: patternMonth,
            applyToFullYear: applyScope === 'YEAR',
            patternType,
            fridaysCount: actualFridaysCount,
            items: itemsToSave,
          }),
        });

        if (patternSaveRes.patternId) {
          setExistingPatternId(patternSaveRes.patternId);
        }
      }

      onSaved();
      setTimeout(() => {
        if (!mosque) onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حفظ بيانات المسجد ونمط التثبيت');
    } finally {
      setSaving(false);
    }
  };

  // Copy Pattern to Next Month Handler
  const handleCopyPatternToNextMonth = async () => {
    if (!mosque) return;
    setIsCopying(true);
    setErrorMessage(null);
    try {
      const nextMonth = patternMonth === 12 ? 1 : patternMonth + 1;
      const nextYear = patternMonth === 12 ? patternYear + 1 : patternYear;

      const res: any = await fetchApi(`/api/mosques/${mosque.id}/fixed-patterns/copy`, {
        method: 'POST',
        body: JSON.stringify({
          sourceYear: patternYear,
          sourceMonth: patternMonth,
          targetYear: nextYear,
          targetMonth: nextMonth,
        }),
      });

      setFeedback(res.message || 'تم نسخ نمط التثبيت للشهر القادم بنجاح');
      setTimeout(() => setFeedback(null), 3500);
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر نسخ النمط للشهر القادم');
    } finally {
      setIsCopying(false);
    }
  };

  // Delete Pattern Handler
  const handleDeleteFixedPattern = async () => {
    if (!mosque || !existingPatternId) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/mosques/${mosque.id}/fixed-patterns/${existingPatternId}`, {
        method: 'DELETE',
      });
      setHasFixedPattern(false);
      setExistingPatternId(null);
      setFeedback('تم حذف نمط التثبيت لهذا الشهر بنجاح');
      setTimeout(() => setFeedback(null), 3000);
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حذف نمط التثبيت');
    }
  };

  // Preference Handlers
  const preferredRules = rules.filter((r) => r.relationshipType === 'PREFERRED').sort((a, b) => a.priority - b.priority);
  const restrictionRules = rules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED');

  const handleAddRule = async (type: RelationshipType) => {
    if (!mosque || !selectedImamToAdd) return;
    setErrorMessage(null);
    try {
      const highestPriority = preferredRules.length > 0 ? Math.max(...preferredRules.map((r) => r.priority)) + 1 : 1;
      await fetchApi<MosqueImamRule>(`/api/mosques/${mosque.id}/rules`, {
        method: 'POST',
        body: JSON.stringify({
          imamId: selectedImamToAdd,
          relationshipType: type,
          priority: type === 'PREFERRED' ? highestPriority : 1,
        }),
      });

      const updated = await fetchApi<any>(`/api/mosques/${mosque.id}`);
      if (updated.rules) setRules(updated.rules);
      setSelectedImamToAdd('');
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إضافة القاعدة');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!mosque) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/mosques/${mosque.id}/rules/${ruleId}`, { method: 'DELETE' });
      setRules(rules.filter((r) => r.id !== ruleId));
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حذف القاعدة');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mosque ? `ملف المسجد: ${mosque.name}` : 'إضافة مسجد جديد'}
      subtitle={mosque ? `كود: ${mosque.code} · ${mosque.region}` : 'تسجيل مسجد جديد في منظومة الجمعية الشرعية'}
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {feedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-bold">تنبيه:</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex items-center gap-1 border-b border-slate-200 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'info'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>البيانات الأساسية والموقع</span>
          </button>

          <button
            onClick={() => setActiveTab('fixed')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'fixed'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-500" />
            <span>الخطيب الثابت لكل جمعة</span>
            {hasFixedPattern && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
          </button>

          {mosque && (
            <>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'preferences'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Star className="w-3.5 h-3.5 text-amber-500" />
                <span>الخطباء المفضلون ({preferredRules.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('restrictions')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'restrictions'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <ShieldBan className="w-3.5 h-3.5 text-rose-500" />
                <span>المحظورات والاستبعاد ({restrictionRules.length})</span>
              </button>
            </>
          )}
        </div>

        {/* Tab 1: Info */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">اسم المسجد *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مسجد الرحمن الرحيم"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">كود المسجد *</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MSQ-01"
                  className="w-full text-xs p-2.5 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">اسم المشرف / مسؤول المسجد</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="الاسم الثلاثي"
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">رقم الهاتف / الواتساب</label>
                <input
                  type="text"
                  value={whatsapp || phone}
                  onChange={(e) => {
                    setWhatsapp(e.target.value);
                    setPhone(e.target.value);
                  }}
                  placeholder="01012345678"
                  className="w-full text-xs p-2.5 font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Hierarchical Egyptian Address Selector */}
            <div className="pt-2">
              <EgyptianAddressSelector
                title="الموقع الجغرافي والإداري للمسجد (مصر)"
                value={{
                  countryId,
                  governorateId,
                  districtId,
                  areaId,
                  street,
                  buildingNumber,
                  landmark,
                  formattedAddress,
                  latitude,
                  longitude,
                }}
                onChange={handleAddressSelectorChange}
                showCoordinates={true}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-medium text-slate-800">المسجد نشط ويدخل في توزيع الجداول الشهرية</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ملاحظات إضافية</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-600"
                placeholder="سعة المسجد، أوقات معينة، أي شروط خاصة..."
              />
            </div>
          </div>
        )}

        {/* Tab 2: Flexible Preacher per Friday System */}
        {activeTab === 'fixed' && (
          <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            {/* 1. Header & Enable Checkbox */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-slate-900 font-heading flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>تثبيت خطباء هذا المسجد حسب جمعات الشهر</span>
                </h4>
                <p className="text-xs text-slate-500">
                  تحديد الخطيب لكل جمعة فعلية داخل الشهر بشكل صريح ومرن (قيد صارم Hard Constraint لا يتغير تلقائياً)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                  <input
                    type="checkbox"
                    checked={hasFixedPattern}
                    onChange={(e) => {
                      setHasFixedPattern(e.target.checked);
                      if (e.target.checked && fridaySlots.length === 0) {
                        const def: { fridayIndex: number; imamId: number | ''; notes?: string }[] = [];
                        for (let f = 1; f <= actualFridaysCount; f++) {
                          def.push({ fridayIndex: f, imamId: singleImamId || '' });
                        }
                        setFridaySlots(def);
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">تفعيل الخطيب الثابت</span>
                </label>
              </div>
            </div>

            {hasFixedPattern && (
              <div className="space-y-4 pt-1">
                {/* 2. Temporal Scope Selector & Month/Year Bar */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-xs font-bold text-slate-900 font-heading">نطاق تطبيق التثبيت:</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setApplyScope('MONTH')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          applyScope === 'MONTH'
                            ? 'bg-white text-emerald-950 shadow-2xs border border-emerald-300 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>📅 شهر هجري محدد</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setApplyScope('YEAR')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          applyScope === 'YEAR'
                            ? 'bg-emerald-800 text-white shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>✨ العام الهجري بالكامل (طوال السنة)</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">الفترة الزمنية:</span>
                      {applyScope === 'MONTH' ? (
                        <select
                          value={patternMonth}
                          onChange={(e) => {
                            const m = Number(e.target.value);
                            setPatternMonth(m);
                            if (mosque) loadFixedPattern(mosque.id, patternYear, m);
                          }}
                          className="text-xs font-bold p-1.5 border border-slate-300 rounded-lg bg-emerald-50/50 text-slate-900"
                        >
                          <option value={9}>رمضان (9)</option>
                          <option value={10}>شوال (10)</option>
                          <option value={11}>ذو القعدة (11)</option>
                          <option value={12}>ذو الحجة (12)</option>
                          <option value={1}>محرم (1)</option>
                          <option value={2}>صفر (2)</option>
                          <option value={3}>ربيع الأول (3)</option>
                          <option value={4}>ربيع الآخر (4)</option>
                          <option value={5}>جمادى الأولى (5)</option>
                          <option value={6}>جمادى الآخرة (6)</option>
                          <option value={7}>رجب (7)</option>
                          <option value={8}>شعبان (8)</option>
                        </select>
                      ) : (
                        <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-950 rounded-lg border border-amber-300">
                          جميع أشهر السنة الـ 12 (من محرم إلى ذي الحجة)
                        </span>
                      )}

                      <select
                        value={patternYear}
                        onChange={(e) => {
                          const y = Number(e.target.value);
                          setPatternYear(y);
                          if (mosque && applyScope === 'MONTH') loadFixedPattern(mosque.id, y, patternMonth);
                        }}
                        className="text-xs font-bold p-1.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-900"
                      >
                        <option value={1448}>1448 هـ</option>
                        <option value={1449}>1449 هـ</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {applyScope === 'MONTH' && (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-100/70 text-emerald-900 font-bold border border-emerald-200">
                          عدد جمعات الشهر الفعلي: {actualFridaysCount} جمعات
                        </span>
                      )}

                      {mosque && applyScope === 'MONTH' && (
                        <button
                          type="button"
                          disabled={isCopying}
                          onClick={handleCopyPatternToNextMonth}
                          className="px-2.5 py-1 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50"
                          title="نسخ نمط هذا الشهر للشهر القادم تلقائياً"
                        >
                          <Copy className="w-3.5 h-3.5 text-emerald-700" />
                          <span>{isCopying ? 'جارٍ النسخ...' : 'نسخ للشهر القادم'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Pattern Mode Selector (4 Options) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">طريقة ونمط التثبيت:</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {/* Option 1 */}
                    <button
                      type="button"
                      onClick={() => {
                        setPatternType('SAME_ALL');
                        if (singleImamId) {
                          const upd = [];
                          for (let f = 1; f <= actualFridaysCount; f++) {
                            upd.push({ fridayIndex: f, imamId: singleImamId });
                          }
                          setFridaySlots(upd);
                        }
                      }}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        patternType === 'SAME_ALL'
                          ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs text-slate-900'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold font-heading">نفس الخطيب طوال الشهر</span>
                        {patternType === 'SAME_ALL' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">خطيب واحد لكافة جمعات الشهر ({actualFridaysCount} جمعات)</p>
                    </button>

                    {/* Option 2 */}
                    <button
                      type="button"
                      onClick={() => setPatternType('SPLIT_COUNTS')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        patternType === 'SPLIT_COUNTS'
                          ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs text-slate-900'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold font-heading">توزيع الخطباء على الجمع</span>
                        {patternType === 'SPLIT_COUNTS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">تقسيم جمعات الشهر بين خطيبين أو أكثر بنسب محددة</p>
                    </button>

                    {/* Option 3 */}
                    <button
                      type="button"
                      onClick={() => setPatternType('SPECIFIC_FRIDAYS')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        patternType === 'SPECIFIC_FRIDAYS'
                          ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs text-slate-900'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold font-heading">تحديد خطيب لكل جمعة</span>
                        {patternType === 'SPECIFIC_FRIDAYS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">بطاقة تعيين مستقلة لكل جمعة بتواريخها الهجرية</p>
                    </button>

                    {/* Option 4 */}
                    <button
                      type="button"
                      onClick={() => setPatternType('CUSTOM')}
                      className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                        patternType === 'CUSTOM'
                          ? 'bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-2xs text-slate-900'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-bold font-heading">نمط مخصص بالكامل</span>
                        {patternType === 'CUSTOM' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <p className="text-[11px] text-slate-500">حرية كاملة لتحديد الخطباء أو ترك بعض الجمعات مرنة</p>
                    </button>
                  </div>
                </div>

                {/* 4. MODE 1: SAME PREACHER ALL MONTH */}
                {patternType === 'SAME_ALL' && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-800 mb-1">
                        اختيار الخطيب الثابت المعتمد لهذا المسجد *
                      </label>
                      <SearchablePreacherSelect
                        imams={imams}
                        value={singleImamId}
                        onChange={(val) => handleSingleImamChange(val)}
                        placeholder="-- اكتب اسم الخطيب أو رقم الهاتف للبحث والتصفية --"
                      />
                    </div>

                    {singleImamId && (
                      <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>
                            {applyScope === 'YEAR' ? (
                              <>
                                سيتم تثبيت الشيخ ({imams.find((i) => i.id === singleImamId)?.name}) في جميع جمعات هذا المسجد
                                <strong className="text-emerald-950 underline font-black mx-1">طوال العام الهجري {patternYear} هـ بالكامل (12 شهراً)</strong>.
                              </>
                            ) : (
                              <>
                                سيتم تثبيت الشيخ ({imams.find((i) => i.id === singleImamId)?.name}) في جميع جمعات هذا المسجد
                                خلال شهر {monthDetails.monthName} {patternYear} هـ.
                              </>
                            )}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          {applyScope === 'YEAR'
                            ? `تطبيق شامل كـ Hard Constraint غير قابل للتغيير التلقائي لجميع الأشهر الـ 12 لعام ${patternYear} هـ.`
                            : `إجمالي الجمعات المخصصة لهذا الشهر: ${actualFridaysCount} جمعات (وفق تقويم أم القرى).`}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. MODE 2: SPLIT COUNTS BETWEEN PREACHERS */}
                {patternType === 'SPLIT_COUNTS' && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-800">تحديد مجموعات الخطباء وعدد الجمعات:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitGroups((prev) => [
                            ...prev,
                            { id: `grp-${Date.now()}`, imamId: '', count: 1 },
                          ]);
                        }}
                        className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold rounded-md border border-emerald-200 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة مجموعة</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {splitGroups.map((grp, idx) => (
                        <div
                          key={grp.id}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-center gap-3"
                        >
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>

                          <div className="flex-1 w-full sm:w-auto">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">فضيلة الشيخ</label>
                            <SearchablePreacherSelect
                              imams={imams}
                              value={grp.imamId}
                              onChange={(val) => {
                                setSplitGroups((prev) =>
                                  prev.map((g) => (g.id === grp.id ? { ...g, imamId: val } : g))
                                );
                              }}
                              placeholder="-- ابحث عن الخطيب --"
                            />
                          </div>

                          <div className="w-full sm:w-28">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">عدد الجمعات</label>
                            <input
                              type="number"
                              min={1}
                              max={actualFridaysCount}
                              value={grp.count}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 1;
                                setSplitGroups((prev) =>
                                  prev.map((g) => (g.id === grp.id ? { ...g, count: val } : g))
                                );
                              }}
                              className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white text-center font-bold"
                            />
                          </div>

                          {splitGroups.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                setSplitGroups((prev) => prev.filter((g) => g.id !== grp.id));
                              }}
                              className="text-rose-600 hover:text-rose-800 p-1.5 rounded self-end sm:self-center mt-2 sm:mt-4"
                              title="حذف المجموعة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Summary Bar */}
                    <div className="p-3 rounded-lg border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold bg-slate-100 border-slate-200">
                      <div className="flex items-center gap-4">
                        <span>إجمالي جمعات الشهر: <strong>{actualFridaysCount}</strong></span>
                        <span>تم التخصيص: <strong className="text-emerald-800">{totalAllocatedInGroups}</strong></span>
                        <span>المتبقي: <strong className={totalAllocatedInGroups === actualFridaysCount ? 'text-emerald-700' : 'text-rose-600'}>
                          {actualFridaysCount - totalAllocatedInGroups}
                        </strong></span>
                      </div>

                      {totalAllocatedInGroups === actualFridaysCount ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          التوزيع مكتمل ومطابق لجمعات الشهر
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {totalAllocatedInGroups < actualFridaysCount ? 'التوزيع غير مكتمل' : 'التوزيع يتجاوز جمعات الشهر'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. MODE 3 & 4: PER-FRIDAY CARDS (SPECIFIC & CUSTOM) */}
                {(patternType === 'SPECIFIC_FRIDAYS' || patternType === 'CUSTOM') && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-slate-800">
                        قائمة جمعات شهر {monthDetails.monthName} ({actualFridaysCount} جمعات):
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {patternType === 'SPECIFIC_FRIDAYS' ? 'تثبيت خطيب لكل جمعة' : 'نمط مخصص حر'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {monthDetails.fridays.map((fObj) => {
                        const slot = fridaySlots.find((s) => s.fridayIndex === fObj.fridayIndex);
                        const assignedImamId = slot?.imamId || '';

                        return (
                          <div
                            key={fObj.fridayIndex}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 hover:border-emerald-600/40 transition-all"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-center">
                                  {fObj.fridayIndex}
                                </span>
                                <span className="text-xs font-bold text-slate-900 font-heading">
                                  الجمعة {fObj.fridayIndex === 1 ? 'الأولى' : fObj.fridayIndex === 2 ? 'الثانية' : fObj.fridayIndex === 3 ? 'الثالثة' : fObj.fridayIndex === 4 ? 'الرابعة' : 'الخامسة'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">{fObj.hijriDate}</span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                الخطيب المكلف *
                              </label>
                              <SearchablePreacherSelect
                                imams={imams}
                                value={assignedImamId}
                                onChange={(val) => {
                                  setFridaySlots((prev) => {
                                    const next = [...prev];
                                    const existingIdx = next.findIndex((p) => p.fridayIndex === fObj.fridayIndex);
                                    if (existingIdx >= 0) {
                                      next[existingIdx] = { ...next[existingIdx], imamId: val };
                                    } else {
                                      next.push({ fridayIndex: fObj.fridayIndex, imamId: val });
                                    }
                                    return next;
                                  });
                                }}
                                placeholder={patternType === 'CUSTOM' ? '-- متروك للتوزيع المرن --' : '-- ابحث واختر الخطيب --'}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7. Action Buttons & Delete */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    ✓ يتم حفظ هذا النمط كقيد صارم (Hard Constraint) غير قابل للتغيير أثناء التوليد التلقائي.
                  </span>

                  {existingPatternId && (
                    <button
                      type="button"
                      onClick={handleDeleteFixedPattern}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء نمط التثبيت لهذا الشهر</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Preferences (Ordered Drag/Move) */}
        {activeTab === 'preferences' && mosque && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">ترتيب أولويات الخطباء المفضلين</h4>
                <p className="text-xs text-slate-500">
                  سيحاول محرك الجدولة تحقيق التفضيل الأعلى (رقم 1) أولاً، ثم التفضيلات التالية عند الحاجة.
                </p>
              </div>

              {/* Add preference picker */}
              <div className="flex items-center gap-2">
                <div className="w-72">
                  <SearchablePreacherSelect
                    imams={imams.filter((i) => !rules.some((r) => r.imamId === i.id))}
                    value={selectedImamToAdd}
                    onChange={(val) => setSelectedImamToAdd(val)}
                    placeholder="-- ابحث عن خطيب لإضافته للمفضلة --"
                  />
                </div>
                <button
                  type="button"
                  disabled={!selectedImamToAdd}
                  onClick={() => handleAddRule('PREFERRED')}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>
            </div>

            {/* Preferred list */}
            {preferredRules.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <Star className="w-8 h-8 mx-auto text-amber-300 mb-2" />
                <p className="text-xs">لم يتم تسجيل خطباء مفضلين لهذا المسجد بعد.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">يمكنك إضافة تفضيلات من القائمة بالأعلى.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {preferredRules.map((rule, idx) => {
                  const imamObj = imams.find((i) => i.id === rule.imamId);
                  return (
                    <div key={rule.id} className="p-3 flex items-center justify-between hover:bg-slate-50/60">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-xs flex items-center justify-center tabular-nums">
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-xs font-bold text-slate-900">{imamObj?.name || 'خطيب'}</span>
                          <span className="block text-[10px] text-slate-500">
                            {imamObj?.phone ? `هاتف: ${imamObj.phone}` : 'بدون هاتف'} · نوع: {imamObj?.type === 'FIXED' ? 'ثابت' : 'مرن'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                          title="حذف التفضيل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Restrictions */}
        {activeTab === 'restrictions' && mosque && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">قواعد الاستبعاد والحظر</h4>
                <p className="text-xs text-slate-500">
                  منع خطيب معين من الخطابة في هذا المسجد مطلقاً (قيد صارم Hard Constraint).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedImamToAdd}
                  onChange={(e) => setSelectedImamToAdd(e.target.value ? Number(e.target.value) : '')}
                  className="text-xs p-2 border border-slate-200 rounded-lg bg-white focus:outline-none"
                >
                  <option value="">-- اختر خطيباً لإضافته للحظر --</option>
                  {imams
                    .filter((i) => !rules.some((r) => r.imamId === i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedImamToAdd}
                  onClick={() => handleAddRule('FORBIDDEN')}
                  className="px-3 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ShieldBan className="w-3.5 h-3.5" />
                  <span>إضافة حظر</span>
                </button>
              </div>
            </div>

            {restrictionRules.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400">
                <ShieldBan className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs">لا توجد قيود أو خطباء محظورون لهذا المسجد.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {restrictionRules.map((rule) => {
                  const imamObj = imams.find((i) => i.id === rule.imamId);
                  return (
                    <div key={rule.id} className="p-3 flex items-center justify-between hover:bg-rose-50/30">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          محظور (FORBIDDEN)
                        </span>
                        <span className="text-xs font-bold text-slate-900">{imamObj?.name || 'خطيب'}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            إغلاق
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSaveBasicAndFixed}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ البيانات ونمط التثبيت'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
