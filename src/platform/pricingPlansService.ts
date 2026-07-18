import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import {
  FIRESTORE_COLLECTIONS,
  createDefaultPricingPlans,
  DEFAULT_PLAN_FEATURE_FLAGS,
  DEFAULT_PLAN_LIMITS,
  createDefaultDemoLicense,
  createDefaultDemoPlan,
  createInitialVendorLicenseLifecycle
} from '../shared/backend';
import type {
  PricingPlanRecord,
  VendorPlanRecord,
  VendorLicenseRecord,
  VendorAuditLogRecord,
  PlanCode
} from '../shared/backend';

function checkFirebaseReady(): void {
  if (!firebaseReady || !db) {
    throw new Error('Firebase client is not initialized or database is unavailable.');
  }
}

export async function listPricingPlans(): Promise<PricingPlanRecord[]> {
  checkFirebaseReady();
  const querySnapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.plans));
  return querySnapshot.docs.map(doc => doc.data() as PricingPlanRecord);
}

export async function seedDefaultPricingPlansIfEmpty(): Promise<void> {
  checkFirebaseReady();
  const querySnapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.plans));
  if (querySnapshot.empty) {
    const batch = writeBatch(db!);
    const defaults = createDefaultPricingPlans();
    defaults.forEach(plan => {
      batch.set(doc(db!, FIRESTORE_COLLECTIONS.plans, plan.planCode), plan);
    });
    await batch.commit();
  }
}

export async function createPricingPlan(plan: PricingPlanRecord): Promise<void> {
  checkFirebaseReady();
  const planRef = doc(db!, FIRESTORE_COLLECTIONS.plans, plan.planCode);
  await setDoc(planRef, {
    ...plan,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

export async function updatePricingPlan(planCode: PlanCode, patch: Partial<PricingPlanRecord>): Promise<void> {
  checkFirebaseReady();
  const planRef = doc(db!, FIRESTORE_COLLECTIONS.plans, planCode);
  await updateDoc(planRef, {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}

export async function activatePricingPlan(planCode: PlanCode): Promise<void> {
  checkFirebaseReady();
  const planRef = doc(db!, FIRESTORE_COLLECTIONS.plans, planCode);
  await updateDoc(planRef, {
    status: 'Active',
    updatedAt: new Date().toISOString()
  });
}

export async function deactivatePricingPlan(planCode: PlanCode): Promise<void> {
  checkFirebaseReady();
  const planRef = doc(db!, FIRESTORE_COLLECTIONS.plans, planCode);
  await updateDoc(planRef, {
    status: 'Inactive',
    updatedAt: new Date().toISOString()
  });
}

export function buildLifecycleSafePlanAssignment(input: {
  planCode: PlanCode;
  planName: string;
  featureFlags: PricingPlanRecord['featureFlags'];
  limits: PricingPlanRecord['limits'];
  updatedAt: string;
}) {
  return {
    planCode: input.planCode,
    planId: input.planCode,
    planName: input.planName,
    featureFlags: input.featureFlags,
    limits: input.limits,
    updatedAt: input.updatedAt
  };
}

export async function assignPlanToVendor(vendorId: string, planCode: PlanCode, assignedBy: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  // Try to retrieve plan limits and features from plans collection
  let planName = planCode === 'DEMO' ? 'Demo Trial' : `${planCode.charAt(0) + planCode.slice(1).toLowerCase()}`;
  let featureFlags = DEFAULT_PLAN_FEATURE_FLAGS[planCode];
  let limits = DEFAULT_PLAN_LIMITS[planCode];

  try {
    const planRef = doc(db!, FIRESTORE_COLLECTIONS.plans, planCode);
    const planSnap = await getDoc(planRef);
    if (planSnap.exists()) {
      const dbPlan = planSnap.data() as PricingPlanRecord;
      planName = dbPlan.planName;
      if (dbPlan.featureFlags) featureFlags = dbPlan.featureFlags;
      if (dbPlan.limits) limits = dbPlan.limits;
    }
  } catch (err) {
    console.warn('Failed to fetch plan config from db, using defaults:', err);
  }

  const batch = writeBatch(db!);
  const assignment = buildLifecycleSafePlanAssignment({ planCode, planName, featureFlags, limits, updatedAt: now });

  const planRef = doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, vendorId);
  batch.update(planRef, assignment);

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  batch.update(licenseRef, assignment);

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'AssignPlan',
    message: `Plan assigned: ${planCode}`,
    performedBy: assignedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

type Row = Record<string, unknown>;

export type LegacyDemoRepairResult = {
  vendorId: string;
  eligible: boolean;
  applied: boolean;
  reason: string;
  current: { vendor: Row; vendorLicense?: Row; vendorPlan?: Row; legacyLicense?: Row };
  proposed?: { vendor: Row; vendorLicense: object; vendorPlan: object; legacyLicense?: object };
};

const clean = (value: unknown): string => String(value ?? '').trim();
const blockedLifecycle = (row: Row | undefined): boolean => {
  if (!row) return false;
  return [row.status, row.accountStatus, row.licenseStatus, row.activationStatus, row.verificationStatus]
    .map((value) => clean(value).toLowerCase())
    .some((value) => ['active', 'trial', 'demo', 'pending', 'pendingconsoleverification', ''].includes(value) === false);
};

export function isExactLegacyDemoBootstrap(input: {
  vendor?: Row;
  vendorLicense?: Row;
  vendorPlan?: Row;
  legacyLicense?: Row;
}): boolean {
  const vendor = input.vendor;
  if (!vendor
    || clean(vendor.planCode) !== 'DEMO'
    || clean(vendor.licenseStatus) !== 'DEMO'
    || clean(vendor.status) !== 'Active'
    || blockedLifecycle(vendor)) return false;
  for (const row of [input.vendorLicense, input.vendorPlan, input.legacyLicense]) {
    if (!row) continue;
    if (clean(row.planCode) && clean(row.planCode) !== 'DEMO') return false;
    if (clean(row.licenseStatus) && clean(row.licenseStatus) !== 'DEMO') return false;
    if (blockedLifecycle(row)) return false;
  }
  if (input.vendorLicense && clean(input.vendorLicense.licenseId) && clean(input.vendorLicense.licenseId) !== clean(vendor.vendorId)) return false;
  return true;
}

export async function repairLegacyDemoLicense(
  vendorId: string,
  performedBy: string,
  dryRun = true
): Promise<LegacyDemoRepairResult> {
  checkFirebaseReady();
  const cleanVendorId = vendorId.trim();
  if (!cleanVendorId) throw new Error('Vendor ID is required.');
  const legacyLicenseId = `${cleanVendorId}_demo_license`;
  const [vendorSnap, licenseSnap, planSnap, legacySnap] = await Promise.all([
    getDoc(doc(db!, FIRESTORE_COLLECTIONS.vendors, cleanVendorId)),
    getDoc(doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId)),
    getDoc(doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, cleanVendorId)),
    getDoc(doc(db!, 'licenses', legacyLicenseId))
  ]);
  const current = {
    vendor: vendorSnap.exists() ? vendorSnap.data() as Row : {},
    vendorLicense: licenseSnap.exists() ? licenseSnap.data() as Row : undefined,
    vendorPlan: planSnap.exists() ? planSnap.data() as Row : undefined,
    legacyLicense: legacySnap.exists() ? legacySnap.data() as Row : undefined
  };
  if (!vendorSnap.exists()) {
    return { vendorId: cleanVendorId, eligible: false, applied: false, reason: 'Vendor document not found.', current };
  }
  if (!isExactLegacyDemoBootstrap(current)) {
    return {
      vendorId: cleanVendorId,
      eligible: false,
      applied: false,
      reason: 'State is not the exact legacy DEMO bootstrap; paid, active, suspended, rejected, expired, and conflicting records are never repaired.',
      current
    };
  }

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const lifecycle = createInitialVendorLicenseLifecycle(nowDate);
  const vendorPatch: Row = { ...lifecycle, updatedAt: now };
  const vendorLicense = {
    ...createDefaultDemoLicense(cleanVendorId, undefined, nowDate),
    verificationStatus: lifecycle.verificationStatus,
    accountStatus: lifecycle.accountStatus,
    status: 'Active',
    updatedAt: now
  };
  const vendorPlan = createDefaultDemoPlan(cleanVendorId, nowDate);
  const legacyLicense = current.legacyLicense
    ? { ...vendorLicense, licenseId: legacyLicenseId }
    : undefined;
  const proposed = { vendor: vendorPatch, vendorLicense, vendorPlan, legacyLicense };

  if (!dryRun) {
    const batch = writeBatch(db!);
    batch.update(doc(db!, FIRESTORE_COLLECTIONS.vendors, cleanVendorId), vendorPatch);
    batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId), vendorLicense, { merge: true });
    batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, cleanVendorId), vendorPlan, { merge: true });
    if (legacyLicense) batch.set(doc(db!, 'licenses', legacyLicenseId), legacyLicense, { merge: true });
    const auditRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
    batch.set(auditRef, {
      auditLogId: auditRef.id,
      vendorId: cleanVendorId,
      eventType: 'RepairLegacyDemoLicense',
      message: 'Legacy DEMO lifecycle repaired to the canonical pending Trial state.',
      performedBy,
      createdAt: now,
      updatedAt: now
    } satisfies VendorAuditLogRecord);
    await batch.commit();
  }

  return {
    vendorId: cleanVendorId,
    eligible: true,
    applied: !dryRun,
    reason: dryRun ? 'Eligible exact legacy DEMO bootstrap; no writes performed.' : 'Canonical Trial lifecycle applied.',
    current,
    proposed
  };
}
