import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, Minus, Plus, RotateCcw, Save, Send, Square, Trash2, X } from 'lucide-react';
import {
  Product,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderPriority,
  PurchaseOrderSource,
  Role
} from '../types';
import {
  approvePurchaseOrder,
  createPurchaseOrder,
  exportPurchaseOrderPlaceholder,
  markPurchaseOrderSent,
  submitPurchaseOrderForApproval,
  updatePurchaseOrderDraft
} from '../services/purchaseOrderService';
import { canPerformAction } from '../utils/posPermissions';

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
  sku: string;
  productName: string;
  brand: string;
  manufacturer: string;
  supplierItemCode: string;
  unitOfMeasure: string;
  qtyOrdered: number;
  qtyReceived: number;
  estimatedUnitCost: number;
  lastCostPrice?: number;
  currentSellingPrice?: number;
  shelfLocation: string;
  notes: string;
}

const priorities: PurchaseOrderPriority[] = ['Low', 'Normal', 'High', 'Urgent'];
const sources: PurchaseOrderSource[] = ['Manual', 'Low Stock Recommendation', 'Stock Health Recommendation', 'Supplier Reorder', 'Import Draft', 'Owner Request'];

function emptyLine(products: Product[]): FormLine {
  const product = products[0];
  return {
    productId: product?.id || '',
    sku: product?.sku || product?.code || '',
    productName: product?.productName || product?.name || '',
    brand: product?.brand || '',
    manufacturer: product?.manufacturer || '',
    supplierItemCode: '',
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
    sku: line.sku,
    productName: line.productName,
    brand: line.brand,
    manufacturer: line.manufacturer,
    supplierItemCode: line.supplierItemCode || '',
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
  const [supplierName, setSupplierName] = useState(order?.supplierName || '');
  const [supplierContactPerson, setSupplierContactPerson] = useState(order?.supplierContactPerson || '');
  const [supplierPhone, setSupplierPhone] = useState(order?.supplierPhone || '');
  const [supplierEmail, setSupplierEmail] = useState(order?.supplierEmail || '');
  const [supplierAddress, setSupplierAddress] = useState(order?.supplierAddress || '');
  const [supplierItemReference, setSupplierItemReference] = useState('');
  const [deliveryBranchId, setDeliveryBranchId] = useState(order?.deliveryBranchId || activeBranch);
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState(order?.deliveryWarehouseId || 'Main Warehouse');
  const [deliveryAddress, setDeliveryAddress] = useState(order?.deliveryAddress || 'Harare Main receiving bay');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [internalMemo, setInternalMemo] = useState(order?.internalMemo || '');
  const [termsAndConditions, setTermsAndConditions] = useState(order?.termsAndConditions || 'Supplier invoice and GRN required before stock is updated.');
  const [notes, setNotes] = useState(order?.notes || '');
  const [deliveryCostEstimate, setDeliveryCostEstimate] = useState(order?.deliveryCostEstimate || 0);
  const [formLines, setFormLines] = useState<FormLine[]>(lines.length ? lines.map(lineFromPOLine) : [emptyLine(products)]);
  const [feedback, setFeedback] = useState<string | null>(null);

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
    setSupplierName(order?.supplierName || '');
    setSupplierContactPerson(order?.supplierContactPerson || '');
    setSupplierPhone(order?.supplierPhone || '');
    setSupplierEmail(order?.supplierEmail || '');
    setSupplierAddress(order?.supplierAddress || '');
    setSupplierItemReference('');
    setDeliveryBranchId(order?.deliveryBranchId || activeBranch);
    setDeliveryWarehouseId(order?.deliveryWarehouseId || 'Main Warehouse');
    setDeliveryAddress(order?.deliveryAddress || 'Harare Main receiving bay');
    setDeliveryNotes('');
    setInternalMemo(order?.internalMemo || '');
    setTermsAndConditions(order?.termsAndConditions || 'Supplier invoice and GRN required before stock is updated.');
    setNotes(order?.notes || '');
    setDeliveryCostEstimate(order?.deliveryCostEstimate || 0);
    setFormLines(lines.length ? lines.map(lineFromPOLine) : [emptyLine(products)]);
    setFeedback(null);
  }, [activeBranch, lines, open, order, products]);

  const canCreate = canPerformAction(role, 'purchaseOrders.create');
  const canEdit = canPerformAction(role, 'purchaseOrders.edit');
  const canApprove = canPerformAction(role, 'purchaseOrders.approve') || canPerformAction(role, 'inventory.approveImport') || canPerformAction(role, 'approvals.approve');
  const canExport = canPerformAction(role, 'purchaseOrders.export');

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
      : 'w-[min(1180px,calc(100vw-32px))] h-[min(820px,calc(100vh-32px))]';

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
      sku: product.sku || product.code,
      productName: product.productName || product.name,
      brand: product.brand || '',
      manufacturer: product.manufacturer || '',
      unitOfMeasure: product.unitOfMeasure || product.unit || 'pcs',
      estimatedUnitCost: product.costPrice ?? product.cost ?? line.estimatedUnitCost,
      lastCostPrice: product.costPrice ?? product.cost,
      currentSellingPrice: product.sellingPrice ?? product.price,
      shelfLocation: product.shelfLocation || ''
    } : line));
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
    vendorId: order?.vendorId || 'SCI-LOG-ZW',
    branchId: deliveryBranchId,
    warehouseId: deliveryWarehouseId,
    supplierId: order?.supplierId || supplierName.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 32) || 'SUP-DRAFT',
    supplierName,
    supplierPhone,
    supplierEmail,
    supplierAddress,
    supplierContactPerson,
    requestedByStaffId: staffId || staffName,
    requestedByStaffName: staffName,
    approvedByStaffId: order?.approvedByStaffId,
    approvedByStaffName: order?.approvedByStaffName,
    poDate,
    expectedDeliveryDate,
    priority,
    source,
    status: 'Draft' as const,
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
      supplierItemCode: line.supplierItemCode,
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
    if (!canCreate && !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return null;
    }
    const payload = buildPayload();
    const saved = poId
      ? await updatePurchaseOrderDraft(poId, payload)
      : await createPurchaseOrder(payload);
    if (!saved) {
      setFeedback('Only Draft Purchase Orders can be edited.');
      return null;
    }
    setPoId(saved.poId);
    setPoNumber(saved.poNumber);
    setStatus(saved.status);
    setFeedback(`${saved.poNumber} saved as Draft. No stock, accounting or cashbook posting was created.`);
    onChanged('Purchase Order draft saved locally.');
    return saved;
  };

  const handleSubmitForApproval = async () => {
    if (!validateLines(true)) return;
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
    if (!targetPoId) return;
    const approved = await approvePurchaseOrder(targetPoId, staffId || staffName, 'Owner/authorized build-development approval.');
    if (approved) {
      setStatus(approved.status);
      setFeedback(`${approved.poNumber} approved. It remains a memo only until Goods Receiving posts quantities.`);
      onChanged('Purchase Order approved.');
    }
  };

  const handleMarkSent = async () => {
    const targetPoId = poId || order?.poId;
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
            <div className="font-black uppercase text-[10.5px] tracking-wider">Purchase Order Memo</div>
            {windowState !== 'minimized' && <div className="text-[8px] uppercase text-slate-300">Supplier order request. Stock will update only after Goods Receiving.</div>}
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
                  <FormInput label="Supplier Name" value={supplierName} onChange={setSupplierName} />
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
                    <button type="button" onClick={() => setFormLines((prev) => [...prev, emptyLine(products)])} className="px-2 py-1 bg-white text-[#1e222b] border border-slate-300 text-[8px] uppercase font-black rounded-none">Add From Low Stock Placeholder</button>
                    <button type="button" onClick={() => setFormLines((prev) => [...prev, emptyLine(products)])} className="px-2 py-1 bg-white text-[#1e222b] border border-slate-300 text-[8px] uppercase font-black rounded-none">Add From Stock Health Placeholder</button>
                  </div>
                </div>
                <div className="overflow-x-auto pos-custom-scroll">
                  <table className="w-full min-w-[1500px] text-[9.5px] text-left border-collapse">
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
                            <select value={line.productId} onChange={(event) => selectProduct(index, event.target.value)} className={fieldClass()}>
                              {products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}
                            </select>
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

function TotalBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#b1b5c2] p-2">
      <div className="text-[8px] uppercase font-black text-slate-500">{label}</div>
      <div className="mt-1 text-[12px] font-black text-[#1e222b] uppercase">{value}</div>
    </div>
  );
}
