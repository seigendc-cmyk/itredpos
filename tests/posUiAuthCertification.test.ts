import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  authenticateStaffAccess,
  clearSciAuthSessions,
  readPersistedSciVendorOwnerSession,
  readSciPosStaffSession,
  readSciVendorOwnerSession,
  saveSciPosStaffSession,
  saveSciVendorOwnerSession,
  SCI_VENDOR_OWNER_SESSION_KEY,
  type SciPosStaffSession,
  type SciVendorOwnerSession,
  type StaffAuthInput
} from '../src/sci-auth/StaffAuthService';
import { certifyStaffRuntimeSession, certifyVendorIdentity } from '../src/pos-new/auth/posRuntimeCertification';
import {
  getEffectivePageIdsForSession,
  sessionHasEffectivePermission
} from '../src/pos-new/auth/effectivePermissionService';
import {
  clearAllCheckoutRequestIds,
  getOrCreateCheckoutRequestId
} from '../src/pos-new/services/salesCheckoutRequestIdentity';
import { completeSale, executeCanonicalCheckoutPipeline } from '../src/pos-new/services/salesCheckoutService';
import { canonicalSalesTransactionService } from '../src/pos-new/services/sales/canonicalSalesTransactionService';
import type { VendorLicenseRuntimeSnapshot } from '../src/pos-new/auth/vendorLicenseRuntimeService';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const owner: SciVendorOwnerSession = {
  vendorId: 'vendor-a',
  ownerUid: 'firebase-owner-a',
  ownerName: 'Owner A',
  ownerEmail: 'owner@example.com',
  vendorName: 'Vendor A',
  role: 'Owner',
  signedInAt: new Date().toISOString()
};

const staffSession = (overrides: Partial<SciPosStaffSession> = {}): SciPosStaffSession => ({
  vendorId: 'vendor-a',
  vendorName: 'Vendor A',
  branchId: 'branch-a',
  branchName: 'Branch A',
  warehouseId: 'warehouse-a',
  warehouseName: 'Warehouse A',
  terminalId: 'terminal-a',
  terminalName: 'Terminal A',
  staffId: 'cashier-a',
  staffName: 'Cashier A',
  role: 'Cashier',
  permissions: ['dashboard.view', 'sales.open', 'sales.complete'],
  signedInAt: new Date().toISOString(),
  validatedAt: new Date().toISOString(),
  sessionVersion: 1,
  ...overrides
});

const allowedLicense = (overrides: Partial<VendorLicenseRuntimeSnapshot> = {}): VendorLicenseRuntimeSnapshot => ({
  vendorId: 'vendor-a',
  allowed: true,
  licenseStatusKnown: true,
  message: 'License active.',
  ...overrides
} as VendorLicenseRuntimeSnapshot);

const staffAuthInput = (overrides: Partial<StaffAuthInput> = {}): StaffAuthInput => ({
  vendorSession: owner,
  staffId: 'cashier-a',
  pin: '2468',
  branchId: 'branch-a',
  warehouseId: 'warehouse-a',
  terminalId: 'terminal-a',
  staff: [{
    staffId: 'cashier-a', vendorId: 'vendor-a', branchId: 'branch-a', staffName: 'Cashier A', role: 'Cashier',
    status: 'Active', pin: '2468', permissions: ['sales.open', 'sales.complete'], assignedTerminalIds: ['terminal-a']
  }],
  branches: [{ branchId: 'branch-a', vendorId: 'vendor-a', branchName: 'Branch A', status: 'Active' }],
  warehouses: [{ warehouseId: 'warehouse-a', vendorId: 'vendor-a', branchId: 'branch-a', warehouseName: 'Warehouse A', status: 'Active' }],
  terminals: [{ terminalId: 'terminal-a', vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', terminalName: 'Terminal A', status: 'Active' }],
  ...overrides
});

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
  Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true });
  clearSciAuthSessions(true);
  vi.restoreAllMocks();
});

describe('Build 09.3A POS UI and authentication certification', () => {
  test('unauthenticated users cannot establish the protected POS runtime', () => {
    const app = readFileSync(resolve('src/App.tsx'), 'utf8');
    expect(app).toContain('<VendorAuthGate>');
    expect(readSciVendorOwnerSession()).toBeNull();
    expect(readSciPosStaffSession()).toBeNull();
  });

  test('an unresolved vendor cannot proceed', () => {
    expect(certifyVendorIdentity({ uid: 'firebase-owner-a', email: 'owner@example.com' }, { vendorId: '' }).certified).toBe(false);
  });

  test('a Firebase identity must match the resolved vendor owner', () => {
    expect(certifyVendorIdentity({ uid: 'other-user', email: 'other@example.com' }, owner).certified).toBe(false);
  });

  test('an expired or invalid license fails closed', () => {
    expect(certifyStaffRuntimeSession(owner, staffSession(), allowedLicense({ allowed: false, message: 'Expired.' })).certified).toBe(false);
    expect(certifyStaffRuntimeSession(owner, staffSession(), allowedLicense({ licenseStatusKnown: false })).certified).toBe(false);
  });

  test('inactive staff cannot log in', () => {
    const input = staffAuthInput();
    input.staff[0].status = 'Inactive';
    expect(authenticateStaffAccess(input)).toMatchObject({ ok: false, message: 'Staff record is inactive' });
  });

  test('staff cannot select an unauthorized branch', () => {
    const input = staffAuthInput({ branchId: 'branch-b' });
    input.branches.push({ branchId: 'branch-b', vendorId: 'vendor-a', branchName: 'Branch B', status: 'Active' });
    expect(authenticateStaffAccess(input)).toMatchObject({ ok: false, message: 'Branch mismatch' });
  });

  test('staff cannot select a terminal from another branch', () => {
    const input = staffAuthInput();
    input.terminals[0].branchId = 'branch-b';
    expect(authenticateStaffAccess(input)).toMatchObject({ ok: false, message: 'Terminal mismatch' });
  });

  test('staff cannot select a terminal attached to another warehouse', () => {
    const input = staffAuthInput();
    input.terminals[0].warehouseId = 'warehouse-b';
    expect(authenticateStaffAccess(input)).toMatchObject({ ok: false, message: 'Terminal warehouse mismatch' });
  });

  test('cross-vendor session data is rejected', () => {
    expect(certifyStaffRuntimeSession(owner, staffSession({ vendorId: 'vendor-b' }), allowedLicense()).certified).toBe(false);
  });

  test('stale browser sessions are rejected', () => {
    const stale = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString();
    expect(certifyStaffRuntimeSession(owner, staffSession({ signedInAt: stale, validatedAt: stale }), allowedLicense()).certified).toBe(false);
  });

  test('logout clears authoritative runtime context', () => {
    saveSciVendorOwnerSession(owner);
    saveSciPosStaffSession(staffSession());
    clearSciAuthSessions(true);
    expect(readSciVendorOwnerSession()).toBeNull();
    expect(readSciPosStaffSession()).toBeNull();
    expect(localStorage.getItem(SCI_VENDOR_OWNER_SESSION_KEY)).toBeNull();
  });

  test('menu visibility is derived from authenticated session permissions', () => {
    const session = { role: 'Cashier', permissions: ['dashboard.view'] };
    expect(getEffectivePageIdsForSession(session)).toEqual(['DASHBOARD']);
    expect(getEffectivePageIdsForSession({ ...session, permissions: ['sales.open'] })).toEqual(['SALES']);
  });

  test('hidden menus do not substitute for action-level permission checks', () => {
    const session = { role: 'Cashier', permissions: ['sales.open'] };
    expect(getEffectivePageIdsForSession(session)).toContain('SALES');
    expect(sessionHasEffectivePermission(session, 'sales.complete')).toBe(false);
  });

  test('unauthorized sale completion fails before repository posting', async () => {
    await expect(executeCanonicalCheckoutPipeline({
      session: { vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', terminalId: 'terminal-a', staffId: 'cashier-a' },
      permissions: { canCompleteSale: false }
    } as never)).rejects.toThrow('permission to complete');
  });

  test('the cashier UI invokes the canonical checkout adapter exactly once', () => {
    const salesUi = readFileSync(resolve('src/pos-new/pages/PosSales.tsx'), 'utf8');
    expect(salesUi.match(/await completeSale\s*\(/g)).toHaveLength(1);
    expect(salesUi).toContain('idempotencyKey: checkoutRequestId.current');
  });

  test('an authorized checkout adapter call reaches canonical authority exactly once with the same identity', async () => {
    const canonical = vi.spyOn(canonicalSalesTransactionService, 'completeCheckout').mockResolvedValue({} as never);
    const input = {
      session: { vendorId: 'vendor-a', branchId: 'branch-a', warehouseId: 'warehouse-a', terminalId: 'terminal-a', staffId: 'cashier-a' },
      permissions: { canCompleteSale: true },
      idempotencyKey: 'checkout-vendor-a-branch-a-terminal-a-request-a'
    } as never;
    await completeSale(input);
    expect(canonical).toHaveBeenCalledOnce();
    expect(canonical).toHaveBeenCalledWith(input);
  });

  test('checkout identity is taken from the authenticated session', () => {
    const salesUi = readFileSync(resolve('src/pos-new/pages/PosSales.tsx'), 'utf8');
    for (const field of ['vendorId = session?.vendorId', 'branchId = session?.branchId', 'terminalId = session?.terminalId', 'staffId = session?.staffId']) {
      expect(salesUi).toContain(field);
    }
    expect(salesUi).toContain('session,');
  });

  test('the sales UI has no direct Firestore or inventory posting bypass', () => {
    const salesUi = readFileSync(resolve('src/pos-new/pages/PosSales.tsx'), 'utf8');
    expect(salesUi).not.toMatch(/from ['"]firebase\/firestore['"]/);
    expect(salesUi).not.toMatch(/\b(addDoc|setDoc|updateDoc|writeBatch|runTransaction|consumeStockForSale)\s*\(/);
  });

  test('the legacy vendor gate delegates to the canonical gate', () => {
    const legacy = readFileSync(resolve('src/pos-new/auth/PosVendorAuthGate.tsx'), 'utf8');
    expect(legacy).toContain('export { default } from "../../sci-auth/VendorAuthGate"');
    expect(readFileSync(resolve('src/App.tsx'), 'utf8')).not.toContain('PosVendorAuthGate');
  });

  test('browser storage alone cannot create an authoritative session', () => {
    localStorage.setItem(SCI_VENDOR_OWNER_SESSION_KEY, JSON.stringify(owner));
    expect(readPersistedSciVendorOwnerSession()).toEqual(owner);
    expect(readSciVendorOwnerSession()).toBeNull();
  });

  test('tenant switching invalidates the previous staff and terminal context', () => {
    saveSciVendorOwnerSession(owner);
    saveSciPosStaffSession(staffSession());
    saveSciVendorOwnerSession({ ...owner, vendorId: 'vendor-b', vendorName: 'Vendor B' });
    expect(readSciPosStaffSession()).toBeNull();
    expect(localStorage.getItem('sci_pos_staff_session')).toBeNull();
  });

  test('logout clears every pending checkout request identity', () => {
    getOrCreateCheckoutRequestId(sessionStorage, { vendorId: 'vendor-a', branchId: 'branch-a', terminalId: 'terminal-a' });
    getOrCreateCheckoutRequestId(sessionStorage, { vendorId: 'vendor-b', branchId: 'branch-b', terminalId: 'terminal-b' });
    sessionStorage.setItem('unrelated', 'keep');
    clearAllCheckoutRequestIds(sessionStorage);
    expect(sessionStorage.length).toBe(1);
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });
});
