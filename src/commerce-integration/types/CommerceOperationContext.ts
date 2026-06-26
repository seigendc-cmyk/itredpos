export interface CommerceOperationContext {
  vendorId: string;
  branchId: string;

  warehouseId?: string;
  terminalId?: string;

  staffId: string;

  customerId?: string;
  supplierId?: string;

  sourceBranchId?: string;
  destinationBranchId?: string;

  correlationId?: string;
}
