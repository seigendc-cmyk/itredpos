import type { SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import type { PosCashMovementRecord, PosPaymentRecord, PosSaleHeader, PosSaleLine } from '../services/salesCheckoutService';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';
import type { RepositoryResult } from './repositoryTypes';

export interface SalesTransactionInventoryLine {
  productId: string;
  quantity: number;
  unitCost: number;
  branchId: string;
  warehouseId: string;
}

export interface SalesTransactionCommit {
  idempotencyKey: string;
  sale: PosSaleHeader;
  saleLines: PosSaleLine[];
  payments: PosPaymentRecord[];
  inventoryLines: SalesTransactionInventoryLine[];
  shiftId: string;
  cashMovement?: PosCashMovementRecord;
  auditRecord: Record<string, unknown>;
  biEvent: Record<string, unknown>;
}

export interface CommittedSalesTransaction {
  sale: PosSaleHeader;
  saleLines: PosSaleLine[];
  payments: PosPaymentRecord[];
  inventoryMovements: SharedInventoryMovementRecord[];
  cashMovement?: PosCashMovementRecord;
  duplicate: boolean;
}

export interface SalesListFilters {
  branchId?: string;
  terminalId?: string;
  customerId?: string;
  status?: PosSaleHeader['saleStatus'];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface SalesRecordDetails {
  sale: PosSaleHeader;
  saleLines: PosSaleLine[];
  payments: PosPaymentRecord[];
}

export interface RefundSaleLineCommand {
  saleLineId: string;
  quantity: number;
}

export interface RefundSaleCommand {
  idempotencyKey: string;
  lines: RefundSaleLineCommand[];
  reason: string;
  notes?: string;
}

export interface SalesReversalResult {
  reversalId: string;
  reversalType: 'REFUND' | 'VOID';
  sale: PosSaleHeader;
  refundedLines: RefundSaleLineCommand[];
  refundPayments: PosPaymentRecord[];
  inventoryMovements: SharedInventoryMovementRecord[];
  cashMovement?: PosCashMovementRecord;
  duplicate: boolean;
}

export interface SalesRepository {
  commitSaleTransaction(context: RepositoryOperationContext, input: SalesTransactionCommit): Promise<RepositoryResult<CommittedSalesTransaction>>;
  listSales(context: RepositoryOperationContext, filters?: SalesListFilters): Promise<{ success: boolean; records: PosSaleHeader[]; errorCode?: string; errorMessage?: string }>;
  getSaleDetails(context: RepositoryOperationContext, saleId: string): Promise<RepositoryResult<SalesRecordDetails>>;
  subscribeSales(context: RepositoryOperationContext, listener: (records: PosSaleHeader[]) => void): RepositorySubscription;
  voidSale(context: RepositoryOperationContext, saleId: string, reason: string): Promise<RepositoryResult<SalesReversalResult>>;
  refundSale(context: RepositoryOperationContext, saleId: string, command: RefundSaleCommand): Promise<RepositoryResult<SalesReversalResult>>;
}
