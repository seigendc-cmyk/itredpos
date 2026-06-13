import { createDisabledFirestoreRepository } from './disabledFirestoreRepository';
import { createMockLocalRepository } from './mockLocalRepository';
import type { BaseRepository, ModuleRepositoryDescriptor } from './repositoryTypes';

export function createRepository<T extends { id?: string }>(
  descriptor: ModuleRepositoryDescriptor,
  initialRows: T[] = []
): BaseRepository<T> {
  if (descriptor.sourceMode === 'MockLocal') {
    return createMockLocalRepository({ entityName: descriptor.entityName, initialRows });
  }

  if (descriptor.sourceMode === 'LocalStorage') {
    return createMockLocalRepository({
      entityName: descriptor.entityName,
      initialRows,
      persistKey: `itred_repo_${descriptor.entityName}`
    });
  }

  return createDisabledFirestoreRepository<T>(descriptor.entityName);
}

