import type { CommerceEvent, CommerceEventInput } from './commerceEvents';
import { dispatchCommerceEvent } from './eventDispatcher';

function createCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function publishCommerceEvent(input: CommerceEventInput): Promise<CommerceEvent> {
  const event: CommerceEvent = {
    ...input,
    version: 1,
    sourceApp: input.sourceApp ?? 'iTredPOS',
    sourceModule: input.sourceModule ?? input.module ?? 'Unknown',
    aggregateType: input.aggregateType ?? input.entityType ?? 'Unknown',
    aggregateId: input.aggregateId ?? input.entityId ?? 'unknown',
    correlationId: input.correlationId ?? createCorrelationId(),
    riskScore: input.riskScore ?? 0,
    occurredAt: new Date().toISOString(),
  };

  console.info('[CommerceEvent]', event);

  await dispatchCommerceEvent(event);

  return event;
}
