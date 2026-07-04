export type PosAuthStage =
  | 'checkingGoogleSession'
  | 'googleSignInRequired'
  | 'businessProfileRequired'
  | 'staffAccessRequired'
  | 'licenseRequired'
  | 'posReady';

export type PosVendorAuthContext = {
  stage: PosAuthStage;
  googleUid?: string;
  googleEmail?: string;
  vendorId?: string;
  vendorName?: string;
  branchId?: string;
  warehouseId?: string;
  staffId?: string;
  staffRole?: string;
  licenseStatus?: 'Demo' | 'Active' | 'Expired' | 'Suspended';
  demoExpiresAt?: string;
  message?: string;
};

export const POS_AUTH_STORAGE_KEY = 'sci_pos_vendor_auth_context';

export function createInitialPosAuthContext(): PosVendorAuthContext {
  return {
    stage: 'checkingGoogleSession',
    licenseStatus: 'Demo'
  };
}

export function savePosAuthContext(context: PosVendorAuthContext): void {
  localStorage.setItem(POS_AUTH_STORAGE_KEY, JSON.stringify(context));
}

export function readPosAuthContext(): PosVendorAuthContext | null {
  try {
    const raw = localStorage.getItem(POS_AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) as PosVendorAuthContext : null;
  } catch {
    return null;
  }
}

export function clearPosAuthContext(): void {
  localStorage.removeItem(POS_AUTH_STORAGE_KEY);
}

export function resolveNextAuthStage(context: PosVendorAuthContext): PosAuthStage {
  if (!context.googleUid || !context.googleEmail) return 'googleSignInRequired';
  if (!context.vendorId || !context.vendorName) return 'businessProfileRequired';

  if (context.licenseStatus === 'Expired' || context.licenseStatus === 'Suspended') {
    return 'licenseRequired';
  }

  if (!context.staffId || !context.staffRole) return 'staffAccessRequired';

  return 'posReady';
}
