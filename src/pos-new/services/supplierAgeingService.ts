import type { PosSession } from '../types';
import { getOpenSupplierCreditEntries } from './supplierAccountService';
import { assertCanonicalSupplierContext, type CanonicalSupplierContext } from './supplierContextService';

export interface SupplierAgeingBreakdown {
  supplierId: string;
  totalOutstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  oldestDueDate?: string;
  overdueDays: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function daysBetween(left: string, right: string): number {
  const start = new Date(left.slice(0, 10));
  const end = new Date(right.slice(0, 10));
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

function riskLevel(overdueDays: number, totalOutstanding: number): SupplierAgeingBreakdown['riskLevel'] {
  if (overdueDays > 90 || totalOutstanding >= 5000) return 'Critical';
  if (overdueDays > 60 || totalOutstanding >= 2500) return 'High';
  if (overdueDays > 30 || totalOutstanding > 0) return 'Medium';
  return 'Low';
}

export function calculateSupplierAgeing(
  supplierId: string,
  asOfDate = new Date().toISOString(),
  session?: PosSession | CanonicalSupplierContext | null
): SupplierAgeingBreakdown {
  const context = assertCanonicalSupplierContext(session);
  const openEntries = getOpenSupplierCreditEntries(context.vendorId, supplierId);
  const result: SupplierAgeingBreakdown = {
    supplierId,
    totalOutstanding: 0,
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    over90: 0,
    oldestDueDate: undefined,
    overdueDays: 0,
    riskLevel: 'Low'
  };

  openEntries.forEach(({ entry, outstanding }) => {
    const dueDate = entry.dueDate || entry.transactionDate;
    const overdue = Math.max(0, daysBetween(dueDate, asOfDate));
    result.totalOutstanding = roundMoney(result.totalOutstanding + outstanding);
    if (!result.oldestDueDate || dueDate < result.oldestDueDate) result.oldestDueDate = dueDate;
    result.overdueDays = Math.max(result.overdueDays, overdue);
    if (overdue <= 0) result.current = roundMoney(result.current + outstanding);
    else if (overdue <= 30) result.days30 = roundMoney(result.days30 + outstanding);
    else if (overdue <= 60) result.days60 = roundMoney(result.days60 + outstanding);
    else if (overdue <= 90) result.days90 = roundMoney(result.days90 + outstanding);
    else result.over90 = roundMoney(result.over90 + outstanding);
  });

  result.riskLevel = riskLevel(result.overdueDays, result.totalOutstanding);
  return result;
}
