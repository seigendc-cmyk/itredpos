import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { getCOGSReserveSummary } from './cogsReserveService';
import { calculateSupplierLedgerBalance } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';
import { getSupplierById } from './supplierService';

export const SUPPLIER_PAYMENT_SCHEDULES_COLLECTION = 'supplier_payment_schedules';

export type SupplierPaymentScheduleStatus =
  | 'Draft'
  | 'Planned'
  | 'PendingApproval'
  | 'Approved'
  | 'PartiallyPaid'
  | 'Paid'
  | 'Deferred'
  | 'Cancelled';

export type SupplierPaymentPriority = 'Critical' | 'High' | 'Normal' | 'Low';

export interface SupplierPaymentScheduleRecord {
  scheduleId: string;
  vendorId: string;
  supplierId: string;
  supplierName: string;
  dueDate: string;
  scheduledDate: string;
  scheduledAmount: number;
  priority: SupplierPaymentPriority;
  fundingSource: string;
  status: SupplierPaymentScheduleStatus;
  notes: string;
  warnings: string[];
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function readSchedules(vendorId: string): SupplierPaymentScheduleRecord[] {
  return readVendorScopedList<SupplierPaymentScheduleRecord>(SUPPLIER_PAYMENT_SCHEDULES_COLLECTION, [], vendorId);
}

function writeSchedules(vendorId: string, rows: SupplierPaymentScheduleRecord[]): SupplierPaymentScheduleRecord[] {
  return writeVendorScopedList(SUPPLIER_PAYMENT_SCHEDULES_COLLECTION, rows, vendorId);
}

function scheduleIdFor(vendorId: string, supplierId: string, scheduledDate: string, amount: number): string {
  return cleanId(`${vendorId}_${supplierId}_SCHEDULE_${scheduledDate}_${amount}`);
}

export function getSupplierPaymentSchedules(vendorId: string, supplierId?: string): SupplierPaymentScheduleRecord[] {
  return readSchedules(vendorId)
    .filter((schedule) => !supplierId || schedule.supplierId === supplierId)
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
}

export async function createSupplierPaymentSchedule(input: {
  supplierId: string;
  dueDate: string;
  scheduledDate: string;
  scheduledAmount: number;
  priority?: SupplierPaymentPriority;
  fundingSource?: string;
  status?: SupplierPaymentScheduleStatus;
  notes?: string;
}, session?: PosSession | CanonicalSupplierContext | null): Promise<SupplierPaymentScheduleRecord> {
  const context = assertCanonicalSupplierContext(session);
  const amount = roundMoney(input.scheduledAmount);
  if (amount <= 0) throw new Error('Scheduled amount must be above zero.');
  const supplier = getSupplierById(input.supplierId, context);
  if (!supplier) throw new Error('Supplier record was not found.');
  if (supplier.vendorId !== context.vendorId) throw new Error('Supplier belongs to another vendor.');
  const outstanding = calculateSupplierLedgerBalance(context.vendorId, input.supplierId);
  if (amount > outstanding) throw new Error('Payment schedule cannot exceed outstanding supplier balance.');

  const reserve = getCOGSReserveSummary();
  const warnings: string[] = [];
  if (amount > reserve.currentReserveBalance) warnings.push('Payment exceeds available COGS reserve.');
  if (input.scheduledDate > input.dueDate) warnings.push('Supplier payment will be overdue on scheduled date.');
  if (supplier.preferred || input.priority === 'Critical') warnings.push('Supplier is critical to operations.');
  if (reserve.reserveStatus === 'Critical' || reserve.reserveStatus === 'Low') warnings.push('Payment may reduce stock replacement capacity.');

  const createdAt = nowIso();
  const schedule: SupplierPaymentScheduleRecord = {
    scheduleId: scheduleIdFor(context.vendorId, input.supplierId, input.scheduledDate, amount),
    vendorId: context.vendorId,
    supplierId: input.supplierId,
    supplierName: supplier.supplierName,
    dueDate: input.dueDate,
    scheduledDate: input.scheduledDate,
    scheduledAmount: amount,
    priority: input.priority || (warnings.length > 0 ? 'High' : 'Normal'),
    fundingSource: input.fundingSource || 'COGSReserve',
    status: input.status || (amount > 1000 || warnings.length > 0 ? 'PendingApproval' : 'Planned'),
    notes: input.notes || '',
    warnings,
    createdBy: context.staffId,
    createdAt,
    updatedAt: createdAt
  };
  writeSchedules(context.vendorId, [schedule, ...readSchedules(context.vendorId).filter((row) => row.scheduleId !== schedule.scheduleId)]);
  return schedule;
}

export function updateSupplierPaymentScheduleStatus(input: {
  scheduleId: string;
  status: SupplierPaymentScheduleStatus;
  notes?: string;
  approvedBy?: string;
}, session?: PosSession | CanonicalSupplierContext | null): SupplierPaymentScheduleRecord | null {
  const context = assertCanonicalSupplierContext(session);
  const rows = readSchedules(context.vendorId);
  let updated: SupplierPaymentScheduleRecord | null = null;
  writeSchedules(context.vendorId, rows.map((schedule) => {
    if (schedule.scheduleId !== input.scheduleId) return schedule;
    updated = {
      ...schedule,
      status: input.status,
      notes: [schedule.notes, input.notes].filter(Boolean).join(' '),
      approvedBy: input.approvedBy || schedule.approvedBy,
      updatedAt: nowIso()
    };
    return updated;
  }));
  return updated;
}
