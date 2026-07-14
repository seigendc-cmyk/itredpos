import type { RefundSaleCommand, SalesListFilters, SalesRecordDetails, SalesReversalResult, SalesTransactionCommit, CommittedSalesTransaction } from '../repositories/SalesRepository';
import { createRepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';
import type { PosSaleHeader } from './salesCheckoutService';

export async function commitSalesTransaction(context: RepositoryOperationContext, input: SalesTransactionCommit): Promise<CommittedSalesTransaction> {
  const result = await createRepositoryBundle().sales.commitSaleTransaction(context, input);
  if (!result.success || !result.data) throw new Error(result.errorMessage || 'Sales transaction could not be committed.');
  return result.data;
}

export async function listCommittedSales(context: RepositoryOperationContext, filters?: SalesListFilters): Promise<PosSaleHeader[]> {
  const result = await createRepositoryBundle().sales.listSales(context, filters);
  if (!result.success) throw new Error(result.errorMessage || 'Sales history could not be loaded.');
  return result.records;
}

export async function getCommittedSaleDetails(context: RepositoryOperationContext, saleId: string): Promise<SalesRecordDetails> {
  const result = await createRepositoryBundle().sales.getSaleDetails(context, saleId);
  if (!result.success || !result.data) throw new Error(result.errorMessage || 'Sale details could not be loaded.');
  return result.data;
}

export function subscribeCommittedSales(context: RepositoryOperationContext, listener: (records: PosSaleHeader[]) => void): RepositorySubscription {
  return createRepositoryBundle().sales.subscribeSales(context, listener);
}

export async function voidSaleCommand(context: RepositoryOperationContext, saleId: string, reason: string): Promise<SalesReversalResult> {
  const result = await createRepositoryBundle().sales.voidSale(context, saleId, reason);
  if (!result.success || !result.data) throw new Error(result.errorMessage || 'Sale could not be voided.');
  return result.data;
}

export async function refundSaleCommand(context: RepositoryOperationContext, command: RefundSaleCommand & { saleId: string }): Promise<SalesReversalResult> {
  const result = await createRepositoryBundle().sales.refundSale(context, command.saleId, command);
  if (!result.success || !result.data) throw new Error(result.errorMessage || 'Sale could not be refunded.');
  return result.data;
}
