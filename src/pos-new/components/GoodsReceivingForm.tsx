import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, Minus, PackageCheck, RotateCcw, Square, Trash2, X } from 'lucide-react';
import {
  GoodsReceivingLine,
  GoodsReceivingAcquisitionType,
  GoodsReceivingPaymentSource,
  GoodsReceivingNote,
  GoodsReceivingPostingResult,
  Role
} from '../types';
import {
  approveGRN,
  cancelGRN,
  exportGRNPlaceholder,
  getGoodsReceivingLines,
  postGRN,
  removeLineFromCurrentGRN,
  submitGRNForApproval,
  updateGRNDraft,
  updateGRNLine,
  markLineNotSupplied
} from '../services/goodsReceivingService';
import { canPerformAction } from '../utils/posPermissions';

type WindowState = 'normal' | 'minimized' | 'maximized';

interface GoodsReceivingFormProps {
  open: boolean;
  grn: GoodsReceivingNote | null;
  role: Role;
  staffName: string;
  onClose: () => void;
  onChanged: (message: string) => void;
  onPosted: (result: GoodsReceivingPostingResult) => void;
  onViewLedger: (productId: string) => void;
  loadLines?: (grnId: string) => Promise<GoodsReceivingLine[]>;
  onPostRequest?: (note: GoodsReceivingNote, lines: GoodsReceivingLine[]) => Promise<string>;
}

function fieldClass(extra = ''): string {
  return `w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-bold text-[#1e222b] outline-none focus:border-orange-500 rounded-none ${extra}`;
}

export default function GoodsReceivingForm({
  open,
  grn,
  role,
  staffName,
  onClose,
  onChanged,
  onPosted,
  onViewLedger,
  loadLines = getGoodsReceivingLines,
  onPostRequest
}: GoodsReceivingFormProps) {
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [note, setNote] = useState<GoodsReceivingNote | null>(grn);
  const [lines, setLines] = useState<GoodsReceivingLine[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [acquisitionType, setAcquisitionType] = useState<GoodsReceivingAcquisitionType>('Supplier Credit');
  const [paymentSource, setPaymentSource] = useState<GoodsReceivingPaymentSource>('COGSReserve');
  const [paidAmount, setPaidAmount] = useState('0');
  const [linkedSupplierBillId, setLinkedSupplierBillId] = useState('');

  useEffect(() => {
    if (!open || !grn) return;
    setNote(grn);
    setFeedback(null);
    void loadLines(grn.grnId).then(setLines);
  }, [grn, open]);

  const totals = useMemo(() => {
    return {
      lineCount: lines.filter((line) => !line.removeFromCurrentGRN).length,
      receivedNow: lines.reduce((sum, line) => sum + line.qtyReceivedNow, 0),
      accepted: lines.reduce((sum, line) => sum + line.qtyAccepted, 0),
      rejected: lines.reduce((sum, line) => sum + line.qtyRejected, 0),
      variances: lines.filter((line) => line.varianceType !== 'None').length
    };
  }, [lines]);

  if (!open || !note) return null;

  const editable = note.receivingStatus === 'Draft';
  const canEdit = canPerformAction(role, 'goodsReceiving.edit');
  const canApprove = canPerformAction(role, 'goodsReceiving.approve') || canPerformAction(role, 'approvals.approve');
  const canPost = canPerformAction(role, 'goodsReceiving.post');
  const canCancel = canPerformAction(role, 'goodsReceiving.cancel');

  const sizeClass = windowState === 'maximized'
    ? 'w-[calc(100vw-32px)] h-[calc(100vh-32px)]'
    : windowState === 'minimized'
      ? 'w-[520px] h-[46px]'
      : 'w-[min(1360px,calc(100vw-32px))] h-[min(880px,calc(100vh-32px))]';

  const reloadLines = async () => {
    setLines(await getGoodsReceivingLines(note.grnId));
  };

  const patchNote = async (patch: Partial<GoodsReceivingNote>) => {
    if (!editable || !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await updateGRNDraft(note.grnId, patch);
    if (updated) {
      setNote(updated);
      onChanged(`${updated.grnNumber} draft saved.`);
    }
  };

  const patchLine = async (lineId: string, patch: Partial<GoodsReceivingLine>) => {
    if (!editable || !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    await updateGRNLine(note.grnId, lineId, patch);
    await reloadLines();
  };

  const handleSaveDraft = async () => {
    await patchNote(note);
    setFeedback(`${note.grnNumber} draft saved. Draft GRNs do not affect stock.`);
  };

  const handleSubmitApproval = async () => {
    const updated = await submitGRNForApproval(note.grnId);
    if (updated) {
      setNote(updated);
      setFeedback(`${updated.grnNumber} submitted for approval. Stock not updated.`);
      onChanged('GRN submitted for approval.');
    } else {
      setFeedback('GRN could not be submitted for approval.');
    }
  };

  const handleApprove = async () => {
    if (!canApprove) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await approveGRN(note.grnId, staffName, 'Approved in build-development receiving flow.');
    if (updated) {
      setNote(updated);
      setFeedback(`${updated.grnNumber} approved. You can now post accepted quantities.`);
      onChanged('GRN approved.');
    }
  };

  const handlePost = async () => {
    try {
      if (!canPost) {
        setFeedback('You do not have permission to perform this action.');
        return;
      }
      if (onPostRequest) {
        const message = await onPostRequest(note, lines);
        setFeedback(message);
        onChanged(message);
        return;
      }
      const parsedPaidAmount = Math.max(0, Number(paidAmount) || 0);
      if (acquisitionType === 'Part Paid + Supplier Credit' && parsedPaidAmount <= 0) {
        setFeedback('Enter the paid portion before posting a part-paid supplier credit GRN.');
        return;
      }
      const result = await postGRN(note.grnId, staffName, {
        acquisitionType,
        paidAmount: parsedPaidAmount,
        paymentSource,
        supplierInvoiceNumber: note.supplierInvoiceNumber,
        linkedSupplierBillId: linkedSupplierBillId.trim() || undefined
      });
      if (!result) {
        setFeedback('Only Draft GRNs can be posted.');
        return;
      }
      if (!result.stockPosted) {
        setFeedback(result.message);
        onChanged(result.message);
        if (result.status === 'Pending Approval') {
          const refreshed = await updateGRNDraft(note.grnId, {});
          if (refreshed) setNote(refreshed);
        }
        return;
      }
      setFeedback(result.message);
      onPosted(result);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Goods receiving could not be posted.');
    }
  };

  const handleCancel = async () => {
    if (!canCancel) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const reason = window.prompt(`Reason for cancelling ${note.grnNumber}?`);
    if (!reason) return;
    const updated = await cancelGRN(note.grnId, staffName, reason);
    if (updated) {
      setNote(updated);
      setFeedback(`${updated.grnNumber} cancelled. No stock was updated.`);
      onChanged('GRN cancelled.');
    }
  };

  const handleExport = async () => {
    const result = await exportGRNPlaceholder(note.grnId);
    setFeedback(result.message);
    onChanged(result.message);
  };

  const handleLineAction = async (line: GoodsReceivingLine, action: 'remove' | 'not-supplied' | 'damaged' | 'restore') => {
    if (action === 'remove') {
      await removeLineFromCurrentGRN(note.grnId, line.lineId, 'Removed from current receiving batch.');
    }
    if (action === 'not-supplied') {
      await markLineNotSupplied(note.grnId, line.lineId, 'Supplier did not supply this item in the current delivery.');
    }
    if (action === 'damaged') {
      await patchLine(line.lineId, {
        qtyRejected: Math.max(line.qtyRejected, line.qtyReceivedNow - line.qtyAccepted),
        damagedReason: 'Damaged goods recorded at receiving.',
        varianceType: 'Damaged'
      });
    }
    if (action === 'restore') {
      await patchLine(line.lineId, {
        removeFromCurrentGRN: false,
        markUnavailableFromSupplier: false,
        qtyReceivedNow: line.qtyOutstandingBeforeGRN,
        qtyAccepted: line.qtyOutstandingBeforeGRN,
        qtyRejected: 0,
        damagedReason: '',
        notes: ''
      });
    }
    await reloadLines();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950/45 flex items-center justify-center p-4">
      <div className={`${sizeClass} bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col rounded-none overflow-hidden`}>
        <div className="h-11 bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-black uppercase text-[10.5px] tracking-wider">Goods Receiving Note</div>
            {windowState !== 'minimized' && <div className="text-[8px] uppercase text-slate-300">Receive goods from supplier. Stock updates only when GRN is posted.</div>}
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
                Draft and pending GRNs do not affect stock. Only posted GRNs update inventory balances and product ledger. Supplier invoice amount is captured for later accounting review only; no cashbook payment is posted.
              </div>
              {feedback && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{feedback}</div>}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">GRN Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Readonly label="GRN Number" value={note.grnNumber} />
                    <FormInput label="GRN Date" type="date" value={note.receivedDate} disabled={!editable} onChange={(value) => setNote({ ...note, receivedDate: value })} />
                    <Readonly label="PO Number" value={note.poNumber || 'Manual'} />
                    <Readonly label="Status" value={note.receivingStatus} />
                    <Readonly label="Received By" value={note.receivedByStaffName} />
                    <FormInput label="Branch" value={note.branchId} disabled={!editable} onChange={(value) => setNote({ ...note, branchId: value })} />
                    <FormInput label="Warehouse" value={note.warehouseId} disabled={!editable} onChange={(value) => setNote({ ...note, warehouseId: value })} />
                    <Readonly label="Lines" value={String(totals.lineCount)} />
                  </div>
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Supplier / Delivery</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <FormInput label="Supplier Name" value={note.supplierName} disabled={!editable} onChange={(value) => setNote({ ...note, supplierName: value })} />
                    <FormInput label="Supplier Invoice Number" value={note.supplierInvoiceNumber} disabled={!editable} onChange={(value) => setNote({ ...note, supplierInvoiceNumber: value.toUpperCase() })} />
                    <FormInput label="Supplier Invoice Date" type="date" value={note.supplierInvoiceDate} disabled={!editable} onChange={(value) => setNote({ ...note, supplierInvoiceDate: value })} />
                    <FormInput label="Supplier Invoice Amount" type="number" value={String(note.supplierInvoiceAmount)} disabled={!editable} onChange={(value) => setNote({ ...note, supplierInvoiceAmount: Number(value) || 0 })} />
                    <FormInput label="Delivery Note Number" value={note.deliveryNoteNumber} disabled={!editable} onChange={(value) => setNote({ ...note, deliveryNoteNumber: value.toUpperCase() })} />
                    <FormInput label="Courier / Vehicle Reference" value={note.vehicleOrCourierReference || ''} disabled={!editable} onChange={(value) => setNote({ ...note, vehicleOrCourierReference: value })} />
                  </div>
                  <label className="block space-y-1">
                    <span className="text-[8px] uppercase font-black text-slate-500">Notes</span>
                    <textarea disabled={!editable} value={note.notes} onChange={(event) => setNote({ ...note, notes: event.target.value })} rows={2} className={fieldClass('resize-none disabled:bg-slate-100')} />
                  </label>
                </section>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <TotalBox label="Received Now" value={totals.receivedNow} />
                <TotalBox label="Accepted" value={totals.accepted} />
                <TotalBox label="Rejected" value={totals.rejected} />
                <TotalBox label="Variances" value={totals.variances} />
                <TotalBox label="Invoice Amount" value={`USD ${note.supplierInvoiceAmount.toFixed(2)}`} />
              </div>

              <section className="border border-[#b1b5c2]">
                <div className="bg-[#1e222b] text-white px-3 py-2 text-[9.5px] uppercase font-black border-b-2 border-orange-500 flex items-center gap-2">
                  <PackageCheck className="w-4 h-4 text-orange-500" />
                  GRN Line Item Receiving
                </div>
                <div className="procurement-table-scroll pos-custom-scroll">
                  <table className="procurement-table text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[7.5px] font-black">
                        {['SKU', 'Product Name', 'Brand', 'Ordered', 'Previously Received', 'Outstanding', 'Received Now', 'Accepted', 'Rejected', 'Cost', 'Selling Price', 'Shelf', 'Variance', 'Status', 'Action'].map((header) => (
                          <th key={header} className="px-2 py-2 whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lines.map((line) => (
                        <tr key={line.lineId} className={line.removeFromCurrentGRN ? 'bg-slate-50 text-slate-400' : 'hover:bg-slate-50'}>
                          <td className="px-2 py-2 font-black">{line.sku}</td>
                          <td className="px-2 py-2 uppercase font-bold max-w-[180px] truncate">{line.productName}</td>
                          <td className="px-2 py-2 uppercase">{line.brand || 'N/A'}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyOrdered}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyPreviouslyReceived}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyOutstandingBeforeGRN}</td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.qtyReceivedNow} onChange={(value) => patchLine(line.lineId, { qtyReceivedNow: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.qtyAccepted} onChange={(value) => patchLine(line.lineId, { qtyAccepted: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.qtyRejected} onChange={(value) => patchLine(line.lineId, { qtyRejected: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} step="0.01" value={line.receivedUnitCost} onChange={(value) => patchLine(line.lineId, { receivedUnitCost: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} step="0.01" value={line.sellingPrice} onChange={(value) => patchLine(line.lineId, { sellingPrice: value })} /></td>
                          <td className="px-2 py-2"><input disabled={!editable} value={line.shelfLocation} onChange={(event) => patchLine(line.lineId, { shelfLocation: event.target.value })} className={fieldClass('w-[110px] disabled:bg-slate-100')} /></td>
                          <td className="px-2 py-2 uppercase font-black">{line.varianceType}</td>
                          <td className="px-2 py-2 uppercase font-black">{line.lineStatus}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <IconButton title="Remove From This GRN" disabled={!editable} onClick={() => handleLineAction(line, 'remove')}><Trash2 className="w-3.5 h-3.5" /></IconButton>
                              <button type="button" disabled={!editable} onClick={() => handleLineAction(line, 'not-supplied')} className="px-1.5 py-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white text-[7.5px] uppercase font-black rounded-none">Not Supplied</button>
                              <button type="button" disabled={!editable} onClick={() => handleLineAction(line, 'damaged')} className="px-1.5 py-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white text-[7.5px] uppercase font-black rounded-none">Damaged</button>
                              <IconButton title="Restore Line" disabled={!editable} onClick={() => handleLineAction(line, 'restore')}><RotateCcw className="w-3.5 h-3.5" /></IconButton>
                              <button type="button" onClick={() => onViewLedger(line.productId)} className="px-1.5 py-1 border border-orange-300 bg-orange-50 text-orange-800 text-[7.5px] uppercase font-black rounded-none">Ledger</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </section>

                <section className="border border-orange-300 bg-orange-50 p-3 space-y-3 lg:col-span-2">
                  <h3 className="text-[9px] uppercase font-black border-b border-orange-200 pb-1 text-[#1e222b]">Supplier Bill / Payment Type</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="block">
                      <span className="text-[8px] uppercase text-orange-600 font-normal">Acquisition Type</span>
                      <select className={fieldClass()} value={acquisitionType} disabled={!editable} onChange={(event) => setAcquisitionType(event.target.value as GoodsReceivingAcquisitionType)}>
                        <option value="Paid Cash">Paid Cash</option>
                        <option value="Supplier Credit">Supplier Credit</option>
                        <option value="Part Paid + Supplier Credit">Part Paid + Supplier Credit</option>
                        <option value="Already Invoiced">Already Invoiced</option>
                        <option value="Invoice Pending">Invoice Pending</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[8px] uppercase text-orange-600 font-normal">Paid Portion</span>
                      <input className={fieldClass()} value={paidAmount} disabled={!editable || acquisitionType !== 'Part Paid + Supplier Credit'} onChange={(event) => setPaidAmount(event.target.value)} />
                    </label>
                    <label className="block">
                      <span className="text-[8px] uppercase text-orange-600 font-normal">Payment Source</span>
                      <select className={fieldClass()} value={paymentSource} disabled={!editable || acquisitionType !== 'Part Paid + Supplier Credit'} onChange={(event) => setPaymentSource(event.target.value as GoodsReceivingPaymentSource)}>
                        <option value="COGSReserve">COGS Reserve</option>
                        <option value="CashDrawer">Cash Drawer</option>
                        <option value="BankPlaceholder">Bank Transfer</option>
                        <option value="MobileMoneyPlaceholder">Mobile Money</option>
                        <option value="OwnerFundsPlaceholder">Owner Funds</option>
                        <option value="Mixed">Mixed</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[8px] uppercase text-orange-600 font-normal">Existing Bill ID</span>
                      <input className={fieldClass()} value={linkedSupplierBillId} disabled={!editable || acquisitionType !== 'Already Invoiced'} onChange={(event) => setLinkedSupplierBillId(event.target.value)} placeholder="Optional existing bill" />
                    </label>
                  </div>
                  <p className="text-[9px] uppercase text-slate-700 font-bold">Supplier Credit creates a posted supplier bill. Part Paid creates a bill plus allocated payment. Invoice Pending posts stock and creates a BI warning without posting a bill.</p>
                </section>
              </div>

            <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={handleSaveDraft} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Save Draft</button>
              <button type="button" onClick={handleSubmitApproval} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Submit for Approval</button>
              <button type="button" onClick={handleApprove} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Approve</button>
              <button type="button" onClick={handlePost} className="px-3 py-2 border border-orange-700 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] rounded-none">Post GRN</button>
              <button type="button" onClick={handleCancel} className="px-3 py-2 border border-red-300 bg-white text-red-700 font-black uppercase text-[9px] rounded-none">Cancel GRN</button>
              <button type="button" onClick={handleExport} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Prepare Export</button>
              <button type="button" onClick={onClose} className="px-3 py-2 border border-[#1e222b] bg-[#1e222b] text-white font-black uppercase text-[9px] rounded-none">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <input type={type} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('disabled:bg-slate-100')} />
    </label>
  );
}

function Readonly({ label, value }: { label: string; value: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <input readOnly value={value} className={fieldClass('bg-slate-100')} />
    </label>
  );
}

function NumberCell({ value, onChange, disabled, step = '1' }: { value: number; onChange: (value: number) => void; disabled: boolean; step?: string }) {
  return (
    <input
      type="number"
      min={0}
      step={step}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className={fieldClass('w-[85px] text-right disabled:bg-slate-100')}
    />
  );
}

function IconButton({ title, disabled, onClick, children }: { title: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className="p-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white hover:bg-slate-100 rounded-none">
      {children}
    </button>
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
