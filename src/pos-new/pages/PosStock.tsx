import React, { useState, useMemo, useEffect, FormEvent } from 'react';
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle, 
  ArrowUpDown, 
  PlusCircle, 
  RefreshCw,
  TrendingUp,
  Warehouse,
  MapPin,
  ClipboardList,
  Sliders,
  FileSpreadsheet,
  ArrowRightLeft,
  ShoppingBag,
  History,
  Activity,
  Check,
  X,
  AlertCircle,
  Clock,
  Download,
  SlidersHorizontal,
  Package,
  Eye,
  Settings,
  Send,
  AlertTriangle,
  Shield
} from 'lucide-react';
import {
  Product,
  PosSession,
  Role,
  ApprovalRequest,
  ApprovalRequestType,
  InventoryMovement,
  InventoryMovementFilters,
  InventoryMovementType,
  InventoryReferenceType,
  InventoryMovementStatus,
  ProductLedgerFilters,
  ProductLedgerSummary,
  StockHealthFilters,
  StockHealthRow,
  StockHealthSummary,
  InventoryReportFilters,
  InventoryReportType,
  StockValuationRow,
  MovementSummaryRow,
  MovementSummaryReportTotals,
  ShelfLocationReportRow,
  COAInventoryReportRow,
  SupplierStockReportRow
} from '../types';
import { mockProducts } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';
import { addLocalQueueItem } from '../utils/localQueueStore';
import StockPanels from './StockPanels';
import { normalizeProductNumericNumber } from '../utils/productNumberUtils';
import { matchesFreeOrderSearch } from '../utils/searchUtils';
import {
  exportProductLedgerPlaceholder,
  filterLedgerMovements,
  formatMovementTypeLabel,
  getLedgerSummaryFromMovements,
  getProductLedgerMovements,
  recordProductListEvent
} from '../services/productLedgerService';
import {
  getInventoryMovementSummary,
  getInventoryMovementsByFilters,
  postGoodsReceivedMovement,
  postStockAdjustmentMovement,
  postStocktakeAdjustmentMovement,
  postTransferMovement,
  getInventoryMovementEvents,
  reverseInventoryMovement
} from '../services/inventoryMovementService';
import { evaluateStockHealth, getStockHealthRows, getStockHealthSummary } from '../services/stockHealthService';
import {
  exportInventoryReportPlaceholder,
  getCOAInventoryReport,
  getMovementSummaryReport,
  getMovementSummaryReportTotals,
  getShelfLocationReport,
  getStockValuationReport,
  getSupplierStockReport
} from '../services/inventoryReportService';

interface PosStockProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateStock: (productId: string, newStock: number) => void;
  onUpdateMinStock: (productId: string, newMin: number) => void;
  onUpdateProduct?: (updatedProduct: Product) => void;
  session?: PosSession | null;
}

interface StockProduct extends Product {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Dead Stock' | 'Variance Risk' | 'Fast Moving' | 'Slow Moving';
}

interface StockActivityEvent {
  id: string;
  time: string;
  type: 'STOCKTAKE_SUBMITTED' | 'STOCKTAKE_STARTED' | 'STOCKTAKE_COUNTED' | 'STOCK_ADJUSTMENT_REQUESTED' | 'LOW_STOCK_REMINDER' | 'SALE_BLOCKED_ZERO_STOCK' | 'RECOMMEND_MAJOR_STOCKTAKE' | 'STOCK_RECEIVED' | 'STOCK_TRANSFERRED';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
}

type StockTab = 'Stock List' | 'Product List' | 'Product Ledger' | 'Inventory Movements' | 'Stock Health' | 'Inventory Reports' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake';

// Interactive default mock products specified by user request dynamically generated from mockPosData
const INDUSTRIAL_SECTORS = ['Motor Spares', 'Mining Supplies', 'Retail FMCG', 'Agriculture', 'Hardware'] as const;
const PRODUCT_SUB_CATEGORIES = ['Suspension', 'Braking', 'Cooling', 'Electrical', 'Lubricants', 'Fasteners'] as const;

const DEFAULT_STOCK_ITEMS: StockProduct[] = mockProducts.map((p, index) => {
  let stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Dead Stock' | 'Variance Risk' | 'Fast Moving' | 'Slow Moving' = 'In Stock';
  let riskLevel: 'Low' | 'Medium' | 'High' | 'Critical' = 'Low';

  if (p.stock === 0) {
    stockStatus = 'Out of Stock';
    riskLevel = 'Critical';
  } else if (p.stock <= p.minStock) {
    stockStatus = 'Low Stock';
    riskLevel = 'High';
  } else if (p.code === 'RAD-COROLLA' || p.code === 'PSG-B10') {
    stockStatus = 'Variance Risk';
    riskLevel = 'High';
  } else if (p.code === 'SLV-D24') {
    stockStatus = 'Dead Stock';
    riskLevel = 'Medium';
  } else if (p.stock > 30) {
    stockStatus = 'Fast Moving';
    riskLevel = 'Medium';
  }

  return {
    ...p,
    vendorId: 'SCI-LOG-ZW',
    branchId: p.branch || 'Harare Main',
    warehouseId: p.warehouse || 'Main Warehouse',
    industrialSector: INDUSTRIAL_SECTORS[index % INDUSTRIAL_SECTORS.length],
    productCategory: p.category,
    productSubCategory: PRODUCT_SUB_CATEGORIES[index % PRODUCT_SUB_CATEGORIES.length],
    sku: p.code,
    barcode: `600${normalizeProductNumericNumber(String(index + 1001))}`,
    alu: `ALU-${p.code}`,
    productNumericNumber: normalizeProductNumericNumber(String(index + 1)),
    productName: p.name,
    brand: p.brand || ['Toyota', 'Nissan', 'Honda', 'SCI Industrial'][index % 4],
    manufacturer: p.manufacturer || ['Denso', 'Genuine Parts', 'Bosch', 'SKF'][index % 4],
    supplierId: `SUP-${String((index % 4) + 1).padStart(3, '0')}`,
    supplierName: p.supplierName || ['ABC Motor Spares Supplier', 'Harare Lubricants Ltd', 'Toyota Parts Wholesale', 'Industrial Line Supply'][index % 4],
    shelfLocation: (p.code === 'STL-A40' || p.code === 'PSG-B10') ? '' : `A${(index % 4) + 1}-S${(index % 6) + 1}`,
    binLocation: `BIN-${String(index + 1).padStart(3, '0')}`,
    unitOfMeasure: p.unit || 'EA',
    qtyOnHand: p.stock,
    reorderLevel: p.minStock,
    costPrice: p.cost,
    sellingPrice: p.price,
    branch: p.code === 'STL-A40' ? 'Bulawayo Depot' : (p.branch || 'Harare Main'),
    warehouse: p.code === 'STL-A40' ? 'North Shed' : (p.warehouse || 'Main Warehouse'),
    salesAccountCOA: p.category === 'Lubricants' ? '4020-SALES-LUBRICANTS' : p.category === 'Motor Spares' ? '4010-SALES-MOTOR' : '4000-SALES-STOCK',
    assetAccountCOA: p.category === 'Lubricants' ? '1220-INVENTORY-LUBRICANTS' : p.category === 'Motor Spares' ? '1210-INVENTORY-MOTOR' : '1400-INVENTORY-ASSET',
    isSerialized: index % 5 === 0,
    isActive: true,
    createdByStaffId: 'SYSTEM',
    createdAt: '2026-06-09T08:00:00.000Z',
    updatedAt: '2026-06-09T08:00:00.000Z',
    stockStatus,
    riskLevel
  };
});

export default function PosStock({
  products,
  onAddProduct,
  onUpdateStock,
  onUpdateMinStock,
  onUpdateProduct,
  session
}: PosStockProps) {

  // Dynamic Session defaults
  const activeBranch = session?.branch || 'Harare Main';
  const staffName = session?.staffName || 'Admin Operator';

  // Tabbed Routing inside Stock Control
  const [activeTab, setActiveTab] = useState<StockTab>('Stock List');
  
  // Simulated access role clearance override
  const [simulatedRole, setSimulatedRole] = useState<Role>(session?.role || 'Stock Controller');

  // Shared Stock Approvals queue
  const [stockApprovals, setStockApprovals] = useState<ApprovalRequest[]>(() => {
    const cached = localStorage.getItem('sci_pos_stock_approvals');
    if (cached) return JSON.parse(cached);
    return [
      {
        id: 'APR-GRN-01',
        type: 'GRN Variance Approval',
        status: 'Pending',
        requestedBy: 'Stock Controller',
        notes: 'GRN-2026-9041 contains short supply - received 18/20 Ball Joints. Requires Supervisor approval.',
        createdAt: '2026-06-08T09:12:00Z',
        payload: {
          grnNumber: 'GRN-2026-9041',
          grnSupplier: 'ABC Motor Spares Supplier',
          grnInvoiceNo: 'INV-9921',
          grnPoRef: 'PO-1001',
          items: [
            { sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', orderedQty: 20, receivedQty: 18, costPrice: 7.00, prevCostPrice: 6.80, status: 'Short Received', currentPrice: 12, suggestedPrice: 13, accepted: false, rejected: false, priceUpdated: false, flagged: false }
          ]
        }
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('sci_pos_stock_approvals', JSON.stringify(stockApprovals));
  }, [stockApprovals]);

  const canApprove = (type: ApprovalRequestType, role: Role): boolean => {
    if (role === 'Owner' || role === 'SysAdmin' || role === 'Manager') return true;
    if (role === 'Supervisor') {
      return type !== 'Stocktake Variance Approval';
    }
    return false;
  };

  // State of local Stock database (allowing real modifications & audits locally)
  const [localStock, setLocalStock] = useState<StockProduct[]>(() => {
    const cached = localStorage.getItem('sci_pos_stock_catalog');
    return cached ? JSON.parse(cached) : DEFAULT_STOCK_ITEMS;
  });

  const saveLocalStockState = (newStock: StockProduct[]) => {
    setLocalStock(newStock);
    localStorage.setItem('sci_pos_stock_catalog', JSON.stringify(newStock));
  };

  // State of Stock event feed
  const [activityFeed, setActivityFeed] = useState<StockActivityEvent[]>([
    {
      id: 'EV-1',
      time: '15:42:15',
      type: 'STOCKTAKE_SUBMITTED',
      severity: 'Medium',
      message: 'Brake Pads Toyota GD6 counted below system quantity'
    },
    {
      id: 'EV-2',
      time: '14:20:10',
      type: 'STOCK_ADJUSTMENT_REQUESTED',
      severity: 'High',
      message: 'Radiator Toyota Corolla adjustment requested'
    },
    {
      id: 'EV-3',
      time: '11:05:00',
      type: 'LOW_STOCK_REMINDER',
      severity: 'Medium',
      message: 'Brake Pads Toyota GD6 below reorder level'
    },
    {
      id: 'EV-4',
      time: '09:12:45',
      type: 'SALE_BLOCKED_ZERO_STOCK',
      severity: 'Critical',
      message: 'Clutch Plate Nissan N16 blocked at sale'
    },
    {
      id: 'EV-5',
      time: '08:00:30',
      type: 'RECOMMEND_MAJOR_STOCKTAKE',
      severity: 'High',
      message: 'Variance risk detected in Motor Spares category'
    }
  ]);

  // View focused Item right drawer details
  const [selectedProduct, setSelectedProduct] = useState<StockProduct | null>(DEFAULT_STOCK_ITEMS[0]);

  // Operational Filtering & Search parameters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [selectedShelf, setSelectedShelf] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [productListSearch, setProductListSearch] = useState('');
  const [productLedgerProduct, setProductLedgerProduct] = useState<StockProduct | null>(null);
  const [productLedgerEntries, setProductLedgerEntries] = useState<InventoryMovement[]>([]);
  const [allInventoryMovements, setAllInventoryMovements] = useState<InventoryMovement[]>([]);
  const [productLedgerNotice, setProductLedgerNotice] = useState<string | null>(null);
  const [productLedgerFilters, setProductLedgerFilters] = useState<ProductLedgerFilters>({
    branch: 'ALL',
    warehouse: 'ALL',
    shelfLocation: 'ALL',
    movementType: 'ALL',
    referenceType: 'ALL',
    staff: 'ALL',
    status: 'ALL'
  });
  const [movementSummaryFilters, setMovementSummaryFilters] = useState<InventoryMovementFilters>({
    vendorId: 'SCI-LOG-ZW',
    branchId: 'ALL',
    warehouseId: 'ALL',
    sector: 'ALL',
    category: 'ALL'
  });
  const [stocktakePreselect, setStocktakePreselect] = useState<{ shelfLocation?: string; productIds?: string[] } | null>(null);
  const [stocktakePreselectToken, setStocktakePreselectToken] = useState(0);
  const [inventorySummary, setInventorySummary] = useState({
    totalSaleQtyOut: 0,
    totalReturnQtyIn: 0,
    totalGoodsReceivedQtyIn: 0,
    totalAdjustmentQtyIn: 0,
    totalAdjustmentQtyOut: 0,
    totalTransferIn: 0,
    totalTransferOut: 0,
    totalSupplierReturnQtyOut: 0,
    netMovement: 0,
    highRiskMovements: 0
  });
  const [inventoryMovementEvents, setInventoryMovementEvents] = useState<Array<{ id: string; eventType: string; message: string; createdAt: string }>>([]);
  const [stockHealthFilters, setStockHealthFilters] = useState<StockHealthFilters>({
    vendorId: 'SCI-LOG-ZW',
    branch: 'ALL',
    warehouse: 'ALL',
    industrialSector: 'ALL',
    category: 'ALL',
    brand: 'ALL',
    supplier: 'ALL',
    shelfLocation: 'ALL',
    stockStatus: 'ALL',
    riskLevel: 'ALL',
    movementPeriod: 'Last 30 Days',
    includeSerialized: true
  });
  const [reportFilters, setReportFilters] = useState<InventoryReportFilters>({
    vendorId: 'SCI-LOG-ZW',
    branch: 'ALL',
    warehouse: 'ALL',
    industrialSector: 'ALL',
    category: 'ALL',
    brand: 'ALL',
    supplier: 'ALL',
    shelfLocation: 'ALL',
    reportType: 'Stock Valuation'
  });
  const [stockHealthRows, setStockHealthRows] = useState<StockHealthRow[]>([]);
  const [stockHealthSummary, setStockHealthSummary] = useState<StockHealthSummary>({
    totalProducts: 0,
    totalStockUnits: 0,
    inventoryValueAtCost: 0,
    inventoryValueAtSellingPrice: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    deadStockItems: 0,
    slowMovingItems: 0,
    fastMovingItems: 0,
    varianceRiskItems: 0,
    serializedItems: 0,
    productsWithoutShelfLocation: 0
  });
  const [valuationRows, setValuationRows] = useState<StockValuationRow[]>([]);
  const [movementReportRows, setMovementReportRows] = useState<MovementSummaryRow[]>([]);
  const [movementReportTotals, setMovementReportTotals] = useState<MovementSummaryReportTotals>({
    totalQtyIn: 0,
    totalQtyOut: 0,
    netMovement: 0,
    highRiskMovements: 0,
    reversalCount: 0,
    pendingApprovalMovements: 0
  });
  const [shelfReportRows, setShelfReportRows] = useState<ShelfLocationReportRow[]>([]);
  const [coaReportRows, setCOAReportRows] = useState<COAInventoryReportRow[]>([]);
  const [supplierReportRows, setSupplierReportRows] = useState<SupplierStockReportRow[]>([]);
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [reviewedHealthProducts, setReviewedHealthProducts] = useState<Set<string>>(new Set());
  const [reviewedShelves, setReviewedShelves] = useState<Set<string>>(new Set());

  // Interactive sorting configurations
  const [sortField, setSortField] = useState<'code' | 'name' | 'stock' | 'minStock' | 'productNumericNumber'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals visibility toggles
  const [activeModal, setActiveModal] = useState<'NONE' | 'STOCKTAKE' | 'ADJUSTMENT' | 'TRANSFER' | 'RECEIVE_GOODS' | 'EXPORT' | 'VARIANCE_ALERT'>('NONE');
  
  // Modal State data bindings
  const [modalTargetProduct, setModalTargetProduct] = useState<StockProduct | null>(null);
  
  // A. Stocktake Form Binding
  const [stPhysicalCount, setStPhysicalCount] = useState<string>('');
  const [stRemarks, setStRemarks] = useState<string>('');

  // B. Adjustment Form Binding
  const [adjType, setAdjType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjQuantity, setAdjQuantity] = useState<string>('');
  const [adjReason, setAdjReason] = useState<string>('Inventory Correction');

  // C. Transfer Form Binding
  const [trQuantity, setTrQuantity] = useState<string>('');
  const [trDestBranch, setTrDestBranch] = useState<string>('Bulawayo Depot');
  const [trDestWarehouse, setTrDestWarehouse] = useState<string>('North Shed');

  // D. Receive Goods Form Binding
  const [rxProductId, setRxProductId] = useState<string>('');
  const [rxQuantity, setRxQuantity] = useState<string>('');
  const [rxPoRef, setRxPoRef] = useState<string>('');
  const [rxSupplier, setRxSupplier] = useState<string>('Premium Spares Ltd');

  // --- FILTER MATH & OPTIONS ---
  const branches = useMemo(() => {
    const list = new Set(localStock.map(p => p.branch).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const warehouses = useMemo(() => {
    const list = new Set(localStock.map(p => p.warehouse).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const categories = useMemo(() => {
    const list = new Set(localStock.map(p => p.productCategory || p.category).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const sectors = useMemo(() => {
    const list = new Set(localStock.map(p => p.industrialSector).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const shelfLocations = useMemo(() => {
    const list = new Set(localStock.map(p => p.shelfLocation).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const suppliers = useMemo(() => {
    const list = new Set(localStock.map(p => p.supplierName || p.supplier).filter(Boolean));
    return ['ALL', ...Array.from(list)] as string[];
  }, [localStock]);

  const statuses = [
    'ALL',
    'In Stock',
    'Low Stock',
    'Out of Stock',
    'Dead Stock',
    'Variance Risk',
    'Fast Moving',
    'Slow Moving'
  ];

  // Table computations
  const sortedAndFilteredStock = useMemo(() => {
    return localStock
      .filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.productNumericNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.alu || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (item.shelfLocation || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranch === 'ALL' || item.branch === selectedBranch;
        const matchesWarehouse = selectedWarehouse === 'ALL' || item.warehouse === selectedWarehouse;
        const matchesCategory = selectedCategory === 'ALL' || (item.productCategory || item.category) === selectedCategory;
        const matchesSector = selectedSector === 'ALL' || item.industrialSector === selectedSector;
        const matchesShelf = selectedShelf === 'ALL' || item.shelfLocation === selectedShelf;
        const matchesSupplier = selectedSupplier === 'ALL' || (item.supplierName || item.supplier) === selectedSupplier;
        const matchesStatus = selectedStatus === 'ALL' || item.stockStatus === selectedStatus;

        return matchesSearch && matchesBranch && matchesWarehouse && matchesCategory && matchesSector && matchesShelf && matchesSupplier && matchesStatus;
      })
      .sort((a, b) => {
        const fieldA = a[sortField] ?? '';
        const fieldB = b[sortField] ?? '';

        if (typeof fieldA === 'string' && typeof fieldB === 'string') {
          return sortAsc ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
        }
        if (typeof fieldA === 'number' && typeof fieldB === 'number') {
          return sortAsc ? fieldA - fieldB : fieldB - fieldA;
        }
        return 0;
      });
  }, [localStock, searchTerm, selectedBranch, selectedWarehouse, selectedCategory, selectedSector, selectedShelf, selectedSupplier, selectedStatus, sortField, sortAsc]);

  const productListRows = useMemo(() => {
    return localStock.filter((item) => matchesFreeOrderSearch(item, productListSearch, [
      'name',
      'code',
      'productName',
      'sku',
      'barcode',
      'alu',
      'productNumericNumber',
      'brand',
      'manufacturer',
      'supplierName',
      'shelfLocation',
      'binLocation',
      'serialNumber',
      'industrialSector',
      'productCategory',
      'productSubCategory',
      'category'
    ]));
  }, [localStock, productListSearch]);

  const filteredProductLedgerEntries = useMemo(
    () => filterLedgerMovements(productLedgerEntries, productLedgerFilters),
    [productLedgerEntries, productLedgerFilters]
  );

  const productLedgerSummary: ProductLedgerSummary = useMemo(
    () => getLedgerSummaryFromMovements(filteredProductLedgerEntries),
    [filteredProductLedgerEntries]
  );

  const ledgerBranchOptions = useMemo(() => ['ALL', ...Array.from(new Set(productLedgerEntries.map((entry) => entry.branchId)))], [productLedgerEntries]);
  const ledgerWarehouseOptions = useMemo(() => ['ALL', ...Array.from(new Set(productLedgerEntries.map((entry) => entry.warehouseId)))], [productLedgerEntries]);
  const ledgerShelfOptions = useMemo(() => ['ALL', ...Array.from(new Set(productLedgerEntries.map((entry) => entry.shelfLocation || 'N/A')))], [productLedgerEntries]);
  const ledgerStaffOptions = useMemo(() => ['ALL', ...Array.from(new Set(productLedgerEntries.map((entry) => entry.staffName)))], [productLedgerEntries]);

  const ledgerMovementTypeOptions: Array<'ALL' | InventoryMovementType> = [
    'ALL',
    'OPENING_BALANCE',
    'SALE',
    'SALE_RETURN',
    'GOODS_RECEIVED',
    'STOCK_ADJUSTMENT_IN',
    'STOCK_ADJUSTMENT_OUT',
    'STOCKTAKE_ADJUSTMENT_IN',
    'STOCKTAKE_ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'SUPPLIER_RETURN',
    'DAMAGE_WRITEOFF',
    'MANUAL_CORRECTION'
  ];

  const ledgerReferenceTypeOptions: Array<'ALL' | InventoryReferenceType> = [
    'ALL',
    'RECEIPT',
    'RETURN',
    'GRN',
    'STOCKTAKE',
    'ADJUSTMENT',
    'TRANSFER',
    'SUPPLIER_RETURN',
    'DAMAGE',
    'MANUAL'
  ];
  const vendorOptions = useMemo(() => ['SCI-LOG-ZW'], []);
  const healthBranchOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.branch || item.branchId).filter(Boolean)))], [localStock]);
  const healthWarehouseOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.warehouse || item.warehouseId).filter(Boolean)))], [localStock]);
  const healthSectorOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.industrialSector).filter(Boolean)))], [localStock]);
  const healthBrandOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.brand).filter(Boolean)))], [localStock]);
  const healthSupplierOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.supplierName).filter(Boolean)))], [localStock]);
  const healthShelfOptions = useMemo(() => ['ALL', 'UNASSIGNED', ...Array.from(new Set(localStock.map((item) => item.shelfLocation).filter(Boolean)))], [localStock]);
  const displayedValuationRows = useMemo(() => {
    const productIdsByReport = new Set(stockHealthRows.filter((row) => {
      switch (reportFilters.reportType) {
        case 'Low Stock Report':
          return row.stockStatus === 'Low Stock';
        case 'Out of Stock Report':
          return row.stockStatus === 'Out of Stock';
        case 'Dead Stock Report':
          return row.movementClass === 'Dead Stock';
        case 'Slow Moving Stock Report':
          return row.movementClass === 'Slow Moving';
        case 'Fast Moving Stock Report':
          return row.movementClass === 'Fast Moving';
        case 'Variance Risk Report':
          return row.recommendedAction === 'Stocktake Required';
        default:
          return true;
      }
    }).map((row) => row.sku));

    if (!['Low Stock Report', 'Out of Stock Report', 'Dead Stock Report', 'Slow Moving Stock Report', 'Fast Moving Stock Report', 'Variance Risk Report'].includes(reportFilters.reportType || '')) {
      return valuationRows;
    }
    return valuationRows.filter((row) => productIdsByReport.has(row.sku));
  }, [reportFilters.reportType, stockHealthRows, valuationRows]);

  useEffect(() => {
    if (activeTab === 'Product List') {
      void recordProductListEvent('PRODUCT_LIST_VIEWED', 'Product List viewed.');
    }
  }, [activeTab]);

  const handleProductSearchChange = (query: string) => {
    setProductListSearch(query);
    void recordProductListEvent('PRODUCT_SEARCH_APPLIED', `Product search applied: ${query || 'empty query'}.`);
  };

  const openProductLedger = async (product: StockProduct) => {
    setProductLedgerProduct(product);
    setProductLedgerNotice(null);
    const entries = await getProductLedgerMovements(product.id);
    setProductLedgerEntries(entries);
    if (entries.some((entry) => entry.riskFlag === 'High' || entry.riskFlag === 'Critical')) {
      void recordProductListEvent('LEDGER_VARIANCE_REVIEW_REQUIRED', `Ledger variance review required for ${product.sku || product.code}.`);
    }
    setProductLedgerFilters({
      branch: 'ALL',
      warehouse: 'ALL',
      shelfLocation: 'ALL',
      movementType: 'ALL',
      referenceType: 'ALL',
      staff: 'ALL',
      status: 'ALL'
    });
    setMovementSummaryFilters((current) => ({ ...current, productId: product.id, sku: product.sku || product.code }));
    setActiveTab('Product Ledger');
  };

  const handleLedgerFilterChange = (patch: Partial<ProductLedgerFilters>) => {
    setProductLedgerFilters((current) => ({ ...current, ...patch }));
    void recordProductListEvent('PRODUCT_LEDGER_FILTER_APPLIED', 'Product ledger filter applied.');
  };

  const startStocktakeFromProductListFilters = () => {
    if (productListRows.length === 0) return;
    const shelves = Array.from(new Set(productListRows.map((item) => item.shelfLocation).filter(Boolean)));
    setStocktakePreselect({
      shelfLocation: shelves.length === 1 ? shelves[0] : undefined,
      productIds: productListRows.map((item) => item.id)
    });
    setStocktakePreselectToken((token) => token + 1);
    setActiveTab('Stocktake');
  };

  const openStocktakeForProduct = (product: StockProduct) => {
    setStocktakePreselect({
      shelfLocation: product.shelfLocation,
      productIds: [product.id]
    });
    setStocktakePreselectToken((token) => token + 1);
    setActiveTab('Stocktake');
  };

  const handleLedgerExport = async () => {
    if (!productLedgerProduct) return;
    const result = await exportProductLedgerPlaceholder(productLedgerProduct.id);
    setProductLedgerNotice(result.message);
  };

  const handleInventoryReportExport = async (reportType: InventoryReportType) => {
    const result = await exportInventoryReportPlaceholder(reportType);
    setReportNotice(result.message);
  };

  const handleReverseMovement = async (movementId: string) => {
    const currentRole = session?.role || 'Owner';
    if (currentRole !== 'Owner' && currentRole !== 'Manager') {
      alert('Only Owner or Manager can reverse posted inventory movements during build-development.');
      return;
    }
    const reason = prompt('Reason for reversing this inventory movement?');
    if (!reason) return;
    const reversal = await reverseInventoryMovement(movementId, reason);
    if (reversal && productLedgerProduct) {
      setProductLedgerEntries(await getProductLedgerMovements(productLedgerProduct.id));
      setProductLedgerNotice('Inventory movement reversed. Original movement retained for audit.');
      void getInventoryMovementEvents().then(setInventoryMovementEvents);
    }
  };

  const handleStockHealthAction = (action: string, row: StockHealthRow) => {
    if (action === 'Create Purchase Reminder') {
      addLocalQueueItem({
        domain: 'Stock',
        eventType: 'LOW_STOCK_REMINDER',
        reference: row.sku,
        createdBy: staffName,
        risk: row.riskLevel === 'Critical' ? 'Critical' : 'Medium',
        payload: JSON.stringify({ productId: row.productId, recommendedAction: row.recommendedAction })
      });
    }
    if (action === 'Flag Risk') {
      addLocalQueueItem({
        domain: 'Stock',
        eventType: 'VARIANCE_RISK_FOUND',
        reference: row.sku,
        createdBy: staffName,
        risk: row.riskLevel,
        payload: JSON.stringify(row)
      });
    }
    if (action === 'Mark Reviewed') {
      setReviewedHealthProducts((current) => new Set([...current, row.productId]));
    }
    setReportNotice(`${action} recorded for ${row.sku}.`);
  };

  const handleShelfReportAction = (action: string, shelfLocation: string) => {
    if (action === 'Start Shelf Stocktake') {
      setStocktakePreselect({ shelfLocation: shelfLocation === 'UNASSIGNED' ? undefined : shelfLocation });
      setStocktakePreselectToken((token) => token + 1);
      setActiveTab('Stocktake');
    }
    if (action === 'Export Shelf List Placeholder') {
      void handleInventoryReportExport('Shelf / Location Report');
    }
    if (action === 'Mark Shelf Reviewed') {
      setReviewedShelves((current) => new Set([...current, shelfLocation]));
    }
    setReportNotice(`${action} recorded for shelf ${shelfLocation}.`);
  };

  useEffect(() => {
    const productContext = localStock.map((item) => ({
      id: item.id,
      industrialSector: item.industrialSector,
      productCategory: item.productCategory || item.category,
      category: item.category
    }));
    void getInventoryMovementSummary(movementSummaryFilters, productContext).then(setInventorySummary);
    void getInventoryMovementEvents().then(setInventoryMovementEvents);
    void getInventoryMovementsByFilters({ vendorId: 'SCI-LOG-ZW', ...movementSummaryFilters }, productContext).then(setAllInventoryMovements);
  }, [localStock, productLedgerEntries, movementSummaryFilters]);

  useEffect(() => {
    const loadStockHealth = async () => {
      if (activeTab === 'Stock Health') {
        const result = await evaluateStockHealth(localStock, allInventoryMovements, stockHealthFilters);
        setStockHealthRows(result.rows);
        setStockHealthSummary(result.summary);
        return;
      }
      setStockHealthRows(await getStockHealthRows(localStock, allInventoryMovements, stockHealthFilters));
      setStockHealthSummary(await getStockHealthSummary(localStock, allInventoryMovements, stockHealthFilters));
    };
    void loadStockHealth();
  }, [activeTab, allInventoryMovements, localStock, stockHealthFilters]);

  useEffect(() => {
    const loadReports = async () => {
      setValuationRows(await getStockValuationReport(localStock, reportFilters));
      setMovementReportRows(await getMovementSummaryReport(localStock, allInventoryMovements, reportFilters));
      setMovementReportTotals(await getMovementSummaryReportTotals(allInventoryMovements, reportFilters));
      setShelfReportRows(await getShelfLocationReport(localStock, allInventoryMovements, reportFilters));
      setCOAReportRows(await getCOAInventoryReport(localStock, allInventoryMovements, reportFilters));
      setSupplierReportRows(await getSupplierStockReport(localStock, allInventoryMovements, reportFilters));
    };
    void loadReports();
  }, [allInventoryMovements, localStock, reportFilters]);

  // Global counts & stats requested by user specifications
  const stats = useMemo(() => {
    return {
      totalProducts: 125, // Specified by requirements
      lowStockItems: 12,   // Specified by requirements
      outOfStockItems: 4,  // Specified by requirements
      deadStockItems: 7,   // Specified by requirements
      varianceRiskItems: 3,// Specified by requirements
      fastMovingItems: 18, // Specified by requirements
      calculatedUniqueEntries: localStock.length
    };
  }, [localStock]);

  // Log feed helper
  const triggerNewActivityEvent = (
    type: StockActivityEvent['type'],
    message: string,
    severity: StockActivityEvent['severity']
  ) => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    const newEv: StockActivityEvent = {
      id: 'EV-' + (activityFeed.length + 1),
      time: timeStr,
      type,
      severity,
      message
    };
    setActivityFeed(prev => [newEv, ...prev]);
  };

  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const buildMovementPayload = (product: StockProduct, referenceNumber: string, notes: string) => ({
    vendorId: product.vendorId || 'SCI-LOG-ZW',
    branchId: product.branchId || product.branch || activeBranch,
    warehouseId: product.warehouseId || product.warehouse || 'Main Warehouse',
    productId: product.id,
    sku: product.sku || product.code,
    alu: product.alu,
    productNumericNumber: product.productNumericNumber,
    productName: product.productName || product.name,
    shelfLocation: product.shelfLocation,
    unitCost: product.costPrice ?? product.cost,
    sellingPrice: product.sellingPrice ?? product.price,
    salesAccountCOA: product.salesAccountCOA,
    assetAccountCOA: product.assetAccountCOA,
    staffId: staffName,
    staffName,
    terminalId: 'TERMINAL_STOCK_DESK',
    movementDate: new Date().toISOString(),
    referenceNumber,
    notes,
    riskFlag: product.riskLevel === 'Critical' ? 'Critical' as const : product.riskLevel === 'High' ? 'High' as const : 'None' as const
  });

  // --- EVENT OPERATIONS CORES ---

  // 1. STOCKTAKE VERIFICATION
  const triggerStocktakeModal = (product: StockProduct) => {
    setModalTargetProduct(product);
    setStPhysicalCount(product.stock.toString());
    setStRemarks('Observed Physical Vault Quantities match.');
    setActiveModal('STOCKTAKE');
  };

  const handleStocktakeSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!modalTargetProduct) return;

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'STOCKTAKE')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: STOCKTAKE`);
      return;
    }

    const count = parseInt(stPhysicalCount);
    if (isNaN(count) || count < 0) {
      alert('[CRITICAL ERROR] Valid physical count is mandatory.');
      return;
    }

    const variance = count - modalTargetProduct.stock;
    const diffSign = variance >= 0 ? `+${variance}` : `${variance}`;

    // Compute next Statuses & risks
    let nextStatus = modalTargetProduct.stockStatus;
    let nextRisk = modalTargetProduct.riskLevel;

    if (variance !== 0) {
      nextStatus = 'Variance Risk';
      nextRisk = 'High';
    } else {
      nextStatus = count === 0 ? 'Out of Stock' : (count <= modalTargetProduct.minStock ? 'Low Stock' : 'In Stock');
      nextRisk = count === 0 ? 'Critical' : (count <= modalTargetProduct.minStock ? 'High' : 'Low');
    }

    const updated: StockProduct = {
      ...modalTargetProduct,
      stock: count,
      stockStatus: nextStatus,
      riskLevel: nextRisk,
      lastMovementDate: '2026-06-08'
    };

    const nextList = localStock.map(p => p.id === modalTargetProduct.id ? updated : p);
    saveLocalStockState(nextList);

    // Update parent global callbacks
    if (onUpdateProduct) {
      onUpdateProduct(updated);
    } else {
      onUpdateStock(modalTargetProduct.id, count);
    }
    if (variance !== 0) {
      const isIncrease = variance > 0;
      void postStocktakeAdjustmentMovement({
        ...buildMovementPayload(modalTargetProduct, `STK-${Date.now()}`, stRemarks || 'Physical stocktake adjustment.'),
        movementType: isIncrease ? 'STOCKTAKE_ADJUSTMENT_IN' : 'STOCKTAKE_ADJUSTMENT_OUT',
        referenceType: 'STOCKTAKE',
        qtyIn: isIncrease ? variance : 0,
        qtyOut: isIncrease ? 0 : Math.abs(variance),
        balanceBefore: modalTargetProduct.stock,
        approvalRequired: false,
        status: 'Posted',
        riskFlag: Math.abs(variance) > 5 ? 'Critical' : 'Medium'
      });
    }

    // Insert to Event Feed
    triggerNewActivityEvent(
      'STOCKTAKE_SUBMITTED',
      `Audit completed on [${modalTargetProduct.code}]: System Count offset ${diffSign} units. Count set to ${count}`,
      variance !== 0 ? 'High' : 'Medium'
    );

    // Sync focused panel
    setSelectedProduct(updated);
    setActiveModal('NONE');
    setModalTargetProduct(null);
  };

  // 2. STOCK ADJUSTMENTS
  const triggerAdjustmentModal = (product: StockProduct) => {
    setModalTargetProduct(product);
    setAdjType('ADD');
    setAdjQuantity('5');
    setAdjReason('Discrepancy mitigation');
    setActiveModal('ADJUSTMENT');
  };

  const handleAdjustmentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!modalTargetProduct) return;

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'STOCK_ADJUSTMENT')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: STOCK_ADJUSTMENT`);
      return;
    }

    const qty = parseInt(adjQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('[ERROR] Adjustment amount must be progressive positive.');
      return;
    }

    const direction = adjType === 'ADD' ? 1 : -1;
    const computedStock = Math.max(0, modalTargetProduct.stock + (qty * direction));
    const labelSign = adjType === 'ADD' ? `+${qty}` : `-${qty}`;

    const nextStatus = computedStock === 0 ? 'Out of Stock' : (computedStock <= modalTargetProduct.minStock ? 'Low Stock' : 'In Stock');
    const nextRisk = computedStock === 0 ? 'Critical' : (computedStock <= modalTargetProduct.minStock ? 'High' : 'Low');

    const updated: StockProduct = {
      ...modalTargetProduct,
      stock: computedStock,
      stockStatus: nextStatus,
      riskLevel: nextRisk,
      lastMovementDate: '2026-06-08'
    };

    const nextList = localStock.map(p => p.id === modalTargetProduct.id ? updated : p);
    saveLocalStockState(nextList);

    if (onUpdateProduct) {
      onUpdateProduct(updated);
    } else {
      onUpdateStock(modalTargetProduct.id, computedStock);
    }
    void postStockAdjustmentMovement({
      ...buildMovementPayload(modalTargetProduct, `ADJ-${Date.now()}`, `Stock adjustment posted. Reason: ${adjReason}`),
      movementType: adjType === 'ADD' ? 'STOCK_ADJUSTMENT_IN' : 'STOCK_ADJUSTMENT_OUT',
      referenceType: 'ADJUSTMENT',
      qtyIn: adjType === 'ADD' ? qty : 0,
      qtyOut: adjType === 'ADD' ? 0 : qty,
      balanceBefore: modalTargetProduct.stock,
      approvalRequired: false,
      status: 'Posted',
      riskFlag: adjType === 'DEDUCT' && qty > 3 ? 'High' : 'Low'
    });

    triggerNewActivityEvent(
      'STOCK_ADJUSTMENT_REQUESTED',
      `Authorization logged: Material [${modalTargetProduct.code}] set to ${computedStock} units (${labelSign}). Reason: ${adjReason}`,
      'High'
    );

    addLocalQueueItem({
      domain: 'Stock',
      eventType: 'STOCK_ADJUSTMENT_REQUESTED',
      reference: modalTargetProduct.code,
      createdBy: session?.staffName || 'Blessing Stock',
      risk: 'High',
      payload: JSON.stringify({
        productId: modalTargetProduct.id,
        code: modalTargetProduct.code,
        adjustedTo: computedStock,
        change: labelSign,
        reason: adjReason
      })
    });

    setSelectedProduct(updated);
    setActiveModal('NONE');
    setModalTargetProduct(null);
  };

  // 3. TRANSFER REQUEST DISPATCH
  const triggerTransferModal = (product: StockProduct) => {
    setModalTargetProduct(product);
    setTrQuantity(Math.min(2, product.stock).toString());
    setTrDestBranch('Bulawayo Depot');
    setTrDestWarehouse('Main Port Whse');
    setActiveModal('TRANSFER');
  };

  const handleTransferSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!modalTargetProduct) return;

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'STOCK_ADJUSTMENT')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: STOCK_ADJUSTMENT`);
      return;
    }

    const qty = parseInt(trQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('[ERROR] Specify real positive routing sizes.');
      return;
    }

    if (qty > modalTargetProduct.stock) {
      alert(`[TRANSFER BLOCKED] Demanded ${qty} is above currently archived stock level (${modalTargetProduct.stock})`);
      return;
    }

    const computedStock = modalTargetProduct.stock - qty;
    const nextStatus = computedStock === 0 ? 'Out of Stock' : (computedStock <= modalTargetProduct.minStock ? 'Low Stock' : 'In Stock');

    const updatedSource: StockProduct = {
      ...modalTargetProduct,
      stock: computedStock,
      stockStatus: nextStatus,
      lastMovementDate: '2026-06-08'
    };

    const nextList = localStock.map(p => p.id === modalTargetProduct.id ? updatedSource : p);
    saveLocalStockState(nextList);

    if (onUpdateProduct) {
      onUpdateProduct(updatedSource);
    } else {
      onUpdateStock(modalTargetProduct.id, computedStock);
    }
    const transferNo = `TRF-${Date.now()}`;
    addLocalQueueItem({
      domain: 'Stock',
      eventType: 'STOCK_TRANSFER_REQUESTED',
      reference: transferNo,
      createdBy: staffName,
      risk: 'Medium',
      payload: JSON.stringify({ sku: modalTargetProduct.code, qty, destination: trDestBranch })
    });
    void postTransferMovement({
      ...buildMovementPayload(modalTargetProduct, transferNo, `Transfer out to ${trDestBranch} / ${trDestWarehouse}.`),
      movementType: 'TRANSFER_OUT',
      referenceType: 'TRANSFER',
      transferId: transferNo,
      qtyIn: 0,
      qtyOut: qty,
      balanceBefore: modalTargetProduct.stock,
      approvalRequired: false,
      status: 'Posted'
    });
    void postTransferMovement({
      ...buildMovementPayload(modalTargetProduct, transferNo, `Transfer in from ${modalTargetProduct.branch || activeBranch}.`),
      branchId: trDestBranch,
      warehouseId: trDestWarehouse,
      movementType: 'TRANSFER_IN',
      referenceType: 'TRANSFER',
      transferId: transferNo,
      qtyIn: qty,
      qtyOut: 0,
      balanceBefore: 0,
      approvalRequired: false,
      status: 'Posted'
    });

    triggerNewActivityEvent(
      'STOCK_TRANSFERRED',
      `Dispatched transit route [${qty} x ${modalTargetProduct.code}] -> ${trDestBranch} (${trDestWarehouse})`,
      'Medium'
    );

    setSelectedProduct(updatedSource);
    setActiveModal('NONE');
    setModalTargetProduct(null);
  };

  // 4. GOODS RECEIPT
  const triggerReceiveModal = () => {
    if (localStock.length > 0) {
      setRxProductId(localStock[0].id);
      setRxQuantity('25');
      setRxPoRef('PO-2026-782');
      setActiveModal('RECEIVE_GOODS');
    }
  };

  const handleReceiveGoodsSubmit = (e: FormEvent) => {
    e.preventDefault();

    const currentRole = session?.role || 'Owner';
    if (!canPerformAction(currentRole as Role, 'STOCK_ADJUSTMENT')) {
      alert(`[PERMISSION DENIED] ROLE '${currentRole.toUpperCase()}' IS NOT AUTHORIZED TO PERFORMACTION: STOCK_ADJUSTMENT`);
      return;
    }

    const prod = localStock.find(p => p.id === rxProductId);
    if (!prod) return;

    const qty = parseInt(rxQuantity);
    if (isNaN(qty) || qty <= 0) {
      alert('[ERROR] Quantity must be positive.');
      return;
    }

    const computedStock = prod.stock + qty;
    const nextStatus = 'In Stock';
    const nextRisk = 'Low';

    const updated: StockProduct = {
      ...prod,
      stock: computedStock,
      stockStatus: nextStatus,
      riskLevel: nextRisk,
      lastMovementDate: '2026-06-08'
    };

    const nextList = localStock.map(p => p.id === rxProductId ? updated : p);
    saveLocalStockState(nextList);

    if (onUpdateProduct) {
      onUpdateProduct(updated);
    } else {
      onUpdateStock(prod.id, computedStock);
    }
    void postGoodsReceivedMovement({
      ...buildMovementPayload(prod, rxPoRef || `GRN-${Date.now()}`, `Goods received from ${rxSupplier}.`),
      qtyIn: qty,
      qtyOut: 0,
      balanceBefore: prod.stock,
      approvalRequired: false,
      status: 'Posted'
    });

    triggerNewActivityEvent(
      'STOCK_RECEIVED',
      `Procurement entry received: Added +${qty} units of ${prod.name} [${prod.code}]. PO Hash: ${rxPoRef || 'DIRECT'}`,
      'Medium'
    );

    setSelectedProduct(updated);
    setActiveModal('NONE');
  };

  // Export action handler CSV
  const handleExportCSV = () => {
    const csvHeaders = 'SKU,Product,Category,Branch,Warehouse,Qty On Hand,Reorder Level,Last Movement,Stock Status,Risk Level\n';
    const rows = localStock.map(p => 
      `"${p.code}","${p.name}","${p.category}","${p.branch || 'Harare Main'}","${p.warehouse || 'Main Warehouse'}",${p.stock},${p.minStock},"${p.lastMovementDate || '2026-06-08'}","${p.stockStatus || 'In Stock'}","${p.riskLevel || 'Low'}"`
    ).join('\n');

    const csvContent = csvHeaders + rows;
    
    // Quick copy to clipboard log warning
    navigator.clipboard.writeText(csvContent);
    alert('[EXPORT SYSTEM ACTIVATED]\n========================\nCSV data copied directly to computer clipboard!\nYou can paste this text directly into Excel or a diagnostic database.');
  };

  // Automatically filter to variance risk
  const handleViewVarianceRisks = () => {
    setSelectedStatus('Variance Risk');
    setSearchTerm('');
    triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', 'Auditor executed quick filter targeting Variance Risks.', 'Low');
  };

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      
      {/* 1. PROFESSIONAL INDUSTRIAL PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI LOGISTICS SERVICES</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <Warehouse className="w-5 h-5 text-orange-500" />
            Stock Control Management Chamber
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <strong>Branch Location:</strong> <span className="bg-slate-100 text-[#1e222b] font-bold px-1.5 py-0.2">{activeBranch}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Warehouse:</strong> <span className="text-[#1e222b] font-bold">Main Warehouse</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Last Sync Status:</strong> <span className="text-slate-700 font-bold">Build Development Data</span>
            </span>
          </div>
        </div>

        {/* Stock Risk Status */}
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-l-4 border-l-orange-500 border border-[#b1b5c2]">
          <AlertCircle className="w-4 h-4 text-orange-600 animate-pulse" />
          <div>
            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Stock Risk Status</span>
            <span className="text-[10px] font-black text-[#1e222b] uppercase">Review Required</span>
          </div>
        </div>
      </div>

      {/* 1B. SOLID TAB NAVIGATION SELECTORS */}
      <div className="flex flex-wrap bg-[#1e222b] text-white select-none border border-[#b1b5c2]">
        {(['Stock List', 'Product List', 'Product Ledger', 'Inventory Movements', 'Stock Health', 'Inventory Reports', 'Goods Receiving', 'Purchase Orders', 'Supplier Returns', 'Stock Adjustments', 'Stocktake'] as const).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors border-r border-[#b1b5c2]/10 rounded-none cursor-pointer hover:bg-zinc-800 ${
                isActive 
                  ? 'bg-orange-600 text-white font-extrabold border-b-2 border-b-orange-500' 
                  : 'text-slate-350 bg-slate-800/40'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {activeTab === 'Inventory Movements' ? (
        <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
          <div className="bg-[#1e222b] text-white p-4 flex justify-between items-start gap-4">
            <div>
              <div className="text-[9px] text-orange-400 uppercase font-black">Inventory Movements</div>
              <h2 className="text-sm font-black uppercase">Central Inventory Audit Trail</h2>
              <p className="text-[10px] text-slate-300 uppercase mt-1">All posted local movement records across sales, GRN, returns, stocktake, adjustments, transfers, and reversals.</p>
            </div>
            <span className="text-[10px] bg-orange-600 px-2 py-1 font-black uppercase">{allInventoryMovements.length} Movements</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
            <LedgerMetric label="Sale Qty Out" value={inventorySummary.totalSaleQtyOut} />
            <LedgerMetric label="Return Qty In" value={inventorySummary.totalReturnQtyIn} />
            <LedgerMetric label="GRN Qty In" value={inventorySummary.totalGoodsReceivedQtyIn} />
            <LedgerMetric label="Adjust Qty In" value={inventorySummary.totalAdjustmentQtyIn} />
            <LedgerMetric label="Adjust Qty Out" value={inventorySummary.totalAdjustmentQtyOut} />
            <LedgerMetric label="Transfer In" value={inventorySummary.totalTransferIn} />
            <LedgerMetric label="Transfer Out" value={inventorySummary.totalTransferOut} />
            <LedgerMetric label="Supplier Return Out" value={inventorySummary.totalSupplierReturnQtyOut} />
            <LedgerMetric label="Net Movement" value={inventorySummary.netMovement} />
            <LedgerMetric label="High Risk" value={inventorySummary.highRiskMovements} />
          </div>
          <div className="overflow-x-auto pos-custom-scroll">
            <table className="w-full min-w-[1280px] text-[10.5px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
                  <th className="py-2 px-3">Date / Time</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Movement</th>
                  <th className="py-2 px-3">Reference</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3">Shelf</th>
                  <th className="py-2 px-3 text-right">In</th>
                  <th className="py-2 px-3 text-right">Out</th>
                  <th className="py-2 px-3 text-right">Before</th>
                  <th className="py-2 px-3 text-right">After</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {allInventoryMovements.map((movement) => (
                  <tr key={movement.movementId} className="hover:bg-slate-50">
                    <td className="py-2 px-3 whitespace-nowrap">{movement.movementDate.replace('T', ' ').replace('Z', '')}</td>
                    <td className="py-2 px-3 font-black uppercase">{movement.productName}</td>
                    <td className="py-2 px-3 font-black uppercase">{formatMovementTypeLabel(movement.movementType)}</td>
                    <td className="py-2 px-3 uppercase">{movement.referenceType}: {movement.referenceNumber}</td>
                    <td className="py-2 px-3 uppercase">{movement.branchId}</td>
                    <td className="py-2 px-3 uppercase">{movement.warehouseId}</td>
                    <td className="py-2 px-3 uppercase">{movement.shelfLocation || 'N/A'}</td>
                    <td className="py-2 px-3 text-right font-black text-emerald-700">{movement.qtyIn || ''}</td>
                    <td className="py-2 px-3 text-right font-black text-rose-700">{movement.qtyOut || ''}</td>
                    <td className="py-2 px-3 text-right">{movement.balanceBefore}</td>
                    <td className="py-2 px-3 text-right font-black">{movement.balanceAfter}</td>
                    <td className="py-2 px-3 uppercase">{movement.status}</td>
                    <td className="py-2 px-3 uppercase font-black">{movement.riskFlag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border border-[#b1b5c2] p-4">
            <div className="text-[10px] font-black text-[#1e222b] uppercase mb-3">Inventory Movement Activity Feed</div>
            <div className="max-h-48 overflow-y-auto pos-custom-scroll space-y-2">
              {inventoryMovementEvents.length === 0 ? (
                <div className="text-[10px] text-slate-500 uppercase font-bold">No inventory movement events recorded yet.</div>
              ) : inventoryMovementEvents.slice(0, 20).map((event) => (
                <div key={event.id} className="border border-[#b1b5c2] bg-slate-50 px-3 py-2 text-[10px]">
                  <div className="font-black text-orange-700 uppercase">{event.eventType}</div>
                  <div className="text-slate-600 mt-0.5">{event.message}</div>
                  <div className="text-slate-400 text-[9px] mt-1">{event.createdAt.replace('T', ' ').replace('Z', '')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'Stock Health' ? (
        <div className="space-y-4">
          <div className="bg-white border border-[#b1b5c2] p-4 space-y-3">
            <div className="bg-[#1e222b] text-white p-4 flex flex-col md:flex-row justify-between gap-3">
              <div>
                <div className="text-[9px] text-orange-400 uppercase font-black">Stock Health</div>
                <h2 className="text-sm font-black uppercase">Inventory Risk and Movement Intelligence</h2>
                <div className="text-[10px] text-slate-300 uppercase mt-1">Business / Vendor: SCI-LOG-ZW | Branch: {stockHealthFilters.branch || 'ALL'} | Warehouse: {stockHealthFilters.warehouse || 'ALL'} | Last Evaluation: {new Date().toISOString().slice(0, 10)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              <LedgerMetric label="Total Products" value={stockHealthSummary.totalProducts} />
              <LedgerMetric label="Total Stock Units" value={stockHealthSummary.totalStockUnits} />
              <LedgerMetric label="Inventory Value at Cost" value={`USD ${stockHealthSummary.inventoryValueAtCost.toFixed(2)}`} />
              <LedgerMetric label="Inventory Value at Selling Price" value={`USD ${stockHealthSummary.inventoryValueAtSellingPrice.toFixed(2)}`} />
              <LedgerMetric label="Low Stock Items" value={stockHealthSummary.lowStockItems} />
              <LedgerMetric label="Out of Stock Items" value={stockHealthSummary.outOfStockItems} />
              <LedgerMetric label="Dead Stock Items" value={stockHealthSummary.deadStockItems} />
              <LedgerMetric label="Slow Moving Items" value={stockHealthSummary.slowMovingItems} />
              <LedgerMetric label="Fast Moving Items" value={stockHealthSummary.fastMovingItems} />
              <LedgerMetric label="Variance Risk Items" value={stockHealthSummary.varianceRiskItems} />
              <LedgerMetric label="Serialized Items" value={stockHealthSummary.serializedItems} />
              <LedgerMetric label="Products Without Shelf Location" value={stockHealthSummary.productsWithoutShelfLocation} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
              <LedgerSelect label="Business / Vendor" value={stockHealthFilters.vendorId || 'SCI-LOG-ZW'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, vendorId: value }))} options={vendorOptions} />
              <LedgerSelect label="Branch" value={stockHealthFilters.branch || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, branch: value }))} options={healthBranchOptions as string[]} />
              <LedgerSelect label="Warehouse" value={stockHealthFilters.warehouse || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, warehouse: value }))} options={healthWarehouseOptions as string[]} />
              <LedgerSelect label="Sector" value={stockHealthFilters.industrialSector || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, industrialSector: value }))} options={healthSectorOptions as string[]} />
              <LedgerSelect label="Category" value={stockHealthFilters.category || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, category: value }))} options={categories as string[]} />
              <LedgerSelect label="Brand" value={stockHealthFilters.brand || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, brand: value }))} options={healthBrandOptions as string[]} />
              <LedgerSelect label="Supplier" value={stockHealthFilters.supplier || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, supplier: value }))} options={healthSupplierOptions as string[]} />
              <LedgerSelect label="Shelf" value={stockHealthFilters.shelfLocation || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, shelfLocation: value }))} options={healthShelfOptions as string[]} />
              <LedgerSelect label="Stock Status" value={stockHealthFilters.stockStatus || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, stockStatus: value }))} options={statuses as string[]} />
              <LedgerSelect label="Risk Level" value={stockHealthFilters.riskLevel || 'ALL'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, riskLevel: value }))} options={['ALL', 'Low', 'Medium', 'High', 'Critical']} />
              <LedgerSelect label="Movement Period" value={stockHealthFilters.movementPeriod || 'Last 30 Days'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, movementPeriod: value as StockHealthFilters['movementPeriod'] }))} options={['Today', 'Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Custom']} />
              <LedgerSelect label="Include Serialized Items" value={stockHealthFilters.includeSerialized === false ? 'No' : 'Yes'} onChange={(value) => setStockHealthFilters((current) => ({ ...current, includeSerialized: value === 'Yes' }))} options={['Yes', 'No']} />
              {stockHealthFilters.movementPeriod === 'Custom' && (
                <>
                  <LedgerInput label="Period From" value={stockHealthFilters.dateFrom || ''} onChange={(value) => setStockHealthFilters((current) => ({ ...current, dateFrom: value }))} />
                  <LedgerInput label="Period To" value={stockHealthFilters.dateTo || ''} onChange={(value) => setStockHealthFilters((current) => ({ ...current, dateTo: value }))} />
                </>
              )}
            </div>
          </div>
          <div className="bg-white border border-[#b1b5c2] p-4 overflow-x-auto pos-custom-scroll">
            <table className="w-full min-w-[1680px] text-[10.5px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
                  {['Numeric No.', 'SKU', 'ALU', 'Product Name', 'Sector', 'Category', 'Brand', 'Supplier', 'Branch', 'Warehouse', 'Shelf / Location', 'Qty On Hand', 'Reorder Level', 'Last Sale Date', 'Last Received Date', 'Days Since Last Sale', 'Stock Status', 'Movement Class', 'Risk Level', 'Recommended Action', 'Action'].map((label) => <th key={label} className="py-2 px-3">{label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockHealthRows.map((row) => {
                  const product = localStock.find((item) => item.id === row.productId);
                  const isReviewed = reviewedHealthProducts.has(row.productId);
                  return (
                    <tr key={row.productId} className={`hover:bg-slate-50 ${isReviewed ? 'bg-green-50/40' : ''}`}>
                      <td className="py-2 px-3 font-black text-orange-700">{row.numericNo}</td>
                      <td className="py-2 px-3 font-black">{row.sku}</td>
                      <td className="py-2 px-3">{row.alu}</td>
                      <td className="py-2 px-3 font-black uppercase">{row.productName}</td>
                      <td className="py-2 px-3 uppercase">{row.sector}</td>
                      <td className="py-2 px-3 uppercase">{row.category}</td>
                      <td className="py-2 px-3 uppercase">{row.brand}</td>
                      <td className="py-2 px-3 uppercase">{row.supplier}</td>
                      <td className="py-2 px-3 uppercase">{row.branch}</td>
                      <td className="py-2 px-3 uppercase">{row.warehouse}</td>
                      <td className="py-2 px-3 uppercase">{row.shelfLocation || 'N/A'}</td>
                      <td className="py-2 px-3 text-right font-black">{row.qtyOnHand}</td>
                      <td className="py-2 px-3 text-right">{row.reorderLevel}</td>
                      <td className="py-2 px-3">{row.lastSaleDate ? row.lastSaleDate.slice(0, 10) : 'N/A'}</td>
                      <td className="py-2 px-3">{row.lastReceivedDate ? row.lastReceivedDate.slice(0, 10) : 'N/A'}</td>
                      <td className="py-2 px-3 text-right">{row.daysSinceLastSale ?? 'N/A'}</td>
                      <td className="py-2 px-3 uppercase font-black">{row.stockStatus}</td>
                      <td className="py-2 px-3 uppercase">{row.movementClass}</td>
                      <td className="py-2 px-3 uppercase font-black">{row.riskLevel}</td>
                      <td className="py-2 px-3 uppercase font-black text-orange-700">{row.recommendedAction}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 flex-wrap">
                          <button type="button" onClick={() => product && void openProductLedger(product)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">View Ledger</button>
                          <button type="button" onClick={() => product && openStocktakeForProduct(product)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">Start Stocktake</button>
                          <button type="button" onClick={() => handleStockHealthAction('Create Purchase Reminder', row)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">Create Purchase Reminder</button>
                          <button type="button" onClick={() => handleStockHealthAction('Flag Risk', row)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">Flag Risk</button>
                          <button type="button" onClick={() => handleStockHealthAction('Mark Reviewed', row)} disabled={isReviewed} className="px-2 py-1 border border-[#b1b5c2] disabled:opacity-50 text-[9px] font-black uppercase">{isReviewed ? 'Reviewed' : 'Mark Reviewed'}</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'Inventory Reports' ? (
        <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
          <div className="bg-[#1e222b] text-white p-4 flex flex-col md:flex-row justify-between gap-3">
            <div>
              <div className="text-[9px] text-orange-400 uppercase font-black">Inventory Reports</div>
              <h2 className="text-sm font-black uppercase">{reportFilters.reportType || 'Stock Valuation'}</h2>
              <p className="text-[10px] text-slate-300 uppercase mt-1">POS-side inventory classification only. Full accounting posting will be connected later.</p>
            </div>
            <button type="button" onClick={() => void handleInventoryReportExport(reportFilters.reportType || 'Stock Valuation')} className="self-start px-3 py-2 bg-orange-600 text-white font-black uppercase text-[10px]">Export Current Report Placeholder</button>
          </div>
          {reportNotice && <div className="border border-orange-200 bg-orange-50 text-orange-900 p-2 text-[10px] font-bold uppercase">{reportNotice}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
            <LedgerSelect label="Business / Vendor" value={reportFilters.vendorId || 'SCI-LOG-ZW'} onChange={(value) => setReportFilters((current) => ({ ...current, vendorId: value }))} options={vendorOptions} />
            <LedgerSelect label="Report Type" value={reportFilters.reportType || 'Stock Valuation'} onChange={(value) => setReportFilters((current) => ({ ...current, reportType: value as InventoryReportType }))} options={['Stock Valuation', 'Movement Summary', 'Low Stock Report', 'Out of Stock Report', 'Dead Stock Report', 'Slow Moving Stock Report', 'Fast Moving Stock Report', 'Variance Risk Report', 'Supplier Stock Report', 'Shelf / Location Report', 'COA Inventory Report']} />
            <LedgerSelect label="Branch" value={reportFilters.branch || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, branch: value }))} options={healthBranchOptions as string[]} />
            <LedgerSelect label="Warehouse" value={reportFilters.warehouse || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, warehouse: value }))} options={healthWarehouseOptions as string[]} />
            <LedgerSelect label="Sector" value={reportFilters.industrialSector || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, industrialSector: value }))} options={healthSectorOptions as string[]} />
            <LedgerSelect label="Category" value={reportFilters.category || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, category: value }))} options={categories as string[]} />
            <LedgerSelect label="Brand" value={reportFilters.brand || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, brand: value }))} options={healthBrandOptions as string[]} />
            <LedgerSelect label="Supplier" value={reportFilters.supplier || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, supplier: value }))} options={healthSupplierOptions as string[]} />
            <LedgerSelect label="Shelf" value={reportFilters.shelfLocation || 'ALL'} onChange={(value) => setReportFilters((current) => ({ ...current, shelfLocation: value }))} options={healthShelfOptions as string[]} />
            <LedgerInput label="Date From" value={reportFilters.dateFrom || ''} onChange={(value) => setReportFilters((current) => ({ ...current, dateFrom: value }))} />
            <LedgerInput label="Date To" value={reportFilters.dateTo || ''} onChange={(value) => setReportFilters((current) => ({ ...current, dateTo: value }))} />
          </div>
          {(reportFilters.reportType === 'Movement Summary') ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <LedgerMetric label="Total Qty In" value={movementReportTotals.totalQtyIn} />
                <LedgerMetric label="Total Qty Out" value={movementReportTotals.totalQtyOut} />
                <LedgerMetric label="Net Movement" value={movementReportTotals.netMovement} />
                <LedgerMetric label="High Risk Movements" value={movementReportTotals.highRiskMovements} />
                <LedgerMetric label="Reversal Count" value={movementReportTotals.reversalCount} />
                <LedgerMetric label="Pending Approval" value={movementReportTotals.pendingApprovalMovements} />
              </div>
              <ReportTable headers={['Product', 'Opening', 'Qty In', 'Qty Out', 'Transfer In', 'Transfer Out', 'Returns In', 'Supplier Returns Out', 'Adjust In', 'Adjust Out', 'Closing', 'Net', 'Risk']} rows={movementReportRows.map((row) => [row.product, row.openingBalance, row.qtyIn, row.qtyOut, row.transferIn, row.transferOut, row.returnsIn, row.supplierReturnsOut, row.adjustmentsIn, row.adjustmentsOut, row.closingBalance, row.netMovement, row.risk])} />
            </>
          ) : reportFilters.reportType === 'Shelf / Location Report' ? (
            <div className="overflow-x-auto pos-custom-scroll">
              <table className="w-full min-w-[1200px] text-[10.5px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
                    {['Shelf / Location', 'Products', 'Units', 'Cost Value', 'Low Stock', 'Out Of Stock', 'Variance Risk', 'Last Stocktake', 'Recommended Action', 'Action'].map((label) => <th key={label} className="py-2 px-3">{label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shelfReportRows.map((row) => {
                    const isReviewed = reviewedShelves.has(row.shelfLocation);
                    return (
                      <tr key={row.shelfLocation} className={`hover:bg-slate-50 ${isReviewed ? 'bg-green-50/40' : ''}`}>
                        <td className="py-2 px-3 font-black uppercase">{row.shelfLocation}</td>
                        <td className="py-2 px-3">{row.productsCount}</td>
                        <td className="py-2 px-3">{row.totalUnits}</td>
                        <td className="py-2 px-3">USD {row.totalCostValue.toFixed(2)}</td>
                        <td className="py-2 px-3">{row.lowStockItems}</td>
                        <td className="py-2 px-3">{row.outOfStockItems}</td>
                        <td className="py-2 px-3">{row.varianceRiskItems}</td>
                        <td className="py-2 px-3">{row.lastStocktakeDate === 'N/A' ? 'N/A' : row.lastStocktakeDate.slice(0, 10)}</td>
                        <td className="py-2 px-3 uppercase font-black text-orange-700">{row.recommendedAction}</td>
                        <td className="py-2 px-3">
                          <div className="flex gap-1 flex-wrap">
                            <button type="button" onClick={() => handleShelfReportAction('Start Shelf Stocktake', row.shelfLocation)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">Start Shelf Stocktake</button>
                            <button type="button" onClick={() => handleShelfReportAction('Export Shelf List Placeholder', row.shelfLocation)} className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase">Export Shelf List</button>
                            <button type="button" onClick={() => handleShelfReportAction('Mark Shelf Reviewed', row.shelfLocation)} disabled={isReviewed} className="px-2 py-1 border border-[#b1b5c2] disabled:opacity-50 text-[9px] font-black uppercase">{isReviewed ? 'Reviewed' : 'Mark Shelf Reviewed'}</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : reportFilters.reportType === 'COA Inventory Report' ? (
            <ReportTable headers={['COA Account', 'Account Type', 'Products', 'Units', 'Cost Value', 'Selling Value', 'Movement Count', 'Last Movement']} rows={coaReportRows.map((row) => [row.coaAccount, row.accountType, row.productsCount, row.totalUnits, `USD ${row.totalCostValue.toFixed(2)}`, `USD ${row.totalSellingValue.toFixed(2)}`, row.movementCount, row.lastMovementDate.slice(0, 10)])} />
          ) : reportFilters.reportType === 'Supplier Stock Report' ? (
            <ReportTable headers={['Supplier', 'Products', 'Units', 'Cost Value', 'Low Stock', 'Dead Stock', 'Last Received', 'Supplier Returns', 'Recommended Action']} rows={supplierReportRows.map((row) => [row.supplier, row.productsCount, row.totalUnits, `USD ${row.stockValueAtCost.toFixed(2)}`, row.lowStockItems, row.deadStockItems, row.lastReceivedDate.slice(0, 10), row.supplierReturnCount, row.recommendedAction])} />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <LedgerMetric label="Total Cost Value" value={`USD ${displayedValuationRows.reduce((sum, row) => sum + row.totalCostValue, 0).toFixed(2)}`} />
                <LedgerMetric label="Total Selling Value" value={`USD ${displayedValuationRows.reduce((sum, row) => sum + row.totalSellingValue, 0).toFixed(2)}`} />
                <LedgerMetric label="Estimated Margin Value" value={`USD ${displayedValuationRows.reduce((sum, row) => sum + row.marginValue, 0).toFixed(2)}`} />
                <LedgerMetric label="Estimated Margin %" value={`${(displayedValuationRows.reduce((sum, row) => sum + row.marginValue, 0) / Math.max(1, displayedValuationRows.reduce((sum, row) => sum + row.totalSellingValue, 0)) * 100).toFixed(1)}%`} />
                <LedgerMetric label="Products Count" value={displayedValuationRows.length} />
                <LedgerMetric label="Units Count" value={displayedValuationRows.reduce((sum, row) => sum + row.qtyOnHand, 0)} />
              </div>
              <ReportTable headers={['Numeric No.', 'SKU', 'Product Name', 'Sector', 'Brand', 'Supplier', 'Branch', 'Warehouse', 'Qty', 'Unit Cost', 'Selling Price', 'Cost Value', 'Selling Value', 'Margin', 'Margin %', 'Asset COA', 'Sales COA']} rows={displayedValuationRows.map((row) => [row.numericNo, row.sku, row.productName, row.sector, row.brand, row.supplier, row.branch, row.warehouse, row.qtyOnHand, `USD ${row.unitCost.toFixed(2)}`, `USD ${row.sellingPrice.toFixed(2)}`, `USD ${row.totalCostValue.toFixed(2)}`, `USD ${row.totalSellingValue.toFixed(2)}`, `USD ${row.marginValue.toFixed(2)}`, `${row.marginPct.toFixed(1)}%`, row.assetAccountCOA, row.salesAccountCOA])} />
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {(['Stock Valuation', 'Movement Summary', 'Shelf / Location Report', 'COA Inventory Report', 'Supplier Stock Report'] as InventoryReportType[]).map((type) => (
              <button key={type} type="button" onClick={() => void handleInventoryReportExport(type)} className="px-3 py-2 border border-[#b1b5c2] hover:border-orange-500 text-[10px] font-black uppercase">{`Export ${type} Placeholder`}</button>
            ))}
          </div>
        </div>
      ) : activeTab === 'Product List' ? (
        <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-3 border-b border-gray-200 pb-3">
            <div>
              <h2 className="text-[12px] font-black uppercase text-[#1e222b]">Product List</h2>
              <p className="text-[10px] text-slate-500 uppercase">Search by any word order across product, SKU, ALU, barcode, supplier, shelf, sector, brand, and category.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={startStocktakeFromProductListFilters}
                disabled={productListRows.length === 0}
                className="px-3 py-2 bg-orange-600 disabled:bg-slate-200 disabled:text-slate-500 text-white font-black uppercase text-[10px]"
              >
                Start Stocktake From Filters
              </button>
            </div>
          </div>

          <div className="relative max-w-xl">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              value={productListSearch}
              onChange={(event) => handleProductSearchChange(event.target.value)}
              placeholder="Example: GD6 brake front or Honda ball CBHO49"
              className="w-full bg-white border border-[#b1b5c2] pl-8 pr-3 py-2 text-[11px] font-bold uppercase outline-none focus:border-orange-500"
            />
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="w-full min-w-[1420px] text-[10.5px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
                  <th className="py-2 px-3">Numeric No.</th>
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">ALU</th>
                  <th className="py-2 px-3">Product Name</th>
                  <th className="py-2 px-3">Sector</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Brand</th>
                  <th className="py-2 px-3">Manufacturer</th>
                  <th className="py-2 px-3">Supplier</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3">Shelf / Location</th>
                  <th className="py-2 px-3 text-right">Qty On Hand</th>
                  <th className="py-2 px-3 text-right">Selling Price</th>
                  <th className="py-2 px-3 text-center">Stock Status</th>
                  <th className="py-2 px-3 text-center">Risk</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {productListRows.map((product) => (
                  <tr
                    key={product.id}
                    onDoubleClick={() => void openProductLedger(product)}
                    className="hover:bg-orange-50/40 cursor-pointer"
                    title="Double-click to open product ledger"
                  >
                    <td className="py-2 px-3 font-black text-orange-700 whitespace-nowrap">{product.productNumericNumber || '000000000'}</td>
                    <td className="py-2 px-3 font-black text-[#1e222b] whitespace-nowrap">{product.sku || product.code}</td>
                    <td className="py-2 px-3 font-bold text-slate-600 whitespace-nowrap">{product.alu || 'ALU-N/A'}</td>
                    <td className="py-2 px-3 font-black uppercase max-w-[220px] truncate">{product.productName || product.name}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.industrialSector || 'General'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.productCategory || product.category}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.brand || 'N/A'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.manufacturer || 'N/A'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.supplierName || 'N/A'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.branch || 'Harare Main'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.warehouse || 'Main Warehouse'}</td>
                    <td className="py-2 px-3 uppercase text-slate-600">{product.shelfLocation || product.binLocation || 'N/A'}</td>
                    <td className="py-2 px-3 text-right font-black">{product.qtyOnHand ?? product.stock} {product.unitOfMeasure || product.unit}</td>
                    <td className="py-2 px-3 text-right font-black">USD {(product.sellingPrice ?? product.price).toFixed(2)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block border border-[#b1b5c2] px-1.5 py-0.5 uppercase font-bold">{product.stockStatus || product.healthStatus || 'In Stock'}</span>
                    </td>
                    <td className="py-2 px-3 text-center font-black uppercase">{product.riskLevel || 'Low'}</td>
                    <td className="py-2 px-3">
                      <div className="flex justify-center gap-1">
                        <button type="button" onClick={() => void openProductLedger(product)} className="px-2 py-1 border border-[#b1b5c2] hover:border-orange-500 text-[9px] font-black uppercase">View Ledger</button>
                        <button type="button" className="px-2 py-1 border border-[#b1b5c2] text-[9px] font-black uppercase text-slate-500">Edit Placeholder</button>
                        <button type="button" onClick={() => openStocktakeForProduct(product)} className="px-2 py-1 border border-[#b1b5c2] hover:border-orange-500 text-[9px] font-black uppercase">Stocktake</button>
                        <button type="button" onClick={() => triggerAdjustmentModal(product)} className="px-2 py-1 border border-[#b1b5c2] hover:border-orange-500 text-[9px] font-black uppercase">Adjustment</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'Product Ledger' ? (
        <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
          {!productLedgerProduct ? (
            <div className="p-8 text-center text-slate-500 uppercase font-bold border border-dashed border-[#b1b5c2]">
              Select a product from Product List to view its ledger.
            </div>
          ) : (
            <>
              <div className="bg-[#1e222b] text-white p-4 flex flex-col lg:flex-row justify-between gap-4">
                <div>
                  <div className="text-[9px] text-orange-400 uppercase font-black">Product Ledger</div>
                  <h2 className="text-sm font-black uppercase">{productLedgerProduct.productName || productLedgerProduct.name}</h2>
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-1 text-[10px] text-slate-300 uppercase">
                    <span>No: <strong>{productLedgerProduct.productNumericNumber || '000000000'}</strong></span>
                    <span>SKU: <strong>{productLedgerProduct.sku || productLedgerProduct.code}</strong></span>
                    <span>ALU: <strong>{productLedgerProduct.alu || 'N/A'}</strong></span>
                    <span>Brand: <strong>{productLedgerProduct.brand || 'N/A'}</strong></span>
                    <span>Manufacturer: <strong>{productLedgerProduct.manufacturer || 'N/A'}</strong></span>
                    <span>Supplier: <strong>{productLedgerProduct.supplierName || 'N/A'}</strong></span>
                    <span>Branch: <strong>{productLedgerProduct.branch || 'Harare Main'}</strong></span>
                    <span>Warehouse: <strong>{productLedgerProduct.warehouse || 'Main Warehouse'}</strong></span>
                    <span>Shelf: <strong>{productLedgerProduct.shelfLocation || 'N/A'}</strong></span>
                    <span>Qty: <strong>{productLedgerProduct.qtyOnHand ?? productLedgerProduct.stock}</strong></span>
                    <span>Status: <strong>{productLedgerProduct.stockStatus || productLedgerProduct.healthStatus || 'In Stock'}</strong></span>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveTab('Product List')} className="self-start px-3 py-2 bg-orange-600 text-white font-black uppercase text-[10px]">Back To Product List</button>
              </div>

              {productLedgerNotice && (
                <div className="border border-orange-200 bg-orange-50 text-orange-900 p-2 text-[10px] font-bold uppercase">{productLedgerNotice}</div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-12 gap-3">
                <LedgerMetric label="Opening Balance" value={productLedgerSummary.openingBalance} />
                <LedgerMetric label="Total Qty In" value={productLedgerSummary.totalQtyIn} />
                <LedgerMetric label="Total Qty Out" value={productLedgerSummary.totalQtyOut} />
                <LedgerMetric label="Closing Balance" value={productLedgerSummary.closingBalance} />
                <LedgerMetric label="Sales Movements" value={productLedgerSummary.salesMovements} />
                <LedgerMetric label="Return Movements" value={productLedgerSummary.returnMovements} />
                <LedgerMetric label="Goods Received" value={productLedgerSummary.goodsReceivedMovements} />
                <LedgerMetric label="Adjustment Movements" value={productLedgerSummary.adjustmentMovements} />
                <LedgerMetric label="Stocktake Variances" value={productLedgerSummary.stocktakeVariances} />
                <LedgerMetric label="Transfer Movements" value={productLedgerSummary.transferMovements} />
                <LedgerMetric label="Last Movement Date" value={productLedgerSummary.lastMovementDate ? productLedgerSummary.lastMovementDate.slice(0, 10) : 'N/A'} />
                <LedgerMetric label="Current System Qty" value={productLedgerSummary.currentSystemQty} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-9 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
                <LedgerInput label="Date From" value={productLedgerFilters.dateFrom || ''} onChange={(value) => handleLedgerFilterChange({ dateFrom: value })} />
                <LedgerInput label="Date To" value={productLedgerFilters.dateTo || ''} onChange={(value) => handleLedgerFilterChange({ dateTo: value })} />
                <LedgerSelect label="Branch" value={productLedgerFilters.branch || 'ALL'} onChange={(value) => handleLedgerFilterChange({ branch: value })} options={ledgerBranchOptions} />
                <LedgerSelect label="Warehouse" value={productLedgerFilters.warehouse || 'ALL'} onChange={(value) => handleLedgerFilterChange({ warehouse: value })} options={ledgerWarehouseOptions} />
                <LedgerSelect label="Shelf / Location" value={productLedgerFilters.shelfLocation || 'ALL'} onChange={(value) => handleLedgerFilterChange({ shelfLocation: value })} options={ledgerShelfOptions} />
                <LedgerSelect label="Movement Type" value={String(productLedgerFilters.movementType || 'ALL')} onChange={(value) => handleLedgerFilterChange({ movementType: value as ProductLedgerFilters['movementType'] })} options={ledgerMovementTypeOptions.map(String)} />
                <LedgerSelect label="Reference Type" value={String(productLedgerFilters.referenceType || 'ALL')} onChange={(value) => handleLedgerFilterChange({ referenceType: value as ProductLedgerFilters['referenceType'] })} options={ledgerReferenceTypeOptions.map(String)} />
                <LedgerSelect label="Staff / User" value={productLedgerFilters.staff || 'ALL'} onChange={(value) => handleLedgerFilterChange({ staff: value })} options={ledgerStaffOptions} />
                <LedgerSelect label="Status" value={productLedgerFilters.status || 'ALL'} onChange={(value) => handleLedgerFilterChange({ status: value as ProductLedgerFilters['status'] })} options={['ALL', 'Draft', 'Posted', 'Pending Approval', 'Reversed', 'Rejected']} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleLedgerExport} className="px-3 py-2 bg-orange-600 text-white font-black uppercase text-[10px]">Export Ledger Placeholder</button>
              </div>

              <div className="overflow-x-auto pos-custom-scroll">
                <table className="w-full min-w-[1480px] text-[10.5px] text-left border-collapse">
                  <thead>
                    <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
                      <th className="py-2 px-3">Date / Time</th>
                      <th className="py-2 px-3">Movement Type</th>
                      <th className="py-2 px-3">Reference</th>
                      <th className="py-2 px-3">Branch</th>
                      <th className="py-2 px-3">Warehouse</th>
                      <th className="py-2 px-3">Shelf / Location</th>
                      <th className="py-2 px-3 text-right">Qty In</th>
                      <th className="py-2 px-3 text-right">Qty Out</th>
                      <th className="py-2 px-3 text-right">Balance Before</th>
                      <th className="py-2 px-3 text-right">Balance After</th>
                      <th className="py-2 px-3 text-right">Unit Cost</th>
                      <th className="py-2 px-3 text-right">Selling Price</th>
                      <th className="py-2 px-3">Staff</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Notes</th>
                      <th className="py-2 px-3 text-center">Risk Flag</th>
                      <th className="py-2 px-3 text-center">Reverse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredProductLedgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={17} className="py-8 text-center text-slate-500 uppercase font-bold">
                          No ledger rows match the current filters.
                        </td>
                      </tr>
                    ) : filteredProductLedgerEntries.map((entry) => (
                      <tr key={entry.movementId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 whitespace-nowrap font-bold">{entry.movementDate.replace('T', ' ').replace('Z', '')}</td>
                        <td className="py-2 px-3 font-black uppercase">{formatMovementTypeLabel(entry.movementType)}</td>
                        <td className="py-2 px-3 uppercase">{entry.referenceType}: {entry.referenceNumber}</td>
                        <td className="py-2 px-3 uppercase">{entry.branchId}</td>
                        <td className="py-2 px-3 uppercase">{entry.warehouseId}</td>
                        <td className="py-2 px-3 uppercase">{entry.shelfLocation || 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-black text-emerald-700">{entry.qtyIn || ''}</td>
                        <td className="py-2 px-3 text-right font-black text-rose-700">{entry.qtyOut || ''}</td>
                        <td className="py-2 px-3 text-right font-black">{entry.balanceBefore}</td>
                        <td className="py-2 px-3 text-right font-black">{entry.balanceAfter}</td>
                        <td className="py-2 px-3 text-right">USD {entry.unitCost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">USD {entry.sellingPrice.toFixed(2)}</td>
                        <td className="py-2 px-3 uppercase">{entry.staffName}</td>
                        <td className="py-2 px-3 uppercase font-black">{entry.status}</td>
                        <td className="py-2 px-3">{entry.notes}</td>
                        <td className="py-2 px-3 text-center uppercase font-black">{entry.riskFlag}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            disabled={entry.status !== 'Posted'}
                            onClick={() => void handleReverseMovement(entry.movementId)}
                            className="px-2 py-1 border border-[#b1b5c2] disabled:text-slate-400 hover:border-orange-500 text-[9px] font-black uppercase"
                          >
                            Reverse
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-white border border-[#b1b5c2] p-4 space-y-3">
                <div className="text-[10px] font-black text-[#1e222b] uppercase">Inventory Movement Summary</div>
                <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
                  <LedgerMetric label="Sale Qty Out" value={inventorySummary.totalSaleQtyOut} />
                  <LedgerMetric label="Return Qty In" value={inventorySummary.totalReturnQtyIn} />
                  <LedgerMetric label="GRN Qty In" value={inventorySummary.totalGoodsReceivedQtyIn} />
                  <LedgerMetric label="Adjust Qty In" value={inventorySummary.totalAdjustmentQtyIn} />
                  <LedgerMetric label="Adjust Qty Out" value={inventorySummary.totalAdjustmentQtyOut} />
                  <LedgerMetric label="Transfer In" value={inventorySummary.totalTransferIn} />
                  <LedgerMetric label="Transfer Out" value={inventorySummary.totalTransferOut} />
                  <LedgerMetric label="Supplier Return Out" value={inventorySummary.totalSupplierReturnQtyOut} />
                  <LedgerMetric label="Net Movement" value={inventorySummary.netMovement} />
                  <LedgerMetric label="High Risk" value={inventorySummary.highRiskMovements} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
                  <LedgerInput label="Date From" value={movementSummaryFilters.dateFrom || ''} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, dateFrom: value }))} />
                  <LedgerInput label="Date To" value={movementSummaryFilters.dateTo || ''} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, dateTo: value }))} />
                  <LedgerSelect label="Branch" value={movementSummaryFilters.branchId || 'ALL'} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, branchId: value }))} options={healthBranchOptions as string[]} />
                  <LedgerSelect label="Warehouse" value={movementSummaryFilters.warehouseId || 'ALL'} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, warehouseId: value }))} options={healthWarehouseOptions as string[]} />
                  <LedgerSelect label="Sector" value={movementSummaryFilters.sector || 'ALL'} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, sector: value }))} options={healthSectorOptions as string[]} />
                  <LedgerSelect label="Category" value={movementSummaryFilters.category || 'ALL'} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, category: value }))} options={categories as string[]} />
                  <LedgerSelect label="Product" value={movementSummaryFilters.productId || 'ALL'} onChange={(value) => setMovementSummaryFilters((current) => ({ ...current, productId: value === 'ALL' ? undefined : value }))} options={['ALL', ...localStock.map((item) => item.id)]} />
                </div>
              </div>

              <div className="bg-white border border-[#b1b5c2] p-4">
                <div className="text-[10px] font-black text-[#1e222b] uppercase mb-3">Inventory Movement Activity Feed</div>
                <div className="max-h-48 overflow-y-auto pos-custom-scroll space-y-2">
                  {inventoryMovementEvents.length === 0 ? (
                    <div className="text-[10px] text-slate-500 uppercase font-bold">No inventory movement events recorded yet.</div>
                  ) : inventoryMovementEvents.slice(0, 20).map((event) => (
                    <div key={event.id} className="border border-[#b1b5c2] bg-slate-50 px-3 py-2 text-[10px]">
                      <div className="font-black text-orange-700 uppercase">{event.eventType}</div>
                      <div className="text-slate-600 mt-0.5">{event.message}</div>
                      <div className="text-slate-400 text-[9px] mt-1">{event.createdAt.replace('T', ' ').replace('Z', '')}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : activeTab !== 'Stock List' ? (
        <StockPanels
          localStock={localStock}
          setLocalStock={setLocalStock}
          saveLocalStockState={saveLocalStockState}
          staffName={staffName}
          activeBranch={activeBranch}
          simulatedRole={simulatedRole}
          setSimulatedRole={setSimulatedRole}
          triggerNewActivityEvent={(type, message, severity) => {
            // Log to local activity feed
            const timeStr = new Date().toTimeString().split(' ')[0];
            const newEv = {
              id: 'EV-' + (activityFeed.length + 1),
              time: timeStr,
              type,
              severity,
              message
            };
            setActivityFeed(prev => [newEv, ...prev]);
          }}
          stockApprovals={stockApprovals}
          setStockApprovals={setStockApprovals}
          canApprove={canApprove}
          onUpdateStock={onUpdateStock}
          activeTab={activeTab as 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake'}
          setActiveTab={(tab) => setActiveTab(tab)}
          stocktakePreselect={stocktakePreselect}
          stocktakePreselectToken={stocktakePreselectToken}
        />
      ) : (
        <>

      {/* 2. DYNAMIC SQUARE METRICS COMPLIANT GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Metric 1 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9.5px] text-slate-500 font-black uppercase tracking-wider block">TOTAL PRODUCTS</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-[#1e222b]">{stats.totalProducts}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">{stats.calculatedUniqueEntries} active</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] border-l-4 border-l-amber-500">
          <span className="text-[9.5px] text-amber-600 font-black uppercase tracking-wider block">LOW STOCK ITEMS</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-amber-600">{stats.lowStockItems}</span>
            <span className="text-[8px] bg-amber-500/10 text-amber-700 font-bold px-1.5 py-0.2">ALERTS</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] border-l-4 border-l-red-650">
          <span className="text-[9.5px] text-red-600 font-black uppercase tracking-wider block">OUT OF STOCK</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-red-600 animate-pulse">{stats.outOfStockCountItems || stats.outOfStockItems}</span>
            <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2">CRITICAL</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9.5px] text-slate-500 font-black uppercase tracking-wider block">DEAD STOCK ITEMS</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-slate-800">{stats.deadStockItems}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">OBSOLETE</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px] border-l-4 border-l-orange-500">
          <span className="text-[9.5px] text-orange-600 font-black uppercase tracking-wider block">VARIANCE RISK</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-orange-600">{stats.varianceRiskItems}</span>
            <span className="text-[8px] bg-orange-100 text-orange-600 font-bold px-1.5 py-0.2">DISCREPANT</span>
          </div>
        </div>

        {/* Metric 6 */}
        <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col justify-between h-[96px]">
          <span className="text-[9.5px] text-emerald-600 font-black uppercase tracking-wider block">FAST MOVING</span>
          <div className="mt-2 flex justify-between items-baseline">
            <span className="text-2xl font-black text-emerald-600">{stats.fastMovingItems}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase">TURNOVER</span>
          </div>
        </div>

      </div>

      <div className="bg-white border border-[#b1b5c2] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <span className="text-[10px] font-black uppercase text-[#1e222b]">Inventory Movement Summary</span>
          <span className="text-[8px] font-black uppercase text-slate-500">Local movement engine</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <LedgerMetric label="Sale Qty Out" value={inventorySummary.totalSaleQtyOut} />
          <LedgerMetric label="Return Qty In" value={inventorySummary.totalReturnQtyIn} />
          <LedgerMetric label="Goods Received" value={inventorySummary.totalGoodsReceivedQtyIn} />
          <LedgerMetric label="Adjustment In" value={inventorySummary.totalAdjustmentQtyIn} />
          <LedgerMetric label="Adjustment Out" value={inventorySummary.totalAdjustmentQtyOut} />
          <LedgerMetric label="Transfer In" value={inventorySummary.totalTransferIn} />
          <LedgerMetric label="Transfer Out" value={inventorySummary.totalTransferOut} />
          <LedgerMetric label="Supplier Return Out" value={inventorySummary.totalSupplierReturnQtyOut} />
          <LedgerMetric label="Net Movement" value={inventorySummary.netMovement} />
          <LedgerMetric label="High Risk" value={inventorySummary.highRiskMovements} />
        </div>
      </div>

      <div className="bg-white border border-[#b1b5c2] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
          <span className="text-[10px] font-black uppercase text-[#1e222b]">Inventory Movement Activity Feed</span>
          <span className="text-[8px] font-black uppercase text-slate-500">{inventoryMovementEvents.length} events</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-44 overflow-y-auto pos-custom-scroll">
          {inventoryMovementEvents.length === 0 ? (
            <div className="text-[10px] text-slate-500 uppercase font-bold">No movement events recorded in this browser session yet.</div>
          ) : (
            inventoryMovementEvents.slice(0, 8).map((event) => (
              <div key={event.id} className="border border-[#b1b5c2] p-2 text-[10px]">
                <div className="font-black uppercase text-orange-700">{event.eventType}</div>
                <div className="text-slate-700">{event.message}</div>
                <div className="text-[8px] text-slate-400 uppercase">{event.createdAt.replace('T', ' ').replace('Z', '')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. STOCK ACTION BAR CONTROL ENGINE */}
      <div className="bg-[#1e222b] p-4 flex flex-wrap justify-between items-center gap-4 border border-[#b1b5c2]">
        <div>
          <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest block">STOCK AUDIT CHASSIS INTERACTION MATRIX</span>
          <span className="text-[8px] text-slate-400 block uppercase mt-0.5">PROCESS MANUAL INTERVENTIONS AND PHYSICAL TRANSACTIONS</span>
        </div>

        <div className="flex flex-wrap gap-2">
          
          <button
            onClick={() => {
              if (localStock.length > 0) triggerStocktakeModal(localStock[0]);
            }}
            className="px-3 py-2 bg-transparent border border-slate-700 hover:border-orange-500 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5 text-orange-500" />
            Start Stocktake
          </button>

          <button
            onClick={() => {
              if (localStock.length > 0) triggerAdjustmentModal(localStock[0]);
            }}
            className="px-3 py-2 bg-transparent border border-slate-700 hover:border-orange-500 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-orange-500" />
            New Adjustment Request
          </button>

          <button
            onClick={triggerReceiveModal}
            className="px-3 py-2 bg-[#f97316] text-white hover:bg-[#ea580c] font-black text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 border border-orange-600 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5 stroke-[2.5]" />
            Receive Goods
          </button>

          <button
            onClick={() => {
              if (localStock.length > 0) triggerTransferModal(localStock[0]);
            }}
            className="px-3 py-2 bg-transparent border border-slate-700 hover:border-orange-500 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-orange-500" />
            Transfer Stock
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-transparent border border-slate-700 hover:border-orange-500 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-orange-500" />
            Export Stock List
          </button>

          <button
            onClick={handleViewVarianceRisks}
            className="px-3 py-2 bg-transparent border border-slate-700 hover:border-orange-500 text-white font-extrabold text-[10px] uppercase cursor-pointer rounded-none flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500 animate-pulse" />
            View Variance Risks
          </button>

        </div>
      </div>

      {/* 4. MAIN SEARCH FILTERS PANEL */}
      <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
        
        <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-500" />
          <span className="text-[9.5px] font-black text-[#1e222b] uppercase tracking-wider">DISPATCH SEGMENTS & DATA FILTERS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          
          {/* A. Product search bar */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Keyword Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="SKU, No, ALU, Shelf..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white text-[#1e222b] placeholder-slate-400 border border-[#b1b5c2] focus:border-orange-500 pl-8 pr-2.5 py-1.5 text-[10.5px] font-bold uppercase rounded-none"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-805"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* B. Branch filter */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Warehouse Branch</label>
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              <option value="ALL">ALL BRANCHES</option>
              {branches.filter(b => b !== 'ALL').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* C. Warehouse filter */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Warehouse Sector</label>
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              <option value="ALL">ALL WAREHOUSES</option>
              {warehouses.filter(w => w !== 'ALL').map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          {/* D. Category filter */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Component Category</label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              <option value="ALL">ALL CATEGORIES</option>
              {categories.filter(c => c !== 'ALL').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Industrial Sector</label>
            <select
              value={selectedSector}
              onChange={e => setSelectedSector(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              {sectors.map(sector => (
                <option key={sector} value={sector}>{sector.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Shelf Location</label>
            <select
              value={selectedShelf}
              onChange={e => setSelectedShelf(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              {shelfLocations.map(shelf => (
                <option key={shelf} value={shelf}>{shelf.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Supplier</label>
            <select
              value={selectedSupplier}
              onChange={e => setSelectedSupplier(e.target.value)}
              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
            >
              {suppliers.map(supplier => (
                <option key={supplier} value={supplier}>{supplier.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {/* E. Stock Status filter */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Stock Status State</label>
            <div className="flex gap-1.5">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
              >
                {statuses.map(st => (
                  <option key={st} value={st}>{st.toUpperCase()}</option>
                ))}
              </select>
              {(selectedBranch !== 'ALL' || selectedCategory !== 'ALL' || selectedSector !== 'ALL' || selectedShelf !== 'ALL' || selectedSupplier !== 'ALL' || selectedStatus !== 'ALL' || selectedWarehouse !== 'ALL' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedBranch('ALL');
                    setSelectedCategory('ALL');
                    setSelectedSector('ALL');
                    setSelectedShelf('ALL');
                    setSelectedSupplier('ALL');
                    setSelectedWarehouse('ALL');
                    setSelectedStatus('ALL');
                    setSearchTerm('');
                  }}
                  className="px-2 bg-slate-100 hover:bg-slate-205 border border-[#b1b5c2] text-slate-700 uppercase font-black text-[10.5px] flex items-center justify-center shrink-0 rounded-none cursor-pointer"
                  title="Clear filters"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 5. MULTI-SPLIT LOWER SCREEN AND HIGH LEVEL DATA TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* main table column */}
        <div className="lg:col-span-8 bg-white border border-[#b1b5c2] p-4 space-y-4">
          
          <div className="flex justify-between items-center pb-2 border-b border-gray-150">
            <span className="font-extrabold text-[#111827] text-[10.5px] uppercase">MATCHES IN LOCAL SYSTEM ({sortedAndFilteredStock.length} SKU ENTITIES)</span>
            <span className="text-[9px] bg-slate-900 text-white px-2 py-0.5 font-bold font-mono">STATUS: HIGH INTEGRITY TELEMETRY</span>
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="w-full text-[10.5px] text-left border-collapse min-w-[1180px]">
              <thead>
                <tr className="bg-[#1e222b] text-white border-b-2 border-slate-900 uppercase text-[8.5px] font-black h-9 select-none">
                  <th className="py-2 px-3 hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('productNumericNumber')}>
                    <div className="flex items-center gap-1">Product No <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('code')}>
                    <div className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('name')}>
                    <div className="flex items-center gap-1">Part Description <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3">Sector</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Brand / Supplier</th>
                  <th className="py-2 px-3">Location (Branch/Whse)</th>
                  <th className="py-2 px-3">Shelf / Bin</th>
                  <th className="py-2 px-3 text-right hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('stock')}>
                    <div className="flex items-center gap-1 justify-end">Qty On Hand <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 text-right hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('minStock')}>
                    <div className="flex items-center gap-1 justify-end">Reorder Level <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 text-right">Cost / Sell</th>
                  <th className="py-2 px-3 text-center">Stock status</th>
                  <th className="py-2 px-3 text-center">Risk</th>
                  <th className="py-2 px-3 text-center w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedAndFilteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-12 text-center text-slate-400 uppercase font-bold bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Activity className="w-8 h-8 text-slate-300 animate-pulse" />
                        <span>No materials matched your query parameters.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedAndFilteredStock.map(p => {
                    const isLowStock = p.stock <= p.minStock && p.stockStatus !== 'Out of Stock';
                    const isOutStock = p.stock === 0;

                    // Match accurate badges
                    let statusBg = 'bg-gray-100 text-slate-800 border-gray-305';
                    if (p.stockStatus === 'In Stock') statusBg = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold';
                    else if (p.stockStatus === 'Low Stock' || p.stockStatus === 'Slow Moving') statusBg = 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
                    else if (p.stockStatus === 'Out of Stock') statusBg = 'bg-red-50 text-red-800 border-red-350 font-black animate-pulse';
                    else if (p.stockStatus === 'Fast Moving') statusBg = 'bg-orange-50 text-orange-850 border-orange-310 font-black';
                    else if (p.stockStatus === 'Variance Risk') statusBg = 'bg-amber-100 text-orange-900 border-orange-400 font-extrabold';

                    let riskBg = 'bg-gray-100 text-slate-700';
                    if (p.riskLevel === 'Medium') riskBg = 'bg-yellow-50 text-yellow-805 font-bold border border-yellow-250';
                    else if (p.riskLevel === 'High') riskBg = 'bg-orange-50 text-orange-805 font-black border border-orange-300';
                    else if (p.riskLevel === 'Critical') riskBg = 'bg-red-50 text-red-805 font-black border border-red-300 animate-pulse';

                    return (
                      <tr 
                        key={p.id} 
                        className={`hover:bg-slate-50/70 border-b border-gray-100 transition-colors ${
                          selectedProduct?.id === p.id ? 'bg-orange-50/20 text-[#111827]' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-black text-orange-700 whitespace-nowrap">{p.productNumericNumber || '000000000'}</td>
                        <td className="py-2 px-3 font-bold text-[#1e222b] whitespace-nowrap">
                          <div>{p.sku || p.code}</div>
                          <div className="text-[8px] text-slate-400">{p.alu || 'ALU-N/A'}</div>
                        </td>
                        <td className="py-2 px-3 max-w-[180px]">
                          <div className="font-extrabold text-slate-850 truncate uppercase">{p.productName || p.name}</div>
                          <div className="text-[8px] text-slate-400">BARCODE: {p.barcode || 'N/A'} | LAST MOVE: {p.lastMovementDate || 'N/A'}</div>
                        </td>
                        <td className="py-2 px-3 uppercase text-[9.5px] text-slate-600 whitespace-nowrap">{p.industrialSector || 'Motor Spares'}</td>
                        <td className="py-2 px-3 uppercase text-[9.5px] text-slate-500 whitespace-nowrap">
                          <div>{p.productCategory || p.category}</div>
                          <div className="text-[8px] text-slate-400">{p.productSubCategory || 'General'}</div>
                        </td>
                        <td className="py-2 px-3 uppercase text-[9px] text-slate-500">
                          <div className="font-black text-slate-700">{p.brand || 'Unbranded'}</div>
                          <div className="text-[8px]">{p.supplierName || p.supplier || 'N/A'}</div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[9.5px]">
                          <div className="font-bold text-slate-700">{p.branch || 'Harare Main'}</div>
                          <div className="text-[8.5px] text-slate-450">{p.warehouse || 'Main Warehouse'}</div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[9.5px] font-bold text-slate-700">
                          <div>{p.shelfLocation || 'A1-S1'}</div>
                          <div className="text-[8px] text-slate-400">{p.binLocation || 'BIN-N/A'}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-xs">
                          <span className={isOutStock ? 'text-red-500 font-black' : isLowStock ? 'text-orange-500 font-bold' : 'text-slate-900'}>
                            {p.stock}
                          </span>
                          <span className="text-[9px] text-slate-450 font-normal ml-0.5 uppercase">{p.unit}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500 whitespace-nowrap">
                          {p.minStock} <span className="text-[8px] text-slate-400">{p.unit}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[9px] text-slate-600 whitespace-nowrap">
                          <div>USD {(p.costPrice ?? p.cost).toFixed(2)}</div>
                          <div className="text-emerald-700 font-black">USD {(p.sellingPrice ?? p.price).toFixed(2)}</div>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block border px-1.5 py-0.5 text-[8.5px] uppercase tracking-wide rounded-none ${statusBg}`}>
                            {p.stockStatus || 'In Stock'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap text-[9px]">
                          <span className={`inline-block px-1.5 py-0.5 uppercase ${riskBg}`}>
                            {p.riskLevel || 'Low'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1 justify-center">
                            
                            {/* View details */}
                            <button
                              onClick={() => setSelectedProduct(p)}
                              className="p-1 bg-white text-slate-700 hover:text-orange-500 border border-[#b1b5c2] hover:border-orange-500 cursor-pointer"
                              title="Display telemetry"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Stocktake */}
                            <button
                              onClick={() => triggerStocktakeModal(p)}
                              className="p-1 bg-white text-slate-700 hover:text-orange-500 border border-[#b1b5c2] hover:border-orange-500 cursor-pointer"
                              title="Execute physical stocktake audit"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                            </button>

                            {/* Adjust */}
                            <button
                              onClick={() => triggerAdjustmentModal(p)}
                              className="p-1 bg-white text-slate-700 hover:text-orange-500 border border-[#b1b5c2] hover:border-orange-500 cursor-pointer"
                              title="Register adjustment request"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {/* Route Transfer */}
                            <button
                              onClick={() => triggerTransferModal(p)}
                              className="p-1 bg-white text-slate-700 hover:text-orange-500 border border-[#b1b5c2] hover:border-orange-500 cursor-pointer"
                              title="Request inter-branch dispatch transfer"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* Right side activity feed and view telemetry panel */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Active Product Telemetry Viewer */}
          {selectedProduct && (
            <div className="bg-white border-2 border-[#1e222b] p-4 relative pt-1 border-t-8 border-t-[#1e222b]">
              
              <div className="flex justify-between items-center border-b border-gray-150 pb-2 mb-3 mt-1">
                <span className="font-black text-[#1e222b] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-orange-500" />
                  PART SPECTRAL DATA FEED
                </span>
                <button 
                  onClick={() => setSelectedProduct(null)} 
                  className="text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-widest block">SKU ASSIGNMENT</span>
                  <span className="text-[13px] font-black text-orange-600 block">{selectedProduct.code}</span>
                  <h3 className="font-extrabold text-[#111827] text-[11px] uppercase mt-0.5">{selectedProduct.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-gray-200 p-2.5">
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-black block">System Qty</span>
                    <span className="text-[14px] font-black text-[#1e222b]">{selectedProduct.stock}</span>
                    <span className="text-[9px] text-[#f97316] font-bold block uppercase">{selectedProduct.unit}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-400 uppercase font-black block">Safety Floor</span>
                    <span className="text-[14px] font-black text-slate-700">{selectedProduct.minStock}</span>
                    <span className="text-[9px] text-slate-500 block uppercase">REORDER LEVEL</span>
                  </div>
                </div>

                <div className="space-y-1 text-[10px] text-slate-650 font-mono">
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">CATEGORY:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedProduct.category}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">TOWN BRANCH:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedProduct.branch || 'Harare Main'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">WAREHOUSE UNIT:</span>
                    <span className="font-bold text-slate-800 uppercase">{selectedProduct.warehouse || 'Main Warehouse'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">CATALOG RATE:</span>
                    <span className="font-bold text-slate-850">USD {selectedProduct.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">EST COST BASIS:</span>
                    <span className="font-bold text-slate-600">USD {selectedProduct.cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-gray-100">
                    <span className="text-slate-400">LAST MOVEMENT:</span>
                    <span className="font-bold text-slate-800">{selectedProduct.lastMovementDate}</span>
                  </div>
                </div>

                {/* Simulated mechanical barcode block for design credibility */}
                <div className="bg-slate-50 border border-gray-200 p-2 text-center select-none">
                  <span className="font-mono text-[8px] tracking-[4px] text-slate-700 select-none block uppercase font-black">
                    ||| | | |||| | ||| |||| | | |||
                  </span>
                  <span className="text-[8.5px] font-bold font-mono text-slate-450 block uppercase mt-1">
                    SYS-INTEGRITY: {selectedProduct.id}
                  </span>
                </div>

                {/* Fast Action Shortcuts inside panel */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-gray-105">
                  <button
                    onClick={() => triggerStocktakeModal(selectedProduct)}
                    className="px-2 py-1.5 text-center border border-[#b1b5c2] hover:border-orange-500 hover:text-orange-500 font-bold uppercase transition-colors rounded-none bg-white block text-[9.5px] cursor-pointer"
                  >
                    Audit
                  </button>
                  <button
                    onClick={() => triggerAdjustmentModal(selectedProduct)}
                    className="px-2 py-1.5 text-center border border-[#b1b5c2] hover:border-orange-500 hover:text-orange-500 font-bold uppercase transition-colors rounded-none bg-white block text-[9.5px] cursor-pointer"
                  >
                    Adjust
                  </button>
                  <button
                    onClick={() => triggerTransferModal(selectedProduct)}
                    className="px-2 py-1.5 text-center border border-[#b1b5c2] hover:border-orange-500 hover:text-orange-500 font-bold uppercase transition-colors rounded-none bg-white block text-[9.5px] cursor-pointer"
                  >
                    Route
                  </button>
                </div>

              </div>

            </div>
          )}

          {/* STOCK ACTIVITY EVENT FEED PANEL (Right Sidebar) */}
          <div className="bg-white border border-[#b1b5c2] p-4 space-y-4">
            
            <div className="flex justify-between items-center border-b border-gray-150 pb-2">
              <span className="font-black text-[#1e222b] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-500" />
                STOCK ACTIVITY JOURNAL
              </span>
              <span className="text-[8px] bg-amber-500/10 text-[#f97316] border border-[#f97316]/20 px-1.5 py-0.2 uppercase font-mono font-bold animate-pulse">
                ● LIVE FEED
              </span>
            </div>

            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 pos-custom-scroll">
              {activityFeed.map(ev => {
                
                let sevStyle = 'text-green-600 bg-green-50/50';
                if (ev.severity === 'Medium') sevStyle = 'text-amber-600 bg-amber-50/50';
                else if (ev.severity === 'High') sevStyle = 'text-orange-600 bg-orange-50/50 font-bold';
                else if (ev.severity === 'Critical') sevStyle = 'text-red-700 bg-red-50/70 font-black';

                return (
                  <div 
                    key={ev.id} 
                    className="border border-[#b1b5c2] bg-slate-50 p-2.5 text-[10px] space-y-1.5 hover:border-orange-500 transition-colors"
                  >
                    <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1">
                      <span className="font-black text-orange-600 text-[9.5px] tracking-wide uppercase">
                        {ev.type.replace('_', ' ')}
                      </span>
                      <span className="text-slate-400 font-mono text-[8px]">{ev.time}</span>
                    </div>

                    <p className="text-slate-700 uppercase leading-snug tracking-normal text-[9.5px]">
                      {ev.message}
                    </p>

                    <div className="flex justify-between items-center pt-1 mt-1 text-[8.5px]">
                      <span className="font-mono text-slate-400">ID: {ev.id}</span>
                      <span className={`px-1.5 py-0.2 text-[8px] uppercase font-bold tracking-wider ${sevStyle}`}>
                        {ev.severity} RISK
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-[8px] font-mono border-t border-gray-100 pt-3 text-slate-400 uppercase tracking-widest">
              <span>LEDGER SYSTEM INTEGRATED</span>
              <span>DASH SECURITY ON</span>
            </div>

          </div>

        </div>

      </div>


      {/* ========================================================================= */}
      {/* ===================== SCI CORE TRANSACTION MODALS ======================== */}
      {/* ========================================================================= */}

      {/* A. STOCKTAKE SYSTEM CONVERSION OVERLAY MODAL */}
      {activeModal === 'STOCKTAKE' && modalTargetProduct && (
        <div className="fixed inset-0 bg-slate-950/70 z-[800] flex items-center justify-center p-4">
          <form 
            onSubmit={handleStocktakeSubmit}
            className="w-full max-w-[440px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none"
          >
            {/* Titlebar */}
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between shrink-0 border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Physical Stocktake Audit Form
              </span>
              <button 
                type="button" 
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }} 
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              <div className="bg-slate-50 border border-gray-200 p-3 mb-1">
                <span className="text-[8px] text-slate-400 uppercase font-black block">Product Specification</span>
                <span className="font-black text-slate-800 text-[11px] block">{modalTargetProduct.code}</span>
                <h3 className="font-extrabold uppercase text-slate-700 text-[10px] leading-tight">{modalTargetProduct.name}</h3>
              </div>

              {/* Dynamic Variance calculation display panel */}
              {(() => {
                const physicalCountNum = parseInt(stPhysicalCount) || 0;
                const baseQty = modalTargetProduct.stock;
                const variance = physicalCountNum - baseQty;
                const varianceStr = variance === 0 ? '0' : (variance > 0 ? `+${variance}` : `${variance}`);
                
                return (
                  <div className="grid grid-cols-3 gap-2 text-center p-2.5 bg-slate-900 text-white font-mono text-[9.5px]">
                    <div>
                      <span className="text-slate-450 block uppercase text-[7.5px]">SYSTEM RECORD</span>
                      <span className="font-black text-xs text-slate-100">{baseQty} {modalTargetProduct.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block uppercase text-[7.5px]">OBSERVED COUNT</span>
                      <span className="font-black text-xs text-orange-400">{physicalCountNum} {modalTargetProduct.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-450 block uppercase text-[7.5px]">DELTA SLIP</span>
                      <span className={`font-black text-xs ${variance === 0 ? 'text-slate-450' : variance > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                        {varianceStr}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Observed Physical Count Qty
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    required
                    value={stPhysicalCount}
                    onChange={(e) => setStPhysicalCount(e.target.value)}
                    className="w-full bg-white text-[#1e222b] font-black border border-[#b1b5c2] focus:border-orange-500 text-sm px-3 py-2 outline-none rounded-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-450 font-black uppercase text-[9px]">
                    {modalTargetProduct.unit}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Audit Remarks / Observations
                </label>
                <textarea
                  rows={2}
                  maxLength={150}
                  value={stRemarks}
                  onChange={(e) => setStRemarks(e.target.value)}
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 text-[10.5px] px-2.5 py-1.5 outline-none font-mono rounded-none resize-none uppercase font-bold"
                  placeholder="e.g. Hand verification executed in Shelf Row 4. Discrepancy logged."
                />
              </div>

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }}
                className="px-4 py-2 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[10px] cursor-pointer rounded-none"
              >
                Apply Corrected Count
              </button>
            </div>

          </form>
        </div>
      )}

      {/* B. STOCK ADJUSTMENTS SYSTEM CONVERSION OVERLAY MODAL */}
      {activeModal === 'ADJUSTMENT' && modalTargetProduct && (
        <div className="fixed inset-0 bg-slate-950/70 z-[800] flex items-center justify-center p-4">
          <form 
            onSubmit={handleAdjustmentSubmit}
            className="w-full max-w-[440px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none"
          >
            {/* Titlebar */}
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between shrink-0 border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-orange-500" />
                Inventory Stock Adjustment Request
              </span>
              <button 
                type="button" 
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }} 
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              <div className="bg-slate-50 border border-gray-200 p-3 mb-1">
                <span className="text-[8px] text-slate-400 uppercase font-black block">Product SKU Unit</span>
                <span className="font-black text-slate-800 text-[11px] block">{modalTargetProduct.code}</span>
                <h3 className="font-extrabold uppercase text-slate-700 text-[10px] leading-tight">{modalTargetProduct.name}</h3>
                <span className="text-[9px] text-slate-500 font-bold block uppercase mt-1">
                  CURRENT SYSTEM QUANTITY: {modalTargetProduct.stock} {modalTargetProduct.unit}
                </span>
              </div>

              {/* Adjustment direction type */}
              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Adjustment Operational Vector
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjType('ADD')}
                    className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjType === 'ADD'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-black'
                        : 'bg-white text-slate-500 border-[#b1b5c2] hover:border-slate-804'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    ADD (+) INVENTORY
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjType('DEDUCT')}
                    className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjType === 'DEDUCT'
                        ? 'bg-rose-50 text-red-800 border-red-500 font-black'
                        : 'bg-white text-slate-500 border-[#b1b5c2] hover:border-slate-804'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    DEDUCT (-) INVENTORY
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Adjustment Quantity
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={adjQuantity}
                    onChange={(e) => setAdjQuantity(e.target.value)}
                    className="w-full bg-white text-[#1e222b] font-black border border-[#b1b5c2] focus:border-orange-500 text-sm px-3 py-2 outline-none rounded-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-450 font-black uppercase text-[9px]">
                    {modalTargetProduct.unit}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Authorization Reason / Explanation
                </label>
                <select
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
                >
                  <option value="Input error rectification">Input error rectification</option>
                  <option value="Damaged material on dock">Damaged material on dock</option>
                  <option value="Theft/unaccounted shrinkage">Theft/unaccounted shrinkage</option>
                  <option value="Supplier receipt discrepancy">Supplier receipt discrepancy</option>
                  <option value="Write-off obsolete stock">Write-off obsolete stock</option>
                </select>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }}
                className="px-4 py-2 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[10px] cursor-pointer rounded-none"
              >
                Log Adjustment Action
              </button>
            </div>

          </form>
        </div>
      )}

      {/* C. TRANSFER REQUEST SYSTEM OVERLAY MODAL */}
      {activeModal === 'TRANSFER' && modalTargetProduct && (
        <div className="fixed inset-0 bg-slate-950/70 z-[800] flex items-center justify-center p-4">
          <form 
            onSubmit={handleTransferSubmit}
            className="w-full max-w-[440px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none"
          >
            {/* Titlebar */}
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between shrink-0 border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                Inter-Branch Stock Transfer Request
              </span>
              <button 
                type="button" 
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }} 
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              <div className="bg-slate-50 border border-gray-200 p-3 mb-1">
                <span className="text-[8px] text-slate-400 uppercase font-black block">Product SKU</span>
                <span className="font-black text-slate-800 text-[11px] block">{modalTargetProduct.code}</span>
                <h3 className="font-extrabold uppercase text-slate-700 text-[10px] leading-tight">{modalTargetProduct.name}</h3>
                <span className="text-[9px] text-slate-500 font-bold block uppercase mt-1">
                  SOURCE BRANCH: {modalTargetProduct.branch || 'Harare Main'} ({modalTargetProduct.warehouse || 'Main Warehouse'})
                </span>
                <span className="text-[9px] text-slate-550 font-bold block uppercase">
                  ACTIVE ON-HAND QUANTITY AVAILABLE: {modalTargetProduct.stock} {modalTargetProduct.unit}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black block text-slate-550">
                    Destination Branch
                  </label>
                  <select
                    value={trDestBranch}
                    onChange={(e) => setTrDestBranch(e.target.value)}
                    className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.2 text-[10px] rounded-none font-bold uppercase h-8 cursor-pointer"
                  >
                    <option value="Bulawayo Depot">Bulawayo Depot</option>
                    <option value="Mutare Terminal">Mutare Terminal</option>
                    <option value="Gweru Sub-Depot">Gweru Sub-Depot</option>
                    <option value="Masvingo Hub">Masvingo Hub</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black block text-slate-550">
                    Destination Warehouse Sector
                  </label>
                  <select
                    value={trDestWarehouse}
                    onChange={(e) => setTrDestWarehouse(e.target.value)}
                    className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.2 text-[10px] rounded-none font-bold uppercase h-8 cursor-pointer"
                  >
                    <option value="Main Port Whse">Main Port Whse</option>
                    <option value="North Shed">North Shed</option>
                    <option value="Transit Container A">Transit Container A</option>
                    <option value="Secured Locker B">Secured Locker B</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Transfer Dispatch Quantity
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={modalTargetProduct.stock}
                    required
                    value={trQuantity}
                    onChange={(e) => setTrQuantity(e.target.value)}
                    className="w-full bg-white text-[#1e222b] font-black border border-[#b1b5c2] focus:border-orange-500 text-sm px-3 py-2 outline-none rounded-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-slate-450 font-black uppercase text-[9px]">
                    {modalTargetProduct.unit}
                  </span>
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveModal('NONE'); 
                  setModalTargetProduct(null);
                }}
                className="px-4 py-2 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[10px] cursor-pointer rounded-none"
              >
                Dispatch Transfer
              </button>
            </div>

          </form>
        </div>
      )}

      {/* D. RECEIVE GOODS SYSTEM OVERLAY MODAL */}
      {activeModal === 'RECEIVE_GOODS' && (
        <div className="fixed inset-0 bg-slate-950/70 z-[800] flex items-center justify-center p-4">
          <form 
            onSubmit={handleReceiveGoodsSubmit}
            className="w-full max-w-[440px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none"
          >
            {/* Titlebar */}
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between shrink-0 border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                Procurement Entry: Goods Intake Registry
              </span>
              <button 
                type="button" 
                onClick={() => setActiveModal('NONE')} 
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Target Product catalog SKU
                </label>
                <select
                  value={rxProductId}
                  onChange={(e) => setRxProductId(e.target.value)}
                  className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none font-bold uppercase h-8 cursor-pointer"
                >
                  {localStock.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name} (Hold: {p.stock})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8.5px] uppercase font-black block text-slate-550">
                  Intake Procurement Quantity
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    required
                    value={rxQuantity}
                    onChange={(e) => setRxQuantity(e.target.value)}
                    className="w-full bg-white text-[#1e222b] font-black border border-[#b1b5c2] focus:border-orange-500 text-[11px] px-3 py-1.5 outline-none rounded-none"
                  />
                  <span className="absolute right-3.5 top-2 text-slate-450 font-black uppercase text-[8px]">
                    ITEMS
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black block text-slate-550">
                    PO reference
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PO-2026-902"
                    value={rxPoRef}
                    onChange={(e) => setRxPoRef(e.target.value)}
                    className="w-full bg-white text-[#1e222b] placeholder-slate-350 border border-[#b1b5c2] focus:border-orange-500 text-[10.5px] px-2.5 py-1.5 outline-none font-bold uppercase rounded-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8.5px] uppercase font-black block text-slate-550">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Parts Supply Ltd"
                    value={rxSupplier}
                    onChange={(e) => setRxSupplier(e.target.value)}
                    className="w-full bg-white text-[#1e222b] placeholder-slate-350 border border-[#b1b5c2] focus:border-orange-500 text-[10.5px] px-2.5 py-1.5 outline-none font-bold uppercase rounded-none"
                  />
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setActiveModal('NONE')}
                className="px-4 py-2 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-extrabold uppercase text-[10px] cursor-pointer rounded-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[10px] cursor-pointer rounded-none"
              >
                Log Intake Replenishment
              </button>
            </div>

          </form>
        </div>
      )}

        </>
      )}

    </div>
  );
}

function LedgerMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#b1b5c2] p-3">
      <div className="text-[8px] text-slate-500 font-black uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-sm text-[#1e222b] font-black uppercase">{value}</div>
    </div>
  );
}

function LedgerInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-black uppercase outline-none focus:border-orange-500"
      />
    </label>
  );
}

function LedgerSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-black uppercase outline-none focus:border-orange-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: Array<Array<string | number>> }) {
  return (
    <div className="overflow-x-auto pos-custom-scroll">
      <table className="w-full min-w-[1120px] text-[10.5px] text-left border-collapse">
        <thead>
          <tr className="bg-[#1e222b] text-white uppercase text-[8.5px] font-black h-9">
            {headers.map((header) => (
              <th key={header} className="py-2 px-3 whitespace-nowrap">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="py-8 text-center text-slate-500 uppercase font-bold">No report rows match the current filters.</td>
            </tr>
          ) : rows.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={`${index}-${cellIndex}`} className="py-2 px-3 whitespace-nowrap uppercase">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
