import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import PosShell from './layout/PosShell';
import PosDashboard from './pages/PosDashboard';
import PosSales from './pages/PosSales';
import PosStock from './pages/PosStock';
import PosShift from './pages/PosShift';
import PosCash from './pages/PosCash';
import PosBIDesk from './pages/PosBIDesk';
import PosSettings from './pages/PosSettings';
import PosStaffAccess from './pages/PosStaffAccess';
import PosDeliveryDesk from './pages/PosDeliveryDesk';
import PosSyncDesk from './pages/PosSyncDesk';
import PosOwnerDesk from './pages/PosOwnerDesk';
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
import { getAllowedMenusForRole } from './utils/posPermissions';
import './posNew.css';

// Core industrial standard catalog seeds loaded from centralized mockPosData
const INITIAL_PRODUCTS: Product[] = mockProducts;

// Seed initial transactions of the work day loaded from mockPosData
const INITIAL_TRANSACTIONS: Transaction[] = mockRecentSales;

// Seed cash drawer logs loaded from mockPosData
const INITIAL_CASH_LOGS: CashLog[] = mockCashMovements;

export default function PosPrototypeApp() {
  const [activePage, setActivePage] = useState<PosPageId>('DASHBOARD');

  // Client Session Identity Tracking
  const [activeSession, setActiveSession] = useState<PosSession | null>(() => {
    const local = localStorage.getItem('itred_pos_active_session');
    return local ? JSON.parse(local) : null;
  });

  // Shared database states (re-hydrating from localStorage if present to maintain feel)
  const [products, setProducts] = useState<Product[]>(() => {
    const local = localStorage.getItem('itred_pos_products');
    return local ? JSON.parse(local) : INITIAL_PRODUCTS;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const local = localStorage.getItem('itred_pos_transactions');
    return local ? JSON.parse(local) : INITIAL_TRANSACTIONS;
  });

  const [cashLogs, setCashLogs] = useState<CashLog[]>(() => {
    const local = localStorage.getItem('itred_pos_cash_logs');
    return local ? JSON.parse(local) : INITIAL_CASH_LOGS;
  });

  // Current Shift State
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    const local = localStorage.getItem('itred_pos_active_shift');
    return local ? JSON.parse(local) : mockShift;
  });

  const [shiftHistory, setShiftHistory] = useState<Shift[]>(() => {
    const local = localStorage.getItem('itred_pos_shifthistory');
    return local ? JSON.parse(local) : [
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
    ];
  });

  // Business Intelligence Events Cache State
  const [biEvents, setBiEvents] = useState<BiEvent[]>(() => {
    const local = localStorage.getItem('itred_pos_bi_events');
    return local ? JSON.parse(local) : mockBIEvents;
  });

  // Business Settings States
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    const local = localStorage.getItem('itred_pos_business_profile');
    return local ? JSON.parse(local) : mockSettings.businessProfile;
  });

  const [branches, setBranches] = useState<BranchSetting[]>(() => {
    const local = localStorage.getItem('itred_pos_branches');
    return local ? JSON.parse(local) : mockBranches;
  });

  const [warehouses, setWarehouses] = useState<WarehouseSetting[]>(() => {
    const local = localStorage.getItem('itred_pos_warehouses');
    return local ? JSON.parse(local) : mockWarehouses;
  });

  const [terminalsSetting, setTerminalsSetting] = useState<TerminalSetting[]>(() => {
    const local = localStorage.getItem('itred_pos_terminals');
    return local ? JSON.parse(local) : mockTerminals;
  });

  const [staffSetting, setStaffSetting] = useState<StaffSetting[]>(() => {
    const local = localStorage.getItem('itred_pos_staff');
    return local ? JSON.parse(local) : mockStaff;
  });

  const [rolePermissions, setRolePermissions] = useState<Record<string, PosPageId[]>>(() => {
    const local = localStorage.getItem('itred_pos_role_permissions');
    let parsed = local ? JSON.parse(local) : null;
    if (!parsed || !parsed['Cashier'] || !parsed['Cashier'].includes('DELIVERY') || !parsed['Owner']?.includes('OWNER_DESK')) {
      parsed = {
        'Owner': getAllowedMenusForRole('Owner'),
        'SysAdmin': getAllowedMenusForRole('SysAdmin'),
        'Manager': getAllowedMenusForRole('Manager'),
        'Supervisor': getAllowedMenusForRole('Supervisor'),
        'Cashier': getAllowedMenusForRole('Cashier'),
        'Stock Controller': getAllowedMenusForRole('Stock Controller')
      };
    }
    return parsed;
  });

  const [hardwareSetting, setHardwareSetting] = useState<HardwareSetting>(() => {
    const local = localStorage.getItem('itred_pos_hardware_setting');
    return local ? JSON.parse(local) : {
      laserFocus: 'LASER_FOCUS: INTENSE_RED',
      drawerSignal: '12VDC_ELECTRO_M_PULSE'
    };
  });

  const [taxSetting, setTaxSetting] = useState<TaxSetting>(() => {
    const local = localStorage.getItem('itred_pos_tax_setting');
    return local ? JSON.parse(local) : {
      vatRatePct: 10,
      surtaxPct: 2,
      inclusive: true
    };
  });

  const [receiptSetting, setReceiptSetting] = useState<ReceiptSetting>(() => {
    const local = localStorage.getItem('itred_pos_receipt_setting');
    return local ? JSON.parse(local) : {
      header: 'INDUSTRIAL HEAVY MACHINE SUPPLY',
      footer: 'THANK YOU FOR YOUR PATRONAGE. SECURE TRANSACTION CORES.',
      slipWidth: '32_COLUMNS (STANDARD_SLIP)',
      showTaxBreakdown: true
    };
  });

  // Setup options (States)
  const [receiptHeader, setReceiptHeader] = useState(() => {
    return localStorage.getItem('itred_pos_conf_receipt_head') || 'INDUSTRIAL HEAVY MACHINE SUPPLY';
  });

  const [terminalUnit, setTerminalUnit] = useState(() => {
    return localStorage.getItem('itred_pos_conf_term_id') || 'REGISTER_UNIT_NORTH_B2';
  });

  const [activeOperatorName, setActiveOperatorName] = useState(() => {
    return localStorage.getItem('itred_pos_conf_operator') || 'SYS_ADMIN';
  });

  // Synchronise localStorage writes on mutations
  useEffect(() => {
    localStorage.setItem('itred_pos_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('itred_pos_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('itred_pos_cash_logs', JSON.stringify(cashLogs));
  }, [cashLogs]);

  useEffect(() => {
    if (activeShift) {
      localStorage.setItem('itred_pos_active_shift', JSON.stringify(activeShift));
    } else {
      localStorage.removeItem('itred_pos_active_shift');
    }
  }, [activeShift]);

  useEffect(() => {
    localStorage.setItem('itred_pos_shifthistory', JSON.stringify(shiftHistory));
  }, [shiftHistory]);

  useEffect(() => {
    localStorage.setItem('itred_pos_bi_events', JSON.stringify(biEvents));
  }, [biEvents]);

  useEffect(() => {
    localStorage.setItem('itred_pos_conf_receipt_head', receiptHeader);
  }, [receiptHeader]);

  useEffect(() => {
    localStorage.setItem('itred_pos_conf_term_id', terminalUnit);
  }, [terminalUnit]);

  useEffect(() => {
    localStorage.setItem('itred_pos_conf_operator', activeOperatorName);
  }, [activeOperatorName]);

  useEffect(() => {
    if (activeSession) {
      localStorage.setItem('itred_pos_active_session', JSON.stringify(activeSession));
      setActiveOperatorName(activeSession.staffName);
      setTerminalUnit(activeSession.terminal);
    } else {
      localStorage.removeItem('itred_pos_active_session');
    }
  }, [activeSession]);

  useEffect(() => {
    localStorage.setItem('itred_pos_business_profile', JSON.stringify(businessProfile));
  }, [businessProfile]);

  useEffect(() => {
    localStorage.setItem('itred_pos_branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    localStorage.setItem('itred_pos_warehouses', JSON.stringify(warehouses));
  }, [warehouses]);

  useEffect(() => {
    localStorage.setItem('itred_pos_terminals', JSON.stringify(terminalsSetting));
  }, [terminalsSetting]);

  useEffect(() => {
    localStorage.setItem('itred_pos_staff', JSON.stringify(staffSetting));
  }, [staffSetting]);

  useEffect(() => {
    localStorage.setItem('itred_pos_role_permissions', JSON.stringify(rolePermissions));
  }, [rolePermissions]);

  useEffect(() => {
    localStorage.setItem('itred_pos_hardware_setting', JSON.stringify(hardwareSetting));
  }, [hardwareSetting]);

  useEffect(() => {
    localStorage.setItem('itred_pos_tax_setting', JSON.stringify(taxSetting));
  }, [taxSetting]);

  useEffect(() => {
    localStorage.setItem('itred_pos_receipt_setting', JSON.stringify(receiptSetting));
  }, [receiptSetting]);

  // Dynamic authorization check & routing redirect logic
  useEffect(() => {
    const userRole = activeSession ? activeSession.role : 'SysAdmin';
    const allowed = rolePermissions[userRole] || ['DASHBOARD', 'SETTINGS'];
    if (allowed && !allowed.includes(activePage)) {
      if (allowed.length > 0) {
        setActivePage(allowed[0]);
      }
    }
  }, [activeSession, rolePermissions, activePage]);


  // Mutators exposed to pages
  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
  };

  const handleProductStockChange = (productId: string, quantitySold: number) => {
    setProducts(prev => 
      prev.map(p => {
        if (p.id === productId) {
          const nextStock = Math.max(0, p.stock - quantitySold);
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
    localStorage.removeItem('itred_pos_products');
    localStorage.removeItem('itred_pos_transactions');
    localStorage.removeItem('itred_pos_cash_logs');
    localStorage.removeItem('itred_pos_active_shift');
    localStorage.removeItem('itred_pos_shifthistory');
    localStorage.removeItem('itred_pos_conf_receipt_head');
    localStorage.removeItem('itred_pos_conf_term_id');
    localStorage.removeItem('itred_pos_conf_operator');
    localStorage.removeItem('itred_pos_bi_events');
    localStorage.removeItem('itred_pos_business_profile');
    localStorage.removeItem('itred_pos_branches');
    localStorage.removeItem('itred_pos_warehouses');
    localStorage.removeItem('itred_pos_terminals');
    localStorage.removeItem('itred_pos_staff');
    localStorage.removeItem('itred_pos_role_permissions');
    localStorage.removeItem('itred_pos_hardware_setting');
    localStorage.removeItem('itred_pos_tax_setting');
    localStorage.removeItem('itred_pos_receipt_setting');

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
    setRolePermissions({
      'Owner': getAllowedMenusForRole('Owner'),
      'SysAdmin': getAllowedMenusForRole('SysAdmin'),
      'Manager': getAllowedMenusForRole('Manager'),
      'Supervisor': getAllowedMenusForRole('Supervisor'),
      'Cashier': ['DASHBOARD', 'SALES', 'DELIVERY', 'SHIFT'],
      'Stock Controller': ['DASHBOARD', 'STOCK']
    });
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
      header: 'INDUSTRIAL HEAVY MACHINE SUPPLY',
      footer: 'THANK YOU FOR YOUR PATRONAGE. SECURE TRANSACTION CORES.',
      slipWidth: '32_COLUMNS (STANDARD_SLIP)',
      showTaxBreakdown: true
    });

    setActivePage('DASHBOARD');
  };

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

  const userRoleForAccess = activeSession ? activeSession.role : 'SysAdmin';
  const allowedForAccess = rolePermissions[userRoleForAccess] || ['DASHBOARD', 'SETTINGS'];
  const isPageRestricted = !allowedForAccess.includes(activePage);

  return (
    <PosShell
      activePage={activePage}
      onPageChange={setActivePage}
      terminalId={terminalUnit}
      activeOperator={activeOperatorName}
      activeShiftStatus={activeShift ? 'ACTIVE' : 'CLOSED'}
      activeSession={activeSession}
      onSignOut={() => setActiveSession(null)}
      allowedPages={allowedForAccess}
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
          rolePermissions={rolePermissions}
          onUpdateRolePermissions={setRolePermissions}
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
        />
      )}
        </>
      )}
    </PosShell>
  );
}
