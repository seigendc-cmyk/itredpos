import {
  isBuildDevelopmentOwnerBypassEnabled,
  isStaffPinRequired,
  isStaffPinVerificationEnabled
} from '../repositories/repositoryConfig';
import { mockStaffPinCredentials } from './mockTenantDirectory';
import type { StaffPinActivityEvent, StaffPinVerificationAttempt, StaffPinVerificationStatus } from './staffPinTypes';

const ATTEMPTS_KEY = 'itred_pos_staff_pin_attempts';
const LOCKS_KEY = 'itred_pos_staff_pin_locks';
const ACTIVITY_KEY = 'itred_pos_staff_pin_activity';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const canUseLocalStorage = () => {
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

const writeJson = (key: string, value: unknown) => {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local activity history is best-effort in build-development mode.
  }
};

const recordPinActivity = (event: Omit<StaffPinActivityEvent, 'eventId' | 'createdAt'>) => {
  const rows = readJson<StaffPinActivityEvent[]>(ACTIVITY_KEY, []);
  writeJson(ACTIVITY_KEY, [{ ...event, eventId: makeId('PINACT'), createdAt: nowIso() }, ...rows].slice(0, 75));
};

export function createStaffPinAttempt(payload: { staffId: string; status: StaffPinVerificationStatus; message: string }): StaffPinVerificationAttempt {
  const rows = readJson<StaffPinVerificationAttempt[]>(ATTEMPTS_KEY, []);
  const failedAttempts = payload.status === 'Failed'
    ? rows.filter((row) => row.staffId === payload.staffId && row.status === 'Failed').length + 1
    : rows.filter((row) => row.staffId === payload.staffId && row.status === 'Failed').length;
  const attempt: StaffPinVerificationAttempt = {
    attemptId: makeId('PIN'),
    staffId: payload.staffId,
    enteredAt: nowIso(),
    status: payload.status,
    message: payload.message,
    failedAttempts
  };
  writeJson(ATTEMPTS_KEY, [attempt, ...rows].slice(0, 100));
  return attempt;
}

export function getStaffPinAttempts(filters?: { staffId?: string }): StaffPinVerificationAttempt[] {
  const rows = readJson<StaffPinVerificationAttempt[]>(ATTEMPTS_KEY, []);
  return filters?.staffId ? rows.filter((row) => row.staffId === filters.staffId) : rows;
}

export function isStaffPinLocked(staffId: string): boolean {
  const locks = readJson<Record<string, string>>(LOCKS_KEY, {});
  return Boolean(locks[staffId]);
}

export function lockStaffPin(staffId: string, reason: string): StaffPinVerificationStatus {
  if (staffId === 'ST-OWNER' && isBuildDevelopmentOwnerBypassEnabled()) return 'Build Development Bypass';
  const locks = readJson<Record<string, string>>(LOCKS_KEY, {});
  writeJson(LOCKS_KEY, { ...locks, [staffId]: reason || 'Locked after failed PIN attempts.' });
  recordPinActivity({ eventType: 'STAFF_PIN_LOCKED', label: 'Staff PIN Locked', message: reason || 'Staff PIN locked after failed attempts.', staffId });
  return 'Locked';
}

export function resetStaffPinPlaceholder(staffId: string, staffIdPerformingReset: string): StaffPinVerificationStatus {
  const locks = readJson<Record<string, string>>(LOCKS_KEY, {});
  const nextLocks = { ...locks };
  delete nextLocks[staffId];
  writeJson(LOCKS_KEY, nextLocks);
  recordPinActivity({ eventType: 'BUILD_DEV_OWNER_BYPASS_USED', label: 'PIN Reset Placeholder', message: `${staffIdPerformingReset} reset ${staffId} PIN lock placeholder.`, staffId });
  return getStaffPinStatus(staffId);
}

export function getStaffPinStatus(staffId: string): StaffPinVerificationStatus {
  if (!isStaffPinVerificationEnabled()) return 'Disabled';
  if (staffId === 'ST-OWNER' && isBuildDevelopmentOwnerBypassEnabled()) return 'Build Development Bypass';
  if (isStaffPinLocked(staffId)) return 'Locked';
  return isStaffPinRequired() ? 'Pending' : 'Not Required';
}

export function verifyStaffPin(staffId: string, enteredPin: string): StaffPinVerificationAttempt {
  if (!isStaffPinVerificationEnabled()) {
    const attempt = createStaffPinAttempt({ staffId, status: 'Disabled', message: 'Staff PIN verification is disabled.' });
    return attempt;
  }
  if (staffId === 'ST-OWNER' && isBuildDevelopmentOwnerBypassEnabled()) {
    const attempt = createStaffPinAttempt({ staffId, status: 'Build Development Bypass', message: 'Owner build-development bypass accepted.' });
    recordPinActivity({ eventType: 'BUILD_DEV_OWNER_BYPASS_USED', label: 'Build Dev Owner Bypass Used', message: attempt.message, staffId });
    return attempt;
  }
  if (!isStaffPinRequired()) {
    const attempt = createStaffPinAttempt({ staffId, status: 'Not Required', message: 'Staff PIN is not required in this build.' });
    recordPinActivity({ eventType: 'STAFF_PIN_VERIFICATION_NOT_REQUIRED', label: 'Staff PIN Not Required', message: attempt.message, staffId });
    return attempt;
  }
  if (isStaffPinLocked(staffId)) {
    return createStaffPinAttempt({ staffId, status: 'Locked', message: 'Staff PIN is locked in local preview state.' });
  }
  const credential = mockStaffPinCredentials.find((row) => row.staffId === staffId);
  if (credential && credential.demoPin === enteredPin) {
    const attempt = createStaffPinAttempt({ staffId, status: 'Verified', message: 'Demo staff PIN verified.' });
    recordPinActivity({ eventType: 'STAFF_PIN_VERIFIED', label: 'Staff PIN Verified', message: attempt.message, staffId });
    return attempt;
  }
  const attempt = createStaffPinAttempt({ staffId, status: 'Failed', message: 'Demo staff PIN failed.' });
  recordPinActivity({ eventType: 'STAFF_PIN_FAILED', label: 'Staff PIN Failed', message: attempt.message, staffId });
  if (attempt.failedAttempts >= 3) lockStaffPin(staffId, 'Locked after 3 failed demo PIN attempts.');
  return attempt;
}

export function getStaffPinActivityEvents(): StaffPinActivityEvent[] {
  return readJson<StaffPinActivityEvent[]>(ACTIVITY_KEY, []);
}
