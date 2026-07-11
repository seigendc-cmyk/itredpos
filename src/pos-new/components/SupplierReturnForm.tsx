import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, Minus, RotateCcw, Square, Trash2, X } from 'lucide-react';
import {
  Role,
  SupplierReturn,
  SupplierReturnLine,
  SupplierReturnReason,
  SupplierReturnResolution
} from '../types';
import {
  approveSupplierReturn,
  cancelSupplierReturn,
  closeSupplierReturn,
  exportSupplierReturnPlaceholder,
  getSupplierReturnLines,
  markDispatchedToSupplier,
  postSupplierReturn,
  recordReplacementExpected,
  recordSupplierCreditNotePlaceholder,
  submitSupplierReturnForApproval,
  SupplierReturnPostingResult,
  updateSupplierReturnDraft,
  updateSupplierReturnLine
} from '../services/supplierReturnService';
import { canPerformAction } from '../utils/posPermissions';

type WindowState = 'normal' | 'minimized' | 'maximized';

interface SupplierReturnFormProps {
  open: boolean;
  supplierReturn: SupplierReturn | null;
  role: Role;
  staffName: string;
  onClose: () => void;
  onChanged: (message: string) => void;
  onPosted: (result: SupplierReturnPostingResult) => void;
  onViewGRN: (grnId?: string) => void;
  onViewLedger: (productId: string) => void;
}

const reasons: SupplierReturnReason[] = ['Damaged', 'Wrong Product', 'Over Supplied', 'Quality Issue', 'Expired', 'Supplier Recall', 'Duplicate Supply', 'Price Dispute', 'Not Ordered', 'Other'];
const resolutions: SupplierReturnResolution[] = ['Credit Note Expected', 'Replacement Expected', 'Supplier Refund Expected', 'No Credit', 'Internal Write Off Review', 'Pending Supplier Decision'];

function fieldClass(extra = ''): string {
  return `w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-bold text-[#1e222b] outline-none focus:border-orange-500 rounded-none ${extra}`;
}

export default function SupplierReturnForm({
  open,
  supplierReturn,
  role,
  staffName,
  onClose,
  onChanged,
  onPosted,
  onViewGRN,
  onViewLedger
}: SupplierReturnFormProps) {
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [record, setRecord] = useState<SupplierReturn | null>(supplierReturn);
  const [lines, setLines] = useState<SupplierReturnLine[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [supplierNotes, setSupplierNotes] = useState('');

  useEffect(() => {
    if (!open || !supplierReturn) return;
    setRecord(supplierReturn);
    setFeedback(null);
    setDispatchNotes('');
    setSupplierNotes('');
    void getSupplierReturnLines(supplierReturn.supplierReturnId).then(setLines);
  }, [open, supplierReturn]);

  const totals = useMemo(() => ({
    lines: lines.length,
    requested: lines.reduce((sum, line) => sum + line.qtyReturnRequested, 0),
    approved: lines.reduce((sum, line) => sum + line.qtyReturnApproved, 0),
    stockImpact: lines.filter((line) => line.stockWasPosted).reduce((sum, line) => sum + line.qtyReturnApproved, 0),
    estimate: lines.reduce((sum, line) => sum + line.lineTotal, 0)
  }), [lines]);

  if (!open || !record) return null;

  const editable = record.status === 'Draft';
  const canEdit = canPerformAction(role, 'supplierReturns.edit');
  const canApprove = canPerformAction(role, 'supplierReturns.approve') || canPerformAction(role, 'approvals.approve');
  const canPost = canPerformAction(role, 'supplierReturns.post');
  const canCancel = canPerformAction(role, 'supplierReturns.cancel');
  const canDispatch = canPerformAction(role, 'supplierReturns.dispatch');
  const canClose = canPerformAction(role, 'supplierReturns.close');

  const sizeClass = windowState === 'maximized'
    ? 'w-[calc(100vw-32px)] h-[calc(100vh-32px)]'
    : windowState === 'minimized'
      ? 'w-[560px] h-[46px]'
      : 'w-[min(1380px,calc(100vw-32px))] h-[min(890px,calc(100vh-32px))]';

  const reloadLines = async () => {
    setLines(await getSupplierReturnLines(record.supplierReturnId));
  };

  const patchRecord = async (patch: Partial<SupplierReturn>) => {
    if (!editable || !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await updateSupplierReturnDraft(record.supplierReturnId, patch);
    if (updated) {
      setRecord(updated);
      onChanged(`${updated.supplierReturnNumber} draft saved.`);
    }
  };

  const patchLine = async (lineId: string, patch: Partial<SupplierReturnLine>) => {
    if (!editable || !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    await updateSupplierReturnLine(record.supplierReturnId, lineId, patch);
    await reloadLines();
  };

  const handleSaveDraft = async () => {
    await patchRecord(record);
    setFeedback(`${record.supplierReturnNumber} draft saved. Draft Supplier Returns do not reduce stock.`);
  };

  const handleSubmitApproval = async () => {
    const updated = await submitSupplierReturnForApproval(record.supplierReturnId);
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} submitted for approval. Stock not reduced.`);
      onChanged('Supplier Return submitted for approval.');
    }
  };

  const handleApprove = async () => {
    if (!canApprove) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await approveSupplierReturn(record.supplierReturnId, staffName, 'Approved in build-development supplier return flow.');
    if (updated) {
      setRecord(updated);
      await reloadLines();
      setFeedback(`${updated.supplierReturnNumber} approved for posting.`);
      onChanged('Supplier Return approved.');
    }
  };

  const handlePost = async () => {
    try {
      if (!canPost) {
        setFeedback('You do not have permission to perform this action.');
        return;
      }
      const result = await postSupplierReturn(record.supplierReturnId, staffName);
      if (!result) {
        setFeedback('Only Draft or Approved Supplier Returns can be posted.');
        return;
      }
      setFeedback(result.message);
      onPosted(result);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Supplier Return could not be posted.');
    }
  };

  const handleDispatch = async () => {
    if (!canDispatch) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await markDispatchedToSupplier(record.supplierReturnId, {
      dispatchMethod: record.dispatchMethod || 'Supplier Collection',
      courierReference: record.courierReference,
      dispatchNotes,
      dispatchedByStaffId: staffName,
      dispatchedByStaffName: staffName
    });
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} marked dispatched to supplier.`);
      onChanged('Supplier Return dispatched.');
    }
  };

  const handleCreditNote = async () => {
    const number = window.prompt('Supplier credit note number?');
    if (!number) return;
    const amountInput = window.prompt('Supplier credit note amount?') || '0';
    const updated = await recordSupplierCreditNotePlaceholder(record.supplierReturnId, {
      supplierCreditNoteNumber: number.toUpperCase(),
      supplierCreditNoteAmount: Number(amountInput) || 0,
      notes: 'Captured from Supplier Return popup. Pending accounting review only.'
    });
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} credit note recorded. No cashbook posting.`);
      onChanged('Supplier credit note recorded.');
    }
  };

  const handleReplacement = async () => {
    const updated = await recordReplacementExpected(record.supplierReturnId, { notes: supplierNotes || 'Replacement requested from supplier.' });
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} replacement expected recorded.`);
      onChanged('Supplier replacement recorded.');
    }
  };

  const handleClose = async () => {
    if (!canClose) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const notes = window.prompt(`Close ${record.supplierReturnNumber} notes?`);
    if (!notes) return;
    const updated = await closeSupplierReturn(record.supplierReturnId, staffName, notes);
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} closed.`);
      onChanged('Supplier Return closed.');
    }
  };

  const handleCancel = async () => {
    if (!canCancel) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const reason = window.prompt(`Reason for cancelling ${record.supplierReturnNumber}?`);
    if (!reason) return;
    const updated = await cancelSupplierReturn(record.supplierReturnId, staffName, reason);
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.supplierReturnNumber} cancelled. No stock was reduced.`);
      onChanged('Supplier Return cancelled.');
    }
  };

  const handleExport = async () => {
    const result = await exportSupplierReturnPlaceholder(record.supplierReturnId);
    setFeedback(result.message);
    onChanged(result.message);
  };

  const handleLineAction = async (line: SupplierReturnLine, action: 'damaged' | 'wrong' | 'over' | 'remove' | 'restore') => {
    if (action === 'remove') {
      await patchLine(line.lineId, { qtyReturnRequested: 0, qtyReturnApproved: 0, notes: 'Removed from current Supplier Return draft.' });
    }
    if (action === 'restore') {
      const qty = line.stockWasPosted ? Math.max(line.qtyAcceptedIntoStock - line.qtyAlreadyReturned, 0) : Math.max(line.qtyReceived, 0);
      await patchLine(line.lineId, { qtyReturnRequested: qty, qtyReturnApproved: qty, notes: 'Restored to Supplier Return draft.' });
    }
    if (action === 'damaged') await patchLine(line.lineId, { returnReason: 'Damaged' });
    if (action === 'wrong') await patchLine(line.lineId, { returnReason: 'Wrong Product', resolution: 'Replacement Expected' });
    if (action === 'over') await patchLine(line.lineId, { returnReason: 'Over Supplied', resolution: 'Credit Note Expected' });
  };

  return (
    <div className="fixed inset-0 z-[1250] bg-slate-950/45 flex items-center justify-center p-4">
      <div className={`${sizeClass} bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col rounded-none overflow-hidden`}>
        <div className="h-11 bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-black uppercase text-[10.5px] tracking-wider">Supplier Return Note</div>
            {windowState !== 'minimized' && <div className="text-[8px] uppercase text-slate-300">Return goods to supplier. Stock is reduced only for goods already posted into inventory.</div>}
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
                Supplier Returns only reduce stock when returned goods were already posted into inventory. Supplier credit notes, replacements and accounting impact remain pending review records; no cashbook, supplier payment, sales or COGS posting is created.
              </div>
              {feedback && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{feedback}</div>}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Return Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <Readonly label="Return Number" value={record.supplierReturnNumber} />
                    <FormInput label="Return Date" type="date" value={record.returnDate} disabled={!editable} onChange={(value) => setRecord({ ...record, returnDate: value })} />
                    <Readonly label="Status" value={record.status} />
                    <SelectInput label="Reason" value={record.reason} options={reasons} disabled={!editable} onChange={(value) => setRecord({ ...record, reason: value as SupplierReturnReason })} />
                    <SelectInput label="Resolution" value={record.resolution} options={resolutions} disabled={!editable} onChange={(value) => setRecord({ ...record, resolution: value as SupplierReturnResolution })} />
                    <Readonly label="Requested By" value={record.requestedByStaffName} />
                  </div>
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Supplier / Source</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput label="Supplier Name" value={record.supplierName} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierName: value })} />
                    <Readonly label="PO Number" value={record.poNumber || 'N/A'} />
                    <Readonly label="GRN Number" value={record.grnNumber || 'N/A'} />
                    <FormInput label="Contact Person" value={record.supplierContactPerson} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierContactPerson: value })} />
                    <FormInput label="Phone" value={record.supplierPhone} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierPhone: value })} />
                    <FormInput label="Email" value={record.supplierEmail} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierEmail: value })} />
                  </div>
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Dispatch / Credit / Replacement</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput label="Dispatch Method" value={record.dispatchMethod} disabled={!editable} onChange={(value) => setRecord({ ...record, dispatchMethod: value })} />
                    <FormInput label="Courier Reference" value={record.courierReference || ''} disabled={!editable} onChange={(value) => setRecord({ ...record, courierReference: value })} />
                    <FormInput label="Credit Note Number" value={record.supplierCreditNoteNumber || ''} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierCreditNoteNumber: value })} />
                    <FormInput label="Credit Note Amount" type="number" value={String(record.supplierCreditNoteAmount || 0)} disabled={!editable} onChange={(value) => setRecord({ ...record, supplierCreditNoteAmount: Number(value) || 0 })} />
                    <Readonly label="Replacement Expected" value={record.replacementExpected ? 'Yes' : 'No'} />
                    <FormInput label="Dispatch Notes" value={dispatchNotes} onChange={setDispatchNotes} />
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <TotalBox label="Lines" value={totals.lines} />
                <TotalBox label="Return Requested" value={totals.requested} />
                <TotalBox label="Return Approved" value={totals.approved} />
                <TotalBox label="Stock-Impact Qty" value={totals.stockImpact} />
                <TotalBox label="Value Estimate" value={`USD ${totals.estimate.toFixed(2)}`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="text-[8px] uppercase font-black text-slate-500">Internal Notes</span>
                  <textarea disabled={!editable} value={record.notes} onChange={(event) => setRecord({ ...record, notes: event.target.value })} rows={2} className={fieldClass('resize-none disabled:bg-slate-100')} />
                </label>
                <label className="block space-y-1">
                  <span className="text-[8px] uppercase font-black text-slate-500">Supplier / Replacement Notes</span>
                  <textarea value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} rows={2} className={fieldClass('resize-none')} />
                </label>
              </div>

              <section className="border border-[#b1b5c2]">
                <div className="bg-[#1e222b] text-white px-3 py-2 text-[9.5px] uppercase font-black border-b-2 border-orange-500">
                  Supplier Return Line Items
                </div>
                <div className="procurement-table-scroll pos-custom-scroll">
                  <table className="procurement-table text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[7.5px] font-black">
                        {['SKU', 'Product Name', 'Brand', 'Received Qty', 'Accepted Into Stock', 'Already Returned', 'Return Requested', 'Return Approved', 'Unit Cost', 'Line Total', 'Stock Posted?', 'Reason', 'Resolution', 'Status', 'Action'].map((header) => (
                          <th key={header} className="px-2 py-2 whitespace-nowrap">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lines.map((line) => (
                        <tr key={line.lineId} className="hover:bg-slate-50">
                          <td className="px-2 py-2 font-black">{line.sku}</td>
                          <td className="px-2 py-2 uppercase font-bold max-w-[180px] truncate">
                            {line.productName}
                            {!line.stockWasPosted && <span className="block text-[7.5px] text-orange-700 font-black">No stock reduction required. Goods were not accepted into inventory.</span>}
                          </td>
                          <td className="px-2 py-2 uppercase">{line.brand || 'N/A'}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyReceived}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyAcceptedIntoStock}</td>
                          <td className="px-2 py-2 text-right font-mono">{line.qtyAlreadyReturned}</td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.qtyReturnRequested} onChange={(value) => patchLine(line.lineId, { qtyReturnRequested: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.qtyReturnApproved} onChange={(value) => patchLine(line.lineId, { qtyReturnApproved: value })} /></td>
                          <td className="px-2 py-2 text-right font-mono">USD {line.unitCost.toFixed(2)}</td>
                          <td className="px-2 py-2 text-right font-black font-mono">USD {line.lineTotal.toFixed(2)}</td>
                          <td className="px-2 py-2 uppercase font-black">{line.stockWasPosted ? 'Yes' : 'No'}</td>
                          <td className="px-2 py-2">
                            <SelectCell disabled={!editable} value={line.returnReason} options={reasons} onChange={(value) => patchLine(line.lineId, { returnReason: value as SupplierReturnReason })} />
                          </td>
                          <td className="px-2 py-2">
                            <SelectCell disabled={!editable} value={line.resolution} options={resolutions} onChange={(value) => patchLine(line.lineId, { resolution: value as SupplierReturnResolution })} />
                          </td>
                          <td className="px-2 py-2 uppercase font-black">{line.lineStatus}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button type="button" disabled={!editable} onClick={() => handleLineAction(line, 'damaged')} className="px-1.5 py-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white text-[7.5px] uppercase font-black rounded-none">Damaged</button>
                              <button type="button" disabled={!editable} onClick={() => handleLineAction(line, 'wrong')} className="px-1.5 py-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white text-[7.5px] uppercase font-black rounded-none">Wrong Product</button>
                              <button type="button" disabled={!editable} onClick={() => handleLineAction(line, 'over')} className="px-1.5 py-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white text-[7.5px] uppercase font-black rounded-none">Over Supplied</button>
                              <IconButton title="Remove Line" disabled={!editable} onClick={() => handleLineAction(line, 'remove')}><Trash2 className="w-3.5 h-3.5" /></IconButton>
                              <IconButton title="Restore Line" disabled={!editable} onClick={() => handleLineAction(line, 'restore')}><RotateCcw className="w-3.5 h-3.5" /></IconButton>
                              <button type="button" onClick={() => onViewGRN(record.grnId)} className="px-1.5 py-1 border border-[#b1b5c2] bg-white text-[7.5px] uppercase font-black rounded-none">View GRN</button>
                              <button type="button" onClick={() => onViewLedger(line.productId)} className="px-1.5 py-1 border border-orange-300 bg-orange-50 text-orange-800 text-[7.5px] uppercase font-black rounded-none">Ledger</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <div className="shrink-0 bg-slate-50 border-t border-[#b1b5c2] p-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={handleSaveDraft} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Save Draft</button>
              <button type="button" onClick={handleSubmitApproval} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Submit for Approval</button>
              <button type="button" onClick={handleApprove} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Approve</button>
              <button type="button" onClick={handlePost} className="px-3 py-2 border border-orange-700 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] rounded-none">Post Return</button>
              <button type="button" onClick={handleDispatch} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Dispatch To Supplier</button>
              <button type="button" onClick={handleCreditNote} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Record Credit Note</button>
              <button type="button" onClick={handleReplacement} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Record Replacement</button>
              <button type="button" onClick={handleClose} className="px-3 py-2 border border-[#1e222b] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Close</button>
              <button type="button" onClick={handleCancel} className="px-3 py-2 border border-red-300 bg-white text-red-700 font-black uppercase text-[9px] rounded-none">Cancel</button>
              <button type="button" onClick={handleExport} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Prepare Export</button>
              <button type="button" onClick={onClose} className="px-3 py-2 border border-[#1e222b] bg-[#1e222b] text-white font-black uppercase text-[9px] rounded-none">Close Popup</button>
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

function SelectInput({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-[8px] uppercase font-black text-slate-500">{label}</span>
      <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('disabled:bg-slate-100')}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function SelectCell({ value, options, onChange, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('w-[150px] disabled:bg-slate-100')}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
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

function NumberCell({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled: boolean }) {
  return (
    <input
      type="number"
      min={0}
      disabled={disabled}
      value={value}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className={fieldClass('w-[78px] text-right font-mono disabled:bg-slate-100')}
    />
  );
}

function TotalBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#b1b5c2] bg-slate-50 p-3">
      <div className="text-[8px] uppercase font-black text-slate-500">{label}</div>
      <div className="text-[15px] font-black text-[#1e222b] font-mono">{value}</div>
    </div>
  );
}

function IconButton({ title, disabled, onClick, children }: { title: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className="p-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white hover:bg-slate-50 rounded-none">
      {children}
    </button>
  );
}
