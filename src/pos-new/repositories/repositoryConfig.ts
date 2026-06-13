import type { RepositoryDataSourceMode } from './repositoryTypes';

export const repositoryRuntimeConfig = {
  defaultSourceMode: 'MockLocal' as RepositoryDataSourceMode,
  firestoreReadsEnabled: false,
  firestoreWritesEnabled: false,
  firebaseSandboxReadsEnabled: true,
  firebaseSandboxWritesEnabled: true,
  firestoreBusinessReadsEnabled: false,
  firestoreBusinessWritesEnabled: false,
  firebaseAuthShellEnabled: true,
  firebaseAuthRequired: false,
  tenantResolutionEnabled: false,
  staffPinRequired: false,
  buildDevelopmentBypassEnabled: true,
  authRequired: false,
  offlineQueueEnabled: true,
  buildDevelopmentMode: true
};

export function getRepositoryRuntimeConfig() {
  return repositoryRuntimeConfig;
}

export function isFirestoreReadEnabled(): boolean {
  return repositoryRuntimeConfig.firestoreReadsEnabled;
}

export function isFirestoreWriteEnabled(): boolean {
  return repositoryRuntimeConfig.firestoreWritesEnabled;
}

export function isFirebaseSandboxReadEnabled(): boolean {
  return repositoryRuntimeConfig.firebaseSandboxReadsEnabled;
}

export function isFirebaseSandboxWriteEnabled(): boolean {
  return repositoryRuntimeConfig.firebaseSandboxWritesEnabled;
}

export function isFirestoreBusinessReadEnabled(): boolean {
  return repositoryRuntimeConfig.firestoreBusinessReadsEnabled;
}

export function isFirestoreBusinessWriteEnabled(): boolean {
  return repositoryRuntimeConfig.firestoreBusinessWritesEnabled;
}

export function isFirebaseAuthShellEnabled(): boolean {
  return repositoryRuntimeConfig.firebaseAuthShellEnabled;
}

export function isFirebaseAuthRequired(): boolean {
  return repositoryRuntimeConfig.firebaseAuthRequired;
}

export function isTenantResolutionEnabled(): boolean {
  return repositoryRuntimeConfig.tenantResolutionEnabled;
}

export function isStaffPinRequired(): boolean {
  return repositoryRuntimeConfig.staffPinRequired;
}

export function isBuildDevelopmentBypassEnabled(): boolean {
  return repositoryRuntimeConfig.buildDevelopmentBypassEnabled;
}

export function getDefaultRepositoryMode(): RepositoryDataSourceMode {
  return repositoryRuntimeConfig.defaultSourceMode;
}

export function getRepositoryModeForModule(_moduleName: string): RepositoryDataSourceMode {
  return repositoryRuntimeConfig.defaultSourceMode;
}
