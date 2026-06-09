import { 
  Vendor, 
  Branch, 
  Warehouse, 
  Terminal, 
  StaffMember, 
  Product, 
  Sale, 
  HeldTransaction, 
  Shift, 
  CashMovement, 
  BIEvent, 
  POSSettings, 
  AuditEvent,
  DeliveryOrder,
  DeliveryPerson,
  WalkInCollection,
  DeliveryEvent,
  SyncQueueItem,
  SyncConflict,
  SyncActivityEvent,
  OwnerSummary,
  EODChecklistItem,
  EODReconciliationRow,
  TerminalEODSummary,
  OwnerApprovalItem,
  OwnerBIAlert,
  OwnerActivityEvent
} from '../types/posTypes';

export const mockVendors: Vendor[] = [
  {
    id: 'APEX-IND-CORP',
    name: 'APEX INDUSTRIAL CORP',
    legalName: 'APEX INDUSTRIAL CORP',
    taxNo: 'VAT-US-991208',
    regNo: 'REG-552912',
    address: '77 Industrial Parkway, Sector 4',
    currency: 'USD'
  },
  {
    id: 'SCI-LOG-ZW',
    name: 'SCI Logistics Ltd',
    legalName: 'SCI Logistics Ltd',
    taxNo: 'VAT-ZW-82190B',
    regNo: 'REG-66291B',
    address: '88 Coventry Road, Workington, Harare',
    currency: 'USD'
  }
];

export const mockBranches: Branch[] = [
  { id: 'BR-DET-3', name: 'DETROIT FORGE #3', location: 'Detroit, MI' },
  { id: 'BR-CHI-B', name: 'CHICAGO DISTRIBUTION B', location: 'Chicago, IL' },
  { id: 'BR-GARY-4', name: 'GARY ASSEMBLY PLANT 4', location: 'Gary, IN' },
  { id: 'BR-HARARE', name: 'Harare Main', location: 'Harare, Zimbabwe' }
];

export const mockWarehouses: Warehouse[] = [
  { id: 'WH-DET-01', name: 'Main Forge Warehouse', branchId: 'BR-DET-3' },
  { id: 'WH-CHI-01', name: 'Chicago Logistical Hub', branchId: 'BR-CHI-B' },
  { id: 'WH-GARY-01', name: 'Gary Storage Annex C', branchId: 'BR-GARY-4' },
  { id: 'WH-HARARE-01', name: 'Harare Spares Depot', branchId: 'BR-HARARE' }
];

export const mockTerminals: Terminal[] = [
  { id: 'TERM-DETROIT-01', name: 'TERM-DETROIT-01 (HEAVY REGISTER)', branchId: 'BR-DET-3', type: 'HEAVY' },
  { id: 'TERM-DETROIT-02', name: 'TERM-DETROIT-02 (AUX-T6)', branchId: 'BR-DET-3', type: 'LIGHT' },
  { id: 'TERM-CHICAGO-01', name: 'TERM-CHICAGO-01 (GATE_WAY_2)', branchId: 'BR-CHI-B', type: 'HEAVY' },
  { id: 'TERM-HARARE-01', name: 'Term-A', branchId: 'BR-HARARE', type: 'STANDARD' }
];

export const mockStaff: StaffMember[] = [
  { id: 'ST-001', name: 'Marcus Vance', email: 'marcus@apex.com', role: 'Supervisor', pass: 'lead123', branchId: 'BR-DET-3' },
  { id: 'ST-002', name: 'Sarah Connor', email: 'sarah@apex.com', role: 'Cashier', pass: 'op123', branchId: 'BR-DET-3' },
  { id: 'ST-003', name: 'John Connor', email: 'john@apex.com', role: 'Manager', pass: 'mngr123', branchId: 'BR-CHI-B' },
  { id: 'ST-004', name: 'Elena Rostova', email: 'elena@apex.com', role: 'Stock Controller', pass: 'op456', branchId: 'BR-CHI-B' },
  { id: 'ST-005', name: 'Cassie Reilly', email: 'cassie@apex.com', role: 'Owner', pass: 'owner123', branchId: 'BR-GARY-4' },
  { id: 'ST-006', name: 'James Cole', email: 'james@apex.com', role: 'SysAdmin', pass: 'admin123', branchId: 'BR-GARY-4' },
  { id: 'ST-007', name: 'Admin User', email: 'admin@sci.com', role: 'Manager', pass: 'admin123', branchId: 'BR-HARARE' }
];

export const mockProducts: Product[] = [
  // Heavy Industrial Parts and Fasteners
  { id: 'prod-hex-bolt', code: 'HEX-B12', name: 'M12 Heavy Hex Bolt (Steel 8.8)', category: 'FASTENERS', price: 2.45, cost: 0.95, stock: 150, minStock: 30, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'In Stock' },
  { id: 'prod-pneu-valve', code: 'PNE-V52', name: '5/2-Way Pneumatic Control Valve', category: 'PNEUMATICS', price: 48.50, cost: 21.00, stock: 12, minStock: 3, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-07', healthStatus: 'In Stock' },
  { id: 'prod-cond-grease', code: 'CON-G50', name: 'Conductive Thermal Grease (50g)', category: 'CHEMICALS', price: 14.95, cost: 6.20, stock: 8, minStock: 10, unit: 'PK', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-01', healthStatus: 'Low Stock' },
  { id: 'prod-safety-helm', code: 'SAF-H04', name: 'Safety Helmet High-Vis Amber', category: 'PROTECTION', price: 19.90, cost: 8.50, stock: 35, minStock: 5, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-05-28', healthStatus: 'In Stock' },
  { id: 'prod-brass-adap', code: 'BRS-A38', name: '3/8" BSP Brass Hose Adapter', category: 'FITTINGS', price: 4.20, cost: 1.50, stock: 80, minStock: 15, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-05', healthStatus: 'In Stock' },
  { id: 'prod-shield-cable', code: 'CBL-S12', name: '12G Shielded Control Cable (10m)', category: 'ELECTRICAL', price: 34.50, cost: 17.10, stock: 2, minStock: 5, unit: 'METERS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-04', healthStatus: 'Low Stock' },
  { id: 'prod-steel-angle', code: 'STL-A40', name: 'Steel Angle Bar 40x40x3mm (2m)', category: 'MATERIALS', price: 22.80, cost: 11.20, stock: 0, minStock: 8, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-05-15', healthStatus: 'Out of Stock' },
  { id: 'prod-press-gauge', code: 'PSG-B10', name: 'Dial Pressure Gauge (10 Bar)', category: 'PNEUMATICS', price: 29.95, cost: 13.50, stock: 1, minStock: 5, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-04-10', healthStatus: 'Variance Risk' },
  { id: 'prod-solenoid-v', code: 'SLV-D24', name: 'Heavy Solenoid Valve 24VDC', category: 'ELECTRICAL', price: 65.00, cost: 30.00, stock: 4, minStock: 2, unit: 'PCS', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-01-12', healthStatus: 'Dead Stock' },

  // Motor Spares
  { id: 'STOCK-P-01', code: 'RAD-FJ200-L', name: 'Head Lamp FJ200 Series 2016 Left', category: 'Motor Spares', price: 85.00, cost: 50.00, stock: 4, minStock: 2, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'In Stock' },
  { id: 'STOCK-P-02', code: 'BJ-CBHO49', name: 'Ball Joint Honda Fit GD1', category: 'Motor Spares', price: 12.00, cost: 7.00, stock: 15, minStock: 5, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'In Stock' },
  { id: 'STOCK-P-03', code: 'BP-GD6-F', name: 'Brake Pads Toyota GD6 Front', category: 'Motor Spares', price: 28.00, cost: 16.00, stock: 9, minStock: 3, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-07', healthStatus: 'Low Stock' },
  { id: 'STOCK-P-04', code: 'OIL-5W30', name: 'Engine Oil 5W30 5L', category: 'Lubricants', price: 22.00, cost: 14.50, stock: 20, minStock: 6, unit: 'cans', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'In Stock' },
  { id: 'STOCK-P-05', code: 'CLT-N16', name: 'Clutch Plate Nissan N16', category: 'Motor Spares', price: 45.00, cost: 25.00, stock: 0, minStock: 2, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'Out of Stock' }
];

export const mockHeldTransactions: HeldTransaction[] = [
  {
    id: 'HELD-001',
    date: '2026-06-08T14:15:00Z',
    notes: 'Awaiting purchase order signoff',
    items: [
      { product: mockProducts[9], quantity: 10, discount: 0 },
      { product: mockProducts[13], quantity: 5, discount: 5 }
    ],
    total: 44.45
  },
  {
    id: 'HELD-002',
    date: '2026-06-08T15:00:00Z',
    notes: 'Client checking vehicle compatibility',
    items: [
      { product: mockProducts[10], quantity: 1, discount: 0 }
    ],
    total: 48.50
  }
];

export const mockRecentSales: Sale[] = [
  {
    id: 'TXN-88220',
    invoiceNo: 'INV-100481',
    date: '2026-06-08T09:12:00Z',
    operator: 'SYS_ADMIN',
    items: [
      { productId: 'prod-hex-bolt', name: 'M12 Heavy Hex Bolt (Steel 8.8)', code: 'HEX-B12', quantity: 20, price: 2.45, total: 49.00 },
      { productId: 'prod-press-gauge', name: 'Dial Pressure Gauge (10 Bar)', code: 'PSG-B10', quantity: 2, price: 29.95, total: 59.90 }
    ],
    subtotal: 108.90,
    tax: 10.89,
    discount: 0,
    total: 119.79,
    paymentMethod: 'CARD',
    status: 'COMPLETED'
  },
  {
    id: 'TXN-88221',
    invoiceNo: 'INV-100482',
    date: '2026-06-08T11:45:00Z',
    operator: 'SYS_ADMIN',
    items: [
      { productId: 'prod-pneu-valve', name: '5/2-Way Pneumatic Control Valve', code: 'PNE-V52', quantity: 3, price: 48.50, total: 145.50 },
      { productId: 'prod-safety-helm', name: 'Safety Helmet High-Vis Amber', code: 'SAF-H04', quantity: 5, price: 19.90, total: 99.50 }
    ],
    subtotal: 245.00,
    tax: 24.50,
    discount: 0,
    total: 269.50,
    paymentMethod: 'CASH',
    cashReceived: 300.00,
    changeGiven: 30.50,
    status: 'COMPLETED'
  }
];

export const mockShift: Shift = {
  id: 'SHIFT-2026-06-08-01',
  operator: 'SYS_ADMIN',
  status: 'ACTIVE',
  startTime: '2026-06-08T06:00:00Z',
  startingCash: 250.00,
  expectedCash: 300.00,
  salesCount: 2,
  totalSales: 389.29
};

export const mockCashMovements: CashMovement[] = [
  { id: 'CL-001', timestamp: '2026-06-08T06:00:00Z', type: 'INITIAL', amount: 250.00, reason: 'SYSTEM OPEN FLOAT LEVEL', operator: 'SYS_ADMIN' },
  { id: 'CL-002', timestamp: '2026-06-08T11:45:00Z', type: 'PAY_IN', amount: 50.00, reason: 'ADD QUARTERS COIN ROLL', operator: 'SYS_ADMIN' }
];

export const mockBIEvents: BIEvent[] = [
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
    payload: { details: "Manual inventory write-in. Clerk adjusted STEEL_THREAD_TAPE count upwards by 5 Units.", reason: "Discovered spare pack during shipping receiving." },
    severity: 'Low'
  }
];

export const mockAuditEvents: AuditEvent[] = [
  { id: 'AE-001', timestamp: '2026-06-08T06:00:00Z', eventType: 'SYSTEM_BOOT', operator: 'SYS_ADMIN', category: 'FIRMWARE', description: 'Thermal relay calibration and NVRAM self-test passed.', details: 'Relay latency: 1.2ms' },
  { id: 'AE-002', timestamp: '2026-06-08T06:05:00Z', eventType: 'DRAWER_CALIBRATED', operator: 'SYS_ADMIN', category: 'HARDWARE', description: 'Solenoid impulse tests returned consistent 12V pressure.', details: 'Signal duration: 150ms' },
  { id: 'AE-003', timestamp: '2026-06-08T09:15:00Z', eventType: 'TAX_SETTINGS_VIEW', operator: 'SYS_ADMIN', category: 'COMPLIANCE', description: 'Surtax indices verified against current state requirements.' },
  { id: 'AE-004', timestamp: '2026-06-08T11:45:00Z', eventType: 'FLOAT_ADDED', operator: 'Sarah Connor', category: 'CASHIER_LOG', description: 'Coins reloaded into POS-01 drawer.', details: 'Amount: $50.00' }
];

export const mockSettings: POSSettings = {
  businessProfile: {
    legalName: 'APEX INDUSTRIAL CORP',
    taxNo: 'VAT-US-991208',
    regNo: 'REG-552912',
    address: '77 Industrial Parkway, Sector 4',
    currency: 'USD'
  },
  hardwareSetting: {
    laserFocus: 'LASER_FOCUS: INTENSE_RED',
    drawerSignal: '12VDC_ELECTRO_M_PULSE'
  },
  taxSetting: {
    vatRatePct: 10,
    surtaxPct: 2,
    inclusive: true
  },
  receiptSetting: {
    header: 'INDUSTRIAL HEAVY MACHINE SUPPLY',
    footer: 'THANK YOU FOR YOUR PATRONAGE. SECURE TRANSACTION CORES.',
    slipWidth: '32_COLUMNS (STANDARD_SLIP)',
    showTaxBreakdown: true
  }
};

export const mockDeliveryOrders: DeliveryOrder[] = [
  {
    id: 'DEL-001',
    receiptNumber: 'RCT-0002',
    customerName: 'Tapiwa Moyo',
    customerWhatsApp: '+263771000001',
    deliveryAddress: '22 Rezende Street',
    district: 'Harare CBD',
    suburb: 'CBD',
    deliveryMethod: 'Vendor Delivery',
    status: 'Out for Delivery',
    secretCode: '483921',
    codeStatus: 'Code Sent',
    deliveryPersonId: 'DRV-001',
    vehicleType: 'Bike',
    vehicleRegistration: 'ACD-1234',
    driverPhone: '+263776000001',
    deliveryCharge: 5.00,
    notes: 'Fragile. Deliver to 2nd Floor office.'
  },
  {
    id: 'DEL-002',
    receiptNumber: 'RCT-0004',
    customerName: 'Rudo Ncube',
    customerWhatsApp: '+263772000002',
    deliveryAddress: '15 Lobengula Road',
    district: 'Bulawayo',
    suburb: 'Belmont',
    deliveryMethod: 'External Delivery',
    status: 'Assigned',
    secretCode: '582941',
    codeStatus: 'Code Sent',
    deliveryPersonId: 'DRV-002',
    vehicleType: 'Car',
    vehicleRegistration: 'AEF-5678',
    driverPhone: '+263776000002',
    deliveryCharge: 12.00,
    notes: 'Deliver before 5 PM.'
  },
  {
    id: 'DEL-003',
    receiptNumber: 'RCT-0005',
    customerName: 'Farai Sithole',
    customerWhatsApp: '+263773000003',
    deliveryAddress: 'Sakubva Market',
    district: 'Mutare Urban',
    suburb: 'Sakubva',
    deliveryMethod: 'Customer Collection',
    status: 'Waiting Collection',
    secretCode: '194725',
    codeStatus: 'Code Sent',
    notes: 'Customer will collect afternoon.'
  },
  {
    id: 'DEL-004',
    receiptNumber: 'RCT-0006',
    customerName: 'Memory Chikore',
    customerWhatsApp: '+263774000004',
    deliveryAddress: 'Unit L',
    district: 'Chitungwiza',
    suburb: 'Seke',
    deliveryMethod: 'Vendor Delivery',
    status: 'Pending Assignment',
    codeStatus: 'Not Generated',
    notes: 'Requires heavy transport.'
  },
  {
    id: 'DEL-005',
    receiptNumber: 'RCT-0007',
    customerName: 'Brian Dube',
    customerWhatsApp: '+263775000005',
    deliveryAddress: 'Harare South',
    district: 'Harare South',
    suburb: 'Mbare',
    deliveryMethod: 'External Delivery',
    status: 'Failed',
    codeStatus: 'Code Generated',
    deliveryPersonId: 'DRV-003',
    vehicleType: 'Lorry',
    vehicleRegistration: 'AGH-9012',
    driverPhone: '+263776000003',
    deliveryCharge: 20.00,
    notes: 'No answer on phone.',
    failedReason: 'Customer unavailable',
    nextAction: 'Retry Delivery'
  }
];

export const mockDeliveryPersons: DeliveryPerson[] = [
  {
    driverId: 'DRV-001',
    name: 'Mike Delivery',
    phone: '+263776000001',
    vehicleType: 'Bike',
    vehicleRegistration: 'ACD-1234',
    licenceNumber: 'DL-001',
    nationalIdPlaceholder: 'ID-001',
    serviceArea: 'Harare CBD',
    status: 'Active'
  },
  {
    driverId: 'DRV-002',
    name: 'Tendai Runner',
    phone: '+263776000002',
    vehicleType: 'Car',
    vehicleRegistration: 'AEF-5678',
    licenceNumber: 'DL-002',
    nationalIdPlaceholder: 'ID-002',
    serviceArea: 'Harare South',
    status: 'Active'
  },
  {
    driverId: 'DRV-003',
    name: 'External Courier',
    phone: '+263776000003',
    vehicleType: 'Lorry',
    vehicleRegistration: 'AGH-9012',
    licenceNumber: 'DL-003',
    nationalIdPlaceholder: 'ID-003',
    serviceArea: 'Harare Metro',
    status: 'Pending Verification'
  }
];

export const mockWalkInCollections: WalkInCollection[] = [
  {
    receiptNumber: 'RCT-0005',
    customerName: 'Farai Sithole',
    customerWhatsApp: '+263773000003',
    collectionCode: '194725',
    status: 'Pending'
  }
];

export const mockDeliveryEvents: DeliveryEvent[] = [
  {
    id: 'DLE-001',
    timestamp: '2026-06-08T10:00:00Z',
    eventType: 'DELIVERY_ASSIGNED',
    message: 'Driver assigned to receipt RCT-0002',
    operator: 'Admin Operator'
  },
  {
    id: 'DLE-002',
    timestamp: '2026-06-08T10:05:00Z',
    eventType: 'DELIVERY_SECRET_CODE_GENERATED',
    message: 'Customer code generated for DEL-001',
    operator: 'Admin Operator'
  },
  {
    id: 'DLE-003',
    timestamp: '2026-06-08T10:06:00Z',
    eventType: 'DELIVERY_CODE_SENT_PENDING_CONFIRMATION',
    message: 'WhatsApp code placeholder created for Tapiwa Moyo',
    operator: 'Admin Operator'
  }
];

export const mockSyncQueueItems: SyncQueueItem[] = [
  {
    id: 'Q-001',
    domain: 'Sales',
    eventType: 'SALE_COMPLETED',
    reference: 'RCT-0008',
    createdBy: 'Mary Cashier',
    createdAt: '2026-06-09T13:05:00Z',
    syncStatus: 'Pending',
    risk: 'Low',
    payload: JSON.stringify({ receiptNumber: 'RCT-0008', amount: 154.50, paymentMethod: 'Cash', itemsCount: 4 })
  },
  {
    id: 'Q-002',
    domain: 'Stock',
    eventType: 'STOCK_ADJUSTMENT_REQUESTED',
    reference: 'ADJ-0002',
    createdBy: 'Blessing Stock',
    createdAt: '2026-06-09T13:12:00Z',
    syncStatus: 'Pending',
    risk: 'High',
    payload: JSON.stringify({ adjustNumber: 'ADJ-0002', itemSku: 'SKU-FORGE-TR-01', diff: -12, reason: 'Physical stock count shortfall' })
  },
  {
    id: 'Q-003',
    domain: 'Cash',
    eventType: 'CASH_VARIANCE_FOUND',
    reference: 'SHIFT-0004',
    createdBy: 'Mary Cashier',
    createdAt: '2026-06-09T13:20:00Z',
    syncStatus: 'Pending',
    risk: 'High',
    payload: JSON.stringify({ shiftId: 'SHIFT-0004', expected: 450.00, actual: 442.00, difference: -8.00 })
  },
  {
    id: 'Q-004',
    domain: 'BI',
    eventType: 'SALE_BLOCKED_ZERO_STOCK',
    reference: 'CLT-N16',
    createdBy: 'Mary Cashier',
    createdAt: '2026-06-09T13:25:00Z',
    syncStatus: 'Pending',
    risk: 'Critical',
    payload: JSON.stringify({ cardId: 'CLT-N16', itemTried: 'Heavy Hex Bolts 24mm', attemptedQuantity: 50, currentStockValue: 0 })
  },
  {
    id: 'Q-005',
    domain: 'Delivery',
    eventType: 'DELIVERY_COMPLETED',
    reference: 'DEL-001',
    createdBy: 'Mike Delivery',
    createdAt: '2026-06-09T13:40:00Z',
    syncStatus: 'Ready',
    risk: 'Low',
    payload: JSON.stringify({ deliveryId: 'DEL-001', recipientName: 'Tapiwa Moyo', verifiedCode: '194725' })
  },
  {
    id: 'Q-006',
    domain: 'CRM',
    eventType: 'LEADS_FROM_WHATSAPP',
    reference: 'ENQ-005',
    createdBy: 'Mary Cashier',
    createdAt: '2026-06-09T13:45:00Z',
    syncStatus: 'Pending',
    risk: 'Medium',
    payload: JSON.stringify({ leadPhone: '+263777123456', interest: 'Large Batch GRN Screws Wholesale' })
  },
  {
    id: 'Q-007',
    domain: 'Settings',
    eventType: 'ROLE_PERMISSION_CHANGED',
    reference: 'ROLE-SUP',
    createdBy: 'Admin User',
    createdAt: '2026-06-09T14:00:00Z',
    syncStatus: 'Conflict',
    risk: 'Critical',
    payload: JSON.stringify({ targetRole: 'Supervisor', modifiedPermissions: ['CanEditTaxes', 'CanManuallyReconcile'] })
  }
];

export const mockSyncConflicts: SyncConflict[] = [
  {
    id: 'SC-001',
    conflictType: 'STOCK_CONFLICT',
    risk: 'High',
    description: 'Product stock changed online while terminal was offline',
    recommendedAction: 'Recheck product quantity before posting stock movement'
  },
  {
    id: 'SC-002',
    conflictType: 'RECEIPT_DUPLICATE',
    risk: 'Critical',
    description: 'Same receipt number used on another terminal',
    recommendedAction: 'Regenerate receipt sequence before sync'
  },
  {
    id: 'SC-003',
    conflictType: 'ROLE_PERMISSION_CONFLICT',
    risk: 'Critical',
    description: 'Role permission changed while staff was still logged in',
    recommendedAction: 'Force staff re-login before sync'
  },
  {
    id: 'SC-004',
    conflictType: 'SHIFT_STATE_CONFLICT',
    risk: 'High',
    description: 'Cash shift closed online before offline events synced',
    recommendedAction: 'Supervisor must reconcile shift'
  },
  {
    id: 'SC-005',
    conflictType: 'DELIVERY_DUPLICATE_CONFIRMATION',
    risk: 'Medium',
    description: 'Delivery marked complete twice',
    recommendedAction: 'Review delivery audit trail'
  }
];

export const mockSyncActivityEvents: SyncActivityEvent[] = [
  {
    id: 'ACT-001',
    timestamp: '2026-06-09T08:00:00Z',
    eventType: 'TERMINAL_OFFLINE_MODE_ENABLED',
    message: 'Connectivity drop simulated. Terminal shifted to local SQLite buffer mode.',
    operator: 'Admin Operator'
  },
  {
    id: 'ACT-002',
    timestamp: '2026-06-09T08:15:00Z',
    eventType: 'LOCAL_QUEUE_ITEM_CREATED',
    message: 'Local draft of Delivery Completed created for DEL-001.',
    operator: 'Mike Delivery'
  }
];

export const mockOwnerSummary: OwnerSummary = {
  todaySales: 'USD 1,245.00',
  grossMarginPlaceholder: 'USD 405.00',
  cashExpected: 'USD 760.00',
  cashDeclared: 'USD 755.00',
  cashVariance: 'USD -5.00',
  openApprovals: 6,
  stockRiskFlags: 9,
  pendingSyncItems: 23,
  completedDeliveries: 9,
  whatsAppLeads: 8,
  convertedOrders: 3,
  eodStatus: 'Review Required'
};

export const mockEODChecklist: EODChecklistItem[] = [
  { id: 'EOD-CHK-001', label: 'All shifts closed', status: 'Warning', ownerAction: 'Review shifts', notes: 'POS-01 remains open.' },
  { id: 'EOD-CHK-002', label: 'Cash declared for all terminals', status: 'Passed', ownerAction: 'View declarations', notes: 'Declarations found for closed registers.' },
  { id: 'EOD-CHK-003', label: 'Cash variances reviewed', status: 'Failed', ownerAction: 'Review variance', notes: 'USD -5.00 variance requires owner signoff.' },
  { id: 'EOD-CHK-004', label: 'Pending refunds reviewed', status: 'Pending', ownerAction: 'Review refunds', notes: 'Refund queue awaiting decision.' },
  { id: 'EOD-CHK-005', label: 'Pending voids reviewed', status: 'Pending', ownerAction: 'Review voids', notes: 'Void queue awaiting decision.' },
  { id: 'EOD-CHK-006', label: 'Stock adjustments reviewed', status: 'Warning', ownerAction: 'Open stock review', notes: 'One adjustment remains open.' },
  { id: 'EOD-CHK-007', label: 'GRN variances reviewed', status: 'Warning', ownerAction: 'Review GRNs', notes: 'Supplier variance needs confirmation.' },
  { id: 'EOD-CHK-008', label: 'Delivery codes confirmed', status: 'Passed', ownerAction: 'View delivery codes', notes: 'Completed delivery codes verified.' },
  { id: 'EOD-CHK-009', label: 'Failed deliveries reviewed', status: 'Warning', ownerAction: 'Review failures', notes: 'DEL-005 remains open.' },
  { id: 'EOD-CHK-010', label: 'Pending sync queue checked', status: 'Failed', ownerAction: 'Review sync queue', notes: '23 items pending sync.' },
  { id: 'EOD-CHK-011', label: 'BI critical alerts reviewed', status: 'Failed', ownerAction: 'Review BI alerts', notes: 'Critical alerts are not reviewed.' },
  { id: 'EOD-CHK-012', label: 'Receipt sequence checked', status: 'Passed', ownerAction: 'View sequence', notes: 'Receipt sequence has no duplicate flags.' }
];

export const mockEODReconciliationRows: EODReconciliationRow[] = [
  { id: 'EOD-REC-001', domain: 'Sales', expected: 'USD 1,245.00', actual: 'USD 1,245.00', variance: 'USD 0.00', status: 'Balanced', requiredAction: 'None' },
  { id: 'EOD-REC-002', domain: 'Cash Drawer', expected: 'USD 760.00', actual: 'USD 755.00', variance: 'USD -5.00', status: 'Variance', requiredAction: 'Supervisor review' },
  { id: 'EOD-REC-003', domain: 'EcoCash', expected: 'USD 320.00', actual: 'USD 320.00', variance: 'USD 0.00', status: 'Balanced', requiredAction: 'None' },
  { id: 'EOD-REC-004', domain: 'Swipe', expected: 'USD 215.00', actual: 'USD 215.00', variance: 'USD 0.00', status: 'Balanced', requiredAction: 'None' },
  { id: 'EOD-REC-005', domain: 'Stock Movements', expected: '14 Events', actual: '13 Confirmed', variance: '1 Pending', status: 'Review', requiredAction: 'Check stock adjustment' },
  { id: 'EOD-REC-006', domain: 'Delivery', expected: '11 Orders', actual: '9 Completed', variance: '2 Pending', status: 'Review', requiredAction: 'Follow up deliveries' },
  { id: 'EOD-REC-007', domain: 'Sync Queue', expected: '23 Items', actual: '0 Synced', variance: '23 Pending', status: 'Failed', requiredAction: 'Run sync check' },
  { id: 'EOD-REC-008', domain: 'BI Critical Alerts', expected: '3', actual: '0 Reviewed', variance: '3 Pending', status: 'Failed', requiredAction: 'Owner review required' }
];

export const mockTerminalEODSummary: TerminalEODSummary[] = [
  { id: 'TERM-EOD-001', branch: 'Harare Main', terminal: 'POS-01', staff: 'Mary Cashier', shiftStatus: 'Open', sales: 'USD 710.00', expectedCash: 'USD 420.00', declaredCash: 'Pending', variance: 'Pending', syncStatus: 'Pending Sync', action: 'Review' },
  { id: 'TERM-EOD-002', branch: 'Harare Main', terminal: 'POS-02', staff: 'Tawanda Supervisor', shiftStatus: 'Closed', sales: 'USD 315.00', expectedCash: 'USD 220.00', declaredCash: 'USD 220.00', variance: 'USD 0.00', syncStatus: 'Synced', action: 'View' },
  { id: 'TERM-EOD-003', branch: 'Harare Main', terminal: 'BACK-01', staff: 'Admin User', shiftStatus: 'Closed', sales: 'USD 220.00', expectedCash: 'USD 120.00', declaredCash: 'USD 115.00', variance: 'USD -5.00', syncStatus: 'Conflict', action: 'Review' }
];

export const mockOwnerApprovals: OwnerApprovalItem[] = [
  { id: 'APR-001', type: 'Cash Variance', requestedBy: 'Mary Cashier', amountOrValue: 'USD -5.00', risk: 'High', status: 'Pending', action: 'Review' },
  { id: 'APR-002', type: 'Refund Request', requestedBy: 'Mary Cashier', amountOrValue: 'USD 57.00', risk: 'High', status: 'Pending', action: 'Review' },
  { id: 'APR-003', type: 'Price Override', requestedBy: 'Mary Cashier', amountOrValue: '15% Discount', risk: 'Medium', status: 'Pending', action: 'Approve' },
  { id: 'APR-004', type: 'GRN Variance', requestedBy: 'Blessing Stock', amountOrValue: '+2 Units', risk: 'High', status: 'Pending', action: 'Review' },
  { id: 'APR-005', type: 'Stock Adjustment', requestedBy: 'Blessing Stock', amountOrValue: '-1 Unit', risk: 'High', status: 'Pending', action: 'Review' },
  { id: 'APR-006', type: 'Failed Delivery', requestedBy: 'Mike Delivery', amountOrValue: 'DEL-005', risk: 'Medium', status: 'Open', action: 'Follow Up' }
];

export const mockOwnerBIAlerts: OwnerBIAlert[] = [
  { id: 'OBI-001', eventType: 'CASH_VARIANCE_FOUND', severity: 'High', message: 'Drawer short by USD 5.00' },
  { id: 'OBI-002', eventType: 'SALE_BLOCKED_ZERO_STOCK', severity: 'Critical', message: 'Zero stock sale attempt blocked' },
  { id: 'OBI-003', eventType: 'RECOMMEND_MAJOR_STOCKTAKE', severity: 'High', message: 'Motor Spares category risk increasing' },
  { id: 'OBI-004', eventType: 'SYNC_CONFLICT_FLAGGED', severity: 'Critical', message: 'Role permission conflict in local queue' },
  { id: 'OBI-005', eventType: 'REFUND_APPROVAL_REQUIRED', severity: 'High', message: 'Refund above cashier permission' },
  { id: 'OBI-006', eventType: 'DELIVERY_FAILURE_REVIEW_REQUIRED', severity: 'High', message: 'Failed delivery requires follow-up' },
  { id: 'OBI-007', eventType: 'CUSTOMER_SERVICE_RISK', severity: 'Medium', message: 'Poor service flag recorded' }
];

export const mockOwnerActivityEvents: OwnerActivityEvent[] = [
  { id: 'OWN-ACT-001', timestamp: '2026-06-09T14:10:00Z', eventType: 'EOD_CHECK_RUN', message: 'EOD check loaded for owner review.', operator: 'Admin User' },
  { id: 'OWN-ACT-002', timestamp: '2026-06-09T14:12:00Z', eventType: 'OWNER_BI_REVIEW_STARTED', message: 'Critical BI review started.', operator: 'Admin User' },
  { id: 'OWN-ACT-003', timestamp: '2026-06-09T14:15:00Z', eventType: 'OWNER_CASH_VARIANCE_REVIEWED', message: 'Cash variance placed under owner review.', operator: 'Admin User' },
  { id: 'OWN-ACT-004', timestamp: '2026-06-09T14:18:00Z', eventType: 'OWNER_SYNC_REVIEW_STARTED', message: 'Pending sync queue review started.', operator: 'Admin User' },
  { id: 'OWN-ACT-005', timestamp: '2026-06-09T14:20:00Z', eventType: 'APPROVAL_MARKED_REVIEWED', message: 'Approval queue item marked reviewed.', operator: 'Admin User' },
  { id: 'OWN-ACT-006', timestamp: '2026-06-09T14:22:00Z', eventType: 'EOD_LOCK_ATTEMPTED', message: 'Day lock attempted with open failed checks.', operator: 'Admin User' },
  { id: 'OWN-ACT-007', timestamp: '2026-06-09T14:25:00Z', eventType: 'EOD_REPORT_EXPORT_PREPARED', message: 'EOD report export prepared.', operator: 'Admin User' }
];
