import type { PosSession } from '../types';
import {
  getDeliveryCashCollection,
  recordCashCollectedByDriver
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export const getDeliveryCashCollectionRecord = getDeliveryCashCollection;

export async function declareDeliveryCashCollected(deliveryId: string, staffId: string, amount: number, notes: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return recordCashCollectedByDriver(deliveryId, staffId, amount, notes, session);
}
