import type { CommerceEvent } from '../events/commerceEvents';

export function consumeSalesBIEvent(event: CommerceEvent): void {
  console.info('[Sales BI]', event.eventType, event.aggregateId);
}

export function consumeInventoryBIEvent(event: CommerceEvent): void {
  console.info('[Inventory BI]', event.eventType, event.aggregateId);
}

export function consumeProductTransformationBIEvent(event: CommerceEvent): void {
  if (event.eventType === 'TransformationCompleted') {
    console.info('[Transformation BI]', event.eventType, event.aggregateId, event.payload);

    // TODO: Add payload type to CommerceEvent for 'TransformationCompleted'
    const { payload } = event as any;

    // TODO: Fetch full transformation record if not all data is in the payload.
    // const transformation = await getTransformationById(event.aggregateId);
    // const inputLines = await getInputLines(event.aggregateId);
    // const outputLines = await getOutputLines(event.aggregateId);

    // 1. Transformation Cost
    // const transformationCost = payload?.totalInputCost;
    // console.log('BI: Transformation Cost:', transformationCost);

    // 2. Output Value
    // const outputValue = payload?.totalOutputValue;
    // console.log('BI: Output Value:', outputValue);

    // 3. Waste Value: (Transformation Cost - Output Value)
    // const wasteValue = (payload?.totalInputCost || 0) - (payload?.totalOutputValue || 0);

    // 4. Yield Percentage: (Total Output Qty / Total Input Qty) * 100

    // 5. Variance: (Actual Output Qty - Expected Output Qty from BOM). TODO: BOM not in payload.

    // 6. Transformation Profit: (SUM(output.qtyProduced * output.sellingPrice) - Transformation Cost). TODO: sellingPrice not in payload.
  }
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
