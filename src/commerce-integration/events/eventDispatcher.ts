import type { CommerceEvent } from './commerceEvents';
import {
  consumeSalesBIEvent,
  consumeInventoryBIEvent,
  consumeProductTransformationBIEvent,
  consumeMarketingBIEvent,
  consumeDeliveryBIEvent,
  consumeOperationsBIEvent,
  consumeCustomerBIEvent,
} from '../bi';

export async function dispatchCommerceEvent(event: CommerceEvent): Promise<void> {
  switch (event.eventType) {
    case 'SaleCreated':
    case 'SaleCompleted':
    case 'SaleCancelled':
    case 'SaleRefunded':
      consumeSalesBIEvent(event);
      consumeCustomerBIEvent(event);
      break;

    case 'StockReceived':
    case 'StockIssued':
    case 'StockAdjusted':
    case 'StockTransferred':
    case 'StockCounted':
    case 'StockDamaged':
    case 'StockExpired':
    case 'PurchaseReceived':
      consumeInventoryBIEvent(event);
      break;

    case 'TransformationCreated':
    case 'TransformationCompleted':
    case 'TransformationCancelled':
      consumeProductTransformationBIEvent(event);
      consumeInventoryBIEvent(event);
      break;

    case 'CatalogueViewed':
    case 'ProductViewed':
    case 'VendorViewed':
    case 'WhatsAppClicked':
    case 'EnquiryCreated':
      consumeMarketingBIEvent(event);
      consumeCustomerBIEvent(event);
      break;

    case 'DeliveryRequested':
    case 'DriverAssigned':
    case 'DriverAccepted':
    case 'PickedUp':
    case 'GPSUpdated':
    case 'Delivered':
    case 'DeliveryConfirmed':
    case 'CashCollected':
      consumeDeliveryBIEvent(event);
      break;

    case 'ShiftOpened':
    case 'ShiftClosed':
      consumeOperationsBIEvent(event);
      break;

    default:
      consumeOperationsBIEvent(event);
      break;
  }
}
