export type PurchasingMigrationSource = 'browserStorage' | 'jsonFixture' | 'legacyService' | 'manualImport';
export type PurchasingMigrationRecordType = 'supplier' | 'purchaseOrder' | 'grn' | 'supplierReturn' | 'supplierCreditNote' | 'supplierPayment' | 'paymentReversal' | 'reconciliationProjection';
export type PurchasingMigrationStatus = 'draft' | 'previewed' | 'approved' | 'running' | 'partiallyCompleted' | 'completed' | 'failed' | 'cancelled';
export type PurchasingMigrationRecordStatus = 'pending' | 'migrated' | 'skipped' | 'duplicate' | 'invalid' | 'failed';
export type ReconciliationResult = 'matched' | 'warning' | 'failed';
export type PurchasingMigrationErrorCode = 'VALIDATION_FAILURE' | 'MISSING_DEPENDENCY' | 'DUPLICATE_SOURCE' | 'FINGERPRINT_CONFLICT' | 'PERMISSION_DENIED' | 'APPROVAL_INVALID' | 'WARNING_ACKNOWLEDGEMENT_MISSING' | 'RECONCILIATION_MISMATCH' | 'TRANSIENT_WRITE_FAILURE' | 'NON_RETRYABLE_WRITE_FAILURE' | 'LEGACY_PATH_STILL_ENABLED';

export interface PurchasingMigrationRecord {
  legacySourceType: PurchasingMigrationSource; legacyRecordId: string; legacyParentId?: string;
  vendorId: string; branchId?: string; recordType: PurchasingMigrationRecordType;
  sourceVersion?: string; payload: Record<string, unknown>; sourceFingerprint?: string;
}
export interface PurchasingMigrationIssue { issueId: string; recordId?: string; code: string; severity: 'error' | 'warning'; message: string; acknowledged?: boolean; }
export interface PurchasingMigrationTotals { count: number; monetaryValueMinor: number; quantity: number; }
export interface PurchasingMigrationPreview {
  migrationRunId: string; vendorId: string; branchId?: string; previewVersion: string; sourceFingerprint: string;
  createdAt: string; records: PurchasingMigrationRecord[]; issues: PurchasingMigrationIssue[];
  sourceTotals: Record<string, PurchasingMigrationTotals>; expectedDestinationTotals: Record<string, PurchasingMigrationTotals>;
  canApprove: boolean;
}
export interface PurchasingMigrationApproval { migrationRunId: string; vendorId: string; preparedBy?: string; approvedBy: string; approvedAt: string; approvedSourceFingerprint: string; approvedPreviewVersion: string; acknowledgedWarnings: string[]; warningAcknowledgementVendorId: string; migrationVersion: string; }
export interface PurchasingMigrationCanonicalReferences { canonicalRecordId: string; mutationReceiptId: string; affectedInventoryMovementIds: string[]; affectedSupplierBalanceProjectionIds: string[]; auditReference: string; biEventReference?: string; }
export interface PurchasingMigrationRecordResult { recordId: string; recordType: PurchasingMigrationRecordType; status: PurchasingMigrationRecordStatus; sourceFingerprint: string; destinationId?: string; canonicalReferences?: PurchasingMigrationCanonicalReferences; failureReason?: string; errorCode?: PurchasingMigrationErrorCode; retryable?: boolean; attemptNumber?: number; migratedAt?: string; }
export interface PurchasingMigrationDiagnostic { migrationRunId: string; vendorId: string; branchId?: string; recordId: string; recordType: PurchasingMigrationRecordType; legacyRecordId: string; sourceFingerprint: string; operation: string; result: PurchasingMigrationRecordStatus; errorCode?: PurchasingMigrationErrorCode; errorMessage?: string; retryable: boolean; attemptedAt: string; attemptNumber: number; }
export interface PurchasingMigrationPermissionContext { actorId: string; canApprove: boolean; canSelfApprove: boolean; }
export interface LegacyPurchasingWritePathStatus { path: string; enabled: boolean; }
export interface PurchasingMigrationRun {
  migrationRunId: string; vendorId: string; branchId?: string; sourceType: PurchasingMigrationSource; sourceVersion?: string;
  requestedBy: string; approvedBy?: string; createdAt: string; approvedAt?: string; startedAt?: string; completedAt?: string;
  status: PurchasingMigrationStatus; sourceRecordCount: number; validRecordCount: number; invalidRecordCount: number;
  migratedRecordCount: number; skippedRecordCount: number; failedRecordCount: number; sourceFingerprint: string;
  migrationVersion: string; reconciliationStatus: 'pending' | ReconciliationResult; failureReason?: string;
}
export interface PurchasingMigrationReconciliationItem { metric: string; sourceValue: number; destinationValue: number; difference: number; tolerance: number; result: ReconciliationResult; explanation: string; }
export interface PurchasingMigrationReconciliation { reconciliationId: string; migrationRunId: string; vendorId: string; createdAt: string; status: ReconciliationResult; items: PurchasingMigrationReconciliationItem[]; acknowledgedWarnings: string[]; completed: boolean; }
export type PurchasingCutoverReadiness = 'notReady' | 'readyWithWarnings' | 'ready';
export interface PurchasingCutoverAssessment { status: PurchasingCutoverReadiness; blockers: string[]; warnings: string[]; }
