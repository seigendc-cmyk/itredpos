export interface SciVendorOwnerSession {
  vendorId: string;
  ownerName: string;
  ownerEmail: string;
  vendorName: string;
  tradingName?: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  city?: string;
  suburb?: string;
  physicalAddress?: string;
  status?: string;
  mode?: string;
  role: string;
  signedInAt: string;
}

export interface StaffAuthInput {
  vendorId: string;
  staffId: string;
  pin: string;
}

export interface StaffAuthResult {
  ok: boolean;
  message: string;
  session?: ReturnType<typeof createOwnerPosSession>;
}

const SESSION_KEY = 'sci_vendor_owner_session';
const DEFAULT_PIN = '040369';

export function readSciVendorOwnerSession(): SciVendorOwnerSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SciVendorOwnerSession;
  } catch {
    return null;
  }
}

export function loadStaffForCurrentVendor(): { staffId: string; staffName: string; role: string; pin: string; branchId: string; terminalId: string }[] {
  const session = readSciVendorOwnerSession();
  const ownerName = session?.ownerName || 'Owner';
  const staffId = 'owner-staff';
  const branchId = 'main-branch';
  const terminalId = 'TERM-MAIN-001';

  return [
    {
      staffId,
      staffName: ownerName,
      role: 'Owner',
      pin: DEFAULT_PIN,
      branchId,
      terminalId
    }
  ];
}

export function authenticateStaffAccess(input: StaffAuthInput): StaffAuthResult {
  const session = readSciVendorOwnerSession();

  if (!session) {
    return { ok: false, message: 'No active vendor owner session found. Please sign in again.' };
  }

  if (session.vendorId !== input.vendorId) {
    return { ok: false, message: 'Staff does not belong to the current vendor.' };
  }

  if (input.staffId !== 'owner-staff') {
    return { ok: false, message: 'ACCESS PERMISSION DENIED' };
  }

  if (input.pin !== DEFAULT_PIN) {
    return { ok: false, message: 'ACCESS PERMISSION DENIED' };
  }

  return {
    ok: true,
    message: 'Access granted.',
    session: createOwnerPosSession()
  };
}

export function createOwnerPosSession() {
  const session = readSciVendorOwnerSession();
  const vendorName = session?.vendorName || session?.tradingName || 'New Business';
  const ownerName = session?.ownerName || 'Owner';

  return {
    vendor: vendorName,
    vendorId: session?.vendorId || 'demo-vendor',
    branch: 'Main Branch',
    branchId: 'main-branch',
    terminal: 'Main POS Terminal',
    terminalId: 'TERM-MAIN-001',
    staffName: ownerName,
    role: 'Owner',
    licenseId: 'demo-license',
    planId: 'DEMO',
    licenseMode: 'demo',
    storageMode: 'LOCAL',
    activationId: 'demo-activation',
    dashboardType: 'POS',
    openedAt: new Date().toISOString()
  };
}
