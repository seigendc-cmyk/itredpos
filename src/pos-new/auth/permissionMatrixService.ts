import { securityRightsCatalog } from './securityRightsCatalog';
import {
  getDirectRolePermissions,
  getDefaultRolePermissions,
  getPermissionInheritanceSource,
  securityRoleDefinitions
} from './securityRoleHierarchy';
import type {
  SecurityPermissionActivityEvent,
  SecurityPermissionMatrix,
  SecurityPermissionMatrixCell,
  SecurityPermissionOverride,
  SecurityPermissionRight,
  SecurityRoleDefinition,
  SecurityRoleKey
} from './permissionMatrixTypes';

const OVERRIDES_KEY = 'itred_pos_security_permission_overrides';
const ACTIVITY_KEY = 'itred_pos_security_permission_activity';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const overrideKey = (permissionKey: string, roleKey: SecurityRoleKey) => `${roleKey}::${permissionKey}`;

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
    // Local matrix persistence is best-effort in build-development mode.
  }
};

const recordActivity = (event: Omit<SecurityPermissionActivityEvent, 'eventId' | 'createdAt'>) => {
  const rows = readJson<SecurityPermissionActivityEvent[]>(ACTIVITY_KEY, []);
  writeJson(ACTIVITY_KEY, [{ ...event, eventId: makeId('SECACT'), createdAt: nowIso() }, ...rows].slice(0, 100));
};

const getOverrides = (): Record<string, SecurityPermissionOverride> => readJson<Record<string, SecurityPermissionOverride>>(OVERRIDES_KEY, {});
const saveOverrides = (overrides: Record<string, SecurityPermissionOverride>) => writeJson(OVERRIDES_KEY, overrides);

export function getSecurityRightsCatalog(): SecurityPermissionRight[] {
  return [...securityRightsCatalog].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getSecurityRoleDefinitions(): SecurityRoleDefinition[] {
  return [...securityRoleDefinitions].sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);
}

export function calculatePermissionCell(permissionKey: string, roleKey: SecurityRoleKey): SecurityPermissionMatrixCell {
  const permission = securityRightsCatalog.find((right) => right.permissionKey === permissionKey);
  const override = getOverrides()[overrideKey(permissionKey, roleKey)];
  const ownerLocked = roleKey === 'Owner';
  if (!permission) {
    return { permissionKey, roleKey, allowed: false, inheritanceMode: 'Not Applicable', locked: false, reason: 'Permission is not in catalog.' };
  }
  if (ownerLocked) {
    return { permissionKey, roleKey, allowed: true, inheritanceMode: 'Locked', locked: true, reason: 'Owner full access is protected during build-development.' };
  }
  if (roleKey === 'SysAdmin' && !override) {
    return { permissionKey, roleKey, allowed: true, inheritanceMode: 'Direct', locked: false, reason: 'SysAdmin has full POS rights. Internal console access is not included.' };
  }
  if (override) {
    return {
      permissionKey,
      roleKey,
      allowed: override.allowed,
      inheritanceMode: override.allowed ? 'Direct' : 'Denied',
      locked: permission.systemLocked && roleKey === 'Owner',
      reason: override.reason,
      changedByStaffId: override.changedByStaffId,
      changedAt: override.changedAt
    };
  }
  if (getDirectRolePermissions(roleKey).includes(permissionKey)) {
    return { permissionKey, roleKey, allowed: true, inheritanceMode: 'Direct', locked: false, reason: 'Allowed by default role rights.' };
  }
  const inheritedFrom = getPermissionInheritanceSource(roleKey, permissionKey);
  if (inheritedFrom) {
    return { permissionKey, roleKey, allowed: true, inheritanceMode: 'Inherited', inheritedFrom, locked: false, reason: `Inherited from ${inheritedFrom}.` };
  }
  return { permissionKey, roleKey, allowed: false, inheritanceMode: 'Denied', locked: false, reason: 'Not included in default or inherited rights.' };
}

export function buildDefaultPermissionMatrix(): SecurityPermissionMatrix {
  const roles = getSecurityRoleDefinitions();
  return {
    roles,
    rows: getSecurityRightsCatalog().map((permission) => ({
      permission,
      cells: roles.map((role) => calculatePermissionCell(permission.permissionKey, role.roleKey))
    })),
    updatedAt: nowIso()
  };
}

export function getPermissionMatrix(): SecurityPermissionMatrix {
  recordActivity({ eventType: 'SECURITY_RIGHTS_MATRIX_OPENED', label: 'Security Rights Matrix Opened', message: 'Staff access rights matrix opened in local preview mode.' });
  return buildDefaultPermissionMatrix();
}

export function setPermissionOverride(permissionKey: string, roleKey: SecurityRoleKey, allowed: boolean, staffId: string, reason: string): SecurityPermissionMatrixCell {
  const permission = securityRightsCatalog.find((right) => right.permissionKey === permissionKey);
  if (roleKey === 'Owner') return calculatePermissionCell(permissionKey, roleKey);
  if (permission?.systemLocked && roleKey === 'Owner') return calculatePermissionCell(permissionKey, roleKey);
  const finalReason = reason || (permission?.requiresApproval ? 'High-risk permission changed in build-development preview.' : 'Local matrix override.');
  const overrides = getOverrides();
  overrides[overrideKey(permissionKey, roleKey)] = {
    permissionKey,
    roleKey,
    allowed,
    reason: finalReason,
    changedByStaffId: staffId,
    changedAt: nowIso()
  };
  saveOverrides(overrides);
  recordActivity({ eventType: 'SECURITY_ROLE_OVERRIDE_SET', label: 'Security Role Override Set', message: `${roleKey} ${allowed ? 'allowed' : 'denied'} ${permissionKey}.`, staffId, roleKey, permissionKey });
  return calculatePermissionCell(permissionKey, roleKey);
}

export function togglePermissionForRole(permissionKey: string, roleKey: SecurityRoleKey, staffId: string): SecurityPermissionMatrixCell {
  const current = calculatePermissionCell(permissionKey, roleKey);
  const permission = securityRightsCatalog.find((right) => right.permissionKey === permissionKey);
  const reason = permission?.requiresApproval ? 'High-risk toggle from Staff Access Rights matrix.' : 'Toggled from Staff Access Rights matrix.';
  const next = setPermissionOverride(permissionKey, roleKey, !current.allowed, staffId, reason);
  recordActivity({ eventType: 'SECURITY_RIGHT_TOGGLED', label: 'Security Right Toggled', message: `${permissionKey} toggled for ${roleKey}.`, staffId, roleKey, permissionKey });
  return next;
}

export function clearPermissionOverride(permissionKey: string, roleKey: SecurityRoleKey, staffId: string): SecurityPermissionMatrixCell {
  const overrides = getOverrides();
  delete overrides[overrideKey(permissionKey, roleKey)];
  saveOverrides(overrides);
  recordActivity({ eventType: 'SECURITY_ROLE_OVERRIDE_CLEARED', label: 'Security Role Override Cleared', message: `${permissionKey} override cleared for ${roleKey}.`, staffId, roleKey, permissionKey });
  return calculatePermissionCell(permissionKey, roleKey);
}

export function resetRoleToDefault(roleKey: SecurityRoleKey, staffId: string): SecurityPermissionMatrix {
  const overrides = getOverrides();
  Object.keys(overrides).forEach((key) => {
    if (key.startsWith(`${roleKey}::`)) delete overrides[key];
  });
  saveOverrides(overrides);
  recordActivity({ eventType: 'SECURITY_ROLE_RESET_TO_DEFAULT', label: 'Security Role Reset To Default', message: `${roleKey} overrides reset to default.`, staffId, roleKey });
  return buildDefaultPermissionMatrix();
}

export function resetAllRolesToDefault(staffId: string): SecurityPermissionMatrix {
  saveOverrides({});
  recordActivity({ eventType: 'SECURITY_MATRIX_RESET_TO_DEFAULT', label: 'Security Matrix Reset To Default', message: 'All local security rights overrides were reset.', staffId });
  return buildDefaultPermissionMatrix();
}

export function getEffectivePermissionsForRole(roleKey: SecurityRoleKey): string[] {
  if (roleKey === 'Owner') return securityRightsCatalog.map((right) => right.permissionKey);
  const defaults = new Set(getDefaultRolePermissions(roleKey));
  const overrides = getOverrides();
  Object.values(overrides).filter((override) => override.roleKey === roleKey).forEach((override) => {
    if (override.allowed) defaults.add(override.permissionKey);
    else defaults.delete(override.permissionKey);
  });
  return Array.from(defaults);
}

export function getEffectivePermissionsForStaff(staffProfile: { role?: string; staffRole?: string }): string[] {
  const role = normalizeSecurityRole((staffProfile.role || staffProfile.staffRole || 'Viewer'));
  return getEffectivePermissionsForRole(role);
}

export function roleHasPermission(roleKey: SecurityRoleKey, permissionKey: string): boolean {
  return getEffectivePermissionsForRole(roleKey).includes(permissionKey);
}

export function getPermissionDescription(permissionKey: string): SecurityPermissionRight | undefined {
  return securityRightsCatalog.find((right) => right.permissionKey === permissionKey);
}

export function getPermissionMatrixActivityEvents(): SecurityPermissionActivityEvent[] {
  return readJson<SecurityPermissionActivityEvent[]>(ACTIVITY_KEY, []);
}

export function recordSecurityMatrixEvent(event: Omit<SecurityPermissionActivityEvent, 'eventId' | 'createdAt'>) {
  recordActivity(event);
}

export function normalizeSecurityRole(role: string): SecurityRoleKey {
  const map: Record<string, SecurityRoleKey> = {
    Owner: 'Owner',
    SysAdmin: 'SysAdmin',
    VendorOwner: 'Owner',
    VendorAdmin: 'Manager',
    Manager: 'Manager',
    Supervisor: 'Supervisor',
    Accountant: 'Accountant',
    StockController: 'StockController',
    'Stock Controller': 'StockController',
    Cashier: 'Cashier',
    DeliveryStaff: 'DeliveryStaff',
    'Delivery Staff': 'DeliveryStaff',
    Viewer: 'Viewer'
  };
  return map[role] || 'Viewer';
}
