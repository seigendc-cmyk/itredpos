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
  DEFAULT_PLAN_LIMITS
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

  const planRef = doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, vendorId);
  batch.update(planRef, {
    planCode,
    planId: planCode,
    planName,
    featureFlags,
    limits,
    updatedAt: now
  });

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  batch.update(licenseRef, {
    planCode,
    planId: planCode,
    planName,
    featureFlags,
    limits,
    activationStatus: 'Active',
    licenseStatus: 'Active',
    activatedAt: now,
    updatedAt: now
  });

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
