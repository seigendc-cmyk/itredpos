import type { AtomicSalePostingResult } from '../../repositories/firestore/FirestoreSalesTransactionRepository';

export type SalesMigrationSource = 'legacyBrowserStorage' | 'manualJson';
export type SalesMigrationStatus = 'draft' | 'previewed' | 'approved' | 'running' | 'partiallyCompleted' | 'completed' | 'failed';
export type SalesMigrationErrorCode = 'VALIDATION_FAILURE' | 'SCOPE_MISMATCH' | 'MOCK_DATA' | 'UNSUPPORTED_STATUS' | 'DUPLICATE_SOURCE' | 'FINGERPRINT_CONFLICT' | 'APPROVAL_INVALID' | 'PERMISSION_DENIED' | 'TRANSIENT_FAILURE' | 'CANONICAL_FAILURE' | 'LEGACY_WRITES_ACTIVE';

export interface SalesMigrationRecord {
  sourceType: SalesMigrationSource;
  sourceKey: string;
  legacyRecordId: string;
  vendorId: string;
  branchId: string;
  sourceVersion: string;
  payload: Record<string, unknown>;
  sourceFingerprint?: string;
  mockData?: boolean;
}
export interface SalesMigrationQuarantineRecord {
  quarantineId: string;
  migrationRunId: string;
  vendorId: string;
  legacyRecordId: string;
  sourceFingerprint?: string;
  codes: SalesMigrationErrorCode[];
  reasons: string[];
  status: 'quarantined';
  createdAt: string;
}
export interface SalesMigrationTotals { saleCount: number; grossMinor: number; paidMinor: number; creditMinor: number; itemQuantity: number; }
export interface SalesMigrationPreview {
  migrationRunId: string;
  vendorId: string;
  branchId: string;
  previewVersion: string;
  sourceFingerprint: string;
  createdAt: string;
  records: SalesMigrationRecord[];
  readyRecords: SalesMigrationRecord[];
  quarantine: SalesMigrationQuarantineRecord[];
  totals: SalesMigrationTotals;
  canApprove: boolean;
  dryRun: true;
}
export interface SalesMigrationApproval { migrationRunId: string; vendorId: string; approvedBy: string; approvedAt: string; approvedSourceFingerprint: string; approvedPreviewVersion: string; migrationVersion: string; }
export interface SalesMigrationCanonicalReferences extends AtomicSalePostingResult { canonicalSaleId: string; mutationReceiptId: string; }
export interface SalesMigrationReceipt {
  receiptId: string;
  migrationRunId: string;
  vendorId: string;
  branchId: string;
  legacyRecordId: string;
  sourceFingerprint: string;
  destinationSaleId: string;
  status: 'processing' | 'completed' | 'failed';
  attemptCount: number;
  leaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  result?: SalesMigrationCanonicalReferences;
  failureCode?: SalesMigrationErrorCode;
}
export interface SalesMigrationResult { legacyRecordId: string; sourceFingerprint: string; status: 'migrated' | 'replayed' | 'failed'; receiptId: string; result?: SalesMigrationCanonicalReferences; errorCode?: SalesMigrationErrorCode; message?: string; retryable: boolean; }
export interface SalesMigrationReconciliation { migrationRunId: string; vendorId: string; status: 'matched' | 'failed'; source: SalesMigrationTotals; destination: SalesMigrationTotals; differences: SalesMigrationTotals; completedAt: string; }
export interface SalesMigrationRun { migrationRunId: string; vendorId: string; status: SalesMigrationStatus; failedRecordCount: number; quarantineCount: number; completedAt?: string; }
export interface SalesCutoverChecks { migrationReceiptsComplete: boolean; reconciliationComplete: boolean; canonicalAuthorityHealthy: boolean; legacyWritesDisabled: boolean; mockDataIsolated: boolean; rulesPassed: boolean; testsPassed: boolean; }
export interface SalesCutoverAssessment { status: 'notReady' | 'ready'; blockers: string[]; }
