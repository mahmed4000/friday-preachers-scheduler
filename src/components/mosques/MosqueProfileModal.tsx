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
import { HIJRI_MONTH_NAMES } from '../../services/calendar/calendarProvider.ts';
import { SearchablePreacherSelect } from '../common/SearchablePreacherSelect.tsx';

interface MosqueProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  mosque: Mosque | null;
  imams: Imam[];
  onSaved: (updatedMosque?: Mosque) => void;
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

  // Hijri date reference
  const currentHijriInfo = useMemo(() => {
    try {
      return CalendarService.getCurrentDateTime().hijri;
    } catch {
      return { year: 1448, month: 1 };
    }
  }, []);

  // -------------------------------------------------------------
  // Fixed Preacher per Friday System State (Perpetual 5-Friday Pattern)
  // -------------------------------------------------------------
  const [hasFixedPattern, setHasFixedPattern] = useState(false);
  const [singleImamId, setSingleImamId] = useState<number | ''>('');
  const [fridaySlots, setFridaySlots] = useState<{ fridayIndex: number; imamId: number | ''; notes?: string }[]>([
    { fridayIndex: 1, imamId: '' },
    { fridayIndex: 2, imamId: '' },
    { fridayIndex: 3, imamId: '' },
    { fridayIndex: 4, imamId: '' },
    { fridayIndex: 5, imamId: '' },
  ]);
  const [occupiedSlotsByFriday, setOccupiedSlotsByFriday] = useState<
    Record<number, Array<{ imamId: number; imamName: string; mosqueId: number; mosqueName: string }>>
  >({ 1: [], 2: [], 3: [], 4: [], 5: [] });
  const [existingPatternId, setExistingPatternId] = useState<number | null>(null);

  // Rules list - Decoupled selection states
  const [rules, setRules] = useState<MosqueImamRule[]>([]);
  const [selectedPreferredImam, setSelectedPreferredImam] = useState<number | ''>('');
  const [selectedForbiddenImam, setSelectedForbiddenImam] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper: Disabled imams for a specific Friday index (1 to 5)
  const getDisabledImamsForFriday = (fridayIndex: number) => {
    const list = occupiedSlotsByFriday[fridayIndex] || [];
    const map: Record<number, { reason: string; mosqueName: string; fridayIndex: number }> = {};
    for (const item of list) {
      map[item.imamId] = {
        reason: `محجوز في ${item.mosqueName} (الجمعة ${fridayIndex})`,
        mosqueName: item.mosqueName,
        fridayIndex,
      };
    }
    return map;
  };

  // Helper: Disabled imams for Whole Month (any preacher occupied in ANY Friday in another mosque)
  const disabledImamsForAllFridays = useMemo(() => {
    const map: Record<number, { reason: string; mosqueName: string; fridayIndex: number }> = {};
    for (let f = 1; f <= 5; f++) {
      const list = occupiedSlotsByFriday[f] || [];
      for (const item of list) {
        if (!map[item.imamId]) {
          map[item.imamId] = {
            reason: `محجوز في ${item.mosqueName} (الجمعة ${f})`,
            mosqueName: item.mosqueName,
            fridayIndex: f,
          };
        }
      }
    }
    return map;
  }, [occupiedSlotsByFriday]);

  // Load existing fixed pattern and collision data from backend
  const loadFixedPattern = async (mId: number) => {
    try {
      const res = await fetchApi<any>(`/api/mosques/${mId}/fixed-patterns`);
      if (res.occupiedSlotsByFriday) {
        setOccupiedSlotsByFriday(res.occupiedSlotsByFriday);
      }

      if (res.exists && res.pattern && Array.isArray(res.pattern.items)) {
        setHasFixedPattern(true);
        setExistingPatternId(res.pattern.id || null);

        const loadedSlots: { fridayIndex: number; imamId: number | ''; notes?: string }[] = [1, 2, 3, 4, 5].map((idx) => {
          const found = res.pattern.items.find((it: any) => it.fridayIndex === idx);
          return {
            fridayIndex: idx,
            imamId: found?.imamId ? (Number(found.imamId) as number) : (''),
            notes: found?.notes || '',
          };
        });
        setFridaySlots(loadedSlots);

        const firstId = loadedSlots[0]?.imamId;
        const isAllSame = typeof firstId === 'number' && loadedSlots.every((s) => s.imamId === firstId);
        setSingleImamId(isAllSame ? (firstId as number) : '');
      } else {
        const isFixed = Boolean(mosque?.fixedImamId);
        setHasFixedPattern(isFixed);
        setExistingPatternId(null);
        if (mosque?.fixedImamId) {
          const fId = Number(mosque.fixedImamId);
          setSingleImamId(fId);
          setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: fId })));
        } else {
          setSingleImamId('');
          setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: '' })));
        }
      }
    } catch {
      // Ignore network errors on initial preview
    }
  };

  useEffect(() => {
    let isCancelled = false;

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

      // Cleanly reset and initialize fixed pattern states for this specific mosque
      const isFixed = Boolean(mosque.fixedImamId);
      setHasFixedPattern(isFixed);
      setSingleImamId(mosque.fixedImamId ? Number(mosque.fixedImamId) : '');
      setExistingPatternId(null);

      const initialSlots: { fridayIndex: number; imamId: number | ''; notes?: string }[] = [1, 2, 3, 4, 5].map((idx) => ({
        fridayIndex: idx,
        imamId: mosque.fixedImamId ? (Number(mosque.fixedImamId) as number) : '',
      }));
      setFridaySlots(initialSlots);

      loadFixedPattern(mosque.id);

      // Load rules for this mosque
      fetchApi<any>(`/api/mosques/${mosque.id}`)
        .then((res) => {
          if (isCancelled) return;
          if (Array.isArray(res.rules)) {
            setRules(res.rules);
          } else if (res.rules && typeof res.rules === 'object') {
            const flattened: MosqueImamRule[] = [
              ...(res.rules.preferred || []),
              ...(res.rules.forbidden || []),
              ...(res.rules.allowed || []),
              ...(res.rules.discouraged || []),
            ];
            setRules(flattened);
          }
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
      setExistingPatternId(null);
      setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: '' })));
      setRules([]);
    }
    setSelectedPreferredImam('');
    setSelectedForbiddenImam('');
    setActiveTab('info');
    setFeedback(null);
    setErrorMessage(null);

    return () => {
      isCancelled = true;
    };
  }, [mosque?.id, isOpen]);

  // Quick change when single preacher for all fridays is selected
  const handleWholeMonthPreacherChange = (imId: number | '') => {
    setSingleImamId(imId);
    if (imId) {
      setHasFixedPattern(true);
      setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: imId })));
    } else {
      setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: '' })));
    }
  };

  // Change individual Friday slot
  const handleFridaySlotChange = (fridayIndex: number, imId: number | '') => {
    setFridaySlots((prev) => {
      const next = prev.map((s) => (s.fridayIndex === fridayIndex ? { ...s, imamId: imId } : s));
      const firstId = next[0]?.imamId;
      const isAllSame = firstId && next.every((s) => s.imamId === firstId);
      setSingleImamId(isAllSame ? firstId : '');
      if (next.some((s) => Boolean(s.imamId))) {
        setHasFixedPattern(true);
      }
      return next;
    });
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
    if (!name || !code) {
      setErrorMessage('يرجى ملء الاسم والكود');
      return;
    }

    if (hasFixedPattern) {
      const assignedCount = fridaySlots.filter((s) => Boolean(s.imamId)).length;
      if (assignedCount === 0 && !singleImamId) {
        setErrorMessage('يرجى اختيار خطيب لجمعة واحدة على الأقل أو إلغاء تفعيل خيار الخطيب الثابت');
        return;
      }

      // التحقق الفوري من عدم تعارض أي جمعة مع مسجد آخر
      for (const s of fridaySlots) {
        if (s.imamId) {
          const occList = occupiedSlotsByFriday[s.fridayIndex] || [];
          const conflict = occList.find((c) => c.imamId === Number(s.imamId));
          if (conflict) {
            const imName = imams.find((i) => i.id === Number(s.imamId))?.name || `خطيب #${s.imamId}`;
            setErrorMessage(`تعارض في التثبيت: فضيلة الشيخ (${imName}) محجوز في (${conflict.mosqueName}) في الجمعة (${s.fridayIndex}). لا يمكن تثبيته في أكثر من مسجد لنفس الجمعة.`);
            return;
          }
        }
      }
    }

    setSaving(true);
    setFeedback(null);

    try {
      const assignedCount = hasFixedPattern ? fridaySlots.filter((s) => Boolean(s.imamId)).length : 0;
      const isAllSame = hasFixedPattern && assignedCount === 5 && singleImamId;

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
        fixedImamId: isAllSame ? Number(singleImamId) : null,
        fixedPattern: hasFixedPattern ? (isAllSame ? 'ALL' : 'SPECIFIC_FRIDAYS') : 'NONE',
        fixedCount: assignedCount,
      };

      let savedMosqueRes: any;
      let savedMosqueId = mosque?.id;

      if (mosque) {
        savedMosqueRes = await fetchApi(`/api/mosques/${mosque.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        savedMosqueRes = await fetchApi('/api/mosques', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        savedMosqueId = savedMosqueRes?.id;
      }

      // If Fixed Pattern is active, save perpetual pattern items
      if (hasFixedPattern && savedMosqueId) {
        const itemsToSave = fridaySlots
          .filter((s) => s.imamId)
          .map((s) => ({
            fridayIndex: s.fridayIndex,
            imamId: Number(s.imamId),
            notes: s.notes || null,
          }));

        const patternSaveRes: any = await fetchApi(`/api/mosques/${savedMosqueId}/fixed-patterns`, {
          method: 'POST',
          body: JSON.stringify({
            patternType: isAllSame ? 'SAME_ALL' : 'SPECIFIC_FRIDAYS',
            fridaysCount: 5,
            items: itemsToSave,
          }),
        });

        if (patternSaveRes?.patternId) {
          setExistingPatternId(patternSaveRes.patternId);
        }
      } else if (!hasFixedPattern && savedMosqueId) {
        try {
          await fetchApi(`/api/mosques/${savedMosqueId}/fixed-patterns`, {
            method: 'DELETE',
          });
        } catch {
          // ignore
        }
      }

      const selectedFixedImam = hasFixedPattern && singleImamId
        ? imams.find((i) => i.id === Number(singleImamId))
        : null;

      const fullSavedMosque: Mosque = {
        ...(mosque || {}),
        ...savedMosqueRes,
        id: savedMosqueId || Date.now(),
        name,
        code,
        region: region || 'منشأة البكاري',
        address: formattedAddress || address,
        fixedImamId: isAllSame ? Number(singleImamId) : null,
        fixedImamName: selectedFixedImam ? selectedFixedImam.name : null,
        fixedPattern: hasFixedPattern ? (isAllSame ? 'ALL' : 'SPECIFIC_FRIDAYS') : 'NONE',
        fixedCount: assignedCount,
        preferencesCount: rules.filter((r) => r.relationshipType === 'PREFERRED').length,
        forbiddenCount: rules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED').length,
      };

      onSaved(fullSavedMosque);
      setFeedback('تم حفظ بيانات المسجد ونمط التثبيت بنجاح ✓');
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Mosque save error:', err);
      setErrorMessage(err.message || 'تعذر حفظ بيانات المسجد');
    } finally {
      setSaving(false);
    }
  };

  // Delete Pattern Handler (Clears fixed pattern completely)
  const handleDeleteFixedPattern = async () => {
    if (!mosque) return;
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء نمط التثبيت لهذا المسجد نهائياً وجعل كافة الجمعات مرنة؟')) {
      return;
    }
    setErrorMessage(null);
    try {
      await fetchApi(`/api/mosques/${mosque.id}/fixed-patterns`, {
        method: 'DELETE',
      });
      setHasFixedPattern(false);
      setExistingPatternId(null);
      setSingleImamId('');
      setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: '' })));
      setFeedback('تم إلغاء نمط التثبيت للمسجد بنجاح وتفريغ كافة الجمعات');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حذف نمط التثبيت');
    }
  };

  // Preference Handlers
  const preferredRules = rules.filter((r) => r.relationshipType === 'PREFERRED').sort((a, b) => a.priority - b.priority);
  const restrictionRules = rules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED');

  const handleAddRule = async (type: RelationshipType) => {
    const targetImamId = type === 'PREFERRED' ? selectedPreferredImam : selectedForbiddenImam;
    if (!mosque || !targetImamId) return;
    setErrorMessage(null);
    try {
      const highestPriority = preferredRules.length > 0 ? Math.max(...preferredRules.map((r) => r.priority)) + 1 : 1;
      const savedRule = await fetchApi<MosqueImamRule>(`/api/mosques/${mosque.id}/rules`, {
        method: 'POST',
        body: JSON.stringify({
          imamId: targetImamId,
          relationshipType: type,
          priority: type === 'PREFERRED' ? highestPriority : 1,
        }),
      });

      const targetImam = imams.find((i) => i.id === Number(targetImamId));
      const enrichedSavedRule: MosqueImamRule = {
        ...savedRule,
        imamId: Number(targetImamId),
        imam: targetImam,
      };

      // Optimistic update: preserve all other rules, replace or add this imam's rule
      const nextRules = [...rules.filter((r) => r.imamId !== Number(targetImamId)), enrichedSavedRule];
      setRules(nextRules);

      if (type === 'PREFERRED') {
        setSelectedPreferredImam('');
      } else {
        setSelectedForbiddenImam('');
      }

      // Optimistically update badge counts in table view
      const prefCount = nextRules.filter((r) => r.relationshipType === 'PREFERRED').length;
      const forbCount = nextRules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED').length;
      onSaved({
        ...mosque,
        preferencesCount: prefCount,
        forbiddenCount: forbCount,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إضافة القاعدة');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!mosque) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/mosques/${mosque.id}/rules/${ruleId}`, { method: 'DELETE' });
      const nextRules = rules.filter((r) => r.id !== ruleId);
      setRules(nextRules);

      // Optimistically update badge counts in table view
      const prefCount = nextRules.filter((r) => r.relationshipType === 'PREFERRED').length;
      const forbCount = nextRules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED').length;
      onSaved({
        ...mosque,
        preferencesCount: prefCount,
        forbiddenCount: forbCount,
      });
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
                      const checked = e.target.checked;
                      setHasFixedPattern(checked);
                      if (!checked) {
                        setSingleImamId('');
                        setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: '' })));
                      } else if (!singleImamId && mosque?.fixedImamId) {
                        const fId = Number(mosque.fixedImamId);
                        setSingleImamId(fId);
                        setFridaySlots([1, 2, 3, 4, 5].map((idx) => ({ fridayIndex: idx, imamId: fId })));
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
                {/* 1. Permanent System Banner & Rules Explainer */}
                <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-4 rounded-2xl shadow-sm space-y-2.5 border border-emerald-700/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300 shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold font-heading text-white flex items-center gap-2">
                          <span>نظام التثبيت الدائم والمستدام للمسجد (طوال العام وعلى مدار التاريخ)</span>
                        </h4>
                        <p className="text-[11px] text-emerald-200">
                          الخطيب المثبّت هنا يبقى ثابتاً إلى الأبد في كافة جداول الأشهر والأعوام القادمة حتى تقوم بتغييره يدوياً.
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 shrink-0 self-start sm:self-auto">
                      ✨ دائم ومستمر دائماً وأبداً
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-100 bg-black/25 p-3 rounded-xl border border-white/10 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                      <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>قواعد التوزيع ومنع التضارب بين المساجد:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5 text-[10px] text-slate-200 pr-1">
                      <li>
                        <strong>توزيع الجمعات الخمس:</strong> في الأشهر المكونة من <strong>4 جمعات</strong> سيتم تطبيق أول 4 جمعات تلقائياً دون أي إشكالية، وفي الأشهر ذات الـ <strong>5 جمعات</strong> تُطبّق كافة الجمعات الخمس.
                      </li>
                      <li>
                        <strong>منع التعارض الصارم:</strong> النظام يمنع تثبيت الخطيب في أكثر من مسجد لنفس الجمعة، ويسمح بتثبيته إذا كانت جمعة مختلفة.
                      </li>
                    </ul>
                  </div>
                </div>

                {/* 2. Mode Quick Setter: تثبيت نفس الخطيب للشهر كله (الـ 5 جمعات معاً) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 font-heading">
                        تثبيت خطيب واحد للشهر بالكامل (لكافة الجمعات الخمس معاً):
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">
                      اختيار سريع لملء الجمعات الخمس دفعة واحدة
                    </span>
                  </div>

                  <div>
                    <SearchablePreacherSelect
                      imams={imams}
                      value={singleImamId}
                      onChange={handleWholeMonthPreacherChange}
                      disabledImams={disabledImamsForAllFridays}
                      placeholder="-- اختر خطيباً لتثبيته في كافة جمعات الشهر الخمس بنقرة واحدة --"
                    />
                  </div>

                  {singleImamId && (
                    <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="text-[11px] font-bold">
                        تم تعيين فضيلة الشيخ ({imams.find((i) => i.id === Number(singleImamId))?.name}) في كافة الجمعات الخمس أدناه. يمكنك تخصيص أي جمعة بشكل منفصل أدناه إن أردت.
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. The 5 Friday Slots Cards (دائماً 5 جمعات) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-bold text-slate-800">
                      تحديد وتوزيع الخطباء على الجمعات الخمس (تخصيص مستقل لكل جمعة):
                    </span>
                    <span className="text-[11px] text-slate-500">
                      يمكن ترك أي جمعة فارغة للتوزيع التلقائي المرن
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5].map((idx) => {
                      const slot = fridaySlots.find((s) => s.fridayIndex === idx);
                      const assignedImamId = slot?.imamId || '';
                      const disabledForThisFriday = getDisabledImamsForFriday(idx);
                      const fridayLabels: Record<number, string> = {
                        1: 'الأولى',
                        2: 'الثانية',
                        3: 'الثالثة',
                        4: 'الرابعة',
                        5: 'الخامسة',
                      };

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border shadow-2xs space-y-2.5 transition-all ${
                            idx === 5
                              ? 'bg-amber-50/30 border-amber-200/90 hover:border-amber-400'
                              : 'bg-white border-slate-200 hover:border-emerald-500/60'
                          }`}
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center ${
                                  idx === 5
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {idx}
                              </span>
                              <span className="text-xs font-bold text-slate-900 font-heading">
                                الجمعة {fridayLabels[idx]}
                              </span>
                            </div>
                            {idx === 5 ? (
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                أشهر الـ 5 جمعات
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                دائمة لكل الشهور
                              </span>
                            )}
                          </div>

                          {idx === 5 && (
                            <p className="text-[10px] text-amber-900/80 leading-relaxed bg-amber-50/80 p-1.5 rounded border border-amber-200/60">
                              ℹ️ تُطبّق في الأشهر التي تضم 5 جمعات، وفي الأشهر ذات الـ 4 جمعات يتم تجاوزها تلقائياً.
                            </p>
                          )}

                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              الخطيب المكلف *
                            </label>
                            <SearchablePreacherSelect
                              imams={imams}
                              value={assignedImamId}
                              onChange={(val) => handleFridaySlotChange(idx, val)}
                              disabledImams={disabledForThisFriday}
                              placeholder="-- متروك للتوزيع التلقائي المرن --"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Action Buttons & Delete */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 border-t border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    ✓ يتم حفظ هذا النمط كقيد صارم دائم (Hard Constraint) غير قابل للتغيير أثناء التوليد التلقائي لكافة الشهور.
                  </span>

                  {(existingPatternId || fridaySlots.some((s) => Boolean(s.imamId))) && (
                    <button
                      type="button"
                      onClick={handleDeleteFixedPattern}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء نمط التثبيت لهذا المسجد</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                    imams={imams.filter((i) => !preferredRules.some((r) => r.imamId === i.id))}
                    value={selectedPreferredImam}
                    onChange={(val) => setSelectedPreferredImam(val)}
                    placeholder="-- ابحث عن خطيب لإضافته للمفضلة --"
                  />
                </div>
                <button
                  type="button"
                  disabled={!selectedPreferredImam}
                  onClick={() => handleAddRule('PREFERRED')}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة للمفضلة</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-heading">قواعد الاستبعاد والحظر</h4>
                <p className="text-xs text-slate-500">
                  منع خطيب معين من الخطابة في هذا المسجد مطلقاً (قيد صارم Hard Constraint).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-72">
                  <SearchablePreacherSelect
                    imams={imams.filter((i) => !restrictionRules.some((r) => r.imamId === i.id))}
                    value={selectedForbiddenImam}
                    onChange={(val) => setSelectedForbiddenImam(val)}
                    placeholder="-- ابحث عن خطيب لإضافته للحظر --"
                  />
                </div>
                <button
                  type="button"
                  disabled={!selectedForbiddenImam}
                  onClick={() => handleAddRule('FORBIDDEN')}
                  className="px-3 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer shrink-0"
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

        {/* Sticky Modal Footer */}
        <div className="sticky bottom-0 -mx-3.5 sm:-mx-6 -mb-3.5 sm:-mb-6 p-3 sm:p-4 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between z-20 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
          >
            إلغاء وإغلاق
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
