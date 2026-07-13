import type { BaseRepository, RepositoryListResult, RepositoryOperationResult } from './repositoryTypes';

const disabledMessage = 'Firestore repository is disabled in build-development mode.';

const disabledOperation = <T>(): RepositoryOperationResult<T> => ({
  ok: false,
  status: 'Disabled',
  sourceMode: 'FirestoreDisabled',
  error: disabledMessage,
  warnings: ['Mock/local services remain active. Firestore reads and writes are not enabled.']
});

const disabledList = <T>(): RepositoryListResult<T> => ({
  ok: false,
  success: false,
  rows: [],
  records: [],
  status: 'Disabled',
  sourceMode: 'FirestoreDisabled',
  error: disabledMessage,
  errorCode: 'REPOSITORY_DISABLED',
  errorMessage: disabledMessage,
  warnings: ['Mock/local services remain active. Firestore reads and writes are not enabled.']
});

export function createDisabledFirestoreRepository<T>(_entityName: string): BaseRepository<T> {
  return {
    getById: async () => disabledOperation<T | null>(),
    list: async () => disabledList<T>(),
    create: async () => disabledOperation<T>(),
    update: async () => disabledOperation<T>(),
    softDelete: async () => disabledOperation<T>()
  };
}

