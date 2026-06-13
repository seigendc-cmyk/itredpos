export type FirestoreDateValue = string | number | { seconds?: number; nanoseconds?: number; toDate?: () => Date } | Date | null | undefined;

export function nowIso(): string {
  return new Date().toISOString();
}

export function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function normalizeFirestoreTimestamp(value: FirestoreDateValue): string {
  if (!value) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'string') return isIsoDateString(value) ? new Date(value).toISOString() : '';
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  if (typeof value.seconds === 'number') {
    const millis = (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
    const date = new Date(millis);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }
  return '';
}

export function toFirestoreDateValue(value: FirestoreDateValue): string {
  return normalizeFirestoreTimestamp(value) || nowIso();
}

export function fromFirestoreDateValue(value: FirestoreDateValue): string {
  return normalizeFirestoreTimestamp(value);
}

