import { SCIPOSActivationRecord, validateSCIActivationForEmail, SCIPOSSession } from '../sdk';

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

export type POSActivationRecord = SCIPOSActivationRecord & {
  dashboardType?: string;
  terminalName?: string;
  source?: string;
  [key: string]: unknown;
};

export interface POSActivationValidationResult {
  allowed: boolean;
  reasonCode: POSActivationReasonCode;
  message: string;
  activation?: POSActivationRecord;
}

export interface POSConsumerSession extends SCIPOSSession {
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
    // localStorage is optional in restricted browser modes.
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

  if (!ownerEmail && !vendorId) return null;

  const fallbackDate = new Date().toISOString();
  const id = normalizeText(raw.id || raw.activationId || activationId);
  const createdAt = toIsoString(raw.createdAt || raw.issuedAt || fallbackDate);
  const updatedAt = toIsoString(raw.updatedAt || raw.issuedAt || fallbackDate);

  const status = normalizeText(raw.status || raw.activationStatus).toLowerCase() as any;
  const licenseMode = normalizeLicenseMode(raw.licenseMode || raw.mode || raw.licenseType) as any;
  const storageMode = normalizeStorageMode(raw.storageMode || raw.dataMode || raw.repositoryMode) as any;

  const record: POSActivationRecord = {
    ...raw,
    // Base record fields
    id: id || `id-${ownerEmail || vendorId || Date.now()}`,
    createdAt,
    updatedAt,
    createdBy: normalizeText(raw.createdBy || raw.issuedBy) || 'system',
    updatedBy: normalizeText(raw.updatedBy || raw.issuedBy) || 'system',

    // SCIPOSActivationRecord fields
    activationId: activationId || `activation-${ownerEmail || vendorId || Date.now()}`,
    vendorId,
    vendorName: normalizeText(raw.vendorName || raw.tenantName) || vendorId || 'Unknown Vendor',
    ownerEmail,
    licenseId: normalizeText(raw.licenseId || raw.licenceId || raw.licenseKey) || 'demo-license-id',
    planId: normalizeText(raw.planId || raw.plan || raw.subscriptionPlanId) || 'demo-plan-id',
    planName: normalizeText(raw.planName || raw.plan || raw.planId) || 'Standard Plan',
    branchId: normalizeText(raw.branchId || raw.defaultBranchId) || 'BR-DEMO',
    branchName: normalizeText(raw.branchName) || 'Demo Branch',
    terminalId: normalizeText(raw.terminalId || raw.defaultTerminalId) || 'POS-DEMO',
    terminalCode: normalizeText(raw.terminalCode || raw.terminalId || raw.defaultTerminalId) || 'POS-DEMO',
    status,
    licenseMode,
    storageMode,
    startsAt: toIsoString(raw.startsAt || raw.issuedAt || createdAt),
    expiresAt: toIsoString(raw.expiresAt || raw.expiry || raw.expiryDate || raw.validUntil || raw.endsAt || '2099-12-31T23:59:59.999Z'),
    maxBranches: typeof raw.maxBranches === 'number' ? raw.maxBranches : 10,
    maxTerminals: typeof raw.maxTerminals === 'number' ? raw.maxTerminals : 10,
    maxStaff: typeof raw.maxStaff === 'number' ? raw.maxStaff : 50,
    maxProducts: typeof raw.maxProducts === 'number' ? raw.maxProducts : 10000,
    issuedBy: normalizeText(raw.issuedBy || raw.createdBy) || 'System',
    issuedAt: toIsoString(raw.issuedAt || raw.createdAt || createdAt),

    // Extra dynamic fields
    dashboardType: normalizeText(raw.dashboardType || raw.dashboard || 'POS'),
    terminalName: normalizeText(raw.terminalName) || undefined,
    source: normalizeText(raw.source) || undefined
  };

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

  const hasLinkedEmail = activations.some((row) => normalizeEmail(row.ownerEmail) === ownerEmail);
  if (!hasLinkedEmail) {
    clearAllowedActivation();
    return result(false, 'EMAIL_NOT_LINKED', 'Authenticated Google email is not linked to a POS activation.', activations[0]);
  }

  const decision = validateSCIActivationForEmail({
    email: ownerEmail,
    activations: activations as SCIPOSActivationRecord[]
  });

  const activation = decision.activation as POSActivationRecord | undefined;

  if (!decision.allowed) {
    clearAllowedActivation();
    return result(false, decision.reasonCode as POSActivationReasonCode, decision.message, activation);
  }

  // Demo activation requires localOnly storage mode.
  if (activation && activation.licenseMode === 'demo') {
    if (activation.storageMode !== 'localOnly') {
      clearAllowedActivation();
      return result(false, 'INVALID_STORAGE_MODE', 'Demo POS activation requires localOnly storage mode.', activation);
    }
  }

  if (activation) {
    rememberAllowedActivation(activation);
    const message = activation.licenseMode === 'demo'
      ? 'Trial POS activation accepted.'
      : decision.message;
    return result(true, 'ACTIVATION_ACTIVE', message, activation);
  }

  clearAllowedActivation();
  return result(false, 'NO_ACTIVATION_FOUND', 'POS activation validation failed.');
}

export function createPOSSessionFromActivation(activation: POSActivationRecord): POSConsumerSession {
  return {
    sessionId: `session-${activation.activationId}-${Date.now()}`,
    vendorId: activation.vendorId,
    branchId: activation.branchId,
    terminalId: activation.terminalId,
    licenseId: activation.licenseId,
    planId: activation.planId,
    ownerEmail: activation.ownerEmail,
    licenseMode: activation.licenseMode as "demo" | "production",
    storageMode: activation.storageMode as "localOnly" | "cloud",
    openedAt: new Date().toISOString(),
    // extra optional fields:
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
