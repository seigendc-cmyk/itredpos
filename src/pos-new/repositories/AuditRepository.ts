import type { SharedAuditRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext } from './repositoryContext';
import type { RepositoryListResult, RepositoryResult } from './repositoryTypes';

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditRepository {
  appendAuditRecord(context: RepositoryOperationContext, record: SharedAuditRecord): Promise<RepositoryResult<SharedAuditRecord>>;
  listAuditRecords(context: RepositoryOperationContext, filters?: AuditFilters): Promise<RepositoryListResult<SharedAuditRecord>>;
}
