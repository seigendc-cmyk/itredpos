import React, { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, Minus, Plus, RotateCcw, Square, Trash2, X } from 'lucide-react';
import {
  Product,
  Role,
  StockAdjustment,
  StockAdjustmentDirection,
  StockAdjustmentLine,
  StockAdjustmentReason,
  StockAdjustmentRiskLevel
} from '../types';
import {
  addStockAdjustmentLine,
  approveStockAdjustment,
  cancelStockAdjustment,
  createStockAdjustmentDraft,
  exportStockAdjustmentPlaceholder,
  getStockAdjustmentLines,
  postStockAdjustment,
  rejectStockAdjustment,
  removeStockAdjustmentLine,
  StockAdjustmentPostingResult,
  submitStockAdjustmentForApproval,
  updateStockAdjustmentDraft,
  updateStockAdjustmentLine
} from '../services/stockAdjustmentService';
import { canPerformAction } from '../utils/posPermissions';

type WindowState = 'normal' | 'minimized' | 'maximized';

interface StockAdjustmentFormProps {
  open: boolean;
  adjustment: StockAdjustment | null;
  products: Product[];
  role: Role;
  staffName: string;
  activeBranch: string;
  onClose: () => void;
  onChanged: (message: string) => void;
  onPosted: (result: StockAdjustmentPostingResult) => void;
  onViewLedger: (productId: string) => void;
}

const reasons: StockAdjustmentReason[] = ['Opening Balance', 'Physical Count Correction', 'Damaged Stock', 'Expired Stock', 'Theft / Loss', 'Internal Use', 'Data Correction', 'Supplier Correction', 'Customer Return Correction', 'Branch Transfer Correction', 'Write Off', 'Other'];
const directions: StockAdjustmentDirection[] = ['Increase', 'Decrease', 'Set Quantity'];
const riskLevels: StockAdjustmentRiskLevel[] = ['Low', 'Medium', 'High', 'Critical'];

function fieldClass(extra = ''): string {
  return `w-full bg-white border border-[#b1b5c2] px-2 py-1.5 text-[10px] font-bold text-[#1e222b] outline-none focus:border-orange-500 rounded-none ${extra}`;
}

export default function StockAdjustmentForm({
  open,
  adjustment,
  products,
  role,
  staffName,
  activeBranch,
  onClose,
  onChanged,
  onPosted,
  onViewLedger
}: StockAdjustmentFormProps) {
  const [windowState, setWindowState] = useState<WindowState>('normal');
  const [record, setRecord] = useState<StockAdjustment | null>(adjustment);
  const [lines, setLines] = useState<StockAdjustmentLine[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setRecord(adjustment);
    setFeedback(null);
    setApprovalNotes('');
    setAuditNotes('');
    if (adjustment) {
      void getStockAdjustmentLines(adjustment.adjustmentId).then(setLines);
    } else {
      setLines([]);
    }
  }, [adjustment, open]);

  const totals = useMemo(() => {
    const increase = lines.reduce((sum, line) => sum + Math.max(line.newQty - line.currentQty, 0), 0);
    const decrease = lines.reduce((sum, line) => sum + Math.max(line.currentQty - line.newQty, 0), 0);
    const topRisk = lines.reduce<StockAdjustmentRiskLevel>((risk, line) => riskLevels.indexOf(line.riskLevel) > riskLevels.indexOf(risk) ? line.riskLevel : risk, record?.riskLevel || 'Low');
    return {
      lineCount: lines.length,
      increase,
      decrease,
      net: increase - decrease,
      valueImpact: lines.reduce((sum, line) => sum + line.valueImpact, 0),
      riskLevel: topRisk,
      approvalRequired: Boolean(record?.approvalRequired || lines.some((line) => line.riskLevel === 'High' || line.riskLevel === 'Critical' || line.adjustmentDirection === 'Decrease'))
    };
  }, [lines, record]);

  if (!open) return null;

  const editable = !record || record.status === 'Draft';
  const canCreate = canPerformAction(role, 'stockAdjustments.create');
  const canEdit = canPerformAction(role, 'stockAdjustments.edit');
  const canApprove = canPerformAction(role, 'stockAdjustments.approve') || canPerformAction(role, 'approvals.approve');
  const canPost = canPerformAction(role, 'stockAdjustments.post');
  const canCancel = canPerformAction(role, 'stockAdjustments.cancel');

  const sizeClass = windowState === 'maximized'
    ? 'w-[calc(100vw-32px)] h-[calc(100vh-32px)]'
    : windowState === 'minimized'
      ? 'w-[560px] h-[46px]'
      : 'w-[min(1380px,calc(100vw-32px))] h-[min(890px,calc(100vh-32px))]';

  const ensureDraft = async (): Promise<StockAdjustment | null> => {
    if (record) return record;
    if (!canCreate) {
      setFeedback('You do not have permission to perform this action.');
      return null;
    }
    const draft = await createStockAdjustmentDraft({
      vendorId: 'SCI-LOG-ZW',
      branchId: activeBranch || 'Harare Main',
      warehouseId: 'Main Warehouse',
      requestedByStaffId: staffName,
      requestedByStaffName: staffName,
      reason: 'Physical Count Correction',
      notes: 'Draft stock adjustment. No stock movement posted.'
    });
    setRecord(draft);
    onChanged(`${draft.adjustmentNumber} draft created.`);
    return draft;
  };

  const reloadLines = async (adjustmentId = record?.adjustmentId) => {
    if (!adjustmentId) return;
    setLines(await getStockAdjustmentLines(adjustmentId));
  };

  const patchRecord = async (patch: Partial<StockAdjustment>) => {
    const draft = await ensureDraft();
    if (!draft) return;
    if (!canEdit || draft.status !== 'Draft') {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await updateStockAdjustmentDraft(draft.adjustmentId, patch);
    if (updated) {
      setRecord(updated);
      onChanged(`${updated.adjustmentNumber} draft saved.`);
    }
  };

  const patchLine = async (lineId: string, patch: Partial<StockAdjustmentLine>) => {
    if (!record || !editable || !canEdit) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    await updateStockAdjustmentLine(record.adjustmentId, lineId, patch);
    await reloadLines();
  };

  const handleAddLine = async () => {
    const draft = await ensureDraft();
    if (!draft || !canEdit) return;
    const product = products.find((item) => item.id === selectedProductId) || products[0];
    if (!product) {
      setFeedback('Select a product before adding a line.');
      return;
    }
    const qty = product.qtyOnHand ?? product.stock ?? 0;
    const cost = product.costPrice ?? product.cost ?? 0;
    await addStockAdjustmentLine(draft.adjustmentId, {
      productId: product.id,
      sku: product.sku || product.code,
      productName: product.productName || product.name,
      brand: product.brand || '',
      shelfLocation: product.shelfLocation || '',
      currentQty: qty,
      adjustmentDirection: 'Increase',
      adjustmentQty: 1,
      newQty: qty + 1,
      unitCost: cost,
      reason: draft.reason,
      notes: ''
    });
    await reloadLines(draft.adjustmentId);
    setFeedback('Line added to draft. Stock not changed.');
  };

  const handleSubmit = async () => {
    if (!record) return;
    const updated = await submitStockAdjustmentForApproval(record.adjustmentId);
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.adjustmentNumber} submitted for approval. Stock not changed.`);
      onChanged('Stock Adjustment submitted for approval.');
    }
  };

  const handleApprove = async () => {
    if (!record || !canApprove) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await approveStockAdjustment(record.adjustmentId, staffName, approvalNotes || 'Approved from Stock Adjustment popup.');
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.adjustmentNumber} approved for posting.`);
      onChanged('Stock Adjustment approved.');
    }
  };

  const handleReject = async () => {
    if (!record || !canApprove) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const updated = await rejectStockAdjustment(record.adjustmentId, staffName, approvalNotes || 'Rejected from Stock Adjustment popup.');
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.adjustmentNumber} rejected. Stock not changed.`);
      onChanged('Stock Adjustment rejected.');
    }
  };

  const handlePost = async () => {
    if (!record || !canPost) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const result = await postStockAdjustment(record.adjustmentId, staffName);
    if (!result) {
      setFeedback('Only Draft or Approved Stock Adjustments can be posted.');
      return;
    }
    setFeedback(result.message);
    if (result.stockPosted) onPosted(result);
    else onChanged(result.message);
  };

  const handleCancel = async () => {
    if (!record || !canCancel) {
      setFeedback('You do not have permission to perform this action.');
      return;
    }
    const reason = window.prompt(`Reason for cancelling ${record.adjustmentNumber}?`);
    if (!reason) return;
    const updated = await cancelStockAdjustment(record.adjustmentId, staffName, reason);
    if (updated) {
      setRecord(updated);
      setFeedback(`${updated.adjustmentNumber} cancelled. Stock not changed.`);
      onChanged('Stock Adjustment cancelled.');
    }
  };

  const handleExport = async () => {
    if (!record) return;
    const result = await exportStockAdjustmentPlaceholder(record.adjustmentId);
    setFeedback(result.message);
    onChanged(result.message);
  };

  const handleClear = () => {
    setRecord(null);
    setLines([]);
    setFeedback('Form cleared. No stock movement posted.');
  };

  return (
    <div className="fixed inset-0 z-[1260] bg-slate-950/45 flex items-center justify-center p-4">
      <div className={`${sizeClass} bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col rounded-none overflow-hidden`}>
        <div className="h-11 bg-[#1e222b] text-white border-b-2 border-orange-500 px-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="font-black uppercase text-[10.5px] tracking-wider">Stock Adjustment</div>
            {windowState !== 'minimized' && <div className="text-[8px] uppercase text-slate-300">Controlled stock correction. Stock updates only when adjustment is posted.</div>}
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
                Draft and pending adjustments do not affect stock. Only posted adjustments update inventory balances and product ledger. Accounting remains pending review; no cashbook, supplier payment, bank or tax posting is created.
              </div>
              {feedback && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{feedback}</div>}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Adjustment Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Readonly label="Adjustment Number" value={record?.adjustmentNumber || 'Auto Generated'} />
                    <FormInput label="Adjustment Date" type="date" value={record?.adjustmentDate || new Date().toISOString().slice(0, 10)} disabled={!editable} onChange={(value) => setRecord(record ? { ...record, adjustmentDate: value } : record)} />
                    <Readonly label="Status" value={record?.status || 'Draft'} />
                    <SelectInput label="Reason" value={record?.reason || 'Physical Count Correction'} options={reasons} disabled={!editable} onChange={(value) => record ? setRecord({ ...record, reason: value as StockAdjustmentReason }) : undefined} />
                    <Readonly label="Risk Level" value={totals.riskLevel} />
                    <Readonly label="Requested By" value={record?.requestedByStaffName || staffName} />
                    <FormInput label="Branch" value={record?.branchId || activeBranch || 'Harare Main'} disabled={!editable} onChange={(value) => record ? setRecord({ ...record, branchId: value }) : undefined} />
                    <FormInput label="Warehouse" value={record?.warehouseId || 'Main Warehouse'} disabled={!editable} onChange={(value) => record ? setRecord({ ...record, warehouseId: value }) : undefined} />
                  </div>
                </section>

                <section className="border border-[#b1b5c2] p-3 space-y-3">
                  <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Notes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <TextArea label="Adjustment Notes" value={record?.notes || ''} disabled={!editable} onChange={(value) => setRecord(record ? { ...record, notes: value } : record)} />
                    <TextArea label="Approval Notes" value={approvalNotes} onChange={setApprovalNotes} />
                    <TextArea label="Audit Notes" value={auditNotes} onChange={setAuditNotes} />
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
                <TotalBox label="Line Count" value={totals.lineCount} />
                <TotalBox label="Total Qty Increase" value={totals.increase} />
                <TotalBox label="Total Qty Decrease" value={totals.decrease} />
                <TotalBox label="Net Qty Impact" value={totals.net} />
                <TotalBox label="Estimated Value Impact" value={`USD ${totals.valueImpact.toFixed(2)}`} />
                <TotalBox label="Risk Level" value={totals.riskLevel} />
                <TotalBox label="Approval Required" value={totals.approvalRequired ? 'Yes' : 'No'} />
              </div>

              <section className="border border-[#b1b5c2] p-3 space-y-3">
                <h3 className="text-[9px] uppercase font-black border-b border-gray-200 pb-1">Stock Adjustment Line Entry</h3>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                  <SelectInput label="Product Search" value={selectedProductId} options={products.map((item) => item.id)} disabled={!editable} onChange={setSelectedProductId} />
                  <button type="button" onClick={handleAddLine} disabled={!editable} className="self-end px-3 py-2 bg-orange-600 disabled:bg-slate-200 text-white disabled:text-slate-500 border border-orange-700 disabled:border-slate-300 font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Line</button>
                </div>
              </section>

              <section className="border border-[#b1b5c2]">
                <div className="bg-[#1e222b] text-white px-3 py-2 text-[9.5px] uppercase font-black border-b-2 border-orange-500">Adjustment Lines</div>
                <div className="overflow-x-auto pos-custom-scroll">
                  <table className="w-full min-w-[1480px] text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 uppercase text-[7.5px] font-black">
                        {['SKU', 'Product Name', 'Brand', 'Shelf', 'Current Qty', 'Direction', 'Adjustment Qty', 'New Qty', 'Unit Cost', 'Value Impact', 'Reason', 'Risk', 'Notes', 'Action'].map((header) => <th key={header} className="px-2 py-2 whitespace-nowrap">{header}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {lines.map((line) => (
                        <tr key={line.lineId} className="hover:bg-slate-50">
                          <td className="px-2 py-2 font-black">{line.sku}</td>
                          <td className="px-2 py-2 uppercase font-bold max-w-[180px] truncate">{line.productName}</td>
                          <td className="px-2 py-2 uppercase">{line.brand || 'N/A'}</td>
                          <td className="px-2 py-2"><input disabled={!editable} value={line.shelfLocation} onChange={(event) => patchLine(line.lineId, { shelfLocation: event.target.value })} className={fieldClass('w-[110px] disabled:bg-slate-100')} /></td>
                          <td className="px-2 py-2 text-right font-mono">{line.currentQty}</td>
                          <td className="px-2 py-2"><SelectCell disabled={!editable} value={line.adjustmentDirection} options={directions} onChange={(value) => patchLine(line.lineId, { adjustmentDirection: value as StockAdjustmentDirection })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable || line.adjustmentDirection === 'Set Quantity'} value={line.adjustmentQty} onChange={(value) => patchLine(line.lineId, { adjustmentQty: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} value={line.newQty} onChange={(value) => patchLine(line.lineId, { newQty: value })} /></td>
                          <td className="px-2 py-2"><NumberCell disabled={!editable} step="0.01" value={line.unitCost} onChange={(value) => patchLine(line.lineId, { unitCost: value })} /></td>
                          <td className={`px-2 py-2 text-right font-black font-mono ${line.valueImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>USD {line.valueImpact.toFixed(2)}</td>
                          <td className="px-2 py-2"><SelectCell disabled={!editable} value={line.reason} options={reasons} onChange={(value) => patchLine(line.lineId, { reason: value as StockAdjustmentReason })} /></td>
                          <td className="px-2 py-2 uppercase font-black">{line.riskLevel}</td>
                          <td className="px-2 py-2"><input disabled={!editable} value={line.notes} onChange={(event) => patchLine(line.lineId, { notes: event.target.value })} className={fieldClass('w-[170px] disabled:bg-slate-100')} /></td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button type="button" disabled={!editable} onClick={() => removeStockAdjustmentLine(record?.adjustmentId || '', line.lineId).then(() => reloadLines())} className="p-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white hover:bg-slate-50 rounded-none" title="Remove Line"><Trash2 className="w-3.5 h-3.5" /></button>
                              <button type="button" disabled={!editable} onClick={() => patchLine(line.lineId, { adjustmentQty: 0, newQty: line.currentQty, notes: '' })} className="p-1 border border-[#b1b5c2] disabled:bg-slate-100 bg-white hover:bg-slate-50 rounded-none" title="Clear Line"><RotateCcw className="w-3.5 h-3.5" /></button>
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
              <button type="button" onClick={() => record ? patchRecord(record) : ensureDraft()} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Save Draft</button>
              <button type="button" onClick={handleSubmit} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Submit for Approval</button>
              <button type="button" onClick={handleApprove} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Approve</button>
              <button type="button" onClick={handleReject} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Reject</button>
              <button type="button" onClick={handlePost} className="px-3 py-2 border border-orange-700 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[9px] rounded-none">Post Adjustment</button>
              <button type="button" onClick={handleCancel} className="px-3 py-2 border border-red-300 bg-white text-red-700 font-black uppercase text-[9px] rounded-none">Cancel</button>
              <button type="button" onClick={handleExport} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Prepare Export</button>
              <button type="button" onClick={handleClear} className="px-3 py-2 border border-[#b1b5c2] bg-white text-[#1e222b] font-black uppercase text-[9px] rounded-none">Clear Form</button>
              <button type="button" onClick={onClose} className="px-3 py-2 border border-[#1e222b] bg-[#1e222b] text-white font-black uppercase text-[9px] rounded-none">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, type = 'text', disabled = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="block space-y-1"><span className="text-[8px] uppercase font-black text-slate-500">{label}</span><input type={type} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('disabled:bg-slate-100')} /></label>;
}

function SelectInput({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block space-y-1"><span className="text-[8px] uppercase font-black text-slate-500">{label}</span><select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('disabled:bg-slate-100')}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function SelectCell({ value, options, onChange, disabled = false }: { value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <select disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass('w-[150px] disabled:bg-slate-100')}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function TextArea({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block space-y-1"><span className="text-[8px] uppercase font-black text-slate-500">{label}</span><textarea disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className={fieldClass('resize-none disabled:bg-slate-100')} /></label>;
}

function Readonly({ label, value }: { label: string; value: string }) {
  return <label className="block space-y-1"><span className="text-[8px] uppercase font-black text-slate-500">{label}</span><input readOnly value={value} className={fieldClass('bg-slate-100')} /></label>;
}

function NumberCell({ value, onChange, disabled, step = '1' }: { value: number; onChange: (value: number) => void; disabled: boolean; step?: string }) {
  return <input type="number" step={step} disabled={disabled} value={value} onChange={(event) => onChange(Number(event.target.value) || 0)} className={fieldClass('w-[82px] text-right font-mono disabled:bg-slate-100')} />;
}

function TotalBox({ label, value }: { label: string; value: string | number }) {
  return <div className="border border-[#b1b5c2] bg-slate-50 p-3"><div className="text-[8px] uppercase font-black text-slate-500">{label}</div><div className="text-[14px] font-black text-[#1e222b] font-mono">{value}</div></div>;
}
