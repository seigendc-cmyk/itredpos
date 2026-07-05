import { moduleRepositoryDescriptors, getModuleRepositoryDescriptor } from '../repositories/moduleRepositoryRegistry';
import {
  getDefaultRepositoryMode,
  isFirebaseSandboxReadEnabled,
  isFirebaseSandboxWriteEnabled,
  isFirestoreBusinessReadEnabled,
  isFirestoreBusinessWriteEnabled
} from '../repositories/repositoryConfig';
import { sandboxAllowedCollections, sandboxBlockedCollections } from '../firebase/firestoreSandboxPaths';
import type { ModuleRepositoryDescriptor } from '../repositories/repositoryTypes';

export function getRepositoryDescriptors(): ModuleRepositoryDescriptor[] {
  return moduleRepositoryDescriptors;
}

export function getRepositoryHealthSummary() {
  const descriptors = getRepositoryDescriptors();
  const mockLocalRepositories = descriptors.filter((descriptor) => descriptor.sourceMode === 'MockLocal' || descriptor.sourceMode === 'LocalStorage').length;
  const firestoreDisabledRepositories = descriptors.filter((descriptor) => descriptor.sourceMode === 'FirestoreDisabled' || descriptor.sourceMode === 'FirestoreReadOnly' || descriptor.sourceMode === 'FirestoreReadWrite').length;
  const liveReadEnabledCount = descriptors.filter((descriptor) => descriptor.liveReadsEnabled).length;
  const liveWriteEnabledCount = descriptors.filter((descriptor) => descriptor.liveWritesEnabled).length;
  const offlineQueueEnabledCount = descriptors.filter((descriptor) => descriptor.offlineQueueEnabled).length;
  const warningCount = descriptors.filter((descriptor) => descriptor.healthStatus === 'Warning' || descriptor.healthStatus === 'Critical').length;

  return {
    totalRepositories: descriptors.length,
    mockLocalRepositories,
    firestoreDisabledRepositories,
    liveReadEnabledCount,
    liveWriteEnabledCount,
    offlineQueueEnabledCount,
    warningCount,
    currentDefaultSourceMode: getDefaultRepositoryMode(),
    sandboxReadsEnabled: isFirebaseSandboxReadEnabled(),
    sandboxWritesEnabled: isFirebaseSandboxWriteEnabled(),
    businessReadsEnabled: isFirestoreBusinessReadEnabled(),
    businessWritesEnabled: isFirestoreBusinessWriteEnabled(),
    sandboxAllowedCollections,
    sandboxBlockedCollections
  };
}

export function getRepositoryReadinessChecklist() {
  const summary = getRepositoryHealthSummary();
  return [
    { label: 'Repository Types', status: 'Ready' },
    { label: 'Default Source Mode', status: summary.currentDefaultSourceMode },
    { label: 'Live Reads', status: summary.liveReadEnabledCount === 0 ? 'Disabled' : 'Enabled' },
    { label: 'Live Writes', status: summary.liveWriteEnabledCount === 0 ? 'Disabled' : 'Enabled' },
    { label: 'Cloud Readiness', status: summary.sandboxReadsEnabled && summary.sandboxWritesEnabled ? 'Enabled' : 'Disabled' },
    { label: 'Business Firestore', status: !summary.businessReadsEnabled && !summary.businessWritesEnabled ? 'Disabled' : 'Enabled' },
    { label: 'Mock / Local Active', status: summary.mockLocalRepositories > 0 ? 'Ready' : 'Missing' },
    { label: 'Offline Queue Boundary', status: summary.offlineQueueEnabledCount > 0 ? 'Ready' : 'Missing' }
  ];
}

export function getModuleRepositoryStatus(moduleName: string): ModuleRepositoryDescriptor | null {
  return getModuleRepositoryDescriptor(moduleName) || null;
}
