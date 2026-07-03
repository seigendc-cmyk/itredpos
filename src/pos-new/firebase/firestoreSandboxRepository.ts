import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc } from 'firebase/firestore';
import { db, firebaseInitStatus, firebaseReady } from './firebaseApp';
import { createFirestoreId, sanitizeDocId } from './firestoreIds';
import { firestoreSandboxPaths, isSandboxCollectionAllowed, sandboxAllowedCollections, sandboxBlockedCollections } from './firestoreSandboxPaths';
import type { FirebaseSandboxHealth, FirebaseSandboxOperation, FirebaseSandboxResult, FirebaseSandboxTestDoc } from './firestoreSandboxTypes';
import { nowIso } from './firestoreTime';
import {
  isFirebaseSandboxReadEnabled,
  isFirebaseSandboxWriteEnabled,
  isFirestoreBusinessReadEnabled,
  isFirestoreBusinessWriteEnabled
} from '../repositories/repositoryConfig';
import { isPOSFirebaseWritesAllowed } from '../auth/posActivationService';

let lastSandboxResult: FirebaseSandboxResult | undefined;

const complete = (
  operation: FirebaseSandboxOperation,
  startedAt: string,
  patch: Omit<FirebaseSandboxResult, 'operation' | 'startedAt' | 'completedAt'>
): FirebaseSandboxResult => {
  const result: FirebaseSandboxResult = {
    operation,
    startedAt,
    completedAt: nowIso(),
    ...patch
  };
  lastSandboxResult = result;
  return result;
};

const unavailable = (operation: FirebaseSandboxOperation, startedAt: string, message: string): FirebaseSandboxResult => complete(operation, startedAt, {
  ok: false,
  status: firebaseInitStatus.configured ? 'Disabled' : 'Not Configured',
  message,
  error: message
});

const assertSandboxReady = (operation: FirebaseSandboxOperation, collectionPath: string, writeOperation: boolean, startedAt: string): FirebaseSandboxResult | null => {
  if (!isSandboxCollectionAllowed(collectionPath)) {
    return complete(operation, startedAt, {
      ok: false,
      status: 'Failed',
      message: 'Blocked - business collections are disabled in this sandbox build.',
      error: `Collection path is not sandbox-allowed: ${collectionPath}`
    });
  }
  if (!firebaseReady || !db) {
    return unavailable(operation, startedAt, 'Firebase is not configured or Firestore shell is not available.');
  }
  if (writeOperation && (!isFirebaseSandboxWriteEnabled() || !isPOSFirebaseWritesAllowed())) {
    return unavailable(operation, startedAt, 'Firebase writes are disabled for the current POS activation.');
  }
  if (!writeOperation && !isFirebaseSandboxReadEnabled()) {
    return unavailable(operation, startedAt, 'Firebase sandbox reads are disabled.');
  }
  return null;
};

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : 'Unknown Firebase sandbox error.';

const normalizeRow = (raw: Record<string, unknown>, docId: string): FirebaseSandboxTestDoc => ({
  id: typeof raw.id === 'string' ? raw.id : docId,
  vendorId: typeof raw.vendorId === 'string' ? raw.vendorId : undefined,
  title: typeof raw.title === 'string' ? raw.title : 'Sandbox Test',
  message: typeof raw.message === 'string' ? raw.message : '',
  testNumber: typeof raw.testNumber === 'number' ? raw.testNumber : Number(raw.testNumber || 0),
  status: typeof raw.status === 'string' ? raw.status : 'Active',
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : nowIso(),
  updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  deleted: Boolean(raw.deleted),
  deletedAt: typeof raw.deletedAt === 'string' ? raw.deletedAt : undefined,
  source: typeof raw.source === 'string' ? raw.source : 'Firebase Sandbox',
  notes: typeof raw.notes === 'string' ? raw.notes : undefined
});

export function getFirebaseSandboxHealth(): FirebaseSandboxHealth {
  return {
    configured: firebaseInitStatus.configured,
    appInitialized: firebaseInitStatus.appInitialized,
    firestoreAvailable: firebaseInitStatus.firestoreAvailable,
    sandboxWritesEnabled: isFirebaseSandboxWriteEnabled() && isPOSFirebaseWritesAllowed(),
    sandboxReadsEnabled: isFirebaseSandboxReadEnabled(),
    businessWritesEnabled: isFirestoreBusinessWriteEnabled(),
    businessReadsEnabled: isFirestoreBusinessReadEnabled(),
    allowedCollections: sandboxAllowedCollections,
    blockedCollections: sandboxBlockedCollections,
    lastResult: lastSandboxResult
  };
}

export async function runSandboxConnectivityCheck(): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const collectionPath = firestoreSandboxPaths.globalConnectivityTests();
  const ready = assertSandboxReady('Connectivity Check', collectionPath, false, startedAt);
  if (ready) return ready;
  try {
    await getDocs(query(collection(db, collectionPath), limit(1)));
    return complete('Connectivity Check', startedAt, {
      ok: true,
      status: 'Success',
      message: 'Firestore sandbox connectivity check completed.'
    });
  } catch (error) {
    return complete('Connectivity Check', startedAt, {
      ok: false,
      status: 'Failed',
      message: 'Firestore sandbox connectivity check failed.',
      error: errorMessage(error)
    });
  }
}

export async function createSandboxTestDoc(payload: Partial<FirebaseSandboxTestDoc> & { collectionPath: string }): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const ready = assertSandboxReady('Create Test Doc', payload.collectionPath, true, startedAt);
  if (ready) return ready;
  const docId = sanitizeDocId(payload.id || createFirestoreId('sandbox'));
  const timestamp = nowIso();
  const testDoc: FirebaseSandboxTestDoc = {
    id: docId,
    vendorId: payload.vendorId,
    title: payload.title || 'Sandbox Test Doc',
    message: payload.message || 'Firebase sandbox test document.',
    testNumber: Number(payload.testNumber || 0),
    status: payload.status || 'Active',
    createdAt: payload.createdAt || timestamp,
    updatedAt: timestamp,
    deleted: false,
    source: payload.source || 'Firebase Sandbox',
    notes: payload.notes
  };
  try {
    await setDoc(doc(collection(db, payload.collectionPath), docId), testDoc);
    return complete('Create Test Doc', startedAt, {
      ok: true,
      status: 'Success',
      message: 'Sandbox test document created.',
      docId,
      rows: [testDoc]
    });
  } catch (error) {
    return complete('Create Test Doc', startedAt, {
      ok: false,
      status: 'Failed',
      message: 'Sandbox test document create failed.',
      docId,
      error: errorMessage(error)
    });
  }
}

export async function readSandboxTestDoc(collectionPath: string, docId: string): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const ready = assertSandboxReady('Read Test Doc', collectionPath, false, startedAt);
  if (ready) return ready;
  try {
    const snapshot = await getDoc(doc(collection(db, collectionPath), sanitizeDocId(docId)));
    if (!snapshot.exists()) {
      return complete('Read Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document not found.', docId });
    }
    return complete('Read Test Doc', startedAt, {
      ok: true,
      status: 'Success',
      message: 'Sandbox document read completed.',
      docId,
      rows: [normalizeRow(snapshot.data(), snapshot.id)]
    });
  } catch (error) {
    return complete('Read Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document read failed.', docId, error: errorMessage(error) });
  }
}

export async function listSandboxTestDocs(collectionPath: string): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const ready = assertSandboxReady('List Test Docs', collectionPath, false, startedAt);
  if (ready) return ready;
  try {
    const snapshot = await getDocs(query(collection(db, collectionPath), limit(25)));
    const rows = snapshot.docs.map((row) => normalizeRow(row.data(), row.id));
    return complete('List Test Docs', startedAt, {
      ok: true,
      status: 'Success',
      message: `Listed ${rows.length} sandbox document(s).`,
      rows
    });
  } catch (error) {
    return complete('List Test Docs', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document list failed.', error: errorMessage(error) });
  }
}

export async function updateSandboxTestDoc(collectionPath: string, docId: string, patch: Partial<FirebaseSandboxTestDoc>): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const safeDocId = sanitizeDocId(docId);
  const ready = assertSandboxReady('Update Test Doc', collectionPath, true, startedAt);
  if (ready) return ready;
  try {
    const target = doc(collection(db, collectionPath), safeDocId);
    const snapshot = await getDoc(target);
    if (!snapshot.exists()) return complete('Update Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document not found.', docId: safeDocId });
    if (snapshot.data().deleted) return complete('Update Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Deleted sandbox documents cannot be updated.', docId: safeDocId });
    await updateDoc(target, { ...patch, updatedAt: nowIso() });
    return readSandboxTestDoc(collectionPath, safeDocId);
  } catch (error) {
    return complete('Update Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document update failed.', docId: safeDocId, error: errorMessage(error) });
  }
}

export async function softDeleteSandboxTestDoc(collectionPath: string, docId: string): Promise<FirebaseSandboxResult> {
  const startedAt = nowIso();
  const safeDocId = sanitizeDocId(docId);
  const ready = assertSandboxReady('Soft Delete Test Doc', collectionPath, true, startedAt);
  if (ready) return ready;
  try {
    const target = doc(collection(db, collectionPath), safeDocId);
    const snapshot = await getDoc(target);
    if (!snapshot.exists()) return complete('Soft Delete Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document not found.', docId: safeDocId });
    const deletedAt = nowIso();
    await updateDoc(target, { deleted: true, deletedAt, updatedAt: deletedAt, status: 'Deleted' });
    return complete('Soft Delete Test Doc', startedAt, {
      ok: true,
      status: 'Success',
      message: 'Sandbox document soft deleted.',
      docId: safeDocId
    });
  } catch (error) {
    return complete('Soft Delete Test Doc', startedAt, { ok: false, status: 'Failed', message: 'Sandbox document soft delete failed.', docId: safeDocId, error: errorMessage(error) });
  }
}

export function clearSandboxLocalResultHistory(): void {
  lastSandboxResult = undefined;
}
