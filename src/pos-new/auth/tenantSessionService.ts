import {
  isBuildDevelopmentBypassEnabled,
  isFirebaseAuthRequired,
  isFirebaseAuthShellEnabled,
  isStaffPinRequired,
  isTenantResolutionEnabled
} from '../repositories/repositoryConfig';
import { type PermissionKey } from '../utils/posPermissions';
import type {
  AuthActivityEvent,
  FirebaseAuthUserProfile,
  StaffAccessAttempt,
  TenantBranchIdentity,
  TenantSession,
  TenantSessionReadiness,
  TenantStaffIdentity,
  TenantTerminalIdentity,
  VendorTenantIdentity
} from './authTypes';
import { getTenantPermissionsForRole } from './tenantPermissionMapping';
import {
  getMockBranchAccessForStaff,
  getMockMembershipById,
  getMockStaffProfilesForTenant,
  getMockTerminalAccessForStaff,
  resolveTenantFromMockDirectory
} from './tenantResolutionService';
import type {
  TenantBranchAccessContract,
  TenantMembershipContract,
  TenantSessionClaims,
  TenantStaffProfileContract,
  TenantTerminalAccessContract
} from './tenantResolutionTypes';

const SESSION_KEY = 'itred_pos_tenant_session';
const ACTIVITY_KEY = 'itred_pos_auth_activity';
const CLAIMS_KEY = 'itred_pos_tenant_session_claims';

const nowIso = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const placeholderStaff: TenantStaffIdentity[] = [
  { staffId: 'ST-OWNER', staffName: 'Build Owner', staffRole: 'VendorOwner', pinRequired: false },
  { staffId: 'ST-ADMIN', staffName: 'Admin User', staffRole: 'VendorAdmin', pinRequired: false },
  { staffId: 'ST-MARY', staffName: 'Mary Cashier', staffRole: 'Cashier', pinRequired: false },
  { staffId: 'ST-BLESSING', staffName: 'Blessing Stock', staffRole: 'StockController', pinRequired: false }
];

const placeholderBranches: TenantBranchIdentity[] = [
  { branchId: 'BR-HARARE', branchName: 'Harare Main' },
  { branchId: 'BR-BYO', branchName: 'Bulawayo Branch' }
];

const placeholderTerminals: Record<string, TenantTerminalIdentity[]> = {
  'BR-HARARE': [
    { terminalId: 'POS-01', terminalName: 'POS-01 Harare Front Counter' },
    { terminalId: 'BACK-01', terminalName: 'BACK-01 Harare Back Office' }
  ],
  'BR-BYO': [
    { terminalId: 'POS-02', terminalName: 'POS-02 Bulawayo Counter' }
  ]
};

const roleToPermissions = (role: TenantStaffIdentity['staffRole']): PermissionKey[] => {
  return getTenantPermissionsForRole(role);
};

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
    // Local persistence is optional in build-development mode.
  }
};

export const recordAuthActivity = (event: Omit<AuthActivityEvent, 'eventId' | 'createdAt'>) => {
  const rows = readJson<AuthActivityEvent[]>(ACTIVITY_KEY, []);
  const next: AuthActivityEvent = { ...event, eventId: makeId('AUTH'), createdAt: nowIso() };
  writeJson(ACTIVITY_KEY, [next, ...rows].slice(0, 50));
};

const saveSession = (session: TenantSession) => {
  writeJson(SESSION_KEY, session);
};

export function createBuildDevelopmentSession(): TenantSession {
  const timestamp = nowIso();
  const session: TenantSession = {
    sessionId: makeId('SESSION'),
    authProvider: 'Build Development',
    status: 'Build Development',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    membershipId: 'MEM-DEMO-OWNER',
    membershipRole: 'VendorOwner',
    staffId: 'ST-OWNER',
    staffName: 'Build Owner',
    staffRole: 'VendorOwner',
    branchId: 'BR-HARARE',
    branchName: 'Harare Main',
    terminalId: 'POS-01',
    terminalName: 'POS-01 Harare Front Counter',
    permissions: getTenantPermissionsForRole('VendorOwner'),
    isBuildDevelopmentSession: true,
    authRequired: isFirebaseAuthRequired(),
    tenantResolved: true,
    staffAuthenticated: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    notes: 'Build-development Owner session. Production Auth and tenant rules are not enforced yet.'
  };
  saveSession(session);
  recordAuthActivity({ eventType: 'BUILD_DEV_SESSION_CREATED', label: 'Build Dev Session Created', message: 'Build-development Owner session created.', vendorId: session.vendorId, staffId: session.staffId });
  recordAuthActivity({ eventType: 'BUILD_DEV_TENANT_BYPASS_USED', label: 'Build Dev Tenant Bypass Used', message: 'Build-development tenant bypass kept POS access available.', vendorId: session.vendorId, staffId: session.staffId });
  refreshTenantSessionClaims(session);
  return session;
}

export function getCurrentTenantSession(): TenantSession {
  return readJson<TenantSession | null>(SESSION_KEY, null) || createBuildDevelopmentSession();
}

export function createTenantSessionFromFirebaseUser(profile: FirebaseAuthUserProfile): TenantSession {
  const timestamp = nowIso();
  const session: TenantSession = {
    sessionId: makeId('SESSION'),
    authProvider: 'Google',
    status: 'Vendor Authenticated',
    vendorId: 'demo-vendor-001',
    vendorName: 'Build Development Vendor',
    vendorEmail: profile.email,
    firebaseUid: profile.uid,
    googleEmail: profile.email,
    permissions: [],
    isBuildDevelopmentSession: false,
    authRequired: isFirebaseAuthRequired(),
    tenantResolved: false,
    staffAuthenticated: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    notes: 'Google profile captured by Auth shell. Tenant resolution remains placeholder.'
  };
  saveSession(session);
  return session;
}

export function resolveTenantPlaceholder(profile?: FirebaseAuthUserProfile | null): VendorTenantIdentity {
  recordAuthActivity({ eventType: 'TENANT_RESOLUTION_STARTED', label: 'Tenant Resolution Started', message: 'Mock tenant resolution started.', vendorId: getCurrentTenantSession().vendorId });
  const result = resolveTenantFromMockDirectory(profile);
  const membership = result.selectedMembership || result.memberships[0];
  const identity: VendorTenantIdentity = {
    vendorId: membership?.vendorId || 'demo-vendor-001',
    vendorName: membership?.vendorName || 'Build Development Vendor',
    vendorEmail: result.signedInEmail || profile?.email,
    firebaseUid: profile?.uid,
    googleEmail: result.signedInEmail || profile?.email,
    status: membership ? 'Resolved' : 'Not Resolved'
  };
  const eventType = result.status === 'No Tenant Found'
    ? 'TENANT_RESOLUTION_NO_TENANT_FOUND'
    : result.status === 'Multiple Tenants Found'
      ? 'TENANT_RESOLUTION_MULTIPLE_TENANTS_FOUND'
      : result.status === 'Access Disabled'
        ? 'TENANT_ACCESS_DISABLED'
        : 'TENANT_RESOLUTION_RESOLVED';
  recordAuthActivity({ eventType, label: result.status, message: result.message, vendorId: identity.vendorId });
  recordAuthActivity({ eventType: 'TENANT_RESOLUTION_PLACEHOLDER', label: 'Tenant Resolution Placeholder', message: 'Tenant resolution used the mock tenant directory. Production Firestore lookup is disabled.', vendorId: identity.vendorId });
  if (membership) {
    selectTenantMembershipForSession(membership.membershipId);
  }
  return identity;
}

export function getTenantMembershipsForCurrentProfile(profile?: FirebaseAuthUserProfile | null): TenantMembershipContract[] {
  return resolveTenantFromMockDirectory(profile).memberships;
}

export function getAvailableStaffForTenantPlaceholder(_vendorId: string): TenantStaffIdentity[] {
  return placeholderStaff;
}

export function getAvailableBranchesForTenantPlaceholder(_vendorId: string): TenantBranchIdentity[] {
  return placeholderBranches;
}

export function getAvailableTerminalsForBranchPlaceholder(branchId: string): TenantTerminalIdentity[] {
  return placeholderTerminals[branchId] || placeholderTerminals['BR-HARARE'];
}

export function selectStaffBranchTerminal(payload: StaffAccessAttempt): TenantSession {
  const current = getCurrentTenantSession();
  const staff = placeholderStaff.find((item) => item.staffId === payload.staffId) || placeholderStaff[0];
  const branch = placeholderBranches.find((item) => item.branchId === payload.branchId) || placeholderBranches[0];
  const terminal = getAvailableTerminalsForBranchPlaceholder(branch.branchId).find((item) => item.terminalId === payload.terminalId) || getAvailableTerminalsForBranchPlaceholder(branch.branchId)[0];
  const session: TenantSession = {
    ...current,
    status: isStaffPinRequired() ? 'Staff Selection Required' : 'Staff Authenticated',
    vendorId: payload.vendorId,
    staffId: staff.staffId,
    staffName: staff.staffName,
    staffRole: staff.staffRole,
    branchId: branch.branchId,
    branchName: branch.branchName,
    terminalId: terminal.terminalId,
    terminalName: terminal.terminalName,
    permissions: roleToPermissions(staff.staffRole),
    tenantResolved: true,
    staffAuthenticated: !isStaffPinRequired(),
    updatedAt: nowIso()
  };
  saveSession(session);
  recordAuthActivity({ eventType: 'STAFF_ACCESS_SELECTED', label: 'Staff Access Selected', message: `${staff.staffName} selected ${branch.branchName} / ${terminal.terminalName}.`, vendorId: session.vendorId, staffId: staff.staffId });
  refreshTenantSessionClaims(session);
  return session;
}

export function verifyStaffPinForMappedStaff(staffId: string, pin?: string): boolean {
  const current = getCurrentTenantSession();
  const staff = getMockStaffProfilesForTenant(current.vendorId, current.membershipId)
    .find((row) => row.staffId === staffId);

  if (!staff) {
    recordAuthActivity({
      eventType: 'STAFF_PIN_VERIFIED_PLACEHOLDER',
      label: 'Staff PIN Failed',
      message: 'Staff profile was not found for PIN verification.',
      vendorId: current.vendorId,
      staffId,
    });
    return false;
  }

  if (!staff.pinRequired || !isStaffPinRequired()) {
    return true;
  }

  const enteredPin = String(pin || '').trim();
  const expectedPin = String(staff.pin || staff.defaultPin || '').trim();
  const verified = expectedPin.length > 0 && enteredPin === expectedPin;

  recordAuthActivity({
    eventType: 'STAFF_PIN_VERIFIED_PLACEHOLDER',
    label: verified ? 'Staff PIN Verified' : 'Staff PIN Failed',
    message: verified ? 'Staff PIN matched mapped profile.' : 'Invalid staff PIN entered.',
    vendorId: current.vendorId,
    staffId,
  });

  return verified;
}

export function verifyStaffPinPlaceholder(payload: StaffAccessAttempt): boolean {
  const verified = !isStaffPinRequired() || Boolean(payload.pinOrPassword);
  recordAuthActivity({ eventType: 'STAFF_PIN_VERIFIED_PLACEHOLDER', label: 'Staff PIN Verified Placeholder', message: verified ? 'Staff PIN placeholder accepted.' : 'Staff PIN placeholder missing.', vendorId: payload.vendorId, staffId: payload.staffId });
  return verified;
}

export function activateTenantSession(payload: StaffAccessAttempt): TenantSession {
  const selected = selectStaffBranchTerminal(payload);
  const verified = verifyStaffPinPlaceholder(payload);
  const session: TenantSession = {
    ...selected,
    status: verified ? 'Session Active' : 'Staff Selection Required',
    staffAuthenticated: verified,
    updatedAt: nowIso()
  };
  saveSession(session);
  recordAuthActivity({ eventType: 'TENANT_SESSION_ACTIVATED', label: 'Tenant Session Activated', message: `${session.staffName || 'Staff'} session activated in placeholder mode.`, vendorId: session.vendorId, staffId: session.staffId });
  refreshTenantSessionClaims(session);
  return session;
}

export function selectTenantMembershipForSession(membershipId: string): TenantSession {
  const membership = getMockMembershipById(membershipId);
  const current = getCurrentTenantSession();
  if (!membership) return current;
  const session: TenantSession = {
    ...current,
    status: membership.accessStatus === 'Active' ? 'Tenant Resolved' : 'Vendor Authenticated',
    vendorId: membership.vendorId,
    vendorName: membership.vendorName,
    vendorEmail: membership.signedInEmail,
    googleEmail: membership.signedInEmail,
    membershipId: membership.membershipId,
    membershipRole: membership.role,
    permissions: getTenantPermissionsForRole(membership.role),
    tenantResolved: membership.accessStatus === 'Active',
    updatedAt: nowIso(),
    notes: 'Tenant membership selected from mock directory. Production Firestore tenant lookup is not active.'
  };
  saveSession(session);
  recordAuthActivity({ eventType: membership.accessStatus === 'Active' ? 'TENANT_RESOLUTION_RESOLVED' : 'TENANT_ACCESS_DISABLED', label: 'Tenant Membership Selected', message: `${membership.vendorName} membership ${membership.membershipId} selected.`, vendorId: session.vendorId, staffId: session.staffId });
  refreshTenantSessionClaims(session);
  return session;
}

export function loadStaffProfilesForCurrentTenant(): TenantStaffProfileContract[] {
  const session = getCurrentTenantSession();
  const rows = getMockStaffProfilesForTenant(session.vendorId, session.membershipId);
  recordAuthActivity({ eventType: 'STAFF_PROFILE_MAPPING_LOADED', label: 'Staff Profile Mapping Loaded', message: `${rows.length} mock staff profile mapping row(s) loaded.`, vendorId: session.vendorId, staffId: session.staffId });
  return rows;
}

export function loadBranchesForCurrentTenant(staffId?: string): TenantBranchAccessContract[] {
  const session = getCurrentTenantSession();
  const rows = getMockBranchAccessForStaff(session.vendorId, staffId || session.staffId);
  recordAuthActivity({ eventType: 'BRANCH_ACCESS_LOADED', label: 'Branch Access Loaded', message: `${rows.length} mock branch access row(s) loaded.`, vendorId: session.vendorId, staffId: staffId || session.staffId });
  return rows;
}

export function loadTerminalsForCurrentBranch(branchId: string, staffId?: string): TenantTerminalAccessContract[] {
  const session = getCurrentTenantSession();
  const rows = getMockTerminalAccessForStaff(session.vendorId, branchId, staffId || session.staffId);
  recordAuthActivity({ eventType: 'TERMINAL_ACCESS_LOADED', label: 'Terminal Access Loaded', message: `${rows.length} mock terminal access row(s) loaded for ${branchId}.`, vendorId: session.vendorId, staffId: staffId || session.staffId });
  return rows;
}

export function activateStaffMappedSession(staffId: string, branchId: string, terminalId: string, pin?: string): TenantSession {
  const current = getCurrentTenantSession();
  const staff = getMockStaffProfilesForTenant(current.vendorId, current.membershipId).find((row) => row.staffId === staffId) || getMockStaffProfilesForTenant(current.vendorId)[0];
  const branch = getMockBranchAccessForStaff(current.vendorId, staff?.staffId).find((row) => row.branchId === branchId) || getMockBranchAccessForStaff(current.vendorId, staff?.staffId)[0];
  const terminal = getMockTerminalAccessForStaff(current.vendorId, branch?.branchId, staff?.staffId).find((row) => row.terminalId === terminalId) || getMockTerminalAccessForStaff(current.vendorId, branch?.branchId, staff?.staffId)[0];
  const pinAccepted = verifyStaffPinForMappedStaff(staff?.staffId || staffId, pin);
  const session: TenantSession = {
    ...current,
    status: pinAccepted ? 'Session Active' : 'Staff Selection Required',
    staffId: staff?.staffId,
    staffName: staff?.staffName,
    staffRole: staff?.role,
    branchId: branch?.branchId,
    branchName: branch?.branchName,
    terminalId: terminal?.terminalId,
    terminalName: terminal?.terminalName,
    permissions: getTenantPermissionsForRole(staff?.role || current.membershipRole || 'Cashier'),
    tenantResolved: true,
    staffAuthenticated: pinAccepted,
    updatedAt: nowIso(),
    notes: 'Staff mapped session activated from mock tenant directory. No production Auth gate or Firestore business read/write is active.'
  };
  saveSession(session);
  recordAuthActivity({ eventType: 'STAFF_MAPPED_SESSION_ACTIVATED', label: 'Staff Mapped Session Activated', message: `${session.staffName || 'Staff'} activated through mock staff profile mapping.`, vendorId: session.vendorId, staffId: session.staffId });
  refreshTenantSessionClaims(session);
  return session;
}

export function refreshTenantSessionClaims(inputSession?: TenantSession): TenantSessionClaims {
  const session = inputSession || getCurrentTenantSession();
  const claims: TenantSessionClaims = {
    sessionId: session.sessionId,
    mode: 'Mock Directory',
    vendorId: session.vendorId,
    vendorName: session.vendorName,
    membershipId: session.membershipId,
    signedInEmail: session.googleEmail || session.vendorEmail,
    membershipRole: session.membershipRole || session.staffRole,
    staffId: session.staffId,
    staffName: session.staffName,
    staffStatus: session.staffAuthenticated ? 'Active' : 'Pending',
    branchId: session.branchId,
    branchName: session.branchName,
    terminalId: session.terminalId,
    terminalName: session.terminalName,
    terminalStatus: session.terminalId ? 'Active' : 'Pending',
    posAccessStatus: session.staffAuthenticated || session.isBuildDevelopmentSession ? 'Active' : 'Pending',
    permissions: session.permissions,
    createdAt: session.createdAt,
    updatedAt: nowIso(),
    notes: 'Session claims are local build-development claims. Production custom claims and Firestore rules are not active.'
  };
  writeJson(CLAIMS_KEY, claims);
  recordAuthActivity({ eventType: 'SESSION_CLAIMS_CREATED', label: 'Session Claims Created', message: `Local session claims created with ${claims.permissions.length} permission(s).`, vendorId: session.vendorId, staffId: session.staffId });
  return claims;
}

export function getCurrentTenantSessionClaims(): TenantSessionClaims {
  return readJson<TenantSessionClaims | null>(CLAIMS_KEY, null) || refreshTenantSessionClaims(getCurrentTenantSession());
}

export function lockTenantSession(reason: string): TenantSession {
  const session = { ...getCurrentTenantSession(), status: 'Session Locked' as const, lockedAt: nowIso(), updatedAt: nowIso(), notes: reason };
  saveSession(session);
  recordAuthActivity({ eventType: 'TENANT_SESSION_LOCKED', label: 'Tenant Session Locked', message: reason || 'Tenant session locked.', vendorId: session.vendorId, staffId: session.staffId });
  return session;
}

export function unlockTenantSessionPlaceholder(payload: StaffAccessAttempt): TenantSession {
  return activateTenantSession(payload);
}

export function clearTenantSession(): TenantSession {
  if (canUseLocalStorage()) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(CLAIMS_KEY);
  }
  const session = createBuildDevelopmentSession();
  recordAuthActivity({ eventType: 'TENANT_SESSION_CLEARED', label: 'Tenant Session Cleared', message: 'Tenant session cleared. Build-development session restored.', vendorId: session.vendorId, staffId: session.staffId });
  return session;
}

export function getTenantSessionReadiness(): TenantSessionReadiness[] {
  return [
    { item: 'Firebase Config', status: 'Ready', notes: 'Config shell exists; missing env values do not block app.' },
    { item: 'Auth Shell', status: isFirebaseAuthShellEnabled() ? 'Ready' : 'Disabled', notes: 'Auth shell is available but not mandatory.' },
    { item: 'Google Sign-In', status: 'Placeholder', notes: 'Google popup can be tested when Firebase Auth is configured.' },
    { item: 'Tenant Resolution', status: isTenantResolutionEnabled() ? 'Ready' : 'Placeholder', notes: 'Tenant resolution returns a demo vendor in this build.' },
    { item: 'Tenant Membership Mapping', status: 'Placeholder', notes: 'Signed-in email maps to mock vendor membership contracts only.' },
    { item: 'Staff Profile Mapping', status: 'Ready', notes: 'Staff profile, branch access, and terminal access contracts are visible in mock mode.' },
    { item: 'Staff Selection', status: 'Ready', notes: 'Staff, branch, and terminal selection panel is prepared.' },
    { item: 'Session Claims', status: 'Ready', notes: 'Local session claims are created for inspection; production custom claims are not active.' },
    { item: 'Role Permissions', status: 'Ready', notes: 'Tenant roles map to existing POS permission keys. Build-development Owner retains full permissions.' },
    { item: 'Session Persistence', status: 'Ready', notes: 'Tenant session persists in localStorage when available.' },
    { item: 'Firestore Business Data', status: 'Disabled', notes: 'Business Firestore reads/writes remain disabled.' },
    { item: 'Build Development Bypass', status: isBuildDevelopmentBypassEnabled() ? 'Active' : 'Disabled', notes: 'App remains usable without forced login.' }
  ];
}

export function getAuthActivityEvents(): AuthActivityEvent[] {
  return readJson<AuthActivityEvent[]>(ACTIVITY_KEY, []);
}

