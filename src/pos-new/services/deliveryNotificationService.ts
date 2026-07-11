import type { DeliveryWhatsAppMessageDraft, PosSession } from '../types';
import { createWhatsAppMessageDraft, getDeliveryWhatsAppMessageDrafts } from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

export type DeliveryNotificationType =
  | 'Delivery created'
  | 'Delivery assigned'
  | 'Delivery dispatched'
  | 'Driver on the way'
  | 'Driver arrived'
  | 'Delivery completed'
  | 'Delivery delayed'
  | 'Delivery failed'
  | 'Confirmation code sent'
  | 'Cash payment acknowledged';

function toDraftType(type: DeliveryNotificationType): DeliveryWhatsAppMessageDraft['messageType'] {
  if (type === 'Delivery assigned') return 'Driver Assignment';
  if (type === 'Cash payment acknowledged') return 'Vendor Cash Reminder';
  if (type === 'Confirmation code sent') return 'Customer Code';
  return 'Customer Status';
}

export async function prepareDeliveryNotification(deliveryId: string, type: DeliveryNotificationType, session?: PosSession | CanonicalPurchaseSession | null) {
  return createWhatsAppMessageDraft(deliveryId, toDraftType(type), session);
}

export const getDeliveryNotificationPreviews = getDeliveryWhatsAppMessageDrafts;
