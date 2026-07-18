import {
  FiscalizationPlaceholderRecord,
  FiscalizationStatus,
  PaymentMode,
  ReceiptAuditEvent,
  ReceiptAuditEventType,
  ReceiptFormat,
  ReceiptLine,
  ReceiptPaymentLine,
  ReceiptPrintPreview,
  ReceiptRecord,
  ReceiptSetting,
  ReceiptSequenceControl,
  ReceiptStatus,
  Sale,
  VATMode,
} from "../types/posTypes";
import {
  mockFiscalizationPlaceholderRecords,
  mockReceiptAuditEvents,
  mockReceiptLines,
  mockReceiptPayments,
  mockReceiptRecords,
  mockReceiptReprintAudits,
  mockReceiptSequenceControls,
} from "../mock/mockPosData";
import { calculateReceiptTaxSummary } from "../utils/taxUtils";
import {
  calculateLineTax,
  getCachedVendorTaxSettings,
  type VendorTaxSettings
} from "./vendorTaxSettingsService";
import {
  getVendorDocumentIdentity,
  isVendorDocumentPlaceholder,
  type VendorDocumentIdentity
} from "../vendor/vendorBootstrapModel";
import { getActiveVendorId, readVendorScopedList, seedRows, writeVendorScopedList } from "../utils/vendorDataMode";

export interface ReceiptFilters {
  vendorId?: string;
  branch?: string;
  terminal?: string;
  cashier?: string;
  customer?: string;
  receiptNumber?: string;
  paymentMode?: PaymentMode | "All";
  receiptStatus?: ReceiptStatus | "All";
  fiscalizationStatus?: FiscalizationStatus | "All";
  dateFrom?: string;
  dateTo?: string;
}

export interface ReceiptSalePayload {
  sale: Sale;
  receiptNumber?: string;
  vendorId: string;
  businessVendor: string;
  branchId: string;
  branch: string;
  terminalId: string;
  terminal: string;
  cashierId: string;
  cashier: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerWhatsApp?: string;
  customerTaxNumber?: string;
  customerBillingAddress?: string;
  customerDeliveryAddress?: string;
  customerCreditStatus?: ReceiptRecord["customer"]["creditStatus"];
  paymentMode: PaymentMode;
  paymentLines?: Array<{ method: string; amount: number; reference?: string }>;
  creditDetails?: ReceiptRecord["creditDetails"];
  vatMode?: VATMode;
  vatRate?: number;
}

const RECEIPTS_KEY = "itred_pos_receipts_v1";
const LINES_KEY = "itred_pos_receipt_lines_v1";
const PAYMENTS_KEY = "itred_pos_receipt_payments_v1";
const SEQUENCE_KEY = "itred_pos_receipt_sequence_v1";
const FISCAL_KEY = "itred_pos_fiscal_placeholder_v1";
const AUDIT_KEY = "itred_pos_receipt_audit_v1";
const RECEIPT_SETTING_KEY = "itred_pos_receipt_setting";

const DEFAULT_RECEIPT_BLUEPRINT: ReceiptSetting = {
  header: "iTred Commerce POS",
  footer: "Thank you for shopping with us.",
  slipWidth: "32_COLUMNS (STANDARD_SLIP)",
  showTaxBreakdown: true,
  layout: "Thermal Receipt Roll",
  headerMessage: "",
  footerMessage: "Thank you for shopping with us.",
  termsAndConditions:
    "Goods may be returned according to store policy with a valid receipt.",
  businessAddress: "",
  contactNumbers: "",
  emailAddress: "",
  socialMediaHandles: "",
  contactInformation: "",
  socialMediaInformation: "",
};

function readList<T>(key: string, fallback: T[]): T[] {
  return readVendorScopedList<T>(key, fallback);
}

function saveList<T>(key: string, value: T[]): T[] {
  return writeVendorScopedList(key, value);
}

function extractReceiptOrdinal(receiptNumber?: string): number {
  const value = Number(receiptNumber?.replace(/\D/g, ""));
  return Number.isFinite(value) ? value : 0;
}

function formatSequenceReceiptNumber(prefix: string, value: number): string {
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

export function getActiveReceiptBlueprint(): ReceiptSetting {
  const identity = getVendorDocumentIdentity();
  const vendorBlueprint = createVendorReceiptBlueprint(identity);
  try {
    const raw = localStorage.getItem(RECEIPT_SETTING_KEY);
    const stored: Partial<ReceiptSetting> = raw
      ? (JSON.parse(raw) as ReceiptSetting)
      : {};
    const header = vendorText(stored.header, vendorBlueprint.header);
    const headerMessage = vendorText(stored.headerMessage || stored.header, vendorBlueprint.headerMessage || header);
    const footerMessage = vendorText(stored.footerMessage || stored.footer, vendorBlueprint.footerMessage || DEFAULT_RECEIPT_BLUEPRINT.footerMessage);
    const businessAddress = vendorText(stored.businessAddress, vendorBlueprint.businessAddress || identity.addressLine);
    const contactNumbers = vendorText(stored.contactNumbers || stored.contactInformation, vendorBlueprint.contactNumbers || vendorBlueprint.contactInformation);
    const emailAddress = vendorText(stored.emailAddress, vendorBlueprint.emailAddress);
    const socialMediaHandles = vendorText(stored.socialMediaHandles || stored.socialMediaInformation, vendorBlueprint.socialMediaHandles || vendorBlueprint.socialMediaInformation);
    return {
      ...vendorBlueprint,
      ...stored,
      header,
      footer: footerMessage,
      headerMessage,
      footerMessage,
      businessAddress,
      contactNumbers,
      emailAddress,
      socialMediaHandles,
      contactInformation: contactNumbers,
      socialMediaInformation: socialMediaHandles,
      layout: stored.layout || "Thermal Receipt Roll",
    };
  } catch {
    return vendorBlueprint;
  }
}

function vendorText(value: unknown, fallback = ""): string {
  const text = String(value || "").trim();
  return text && !isVendorDocumentPlaceholder(text) ? text : fallback;
}

function joinReceiptLines(...values: string[]): string {
  return values.filter(Boolean).join(" | ");
}

function createVendorReceiptBlueprint(identity: VendorDocumentIdentity): ReceiptSetting {
  const businessAddress = [identity.addressLine, identity.cityLine].filter(Boolean).join(", ");
  const contactNumbers = joinReceiptLines(identity.phoneLine, identity.whatsappLine);
  const descriptor = [identity.businessType, identity.industry].filter(Boolean).join(" / ");
  return {
    ...DEFAULT_RECEIPT_BLUEPRINT,
    header: identity.displayName || DEFAULT_RECEIPT_BLUEPRINT.header,
    footer: DEFAULT_RECEIPT_BLUEPRINT.footer,
    headerMessage: descriptor,
    footerMessage: DEFAULT_RECEIPT_BLUEPRINT.footerMessage,
    businessAddress,
    contactNumbers,
    emailAddress: identity.email || "",
    socialMediaHandles: "",
    contactInformation: contactNumbers,
    socialMediaInformation: "",
    layout: "Thermal Receipt Roll",
  };
}

function createReceiptBusinessDetails(
  payload: Pick<ReceiptSalePayload, "vendorId" | "businessVendor" | "branchId" | "branch" | "terminalId" | "terminal">,
  blueprint: ReceiptSetting,
): ReceiptRecord["businessDetails"] {
  const identity = getVendorDocumentIdentity({
    vendorId: payload.vendorId,
    branchId: payload.branchId,
    branchName: payload.branch,
    terminalId: payload.terminalId,
    terminalName: payload.terminal,
    displayName: payload.businessVendor,
  });
  const businessAddress = [identity.addressLine, identity.cityLine].filter(Boolean).join(", ");
  const contactNumbers = joinReceiptLines(identity.phoneLine, identity.whatsappLine);
  return {
    businessName: identity.displayName || payload.businessVendor,
    legalName: identity.legalName,
    tradingName: identity.tradingName || identity.displayName || payload.businessVendor,
    vendorId: identity.vendorId || payload.vendorId,
    branch: identity.branchName || payload.branch,
    address: businessAddress || identity.branchAddress,
    businessType: identity.businessType,
    industry: identity.industry,
    cityLine: identity.cityLine,
    phone: identity.phone || identity.branchPhone || "",
    whatsApp: identity.whatsapp || identity.branchWhatsapp || "",
    email: identity.email,
    vatNumber: identity.vatNumber,
    vatRegistered: Boolean(identity.vatNumber),
    taxNumber: identity.taxNumber,
    registrationNumber: identity.registrationNumber,
    taxLine: identity.taxLine,
    registrationLine: identity.registrationLine,
    branchAddress: identity.branchAddress,
    branchPhone: identity.branchPhone,
    branchWhatsapp: identity.branchWhatsapp,
    branchEmail: identity.branchEmail,
    warehouseName: identity.warehouseName,
    warehouseAddress: identity.warehouseAddress,
    warehousePhone: identity.warehousePhone,
    warehouseWhatsapp: identity.warehouseWhatsapp,
    warehouseEmail: identity.warehouseEmail,
    terminalName: identity.terminalName || payload.terminal,
    footerMessage: blueprint.footerMessage || blueprint.footer,
    logoDataUrl: blueprint.logoDataUrl,
    headerMessage: blueprint.headerMessage || blueprint.header,
    termsAndConditions: blueprint.termsAndConditions,
    businessAddress: businessAddress || identity.branchAddress,
    contactNumbers,
    emailAddress: identity.email || blueprint.emailAddress,
    socialMediaHandles: blueprint.socialMediaHandles,
    contactInformation: contactNumbers,
    socialMediaInformation: blueprint.socialMediaInformation,
    receiptLayout: blueprint.layout || "Thermal Receipt Roll",
  };
}

function enrichReceiptDocumentIdentity(receipt: ReceiptRecord): ReceiptRecord {
  const blueprint = getActiveReceiptBlueprint();
  return {
    ...receipt,
    businessDetails: {
      ...receipt.businessDetails,
      ...createReceiptBusinessDetails({
        vendorId: receipt.vendorId,
        businessVendor: receipt.businessVendor,
        branchId: receipt.branchId,
        branch: receipt.branch,
        terminalId: receipt.terminalId,
        terminal: receipt.terminal,
      }, blueprint),
      logoDataUrl: receipt.businessDetails.logoDataUrl || blueprint.logoDataUrl,
      footerMessage: receipt.businessDetails.footerMessage || blueprint.footerMessage || blueprint.footer,
      termsAndConditions: receipt.businessDetails.termsAndConditions || blueprint.termsAndConditions,
      receiptLayout: receipt.businessDetails.receiptLayout || blueprint.layout,
    }
  };
}

function addAudit(
  eventType: ReceiptAuditEventType,
  receiptNumber: string,
  message: string,
  operator = "Admin User",
  idempotencyId?: string,
): ReceiptAuditEvent[] {
  const current = readList<ReceiptAuditEvent>(
    AUDIT_KEY,
    mockReceiptAuditEvents,
  );
  if (idempotencyId && current.some((event) => event.id === idempotencyId)) return current;
  const next: ReceiptAuditEvent = {
    id: idempotencyId || `RAE-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: new Date().toISOString(),
    eventType,
    receiptNumber,
    message,
    operator,
  };
  return saveList(AUDIT_KEY, [next, ...current].slice(0, 60));
}

function branchMatch(rowBranch: string, branch?: string): boolean {
  return !branch || branch === "All Branches" || rowBranch === branch;
}

function terminalMatch(rowTerminal: string, terminal?: string): boolean {
  return !terminal || terminal === "All Terminals" || rowTerminal === terminal;
}

function cashierMatch(rowCashier: string, cashier?: string): boolean {
  return !cashier || cashier === "All Staff" || rowCashier === cashier;
}

function normalizePaymentMode(method: string): PaymentMode {
  if (method === "Credit / Account") return "Credit Sale";
  if (method === "Mixed Payment") return "Split Payment";
  if (method === "Card" || method === "CARD") return "Swipe";
  if (method === "Already Paid" || method === "No Payment Due") return "Cash";
  if (method === "Innbucks" || method === "Mukuru" || method === "ZIPIT")
    return "Bank Transfer";
  if (method === "EcoCash") return "EcoCash";
  if (method === "Bank Transfer") return "Bank Transfer";
  return "Cash";
}

function taxSettingsFromSalePayload(payload: ReceiptSalePayload): VendorTaxSettings {
  return {
    vendorId: payload.vendorId,
    vatEnabled: payload.vatMode !== "Not VAT Registered",
    vatRegistered: payload.vatMode !== "Not VAT Registered",
    vatNumber: "",
    defaultVatRate: payload.vatMode === "Not VAT Registered" ? 0 : Number(payload.vatRate) || 0,
    pricesIncludeVat: payload.vatMode !== "Exclusive",
    outputTaxAccountId: "",
    inputTaxAccountId: "",
    exemptTaxCode: "EXEMPT",
    zeroRatedTaxCode: "ZERO",
    updatedAt: "",
    updatedBy: ""
  };
}

export async function getReceipts(
  filters: ReceiptFilters,
): Promise<ReceiptRecord[]> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).filter(
    (receipt) =>
      branchMatch(receipt.branch, filters.branch) &&
      terminalMatch(receipt.terminal, filters.terminal) &&
      cashierMatch(receipt.cashier, filters.cashier) &&
      (!filters.customer ||
        receipt.customer.customerName
          .toLowerCase()
          .includes(filters.customer.toLowerCase())) &&
      (!filters.receiptNumber ||
        receipt.receiptNumber
          .toLowerCase()
          .includes(filters.receiptNumber.toLowerCase())) &&
      (!filters.paymentMode ||
        filters.paymentMode === "All" ||
        receipt.paymentMode === filters.paymentMode) &&
      (!filters.receiptStatus ||
        filters.receiptStatus === "All" ||
        receipt.status === filters.receiptStatus) &&
      (!filters.fiscalizationStatus ||
        filters.fiscalizationStatus === "All" ||
        receipt.fiscalizationStatus === filters.fiscalizationStatus),
  );
}

export async function getReceiptByNumber(
  receiptNumber: string,
): Promise<ReceiptRecord | undefined> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).find(
    (receipt) => receipt.receiptNumber === receiptNumber,
  );
}

export async function generateReceiptNumber(
  branchId: string,
  terminalId: string,
): Promise<string> {
  const sequenceRows = readList<ReceiptSequenceControl>(
    SEQUENCE_KEY,
    mockReceiptSequenceControls,
  );
  const sequenceIndex = sequenceRows.findIndex(
    (row) => row.terminal === terminalId,
  );
  const sequence = sequenceRows[sequenceIndex] || sequenceRows[0];
  const prefix = sequence?.prefix || "RCT";
  const existingReceiptNumbers = new Set(
    readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map(
      (receipt) => receipt.receiptNumber,
    ),
  );
  const highestExistingNumber = Math.max(
    0,
    ...Array.from(existingReceiptNumbers).map(extractReceiptOrdinal),
  );
  let nextNumber =
    extractReceiptOrdinal(sequence?.nextReceiptNo) || highestExistingNumber + 1;
  let receiptNumber = formatSequenceReceiptNumber(prefix, nextNumber);

  while (existingReceiptNumbers.has(receiptNumber)) {
    nextNumber += 1;
    receiptNumber = formatSequenceReceiptNumber(prefix, nextNumber);
  }

  const nextReceiptNo = formatSequenceReceiptNumber(prefix, nextNumber + 1);

  const updatedSequence = {
    ...(sequence || {}),
    id: sequence?.id || `SEQ-${terminalId}`,
    vendorId: sequence?.vendorId || getActiveVendorId(),
    businessVendor: sequence?.businessVendor || "iTred Commerce POS",
    branch: sequence?.branch || branchId,
    terminal: sequence?.terminal || terminalId,
    prefix,
    lastReceiptNo: receiptNumber,
    nextReceiptNo,
    duplicateRisk: "Low",
    sequenceStatus: "Healthy",
    gapCount: sequence?.gapCount ?? 0,
    lastChecked: new Date().toISOString(),
  } as ReceiptSequenceControl;

  const updatedRows =
    sequenceIndex >= 0
      ? sequenceRows.map((row, index) =>
          index === sequenceIndex ? updatedSequence : row,
        )
      : [updatedSequence, ...sequenceRows];

  saveList(SEQUENCE_KEY, updatedRows);

  return receiptNumber;
}

export function formatReceiptNumber(value?: number): string {
  return `RCT-${String(value || Date.now() % 10000).padStart(4, "0")}`;
}

export function formatReceiptCurrency(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

export async function createReceiptFromSale(
  payload: ReceiptSalePayload,
): Promise<ReceiptRecord> {
  const blueprint = getActiveReceiptBlueprint();
  const receiptNumber = payload.receiptNumber || await generateReceiptNumber(payload.branchId, payload.terminalId);
  const now = payload.sale.date || new Date().toISOString();
  const taxSettings = taxSettingsFromSalePayload(payload);
  const lines: ReceiptLine[] = payload.sale.items.map((item, index) => {
    const tax = calculateLineTax({ lineAmount: item.total }, taxSettings);
    return {
      id: `RL-${receiptNumber}-${index + 1}`,
      receiptNumber,
      productId: item.productId,
      sku: item.code,
      productName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      discountAmount: 0,
      lineNetAmount: tax.netAmount,
      vatAmount: tax.vatAmount,
      lineTotal: tax.total,
    };
  });
  const taxSummary = calculateReceiptTaxSummary(
    lines,
    payload.vatMode || "Inclusive",
    payload.vatRate || 0,
  );
  const receipt: ReceiptRecord = {
    id: `REC-${receiptNumber}`,
    receiptNumber,
    vendorId: payload.vendorId,
    businessVendor: payload.businessVendor,
    branchId: payload.branchId,
    branch: payload.branch,
    terminalId: payload.terminalId,
    terminal: payload.terminal,
    cashierId: payload.cashierId,
    cashier: payload.cashier,
    businessDate: now.slice(0, 10),
    dateTime: now,
    customer: {
      customerId: payload.customerId,
      customerName: payload.customerName || "Walk-in Customer",
      customerPhone: payload.customerPhone,
      customerWhatsApp: payload.customerWhatsApp,
      customerTaxNo: payload.customerTaxNumber,
      customerAddress:
        payload.customerDeliveryAddress || payload.customerBillingAddress,
      billingAddress: payload.customerBillingAddress,
      deliveryAddress: payload.customerDeliveryAddress,
      creditStatus: payload.customerCreditStatus,
    },
    businessDetails: createReceiptBusinessDetails(payload, blueprint),
    subtotal: payload.sale.subtotal,
    discountTotal: payload.sale.discount,
    vatTotal: taxSummary.vatAmount,
    grandTotal: payload.sale.total,
    paymentMode: payload.paymentMode,
    creditDetails: payload.creditDetails,
    status: "Completed",
    fiscalizationStatus: "Disabled In Development",
    fiscalReferencePlaceholder: `FISC-DEV-${receiptNumber}`,
    reprintCount: 0,
    offlineQueued: false,
    createdByStaffId: payload.cashierId,
    createdAt: now,
    updatedAt: now,
  };

  const currentReceipts = readList<ReceiptRecord>(
    RECEIPTS_KEY,
    mockReceiptRecords,
  ).filter((currentReceipt) => currentReceipt.receiptNumber !== receiptNumber);
  saveList(RECEIPTS_KEY, [
    receipt,
    ...currentReceipts,
  ]);
  const currentLines = readList<ReceiptLine>(LINES_KEY, mockReceiptLines).filter(
    (line) => line.receiptNumber !== receiptNumber,
  );
  saveList(LINES_KEY, [
    ...lines,
    ...currentLines,
  ]);
  const paymentRows: ReceiptPaymentLine[] = (
    payload.paymentLines && payload.paymentLines.length > 0
      ? payload.paymentLines
      : [
          {
            method: payload.paymentMode,
            amount: payload.sale.total,
            reference: `${payload.paymentMode}-${payload.terminal}`,
          },
        ]
  ).map((payment, index) => ({
    id: `RP-${receiptNumber}-${index + 1}`,
    receiptNumber,
    paymentMode: normalizePaymentMode(payment.method),
    amount: payment.amount,
    reference: payment.reference,
    confirmed: true,
  }));
  const currentPayments = readList<ReceiptPaymentLine>(
    PAYMENTS_KEY,
    mockReceiptPayments,
  ).filter((payment) => payment.receiptNumber !== receiptNumber);
  saveList(PAYMENTS_KEY, [
    ...paymentRows,
    ...currentPayments,
  ]);
  addAudit(
    "RECEIPT_CREATED",
    receiptNumber,
    `Receipt ${receiptNumber} created from completed sale.`,
    payload.cashier,
    `RAE-CREATED-${receiptNumber}`,
  );
  return receipt;
}

export async function generateReceiptFromCompletedSale(
  sale: Sale,
): Promise<ReceiptRecord> {
  const identity = getVendorDocumentIdentity({
    terminalId: sale.terminal || "TERM-MAIN-001",
    terminalName: sale.terminal || "POS-01",
  });
  return createReceiptFromSale({
    sale,
    vendorId: identity.vendorId || "local-vendor",
    businessVendor: identity.displayName,
    branchId: identity.branchId || "main-branch",
    branch: identity.branchName,
    terminalId: identity.terminalId || sale.terminal || "TERM-MAIN-001",
    terminal: identity.terminalName || sale.terminal || "Main POS Terminal",
    cashierId: sale.operator,
    cashier: sale.operator,
    customerName: sale.customerName,
    paymentMode:
      sale.paymentMethod === "CASH"
        ? "Cash"
        : sale.paymentMethod === "SPLIT"
          ? "Split Payment"
          : "Swipe",
  });
}

export async function getLastReceipt(): Promise<ReceiptRecord | undefined> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords)[0];
}

export async function getRecentReceipts(): Promise<ReceiptRecord[]> {
  return readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).slice(0, 10);
}

export function prepareReceiptPrintPayload(
  receipt: ReceiptRecord,
): ReceiptRecord {
  addAudit(
    "RECEIPT_PRINT_STARTED",
    receipt.receiptNumber,
    `Receipt ${receipt.receiptNumber} print started.`,
    receipt.cashier,
  );
  return enrichReceiptDocumentIdentity(receipt);
}

export function prepareReceiptPdfPrintPayload(
  receipt: ReceiptRecord,
): ReceiptRecord {
  addAudit(
    "RECEIPT_PDF_PREPARED",
    receipt.receiptNumber,
    `Receipt ${receipt.receiptNumber} PDF print path prepared.`,
    receipt.cashier,
  );
  return enrichReceiptDocumentIdentity(receipt);
}

export function prepareReceiptWhatsAppMessage(
  receipt: ReceiptRecord,
  phone: string,
): string {
  addAudit(
    "RECEIPT_WHATSAPP_SHARE_PREPARED",
    receipt.receiptNumber,
    `Receipt ${receipt.receiptNumber} WhatsApp share prepared for ${phone}.`,
    receipt.cashier,
  );
  const enrichedReceipt = enrichReceiptDocumentIdentity(receipt);
  const status =
    enrichedReceipt.status === "Completed" ? "Paid/Completed" : enrichedReceipt.status;
  const contact =
    enrichedReceipt.businessDetails.contactNumbers ||
    enrichedReceipt.businessDetails.contactInformation;
  const email = enrichedReceipt.businessDetails.emailAddress;
  return [
    enrichedReceipt.businessDetails.footerMessage ||
      `Thank you for shopping with ${enrichedReceipt.businessDetails.businessName}.`,
    `Receipt ${enrichedReceipt.receiptNumber}, ${new Date(enrichedReceipt.dateTime).toLocaleDateString()}.`,
    `Total ${formatReceiptCurrency(enrichedReceipt.grandTotal)}.`,
    enrichedReceipt.creditDetails
      ? `Balance due ${formatReceiptCurrency(enrichedReceipt.creditDetails.balanceDue)} by ${new Date(enrichedReceipt.creditDetails.dueDate).toLocaleDateString()}.`
      : "",
    enrichedReceipt.creditDetails ? "Please settle your account by the due date." : "",
    `Payment status: ${status}.`,
    enrichedReceipt.customer.deliveryAddress
      ? `Delivery: ${enrichedReceipt.customer.deliveryAddress}.`
      : "",
    enrichedReceipt.businessDetails.termsAndConditions ||
      "Please keep this message for your records.",
    contact ? `Contact: ${contact}.` : "",
    email ? `Email: ${email}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function getReceiptActivityEvents(): Promise<ReceiptAuditEvent[]> {
  return getReceiptAuditEvents();
}

export async function getReceiptPreview(
  receiptNumber: string,
  format: ReceiptFormat,
): Promise<ReceiptPrintPreview | undefined> {
  const receipt = await getReceiptByNumber(receiptNumber);
  if (!receipt) return undefined;
  const enrichedReceipt = enrichReceiptDocumentIdentity(receipt);
  const lines = readList<ReceiptLine>(LINES_KEY, mockReceiptLines).filter(
    (line) => line.receiptNumber === receiptNumber,
  );
  const payments = readList<ReceiptPaymentLine>(
    PAYMENTS_KEY,
    mockReceiptPayments,
  ).filter((payment) => payment.receiptNumber === receiptNumber);
  const taxSettings = getCachedVendorTaxSettings(enrichedReceipt.vendorId);
  return {
    receipt: enrichedReceipt,
    lines,
    payments,
    taxSummary: calculateReceiptTaxSummary(
      lines,
      enrichedReceipt.businessDetails.vatRegistered
        ? (taxSettings.pricesIncludeVat ? "Inclusive" : "Exclusive")
        : "Not VAT Registered",
      taxSettings.defaultVatRate,
    ),
    format: enrichedReceipt.businessDetails.receiptLayout || format,
    blueprint: {
      ...getActiveReceiptBlueprint(),
      logoDataUrl:
        enrichedReceipt.businessDetails.logoDataUrl ||
        getActiveReceiptBlueprint().logoDataUrl,
      headerMessage:
        enrichedReceipt.businessDetails.headerMessage ||
        getActiveReceiptBlueprint().headerMessage,
      footerMessage:
        enrichedReceipt.businessDetails.footerMessage ||
        getActiveReceiptBlueprint().footerMessage,
      termsAndConditions:
        enrichedReceipt.businessDetails.termsAndConditions ||
        getActiveReceiptBlueprint().termsAndConditions,
      businessAddress:
        enrichedReceipt.businessDetails.businessAddress ||
        enrichedReceipt.businessDetails.address ||
        getActiveReceiptBlueprint().businessAddress,
      contactNumbers:
        enrichedReceipt.businessDetails.contactNumbers ||
        getActiveReceiptBlueprint().contactNumbers,
      emailAddress:
        enrichedReceipt.businessDetails.emailAddress ||
        getActiveReceiptBlueprint().emailAddress,
      socialMediaHandles:
        enrichedReceipt.businessDetails.socialMediaHandles ||
        getActiveReceiptBlueprint().socialMediaHandles,
      contactInformation:
        enrichedReceipt.businessDetails.contactInformation ||
        enrichedReceipt.businessDetails.contactNumbers ||
        getActiveReceiptBlueprint().contactInformation,
      socialMediaInformation:
        enrichedReceipt.businessDetails.socialMediaInformation ||
        enrichedReceipt.businessDetails.socialMediaHandles ||
        getActiveReceiptBlueprint().socialMediaInformation,
      layout:
        enrichedReceipt.businessDetails.receiptLayout ||
        getActiveReceiptBlueprint().layout,
    },
    isReprint: enrichedReceipt.reprintCount > 0 || enrichedReceipt.status === "Reprinted",
  };
}

export async function reprintReceiptPlaceholder(
  receiptNumber: string,
  staffId: string,
  reason: string,
): Promise<ReceiptAuditEvent[]> {
  const receipts = readList<ReceiptRecord>(
    RECEIPTS_KEY,
    mockReceiptRecords,
  ).map((receipt) =>
    receipt.receiptNumber === receiptNumber
      ? {
          ...receipt,
          status: "Reprinted" as const,
          reprintCount: receipt.reprintCount + 1,
          updatedAt: new Date().toISOString(),
        }
      : receipt,
  );
  saveList(RECEIPTS_KEY, receipts);
  return addAudit(
    "RECEIPT_REPRINTED",
    receiptNumber,
    `Receipt reprint placeholder recorded: ${reason}`,
    staffId,
  );
}

export async function voidReceiptPlaceholder(
  receiptNumber: string,
  staffId: string,
  reason: string,
): Promise<ReceiptAuditEvent[]> {
  saveList(
    RECEIPTS_KEY,
    readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map((receipt) =>
      receipt.receiptNumber === receiptNumber
        ? {
            ...receipt,
            status: "Voided",
            voidReference: `VOID-${receiptNumber}`,
            updatedAt: new Date().toISOString(),
          }
        : receipt,
    ),
  );
  return addAudit(
    "RECEIPT_VOIDED",
    receiptNumber,
    `Void placeholder recorded: ${reason}`,
    staffId,
  );
}

export async function refundReceiptPlaceholder(
  receiptNumber: string,
  staffId: string,
  reason: string,
): Promise<ReceiptAuditEvent[]> {
  saveList(
    RECEIPTS_KEY,
    readList<ReceiptRecord>(RECEIPTS_KEY, mockReceiptRecords).map((receipt) =>
      receipt.receiptNumber === receiptNumber
        ? {
            ...receipt,
            status: "Partially Refunded",
            refundReference: `REF-${receiptNumber}`,
            updatedAt: new Date().toISOString(),
          }
        : receipt,
    ),
  );
  return addAudit(
    "RECEIPT_REFUNDED",
    receiptNumber,
    `Refund placeholder recorded: ${reason}`,
    staffId,
  );
}

export async function getReceiptSequenceControl(
  filters: ReceiptFilters,
): Promise<ReceiptSequenceControl[]> {
  return readList<ReceiptSequenceControl>(
    SEQUENCE_KEY,
    mockReceiptSequenceControls,
  ).filter(
    (row) =>
      branchMatch(row.branch, filters.branch) &&
      terminalMatch(row.terminal, filters.terminal),
  );
}

export async function runReceiptSequenceCheck(
  filters: ReceiptFilters,
): Promise<ReceiptSequenceControl[]> {
  const rows = await getReceiptSequenceControl(filters);
  addAudit(
    "RECEIPT_SEQUENCE_CHECKED",
    rows[0]?.lastReceiptNo || "ALL",
    "Receipt sequence check run.",
  );
  if (rows.some((row) => row.gapCount > 0)) {
    addAudit(
      "RECEIPT_GAP_DETECTED",
      rows[0]?.lastReceiptNo || "ALL",
      "Receipt gap warning detected.",
    );
  }
  if (
    rows.some(
      (row) =>
        row.duplicateRisk === "High" || row.sequenceStatus === "Duplicate Risk",
    )
  ) {
    addAudit(
      "DUPLICATE_RECEIPT_RISK",
      rows[0]?.lastReceiptNo || "ALL",
      "Duplicate receipt risk detected.",
    );
  }
  return rows;
}

export async function queueFiscalizationPlaceholder(
  receiptNumber: string,
): Promise<ReceiptAuditEvent[]> {
  const fiscalRows = readList<FiscalizationPlaceholderRecord>(
    FISCAL_KEY,
    mockFiscalizationPlaceholderRecords,
  );
  const exists = fiscalRows.some((row) => row.receiptNumber === receiptNumber);
  if (!exists) {
    saveList(FISCAL_KEY, [
      {
        id: `FISC-${Math.floor(10000 + Math.random() * 90000)}`,
        receiptNumber,
        dateTime: new Date().toISOString(),
        branch: "Main Branch",
        terminal: "POS-01",
        fiscalStatus: "Queued",
        fiscalReferencePlaceholder: `FISC-${receiptNumber}`,
        queueStatus: "Queued",
      },
      ...fiscalRows,
    ]);
  }
  return addAudit(
    "FISCALIZATION_QUEUED",
    receiptNumber,
    "Fiscalization queued.",
  );
}

export async function getFiscalizationPlaceholderStatus(
  receiptNumber?: string,
): Promise<FiscalizationPlaceholderRecord[]> {
  const rows = readList<FiscalizationPlaceholderRecord>(
    FISCAL_KEY,
    mockFiscalizationPlaceholderRecords,
  );
  return receiptNumber
    ? rows.filter((row) => row.receiptNumber === receiptNumber)
    : rows;
}

export async function exportReceiptPlaceholder(
  receiptNumber: string,
  format: ReceiptFormat,
): Promise<{ message: string; activity: ReceiptAuditEvent[] }> {
  const activity = addAudit(
    format === "PDF Placeholder"
      ? "RECEIPT_PDF_EXPORT_PREPARED"
      : "RECEIPT_PRINTED",
    receiptNumber,
    `${format} receipt export placeholder prepared.`,
  );
  return {
    message: `${format} receipt export placeholder prepared.`,
    activity,
  };
}

export async function getReceiptReprintAudits(): Promise<
  typeof mockReceiptReprintAudits
> {
  return seedRows(mockReceiptReprintAudits);
}

export async function getReceiptAuditEvents(): Promise<ReceiptAuditEvent[]> {
  return readList<ReceiptAuditEvent>(AUDIT_KEY, mockReceiptAuditEvents);
}
