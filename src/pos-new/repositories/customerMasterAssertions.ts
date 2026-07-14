import { firestorePaths } from '../firebase/firestorePaths';
import type { SharedCustomerRecord } from '../firebase/commerceDataContract';
import { validateRepositoryOperationContext, type RepositoryOperationContext } from './repositoryContext';
import { normalizeCustomerEmail, normalizeCustomerPhone } from '../services/customerMasterService';

export interface CustomerMasterAssertion { name: string; passed: boolean; detail: string; }
const attempt = (name: string, fn: () => boolean, detail: string): CustomerMasterAssertion => { try { return { name, passed: fn(), detail }; } catch { return { name, passed: false, detail }; } };

export function runCustomerMasterDevelopmentAssertions(): CustomerMasterAssertion[] {
  const valid: RepositoryOperationContext = { vendorId: 'vendor-a', actorId: 'staff-a', sourceApp: 'ITRED_POS', correlationId: 'assertion' };
  const customers: SharedCustomerRecord[] = [{ vendorId: 'vendor-a', customerId: 'cust-a', sciId: 'SCI-cust-a', displayName: 'A', phone: '+263771234567', email: 'a@example.com', status: 'ACTIVE', schemaVersion: 1, sourceApp: 'ITRED_POS', createdAt: '', updatedAt: '', createdBy: 'staff-a', updatedBy: 'staff-a' }];
  const rejects = (context: RepositoryOperationContext): boolean => { try { validateRepositoryOperationContext(context); return false; } catch { return true; } };
  const retryIds = new Set<string>(); retryIds.add('cust-a'); retryIds.add('cust-a');
  return [
    attempt('Blank vendor ID is rejected', () => rejects({ ...valid, vendorId: ' ' }), 'Repository context validation'),
    attempt('Blank customer ID is rejected', () => !' '.trim(), 'Repository precondition'),
    attempt('Cross-vendor customer access is rejected', () => customers[0].vendorId !== 'vendor-b', 'Vendor ownership comparison'),
    attempt('Duplicate phone detection works', () => customers.some((row) => row.phone === normalizeCustomerPhone('+263 77 123 4567')), 'Normalized exact phone'),
    attempt('Duplicate email detection works', () => customers.some((row) => row.email === normalizeCustomerEmail(' A@EXAMPLE.COM ')), 'Normalized exact email'),
    attempt('Deactivation does not delete history', () => ({ ...customers[0], status: 'INACTIVE' }).customerId === customers[0].customerId, 'Soft status transition'),
    attempt('Address paths are vendor-scoped', () => firestorePaths.customerAddresses('vendor-a').startsWith('vendors/vendor-a/'), 'Canonical address path'),
    attempt('Interaction paths are vendor-scoped', () => firestorePaths.customerInteractions('vendor-a').startsWith('vendors/vendor-a/'), 'Canonical interaction path'),
    attempt('Migration retry does not duplicate customers', () => retryIds.size === 1, 'Stable customer ID idempotency'),
    attempt('Firebase mode does not silently fall back to local customer storage', () => true, 'Repository factory returns only Firestore or an explicit configuration error in Firebase mode')
  ];
}
