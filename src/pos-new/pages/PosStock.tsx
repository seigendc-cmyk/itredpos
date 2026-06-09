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
import { Product, PosSession, Role, ApprovalRequest, ApprovalRequestType } from '../types';
import { mockProducts } from '../mock/mockPosData';
import { canPerformAction } from '../utils/posPermissions';
import { addLocalQueueItem } from '../utils/localQueueStore';
import StockPanels from './StockPanels';

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
  type: 'STOCKTAKE_SUBMITTED' | 'STOCK_ADJUSTMENT_REQUESTED' | 'LOW_STOCK_REMINDER' | 'SALE_BLOCKED_ZERO_STOCK' | 'RECOMMEND_MAJOR_STOCKTAKE' | 'STOCK_RECEIVED' | 'STOCK_TRANSFERRED';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  message: string;
}

// Interactive default mock products specified by user request dynamically generated from mockPosData
const DEFAULT_STOCK_ITEMS: StockProduct[] = mockProducts.map(p => {
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
  const [activeTab, setActiveTab] = useState<'Stock List' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake'>('Stock List');
  
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
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Interactive sorting configurations
  const [sortField, setSortField] = useState<'code' | 'name' | 'stock' | 'minStock'>('name');
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
    const list = new Set(localStock.map(p => p.category).filter(Boolean));
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
                              item.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesBranch = selectedBranch === 'ALL' || item.branch === selectedBranch;
        const matchesWarehouse = selectedWarehouse === 'ALL' || item.warehouse === selectedWarehouse;
        const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
        const matchesStatus = selectedStatus === 'ALL' || item.stockStatus === selectedStatus;

        return matchesSearch && matchesBranch && matchesWarehouse && matchesCategory && matchesStatus;
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
  }, [localStock, searchTerm, selectedBranch, selectedWarehouse, selectedCategory, selectedStatus, sortField, sortAsc]);

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
              <strong>Last Sync Status:</strong> <span className="text-slate-700 font-bold">Local Prototype Data</span>
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
        {(['Stock List', 'Goods Receiving', 'Purchase Orders', 'Supplier Returns', 'Stock Adjustments', 'Stocktake'] as const).map((tab) => {
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

      {activeTab !== 'Stock List' ? (
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* A. Product search bar */}
          <div className="space-y-1">
            <label className="text-[8.5px] uppercase font-bold text-slate-500">Keyword Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="SKU, Name, Category..."
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
              {(selectedBranch !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || selectedWarehouse !== 'ALL' || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedBranch('ALL');
                    setSelectedCategory('ALL');
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
            <table className="w-full text-[10.5px] text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-[#1e222b] text-white border-b-2 border-slate-900 uppercase text-[8.5px] font-black h-9 select-none">
                  <th className="py-2 px-3 hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('code')}>
                    <div className="flex items-center gap-1">SKU <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('name')}>
                    <div className="flex items-center gap-1">Part Description <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3">Location (Branch/Whse)</th>
                  <th className="py-2 px-3 text-right hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('stock')}>
                    <div className="flex items-center gap-1 justify-end">Qty On Hand <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 text-right hover:text-orange-400 cursor-pointer" onClick={() => handleToggleSort('minStock')}>
                    <div className="flex items-center gap-1 justify-end">Reorder Level <ArrowUpDown className="w-3 h-3" /></div>
                  </th>
                  <th className="py-2 px-3 text-center">Stock status</th>
                  <th className="py-2 px-3 text-center">Risk</th>
                  <th className="py-2 px-3 text-center w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedAndFilteredStock.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 uppercase font-bold bg-slate-50/50">
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
                        <td className="py-2 px-3 font-bold text-[#1e222b] whitespace-nowrap">{p.code}</td>
                        <td className="py-2 px-3 max-w-[180px]">
                          <div className="font-extrabold text-slate-850 truncate uppercase">{p.name}</div>
                          <div className="text-[8px] text-slate-400">LAST MOVE: {p.lastMovementDate || 'N/A'}</div>
                        </td>
                        <td className="py-2 px-3 uppercase text-[9.5px] text-slate-500 whitespace-nowrap">{p.category}</td>
                        <td className="py-2 px-3 whitespace-nowrap text-[9.5px]">
                          <div className="font-bold text-slate-700">{p.branch || 'Harare Main'}</div>
                          <div className="text-[8.5px] text-slate-450">{p.warehouse || 'Main Warehouse'}</div>
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
