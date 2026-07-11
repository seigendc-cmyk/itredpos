import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';
import type { StaffRecord, StaffRecordStatus, StaffRoleId } from '../../shared/backend/vendorContract';
import type { StaffSetting } from '../types/posTypes';
import type { Role } from '../types';

const STAFF_COLLECTION = 'staff';

function isActiveStatus(status: unknown): boolean {
  return String(status || '').trim().toLowerCase() === 'active';
}

export function mapStaffRecordToStaffSetting(record: StaffRecord): StaffSetting {
  return {
    id: record.id,
    vendorId: record.vendorId,
    branchId: record.branchId,
    staffCode: record.staffCode,
    displayName: record.displayName,
    email: record.email,
    roleId: record.roleId,
    roleName: record.roleName as Role,
    pinHash: record.pinHash,
    pinCode: record.pinCode,
    status: record.status,
    assignedTerminalIds: record.assignedTerminalIds,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    createdBy: record.createdBy,
    updatedBy: record.updatedBy,
    uid: record.uid,
  };
}

export function mapStaffSettingToStaffRecord(
  setting: Partial<StaffSetting>,
  overrides: Partial<StaffRecord> = {}
): StaffRecord {
  const now = new Date().toISOString();
  return {
    id: setting.id || `STF-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    vendorId: setting.vendorId || '',
    branchId: setting.branchId || '',
    staffCode: setting.staffCode || setting.id || '',
    displayName: setting.displayName || '',
    email: setting.email || '',
    roleId: (setting.roleId as StaffRoleId) || 'cashier',
    roleName: setting.roleName || 'Cashier',
    pinHash: setting.pinHash,
    pinCode: setting.pinCode || '',
    status: setting.status || 'active',
    assignedTerminalIds: setting.assignedTerminalIds || [],
    createdAt: setting.createdAt || now,
    updatedAt: now,
    createdBy: setting.createdBy || 'system',
    updatedBy: setting.updatedBy || 'system',
    uid: setting.uid,
    ...overrides,
  };
}

export async function getActiveStaffByVendorAndBranch(vendorId: string, branchId: string): Promise<StaffRecord[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, STAFF_COLLECTION),
      where('vendorId', '==', vendorId),
      where('branchId', '==', branchId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<StaffRecord, 'id'>) }))
      .filter((record) => isActiveStatus(record.status));
  } catch {
    return [];
  }
}

export async function getStaffByVendor(vendorId: string): Promise<StaffRecord[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, STAFF_COLLECTION),
      where('vendorId', '==', vendorId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<StaffRecord, 'id'>) }));
  } catch {
    return [];
  }
}

export async function getStaffById(staffId: string): Promise<StaffRecord | null> {
  if (!db) return null;
  try {
    const ref = doc(db, STAFF_COLLECTION, staffId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as Omit<StaffRecord, 'id'>) };
  } catch {
    return null;
  }
}

export async function createStaff(record: StaffRecord, createdBy: string): Promise<StaffRecord> {
  if (!db) throw new Error('Firestore is not available');
  const now = new Date().toISOString();
  const docData: StaffRecord = {
    ...record,
    createdAt: now,
    updatedAt: now,
    createdBy,
    updatedBy: createdBy,
  };
  const ref = doc(db, STAFF_COLLECTION, docData.id);
  await setDoc(ref, docData);
  return docData;
}

export async function ensureDefaultOwnerStaff(
  vendorId: string,
  ownerName: string
): Promise<StaffRecord> {
  const existing = await getStaffByVendor(vendorId);
  if (existing.length > 0) return existing[0];

  const now = new Date().toISOString();
  const staffId = `owner-${vendorId}`;
  const defaultOwner: StaffRecord = {
    id: staffId,
    vendorId,
    branchId: `${vendorId}_main_branch`,
    staffCode: 'OWNER',
    displayName: ownerName || 'Owner',
    email: '',
    roleId: 'owner',
    roleName: 'Owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
    pinCode: '040369',
    assignedTerminalIds: []
  };

  await createStaff(defaultOwner, 'system');
  return defaultOwner;
}

export async function updateStaff(
  staffId: string,
  updates: Partial<StaffRecord>,
  updatedBy: string
): Promise<StaffRecord | null> {
  if (!db) throw new Error('Firestore is not available');
  const ref = doc(db, STAFF_COLLECTION, staffId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const existing = { id: snap.id, ...(snap.data() as Omit<StaffRecord, 'id'>) };
  const updated: StaffRecord = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  await setDoc(ref, updated, { merge: true });
  return updated;
}

export async function suspendStaff(staffId: string, updatedBy: string): Promise<StaffRecord | null> {
  return updateStaff(staffId, { status: 'suspended' }, updatedBy);
}

export async function validateStaffPin(staffId: string, pin: string): Promise<StaffRecord | null> {
  const record = await getStaffById(staffId);
  if (!record) return null;
  if (!isActiveStatus(record.status)) return null;
  if (record.pinHash && record.pinHash === pin) return record;
  if (record.pinCode && record.pinCode === pin) return record;
  return null;
}

export function canStaffManageStaff(roleName: string): boolean {
  const allowed = ['Owner', 'SysAdmin', 'Manager', 'Supervisor'];
  return allowed.includes(roleName);
}
