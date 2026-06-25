import type { CommerceEvent } from '../events/commerceEvents';

export function consumeSalesBIEvent(event: CommerceEvent): void {
  console.info('[Sales BI]', event.eventType, event.aggregateId);
}

export function consumeInventoryBIEvent(event: CommerceEvent): void {
  console.info('[Inventory BI]', event.eventType, event.aggregateId);
}

export function consumeProductTransformationBIEvent(event: CommerceEvent): void {
  console.info('[Transformation BI]', event.eventType, event.aggregateId);
}

export function consumeMarketingBIEvent(event: CommerceEvent): void {
  console.info('[Marketing BI]', event.eventType, event.aggregateId);
}

export function consumeDeliveryBIEvent(event: CommerceEvent): void {
  console.info('[Delivery BI]', event.eventType, event.aggregateId);
}

export function consumeOperationsBIEvent(event: CommerceEvent): void {
  console.info('[Operations BI]', event.eventType, event.aggregateId);
}

export function consumeCustomerBIEvent(event: CommerceEvent): void {
  console.info('[Customer BI]', event.eventType, event.aggregateId);
}
