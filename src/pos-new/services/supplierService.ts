import type {
  PurchaseOrderSupplierDetails,
  SupplierCreatedFrom,
  SupplierCreditStatus,
  SupplierRecord,
  SupplierVatStatus
} from '../types';
import { createOperationalApproval } from './approvalService';
import { createBIAdviceFromTrigger } from './biAdviceService';
import { ensureSupplierCreditProfileFromSupplier, getSupplierCreditProfiles } from './creditorsService';
import { createTask } from './taskService';

const SUPPLIER_KEY = 'itred_pos_supplier_records_v1';
const SUPPLIER_ACTIVITY_KEY = 'itred_pos_supplier_activity_v1';

export type SupplierActivityEventType =
  | 'SUPPLIER_SEARCHED_FROM_PO'
  | 'SUPPLIER_SELECTED_FOR_PO'
  | 'SUPPLIER_CREATE_PROMPT_OPENED'
  | 'SUPPLIER_CREATED_FROM_PURCHASE_ORDER'
  | 'SUPPLIER_LINKED_TO_PURCHASE_ORDER'
  | 'SUPPLIER_DUPLICATE_MATCH_FOUND'
  | 'PO_SUPPLIER_VALIDATION_FAILED'
  | 'SUPPLIER_CREDIT_PROFILE_CREATED_FROM_PO_SUPPLIER';

export interface SupplierSearchFilters {
  search?: string;
  active?: boolean | 'ALL';
  creditStatus?: SupplierCreditStatus | 'ALL';
}

export interface SupplierCreatePayload {
  supplierName: string;
  tradingName?: string;
  contactPerson?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  cityTown?: string;
  district?: string;
  suburb?: string;
  supplierType?: string;
  taxNumber?: string;
  vatStatus?: SupplierVatStatus;
  paymentTermsDays?: number;
  creditLimit?: number;
  creditStatus?: SupplierCreditStatus;
  preferredSupplier?: boolean;
  active?: boolean;
  notes?: string;
  createdFrom?: SupplierCreatedFrom;
  createdFromRecordId?: string;
  createdBy?: string;
}

export interface SupplierDuplicateMatch {
  supplier: SupplierRecord;
  reason: 'Supplier name exact match' | 'Supplier phone match' | 'Supplier email match' | 'Similar supplier name match';
}

export interface SupplierValidationResult {
  valid: boolean;
  errors: string[];
  duplicates: SupplierDuplicateMatch[];
}

export interface PurchaseOrderSupplierPayload extends PurchaseOrderSupplierDetails {
  supplierItemReference?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function readList<T>(key: string, fallback: T[] = []): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : fallback;
  } catch {
    try {
      localStorage.setItem(key, JSON.stringify(fallback));
    } catch {
      // Local/mock storage can be unavailable in restricted browser modes.
    }
    return fallback;
  }
}

function saveList<T>(key: string, value: T[]): T[] {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local/mock storage can fail without blocking the UI.
    }
  }
  return value;
}

function normalize(value = ''): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function words(value = ''): string[] {
  return normalize(value).split(/\s+/).filter(Boolean);
}

function anyOrderMatch(haystack: string, query = ''): boolean {
  const queryWords = words(query);
  if (!queryWords.length) return true;
  const normalizedHaystack = normalize(haystack);
  return queryWords.every((word) => normalizedHaystack.includes(word));
}

function supplierHaystack(supplier: SupplierRecord): string {
  return [
    supplier.supplierName,
    supplier.tradingName,
    supplier.supplierCode,
    supplier.contactPerson,
    supplier.phone,
    supplier.whatsapp,
    supplier.email,
    supplier.address,
    supplier.cityTown,
    supplier.district,
    supplier.suburb,
    supplier.supplierType,
    supplier.notes,
    supplier.creditStatus
  ].filter(Boolean).join(' ');
}

function suppliersFromCreditProfiles(): SupplierRecord[] {
  return getSupplierCreditProfiles().map((profile) => ({
    supplierId: profile.supplierId,
    supplierCode: profile.supplierCode,
    supplierName: profile.supplierName,
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    supplierType: 'Trade Supplier',
    paymentTermsDays: profile.paymentTermsDays,
    creditLimit: profile.supplierCreditLimit,
    creditStatus: profile.creditStatus,
    preferredSupplier: profile.preferredSupplier,
    active: true,
    notes: profile.notes,
    createdFrom: 'Creditors',
    createdBy: 'Build Seed',
    createdAt: profile.updatedAt,
    updatedAt: profile.updatedAt
  }));
}

function getSupplierRows(): SupplierRecord[] {
  const fallback = suppliersFromCreditProfiles();
  const rows = readList<SupplierRecord>(SUPPLIER_KEY, fallback);
  const seen = new Set<string>();
  const merged = [...rows, ...fallback].filter((supplier) => {
    if (!supplier?.supplierId || seen.has(supplier.supplierId)) return false;
    seen.add(supplier.supplierId);
    return true;
  });
  if (merged.length !== rows.length) saveList(SUPPLIER_KEY, merged);
  return merged;
}

export function generateSupplierCode(supplierName: string): string {
  const letters = supplierName.replace(/[^a-zA-Z0-9 ]/g, '').split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 4).toUpperCase() || 'SUP';
  const existing = getSupplierRows();
  const next = existing.reduce((max, supplier) => {
    const match = supplier.supplierCode.match(/-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${letters}-${String(next).padStart(3, '0')}`;
}

export function getSuppliers(filters: SupplierSearchFilters = {}): SupplierRecord[] {
  return getSupplierRows()
    .filter((supplier) => anyOrderMatch(supplierHaystack(supplier), filters.search || ''))
    .filter((supplier) => filters.active === undefined || filters.active === 'ALL' || supplier.active === filters.active)
    .filter((supplier) => !filters.creditStatus || filters.creditStatus === 'ALL' || supplier.creditStatus === filters.creditStatus)
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export function getSupplierById(supplierId: string): SupplierRecord | null {
  return getSupplierRows().find((supplier) => supplier.supplierId === supplierId) || null;
}

export function searchSuppliers(query: string): SupplierRecord[] {
  recordSupplierActivity('SUPPLIER_SEARCHED_FROM_PO', `Supplier searched from PO: ${query || 'blank search'}.`, 'Purchase Orders');
  return getSuppliers({ search: query, active: true }).slice(0, 12);
}

export function findSupplierByNameOrContact(payload: Partial<Pick<SupplierRecord, 'supplierName' | 'phone' | 'email' | 'contactPerson'>>): SupplierDuplicateMatch[] {
  const name = normalize(payload.supplierName);
  const phone = normalize(payload.phone);
  const email = normalize(payload.email);
  const nameWords = words(payload.supplierName);
  const matches: SupplierDuplicateMatch[] = [];
  getSupplierRows().forEach((supplier) => {
    const supplierName = normalize(supplier.supplierName);
    if (name && supplierName === name) matches.push({ supplier, reason: 'Supplier name exact match' });
    else if (phone && normalize(supplier.phone) === phone) matches.push({ supplier, reason: 'Supplier phone match' });
    else if (email && normalize(supplier.email) === email) matches.push({ supplier, reason: 'Supplier email match' });
    else if (nameWords.length >= 2 && nameWords.filter((word) => supplierName.includes(word)).length >= Math.min(2, nameWords.length)) matches.push({ supplier, reason: 'Similar supplier name match' });
  });
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.supplier.supplierId)) return false;
    seen.add(match.supplier.supplierId);
    return true;
  });
}

export function validateSupplierPayload(payload: SupplierCreatePayload): SupplierValidationResult {
  const errors: string[] = [];
  if (!payload.supplierName.trim()) errors.push('Supplier name is required.');
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.push('Supplier email format is invalid.');
  if ((payload.paymentTermsDays ?? 30) < 0) errors.push('Payment terms days cannot be negative.');
  if ((payload.creditLimit ?? 0) < 0) errors.push('Credit limit cannot be negative.');
  return { valid: errors.length === 0, errors, duplicates: findSupplierByNameOrContact(payload) };
}

export function recordSupplierActivity(eventType: SupplierActivityEventType, message: string, staffId: string, supplierId?: string, relatedRecordId?: string) {
  const events = readList<Array<{ id: string }>[number] & Record<string, string | undefined>>(SUPPLIER_ACTIVITY_KEY, []);
  const next = {
    id: makeId('SUP-ACT'),
    eventType,
    supplierId,
    relatedRecordId,
    message,
    staffId,
    createdAt: nowIso()
  };
  saveList(SUPPLIER_ACTIVITY_KEY, [next, ...events].slice(0, 160));
}

async function createSupplierProfileSideEffects(supplier: SupplierRecord, poId?: string) {
  ensureSupplierCreditProfileFromSupplier({
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    supplierCode: supplier.supplierCode,
    creditStatus: supplier.creditStatus,
    paymentTermsDays: supplier.paymentTermsDays,
    supplierCreditLimit: supplier.creditLimit,
    preferredSupplier: supplier.preferredSupplier,
    notes: `Local/mock credit profile created from ${supplier.createdFrom}${poId ? ` ${poId}` : ''}.`
  });
  recordSupplierActivity('SUPPLIER_CREDIT_PROFILE_CREATED_FROM_PO_SUPPLIER', `Supplier credit profile created for ${supplier.supplierName}.`, supplier.createdBy, supplier.supplierId, poId);
}

async function createSupplierWarningsAndTasks(supplier: SupplierRecord, poId?: string, poValue = 0) {
  if (!supplier.phone && !supplier.email && !supplier.contactPerson) {
    await createBIAdviceFromTrigger({
      id: `${supplier.supplierId}-CONTACT`,
      eventType: 'SUPPLIER_MISSING_CONTACT_DETAILS',
      domain: 'Supplier / Purchase Discipline / Data Quality',
      severity: 'Medium',
      description: `${supplier.supplierName} is missing phone, email, or contact person details.`,
      recommendedAction: 'Complete supplier contact details before GRN or supplier bill processing.'
    });
  }
  if (supplier.creditStatus === 'UnderReview') {
    await createBIAdviceFromTrigger({
      id: `${supplier.supplierId}-UNDER-REVIEW`,
      eventType: 'PO_WITH_UNREVIEWED_NEW_SUPPLIER',
      domain: 'Supplier / Purchase Discipline / Data Quality',
      severity: poValue >= 1000 ? 'High' : 'Medium',
      description: `${supplier.supplierName} was created from a PO and remains under credit review.`,
      recommendedAction: 'Review supplier credit profile before relying on supplier credit terms.'
    });
  }
  if (poValue >= 1000) {
    await createTask({
      title: 'Review new supplier created from PO',
      actionType: 'Review',
      relatedModule: 'Creditors',
      relatedRecordId: supplier.supplierId,
      relatedRecordLabel: supplier.supplierName,
      assignedStaffId: 'CREDITORS-DESK',
      assignedStaffName: 'Creditors Desk',
      priority: poValue >= 5000 ? 'High' : 'Medium',
      description: `Review local/mock supplier ${supplier.supplierName} created from Purchase Order ${poId || 'draft'}.`,
      notes: 'Created by supplier auto-creation workflow.',
      createdBy: supplier.createdBy,
      linkedSupplierId: supplier.supplierId
    });
  }
  if (supplier.paymentTermsDays > 0 || supplier.creditLimit > 0) {
    await createOperationalApproval({
      vendorId: 'SCI-LOG-ZW',
      branchId: 'BR-HARARE',
      branch: 'Harare Main',
      category: 'Purchase Order',
      requestedBy: supplier.createdBy,
      requestedByRole: 'Stock Controller',
      relatedRecord: supplier.supplierName,
      amountOrValue: `${supplier.paymentTermsDays} days / ${supplier.creditLimit.toFixed(2)}`,
      risk: supplier.creditLimit > 0 ? 'High' : 'Medium',
      reason: 'SUPPLIER_CREDIT_PROFILE_REVIEW',
      context: 'Local/mock supplier credit profile review placeholder from PO supplier creation.',
      approvalType: 'SUPPLIER_CREDIT_PROFILE_REVIEW',
      requiredPermission: 'approvals.approve'
    });
  }
}

export async function createSupplier(payload: SupplierCreatePayload): Promise<SupplierRecord> {
  const validation = validateSupplierPayload(payload);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const rows = getSupplierRows();
  const createdAt = nowIso();
  const supplier: SupplierRecord = {
    supplierId: makeId('SUP'),
    supplierCode: generateSupplierCode(payload.supplierName),
    supplierName: payload.supplierName.trim(),
    tradingName: payload.tradingName?.trim(),
    contactPerson: payload.contactPerson?.trim() || '',
    phone: payload.phone?.trim() || '',
    whatsapp: payload.whatsapp?.trim(),
    email: payload.email?.trim() || '',
    address: payload.address?.trim() || '',
    cityTown: payload.cityTown?.trim(),
    district: payload.district?.trim(),
    suburb: payload.suburb?.trim(),
    supplierType: payload.supplierType || 'Trade Supplier',
    taxNumber: payload.taxNumber?.trim(),
    vatStatus: payload.vatStatus || 'Unknown',
    paymentTermsDays: payload.paymentTermsDays ?? 30,
    creditLimit: payload.creditLimit ?? 0,
    creditStatus: payload.creditStatus || 'UnderReview',
    preferredSupplier: payload.preferredSupplier ?? false,
    active: payload.active ?? true,
    notes: payload.notes || '',
    createdFrom: payload.createdFrom || 'Manual',
    createdFromRecordId: payload.createdFromRecordId,
    createdBy: payload.createdBy || 'System',
    createdAt,
    updatedAt: createdAt
  };
  saveList(SUPPLIER_KEY, [supplier, ...rows]);
  await createSupplierProfileSideEffects(supplier, payload.createdFromRecordId);
  if (supplier.createdFrom !== 'PurchaseOrder') {
    await createSupplierWarningsAndTasks(supplier, payload.createdFromRecordId);
  }
  return supplier;
}

export function updateSupplier(supplierId: string, patch: Partial<SupplierRecord>): SupplierRecord | null {
  const rows = getSupplierRows();
  let updated: SupplierRecord | null = null;
  saveList(SUPPLIER_KEY, rows.map((supplier) => {
    if (supplier.supplierId !== supplierId) return supplier;
    updated = { ...supplier, ...patch, supplierId, updatedAt: nowIso() };
    return updated;
  }));
  return updated;
}

export function deactivateSupplier(supplierId: string, reason: string, staffId: string): SupplierRecord | null {
  const updated = updateSupplier(supplierId, { active: false, notes: reason });
  if (updated) recordSupplierActivity('SUPPLIER_SELECTED_FOR_PO', `${updated.supplierName} deactivated. ${reason}`, staffId, supplierId);
  return updated;
}

export async function createSupplierFromPurchaseOrder(poSupplierDetails: PurchaseOrderSupplierPayload, poId: string, createdBy = 'Purchase Orders', poValue = 0, extra: Partial<SupplierCreatePayload> = {}): Promise<SupplierRecord> {
  const supplier = await createSupplier({
    supplierName: poSupplierDetails.supplierName,
    contactPerson: poSupplierDetails.supplierContactPerson,
    phone: poSupplierDetails.supplierPhone,
    email: poSupplierDetails.supplierEmail,
    address: poSupplierDetails.supplierAddress,
    paymentTermsDays: 30,
    creditStatus: 'UnderReview',
    active: true,
    supplierType: 'Trade Supplier',
    notes: [poSupplierDetails.supplierItemReference ? `Supplier item reference: ${poSupplierDetails.supplierItemReference}` : '', extra.notes || 'Created and linked from Purchase Order.'].filter(Boolean).join('\n'),
    ...extra,
    createdFrom: 'PurchaseOrder',
    createdFromRecordId: poId,
    createdBy
  });
  await createSupplierWarningsAndTasks(supplier, poId, poValue);
  recordSupplierActivity('SUPPLIER_CREATED_FROM_PURCHASE_ORDER', `${supplier.supplierName} created from Purchase Order ${poId || 'draft'}.`, createdBy, supplier.supplierId, poId);
  return supplier;
}

export async function flagPossibleDuplicateSupplier(matches: SupplierDuplicateMatch[], supplierName: string, staffId: string, poId?: string) {
  if (!matches.length) return;
  recordSupplierActivity('SUPPLIER_DUPLICATE_MATCH_FOUND', `Possible duplicate supplier found for ${supplierName}.`, staffId, matches[0].supplier.supplierId, poId);
  await createBIAdviceFromTrigger({
    id: `${poId || supplierName}-DUPLICATE-SUPPLIER`,
    eventType: 'DUPLICATE_SUPPLIER_POSSIBLE',
    domain: 'Supplier / Purchase Discipline / Data Quality',
    severity: 'Medium',
    description: `${supplierName} may already exist as ${matches.map((match) => match.supplier.supplierName).join(', ')}.`,
    recommendedAction: 'Use existing supplier or verify the duplicate before creating a new supplier.'
  });
  await createTask({
    title: 'Verify possible duplicate supplier',
    actionType: 'Investigate',
    relatedModule: 'Creditors',
    relatedRecordId: poId || matches[0].supplier.supplierId,
    relatedRecordLabel: supplierName,
    assignedStaffId: 'CREDITORS-DESK',
    assignedStaffName: 'Creditors Desk',
    priority: 'Medium',
    description: `Check whether ${supplierName} duplicates an existing supplier record.`,
    notes: matches.map((match) => `${match.reason}: ${match.supplier.supplierName}`).join('\n'),
    createdBy: staffId,
    linkedSupplierId: matches[0].supplier.supplierId
  });
}

export async function flagPOSupplierNotInRecords(supplierName: string, staffId: string, poId?: string) {
  recordSupplierActivity('PO_SUPPLIER_VALIDATION_FAILED', `PO supplier ${supplierName || 'blank supplier'} is not linked to supplier records.`, staffId, undefined, poId);
  await createBIAdviceFromTrigger({
    id: `${poId || supplierName || 'PO'}-SUPPLIER-NOT-LINKED`,
    eventType: 'PO_SUPPLIER_NOT_IN_RECORDS',
    domain: 'Supplier / Purchase Discipline / Data Quality',
    severity: 'Medium',
    description: supplierName ? `${supplierName} was typed on a Purchase Order but is not linked to a supplier record.` : 'Purchase Order supplier name is missing.',
    recommendedAction: 'Select an existing supplier or create and link a supplier record before saving or submitting the PO.'
  });
}
