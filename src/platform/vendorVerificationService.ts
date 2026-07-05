import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import {
  FIRESTORE_COLLECTIONS,
  DEFAULT_PLAN_FEATURE_FLAGS,
  DEFAULT_PLAN_LIMITS
} from '../shared/backend';
import type {
  VendorRegistrationRecord,
  VendorLicenseRecord,
  VendorPlanRecord,
  VendorAuditLogRecord,
  PlanCode,
  LicenseStatus,
  ActivationStatus
} from '../shared/backend';

const PLAN_NAMES: Record<PlanCode, string> = {
  DEMO: 'Demo Trial',
  STARTER: 'Starter',
  STANDARD: 'Standard',
  PRO: 'Pro',
  ENTERPRISE: 'Enterprise'
};

function checkFirebaseReady(): void {
  if (!firebaseReady || !db) {
    throw new Error('Firebase client is not initialized or database is unavailable.');
  }
}

export async function listVendorRegistrations(): Promise<VendorRegistrationRecord[]> {
  checkFirebaseReady();
  const querySnapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorRegistrations));
  return querySnapshot.docs.map(doc => doc.data() as VendorRegistrationRecord);
}

export async function listPendingVendorRegistrations(): Promise<VendorRegistrationRecord[]> {
  checkFirebaseReady();
  const q = query(
    collection(db!, FIRESTORE_COLLECTIONS.vendorRegistrations),
    where('verificationStatus', '==', 'Pending')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data() as VendorRegistrationRecord);
}

export async function verifyVendor(vendorId: string, reviewedBy: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const batch = writeBatch(db!);

  const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, vendorId);
  batch.update(vendorRef, {
    verificationStatus: 'Verified',
    accountStatus: 'Active',
    verifiedAt: now,
    verifiedBy: reviewedBy,
    updatedAt: now
  });

  const registrationRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId);
  batch.update(registrationRef, {
    verificationStatus: 'Verified',
    reviewedAt: now,
    reviewedBy: reviewedBy,
    updatedAt: now
  });

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  batch.update(licenseRef, {
    activationStatus: 'Active',
    licenseStatus: 'Trial',
    updatedAt: now
  });

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'VerifyVendor',
    message: 'Vendor verified successfully',
    performedBy: reviewedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

export async function rejectVendor(vendorId: string, reviewedBy: string, reason: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const batch = writeBatch(db!);

  const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, vendorId);
  batch.update(vendorRef, {
    verificationStatus: 'Rejected',
    accountStatus: 'Rejected',
    updatedAt: now
  });

  const registrationRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId);
  batch.update(registrationRef, {
    verificationStatus: 'Rejected',
    reviewReason: reason,
    reviewedAt: now,
    reviewedBy: reviewedBy,
    updatedAt: now
  });

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  batch.update(licenseRef, {
    activationStatus: 'Rejected',
    licenseStatus: 'Rejected',
    updatedAt: now
  });

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'RejectVendor',
    message: `Reason: ${reason}`,
    performedBy: reviewedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

export async function suspendVendor(vendorId: string, reviewedBy: string, reason: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const batch = writeBatch(db!);

  const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, vendorId);
  batch.update(vendorRef, {
    accountStatus: 'Suspended',
    updatedAt: now
  });

  const registrationRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId);
  batch.update(registrationRef, {
    accountStatus: 'Suspended',
    updatedAt: now
  });

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  batch.update(licenseRef, {
    activationStatus: 'Suspended',
    licenseStatus: 'Suspended',
    updatedAt: now
  });

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'SuspendVendor',
    message: `Reason: ${reason}`,
    performedBy: reviewedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

export async function assignVendorPlan(vendorId: string, planCode: PlanCode, reviewedBy: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const batch = writeBatch(db!);

  const planName = PLAN_NAMES[planCode] || 'Custom Plan';
  const featureFlags = DEFAULT_PLAN_FEATURE_FLAGS[planCode];
  const limits = DEFAULT_PLAN_LIMITS[planCode];

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
    performedBy: reviewedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}

export async function extendVendorTrial(vendorId: string, days: number, reviewedBy: string): Promise<void> {
  checkFirebaseReady();
  const now = new Date().toISOString();

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId);
  const licenseSnap = await getDoc(licenseRef);

  let baseDate = new Date();
  if (licenseSnap.exists()) {
    const data = licenseSnap.data() as VendorLicenseRecord;
    if (data.trialExpiresAt) {
      const parsed = Date.parse(data.trialExpiresAt);
      if (Number.isFinite(parsed)) {
        baseDate = new Date(parsed);
      }
    }
  }

  const newTrialExpiresAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const batch = writeBatch(db!);

  batch.update(licenseRef, {
    trialExpiresAt: newTrialExpiresAt,
    expiresAt: newTrialExpiresAt,
    licenseStatus: 'Trial',
    activationStatus: 'Active',
    updatedAt: now
  });

  const auditLogRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLogDoc: VendorAuditLogRecord = {
    auditLogId: auditLogRef.id,
    vendorId,
    eventType: 'ExtendTrial',
    message: `Trial extended by ${days} days`,
    performedBy: reviewedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditLogRef, auditLogDoc);

  await batch.commit();
}
