import type { TenantScope, SharedCommerceDocument } from './commerceDataContract';

export interface CommerceValidationResult {
  valid: boolean;
  errors: string[];
}

const blankOrWhitespace = (value: string | undefined | null): boolean =>
  typeof value !== 'string' || value.trim().length === 0;

export function validateVendorId(vendorId: string): void {
  if (blankOrWhitespace(vendorId)) {
    throw new Error('vendorId must be a non-blank, non-whitespace string.');
  }
}

export function validateTenantScope(scope: TenantScope): void {
  const errors: string[] = [];
  if (blankOrWhitespace(scope.vendorId)) {
    errors.push('TenantScope.vendorId must be a non-blank, non-whitespace string.');
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

export function validateSharedDocument(document: SharedCommerceDocument): void {
  const errors: string[] = [];
  if (blankOrWhitespace(document.vendorId)) {
    errors.push('vendorId is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(document.createdBy)) {
    errors.push('createdBy is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(document.updatedBy)) {
    errors.push('updatedBy is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(document.sourceApp)) {
    errors.push('sourceApp is required and must not be blank or whitespace.');
  }
  if (document.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1.');
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
