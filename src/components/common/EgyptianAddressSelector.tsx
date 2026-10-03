import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Building,
  Navigation,
  Search,
  CheckCircle2,
  AlertCircle,
  Compass,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { EgyptAdministrativeProvider } from '../../services/location/egyptLocationService.ts';
import { AdministrativeUnit } from '../../types/location.ts';

export interface EgyptianAddressValue {
  countryId: number;
  countryName?: string;
  governorateId: number;
  governorateName?: string;
  districtId: number | null;
  districtName?: string;
  areaId: number | null;
  areaName?: string;
  street: string;
  buildingNumber: string;
  landmark: string;
  formattedAddress: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

interface EgyptianAddressSelectorProps {
  value?: Partial<EgyptianAddressValue>;
  onChange: (newValue: EgyptianAddressValue) => void;
  title?: string;
  compact?: boolean;
  showCoordinates?: boolean;
}

export function EgyptianAddressSelector({
  value,
  onChange,
  title = 'العنوان والموقع الجغرافي (جمهورية مصر العربية)',
  compact = false,
  showCoordinates = false,
}: EgyptianAddressSelectorProps) {
  // 1. Egyptian Governorates
  const governorates = useMemo(() => EgyptAdministrativeProvider.getGovernorates(1), []);

  // Internal state
  const [governorateId, setGovernorateId] = useState<number>(value?.governorateId || 1); // 1 = الجيزة
  const [districtId, setDistrictId] = useState<number | null>(value?.districtId !== undefined ? value.districtId : 101); // 101 = حي الهرم
  const [areaId, setAreaId] = useState<number | null>(value?.areaId !== undefined ? value.areaId : 1001); // 1001 = منشأة البكاري
  const [street, setStreet] = useState<string>(value?.street || '');
  const [buildingNumber, setBuildingNumber] = useState<string>(value?.buildingNumber || '');
  const [landmark, setLandmark] = useState<string>(value?.landmark || '');
  const [latitude, setLatitude] = useState<string>(value?.latitude ? String(value.latitude) : '');
  const [longitude, setLongitude] = useState<string>(value?.longitude ? String(value.longitude) : '');

  // Filter search terms inside dropdowns
  const [govSearch, setGovSearch] = useState('');
  const [distSearch, setDistSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');

  // Synchronize when value prop changes from outside
  useEffect(() => {
    if (value) {
      if (value.governorateId !== undefined && value.governorateId !== governorateId) {
        setGovernorateId(value.governorateId);
      }
      if (value.districtId !== undefined && value.districtId !== districtId) {
        setDistrictId(value.districtId);
      }
      if (value.areaId !== undefined && value.areaId !== areaId) {
        setAreaId(value.areaId);
      }
      if (value.street !== undefined && value.street !== street) {
        setStreet(value.street);
      }
      if (value.buildingNumber !== undefined && value.buildingNumber !== buildingNumber) {
        setBuildingNumber(value.buildingNumber);
      }
      if (value.landmark !== undefined && value.landmark !== landmark) {
        setLandmark(value.landmark);
      }
      if (value.latitude !== undefined && String(value.latitude) !== latitude) {
        setLatitude(String(value.latitude || ''));
      }
      if (value.longitude !== undefined && String(value.longitude) !== longitude) {
        setLongitude(String(value.longitude || ''));
      }
    }
  }, [value]);

  // Available districts for current governorate
  const availableDistricts = useMemo(() => {
    if (!governorateId) return [];
    return EgyptAdministrativeProvider.getUnitsByParent(governorateId);
  }, [governorateId]);

  // Available areas for current district
  const availableAreas = useMemo(() => {
    if (!districtId) return [];
    return EgyptAdministrativeProvider.getUnitsByParent(districtId);
  }, [districtId]);

  // Computed display address
  const currentFormattedAddress = useMemo(() => {
    return EgyptAdministrativeProvider.formatStructuredAddress({
      countryId: 1,
      governorateId,
      districtId,
      areaId,
      street,
      buildingNumber,
      landmark,
    });
  }, [governorateId, districtId, areaId, street, buildingNumber, landmark]);

  // Trigger onChange to parent whenever address changes
  const emitChange = (updates: Partial<EgyptianAddressValue>) => {
    const nextGovId = updates.governorateId !== undefined ? updates.governorateId : governorateId;
    const nextDistId = updates.districtId !== undefined ? updates.districtId : districtId;
    const nextAreaId = updates.areaId !== undefined ? updates.areaId : areaId;
    const nextStreet = updates.street !== undefined ? updates.street : street;
    const nextBuilding = updates.buildingNumber !== undefined ? updates.buildingNumber : buildingNumber;
    const nextLandmark = updates.landmark !== undefined ? updates.landmark : landmark;
    const nextLat = updates.latitude !== undefined ? updates.latitude : latitude;
    const nextLng = updates.longitude !== undefined ? updates.longitude : longitude;

    const govObj = EgyptAdministrativeProvider.getUnitById(nextGovId);
    const distObj = nextDistId ? EgyptAdministrativeProvider.getUnitById(nextDistId) : undefined;
    const areaObj = nextAreaId ? EgyptAdministrativeProvider.getUnitById(nextAreaId) : undefined;

    const formatted = EgyptAdministrativeProvider.formatStructuredAddress({
      countryId: 1,
      governorateId: nextGovId,
      districtId: nextDistId,
      areaId: nextAreaId,
      street: nextStreet,
      buildingNumber: nextBuilding,
      landmark: nextLandmark,
    });

    onChange({
      countryId: 1,
      countryName: 'جمهورية مصر العربية',
      governorateId: nextGovId,
      governorateName: govObj?.nameAr || 'الجيزة',
      districtId: nextDistId,
      districtName: distObj?.nameAr,
      areaId: nextAreaId,
      areaName: areaObj?.nameAr,
      street: nextStreet,
      buildingNumber: nextBuilding,
      landmark: nextLandmark,
      formattedAddress: formatted,
      latitude: nextLat || null,
      longitude: nextLng || null,
    });
  };

  // Handlers
  const handleGovernorateChange = (newGovId: number) => {
    setGovernorateId(newGovId);
    // Reset district and area if governorate changes
    const childDistricts = EgyptAdministrativeProvider.getUnitsByParent(newGovId);
    const firstDistId = childDistricts[0]?.id || null;
    setDistrictId(firstDistId);

    const childAreas = firstDistId ? EgyptAdministrativeProvider.getUnitsByParent(firstDistId) : [];
    const firstAreaId = childAreas[0]?.id || null;
    setAreaId(firstAreaId);

    emitChange({
      governorateId: newGovId,
      districtId: firstDistId,
      areaId: firstAreaId,
    });
  };

  const handleDistrictChange = (newDistId: number | null) => {
    setDistrictId(newDistId);
    const childAreas = newDistId ? EgyptAdministrativeProvider.getUnitsByParent(newDistId) : [];
    const firstAreaId = childAreas[0]?.id || null;
    setAreaId(firstAreaId);

    emitChange({
      districtId: newDistId,
      areaId: firstAreaId,
    });
  };

  const handleAreaChange = (newAreaId: number | null) => {
    setAreaId(newAreaId);
    emitChange({
      areaId: newAreaId,
    });
  };

  const filteredGovs = governorates.filter((g) =>
    g.nameAr.includes(govSearch.trim()) || (g.nameEn && g.nameEn.toLowerCase().includes(govSearch.toLowerCase()))
  );

  const filteredDistricts = availableDistricts.filter((d) =>
    d.nameAr.includes(distSearch.trim()) || (d.nameEn && d.nameEn.toLowerCase().includes(distSearch.toLowerCase()))
  );

  const filteredAreas = availableAreas.filter((a) =>
    a.nameAr.includes(areaSearch.trim()) || (a.nameEn && a.nameEn.toLowerCase().includes(areaSearch.toLowerCase()))
  );

  return (
    <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 sm:p-4 space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 font-heading">{title}</h4>
            <p className="text-[11px] text-slate-500">نظام التقسيم الإداري المعتمد لجمهورية مصر العربية</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-sm">🇪🇬</span>
          <span className="text-xs font-bold text-slate-800">جمهورية مصر العربية</span>
        </div>
      </div>

      {/* Cascading Administrative Dropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Level 1: المحافظة */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            المحافظة <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={governorateId}
              onChange={(e) => handleGovernorateChange(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              {filteredGovs.map((gov) => (
                <option key={gov.id} value={gov.id}>
                  {gov.nameAr} {gov.id === 1 ? '⭐ (مقر الجمعية)' : ''}
                </option>
              ))}
            </select>
          </div>
          {governorateId === 1 && (
            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              محافظة المقر الرئيسي
            </span>
          )}
        </div>

        {/* Level 2: الحي / المركز / القسم */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            الحي / المركز / المدينة <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={districtId || ''}
              onChange={(e) => handleDistrictChange(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              {filteredDistricts.length === 0 ? (
                <option value="">لا توجد مراكز مسجلة</option>
              ) : (
                filteredDistricts.map((dist) => (
                  <option key={dist.id} value={dist.id}>
                    {dist.nameAr} ({EgyptAdministrativeProvider.getTypeLabelArabic(dist.type)})
                  </option>
                ))
              )}
            </select>
          </div>
          {districtId === 101 && (
            <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              نطاق حي الهرم
            </span>
          )}
        </div>

        {/* Level 3: المنطقة / الشياخة / القرية */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            المنطقة / الشياخة / القرية <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={areaId || ''}
              onChange={(e) => handleAreaChange(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-2xs"
            >
              {filteredAreas.length === 0 ? (
                <option value="">لا توجد شياخات مسجلة</option>
              ) : (
                filteredAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameAr} ({EgyptAdministrativeProvider.getTypeLabelArabic(a.type)})
                  </option>
                ))
              )}
            </select>
          </div>
          {areaId === 1001 && (
            <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              منشأة البكاري (مقر الجمعية)
            </span>
          )}
        </div>
      </div>

      {/* Free Detail Fields: Street, Building Number, Landmark */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
        <div className="sm:col-span-6 space-y-1">
          <label className="block text-xs font-semibold text-slate-700">اسم الشارع / الميدان</label>
          <input
            type="text"
            value={street}
            onChange={(e) => {
              setStreet(e.target.value);
              emitChange({ street: e.target.value });
            }}
            placeholder="مثال: شارع الجمعية الشرعية الرئيسي / شارع داير الناحية"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="block text-xs font-semibold text-slate-700">رقم العقار</label>
          <input
            type="text"
            value={buildingNumber}
            onChange={(e) => {
              setBuildingNumber(e.target.value);
              emitChange({ buildingNumber: e.target.value });
            }}
            placeholder="مثال: 12"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs text-center"
          />
        </div>

        <div className="sm:col-span-4 space-y-1">
          <label className="block text-xs font-semibold text-slate-700">علامة مميزة (Landmark)</label>
          <input
            type="text"
            value={landmark}
            onChange={(e) => {
              setLandmark(e.target.value);
              emitChange({ landmark: e.target.value });
            }}
            placeholder="مثال: بجوار مجمع المعاهد الأزهرية"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
          />
        </div>
      </div>

      {/* GPS Coordinates (Optional) */}
      {showCoordinates && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/60">
          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-500" />
              <span>خط العرض (Latitude)</span>
            </label>
            <input
              type="text"
              value={latitude}
              onChange={(e) => {
                setLatitude(e.target.value);
                emitChange({ latitude: e.target.value });
              }}
              placeholder="مثال: 30.0125"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-semibold text-slate-600 flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-500" />
              <span>خط الطول (Longitude)</span>
            </label>
            <input
              type="text"
              value={longitude}
              onChange={(e) => {
                setLongitude(e.target.value);
                emitChange({ longitude: e.target.value });
              }}
              placeholder="مثال: 31.1412"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
            />
          </div>
        </div>
      )}

      {/* Authoritative Live Address Preview */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg p-2.5 flex items-start gap-2">
        <Navigation className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="text-[11px] font-bold text-emerald-950 block">العنوان الإداري المعتمد المُولّد:</span>
          <p className="text-xs text-emerald-900 font-medium leading-relaxed font-sans">{currentFormattedAddress}</p>
        </div>
      </div>
    </div>
  );
}
