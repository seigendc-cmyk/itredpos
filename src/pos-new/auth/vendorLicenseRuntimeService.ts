import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import {
  PosVendorAuthContext,
  resolveNextAuthStage
} from './posVendorAuthState';
import type { PlanFeatureFlags } from './planFeatureGate';

export type VendorRuntimeLicenseMode = 'trial' | 'active' | 'demo';
export type VendorRuntimeBlockReason = 'LicenseRequired' | 'AccountSuspended' | 'VerificationRejected';
export type VendorRuntimeNoticeKind = 'trial' | 'pending' | 'offline' | 'blocked' | 'active';

export interface VendorLicenseRuntimeSnapshot {
  vendorId: string;
  planCode: string;
  licenseStatus: string;
  activationStatus: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  accountStatus: string;
  verificationStatus: string;
  activatedAt: string;
  suspendedAt: string;
  rejectedAt: string;
  featureFlags: Partial<PlanFeatureFlags>;
  maxBranches: number;
  maxWarehouses: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
  allowed: boolean;
  licenseMode: VendorRuntimeLicenseMode;
  noticeKind: VendorRuntimeNoticeKind;
  noticeTitle: string;
  noticeDetail: string;
  daysRemaining: number | null;
  offline: boolean;
  source: 'firestore' | 'local';
  blockReason?: VendorRuntimeBlockReason;
  updatedAt: string;
}

type Row = Record<string, unknown>;

const LICENSE_CACHE_PREFIX = 'sci_pos_vendor_license_runtime';
const DEFAULT_PLAN = 'DEMO';
const OFFLINE_NOTICE = 'Working offline. License will sync when connection returns.';

function cacheKey(vendorId: string): string {
  return `${LICENSE_CACHE_PREFIX}_${vendorId || 'unassigned-vendor'}`;
}

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function upper(value: unknown, fallback = ''): string {
  return text(value, fallback).toUpperCase();
}

function compactStatus(value: unknown): string {
  return text(value).replace(/[\s_-]+/g, '').toLowerCase();
}

function numberValue(value: unknown, fallback = -1): number {
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function featureFlagsFrom(value: unknown): Partial<PlanFeatureFlags> {
  return value && typeof value === 'object' ? value as Partial<PlanFeatureFlags> : {};
}

function toIso(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

function daysRemaining(expiresAt: string): number | null {
  const expiry = Date.parse(expiresAt);
  if (!Number.isFinite(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

function isExpiredTrial(licenseStatus: string, trialExpiresAt: string): boolean {
  const status = compactStatus(licenseStatus);
  if (status !== 'trial' && status !== 'demo') return false;
  const expiry = Date.parse(trialExpiresAt);
  return Number.isFinite(expiry) && expiry <= Date.now();
}

function normalizeLicenseMode(licenseStatus: string, planCode: string): VendorRuntimeLicenseMode {
  const status = compactStatus(licenseStatus);
  if (status === 'active') return 'active';
  if (status === 'trial') return 'trial';
  if (status === 'demo' || planCode === DEFAULT_PLAN) return 'demo';
  return 'trial';
}

function makeNotice(snapshot: Omit<VendorLicenseRuntimeSnapshot, 'noticeKind' | 'noticeTitle' | 'noticeDetail'>): Pick<VendorLicenseRuntimeSnapshot, 'noticeKind' | 'noticeTitle' | 'noticeDetail'> {
  if (snapshot.blockReason === 'AccountSuspended') {
    return {
      noticeKind: 'blocked',
      noticeTitle: 'Account Suspended',
      noticeDetail: 'Contact SCI support to restore POS access.'
    };
  }
  if (snapshot.blockReason === 'VerificationRejected' || snapshot.blockReason === 'LicenseRequired') {
    return {
      noticeKind: 'blocked',
      noticeTitle: 'License Required',
      noticeDetail: 'Contact SCI support to activate POS access.'
    };
  }
  if (snapshot.offline) {
    return {
      noticeKind: 'offline',
      noticeTitle: 'Working offline',
      noticeDetail: 'License will sync when connection returns.'
    };
  }
  if (compactStatus(snapshot.activationStatus) === 'pendingconsoleverification') {
    return {
      noticeKind: 'pending',
      noticeTitle: 'Account Pending Verification',
      noticeDetail: 'Trial access remains available while SCI reviews your registration.'
    };
  }
  if (compactStatus(snapshot.licenseStatus) === 'trial' || snapshot.licenseMode === 'demo') {
    const days = snapshot.daysRemaining;
    return {
      noticeKind: 'trial',
      noticeTitle: 'Trial Plan Active',
      noticeDetail: days === null ? 'Trial access enabled' : `${days} Days Remaining`
    };
  }
  return {
    noticeKind: 'active',
    noticeTitle: '',
    noticeDetail: ''
  };
}

function createRuntimeSnapshot(
  vendorId: string,
  license: Row,
  vendor: Row,
  options: { offline: boolean; source: 'firestore' | 'local' }
): VendorLicenseRuntimeSnapshot {
  const planCode = upper(license.planCode || vendor.planCode, DEFAULT_PLAN);
  const licenseStatus = text(license.licenseStatus || vendor.licenseStatus, options.offline ? 'Trial' : 'Trial');
  const activationStatus = text(license.activationStatus || vendor.activationStatus, 'PendingConsoleVerification');
  const accountStatus = text(vendor.accountStatus || license.accountStatus, 'Trial');
  const verificationStatus = text(vendor.verificationStatus || license.verificationStatus, 'Pending');
  const trialStartedAt = toIso(license.trialStartedAt || vendor.trialStartedAt);
  const trialExpiresAt = toIso(license.trialExpiresAt || license.expiresAt || vendor.trialExpiresAt);
  const featureFlags = {
    ...featureFlagsFrom(vendor.featureFlags),
    ...featureFlagsFrom(license.featureFlags)
  };
  const suspended = [accountStatus, licenseStatus, activationStatus].some((value) => compactStatus(value) === 'suspended');
  const rejected = [verificationStatus, accountStatus, licenseStatus, activationStatus].some((value) => compactStatus(value) === 'rejected');
  const expired = compactStatus(licenseStatus) === 'expired' || isExpiredTrial(licenseStatus, trialExpiresAt);
  const activeLicense = compactStatus(activationStatus) === 'active' && ['active', 'trial'].includes(compactStatus(licenseStatus));
  const pendingTrial = compactStatus(activationStatus) === 'pendingconsoleverification';
  const licenseMode = normalizeLicenseMode(licenseStatus, planCode);
  const blockReason: VendorRuntimeBlockReason | undefined = suspended
    ? 'AccountSuspended'
    : rejected
      ? 'VerificationRejected'
      : expired
        ? 'LicenseRequired'
        : undefined;

  const base = {
    vendorId,
    planCode,
    licenseStatus,
    activationStatus,
    trialStartedAt,
    trialExpiresAt,
    accountStatus,
    verificationStatus,
    activatedAt: toIso(license.activatedAt || vendor.activatedAt),
    suspendedAt: toIso(license.suspendedAt || vendor.suspendedAt),
    rejectedAt: toIso(license.rejectedAt || vendor.rejectedAt),
    featureFlags,
    maxBranches: numberValue(license.maxBranches || vendor.maxBranches),
    maxWarehouses: numberValue(license.maxWarehouses || vendor.maxWarehouses),
    maxTerminals: numberValue(license.maxTerminals || vendor.maxTerminals),
    maxStaff: numberValue(license.maxStaff || vendor.maxStaff),
    maxProducts: numberValue(license.maxProducts || vendor.maxProducts),
    allowed: !blockReason && (activeLicense || pendingTrial || options.offline),
    licenseMode,
    daysRemaining: daysRemaining(trialExpiresAt),
    offline: options.offline,
    source: options.source,
    blockReason,
    updatedAt: new Date().toISOString()
  };

  return {
    ...base,
    ...makeNotice(base)
  };
}

function saveRuntimeSnapshot(snapshot: VendorLicenseRuntimeSnapshot): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(cacheKey(snapshot.vendorId), JSON.stringify(snapshot));
  } catch {
    // License cache is best-effort for offline operation.
  }
}

export function readSavedVendorLicenseSnapshot(vendorId: string): VendorLicenseRuntimeSnapshot | null {
  if (!storageAvailable()) return null;
  try {
    const raw = localStorage.getItem(cacheKey(vendorId));
    return raw ? JSON.parse(raw) as VendorLicenseRuntimeSnapshot : null;
  } catch {
    return null;
  }
}

function fallbackOfflineSnapshot(vendorId: string): VendorLicenseRuntimeSnapshot {
  const cached = readSavedVendorLicenseSnapshot(vendorId);
  if (cached) {
    const offline = createRuntimeSnapshot(vendorId, cached as unknown as Row, cached as unknown as Row, { offline: true, source: 'local' });
    return {
      ...offline,
      licenseMode: cached.licenseMode,
      planCode: cached.planCode || offline.planCode
    };
  }
  return createRuntimeSnapshot(vendorId, {}, {}, { offline: true, source: 'local' });
}

export function subscribeToVendorLicense(
  vendorId: string,
  callback: (snapshot: VendorLicenseRuntimeSnapshot) => void
): Unsubscribe {
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) {
    callback(fallbackOfflineSnapshot('unassigned-vendor'));
    return () => undefined;
  }

  if (!db) {
    callback(fallbackOfflineSnapshot(cleanVendorId));
    return () => undefined;
  }

  let licenseData: Row = {};
  let vendorData: Row = {};

  const emit = (offline = false) => {
    const snapshot = offline
      ? fallbackOfflineSnapshot(cleanVendorId)
      : createRuntimeSnapshot(cleanVendorId, licenseData, vendorData, { offline: false, source: 'firestore' });
    if (!offline) saveRuntimeSnapshot(snapshot);
    callback(snapshot);
  };

  const licenseUnsubscribe = onSnapshot(
    doc(db, 'vendorLicenses', cleanVendorId),
    (snapshot) => {
      licenseData = snapshot.exists() ? snapshot.data() as Row : {};
      emit(false);
    },
    () => emit(true)
  );

  const vendorUnsubscribe = onSnapshot(
    doc(db, 'vendors', cleanVendorId),
    (snapshot) => {
      vendorData = snapshot.exists() ? snapshot.data() as Row : {};
      emit(false);
    },
    () => emit(true)
  );

  return () => {
    licenseUnsubscribe();
    vendorUnsubscribe();
  };
}

function authLicenseStatus(snapshot: VendorLicenseRuntimeSnapshot): PosVendorAuthContext['licenseStatus'] {
  if (snapshot.blockReason === 'AccountSuspended') return 'Suspended';
  if (snapshot.blockReason === 'VerificationRejected') return 'Rejected';
  if (snapshot.blockReason === 'LicenseRequired') return 'Expired';
  if (compactStatus(snapshot.licenseStatus) === 'active') return 'Active';
  if (compactStatus(snapshot.licenseStatus) === 'trial') return 'Trial';
  return 'Demo';
}

export function mergeVendorLicenseIntoAuthContext(
  context: PosVendorAuthContext,
  snapshot: VendorLicenseRuntimeSnapshot
): PosVendorAuthContext {
  const messageDetail = snapshot.noticeDetail ? ` - ${snapshot.noticeDetail}` : '';
  const runtimeMessage = `${snapshot.noticeTitle}${messageDetail}`;
  const nextContext: PosVendorAuthContext = {
    ...context,
    vendorId: context.vendorId || snapshot.vendorId,
    planCode: snapshot.planCode,
    licenseMode: snapshot.licenseMode,
    licenseStatus: authLicenseStatus(snapshot),
    activationStatus: snapshot.activationStatus,
    accountStatus: snapshot.accountStatus,
    verificationStatus: snapshot.verificationStatus,
    trialStartedAt: snapshot.trialStartedAt,
    trialExpiresAt: snapshot.trialExpiresAt,
    activatedAt: snapshot.activatedAt,
    suspendedAt: snapshot.suspendedAt,
    rejectedAt: snapshot.rejectedAt,
    featureFlags: snapshot.featureFlags,
    maxBranches: snapshot.maxBranches,
    maxWarehouses: snapshot.maxWarehouses,
    maxTerminals: snapshot.maxTerminals,
    maxStaff: snapshot.maxStaff,
    maxProducts: snapshot.maxProducts,
    demoExpiresAt: snapshot.trialExpiresAt || context.demoExpiresAt,
    message: snapshot.noticeKind === 'offline' ? OFFLINE_NOTICE : runtimeMessage
  };

  nextContext.stage = snapshot.allowed ? resolveNextAuthStage(nextContext) : 'licenseRequired';
  return nextContext;
}
