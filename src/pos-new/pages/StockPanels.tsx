import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  X, 
  Plus, 
  Minus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShoppingBag, 
  ClipboardList, 
  Sliders, 
  ArrowRightLeft, 
  Eye, 
  PlusCircle, 
  Shield, 
  AlertCircle,
  HelpCircle,
  Download,
  Search,
  Filter,
  RotateCcw,
  Pencil,
  BarChart3,
  History,
  Activity,
  Archive,
  Ban
} from 'lucide-react';
import { 
  Product, 
  PosSession,
  Role, 
  PurchaseOrder, 
  PurchaseOrderActivityEvent,
  PurchaseOrderFilterState,
  PurchaseOrderLine,
  PurchaseOrderPriority,
  PurchaseOrderSource,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
  GoodsReceivingActivityEvent,
  GoodsReceivingFilterState,
  GoodsReceivingLine,
  GoodsReceivingNote,
  GoodsReceivingPostingResult,
  GoodsReceivingStatus,
  ReceivingVarianceType,
  SupplierReturnActivityEvent,
  SupplierReturnFilterState,
  SupplierReturnLine,
  SupplierReturnReason,
  SupplierReturnResolution,
  SupplierReturnStatus,
  SupplierReturnSummary,
  StockAdjustment,
  StockAdjustmentActivityEvent,
  StockAdjustmentFilterState,
  StockAdjustmentLine,
  StockAdjustmentReason,
  StockAdjustmentRiskLevel,
  StockAdjustmentStatus,
  StockAdjustmentSummary,
  StocktakeActivityEvent,
  StocktakeCountMode,
  StocktakeFilterState,
  GRNLine, 
  GoodsReceivedNote, 
  SupplierReturn, 
  StockAdjustmentRequest, 
  StocktakeLine, 
  StocktakePostingResult,
  StocktakeScope,
  StocktakeSession,
  StocktakeSessionSummary,
  StocktakeVarianceSummary,
  StockTransfer,
  StockTransferActivityEvent,
  StockTransferFilterState,
  StockTransferLine,
  StockTransferStatus,
  StockTransferSummary,
  StockTransferType,
  StockTransferVarianceType,
  InventoryMovement,
  ProductBarcodeRecord,
  ProductMasterFilterState,
  ProductMasterRecord,
  ProductMasterSummary,
  ProductPriceRecord,
  ProductReorderRule,
  ProductStockBalance,
  ProductStockBalanceSummary,
  ProductSupplierLink,
  ManualProductDraft,
  ManualProductValidationIssue,
  OpeningBalanceDraft,
  ProductCreationActivityEvent,
  ApprovalRequest, 
  ApprovalRequestType 
} from '../types';
import PurchaseOrderForm from '../components/PurchaseOrderForm';
import GoodsReceivingForm from '../components/GoodsReceivingForm';
import SupplierReturnForm from '../components/SupplierReturnForm';
import StockAdjustmentForm from '../components/StockAdjustmentForm';
import StocktakeForm from '../components/StocktakeForm';
import StockTransferForm from '../components/StockTransferForm';
import ProductMasterForm from '../components/ProductMasterForm';
import ProductTransformationPanel from '../components/ProductTransformationPanel';
import ManualProductForm from '../components/ManualProductForm';
import RowActionMenu, { RowActionMenuItem } from '../components/RowActionMenu';
import { getActiveVendorId, getVendorScopedStorageKey } from '../utils/vendorDataMode';
import { CommerceOperationContext } from '../../commerce-integration';
import { getCachedVendorTaxSettings } from '../services/vendorTaxSettingsService';
import { postLedgerMovement } from '../services/inventoryLedgerService';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  exportPurchaseOrderPlaceholder,
  getPurchaseOrderActivityEvents,
  getPurchaseOrderLines,
  getPurchaseOrders,
  getPurchaseOrderSummary,
  markPurchaseOrderSent,
  submitPurchaseOrderForApproval
} from '../services/purchaseOrderService';
import {
  approveGRN,
  cancelGRN,
  closePOWithOutstanding,
  createGRNDraftFromPO,
  exportGRNPlaceholder,
  getGoodsReceivingActivityEvents,
  getGoodsReceivingLines,
  getGoodsReceivingNotes,
  getPOReceivingSummary,
  postGRN,
  reopenPOPlaceholder,
  reverseGRNPlaceholder,
  submitGRNForApproval
} from '../services/goodsReceivingService';
import {
  approveSupplierReturn,
  cancelSupplierReturn,
  closeSupplierReturn,
  createSupplierReturnFromGRN,
  exportSupplierReturnPlaceholder,
  getSupplierReturnActivityEvents,
  getSupplierReturnLines,
  getSupplierReturns,
  getSupplierReturnSummary,
  markDispatchedToSupplier,
  postSupplierReturn,
  recordReplacementExpected,
  recordSupplierCreditNotePlaceholder,
  submitSupplierReturnForApproval,
  SupplierReturnPostingResult
} from '../services/supplierReturnService';
import {
  approveStockAdjustment,
  cancelStockAdjustment,
  exportStockAdjustmentPlaceholder,
  getStockAdjustmentActivityEvents,
  getStockAdjustmentLines,
  getStockAdjustments,
  getStockAdjustmentSummary,
  postStockAdjustment,
  recordStockAdjustmentPlaceholderActivity,
  rejectStockAdjustment,
  reverseStockAdjustmentPlaceholder,
  StockAdjustmentPostingResult,
  submitStockAdjustmentForApproval
} from '../services/stockAdjustmentService';
import {
  approveStocktake,
  bulkUpdateStocktakeCounts,
  cancelStocktake,
  completeStocktakeRecount,
  createStocktakeSession,
  excludeStocktakeLine,
  exportStocktakePlaceholder,
  getStocktakeActivityEvents,
  getStocktakeLines,
  getStocktakeSessionById,
  getStocktakeSessions,
  getStocktakeSessionSummary,
  postStocktakeVariance,
  requestRecount,
  restoreStocktakeLine,
  submitStocktake,
  updateStocktakeLineCount,
  updateStocktakeSessionDraft,
  calculateStocktakeVarianceSummary,
  generateStocktakeLinesFromScope
} from '../services/stocktakeService';
import {
  addStockTransferLine,
  approveStockTransfer,
  cancelStockTransfer,
  closeTransferWithOutstanding,
  createStockTransferDraft,
  dispatchStockTransfer,
  exportStockTransferPlaceholder,
  getStockTransferActivityEvents,
  getStockTransferById,
  getStockTransferLines,
  getStockTransferSummary,
  getStockTransfers,
  postTransferReceipt,
  receiveStockTransfer,
  rejectStockTransfer,
  removeStockTransferLine,
  submitStockTransferForApproval,
  updateStockTransferDraft,
  updateStockTransferLine
} from '../services/stockTransferService';
import {
  blockProduct,
  exportProductMasterPlaceholder,
  getProductBarcodes,
  getProductMasterAudit,
  getProductMasterRecords,
  getProductMasterSummary,
  getProductPrices,
  getProductReorderRules,
  getProductSupplierLinks,
  markProductInactive,
  updateProductMasterPlaceholder
} from '../services/productMasterService';
import {
  activateProduct,
  approveOpeningBalanceDraft,
  cancelOpeningBalanceDraft,
  createManualProductDraft,
  createOpeningBalanceDraft,
  detectManualProductDuplicate,
  getOpeningBalanceDrafts as getManualOpeningBalanceDrafts,
  getProductCreationActivityEvents,
  postOpeningBalanceDraft,
  validateManualProduct
} from '../services/manualProductService';
import {
  exportStockBalancesPlaceholder,
  getProductStockBalances,
  getProductStockBalanceSummary
} from '../services/stockBalanceService';
import { getInventoryMovementsByProduct } from '../services/inventoryMovementService';
import { canPerformAction } from '../utils/posPermissions';
import { roleHasEffectivePermission } from '../auth/effectivePermissionService';
import { matchesFreeOrderSearch } from '../utils/searchUtils';

interface StockProduct extends Product {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Dead Stock' | 'Variance Risk' | 'Fast Moving' | 'Slow Moving';
}

interface LegacySupplierReturnRecord {
  id: string;
  supplierName: string;
  originalGrn: string;
  sku: string;
  productName: string;
  quantityReturned: number;
  reason: string;
  condition: string;
  status: 'Draft' | 'Pending Approval' | 'Shipped' | 'Credited';
  createdDate: string;
  requestedBy: string;
}

interface StockPanelsProps {
  localStock: StockProduct[];
  setLocalStock: (stock: StockProduct[]) => void;
  saveLocalStockState: (stock: StockProduct[]) => void;
  staffName: string;
  activeBranch: string;
  simulatedRole: Role;
  setSimulatedRole: (role: Role) => void;
  triggerNewActivityEvent: (type: any, message: string, severity: 'Low' | 'Medium' | 'High' | 'Critical') => void;
  stockApprovals: ApprovalRequest[];
  setStockApprovals: React.Dispatch<React.SetStateAction<ApprovalRequest[]>>;
  canApprove: (reqType: ApprovalRequestType, role: Role) => boolean;
  onUpdateStock: (productId: string, newStock: number) => void;
  activeTab: 'Stock List' | 'Product Master' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake' | 'Stock Transfers' | 'Product Transformation';
  setActiveTab: (tab: 'Stock List' | 'Product Master' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake' | 'Stock Transfers' | 'Product Transformation') => void;
  stocktakePreselect?: { shelfLocation?: string; productIds?: string[] } | null;
  stocktakePreselectToken?: number;
  productLimitReached?: boolean;
  productLimitMessage?: string;
  session?: PosSession | null;
}

export default function StockPanels({
  localStock,
  setLocalStock,
  saveLocalStockState,
  staffName,
  activeBranch,
  simulatedRole,
  setSimulatedRole,
  triggerNewActivityEvent,
  stockApprovals,
  setStockApprovals,
  canApprove,
  onUpdateStock,
  activeTab,
  setActiveTab,
  stocktakePreselect,
  stocktakePreselectToken = 0,
  productLimitReached = false,
  productLimitMessage = 'Product limit reached for your current plan.',
  session = null
}: StockPanelsProps) {

  // --- LOCAL PERSISTENCE STORAGE FOR SUB-PAGES ---
  const blockedPermissionMessage = 'You do not have permission to perform this action.';
  const actionErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Action failed. Please try again.';
  const vendorId = session?.vendorId || getActiveVendorId();
  const defaultVatRate = getCachedVendorTaxSettings(vendorId).defaultVatRate;
  const stockBranchName = session?.branch || activeBranch;
  const activeWarehouseId = session?.warehouseId || '';
  const supplierReturnsKey = getVendorScopedStorageKey('sci_pos_supplier_returns', vendorId);

  const [productMasterRows, setProductMasterRows] = useState<ProductMasterRecord[]>([]);
  const [allProductBalances, setAllProductBalances] = useState<ProductStockBalance[]>([]);
  const [productMasterSummary, setProductMasterSummary] = useState<ProductMasterSummary>({
    totalProducts: 0,
    activeProducts: 0,
    blockedProducts: 0,
    inactiveProducts: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
    multiLocationProducts: 0,
    supplierLinkedProducts: 0,
    riskProducts: 0
  });
  const [stockBalanceSummary, setStockBalanceSummary] = useState<ProductStockBalanceSummary>({
    totalLocations: 0,
    totalQtyOnHand: 0,
    totalQtyAvailable: 0,
    totalQtyReserved: 0,
    totalQtyDamaged: 0,
    totalQtyInTransit: 0,
    lowStockLocations: 0,
    outOfStockLocations: 0,
    stocktakeReviewLocations: 0
  });
  const [productMasterFilters, setProductMasterFilters] = useState<ProductMasterFilterState>({
    status: 'ALL',
    riskStatus: 'ALL',
    locationType: 'ALL',
    stockStatus: 'ALL'
  });
  const [productMasterSearch, setProductMasterSearch] = useState('');
  const [productMasterFilterDrawerOpen, setProductMasterFilterDrawerOpen] = useState(false);
  const [openProductMasterMenuId, setOpenProductMasterMenuId] = useState<string | null>(null);
  const [selectedProductMaster, setSelectedProductMaster] = useState<ProductMasterRecord | null>(null);
  const [selectedProductBalances, setSelectedProductBalances] = useState<ProductStockBalance[]>([]);
  const [selectedProductBarcodes, setSelectedProductBarcodes] = useState<ProductBarcodeRecord[]>([]);
  const [selectedProductPrices, setSelectedProductPrices] = useState<ProductPriceRecord[]>([]);
  const [selectedProductSupplierLinks, setSelectedProductSupplierLinks] = useState<ProductSupplierLink[]>([]);
  const [selectedProductReorderRules, setSelectedProductReorderRules] = useState<ProductReorderRule[]>([]);
  const [selectedProductLedger, setSelectedProductLedger] = useState<InventoryMovement[]>([]);
  const [selectedProductAudit, setSelectedProductAudit] = useState<Array<{ id: string; productId: string; eventType: string; message: string; staffId: string; createdAt: string }>>([]);
  const [productMasterNotice, setProductMasterNotice] = useState<string | null>(null);
  const emptyManualProductDraft = (): ManualProductDraft => ({
    vendorId,
    productName: '',
    industrialSector: 'GENERAL_RETAIL',
    category: '',
    subcategory: '',
    unitOfMeasure: 'pcs',
    status: 'Active',
    condition: 'New',
    productStatus: 'Draft',
    taxMode: 'VAT Registered',
    vatRate: defaultVatRate,
    branchId: stockBranchName,
    warehouseId: activeWarehouseId,
    locationType: session?.warehouse === 'Main Warehouse' || session?.warehouse === 'Branch Warehouse' || session?.warehouse === 'In Transit' ? session.warehouse : 'Other',
    createdByStaffId: staffName,
    createdByStaffName: staffName
  });
  const [manualProductOpen, setManualProductOpen] = useState(false);
  const [manualProductDraft, setManualProductDraft] = useState<ManualProductDraft>(emptyManualProductDraft());
  const [manualProductValidation, setManualProductValidation] = useState<ManualProductValidationIssue[]>([]);
  const [manualProductActivity, setManualProductActivity] = useState<ProductCreationActivityEvent[]>([]);
  const [manualOpeningBalanceDrafts, setManualOpeningBalanceDrafts] = useState<OpeningBalanceDraft[]>([]);
  const [manualSavedProduct, setManualSavedProduct] = useState<ProductMasterRecord | null>(null);
  const [manualDuplicateProduct, setManualDuplicateProduct] = useState<ProductMasterRecord | null>(null);
  const [manualProductNotice, setManualProductNotice] = useState<string | null>(null);

  const refreshProductMaster = async (filters = productMasterFilters) => {
    const [rows, summary, balanceSummary, balances, openingDrafts, creationActivity] = await Promise.all([
      getProductMasterRecords(filters),
      getProductMasterSummary(filters),
      getProductStockBalanceSummary(),
      getProductStockBalances(),
      getManualOpeningBalanceDrafts({}),
      getProductCreationActivityEvents({})
    ]);
    setProductMasterRows(rows);
    setProductMasterSummary(summary);
    setStockBalanceSummary(balanceSummary);
    setAllProductBalances(balances);
    setManualOpeningBalanceDrafts(openingDrafts);
    setManualProductActivity(creationActivity);
  };

  const visibleProductMasterRows = useMemo(() => productMasterRows.filter((product) => matchesFreeOrderSearch(product, productMasterSearch, [
    'productCode',
    'sku',
    'barcode',
    'alu',
    'vendorSku',
    'productNumericNumber',
    'productName',
    'description',
    'shortDescription',
    'brand',
    'manufacturer',
    'supplierName',
    'supplierItemCode',
    'industrialSector',
    'productCategory',
    'productSubCategory',
    'category',
    'make',
    'model',
    'partNumber',
    'oemNumber',
    (item) => item.preferredSupplierName,
    (item) => item.sectorAttributes.sector,
    (item) => item.sectorAttributes.brand,
    (item) => item.sectorAttributes.manufacturer,
    (item) => item.sectorAttributes.make,
    (item) => item.sectorAttributes.model,
    (item) => item.sectorAttributes.productCategory,
    (item) => item.sectorAttributes.productSubCategory,
    (item) => item.sectorAttributes.partNumber,
    (item) => item.sectorAttributes.oemNumber,
    (item) => item.tags?.join(' ')
  ])), [productMasterRows, productMasterSearch]);

  const canUseProductMasterPermission = (permissionKey: string) => roleHasEffectivePermission(String(simulatedRole), permissionKey);

  const applyProductMasterFilters = async () => {
    const nextFilters = { ...productMasterFilters, search: productMasterSearch };
    setProductMasterFilters(nextFilters);
    await refreshProductMaster(nextFilters);
    setProductMasterFilterDrawerOpen(false);
  };

  const clearProductMasterFilters = async () => {
    const clearedFilters: ProductMasterFilterState = {
      status: 'ALL',
      riskStatus: 'ALL',
      locationType: 'ALL',
      stockStatus: 'ALL'
    };
    setProductMasterSearch('');
    setProductMasterFilters(clearedFilters);
    await refreshProductMaster(clearedFilters);
    setProductMasterFilterDrawerOpen(false);
  };

  const productMasterActionItems = (product: ProductMasterRecord): RowActionMenuItem[] => [
    {
      label: 'View Product',
      icon: <Eye className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.view'),
      onClick: () => openProductMaster(product)
    },
    {
      label: 'Edit Product',
      icon: <Pencil className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.edit'),
      onClick: () => openProductMaster(product)
    },
    {
      label: 'View Balances',
      icon: <BarChart3 className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.view'),
      onClick: () => openProductMaster(product)
    },
    {
      label: 'View Ledger',
      icon: <History className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.view'),
      onClick: () => setProductMasterNotice(`Product Ledger can be opened filtered by ${product.sku}.`)
    },
    {
      label: 'View Movements',
      icon: <Activity className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.view'),
      onClick: () => setProductMasterNotice(`Inventory Movements can be opened filtered by ${product.sku}.`)
    },
    {
      label: 'Create Stock Adjustment',
      icon: <Sliders className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('stockAdjustment.create'),
      onClick: () => setProductMasterNotice('Stock correction must be made from Stock Adjustments. Product Master does not edit quantities.')
    },
    {
      label: 'Mark Inactive',
      icon: <Archive className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.edit'),
      danger: true,
      onClick: () => {
        void markProductInactive(product.productId, staffName, 'Marked inactive from Product Master table.').then(() => refreshProductMaster(productMasterFilters));
      }
    },
    {
      label: 'Block Product',
      icon: <Ban className="w-3.5 h-3.5" />,
      disabled: !canUseProductMasterPermission('productMaster.block'),
      danger: true,
      onClick: () => {
        void blockProduct(product.productId, staffName, 'Blocked from Product Master table.').then(() => refreshProductMaster(productMasterFilters));
      }
    }
  ];

  const openProductMaster = async (product: ProductMasterRecord) => {
    const [balances, barcodes, prices, suppliers, reorderRules, ledger, audit] = await Promise.all([
      getProductStockBalances(product.productId),
      getProductBarcodes(product.productId),
      getProductPrices(product.productId),
      getProductSupplierLinks(product.productId),
      getProductReorderRules(product.productId),
      getInventoryMovementsByProduct(product.productId),
      getProductMasterAudit(product.productId)
    ]);
    setSelectedProductMaster(product);
    setSelectedProductBalances(balances);
    setSelectedProductBarcodes(barcodes);
    setSelectedProductPrices(prices);
    setSelectedProductSupplierLinks(suppliers);
    setSelectedProductReorderRules(reorderRules);
    setSelectedProductLedger(ledger);
    setSelectedProductAudit(audit);
  };

  useEffect(() => {
    refreshProductMaster();
  }, []);

  const openManualProductForm = async () => {
    if (productLimitReached) {
      setProductMasterNotice(productLimitMessage);
      return;
    }
    if (!canPerformAction(simulatedRole, 'productMaster.create')) {
      setProductMasterNotice(blockedPermissionMessage);
      return;
    }
    setManualProductDraft(emptyManualProductDraft());
    setManualSavedProduct(null);
    setManualDuplicateProduct(null);
    setManualProductValidation([]);
    setManualProductNotice(null);
    setManualProductOpen(true);
    setManualOpeningBalanceDrafts(await getManualOpeningBalanceDrafts({}));
    setManualProductActivity(await getProductCreationActivityEvents({}));
  };

  const runManualValidation = async (draft = manualProductDraft) => {
    const issues = await validateManualProduct(draft);
    setManualProductValidation(issues);
    return issues;
  };

  const handleManualDuplicateCheck = async () => {
    const duplicate = await detectManualProductDuplicate(manualProductDraft);
    setManualDuplicateProduct(duplicate || null);
    setManualProductNotice(duplicate ? `Duplicate risk found: ${duplicate.productName}.` : 'No duplicate product found locally.');
    await runManualValidation();
  };

  const handleManualSaveDraft = async () => {
    if (productLimitReached) {
      setManualProductNotice(productLimitMessage);
      return;
    }
    if (!canPerformAction(simulatedRole, 'productMaster.create')) {
      setManualProductNotice(blockedPermissionMessage);
      return;
    }
    const issues = await runManualValidation();
    if (issues.some((issue) => issue.severity === 'Error' && issue.field === 'duplicate')) {
      setManualProductNotice('Duplicate active product blocks draft creation.');
      return;
    }
    const created = await createManualProductDraft({ ...manualProductDraft, productStatus: 'Draft', createdByStaffId: staffName, createdByStaffName: staffName });
    setManualSavedProduct(created);
    setManualProductDraft((current) => ({ ...current, productId: created.productId, sku: created.sku, productName: created.productName }));
    setManualProductNotice('Manual product draft created locally. Stock was not posted.');
    await refreshProductMaster(productMasterFilters);
  };

  const handleManualActivate = async () => {
    if (productLimitReached) {
      setManualProductNotice(productLimitMessage);
      return;
    }
    if (!canPerformAction(simulatedRole, 'productMaster.activate')) {
      setManualProductNotice(blockedPermissionMessage);
      return;
    }
    const issues = await runManualValidation(manualProductDraft);
    if (issues.some((issue) => issue.severity === 'Error')) {
      setManualProductNotice('Activation blocked by validation errors. Product was not activated.');
      return;
    }
    const product = manualSavedProduct || await createManualProductDraft({ ...manualProductDraft, productStatus: 'Draft', createdByStaffId: staffName, createdByStaffName: staffName });
    const updated = await activateProduct(product.productId, staffName);
    if (updated) {
      setManualSavedProduct(updated);
      setManualProductNotice('Product activated locally. Stock was not posted.');
      await refreshProductMaster(productMasterFilters);
    }
  };

  const handleManualCreateOpeningBalance = async () => {
    if (!manualSavedProduct && productLimitReached) {
      setManualProductNotice(productLimitMessage);
      return;
    }
    if (!canPerformAction(simulatedRole, 'openingBalance.create')) {
      setManualProductNotice(blockedPermissionMessage);
      return;
    }
    const product = manualSavedProduct || await createManualProductDraft({ ...manualProductDraft, productStatus: 'Draft', createdByStaffId: staffName, createdByStaffName: staffName });
    const qty = Number(manualProductDraft.openingQty || 0);
    const unitCost = Number(manualProductDraft.openingUnitCost ?? manualProductDraft.costPrice ?? 0);
    if (qty < 0 || unitCost < 0) {
      setManualProductNotice('Opening quantity and unit cost must be zero or above.');
      return;
    }
    if (qty === 0) {
      setManualProductNotice('Enter an opening quantity above zero to create a draft.');
      return;
    }
    await createOpeningBalanceDraft({
      vendorId: product.vendorId,
      branchId: manualProductDraft.branchId || 'BR-HARARE',
      warehouseId: manualProductDraft.warehouseId || 'WH-HARARE-01',
      productId: product.productId,
      sku: product.sku,
      productName: product.productName,
      shelfLocation: manualProductDraft.shelfLocation,
      qty,
      unitCost,
      createdByStaffId: staffName,
      createdByStaffName: staffName,
      notes: 'Created from Manual Product form. Stock not posted.'
    });
    setManualSavedProduct(product);
    setManualProductNotice('Opening Balance Draft created. Stock was not posted.');
    await refreshProductMaster(productMasterFilters);
  };

  const handleOpeningBalanceAction = async (draft: OpeningBalanceDraft, action: 'approve' | 'post' | 'cancel') => {
    const permission = action === 'approve' ? 'openingBalance.approve' : action === 'post' ? 'openingBalance.post' : 'openingBalance.cancel';
    if (!canPerformAction(simulatedRole, permission)) {
      setProductMasterNotice(blockedPermissionMessage);
      return;
    }
    if (action === 'approve') {
      await approveOpeningBalanceDraft(draft.openingBalanceId, staffName, 'Approved from Product Master Opening Balance Drafts panel.');
      setProductMasterNotice('Opening balance draft approved locally.');
    } else if (action === 'post') {
      await postOpeningBalanceDraft(draft.openingBalanceId, staffName);
      setProductMasterNotice('Opening balance posted as OPENING_BALANCE inventory movement.');
    } else {
      await cancelOpeningBalanceDraft(draft.openingBalanceId, staffName, 'Cancelled from Product Master Opening Balance Drafts panel.');
      setProductMasterNotice('Opening balance draft cancelled locally.');
    }
    await refreshProductMaster(productMasterFilters);
  };
  
  // 1. Purchase Orders State. PO records are procurement memos only: no stock,
  // accounting, cashbook, COGS or inventory asset value is posted from this flow.
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrderLines, setPurchaseOrderLines] = useState<Record<string, PurchaseOrderLine[]>>({});
  const [purchaseOrderSummary, setPurchaseOrderSummary] = useState<PurchaseOrderSummary>({
    totalPOs: 0,
    draftPOs: 0,
    pendingApproval: 0,
    approved: 0,
    sentToSupplier: 0,
    partiallyReceived: 0,
    fullyReceived: 0,
    cancelled: 0,
    estimatedPOValue: 0,
    outstandingQty: 0
  });
  const [purchaseOrderFilters, setPurchaseOrderFilters] = useState<PurchaseOrderFilterState>({
    status: 'ALL',
    priority: 'ALL',
    source: 'ALL'
  });
  const [purchaseOrderEvents, setPurchaseOrderEvents] = useState<PurchaseOrderActivityEvent[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedPOLines, setSelectedPOLines] = useState<PurchaseOrderLine[]>([]);
  const [poFormOpen, setPoFormOpen] = useState(false);
  const [poFormOrder, setPoFormOrder] = useState<PurchaseOrder | null>(null);
  const [poFormLines, setPoFormLines] = useState<PurchaseOrderLine[]>([]);
  const [poFeedback, setPoFeedback] = useState<string | null>(null);
  const [purchaseOrderFilterDrawerOpen, setPurchaseOrderFilterDrawerOpen] = useState(false);
  const [openPurchaseOrderMenuId, setOpenPurchaseOrderMenuId] = useState<string | null>(null);

  const refreshPurchaseOrders = async (filters = purchaseOrderFilters) => {
    const [orders, summary, events] = await Promise.all([
      getPurchaseOrders(filters),
      getPurchaseOrderSummary(filters),
      getPurchaseOrderActivityEvents()
    ]);
    const linePairs = await Promise.all(orders.map(async (order) => [order.poId, await getPurchaseOrderLines(order.poId)] as const));
    setPurchaseOrders(orders);
    setPurchaseOrderSummary(summary);
    setPurchaseOrderEvents(events);
    setPurchaseOrderLines(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshPurchaseOrders();
  }, []);

  // 2. Goods Receiving Form and Lines State
  const [grnNumber, setGrnNumber] = useState(() => `GRN-2026-${Math.floor(Math.random() * 8999 + 1000)}`);
  const [grnSupplier, setGrnSupplier] = useState('');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState('');
  const [grnPoRef, setGrnPoRef] = useState('');
  const [grnBranch, setGrnBranch] = useState(stockBranchName);
  const [grnWarehouse, setGrnWarehouse] = useState('Main Warehouse');
  const [grnNotes, setGrnNotes] = useState('');
  const [grnLines, setGrnLines] = useState<GRNLine[]>([]);

  // Handle updates on active fields in GRN Table
  const updateGRNLineField = (sku: string, field: keyof GRNLine, value: any) => {
    setGrnLines(prev => prev.map(line => {
      if (line.sku === sku) {
        const updated = { ...line, [field]: value };
        
        // Dynamic Status Checking
        const ordered = updated.orderedQty;
        const received = updated.receivedQty;
        const cost = updated.costPrice;
        const prevCost = updated.prevCostPrice;
        
        // Base variance status
        let status = 'Matched';
        if (received < ordered) {
          status = 'Short Received';
        } else if (received > ordered) {
          status = 'Over Received';
        }

        // Cost price spike rule (15%)
        const costSpikePct = (cost - prevCost) / prevCost;
        if (costSpikePct > 0.15) {
          status = 'Cost Spike (' + (costSpikePct * 100).toFixed(0) + '%)';
        }

        return { ...updated, status };
      }
      return line;
    }));
  };

  const [grnFeedback, setGrnFeedback] = useState<{ type: 'success' | 'error' | 'warning', msg: string } | null>(null);

  const [goodsReceivingNotes, setGoodsReceivingNotes] = useState<GoodsReceivingNote[]>([]);
  const [goodsReceivingLineMap, setGoodsReceivingLineMap] = useState<Record<string, GoodsReceivingLine[]>>({});
  const [goodsReceivingEvents, setGoodsReceivingEvents] = useState<GoodsReceivingActivityEvent[]>([]);
  const [goodsReceivingFilters, setGoodsReceivingFilters] = useState<GoodsReceivingFilterState>({
    status: 'ALL',
    varianceType: 'ALL'
  });
  const [goodsReceivingFormOpen, setGoodsReceivingFormOpen] = useState(false);
  const [activeGoodsReceivingNote, setActiveGoodsReceivingNote] = useState<GoodsReceivingNote | null>(null);
  const [goodsReceivingNotice, setGoodsReceivingNotice] = useState<string | null>(null);
  const [goodsReceivingFilterDrawerOpen, setGoodsReceivingFilterDrawerOpen] = useState(false);
  const [openGoodsReceivingMenuId, setOpenGoodsReceivingMenuId] = useState<string | null>(null);
  const [outstandingPOModalOpen, setOutstandingPOModalOpen] = useState(false);
  const [outstandingPOSupplier, setOutstandingPOSupplier] = useState('');

  const refreshGoodsReceiving = async (filters = goodsReceivingFilters) => {
    const [notes, events] = await Promise.all([
      getGoodsReceivingNotes(filters),
      getGoodsReceivingActivityEvents(filters)
    ]);
    const linePairs = await Promise.all(notes.map(async (note) => [note.grnId, await getGoodsReceivingLines(note.grnId)] as const));
    setGoodsReceivingNotes(notes);
    setGoodsReceivingEvents(events);
    setGoodsReceivingLineMap(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshGoodsReceiving();
  }, []);

  const goodsReceivingSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const allLines = Object.values(goodsReceivingLineMap).flat() as GoodsReceivingLine[];
    return {
      draftGRNs: goodsReceivingNotes.filter((note) => note.receivingStatus === 'Draft').length,
      pendingApproval: goodsReceivingNotes.filter((note) => note.receivingStatus === 'Pending Approval').length,
      postedToday: goodsReceivingNotes.filter((note) => (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') && note.postedAt?.slice(0, 10) === today).length,
      partialReceipts: allLines.filter((line) => line.lineStatus === 'Partially Received').length,
      grnVariances: allLines.filter((line) => line.varianceType !== 'None').length,
      outstandingPOLines: allLines.filter((line) => line.qtyOutstandingAfterGRN > 0 && !line.removeFromCurrentGRN).length,
      supplierInvoiceMissing: goodsReceivingNotes.filter((note) => !note.supplierInvoiceNumber.trim()).length,
      awaitingStockPosting: goodsReceivingNotes.filter((note) => note.receivingStatus === 'Draft' || note.receivingStatus === 'Pending Approval').length
    };
  }, [goodsReceivingLineMap, goodsReceivingNotes]);

  const [supplierReturnRecords, setSupplierReturnRecords] = useState<SupplierReturn[]>([]);
  const [supplierReturnLineMap, setSupplierReturnLineMap] = useState<Record<string, SupplierReturnLine[]>>({});
  const [supplierReturnEvents, setSupplierReturnEvents] = useState<SupplierReturnActivityEvent[]>([]);
  const [supplierReturnSummary, setSupplierReturnSummary] = useState<SupplierReturnSummary>({
    draftReturns: 0,
    pendingApproval: 0,
    postedReturns: 0,
    dispatched: 0,
    creditNotesPending: 0,
    replacementsPending: 0,
    supplierRejected: 0,
    closedReturns: 0,
    returnQty: 0,
    returnValueEstimate: 0
  });
  const [supplierReturnFilters, setSupplierReturnFilters] = useState<SupplierReturnFilterState>({
    status: 'ALL',
    reason: 'ALL',
    resolution: 'ALL'
  });
  const [supplierReturnFormOpen, setSupplierReturnFormOpen] = useState(false);
  const [activeSupplierReturn, setActiveSupplierReturn] = useState<SupplierReturn | null>(null);
  const [supplierReturnNotice, setSupplierReturnNotice] = useState<string | null>(null);
  const [supplierReturnFilterDrawerOpen, setSupplierReturnFilterDrawerOpen] = useState(false);
  const [openSupplierReturnMenuId, setOpenSupplierReturnMenuId] = useState<string | null>(null);
  const [supplierGRNModalOpen, setSupplierGRNModalOpen] = useState(false);
  const [supplierGRNSupplier, setSupplierGRNSupplier] = useState('');

  const refreshSupplierReturns = async (filters = supplierReturnFilters) => {
    const [records, events, summary] = await Promise.all([
      getSupplierReturns(filters),
      getSupplierReturnActivityEvents(filters),
      getSupplierReturnSummary(filters)
    ]);
    const linePairs = await Promise.all(records.map(async (record) => [record.supplierReturnId, await getSupplierReturnLines(record.supplierReturnId)] as const));
    setSupplierReturnRecords(records);
    setSupplierReturnEvents(events);
    setSupplierReturnSummary(summary);
    setSupplierReturnLineMap(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshSupplierReturns();
  }, []);

  const [stockAdjustmentRecords, setStockAdjustmentRecords] = useState<StockAdjustment[]>([]);
  const [stockAdjustmentLineMap, setStockAdjustmentLineMap] = useState<Record<string, StockAdjustmentLine[]>>({});
  const [stockAdjustmentEvents, setStockAdjustmentEvents] = useState<StockAdjustmentActivityEvent[]>([]);
  const [stockAdjustmentSummary, setStockAdjustmentSummary] = useState<StockAdjustmentSummary>({
    draftAdjustments: 0,
    pendingApproval: 0,
    approved: 0,
    postedToday: 0,
    highRisk: 0,
    critical: 0,
    positiveAdjustments: 0,
    negativeAdjustments: 0,
    writeOffValue: 0,
    awaitingOwnerReview: 0
  });
  const [stockAdjustmentFilters, setStockAdjustmentFilters] = useState<StockAdjustmentFilterState>({
    status: 'ALL',
    reason: 'ALL',
    riskLevel: 'ALL'
  });
  const [stockAdjustmentFormOpen, setStockAdjustmentFormOpen] = useState(false);
  const [activeStockAdjustment, setActiveStockAdjustment] = useState<StockAdjustment | null>(null);
  const [stockAdjustmentNotice, setStockAdjustmentNotice] = useState<string | null>(null);
  const [openStockAdjustmentMenuId, setOpenStockAdjustmentMenuId] = useState<string | null>(null);

  const refreshStockAdjustments = async (filters = stockAdjustmentFilters) => {
    const [records, events, summary] = await Promise.all([
      getStockAdjustments(filters),
      getStockAdjustmentActivityEvents(filters),
      getStockAdjustmentSummary(filters)
    ]);
    const linePairs = await Promise.all(records.map(async (record) => [record.adjustmentId, await getStockAdjustmentLines(record.adjustmentId)] as const));
    setStockAdjustmentRecords(records);
    setStockAdjustmentEvents(events);
    setStockAdjustmentSummary(summary);
    setStockAdjustmentLineMap(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshStockAdjustments();
  }, []);

  // 3. Supplier Returns State & Form Binding
  const [supplierReturns, setSupplierReturns] = useState<LegacySupplierReturnRecord[]>(() => {
    const cached = localStorage.getItem(supplierReturnsKey);
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    localStorage.setItem(supplierReturnsKey, JSON.stringify(supplierReturns));
  }, [supplierReturns, supplierReturnsKey]);

  const [retSupplier, setRetSupplier] = useState('');
  const [retGrn, setRetGrn] = useState('');
  const [retSku, setRetSku] = useState('');
  const [retQty, setRetQty] = useState('1');
  const [retReason, setRetReason] = useState('Wrong item supplied');
  const [retCondition, setRetCondition] = useState('Resellable');
  const [retFeedback, setRetFeedback] = useState<string | null>(null);

  // 4. Stock Adjustments State & Form Binding
  const [adjSku, setAdjSku] = useState('');
  const [adjType, setAdjType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjCountQty, setAdjCountQty] = useState('');
  const [adjReasonCode, setAdjReasonCode] = useState('Stocktake variance');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjFeedback, setAdjFeedback] = useState<{ type: 'success' | 'error' | 'warning', msg: string } | null>(null);

  // 5. Stocktake State Layout
  const [stocktakeLines, setStocktakeLines] = useState<StocktakeLine[]>(() => localStock.slice(0, 12).map((item) => ({
    lineId: item.id,
    stocktakeId: item.id,
    productId: item.id,
    sku: item.sku || item.code,
    numericNo: item.productNumericNumber,
    alu: item.alu,
    productName: item.productName || item.name,
    industrialSector: item.industrialSector,
    category: item.productCategory || item.category,
    brand: item.brand,
    shelfLocation: item.shelfLocation,
    systemQty: item.qtyOnHand ?? item.stock,
    countedQty: item.qtyOnHand ?? item.stock,
    varianceQty: 0,
    unitCost: 0,
    valueImpact: 0,
    varianceRisk: 'None',
    lineStatus: 'No Variance',
    countNotes: '',
    recountNotes: '',
    status: 'Pending',
    stocktakeType: 'Spot',
    countedBy: staffName
  })));
  const [stocktakeActive, setStocktakeActive] = useState(false);
  const [stocktakeFeedback, setStocktakeFeedback] = useState<string | null>(null);
  const [stocktakeSessionType, setStocktakeSessionType] = useState<'Full' | 'Spot' | 'Audit'>('Spot');
  const [stocktakeBranchFilter, setStocktakeBranchFilter] = useState('ALL');
  const [stocktakeWarehouseFilter, setStocktakeWarehouseFilter] = useState('ALL');
  const [stocktakeCategoryFilter, setStocktakeCategoryFilter] = useState('ALL');
  const [stocktakeShelfFilter, setStocktakeShelfFilter] = useState('ALL');

  // Sync Stocktake lines Counted qty from original localStock quantities
  useEffect(() => {
    if (!stocktakeActive) {
      setStocktakeLines(localStock.map(item => ({
        lineId: item.id,
        stocktakeId: item.id,
        productId: item.id,
        sku: item.sku || item.code,
        numericNo: item.productNumericNumber,
        alu: item.alu,
        productName: item.productName || item.name,
        industrialSector: item.industrialSector,
        category: item.productCategory || item.category,
        brand: item.brand,
        shelfLocation: item.shelfLocation,
        systemQty: item.qtyOnHand ?? item.stock,
        countedQty: item.qtyOnHand ?? item.stock,
        varianceQty: 0,
        unitCost: 0,
        valueImpact: 0,
        varianceRisk: 'None',
        lineStatus: 'No Variance',
        countNotes: '',
        recountNotes: '',
        status: 'Pending',
        stocktakeType: stocktakeSessionType,
        countedBy: staffName
      })));
    }
  }, [localStock, stocktakeActive, stocktakeSessionType, staffName]);

  const stocktakeBranchOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.branch).filter(Boolean)))], [localStock]);
  const stocktakeWarehouseOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.warehouse).filter(Boolean)))], [localStock]);
  const stocktakeCategoryOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.productCategory || item.category).filter(Boolean)))], [localStock]);
  const stocktakeShelfOptions = useMemo(() => ['ALL', ...Array.from(new Set(localStock.map((item) => item.shelfLocation).filter(Boolean)))], [localStock]);
  const stocktakeBranchDeskOptions = useMemo(() => Array.from(new Set(localStock.map((item) => item.branch || item.branchId || activeBranch).filter(Boolean))) as string[], [activeBranch, localStock]);
  const stocktakeWarehouseDeskOptions = useMemo(() => Array.from(new Set(localStock.map((item) => item.warehouse || item.warehouseId || 'Main Warehouse').filter(Boolean))) as string[], [localStock]);

  const [stocktakeDeskSessions, setStocktakeDeskSessions] = useState<StocktakeSession[]>([]);
  const [stocktakeDeskLineMap, setStocktakeDeskLineMap] = useState<Record<string, StocktakeLine[]>>({});
  const [stocktakeDeskSummary, setStocktakeDeskSummary] = useState<StocktakeSessionSummary>({
    openSessions: 0,
    counting: 0,
    submitted: 0,
    pendingApproval: 0,
    recountRequired: 0,
    postedToday: 0,
    positiveVariance: 0,
    negativeVariance: 0,
    highRiskVariance: 0,
    estimatedValueImpact: 0
  });
  const [stocktakeDeskFilters, setStocktakeDeskFilters] = useState<StocktakeFilterState>({
    scope: 'ALL',
    countMode: 'ALL',
    status: 'ALL',
    varianceRisk: 'ALL'
  });
  const [stocktakeDeskEvents, setStocktakeDeskEvents] = useState<StocktakeActivityEvent[]>([]);
  const [stocktakeDeskNotice, setStocktakeDeskNotice] = useState<string | null>(null);
  const [selectedStocktake, setSelectedStocktake] = useState<StocktakeSession | null>(null);
  const [selectedStocktakeLines, setSelectedStocktakeLines] = useState<StocktakeLine[]>([]);
  const [selectedStocktakeSummary, setSelectedStocktakeSummary] = useState<StocktakeVarianceSummary | null>(null);
  const [stocktakeFormOpen, setStocktakeFormOpen] = useState(false);
  const [stockTransferRecords, setStockTransferRecords] = useState<StockTransfer[]>([]);
  const [stockTransferLineMap, setStockTransferLineMap] = useState<Record<string, StockTransferLine[]>>({});
  const [stockTransferSummary, setStockTransferSummary] = useState<StockTransferSummary>({
    draftTransfers: 0,
    pendingApproval: 0,
    approved: 0,
    inTransit: 0,
    partiallyReceived: 0,
    varianceReview: 0,
    fullyReceived: 0,
    closedOutstanding: 0,
    transferQty: 0,
    transferValue: 0
  });
  const [stockTransferFilters, setStockTransferFilters] = useState<StockTransferFilterState>({ transferType: 'ALL', status: 'ALL', varianceType: 'ALL' });
  const [stockTransferEvents, setStockTransferEvents] = useState<StockTransferActivityEvent[]>([]);
  const [stockTransferNotice, setStockTransferNotice] = useState<string | null>(null);
  const [selectedStockTransfer, setSelectedStockTransfer] = useState<StockTransfer | null>(null);
  const [selectedStockTransferLines, setSelectedStockTransferLines] = useState<StockTransferLine[]>([]);
  const [stockTransferFormOpen, setStockTransferFormOpen] = useState(false);
  const [openStockTransferMenuId, setOpenStockTransferMenuId] = useState<string | null>(null);
  const [openStocktakeMenuId, setOpenStocktakeMenuId] = useState<string | null>(null);

  const refreshStocktakeDesk = async (filters = stocktakeDeskFilters) => {
    const [sessions, summary, events] = await Promise.all([
      getStocktakeSessions(filters),
      getStocktakeSessionSummary(filters),
      getStocktakeActivityEvents(filters)
    ]);
    const linePairs = await Promise.all(sessions.map(async (session) => [session.stocktakeId, await getStocktakeLines(session.stocktakeId)] as const));
    setStocktakeDeskSessions(sessions);
    setStocktakeDeskSummary(summary);
    setStocktakeDeskEvents(events);
    setStocktakeDeskLineMap(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshStocktakeDesk();
  }, []);

  const refreshStockTransfers = async (filters = stockTransferFilters) => {
    const [records, summary, events] = await Promise.all([
      getStockTransfers(filters),
      getStockTransferSummary(filters),
      getStockTransferActivityEvents(filters)
    ]);
    const linePairs = await Promise.all(records.map(async (record) => [record.transferId, await getStockTransferLines(record.transferId)] as const));
    setStockTransferRecords(records);
    setStockTransferSummary(summary);
    setStockTransferEvents(events);
    setStockTransferLineMap(Object.fromEntries(linePairs));
  };

  useEffect(() => {
    refreshStockTransfers();
  }, []);

  const loadStockTransferForm = async (transferId: string) => {
    const [record, transferLines] = await Promise.all([
      getStockTransferById(transferId),
      getStockTransferLines(transferId)
    ]);
    setSelectedStockTransfer(record);
    setSelectedStockTransferLines(transferLines);
    setStockTransferFormOpen(true);
  };

  const reloadSelectedStockTransfer = async (transferId = selectedStockTransfer?.transferId) => {
    if (!transferId) return;
    await loadStockTransferForm(transferId);
    await refreshStockTransfers();
  };

  const enforceStockTransferPermission = (permission: Parameters<typeof canPerformAction>[1]) => {
    if (canPerformAction(simulatedRole, permission)) return true;
    setStockTransferNotice('You do not have permission to perform this action.');
    return false;
  };

  const openNewStockTransferForm = () => {
    if (!enforceStockTransferPermission('stockTransfers.create')) return;
    setSelectedStockTransfer(null);
    setSelectedStockTransferLines([]);
    setStockTransferFormOpen(true);
  };

  const applyTransferMovementsToLocalStock = (movements: { productId: string; qtyIn: number; qtyOut: number }[]) => {
    if (movements.length === 0) return;
    const nextStock = localStock.map((product) => {
      const delta = movements
        .filter((movement) => movement.productId === product.id)
        .reduce((sum, movement) => sum + movement.qtyIn - movement.qtyOut, 0);
      if (delta === 0) return product;
      const currentQty = product.qtyOnHand ?? product.stock;
      const nextQty = Math.max(currentQty + delta, 0);
      onUpdateStock(product.id, Math.max(product.stock + delta, 0));
      return {
        ...product,
        stock: Math.max(product.stock + delta, 0),
        qtyOnHand: nextQty,
        lastMovementDate: new Date().toISOString().slice(0, 10)
      };
    });
    setLocalStock(nextStock);
    saveLocalStockState(nextStock);
  };

  const handleCreateStockTransferDraft = async (payload: Parameters<typeof createStockTransferDraft>[0]) => {
    if (!enforceStockTransferPermission('stockTransfers.create')) return;
    const record = await createStockTransferDraft(payload);
    setStockTransferNotice(`${record.transferNumber} draft saved. Draft transfer does not update stock.`);
    await reloadSelectedStockTransfer(record.transferId);
  };

  const handleUpdateStockTransferDraft = async (patch: Partial<StockTransfer>) => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.edit')) return;
    await updateStockTransferDraft(selectedStockTransfer.transferId, patch);
    setStockTransferNotice(`${selectedStockTransfer.transferNumber} draft updated. Stock not changed.`);
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleAddStockTransferLine = async (productId: string, qtyRequested: number) => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.edit')) return;
    const product = localStock.find((item) => item.id === productId);
    if (!product) return;
    const line = await addStockTransferLine(selectedStockTransfer.transferId, {
      productId,
      sku: product.sku || product.code,
      productName: product.productName || product.name,
      brand: product.brand || 'N/A',
      category: product.productCategory || product.category,
      sourceShelfLocation: product.shelfLocation || 'N/A',
      destinationShelfLocation: 'Destination Shelf',
      qtyRequested,
      qtyApproved: qtyRequested,
      qtyDispatched: 0,
      qtyReceived: 0,
      qtyAccepted: 0,
      qtyRejected: 0,
      unitCost: product.cost || 0,
      notes: 'Transfer line added.'
    });
    setStockTransferNotice(line ? `${line.sku} added to transfer. Stock not changed.` : 'Line could not be added.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleUpdateStockTransferLine = async (lineId: string, patch: Partial<StockTransferLine>) => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.edit')) return;
    await updateStockTransferLine(selectedStockTransfer.transferId, lineId, patch);
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleRemoveStockTransferLine = async (lineId: string) => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.edit')) return;
    await removeStockTransferLine(selectedStockTransfer.transferId, lineId);
    setStockTransferNotice('Line removed from draft transfer. Stock not changed.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleSubmitStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.edit')) return;
    const updated = await submitStockTransferForApproval(selectedStockTransfer.transferId);
    setStockTransferNotice(updated ? `${updated.transferNumber} submitted. Stock not changed.` : 'Transfer could not be submitted.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleApproveStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.approve')) return;
    const updated = await approveStockTransfer(selectedStockTransfer.transferId, staffName, 'Approved from Stock Transfers tab.');
    setStockTransferNotice(updated ? `${updated.transferNumber} approved. Approval does not move stock.` : 'Transfer could not be approved.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleRejectStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.approve')) return;
    const notes = window.prompt('Reject transfer reason') || '';
    if (!notes.trim()) return;
    const updated = await rejectStockTransfer(selectedStockTransfer.transferId, staffName, notes);
    setStockTransferNotice(updated ? `${updated.transferNumber} rejected. Stock not changed.` : 'Transfer could not be rejected.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleDispatchStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.dispatch')) return;
    const result = await dispatchStockTransfer(selectedStockTransfer.transferId, staffName, { notes: 'Dispatched from Stock Transfers tab.' });
    applyTransferMovementsToLocalStock(result.movements);
    setStockTransferNotice(result.message);
    triggerNewActivityEvent('STOCK_TRANSFERRED', `${selectedStockTransfer.transferNumber} dispatched. Source movement posted only.`, 'Medium');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleReceiveStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.receive')) return;
    const updated = await receiveStockTransfer(selectedStockTransfer.transferId, staffName, { notes: 'Receive draft captured from Stock Transfers tab.' });
    setStockTransferNotice(updated ? `${updated.transferNumber} receive draft captured. Destination stock not increased until Post Receipt.` : 'Transfer could not be received.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handlePostTransferReceipt = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.postReceipt')) return;
    const result = await postTransferReceipt(selectedStockTransfer.transferId, staffName);
    applyTransferMovementsToLocalStock(result.movements);
    setStockTransferNotice(result.message);
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleCloseTransferOutstanding = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.closeOutstanding')) return;
    const reason = window.prompt('Reason for closing transfer with outstanding quantity') || '';
    if (!reason.trim()) return;
    const updated = await closeTransferWithOutstanding(selectedStockTransfer.transferId, staffName, reason);
    setStockTransferNotice(updated ? `${updated.transferNumber} closed with outstanding. Stock not changed by close action.` : 'Transfer could not be closed.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleCancelStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.cancel')) return;
    const reason = window.prompt('Cancel transfer reason') || '';
    if (!reason.trim()) return;
    const updated = await cancelStockTransfer(selectedStockTransfer.transferId, staffName, reason);
    setStockTransferNotice(updated ? `${updated.transferNumber} cancelled. Stock not changed by cancellation.` : 'Transfer could not be cancelled.');
    await reloadSelectedStockTransfer(selectedStockTransfer.transferId);
  };

  const handleExportStockTransfer = async () => {
    if (!selectedStockTransfer || !enforceStockTransferPermission('stockTransfers.export')) return;
    const result = await exportStockTransferPlaceholder(selectedStockTransfer.transferId);
    setStockTransferNotice(result.message);
  };

  const handleStockTransferTableAction = async (action: 'view' | 'submit' | 'approve' | 'reject' | 'dispatch' | 'receive' | 'postReceipt' | 'close' | 'cancel' | 'export', transfer: StockTransfer) => {
    await loadStockTransferForm(transfer.transferId);
    setSelectedStockTransfer(transfer);
    if (action === 'view') return;
    const permissionMap: Record<Exclude<typeof action, 'view'>, Parameters<typeof canPerformAction>[1]> = {
      submit: 'stockTransfers.edit',
      approve: 'stockTransfers.approve',
      reject: 'stockTransfers.approve',
      dispatch: 'stockTransfers.dispatch',
      receive: 'stockTransfers.receive',
      postReceipt: 'stockTransfers.postReceipt',
      close: 'stockTransfers.closeOutstanding',
      cancel: 'stockTransfers.cancel',
      export: 'stockTransfers.export'
    };
    if (!enforceStockTransferPermission(permissionMap[action])) return;
    if (action === 'submit') await submitStockTransferForApproval(transfer.transferId);
    if (action === 'approve') await approveStockTransfer(transfer.transferId, staffName, 'Approved from table action.');
    if (action === 'reject') await rejectStockTransfer(transfer.transferId, staffName, 'Rejected from table action.');
    if (action === 'dispatch') {
      const result = await dispatchStockTransfer(transfer.transferId, staffName, { notes: 'Dispatched from table action.' });
      applyTransferMovementsToLocalStock(result.movements);
      setStockTransferNotice(result.message);
    }
    if (action === 'receive') await receiveStockTransfer(transfer.transferId, staffName, { notes: 'Receive draft captured from table action.' });
    if (action === 'postReceipt') {
      const result = await postTransferReceipt(transfer.transferId, staffName);
      applyTransferMovementsToLocalStock(result.movements);
      setStockTransferNotice(result.message);
    }
    if (action === 'close') {
      const reason = window.prompt('Reason for closing with outstanding') || '';
      if (reason.trim()) await closeTransferWithOutstanding(transfer.transferId, staffName, reason);
    }
    if (action === 'cancel') {
      const reason = window.prompt('Cancel transfer reason') || '';
      if (reason.trim()) await cancelStockTransfer(transfer.transferId, staffName, reason);
    }
    if (action === 'export') {
      const result = await exportStockTransferPlaceholder(transfer.transferId);
      setStockTransferNotice(result.message);
    }
    await reloadSelectedStockTransfer(transfer.transferId);
  };

  const loadStocktakeForm = async (stocktakeId: string) => {
    const [record, lines, varianceSummary] = await Promise.all([
      getStocktakeSessionById(stocktakeId),
      getStocktakeLines(stocktakeId),
      calculateStocktakeVarianceSummary(stocktakeId)
    ]);
    setSelectedStocktake(record);
    setSelectedStocktakeLines(lines);
    setSelectedStocktakeSummary(varianceSummary);
    setStocktakeFormOpen(true);
  };

  const reloadSelectedStocktake = async (stocktakeId = selectedStocktake?.stocktakeId) => {
    if (!stocktakeId) return;
    await loadStocktakeForm(stocktakeId);
    await refreshStocktakeDesk();
  };

  const enforceStocktakePermission = (permission: Parameters<typeof canPerformAction>[1]) => {
    if (canPerformAction(simulatedRole, permission)) return true;
    setStocktakeDeskNotice('You do not have permission to perform this action.');
    return false;
  };

  const openNewStocktakeForm = () => {
    if (!enforceStocktakePermission('stocktake.create')) return;
    setSelectedStocktake(null);
    setSelectedStocktakeLines([]);
    setSelectedStocktakeSummary(null);
    setStocktakeFormOpen(true);
  };

  const handleCreateStocktakeDraft = async (payload: {
    branchId: string;
    warehouseId: string;
    scope: StocktakeScope;
    countMode: StocktakeCountMode;
    notes: string;
    categoryFilter?: string;
    supplierFilter?: string;
    shelfLocationFilter?: string;
    selectedProductIds?: string[];
  }) => {
    if (!enforceStocktakePermission('stocktake.create')) return;
    const record = await createStocktakeSession({
      vendorId,
      requestedByStaffId: staffName,
      requestedByStaffName: staffName,
      ...payload
    });
    setStocktakeDeskNotice(`${record.stocktakeNumber} draft saved. Draft stocktake does not update stock.`);
    await reloadSelectedStocktake(record.stocktakeId);
  };

  const handleUpdateStocktakeDraft = async (patch: Partial<StocktakeSession>) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.create')) return;
    await updateStocktakeSessionDraft(selectedStocktake.stocktakeId, patch);
    await generateStocktakeLinesFromScope(selectedStocktake.stocktakeId, patch.scope || selectedStocktake.scope);
    setStocktakeDeskNotice(`${selectedStocktake.stocktakeNumber} saved. Stock remains unchanged.`);
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleStartCountingStocktake = async () => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await updateStocktakeSessionDraft(selectedStocktake.stocktakeId, {
      status: 'Counting',
      countedByStaffId: staffName,
      countedByStaffName: staffName
    });
    setStocktakeDeskNotice(`${selectedStocktake.stocktakeNumber} counting started. Counting does not update stock.`);
    triggerNewActivityEvent('STOCKTAKE_STARTED', `${selectedStocktake.stocktakeNumber} counting started.`, 'Low');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleStocktakeLineCount = async (lineId: string, countedQty: number | null, notes: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await updateStocktakeLineCount(selectedStocktake.stocktakeId, lineId, countedQty, notes);
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleExcludeStocktakeLine = async (lineId: string, reason: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await excludeStocktakeLine(selectedStocktake.stocktakeId, lineId, staffName, reason);
    setStocktakeDeskNotice('Line excluded locally. Excluded lines are not posted.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleRestoreStocktakeLine = async (lineId: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await restoreStocktakeLine(selectedStocktake.stocktakeId, lineId, staffName);
    setStocktakeDeskNotice('Line restored. Variance recalculated without stock posting.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleCompleteStocktakeRecount = async (lineIds: string[], notes: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await completeStocktakeRecount(selectedStocktake.stocktakeId, lineIds, staffName, notes);
    setStocktakeDeskNotice('Recount completed. Stock remains unchanged.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleBulkStocktakeCounts = async (mode: 'same-as-system' | 'clear') => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    const eligible = selectedStocktakeLines.filter((line) => line.lineStatus !== 'Excluded');
    const updates = mode === 'same-as-system'
      ? eligible.filter((line) => line.countedQty === null).map((line) => ({ lineId: line.lineId, countedQty: line.systemQty, notes: 'Bulk marked same as system.' }))
      : eligible.map((line) => ({ lineId: line.lineId, countedQty: null, notes: 'Bulk count cleared.' }));
    await bulkUpdateStocktakeCounts(selectedStocktake.stocktakeId, updates);
    setStocktakeDeskNotice(mode === 'same-as-system' ? 'Uncounted lines marked same as system. Stock not changed.' : 'All counts cleared. Stock not changed.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleSubmitStocktake = async () => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.submit')) return;
    if (selectedStocktakeLines.length === 0) {
      setStocktakeDeskNotice('Submit blocked: no stocktake lines exist.');
      return;
    }
    if (selectedStocktakeLines.every((line) => line.countedQty === null || line.lineStatus === 'Excluded')) {
      setStocktakeDeskNotice('Submit blocked: no lines have been counted.');
      return;
    }
    if (selectedStocktakeLines.some((line) => line.lineStatus === 'Recount Required')) {
      setStocktakeDeskNotice('Submit blocked: recount required lines must be completed before submit.');
      return;
    }
    const notCounted = selectedStocktakeLines.filter((line) => line.countedQty === null && line.lineStatus !== 'Excluded').length;
    if (notCounted > 0 && !window.confirm(`${notCounted} line(s) are not counted. Submit anyway?`)) {
      setStocktakeDeskNotice('Submit cancelled because not counted lines remain.');
      return;
    }
    const updated = await submitStocktake(selectedStocktake.stocktakeId, staffName);
    setStocktakeDeskNotice(updated ? `${updated.stocktakeNumber} submitted. Submitted stocktake does not update stock.` : 'Stocktake submit blocked by validation.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleRequestStocktakeRecount = async (lineIds: string[], notes: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.count')) return;
    await requestRecount(selectedStocktake.stocktakeId, lineIds, staffName, notes);
    setStocktakeDeskNotice(`${selectedStocktake.stocktakeNumber} recount requested. Stock remains unchanged.`);
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleApproveStocktake = async () => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.approve')) return;
    const updated = await approveStocktake(selectedStocktake.stocktakeId, staffName, 'Approved from Stocktake Desk.');
    setStocktakeDeskNotice(updated ? `${updated.stocktakeNumber} approved. Approval does not update stock until posting.` : 'Stocktake could not be approved.');
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const applyPostedStocktakeResult = (result: StocktakePostingResult) => {
    if (result.movements.length === 0) return;
    const nextStock = localStock.map((product) => {
      const productMovements = result.movements.filter((movement) => movement.productId === product.id);
      if (productMovements.length === 0) return product;
      const latest = productMovements.at(-1);
      const nextQty = latest?.balanceAfter ?? product.stock;
      return {
        ...product,
        stock: nextQty,
        qtyOnHand: nextQty,
        lastMovementDate: new Date().toISOString().slice(0, 10)
      };
    });
    setLocalStock(nextStock);
    saveLocalStockState(nextStock);
  };

  const handlePostStocktake = async () => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.post')) return;
    const result = await postStocktakeVariance(selectedStocktake.stocktakeId, staffName, {
      allowOwnerOverride: simulatedRole === 'Owner' || simulatedRole === 'SysAdmin',
      hasPostPermission: canPerformAction(simulatedRole, 'stocktake.post')
    });
    if (!result) {
      setStocktakeDeskNotice('Stocktake could not be posted.');
      return;
    }
    if (result.stockPosted) {
      applyPostedStocktakeResult(result);
      setStocktakeDeskNotice(result.message);
      triggerNewActivityEvent('STOCKTAKE_SUBMITTED', `${result.stocktakeNumber} variance posted.`, 'High');
    } else {
      setStocktakeDeskNotice(result.message);
    }
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleCancelStocktake = async (reason: string) => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.cancel')) return;
    if (!reason.trim()) {
      setStocktakeDeskNotice('Cancel requires reason.');
      return;
    }
    await cancelStocktake(selectedStocktake.stocktakeId, staffName, reason);
    setStocktakeDeskNotice(`${selectedStocktake.stocktakeNumber} cancelled. Stock not changed.`);
    await reloadSelectedStocktake(selectedStocktake.stocktakeId);
  };

  const handleExportStocktake = async () => {
    if (!selectedStocktake || !enforceStocktakePermission('stocktake.export')) return;
    const result = await exportStocktakePlaceholder(selectedStocktake.stocktakeId);
    setStocktakeDeskNotice(result.message);
  };

  const handleStocktakeTableAction = async (action: 'view' | 'start' | 'submit' | 'recount' | 'approve' | 'post' | 'cancel' | 'export', session: StocktakeSession) => {
    await loadStocktakeForm(session.stocktakeId);
    if (action === 'view') return;
    const actionPermission: Record<typeof action, Parameters<typeof canPerformAction>[1]> = {
      start: 'stocktake.count',
      submit: 'stocktake.submit',
      recount: 'stocktake.count',
      approve: 'stocktake.approve',
      post: 'stocktake.post',
      cancel: 'stocktake.cancel',
      export: 'stocktake.export'
    };
    if (!enforceStocktakePermission(actionPermission[action])) return;
    setSelectedStocktake(session);
    if (action === 'start') await updateStocktakeSessionDraft(session.stocktakeId, { status: 'Counting', countedByStaffId: staffName, countedByStaffName: staffName });
    if (action === 'submit') await submitStocktake(session.stocktakeId, staffName);
    if (action === 'recount') await requestRecount(session.stocktakeId, (stocktakeDeskLineMap[session.stocktakeId] || []).filter((line) => line.varianceQty !== 0).map((line) => line.lineId), staffName, 'Recount requested from table action.');
    if (action === 'approve') await approveStocktake(session.stocktakeId, staffName, 'Approved from table action.');
    if (action === 'post') {
      const result = await postStocktakeVariance(session.stocktakeId, staffName, {
        allowOwnerOverride: simulatedRole === 'Owner' || simulatedRole === 'SysAdmin',
        hasPostPermission: canPerformAction(simulatedRole, 'stocktake.post')
      });
      if (result?.stockPosted) applyPostedStocktakeResult(result);
      setStocktakeDeskNotice(result?.message || 'Stocktake could not be posted.');
    }
    if (action === 'cancel') {
      const reason = window.prompt('Cancel reason') || '';
      if (reason.trim()) await cancelStocktake(session.stocktakeId, staffName, reason);
    }
    if (action === 'export') {
      const result = await exportStocktakePlaceholder(session.stocktakeId);
      setStocktakeDeskNotice(result.message);
    }
    await reloadSelectedStocktake(session.stocktakeId);
  };

  const stocktakeOperationalWarnings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const warnings: string[] = [];
    const counting = stocktakeDeskSessions.filter((session) => session.status === 'Counting' || session.status === 'Draft').length;
    const submittedNotApproved = stocktakeDeskSessions.filter((session) => session.status === 'Submitted' || session.status === 'Pending Approval').length;
    const approvedNotPosted = stocktakeDeskSessions.filter((session) => session.status === 'Approved').length;
    const postedToday = stocktakeDeskSessions.filter((session) => session.status === 'Posted' && session.postedAt?.slice(0, 10) === today).length;
    const recountRequired = stocktakeDeskSessions.filter((session) => (stocktakeDeskLineMap[session.stocktakeId] || []).some((line) => line.lineStatus === 'Recount Required')).length;
    const highRiskPending = stocktakeDeskSessions.filter((session) => session.status !== 'Posted' && (stocktakeDeskLineMap[session.stocktakeId] || []).some((line) => line.varianceRisk === 'High' || line.varianceRisk === 'Critical')).length;
    const lossAboveThreshold = stocktakeDeskSessions.filter((session) => (stocktakeDeskLineMap[session.stocktakeId] || []).some((line) => line.valueImpact <= -300 && line.lineStatus !== 'Posted')).length;
    if (counting) warnings.push(`${counting} stocktake session(s) still counting or draft.`);
    if (submittedNotApproved) warnings.push(`${submittedNotApproved} stocktake session(s) submitted but not approved.`);
    if (approvedNotPosted) warnings.push(`${approvedNotPosted} stocktake session(s) approved but not posted.`);
    if (highRiskPending) warnings.push(`${highRiskPending} high-risk stocktake variance(s) pending approval or posting.`);
    if (recountRequired) warnings.push(`${recountRequired} stocktake session(s) have recount required lines.`);
    if (postedToday) warnings.push(`${postedToday} stocktake session(s) posted today and pending management review.`);
    if (lossAboveThreshold) warnings.push(`${lossAboveThreshold} stocktake loss warning(s) above USD 300 threshold.`);
    return warnings;
  }, [stocktakeDeskLineMap, stocktakeDeskSessions]);

  const stockTransferOperationalWarnings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const warnings: string[] = [];
    const pendingApproval = stockTransferRecords.filter((transfer) => transfer.status === 'Pending Approval').length;
    const dispatchedNotReceived = stockTransferRecords.filter((transfer) => transfer.status === 'Dispatched' || transfer.status === 'In Transit' || transfer.status === 'Partially Dispatched').length;
    const overdueTransit = stockTransferRecords.filter((transfer) => ['Dispatched', 'In Transit', 'Partially Dispatched'].includes(transfer.status) && transfer.expectedArrivalDate < today).length;
    const varianceUnresolved = stockTransferRecords.filter((transfer) => transfer.status === 'Variance Review' || (stockTransferLineMap[transfer.transferId] || []).some((line) => line.varianceType !== 'None' && line.qtyOutstanding > 0)).length;
    const closedOutstandingToday = stockTransferRecords.filter((transfer) => transfer.status === 'Closed With Outstanding' && transfer.updatedAt.slice(0, 10) === today).length;
    const postedReceiptReview = stockTransferRecords.filter((transfer) => (stockTransferLineMap[transfer.transferId] || []).some((line) => line.receiptPosted && line.varianceType !== 'None')).length;
    if (pendingApproval) warnings.push(`${pendingApproval} transfer(s) pending approval.`);
    if (dispatchedNotReceived) warnings.push(`${dispatchedNotReceived} transfer(s) dispatched but not fully received.`);
    if (overdueTransit) warnings.push(`${overdueTransit} transfer(s) in transit overdue.`);
    if (varianceUnresolved) warnings.push(`${varianceUnresolved} transfer variance warning(s) unresolved.`);
    if (closedOutstandingToday) warnings.push(`${closedOutstandingToday} transfer(s) closed with outstanding today.`);
    if (postedReceiptReview) warnings.push(`${postedReceiptReview} transfer receipt(s) posted with variance review.`);
    return warnings;
  }, [stockTransferLineMap, stockTransferRecords]);

  const filteredStocktakeLines = useMemo(() => {
    return stocktakeLines.filter((line) => {
      const product = localStock.find((item) => (item.sku || item.code) === line.sku);
      const matchesBranch = stocktakeBranchFilter === 'ALL' || product?.branch === stocktakeBranchFilter;
      const matchesWarehouse = stocktakeWarehouseFilter === 'ALL' || product?.warehouse === stocktakeWarehouseFilter;
      const matchesCategory = stocktakeCategoryFilter === 'ALL' || line.category === stocktakeCategoryFilter;
      const matchesShelf = stocktakeShelfFilter === 'ALL' || line.shelfLocation === stocktakeShelfFilter;
      const matchesPreselect =
        !stocktakePreselect?.productIds?.length ||
        (line.productId ? stocktakePreselect.productIds.includes(line.productId) : false);
      return matchesBranch && matchesWarehouse && matchesCategory && matchesShelf && matchesPreselect;
    });
  }, [localStock, stocktakeBranchFilter, stocktakeCategoryFilter, stocktakeLines, stocktakePreselect, stocktakeShelfFilter, stocktakeWarehouseFilter]);

  useEffect(() => {
    if (!stocktakePreselect || stocktakePreselectToken === 0) return;

    if (stocktakePreselect.shelfLocation) {
      setStocktakeShelfFilter(stocktakePreselect.shelfLocation);
    }

    if (stocktakePreselect.productIds?.length) {
      const preselectedLines: StocktakeLine[] = localStock
        .filter((item) => stocktakePreselect.productIds?.includes(item.id))
        .map((item): StocktakeLine => ({
          lineId: item.id,
          stocktakeId: item.id,
          productId: item.id,
          sku: item.sku || item.code,
          numericNo: item.productNumericNumber,
          alu: item.alu,
          productName: item.productName || item.name,
          industrialSector: item.industrialSector,
          category: item.productCategory || item.category,
          brand: item.brand,
          shelfLocation: item.shelfLocation,
          systemQty: item.qtyOnHand ?? item.stock,
          countedQty: item.qtyOnHand ?? item.stock,
          varianceQty: 0,
          unitCost: 0,
          valueImpact: 0,
          varianceRisk: 'None',
          lineStatus: 'No Variance',
          countNotes: '',
          recountNotes: '',
          status: 'Pending',
          stocktakeType: 'Spot',
          countedBy: staffName
        }));

      if (preselectedLines.length > 0) {
        setStocktakeLines(preselectedLines);
        setStocktakeActive(true);
        setStocktakeSessionType('Spot');
        setStocktakeFeedback(
          stocktakePreselect.shelfLocation
            ? `Stocktake preselected for shelf ${stocktakePreselect.shelfLocation}.`
            : 'Stocktake preselected from Product List filters.'
        );
      }
    }
  }, [localStock, staffName, stocktakePreselect, stocktakePreselectToken]);

  // Helper to log BI Events globally in localStorage to reflect on PosBIDesk.tsx
  const logGlobalBiEvent = (eventType: string, payload: any, severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL') => {
    try {
      const cached = localStorage.getItem(getVendorScopedStorageKey('itred_pos_bi_events', vendorId));
      const events = cached ? JSON.parse(cached) : [];
      const newEvent = {
        id: 'BI-EV-' + Math.floor(Math.random() * 89999 + 10000),
        timestamp: new Date().toISOString(),
        eventType,
        operator: staffName,
        terminal: 'TERMINAL_STOCK_DESK',
        payload,
        severity
      };
      localStorage.setItem(getVendorScopedStorageKey('itred_pos_bi_events', vendorId), JSON.stringify([newEvent, ...events]));
    } catch (e) {
      console.warn("Failed to append global BI event:", e);
    }
  };

  const baseMovementPayload = (product: StockProduct, referenceNumber: string, notes: string) => ({
    vendorId: product.vendorId || vendorId,
    branchId: product.branchId || product.branch || activeBranch,
    warehouseId: product.warehouseId || product.warehouse || activeWarehouseId,
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

  const postLegacyLedgerMovement = (
    product: StockProduct,
    referenceType: string,
    referenceId: string,
    movementType: string,
    qtyIn: number,
    qtyOut: number,
    notes: string,
    status: 'Posted' | 'Pending Approval' = 'Posted'
  ) => {
    if (status !== 'Posted') return;
    const base = baseMovementPayload(product, referenceId, notes);
    void postLedgerMovement({
      movementId: `${base.vendorId}_${referenceType}_${referenceId}_${product.id}_${movementType}`.replace(/[^A-Za-z0-9_-]/g, '_'),
      vendorId: base.vendorId,
      branchId: base.branchId,
      warehouseId: base.warehouseId,
      productId: base.productId,
      sku: base.sku,
      productName: base.productName,
      shelfLocation: base.shelfLocation,
      movementType: movementType === 'GOODS_RECEIVED'
        ? 'GOODS_RECEIVED'
        : movementType === 'SUPPLIER_RETURN'
          ? 'PURCHASE_RETURN'
          : movementType.includes('STOCKTAKE')
            ? 'STOCKTAKE_ADJUSTMENT'
            : 'MANUAL_CORRECTION',
      quantityIn: qtyIn,
      quantityOut: qtyOut,
      unitCost: Number(base.unitCost) || 0,
      sellingPrice: Number(base.sellingPrice) || 0,
      referenceType,
      referenceId,
      staffId: staffName,
      staffName,
      terminalId: 'TERMINAL_STOCK_DESK',
      reason: notes,
      notes
    }).catch((error) => {
      console.error('Inventory movement synchronization failed', error);
    });
  };


  // =========================================================================
  // SUB-PAGES ACTIONS
  // =========================================================================

  const openPurchaseOrderForm = async (po?: PurchaseOrder) => {
    setPoFormOrder(po || null);
    setPoFormLines(po ? await getPurchaseOrderLines(po.poId) : []);
    setPoFormOpen(true);
  };

  const handleViewPurchaseOrder = async (po: PurchaseOrder) => {
    setSelectedPO(po);
    setSelectedPOLines(await getPurchaseOrderLines(po.poId));
  };

  // A. RECEIVE PO DISPATCHER: prepares a GRN draft from a PO and switches tab.
  // Stock quantity changes only happen later if the Goods Receiving form is posted.
  const handleQuickReceivePO = async (po: PurchaseOrder) => {
    await handleCreateGRNFromPO(po);
    setActiveTab('Goods Receiving');
  };

  const handlePOStatusAction = async (po: PurchaseOrder, action: 'submit' | 'approve' | 'sent' | 'cancel' | 'close' | 'export' | 'edit' | 'revoke') => {
    try {
    if (action === 'edit') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.edit')) {
        setPoFeedback('You do not have permission to edit Purchase Orders.');
        return;
      }
      await openPurchaseOrderForm(po);
      if (['Fully Received', 'Closed', 'Closed With Outstanding', 'Cancelled'].includes(po.status)) {
        setPoFeedback(`${po.poNumber} is locked and cannot be edited.`);
      } else {
        setPoFeedback(`${po.poNumber} opened for controlled edit.`);
      }
      return;
    }
    if (action === 'submit') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.edit') && !canPerformAction(simulatedRole, 'purchaseOrders.create')) {
        setPoFeedback('You do not have permission to perform this action.');
        return;
      }
      await submitPurchaseOrderForApproval(po.poId);
      setPoFeedback(`${po.poNumber} submitted for approval.`);
    }
    if (action === 'approve') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.approve') && !canPerformAction(simulatedRole, 'approvals.approve')) {
        setPoFeedback('You do not have permission to perform this action.');
        return;
      }
      await approvePurchaseOrder(po.poId, staffName, 'Approved from Purchase Orders tab.');
      setPoFeedback(`${po.poNumber} approved. No stock or financial posting was created.`);
    }
    if (action === 'sent') {
      await markPurchaseOrderSent(po.poId, staffName);
      setPoFeedback(`${po.poNumber} marked Sent To Supplier.`);
    }
    if (action === 'cancel') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.cancel')) {
        setPoFeedback('You do not have permission to perform this action.');
        return;
      }
      const reason = window.prompt(`Reason for cancelling ${po.poNumber}?`);
      if (!reason) return;
      await cancelPurchaseOrder(po.poId, staffName, reason);
      setPoFeedback(`${po.poNumber} cancelled.`);
    }
    if (action === 'revoke') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.cancel')) {
        setPoFeedback('You do not have permission to revoke Purchase Orders.');
        return;
      }
      if (['Fully Received', 'Closed', 'Closed With Outstanding', 'Cancelled'].includes(po.status)) {
        setPoFeedback(`${po.poNumber} cannot be revoked because it is ${po.status}.`);
        return;
      }
      const reason = window.prompt(`Reason for revoking ${po.poNumber}?`);
      if (!reason) return;
      await cancelPurchaseOrder(po.poId, staffName, `Revoked: ${reason}`);
      setPoFeedback(`${po.poNumber} revoked.`);
    }
    if (action === 'close') {
      await closePurchaseOrder(po.poId, staffName, 'Closed from Purchase Orders tab.');
      setPoFeedback(`${po.poNumber} closed.`);
    }
    if (action === 'export') {
      if (!canPerformAction(simulatedRole, 'purchaseOrders.export')) {
        setPoFeedback('You do not have permission to perform this action.');
        return;
      }
      const result = await exportPurchaseOrderPlaceholder(po.poId);
      setPoFeedback(result.message);
    }
    refreshPurchaseOrders();
    } catch (error) {
      setPoFeedback(actionErrorMessage(error));
    }
  };

  const applyPurchaseOrderFilters = async () => {
    await refreshPurchaseOrders(purchaseOrderFilters);
    setPurchaseOrderFilterDrawerOpen(false);
  };

  const clearPurchaseOrderFilters = async () => {
    const reset = { status: 'ALL' as const, priority: 'ALL' as const, source: 'ALL' as const };
    setPurchaseOrderFilters(reset);
    await refreshPurchaseOrders(reset);
    setPurchaseOrderFilterDrawerOpen(false);
  };

  const applyGoodsReceivingFilters = async () => {
    await refreshGoodsReceiving(goodsReceivingFilters);
    setGoodsReceivingFilterDrawerOpen(false);
  };

  const clearGoodsReceivingFilters = async () => {
    const reset = { status: 'ALL' as const, varianceType: 'ALL' as const };
    setGoodsReceivingFilters(reset);
    await refreshGoodsReceiving(reset);
    setGoodsReceivingFilterDrawerOpen(false);
  };

  const applySupplierReturnFilters = async () => {
    await refreshSupplierReturns(supplierReturnFilters);
    setSupplierReturnFilterDrawerOpen(false);
  };

  const clearSupplierReturnFilters = async () => {
    const reset = { status: 'ALL' as const, reason: 'ALL' as const, resolution: 'ALL' as const };
    setSupplierReturnFilters(reset);
    await refreshSupplierReturns(reset);
    setSupplierReturnFilterDrawerOpen(false);
  };

  const outstandingPOOptions = useMemo(() => {
    const supplier = outstandingPOSupplier.trim().toLowerCase();
    return purchaseOrders.filter((order) => {
      const statusMatch = ['Approved', 'Sent To Supplier', 'Partially Received'].includes(order.status);
      const supplierMatch = !supplier || order.supplierName.toLowerCase().includes(supplier);
      const outstandingQty = (purchaseOrderLines[order.poId] || []).reduce((sum, line) => sum + line.qtyOutstanding, 0);
      return statusMatch && supplierMatch && outstandingQty > 0;
    });
  }, [outstandingPOSupplier, purchaseOrderLines, purchaseOrders]);

  const supplierGRNOptions = useMemo(() => {
    const supplier = supplierGRNSupplier.trim().toLowerCase();
    return goodsReceivingNotes.filter((note) => {
      const statusMatch = note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted';
      const supplierMatch = !supplier || note.supplierName.toLowerCase().includes(supplier);
      const returnableQty = (goodsReceivingLineMap[note.grnId] || []).reduce((sum, line) => sum + Math.max(line.qtyAccepted - line.qtyAlreadyReturned, 0), 0);
      return statusMatch && supplierMatch && returnableQty > 0;
    });
  }, [goodsReceivingLineMap, goodsReceivingNotes, supplierGRNSupplier]);

  const openOutstandingPOModal = () => {
    setOutstandingPOSupplier(goodsReceivingFilters.supplier || '');
    setOutstandingPOModalOpen(true);
  };

  const openSupplierGRNModal = () => {
    setSupplierGRNSupplier(supplierReturnFilters.supplier || '');
    setSupplierGRNModalOpen(true);
  };

  const getPurchaseOrderActionItems = (po: PurchaseOrder): RowActionMenuItem[] => {
    const canReceive = ['Approved', 'Sent To Supplier', 'Partially Received'].includes(po.status);
    const terminal = ['Cancelled', 'Closed', 'Fully Received', 'Closed With Outstanding'].includes(po.status);
    return [
      { label: 'View', icon: <Eye className="w-3.5 h-3.5" />, onClick: () => void handleViewPurchaseOrder(po) },
      { label: po.status === 'Draft' ? 'Edit PO' : 'Open PO', icon: <Pencil className="w-3.5 h-3.5" />, permissionKey: 'purchaseOrders.edit', onClick: () => void handlePOStatusAction(po, 'edit') },
      po.status === 'Draft' && { label: 'Submit for Approval', icon: <Clock className="w-3.5 h-3.5" />, permissionKey: 'purchaseOrders.edit', onClick: () => void handlePOStatusAction(po, 'submit') },
      po.status === 'Pending Approval' && { label: 'Approve', icon: <CheckCircle className="w-3.5 h-3.5" />, permissionKey: 'purchaseOrders.approve', onClick: () => void handlePOStatusAction(po, 'approve') },
      po.status === 'Approved' && { label: 'Mark Sent', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => void handlePOStatusAction(po, 'sent') },
      canReceive && { label: 'Receive Goods', icon: <ShoppingBag className="w-3.5 h-3.5" />, permissionKey: 'purchaseOrders.receive', onClick: () => void handleQuickReceivePO(po) },
      !terminal && { label: 'Revoke PO', icon: <Ban className="w-3.5 h-3.5" />, danger: true, permissionKey: 'purchaseOrders.cancel', onClick: () => void handlePOStatusAction(po, 'revoke') },
      { label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, permissionKey: 'purchaseOrders.export', onClick: () => void handlePOStatusAction(po, 'export') }
    ];
  };

  const getGoodsReceivingActionItems = (note: GoodsReceivingNote): RowActionMenuItem[] => [
    { label: 'View / Edit', icon: <Eye className="w-3.5 h-3.5" />, permissionKey: 'goodsReceiving.view', onClick: () => openGoodsReceivingForm(note) },
    note.receivingStatus === 'Draft' && { label: 'Post GRN', icon: <Check className="w-3.5 h-3.5" />, permissionKey: 'goodsReceiving.post', onClick: () => void handleGoodsReceivingAction(note, 'post') },
    note.receivingStatus === 'Draft' && { label: 'Submit for Approval', icon: <Clock className="w-3.5 h-3.5" />, permissionKey: 'goodsReceiving.edit', onClick: () => void handleGoodsReceivingAction(note, 'submit') },
    note.receivingStatus === 'Pending Approval' && { label: 'Approve', icon: <CheckCircle className="w-3.5 h-3.5" />, permissionKey: 'goodsReceiving.approve', onClick: () => void handleGoodsReceivingAction(note, 'approve') },
    note.receivingStatus === 'Draft' && { label: 'Cancel', icon: <X className="w-3.5 h-3.5" />, danger: true, permissionKey: 'goodsReceiving.cancel', onClick: () => void handleGoodsReceivingAction(note, 'cancel') },
    (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') && { label: 'Reverse', icon: <RotateCcw className="w-3.5 h-3.5" />, danger: true, permissionKey: 'goodsReceiving.reverse', onClick: () => void handleGoodsReceivingAction(note, 'reverse') },
    (note.receivingStatus === 'Posted' || note.receivingStatus === 'Partially Posted') && { label: 'Create Supplier Return', icon: <ArrowRightLeft className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.create', onClick: () => void handleCreateSupplierReturnFromGRN(note) },
    { label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleGoodsReceivingAction(note, 'export') }
  ];

  const getSupplierReturnActionItems = (record: SupplierReturn): RowActionMenuItem[] => {
    const editableReturn = record.status === 'Draft';
    const terminalReturn = record.status === 'Closed' || record.status === 'Cancelled';
    return [
      { label: 'View / Edit', icon: <Eye className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.view', onClick: () => openSupplierReturnForm(record) },
      editableReturn && { label: 'Submit for Approval', icon: <Clock className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.edit', onClick: () => void handleSupplierReturnAction(record, 'submit') },
      record.status === 'Pending Approval' && { label: 'Approve', icon: <CheckCircle className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.approve', onClick: () => void handleSupplierReturnAction(record, 'approve') },
      (record.status === 'Draft' || record.status === 'Approved') && { label: 'Post Return', icon: <Check className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.post', onClick: () => void handleSupplierReturnAction(record, 'post') },
      !terminalReturn && { label: 'Dispatch To Supplier', icon: <ArrowRightLeft className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.dispatch', onClick: () => void handleSupplierReturnAction(record, 'dispatch') },
      !terminalReturn && { label: 'Record Credit Note', icon: <ClipboardList className="w-3.5 h-3.5" />, onClick: () => void handleSupplierReturnAction(record, 'credit') },
      !terminalReturn && { label: 'Record Replacement', icon: <ShoppingBag className="w-3.5 h-3.5" />, onClick: () => void handleSupplierReturnAction(record, 'replacement') },
      !terminalReturn && { label: 'Close', icon: <Archive className="w-3.5 h-3.5" />, permissionKey: 'supplierReturns.close', onClick: () => void handleSupplierReturnAction(record, 'close') },
      editableReturn && { label: 'Cancel', icon: <X className="w-3.5 h-3.5" />, danger: true, permissionKey: 'supplierReturns.cancel', onClick: () => void handleSupplierReturnAction(record, 'cancel') },
      { label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleSupplierReturnAction(record, 'export') }
    ];
  };

  const openGoodsReceivingForm = async (note: GoodsReceivingNote) => {
    setActiveGoodsReceivingNote(note);
    setGoodsReceivingFormOpen(true);
  };

  const handleCreateGRNFromPO = async (po?: PurchaseOrder) => {
    try {
    const targetPO = po || purchaseOrders.find((order) => order.status === 'Approved' || order.status === 'Sent To Supplier' || order.status === 'Partially Received');
    if (!targetPO) {
      setGoodsReceivingNotice('No approved, sent, or partially received Purchase Order is available for GRN draft creation.');
      return;
    }
    if (!canPerformAction(simulatedRole, 'goodsReceiving.create')) {
      setGoodsReceivingNotice('You do not have permission to perform this action.');
      return;
    }
    const draft = await createGRNDraftFromPO(targetPO.poId, staffName);
    if (!draft) {
      setGoodsReceivingNotice(`${targetPO.poNumber} has no outstanding lines available for a new GRN draft.`);
      return;
    }
    await refreshGoodsReceiving();
    await refreshPurchaseOrders();
    setGoodsReceivingNotice(`${draft.grnNumber} draft created from ${targetPO.poNumber}. Draft GRN has not updated stock.`);
    setActiveGoodsReceivingNote(draft);
    setGoodsReceivingFormOpen(true);
    } catch (error) {
      setGoodsReceivingNotice(actionErrorMessage(error));
    }
  };

  const applyPostedGRNToLocalStock = (result: GoodsReceivingPostingResult) => {
    if (!result.stockPosted) return;
    let nextStock = [...localStock];
    result.postedLines.forEach((line) => {
      nextStock = nextStock.map((item) => {
        if ((item.sku || item.code) !== line.sku) return item;
        const currentQty = item.qtyOnHand ?? item.stock;
        const nextQty = currentQty + line.qtyAccepted;
        const inventoryUnitCost = line.unitCost ?? line.receivedUnitCost;
        const oldAverageCost = item.costPrice ?? item.cost ?? 0;
        const weightedAverageCost = nextQty > 0
          ? Number((((currentQty * oldAverageCost) + (line.qtyAccepted * inventoryUnitCost)) / nextQty).toFixed(4))
          : inventoryUnitCost;
        onUpdateStock(item.id, item.stock + line.qtyAccepted);
        return {
          ...item,
          stock: item.stock + line.qtyAccepted,
          qtyOnHand: nextQty,
          cost: weightedAverageCost,
          costPrice: weightedAverageCost,
          price: line.sellingPrice,
          sellingPrice: line.sellingPrice,
          shelfLocation: line.shelfLocation || item.shelfLocation,
          lastMovementDate: new Date().toISOString().slice(0, 10),
          healthStatus: nextQty > item.minStock ? 'In Stock' : item.healthStatus
        };
      });
    });
    saveLocalStockState(nextStock);
  };

  const handleGRNPosted = async (result: GoodsReceivingPostingResult) => {
    applyPostedGRNToLocalStock(result);
    setGoodsReceivingNotice(result.message);
    triggerNewActivityEvent('STOCK_RECEIVED', `${result.grnNumber} posted accepted quantities to stock.`, 'Low');
    await refreshGoodsReceiving();
    await refreshPurchaseOrders();
  };

  const handleGoodsReceivingAction = async (note: GoodsReceivingNote, action: 'post' | 'submit' | 'approve' | 'cancel' | 'reverse' | 'export') => {
    try {
    if (action === 'post') {
      if (!canPerformAction(simulatedRole, 'goodsReceiving.post')) {
        setGoodsReceivingNotice('You do not have permission to perform this action.');
        return;
      }
      const result = await postGRN(note.grnId, staffName);
      if (result) {
        if (result.stockPosted) applyPostedGRNToLocalStock(result);
        setGoodsReceivingNotice(result.message);
      }
    }
    if (action === 'submit') {
      await submitGRNForApproval(note.grnId);
      setGoodsReceivingNotice(`${note.grnNumber} submitted for approval. Stock not updated.`);
    }
    if (action === 'approve') {
      if (!canPerformAction(simulatedRole, 'goodsReceiving.approve') && !canPerformAction(simulatedRole, 'approvals.approve')) {
        setGoodsReceivingNotice('You do not have permission to perform this action.');
        return;
      }
      await approveGRN(note.grnId, staffName, 'Approved from Goods Receiving tab.');
      setGoodsReceivingNotice(`${note.grnNumber} approved for posting.`);
    }
    if (action === 'cancel') {
      const reason = window.prompt(`Reason for cancelling ${note.grnNumber}?`);
      if (!reason) return;
      await cancelGRN(note.grnId, staffName, reason);
      setGoodsReceivingNotice(`${note.grnNumber} cancelled. No stock was updated.`);
    }
    if (action === 'reverse') {
      const reason = window.prompt(`Reason for reversing ${note.grnNumber}?`);
      if (!reason) return;
      await reverseGRNPlaceholder(note.grnId, staffName, reason);
      setGoodsReceivingNotice(`${note.grnNumber} reversal review recorded.`);
    }
    if (action === 'export') {
      const result = await exportGRNPlaceholder(note.grnId);
      setGoodsReceivingNotice(result.message);
    }
    await refreshGoodsReceiving();
    await refreshPurchaseOrders();
    } catch (error) {
      setGoodsReceivingNotice(actionErrorMessage(error));
    }
  };

  const handleClosePOWithOutstanding = async (po: PurchaseOrder) => {
    if (!canPerformAction(simulatedRole, 'purchaseOrders.cancel') && simulatedRole !== 'Owner' && simulatedRole !== 'Manager') {
      setGoodsReceivingNotice('You do not have permission to perform this action.');
      return;
    }
    const summary = await getPOReceivingSummary(po.poId);
    if (!summary || summary.totalOutstandingQty <= 0) {
      setGoodsReceivingNotice(`${po.poNumber} has no outstanding quantity to close.`);
      return;
    }
    const reason = window.prompt(`Reason for closing ${po.poNumber} with ${summary.totalOutstandingQty} outstanding units?`);
    if (!reason) return;
    await closePOWithOutstanding(po.poId, staffName, reason);
    setGoodsReceivingNotice(`${po.poNumber} closed with outstanding quantities. No stock was posted for unreceived items.`);
    await refreshPurchaseOrders();
  };

  const handleKeepPOOpen = async (po: PurchaseOrder) => {
    await reopenPOPlaceholder(po.poId, staffName, 'Outstanding quantities remain available for future GRNs.');
    setGoodsReceivingNotice(`${po.poNumber} kept open for future fulfillment. Outstanding lines remain available for future GRNs.`);
    await refreshPurchaseOrders();
  };

  const openSupplierReturnForm = async (record: SupplierReturn) => {
    setActiveSupplierReturn(record);
    setSupplierReturnFormOpen(true);
  };

  const handleCreateSupplierReturnFromGRN = async (note?: GoodsReceivingNote) => {
    try {
    if (!canPerformAction(simulatedRole, 'supplierReturns.create')) {
      setSupplierReturnNotice('You do not have permission to perform this action.');
      return;
    }
    const targetGRN = note || goodsReceivingNotes.find((item) => item.receivingStatus === 'Posted' || item.receivingStatus === 'Partially Posted');
    if (!targetGRN) {
      setSupplierReturnNotice('No posted GRN is available for Supplier Return creation.');
      return;
    }
    const draft = await createSupplierReturnFromGRN(targetGRN.grnId, staffName);
    if (!draft) {
      setSupplierReturnNotice(`${targetGRN.grnNumber} has no returnable or rejected lines available.`);
      return;
    }
    await refreshSupplierReturns();
    setSupplierReturnNotice(`${draft.supplierReturnNumber} draft created from ${targetGRN.grnNumber}. Draft Supplier Return has not reduced stock.`);
    setActiveSupplierReturn(draft);
    setSupplierReturnFormOpen(true);
    setActiveTab('Supplier Returns');
    } catch (error) {
      setSupplierReturnNotice(actionErrorMessage(error));
    }
  };

  const applyPostedSupplierReturnToLocalStock = (result: SupplierReturnPostingResult) => {
    if (!result.stockPosted) return;
    let nextStock = [...localStock];
    result.postedLines.forEach((line) => {
      nextStock = nextStock.map((item) => {
        if ((item.sku || item.code) !== line.sku) return item;
        const currentQty = item.qtyOnHand ?? item.stock;
        const nextQty = Math.max(currentQty - line.qtyPostedOut, 0);
        onUpdateStock(item.id, Math.max(item.stock - line.qtyPostedOut, 0));
        return {
          ...item,
          stock: Math.max(item.stock - line.qtyPostedOut, 0),
          qtyOnHand: nextQty,
          lastMovementDate: new Date().toISOString().slice(0, 10),
          healthStatus: nextQty <= 0 ? 'Out of Stock' : item.healthStatus
        };
      });
    });
    saveLocalStockState(nextStock);
  };

  const handleSupplierReturnPosted = async (result: SupplierReturnPostingResult) => {
    applyPostedSupplierReturnToLocalStock(result);
    setSupplierReturnNotice(result.message);
    triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `${result.supplierReturnNumber} posted supplier return. Stock reduced only for accepted goods already in inventory.`, 'Medium');
    await refreshSupplierReturns();
    await refreshGoodsReceiving();
    await refreshPurchaseOrders();
  };

  const handleSupplierReturnAction = async (
    record: SupplierReturn,
    action: 'submit' | 'approve' | 'post' | 'dispatch' | 'credit' | 'replacement' | 'close' | 'cancel' | 'export'
  ) => {
    try {
    if (action === 'submit') {
      await submitSupplierReturnForApproval(record.supplierReturnId);
      setSupplierReturnNotice(`${record.supplierReturnNumber} submitted for approval. Stock not reduced.`);
    }
    if (action === 'approve') {
      if (!canPerformAction(simulatedRole, 'supplierReturns.approve') && !canPerformAction(simulatedRole, 'approvals.approve')) {
        setSupplierReturnNotice('You do not have permission to perform this action.');
        return;
      }
      await approveSupplierReturn(record.supplierReturnId, staffName, 'Approved from Supplier Returns tab.');
      setSupplierReturnNotice(`${record.supplierReturnNumber} approved for posting.`);
    }
    if (action === 'post') {
      if (!canPerformAction(simulatedRole, 'supplierReturns.post')) {
        setSupplierReturnNotice('You do not have permission to perform this action.');
        return;
      }
      const result = await postSupplierReturn(record.supplierReturnId, staffName);
      if (result) {
        applyPostedSupplierReturnToLocalStock(result);
        setSupplierReturnNotice(result.message);
      }
    }
    if (action === 'dispatch') {
      if (!canPerformAction(simulatedRole, 'supplierReturns.dispatch')) {
        setSupplierReturnNotice('You do not have permission to perform this action.');
        return;
      }
      await markDispatchedToSupplier(record.supplierReturnId, {
        dispatchMethod: record.dispatchMethod || 'Supplier Collection',
        courierReference: record.courierReference,
        dispatchNotes: 'Dispatched from Supplier Returns tab.',
        dispatchedByStaffId: staffName,
        dispatchedByStaffName: staffName
      });
      setSupplierReturnNotice(`${record.supplierReturnNumber} dispatched to supplier.`);
    }
    if (action === 'credit') {
      const number = window.prompt(`Supplier credit note number for ${record.supplierReturnNumber}?`);
      if (!number) return;
      const amountInput = window.prompt('Supplier credit note amount?') || '0';
      await recordSupplierCreditNotePlaceholder(record.supplierReturnId, {
        supplierCreditNoteNumber: number.toUpperCase(),
        supplierCreditNoteAmount: Number(amountInput) || 0,
        notes: 'Credit note recorded from Supplier Returns tab.'
      });
      setSupplierReturnNotice(`${record.supplierReturnNumber} credit note recorded. No cashbook posting.`);
    }
    if (action === 'replacement') {
      await recordReplacementExpected(record.supplierReturnId, { notes: 'Replacement expected from supplier.' });
      setSupplierReturnNotice(`${record.supplierReturnNumber} replacement expected recorded.`);
    }
    if (action === 'close') {
      if (!canPerformAction(simulatedRole, 'supplierReturns.close')) {
        setSupplierReturnNotice('You do not have permission to perform this action.');
        return;
      }
      const notes = window.prompt(`Close ${record.supplierReturnNumber} notes?`);
      if (!notes) return;
      await closeSupplierReturn(record.supplierReturnId, staffName, notes);
      setSupplierReturnNotice(`${record.supplierReturnNumber} closed.`);
    }
    if (action === 'cancel') {
      if (!canPerformAction(simulatedRole, 'supplierReturns.cancel')) {
        setSupplierReturnNotice('You do not have permission to perform this action.');
        return;
      }
      const reason = window.prompt(`Reason for cancelling ${record.supplierReturnNumber}?`);
      if (!reason) return;
      await cancelSupplierReturn(record.supplierReturnId, staffName, reason);
      setSupplierReturnNotice(`${record.supplierReturnNumber} cancelled. No stock was reduced.`);
    }
    if (action === 'export') {
      const result = await exportSupplierReturnPlaceholder(record.supplierReturnId);
      setSupplierReturnNotice(result.message);
    }
    await refreshSupplierReturns();
    } catch (error) {
      setSupplierReturnNotice(actionErrorMessage(error));
    }
  };

  const openStockAdjustmentForm = (record: StockAdjustment | null = null) => {
    if (record === null && !canUseStockAdjustmentPermission('stockAdjustment.create')) {
      setStockAdjustmentNotice('You do not have permission to perform this action.');
      return;
    }
    setActiveStockAdjustment(record);
    setStockAdjustmentFormOpen(true);
  };

  const canUseStockAdjustmentPermission = (permissionKey: string) => roleHasEffectivePermission(String(simulatedRole), permissionKey);

  const applyPostedStockAdjustmentToLocalStock = (result: StockAdjustmentPostingResult) => {
    if (!result.stockPosted) return;
    let nextStock = [...localStock];
    result.movements.forEach((movement) => {
      nextStock = nextStock.map((item) => {
        if (item.id !== movement.productId) return item;
        const nextQty = movement.balanceAfter;
        onUpdateStock(item.id, nextQty);
        return {
          ...item,
          stock: nextQty,
          qtyOnHand: nextQty,
          lastMovementDate: new Date().toISOString().slice(0, 10),
          healthStatus: nextQty <= 0 ? 'Out of Stock' : item.healthStatus
        };
      });
    });
    saveLocalStockState(nextStock);
  };

  const handleStockAdjustmentPosted = async (result: StockAdjustmentPostingResult) => {
    applyPostedStockAdjustmentToLocalStock(result);
    setStockAdjustmentNotice(result.message);
    triggerNewActivityEvent('STOCK_ADJUSTMENT_POSTED', `${result.adjustmentNumber} posted through controlled stock adjustment.`, 'Medium');
    await refreshStockAdjustments();
  };

  const handleStockAdjustmentAction = async (
    record: StockAdjustment,
    action: 'submit' | 'approve' | 'reject' | 'post' | 'cancel' | 'reverse' | 'export' | 'duplicate'
  ) => {
    if (action === 'submit') {
      if (record.status !== 'Draft' || !canUseStockAdjustmentPermission('stockAdjustment.create')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await submitStockAdjustmentForApproval(record.adjustmentId);
      setStockAdjustmentNotice('Stock adjustment submitted for approval.');
    }
    if (action === 'approve') {
      if (record.status !== 'Pending Approval' || !canUseStockAdjustmentPermission('stockAdjustment.approve')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await approveStockAdjustment(record.adjustmentId, staffName, 'Approved from Stock Adjustments tab.');
      setStockAdjustmentNotice('Stock adjustment approved.');
    }
    if (action === 'reject') {
      if (!['Pending Approval', 'Approved'].includes(record.status) || !canUseStockAdjustmentPermission('stockAdjustment.approve')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await rejectStockAdjustment(record.adjustmentId, staffName, 'Rejected during review.');
      setStockAdjustmentNotice('Stock adjustment rejected.');
    }
    if (action === 'post') {
      if (record.status !== 'Approved' || !canUseStockAdjustmentPermission('stockAdjustment.post')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      const context: CommerceOperationContext = {
        vendorId: session?.vendorId || getActiveVendorId(),
        branchId: session?.branch || activeBranch,
        warehouseId: session?.warehouseId,
        terminalId: 'TERMINAL_STOCK_DESK',
        staffId: staffName
      };
      const result = await postStockAdjustment(record.adjustmentId, context);
      if (result) {
        applyPostedStockAdjustmentToLocalStock(result);
        setStockAdjustmentNotice(result.stockPosted ? result.message : 'Posting review completed. Inventory movement will be written by controlled stock movement logic.');
      }
    }
    if (action === 'cancel') {
      if (!['Draft', 'Pending Approval'].includes(record.status) || !canUseStockAdjustmentPermission('stockAdjustment.create')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await cancelStockAdjustment(record.adjustmentId, staffName, 'Cancelled during review.');
      setStockAdjustmentNotice('Stock adjustment cancelled.');
    }
    if (action === 'reverse') {
      if (record.status !== 'Posted' || !canUseStockAdjustmentPermission('stockAdjustment.post')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await reverseStockAdjustmentPlaceholder(record.adjustmentId, staffName, 'Reverse adjustment preview prepared. Final reversal workflow will create a controlled correction movement.');
      setStockAdjustmentNotice('Reverse adjustment preview prepared. Final reversal workflow will create a controlled correction movement.');
    }
    if (action === 'export') {
      await exportStockAdjustmentPlaceholder(record.adjustmentId);
      await recordStockAdjustmentPlaceholderActivity(record.adjustmentId, staffName, 'STOCK_ADJUSTMENT_EXPORT_PREPARED', `Export prepared for stock adjustment ${record.adjustmentNumber}.`);
      setStockAdjustmentNotice(`Export prepared for stock adjustment ${record.adjustmentNumber}.`);
    }
    if (action === 'duplicate') {
      if (!canUseStockAdjustmentPermission('stockAdjustment.create')) {
        setStockAdjustmentNotice('You do not have permission to perform this action.');
        return;
      }
      await recordStockAdjustmentPlaceholderActivity(record.adjustmentId, staffName, 'STOCK_ADJUSTMENT_DUPLICATED_PLACEHOLDER', `${record.adjustmentNumber} duplicate as new draft prepared.`);
      setStockAdjustmentNotice(`${record.adjustmentNumber} duplicate as new draft prepared.`);
    }
    await refreshStockAdjustments();
  };

  const getStockAdjustmentActionItems = (record: StockAdjustment): RowActionMenuItem[] => {
    const canView = canUseStockAdjustmentPermission('stockAdjustment.view') || canUseStockAdjustmentPermission('stockAdjustment.create');
    const canCreate = canUseStockAdjustmentPermission('stockAdjustment.create');
    const canApprove = canUseStockAdjustmentPermission('stockAdjustment.approve');
    const canPost = canUseStockAdjustmentPermission('stockAdjustment.post');
    const items: RowActionMenuItem[] = [];

    if (canView) {
      items.push({
        label: record.status === 'Draft' ? 'View / Edit' : 'View',
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => openStockAdjustmentForm(record)
      });
    }

    if (record.status === 'Draft') {
      if (canCreate) {
        items.push(
          { label: 'Submit for Approval', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'submit') },
          { label: 'Cancel', icon: <X className="w-3.5 h-3.5" />, danger: true, onClick: () => void handleStockAdjustmentAction(record, 'cancel') }
        );
      }
      if (canView) items.push({ label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'export') });
    } else if (record.status === 'Pending Approval') {
      if (canApprove) {
        items.push(
          { label: 'Approve', icon: <CheckCircle className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'approve') },
          { label: 'Reject', icon: <Ban className="w-3.5 h-3.5" />, danger: true, onClick: () => void handleStockAdjustmentAction(record, 'reject') }
        );
      }
      if (canView) items.push({ label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'export') });
    } else if (record.status === 'Approved') {
      if (canPost) items.push({ label: 'Post Adjustment', icon: <Check className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'post') });
      if (canApprove) items.push({ label: 'Reject / Return for Correction', icon: <Ban className="w-3.5 h-3.5" />, danger: true, onClick: () => void handleStockAdjustmentAction(record, 'reject') });
      if (canView) items.push({ label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'export') });
    } else if (record.status === 'Posted') {
      if (canView) {
        items.push({ label: 'View Ledger', icon: <History className="w-3.5 h-3.5" />, onClick: () => setStockAdjustmentNotice('Product Ledger can be opened from the Inventory Product Ledger tab; posted adjustment movements are recorded as STOCK_ADJUSTMENT_IN or STOCK_ADJUSTMENT_OUT.') });
      }
      if (canPost) items.push({ label: 'Reverse', icon: <Archive className="w-3.5 h-3.5" />, danger: true, onClick: () => void handleStockAdjustmentAction(record, 'reverse') });
      if (canView) items.push({ label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'export') });
    } else {
      if (canCreate) items.push({ label: 'Duplicate as New', icon: <PlusCircle className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'duplicate') });
      if (canView) items.push({ label: 'Prepare Export', icon: <Download className="w-3.5 h-3.5" />, onClick: () => void handleStockAdjustmentAction(record, 'export') });
    }

    return items.length > 0 ? items : [{ label: 'No permitted actions for current role', disabled: true }];
  };


  // B. GRN GOODS INTAKE SUBMIT ACTION
  const handleGRNSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGrnFeedback(null);

    // Form Discipline Rule 5: Empty Invoice number blocking
    if (!grnInvoiceNo.trim()) {
      setGrnFeedback({ type: 'error', msg: 'Supplier invoice number is required to submit Goods Received Note.' });
      return;
    }

    // Form Discipline Rule 4: Selling price below cost check
    const sellingBelowCostLine = grnLines.find(line => !line.rejected && line.suggestedPrice < line.costPrice);
    if (sellingBelowCostLine) {
      setGrnFeedback({
        type: 'error',
        msg: `BLOCKED: For item [${sellingBelowCostLine.sku}] ${sellingBelowCostLine.productName}, Suggested selling price (USD ${sellingBelowCostLine.suggestedPrice.toFixed(2)}) is lower than Cost Price (USD ${sellingBelowCostLine.costPrice.toFixed(2)}).`
      });
      logGlobalBiEvent('SELLING_BELOW_COST_BLOCKED', { sku: sellingBelowCostLine.sku, cost: sellingBelowCostLine.costPrice, requestedSelling: sellingBelowCostLine.suggestedPrice }, 'HIGH');
      triggerNewActivityEvent('SALE_BLOCKED_ZERO_STOCK', `Procurement blocked: Suggested selling price below Cost price for SKU ${sellingBelowCostLine.sku}`, 'High');
      return;
    }

    // Check for quantity variances or cost spikes
    const hasQuantityVariance = grnLines.some(line => !line.rejected && line.receivedQty !== line.orderedQty);
    
    // Cost Spike check (higher than previous cost by more than 15%)
    const spikeLine = grnLines.find(line => {
      if (line.rejected) return false;
      const pctIncrease = (line.costPrice - line.prevCostPrice) / line.prevCostPrice;
      return pctIncrease > 0.15;
    });

    // Determine the required actions
    if (hasQuantityVariance || spikeLine) {
      // Rule 6: Require Supervisor/Manager approval
      const isSupervisorClearedLog = canApprove('GRN Variance Approval', simulatedRole);
      
      const reqId = 'APR-GRN-' + Math.floor(Math.random() * 8999 + 1000);
      const notes = `GRN [${grnNumber}] Invoice [${grnInvoiceNo}] has variance/spikes. ` +
        (hasQuantityVariance ? 'Quantity discrepancy. ' : '') + 
        (spikeLine ? `Cost Spike detected on SKU ${spikeLine.sku} (+${(((spikeLine.costPrice - spikeLine.prevCostPrice) / spikeLine.prevCostPrice) * 100).toFixed(0)}%).` : '');

      const newApproval: ApprovalRequest = {
        id: reqId,
        type: spikeLine ? 'Cost Spike Approval' : 'GRN Variance Approval',
        status: isSupervisorClearedLog ? 'Approved' : 'Pending',
        requestedBy: staffName,
        notes: notes,
        createdAt: new Date().toISOString(),
        payload: {
          grnNumber,
          grnSupplier,
          grnInvoiceNo,
          grnPoRef,
          notes: grnNotes,
          items: grnLines
        } as any
      };

      if (!isSupervisorClearedLog) {
        // Appends to pending queue
        setStockApprovals(prev => [newApproval, ...prev]);
        setGrnFeedback({
          type: 'warning',
          msg: `QUEUED FOR APPROVAL: GRN ${grnNumber} contains discrepancies (Variance or Price Spike). Submitted to Authorization Queue. Stock will NOT update until Approved by a Supervisor.`
        });

        // Audit logs
        triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `GRN ${grnNumber} queued for approval due to discrepancies.`, 'High');
        if (hasQuantityVariance) {
          logGlobalBiEvent('PURCHASE_VARIANCE_FOUND', { grnNumber, invoiceNo: grnInvoiceNo, poRef: grnPoRef }, 'HIGH');
          triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `Quantity variance flagged during intake of GRN ${grnNumber}`, 'Medium');
        }
        if (spikeLine) {
          logGlobalBiEvent('COST_PRICE_SPIKE', { grnNumber, sku: spikeLine.sku, oldCost: spikeLine.prevCostPrice, newCost: spikeLine.costPrice }, 'HIGH');
          triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `Cost speed spike detected (+15%) on SKU ${spikeLine.sku}`, 'High');
        }
        
        refreshPurchaseOrders();
        return;
      } else {
        // Supervisor role override is active, we can self-approve directly!
        applyGRNToStock(grnLines, grnNumber);
        setGrnFeedback({
          type: 'success',
          msg: `SUCCESS (Self-Approved by Authorised Role): GRN ${grnNumber} successfully posted and system inventory updated.`
        });
        return;
      }
    }

    // Standard Clean Submit: Apply to Stock immediately
    applyGRNToStock(grnLines, grnNumber);
    setGrnFeedback({ type: 'success', msg: `SUCCESS: Goods Received Note ${grnNumber} successfully registered into database and quantities incremented.` });
  };

  // Helper function to update products with received items
  const applyGRNToStock = (lines: GRNLine[], grnRef: string) => {
    let updatedCatalog = [...localStock];
    lines.forEach(line => {
      if (line.rejected) return;
      updatedCatalog = updatedCatalog.map(item => {
        if (item.code === line.sku) {
          const nextStock = item.stock + line.receivedQty;
          
          let healthStatus = item.healthStatus;
          if (nextStock > item.minStock) {
            healthStatus = 'In Stock' as any;
          }

          // Update cost and sell prices
          return {
            ...item,
            stock: nextStock,
            cost: line.costPrice,
            price: line.suggestedPrice,
            healthStatus: healthStatus,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return item;
      });

      // Call parent onUpdateStock prop
      const match = localStock.find(p => p.code === line.sku);
      if (match) {
        onUpdateStock(match.id, match.stock + line.receivedQty);
        postLegacyLedgerMovement(match, 'GRN', grnRef, 'GOODS_RECEIVED', line.receivedQty, 0, `Goods received from ${grnSupplier}.`);
      }
    });

    saveLocalStockState(updatedCatalog);
    
    // Log successes
    triggerNewActivityEvent('GOODS_RECEIVED', `Posted GRN ${grnRef} with ${lines.length} lines. Inventory incremented.`, 'Low');
    logGlobalBiEvent('GOODS_RECEIVED', { grnRef, totalLines: lines.length }, 'INFO');

    refreshPurchaseOrders();

    // Reset Form completely
    setGrnNumber(`GRN-2026-${Math.floor(Math.random() * 8999 + 1000)}`);
    setGrnInvoiceNo('');
    setGrnNotes('');
  };


  // C. SUPPLIER RETURN ACTION
  const handleSupplierReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRetFeedback(null);

    const matchProduct = localStock.find(p => p.code === retSku);
    if (!matchProduct) return;

    const qty = parseInt(retQty) || 0;
    if (qty <= 0) {
      setRetFeedback("Error: Quantity returned must be greater than zero.");
      return;
    }

    if (qty > matchProduct.stock) {
      setRetFeedback(`Blocked: Product catalog only holds ${matchProduct.stock} units. Cannot return ${qty} units.`);
      return;
    }

    // Subcontracting return
    const id = 'RET-' + Math.floor(Math.random() * 899 + 100);
    const newReturn: LegacySupplierReturnRecord = {
      id,
      supplierName: retSupplier,
      originalGrn: retGrn || 'GRN-MANUAL-ENTRY',
      sku: retSku,
      productName: matchProduct.name,
      quantityReturned: qty,
      reason: retReason,
      condition: retCondition,
      status: 'Draft',
      createdDate: new Date().toISOString().substring(0, 10),
      requestedBy: staffName
    };

    setSupplierReturns(prev => [newReturn, ...prev]);
    setRetFeedback(`Supplier Return Request ${id} created in 'Draft' state. Dispatch or Apply Credits to continue.`);
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Created return draft ${id} for SKU ${retSku}`, 'Low');
    logGlobalBiEvent('SUPPLIER_RETURN_CREATED', { returnId: id, sku: retSku, qty }, 'INFO');

    // Reset selector quantities
    setRetQty('1');
    setRetGrn('');
  };

  // Ship Return & Deduct Inventory Stock
  const handleShipAndDeductStock = (ret: LegacySupplierReturnRecord) => {
    const matchProduct = localStock.find(p => p.code === ret.sku);
    if (!matchProduct) return;

    if (matchProduct.stock < ret.quantityReturned) {
      alert(`Cannot dispatch: Stock on hand (${matchProduct.stock}) is less than return qty (${ret.quantityReturned}).`);
      return;
    }

    // Deduct stock levels in system catalog
    const updatedStock = localStock.map(p => {
      if (p.code === ret.sku) {
        const nextStock = p.stock - ret.quantityReturned;
        const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
        return {
          ...p,
          stock: nextStock,
          healthStatus: status as any,
          lastMovementDate: new Date().toISOString().substring(0, 10)
        };
      }
      return p;
    });

    saveLocalStockState(updatedStock);
    onUpdateStock(matchProduct.id, matchProduct.stock - ret.quantityReturned);
    postLegacyLedgerMovement(matchProduct, 'SUPPLIER_RETURN', ret.id, 'SUPPLIER_RETURN', 0, ret.quantityReturned, `Supplier return shipped to ${ret.supplierName}.`);

    // Update return status to Shipped
    setSupplierReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'Shipped' } : r));

    // Log telemetry events
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Supplier Return ${ret.id} dispatched. Deducted ${ret.quantityReturned} from store.`, 'Medium');
    logGlobalBiEvent('STOCK_TRANSFERRED', { returnId: ret.id, sku: ret.sku, qty: ret.quantityReturned }, 'WARNING');
  };

  // Credited mark
  const handleCompleteCredit = (retId: string) => {
    setSupplierReturns(prev => prev.map(r => r.id === retId ? { ...r, status: 'Credited' } : r));
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Marked Return ${retId} as Credited by supplier. Credits ready for purchase invoices.`, 'Low');
    logGlobalBiEvent('SUPPLIER_CREDIT_PENDING', { returnId: retId }, 'INFO');
  };


  // D. STOCK ADJUSTMENTS SUBMISSION RULES
  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjFeedback(null);

    const qty = parseInt(adjCountQty) || 0;
    if (qty <= 0) {
      setAdjFeedback({ type: 'error', msg: 'Adjustment quantity must be a positive integer.' });
      return;
    }

    // Rule 1: Cashier is completely blocked
    if (simulatedRole === 'Cashier') {
      setAdjFeedback({ type: 'error', msg: 'ACCESS DENIED: Operators with Cashier roles are not authorized to make or request stock adjustments.' });
      return;
    }

    const matchProduct = localStock.find(p => p.code === adjSku);
    if (!matchProduct) return;

    const currentQty = matchProduct.stock;
    const finalQtyStatus = adjType === 'ADD' ? currentQty + qty : currentQty - qty;

    if (finalQtyStatus < 0) {
      setAdjFeedback({ type: 'error', msg: `Invalid adjustment: Cannot deduct ${qty} units; catalog only holds ${currentQty}.` });
      return;
    }

    // Check Approval Level Requirements (Rule rule checks)
    const isNegative = adjType === 'DEDUCT';
    const isSensitiveLoss = isNegative && qty > 3;

    // Check roles
    if (simulatedRole === 'Stock Controller') {
      // Stock Controller ALWAYS requests, never applies directly!
      const reqId = 'APR-ADJ-' + Math.floor(Math.random() * 8999 + 1000);
      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stock Adjustment Approval',
        status: 'Pending',
        requestedBy: staffName,
        notes: `Stock adjustment for ${matchProduct.name} (Delta: ${isNegative ? '-' : '+'}${qty}). Reason: ${adjReasonCode}.`,
        createdAt: new Date().toISOString(),
        payload: { sku: adjSku, delta: isNegative ? -qty : qty, reason: adjReasonCode, notes: adjNotes } as any
      };
      setStockApprovals(prev => [newApproval, ...prev]);
      setAdjFeedback({ type: 'warning', msg: `Approval request ${reqId} queued. Stock Controller roles require Supervisor validation to adjust inventory.` });
      triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `Adjustment request filed for SKU ${adjSku}`, 'Medium');
      logGlobalBiEvent('STOCK_ADJUSTMENT_REQUESTED', { sku: adjSku, delta: isNegative ? -qty : qty }, 'INFO');
      return;
    }

    if (simulatedRole === 'Supervisor' && isSensitiveLoss) {
      // Supervisor cannot approve negative adjustments > 3 items!
      const reqId = 'APR-ADJ-' + Math.floor(Math.random() * 8999 + 1000);
      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stock Adjustment Approval',
        status: 'Pending',
        requestedBy: staffName,
        notes: `Manager Needed: Negative adjustment of ${qty} items (exceeds Supervisor cap of 3) for SKU ${adjSku}.`,
        createdAt: new Date().toISOString(),
        payload: { sku: adjSku, delta: -qty, reason: adjReasonCode, notes: adjNotes } as any
      };
      setStockApprovals(prev => [newApproval, ...prev]);
      setAdjFeedback({ type: 'warning', msg: `QUEUED FOR MANAGER: Negative adjustments greater than 3 units require Manager or Owner authorization. Queuing request ${reqId}.` });
      return;
    }

    // Qualified Role (Supervisor <=3, Manager / Owner / SysAdmin all): Apply directly
    const updatedStock = localStock.map(p => {
      if (p.code === adjSku) {
        const nextStock = finalQtyStatus;
        const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
        return {
          ...p,
          stock: nextStock,
          healthStatus: status as any,
          lastMovementDate: new Date().toISOString().substring(0, 10)
        };
      }
      return p;
    });

    saveLocalStockState(updatedStock);
    onUpdateStock(matchProduct.id, finalQtyStatus);
    postLegacyLedgerMovement(
      matchProduct,
      'ADJUSTMENT',
      `ADJ-${Date.now()}`,
      isNegative ? 'STOCK_ADJUSTMENT_OUT' : 'STOCK_ADJUSTMENT_IN',
      isNegative ? 0 : qty,
      isNegative ? qty : 0,
      `Posted stock adjustment. Reason: ${adjReasonCode}. ${adjNotes}`
    );

    triggerNewActivityEvent('STOCK_RECEIVED', `Stock Adjusted directly: ${matchProduct.name} set to ${finalQtyStatus} (${isNegative ? '-' : '+'}${qty}).`, 'Medium');
    logGlobalBiEvent('STOCK_RECEIVED', { sku: adjSku, change: isNegative ? -qty : qty, finalQtyStatus }, 'WARNING');

    if (adjReasonCode === 'Theft suspicion') {
      logGlobalBiEvent('SUSPICIOUS_STOCK_LOSS', { sku: adjSku, qtyLoss: qty, description: adjNotes || 'No notes left' }, 'HIGH');
      triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `High risk theft-suspected shrinkage adjusted on SKU ${adjSku}`, 'High');
    }

    setAdjFeedback({ type: 'success', msg: `SUCCESS: Product ${adjSku} inventory adjusted successfully to ${finalQtyStatus}.` });
    setAdjCountQty('');
    setAdjNotes('');
  };


  // E. SPOT STOCKTAKE SUBMIT ACTION
  const handleSpotStocktakeLineChange = (sku: string, counted: string) => {
    const val = parseInt(counted) || 0;
    setStocktakeLines(prev => prev.map(line => {
      if (line.sku === sku) {
        const variance = val - line.systemQty;
        const riskLevel = variance === 0 ? 'Low' : (Math.abs(variance) > 5 ? 'Critical' : 'High');
        const status = variance === 0 ? 'Matched' : variance < 0 ? 'Short Count' : 'Over Count';
        return {
          ...line,
          countedQty: val,
          variance,
          riskLevel: riskLevel as any,
          status,
          stocktakeType: stocktakeSessionType,
          countedBy: staffName
        };
      }
      return line;
    }));
  };

  const handleStartStocktakeSession = () => {
    setStocktakeActive(true);
    setStocktakeFeedback(`${stocktakeSessionType} stocktake session STARTED. Key in observed quantities for the filtered shelf/location count sheet.`);
    triggerNewActivityEvent('STOCKTAKE_STARTED', `${stocktakeSessionType} stocktake started by ${staffName}.`, 'Low');
  };

  // Spot check randomizer
  const handleRandomSpotCheck = () => {
    setStocktakeActive(true);
    setStocktakeLines(prev => prev.map(line => {
      if (Math.random() > 0.4) {
        const deviation = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const finalCount = Math.max(0, line.systemQty + deviation);
        return {
          ...line,
          countedQty: finalCount,
          variance: finalCount - line.systemQty,
          riskLevel: finalCount - line.systemQty === 0 ? 'Low' : 'High',
          status: finalCount - line.systemQty === 0 ? 'Matched' : finalCount - line.systemQty < 0 ? 'Short Count' : 'Over Count',
          stocktakeType: stocktakeSessionType,
          countedBy: staffName
        };
      }
      return line;
    }));
    setStocktakeFeedback("Random Spot count simulations generated. Review variances before posting.");
  };

  const handleRecommendMajorAudit = () => {
    logGlobalBiEvent('RECOMMEND_MAJOR_STOCKTAKE', { reason: 'Auditor recommendation' }, 'HIGH');
    triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', "Major physical stocktake recommended: Audit logs flag discrepancy risks.", 'High');
    alert("[RECOMMENDATION REGISTERED]\n===========================\nLogging Request: Recommend complete operational shutdown for full physical auditing.");
  };

  const handlePostStocktakeResults = () => {
    const totalLinesWithDiscrepancy = stocktakeLines.filter(l => l.variance !== 0);
    
    if (totalLinesWithDiscrepancy.length > 0) {
      const isCleared = canApprove('Stocktake Variance Approval', simulatedRole);
      
      const reqId = 'APR-STK-' + Math.floor(Math.random() * 8999 + 1000);
      const description = `Stocktake discrepancies found on ${totalLinesWithDiscrepancy.length} items. Target variance: ` + 
        totalLinesWithDiscrepancy.map(l => `${l.sku} (${l.variance > 0 ? '+' : ''}${l.variance})`).join(', ');

      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stocktake Variance Approval',
        status: isCleared ? 'Approved' : 'Pending',
        requestedBy: staffName,
        notes: description,
        createdAt: new Date().toISOString(),
        payload: { lines: stocktakeLines } as any
      };

      if (!isCleared) {
        setStockApprovals(prev => [newApproval, ...prev]);
        setStocktakeFeedback(`SUBMISSION FLAG: Posted counts contain variances. Request ${reqId} queued for Supervisor authorization before applying to database.`);
        logGlobalBiEvent('VARIANCE_RISK_FOUND', { totalDiscrepantLines: totalLinesWithDiscrepancy.length }, 'HIGH');
        triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `Variance discrepancy found in stocktake audit. Filed request.`, 'High');
        if (stocktakeSessionType === 'Audit') {
          logGlobalBiEvent('AUDIT_STOCKTAKE_REVIEW_REQUIRED', { requestId: reqId }, 'HIGH');
        }
        return;
      }
    }

    // matched or supervisor auto-approves
    applyStocktakeToStock(stocktakeLines);
    setStocktakeFeedback("SUCCESS: Spot checks validated and posted to Ledger database. Quantities synched.");
    setStocktakeActive(false);
  };

  const applyStocktakeToStock = (lines: StocktakeLine[]) => {
    let updatedCatalog = [...localStock];
    lines.forEach(line => {
      updatedCatalog = updatedCatalog.map(p => {
        if (p.code === line.sku) {
          const nextStock = line.countedQty;
          const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
          return {
            ...p,
            stock: nextStock,
            healthStatus: status as any,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return p;
      });

      const match = localStock.find(p => p.code === line.sku);
      if (match) {
        onUpdateStock(match.id, line.countedQty);
        if (line.variance !== 0) {
          const isIncrease = line.variance > 0;
          postLegacyLedgerMovement(
            match,
            'STOCKTAKE',
            `STK-${Date.now()}`,
            isIncrease ? 'STOCKTAKE_ADJUSTMENT_IN' : 'STOCKTAKE_ADJUSTMENT_OUT',
            isIncrease ? line.variance : 0,
            isIncrease ? 0 : Math.abs(line.variance),
            `Stocktake variance posted by ${line.countedBy || staffName}.`
          );
        } else {
          logGlobalBiEvent('STOCKTAKE_COUNT_LOGGED', { sku: line.sku, countedQty: line.countedQty }, 'INFO');
        }
      }
    });

    saveLocalStockState(updatedCatalog);
    triggerNewActivityEvent('STOCKTAKE_SUBMITTED', "Stocktake audit post completed successfully.", 'Low');
    logGlobalBiEvent('STOCKTAKE_SUBMITTED', { linesCount: lines.length }, 'INFO');
  };


  // =========================================================================
  // ENFORCED APPROVAL ACTIONS PANEL SUB-UTILITIES
  // =========================================================================
  const handleProcessApprovalInQueue = (req: ApprovalRequest, verdict: 'Approved' | 'Rejected') => {
    // 1. Update queue status
    setStockApprovals(prev => prev.map(r => r.id === req.id ? { ...r, status: verdict } : r));

    if (verdict === 'Rejected') {
      triggerNewActivityEvent('STOCK_TRANSFERRED', `Request ${req.id} (${req.type}) REJECTED by ${simulatedRole}`, 'Low');
      return;
    }

    // 2. Apply the payload to core databases depending on type
    const payload = req.payload as any;
    
    if (req.type === 'Stock Adjustment Approval' && payload) {
      const match = localStock.find(p => p.code === payload.sku);
      if (match) {
        const nextQty = match.stock + payload.delta;
        const updated = localStock.map(p => {
          if (p.code === payload.sku) {
            const status = nextQty === 0 ? 'Out of Stock' : (nextQty <= p.minStock ? 'Low Stock' : 'In Stock');
            return {
              ...p,
              stock: nextQty,
              healthStatus: status as any,
              lastMovementDate: new Date().toISOString().substring(0, 10)
            };
          }
          return p;
        });

        saveLocalStockState(updated);
        onUpdateStock(match.id, nextQty);
        
        triggerNewActivityEvent('STOCK_RECEIVED', `APPROVAL CLEAR: Adjustment of ${payload.sku} applied to count ${nextQty}.`, 'Medium');
        logGlobalBiEvent('GOODS_RECEIVED', { sku: payload.sku, delta: payload.delta, verdict: 'APPROVED' }, 'INFO');
      }
    } 
    else if ((req.type === 'GRN Variance Approval' || req.type === 'Cost Spike Approval') && payload) {
      applyGRNToStock(payload.items, payload.grnNumber);
      triggerNewActivityEvent('GOODS_RECEIVED', `APPROVAL CLEAR: Divergent GRN ${payload.grnNumber} authorized and posted by ${simulatedRole}.`, 'High');
    }
    else if (req.type === 'Supplier Return Approval' && payload) {
      triggerNewActivityEvent('STOCK_TRANSFERRED', `APPROVAL CLEAR: Return request authorized by ${simulatedRole}.`, 'Medium');
    }
    else if (req.type === 'Stocktake Variance Approval' && payload) {
      applyStocktakeToStock(payload.lines);
      triggerNewActivityEvent('STOCKTAKE_SUBMITTED', `APPROVAL CLEAR: Stocktake count discrepancy authorized and applied to Ledger.`, 'High');
    }
  };


  return (
    <div className="space-y-6">

      <div className="inventory-access-control-strip">
        <div className="inventory-access-control-copy">
          <Shield className="w-4 h-4 text-orange-600 shrink-0" />
          <div>
            <span>Access Control</span>
            <p>Permission Source: Staff Access Rights | Page Access: Allowed</p>
          </div>
        </div>
        <label className="inventory-access-role-picker">
          <span>Preview Role</span>
          <select
            id="mock-reviewer-role-picker"
            value={simulatedRole}
            onChange={(e) => setSimulatedRole(e.target.value as Role)}
            className="bg-white text-[#1e222b] font-black uppercase text-[10px] px-2 py-1 border border-[#b1b5c2] focus:border-orange-500 outline-none rounded-none cursor-pointer"
          >
            <option value="Stock Controller">Stock Controller</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Manager">Manager</option>
            <option value="Owner">Owner</option>
            <option value="SysAdmin">SysAdmin</option>
            <option value="Cashier">Cashier (Blocked)</option>
          </select>
        </label>
      </div>
      <div className="bg-white border border-[#b1b5c2] p-3 flex flex-wrap gap-2">
        {([
          'Stock List',
          'Product Master',
          'Goods Receiving',
          'Purchase Orders',
          'Supplier Returns',
          'Stock Adjustments',
          'Product Transformation',
          'Stock Transfers',
          'Stocktake'
        ] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 border font-black uppercase text-[9px] rounded-none ${
              activeTab === tab
                ? 'bg-orange-600 text-white border-orange-700'
                : 'bg-white text-[#1e222b] border-[#b1b5c2] hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      {/* TAB SUB-PAGES SWAP ROUTERS */}
      {activeTab === 'Product Master' && (
        <div className="bg-white border border-[#b1b5c2] p-5 space-y-5">
          <div className="flex flex-col lg:flex-row justify-between gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[13px] uppercase flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Product Master
              </span>
              <p className="text-[9.5px] text-slate-700 mt-1 uppercase font-semibold">
                Product identity, sector attributes, pricing, supplier links, and multi-location stock balances.
              </p>
              <p className="text-[9.5px] text-orange-700 mt-1 uppercase font-black">
                Product Master does not directly change stock. Stock quantities change through approved inventory movements.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (!canPerformAction(simulatedRole, 'productMaster.export')) {
                    setProductMasterNotice(blockedPermissionMessage);
                    return;
                  }
                  const result = await exportProductMasterPlaceholder(productMasterFilters);
                  setProductMasterNotice(result.message);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export Products
              </button>
              <button
                type="button"
                onClick={() => void openManualProductForm()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                New Product
              </button>
            </div>
          </div>

          {productMasterNotice && (
            <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800 flex items-center justify-between gap-3">
              <span>{productMasterNotice}</span>
              <button type="button" onClick={() => setProductMasterNotice(null)} className="text-orange-800 font-black">CLEAR</button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-2">
            <POMetric label="Total Products" value={productMasterSummary.totalProducts} />
            <POMetric label="Active Products" value={productMasterSummary.activeProducts} />
            <POMetric label="Draft Products" value={productMasterSummary.draftProducts || 0} />
            <POMetric label="Low Stock Products" value={productMasterSummary.lowStockProducts} />
            <POMetric label="Out Of Stock" value={productMasterSummary.outOfStockProducts} />
            <POMetric label="Multi-Location" value={productMasterSummary.multiLocationProducts} />
            <POMetric label="Damaged Holding" value={stockBalanceSummary.totalQtyDamaged} />
            <POMetric label="Return Holding" value={stockBalanceSummary.totalQtyReturnHolding || 0} />
            <POMetric label="In Transit" value={stockBalanceSummary.totalQtyInTransit} />
            <POMetric label="Reorder Required" value={stockBalanceSummary.reorderRequiredLocations || 0} />
          </div>

          <div className="product-master-toolbar">
            <div className="product-master-search-row">
              <div className="product-master-search-box">
                <Search className="w-4 h-4 text-slate-500" />
                <input
                  value={productMasterSearch}
                  onChange={(event) => setProductMasterSearch(event.target.value)}
                  placeholder="Search products by name, SKU, barcode, ALU, brand, supplier, sector, category, make, model, or part number..."
                  className="product-master-search-input"
                />
              </div>
              <button type="button" onClick={() => setProductMasterFilterDrawerOpen(true)} className="product-master-filter-button">
                <Filter className="w-4 h-4" />
                Filters
              </button>
              <button type="button" onClick={() => void applyProductMasterFilters()} className="product-master-apply-button">
                Apply
              </button>
            </div>
          </div>

          {productMasterFilterDrawerOpen && (
            <div className="product-master-drawer-backdrop" onClick={() => setProductMasterFilterDrawerOpen(false)}>
              <aside className="product-master-drawer" onClick={(event) => event.stopPropagation()} aria-label="Product Master filters">
                <div className="product-master-drawer-header">
                  <div>
                    <h3>Advanced Filters</h3>
                    <p>Filter Product Master records without expanding the main list.</p>
                  </div>
                  <button type="button" onClick={() => setProductMasterFilterDrawerOpen(false)} aria-label="Close Product Master filters">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="product-master-drawer-body">
                  <POFilterInput label="SKU" value={productMasterFilters.sku || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, sku: value }))} />
                  <POFilterInput label="Barcode" value={productMasterFilters.barcode || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, barcode: value }))} />
                  <POFilterInput label="ALU" value={productMasterFilters.alu || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, alu: value }))} />
                  <POFilterInput label="Product Name" value={productMasterFilters.productName || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, productName: value }))} />
                  <POFilterInput label="Brand" value={productMasterFilters.brand || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, brand: value }))} />
                  <POFilterInput label="Manufacturer" value={productMasterFilters.manufacturer || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, manufacturer: value }))} />
                  <POFilterInput label="Supplier" value={productMasterFilters.supplier || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, supplier: value }))} />
                  <POFilterInput label="Industrial Sector" value={productMasterFilters.industrialSector || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, industrialSector: value }))} />
                  <POFilterInput label="Category" value={productMasterFilters.category || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, category: value }))} />
                  <POFilterInput label="Subcategory" value={productMasterFilters.subCategory || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, subCategory: value }))} />
                  <POFilterSelect label="Status" value={productMasterFilters.status || 'ALL'} onChange={(value) => setProductMasterFilters((current) => ({ ...current, status: value as ProductMasterFilterState['status'] }))} options={['ALL', 'Draft', 'Active', 'Blocked', 'Inactive', 'Discontinued', 'Pending Review']} />
                  <POFilterSelect label="Risk Status" value={productMasterFilters.riskStatus || 'ALL'} onChange={(value) => setProductMasterFilters((current) => ({ ...current, riskStatus: value as ProductMasterFilterState['riskStatus'] }))} options={['ALL', 'Normal', 'Low Stock', 'Out Of Stock', 'Overstocked', 'No Movement', 'Slow Moving', 'Fast Moving', 'Variance Risk', 'Blocked']} />
                  <POFilterInput label="Branch" value={productMasterFilters.branchId || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, branchId: value }))} />
                  <POFilterInput label="Warehouse" value={productMasterFilters.warehouseId || ''} onChange={(value) => setProductMasterFilters((current) => ({ ...current, warehouseId: value }))} />
                  <POFilterSelect label="Location Type" value={productMasterFilters.locationType || 'ALL'} onChange={(value) => setProductMasterFilters((current) => ({ ...current, locationType: value as ProductMasterFilterState['locationType'] }))} options={['ALL', 'Main Warehouse', 'Branch Warehouse', 'Sales Floor', 'Back Store', 'Shelf', 'Damaged Holding', 'Return Holding', 'Supplier Return Preparation', 'In Transit', 'Quarantine', 'Other']} />
                </div>
                <div className="product-master-drawer-actions">
                  <button type="button" onClick={() => void applyProductMasterFilters()} className="product-master-apply-button">Apply Filters</button>
                  <button type="button" onClick={() => void clearProductMasterFilters()} className="product-master-filter-button"><RotateCcw className="w-4 h-4" /> Clear Filters</button>
                  <button type="button" onClick={() => setProductMasterFilterDrawerOpen(false)} className="product-master-filter-button">Close</button>
                </div>
              </aside>
            </div>
          )}

          <div className="product-master-card">
            <div className="product-master-table-scroll">
              <table className="product-master-table">
                <thead>
                  <tr>
                    {['Product', 'Brand', 'Sector', 'Category', 'Supplier', 'Available', 'On Hand', 'Damaged', 'In Transit', 'Reorder', 'Risk', 'Status', 'Action'].map((header) => (
                      <th key={header} className={['Sector', 'Supplier', 'Damaged', 'In Transit'].includes(header) ? 'product-master-hide-md' : ['Brand', 'Category', 'Reorder'].includes(header) ? 'product-master-hide-sm' : ''}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleProductMasterRows.map((product, rowIndex) => {
                  const rowBalances = allProductBalances.filter((balance) => balance.productId === product.productId);
                  const available = rowBalances.reduce((sum, balance) => sum + balance.qtyAvailable, 0);
                  const onHand = rowBalances.reduce((sum, balance) => sum + balance.qtyOnHand, 0);
                  const damaged = rowBalances.reduce((sum, balance) => sum + balance.qtyDamaged, 0);
                  const inTransit = rowBalances.reduce((sum, balance) => sum + balance.qtyInTransit, 0);
                  const reorderLevel = rowBalances.reduce((sum, balance) => sum + balance.reorderLevel, 0);
                  const metaLine = [product.sku, product.barcode, product.alu].filter(Boolean).join(' / ');
                  return (
                    <tr key={product.productId} onDoubleClick={() => openProductMaster(product)}>
                      <td className="product-master-product-cell">
                        <span>{product.productName}</span>
                        <small>{metaLine || product.productCode}</small>
                      </td>
                      <td className="product-master-hide-sm">{product.brand || product.sectorAttributes.brand || '-'}</td>
                      <td className="product-master-hide-md">{product.industrialSector || product.sectorAttributes.sector}</td>
                      <td className="product-master-hide-sm">{product.productCategory || product.category}</td>
                      <td className="product-master-hide-md">{product.supplierName || product.preferredSupplierName || '-'}</td>
                      <td className="product-master-number">{available}</td>
                      <td className="product-master-number">{onHand}</td>
                      <td className="product-master-number product-master-hide-md">{damaged}</td>
                      <td className="product-master-number product-master-hide-md">{inTransit}</td>
                      <td className="product-master-number product-master-hide-sm">{reorderLevel || product.reorderLevel || 0}</td>
                      <td><span className={`product-master-badge ${product.riskStatus === 'Normal' || product.riskStatus === 'None' ? 'product-master-badge--ok' : 'product-master-badge--warn'}`}>{product.riskStatus}</span></td>
                      <td><span className={`product-master-badge ${productMasterStatusClass(product.productStatus || product.status)}`}>{product.productStatus || product.status}</span></td>
                      <td className="product-master-action-cell">
                        <RowActionMenu
                          ariaLabel={`Actions for ${product.productName}`}
                          open={openProductMasterMenuId === product.productId}
                          align={rowIndex > Math.max(visibleProductMasterRows.length - 4, 0) ? 'top' : 'bottom'}
                          items={productMasterActionItems(product)}
                          onOpenChange={(open) => setOpenProductMasterMenuId(open ? product.productId : null)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {visibleProductMasterRows.length === 0 && (
                  <tr>
                    <td className="product-master-empty" colSpan={13}>No product master rows match the current filters.</td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border border-[#b1b5c2] bg-white">
            <div className="bg-[#252a31] text-white px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-[11px] font-black uppercase">Opening Balance Drafts</h3>
                <p className="text-[9px] text-slate-200 uppercase">Draft and approved opening balances do not change stock until Post Opening Balance is clicked.</p>
              </div>
              <span className="text-[9px] uppercase text-orange-300 font-black">{manualOpeningBalanceDrafts.length} draft row(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#f8fafc] text-[#252a31]">
                  <tr>
                    {['Draft No.', 'Date', 'Product', 'SKU', 'Branch', 'Warehouse', 'Shelf', 'Qty', 'Unit Cost', 'Value Estimate', 'Status', 'Created By', 'Action'].map((header) => (
                      <th key={header} className="p-2 text-left text-[9px] uppercase font-black border-b border-[#d7dce5]">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manualOpeningBalanceDrafts.map((draft) => (
                    <tr key={draft.openingBalanceId} className="border-t border-[#e5e7eb]">
                      <td className="p-2 font-black">{draft.openingBalanceNumber}</td>
                      <td className="p-2">{draft.createdAt.slice(0, 10)}</td>
                      <td className="p-2">{draft.productName}</td>
                      <td className="p-2">{draft.sku}</td>
                      <td className="p-2">{draft.branchId}</td>
                      <td className="p-2">{draft.warehouseId}</td>
                      <td className="p-2">{draft.shelfLocation || '-'}</td>
                      <td className="p-2">{draft.qty}</td>
                      <td className="p-2">{draft.unitCost.toFixed(2)}</td>
                      <td className="p-2">{draft.valueEstimate.toFixed(2)}</td>
                      <td className="p-2"><span className={`px-2 py-1 border text-[8px] font-black uppercase ${draft.status === 'Posted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : draft.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-800 border-orange-200'}`}>{draft.status}</span></td>
                      <td className="p-2">{draft.createdByStaffName}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          <POAction label="View" onClick={() => setProductMasterNotice(`${draft.openingBalanceNumber}: ${draft.productName}, qty ${draft.qty}.`)} />
                          <POAction label="Approve" onClick={() => void handleOpeningBalanceAction(draft, 'approve')} />
                          <POAction label="Post Opening Balance" primary onClick={() => void handleOpeningBalanceAction(draft, 'post')} />
                          <POAction label="Cancel" onClick={() => void handleOpeningBalanceAction(draft, 'cancel')} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {manualOpeningBalanceDrafts.length === 0 && (
                    <tr><td className="p-4 text-slate-600 font-semibold" colSpan={13}>No manual opening balance drafts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedProductMaster && (
            <ProductMasterForm
              product={selectedProductMaster}
              balances={selectedProductBalances}
              barcodes={selectedProductBarcodes}
              prices={selectedProductPrices}
              supplierLinks={selectedProductSupplierLinks}
              reorderRules={selectedProductReorderRules}
              ledgerEntries={selectedProductLedger}
              auditRows={selectedProductAudit}
              onClose={() => setSelectedProductMaster(null)}
              onSave={async (patch) => {
                if (!canPerformAction(simulatedRole, 'productMaster.edit')) {
                  setProductMasterNotice(blockedPermissionMessage);
                  return;
                }
                const updated = await updateProductMasterPlaceholder(selectedProductMaster.productId, patch, staffName);
                if (updated) {
                  setProductMasterNotice('Product Master draft saved.');
                  await refreshProductMaster(productMasterFilters);
                  await openProductMaster(updated);
                }
              }}
              onBlock={async () => {
                if (!canPerformAction(simulatedRole, 'productMaster.block')) {
                  setProductMasterNotice(blockedPermissionMessage);
                  return;
                }
                const updated = await blockProduct(selectedProductMaster.productId, staffName, 'Product blocked from Product Master placeholder.');
                if (updated) {
                  setProductMasterNotice('Product blocked locally.');
                  await refreshProductMaster(productMasterFilters);
                  await openProductMaster(updated);
                }
              }}
              onMarkInactive={async () => {
                if (!canPerformAction(simulatedRole, 'productMaster.edit')) {
                  setProductMasterNotice(blockedPermissionMessage);
                  return;
                }
                const updated = await markProductInactive(selectedProductMaster.productId, staffName, 'Product marked inactive from Product Master placeholder.');
                if (updated) {
                  setProductMasterNotice('Product marked inactive locally.');
                  await refreshProductMaster(productMasterFilters);
                  await openProductMaster(updated);
                }
              }}
              onExport={async () => {
                const result = await exportProductMasterPlaceholder({ ...productMasterFilters, search: selectedProductMaster.sku });
                setProductMasterNotice(result.message);
              }}
            />
          )}

          {manualProductOpen && (
            <ManualProductForm
              draft={manualProductDraft}
              validationIssues={manualProductValidation}
              activity={manualProductActivity}
              openingBalanceDrafts={manualOpeningBalanceDrafts}
              savedProduct={manualSavedProduct}
              duplicateProduct={manualDuplicateProduct}
              notice={manualProductNotice}
              onChange={(patch) => setManualProductDraft((current) => ({ ...current, ...patch }))}
              onSaveDraft={() => void handleManualSaveDraft()}
              onActivate={() => void handleManualActivate()}
              onCreateOpeningBalance={() => void handleManualCreateOpeningBalance()}
              onCheckDuplicate={() => void handleManualDuplicateCheck()}
              onClear={() => {
                setManualProductDraft(emptyManualProductDraft());
                setManualSavedProduct(null);
                setManualDuplicateProduct(null);
                setManualProductValidation([]);
                setManualProductNotice(null);
              }}
              onClose={() => setManualProductOpen(false)}
            />
          )}
        </div>
      )}

      {activeTab === 'Goods Receiving' && (
        <div className="bg-white border border-[#b1b5c2] p-5 space-y-5">
          <div className="flex flex-col lg:flex-row justify-between gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[13px] uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                Goods Receiving
              </span>
              <p className="text-[9.5px] text-slate-700 mt-1 uppercase font-semibold">
                Receive supplier deliveries against Purchase Orders. Stock updates only after GRN is posted.
              </p>
            </div>
            <button
              type="button"
              onClick={openOutstandingPOModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2 self-start"
            >
              <PlusCircle className="w-4 h-4" />
              Load From PO
            </button>
          </div>

          <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
            Draft and pending GRNs do not affect stock. Only posted GRNs update inventory balances and product ledger. GRN captures supplier invoice details for later accounting review, but does not post cashbook, supplier payment, tax payment, or COGS.
          </div>

          {goodsReceivingNotice && (
            <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
              {goodsReceivingNotice}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <POMetric label="Draft GRNs" value={goodsReceivingSummary.draftGRNs} />
            <POMetric label="Pending Approval" value={goodsReceivingSummary.pendingApproval} />
            <POMetric label="Posted Today" value={goodsReceivingSummary.postedToday} />
            <POMetric label="Partial Receipts" value={goodsReceivingSummary.partialReceipts} />
            <POMetric label="GRN Variances" value={goodsReceivingSummary.grnVariances} />
            <POMetric label="Outstanding PO Lines" value={goodsReceivingSummary.outstandingPOLines} />
            <POMetric label="Supplier Invoice Missing" value={goodsReceivingSummary.supplierInvoiceMissing} />
            <POMetric label="Awaiting Stock Posting" value={goodsReceivingSummary.awaitingStockPosting} />
          </div>

          <div className="procurement-toolbar">
            <button type="button" onClick={openOutstandingPOModal} className="procurement-primary-button">
              <PlusCircle className="w-4 h-4" />
              Load From PO
            </button>
            <button type="button" onClick={() => setGoodsReceivingFilterDrawerOpen(true)} className="procurement-secondary-button">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <span>{goodsReceivingNotes.length} GRN records</span>
          </div>

          {goodsReceivingFilterDrawerOpen && (
            <div className="procurement-drawer-backdrop" onClick={() => setGoodsReceivingFilterDrawerOpen(false)}>
              <aside className="procurement-drawer" onClick={(event) => event.stopPropagation()}>
                <div className="procurement-drawer-header"><div><h3>Goods Receiving Filters</h3><p>Analytics stay visible while filters sit in this drawer.</p></div><button type="button" onClick={() => setGoodsReceivingFilterDrawerOpen(false)}><X className="w-4 h-4" /></button></div>
                <div className="procurement-drawer-body">
            <POFilterInput label="GRN Number" value={goodsReceivingFilters.grnNumber || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, grnNumber: value }))} />
            <POFilterInput label="PO Number" value={goodsReceivingFilters.poNumber || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, poNumber: value }))} />
            <POFilterInput label="Supplier" value={goodsReceivingFilters.supplier || ''} onChange={(value) => {
              setGoodsReceivingFilters((prev) => ({ ...prev, supplier: value }));
              setOutstandingPOSupplier(value);
              if (value.trim()) setOutstandingPOModalOpen(true);
            }} />
            <POFilterInput label="Branch" value={goodsReceivingFilters.branch || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, branch: value }))} />
            <POFilterInput label="Warehouse" value={goodsReceivingFilters.warehouse || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, warehouse: value }))} />
            <POFilterSelect label="Status" value={goodsReceivingFilters.status || 'ALL'} options={['ALL', 'Draft', 'Pending Approval', 'Posted', 'Partially Posted', 'Cancelled', 'Rejected', 'Reversed']} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, status: value as GoodsReceivingStatus | 'ALL' }))} />
            <POFilterInput label="Date From" type="date" value={goodsReceivingFilters.dateFrom || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, dateFrom: value }))} />
            <POFilterInput label="Date To" type="date" value={goodsReceivingFilters.dateTo || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, dateTo: value }))} />
            <POFilterSelect label="Variance Type" value={goodsReceivingFilters.varianceType || 'ALL'} options={['ALL', 'None', 'Short', 'Over', 'Cost Increase', 'Cost Decrease', 'Unordered Item', 'Damaged', 'Wrong Product', 'Missing Supplier Invoice']} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, varianceType: value as ReceivingVarianceType | 'ALL' }))} />
            <POFilterInput label="Received By" value={goodsReceivingFilters.receivedBy || ''} onChange={(value) => setGoodsReceivingFilters((prev) => ({ ...prev, receivedBy: value }))} />
                </div>
                <div className="procurement-drawer-actions"><button type="button" onClick={() => void applyGoodsReceivingFilters()}>Apply Filters</button><button type="button" onClick={() => void clearGoodsReceivingFilters()}>Clear Filters</button></div>
              </aside>
            </div>
          )}

          <div className="procurement-table-scroll pos-custom-scroll">
            <table className="procurement-table">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                  <th className="py-2 px-3">GRN Number</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">PO Number</th>
                  <th className="py-2 px-3">Supplier</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3 text-right">Lines</th>
                  <th className="py-2 px-3 text-right">Accepted Qty</th>
                  <th className="py-2 px-3 text-right">Rejected Qty</th>
                  <th className="py-2 px-3">Invoice Number</th>
                  <th className="py-2 px-3 text-right">Invoice Amount</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3">Variance</th>
                  <th className="py-2 px-3">Received By</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {goodsReceivingNotes.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center uppercase font-bold text-slate-500">No GRNs match the current filters.</td>
                  </tr>
                ) : goodsReceivingNotes.map((note) => {
                  const lines = goodsReceivingLineMap[note.grnId] || [];
                  const acceptedQty = lines.reduce((sum, line) => sum + line.qtyAccepted, 0);
                  const rejectedQty = lines.reduce((sum, line) => sum + line.qtyRejected, 0);
                  const varianceText = Array.from(new Set(lines.map((line) => line.varianceType).filter((variance) => variance !== 'None'))).join(', ') || 'None';
                  return (
                    <tr key={note.grnId} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-orange-700">{note.grnNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{note.receivedDate}</td>
                      <td className="py-2 px-3 font-black text-[#1e222b]">{note.poNumber || 'Manual'}</td>
                      <td className="py-2 px-3 uppercase font-extrabold text-[#111827]">{note.supplierName}</td>
                      <td className="py-2 px-3 uppercase">{note.branchId}</td>
                      <td className="py-2 px-3 uppercase">{note.warehouseId}</td>
                      <td className="py-2 px-3 text-right font-bold">{lines.length}</td>
                      <td className="py-2 px-3 text-right font-mono font-black">{acceptedQty}</td>
                      <td className="py-2 px-3 text-right font-mono font-black">{rejectedQty}</td>
                      <td className="py-2 px-3 uppercase">{note.supplierInvoiceNumber || 'Missing'}</td>
                      <td className="py-2 px-3 text-right font-mono font-black">USD {note.supplierInvoiceAmount.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[8px] uppercase tracking-wide rounded-none ${grnStatusClass(note.receivingStatus)}`}>
                          {note.receivingStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 uppercase font-bold">{varianceText}</td>
                      <td className="py-2 px-3 uppercase">{note.receivedByStaffName}</td>
                      <td className="py-2 px-3">
                        <RowActionMenu
                          ariaLabel={`Goods receiving actions for ${note.grnNumber}`}
                          open={openGoodsReceivingMenuId === note.grnId}
                          align="top"
                          items={getGoodsReceivingActionItems(note)}
                          onOpenChange={(open) => setOpenGoodsReceivingMenuId(open ? note.grnId : null)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-[#b1b5c2]">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[9px] uppercase font-black border-b-2 border-orange-500">Purchase Orders Available For Receiving</div>
              <div className="divide-y divide-gray-200 max-h-[260px] overflow-y-auto">
                {purchaseOrders.filter((po) => ['Approved', 'Sent To Supplier', 'Partially Received'].includes(po.status)).map((po) => (
                  <div key={po.poId} className="p-3 flex flex-col md:flex-row justify-between gap-2 text-[9.5px] uppercase">
                    <div>
                      <div className="font-black text-[#1e222b]">{po.poNumber} - {po.supplierName}</div>
                      <div className="text-slate-600 font-semibold">Status: {po.status} | Expected: {po.expectedDeliveryDate}</div>
                    </div>
                    <RowActionMenu
                      ariaLabel={`Receiving actions for ${po.poNumber}`}
                      align="top"
                      items={[
                        { label: 'Create GRN', icon: <PlusCircle className="w-3.5 h-3.5" />, onClick: () => void handleCreateGRNFromPO(po), permissionKey: 'goodsReceiving.create' },
                        { label: 'Keep PO Open', icon: <Clock className="w-3.5 h-3.5" />, onClick: () => void handleKeepPOOpen(po), permissionKey: 'purchaseOrders.receive' },
                        { label: 'Close PO With Outstanding', icon: <Archive className="w-3.5 h-3.5" />, danger: true, onClick: () => void handleClosePOWithOutstanding(po), permissionKey: 'purchaseOrders.cancel' }
                      ]}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-[#b1b5c2]">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[9px] uppercase font-black border-b-2 border-orange-500">Goods Receiving Activity Feed</div>
              <div className="divide-y divide-gray-200 max-h-[260px] overflow-y-auto">
                {goodsReceivingEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="p-3 text-[9.5px] uppercase">
                    <div className="font-black text-[#1e222b]">{(event.grnNumber || event.poNumber || 'GRN')} - {event.eventType.replaceAll('_', ' ')}</div>
                    <div className="text-slate-600 font-semibold">{event.message}</div>
                    <div className="text-[8px] text-slate-400 font-mono mt-1">{event.createdAt} BY {event.operator}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <GoodsReceivingForm
            open={goodsReceivingFormOpen}
            grn={activeGoodsReceivingNote}
            role={simulatedRole}
            staffName={staffName}
            onClose={() => setGoodsReceivingFormOpen(false)}
            onChanged={(message) => {
              setGoodsReceivingNotice(message);
              refreshGoodsReceiving();
            }}
            onPosted={handleGRNPosted}
            onViewLedger={() => setGoodsReceivingNotice('Product Ledger can be opened from the Inventory Product Ledger tab; posted GRN movements are recorded as GOODS_RECEIVED.')}
          />
        </div>
      )}

      {false && activeTab === 'Goods Receiving' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Receiving Form */}
          <form onSubmit={handleGRNSubmit} className="lg:col-span-8 bg-white border border-[#b1b5c2] p-5 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-150 pb-2.5">
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                GOODS RECEIVED NOTE ENTRY FORM (Purchase Discipline)
              </span>
              <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">SYS-REGISTRY ACTIVE</span>
            </div>

            {grnFeedback && (
              <div className={`p-3 border text-[10px] uppercase font-bold flex gap-2 items-center rounded-none ${
                grnFeedback.type === 'error' ? 'bg-red-50 text-red-800 border-red-350 animate-pulse' :
                grnFeedback.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-350' : 'bg-emerald-50 text-emerald-800 border-emerald-350'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{grnFeedback.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">GRN Ref Number</label>
                <input
                  type="text"
                  required
                  value={grnNumber}
                  onChange={(e) => setGrnNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-black text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Supplier Match</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parts Supplier Co"
                  value={grnSupplier}
                  onChange={(e) => setGrnSupplier(e.target.value)}
                  className="w-full bg-white border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-bold text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-amber-600 uppercase block">Supplier Invoice No *</label>
                <input
                  type="text"
                  required
                  placeholder="Invoice Required (*)"
                  value={grnInvoiceNo}
                  onChange={(e) => setGrnInvoiceNo(e.target.value.toUpperCase())}
                  className="w-full bg-white border-2 border-amber-500/55 px-2.5 py-1.5 uppercase font-black text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Purchase Order Ref</label>
                <select
                  value={grnPoRef}
                  onChange={(e) => setGrnPoRef(e.target.value)}
                  className="w-full bg-white border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-bold text-[11px] h-8 cursor-pointer rounded-none outline-none focus:border-orange-500"
                >
                  <option value="">MANUAL PROCUREMENT ENTRY</option>
                  {purchaseOrders.filter(p => p.status !== 'Closed').map(po => (
                    <option key={po.poNumber} value={po.poNumber}>{po.poNumber} ({po.supplierName})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Branch Port</label>
                <input
                  type="text"
                  readOnly
                  value={grnBranch}
                  className="w-full bg-slate-100 border border-gray-300 px-2.5 py-1.5 font-bold text-[11px] rounded-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Warehouse Location</label>
                <input
                  type="text"
                  readOnly
                  value={grnWarehouse}
                  className="w-full bg-slate-100 border border-gray-300 px-2.5 py-1.5 font-bold text-[11px] rounded-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* Product receiving grid */}
            <div className="space-y-2 pt-2">
              <span className="text-[9.5px] font-black uppercase text-[#1e222b] block border-b border-dashed border-gray-200 pb-1">DELIVERED PART LINES CHECK</span>
              <div className="overflow-x-auto pos-custom-scroll">
                <table className="w-full text-[10px] text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-8">
                      <th className="py-1 px-2.5">SKU</th>
                      <th className="py-1 px-2.5">Description</th>
                      <th className="py-1 px-2.5 text-right w-[65px]">Ordered</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Received</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Cost Price (USD)</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Suggested Selling</th>
                      <th className="py-1 px-2.5 text-right w-[65px]">Variance</th>
                      <th className="py-1 px-2.5 text-center">Rule Status</th>
                      <th className="py-1 px-2.5 text-center w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {grnLines.map((line) => {
                      const variance = line.receivedQty - line.orderedQty;
                      const hasVariance = variance !== 0;
                      const isCostSpike = line.status.toLowerCase().includes('spike');
                      const isSellingUnderCost = line.suggestedPrice < line.costPrice;

                      let rowBg = '';
                      if (line.rejected) rowBg = 'bg-red-50/50 line-through text-slate-400';
                      else if (isCostSpike) rowBg = 'bg-orange-50/30';
                      else if (hasVariance) rowBg = 'bg-amber-50/30';

                      return (
                        <tr key={line.sku} className={`h-11 hover:bg-slate-50/70 transition-colors ${rowBg}`}>
                          <td className="py-1 px-2.5 font-bold text-slate-800">{line.sku}</td>
                          <td className="py-1 px-2.5 max-w-[140px] truncate">
                            <span className="uppercase font-extrabold">{line.productName}</span>
                            <div className="text-[7.5px] text-slate-400">Prev Cost: USD {line.prevCostPrice.toFixed(2)}</div>
                          </td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-600">{line.orderedQty}</td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              value={line.receivedQty}
                              onChange={(e) => updateGRNLineField(line.sku, 'receivedQty', parseInt(e.target.value) || 0)}
                              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              step="0.01"
                              value={line.costPrice}
                              onChange={(e) => updateGRNLineField(line.sku, 'costPrice', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              step="0.01"
                              value={line.suggestedPrice}
                              onChange={(e) => updateGRNLineField(line.sku, 'suggestedPrice', parseFloat(e.target.value) || 0)}
                              className={`w-full bg-white text-[#1e222b] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed border ${
                                isSellingUnderCost ? 'border-red-500 font-bold bg-red-100 text-red-900' : 'border-[#b1b5c2]'
                              }`}
                            />
                          </td>
                          <td className="py-1 px-2.5 text-right font-black font-mono">
                            <span className={variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          </td>
                          <td className="py-1 px-2.5 text-center whitespace-nowrap">
                            {line.rejected ? (
                              <span className="bg-red-500 text-white font-black text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide">REJECTED</span>
                            ) : isSellingUnderCost ? (
                              <span className="bg-red-100 text-red-800 border border-red-350 font-black text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide animate-pulse">Selling Under Cost</span>
                            ) : line.status !== 'Matched' ? (
                              <span className="bg-amber-100 text-amber-800 border border-amber-350 font-extrabold text-[7.5px] px-1 py-0.5 uppercase tracking-wide">
                                {line.status.toUpperCase()}
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide">MATCHED</span>
                            )}
                          </td>
                          <td className="py-1 px-2.5">
                            <div className="flex gap-1 justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', false);
                                  updateGRNLineField(line.sku, 'flagged', false);
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  !line.rejected && !line.flagged ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', false);
                                  updateGRNLineField(line.sku, 'flagged', true);
                                  triggerNewActivityEvent('STOCKTAKE_SUBMITTED', `Variance manually flagged on intake for line ${line.sku}`, 'Medium');
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  line.flagged ? 'border-amber-500 text-amber-700 font-bold bg-amber-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Flag
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', true);
                                  updateGRNLineField(line.sku, 'flagged', false);
                                  triggerNewActivityEvent('STOCK_TRANSFERRED', `Deliverable line rejected dynamically: SKU ${line.sku}`, 'High');
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  line.rejected ? 'border-red-500 text-red-650 font-bold bg-red-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase block">Receiving Notes / Discrepancy Remarks</label>
              <textarea
                rows={2}
                value={grnNotes}
                onChange={(e) => setGrnNotes(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none outline-none font-sans uppercase font-bold"
                placeholder="e.g. Supplier shorted brake pads on physical count. Logged for variance tracking."
              />
            </div>

            <div className="flex justify-between items-center bg-slate-50 border-t border-gray-150 p-4">
              <div className="text-[9px] text-slate-500 font-black uppercase">
                STRICT DISCIPLINE: DELIVERIES PASS PRICE & QTY CHECKS
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10.5px] cursor-pointer rounded-none tracking-wider border border-orange-700 transition-colors"
              >
                Submit Goods Received Note
              </button>
            </div>

          </form>

          {/* Side panel with informational details */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border-2 border-[#1e222b] p-4.5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
                <Shield className="w-5 h-5 text-orange-500 shrink-0" />
                <span className="font-extrabold text-[10px] uppercase text-[#1e222b] tracking-wider">PURCHASE DISCIPLINE DIRECTIVES</span>
              </div>
              
              <ul className="space-y-2.5 text-[9.5px] text-slate-600 uppercase list-none pl-0">
                <li className="flex gap-2 items-start">
                  <span className="bg-orange-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 1</span>
                  <span>Invoice matching is mandatory. GRN submissions block if empty.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-orange-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 2</span>
                  <span>Suggested selling price below cost price is mathematically blocked.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-[#1e222b] text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 3</span>
                  <span>Variances trigger warnings. GRN routes to Supervisor Approval.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-[#1e222b] text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 4</span>
                  <span>Cost Spike increase &gt; 15% requires Manager validation.</span>
                </li>
              </ul>

              <div className="bg-slate-50 border border-gray-200 p-3 mt-4 text-[9px] font-mono text-slate-500 uppercase leading-snug">
                <strong>Database Sync Engine:</strong> Local browser persistent memory acts as staging store. Approval clearing triggers atomic catalog writes.
              </div>
            </div>
          </div>

        </div>
      )}


      {activeTab === 'Purchase Orders' && (
        <div className="bg-white border border-[#b1b5c2] p-5 space-y-5">
          <div className="flex flex-col lg:flex-row justify-between gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[13px] uppercase flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Purchase Orders
              </span>
              <p className="text-[9.5px] text-slate-700 mt-1 uppercase font-semibold">
                Procurement memo documents for supplier ordering. Stock is only updated after Goods Receiving.
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPurchaseOrderForm()}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2 self-start"
            >
              <PlusCircle className="w-4 h-4" />
              New PO Memo
            </button>
          </div>

          <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
            Purchase Orders do not post stock or accounting until goods are received. They do not affect cashbook, COGS, supplier liability, inventory asset value, sales, tax ledger or EOD financial totals.
          </div>

          {poFeedback && (
            <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
              {poFeedback}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
            <POMetric label="Total POs" value={purchaseOrderSummary.totalPOs} />
            <POMetric label="Draft POs" value={purchaseOrderSummary.draftPOs} />
            <POMetric label="Pending Approval" value={purchaseOrderSummary.pendingApproval} />
            <POMetric label="Approved" value={purchaseOrderSummary.approved} />
            <POMetric label="Sent To Supplier" value={purchaseOrderSummary.sentToSupplier} />
            <POMetric label="Partially Received" value={purchaseOrderSummary.partiallyReceived} />
            <POMetric label="Fully Received" value={purchaseOrderSummary.fullyReceived} />
            <POMetric label="Cancelled" value={purchaseOrderSummary.cancelled} />
            <POMetric label="Estimated PO Value" value={`USD ${purchaseOrderSummary.estimatedPOValue.toFixed(2)}`} />
            <POMetric label="Outstanding Qty" value={purchaseOrderSummary.outstandingQty} />
          </div>

          <div className="procurement-toolbar">
            <button type="button" onClick={() => setPurchaseOrderFilterDrawerOpen(true)} className="procurement-secondary-button">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <span>{purchaseOrders.length} purchase order records</span>
          </div>

          {purchaseOrderFilterDrawerOpen && (
            <div className="procurement-drawer-backdrop" onClick={() => setPurchaseOrderFilterDrawerOpen(false)}>
              <aside className="procurement-drawer" onClick={(event) => event.stopPropagation()}>
                <div className="procurement-drawer-header"><div><h3>Purchase Order Filters</h3><p>Filter procurement memo documents without hiding analytics.</p></div><button type="button" onClick={() => setPurchaseOrderFilterDrawerOpen(false)}><X className="w-4 h-4" /></button></div>
                <div className="procurement-drawer-body">
            <POFilterInput label="PO Number" value={purchaseOrderFilters.poNumber || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, poNumber: value }))} />
            <POFilterInput label="Supplier" value={purchaseOrderFilters.supplier || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, supplier: value }))} />
            <POFilterInput label="Branch" value={purchaseOrderFilters.branch || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, branch: value }))} />
            <POFilterInput label="Warehouse" value={purchaseOrderFilters.warehouse || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, warehouse: value }))} />
            <POFilterSelect label="Status" value={purchaseOrderFilters.status || 'ALL'} options={['ALL', 'Draft', 'Pending Approval', 'Approved', 'Sent To Supplier', 'Partially Received', 'Fully Received', 'Cancelled', 'Closed', 'Closed With Outstanding']} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, status: value as PurchaseOrderStatus | 'ALL' }))} />
            <POFilterSelect label="Priority" value={purchaseOrderFilters.priority || 'ALL'} options={['ALL', 'Low', 'Normal', 'High', 'Urgent']} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, priority: value as PurchaseOrderPriority | 'ALL' }))} />
            <POFilterSelect label="Source" value={purchaseOrderFilters.source || 'ALL'} options={['ALL', 'Manual', 'Low Stock Recommendation', 'Stock Health Recommendation', 'Supplier Reorder', 'Import Draft', 'Owner Request']} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, source: value as PurchaseOrderSource | 'ALL' }))} />
            <POFilterInput label="Date From" type="date" value={purchaseOrderFilters.dateFrom || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, dateFrom: value }))} />
            <POFilterInput label="Date To" type="date" value={purchaseOrderFilters.dateTo || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, dateTo: value }))} />
            <POFilterInput label="Expected Delivery From" type="date" value={purchaseOrderFilters.expectedDeliveryFrom || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, expectedDeliveryFrom: value }))} />
            <POFilterInput label="Expected Delivery To" type="date" value={purchaseOrderFilters.expectedDeliveryTo || ''} onChange={(value) => setPurchaseOrderFilters((prev) => ({ ...prev, expectedDeliveryTo: value }))} />
                </div>
                <div className="procurement-drawer-actions"><button type="button" onClick={() => void applyPurchaseOrderFilters()}>Apply Filters</button><button type="button" onClick={() => void clearPurchaseOrderFilters()}>Clear Filters</button></div>
              </aside>
            </div>
          )}

          <div className="procurement-table-scroll pos-custom-scroll">
            <table className="procurement-table">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                  <th className="py-2 px-3">PO Number</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Supplier</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3">Priority</th>
                  <th className="py-2 px-3 text-right">Lines</th>
                  <th className="py-2 px-3 text-right">Estimated Total</th>
                  <th className="py-2 px-3">Expected Delivery</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3">Requested By</th>
                  <th className="py-2 px-3">Approved By</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-8 text-center uppercase font-bold text-slate-500">No Purchase Orders match the current filters.</td>
                  </tr>
                ) : purchaseOrders.map((po) => {
                  const lines = purchaseOrderLines[po.poId] || [];
                  const canReceive = ['Approved', 'Sent To Supplier', 'Partially Received'].includes(po.status);
                  return (
                    <tr key={po.poId} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-orange-700">{po.poNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{po.poDate}</td>
                      <td className="py-2 px-3 uppercase font-extrabold text-[#111827]">{po.supplierName}</td>
                      <td className="py-2 px-3 uppercase">{po.branchId}</td>
                      <td className="py-2 px-3 uppercase">{po.warehouseId}</td>
                      <td className="py-2 px-3 uppercase font-black">{po.priority}</td>
                      <td className="py-2 px-3 text-right font-bold">{lines.length}</td>
                      <td className="py-2 px-3 text-right font-black font-mono">{po.currency} {po.grandTotalEstimate.toFixed(2)}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{po.expectedDeliveryDate || 'N/A'}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[8px] uppercase tracking-wide rounded-none ${poStatusClass(po.status)}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 uppercase">{po.requestedByStaffName}</td>
                      <td className="py-2 px-3 uppercase">{po.approvedByStaffName || 'N/A'}</td>
                      <td className="py-2 px-3">
                        <RowActionMenu
                          ariaLabel={`Purchase order actions for ${po.poNumber}`}
                          open={openPurchaseOrderMenuId === po.poId}
                          align="top"
                          items={getPurchaseOrderActionItems(po)}
                          onOpenChange={(open) => setOpenPurchaseOrderMenuId(open ? po.poId : null)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border border-[#b1b5c2]">
            <div className="bg-[#1e222b] text-white px-3 py-2 text-[9px] uppercase font-black border-b-2 border-orange-500">
              Purchase Order Activity Feed
            </div>
            <div className="divide-y divide-gray-200 max-h-[220px] overflow-y-auto">
              {purchaseOrderEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="p-3 text-[9.5px] uppercase">
                  <div className="font-black text-[#1e222b]">{event.poNumber} - {event.eventType.replaceAll('_', ' ')}</div>
                  <div className="text-slate-600 font-semibold">{event.message}</div>
                  <div className="text-[8px] text-slate-400 font-mono mt-1">{event.createdAt} BY {event.operator}</div>
                </div>
              ))}
            </div>
          </div>

          <PurchaseOrderForm
            open={poFormOpen}
            order={poFormOrder}
            lines={poFormLines}
            products={localStock}
            staffName={staffName}
            staffId={staffName}
            role={simulatedRole}
            activeBranch={activeBranch}
            onClose={() => setPoFormOpen(false)}
            onChanged={(message) => {
              setPoFeedback(message);
              refreshPurchaseOrders();
            }}
          />
        </div>
      )}


      {activeTab === 'Supplier Returns' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b-2 border-[#1e222b] pb-3">
            <div>
              <h2 className="text-[18px] uppercase font-black text-[#1e222b] tracking-tight">Supplier Returns</h2>
              <p className="text-[10px] uppercase font-bold text-slate-600 mt-1">Return damaged, wrong, rejected, or over-supplied goods to suppliers.</p>
            </div>
            <button
              type="button"
              onClick={openSupplierGRNModal}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none"
            >
              Create From Posted GRN
            </button>
          </div>

          <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
            Supplier Returns only reduce stock when the returned goods were already posted into inventory. Rejected-not-stocked goods are recorded with no stock movement. No cashbook, supplier payment, sales or COGS posting is created.
          </div>

          {supplierReturnNotice && (
            <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
              {supplierReturnNotice}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
            <POMetric label="Draft Returns" value={supplierReturnSummary.draftReturns} />
            <POMetric label="Pending Approval" value={supplierReturnSummary.pendingApproval} />
            <POMetric label="Posted Returns" value={supplierReturnSummary.postedReturns} />
            <POMetric label="Dispatched" value={supplierReturnSummary.dispatched} />
            <POMetric label="Credit Notes Pending" value={supplierReturnSummary.creditNotesPending} />
            <POMetric label="Replacements Pending" value={supplierReturnSummary.replacementsPending} />
            <POMetric label="Supplier Rejected" value={supplierReturnSummary.supplierRejected} />
            <POMetric label="Closed Returns" value={supplierReturnSummary.closedReturns} />
            <POMetric label="Return Qty" value={supplierReturnSummary.returnQty} />
            <POMetric label="Return Value Estimate" value={`USD ${supplierReturnSummary.returnValueEstimate.toFixed(2)}`} />
          </div>

          <div className="procurement-toolbar">
            <button type="button" onClick={openSupplierGRNModal} className="procurement-primary-button">
              <PlusCircle className="w-4 h-4" />
              Create From Posted GRN
            </button>
            <button type="button" onClick={() => setSupplierReturnFilterDrawerOpen(true)} className="procurement-secondary-button">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <span>{supplierReturnRecords.length} supplier return records</span>
          </div>

          {supplierReturnFilterDrawerOpen && (
            <div className="procurement-drawer-backdrop" onClick={() => setSupplierReturnFilterDrawerOpen(false)}>
              <aside className="procurement-drawer" onClick={(event) => event.stopPropagation()}>
                <div className="procurement-drawer-header"><div><h3>Supplier Return Filters</h3><p>Filter return records while summary analytics remain visible.</p></div><button type="button" onClick={() => setSupplierReturnFilterDrawerOpen(false)}><X className="w-4 h-4" /></button></div>
                <div className="procurement-drawer-body">
            <POFilterInput label="Supplier Return Number" value={supplierReturnFilters.supplierReturnNumber || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, supplierReturnNumber: value }))} />
            <POFilterInput label="Supplier" value={supplierReturnFilters.supplier || ''} onChange={(value) => {
              setSupplierReturnFilters((prev) => ({ ...prev, supplier: value }));
              setSupplierGRNSupplier(value);
              if (value.trim()) setSupplierGRNModalOpen(true);
            }} />
            <POFilterInput label="PO Number" value={supplierReturnFilters.poNumber || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, poNumber: value }))} />
            <POFilterInput label="GRN Number" value={supplierReturnFilters.grnNumber || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, grnNumber: value }))} />
            <POFilterInput label="Branch" value={supplierReturnFilters.branch || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, branch: value }))} />
            <POFilterInput label="Warehouse" value={supplierReturnFilters.warehouse || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, warehouse: value }))} />
            <POFilterSelect label="Status" value={supplierReturnFilters.status || 'ALL'} options={['ALL', 'Draft', 'Pending Approval', 'Approved', 'Posted', 'Dispatched To Supplier', 'Supplier Accepted', 'Supplier Rejected', 'Credit Note Pending', 'Credit Note Received', 'Replacement Pending', 'Replacement Received', 'Cancelled', 'Closed']} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, status: value as SupplierReturnStatus | 'ALL' }))} />
            <POFilterSelect label="Reason" value={supplierReturnFilters.reason || 'ALL'} options={['ALL', 'Damaged', 'Wrong Product', 'Over Supplied', 'Quality Issue', 'Expired', 'Supplier Recall', 'Duplicate Supply', 'Price Dispute', 'Not Ordered', 'Other']} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, reason: value as SupplierReturnReason | 'ALL' }))} />
            <POFilterSelect label="Resolution" value={supplierReturnFilters.resolution || 'ALL'} options={['ALL', 'Credit Note Expected', 'Replacement Expected', 'Supplier Refund Expected', 'No Credit', 'Internal Write Off Review', 'Pending Supplier Decision']} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, resolution: value as SupplierReturnResolution | 'ALL' }))} />
            <POFilterInput label="Date From" type="date" value={supplierReturnFilters.dateFrom || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, dateFrom: value }))} />
            <POFilterInput label="Date To" type="date" value={supplierReturnFilters.dateTo || ''} onChange={(value) => setSupplierReturnFilters((prev) => ({ ...prev, dateTo: value }))} />
                </div>
                <div className="procurement-drawer-actions"><button type="button" onClick={() => void applySupplierReturnFilters()}>Apply Filters</button><button type="button" onClick={() => void clearSupplierReturnFilters()}>Clear Filters</button></div>
              </aside>
            </div>
          )}

          <div className="procurement-table-scroll pos-custom-scroll">
            <table className="procurement-table">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                  <th className="py-2 px-3">Return No.</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Supplier</th>
                  <th className="py-2 px-3">GRN No.</th>
                  <th className="py-2 px-3">PO No.</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3 text-right">Lines</th>
                  <th className="py-2 px-3 text-right">Return Qty</th>
                  <th className="py-2 px-3 text-right">Estimated Value</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Resolution</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3">Requested By</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {supplierReturnRecords.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-8 text-center uppercase font-bold text-slate-500">No Supplier Returns match the current filters.</td>
                  </tr>
                ) : supplierReturnRecords.map((record) => {
                  const lines = supplierReturnLineMap[record.supplierReturnId] || [];
                  const returnQty = lines.reduce((sum, line) => sum + line.qtyReturnApproved, 0);
                  const value = lines.reduce((sum, line) => sum + line.lineTotal, 0);
                  const editableReturn = record.status === 'Draft';
                  const terminalReturn = record.status === 'Closed' || record.status === 'Cancelled';
                  return (
                    <tr key={record.supplierReturnId} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-orange-700">{record.supplierReturnNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{record.returnDate}</td>
                      <td className="py-2 px-3 uppercase font-extrabold text-[#111827]">{record.supplierName}</td>
                      <td className="py-2 px-3 font-mono">{record.grnNumber || 'N/A'}</td>
                      <td className="py-2 px-3 font-mono">{record.poNumber || 'N/A'}</td>
                      <td className="py-2 px-3 uppercase">{record.branchId}</td>
                      <td className="py-2 px-3 uppercase">{record.warehouseId}</td>
                      <td className="py-2 px-3 text-right font-bold">{lines.length}</td>
                      <td className="py-2 px-3 text-right font-black font-mono">{returnQty}</td>
                      <td className="py-2 px-3 text-right font-black font-mono">USD {value.toFixed(2)}</td>
                      <td className="py-2 px-3 uppercase font-black text-[8.5px]">{record.reason}</td>
                      <td className="py-2 px-3 uppercase font-semibold text-[8.5px]">{record.resolution}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[8px] uppercase tracking-wide rounded-none ${supplierReturnStatusClass(record.status)}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 uppercase">{record.requestedByStaffName}</td>
                      <td className="py-2 px-3">
                        <RowActionMenu
                          ariaLabel={`Supplier return actions for ${record.supplierReturnNumber}`}
                          open={openSupplierReturnMenuId === record.supplierReturnId}
                          align="top"
                          items={getSupplierReturnActionItems(record)}
                          onOpenChange={(open) => setOpenSupplierReturnMenuId(open ? record.supplierReturnId : null)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border border-[#b1b5c2]">
            <div className="bg-[#1e222b] text-white px-3 py-2 text-[9px] uppercase font-black border-b-2 border-orange-500">
              Supplier Return Activity Feed
            </div>
            <div className="divide-y divide-gray-200 max-h-[220px] overflow-y-auto">
              {supplierReturnEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="p-3 text-[9.5px] uppercase">
                  <div className="font-black text-[#1e222b]">{event.supplierReturnNumber} - {event.eventType.replaceAll('_', ' ')}</div>
                  <div className="text-slate-600 font-semibold">{event.message}</div>
                  <div className="text-[8px] text-slate-400 font-mono mt-1">{event.createdAt} BY {event.operator}</div>
                </div>
              ))}
            </div>
          </div>

          <SupplierReturnForm
            open={supplierReturnFormOpen}
            supplierReturn={activeSupplierReturn}
            role={simulatedRole}
            staffName={staffName}
            onClose={() => setSupplierReturnFormOpen(false)}
            onChanged={(message) => {
              setSupplierReturnNotice(message);
              refreshSupplierReturns();
            }}
            onPosted={handleSupplierReturnPosted}
            onViewGRN={(grnId) => {
              const note = goodsReceivingNotes.find((item) => item.grnId === grnId);
              if (note) {
                setActiveGoodsReceivingNote(note);
                setGoodsReceivingFormOpen(true);
              } else {
                setSupplierReturnNotice('GRN record is not currently loaded.');
              }
            }}
            onViewLedger={() => setSupplierReturnNotice('Product Ledger can be opened from the Inventory Product Ledger tab; posted Supplier Return movements are recorded as SUPPLIER_RETURN.')}
          />
        </div>
      )}

      {false && activeTab === 'Supplier Returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Create Supplier Return Form */}
          <form onSubmit={handleSupplierReturnSubmit} className="lg:col-span-4 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <ArrowRightLeft className="w-4 h-4 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase text-[#1e222b] tracking-widest">SUBMIT SUPPLIER RETURN</span>
            </div>

            {retFeedback && (
              <div className="p-2.5 bg-sky-50 text-sky-900 border border-sky-200 font-bold uppercase text-[9.5px] rounded-none">
                {retFeedback}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Supplier Name</label>
              <select
                value={retSupplier}
                onChange={(e) => setRetSupplier(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="">Select supplier</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Original GRN Ref</label>
              <input
                type="text"
                required
                placeholder="e.g. GRN-2026-904"
                value={retGrn}
                onChange={(e) => setGrnPoRef(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 font-bold uppercase text-[10.5px] rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Material SKU</label>
              <select
                value={retSku}
                onChange={(e) => setRetSku(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                {localStock.map(p => (
                  <option key={p.id} value={p.code}>[{p.code}] {p.name} (Hold: {p.stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Quantity to Return</label>
              <input
                type="number"
                min={1}
                required
                value={retQty}
                onChange={(e) => setRetQty(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1 text-right font-black text-[11px] rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Reason of Return</label>
              <select
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Wrong item supplied">Wrong item supplied</option>
                <option value="Damaged item">Damaged item</option>
                <option value="Short expiry">Short expiry</option>
                <option value="Warranty claim">Warranty claim</option>
                <option value="Over supplied">Over supplied</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Condition Check</label>
              <select
                value={retCondition}
                onChange={(e) => setRetCondition(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Resellable">Resellable</option>
                <option value="Damaged">Damaged/Leaking</option>
                <option value="Repair needed">Repair required</option>
                <option value="Scrap">Scrap Metal</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer rounded-none"
            >
              Post Supplier Return
            </button>
          </form>

          {/* Supplier Returns List Table */}
          <div className="lg:col-span-8 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-150 pb-2">
              <span className="font-extrabold text-[#111827] text-[11px] uppercase">REGISTRY: SUPPLIER RETURNS DISPATCH LEDGER</span>
              <span className="text-[8.5px] font-black bg-amber-500/10 text-[#f97316] border border-[#f97316]/20 px-2 py-0.2">STAGE RECORD</span>
            </div>

            <div className="overflow-x-auto pos-custom-scroll">
              <table className="w-full text-[10px] text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-8 select-none">
                    <th className="py-1 px-2.5">Return ID</th>
                    <th className="py-1 px-2.5">Supplier</th>
                    <th className="py-1 px-2.5">Original GRN</th>
                    <th className="py-1 px-2.5">SKU / Item</th>
                    <th className="py-1 px-2.5 text-right">Qty</th>
                    <th className="py-1 px-2.5">Reason</th>
                    <th className="py-1 px-2.5 text-center">Dispatch Status</th>
                    <th className="py-1 px-2.5 text-center w-[150px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {supplierReturns.map((ret) => {
                    let badgeBg = 'bg-gray-100 text-slate-700';
                    if (ret.status === 'Draft') badgeBg = 'bg-yellow-50 text-amber-800 border border-amber-250 font-bold';
                    else if (ret.status === 'Shipped') badgeBg = 'bg-sky-50 text-indigo-805 border border-indigo-250 font-extrabold';
                    else if (ret.status === 'Credited') badgeBg = 'bg-emerald-50 text-green-800 border border-emerald-300 font-bold';

                    return (
                      <tr key={ret.id} className="hover:bg-slate-50 transition-colors h-11">
                        <td className="py-2 px-2.5 font-bold text-slate-800">{ret.id}</td>
                        <td className="py-2 px-2.5 uppercase font-bold text-slate-700">{ret.supplierName}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-500">{ret.originalGrn}</td>
                        <td className="py-2 px-2.5">
                          <span className="font-bold text-[#1e222b]">{ret.sku}</span>
                          <span className="text-[8px] text-slate-400 block truncate max-w-[120px] uppercase">{ret.productName}</span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-black font-mono text-slate-800">{ret.quantityReturned}</td>
                        <td className="py-2 px-2.5 uppercase text-[8.5px] text-slate-500">{ret.reason} / {ret.condition}</td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.2 text-[8px] uppercase tracking-wide rounded-none ${badgeBg}`}>
                            {ret.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex justify-center gap-1">
                            {ret.status === 'Draft' && (
                              <button
                                onClick={() => handleShipAndDeductStock(ret)}
                                className="px-2 py-0.5 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                title="Ship from warehouse and deduct stock"
                              >
                                Ship Out
                              </button>
                            )}

                            {ret.status === 'Shipped' && (
                              <button
                                onClick={() => handleCompleteCredit(ret.id)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                title="Acknowledge supplier credit note received"
                              >
                                Clear Credit
                              </button>
                            )}
                            
                            <span className="text-slate-400 text-[8px] font-mono select-none">ID: {ret.requestedBy}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}


      {activeTab === 'Stock Adjustments' && (
        <div className="space-y-5">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 border-b-2 border-[#1e222b] pb-3">
            <div>
              <h2 className="text-[18px] uppercase font-black text-[#1e222b] tracking-tight">Stock Adjustments</h2>
              <p className="text-[10px] uppercase font-bold text-slate-600 mt-1">Controlled stock corrections with approval, posting, and product ledger audit.</p>
            </div>
            <button type="button" onClick={() => openStockAdjustmentForm(null)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none">
              New Stock Adjustment
            </button>
          </div>

          <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
            Draft and pending adjustments do not affect stock. Only posted adjustments update inventory balances. Stock adjustments do not post cashbook, supplier payment, bank or tax entries.
          </div>

          {stockAdjustmentNotice && (
            <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{stockAdjustmentNotice}</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
            <POMetric label="Draft Adjustments" value={stockAdjustmentSummary.draftAdjustments} />
            <POMetric label="Pending Approval" value={stockAdjustmentSummary.pendingApproval} />
            <POMetric label="Approved" value={stockAdjustmentSummary.approved} />
            <POMetric label="Posted Today" value={stockAdjustmentSummary.postedToday} />
            <POMetric label="High Risk" value={stockAdjustmentSummary.highRisk} />
            <POMetric label="Critical" value={stockAdjustmentSummary.critical} />
            <POMetric label="Positive Adjustments" value={stockAdjustmentSummary.positiveAdjustments} />
            <POMetric label="Negative Adjustments" value={stockAdjustmentSummary.negativeAdjustments} />
            <POMetric label="Write Off Value" value={`USD ${stockAdjustmentSummary.writeOffValue.toFixed(2)}`} />
            <POMetric label="Awaiting Owner Review" value={stockAdjustmentSummary.awaitingOwnerReview} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
            <POFilterInput label="Adjustment Number" value={stockAdjustmentFilters.adjustmentNumber || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, adjustmentNumber: value }))} />
            <POFilterInput label="Product" value={stockAdjustmentFilters.product || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, product: value }))} />
            <POFilterInput label="SKU" value={stockAdjustmentFilters.sku || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, sku: value }))} />
            <POFilterInput label="Branch" value={stockAdjustmentFilters.branch || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, branch: value }))} />
            <POFilterInput label="Warehouse" value={stockAdjustmentFilters.warehouse || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, warehouse: value }))} />
            <POFilterSelect label="Status" value={stockAdjustmentFilters.status || 'ALL'} options={['ALL', 'Draft', 'Pending Approval', 'Approved', 'Posted', 'Rejected', 'Cancelled', 'Reversed']} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, status: value as StockAdjustmentStatus | 'ALL' }))} />
            <POFilterSelect label="Reason" value={stockAdjustmentFilters.reason || 'ALL'} options={['ALL', 'Opening Balance', 'Physical Count Correction', 'Damaged Stock', 'Expired Stock', 'Theft / Loss', 'Internal Use', 'Data Correction', 'Supplier Correction', 'Customer Return Correction', 'Branch Transfer Correction', 'Write Off', 'Other']} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, reason: value as StockAdjustmentReason | 'ALL' }))} />
            <POFilterSelect label="Risk Level" value={stockAdjustmentFilters.riskLevel || 'ALL'} options={['ALL', 'Low', 'Medium', 'High', 'Critical']} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, riskLevel: value as StockAdjustmentRiskLevel | 'ALL' }))} />
            <POFilterInput label="Requested By" value={stockAdjustmentFilters.requestedBy || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, requestedBy: value }))} />
            <POFilterInput label="Date From" type="date" value={stockAdjustmentFilters.dateFrom || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, dateFrom: value }))} />
            <POFilterInput label="Date To" type="date" value={stockAdjustmentFilters.dateTo || ''} onChange={(value) => setStockAdjustmentFilters((prev) => ({ ...prev, dateTo: value }))} />
            <button type="button" onClick={() => refreshStockAdjustments(stockAdjustmentFilters)} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[9px] rounded-none self-end">Apply Filters</button>
            <button type="button" onClick={() => { const reset = { status: 'ALL' as const, reason: 'ALL' as const, riskLevel: 'ALL' as const }; setStockAdjustmentFilters(reset); refreshStockAdjustments(reset); }} className="px-3 py-2 bg-white text-[#1e222b] border border-[#b1b5c2] font-black uppercase text-[9px] rounded-none self-end">Clear Filters</button>
          </div>

          <div className="stock-adjustment-table-scroll pos-custom-scroll">
            <table className="w-full min-w-[1280px] text-[10px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                  <th className="py-2 px-3">Adjustment No.</th>
                  <th className="py-2 px-3">Date</th>
                  <th className="py-2 px-3">Branch</th>
                  <th className="py-2 px-3">Warehouse</th>
                  <th className="py-2 px-3 text-right">Lines</th>
                  <th className="py-2 px-3">Reason</th>
                  <th className="py-2 px-3">Risk</th>
                  <th className="py-2 px-3 text-right">Value Impact</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3">Requested By</th>
                  <th className="py-2 px-3">Approved By</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockAdjustmentRecords.length === 0 ? (
                  <tr><td colSpan={12} className="py-8 text-center uppercase font-bold text-slate-500">No Stock Adjustments match the current filters.</td></tr>
                ) : stockAdjustmentRecords.map((record, index) => {
                  const lines = stockAdjustmentLineMap[record.adjustmentId] || [];
                  const valueImpact = lines.reduce((sum, line) => sum + line.valueImpact, 0);
                  return (
                    <tr key={record.adjustmentId} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-orange-700">{record.adjustmentNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{record.adjustmentDate}</td>
                      <td className="py-2 px-3 uppercase">{record.branchId}</td>
                      <td className="py-2 px-3 uppercase">{record.warehouseId}</td>
                      <td className="py-2 px-3 text-right font-bold">{lines.length}</td>
                      <td className="py-2 px-3 uppercase font-black text-[8.5px]">{record.reason}</td>
                      <td className="py-2 px-3 uppercase font-black">{record.riskLevel}</td>
                      <td className={`py-2 px-3 text-right font-black font-mono ${valueImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>USD {valueImpact.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap"><span className={`inline-block px-2 py-0.5 text-[8px] uppercase tracking-wide rounded-none ${stockAdjustmentStatusClass(record.status)}`}>{record.status}</span></td>
                      <td className="py-2 px-3 uppercase">{record.requestedByStaffName}</td>
                      <td className="py-2 px-3 uppercase">{record.approvedByStaffName || 'N/A'}</td>
                      <td className="py-2 px-3 text-center">
                        <RowActionMenu
                          ariaLabel="Stock adjustment actions"
                          open={openStockAdjustmentMenuId === record.adjustmentId}
                          align={index > Math.max(stockAdjustmentRecords.length - 4, 0) ? 'top' : 'bottom'}
                          items={getStockAdjustmentActionItems(record)}
                          onOpenChange={(open) => setOpenStockAdjustmentMenuId(open ? record.adjustmentId : null)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border border-[#b1b5c2]">
            <div className="bg-[#1e222b] text-white px-3 py-2 text-[9px] uppercase font-black border-b-2 border-orange-500">Stock Adjustment Activity Feed</div>
            <div className="divide-y divide-gray-200 max-h-[220px] overflow-y-auto">
              {stockAdjustmentEvents.slice(0, 8).map((event) => (
                <div key={event.id} className="p-3 text-[9.5px] uppercase">
                  <div className="font-black text-[#1e222b]">{event.adjustmentNumber} - {event.eventType.replaceAll('_', ' ')}</div>
                  <div className="text-slate-600 font-semibold">{event.message}</div>
                  <div className="text-[8px] text-slate-400 font-mono mt-1">{event.createdAt} BY {event.operator}</div>
                </div>
              ))}
            </div>
          </div>

          <StockAdjustmentForm
            open={stockAdjustmentFormOpen}
            adjustment={activeStockAdjustment}
            products={localStock}
            role={simulatedRole}
            staffName={staffName}
            activeBranch={activeBranch}
            onClose={() => setStockAdjustmentFormOpen(false)}
            onChanged={(message) => {
              setStockAdjustmentNotice(message);
              refreshStockAdjustments();
            }}
            onPosted={handleStockAdjustmentPosted}
            onViewLedger={() => setStockAdjustmentNotice('Product Ledger can be opened from the Inventory Product Ledger tab; posted adjustment movements are recorded as STOCK_ADJUSTMENT_IN or STOCK_ADJUSTMENT_OUT.')}
          />
        </div>
      )}

      {false && activeTab === 'Stock Adjustments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main adjustment request form */}
          <form onSubmit={handleAdjustmentSubmit} className="lg:col-span-5 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <Sliders className="w-5 h-5 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase text-[#1e222b] tracking-wider">STOCK QUANTITY CORRECTION GATE</span>
            </div>

            {adjFeedback && (
              <div className={`p-3 border text-[10px] uppercase font-bold flex gap-2 items-center rounded-none ${
                adjFeedback.type === 'error' ? 'bg-red-50 text-red-800 border-red-350' :
                adjFeedback.type === 'warning' ? 'bg-amber-50 text-amber-805 border-amber-350' : 'bg-emerald-50 text-emerald-800 border-emerald-350'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjFeedback.msg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Target Catalog SKU</label>
              <select
                value={adjSku}
                onChange={(e) => setAdjSku(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                {localStock.map(p => (
                  <option key={p.id} value={p.code}>[{p.code}] {p.name} (Hold: {p.stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Quantities Operational Vector</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjType('ADD')}
                  className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1 cursor-pointer ${
                    adjType === 'ADD'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-extrabold'
                      : 'bg-white text-slate-500 border-[#b1b5c2]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add (+) Assets
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('DEDUCT')}
                  className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1 cursor-pointer ${
                    adjType === 'DEDUCT'
                      ? 'bg-rose-50 text-red-800 border-red-500 font-extrabold'
                      : 'bg-white text-slate-500 border-[#b1b5c2]'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Deduct (-) Shrinkage
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Adjustment Delta Count</label>
              <input
                type="number"
                min={1}
                required
                placeholder="e.g. 5"
                value={adjCountQty}
                onChange={(e) => setAdjCountQty(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1 text-right font-black text-sm rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Authorization Reasons Dropdown</label>
              <select
                value={adjReasonCode}
                onChange={(e) => setAdjReasonCode(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Stocktake variance">Stocktake variance delta</option>
                <option value="Damaged stock">Damaged / Obsolete material</option>
                <option value="Lost stock">Lost / Missing stock</option>
                <option value="Found stock">Found surplus stock</option>
                <option value="Data correction">Clerical data correction</option>
                <option value="Supplier issue">Supplier discrepancy on dock</option>
                <option value="Theft suspicion">Theft suspicion (High Risk Event)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Explanation / Notes</label>
              <textarea
                rows={2}
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10px] font-bold uppercase rounded-none resize-none outline-none"
                placeholder="Required explanations..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white border border-orange-600 font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer rounded-none"
            >
              Commit Stock Adjustment
            </button>
          </form>

          {/* Guidelines info */}
          <div className="lg:col-span-7 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase">ADJUSTMENT AUTHORISATION LIMIT MATRICES</span>
            </div>
            
            <div className="space-y-4 text-[10px] text-zinc-600 uppercase">
              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">CASHIER ROLES (Blocked)</span>
                <span>Cannot execute or propose any physical adjustments. Prohibited action.</span>
              </div>
              
              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">STOCK CONTROLLER Clearance (Restricted)</span>
                <span>Fills the adjustment form, but submissions are automatically held in pending stage queue for Supervisor/Manager approval. Stock levels do not alter.</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">SUPERVISOR Clearance (Tiered Cap)</span>
                <span>Can post positive counts and negative counts CAP-LIMITED to 3 units. Deductions &gt; 3 units automatically elevate to Manager clearance level.</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">MANAGERS / OWNERS (Full)</span>
                <span>Complete administrative clearance. Bypasses queues; registers directly to stock.</span>
              </div>
            </div>
          </div>

        </div>
      )}
      {activeTab === 'Product Transformation' && <ProductTransformationPanel />}

      {activeTab === 'Stock Transfers' && (
        <div className="industrial-section p-5 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                Stock Transfers
              </span>
              <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">Controlled movement of stock between branches, warehouses, sales floor, and holding areas.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={openNewStockTransferForm} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 font-black uppercase text-[9.5px] rounded-none">New Stock Transfer</button>
              <button type="button" onClick={() => refreshStockTransfers()} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#b1b5c2] font-semibold uppercase text-[9.5px] rounded-none">Refresh</button>
            </div>
          </div>

          <div className="p-3 bg-white border-l-4 border-l-orange-600 border border-[#b1b5c2] uppercase font-bold text-[10px] text-slate-800">
            Transfer requests do not change stock. Stock moves only on dispatch and receiving post. Receive draft does not increase destination available stock.
          </div>

          {stockTransferOperationalWarnings.length > 0 && (
            <div className="border border-[#b1b5c2] bg-white">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[10px] uppercase font-black">EOD / Owner Desk Transfer Warnings</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                {stockTransferOperationalWarnings.map((warning) => (
                  <div key={warning} className="border-l-4 border-l-orange-600 border border-[#b1b5c2] bg-orange-50 px-3 py-2 text-[9.5px] uppercase font-bold text-slate-800">{warning}</div>
                ))}
              </div>
            </div>
          )}

          {stockTransferNotice && (
            <div className="p-3 bg-amber-500/10 border-l-4 border-l-orange-500 border border-[#b1b5c2] uppercase font-black text-[9.5px] text-slate-800">{stockTransferNotice}</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <POMetric label="Draft Transfers" value={stockTransferSummary.draftTransfers} />
            <POMetric label="Pending Approval" value={stockTransferSummary.pendingApproval} />
            <POMetric label="Approved" value={stockTransferSummary.approved} />
            <POMetric label="In Transit" value={stockTransferSummary.inTransit} />
            <POMetric label="Partially Received" value={stockTransferSummary.partiallyReceived} />
            <POMetric label="Variance Review" value={stockTransferSummary.varianceReview} />
            <POMetric label="Fully Received" value={stockTransferSummary.fullyReceived} />
            <POMetric label="Closed Outstanding" value={stockTransferSummary.closedOutstanding} />
            <POMetric label="Transfer Qty" value={stockTransferSummary.transferQty} />
            <POMetric label="Transfer Value" value={`USD ${stockTransferSummary.transferValue.toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
            <POFilterInput label="Transfer Number" value={stockTransferFilters.transferNumber || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, transferNumber: value }))} />
            <POFilterSelect label="Transfer Type" value={stockTransferFilters.transferType || 'ALL'} options={['ALL', 'Branch To Branch', 'Warehouse To Warehouse', 'Warehouse To Branch', 'Branch To Warehouse', 'Store To Sales Floor', 'Sales Floor To Store', 'Good Stock To Damaged Holding', 'Good Stock To Return Holding', 'Return Holding To Supplier Return Preparation', 'Other']} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, transferType: value as StockTransferType | 'ALL' }))} />
            <POFilterInput label="Source Branch" value={stockTransferFilters.sourceBranch || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, sourceBranch: value }))} />
            <POFilterInput label="Source Warehouse" value={stockTransferFilters.sourceWarehouse || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, sourceWarehouse: value }))} />
            <POFilterInput label="Destination Branch" value={stockTransferFilters.destinationBranch || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, destinationBranch: value }))} />
            <POFilterInput label="Destination Warehouse" value={stockTransferFilters.destinationWarehouse || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, destinationWarehouse: value }))} />
            <POFilterSelect label="Status" value={stockTransferFilters.status || 'ALL'} options={['ALL', 'Draft', 'Pending Approval', 'Approved', 'Dispatched', 'Partially Dispatched', 'In Transit', 'Partially Received', 'Fully Received', 'Variance Review', 'Closed With Outstanding', 'Cancelled', 'Rejected', 'Reversed']} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, status: value as StockTransferStatus | 'ALL' }))} />
            <POFilterInput label="Product / SKU" value={stockTransferFilters.productOrSku || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, productOrSku: value }))} />
            <POFilterInput label="Requested By" value={stockTransferFilters.requestedBy || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, requestedBy: value }))} />
            <POFilterInput label="Date From" type="date" value={stockTransferFilters.dateFrom || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, dateFrom: value }))} />
            <POFilterInput label="Date To" type="date" value={stockTransferFilters.dateTo || ''} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, dateTo: value }))} />
            <POFilterSelect label="Variance Type" value={stockTransferFilters.varianceType || 'ALL'} options={['ALL', 'None', 'Short Received', 'Over Received', 'Damaged In Transit', 'Wrong Product', 'Missing Line', 'Unapproved Product', 'Source Stock Short', 'Destination Rejected']} onChange={(value) => setStockTransferFilters((prev) => ({ ...prev, varianceType: value as StockTransferVarianceType | 'ALL' }))} />
            <button type="button" onClick={() => refreshStockTransfers(stockTransferFilters)} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[9px] rounded-none self-end">Apply Filters</button>
            <button type="button" onClick={() => { const reset = { transferType: 'ALL' as const, status: 'ALL' as const, varianceType: 'ALL' as const }; setStockTransferFilters(reset); refreshStockTransfers(reset); }} className="px-3 py-2 bg-white text-[#1e222b] border border-[#b1b5c2] font-black uppercase text-[9px] rounded-none self-end">Clear Filters</button>
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="industrial-table min-w-[1380px]">
              <thead>
                <tr>{['Transfer No.', 'Date', 'Type', 'Source', 'Destination', 'Lines', 'Requested Qty', 'Dispatched Qty', 'Received Qty', 'Variance', 'Status', 'Requested By', 'Action'].map((label) => <th key={label} className="py-2 px-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stockTransferRecords.map((transfer) => {
                  const transferLines = stockTransferLineMap[transfer.transferId] || [];
                  const requestedQty = transferLines.reduce((sum, line) => sum + line.qtyRequested, 0);
                  const dispatchedQty = transferLines.reduce((sum, line) => sum + line.qtyDispatched, 0);
                  const receivedQty = transferLines.reduce((sum, line) => sum + line.qtyReceived, 0);
                  const variance = transferLines.filter((line) => line.varianceType !== 'None').length;
                  const locked = ['Fully Received', 'Closed With Outstanding', 'Cancelled', 'Rejected', 'Reversed'].includes(transfer.status);
                  return (
                    <tr key={transfer.transferId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-black text-orange-700">{transfer.transferNumber}</td>
                      <td className="py-2 px-3">{transfer.transferDate}</td>
                      <td className="py-2 px-3 uppercase">{transfer.transferType}</td>
                      <td className="py-2 px-3 uppercase">{transfer.sourceBranchName} / {transfer.sourceWarehouseName}</td>
                      <td className="py-2 px-3 uppercase">{transfer.destinationBranchName} / {transfer.destinationWarehouseName}</td>
                      <td className="py-2 px-3 text-right font-black">{transferLines.length}</td>
                      <td className="py-2 px-3 text-right font-black">{requestedQty}</td>
                      <td className="py-2 px-3 text-right font-black">{dispatchedQty}</td>
                      <td className="py-2 px-3 text-right font-black">{receivedQty}</td>
                      <td className="py-2 px-3 text-right font-black">{variance}</td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{transfer.status}</span></td>
                      <td className="py-2 px-3 uppercase">{transfer.requestedByStaffName}</td>
                      <td className="py-2 px-3">
                        <RowActionMenu
                          rowId={transfer.transferId}
                          ariaLabel={`Stock transfer actions for ${transfer.transferNumber}`}
                          open={openStockTransferMenuId === transfer.transferId}
                          onOpenChange={(open) => setOpenStockTransferMenuId(open ? transfer.transferId : null)}
                          items={[
                            { id: 'view', label: 'View / Edit', onClick: () => void handleStockTransferTableAction('view', transfer) },
                            { id: 'submit', label: 'Submit', disabled: locked, onClick: () => void handleStockTransferTableAction('submit', transfer) },
                            { id: 'approve', label: 'Approve', disabled: locked, onClick: () => void handleStockTransferTableAction('approve', transfer) },
                            { id: 'reject', label: 'Reject', disabled: locked, onClick: () => void handleStockTransferTableAction('reject', transfer) },
                            { id: 'dispatch', label: 'Dispatch', disabled: locked, separatorBefore: true, onClick: () => void handleStockTransferTableAction('dispatch', transfer) },
                            { id: 'receive', label: 'Receive', disabled: locked, onClick: () => void handleStockTransferTableAction('receive', transfer) },
                            { id: 'postReceipt', label: 'Post Receipt', disabled: locked, onClick: () => void handleStockTransferTableAction('postReceipt', transfer) },
                            { id: 'close', label: 'Close Outstanding', disabled: locked, separatorBefore: true, onClick: () => void handleStockTransferTableAction('close', transfer) },
                            { id: 'cancel', label: 'Cancel', disabled: locked, danger: true, onClick: () => void handleStockTransferTableAction('cancel', transfer) },
                            { id: 'export', label: 'Prepare Export', separatorBefore: true, onClick: () => void handleStockTransferTableAction('export', transfer) }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {stockTransferRecords.length === 0 && <tr><td colSpan={13} className="py-8 text-center uppercase font-bold text-slate-500">No stock transfers match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="border border-[#b1b5c2] bg-white p-3">
            <h4 className="text-[10px] uppercase font-black text-[#1e222b] mb-2">Recent Transfer Activity</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {stockTransferEvents.slice(0, 6).map((event) => (
                <div key={event.id} className="border-l-2 border-l-orange-500 pl-2 text-[9px] uppercase">
                  <strong className="block text-slate-900">{event.eventType.replaceAll('_', ' ')}</strong>
                  <span className="text-slate-600">{event.message}</span>
                </div>
              ))}
            </div>
          </div>

          <StockTransferForm
            open={stockTransferFormOpen}
            transfer={selectedStockTransfer}
            lines={selectedStockTransferLines}
            products={localStock}
            operatorName={staffName}
            branchOptions={stocktakeBranchDeskOptions.length ? stocktakeBranchDeskOptions : [activeBranch]}
            warehouseOptions={stocktakeWarehouseDeskOptions.length ? stocktakeWarehouseDeskOptions : ['Main Warehouse', 'Receiving Warehouse', 'Damaged Holding Area', 'Return Holding Area']}
            onClose={() => setStockTransferFormOpen(false)}
            onCreateDraft={handleCreateStockTransferDraft}
            onUpdateDraft={handleUpdateStockTransferDraft}
            onAddLine={handleAddStockTransferLine}
            onUpdateLine={handleUpdateStockTransferLine}
            onRemoveLine={handleRemoveStockTransferLine}
            onSubmit={handleSubmitStockTransfer}
            onApprove={handleApproveStockTransfer}
            onReject={handleRejectStockTransfer}
            onDispatch={handleDispatchStockTransfer}
            onReceive={handleReceiveStockTransfer}
            onPostReceipt={handlePostTransferReceipt}
            onCloseOutstanding={handleCloseTransferOutstanding}
            onCancel={handleCancelStockTransfer}
            onExport={handleExportStockTransfer}
            onViewLedger={(productId) => setStockTransferNotice(`Product Ledger can be opened from Inventory Product Ledger tab for product ${productId}. Posted transfer movements appear only after dispatch or destination receipt posting.`)}
          />
        </div>
      )}

      {activeTab === 'Stocktake' && (
        <div className="industrial-section p-5 space-y-5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Stocktake Desk
              </span>
              <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">Physical stock counting, variance review, approval, and posting control.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={openNewStocktakeForm} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white border border-orange-700 font-black uppercase text-[9.5px] rounded-none">New Stocktake Session</button>
              <button type="button" onClick={() => refreshStocktakeDesk()} className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#b1b5c2] font-semibold uppercase text-[9.5px] rounded-none">Refresh</button>
            </div>
          </div>

          <div className="p-3 bg-white border-l-4 border-l-orange-600 border border-[#b1b5c2] uppercase font-bold text-[10px] text-slate-800">
            Stocktake counts do not change inventory until variances are posted. Draft, counted, submitted, and approved stocktakes remain non-posting states.
          </div>

          {stocktakeOperationalWarnings.length > 0 && (
            <div className="border border-[#b1b5c2] bg-white">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[10px] uppercase font-black">EOD / Owner Desk Stocktake Warnings</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3">
                {stocktakeOperationalWarnings.map((warning) => (
                  <div key={warning} className="border-l-4 border-l-orange-600 border border-[#b1b5c2] bg-orange-50 px-3 py-2 text-[9.5px] uppercase font-bold text-slate-800">
                    {warning}
                  </div>
                ))}
              </div>
            </div>
          )}

          {stocktakeDeskNotice && (
            <div className="p-3 bg-amber-500/10 border-l-4 border-l-orange-500 border border-[#b1b5c2] uppercase font-black text-[9.5px] text-slate-800">{stocktakeDeskNotice}</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <POMetric label="Open Sessions" value={stocktakeDeskSummary.openSessions} />
            <POMetric label="Counting" value={stocktakeDeskSummary.counting} />
            <POMetric label="Submitted" value={stocktakeDeskSummary.submitted} />
            <POMetric label="Pending Approval" value={stocktakeDeskSummary.pendingApproval} />
            <POMetric label="Recount Required" value={stocktakeDeskSummary.recountRequired} />
            <POMetric label="Posted Today" value={stocktakeDeskSummary.postedToday} />
            <POMetric label="Positive Variance" value={stocktakeDeskSummary.positiveVariance} />
            <POMetric label="Negative Variance" value={stocktakeDeskSummary.negativeVariance} />
            <POMetric label="High Risk Variance" value={stocktakeDeskSummary.highRiskVariance} />
            <POMetric label="Estimated Value Impact" value={`USD ${stocktakeDeskSummary.estimatedValueImpact.toFixed(2)}`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
            <input placeholder="Stocktake Number" value={stocktakeDeskFilters.stocktakeNumber || ''} onChange={(event) => setStocktakeDeskFilters((current) => ({ ...current, stocktakeNumber: event.target.value }))} className="border border-[#8d8780] px-2 py-1.5 rounded-none text-[10px]" />
            <StocktakeSelect label="Branch" value={stocktakeDeskFilters.branch || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, branch: value }))} options={['ALL', ...stocktakeBranchDeskOptions]} />
            <StocktakeSelect label="Warehouse" value={stocktakeDeskFilters.warehouse || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, warehouse: value }))} options={['ALL', ...stocktakeWarehouseDeskOptions]} />
            <StocktakeSelect label="Scope" value={stocktakeDeskFilters.scope || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, scope: value as StocktakeFilterState['scope'] }))} options={['ALL', 'Full Inventory', 'Branch', 'Warehouse', 'Category', 'Supplier', 'Shelf Location', 'Selected Products', 'High Risk Products', 'Low Stock Products', 'No Movement Products']} />
            <StocktakeSelect label="Count Mode" value={stocktakeDeskFilters.countMode || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, countMode: value as StocktakeFilterState['countMode'] }))} options={['ALL', 'Visible System Qty', 'Blind Count', 'Supervisor Count', 'Recount']} />
            <StocktakeSelect label="Status" value={stocktakeDeskFilters.status || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, status: value as StocktakeFilterState['status'] }))} options={['ALL', 'Draft', 'Counting', 'Count Completed', 'Submitted', 'Pending Approval', 'Approved', 'Posted', 'Recount Requested', 'Cancelled', 'Closed']} />
            <input placeholder="Requested By" value={stocktakeDeskFilters.requestedBy || ''} onChange={(event) => setStocktakeDeskFilters((current) => ({ ...current, requestedBy: event.target.value }))} className="border border-[#8d8780] px-2 py-1.5 rounded-none text-[10px]" />
            <input placeholder="Counted By" value={stocktakeDeskFilters.countedBy || ''} onChange={(event) => setStocktakeDeskFilters((current) => ({ ...current, countedBy: event.target.value }))} className="border border-[#8d8780] px-2 py-1.5 rounded-none text-[10px]" />
            <input type="date" value={stocktakeDeskFilters.dateFrom || ''} onChange={(event) => setStocktakeDeskFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="border border-[#8d8780] px-2 py-1.5 rounded-none text-[10px]" />
            <input type="date" value={stocktakeDeskFilters.dateTo || ''} onChange={(event) => setStocktakeDeskFilters((current) => ({ ...current, dateTo: event.target.value }))} className="border border-[#8d8780] px-2 py-1.5 rounded-none text-[10px]" />
            <StocktakeSelect label="Variance Risk" value={stocktakeDeskFilters.varianceRisk || 'ALL'} onChange={(value) => setStocktakeDeskFilters((current) => ({ ...current, varianceRisk: value as StocktakeFilterState['varianceRisk'] }))} options={['ALL', 'None', 'Low', 'Medium', 'High', 'Critical']} />
            <button type="button" onClick={() => refreshStocktakeDesk(stocktakeDeskFilters)} className="bg-[#1e222b] text-white border border-slate-900 px-3 py-1.5 font-black uppercase text-[9px] rounded-none">Apply Filters</button>
            <button type="button" onClick={() => { const reset = { scope: 'ALL' as const, countMode: 'ALL' as const, status: 'ALL' as const, varianceRisk: 'ALL' as const }; setStocktakeDeskFilters(reset); refreshStocktakeDesk(reset); }} className="bg-white border border-[#b1b5c2] px-3 py-1.5 font-black uppercase text-[9px] rounded-none">Clear</button>
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="industrial-table min-w-[1320px]">
              <thead>
                <tr>{['Stocktake No.', 'Date', 'Branch', 'Warehouse', 'Scope', 'Count Mode', 'Lines', 'Counted', 'Variance Lines', 'Value Impact', 'Status', 'Requested By', 'Counted By', 'Action'].map((label) => <th key={label} className="py-2 px-3">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stocktakeDeskSessions.map((session) => {
                  const lines = stocktakeDeskLineMap[session.stocktakeId] || [];
                  const counted = lines.filter((line) => line.countedQty !== null && line.lineStatus !== 'Excluded').length;
                  const varianceLines = lines.filter((line) => line.varianceQty !== 0 && line.lineStatus !== 'Excluded').length;
                  const valueImpact = lines.reduce((sum, line) => sum + line.valueImpact, 0);
                  return (
                    <tr key={session.stocktakeId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-black text-orange-700">{session.stocktakeNumber}</td>
                      <td className="py-2 px-3">{session.startedAt.slice(0, 10)}</td>
                      <td className="py-2 px-3">{session.branchId}</td>
                      <td className="py-2 px-3">{session.warehouseId || 'N/A'}</td>
                      <td className="py-2 px-3">{session.scope}</td>
                      <td className="py-2 px-3">{session.countMode}</td>
                      <td className="py-2 px-3 text-right font-black">{lines.length}</td>
                      <td className="py-2 px-3 text-right font-black">{counted}</td>
                      <td className="py-2 px-3 text-right font-black">{varianceLines}</td>
                      <td className={`py-2 px-3 text-right font-black ${valueImpact < 0 ? 'text-red-800' : valueImpact > 0 ? 'text-emerald-800' : 'text-slate-800'}`}>USD {valueImpact.toFixed(2)}</td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{session.status}</span></td>
                      <td className="py-2 px-3">{session.requestedByStaffName}</td>
                      <td className="py-2 px-3">{session.countedByStaffName || 'N/A'}</td>
                      <td className="py-2 px-3">
                        <RowActionMenu
                          rowId={session.stocktakeId}
                          ariaLabel={`Stocktake actions for ${session.stocktakeNumber}`}
                          open={openStocktakeMenuId === session.stocktakeId}
                          onOpenChange={(open) => setOpenStocktakeMenuId(open ? session.stocktakeId : null)}
                          items={[
                            { id: 'view', label: 'View / Edit', onClick: () => void handleStocktakeTableAction('view', session) },
                            { id: 'start', label: 'Start Counting', disabled: session.status === 'Posted', onClick: () => void handleStocktakeTableAction('start', session) },
                            { id: 'submit', label: 'Submit', disabled: session.status === 'Posted', onClick: () => void handleStocktakeTableAction('submit', session) },
                            { id: 'recount', label: 'Request Recount', disabled: session.status === 'Posted', onClick: () => void handleStocktakeTableAction('recount', session) },
                            { id: 'approve', label: 'Approve', disabled: session.status === 'Posted', separatorBefore: true, onClick: () => void handleStocktakeTableAction('approve', session) },
                            { id: 'post', label: 'Post Variance', disabled: session.status === 'Posted', onClick: () => void handleStocktakeTableAction('post', session) },
                            { id: 'cancel', label: 'Cancel', disabled: session.status === 'Posted', danger: true, separatorBefore: true, onClick: () => void handleStocktakeTableAction('cancel', session) },
                            { id: 'export', label: 'Prepare Export', separatorBefore: true, onClick: () => void handleStocktakeTableAction('export', session) }
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {stocktakeDeskSessions.length === 0 && <tr><td colSpan={14} className="py-8 text-center uppercase font-bold text-slate-500">No stocktake sessions match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-[#b1b5c2] bg-white p-3">
              <h4 className="text-[10px] uppercase font-black text-[#1e222b] mb-2">EOD / Owner Desk Warnings</h4>
              <ul className="space-y-1 text-[9px] uppercase font-semibold text-slate-700">
                <li>Warn if session is still counting.</li>
                <li>Warn if submitted but not approved, or approved but not posted.</li>
                <li>Warn if high-risk variance or recount is pending.</li>
                <li>Warn if posted today but not reviewed.</li>
              </ul>
            </div>
            <div className="border border-[#b1b5c2] bg-white p-3">
              <h4 className="text-[10px] uppercase font-black text-[#1e222b] mb-2">Recent Stocktake Activity</h4>
              <div className="space-y-2 max-h-28 overflow-y-auto">
                {stocktakeDeskEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="border-l-2 border-l-orange-500 pl-2 text-[9px] uppercase">
                    <strong className="block text-slate-900">{event.eventType.replaceAll('_', ' ')}</strong>
                    <span className="text-slate-600">{event.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <StocktakeForm
            open={stocktakeFormOpen}
            session={selectedStocktake}
            lines={selectedStocktakeLines}
            summary={selectedStocktakeSummary}
            products={localStock}
            operatorName={staffName}
            branchOptions={stocktakeBranchDeskOptions.length ? stocktakeBranchDeskOptions : [activeBranch]}
            warehouseOptions={stocktakeWarehouseDeskOptions.length ? stocktakeWarehouseDeskOptions : ['Main Warehouse']}
            onClose={() => setStocktakeFormOpen(false)}
            onCreateDraft={handleCreateStocktakeDraft}
            onUpdateDraft={handleUpdateStocktakeDraft}
            onStartCounting={handleStartCountingStocktake}
            onSubmit={handleSubmitStocktake}
            onRequestRecount={handleRequestStocktakeRecount}
            onApprove={handleApproveStocktake}
            onPost={handlePostStocktake}
            onCancel={handleCancelStocktake}
            onExport={handleExportStocktake}
            onLineCountChange={handleStocktakeLineCount}
            onExcludeLine={handleExcludeStocktakeLine}
            onRestoreLine={handleRestoreStocktakeLine}
            onCompleteRecount={handleCompleteStocktakeRecount}
            onBulkCountAction={handleBulkStocktakeCounts}
            onViewLedger={(sku) => setStocktakeDeskNotice(`Product Ledger can be opened from Inventory Product Ledger tab. Posted stocktake gain/loss for ${sku} appears only after Post Variance.`)}
          />
        </div>
      )}

      {false && activeTab === 'Stocktake' && (
        <div className="industrial-section p-5 space-y-5">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Stocktake Desk
              </span>
              <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">Count physical stock and review variances before posting.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleStartStocktakeSession}
                className={`px-3 py-1.5 font-bold uppercase text-[9.5px] border cursor-pointer rounded-none transition-colors ${
                  stocktakeActive ? 'bg-orange-50 text-orange-600 border-orange-500' : 'bg-white text-slate-700 border-[#b1b5c2] hover:bg-slate-50'
                }`}
              >
                {stocktakeActive ? '● Audit Live' : 'Open Spot Session'}
              </button>
              <button
                onClick={handleRandomSpotCheck}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#b1b5c2] font-semibold uppercase text-[9.5px] rounded-none cursor-pointer"
              >
                Generate Test Counts
              </button>
              <button
                onClick={handleRecommendMajorAudit}
                className="px-3 py-1.5 bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 font-extrabold uppercase text-[9.5px] rounded-none cursor-pointer"
              >
                Recommend Full Audit
              </button>
            </div>
          </div>

          {stocktakeFeedback && (
            <div className="p-3 bg-amber-500/10 border-l-4 border-l-orange-500 border border-[#b1b5c2] uppercase font-black text-[9.5px] text-slate-800">
              {stocktakeFeedback}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 border border-[#b1b5c2] p-3">
            <StocktakeSelect label="Session Type" value={stocktakeSessionType} onChange={(value) => setStocktakeSessionType(value as 'Full' | 'Spot' | 'Audit')} options={['Full', 'Spot', 'Audit']} />
            <StocktakeSelect label="Branch" value={stocktakeBranchFilter} onChange={setStocktakeBranchFilter} options={stocktakeBranchOptions as string[]} />
            <StocktakeSelect label="Warehouse" value={stocktakeWarehouseFilter} onChange={setStocktakeWarehouseFilter} options={stocktakeWarehouseOptions as string[]} />
            <StocktakeSelect label="Category" value={stocktakeCategoryFilter} onChange={setStocktakeCategoryFilter} options={stocktakeCategoryOptions as string[]} />
            <StocktakeSelect label="Shelf Location" value={stocktakeShelfFilter} onChange={setStocktakeShelfFilter} options={stocktakeShelfOptions as string[]} />
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="industrial-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>Product No.</th>
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">ALU</th>
                  <th className="py-2 px-3">Product Description</th>
                  <th className="py-2 px-3">Sector / Category</th>
                  <th className="py-2 px-3">Brand</th>
                  <th className="py-2 px-3">Shelf</th>
                  <th className="py-2 px-3 text-right">System Qty</th>
                  <th className="py-2 px-3 text-right w-[140px]">Physical Count</th>
                  <th className="py-2 px-3 text-right">Variance</th>
                  <th className="py-2 px-3 text-center">Risk</th>
                  <th className="py-2 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredStocktakeLines.map((line) => {
                  let riskBg = 'bg-gray-100 text-slate-600';
                  if (line.riskLevel === 'High') riskBg = 'bg-orange-100 text-orange-800 font-bold border border-orange-250';
                  else if (line.riskLevel === 'Critical') riskBg = 'bg-red-100 text-red-800 font-black border border-red-300 animate-pulse';

                  return (
                    <tr key={line.sku} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-orange-700 whitespace-nowrap">{line.numericNo || '000000000'}</td>
                      <td className="py-2 px-3 font-bold text-[#1e222b]">{line.sku}</td>
                      <td className="py-2 px-3 font-bold text-slate-700 whitespace-nowrap">{line.alu || 'ALU-N/A'}</td>
                      <td className="py-2 px-3 uppercase font-extrabold text-[#1e222b]">{line.productName}</td>
                      <td className="py-2 px-3 uppercase text-[9px] text-slate-700">
                        <div className="font-black">{line.industrialSector || 'General'}</div>
                        <div className="text-[8px] text-slate-600">{line.category || 'Uncategorised'}</div>
                      </td>
                      <td className="py-2 px-3 uppercase text-[9px] text-slate-700">{line.brand || 'N/A'}</td>
                      <td className="py-2 px-3 uppercase text-[9px] text-slate-700">{line.shelfLocation || 'N/A'}</td>
                      <td className="py-2 px-3 text-right font-bold text-[#1e222b]">{line.systemQty}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          disabled={!stocktakeActive}
                          min={0}
                          value={line.countedQty}
                          onChange={(e) => handleSpotStocktakeLineChange(line.sku, e.target.value)}
                          className="w-full bg-white disabled:bg-slate-50 border border-[#8d8780] text-right font-black text-xs px-2 py-0.5 rounded-none outline-none focus:border-orange-500 text-[#1e222b]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono">
                        <span className={line.variance === 0 ? 'text-[#1e222b]' : line.variance > 0 ? 'text-emerald-800' : 'text-rose-800'}>
                          {line.variance > 0 ? `+${line.variance}` : line.variance}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap text-[9px]">
                        <span className={`inline-block px-1.5 py-0.2 uppercase tracking-wide rounded-none ${riskBg}`}>
                          {line.riskLevel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {line.variance !== 0 ? (
                          <span className="bg-red-50 text-red-800 border-red-200 font-bold text-[8px] px-1.5 py-0.2 uppercase">{line.status}</span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-800 border-emerald-200 font-medium text-[8px] px-1.5 py-0.2 uppercase">{line.status === 'Pending' ? 'Pending' : 'Matched'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-150">
            <span className="text-[9px] text-slate-400 uppercase font-bold">Physical Audit verification dispatch rules apply.</span>
            <button
              onClick={handlePostStocktakeResults}
              disabled={!stocktakeActive}
              className="px-6 py-2.5 bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 hover:bg-orange-700 text-white font-black uppercase text-[10.5px] border border-orange-700 rounded-none cursor-pointer"
            >
              Post Count Ledger Dispatches
            </button>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* 🛡️ CENTRALIZED STOCK CONTROL APPROVALS DEFLATOR QUEUE */}
      {/* ========================================================================= */}
      <div className="bg-white border text-xs border-[#b1b5c2]">
        
        {/* Header bar banner */}
        <div className="bg-[#1e222b] text-white p-3.5 flex justify-between items-center border-b-2 border-slate-900 select-none">
          <span className="font-extrabold text-[10.5px] uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            STOCK OPERATIONS SECURITY AUTHORISATION QUEUE
          </span>
          <span className="text-[8px] bg-red-500 text-white font-black px-2 py-0.5 uppercase tracking-wide animate-pulse">
            {stockApprovals.filter(r => r.status === 'Pending').length} Pending review
          </span>
        </div>

        {/* List content queue */}
        <div className="p-4 space-y-3.5">
          {stockApprovals.length === 0 ? (
            <div className="py-6 text-center text-slate-400 font-bold uppercase bg-slate-50/50 border border-dashed border-gray-200">
              No pending stock control operational approvals detected. System statuses high integrity.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {stockApprovals.map((req) => {
                let statusBg = 'bg-yellow-50 text-yellow-805 border-yellow-250';
                if (req.status === 'Approved') statusBg = 'bg-green-50 text-green-800 border-green-300';
                else if (req.status === 'Rejected') statusBg = 'bg-red-50 text-red-800 border-red-350';

                const isPermitted = canApprove(req.type, simulatedRole);

                return (
                  <div 
                    key={req.id} 
                    className={`border p-3.5 space-y-3 bg-slate-50 hover:border-orange-500 transition-colors rounded-none ${
                      req.status === 'Pending' ? 'border-amber-400 bg-amber-500/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                      <span className="font-black text-orange-600 text-[9.5px] uppercase">{req.type}</span>
                      <span className="text-slate-400 font-mono text-[8px]">{req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>

                    <p className="text-[#111827] font-sans font-bold uppercase text-[9.5px] leading-snug">
                      {req.notes}
                    </p>

                    <div className="text-[8.5px] text-slate-500 space-y-0.5 font-mono">
                      <div><strong>REQUESTED BY:</strong> {req.requestedBy}</div>
                      <div><strong>REQUEST ID:</strong> {req.id}</div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-150">
                      <span className={`inline-block border px-1.5 py-0.2 text-[8px] uppercase tracking-wide rounded-none font-bold ${statusBg}`}>
                        {req.status}
                      </span>

                      {req.status === 'Pending' && (
                        <div className="flex gap-1.5">
                          {isPermitted ? (
                            <>
                              <button
                                onClick={() => handleProcessApprovalInQueue(req, 'Approved')}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white border border-green-700 font-black uppercase text-[8px] rounded-none cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleProcessApprovalInQueue(req, 'Rejected')}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-750 font-black uppercase text-[8px] rounded-none cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span 
                              className="text-red-500 font-black text-[7.5px] flex items-center gap-1 uppercase select-none"
                              title="Active simulated role has insufficient access keys to resolve this queue item."
                            >
                              <Shield className="w-3 h-3 text-red-500 animate-pulse" />
                              Role Locked
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>


      {outstandingPOModalOpen && (
        <div className="procurement-modal-backdrop">
          <div className="procurement-selection-modal">
            <div className="procurement-selection-header">
              <div><span>Goods Receiving</span><h3>Outstanding PO Selection</h3></div>
              <button type="button" onClick={() => setOutstandingPOModalOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="procurement-selection-search">
              <Search className="w-4 h-4" />
              <input value={outstandingPOSupplier} onChange={(event) => setOutstandingPOSupplier(event.target.value)} placeholder="Search supplier with outstanding POs" />
            </div>
            <div className="procurement-selection-list">
              {outstandingPOOptions.length === 0 ? (
                <div className="procurement-selection-empty">No outstanding Purchase Orders found for this supplier.</div>
              ) : outstandingPOOptions.map((po) => {
                const lines = purchaseOrderLines[po.poId] || [];
                const outstandingQty = lines.reduce((sum, line) => sum + line.qtyOutstanding, 0);
                return (
                  <button
                    type="button"
                    key={po.poId}
                    onClick={() => {
                      setOutstandingPOModalOpen(false);
                      void handleCreateGRNFromPO(po);
                    }}
                  >
                    <strong>{po.poNumber} - {po.supplierName}</strong>
                    <span>Status: {po.status} | Outstanding Qty: {outstandingQty} | Expected: {po.expectedDeliveryDate || 'N/A'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {supplierGRNModalOpen && (
        <div className="procurement-modal-backdrop">
          <div className="procurement-selection-modal">
            <div className="procurement-selection-header">
              <div><span>Supplier Returns</span><h3>Posted GRN Selection</h3></div>
              <button type="button" onClick={() => setSupplierGRNModalOpen(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="procurement-selection-search">
              <Search className="w-4 h-4" />
              <input value={supplierGRNSupplier} onChange={(event) => setSupplierGRNSupplier(event.target.value)} placeholder="Search supplier posted GRNs" />
            </div>
            <div className="procurement-selection-list">
              {supplierGRNOptions.length === 0 ? (
                <div className="procurement-selection-empty">No posted returnable GRNs found for this supplier.</div>
              ) : supplierGRNOptions.map((note) => {
                const lines = goodsReceivingLineMap[note.grnId] || [];
                const returnableQty = lines.reduce((sum, line) => sum + Math.max(line.qtyAccepted - line.qtyAlreadyReturned, 0), 0);
                return (
                  <button
                    type="button"
                    key={note.grnId}
                    onClick={() => {
                      setSupplierGRNModalOpen(false);
                      void handleCreateSupplierReturnFromGRN(note);
                    }}
                  >
                    <strong>{note.grnNumber} - {note.supplierName}</strong>
                    <span>PO: {note.poNumber || 'Manual'} | Returnable Qty: {returnableQty} | Invoice: {note.supplierInvoiceNumber || 'Missing'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}


      {/* VIEW DRILLDOWN MODAL FOR PURCHASE ORDER */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-950/70 z-[950] flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none">
            
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-500" />
                PO Audit Details: {selectedPO.poNumber}
              </span>
              <button 
                type="button" 
                onClick={() => setSelectedPO(null)} 
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="border border-orange-300 bg-orange-50 p-3 text-[9px] uppercase font-black text-slate-800">
                Purchase Order memo only. No stock, accounting, cashbook, COGS or inventory asset value is posted here.
              </div>

              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-mono">
                <div><strong>SUPPLIER:</strong> <span className="text-[#1e222b] font-bold">{selectedPO.supplierName}</span></div>
                <div><strong>CREATED AT:</strong> <span>{selectedPO.createdAt}</span></div>
                <div><strong>EXPECTED DELIV:</strong> <span>{selectedPO.expectedDeliveryDate}</span></div>
                <div><strong>EST TOTAL BASIS:</strong> <span className="text-[#1e222b] font-bold">{selectedPO.currency} {selectedPO.grandTotalEstimate.toFixed(2)}</span></div>
                <div><strong>STATUS:</strong> <span>{selectedPO.status}</span></div>
                <div><strong>REQUESTED BY:</strong> <span>{selectedPO.requestedByStaffName}</span></div>
                <div><strong>APPROVED BY:</strong> <span>{selectedPO.approvedByStaffName || 'N/A'}</span></div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[8px] text-slate-400 uppercase font-black block">Line Items (Ordered)</span>
                <div className="border border-gray-200">
                  <table className="w-full text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1e222b] text-white font-bold uppercase text-[7px] h-7">
                        <th className="py-1 px-2.5">SKU</th>
                        <th className="py-1 px-2.5">Product Description</th>
                        <th className="py-1 px-2.5 text-right">Qty</th>
                        <th className="py-1 px-2.5 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {selectedPOLines.map((item) => (
                        <tr key={item.lineId} className="h-8 hover:bg-slate-50">
                          <td className="py-1 px-2.5 font-bold">{item.sku}</td>
                          <td className="py-1 px-2.5 text-slate-650 uppercase truncate max-w-[150px]">{item.productName}</td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-700">{item.qtyOrdered}</td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold">{selectedPO.currency} {item.estimatedUnitCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="px-4 py-1.5 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-bold uppercase text-[9.5px] cursor-pointer rounded-none"
              >
                Close View
              </button>
              {['Approved', 'Sent To Supplier', 'Partially Received'].includes(selectedPO.status) && (
                <button
                  type="button"
                  onClick={() => {
                    handleQuickReceivePO(selectedPO);
                    setSelectedPO(null);
                  }}
                  className="px-4 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white border border-orange-600 font-black uppercase text-[9.5px] cursor-pointer rounded-none"
                >
                  Receive Parts
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function poStatusClass(status: PurchaseOrderStatus): string {
  if (status === 'Draft') return 'bg-slate-100 text-slate-700 border border-slate-300';
  if (status === 'Pending Approval') return 'bg-amber-50 text-amber-800 border border-amber-300 font-black';
  if (status === 'Approved') return 'bg-sky-50 text-sky-800 border border-sky-300 font-bold';
  if (status === 'Sent To Supplier') return 'bg-orange-50 text-orange-800 border border-orange-300 font-bold';
  if (status === 'Partially Received') return 'bg-purple-50 text-purple-800 border border-purple-300 font-bold';
  if (status === 'Fully Received') return 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';
  if (status === 'Cancelled') return 'bg-red-50 text-red-800 border border-red-300 font-bold';
  if (status === 'Closed With Outstanding') return 'bg-rose-50 text-rose-800 border border-rose-300 font-bold';
  return 'bg-gray-100 text-slate-700 border border-gray-300';
}

function grnStatusClass(status: GoodsReceivingStatus): string {
  if (status === 'Draft') return 'bg-slate-100 text-slate-700 border border-slate-300';
  if (status === 'Pending Approval') return 'bg-amber-50 text-amber-800 border border-amber-300 font-black';
  if (status === 'Posted') return 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';
  if (status === 'Partially Posted') return 'bg-sky-50 text-sky-800 border border-sky-300 font-bold';
  if (status === 'Cancelled') return 'bg-red-50 text-red-800 border border-red-300 font-bold';
  if (status === 'Rejected') return 'bg-rose-50 text-rose-800 border border-rose-300 font-bold';
  return 'bg-gray-100 text-slate-700 border border-gray-300';
}

function supplierReturnStatusClass(status: SupplierReturnStatus): string {
  if (status === 'Posted' || status === 'Supplier Accepted' || status === 'Credit Note Received' || status === 'Replacement Received') return 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';
  if (status === 'Dispatched To Supplier' || status === 'Replacement Pending') return 'bg-sky-50 text-sky-800 border border-sky-300 font-bold';
  if (status === 'Pending Approval' || status === 'Approved' || status === 'Credit Note Pending') return 'bg-amber-50 text-amber-800 border border-amber-300 font-black';
  if (status === 'Supplier Rejected' || status === 'Cancelled') return 'bg-rose-50 text-rose-800 border border-rose-300 font-bold';
  if (status === 'Closed') return 'bg-slate-200 text-slate-800 border border-slate-400 font-bold';
  return 'bg-slate-100 text-slate-700 border border-slate-300';
}

function stockAdjustmentStatusClass(status: StockAdjustmentStatus): string {
  if (status === 'Posted') return 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold';
  if (status === 'Approved') return 'bg-sky-50 text-sky-800 border border-sky-300 font-bold';
  if (status === 'Pending Approval') return 'bg-amber-50 text-amber-800 border border-amber-300 font-black';
  if (status === 'Rejected' || status === 'Cancelled' || status === 'Reversed') return 'bg-rose-50 text-rose-800 border border-rose-300 font-bold';
  return 'bg-slate-100 text-slate-700 border border-slate-300';
}

function productMasterStatusClass(status: ProductMasterRecord['status']): string {
  if (status === 'Active') return 'bg-emerald-50 text-emerald-800 border-emerald-300';
  if (status === 'Pending Review' || status === 'Draft') return 'bg-orange-50 text-orange-800 border-orange-300';
  if (status === 'Blocked') return 'bg-red-50 text-red-800 border-red-300';
  return 'bg-slate-100 text-slate-700 border-slate-300';
}

function POMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#b1b5c2] p-3">
      <div className="text-[8px] text-slate-500 font-black uppercase tracking-wider">{label}</div>
      <div className="mt-1 text-sm text-[#1e222b] font-black uppercase">{value}</div>
    </div>
  );
}

function POFilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-black uppercase outline-none focus:border-orange-500 rounded-none"
      />
    </label>
  );
}

function POFilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-black uppercase outline-none focus:border-orange-500 rounded-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}

function POAction({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 border font-black uppercase text-[8px] rounded-none cursor-pointer ${
        primary
          ? 'bg-orange-600 hover:bg-orange-700 border-orange-700 text-white'
          : 'bg-white hover:bg-slate-50 border-[#b1b5c2] text-[#1e222b]'
      }`}
    >
      {label}
    </button>
  );
}

function StocktakeSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[8px] font-black text-slate-500 uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-black uppercase outline-none focus:border-orange-500 rounded-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}



