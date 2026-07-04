import { doc, writeBatch } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseApp';
import { sanitizeDocId } from '../firebase/firestoreIds';
import type { PosVendorAuthContext } from '../auth/posVendorAuthState';
import type { VendorBootstrapProfile } from './vendorBootstrapModel';

const SOURCE = 'POS_ONBOARDING';
const PLAN_CODE = 'DEMO';
const MAIN_BRANCH_ID = 'main-branch';
const MAIN_WAREHOUSE_ID = 'main-warehouse';
const MAIN_TERMINAL_ID = 'TERM-MAIN-001';
const OWNER_STAFF_ID = 'owner-staff';

export type VendorProvisioningSyncStatus = 'Synced' | 'PendingSync';

export interface VendorProvisioningResult {
  vendorId: string;
  syncStatus: VendorProvisioningSyncStatus;
  firestoreWritten: boolean;
  writtenCollections: string[];
  provisionedAt: string;
  error?: string;
}

function clean(value: unknown, fallback = ''): string {
  const text = String(value || '').trim();
  return text || fallback;
}

function addDaysIso(base: Date, days: number): string {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Firebase provisioning error.';
}

function createBusinessIdentity(profile: VendorBootstrapProfile, authContext: PosVendorAuthContext, vendorId: string, now: string) {
  const businessName = clean(profile.businessName, clean(authContext.vendorName, 'Registered Business'));
  const tradingName = clean(profile.tradingName, businessName);
  const ownerName = clean(profile.ownerName, clean(profile.ownerStaffName, 'Owner'));
  const ownerEmail = clean(profile.ownerEmail, clean(authContext.googleEmail));
  const phone = clean(profile.phone);
  const whatsapp = clean(profile.whatsapp);
  const businessType = clean(profile.businessType);
  const industry = clean(profile.industry);
  const country = clean(profile.country, 'Zimbabwe');
  const province = clean(profile.provinceState);
  const city = clean(profile.city);
  const suburb = clean(profile.suburb);
  const address = clean(profile.physicalAddress);

  return {
    vendorId,
    businessName,
    legalName: businessName,
    tradingName,
    ownerName,
    ownerEmail,
    googleEmail: clean(authContext.googleEmail, ownerEmail),
    googleUid: clean(authContext.googleUid),
    phone,
    whatsapp,
    alternatePhone: clean(profile.alternatePhone),
    website: clean(profile.website),
    businessType,
    industry,
    country,
    province,
    city,
    suburb,
    postalCode: clean(profile.postalCode),
    address,
    physicalAddress: address,
    vatRegistered: Boolean(profile.vatRegistered),
    vatNumber: clean(profile.vatNumber),
    taxNumber: clean(profile.taxNumber),
    registrationNumber: clean(profile.registrationNumber),
    verificationStatus: 'Pending',
    accountStatus: 'Trial',
    source: SOURCE,
    planCode: PLAN_CODE,
    licenseStatus: 'Trial',
    activationStatus: 'PendingConsoleVerification',
    defaultBranchId: MAIN_BRANCH_ID,
    defaultWarehouseId: MAIN_WAREHOUSE_ID,
    defaultTerminalId: MAIN_TERMINAL_ID,
    ownerStaffId: OWNER_STAFF_ID,
    createdAt: now,
    updatedAt: now
  };
}

export async function provisionVendorFromBusinessSetup(
  profile: VendorBootstrapProfile,
  authContext: PosVendorAuthContext
): Promise<VendorProvisioningResult> {
  const vendorId = sanitizeDocId(clean(authContext.vendorId, clean(profile.vendorId, `vendor_${Date.now()}`)));
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const trialExpiresAt = addDaysIso(nowDate, 3);
  const business = createBusinessIdentity(profile, authContext, vendorId, now);
  const branchId = `${vendorId}_main_branch`;
  const warehouseId = `${vendorId}_main_warehouse`;
  const staffId = `${vendorId}_owner`;
  const writtenCollections = [
    'vendors',
    'vendorRegistrations',
    'vendorBranches',
    'vendorWarehouses',
    'vendorStaff',
    'vendorLicenses',
    'vendorPlans'
  ];

  if (!firebaseReady || !db) {
    return {
      vendorId,
      syncStatus: 'PendingSync',
      firestoreWritten: false,
      writtenCollections: [],
      provisionedAt: now,
      error: 'Firebase is not ready; vendor registration queued for review sync.'
    };
  }

  const branchName = clean(profile.defaultBranchName, clean(profile.branchName, 'Main Branch'));
  const warehouseName = clean(profile.defaultWarehouseName, clean(profile.warehouseName, 'Main Warehouse'));
  const ownerName = clean(profile.ownerName, clean(profile.ownerStaffName, 'Owner'));

  const registrationDoc = {
    ...business,
    registrationStatus: 'PendingConsoleVerification',
    submittedAt: now,
    syncStatus: 'Synced'
  };

  const branchDoc = {
    vendorId,
    branchId: MAIN_BRANCH_ID,
    id: MAIN_BRANCH_ID,
    name: branchName,
    branchName,
    phone: clean(profile.branchPhone),
    whatsapp: clean(profile.branchWhatsapp),
    email: clean(profile.branchEmail),
    country: clean(profile.branchCountry, business.country),
    province: clean(profile.branchProvince),
    city: clean(profile.branchCity),
    suburb: clean(profile.branchSuburb),
    address: clean(profile.branchAddress),
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const warehouseDoc = {
    vendorId,
    warehouseId: MAIN_WAREHOUSE_ID,
    id: MAIN_WAREHOUSE_ID,
    branchId: MAIN_BRANCH_ID,
    name: warehouseName,
    warehouseName,
    phone: clean(profile.warehousePhone),
    whatsapp: clean(profile.warehouseWhatsapp),
    email: clean(profile.warehouseEmail),
    country: clean(profile.warehouseCountry, business.country),
    province: clean(profile.warehouseProvince),
    city: clean(profile.warehouseCity),
    suburb: clean(profile.warehouseSuburb),
    address: clean(profile.warehouseAddress),
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const staffDoc = {
    vendorId,
    staffId: OWNER_STAFF_ID,
    id: OWNER_STAFF_ID,
    name: ownerName,
    ownerName,
    email: business.ownerEmail,
    phone: business.phone,
    whatsapp: business.whatsapp,
    role: 'Owner',
    staffRole: 'Owner',
    branchId: MAIN_BRANCH_ID,
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const licenseDoc = {
    vendorId,
    vendorName: business.businessName,
    ownerEmail: business.ownerEmail,
    licenseId: vendorId,
    activationId: vendorId,
    planCode: PLAN_CODE,
    planId: PLAN_CODE,
    planName: 'Demo Trial',
    licenseStatus: 'Trial',
    licenseMode: 'demo',
    storageMode: 'localOnly',
    status: 'pending',
    activationStatus: 'PendingConsoleVerification',
    branchId: MAIN_BRANCH_ID,
    branchName,
    terminalId: MAIN_TERMINAL_ID,
    terminalCode: MAIN_TERMINAL_ID,
    terminalName: 'Main POS Terminal',
    dashboardType: 'POS',
    startsAt: now,
    expiresAt: trialExpiresAt,
    issuedBy: SOURCE,
    issuedAt: now,
    trialStartedAt: now,
    trialExpiresAt,
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const planDoc = {
    vendorId,
    planId: PLAN_CODE,
    planCode: PLAN_CODE,
    planName: 'Demo Trial',
    accountStatus: 'Trial',
    licenseStatus: 'Trial',
    activationStatus: 'PendingConsoleVerification',
    trialStartedAt: now,
    trialExpiresAt,
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'vendors', vendorId), { ...business, syncStatus: 'Synced' }, { merge: true });
    batch.set(doc(db, 'vendorRegistrations', vendorId), registrationDoc, { merge: true });
    batch.set(doc(db, 'vendorBranches', sanitizeDocId(branchId)), branchDoc, { merge: true });
    batch.set(doc(db, 'vendorWarehouses', sanitizeDocId(warehouseId)), warehouseDoc, { merge: true });
    batch.set(doc(db, 'vendorStaff', sanitizeDocId(staffId)), staffDoc, { merge: true });
    batch.set(doc(db, 'vendorLicenses', vendorId), licenseDoc, { merge: true });
    batch.set(doc(db, 'vendorPlans', vendorId), planDoc, { merge: true });
    await batch.commit();

    return {
      vendorId,
      syncStatus: 'Synced',
      firestoreWritten: true,
      writtenCollections,
      provisionedAt: now
    };
  } catch (error) {
    return {
      vendorId,
      syncStatus: 'PendingSync',
      firestoreWritten: false,
      writtenCollections: [],
      provisionedAt: now,
      error: errorMessage(error)
    };
  }
}
