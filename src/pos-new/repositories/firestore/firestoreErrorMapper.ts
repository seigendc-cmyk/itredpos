export const REPOSITORY_ERROR_CODES = {
  PERMISSION_DENIED: 'REPOSITORY_PERMISSION_DENIED',
  UNAUTHENTICATED: 'REPOSITORY_UNAUTHENTICATED',
  NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  ALREADY_EXISTS: 'REPOSITORY_ALREADY_EXISTS',
  FAILED_PRECONDITION: 'REPOSITORY_FAILED_PRECONDITION',
  UNAVAILABLE: 'REPOSITORY_UNAVAILABLE',
  DEADLINE_EXCEEDED: 'REPOSITORY_DEADLINE_EXCEEDED',
  RESOURCE_EXHAUSTED: 'REPOSITORY_RESOURCE_EXHAUSTED',
  UNKNOWN: 'REPOSITORY_UNKNOWN'
} as const;

export type RepositoryErrorCode =
  (typeof REPOSITORY_ERROR_CODES)[keyof typeof REPOSITORY_ERROR_CODES];

export interface RepositoryError {
  errorCode: RepositoryErrorCode;
  errorMessage: string;
}

const FIREBASE_CODE_MAP: Record<string, RepositoryErrorCode> = {
  'permission-denied': REPOSITORY_ERROR_CODES.PERMISSION_DENIED,
  'unauthenticated': REPOSITORY_ERROR_CODES.UNAUTHENTICATED,
  'not-found': REPOSITORY_ERROR_CODES.NOT_FOUND,
  'already-exists': REPOSITORY_ERROR_CODES.ALREADY_EXISTS,
  'failed-precondition': REPOSITORY_ERROR_CODES.FAILED_PRECONDITION,
  'unavailable': REPOSITORY_ERROR_CODES.UNAVAILABLE,
  'deadline-exceeded': REPOSITORY_ERROR_CODES.DEADLINE_EXCEEDED,
  'resource-exhausted': REPOSITORY_ERROR_CODES.RESOURCE_EXHAUSTED
};

const DEFAULT_MESSAGES: Record<RepositoryErrorCode, string> = {
  [REPOSITORY_ERROR_CODES.PERMISSION_DENIED]: 'Permission denied. Contact your administrator.',
  [REPOSITORY_ERROR_CODES.UNAUTHENTICATED]: 'Authentication required. Sign in again.',
  [REPOSITORY_ERROR_CODES.NOT_FOUND]: 'The requested record was not found.',
  [REPOSITORY_ERROR_CODES.ALREADY_EXISTS]: 'This record already exists.',
  [REPOSITORY_ERROR_CODES.FAILED_PRECONDITION]: 'Operation failed due to a precondition.',
  [REPOSITORY_ERROR_CODES.UNAVAILABLE]: 'Service is temporarily unavailable. Try again.',
  [REPOSITORY_ERROR_CODES.DEADLINE_EXCEEDED]: 'Operation timed out. Try again.',
  [REPOSITORY_ERROR_CODES.RESOURCE_EXHAUSTED]: 'Service quota exceeded. Contact support.',
  [REPOSITORY_ERROR_CODES.UNKNOWN]: 'An unexpected error occurred.'
};

function extractFirebaseCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return code.replace('firestore/', '').replace('firebase/', '');
    }
  }
  return 'unknown';
}

function extractFirebaseMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message;
    }
  }
  return DEFAULT_MESSAGES[REPOSITORY_ERROR_CODES.UNKNOWN];
}

export function mapFirestoreError(error: unknown): RepositoryError {
  const code = extractFirebaseCode(error);
  const mappedCode = FIREBASE_CODE_MAP[code] || REPOSITORY_ERROR_CODES.UNKNOWN;
  const message = extractFirebaseMessage(error);
  return {
    errorCode: mappedCode,
    errorMessage: message
  };
}
