import { 
  Vendor, 
  Branch, 
  Warehouse, 
  Terminal, 
  StaffMember, 
  Product, 
  ProductBarcodeRecord,
  ProductMasterRecord,
  ProductPriceRecord,
  ProductReorderRule,
  ProductStockBalance,
  ProductSupplierLink,
  StockHealthRow,
  StockHealthRecommendation,
  InventoryValueReportRow,
  SupplierPerformanceRow,
  TransferDelayRow,
  GRNDelayRow,
  StockMovementAuditRow,
  InventoryReportActivityEvent,
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
  DeliveryActivityEvent,
  DeliveryAssignment,
  DeliveryCashCollection,
  DeliveryConfirmationCode,
  DeliveryProvider,
  DeliveryRequest,
  DeliveryRequestLine,
  DeliveryTrackingEvent,
  DeliveryWhatsAppMessageDraft,
  SyncQueueItem,
  SyncConflict,
  SyncActivityEvent,
  OfflineSyncQueueItem,
  OfflineSyncBatch,
  OfflineSyncConflict,
  OfflineSyncConflictDecision,
  OfflineSyncHealth,
  OfflineSyncActivityEvent,
  LocalTerminalSnapshot,
  ProductImportBatch,
  ProductImportRow,
  ProductImportColumnMapping,
  ProductImportValidationIssue,
  IndustrialSectorMappingTemplate,
  ProductImportActivityEvent,
  OpeningBalanceDraftFromImport,
  OwnerSummary,
  EODSession,
  EODChecklistItem,
  EODReconciliationRow,
  EODPaymentSummary,
  EODShiftSummary,
  EODCashReconciliation,
  EODInventoryClosingRow,
  EODDeliveryClosingRow,
  EODBIReviewItem,
  EODActivityEvent,
  TerminalEODSummary,
  OwnerApprovalItem,
  OwnerBIAlert,
  OwnerActivityEvent,
  POSPlan,
  VendorPOSSubscription,
  VendorPOSLicense,
  POSFeatureEntitlement,
  POSFeatureKey,
  PaymentReceiptRow,
  ProductLedgerEntry,
  InventoryMovement,
  COAAccount,
  AccountingPosting,
  AccountingPostingLine,
  CashbookEntry,
  SalesAccountingSummary,
  PaymentAccountingSummary,
  COGSReserveSummary,
  VATSummary,
  InventoryAssetPostingRow,
  AccountingReadinessCheck,
  AccountingActivityEvent,
  AccountingMappingRule,
  ChartOfAccountsPlaceholder,
  InventoryAccountingActivityEvent,
  InventoryAccountingReadinessLine,
  InventoryAccountingReadinessRecord,
  ReceiptRecord,
  ReceiptLine,
  ReceiptPaymentLine,
  ReceiptSequenceControl,
  ReceiptReprintAudit,
  FiscalizationPlaceholderRecord,
  ReceiptAuditEvent,
  TerminalLifecycleRecord,
  TerminalActivationRequest,
  ShiftSessionControl,
  CashDrawerAssignment,
  TerminalControlEvent,
  OperationalApprovalRequest,
  OperationalApprovalEvent,
  CustomerRecord,
  CustomerAddress,
  CustomerPurchaseHistoryRow,
  CustomerNote,
  CustomerActivityEvent,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderActivityEvent,
  GoodsReceivingNote,
  GoodsReceivingLine,
  GoodsReceivingVariance,
  GoodsReceivingActivityEvent,
  POReceivingSummary,
  SupplierReturn,
  SupplierReturnLine,
  SupplierReturnActivityEvent,
  SupplierReturnCreditNotePlaceholder,
  StockAdjustment,
  StockAdjustmentLine,
  StockAdjustmentActivityEvent,
  StocktakeActivityEvent,
  StocktakeLine,
  StocktakeSession,
  StockTransfer,
  StockTransferActivityEvent,
  StockTransferDispatch,
  StockTransferLine,
  StockTransferReceive,
  StockTransferVariance
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
  { id: 'BR-HARARE', name: 'Harare Main', location: 'Harare, Zimbabwe' },
  { id: 'BR-BYO', name: 'Bulawayo Branch', location: 'Bulawayo, Zimbabwe' }
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
  { id: 'TERM-HARARE-01', name: 'Term-A', branchId: 'BR-HARARE', type: 'STANDARD' },
  { id: 'POS-01', name: 'POS-01 Harare Front Counter', branchId: 'BR-HARARE', type: 'STANDARD' },
  { id: 'BACK-01', name: 'BACK-01 Harare Back Office', branchId: 'BR-HARARE', type: 'BACK_OFFICE' },
  { id: 'POS-02', name: 'POS-02 Bulawayo Counter', branchId: 'BR-BYO', type: 'STANDARD' }
];

export const mockTerminalLifecycleRecords: TerminalLifecycleRecord[] = [
  {
    id: 'TLC-POS-01',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    terminalName: 'POS-01 Harare Front Counter',
    status: 'Active',
    approvedBy: 'Admin User',
    approvedAt: '2026-06-10T07:00:00Z',
    updatedAt: '2026-06-10T07:00:00Z'
  },
  {
    id: 'TLC-POS-02',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-BYO',
    terminalId: 'POS-02',
    terminalName: 'POS-02 Bulawayo Counter',
    status: 'Active',
    approvedBy: 'Tawanda Supervisor',
    approvedAt: '2026-06-10T07:15:00Z',
    updatedAt: '2026-06-10T07:15:00Z'
  },
  {
    id: 'TLC-BACK-01',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'BACK-01',
    terminalName: 'BACK-01 Harare Back Office',
    status: 'Active',
    approvedBy: 'Admin User',
    approvedAt: '2026-06-10T06:45:00Z',
    updatedAt: '2026-06-10T06:45:00Z'
  },
  {
    id: 'TLC-POS-03',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-03',
    terminalName: 'POS-03 Harare Spare Counter',
    status: 'Activation Requested',
    requestedBy: 'Mary Cashier',
    requestedAt: '2026-06-11T08:20:00Z',
    reason: 'Replacement front counter terminal requires local activation.',
    updatedAt: '2026-06-11T08:20:00Z'
  },
  {
    id: 'TLC-POS-LOCKED',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-LOCKED',
    terminalName: 'POS-LOCKED Review Terminal',
    status: 'Locked',
    lockedReason: 'Terminal is locked pending review.',
    updatedAt: '2026-06-11T07:55:00Z'
  }
];

export const mockTerminalActivationRequests: TerminalActivationRequest[] = [
  {
    id: 'TAR-POS-03',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-03',
    terminalName: 'POS-03 Harare Spare Counter',
    status: 'Activation Requested',
    requestedBy: 'Mary Cashier',
    requestedAt: '2026-06-11T08:20:00Z',
    reason: 'Replacement front counter terminal requires local activation.'
  }
];

export const mockShiftSessionControls: ShiftSessionControl[] = [
  {
    id: 'SSC-POS-01-20260611',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    terminalName: 'POS-01 Harare Front Counter',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    status: 'Open',
    openedAt: '2026-06-11T07:30:00Z',
    openingFloat: 120,
    expectedCash: 120,
    notes: 'Morning cashier shift open.'
  },
  {
    id: 'SSC-POS-02-20260610',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-BYO',
    terminalId: 'POS-02',
    terminalName: 'POS-02 Bulawayo Counter',
    staffId: 'ST-TAWANDA',
    staffName: 'Tawanda Supervisor',
    status: 'Closed',
    openedAt: '2026-06-10T07:45:00Z',
    closedAt: '2026-06-10T17:15:00Z',
    openingFloat: 100,
    expectedCash: 480,
    declaredCash: 480,
    variance: 0,
    notes: 'Shift closed balanced.'
  },
  {
    id: 'SSC-BACK-01-20260611',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'BACK-01',
    terminalName: 'BACK-01 Harare Back Office',
    staffId: 'ST-ADMIN',
    staffName: 'Admin User',
    status: 'Open',
    openedAt: '2026-06-11T08:00:00Z',
    openingFloat: 0,
    expectedCash: 0,
    notes: 'Back office session open.'
  }
];

export const mockCashDrawerAssignments: CashDrawerAssignment[] = [
  {
    id: 'CDA-POS-01-MARY',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    terminalName: 'POS-01 Harare Front Counter',
    drawerId: 'DRAWER-POS-01-A',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    status: 'Assigned',
    openingFloat: 120,
    assignedAt: '2026-06-11T07:30:00Z',
    notes: 'Drawer assigned for cash sales.'
  }
];

export const mockTerminalControlEvents: TerminalControlEvent[] = [
  {
    id: 'TCE-POS-01-ACTIVE',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-ADMIN',
    staffName: 'Admin User',
    eventType: 'ACTIVATE_TERMINAL',
    message: 'POS-01 activated for Harare front counter.',
    severity: 'INFO',
    createdAt: '2026-06-10T07:00:00Z'
  },
  {
    id: 'TCE-POS-01-OPEN',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    eventType: 'OPEN_SHIFT',
    message: 'Mary Cashier opened POS-01 shift.',
    severity: 'INFO',
    createdAt: '2026-06-11T07:30:00Z'
  },
  {
    id: 'TCE-POS-03-REQUEST',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-03',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    eventType: 'REQUEST_REACTIVATION',
    message: 'POS-03 activation requested.',
    severity: 'WARNING',
    createdAt: '2026-06-11T08:20:00Z'
  }
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
  { id: 'STOCK-P-05', code: 'CLT-N16', name: 'Clutch Plate Nissan N16', category: 'Motor Spares', price: 45.00, cost: 25.00, stock: 0, minStock: 2, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-08', healthStatus: 'Out of Stock' },
  { id: 'OIL-FLT-15', code: 'OIL-FLT-15', name: 'Premium Oil Filter 15W40', category: 'Motor Spares', price: 45.00, cost: 24.00, stock: 18, minStock: 4, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-09', healthStatus: 'In Stock' },
  { id: 'SP-PLT-G', code: 'SP-PLT-G', name: 'Spark Plug Platinum G-Power', category: 'Motor Spares', price: 27.00, cost: 12.00, stock: 42, minStock: 10, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-09', healthStatus: 'In Stock' },
  { id: 'FB-VR-HM', code: 'FB-VR-HM', name: 'Heavy Duty Fan Belt v-Ribbed', category: 'Motor Spares', price: 60.00, cost: 31.00, stock: 7, minStock: 2, unit: 'pcs', branch: 'Harare Main', warehouse: 'Harare Spares Depot', lastMovementDate: '2026-06-09', healthStatus: 'In Stock' }
];

const productMasterBase = (product: Product, index: number, overrides: Partial<ProductMasterRecord> = {}): ProductMasterRecord => {
  const marginPercent = product.price > 0 ? Math.round(((product.price - product.cost) / product.price) * 100) : 0;
  return {
    productId: product.id,
    vendorId: 'SCI-LOG-ZW',
    productCode: product.code,
    sku: product.sku || product.code,
    barcode: product.barcode || `263000${String(index + 1).padStart(6, '0')}`,
    alu: product.alu || `ALU-${String(index + 1).padStart(4, '0')}`,
    vendorSku: `VEND-${product.code}`,
    productNumericNumber: product.productNumericNumber || `PN-${String(index + 1).padStart(5, '0')}`,
    productName: product.productName || product.name,
    description: `${product.name} product master identity and commercial placeholder.`,
    shortDescription: `${product.name} master record placeholder.`,
    brand: product.brand || (product.category === 'Lubricants' ? 'DuraLube' : 'Genuine Select'),
    manufacturer: product.manufacturer || 'Approved Motor Parts',
    supplierName: product.supplierName || 'Motor Spares Wholesalers',
    supplierItemCode: `MSW-${product.code}`,
    industrialSector: product.category === 'Lubricants' ? 'Automotive Lubricants' : 'Motor Spares',
    productCategory: product.category,
    productSubCategory: product.productSubCategory || product.category,
    productType: 'Stock Item',
    status: product.stock <= 0 ? 'Active' : 'Active',
    productStatus: product.stock <= 0 ? 'Active' : 'Active',
    riskStatus: product.stock <= 0 ? 'Out Of Stock' : product.healthStatus === 'Low Stock' ? 'Low Stock' : product.healthStatus === 'Variance Risk' ? 'Variance Risk' : 'Normal',
    category: product.category,
    unitOfMeasure: product.unit,
    condition: 'New',
    colour: product.name.toLowerCase().includes('chrome') ? 'Chrome' : undefined,
    make: product.name.includes('Honda') ? 'Honda' : product.name.includes('Toyota') ? 'Toyota' : product.name.includes('Nissan') ? 'Nissan' : product.name.includes('Isuzu') ? 'Isuzu' : undefined,
    model: product.name.includes('GD6') ? 'Hilux GD6' : product.name.includes('GD1') ? 'Fit GD1' : product.name.includes('N16') ? 'N16' : product.name.includes('FJ200') ? 'FJ200' : undefined,
    yearFrom: product.name.includes('2013') ? '2013' : product.name.includes('2016') ? '2016' : undefined,
    yearTo: product.name.includes('2013') ? '2016' : undefined,
    side: product.name.toLowerCase().includes('left') ? 'Left' : product.name.toLowerCase().includes('right') ? 'Right' : undefined,
    partNumber: `PART-${product.code}`,
    oemNumber: `OEM-${product.code}`,
    tags: [product.category, product.code, product.name],
    taxCode: 'VAT15',
    taxMode: 'VAT Registered',
    vatRate: 15,
    defaultSellingPrice: product.sellingPrice ?? product.price,
    defaultCostPrice: product.costPrice ?? product.cost,
    reorderLevel: product.minStock,
    reorderQty: Math.max(5, product.minStock * 2),
    marginPercent,
    preferredSupplierId: product.supplierId || 'SUP-MOTOR-SPARES',
    preferredSupplierName: product.supplierName || 'Motor Spares Wholesalers',
    salesAccountCOA: product.salesAccountCOA || '4100-SALES',
    assetAccountCOA: product.assetAccountCOA || '1200-INVENTORY',
    cogsAccountCOA: '5100-COGS',
    sectorAttributes: {
      sector: product.industrialSector || (product.category === 'Motor Spares' || product.category === 'Lubricants' ? 'Automotive' : 'Industrial Supplies'),
      productCategory: product.productCategory || product.category,
      productSubCategory: product.productSubCategory || product.category,
      brand: product.brand || 'SCI Industrial',
      manufacturer: product.manufacturer || 'Approved Supplier',
      make: product.name.includes('Honda') ? 'Honda' : product.name.includes('Toyota') ? 'Toyota' : product.name.includes('Nissan') ? 'Nissan' : product.name.includes('Isuzu') ? 'Isuzu' : undefined,
      model: product.name.includes('GD6') ? 'Hilux GD6' : product.name.includes('GD1') ? 'Fit GD1' : product.name.includes('N16') ? 'N16' : product.name.includes('FJ200') ? 'FJ200' : undefined,
      yearFrom: product.name.includes('2013') ? '2013' : product.name.includes('2016') ? '2016' : undefined,
      yearTo: product.name.includes('2013') ? '2016' : undefined,
      side: product.name.toLowerCase().includes('left') ? 'Left' : product.name.toLowerCase().includes('right') ? 'Right' : undefined,
      partNumber: `PART-${product.code}`,
      oemNumber: `OEM-${product.code}`,
      engineCode: 'Placeholder',
      chassisCode: 'Placeholder',
      productType: 'Stock Item',
      productGrade: 'Standard',
      serialTrackingRequired: Boolean(product.isSerialized),
      batchTrackingRequired: product.category === 'Lubricants' || product.category === 'CHEMICALS',
      expiryRequired: product.category === 'Lubricants' || product.category === 'CHEMICALS',
      notes: 'Sector attributes are local placeholders for later product governance.'
    },
    createdByStaffId: 'ST-BLESSING',
    approvedByStaffId: 'ST-ADMIN',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-11T08:00:00Z',
    ...overrides
  };
};

export const mockProductMasterRecords: ProductMasterRecord[] = [
  productMasterBase(mockProducts[10], 10, { preferredSupplierId: 'SUP-MOTOR-SPARES', preferredSupplierName: 'Motor Spares Wholesalers' }),
  productMasterBase(mockProducts[11], 11, { preferredSupplierId: 'SUP-BRAKE-PARTS', preferredSupplierName: 'Brake Parts Direct', riskStatus: 'Low Stock' }),
  productMasterBase(mockProducts[12], 12, { preferredSupplierId: 'SUP-LUBRICANTS', preferredSupplierName: 'Lubricants Direct' }),
  productMasterBase({ id: 'STOCK-P-RAD-COROLLA', code: 'RAD-COROLLA', name: 'Radiator Toyota Corolla', category: 'Motor Spares', price: 110, cost: 72, stock: 6, minStock: 2, unit: 'pcs' }, 17, { preferredSupplierId: 'SUP-RADIATOR', preferredSupplierName: 'Radiator Imports' }),
  productMasterBase(mockProducts[13], 13, { riskStatus: 'Out Of Stock' }),
  productMasterBase(mockProducts[9], 9, { preferredSupplierId: 'SUP-LAMPS', preferredSupplierName: 'Vehicle Lighting Imports' }),
  productMasterBase({ id: 'STOCK-P-AIRCON-ISUZU', code: 'ACR-ISUZU-1316', name: 'Air Con Radiator Isuzu 2013-16', category: 'Motor Spares', price: 95, cost: 58, stock: 5, minStock: 2, unit: 'pcs' }, 18, { preferredSupplierId: 'SUP-RADIATOR', preferredSupplierName: 'Radiator Imports' }),
  productMasterBase({ id: 'STOCK-P-SHOCK-NP300-F', code: 'SHK-NP300-F', name: 'Shock Absorber Nissan NP300 Front', category: 'Motor Spares', price: 38, cost: 21, stock: 8, minStock: 3, unit: 'pcs' }, 19, { preferredSupplierId: 'SUP-SUSPENSION', preferredSupplierName: 'Suspension Parts Africa' }),
  productMasterBase({ id: 'STOCK-P-HILUX-MIR-RC', code: 'MIR-GD6-RC', name: 'Toyota Hilux GD6 Mirror Right Chrome', category: 'Motor Spares', price: 62, cost: 34, stock: 3, minStock: 2, unit: 'pcs' }, 20, { preferredSupplierId: 'SUP-BODY-PARTS', preferredSupplierName: 'Body Parts Warehouse' }),
  productMasterBase({ id: 'STOCK-P-NGK-BKR6E', code: 'NGK-BKR6E', name: 'Spark Plug NGK BKR6E', category: 'Motor Spares', price: 6.5, cost: 2.8, stock: 55, minStock: 12, unit: 'pcs' }, 21, { brand: 'NGK', manufacturer: 'NGK', preferredSupplierId: 'SUP-IGNITION', preferredSupplierName: 'Ignition Components Hub', riskStatus: 'Fast Moving' })
];

const balanceRowsForProduct = (record: ProductMasterRecord, seedQty: number): ProductStockBalance[] => {
  const rows: Array<{ branchId: string; branchName: string; warehouseId: string; warehouseName: string; locationId: string; locationName: string; locationType: ProductStockBalance['locationType']; qty: number; reserved?: number; damaged?: number; returnHolding?: number; transit?: number; blocked?: number }> = [
    { branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-HARARE-01', warehouseName: 'Harare Main Warehouse', locationId: 'LOC-HRE-WH', locationName: 'Harare Main Warehouse', locationType: 'Main Warehouse', qty: seedQty },
    { branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-HARARE-FLOOR', warehouseName: 'Harare Sales Floor', locationId: 'LOC-HRE-FLOOR', locationName: 'Harare Sales Floor', locationType: 'Sales Floor', qty: Math.max(0, Math.floor(seedQty * 0.35)), reserved: seedQty > 5 ? 1 : 0 },
    { branchId: 'BR-BYO', branchName: 'Bulawayo Branch', warehouseId: 'WH-BYO-01', warehouseName: 'Bulawayo Branch Warehouse', locationId: 'LOC-BYO-WH', locationName: 'Bulawayo Branch Warehouse', locationType: 'Branch Warehouse', qty: Math.max(0, Math.floor(seedQty * 0.25)) },
    { branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-DMG-01', warehouseName: 'Damaged Holding', locationId: 'LOC-DMG', locationName: 'Damaged Holding', locationType: 'Damaged Holding', qty: 0, damaged: seedQty > 10 ? 1 : 0 },
    { branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-RET-01', warehouseName: 'Return Holding', locationId: 'LOC-RETURN', locationName: 'Return Holding', locationType: 'Return Holding', qty: 0, returnHolding: seedQty > 8 ? 1 : 0 },
    { branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-TRANSIT', warehouseName: 'In Transit', locationId: 'LOC-TRANSIT', locationName: 'In Transit', locationType: 'In Transit', qty: 0, transit: seedQty <= 3 ? 4 : 0 }
  ];

  return rows.map((row, index) => {
    const qtyReserved = row.reserved || 0;
    const qtyDamaged = row.damaged || 0;
    const qtyReturnHolding = row.returnHolding || 0;
    const qtyInTransit = row.transit || 0;
    const qtyBlocked = row.blocked || 0;
    const qtyOnHand = row.qty + qtyDamaged + qtyReturnHolding + qtyBlocked;
    const qtyAvailable = Math.max(0, row.qty - qtyReserved - qtyDamaged - qtyReturnHolding - qtyBlocked);
    const status = qtyInTransit > 0 ? 'In Transit' : qtyReturnHolding > 0 ? 'Return Holding' : qtyDamaged > 0 ? 'Damaged' : qtyAvailable <= 0 ? 'Out Of Stock' : qtyAvailable <= Math.max(2, Math.floor(seedQty * 0.15)) ? 'Reorder Required' : 'Available';
    return {
      balanceId: `BAL-${record.productId}-${index + 1}`,
      vendorId: record.vendorId,
      productId: record.productId,
      sku: record.sku,
      productName: record.productName,
      branchId: row.branchId,
      branchName: row.branchName,
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName,
      locationId: row.locationId,
      locationName: row.locationName,
      locationType: row.locationType,
      shelfLocation: index === 1 ? 'PH-COUNTER-01' : index === 0 ? 'A1-MASTER' : undefined,
      binLocation: index === 0 ? 'BIN-01' : undefined,
      qtyOnHand,
      qtyReserved,
      qtyAvailable,
      qtyDamaged,
      qtyReturnHolding,
      qtyInTransit,
      qtyBlocked,
      reorderLevel: Math.max(2, Math.floor(seedQty * 0.2)),
      reorderQty: Math.max(5, Math.floor(seedQty * 0.6)),
      status,
      lastMovementDate: '2026-06-11T08:00:00Z',
      lastMovementAt: '2026-06-11T08:00:00Z',
      lastStocktakeAt: '2026-06-10T16:00:00Z',
      updatedAt: '2026-06-11T08:00:00Z'
    };
  });
};

export const mockProductStockBalances: ProductStockBalance[] = mockProductMasterRecords.flatMap((record, index) => (
  balanceRowsForProduct(record, mockProducts.find((product) => product.id === record.productId)?.stock ?? (index + 1) * 3)
));

export const mockProductBarcodeRecords: ProductBarcodeRecord[] = mockProductMasterRecords.flatMap((record) => ([
  { barcodeId: `BAR-${record.productId}-PRIMARY`, productId: record.productId, barcode: record.barcode || record.sku, barcodeType: 'Primary', packSize: 1, isActive: true },
  { barcodeId: `BAR-${record.productId}-CASE`, productId: record.productId, barcode: `${record.sku}-CASE`, barcodeType: 'Case Pack', packSize: 12, isActive: true, notes: 'Case barcode placeholder.' }
]));

export const mockProductSupplierLinks: ProductSupplierLink[] = mockProductMasterRecords.map((record) => ({
  supplierLinkId: `PSL-${record.productId}`,
  productId: record.productId,
  supplierId: record.preferredSupplierId || 'SUP-GENERAL',
  supplierName: record.preferredSupplierName || 'General Supplier',
  supplierSku: `SUP-${record.sku}`,
  supplierItemCode: record.supplierItemCode || `SUP-${record.sku}`,
  supplierBarcode: record.barcode,
  lastCost: record.defaultCostPrice,
  leadTimeDays: record.category === 'Lubricants' ? 3 : 7,
  minimumOrderQty: record.unitOfMeasure.toLowerCase().includes('meter') ? 10 : 1,
  isPreferred: true,
  status: record.status === 'Inactive' ? 'Inactive' : 'Active'
}));

export const mockProductPriceRecords: ProductPriceRecord[] = mockProductMasterRecords.map((record) => ({
  priceId: `PRICE-${record.productId}-STD`,
  productId: record.productId,
  priceListName: 'Standard Retail',
  sellingPrice: record.defaultSellingPrice,
  costPrice: record.defaultCostPrice,
  marginPercent: record.marginPercent,
  markupPercent: Math.round(((record.defaultSellingPrice - record.defaultCostPrice) / Math.max(1, record.defaultCostPrice)) * 100),
  taxMode: record.taxMode || 'VAT Registered',
  vatRate: record.vatRate || 15,
  lastCostPrice: record.defaultCostPrice,
  currentSellingPrice: record.defaultSellingPrice,
  currency: 'USD',
  effectiveFrom: '2026-06-01',
  status: 'Active'
}));

export const mockProductReorderRules: ProductReorderRule[] = mockProductStockBalances
  .filter((balance) => balance.locationType === 'Main Warehouse' || balance.locationType === 'Branch Warehouse')
  .map((balance) => ({
    ruleId: `ROR-${balance.balanceId}`,
    productId: balance.productId,
    branchId: balance.branchId,
    warehouseId: balance.warehouseId,
    locationType: balance.locationType,
    minQty: balance.reorderLevel,
    maxQty: Math.max(balance.reorderLevel + balance.reorderQty, balance.qtyOnHand + balance.reorderQty),
    reorderQty: balance.reorderQty,
    preferredSupplierId: mockProductMasterRecords.find((record) => record.productId === balance.productId)?.preferredSupplierId,
    preferredSupplierName: mockProductMasterRecords.find((record) => record.productId === balance.productId)?.preferredSupplierName,
    leadTimeDays: 7,
    isActive: true,
    status: 'Active',
    notes: 'Local reorder placeholder for Product Master.'
  }));

export const mockIndustrialSectorMappingTemplates: IndustrialSectorMappingTemplate[] = [
  { templateId: 'PIM-TPL-MOTOR', industrialSectorCode: 'MOTOR_SPARES', sectorName: 'Motor Spares', requiredFields: ['productName', 'sku or barcode or alu', 'sellingPrice'], recommendedFields: ['brand', 'make', 'model', 'yearFrom', 'yearTo', 'side', 'partNumber', 'oemNumber', 'category', 'shelfLocation', 'qty', 'costPrice', 'supplierName'], optionalFields: ['manufacturer', 'engineCode', 'chassisCode', 'vendorSku', 'productNumericNumber', 'tags'], sectorSpecificFields: ['make', 'model', 'yearFrom', 'yearTo', 'side', 'partNumber', 'oemNumber', 'engineCode', 'chassisCode', 'alu'], defaultCategoryOptions: ['Body Parts', 'Suspension', 'Braking', 'Cooling', 'Electrical', 'Service Parts'], defaultSubcategoryOptions: ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Isuzu', 'Universal'] },
  { templateId: 'PIM-TPL-HARDWARE', industrialSectorCode: 'HARDWARE', sectorName: 'Hardware', requiredFields: ['productName', 'sku or barcode', 'sellingPrice'], recommendedFields: ['brand', 'category', 'subcategory', 'size', 'material', 'unitOfMeasure', 'shelfLocation', 'qty', 'costPrice', 'supplierName'], optionalFields: ['manufacturer', 'grade', 'condition', 'reorderLevel', 'reorderQty', 'tags'], sectorSpecificFields: ['size', 'material', 'grade', 'productType', 'unitOfMeasure'], defaultCategoryOptions: ['Fasteners', 'Tools', 'Paint', 'Plumbing', 'Electrical', 'Safety'], defaultSubcategoryOptions: ['Bolts', 'Nuts', 'Hand Tools', 'Power Tools', 'Pipe Fittings', 'Cable'] },
  { templateId: 'PIM-TPL-GENERAL', industrialSectorCode: 'GENERAL_RETAIL', sectorName: 'General Retail', requiredFields: ['productName', 'sku or barcode', 'sellingPrice'], recommendedFields: ['brand', 'category', 'qty', 'costPrice', 'supplierName'], optionalFields: ['manufacturer', 'unitOfMeasure', 'shelfLocation', 'taxMode', 'vatRate', 'tags'], sectorSpecificFields: ['brand', 'category', 'unitOfMeasure', 'supplierName', 'shelfLocation'], defaultCategoryOptions: ['Retail Goods', 'Accessories', 'Consumables', 'General Merchandise'], defaultSubcategoryOptions: ['Standard', 'Premium', 'Seasonal', 'Counter Line'] },
  { templateId: 'PIM-TPL-SOLAR', industrialSectorCode: 'SOLAR_PRODUCTS', sectorName: 'Solar Products', requiredFields: ['productName', 'sku or barcode', 'sellingPrice'], recommendedFields: ['productName', 'sku or barcode', 'brand', 'wattage', 'voltage', 'batteryCapacity', 'panelType', 'inverterType', 'sellingPrice', 'qty', 'supplierName'], optionalFields: ['manufacturer', 'category', 'shelfLocation', 'costPrice', 'unitOfMeasure', 'tags'], sectorSpecificFields: ['wattage', 'voltage', 'batteryCapacity', 'panelType', 'inverterType'], defaultCategoryOptions: ['Solar Panels', 'Solar Batteries', 'Inverters', 'Charge Controllers', 'Solar Accessories'], defaultSubcategoryOptions: ['Mono Panel', 'Lithium Battery', 'Hybrid Inverter', 'MPPT Controller', 'Mounting Kit'] }
];

export const mockProductImportBatches: ProductImportBatch[] = [
  { batchId: 'PIM-BATCH-0001', batchNumber: 'PIM-2026-0001', vendorId: 'SCI-LOG-ZW', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', industrialSectorCode: 'MOTOR_SPARES', source: 'CSV Upload', status: 'Ready For Approval', fileName: 'motor-spares-june.csv', uploadedByStaffId: 'ST-BLESSING', uploadedByStaffName: 'Blessing Stock', totalRows: 4, validRows: 2, warningRows: 1, errorRows: 0, duplicateRows: 1, importedRows: 0, skippedRows: 0, createdAt: '2026-06-12T09:15:00Z', updatedAt: '2026-06-12T09:35:00Z', notes: 'Motor spares CSV mapped and validated. Duplicate row held for review.' },
  { batchId: 'PIM-BATCH-0002', batchNumber: 'PIM-2026-0002', vendorId: 'SCI-LOG-ZW', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', industrialSectorCode: 'HARDWARE', source: 'Paste Table', status: 'Validation Failed', fileName: 'pasted-hardware-lines', uploadedByStaffId: 'ST-ADMIN', uploadedByStaffName: 'Admin User', totalRows: 3, validRows: 1, warningRows: 1, errorRows: 1, duplicateRows: 0, importedRows: 0, skippedRows: 0, createdAt: '2026-06-12T10:00:00Z', updatedAt: '2026-06-12T10:08:00Z', notes: 'One hardware row is missing product name and cannot import.' },
  { batchId: 'PIM-BATCH-0003', batchNumber: 'PIM-2026-0003', vendorId: 'SCI-LOG-ZW', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', industrialSectorCode: 'SOLAR_PRODUCTS', source: 'Supplier File', status: 'Mapping', fileName: 'solar-catalogue-placeholder.csv', uploadedByStaffId: 'ST-ADMIN', uploadedByStaffName: 'Admin User', totalRows: 3, validRows: 0, warningRows: 0, errorRows: 0, duplicateRows: 0, importedRows: 0, skippedRows: 0, createdAt: '2026-06-12T10:30:00Z', updatedAt: '2026-06-12T10:30:00Z', notes: 'Solar panels, batteries, and inverters waiting for column mapping.' }
];

export const mockProductImportValidationIssues: ProductImportValidationIssue[] = [
  { issueId: 'PIM-ISS-0001', batchId: 'PIM-BATCH-0001', rowId: 'PIM-ROW-0002', rowNumber: 2, field: 'make/model/year/side', issueType: 'Sector Warning', message: 'Motor spares row is missing vehicle fitment fields.', severity: 'Warning', suggestedFix: 'Add make, model, year range, and side where applicable.' },
  { issueId: 'PIM-ISS-0002', batchId: 'PIM-BATCH-0001', rowId: 'PIM-ROW-0003', rowNumber: 3, field: 'sku', issueType: 'Duplicate', message: 'Duplicate SKU matched existing product BP-GD6-F.', severity: 'Warning', suggestedFix: 'Select duplicate action before import.' },
  { issueId: 'PIM-ISS-0003', batchId: 'PIM-BATCH-0002', rowId: 'PIM-ROW-0006', rowNumber: 2, field: 'productName', issueType: 'Required Field', message: 'Product name is required.', severity: 'Error', suggestedFix: 'Enter a product name or skip the row.' },
  { issueId: 'PIM-ISS-0004', batchId: 'PIM-BATCH-0002', rowId: 'PIM-ROW-0007', rowNumber: 3, field: 'unitOfMeasure', issueType: 'Sector Warning', message: 'Hardware row should include unit of measure.', severity: 'Warning', suggestedFix: 'Apply default unit of measure or map a unit column.' }
];

export const mockProductImportRows: ProductImportRow[] = [
  { rowId: 'PIM-ROW-0001', batchId: 'PIM-BATCH-0001', rowNumber: 1, rawData: { productName: 'Toyota Hilux GD6 Mirror Right Chrome', sku: 'MIR-GD6-RC', alu: 'MIR-GD6-RC', brand: 'Toyota', make: 'Toyota', model: 'Hilux GD6', side: 'Right', sellingPrice: '68', costPrice: '34', qty: '2', shelfLocation: 'A1-S4' }, mappedProduct: { productName: 'Toyota Hilux GD6 Mirror Right Chrome', sku: 'MIR-GD6-RC', alu: 'MIR-GD6-RC', brand: 'Toyota', make: 'Toyota', model: 'Hilux GD6', side: 'Right', sellingPrice: 68, costPrice: 34, qty: 2, shelfLocation: 'A1-S4', category: 'Body Parts' }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Valid' },
  { rowId: 'PIM-ROW-0002', batchId: 'PIM-BATCH-0001', rowNumber: 2, rawData: { productName: 'Universal Radiator Cap 1.1 Bar', sku: 'RAD-CAP-11', sellingPrice: '8', costPrice: '3.5', qty: '10' }, mappedProduct: { productName: 'Universal Radiator Cap 1.1 Bar', sku: 'RAD-CAP-11', sellingPrice: 8, costPrice: 3.5, qty: 10, category: 'Cooling' }, validationIssues: [mockProductImportValidationIssues[0]], duplicateAction: 'Create New Product', status: 'Warning', notes: 'Fitment fields are recommended for motor spares.' },
  { rowId: 'PIM-ROW-0003', batchId: 'PIM-BATCH-0001', rowNumber: 3, rawData: { productName: 'Brake Pads Toyota GD6 Front', sku: 'BP-GD6-F', brand: 'Toyota', sellingPrice: '28', costPrice: '16', qty: '4' }, mappedProduct: { productName: 'Brake Pads Toyota GD6 Front', sku: 'BP-GD6-F', brand: 'Toyota', sellingPrice: 28, costPrice: 16, qty: 4 }, validationIssues: [mockProductImportValidationIssues[1]], duplicateProductId: 'STOCK-P-03', duplicateAction: 'Hold For Review', status: 'Duplicate' },
  { rowId: 'PIM-ROW-0004', batchId: 'PIM-BATCH-0001', rowNumber: 4, rawData: { productName: 'Honda Fit GD1 Lower Arm Bush', sku: 'BUSH-GD1-LA', brand: 'Honda', make: 'Honda', model: 'Fit GD1', sellingPrice: '14', costPrice: '6', qty: '6', shelfLocation: 'B2-S1' }, mappedProduct: { productName: 'Honda Fit GD1 Lower Arm Bush', sku: 'BUSH-GD1-LA', brand: 'Honda', make: 'Honda', model: 'Fit GD1', sellingPrice: 14, costPrice: 6, qty: 6, shelfLocation: 'B2-S1', category: 'Suspension' }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Valid' },
  { rowId: 'PIM-ROW-0005', batchId: 'PIM-BATCH-0002', rowNumber: 1, rawData: { productName: 'M10 Galvanised Hex Bolt', sku: 'HEX-M10-GALV', category: 'Fasteners', unitOfMeasure: 'pcs', sellingPrice: '0.18', costPrice: '0.08', qty: '300' }, mappedProduct: { productName: 'M10 Galvanised Hex Bolt', sku: 'HEX-M10-GALV', category: 'Fasteners', unitOfMeasure: 'pcs', sellingPrice: 0.18, costPrice: 0.08, qty: 300 }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Valid' },
  { rowId: 'PIM-ROW-0006', batchId: 'PIM-BATCH-0002', rowNumber: 2, rawData: { sku: 'NO-NAME-001', sellingPrice: '4.5' }, mappedProduct: { sku: 'NO-NAME-001', sellingPrice: 4.5 }, validationIssues: [mockProductImportValidationIssues[2]], duplicateAction: 'Hold For Review', status: 'Error' },
  { rowId: 'PIM-ROW-0007', batchId: 'PIM-BATCH-0002', rowNumber: 3, rawData: { productName: 'Nylon Wall Plug 6mm', barcode: '600000991188', category: 'Fasteners', sellingPrice: '1.2', costPrice: '0.4', qty: '50' }, mappedProduct: { productName: 'Nylon Wall Plug 6mm', barcode: '600000991188', category: 'Fasteners', sellingPrice: 1.2, costPrice: 0.4, qty: 50 }, validationIssues: [mockProductImportValidationIssues[3]], duplicateAction: 'Create New Product', status: 'Warning' },
  { rowId: 'PIM-ROW-0008', batchId: 'PIM-BATCH-0003', rowNumber: 1, rawData: { productName: 'Mono Solar Panel 550W', sku: 'SOL-PANEL-550', brand: 'SunMax', wattage: '550W', voltage: '41V', panelType: 'Mono', sellingPrice: '115', costPrice: '82', qty: '8', supplierName: 'Harare Solar Wholesale' }, mappedProduct: { productName: 'Mono Solar Panel 550W', sku: 'SOL-PANEL-550', brand: 'SunMax', wattage: '550W', voltage: '41V', panelType: 'Mono', sellingPrice: 115, costPrice: 82, qty: 8, supplierName: 'Harare Solar Wholesale', productCategory: 'Solar Panels' }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Pending' },
  { rowId: 'PIM-ROW-0009', batchId: 'PIM-BATCH-0003', rowNumber: 2, rawData: { productName: 'Lithium Battery 5kWh Wall Mount', sku: 'SOL-BAT-5KWH', brand: 'PowerCell', batteryCapacity: '5kWh', voltage: '51.2V', sellingPrice: '940', costPrice: '720', qty: '3', supplierName: 'Harare Solar Wholesale' }, mappedProduct: { productName: 'Lithium Battery 5kWh Wall Mount', sku: 'SOL-BAT-5KWH', brand: 'PowerCell', batteryCapacity: '5kWh', voltage: '51.2V', sellingPrice: 940, costPrice: 720, qty: 3, supplierName: 'Harare Solar Wholesale', productCategory: 'Solar Batteries' }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Pending' },
  { rowId: 'PIM-ROW-0010', batchId: 'PIM-BATCH-0003', rowNumber: 3, rawData: { productName: 'Hybrid Inverter 5kW 48V', sku: 'SOL-INV-5KW', brand: 'VoltEdge', inverterType: 'Hybrid', voltage: '48V', sellingPrice: '560', costPrice: '410', qty: '4', supplierName: 'Harare Solar Wholesale' }, mappedProduct: { productName: 'Hybrid Inverter 5kW 48V', sku: 'SOL-INV-5KW', brand: 'VoltEdge', inverterType: 'Hybrid', voltage: '48V', sellingPrice: 560, costPrice: 410, qty: 4, supplierName: 'Harare Solar Wholesale', productCategory: 'Inverters' }, validationIssues: [], duplicateAction: 'Create New Product', status: 'Pending' }
];

export const mockProductImportColumnMappings: ProductImportColumnMapping[] = [
  { mappingId: 'PIM-MAP-0001', batchId: 'PIM-BATCH-0001', sourceColumn: 'productName', targetField: 'productName', required: true, sectorSpecific: false, sampleValue: 'Toyota Hilux GD6 Mirror Right Chrome', status: 'Mapped' },
  { mappingId: 'PIM-MAP-0002', batchId: 'PIM-BATCH-0001', sourceColumn: 'sku', targetField: 'sku', required: true, sectorSpecific: false, sampleValue: 'MIR-GD6-RC', status: 'Mapped' },
  { mappingId: 'PIM-MAP-0003', batchId: 'PIM-BATCH-0001', sourceColumn: 'alu', targetField: 'alu', required: false, sectorSpecific: true, sampleValue: 'MIR-GD6-RC', status: 'Mapped' },
  { mappingId: 'PIM-MAP-0004', batchId: 'PIM-BATCH-0001', sourceColumn: 'make', targetField: 'make', required: false, sectorSpecific: true, sampleValue: 'Toyota', status: 'Mapped' },
  { mappingId: 'PIM-MAP-0005', batchId: 'PIM-BATCH-0001', sourceColumn: 'sellingPrice', targetField: 'sellingPrice', required: true, sectorSpecific: false, sampleValue: '68', status: 'Mapped' }
];

export const mockProductImportActivityEvents: ProductImportActivityEvent[] = [
  { eventId: 'PIM-ACT-0001', batchId: 'PIM-BATCH-0001', eventType: 'PRODUCT_IMPORT_BATCH_CREATED', message: 'Product import batch PIM-2026-0001 created.', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', createdAt: '2026-06-12T09:15:00Z' },
  { eventId: 'PIM-ACT-0002', batchId: 'PIM-BATCH-0001', eventType: 'PRODUCT_IMPORT_FILE_PARSED_PLACEHOLDER', message: 'CSV placeholder parsed into import rows.', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', createdAt: '2026-06-12T09:20:00Z' },
  { eventId: 'PIM-ACT-0003', batchId: 'PIM-BATCH-0001', eventType: 'PRODUCT_IMPORT_COLUMNS_MAPPED', message: 'Import columns mapped to Product Master fields.', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', createdAt: '2026-06-12T09:25:00Z' },
  { eventId: 'PIM-ACT-0004', batchId: 'PIM-BATCH-0001', eventType: 'PRODUCT_IMPORT_VALIDATED', message: 'Import batch validated with duplicate rows held for review.', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', createdAt: '2026-06-12T09:35:00Z' }
];

export const mockOpeningBalanceDraftsFromImport: OpeningBalanceDraftFromImport[] = [
  { draftId: 'OB-IMP-0001', batchId: 'PIM-BATCH-0001', rowId: 'PIM-ROW-0001', rowNumber: 1, sku: 'MIR-GD6-RC', productName: 'Toyota Hilux GD6 Mirror Right Chrome', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', shelfLocation: 'A1-S4', importedQty: 2, unitCost: 34, valueEstimate: 68, status: 'Draft - Not Posted', createdAt: '2026-06-12T09:40:00Z', notes: 'Opening balance draft only. Stock not posted.' },
  { draftId: 'OB-IMP-0002', batchId: 'PIM-BATCH-0002', rowId: 'PIM-ROW-0005', rowNumber: 1, sku: 'HEX-M10-GALV', productName: 'M10 Galvanised Hex Bolt', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', importedQty: 300, unitCost: 0.08, valueEstimate: 24, status: 'Draft - Not Posted', createdAt: '2026-06-12T10:12:00Z', notes: 'Hardware opening balance draft awaiting controlled posting.' },
  { draftId: 'OB-IMP-0003', batchId: 'PIM-BATCH-0003', rowId: 'PIM-ROW-0008', rowNumber: 1, sku: 'SOL-PANEL-550', productName: 'Mono Solar Panel 550W', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', importedQty: 8, unitCost: 82, valueEstimate: 656, status: 'Draft - Not Posted', createdAt: '2026-06-12T10:35:00Z', notes: 'Solar panel opening balance draft. Stock not posted.' }
];

const healthStatusFromBalance = (balance: ProductStockBalance): StockHealthRow['stockHealthStatus'] => {
  if (balance.qtyAvailable <= 0) return 'Out Of Stock';
  if (balance.qtyAvailable <= balance.reorderLevel) return 'Reorder Required';
  if (balance.qtyDamaged > 0) return 'Damaged';
  if ((balance.qtyReturnHolding || 0) > 0) return 'Return Holding';
  if (balance.qtyAvailable > balance.reorderQty * 2) return 'Overstocked';
  return 'Healthy';
};

const healthSeverityFromStatus = (status: StockHealthRow['stockHealthStatus']): StockHealthRow['severity'] => {
  if (status === 'Out Of Stock' || status === 'Variance Risk') return 'Critical';
  if (status === 'Damaged' || status === 'Return Holding' || status === 'Reorder Required') return 'High';
  if (status === 'Dead Stock' || status === 'Slow Moving' || status === 'Overstocked') return 'Medium';
  return 'Info';
};

export const mockStockHealthRows: StockHealthRow[] = mockProductStockBalances
  .filter((balance) => ['BJ-CBHO49', 'BP-GD6-F', 'OIL-5W30', 'RAD-COROLLA', 'CLT-N16', 'RAD-FJ200-L', 'ACR-ISUZU-1316', 'MIR-GD6-RC'].includes(balance.sku))
  .map((balance, index) => {
    const product = mockProductMasterRecords.find((record) => record.productId === balance.productId);
    const stockHealthStatus = index === 6 ? 'Slow Moving' : index === 8 ? 'Dead Stock' : index === 10 ? 'Fast Moving' : healthStatusFromBalance(balance);
    const movementCount = stockHealthStatus === 'Fast Moving' ? 26 : stockHealthStatus === 'Slow Moving' ? 1 : stockHealthStatus === 'Dead Stock' ? 0 : 6 + index;
    const unitCost = product?.defaultCostPrice || 0;
    return {
      productId: balance.productId,
      numericNo: product?.productNumericNumber || '',
      sku: balance.sku,
      alu: product?.alu || '',
      productName: balance.productName,
      branchId: balance.branchId,
      branchName: balance.branchName,
      warehouseId: balance.warehouseId,
      warehouseName: balance.warehouseName,
      locationType: balance.locationType,
      sector: product?.industrialSector || 'Motor Spares',
      category: product?.productCategory || product?.category || 'Motor Spares',
      brand: product?.brand || 'Genuine Select',
      supplier: product?.supplierName || product?.preferredSupplierName || 'Motor Spares Wholesalers',
      branch: balance.branchName,
      warehouse: balance.warehouseName,
      shelfLocation: balance.shelfLocation || balance.locationName,
      qtyOnHand: balance.qtyOnHand,
      qtyAvailable: balance.qtyAvailable,
      qtyReserved: balance.qtyReserved,
      qtyDamaged: balance.qtyDamaged,
      qtyReturnHolding: balance.qtyReturnHolding || 0,
      qtyInTransit: balance.qtyInTransit,
      reorderLevel: balance.reorderLevel,
      reorderQty: balance.reorderQty,
      lastSaleDate: index % 3 === 0 ? '2026-06-08T10:00:00Z' : '2026-03-01T09:00:00Z',
      lastMovementDate: balance.lastMovementAt || balance.lastMovementDate || '2026-06-01T08:00:00Z',
      lastReceivedDate: '2026-06-04T09:00:00Z',
      daysSinceLastSale: index % 3 === 0 ? 4 : 103,
      movementCount,
      salesVelocity: Number((movementCount / 30).toFixed(2)),
      stockHealthStatus,
      severity: healthSeverityFromStatus(stockHealthStatus),
      estimatedStockValue: balance.qtyOnHand * unitCost,
      notes: stockHealthStatus === 'Variance Risk' ? 'Stocktake variance review required.' : `${stockHealthStatus} generated from local stock balance.`,
      stockStatus: stockHealthStatus || 'Healthy',
      movementClass: stockHealthStatus === 'Fast Moving' ? 'Fast Moving' : stockHealthStatus === 'Slow Moving' ? 'Slow Moving' : stockHealthStatus === 'Dead Stock' ? 'Dead Stock' : 'Normal Moving',
      riskLevel: healthSeverityFromStatus(stockHealthStatus) === 'Critical' ? 'Critical' : healthSeverityFromStatus(stockHealthStatus) === 'High' ? 'High' : healthSeverityFromStatus(stockHealthStatus) === 'Medium' ? 'Medium' : 'Low',
      recommendedAction: balance.qtyAvailable <= balance.reorderLevel ? 'Reorder' : stockHealthStatus === 'Dead Stock' ? 'Discount / Clearance' : stockHealthStatus === 'Variance Risk' ? 'Stocktake Required' : 'No Action'
    };
  });

export const mockStockHealthRecommendations: StockHealthRecommendation[] = mockStockHealthRows
  .filter((row) => row.stockHealthStatus !== 'Healthy')
  .slice(0, 8)
  .map((row, index) => ({
    recommendationId: `IHR-${index + 1}`,
    recommendationType: row.stockHealthStatus === 'Variance Risk' ? 'Stocktake Recommendation' : row.stockHealthStatus === 'Overstocked' ? 'Overstock Review Recommendation' : row.stockHealthStatus === 'Damaged' ? 'Damage Review Recommendation' : 'Create PO Recommendation',
    severity: row.severity || 'Medium',
    productId: row.productId,
    sku: row.sku,
    productName: row.productName,
    branchId: row.branchId,
    warehouseId: row.warehouseId,
    title: `${row.stockHealthStatus} - ${row.productName}`,
    description: row.notes || `${row.productName} requires review.`,
    recommendedAction: row.recommendedAction,
    relatedReportType: row.stockHealthStatus === 'Variance Risk' ? 'Variance Risk' : row.stockHealthStatus === 'Damaged' ? 'Damaged Holding' : 'Reorder Recommendation',
    status: 'Open',
    createdAt: '2026-06-12T08:00:00Z'
  }));

export const mockInventoryValueReportRows: InventoryValueReportRow[] = mockStockHealthRows.map((row) => {
  const product = mockProductMasterRecords.find((record) => record.productId === row.productId);
  const unitCost = product?.defaultCostPrice || 0;
  return {
    sku: row.sku,
    productName: row.productName,
    branch: row.branchName || row.branch,
    warehouse: row.warehouseName || row.warehouse,
    location: String(row.locationType || row.shelfLocation),
    qtyOnHand: row.qtyOnHand,
    availableQty: row.qtyAvailable || 0,
    unitCost,
    estimatedStockValue: row.qtyOnHand * unitCost,
    damagedValue: (row.qtyDamaged || 0) * unitCost,
    returnHoldingValue: (row.qtyReturnHolding || 0) * unitCost,
    inTransitValue: (row.qtyInTransit || 0) * unitCost,
    lastCost: unitCost,
    status: row.stockHealthStatus || 'Healthy'
  };
});

export const mockSupplierPerformanceRows: SupplierPerformanceRow[] = [
  { supplier: 'Motor Spares Wholesalers', productsSupplied: 4, purchaseOrders: 5, grns: 4, supplierReturns: 1, averageDeliveryDays: 4, lateDeliveries: 1, damagedWrongItems: 1, creditNotesPending: 0, performanceScore: 82, risk: 'Low' },
  { supplier: 'Radiator Imports', productsSupplied: 2, purchaseOrders: 3, grns: 2, supplierReturns: 1, averageDeliveryDays: 8, lateDeliveries: 2, damagedWrongItems: 1, creditNotesPending: 1, performanceScore: 61, risk: 'Medium' },
  { supplier: 'Body Parts Warehouse', productsSupplied: 1, purchaseOrders: 2, grns: 1, supplierReturns: 0, averageDeliveryDays: 9, lateDeliveries: 1, damagedWrongItems: 0, creditNotesPending: 0, performanceScore: 70, risk: 'Medium' }
];

export const mockTransferDelayRows: TransferDelayRow[] = [
  { transferNo: 'TRF-2026-001', source: 'Harare Main Warehouse', destination: 'Bulawayo Branch Warehouse', dispatchedDate: '2026-06-05', expectedArrival: '2026-06-07', daysInTransit: 5, status: 'In Transit', variance: 'Pending receipt' },
  { transferNo: 'TRF-2026-002', source: 'Bulawayo Branch Warehouse', destination: 'Harare Sales Floor', dispatchedDate: '2026-06-02', expectedArrival: '2026-06-04', receivedDate: '2026-06-08', daysInTransit: 6, status: 'Partially Received', variance: 'Short 2 units' }
];

export const mockGRNDelayRows: GRNDelayRow[] = [
  { grnNo: 'GRN-0001', poNo: 'PO-0003', supplier: 'Radiator Imports', expectedDelivery: '2026-06-10', receivedDate: '2026-06-10', daysLate: 0, status: 'Posted', variance: 'Partial receipt', invoiceStatus: 'Invoice Captured' },
  { grnNo: 'GRN-DRAFT-002', poNo: 'PO-0002', supplier: 'Lubricants Direct', expectedDelivery: '2026-06-12', daysLate: 2, status: 'Draft', variance: 'Invoice missing', invoiceStatus: 'Missing' }
];

export const mockStockMovementAuditRows: StockMovementAuditRow[] = [
  { movementId: 'AUD-MOV-001', dateTime: '2026-06-11T08:30:00Z', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', movementType: 'GOODS_RECEIVED', reference: 'GRN-0001', branch: 'BR-HARARE', warehouse: 'WH-HARARE-01', qtyIn: 12, qtyOut: 0, balanceBefore: 10, balanceAfter: 22, staff: 'Blessing Stock', risk: 'None', notes: 'Posted GRN receipt.' },
  { movementId: 'AUD-MOV-002', dateTime: '2026-06-11T10:10:00Z', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', movementType: 'STOCKTAKE_LOSS', reference: 'STK-2026-001', branch: 'BR-HARARE', warehouse: 'WH-HARARE-01', qtyIn: 0, qtyOut: 3, balanceBefore: 11, balanceAfter: 8, staff: 'Admin User', risk: 'High', notes: 'Variance loss requires review.' },
  { movementId: 'AUD-MOV-003', dateTime: '2026-06-10T13:25:00Z', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', movementType: 'SUPPLIER_RETURN', reference: 'SR-0001', branch: 'BR-HARARE', warehouse: 'WH-RET-01', qtyIn: 0, qtyOut: 1, balanceBefore: 2, balanceAfter: 1, staff: 'Blessing Stock', risk: 'Medium', notes: 'Supplier return placeholder dispatched.' },
  { movementId: 'AUD-MOV-004', dateTime: '2026-06-09T15:05:00Z', sku: 'MIR-GD6-RC', productName: 'Toyota Hilux GD6 Mirror Right Chrome', movementType: 'BRANCH_TRANSFER_OUT', reference: 'TRF-2026-001', branch: 'BR-HARARE', warehouse: 'WH-HARARE-01', qtyIn: 0, qtyOut: 2, balanceBefore: 5, balanceAfter: 3, staff: 'Tawanda Supervisor', risk: 'Low', notes: 'Transfer to Bulawayo in transit.' }
];

export const mockInventoryReportActivityEvents: InventoryReportActivityEvent[] = [
  { id: 'IRE-ACT-001', eventType: 'LOW_STOCK_REMINDER', reportType: 'Low Stock', message: 'Low stock report reviewed locally.', staffId: 'ST-BLESSING', createdAt: '2026-06-12T08:15:00Z' },
  { id: 'IRE-ACT-002', eventType: 'VARIANCE_RISK_DETECTED', reportType: 'Variance Risk', message: 'Variance risk recommendation generated.', staffId: 'ST-ADMIN', createdAt: '2026-06-12T08:30:00Z' }
];

export const mockShelfLocations = ['A1-MOTOR-LAMPS', 'A2-BRAKE-SERVICE', 'B1-LUBRICANTS', 'C1-FASTENERS', 'D1-HARDWARE', 'PH-COUNTER-01'];

export const mockPurchaseOrders: PurchaseOrder[] = [
  {
    poId: 'PO-ID-0001',
    poNumber: 'PO-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-MOTOR-SPARES',
    supplierName: 'Motor Spares Wholesalers',
    supplierPhone: '+263 24 700 1100',
    supplierEmail: 'orders@motorspares.example',
    supplierAddress: 'Workington Industrial Park, Harare',
    supplierContactPerson: 'Rufaro M.',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    poDate: '2026-06-08',
    expectedDeliveryDate: '2026-06-14',
    priority: 'Normal',
    source: 'Manual',
    status: 'Approved',
    deliveryBranchId: 'Harare Main',
    deliveryWarehouseId: 'Main Warehouse',
    deliveryAddress: 'Harare Main receiving bay, Coventry Road',
    currency: 'USD',
    subtotalEstimate: 432,
    taxEstimate: 64.8,
    deliveryCostEstimate: 20,
    grandTotalEstimate: 516.8,
    notes: 'Memo only. Confirm availability before dispatch.',
    internalMemo: 'Prepared from weekly reorder review.',
    termsAndConditions: 'Supplier invoice and GRN required before stock is updated.',
    createdAt: '2026-06-08T08:15:00Z',
    updatedAt: '2026-06-08T09:10:00Z'
  },
  {
    poId: 'PO-ID-0002',
    poNumber: 'PO-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-LUBRICANTS',
    supplierName: 'Lubricants Direct',
    supplierPhone: '+263 77 880 2211',
    supplierEmail: 'sales@lubricantsdirect.example',
    supplierAddress: 'Graniteside, Harare',
    supplierContactPerson: 'Chipo N.',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    poDate: '2026-06-09',
    expectedDeliveryDate: '2026-06-12',
    priority: 'High',
    source: 'Low Stock Recommendation',
    status: 'Sent To Supplier',
    deliveryBranchId: 'Harare Main',
    deliveryWarehouseId: 'Main Warehouse',
    deliveryAddress: 'Harare Main receiving bay, Coventry Road',
    currency: 'USD',
    subtotalEstimate: 580,
    taxEstimate: 87,
    deliveryCostEstimate: 15,
    grandTotalEstimate: 682,
    notes: 'Supplier to confirm batch dates.',
    internalMemo: 'High mover lubricant replenishment.',
    termsAndConditions: 'PO values are estimates and do not create liability.',
    createdAt: '2026-06-09T10:20:00Z',
    updatedAt: '2026-06-09T11:05:00Z'
  },
  {
    poId: 'PO-ID-0003',
    poNumber: 'PO-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-RADIATOR',
    supplierName: 'Radiator Imports',
    supplierPhone: '+263 71 450 3300',
    supplierEmail: 'imports@radiatorimports.example',
    supplierAddress: 'Southerton, Harare',
    supplierContactPerson: 'Kelvin T.',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    poDate: '2026-06-04',
    expectedDeliveryDate: '2026-06-10',
    priority: 'Normal',
    source: 'Supplier Reorder',
    status: 'Partially Received',
    deliveryBranchId: 'Harare Main',
    deliveryWarehouseId: 'Main Warehouse',
    deliveryAddress: 'Harare Main receiving bay, Coventry Road',
    currency: 'USD',
    subtotalEstimate: 375,
    taxEstimate: 56.25,
    deliveryCostEstimate: 25,
    grandTotalEstimate: 456.25,
    notes: 'Two units received through GRN placeholder; outstanding balance remains memo only.',
    internalMemo: 'Keep outstanding quantities visible for receiving build.',
    termsAndConditions: 'Only posted GRN quantities update stock.',
    createdAt: '2026-06-04T07:40:00Z',
    updatedAt: '2026-06-10T14:35:00Z'
  },
  {
    poId: 'PO-ID-0004',
    poNumber: 'PO-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-GENERAL-HARDWARE',
    supplierName: 'General Hardware Supply',
    supplierPhone: '+263 24 611 9800',
    supplierEmail: 'orders@generalhardware.example',
    supplierAddress: 'Msasa, Harare',
    supplierContactPerson: 'Tariro S.',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    poDate: '2026-06-11',
    expectedDeliveryDate: '2026-06-20',
    priority: 'Low',
    source: 'Manual',
    status: 'Draft',
    deliveryBranchId: 'Harare Main',
    deliveryWarehouseId: 'Main Warehouse',
    deliveryAddress: 'Harare Main receiving bay, Coventry Road',
    currency: 'USD',
    subtotalEstimate: 125,
    taxEstimate: 18.75,
    deliveryCostEstimate: 10,
    grandTotalEstimate: 153.75,
    notes: 'Draft memo for review.',
    internalMemo: 'Not sent.',
    termsAndConditions: 'No stock or accounting impact until GRN posting.',
    createdAt: '2026-06-11T08:05:00Z',
    updatedAt: '2026-06-11T08:05:00Z'
  }
];

export const mockPurchaseOrderLines: PurchaseOrderLine[] = [
  { lineId: 'PO-LINE-0001', poId: 'PO-ID-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', manufacturer: 'Genuine Parts', supplierItemCode: 'MSW-BJ-GD1', unitOfMeasure: 'pcs', qtyOrdered: 24, qtyReceived: 0, qtyOutstanding: 24, estimatedUnitCost: 7, estimatedLineTotal: 168, lastCostPrice: 7, currentSellingPrice: 12, shelfLocation: 'A2-S5', lineStatus: 'Ordered', notes: 'Reorder for shelf A2.' },
  { lineId: 'PO-LINE-0002', poId: 'PO-ID-0001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', manufacturer: 'Bosch', supplierItemCode: 'MSW-BP-GD6F', unitOfMeasure: 'pcs', qtyOrdered: 12, qtyReceived: 0, qtyOutstanding: 12, estimatedUnitCost: 22, estimatedLineTotal: 264, lastCostPrice: 16, currentSellingPrice: 28, shelfLocation: 'A3-S6', lineStatus: 'Ordered', notes: 'Check price at GRN.' },
  { lineId: 'PO-LINE-0003', poId: 'PO-ID-0002', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', manufacturer: 'Denso', supplierItemCode: 'LUB-5W30-5L', unitOfMeasure: 'cans', qtyOrdered: 40, qtyReceived: 0, qtyOutstanding: 40, estimatedUnitCost: 14.5, estimatedLineTotal: 580, lastCostPrice: 14.5, currentSellingPrice: 22, shelfLocation: 'B1-S2', lineStatus: 'Ordered', notes: 'Confirm sealed cartons.' },
  { lineId: 'PO-LINE-0004', poId: 'PO-ID-0003', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', manufacturer: 'Denso', supplierItemCode: 'RADIMP-COR-01', unitOfMeasure: 'pcs', qtyOrdered: 5, qtyReceived: 2, qtyOutstanding: 3, estimatedUnitCost: 75, estimatedLineTotal: 375, lastCostPrice: 72, currentSellingPrice: 110, shelfLocation: 'C2-S1', lineStatus: 'Partially Received', notes: 'Three still outstanding.' },
  { lineId: 'PO-LINE-0005', poId: 'PO-ID-0004', productId: 'STOCK-P-05', sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', brand: 'Nissan', manufacturer: 'SKF', supplierItemCode: 'GHS-CLT-N16', unitOfMeasure: 'pcs', qtyOrdered: 5, qtyReceived: 0, qtyOutstanding: 5, estimatedUnitCost: 25, estimatedLineTotal: 125, lastCostPrice: 25, currentSellingPrice: 45, shelfLocation: 'A4-S4', lineStatus: 'Draft', notes: 'Draft line.' }
];

export const mockPurchaseOrderActivityEvents: PurchaseOrderActivityEvent[] = [
  { id: 'PO-ACT-0001', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'PURCHASE_ORDER_DRAFT_CREATED', message: 'PO-0001 memo draft created. No stock or accounting posted.', operator: 'Blessing Stock', createdAt: '2026-06-08T08:15:00Z' },
  { id: 'PO-ACT-0002', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'PURCHASE_ORDER_APPROVED', message: 'PO-0001 approved for supplier ordering only.', operator: 'Admin User', createdAt: '2026-06-08T09:10:00Z' },
  { id: 'PO-ACT-0003', poId: 'PO-ID-0002', poNumber: 'PO-0002', eventType: 'PURCHASE_ORDER_SENT_TO_SUPPLIER', message: 'PO-0002 marked sent to supplier. Memo remains non-financial.', operator: 'Admin User', createdAt: '2026-06-09T11:05:00Z' },
  { id: 'PO-ACT-0004', poId: 'PO-ID-0003', poNumber: 'PO-0003', eventType: 'PURCHASE_ORDER_RECEIVING_DRAFT_CREATED', message: 'Receiving draft prepared from PO-0003. Stock changes only after GRN posting.', operator: 'Blessing Stock', createdAt: '2026-06-10T14:35:00Z' },
  { id: 'PO-ACT-0005', poId: 'PO-ID-0004', poNumber: 'PO-0004', eventType: 'PURCHASE_ORDER_DRAFT_CREATED', message: 'PO-0004 memo draft created. No stock or accounting posted.', operator: 'Blessing Stock', createdAt: '2026-06-11T08:05:00Z' }
];

export const mockGoodsReceivingNotes: GoodsReceivingNote[] = [
  {
    grnId: 'GRN-ID-0001',
    grnNumber: 'GRN-0001',
    vendorId: 'SCI-LOG-ZW',
    poId: 'PO-ID-0003',
    poNumber: 'PO-0003',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-RADIATOR',
    supplierName: 'Radiator Imports',
    receivedByStaffId: 'ST-BLESSING',
    receivedByStaffName: 'Blessing Stock',
    receivedDate: '2026-06-10',
    supplierInvoiceNumber: 'RI-9044',
    supplierInvoiceDate: '2026-06-10',
    supplierInvoiceAmount: 150,
    deliveryNoteNumber: 'DN-RI-441',
    vehicleOrCourierReference: 'Courier Bike HRE-22',
    receivingStatus: 'Posted',
    approvalRequired: false,
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    postedAt: '2026-06-10T14:35:00Z',
    notes: 'Partial receipt against radiator PO. Stock was updated only after posting.',
    createdAt: '2026-06-10T14:15:00Z',
    updatedAt: '2026-06-10T14:35:00Z'
  },
  {
    grnId: 'GRN-ID-0002',
    grnNumber: 'GRN-0002',
    vendorId: 'SCI-LOG-ZW',
    poId: 'PO-ID-0001',
    poNumber: 'PO-0001',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-MOTOR-SPARES',
    supplierName: 'Motor Spares Wholesalers',
    receivedByStaffId: 'ST-BLESSING',
    receivedByStaffName: 'Blessing Stock',
    receivedDate: '2026-06-11',
    supplierInvoiceNumber: '',
    supplierInvoiceDate: '',
    supplierInvoiceAmount: 0,
    deliveryNoteNumber: 'DN-MSW-DRAFT',
    vehicleOrCourierReference: 'Supplier truck pending invoice',
    receivingStatus: 'Draft',
    approvalRequired: false,
    notes: 'Draft receiving batch. No stock movement posted.',
    createdAt: '2026-06-11T09:20:00Z',
    updatedAt: '2026-06-11T09:20:00Z'
  },
  {
    grnId: 'GRN-ID-0003',
    grnNumber: 'GRN-0003',
    vendorId: 'SCI-LOG-ZW',
    poId: 'PO-ID-0002',
    poNumber: 'PO-0002',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-LUBRICANTS',
    supplierName: 'Lubricants Direct',
    receivedByStaffId: 'ST-BLESSING',
    receivedByStaffName: 'Blessing Stock',
    receivedDate: '2026-06-11',
    supplierInvoiceNumber: 'LD-7781',
    supplierInvoiceDate: '2026-06-11',
    supplierInvoiceAmount: 580,
    deliveryNoteNumber: 'DN-LD-112',
    vehicleOrCourierReference: 'LD Truck 15',
    receivingStatus: 'Posted',
    approvalRequired: false,
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    postedAt: '2026-06-11T10:10:00Z',
    notes: 'Posted full receipt. No cashbook payment created.',
    createdAt: '2026-06-11T09:55:00Z',
    updatedAt: '2026-06-11T10:10:00Z'
  }
];

export const mockGoodsReceivingLines: GoodsReceivingLine[] = [
  { lineId: 'GRN-LINE-0001', grnId: 'GRN-ID-0001', poId: 'PO-ID-0003', poLineId: 'PO-LINE-0004', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', manufacturer: 'Denso', unitOfMeasure: 'pcs', qtyOrdered: 5, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 5, qtyReceivedNow: 2, qtyAccepted: 2, qtyRejected: 0, qtyOutstandingAfterGRN: 3, previousCostPrice: 72, receivedUnitCost: 75, sellingPrice: 110, shelfLocation: 'C2-S1', varianceType: 'Short', lineStatus: 'Partially Received', removeFromCurrentGRN: false, markUnavailableFromSupplier: false, notes: 'Partial supply, three outstanding.' },
  { lineId: 'GRN-LINE-0002', grnId: 'GRN-ID-0002', poId: 'PO-ID-0001', poLineId: 'PO-LINE-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', manufacturer: 'Genuine Parts', unitOfMeasure: 'pcs', qtyOrdered: 24, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 24, qtyReceivedNow: 24, qtyAccepted: 24, qtyRejected: 0, qtyOutstandingAfterGRN: 0, previousCostPrice: 7, receivedUnitCost: 7, sellingPrice: 12, shelfLocation: 'A2-S5', varianceType: 'None', lineStatus: 'Pending', removeFromCurrentGRN: false, markUnavailableFromSupplier: false, notes: 'Draft full receipt candidate.' },
  { lineId: 'GRN-LINE-0003', grnId: 'GRN-ID-0002', poId: 'PO-ID-0001', poLineId: 'PO-LINE-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', manufacturer: 'Bosch', unitOfMeasure: 'pcs', qtyOrdered: 12, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 12, qtyReceivedNow: 8, qtyAccepted: 8, qtyRejected: 0, qtyOutstandingAfterGRN: 4, previousCostPrice: 16, receivedUnitCost: 22, sellingPrice: 30, shelfLocation: 'A3-S6', varianceType: 'Cost Increase', lineStatus: 'Variance Review', removeFromCurrentGRN: false, markUnavailableFromSupplier: false, notes: 'Cost increase over 15 percent requires review.' },
  { lineId: 'GRN-LINE-0004', grnId: 'GRN-ID-0002', poId: 'PO-ID-0001', poLineId: 'PO-LINE-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', manufacturer: 'Bosch', unitOfMeasure: 'pcs', qtyOrdered: 12, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 12, qtyReceivedNow: 0, qtyAccepted: 0, qtyRejected: 0, qtyOutstandingAfterGRN: 12, previousCostPrice: 16, receivedUnitCost: 16, sellingPrice: 28, shelfLocation: 'A3-S6', varianceType: 'Short', lineStatus: 'Not Supplied', removeFromCurrentGRN: false, markUnavailableFromSupplier: true, notes: 'Supplier did not supply in this delivery.' },
  { lineId: 'GRN-LINE-0005', grnId: 'GRN-ID-0002', poId: 'PO-ID-0001', poLineId: 'PO-LINE-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', manufacturer: 'Genuine Parts', unitOfMeasure: 'pcs', qtyOrdered: 24, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 24, qtyReceivedNow: 0, qtyAccepted: 0, qtyRejected: 0, qtyOutstandingAfterGRN: 24, previousCostPrice: 7, receivedUnitCost: 7, sellingPrice: 12, shelfLocation: 'A2-S5', varianceType: 'None', lineStatus: 'Removed From GRN', removeFromCurrentGRN: true, markUnavailableFromSupplier: false, notes: 'Removed from current receiving batch; remains outstanding on PO.' },
  { lineId: 'GRN-LINE-0006', grnId: 'GRN-ID-0003', poId: 'PO-ID-0002', poLineId: 'PO-LINE-0003', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', manufacturer: 'Denso', unitOfMeasure: 'cans', qtyOrdered: 40, qtyPreviouslyReceived: 0, qtyOutstandingBeforeGRN: 40, qtyReceivedNow: 42, qtyAccepted: 40, qtyRejected: 2, qtyOutstandingAfterGRN: 0, previousCostPrice: 14.5, receivedUnitCost: 14.5, sellingPrice: 22, shelfLocation: 'B1-S1', varianceType: 'Damaged', lineStatus: 'Received', removeFromCurrentGRN: false, markUnavailableFromSupplier: false, damagedReason: 'Two cans leaking on arrival.', notes: 'Rejected damaged quantity does not enter available stock.' }
];

export const mockGoodsReceivingVariances: GoodsReceivingVariance[] = [
  { varianceId: 'GRN-VAR-0001', grnId: 'GRN-ID-0001', lineId: 'GRN-LINE-0001', varianceType: 'Short', severity: 'Medium', message: 'Short receipt: 2 received against 5 outstanding.', approvalRequired: false, resolved: true },
  { varianceId: 'GRN-VAR-0002', grnId: 'GRN-ID-0002', lineId: 'GRN-LINE-0003', varianceType: 'Cost Increase', severity: 'High', message: 'Cost increase above 15 percent requires approval before posting.', approvalRequired: true, resolved: false },
  { varianceId: 'GRN-VAR-0003', grnId: 'GRN-ID-0003', lineId: 'GRN-LINE-0006', varianceType: 'Damaged', severity: 'Medium', message: 'Damaged goods rejected from available stock.', approvalRequired: false, resolved: true },
  { varianceId: 'GRN-VAR-0004', grnId: 'GRN-ID-0002', varianceType: 'Missing Supplier Invoice', severity: 'High', message: 'Supplier invoice missing on draft GRN.', approvalRequired: true, resolved: false }
];

export const mockGoodsReceivingActivityEvents: GoodsReceivingActivityEvent[] = [
  { id: 'GRN-ACT-0001', grnId: 'GRN-ID-0001', grnNumber: 'GRN-0001', poId: 'PO-ID-0003', poNumber: 'PO-0003', eventType: 'GRN_DRAFT_CREATED_FROM_PO', message: 'GRN-0001 draft created from PO-0003.', operator: 'Blessing Stock', createdAt: '2026-06-10T14:15:00Z' },
  { id: 'GRN-ACT-0002', grnId: 'GRN-ID-0001', grnNumber: 'GRN-0001', poId: 'PO-ID-0003', poNumber: 'PO-0003', eventType: 'GRN_POSTED_TO_STOCK', message: 'GRN-0001 posted accepted quantities to stock.', operator: 'Blessing Stock', createdAt: '2026-06-10T14:35:00Z' },
  { id: 'GRN-ACT-0003', grnId: 'GRN-ID-0002', grnNumber: 'GRN-0002', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'GRN_SUPPLIER_INVOICE_MISSING', message: 'Supplier invoice missing on draft GRN.', operator: 'Blessing Stock', createdAt: '2026-06-11T09:20:00Z' },
  { id: 'GRN-ACT-0004', grnId: 'GRN-ID-0002', grnNumber: 'GRN-0002', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'GRN_LINE_REMOVED_FROM_CURRENT_RECEIVING', message: 'Line removed from current receiving batch; PO outstanding unchanged.', operator: 'Blessing Stock', createdAt: '2026-06-11T09:25:00Z' },
  { id: 'GRN-ACT-0005', grnId: 'GRN-ID-0003', grnNumber: 'GRN-0003', poId: 'PO-ID-0002', poNumber: 'PO-0002', eventType: 'GRN_DAMAGED_GOODS_RECORDED', message: 'Damaged goods rejected and excluded from available stock.', operator: 'Blessing Stock', createdAt: '2026-06-11T10:05:00Z' }
];

export const mockPOReceivingSummaries: POReceivingSummary[] = [
  { poId: 'PO-ID-0001', poNumber: 'PO-0001', supplierName: 'Motor Spares Wholesalers', fulfillmentStatus: 'Not Received', totalOrderedQty: 36, totalPostedReceivedQty: 0, totalOutstandingQty: 36, postedGRNCount: 0, draftGRNCount: 1, lineStates: [
    { poLineId: 'PO-LINE-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', qtyOrdered: 24, qtyPostedReceived: 0, qtyOutstanding: 24, fulfillmentStatus: 'Not Received' },
    { poLineId: 'PO-LINE-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', qtyOrdered: 12, qtyPostedReceived: 0, qtyOutstanding: 12, fulfillmentStatus: 'Not Received' }
  ] },
  { poId: 'PO-ID-0002', poNumber: 'PO-0002', supplierName: 'Lubricants Direct', fulfillmentStatus: 'Fully Received', totalOrderedQty: 40, totalPostedReceivedQty: 38, totalOutstandingQty: 0, postedGRNCount: 1, draftGRNCount: 0, lineStates: [
    { poLineId: 'PO-LINE-0003', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', qtyOrdered: 40, qtyPostedReceived: 38, qtyOutstanding: 0, fulfillmentStatus: 'Fully Received' }
  ] },
  { poId: 'PO-ID-0003', poNumber: 'PO-0003', supplierName: 'Radiator Imports', fulfillmentStatus: 'Partially Received', totalOrderedQty: 5, totalPostedReceivedQty: 2, totalOutstandingQty: 3, postedGRNCount: 1, draftGRNCount: 0, lineStates: [
    { poLineId: 'PO-LINE-0004', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', qtyOrdered: 5, qtyPostedReceived: 2, qtyOutstanding: 3, fulfillmentStatus: 'Partially Received' }
  ] }
];

export const mockSupplierReturns: SupplierReturn[] = [
  {
    supplierReturnId: 'SRT-ID-0001',
    supplierReturnNumber: 'SRT-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-MOTOR-SPARES',
    supplierName: 'Motor Spares Wholesalers',
    poId: 'PO-ID-0001',
    poNumber: 'PO-0001',
    grnId: 'GRN-ID-0001',
    grnNumber: 'GRN-0001',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    returnDate: '2026-06-11',
    status: 'Pending Approval',
    reason: 'Damaged',
    resolution: 'Credit Note Expected',
    supplierContactPerson: 'Nyasha M.',
    supplierPhone: '+263 77 100 3200',
    supplierEmail: 'returns@motorspares.example',
    dispatchMethod: 'Courier Pickup',
    courierReference: 'Pending',
    supplierCreditNoteNumber: '',
    supplierCreditNoteAmount: 0,
    replacementExpected: false,
    notes: 'Damaged brake pads queued for supplier return approval. No cashbook or payment posting.',
    createdAt: '2026-06-11T10:35:00Z',
    updatedAt: '2026-06-11T10:35:00Z'
  },
  {
    supplierReturnId: 'SRT-ID-0002',
    supplierReturnNumber: 'SRT-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-RADIATOR',
    supplierName: 'Radiator Imports',
    poId: 'PO-ID-0003',
    poNumber: 'PO-0003',
    grnId: 'GRN-ID-0003',
    grnNumber: 'GRN-0003',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    returnDate: '2026-06-11',
    status: 'Draft',
    reason: 'Wrong Product',
    resolution: 'Replacement Expected',
    supplierContactPerson: 'Farai R.',
    supplierPhone: '+263 24 700 4411',
    supplierEmail: 'returns@radiatorimports.example',
    dispatchMethod: 'Supplier Collection',
    courierReference: '',
    supplierCreditNoteNumber: '',
    supplierCreditNoteAmount: 0,
    replacementExpected: true,
    notes: 'Wrong radiator supplied. Replacement request captured as placeholder only.',
    createdAt: '2026-06-11T11:05:00Z',
    updatedAt: '2026-06-11T11:05:00Z'
  },
  {
    supplierReturnId: 'SRT-ID-0003',
    supplierReturnNumber: 'SRT-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-LUBRICANTS',
    supplierName: 'Lubricants Direct',
    poId: 'PO-ID-0002',
    poNumber: 'PO-0002',
    grnId: 'GRN-ID-0002',
    grnNumber: 'GRN-0002',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    returnDate: '2026-06-11',
    status: 'Posted',
    reason: 'Over Supplied',
    resolution: 'Credit Note Expected',
    supplierContactPerson: 'Tinashe L.',
    supplierPhone: '+263 77 440 1100',
    supplierEmail: 'returns@lubricantsdirect.example',
    dispatchMethod: 'Vendor Truck',
    courierReference: 'LD Truck Return 07',
    supplierCreditNoteNumber: '',
    supplierCreditNoteAmount: 0,
    replacementExpected: false,
    notes: 'Over-supplied engine oil posted out of stock. Accounting review placeholder only.',
    createdAt: '2026-06-11T12:00:00Z',
    updatedAt: '2026-06-11T12:20:00Z'
  },
  {
    supplierReturnId: 'SRT-ID-0004',
    supplierReturnNumber: 'SRT-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    supplierId: 'SUP-LUBRICANTS',
    supplierName: 'Lubricants Direct',
    poId: 'PO-ID-0002',
    poNumber: 'PO-0002',
    grnId: 'GRN-ID-0003',
    grnNumber: 'GRN-0003',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    returnDate: '2026-06-11',
    status: 'Closed',
    reason: 'Damaged',
    resolution: 'No Credit',
    supplierContactPerson: 'Tinashe L.',
    supplierPhone: '+263 77 440 1100',
    supplierEmail: 'returns@lubricantsdirect.example',
    dispatchMethod: 'Supplier Acknowledgement Only',
    courierReference: 'N/A',
    supplierCreditNoteNumber: '',
    supplierCreditNoteAmount: 0,
    replacementExpected: false,
    notes: 'Damaged goods were rejected at receiving and never accepted into stock. Closed as supplier rejection only.',
    createdAt: '2026-06-11T12:40:00Z',
    updatedAt: '2026-06-11T13:00:00Z'
  }
];

export const mockSupplierReturnLines: SupplierReturnLine[] = [
  { lineId: 'SRT-LINE-0001', supplierReturnId: 'SRT-ID-0001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', manufacturer: 'Bosch', grnLineId: 'GRN-LINE-0003', poLineId: 'PO-LINE-0002', qtyReceived: 8, qtyAcceptedIntoStock: 8, qtyAlreadyReturned: 0, qtyReturnRequested: 2, qtyReturnApproved: 2, qtyPostedOut: 0, unitCost: 22, lineTotal: 44, shelfLocation: 'A3-S6', returnReason: 'Damaged', resolution: 'Credit Note Expected', lineStatus: 'Pending', stockWasPosted: true, notes: 'Two packs damaged after inspection.' },
  { lineId: 'SRT-LINE-0002', supplierReturnId: 'SRT-ID-0002', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', manufacturer: 'Denso', grnLineId: 'GRN-LINE-0001', poLineId: 'PO-LINE-0004', qtyReceived: 2, qtyAcceptedIntoStock: 2, qtyAlreadyReturned: 0, qtyReturnRequested: 1, qtyReturnApproved: 1, qtyPostedOut: 0, unitCost: 75, lineTotal: 75, shelfLocation: 'C2-S1', returnReason: 'Wrong Product', resolution: 'Replacement Expected', lineStatus: 'Draft', stockWasPosted: true, notes: 'Wrong radiator variant supplied.' },
  { lineId: 'SRT-LINE-0003', supplierReturnId: 'SRT-ID-0003', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', manufacturer: 'Denso', grnLineId: 'GRN-LINE-0006', poLineId: 'PO-LINE-0003', qtyReceived: 42, qtyAcceptedIntoStock: 40, qtyAlreadyReturned: 0, qtyReturnRequested: 2, qtyReturnApproved: 2, qtyPostedOut: 2, unitCost: 14.5, lineTotal: 29, shelfLocation: 'B1-S1', returnReason: 'Over Supplied', resolution: 'Credit Note Expected', lineStatus: 'Posted', stockWasPosted: true, notes: 'Two over-supplied cans posted out.' },
  { lineId: 'SRT-LINE-0004', supplierReturnId: 'SRT-ID-0004', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', manufacturer: 'Denso', grnLineId: 'GRN-LINE-0006', poLineId: 'PO-LINE-0003', qtyReceived: 2, qtyAcceptedIntoStock: 0, qtyAlreadyReturned: 0, qtyReturnRequested: 2, qtyReturnApproved: 2, qtyPostedOut: 0, unitCost: 14.5, lineTotal: 29, shelfLocation: 'Receiving Hold', returnReason: 'Damaged', resolution: 'No Credit', lineStatus: 'Closed', stockWasPosted: false, notes: 'Rejected at receiving. No stock reduction required.' }
];

export const mockSupplierReturnActivityEvents: SupplierReturnActivityEvent[] = [
  { id: 'SRT-ACT-0001', supplierReturnId: 'SRT-ID-0001', supplierReturnNumber: 'SRT-0001', grnId: 'GRN-ID-0001', grnNumber: 'GRN-0001', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'SUPPLIER_RETURN_DRAFT_CREATED', message: 'SRT-0001 created from GRN for damaged goods review.', operator: 'Blessing Stock', createdAt: '2026-06-11T10:35:00Z' },
  { id: 'SRT-ACT-0002', supplierReturnId: 'SRT-ID-0001', supplierReturnNumber: 'SRT-0001', grnId: 'GRN-ID-0001', grnNumber: 'GRN-0001', poId: 'PO-ID-0001', poNumber: 'PO-0001', eventType: 'SUPPLIER_RETURN_SUBMITTED_FOR_APPROVAL', message: 'Damaged supplier return submitted for approval. Stock not reduced.', operator: 'Blessing Stock', createdAt: '2026-06-11T10:40:00Z' },
  { id: 'SRT-ACT-0003', supplierReturnId: 'SRT-ID-0003', supplierReturnNumber: 'SRT-0003', grnId: 'GRN-ID-0002', grnNumber: 'GRN-0002', poId: 'PO-ID-0002', poNumber: 'PO-0002', eventType: 'SUPPLIER_RETURN_POSTED_TO_STOCK', message: 'Posted supplier return stock-out for accepted over-supply only.', operator: 'Admin User', createdAt: '2026-06-11T12:20:00Z' },
  { id: 'SRT-ACT-0004', supplierReturnId: 'SRT-ID-0004', supplierReturnNumber: 'SRT-0004', grnId: 'GRN-ID-0003', grnNumber: 'GRN-0003', poId: 'PO-ID-0002', poNumber: 'PO-0002', eventType: 'SUPPLIER_REJECTION_RECORDED_NO_STOCK_IMPACT', message: 'Supplier rejection recorded for goods never accepted into stock.', operator: 'Blessing Stock', createdAt: '2026-06-11T13:00:00Z' }
];

export const mockSupplierReturnCreditNotes: SupplierReturnCreditNotePlaceholder[] = [
  { creditNoteId: 'SRT-CN-0001', supplierReturnId: 'SRT-ID-0003', supplierReturnNumber: 'SRT-0003', supplierCreditNoteNumber: 'LD-CN-PENDING', supplierCreditNoteAmount: 29, receivedDate: '', status: 'Pending Accounting Review', notes: 'Credit note placeholder only. No cashbook or supplier payment posting.', createdAt: '2026-06-11T12:20:00Z' }
];

export const mockStockAdjustments: StockAdjustment[] = [
  {
    adjustmentId: 'STA-ID-0001',
    adjustmentNumber: 'STA-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    requestedByStaffId: 'ST-ADMIN',
    requestedByStaffName: 'Admin User',
    postedByStaffId: 'ST-ADMIN',
    postedByStaffName: 'Admin User',
    adjustmentDate: '2026-06-10',
    status: 'Posted',
    reason: 'Opening Balance',
    riskLevel: 'Low',
    approvalRequired: false,
    notes: 'Opening balance adjustment for Engine Oil 5W30. Inventory value pending accounting review only.',
    createdAt: '2026-06-10T08:00:00Z',
    updatedAt: '2026-06-10T08:10:00Z'
  },
  {
    adjustmentId: 'STA-ID-0002',
    adjustmentNumber: 'STA-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    adjustmentDate: '2026-06-11',
    status: 'Pending Approval',
    reason: 'Damaged Stock',
    riskLevel: 'High',
    approvalRequired: true,
    notes: 'Damaged brake pads require approval before stock can be reduced.',
    createdAt: '2026-06-11T08:45:00Z',
    updatedAt: '2026-06-11T08:50:00Z'
  },
  {
    adjustmentId: 'STA-ID-0003',
    adjustmentNumber: 'STA-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    adjustmentDate: '2026-06-11',
    status: 'Draft',
    reason: 'Physical Count Correction',
    riskLevel: 'Medium',
    approvalRequired: false,
    notes: 'Draft count correction for Ball Joint Honda Fit GD1. Draft does not affect stock.',
    createdAt: '2026-06-11T09:10:00Z',
    updatedAt: '2026-06-11T09:10:00Z'
  },
  {
    adjustmentId: 'STA-ID-0004',
    adjustmentNumber: 'STA-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Main Warehouse',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    adjustmentDate: '2026-06-11',
    status: 'Pending Approval',
    reason: 'Theft / Loss',
    riskLevel: 'Critical',
    approvalRequired: true,
    notes: 'Critical theft/loss adjustment for Radiator Toyota Corolla. Owner review required.',
    createdAt: '2026-06-11T10:15:00Z',
    updatedAt: '2026-06-11T10:20:00Z'
  }
];

export const mockStockAdjustmentLines: StockAdjustmentLine[] = [
  { lineId: 'STA-LINE-0001', adjustmentId: 'STA-ID-0001', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', shelfLocation: 'B1-S1', currentQty: 0, adjustmentDirection: 'Increase', adjustmentQty: 20, newQty: 20, unitCost: 14.5, valueImpact: 290, reason: 'Opening Balance', riskLevel: 'Low', notes: 'Opening balance posted.' },
  { lineId: 'STA-LINE-0002', adjustmentId: 'STA-ID-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', shelfLocation: 'A3-S6', currentQty: 13, adjustmentDirection: 'Decrease', adjustmentQty: 3, newQty: 10, unitCost: 16.5, valueImpact: -49.5, reason: 'Damaged Stock', riskLevel: 'High', notes: 'Damaged stock awaiting approval.' },
  { lineId: 'STA-LINE-0003', adjustmentId: 'STA-ID-0003', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', shelfLocation: 'A2-S5', currentQty: 28, adjustmentDirection: 'Set Quantity', adjustmentQty: 0, newQty: 30, unitCost: 7.25, valueImpact: 14.5, reason: 'Physical Count Correction', riskLevel: 'Medium', notes: 'Draft physical count correction.' },
  { lineId: 'STA-LINE-0004', adjustmentId: 'STA-ID-0004', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', shelfLocation: 'C2-S1', currentQty: 2, adjustmentDirection: 'Decrease', adjustmentQty: 2, newQty: 0, unitCost: 75, valueImpact: -150, reason: 'Theft / Loss', riskLevel: 'Critical', notes: 'Critical loss awaiting Owner approval.' }
];

export const mockStockAdjustmentActivityEvents: StockAdjustmentActivityEvent[] = [
  { id: 'STA-ACT-0001', adjustmentId: 'STA-ID-0001', adjustmentNumber: 'STA-0001', eventType: 'STOCK_ADJUSTMENT_POSTED', message: 'STA-0001 posted opening balance. No cashbook posting.', operator: 'Admin User', createdAt: '2026-06-10T08:10:00Z' },
  { id: 'STA-ACT-0002', adjustmentId: 'STA-ID-0002', adjustmentNumber: 'STA-0002', eventType: 'STOCK_ADJUSTMENT_SUBMITTED_FOR_APPROVAL', message: 'Damaged stock adjustment submitted. Stock not changed.', operator: 'Blessing Stock', createdAt: '2026-06-11T08:50:00Z' },
  { id: 'STA-ACT-0003', adjustmentId: 'STA-ID-0003', adjustmentNumber: 'STA-0003', eventType: 'STOCK_ADJUSTMENT_DRAFT_CREATED', message: 'Draft physical count correction created. Stock not changed.', operator: 'Blessing Stock', createdAt: '2026-06-11T09:10:00Z' },
  { id: 'STA-ACT-0004', adjustmentId: 'STA-ID-0004', adjustmentNumber: 'STA-0004', eventType: 'STOCK_ADJUSTMENT_HIGH_RISK', message: 'Critical theft/loss adjustment requires Owner review.', operator: 'Blessing Stock', createdAt: '2026-06-11T10:20:00Z' }
];

export const mockStocktakeSessions: StocktakeSession[] = [
  {
    stocktakeId: 'STK-ID-0001',
    stocktakeNumber: 'STK-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Harare Spares Depot',
    scope: 'Full Inventory',
    countMode: 'Visible System Qty',
    status: 'Counting',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    countedByStaffId: 'ST-BLESSING',
    countedByStaffName: 'Blessing Stock',
    startedAt: '2026-06-12T08:00:00Z',
    notes: 'Full inventory count in progress. No stock impact until variance posting.',
    createdAt: '2026-06-12T08:00:00Z',
    updatedAt: '2026-06-12T08:25:00Z'
  },
  {
    stocktakeId: 'STK-ID-0002',
    stocktakeNumber: 'STK-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Harare Spares Depot',
    scope: 'Shelf Location',
    countMode: 'Visible System Qty',
    status: 'Count Completed',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    countedByStaffId: 'ST-ELENA',
    countedByStaffName: 'Elena Rostova',
    startedAt: '2026-06-11T15:00:00Z',
    notes: 'Shelf Location A1 variance detected. Await submit/review.',
    shelfLocationFilter: 'A1-S4',
    createdAt: '2026-06-11T15:00:00Z',
    updatedAt: '2026-06-11T15:35:00Z'
  },
  {
    stocktakeId: 'STK-ID-0003',
    stocktakeNumber: 'STK-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Harare Spares Depot',
    scope: 'High Risk Products',
    countMode: 'Blind Count',
    status: 'Pending Approval',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    countedByStaffId: 'ST-ELENA',
    countedByStaffName: 'Elena Rostova',
    startedAt: '2026-06-11T16:00:00Z',
    submittedAt: '2026-06-11T16:45:00Z',
    notes: 'High-risk blind count requires Owner approval. Draft/submitted state does not post stock.',
    createdAt: '2026-06-11T16:00:00Z',
    updatedAt: '2026-06-11T16:45:00Z'
  },
  {
    stocktakeId: 'STK-ID-0004',
    stocktakeNumber: 'STK-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'Harare Main',
    warehouseId: 'Harare Spares Depot',
    scope: 'Selected Products',
    countMode: 'Supervisor Count',
    status: 'Posted',
    requestedByStaffId: 'ST-BLESSING',
    requestedByStaffName: 'Blessing Stock',
    countedByStaffId: 'ST-ELENA',
    countedByStaffName: 'Elena Rostova',
    approvedByStaffId: 'ST-ADMIN',
    approvedByStaffName: 'Admin User',
    postedByStaffId: 'ST-ADMIN',
    postedByStaffName: 'Admin User',
    startedAt: '2026-06-10T12:00:00Z',
    submittedAt: '2026-06-10T12:25:00Z',
    approvedAt: '2026-06-10T12:35:00Z',
    postedAt: '2026-06-10T12:45:00Z',
    notes: 'Posted stocktake created gain/loss inventory movements only. Accounting impact remains pending review placeholder.',
    selectedProductIds: ['STOCK-P-02', 'STOCK-P-03'],
    createdAt: '2026-06-10T12:00:00Z',
    updatedAt: '2026-06-10T12:45:00Z'
  }
];

export const mockStocktakeLines: StocktakeLine[] = [
  { lineId: 'STK-LINE-0001', stocktakeId: 'STK-ID-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', category: 'Motor Spares', shelfLocation: 'A2-S5', systemQty: 28, countedQty: 28, varianceQty: 0, unitCost: 7.25, valueImpact: 0, varianceRisk: 'None', lineStatus: 'No Variance', countNotes: 'First pass counted.', recountNotes: '' },
  { lineId: 'STK-LINE-0002', stocktakeId: 'STK-ID-0001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', category: 'Motor Spares', shelfLocation: 'A3-S6', systemQty: 13, countedQty: null, varianceQty: 0, unitCost: 16.5, valueImpact: 0, varianceRisk: 'Medium', lineStatus: 'Not Counted', countNotes: '', recountNotes: '' },
  { lineId: 'STK-LINE-0003', stocktakeId: 'STK-ID-0001', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', category: 'Lubricants', shelfLocation: 'B1-S1', systemQty: 17, countedQty: 17, varianceQty: 0, unitCost: 14.5, valueImpact: 0, varianceRisk: 'None', lineStatus: 'No Variance', countNotes: 'Oil bay counted.', recountNotes: '' },
  { lineId: 'STK-LINE-0004', stocktakeId: 'STK-ID-0002', productId: 'STOCK-P-01', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', category: 'Motor Spares', shelfLocation: 'A1-S4', systemQty: 3, countedQty: 2, varianceQty: -1, unitCost: 75, valueImpact: -75, varianceRisk: 'High', lineStatus: 'Variance', countNotes: 'One unit not found at shelf A1.', recountNotes: '' },
  { lineId: 'STK-LINE-0005', stocktakeId: 'STK-ID-0002', productId: 'STOCK-P-05', sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', brand: 'Nissan', category: 'Motor Spares', shelfLocation: 'A5-S2', systemQty: 0, countedQty: 1, varianceQty: 1, unitCost: 25, valueImpact: 25, varianceRisk: 'Medium', lineStatus: 'Variance', countNotes: 'One sealed unit found behind returns cage.', recountNotes: '' },
  { lineId: 'STK-LINE-0006', stocktakeId: 'STK-ID-0003', productId: 'prod-press-gauge', sku: 'PSG-B10', productName: 'Dial Pressure Gauge (10 Bar)', brand: 'SCI Industrial', category: 'PNEUMATICS', shelfLocation: '', systemQty: 1, countedQty: 0, varianceQty: -1, unitCost: 13.5, valueImpact: -13.5, varianceRisk: 'High', lineStatus: 'Recount Required', countNotes: 'Blind count recorded zero.', recountNotes: 'Supervisor recount required before posting.' },
  { lineId: 'STK-LINE-0007', stocktakeId: 'STK-ID-0003', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', category: 'Motor Spares', shelfLocation: 'A3-S6', systemQty: 13, countedQty: 9, varianceQty: -4, unitCost: 16.5, valueImpact: -66, varianceRisk: 'Critical', lineStatus: 'Variance', countNotes: 'Large negative variance, theft/loss suspected.', recountNotes: '' },
  { lineId: 'STK-LINE-0008', stocktakeId: 'STK-ID-0004', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', category: 'Motor Spares', shelfLocation: 'A2-S5', systemQty: 28, countedQty: 30, varianceQty: 2, unitCost: 7.25, valueImpact: 14.5, varianceRisk: 'Low', lineStatus: 'Posted', countNotes: 'Gain posted as STOCKTAKE_GAIN.', recountNotes: '', postedMovementId: 'MOV-STK-0004-GAIN' },
  { lineId: 'STK-LINE-0009', stocktakeId: 'STK-ID-0004', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', category: 'Motor Spares', shelfLocation: 'A3-S6', systemQty: 13, countedQty: 12, varianceQty: -1, unitCost: 16.5, valueImpact: -16.5, varianceRisk: 'Medium', lineStatus: 'Posted', countNotes: 'Loss posted as STOCKTAKE_LOSS.', recountNotes: '', postedMovementId: 'MOV-STK-0004-LOSS' }
];

export const mockStocktakeActivityEvents: StocktakeActivityEvent[] = [
  { id: 'STK-ACT-0001', stocktakeId: 'STK-ID-0001', stocktakeNumber: 'STK-0001', eventType: 'STOCKTAKE_COUNT_STARTED', message: 'STK-0001 full inventory count started. Stock not changed.', operator: 'Blessing Stock', severity: 'Low', createdAt: '2026-06-12T08:00:00Z' },
  { id: 'STK-ACT-0002', stocktakeId: 'STK-ID-0002', stocktakeNumber: 'STK-0002', eventType: 'STOCKTAKE_VARIANCE_FOUND', message: 'Shelf Location A1 variance detected. Posting blocked until review.', operator: 'Elena Rostova', severity: 'High', createdAt: '2026-06-11T15:35:00Z' },
  { id: 'STK-ACT-0003', stocktakeId: 'STK-ID-0003', stocktakeNumber: 'STK-0003', eventType: 'STOCKTAKE_HIGH_RISK_VARIANCE', message: 'High-risk blind count variance submitted for approval.', operator: 'Elena Rostova', severity: 'Critical', createdAt: '2026-06-11T16:45:00Z' },
  { id: 'STK-ACT-0004', stocktakeId: 'STK-ID-0004', stocktakeNumber: 'STK-0004', eventType: 'STOCKTAKE_VARIANCE_POSTED', message: 'STK-0004 posted gain/loss movements. No cashbook or supplier payment posting.', operator: 'Admin User', severity: 'Medium', createdAt: '2026-06-10T12:45:00Z' }
];

export const mockStockTransfers: StockTransfer[] = [
  { transferId: 'TRF-ID-0001', transferNumber: 'TRF-0001', vendorId: 'SCI-LOG-ZW', transferType: 'Warehouse To Branch', sourceBranchId: 'BR-HARARE', sourceBranchName: 'Harare Main', sourceWarehouseId: 'Harare Spares Depot', sourceWarehouseName: 'Harare Main Warehouse', destinationBranchId: 'BR-HARARE', destinationBranchName: 'Harare Main', destinationWarehouseId: 'Harare Sales Floor', destinationWarehouseName: 'Harare Sales Floor', requestedByStaffId: 'ST-BLESSING', requestedByStaffName: 'Blessing Stock', approvedByStaffId: 'ST-MANAGER', approvedByStaffName: 'Tawanda Supervisor', transferDate: '2026-06-12', expectedArrivalDate: '2026-06-12', status: 'Approved', priority: 'Normal', reason: 'Sales floor replenishment', transportMethod: 'Internal Runner', notes: 'Approved transfer. No stock moved until dispatch.', createdAt: '2026-06-12T08:15:00Z', updatedAt: '2026-06-12T08:25:00Z' },
  { transferId: 'TRF-ID-0002', transferNumber: 'TRF-0002', vendorId: 'SCI-LOG-ZW', transferType: 'Branch To Branch', sourceBranchId: 'BR-HARARE', sourceBranchName: 'Harare Main', sourceWarehouseId: 'Harare Spares Depot', sourceWarehouseName: 'Harare Spares Depot', destinationBranchId: 'BR-BYO', destinationBranchName: 'Bulawayo Branch', destinationWarehouseId: 'Bulawayo Warehouse', destinationWarehouseName: 'Bulawayo Warehouse', requestedByStaffId: 'ST-BLESSING', requestedByStaffName: 'Blessing Stock', approvedByStaffId: 'ST-MANAGER', approvedByStaffName: 'Tawanda Supervisor', dispatchedByStaffId: 'ST-BLESSING', dispatchedByStaffName: 'Blessing Stock', transferDate: '2026-06-11', expectedArrivalDate: '2026-06-13', dispatchDate: '2026-06-11T14:20:00Z', status: 'In Transit', priority: 'High', reason: 'Bulawayo branch replenishment', transportMethod: 'Courier', courierReference: 'DHL-ZW-77821', driverName: 'Kuda M', driverPhone: '+263 77 600 1122', notes: 'Dispatched. Destination stock not increased yet.', createdAt: '2026-06-11T09:00:00Z', updatedAt: '2026-06-11T14:20:00Z' },
  { transferId: 'TRF-ID-0003', transferNumber: 'TRF-0003', vendorId: 'SCI-LOG-ZW', transferType: 'Good Stock To Damaged Holding', sourceBranchId: 'BR-HARARE', sourceBranchName: 'Harare Main', sourceWarehouseId: 'Harare Sales Floor', sourceWarehouseName: 'Harare Sales Floor', destinationBranchId: 'BR-HARARE', destinationBranchName: 'Harare Main', destinationWarehouseId: 'Damaged Holding Area', destinationWarehouseName: 'Damaged Holding Area', requestedByStaffId: 'ST-ELENA', requestedByStaffName: 'Elena Rostova', approvedByStaffId: 'ST-MANAGER', approvedByStaffName: 'Tawanda Supervisor', dispatchedByStaffId: 'ST-ELENA', dispatchedByStaffName: 'Elena Rostova', receivedByStaffId: 'ST-BLESSING', receivedByStaffName: 'Blessing Stock', transferDate: '2026-06-10', expectedArrivalDate: '2026-06-10', dispatchDate: '2026-06-10T10:00:00Z', receivedDate: '2026-06-10T10:30:00Z', status: 'Fully Received', priority: 'Normal', reason: 'Move damaged goods to holding', transportMethod: 'Internal Runner', notes: 'Fully received into damaged holding. No financial posting.', createdAt: '2026-06-10T09:30:00Z', updatedAt: '2026-06-10T10:30:00Z' },
  { transferId: 'TRF-ID-0004', transferNumber: 'TRF-0004', vendorId: 'SCI-LOG-ZW', transferType: 'Good Stock To Return Holding', sourceBranchId: 'BR-HARARE', sourceBranchName: 'Harare Main', sourceWarehouseId: 'Harare Sales Floor', sourceWarehouseName: 'Harare Sales Floor', destinationBranchId: 'BR-HARARE', destinationBranchName: 'Harare Main', destinationWarehouseId: 'Return Holding Area', destinationWarehouseName: 'Return Holding Area', requestedByStaffId: 'ST-BLESSING', requestedByStaffName: 'Blessing Stock', transferDate: '2026-06-12', expectedArrivalDate: '2026-06-12', status: 'Draft', priority: 'Low', reason: 'Prepare goods for return inspection', transportMethod: 'Internal Runner', notes: 'Draft transfer request. No stock movement.', createdAt: '2026-06-12T11:10:00Z', updatedAt: '2026-06-12T11:10:00Z' },
  { transferId: 'TRF-ID-0005', transferNumber: 'TRF-0005', vendorId: 'SCI-LOG-ZW', transferType: 'Warehouse To Branch', sourceBranchId: 'BR-HARARE', sourceBranchName: 'Harare Main', sourceWarehouseId: 'Harare Spares Depot', sourceWarehouseName: 'Harare Spares Depot', destinationBranchId: 'BR-BYO', destinationBranchName: 'Bulawayo Branch', destinationWarehouseId: 'Bulawayo Warehouse', destinationWarehouseName: 'Bulawayo Warehouse', requestedByStaffId: 'ST-BLESSING', requestedByStaffName: 'Blessing Stock', approvedByStaffId: 'ST-MANAGER', approvedByStaffName: 'Tawanda Supervisor', dispatchedByStaffId: 'ST-BLESSING', dispatchedByStaffName: 'Blessing Stock', receivedByStaffId: 'ST-TAWANDA', receivedByStaffName: 'Tawanda Supervisor', transferDate: '2026-06-09', expectedArrivalDate: '2026-06-10', dispatchDate: '2026-06-09T15:00:00Z', receivedDate: '2026-06-10T09:15:00Z', status: 'Partially Received', priority: 'High', reason: 'Branch replenishment with short receipt', transportMethod: 'Courier', courierReference: 'TRUCK-441', notes: 'Short receipt variance remains open.', createdAt: '2026-06-09T12:00:00Z', updatedAt: '2026-06-10T09:15:00Z' }
];

export const mockStockTransferLines: StockTransferLine[] = [
  { lineId: 'TRF-LINE-0001', transferId: 'TRF-ID-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', brand: 'Honda', category: 'Motor Spares', sourceShelfLocation: 'A2-S5', destinationShelfLocation: 'SF-A1', qtyRequested: 8, qtyApproved: 8, qtyDispatched: 0, qtyReceived: 0, qtyAccepted: 0, qtyRejected: 0, qtyOutstanding: 8, unitCost: 7, valueImpact: 56, lineStatus: 'Approved', varianceType: 'None', notes: 'Ready for sales floor dispatch.' },
  { lineId: 'TRF-LINE-0002', transferId: 'TRF-ID-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', brand: 'Toyota', category: 'Motor Spares', sourceShelfLocation: 'A3-S6', destinationShelfLocation: 'BYO-B2', qtyRequested: 6, qtyApproved: 6, qtyDispatched: 6, qtyReceived: 0, qtyAccepted: 0, qtyRejected: 0, qtyOutstanding: 6, unitCost: 16, valueImpact: 96, lineStatus: 'In Transit', varianceType: 'None', notes: 'Courier in transit.', dispatchPosted: true },
  { lineId: 'TRF-LINE-0003', transferId: 'TRF-ID-0003', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', brand: 'SCI Industrial', category: 'Lubricants', sourceShelfLocation: 'SF-L1', destinationShelfLocation: 'DMG-HOLD', qtyRequested: 2, qtyApproved: 2, qtyDispatched: 2, qtyReceived: 2, qtyAccepted: 2, qtyRejected: 0, qtyOutstanding: 0, unitCost: 14.5, valueImpact: 29, lineStatus: 'Fully Received', varianceType: 'Damaged In Transit', notes: 'Damaged holding receipt posted.', dispatchPosted: true, receiptPosted: true },
  { lineId: 'TRF-LINE-0004', transferId: 'TRF-ID-0004', productId: 'STOCK-P-05', sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', brand: 'Nissan', category: 'Motor Spares', sourceShelfLocation: 'A4-S4', destinationShelfLocation: 'RET-HOLD', qtyRequested: 1, qtyApproved: 0, qtyDispatched: 0, qtyReceived: 0, qtyAccepted: 0, qtyRejected: 0, qtyOutstanding: 1, unitCost: 25, valueImpact: 25, lineStatus: 'Draft', varianceType: 'None', notes: 'Draft return holding transfer.' },
  { lineId: 'TRF-LINE-0005', transferId: 'TRF-ID-0005', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', brand: 'Toyota', category: 'Motor Spares', sourceShelfLocation: 'C2-S1', destinationShelfLocation: 'BYO-C1', qtyRequested: 5, qtyApproved: 5, qtyDispatched: 5, qtyReceived: 4, qtyAccepted: 4, qtyRejected: 0, qtyOutstanding: 1, unitCost: 75, valueImpact: 300, lineStatus: 'Short Received', varianceType: 'Short Received', notes: 'One radiator short on delivery.', dispatchPosted: true }
];

export const mockStockTransferDispatches: StockTransferDispatch[] = [
  { dispatchId: 'TRF-DSP-0002', transferId: 'TRF-ID-0002', dispatchedByStaffId: 'ST-BLESSING', dispatchedByStaffName: 'Blessing Stock', dispatchDate: '2026-06-11T14:20:00Z', transportMethod: 'Courier', courierReference: 'DHL-ZW-77821', driverName: 'Kuda M', driverPhone: '+263 77 600 1122', notes: 'Dispatched from Harare Spares Depot.' },
  { dispatchId: 'TRF-DSP-0005', transferId: 'TRF-ID-0005', dispatchedByStaffId: 'ST-BLESSING', dispatchedByStaffName: 'Blessing Stock', dispatchDate: '2026-06-09T15:00:00Z', transportMethod: 'Courier', courierReference: 'TRUCK-441', notes: 'Dispatched to Bulawayo Warehouse.' }
];

export const mockStockTransferReceipts: StockTransferReceive[] = [
  { receiveId: 'TRF-REC-0003', transferId: 'TRF-ID-0003', receivedByStaffId: 'ST-BLESSING', receivedByStaffName: 'Blessing Stock', receivedDate: '2026-06-10T10:30:00Z', notes: 'Damaged holding receipt completed.' },
  { receiveId: 'TRF-REC-0005', transferId: 'TRF-ID-0005', receivedByStaffId: 'ST-TAWANDA', receivedByStaffName: 'Tawanda Supervisor', receivedDate: '2026-06-10T09:15:00Z', notes: 'Short receipt captured; one unit outstanding.' }
];

export const mockStockTransferVariances: StockTransferVariance[] = [
  { varianceId: 'TRF-VAR-0005', transferId: 'TRF-ID-0005', lineId: 'TRF-LINE-0005', varianceType: 'Short Received', severity: 'High', message: 'Short receipt: 4 accepted against 5 dispatched.', approvalRequired: true, resolved: false }
];

export const mockStockTransferActivityEvents: StockTransferActivityEvent[] = [
  { id: 'TRF-ACT-0001', transferId: 'TRF-ID-0001', transferNumber: 'TRF-0001', eventType: 'STOCK_TRANSFER_APPROVED', message: 'TRF-0001 approved. Stock not moved until dispatch.', operator: 'Tawanda Supervisor', severity: 'Low', createdAt: '2026-06-12T08:25:00Z' },
  { id: 'TRF-ACT-0002', transferId: 'TRF-ID-0002', transferNumber: 'TRF-0002', eventType: 'STOCK_TRANSFER_IN_TRANSIT', message: 'TRF-0002 dispatched and in transit. Destination stock not increased.', operator: 'Blessing Stock', severity: 'Medium', createdAt: '2026-06-11T14:20:00Z' },
  { id: 'TRF-ACT-0005', transferId: 'TRF-ID-0005', transferNumber: 'TRF-0005', eventType: 'STOCK_TRANSFER_VARIANCE_FOUND', message: 'TRF-0005 short receipt variance recorded.', operator: 'Tawanda Supervisor', severity: 'High', createdAt: '2026-06-10T09:15:00Z' }
];

export const mockProductLedgerEntries: ProductLedgerEntry[] = [
  { id: 'LED-BJ-001', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-01T08:00:00Z', movementType: 'Opening Balance', referenceType: 'Manual', referenceNo: 'OPEN-0001', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 15, qtyOut: 0, balanceAfter: 15, unitCost: 7, sellingPrice: 12, staffId: 'ST-ADMIN', staffName: 'Admin User', notes: 'Opening stock loaded for build-development.', riskFlag: 'None' },
  { id: 'LED-BJ-002', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-02T10:15:00Z', movementType: 'Sale', referenceType: 'Receipt', referenceNo: 'RCT-0001', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 0, qtyOut: 2, balanceAfter: 13, unitCost: 7, sellingPrice: 12, staffId: 'ST-MARY', staffName: 'Mary Cashier', notes: 'Retail sale.', riskFlag: 'None' },
  { id: 'LED-BJ-003', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-03T09:30:00Z', movementType: 'Goods Received', referenceType: 'GRN', referenceNo: 'GRN-2026-9041', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 20, qtyOut: 0, balanceAfter: 33, unitCost: 7.25, sellingPrice: 12, staffId: 'ST-004', staffName: 'Elena Rostova', notes: 'Supplier delivery posted.', riskFlag: 'Low' },
  { id: 'LED-BJ-004', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-04T16:45:00Z', movementType: 'Stocktake Adjustment', referenceType: 'Stocktake', referenceNo: 'STK-2026-001', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 0, qtyOut: 1, balanceAfter: 32, unitCost: 7.25, sellingPrice: 12, staffId: 'ST-004', staffName: 'Elena Rostova', notes: 'Shelf count short by one.', riskFlag: 'Medium' },
  { id: 'LED-BJ-005', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-05T12:10:00Z', movementType: 'Transfer Out', referenceType: 'Transfer', referenceNo: 'TRF-0007', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 0, qtyOut: 5, balanceAfter: 27, unitCost: 7.25, sellingPrice: 12, staffId: 'ST-ADMIN', staffName: 'Admin User', notes: 'Moved to Bulawayo Branch.', riskFlag: 'None' },
  { id: 'LED-BJ-006', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productNumericNumber: '000000011', alu: 'ALU-BJ-CBHO49', dateTime: '2026-06-06T14:20:00Z', movementType: 'Return', referenceType: 'Return', referenceNo: 'RET-0002', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A2-S5', qtyIn: 1, qtyOut: 0, balanceAfter: 28, unitCost: 7.25, sellingPrice: 12, staffId: 'ST-MARY', staffName: 'Mary Cashier', notes: 'Customer returned sealed unit.', riskFlag: 'None' },
  { id: 'LED-BP-001', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productNumericNumber: '000000012', alu: 'ALU-BP-GD6-F', dateTime: '2026-06-01T08:00:00Z', movementType: 'Opening Balance', referenceType: 'Manual', referenceNo: 'OPEN-0002', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A3-S6', qtyIn: 8, qtyOut: 0, balanceAfter: 8, unitCost: 16, sellingPrice: 28, staffId: 'ST-ADMIN', staffName: 'Admin User', notes: 'Opening balance.', riskFlag: 'None' },
  { id: 'LED-BP-002', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productNumericNumber: '000000012', alu: 'ALU-BP-GD6-F', dateTime: '2026-06-03T11:00:00Z', movementType: 'Sale', referenceType: 'Receipt', referenceNo: 'RCT-0004', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A3-S6', qtyIn: 0, qtyOut: 2, balanceAfter: 6, unitCost: 16, sellingPrice: 28, staffId: 'ST-003', staffName: 'John Connor', notes: 'GD6 brake front sale.', riskFlag: 'Low' },
  { id: 'LED-BP-003', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productNumericNumber: '000000012', alu: 'ALU-BP-GD6-F', dateTime: '2026-06-07T09:20:00Z', movementType: 'Goods Received', referenceType: 'GRN', referenceNo: 'GRN-2026-9042', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A3-S6', qtyIn: 10, qtyOut: 0, balanceAfter: 16, unitCost: 16.5, sellingPrice: 30, staffId: 'ST-004', staffName: 'Elena Rostova', notes: 'Brake pads replenishment.', riskFlag: 'None' },
  { id: 'LED-CLT-001', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-05', sku: 'CLT-N16', productNumericNumber: '000000014', alu: 'ALU-CLT-N16', dateTime: '2026-06-01T08:00:00Z', movementType: 'Opening Balance', referenceType: 'Manual', referenceNo: 'OPEN-0005', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A5-S2', qtyIn: 3, qtyOut: 0, balanceAfter: 3, unitCost: 25, sellingPrice: 45, staffId: 'ST-ADMIN', staffName: 'Admin User', notes: 'Opening balance.', riskFlag: 'None' },
  { id: 'LED-CLT-002', vendorId: 'SCI-LOG-ZW', productId: 'STOCK-P-05', sku: 'CLT-N16', productNumericNumber: '000000014', alu: 'ALU-CLT-N16', dateTime: '2026-06-08T13:15:00Z', movementType: 'Damage / Write-Off', referenceType: 'Adjustment', referenceNo: 'ADJ-0019', branch: 'Harare Main', warehouse: 'Harare Spares Depot', shelfLocation: 'A5-S2', qtyIn: 0, qtyOut: 3, balanceAfter: 0, unitCost: 25, sellingPrice: 45, staffId: 'ST-004', staffName: 'Elena Rostova', notes: 'Damaged units written off.', riskFlag: 'High' }
];

const movementBase = {
  vendorId: 'SCI-LOG-ZW',
  branchId: 'BR-HARARE',
  warehouseId: 'WH-HARARE-01',
  staffId: 'ST-004',
  staffName: 'Elena Rostova',
  terminalId: 'TERM-HARARE-01',
  salesAccountCOA: '4010',
  assetAccountCOA: '1210',
  status: 'Posted' as const,
  approvalRequired: false,
  createdAt: '2026-06-09T08:00:00Z',
  updatedAt: '2026-06-09T08:00:00Z'
};

export const mockInventoryMovements: InventoryMovement[] = [
  { ...movementBase, movementId: 'MOV-BJ-001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-0001', qtyIn: 15, qtyOut: 0, balanceBefore: 0, balanceAfter: 15, unitCost: 7, sellingPrice: 12, totalCostImpact: 105, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening stock loaded.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BJ-002', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-0001', qtyIn: 0, qtyOut: 2, balanceBefore: 15, balanceAfter: 13, unitCost: 7, sellingPrice: 12, totalCostImpact: -14, staffId: 'ST-MARY', staffName: 'Mary Cashier', movementDate: '2026-06-02T10:15:00Z', notes: 'Retail sale.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BJ-003', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'GOODS_RECEIVED', referenceType: 'GRN', referenceNumber: 'GRN-2026-9041', qtyIn: 20, qtyOut: 0, balanceBefore: 13, balanceAfter: 33, unitCost: 7.25, sellingPrice: 12, totalCostImpact: 145, movementDate: '2026-06-03T09:30:00Z', notes: 'Supplier delivery posted.', riskFlag: 'Low' },
  { ...movementBase, movementId: 'MOV-BJ-004', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'STOCKTAKE_ADJUSTMENT_OUT', referenceType: 'STOCKTAKE', referenceNumber: 'STK-2026-001', qtyIn: 0, qtyOut: 1, balanceBefore: 33, balanceAfter: 32, unitCost: 7.25, sellingPrice: 12, totalCostImpact: -7.25, movementDate: '2026-06-04T16:45:00Z', notes: 'Shelf count short by one.', riskFlag: 'Medium' },
  { ...movementBase, movementId: 'MOV-BJ-005', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'TRANSFER_OUT', referenceType: 'TRANSFER', referenceNumber: 'TRF-0007', transferId: 'TRF-0007', qtyIn: 0, qtyOut: 5, balanceBefore: 32, balanceAfter: 27, unitCost: 7.25, sellingPrice: 12, totalCostImpact: -36.25, movementDate: '2026-06-05T12:10:00Z', notes: 'Moved to Bulawayo Branch.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BJ-006', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', alu: 'ALU-BJ-CBHO49', productNumericNumber: '000000011', productName: 'Ball Joint Honda Fit GD1', shelfLocation: 'A2-S5', movementType: 'SALE_RETURN', referenceType: 'RETURN', referenceNumber: 'RET-0002', qtyIn: 1, qtyOut: 0, balanceBefore: 27, balanceAfter: 28, unitCost: 7.25, sellingPrice: 12, totalCostImpact: 7.25, staffId: 'ST-MARY', staffName: 'Mary Cashier', movementDate: '2026-06-06T14:20:00Z', notes: 'Customer returned sealed unit.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BP-001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', alu: 'ALU-BP-GD6-F', productNumericNumber: '000000012', productName: 'Brake Pads Toyota GD6 Front', shelfLocation: 'A3-S6', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-0002', qtyIn: 8, qtyOut: 0, balanceBefore: 0, balanceAfter: 8, unitCost: 16, sellingPrice: 28, totalCostImpact: 128, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening balance.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BP-002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', alu: 'ALU-BP-GD6-F', productNumericNumber: '000000012', productName: 'Brake Pads Toyota GD6 Front', shelfLocation: 'A3-S6', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-0004', qtyIn: 0, qtyOut: 2, balanceBefore: 8, balanceAfter: 6, unitCost: 16, sellingPrice: 28, totalCostImpact: -32, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-06-03T11:00:00Z', notes: 'GD6 brake front sale.', riskFlag: 'Low' },
  { ...movementBase, movementId: 'MOV-BP-003', productId: 'STOCK-P-03', sku: 'BP-GD6-F', alu: 'ALU-BP-GD6-F', productNumericNumber: '000000012', productName: 'Brake Pads Toyota GD6 Front', shelfLocation: 'A3-S6', movementType: 'GOODS_RECEIVED', referenceType: 'GRN', referenceNumber: 'GRN-2026-9042', qtyIn: 10, qtyOut: 0, balanceBefore: 6, balanceAfter: 16, unitCost: 16.5, sellingPrice: 30, totalCostImpact: 165, movementDate: '2026-06-07T09:20:00Z', notes: 'Brake pads replenishment.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-OIL-001', productId: 'STOCK-P-04', sku: 'OIL-5W30', alu: 'ALU-OIL-5W30', productNumericNumber: '000000013', productName: 'Engine Oil 5W30 5L', shelfLocation: 'B1-S1', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-0004', qtyIn: 20, qtyOut: 0, balanceBefore: 0, balanceAfter: 20, unitCost: 14.5, sellingPrice: 22, totalCostImpact: 290, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening balance.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-OIL-002', productId: 'STOCK-P-04', sku: 'OIL-5W30', alu: 'ALU-OIL-5W30', productNumericNumber: '000000013', productName: 'Engine Oil 5W30 5L', shelfLocation: 'B1-S1', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-0005', qtyIn: 0, qtyOut: 3, balanceBefore: 20, balanceAfter: 17, unitCost: 14.5, sellingPrice: 22, totalCostImpact: -43.5, movementDate: '2026-06-06T10:00:00Z', notes: 'Oil retail sale.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-RAD-001', productId: 'STOCK-P-01', sku: 'RAD-FJ200-L', alu: 'ALU-RAD-FJ200-L', productNumericNumber: '000000010', productName: 'Head Lamp FJ200 Series 2016 Left', shelfLocation: 'A1-S4', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-0003', qtyIn: 4, qtyOut: 0, balanceBefore: 0, balanceAfter: 4, unitCost: 50, sellingPrice: 85, totalCostImpact: 200, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening balance.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-RAD-002', productId: 'STOCK-P-01', sku: 'RAD-FJ200-L', alu: 'ALU-RAD-FJ200-L', productNumericNumber: '000000010', productName: 'Head Lamp FJ200 Series 2016 Left', shelfLocation: 'A1-S4', movementType: 'SUPPLIER_RETURN', referenceType: 'SUPPLIER_RETURN', referenceNumber: 'SRET-0008', qtyIn: 0, qtyOut: 1, balanceBefore: 4, balanceAfter: 3, unitCost: 50, sellingPrice: 85, totalCostImpact: -50, movementDate: '2026-06-08T12:30:00Z', notes: 'Returned cracked lens to supplier.', riskFlag: 'Medium' },
  { ...movementBase, movementId: 'MOV-CLT-001', productId: 'STOCK-P-05', sku: 'CLT-N16', alu: 'ALU-CLT-N16', productNumericNumber: '000000014', productName: 'Clutch Plate Nissan N16', shelfLocation: 'A5-S2', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-0005', qtyIn: 3, qtyOut: 0, balanceBefore: 0, balanceAfter: 3, unitCost: 25, sellingPrice: 45, totalCostImpact: 75, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening balance.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-CLT-002', productId: 'STOCK-P-05', sku: 'CLT-N16', alu: 'ALU-CLT-N16', productNumericNumber: '000000014', productName: 'Clutch Plate Nissan N16', shelfLocation: 'A5-S2', movementType: 'DAMAGE_WRITEOFF', referenceType: 'DAMAGE', referenceNumber: 'ADJ-0019', qtyIn: 0, qtyOut: 3, balanceBefore: 3, balanceAfter: 0, unitCost: 25, sellingPrice: 45, totalCostImpact: -75, movementDate: '2026-06-08T13:15:00Z', notes: 'Damaged units written off.', riskFlag: 'High' },
  { ...movementBase, movementId: 'MOV-BP-004', productId: 'STOCK-P-03', sku: 'BP-GD6-F', alu: 'ALU-BP-GD6-F', productNumericNumber: '000000012', productName: 'Brake Pads Toyota GD6 Front', shelfLocation: 'A3-S6', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-0012', qtyIn: 0, qtyOut: 1, balanceBefore: 16, balanceAfter: 15, unitCost: 16.5, sellingPrice: 28, totalCostImpact: -16.5, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-06-07T15:30:00Z', notes: 'Fast-moving brake pad sale.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-BP-005', productId: 'STOCK-P-03', sku: 'BP-GD6-F', alu: 'ALU-BP-GD6-F', productNumericNumber: '000000012', productName: 'Brake Pads Toyota GD6 Front', shelfLocation: 'A3-S6', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-0018', qtyIn: 0, qtyOut: 2, balanceBefore: 15, balanceAfter: 13, unitCost: 16.5, sellingPrice: 28, totalCostImpact: -33, staffId: 'ST-MARY', staffName: 'Mary Cashier', movementDate: '2026-06-08T11:20:00Z', notes: 'Second fast-moving sale in 7 days.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-HEX-001', productId: 'prod-hex-bolt', sku: 'HEX-B12', alu: 'ALU-HEX-B12', productNumericNumber: '000000001', productName: 'M12 Heavy Hex Bolt (Steel 8.8)', shelfLocation: 'C1-FASTENERS', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-HEX-01', qtyIn: 150, qtyOut: 0, balanceBefore: 0, balanceAfter: 150, unitCost: 0.95, sellingPrice: 2.45, totalCostImpact: 142.5, movementDate: '2026-06-01T08:00:00Z', notes: 'Opening fasteners stock.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-HEX-002', productId: 'prod-hex-bolt', sku: 'HEX-B12', alu: 'ALU-HEX-B12', productNumericNumber: '000000001', productName: 'M12 Heavy Hex Bolt (Steel 8.8)', shelfLocation: 'C1-FASTENERS', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-HEX-01', qtyIn: 0, qtyOut: 20, balanceBefore: 150, balanceAfter: 130, unitCost: 0.95, sellingPrice: 2.45, totalCostImpact: -19, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-06-06T09:00:00Z', notes: 'Bulk fastener sale.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-HEX-003', productId: 'prod-hex-bolt', sku: 'HEX-B12', alu: 'ALU-HEX-B12', productNumericNumber: '000000001', productName: 'M12 Heavy Hex Bolt (Steel 8.8)', shelfLocation: 'C1-FASTENERS', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-HEX-02', qtyIn: 0, qtyOut: 15, balanceBefore: 130, balanceAfter: 115, unitCost: 0.95, sellingPrice: 2.45, totalCostImpact: -14.25, staffId: 'ST-MARY', staffName: 'Mary Cashier', movementDate: '2026-06-08T14:45:00Z', notes: 'Second fast-moving sale in 7 days.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-SLV-001', productId: 'prod-solenoid-v', sku: 'SLV-D24', alu: 'ALU-SLV-D24', productNumericNumber: '000000009', productName: 'Heavy Solenoid Valve 24VDC', shelfLocation: 'D1-HARDWARE', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-SLV-01', qtyIn: 4, qtyOut: 0, balanceBefore: 0, balanceAfter: 4, unitCost: 30, sellingPrice: 65, totalCostImpact: 120, movementDate: '2026-01-10T08:00:00Z', notes: 'Dead stock opening balance.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-SLV-002', productId: 'prod-solenoid-v', sku: 'SLV-D24', alu: 'ALU-SLV-D24', productNumericNumber: '000000009', productName: 'Heavy Solenoid Valve 24VDC', shelfLocation: 'D1-HARDWARE', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-SLV-01', qtyIn: 0, qtyOut: 1, balanceBefore: 4, balanceAfter: 3, unitCost: 30, sellingPrice: 65, totalCostImpact: -30, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-02-12T10:00:00Z', notes: 'Last sale over 90 days ago.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-PSG-001', productId: 'prod-press-gauge', sku: 'PSG-B10', alu: 'ALU-PSG-B10', productNumericNumber: '000000008', productName: 'Dial Pressure Gauge (10 Bar)', shelfLocation: '', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-PSG-01', qtyIn: 3, qtyOut: 0, balanceBefore: 0, balanceAfter: 3, unitCost: 13.5, sellingPrice: 29.95, totalCostImpact: 40.5, movementDate: '2026-04-01T08:00:00Z', notes: 'Gauge opening stock.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-PSG-002', productId: 'prod-press-gauge', sku: 'PSG-B10', alu: 'ALU-PSG-B10', productNumericNumber: '000000008', productName: 'Dial Pressure Gauge (10 Bar)', shelfLocation: '', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-PSG-01', qtyIn: 0, qtyOut: 1, balanceBefore: 3, balanceAfter: 2, unitCost: 13.5, sellingPrice: 29.95, totalCostImpact: -13.5, staffId: 'ST-MARY', staffName: 'Mary Cashier', movementDate: '2026-05-01T11:00:00Z', notes: 'Slow-moving sale over 30 days ago.', riskFlag: 'Low' },
  { ...movementBase, movementId: 'MOV-PSG-003', productId: 'prod-press-gauge', sku: 'PSG-B10', alu: 'ALU-PSG-B10', productNumericNumber: '000000008', productName: 'Dial Pressure Gauge (10 Bar)', shelfLocation: '', movementType: 'STOCKTAKE_ADJUSTMENT_OUT', referenceType: 'STOCKTAKE', referenceNumber: 'STK-PSG-01', qtyIn: 0, qtyOut: 1, balanceBefore: 2, balanceAfter: 1, unitCost: 13.5, sellingPrice: 29.95, totalCostImpact: -13.5, movementDate: '2026-06-02T16:00:00Z', notes: 'Variance risk stocktake adjustment.', riskFlag: 'High' },
  { ...movementBase, movementId: 'MOV-GRE-001', productId: 'prod-cond-grease', sku: 'CON-G50', alu: 'ALU-CON-G50', productNumericNumber: '000000003', productName: 'Conductive Thermal Grease (50g)', shelfLocation: 'B1-LUBRICANTS', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-GRE-01', qtyIn: 12, qtyOut: 0, balanceBefore: 0, balanceAfter: 12, unitCost: 6.2, sellingPrice: 14.95, totalCostImpact: 74.4, movementDate: '2026-05-01T08:00:00Z', notes: 'Grease opening stock.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-GRE-002', productId: 'prod-cond-grease', sku: 'CON-G50', alu: 'ALU-CON-G50', productNumericNumber: '000000003', productName: 'Conductive Thermal Grease (50g)', shelfLocation: 'B1-LUBRICANTS', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-GRE-01', qtyIn: 0, qtyOut: 4, balanceBefore: 12, balanceAfter: 8, unitCost: 6.2, sellingPrice: 14.95, totalCostImpact: -24.8, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-05-05T10:00:00Z', notes: 'Slow-moving lubricant sale.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-STL-001', productId: 'prod-steel-angle', sku: 'STL-A40', alu: 'ALU-STL-A40', productNumericNumber: '000000007', productName: 'Steel Angle Bar 40x40x3mm (2m)', shelfLocation: '', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', movementType: 'OPENING_BALANCE', referenceType: 'MANUAL', referenceNumber: 'OPEN-STL-01', qtyIn: 10, qtyOut: 0, balanceBefore: 0, balanceAfter: 10, unitCost: 11.2, sellingPrice: 22.8, totalCostImpact: 112, movementDate: '2026-05-10T08:00:00Z', notes: 'Harare branch opening stock.', riskFlag: 'None' },
  { ...movementBase, movementId: 'MOV-STL-002', productId: 'prod-steel-angle', sku: 'STL-A40', alu: 'ALU-STL-A40', productNumericNumber: '000000007', productName: 'Steel Angle Bar 40x40x3mm (2m)', shelfLocation: '', branchId: 'BR-HARARE', warehouseId: 'WH-HARARE-01', movementType: 'SALE', referenceType: 'RECEIPT', referenceNumber: 'RCT-STL-01', qtyIn: 0, qtyOut: 10, balanceBefore: 10, balanceAfter: 0, unitCost: 11.2, sellingPrice: 22.8, totalCostImpact: -112, staffId: 'ST-003', staffName: 'John Connor', movementDate: '2026-05-15T14:00:00Z', notes: 'Out of stock after bulk sale.', riskFlag: 'None' }
];

export const mockInventoryMovementRecords: InventoryMovement[] = mockInventoryMovements;

export const mockSuppliers = [
  { id: 'SUP-MOTOR-001', name: 'ABC Motor Spares Supplier' },
  { id: 'SUP-LUBE-002', name: 'Harare Lubricants Ltd' },
  { id: 'SUP-HARD-003', name: 'SCI Hardware Wholesale' },
  { id: 'SUP-ELEC-004', name: 'Metro Electrical Parts' }
];

export const mockCOAAccounts: COAAccount[] = [
  { id: 'COA-1000', accountCode: '1000', accountName: 'Cash on Hand', accountType: 'Asset', linkedDomain: 'Cash', status: 'Active', notes: 'Cash drawer and safe control.' },
  { id: 'COA-1010', accountCode: '1010', accountName: 'EcoCash Control', accountType: 'Asset', linkedDomain: 'EcoCash', status: 'Active' },
  { id: 'COA-1020', accountCode: '1020', accountName: 'Swipe/Card Control', accountType: 'Asset', linkedDomain: 'Swipe', status: 'Active' },
  { id: 'COA-1030', accountCode: '1030', accountName: 'Bank Transfer Control', accountType: 'Asset', linkedDomain: 'Bank', status: 'Active' },
  { id: 'COA-1200', accountCode: '1200', accountName: 'Inventory Asset - General', accountType: 'Asset', linkedDomain: 'Inventory', status: 'Active' },
  { id: 'COA-1210', accountCode: '1210', accountName: 'Inventory Asset - Motor Spares', accountType: 'Asset', linkedDomain: 'Inventory', status: 'Active' },
  { id: 'COA-1220', accountCode: '1220', accountName: 'Inventory Asset - Lubricants', accountType: 'Asset', linkedDomain: 'Inventory', status: 'Active' },
  { id: 'COA-1300', accountCode: '1300', accountName: 'Customer Receivables Placeholder', accountType: 'Asset', linkedDomain: 'Receivables', status: 'Draft' },
  { id: 'COA-4000', accountCode: '4000', accountName: 'Sales Revenue - General', accountType: 'Income', linkedDomain: 'Sales', status: 'Active' },
  { id: 'COA-4010', accountCode: '4010', accountName: 'Sales Revenue - Motor Spares', accountType: 'Income', linkedDomain: 'Sales', status: 'Active' },
  { id: 'COA-4020', accountCode: '4020', accountName: 'Sales Revenue - Lubricants', accountType: 'Income', linkedDomain: 'Sales', status: 'Active' },
  { id: 'COA-5000', accountCode: '5000', accountName: 'Cost of Goods Sold - General', accountType: 'Cost of Sales', linkedDomain: 'COGS', status: 'Active' },
  { id: 'COA-5010', accountCode: '5010', accountName: 'Cost of Goods Sold - Motor Spares', accountType: 'Cost of Sales', linkedDomain: 'COGS', status: 'Active' },
  { id: 'COA-5020', accountCode: '5020', accountName: 'Cost of Goods Sold - Lubricants', accountType: 'Cost of Sales', linkedDomain: 'COGS', status: 'Active' },
  { id: 'COA-2100', accountCode: '2100', accountName: 'VAT Output Control', accountType: 'Tax', linkedDomain: 'VAT', status: 'Draft' },
  { id: 'COA-2110', accountCode: '2110', accountName: 'VAT Input Placeholder', accountType: 'Tax', linkedDomain: 'VAT', status: 'Draft' },
  { id: 'COA-6000', accountCode: '6000', accountName: 'Cash Variance / Shortage', accountType: 'Expense', linkedDomain: 'Cash', status: 'Active' },
  { id: 'COA-6010', accountCode: '6010', accountName: 'Discounts Given', accountType: 'Expense', linkedDomain: 'Discounts', status: 'Active' },
  { id: 'COA-6020', accountCode: '6020', accountName: 'Delivery Expense Placeholder', accountType: 'Expense', linkedDomain: 'Delivery', status: 'Draft' },
  { id: 'COA-9000', accountCode: '9000', accountName: 'Suspense / Review Account', accountType: 'Control', linkedDomain: 'Suspense', status: 'Active' },
  { id: 'COA-9010', accountCode: '9010', accountName: 'Refund Control', accountType: 'Control', linkedDomain: 'Refunds', status: 'Active' },
  { id: 'COA-9020', accountCode: '9020', accountName: 'Void Control', accountType: 'Control', linkedDomain: 'Voids', status: 'Active' }
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
    businessName: 'SCI Logistics Ltd',
    tradingName: 'SCI Auto Spares',
    businessType: 'Retail and Wholesale',
    industrialSector: 'Motor Spares',
    cityTown: 'Harare',
    district: 'Harare CBD',
    suburb: 'Workington',
    legalName: 'APEX INDUSTRIAL CORP',
    taxNo: 'VAT-US-991208',
    regNo: 'REG-552912',
    address: '77 Industrial Parkway, Sector 4',
    country: 'Zimbabwe',
    phoneNumber1: '+263 242 000 001',
    phoneNumber2: '+263 242 000 002',
    phoneNumber3: '',
    whatsAppNumber1: '+263 771 000 001',
    whatsAppNumber2: '+263 772 000 002',
    whatsAppNumber3: '',
    primaryEmail: 'sales@sci.example',
    supportEmail: 'support@sci.example',
    websitePlaceholder: 'https://sci.example',
    isBusinessRegistered: true,
    isRegisteredBusiness: true,
    registeredBusinessName: 'SCI Logistics Ltd',
    companyRegistrationNumber: 'ZW-REG-66291B',
    tradeCertificateRegistrationNumber: 'TC-ZW-44820',
    registrationDate: '2021-04-12',
    registrationPlace: 'Harare, Zimbabwe',
    registrationAuthority: 'Registrar of Companies Zimbabwe',
    taxIdentificationNumber: 'TIN-ZW-82190B',
    vatRegistered: true,
    vatNumber: 'VAT-ZW-82190B',
    taxCollector: true,
    isTaxCollector: true,
    taxCollectorType: 'VAT Withholding Agent',
    taxRegistrationNumber: 'TIN-ZW-82190B',
    taxCollectorName: 'ZIMRA',
    taxCollectorContactNumber: '+263 242 000 999',
    taxCollectorEmail: 'tax@sci.example',
    taxOfficeRegion: 'Harare Region',
    taxNotes: 'VAT returns handled monthly.',
    ownerFullName: 'Tenant Business Owner',
    ownerNationalId: 'ID-PLACEHOLDER',
    ownerNationalIdPlaceholder: 'ID-PLACEHOLDER',
    ownerContact: '+263 773 000 003',
    ownerPhone: '+263 773 000 003',
    ownerWhatsApp: '+263 773 000 003',
    ownerEmail: 'owner@sci.example',
    ownerRoleTitle: 'Managing Director',
    businessAdministratorName: 'Tariro Admin',
    businessAdministratorPhone: '+263 774 000 004',
    administratorEmail: 'admin@sci.example',
    accountantName: 'Nyasha Accountant',
    accountantPhone: '+263 775 000 005',
    accountantEmail: 'accounts@sci.example',
    profileStatus: 'Active',
    profileLastUpdatedAt: '2026-06-13T08:00:00Z',
    profileUpdatedBy: 'SYSTEM',
    currency: 'USD',
    receiptBusinessName: 'SCI Auto Spares',
    receiptFooterMessage: 'Thank you for shopping with SCI.',
    businessStatus: 'Active'
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
    receiptNumber: 'RCT-0005',
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

export const mockDeliveryProviders: DeliveryProvider[] = [
  { providerId: 'DPROV-001', providerName: 'Vendor Bike 01', providerType: 'Vendor Staff', phone: '+263776000001', vehiclePlaceholder: 'Bike ACD-1234', active: true, ratingPlaceholder: 4.6, completedDeliveries: 28, failedDeliveries: 1, cashVarianceCount: 0 },
  { providerId: 'DPROV-002', providerName: 'Vendor Van 01', providerType: 'Vendor Staff', phone: '+263776000002', vehiclePlaceholder: 'Van AEQ-4455', active: true, ratingPlaceholder: 4.3, completedDeliveries: 14, failedDeliveries: 2, cashVarianceCount: 1 },
  { providerId: 'DPROV-003', providerName: 'iDeliver Partner Placeholder 01', providerType: 'iDeliver Partner', phone: '+263780000101', vehiclePlaceholder: 'Partner Bike Placeholder', active: true, ratingPlaceholder: 4.8, completedDeliveries: 42, failedDeliveries: 1, cashVarianceCount: 0 },
  { providerId: 'DPROV-004', providerName: 'iDeliver Partner Placeholder 02', providerType: 'iDeliver Partner', phone: '+263780000102', vehiclePlaceholder: 'Partner Van Placeholder', active: true, ratingPlaceholder: 4.4, completedDeliveries: 19, failedDeliveries: 2, cashVarianceCount: 1 },
  { providerId: 'DPROV-005', providerName: 'External Courier Placeholder', providerType: 'External Courier', phone: '+263780000103', vehiclePlaceholder: 'Courier Fleet Placeholder', active: false, ratingPlaceholder: 3.9, completedDeliveries: 7, failedDeliveries: 1, cashVarianceCount: 1 }
];

export const mockDeliveryRequests: DeliveryRequest[] = [
  { deliveryId: 'DEL-ID-0001', deliveryNumber: 'DEL-0001', vendorId: 'SCI-LOG-ZW', receiptId: 'RCT-ID-0001', receiptNumber: 'RCT-0001', branchId: 'BR-HARARE', branchName: 'Harare Main', terminalId: 'POS-01', cashierStaffId: 'ST-MARY', cashierStaffName: 'Mary Cashier', customerId: 'CUST-TAPIWA', customerName: 'Tapiwa Moyo', customerPhone: '+263771000001', customerWhatsapp: '+263771000001', deliveryMethod: 'Vendor Delivery', deliveryStatus: 'Assigned', priority: 'Normal', deliveryAddress: '22 Rezende Street, 2nd Floor', deliverySuburb: 'CBD', deliveryCityTown: 'Harare', deliveryNotes: 'Fragile. Deliver to 2nd floor office.', deliveryFee: 5, paymentMode: 'Already Paid', cashStatus: 'Not Required', totalReceiptAmount: 127.5, cashToCollect: 0, providerId: 'DPROV-001', providerName: 'Vendor Bike 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000001', confirmationCode: '483921', confirmationStatus: 'Code Sent', trackingStatus: 'Not Started', requestedAt: '2026-06-12T08:10:00Z', assignedAt: '2026-06-12T08:25:00Z', createdAt: '2026-06-12T08:10:00Z', updatedAt: '2026-06-12T08:25:00Z' },
  { deliveryId: 'DEL-ID-0002', deliveryNumber: 'DEL-0002', vendorId: 'SCI-LOG-ZW', receiptId: 'RCT-ID-0002', receiptNumber: 'RCT-0002', branchId: 'BR-HARARE', branchName: 'Harare Main', terminalId: 'POS-01', cashierStaffId: 'ST-MARY', cashierStaffName: 'Mary Cashier', customerName: 'Rudo Ncube', customerPhone: '+263772000002', customerWhatsapp: '+263772000002', deliveryMethod: 'iDeliver Service', deliveryStatus: 'Broadcast To iDeliver', priority: 'High', deliveryAddress: '15 Lobengula Road', deliverySuburb: 'Belmont', deliveryCityTown: 'Bulawayo', deliveryNotes: 'Pending iDeliver provider selection.', deliveryFee: 12, paymentMode: 'Already Paid', cashStatus: 'Not Required', totalReceiptAmount: 244, cashToCollect: 0, confirmationCode: '582941', confirmationStatus: 'Code Sent', trackingStatus: 'Tracking Unavailable', requestedAt: '2026-06-12T09:00:00Z', createdAt: '2026-06-12T09:00:00Z', updatedAt: '2026-06-12T09:05:00Z' },
  { deliveryId: 'DEL-ID-0003', deliveryNumber: 'DEL-0003', vendorId: 'SCI-LOG-ZW', receiptId: 'RCT-ID-0003', receiptNumber: 'RCT-0003', branchId: 'BR-HARARE', branchName: 'Harare Main', terminalId: 'POS-02', cashierStaffId: 'ST-MARY', cashierStaffName: 'Mary Cashier', customerName: 'Farai Sithole', customerPhone: '+263773000003', customerWhatsapp: '+263773000003', deliveryMethod: 'Vendor Delivery', deliveryStatus: 'In Transit', priority: 'Urgent', deliveryAddress: 'Sakubva Market', deliverySuburb: 'Sakubva', deliveryCityTown: 'Mutare', deliveryNotes: 'Cash on delivery pending.', deliveryFee: 8, paymentMode: 'Cash On Delivery', cashStatus: 'Pending Collection', totalReceiptAmount: 86, cashToCollect: 86, providerId: 'DPROV-002', providerName: 'Vendor Van 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000002', confirmationCode: '194725', confirmationStatus: 'Code Sent', trackingStatus: 'En Route', requestedAt: '2026-06-12T09:40:00Z', assignedAt: '2026-06-12T10:00:00Z', pickedUpAt: '2026-06-12T10:20:00Z', createdAt: '2026-06-12T09:40:00Z', updatedAt: '2026-06-12T10:20:00Z' },
  { deliveryId: 'DEL-ID-0004', deliveryNumber: 'DEL-0004', vendorId: 'SCI-LOG-ZW', receiptId: 'RCT-ID-0004', receiptNumber: 'RCT-0004', branchId: 'BR-HARARE', branchName: 'Harare Main', terminalId: 'POS-01', cashierStaffId: 'ST-MARY', cashierStaffName: 'Mary Cashier', customerName: 'Memory Chikore', customerPhone: '+263774000004', customerWhatsapp: '+263774000004', deliveryMethod: 'Vendor Delivery', deliveryStatus: 'Delivered', priority: 'Normal', deliveryAddress: 'Unit L, Seke', deliverySuburb: 'Seke', deliveryCityTown: 'Chitungwiza', deliveryNotes: 'Code verified and cash confirmed.', deliveryFee: 10, paymentMode: 'Delivery Fee Cash', cashStatus: 'Confirmed By Vendor', totalReceiptAmount: 139, cashToCollect: 10, providerId: 'DPROV-001', providerName: 'Vendor Bike 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000001', confirmationCode: '739115', confirmationStatus: 'Code Verified', trackingStatus: 'Completed', requestedAt: '2026-06-12T07:50:00Z', assignedAt: '2026-06-12T08:00:00Z', pickedUpAt: '2026-06-12T08:25:00Z', deliveredAt: '2026-06-12T09:15:00Z', verifiedAt: '2026-06-12T09:15:00Z', verifiedByStaffId: 'ST-TAWANDA', createdAt: '2026-06-12T07:50:00Z', updatedAt: '2026-06-12T09:20:00Z' },
  { deliveryId: 'DEL-ID-0005', deliveryNumber: 'DEL-0005', vendorId: 'SCI-LOG-ZW', receiptId: 'RCT-ID-0005', receiptNumber: 'RCT-0005', branchId: 'BR-HARARE', branchName: 'Harare Main', terminalId: 'POS-02', cashierStaffId: 'ST-MARY', cashierStaffName: 'Mary Cashier', customerName: 'Brian Dube', customerPhone: '+263775000005', customerWhatsapp: '+263775000005', deliveryMethod: 'Vendor Delivery', deliveryStatus: 'Delivery Failed', priority: 'High', deliveryAddress: 'Harare South', deliverySuburb: 'Mbare', deliveryCityTown: 'Harare', deliveryNotes: 'Customer unavailable. Follow-up required.', deliveryFee: 7, paymentMode: 'Already Paid', cashStatus: 'Not Required', totalReceiptAmount: 65, cashToCollect: 0, providerId: 'DPROV-002', providerName: 'Vendor Van 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000002', confirmationCode: '650482', confirmationStatus: 'Code Sent', trackingStatus: 'Delayed', requestedAt: '2026-06-12T08:45:00Z', assignedAt: '2026-06-12T09:10:00Z', pickedUpAt: '2026-06-12T09:35:00Z', failureReason: 'Customer unavailable', createdAt: '2026-06-12T08:45:00Z', updatedAt: '2026-06-12T11:10:00Z' }
];

export const mockDeliveryRequestLines: DeliveryRequestLine[] = [
  { lineId: 'DLL-0001', deliveryId: 'DEL-ID-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', qty: 2, receiptLineId: 'RCT-LINE-0001', lineStatus: 'Ready For Delivery', notes: 'Packed.' },
  { lineId: 'DLL-0002', deliveryId: 'DEL-ID-0002', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', qty: 1, receiptLineId: 'RCT-LINE-0002', lineStatus: 'Ready For iDeliver', notes: 'Broadcast payload item.' },
  { lineId: 'DLL-0003', deliveryId: 'DEL-ID-0003', productId: 'STOCK-P-12', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', qty: 3, receiptLineId: 'RCT-LINE-0003', lineStatus: 'In Transit', notes: 'Cash to collect on arrival.' },
  { lineId: 'DLL-0004', deliveryId: 'DEL-ID-0004', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', qty: 1, receiptLineId: 'RCT-LINE-0004', lineStatus: 'Delivered', notes: 'Confirmed.' },
  { lineId: 'DLL-0005', deliveryId: 'DEL-ID-0005', productId: 'STOCK-P-HILUX-MIR-RC', sku: 'MIR-GD6-RC', productName: 'Toyota Hilux GD6 Mirror Right Chrome', qty: 1, receiptLineId: 'RCT-LINE-0005', lineStatus: 'Failed Delivery', notes: 'Returned to branch pending review.' }
];

export const mockDeliveryAssignments: DeliveryAssignment[] = [
  { assignmentId: 'DASS-0001', deliveryId: 'DEL-ID-0001', providerId: 'DPROV-001', providerName: 'Vendor Bike 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000001', vehiclePlaceholder: 'Bike ACD-1234', assignedAt: '2026-06-12T08:25:00Z', assignedByStaffId: 'ST-MANAGER' },
  { assignmentId: 'DASS-0003', deliveryId: 'DEL-ID-0003', providerId: 'DPROV-002', providerName: 'Vendor Van 01', driverStaffId: 'ST-TAWANDA', driverName: 'Tawanda', driverPhone: '+263776000002', vehiclePlaceholder: 'Van AEQ-4455', assignedAt: '2026-06-12T10:00:00Z', acceptedAt: '2026-06-12T10:05:00Z', assignedByStaffId: 'ST-MANAGER' }
];

export const mockDeliveryTrackingEvents: DeliveryTrackingEvent[] = [
  { trackingEventId: 'DTRK-0001', deliveryId: 'DEL-ID-0003', dateTime: '2026-06-12T10:20:00Z', status: 'En Route', locationText: 'Leaving Harare Main', latitudePlaceholder: '-17.8249', longitudePlaceholder: '31.0530', notes: 'Google Maps live tracking integration will be connected later.', updatedByStaffId: 'ST-TAWANDA' },
  { trackingEventId: 'DTRK-0002', deliveryId: 'DEL-ID-0004', dateTime: '2026-06-12T09:15:00Z', status: 'Completed', locationText: 'Customer address confirmed', latitudePlaceholder: '-18.0127', longitudePlaceholder: '31.0756', notes: 'Delivered and verified.', updatedByStaffId: 'ST-TAWANDA' }
];

export const mockDeliveryConfirmationCodes: DeliveryConfirmationCode[] = mockDeliveryRequests.map((delivery) => ({
  codeId: `DCODE-${delivery.deliveryNumber}`,
  deliveryId: delivery.deliveryId,
  code: delivery.confirmationCode,
  status: delivery.confirmationStatus,
  sentToCustomer: delivery.confirmationStatus !== 'Code Pending',
  attempts: delivery.confirmationStatus === 'Code Failed' ? 1 : 0,
  verifiedAt: delivery.verifiedAt,
  verifiedByStaffId: delivery.verifiedByStaffId,
  createdAt: delivery.createdAt
}));

export const mockDeliveryCashCollections: DeliveryCashCollection[] = [
  { cashCollectionId: 'DCASH-0003', deliveryId: 'DEL-ID-0003', paymentMode: 'Cash On Delivery', cashToCollect: 86, deliveryFeeCash: 0, amountCollectedByDriver: 0, driverCollectionNotes: 'Pending arrival.', vendorCashConfirmed: false, vendorConfirmedAmount: 0, cashVariance: 0, cashStatus: 'Pending Collection', updatedAt: '2026-06-12T10:20:00Z' },
  { cashCollectionId: 'DCASH-0004', deliveryId: 'DEL-ID-0004', paymentMode: 'Delivery Fee Cash', cashToCollect: 10, deliveryFeeCash: 10, amountCollectedByDriver: 10, driverCollectionNotes: 'Delivery fee cash collected.', vendorCashConfirmed: true, vendorConfirmedAmount: 10, cashVariance: 0, cashStatus: 'Confirmed By Vendor', updatedAt: '2026-06-12T09:20:00Z' }
];

export const mockDeliveryActivityEvents: DeliveryActivityEvent[] = [
  { id: 'DACT-0001', deliveryId: 'DEL-ID-0001', deliveryNumber: 'DEL-0001', receiptNumber: 'RCT-0001', eventType: 'DELIVERY_DRIVER_ASSIGNED', message: 'Vendor driver assigned.', staffId: 'ST-MANAGER', createdAt: '2026-06-12T08:25:00Z' },
  { id: 'DACT-0002', deliveryId: 'DEL-ID-0002', deliveryNumber: 'DEL-0002', receiptNumber: 'RCT-0002', eventType: 'DELIVERY_BROADCAST_TO_IDELIVER', message: 'iDeliver broadcast placeholder prepared.', staffId: 'ST-MARY', createdAt: '2026-06-12T09:05:00Z' },
  { id: 'DACT-0003', deliveryId: 'DEL-ID-0003', deliveryNumber: 'DEL-0003', receiptNumber: 'RCT-0003', eventType: 'DELIVERY_IN_TRANSIT', message: 'Delivery is in transit with cash pending collection.', staffId: 'ST-TAWANDA', createdAt: '2026-06-12T10:20:00Z' },
  { id: 'DACT-0004', deliveryId: 'DEL-ID-0004', deliveryNumber: 'DEL-0004', receiptNumber: 'RCT-0004', eventType: 'DELIVERY_COMPLETED', message: 'Delivery completed, code verified, cash confirmed.', staffId: 'ST-TAWANDA', createdAt: '2026-06-12T09:20:00Z' },
  { id: 'DACT-0005', deliveryId: 'DEL-ID-0005', deliveryNumber: 'DEL-0005', receiptNumber: 'RCT-0005', eventType: 'DELIVERY_FAILED', message: 'Delivery failed because customer was unavailable.', staffId: 'ST-TAWANDA', createdAt: '2026-06-12T11:10:00Z' }
];

export const mockDeliveryWhatsAppMessageDrafts: DeliveryWhatsAppMessageDraft[] = [
  { draftId: 'DWA-0001', deliveryId: 'DEL-ID-0001', messageType: 'Customer Code', recipient: '+263771000001', messageText: 'Hello Tapiwa Moyo, your order RCT-0001 is ready for delivery. Your delivery confirmation code is 483921. Please give this code to the delivery person only after receiving your goods.', createdAt: '2026-06-12T08:11:00Z', status: 'Prepared' },
  { draftId: 'DWA-0002', deliveryId: 'DEL-ID-0003', messageType: 'Driver Assignment', recipient: '+263776000002', messageText: 'Delivery assigned: DEL-0003. Customer: Farai Sithole. Address: Sakubva Market. Receipt: RCT-0003. Cash to collect: 86.', createdAt: '2026-06-12T10:00:00Z', status: 'Prepared' }
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

export const mockOfflineSyncQueue: OfflineSyncQueueItem[] = [
  {
    queueId: 'SYNC-Q-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    entityType: 'Sale',
    entityId: 'SALE-OFF-0001',
    entityNumber: 'RCT-OFF-0001',
    operationType: 'CREATE_RECEIPT_PAYMENT',
    payload: { receiptNumber: 'RCT-OFF-0001', total: 142.5, paymentMode: 'Cash', items: 3, offlineCompleted: true },
    payloadHash: 'HASH-4E0D3A91',
    localVersion: 1,
    priority: 'High',
    status: 'Ready To Sync',
    retryCount: 0,
    queuedAt: '2026-06-12T07:45:00Z',
    notes: 'Sale receipt queued from POS-01. No backend sync in this build.'
  },
  {
    queueId: 'SYNC-Q-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    entityType: 'Delivery Request',
    entityId: 'DEL-OFF-0002',
    entityNumber: 'DEL-OFF-0002',
    operationType: 'CREATE_DELIVERY_REQUEST',
    payload: { receiptNumber: 'RCT-OFF-0001', customerName: 'Tapiwa Moyo', method: 'Vendor Delivery', whatsappDraftReady: true },
    payloadHash: 'HASH-11892EAF',
    localVersion: 1,
    priority: 'Normal',
    status: 'Queued',
    retryCount: 0,
    queuedAt: '2026-06-12T07:47:00Z',
    notes: 'Delivery request queued locally. WhatsApp draft remains local.'
  },
  {
    queueId: 'SYNC-Q-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'BACK-01',
    staffId: 'ST-BLESSING',
    staffName: 'Blessing Stock',
    entityType: 'Stock Adjustment',
    entityId: 'STA-OFF-0003',
    entityNumber: 'STA-OFF-0003',
    operationType: 'POST_STOCK_ADJUSTMENT',
    payload: { sku: 'CLT-N16', qtyOut: 2, reason: 'Damaged stock found during offline count', balanceBefore: 4 },
    payloadHash: 'HASH-7C12D9F0',
    localVersion: 2,
    remoteVersion: 3,
    priority: 'Critical',
    status: 'Conflict',
    retryCount: 1,
    lastError: 'Remote stock balance changed while terminal was offline.',
    conflictId: 'SYNC-CF-0002',
    queuedAt: '2026-06-12T08:05:00Z',
    lastAttemptAt: '2026-06-12T08:20:00Z',
    notes: 'Conflict due to Stock Quantity Conflict.'
  },
  {
    queueId: 'SYNC-Q-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    entityType: 'Customer Request',
    entityId: 'CUST-OFF-0004',
    entityNumber: 'PEND-CUST-0004',
    operationType: 'CREATE_CUSTOMER_REQUEST',
    payload: { customerName: 'Farai Sithole', phone: '+263771000001', source: 'Sales Terminal' },
    payloadHash: 'HASH-451B9A3C',
    localVersion: 1,
    remoteVersion: 1,
    priority: 'High',
    status: 'Failed',
    retryCount: 2,
    lastError: 'Duplicate phone detected during placeholder validation.',
    conflictId: 'SYNC-CF-0003',
    queuedAt: '2026-06-12T08:22:00Z',
    lastAttemptAt: '2026-06-12T08:44:00Z'
  },
  {
    queueId: 'SYNC-Q-0005',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    entityType: 'BI Event',
    entityId: 'BI-OFF-0005',
    entityNumber: 'SALE_COMPLETED_LOCAL',
    operationType: 'CREATE_BI_EVENT',
    payload: { eventType: 'SALE_COMPLETED_LOCAL', receiptNumber: 'RCT-OFF-0001', severity: 'INFO' },
    payloadHash: 'HASH-0AA88191',
    localVersion: 1,
    priority: 'Low',
    status: 'Synced',
    retryCount: 0,
    queuedAt: '2026-06-12T08:30:00Z',
    lastAttemptAt: '2026-06-12T08:35:00Z',
    syncedAt: '2026-06-12T08:35:00Z',
    notes: 'Synced placeholder only. No backend call was made.'
  },
  {
    queueId: 'SYNC-Q-0006',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    staffId: 'ST-MARY',
    staffName: 'Mary Cashier',
    entityType: 'Shift Session',
    entityId: 'SHIFT-OFF-0006',
    entityNumber: 'SHIFT-POS-01-20260612',
    operationType: 'CLOSE_SHIFT',
    payload: { shiftId: 'SHIFT-POS-01-20260612', expectedCash: 612.5, declaredCash: 612.5, closedOffline: true },
    payloadHash: 'HASH-98ED2B15',
    localVersion: 1,
    priority: 'Critical',
    status: 'Held For Review',
    retryCount: 0,
    conflictId: 'SYNC-CF-0004',
    queuedAt: '2026-06-12T09:00:00Z',
    notes: 'Shift close queued and held because remote state may already be closed.'
  }
];

export const mockOfflineSyncBatches: OfflineSyncBatch[] = [
  {
    batchId: 'SYNC-B-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    createdByStaffId: 'ST-ADMIN',
    createdByStaffName: 'Admin User',
    itemCount: 3,
    highPriorityCount: 1,
    failedCount: 0,
    conflictCount: 0,
    status: 'Ready To Sync',
    createdAt: '2026-06-12T08:40:00Z',
    notes: 'Prepared locally for placeholder sync run.'
  },
  {
    batchId: 'SYNC-B-0002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'BACK-01',
    createdByStaffId: 'ST-BLESSING',
    createdByStaffName: 'Blessing Stock',
    itemCount: 2,
    highPriorityCount: 2,
    failedCount: 1,
    conflictCount: 1,
    status: 'Held For Review',
    createdAt: '2026-06-12T09:05:00Z',
    notes: 'Inventory and shift items require review before placeholder run.'
  }
];

export const mockOfflineSyncConflicts: OfflineSyncConflict[] = [
  {
    conflictId: 'SYNC-CF-0001',
    queueId: 'SYNC-Q-0001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    entityType: 'Receipt',
    entityId: 'SALE-OFF-0001',
    entityNumber: 'RCT-OFF-0001',
    conflictType: 'Duplicate Receipt',
    localPayload: { receiptNumber: 'RCT-OFF-0001', terminalId: 'POS-01', total: 142.5 },
    remotePayload: { receiptNumber: 'RCT-OFF-0001', terminalId: 'POS-02', total: 88 },
    localVersion: 1,
    remoteVersion: 1,
    detectedAt: '2026-06-12T08:05:00Z',
    status: 'Conflict',
    recommendedResolution: 'Manual Review Required',
    riskLevel: 'Critical',
    notes: 'Duplicate receipt number found in placeholder remote snapshot.'
  },
  {
    conflictId: 'SYNC-CF-0002',
    queueId: 'SYNC-Q-0003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'BACK-01',
    entityType: 'Stock Adjustment',
    entityId: 'STA-OFF-0003',
    entityNumber: 'STA-OFF-0003',
    conflictType: 'Stock Quantity Conflict',
    localPayload: { sku: 'CLT-N16', qtyOut: 2, balanceBefore: 4 },
    remotePayload: { sku: 'CLT-N16', qtyOnHand: 1, lastMovement: 'SALE RCT-0012' },
    localVersion: 2,
    remoteVersion: 3,
    detectedAt: '2026-06-12T08:20:00Z',
    status: 'Conflict',
    recommendedResolution: 'Hold For Review',
    riskLevel: 'High',
    notes: 'Stock balance changed remotely before offline adjustment was reviewed.'
  },
  {
    conflictId: 'SYNC-CF-0003',
    queueId: 'SYNC-Q-0004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    entityType: 'Customer Request',
    entityId: 'CUST-OFF-0004',
    entityNumber: 'PEND-CUST-0004',
    conflictType: 'Customer Duplicate',
    localPayload: { customerName: 'Farai Sithole', phone: '+263771000001' },
    remotePayload: { customerId: 'CUST-0001', customerName: 'Tapiwa Moyo', phone: '+263771000001' },
    localVersion: 1,
    remoteVersion: 1,
    detectedAt: '2026-06-12T08:44:00Z',
    status: 'Conflict',
    recommendedResolution: 'Merge',
    riskLevel: 'Medium',
    notes: 'Duplicate phone conflict from customer request.'
  },
  {
    conflictId: 'SYNC-CF-0004',
    queueId: 'SYNC-Q-0006',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    terminalId: 'POS-01',
    entityType: 'Shift Session',
    entityId: 'SHIFT-OFF-0006',
    entityNumber: 'SHIFT-POS-01-20260612',
    conflictType: 'Shift Closed Remotely',
    localPayload: { shiftId: 'SHIFT-POS-01-20260612', declaredCash: 612.5 },
    remotePayload: { shiftId: 'SHIFT-POS-01-20260612', status: 'Closed', declaredCash: 610 },
    localVersion: 1,
    remoteVersion: 2,
    detectedAt: '2026-06-12T09:00:00Z',
    status: 'Held For Review',
    recommendedResolution: 'Manual Review Required',
    riskLevel: 'Critical',
    notes: 'Remote shift close exists. Owner review required.'
  }
];

export const mockOfflineSyncConflictDecisions: OfflineSyncConflictDecision[] = [
  {
    decisionId: 'SYNC-CD-0001',
    conflictId: 'SYNC-CF-0003',
    queueId: 'SYNC-Q-0004',
    resolution: 'Hold For Review',
    decidedByStaffId: 'ST-ADMIN',
    decidedByStaffName: 'Admin User',
    reason: 'Customer phone duplicate needs manual merge review.',
    decidedAt: '2026-06-12T08:50:00Z'
  }
];

export const mockOfflineSyncHealth: OfflineSyncHealth[] = [
  { terminalId: 'POS-01', terminalName: 'POS-01 Harare Front Counter', branchId: 'BR-HARARE', branchName: 'Harare Main', networkStatus: 'Unstable', lastSyncAt: '2026-06-12T08:35:00Z', queueCount: 5, failedCount: 1, conflictCount: 3, localStorageStatus: 'Available', syncHealth: 'Warning' },
  { terminalId: 'BACK-01', terminalName: 'BACK-01 Harare Back Office', branchId: 'BR-HARARE', branchName: 'Harare Main', networkStatus: 'Online', lastSyncAt: '2026-06-12T08:10:00Z', queueCount: 1, failedCount: 0, conflictCount: 1, localStorageStatus: 'Available', syncHealth: 'Critical' },
  { terminalId: 'POS-02', terminalName: 'POS-02 Bulawayo Counter', branchId: 'BR-BYO', branchName: 'Bulawayo Branch', networkStatus: 'Offline', queueCount: 0, failedCount: 0, conflictCount: 0, localStorageStatus: 'Unknown', syncHealth: 'Offline' }
];

export const mockOfflineSyncActivityEvents: OfflineSyncActivityEvent[] = [
  { eventId: 'SYNC-ACT-0001', eventType: 'OFFLINE_ACTION_QUEUED', queueId: 'SYNC-Q-0001', message: 'Offline sale receipt queued locally.', staffId: 'ST-MARY', staffName: 'Mary Cashier', terminalId: 'POS-01', branchId: 'BR-HARARE', createdAt: '2026-06-12T07:45:00Z' },
  { eventId: 'SYNC-ACT-0002', eventType: 'SYNC_BATCH_CREATED', batchId: 'SYNC-B-0001', message: 'Local sync batch created from ready POS-01 items.', staffId: 'ST-ADMIN', staffName: 'Admin User', terminalId: 'POS-01', branchId: 'BR-HARARE', createdAt: '2026-06-12T08:40:00Z' },
  { eventId: 'SYNC-ACT-0003', eventType: 'SYNC_CONFLICT_DETECTED', queueId: 'SYNC-Q-0003', conflictId: 'SYNC-CF-0002', message: 'Stock quantity conflict detected and displayed for review.', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', terminalId: 'BACK-01', branchId: 'BR-HARARE', createdAt: '2026-06-12T08:20:00Z' },
  { eventId: 'SYNC-ACT-0004', eventType: 'SYNC_ITEM_FAILED', queueId: 'SYNC-Q-0004', message: 'Customer request failed placeholder validation because duplicate phone was detected.', staffId: 'ST-MARY', staffName: 'Mary Cashier', terminalId: 'POS-01', branchId: 'BR-HARARE', createdAt: '2026-06-12T08:44:00Z' },
  { eventId: 'SYNC-ACT-0005', eventType: 'LOCAL_SNAPSHOT_CREATED', message: 'Terminal local snapshot created for POS-01.', staffId: 'ST-ADMIN', staffName: 'Admin User', terminalId: 'POS-01', branchId: 'BR-HARARE', createdAt: '2026-06-12T09:05:00Z' }
];

export const mockLocalTerminalSnapshots: LocalTerminalSnapshot[] = [
  { snapshotId: 'SNAP-POS-01-001', terminalId: 'POS-01', terminalName: 'POS-01 Harare Front Counter', branchId: 'BR-HARARE', branchName: 'Harare Main', staffId: 'ST-MARY', staffName: 'Mary Cashier', openShiftId: 'SHIFT-POS-01-20260612', localReceipts: 2, localCustomers: 1, localDeliveries: 1, localInventoryEvents: 0, localBIEvents: 4, lastSnapshotAt: '2026-06-12T09:05:00Z', storageEstimate: '148 KB' },
  { snapshotId: 'SNAP-BACK-01-001', terminalId: 'BACK-01', terminalName: 'BACK-01 Harare Back Office', branchId: 'BR-HARARE', branchName: 'Harare Main', staffId: 'ST-BLESSING', staffName: 'Blessing Stock', openShiftId: 'SSC-BACK-01-20260611', localReceipts: 0, localCustomers: 0, localDeliveries: 0, localInventoryEvents: 3, localBIEvents: 2, lastSnapshotAt: '2026-06-12T08:55:00Z', storageEstimate: '96 KB' },
  { snapshotId: 'SNAP-POS-02-001', terminalId: 'POS-02', terminalName: 'POS-02 Bulawayo Counter', branchId: 'BR-BYO', branchName: 'Bulawayo Branch', staffId: 'ST-TAWANDA', staffName: 'Tawanda Supervisor', localReceipts: 0, localCustomers: 0, localDeliveries: 0, localInventoryEvents: 0, localBIEvents: 1, lastSnapshotAt: '2026-06-12T07:30:00Z', storageEstimate: '28 KB' }
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

export const mockEODSession: EODSession = {
  id: 'EOD-2026-06-09-SCI-LOG-ZW',
  vendorId: 'SCI-LOG-ZW',
  businessVendor: 'Demo Vendor',
  businessDate: '2026-06-09',
  branch: 'Harare Main',
  status: 'Blocked',
  lastCheckTime: '2026-06-09T14:10:00Z',
  todaySales: 1245,
  netReceipts: 1227,
  cashExpected: 760,
  cashDeclared: 755,
  cashVariance: -5,
  refunds: 10,
  voids: 1,
  openShifts: 1,
  pendingStockMovements: 3,
  pendingDeliveries: 2,
  criticalBIAlerts: 3,
  syncPendingItems: 23
};

export const mockEODChecklistItems: EODChecklistItem[] = [
  { id: 'EOD-CHK-001', check: 'All shifts closed', label: 'All shifts closed', domain: 'Shift', status: 'Warning', risk: 'Medium', requiredAction: 'Close remaining open shift', reviewedBy: '', ownerAction: 'Review shifts', notes: 'POS-01 remains open.' },
  { id: 'EOD-CHK-002', check: 'Cash declared for all terminals', label: 'Cash declared for all terminals', domain: 'Cash', status: 'Passed', risk: 'Low', requiredAction: 'None', reviewedBy: 'Tawanda Supervisor', ownerAction: 'View declarations', notes: 'Declarations found for closed registers.' },
  { id: 'EOD-CHK-003', check: 'Cash variances reviewed', label: 'Cash variances reviewed', domain: 'Cash', status: 'Failed', risk: 'High', requiredAction: 'Supervisor/Owner review required', reviewedBy: '', ownerAction: 'Review variance', notes: 'USD -5.00 variance requires owner signoff.' },
  { id: 'EOD-CHK-004', check: 'Refunds reviewed', label: 'Refunds reviewed', domain: 'Sales', status: 'Pending', risk: 'High', requiredAction: 'Review refund requests', reviewedBy: '', ownerAction: 'Review refunds', notes: 'Refund queue awaiting decision.' },
  { id: 'EOD-CHK-005', check: 'Voids reviewed', label: 'Voids reviewed', domain: 'Sales', status: 'Pending', risk: 'High', requiredAction: 'Review void requests', reviewedBy: '', ownerAction: 'Review voids', notes: 'Void queue awaiting decision.' },
  { id: 'EOD-CHK-006', check: 'Inventory movements posted', label: 'Inventory movements posted', domain: 'Inventory', status: 'Warning', risk: 'Medium', requiredAction: 'Review pending stock movements', reviewedBy: '', ownerAction: 'Open stock review', notes: 'Three stock movement records need review.' },
  { id: 'EOD-CHK-007', check: 'Stocktake variances reviewed', label: 'Stocktake variances reviewed', domain: 'Inventory', status: 'Warning', risk: 'High', requiredAction: 'Review stocktake adjustments', reviewedBy: '', ownerAction: 'Open stocktake', notes: 'One adjustment remains open.' },
  { id: 'EOD-CHK-008', check: 'GRN variances reviewed', label: 'GRN variances reviewed', domain: 'Purchasing', status: 'Warning', risk: 'High', requiredAction: 'Review receiving variance', reviewedBy: '', ownerAction: 'Review GRNs', notes: 'Supplier variance needs confirmation.' },
  { id: 'EOD-CHK-009', check: 'Delivery codes confirmed', label: 'Delivery codes confirmed', domain: 'Delivery', status: 'Passed', risk: 'Low', requiredAction: 'None', reviewedBy: 'Admin User', ownerAction: 'View delivery codes', notes: 'Completed delivery codes verified.' },
  { id: 'EOD-CHK-010', check: 'Failed deliveries reviewed', label: 'Failed deliveries reviewed', domain: 'Delivery', status: 'Warning', risk: 'Medium', requiredAction: 'Follow up failed delivery', reviewedBy: '', ownerAction: 'Review failures', notes: 'DEL-005 remains open.' },
  { id: 'EOD-CHK-011', check: 'Sync queue checked', label: 'Sync queue checked', domain: 'Sync', status: 'Failed', risk: 'Critical', requiredAction: 'Run sync check', reviewedBy: '', ownerAction: 'Review sync queue', notes: '23 items pending sync.' },
  { id: 'EOD-CHK-012', check: 'Critical BI alerts reviewed', label: 'Critical BI alerts reviewed', domain: 'BI', status: 'Failed', risk: 'Critical', requiredAction: 'Owner review required', reviewedBy: '', ownerAction: 'Review BI alerts', notes: 'Critical alerts are not reviewed.' },
  { id: 'EOD-CHK-013', check: 'Receipt sequence checked', label: 'Receipt sequence checked', domain: 'Sales', status: 'Passed', risk: 'Low', requiredAction: 'None', reviewedBy: 'Admin User', ownerAction: 'View sequence', notes: 'Receipt sequence has no duplicate flags.' }
];

export const mockEODPaymentSummary: EODPaymentSummary[] = [
  { id: 'EOD-PAY-001', paymentMode: 'Cash', receiptCount: 18, grossAmount: 760, discounts: 0, refunds: 10, netAmount: 750, expectedSettlement: 760, declaredOrConfirmed: 755, variance: -5, status: 'Variance' },
  { id: 'EOD-PAY-002', paymentMode: 'EcoCash', receiptCount: 8, grossAmount: 320, discounts: 0, refunds: 0, netAmount: 320, expectedSettlement: 320, declaredOrConfirmed: 320, variance: 0, status: 'Balanced' },
  { id: 'EOD-PAY-003', paymentMode: 'Swipe', receiptCount: 5, grossAmount: 215, discounts: 0, refunds: 0, netAmount: 215, expectedSettlement: 215, declaredOrConfirmed: 215, variance: 0, status: 'Balanced' },
  { id: 'EOD-PAY-004', paymentMode: 'Bank Transfer', receiptCount: 3, grossAmount: 480, discounts: 20, refunds: 0, netAmount: 460, expectedSettlement: 460, declaredOrConfirmed: 'Pending', variance: 'Pending', status: 'Review' },
  { id: 'EOD-PAY-005', paymentMode: 'Split Payment', receiptCount: 2, grossAmount: 210, discounts: 10, refunds: 0, netAmount: 200, expectedSettlement: 200, declaredOrConfirmed: 200, variance: 0, status: 'Balanced' },
  { id: 'EOD-PAY-006', paymentMode: 'Credit Sale', receiptCount: 1, grossAmount: 90, discounts: 0, refunds: 0, netAmount: 90, expectedSettlement: 90, declaredOrConfirmed: 90, variance: 0, status: 'Balanced' },
  { id: 'EOD-PAY-007', paymentMode: 'Store Credit', receiptCount: 1, grossAmount: 42, discounts: 0, refunds: 0, netAmount: 42, expectedSettlement: 42, declaredOrConfirmed: 42, variance: 0, status: 'Balanced' }
];

export const mockEODShiftSummaries: EODShiftSummary[] = [
  { id: 'EOD-SHIFT-001', shiftId: 'SH-001', branch: 'Harare Main', terminal: 'POS-01', staff: 'Mary Cashier', openedAt: '2026-06-09T08:00:00Z', closedAt: 'Open', status: 'Open', salesTotal: 710, expectedCash: 800, declaredCash: 'Pending', variance: 'Pending', syncStatus: 'Pending Sync' },
  { id: 'EOD-SHIFT-002', shiftId: 'SH-002', branch: 'Harare Main', terminal: 'POS-02', staff: 'Tawanda Supervisor', openedAt: '2026-06-09T08:30:00Z', closedAt: '2026-06-09T15:10:00Z', status: 'Closed', salesTotal: 315, expectedCash: 220, declaredCash: 220, variance: 0, syncStatus: 'Synced', reviewedBy: 'Admin User' },
  { id: 'EOD-SHIFT-003', shiftId: 'SH-003', branch: 'Harare Main', terminal: 'BACK-01', staff: 'Admin User', openedAt: '2026-06-09T09:00:00Z', closedAt: '2026-06-09T14:45:00Z', status: 'Closed', salesTotal: 220, expectedCash: 115, declaredCash: 115, variance: 0, syncStatus: 'Conflict' }
];

export const mockEODCashReconciliationRows: EODCashReconciliation[] = [
  { id: 'EOD-CASH-001', branch: 'Harare Main', terminal: 'POS-01', cashier: 'Mary Cashier', shiftId: 'SH-001', openingFloat: 50, cashSales: 710, cashIn: 80, cashOut: 40, expectedCash: 800, declaredCash: 795, variance: -5, status: 'Variance', requiredAction: 'Owner review' },
  { id: 'EOD-CASH-002', branch: 'Harare Main', terminal: 'POS-02', cashier: 'Tawanda Supervisor', shiftId: 'SH-002', openingFloat: 30, cashSales: 220, cashIn: 0, cashOut: 30, expectedCash: 220, declaredCash: 220, variance: 0, status: 'Balanced', requiredAction: 'None', reviewedBy: 'Tawanda Supervisor' },
  { id: 'EOD-CASH-003', branch: 'Harare Main', terminal: 'BACK-01', cashier: 'Admin User', shiftId: 'SH-003', openingFloat: 20, cashSales: 120, cashIn: 0, cashOut: 25, expectedCash: 115, declaredCash: 115, variance: 0, status: 'Balanced', requiredAction: 'None', reviewedBy: 'Admin User' }
];

export const mockEODInventoryClosingRows: EODInventoryClosingRow[] = [
  { id: 'EOD-INV-001', movementId: 'MOV-0001', product: '10W-40 Engine Oil 5L', movementType: 'Sale', reference: 'RCT-0001', branch: 'Harare Main', warehouse: 'Main Sales Floor', qtyIn: 0, qtyOut: 2, status: 'Posted', risk: 'Low', requiredAction: 'None', reviewedBy: 'Blessing Stock' },
  { id: 'EOD-INV-002', movementId: 'MOV-0002', product: 'Truck Brake Pad Set', movementType: 'Goods Received', reference: 'GRN-0042', branch: 'Harare Main', warehouse: 'Back Store', qtyIn: 12, qtyOut: 0, status: 'Pending Approval', risk: 'High', requiredAction: 'Open Approval Placeholder' },
  { id: 'EOD-INV-003', movementId: 'MOV-0003', product: 'Hydraulic Hose 2m', movementType: 'Stock Adjustment', reference: 'ADJ-0018', branch: 'Bulawayo Branch', warehouse: 'Bulawayo Warehouse', qtyIn: 0, qtyOut: 1, status: 'Pending Approval', risk: 'High', requiredAction: 'Mark Reviewed' },
  { id: 'EOD-INV-004', movementId: 'MOV-0004', product: 'Alternator 24V', movementType: 'Supplier Return', reference: 'SRET-0007', branch: 'Mutare Branch', warehouse: 'Mutare Store', qtyIn: 0, qtyOut: 1, status: 'Reversed', risk: 'Medium', requiredAction: 'Keep in audit trail' }
];

export const mockEODDeliveryClosingRows: EODDeliveryClosingRow[] = [
  { id: 'EOD-DEL-001', deliveryId: 'DEL-001', branch: 'Harare Main', receipt: 'RCT-0002', customer: 'WhatsApp Customer', deliveryMethod: 'Bike Delivery', driver: 'Mike Delivery', status: 'Completed', secretCodeStatus: 'Confirmed', completedAt: '2026-06-09T12:10:00Z', risk: 'Low', requiredAction: 'None', reviewedBy: 'Admin User' },
  { id: 'EOD-DEL-002', deliveryId: 'DEL-005', branch: 'Harare Main', receipt: 'RCT-0006', customer: 'Rudo Ncube', deliveryMethod: 'Van Delivery', driver: 'Tapiwa Driver', status: 'Failed', secretCodeStatus: 'Pending', completedAt: 'Not completed', risk: 'Medium', requiredAction: 'Follow up failed delivery' },
  { id: 'EOD-DEL-003', deliveryId: 'DEL-006', branch: 'Bulawayo Branch', receipt: 'RCT-0007', customer: 'Tafadzwa M.', deliveryMethod: 'Customer Collection', driver: 'Counter', status: 'Pending', secretCodeStatus: 'Pending', completedAt: 'Pending', risk: 'Medium', requiredAction: 'Confirm collection code' }
];

export const mockEODBIReviewItems: EODBIReviewItem[] = [
  { id: 'EOD-BI-001', eventType: 'CASH_VARIANCE_FOUND', domain: 'Cash', severity: 'High', description: 'Drawer short by USD 5.00.', recommendedAction: 'Review cash declaration and add owner note.', status: 'Open' },
  { id: 'EOD-BI-002', eventType: 'SALE_BLOCKED_ZERO_STOCK', domain: 'Inventory', severity: 'Critical', description: 'Zero stock sale attempt blocked.', recommendedAction: 'Review stock ledger before locking day.', status: 'Open' },
  { id: 'EOD-BI-003', eventType: 'RECOMMEND_MAJOR_STOCKTAKE', domain: 'Inventory', severity: 'High', description: 'Motor Spares category risk increasing.', recommendedAction: 'Schedule major stocktake.', status: 'Open' },
  { id: 'EOD-BI-004', eventType: 'SYNC_CONFLICT_FLAGGED', domain: 'Sync', severity: 'Critical', description: 'Role permission conflict in local queue.', recommendedAction: 'Run sync conflict review.', status: 'Open' },
  { id: 'EOD-BI-005', eventType: 'REFUND_APPROVAL_REQUIRED', domain: 'Sales', severity: 'High', description: 'Refund above cashier permission.', recommendedAction: 'Review refund request.', status: 'Open' },
  { id: 'EOD-BI-006', eventType: 'DELIVERY_FAILURE_REVIEW_REQUIRED', domain: 'Delivery', severity: 'High', description: 'Failed delivery requires follow-up.', recommendedAction: 'Follow up failed delivery.', status: 'Open' },
  { id: 'EOD-BI-007', eventType: 'CUSTOMER_SERVICE_RISK', domain: 'Customer', severity: 'Medium', description: 'Poor service flag recorded.', recommendedAction: 'Review service note.', status: 'Open' },
  { id: 'EOD-BI-008', eventType: 'NEGATIVE_STOCK_ALERT', domain: 'Inventory', severity: 'Critical', description: 'Negative stock risk detected on controlled SKU.', recommendedAction: 'Resolve stock ledger exception.', status: 'Open' },
  { id: 'EOD-BI-009', eventType: 'DEAD_STOCK_WARNING', domain: 'Inventory', severity: 'High', description: 'Dead stock warning on slow moving category.', recommendedAction: 'Review dead stock report.', status: 'Open' }
];

export const mockEODActivityEvents: EODActivityEvent[] = [
  { id: 'EOD-ACT-001', timestamp: '2026-06-09T14:10:00Z', eventType: 'EOD_CHECK_RUN', message: 'EOD readiness check run for Demo Vendor.', operator: 'Admin User' },
  { id: 'EOD-ACT-002', timestamp: '2026-06-09T14:12:00Z', eventType: 'CASH_VARIANCE_REVIEWED', message: 'Cash variance review opened for POS-01.', operator: 'Tawanda Supervisor' },
  { id: 'EOD-ACT-003', timestamp: '2026-06-09T14:14:00Z', eventType: 'PAYMENT_SUMMARY_REVIEWED', message: 'Payment summary review prepared.', operator: 'Admin User' },
  { id: 'EOD-ACT-004', timestamp: '2026-06-09T14:16:00Z', eventType: 'SHIFT_FORCE_CLOSE_PLACEHOLDER', message: 'Force close placeholder recorded for SH-001.', operator: 'Admin User' },
  { id: 'EOD-ACT-005', timestamp: '2026-06-09T14:18:00Z', eventType: 'INVENTORY_CLOSING_REVIEWED', message: 'Inventory closing review started.', operator: 'Blessing Stock' },
  { id: 'EOD-ACT-006', timestamp: '2026-06-09T14:20:00Z', eventType: 'DELIVERY_CLOSING_REVIEWED', message: 'Delivery closing review started.', operator: 'Admin User' },
  { id: 'EOD-ACT-007', timestamp: '2026-06-09T14:22:00Z', eventType: 'BI_REVIEW_COMPLETED', message: 'BI review placeholder recorded.', operator: 'Admin User' },
  { id: 'EOD-ACT-008', timestamp: '2026-06-09T14:24:00Z', eventType: 'EOD_LOCK_ATTEMPTED', message: 'Day lock attempted.', operator: 'Admin User' },
  { id: 'EOD-ACT-009', timestamp: '2026-06-09T14:25:00Z', eventType: 'EOD_LOCK_BLOCKED', message: 'Day lock blocked by failed checks.', operator: 'Admin User' },
  { id: 'EOD-ACT-010', timestamp: '2026-06-09T14:26:00Z', eventType: 'EOD_DAY_LOCKED', message: 'Day locked successfully placeholder event available after all checks pass.', operator: 'Admin User' },
  { id: 'EOD-ACT-011', timestamp: '2026-06-09T14:27:00Z', eventType: 'EOD_REPORT_EXPORT_PREPARED', message: 'EOD report export prepared.', operator: 'Admin User' }
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

export const mockOperationalApprovals: OperationalApprovalRequest[] = [
  {
    id: 'OP-APR-001',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Price Override',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'OVR-0007',
    amountOrValue: 'USD 28.00 to USD 24.00',
    risk: 'Medium',
    status: 'Pending',
    requestedAt: '2026-06-11T08:45:00Z',
    reason: 'Matched competitor price for regular customer.',
    context: 'Brake Pads Toyota GD6 Front price override requested at Sales Terminal.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-002',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Discount Above Limit',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'DISC-0014',
    amountOrValue: '18% discount',
    risk: 'High',
    status: 'Pending',
    requestedAt: '2026-06-11T09:05:00Z',
    reason: 'Discount exceeds cashier limit.',
    context: 'Customer requested bulk discount above configured cashier threshold.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-003',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Return Request',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'RET-0002',
    amountOrValue: '1 x BJ-CBHO49',
    risk: 'High',
    status: 'Pending',
    requestedAt: '2026-06-11T09:30:00Z',
    reason: 'Customer return requires supervisor review.',
    context: 'Returned Ball Joint Honda Fit GD1 from receipt RCT-0006.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-004',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Credit Note Request',
    requestedBy: 'Tawanda Supervisor',
    requestedByRole: 'Supervisor',
    relatedRecord: 'CN-0001',
    amountOrValue: 'USD 57.00',
    risk: 'High',
    status: 'Pending',
    requestedAt: '2026-06-11T09:45:00Z',
    reason: 'Credit note requested against partially disputed receipt.',
    context: 'Credit note placeholder linked to receipt RCT-0002.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-005',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Terminal Activation',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'POS-03',
    amountOrValue: 'Activation Requested',
    risk: 'Medium',
    status: 'Pending',
    requestedAt: '2026-06-11T10:00:00Z',
    reason: 'Replacement front counter terminal needs approval.',
    context: 'Terminal activation request should be reviewed before sale access is granted.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-006',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Cash Variance Review',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'SHIFT-2026-06-11-POS-01',
    amountOrValue: 'USD -12.50',
    risk: 'Critical',
    status: 'Pending',
    requestedAt: '2026-06-11T10:20:00Z',
    reason: 'Declared cash is below expected cash.',
    context: 'Cash drawer variance review required before day close.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-007',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Stock Adjustment',
    requestedBy: 'Blessing Stock',
    requestedByRole: 'Stock Controller',
    relatedRecord: 'ADJ-0019',
    amountOrValue: '-3 units CLT-N16',
    risk: 'High',
    status: 'Pending',
    requestedAt: '2026-06-11T10:40:00Z',
    reason: 'Damaged clutch plates require write-off approval.',
    context: 'Stock adjustment will not post until approved.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-008',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Stocktake Variance',
    requestedBy: 'Blessing Stock',
    requestedByRole: 'Stock Controller',
    relatedRecord: 'STK-2026-001',
    amountOrValue: '-5 units BJ-CBHO49',
    risk: 'Critical',
    status: 'Pending',
    requestedAt: '2026-06-11T10:55:00Z',
    reason: 'Stocktake variance exceeds adjustment threshold.',
    context: 'Variance requires manager or owner review before posting.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-009',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Inventory Import Approval',
    requestedBy: 'Blessing Stock',
    requestedByRole: 'Stock Controller',
    relatedRecord: 'IMPORT-004',
    amountOrValue: '186 rows',
    risk: 'Medium',
    status: 'Pending',
    requestedAt: '2026-06-11T11:10:00Z',
    reason: 'Bulk inventory import staged for approval.',
    context: 'Import includes SKU, ALU, shelf and cost updates.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-010',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'Delivery Provider Approval',
    requestedBy: 'Tawanda Supervisor',
    requestedByRole: 'Supervisor',
    relatedRecord: 'DRV-004',
    amountOrValue: 'New provider',
    risk: 'Low',
    status: 'Pending',
    requestedAt: '2026-06-11T11:25:00Z',
    reason: 'New delivery provider needs operational approval.',
    context: 'Provider onboarding remains local placeholder only.',
    requiredPermission: 'approvals.approve'
  },
  {
    id: 'OP-APR-011',
    vendorId: 'SCI-LOG-ZW',
    branchId: 'BR-HARARE',
    branch: 'Harare Main',
    category: 'NEW_CUSTOMER',
    requestedBy: 'Mary Cashier',
    requestedByRole: 'Cashier',
    relatedRecord: 'CUST-PENDING-001',
    amountOrValue: 'Garage Account',
    risk: 'Medium',
    status: 'Pending',
    requestedAt: '2026-06-11T11:40:00Z',
    reason: 'New customer account requires approval.',
    context: 'Customer request created from Sales Terminal.',
    requiredPermission: 'approvals.approve'
  }
];

export const mockOperationalApprovalEvents: OperationalApprovalEvent[] = [
  {
    id: 'OP-APR-EV-001',
    approvalId: 'OP-APR-001',
    eventType: 'APPROVAL_CREATED',
    operator: 'Mary Cashier',
    message: 'Price override approval created.',
    createdAt: '2026-06-11T08:45:00Z'
  },
  {
    id: 'OP-APR-EV-002',
    approvalId: 'OP-APR-006',
    eventType: 'APPROVAL_CREATED',
    operator: 'Mary Cashier',
    message: 'Cash variance review approval created.',
    createdAt: '2026-06-11T10:20:00Z'
  }
];

export const mockCustomers: CustomerRecord[] = [
  { customerId: 'CUST-WALKIN', vendorId: 'SCI-LOG-ZW', customerCode: 'WALK-IN', customerName: 'Walk-in Customer', customerType: 'Walk-in', phone: '', whatsapp: '', email: '', taxNumber: '', billingAddress: 'Counter sale', deliveryAddress: 'Counter collection', cityTown: 'Harare', district: 'Harare', suburb: 'CBD', source: 'Walk-in', status: 'Active', creditStatus: 'Not Applicable', notes: 'Default walk-in sale customer.', createdByStaffId: 'SYSTEM', approvedByStaffId: 'SYSTEM', createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-01T08:00:00Z' },
  { customerId: 'CUST-TAPIWA', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0002', customerName: 'Tapiwa Moyo', customerType: 'Individual', phone: '+263 77 123 4567', whatsapp: '+263 77 123 4567', email: 'tapiwa.moyo@example.com', taxNumber: '', billingAddress: '12 Lomagundi Road', deliveryAddress: '12 Lomagundi Road', cityTown: 'Harare', district: 'Harare', suburb: 'Avondale', source: 'Referral', status: 'Active', creditStatus: 'Cash Only', currentBalance: 0, notes: 'Regular motor spares buyer.', createdByStaffId: 'ST-MARY', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-03T09:00:00Z', updatedAt: '2026-06-09T13:40:00Z' },
  { customerId: 'CUST-RUDO', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0003', customerName: 'Rudo Ncube', customerType: 'Individual', phone: '+263 77 222 3344', whatsapp: '+263 77 222 3344', email: 'rudo.ncube@example.com', taxNumber: '', billingAddress: '45 Glen View Way', deliveryAddress: '45 Glen View Way', cityTown: 'Harare', district: 'Harare', suburb: 'Glen View', source: 'WhatsApp Catalogue', status: 'Active', creditStatus: 'Cash Only', currentBalance: 0, notes: 'WhatsApp catalogue lead.', createdByStaffId: 'ST-MARY', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-04T10:00:00Z', updatedAt: '2026-06-09T14:15:00Z' },
  { customerId: 'CUST-FARAI', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0004', customerName: 'Farai Sithole', customerType: 'Business', phone: '+263 71 555 0011', whatsapp: '+263 71 555 0011', email: 'farai@garage.example', taxNumber: 'BP-2001123', billingAddress: '88 Seke Road Workshop', deliveryAddress: '88 Seke Road Workshop', cityTown: 'Harare', district: 'Harare', suburb: 'Graniteside', source: 'Phone Call', status: 'Active', creditStatus: 'Credit Allowed', creditLimit: 500, currentBalance: 90, notes: 'Garage account with credit placeholder.', createdByStaffId: 'ST-ADMIN', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-02T08:30:00Z', updatedAt: '2026-06-10T12:00:00Z' },
  { customerId: 'CUST-MEMORY', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0005', customerName: 'Memory Chikore', customerType: 'Individual', phone: '+263 78 555 8844', whatsapp: '+263 78 555 8844', email: 'memory.chikore@example.com', taxNumber: '', billingAddress: '9 Mbizo Street', deliveryAddress: '9 Mbizo Street', cityTown: 'Kwekwe', district: 'Kwekwe', suburb: 'Mbizo', source: 'Facebook', status: 'Suspended', creditStatus: 'Credit Suspended', creditLimit: 150, currentBalance: 150, notes: 'Suspended pending payment review.', createdByStaffId: 'ST-MARY', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-05-28T11:00:00Z', updatedAt: '2026-06-08T11:00:00Z' },
  { customerId: 'CUST-BRIAN', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0006', customerName: 'Brian Dube', customerType: 'Dealer', phone: '+263 77 445 9001', whatsapp: '+263 77 445 9001', email: 'brian.dube@example.com', taxNumber: 'BP-889212', billingAddress: '24 Plumtree Road', deliveryAddress: '24 Plumtree Road', cityTown: 'Bulawayo', district: 'Bulawayo', suburb: 'Belmont', source: 'Commerce Access Hub', status: 'Active', creditStatus: 'Credit Review Required', creditLimit: 0, currentBalance: 0, notes: 'Dealer pricing review placeholder.', createdByStaffId: 'ST-TAWANDA', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-05T12:00:00Z', updatedAt: '2026-06-10T09:00:00Z' },
  { customerId: 'CUST-APEX-FLEET', vendorId: 'SCI-LOG-ZW', customerCode: 'FLEET-0001', customerName: 'Apex Fleet Buyer', customerType: 'Fleet Customer', phone: '+263 24 200 0100', whatsapp: '+263 77 000 0100', email: 'fleet@apex.example', taxNumber: 'VAT-APEX-2026', billingAddress: '77 Industrial Parkway', deliveryAddress: 'Fleet Workshop Gate 2', cityTown: 'Harare', district: 'Harare', suburb: 'Workington', source: 'Imported', status: 'Active', creditStatus: 'Credit Allowed', creditLimit: 2500, currentBalance: 460, notes: 'Fleet customer placeholder.', createdByStaffId: 'ST-ADMIN', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-01T08:15:00Z', updatedAt: '2026-06-09T15:00:00Z' },
  { customerId: 'CUST-MUTSA-CLOSET', vendorId: 'SCI-LOG-ZW', customerCode: 'CUST-0008', customerName: "Mutsa's Closet Buyer Placeholder", customerType: 'Business', phone: '+263 78 333 2211', whatsapp: '+263 78 333 2211', email: 'mutsa.closet@example.com', taxNumber: '', billingAddress: 'Eastlea Retail Unit', deliveryAddress: 'Eastlea Retail Unit', cityTown: 'Harare', district: 'Harare', suburb: 'Eastlea', source: 'WhatsApp Catalogue', status: 'Active', creditStatus: 'Cash Only', notes: 'Retail buyer placeholder.', createdByStaffId: 'ST-MARY', approvedByStaffId: 'ST-ADMIN', createdAt: '2026-06-06T10:30:00Z', updatedAt: '2026-06-07T10:30:00Z' },
  { customerId: 'CUST-PENDING-001', vendorId: 'SCI-LOG-ZW', customerCode: 'PEND-0001', customerName: 'Pending Customer Request Example', customerType: 'Individual', phone: '+263 77 909 8001', whatsapp: '+263 77 909 8001', email: 'pending.customer@example.com', taxNumber: '', billingAddress: 'Pending address', deliveryAddress: 'Pending address', cityTown: 'Harare', district: 'Harare', suburb: 'Mbare', source: 'Sales Terminal', status: 'Pending Approval', creditStatus: 'Cash Only', notes: 'Created from Sales Terminal and awaiting approval.', createdByStaffId: 'ST-MARY', createdAt: '2026-06-11T11:40:00Z', updatedAt: '2026-06-11T11:40:00Z' },
  { customerId: 'CUST-DUP-001', vendorId: 'SCI-LOG-ZW', customerCode: 'DUP-0001', customerName: 'Duplicate Review Example', customerType: 'Individual', phone: '+263 77 222 3344', whatsapp: '+263 77 222 3344', email: 'duplicate.review@example.com', taxNumber: '', billingAddress: 'Duplicate address', deliveryAddress: 'Duplicate address', cityTown: 'Harare', district: 'Harare', suburb: 'Glen View', source: 'Sales Terminal', status: 'Duplicate', creditStatus: 'Cash Only', notes: 'Possible duplicate of Rudo Ncube.', createdByStaffId: 'ST-MARY', createdAt: '2026-06-11T12:05:00Z', updatedAt: '2026-06-11T12:05:00Z' }
];

export const mockCustomerAddresses: CustomerAddress[] = mockCustomers.flatMap((customer) => [
  { id: `${customer.customerId}-BILL`, customerId: customer.customerId, type: 'Billing', addressLine: customer.billingAddress, cityTown: customer.cityTown, district: customer.district, suburb: customer.suburb },
  { id: `${customer.customerId}-DEL`, customerId: customer.customerId, type: 'Delivery', addressLine: customer.deliveryAddress, cityTown: customer.cityTown, district: customer.district, suburb: customer.suburb }
]);

export const mockCustomerPurchaseHistory: CustomerPurchaseHistoryRow[] = [
  { id: 'CPH-001', customerId: 'CUST-TAPIWA', customerName: 'Tapiwa Moyo', receiptNo: 'RCT-0005', date: '2026-06-09T13:40:00Z', branch: 'Harare Main', cashier: 'Mary Cashier', items: 1, total: 460, paymentMethod: 'Bank Transfer', deliveryStatus: 'No Delivery', returnStatus: 'None' },
  { id: 'CPH-002', customerId: 'CUST-RUDO', customerName: 'Rudo Ncube', receiptNo: 'RCT-0006', date: '2026-06-09T14:15:00Z', branch: 'Harare Main', cashier: 'Mary Cashier', items: 1, total: 70, paymentMethod: 'Cash', deliveryStatus: 'No Delivery', returnStatus: 'Partial Refund' },
  { id: 'CPH-003', customerId: 'CUST-FARAI', customerName: 'Farai Sithole', receiptNo: 'RCT-0003', date: '2026-06-09T11:20:00Z', branch: 'Harare Main', cashier: 'Admin User', items: 2, total: 200, paymentMethod: 'Split Payment', deliveryStatus: 'Customer Collection', returnStatus: 'None' },
  { id: 'CPH-004', customerId: 'CUST-APEX-FLEET', customerName: 'Apex Fleet Buyer', receiptNo: 'RCT-0004', date: '2026-06-09T12:05:00Z', branch: 'Bulawayo Branch', cashier: 'Tawanda Supervisor', items: 1, total: 315, paymentMethod: 'Swipe', deliveryStatus: 'Vendor Delivery', returnStatus: 'None' }
];

export const mockCustomerNotes: CustomerNote[] = [
  { id: 'CN-TAPIWA-001', customerId: 'CUST-TAPIWA', dateTime: '2026-06-09T13:45:00Z', note: 'Prefers WhatsApp receipt follow-up.', addedBy: 'Mary Cashier', role: 'Cashier', relatedRecord: 'RCT-0005' },
  { id: 'CN-RUDO-001', customerId: 'CUST-RUDO', dateTime: '2026-06-09T14:30:00Z', note: 'Return discussion logged for review.', addedBy: 'Mary Cashier', role: 'Cashier', relatedRecord: 'RCT-0006' },
  { id: 'CN-MEMORY-001', customerId: 'CUST-MEMORY', dateTime: '2026-06-08T11:00:00Z', note: 'Credit suspended until balance is cleared.', addedBy: 'Admin User', role: 'Manager', relatedRecord: 'CREDIT-REVIEW' }
];

export const mockCustomerActivityEvents: CustomerActivityEvent[] = [
  { id: 'CAE-001', customerId: 'CUST-PENDING-001', dateTime: '2026-06-11T11:40:00Z', eventType: 'CUSTOMER_CREATED_PENDING', user: 'Mary Cashier', notes: 'Pending customer request created.' },
  { id: 'CAE-002', customerId: 'CUST-RUDO', dateTime: '2026-06-09T14:15:00Z', eventType: 'CUSTOMER_PURCHASE_RECORDED', user: 'Mary Cashier', notes: 'Receipt RCT-0006 recorded.' },
  { id: 'CAE-003', customerId: 'CUST-DUP-001', dateTime: '2026-06-11T12:05:00Z', eventType: 'CUSTOMER_DUPLICATE_FLAGGED', user: 'Mary Cashier', notes: 'Possible duplicate of CUST-RUDO.' },
  { id: 'CAE-004', customerId: 'CUST-MEMORY', dateTime: '2026-06-08T11:00:00Z', eventType: 'CUSTOMER_CREDIT_REVIEW_REQUIRED', user: 'Admin User', notes: 'Credit status requires review.' }
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

export const mockPaymentReceiptRows: PaymentReceiptRow[] = [
  { id: 'PAY-RCT-0001', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', receiptNo: 'RCT-0001', dateTime: 'Today 09:35', customer: 'Walk-in Customer', paymentType: 'Cash', grossAmount: 125.00, discount: 0.00, refund: 0.00, netAmount: 125.00, status: 'Completed', createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T09:35:00Z', updatedAt: '2026-06-09T09:35:00Z' },
  { id: 'PAY-RCT-0002', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', receiptNo: 'RCT-0002', dateTime: 'Today 10:12', customer: 'WhatsApp Customer', paymentType: 'EcoCash', grossAmount: 57.00, discount: 0.00, refund: 0.00, netAmount: 57.00, status: 'Completed', createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T10:12:00Z', updatedAt: '2026-06-09T10:12:00Z' },
  { id: 'PAY-RCT-0003', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'BACK-01', terminal: 'BACK-01', cashierId: 'ST-ADMIN', cashier: 'Admin User', receiptNo: 'RCT-0003', dateTime: 'Today 11:20', customer: 'Walk-in Customer', paymentType: 'Split Payment', grossAmount: 210.00, discount: 10.00, refund: 0.00, netAmount: 200.00, status: 'Completed', createdByStaffId: 'ST-ADMIN', createdAt: '2026-06-09T11:20:00Z', updatedAt: '2026-06-09T11:20:00Z' },
  { id: 'PAY-RCT-0004', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-BULAWAYO', branch: 'Bulawayo Branch', terminalId: 'POS-02', terminal: 'POS-02', cashierId: 'ST-TAWANDA', cashier: 'Tawanda Supervisor', receiptNo: 'RCT-0004', dateTime: 'Today 12:05', customer: 'Walk-in Customer', paymentType: 'Swipe', grossAmount: 315.00, discount: 0.00, refund: 0.00, netAmount: 315.00, status: 'Completed', createdByStaffId: 'ST-TAWANDA', createdAt: '2026-06-09T12:05:00Z', updatedAt: '2026-06-09T12:05:00Z' },
  { id: 'PAY-RCT-0005', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', receiptNo: 'RCT-0005', dateTime: 'Today 13:40', customer: 'Tapiwa Moyo', paymentType: 'Bank Transfer', grossAmount: 480.00, discount: 20.00, refund: 0.00, netAmount: 460.00, status: 'Completed', createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T13:40:00Z', updatedAt: '2026-06-09T13:40:00Z' },
  { id: 'PAY-RCT-0006', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', receiptNo: 'RCT-0006', dateTime: 'Today 14:15', customer: 'Rudo Ncube', paymentType: 'Cash', grossAmount: 80.00, discount: 0.00, refund: 10.00, netAmount: 70.00, status: 'Refund Partial', createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T14:15:00Z', updatedAt: '2026-06-09T14:15:00Z' }
];

const demoReceiptBusiness = {
  businessName: 'Demo Vendor',
  tradingName: 'Demo Vendor',
  vendorId: 'SCI-LOG-ZW',
  branch: 'Harare Main',
  address: '12 Enterprise Road, Harare',
  phone: '+263 242 000 100',
  whatsApp: '+263 77 000 0100',
  vatNumber: 'VAT-ZW-82190B',
  vatRegistered: true,
  footerMessage: 'Thank you for shopping with Demo Vendor.'
};

export const mockReceiptRecords: ReceiptRecord[] = [
  { id: 'REC-RCT-0001', receiptNumber: 'RCT-0001', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', businessDate: '2026-06-09', dateTime: '2026-06-09T09:35:00Z', customer: { customerName: 'Walk-in Customer' }, businessDetails: demoReceiptBusiness, subtotal: 125, discountTotal: 0, vatTotal: 18.75, grandTotal: 125, paymentMode: 'Cash', status: 'Completed', fiscalizationStatus: 'Disabled In Development', fiscalReferencePlaceholder: 'FISC-DEV-0001', reprintCount: 0, offlineQueued: false, createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T09:35:00Z', updatedAt: '2026-06-09T09:35:00Z' },
  { id: 'REC-RCT-0002', receiptNumber: 'RCT-0002', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', businessDate: '2026-06-09', dateTime: '2026-06-09T10:12:00Z', customer: { customerName: 'WhatsApp Customer', customerPhone: '+263 77 111 2233' }, businessDetails: demoReceiptBusiness, subtotal: 57, discountTotal: 0, vatTotal: 8.55, grandTotal: 57, paymentMode: 'EcoCash', status: 'Reprinted', fiscalizationStatus: 'Queued', fiscalReferencePlaceholder: 'FISC-DEV-0002', reprintCount: 1, offlineQueued: false, createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T10:12:00Z', updatedAt: '2026-06-09T10:50:00Z' },
  { id: 'REC-RCT-0003', receiptNumber: 'RCT-0003', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'BACK-01', terminal: 'BACK-01', cashierId: 'ST-ADMIN', cashier: 'Admin User', businessDate: '2026-06-09', dateTime: '2026-06-09T11:20:00Z', customer: { customerName: 'Walk-in Customer' }, businessDetails: { ...demoReceiptBusiness, branch: 'Harare Main' }, subtotal: 210, discountTotal: 10, vatTotal: 30, grandTotal: 200, paymentMode: 'Split Payment', status: 'Fiscal Pending', fiscalizationStatus: 'Pending', fiscalReferencePlaceholder: 'Pending', reprintCount: 0, offlineQueued: true, createdByStaffId: 'ST-ADMIN', createdAt: '2026-06-09T11:20:00Z', updatedAt: '2026-06-09T11:20:00Z' },
  { id: 'REC-RCT-0004', receiptNumber: 'RCT-0004', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-BYO', branch: 'Bulawayo Branch', terminalId: 'POS-02', terminal: 'POS-02', cashierId: 'ST-TAWANDA', cashier: 'Tawanda Supervisor', businessDate: '2026-06-09', dateTime: '2026-06-09T12:05:00Z', customer: { customerName: 'Fleet Buyer' }, businessDetails: { ...demoReceiptBusiness, branch: 'Bulawayo Branch', address: '4 Plumtree Road, Bulawayo' }, subtotal: 315, discountTotal: 0, vatTotal: 47.25, grandTotal: 315, paymentMode: 'Swipe', status: 'Completed', fiscalizationStatus: 'Fiscalized', fiscalReferencePlaceholder: 'FISC-DEV-0004', reprintCount: 0, offlineQueued: false, createdByStaffId: 'ST-TAWANDA', createdAt: '2026-06-09T12:05:00Z', updatedAt: '2026-06-09T12:05:00Z' },
  { id: 'REC-RCT-0005', receiptNumber: 'RCT-0005', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', businessDate: '2026-06-09', dateTime: '2026-06-09T13:40:00Z', customer: { customerName: 'Garage Account' }, businessDetails: demoReceiptBusiness, subtotal: 480, discountTotal: 20, vatTotal: 69, grandTotal: 460, paymentMode: 'Bank Transfer', status: 'Voided', fiscalizationStatus: 'Failed', fiscalReferencePlaceholder: 'FISC-DEV-0005', voidReference: 'VOID-0001', reprintCount: 0, offlineQueued: false, createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T13:40:00Z', updatedAt: '2026-06-09T13:55:00Z' },
  { id: 'REC-RCT-0006', receiptNumber: 'RCT-0006', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branchId: 'BR-HARARE', branch: 'Harare Main', terminalId: 'POS-01', terminal: 'POS-01', cashierId: 'ST-MARY', cashier: 'Mary Cashier', businessDate: '2026-06-09', dateTime: '2026-06-09T14:15:00Z', customer: { customerName: 'Rudo Ncube', customerPhone: '+263 77 222 3344' }, businessDetails: demoReceiptBusiness, subtotal: 80, discountTotal: 0, vatTotal: 10.5, grandTotal: 70, paymentMode: 'Cash', status: 'Partially Refunded', fiscalizationStatus: 'Offline Pending', fiscalReferencePlaceholder: 'Offline queue', refundReference: 'REF-0001', reprintCount: 3, offlineQueued: true, createdByStaffId: 'ST-MARY', createdAt: '2026-06-09T14:15:00Z', updatedAt: '2026-06-09T14:35:00Z' }
];

export const mockReceiptLines: ReceiptLine[] = [
  { id: 'RL-0001-1', receiptNumber: 'RCT-0001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', quantity: 2, unitPrice: 40, discountAmount: 0, lineNetAmount: 80, vatAmount: 12, lineTotal: 80, salesAccountCOA: '4010', assetAccountCOA: '1210' },
  { id: 'RL-0001-2', receiptNumber: 'RCT-0001', productId: 'OIL-FLT-15', sku: 'OIL-FLT-15', productName: 'Premium Oil Filter 15W40', quantity: 1, unitPrice: 45, discountAmount: 0, lineNetAmount: 45, vatAmount: 6.75, lineTotal: 45, salesAccountCOA: '4020', assetAccountCOA: '1220' },
  { id: 'RL-0002-1', receiptNumber: 'RCT-0002', productId: 'prod-press-gauge', sku: 'PSG-B10', productName: 'Dial Pressure Gauge 10 Bar', quantity: 1, unitPrice: 30, discountAmount: 0, lineNetAmount: 30, vatAmount: 4.5, lineTotal: 30 },
  { id: 'RL-0002-2', receiptNumber: 'RCT-0002', productId: 'SP-PLT-G', sku: 'SP-PLT-G', productName: 'Spark Plug Platinum G-Power', quantity: 1, unitPrice: 27, discountAmount: 0, lineNetAmount: 27, vatAmount: 4.05, lineTotal: 27 },
  { id: 'RL-0003-1', receiptNumber: 'RCT-0003', productId: 'prod-hex-bolt', sku: 'HEX-B12', productName: 'M12 Heavy Hex Bolt Steel 8.8', quantity: 100, unitPrice: 1.5, discountAmount: 10, lineNetAmount: 140, vatAmount: 21, lineTotal: 140 },
  { id: 'RL-0003-2', receiptNumber: 'RCT-0003', productId: 'FB-VR-HM', sku: 'FB-VR-HM', productName: 'Heavy Duty Fan Belt v-Ribbed', quantity: 1, unitPrice: 60, discountAmount: 0, lineNetAmount: 60, vatAmount: 9, lineTotal: 60 },
  { id: 'RL-0004-1', receiptNumber: 'RCT-0004', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', quantity: 2, unitPrice: 157.5, discountAmount: 0, lineNetAmount: 315, vatAmount: 47.25, lineTotal: 315 },
  { id: 'RL-0005-1', receiptNumber: 'RCT-0005', productId: 'STOCK-P-04', sku: 'OIL-5W30', productName: 'Engine Oil 5W30 5L', quantity: 3, unitPrice: 160, discountAmount: 20, lineNetAmount: 460, vatAmount: 69, lineTotal: 460 },
  { id: 'RL-0006-1', receiptNumber: 'RCT-0006', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', quantity: 5, unitPrice: 16, discountAmount: 0, lineNetAmount: 80, vatAmount: 10.5, lineTotal: 80 }
];

export const mockReceiptPayments: ReceiptPaymentLine[] = [
  { id: 'RP-0001', receiptNumber: 'RCT-0001', paymentMode: 'Cash', amount: 125, reference: 'CASH-POS-01', confirmed: true },
  { id: 'RP-0002', receiptNumber: 'RCT-0002', paymentMode: 'EcoCash', amount: 57, reference: 'ECO-44502', confirmed: true },
  { id: 'RP-0003A', receiptNumber: 'RCT-0003', paymentMode: 'Cash', amount: 100, reference: 'SPLIT-CASH', confirmed: true },
  { id: 'RP-0003B', receiptNumber: 'RCT-0003', paymentMode: 'Swipe', amount: 100, reference: 'SPLIT-SWIPE', confirmed: true },
  { id: 'RP-0004', receiptNumber: 'RCT-0004', paymentMode: 'Swipe', amount: 315, reference: 'CARD-88201', confirmed: true },
  { id: 'RP-0005', receiptNumber: 'RCT-0005', paymentMode: 'Bank Transfer', amount: 460, reference: 'BANK-PENDING', confirmed: false },
  { id: 'RP-0006', receiptNumber: 'RCT-0006', paymentMode: 'Cash', amount: 70, reference: 'CASH-REF-PARTIAL', confirmed: true }
];

export const mockReceiptSequenceControls: ReceiptSequenceControl[] = [
  { id: 'SEQ-001', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branch: 'Harare Main', terminal: 'POS-01', prefix: 'RCT', lastReceiptNo: 'RCT-0006', nextReceiptNo: 'RCT-0007', sequenceStatus: 'Gap Detected', gapCount: 1, duplicateRisk: 'High', lastChecked: '2026-06-09T14:45:00Z' },
  { id: 'SEQ-002', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branch: 'Harare Main', terminal: 'BACK-01', prefix: 'RCT', lastReceiptNo: 'RCT-0003', nextReceiptNo: 'RCT-0004', sequenceStatus: 'Offline Pending', gapCount: 0, duplicateRisk: 'Medium', lastChecked: '2026-06-09T14:42:00Z' },
  { id: 'SEQ-003', vendorId: 'SCI-LOG-ZW', businessVendor: 'Demo Vendor', branch: 'Bulawayo Branch', terminal: 'POS-02', prefix: 'RCT', lastReceiptNo: 'RCT-0004', nextReceiptNo: 'RCT-0005', sequenceStatus: 'Healthy', gapCount: 0, duplicateRisk: 'Low', lastChecked: '2026-06-09T14:40:00Z' }
];

export const mockReceiptReprintAudits: ReceiptReprintAudit[] = [
  { id: 'RRA-001', receiptNumber: 'RCT-0002', originalPrintedAt: '2026-06-09T10:12:00Z', reprintedAt: '2026-06-09T10:50:00Z', reprintedBy: 'Mary Cashier', reason: 'Customer requested duplicate slip.', reprintCount: 1, approvalRequired: false, status: 'Logged' },
  { id: 'RRA-002', receiptNumber: 'RCT-0006', originalPrintedAt: '2026-06-09T14:15:00Z', reprintedAt: '2026-06-09T14:35:00Z', reprintedBy: 'Mary Cashier', reason: 'Refund review copy.', reprintCount: 3, approvalRequired: true, status: 'Review Required' }
];

export const mockFiscalizationPlaceholderRecords: FiscalizationPlaceholderRecord[] = [
  { id: 'FISC-001', receiptNumber: 'RCT-0003', dateTime: '2026-06-09T11:20:00Z', branch: 'Harare Main', terminal: 'BACK-01', fiscalStatus: 'Pending', fiscalReferencePlaceholder: 'Pending', queueStatus: 'Queued' },
  { id: 'FISC-002', receiptNumber: 'RCT-0004', dateTime: '2026-06-09T12:05:00Z', branch: 'Bulawayo Branch', terminal: 'POS-02', fiscalStatus: 'Fiscalized', fiscalReferencePlaceholder: 'FISC-DEV-0004', queueStatus: 'Completed Placeholder' },
  { id: 'FISC-003', receiptNumber: 'RCT-0005', dateTime: '2026-06-09T13:40:00Z', branch: 'Harare Main', terminal: 'POS-01', fiscalStatus: 'Failed', fiscalReferencePlaceholder: 'FISC-DEV-0005', queueStatus: 'Retry Pending', errorMessagePlaceholder: 'Placeholder failure for readiness testing.' },
  { id: 'FISC-004', receiptNumber: 'RCT-0006', dateTime: '2026-06-09T14:15:00Z', branch: 'Harare Main', terminal: 'POS-01', fiscalStatus: 'Offline Pending', fiscalReferencePlaceholder: 'Offline queue', queueStatus: 'Queued' }
];

export const mockReceiptAuditEvents: ReceiptAuditEvent[] = [
  { id: 'RAE-001', timestamp: '2026-06-09T09:35:00Z', eventType: 'RECEIPT_CREATED', receiptNumber: 'RCT-0001', message: 'Receipt RCT-0001 created.', operator: 'Mary Cashier' },
  { id: 'RAE-002', timestamp: '2026-06-09T09:36:00Z', eventType: 'RECEIPT_PRINTED', receiptNumber: 'RCT-0001', message: '80mm receipt printed.', operator: 'Mary Cashier' },
  { id: 'RAE-003', timestamp: '2026-06-09T10:50:00Z', eventType: 'RECEIPT_REPRINTED', receiptNumber: 'RCT-0002', message: 'Receipt reprint placeholder recorded.', operator: 'Mary Cashier' },
  { id: 'RAE-004', timestamp: '2026-06-09T13:55:00Z', eventType: 'RECEIPT_VOIDED', receiptNumber: 'RCT-0005', message: 'Void placeholder linked to original receipt.', operator: 'Tawanda Supervisor' },
  { id: 'RAE-005', timestamp: '2026-06-09T14:35:00Z', eventType: 'RECEIPT_REFUNDED', receiptNumber: 'RCT-0006', message: 'Partial refund placeholder linked to original receipt.', operator: 'Admin User' },
  { id: 'RAE-006', timestamp: '2026-06-09T14:45:00Z', eventType: 'RECEIPT_SEQUENCE_CHECKED', receiptNumber: 'RCT-0006', message: 'Receipt sequence check run.', operator: 'Admin User' },
  { id: 'RAE-007', timestamp: '2026-06-09T14:45:30Z', eventType: 'RECEIPT_GAP_DETECTED', receiptNumber: 'RCT-0006', message: 'Receipt gap warning detected.', operator: 'Admin User' },
  { id: 'RAE-008', timestamp: '2026-06-09T14:46:00Z', eventType: 'DUPLICATE_RECEIPT_RISK', receiptNumber: 'RCT-0006', message: 'Duplicate receipt risk placeholder flagged.', operator: 'Admin User' },
  { id: 'RAE-009', timestamp: '2026-06-09T14:47:00Z', eventType: 'FISCALIZATION_QUEUED', receiptNumber: 'RCT-0003', message: 'Fiscalization placeholder queued.', operator: 'Admin User' },
  { id: 'RAE-010', timestamp: '2026-06-09T14:48:00Z', eventType: 'FISCALIZATION_PLACEHOLDER_CREATED', receiptNumber: 'RCT-0003', message: 'Fiscal placeholder record created.', operator: 'Admin User' },
  { id: 'RAE-011', timestamp: '2026-06-09T14:49:00Z', eventType: 'RECEIPT_PDF_EXPORT_PREPARED', receiptNumber: 'RCT-0001', message: 'PDF export placeholder prepared.', operator: 'Admin User' }
];

export const mockAccountingPostings: AccountingPosting[] = [
  { id: 'ACC-POST-001', source: 'Sale', sourceReference: 'RCT-0001', businessDate: '2026-06-09', branch: 'Harare Main', postingStatus: 'Posted', totalDebit: 125, totalCredit: 125, reviewedBy: 'Admin User' },
  { id: 'ACC-POST-002', source: 'Refund', sourceReference: 'RCT-0006', businessDate: '2026-06-09', branch: 'Harare Main', postingStatus: 'Pending Review', totalDebit: 10, totalCredit: 10 },
  { id: 'ACC-POST-003', source: 'Void', sourceReference: 'VOID-0001', businessDate: '2026-06-09', branch: 'Harare Main', postingStatus: 'Draft', totalDebit: 0, totalCredit: 0 },
  { id: 'ACC-POST-004', source: 'Inventory Movement', sourceReference: 'MOV-BP-002', businessDate: '2026-06-09', branch: 'Harare Main', postingStatus: 'Pending Review', totalDebit: 32, totalCredit: 32 }
];

export const mockAccountingPostingLines: AccountingPostingLine[] = [
  { id: 'ACC-LINE-001', postingId: 'ACC-POST-001', accountCode: '1000', accountName: 'Cash on Hand', debit: 125, credit: 0, memo: 'Cash receipt RCT-0001.' },
  { id: 'ACC-LINE-002', postingId: 'ACC-POST-001', accountCode: '4010', accountName: 'Sales Revenue - Motor Spares', debit: 0, credit: 125, memo: 'Sales classification for motor spares.' },
  { id: 'ACC-LINE-003', postingId: 'ACC-POST-002', accountCode: '9010', accountName: 'Refund Control', debit: 10, credit: 0, memo: 'Refund control impact.' },
  { id: 'ACC-LINE-004', postingId: 'ACC-POST-002', accountCode: '1000', accountName: 'Cash on Hand', debit: 0, credit: 10, memo: 'Cash refund reduction.' },
  { id: 'ACC-LINE-005', postingId: 'ACC-POST-004', accountCode: '5010', accountName: 'Cost of Goods Sold - Motor Spares', debit: 32, credit: 0, memo: 'COGS placeholder for RCT-0004.' },
  { id: 'ACC-LINE-006', postingId: 'ACC-POST-004', accountCode: '1210', accountName: 'Inventory Asset - Motor Spares', debit: 0, credit: 32, memo: 'Inventory asset reduction.' }
];

export const mockSalesAccountingSummaryRows: SalesAccountingSummary[] = [
  { id: 'ACC-SALE-001', receiptNo: 'RCT-0001', dateTime: '2026-06-09T09:35:00Z', branch: 'Harare Main', terminal: 'POS-01', cashier: 'Mary Cashier', grossSale: 125, discount: 0, vat: 18.75, netSale: 125, salesAccount: '4010 Sales Revenue - Motor Spares', postingStatus: 'Posted' },
  { id: 'ACC-SALE-002', receiptNo: 'RCT-0003', dateTime: '2026-06-09T11:20:00Z', branch: 'Harare Main', terminal: 'BACK-01', cashier: 'Admin User', grossSale: 210, discount: 10, vat: 30, netSale: 200, salesAccount: '9000 Suspense / Review Account', postingStatus: 'Pending Review' },
  { id: 'ACC-SALE-003', receiptNo: 'RCT-0004', dateTime: '2026-06-09T12:05:00Z', branch: 'Bulawayo Branch', terminal: 'POS-02', cashier: 'Tawanda Supervisor', grossSale: 315, discount: 0, vat: 47.25, netSale: 315, salesAccount: '4010 Sales Revenue - Motor Spares', postingStatus: 'Posted' },
  { id: 'ACC-SALE-004', receiptNo: 'RCT-0005', dateTime: '2026-06-09T13:40:00Z', branch: 'Harare Main', terminal: 'POS-01', cashier: 'Mary Cashier', grossSale: 480, discount: 20, vat: 69, netSale: 460, salesAccount: '4020 Sales Revenue - Lubricants', postingStatus: 'Draft' },
  { id: 'ACC-SALE-005', receiptNo: 'RCT-0006', dateTime: '2026-06-09T14:15:00Z', branch: 'Harare Main', terminal: 'POS-01', cashier: 'Mary Cashier', grossSale: 80, discount: 0, vat: 10.5, netSale: 70, salesAccount: '9010 Refund Control', postingStatus: 'Pending Review' }
];

export const mockPaymentAccountingSummaryRows: PaymentAccountingSummary[] = [
  { id: 'ACC-PAY-001', paymentMode: 'Cash', receiptCount: 18, grossAmount: 760, refunds: 10, netAmount: 750, controlAccount: '1000 Cash on Hand', settlementStatus: 'Variance', variance: -5, postingStatus: 'Pending Review' },
  { id: 'ACC-PAY-002', paymentMode: 'EcoCash', receiptCount: 8, grossAmount: 320, refunds: 0, netAmount: 320, controlAccount: '1010 EcoCash Control', settlementStatus: 'Settled', variance: 0, postingStatus: 'Posted' },
  { id: 'ACC-PAY-003', paymentMode: 'Swipe', receiptCount: 5, grossAmount: 215, refunds: 0, netAmount: 215, controlAccount: '1020 Swipe/Card Control', settlementStatus: 'Settled', variance: 0, postingStatus: 'Posted' },
  { id: 'ACC-PAY-004', paymentMode: 'Bank Transfer', receiptCount: 3, grossAmount: 480, refunds: 0, netAmount: 460, controlAccount: '1030 Bank Transfer Control', settlementStatus: 'Pending', variance: 'Pending', postingStatus: 'Draft' },
  { id: 'ACC-PAY-005', paymentMode: 'Split Payment', receiptCount: 2, grossAmount: 210, refunds: 0, netAmount: 200, controlAccount: 'Split by Payment Components', settlementStatus: 'Under Review', variance: 0, postingStatus: 'Draft' },
  { id: 'ACC-PAY-006', paymentMode: 'Credit Sale', receiptCount: 1, grossAmount: 90, refunds: 0, netAmount: 90, controlAccount: '1300 Customer Receivables Control', settlementStatus: 'Pending', variance: 0, postingStatus: 'Draft' },
  { id: 'ACC-PAY-007', paymentMode: 'Store Credit', receiptCount: 1, grossAmount: 42, refunds: 0, netAmount: 42, controlAccount: '9000 Suspense / Review Account', settlementStatus: 'Under Review', variance: 0, postingStatus: 'Pending Review' }
];

export const mockCashbookEntries: CashbookEntry[] = [
  { id: 'CASHBOOK-001', dateTime: '2026-06-09T08:00:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Mary Cashier', movementType: 'Opening Float', reference: 'SH-001', cashIn: 50, cashOut: 0, balanceAfter: 50, account: '1000 Cash on Hand', status: 'Posted', notes: 'Opening float declared.' },
  { id: 'CASHBOOK-002', dateTime: '2026-06-09T09:35:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Mary Cashier', movementType: 'Cash Sale', reference: 'RCT-0001', cashIn: 125, cashOut: 0, balanceAfter: 175, account: '1000 Cash on Hand', status: 'Posted', notes: 'Cash sale increases cashbook.' },
  { id: 'CASHBOOK-003', dateTime: '2026-06-09T11:45:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Tawanda Supervisor', movementType: 'Cash In', reference: 'CASH-IN-001', cashIn: 80, cashOut: 0, balanceAfter: 255, account: '1000 Cash on Hand', status: 'Posted', notes: 'Safe top-up.' },
  { id: 'CASHBOOK-004', dateTime: '2026-06-09T13:00:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Tawanda Supervisor', movementType: 'Cash Out', reference: 'CASH-OUT-001', cashIn: 0, cashOut: 40, balanceAfter: 215, account: '1000 Cash on Hand', status: 'Pending Review', notes: 'Cash out requires authorization.' },
  { id: 'CASHBOOK-005', dateTime: '2026-06-09T14:15:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Mary Cashier', movementType: 'Refund', reference: 'RCT-0006', cashIn: 0, cashOut: 10, balanceAfter: 205, account: '9010 Refund Control', status: 'Pending Review', notes: 'Cash refund reduces cashbook.' },
  { id: 'CASHBOOK-006', dateTime: '2026-06-09T15:20:00Z', branch: 'Harare Main', terminal: 'POS-01', staff: 'Admin User', movementType: 'Cash Variance', reference: 'SH-001', cashIn: 0, cashOut: 5, balanceAfter: 200, account: '6000 Cash Variance / Shortage', status: 'Pending Review', notes: 'Variance posts to shortage placeholder.' }
];

export const mockVATSummaryRows: VATSummary[] = [
  { id: 'VAT-001', receiptNo: 'RCT-0001', date: '2026-06-09', grossAmount: 125, vatableAmount: 125, vatAmount: 18.75, vatMode: 'Inclusive', vatNumber: 'VAT-ZW-82190B', status: 'Posted' },
  { id: 'VAT-002', receiptNo: 'RCT-0003', date: '2026-06-09', grossAmount: 210, vatableAmount: 200, vatAmount: 30, vatMode: 'Inclusive', vatNumber: 'VAT-ZW-82190B', status: 'Pending Review' },
  { id: 'VAT-003', receiptNo: 'RCT-0005', date: '2026-06-09', grossAmount: 480, vatableAmount: 460, vatAmount: 69, vatMode: 'Inclusive', vatNumber: 'VAT-ZW-82190B', status: 'Draft' },
  { id: 'VAT-004', receiptNo: 'RCT-0006', date: '2026-06-09', grossAmount: 80, vatableAmount: 70, vatAmount: 10.5, vatMode: 'Inclusive', vatNumber: 'VAT-ZW-82190B', status: 'Pending Review' }
];

export const mockCOGSReserveRows: COGSReserveSummary[] = [
  { id: 'COGS-001', product: 'Ball Joint Honda Fit GD1', receiptReference: 'RCT-0001', qtySold: 2, unitCost: 7, sellingPrice: 12, estimatedCOGS: 14, suggestedReserve: 14, reserveStatus: 'Reserved' },
  { id: 'COGS-002', product: 'Brake Pads Toyota GD6 Front', receiptReference: 'RCT-0004', qtySold: 2, unitCost: 16, sellingPrice: 28, estimatedCOGS: 32, suggestedReserve: 32, reserveStatus: 'Pending' },
  { id: 'COGS-003', product: 'Engine Oil 5W30 5L', receiptReference: 'RCT-0005', qtySold: 3, unitCost: 14.5, sellingPrice: 22, estimatedCOGS: 43.5, suggestedReserve: 43.5, reserveStatus: 'Review Required' },
  { id: 'COGS-004', product: 'Clutch Plate Nissan N16', receiptReference: 'ADJ-0019', qtySold: 0, unitCost: 25, sellingPrice: 45, estimatedCOGS: 75, suggestedReserve: 75, reserveStatus: 'Misuse Risk' }
];

export const mockInventoryAssetPostingRows: InventoryAssetPostingRow[] = [
  { id: 'INV-ASSET-001', product: 'Ball Joint Honda Fit GD1', movementType: 'SALE', reference: 'RCT-0001', qtyIn: 0, qtyOut: 2, unitCost: 7, costImpact: -14, assetAccount: '1210 Inventory Asset - Motor Spares', cogsAccount: '5010 Cost of Goods Sold - Motor Spares', salesAccount: '4010 Sales Revenue - Motor Spares', postingStatus: 'Posted', risk: 'Low' },
  { id: 'INV-ASSET-002', product: 'Brake Pads Toyota GD6 Front', movementType: 'GOODS_RECEIVED', reference: 'GRN-2026-9042', qtyIn: 10, qtyOut: 0, unitCost: 16.5, costImpact: 165, assetAccount: '1210 Inventory Asset - Motor Spares', cogsAccount: '5010 Cost of Goods Sold - Motor Spares', salesAccount: '4010 Sales Revenue - Motor Spares', postingStatus: 'Draft', risk: 'Low' },
  { id: 'INV-ASSET-003', product: 'Engine Oil 5W30 5L', movementType: 'SALE', reference: 'RCT-0005', qtyIn: 0, qtyOut: 3, unitCost: 14.5, costImpact: -43.5, assetAccount: '1220 Inventory Asset - Lubricants', cogsAccount: '5020 Cost of Goods Sold - Lubricants', salesAccount: '4020 Sales Revenue - Lubricants', postingStatus: 'Pending Review', risk: 'Medium' },
  { id: 'INV-ASSET-004', product: 'Clutch Plate Nissan N16', movementType: 'DAMAGE_WRITEOFF', reference: 'ADJ-0019', qtyIn: 0, qtyOut: 3, unitCost: 25, costImpact: -75, assetAccount: '9000 Suspense / Review Account', cogsAccount: '5000 Cost of Goods Sold - General', salesAccount: '9000 Suspense / Review Account', postingStatus: 'Pending Review', risk: 'High' }
];

export const mockAccountingReadinessChecks: AccountingReadinessCheck[] = [
  { id: 'ACC-READY-001', check: 'Business profile completed', domain: 'Business', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-002', check: 'Tax/VAT details captured', domain: 'Tax', status: 'Warning', requiredAction: 'Confirm VAT certificate details' },
  { id: 'ACC-READY-003', check: 'Receipt settings completed', domain: 'Sales', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-004', check: 'Product Sales Account assigned', domain: 'Products', status: 'Warning', requiredAction: 'Review suspense account products' },
  { id: 'ACC-READY-005', check: 'Product Asset Account assigned', domain: 'Products', status: 'Warning', requiredAction: 'Assign missing asset accounts' },
  { id: 'ACC-READY-006', check: 'Payment control accounts assigned', domain: 'Payments', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-007', check: 'Cashbook movement logging active', domain: 'Cashbook', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-008', check: 'Refund and void control active', domain: 'Sales', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-009', check: 'Inventory movement engine active', domain: 'Inventory', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-010', check: 'EOD reconciliation active', domain: 'EOD', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-011', check: 'COGS reserve placeholder active', domain: 'COGS', status: 'Passed', requiredAction: 'None' },
  { id: 'ACC-READY-012', check: 'Fiscalization not connected yet', domain: 'Tax', status: 'Pending', requiredAction: 'Connect fiscalization later' }
];

export const mockInventoryAccountingReadinessRecords: InventoryAccountingReadinessRecord[] = [
  { readinessId: 'IAR-ID-0001', readinessNumber: 'IAR-0001', vendorId: 'SCI-LOG-ZW', sourceType: 'GRN', sourceId: 'GRN-ID-0003', sourceNumber: 'GRN-0003', movementId: 'MOV-GRN-0003', movementType: 'GOODS_RECEIVED', impactType: 'Inventory Asset Increase', branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-HARARE-01', warehouseName: 'Harare Main Warehouse', status: 'Pending Review', riskLevel: 'Low', totalValueImpact: 248, currency: 'USD', notes: 'Posted GRN can create inventory asset increase pending review. No supplier payment posted.', createdAt: '2026-06-12T08:10:00Z', updatedAt: '2026-06-12T08:10:00Z' },
  { readinessId: 'IAR-ID-0002', readinessNumber: 'IAR-0002', vendorId: 'SCI-LOG-ZW', sourceType: 'Supplier Return', sourceId: 'SRT-ID-0003', sourceNumber: 'SRT-0003', movementId: 'MOV-SRT-0003', movementType: 'SUPPLIER_RETURN', impactType: 'Inventory Asset Decrease', branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-RET-01', warehouseName: 'Return Holding', status: 'Pending Review', riskLevel: 'Medium', totalValueImpact: -72, currency: 'USD', notes: 'Supplier credit expected placeholder only.', createdAt: '2026-06-12T08:20:00Z', updatedAt: '2026-06-12T08:20:00Z' },
  { readinessId: 'IAR-ID-0003', readinessNumber: 'IAR-0003', vendorId: 'SCI-LOG-ZW', sourceType: 'Stock Adjustment', sourceId: 'STA-ID-0002', sourceNumber: 'STA-0002', movementId: 'MOV-STA-0002', movementType: 'WRITE_OFF', impactType: 'Inventory Write Off', branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-DMG-01', warehouseName: 'Damaged Holding', status: 'On Hold', riskLevel: 'High', totalValueImpact: -180, currency: 'USD', notes: 'Write-off review on hold pending manager notes.', createdAt: '2026-06-12T08:30:00Z', updatedAt: '2026-06-12T08:30:00Z' },
  { readinessId: 'IAR-ID-0004', readinessNumber: 'IAR-0004', vendorId: 'SCI-LOG-ZW', sourceType: 'Stocktake', sourceId: 'STK-ID-0004', sourceNumber: 'STK-0004', movementId: 'MOV-STK-0004', movementType: 'STOCKTAKE_LOSS', impactType: 'Stocktake Loss', branchId: 'BR-BYO', branchName: 'Bulawayo Branch', warehouseId: 'WH-BYO-01', warehouseName: 'Bulawayo Branch Warehouse', status: 'Pending Review', riskLevel: 'Critical', totalValueImpact: -360, currency: 'USD', notes: 'Critical stocktake loss requires accounting approval placeholder.', createdAt: '2026-06-12T08:40:00Z', updatedAt: '2026-06-12T08:40:00Z' },
  { readinessId: 'IAR-ID-0005', readinessNumber: 'IAR-0005', vendorId: 'SCI-LOG-ZW', sourceType: 'Stock Transfer', sourceId: 'TRF-ID-0002', sourceNumber: 'TRF-0002', movementId: 'MOV-TRF-0002', movementType: 'BRANCH_TRANSFER_OUT', impactType: 'Transfer Neutral', branchId: 'BR-HARARE', branchName: 'Harare Main', warehouseId: 'WH-HARARE-01', warehouseName: 'Harare Main Warehouse', status: 'Reviewed', riskLevel: 'Low', totalValueImpact: 0, currency: 'USD', reviewedByStaffId: 'ST-ADMIN', reviewedByStaffName: 'Admin User', notes: 'Transfer neutral under current policy.', createdAt: '2026-06-12T08:50:00Z', updatedAt: '2026-06-12T09:10:00Z' }
];

export const mockInventoryAccountingReadinessLines: InventoryAccountingReadinessLine[] = [
  { lineId: 'IAR-LINE-0001', readinessId: 'IAR-ID-0001', productId: 'STOCK-P-02', sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', movementType: 'GOODS_RECEIVED', qtyIn: 24, qtyOut: 0, unitCost: 7, valueImpact: 168, debitAccountCode: '1200', debitAccountName: 'Inventory Asset', creditAccountCode: '2100', creditAccountName: 'Supplier Liability Placeholder', mappingStatus: 'Mapped', notes: 'GRN inventory increase pending review.' },
  { lineId: 'IAR-LINE-0002', readinessId: 'IAR-ID-0001', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', movementType: 'GOODS_RECEIVED', qtyIn: 5, qtyOut: 0, unitCost: 16, valueImpact: 80, debitAccountCode: '1200', debitAccountName: 'Inventory Asset', creditAccountCode: '2100', creditAccountName: 'Supplier Liability Placeholder', mappingStatus: 'Mapped', notes: 'Supplier invoice pending.' },
  { lineId: 'IAR-LINE-0003', readinessId: 'IAR-ID-0002', productId: 'STOCK-P-RAD-COROLLA', sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', movementType: 'SUPPLIER_RETURN', qtyIn: 0, qtyOut: 1, unitCost: 72, valueImpact: -72, debitAccountCode: '2150', debitAccountName: 'Supplier Credit Note Expected', creditAccountCode: '1200', creditAccountName: 'Inventory Asset', mappingStatus: 'Mapped', notes: 'Credit note expected from supplier.' },
  { lineId: 'IAR-LINE-0004', readinessId: 'IAR-ID-0003', productId: 'STOCK-P-05', sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', movementType: 'WRITE_OFF', qtyIn: 0, qtyOut: 4, unitCost: 45, valueImpact: -180, debitAccountCode: '5100', debitAccountName: 'Stock Write Off', creditAccountCode: '1200', creditAccountName: 'Inventory Asset', mappingStatus: 'Review Required', notes: 'High-risk write-off mapping review.' },
  { lineId: 'IAR-LINE-0005', readinessId: 'IAR-ID-0004', productId: 'STOCK-P-03', sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', movementType: 'STOCKTAKE_LOSS', qtyIn: 0, qtyOut: 12, unitCost: 30, valueImpact: -360, debitAccountCode: '5200', debitAccountName: 'Stocktake Loss', creditAccountCode: '1200', creditAccountName: 'Inventory Asset', mappingStatus: 'Review Required', notes: 'Critical stocktake loss threshold exceeded.' },
  { lineId: 'IAR-LINE-0006', readinessId: 'IAR-ID-0005', productId: 'STOCK-P-HILUX-MIR-RC', sku: 'MIR-GD6-RC', productName: 'Toyota Hilux GD6 Mirror Right Chrome', movementType: 'BRANCH_TRANSFER_OUT', qtyIn: 0, qtyOut: 2, unitCost: 34, valueImpact: 0, mappingStatus: 'Mapped', notes: 'Transfer neutral under current policy.' }
];

export const mockChartOfAccountsPlaceholders: ChartOfAccountsPlaceholder[] = [
  { accountCode: '1200', accountName: 'Inventory Asset', accountType: 'Asset', normalBalance: 'Debit', linkedDomain: 'Inventory', status: 'Active' },
  { accountCode: '5000', accountName: 'Cost of Goods Sold Placeholder', accountType: 'Cost of Sales', normalBalance: 'Debit', linkedDomain: 'COGS', status: 'Review' },
  { accountCode: '5100', accountName: 'Stock Write Off', accountType: 'Expense', normalBalance: 'Debit', linkedDomain: 'Inventory Write Off', status: 'Active' },
  { accountCode: '5200', accountName: 'Stocktake Loss', accountType: 'Expense', normalBalance: 'Debit', linkedDomain: 'Stocktake', status: 'Active' },
  { accountCode: '4200', accountName: 'Stocktake Gain Placeholder', accountType: 'Income', normalBalance: 'Credit', linkedDomain: 'Stocktake', status: 'Review' },
  { accountCode: '2100', accountName: 'Supplier Liability Placeholder', accountType: 'Liability', normalBalance: 'Credit', linkedDomain: 'GRN', status: 'Review' },
  { accountCode: '2150', accountName: 'Supplier Credit Note Expected', accountType: 'Liability', normalBalance: 'Debit', linkedDomain: 'Supplier Return', status: 'Review' },
  { accountCode: '9999', accountName: 'Suspense / Review Account', accountType: 'Review', normalBalance: 'Debit', linkedDomain: 'Unresolved Mapping', status: 'Review' }
];

export const mockAccountingMappingRules: AccountingMappingRule[] = [
  { ruleId: 'MAP-GRN', movementType: 'GOODS_RECEIVED', impactType: 'Inventory Asset Increase', debitAccountCode: '1200', creditAccountCode: '2100', mappingStatus: 'Mapped', notes: 'GOODS_RECEIVED maps to inventory asset increase.' },
  { ruleId: 'MAP-SRT', movementType: 'SUPPLIER_RETURN', impactType: 'Supplier Return Credit Expected', debitAccountCode: '2150', creditAccountCode: '1200', mappingStatus: 'Mapped', notes: 'Supplier return decreases inventory and expects supplier credit.' },
  { ruleId: 'MAP-ADJ-IN', movementType: 'STOCK_ADJUSTMENT_IN', impactType: 'Inventory Asset Increase', debitAccountCode: '1200', creditAccountCode: '9999', mappingStatus: 'Review Required', notes: 'Positive adjustment requires review credit account.' },
  { ruleId: 'MAP-ADJ-OUT', movementType: 'STOCK_ADJUSTMENT_OUT', impactType: 'Inventory Asset Decrease', debitAccountCode: '9999', creditAccountCode: '1200', mappingStatus: 'Review Required', notes: 'Negative adjustment requires review.' },
  { ruleId: 'MAP-WRITE-OFF', movementType: 'WRITE_OFF', impactType: 'Inventory Write Off', debitAccountCode: '5100', creditAccountCode: '1200', mappingStatus: 'Mapped', notes: 'Write-off review placeholder.' },
  { ruleId: 'MAP-STK-GAIN', movementType: 'STOCKTAKE_GAIN', impactType: 'Stocktake Gain', debitAccountCode: '1200', creditAccountCode: '4200', mappingStatus: 'Mapped', notes: 'Stocktake gain placeholder.' },
  { ruleId: 'MAP-STK-LOSS', movementType: 'STOCKTAKE_LOSS', impactType: 'Stocktake Loss', debitAccountCode: '5200', creditAccountCode: '1200', mappingStatus: 'Mapped', notes: 'Stocktake loss placeholder.' },
  { ruleId: 'MAP-BR-OUT', movementType: 'BRANCH_TRANSFER_OUT', impactType: 'Transfer Neutral', mappingStatus: 'Mapped', notes: 'Transfer neutral unless valuation policy is added.' },
  { ruleId: 'MAP-WH-IN', movementType: 'WAREHOUSE_TRANSFER_IN', impactType: 'Transfer Neutral', mappingStatus: 'Mapped', notes: 'Transfer neutral unless valuation policy is added.' }
];

export const mockInventoryAccountingActivityEvents: InventoryAccountingActivityEvent[] = [
  { id: 'IAR-ACT-001', eventType: 'INVENTORY_ACCOUNTING_REVIEW_PREPARED', readinessId: 'IAR-ID-0001', sourceNumber: 'GRN-0003', message: 'Inventory accounting review prepared for posted GRN.', staffId: 'ST-BLESSING', createdAt: '2026-06-12T08:10:00Z' },
  { id: 'IAR-ACT-002', eventType: 'INVENTORY_WRITE_OFF_REVIEW', readinessId: 'IAR-ID-0003', sourceNumber: 'STA-0002', message: 'Write-off accounting readiness placed on hold.', staffId: 'ST-ADMIN', createdAt: '2026-06-12T08:30:00Z' },
  { id: 'IAR-ACT-003', eventType: 'STOCKTAKE_LOSS_ACCOUNTING_REVIEW', readinessId: 'IAR-ID-0004', sourceNumber: 'STK-0004', message: 'Critical stocktake loss accounting review prepared.', staffId: 'ST-ADMIN', createdAt: '2026-06-12T08:40:00Z' }
];

export const mockAccountingActivityEvents: AccountingActivityEvent[] = [
  { id: 'ACC-ACT-001', timestamp: '2026-06-09T14:30:00Z', eventType: 'SALES_POSTING_REVIEWED', message: 'Sales posting review opened for RCT-0003.', operator: 'Admin User' },
  { id: 'ACC-ACT-002', timestamp: '2026-06-09T14:32:00Z', eventType: 'PAYMENT_POSTING_REVIEWED', message: 'Payment posting review opened for Cash.', operator: 'Admin User' },
  { id: 'ACC-ACT-003', timestamp: '2026-06-09T14:34:00Z', eventType: 'CASHBOOK_ENTRY_CREATED', message: 'Cash variance placeholder entry created.', operator: 'Tawanda Supervisor' },
  { id: 'ACC-ACT-004', timestamp: '2026-06-09T14:36:00Z', eventType: 'VAT_SUMMARY_VIEWED', message: 'VAT summary viewed for 2026-06-09.', operator: 'Admin User' },
  { id: 'ACC-ACT-005', timestamp: '2026-06-09T14:38:00Z', eventType: 'COGS_RESERVED', message: 'COGS reserve placeholder calculated.', operator: 'Admin User' },
  { id: 'ACC-ACT-006', timestamp: '2026-06-09T14:39:00Z', eventType: 'COGS_USED', message: 'COGS reserve used placeholder available for future settlement.', operator: 'Admin User' },
  { id: 'ACC-ACT-007', timestamp: '2026-06-09T14:40:00Z', eventType: 'COGS_MISUSE_ATTEMPT', message: 'COGS misuse risk placeholder flagged for owner review.', operator: 'Admin User' },
  { id: 'ACC-ACT-008', timestamp: '2026-06-09T14:41:00Z', eventType: 'COGS_RESERVE_REVIEW_REQUIRED', message: 'COGS reserve review required for write-off.', operator: 'Admin User' },
  { id: 'ACC-ACT-009', timestamp: '2026-06-09T14:42:00Z', eventType: 'INVENTORY_ASSET_POSTING_REVIEWED', message: 'Inventory asset posting review opened.', operator: 'Blessing Stock' },
  { id: 'ACC-ACT-010', timestamp: '2026-06-09T14:44:00Z', eventType: 'ACCOUNTING_READINESS_CHECK_RUN', message: 'Accounting readiness checklist run.', operator: 'Admin User' },
  { id: 'ACC-ACT-011', timestamp: '2026-06-09T14:46:00Z', eventType: 'ACCOUNTING_REPORT_EXPORT_PREPARED', message: 'Accounting report export prepared.', operator: 'Admin User' }
];

const allPOSFeatures: POSFeatureKey[] = [
  'SALES_TERMINAL',
  'STOCK_CONTROL',
  'SHIFT_CONTROL',
  'CASH_CONTROL',
  'BI_DESK',
  'CUSTOMER_DESK',
  'DELIVERY_DESK',
  'SYNC_DESK',
  'OWNER_DESK',
  'SETTINGS',
  'OFFLINE_QUEUE',
  'RECEIPT_PREVIEW',
  'RETURNS_REFUNDS',
  'GOODS_RECEIVING',
  'STOCKTAKE',
  'ROLE_PERMISSIONS',
  'EOD_RECONCILIATION'
];

export const mockPOSPlans: POSPlan[] = [
  {
    tier: 'POS Starter',
    monthlyPrice: 20,
    branchesAllowed: 1,
    terminalsAllowed: 1,
    staffAllowed: 3,
    productsAllowed: 500,
    enabledFeatures: ['SALES_TERMINAL', 'SHIFT_CONTROL', 'RECEIPT_PREVIEW', 'SYNC_DESK']
  },
  {
    tier: 'POS Growth',
    monthlyPrice: 32,
    branchesAllowed: 2,
    terminalsAllowed: 4,
    staffAllowed: 10,
    productsAllowed: 2500,
    enabledFeatures: [
      'SALES_TERMINAL',
      'STOCK_CONTROL',
      'SHIFT_CONTROL',
      'CASH_CONTROL',
      'CUSTOMER_DESK',
      'DELIVERY_DESK',
      'SYNC_DESK',
      'SETTINGS',
      'OFFLINE_QUEUE',
      'RECEIPT_PREVIEW',
      'RETURNS_REFUNDS',
      'GOODS_RECEIVING',
      'STOCKTAKE'
    ]
  },
  {
    tier: 'POS Pro',
    monthlyPrice: 50,
    branchesAllowed: 8,
    terminalsAllowed: 20,
    staffAllowed: 60,
    productsAllowed: 10000,
    enabledFeatures: allPOSFeatures.filter((feature) => feature !== 'ROLE_PERMISSIONS')
  },
  {
    tier: 'POS Enterprise',
    monthlyPrice: 'custom',
    branchesAllowed: 'unlimited',
    terminalsAllowed: 'unlimited',
    staffAllowed: 'unlimited',
    productsAllowed: 'unlimited',
    enabledFeatures: allPOSFeatures
  }
];

export const mockVendorPOSSubscription: VendorPOSSubscription = {
  vendorId: 'SCI-LOG-ZW',
  planTier: 'POS Growth',
  status: 'Active',
  trialStartedAt: '2026-05-01T00:00:00Z',
  trialEndsAt: '2026-05-15T23:59:59Z',
  currentPeriodEndsAt: '2026-07-01T00:00:00Z',
  billingCurrency: 'USD',
  billingSource: 'Digital Commerce / SCI Managed',
  graceDaysRemaining: 0
};

export const mockVendorPOSLicense: VendorPOSLicense = {
  vendorId: 'SCI-LOG-ZW',
  licenseStatus: 'Active',
  licenseKey: 'ITREDPOS-MOCK-LICENSE-XXXX',
  activatedAt: '2026-05-01T00:00:00Z',
  expiresAt: '2027-05-01T00:00:00Z',
  lastCheckedAt: '2026-06-09T08:00:00Z',
  activationSource: 'Digital Commerce / SCI Support Mock',
  offlineGraceAllowed: true,
  offlineGraceDays: 7
};

const posFeatureLabels: Record<POSFeatureKey, string> = {
  SALES_TERMINAL: 'Sales Terminal',
  STOCK_CONTROL: 'Stock Control',
  SHIFT_CONTROL: 'Shift Control',
  CASH_CONTROL: 'Cash Control',
  BI_DESK: 'BI Desk',
  CUSTOMER_DESK: 'Customer Desk',
  DELIVERY_DESK: 'Delivery Desk',
  SYNC_DESK: 'Sync Desk',
  OWNER_DESK: 'Owner Desk',
  SETTINGS: 'Settings',
  OFFLINE_QUEUE: 'Offline Queue',
  RECEIPT_PREVIEW: 'Receipt Preview',
  RETURNS_REFUNDS: 'Returns and Refunds',
  GOODS_RECEIVING: 'Goods Receiving',
  STOCKTAKE: 'Stocktake',
  ROLE_PERMISSIONS: 'Role Permissions',
  EOD_RECONCILIATION: 'EOD Reconciliation'
};

const growthEnabledFeatures = mockPOSPlans.find((plan) => plan.tier === 'POS Growth')?.enabledFeatures || [];

export const mockPOSFeatureEntitlements: POSFeatureEntitlement[] = allPOSFeatures.map((featureKey) => {
  const enabled = growthEnabledFeatures.includes(featureKey);
  const proFeature = featureKey === 'BI_DESK' || featureKey === 'OWNER_DESK' || featureKey === 'EOD_RECONCILIATION' || featureKey === 'ROLE_PERMISSIONS';
  return {
    vendorId: 'SCI-LOG-ZW',
    featureKey,
    label: posFeatureLabels[featureKey],
    enabled,
    sourcePlan: 'POS Growth',
    status: enabled ? 'Enabled' : proFeature ? 'Pro Feature' : 'Not in Plan',
    uiEffect: enabled ? 'Visible and available in POS.' : 'Show plan badge and ask the vendor to contact Digital Commerce / SCI support.'
  };
});
