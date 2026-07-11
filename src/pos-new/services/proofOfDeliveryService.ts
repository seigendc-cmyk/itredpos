import type { PosSession } from '../types';
import {
  captureProofOfDelivery,
  getProofOfDelivery,
  markDelivered,
  recordPartialDelivery
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export const getProofOfDeliveryRecord = getProofOfDelivery;
export const captureDeliveryProof = captureProofOfDelivery;
export const confirmGoodsDelivered = markDelivered;
export async function capturePartialDeliveryProof(
  deliveryId: string,
  lines: Parameters<typeof recordPartialDelivery>[1],
  staffId: string,
  session?: PosSession | CanonicalPurchaseSession | null
) {
  return recordPartialDelivery(deliveryId, lines, staffId, session);
}
