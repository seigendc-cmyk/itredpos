import {
  isBuildDevelopmentOwnerBypassEnabled,
  isRoleMenuFilteringEnabled,
  isStaffPinRequired,
  isStaffSessionGateEnabled,
  isStaffSessionGateRequired,
  isStrictPermissionEnforcementEnabled
} from '../repositories/repositoryConfig';
import type { PosPageId } from '../types';
import { getAllowedMenusForRole, getPermissionsForRole } from '../utils/posPermissions';
import { getCurrentTenantSession } from './tenantSessionService';
import { getRoleActionKeys } from './roleActionPermissions';
import { getAllowedPosPageIdsForRoleMenu, getRoleMenuKeys } from './roleMenuDefinitions';
import { getStaffPinAttempts, verifyStaffPin } from './staffPinService';
import type {
  StaffDeskType,
  StaffGateRole,
  StaffGateSession,
  StaffPinActivityEvent,
  StaffSessionGateReadiness
} from './staffPinTypes';

const GATE_SESSION_KEY = 'itred_pos_staff_gate_session';
const GATE_ACTIVITY_KEY = 'itred_pos_staff_gate_activity';

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
    // Local session state is best-effort in build-development mode.
  }
};

const recordGateActivity = (event: Omit<StaffPinActivityEvent, 'eventId' | 'createdAt'>) => {
  const rows = readJson<StaffPinActivityEvent[]>(GATE_ACTIVITY_KEY, []);
  writeJson(GATE_ACTIVITY_KEY, [{ ...event, eventId: makeId('GATEACT'), createdAt: nowIso() }, ...rows].slice(0, 75));
};

const roleForPosPermissions = (role: StaffGateRole) => {
  if (role === 'VendorOwner') return 'Owner';
  if (role === 'VendorAdmin' || role === 'Accountant') return 'Manager';
  if (role === 'StockController') return 'Stock Controller';
  if (role === 'DeliveryStaff') return 'Delivery Staff';
  if (role === 'Viewer') return 'Cashier';
  return role;
};

export function getStaffSessionGateReadiness(): StaffSessionGateReadiness[] {
  return [
    { item: 'Gate Enabled', status: isStaffSessionGateEnabled() ? 'Enabled' : 'Disabled', notes: 'Staff session gate preview layer is available.' },
    { item: 'Gate Required', status: isStaffSessionGateRequired() ? 'Required' : 'Preview', notes: 'Gate is not mandatory during build-development.' },
    { item: 'PIN Verification', status: isStaffPinRequired() ? 'Required' : 'Preview', notes: 'PIN verification uses local demo credentials only.' },
    { item: 'Role Menu Filtering', status: isRoleMenuFilteringEnabled() ? 'Enabled' : 'Disabled', notes: 'Role menu readiness can be previewed.' },
    { item: 'Strict Permission Enforcement', status: isStrictPermissionEnforcementEnabled() ? 'Required' : 'Disabled', notes: 'Restricted actions are not hard-enforced by this build.' },
    { item: 'Build Owner Bypass', status: isBuildDevelopmentOwnerBypassEnabled() ? 'Active' : 'Disabled', notes: 'Owner cannot be locked out in build-development.' }
  ];
}

export function startStaffGateSession(payload: {
  vendorId: string;
  staffId: string;
  staffName: string;
  staffRole: StaffGateRole;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  deskType: StaffDeskType;
  expiresAt?: string;
}): StaffGateSession {
  const tenantSession = getCurrentTenantSession();
  const isOwnerBypass = payload.staffRole === 'Owner' || payload.staffRole === 'VendorOwner';
  const session: StaffGateSession = {
    gateSessionId: makeId('GATE'),
    tenantSessionId: tenantSession.sessionId,
    vendorId: payload.vendorId,
    staffId: payload.staffId,
    staffName: payload.staffName,
    staffRole: payload.staffRole,
    branchId: payload.branchId,
    branchName: payload.branchName,
    terminalId: payload.terminalId,
    terminalName: payload.terminalName,
    deskType: payload.deskType,
    pinStatus: isOwnerBypass && isBuildDevelopmentOwnerBypassEnabled() ? 'Build Development Bypass' : isStaffPinRequired() ? 'Pending' : 'Not Required',
    gateStatus: isOwnerBypass && isBuildDevelopmentOwnerBypassEnabled() ? 'Build Development Bypass' : isStaffSessionGateRequired() ? 'Required' : 'Preview',
    menuKeys: getRoleMenuKeys(payload.staffRole),
    permissions: getAllowedActionsForStaffRole(payload.staffRole),
    startedAt: nowIso(),
    lastActiveAt: nowIso(),
    expiresAt: payload.expiresAt,
    failedAttempts: getStaffPinAttempts({ staffId: payload.staffId }).filter((row) => row.status === 'Failed').length,
    isBuildDevelopmentBypass: isOwnerBypass && isBuildDevelopmentOwnerBypassEnabled(),
    notes: 'Staff gate session is preview-only. It does not lock the app until production enforcement is enabled.'
  };
  writeJson(GATE_SESSION_KEY, session);
  recordGateActivity({ eventType: 'STAFF_GATE_SESSION_STARTED', label: 'Staff Gate Session Started', message: `${payload.staffName} gate session started in preview mode.`, staffId: payload.staffId, gateSessionId: session.gateSessionId });
  return session;
}

export function verifyStaffGatePin(gateSessionId: string, enteredPin: string): StaffGateSession {
  const session = getCurrentStaffGateSession();
  if (session.gateSessionId !== gateSessionId) return session;
  const attempt = verifyStaffPin(session.staffId, enteredPin);
  const next: StaffGateSession = {
    ...session,
    pinStatus: attempt.status,
    gateStatus: attempt.status === 'Verified' || attempt.status === 'Not Required' || attempt.status === 'Build Development Bypass' ? 'Preview' : attempt.status === 'Locked' ? 'Session Locked' : 'Pin Required',
    failedAttempts: attempt.failedAttempts,
    lastActiveAt: nowIso(),
    lockedAt: attempt.status === 'Locked' ? nowIso() : session.lockedAt
  };
  writeJson(GATE_SESSION_KEY, next);
  return next;
}

export function activateStaffGateSession(gateSessionId: string): StaffGateSession {
  const session = getCurrentStaffGateSession();
  if (session.gateSessionId !== gateSessionId) return session;
  const canActivate = session.pinStatus === 'Verified' || session.pinStatus === 'Not Required' || session.pinStatus === 'Build Development Bypass' || !isStaffSessionGateRequired();
  const next = { ...session, gateStatus: canActivate ? 'Session Active' as const : 'Pin Required' as const, lastActiveAt: nowIso() };
  writeJson(GATE_SESSION_KEY, next);
  recordGateActivity({ eventType: 'STAFF_GATE_SESSION_ACTIVATED', label: 'Staff Gate Session Activated', message: `${session.staffName} gate session activated in preview mode.`, staffId: session.staffId, gateSessionId });
  return next;
}

export function lockStaffGateSession(gateSessionId: string, reason: string): StaffGateSession {
  const session = getCurrentStaffGateSession();
  if (session.gateSessionId !== gateSessionId || session.isBuildDevelopmentBypass) return session;
  const next = { ...session, gateStatus: 'Session Locked' as const, pinStatus: 'Locked' as const, lockedAt: nowIso(), lastActiveAt: nowIso(), notes: reason };
  writeJson(GATE_SESSION_KEY, next);
  recordGateActivity({ eventType: 'STAFF_GATE_SESSION_LOCKED', label: 'Staff Gate Session Locked', message: reason || 'Staff gate session locked.', staffId: session.staffId, gateSessionId });
  return next;
}

export function unlockStaffGateSessionPlaceholder(gateSessionId: string, staffId: string): StaffGateSession {
  const session = getCurrentStaffGateSession();
  if (session.gateSessionId !== gateSessionId) return session;
  const next = { ...session, gateStatus: 'Preview' as const, pinStatus: 'Pending' as const, lockedAt: undefined, lastActiveAt: nowIso(), notes: `Unlocked by ${staffId} placeholder.` };
  writeJson(GATE_SESSION_KEY, next);
  return next;
}

export function clearStaffGateSession(): StaffGateSession {
  if (canUseLocalStorage()) localStorage.removeItem(GATE_SESSION_KEY);
  const tenant = getCurrentTenantSession();
  const session = startStaffGateSession({
    vendorId: tenant.vendorId,
    staffId: tenant.staffId || 'ST-OWNER',
    staffName: tenant.staffName || 'Build Owner',
    staffRole: tenant.staffRole || 'VendorOwner',
    branchId: tenant.branchId || 'BR-HARARE',
    branchName: tenant.branchName || 'Harare Main',
    terminalId: tenant.terminalId || 'POS-01',
    terminalName: tenant.terminalName || 'POS-01 Harare Front Counter',
    deskType: 'General POS'
  });
  recordGateActivity({ eventType: 'STAFF_GATE_SESSION_CLEARED', label: 'Staff Gate Session Cleared', message: 'Staff gate session cleared and safe Owner preview restored.', staffId: session.staffId, gateSessionId: session.gateSessionId });
  return session;
}

export function getCurrentStaffGateSession(): StaffGateSession {
  const existing = readJson<StaffGateSession | null>(GATE_SESSION_KEY, null);
  if (existing) return existing;
  const tenant = getCurrentTenantSession();
  return startStaffGateSession({
    vendorId: tenant.vendorId,
    staffId: tenant.staffId || 'ST-OWNER',
    staffName: tenant.staffName || 'Build Owner',
    staffRole: tenant.staffRole || 'VendorOwner',
    branchId: tenant.branchId || 'BR-HARARE',
    branchName: tenant.branchName || 'Harare Main',
    terminalId: tenant.terminalId || 'POS-01',
    terminalName: tenant.terminalName || 'POS-01 Harare Front Counter',
    deskType: 'General POS'
  });
}

export function refreshStaffGateSessionActivity(): StaffGateSession {
  const session = getCurrentStaffGateSession();
  const next = { ...session, lastActiveAt: nowIso() };
  writeJson(GATE_SESSION_KEY, next);
  return next;
}

export function getAllowedMenusForStaffSession(session: StaffGateSession): PosPageId[] {
  if (session.isBuildDevelopmentBypass || session.staffRole === 'Owner' || session.staffRole === 'VendorOwner') return getAllowedMenusForRole('Owner');
  return getAllowedPosPageIdsForRoleMenu(session.staffRole);
}

export function getAllowedActionsForStaffRole(role: StaffGateRole): string[] {
  if (role === 'Owner' || role === 'VendorOwner') return getPermissionsForRole('Owner');
  return Array.from(new Set([...getRoleActionKeys(role), ...getPermissionsForRole(roleForPosPermissions(role) as never)]));
}

export function getAllowedActionsForStaffSession(session: StaffGateSession): string[] {
  if (session.isBuildDevelopmentBypass) return getPermissionsForRole('Owner');
  return session.permissions.length > 0 ? session.permissions : getAllowedActionsForStaffRole(session.staffRole);
}

export function canOpenMenu(menuKey: PosPageId, session: StaffGateSession): boolean {
  recordGateActivity({ eventType: 'ROLE_MENU_PREVIEW_LOADED', label: 'Role Menu Preview Loaded', message: `${session.staffRole} menu preview checked for ${menuKey}.`, staffId: session.staffId, gateSessionId: session.gateSessionId });
  if (!isStrictPermissionEnforcementEnabled()) return true;
  return getAllowedMenusForStaffSession(session).includes(menuKey);
}

export function canPerformAction(permissionKey: string, session: StaffGateSession): boolean {
  recordGateActivity({ eventType: 'PERMISSION_PREVIEW_CHECKED', label: 'Permission Preview Checked', message: `${session.staffRole} permission preview checked for ${permissionKey}.`, staffId: session.staffId, gateSessionId: session.gateSessionId });
  if (!isStrictPermissionEnforcementEnabled()) return true;
  return getAllowedActionsForStaffSession(session).includes(permissionKey);
}

export function getStaffGateActivityEvents(): StaffPinActivityEvent[] {
  return readJson<StaffPinActivityEvent[]>(GATE_ACTIVITY_KEY, []);
}
