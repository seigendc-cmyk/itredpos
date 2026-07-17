import type { CommerceSourceApp } from '../firebase/commerceDataContract';
export type { CommerceSourceApp } from '../firebase/commerceDataContract';

export interface RepositoryOperationContext {
  vendorId: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  staffId?: string;
  actorId: string;
  actorRole?: string;
  sourceApp: CommerceSourceApp;
  correlationId: string;
  idempotencyKey?: string;
  occurredAt?: string;
  source?: string;
  deviceId?: string;
}

export interface PurchasingMutationContext extends RepositoryOperationContext {
  staffId: string;
  actorRole: string;
  idempotencyKey: string;
  occurredAt: string;
  source: string;
}

export interface RepositorySubscription {
  unsubscribe: () => void;
}

export function validatePurchasingMutationContext(context: RepositoryOperationContext): asserts context is PurchasingMutationContext {
  validateRepositoryOperationContext(context);
  const required: Array<[string | undefined, string]> = [
    [context.staffId, 'staffId'], [context.actorRole, 'actorRole'], [context.idempotencyKey, 'idempotencyKey'],
    [context.occurredAt, 'occurredAt'], [context.source, 'source']
  ];
  const missing = required.filter(([value]) => blankOrWhitespace(value)).map(([, name]) => name);
  if (missing.length) throw new Error(`Purchasing mutation context requires ${missing.join(', ')}.`);
}

const blankOrWhitespace = (value: string | undefined | null): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

export function validateRepositoryOperationContext(context: RepositoryOperationContext): void {
  const errors: string[] = [];
  if (blankOrWhitespace(context.vendorId)) {
    errors.push('RepositoryOperationContext.vendorId must be a non-blank, non-whitespace string.');
  }
  if (blankOrWhitespace(context.actorId)) {
    errors.push('RepositoryOperationContext.actorId must be a non-blank, non-whitespace string.');
  }
  if (blankOrWhitespace(context.sourceApp)) {
    errors.push('RepositoryOperationContext.sourceApp must be a non-blank, non-whitespace string.');
  }
  if (blankOrWhitespace(context.correlationId)) {
    errors.push('RepositoryOperationContext.correlationId must be a non-blank, non-whitespace string.');
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
