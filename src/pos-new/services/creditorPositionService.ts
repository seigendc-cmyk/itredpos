import type { PosSession } from '../types';
import { getCOGSReserveSummary } from './cogsReserveService';
import { calculateSupplierAgeing } from './supplierAgeingService';
import { calculateSupplierLedgerBalance } from './supplierAccountService';
import { getSupplierPaymentSchedules } from './supplierPaymentScheduleService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';
import { getSuppliers } from './supplierService';

export interface SupplierCreditorPosition {
  supplierId: string;
  supplierName: string;
  currentBalance: number;
  dueSoon: number;
  overdueBalance: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  nextDueDate?: string;
  availableCredit: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface VendorCreditorSummary {
  totalCreditors: number;
  dueToday: number;
  dueThisWeek: number;
  overdueTotal: number;
  scheduledPayments: number;
  availableCash: number;
  cogsReserve: number;
  creditorPressureLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function pressureLevel(input: Pick<VendorCreditorSummary, 'overdueTotal' | 'scheduledPayments' | 'availableCash' | 'cogsReserve'>): VendorCreditorSummary['creditorPressureLevel'] {
  if (input.overdueTotal > input.availableCash || input.cogsReserve < 0) return 'Critical';
  if (input.overdueTotal > 0 || input.scheduledPayments > input.cogsReserve) return 'High';
  if (input.scheduledPayments > input.cogsReserve * 0.5) return 'Medium';
  return 'Low';
}

export function getSupplierCreditorPositions(session?: PosSession | CanonicalSupplierContext | null): SupplierCreditorPosition[] {
  const context = assertCanonicalSupplierContext(session);
  return getSuppliers({}, context).map((supplier) => {
    const ageing = calculateSupplierAgeing(supplier.supplierId, undefined, context);
    const currentBalance = calculateSupplierLedgerBalance(context.vendorId, supplier.supplierId);
    const availableCredit = Math.max(0, supplier.creditLimit - currentBalance);
    return {
      supplierId: supplier.supplierId,
      supplierName: supplier.supplierName,
      currentBalance,
      dueSoon: ageing.current,
      overdueBalance: roundMoney(ageing.days30 + ageing.days60 + ageing.days90 + ageing.over90),
      current: ageing.current,
      days30: ageing.days30,
      days60: ageing.days60,
      days90: ageing.days90,
      over90: ageing.over90,
      nextDueDate: ageing.oldestDueDate,
      availableCredit,
      riskLevel: ageing.riskLevel
    };
  });
}

export function getVendorCreditorSummary(session?: PosSession | CanonicalSupplierContext | null): VendorCreditorSummary {
  const context = assertCanonicalSupplierContext(session);
  const positions = getSupplierCreditorPositions(context);
  const day = today();
  const week = addDays(day, 7);
  const schedules = getSupplierPaymentSchedules(context.vendorId).filter((schedule) => !['Paid', 'Cancelled'].includes(schedule.status));
  const reserve = getCOGSReserveSummary();
  const summary: VendorCreditorSummary = {
    totalCreditors: roundMoney(positions.reduce((sum, row) => sum + row.currentBalance, 0)),
    dueToday: roundMoney(positions.filter((row) => row.nextDueDate === day).reduce((sum, row) => sum + row.currentBalance, 0)),
    dueThisWeek: roundMoney(positions.filter((row) => row.nextDueDate && row.nextDueDate >= day && row.nextDueDate <= week).reduce((sum, row) => sum + row.currentBalance, 0)),
    overdueTotal: roundMoney(positions.reduce((sum, row) => sum + row.overdueBalance, 0)),
    scheduledPayments: roundMoney(schedules.reduce((sum, schedule) => sum + schedule.scheduledAmount, 0)),
    availableCash: reserve.currentReserveBalance,
    cogsReserve: reserve.currentReserveBalance
  } as VendorCreditorSummary;
  summary.creditorPressureLevel = pressureLevel(summary);
  return summary;
}
