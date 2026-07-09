import React, { useEffect, useState } from 'react';
import { 
  Building, 
  MapPin, 
  Package, 
  Terminal, 
  Users, 
  ShieldCheck, 
  Cpu, 
  Receipt, 
  Percent, 
  Trash2, 
  Plus, 
  Edit, 
  Save, 
  Check, 
  AlertTriangle, 
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  Sliders,
  ChevronRight,
  Info,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BusinessProfile, 
  BranchSetting, 
  WarehouseSetting, 
  TerminalSetting, 
  StaffSetting, 
  HardwareSetting, 
  TaxSetting, 
  ReceiptSetting
} from '../types';
import type { CheckWriterSettings, FinancialControlAccount } from '../types/posTypes';
import { Role } from '../types';
import { hasPermission } from '../utils/posPermissions';
import A5FloatingForm from '../components/A5FloatingForm';
import StaffSessionGatePanel from '../components/StaffSessionGatePanel';
import RoleMenuReadinessPanel from '../components/RoleMenuReadinessPanel';
import SecurityRightsMatrix from '../components/SecurityRightsMatrix';
import VendorStaffMirrorDiagnosticsPanel from '../components/VendorStaffMirrorDiagnosticsPanel';
import { getCurrentStaffGateSession, getStaffSessionGateReadiness } from '../auth/staffSessionGateService';
import { recordSecurityMatrixEvent } from '../auth/permissionMatrixService';
import { saveBusinessProfile, validateBusinessProfile } from '../services/businessProfileService';
import { getFinancialControlAccounts } from '../services/financialControlService';
import { getCheckWriterSettings, previewNumber, updateCheckWriterSettings } from '../services/checkWriterService';
import { getActiveVendorId } from '../utils/vendorDataMode';
import {
  upsertVendorBusinessUserMirror,
  removeVendorBusinessUserMirror,
  type VendorBusinessUserRole
} from '../services/vendorStaffMirrorService';
import { isLimitReached, type PlanFeatureAccess } from '../auth/planFeatureGate';
import SubscriptionCommercePage from '../build08072026-subs/pages/SubscriptionCommercePage';
import { readPosAuthContext } from '../auth/posVendorAuthState';
import {
  createStaff,
  updateStaff,
  suspendStaff,
  getStaffByVendor,
  ensureDefaultOwnerStaff,
  mapStaffSettingToStaffRecord,
  canStaffManageStaff
} from '../services/staffFirestoreService';
import { recordStaffAuditEvent } from '../services/staffAuditService';
import type { StaffRecordStatus } from '../types';

interface PosSettingsProps {
  businessProfile: BusinessProfile;
  onUpdateBusinessProfile: (profile: BusinessProfile) => void;
  branches: BranchSetting[];
  onUpdateBranches: (branches: BranchSetting[]) => void;
  warehouses: WarehouseSetting[];
  onUpdateWarehouses: (warehouses: WarehouseSetting[]) => void;
  terminals: TerminalSetting[];
  onUpdateTerminals: (terminals: TerminalSetting[]) => void;
  staff: StaffSetting[];
  onUpdateStaff: (staff: StaffSetting[]) => void;
  hardwareSetting: HardwareSetting;
  onUpdateHardwareSetting: (hardware: HardwareSetting) => void;
  taxSetting: TaxSetting;
  onUpdateTaxSetting: (tax: TaxSetting) => void;
  receiptSetting: ReceiptSetting;
  onUpdateReceiptSetting: (receipt: ReceiptSetting) => void;
  
  // High level compatibility props
  receiptHeader: string;
  onUpdateReceiptHeader: (text: string) => void;
  terminalUnit: string;
  onUpdateTerminalUnit: (text: string) => void;
  onResetAllState: () => void;
  activeOperatorName: string;
  onUpdateOperatorName: (text: string) => void;
  activeRole?: string;
  planAccess?: PlanFeatureAccess;
}

type SettingsSectionId = 
  | 'BUSINESS_PROFILE' 
  | 'SUBSCRIPTION'
  | 'BRANCHES' 
  | 'WAREHOUSES' 
  | 'TERMINALS' 
  | 'STAFF' 
  | 'ROLES' 
  | 'HARDWARE' 
  | 'TAX' 
  | 'RECEIPT'
  | 'CHECK_WRITER_SETTINGS'
  | 'BUILD_STATUS'
  | 'STAFF_ACCESS_RIGHTS'
  | 'STAFF_MIRROR_DIAGNOSTICS'
  | 'RESET';

const SHOW_DEV_BADGES = false;

function profileText(profile: BusinessProfile, ...keys: string[]): string {
  const row = profile as BusinessProfile & Record<string, unknown>;
  for (const key of keys) {
    const value = String(row[key] || '').trim();
    if (value) return value;
  }
  return '';
}

function mapRoleToMirrorRole(role: Role): VendorBusinessUserRole {
  switch (role) {
    case 'Owner':
      return 'Owner';
    case 'SysAdmin':
      return 'VendorAdmin';
    case 'Manager':
      return 'Manager';
    case 'Cashier':
      return 'Cashier';
    case 'Stock Controller':
      return 'StockController';
    case 'Supervisor':
      return 'Supervisor';
    case 'Delivery Staff':
      return 'DeliveryStaff';
    case 'Accountant':
      return 'Accountant';
    case 'Viewer':
      return 'Viewer';
    default:
      return 'Viewer';
  }
}

/**
 * Best-effort staff membership mirror write to vendors/{vendorId}/businessUsers/{uid}.
 * The vendor-rooted Firestore rules require this record for staff membership checks.
 *
 * UID dependency: local staff have no Firebase auth uid. If `staff.uid` is missing we
 * must NOT invent one — the staff record is left unchanged and the mirror is skipped
 * with a non-blocking warning. No PIN, PIN hash, password, or local unlock secret is
 * ever written to the mirror.
 */
async function syncStaffBusinessUserMirror(
  staff: StaffSetting,
  vendorId: string,
  updatedBy: string
): Promise<void> {
  if (!staff.uid) {
    console.warn('[posSettings] Staff mirror skipped because uid is missing.');
    return;
  }
  try {
    await upsertVendorBusinessUserMirror({
      uid: staff.uid,
      vendorId,
      staffId: staff.id,
      displayName: staff.displayName,
      email: staff.email,
      role: mapRoleToMirrorRole(staff.roleName),
      permissions: [],
      status: 'active',
      branchIds: staff.branchId ? [staff.branchId] : [],
      terminalIds: [],
      warehouseIds: [],
      source: 'staff-management',
      createdBy: updatedBy,
      updatedBy
    });
  } catch (mirrorError) {
    console.warn(
      `[posSettings] Staff business-user mirror write failed (best-effort, staff ${staff.id} still saved): ` +
        (mirrorError instanceof Error ? mirrorError.message : 'Unknown mirror error.')
    );
  }
}

async function removeStaffBusinessUserMirror(
  staff: StaffSetting,
  vendorId: string,
  updatedBy: string
): Promise<void> {
  if (!staff.uid) {
    console.warn('[posSettings] Staff mirror removal skipped because uid is missing.');
    return;
  }
  try {
    await removeVendorBusinessUserMirror(vendorId, staff.uid, updatedBy);
  } catch (mirrorError) {
    console.warn(
      `[posSettings] Staff business-user mirror removal failed (best-effort, staff ${staff.id} still removed locally): ` +
        (mirrorError instanceof Error ? mirrorError.message : 'Unknown mirror error.')
    );
  }
}

export default function PosSettings({
  businessProfile,
  onUpdateBusinessProfile,
  branches,
  onUpdateBranches,
  warehouses,
  onUpdateWarehouses,
  terminals,
  onUpdateTerminals,
  staff,
  onUpdateStaff,
  hardwareSetting,
  onUpdateHardwareSetting,
  taxSetting,
  onUpdateTaxSetting,
  receiptSetting,
  onUpdateReceiptSetting,
  receiptHeader,
  onUpdateReceiptHeader,
  terminalUnit,
  onUpdateTerminalUnit,
  onResetAllState,
  activeOperatorName,
  onUpdateOperatorName,
  activeRole,
  planAccess
}: PosSettingsProps) {

  // Current active configuration section tab
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('BUSINESS_PROFILE');
  const staffGateReadiness = getStaffSessionGateReadiness();
  const currentStaffGateSession = getCurrentStaffGateSession();
  
  // Feedback Toasts / Banner messages
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };
  const limitReached = (count: number, limitKey: keyof PlanFeatureAccess['limits']) => {
    return planAccess ? isLimitReached(count, planAccess.limits[limitKey]) : false;
  };
  const limitMessage = (label: string) => `${label} limit reached for your current plan.`;
  const activeVendorId = businessProfile.vendorId || getActiveVendorId() || '';
  const mirrorUpdatedBy = activeOperatorName || activeVendorId || 'SETTINGS';
  const canManageStaff = activeRole ? canStaffManageStaff(activeRole) : false;

  const [staffDbList, setStaffDbList] = useState<StaffSetting[]>([]);
  const [staffDbLoading, setStaffDbLoading] = useState<boolean>(false);
  const [staffDbError, setStaffDbError] = useState<string>('');

  const loadStaffFromDb = async () => {
    if (!activeVendorId) return;
    setStaffDbLoading(true);
    setStaffDbError('');
    try {
      const records = await getStaffByVendor(activeVendorId);
      let list = records;
      if (list.length === 0 && activeVendorId) {
        const defaultOwner = await ensureDefaultOwnerStaff(activeVendorId, activeOperatorName || 'Owner');
        list = [defaultOwner];
      }
      setStaffDbList(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load staff from database.';
      setStaffDbError(message);
    } finally {
      setStaffDbLoading(false);
    }
  };

  // --- SUB-FORM 1: BUSINESS PROFILE STATES ---
  const [profileForm, setProfileForm] = useState<BusinessProfile>({ ...businessProfile });
  const [profileErrors, setProfileErrors] = useState<string[]>([]);
  const [profileWarnings, setProfileWarnings] = useState<string[]>([]);
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateBusinessProfile(profileForm);
    setProfileErrors(validation.errors);
    setProfileWarnings(validation.warnings);
    if (!validation.ok) {
      triggerToast('BUSINESS PROFILE VALIDATION NEEDS ATTENTION.');
      return;
    }
    const saved = saveBusinessProfile(profileForm, activeOperatorName || 'SETTINGS');
    setProfileForm(saved);
    onUpdateBusinessProfile(saved);
    triggerToast("BUSINESS PROFILE INTEGRITY SPECS UPDATED SUCCESSFULLY.");
  };

  // --- SUB-FORM 2: BRANCHES STATES ---
  const [branchForm, setBranchForm] = useState<BranchSetting>({ id: '', name: '', location: '' });
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [branchA5Open, setBranchA5Open] = useState(false);
  const handleAddOrEditBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.id || !branchForm.name) {
      alert("PLEASE COMPLETE BRANCH IDENTIFIER CODE AND NAME FIELD.");
      return;
    }
    const existsIdx = branches.findIndex(b => b.id.toUpperCase() === branchForm.id.toUpperCase());
    if (isEditingBranch) {
      onUpdateBranches(branches.map(b => b.id.toUpperCase() === branchForm.id.toUpperCase() ? branchForm : b));
      triggerToast(`BRANCH ${branchForm.id} RE-CALIBRATED.`);
      setIsEditingBranch(false);
    } else {
      if (existsIdx !== -1) {
        alert("DUPLICATE ERROR: BRANCH ID ALREADY EXISTS.");
        return;
      }
      if (limitReached(branches.length, 'maxBranches')) {
        triggerToast(limitMessage('Branch'));
        return;
      }
      onUpdateBranches([...branches, branchForm]);
      triggerToast(`BRANCH ${branchForm.id} ADDED TO DIRECTORY.`);
    }
    setBranchForm({ id: '', name: '', location: '' });
  };
  const handleEditBranchClick = (b: BranchSetting) => {
    setBranchForm(b);
    setIsEditingBranch(true);
  };
  const handleDeleteBranch = (id: string) => {
    if (confirm(`REMOVE BRANCH ${id} FROM INTEGRATED CORES?`)) {
      onUpdateBranches(branches.filter(b => b.id !== id));
      triggerToast(`BRANCH ${id} ERASED.`);
    }
  };

  const resetBranchForm = () => {
    setBranchForm({ id: '', name: '', location: '', status: 'Active' });
  };

  const handleSaveBranchA5 = () => {
    const branchId = branchForm.id || branchForm.branchCode || `BR-${Date.now().toString().slice(-5)}`;
    const isNewBranch = !branches.some((branch) => branch.id.toUpperCase() === branchId.toUpperCase());
    if (isNewBranch && limitReached(branches.length, 'maxBranches')) {
      triggerToast(limitMessage('Branch'));
      return;
    }
    const nextBranch: BranchSetting = {
      ...branchForm,
      id: branchId.toUpperCase(),
      branchCode: (branchForm.branchCode || branchId).toUpperCase(),
      name: branchForm.name || branchForm.branchCode || 'New Branch',
      location: branchForm.location || [branchForm.cityTown, branchForm.district].filter(Boolean).join(', ') || 'Unassigned',
      vendorId: branchForm.vendorId || businessProfile.vendorId || getActiveVendorId(),
      createdByStaffId: activeOperatorName,
      createdAt: branchForm.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onUpdateBranches([...branches.filter((b) => b.id !== nextBranch.id), nextBranch]);
    triggerToast('BRANCH_CREATED');
    setBranchA5Open(false);
    resetBranchForm();
  };

  // --- SUB-FORM 3: WAREHOUSES STATES ---
  const [warehouseForm, setWarehouseForm] = useState<WarehouseSetting>({ id: '', name: '', branchId: '' });
  const [isEditingWarehouse, setIsEditingWarehouse] = useState(false);
  const [warehouseA5Open, setWarehouseA5Open] = useState(false);
  const handleAddOrEditWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.id || !warehouseForm.name || !warehouseForm.branchId) {
      alert("COMPLETE WAREHOUSE CODES, ASSOCIATED BRANCH, AND DESCRIPTION.");
      return;
    }
    const existsIdx = warehouses.findIndex(w => w.id.toUpperCase() === warehouseForm.id.toUpperCase());
    if (isEditingWarehouse) {
      onUpdateWarehouses(warehouses.map(w => w.id.toUpperCase() === warehouseForm.id.toUpperCase() ? warehouseForm : w));
      triggerToast(`WAREHOUSE ${warehouseForm.id} RE-DESIGNATED.`);
      setIsEditingWarehouse(false);
    } else {
      if (existsIdx !== -1) {
        alert("DUPLICATE ERROR: WAREHOUSE ID ALREADY IN USE.");
        return;
      }
      if (limitReached(warehouses.length, 'maxWarehouses')) {
        triggerToast(limitMessage('Warehouse'));
        return;
      }
      onUpdateWarehouses([...warehouses, warehouseForm]);
      triggerToast(`WAREHOUSE ${warehouseForm.id} PROVISIONED.`);
    }
    setWarehouseForm({ id: '', name: '', branchId: '' });
  };
  const handleEditWarehouseClick = (w: WarehouseSetting) => {
    setWarehouseForm(w);
    setIsEditingWarehouse(true);
  };
  const handleDeleteWarehouse = (id: string) => {
    if (confirm(`DELETE WAREHOUSE VAULT ${id}?`)) {
      onUpdateWarehouses(warehouses.filter(w => w.id !== id));
      triggerToast(`WAREHOUSE ${id} OFF-LINE UNMOUNTED.`);
    }
  };

  const resetWarehouseForm = () => {
    setWarehouseForm({ id: '', name: '', branchId: '', status: 'Active' });
  };

  const handleSaveWarehouseA5 = () => {
    const warehouseId = warehouseForm.id || warehouseForm.warehouseCode || `WH-${Date.now().toString().slice(-5)}`;
    const isNewWarehouse = !warehouses.some((warehouse) => warehouse.id.toUpperCase() === warehouseId.toUpperCase());
    if (isNewWarehouse && limitReached(warehouses.length, 'maxWarehouses')) {
      triggerToast(limitMessage('Warehouse'));
      return;
    }
    const nextWarehouse: WarehouseSetting = {
      ...warehouseForm,
      id: warehouseId.toUpperCase(),
      warehouseCode: (warehouseForm.warehouseCode || warehouseId).toUpperCase(),
      name: warehouseForm.name || warehouseForm.warehouseCode || 'New Warehouse',
      branchId: warehouseForm.branchId || branches[0]?.id || 'BR-HARARE',
      vendorId: warehouseForm.vendorId || businessProfile.vendorId || getActiveVendorId(),
      createdByStaffId: activeOperatorName,
      createdAt: warehouseForm.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    onUpdateWarehouses([...warehouses.filter((w) => w.id !== nextWarehouse.id), nextWarehouse]);
    triggerToast('WAREHOUSE_CREATED');
    setWarehouseA5Open(false);
    resetWarehouseForm();
  };

  // --- SUB-FORM 4: TERMINALS STATES ---
  const [terminalForm, setTerminalForm] = useState<TerminalSetting>({ id: '', name: '', branchId: '', type: 'HEAVY' });
  const [isEditingTerminal, setIsEditingTerminal] = useState(false);
  const handleAddOrEditTerminal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalForm.id || !terminalForm.name || !terminalForm.branchId) {
      alert("FILL IN ALL FIELDS INCLUDING TERMINAL ID, BRANCH PAIR AND LABEL.");
      return;
    }
    const existsIdx = terminals.findIndex(t => t.id.toUpperCase() === terminalForm.id.toUpperCase());
    if (isEditingTerminal) {
      onUpdateTerminals(terminals.map(t => t.id.toUpperCase() === terminalForm.id.toUpperCase() ? terminalForm : t));
      triggerToast(`REGISTER UNIT ${terminalForm.id} RECONFIGURED.`);
      setIsEditingTerminal(false);
    } else {
      if (existsIdx !== -1) {
        alert("DUPLICATE REJECTED: TERMINAL UNIT CODENAME ASSIGNED.");
        return;
      }
      if (limitReached(terminals.length, 'maxTerminals')) {
        triggerToast(limitMessage('Terminal'));
        return;
      }
      onUpdateTerminals([...terminals, terminalForm]);
      triggerToast(`REGISTER ${terminalForm.id} INSTANTIATED.`);
    }
    setTerminalForm({ id: '', name: '', branchId: '', type: 'HEAVY' });
  };
  const handleEditTerminalClick = (t: TerminalSetting) => {
    setTerminalForm(t);
    setIsEditingTerminal(true);
  };
  const handleDeleteTerminal = (id: string) => {
    if (confirm(`PURGE HARDWARE ADAPTER TERMINAL ${id}?`)) {
      onUpdateTerminals(terminals.filter(t => t.id !== id));
      triggerToast(`TERMINAL ${id} DISCONNECTED.`);
    }
  };

  // --- SUB-FORM 5: STAFF STATES ---
  const [staffForm, setStaffForm] = useState<StaffSetting>({ id: '', vendorId: '', branchId: '', staffCode: '', displayName: '', email: '', roleId: 'cashier', roleName: 'Cashier', pinHash: '', pinCode: '', status: 'active', assignedTerminalIds: [], createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' });
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [revealPassId, setRevealPassId] = useState<string | null>(null);
  const handleAddOrEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff) {
      triggerToast('You do not have permission to manage staff.');
      return;
    }
    if (!staffForm.id || !staffForm.displayName || !staffForm.email || !staffForm.branchId) {
      alert("ENSURE ALL CLERK ATTRIBUTES, KEYWAY PASSWORDS, AND WORK LOCATION ARE REGISTERED.");
      return;
    }
    const record = mapStaffSettingToStaffRecord(staffForm, { vendorId: activeVendorId });
    try {
      if (isEditingStaff) {
        await updateStaff(staffForm.id, {
          staffCode: record.staffCode,
          displayName: record.displayName,
          email: record.email,
          roleId: record.roleId,
          roleName: record.roleName,
          pinCode: record.pinCode,
          pinHash: record.pinHash,
          status: record.status,
          branchId: record.branchId,
          assignedTerminalIds: record.assignedTerminalIds,
          updatedBy: mirrorUpdatedBy
        }, mirrorUpdatedBy);
        await recordStaffAuditEvent({
          vendorId: activeVendorId,
          branchId: staffForm.branchId,
          staffId: staffForm.id,
          roleId: staffForm.roleId,
          eventType: 'STAFF_UPDATED',
          timestamp: new Date().toISOString(),
          metadata: { displayName: staffForm.displayName, roleName: staffForm.roleName }
        });
        triggerToast(`STAFF PROFILE FOR ${staffForm.displayName} COMMITTED.`);
        setIsEditingStaff(false);
      } else {
        await createStaff(record, mirrorUpdatedBy);
        await recordStaffAuditEvent({
          vendorId: activeVendorId,
          branchId: staffForm.branchId,
          staffId: record.id,
          roleId: record.roleId,
          eventType: 'STAFF_CREATED',
          timestamp: new Date().toISOString(),
          metadata: { displayName: record.displayName, roleName: record.roleName }
        });
        triggerToast(`CLERK ${staffForm.displayName} INDUCTED.`);
      }
      void syncStaffBusinessUserMirror(staffForm, activeVendorId, mirrorUpdatedBy);
      setStaffForm({ id: '', vendorId: '', branchId: '', staffCode: '', displayName: '', email: '', roleId: 'cashier', roleName: 'Cashier', pinHash: '', pinCode: '', status: 'active', assignedTerminalIds: [], createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' });
      void loadStaffFromDb();
      void onUpdateStaff([...staff, { ...staffForm, id: record.id }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save staff record.';
      triggerToast(message);
    }
  };
  const handleEditStaffClick = (s: StaffSetting) => {
    setStaffForm(s);
    setIsEditingStaff(true);
  };
  const handleDeleteStaff = async (id: string) => {
    if (!canManageStaff) {
      triggerToast('You do not have permission to manage staff.');
      return;
    }
    if (confirm(`REMOVE STAFF CLERK ${id} FROM ALL GATEWAY PROTOCOLS?`)) {
      try {
        await suspendStaff(id, mirrorUpdatedBy);
        const removed = staff.find(s => s.id === id);
        await recordStaffAuditEvent({
          vendorId: activeVendorId,
          branchId: removed?.branchId || '',
          staffId: id,
          roleId: removed?.roleId || '',
          eventType: 'STAFF_SUSPENDED',
          timestamp: new Date().toISOString(),
          metadata: { displayName: removed?.displayName || id }
        });
        if (removed) {
          void removeStaffBusinessUserMirror(removed, activeVendorId, mirrorUpdatedBy);
        }
        triggerToast(`CLERK ID ${id} SUSPENDED.`);
        void loadStaffFromDb();
        onUpdateStaff(staff.filter(s => s.id !== id));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to suspend staff.';
        triggerToast(message);
      }
    }
  };

  const openRetiredRolesNotice = () => {
    recordSecurityMatrixEvent({
      eventType: 'ROLES_PERMISSIONS_RETIRED',
      label: 'Roles & Permissions Retired',
      message: 'The retired Roles & Permissions panel was opened. Staff Access Rights is the active permission control centre.'
    });
    setActiveSection('ROLES');
    triggerToast('Roles & Permissions has been retired. Use Staff Access Rights.');
  };
  const retiredRolePreviewRows: string[] = [];
  const retiredMenuPreviewRows: { id: string; label: string }[] = [];
  const retiredPermissionPreview: Record<string, string[]> = {};
  const retiredPermissionToggle = () => openRetiredRolesNotice();

  // --- SUB-FORM 7: HARDWARE SETTINGS STATES ---
  const [hardForm, setHardForm] = useState<HardwareSetting>({ ...hardwareSetting });
  const handleSaveHardware = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeRole && !hasPermission(activeRole as Role, 'hardware.configure')) {
      triggerToast('You do not have permission to perform this action.');
      return;
    }
    onUpdateHardwareSetting(hardForm);
    // Sync other components
    triggerToast("Hardware and device settings saved.");
  };

  // --- SUB-FORM 8: TAX & VAT STATE ---
  const [taxForm, setTaxForm] = useState<TaxSetting>({ ...taxSetting });
  const handleSaveTax = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTaxSetting(taxForm);
    triggerToast("FINANCIAL GL BALANCE LEDGER TAX RATIO ADJUSTED.");
  };

  // --- SUB-FORM 9: RECEIPT SETTING STATE ---
  const [recForm, setRecForm] = useState<ReceiptSetting>({ ...receiptSetting });
  const receiptLayouts: NonNullable<ReceiptSetting['layout']>[] = ['Thermal Receipt Roll', 'A4 Portrait', 'A4 Landscape', 'Legal', 'Letter', 'Custom Layout'];
  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRecForm((current) => ({ ...current, logoDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };
  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    const nextReceipt = {
      ...recForm,
      header: recForm.headerMessage || recForm.header,
      footer: recForm.footerMessage || recForm.footer,
      contactInformation: recForm.contactNumbers || recForm.contactInformation,
      socialMediaInformation: recForm.socialMediaHandles || recForm.socialMediaInformation
    };
    onUpdateReceiptSetting(nextReceipt);
    // Sync the older props
    onUpdateReceiptHeader(nextReceipt.header);
    triggerToast("RECEIPT BLUEPRINT CONFIGURATION SAVED.");
  };

  const [checkSettings, setCheckSettings] = useState<CheckWriterSettings | null>(null);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialControlAccount[]>([]);
  const [nextCheckPreview, setNextCheckPreview] = useState('');

  useEffect(() => {
    void Promise.all([getCheckWriterSettings(), getFinancialControlAccounts()]).then(([settings, accounts]) => {
      setCheckSettings(settings);
      setFinancialAccounts(accounts.filter((account) => account.active && ['Bank', 'Cash', 'MobileMoney'].includes(account.accountType)));
      setNextCheckPreview(previewNumber(settings));
    });
  }, []);

  useEffect(() => {
    if (activeSection === 'STAFF' && activeVendorId) {
      void loadStaffFromDb();
    }
  }, [activeSection, activeVendorId]);

  const saveCheckSettings = () => {
    if (!checkSettings) return;
    if (activeRole && !hasPermission(activeRole as Role, 'financialControl.checkSettings.manage')) {
      triggerToast('You do not have permission to perform this action.');
      return;
    }
    if (checkSettings.nextChequeNumber <= 0) {
      triggerToast('Next cheque number must be greater than zero.');
      return;
    }
    void updateCheckWriterSettings(checkSettings, activeOperatorName || 'Settings').then((settings) => {
      setCheckSettings(settings);
      setNextCheckPreview(previewNumber(settings));
      triggerToast('CHECK_WRITER_SETTINGS_UPDATED');
    });
  };

  const resetCheckSettings = () => {
    void updateCheckWriterSettings({
      chequePrefix: 'CHQ',
      nextChequeNumber: 1,
      chequeNumberPadding: 6,
      requireApprovalAboveAmount: true,
      approvalThresholdAmount: 500,
      allowManualChequeNumber: false,
      printBusinessName: true,
      printPayeeLine: true,
      printAmountInWords: true,
      printMemo: true
    }, activeOperatorName || 'Settings').then((settings) => {
      setCheckSettings(settings);
      setNextCheckPreview(previewNumber(settings));
      triggerToast('CHECK_WRITER_SETTINGS_RESET');
    });
  };

  // --- SUB-FORM 10: HARD SHUTDOWN SYSTEM ---
  const handleResetClick = () => {
    if (confirm("WARNING: CRITICAL DESTRUCTOR ACTION INITIALIZED. ALL VOLATILE WORKSTATIONS AND PRODUCTS RESTORE TO BIOS PRESETS. PROCEED?")) {
      onResetAllState();
      triggerToast("FACTORY SECTOR RESETS CONFIRMED.");
      alert("LOCAL CACHE ERADICATED. SYSTEM BOOTED FRESH.");
    }
  };

  // Mapped sub-panels for clean execution selection
  const sidebarNavItems = [
    { id: 'BUSINESS_PROFILE' as const, label: 'Business Profile', icon: Building, color: 'text-indigo-400' },
    { id: 'SUBSCRIPTION' as const, label: 'Subscription', icon: Layers, color: 'text-orange-500' },
    { id: 'BRANCHES' as const, label: 'Branches Registry', icon: MapPin, color: 'text-[#00f0ff]' },
    { id: 'WAREHOUSES' as const, label: 'Warehouses Hub', icon: Package, color: 'text-purple-400' },
    { id: 'TERMINALS' as const, label: 'Terminal Registry', icon: Terminal, color: 'text-amber-500' },
    { id: 'STAFF' as const, label: 'Staff Database', icon: Users, color: 'text-emerald-400' },
    { id: 'ROLES' as const, label: 'Roles & Permissions - retired', icon: ShieldCheck, color: 'text-slate-500', retired: true },
    { id: 'HARDWARE' as const, label: 'Hardware Config', icon: Cpu, color: 'text-orange-400' },
    { id: 'TAX' as const, label: 'Tax & VAT Settings', icon: Percent, color: 'text-rose-450' },
    { id: 'RECEIPT' as const, label: 'Receipt Blueprint', icon: Receipt, color: 'text-pink-400' },
    { id: 'CHECK_WRITER_SETTINGS' as const, label: 'Check Writer Settings', icon: Receipt, color: 'text-orange-500' },
    { id: 'STAFF_ACCESS_RIGHTS' as const, label: 'Staff Access Rights', icon: ShieldCheck, color: 'text-orange-500' },
    { id: 'BUILD_STATUS' as const, label: 'Build Status', icon: Info, color: 'text-orange-500' },
    { id: 'STAFF_MIRROR_DIAGNOSTICS' as const, label: 'Staff Mirror Diagnostics', icon: Cpu, color: 'text-orange-500' },
    { id: 'RESET' as const, label: 'System Maintenance', icon: AlertTriangle, color: 'text-red-500 font-extrabold' },
  ].filter((item) => SHOW_DEV_BADGES || (item.id !== 'BUILD_STATUS' && item.id !== 'RESET'));

  const hardwareDevices = [
    { deviceName: 'Cash Drawer', connectionType: hardForm.drawerSignal, status: 'Ready', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Receipt Printer', connectionType: 'USB / Network', status: 'Not Connected', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Barcode Scanner', connectionType: 'USB HID', status: 'Ready', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Laser Scanner', connectionType: hardForm.laserFocus, status: 'Ready', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Customer Display', connectionType: 'USB / Serial', status: 'Not Connected', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'USB Camera', connectionType: 'USB Camera', status: 'Not Connected', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Fiscal Device', connectionType: 'Not Connected', status: 'Not Configured', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' },
    { deviceName: 'Terminal Device Settings', connectionType: terminalUnit, status: 'Configured', lastTest: 'Not tested', permissionRequired: 'Hardware Manager' }
  ];

  const canConfigureHardware = activeRole ? hasPermission(activeRole as Role, 'hardware.configure') : false;
  const handleHardwareDeviceAction = (label: string) => {
    if (!canConfigureHardware) {
      triggerToast('You do not have permission to perform this action.');
      return;
    }
    triggerToast(`${label} queued.`);
  };

  return (
    <div className="space-y-6 select-none industrial-font-sans text-xs" id="pos-admin-settings-panel">
      
      {/* SECTION TOP HEADER BAR */}
      <div className="p-4 bg-slate-950 border border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-[10px] text-slate-500 uppercase font-mono tracking-widest flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#00f0ff]" />
            Settings
          </div>
          <h2 className="text-base font-extrabold font-mono text-white mt-1 uppercase">iTred Commerce POS Settings</h2>
        </div>
        <p className="text-[10px] text-slate-550 font-mono max-w-sm uppercase leading-relaxed text-right">
          Manage business profile, branches, staff, receipts, taxes, permissions, and terminal devices.
        </p>
      </div>

      {/* TOAST SUCCESS NOTIFIER */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-950/80 border border-emerald-500/60 text-emerald-400 font-mono tracking-wider font-bold uppercase rounded-none text-center animate-pulse"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN NESTED LAYOUT BOX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SUB SIDEBAR CONFIG MENU (4 columns) */}
        <div className="lg:col-span-3 bg-[#1e222b] border border-[#3a3f4b] p-2 space-y-0.5">
          <div className="text-[10px] text-slate-100 font-bold font-mono py-1 px-2.5 uppercase tracking-wider border-b border-slate-600 flex items-center justify-between mb-2">
            <span>Settings Menu</span>
            {SHOW_DEV_BADGES && <span className="text-[9px] bg-orange-600 px-1 py-0.2 text-white">Local</span>}
          </div>

          <div className="space-y-1">
            {sidebarNavItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if ('retired' in item && item.retired) {
                      openRetiredRolesNotice();
                      return;
                    }
                    if (item.id === 'STAFF_ACCESS_RIGHTS') {
                      recordSecurityMatrixEvent({
                        eventType: 'STAFF_ACCESS_RIGHTS_OPENED',
                        label: 'Staff Access Rights Opened',
                        message: 'Staff Access Rights opened from Settings.'
                      });
                      recordSecurityMatrixEvent({
                        eventType: 'STAFF_ACCESS_RIGHTS_SET_AS_PRIMARY',
                        label: 'Staff Access Rights Set As Primary',
                        message: 'Staff Access Rights is the active permission management area.'
                      });
                    }
                    setActiveSection(item.id);
                    // Clear intermediate forms
                    setIsEditingBranch(false);
                    setIsEditingWarehouse(false);
                    setIsEditingTerminal(false);
                    setIsEditingStaff(false);
                    setBranchForm({ id: '', name: '', location: '' });
                    setWarehouseForm({ id: '', name: '', branchId: '' });
                    setTerminalForm({ id: '', name: '', branchId: '', type: 'HEAVY' });
                    setStaffForm({ id: '', name: '', email: '', role: 'Cashier', pass: '', branchId: '' });
                  }}
                  className={`w-full text-left py-2 px-3 flex items-center justify-between transition-all text-[11px] rounded-none border-l-2 font-mono outline-none cursor-pointer ${
                    isActive 
                      ? 'bg-white text-[#1e222b] font-bold border-orange-600'
                      : 'retired' in item && item.retired
                        ? 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-900'
                        : 'border-transparent text-[#e7edf0] hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-600' : 'text-[#b8c2c7]'}`} />
                    <span className="uppercase tracking-wide">{item.label}</span>
                  </div>
                  <ChevronRight size={10} className={isActive ? 'text-orange-600' : 'text-[#b8c2c7]'} />
                </button>
              );
            })}
          </div>

          {SHOW_DEV_BADGES && (
            <div className="p-3 bg-slate-950 border border-slate-700 mt-4 text-[9px] space-y-1 text-slate-200 font-mono uppercase">
              <div>Product: <span className="text-orange-400">iTred Commerce POS</span></div>
              <div>Mode: <span className="text-slate-100">Diagnostics</span></div>
              <div>Backend: <span className="text-slate-100">Local Services</span></div>
              <div>Firebase: <span className="text-slate-100">Config Shell</span></div>
              <div>Business Writes: <span className="text-orange-400">Disabled</span></div>
            </div>
          )}
        </div>

        {/* DETAILS WORKSPACE FORMS (9 columns) */}
        <div className="lg:col-span-9 bg-[#141822] border border-slate-700 p-6 rounded-none min-h-[35rem] flex flex-col justify-between font-mono">
          
          {/* CONTENT SECTOR SWITCHER */}
          <div className="space-y-6 flex-1">

            {activeSection === 'SUBSCRIPTION' && (
              <SubscriptionCommercePage
                businessProfile={businessProfile}
                vendorAuth={readPosAuthContext()}
                planAccess={planAccess}
                onToast={triggerToast}
              />
            )}

            {/* TAB 1: BUSINESS PROFILE */}
            {activeSection === 'BUSINESS_PROFILE' && (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Building className="w-4 h-4 text-indigo-400" />
                    BUSINESS ENTERPRISE PROFILE
                  </span>
                  <span className="text-[9px] text-[#00f0ff] uppercase bg-slate-950 px-1 border border-slate-900">SECURE PROFILE</span>
                </div>

                <p className="text-[10px] text-slate-300 uppercase mb-4 leading-normal">
                  Configure business identity, registration, tax, owner, accountant, and administrator details. Registration details are shown only where permissions allow.
                </p>

                {profileErrors.length > 0 && <ValidationList title="Validation Errors" items={profileErrors} tone="error" />}
                {profileWarnings.length > 0 && <ValidationList title="Warnings" items={profileWarnings} tone="warning" />}

                <SettingsFormSection title="Basic Business Identity">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SettingsTextField label="Business Name" value={profileForm.businessName || ''} onChange={(value) => setProfileForm({ ...profileForm, businessName: value, legalName: value || profileForm.legalName })} />
                    <SettingsTextField label="Trading Name" value={profileForm.tradingName || ''} onChange={(value) => setProfileForm({ ...profileForm, tradingName: value })} />
                    <label className="block text-slate-600 text-[10px] uppercase font-bold">Business Type<select value={profileForm.businessType || 'Private Company'} onChange={(e) => setProfileForm({ ...profileForm, businessType: e.target.value })} className="w-full bg-white border border-[#b1b5c2] p-2 text-[#1e222b] text-xs outline-none"><option>Private Company</option><option>Partnership</option><option>Sole Proprietor</option><option>Cooperative</option><option>Government</option><option>Retail and Wholesale</option></select></label>
                    <SettingsTextField label="Industrial Sector" value={profileForm.industrialSector || ''} onChange={(value) => setProfileForm({ ...profileForm, industrialSector: value })} />
                    <SettingsTextField label="City / Town" value={profileForm.cityTown || ''} onChange={(value) => setProfileForm({ ...profileForm, cityTown: value })} />
                    <SettingsTextField label="District / Suburb" value={profileForm.districtSuburb || [profileForm.district, profileForm.suburb].filter(Boolean).join(' / ')} onChange={(value) => setProfileForm({ ...profileForm, districtSuburb: value, district: value })} />
                    <label className="block text-slate-600 text-[10px] uppercase font-bold">Base Currency<select value={profileForm.currency} onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })} className="w-full bg-white border border-[#b1b5c2] p-2 text-[#1e222b] text-xs outline-none"><option value="USD">USD ($)</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="AUD">AUD</option></select></label>
                    <SettingsTextField label="Headquarters Address" value={profileForm.address} onChange={(value) => setProfileForm({ ...profileForm, address: value })} />
                    <div className="text-[10px] text-emerald-800 uppercase font-black border border-emerald-300 bg-emerald-50 p-2">Status: {profileForm.profileStatus || profileForm.businessStatus || 'Active'}</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#d6d9e0]">
                    <SettingsCheckbox label="Registered Business" checked={!!(profileForm.isRegisteredBusiness || profileForm.isBusinessRegistered)} onChange={(checked) => setProfileForm({ ...profileForm, isRegisteredBusiness: checked, isBusinessRegistered: checked })} />
                    <SettingsCheckbox label="VAT Registered" checked={!!profileForm.vatRegistered} onChange={(checked) => setProfileForm({ ...profileForm, vatRegistered: checked })} />
                    <SettingsCheckbox label="Tax Registered / Tax Collector" checked={!!(profileForm.taxCollector || profileForm.isTaxCollector)} onChange={(checked) => setProfileForm({ ...profileForm, taxCollector: checked, isTaxCollector: checked })} />
                  </div>
                </SettingsFormSection>

                {(profileForm.isRegisteredBusiness || profileForm.isBusinessRegistered) && (
                  <SettingsFormSection title="Business Registration Details">
                    <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-950 font-bold uppercase">
                      Registration details are used for receipts, tax readiness, audit references, and dashboard visibility where permission allows.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <SettingsTextField label="Registered Business Name" value={profileForm.registeredBusinessName || ''} onChange={(value) => setProfileForm({ ...profileForm, registeredBusinessName: value, legalName: value || profileForm.legalName })} />
                      <SettingsTextField label="Company Registration Number" value={profileForm.companyRegistrationNumber || ''} onChange={(value) => setProfileForm({ ...profileForm, companyRegistrationNumber: value, regNo: value || profileForm.regNo })} />
                      <SettingsTextField label="Trade Certificate Registration Number" value={profileForm.tradeCertificateRegistrationNumber || profileForm.regNo || ''} onChange={(value) => setProfileForm({ ...profileForm, tradeCertificateRegistrationNumber: value, regNo: value || profileForm.regNo })} />
                      <SettingsTextField label="Date of Registration" type="date" value={profileForm.registrationDate || ''} onChange={(value) => setProfileForm({ ...profileForm, registrationDate: value })} />
                      <SettingsTextField label="Place of Registration" value={profileForm.registrationPlace || ''} onChange={(value) => setProfileForm({ ...profileForm, registrationPlace: value })} />
                      <SettingsTextField label="Owner Full Name" value={profileForm.ownerFullName || ''} onChange={(value) => setProfileForm({ ...profileForm, ownerFullName: value })} />
                      <SettingsTextField label="Owner National ID" value={profileForm.ownerNationalId || profileForm.ownerNationalIdPlaceholder || ''} onChange={(value) => setProfileForm({ ...profileForm, ownerNationalId: value, ownerNationalIdPlaceholder: value })} />
                      <SettingsTextField label="Owner Contact" value={profileForm.ownerContact || profileForm.ownerPhone || ''} onChange={(value) => setProfileForm({ ...profileForm, ownerContact: value, ownerPhone: value })} />
                    </div>
                  </SettingsFormSection>
                )}

                {(profileForm.vatRegistered || profileForm.taxCollector || profileForm.isTaxCollector) && (
                  <SettingsFormSection title="Tax and VAT Details">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {profileForm.vatRegistered && <SettingsTextField label="VAT Number" value={profileForm.vatNumber || ''} onChange={(value) => setProfileForm({ ...profileForm, vatNumber: value, taxNo: value || profileForm.taxNo })} />}
                      {(profileForm.taxCollector || profileForm.isTaxCollector) && <SettingsTextField label="Tax Registration Number" value={profileForm.taxRegistrationNumber || profileForm.taxIdentificationNumber || ''} onChange={(value) => setProfileForm({ ...profileForm, taxRegistrationNumber: value, taxIdentificationNumber: value })} />}
                      {(profileForm.taxCollector || profileForm.isTaxCollector) && <SettingsTextField label="Tax Collector Type" value={profileForm.taxCollectorType || ''} onChange={(value) => setProfileForm({ ...profileForm, taxCollectorType: value })} />}
                    </div>
                  </SettingsFormSection>
                )}

                <SettingsFormSection title="Accountant / Business Administrator">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SettingsTextField label="Accountant Name" value={profileForm.accountantName || ''} onChange={(value) => setProfileForm({ ...profileForm, accountantName: value })} />
                    <SettingsTextField label="Accountant Phone" value={profileForm.accountantPhone || ''} onChange={(value) => setProfileForm({ ...profileForm, accountantPhone: value })} />
                    <SettingsTextField label="Accountant Email" type="email" value={profileForm.accountantEmail || ''} onChange={(value) => setProfileForm({ ...profileForm, accountantEmail: value })} />
                    <SettingsTextField label="Business Administrator Name" value={profileForm.businessAdministratorName || ''} onChange={(value) => setProfileForm({ ...profileForm, businessAdministratorName: value })} />
                    <SettingsTextField label="Business Administrator Phone" value={profileForm.businessAdministratorPhone || ''} onChange={(value) => setProfileForm({ ...profileForm, businessAdministratorPhone: value })} />
                    <SettingsTextField label="Business Administrator Email" type="email" value={profileForm.administratorEmail || ''} onChange={(value) => setProfileForm({ ...profileForm, administratorEmail: value })} />
                  </div>
                </SettingsFormSection>

                <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[10px] text-slate-700 font-bold uppercase">
                  Dashboard visibility is permission-aware. Registration details require businessRegistration.dashboardView; users without that right see only basic business identity.
                </div>

                {false && (
                  <>
                  <div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Company Registration No</label>
                      <input
                        type="text"
                        value={profileForm.companyRegistrationNumber || ''}
                        onChange={e => setProfileForm({ ...profileForm, companyRegistrationNumber: e.target.value, regNo: e.target.value || profileForm.regNo })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">VAT Number</label>
                      <input
                        type="text"
                        value={profileForm.vatNumber || ''}
                        onChange={e => setProfileForm({ ...profileForm, vatNumber: e.target.value, taxNo: e.target.value || profileForm.taxNo })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Tax Collector Type</label>
                      <input
                        type="text"
                        value={profileForm.taxCollectorType || ''}
                        onChange={e => setProfileForm({ ...profileForm, taxCollectorType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Owner Full Name</label>
                      <input
                        type="text"
                        value={profileForm.ownerFullName || ''}
                        onChange={e => setProfileForm({ ...profileForm, ownerFullName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Owner National ID</label>
                      <input
                        type="text"
                        value={profileForm.ownerNationalId || ''}
                        onChange={e => setProfileForm({ ...profileForm, ownerNationalId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Owner Contact</label>
                      <input
                        type="text"
                        value={profileForm.ownerPhone || ''}
                        onChange={e => setProfileForm({ ...profileForm, ownerPhone: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">CORPORATE REGISTERED NAME</label>
                    <input 
                      type="text" 
                      value={profileForm.legalName}
                      onChange={e => setProfileForm({ ...profileForm, legalName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">VAT / TAX REGL ID</label>
                    <input 
                      type="text" 
                      value={profileForm.taxNo}
                      onChange={e => setProfileForm({ ...profileForm, taxNo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">TRADE CERTIFICATE REG NO</label>
                    <input 
                      type="text" 
                      value={profileForm.regNo}
                      onChange={e => setProfileForm({ ...profileForm, regNo: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">BASE EXPENDITURE CURRENCY</label>
                    <select
                      value={profileForm.currency}
                      onChange={e => setProfileForm({ ...profileForm, currency: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-200 text-xs outline-none"
                    >
                      <option value="USD">USD ($) - AMERICAN DOLLAR</option>
                      <option value="EUR">EUR (€) - EURO DIRECT</option>
                      <option value="GBP">GBP (£) - GREAT BRITISH POUND</option>
                      <option value="AUD">AUD ($) - AUSTRALIAN DOLLAR</option>
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">HEADQUARTERS REGISTRY ADDRESS</label>
                    <textarea 
                      value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff] resize-none"
                      required
                    />
                  </div>
                </div>
                  </>
                )}

                <div className="pt-3 border-t border-slate-900">
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider px-6 py-2.5 rounded-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    SAVE PROFILE BLOCK DIRECTORY
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: BRANCHES REGISTRY */}
            {activeSection === 'BRANCHES' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00f0ff]" />
                    BRANCHES METRIC REGISTRY [{branches.length} UNITS]
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetBranchForm();
                        setBranchA5Open(true);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-[9px] font-black uppercase flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" />
                      A5 Branch Form
                    </button>
                    <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-emerald-400">ONLINE REGISTER</span>
                  </div>
                </div>

                {/* Branch Entry Form */}
                <form onSubmit={handleAddOrEditBranch} className="p-4 bg-slate-950 border border-slate-900 space-y-3">
                  <div className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider">
                    {isEditingBranch ? '🔧 RE-ALIGN SECURE BRANCH NODE' : '➕ PROVISION FRESH BRANCH NODE'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">BRANCH ID CODE</label>
                      <input 
                        type="text" 
                        value={branchForm.id}
                        onChange={e => setBranchForm({ ...branchForm, id: e.target.value.toUpperCase() })}
                        disabled={isEditingBranch}
                        placeholder="e.g. BR-DET-3"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-[#00f0ff] disabled:text-slate-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">BRANCH DESCRIPTIVE NAME</label>
                      <input 
                        type="text" 
                        value={branchForm.name}
                        onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}
                        placeholder="e.g. DETROIT SMELTER"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">GEOGRAPHIC LOCATION</label>
                      <input 
                        type="text" 
                        value={branchForm.location}
                        onChange={e => setBranchForm({ ...branchForm, location: e.target.value })}
                        placeholder="e.g. Detroit, MI"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-300 focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold uppercase tracking-wider px-4 py-2 text-[10px] rounded-none cursor-pointer flex items-center gap-1.5"
                    >
                      {isEditingBranch ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{isEditingBranch ? 'SAVE AMENDMENTS' : 'INDUCT REGISTER NODE'}</span>
                    </button>
                    {isEditingBranch && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingBranch(false);
                          setBranchForm({ id: '', name: '', location: '' });
                        }}
                        className="bg-slate-800 text-slate-400 py-2 px-4 hover:bg-slate-700 uppercase font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Branch list table */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Active Branch Locations</div>
                  <div className="border border-slate-800 divide-y divide-slate-950">
                    {branches.map(b => (
                      <div key={b.id} className="p-3 bg-slate-950/60 flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[#00f0ff] font-bold">{b.id}</span>
                            <span className="text-white font-bold">{b.name}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 uppercase mt-0.5">LOCATION: {b.location}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleEditBranchClick(b)}
                            className="p-1 px-2 border border-slate-800 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-900 hover:border-[#00f0ff] cursor-pointer text-[10px]"
                          >
                            <Edit size={12} className="inline mr-1" /> EDIT
                          </button>
                          <button
                            onClick={() => handleDeleteBranch(b.id)}
                            className="p-1 px-2 border border-slate-800 text-rose-500 hover:text-white hover:bg-rose-950 cursor-pointer text-[10px]"
                          >
                            <Trash2 size={12} className="inline mr-1" /> DELETE
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: WAREHOUSES HUB */}
            {activeSection === 'WAREHOUSES' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-purple-400" />
                    WAREHOUSES HUB INVENTORY ARCHIVE [{warehouses.length} HUBS]
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        resetWarehouseForm();
                        setWarehouseA5Open(true);
                      }}
                      className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-[9px] font-black uppercase flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3" />
                      A5 Warehouse Form
                    </button>
                    <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-[#00f0ff]">SECURES YARD ARRAYS</span>
                  </div>
                </div>

                {/* Warehouse input Form */}
                <form onSubmit={handleAddOrEditWarehouse} className="p-4 bg-slate-950 border border-slate-900 space-y-3">
                  <div className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider">
                    {isEditingWarehouse ? '🔧 RE-DESIGNATE STORAGE BLOCK' : '📦 REGISTER STORAGE DEPOSITORY UNIT'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">WAREHOUSE ID</label>
                      <input 
                        type="text" 
                        value={warehouseForm.id}
                        onChange={e => setWarehouseForm({ ...warehouseForm, id: e.target.value.toUpperCase() })}
                        disabled={isEditingWarehouse}
                        placeholder="e.g. WH-DET-01"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-purple-400 disabled:text-slate-550"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">DEPOT CODE / IDENTIFIER NAME</label>
                      <input 
                        type="text" 
                        value={warehouseForm.name}
                        onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                        placeholder="e.g. AISLE 4 SHELF B LOCKERS"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">DESIGNATED RECEPTACLE BRANCH</label>
                      <select
                        value={warehouseForm.branchId}
                        onChange={e => setWarehouseForm({ ...warehouseForm, branchId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-350"
                        required
                      >
                        <option value="">-- CHOOSE TARGET BRANCH --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wider px-4 py-2 text-[10px] rounded-none cursor-pointer flex items-center gap-1.5"
                    >
                      {isEditingWarehouse ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{isEditingWarehouse ? 'SAVE DEPOSITORY CODE' : 'INDUCT DEPOSITORY UNIT'}</span>
                    </button>
                    {isEditingWarehouse && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingWarehouse(false);
                          setWarehouseForm({ id: '', name: '', branchId: '' });
                        }}
                        className="bg-slate-800 text-slate-400 py-2 px-4 hover:bg-slate-700 uppercase font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Warehouse catalog table */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">INTEGRATED COLD LOCKERS & STORAGE CELLS</div>
                  <div className="border border-slate-800 divide-y divide-slate-950">
                    {warehouses.map(w => {
                      const associatedBranchName = branches.find(b => b.id === w.branchId)?.name || 'UNKNOWN PARENT';
                      return (
                        <div key={w.id} className="p-3 bg-slate-950/60 flex justify-between items-center text-xs font-mono">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400 font-bold">{w.id}</span>
                              <span className="text-slate-200 font-bold">{w.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase mt-0.5">HOVER NODE LINKED: {associatedBranchName} ({w.branchId})</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleEditWarehouseClick(w)}
                              className="p-1 px-2 border border-slate-850 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-900 cursor-pointer text-[10px]"
                            >
                              <Edit size={12} className="inline mr-1" /> EDIT
                            </button>
                            <button
                              onClick={() => handleDeleteWarehouse(w.id)}
                              className="p-1 px-2 border border-slate-850 text-rose-500 hover:text-white hover:bg-rose-950 cursor-pointer text-[10px]"
                            >
                              <Trash2 size={12} className="inline mr-1" /> DELETE
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TERMINAL REGISTRY */}
            {activeSection === 'TERMINALS' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-amber-500" />
                    TERMINAL ADAPTER DIRECTORY REGISTER [{terminals.length} NODES]
                  </span>
                  <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-[#00f0ff]">COMM CHANNELS DIRECT</span>
                </div>

                {/* Terminals Input Form */}
                <form onSubmit={handleAddOrEditTerminal} className="p-4 bg-slate-950 border border-slate-900 space-y-3">
                  <div className="text-[10px] font-bold text-[#00f0ff] uppercase tracking-wider font-mono">
                    {isEditingTerminal ? '🔧 VERIFY WORKSTATION TERMINAL ID' : '🖥️ ADD HARDWARE REGISTER SYSTEM'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">TERMINAL ADDR ID</label>
                      <input 
                        type="text" 
                        value={terminalForm.id}
                        onChange={e => setTerminalForm({ ...terminalForm, id: e.target.value.toUpperCase() })}
                        disabled={isEditingTerminal}
                        placeholder="e.g. TERM-GARY-A"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-amber-400 disabled:text-slate-550"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">ADAPTER LABEL NAME</label>
                      <input 
                        type="text" 
                        value={terminalForm.name}
                        onChange={e => setTerminalForm({ ...terminalForm, name: e.target.value })}
                        placeholder="e.g. REG-04 (SHIPPING)"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">DESIGNATED PLACEMENT BRANCH</label>
                      <select
                        value={terminalForm.branchId}
                        onChange={e => setTerminalForm({ ...terminalForm, branchId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-350"
                        required
                      >
                        <option value="">-- CHOOSE BRANCH LINK --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name} ({b.id})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">CHASSIS CLASS CODE</label>
                      <select
                        value={terminalForm.type}
                        onChange={e => setTerminalForm({ ...terminalForm, type: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-300"
                      >
                        <option value="HEAVY">HEAVY IN-YARD TERMINAL</option>
                        <option value="LIGHT">LIGHT CORES TOUCHPAD</option>
                        <option value="OFFICE">BACK OFFICE CONSOLE</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black uppercase tracking-wider px-4 py-2 text-[10px] rounded-none cursor-pointer flex items-center gap-1.5"
                    >
                      {isEditingTerminal ? <Save className="w-3 h-3 text-slate-950" /> : <Plus className="w-3 h-3 text-slate-950" />}
                      <span>{isEditingTerminal ? 'COMMIT UNIT CODES' : 'ACTIVATE WORKSTATION'}</span>
                    </button>
                    {isEditingTerminal && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTerminal(false);
                          setTerminalForm({ id: '', name: '', branchId: '', type: 'HEAVY' });
                        }}
                        className="bg-slate-800 text-slate-400 py-2 px-4 hover:bg-slate-700 uppercase font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Terminals list list */}
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">Active Terminal Devices</div>
                  <div className="border border-slate-800 divide-y divide-slate-950 font-mono">
                    {terminals.map(t => {
                      const branchMapped = branches.find(b => b.id === t.branchId)?.name || 'UNKNOWN CONDUIT';
                      return (
                        <div key={t.id} className="p-3 bg-slate-950/60 flex justify-between items-center text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500 font-bold">{t.id}</span>
                              <span className="text-white font-bold">{t.name}</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-[#00f0ff] px-1 font-bold">{t.type}</span>
                            </div>
                            <div className="text-[10px] text-slate-550 uppercase mt-0.5">LOCATION BASE: {branchMapped} ({t.branchId})</div>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleEditTerminalClick(t)}
                              className="p-1 px-2 border border-slate-850 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-900 cursor-pointer text-[10px]"
                            >
                              <Edit size={12} className="inline mr-1" /> EDIT
                            </button>
                            <button
                              onClick={() => handleDeleteTerminal(t.id)}
                              className="p-1 px-2 border border-slate-850 text-rose-500 hover:text-white hover:bg-rose-950 cursor-pointer text-[10px]"
                            >
                              <Trash2 size={12} className="inline mr-1" /> PURGE
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: STAFF DATABASE */}
            {activeSection === 'STAFF' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-400" />
                    STAFF CLERK DIRECTORY ENGINE [{staffDbList.length} ID CARDS]
                  </span>
                  <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-[#00f0ff]">LOCKOUT SAFEGUARD ON</span>
                </div>

                {!canManageStaff && (
                  <div className="bg-rose-950/40 border border-rose-800 p-3 text-rose-400 text-[10px] uppercase tracking-wider">
                    ACCESS RESTRICTED: Only Owner, SysAdmin, Manager, or Supervisor may induct or edit staff.
                  </div>
                )}

                {/* Staff register form */}
                <form onSubmit={handleAddOrEditStaff} className={`p-4 bg-slate-950 border border-slate-900 space-y-3 ${!canManageStaff ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                    {isEditingStaff ? '🔧 EDIT ASSIGNED USER PERMISSION METRICS' : '👥 INDUCT SECURITY ENVELOPE OPERATOR'}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">CLERK ID/RFID SLOT</label>
                      <input
                        type="text"
                        value={staffForm.id}
                        onChange={e => setStaffForm({ ...staffForm, id: e.target.value.toUpperCase() })}
                        disabled={isEditingStaff}
                        placeholder="e.g. ST-092"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-[#00f0ff] disabled:text-slate-550"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">STAFF CODE</label>
                      <input
                        type="text"
                        value={staffForm.staffCode}
                        onChange={e => setStaffForm({ ...staffForm, staffCode: e.target.value.toUpperCase() })}
                        placeholder="e.g. OP-001"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">LEGAL FULL NAME</label>
                      <input
                        type="text"
                        value={staffForm.displayName}
                        onChange={e => setStaffForm({ ...staffForm, displayName: e.target.value })}
                        placeholder="e.g. Donald Vance"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">System Correspondence Email</label>
                      <input
                        type="email"
                        value={staffForm.email}
                        onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                        placeholder="clerk@enterprise.com"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-300 focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">ASSIGNED ENTERPRISE ROLE</label>
                      <select
                        value={staffForm.roleName}
                        onChange={e => setStaffForm({ ...staffForm, roleName: e.target.value as any, roleId: e.target.value.toLowerCase().replace(/ /g, '_') as any })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white"
                        required
                      >
                        <option value="Owner">Owner</option>
                        <option value="SysAdmin">SysAdmin</option>
                        <option value="Manager">Manager</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Cashier">Cashier</option>
                        <option value="Stock Controller">Stock Controller</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">BRANCH RECEPTOR LOCATION</label>
                      <select
                        value={staffForm.branchId}
                        onChange={e => setStaffForm({ ...staffForm, branchId: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-slate-350"
                        required
                      >
                        <option value="">-- ASSIGN SITE DESK --</option>
                        {branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">ENCRYPTED PIN / PASSWORD CREDS</label>
                      <input
                        type="text"
                        value={staffForm.pinCode}
                        onChange={e => setStaffForm({ ...staffForm, pinCode: e.target.value })}
                        placeholder="Enter secure password"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-amber-500 focus:border-amber-500 font-bold tracking-widest"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!canManageStaff}
                      className="bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black uppercase tracking-wider px-4 py-2 text-[10px] rounded-none cursor-pointer flex items-center gap-1.5 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {isEditingStaff ? <Save className="w-3 h-3 text-slate-950" /> : <Plus className="w-3 h-3 text-slate-950" />}
                      <span>{isEditingStaff ? 'UPDATE USER CARD' : 'INDUCT OPERATOR'}</span>
                    </button>
                    {isEditingStaff && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingStaff(false);
                          setStaffForm({ id: '', vendorId: '', branchId: '', staffCode: '', displayName: '', email: '', roleId: 'cashier', roleName: 'Cashier', pinHash: '', pinCode: '', status: 'active', assignedTerminalIds: [], createdAt: '', updatedAt: '', createdBy: '', updatedBy: '' });
                        }}
                        className="bg-slate-800 text-slate-400 py-2 px-4 hover:bg-slate-700 uppercase font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Staff error state */}
                {staffDbError && (
                  <div className="bg-rose-950/40 border border-rose-800 p-3 text-rose-400 text-[10px] uppercase tracking-wider">
                    {staffDbError}
                  </div>
                )}

                {/* Staff loading state */}
                {staffDbLoading && (
                  <div className="bg-slate-950 border border-slate-800 p-4 text-slate-400 text-[10px] uppercase tracking-wider text-center">
                    Loading staff records from database...
                  </div>
                )}

                {/* Staff empty state */}
                {!staffDbLoading && staffDbList.length === 0 && !staffDbError && (
                  <div className="bg-slate-950 border border-slate-800 p-4 text-slate-400 text-[10px] uppercase tracking-wider text-center">
                    No active staff found for this branch. Induct staff before terminal access.
                  </div>
                )}

                {/* Staff List Table */}
                <div className="space-y-2 font-mono">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">ACTIVE OPERATOR CREWMEMBERS IN CONGRUENCY</div>
                  <div className="border border-slate-800 divide-y divide-slate-950 font-mono">
                    {staffDbList.map(s => {
                      const branchAssoc = branches.find(b => b.id === s.branchId)?.name || 'HEAD_BASE';
                      const isRevealed = revealPassId === s.id;
                      return (
                        <div key={s.id} className="p-3 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#00f0ff] font-bold">{s.id}</span>
                              <span className="text-white font-bold">{s.displayName}</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-500/80 px-1.5 font-bold uppercase">{s.roleName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                              {s.email} • BRCH: {branchAssoc} • CODE: {s.staffCode}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end md:self-auto">
                            {/* Password Reveal Indicator */}
                            <div className="flex items-center gap-1 bg-slate-900 py-1 px-2 border border-slate-850 rounded-none text-[10px]">
                              <span className="text-slate-500 mr-1 uppercase">PIN COGN:</span>
                              <span className="text-amber-500 font-extrabold tracking-widest text-[11px] whitespace-nowrap">
                                {isRevealed ? (s.pinCode || '') : '••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setRevealPassId(isRevealed ? null : s.id)}
                                className="text-slate-400 hover:text-white ml-1.5 cursor-pointer"
                              >
                                {isRevealed ? <EyeOff size={11} /> : <Eye size={11} />}
                              </button>
                            </div>

                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handleEditStaffClick(s)}
                                disabled={!canManageStaff}
                                className="p-1 px-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-950 cursor-pointer text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Edit size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(s.id)}
                                disabled={!canManageStaff}
                                className="p-1 px-2 bg-slate-900 border border-slate-800 text-rose-500 hover:text-white hover:bg-rose-950 cursor-pointer text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: RETIRED ROLES & PERMISSIONS panel */}
            {activeSection === 'ROLES' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                    ROLES & PERMISSIONS RETIRED
                  </span>
                  <span className="text-[9px] bg-orange-50 px-2 py-1 border border-orange-300 text-orange-800 font-black uppercase">Retired</span>
                </div>

                <div className="border border-orange-400 bg-orange-50 text-orange-950 p-4">
                  <h2 className="text-sm font-black uppercase text-[#1e222b]">Roles & Permissions Retired</h2>
                  <p className="text-[10px] font-bold uppercase leading-relaxed mt-2">
                    This panel no longer controls access. Use Staff Access Rights to manage role-based permissions, menu access, staff access gates, and security rights.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      recordSecurityMatrixEvent({
                        eventType: 'STAFF_ACCESS_RIGHTS_SET_AS_PRIMARY',
                        label: 'Staff Access Rights Set As Primary',
                        message: 'User moved from retired Roles & Permissions to Staff Access Rights.'
                      });
                      setActiveSection('STAFF_ACCESS_RIGHTS');
                    }}
                    className="mt-3 px-3 py-2 bg-orange-600 border border-orange-700 text-white text-[10px] font-black uppercase"
                  >
                    Open Staff Access Rights
                  </button>
                </div>

                {/* The Permission Table Matrix */}
                <div className="hidden overflow-x-auto border border-slate-850 pos-custom-scroll bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800">
                        <th className="p-3 text-[10px] text-slate-400 uppercase font-black tracking-wider">SYSTEM ROLES [6 CLUSTERS]</th>
                        {retiredMenuPreviewRows.map(m => (
                          <th key={m.id} className="p-3 text-[9px] text-slate-400 text-center uppercase font-black tracking-wider leading-snug max-w-[90px]">{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-950/60">
                      {retiredRolePreviewRows.map(role => {
                        const permittedPages = retiredPermissionPreview[role] || [];
                        return (
                          <tr key={role} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-bold text-slate-200">
                              <span className="text-[#00f0ff] mr-1.5">•</span>
                              {role}
                            </td>
                            {retiredMenuPreviewRows.map(menu => {
                              const isChecked = permittedPages.includes(menu.id);
                              return (
                                <td key={menu.id} className="p-3 text-center align-middle">
                                  <label className="inline-flex items-center justify-center cursor-pointer p-2 hover:bg-slate-905">
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={retiredPermissionToggle}
                                      className="w-4 h-4 rounded-none border border-slate-800 bg-slate-950 text-[#00f0ff] focus:ring-0 accent-blue-500 cursor-pointer"
                                    />
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-slate-950 border border-slate-900 rounded-none flex items-start gap-3 text-slate-500 text-[10px] uppercase leading-normal">
                  <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-300 block mb-1">DUPLICATE PERMISSION STATE DISABLED</span>
                    Navigation, role menu access, staff session permissions, and action readiness now resolve from Staff Access Rights effective permissions.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: HARDWARE & DEVICES */}
            {activeSection === 'HARDWARE' && (
              <form onSubmit={handleSaveHardware} className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-orange-400" />
                    HARDWARE & DEVICES
                  </span>
                  <span className="text-[9px] text-orange-600 uppercase bg-slate-50 px-1 border border-[#b1b5c2]">Hardware Access</span>
                </div>

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Manage terminal devices, printers, scanners, drawers, and display hardware for this POS workstation.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">Terminal Device ID</label>
                    <input 
                      type="text" 
                      value={terminalUnit}
                      onChange={e => onUpdateTerminalUnit(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-[#00f0ff] font-bold text-xs outline-none focus:border-[#00f0ff] uppercase" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">Default Operator Label</label>
                    <input 
                      type="text" 
                      value={activeOperatorName}
                      onChange={e => onUpdateOperatorName(e.target.value.toUpperCase())}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-200 text-xs outline-none" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">Scanner Profile</label>
                    <select
                      value={hardForm.laserFocus}
                      onChange={e => setHardForm({ ...hardForm, laserFocus: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-300 text-xs outline-none"
                    >
                      <option value="LASER_FOCUS: INTENSE_RED">Standard Laser Scanner</option>
                      <option value="LASER_FOCUS: GREEN_MATRIX">2D Matrix Scanner</option>
                      <option value="LASER_FOCUS: DIRECT_CCD_CAMERA">Camera Scanner</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">Cash Drawer Connection</label>
                    <select
                      value={hardForm.drawerSignal}
                      onChange={e => setHardForm({ ...hardForm, drawerSignal: e.target.value })}
                      className="w-full bg-slate-100 text-slate-950 font-bold border border-slate-850 p-2 text-xs outline-none"
                    >
                      <option value="12VDC_ELECTRO_M_PULSE">Standard Drawer Pulse</option>
                      <option value="24VDC_HEAVY_FACTORY">High Voltage Drawer Pulse</option>
                      <option value="MANUAL_KEYBOARD_ONLY">Manual Key Only</option>
                    </select>
                  </div>
                </div>

                <div className="bg-white border border-[#b1b5c2] overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="bg-[#1e222b] text-white">
                      <tr>
                        {['Device Name', 'Connection Type', 'Status', 'Last Test', 'Access', 'Action'].map((heading) => (
                          <th key={heading} className="px-3 py-2 text-[10px] uppercase font-black">{heading}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hardwareDevices.map((device) => (
                        <tr key={device.deviceName} className="border-t border-[#d6d9e0] text-[11px] text-slate-700">
                          <td className="px-3 py-2 font-black text-[#1e222b]">{device.deviceName}</td>
                          <td className="px-3 py-2 font-bold">{device.connectionType}</td>
                          <td className="px-3 py-2 font-bold">{device.status}</td>
                          <td className="px-3 py-2 font-bold">{device.lastTest}</td>
                          <td className="px-3 py-2 font-bold">{device.permissionRequired}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {['Test Device', 'Configure', 'Calibrate', 'Disable'].map((label) => (
                                <button
                                  key={`${device.deviceName}-${label}`}
                                  type="button"
                                  onClick={() => handleHardwareDeviceAction(`${label} for ${device.deviceName}`)}
                                  className={`border px-2 py-1 text-[9px] font-black uppercase ${
                                    canConfigureHardware
                                      ? 'border-[#b1b5c2] bg-white hover:bg-orange-50 text-[#1e222b]'
                                      : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-3 border-t border-slate-900">
                  <button
                    type="submit"
                    className="bg-orange-655 hover:bg-orange-700 text-slate-950 font-black uppercase tracking-wider px-6 py-2.5 rounded-none cursor-pointer flex items-center gap-1.5 bg-orange-500"
                  >
                    <Save className="w-4 h-4 text-slate-950" />
                    Save Hardware & Device Settings
                  </button>
                </div>
              </form>
            )}

            {/* TAB 8: TAX & VAT SETTINGS */}
            {activeSection === 'TAX' && (
              <form onSubmit={handleSaveTax} className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Percent className="w-4 h-4 text-rose-500" />
                    FINANCIAL TAX & VAT CONFIGURATION
                  </span>
                  <span className="text-[9px] text-[#00f0ff] uppercase bg-slate-950 px-1 border border-slate-900">AUDIT STANDARDS</span>
                </div>

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Configure tax inclusive/exclusive processing and standard rates which calculate dynamically at checkout ring-outs.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">STANDARD VAT PERCENT RATIO (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="35"
                      step="0.5"
                      value={taxForm.vatRatePct}
                      onChange={e => setTaxForm({ ...taxForm, vatRatePct: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs outline-none font-bold" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">HEAVY MACHINE EQUIP SURTAX (%)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="15"
                      step="0.1"
                      value={taxForm.surtaxPct}
                      onChange={e => setTaxForm({ ...taxForm, surtaxPct: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs outline-none font-bold" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">TAX PROCESS GATES STRATEGY</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTaxForm({ ...taxForm, inclusive: true })}
                        className={`flex-1 py-2 text-[10px] uppercase font-black transition-all cursor-pointer ${
                          taxForm.inclusive ? 'bg-[#00f0ff] text-slate-950' : 'bg-slate-950 border border-slate-800 text-slate-400'
                        }`}
                      >
                        TAX INCLUSIVE
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaxForm({ ...taxForm, inclusive: false })}
                        className={`flex-1 py-2 text-[10px] uppercase font-black transition-all cursor-pointer ${
                          !taxForm.inclusive ? 'bg-amber-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-400'
                        }`}
                      >
                        TAX EXCLUSIVE
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 text-[10px] text-slate-500 leading-normal uppercase">
                  <div>* Formula when Inclusive: VAT Total = Price - (Price / (1 + vatRatePct/100))</div>
                  <div className="mt-1">* Formula when Exclusive: VAT Total = Price * (vatRatePct/100) + surtaxPct/100</div>
                </div>

                <div className="pt-3 border-t border-slate-900">
                  <button
                    type="submit"
                    className="bg-rose-700 hover:bg-rose-800 text-white font-bold uppercase tracking-wider px-6 py-2.5 rounded-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    SAVE LEDGER FINANCIAL SPECS
                  </button>
                </div>
              </form>
            )}

            {/* TAB 9: RECEIPT BLUEPRINT */}
            {activeSection === 'RECEIPT' && (
              <form onSubmit={handleSaveReceipt} className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-pink-400" />
                    RECEIPT BLUEPRINT
                  </span>
                  <span className="text-[9px] text-[#00f0ff] uppercase bg-slate-950 px-1 border border-slate-900">{recForm.layout || 'Thermal Receipt Roll'}</span>
                </div>

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Configure the active receipt template consumed by sales completion, receipt preview, reprint, PDF, and WhatsApp output.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2 bg-slate-950 border border-slate-850 p-3">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">Business Logo Upload</label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="receipt-blueprint-logo-preview">
                        {recForm.logoDataUrl ? <img src={recForm.logoDataUrl} alt="Receipt logo preview" /> : <span>No Logo</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => handleLogoUpload(event.target.files?.[0])}
                          className="max-w-full text-[10px] text-slate-300"
                        />
                        {recForm.logoDataUrl && (
                          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setRecForm({ ...recForm, logoDataUrl: '' })}>
                            Remove Logo
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <SettingsSelect label="Receipt Layout" value={recForm.layout || 'Thermal Receipt Roll'} onChange={(value) => setRecForm({ ...recForm, layout: value as ReceiptSetting['layout'] })} options={receiptLayouts} />
                  {recForm.layout === 'Custom Layout' && (
                    <SettingsField label="Custom Layout Name" value={recForm.customLayoutName || ''} onChange={(value) => setRecForm({ ...recForm, customLayoutName: value })} />
                  )}

                  <SettingsTextarea label="Header Message" value={recForm.headerMessage || recForm.header || ''} onChange={(value) => setRecForm({ ...recForm, headerMessage: value, header: value })} />
                  <SettingsTextarea label="Footer Message" value={recForm.footerMessage || recForm.footer || ''} onChange={(value) => setRecForm({ ...recForm, footerMessage: value, footer: value })} />
                  <SettingsTextarea label="Business Address" value={recForm.businessAddress || ''} onChange={(value) => setRecForm({ ...recForm, businessAddress: value })} />
                  <SettingsField label="Contact Numbers" value={recForm.contactNumbers || recForm.contactInformation || ''} onChange={(value) => setRecForm({ ...recForm, contactNumbers: value, contactInformation: value })} />
                  <SettingsField label="Email Address" value={recForm.emailAddress || ''} onChange={(value) => setRecForm({ ...recForm, emailAddress: value })} />
                  <SettingsTextarea label="Social Media Handles" value={recForm.socialMediaHandles || recForm.socialMediaInformation || ''} onChange={(value) => setRecForm({ ...recForm, socialMediaHandles: value, socialMediaInformation: value })} />
                  <SettingsTextarea label="Terms & Conditions" value={recForm.termsAndConditions || ''} onChange={(value) => setRecForm({ ...recForm, termsAndConditions: value })} />

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">PRINT TAX MATRIX BREAKDOWN?</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRecForm({ ...recForm, showTaxBreakdown: true })}
                        className={`flex-1 py-1.5 text-[10px] uppercase font-black cursor-pointer ${
                          recForm.showTaxBreakdown ? 'bg-pink-600 text-white font-extrabold' : 'bg-slate-950 border border-slate-800 text-slate-500'
                        }`}
                      >
                        YES - PRINT RATIOS
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecForm({ ...recForm, showTaxBreakdown: false })}
                        className={`flex-1 py-1.5 text-[10px] uppercase font-black cursor-pointer ${
                          !recForm.showTaxBreakdown ? 'bg-slate-800 text-slate-400 font-extrabold' : 'bg-slate-950 border border-slate-800 text-slate-500'
                        }`}
                      >
                        NO - SUMMARY ONLY
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-900">
                  <button
                    type="submit"
                    className="bg-pink-600 hover:bg-pink-700 text-white font-bold uppercase tracking-wider px-6 py-2.5 rounded-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    SAVE RECEIPT BLUEPRINT
                  </button>
                </div>
              </form>
            )}

            {activeSection === 'CHECK_WRITER_SETTINGS' && checkSettings && (
              <div className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-orange-500" />
                    FINANCIAL CONTROL SETTINGS - CHECK WRITER
                  </span>
                  {SHOW_DEV_BADGES && <span className="text-[9px] text-orange-600 uppercase bg-slate-50 px-1 border border-[#b1b5c2]">LOCAL MOCK</span>}
                </div>
                <SettingsFormSection title="Cheque Numbering">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <SettingsTextField label="Cheque Prefix" value={checkSettings.chequePrefix} onChange={(value) => setCheckSettings({ ...checkSettings, chequePrefix: value.toUpperCase() })} />
                    <SettingsTextField label="Next Cheque Number" type="number" value={String(checkSettings.nextChequeNumber)} onChange={(value) => setCheckSettings({ ...checkSettings, nextChequeNumber: Number(value) || 1 })} />
                    <SettingsTextField label="Number Padding" type="number" value={String(checkSettings.chequeNumberPadding)} onChange={(value) => setCheckSettings({ ...checkSettings, chequeNumberPadding: Math.max(3, Number(value) || 6) })} />
                    <label className="space-y-1 block">
                      <span className="block text-[9px] text-slate-600 font-black uppercase">Default Bank/Cash Account</span>
                      <select
                        value={checkSettings.defaultBankAccountId || ''}
                        onChange={(event) => setCheckSettings({ ...checkSettings, defaultBankAccountId: event.target.value })}
                        className="w-full bg-white border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold text-[#1e222b] outline-none focus:border-orange-500"
                      >
                        <option value="">Select account</option>
                        {financialAccounts.map((account) => <option key={account.accountId} value={account.accountId}>{account.accountCode} - {account.accountName}</option>)}
                      </select>
                    </label>
                    <SettingsTextField label="Approval Threshold Amount" type="number" value={String(checkSettings.approvalThresholdAmount)} onChange={(value) => setCheckSettings({ ...checkSettings, approvalThresholdAmount: Number(value) || 0 })} />
                    <div className="border border-orange-300 bg-orange-50 p-3 text-orange-950">
                      <div className="text-[9px] font-black uppercase">Preview Next Check Number</div>
                      <div className="text-xl font-black">{nextCheckPreview}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                    <SettingsCheckbox label="Require Approval Above Amount" checked={checkSettings.requireApprovalAboveAmount} onChange={(checked) => setCheckSettings({ ...checkSettings, requireApprovalAboveAmount: checked })} />
                    <SettingsCheckbox label="Allow Manual Cheque Number" checked={checkSettings.allowManualChequeNumber} onChange={(checked) => setCheckSettings({ ...checkSettings, allowManualChequeNumber: checked })} />
                    <SettingsCheckbox label="Print Business Name" checked={checkSettings.printBusinessName} onChange={(checked) => setCheckSettings({ ...checkSettings, printBusinessName: checked })} />
                    <SettingsCheckbox label="Print Payee Line" checked={checkSettings.printPayeeLine} onChange={(checked) => setCheckSettings({ ...checkSettings, printPayeeLine: checked })} />
                    <SettingsCheckbox label="Print Amount In Words" checked={checkSettings.printAmountInWords} onChange={(checked) => setCheckSettings({ ...checkSettings, printAmountInWords: checked })} />
                    <SettingsCheckbox label="Print Memo" checked={checkSettings.printMemo} onChange={(checked) => setCheckSettings({ ...checkSettings, printMemo: checked })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="bg-orange-600 text-white font-black uppercase px-4 py-2 text-[10px]" onClick={saveCheckSettings}>Save Check Settings</button>
                    <button type="button" className="border border-[#b1b5c2] text-[#1e222b] font-black uppercase px-4 py-2 text-[10px]" onClick={resetCheckSettings}>Reset to Defaults</button>
                    <button type="button" className="border border-orange-300 text-orange-700 font-black uppercase px-4 py-2 text-[10px]" onClick={() => { setNextCheckPreview(previewNumber(checkSettings)); triggerToast('CHECK_WRITER_NEXT_NUMBER_PREVIEWED'); }}>Preview Next Check Number</button>
                  </div>
                  {SHOW_DEV_BADGES && (
                    <div className="border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-900 font-bold uppercase">
                      Local/mock settings only. No Firestore, bank, cheque printer, payment gateway, or final accounting posting is connected.
                    </div>
                  )}
                </SettingsFormSection>
              </div>
            )}

            {/* TAB 10: BUILD DEVELOPMENT STATUS */}
            {SHOW_DEV_BADGES && activeSection === 'BUILD_STATUS' && (
              <div className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Info className="w-4 h-4 text-orange-500" />
                    BUILD DEVELOPMENT STATUS
                  </span>
                  <span className="text-[9px] text-orange-600 uppercase bg-slate-50 px-1 border border-[#b1b5c2]">READ ONLY</span>
                </div>

                <div className="bg-white border-2 border-[#b1b5c2] p-4 text-[#1e222b]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    <ReadOnlyAccessMetric label="Product" value="iTred Commerce POS" />
                    <ReadOnlyAccessMetric label="Mode" value="Diagnostics" />
                    <ReadOnlyAccessMetric label="Backend" value="Local Services" />
                    <ReadOnlyAccessMetric label="External Cloud" value="Not Connected" />
                    <ReadOnlyAccessMetric label="Fiscalization" value="Not Connected" />
                    <ReadOnlyAccessMetric label="Admin Access" value="Internal SCI Tools Only" />
                    <ReadOnlyAccessMetric label="Owner Access" value="Full During Development" />
                    <ReadOnlyAccessMetric label="Commercial Gates" value="Deferred" />
                    <ReadOnlyAccessMetric label="Last Build Check" value="Placeholder" />
                    <ReadOnlyAccessMetric label="Current Staff Session" value={currentStaffGateSession.gateStatus} />
                  </div>
                  <div className="mt-3 border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-900 font-bold uppercase">
                    Diagnostics mode grants Owner full access. Commercial feature enforcement is deferred.
                  </div>
                </div>
                <div className="bg-white border-2 border-[#b1b5c2] p-4 text-[#1e222b]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {staffGateReadiness.map((item) => <ReadOnlyAccessMetric key={item.item} label={item.item} value={item.status} />)}
                  </div>
                  <div className="mt-3 border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-900 font-bold uppercase">
                    Staff PIN gate and role menu filtering are preview-only. Strict permission enforcement and mandatory gate behavior remain disabled.
                  </div>
                </div>
                <StaffSessionGatePanel />
                <RoleMenuReadinessPanel />
              </div>
            )}

            {activeSection === 'STAFF_ACCESS_RIGHTS' && (
              <div className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-500" />
                    STAFF ACCESS RIGHTS
                  </span>
                  <span className="text-[9px] text-orange-600 uppercase bg-slate-50 px-1 border border-[#b1b5c2]">Access Matrix</span>
                </div>
                <div className="border border-orange-300 bg-orange-50 text-orange-950 p-3 text-[10px] font-bold uppercase leading-relaxed">
                  Staff Access Rights is the active permission control centre. The older Roles & Permissions panel has been retired to avoid duplicate permission states.
                </div>
                <SecurityRightsMatrix />
              </div>
            )}

            {/* TAB 10b: STAFF MIRROR DIAGNOSTICS (DEV / ADMIN ONLY) */}
            {activeSection === 'STAFF_MIRROR_DIAGNOSTICS' && (
              <VendorStaffMirrorDiagnosticsPanel />
            )}

            {/* TAB 11: WARNING: RESET */}
            {SHOW_DEV_BADGES && activeSection === 'RESET' && (
              <div className="space-y-5">
                <div className="border-b border-red-800 pb-2 flex items-center gap-2 text-red-500 font-extrabold">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                  <span className="text-xs uppercase tracking-widest font-mono">EMERGENCY CORE BIOS INDUSTRIAL FACTORY CLEAR</span>
                </div>

                <p className="text-slate-400 text-xs leading-normal">
                  Executing this trigger destroys all current transaction registers, locks offline volatile local memory indices, expels current authorization sessions, forces active shifts closed, and establishes baseline catalog values from mechanical preset molds.
                </p>

                <div className="p-3 bg-[#240c0c] border border-red-900 text-[10px] text-red-400 leading-relaxed uppercase">
                  WARNING: THIS ACTION IS MECHANICALLY IRREVERSIBLE. DO NOT OPERATE UNLESS AUTHORIZED FOR HIGH SECTOR ERASURES. 12-CORE PARITY SECTORS WILL SCRUB.
                </div>

                <div className="pt-3">
                  <button
                    onClick={handleResetClick}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold uppercase tracking-widest px-6 py-3 text-xs rounded-none cursor-pointer flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 animate-spin" style={{ animationDuration: '3s' }} />
                    INITIALIZE FACTORY DEEP ERASE PROTOCOL
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* INNER TAB FOOTER CONTROLS SYNC */}
          <div className="border-t border-slate-900 pt-3 mt-6 flex justify-between items-center text-[9px] font-mono text-slate-500 shrink-0">
            <span>DAEMON CONTROL STATE: COMMITTED</span>
            <span>VOLATILE RAM SYNCHRONIZED</span>
          </div>

        </div>

      </div>

      <A5FloatingForm
        title="A5 Branch Registration Form"
        open={branchA5Open}
        onClose={() => setBranchA5Open(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setBranchA5Open(false)} className="px-4 py-2 border border-[#b1b5c2] text-[10px] font-black uppercase">
              Cancel
            </button>
            <button type="button" onClick={handleSaveBranchA5} className="px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase">
              Save Branch
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-mono">
          <div className="grid grid-cols-2 gap-3">
            <SettingsField label="Vendor ID" value={branchForm.vendorId || businessProfile.vendorId || getActiveVendorId()} onChange={(value) => setBranchForm({ ...branchForm, vendorId: value })} />
            <SettingsField label="Branch Code" value={branchForm.branchCode || branchForm.id} onChange={(value) => setBranchForm({ ...branchForm, branchCode: value.toUpperCase(), id: value.toUpperCase() })} required />
            <SettingsField label="Branch Name" value={branchForm.name} onChange={(value) => setBranchForm({ ...branchForm, name: value })} required />
            <SettingsSelect label="Branch Type" value={branchForm.branchType || 'Retail'} onChange={(value) => setBranchForm({ ...branchForm, branchType: value })} options={['Retail', 'Warehouse', 'Workshop', 'Head Office', 'Mobile']} />
            <SettingsField label="City / Town" value={branchForm.cityTown || ''} onChange={(value) => setBranchForm({ ...branchForm, cityTown: value })} />
            <SettingsField label="District" value={branchForm.district || ''} onChange={(value) => setBranchForm({ ...branchForm, district: value })} />
            <SettingsField label="Suburb" value={branchForm.suburb || ''} onChange={(value) => setBranchForm({ ...branchForm, suburb: value })} />
            <SettingsField label="Phone" value={branchForm.phone || ''} onChange={(value) => setBranchForm({ ...branchForm, phone: value })} />
            <SettingsField label="WhatsApp" value={branchForm.whatsapp || ''} onChange={(value) => setBranchForm({ ...branchForm, whatsapp: value })} />
            <SettingsField label="Email" value={branchForm.email || ''} onChange={(value) => setBranchForm({ ...branchForm, email: value })} />
            <SettingsField label="Branch Manager" value={branchForm.branchManager || ''} onChange={(value) => setBranchForm({ ...branchForm, branchManager: value })} />
            <SettingsSelect label="Status" value={branchForm.status || 'Active'} onChange={(value) => setBranchForm({ ...branchForm, status: value })} options={['Active', 'Inactive', 'Suspended']} />
          </div>
          <SettingsTextarea label="Physical Address" value={branchForm.physicalAddress || branchForm.location || ''} onChange={(value) => setBranchForm({ ...branchForm, physicalAddress: value, location: value })} />
          <SettingsTextarea label="Notes" value={branchForm.notes || ''} onChange={(value) => setBranchForm({ ...branchForm, notes: value })} />
        </div>
      </A5FloatingForm>

      <A5FloatingForm
        title="A5 Warehouse Registration Form"
        open={warehouseA5Open}
        onClose={() => setWarehouseA5Open(false)}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWarehouseA5Open(false)} className="px-4 py-2 border border-[#b1b5c2] text-[10px] font-black uppercase">
              Cancel
            </button>
            <button type="button" onClick={handleSaveWarehouseA5} className="px-4 py-2 bg-orange-600 text-white text-[10px] font-black uppercase">
              Save Warehouse
            </button>
          </div>
        }
      >
        <div className="space-y-4 font-mono">
          <div className="grid grid-cols-2 gap-3">
            <SettingsField label="Vendor ID" value={warehouseForm.vendorId || businessProfile.vendorId || getActiveVendorId()} onChange={(value) => setWarehouseForm({ ...warehouseForm, vendorId: value })} />
            <SettingsField label="Warehouse Code" value={warehouseForm.warehouseCode || warehouseForm.id} onChange={(value) => setWarehouseForm({ ...warehouseForm, warehouseCode: value.toUpperCase(), id: value.toUpperCase() })} required />
            <SettingsField label="Warehouse Name" value={warehouseForm.name} onChange={(value) => setWarehouseForm({ ...warehouseForm, name: value })} required />
            <SettingsSelect label="Warehouse Type" value={warehouseForm.warehouseType || 'Stock Room'} onChange={(value) => setWarehouseForm({ ...warehouseForm, warehouseType: value })} options={['Stock Room', 'Main Depot', 'Cold Room', 'Returns Cage', 'Yard']} />
            <SettingsSelect label="Branch" value={warehouseForm.branchId} onChange={(value) => setWarehouseForm({ ...warehouseForm, branchId: value })} options={branches.map((branch) => branch.id)} />
            <SettingsField label="Shelf Prefix" value={warehouseForm.shelfLocationPrefix || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, shelfLocationPrefix: value.toUpperCase() })} />
            <SettingsField label="City / Town" value={warehouseForm.cityTown || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, cityTown: value })} />
            <SettingsField label="District" value={warehouseForm.district || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, district: value })} />
            <SettingsField label="Responsible Staff" value={warehouseForm.responsibleStaff || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, responsibleStaff: value })} />
            <SettingsField label="Phone" value={warehouseForm.phone || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, phone: value })} />
            <SettingsField label="Email" value={warehouseForm.email || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, email: value })} />
            <SettingsSelect label="Status" value={warehouseForm.status || 'Active'} onChange={(value) => setWarehouseForm({ ...warehouseForm, status: value })} options={['Active', 'Inactive', 'Restricted']} />
          </div>
          <SettingsTextarea label="Physical Address" value={warehouseForm.physicalAddress || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, physicalAddress: value })} />
          <SettingsTextarea label="Notes" value={warehouseForm.notes || ''} onChange={(value) => setWarehouseForm({ ...warehouseForm, notes: value })} />
        </div>
      </A5FloatingForm>

    </div>
  );
}

function ReadOnlyAccessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#b1b5c2] bg-slate-50 p-3">
      <div className="text-[8.5px] text-slate-500 font-black uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-sm text-[#1e222b] font-black uppercase">{value}</div>
    </div>
  );
}

function SettingsFormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border-2 border-[#b1b5c2] p-4 space-y-4 text-[#1e222b]">
      <div className="border-b border-[#d6d9e0] pb-2 text-[10px] text-orange-600 font-black uppercase tracking-widest">{title}</div>
      {children}
    </section>
  );
}

function SettingsTextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[9px] text-slate-600 font-black uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold text-[#1e222b] outline-none focus:border-orange-500"
      />
    </label>
  );
}

function SettingsCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[10px] uppercase font-black text-[#1e222b] border border-[#b1b5c2] bg-slate-50 p-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-orange-600" />
      {label}
    </label>
  );
}

function ValidationList({ title, items, tone }: { title: string; items: string[]; tone: 'error' | 'warning' }) {
  const danger = tone === 'error';
  return (
    <div className={`border p-3 text-[10px] font-bold uppercase ${danger ? 'bg-rose-50 border-rose-400 text-rose-900' : 'bg-orange-50 border-orange-400 text-orange-950'}`}>
      <div className="font-black mb-1">{title}</div>
      {items.map((item) => <div key={item}>{item}</div>)}
    </div>
  );
}

function SettingsField({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span>
      <input
        type="text"
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold uppercase outline-none focus:border-orange-500"
      />
    </label>
  );
}

function SettingsSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold uppercase outline-none focus:border-orange-500"
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function SettingsTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold uppercase outline-none focus:border-orange-500 resize-none"
      />
    </label>
  );
}
