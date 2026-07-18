import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import {
  assertVendorResolutionAuth,
  classifyVendorResolutionError,
  resolveVendorFromExactDocuments,
  validateResolvedVendor,
  validateVendorMapping,
  VendorResolutionError
} from '../src/sci-auth/VendorResolutionService';

const uid = 'owner-a';
const vendorId = 'vendor-owner-a';
const mapping = { uid, vendorId, status: 'active', role: 'Owner' };
const vendor = { vendorId, ownerUid: uid, status: 'Active', businessName: 'Tenant A' };

function codeOf(action: () => unknown): string {
  try {
    action();
    return 'NO_ERROR';
  } catch (error) {
    return error instanceof VendorResolutionError ? error.code : 'WRONG_ERROR';
  }
}

describe('VendorAuthGate canonical vendor mapping resolution', () => {
  test('auth loading and signed-out states fail before a document reader can run', () => {
    expect(codeOf(() => assertVendorResolutionAuth({ authRestored: false, currentUser: null }))).toBe('AUTH_LOADING');
    expect(codeOf(() => assertVendorResolutionAuth({ authRestored: true, currentUser: null }))).toBe('AUTH_REQUIRED');
  });

  test('reads only vendorUsers/{ownUid}, then the exact mapped vendor', async () => {
    const paths: string[] = [];
    const result = await resolveVendorFromExactDocuments({
      uid,
      email: 'owner-a@example.test',
      readDocument: async (collectionName, documentId) => {
        paths.push(`${collectionName}/${documentId}`);
        return collectionName === 'vendorUsers'
          ? { exists: true, data: mapping }
          : { exists: true, data: vendor };
      }
    });
    expect(paths).toEqual([`vendorUsers/${uid}`, `vendors/${vendorId}`]);
    expect(result).toMatchObject({ state: 'resolved', vendorId });
  });

  test('missing own mapping is detectable and routes to onboarding without a vendor read', async () => {
    const reader = vi.fn(async () => ({ exists: false }));
    const result = await resolveVendorFromExactDocuments({ uid, email: 'owner-a@example.test', readDocument: reader });
    expect(result).toEqual({ state: 'onboarding', code: 'VENDOR_USER_NOT_FOUND', uid, email: 'owner-a@example.test' });
    expect(reader).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledWith('vendorUsers', uid);
  });

  test('inactive or conflicting mappings never grant access', () => {
    expect(codeOf(() => validateVendorMapping(uid, { ...mapping, status: 'inactive' }))).toBe('VENDOR_USER_INACTIVE');
    expect(codeOf(() => validateVendorMapping(uid, { ...mapping, uid: 'tenant-b' }))).toBe('VENDOR_USER_CONFLICT');
    expect(codeOf(() => validateVendorMapping(uid, { ...mapping, vendorId: '' }))).toBe('VENDOR_USER_CONFLICT');
  });

  test('missing mapped vendor is a partial-state error', async () => {
    await expect(resolveVendorFromExactDocuments({
      uid,
      email: 'owner-a@example.test',
      readDocument: async (collectionName) => collectionName === 'vendorUsers'
        ? { exists: true, data: mapping }
        : { exists: false }
    })).rejects.toMatchObject({ code: 'VENDOR_NOT_FOUND' });
  });

  test('vendor ID conflict and owner UID conflict are blocked', () => {
    expect(codeOf(() => validateResolvedVendor({ uid, vendorId, vendor: { ...vendor, vendorId: 'vendor-b' } }))).toBe('VENDOR_USER_CONFLICT');
    expect(codeOf(() => validateResolvedVendor({ uid, vendorId, vendor: { ...vendor, ownerUid: 'owner-b' } }))).toBe('VENDOR_OWNERSHIP_CONFLICT');
  });

  test('legacy vendor records may omit vendorId but cannot omit ownership', () => {
    expect(validateResolvedVendor({ uid, vendorId, vendor: { ownerUid: uid, status: 'Active' } }).vendorId).toBe(vendorId);
  });

  test('permission-denied remains blocked instead of becoming onboarding', () => {
    expect(classifyVendorResolutionError({ code: 'permission-denied' }).code).toBe('PERMISSION_DENIED');
    expect(classifyVendorResolutionError({ code: 'unavailable' }).code).toBe('NETWORK_ERROR');
  });

  test('a browser refresh deterministically resolves the same vendor without writes', async () => {
    const reader = vi.fn(async (collectionName: 'vendorUsers' | 'vendors') => collectionName === 'vendorUsers'
      ? { exists: true, data: mapping }
      : { exists: true, data: vendor });
    const first = await resolveVendorFromExactDocuments({ uid, email: '', readDocument: reader });
    const refreshed = await resolveVendorFromExactDocuments({ uid, email: '', readDocument: reader });
    expect(first).toEqual(refreshed);
    expect(reader).toHaveBeenCalledTimes(4);
  });

  test('canonical gate contains no vendors query and starts license validation after resolution', () => {
    const source = readFileSync(resolve('src/sci-auth/VendorAuthGate.tsx'), 'utf8');
    expect(source).not.toContain('getDocs');
    expect(source).not.toContain('collection(db, "vendors")');
    expect(source).not.toContain('query(');
    expect(source).toContain('resolveAuthenticatedVendor');
    expect(source.indexOf('saveOwnerSession(resolution.vendor)')).toBeLessThan(source.indexOf('setStage("license")'));
  });
});
