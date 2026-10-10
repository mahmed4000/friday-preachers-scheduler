import React, { useState, useEffect } from 'react';
import { Imam, ImamAvailability, Mosque, MosqueImamRule, RelationshipType } from '../../types/index.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Users2,
  Sliders,
  CalendarX2,
  Building2,
  Save,
  CheckCircle2,
  Plus,
  Trash2,
  AlertTriangle,
  CalendarDays,
  Shuffle,
  Sparkles,
  Check,
  Lock,
  ArrowRightLeft,
  Info,
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { EgyptianAddressSelector, EgyptianAddressValue } from '../common/EgyptianAddressSelector.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';

export interface FridayAssignmentState {
  fridayIndex: number;
  status: 'FIXED' | 'FLEXIBLE' | 'UNAVAILABLE';
  mosqueId: number | null;
  mosqueName?: string | null;
  mosqueCode?: string | null;
  reason?: string;
}

export type ImamAssignmentMode = 'FULL_FIXED' | 'CUSTOM_FRIDAYS' | 'FLEXIBLE';

interface ImamProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  imam: Imam | null;
  mosques?: Mosque[];
  onSaved: (updatedImam?: Imam) => void;
}

export function ImamProfileModal({
  isOpen,
  onClose,
  imam,
  mosques = [],
  onSaved,
}: ImamProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'limits' | 'availability' | 'mosques'>('info');

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
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
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  // Limits
  const [type, setType] = useState<'FIXED' | 'PARTIAL_FIXED' | 'FLEXIBLE'>('FLEXIBLE');
  const [minFridays, setMinFridays] = useState<number>(1);
  const [targetFridays, setTargetFridays] = useState<number>(4);
  const [maxFridays, setMaxFridays] = useState<number>(5);

  // Mosque Linkage & Rules State
  const [fixedMosqueId, setFixedMosqueId] = useState<number | ''>('');
  const [rules, setRules] = useState<MosqueImamRule[]>([]);
  const [selectedPreferredMosque, setSelectedPreferredMosque] = useState<number | ''>('');
  const [selectedForbiddenMosque, setSelectedForbiddenMosque] = useState<number | ''>('');

  // Unified Friday Mosque Assignment State
  const [assignmentMode, setAssignmentMode] = useState<ImamAssignmentMode>('FLEXIBLE');
  const [fridayAssignments, setFridayAssignments] = useState<FridayAssignmentState[]>([
    { fridayIndex: 1, status: 'FLEXIBLE', mosqueId: null },
    { fridayIndex: 2, status: 'FLEXIBLE', mosqueId: null },
    { fridayIndex: 3, status: 'FLEXIBLE', mosqueId: null },
    { fridayIndex: 4, status: 'FLEXIBLE', mosqueId: null },
    { fridayIndex: 5, status: 'FLEXIBLE', mosqueId: null },
  ]);
  const [occupiedSlots, setOccupiedSlots] = useState<Record<number, Array<{ mosqueId: number; mosqueName: string; imamId: number; imamName: string }>>>({
    1: [], 2: [], 3: [], 4: [], 5: []
  });

  // Availabilities
  const [availabilities, setAvailabilities] = useState<ImamAvailability[]>([]);
  const [allowedFridays, setAllowedFridays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New availability exception form
  const [newFridayIndex, setNewFridayIndex] = useState<number>(1);
  const [newReason, setNewReason] = useState<string>('ارتباط مسبق / سفر');

  const handleFridayStatusChange = (fridayIndex: number, newStatus: 'FIXED' | 'FLEXIBLE' | 'UNAVAILABLE') => {
    setFridayAssignments((prev) =>
      prev.map((fa) => {
        if (fa.fridayIndex !== fridayIndex) return fa;
        let newMosqueId = fa.mosqueId;
        if (newStatus === 'FIXED' && !newMosqueId && mosques.length > 0) {
          newMosqueId = mosques[0].id;
        } else if (newStatus !== 'FIXED') {
          newMosqueId = null;
        }
        return {
          ...fa,
          status: newStatus,
          mosqueId: newMosqueId,
        };
      })
    );
  };

  const handleFridayMosqueChange = (fridayIndex: number, mosqueId: number) => {
    setFridayAssignments((prev) =>
      prev.map((fa) => (fa.fridayIndex === fridayIndex ? { ...fa, status: 'FIXED', mosqueId } : fa))
    );
  };

  const applyPreset = (preset: 'all_flexible' | 'only_1_3' | 'only_2_4' | 'only_first') => {
    if (preset === 'all_flexible') {
      setFridayAssignments([1, 2, 3, 4, 5].map((idx) => ({
        fridayIndex: idx,
        status: 'FLEXIBLE',
        mosqueId: null,
      })));
    } else if (preset === 'only_1_3') {
      setFridayAssignments((prev) =>
        [1, 2, 3, 4, 5].map((idx) => {
          const existing = prev.find((fa) => fa.fridayIndex === idx);
          if (idx === 1 || idx === 3) {
            return {
              fridayIndex: idx,
              status: existing?.status === 'FIXED' && existing.mosqueId ? 'FIXED' : 'FLEXIBLE',
              mosqueId: existing?.status === 'FIXED' ? existing.mosqueId : null,
            };
          } else {
            return {
              fridayIndex: idx,
              status: 'UNAVAILABLE',
              mosqueId: null,
              reason: 'حصر التكليف في الجمعتين 1 و 3',
            };
          }
        })
      );
    } else if (preset === 'only_2_4') {
      setFridayAssignments((prev) =>
        [1, 2, 3, 4, 5].map((idx) => {
          const existing = prev.find((fa) => fa.fridayIndex === idx);
          if (idx === 2 || idx === 4) {
            return {
              fridayIndex: idx,
              status: existing?.status === 'FIXED' && existing.mosqueId ? 'FIXED' : 'FLEXIBLE',
              mosqueId: existing?.status === 'FIXED' ? existing.mosqueId : null,
            };
          } else {
            return {
              fridayIndex: idx,
              status: 'UNAVAILABLE',
              mosqueId: null,
              reason: 'حصر التكليف في الجمعتين 2 و 4',
            };
          }
        })
      );
    } else if (preset === 'only_first') {
      setFridayAssignments((prev) =>
        [1, 2, 3, 4, 5].map((idx) => {
          const existing = prev.find((fa) => fa.fridayIndex === idx);
          if (idx === 1) {
            return {
              fridayIndex: idx,
              status: existing?.status === 'FIXED' && existing.mosqueId ? 'FIXED' : 'FLEXIBLE',
              mosqueId: existing?.status === 'FIXED' ? existing.mosqueId : null,
            };
          } else {
            return {
              fridayIndex: idx,
              status: 'UNAVAILABLE',
              mosqueId: null,
              reason: 'حصر التكليف في الجمعة الأولى فقط',
            };
          }
        })
      );
    }
  };

  useEffect(() => {
    if (imam) {
      setName(imam.name);
      setPhone(imam.phone || '');
      setWhatsapp(imam.whatsapp || '');
      setRegion(imam.region || 'منشأة البكاري');
      setAddress(imam.formattedAddress || imam.address || '');
      setCountryId(imam.countryId || 1);
      setGovernorateId(imam.governorateId || 1);
      setDistrictId(imam.districtId !== undefined && imam.districtId !== null ? imam.districtId : 101);
      setAreaId(imam.areaId !== undefined && imam.areaId !== null ? imam.areaId : 1001);
      setStreet(imam.street || '');
      setBuildingNumber(imam.buildingNumber || '');
      setLandmark(imam.landmark || '');
      setFormattedAddress(imam.formattedAddress || imam.address || '');
      setLatitude(imam.latitude ? String(imam.latitude) : '');
      setLongitude(imam.longitude ? String(imam.longitude) : '');

      setIsActive(imam.isActive);
      setNotes(imam.notes || '');

      setType(imam.type);
      setMinFridays(imam.minFridays);
      setTargetFridays(imam.targetFridays);
      setMaxFridays(imam.maxFridays);

      setFixedMosqueId(imam.fixedMosqueId ? Number(imam.fixedMosqueId) : '');
      setSelectedPreferredMosque('');
      setSelectedForbiddenMosque('');

      fetchApi<any>(`/api/imams/${imam.id}`)
        .then((res) => {
          if (res.type) {
            setType(res.type);
          }
          if (res.minFridays !== undefined) setMinFridays(res.minFridays);
          if (res.targetFridays !== undefined) setTargetFridays(res.targetFridays);
          if (res.maxFridays !== undefined) setMaxFridays(res.maxFridays);
          if (res.availabilities) {
            setAvailabilities(res.availabilities);
            const unavailSet = new Set(
              res.availabilities.filter((a: any) => !a.isAvailable).map((a: any) => a.fridayIndex)
            );
            setAllowedFridays([1, 2, 3, 4, 5].filter((idx) => !unavailSet.has(idx)));
          }
          if (res.rules) setRules(res.rules);
          if (res.fixedMosqueId !== undefined) {
            setFixedMosqueId(res.fixedMosqueId ? Number(res.fixedMosqueId) : '');
          }

          if (res.occupiedSlots) {
            setOccupiedSlots(res.occupiedSlots);
          }

          if (res.fridayAssignments && Array.isArray(res.fridayAssignments) && res.fridayAssignments.length > 0) {
            setFridayAssignments(res.fridayAssignments);
            const fixedItems = res.fridayAssignments.filter((f: any) => f.status === 'FIXED' && f.mosqueId);
            const unavailItems = res.fridayAssignments.filter((f: any) => f.status === 'UNAVAILABLE');
            const uniqueMosqueIds = Array.from(new Set(fixedItems.map((f: any) => f.mosqueId)));

            if (fixedItems.length === 5 && uniqueMosqueIds.length === 1) {
              setAssignmentMode('FULL_FIXED');
              setFixedMosqueId(Number(uniqueMosqueIds[0]));
            } else if (fixedItems.length > 0 || unavailItems.length > 0) {
              setAssignmentMode('CUSTOM_FRIDAYS');
            } else if (res.type === 'FIXED' && res.fixedMosqueId) {
              setAssignmentMode('FULL_FIXED');
            } else {
              setAssignmentMode('FLEXIBLE');
            }
          } else if (res.type === 'FIXED' && res.fixedMosqueId) {
            setAssignmentMode('FULL_FIXED');
            const mId = Number(res.fixedMosqueId);
            setFridayAssignments([1, 2, 3, 4, 5].map((idx) => ({
              fridayIndex: idx,
              status: 'FIXED',
              mosqueId: mId,
            })));
          } else {
            setAssignmentMode('FLEXIBLE');
            setFridayAssignments([1, 2, 3, 4, 5].map((idx) => ({
              fridayIndex: idx,
              status: 'FLEXIBLE',
              mosqueId: null,
            })));
          }
        })
        .catch(() => {});
    } else {
      setName('');
      setPhone('');
      setWhatsapp('');
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

      setIsActive(true);
      setNotes('');
      setType('FLEXIBLE');
      setMinFridays(1);
      setTargetFridays(4);
      setMaxFridays(5);
      setAvailabilities([]);
      setAllowedFridays([1, 2, 3, 4, 5]);
      setFixedMosqueId('');
      setRules([]);
      setSelectedPreferredMosque('');
      setSelectedForbiddenMosque('');

      setAssignmentMode('FLEXIBLE');
      setFridayAssignments([1, 2, 3, 4, 5].map((idx) => ({
        fridayIndex: idx,
        status: 'FLEXIBLE',
        mosqueId: null,
      })));
      setOccupiedSlots({ 1: [], 2: [], 3: [], 4: [], 5: [] });
    }
    setActiveTab('info');
    setFeedback(null);
    setErrorMessage(null);
  }, [imam, isOpen]);

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

  // Preference and restriction rules handlers
  const preferredRules = rules.filter((r) => r.relationshipType === 'PREFERRED').sort((a, b) => a.priority - b.priority);
  const restrictionRules = rules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED');

  const handleAddRule = async (relType: RelationshipType) => {
    const targetMosqueId = relType === 'PREFERRED' ? selectedPreferredMosque : selectedForbiddenMosque;
    if (!imam || !targetMosqueId) return;
    setErrorMessage(null);
    try {
      const highestPriority = preferredRules.length > 0 ? Math.max(...preferredRules.map((r) => r.priority)) + 1 : 1;
      const savedRule = await fetchApi<MosqueImamRule>(`/api/imams/${imam.id}/rules`, {
        method: 'POST',
        body: JSON.stringify({
          mosqueId: Number(targetMosqueId),
          relationshipType: relType,
          priority: relType === 'PREFERRED' ? highestPriority : 1,
        }),
      });

      const targetMosque = (mosques || []).find((m) => m.id === Number(targetMosqueId));
      const enrichedSavedRule: MosqueImamRule = {
        ...savedRule,
        mosqueId: Number(targetMosqueId),
        mosque: targetMosque,
      };

      const nextRules = [...rules.filter((r) => r.mosqueId !== Number(targetMosqueId)), enrichedSavedRule];
      setRules(nextRules);

      if (relType === 'PREFERRED') {
        setSelectedPreferredMosque('');
      } else {
        setSelectedForbiddenMosque('');
      }
      setFeedback('تم حفظ قاعدة الارتباط بالمسجد بنجاح ✓');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إضافة القاعدة');
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!imam) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/imams/${imam.id}/rules/${ruleId}`, { method: 'DELETE' });
      const nextRules = rules.filter((r) => r.id !== ruleId);
      setRules(nextRules);
      setFeedback('تم حذف القاعدة بنجاح ✓');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر حذف القاعدة');
    }
  };

  const handleSave = async () => {
    setErrorMessage(null);
    if (!name) {
      setErrorMessage('اسم الخطيب مطلوب');
      return;
    }
    // Auto-normalize min <= target <= max so save never fails when user reduces max
    let normalizedMin = Number(minFridays);
    let normalizedTarget = Number(targetFridays);
    let normalizedMax = Math.max(1, Number(maxFridays));

    if (normalizedTarget > normalizedMax) normalizedTarget = normalizedMax;
    if (normalizedMin > normalizedTarget) normalizedMin = normalizedTarget;
    if (normalizedMin < 0) normalizedMin = 0;

    setMinFridays(normalizedMin);
    setTargetFridays(normalizedTarget);
    setMaxFridays(normalizedMax);

    setSaving(true);
    setFeedback(null);
    setErrorMessage(null);

    try {
      let finalFridayAssignments: FridayAssignmentState[] = [];
      let finalAllowedFridays = [...allowedFridays];
      let finalType = type;
      let finalFixedMosqueId = fixedMosqueId ? Number(fixedMosqueId) : null;

      if (assignmentMode === 'FULL_FIXED') {
        if (finalFixedMosqueId) {
          finalType = 'FIXED';
          finalFridayAssignments = [1, 2, 3, 4, 5].map((idx) => ({
            fridayIndex: idx,
            status: 'FIXED',
            mosqueId: finalFixedMosqueId,
          }));
          finalAllowedFridays = [1, 2, 3, 4, 5];
        } else {
          finalType = 'FLEXIBLE';
          finalFixedMosqueId = null;
          finalFridayAssignments = [1, 2, 3, 4, 5].map((idx) => ({
            fridayIndex: idx,
            status: 'FLEXIBLE',
            mosqueId: null,
          }));
        }
      } else if (assignmentMode === 'CUSTOM_FRIDAYS') {
        finalFridayAssignments = fridayAssignments.map((fa) => ({
          fridayIndex: fa.fridayIndex,
          status: fa.status,
          mosqueId: fa.status === 'FIXED' ? fa.mosqueId : null,
          reason: fa.status === 'UNAVAILABLE' ? (fa.reason || 'اعتذار رسمي / غير متاح') : undefined,
        }));

        const fixedCount = finalFridayAssignments.filter((f) => f.status === 'FIXED' && f.mosqueId).length;
        const uniqueFixedMosques = Array.from(new Set(finalFridayAssignments.filter((f) => f.status === 'FIXED' && f.mosqueId).map((f) => f.mosqueId)));

        if (fixedCount === 5 && uniqueFixedMosques.length === 1) {
          finalType = 'FIXED';
          finalFixedMosqueId = uniqueFixedMosques[0];
        } else if (fixedCount > 0) {
          finalType = 'PARTIAL_FIXED';
          finalFixedMosqueId = null;
        } else {
          finalType = 'FLEXIBLE';
          finalFixedMosqueId = null;
        }

        finalAllowedFridays = finalFridayAssignments
          .filter((fa) => fa.status !== 'UNAVAILABLE')
          .map((fa) => fa.fridayIndex);
      } else {
        // FLEXIBLE
        finalType = 'FLEXIBLE';
        finalFixedMosqueId = null;
        finalFridayAssignments = [1, 2, 3, 4, 5].map((idx) => ({
          fridayIndex: idx,
          status: 'FLEXIBLE',
          mosqueId: null,
        }));
      }

      const payload = {
        name,
        phone,
        whatsapp,
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
        isActive,
        notes,
        type: finalType,
        fixedMosqueId: finalFixedMosqueId,
        minFridays: Number(minFridays),
        targetFridays: Number(targetFridays),
        maxFridays: Number(maxFridays),
        allowedFridays: finalAllowedFridays,
        fridayAssignments: finalFridayAssignments,
      };

      let savedResponse: any;
      if (imam) {
        savedResponse = await fetchApi(`/api/imams/${imam.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        savedResponse = await fetchApi('/api/imams', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      const selectedMosque = finalFixedMosqueId ? (mosques || []).find((m) => m.id === finalFixedMosqueId) : null;
      const confirmedImam: Imam = {
        ...(imam || {}),
        ...savedResponse,
        id: savedResponse?.id || imam?.id || Date.now(),
        name,
        phone,
        whatsapp,
        region: region || 'منشأة البكاري',
        address: formattedAddress || address,
        formattedAddress: formattedAddress || address,
        countryId,
        governorateId,
        districtId,
        areaId,
        street,
        buildingNumber,
        landmark,
        latitude,
        longitude,
        isActive,
        notes,
        type: finalType,
        fixedMosqueId: finalFixedMosqueId,
        fixedMosqueName: selectedMosque?.name || (finalType === 'FIXED' ? savedResponse?.fixedMosqueName : null),
        fixedMosqueCode: selectedMosque?.code || (finalType === 'FIXED' ? savedResponse?.fixedMosqueCode : null),
        preferencesCount: rules.filter((r) => r.relationshipType === 'PREFERRED').length,
        forbiddenCount: rules.filter((r) => r.relationshipType === 'FORBIDDEN' || r.relationshipType === 'DISCOURAGED').length,
        linkedMosquesCount: rules.length,
        minFridays: Number(minFridays),
        targetFridays: Number(targetFridays),
        maxFridays: Number(maxFridays),
      };

      // Confirmed server success: notify parent view and display success feedback
      onSaved(confirmedImam);
      setFeedback('تم حفظ بيانات الخطيب وحدود التوزيع والجمعات بنجاح ✓');

      setTimeout(() => {
        onClose();
      }, 400);
    } catch (err: any) {
      console.error('Imam save error:', err);
      setErrorMessage(err.message || 'تعذر حفظ بيانات الخطيب في الخادم');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnavailable = async () => {
    if (!imam) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/imams/${imam.id}/availabilities`, {
        method: 'POST',
        body: JSON.stringify({
          hijriYear: 0,
          hijriMonth: 0,
          fridayIndex: newFridayIndex,
          isAvailable: false,
          reason: newReason.trim() || 'اعتذار رسمي',
        }),
      });

      setNewReason('');
      const res = await fetchApi<any>(`/api/imams/${imam.id}`);
      if (res.availabilities) {
        setAvailabilities(res.availabilities);
        const unavailSet = new Set(
          res.availabilities.filter((a: any) => !a.isAvailable).map((a: any) => a.fridayIndex)
        );
        setAllowedFridays([1, 2, 3, 4, 5].filter((idx) => !unavailSet.has(idx)));
      }
      setFeedback('تم تسجيل استثناء عدم التوفر للجمعة المحددة بنجاح ✓');
      setTimeout(() => setFeedback(null), 3000);
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تسجيل الاستثناء');
    }
  };

  const handleDeleteUnavailable = async (availId: number) => {
    if (!imam) return;
    setErrorMessage(null);
    try {
      await fetchApi(`/api/imams/${imam.id}/availabilities/${availId}`, {
        method: 'DELETE',
      });
      const res = await fetchApi<any>(`/api/imams/${imam.id}`);
      if (res.availabilities) {
        setAvailabilities(res.availabilities);
        const unavailSet = new Set(
          res.availabilities.filter((a: any) => !a.isAvailable).map((a: any) => a.fridayIndex)
        );
        setAllowedFridays([1, 2, 3, 4, 5].filter((idx) => !unavailSet.has(idx)));
      }
      setFeedback('تم إلغاء الاعتذار واستعادة توفر الخطيب للجمعة بنجاح ✓');
      setTimeout(() => setFeedback(null), 3000);
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر إلغاء الاستثناء');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imam ? `ملف الخطيب: ${imam.name}` : 'إضافة خطيب جديد'}
      subtitle={imam ? `نوع التعيين: ${type === 'FIXED' ? 'ثابت' : type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن'} · المنطقة: ${region || 'غير محددة'}` : 'تسجيل خطيب جديد في قاعدة البيانات'}
      maxWidth="3xl"
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
            <Users2 className="w-3.5 h-3.5" />
            <span>المعلومات والتواصل</span>
          </button>

          <button
            onClick={() => setActiveTab('limits')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'limits'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>
              حدود التوزيع والأحمال
              {allowedFridays.length < 5 ? ` (${allowedFridays.length}/5)` : ''}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mosques')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === 'mosques'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              المساجد وتكليف الجمعات
              {assignmentMode === 'FULL_FIXED' && fixedMosqueId
                ? ' (راتب كامل)'
                : assignmentMode === 'CUSTOM_FRIDAYS'
                ? ` (${fridayAssignments.filter((f) => f.status === 'FIXED').length} مخصص)`
                : rules.length > 0
                ? ` (${rules.length} قواعد)`
                : ''}
            </span>
          </button>

          {imam && (
            <button
              onClick={() => setActiveTab('availability')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'availability'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <CalendarX2 className="w-3.5 h-3.5 text-rose-500" />
              <span>عدم التوفر ({availabilities.length})</span>
            </button>
          )}
        </div>

        {/* Tab 1: Info */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">اسم فضيلة الشيخ *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: الشيخ د. عبد الله بن محمد المنشاوي"
                  className="w-full text-xs font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">المنطقة السكنية / المفضلة للتوزيع</label>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="مثال: العمرانية الغربية، منشأة البكاري..."
                  className="w-full text-xs font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white placeholder:text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="مثال: 01012345678 (اختياري)"
                  className="w-full text-xs font-mono font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white placeholder:text-slate-400 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">رقم الواتساب الرسمي لإرسال الجداول</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="مثال: 01012345678 (اختياري)"
                  className="w-full text-xs font-mono font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white placeholder:text-slate-400 text-right"
                />
              </div>
            </div>

            {/* Egyptian Hierarchical Address Selector */}
            <div className="pt-2">
              <EgyptianAddressSelector
                title="عنوان وموقع إقامة فضيلة الشيخ (جمهورية مصر العربية)"
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
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300"
                />
                <span className="text-xs font-bold text-slate-800">الخطيب نشط وجاهز للخطابة</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">ملاحظات واختصاصات</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="التخصص الشرعي، الإجازات، أسلوب الخطابة..."
                className="w-full text-xs font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 bg-white placeholder:text-slate-400"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Limits */}
        {activeTab === 'limits' && (
          <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">نوع التعيين (Imam Classification)</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setType('FIXED')}
                  className={`p-3 rounded-lg border text-right transition-all cursor-pointer ${
                    type === 'FIXED'
                      ? 'bg-emerald-50/50 border-emerald-600 shadow-2xs text-slate-900 ring-2 ring-emerald-500/20'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold font-heading">ثابت (FIXED)</span>
                  <span className="text-[11px] text-slate-500">مخصص لجامع محدد بشكل دائم طوال الشهر</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('PARTIAL_FIXED');
                    setFixedMosqueId('');
                  }}
                  className={`p-3 rounded-lg border text-right transition-all cursor-pointer ${
                    type === 'PARTIAL_FIXED'
                      ? 'bg-amber-50/50 border-amber-600 shadow-2xs text-slate-900 ring-2 ring-amber-500/20'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold font-heading">ثابت جزئي (PARTIAL)</span>
                  <span className="text-[11px] text-slate-500">ثابت لعدد معين من الجمعات وباقي الشهر مرن</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('FLEXIBLE');
                    setFixedMosqueId('');
                  }}
                  className={`p-3 rounded-lg border text-right transition-all cursor-pointer ${
                    type === 'FLEXIBLE'
                      ? 'bg-sky-50/50 border-sky-600 shadow-2xs text-slate-900 ring-2 ring-sky-500/20'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold font-heading">مرن (FLEXIBLE)</span>
                  <span className="text-[11px] text-slate-500">يوزع حسب الاحتياج والتفضيلات وعدالة الأحمال</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">الحد الأدنى (Minimum)</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={minFridays}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(5, Number(e.target.value) || 0));
                    setMinFridays(val);
                    if (targetFridays < val) setTargetFridays(val);
                    if (maxFridays < val) setMaxFridays(val);
                  }}
                  className="w-full text-xs p-2.5 font-bold text-center border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="block text-[10px] text-slate-500 mt-1 text-center">أقل عدد جمعات مطلوب</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-800 mb-1">المستهدف (Target)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={targetFridays}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(5, Number(e.target.value) || 1));
                    setTargetFridays(val);
                    if (minFridays > val) setMinFridays(val);
                    if (maxFridays < val) setMaxFridays(val);
                  }}
                  className="w-full text-xs p-2.5 font-bold text-center border-2 border-emerald-500 rounded-lg bg-white text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
                <span className="block text-[10px] text-emerald-700 mt-1 text-center font-bold">الهدف الأساسي للمحرك</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">الحد الأقصى (Maximum)</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={maxFridays}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(5, Number(e.target.value) || 1));
                    setMaxFridays(val);
                    if (targetFridays > val) setTargetFridays(val);
                    if (minFridays > val) setMinFridays(val);
                  }}
                  className="w-full text-xs p-2.5 font-bold text-center border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="block text-[10px] text-slate-500 mt-1 text-center">قيد صارم لا يتجاوز دون استثناء</span>
              </div>
            </div>

            {/* Friday Selection / Restriction Section */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-800">
                    الجمعات المتاحة للتوزيع في الشهر (حصر التكليف)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    حدد الجمعات المسموحة للخطيب (مثلاً: حصر توزيع الخطيب في الجمعة 1 و 3 فقط)
                  </p>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAllowedFridays([1, 2, 3, 4, 5])}
                    className="text-[10px] font-bold px-2 py-1 bg-slate-200/70 hover:bg-slate-300 text-slate-700 rounded transition cursor-pointer"
                  >
                    تحديد الكل (1-5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFridays([1, 3])}
                    className="text-[10px] font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded transition cursor-pointer"
                  >
                    الجمعة 1 + 3
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFridays([2, 4])}
                    className="text-[10px] font-bold px-2 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-300 rounded transition cursor-pointer"
                  >
                    الجمعة 2 + 4
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFridays([1])}
                    className="text-[10px] font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded transition cursor-pointer"
                  >
                    الجمعة 1 فقط
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllowedFridays([2])}
                    className="text-[10px] font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded transition cursor-pointer"
                  >
                    الجمعة 2 فقط
                  </button>
                </div>
              </div>

              {/* 5 Friday Toggle Buttons */}
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((fridayIndex) => {
                  const isAllowed = allowedFridays.includes(fridayIndex);
                  return (
                    <button
                      key={fridayIndex}
                      type="button"
                      onClick={() => {
                        setAllowedFridays((prev) => {
                          if (prev.includes(fridayIndex)) {
                            return prev.filter((idx) => idx !== fridayIndex);
                          } else {
                            return [...prev, fridayIndex].sort((a, b) => a - b);
                          }
                        });
                      }}
                      className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        isAllowed
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500/30 hover:bg-emerald-100/70'
                          : 'bg-slate-100/80 border-slate-200 text-slate-400 hover:bg-slate-200/50'
                      }`}
                    >
                      <span className="text-xs font-black font-heading">
                        الجمعة {fridayIndex}
                      </span>
                      <span className="text-[10px] font-medium">
                        {fridayIndex === 1
                          ? 'الأولى'
                          : fridayIndex === 2
                          ? 'الثانية'
                          : fridayIndex === 3
                          ? 'الثالثة'
                          : fridayIndex === 4
                          ? 'الرابعة'
                          : 'الخامسة'}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 ${
                          isAllowed
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isAllowed ? '✓ متاح' : '✕ مستبعد'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Informative alerts */}
              {allowedFridays.length < 5 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <span className="text-sm font-bold text-amber-600">⚡</span>
                  <div>
                    <span className="font-bold">تنبيه حصر التوزيع: </span>
                    {allowedFridays.length > 0 ? (
                      <>
                        تم حصر تكليف الخطيب في{' '}
                        <strong className="text-emerald-800">
                          {allowedFridays.map((idx) => `الجمعة ${idx}`).join(' + ')}
                        </strong>{' '}
                        فقط ({allowedFridays.length} من 5). سيقوم النظام تلقائياً باستبعاده من الجمعات المستبعدة أثناء توزيع الجداول.
                      </>
                    ) : (
                      <span className="text-red-700 font-bold">
                        لم يتم اختيار أي جمعة! لن يتم تكليف الخطيب في أي جمعة.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {allowedFridays.length === 5 && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>الخطيب متاح في جميع جمعات الشهر (1 إلى 5) بدون استثناءات مسبقة.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Availability Exceptions */}
        {activeTab === 'availability' && imam && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
              <span className="font-bold text-slate-900">مبدأ التوفر:</span> الخطيب متاح افتراضياً في جميع جمعات الشهر، ويتم تسجيل استثناء فقط في حال اعتذاره عن جمعة محددة.
            </div>

            {/* Add unavailable entry */}
            <div className="p-3 border border-slate-200 rounded-xl bg-white space-y-3">
              <h4 className="text-xs font-bold text-slate-800">تسجيل اعتذار / عدم توفر في جمعة</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">رقم الجمعة</label>
                  <select
                    value={newFridayIndex}
                    onChange={(e) => setNewFridayIndex(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-slate-200 rounded bg-white"
                  >
                    <option value={1}>الجمعة الأولى (1)</option>
                    <option value={2}>الجمعة الثانية (2)</option>
                    <option value={3}>الجمعة الثالثة (3)</option>
                    <option value={4}>الجمعة الرابعة (4)</option>
                    <option value={5}>الجمعة الخامسة (5)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-500 mb-1">سبب الاعتذار</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newReason}
                      onChange={(e) => setNewReason(e.target.value)}
                      placeholder="سفر، إجازة سنوية، عذر طارئ..."
                      className="flex-1 text-xs p-2 border border-slate-200 rounded"
                    />
                    <button
                      type="button"
                      onClick={handleAddUnavailable}
                      className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>تسجيل الاعتذار</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* List of unavailable exceptions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">الجمعات المسجل بها عدم توفر:</h4>
              {availabilities.length === 0 ? (
                <div className="p-4 text-center bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-400">
                  الخطيب متاح في كافة الجمعات دون استثناءات.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white overflow-hidden">
                  {availabilities.map((a) => (
                    <div key={a.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                          الجمعة ({a.fridayIndex})
                        </span>
                        <span className="text-slate-600">غير متاح · السبب: {a.reason || 'اعتذار رسمي'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteUnavailable(a.id)}
                        className="px-2 py-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded flex items-center gap-1 transition-colors"
                        title="إلغاء الاعتذار واستعادة التوفر"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold">حذف</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Mosques & Relationship Rules */}
        {activeTab === 'mosques' && (
          <div className="space-y-5">
            {/* Top Unified Binding Header & Modes */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-4 rounded-xl shadow-xs border border-slate-700/80">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heading">
                      نظام الربط والتكليف الذكي (Smart Mosque Binding)
                    </h3>
                    <p className="text-[11px] text-slate-300">
                      تزامن ثنائي تلقائي يربط الخطيب بالمساجد وجدول التوزيع بضغطة زر واحدة
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30 font-bold">
                  تسمع تلقائياً في ملف المسجد والتوزيع
                </span>
              </div>

              {/* 3 Modes selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentMode('FULL_FIXED');
                    if (mosques.length > 0 && !fixedMosqueId) {
                      setFixedMosqueId(mosques[0].id);
                    }
                  }}
                  className={`p-3 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                    assignmentMode === 'FULL_FIXED'
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-md ring-2 ring-emerald-300/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-heading">1. خطيب راتب كامل</span>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] opacity-80">مسجد واحد دائم لجميع جمعات الشهر (1 إلى 5)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignmentMode('CUSTOM_FRIDAYS')}
                  className={`p-3 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                    assignmentMode === 'CUSTOM_FRIDAYS'
                      ? 'bg-sky-600 border-sky-400 text-white shadow-md ring-2 ring-sky-300/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-heading">2. تخصيص بالجمعات</span>
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] opacity-80">تحديد مسجد أو مرن أو معتذر لكل جمعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAssignmentMode('FLEXIBLE');
                    setFixedMosqueId('');
                  }}
                  className={`p-3 rounded-lg border text-right transition-all flex flex-col gap-1 cursor-pointer ${
                    assignmentMode === 'FLEXIBLE'
                      ? 'bg-purple-600 border-purple-400 text-white shadow-md ring-2 ring-purple-300/30'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-heading">3. خطيب مرن عام</span>
                    <Shuffle className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] opacity-80">متاح للتوزيع التلقائي دون مساجد ثابتة</span>
                </button>
              </div>
            </div>

            {/* Mode 1: Full Fixed Mosque */}
            {assignmentMode === 'FULL_FIXED' && (
              <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 font-heading">
                      تعيين المسجد الراتب الدائم (تثبيت كامل 100%)
                    </h4>
                    <p className="text-[11px] text-emerald-800">
                      سيتم تثبيت الشيخ رسمياً في هذا المسجد لكافة جمعات الشهر، وتعيينه كخطيب راتب في ملف المسجد مباشرة.
                    </p>
                  </div>
                  {fixedMosqueId ? (
                    <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] shadow-xs">
                      خطيب راتب مثبت ✓
                    </span>
                  ) : null}
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    اختر المسجد الراتب المرتبط بالخطيب:
                  </label>
                  <select
                    value={fixedMosqueId}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : '';
                      setFixedMosqueId(val);
                    }}
                    className="w-full text-xs font-semibold text-slate-900 p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  >
                    <option value="">اختر مسجداً لتثبيت الخطيب به...</option>
                    {mosques.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code}) — {m.region || 'المنطقة غير محددة'}
                        {m.fixedImamId && m.fixedImamId !== imam?.id ? ` [مرتبط حالياً بـ: ${m.fixedImamName || 'خطيب آخر'}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {fixedMosqueId ? (() => {
                  const selectedM = mosques.find((m) => m.id === Number(fixedMosqueId));
                  if (!selectedM) return null;
                  const hasOtherImam = selectedM.fixedImamId && selectedM.fixedImamId !== imam?.id;
                  return (
                    <div className="p-3 bg-white border border-emerald-200 rounded-lg space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 font-heading text-sm">
                          {selectedM.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          كود: {selectedM.code}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <strong>المنطقة:</strong> {selectedM.region || 'منشأة البكاري'}
                        </div>
                        <div>
                          <strong>العنوان:</strong> {selectedM.formattedAddress || selectedM.address || '—'}
                        </div>
                        {selectedM.managerName && (
                          <div>
                            <strong>مشرف المسجد:</strong> {selectedM.managerName}
                          </div>
                        )}
                        {selectedM.phone && (
                          <div>
                            <strong>هاتف التواصل:</strong> {selectedM.phone}
                          </div>
                        )}
                      </div>

                      {hasOtherImam && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            <strong>تنبيه:</strong> هذا المسجد مسجل حالياً لـ ({selectedM.fixedImamName}). عند الحفظ سيتم نقله رسمياً لفضيلة الشيخ الحالي.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })() : null}
              </div>
            )}

            {/* Mode 2: Custom Fridays Assignments Grid */}
            {assignmentMode === 'CUSTOM_FRIDAYS' && (
              <div className="space-y-3 p-4 bg-sky-50/40 border border-sky-200 rounded-xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-sky-950 font-heading">
                      تخصيص الجمعات الخمس للخطيب (جمعة بجمعة)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      يمكنك تثبيت الشيخ في مسجد محدد بجمعة معينة، أو جعله مرناً للتوزيع التلقائي، أو استبعاده كمعتذر
                    </p>
                  </div>
                </div>

                {/* Presets Bar */}
                <div className="p-2.5 bg-white border border-sky-100 rounded-lg flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    توزيع سريع:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyPreset('all_flexible')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    🔄 تفريغ كمرن للكل
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('only_1_3')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                  >
                    ⚡ حصر 1 و 3 (واعتذار الباقي)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('only_2_4')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-md transition-colors cursor-pointer"
                  >
                    ⚡ حصر 2 و 4 (واعتذار الباقي)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('only_first')}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-md transition-colors cursor-pointer"
                  >
                    ⚡ الأولى فقط
                  </button>
                </div>

                {/* 5 Friday Interactive Cards */}
                <div className="space-y-2.5 pt-1">
                  {[1, 2, 3, 4, 5].map((fIndex) => {
                    const assignment = fridayAssignments.find((fa) => fa.fridayIndex === fIndex) || {
                      fridayIndex: fIndex,
                      status: 'FLEXIBLE',
                      mosqueId: null,
                    };
                    const isFixed = assignment.status === 'FIXED';
                    const isFlexible = assignment.status === 'FLEXIBLE';
                    const isUnavailable = assignment.status === 'UNAVAILABLE';

                    const selectedMosque = isFixed && assignment.mosqueId
                      ? mosques.find((m) => m.id === assignment.mosqueId)
                      : null;

                    // Check conflict in occupied slots
                    const occupiedByOther = isFixed && assignment.mosqueId
                      ? (occupiedSlots[fIndex] || []).find((occ) => occ.mosqueId === assignment.mosqueId)
                      : null;

                    const fridayLabel =
                      fIndex === 1
                        ? 'الجمعة الأولى'
                        : fIndex === 2
                        ? 'الجمعة الثانية'
                        : fIndex === 3
                        ? 'الجمعة الثالثة'
                        : fIndex === 4
                        ? 'الجمعة الرابعة'
                        : 'الجمعة الخامسة';

                    return (
                      <div
                        key={fIndex}
                        className={`p-3 rounded-xl border transition-all ${
                          isFixed
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                            : isUnavailable
                            ? 'bg-rose-50/60 border-rose-200 shadow-2xs'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isFixed
                                  ? 'bg-emerald-700 text-white'
                                  : isUnavailable
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-sky-700 text-white'
                              }`}
                            >
                              {fIndex}
                            </span>
                            <span className="text-xs font-bold font-heading text-slate-900">
                              {fridayLabel}
                            </span>
                          </div>

                          {/* 3 Status Toggle Buttons */}
                          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                            <button
                              type="button"
                              onClick={() => handleFridayStatusChange(fIndex, 'FIXED')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                isFixed
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Building2 className="w-3 h-3" />
                              <span>مسجد محدد</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFridayStatusChange(fIndex, 'FLEXIBLE')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                isFlexible
                                  ? 'bg-sky-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <Shuffle className="w-3 h-3" />
                              <span>مرن للتوزيع</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFridayStatusChange(fIndex, 'UNAVAILABLE')}
                              className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                                isUnavailable
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              <CalendarX2 className="w-3 h-3" />
                              <span>معتذر / مستبعد</span>
                            </button>
                          </div>
                        </div>

                        {/* Body based on status */}
                        {isFixed && (
                          <div className="pt-1 space-y-2">
                            <div className="flex gap-2">
                              <select
                                value={assignment.mosqueId || ''}
                                onChange={(e) => handleFridayMosqueChange(fIndex, Number(e.target.value))}
                                className="flex-1 text-xs font-semibold text-slate-900 p-2 border border-emerald-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              >
                                <option value="">اختر المسجد المراد تثبيت الخطيب به في هذه الجمعة...</option>
                                {mosques.map((m) => {
                                  const occ = (occupiedSlots[fIndex] || []).find((o) => o.mosqueId === m.id);
                                  return (
                                    <option key={m.id} value={m.id}>
                                      {m.name} ({m.code}) — {m.region || '—'}
                                      {occ ? ` [⚠️ مأخوذ لـ: ${occ.imamName}]` : ''}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {occupiedByOther && (
                              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>
                                  <strong>تنبيه تضارب:</strong> هذا المسجد مخصص حالياً لفضيلة الشيخ (<strong>{occupiedByOther.imamName}</strong>) في {fridayLabel}. عند الحفظ سيتم نقله رسمياً لفضيلة الشيخ الحالي في هذه الجمعة.
                                </span>
                              </div>
                            )}

                            {selectedMosque && !occupiedByOther && (
                              <div className="text-[11px] text-emerald-800 flex items-center gap-2 bg-emerald-100/60 px-2.5 py-1 rounded">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>
                                  مثبت في <strong>{selectedMosque.name}</strong> ({selectedMosque.region || 'المنطقة غير محددة'})
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {isFlexible && (
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded">
                            <span className="text-sky-600 font-bold">✓</span>
                            <span>مرن: متاح للتكليف في أي مسجد بحسب محرك الجدولة والأولويات الجغرافية.</span>
                          </div>
                        )}

                        {isUnavailable && (
                          <div className="text-[11px] text-rose-800 flex items-center gap-1.5 bg-rose-100/70 px-2.5 py-1.5 rounded border border-rose-200">
                            <span className="font-bold">🚫</span>
                            <span>معتذر / مستبعد: لن يتم تكليف الخطيب في أي مسجد خلال هذه الجمعة مطلقاً.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode 3: Flexible Note */}
            {assignmentMode === 'FLEXIBLE' && (
              <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs font-heading">
                  <Shuffle className="w-4 h-4 text-purple-600" />
                  <span>خطيب مرن عام (خاضع للتوزيع الذكي)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  الخطيب غير مرتبط بمسجد ثابت في أي جمعة، ومتاح للتكليف تلقائياً بواسطة خوارزمية الجدولة حسب احتياج المساجد الشاغرة ومعدل الأقرب جغرافياً وقواعد التفضيل أدناه.
                </p>
              </div>
            )}

            {/* 2. Preferred Mosques (المساجد المفضلة) */}
            {imam ? (
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 font-heading">
                      المساجد المفضلة للخطيب (أولوية التوزيع)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      يمنح محرك الجدولة أولوية عليا (+1000 نقطة) لتكليف الخطيب في هذه المساجد تلقائياً
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
                    {preferredRules.length} مساجد مفضلة
                  </span>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedPreferredMosque}
                    onChange={(e) => setSelectedPreferredMosque(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">اختر مسجداً لإضافته إلى قائمة التفضيل...</option>
                    {mosques
                      .filter((m) => !preferredRules.some((r) => r.mosqueId === m.id) && m.id !== fixedMosqueId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}) — {m.region || '—'}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPreferredMosque}
                    onClick={() => handleAddRule('PREFERRED')}
                    className="px-3.5 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة تفضيل</span>
                  </button>
                </div>

                {preferredRules.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    لا توجد مساجد مفضلة مضافة حالياً.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {preferredRules.map((r, idx) => {
                      const m = r.mosque || mosques.find((x) => x.id === r.mosqueId);
                      return (
                        <div key={r.id} className="p-2.5 flex items-center justify-between text-xs bg-white hover:bg-slate-50/50">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-bold text-slate-900">{m?.name || `مسجد #${r.mosqueId}`}</span>
                            <span className="text-slate-400 font-mono text-[11px]">({m?.code || '—'})</span>
                            <span className="text-slate-500 text-[11px]">· {m?.region || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="حذف التفضيل"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* 3. Forbidden / Restricted Mosques (المساجد المحظورة / المستبعدة) */}
            {imam ? (
              <div className="p-4 bg-white border border-rose-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-rose-950 font-heading">
                      المساجد المستبعدة / المحظورة (قيد صارم Hard Constraint)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      قيد قطعي يمنع محرك الجدولة تماماً من تكليف الخطيب في هذه المساجد بأي جمعة
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px] font-bold">
                    {restrictionRules.length} مساجد محظورة
                  </span>
                </div>

                <div className="flex gap-2">
                  <select
                    value={selectedForbiddenMosque}
                    onChange={(e) => setSelectedForbiddenMosque(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 text-xs p-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">اختر مسجداً لإضافته إلى قائمة الاستبعاد / الحظر...</option>
                    {mosques
                      .filter((m) => !restrictionRules.some((r) => r.mosqueId === m.id) && m.id !== fixedMosqueId)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}) — {m.region || '—'}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedForbiddenMosque}
                    onClick={() => handleAddRule('FORBIDDEN')}
                    className="px-3.5 py-2 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة استبعاد</span>
                  </button>
                </div>

                {restrictionRules.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs text-slate-400">
                    لا توجد مساجد مستبعدة مسجلة للخطيب.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {restrictionRules.map((r) => {
                      const m = r.mosque || mosques.find((x) => x.id === r.mosqueId);
                      return (
                        <div key={r.id} className="p-2.5 flex items-center justify-between text-xs bg-rose-50/20 hover:bg-rose-50/40">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 text-[10px] font-bold">
                              محظور
                            </span>
                            <span className="font-bold text-slate-900">{m?.name || `مسجد #${r.mosqueId}`}</span>
                            <span className="text-slate-400 font-mono text-[11px]">({m?.code || '—'})</span>
                            <span className="text-slate-500 text-[11px]">· {m?.region || '—'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteRule(r.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="إلغاء الاستبعاد"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Sticky Footer Actions (Always visible at the bottom of the modal) */}
        <div className="sticky bottom-0 -mx-3.5 sm:-mx-6 -mb-3.5 sm:-mb-6 p-3 sm:p-4 bg-white/95 backdrop-blur-xs border-t border-slate-200 flex items-center justify-between z-20 shadow-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إلغاء وإغلاق
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جارٍ حفظ البيانات...' : 'حفظ بيانات الخطيب'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
