import { doc, getDoc, type Firestore } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import { auth, db, firebaseInitStatus } from '../pos-new/firebase/firebaseApp';
import { firebaseEnvStatus } from '../pos-new/firebase/firebaseConfig';

export type VendorResolutionErrorCode =
  | 'AUTH_LOADING'
  | 'AUTH_REQUIRED'
  | 'VENDOR_USER_NOT_FOUND'
  | 'VENDOR_USER_INACTIVE'
  | 'VENDOR_USER_CONFLICT'
  | 'VENDOR_NOT_FOUND'
  | 'VENDOR_OWNERSHIP_CONFLICT'
  | 'PERMISSION_DENIED'
  | 'FIREBASE_PROJECT_MISMATCH'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_VENDOR_RESOLUTION_ERROR';

export type VendorResolutionResult =
  | { state: 'onboarding'; code: 'VENDOR_USER_NOT_FOUND'; uid: string; email: string }
  | { state: 'resolved'; vendorId: string; vendor: Record<string, unknown> };

export class VendorResolutionError extends Error {
  constructor(
    public readonly code: VendorResolutionErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'VendorResolutionError';
  }
}

type ResolutionDependencies = {
  auth: Pick<Auth, 'currentUser'> | null;
  db: Firestore | null;
  configured: boolean;
  configuredProjectId: string;
  authProjectId?: string;
  firestoreProjectId?: string;
  getDocument: typeof getDoc;
};

export type ExactDocumentReader = (
  collectionName: 'vendorUsers' | 'vendors',
  documentId: string
) => Promise<{ exists: boolean; data?: Record<string, unknown> }>;

const clean = (value: unknown): string => String(value ?? '').trim();
const active = (value: unknown): boolean => clean(value).toLowerCase() === 'active';

function diagnostic(event: string, details: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return;
  console.info('[VendorResolution]', event, details);
}

export function assertVendorResolutionAuth(input: {
  authRestored: boolean;
  currentUser: Pick<User, 'uid' | 'email'> | null;
}): { uid: string; email: string } {
  if (!input.authRestored) {
    throw new VendorResolutionError('AUTH_LOADING', 'Firebase authentication is still loading.');
  }
  if (!input.currentUser?.uid) {
    throw new VendorResolutionError('AUTH_REQUIRED', 'Firebase authentication is required.');
  }
  return { uid: input.currentUser.uid, email: clean(input.currentUser.email).toLowerCase() };
}

export function validateVendorMapping(
  uid: string,
  mapping: Record<string, unknown>
): { vendorId: string } {
  const mappedUid = clean(mapping.uid);
  const vendorId = clean(mapping.vendorId);
  if (mappedUid !== uid || !vendorId || vendorId.includes('/')) {
    throw new VendorResolutionError(
      'VENDOR_USER_CONFLICT',
      'The authenticated user mapping is inconsistent.'
    );
  }
  if (!active(mapping.status)) {
    throw new VendorResolutionError('VENDOR_USER_INACTIVE', 'The vendor membership is inactive.');
  }
  return { vendorId };
}

export function validateResolvedVendor(input: {
  uid: string;
  vendorId: string;
  vendor: Record<string, unknown>;
}): Record<string, unknown> {
  const documentVendorId = clean(input.vendor.vendorId) || input.vendorId;
  if (documentVendorId !== input.vendorId) {
    throw new VendorResolutionError(
      'VENDOR_USER_CONFLICT',
      'The vendor document does not match the authenticated user mapping.'
    );
  }
  if (clean(input.vendor.ownerUid) !== input.uid) {
    throw new VendorResolutionError(
      'VENDOR_OWNERSHIP_CONFLICT',
      'The mapped vendor belongs to a different owner.'
    );
  }
  if (!active(input.vendor.status)) {
    throw new VendorResolutionError('VENDOR_USER_INACTIVE', 'The vendor account is inactive.');
  }
  return { ...input.vendor, vendorId: input.vendorId };
}

export function classifyVendorResolutionError(error: unknown): VendorResolutionError {
  if (error instanceof VendorResolutionError) return error;
  const code = clean((error as { code?: unknown } | null)?.code).toLowerCase();
  if (code.includes('permission-denied')) {
    return new VendorResolutionError(
      'PERMISSION_DENIED',
      'Firestore denied the exact vendor identity read.',
      error
    );
  }
  if (code.includes('unavailable') || code.includes('network') || code.includes('deadline')) {
    return new VendorResolutionError('NETWORK_ERROR', 'The network interrupted vendor resolution.', error);
  }
  return new VendorResolutionError(
    'UNKNOWN_VENDOR_RESOLUTION_ERROR',
    error instanceof Error ? error.message : 'Vendor resolution failed unexpectedly.',
    error
  );
}

export function vendorResolutionMessage(error: VendorResolutionError): string {
  const messages: Record<VendorResolutionErrorCode, string> = {
    AUTH_LOADING: 'Firebase authentication is still loading.',
    AUTH_REQUIRED: 'Sign in with Google to continue.',
    VENDOR_USER_NOT_FOUND: 'No vendor membership exists for this account.',
    VENDOR_USER_INACTIVE: 'This vendor account or membership is inactive.',
    VENDOR_USER_CONFLICT: 'The vendor membership conflicts with the authenticated account.',
    VENDOR_NOT_FOUND: 'The vendor linked to this account no longer exists.',
    VENDOR_OWNERSHIP_CONFLICT: 'The mapped vendor belongs to a different authenticated owner.',
    PERMISSION_DENIED: 'Vendor identity access was denied. Contact support with the diagnostic code.',
    FIREBASE_PROJECT_MISMATCH: 'The app and Firestore project configuration do not match.',
    NETWORK_ERROR: 'The network interrupted vendor validation. Please reconnect and retry.',
    UNKNOWN_VENDOR_RESOLUTION_ERROR: 'Vendor authentication could not be validated.'
  };
  return messages[error.code];
}

export async function resolveVendorFromExactDocuments(input: {
  uid: string;
  email: string;
  readDocument: ExactDocumentReader;
}): Promise<VendorResolutionResult> {
  const mappingSnapshot = await input.readDocument('vendorUsers', input.uid);
  if (!mappingSnapshot.exists) {
    return {
      state: 'onboarding',
      code: 'VENDOR_USER_NOT_FOUND',
      uid: input.uid,
      email: input.email
    };
  }
  const { vendorId } = validateVendorMapping(input.uid, mappingSnapshot.data ?? {});
  const vendorSnapshot = await input.readDocument('vendors', vendorId);
  if (!vendorSnapshot.exists) {
    throw new VendorResolutionError('VENDOR_NOT_FOUND', 'The mapped vendor document does not exist.');
  }
  const vendor = validateResolvedVendor({
    uid: input.uid,
    vendorId,
    vendor: vendorSnapshot.data ?? {}
  });
  return { state: 'resolved', vendorId, vendor };
}

function defaultDependencies(): ResolutionDependencies {
  return {
    auth,
    db,
    configured: firebaseInitStatus.configured,
    configuredProjectId: firebaseEnvStatus.projectId,
    authProjectId: auth?.app.options.projectId,
    firestoreProjectId: db?.app.options.projectId,
    getDocument: getDoc
  };
}

export async function resolveAuthenticatedVendor(
  expectedUid?: string,
  dependencies: ResolutionDependencies = defaultDependencies()
): Promise<VendorResolutionResult> {
  try {
    const authority = assertVendorResolutionAuth({
      authRestored: true,
      currentUser: dependencies.auth?.currentUser ?? null
    });
    if (expectedUid && expectedUid !== authority.uid) {
      throw new VendorResolutionError(
        'VENDOR_USER_CONFLICT',
        'The authenticated account changed during vendor resolution.'
      );
    }
    if (!dependencies.configured || !dependencies.db) {
      throw new VendorResolutionError(
        'FIREBASE_PROJECT_MISMATCH',
        'Firebase is not configured for vendor resolution.'
      );
    }
    const projects = [
      dependencies.configuredProjectId,
      dependencies.authProjectId,
      dependencies.firestoreProjectId
    ].filter(Boolean);
    if (new Set(projects).size !== 1) {
      throw new VendorResolutionError(
        'FIREBASE_PROJECT_MISMATCH',
        'Firebase Auth and Firestore are using different projects.'
      );
    }

    const result = await resolveVendorFromExactDocuments({
      uid: authority.uid,
      email: authority.email,
      readDocument: async (collectionName, documentId) => {
        const path = `${collectionName}/${documentId}`;
        diagnostic('read', {
          projectId: dependencies.configuredProjectId,
          uid: authority.uid,
          path,
          operation: 'getDoc',
          resolutionState: collectionName === 'vendorUsers' ? 'mapping' : 'vendor'
        });
        const snapshot = await dependencies.getDocument(doc(dependencies.db as Firestore, collectionName, documentId));
        return { exists: snapshot.exists(), data: snapshot.exists() ? snapshot.data() : undefined };
      }
    });
    const resolvedPath = result.state === 'resolved'
      ? `vendors/${result.vendorId}`
      : `vendorUsers/${authority.uid}`;
    diagnostic('resolved', {
      projectId: dependencies.configuredProjectId,
      uid: authority.uid,
      path: resolvedPath,
      operation: 'getDoc',
      resolutionState: result.state
    });
    return result;
  } catch (error) {
    const classified = classifyVendorResolutionError(error);
    diagnostic('error', {
      projectId: dependencies.configuredProjectId,
      uid: dependencies.auth?.currentUser?.uid ?? 'signed-out',
      operation: 'getDoc',
      firebaseErrorCode: clean((classified.cause as { code?: unknown } | null)?.code) || classified.code,
      resolutionState: 'blocked'
    });
    throw classified;
  }
}
