import { ReceiptLine, ReceiptTaxSummary, VATMode } from '../types/posTypes';

export function calculateVATInclusive(grossAmount: number, vatRate = 15): { netAmount: number; vatAmount: number; grossAmount: number } {
  const vatAmount = grossAmount - grossAmount / (1 + vatRate / 100);
  return {
    netAmount: grossAmount - vatAmount,
    vatAmount,
    grossAmount
  };
}

export function calculateVATExclusive(netAmount: number, vatRate = 15): { netAmount: number; vatAmount: number; grossAmount: number } {
  const vatAmount = netAmount * (vatRate / 100);
  return {
    netAmount,
    vatAmount,
    grossAmount: netAmount + vatAmount
  };
}

export function calculateReceiptTaxSummary(
  lines: ReceiptLine[],
  vatMode: VATMode,
  vatRate = 15
): ReceiptTaxSummary {
  const receiptNumber = lines[0]?.receiptNumber || 'DRAFT';
  const total = lines.reduce((sum, line) => sum + line.lineTotal, 0);

  if (vatMode === 'Not VAT Registered') {
    return {
      receiptNumber,
      vatMode,
      vatRate: 0,
      taxableAmount: 0,
      vatAmount: 0,
      nonTaxableAmount: total,
      taxLabel: 'VAT not charged'
    };
  }

  if (vatMode === 'Exclusive') {
    const tax = calculateVATExclusive(total, vatRate);
    return {
      receiptNumber,
      vatMode,
      vatRate,
      taxableAmount: tax.netAmount,
      vatAmount: tax.vatAmount,
      nonTaxableAmount: 0,
      taxLabel: `VAT ${vatRate}% exclusive`
    };
  }

  const tax = calculateVATInclusive(total, vatRate);
  return {
    receiptNumber,
    vatMode,
    vatRate,
    taxableAmount: tax.netAmount,
    vatAmount: tax.vatAmount,
    nonTaxableAmount: 0,
    taxLabel: `VAT ${vatRate}% inclusive`
  };
}

export function formatTaxAmount(amount: number): string {
  return `USD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
