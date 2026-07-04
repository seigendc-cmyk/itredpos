export interface VendorBootstrapProfile {
  vendorId: string;
  businessName: string;
  tradingName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  whatsapp: string;
  businessType: string;
  industry: string;
  country: string;
  provinceState: string;
  city: string;
  suburb: string;
  postalCode: string;
  physicalAddress: string;
  website: string;
  alternatePhone: string;
  vatRegistered: boolean;
  vatNumber: string;
  taxNumber: string;
  registrationNumber: string;

  defaultBranchName: string;
  defaultWarehouseName: string;

  // Branch Details
  branchName: string;
  branchPhone: string;
  branchWhatsapp: string;
  branchEmail: string;
  branchCountry: string;
  branchProvince: string;
  branchCity: string;
  branchSuburb: string;
  branchAddress: string;

  // Warehouse Details
  warehouseName: string;
  warehousePhone: string;
  warehouseWhatsapp: string;
  warehouseEmail: string;
  warehouseCountry: string;
  warehouseProvince: string;
  warehouseCity: string;
  warehouseSuburb: string;
  warehouseAddress: string;

  ownerStaffName: string;
  ownerPin: string;

  planCode: string;
  trialDays: number;

  createdAt: string;
}

export function createEmptyVendorBootstrap(): VendorBootstrapProfile {
  return {
    vendorId: '',
    businessName: '',
    tradingName: '',
    ownerName: '',
    ownerEmail: '',
    phone: '',
    whatsapp: '',
    businessType: '',
    industry: '',
    country: 'Zimbabwe',
    provinceState: '',
    city: '',
    suburb: '',
    postalCode: '',
    physicalAddress: '',
    website: '',
    alternatePhone: '',
    vatRegistered: false,
    vatNumber: '',
    taxNumber: '',
    registrationNumber: '',

    defaultBranchName: 'Main Branch',
    defaultWarehouseName: 'Main Warehouse',

    // Branch Details
    branchName: 'Main Branch',
    branchPhone: '',
    branchWhatsapp: '',
    branchEmail: '',
    branchCountry: 'Zimbabwe',
    branchProvince: '',
    branchCity: '',
    branchSuburb: '',
    branchAddress: '',

    // Warehouse Details
    warehouseName: 'Main Warehouse',
    warehousePhone: '',
    warehouseWhatsapp: '',
    warehouseEmail: '',
    warehouseCountry: 'Zimbabwe',
    warehouseProvince: '',
    warehouseCity: '',
    warehouseSuburb: '',
    warehouseAddress: '',

    ownerStaffName: 'Owner',
    ownerPin: '0000',

    planCode: 'DEMO',
    trialDays: 3,

    createdAt: new Date().toISOString()
  };
}

export interface VendorDocumentIdentity {
  displayName: string;
  legalName: string;
  tradingName: string;
  addressLine: string;
  cityLine: string;
  phoneLine: string;
  whatsappLine: string;
  emailLine: string;
  vatLine: string;
  taxLine: string;
  registrationLine: string;
  branchName: string;
  branchAddress: string;
  branchPhone: string;
  warehouseName: string;
  warehouseAddress: string;
  warehousePhone: string;
  vendorId?: string;
  businessType?: string;
  industry?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  vatNumber?: string;
  taxNumber?: string;
  registrationNumber?: string;
  branchId?: string;
  branchWhatsapp?: string;
  branchEmail?: string;
  warehouseId?: string;
  warehouseWhatsapp?: string;
  warehouseEmail?: string;
  terminalId?: string;
  terminalName?: string;
}

export interface VendorDocumentIdentityContext {
  vendorId?: string;
  branchId?: string;
  warehouseId?: string;
  terminalId?: string;
  branchName?: string;
  warehouseName?: string;
  terminalName?: string;
  displayName?: string;
  legalName?: string;
  tradingName?: string;
  addressLine?: string;
  phoneLine?: string;
  whatsappLine?: string;
  emailLine?: string;
  vatNumber?: string;
  taxNumber?: string;
  registrationNumber?: string;
}

type StoredRecord = Record<string, unknown>;

const VENDOR_DOCUMENT_PLACEHOLDERS = new Set([
  'industrial heavy machine supply',
  '12 enterprise road, harare',
  '12 enterprise road',
  'sales@itredcommerce.local',
  '@itredcommerce',
  'vat-vat-zw-82190b',
  'vat-zw-82190b',
  'sci logistics ltd',
  'sci auto spares',
  'demo vendor',
  'build development vendor',
  'current vendor',
  'itred commerce pos',
  'tenant',
  'vendor n/a'
]);

function readRuntimeJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function asText(value: unknown): string {
  return String(value || '').trim();
}

export function isVendorDocumentPlaceholder(value: unknown): boolean {
  const text = asText(value);
  return !text || VENDOR_DOCUMENT_PLACEHOLDERS.has(text.toLowerCase());
}

function firstText(...values: unknown[]): string {
  return values.map(asText).find((value) => value && !isVendorDocumentPlaceholder(value)) || '';
}

function getRecordText(record: StoredRecord | undefined, ...keys: string[]): string {
  if (!record) return '';
  return firstText(...keys.map((key) => record[key]));
}

function joinParts(...values: unknown[]): string {
  return values.map(asText).filter(Boolean).join(', ');
}

function findByIdOrName(records: StoredRecord[], id?: string, name?: string): StoredRecord | undefined {
  const cleanId = asText(id).toLowerCase();
  const cleanName = asText(name).toLowerCase();
  return records.find((record) => {
    const recordId = asText(record.id).toLowerCase();
    const recordName = asText(record.name).toLowerCase();
    return (cleanId && recordId === cleanId) || (cleanName && recordName === cleanName);
  });
}

export function getVendorDocumentIdentity(context: VendorDocumentIdentityContext = {}): VendorDocumentIdentity {
  const profile = readRuntimeJson<StoredRecord | null>('itred_pos_business_profile', null) || {};
  const branches = readRuntimeJson<StoredRecord[]>('itred_pos_branches', []);
  const warehouses = readRuntimeJson<StoredRecord[]>('itred_pos_warehouses', []);
  const terminals = readRuntimeJson<StoredRecord[]>('itred_pos_terminals', []);
  const terminal = findByIdOrName(terminals, context.terminalId, context.terminalName);
  const branch = findByIdOrName(branches, context.branchId, context.branchName) || branches[0] || {};
  const warehouse = findByIdOrName(warehouses, context.warehouseId, context.warehouseName) || warehouses[0] || {};

  const businessName = firstText(context.displayName, profile.tradingName, profile.legalName, profile.businessName, profile.receiptBusinessName);
  const legalName = firstText(context.legalName, profile.legalName, profile.registeredBusinessName, profile.businessName, businessName) || 'iTred Commerce POS';
  const tradingName = firstText(context.tradingName, profile.tradingName, profile.receiptBusinessName, businessName, legalName);
  const displayName = firstText(tradingName, legalName, context.vendorId) || legalName;
  const vendorId = firstText(context.vendorId, profile.vendorId);

  const suburb = getRecordText(profile, 'suburb', 'districtSuburb', 'district');
  const city = getRecordText(profile, 'city', 'cityTown');
  const province = getRecordText(profile, 'province', 'provinceState');
  const country = getRecordText(profile, 'country');
  const postalCode = getRecordText(profile, 'postalCode');
  const addressLine = firstText(
    context.addressLine,
    profile.physicalAddress,
    profile.headquartersAddress,
    profile.address,
    profile.businessAddress
  );
  const cityLine = joinParts(suburb, city, province, postalCode, country);
  const phone = firstText(context.phoneLine, profile.businessPhone, profile.phone, profile.phoneNumber1, profile.ownerContact, profile.ownerPhone);
  const whatsapp = firstText(context.whatsappLine, profile.businessWhatsapp, profile.whatsapp, profile.whatsAppNumber1, profile.ownerWhatsApp);
  const email = firstText(context.emailLine, profile.email, profile.ownerEmail, profile.primaryEmail, profile.supportEmail, profile.administratorEmail);
  const vatNumber = firstText(context.vatNumber, profile.vatNumber);
  const taxNumber = firstText(context.taxNumber, profile.taxNumber, profile.taxNo, profile.taxIdentificationNumber, profile.taxRegistrationNumber);
  const registrationNumber = firstText(
    context.registrationNumber,
    profile.registrationNumber,
    profile.companyRegistrationNumber,
    profile.tradeCertificateRegistrationNumber,
    profile.regNo
  );

  const branchName = firstText(context.branchName, branch.name, branch.branchName, 'Main Branch');
  const branchAddress = firstText(branch.address, branch.physicalAddress, branch.location);
  const branchPhone = firstText(branch.branchPhone, branch.phone, branch.phoneNumber1);
  const branchWhatsapp = firstText(branch.branchWhatsapp, branch.whatsapp, branch.whatsAppNumber);
  const branchEmail = firstText(branch.branchEmail, branch.email);

  const warehouseName = firstText(context.warehouseName, warehouse.name, warehouse.warehouseName, 'Main Warehouse');
  const warehouseAddress = firstText(warehouse.address, warehouse.physicalAddress, warehouse.location);
  const warehousePhone = firstText(warehouse.warehousePhone, warehouse.phone, warehouse.phoneNumber1);
  const warehouseWhatsapp = firstText(warehouse.warehouseWhatsapp, warehouse.whatsapp, warehouse.whatsAppNumber);
  const warehouseEmail = firstText(warehouse.warehouseEmail, warehouse.email);

  const terminalName = firstText(context.terminalName, terminal?.name, context.terminalId);
  const terminalId = firstText(context.terminalId, terminal?.id);

  return {
    displayName,
    legalName,
    tradingName,
    addressLine,
    cityLine,
    phoneLine: phone ? `Phone: ${phone}` : '',
    whatsappLine: whatsapp ? `WhatsApp: ${whatsapp}` : '',
    emailLine: email ? `Email: ${email}` : '',
    vatLine: vatNumber ? `VAT No: ${vatNumber}` : '',
    taxLine: taxNumber ? `Tax No: ${taxNumber}` : '',
    registrationLine: registrationNumber ? `Registration No: ${registrationNumber}` : '',
    branchName,
    branchAddress,
    branchPhone,
    warehouseName,
    warehouseAddress,
    warehousePhone,
    vendorId,
    businessType: getRecordText(profile, 'businessType'),
    industry: getRecordText(profile, 'industry', 'industrialSector'),
    phone,
    whatsapp,
    email,
    vatNumber,
    taxNumber,
    registrationNumber,
    branchId: firstText(context.branchId, branch.id),
    branchWhatsapp,
    branchEmail,
    warehouseId: firstText(context.warehouseId, warehouse.id),
    warehouseWhatsapp,
    warehouseEmail,
    terminalId,
    terminalName
  };
}

