export type POSActivationReasonCode =
  | 'ACTIVATION_ACTIVE'
  | 'NO_ACTIVATION_FOUND'
  | 'ACTIVATION_PENDING'
  | 'ACTIVATION_SUSPENDED'
  | 'ACTIVATION_EXPIRED'
  | 'ACTIVATION_REVOKED'
  | 'EMAIL_NOT_LINKED'
  | 'INVALID_STORAGE_MODE';

export type POSLicenseMode = 'demo' | 'production' | string;
export type POSStorageMode = 'localOnly' | 'cloud' | string;

export interface POSActivationRecord {
  activationId: string;
  ownerEmail: string;
  status: string;
  expiresAt: string;
  vendorId: string;
  branchId: string;
  terminalId: string;
  licenseId: string;
  planId: string;
  licenseMode: POSLicenseMode;
  storageMode: POSStorageMode;
  dashboardType?: string;
  vendorName?: string;
  branchName?: string;
  terminalName?: string;
  createdAt?: string;
  updatedAt?: string;
  source?: string;
  [key: string]: unknown;
}

export interface POSActivationValidationResult {
  allowed: boolean;
  reasonCode: POSActivationReasonCode;
  message: string;
  activation?: POSActivationRecord;
}

export interface POSConsumerSession {
  vendorId: string;
  branchId: string;
  terminalId: string;
  licenseId: string;
  planId: string;
  storageMode: string;
  licenseMode: string;
  openedAt: string;
  dashboardType?: string;
  activationId?: string;
  vendorName?: string;
  branchName?: string;
  terminalName?: string;
  googleEmail?: string;
  licenseStatus?: string;
  expiry?: string;
}

const ACTIVATIONS_KEY = 'sci_pos_activations';
const ACTIVE_ACTIVATION_KEY = 'itred_pos_active_activation';
const FIREBASE_WRITE_MODE_KEY = 'itred_pos_firebase_write_mode';
export const POS_SESSION_KEY = 'sci_pos_session';

const normalizeText = (value: unknown): string => String(value ?? '').trim();
const normalizeEmail = (value: unknown): string => normalizeText(value).toLowerCase();

const normalizeLicenseMode = (value: unknown): string => {
  const compact = normalizeText(value).replace(/[\s_-]+/g, '').toLowerCase();
  if (compact === 'demo') return 'demo';
  if (compact === 'production' || compact === 'prod') return 'production';
  return normalizeText(value).toLowerCase();
};

const normalizeStorageMode = (value: unknown): string => {
  const compact = normalizeText(value).replace(/[\s_-]+/g, '').toLowerCase();
  if (compact === 'localonly' || compact === 'local') return 'localOnly';
  if (compact === 'cloud' || compact === 'firestore') return 'cloud';
  return normalizeText(value);
};

const toIsoString = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
};

const canUseLocalStorage = (): boolean => {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
};

const readJson = <T>(key: string, fallback: T): T => {
  if (!canUseLocalStorage()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage is optional in build-development/prototype mode.
  }
};

const removeStoredValue = (key: string): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures.
  }
};

const objectRowsFromParsedStorage = (parsed: unknown): Record<string, unknown>[] => {
  if (Array.isArray(parsed)) {
    return parsed.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === 'object' && !Array.isArray(row)));
  }
  if (!parsed || typeof parsed !== 'object') return [];
  const objectValue = parsed as Record<string, unknown>;
  const nested = objectValue.activations || objectValue.records || objectValue.rows || objectValue.data || objectValue.items;
  if (Array.isArray(nested)) return objectRowsFromParsedStorage(nested);
  const values = Object.entries(objectValue)
    .filter(([, value]) => Boolean(value && typeof value === 'object' && !Array.isArray(value)))
    .map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }));
  return values.length > 0 ? values : [objectValue];
};

const normalizeActivationRecord = (raw: Record<string, unknown>, fallbackId = ''): POSActivationRecord | null => {
  const ownerEmail = normalizeEmail(raw.ownerEmail || raw.email || raw.googleEmail);
  const vendorId = normalizeText(raw.vendorId || raw.tenantId);
  const activationId = normalizeText(raw.activationId || raw.id || raw.licenseActivationId || raw.posActivationId || fallbackId);

  const record: POSActivationRecord = {
    ...raw,
    activationId: activationId || `activation-${ownerEmail || vendorId || Date.now()}`,
    ownerEmail,
    status: normalizeText(raw.status || raw.activationStatus).toLowerCase(),
    expiresAt: toIsoString(raw.expiresAt || raw.expiry || raw.expiryDate || raw.validUntil || raw.endsAt),
    vendorId,
    branchId: normalizeText(raw.branchId || raw.defaultBranchId),
    terminalId: normalizeText(raw.terminalId || raw.defaultTerminalId),
    licenseId: normalizeText(raw.licenseId || raw.licenceId || raw.licenseKey),
    planId: normalizeText(raw.planId || raw.plan || raw.subscriptionPlanId),
    licenseMode: normalizeLicenseMode(raw.licenseMode || raw.mode || raw.licenseType),
    storageMode: normalizeStorageMode(raw.storageMode || raw.dataMode || raw.repositoryMode),
    dashboardType: normalizeText(raw.dashboardType || raw.dashboard || 'POS'),
    vendorName: normalizeText(raw.vendorName || raw.tenantName) || undefined,
    branchName: normalizeText(raw.branchName) || undefined,
    terminalName: normalizeText(raw.terminalName) || undefined,
    source: normalizeText(raw.source) || undefined
  };

  if (!record.ownerEmail && !record.vendorId) return null;
  return record;
};

const isFutureExpiry = (expiresAt: string): boolean => {
  const expiry = Date.parse(expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
};

const isProductionWriteActivation = (activation?: POSActivationRecord | null): boolean => {
  return Boolean(
    activation &&
    activation.licenseMode === 'production' &&
    activation.status === 'active' &&
    activation.storageMode === 'cloud' &&
    isFutureExpiry(activation.expiresAt)
  );
};

const setFirebaseWriteMode = (activation?: POSActivationRecord): void => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(FIREBASE_WRITE_MODE_KEY, isProductionWriteActivation(activation) ? 'enabled' : 'disabled');
  } catch {
    // Write mode is best-effort local session state.
  }
};

const rememberAllowedActivation = (activation: POSActivationRecord): void => {
  writeJson(ACTIVE_ACTIVATION_KEY, activation);
  setFirebaseWriteMode(activation);
};

const clearAllowedActivation = (): void => {
  removeStoredValue(ACTIVE_ACTIVATION_KEY);
  removeStoredValue(POS_SESSION_KEY);
  setFirebaseWriteMode(undefined);
};

const result = (
  allowed: boolean,
  reasonCode: POSActivationReasonCode,
  message: string,
  activation?: POSActivationRecord
): POSActivationValidationResult => ({ allowed, reasonCode, message, activation });

const statusBlock = (activation: POSActivationRecord): POSActivationValidationResult | null => {
  if (activation.status === 'revoked') return result(false, 'ACTIVATION_REVOKED', 'POS activation has been revoked.', activation);
  if (activation.status === 'suspended') return result(false, 'ACTIVATION_SUSPENDED', 'POS activation is suspended.', activation);
  if (activation.status === 'pending') return result(false, 'ACTIVATION_PENDING', 'POS activation is pending approval.', activation);
  return null;
};

export function getPOSActivations(): POSActivationRecord[] {
  const parsed = readJson<unknown>(ACTIVATIONS_KEY, []);
  return objectRowsFromParsedStorage(parsed)
    .map((row) => normalizeActivationRecord(row))
    .filter((row): row is POSActivationRecord => Boolean(row));
}

export function getActivationByEmail(email: string): POSActivationRecord | null {
  const ownerEmail = normalizeEmail(email);
  if (!ownerEmail) return null;
  return getPOSActivations().find((activation) => normalizeEmail(activation.ownerEmail) === ownerEmail) || null;
}

export function getActiveActivation(email: string): POSActivationRecord | null {
  const activation = getActivationByEmail(email);
  if (!activation) return null;
  if (activation.licenseMode === 'demo' && activation.storageMode === 'localOnly' && !statusBlock(activation)) return activation;
  if (isProductionWriteActivation(activation)) return activation;
  return null;
}

export function validatePOSActivationForEmail(email: string): POSActivationValidationResult {
  const ownerEmail = normalizeEmail(email);
  if (!ownerEmail) {
    clearAllowedActivation();
    return result(false, 'NO_ACTIVATION_FOUND', 'Authenticated Google email is required before POS activation can be checked.');
  }

  const activations = getPOSActivations();
  if (activations.length === 0) {
    clearAllowedActivation();
    return result(false, 'NO_ACTIVATION_FOUND', 'No POS activation was found. Contact Administrator.');
  }

  const activation = activations.find((row) => normalizeEmail(row.ownerEmail) === ownerEmail);
  if (!activation) {
    clearAllowedActivation();
    return result(false, 'EMAIL_NOT_LINKED', 'Authenticated Google email is not linked to a POS activation.', activations[0]);
  }

  const blocked = statusBlock(activation);
  if (blocked) {
    clearAllowedActivation();
    return blocked;
  }

  if (activation.licenseMode === 'demo') {
    if (activation.storageMode !== 'localOnly') {
      clearAllowedActivation();
      return result(false, 'INVALID_STORAGE_MODE', 'Demo POS activation requires localOnly storage mode.', activation);
    }
    rememberAllowedActivation(activation);
    return result(true, 'ACTIVATION_ACTIVE', 'Demo POS activation accepted. Firebase writes are disabled.', activation);
  }

  if (activation.licenseMode === 'production') {
    if (activation.status !== 'active') {
      clearAllowedActivation();
      return result(false, 'NO_ACTIVATION_FOUND', 'No active production POS activation was found for this Google account.', activation);
    }
    if (!isFutureExpiry(activation.expiresAt)) {
      clearAllowedActivation();
      return result(false, 'ACTIVATION_EXPIRED', 'POS activation has expired.', activation);
    }
    if (activation.storageMode !== 'cloud') {
      clearAllowedActivation();
      return result(false, 'INVALID_STORAGE_MODE', 'Production POS activation requires cloud storage mode.', activation);
    }
    rememberAllowedActivation(activation);
    return result(true, 'ACTIVATION_ACTIVE', 'Production POS activation is active.', activation);
  }

  clearAllowedActivation();
  return result(false, 'INVALID_STORAGE_MODE', 'POS activation license mode is not valid for this POS consumer.', activation);
}

export function createPOSSessionFromActivation(activation: POSActivationRecord): POSConsumerSession {
  return {
    vendorId: activation.vendorId,
    branchId: activation.branchId,
    terminalId: activation.terminalId,
    licenseId: activation.licenseId,
    planId: activation.planId,
    storageMode: activation.storageMode,
    licenseMode: activation.licenseMode,
    openedAt: new Date().toISOString(),
    dashboardType: activation.dashboardType,
    activationId: activation.activationId,
    vendorName: activation.vendorName,
    branchName: activation.branchName,
    terminalName: activation.terminalName,
    googleEmail: activation.ownerEmail,
    licenseStatus: activation.status,
    expiry: activation.expiresAt
  };
}

export function savePOSSession(session: POSConsumerSession): void {
  writeJson(POS_SESSION_KEY, session);
}

export function getSavedPOSSession(): POSConsumerSession | null {
  return readJson<POSConsumerSession | null>(POS_SESSION_KEY, null);
}

export function getActivePOSActivation(): POSActivationRecord | null {
  const raw = readJson<Record<string, unknown> | null>(ACTIVE_ACTIVATION_KEY, null);
  return raw ? normalizeActivationRecord(raw) : null;
}

export function clearActivePOSActivation(): void {
  clearAllowedActivation();
}

export function isPOSFirebaseWritesAllowed(): boolean {
  if (!canUseLocalStorage()) return false;
  try {
    return localStorage.getItem(FIREBASE_WRITE_MODE_KEY) === 'enabled';
  } catch {
    return false;
  }
}
