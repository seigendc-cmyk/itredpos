import { ReceiptLine, ReceiptTaxSummary, VATMode } from '../types/posTypes';
import {
  calculateDocumentTax,
  calculateLineTax,
  type VendorTaxSettings
} from '../services/vendorTaxSettingsService';

function settingsFromMode(vatMode: VATMode, vatRate: number): VendorTaxSettings {
  return {
    vendorId: '',
    vatEnabled: vatMode !== 'Not VAT Registered',
    vatRegistered: vatMode !== 'Not VAT Registered',
    vatNumber: '',
    defaultVatRate: vatMode === 'Not VAT Registered' ? 0 : vatRate,
    pricesIncludeVat: vatMode !== 'Exclusive',
    outputTaxAccountId: '',
    inputTaxAccountId: '',
    exemptTaxCode: 'EXEMPT',
    zeroRatedTaxCode: 'ZERO',
    updatedAt: '',
    updatedBy: ''
  };
}

export function calculateVATInclusive(grossAmount: number, vatRate = 0): { netAmount: number; vatAmount: number; grossAmount: number } {
  const line = calculateLineTax({ lineAmount: grossAmount }, settingsFromMode('Inclusive', vatRate));
  return {
    netAmount: line.netAmount,
    vatAmount: line.vatAmount,
    grossAmount
  };
}

export function calculateVATExclusive(netAmount: number, vatRate = 0): { netAmount: number; vatAmount: number; grossAmount: number } {
  const line = calculateLineTax({ lineAmount: netAmount }, settingsFromMode('Exclusive', vatRate));
  return {
    netAmount,
    vatAmount: line.vatAmount,
    grossAmount: line.total
  };
}

export function calculateReceiptTaxSummary(
  lines: ReceiptLine[],
  vatMode: VATMode,
  vatRate = 0
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

  const tax = calculateDocumentTax(
    lines.map((line) => ({ lineAmount: line.lineTotal })),
    settingsFromMode(vatMode, vatRate)
  );
  return {
    receiptNumber,
    vatMode,
    vatRate,
    taxableAmount: tax.taxableAmount,
    vatAmount: tax.vatAmount,
    nonTaxableAmount: tax.nonTaxableAmount,
    taxLabel: `VAT ${vatRate}% ${vatMode === 'Exclusive' ? 'exclusive' : 'inclusive'}`
  };
}

export function formatTaxAmount(amount: number): string {
  return `USD ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
