import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Eye, Maximize2, Minus, PackageCheck, Save, Send, Square, Trash2, Truck, X } from 'lucide-react';
import {
  Product,
  StockTransfer,
  StockTransferLine,
  StockTransferStatus,
  StockTransferType
} from '../types';
import { getActiveVendorId } from '../utils/vendorDataMode';

type TransferProduct = Product & {
  sku?: string;
  productName?: string;
  qtyOnHand?: number;
  brand?: string;
  productCategory?: string;
  shelfLocation?: string;
  lastCost?: number;
};

interface StockTransferFormProps {
  open: boolean;
  transfer: StockTransfer | null;
  lines: StockTransferLine[];
  products: TransferProduct[];
  operatorName: string;
  branchOptions: string[];
  warehouseOptions: string[];
  onClose: () => void;
  onCreateDraft: (payload: Omit<StockTransfer, 'transferId' | 'transferNumber' | 'transferDate' | 'status' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateDraft: (patch: Partial<StockTransfer>) => void;
  onAddLine: (productId: string, qtyRequested: number) => void;
  onUpdateLine: (lineId: string, patch: Partial<StockTransferLine>) => void;
  onRemoveLine: (lineId: string) => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDispatch: () => void;
  onReceive: () => void;
  onPostReceipt: () => void;
  onCloseOutstanding: () => void;
  onCancel: () => void;
  onExport: () => void;
  onViewLedger: (productId: string) => void;
}

const TRANSFER_TYPES: StockTransferType[] = [
  'Branch To Branch',
  'Warehouse To Warehouse',
  'Warehouse To Branch',
  'Branch To Warehouse',
  'Store To Sales Floor',
  'Sales Floor To Store',
  'Good Stock To Damaged Holding',
  'Good Stock To Return Holding',
  'Return Holding To Supplier Return Preparation',
  'Other'
];

export default function StockTransferForm({
  open,
  transfer,
  lines,
  products,
  operatorName,
  branchOptions,
  warehouseOptions,
  onClose,
  onCreateDraft,
  onUpdateDraft,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
  onSubmit,
  onApprove,
  onReject,
  onDispatch,
  onReceive,
  onPostReceipt,
  onCloseOutstanding,
  onCancel,
  onExport,
  onViewLedger
}: StockTransferFormProps) {
  const [windowState, setWindowState] = useState<'normal' | 'minimized' | 'maximized'>('normal');
  const [transferType, setTransferType] = useState<StockTransferType>('Warehouse To Branch');
  const [priority, setPriority] = useState<StockTransfer['priority']>('Normal');
  const [reason, setReason] = useState('Branch replenishment');
  const [sourceBranchName, setSourceBranchName] = useState(branchOptions[0] || 'Main Branch');
  const [sourceWarehouseName, setSourceWarehouseName] = useState(warehouseOptions[0] || 'Main Warehouse');
  const [destinationBranchName, setDestinationBranchName] = useState(branchOptions[0] || 'Main Branch');
  const [destinationWarehouseName, setDestinationWarehouseName] = useState(warehouseOptions[1] || warehouseOptions[0] || 'Main Warehouse');
  const [expectedArrivalDate, setExpectedArrivalDate] = useState(new Date().toISOString().slice(0, 10));
  const [transportMethod, setTransportMethod] = useState('Internal Runner');
  const [courierReference, setCourierReference] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [notes, setNotes] = useState('Transfer request does not affect stock.');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [qtyRequested, setQtyRequested] = useState('1');

  useEffect(() => {
    setTransferType(transfer?.transferType || 'Warehouse To Branch');
    setPriority(transfer?.priority || 'Normal');
    setReason(transfer?.reason || 'Branch replenishment');
    setSourceBranchName(transfer?.sourceBranchName || branchOptions[0] || 'Main Branch');
    setSourceWarehouseName(transfer?.sourceWarehouseName || warehouseOptions[0] || 'Main Warehouse');
    setDestinationBranchName(transfer?.destinationBranchName || branchOptions[0] || 'Main Branch');
    setDestinationWarehouseName(transfer?.destinationWarehouseName || warehouseOptions[1] || warehouseOptions[0] || 'Main Warehouse');
    setExpectedArrivalDate(transfer?.expectedArrivalDate || new Date().toISOString().slice(0, 10));
    setTransportMethod(transfer?.transportMethod || 'Internal Runner');
    setCourierReference(transfer?.courierReference || '');
    setDriverName(transfer?.driverName || '');
    setDriverPhone(transfer?.driverPhone || '');
    setNotes(transfer?.notes || 'Transfer request does not affect stock.');
  }, [branchOptions, transfer, warehouseOptions]);

  const isLocked = Boolean(transfer && ['Fully Received', 'Closed With Outstanding', 'Cancelled', 'Rejected', 'Reversed'].includes(transfer.status));
  const canEditDraft = !transfer || transfer.status === 'Draft';
  const productMatches = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => !query || `${product.sku || product.code} ${product.productName || product.name}`.toLowerCase().includes(query)).slice(0, 8);
  }, [productSearch, products]);
  const selectedProduct = products.find((product) => product.id === selectedProductId) || productMatches[0];

  if (!open) return null;

  const saveDraft = () => {
    const payload = {
      vendorId: getActiveVendorId(),
      transferType,
      sourceBranchId: sourceBranchName,
      sourceBranchName,
      sourceWarehouseId: sourceWarehouseName,
      sourceWarehouseName,
      destinationBranchId: destinationBranchName,
      destinationBranchName,
      destinationWarehouseId: destinationWarehouseName,
      destinationWarehouseName,
      requestedByStaffId: operatorName,
      requestedByStaffName: operatorName,
      expectedArrivalDate,
      priority,
      reason,
      transportMethod,
      courierReference,
      driverName,
      driverPhone,
      notes
    };
    if (transfer) onUpdateDraft(payload);
    else onCreateDraft(payload);
  };

  const addLine = () => {
    const qty = Number(qtyRequested);
    if (!selectedProduct || !Number.isFinite(qty) || qty <= 0) return;
    onAddLine(selectedProduct.id, qty);
  };

  const panelClass = windowState === 'maximized'
    ? 'fixed inset-3'
    : 'fixed left-1/2 top-8 w-[min(1380px,calc(100vw-28px))] -translate-x-1/2';

  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <section className={`${panelClass} bg-white border border-[#111827] shadow-2xl max-h-[calc(100vh-56px)] flex flex-col rounded-none`}>
        <header className="bg-[#1e222b] text-white border-b-2 border-orange-600 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wide">Stock Transfer</h2>
            <p className="text-[10px] text-slate-200 uppercase">Move stock between branches, warehouses, sales floor, and holding areas.</p>
          </div>
          <div className="flex items-center gap-1">
            <TitleButton title="Minimize" onClick={() => setWindowState('minimized')} icon={<Minus className="w-3.5 h-3.5" />} />
            <TitleButton title="Restore" onClick={() => setWindowState('normal')} icon={<Square className="w-3.5 h-3.5" />} />
            <TitleButton title="Maximize" onClick={() => setWindowState('maximized')} icon={<Maximize2 className="w-3.5 h-3.5" />} />
            <TitleButton title="Close" onClick={onClose} icon={<X className="w-3.5 h-3.5" />} />
          </div>
        </header>

        {windowState === 'minimized' ? (
          <div className="p-4 text-[11px] uppercase font-bold text-slate-700">Form minimized. Restore to continue transfer control.</div>
        ) : (
          <div className="overflow-y-auto bg-[#f5f6f8] p-4 space-y-4 text-[11px]">
            <div className="border-l-4 border-l-orange-600 border border-[#b1b5c2] bg-white p-3 font-bold uppercase text-slate-800">
              Transfer requests and approvals do not change stock. Dispatch posts source movement only; Post Receipt posts destination accepted quantity only.
            </div>

            <Section title="Transfer Details">
              <ReadField label="Transfer Number" value={transfer?.transferNumber || 'Auto-generated on save'} />
              <ReadField label="Transfer Date" value={transfer?.transferDate || new Date().toISOString().slice(0, 10)} />
              <SelectField label="Transfer Type" value={transferType} options={TRANSFER_TYPES} onChange={(value) => setTransferType(value as StockTransferType)} disabled={!canEditDraft} />
              <ReadField label="Status" value={(transfer?.status || 'Draft') as StockTransferStatus} />
              <SelectField label="Priority" value={priority} options={['Low', 'Normal', 'High', 'Urgent']} onChange={(value) => setPriority(value as StockTransfer['priority'])} disabled={!canEditDraft} />
              <TextField label="Reason" value={reason} onChange={setReason} disabled={!canEditDraft} />
              <ReadField label="Requested By" value={transfer?.requestedByStaffName || operatorName} />
              <TextField label="Expected Arrival Date" value={expectedArrivalDate} onChange={setExpectedArrivalDate} disabled={!canEditDraft} type="date" />
            </Section>

            <Section title="Source and Destination">
              <SelectField label="Source Branch" value={sourceBranchName} options={branchOptions} onChange={setSourceBranchName} disabled={!canEditDraft} />
              <SelectField label="Source Warehouse" value={sourceWarehouseName} options={warehouseOptions} onChange={setSourceWarehouseName} disabled={!canEditDraft} />
              <SelectField label="Destination Branch" value={destinationBranchName} options={branchOptions} onChange={setDestinationBranchName} disabled={!canEditDraft} />
              <SelectField label="Destination Warehouse" value={destinationWarehouseName} options={warehouseOptions} onChange={setDestinationWarehouseName} disabled={!canEditDraft} />
            </Section>

            <Section title="Transport">
              <TextField label="Transport Method" value={transportMethod} onChange={setTransportMethod} disabled={isLocked} />
              <TextField label="Courier Reference" value={courierReference} onChange={setCourierReference} disabled={isLocked} />
              <TextField label="Driver Name" value={driverName} onChange={setDriverName} disabled={isLocked} />
              <TextField label="Driver Phone" value={driverPhone} onChange={setDriverPhone} disabled={isLocked} />
              <TextField label="Dispatch / Receiving Notes" value={notes} onChange={setNotes} disabled={isLocked} />
            </Section>

            <div className="border border-[#b1b5c2] bg-white p-3">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[10px] font-black uppercase">Transfer Line Entry</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                <TextField label="Product Search" value={productSearch} onChange={setProductSearch} disabled={!canEditDraft} />
                <SelectField label="Product" value={selectedProductId} options={productMatches.map((product) => product.id)} onChange={setSelectedProductId} disabled={!canEditDraft} />
                <ReadField label="Source Available Qty" value={String(selectedProduct?.qtyOnHand ?? selectedProduct?.stock ?? 0)} />
                <TextField label="Qty Requested" value={qtyRequested} onChange={setQtyRequested} disabled={!canEditDraft} type="number" />
                <button type="button" onClick={addLine} disabled={!canEditDraft || !transfer} className="self-end px-3 py-2 bg-orange-600 text-white border border-orange-700 text-[9px] font-black uppercase disabled:bg-slate-300 rounded-none">Add Line</button>
              </div>
            </div>

            <div className="overflow-x-auto border border-[#b1b5c2] bg-white">
              <table className="industrial-table min-w-[1560px]">
                <thead>
                  <tr>
                    {['SKU', 'Product Name', 'Brand', 'Category', 'Source Shelf', 'Destination Shelf', 'Requested', 'Approved', 'Dispatched', 'Received', 'Accepted', 'Rejected', 'Outstanding', 'Unit Cost', 'Value Impact', 'Variance', 'Status', 'Notes', 'Action'].map((label) => (
                      <th key={label} className="py-2 px-3">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line) => (
                    <tr key={line.lineId} className="bg-white">
                      <td className="py-2 px-3 font-black text-orange-700">{line.sku}</td>
                      <td className="py-2 px-3 font-bold uppercase text-[#1e222b]">{line.productName}</td>
                      <td className="py-2 px-3 uppercase">{line.brand}</td>
                      <td className="py-2 px-3 uppercase">{line.category}</td>
                      <td className="py-2 px-3"><LineInput value={line.sourceShelfLocation} disabled={!canEditDraft} onChange={(value) => onUpdateLine(line.lineId, { sourceShelfLocation: value })} /></td>
                      <td className="py-2 px-3"><LineInput value={line.destinationShelfLocation} disabled={isLocked} onChange={(value) => onUpdateLine(line.lineId, { destinationShelfLocation: value })} /></td>
                      <td className="py-2 px-3 text-right">{line.qtyRequested}</td>
                      <td className="py-2 px-3"><QtyInput value={line.qtyApproved} disabled={isLocked} onChange={(value) => onUpdateLine(line.lineId, { qtyApproved: value })} /></td>
                      <td className="py-2 px-3"><QtyInput value={line.qtyDispatched} disabled={isLocked || line.dispatchPosted} onChange={(value) => onUpdateLine(line.lineId, { qtyDispatched: value })} /></td>
                      <td className="py-2 px-3"><QtyInput value={line.qtyReceived} disabled={isLocked} onChange={(value) => onUpdateLine(line.lineId, { qtyReceived: value })} /></td>
                      <td className="py-2 px-3"><QtyInput value={line.qtyAccepted} disabled={isLocked || line.receiptPosted} onChange={(value) => onUpdateLine(line.lineId, { qtyAccepted: value })} /></td>
                      <td className="py-2 px-3"><QtyInput value={line.qtyRejected} disabled={isLocked || line.receiptPosted} onChange={(value) => onUpdateLine(line.lineId, { qtyRejected: value })} /></td>
                      <td className="py-2 px-3 text-right font-black">{line.qtyOutstanding}</td>
                      <td className="py-2 px-3 text-right">USD {line.unitCost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-black">USD {line.valueImpact.toFixed(2)}</td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{line.varianceType}</span></td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{line.lineStatus}</span></td>
                      <td className="py-2 px-3"><LineInput value={line.notes} disabled={isLocked} onChange={(value) => onUpdateLine(line.lineId, { notes: value })} /></td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1">
                          <IconButton title="View Product Ledger" onClick={() => onViewLedger(line.productId)} icon={<Eye className="w-3.5 h-3.5" />} />
                          <IconButton title="Remove Line" onClick={() => onRemoveLine(line.lineId)} disabled={!canEditDraft} icon={<Trash2 className="w-3.5 h-3.5" />} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {lines.length === 0 && (
                    <tr><td colSpan={19} className="py-8 text-center uppercase font-bold text-slate-500">Save draft, then add transfer lines.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="sticky bottom-0 bg-white border border-[#b1b5c2] p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] uppercase font-bold text-slate-600">Accounting impact remains inventory movement / pending accounting review.</span>
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Save Draft" icon={<Save className="w-3.5 h-3.5" />} onClick={saveDraft} disabled={isLocked} />
                <ActionButton label="Submit for Approval" icon={<Send className="w-3.5 h-3.5" />} onClick={onSubmit} disabled={!transfer || isLocked} />
                <ActionButton label="Approve" icon={<Check className="w-3.5 h-3.5" />} onClick={onApprove} disabled={!transfer || isLocked} />
                <ActionButton label="Reject" icon={<X className="w-3.5 h-3.5" />} onClick={onReject} disabled={!transfer || isLocked} />
                <ActionButton label="Dispatch" icon={<Truck className="w-3.5 h-3.5" />} onClick={onDispatch} disabled={!transfer || isLocked} />
                <ActionButton label="Receive Draft" icon={<PackageCheck className="w-3.5 h-3.5" />} onClick={onReceive} disabled={!transfer || isLocked} />
                <ActionButton label="Post Destination Stock" primary icon={<Check className="w-3.5 h-3.5" />} onClick={onPostReceipt} disabled={!transfer || isLocked} />
                <ActionButton label="Close With Outstanding" icon={<Square className="w-3.5 h-3.5" />} onClick={onCloseOutstanding} disabled={!transfer || isLocked} />
                <ActionButton label="Cancel" icon={<X className="w-3.5 h-3.5" />} onClick={onCancel} disabled={!transfer || isLocked} />
                <ActionButton label="Prepare Export" icon={<Download className="w-3.5 h-3.5" />} onClick={onExport} disabled={!transfer} />
                <ActionButton label="Clear Form" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => setProductSearch('')} />
                <ActionButton label="Close" icon={<X className="w-3.5 h-3.5" />} onClick={onClose} />
              </div>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}

function TitleButton({ title, icon, onClick }: { title: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" title={title} onClick={onClick} className="border border-slate-500 bg-slate-800 hover:bg-slate-700 p-1 rounded-none">{icon}</button>;
}

function IconButton({ title, icon, onClick, disabled = false }: { title: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" title={title} onClick={onClick} disabled={disabled} className="border border-[#b1b5c2] bg-white hover:bg-orange-50 disabled:bg-slate-100 disabled:text-slate-400 p-1 rounded-none">{icon}</button>;
}

function ActionButton({ label, icon, onClick, primary = false, disabled = false }: { label: string; icon: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex items-center gap-1 border px-3 py-2 rounded-none text-[9px] font-black uppercase disabled:bg-slate-200 disabled:text-slate-500 ${primary ? 'bg-orange-600 border-orange-700 text-white hover:bg-orange-700' : 'bg-white border-[#b1b5c2] text-slate-800 hover:bg-slate-50'}`}>
      {icon}
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <div className="bg-[#1e222b] text-white px-3 py-2 text-[10px] font-black uppercase">{title}</div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return <label className="block"><span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span><span className="block border border-[#b1b5c2] bg-slate-50 px-2 py-1.5 font-bold text-slate-800 min-h-[29px]">{value}</span></label>;
}

function TextField({ label, value, onChange, disabled = false, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="block"><span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full border border-[#8d8780] bg-white px-2 py-1.5 rounded-none disabled:bg-slate-100" /></label>;
}

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block"><span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full border border-[#8d8780] bg-white px-2 py-1.5 rounded-none disabled:bg-slate-100">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function QtyInput({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) {
  return <input type="number" min={0} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value) || 0)} className="w-[78px] border border-[#8d8780] px-2 py-1 text-right font-black rounded-none disabled:bg-slate-100" />;
}

function LineInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <input value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-full min-w-[110px] border border-[#b1b5c2] px-2 py-1 rounded-none disabled:bg-slate-100" />;
}
