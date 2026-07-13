import type { TenantScope, SharedCommerceDocument, SharedBIEventRecord, SharedAuditRecord } from './commerceDataContract';
import { COMMERCE_SCHEMA_VERSION } from './commerceDataContract';

export interface CommerceValidationResult {
  valid: boolean;
  errors: string[];
}

export type CommerceValidator<T> = (value: T) => void;

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
  if (blankOrWhitespace(document.sciId)) {
    errors.push('sciId is required and must not be blank or whitespace.');
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
  if (document.schemaVersion !== COMMERCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${COMMERCE_SCHEMA_VERSION}.`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

export function validateBIEvent(event: SharedBIEventRecord): void {
  const errors: string[] = [];
  if (blankOrWhitespace(event.vendorId)) {
    errors.push('BI event vendorId is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(event.eventId)) {
    errors.push('BI event eventId is required.');
  }
  if (blankOrWhitespace(event.eventType)) {
    errors.push('BI event eventType is required.');
  }
  if (blankOrWhitespace(event.sourceApp)) {
    errors.push('BI event sourceApp is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(event.entityType) || blankOrWhitespace(event.entityId)) {
    errors.push('BI event must identify the affected entity (entityType + entityId).');
  }
  if (blankOrWhitespace(event.timestamp)) {
    errors.push('BI event timestamp is required.');
  }
  if (event.schemaVersion !== undefined && event.schemaVersion !== COMMERCE_SCHEMA_VERSION) {
    errors.push(`BI event schemaVersion must be ${COMMERCE_SCHEMA_VERSION}.`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}

export function validateAuditRecord(record: SharedAuditRecord): void {
  const errors: string[] = [];
  if (blankOrWhitespace(record.vendorId)) {
    errors.push('Audit record vendorId is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(record.sourceApp)) {
    errors.push('Audit record sourceApp is required and must not be blank or whitespace.');
  }
  if (blankOrWhitespace(record.actorId)) {
    errors.push('Audit record must identify an actor (actorId must not be blank).');
  }
  if (blankOrWhitespace(record.action)) {
    errors.push('Audit record action is required.');
  }
  if (blankOrWhitespace(record.entityType) || blankOrWhitespace(record.entityId)) {
    errors.push('Audit record must identify the affected entity (entityType + entityId).');
  }
  if (blankOrWhitespace(record.createdAt)) {
    errors.push('Audit record createdAt is required.');
  }
  if (errors.length > 0) {
    throw new Error(errors.join(' '));
  }
}
