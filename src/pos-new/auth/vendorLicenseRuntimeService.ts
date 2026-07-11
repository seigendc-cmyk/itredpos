import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import type {
  PosAuthStage,
  PosVendorAuthContext
} from './posVendorAuthState';
import {
  resolveNextAuthStage
} from './posVendorAuthState';
import type { PlanFeatureFlags } from './planFeatureGate';
import {
  FIRESTORE_COLLECTIONS,
  DEFAULT_PLAN_LIMITS,
  DEFAULT_PLAN_FEATURE_FLAGS
} from '../../shared/backend';
import type { PlanCode } from '../../shared/backend';

export type VendorRuntimeLicenseMode = 'trial' | 'active' | 'demo' | 'blocked';
export type VendorRuntimeBlockReason = 'LicenseRequired' | 'AccountSuspended' | 'VerificationRejected';
export type VendorRuntimeNoticeKind = 'trial' | 'pending' | 'offline' | 'blocked' | 'active';

export interface VendorLicenseRuntimeSnapshot {
  vendorId: string;
  planCode: string;
  planId?: string;
  planName?: string;
  licenseStatus: string;
  activationStatus: string;
  verificationStatus: string;
  accountStatus: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  featureFlags: Partial<PlanFeatureFlags>;
  maxBranches: number;
  maxWarehouses: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
  allowed: boolean;
  /**
   * When false, POS should not make a licensing decision yet (Firestore not fully populated).
   * This prevents transient "Upgrade Required" after activation.
   */
  licenseStatusKnown: boolean;
  licenseMode: VendorRuntimeLicenseMode;
  noticeKind: VendorRuntimeNoticeKind;
  noticeTitle: string;
  noticeDetail: string;
  daysRemaining: number | null;
  offline: boolean;
  source: 'firestore' | 'local';
  blockReason?: VendorRuntimeBlockReason;
  updatedAt: string;
  message: string;
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

function makeNotice(snapshot: Omit<VendorLicenseRuntimeSnapshot, 'noticeKind' | 'noticeTitle' | 'noticeDetail' | 'message'>): Pick<VendorLicenseRuntimeSnapshot, 'noticeKind' | 'noticeTitle' | 'noticeDetail'> {
  if (snapshot.blockReason === 'AccountSuspended') {
    return {
      noticeKind: 'blocked',
      noticeTitle: 'Account Suspended',
      noticeDetail: 'Contact SCI support to restore POS access.'
    };
  }
  if (snapshot.blockReason === 'VerificationRejected') {
    return {
      noticeKind: 'blocked',
      noticeTitle: 'Vendor Registration Rejected',
      noticeDetail: 'Contact SCI support for review details.'
    };
  }
  if (snapshot.blockReason === 'LicenseRequired') {
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

  const actStatus = compactStatus(snapshot.activationStatus);
  const licStatus = compactStatus(snapshot.licenseStatus);

  if (licStatus === 'trial' && actStatus === 'pendingconsoleverification') {
    return {
      noticeKind: 'pending',
      noticeTitle: 'Account Pending Verification',
      noticeDetail: ''
    };
  }
  if (licStatus === 'trial' && actStatus === 'active') {
    const days = snapshot.daysRemaining;
    return {
      noticeKind: 'trial',
      noticeTitle: 'Trial Plan Active',
      noticeDetail: days === null ? 'Trial access enabled' : `· ${days} Days Remaining`
    };
  }
  return {
    noticeKind: 'active',
    noticeTitle: '',
    noticeDetail: ''
  };
}

function authContextMessage(snapshot: Omit<VendorLicenseRuntimeSnapshot, 'message'>): string {
  if (snapshot.offline) {
    return OFFLINE_NOTICE;
  }
  if (snapshot.blockReason === 'AccountSuspended') {
    return 'Account Suspended';
  }
  if (snapshot.blockReason === 'VerificationRejected') {
    return 'Vendor Registration Rejected';
  }
  if (snapshot.blockReason === 'LicenseRequired') {
    return 'License Required';
  }

  const act = compactStatus(snapshot.activationStatus);
  const lic = compactStatus(snapshot.licenseStatus);

  if (lic === 'trial' && act === 'pendingconsoleverification') {
    return 'Account Pending Verification';
  }
  if (lic === 'trial' && act === 'active') {
    const days = snapshot.daysRemaining ?? 3;
    return `Trial Plan Active · ${days} Days Remaining`;
  }
  return '';
}

function createRuntimeSnapshot(
  vendorId: string,
  license: Row,
  vendor: Row,
  plan: Row,
  options: { offline: boolean; source: 'firestore' | 'local' }
): VendorLicenseRuntimeSnapshot {
  const planCode = upper(plan.planCode || license.planCode || vendor.planCode, DEFAULT_PLAN);
  const licenseStatus = text(license.licenseStatus || vendor.licenseStatus, 'Trial');
  const activationStatus = text(license.activationStatus || vendor.activationStatus, 'PendingConsoleVerification');
  const accountStatus = text(vendor.accountStatus || license.accountStatus, 'Trial');
  const verificationStatus = text(vendor.verificationStatus || license.verificationStatus || plan.verificationStatus, 'Pending');

  const trialStartedAt = toIso(license.trialStartedAt || vendor.trialStartedAt || plan.trialStartedAt);
  const trialExpiresAt = toIso(license.trialExpiresAt || license.expiresAt || vendor.trialExpiresAt || plan.trialExpiresAt);

  const defaultFeatureFlags = DEFAULT_PLAN_FEATURE_FLAGS[planCode as PlanCode] || DEFAULT_PLAN_FEATURE_FLAGS[DEFAULT_PLAN as PlanCode];
  const defaultLimits = DEFAULT_PLAN_LIMITS[planCode as PlanCode] || DEFAULT_PLAN_LIMITS[DEFAULT_PLAN as PlanCode];

  const featureFlags = {
    ...defaultFeatureFlags,
    ...featureFlagsFrom(vendor.featureFlags),
    ...featureFlagsFrom(plan.featureFlags),
    ...featureFlagsFrom(license.featureFlags)
  };

  const limits = {
    maxBranches: numberValue(plan.maxBranches ?? license.maxBranches ?? vendor.maxBranches, defaultLimits.maxBranches),
    maxWarehouses: numberValue(plan.maxWarehouses ?? license.maxWarehouses ?? vendor.maxWarehouses, defaultLimits.maxWarehouses),
    maxTerminals: numberValue(plan.maxTerminals ?? license.maxTerminals ?? vendor.maxTerminals, defaultLimits.maxTerminals),
    maxStaff: numberValue(plan.maxStaff ?? license.maxStaff ?? vendor.maxStaff, defaultLimits.maxStaff),
    maxProducts: numberValue(plan.maxProducts ?? license.maxProducts ?? vendor.maxProducts, defaultLimits.maxProducts)
  };

  const actStatus = compactStatus(activationStatus);
  const licStatus = compactStatus(licenseStatus);
  const accStatus = compactStatus(accountStatus);
  const verStatus = compactStatus(verificationStatus);

  // If Firestore is partially hydrated (e.g. immediately after activation write), avoid making a decision.
  const licenseStatusKnown = !!(license.licenseStatus || vendor.licenseStatus || plan.planCode);

  const suspended = [accStatus, licStatus, actStatus].includes('suspended');
  const rejected = [verStatus, accStatus, licStatus, actStatus].includes('rejected');
  const expired = licStatus === 'expired' || isExpiredTrial(licenseStatus, trialExpiresAt);

  const activeLicense = actStatus === 'active' && ['active', 'trial'].includes(licStatus);
  const pendingTrial = actStatus === 'pendingconsoleverification' && licStatus === 'trial';

  const allowed =
    licenseStatusKnown &&
    !suspended &&
    !rejected &&
    !expired &&
    (activeLicense || pendingTrial || options.offline);

  const licenseMode = normalizeLicenseMode(licenseStatus, planCode);
  const daysRem = daysRemaining(trialExpiresAt);

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
    verificationStatus,
    accountStatus,
    trialStartedAt,
    trialExpiresAt,
    featureFlags,
    ...limits, // maxBranches, maxWarehouses, maxTerminals, maxStaff, maxProducts
    allowed,
    licenseStatusKnown,
    licenseMode,
    daysRemaining: daysRem,
    offline: options.offline,
    source: options.source,
    blockReason,
    updatedAt: new Date().toISOString()
  };

  const notice = makeNotice(base);
  const tempSnapshot = { ...base, ...notice };
  const message = authContextMessage(tempSnapshot);

  // Development logs as requested
  console.log('[vendorLicenseRuntimeService] Snapshot Evaluation:', {
    vendorId,
    verificationStatus: tempSnapshot.verificationStatus,
    licenseStatus: tempSnapshot.licenseStatus,
    planCode: tempSnapshot.planCode,
    posAccess: tempSnapshot.allowed,
    finalDecision: tempSnapshot.allowed ? 'allowed' : `blocked: ${tempSnapshot.blockReason || 'unknown reason'}`,
    isKnown: licenseStatusKnown
  });

  return {
    ...tempSnapshot,
    message
  };
}

function saveRuntimeSnapshot(snapshot: VendorLicenseRuntimeSnapshot): void {
  if (!storageAvailable()) return;
  try {
    localStorage.setItem(cacheKey(snapshot.vendorId), JSON.stringify(snapshot));
  } catch {
    // Cache is best-effort.
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
    const offline = createRuntimeSnapshot(
      vendorId,
      cached as unknown as Row,
      cached as unknown as Row,
      cached as unknown as Row,
      { offline: true, source: 'local' }
    );

    return {
      ...offline,
      licenseMode: cached.licenseMode,
      planCode: cached.planCode || offline.planCode,
      licenseStatusKnown: cached.licenseStatusKnown,
      message: OFFLINE_NOTICE
    };
  }

  return {
    ...createRuntimeSnapshot(vendorId, {}, {}, {}, { offline: true, source: 'local' }),
    licenseStatusKnown: false
  };
}

export function subscribeToVendorRuntimeLicense(
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
  let planData: Row = {};

  const emit = (offline = false) => {
    const snapshot = offline
      ? fallbackOfflineSnapshot(cleanVendorId)
      : createRuntimeSnapshot(cleanVendorId, licenseData, vendorData, planData, { offline: false, source: 'firestore' });
    if (!offline) saveRuntimeSnapshot(snapshot);
    callback(snapshot);
  };

  const licenseUnsubscribe = onSnapshot(
    doc(db, FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId),
    (snapshot) => {
      licenseData = snapshot.exists() ? snapshot.data() as Row : {};
      emit(false);
    },
    () => emit(true)
  );

  const vendorUnsubscribe = onSnapshot(
    doc(db, FIRESTORE_COLLECTIONS.vendors, cleanVendorId),
    (snapshot) => {
      vendorData = snapshot.exists() ? snapshot.data() as Row : {};
      emit(false);
    },
    () => emit(true)
  );

  const planUnsubscribe = onSnapshot(
    doc(db, FIRESTORE_COLLECTIONS.vendorPlans, cleanVendorId),
    (snapshot) => {
      planData = snapshot.exists() ? snapshot.data() as Row : {};
      emit(false);
    },
    () => emit(true)
  );

  return () => {
    licenseUnsubscribe();
    vendorUnsubscribe();
    planUnsubscribe();
  };
}

export function subscribeToVendorLicense(
  vendorId: string,
  callback: (snapshot: VendorLicenseRuntimeSnapshot) => void
): Unsubscribe {
  return subscribeToVendorRuntimeLicense(vendorId, callback);
}

function authLicenseStatus(snapshot: VendorLicenseRuntimeSnapshot): PosVendorAuthContext['licenseStatus'] {
  if (snapshot.blockReason === 'AccountSuspended') return 'Suspended';
  if (snapshot.blockReason === 'VerificationRejected') return 'Rejected';
  if (snapshot.blockReason === 'LicenseRequired') return 'Expired';
  if (compactStatus(snapshot.licenseStatus) === 'active') return 'Active';
  if (compactStatus(snapshot.licenseStatus) === 'trial') return 'Trial';
  return 'Demo';
}

function posPrototypeStage(context: PosVendorAuthContext): PosAuthStage {
  if (!context.vendorId || !context.vendorName) return 'staffAccessRequired';
  const statusValues = [
    context.licenseStatus,
    context.activationStatus,
    context.accountStatus,
    context.verificationStatus
  ].map((value) => String(value || '').toLowerCase());

  if (
    context.licenseStatus === 'Expired' ||
    statusValues.some((value) => value === 'suspended' || value === 'rejected')
  ) {
    return 'staffAccessRequired';
  }

  if (!context.staffId || !context.staffRole) return 'staffAccessRequired';
  return 'posReady';
}

export function mergeVendorLicenseIntoAuthContext(
  context: PosVendorAuthContext,
  snapshot: VendorLicenseRuntimeSnapshot
): PosVendorAuthContext {
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
    featureFlags: snapshot.featureFlags as Record<string, boolean>,
    maxBranches: snapshot.maxBranches,
    maxWarehouses: snapshot.maxWarehouses,
    maxTerminals: snapshot.maxTerminals,
    maxStaff: snapshot.maxStaff,
    maxProducts: snapshot.maxProducts,
    demoExpiresAt: snapshot.trialExpiresAt || context.demoExpiresAt,
    message: snapshot.message
  };

  nextContext.stage = snapshot.allowed
    ? (context.googleUid && context.googleEmail ? resolveNextAuthStage(nextContext) : posPrototypeStage(nextContext))
    : 'licenseRequired';
  return nextContext;
}
