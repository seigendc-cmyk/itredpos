import { mockSettings } from '../mock/mockPosData';
import type { BusinessProfile } from '../types';

const PROFILE_KEY = 'itred_pos_business_profile';
const ACTIVITY_KEY = 'itred_pos_business_profile_activity';

export interface BusinessProfileValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface BusinessProfileActivityEvent {
  eventId: string;
  eventType:
    | 'BUSINESS_PROFILE_VIEWED'
    | 'BUSINESS_PROFILE_UPDATED'
    | 'BUSINESS_REGISTRATION_ENABLED'
    | 'BUSINESS_REGISTRATION_DISABLED'
    | 'BUSINESS_REGISTRATION_DETAILS_UPDATED'
    | 'BUSINESS_TAX_DETAILS_UPDATED'
    | 'BUSINESS_ADMINISTRATOR_DETAILS_UPDATED'
    | 'BUSINESS_PROFILE_DASHBOARD_VIEWED'
    | 'BUSINESS_PROFILE_PERMISSION_RESTRICTED';
  label: string;
  message: string;
  createdAt: string;
  staffId?: string;
}

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const hasText = (value?: string) => Boolean(value && value.trim().length > 0);

const canUseLocalStorage = () => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const readJson = <T>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local profile persistence is best-effort in build-development mode.
  }
};

const recordActivity = (event: Omit<BusinessProfileActivityEvent, 'eventId' | 'createdAt'>) => {
  const rows = readJson<BusinessProfileActivityEvent[]>(ACTIVITY_KEY, []);
  writeJson(ACTIVITY_KEY, [{ ...event, eventId: makeId('BIZ'), createdAt: nowIso() }, ...rows].slice(0, 75));
};

export function getBusinessProfile(): BusinessProfile {
  recordActivity({ eventType: 'BUSINESS_PROFILE_VIEWED', label: 'Business Profile Viewed', message: 'Business profile loaded from local/mock state.' });
  return readJson<BusinessProfile>(PROFILE_KEY, mockSettings.businessProfile);
}

export function validateBusinessProfile(profile: BusinessProfile): BusinessProfileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const registered = Boolean(profile.isRegisteredBusiness || profile.isBusinessRegistered);
  const taxCollector = Boolean(profile.taxCollector || profile.isTaxCollector);
  const districtSuburb = profile.districtSuburb || [profile.district, profile.suburb].filter(Boolean).join(' / ');

  if (!hasText(profile.businessName) && !hasText(profile.tradingName)) errors.push('Business Name or Trading Name is required.');
  if (!hasText(profile.businessType)) errors.push('Business Type is required.');
  if (!hasText(profile.industrialSector)) errors.push('Industrial Sector is required.');
  if (!hasText(profile.cityTown)) errors.push('City / Town is required.');
  if (!hasText(districtSuburb)) errors.push('District / Suburb is required.');

  if (registered) {
    if (!hasText(profile.registeredBusinessName)) errors.push('Registered Business Name is required.');
    if (!hasText(profile.companyRegistrationNumber) && !hasText(profile.tradeCertificateRegistrationNumber) && !hasText(profile.regNo)) errors.push('Company Registration Number or Trade Certificate Registration Number is required.');
    if (!hasText(profile.registrationDate)) errors.push('Date of Registration is required.');
    if (!hasText(profile.registrationPlace)) errors.push('Place of Registration is required.');
    if (!hasText(profile.ownerFullName)) errors.push('Owner Full Name is required.');
    if (!hasText(profile.ownerContact) && !hasText(profile.ownerPhone)) errors.push('Owner Contact is required.');
  }

  if (profile.vatRegistered && !hasText(profile.vatNumber)) errors.push('VAT Number is required when VAT Registered is enabled.');
  if (taxCollector) {
    if (!hasText(profile.taxCollectorType)) errors.push('Tax Collector Type is required when Tax Registered / Tax Collector is enabled.');
    if (!hasText(profile.taxRegistrationNumber) && !hasText(profile.taxIdentificationNumber)) errors.push('Tax Registration Number is required when Tax Registered / Tax Collector is enabled.');
  }

  if (!hasText(profile.accountantName) && !hasText(profile.businessAdministratorName)) warnings.push('Add either an accountant or business administrator contact when available.');
  if (profile.accountantPhone && profile.accountantPhone.replace(/\D/g, '').length < 7) warnings.push('Accountant phone looks short.');
  if (profile.businessAdministratorPhone && profile.businessAdministratorPhone.replace(/\D/g, '').length < 7) warnings.push('Business administrator phone looks short.');

  return { ok: errors.length === 0, errors, warnings };
}

export function saveBusinessProfile(profile: BusinessProfile, staffId: string): BusinessProfile {
  const registered = Boolean(profile.isRegisteredBusiness || profile.isBusinessRegistered);
  const saved: BusinessProfile = {
    ...profile,
    isRegisteredBusiness: registered,
    isBusinessRegistered: registered,
    taxCollector: Boolean(profile.taxCollector || profile.isTaxCollector),
    isTaxCollector: Boolean(profile.taxCollector || profile.isTaxCollector),
    ownerContact: profile.ownerContact || profile.ownerPhone,
    ownerPhone: profile.ownerPhone || profile.ownerContact,
    taxRegistrationNumber: profile.taxRegistrationNumber || profile.taxIdentificationNumber,
    taxIdentificationNumber: profile.taxIdentificationNumber || profile.taxRegistrationNumber,
    profileStatus: profile.profileStatus || profile.businessStatus || 'Active',
    businessStatus: profile.businessStatus || profile.profileStatus || 'Active',
    profileLastUpdatedAt: nowIso(),
    profileUpdatedBy: staffId
  };
  writeJson(PROFILE_KEY, saved);
  recordActivity({ eventType: 'BUSINESS_PROFILE_UPDATED', label: 'Business Profile Updated', message: 'Business profile saved locally.', staffId });
  recordActivity({ eventType: registered ? 'BUSINESS_REGISTRATION_ENABLED' : 'BUSINESS_REGISTRATION_DISABLED', label: registered ? 'Business Registration Enabled' : 'Business Registration Disabled', message: registered ? 'Registration details are enabled.' : 'Registration details are hidden.', staffId });
  if (registered) recordActivity({ eventType: 'BUSINESS_REGISTRATION_DETAILS_UPDATED', label: 'Business Registration Details Updated', message: 'Business registration detail fields were saved locally.', staffId });
  if (saved.vatRegistered || saved.taxCollector) recordActivity({ eventType: 'BUSINESS_TAX_DETAILS_UPDATED', label: 'Business Tax Details Updated', message: 'VAT/tax fields were saved locally.', staffId });
  if (saved.accountantName || saved.businessAdministratorName) recordActivity({ eventType: 'BUSINESS_ADMINISTRATOR_DETAILS_UPDATED', label: 'Business Administrator Details Updated', message: 'Accountant or administrator contact fields were saved locally.', staffId });
  return saved;
}

export function getBusinessRegistrationDetails(profile: BusinessProfile = getBusinessProfile()) {
  return {
    registeredBusinessName: profile.registeredBusinessName || profile.businessName || profile.legalName,
    tradingName: profile.tradingName || profile.receiptBusinessName || '',
    registrationNumber: profile.companyRegistrationNumber || profile.tradeCertificateRegistrationNumber || profile.regNo,
    registrationDate: profile.registrationDate || '',
    registrationPlace: profile.registrationPlace || profile.registrationAuthority || '',
    vatStatus: profile.vatRegistered ? `VAT Registered ${profile.vatNumber || ''}`.trim() : 'Not VAT Registered',
    taxRegistrationNumber: profile.taxRegistrationNumber || profile.taxIdentificationNumber || profile.taxNo,
    accountantOrAdministratorName: profile.accountantName || profile.businessAdministratorName || '',
    accountantOrAdministratorPhone: profile.accountantPhone || profile.businessAdministratorPhone || ''
  };
}

export function canViewBusinessRegistrationDetails(permissionChecker: (permissionKey: string) => boolean): boolean {
  return permissionChecker('businessRegistration.dashboardView');
}

export function getBusinessProfileDashboardSummary(permissionChecker: (permissionKey: string) => boolean, profile: BusinessProfile = getBusinessProfile()) {
  const canViewRegistration = canViewBusinessRegistrationDetails(permissionChecker);
  recordActivity({ eventType: canViewRegistration ? 'BUSINESS_PROFILE_DASHBOARD_VIEWED' : 'BUSINESS_PROFILE_PERMISSION_RESTRICTED', label: canViewRegistration ? 'Business Profile Dashboard Viewed' : 'Business Profile Permission Restricted', message: canViewRegistration ? 'Registration details shown on dashboard.' : 'Registration details hidden by permission.' });
  return {
    canViewRegistration,
    basic: {
      businessName: profile.businessName || profile.legalName,
      tradingName: profile.tradingName || profile.receiptBusinessName || '',
      cityTown: profile.cityTown || '',
      industrialSector: profile.industrialSector || '',
      status: profile.profileStatus || profile.businessStatus || 'Active'
    },
    registration: getBusinessRegistrationDetails(profile)
  };
}

export function getBusinessProfileActivityEvents(): BusinessProfileActivityEvent[] {
  return readJson<BusinessProfileActivityEvent[]>(ACTIVITY_KEY, []);
}
