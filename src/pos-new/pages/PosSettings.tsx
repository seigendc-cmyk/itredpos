import React, { useState } from 'react';
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
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PosPageId, 
  BusinessProfile, 
  BranchSetting, 
  WarehouseSetting, 
  TerminalSetting, 
  StaffSetting, 
  HardwareSetting, 
  TaxSetting, 
  ReceiptSetting
} from '../types';
import { Role } from '../types';
import { getAllowedMenusForRole, hasPermission } from '../utils/posPermissions';
import A5FloatingForm from '../components/A5FloatingForm';

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
  rolePermissions: Record<string, PosPageId[]>;
  onUpdateRolePermissions: (permissions: Record<string, PosPageId[]>) => void;
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
}

type SettingsSectionId = 
  | 'BUSINESS_PROFILE' 
  | 'BRANCHES' 
  | 'WAREHOUSES' 
  | 'TERMINALS' 
  | 'STAFF' 
  | 'ROLES' 
  | 'HARDWARE' 
  | 'TAX' 
  | 'RECEIPT'
  | 'BUILD_STATUS'
  | 'RESET';

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
  rolePermissions,
  onUpdateRolePermissions,
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
  activeRole
}: PosSettingsProps) {

  // Current active configuration section tab
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('BUSINESS_PROFILE');
  
  // Feedback Toasts / Banner messages
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- SUB-FORM 1: BUSINESS PROFILE STATES ---
  const [profileForm, setProfileForm] = useState<BusinessProfile>({ ...businessProfile });
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.isBusinessRegistered && !profileForm.companyRegistrationNumber?.trim()) {
      alert("COMPANY REGISTRATION NUMBER IS REQUIRED WHEN BUSINESS REGISTERED IS ENABLED.");
      return;
    }
    if (profileForm.vatRegistered && !profileForm.vatNumber?.trim()) {
      alert("VAT NUMBER IS REQUIRED WHEN VAT REGISTERED IS ENABLED.");
      return;
    }
    onUpdateBusinessProfile(profileForm);
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
    const nextBranch: BranchSetting = {
      ...branchForm,
      id: branchId.toUpperCase(),
      branchCode: (branchForm.branchCode || branchId).toUpperCase(),
      name: branchForm.name || branchForm.branchCode || 'New Branch',
      location: branchForm.location || [branchForm.cityTown, branchForm.district].filter(Boolean).join(', ') || 'Unassigned',
      vendorId: branchForm.vendorId || 'SCI-LOG-ZW',
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
    const nextWarehouse: WarehouseSetting = {
      ...warehouseForm,
      id: warehouseId.toUpperCase(),
      warehouseCode: (warehouseForm.warehouseCode || warehouseId).toUpperCase(),
      name: warehouseForm.name || warehouseForm.warehouseCode || 'New Warehouse',
      branchId: warehouseForm.branchId || branches[0]?.id || 'BR-HARARE',
      vendorId: warehouseForm.vendorId || 'SCI-LOG-ZW',
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
  const [staffForm, setStaffForm] = useState<StaffSetting>({ id: '', name: '', email: '', role: 'Cashier', pass: '', branchId: '' });
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [revealPassId, setRevealPassId] = useState<string | null>(null);
  const handleAddOrEditStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.id || !staffForm.name || !staffForm.email || !staffForm.pass || !staffForm.branchId) {
      alert("ENSURE ALL CLERK ATTRIBUTES, KEYWAY PASSWORDS, AND WORK LOCATION ARE REGISTERED.");
      return;
    }
    const existsIdx = staff.findIndex(s => s.id.toUpperCase() === staffForm.id.toUpperCase());
    if (isEditingStaff) {
      onUpdateStaff(staff.map(s => s.id.toUpperCase() === staffForm.id.toUpperCase() ? staffForm : s));
      triggerToast(`STAFF PROFILE FOR ${staffForm.name} COMMITTED.`);
      setIsEditingStaff(false);
    } else {
      if (existsIdx !== -1) {
        alert("CRITICAL CONFLICT: EMPLOYEE CLERK REGISTER CARD ALREADY ACTIVE.");
        return;
      }
      onUpdateStaff([...staff, staffForm]);
      triggerToast(`CLERK ${staffForm.name} INDUCTED.`);
    }
    setStaffForm({ id: '', name: '', email: '', role: 'Cashier', pass: '', branchId: '' });
  };
  const handleEditStaffClick = (s: StaffSetting) => {
    setStaffForm(s);
    setIsEditingStaff(true);
  };
  const handleDeleteStaff = (id: string) => {
    if (confirm(`REMOVE STAFF CLERK ${id} FROM ALL GATEWAY PROTOCOLS?`)) {
      onUpdateStaff(staff.filter(s => s.id !== id));
      triggerToast(`CLERK ID ${id} EXPELLED.`);
    }
  };

  // --- SUB-FORM 6: ROLES & PERMISSIONS CHECKBOX TOGGLE MATRIX ---
  const AVAILABLE_ROLES = ['Owner', 'SysAdmin', 'Manager', 'Supervisor', 'Cashier', 'Stock Controller'] as const;
  const MENU_MAP: { id: PosPageId, label: string }[] = [
    { id: 'DASHBOARD', label: 'Dashboard Main' },
    { id: 'OWNER_DESK', label: 'Owner Desk' },
    { id: 'SALES', label: 'Sales Terminal' },
    { id: 'DELIVERY', label: 'Delivery Desk' },
    { id: 'STOCK', label: 'Stock Control Hub' },
    { id: 'SHIFT', label: 'Shift Logging' },
    { id: 'CASH', label: 'Cash Drawer Control' },
    { id: 'BI_DESK', label: 'BI Desk Audits' },
    { id: 'SYNC_DESK', label: 'Sync Control Desk' },
    { id: 'SETTINGS', label: 'Config Settings' },
  ];
  const togglePermission = (role: string, pageId: PosPageId) => {
    const current = rolePermissions[role] || [];
    const updated = current.includes(pageId)
      ? current.filter(p => p !== pageId)
      : [...current, pageId];
    
    const updatedMap = {
      ...rolePermissions,
      [role]: updated
    };
    onUpdateRolePermissions(updatedMap);
    triggerToast(`PERMISSIONS REDEFINED FOR ROLE: ${role.toUpperCase()}`);
  };

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
  const handleSaveReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateReceiptSetting(recForm);
    // Sync the older props
    onUpdateReceiptHeader(recForm.header);
    triggerToast("THERMAL SLIP INVOICING PRINT PATTERNS COMMITTED.");
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
    { id: 'BRANCHES' as const, label: 'Branches Registry', icon: MapPin, color: 'text-[#00f0ff]' },
    { id: 'WAREHOUSES' as const, label: 'Warehouses Hub', icon: Package, color: 'text-purple-400' },
    { id: 'TERMINALS' as const, label: 'Terminal Registry', icon: Terminal, color: 'text-amber-500' },
    { id: 'STAFF' as const, label: 'Staff Database', icon: Users, color: 'text-emerald-400' },
    { id: 'ROLES' as const, label: 'Roles & Permissions', icon: ShieldCheck, color: 'text-blue-400' },
    { id: 'HARDWARE' as const, label: 'Hardware Config', icon: Cpu, color: 'text-orange-400' },
    { id: 'TAX' as const, label: 'Tax & VAT Settings', icon: Percent, color: 'text-rose-450' },
    { id: 'RECEIPT' as const, label: 'Receipt Blueprint', icon: Receipt, color: 'text-pink-400' },
    { id: 'BUILD_STATUS' as const, label: 'Build Status', icon: Info, color: 'text-orange-500' },
    { id: 'RESET' as const, label: 'System Maintenance', icon: AlertTriangle, color: 'text-red-500 font-extrabold' },
  ];

  const hardwareDevices = [
    { deviceName: 'Cash Drawer', connectionType: hardForm.drawerSignal, status: 'Ready', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Receipt Printer', connectionType: 'USB / Network', status: 'Not Connected', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Barcode Scanner', connectionType: 'USB HID', status: 'Ready', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Laser Scanner', connectionType: hardForm.laserFocus, status: 'Ready', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Customer Display', connectionType: 'USB / Serial', status: 'Not Connected', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'USB Camera', connectionType: 'USB Camera', status: 'Not Connected', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Fiscal Device', connectionType: 'Not Connected', status: 'Disabled In Development', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' },
    { deviceName: 'Terminal Device Settings', connectionType: terminalUnit, status: 'Configured', lastTest: 'Placeholder', permissionRequired: 'hardware.configure' }
  ];

  const canConfigureHardware = activeRole ? hasPermission(activeRole as Role, 'hardware.configure') : false;
  const handleHardwareDeviceAction = (label: string) => {
    if (!canConfigureHardware) {
      triggerToast('You do not have permission to perform this action.');
      return;
    }
    triggerToast(`${label} placeholder queued.`);
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
          Manage business profile, branches, staff, receipts, taxes, permissions, and terminal devices. <span className="text-orange-700 font-bold">Build Development</span>
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
        <div className="lg:col-span-3 bg-[#11141d] border border-slate-750 p-2 space-y-0.5">
          <div className="text-[10px] text-slate-650 font-bold font-mono py-1 px-2.5 uppercase tracking-wider border-b border-slate-800/80 flex items-center justify-between mb-2">
            <span>Settings Menu</span>
            <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-[#00f0ff]">Local</span>
          </div>

          <div className="space-y-1">
            {sidebarNavItems.map(item => {
              const IconComp = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
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
                      ? 'bg-slate-950 text-slate-100 font-bold border-[#00f0ff]' 
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-900/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#00f0ff]' : 'text-slate-500'}`} />
                    <span className="uppercase tracking-wide">{item.label}</span>
                  </div>
                  <ChevronRight size={10} className={isActive ? 'text-[#00f0ff]' : 'text-slate-600'} />
                </button>
              );
            })}
          </div>

          {/* CLERK DIAL METADATA INDICATOR */}
          <div className="p-3 bg-slate-950 border border-slate-850 mt-4 text-[9px] space-y-1 text-slate-500 font-mono uppercase">
            <div>Product: <span className="text-[#00f0ff]">iTred Commerce POS</span></div>
            <div>Mode: Build Development</div>
            <div>Backend: Mock / Local Services</div>
          </div>
        </div>

        {/* DETAILS WORKSPACE FORMS (9 columns) */}
        <div className="lg:col-span-9 bg-[#141822] border border-slate-700 p-6 rounded-none min-h-[35rem] flex flex-col justify-between font-mono">
          
          {/* CONTENT SECTOR SWITCHER */}
          <div className="space-y-6 flex-1">

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

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Configure corporate identifiers which print immediately on top invoice structures, secure tax audits, and ledger reports.
                </p>

                <div className="bg-slate-950 border border-slate-850 p-4 space-y-4">
                  <div className="text-[10px] text-orange-400 font-black uppercase tracking-widest">Industrial Business Registry</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Business Name</label>
                      <input
                        type="text"
                        value={profileForm.businessName || ''}
                        onChange={e => setProfileForm({ ...profileForm, businessName: e.target.value, legalName: e.target.value || profileForm.legalName })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Trading Name</label>
                      <input
                        type="text"
                        value={profileForm.tradingName || ''}
                        onChange={e => setProfileForm({ ...profileForm, tradingName: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Business Type</label>
                      <select
                        value={profileForm.businessType || 'Private Company'}
                        onChange={e => setProfileForm({ ...profileForm, businessType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-200 text-xs outline-none"
                      >
                        <option>Private Company</option>
                        <option>Partnership</option>
                        <option>Sole Proprietor</option>
                        <option>Cooperative</option>
                        <option>Government</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">Industrial Sector</label>
                      <input
                        type="text"
                        value={profileForm.industrialSector || ''}
                        onChange={e => setProfileForm({ ...profileForm, industrialSector: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">City / Town</label>
                      <input
                        type="text"
                        value={profileForm.cityTown || ''}
                        onChange={e => setProfileForm({ ...profileForm, cityTown: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-500 text-[10px] uppercase font-bold">District / Suburb</label>
                      <input
                        type="text"
                        value={[profileForm.district, profileForm.suburb].filter(Boolean).join(' / ')}
                        onChange={e => setProfileForm({ ...profileForm, district: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-slate-100 text-xs outline-none focus:border-[#00f0ff]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t border-slate-900">
                    <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-300">
                      <input
                        type="checkbox"
                        checked={!!profileForm.isBusinessRegistered}
                        onChange={e => setProfileForm({ ...profileForm, isBusinessRegistered: e.target.checked })}
                        className="accent-orange-500"
                      />
                      Registered Business
                    </label>
                    <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-300">
                      <input
                        type="checkbox"
                        checked={!!profileForm.vatRegistered}
                        onChange={e => setProfileForm({ ...profileForm, vatRegistered: e.target.checked })}
                        className="accent-orange-500"
                      />
                      VAT Registered
                    </label>
                    <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-300">
                      <input
                        type="checkbox"
                        checked={!!profileForm.isTaxCollector}
                        onChange={e => setProfileForm({ ...profileForm, isTaxCollector: e.target.checked })}
                        className="accent-orange-500"
                      />
                      Tax Collector
                    </label>
                    <div className="text-[10px] text-emerald-400 uppercase font-black">Status: {profileForm.businessStatus || 'Active'}</div>
                  </div>

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
                  <div className="text-[10px] font-bold text-slate-400 uppercase">ACTIVE INDUSTRIAL LOCALITIES</div>
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
                  <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">ACTIVE HARDWARE SLOTS ON LOCAL AREA LINK</div>
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
                    STAFF CLERK DIRECTORY ENGINE [{staff.length} ID CARDS]
                  </span>
                  <span className="text-[9px] bg-slate-950 px-1 py-0.2 text-[#00f0ff]">LOCKOUT SAFEGUARD ON</span>
                </div>

                {/* Staff register form */}
                <form onSubmit={handleAddOrEditStaff} className="p-4 bg-slate-950 border border-slate-900 space-y-3">
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
                      <label className="block text-slate-500 mb-1 text-[9px]">LEGAL FULL NAME</label>
                      <input 
                        type="text" 
                        value={staffForm.name}
                        onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                        placeholder="e.g. Donald Vance"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-white focus:border-[#00f0ff]"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 mb-1 text-[9px]">LOCAL SYSTEM CORRESPONDING EMAIL</label>
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
                        value={staffForm.role}
                        onChange={e => setStaffForm({ ...staffForm, role: e.target.value as any })}
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
                        value={staffForm.pass}
                        onChange={e => setStaffForm({ ...staffForm, pass: e.target.value })}
                        placeholder="Enter secure password"
                        className="w-full bg-slate-900 border border-slate-800 p-2 text-xs outline-none text-amber-500 focus:border-amber-500 font-bold tracking-widest"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black uppercase tracking-wider px-4 py-2 text-[10px] rounded-none cursor-pointer flex items-center gap-1.5"
                    >
                      {isEditingStaff ? <Save className="w-3 h-3 text-slate-950" /> : <Plus className="w-3 h-3 text-slate-950" />}
                      <span>{isEditingStaff ? 'UPDATE USER CARD' : 'INDUCT OPERATOR'}</span>
                    </button>
                    {isEditingStaff && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingStaff(false);
                          setStaffForm({ id: '', name: '', email: '', role: 'Cashier', pass: '', branchId: '' });
                        }}
                        className="bg-slate-800 text-slate-400 py-2 px-4 hover:bg-slate-700 uppercase font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                {/* Staff List Table */}
                <div className="space-y-2 font-mono">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">ACTIVE OPERATOR CREWMEMBERS IN CONGRUENCY</div>
                  <div className="border border-slate-800 divide-y divide-slate-950 font-mono">
                    {staff.map(s => {
                      const branchAssoc = branches.find(b => b.id === s.branchId)?.name || 'HEAD_BASE';
                      const isRevealed = revealPassId === s.id;
                      return (
                        <div key={s.id} className="p-3 bg-slate-950/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[#00f0ff] font-bold">{s.id}</span>
                              <span className="text-white font-bold">{s.name}</span>
                              <span className="text-[9px] bg-slate-900 border border-slate-800 text-amber-500/80 px-1.5 font-bold uppercase">{s.role}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase mt-0.5">
                              {s.email} • BRCH: {branchAssoc}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3 self-end md:self-auto">
                            {/* Password Reveal Indicator */}
                            <div className="flex items-center gap-1 bg-slate-900 py-1 px-2 border border-slate-850 rounded-none text-[10px]">
                              <span className="text-slate-500 mr-1 uppercase">PIN COGN:</span>
                              <span className="text-amber-500 font-extrabold tracking-widest text-[11px] whitespace-nowrap">
                                {isRevealed ? s.pass : '••••••'}
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
                                className="p-1 px-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-[#00f0ff] hover:bg-slate-950 cursor-pointer text-[10px]"
                              >
                                <Edit size={11} />
                              </button>
                              <button
                                onClick={() => handleDeleteStaff(s.id)}
                                className="p-1 px-2 bg-slate-900 border border-slate-800 text-rose-500 hover:text-white hover:bg-rose-950 cursor-pointer text-[10px]"
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

            {/* TAB 6: ROLES & PERMISSIONS checkbox toggle matrix */}
            {activeSection === 'ROLES' && (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-2 flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    ROLE-BASED PERMISSION ACCESS GATES [MATRIX CHECK]
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const defaults: Record<string, PosPageId[]> = {
                          'Owner': getAllowedMenusForRole('Owner'),
                          'SysAdmin': getAllowedMenusForRole('SysAdmin'),
                          'Manager': getAllowedMenusForRole('Manager'),
                          'Supervisor': getAllowedMenusForRole('Supervisor'),
                          'Cashier': getAllowedMenusForRole('Cashier'),
                          'Stock Controller': getAllowedMenusForRole('Stock Controller')
                        };
                        onUpdateRolePermissions(defaults);
                        triggerToast("PERMISSIONS RESET TO SYSTEM DEFAULTS");
                      }}
                      className="text-[9.5px] bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 px-2.5 py-1 uppercase font-bold cursor-pointer transition-colors"
                    >
                      Reset to Defaults
                    </button>
                    <span className="text-[9px] bg-slate-950 px-1 py-1 border border-slate-800 text-[#00f0ff]">LIVE SHELL INJECTED</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-450 uppercase leading-relaxed mb-4">
                  Define the exact security clearance rules below. Checking a box maps authorization to the corresponding navigation page. <span className="text-amber-500 font-bold">Unchecked modules completely disappear from the clerk's menu and lock structural bypasses.</span>
                </p>

                {/* The Permission Table Matrix */}
                <div className="overflow-x-auto border border-slate-850 pos-custom-scroll bg-slate-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800">
                        <th className="p-3 text-[10px] text-slate-400 uppercase font-black tracking-wider">SYSTEM ROLES [6 CLUSTERS]</th>
                        {MENU_MAP.map(m => (
                          <th key={m.id} className="p-3 text-[9px] text-slate-400 text-center uppercase font-black tracking-wider leading-snug max-w-[90px]">{m.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900 bg-slate-950/60">
                      {AVAILABLE_ROLES.map(role => {
                        const permittedPages = rolePermissions[role] || [];
                        return (
                          <tr key={role} className="hover:bg-slate-900/40 transition-colors">
                            <td className="p-3 font-bold text-slate-200">
                              <span className="text-[#00f0ff] mr-1.5">•</span>
                              {role}
                            </td>
                            {MENU_MAP.map(menu => {
                              const isChecked = permittedPages.includes(menu.id);
                              return (
                                <td key={menu.id} className="p-3 text-center align-middle">
                                  <label className="inline-flex items-center justify-center cursor-pointer p-2 hover:bg-slate-905">
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked}
                                      onChange={() => togglePermission(role, menu.id)}
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
                    <span className="font-bold text-slate-300 block mb-1">HYPER-SECURE LOCAL OVERLAY VERIFIED</span>
                    Changing these toggles immediately alters client routing. To test Cashier access, register or pick a Cashier account, click "Sign Out staff" in the leftmost panel margin, and log in with their corresponding demo credentials on the lock gateway.
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
                  <span className="text-[9px] text-orange-600 uppercase bg-slate-50 px-1 border border-[#b1b5c2]">Permission: hardware.configure</span>
                </div>

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Manage local terminal device settings for build-development. Device actions are placeholders and require hardware configuration permission.
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
                        {['Device Name', 'Connection Type', 'Status', 'Last Test', 'Permission Required', 'Action'].map((heading) => (
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
                              {['Test Device Placeholder', 'Configure Placeholder', 'Calibrate Placeholder', 'Disable Placeholder'].map((label) => (
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

            {/* TAB 9: RECEIPTBLUEPRINT */}
            {activeSection === 'RECEIPT' && (
              <form onSubmit={handleSaveReceipt} className="space-y-5">
                <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-pink-400" />
                    RECEIPT PRINT BLUEPRINT LAYOUTS
                  </span>
                  <span className="text-[9px] text-[#00f0ff] uppercase bg-slate-950 px-1 border border-slate-900">THERMAL HEAD</span>
                </div>

                <p className="text-[10px] text-slate-450 uppercase mb-4 leading-normal">
                  Define the layout template parameters injected into direct invoice generation modules during shift closeouts and sales rings.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">RECEIPT HEADER TEXT TITLE (MAX 40)</label>
                    <input 
                      type="text" 
                      value={recForm.header}
                      onChange={e => setRecForm({ ...recForm, header: e.target.value.toUpperCase() })}
                      maxLength={40}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-white font-mono text-xs outline-none focus:border-[#00f0ff] uppercase" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">RECEIPT BOTTOM FOOTER MESSAGE</label>
                    <input 
                      type="text" 
                      value={recForm.footer}
                      onChange={e => setRecForm({ ...recForm, footer: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-white text-xs outline-none focus:border-[#00f0ff]" 
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-500 text-[10px] uppercase font-bold">PAPER ROLL WIDTH CALIBRATION</label>
                    <select
                      value={recForm.slipWidth}
                      onChange={e => setRecForm({ ...recForm, slipWidth: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-850 p-2 text-slate-300 text-xs outline-none"
                    >
                      <option value="32_COLUMNS (STANDARD_SLIP)">32_COLUMNS (STANDARD THERMAL SLIP)</option>
                      <option value="40_COLUMNS (WIDE_THERMAL)">40_COLUMNS (WIDE MACHINE SLIP)</option>
                      <option value="80_COLUMNS (LETTERHEAD_A4)">80_COLUMNS (LETTERHEAD A4 DIRECT INVOICE)</option>
                    </select>
                  </div>

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
                    SAVE TRANSMITTER Blueprint
                  </button>
                </div>
              </form>
            )}

            {/* TAB 10: BUILD DEVELOPMENT STATUS */}
            {activeSection === 'BUILD_STATUS' && (
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
                    <ReadOnlyAccessMetric label="Mode" value="Build Development" />
                    <ReadOnlyAccessMetric label="Backend" value="Mock / Local Services" />
                    <ReadOnlyAccessMetric label="External Cloud" value="Not Connected" />
                    <ReadOnlyAccessMetric label="Fiscalization" value="Not Connected" />
                    <ReadOnlyAccessMetric label="Admin Access" value="Internal SCI Tools Only" />
                    <ReadOnlyAccessMetric label="Owner Access" value="Full During Development" />
                    <ReadOnlyAccessMetric label="Commercial Gates" value="Deferred" />
                    <ReadOnlyAccessMetric label="Last Build Check" value="Placeholder" />
                  </div>
                  <div className="mt-3 border border-orange-200 bg-orange-50 p-2 text-[10px] text-orange-900 font-bold uppercase">
                    During build-development, Owner has full access. Commercial feature enforcement is deferred.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 11: WARNING: RESET */}
            {activeSection === 'RESET' && (
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
            <SettingsField label="Vendor ID" value={branchForm.vendorId || 'SCI-LOG-ZW'} onChange={(value) => setBranchForm({ ...branchForm, vendorId: value })} />
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
            <SettingsField label="Vendor ID" value={warehouseForm.vendorId || 'SCI-LOG-ZW'} onChange={(value) => setWarehouseForm({ ...warehouseForm, vendorId: value })} />
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
