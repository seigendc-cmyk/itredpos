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
}

export interface RepositorySubscription {
  unsubscribe: () => void;
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
