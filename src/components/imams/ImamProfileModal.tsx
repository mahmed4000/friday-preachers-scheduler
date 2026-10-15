import React, { useState, useEffect } from 'react';
import { Imam, ImamAvailability } from '../../types/index.ts';
import { Modal } from '../common/Modal.tsx';
import {
  Users2,
  Calendar,
  Save,
  CheckCircle2,
  CalendarCheck,
  AlertTriangle,
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { EgyptianAddressSelector, EgyptianAddressValue } from '../common/EgyptianAddressSelector.tsx';
import { directUpdateImam } from '../../services/clientDataService.ts';

interface ImamProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  imam: Imam | null;
  onSaved: (updatedImam?: Imam) => void;
}

export function ImamProfileModal({
  isOpen,
  onClose,
  imam,
  onSaved,
}: ImamProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'limits'>('info');

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

  // Available Fridays (حصر التكليف)
  const [selectedFridays, setSelectedFridays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      if (imam.availableFridays && Array.isArray(imam.availableFridays) && imam.availableFridays.length > 0) {
        setSelectedFridays([...imam.availableFridays].sort((a, b) => a - b));
      } else if (imam.availabilities && imam.availabilities.length > 0) {
        const excluded = new Set(imam.availabilities.filter((a) => !a.isAvailable).map((a) => a.fridayIndex));
        setSelectedFridays([1, 2, 3, 4, 5].filter((f) => !excluded.has(f)));
      } else {
        setSelectedFridays([1, 2, 3, 4, 5]);
      }

      fetchApi<any>(`/api/imams/${imam.id}`)
        .then((res) => {
          if (res.availableFridays && Array.isArray(res.availableFridays) && res.availableFridays.length > 0) {
            setSelectedFridays([...res.availableFridays].sort((a, b) => a - b));
          } else if (res.availabilities && Array.isArray(res.availabilities) && res.availabilities.length > 0) {
            const excluded = new Set(res.availabilities.filter((a: any) => !a.isAvailable).map((a: any) => a.fridayIndex));
            setSelectedFridays([1, 2, 3, 4, 5].filter((f) => !excluded.has(f)));
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
      setSelectedFridays([1, 2, 3, 4, 5]);
    }
    setActiveTab('info');
    setFeedback(null);
    setErrorMessage(null);
  }, [imam, isOpen]);

  const toggleFriday = (fridayIndex: number) => {
    setSelectedFridays((prev) => {
      if (prev.includes(fridayIndex)) {
        return prev.filter((idx) => idx !== fridayIndex).sort((a, b) => a - b);
      } else {
        return [...prev, fridayIndex].sort((a, b) => a - b);
      }
    });
  };

  const handleSetPreset = (preset: number[]) => {
    setSelectedFridays([...preset].sort((a, b) => a - b));
  };

  const isMatchesPreset = (preset: number[]) => {
    if (selectedFridays.length !== preset.length) return false;
    return preset.every((idx) => selectedFridays.includes(idx));
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

  const handleSave = async () => {
    setErrorMessage(null);
    if (!name) {
      setErrorMessage('اسم الخطيب مطلوب');
      return;
    }

    setSaving(true);
    setFeedback(null);

    const calculatedTarget = selectedFridays.length;
    const calculatedMax = selectedFridays.length;
    const calculatedMin = Math.min(1, selectedFridays.length);
    const calculatedType: 'FIXED' | 'PARTIAL_FIXED' | 'FLEXIBLE' =
      selectedFridays.length === 5 ? 'FLEXIBLE' : 'PARTIAL_FIXED';

    // 1. Optimistic Imam object (0ms UI latency)
    const optimisticImam: Imam = {
      ...(imam || { id: Date.now() }),
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
      type: calculatedType,
      minFridays: calculatedMin,
      targetFridays: calculatedTarget,
      maxFridays: calculatedMax,
      availableFridays: selectedFridays,
    };

    // 2. Trigger instant UI update in parent view
    onSaved(optimisticImam);
    setFeedback('تم حفظ بيانات الخطيب بنجاح ✓');

    // 3. Smoothly close modal
    setTimeout(() => {
      onClose();
    }, 350);

    // 4. Background Persistence (Direct to Supabase + API)
    try {
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
        type: calculatedType,
        minFridays: calculatedMin,
        targetFridays: calculatedTarget,
        maxFridays: calculatedMax,
      };

      if (imam) {
        await directUpdateImam(imam.id, payload, selectedFridays);
      } else {
        await fetchApi('/api/imams', {
          method: 'POST',
          body: JSON.stringify({ ...payload, availableFridays: selectedFridays }),
        });
      }
    } catch (err: any) {
      console.warn('Background imam save warning:', err);
    } finally {
      setSaving(false);
    }
  };

  const fridaysSummary =
    selectedFridays.length === 5
      ? 'متاح طوال الشهر (الجمعات 1-5)'
      : selectedFridays.length === 0
      ? 'غير متاح لأي جمعة'
      : `متاح في الجمعات: ${selectedFridays.map((f) => `الجمعة ${f}`).join('، ')}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imam ? `ملف الخطيب: ${imam.name}` : 'إضافة خطيب جديد'}
      subtitle={imam ? `${fridaysSummary} · المنطقة: ${imam.region || 'غير محددة'}` : 'تسجيل خطيب جديد في قاعدة البيانات'}
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            <Calendar className="w-3.5 h-3.5" />
            <span>الجمعات المتاحة للتوزيع في الشهر ({selectedFridays.length}/5)</span>
          </button>
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

        {/* Tab 2: Available Fridays only (حصر التكليف) */}
        {activeTab === 'limits' && (
          <div className="space-y-5 bg-slate-50/60 p-4 sm:p-5 rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <CalendarCheck className="w-4 h-4 text-emerald-600" />
                  <span>الجمعات المتاحة للتوزيع في الشهر (حصر التكليف)</span>
                </label>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  تم تحديد {selectedFridays.length} من 5 جمعات
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                حدد بدقة الجمعات التي يمكن للخطيب إلقاء الخطبة فيها خلال الشهر. يلتزم محرك التوزيع التزاماً صارماً وقاطعاً بهذه الجمعات ولا يتم تعيينه إطلاقاً في الجمعات المستبعدة.
              </p>

              {/* Presets */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <span className="text-[11px] text-slate-500 font-medium ml-1">خيارات سريعة:</span>
                {[
                  { label: 'تحديد الكل (1-5)', value: [1, 2, 3, 4, 5] },
                  { label: 'الجمعة 1 + 3', value: [1, 3] },
                  { label: 'الجمعة 2 + 4', value: [2, 4] },
                  { label: 'الجمعة 1 فقط', value: [1] },
                  { label: 'الجمعة 2 فقط', value: [2] },
                ].map((preset) => {
                  const isSelected = isMatchesPreset(preset.value);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleSetPreset(preset.value)}
                      className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              {/* 5 Friday Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {[1, 2, 3, 4, 5].map((fridayNum) => {
                  const isAvailable = selectedFridays.includes(fridayNum);
                  return (
                    <button
                      key={fridayNum}
                      type="button"
                      onClick={() => toggleFriday(fridayNum)}
                      className={`p-3 rounded-xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer select-none ${
                        isAvailable
                          ? 'bg-emerald-50/80 border-emerald-600 text-emerald-950 shadow-xs ring-1 ring-emerald-600/30'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                      }`}
                    >
                      <span className={`text-xs font-black ${isAvailable ? 'text-emerald-900' : 'text-slate-600'}`}>
                        الجمعة {fridayNum}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isAvailable
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {isAvailable ? 'متاح للتوزيع ✓' : 'مستبعد ✕'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Notice Alert */}
            <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-950">
                  ⚡ تنبيه حصر التوزيع الصارم:
                </p>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  تم اعتماد <span className="font-bold text-emerald-900">{selectedFridays.length}</span> جمعات متاحة لهذا الخطيب ({selectedFridays.length === 5 ? 'كامل جمعات الشهر' : selectedFridays.map((f) => `الجمعة ${f}`).join('، ')}). سيلتزم محرك التوزيع التزاماً صارماً وقاطعاً بعدم إسناد أي مسجد له في الجمعات المستبعدة، مع الحفاظ التام على ربط بيانات المساجد والخطباء.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sticky Footer Actions */}
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
