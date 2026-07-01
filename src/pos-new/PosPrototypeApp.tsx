import { lazy, Suspense, useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import PosShell from './layout/PosShell';
import PosDashboard from './pages/PosDashboard';
import PosSales from './pages/PosSales';
import PosStock from './pages/PosStock';
import PosShift from './pages/PosShift';
import PosCash from './pages/PosCash';
import PosFinancialControl from './pages/PosFinancialControl';
import PosBIDesk from './pages/PosBIDesk';
import PosSettings from './pages/PosSettings';
import PosStaffAccess from './pages/PosStaffAccess';
import PosDeliveryDesk from './pages/PosDeliveryDesk';
import PosSyncDesk from './pages/PosSyncDesk';
import PosOwnerDesk from './pages/PosOwnerDesk';
import PosSalesHistory from './pages/PosSalesHistory';
import PosTaskDesk from './pages/PosTaskDesk';
import PosApprovals from './pages/PosApprovals';
import PosCustomerDesk from './pages/PosCustomerDesk';
import PosCreditors from './pages/PosCreditors';
import PosPurchaseDiscipline from './pages/PosPurchaseDiscipline';
import PosHelpDesk from './pages/PosHelpDesk';
import { 
  Product, 
  Transaction, 
  Shift, 
  CashLog, 
  PosPageId, 
  PosSession, 
  BiEvent,
  BusinessProfile,
  BranchSetting,
  WarehouseSetting,
  TerminalSetting,
  StaffSetting,
  HardwareSetting,
  TaxSetting,
  ReceiptSetting
} from './types';
import { 
  mockProducts, 
  mockBranches, 
  mockWarehouses, 
  mockTerminals, 
  mockStaff, 
  mockRecentSales, 
  mockHeldTransactions, 
  mockShift, 
  mockCashMovements, 
  mockBIEvents, 
  mockSettings 
} from './mock/mockPosData';
import { getEffectivePageIdsForRole, normalizeRoleKey } from './auth/effectivePermissionService';
import { recordSecurityMatrixEvent } from './auth/permissionMatrixService';
import { getCurrentFirebaseUserProfile, signInWithGooglePlaceholder, subscribeToFirebaseAuthState, signOutFirebasePlaceholder } from './auth/firebaseAuthShell';
import { createTenantSessionFromFirebaseUser, getCurrentTenantSession, resolveTenantPlaceholder } from './auth/tenantSessionService';
import { loadLocalProducts, POS_PRODUCT_STORE_EVENT, updateLocalProductStock } from './utils/localProductStore';
import './posNew.css';

const PosReports = lazy(() => import('./pages/PosReports'));

// Core industrial standard catalog seeds loaded from centralized mockPosData
const INITIAL_PRODUCTS: Product[] = mockProducts;

// Seed initial transactions of the work day loaded from mockPosData
const INITIAL_TRANSACTIONS: Transaction[] = mockRecentSales;

// Seed cash drawer logs loaded from mockPosData
const INITIAL_CASH_LOGS: CashLog[] = mockCashMovements;

const DEFAULT_RECEIPT_SETTING: ReceiptSetting = {
  header: 'INDUSTRIAL HEAVY MACHINE SUPPLY',
  footer: 'THANK YOU FOR YOUR PATRONAGE. SECURE TRANSACTION CORES.',
  slipWidth: '32_COLUMNS (STANDARD_SLIP)',
  showTaxBreakdown: true,
  layout: 'Thermal Receipt Roll',
  headerMessage: 'INDUSTRIAL HEAVY MACHINE SUPPLY',
  footerMessage: 'THANK YOU FOR YOUR PATRONAGE. SECURE TRANSACTION CORES.',
  termsAndConditions: 'Goods may be returned according to store policy with a valid receipt.',
  businessAddress: '12 Enterprise Road, Harare',
  contactNumbers: '+263 242 000 100 | +263 77 000 0100',
  emailAddress: 'sales@itredcommerce.local',
  socialMediaHandles: '@itredcommerce',
  contactInformation: '+263 242 000 100 | +263 77 000 0100',
  socialMediaInformation: '@itredcommerce'
};

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredText(key: string, fallback: string): string {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function writeStoredValue(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } catch {
    // Build-development fallback: ignore storage write failures and keep in-memory React state.
  }
}

function removeStoredValue(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Build-development fallback: ignore storage removal failures.
  }
}

export default function PosPrototypeApp() {
  const [activePage, setActivePage] = useState<PosPageId>('DASHBOARD');

  // Client Session Identity Tracking
  const [googleAuthProfile, setGoogleAuthProfile] = useState(getCurrentFirebaseUserProfile());
  const [googleAuthMessage, setGoogleAuthMessage] = useState('Sign in with Google to continue to Staff Access.');
  const [authLoading, setAuthLoading] = useState(true);
  const [licenseChecked, setLicenseChecked] = useState(false);

  // Automatically restore active session state on reload
  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuthState((profile) => {
      setGoogleAuthProfile(profile);
      if (profile) {
        createTenantSessionFromFirebaseUser(profile);
        resolveTenantPlaceholder(profile);
        setGoogleAuthMessage(`Google session restored: ${profile.email}`);
      } else {
        setGoogleAuthMessage('Sign in with Google to continue to Staff Access.');
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Clear active staff session when the Google profile email changes (tenant isolation enforcement)
  useEffect(() => {
    if (googleAuthProfile) {
      const session = getCurrentTenantSession();
      if (activeSession && session.googleEmail !== googleAuthProfile.email) {
        setActiveSession(null);
      }
    }
  }, [googleAuthProfile?.email]);

  const [activeSession, setActiveSession] = useState<PosSession | null>(() => {
    return readStoredValue<PosSession | null>('itred_pos_active_session', null);
  });

  // Shared database states (re-hydrating from localStorage if present to maintain feel)
  const [products, setProducts] = useState<Product[]>(() => {
    return loadLocalProducts();
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return readStoredValue<Transaction[]>('itred_pos_transactions', INITIAL_TRANSACTIONS);
  });

  const [cashLogs, setCashLogs] = useState<CashLog[]>(() => {
    return readStoredValue<CashLog[]>('itred_pos_cash_logs', INITIAL_CASH_LOGS);
  });

  // Current Shift State
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    return readStoredValue<Shift | null>('itred_pos_active_shift', mockShift);
  });

  const [shiftHistory, setShiftHistory] = useState<Shift[]>(() => {
    return readStoredValue<Shift[]>('itred_pos_shifthistory', [
      {
        id: 'SHIFT-2026-06-07-01',
        operator: 'NIGHT_RECR',
        status: 'CLOSED',
        startTime: '2026-06-07T14:00:00Z',
        endTime: '2026-06-07T22:30:00Z',
        startingCash: 200.00,
        expectedCash: 850.50,
        actualCash: 850.50,
        difference: 0.00,
        salesCount: 15,
        totalSales: 650.50
      },
      {
        id: 'SHIFT-2026-06-07-02',
        operator: 'AUX_T6',
        status: 'CLOSED',
        startTime: '2026-06-07T06:00:00Z',
        endTime: '2026-06-07T14:00:00Z',
        startingCash: 200.00,
        expectedCash: 530.00,
        actualCash: 526.00,
        difference: -4.00, // variance
        salesCount: 8,
        totalSales: 330.00
      }
    ]);
  });

  // Business Intelligence Events Cache State
  const [biEvents, setBiEvents] = useState<BiEvent[]>(() => {
    return readStoredValue<BiEvent[]>('itred_pos_bi_events', mockBIEvents);
  });

  // Business Settings States
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    return readStoredValue<BusinessProfile>('itred_pos_business_profile', mockSettings.businessProfile);
  });

  const [branches, setBranches] = useState<BranchSetting[]>(() => {
    return readStoredValue<BranchSetting[]>('itred_pos_branches', mockBranches);
  });

  const [warehouses, setWarehouses] = useState<WarehouseSetting[]>(() => {
    return readStoredValue<WarehouseSetting[]>('itred_pos_warehouses', mockWarehouses);
  });

  const [terminalsSetting, setTerminalsSetting] = useState<TerminalSetting[]>(() => {
    return readStoredValue<TerminalSetting[]>('itred_pos_terminals', mockTerminals);
  });

  const [staffSetting, setStaffSetting] = useState<StaffSetting[]>(() => {
    return readStoredValue<StaffSetting[]>('itred_pos_staff', mockStaff);
  });

  const [hardwareSetting, setHardwareSetting] = useState<HardwareSetting>(() => {
    return readStoredValue<HardwareSetting>('itred_pos_hardware_setting', {
      laserFocus: 'LASER_FOCUS: INTENSE_RED',
      drawerSignal: '12VDC_ELECTRO_M_PULSE'
    });
  });

  const [taxSetting, setTaxSetting] = useState<TaxSetting>(() => {
    return readStoredValue<TaxSetting>('itred_pos_tax_setting', {
      vatRatePct: 10,
      surtaxPct: 2,
      inclusive: true
    });
  });

  const [receiptSetting, setReceiptSetting] = useState<ReceiptSetting>(() => {
    return {
      ...DEFAULT_RECEIPT_SETTING,
      ...readStoredValue<ReceiptSetting>('itred_pos_receipt_setting', DEFAULT_RECEIPT_SETTING)
    };
  });

  // Setup options (States)
  const [receiptHeader, setReceiptHeader] = useState(() => {
    return readStoredText('itred_pos_conf_receipt_head', 'INDUSTRIAL HEAVY MACHINE SUPPLY');
  });

  const [terminalUnit, setTerminalUnit] = useState(() => {
    return readStoredText('itred_pos_conf_term_id', 'REGISTER_UNIT_NORTH_B2');
  });

  const [activeOperatorName, setActiveOperatorName] = useState(() => {
    return readStoredText('itred_pos_conf_operator', 'SYS_ADMIN');
  });

  // Synchronise localStorage writes on mutations
  useEffect(() => {
    writeStoredValue('itred_pos_products', products);
  }, [products]);

  useEffect(() => {
    const refreshProducts = () => setProducts(loadLocalProducts());
    window.addEventListener(POS_PRODUCT_STORE_EVENT, refreshProducts);
    return () => window.removeEventListener(POS_PRODUCT_STORE_EVENT, refreshProducts);
  }, []);

  useEffect(() => {
    writeStoredValue('itred_pos_transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    writeStoredValue('itred_pos_cash_logs', cashLogs);
  }, [cashLogs]);

  useEffect(() => {
    if (activeShift) {
      writeStoredValue('itred_pos_active_shift', activeShift);
    } else {
      removeStoredValue('itred_pos_active_shift');
    }
  }, [activeShift]);

  useEffect(() => {
    writeStoredValue('itred_pos_shifthistory', shiftHistory);
  }, [shiftHistory]);

  useEffect(() => {
    writeStoredValue('itred_pos_bi_events', biEvents);
  }, [biEvents]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_receipt_head', receiptHeader);
  }, [receiptHeader]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_term_id', terminalUnit);
  }, [terminalUnit]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_operator', activeOperatorName);
  }, [activeOperatorName]);

  useEffect(() => {
    if (activeSession) {
      writeStoredValue('itred_pos_active_session', activeSession);
      setActiveOperatorName(activeSession.staffName);
      setTerminalUnit(activeSession.terminal);
    } else {
      removeStoredValue('itred_pos_active_session');
    }
  }, [activeSession]);

  useEffect(() => {
    writeStoredValue('itred_pos_business_profile', businessProfile);
  }, [businessProfile]);

  useEffect(() => {
    writeStoredValue('itred_pos_branches', branches);
  }, [branches]);

  useEffect(() => {
    writeStoredValue('itred_pos_warehouses', warehouses);
  }, [warehouses]);

  useEffect(() => {
    writeStoredValue('itred_pos_terminals', terminalsSetting);
  }, [terminalsSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_staff', staffSetting);
  }, [staffSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_hardware_setting', hardwareSetting);
  }, [hardwareSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_tax_setting', taxSetting);
  }, [taxSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_receipt_setting', receiptSetting);
  }, [receiptSetting]);

  // Dynamic authorization check & routing redirect logic. Staff Access Rights is the single source.
  useEffect(() => {
    const userRole = activeSession ? activeSession.role : 'SysAdmin';
    const allowed = getEffectivePageIdsForRole(userRole);
    if (allowed && !allowed.includes(activePage)) {
      if (allowed.length > 0) {
        setActivePage(allowed[0]);
      }
    }
  }, [activeSession, activePage]);

  useEffect(() => {
    recordSecurityMatrixEvent({
      eventType: 'PERMISSION_SOURCE_UNIFIED',
      label: 'Permission Source Unified',
      message: 'Navigation now uses Staff Access Rights effective permissions instead of the retired Roles & Permissions state.'
    });
    recordSecurityMatrixEvent({
      eventType: 'DUPLICATE_PERMISSION_STATE_DISABLED',
      label: 'Duplicate Permission State Disabled',
      message: 'Legacy role permission checkbox state is no longer used for access control.'
    });
  }, []);

  useEffect(() => {
    const role = activeSession?.role || 'SysAdmin';
    recordSecurityMatrixEvent({
      eventType: 'ROLE_MENU_ACCESS_RECALCULATED',
      label: 'Role Menu Access Recalculated',
      message: `Menu access recalculated from Staff Access Rights for ${role}.`,
      roleKey: normalizeRoleKey(role)
    });
    recordSecurityMatrixEvent({
      eventType: 'STAFF_ROLE_NAVIGATION_APPLIED',
      label: 'Staff Role Navigation Applied',
      message: `Navigation links applied for ${role} using effective permissions.`,
      roleKey: normalizeRoleKey(role)
    });
  }, [activeSession?.role]);


  // Mutators exposed to pages
  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
  };

  const handleProductStockChange = (productId: string, quantitySold: number) => {
    setProducts(updateLocalProductStock(productId, -quantitySold));
  };

  const handleUpdateStockLevel = (productId: string, nextStock: number) => {
    setProducts(prev => 
      prev.map(p => {
        if (p.id === productId) {
          const nextStatus = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : p.healthStatus || 'In Stock');
          return {
            ...p,
            stock: nextStock,
            healthStatus: nextStatus as any,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return p;
      })
    );
  };

  const handleUpdateMinStockThreshold = (productId: string, nextMin: number) => {
    setProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, minStock: nextMin } : p)
    );
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    const id = 'prod-' + Math.floor(Math.random() * 89999 + 10000);
    setProducts(prev => [...prev, { ...newProd, id }]);
  };

  const handleAddTransaction = (newTxData: Omit<Transaction, 'id' | 'invoiceNo' | 'date'>) => {
    const id = 'TXN-' + Math.floor(Math.random() * 89999 + 10000);
    const invoiceNo = 'INV-' + Math.floor(Math.random() * 899999 + 100000);
    const date = new Date().toISOString();

    const completeTx: Transaction = {
      ...newTxData,
      id,
      invoiceNo,
      date
    };

    setTransactions(prev => [...prev, completeTx]);

    // Also update active shift tally registers if shift is active!
    if (activeShift) {
      setActiveShift(prev => {
        if (!prev) return null;
        return {
          ...prev,
          salesCount: prev.salesCount + 1,
          totalSales: prev.totalSales + completeTx.total
        };
      });
    }

    // Write cash log row automated if the payment was CASH! Let's link it!
    if (completeTx.paymentMethod === 'CASH') {
      const logId = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
      const cashLogData: CashLog = {
        id: logId,
        timestamp: date,
        type: 'PAY_IN',
        amount: completeTx.total,
        reason: `AUTO SALE CASH_FLOW INVOICE: [${invoiceNo}]`,
        operator: completeTx.operator
      };
      setCashLogs(prev => [...prev, cashLogData]);
    }
  };

  const handleLogBiEvent = (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: BiEvent['payload'],
    severity: BiEvent['severity']
  ) => {
    const newEvent: BiEvent = {
      id: 'BI-EV-' + Math.floor(Math.random() * 89999 + 10000),
      timestamp: new Date().toISOString(),
      eventType,
      operator,
      terminal,
      payload,
      severity
    };
    setBiEvents(prev => [newEvent, ...prev]);
  };

  // Cash solenoid flow triggers
  const handleAddCashLog = (type: CashLog['type'], amount: number, reason: string) => {
    const id = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
    const date = new Date().toISOString();
    const newLog: CashLog = {
      id,
      timestamp: date,
      type,
      amount,
      reason,
      operator: activeOperatorName
    };

    setCashLogs(prev => [...prev, newLog]);
  };

  // Shift gates functions
  const handleOpenShift = (operatorName: string, startingFloat: number) => {
    const id = 'SHIFT-' + new Date().toISOString().substring(0, 10) + '-' + Math.floor(Math.random() * 90 + 10);
    const newShift: Shift = {
      id,
      operator: operatorName,
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      startingCash: startingFloat,
      expectedCash: startingFloat,
      salesCount: 0,
      totalSales: 0
    };

    setActiveShift(newShift);
    
    // Clear today's operational transactions and write initial logs to make the session fully clean!
    setTransactions([]);
    
    const logId = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
    const initialLog: CashLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      type: 'INITIAL',
      amount: startingFloat,
      reason: `SHIFT BOOT INITIAL REGISTRY FLOAT ENTRY FOR OP [${operatorName}]`,
      operator: operatorName
    };
    setCashLogs([initialLog]);

    // Log BI Event
    handleLogBiEvent(
      'SHIFT_OPENED',
      operatorName,
      terminalUnit,
      { floatAmount: startingFloat, details: `Shift opened on terminal ${terminalUnit}` },
      'INFO'
    );
  };

  const handleCloseShift = (actualFloat: number) => {
    if (!activeShift) return;

    // Calculate actual drawer cash sales
    const todayCashSales = transactions
      .filter(t => t.status === 'COMPLETED' && t.paymentMethod === 'CASH')
      .reduce((sum, t) => sum + t.total, 0);

    const payInEvents = cashLogs.filter(l => l.type === 'PAY_IN').reduce((sum, l) => sum + l.amount, 0);
    const payOutEvents = cashLogs.filter(l => l.type === 'PAY_OUT' || l.type === 'SAFE_DROP').reduce((sum, l) => sum + l.amount, 0);

    const computedExpected = activeShift.startingCash + todayCashSales + payInEvents - payOutEvents;
    const difference = actualFloat - computedExpected;

    const finalizedShift: Shift = {
      ...activeShift,
      status: 'CLOSED',
      endTime: new Date().toISOString(),
      expectedCash: computedExpected,
      actualCash: actualFloat,
      difference: difference
    };

    setShiftHistory(prev => [finalizedShift, ...prev]);
    setActiveShift(null);
    setTransactions([]); // flush registers for lockout state
    setCashLogs([]); // flush logs

    // Log BI Shift Closed Event
    handleLogBiEvent(
      'SHIFT_CLOSED',
      activeShift.operator,
      terminalUnit,
      {
        floatAmount: activeShift.startingCash,
        salesTotal: activeShift.totalSales,
        expectedCash: computedExpected,
        actualCash: actualFloat,
        difference: difference,
        details: `Shift closed on terminal ${terminalUnit}. Expected cash sum: $${computedExpected.toFixed(2)}, Counted actual: $${actualFloat.toFixed(2)}`
      },
      difference !== 0 ? 'WARNING' : 'INFO'
    );

    // If there is ANY cash variance, also log a specialized CASH_VARIANCE_FOUND BI alert!
    if (difference !== 0) {
      handleLogBiEvent(
        'CASH_VARIANCE_FOUND',
        activeShift.operator,
        terminalUnit,
        {
          expectedCash: computedExpected,
          actualCash: actualFloat,
          difference: difference,
          details: `Shift closed with a cash mismatch. Variance calculated: $${difference.toFixed(2)}`
        },
        'CRITICAL'
      );
    }
  };

  // Hard Reset Core
  const handleResetAllState = () => {
    [
      'itred_pos_products',
      'itred_pos_transactions',
      'itred_pos_cash_logs',
      'itred_pos_active_shift',
      'itred_pos_shifthistory',
      'itred_pos_conf_receipt_head',
      'itred_pos_conf_term_id',
      'itred_pos_conf_operator',
      'itred_pos_bi_events',
      'itred_pos_business_profile',
      'itred_pos_branches',
      'itred_pos_warehouses',
      'itred_pos_terminals',
      'itred_pos_staff',
      'itred_pos_role_permissions',
      'itred_pos_hardware_setting',
      'itred_pos_tax_setting',
      'itred_pos_receipt_setting'
    ].forEach(removeStoredValue);

    setProducts(INITIAL_PRODUCTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashLogs(INITIAL_CASH_LOGS);
    setShiftHistory([]);
    setBiEvents([
      {
        id: 'BI-EV-1001',
        timestamp: '2026-06-08T15:20:00Z',
        eventType: 'SUSPICIOUS_MOVEMENT_ALERT',
        operator: 'CLERK_R4',
        terminal: 'REGISTER_UNIT_NORTH_B2',
        payload: { details: "Drawer opened manually 3 times within 5 minutes with 0 registered transaction rings.", suspicionScore: 92 },
        severity: 'Critical'
      },
      {
        id: 'BI-EV-1002',
        timestamp: '2026-06-08T14:45:12Z',
        eventType: 'CASH_VARIANCE_FOUND',
        operator: 'AUX_T6',
        terminal: 'REGISTER_UNIT_NORTH_B2',
        payload: { expectedCash: 350.00, actualCash: 334.50, difference: -15.50, details: "Audit check completed. Discrepancy of -$15.50 beneath the threshold." },
        severity: 'Critical'
      },
      {
        id: 'BI-EV-1003',
        timestamp: '2026-06-08T14:12:05Z',
        eventType: 'FAILED_TERMINAL_LOGIN',
        operator: 'UNKNOWN',
        terminal: 'REGISTER_UNIT_SOUTH_A1',
        payload: { details: "Operator lock block. 3 consecutive invalid authentication attempts.", attemptsCount: 3, user: 'OP_CLERK_2' },
        severity: 'High'
      },
      {
        id: 'BI-EV-1004',
        timestamp: '2026-06-08T13:30:19Z',
        eventType: 'SALE_BLOCKED_ZERO_STOCK',
        operator: 'AUX_T6',
        terminal: 'REGISTER_UNIT_NORTH_B2',
        payload: { sku: 'SKU-H420', productName: 'HEAVY DIESEL GASKET', attemptedQty: 1, details: "Ringing blocked. Attempted sale of zero-stock item HEAVY DIESEL GASKET." },
        severity: 'High'
      },
      {
        id: 'BI-EV-1005',
        timestamp: '2026-06-08T11:15:22Z',
        eventType: 'PRICE_OVERRIDE_REQUESTED',
        operator: 'CLERK_R4',
        terminal: 'REGISTER_UNIT_SOUTH_A1',
        payload: { sku: 'SKU-G80', productName: 'GASKET SEALER XL', standardPrice: 12.50, requestedPrice: 8.00, details: "Manual discount override (36%). GASKET SEALER XL reduced from $12.50 to $8.00." },
        severity: 'Medium'
      },
      {
        id: 'BI-EV-1006',
        timestamp: '2026-06-08T09:40:00Z',
        eventType: 'RECOMMEND_MAJOR_STOCKTAKE',
        operator: 'SYS_ADMIN',
        terminal: 'BACK_OFFICE_CON',
        payload: { details: "Shrinkage check recommendation. Bin velocity audit flags high count drift in HYDRAULIC VALVE pack." },
        severity: 'Medium'
      },
      {
        id: 'BI-EV-1007',
        timestamp: '2026-06-08T08:30:15Z',
        eventType: 'STOCK_ADJUSTMENT_REQUESTED',
        operator: 'SYS_ADMIN',
        terminal: 'BACK_OFFICE_CON',
        payload: { details: "Manual inventory write-in. Clerk adjusted STEEL_THREAD_TAPE count upwards by 5 Units.", reasons: "Discovered spare pack during shipping receiving." },
        severity: 'Low'
      }
    ]);
    setActiveShift(null);
    setReceiptHeader('INDUSTRIAL HEAVY MACHINE SUPPLY');
    setTerminalUnit('REGISTER_UNIT_NORTH_B2');
    setActiveOperatorName('SYS_ADMIN');

    // Deep Erase Custom Setting configurations
    setBusinessProfile({
      legalName: 'APEX INDUSTRIAL CORP',
      taxNo: 'VAT-US-991208',
      regNo: 'REG-552912',
      address: '77 Industrial Parkway, Sector 4',
      currency: 'USD'
    });
    setBranches([
      { id: 'BR-DET-3', name: 'DETROIT FORGE #3', location: 'Detroit, MI' },
      { id: 'BR-CHI-B', name: 'CHICAGO DISTRIBUTION B', location: 'Chicago, IL' },
      { id: 'BR-GARY-4', name: 'GARY ASSEMBLY PLANT 4', location: 'Gary, IN' }
    ]);
    setWarehouses([
      { id: 'WH-DET-01', name: 'Main Forge Warehouse', branchId: 'BR-DET-3' },
      { id: 'WH-CHI-01', name: 'Chicago Logistical Hub', branchId: 'BR-CHI-B' },
      { id: 'WH-GARY-01', name: 'Gary Storage Annex C', branchId: 'BR-GARY-4' }
    ]);
    setTerminalsSetting([
      { id: 'TERM-DETROIT-01', name: 'TERM-DETROIT-01 (HEAVY REGISTER)', branchId: 'BR-DET-3', type: 'HEAVY' },
      { id: 'TERM-DETROIT-02', name: 'TERM-DETROIT-02 (AUX-T6)', branchId: 'BR-DET-3', type: 'LIGHT' },
      { id: 'TERM-CHICAGO-01', name: 'TERM-CHICAGO-01 (GATE_WAY_2)', branchId: 'BR-CHI-B', type: 'HEAVY' }
    ]);
    setStaffSetting([
      { id: 'ST-001', name: 'Marcus Vance', email: 'marcus@apex.com', role: 'Supervisor', pass: 'lead123', branchId: 'BR-DET-3' },
      { id: 'ST-002', name: 'Sarah Connor', email: 'sarah@apex.com', role: 'Cashier', pass: 'op123', branchId: 'BR-DET-3' },
      { id: 'ST-003', name: 'John Connor', email: 'john@apex.com', role: 'Manager', pass: 'mngr123', branchId: 'BR-CHI-B' },
      { id: 'ST-004', name: 'Elena Rostova', email: 'elena@apex.com', role: 'Stock Controller', pass: 'op456', branchId: 'BR-CHI-B' },
      { id: 'ST-005', name: 'Cassie Reilly', email: 'cassie@apex.com', role: 'Owner', pass: 'owner123', branchId: 'BR-GARY-4' },
      { id: 'ST-006', name: 'James Cole', email: 'james@apex.com', role: 'SysAdmin', pass: 'admin123', branchId: 'BR-GARY-4' }
    ]);
    setHardwareSetting({
      laserFocus: 'LASER_FOCUS: INTENSE_RED',
      drawerSignal: '12VDC_ELECTRO_M_PULSE'
    });
    setTaxSetting({
      vatRatePct: 10,
      surtaxPct: 2,
      inclusive: true
    });
    setReceiptSetting({
      ...DEFAULT_RECEIPT_SETTING
    });

    setActivePage('DASHBOARD');
  };

  const handleGoogleAuthBeforeStaffAccess = async () => {
    setGoogleAuthMessage('Opening Google sign-in...');
    const result = await signInWithGooglePlaceholder();

    if (!result.ok) {
      setGoogleAuthMessage(result.message || 'Google sign-in failed. Check Firebase Auth configuration.');
      return;
    }

    const profile = getCurrentFirebaseUserProfile();
    setGoogleAuthProfile(profile);

    if (profile) {
      createTenantSessionFromFirebaseUser(profile);
      resolveTenantPlaceholder(profile);
      setGoogleAuthMessage(`Google signed in as ${profile.email}. Continue with Staff Access.`);
    } else {
      setGoogleAuthMessage('Google sign-in completed, but profile was not loaded.');
    }
  };

  // Render loading state while authenticating
  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-orange-500/40 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">iTred Commerce POS</p>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
            <h1 className="text-lg font-black uppercase text-white">Checking Google session...</h1>
          </div>
          <p className="text-xs text-slate-400">Verifying authentication token and secure keys...</p>
        </section>
      </main>
    );
  }

  // Guard the operational register with Google Auth before staff access
  if (!googleAuthProfile) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-orange-500/40 bg-slate-900 p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">iTred Commerce POS</p>
          <h1 className="mt-3 text-2xl font-black uppercase text-white">Vendor Sign In</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in with Google first. After vendor verification, the normal Staff Access form will open.
          </p>
          <div className="mt-5 border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
            {googleAuthMessage}
          </div>
          <button
            type="button"
            onClick={() => void handleGoogleAuthBeforeStaffAccess()}
            className="mt-5 w-full border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-black uppercase text-slate-950 hover:bg-orange-400"
          >
            Sign in with Google
          </button>
        </section>
      </main>
    );
  }

  // Blocked license screen if the tenant is unlicensed
  const isUnlicensed = getCurrentTenantSession().vendorId === 'unlicensed' || getCurrentTenantSession().status === 'Error';

  if (googleAuthProfile && isUnlicensed) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-rose-500/40 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">POS License Blocked</p>
          <h1 className="text-xl font-black uppercase text-white">Access Denied</h1>
          <div className="border border-rose-700 bg-slate-950 p-3 text-xs text-rose-300 font-bold">
            No POS license found for this Google account. Contact iTredVD administrator.
          </div>
          <p className="text-xs text-slate-400">
            Authenticated as: <strong className="text-slate-200">{googleAuthProfile.email}</strong>
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOutFirebasePlaceholder();
              setGoogleAuthProfile(null);
              setLicenseChecked(false);
              setActiveSession(null);
            }}
            className="w-full border border-rose-500 bg-rose-600 hover:bg-rose-500 px-4 py-3 text-sm font-black uppercase text-white"
          >
            Sign Out & Try Another Account
          </button>
        </section>
      </main>
    );
  }

  // License Gate Placeholder between Google Auth and Staff Access
  if (!licenseChecked) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-emerald-500/40 bg-slate-900 p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">License Verification</p>
          <h1 className="mt-3 text-2xl font-black uppercase text-white">License Gate</h1>
          <div className="mt-5 border border-emerald-700 bg-slate-950 p-3 text-xs text-emerald-300 font-bold text-center">
            License verified by iTredVD Console
          </div>
          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            {/* 
              Production license verification:
              This placeholder verifies the vendor tenant license using local defaults.
              Production implementation will fetch token claims or invoke the iTredVD Console backend API 
              to verify active subscription/licensing before granting entry to POS staff desks.
            */}
            Vendor tenant subscription is verified. Local build development access is active.
          </p>
          <button
            type="button"
            onClick={() => setLicenseChecked(true)}
            className="mt-6 w-full border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 px-4 py-3 text-sm font-black uppercase text-white"
          >
            Proceed to Staff Access
          </button>
        </section>
      </main>
    );
  }

  // Guard the operational register with our heavy security staff access screen
  if (!activeSession) {
    return (
      <PosStaffAccess 
        onLoginSuccess={setActiveSession}
        onBackToBios={() => {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />
    );
  }

  const allowedForAccess = getEffectivePageIdsForRole(activeSession.role);
  const isPageRestricted = !allowedForAccess.includes(activePage);

  return (
    <PosShell
      activePage={activePage}
      onPageChange={setActivePage}
      terminalId={terminalUnit}
      activeOperator={activeOperatorName}
      activeShiftStatus={activeShift ? 'ACTIVE' : 'CLOSED'}
      activeSession={activeSession}
      onSignOut={async () => {
        await signOutFirebasePlaceholder();
        setGoogleAuthProfile(null);
        setLicenseChecked(false);
        setActiveSession(null);
      }}
      allowedPages={allowedForAccess}
      tenantName={businessProfile.legalName || businessProfile.tradingName || 'Tenant'}
      tenantLogo={receiptSetting.logoDataUrl}
    >
      {/* Dynamic page switches */}
      {isPageRestricted ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-rose-800 bg-slate-950/60 p-8 font-mono space-y-4 max-w-xl mx-auto my-12">
          <div className="p-3 bg-rose-950/20 border border-rose-500/40 text-rose-500 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-sm font-black text-rose-500 tracking-wider uppercase">SECURITY CLEARANCE ALERT</h2>
            <p className="text-xs text-slate-450 uppercase leading-relaxed">
              Access restricted for your current role. <span className="text-amber-500 font-bold">({activeSession?.role})</span>
            </p>
          </div>
          <div className="w-full h-px bg-slate-900 my-2"></div>
          <p className="text-[9px] text-slate-500 text-center uppercase tracking-wider">
            AUTHENTICATION LOG SYSTEM RE-ROUTE ATTEMPT REGISTERED / GATEWAY IS LOCK_ON
          </p>
          <button 
            onClick={() => setActivePage('DASHBOARD')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-[#00f0ff] uppercase tracking-wider font-bold cursor-pointer transition-colors"
          >
            Return to Operator Dashboard
          </button>
        </div>
      ) : (
        <>
          {activePage === 'DASHBOARD' && (
            <PosDashboard 
              products={products}
              transactions={transactions}
              activeShift={activeShift}
              cashLogs={cashLogs}
              onNavigate={(page) => setActivePage(page as PosPageId)}
              session={activeSession}
              businessProfile={businessProfile}
            />
          )}

      {activePage === 'OWNER_DESK' && (
        <PosOwnerDesk 
          session={activeSession}
        />
      )}

      {activePage === 'SALES' && (
        <PosSales 
          products={products}
          onProductStockChange={handleProductStockChange}
          onAddTransaction={handleAddTransaction}
          onNavigate={(page) => setActivePage(page as PosPageId)}
          activeShiftOperator={activeShift ? activeShift.operator : null}
          session={activeSession}
        />
      )}

      {activePage === 'SALES_HISTORY' && (
        <PosSalesHistory session={activeSession} onNavigate={(page) => setActivePage(page as PosPageId)} />
      )}

      {activePage === 'CUSTOMER_CENTRE' && (
        <PosCustomerDesk session={activeSession} onNavigate={(page) => setActivePage(page as PosPageId)} />
      )}

      {activePage === 'DELIVERY' && (
        <PosDeliveryDesk 
          session={activeSession}
        />
      )}

      {activePage === 'STOCK' && (
        <PosStock 
          products={products}
          onAddProduct={handleAddProduct}
          onUpdateStock={handleUpdateStockLevel}
          onUpdateMinStock={handleUpdateMinStockThreshold}
          onUpdateProduct={handleUpdateProduct}
          session={activeSession}
        />
      )}

      {activePage === 'CREDITORS' && (
        <PosCreditors session={activeSession} />
      )}

      {activePage === 'PURCHASE_DISCIPLINE' && (
        <PosPurchaseDiscipline session={activeSession} />
      )}

      {activePage === 'TASK_DESK' && (
        <PosTaskDesk session={activeSession} onNavigate={(page) => setActivePage(page)} />
      )}

      {activePage === 'APPROVALS' && (
        <PosApprovals session={activeSession} onNavigate={(page) => setActivePage(page)} />
      )}

      {activePage === 'SHIFT' && (
        <PosShift 
          activeShift={activeShift}
          shiftHistory={shiftHistory}
          transactions={transactions}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          terminalId={terminalUnit}
          activeOperator={activeOperatorName}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          cashLogs={cashLogs}
          session={activeSession}
          onNavigate={(page) => setActivePage(page as PosPageId)}
        />
      )}

      {activePage === 'CASH' && (
        <PosCash 
          cashLogs={cashLogs}
          activeShift={activeShift}
          onAddCashLog={handleAddCashLog}
          terminalId={terminalUnit}
          activeOperator={activeOperatorName}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          transactions={transactions}
          session={activeSession}
        />
      )}

      {activePage === 'FINANCIAL_CONTROL' && (
        <PosFinancialControl session={activeSession} />
      )}

      {activePage === 'REPORTS' && (
        <Suspense fallback={<div className="sci-pos-card pos-lazy-loading">Loading reports...</div>}>
          <PosReports
            products={products}
            transactions={transactions}
            cashLogs={cashLogs}
            session={activeSession}
            businessProfile={businessProfile}
          />
        </Suspense>
      )}

      {activePage === 'BI_DESK' && (
        <PosBIDesk 
          transactions={transactions}
          products={products}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          session={activeSession}
        />
      )}

      {activePage === 'SYNC_DESK' && (
        <PosSyncDesk 
          session={activeSession}
        />
      )}

      {activePage === 'HELP_DESK' && (
        <PosHelpDesk
          session={activeSession}
          onNavigate={(page) => setActivePage(page)}
        />
      )}

      {activePage === 'SETTINGS' && (
        <PosSettings 
          businessProfile={businessProfile}
          onUpdateBusinessProfile={setBusinessProfile}
          branches={branches}
          onUpdateBranches={setBranches}
          warehouses={warehouses}
          onUpdateWarehouses={setWarehouses}
          terminals={terminalsSetting}
          onUpdateTerminals={setTerminalsSetting}
          staff={staffSetting}
          onUpdateStaff={setStaffSetting}
          hardwareSetting={hardwareSetting}
          onUpdateHardwareSetting={setHardwareSetting}
          taxSetting={taxSetting}
          onUpdateTaxSetting={setTaxSetting}
          receiptSetting={receiptSetting}
          onUpdateReceiptSetting={setReceiptSetting}
          receiptHeader={receiptHeader}
          onUpdateReceiptHeader={setReceiptHeader}
          terminalUnit={terminalUnit}
          onUpdateTerminalUnit={setTerminalUnit}
          onResetAllState={handleResetAllState}
          activeOperatorName={activeOperatorName}
          onUpdateOperatorName={setActiveOperatorName}
          activeRole={activeSession?.role}
        />
      )}
        </>
      )}
    </PosShell>
  );
}

