import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Maximize2, Minus, Plus, RotateCcw, Save, Search, Send, Square, Trash2, UserPlus, X } from 'lucide-react';
import {
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderPriority,
  PurchaseOrderSource,
  PurchaseOrderStatus,
  Role,
  ProductMasterRecord,
  SupplierRecord,
  SupplierVatStatus
} from '../types';
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  exportPurchaseOrderPlaceholder,
  markPurchaseOrderSent,
  submitPurchaseOrderForApproval,
  updatePurchaseOrderDraft
} from '../services/purchaseOrderService';
import {
  createSupplierFromPurchaseOrder,
  findSupplierByNameOrContact,
  flagPOSupplierNotInRecords,
  flagPossibleDuplicateSupplier,
  recordSupplierActivity,
  searchSuppliers,
  SupplierDuplicateMatch
} from '../services/supplierService';
import {
  createProductFromPurchaseOrder,
  detectDuplicateProduct,
  POProductSearchResult,
  recordPOProductActivity,
  searchProductsAnyOrder
} from '../services/purchaseOrderProductService';
import { canPerformAction } from '../utils/posPermissions';
import { getActiveVendorId } from '../utils/vendorDataMode';

type WindowState = 'normal' | 'minimized' | 'maximized';

interface PurchaseOrderFormProps {
  open: boolean;
  order?: PurchaseOrder | null;
  lines?: PurchaseOrderLine[];
  products: Product[];
  staffName: string;
  staffId?: string;
  role: Role;
  activeBranch: string;
  onClose: () => void;
  onChanged: (message: string) => void;
}

interface FormLine {
  lineId?: string;
  productId: string;
  productSearch: string;
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  supplierItemCode: string;
  upc: string;
  unitOfMeasure: string;
  qtyOrdered: number;
  qtyReceived: number;
  estimatedUnitCost: number;
  lastCostPrice?: number;
  currentSellingPrice?: number;
  shelfLocation: string;
  notes: string;
}

interface SupplierDraft {
  supplierName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  cityTown: string;
  district: string;
  suburb: string;
  supplierType: string;
  taxNumber: string;
  vatStatus: SupplierVatStatus;
  paymentTermsDays: number;
  creditLimit: number;
  notes: string;
}

interface ProductDraft {
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  category: string;
  department: string;
  supplierName: string;
  supplierItemCode: string;
  upc: string;
  unitOfMeasure: string;
  estimatedUnitCost: number;
  sellingPrice: number;
  shelfLocation: string;
  reorderPoint: number;
  taxCode: string;
  notes: string;
  partNumber: string;
  alternatePartNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  yearFrom: string;
  yearTo: string;
  side: string;
  condition: string;
  compatibilityTags: string;
}

const priorities: PurchaseOrderPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
const sources: PurchaseOrderSource[] = ['Manual', 'Low Stock Recommendation', 'Stock Health Recommendation', 'Supplier Reorder', 'Import Draft', 'Owner Request'];

function emptyLine(products: Product[]): FormLine {
  const product = products[0];
  return {
    productId: product?.id || '',
    productSearch: product?.productName || product?.name || '',
    sku: product?.sku || product?.code || '',
    productName: product?.productName || product?.name || '',
    brand: product?.brand || '',
    manufacturer: product?.manufacturer || '',
    supplierItemCode: '',
    upc: product?.barcode || '',
    unitOfMeasure: product?.unitOfMeasure || product?.unit || 'pcs',
    qtyOrdered: 1,
    qtyReceived: 0,
    estimatedUnitCost: product?.costPrice ?? product?.cost ?? 0,
    lastCostPrice: product?.costPrice ?? product?.cost,
    currentSellingPrice: product?.sellingPrice ?? product?.price,
    shelfLocation: product?.shelfLocation || '',
    notes: ''
  };
}

function lineFromPOLine(line: PurchaseOrderLine): FormLine {
  return {
    lineId: line.lineId,
    productId: line.productId,
    productSearch: line.productName,
    sku: line.sku,
    productName: line.productName,
    brand: line.brand,
    manufacturer: line.manufacturer,
    supplierItemCode: line.supplierItemCode || '',
    upc: line.upc || '',
    unitOfMeasure: line.unitOfMeasure,
    qtyOrdered: line.qtyOrdered,
    qtyReceived: line.qtyReceived,
    estimatedUnitCost: line.estimatedUnitCost,
    lastCostPrice: line.lastCostPrice,
    currentSellingPrice: line.currentSellingPrice,
    shelfLocation: line.shelfLocation || '',
    notes: line.notes
  };
}

function fieldClass(extra = ''): string {
  return `w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-bold text-[#1e222b] outline-none focus:border-orange-500 rounded-none ${extra}`;
}

export default function PurchaseOrderForm({
  open,
  order,
  lines = [],
  products,
  staffName,
  staffId,
  role,
  activeBranch,
  onClose,
  onChanged
}: PurchaseOrderFormProps) {
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [poId, setPoId] = useState(order?.poId || '');
  const [poNumber, setPoNumber] = useState(order?.poNumber || 'AUTO-GENERATED');
  const [poDate, setPoDate] = useState(order?.poDate || new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(order?.expectedDeliveryDate || '');
  const [priority, setPriority] = useState<PurchaseOrderPriority>(order?.priority || 'Normal');
  const [source, setSource] = useState<PurchaseOrderSource>(order?.source || 'Manual');
  const [status, setStatus] = useState(order?.status || 'Draft');
  const [currency, setCurrency] = useState(order?.currency || 'USD');
  const [supplierId, setSupplierId] = useState(order?.supplierId || '');
  const [supplierCode, setSupplierCode] = useState(order?.supplierCode || '');
  const [supplierName, setSupplierName] = useState(order?.supplierName || '');
  const [supplierContactPerson, setSupplierContactPerson] = useState(order?.supplierContactPerson || '');
  const [supplierPhone, setSupplierPhone] = useState(order?.supplierPhone || '');
  const [supplierEmail, setSupplierEmail] = useState(order?.supplierEmail || '');
  const [supplierAddress, setSupplierAddress] = useState(order?.supplierAddress || '');
  const [supplierItemReference, setSupplierItemReference] = useState(order?.supplierItemReference || '');
  const [supplierSearchResults, setSupplierSearchResults] = useState<SupplierRecord[]>([]);
  const [supplierMatches, setSupplierMatches] = useState<SupplierDuplicateMatch[]>([]);
  const [supplierCreateOpen, setSupplierCreateOpen] = useState(false);
  const [allowCreateDuplicate, setAllowCreateDuplicate] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState<SupplierDraft>({
    supplierName: order?.supplierName || '',
    contactPerson: order?.supplierContactPerson || '',
    phone: order?.supplierPhone || '',
    whatsapp: '',
    email: order?.supplierEmail || '',
    address: order?.supplierAddress || '',
    cityTown: '',
    district: '',
    suburb: '',
    supplierType: 'Trade Supplier',
    taxNumber: '',
    vatStatus: 'Unknown',
    paymentTermsDays: 30,
    creditLimit: 0,
    notes: order?.supplierItemReference ? `Supplier item reference: ${order.supplierItemReference}` : ''
  });
  const [deliveryBranchId, setDeliveryBranchId] = useState(order?.deliveryBranchId || activeBranch);
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState(order?.deliveryWarehouseId || 'Main Warehouse');
  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || 'Main Branch receiving bay');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [internalMemo, setInternalMemo] = useState(order?.internalMemo || '');
  const [termsAndConditions, setTermsAndConditions] = useState(order?.termsAndConditions || 'Supplier invoice and GRN required before stock is updated.');
  const [notes, setNotes] = useState(order?.notes || '');
  const [deliveryCostEstimate, setDeliveryCostEstimate] = useState(order?.deliveryCostEstimate || 0);
  const [formLines, setFormLines] = useState<FormLine[]>(lines.length ? lines.map(lineFromPOLine) : [emptyLine(products)]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const productSearchInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [activeProductSearchIndex, setActiveProductSearchIndex] = useState<number | null>(null);
  const [productSearchResults, setProductSearchResults] = useState<POProductSearchResult[]>([]);
  const [productDropdownRect, setProductDropdownRect] = useState<DOMRect | null>(null);
  const [productCreateOpen, setProductCreateOpen] = useState(false);
  const [productCreateLineIndex, setProductCreateLineIndex] = useState<number | null>(null);
  const [productDuplicateNotice, setProductDuplicateNotice] = useState<string | null>(null);
  const [productDraft, setProductDraft] = useState<ProductDraft>({
    sku: '',
    productName: '',
    brand: '',
    manufacturer: '',
    category: '',
    department: '',
    supplierName: '',
    supplierItemCode: '',
    upc: '',
    unitOfMeasure: 'pcs',
    estimatedUnitCost: 0,
    sellingPrice: 0,
    shelfLocation: '',
    reorderPoint: 0,
    taxCode: '',
    notes: '',
    partNumber: '',
    alternatePartNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    yearFrom: '',
    yearTo: '',
    side: '',
    condition: 'New',
    compatibilityTags: ''
  });

  useEffect(() => {
    if (!open) return;
    setPoId(order?.poId || '');
    setPoNumber(order?.poNumber || 'AUTO-GENERATED');
    setPoDate(order?.poDate || new Date().toISOString().slice(0, 10));
    setExpectedDeliveryDate(order?.expectedDeliveryDate || '');
    setPriority(order?.priority || 'Normal');
    setSource(order?.source || 'Manual');
    setStatus(order?.status || 'Draft');
    setCurrency(order?.currency || 'USD');
    setSupplierId(order?.supplierId || '');
    setSupplierCode(order?.supplierCode || '');
    setSupplierName(order?.supplierName || '');
    setSupplierContactPerson(order?.supplierContactPerson || '');
    setSupplierPhone(order?.supplierPhone || '');
    setSupplierEmail(order?.supplierEmail || '');
    setSupplierAddress(order?.supplierAddress || '');
    setSupplierItemReference(order?.supplierItemReference || '');
    setSupplierSearchResults(order?.supplierName ? searchSuppliers(order.supplierName) : []);
    setSupplierMatches([]);
    setSupplierCreateOpen(false);
    setAllowCreateDuplicate(false);
    setSupplierDraft({
      supplierName: order?.supplierName || '',
      contactPerson: order?.supplierContactPerson || '',
      phone: order?.supplierPhone || '',
      whatsapp: '',
      email: order?.supplierEmail || '',
      address: order?.supplierAddress || '',
      cityTown: '',
      district: '',
      suburb: '',
      supplierType: 'Trade Supplier',
      taxNumber: '',
      vatStatus: 'Unknown',
      paymentTermsDays: 30,
      creditLimit: 0,
      notes: order?.supplierItemReference ? `Supplier item reference: ${order.supplierItemReference}` : ''
    });
    setDeliveryBranchId(order?.deliveryBranchId || activeBranch);
    setDeliveryWarehouseId(order?.deliveryWarehouseId || 'Main Warehouse');
    setDeliveryAddress(order?.deliveryAddress || 'Main Branch receiving bay');
    setDeliveryNotes('');
    setInternalMemo(order?.internalMemo || '');
    setTermsAndConditions(order?.termsAndConditions || 'Supplier invoice and GRN required before stock is updated.');
    setNotes(order?.notes || '');
    setDeliveryCostEstimate(order?.deliveryCostEstimate || 0);
    setFormLines(lines.length ? lines.map(lineFromPOLine) : [emptyLine(products)]);
    setFeedback(null);
    setActiveProductSearchIndex(null);
    setProductSearchResults([]);
    setProductDropdownRect(null);
    setProductCreateOpen(false);
    setProductCreateLineIndex(null);
    setProductDuplicateNotice(null);
  }, [activeBranch, lines, open, order, products]);

  useEffect(() => {
    if (!open || activeProductSearchIndex === null) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      const input = productSearchInputRefs.current[activeProductSearchIndex];
      const dropdown = document.getElementById('po-product-search-dropdown');
      if (input?.contains(target) || dropdown?.contains(target)) return;
      setActiveProductSearchIndex(null);
      setProductSearchResults([]);
      setProductDropdownRect(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveProductSearchIndex(null);
        setProductSearchResults([]);
        setProductDropdownRect(null);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeProductSearchIndex, open]);

  const canCreate = canPerformAction(role, 'purchaseOrders.create');
  const canEdit = canPerformAction(role, 'purchaseOrders.edit');
  const canApprove = canPerformAction(role, 'purchaseOrders.approve') || canPerformAction(role, 'inventory.approveImport') || canPerformAction(role, 'approvals.approve');
  const canExport = canPerformAction(role, 'purchaseOrders.export');
  const canProductSearch = canPerformAction(role, 'purchaseOrder.productSearch') || canPerformAction(role, 'productMaster.view');
  const canCreateProductFromPO = canPerformAction(role, 'purchaseOrder.productCreateFromPO') || canPerformAction(role, 'inventory.product.create') || canPerformAction(role, 'productMaster.create');

  const totals = useMemo(() => {
    const lineCount = formLines.length;
    const totalQty = formLines.reduce((sum, line) => sum + (Number(line.qtyOrdered) || 0), 0);
    const subtotal = formLines.reduce((sum, line) => sum + ((Number(line.qtyOrdered) || 0) * (Number(line.estimatedUnitCost) || 0)), 0);
    const tax = subtotal * 0.15;
    const grand = subtotal + tax + deliveryCostEstimate;
    return { lineCount, totalQty, subtotal, tax, grand };
  }, [deliveryCostEstimate, formLines]);

  const sizeClass = windowState === 'maximized'
    ? 'w-[calc(100vw-32px)] h-[calc(100vh-32px)]'
    : windowState === 'minimized'
      ? 'w-[520px] h-[46px]'
      : 'w-[min(1360px,calc(100vw-32px))] h-[min(880px,calc(100vh-32px))]';

  if (!open) return null;

  const updateLine = <K extends keyof FormLine>(index: number, key: K, value: FormLine[K]) => {
    setFormLines((prev) => prev.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line));
  };

  const selectProduct = (index: number, productId: string) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setFormLines((prev) => prev.map((line, lineIndex) => lineIndex === index ? {
      ...line,
      productId: product.id,
      productSearch: product.productName || product.name,
      sku: product.sku || product.code,
      productName: product.productName || product.name,
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      upc: product.barcode || '',
      unitOfMeasure: product.unitOfMeasure || product.unit || 'pcs',
      qtyOrdered: line.qtyOrdered > 0 ? line.qtyOrdered : 1,
      estimatedUnitCost: product.costPrice ?? product.cost ?? line.estimatedUnitCost,
      lastCostPrice: product.costPrice ?? product.cost,
      currentSellingPrice: product.sellingPrice ?? product.price,
      shelfLocation: product.shelfLocation || ''
    } : line));
  };

  const selectProductMaster = (index: number, result: POProductSearchResult) => {
    const product = result.product;
    setFormLines((prev) => prev.map((line, lineIndex) => lineIndex === index ? {
      ...line,
      productId: product.productId,
      productSearch: `${product.sku} ${product.productName}`,
      sku: product.sku || product.productCode,
      productName: product.productName,
      brand: product.brand || product.sectorAttributes.brand || '',
      manufacturer: product.manufacturer || product.sectorAttributes.manufacturer || '',
      supplierItemCode: product.supplierItemCode || line.supplierItemCode || supplierItemReference,
      upc: product.barcode || '',
      unitOfMeasure: product.unitOfMeasure || line.unitOfMeasure || 'pcs',
      qtyOrdered: line.qtyOrdered > 0 ? line.qtyOrdered : 1,
      estimatedUnitCost: product.defaultCostPrice ?? line.estimatedUnitCost,
      lastCostPrice: product.defaultCostPrice,
      currentSellingPrice: product.defaultSellingPrice,
      shelfLocation: result.shelfLocation || line.shelfLocation || '',
      notes: line.notes
    } : line));
    setActiveProductSearchIndex(null);
    setProductSearchResults([]);
    setProductDropdownRect(null);
    recordPOProductActivity('PO_PRODUCT_SELECTED', `${product.productName} selected for Purchase Order line.`, staffId || staffName, product.productId, poId || poNumber);
    setFeedback(`${product.productName} added to Purchase Order line.`);
  };

  const runProductSearch = async (index: number, query: string) => {
    if (!canProductSearch) {
      setFeedback('You do not have permission to search Product Master from Purchase Orders.');
      return;
    }
    updateLine(index, 'productSearch', query);
    setActiveProductSearchIndex(index);
    const input = productSearchInputRefs.current[index];
    setProductDropdownRect(input?.getBoundingClientRect() || null);
    const results = await searchProductsAnyOrder(query);
    setProductSearchResults(results);
    recordPOProductActivity(results.length ? 'PO_PRODUCT_SEARCHED' : 'PO_PRODUCT_NOT_FOUND', results.length ? `PO product search: ${query}.` : `PO product not found: ${query}.`, staffId || staffName, undefined, poId || poNumber);
  };

  const buildProductDraftFromLine = (line: FormLine, searchText: string): ProductDraft => ({
    sku: line.sku,
    productName: line.productName || searchText,
    brand: line.brand,
    manufacturer: line.manufacturer,
    category: '',
    department: '',
    supplierName: supplierName,
    supplierItemCode: line.supplierItemCode || supplierItemReference,
    upc: line.upc,
    unitOfMeasure: line.unitOfMeasure || 'pcs',
    estimatedUnitCost: line.estimatedUnitCost || 0,
    sellingPrice: line.currentSellingPrice || 0,
    shelfLocation: line.shelfLocation,
    reorderPoint: 0,
    taxCode: '',
    notes: supplierId ? 'Created from Purchase Order.' : 'Supplier is not linked yet. Link supplier before submitting PO.',
    partNumber: '',
    alternatePartNumber: '',
    vehicleMake: '',
    vehicleModel: '',
    yearFrom: '',
    yearTo: '',
    side: '',
    condition: 'New',
    compatibilityTags: ''
  });

  const openCreateProductModal = async (index: number, searchText = formLines[index]?.productSearch || '') => {
    if (!canCreateProductFromPO) {
      setFeedback('You do not have permission to create Product Master drafts from Purchase Orders.');
      return;
    }
    const line = formLines[index] || emptyLine(products);
    const draft = buildProductDraftFromLine(line, searchText);
    setProductDraft({
      ...draft,
      productName: draft.productName || searchText,
      sku: draft.sku || searchText.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
    });
    setProductCreateLineIndex(index);
    setProductCreateOpen(true);
    setProductDuplicateNotice(null);
    recordPOProductActivity('PO_CREATE_PRODUCT_MODAL_OPENED', `Create product from PO opened for ${searchText || line.productName || 'new line'}.`, staffId || staffName, undefined, poId || poNumber);
    const duplicates = await detectDuplicateProduct({ sku: line.sku, productName: line.productName || searchText, brand: line.brand, manufacturer: line.manufacturer });
    if (duplicates.duplicateSku || duplicates.possibleNameMatches.length) {
      setProductDuplicateNotice(duplicates.duplicateSku ? `Duplicate SKU exists: ${duplicates.duplicateSku.sku}.` : `Possible duplicate: ${duplicates.possibleNameMatches.map((product) => product.productName).join(', ')}.`);
      recordPOProductActivity('PO_LINE_PRODUCT_DUPLICATE_WARNING', `Possible duplicate product for ${line.productName || searchText}.`, staffId || staffName, duplicates.duplicateSku?.productId || duplicates.possibleNameMatches[0]?.productId, poId || poNumber);
    }
  };

  const applyCreatedProductToLine = (product: ProductMasterRecord, index: number) => {
    selectProductMaster(index, { product, currentStock: 0, shelfLocation: productDraft.shelfLocation });
    recordPOProductActivity('PRODUCT_ADDED_TO_PO_LINE', `${product.productName} added to Purchase Order line.`, staffId || staffName, product.productId, poId || poNumber);
    setFeedback('Product created and added to Purchase Order line.');
  };

  const createProductAndAddToPO = async () => {
    if (productCreateLineIndex === null) return;
    try {
      const product = await createProductFromPurchaseOrder({
        ...productDraft,
        supplierId,
        supplierName: productDraft.supplierName || supplierName,
        poId: poId || poNumber,
        createdByStaffId: staffId || staffName
      });
      setProductCreateOpen(false);
      applyCreatedProductToLine(product, productCreateLineIndex);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Product could not be created.');
    }
  };

  const saveProductDraftOnly = async () => {
    try {
      const product = await createProductFromPurchaseOrder({
        ...productDraft,
        supplierId,
        supplierName: productDraft.supplierName || supplierName,
        poId: poId || poNumber,
        createdByStaffId: staffId || staffName
      });
      setProductCreateOpen(false);
      recordPOProductActivity('PRODUCT_CREATED_FROM_PURCHASE_ORDER', `${product.productName} saved as Product Master draft from Purchase Order.`, staffId || staffName, product.productId, poId || poNumber);
      setFeedback('Product draft saved. No stock quantity was created.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Product draft could not be saved.');
    }
  };

  const updateSupplierSearch = (value: string) => {
    setSupplierName(value);
    setSupplierId('');
    setSupplierCode('');
    const results = searchSuppliers(value);
    setSupplierSearchResults(results);
    setSupplierMatches(findSupplierByNameOrContact({
      supplierName: value,
      phone: supplierPhone,
      email: supplierEmail,
      contactPerson: supplierContactPerson
    }));
  };

  const applySupplier = (supplier: SupplierRecord) => {
    setSupplierId(supplier.supplierId);
    setSupplierCode(supplier.supplierCode);
    setSupplierName(supplier.supplierName);
    setSupplierContactPerson(supplier.contactPerson || '');
    setSupplierPhone(supplier.phone || '');
    setSupplierEmail(supplier.email || '');
    setSupplierAddress(supplier.address || '');
    setSupplierSearchResults([]);
    setSupplierMatches([]);
    setSupplierCreateOpen(false);
    recordSupplierActivity('SUPPLIER_SELECTED_FOR_PO', `${supplier.supplierName} selected for Purchase Order ${poNumber}.`, staffId || staffName, supplier.supplierId, poId || poNumber);
    setFeedback(`${supplier.supplierName} selected and linked to this Purchase Order.`);
  };

  const openSupplierCreatePrompt = async (matches = supplierMatches) => {
    const cleanName = supplierName.trim();
    if (!cleanName) {
      setFeedback('Supplier name is required before saving the Purchase Order.');
      await flagPOSupplierNotInRecords('', staffId || staffName, poId || poNumber);
      return;
    }
    setSupplierDraft({
      supplierName: cleanName,
      contactPerson: supplierContactPerson,
      phone: supplierPhone,
      whatsapp: supplierPhone,
      email: supplierEmail,
      address: supplierAddress,
      cityTown: '',
      district: '',
      suburb: '',
      supplierType: 'Trade Supplier',
      taxNumber: '',
      vatStatus: 'Unknown',
      paymentTermsDays: 30,
      creditLimit: 0,
      notes: supplierItemReference ? `Supplier item reference: ${supplierItemReference}` : ''
    });
    setSupplierMatches(matches);
    setSupplierCreateOpen(true);
    setAllowCreateDuplicate(false);
    recordSupplierActivity('SUPPLIER_CREATE_PROMPT_OPENED', `Supplier creation prompt opened for ${cleanName}.`, staffId || staffName, undefined, poId || poNumber);
    if (matches.length) await flagPossibleDuplicateSupplier(matches, cleanName, staffId || staffName, poId || poNumber);
    else await flagPOSupplierNotInRecords(cleanName, staffId || staffName, poId || poNumber);
  };

  const ensureSupplierLinked = async (): Promise<boolean> => {
    if (supplierId.trim()) return true;
    if (!supplierName.trim()) {
      setFeedback('Supplier name is required before saving the Purchase Order.');
      await flagPOSupplierNotInRecords('', staffId || staffName, poId || poNumber);
      return false;
    }
    const matches = findSupplierByNameOrContact({
      supplierName,
      phone: supplierPhone,
      email: supplierEmail,
      contactPerson: supplierContactPerson
    });
    await openSupplierCreatePrompt(matches);
    setFeedback(matches.length ? 'This supplier may already exist. Use existing supplier or create new?' : 'Supplier not found. Create new supplier?');
    return false;
  };

  const createAndLinkSupplier = async () => {
    if (supplierMatches.length && !allowCreateDuplicate) {
      setFeedback('Possible duplicate supplier found. Use existing supplier, choose Create New Supplier Anyway, or cancel.');
      return;
    }
    try {
      const supplier = await createSupplierFromPurchaseOrder({
        supplierId: '',
        supplierName: supplierDraft.supplierName,
        supplierContactPerson: supplierDraft.contactPerson,
        supplierPhone: supplierDraft.phone,
        supplierEmail: supplierDraft.email,
        supplierAddress: supplierDraft.address,
        supplierItemReference
      }, poId || poNumber, staffId || staffName, totals.grand, {
        whatsapp: supplierDraft.whatsapp,
        cityTown: supplierDraft.cityTown,
        district: supplierDraft.district,
        suburb: supplierDraft.suburb,
        supplierType: supplierDraft.supplierType,
        taxNumber: supplierDraft.taxNumber,
        vatStatus: supplierDraft.vatStatus,
        paymentTermsDays: supplierDraft.paymentTermsDays,
        creditLimit: supplierDraft.creditLimit,
        notes: supplierDraft.notes,
        creditStatus: 'UnderReview',
        active: true
      });
      applySupplier(supplier);
      setSupplierCreateOpen(false);
      setAllowCreateDuplicate(false);
      setFeedback('Supplier created and linked to this Purchase Order.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Supplier could not be created.');
    }
  };

  const validateLines = (requireSupplier: boolean): boolean => {
    if (requireSupplier && !supplierName.trim()) {
      setFeedback('Supplier is required before submitting for approval.');
      return false;
    }
    if (formLines.length === 0) {
      setFeedback('At least one PO line is required.');
      return false;
    }
    const invalid = formLines.find((line) => line.qtyOrdered <= 0 || line.estimatedUnitCost < 0);
    if (invalid) {
      setFeedback('Qty Ordered must be greater than 0 and Estimated Unit Cost must be 0 or higher.');
      return false;
    }
    return true;
  };

  const buildPayload = () => ({
    vendorId: order?.vendorId || getActiveVendorId(),
    branchId: deliveryBranchId,
    warehouseId: deliveryWarehouseId,
    supplierId,
    supplierCode,
    supplierName,
    supplierPhone,
    supplierEmail,
    supplierAddress,
    supplierContactPerson,
    supplierItemReference,
    requestedByStaffId: staffId || staffName,
    requestedByStaffName: staffName,
    approvedByStaffId: order?.approvedByStaffId,
    approvedByStaffName: order?.approvedByStaffName,
    poDate,
    expectedDeliveryDate,
    priority,
    source,
    status: (order?.status || 'Draft') as PurchaseOrderStatus,
    deliveryBranchId,
    deliveryWarehouseId,
    deliveryAddress,
    currency,
    subtotalEstimate: totals.subtotal,
    taxEstimate: totals.tax,
    deliveryCostEstimate,
    grandTotalEstimate: totals.grand,
    notes: [notes, deliveryNotes ? `Delivery notes: ${deliveryNotes}` : '', supplierItemReference ? `Supplier reference: ${supplierItemReference}` : ''].filter(Boolean).join('\n'),
    internalMemo,
    termsAndConditions,
    lines: formLines.map((line) => ({
      lineId: line.lineId,
      productId: line.productId,
      sku: line.sku,
      productName: line.productName,
      brand: line.brand,
      manufacturer: line.manufacturer,
      supplierItemCode: line.supplierItemCode || supplierItemReference,
      upc: line.upc,
      unitOfMeasure: line.unitOfMeasure,
      qtyOrdered: line.qtyOrdered,
      qtyReceived: line.qtyReceived,
      estimatedUnitCost: line.estimatedUnitCost,
      lastCostPrice: line.lastCostPrice,
      currentSellingPrice: line.currentSellingPrice,
      shelfLocation: line.shelfLocation,
      notes: line.notes,
      lineStatus: status === 'Draft' ? 'Draft' as const : 'Ordered' as const
    }))
  });

  const saveDraft = async (): Promise<PurchaseOrder | null> => {
    if (!validateLines(false)) return null;
    if (!(await ensureSupplierLinked())) return null;
    if (!canCreate && !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return null;
    }
    const payload = buildPayload();
    const saved = poId
      ? await updatePurchaseOrderDraft(poId, payload)
      : await createPurchaseOrder(payload);
    if (!saved) {
      setFeedback('This Purchase Order is locked and cannot be edited.');
      return null;
    }
    setPoId(saved.poId);
    setPoNumber(saved.poNumber);
    setStatus(saved.status);
    setFeedback(`${saved.poNumber} saved. No stock, accounting or cashbook posting was created.`);
    onChanged('Purchase Order saved.');
    return saved;
  };

  const handleSubmitForApproval = async () => {
    if (!validateLines(true)) return;
    if (!(await ensureSupplierLinked())) return;
    const saved = poId ? await saveDraft() : await saveDraft();
    if (!saved) return;
    const submitted = await submitPurchaseOrderForApproval(saved.poId);
    if (!submitted) {
      setFeedback('Submit for Approval failed. Check supplier and line values.');
      return;
    }
    setStatus(submitted.status);
    setFeedback(`${submitted.poNumber} submitted for approval. No stock movement or financial posting was created.`);
    onChanged('Purchase Order submitted for approval.');
  };

  const handleApprove = async () => {
    if (!canApprove) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const targetPoId = poId || order?.poId;
    if (!(await ensureSupplierLinked())) return;
    if (!targetPoId) return;
    const approved = await approvePurchaseOrder(targetPoId, staffId || staffName, 'Owner/authorized approval.');
    if (approved) {
      setStatus(approved.status);
      setFeedback(`${approved.poNumber} approved. It remains a memo only until Goods Receiving posts quantities.`);
      onChanged('Purchase Order approved.');
    }
  };

  const handleMarkSent = async () => {
    const targetPoId = poId || order?.poId;
    if (!(await ensureSupplierLinked())) return;
    if (!targetPoId) return;
    const sent = await markPurchaseOrderSent(targetPoId, staffId || staffName);
    if (sent) {
      setStatus(sent.status);
      setFeedback(`${sent.poNumber} marked Sent To Supplier. No accounting or stock posting was created.`);
      onChanged('Purchase Order marked sent.');
    }
  };

  const handleExport = async () => {
    if (!canExport) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const targetPoId = poId || order?.poId;
    if (!(await ensureSupplierLinked())) return;
    if (!targetPoId) return;
    const result = await exportPurchaseOrderPlaceholder(targetPoId);
    setFeedback(result.message);
    onChanged(result.message);
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/45 flex items-center justify-center p-4">
      <div className={`${sizeClass} bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col rounded-none overflow-hidden`}>
        <div className="h-11 bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-black uppercase text-[12px] tracking-wider">Purchase Order</div>
            {windowState !== 'minimized' && <div className="text-[8px] uppercase text-slate-300">Memo document for supplier buying intention. Stock updates only through GRN.</div>}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" title="Minimize" onClick={() => setWindowState('minimized')} className="p-1 border border-slate-700 hover:bg-slate-800"><Minus className="w-3.5 h-3.5" /></button>
            <button type="button" title="Restore" onClick={() => setWindowState('normal')} className="p-1 border border-slate-700 hover:bg-slate-800"><Square className="w-3.5 h-3.5" /></button>
            <button type="button" title="Maximize" onClick={() => setWindowState('maximized')} className="p-1 border border-slate-700 hover:bg-slate-800"><Maximize2 className="w-3.5 h-3.5" /></button>
            <button type="button" title="Close" onClick={onClose} className="p-1 border border-slate-700 hover:bg-rose-900 text-rose-200"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {windowState !== 'minimized' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white text-[#1e222b]">
              <div className="border border-orange-300 bg-orange-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
                Purchase Order is a memo document. It records what the business intends to buy from a supplier. It does not affect stock, accounting, cashbook, COGS, or inventory value until goods are received through Goods Receiving / GRN.
              </div>

              {feedback && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{feedback}</div>}

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">PO Details</h3>
                  <FormInput label="PO Number" value={poNumber} readOnly onChange={setPoNumber} />
                  <FormInput label="PO Date" type="date" value={poDate} onChange={setPoDate} />
                  <FormSelect label="Priority" value={priority} options={priorities} onChange={(value) => setPriority(value as PurchaseOrderPriority)} />
                  <FormSelect label="Source" value={source} options={sources} onChange={(value) => setSource(value as PurchaseOrderSource)} />
                  <FormInput label="Status" value={status} readOnly onChange={setStatus} />
                  <FormInput label="Requested By" value={staffName} readOnly onChange={() => undefined} />
                  <FormInput label="Expected Delivery Date" type="date" value={expectedDeliveryDate} onChange={setExpectedDeliveryDate} />
                  <FormInput label="Currency" value={currency} onChange={(value) => setCurrency(value.toUpperCase())} />
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Supplier Details</h3>
                  <div className="space-y-1 relative">
                    <span className="text-[8px] uppercase font-black text-orange-600">Supplier Name</span>
                    <div className="flex gap-1">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" aria-hidden="true" />
                        <input
                          value={supplierName}
                          onChange={(event) => updateSupplierSearch(event.target.value)}
                          onFocus={() => setSupplierSearchResults(searchSuppliers(supplierName))}
                          className={fieldClass('pl-7')}
                          placeholder="Search existing supplier by name, phone, email, contact..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => void openSupplierCreatePrompt()}
                        className="px-2 py-1.5 border border-orange-600 bg-orange-600 text-white text-[8px] uppercase font-black flex items-center gap-1"
                      >
                        <UserPlus className="w-3 h-3" /> Create
                      </button>
                    </div>
                    {supplierId && (
                      <div className="text-[8px] uppercase font-black text-emerald-700 border border-emerald-200 bg-emerald-50 px-2 py-1">
                        Linked supplier: {supplierCode || supplierId}
                      </div>
                    )}
                    {!supplierId && supplierName.trim() && (
                      <div className="text-[8px] uppercase font-black text-orange-700 border border-orange-200 bg-orange-50 px-2 py-1">
                        Supplier not linked. Select existing or create new supplier before saving.
                      </div>
                    )}
                    {supplierSearchResults.length > 0 && (
                      <div className="absolute z-20 top-[58px] left-0 right-0 bg-white border border-[#1e222b] shadow-xl max-h-52 overflow-y-auto">
                        {supplierSearchResults.map((supplier) => (
                          <button
                            key={supplier.supplierId}
                            type="button"
                            onClick={() => applySupplier(supplier)}
                            className="w-full text-left px-2 py-2 border-b border-slate-100 hover:bg-orange-50"
                          >
                            <strong className="block text-[9px] uppercase text-[#1e222b]">{supplier.supplierName}</strong>
                            <span className="block text-[8px] uppercase text-slate-500">{supplier.supplierCode} / {supplier.contactPerson || 'No contact'} / {supplier.phone || supplier.email || 'No contact details'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <FormInput label="Supplier Contact Person" value={supplierContactPerson} onChange={setSupplierContactPerson} />
                  <FormInput label="Supplier Phone" value={supplierPhone} onChange={setSupplierPhone} />
                  <FormInput label="Supplier Email" value={supplierEmail} onChange={setSupplierEmail} />
                  <FormTextarea label="Supplier Address" value={supplierAddress} onChange={setSupplierAddress} />
                  <FormInput label="Supplier Item Reference Optional" value={supplierItemReference} onChange={setSupplierItemReference} />
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Delivery Details</h3>
                  <FormInput label="Delivery Branch" value={deliveryBranchId} onChange={setDeliveryBranchId} />
                  <FormInput label="Delivery Warehouse" value={deliveryWarehouseId} onChange={setDeliveryWarehouseId} />
                  <FormTextarea label="Delivery Address" value={deliveryAddress} onChange={setDeliveryAddress} />
                  <FormTextarea label="Delivery Notes" value={deliveryNotes} onChange={setDeliveryNotes} />
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Internal Details</h3>
                  <FormTextarea label="Internal Memo" value={internalMemo} onChange={setInternalMemo} />
                  <FormTextarea label="Terms and Conditions" value={termsAndConditions} onChange={setTermsAndConditions} />
                  <FormTextarea label="Notes" value={notes} onChange={setNotes} />
                </section>
              </div>

              <section className="border border-[#b1b5c2]">
                <div className="bg-[#1e222b] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b-2 border-orange-500">
                  <span className="text-[9.5px] uppercase font-black">PO Line Item Entry</span>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setFormLines((prev) => [...prev, emptyLine(products)])} className="px-2 py-1 bg-orange-600 text-white border border-orange-700 text-[8px] uppercase font-black rounded-none flex items-center gap-1"><Plus className="w-3 h-3" /> Add Line</button>
                    <button type="button" onClick={() => void openCreateProductModal(Math.max(formLines.length - 1, 0))} className="px-2 py-1 bg-white text-[#1e222b] border border-orange-300 text-[8px] uppercase font-black rounded-none flex items-center gap-1"><UserPlus className="w-3 h-3" /> Add New Product</button>
                    <button type="button" onClick={() => setFormLines((prev) => [...prev, emptyLine(products)])} className="px-2 py-1 bg-white text-[#1e222b] border border-slate-300 text-[8px] uppercase font-black rounded-none">Add From Low Stock</button>
                    <button type="button" onClick={() => setFormLines((prev) => [...prev, emptyLine(products)])} className="px-2 py-1 bg-white text-[#1e222b] border border-slate-300 text-[8px] uppercase font-black rounded-none">Add From Stock Health</button>
                  </div>
                </div>
                <div className="procurement-table-scroll pos-custom-scroll">
                  <table className="procurement-table text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[7.5px] font-black">
                        {['Product Search', 'SKU', 'Product Name', 'Brand', 'Manufacturer', 'Supplier Item Code', 'UOM', 'Qty Ordered', 'Estimated Unit Cost', 'Estimated Line Total', 'Last Cost', 'Current Selling', 'Shelf / Location', 'Notes', 'Actions'].map((header) => (
                          <th key={header} className="px-2 py-2 whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {formLines.map((line, index) => (
                        <tr key={`${line.lineId || 'new'}-${index}`} className="hover:bg-slate-50">
                          <td className="px-2 py-2 min-w-[190px]">
                            <div className="flex gap-1 items-center">
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" aria-hidden="true" />
                                <input
                                  ref={(node) => { productSearchInputRefs.current[index] = node; }}
                                  value={line.productSearch}
                                  onChange={(event) => void runProductSearch(index, event.target.value)}
                                  onFocus={() => void runProductSearch(index, line.productSearch)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' && productSearchResults[0]) selectProductMaster(index, productSearchResults[0]);
                                  }}
                                  className={fieldClass('w-[240px] pl-7')}
                                  placeholder="Any-order product search..."
                                />
                              </div>
                              <button type="button" title="Add New Product" onClick={() => void openCreateProductModal(index, line.productSearch)} className="p-1.5 border border-orange-300 text-orange-700 hover:bg-orange-50 rounded-none"><UserPlus className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                          <td className="px-2 py-2"><input value={line.sku} onChange={(event) => updateLine(index, 'sku', event.target.value)} className={fieldClass('w-[105px]')} /></td>
                          <td className="px-2 py-2"><input value={line.productName} onChange={(event) => updateLine(index, 'productName', event.target.value)} className={fieldClass('w-[190px]')} /></td>
                          <td className="px-2 py-2"><input value={line.brand} onChange={(event) => updateLine(index, 'brand', event.target.value)} className={fieldClass('w-[110px]')} /></td>
                          <td className="px-2 py-2"><input value={line.manufacturer} onChange={(event) => updateLine(index, 'manufacturer', event.target.value)} className={fieldClass('w-[120px]')} /></td>
                          <td className="px-2 py-2"><input value={line.supplierItemCode} onChange={(event) => updateLine(index, 'supplierItemCode', event.target.value)} className={fieldClass('w-[120px]')} /></td>
                          <td className="px-2 py-2"><input value={line.unitOfMeasure} onChange={(event) => updateLine(index, 'unitOfMeasure', event.target.value)} className={fieldClass('w-[70px]')} /></td>
                          <td className="px-2 py-2"><input type="number" min={1} value={line.qtyOrdered} onChange={(event) => updateLine(index, 'qtyOrdered', Number(event.target.value))} className={fieldClass('w-[85px] text-right')} /></td>
                          <td className="px-2 py-2"><input type="number" min={0} step="0.01" value={line.estimatedUnitCost} onChange={(event) => updateLine(index, 'estimatedUnitCost', Number(event.target.value))} className={fieldClass('w-[105px] text-right')} /></td>
                          <td className="px-2 py-2 text-right font-black font-mono">{currency} {(line.qtyOrdered * line.estimatedUnitCost).toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.lastCostPrice?.toFixed(2) || '0.00'}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.currentSellingPrice?.toFixed(2) || '0.00'}</td>
                          <td className="px-2 py-2"><input value={line.shelfLocation} onChange={(event) => updateLine(index, 'shelfLocation', event.target.value)} className={fieldClass('w-[110px]')} /></td>
                          <td className="px-2 py-2"><input value={line.notes} onChange={(event) => updateLine(index, 'notes', event.target.value)} className={fieldClass('w-[170px]')} /></td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              <button type="button" title="Clear Line" onClick={() => setFormLines((prev) => prev.map((item, itemIndex) => itemIndex === index ? emptyLine(products) : item))} className="p-1 border border-[#b1b5c2] hover:bg-slate-100 rounded-none"><RotateCcw className="w-3.5 h-3.5" /></button>
                              <button type="button" title="Remove Line" onClick={() => setFormLines((prev) => prev.filter((_, itemIndex) => itemIndex !== index))} className="p-1 border border-red-300 text-red-700 hover:bg-red-50 rounded-none"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid grid-cols-2 md:grid-cols-6 gap-3 border border-[#b1b5c2] bg-slate-50 p-3">
                <TotalBox label="Estimated Line Count" value={totals.lineCount} />
                <TotalBox label="Estimated Total Qty" value={totals.totalQty} />
                <TotalBox label="Estimated Subtotal" value={`${currency} ${totals.subtotal.toFixed(2)}`} />
                <TotalBox label="Estimated Tax" value={`${currency} ${totals.tax.toFixed(2)}`} />
                <label className="block">
                  <span className="text-[8px] uppercase font-black text-slate-500">Estimated Delivery Cost</span>
                  <input type="number" min={0} step="0.01" value={deliveryCostEstimate} onChange={(event) => setDeliveryCostEstimate(Number(event.target.value))} className={fieldClass('mt-1 text-right')} />
                </label>
                <TotalBox label="Estimated Grand Total" value={`${currency} ${totals.grand.toFixed(2)}`} />
              </section>
            </div>

            <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={saveDraft} className="px-3 py-2 border border-[#b1b5c2] bg-white hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Save className="w-3.5 h-3.5" /> Save Draft</button>
              <button type="button" onClick={handleSubmitForApproval} className="px-3 py-2 border border-orange-700 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Submit for Approval</button>
              <button type="button" onClick={handleApprove} className="px-3 py-2 border border-[#b1b5c2] bg-white hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[9px] rounded-none">Approve PO</button>
              <button type="button" onClick={handleMarkSent} className="px-3 py-2 border border-[#b1b5c2] bg-white hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[9px] rounded-none">Mark Sent To Supplier</button>
              <button type="button" onClick={handleExport} className="px-3 py-2 border border-[#b1b5c2] bg-white hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Prepare Export</button>
              <button type="button" onClick={() => setFormLines([emptyLine(products)])} className="px-3 py-2 border border-[#b1b5c2] bg-white hover:bg-slate-100 text-[#1e222b] font-black uppercase text-[9px] rounded-none">Clear Form</button>
              <button type="button" onClick={onClose} className="px-3 py-2 border border-[#1e222b] bg-[#1e222b] text-white font-black uppercase text-[9px] rounded-none">Close</button>
            </div>

            {activeProductSearchIndex !== null && productDropdownRect && (
              <div
                id="po-product-search-dropdown"
                className="fixed z-[1400] bg-white border-2 border-[#1e222b] shadow-2xl max-h-72 overflow-y-auto"
                style={{
                  left: Math.max(8, Math.min(productDropdownRect.left, window.innerWidth - 430)),
                  top: Math.max(8, Math.min(productDropdownRect.bottom + 4, window.innerHeight - 300)),
                  width: Math.min(420, window.innerWidth - 16)
                }}
              >
                {productSearchResults.map((result) => (
                  <button
                    key={result.product.productId}
                    type="button"
                    onClick={() => selectProductMaster(activeProductSearchIndex, result)}
                    className="w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-orange-50 focus:bg-orange-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="block text-[9.5px] uppercase text-[#1e222b]">{result.product.sku} / {result.product.productName}</strong>
                        <span className="block text-[8px] uppercase text-slate-500">{result.product.brand || '-'} / {result.product.manufacturer || '-'} / {result.product.supplierItemCode || 'No supplier item code'}</span>
                        <span className="block text-[8px] uppercase text-slate-500">Shelf {result.shelfLocation || '-'} / Barcode {result.product.barcode || '-'}</span>
                      </div>
                      <span className="text-right text-[8px] uppercase font-black text-slate-600">
                        Stock {result.currentStock}<br />
                        Cost {result.product.defaultCostPrice.toFixed(2)}<br />
                        Sell {result.product.defaultSellingPrice.toFixed(2)}
                      </span>
                    </div>
                  </button>
                ))}
                {productSearchResults.length === 0 && (
                  <div className="p-3 space-y-2">
                    <div className="text-[9px] uppercase font-black text-slate-600">No product found.</div>
                    <button type="button" onClick={() => void openCreateProductModal(activeProductSearchIndex, formLines[activeProductSearchIndex]?.productSearch || '')} className="px-2 py-1.5 bg-orange-600 border border-orange-700 text-white text-[8px] uppercase font-black flex items-center gap-1">
                      <UserPlus className="w-3.5 h-3.5" /> Add New Product
                    </button>
                  </div>
                )}
              </div>
            )}

            {supplierCreateOpen && (
              <div className="fixed inset-0 z-[1300] bg-slate-950/45 flex items-center justify-center p-4">
                <div className="w-[min(900px,90vw)] max-h-[90vh] bg-white border-2 border-[#1e222b] shadow-2xl rounded-[2mm] overflow-hidden flex flex-col">
                  <div className="bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-black tracking-wider">Create Supplier Record</div>
                      <div className="text-[8px] uppercase text-slate-300">Source: Purchase Order. Supplier record prepared for review.</div>
                    </div>
                    <button type="button" onClick={() => setSupplierCreateOpen(false)} className="p-1 border border-slate-700 hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {supplierMatches.length > 0 && (
                      <div className="border border-orange-300 bg-orange-50 p-3 space-y-2">
                        <div className="text-[9px] uppercase font-black text-orange-700">This supplier may already exist. Use existing supplier or create new?</div>
                        <div className="grid md:grid-cols-2 gap-2">
                          {supplierMatches.map((match) => (
                            <button key={`${match.supplier.supplierId}-${match.reason}`} type="button" onClick={() => applySupplier(match.supplier)} className="text-left bg-white border border-orange-200 p-2 hover:border-orange-600">
                              <strong className="block text-[9px] uppercase text-[#1e222b]">{match.supplier.supplierName}</strong>
                              <span className="block text-[8px] uppercase text-slate-500">{match.reason} / {match.supplier.supplierCode}</span>
                            </button>
                          ))}
                        </div>
                        <button type="button" onClick={() => setAllowCreateDuplicate(true)} className={`px-2 py-1 border text-[8px] uppercase font-black ${allowCreateDuplicate ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-orange-300 text-orange-700'}`}>
                          Create New Supplier Anyway
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <SupplierDraftInput required label="Supplier Name" value={supplierDraft.supplierName} onChange={(value) => setSupplierDraft({ ...supplierDraft, supplierName: value })} />
                      <SupplierDraftInput label="Contact Person" value={supplierDraft.contactPerson} onChange={(value) => setSupplierDraft({ ...supplierDraft, contactPerson: value })} />
                      <SupplierDraftInput label="Phone" value={supplierDraft.phone} onChange={(value) => setSupplierDraft({ ...supplierDraft, phone: value })} />
                      <SupplierDraftInput label="WhatsApp" value={supplierDraft.whatsapp} onChange={(value) => setSupplierDraft({ ...supplierDraft, whatsapp: value })} />
                      <SupplierDraftInput label="Email" value={supplierDraft.email} onChange={(value) => setSupplierDraft({ ...supplierDraft, email: value })} />
                      <SupplierDraftInput label="Supplier Type" value={supplierDraft.supplierType} onChange={(value) => setSupplierDraft({ ...supplierDraft, supplierType: value })} />
                      <SupplierDraftInput label="City/Town" value={supplierDraft.cityTown} onChange={(value) => setSupplierDraft({ ...supplierDraft, cityTown: value })} />
                      <SupplierDraftInput label="District" value={supplierDraft.district} onChange={(value) => setSupplierDraft({ ...supplierDraft, district: value })} />
                      <SupplierDraftInput label="Suburb" value={supplierDraft.suburb} onChange={(value) => setSupplierDraft({ ...supplierDraft, suburb: value })} />
                      <SupplierDraftInput label="Tax Number" value={supplierDraft.taxNumber} onChange={(value) => setSupplierDraft({ ...supplierDraft, taxNumber: value })} />
                      <label className="block space-y-1">
                        <span className="text-[8px] uppercase font-normal text-orange-600">VAT Status</span>
                        <select value={supplierDraft.vatStatus} onChange={(event) => setSupplierDraft({ ...supplierDraft, vatStatus: event.target.value as SupplierVatStatus })} className={fieldClass()}>
                          {['Unknown', 'VATRegistered', 'NotRegistered', 'Exempt'].map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption}</option>)}
                        </select>
                      </label>
                      <SupplierDraftInput type="number" label="Payment Terms Days" value={String(supplierDraft.paymentTermsDays)} onChange={(value) => setSupplierDraft({ ...supplierDraft, paymentTermsDays: Number(value) || 0 })} />
                      <SupplierDraftInput type="number" label="Credit Limit" value={String(supplierDraft.creditLimit)} onChange={(value) => setSupplierDraft({ ...supplierDraft, creditLimit: Number(value) || 0 })} />
                    </div>

                    <label className="block space-y-1">
                      <span className="text-[8px] uppercase font-normal text-orange-600">Address</span>
                      <textarea rows={3} value={supplierDraft.address} onChange={(event) => setSupplierDraft({ ...supplierDraft, address: event.target.value })} className={fieldClass('resize-none')} />
                    </label>
                    <label className="block space-y-1">
                      <span className="text-[8px] uppercase font-normal text-orange-600">Notes</span>
                      <textarea rows={3} value={supplierDraft.notes} onChange={(event) => setSupplierDraft({ ...supplierDraft, notes: event.target.value })} className={fieldClass('resize-none')} />
                    </label>
                  </div>

                  <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-3 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => supplierMatches[0] && applySupplier(supplierMatches[0].supplier)} disabled={!supplierMatches[0]} className="px-3 py-2 border border-[#b1b5c2] bg-white disabled:opacity-40 text-[#1e222b] font-black uppercase text-[9px] rounded-none">Use Existing Supplier</button>
                    <button type="button" onClick={() => setSupplierCreateOpen(false)} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Cancel</button>
                    <button type="button" onClick={() => void createAndLinkSupplier()} className="px-3 py-2 border border-orange-700 bg-orange-600 text-white font-black uppercase text-[9px] rounded-none flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Create and Link Supplier</button>
                  </div>
                </div>
              </div>
            )}

            {productCreateOpen && (
              <div className="fixed inset-0 z-[1350] bg-slate-950/45 flex items-center justify-center p-4">
                <div className="w-[min(980px,90vw)] max-h-[90vh] bg-white border-2 border-[#1e222b] shadow-2xl rounded-[2mm] overflow-hidden flex flex-col">
                  <div className="bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-black tracking-wider">Create Product from Purchase Order</div>
                      <div className="text-[8px] uppercase text-slate-300">Creates Product Master draft only. No stock quantity is created from a PO.</div>
                    </div>
                    <button type="button" onClick={() => setProductCreateOpen(false)} className="p-1 border border-slate-700 hover:bg-slate-800"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {productDuplicateNotice && <div className="border border-orange-300 bg-orange-50 p-2 text-[9px] uppercase font-black text-orange-700">{productDuplicateNotice}</div>}
                    {!supplierId && <div className="border border-orange-300 bg-orange-50 p-2 text-[9px] uppercase font-black text-orange-700">Supplier is not linked yet. Link supplier before submitting PO.</div>}

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                      <ProductDraftInput label="SKU / Product Code" value={productDraft.sku} onChange={(value) => setProductDraft({ ...productDraft, sku: value })} />
                      <ProductDraftInput required label="Product Name" value={productDraft.productName} onChange={(value) => setProductDraft({ ...productDraft, productName: value })} />
                      <ProductDraftInput label="Brand" value={productDraft.brand} onChange={(value) => setProductDraft({ ...productDraft, brand: value })} />
                      <ProductDraftInput label="Manufacturer" value={productDraft.manufacturer} onChange={(value) => setProductDraft({ ...productDraft, manufacturer: value })} />
                      <ProductDraftInput label="Category" value={productDraft.category} onChange={(value) => setProductDraft({ ...productDraft, category: value })} />
                      <ProductDraftInput label="Department" value={productDraft.department} onChange={(value) => setProductDraft({ ...productDraft, department: value })} />
                      <ProductDraftInput label="Supplier" value={productDraft.supplierName} onChange={(value) => setProductDraft({ ...productDraft, supplierName: value })} />
                      <ProductDraftInput label="Supplier Item Code" value={productDraft.supplierItemCode} onChange={(value) => setProductDraft({ ...productDraft, supplierItemCode: value })} />
                      <ProductDraftInput label="UPC / Barcode" value={productDraft.upc} onChange={(value) => setProductDraft({ ...productDraft, upc: value })} />
                      <ProductDraftInput label="Unit of Measure" value={productDraft.unitOfMeasure} onChange={(value) => setProductDraft({ ...productDraft, unitOfMeasure: value })} />
                      <ProductDraftInput type="number" label="Estimated Unit Cost" value={String(productDraft.estimatedUnitCost)} onChange={(value) => setProductDraft({ ...productDraft, estimatedUnitCost: Number(value) || 0 })} />
                      <ProductDraftInput type="number" label="Selling Price" value={String(productDraft.sellingPrice)} onChange={(value) => setProductDraft({ ...productDraft, sellingPrice: Number(value) || 0 })} />
                      <ProductDraftInput label="Shelf / Location" value={productDraft.shelfLocation} onChange={(value) => setProductDraft({ ...productDraft, shelfLocation: value })} />
                      <ProductDraftInput type="number" label="Reorder Point" value={String(productDraft.reorderPoint)} onChange={(value) => setProductDraft({ ...productDraft, reorderPoint: Number(value) || 0 })} />
                      <ProductDraftInput label="Tax Code" value={productDraft.taxCode} onChange={(value) => setProductDraft({ ...productDraft, taxCode: value })} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 border border-orange-200 p-2">
                      <ProductDraftInput label="Part Number" value={productDraft.partNumber} onChange={(value) => setProductDraft({ ...productDraft, partNumber: value })} />
                      <ProductDraftInput label="Alternate Part Number" value={productDraft.alternatePartNumber} onChange={(value) => setProductDraft({ ...productDraft, alternatePartNumber: value })} />
                      <ProductDraftInput label="Vehicle Make" value={productDraft.vehicleMake} onChange={(value) => setProductDraft({ ...productDraft, vehicleMake: value })} />
                      <ProductDraftInput label="Vehicle Model" value={productDraft.vehicleModel} onChange={(value) => setProductDraft({ ...productDraft, vehicleModel: value })} />
                      <ProductDraftInput label="Year From" value={productDraft.yearFrom} onChange={(value) => setProductDraft({ ...productDraft, yearFrom: value })} />
                      <ProductDraftInput label="Year To" value={productDraft.yearTo} onChange={(value) => setProductDraft({ ...productDraft, yearTo: value })} />
                      <ProductDraftInput label="Side" value={productDraft.side} onChange={(value) => setProductDraft({ ...productDraft, side: value })} />
                      <ProductDraftInput label="Condition" value={productDraft.condition} onChange={(value) => setProductDraft({ ...productDraft, condition: value })} />
                      <label className="block space-y-1 md:col-span-4">
                        <span className="text-[8px] uppercase font-normal text-orange-600">Compatibility Tags</span>
                        <input value={productDraft.compatibilityTags} onChange={(event) => setProductDraft({ ...productDraft, compatibilityTags: event.target.value })} className={fieldClass()} placeholder="Comma-separated tags" />
                      </label>
                    </div>

                    <label className="block space-y-1">
                      <span className="text-[8px] uppercase font-normal text-orange-600">Notes</span>
                      <textarea rows={3} value={productDraft.notes} onChange={(event) => setProductDraft({ ...productDraft, notes: event.target.value })} className={fieldClass('resize-none')} />
                    </label>
                  </div>

                  <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-3 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setProductCreateOpen(false)} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Cancel</button>
                    <button type="button" onClick={() => void saveProductDraftOnly()} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Save Product Draft</button>
                    <button type="button" onClick={() => void createProductAndAddToPO()} className="px-3 py-2 border border-orange-700 bg-orange-600 text-white font-black uppercase text-[9px] rounded-none flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" /> Create Product and Add to PO</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', readOnly = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <input type={type} value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} className={fieldClass(readOnly ? 'bg-slate-100' : '')} />
    </label>
  );
}

function FormTextarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <textarea rows={2} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('resize-none')} />
    </label>
  );
}

function FormSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SupplierDraftInput({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-normal text-orange-600">{label}{required ? ' *' : ''}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()} />
    </label>
  );
}

function ProductDraftInput({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-normal text-orange-600">{label}{required ? ' *' : ''}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass()} />
    </label>
  );
}

function TotalBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#b1b5c2] p-2">
      <div className="text-[8px] uppercase font-black text-slate-500">{label}</div>
      <div className="mt-1 text-[12px] font-black text-[#1e222b] uppercase">{value}</div>
    </div>
  );
}
