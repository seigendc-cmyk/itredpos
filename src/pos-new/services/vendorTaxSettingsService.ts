import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseApp';

export type TaxTreatment = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT';

export interface VendorTaxSettings {
  vendorId: string;
  vatEnabled: boolean;
  vatRegistered: boolean;
  vatNumber: string;
  defaultVatRate: number;
  pricesIncludeVat: boolean;
  outputTaxAccountId: string;
  inputTaxAccountId: string;
  exemptTaxCode: string;
  zeroRatedTaxCode: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TaxLineInput {
  quantity?: number;
  unitPrice?: number;
  lineAmount?: number;
  discountAmount?: number;
  taxTreatment?: TaxTreatment;
  taxCode?: string;
  vatRate?: number;
}

export interface LineTaxResult {
  grossAmount: number;
  netAmount: number;
  taxableAmount: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  taxTreatment: TaxTreatment;
}

export interface DocumentTaxResult {
  subtotal: number;
  taxableAmount: number;
  vatAmount: number;
  total: number;
  nonTaxableAmount: number;
  lines: LineTaxResult[];
}

const SETTINGS_COLLECTION = 'vendor_settings';
const LOCAL_SETTINGS_KEY = 'sci_vendor_tax_settings';

export const DEFAULT_VENDOR_TAX_SETTINGS: VendorTaxSettings = {
  vendorId: '',
  vatEnabled: false,
  vatRegistered: false,
  vatNumber: '',
  defaultVatRate: 0,
  pricesIncludeVat: true,
  outputTaxAccountId: '',
  inputTaxAccountId: '',
  exemptTaxCode: 'EXEMPT',
  zeroRatedTaxCode: 'ZERO',
  updatedAt: '',
  updatedBy: ''
};

function roundMoney(value: number): number {
  return Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));
}

function normalizeRate(value: unknown): number {
  const rate = Number(value);
  return Number.isFinite(rate) ? Math.max(0, rate) : 0;
}

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function localKey(vendorId: string): string {
  return `${LOCAL_SETTINGS_KEY}_${vendorId || 'unassigned-vendor'}`;
}

function readCachedSettings(vendorId: string): VendorTaxSettings | null {
  if (!canUseLocalStorage()) return null;
  try {
    const raw = localStorage.getItem(localKey(vendorId));
    return raw ? normalizeSettings(vendorId, JSON.parse(raw) as Partial<VendorTaxSettings>) : null;
  } catch {
    return null;
  }
}

function writeCachedSettings(settings: VendorTaxSettings): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(localKey(settings.vendorId), JSON.stringify(settings));
  } catch {
    // Local cache is best-effort only.
  }
}

function normalizeSettings(vendorId: string, data: Partial<VendorTaxSettings>): VendorTaxSettings {
  const vatEnabled = Boolean(data.vatEnabled);
  return {
    ...DEFAULT_VENDOR_TAX_SETTINGS,
    ...data,
    vendorId,
    vatEnabled,
    vatRegistered: Boolean(data.vatRegistered),
    vatNumber: String(data.vatNumber || ''),
    defaultVatRate: vatEnabled ? normalizeRate(data.defaultVatRate) : 0,
    pricesIncludeVat: data.pricesIncludeVat !== false,
    outputTaxAccountId: String(data.outputTaxAccountId || ''),
    inputTaxAccountId: String(data.inputTaxAccountId || ''),
    exemptTaxCode: String(data.exemptTaxCode || DEFAULT_VENDOR_TAX_SETTINGS.exemptTaxCode),
    zeroRatedTaxCode: String(data.zeroRatedTaxCode || DEFAULT_VENDOR_TAX_SETTINGS.zeroRatedTaxCode),
    updatedAt: String(data.updatedAt || ''),
    updatedBy: String(data.updatedBy || '')
  };
}

export function getCachedVendorTaxSettings(vendorId: string): VendorTaxSettings {
  return readCachedSettings(vendorId) || { ...DEFAULT_VENDOR_TAX_SETTINGS, vendorId };
}

export async function getVendorTaxSettings(vendorId: string): Promise<VendorTaxSettings> {
  if (!vendorId) return { ...DEFAULT_VENDOR_TAX_SETTINGS };
  if (!db) return getCachedVendorTaxSettings(vendorId);

  try {
    const snap = await getDoc(doc(db, SETTINGS_COLLECTION, vendorId));
    const settings = normalizeSettings(vendorId, snap.exists() ? snap.data() as Partial<VendorTaxSettings> : {});
    writeCachedSettings(settings);
    return settings;
  } catch (error) {
    console.error('[vendorTaxSettingsService] Failed to load vendor tax settings', error);
    return getCachedVendorTaxSettings(vendorId);
  }
}

export async function saveVendorTaxSettings(
  vendorId: string,
  settings: Partial<VendorTaxSettings>
): Promise<VendorTaxSettings> {
  if (!vendorId) {
    throw new Error('Vendor session missing');
  }

  const now = new Date().toISOString();
  const normalized = normalizeSettings(vendorId, {
    ...settings,
    updatedAt: settings.updatedAt || now
  });
  writeCachedSettings(normalized);

  if (!db) return normalized;

  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, vendorId), normalized, { merge: true });
    return normalized;
  } catch (error) {
    console.error('[vendorTaxSettingsService] Failed to save vendor tax settings', error);
    throw error;
  }
}

function resolveTaxTreatment(line: TaxLineInput, settings: VendorTaxSettings): TaxTreatment {
  const code = String(line.taxCode || '').toUpperCase();
  if (line.taxTreatment) return line.taxTreatment;
  if (code && code === settings.exemptTaxCode.toUpperCase()) return 'EXEMPT';
  if (code && code === settings.zeroRatedTaxCode.toUpperCase()) return 'ZERO_RATED';
  return 'STANDARD';
}

export function calculateLineTax(
  line: TaxLineInput,
  settings: VendorTaxSettings
): LineTaxResult {
  const quantity = Number(line.quantity ?? 1) || 1;
  const grossBeforeDiscount = line.lineAmount ?? quantity * (Number(line.unitPrice) || 0);
  const grossAmount = roundMoney(Math.max(0, grossBeforeDiscount - Math.max(0, Number(line.discountAmount) || 0)));
  const taxTreatment = resolveTaxTreatment(line, settings);
  const vatEnabled = settings.vatEnabled && settings.vatRegistered;
  const vatRate = taxTreatment === 'STANDARD' && vatEnabled ? normalizeRate(line.vatRate ?? settings.defaultVatRate) : 0;

  if (!vatEnabled || taxTreatment === 'EXEMPT') {
    return {
      grossAmount,
      netAmount: grossAmount,
      taxableAmount: 0,
      vatAmount: 0,
      total: grossAmount,
      vatRate,
      taxTreatment
    };
  }

  if (taxTreatment === 'ZERO_RATED' || vatRate === 0) {
    return {
      grossAmount,
      netAmount: grossAmount,
      taxableAmount: grossAmount,
      vatAmount: 0,
      total: grossAmount,
      vatRate: 0,
      taxTreatment
    };
  }

  if (settings.pricesIncludeVat) {
    const netAmount = roundMoney(grossAmount / (1 + vatRate / 100));
    const vatAmount = roundMoney(grossAmount - netAmount);
    return {
      grossAmount,
      netAmount,
      taxableAmount: netAmount,
      vatAmount,
      total: grossAmount,
      vatRate,
      taxTreatment
    };
  }

  const vatAmount = roundMoney(grossAmount * (vatRate / 100));
  return {
    grossAmount,
    netAmount: grossAmount,
    taxableAmount: grossAmount,
    vatAmount,
    total: roundMoney(grossAmount + vatAmount),
    vatRate,
    taxTreatment
  };
}

export function calculateDocumentTax(
  lines: TaxLineInput[],
  settings: VendorTaxSettings
): DocumentTaxResult {
  const lineResults = lines.map((line) => calculateLineTax(line, settings));
  const subtotal = roundMoney(lineResults.reduce((sum, line) => sum + line.netAmount, 0));
  const taxableAmount = roundMoney(lineResults.reduce((sum, line) => sum + line.taxableAmount, 0));
  const vatAmount = roundMoney(lineResults.reduce((sum, line) => sum + line.vatAmount, 0));
  const total = roundMoney(lineResults.reduce((sum, line) => sum + line.total, 0));
  return {
    subtotal,
    taxableAmount,
    vatAmount,
    total,
    nonTaxableAmount: roundMoney(total - taxableAmount - vatAmount),
    lines: lineResults
  };
}

export function posTaxSettingToVendorTaxSettings(
  vendorId: string,
  input: { vatRatePct: number; surtaxPct?: number; inclusive: boolean },
  updatedBy = 'POS'
): VendorTaxSettings {
  const rate = normalizeRate(input.vatRatePct);
  return normalizeSettings(vendorId, {
    vendorId,
    vatEnabled: rate > 0,
    vatRegistered: rate > 0,
    defaultVatRate: rate,
    pricesIncludeVat: input.inclusive,
    updatedAt: new Date().toISOString(),
    updatedBy
  });
}

export function vendorTaxSettingsToPosTaxSetting(settings: VendorTaxSettings): { vatRatePct: number; surtaxPct: number; inclusive: boolean } {
  return {
    vatRatePct: settings.vatEnabled ? settings.defaultVatRate : 0,
    surtaxPct: 0,
    inclusive: settings.pricesIncludeVat
  };
}
