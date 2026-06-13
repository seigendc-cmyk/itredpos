import type { BaseRepository, RepositoryOperationResult, RepositoryWriteContext } from './repositoryTypes';

export function wrapRepositoryResult<T>(result: RepositoryOperationResult<T>): RepositoryOperationResult<T> {
  return {
    ...result,
    warnings: result.warnings || []
  };
}

export function mapRepositoryError<T>(result: RepositoryOperationResult<T>): string {
  if (result.ok) return '';
  return result.error || 'Repository operation failed.';
}

export function shouldQueueOfflineWrite(context: RepositoryWriteContext): boolean {
  return Boolean(context.offlineQueueAllowed && context.vendorId);
}

export function createServiceReadBoundary<T>(moduleName: string, repository: BaseRepository<T>) {
  return {
    moduleName,
    getById: repository.getById,
    list: repository.list
  };
}

export function createServiceWriteBoundary<T>(moduleName: string, repository: BaseRepository<T>) {
  return {
    moduleName,
    create: repository.create,
    update: repository.update,
    softDelete: repository.softDelete
  };
}

export function createDisabledWriteBoundary(moduleName: string) {
  const disabled = async (): Promise<RepositoryOperationResult<null>> => ({
    ok: false,
    data: null,
    status: 'Disabled',
    sourceMode: 'FirestoreDisabled',
    error: 'Repository write boundary is disabled in build-development mode.',
    warnings: [`${moduleName} still uses existing mock/local service logic.`]
  });

  return {
    moduleName,
    create: disabled,
    update: disabled,
    softDelete: disabled
  };
}

