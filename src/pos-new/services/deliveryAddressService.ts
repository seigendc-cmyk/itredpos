import type { DeliveryAddressRecord, PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { DELIVERY_COLLECTIONS, resolveDeliveryContext } from './deliveryService';
import type { CanonicalPurchaseSession } from './purchaseSessionService';

const ADDRESS_KEY = DELIVERY_COLLECTIONS.deliveryAddresses;

function clean(value: unknown): string {
  return String(value ?? '').trim();
}

function makeAddressId(vendorId: string, customerId: string, label: string): string {
  return `${vendorId}_${customerId}_${label || Date.now()}`.replace(/[^A-Za-z0-9_-]/g, '_');
}

export async function upsertDeliveryAddress(
  payload: Omit<DeliveryAddressRecord, 'addressId' | 'vendorId' | 'verified' | 'createdAt'> & Partial<Pick<DeliveryAddressRecord, 'addressId' | 'vendorId' | 'verified' | 'createdAt' | 'updatedAt'>>,
  session?: PosSession | CanonicalPurchaseSession | null
): Promise<DeliveryAddressRecord> {
  const context = resolveDeliveryContext(session);
  if (!clean(payload.customerId)) throw new Error('Customer is required for delivery address.');
  if (!clean(payload.addressLine)) throw new Error('Delivery address is required.');
  if (!clean(payload.contactPhone)) throw new Error('Delivery contact phone is required.');
  const now = new Date().toISOString();
  const address: DeliveryAddressRecord = {
    addressId: payload.addressId || makeAddressId(context.vendorId, payload.customerId, payload.label),
    vendorId: context.vendorId,
    customerId: payload.customerId,
    label: clean(payload.label) || 'Delivery',
    addressLine: payload.addressLine,
    suburb: payload.suburb,
    city: payload.city,
    country: payload.country || 'Zimbabwe',
    latitude: payload.latitude,
    longitude: payload.longitude,
    landmark: payload.landmark,
    contactPhone: payload.contactPhone,
    contactName: payload.contactName,
    verified: Boolean(payload.verified),
    defaultAddress: payload.defaultAddress,
    verifiedAt: payload.verified ? payload.verifiedAt || now : payload.verifiedAt,
    createdAt: payload.createdAt || now,
    updatedAt: now
  };
  const rows = readVendorScopedList<DeliveryAddressRecord>(ADDRESS_KEY, [], context.vendorId);
  const withoutCurrent = rows.filter((row) => row.addressId !== address.addressId);
  const nextRows = address.defaultAddress
    ? withoutCurrent.map((row) => row.customerId === address.customerId ? { ...row, defaultAddress: false, updatedAt: now } : row)
    : withoutCurrent;
  writeVendorScopedList(ADDRESS_KEY, [address, ...nextRows], context.vendorId);
  return address;
}

export async function getDeliveryAddresses(customerId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryAddressRecord[]> {
  const context = resolveDeliveryContext(session);
  return readVendorScopedList<DeliveryAddressRecord>(ADDRESS_KEY, [], context.vendorId)
    .filter((row) => row.customerId === customerId);
}

export async function confirmDeliveryAddress(addressId: string, session?: PosSession | CanonicalPurchaseSession | null): Promise<DeliveryAddressRecord | null> {
  const context = resolveDeliveryContext(session);
  const now = new Date().toISOString();
  let updated: DeliveryAddressRecord | null = null;
  const rows = readVendorScopedList<DeliveryAddressRecord>(ADDRESS_KEY, [], context.vendorId).map((row) => {
    if (row.addressId !== addressId) return row;
    updated = { ...row, verified: true, verifiedAt: now, updatedAt: now };
    return updated;
  });
  writeVendorScopedList(ADDRESS_KEY, rows, context.vendorId);
  return updated;
}
