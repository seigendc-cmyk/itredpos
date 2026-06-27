import React, { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle, Eye, Plus, Recycle, RotateCcw, Search, Send, Trash2, X } from 'lucide-react';
import {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine
} from '../types';
import {
  addInputLine,
  addOutputLine,
  approveTransformation,
  cancelTransformation,
  createTransformationDraft,
  getInputLines,
  getOutputLines,
  getTransformations,
  postTransformation,
  removeInputLine,
  removeOutputLine,
  updateInputLine,
  updateOutputLine
} from '../services/productTransformationService';
import {
  POProductSearchResult,
  searchProductsAnyOrder
} from '../services/purchaseOrderProductService';

function POMetric({ label, value }: { label: string; value: string | number }) {

  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <span className="block text-[8.5px] uppercase font-black text-slate-500">{label}</span>
      <strong className="block mt-1 text-[16px] font-black text-[#1e222b]">{value}</strong>
    </div>
  );
}

function fieldClass() {
  return 'w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none';
}

function statusClass(status: ProductTransformation['status']) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Cancelled' || status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Approved') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Pending Approval') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

type PickerMode = 'Input' | 'Output';

export default function ProductTransformationPanel() {
  const [records, setRecords] = useState<ProductTransformation[]>([]);
  const [selected, setSelected] = useState<ProductTransformation | null>(null);
  const [inputLines, setInputLines] = useState<ProductTransformationInputLine[]>([]);
  const [outputLines, setOutputLines] = useState<ProductTransformationOutputLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<POProductSearchResult[]>([]);

  const refresh = async () => {
    const rows = await getTransformations({});
    setRecords(rows);
    setNotice(`Loaded ${rows.length} transformation record(s).`);

    if (selected) {
      const refreshed = rows.find((item) => item.transformationId === selected.transformationId) || null;
      setSelected(refreshed);
    }
  };

  const loadTransformationDetail = async (record: ProductTransformation) => {
    const [inputs, outputs] = await Promise.all([
      getInputLines(record.transformationId),
      getOutputLines(record.transformationId)
    ]);

    setSelected(record);
    setInputLines(inputs);
    setOutputLines(outputs);
    setNotice(`${record.transformationNumber} loaded.`);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const editable = selected?.status === 'Draft';

  const summary = useMemo(() => ({
    draft: records.filter((item) => item.status === 'Draft').length,
    pending: records.filter((item) => item.status === 'Pending Approval').length,
    approved: records.filter((item) => item.status === 'Approved').length,
    completed: records.filter((item) => item.status === 'Completed').length
  }), [records]);

  const detailSummary = useMemo(() => {
    const inputQty = inputLines.reduce((sum, line) => sum + line.qtyConsumed, 0);
    const outputQty = outputLines.reduce((sum, line) => sum + line.qtyProduced, 0);
    const inputCost = inputLines.reduce((sum, line) => sum + line.totalCost, 0);
    const outputValue = outputLines.reduce((sum, line) => sum + line.totalValue, 0);
    const yieldPercent = inputQty > 0 ? (outputQty / inputQty) * 100 : 0;

    return { inputQty, outputQty, inputCost, outputValue, yieldPercent };
  }, [inputLines, outputLines]);

  const handleCreateDraft = async () => {
    const draft = await createTransformationDraft({
      vendorId: 'LOCAL_VENDOR',
      branchId: 'LOCAL_BRANCH',
      requestedByStaffId: 'LOCAL_STAFF',
      requestedByStaffName: 'Local Operator',
      notes: draftNotes.trim() || 'Product transformation draft created from POS workspace.'
    });

    setDraftNotes('');
    setCreateOpen(false);
    await refresh();
    await loadTransformationDetail(draft);
  };

  const reloadSelected = async () => {
    if (!selected) return;
    await loadTransformationDetail(selected);
  };

  const openPicker = (mode: PickerMode) => {
    if (!selected || !editable) return;
    setPickerMode(mode);
    setProductQuery('');
    setProductResults([]);
  };

  const handleProductSearch = async () => {
    const rows = await searchProductsAnyOrder(productQuery);
    setProductResults(rows);
    setNotice(`${rows.length} product match(es) found.`);
  };

  const handleSelectProduct = async (result: POProductSearchResult) => {
    if (!selected || !pickerMode || !editable) return;

    const product = result.product;
    const warehouse = result.shelfLocation || 'MAIN';
    const unitCost = product.defaultCostPrice || 0;

    if (pickerMode === 'Input') {
      const line = await addInputLine(selected.transformationId, {
        productId: product.productId,
        sku: product.sku || product.productCode,
        productName: product.productName,
        qtyConsumed: 1,
        unitCost,
        sourceWarehouseId: warehouse,
        sourceShelfLocation: result.shelfLocation
      });

      if (!line) {
        setNotice('Input product could not be added.');
        return;
      }
    }

    if (pickerMode === 'Output') {
      const line = await addOutputLine(selected.transformationId, {
        productId: product.productId,
        sku: product.sku || product.productCode,
        productName: product.productName,
        qtyProduced: 1,
        unitCost,
        destinationWarehouseId: warehouse,
        destinationShelfLocation: result.shelfLocation
      });

      if (!line) {
        setNotice('Output product could not be added.');
        return;
      }
    }

    setPickerMode(null);
    setProductQuery('');
    setProductResults([]);
    await reloadSelected();
  };

  const handleUpdateInput = async (lineId: string, patch: Partial<ProductTransformationInputLine>) => {
    if (!selected || !editable) return;
    const updated = await updateInputLine(selected.transformationId, lineId, patch);
    if (!updated) return;
    setInputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));
  };

  const handleUpdateOutput = async (lineId: string, patch: Partial<ProductTransformationOutputLine>) => {
    if (!selected || !editable) return;
    const updated = await updateOutputLine(selected.transformationId, lineId, patch);
    if (!updated) return;
    setOutputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));
  };

  const handleRemoveInput = async (lineId: string) => {
    if (!selected || !editable) return;
    const removed = await removeInputLine(selected.transformationId, lineId);
    if (removed) setInputLines((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const handleRemoveOutput = async (lineId: string) => {
    if (!selected || !editable) return;
    const removed = await removeOutputLine(selected.transformationId, lineId);
    if (removed) setOutputLines((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const handleApprove = async () => {
    if (!selected || selected.status !== 'Draft') return;
    const updated = await approveTransformation(selected.transformationId, 'LOCAL_STAFF');
    if (!updated) {
      setNotice('Transformation could not be approved.');
      return;
    }
    await refresh();
    await loadTransformationDetail(updated);
    setNotice(`${updated.transformationNumber} approved.`);
  };

  const handleCancel = async () => {
    if (!selected || selected.status === 'Completed' || selected.status === 'Cancelled') return;
    const updated = await cancelTransformation(selected.transformationId);
    if (!updated) {
      setNotice('Transformation could not be cancelled.');
      return;
    }
    await refresh();
    await loadTransformationDetail(updated);
    setNotice(`${updated.transformationNumber} cancelled.`);
  };

  const handlePost = async () => {
    if (!selected || selected.status !== 'Approved') return;

    const result = await postTransformation(selected.transformationId);
    setNotice(result.message);

    await refresh();

    const refreshed = (await getTransformations({})).find((item) => item.transformationId === selected.transformationId);
    if (refreshed) {
      await loadTransformationDetail(refreshed);
    }
  };

  return (
    <div className="industrial-section p-5 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
        <div>
          <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
            <Recycle className="w-4 h-4 text-orange-500" />
            Product Transformation
          </span>
          <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">
            Product picker enabled. Build 2K-07 selects products from Product Master.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-[#1e222b] hover:bg-black text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Transformation
          </button>
          <button type="button" onClick={() => void refresh()} className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="border border-orange-300 bg-orange-50 p-4 text-[9.5px] uppercase font-black text-slate-800">
        Product picker only. No approval, cancellation, posting, audit, or stock movement is triggered from this build.
      </div>

      {createOpen && (
        <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <span className="text-[10px] uppercase font-black text-[#1e222b]">Create Transformation Draft</span>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} className="w-full min-h-[90px] border border-[#b1b5c2] bg-white p-3 text-[10px] uppercase font-bold outline-none focus:border-orange-500 rounded-none" placeholder="Describe the transformation, batch, repack, kit, or production job." />
          <button type="button" onClick={() => void handleCreateDraft()} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer">
            Save Draft
          </button>
        </div>
      )}

      {pickerMode && (
        <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <span className="text-[10px] uppercase font-black text-[#1e222b]">
              Select Product For {pickerMode} Line
            </span>
            <button type="button" onClick={() => setPickerMode(null)} className="text-slate-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              className={fieldClass()}
              placeholder="Search SKU, product name, barcode, brand, part number..."
            />
            <button
              type="button"
              onClick={() => void handleProductSearch()}
              className="px-4 py-2 bg-[#1e222b] text-white font-black uppercase text-[9px] flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>

          <div className="border border-gray-200 overflow-x-auto max-h-[260px] pos-custom-scroll">
            <table className="w-full text-[9px] uppercase">
              <thead className="bg-slate-100 text-slate-700 font-black sticky top-0">
                <tr>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Available</th>
                  <th className="p-2 text-right">Cost</th>
                  <th className="p-2 text-left">Shelf</th>
                  <th className="p-2 text-center">Select</th>
                </tr>
              </thead>
              <tbody>
                {productResults.length === 0 ? (
                  <tr><td colSpan={6} className="p-3 text-center text-slate-500 font-bold">Search for a product.</td></tr>
                ) : productResults.map((row) => (
                  <tr key={row.product.productId} className="border-t border-gray-100">
                    <td className="p-2 font-bold">{row.product.sku || row.product.productCode}</td>
                    <td className="p-2 font-bold">{row.product.productName}</td>
                    <td className="p-2 text-right font-mono">{row.currentStock}</td>
                    <td className="p-2 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>
                    <td className="p-2 font-bold">{row.shelfLocation || '-'}</td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => void handleSelectProduct(row)} className="px-2 py-1 bg-orange-500 text-white text-[8px] uppercase font-black">
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notice && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <POMetric label="Draft Jobs" value={summary.draft} />
        <POMetric label="Pending Approval" value={summary.pending} />
        <POMetric label="Approved" value={summary.approved} />
        <POMetric label="Completed" value={summary.completed} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-4 procurement-table-scroll pos-custom-scroll">
          <table className="procurement-table">
            <thead>
              <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                <th className="py-2 px-3">Transformation</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {records.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center uppercase font-bold text-slate-500">No product transformations found.</td></tr>
              ) : records.map((record) => (
                <tr key={record.transformationId} className="hover:bg-slate-50 transition-colors h-11">
                  <td className="py-2 px-3">
                    <div className="font-black text-orange-700">{record.transformationNumber}</div>
                    <div className="text-[8px] uppercase font-bold text-slate-500">{record.transformationDate} | {record.branchId}</div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(record.status)}`}>{record.status}</span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button type="button" onClick={() => void loadTransformationDetail(record)} className="inline-flex items-center gap-1 px-2 py-1 border border-[#b1b5c2] bg-white hover:bg-slate-50 text-[8px] uppercase font-black">
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-8 border border-[#b1b5c2] bg-white p-4 space-y-4">
          {selected ? (
            <>
              <div className="border-b border-gray-150 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] uppercase font-black text-[#1e222b]">{selected.transformationNumber}</h3>
                    <p className="text-[9px] uppercase font-bold text-slate-500">{selected.notes || 'No notes captured.'}</p>
                  </div>
                  <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(selected.status)}`}>{selected.status}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Input Materials</h4>
                  <button type="button" disabled={!editable} onClick={() => openPicker('Input')} className="px-3 py-1 bg-[#1e222b] disabled:bg-slate-300 text-white text-[8px] uppercase font-black">+ Add Input</button>
                </div>
                <div className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-left">Warehouse</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputLines.length === 0 ? (
                        <tr><td colSpan={7} className="p-3 text-center text-slate-500 font-bold">No input lines captured.</td></tr>
                      ) : inputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-1"><input disabled={!editable} className={fieldClass()} value={line.sourceWarehouseId} onChange={(event) => void handleUpdateInput(line.lineId, { sourceWarehouseId: event.target.value })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.qtyConsumed} onChange={(event) => void handleUpdateInput(line.lineId, { qtyConsumed: Number(event.target.value) })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.unitCost} onChange={(event) => void handleUpdateInput(line.lineId, { unitCost: Number(event.target.value) })} /></td>
                          <td className="p-2 text-right font-mono">{line.totalCost.toFixed(2)}</td>
                          <td className="p-2 text-center"><button disabled={!editable} type="button" onClick={() => void handleRemoveInput(line.lineId)} className="text-red-600 disabled:text-slate-300"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Output Products</h4>
                  <button type="button" disabled={!editable} onClick={() => openPicker('Output')} className="px-3 py-1 bg-[#1e222b] disabled:bg-slate-300 text-white text-[8px] uppercase font-black">+ Add Output</button>
                </div>
                <div className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-left">Warehouse</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputLines.length === 0 ? (
                        <tr><td colSpan={7} className="p-3 text-center text-slate-500 font-bold">No output lines captured.</td></tr>
                      ) : outputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-1"><input disabled={!editable} className={fieldClass()} value={line.destinationWarehouseId} onChange={(event) => void handleUpdateOutput(line.lineId, { destinationWarehouseId: event.target.value })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.qtyProduced} onChange={(event) => void handleUpdateOutput(line.lineId, { qtyProduced: Number(event.target.value) })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.unitCost} onChange={(event) => void handleUpdateOutput(line.lineId, { unitCost: Number(event.target.value) })} /></td>
                          <td className="p-2 text-right font-mono">{line.totalValue.toFixed(2)}</td>
                          <td className="p-2 text-center"><button disabled={!editable} type="button" onClick={() => void handleRemoveOutput(line.lineId)} className="text-red-600 disabled:text-slate-300"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border border-[#b1b5c2] bg-slate-50 p-3">
                <button
                  type="button"
                  disabled={!selected || selected.status !== 'Draft'}
                  onClick={() => void handleApprove()}
                  className="px-4 py-2 bg-emerald-600 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>

                <button
                  type="button"
                  disabled={!selected || selected.status === 'Completed' || selected.status === 'Cancelled'}
                  onClick={() => void handleCancel()}
                  className="px-4 py-2 bg-red-600 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!selected || selected.status !== 'Approved'}
                  onClick={() => void handlePost()}
                  className="px-4 py-2 bg-orange-500 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <POMetric label="Input Qty" value={detailSummary.inputQty} />
                <POMetric label="Output Qty" value={detailSummary.outputQty} />
                <POMetric label="Input Cost" value={detailSummary.inputCost.toFixed(2)} />
                <POMetric label="Output Value" value={detailSummary.outputValue.toFixed(2)} />
                <POMetric label="Yield %" value={detailSummary.yieldPercent.toFixed(2)} />
              </div>
            </>
          ) : (
            <div className="py-16 text-center uppercase font-black text-slate-500 text-[10px]">Select a transformation to view input and output lines.</div>
          )}
        </div>
      </div>
    </div>
  );
}




