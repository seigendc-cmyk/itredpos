/**
 * Provides a unified context for commerce operations, including all necessary
 * identifiers for tenancy, location, actors, and correlation. This ensures
 * consistent eventing and auditing across different business modules.
 */
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