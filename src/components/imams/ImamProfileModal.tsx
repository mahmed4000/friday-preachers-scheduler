import React, { useState, useEffect } from 'react';
import { Imam, ImamAvailability } from '../../types/index.ts';
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
} from 'lucide-react';
import { fetchApi } from '../../lib/api.ts';
import { EgyptianAddressSelector, EgyptianAddressValue } from '../common/EgyptianAddressSelector.tsx';
import { CalendarService } from '../../services/calendar/calendarService.ts';

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

  // Availabilities
  const [availabilities, setAvailabilities] = useState<ImamAvailability[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New availability exception form
  const [newFridayIndex, setNewFridayIndex] = useState<number>(1);
  const [newReason, setNewReason] = useState<string>('ارتباط مسبق / سفر');

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

      fetchApi<any>(`/api/imams/${imam.id}`)
        .then((res) => {
          if (res.availabilities) setAvailabilities(res.availabilities);
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

  const handleSave = async () => {
    setErrorMessage(null);
    if (!name) {
      setErrorMessage('اسم الخطيب مطلوب');
      return;
    }
    if (minFridays > targetFridays || targetFridays > maxFridays) {
      setErrorMessage('يجب أن يكون: الحد الأدنى <= المستهدف <= الحد الأقصى');
      return;
    }

    setSaving(true);
    setFeedback(null);
    setErrorMessage(null);

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
        type,
        minFridays: Number(minFridays),
        targetFridays: Number(targetFridays),
        maxFridays: Number(maxFridays),
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
        type,
        minFridays: Number(minFridays),
        targetFridays: Number(targetFridays),
        maxFridays: Number(maxFridays),
      };

      // Confirmed server success: notify parent view and display success feedback
      onSaved(confirmedImam);
      setFeedback('تم حفظ بيانات الخطيب بنجاح ✓');

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
      const curHijri = CalendarService.getCurrentDateTime().hijri;
      await fetchApi(`/api/imams/${imam.id}/availabilities`, {
        method: 'POST',
        body: JSON.stringify({
          hijriYear: curHijri.year || 1448,
          hijriMonth: curHijri.month || 1,
          fridayIndex: newFridayIndex,
          isAvailable: false,
          reason: newReason,
        }),
      });

      const res = await fetchApi<any>(`/api/imams/${imam.id}`);
      if (res.availabilities) setAvailabilities(res.availabilities);
      setFeedback('تم تسجيل استثناء عدم التوفر للجمعة المحددة');
      setTimeout(() => setFeedback(null), 3000);
      onSaved();
    } catch (err: any) {
      setErrorMessage(err.message || 'تعذر تسجيل الاستثناء');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={imam ? `ملف الخطيب: ${imam.name}` : 'إضافة خطيب جديد'}
      subtitle={imam ? `نوع التعيين: ${imam.type === 'FIXED' ? 'ثابت' : imam.type === 'PARTIAL_FIXED' ? 'ثابت جزئي' : 'مرن'} · المنطقة: ${imam.region || 'غير محددة'}` : 'تسجيل خطيب جديد في قاعدة البيانات'}
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'limits'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>حدود التوزيع والأحمال</span>
          </button>

          {imam && (
            <button
              onClick={() => setActiveTab('availability')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
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
                  className={`p-3 rounded-lg border text-right transition-all ${
                    type === 'FIXED'
                      ? 'bg-white border-emerald-600 shadow-2xs text-slate-900'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold font-heading">ثابت (FIXED)</span>
                  <span className="text-[11px] text-slate-500">مخصص لجامع محدد بشكل دائم طوال الشهر</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('PARTIAL_FIXED')}
                  className={`p-3 rounded-lg border text-right transition-all ${
                    type === 'PARTIAL_FIXED'
                      ? 'bg-white border-amber-600 shadow-2xs text-slate-900'
                      : 'bg-white/50 border-slate-200 text-slate-600 hover:bg-white'
                  }`}
                >
                  <span className="block text-xs font-bold font-heading">ثابت جزئي (PARTIAL)</span>
                  <span className="text-[11px] text-slate-500">ثابت لعدد معين من الجمعات وباقي الشهر مرن</span>
                </button>

                <button
                  type="button"
                  onClick={() => setType('FLEXIBLE')}
                  className={`p-3 rounded-lg border text-right transition-all ${
                    type === 'FLEXIBLE'
                      ? 'bg-white border-sky-600 shadow-2xs text-slate-900'
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
                  onChange={(e) => setMinFridays(Number(e.target.value))}
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
                  onChange={(e) => setTargetFridays(Number(e.target.value))}
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
                  onChange={(e) => setMaxFridays(Number(e.target.value))}
                  className="w-full text-xs p-2.5 font-bold text-center border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="block text-[10px] text-slate-500 mt-1 text-center">قيد صارم لا يتجاوز دون استثناء</span>
              </div>
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
                    <div key={a.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-bold">
                          الجمعة ({a.fridayIndex})
                        </span>
                        <span className="text-slate-600">غير متاح · السبب: {a.reason || 'اعتذار رسمي'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

          {(activeTab === 'info' || activeTab === 'limits') && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جارٍ حفظ البيانات...' : 'حفظ بيانات الخطيب'}</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
