export type RepositoryDataSourceMode = 'MockLocal' | 'LocalStorage' | 'FirestoreDisabled' | 'FirestoreReadOnly' | 'FirestoreReadWrite';
export type RepositoryOperationStatus = 'Ready' | 'Disabled' | 'NotConfigured' | 'Error' | 'Pending';
export type RepositoryHealthStatus = 'Healthy' | 'Warning' | 'Critical' | 'Disabled' | 'Unknown';

export interface RepositoryResult<T> {
  success: boolean;
  data?: T;
  errorCode?: string;
  errorMessage?: string;
}

export interface RepositoryListResult<T> {
  success: boolean;
  records: T[];
  errorCode?: string;
  errorMessage?: string;
}

export interface RepositorySubscription {
  unsubscribe: () => void;
}

export interface RepositoryOperationResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status: RepositoryOperationStatus;
  sourceMode: RepositoryDataSourceMode;
  warnings?: string[];
}

export interface RepositoryCollectionResult<T> {
  ok: boolean;
  rows: T[];
  error?: string;
  status: RepositoryOperationStatus;
  sourceMode: RepositoryDataSourceMode;
  warnings?: string[];
}

export interface RepositoryQueryOptions {
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  filters?: Record<string, unknown>;
  limit?: number;
  orderBy?: string;
  includeDeleted?: boolean;
}

export interface RepositoryWriteContext {
  vendorId: string;
  branchId?: string;
  terminalId?: string;
  staffId?: string;
  staffName?: string;
  reason?: string;
  offlineQueueAllowed?: boolean;
}

export interface BaseRepository<T> {
  getById(id: string, context: RepositoryQueryOptions): Promise<RepositoryOperationResult<T | null>>;
  list(options: RepositoryQueryOptions): Promise<RepositoryCollectionResult<T>>;
  create(data: T, context: RepositoryWriteContext): Promise<RepositoryOperationResult<T>>;
  update(id: string, patch: Partial<T>, context: RepositoryWriteContext): Promise<RepositoryOperationResult<T>>;
  softDelete(id: string, context: RepositoryWriteContext): Promise<RepositoryOperationResult<T>>;
}

export interface ModuleRepositoryDescriptor {
  moduleName: string;
  entityName: string;
  collectionPathName: string;
  sourceMode: RepositoryDataSourceMode;
  liveReadsEnabled: boolean;
  liveWritesEnabled: boolean;
  offlineQueueEnabled: boolean;
  healthStatus: RepositoryHealthStatus;
  notes: string;
}

