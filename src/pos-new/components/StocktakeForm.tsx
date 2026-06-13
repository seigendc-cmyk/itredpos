import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Eye, Maximize2, Minus, RotateCcw, Save, Send, Square, Trash2, X } from 'lucide-react';
import {
  Product,
  StocktakeCountMode,
  StocktakeLine,
  StocktakeScope,
  StocktakeSession,
  StocktakeVarianceSummary
} from '../types';

interface StocktakeFormProps {
  open: boolean;
  session: StocktakeSession | null;
  lines: StocktakeLine[];
  summary: StocktakeVarianceSummary | null;
  products: Product[];
  operatorName: string;
  branchOptions: string[];
  warehouseOptions: string[];
  onClose: () => void;
  onCreateDraft: (payload: {
    branchId: string;
    warehouseId: string;
    scope: StocktakeScope;
    countMode: StocktakeCountMode;
    notes: string;
    categoryFilter?: string;
    supplierFilter?: string;
    shelfLocationFilter?: string;
    selectedProductIds?: string[];
  }) => void;
  onUpdateDraft: (patch: Partial<StocktakeSession>) => void;
  onStartCounting: () => void;
  onSubmit: () => void;
  onRequestRecount: (lineIds: string[], notes: string) => void;
  onApprove: () => void;
  onPost: () => void;
  onCancel: (reason: string) => void;
  onExport: () => void;
  onLineCountChange: (lineId: string, countedQty: number | null, notes: string) => void;
  onExcludeLine: (lineId: string, reason: string) => void;
  onRestoreLine: (lineId: string) => void;
  onCompleteRecount: (lineIds: string[], notes: string) => void;
  onBulkCountAction: (mode: 'same-as-system' | 'clear') => void;
  onViewLedger: (sku: string) => void;
}

const SCOPE_OPTIONS: StocktakeScope[] = [
  'Full Inventory',
  'Branch',
  'Warehouse',
  'Category',
  'Supplier',
  'Shelf Location',
  'Selected Products',
  'High Risk Products',
  'Low Stock Products',
  'No Movement Products'
];

const COUNT_MODE_OPTIONS: StocktakeCountMode[] = [
  'Visible System Qty',
  'Blind Count',
  'Supervisor Count',
  'Recount'
];

export default function StocktakeForm({
  open,
  session,
  lines,
  summary,
  products,
  operatorName,
  branchOptions,
  warehouseOptions,
  onClose,
  onCreateDraft,
  onUpdateDraft,
  onStartCounting,
  onSubmit,
  onRequestRecount,
  onApprove,
  onPost,
  onCancel,
  onExport,
  onLineCountChange,
  onExcludeLine,
  onRestoreLine,
  onCompleteRecount,
  onBulkCountAction,
  onViewLedger
}: StocktakeFormProps) {
  const [windowState, setWindowState] = useState<'normal' | 'minimized' | 'maximized'>('normal');
  const [branchId, setBranchId] = useState(session?.branchId || branchOptions[0] || 'Harare Main');
  const [warehouseId, setWarehouseId] = useState(session?.warehouseId || warehouseOptions[0] || 'Harare Spares Depot');
  const [scope, setScope] = useState<StocktakeScope>(session?.scope || 'Selected Products');
  const [countMode, setCountMode] = useState<StocktakeCountMode>(session?.countMode || 'Visible System Qty');
  const [notes, setNotes] = useState(session?.notes || 'Physical count session. No stock change until posting.');
  const [categoryFilter, setCategoryFilter] = useState(session?.categoryFilter || '');
  const [supplierFilter, setSupplierFilter] = useState(session?.supplierFilter || '');
  const [shelfLocationFilter, setShelfLocationFilter] = useState(session?.shelfLocationFilter || '');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(session?.selectedProductIds || []);
  const [countNotes, setCountNotes] = useState<Record<string, string>>({});
  const [lineSearch, setLineSearch] = useState('');
  const [lineStatusFilter, setLineStatusFilter] = useState('ALL');
  const [lineRiskFilter, setLineRiskFilter] = useState('ALL');
  const [varianceOnly, setVarianceOnly] = useState(false);
  const [notCountedOnly, setNotCountedOnly] = useState(false);
  const countInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setBranchId(session?.branchId || branchOptions[0] || 'Harare Main');
    setWarehouseId(session?.warehouseId || warehouseOptions[0] || 'Harare Spares Depot');
    setScope(session?.scope || 'Selected Products');
    setCountMode(session?.countMode || 'Visible System Qty');
    setNotes(session?.notes || 'Physical count session. No stock change until posting.');
    setCategoryFilter(session?.categoryFilter || '');
    setSupplierFilter(session?.supplierFilter || '');
    setShelfLocationFilter(session?.shelfLocationFilter || '');
    setSelectedProductIds(session?.selectedProductIds || []);
  }, [branchOptions, session, warehouseOptions]);

  const categories = useMemo(() => Array.from(new Set(products.map((product) => product.productCategory || product.category).filter(Boolean))), [products]);
  const suppliers = useMemo(() => Array.from(new Set(products.map((product) => product.supplierName || product.supplierId).filter(Boolean))) as string[], [products]);
  const shelves = useMemo(() => Array.from(new Set(products.map((product) => product.shelfLocation).filter(Boolean))) as string[], [products]);
  const productMatches = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products
      .filter((product) => !query || `${product.code} ${product.name} ${product.sku || ''}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [productSearch, products]);

  const isPosted = session?.status === 'Posted';
  const canEditCounts = Boolean(session && !isPosted && session.status !== 'Cancelled');
  const hideSystemQty = session?.countMode === 'Blind Count' && (session.status === 'Counting' || session.status === 'Draft');
  const hideVariance = hideSystemQty;
  const stocktakeNumber = session?.stocktakeNumber || 'Auto-generated on save';
  const stocktakeDate = (session?.startedAt || new Date().toISOString()).slice(0, 10);
  const totalLines = summary?.totalLines ?? lines.length;
  const countedLines = summary?.countedLines ?? lines.filter((line) => line.countedQty !== null && line.lineStatus !== 'Excluded').length;
  const varianceLines = summary?.varianceLines ?? lines.filter((line) => line.lineStatus !== 'Excluded' && line.countedQty !== null && line.varianceQty !== 0).length;
  const excludedLines = summary?.excludedLines ?? lines.filter((line) => line.lineStatus === 'Excluded').length;
  const recountLines = lines.filter((line) => line.lineStatus === 'Recount Required').length;
  const countProgress = totalLines > 0 ? Math.round((countedLines / totalLines) * 100) : 0;
  const variancePercent = countedLines > 0 ? Math.round((varianceLines / countedLines) * 100) : 0;
  const approvalRequired = Boolean(summary?.approvalRequired);
  const filteredLines = useMemo(() => {
    const query = lineSearch.trim().toLowerCase();
    return lines.filter((line) => {
      const matchesSearch = !query || `${line.sku} ${line.productName} ${line.brand} ${line.category} ${line.shelfLocation || ''}`.toLowerCase().includes(query);
      const matchesStatus = lineStatusFilter === 'ALL' || line.lineStatus === lineStatusFilter;
      const matchesRisk = lineRiskFilter === 'ALL' || line.varianceRisk === lineRiskFilter;
      const matchesVariance = !varianceOnly || (line.countedQty !== null && line.varianceQty !== 0 && line.lineStatus !== 'Excluded');
      const matchesNotCounted = !notCountedOnly || (line.countedQty === null && line.lineStatus !== 'Excluded');
      return matchesSearch && matchesStatus && matchesRisk && matchesVariance && matchesNotCounted;
    });
  }, [lineRiskFilter, lineSearch, lineStatusFilter, lines, notCountedOnly, varianceOnly]);

  const handleSaveDraft = () => {
    if (session) {
      onUpdateDraft({ branchId, warehouseId, scope, countMode, notes, categoryFilter, supplierFilter, shelfLocationFilter, selectedProductIds });
      return;
    }
    onCreateDraft({ branchId, warehouseId, scope, countMode, notes, categoryFilter, supplierFilter, shelfLocationFilter, selectedProductIds });
  };

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);
  };

  const requestRecountForAllRisk = () => {
    const targetIds = lines.filter((line) => line.countedQty !== null && line.varianceQty !== 0 && line.lineStatus !== 'Excluded').map((line) => line.lineId);
    if (targetIds.length === 0) return;
    const note = window.prompt('Recount reason for variance lines');
    if (!note?.trim()) return;
    onRequestRecount(targetIds, note.trim());
  };

  const handleCountInputChange = (line: StocktakeLine, value: string) => {
    const note = countNotes[line.lineId] ?? line.countNotes;
    if (value.trim() === '') {
      onLineCountChange(line.lineId, null, note);
      return;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    onLineCountChange(line.lineId, parsed, note);
  };

  const focusNextCount = (lineId: string) => {
    const editableIds = filteredLines
      .filter((line) => line.lineStatus !== 'Excluded')
      .map((line) => line.lineId);
    const currentIndex = editableIds.indexOf(lineId);
    const nextId = editableIds[currentIndex + 1];
    if (nextId) countInputRefs.current[nextId]?.focus();
  };

  const requestLineRecount = (line: StocktakeLine) => {
    const note = window.prompt('Recount reason');
    if (!note?.trim()) return;
    onRequestRecount([line.lineId], note.trim());
  };

  const excludeLine = (line: StocktakeLine) => {
    const reason = window.prompt('Exclude reason');
    if (!reason?.trim()) return;
    onExcludeLine(line.lineId, reason.trim());
  };

  const completeRecountLine = (line: StocktakeLine) => {
    const note = window.prompt('Recount completion note') || 'Recount completed.';
    onCompleteRecount([line.lineId], note);
  };

  if (!open) return null;

  const panelClass = windowState === 'maximized'
    ? 'fixed inset-3'
    : 'fixed left-1/2 top-8 w-[min(1360px,calc(100vw-28px))] -translate-x-1/2';

  return (
    <div className="fixed inset-0 z-50 bg-black/35">
      <section className={`${panelClass} bg-white border border-[#111827] shadow-2xl max-h-[calc(100vh-56px)] flex flex-col rounded-none`}>
        <header className="bg-[#1e222b] text-white border-b-2 border-orange-600 px-4 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wide">Stocktake Session</h2>
            <p className="text-[10px] text-slate-200 uppercase">Physical stock count and variance posting control.</p>
          </div>
          <div className="flex items-center gap-1">
            <TitleButton title="Minimize" onClick={() => setWindowState('minimized')} icon={<Minus className="w-3.5 h-3.5" />} />
            <TitleButton title="Restore" onClick={() => setWindowState('normal')} icon={<Square className="w-3.5 h-3.5" />} />
            <TitleButton title="Maximize" onClick={() => setWindowState('maximized')} icon={<Maximize2 className="w-3.5 h-3.5" />} />
            <TitleButton title="Close" onClick={onClose} icon={<X className="w-3.5 h-3.5" />} />
          </div>
        </header>

        {windowState === 'minimized' ? (
          <div className="p-4 text-[11px] uppercase font-bold text-slate-700">Form minimized. Restore to continue stocktake control.</div>
        ) : (
          <div className="overflow-y-auto bg-[#f5f6f8] p-4 space-y-4 text-[11px]">
            <div className="border border-[#b1b5c2] bg-white p-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <ReadField label="Stocktake Number" value={stocktakeNumber} />
                <ReadField label="Stocktake Date" value={stocktakeDate} />
                <SelectField label="Branch" value={branchId} options={branchOptions} onChange={setBranchId} disabled={isPosted} />
                <SelectField label="Warehouse" value={warehouseId} options={warehouseOptions} onChange={setWarehouseId} disabled={isPosted} />
                <SelectField label="Scope" value={scope} options={SCOPE_OPTIONS} onChange={(value) => setScope(value as StocktakeScope)} disabled={isPosted} />
                <SelectField label="Count Mode" value={countMode} options={COUNT_MODE_OPTIONS} onChange={(value) => setCountMode(value as StocktakeCountMode)} disabled={isPosted} />
                <ReadField label="Status" value={isPosted ? 'Posted - Locked' : session?.status || 'Draft'} />
                <ReadField label="Requested By" value={session?.requestedByStaffName || operatorName} />
                <ReadField label="Counted By" value={session?.countedByStaffName || 'Not assigned'} />
                <TextField label="Notes" value={notes} onChange={setNotes} disabled={isPosted} />
              </div>
            </div>

            <div className="border border-[#b1b5c2] bg-white p-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <SelectField label="Category" value={categoryFilter} options={['', ...categories]} onChange={setCategoryFilter} disabled={isPosted} />
                <SelectField label="Supplier" value={supplierFilter} options={['', ...suppliers]} onChange={setSupplierFilter} disabled={isPosted} />
                <SelectField label="Shelf Location" value={shelfLocationFilter} options={['', ...shelves]} onChange={setShelfLocationFilter} disabled={isPosted} />
                <TextField label="Selected Product Search" value={productSearch} onChange={setProductSearch} disabled={isPosted} />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Placeholder label="High Risk Products Placeholder" />
                <Placeholder label="Low Stock Products Placeholder" />
                <Placeholder label="No Movement Products Placeholder" />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                {productMatches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    disabled={isPosted}
                    className={`text-left border px-2 py-1.5 rounded-none ${selectedProductIds.includes(product.id) ? 'border-orange-600 bg-orange-50 text-orange-800' : 'border-[#b1b5c2] bg-white text-slate-700'}`}
                  >
                    <span className="block font-black uppercase text-[9px]">{product.sku || product.code}</span>
                    <span className="block uppercase text-[8px]">{product.productName || product.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {(session?.countMode === 'Blind Count' || countMode === 'Blind Count') && (
              <div className="border-l-4 border-l-orange-600 border border-[#b1b5c2] bg-white p-3 font-bold uppercase text-slate-800">
                Blind Count Mode enabled. System quantity hidden during count entry.
              </div>
            )}

            {isPosted && (
              <div className="border-l-4 border-l-orange-600 border border-[#b1b5c2] bg-white p-3 text-[10px] font-black uppercase text-slate-800">
                Posted - Locked. Count editing, exclusion, recount, submit, approve, post, and cancel are disabled. View, export, and product ledger review remain available.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <SummaryBox label="Count Progress" value={`${countProgress}%`} />
              <SummaryBox label="Variance Lines" value={`${varianceLines} (${variancePercent}%)`} />
              <SummaryBox label="Recount Required" value={recountLines} />
              <SummaryBox label="Approval Required" value={approvalRequired ? 'Yes' : 'No'} />
              <SummaryBox label="Highest Risk" value={summary?.highestRisk ?? 'None'} />
              <SummaryBox label="Total Lines" value={totalLines} />
              <SummaryBox label="Counted Lines" value={countedLines} />
              <SummaryBox label="Not Counted" value={summary?.notCounted ?? 0} />
              <SummaryBox label="Excluded Lines" value={excludedLines} />
              <SummaryBox label="No Variance" value={summary?.noVariance ?? 0} />
              <SummaryBox label="Positive Lines" value={summary?.positiveVarianceLines ?? 0} />
              <SummaryBox label="Negative Lines" value={summary?.negativeVarianceLines ?? 0} />
              <SummaryBox label="Total Gain Qty" value={summary?.totalGainQty ?? 0} />
              <SummaryBox label="Total Loss Qty" value={summary?.totalLossQty ?? 0} />
              <SummaryBox label="Value Impact" value={hideVariance ? 'Hidden' : `USD ${(summary?.estimatedValueImpact ?? 0).toFixed(2)}`} />
            </div>

            <div className="border border-[#b1b5c2] bg-white p-3">
              <div className="bg-[#1e222b] text-white px-3 py-2 text-[10px] font-black uppercase">Count Entry Filters and Fast Actions</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                <TextField label="Line Search" value={lineSearch} onChange={setLineSearch} />
                <SelectField label="Line Status" value={lineStatusFilter} options={['ALL', 'Not Counted', 'Counted', 'Variance', 'Recount Required', 'Approved', 'Posted', 'Excluded']} onChange={setLineStatusFilter} />
                <SelectField label="Variance Risk" value={lineRiskFilter} options={['ALL', 'None', 'Low', 'Medium', 'High', 'Critical']} onChange={setLineRiskFilter} />
                <label className="flex items-center gap-2 border border-[#b1b5c2] bg-slate-50 px-2 py-2 text-[9px] font-black uppercase text-slate-700">
                  <input type="checkbox" checked={varianceOnly} onChange={(event) => setVarianceOnly(event.target.checked)} />
                  Variance Only
                </label>
                <label className="flex items-center gap-2 border border-[#b1b5c2] bg-slate-50 px-2 py-2 text-[9px] font-black uppercase text-slate-700">
                  <input type="checkbox" checked={notCountedOnly} onChange={(event) => setNotCountedOnly(event.target.checked)} />
                  Not Counted
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  label="Mark Uncounted Same"
                  icon={<Check className="w-3.5 h-3.5" />}
                  onClick={() => window.confirm('Mark every uncounted non-excluded line as same as system?') && onBulkCountAction('same-as-system')}
                  disabled={!canEditCounts}
                />
                <ActionButton
                  label="Clear Counts"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => window.confirm('Clear all non-excluded counts in this stocktake?') && onBulkCountAction('clear')}
                  disabled={!canEditCounts}
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-[#b1b5c2] bg-white">
              <table className="industrial-table min-w-[1320px]">
                <thead>
                  <tr>
                    {['SKU', 'Product Name', 'Brand', 'Category', 'Shelf', 'System Qty', 'Counted Qty', 'Variance', 'Unit Cost', 'Value Impact', 'Risk', 'Status', 'Notes', 'Action'].map((label) => (
                      <th key={label} className="py-2 px-3">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLines.map((line) => (
                    <tr key={line.lineId} className={line.lineStatus === 'Excluded' ? 'bg-slate-100 text-slate-500' : 'bg-white'}>
                      <td className="py-2 px-3 font-black text-orange-700">{line.sku}</td>
                      <td className="py-2 px-3 font-bold uppercase text-[#1e222b]">{line.productName}</td>
                      <td className="py-2 px-3 uppercase">{line.brand}</td>
                      <td className="py-2 px-3 uppercase">{line.category}</td>
                      <td className="py-2 px-3 uppercase">{line.shelfLocation || 'N/A'}</td>
                      <td className="py-2 px-3 text-right font-black">{hideSystemQty ? 'Hidden' : line.systemQty}</td>
                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          <input
                            ref={(element) => { countInputRefs.current[line.lineId] = element; }}
                            type="number"
                            min={0}
                            value={line.countedQty ?? ''}
                            disabled={!canEditCounts || line.lineStatus === 'Excluded'}
                            onChange={(event) => handleCountInputChange(line, event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') focusNextCount(line.lineId);
                            }}
                            className="w-[88px] border border-[#8d8780] px-2 py-1 text-right font-black rounded-none disabled:bg-slate-100"
                          />
                          <div className="flex gap-1">
                            <button type="button" disabled={!canEditCounts || line.lineStatus === 'Excluded'} onClick={() => onLineCountChange(line.lineId, 0, countNotes[line.lineId] ?? line.countNotes)} className="border border-[#b1b5c2] px-1 py-0.5 text-[8px] font-black uppercase disabled:bg-slate-100">Zero</button>
                            <button type="button" disabled={!canEditCounts || line.lineStatus === 'Excluded'} onClick={() => onLineCountChange(line.lineId, line.systemQty, countNotes[line.lineId] ?? line.countNotes)} className="border border-[#b1b5c2] px-1 py-0.5 text-[8px] font-black uppercase disabled:bg-slate-100">Same</button>
                            <button type="button" disabled={!canEditCounts || line.lineStatus === 'Excluded'} onClick={() => onLineCountChange(line.lineId, null, countNotes[line.lineId] ?? line.countNotes)} className="border border-[#b1b5c2] px-1 py-0.5 text-[8px] font-black uppercase disabled:bg-slate-100">Clear</button>
                          </div>
                        </div>
                      </td>
                      <td className={`py-2 px-3 text-right font-black ${line.varianceQty > 0 ? 'text-emerald-800' : line.varianceQty < 0 ? 'text-red-800' : 'text-slate-800'}`}>
                        {hideVariance ? 'Calculated after submit' : line.varianceQty > 0 ? `+${line.varianceQty}` : line.varianceQty}
                      </td>
                      <td className="py-2 px-3 text-right">{line.unitCost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right font-black">{hideVariance ? 'Calculated after submit' : line.valueImpact.toFixed(2)}</td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{line.varianceRisk}</span></td>
                      <td className="py-2 px-3"><span className="sci-status-pill rounded-none">{line.lineStatus}</span></td>
                      <td className="py-2 px-3">
                        <input
                          value={countNotes[line.lineId] ?? line.countNotes}
                          disabled={!canEditCounts}
                          onChange={(event) => setCountNotes((current) => ({ ...current, [line.lineId]: event.target.value }))}
                          onBlur={() => line.countedQty !== null && onLineCountChange(line.lineId, line.countedQty, countNotes[line.lineId] || line.countNotes)}
                          className="w-full border border-[#b1b5c2] px-2 py-1 rounded-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          <IconButton title="Request Recount" onClick={() => requestLineRecount(line)} icon={<RotateCcw className="w-3.5 h-3.5" />} disabled={isPosted || line.lineStatus === 'Excluded'} />
                          <IconButton title="Complete Recount" onClick={() => completeRecountLine(line)} icon={<Check className="w-3.5 h-3.5" />} disabled={isPosted || line.lineStatus !== 'Recount Required'} />
                          {line.lineStatus === 'Excluded' ? (
                            <IconButton title="Restore Line" onClick={() => onRestoreLine(line.lineId)} icon={<Check className="w-3.5 h-3.5" />} disabled={isPosted} />
                          ) : (
                            <IconButton title="Exclude Line" onClick={() => excludeLine(line)} icon={<X className="w-3.5 h-3.5" />} disabled={isPosted} />
                          )}
                          <IconButton title="View Product Ledger" onClick={() => onViewLedger(line.sku)} icon={<Eye className="w-3.5 h-3.5" />} />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredLines.length === 0 && (
                    <tr>
                      <td colSpan={14} className="py-8 text-center uppercase font-bold text-slate-500">{lines.length === 0 ? 'Save draft to generate stocktake lines from scope.' : 'No stocktake lines match the current filters.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="sticky bottom-0 bg-white border border-[#b1b5c2] p-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[9px] uppercase font-bold text-slate-600">Draft, counting, submitted and approved stocktake states do not update stock. Only Post Variance writes movements.</span>
              <div className="flex flex-wrap gap-2">
                <ActionButton label="Save Draft" icon={<Save className="w-3.5 h-3.5" />} onClick={handleSaveDraft} disabled={isPosted} />
                <ActionButton label="Start Counting" icon={<Check className="w-3.5 h-3.5" />} onClick={onStartCounting} disabled={!session || isPosted} />
                <ActionButton label="Submit Stocktake" icon={<Send className="w-3.5 h-3.5" />} onClick={onSubmit} disabled={!session || isPosted} />
                <ActionButton label="Request Recount" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={requestRecountForAllRisk} disabled={!session || isPosted} />
                <ActionButton label="Approve" icon={<Check className="w-3.5 h-3.5" />} onClick={onApprove} disabled={!session || isPosted} />
                <ActionButton label="Post Variance" primary icon={<Check className="w-3.5 h-3.5" />} onClick={onPost} disabled={!session || isPosted} />
                <ActionButton label="Cancel" icon={<X className="w-3.5 h-3.5" />} onClick={() => onCancel(window.prompt('Cancel reason') || '')} disabled={!session || isPosted} />
                <ActionButton label="Prepare Export" icon={<Download className="w-3.5 h-3.5" />} onClick={onExport} disabled={!session} />
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
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 border px-3 py-2 rounded-none text-[9px] font-black uppercase disabled:bg-slate-200 disabled:text-slate-500 ${primary ? 'bg-orange-600 border-orange-700 text-white hover:bg-orange-700' : 'bg-white border-[#b1b5c2] text-slate-800 hover:bg-slate-50'}`}
    >
      {icon}
      {label}
    </button>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span>
      <span className="block border border-[#b1b5c2] bg-slate-50 px-2 py-1.5 font-bold text-slate-800 min-h-[29px]">{value}</span>
    </label>
  );
}

function TextField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block md:col-span-2">
      <span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full border border-[#8d8780] bg-white px-2 py-1.5 rounded-none disabled:bg-slate-100" />
    </label>
  );
}

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase font-black text-slate-600 mb-1">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full border border-[#8d8780] bg-white px-2 py-1.5 rounded-none disabled:bg-slate-100">
        {options.map((option) => <option key={option || 'blank'} value={option}>{option || 'Any'}</option>)}
      </select>
    </label>
  );
}

function Placeholder({ label }: { label: string }) {
  return <div className="border border-dashed border-[#b1b5c2] bg-slate-50 px-2 py-2 text-[9px] uppercase font-bold text-slate-600">{label}</div>;
}

function SummaryBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#b1b5c2] bg-white p-2">
      <span className="block text-[8px] uppercase font-black text-slate-500">{label}</span>
      <strong className="block text-[14px] text-[#1e222b]">{value}</strong>
    </div>
  );
}
