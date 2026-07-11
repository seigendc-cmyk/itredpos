import type { PosSession } from '../types';
import {
  POS_SESSION_INCOMPLETE_MESSAGE,
  assertCanonicalPurchaseSession,
  getCanonicalPurchaseSession,
  hasPurchasePermission,
  type CanonicalPurchaseSession
} from './purchaseSessionService';

export type CanonicalInventoryContext = CanonicalPurchaseSession;

export const INVENTORY_SESSION_INCOMPLETE_MESSAGE = POS_SESSION_INCOMPLETE_MESSAGE;

export function getCanonicalInventoryContext(session?: PosSession | CanonicalInventoryContext | null): CanonicalInventoryContext | null {
  return getCanonicalPurchaseSession(session);
}

export function assertCanonicalInventoryContext(session?: PosSession | CanonicalInventoryContext | null): CanonicalInventoryContext {
  return assertCanonicalPurchaseSession(session);
}

export function hasInventoryPermission(session: CanonicalInventoryContext, permission: string): boolean {
  return hasPurchasePermission(session, permission);
}

export function assertInventoryPermission(
  session: CanonicalInventoryContext,
  permission: string,
  message = 'You do not have permission to perform this inventory action.'
): void {
  if (!hasInventoryPermission(session, permission)) {
    throw new Error(message);
  }
}

export function assertInventoryContextForRecord(
  session: CanonicalInventoryContext,
  record: { vendorId: string; branchId?: string; warehouseId?: string }
): void {
  if (
    record.vendorId !== session.vendorId ||
    (record.branchId !== undefined && record.branchId !== session.branchId) ||
    (record.warehouseId !== undefined && record.warehouseId !== session.warehouseId)
  ) {
    throw new Error(INVENTORY_SESSION_INCOMPLETE_MESSAGE);
  }
}
