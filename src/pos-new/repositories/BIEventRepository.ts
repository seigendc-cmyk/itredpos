import type { SharedBIEventRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface BIEventFilters {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

export interface BIEventRepository {
  publishEvent(context: RepositoryOperationContext, event: SharedBIEventRecord): Promise<{ success: boolean; data?: SharedBIEventRecord; errorCode?: string; errorMessage?: string }>;
  listEvents(context: RepositoryOperationContext, filters?: BIEventFilters): Promise<{ success: boolean; records: SharedBIEventRecord[]; errorCode?: string; errorMessage?: string }>;
  subscribeEvents(context: RepositoryOperationContext, listener: (records: SharedBIEventRecord[]) => void): RepositorySubscription;
}
