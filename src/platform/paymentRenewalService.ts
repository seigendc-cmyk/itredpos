import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  type WriteBatch
} from 'firebase/firestore';
import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import {
  DEFAULT_PLAN_FEATURE_FLAGS,
  DEFAULT_PLAN_LIMITS,
  FIRESTORE_COLLECTIONS,
  PLAN_CODES
} from '../shared/backend';
import type {
  PlanCode,
  PricingPlanRecord,
  VendorAuditLogRecord,
  VendorLicenseRecord,
  VendorPlanRecord
} from '../shared/backend';

export type VendorPaymentStatus = 'Confirmed';
export type VendorInvoiceStatus = 'Draft' | 'Issued' | 'Paid' | 'Cancelled';

export interface VendorPaymentRecord {
  paymentId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  reference: string;
  status: VendorPaymentStatus;
  receivedAt: string;
  receivedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInvoiceRecord {
  invoiceId: string;
  vendorId: string;
  vendorName: string;
  planCode: PlanCode;
  amount: number;
  currency: string;
  status: VendorInvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string;
  paymentReference?: string;
  createdBy: string;
  paidBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRenewalVendorOption {
  vendorId: string;
  vendorName: string;
  ownerEmail?: string;
  phone?: string;
  planCode?: string;
  accountStatus?: string;
  licenseStatus?: string;
  activationStatus?: string;
  expiresAt?: string;
}

export interface ExpiringVendorRecord extends PaymentRenewalVendorOption {
  daysRemaining: number | null;
}

function checkFirebaseReady(): void {
  if (!firebaseReady || !db) {
    throw new Error('Firebase client is not initialized or database is unavailable.');
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function text(value: unknown, fallback = ''): string {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function moneyAmount(value: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }
  return Math.round(amount * 100) / 100;
}

function normalizePlanCode(value: string): PlanCode {
  const clean = value.trim().toUpperCase();
  if ((PLAN_CODES as readonly string[]).includes(clean)) return clean as PlanCode;
  throw new Error(`Unsupported plan code: ${value}`);
}

function addMonthsIso(baseIso: string | undefined, months: number): string {
  const safeMonths = Math.max(1, Math.floor(Number(months) || 0));
  const parsed = baseIso ? Date.parse(baseIso) : NaN;
  const now = Date.now();
  const base = Number.isFinite(parsed) && parsed > now ? new Date(parsed) : new Date(now);
  const next = new Date(base);
  next.setMonth(next.getMonth() + safeMonths);
  return next.toISOString();
}

function daysUntil(value?: string): number | null {
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / (24 * 60 * 60 * 1000));
}

function compareIsoDesc(left?: string, right?: string): number {
  return String(right || '').localeCompare(String(left || ''));
}

function vendorNameFromData(data: Record<string, unknown>, fallback: string): string {
  return text(data.businessName, text(data.tradingName, text(data.legalName, text(data.vendorName, fallback))));
}

async function getVendorSummary(vendorId: string): Promise<PaymentRenewalVendorOption> {
  checkFirebaseReady();
  const cleanVendorId = text(vendorId);
  if (!cleanVendorId) throw new Error('Vendor is required.');

  const vendorRef = doc(db!, FIRESTORE_COLLECTIONS.vendors, cleanVendorId);
  const vendorSnap = await getDoc(vendorRef);
  const registrationRef = doc(db!, FIRESTORE_COLLECTIONS.vendorRegistrations, cleanVendorId);
  const registrationSnap = vendorSnap.exists() ? null : await getDoc(registrationRef);
  const data = (vendorSnap.exists() ? vendorSnap.data() : registrationSnap?.data() || {}) as Record<string, unknown>;

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId);
  const licenseSnap = await getDoc(licenseRef);
  const license = (licenseSnap.exists() ? licenseSnap.data() : {}) as Record<string, unknown>;

  return {
    vendorId: cleanVendorId,
    vendorName: vendorNameFromData(data, cleanVendorId),
    ownerEmail: text(data.ownerEmail, text(data.googleEmail)),
    phone: text(data.phone, text(data.whatsapp)),
    planCode: text(license.planCode, text(data.planCode)),
    accountStatus: text(data.accountStatus),
    licenseStatus: text(license.licenseStatus),
    activationStatus: text(license.activationStatus),
    expiresAt: text(license.expiresAt, text(license.trialExpiresAt))
  };
}

async function getPlanDetails(planCode: PlanCode): Promise<Pick<PricingPlanRecord, 'planName' | 'featureFlags' | 'limits'>> {
  checkFirebaseReady();
  const fallback = {
    planName: planCode === 'DEMO' ? 'Demo Trial' : planCode.charAt(0) + planCode.slice(1).toLowerCase(),
    featureFlags: DEFAULT_PLAN_FEATURE_FLAGS[planCode],
    limits: DEFAULT_PLAN_LIMITS[planCode]
  };

  const planSnap = await getDoc(doc(db!, FIRESTORE_COLLECTIONS.plans, planCode));
  if (!planSnap.exists()) return fallback;
  const plan = planSnap.data() as PricingPlanRecord;
  return {
    planName: plan.planName || fallback.planName,
    featureFlags: plan.featureFlags || fallback.featureFlags,
    limits: plan.limits || fallback.limits
  };
}

function createAuditLogDoc(
  batch: WriteBatch,
  vendorId: string,
  eventType: 'PAYMENT_RECORDED' | 'LICENSE_RENEWED' | 'INVOICE_CREATED' | 'INVOICE_PAID',
  message: string,
  performedBy: string
): void {
  const now = nowIso();
  const auditRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorAuditLogs));
  const auditLog: VendorAuditLogRecord = {
    auditLogId: auditRef.id,
    vendorId,
    eventType,
    message,
    performedBy,
    createdAt: now,
    updatedAt: now
  };
  batch.set(auditRef, auditLog);
}

export async function listPaymentRenewalVendors(): Promise<PaymentRenewalVendorOption[]> {
  checkFirebaseReady();
  const [vendorSnapshot, licenseSnapshot] = await Promise.all([
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendors)),
    getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorLicenses))
  ]);

  const vendors = new Map<string, PaymentRenewalVendorOption>();
  vendorSnapshot.docs.forEach((row) => {
    const data = row.data() as Record<string, unknown>;
    const vendorId = text(data.vendorId, row.id);
    vendors.set(vendorId, {
      vendorId,
      vendorName: vendorNameFromData(data, vendorId),
      ownerEmail: text(data.ownerEmail, text(data.googleEmail)),
      phone: text(data.phone, text(data.whatsapp)),
      planCode: text(data.planCode),
      accountStatus: text(data.accountStatus)
    });
  });

  licenseSnapshot.docs.forEach((row) => {
    const license = row.data() as Record<string, unknown>;
    const vendorId = text(license.vendorId, row.id);
    const current = vendors.get(vendorId) || {
      vendorId,
      vendorName: text(license.vendorName, vendorId)
    };
    vendors.set(vendorId, {
      ...current,
      planCode: text(license.planCode, current.planCode),
      licenseStatus: text(license.licenseStatus),
      activationStatus: text(license.activationStatus),
      expiresAt: text(license.expiresAt, text(license.trialExpiresAt))
    });
  });

  return Array.from(vendors.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

export async function listPaymentRenewalPlans(): Promise<PlanCode[]> {
  checkFirebaseReady();
  const snapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.plans));
  const planCodes = snapshot.docs
    .map((row) => text((row.data() as Record<string, unknown>).planCode, row.id).toUpperCase())
    .filter((planCode): planCode is PlanCode => (PLAN_CODES as readonly string[]).includes(planCode));
  return planCodes.length > 0 ? planCodes : [...PLAN_CODES];
}

export async function listExpiringVendors(): Promise<ExpiringVendorRecord[]> {
  const vendors = await listPaymentRenewalVendors();
  return vendors
    .map((vendor) => ({ ...vendor, daysRemaining: daysUntil(vendor.expiresAt) }))
    .filter((vendor) => vendor.daysRemaining === null || vendor.daysRemaining <= 45)
    .sort((a, b) => (a.daysRemaining ?? 999999) - (b.daysRemaining ?? 999999))
    .slice(0, 25);
}

export async function listVendorPayments(): Promise<VendorPaymentRecord[]> {
  checkFirebaseReady();
  const snapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorPayments));
  return snapshot.docs
    .map((row) => ({ paymentId: row.id, ...(row.data() as VendorPaymentRecord) }))
    .sort((a, b) => compareIsoDesc(a.receivedAt, b.receivedAt))
    .slice(0, 50);
}

export async function listVendorInvoices(): Promise<VendorInvoiceRecord[]> {
  checkFirebaseReady();
  const snapshot = await getDocs(collection(db!, FIRESTORE_COLLECTIONS.vendorInvoices));
  return snapshot.docs
    .map((row) => ({ invoiceId: row.id, ...(row.data() as VendorInvoiceRecord) }))
    .sort((a, b) => compareIsoDesc(a.issuedAt, b.issuedAt))
    .slice(0, 50);
}

export async function recordVendorPayment(
  vendorId: string,
  amount: number,
  currency: string,
  paymentMethod: string,
  reference: string,
  performedBy: string
): Promise<VendorPaymentRecord> {
  checkFirebaseReady();
  const now = nowIso();
  const vendor = await getVendorSummary(vendorId);
  const paymentRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorPayments));
  const payment: VendorPaymentRecord = {
    paymentId: paymentRef.id,
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    amount: moneyAmount(amount),
    currency: text(currency, 'USD').toUpperCase(),
    paymentMethod: text(paymentMethod, 'Manual'),
    reference: text(reference, paymentRef.id),
    status: 'Confirmed',
    receivedAt: now,
    receivedBy: text(performedBy, 'Console Admin'),
    createdAt: now,
    updatedAt: now
  };

  const batch = writeBatch(db!);
  batch.set(paymentRef, payment);
  createAuditLogDoc(batch, vendor.vendorId, 'PAYMENT_RECORDED', `Payment recorded: ${payment.currency} ${payment.amount} via ${payment.paymentMethod}. Reference: ${payment.reference}.`, payment.receivedBy);
  await batch.commit();
  return payment;
}

export async function renewVendorLicense(
  vendorId: string,
  planCode: PlanCode,
  months: number,
  performedBy: string
): Promise<{ vendorId: string; planCode: PlanCode; expiresAt: string }> {
  checkFirebaseReady();
  const now = nowIso();
  const vendor = await getVendorSummary(vendorId);
  const cleanPlanCode = normalizePlanCode(planCode);
  const plan = await getPlanDetails(cleanPlanCode);

  const licenseRef = doc(db!, FIRESTORE_COLLECTIONS.vendorLicenses, vendor.vendorId);
  const licenseSnap = await getDoc(licenseRef);
  const currentLicense = (licenseSnap.exists() ? licenseSnap.data() : {}) as Partial<VendorLicenseRecord>;
  const expiresAt = addMonthsIso(currentLicense.expiresAt || currentLicense.trialExpiresAt, months);

  const batch = writeBatch(db!);
  batch.set(licenseRef, {
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    licenseStatus: 'Active',
    activationStatus: 'Active',
    planCode: cleanPlanCode,
    planId: cleanPlanCode,
    planName: plan.planName,
    featureFlags: plan.featureFlags,
    limits: plan.limits,
    renewedAt: now,
    expiresAt,
    updatedAt: now
  }, { merge: true });

  const vendorPlan = {
    vendorId: vendor.vendorId,
    planCode: cleanPlanCode,
    planId: cleanPlanCode,
    planName: plan.planName,
    featureFlags: plan.featureFlags,
    limits: plan.limits,
    renewedAt: now,
    updatedAt: now
  } satisfies Partial<VendorPlanRecord> & { renewedAt: string };
  batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendorPlans, vendor.vendorId), vendorPlan, { merge: true });

  batch.set(doc(db!, FIRESTORE_COLLECTIONS.vendors, vendor.vendorId), {
    vendorId: vendor.vendorId,
    planCode: cleanPlanCode,
    accountStatus: 'Active',
    updatedAt: now
  }, { merge: true });

  createAuditLogDoc(batch, vendor.vendorId, 'LICENSE_RENEWED', `License renewed on ${cleanPlanCode} for ${months} month(s). New expiry: ${expiresAt}.`, text(performedBy, 'Console Admin'));
  await batch.commit();
  return { vendorId: vendor.vendorId, planCode: cleanPlanCode, expiresAt };
}

export async function createVendorInvoice(
  vendorId: string,
  planCode: PlanCode,
  amount: number,
  currency: string,
  dueDate: string,
  performedBy: string
): Promise<VendorInvoiceRecord> {
  checkFirebaseReady();
  const now = nowIso();
  const vendor = await getVendorSummary(vendorId);
  const cleanPlanCode = normalizePlanCode(planCode);
  const invoiceRef = doc(collection(db!, FIRESTORE_COLLECTIONS.vendorInvoices));
  const invoice: VendorInvoiceRecord = {
    invoiceId: invoiceRef.id,
    vendorId: vendor.vendorId,
    vendorName: vendor.vendorName,
    planCode: cleanPlanCode,
    amount: moneyAmount(amount),
    currency: text(currency, 'USD').toUpperCase(),
    status: 'Issued',
    issuedAt: now,
    dueDate: text(dueDate, now.slice(0, 10)),
    paidAt: '',
    createdBy: text(performedBy, 'Console Admin'),
    createdAt: now,
    updatedAt: now
  };

  const batch = writeBatch(db!);
  batch.set(invoiceRef, invoice);
  createAuditLogDoc(batch, vendor.vendorId, 'INVOICE_CREATED', `Invoice created for ${invoice.planCode}: ${invoice.currency} ${invoice.amount}. Due: ${invoice.dueDate}.`, invoice.createdBy);
  await batch.commit();
  return invoice;
}

export async function markInvoicePaid(
  invoiceId: string,
  paymentReference: string,
  performedBy: string
): Promise<void> {
  checkFirebaseReady();
  const now = nowIso();
  const invoiceRef = doc(db!, FIRESTORE_COLLECTIONS.vendorInvoices, invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);
  if (!invoiceSnap.exists()) {
    throw new Error('Invoice was not found.');
  }
  const invoice = { invoiceId, ...(invoiceSnap.data() as VendorInvoiceRecord) };
  const paidBy = text(performedBy, 'Console Admin');
  const reference = text(paymentReference, invoiceId);

  const batch = writeBatch(db!);
  batch.set(invoiceRef, {
    status: 'Paid',
    paidAt: now,
    paymentReference: reference,
    paidBy,
    updatedAt: now
  }, { merge: true });
  createAuditLogDoc(batch, invoice.vendorId, 'INVOICE_PAID', `Invoice ${invoice.invoiceId} marked paid. Reference: ${reference}.`, paidBy);
  await batch.commit();
}

