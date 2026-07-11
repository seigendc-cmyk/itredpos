import type { PosSession } from '../types';
import {
  acceptDelivery,
  assignVendorDriver,
  dispatchDelivery,
  selectDeliveryProvider
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export async function assignDeliveryTeam(deliveryId: string, providerId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return assignVendorDriver(deliveryId, providerId, staffId, session);
}

export async function chooseDeliveryPartner(deliveryId: string, providerId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return selectDeliveryProvider(deliveryId, providerId, staffId, session);
}

export async function acceptAssignedDelivery(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return acceptDelivery(deliveryId, staffId, session);
}

export async function dispatchAssignedDelivery(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return dispatchDelivery(deliveryId, staffId, session);
}
