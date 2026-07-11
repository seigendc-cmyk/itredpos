import type { PosSession } from '../types';
import {
  confirmDeliveryCashReceived,
  getDeliveryCashHandovers
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export const getDeliveryCashHandoverHistory = getDeliveryCashHandovers;

export async function acceptDeliveryCashHandover(deliveryId: string, receivingStaffId: string, amountCounted: number, notes: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return confirmDeliveryCashReceived(deliveryId, receivingStaffId, amountCounted, notes, session);
}
