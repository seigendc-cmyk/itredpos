import type { FirestoreJsonRecord } from './firestoreContracts';

export type FirebaseSandboxStatus = 'Ready' | 'Not Configured' | 'Disabled' | 'Error' | 'Running' | 'Success' | 'Failed';
export type FirebaseSandboxOperation =
  | 'Connectivity Check'
  | 'Create Test Doc'
  | 'Read Test Doc'
  | 'Update Test Doc'
  | 'Soft Delete Test Doc'
  | 'List Test Docs';

export interface FirebaseSandboxTestDoc extends FirestoreJsonRecord {
  id: string;
  vendorId?: string;
  title: string;
  message: string;
  testNumber: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  deletedAt?: string;
  source: string;
  notes?: string;
}

export interface FirebaseSandboxResult {
  ok: boolean;
  operation: FirebaseSandboxOperation;
  status: FirebaseSandboxStatus;
  message: string;
  docId?: string;
  rows?: FirebaseSandboxTestDoc[];
  error?: string;
  startedAt: string;
  completedAt: string;
}

export interface FirebaseSandboxHealth {
  configured: boolean;
  appInitialized: boolean;
  firestoreAvailable: boolean;
  sandboxWritesEnabled: boolean;
  sandboxReadsEnabled: boolean;
  businessWritesEnabled: boolean;
  businessReadsEnabled: boolean;
  allowedCollections: string[];
  blockedCollections: string[];
  lastResult?: FirebaseSandboxResult;
}

