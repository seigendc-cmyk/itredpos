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
  staffSessionGateEnabled: true,
  staffSessionGateRequired: false,
  staffPinVerificationEnabled: true,
  staffPinRequired: false,
  roleMenuFilteringEnabled: true,
  strictPermissionEnforcementEnabled: false,
  buildDevelopmentBypassEnabled: true,
  buildDevelopmentOwnerBypassEnabled: true,
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

export function isStaffSessionGateEnabled(): boolean {
  return repositoryRuntimeConfig.staffSessionGateEnabled;
}

export function isStaffSessionGateRequired(): boolean {
  return repositoryRuntimeConfig.staffSessionGateRequired;
}

export function isStaffPinVerificationEnabled(): boolean {
  return repositoryRuntimeConfig.staffPinVerificationEnabled;
}

export function isRoleMenuFilteringEnabled(): boolean {
  return repositoryRuntimeConfig.roleMenuFilteringEnabled;
}

export function isStrictPermissionEnforcementEnabled(): boolean {
  return repositoryRuntimeConfig.strictPermissionEnforcementEnabled;
}

export function isBuildDevelopmentBypassEnabled(): boolean {
  return repositoryRuntimeConfig.buildDevelopmentBypassEnabled;
}

export function isBuildDevelopmentOwnerBypassEnabled(): boolean {
  return repositoryRuntimeConfig.buildDevelopmentOwnerBypassEnabled;
}

export function getDefaultRepositoryMode(): RepositoryDataSourceMode {
  return repositoryRuntimeConfig.defaultSourceMode;
}

export function getRepositoryModeForModule(_moduleName: string): RepositoryDataSourceMode {
  return repositoryRuntimeConfig.defaultSourceMode;
}
