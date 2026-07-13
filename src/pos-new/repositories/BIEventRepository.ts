import type { SharedBIEventRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';
import type { RepositoryListResult, RepositoryResult } from './repositoryTypes';

export interface BIEventFilters {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

export interface BIEventRepository {
  publishEvent(context: RepositoryOperationContext, event: SharedBIEventRecord): Promise<RepositoryResult<SharedBIEventRecord>>;
  listEvents(context: RepositoryOperationContext, filters?: BIEventFilters): Promise<RepositoryListResult<SharedBIEventRecord>>;
  subscribeEvents(context: RepositoryOperationContext, listener: (records: SharedBIEventRecord[]) => void): RepositorySubscription;
}
