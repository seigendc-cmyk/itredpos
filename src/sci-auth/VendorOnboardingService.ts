import { doc, getDoc, writeBatch, type Firestore } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { auth, db, firebaseInitStatus } from '../pos-new/firebase/firebaseApp';
import { firebaseEnvStatus } from '../pos-new/firebase/firebaseConfig';
import { isFirebaseSandboxWriteEnabled } from '../pos-new/repositories/repositoryConfig';
import type { RepositoryDataSourceMode } from '../pos-new/repositories/repositoryTypes';
import {
  createDefaultDemoLicense,
  createDefaultDemoPlan,
  createInitialVendorLicenseLifecycle,
  DEFAULT_VENDOR_TRIAL_DAYS
} from '../shared/backend';

export type VendorProvisioningErrorCode =
  | 'AUTH_NOT_READY'
  | 'AUTH_UID_MISMATCH'
  | 'FIREBASE_NOT_CONFIGURED'
  | 'FIRESTORE_PERMISSION_DENIED'
  | 'EXISTING_VENDOR_CONFLICT'
  | 'EXISTING_VENDOR_USER_CONFLICT'
  | 'PROVISIONING_PARTIAL_STATE'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_PROVISIONING_ERROR';

export interface VendorOnboardingDraft {
  businessName: string;
  tradingName: string;
  businessType: string;
  currency: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  country: string;
  city: string;
  suburb: string;
  physicalAddress: string;
}

export interface VendorProvisioningResult {
  vendorId: string;
  uid: string;
  authenticatedEmail: string;
  phase1: 'created' | 'existing';
  phase2: 'created' | 'repaired' | 'existing';
}

export class VendorProvisioningError extends Error {
  constructor(public readonly code: VendorProvisioningErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'VendorProvisioningError';
  }
}

type ExistingBootstrapState = {
  vendor?: Record<string, unknown>;
  vendorUser?: Record<string, unknown>;
};

const text = (value: unknown): string => String(value ?? '').trim();

export function expectedVendorId(uid: string): string {
  return `vendor-${uid}`;
}

export function resolveOnboardingWriteMode(sandboxWritesEnabled: boolean): RepositoryDataSourceMode {
  // Vendor bootstrap is a dedicated Firebase control-plane operation. It does
  // not inherit the POS operational repository mode, but it must be explicitly
  // write-enabled and never falls back to local persistence.
  return sandboxWritesEnabled ? 'FirestoreReadWrite' : 'FirestoreReadOnly';
}

export function assertVendorOnboardingAuthority(input: {
  currentUser: Pick<User, 'uid' | 'email'> | null;
  expectedUid?: string;
  firebaseConfigured: boolean;
  firestoreAvailable: boolean;
  mode: RepositoryDataSourceMode;
}): { uid: string; email: string; vendorId: string } {
  if (!input.firebaseConfigured || !input.firestoreAvailable) {
    throw new VendorProvisioningError('FIREBASE_NOT_CONFIGURED', 'Firebase is not configured for vendor provisioning.');
  }
  if (!input.currentUser?.uid || !input.currentUser.email) {
    throw new VendorProvisioningError('AUTH_NOT_READY', 'Firebase authentication is still resolving. Please sign in again.');
  }
  if (input.expectedUid && input.expectedUid !== input.currentUser.uid) {
    throw new VendorProvisioningError('AUTH_UID_MISMATCH', 'The authenticated account changed before onboarding could finish.');
  }
  if (input.mode !== 'FirestoreReadWrite') {
    throw new VendorProvisioningError('FIREBASE_NOT_CONFIGURED', 'Vendor provisioning is not enabled in the current Firestore mode.');
  }
  return {
    uid: input.currentUser.uid,
    email: input.currentUser.email.toLowerCase(),
    vendorId: expectedVendorId(input.currentUser.uid)
  };
}

export function classifyExistingBootstrap(
  state: ExistingBootstrapState,
  authority: { uid: string; vendorId: string }
): 'empty' | 'correct' {
  const vendorExists = Boolean(state.vendor);
  const userExists = Boolean(state.vendorUser);
  if (vendorExists && (text(state.vendor?.vendorId) !== authority.vendorId || text(state.vendor?.ownerUid) !== authority.uid)) {
    throw new VendorProvisioningError('EXISTING_VENDOR_CONFLICT', 'The expected vendor record belongs to a different identity.');
  }
  if (userExists && (text(state.vendorUser?.uid) !== authority.uid || text(state.vendorUser?.vendorId) !== authority.vendorId)) {
    throw new VendorProvisioningError('EXISTING_VENDOR_USER_CONFLICT', 'The authenticated user is linked to a different vendor.');
  }
  if (vendorExists && (
    text(state.vendor?.status) !== 'Active'
    || text(state.vendor?.planCode) !== 'DEMO'
    || text(state.vendor?.licenseStatus) !== 'Trial'
    || text(state.vendor?.activationStatus) !== 'PendingConsoleVerification'
    || text(state.vendor?.verificationStatus) !== 'Pending'
    || text(state.vendor?.accountStatus) !== 'Trial'
  )) {
    throw new VendorProvisioningError('EXISTING_VENDOR_CONFLICT', 'The existing vendor bootstrap does not match the onboarding contract.');
  }
  if (userExists && (text(state.vendorUser?.role) !== 'Owner' || text(state.vendorUser?.status) !== 'active')) {
    throw new VendorProvisioningError('EXISTING_VENDOR_USER_CONFLICT', 'The existing vendor membership is not an active owner bootstrap.');
  }
  if (vendorExists !== userExists) {
    throw new VendorProvisioningError('PROVISIONING_PARTIAL_STATE', 'Vendor provisioning is incomplete and requires recovery.');
  }
  return vendorExists ? 'correct' : 'empty';
}

function provisioningDocuments(draft: VendorOnboardingDraft, authority: { uid: string; email: string; vendorId: string }) {
  const now = new Date().toISOString();
  const businessName = draft.businessName.trim();
  const ownerName = draft.ownerName.trim();
  const ownerEmail = draft.ownerEmail.trim().toLowerCase();
  const vendorId = authority.vendorId;
  const branchId = `${vendorId}_main_branch`;
  const warehouseId = `${vendorId}_main_warehouse`;
  const staffId = `${vendorId}_owner`;
  const terminalId = `${vendorId}_main_terminal`;
  const licenseId = vendorId;
  const nowDate = new Date(now);
  const lifecycle = createInitialVendorLicenseLifecycle(nowDate);
  const vendorLicense = {
    ...createDefaultDemoLicense(vendorId, DEFAULT_VENDOR_TRIAL_DAYS, nowDate),
    branchId,
    terminalId,
    verificationStatus: lifecycle.verificationStatus,
    accountStatus: lifecycle.accountStatus,
    status: 'Active'
  };
  const vendorPlan = createDefaultDemoPlan(vendorId, nowDate);
  const common = {
    phone: draft.phone.trim(), whatsapp: draft.whatsapp.trim(), country: draft.country.trim(), city: draft.city.trim(),
    suburb: draft.suburb.trim(), address: draft.physicalAddress.trim()
  };
  return {
    ids: { vendorId, branchId, warehouseId, staffId, terminalId, licenseId },
    vendor: {
      vendorId, ownerUid: authority.uid, ownerEmail, ownerName, businessName,
      tradingName: draft.tradingName.trim() || businessName, businessType: draft.businessType.trim(),
      currency: draft.currency.trim() || 'USD', phone: common.phone, whatsapp: common.whatsapp,
      country: common.country, city: common.city, suburb: common.suburb, physicalAddress: common.address,
      status: 'Active', mode: 'Demo', ...lifecycle, createdAt: now, updatedAt: now
    },
    vendorUser: {
      uid: authority.uid, vendorId, email: authority.email, displayName: ownerName, role: 'Owner', status: 'active',
      permissions: ['*'], createdAt: now, updatedAt: now
    },
    phase2: {
      branches: { branchId, vendorId, name: 'Main Branch', branchName: 'Main Branch', ...common, email: ownerEmail, status: 'Active', createdAt: now, updatedAt: now },
      warehouses: { warehouseId, vendorId, branchId, name: 'Main Warehouse', warehouseName: 'Main Warehouse', ...common, email: ownerEmail, status: 'Active', createdAt: now, updatedAt: now },
      staff: {
        id: staffId, staffId, vendorId, branchId, name: ownerName, displayName: ownerName, email: ownerEmail,
        staffCode: 'OWNER', roleId: 'owner', roleName: 'Owner', role: 'Owner', permissions: ['*'], pin: '040369',
        pinCode: '040369', status: 'Active', ownerUid: authority.uid, assignedTerminalIds: [terminalId],
        createdBy: authority.uid, updatedBy: authority.uid, createdAt: now, updatedAt: now
      },
      pos_terminals: { terminalId, vendorId, branchId, warehouseId, name: 'Main POS Terminal', terminalName: 'Main POS Terminal', type: 'POS', status: 'Active', createdAt: now, updatedAt: now },
      vendorLicenses: vendorLicense,
      vendorPlans: vendorPlan,
      vendor_settings: {
        vendorId, vatEnabled: false, vatRegistered: false, vatNumber: '', defaultVatRate: 0, pricesIncludeVat: true,
        outputTaxAccountId: '', inputTaxAccountId: '', exemptTaxCode: 'EXEMPT', zeroRatedTaxCode: 'ZERO',
        preventNegativeStock: true, updatedAt: now, updatedBy: authority.uid, createdAt: now
      }
    }
  };
}

function categorizeFirestoreError(error: unknown): VendorProvisioningError {
  if (error instanceof VendorProvisioningError) return error;
  const code = text((error as { code?: unknown })?.code).toLowerCase();
  if (code.includes('permission-denied')) return new VendorProvisioningError('FIRESTORE_PERMISSION_DENIED', 'Firestore denied vendor provisioning.', error);
  if (code.includes('unavailable') || code.includes('network') || code.includes('deadline')) return new VendorProvisioningError('NETWORK_ERROR', 'The network interrupted vendor provisioning.', error);
  return new VendorProvisioningError('UNKNOWN_PROVISIONING_ERROR', 'Vendor provisioning failed unexpectedly.', error);
}

async function loadBootstrapState(store: Firestore, uid: string, vendorId: string): Promise<ExistingBootstrapState> {
  const [vendorSnapshot, userSnapshot] = await Promise.all([
    getDoc(doc(store, 'vendors', vendorId)),
    getDoc(doc(store, 'vendorUsers', uid))
  ]);
  return {
    vendor: vendorSnapshot.exists() ? vendorSnapshot.data() : undefined,
    vendorUser: userSnapshot.exists() ? userSnapshot.data() : undefined
  };
}

export async function provisionAuthenticatedVendor(draft: VendorOnboardingDraft, expectedUid?: string): Promise<VendorProvisioningResult> {
  const mode = resolveOnboardingWriteMode(isFirebaseSandboxWriteEnabled());
  const authority = assertVendorOnboardingAuthority({
    currentUser: auth?.currentUser || null,
    expectedUid,
    firebaseConfigured: firebaseInitStatus.configured,
    firestoreAvailable: Boolean(db),
    mode
  });
  const store = db!;
  const documents = provisioningDocuments(draft, authority);
  let operationPhase: 'preflight' | 'phase-1' | 'phase-2' = 'preflight';

  if (import.meta.env.DEV) {
    console.info('[VendorOnboarding] authority', {
      projectId: firebaseEnvStatus.projectId,
      authenticated: Boolean(auth?.currentUser),
      authUid: auth?.currentUser?.uid || null,
      resolvedUid: authority.uid,
      intendedVendorId: authority.vendorId,
      mode
    });
  }

  try {
    const existing = classifyExistingBootstrap(await loadBootstrapState(store, authority.uid, authority.vendorId), authority);
    if (existing === 'empty') {
      operationPhase = 'phase-1';
      const phase1 = writeBatch(store);
      phase1.set(doc(store, 'vendors', authority.vendorId), documents.vendor);
      phase1.set(doc(store, 'vendorUsers', authority.uid), documents.vendorUser);
      await phase1.commit();
    }

    operationPhase = 'phase-2';
    const phase2Entries = [
      ['branches', documents.ids.branchId, 'branchId', documents.phase2.branches],
      ['warehouses', documents.ids.warehouseId, 'warehouseId', documents.phase2.warehouses],
      ['staff', documents.ids.staffId, 'staffId', documents.phase2.staff],
      ['pos_terminals', documents.ids.terminalId, 'terminalId', documents.phase2.pos_terminals],
      ['vendorLicenses', documents.ids.licenseId, 'licenseId', documents.phase2.vendorLicenses],
      ['vendorPlans', documents.ids.vendorId, 'vendorId', documents.phase2.vendorPlans],
      ['vendor_settings', documents.ids.vendorId, 'vendorId', documents.phase2.vendor_settings]
    ] as const;
    const snapshotResults = await Promise.allSettled(phase2Entries.map(([collection, id]) => getDoc(doc(store, collection, id))));
    const missing = phase2Entries.filter((_, index) => {
      const result = snapshotResults[index];
      return result.status === 'rejected' || !result.value.exists();
    });
    snapshotResults.forEach((result, index) => {
      if (result.status === 'rejected') return;
      const snapshot = result.value;
      const [, expectedId, idField] = phase2Entries[index];
      if (snapshot.exists() && (text(snapshot.data().vendorId) !== authority.vendorId || text(snapshot.data()[idField]) !== expectedId)) {
        throw new VendorProvisioningError('EXISTING_VENDOR_CONFLICT', 'A provisioning record belongs to another vendor.');
      }
    });
    if (missing.length > 0) {
      const phase2 = writeBatch(store);
      missing.forEach(([collection, id, , data]) => phase2.set(doc(store, collection, id), data));
      await phase2.commit();
    }
    return {
      vendorId: authority.vendorId,
      uid: authority.uid,
      authenticatedEmail: authority.email,
      phase1: existing === 'empty' ? 'created' : 'existing',
      phase2: missing.length === 0 ? 'existing' : missing.length === phase2Entries.length ? 'created' : 'repaired'
    };
  } catch (error) {
    const categorized = categorizeFirestoreError(error);
    if (import.meta.env.DEV) {
      console.error('[VendorOnboarding] provisioning failed', {
        projectId: firebaseEnvStatus.projectId,
        authUid: auth?.currentUser?.uid || null,
        resolvedUid: authority.uid,
        intendedVendorId: authority.vendorId,
        phase: operationPhase,
        code: categorized.code,
        firebaseCode: text((error as { code?: unknown })?.code) || null
      });
    }
    throw categorized;
  }
}

export function userMessageForProvisioningError(error: unknown): string {
  const code = error instanceof VendorProvisioningError ? error.code : 'UNKNOWN_PROVISIONING_ERROR';
  if (code === 'AUTH_NOT_READY') return 'Your Google sign-in is still loading. Please sign in again.';
  if (code === 'AUTH_UID_MISMATCH') return 'Your signed-in account changed. Please restart onboarding.';
  if (code === 'FIREBASE_NOT_CONFIGURED') return 'Vendor onboarding is unavailable in the current app configuration.';
  if (code === 'FIRESTORE_PERMISSION_DENIED') return 'Vendor setup was denied. Please contact support with the permission error.';
  if (code.includes('CONFLICT') || code === 'PROVISIONING_PARTIAL_STATE') return 'An existing vendor setup needs support review before you can continue.';
  if (code === 'NETWORK_ERROR') return 'The network interrupted setup. Please reconnect and try again.';
  return 'Vendor provisioning failed. Please try again.';
}
