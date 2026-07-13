import type { SharedAuditRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext } from './repositoryContext';

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditRepository {
  appendAuditRecord(context: RepositoryOperationContext, record: SharedAuditRecord): Promise<{ success: boolean; data?: SharedAuditRecord; errorCode?: string; errorMessage?: string }>;
  listAuditRecords(context: RepositoryOperationContext, filters?: AuditFilters): Promise<{ success: boolean; records: SharedAuditRecord[]; errorCode?: string; errorMessage?: string }>;
}
