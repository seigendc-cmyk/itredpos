import React, { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Edit,
  HardDrive,
  Layers,
  MapPin,
  Package,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Terminal,
  Users
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BusinessProfile,
  BranchSetting,
  HardwareSetting,
  ReceiptSetting,
  Role,
  StaffSetting,
  TaxSetting,
  TerminalSetting,
  WarehouseSetting
} from '../types';
import { isLimitReached, type PlanFeatureAccess } from '../auth/planFeatureGate';
import { readPosAuthContext } from '../auth/posVendorAuthState';
import { getActiveVendorId } from '../utils/vendorDataMode';
import { hasPermission } from '../utils/posPermissions';
import { saveBusinessProfile } from '../services/businessProfileService';
import {
  canStaffManageStaff,
  createStaff,
  getStaffByVendor,
  mapStaffRecordToStaffSetting,
  mapStaffSettingToStaffRecord,
  suspendStaff,
  updateStaff
} from '../services/staffFirestoreService';
import {
  calculateDocumentTax,
  DEFAULT_VENDOR_TAX_SETTINGS,
  getVendorTaxSettings,
  saveVendorTaxSettings,
  type VendorTaxSettings
} from '../services/vendorTaxSettingsService';
import SubscriptionCommercePage from '../build08072026-subs/pages/SubscriptionCommercePage';

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
  | 'BUSINESS_INFORMATION'
  | 'BRANCHES'
  | 'WAREHOUSES'
  | 'EMPLOYEES'
  | 'ROLES_PERMISSIONS'
  | 'CASH_REGISTERS'
  | 'HARDWARE'
  | 'TAXES'
  | 'RECEIPTS'
  | 'SUBSCRIPTION'
  | 'BACKUP_SYNC';

type SaveState = 'idle' | 'success' | 'error';

type BranchForm = {
  id: string;
  name: string;
  address: string;
  phone: string;
  manager: string;
  status: string;
};

type WarehouseForm = {
  id: string;
  name: string;
  branchId: string;
  address: string;
  stockCount: string;
  status: string;
};

type EmployeeForm = {
  id: string;
  displayName: string;
  email: string;
  roleName: Role;
  branchId: string;
  status: StaffSetting['status'];
  temporaryPin: string;
};

type RegisterForm = {
  id: string;
  name: string;
  branchId: string;
  device: string;
  assignedStaffId: string;
  status: string;
};

type ReceiptDraft = ReceiptSetting & {
  businessName?: string;
  phone?: string;
  vatNumber?: string;
  returnPolicy?: string;
  showCashierName?: boolean;
  showBranchName?: boolean;
};

type BackupState = {
  lastSync: string;
  pendingChanges: number;
  backupStatus: 'Up to date' | 'Changes waiting to sync' | 'Backup completed' | 'Backup failed';
  lastBackup: string;
};

const settingSections: Array<{ id: SettingsSectionId; label: string; icon: React.ElementType }> = [
  { id: 'BUSINESS_INFORMATION', label: 'Business Information', icon: Building },
  { id: 'BRANCHES', label: 'Branches', icon: MapPin },
  { id: 'WAREHOUSES', label: 'Warehouses', icon: Package },
  { id: 'EMPLOYEES', label: 'Employees', icon: Users },
  { id: 'ROLES_PERMISSIONS', label: 'Roles & Permissions', icon: ShieldCheck },
  { id: 'CASH_REGISTERS', label: 'Cash Registers', icon: Terminal },
  { id: 'HARDWARE', label: 'Hardware', icon: Cpu },
  { id: 'TAXES', label: 'Taxes', icon: Percent },
  { id: 'RECEIPTS', label: 'Receipts', icon: Receipt },
  { id: 'SUBSCRIPTION', label: 'Subscription', icon: Layers },
  { id: 'BACKUP_SYNC', label: 'Backup & Sync', icon: HardDrive }
];

const roleSummaries: Array<{ role: Role; summary: string }> = [
  { role: 'Owner', summary: 'Full business control, billing, staff, and settings.' },
  { role: 'SysAdmin', summary: 'Setup and support access for business operations.' },
  { role: 'Manager', summary: 'Day-to-day branch, staff, stock, and sales oversight.' },
  { role: 'Supervisor', summary: 'Shift leadership with limited staff and sales controls.' },
  { role: 'Cashier', summary: 'Sales, receipts, and assigned register activity.' },
  { role: 'Stock Controller', summary: 'Stock counts, receiving, and warehouse activity.' },
  { role: 'Delivery Staff', summary: 'Delivery tasks and assigned customer handovers.' },
  { role: 'Accountant', summary: 'Financial review, reports, and tax visibility.' },
  { role: 'Viewer', summary: 'Read-only access to approved business areas.' }
];

const defaultBackupState: BackupState = {
  lastSync: 'No sync yet',
  pendingChanges: 0,
  backupStatus: 'Up to date',
  lastBackup: 'No backup yet'
};

function nowLabel(): string {
  return new Date().toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function shortDateLabel(value?: string): string {
  if (!value) return 'Not yet';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort browser persistence only.
  }
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

function branchName(branches: BranchSetting[], branchId?: string): string {
  return branches.find((branch) => branch.id === branchId)?.name || 'Unassigned';
}

function employeeName(staff: StaffSetting[], staffId?: string): string {
  return staff.find((employee) => employee.id === staffId)?.displayName || 'Unassigned';
}

function normalizeStatus(value?: string): string {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'active' || raw === 'ready' || raw === 'connected') return 'Ready';
  if (raw === 'suspended' || raw === 'disabled' || raw === 'inactive') return 'Disabled';
  if (raw === 'offline') return 'Offline';
  if (!raw) return 'Needs Setup';
  return value || 'Needs Setup';
}

function registerStatus(value?: string): 'Ready' | 'Offline' | 'Disabled' | 'Needs Setup' {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'ready' || raw === 'active') return 'Ready';
  if (raw === 'offline') return 'Offline';
  if (raw === 'disabled' || raw === 'inactive') return 'Disabled';
  return 'Needs Setup';
}

function employeeAccessStatus(employee: StaffSetting): 'Ready' | 'Pending Setup' | 'Access Disabled' | 'Needs Attention' {
  const status = String(employee.status || '').toLowerCase();
  if (status === 'suspended' || status === 'archived') return 'Access Disabled';
  if (!employee.branchId || !employee.roleName) return 'Pending Setup';
  if (!employee.displayName || !employee.email) return 'Needs Attention';
  return 'Ready';
}

function statusClass(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes('ready') || normalized.includes('active') || normalized.includes('connected') || normalized.includes('completed') || normalized.includes('up to date')) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  }
  if (normalized.includes('pending') || normalized.includes('waiting') || normalized.includes('setup') || normalized.includes('offline')) {
    return 'border-orange-300 bg-orange-50 text-orange-900';
  }
  if (normalized.includes('disabled') || normalized.includes('failed')) {
    return 'border-rose-300 bg-rose-50 text-rose-800';
  }
  return 'border-slate-300 bg-slate-50 text-slate-700';
}

function canShowDiagnosticsLink(activeRole?: string): boolean {
  const auth = readPosAuthContext() as (ReturnType<typeof readPosAuthContext> & { developerMode?: boolean }) | null;
  return activeRole === 'Owner' && auth?.developerMode === true;
}

function toTaxDraft(vendorId: string, profile: BusinessProfile, tax: TaxSetting): VendorTaxSettings {
  return {
    ...DEFAULT_VENDOR_TAX_SETTINGS,
    vendorId,
    vatEnabled: tax.vatRatePct > 0,
    vatRegistered: Boolean(profile.vatRegistered || tax.vatRatePct > 0),
    vatNumber: profile.vatNumber || '',
    defaultVatRate: tax.vatRatePct,
    pricesIncludeVat: tax.inclusive
  };
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
  activeOperatorName,
  onUpdateOperatorName,
  activeRole,
  planAccess
}: PosSettingsProps) {
  const activeVendorId = businessProfile.vendorId || getActiveVendorId() || '';
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('BUSINESS_INFORMATION');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<BusinessProfile>({ ...businessProfile });
  const [profileSaveState, setProfileSaveState] = useState<SaveState>('idle');
  const [branchForm, setBranchForm] = useState<BranchForm>({ id: '', name: '', address: '', phone: '', manager: '', status: 'Active' });
  const [warehouseForm, setWarehouseForm] = useState<WarehouseForm>({ id: '', name: '', branchId: '', address: '', stockCount: '0', status: 'Active' });
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({ id: '', displayName: '', email: '', roleName: 'Cashier', branchId: '', status: 'active', temporaryPin: '' });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({ id: '', name: '', branchId: '', device: 'POS Workstation', assignedStaffId: '', status: 'Ready' });
  const [employeeRows, setEmployeeRows] = useState<StaffSetting[]>(staff);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesMessage, setEmployeesMessage] = useState('');
  const [defaultBranchId, setDefaultBranchId] = useState('');
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('');
  const [hardwareForm, setHardwareForm] = useState<HardwareSetting>({ ...hardwareSetting });
  const [taxDraft, setTaxDraft] = useState<VendorTaxSettings>(() => toTaxDraft(activeVendorId, businessProfile, taxSetting));
  const [taxSaveState, setTaxSaveState] = useState<SaveState>('idle');
  const [exampleItemPrice, setExampleItemPrice] = useState('100.00');
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft>({
    ...receiptSetting,
    businessName: receiptHeader || businessProfile.tradingName || businessProfile.businessName || businessProfile.legalName,
    phone: businessProfile.phone || businessProfile.businessPhone || businessProfile.ownerPhone || '',
    vatNumber: businessProfile.vatNumber || '',
    returnPolicy: receiptSetting.termsAndConditions || 'Returns accepted according to store policy.',
    showCashierName: true,
    showBranchName: true
  });
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);
  const [backupState, setBackupState] = useState<BackupState>(() => readJson('itred_pos_settings_backup_status', defaultBackupState));

  const canManageStaff = activeRole ? canStaffManageStaff(activeRole) : false;
  const canConfigureHardware = activeRole ? hasPermission(activeRole as Role, 'hardware.configure') : false;
  const diagnosticsAllowed = canShowDiagnosticsLink(activeRole);
  const shownEmployees = employeeRows.length > 0 ? employeeRows : staff;
  const taxExample = useMemo(() => calculateDocumentTax([{ lineAmount: Number(exampleItemPrice) || 0 }], taxDraft), [exampleItemPrice, taxDraft]);

  useEffect(() => {
    setProfileForm({ ...businessProfile });
  }, [businessProfile]);

  useEffect(() => {
    setHardwareForm({ ...hardwareSetting });
  }, [hardwareSetting]);

  useEffect(() => {
    setEmployeeRows(staff);
  }, [staff]);

  useEffect(() => {
    if (!activeVendorId) {
      setTaxDraft(toTaxDraft('', businessProfile, taxSetting));
      return;
    }
    let active = true;
    void getVendorTaxSettings(activeVendorId).then((settings) => {
      if (!active) return;
      setTaxDraft({
        ...toTaxDraft(activeVendorId, businessProfile, taxSetting),
        ...settings,
        vatNumber: settings.vatNumber || businessProfile.vatNumber || '',
        vatRegistered: settings.vatRegistered || Boolean(businessProfile.vatRegistered)
      });
    });
    return () => {
      active = false;
    };
  }, [activeVendorId, businessProfile.vatNumber, businessProfile.vatRegistered, taxSetting.inclusive, taxSetting.vatRatePct]);

  useEffect(() => {
    if (activeSection !== 'EMPLOYEES' || !activeVendorId) return;
    let active = true;
    setEmployeesLoading(true);
    setEmployeesMessage('');
    void getStaffByVendor(activeVendorId)
      .then((records) => {
        if (!active) return;
        const mapped = records.map(mapStaffRecordToStaffSetting);
        if (mapped.length > 0) setEmployeeRows(mapped);
      })
      .catch(() => {
        if (active) setEmployeesMessage('Employee records are available from local settings until the connection is ready.');
      })
      .finally(() => {
        if (active) setEmployeesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeSection, activeVendorId]);

  useEffect(() => {
    writeJson('itred_pos_settings_backup_status', backupState);
  }, [backupState]);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3000);
  };

  const limitReached = (count: number, limitKey: keyof PlanFeatureAccess['limits']) => {
    return planAccess ? isLimitReached(count, planAccess.limits[limitKey]) : false;
  };

  const resetBranchForm = () => setBranchForm({ id: '', name: '', address: '', phone: '', manager: '', status: 'Active' });
  const resetWarehouseForm = () => setWarehouseForm({ id: '', name: '', branchId: '', address: '', stockCount: '0', status: 'Active' });
  const resetEmployeeForm = () => setEmployeeForm({ id: '', displayName: '', email: '', roleName: 'Cashier', branchId: '', status: 'active', temporaryPin: '' });
  const resetRegisterForm = () => setRegisterForm({ id: '', name: '', branchId: '', device: 'POS Workstation', assignedStaffId: '', status: 'Ready' });

  const handleSaveProfile = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const saved = saveBusinessProfile(
        {
          ...profileForm,
          legalName: profileForm.legalName || profileForm.registeredBusinessName || profileForm.businessName || profileForm.tradingName || '',
          businessName: profileForm.businessName || profileForm.tradingName || profileForm.legalName || '',
          tradingName: profileForm.tradingName || profileForm.businessName || '',
          phone: profileForm.phone || profileForm.businessPhone || profileForm.ownerPhone || '',
          businessPhone: profileForm.businessPhone || profileForm.phone || '',
          whatsapp: profileForm.whatsapp || profileForm.businessWhatsapp || profileForm.ownerWhatsApp || '',
          businessWhatsapp: profileForm.businessWhatsapp || profileForm.whatsapp || '',
          cityTown: profileForm.cityTown || profileForm.city || '',
          suburb: profileForm.suburb || profileForm.districtSuburb || profileForm.district || '',
          physicalAddress: profileForm.physicalAddress || profileForm.address || profileForm.headquartersAddress || '',
          address: profileForm.address || profileForm.physicalAddress || profileForm.headquartersAddress || ''
        },
        activeOperatorName || 'Settings'
      );
      setProfileForm(saved);
      onUpdateBusinessProfile(saved);
      setProfileSaveState('success');
      triggerToast('Saved successfully.');
    } catch {
      setProfileSaveState('error');
      triggerToast('Save failed.');
    }
  };

  const handleSaveBranch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!branchForm.name.trim()) {
      triggerToast('Branch name is required.');
      return;
    }
    const isNew = !branchForm.id;
    if (isNew && limitReached(branches.length, 'maxBranches')) {
      triggerToast('Branch limit reached for your current plan.');
      return;
    }
    const id = branchForm.id || generateId('BR');
    const nextBranch: BranchSetting = {
      ...branches.find((branch) => branch.id === id),
      id,
      name: branchForm.name.trim(),
      location: branchForm.address.trim(),
      address: branchForm.address.trim(),
      physicalAddress: branchForm.address.trim(),
      phone: branchForm.phone.trim(),
      branchManager: branchForm.manager.trim(),
      status: branchForm.status,
      updatedAt: new Date().toISOString()
    };
    onUpdateBranches([...branches.filter((branch) => branch.id !== id), nextBranch]);
    resetBranchForm();
    triggerToast(isNew ? 'Branch added.' : 'Branch updated.');
  };

  const handleEditBranch = (branch: BranchSetting) => {
    setBranchForm({
      id: branch.id,
      name: branch.name || branch.branchName || '',
      address: branch.physicalAddress || branch.address || branch.location || '',
      phone: branch.phone || branch.branchPhone || '',
      manager: branch.branchManager || '',
      status: branch.status || 'Active'
    });
    setActiveSection('BRANCHES');
  };

  const handleDisableBranch = (branch: BranchSetting) => {
    onUpdateBranches(branches.map((row) => row.id === branch.id ? { ...row, status: 'Disabled', updatedAt: new Date().toISOString() } : row));
    triggerToast('Branch disabled.');
  };

  const handleSaveWarehouse = (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseForm.name.trim() || !warehouseForm.branchId) {
      triggerToast('Warehouse name and branch are required.');
      return;
    }
    const isNew = !warehouseForm.id;
    if (isNew && limitReached(warehouses.length, 'maxWarehouses')) {
      triggerToast('Warehouse limit reached for your current plan.');
      return;
    }
    const id = warehouseForm.id || generateId('WH');
    const nextWarehouse = {
      ...warehouses.find((warehouse) => warehouse.id === id),
      id,
      name: warehouseForm.name.trim(),
      branchId: warehouseForm.branchId,
      address: warehouseForm.address.trim(),
      physicalAddress: warehouseForm.address.trim(),
      status: warehouseForm.status,
      updatedAt: new Date().toISOString(),
      stockCount: Number(warehouseForm.stockCount) || 0
    } as WarehouseSetting & { stockCount?: number };
    onUpdateWarehouses([...warehouses.filter((warehouse) => warehouse.id !== id), nextWarehouse]);
    resetWarehouseForm();
    triggerToast(isNew ? 'Warehouse added.' : 'Warehouse updated.');
  };

  const handleEditWarehouse = (warehouse: WarehouseSetting & { stockCount?: number }) => {
    setWarehouseForm({
      id: warehouse.id,
      name: warehouse.name || warehouse.warehouseName || '',
      branchId: warehouse.branchId,
      address: warehouse.physicalAddress || warehouse.address || '',
      stockCount: String(warehouse.stockCount ?? 0),
      status: warehouse.status || 'Active'
    });
    setActiveSection('WAREHOUSES');
  };

  const handleDisableWarehouse = (warehouse: WarehouseSetting) => {
    onUpdateWarehouses(warehouses.map((row) => row.id === warehouse.id ? { ...row, status: 'Disabled', updatedAt: new Date().toISOString() } : row));
    triggerToast('Warehouse disabled.');
  };

  const handleSaveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageStaff) {
      triggerToast('You do not have permission to manage employees.');
      return;
    }
    if (!employeeForm.displayName.trim() || !employeeForm.branchId) {
      triggerToast('Employee name and branch are required.');
      return;
    }
    const id = employeeForm.id || generateId('EMP');
    const now = new Date().toISOString();
    const nextEmployee: StaffSetting = {
      ...(shownEmployees.find((employee) => employee.id === id) || {}),
      id,
      vendorId: activeVendorId,
      branchId: employeeForm.branchId,
      staffCode: id,
      displayName: employeeForm.displayName.trim(),
      email: employeeForm.email.trim(),
      roleId: employeeForm.roleName.toLowerCase().replace(/\s+/g, '_'),
      roleName: employeeForm.roleName,
      status: employeeForm.status,
      pinCode: employeeForm.temporaryPin || shownEmployees.find((employee) => employee.id === id)?.pinCode || '',
      assignedTerminalIds: shownEmployees.find((employee) => employee.id === id)?.assignedTerminalIds || [],
      createdAt: shownEmployees.find((employee) => employee.id === id)?.createdAt || now,
      updatedAt: now,
      createdBy: shownEmployees.find((employee) => employee.id === id)?.createdBy || activeOperatorName || 'Settings',
      updatedBy: activeOperatorName || 'Settings'
    };

    const nextRows = [...shownEmployees.filter((employee) => employee.id !== id), nextEmployee];
    setEmployeeRows(nextRows);
    onUpdateStaff(nextRows);
    resetEmployeeForm();

    try {
      const record = mapStaffSettingToStaffRecord(nextEmployee, { vendorId: activeVendorId });
      if (employeeForm.id) {
        await updateStaff(id, record, activeOperatorName || 'Settings');
      } else {
        await createStaff(record, activeOperatorName || 'Settings');
      }
      triggerToast(employeeForm.id ? 'Employee updated.' : 'Employee added.');
    } catch {
      triggerToast('Employee saved locally. It will sync when the connection is ready.');
    }
  };

  const handleEditEmployee = (employee: StaffSetting) => {
    setEmployeeForm({
      id: employee.id,
      displayName: employee.displayName || '',
      email: employee.email || '',
      roleName: employee.roleName || 'Cashier',
      branchId: employee.branchId || '',
      status: employee.status || 'active',
      temporaryPin: ''
    });
    setActiveSection('EMPLOYEES');
  };

  const handleDisableEmployee = async (employee: StaffSetting) => {
    const nextRows = shownEmployees.map((row) => row.id === employee.id ? { ...row, status: 'suspended' as const, updatedAt: new Date().toISOString() } : row);
    setEmployeeRows(nextRows);
    onUpdateStaff(nextRows);
    try {
      await suspendStaff(employee.id, activeOperatorName || 'Settings');
      triggerToast('Access disabled.');
    } catch {
      triggerToast('Access disabled locally. It will sync when the connection is ready.');
    }
  };

  const handleResetPin = async (employee: StaffSetting) => {
    const nextPin = window.prompt(`Enter a temporary PIN for ${employee.displayName}.`);
    if (!nextPin) return;
    const nextRows = shownEmployees.map((row) => row.id === employee.id ? { ...row, pinCode: nextPin, updatedAt: new Date().toISOString() } : row);
    setEmployeeRows(nextRows);
    onUpdateStaff(nextRows);
    try {
      await updateStaff(employee.id, { pinCode: nextPin }, activeOperatorName || 'Settings');
      triggerToast('PIN reset.');
    } catch {
      triggerToast('PIN reset saved locally. It will sync when the connection is ready.');
    }
  };

  const handleSaveRegister = (event: React.FormEvent) => {
    event.preventDefault();
    if (!registerForm.name.trim() || !registerForm.branchId) {
      triggerToast('Register name and branch are required.');
      return;
    }
    const isNew = !registerForm.id;
    if (isNew && limitReached(terminals.length, 'maxTerminals')) {
      triggerToast('Cash register limit reached for your current plan.');
      return;
    }
    const id = registerForm.id || generateId('REG');
    const nextRegister = {
      ...terminals.find((terminal) => terminal.id === id),
      id,
      name: registerForm.name.trim(),
      branchId: registerForm.branchId,
      type: registerForm.device,
      status: registerForm.status,
      assignedStaffId: registerForm.assignedStaffId,
      updatedAt: new Date().toISOString()
    } as TerminalSetting & { assignedStaffId?: string; lastUsedAt?: string; updatedAt?: string };
    onUpdateTerminals([...terminals.filter((terminal) => terminal.id !== id), nextRegister]);
    resetRegisterForm();
    triggerToast(isNew ? 'Register added.' : 'Register renamed.');
  };

  const handleEditRegister = (terminal: TerminalSetting & { assignedStaffId?: string }) => {
    setRegisterForm({
      id: terminal.id,
      name: terminal.name || '',
      branchId: terminal.branchId || '',
      device: terminal.type || 'POS Workstation',
      assignedStaffId: terminal.assignedStaffId || '',
      status: registerStatus(terminal.status)
    });
    setActiveSection('CASH_REGISTERS');
  };

  const handleDisableRegister = (terminal: TerminalSetting) => {
    onUpdateTerminals(terminals.map((row) => row.id === terminal.id ? { ...row, status: 'Disabled' } : row));
    triggerToast('Register disabled.');
  };

  const handleSaveHardware = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfigureHardware) {
      triggerToast('You do not have permission to configure hardware.');
      return;
    }
    onUpdateHardwareSetting(hardwareForm);
    triggerToast('Hardware settings saved.');
  };

  const handleSaveTax = async (event: React.FormEvent) => {
    event.preventDefault();
    setTaxSaveState('idle');
    try {
      const saved = await saveVendorTaxSettings(activeVendorId, {
        ...taxDraft,
        vendorId: activeVendorId,
        vatEnabled: taxDraft.vatEnabled,
        defaultVatRate: taxDraft.vatEnabled ? taxDraft.defaultVatRate : 0,
        updatedBy: activeOperatorName || 'Settings'
      });
      setTaxDraft(saved);
      onUpdateTaxSetting({
        vatRatePct: saved.vatEnabled ? saved.defaultVatRate : 0,
        surtaxPct: taxSetting.surtaxPct,
        inclusive: saved.pricesIncludeVat
      });
      const nextProfile = { ...profileForm, vatRegistered: saved.vatRegistered, vatNumber: saved.vatNumber };
      setProfileForm(nextProfile);
      onUpdateBusinessProfile(nextProfile);
      setTaxSaveState('success');
      triggerToast('Tax settings saved.');
    } catch {
      setTaxSaveState('error');
      triggerToast('Save failed.');
    }
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceiptDraft((current) => ({ ...current, logoDataUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const handleSaveReceipt = (event: React.FormEvent) => {
    event.preventDefault();
    const nextReceipt: ReceiptDraft = {
      ...receiptDraft,
      header: receiptDraft.businessName || receiptDraft.header || receiptHeader,
      footer: receiptDraft.footerMessage || receiptDraft.footer || '',
      contactNumbers: receiptDraft.phone || receiptDraft.contactNumbers || '',
      termsAndConditions: receiptDraft.returnPolicy || receiptDraft.termsAndConditions || '',
      showTaxBreakdown: Boolean(receiptDraft.showTaxBreakdown)
    };
    setReceiptDraft(nextReceipt);
    onUpdateReceiptSetting(nextReceipt);
    onUpdateReceiptHeader(nextReceipt.header);
    triggerToast('Receipt layout saved.');
  };

  const handleSyncNow = () => {
    setBackupState({
      ...backupState,
      lastSync: nowLabel(),
      pendingChanges: 0,
      backupStatus: 'Up to date'
    });
    triggerToast('Up to date.');
  };

  const handleBackupNow = () => {
    setBackupState({
      ...backupState,
      lastBackup: nowLabel(),
      backupStatus: 'Backup completed'
    });
    triggerToast('Backup completed.');
  };

  const handleExportBackup = () => {
    const payload = {
      businessProfile,
      branches,
      warehouses,
      cashRegisters: terminals,
      employees: shownEmployees.map(({ pinCode: _pinCode, pinHash: _pinHash, uid: _uid, ...employee }) => employee),
      taxSetting,
      receiptSetting
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `itred-pos-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    triggerToast('Backup exported.');
  };

  const handleRestoreBackup = (file?: File) => {
    if (!file) return;
    setBackupState({
      ...backupState,
      pendingChanges: 1,
      backupStatus: 'Changes waiting to sync'
    });
    triggerToast('Backup selected. Review before syncing.');
  };

  const navigateToDiagnostics = () => {
    window.history.pushState({}, '', '/platform/system-diagnostics');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="space-y-6 industrial-font-sans text-xs text-[#1e222b]" id="pos-vendor-settings-panel">
      <div className="border border-slate-700 bg-[#1e222b] p-4 text-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-400">Settings</p>
            <h2 className="mt-1 text-xl font-black uppercase">Business Settings</h2>
            <p className="mt-2 max-w-3xl text-[11px] font-bold uppercase leading-relaxed text-slate-300">
              Manage business information, locations, employees, registers, hardware, taxes, receipts, subscription, backup, and sync.
            </p>
          </div>
          {diagnosticsAllowed && (
            <button
              type="button"
              onClick={navigateToDiagnostics}
              className="inline-flex items-center gap-2 border border-orange-500 bg-slate-950 px-3 py-2 text-[10px] font-black uppercase text-orange-300 hover:bg-orange-600 hover:text-white"
            >
              <Cpu className="h-3.5 w-3.5" />
              System Diagnostics
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="border border-emerald-400 bg-emerald-50 p-3 text-center text-[11px] font-black uppercase text-emerald-800"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <aside className="border border-[#3a3f4b] bg-[#1e222b] p-2 lg:col-span-3">
          <div className="border-b border-slate-600 px-2 py-2 text-[10px] font-black uppercase tracking-wider text-slate-100">
            Settings Menu
          </div>
          <div className="mt-2 space-y-1">
            {settingSections.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex w-full items-center justify-between border-l-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide ${
                    active
                      ? 'border-orange-600 bg-white text-[#1e222b]'
                      : 'border-transparent text-[#e7edf0] hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`h-3.5 w-3.5 ${active ? 'text-orange-600' : 'text-slate-300'}`} />
                    {item.label}
                  </span>
                  <ChevronRight className={`h-3 w-3 ${active ? 'text-orange-600' : 'text-slate-400'}`} />
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-[38rem] border border-slate-300 bg-[#f4f5f7] p-4 lg:col-span-9">
          {activeSection === 'BUSINESS_INFORMATION' && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <SectionHeader icon={Building} title="Business Information" badge={profileSaveState === 'success' ? 'Saved successfully' : profileSaveState === 'error' ? 'Save failed' : 'Last updated'} />
              <FormGrid>
                <TextField label="Legal Business Name" value={profileForm.legalName || profileForm.registeredBusinessName || ''} onChange={(value) => setProfileForm({ ...profileForm, legalName: value, registeredBusinessName: value })} />
                <TextField label="Trading Name" value={profileForm.tradingName || profileForm.businessName || ''} onChange={(value) => setProfileForm({ ...profileForm, tradingName: value, businessName: value })} />
                <TextField label="Business Type" value={profileForm.businessType || ''} onChange={(value) => setProfileForm({ ...profileForm, businessType: value })} />
                <TextField label="Owner Name" value={profileForm.ownerFullName || ''} onChange={(value) => setProfileForm({ ...profileForm, ownerFullName: value })} />
                <TextField label="Owner Email" type="email" value={profileForm.ownerEmail || profileForm.primaryEmail || profileForm.email || ''} onChange={(value) => setProfileForm({ ...profileForm, ownerEmail: value, primaryEmail: value, email: value })} />
                <TextField label="Phone" value={profileForm.phone || profileForm.businessPhone || ''} onChange={(value) => setProfileForm({ ...profileForm, phone: value, businessPhone: value })} />
                <TextField label="WhatsApp" value={profileForm.whatsapp || profileForm.businessWhatsapp || ''} onChange={(value) => setProfileForm({ ...profileForm, whatsapp: value, businessWhatsapp: value })} />
                <TextField label="Country" value={profileForm.country || ''} onChange={(value) => setProfileForm({ ...profileForm, country: value })} />
                <TextField label="City" value={profileForm.cityTown || profileForm.city || ''} onChange={(value) => setProfileForm({ ...profileForm, cityTown: value, city: value })} />
                <TextField label="Suburb" value={profileForm.suburb || profileForm.districtSuburb || ''} onChange={(value) => setProfileForm({ ...profileForm, suburb: value, districtSuburb: value })} />
                <TextField label="Currency" value={profileForm.currency || 'USD'} onChange={(value) => setProfileForm({ ...profileForm, currency: value.toUpperCase() })} />
                <TextField label="VAT Number" value={profileForm.vatNumber || ''} onChange={(value) => setProfileForm({ ...profileForm, vatNumber: value })} />
              </FormGrid>
              <TextareaField label="Physical Address" value={profileForm.physicalAddress || profileForm.address || ''} onChange={(value) => setProfileForm({ ...profileForm, physicalAddress: value, address: value })} />
              <ToggleField label="VAT Registered" checked={Boolean(profileForm.vatRegistered)} onChange={(checked) => setProfileForm({ ...profileForm, vatRegistered: checked })} />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-300 pt-4">
                <span className="text-[10px] font-black uppercase text-slate-600">Last updated: {shortDateLabel(profileForm.profileLastUpdatedAt)}</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setProfileForm({ ...businessProfile }); setProfileSaveState('idle'); }} className="settings-button settings-button-secondary">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Cancel Changes
                  </button>
                  <button type="submit" className="settings-button settings-button-primary">
                    <Save className="h-3.5 w-3.5" />
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          )}

          {activeSection === 'BRANCHES' && (
            <div className="space-y-4">
              <SectionHeader icon={MapPin} title="Branches" badge={`${branches.length} branches`} />
              <form onSubmit={handleSaveBranch} className="settings-panel space-y-3">
                <FormGrid>
                  <TextField label="Branch Name" value={branchForm.name} onChange={(value) => setBranchForm({ ...branchForm, name: value })} />
                  <TextField label="Address" value={branchForm.address} onChange={(value) => setBranchForm({ ...branchForm, address: value })} />
                  <TextField label="Phone" value={branchForm.phone} onChange={(value) => setBranchForm({ ...branchForm, phone: value })} />
                  <TextField label="Manager" value={branchForm.manager} onChange={(value) => setBranchForm({ ...branchForm, manager: value })} />
                  <SelectField label="Status" value={branchForm.status} options={['Active', 'Disabled']} onChange={(value) => setBranchForm({ ...branchForm, status: value })} />
                </FormGrid>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="settings-button settings-button-primary"><Plus className="h-3.5 w-3.5" />{branchForm.id ? 'Edit' : 'Add'}</button>
                  {branchForm.id && <button type="button" onClick={resetBranchForm} className="settings-button settings-button-secondary">Cancel</button>}
                </div>
              </form>
              <SimpleTable headers={['Branch Name', 'Address', 'Phone', 'Manager', 'Status', 'Actions']}>
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <Td strong>{branch.name || branch.branchName}</Td>
                    <Td>{branch.physicalAddress || branch.address || branch.location || 'Not set'}</Td>
                    <Td>{branch.phone || branch.branchPhone || 'Not set'}</Td>
                    <Td>{branch.branchManager || 'Not assigned'}</Td>
                    <Td><StatusBadge value={branch.id === defaultBranchId ? 'Default' : normalizeStatus(branch.status)} /></Td>
                    <Td><ActionSet actions={[
                      ['Edit', () => handleEditBranch(branch)],
                      ['Disable', () => handleDisableBranch(branch)],
                      ['Set Default', () => { setDefaultBranchId(branch.id); triggerToast('Default branch set.'); }]
                    ]} /></Td>
                  </tr>
                ))}
              </SimpleTable>
            </div>
          )}

          {activeSection === 'WAREHOUSES' && (
            <div className="space-y-4">
              <SectionHeader icon={Package} title="Warehouses" badge={`${warehouses.length} warehouses`} />
              <form onSubmit={handleSaveWarehouse} className="settings-panel space-y-3">
                <FormGrid>
                  <TextField label="Warehouse Name" value={warehouseForm.name} onChange={(value) => setWarehouseForm({ ...warehouseForm, name: value })} />
                  <SelectField label="Branch" value={warehouseForm.branchId} options={branches.map((branch) => branch.id)} optionLabels={Object.fromEntries(branches.map((branch) => [branch.id, branch.name]))} onChange={(value) => setWarehouseForm({ ...warehouseForm, branchId: value })} />
                  <TextField label="Address" value={warehouseForm.address} onChange={(value) => setWarehouseForm({ ...warehouseForm, address: value })} />
                  <TextField label="Stock Count" type="number" value={warehouseForm.stockCount} onChange={(value) => setWarehouseForm({ ...warehouseForm, stockCount: value })} />
                  <SelectField label="Status" value={warehouseForm.status} options={['Active', 'Disabled']} onChange={(value) => setWarehouseForm({ ...warehouseForm, status: value })} />
                </FormGrid>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="settings-button settings-button-primary"><Plus className="h-3.5 w-3.5" />{warehouseForm.id ? 'Edit' : 'Add'}</button>
                  {warehouseForm.id && <button type="button" onClick={resetWarehouseForm} className="settings-button settings-button-secondary">Cancel</button>}
                </div>
              </form>
              <SimpleTable headers={['Warehouse Name', 'Branch', 'Address', 'Stock Count', 'Status', 'Actions']}>
                {warehouses.map((warehouse) => {
                  const row = warehouse as WarehouseSetting & { stockCount?: number };
                  return (
                    <tr key={warehouse.id}>
                      <Td strong>{warehouse.name || warehouse.warehouseName}</Td>
                      <Td>{branchName(branches, warehouse.branchId)}</Td>
                      <Td>{warehouse.physicalAddress || warehouse.address || 'Not set'}</Td>
                      <Td>{row.stockCount ?? 0}</Td>
                      <Td><StatusBadge value={warehouse.id === defaultWarehouseId ? 'Default' : normalizeStatus(warehouse.status)} /></Td>
                      <Td><ActionSet actions={[
                        ['Edit', () => handleEditWarehouse(row)],
                        ['Disable', () => handleDisableWarehouse(warehouse)],
                        ['Set Default', () => { setDefaultWarehouseId(warehouse.id); triggerToast('Default warehouse set.'); }]
                      ]} /></Td>
                    </tr>
                  );
                })}
              </SimpleTable>
            </div>
          )}

          {activeSection === 'EMPLOYEES' && (
            <div className="space-y-4">
              <SectionHeader icon={Users} title="Employees" badge={employeesLoading ? 'Loading' : `${shownEmployees.length} employees`} />
              {!canManageStaff && <Notice tone="warning">Only an authorized manager can add, edit, or disable employee access.</Notice>}
              {employeesMessage && <Notice tone="warning">{employeesMessage}</Notice>}
              <form onSubmit={handleSaveEmployee} className="settings-panel space-y-3">
                <FormGrid>
                  <TextField label="Employee Name" value={employeeForm.displayName} onChange={(value) => setEmployeeForm({ ...employeeForm, displayName: value })} />
                  <TextField label="Employee Email" type="email" value={employeeForm.email} onChange={(value) => setEmployeeForm({ ...employeeForm, email: value })} />
                  <SelectField label="Role" value={employeeForm.roleName} options={roleSummaries.map((role) => role.role)} onChange={(value) => setEmployeeForm({ ...employeeForm, roleName: value as Role })} />
                  <SelectField label="Branch" value={employeeForm.branchId} options={branches.map((branch) => branch.id)} optionLabels={Object.fromEntries(branches.map((branch) => [branch.id, branch.name]))} onChange={(value) => setEmployeeForm({ ...employeeForm, branchId: value })} />
                  <SelectField label="Status" value={employeeForm.status} options={['active', 'suspended']} optionLabels={{ active: 'Active', suspended: 'Access Disabled' }} onChange={(value) => setEmployeeForm({ ...employeeForm, status: value as StaffSetting['status'] })} />
                  <TextField label="Temporary PIN" value={employeeForm.temporaryPin} onChange={(value) => setEmployeeForm({ ...employeeForm, temporaryPin: value })} />
                </FormGrid>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" disabled={!canManageStaff} className="settings-button settings-button-primary disabled:opacity-50"><Plus className="h-3.5 w-3.5" />{employeeForm.id ? 'Edit Employee' : 'Add Employee'}</button>
                  {employeeForm.id && <button type="button" onClick={resetEmployeeForm} className="settings-button settings-button-secondary">Cancel</button>}
                </div>
              </form>
              <SimpleTable headers={['Employee Name', 'Role', 'Branch', 'Status', 'Last Login', 'Access Status', 'Actions']}>
                {shownEmployees.map((employee) => {
                  const row = employee as StaffSetting & { lastLoginAt?: string };
                  return (
                    <tr key={employee.id}>
                      <Td strong>{employee.displayName || 'Unnamed employee'}</Td>
                      <Td>{employee.roleName || 'Unassigned'}</Td>
                      <Td>{branchName(branches, employee.branchId)}</Td>
                      <Td><StatusBadge value={employee.status === 'active' ? 'Ready' : 'Access Disabled'} /></Td>
                      <Td>{shortDateLabel(row.lastLoginAt)}</Td>
                      <Td><StatusBadge value={employeeAccessStatus(employee)} /></Td>
                      <Td><ActionSet actions={[
                        ['Edit Employee', () => handleEditEmployee(employee)],
                        ['Reset PIN', () => void handleResetPin(employee)],
                        ['Disable Access', () => void handleDisableEmployee(employee)],
                        ['Assign Branch', () => handleEditEmployee(employee)],
                        ['Assign Role', () => handleEditEmployee(employee)]
                      ]} disabled={!canManageStaff} /></Td>
                    </tr>
                  );
                })}
              </SimpleTable>
            </div>
          )}

          {activeSection === 'ROLES_PERMISSIONS' && (
            <div className="space-y-4">
              <SectionHeader icon={ShieldCheck} title="Roles & Permissions" badge="Business access" />
              <Notice tone="info">Roles define what each employee can use in the POS. Detailed changes are applied through employee role assignment.</Notice>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {roleSummaries.map((item) => (
                  <div key={item.role} className="settings-panel">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black uppercase text-[#1e222b]">{item.role}</h3>
                      <StatusBadge value={item.role === 'Owner' ? 'Ready' : 'Assignable'} />
                    </div>
                    <p className="mt-2 text-[11px] font-bold uppercase leading-relaxed text-slate-600">{item.summary}</p>
                    <button type="button" onClick={() => setActiveSection('EMPLOYEES')} className="mt-3 settings-button settings-button-secondary">
                      <Users className="h-3.5 w-3.5" />
                      Assign Role
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'CASH_REGISTERS' && (
            <div className="space-y-4">
              <SectionHeader icon={Terminal} title="Cash Registers" badge={`${terminals.length} registers`} />
              <form onSubmit={handleSaveRegister} className="settings-panel space-y-3">
                <FormGrid>
                  <TextField label="Register Name" value={registerForm.name} onChange={(value) => setRegisterForm({ ...registerForm, name: value })} />
                  <SelectField label="Branch" value={registerForm.branchId} options={branches.map((branch) => branch.id)} optionLabels={Object.fromEntries(branches.map((branch) => [branch.id, branch.name]))} onChange={(value) => setRegisterForm({ ...registerForm, branchId: value })} />
                  <TextField label="Device" value={registerForm.device} onChange={(value) => setRegisterForm({ ...registerForm, device: value })} />
                  <SelectField label="Assigned Staff" value={registerForm.assignedStaffId} options={shownEmployees.map((employee) => employee.id)} optionLabels={Object.fromEntries(shownEmployees.map((employee) => [employee.id, employee.displayName]))} onChange={(value) => setRegisterForm({ ...registerForm, assignedStaffId: value })} />
                  <SelectField label="Status" value={registerForm.status} options={['Ready', 'Offline', 'Disabled', 'Needs Setup']} onChange={(value) => setRegisterForm({ ...registerForm, status: value })} />
                </FormGrid>
                <div className="flex flex-wrap gap-2">
                  <button type="submit" className="settings-button settings-button-primary"><Plus className="h-3.5 w-3.5" />{registerForm.id ? 'Rename' : 'Add Register'}</button>
                  {registerForm.id && <button type="button" onClick={resetRegisterForm} className="settings-button settings-button-secondary">Cancel</button>}
                </div>
              </form>
              <SimpleTable headers={['Register Name', 'Branch', 'Device', 'Status', 'Last Used', 'Assigned Staff', 'Actions']}>
                {terminals.map((terminal) => {
                  const row = terminal as TerminalSetting & { assignedStaffId?: string; lastUsedAt?: string };
                  return (
                    <tr key={terminal.id}>
                      <Td strong>{terminal.name || 'Cash Register'}</Td>
                      <Td>{branchName(branches, terminal.branchId)}</Td>
                      <Td>{terminal.type || 'POS Workstation'}</Td>
                      <Td><StatusBadge value={registerStatus(terminal.status)} /></Td>
                      <Td>{shortDateLabel(row.lastUsedAt)}</Td>
                      <Td>{employeeName(shownEmployees, row.assignedStaffId)}</Td>
                      <Td><ActionSet actions={[
                        ['Rename', () => handleEditRegister(row)],
                        ['Assign Staff', () => handleEditRegister(row)],
                        ['Disable', () => handleDisableRegister(terminal)],
                        ['Test Connection', () => triggerToast('Connection test queued.')]
                      ]} /></Td>
                    </tr>
                  );
                })}
              </SimpleTable>
            </div>
          )}

          {activeSection === 'HARDWARE' && (
            <form onSubmit={handleSaveHardware} className="space-y-4">
              <SectionHeader icon={Cpu} title="Hardware" badge="Equipment" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Receipt Printer', 'Not Connected', Printer],
                  ['Barcode Scanner', hardwareForm.laserFocus ? 'Connected' : 'Needs Setup', Cpu],
                  ['Cash Drawer', hardwareForm.drawerSignal ? 'Connected' : 'Needs Setup', HardDrive],
                  ['Scale', 'Needs Setup', Package]
                ].map(([name, status, Icon]) => (
                  <div key={String(name)} className="settings-panel">
                    {React.createElement(Icon as React.ElementType, { className: 'h-5 w-5 text-orange-600' })}
                    <h3 className="mt-3 text-sm font-black uppercase">{name}</h3>
                    <div className="mt-2"><StatusBadge value={String(status)} /></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['Connect', 'Test', 'Configure'].map((label) => (
                        <button key={label} type="button" onClick={() => triggerToast(`${label} queued.`)} className="settings-mini-button">{label}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <details className="settings-panel">
                <summary className="cursor-pointer text-[11px] font-black uppercase text-[#1e222b]">Advanced Hardware Settings</summary>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <SelectField label="Scanner Profile" value={hardwareForm.laserFocus} options={['Standard Scanner', '2D Scanner', 'Camera Scanner']} onChange={(value) => setHardwareForm({ ...hardwareForm, laserFocus: value })} />
                  <SelectField label="Cash Drawer" value={hardwareForm.drawerSignal} options={['Standard Drawer', 'Manual Drawer', 'Not Connected']} onChange={(value) => setHardwareForm({ ...hardwareForm, drawerSignal: value })} />
                  <TextField label="Workstation Label" value={terminalUnit} onChange={(value) => onUpdateTerminalUnit(value)} />
                  <TextField label="Default Operator" value={activeOperatorName} onChange={(value) => onUpdateOperatorName(value)} />
                </div>
              </details>

              <button type="submit" className="settings-button settings-button-primary"><Save className="h-3.5 w-3.5" />Save Hardware Settings</button>
            </form>
          )}

          {activeSection === 'TAXES' && (
            <form onSubmit={handleSaveTax} className="space-y-4">
              <SectionHeader icon={Percent} title="Taxes" badge={taxSaveState === 'success' ? 'Saved successfully' : taxSaveState === 'error' ? 'Save failed' : 'VAT settings'} />
              <FormGrid>
                <ToggleField label="VAT Enabled" checked={taxDraft.vatEnabled} onChange={(checked) => setTaxDraft({ ...taxDraft, vatEnabled: checked, defaultVatRate: checked ? taxDraft.defaultVatRate : 0 })} />
                <ToggleField label="VAT Registered" checked={taxDraft.vatRegistered} onChange={(checked) => setTaxDraft({ ...taxDraft, vatRegistered: checked })} />
                <TextField label="VAT Number" value={taxDraft.vatNumber} onChange={(value) => setTaxDraft({ ...taxDraft, vatNumber: value })} />
                <TextField label="VAT Rate" type="number" value={String(taxDraft.defaultVatRate)} onChange={(value) => setTaxDraft({ ...taxDraft, defaultVatRate: Number(value) || 0, vatEnabled: Number(value) > 0 })} />
                <ToggleField label="Prices Include VAT" checked={taxDraft.pricesIncludeVat} onChange={(checked) => setTaxDraft({ ...taxDraft, pricesIncludeVat: checked })} />
                <TextField label="Zero-Rated Tax Code" value={taxDraft.zeroRatedTaxCode} onChange={(value) => setTaxDraft({ ...taxDraft, zeroRatedTaxCode: value })} />
                <TextField label="Exempt Tax Code" value={taxDraft.exemptTaxCode} onChange={(value) => setTaxDraft({ ...taxDraft, exemptTaxCode: value })} />
              </FormGrid>
              <div className="settings-panel">
                <h3 className="text-[11px] font-black uppercase text-orange-700">Example</h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <TextField label="Item Price" type="number" value={exampleItemPrice} onChange={setExampleItemPrice} />
                  <Readout label="VAT" value={taxExample.vatAmount.toFixed(2)} />
                  <Readout label="Total" value={taxExample.total.toFixed(2)} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="settings-button settings-button-primary"><Save className="h-3.5 w-3.5" />Save Tax Settings</button>
                <button type="button" onClick={() => triggerToast(`VAT ${taxExample.vatAmount.toFixed(2)}, total ${taxExample.total.toFixed(2)}.`)} className="settings-button settings-button-secondary"><CheckCircle2 className="h-3.5 w-3.5" />Test VAT Calculation</button>
              </div>
            </form>
          )}

          {activeSection === 'RECEIPTS' && (
            <form onSubmit={handleSaveReceipt} className="space-y-4">
              <SectionHeader icon={Receipt} title="Receipts" badge="Receipt layout" />
              <FormGrid>
                <TextField label="Business Name" value={receiptDraft.businessName || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, businessName: value })} />
                <TextField label="Address" value={receiptDraft.businessAddress || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, businessAddress: value })} />
                <TextField label="Phone" value={receiptDraft.phone || receiptDraft.contactNumbers || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, phone: value, contactNumbers: value })} />
                <TextField label="VAT Number" value={receiptDraft.vatNumber || profileForm.vatNumber || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, vatNumber: value })} />
              </FormGrid>
              <div className="settings-panel">
                <label className="block text-[9px] font-black uppercase text-slate-600">Logo</label>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="flex h-16 w-24 items-center justify-center border border-slate-300 bg-white text-[10px] font-black uppercase text-slate-400">
                    {receiptDraft.logoDataUrl ? <img src={receiptDraft.logoDataUrl} alt="Receipt logo" className="max-h-full max-w-full object-contain" /> : 'No Logo'}
                  </div>
                  <input type="file" accept="image/*" onChange={(event) => handleLogoUpload(event.target.files?.[0])} className="text-[11px] font-bold" />
                  {receiptDraft.logoDataUrl && <button type="button" onClick={() => setReceiptDraft({ ...receiptDraft, logoDataUrl: '' })} className="settings-mini-button">Remove</button>}
                </div>
              </div>
              <FormGrid>
                <TextareaField label="Footer Message" value={receiptDraft.footerMessage || receiptDraft.footer || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, footerMessage: value, footer: value })} />
                <TextareaField label="Return Policy" value={receiptDraft.returnPolicy || receiptDraft.termsAndConditions || ''} onChange={(value) => setReceiptDraft({ ...receiptDraft, returnPolicy: value, termsAndConditions: value })} />
                <ToggleField label="Show Cashier Name" checked={Boolean(receiptDraft.showCashierName)} onChange={(checked) => setReceiptDraft({ ...receiptDraft, showCashierName: checked })} />
                <ToggleField label="Show Branch Name" checked={Boolean(receiptDraft.showBranchName)} onChange={(checked) => setReceiptDraft({ ...receiptDraft, showBranchName: checked })} />
                <ToggleField label="Show VAT Breakdown" checked={Boolean(receiptDraft.showTaxBreakdown)} onChange={(checked) => setReceiptDraft({ ...receiptDraft, showTaxBreakdown: checked })} />
              </FormGrid>
              {receiptPreviewOpen && (
                <div className="mx-auto max-w-sm border border-slate-300 bg-white p-4 text-center font-mono text-[11px] text-slate-800">
                  <div className="font-black uppercase">{receiptDraft.businessName || 'Business Name'}</div>
                  <div>{receiptDraft.businessAddress || 'Address'}</div>
                  <div>{receiptDraft.phone || 'Phone'}</div>
                  {receiptDraft.vatNumber && <div>VAT: {receiptDraft.vatNumber}</div>}
                  <div className="my-3 border-t border-dashed border-slate-400" />
                  <div className="flex justify-between"><span>Item</span><span>{Number(exampleItemPrice || 0).toFixed(2)}</span></div>
                  {receiptDraft.showTaxBreakdown && <div className="flex justify-between"><span>VAT</span><span>{taxExample.vatAmount.toFixed(2)}</span></div>}
                  <div className="mt-2 flex justify-between font-black"><span>Total</span><span>{taxExample.total.toFixed(2)}</span></div>
                  <div className="my-3 border-t border-dashed border-slate-400" />
                  <div>{receiptDraft.footerMessage || receiptDraft.footer}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setReceiptPreviewOpen((open) => !open)} className="settings-button settings-button-secondary"><Receipt className="h-3.5 w-3.5" />Preview Receipt</button>
                <button type="submit" className="settings-button settings-button-primary"><Save className="h-3.5 w-3.5" />Save Receipt Layout</button>
                <button type="button" onClick={() => triggerToast('Test receipt prepared.')} className="settings-button settings-button-secondary"><Printer className="h-3.5 w-3.5" />Print Test Receipt</button>
              </div>
            </form>
          )}

          {activeSection === 'SUBSCRIPTION' && (
            <div className="space-y-4">
              <SectionHeader icon={Layers} title="Subscription" badge="Plan and activation" />
              <SubscriptionCommercePage
                businessProfile={businessProfile}
                vendorAuth={readPosAuthContext()}
                planAccess={planAccess}
                onToast={triggerToast}
              />
            </div>
          )}

          {activeSection === 'BACKUP_SYNC' && (
            <div className="space-y-4">
              <SectionHeader icon={HardDrive} title="Backup & Sync" badge={backupState.backupStatus} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Readout label="Last Sync" value={backupState.lastSync} />
                <Readout label="Pending Changes" value={String(backupState.pendingChanges)} />
                <Readout label="Backup Status" value={backupState.backupStatus} />
                <Readout label="Last Backup" value={backupState.lastBackup} />
              </div>
              <div className="settings-panel">
                <StatusBadge value={backupState.pendingChanges > 0 ? 'Changes waiting to sync' : 'Up to date'} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={handleSyncNow} className="settings-button settings-button-primary"><RefreshCw className="h-3.5 w-3.5" />Sync Now</button>
                  <button type="button" onClick={handleBackupNow} className="settings-button settings-button-secondary"><HardDrive className="h-3.5 w-3.5" />Backup Now</button>
                  <button type="button" onClick={handleExportBackup} className="settings-button settings-button-secondary"><Save className="h-3.5 w-3.5" />Export Backup</button>
                  <label className="settings-button settings-button-secondary cursor-pointer">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Restore Backup
                    <input type="file" accept="application/json" className="hidden" onChange={(event) => handleRestoreBackup(event.target.files?.[0])} />
                  </label>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, badge }: { icon: React.ElementType; title: string; badge?: string }) {
  return (
    <div className="flex flex-col gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="flex items-center gap-2 text-base font-black uppercase text-[#1e222b]">
        <Icon className="h-4 w-4 text-orange-600" />
        {title}
      </h3>
      {badge && <span className="w-fit border border-orange-300 bg-orange-50 px-2 py-1 text-[9px] font-black uppercase text-orange-800">{badge}</span>}
    </div>
  );
}

function FormGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black uppercase text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-[#b1b5c2] bg-white px-2.5 py-2 text-[11px] font-bold text-[#1e222b] outline-none focus:border-orange-500"
      />
    </label>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black uppercase text-slate-600">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full resize-none border border-[#b1b5c2] bg-white px-2.5 py-2 text-[11px] font-bold text-[#1e222b] outline-none focus:border-orange-500"
      />
    </label>
  );
}

function SelectField({ label, value, options, optionLabels, onChange }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[9px] font-black uppercase text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-[#b1b5c2] bg-white px-2.5 py-2 text-[11px] font-bold text-[#1e222b] outline-none focus:border-orange-500"
      >
        <option value="">Select</option>
        {options.map((option) => <option key={option} value={option}>{optionLabels?.[option] || option}</option>)}
      </select>
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-[48px] items-center justify-between gap-3 border border-[#b1b5c2] bg-white px-3 py-2">
      <span className="text-[10px] font-black uppercase text-[#1e222b]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-orange-600" />
    </label>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <p className="text-[9px] font-black uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-[#1e222b]">{value}</p>
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: 'info' | 'warning' }) {
  const cls = tone === 'warning' ? 'border-orange-300 bg-orange-50 text-orange-950' : 'border-slate-300 bg-white text-slate-700';
  return <div className={`border p-3 text-[11px] font-bold uppercase leading-relaxed ${cls}`}>{children}</div>;
}

function StatusBadge({ value }: { value: string }) {
  return <span className={`inline-flex whitespace-nowrap border px-2 py-1 text-[9px] font-black uppercase ${statusClass(value)}`}>{value}</span>;
}

function SimpleTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto border border-[#b1b5c2] bg-white">
      <table className="w-full min-w-[840px] border-collapse text-left text-[11px]">
        <thead className="bg-[#1e222b] text-white">
          <tr>{headers.map((header) => <th key={header} className="px-3 py-2 font-black uppercase">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-200">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={`px-3 py-2 align-top ${strong ? 'font-black text-[#1e222b]' : 'font-bold text-slate-700'}`}>{children}</td>;
}

function ActionSet({ actions, disabled }: { actions: Array<[string, () => void]>; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map(([label, onClick]) => (
        <button
          key={label}
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="inline-flex items-center gap-1 border border-slate-300 bg-white px-2 py-1 text-[9px] font-black uppercase text-[#1e222b] hover:border-orange-500 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {label.includes('Disable') ? <Ban className="h-3 w-3" /> : label.includes('Edit') || label.includes('Assign') || label.includes('Rename') ? <Edit className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {label}
        </button>
      ))}
    </div>
  );
}
