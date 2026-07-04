import { useState } from "react";
import {
  readPosAuthContext,
  resolveNextAuthStage,
  savePosAuthContext
} from "../auth/posVendorAuthState";
import {
  VendorBootstrapProfile,
  createEmptyVendorBootstrap
} from "../vendor/vendorBootstrapModel";
import {
  provisionVendorFromBusinessSetup,
  type VendorProvisioningResult,
  type VendorProvisioningSyncStatus
} from "../vendor/vendorProvisioningService";
import { sanitizeDocId } from "../firebase/firestoreIds";
import {
  Building2,
  Store,
  Warehouse,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Info
} from "lucide-react";

const BUSINESS_TYPES = ["Retail", "Wholesale", "Supermarket", "Restaurant", "Pharmacy", "Hardware", "Services", "Other"];
const INDUSTRIES = ["Automotive", "Food & Beverage", "Healthcare", "Technology", "Construction", "Education", "Retail & Commerce", "Other"];
const COUNTRIES = ["Zimbabwe", "South Africa", "Botswana", "Mozambique", "Zambia"];
const PROVINCES = [
  "Harare",
  "Bulawayo",
  "Manicaland",
  "Mashonaland Central",
  "Mashonaland East",
  "Mashonaland West",
  "Masvingo",
  "Matabeleland North",
  "Matabeleland South",
  "Midlands"
];
const CITIES = [
  "Harare",
  "Bulawayo",
  "Chitungwiza",
  "Mutare",
  "Epworth",
  "Gweru",
  "Kwekwe",
  "Kadoma",
  "Masvingo",
  "Ruwa"
];

const MAIN_BRANCH_ID = "main-branch";
const MAIN_WAREHOUSE_ID = "main-warehouse";
const MAIN_TERMINAL_ID = "TERM-MAIN-001";
const OWNER_STAFF_ID = "owner-staff";

const POS_RUNTIME_STORAGE_KEYS = {
  businessProfile: "itred_pos_business_profile",
  branches: "itred_pos_branches",
  warehouses: "itred_pos_warehouses",
  terminals: "itred_pos_terminals",
  staff: "itred_pos_staff",
  receiptSetting: "itred_pos_receipt_setting",
  receiptHeader: "itred_pos_conf_receipt_head"
};

function clean(value: string | undefined, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function writePosRuntimeValue(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function persistVendorRuntimeState(
  profile: VendorBootstrapProfile,
  vendorId: string,
  syncStatus: VendorProvisioningSyncStatus = "PendingSync",
  provisioningError = ""
) {
  const now = new Date().toISOString();
  const businessName = clean(profile.businessName);
  const tradingName = clean(profile.tradingName, businessName);
  const physicalAddress = clean(profile.physicalAddress);
  const ownerName = clean(profile.ownerName, clean(profile.ownerStaffName, "Owner"));
  const branchName = clean(profile.defaultBranchName, clean(profile.branchName, "Main Branch"));
  const branchAddress = clean(profile.branchAddress);
  const warehouseName = clean(profile.defaultWarehouseName, clean(profile.warehouseName, "Main Warehouse"));
  const warehouseAddress = clean(profile.warehouseAddress);
  const businessPhone = clean(profile.phone);
  const businessWhatsapp = clean(profile.whatsapp);
  const ownerEmail = clean(profile.ownerEmail);
  const vatNumber = clean(profile.vatNumber);
  const taxNumber = clean(profile.taxNumber);
  const registrationNumber = clean(profile.registrationNumber);

  const businessProfile = {
    vendorId,
    businessName,
    legalName: businessName,
    registeredBusinessName: businessName,
    tradingName,
    receiptBusinessName: tradingName,
    businessType: clean(profile.businessType),
    industry: clean(profile.industry),
    industrialSector: clean(profile.industry),
    country: clean(profile.country, "Zimbabwe"),
    province: clean(profile.provinceState),
    provinceState: clean(profile.provinceState),
    city: clean(profile.city),
    cityTown: clean(profile.city),
    district: clean(profile.suburb),
    suburb: clean(profile.suburb),
    districtSuburb: clean(profile.suburb),
    postalCode: clean(profile.postalCode),
    address: physicalAddress,
    headquartersAddress: physicalAddress,
    physicalAddress,
    ownerName,
    ownerFullName: ownerName,
    ownerContact: businessPhone,
    ownerPhone: businessPhone,
    ownerWhatsApp: businessWhatsapp,
    ownerEmail,
    email: ownerEmail,
    phone: businessPhone,
    businessPhone,
    phoneNumber1: businessPhone,
    phoneNumber2: clean(profile.alternatePhone),
    alternatePhone: clean(profile.alternatePhone),
    whatsapp: businessWhatsapp,
    businessWhatsapp,
    whatsAppNumber1: businessWhatsapp,
    primaryEmail: ownerEmail,
    website: clean(profile.website),
    websitePlaceholder: clean(profile.website),
    vatRegistered: profile.vatRegistered,
    vatNumber,
    taxNumber,
    taxNo: taxNumber,
    taxIdentificationNumber: taxNumber,
    taxRegistrationNumber: taxNumber,
    registrationNumber,
    companyRegistrationNumber: registrationNumber,
    tradeCertificateRegistrationNumber: registrationNumber,
    regNo: registrationNumber,
    status: "Active",
    profileStatus: "Active",
    businessStatus: "Demo",
    licenseStatus: "Demo",
    licenseMode: "demo",
    planId: "DEMO",
    planCode: "DEMO",
    firebaseWritesEnabled: false,
    syncStatus,
    consoleSyncStatus: syncStatus,
    consoleProvisioningStatus: syncStatus,
    consoleProvisioningError: provisioningError,
    consoleLastSyncAt: syncStatus === "Synced" ? now : "",
    consolePendingSince: syncStatus === "PendingSync" ? now : "",
    currency: "USD",
    profileLastUpdatedAt: now,
    profileUpdatedBy: OWNER_STAFF_ID
  };

  const branches = [
    {
      id: MAIN_BRANCH_ID,
      name: branchName,
      location: branchAddress || [clean(profile.branchCity), clean(profile.branchSuburb)].filter(Boolean).join(", "),
      vendorId,
      branchCode: MAIN_BRANCH_ID,
      branchType: "Main Branch",
      phone: clean(profile.branchPhone),
      branchPhone: clean(profile.branchPhone),
      phoneNumber1: clean(profile.branchPhone),
      whatsapp: clean(profile.branchWhatsapp),
      branchWhatsapp: clean(profile.branchWhatsapp),
      whatsAppNumber: clean(profile.branchWhatsapp),
      email: clean(profile.branchEmail),
      branchEmail: clean(profile.branchEmail),
      country: clean(profile.branchCountry, "Zimbabwe"),
      province: clean(profile.branchProvince),
      provinceState: clean(profile.branchProvince),
      city: clean(profile.branchCity),
      cityTown: clean(profile.branchCity),
      district: clean(profile.branchSuburb),
      suburb: clean(profile.branchSuburb),
      address: branchAddress,
      physicalAddress: branchAddress,
      status: "Active",
      syncStatus,
      createdByStaffId: OWNER_STAFF_ID,
      createdAt: now,
      updatedAt: now
    }
  ];

  const warehouses = [
    {
      id: MAIN_WAREHOUSE_ID,
      name: warehouseName,
      branchId: MAIN_BRANCH_ID,
      vendorId,
      warehouseCode: MAIN_WAREHOUSE_ID,
      warehouseType: "Main Warehouse",
      phone: clean(profile.warehousePhone),
      warehousePhone: clean(profile.warehousePhone),
      whatsapp: clean(profile.warehouseWhatsapp),
      warehouseWhatsapp: clean(profile.warehouseWhatsapp),
      email: clean(profile.warehouseEmail),
      warehouseEmail: clean(profile.warehouseEmail),
      country: clean(profile.warehouseCountry, "Zimbabwe"),
      province: clean(profile.warehouseProvince),
      provinceState: clean(profile.warehouseProvince),
      city: clean(profile.warehouseCity),
      cityTown: clean(profile.warehouseCity),
      district: clean(profile.warehouseSuburb),
      suburb: clean(profile.warehouseSuburb),
      address: warehouseAddress,
      physicalAddress: warehouseAddress,
      responsibleStaff: ownerName,
      status: "Active",
      syncStatus,
      createdByStaffId: OWNER_STAFF_ID,
      createdAt: now,
      updatedAt: now
    }
  ];

  const terminals = [
    {
      id: MAIN_TERMINAL_ID,
      name: "Main POS Terminal",
      branchId: MAIN_BRANCH_ID,
      warehouseId: MAIN_WAREHOUSE_ID,
      type: "POS",
      status: "Active",
      syncStatus
    }
  ];

  const staff = [
    {
      id: OWNER_STAFF_ID,
      name: ownerName,
      email: clean(profile.ownerEmail),
      role: "Owner",
      pass: clean(profile.ownerPin),
      pin: clean(profile.ownerPin),
      branchId: MAIN_BRANCH_ID,
      syncStatus
    }
  ];

  const receiptSetting = {
    header: tradingName,
    footer: "Thank you for shopping with us.",
    slipWidth: "32_COLUMNS (STANDARD_SLIP)",
    showTaxBreakdown: true,
    layout: "Thermal Receipt Roll",
    headerMessage: clean(profile.businessType) || clean(profile.industry),
    footerMessage: "Thank you for shopping with us.",
    termsAndConditions: "Goods may be returned according to store policy with a valid receipt.",
    businessAddress: [physicalAddress, clean(profile.suburb), clean(profile.city)].filter(Boolean).join(", "),
    contactNumbers: [businessPhone, businessWhatsapp].filter(Boolean).join(" | "),
    emailAddress: ownerEmail,
    contactInformation: [businessPhone, businessWhatsapp].filter(Boolean).join(" | "),
    socialMediaHandles: clean(profile.website),
    socialMediaInformation: clean(profile.website)
  };

  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.businessProfile, businessProfile);
  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.branches, branches);
  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.warehouses, warehouses);
  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.terminals, terminals);
  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.staff, staff);
  writePosRuntimeValue(POS_RUNTIME_STORAGE_KEYS.receiptSetting, receiptSetting);
  localStorage.setItem(POS_RUNTIME_STORAGE_KEYS.receiptHeader, tradingName);
}

export default function VendorBusinessSetupPage() {
  const [profile, setProfile] = useState<VendorBootstrapProfile>(() => {
    const defaultProfile = createEmptyVendorBootstrap();
    const existing = readPosAuthContext();
    if (existing?.googleEmail) {
      defaultProfile.ownerEmail = existing.googleEmail;
    }
    return defaultProfile;
  });

  const [showPin, setShowPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  function update<K extends keyof VendorBootstrapProfile>(
    field: K,
    value: VendorBootstrapProfile[K]
  ) {
    setProfile(previous => ({
      ...previous,
      [field]: value
    }));
  }

  async function handleSaveProfile() {
    if (isSaving) return;
    const missing: string[] = [];

    // Business Details
    if (!profile.businessName.trim()) missing.push("Business Name");
    if (!profile.ownerName.trim()) missing.push("Owner Name");
    if (!profile.ownerEmail.trim()) missing.push("Owner Email");
    if (!profile.phone.trim()) missing.push("Business Phone");
    if (!profile.whatsapp.trim()) missing.push("Business WhatsApp");
    if (!profile.businessType.trim()) missing.push("Business Type");
    if (!profile.country.trim()) missing.push("Country");
    if (!profile.provinceState.trim()) missing.push("Province / State");
    if (!profile.city.trim()) missing.push("City / Town");
    if (!profile.suburb.trim()) missing.push("Suburb");

    // Branch Details
    if (!profile.branchName.trim()) missing.push("Branch Name");
    if (!profile.branchPhone.trim()) missing.push("Branch Phone");
    if (!profile.branchWhatsapp.trim()) missing.push("Branch WhatsApp");
    if (!profile.branchAddress.trim()) missing.push("Branch Address");

    // Warehouse Details
    if (!profile.warehouseName.trim()) missing.push("Warehouse Name");
    if (!profile.warehousePhone.trim()) missing.push("Warehouse Phone");
    if (!profile.warehouseWhatsapp.trim()) missing.push("Warehouse WhatsApp");
    if (!profile.warehouseAddress.trim()) missing.push("Warehouse Address");

    // Owner PIN
    if (!profile.ownerPin.trim()) missing.push("Owner PIN");

    if (missing.length > 0) {
      alert("Please fill in the following required fields:\n- " + missing.join("\n- "));
      return;
    }

    const existing = readPosAuthContext();

    setIsSaving(true);

    const vendorId = sanitizeDocId(
      profile.vendorId ||
      `vendor_${Date.now()}`
    );

    const demoExpiresAt = new Date(
      Date.now() + profile.trialDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const nextContext = {
      ...(existing || {}),
      stage: "staffAccessRequired" as const,
      googleUid: existing?.googleUid || `demo-google-${Date.now()}`,
      googleEmail: profile.ownerEmail || existing?.googleEmail || "owner@example.com",
      vendorId,
      vendorName: clean(profile.businessName),
      branchId: MAIN_BRANCH_ID,
      warehouseId: MAIN_WAREHOUSE_ID,
      staffId: OWNER_STAFF_ID,
      staffRole: "Owner",
      licenseStatus: "Demo" as const,
      demoExpiresAt,
      syncStatus: "PendingSync" as const,
      consoleProvisioningError: "",
      message: "Business profile created. POS workspace is ready."
    };

    nextContext.stage = resolveNextAuthStage(nextContext);

    persistVendorRuntimeState(profile, vendorId, "PendingSync");
    savePosAuthContext(nextContext);

    let provisioningResult: VendorProvisioningResult;
    try {
      provisioningResult = await provisionVendorFromBusinessSetup(profile, nextContext);
    } catch (error) {
      provisioningResult = {
        vendorId,
        syncStatus: "PendingSync",
        firestoreWritten: false,
        writtenCollections: [],
        provisionedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown vendor provisioning error."
      };
    }

    const finalContext = {
      ...nextContext,
      vendorId: provisioningResult.vendorId,
      syncStatus: provisioningResult.syncStatus,
      consoleProvisionedAt: provisioningResult.syncStatus === "Synced" ? provisioningResult.provisionedAt : undefined,
      consoleProvisioningError: provisioningResult.error || "",
      message: provisioningResult.syncStatus === "Synced"
        ? "Business profile created. Registration submitted for review."
        : "Business profile created. POS is ready; registration sync is pending."
    };
    finalContext.stage = resolveNextAuthStage(finalContext);

    persistVendorRuntimeState(profile, provisioningResult.vendorId, provisioningResult.syncStatus, provisioningResult.error || "");
    savePosAuthContext(finalContext);

    window.location.reload();
  }

  const inputClasses = "w-full rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none transition-all duration-200 shadow-sm";
  const selectClasses = "w-full rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm text-gray-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none transition-all duration-200 shadow-sm appearance-none pr-8 bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat";

  const renderLabel = (text: string, isRequired: boolean) => (
    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 tracking-wider">
      {text} {isRequired && <span className="text-[#E2531B] font-black">*</span>}
    </label>
  );

  const renderWhatsAppField = (value: string, onChange: (val: string) => void, isRequired: boolean = false) => (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-lg border border-gray-200 bg-gray-50/30 pl-3 pr-10 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none transition-all duration-200 shadow-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
        <svg className="w-5 h-5 text-green-500 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.713-1.458L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.45 5.436.002 9.861-4.417 9.864-9.861.002-2.638-1.022-5.117-2.884-6.98C16.387 1.898 13.916.87 11.282.87c-5.438 0-9.863 4.418-9.866 9.863-.001 1.716.444 3.39 1.29 4.88l-.997 3.64 3.737-.98c1.454.793 2.923 1.18 4.601 1.18zm9.84-7.46c-.272-.136-1.61-.794-1.86-.885-.25-.09-.432-.136-.613.136-.18.272-.7 1.055-.86 1.238-.16.18-.32.2-.592.064-.27-.137-1.147-.423-2.185-1.348-.808-.72-1.353-1.612-1.512-1.884-.16-.272-.017-.42.118-.556.123-.122.272-.32.408-.477.136-.16.18-.27.272-.454.09-.18.045-.34-.023-.477-.068-.136-.613-1.477-.84-2.02-.22-.53-.442-.46-.613-.47-.16-.008-.34-.01-.52-.01-.18 0-.477.067-.726.34-.25.272-.953.93-.953 2.27 0 1.338.977 2.628 1.11 2.81 1.34 1.76 2.06 2.69 3.65 3.34.8.33 1.48.37 2.02.29.6-.09 1.86-.76 2.12-1.45.26-.69.26-1.28.18-1.41-.08-.13-.272-.2-.544-.336z"/>
        </svg>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center font-sans">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-[#F3EFE6] p-8 md:p-10">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 pb-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E2531B] flex items-center justify-center text-white shadow-sm">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#E2531B] tracking-wide uppercase">
                Business Setup Wizard
              </h1>
              <p className="text-xs md:text-sm text-gray-500 font-medium mt-0.5">
                Complete your business profile to activate your POS.
              </p>
            </div>
          </div>
          
          {/* Steps Progress Indicator */}
          <div className="flex flex-col items-center">
            <div className="flex items-center">
              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full bg-[#E2531B] text-white flex items-center justify-center text-xs font-bold shadow-sm z-10">
                  1
                </div>
                <div className="absolute top-7 text-[10px] font-bold text-[#E2531B] whitespace-nowrap">
                  Business Details
                </div>
              </div>

              <div className="w-16 md:w-20 h-0.5 bg-[#E2531B]" />

              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full border border-gray-300 bg-white text-gray-400 flex items-center justify-center text-xs font-bold z-10">
                  2
                </div>
                <div className="absolute top-7 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                  Review
                </div>
              </div>

              <div className="w-16 md:w-20 h-0.5 bg-gray-200" />

              <div className="relative flex flex-col items-center">
                <div className="w-6 h-6 rounded-full border border-gray-300 bg-white text-gray-400 flex items-center justify-center text-xs font-bold z-10">
                  3
                </div>
                <div className="absolute top-7 text-[10px] font-bold text-gray-400 whitespace-nowrap">
                  Complete
                </div>
              </div>
            </div>
            <div className="h-4" />
          </div>
        </div>

        {/* Section 1: Business Details */}
        <div className="mb-8">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
            <Building2 className="w-5 h-5 text-[#E2531B]" />
            <h2 className="text-sm font-extrabold text-[#E2531B] tracking-wider uppercase">
              Business Details
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              {renderLabel("Business Name", true)}
              <input
                className={inputClasses}
                placeholder="Business Name"
                value={profile.businessName}
                onChange={e => update("businessName", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Trading Name", false)}
              <input
                className={inputClasses}
                placeholder="Trading name (if different)"
                value={profile.tradingName}
                onChange={e => update("tradingName", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Phone (Business)", true)}
              <input
                className={inputClasses}
                placeholder="Phone (Business)"
                value={profile.phone}
                onChange={e => update("phone", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("WhatsApp (Business)", true)}
              {renderWhatsAppField(profile.whatsapp, val => update("whatsapp", val), true)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              {renderLabel("Owner Name", true)}
              <input
                className={inputClasses}
                placeholder="Owner Name"
                value={profile.ownerName}
                onChange={e => update("ownerName", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Owner Email", true)}
              <input
                className={inputClasses}
                placeholder="Owner Email"
                value={profile.ownerEmail}
                onChange={e => update("ownerEmail", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Alternate Phone", false)}
              <input
                className={inputClasses}
                placeholder="Alternate Phone"
                value={profile.alternatePhone}
                onChange={e => update("alternatePhone", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Website", false)}
              <input
                className={inputClasses}
                placeholder="www.yourbusiness.com"
                value={profile.website}
                onChange={e => update("website", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              {renderLabel("Business Type", true)}
              <select
                className={selectClasses}
                value={profile.businessType}
                onChange={e => update("businessType", e.target.value)}
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Industry", false)}
              <select
                className={selectClasses}
                value={profile.industry}
                onChange={e => update("industry", e.target.value)}
              >
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
            <div>
              {renderLabel("Country", true)}
              <select
                className={selectClasses}
                value={profile.country}
                onChange={e => update("country", e.target.value)}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Province / State", true)}
              <select
                className={selectClasses}
                value={profile.provinceState}
                onChange={e => update("provinceState", e.target.value)}
              >
                <option value="">Select Province</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("City / Town", true)}
              <select
                className={selectClasses}
                value={profile.city}
                onChange={e => update("city", e.target.value)}
              >
                <option value="">Select City</option>
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Suburb", true)}
              <input
                className={inputClasses}
                placeholder="Suburb"
                value={profile.suburb}
                onChange={e => update("suburb", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Postal Code", false)}
              <input
                className={inputClasses}
                placeholder="Postal Code"
                value={profile.postalCode}
                onChange={e => update("postalCode", e.target.value)}
              />
            </div>
          </div>

          <div>
            {renderLabel("Physical Address", false)}
            <input
              className={inputClasses}
              placeholder="Physical Address"
              value={profile.physicalAddress}
              onChange={e => update("physicalAddress", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <label className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm font-bold text-gray-700 shadow-sm">
              <input
                type="checkbox"
                checked={profile.vatRegistered}
                onChange={e => update("vatRegistered", e.target.checked)}
                className="h-4 w-4 accent-[#E2531B]"
              />
              VAT Registered
            </label>
            <div>
              {renderLabel("VAT Number", false)}
              <input
                className={inputClasses}
                placeholder="VAT Number"
                value={profile.vatNumber}
                onChange={e => update("vatNumber", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Tax Number", false)}
              <input
                className={inputClasses}
                placeholder="Tax Number"
                value={profile.taxNumber}
                onChange={e => update("taxNumber", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Company Registration No.", false)}
              <input
                className={inputClasses}
                placeholder="Registration Number"
                value={profile.registrationNumber}
                onChange={e => update("registrationNumber", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Branch Details */}
        <div className="mb-8">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
            <Store className="w-5 h-5 text-[#E2531B]" />
            <h2 className="text-sm font-extrabold text-[#E2531B] tracking-wider uppercase">
              Branch Details (Default)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              {renderLabel("Branch Name", true)}
              <input
                className={inputClasses}
                placeholder="Branch Name"
                value={profile.branchName}
                onChange={e => {
                  const val = e.target.value;
                  setProfile(prev => ({
                    ...prev,
                    branchName: val,
                    defaultBranchName: val
                  }));
                }}
              />
            </div>
            <div>
              {renderLabel("Branch Phone", true)}
              <input
                className={inputClasses}
                placeholder="Branch Phone"
                value={profile.branchPhone}
                onChange={e => update("branchPhone", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Branch WhatsApp", true)}
              {renderWhatsAppField(profile.branchWhatsapp, val => update("branchWhatsapp", val), true)}
            </div>
            <div>
              {renderLabel("Branch Email", false)}
              <input
                className={inputClasses}
                placeholder="Branch Email"
                value={profile.branchEmail}
                onChange={e => update("branchEmail", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              {renderLabel("Country", false)}
              <select
                className={selectClasses}
                value={profile.branchCountry}
                onChange={e => update("branchCountry", e.target.value)}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Province / State", false)}
              <select
                className={selectClasses}
                value={profile.branchProvince}
                onChange={e => update("branchProvince", e.target.value)}
              >
                <option value="">Select Province</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("City / Town", false)}
              <select
                className={selectClasses}
                value={profile.branchCity}
                onChange={e => update("branchCity", e.target.value)}
              >
                <option value="">Select City</option>
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Suburb", false)}
              <input
                className={inputClasses}
                placeholder="Suburb"
                value={profile.branchSuburb}
                onChange={e => update("branchSuburb", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Address", true)}
              <input
                className={inputClasses}
                placeholder="Branch Address"
                value={profile.branchAddress}
                onChange={e => update("branchAddress", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Warehouse Details */}
        <div className="mb-8">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
            <Warehouse className="w-5 h-5 text-[#E2531B]" />
            <h2 className="text-sm font-extrabold text-[#E2531B] tracking-wider uppercase">
              Warehouse Details (Default)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              {renderLabel("Warehouse Name", true)}
              <input
                className={inputClasses}
                placeholder="Warehouse Name"
                value={profile.warehouseName}
                onChange={e => {
                  const val = e.target.value;
                  setProfile(prev => ({
                    ...prev,
                    warehouseName: val,
                    defaultWarehouseName: val
                  }));
                }}
              />
            </div>
            <div>
              {renderLabel("Warehouse Phone", true)}
              <input
                className={inputClasses}
                placeholder="Warehouse Phone"
                value={profile.warehousePhone}
                onChange={e => update("warehousePhone", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Warehouse WhatsApp", true)}
              {renderWhatsAppField(profile.warehouseWhatsapp, val => update("warehouseWhatsapp", val), true)}
            </div>
            <div>
              {renderLabel("Warehouse Email", false)}
              <input
                className={inputClasses}
                placeholder="Warehouse Email"
                value={profile.warehouseEmail}
                onChange={e => update("warehouseEmail", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              {renderLabel("Country", false)}
              <select
                className={selectClasses}
                value={profile.warehouseCountry}
                onChange={e => update("warehouseCountry", e.target.value)}
              >
                <option value="">Select Country</option>
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Province / State", false)}
              <select
                className={selectClasses}
                value={profile.warehouseProvince}
                onChange={e => update("warehouseProvince", e.target.value)}
              >
                <option value="">Select Province</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("City / Town", false)}
              <select
                className={selectClasses}
                value={profile.warehouseCity}
                onChange={e => update("warehouseCity", e.target.value)}
              >
                <option value="">Select City</option>
                {CITIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              {renderLabel("Suburb", false)}
              <input
                className={inputClasses}
                placeholder="Suburb"
                value={profile.warehouseSuburb}
                onChange={e => update("warehouseSuburb", e.target.value)}
              />
            </div>
            <div>
              {renderLabel("Address", true)}
              <input
                className={inputClasses}
                placeholder="Warehouse Address"
                value={profile.warehouseAddress}
                onChange={e => update("warehouseAddress", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Section 4: Owner Access */}
        <div className="mb-8">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-4">
            <Lock className="w-5 h-5 text-[#E2531B]" />
            <h2 className="text-sm font-extrabold text-[#E2531B] tracking-wider uppercase">
              Owner Access
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div>
              {renderLabel("Owner PIN", true)}
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50/30 pl-3 pr-10 py-2 text-sm text-gray-800 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:bg-white outline-none transition-all duration-200 shadow-sm"
                  placeholder="0000"
                  value={profile.ownerPin}
                  onChange={e => update("ownerPin", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 bg-[#FFF8F0] border border-[#FEEBD0] rounded-xl p-4 flex gap-3 items-start">
              <Info className="text-[#E2531B] w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-[#8A5B2E] font-medium leading-relaxed">
                  This PIN will be used to access the POS as the Owner.
                </p>
                <p className="text-[11px] text-[#8A5B2E]/80 mt-1">
                  You can change or create additional staff after setup.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-gray-100 pt-6 mt-8">
          <div className="text-xs text-gray-500 font-semibold">
            <span className="text-[#E2531B] font-bold mr-1">*</span> Required fields
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="bg-[#E2531B] hover:bg-[#C94313] disabled:bg-[#E2531B]/60 disabled:cursor-wait text-white px-8 py-3 rounded-lg font-bold text-sm tracking-wider uppercase transition-colors shadow-md flex items-center justify-center gap-2"
          >
            {isSaving ? "Setting Up..." : "Continue"} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}


