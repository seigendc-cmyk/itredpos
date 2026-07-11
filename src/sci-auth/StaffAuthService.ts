import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../pos-new/firebase/firebaseApp';
import type { PosSession } from '../pos-new/types';

export const SCI_VENDOR_OWNER_SESSION_KEY = 'sci_vendor_owner_session';
export const SCI_POS_STAFF_SESSION_KEY = 'sci_pos_staff_session';
export const LEGACY_POS_ACTIVE_SESSION_KEY = 'itred_pos_active_session';

export interface SciVendorOwnerSession {
  vendorId: string;
  ownerName: string;
  ownerEmail: string;
  vendorName: string;
  tradingName?: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  city?: string;
  suburb?: string;
  physicalAddress?: string;
  status?: string;
  mode?: string;
  role: string;
  signedInAt: string;
}

export interface StaffAccessStaff {
  staffId: string;
  vendorId: string;
  branchId: string;
  staffName: string;
  email?: string;
  role: string;
  status: string;
  pin?: string;
  permissions: string[];
  assignedTerminalIds: string[];
}

export interface StaffAccessBranch {
  branchId: string;
  vendorId: string;
  branchName: string;
  status: string;
}

export interface StaffAccessWarehouse {
  warehouseId: string;
  vendorId: string;
  branchId: string;
  warehouseName: string;
  status: string;
}

export interface StaffAccessTerminal {
  terminalId: string;
  vendorId: string;
  branchId: string;
  warehouseId?: string;
  terminalName: string;
  status: string;
}

export interface StaffAccessData {
  staff: StaffAccessStaff[];
  branches: StaffAccessBranch[];
  warehouses: StaffAccessWarehouse[];
  terminals: StaffAccessTerminal[];
}

export interface SciPosStaffSession {
  vendorId: string;
  vendorName: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
  terminalId: string;
  terminalName: string;
  staffId: string;
  staffName: string;
  role: string;
  permissions: string[];
  signedInAt: string;
}

export interface StaffAuthInput {
  vendorSession: SciVendorOwnerSession;
  staffId: string;
  pin: string;
  branchId: string;
  warehouseId: string;
  terminalId: string;
  staff: StaffAccessStaff[];
  branches: StaffAccessBranch[];
  warehouses: StaffAccessWarehouse[];
  terminals: StaffAccessTerminal[];
}

export interface StaffAuthResult {
  ok: boolean;
  message: string;
  session?: SciPosStaffSession;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canUseLocalStorage()) return;
  localStorage.setItem(key, JSON.stringify(value));
}

function text(value: unknown, fallback = ''): string {
  const next = String(value ?? '').trim();
  return next || fallback;
}

function statusIsActive(value: unknown): boolean {
  return text(value).toLowerCase() === 'active';
}

function permissionsFrom(value: unknown, role: string): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  return role.toLowerCase() === 'owner' ? ['*'] : [];
}

function mapStaff(docId: string, row: Record<string, unknown>): StaffAccessStaff {
  const role = text(row.roleName, text(row.role, 'Staff'));
  return {
    staffId: text(row.staffId, text(row.id, docId)),
    vendorId: text(row.vendorId),
    branchId: text(row.branchId),
    staffName: text(row.displayName, text(row.name, text(row.staffName, 'Staff'))),
    email: text(row.email),
    role,
    status: text(row.status, 'Active'),
    pin: text(row.pinCode, text(row.pin, text(row.pass))),
    permissions: permissionsFrom(row.permissions, role),
    assignedTerminalIds: Array.isArray(row.assignedTerminalIds)
      ? row.assignedTerminalIds.map((item) => String(item)).filter(Boolean)
      : [],
  };
}

function mapBranch(docId: string, row: Record<string, unknown>): StaffAccessBranch {
  return {
    branchId: text(row.branchId, text(row.id, docId)),
    vendorId: text(row.vendorId),
    branchName: text(row.branchName, text(row.name, 'Main Branch')),
    status: text(row.status, 'Active'),
  };
}

function mapWarehouse(docId: string, row: Record<string, unknown>): StaffAccessWarehouse {
  return {
    warehouseId: text(row.warehouseId, text(row.id, docId)),
    vendorId: text(row.vendorId),
    branchId: text(row.branchId),
    warehouseName: text(row.warehouseName, text(row.name, 'Main Warehouse')),
    status: text(row.status, 'Active'),
  };
}

function mapTerminal(docId: string, row: Record<string, unknown>): StaffAccessTerminal {
  return {
    terminalId: text(row.terminalId, text(row.id, docId)),
    vendorId: text(row.vendorId),
    branchId: text(row.branchId),
    warehouseId: text(row.warehouseId),
    terminalName: text(row.terminalName, text(row.name, 'Main POS Terminal')),
    status: text(row.status, 'Active'),
  };
}

async function queryVendorCollection<T>(
  collectionName: string,
  vendorId: string,
  mapper: (docId: string, row: Record<string, unknown>) => T,
): Promise<T[]> {
  if (!db || !vendorId) return [];
  const rows = await getDocs(query(collection(db, collectionName), where('vendorId', '==', vendorId), limit(200)));
  return rows.docs.map((item) => mapper(item.id, item.data() as Record<string, unknown>));
}

export function readSciVendorOwnerSession(): SciVendorOwnerSession | null {
  return readJson<SciVendorOwnerSession>(SCI_VENDOR_OWNER_SESSION_KEY);
}

export function saveSciVendorOwnerSession(session: SciVendorOwnerSession): void {
  writeJson(SCI_VENDOR_OWNER_SESSION_KEY, session);
}

export function readSciPosStaffSession(): SciPosStaffSession | null {
  return readJson<SciPosStaffSession>(SCI_POS_STAFF_SESSION_KEY);
}

export function saveSciPosStaffSession(session: SciPosStaffSession): void {
  writeJson(SCI_POS_STAFF_SESSION_KEY, session);
}

export function clearSciAuthSessions(): void {
  if (!canUseLocalStorage()) return;
  localStorage.removeItem(SCI_POS_STAFF_SESSION_KEY);
  localStorage.removeItem(LEGACY_POS_ACTIVE_SESSION_KEY);
}

export async function loadStaffAccessData(vendorId: string): Promise<StaffAccessData> {
  if (!vendorId) {
    throw new Error('Vendor session missing');
  }
  if (!db) {
    throw new Error('Staff access database is not available.');
  }

  const [staff, branches, warehouses, terminals] = await Promise.all([
    queryVendorCollection('staff', vendorId, mapStaff),
    queryVendorCollection('branches', vendorId, mapBranch),
    queryVendorCollection('warehouses', vendorId, mapWarehouse),
    queryVendorCollection('pos_terminals', vendorId, mapTerminal),
  ]);

  return {
    staff,
    branches: branches.filter((row) => statusIsActive(row.status)),
    warehouses: warehouses.filter((row) => statusIsActive(row.status)),
    terminals: terminals.filter((row) => statusIsActive(row.status)),
  };
}

export function authenticateStaffAccess(input: StaffAuthInput): StaffAuthResult {
  const vendorId = input.vendorSession?.vendorId;
  if (!vendorId) {
    return { ok: false, message: 'Vendor session missing' };
  }

  const staff = input.staff.find((row) => row.staffId === input.staffId);
  if (!staff) {
    return { ok: false, message: 'Staff record not found' };
  }
  if (staff.vendorId !== vendorId) {
    return { ok: false, message: 'Staff belongs to another vendor' };
  }
  if (!statusIsActive(staff.status)) {
    return { ok: false, message: 'Staff record is inactive' };
  }

  const branch = input.branches.find((row) => row.branchId === input.branchId);
  if (!branch || branch.vendorId !== vendorId || !statusIsActive(branch.status)) {
    return { ok: false, message: 'Branch mismatch' };
  }
  if (staff.branchId && staff.branchId !== input.branchId) {
    return { ok: false, message: 'Branch mismatch' };
  }

  const terminal = input.terminals.find((row) => row.terminalId === input.terminalId);
  if (!terminal || terminal.vendorId !== vendorId || terminal.branchId !== input.branchId || !statusIsActive(terminal.status)) {
    return { ok: false, message: 'Terminal mismatch' };
  }
  if (staff.assignedTerminalIds.length > 0 && !staff.assignedTerminalIds.includes(input.terminalId)) {
    return { ok: false, message: 'Terminal mismatch' };
  }

  const warehouse = input.warehouses.find((row) => row.warehouseId === input.warehouseId);
  if (!warehouse || warehouse.vendorId !== vendorId || warehouse.branchId !== input.branchId || !statusIsActive(warehouse.status)) {
    return { ok: false, message: 'Branch mismatch' };
  }

  if (!staff.pin || staff.pin !== input.pin.trim()) {
    return { ok: false, message: 'Invalid PIN' };
  }

  return {
    ok: true,
    message: 'Access granted.',
    session: {
      vendorId,
      vendorName: input.vendorSession.vendorName || input.vendorSession.tradingName || vendorId,
      branchId: branch.branchId,
      branchName: branch.branchName,
      warehouseId: warehouse.warehouseId,
      warehouseName: warehouse.warehouseName,
      terminalId: terminal.terminalId,
      terminalName: terminal.terminalName,
      staffId: staff.staffId,
      staffName: staff.staffName,
      role: staff.role,
      permissions: staff.permissions,
      signedInAt: new Date().toISOString(),
    },
  };
}

export function adaptSciStaffSessionToPosSession(session: SciPosStaffSession): PosSession {
  return {
    vendor: session.vendorName,
    vendorId: session.vendorId,
    branch: session.branchName,
    branchId: session.branchId,
    warehouse: session.warehouseName,
    warehouseId: session.warehouseId,
    terminal: session.terminalName,
    terminalId: session.terminalId,
    staffId: session.staffId,
    staffName: session.staffName,
    role: session.role,
    licenseId: `${session.vendorId}-license`,
    planId: 'DEMO',
    licenseMode: 'demo',
    storageMode: 'local',
    activationId: `${session.vendorId}-activation`,
    dashboardType: 'POS',
    openedAt: session.signedInAt,
  };
}
