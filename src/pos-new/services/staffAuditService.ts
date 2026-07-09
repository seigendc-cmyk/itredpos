import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';

export type StaffAuditEventType =
  | 'STAFF_CREATED'
  | 'STAFF_UPDATED'
  | 'STAFF_SUSPENDED'
  | 'STAFF_LOGIN_SUCCESS'
  | 'STAFF_LOGIN_FAILED';

export interface StaffAuditEvent {
  vendorId: string;
  branchId: string;
  terminalId?: string;
  staffId: string;
  roleId: string;
  eventType: StaffAuditEventType;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export async function recordStaffAuditEvent(event: StaffAuditEvent): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, 'staffAuditEvents'), {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });
  } catch {
    // best-effort audit logging
  }
}
