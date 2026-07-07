import { collection, doc, writeBatch } from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseApp';
import { sanitizeDocId } from '../firebase/firestoreIds';
import type { PosVendorAuthContext } from '../auth/posVendorAuthState';
import type { VendorBootstrapProfile } from './vendorBootstrapModel';
import {
  FIRESTORE_COLLECTIONS,
  createDefaultDemoLicense,
  createDefaultDemoPlan,
} from '../../shared/backend';
import type {
  VendorRecord,
  VendorRegistrationRecord,
  VendorBranchRecord,
  VendorWarehouseRecord,
  VendorStaffRecord,
  VendorLicenseRecord,
  VendorPlanRecord,
  VendorAuditLogRecord
} from '../../shared/backend';

const SOURCE = 'POS_ONBOARDING';
const PLAN_CODE = 'DEMO';
const MAIN_TERMINAL_ID = 'TERM-MAIN-001';

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Firebase provisioning error.';
}

function createBusinessIdentity(
  profile: VendorBootstrapProfile,
  authContext: PosVendorAuthContext,
  vendorId: string,
  now: string
): VendorRecord {
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
    googleUid: authContext.googleUid || undefined,
    phone,
    whatsapp,
    alternatePhone: clean(profile.alternatePhone) || undefined,
    website: clean(profile.website) || undefined,
    businessType: businessType || undefined,
    industry: industry || undefined,
    country,
    province: province || undefined,
    city,
    suburb: suburb || undefined,
    postalCode: clean(profile.postalCode) || undefined,
    address: address || undefined,
    physicalAddress: address || undefined,
    vatRegistered: Boolean(profile.vatRegistered),
    vatNumber: clean(profile.vatNumber) || undefined,
    taxNumber: clean(profile.taxNumber) || undefined,
    registrationNumber: clean(profile.registrationNumber) || undefined,
    verificationStatus: 'Pending',
    accountStatus: 'Trial',
    source: SOURCE,
    planCode: PLAN_CODE,
    licenseStatus: 'Trial',
    activationStatus: 'PendingConsoleVerification',
    defaultBranchId: `${vendorId}_main_branch`,
    defaultWarehouseId: `${vendorId}_main_warehouse`,
    defaultTerminalId: MAIN_TERMINAL_ID,
    ownerStaffId: `${vendorId}_owner`,
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
    'vendorPlans',
    'vendorAuditLogs'
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

  const registrationDoc: VendorRegistrationRecord = {
    ...business,
    registrationStatus: 'PendingConsoleVerification',
    submittedAt: now,
    syncStatus: 'Synced'
  };

  const branchDoc: VendorBranchRecord = {
    vendorId,
    branchId,
    branchName,
    phone: clean(profile.branchPhone) || undefined,
    whatsapp: clean(profile.branchWhatsapp) || undefined,
    email: clean(profile.branchEmail) || undefined,
    country: clean(profile.branchCountry, business.country),
    province: clean(profile.branchProvince) || undefined,
    city: clean(profile.branchCity) || undefined,
    suburb: clean(profile.branchSuburb) || undefined,
    address: clean(profile.branchAddress) || undefined,
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const warehouseDoc: VendorWarehouseRecord = {
    vendorId,
    warehouseId,
    branchId,
    warehouseName,
    phone: clean(profile.warehousePhone) || undefined,
    whatsapp: clean(profile.warehouseWhatsapp) || undefined,
    email: clean(profile.warehouseEmail) || undefined,
    country: clean(profile.warehouseCountry, business.country),
    province: clean(profile.warehouseProvince) || undefined,
    city: clean(profile.warehouseCity) || undefined,
    suburb: clean(profile.warehouseSuburb) || undefined,
    address: clean(profile.warehouseAddress) || undefined,
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const staffDoc: VendorStaffRecord = {
    vendorId,
    staffId,
    branchId,
    name: ownerName,
    email: business.ownerEmail || undefined,
    phone: business.phone || undefined,
    whatsapp: business.whatsapp || undefined,
    role: 'Owner',
    status: 'Active',
    source: SOURCE,
    createdAt: now,
    updatedAt: now
  };

  const licenseDoc: VendorLicenseRecord = {
    ...createDefaultDemoLicense(vendorId, 3),
    branchId,
    licenseMode: 'trial'
  };

  const planDoc: VendorPlanRecord = createDefaultDemoPlan(vendorId);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendors, vendorId), business, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorRegistrations, vendorId), registrationDoc, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorBranches, branchId), branchDoc, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorWarehouses, warehouseId), warehouseDoc, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorStaff, staffId), staffDoc, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorLicenses, vendorId), licenseDoc, { merge: true });
    batch.set(doc(db, FIRESTORE_COLLECTIONS.vendorPlans, vendorId), planDoc, { merge: true });

    const auditLogRef = doc(collection(db, FIRESTORE_COLLECTIONS.vendorAuditLogs));
    const auditLogDoc: VendorAuditLogRecord = {
      auditLogId: auditLogRef.id,
      vendorId,
      eventType: 'Onboarding',
      message: 'Vendor POS business profile provisioned and registered.',
      createdAt: now,
      updatedAt: now
    };
    batch.set(auditLogRef, auditLogDoc);

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



async function writeSharedVendorRelationshipRecords(profile: any, context: any, vendorId: string): Promise<string[]> {
  const branchId = context.branchId || "main-branch";
  const terminalId = context.terminalId || "TERM-MAIN-001";

  const records = buildSharedVendorRecords({
    vendorId,
    businessName: profile.businessName,
    tradingName: profile.tradingName || profile.businessName,
    ownerEmail: profile.ownerEmail || context.googleEmail || "",
    phone: profile.phone || "",
    whatsapp: profile.whatsapp || "",
    category: profile.businessType || profile.industry || "Retail",
    country: profile.country || "Zimbabwe",
    city: profile.city || "",
    address: profile.physicalAddress || profile.branchAddress || "",
    branchId,
    branchName: profile.branchName || profile.defaultBranchName || "Main Branch",
    branchPhone: profile.branchPhone || profile.phone || "",
    branchWhatsapp: profile.branchWhatsapp || profile.whatsapp || "",
    branchAddress: profile.branchAddress || profile.physicalAddress || "",
    terminalId,
    terminalName: "Main POS Terminal",
    planId: context.planCode || "DEMO",
    createdBy: context.googleEmail || "POS_ONBOARDING"
  });

  await upsertVendorRecord(records.vendor);
  await upsertBranchRecord(records.branch);
  await upsertTerminalRecord(records.terminal);
  await upsertPosLicenseRecord(records.license);

  return ["vendors", "branches", "terminals", "posLicenses"];
}


