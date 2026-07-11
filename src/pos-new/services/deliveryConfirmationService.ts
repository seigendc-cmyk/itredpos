import type { PosSession } from '../types';
import {
  createWhatsAppMessageDraft,
  getDeliveryConfirmationCode,
  verifyDeliveryCode
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export async function issueDeliveryConfirmationCode(deliveryId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  await createWhatsAppMessageDraft(deliveryId, 'Customer Code', session);
  return getDeliveryConfirmationCode(deliveryId);
}

export async function verifyCustomerDeliveryCode(deliveryId: string, code: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return verifyDeliveryCode(deliveryId, code, staffId, session);
}
