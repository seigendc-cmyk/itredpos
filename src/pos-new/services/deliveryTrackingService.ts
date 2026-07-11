import type { PosSession } from '../types';
import {
  addTrackingEvent,
  createCustomerTrackingToken,
  getCustomerDeliveryTrackingView,
  getDeliveryTrackingEvents,
  markArrived
} from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export const getDeliveryTrackingPoints = getDeliveryTrackingEvents;
export const createLimitedCustomerTrackingToken = createCustomerTrackingToken;
export const getLimitedCustomerTrackingView = getCustomerDeliveryTrackingView;

export async function recordDeliveryTrackingPoint(
  deliveryId: string,
  payload: Parameters<typeof addTrackingEvent>[1],
  session?: PosSession | CanonicalPurchaseSession | null
) {
  return addTrackingEvent(deliveryId, payload, session);
}

export async function recordDriverArrived(deliveryId: string, staffId: string, session?: PosSession | CanonicalPurchaseSession | null) {
  return markArrived(deliveryId, staffId, session);
}
