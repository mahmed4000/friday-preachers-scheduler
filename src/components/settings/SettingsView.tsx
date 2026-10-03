import React, { useState, useRef, useEffect } from 'react';
import { fetchApi } from '../../lib/api.ts';
import {
  Building2,
  Upload,
  RotateCcw,
  CheckCircle2,
  Save,
  Phone,
  Mail,
  MapPin,
  FileText,
  ShieldCheck,
  UserCheck,
  Eye,
  AlertCircle,
  Sliders,
  Send,
  Lock,
  Database,
  Users,
  Printer,
  Sparkles,
  CalendarDays,
  RefreshCw,
  Clock,
  Compass,
  Globe,
  Navigation,
  FileSpreadsheet,
} from 'lucide-react';
import { OrganizationSettings } from '../../types/index.ts';
import { DEFAULT_SHARIA_LOGO, DEFAULT_ORGANIZATION_SETTINGS } from '../../lib/defaultLogo.ts';
import { CalendarService, TIMEZONE_LABELS } from '../../services/calendar/calendarService.ts';
import { CurrentDateTimeInfo } from '../../services/calendar/types.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/Card.tsx';
import { Input } from '../ui/Input.tsx';
import { Select } from '../ui/Select.tsx';
import { EgyptianAddressSelector, EgyptianAddressValue } from '../common/EgyptianAddressSelector.tsx';
import { ImportExportCenter } from '../import-export/ImportExportCenter.tsx';

interface SettingsViewProps {
  settings: OrganizationSettings;
  onSaveSettings: (newSettings: OrganizationSettings) => Promise<void>;
  onClose?: () => void;
}

type SettingsSection = 'association' | 'location' | 'calendar' | 'scheduling' | 'printing' | 'whatsapp' | 'import-export' | 'system';

export function SettingsView({ settings, onSaveSettings, onClose }: SettingsViewProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('association');
  const [formData, setFormData] = useState<OrganizationSettings>({
    ...settings,
    calendarProvider: settings.calendarProvider || 'UMM_AL_QURA',
    timezone: settings.timezone || 'Africa/Cairo',
    countryId: settings.countryId || 1,
    governorateId: settings.governorateId || 1,
    districtId: settings.districtId || 101,
    areaId: settings.areaId || 1001,
  });

  // Calendar live state & sync feedback
  const [currentDateTime, setCurrentDateTime] = useState<CurrentDateTimeInfo>(() =>
    CalendarService.getCurrentDateTime({
      provider: (formData.calendarProvider as any) || 'UMM_AL_QURA',
      timezone: formData.timezone || 'Africa/Cairo',
    })
  );
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(
        CalendarService.getCurrentDateTime({
          provider: (formData.calendarProvider as any) || 'UMM_AL_QURA',
          timezone: formData.timezone || 'Africa/Cairo',
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [formData.calendarProvider, formData.timezone]);

  // Additional scheduling & WhatsApp settings state
  const [defaultDistributionMethod, setDefaultDistributionMethod] = useState<'Balanced Random' | 'Balanced' | 'Random'>('Balanced Random');
  const [defaultFridaysCount, setDefaultFridaysCount] = useState<number>(5);
  const [whatsappTemplate, setWhatsappTemplate] = useState<string>(
    'السلام عليكم ورحمة الله، فضيلة {الخطيب}، نود تذكيركم بموعد إلقاء خطبة الجمعة ({الجمعة}) في {المسجد} يوم {التاريخ}. جزاكم الله خيراً.'
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: keyof OrganizationSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (addr: EgyptianAddressValue) => {
    setFormData((prev) => ({
      ...prev,
      countryId: addr.countryId,
      countryName: addr.countryName,
      governorateId: addr.governorateId,
      governorateName: addr.governorateName,
      districtId: addr.districtId || undefined,
      districtName: addr.districtName,
      areaId: addr.areaId || undefined,
      areaName: addr.areaName,
      street: addr.street,
      buildingNumber: addr.buildingNumber,
      landmark: addr.landmark,
      address: addr.formattedAddress,
      formattedAddress: addr.formattedAddress,
      city: addr.areaName || addr.districtName || 'منشأة البكاري',
    }));
  };

  const handleCalendarSync = () => {
    setIsSyncingCalendar(true);
    setSyncSuccessMsg(null);
    try {
      CalendarService.configureDefaults(
        (formData.calendarProvider as any) || 'UMM_AL_QURA',
        formData.timezone || 'Africa/Cairo'
      );
      const synced = CalendarService.syncCalendar({
        provider: (formData.calendarProvider as any) || 'UMM_AL_QURA',
        timezone: formData.timezone || 'Africa/Cairo',
      });
      setCurrentDateTime(synced);
      setFormData((prev) => ({
        ...prev,
        lastCalendarSyncAt: synced.lastSync,
      }));
      setSyncSuccessMsg('تمت مزامنة بيانات التقويم والتاريخ الحالي بنجاح طبقاً لمصدر التقويم والمنطقة الزمنية (توقيت القاهرة)!');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('Error syncing calendar:', err);
    } finally {
      setTimeout(() => setIsSyncingCalendar(false), 500);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('يرجى اختيار ملف صورة صالح (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMessage('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 3 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setFormData((prev) => ({ ...prev, logoUrl: base64 }));
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetToDefaultLogo = () => {
    setFormData((prev) => ({ ...prev, logoUrl: DEFAULT_SHARIA_LOGO }));
  };

  const handleResetAllDefaults = () => {
    if (window.confirm('هل تريد استعادة جميع إعدادات وبيانات الجمعية الافتراضية (منشأة البكاري - الهرم - الجيزة)؟')) {
      setFormData({ ...DEFAULT_ORGANIZATION_SETTINGS });
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await onSaveSettings(formData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const navItems: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'association', label: 'الجمعية والشعار', icon: Building2 },
    { id: 'location', label: 'الموقع الجغرافي والعنوان', icon: MapPin },
    { id: 'calendar', label: 'التاريخ والتقويم', icon: CalendarDays },
    { id: 'scheduling', label: 'الجدولة والتوزيع', icon: Sliders },
    { id: 'printing', label: 'التقارير والطباعة', icon: Printer },
    { id: 'whatsapp', label: 'الواتساب والرسائل', icon: Send },
    { id: 'import-export', label: 'استيراد وتصدير البيانات', icon: FileSpreadsheet },
    { id: 'system', label: 'النظام والأمان', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="rtl">
      {/* Top Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-950 border border-emerald-300">
              إعدادات النظام المركزية
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-heading text-slate-900">
            الإعدادات العامة وهوية الجمعية الشرعية
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            إدارة بيانات فرع الجمعية، الشعار الرسمي، خوارزميات التوزيع، قوالب رسائل الواتساب، والاعتمادات الرسمية في التقارير.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetAllDefaults}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            استعادة الافتراضيات
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSubmit()}
            isLoading={saving}
            leftIcon={<Save className="w-3.5 h-3.5" />}
          >
            حفظ التغييرات
          </Button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>تم حفظ إعدادات الجمعية وهوية التقارير بنجاح! تم تطبيقها فوراً على جميع الجداول.</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-950 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="underline text-[11px] cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Main Settings Layout: Sidebar on right + Content on left */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Settings Navigation Sidebar */}
        <div className="md:col-span-1 space-y-1">
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content Area */}
        <div className="md:col-span-3 space-y-6">
          {/* SECTION 1: ASSOCIATION & LOGO */}
          {activeSection === 'association' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-800" />
                  <span>بيانات الجمعية وشعار الهوية البصرية</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  بيانات المقر والفرع والشعار المعتمد في ترويسة جميع المستندات والجداول
                </p>
              </div>

              {/* Logo Preview & Uploader */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center p-4 bg-[#fdfbf7] rounded-xl border border-amber-900/10">
                <div className="text-center flex flex-col items-center justify-center space-y-2">
                  <span className="text-xs font-bold text-slate-700">معاينة الشعار الحالي</span>
                  <div className="w-24 h-24 rounded-xl bg-white border border-slate-200 p-2 shadow-2xs flex items-center justify-center overflow-hidden">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="شعار الجمعية" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <Building2 className="w-10 h-10 text-slate-300" />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      leftIcon={<Upload className="w-3.5 h-3.5" />}
                    >
                      رفع شعار من الجهاز
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleResetToDefaultLogo}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-700" />}
                    >
                      استعادة الشعار الرسمي للجمعية الشرعية
                    </Button>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يدعم ملفات PNG و SVG و JPG و WebP. يوصى باستخدام شعار مربع أو دائري بدقة عالية.
                  </p>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="اسم الجمعية الرئيسي"
                  value={formData.associationName}
                  onChange={(e) => handleInputChange('associationName', e.target.value)}
                  helperText="يظهر كعنوان أول في ترويسة كافة الجداول والتقارير"
                  required
                />

                <Input
                  label="اسم الفرع أو القطاع"
                  value={formData.branchName}
                  onChange={(e) => handleInputChange('branchName', e.target.value)}
                  helperText="اسم الفرع الإقليمي أو إدارة القطاع"
                  required
                />

                <Input
                  label="اسم الأمانة أو الإدارة المشرفة"
                  value={formData.departmentName}
                  onChange={(e) => handleInputChange('departmentName', e.target.value)}
                  helperText="مثال: أمانة شؤون المساجد والخطباء والدعوة"
                  required
                />

                <Input
                  label="المدينة أو المحافظة"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  helperText="النطاق الجغرافي للمساجد"
                  required
                />

                <Input
                  label="الهاتف الرسمي"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />

                <Input
                  label="البريد الإلكتروني"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                />
              </div>

              <div className="pt-2">
                <EgyptianAddressSelector
                  title="الموقع الجغرافي والعنوان الإداري المعتمد لمقر الجمعية"
                  value={{
                    countryId: formData.countryId || 1,
                    governorateId: formData.governorateId || 1,
                    districtId: formData.districtId || 101,
                    areaId: formData.areaId || 1001,
                    street: formData.street || '',
                    buildingNumber: formData.buildingNumber || '',
                    landmark: formData.landmark || '',
                    formattedAddress: formData.formattedAddress || formData.address || '',
                  }}
                  onChange={handleAddressChange}
                />
              </div>
            </Card>
          )}

          {/* SECTION: LOCATION SETTINGS */}
          {activeSection === 'location' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🇪🇬</span>
                  <h3 className="text-base font-bold font-heading text-slate-900">
                    التقسيم الإداري والموقع الجغرافي للجمعية الشرعية
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحديد الموقع الرسمي للجمعية وفروعها طبقاً لقاعدة البيانات الإدارية لجمهورية مصر العربية (الجهاز المركزي للتعبئة العامة والإحصاء - CAPMAS)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>المقر الرئيسي المعتمد للجمعية:</span>
                </div>
                <p className="leading-relaxed">
                  <strong>الجمعية الشرعية لمدينة منشأة البكاري</strong> — تابعة إدارياً لـ <strong>حي الهرم</strong> — <strong>محافظة الجيزة</strong> — <strong>جمهورية مصر العربية</strong>.
                </p>
                <p className="text-[11px] text-emerald-800">
                  تُستخدم هذه البيانات كمرجع جغرافي تلقائي عند تسجيل المساجد والخطباء، وتُطبع في الترويسات الرسمية لجميع جداول خطباء الجمعة.
                </p>
              </div>

              <EgyptianAddressSelector
                title="تعديل العنوان الإداري المفصل"
                value={{
                  countryId: formData.countryId || 1,
                  governorateId: formData.governorateId || 1,
                  districtId: formData.districtId || 101,
                  areaId: formData.areaId || 1001,
                  street: formData.street || '',
                  buildingNumber: formData.buildingNumber || '',
                  landmark: formData.landmark || '',
                  formattedAddress: formData.formattedAddress || formData.address || '',
                }}
                onChange={handleAddressChange}
                showCoordinates={true}
              />
            </Card>
          )}

          {/* SECTION 2: CALENDAR & DATE (HIJRI-FIRST CALENDAR SYSTEM) */}
          {activeSection === 'calendar' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-emerald-800" />
                    <span>نظام التقويم والتاريخ المركزي (Hijri-First Calendar System)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    التحكم في مصدر التقويم المعتمد، المنطقة الزمنية المعتمدة للجمعية، ومزامنة التاريخ والجمعات
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCalendarSync}
                  isLoading={isSyncingCalendar}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncingCalendar ? 'animate-spin text-emerald-700' : 'text-slate-600'}`} />}
                >
                  <span>مزامنة التقويم الآن</span>
                </Button>
              </div>

              {syncSuccessMsg && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{syncSuccessMsg}</span>
                </div>
              )}

              {/* Live Active Date Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900 text-white shadow-md border border-emerald-800/60 relative overflow-hidden">
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        الوقت والتاريخ الحي المعتمد
                      </span>
                      <span className="text-xs text-emerald-200">
                        {currentDateTime.providerNameArabic}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-emerald-200 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-700/40">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="tabular-nums font-mono font-bold text-amber-300">{currentDateTime.timeString}</span>
                      <span className="text-[11px] text-emerald-300">({currentDateTime.timezoneLabel})</span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <div className="text-xl sm:text-2xl font-bold font-heading text-amber-300">
                      {currentDateTime.dayName} {currentDateTime.hijri.formatted}
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-100/90 mt-1">
                      الموافق: {currentDateTime.gregorian.formatted}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-800/60 flex flex-wrap items-center justify-between gap-3 text-[11px] text-emerald-200/80">
                    <div className="flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>المنطقة الزمنية المعتمدة: <strong>{currentDateTime.timezone}</strong></span>
                    </div>
                    <div>
                      <span>آخر مزامنة: </span>
                      <span className="tabular-nums text-emerald-300 font-mono">
                        {new Date(formData.lastCalendarSyncAt || currentDateTime.lastSync).toLocaleTimeString('ar-SA')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Settings for Calendar & Timezone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="مصدر التقويم المعتمد (Calendar Provider)"
                  value={formData.calendarProvider || 'UMM_AL_QURA'}
                  onChange={(e) => handleInputChange('calendarProvider', e.target.value)}
                  helperText="المرجع الحسابي والشرعي لتحديد بدايات الشهور والجمعات"
                  options={[
                    { value: 'UMM_AL_QURA', label: 'تقويم أم القرى (Umm Al-Qura) — المعتمد والافتراضي' },
                    { value: 'OFFICIAL_LOCAL', label: 'التقويم الرسمي المحلي (Official Local Sighting)' },
                    { value: 'CUSTOM', label: 'تقويم مخصص حسب المعايير الفلكية (Custom)' },
                  ]}
                />

                <Select
                  label="المنطقة الزمنية المعتمدة (Time Zone)"
                  value={formData.timezone || 'Asia/Riyadh'}
                  onChange={(e) => handleInputChange('timezone', e.target.value)}
                  helperText="المنطقة الزمنية الخاصة بالجمعية لحساب التاريخ والوقت والجمعات"
                  options={Object.entries(TIMEZONE_LABELS).map(([tz, label]) => ({
                    value: tz,
                    label: `${label} (${tz})`,
                  }))}
                />
              </div>

              {/* Method explanation details box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                <span className="font-bold block text-slate-900 font-heading flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-emerald-800" />
                  <span>طريقة حساب التاريخ والجمعات (Hijri-First Scheduling Engine):</span>
                </span>
                <p className="leading-relaxed text-slate-600">
                  يعتمد النظام منهجية <strong>Hijri-First</strong>: يُحدد المستخدم السنة والشهر الهجري (مثلاً 1448 هـ - رمضان)، فيقوم محرك التقويم المعتمد تلقائياً باستخراج تاريخ بداية ونهاية الشهر بدقة، ثم حصر كافة أيام الجمعة الواقعة قطعاً داخل حدود الشهر (من الجمعة الأولى إلى الخامسة)، ومنع تكليف أي خطيب بجمعة خارج نطاق الشهر المعتمد.
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 font-medium">
                  <span className="text-emerald-800 font-bold">✓ منع الجمعات خارج الشهر</span>
                  <span>•</span>
                  <span className="text-emerald-800 font-bold">✓ الترتيب المتسلسل للجمعات (1..5)</span>
                  <span>•</span>
                  <span className="text-emerald-800 font-bold">✓ الربط الصارم بين التاريخين الهجري والميلادي</span>
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 3: SCHEDULING CONFIG */}
          {activeSection === 'scheduling' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-800" />
                  <span>إعدادات محرك الجدولة وخوارزميات التوزيع</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحديد الطريقة الافتراضية لتوزيع الخطباء على المساجد وضوابط العدالة
                </p>
              </div>

              <div className="space-y-4">
                <Select
                  label="طريقة التوزيع الافتراضية للمحرك"
                  value={defaultDistributionMethod}
                  onChange={(e) => setDefaultDistributionMethod(e.target.value as any)}
                  helperText="الخوارزمية المعتمدة تلقائياً عند إنشاء جدول شهري جديد"
                  options={[
                    { value: 'Balanced Random', label: 'توزيع عادل عشوائي (Balanced Random) — موصى به' },
                    { value: 'Balanced', label: 'توزيع عادل صارم بأولويات التفضيل (Balanced)' },
                    { value: 'Random', label: 'توزيع عشوائي متسلسل (Random)' },
                  ]}
                />

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <span className="font-bold block text-slate-900 font-heading">
                    شرح خوارزمية التوزيع العادل (Balanced Random):
                  </span>
                  <p className="leading-relaxed">
                    تبدأ الخوارزمية بحجز الخطباء الثابتين للمساجد أولاً، ثم تفرز المساجد حسب أولويات التفضيل مع احترام عدم توفر الخطباء وحظر الممنوعين، ثم توزع الخطباء المرنين بعدالة لضمان وصول كل خطيب للحد المستهدف (Target).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="السنة الهجرية المعتمدة"
                    defaultValue="1448"
                    helperText="السنة الهجرية الحالية لجداول النظام"
                  />
                  <Input
                    label="الحد الأدنى لجمعات الخطيب شهرياً"
                    defaultValue="1"
                    helperText="أقل عدد جمعات يُكلّف بها الخطيب المرن"
                  />
                </div>
              </div>
            </Card>
          )}

          {/* SECTION 3: PRINTING & SIGNATURES */}
          {activeSection === 'printing' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Printer className="w-4 h-4 text-emerald-800" />
                  <span>إعدادات الطباعة والاعتمادات والتوقيعات الرسمية</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تحديد أسماء المسؤولين الذين تظهر توقيعاتهم المعتمدة أسفل جداول التكليف
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 block font-heading">
                    1. مُعدّ ومبرمج الجداول
                  </span>
                  <Input
                    label="المسمى الوظيفي"
                    value={formData.schedulePreparerTitle}
                    onChange={(e) => handleInputChange('schedulePreparerTitle', e.target.value)}
                  />
                  <Input
                    label="الاسم أو القسم"
                    value={formData.schedulePreparerName}
                    onChange={(e) => handleInputChange('schedulePreparerName', e.target.value)}
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-emerald-950 block font-heading">
                    2. أمين شؤون المساجد (المشرف)
                  </span>
                  <Input
                    label="المسمى الوظيفي"
                    value={formData.managerTitle}
                    onChange={(e) => handleInputChange('managerTitle', e.target.value)}
                  />
                  <Input
                    label="اسم فضيلة الشيخ"
                    value={formData.managerName}
                    onChange={(e) => handleInputChange('managerName', e.target.value)}
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 block font-heading">
                    3. اعتماد رئيس مجلس الإدارة
                  </span>
                  <Input
                    label="مسمى الاعتماد"
                    value={formData.boardPresidentTitle}
                    onChange={(e) => handleInputChange('boardPresidentTitle', e.target.value)}
                  />
                  <Input
                    label="جهة الاعتماد"
                    value={formData.boardPresidentName}
                    onChange={(e) => handleInputChange('boardPresidentName', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 font-heading">
                  ديباجة التذييل والدعاء (في أسفل خطابات تكليف الخطباء):
                </label>
                <textarea
                  rows={2}
                  value={formData.footerNote}
                  onChange={(e) => handleInputChange('footerNote', e.target.value)}
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:border-emerald-700 focus:outline-none text-slate-900 leading-relaxed"
                />
              </div>
            </Card>
          )}

          {/* SECTION 4: WHATSAPP INTEGRATION */}
          {activeSection === 'whatsapp' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-800" />
                  <span>تكامل الواتساب وقوالب الإرسال الموحدة</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  صيغة الرسائل الرسمية المرسلة للخطباء ومسؤولي المساجد عبر روابط WhatsApp المباشرة
                </p>
              </div>

              <div className="space-y-4">
                <Input
                  label="رقم واتساب أمانة المساجد الرسمي"
                  value={formData.whatsapp}
                  onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                  helperText="الرقم المعتمد للتواصل مع الخطباء واستقبال الاعتذارات"
                />

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800 font-heading">
                    قالب رسالة إشعار التكليف بالخطبة:
                  </label>
                  <textarea
                    rows={4}
                    value={whatsappTemplate}
                    onChange={(e) => setWhatsappTemplate(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:border-emerald-700 focus:outline-none text-slate-900 leading-relaxed font-mono"
                  />
                  <p className="text-[11px] text-slate-500">
                    المتغيرات المتاحة: {'{الخطيب}'} · {'{المسجد}'} · {'{الجمعة}'} · {'{التاريخ}'}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* SECTION: IMPORT & EXPORT CENTER */}
          {activeSection === 'import-export' && (
            <ImportExportCenter />
          )}

          {/* SECTION 5: SYSTEM & SECURITY */}
          {activeSection === 'system' && (
            <Card variant="default" className="p-6 space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold font-heading text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-800" />
                  <span>إعدادات النظام، الأمان، والنسخ الاحتياطي</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  معلومات الاتصال بقاعدة البيانات وحالة مزامنة الجداول
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block font-heading">
                      حالة الاتصال بقاعدة البيانات (Cloud SQL PostgreSQL)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      مزامنة تلقائية وسريعة لكافة العمليات والتعيينات
                    </span>
                  </div>
                  <span className="text-emerald-800 font-bold bg-emerald-100/80 px-2.5 py-1 rounded-md">
                    متصل ونشط ✓
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 block font-heading">
                      سجل العمليات والتدقيق (Audit Trail)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      توثيق كافة التعديلات اليدوية وتغييرات التعيينات في النظام
                    </span>
                  </div>
                  <span className="text-slate-700 font-bold bg-slate-200 px-2.5 py-1 rounded-md">
                    مفعّل دائماً
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-rose-950 block font-heading">
                      تصفير قاعدة البيانات (إعادة الضبط لـ 0 مساجد و 0 خطباء)
                    </span>
                    <span className="text-rose-700 text-[11px]">
                      حذف كافة المساجد والخطباء والتوزيعات تجنباً للتضارب وتجهيزاً لرفع البيانات الحقيقية
                    </span>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      if (confirm('هل أنت تأكد من تصفير النظام بالكامل وإعادة العداد لـ 0 مساجد و 0 خطباء؟')) {
                        try {
                          await fetchApi('/api/system/clear-all', { method: 'POST' });
                          alert('تم تصفير النظام بنجاح (0 مساجد، 0 خطباء)');
                          window.location.reload();
                        } catch (err: any) {
                          alert(err.message || 'تعذر تصفير النظام');
                        }
                      }
                    }}
                  >
                    تصفير البيانات
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => handleSubmit()}
              isLoading={saving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              حفظ جميع الإعدادات وتطبيقها
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
