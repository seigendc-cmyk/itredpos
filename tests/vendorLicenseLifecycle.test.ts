import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  createDefaultDemoLicense,
  createDefaultDemoPlan,
  createInitialVendorLicenseLifecycle,
  DEFAULT_PLAN_FEATURE_FLAGS,
  DEFAULT_VENDOR_TRIAL_DAYS
} from '../src/shared/backend';
import { evaluateVendorLicenseRuntime } from '../src/pos-new/auth/vendorLicenseRuntimeService';
import { buildLifecycleSafePlanAssignment, isExactLegacyDemoBootstrap } from '../src/platform/pricingPlansService';

const vendorId = 'vendor-lifecycle-a';
const future = '2099-01-01T00:00:00.000Z';

function evaluate(overrides: Record<string, unknown> = {}, vendor: Record<string, unknown> = {}) {
  return evaluateVendorLicenseRuntime(vendorId, {
    planCode: 'DEMO',
    licenseStatus: 'Trial',
    activationStatus: 'PendingConsoleVerification',
    trialStartedAt: '2026-01-01T00:00:00.000Z',
    trialExpiresAt: future,
    featureFlags: DEFAULT_PLAN_FEATURE_FLAGS.DEMO,
    ...overrides
  }, {
    verificationStatus: 'Pending',
    accountStatus: 'Trial',
    ...vendor
  }, {}, { offline: false, source: 'firestore' });
}

describe('canonical vendor license lifecycle', () => {
  test('new onboarding records share one DEMO plan and Trial lifecycle', () => {
    const now = new Date('2026-07-18T00:00:00.000Z');
    const lifecycle = createInitialVendorLicenseLifecycle(now);
    const license = createDefaultDemoLicense(vendorId, DEFAULT_VENDOR_TRIAL_DAYS, now);
    const plan = createDefaultDemoPlan(vendorId, now);
    expect(lifecycle).toMatchObject({
      planCode: 'DEMO', licenseStatus: 'Trial', activationStatus: 'PendingConsoleVerification',
      verificationStatus: 'Pending', accountStatus: 'Trial', licenseMode: 'demo'
    });
    expect(license).toMatchObject({ planCode: lifecycle.planCode, licenseStatus: lifecycle.licenseStatus, activationStatus: lifecycle.activationStatus });
    expect(plan).toMatchObject({ planCode: lifecycle.planCode, licenseStatus: lifecycle.licenseStatus, activationStatus: lifecycle.activationStatus, accountStatus: lifecycle.accountStatus });
    expect(license.trialExpiresAt).toBe(plan.trialExpiresAt);
    expect(license.featureFlags).toEqual(DEFAULT_PLAN_FEATURE_FLAGS.DEMO);
    expect(license.featureFlags.salesEnabled).toBe(true);
  });

  test('pending Trial, active Trial, and active Active are allowed', () => {
    expect(evaluate({ licenseMode: 'demo' })).toMatchObject({ allowed: true, licenseMode: 'demo' });
    expect(evaluate({ activationStatus: 'Active' }).allowed).toBe(true);
    expect(evaluate({ activationStatus: 'Active', licenseStatus: 'Active' }, { accountStatus: 'Active', verificationStatus: 'Verified' }).allowed).toBe(true);
  });

  test('DEMO is not a lifecycle status and receives a clear block reason', () => {
    expect(evaluate({ licenseStatus: 'DEMO' })).toMatchObject({ allowed: false, blockReason: 'InvalidLicenseState' });
  });

  test('rejected, suspended, and expired states remain blocked', () => {
    expect(evaluate({}, { verificationStatus: 'Rejected' })).toMatchObject({ allowed: false, blockReason: 'VerificationRejected' });
    expect(evaluate({}, { accountStatus: 'Suspended' })).toMatchObject({ allowed: false, blockReason: 'AccountSuspended' });
    expect(evaluate({ trialExpiresAt: '2000-01-01T00:00:00.000Z' })).toMatchObject({ allowed: false, blockReason: 'LicenseRequired' });
  });

  test('plan assignment changes entitlement without corrupting lifecycle', () => {
    const patch = buildLifecycleSafePlanAssignment({
      planCode: 'STANDARD', planName: 'Standard', featureFlags: DEFAULT_PLAN_FEATURE_FLAGS.STANDARD,
      limits: { maxBranches: 3, maxWarehouses: 3, maxTerminals: 6, maxStaff: 20, maxProducts: 10000 },
      updatedAt: '2026-07-18T00:00:00.000Z'
    });
    expect(patch.featureFlags).toEqual(DEFAULT_PLAN_FEATURE_FLAGS.STANDARD);
    expect(patch).not.toHaveProperty('licenseStatus');
    expect(patch).not.toHaveProperty('activationStatus');
    expect(patch).not.toHaveProperty('verificationStatus');
    expect(patch).not.toHaveProperty('accountStatus');
  });

  test('only the exact legacy DEMO bootstrap is repairable', () => {
    const legacy = { vendor: { vendorId, planCode: 'DEMO', licenseStatus: 'DEMO', status: 'Active' } };
    expect(isExactLegacyDemoBootstrap(legacy)).toBe(true);
    expect(isExactLegacyDemoBootstrap({ vendor: { ...legacy.vendor, licenseStatus: 'Active' } })).toBe(false);
    expect(isExactLegacyDemoBootstrap({ vendor: { ...legacy.vendor, accountStatus: 'Suspended' } })).toBe(false);
    expect(isExactLegacyDemoBootstrap({ ...legacy, vendorLicense: { planCode: 'PRO', licenseStatus: 'Active' } })).toBe(false);
    expect(isExactLegacyDemoBootstrap({ ...legacy, vendorLicense: { planCode: 'DEMO', licenseStatus: 'Expired' } })).toBe(false);
  });

  test('valid lifecycle reaches staff access and refresh evaluation is stable', () => {
    const first = evaluate();
    const refreshed = evaluate();
    expect(first.allowed).toBe(true);
    expect(refreshed.allowed).toBe(true);
    expect(refreshed.planCode).toBe(first.planCode);
    const gate = readFileSync(resolve('src/sci-auth/VendorAuthGate.tsx'), 'utf8');
    expect(gate.indexOf('if (!snapshot.allowed)')).toBeLessThan(gate.indexOf('setStage("staff")'));
  });
});
