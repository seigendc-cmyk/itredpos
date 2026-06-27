import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Plus, Recycle, RotateCcw, X } from 'lucide-react';
import {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine
} from '../types';
import {
  createTransformationDraft,
  getInputLines,
  getOutputLines,
  getTransformations
} from '../services/productTransformationService';

function POMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <span className="block text-[8.5px] uppercase font-black text-slate-500">{label}</span>
      <strong className="block mt-1 text-[16px] font-black text-[#1e222b]">{value}</strong>
    </div>
  );
}

function statusClass(status: ProductTransformation['status']) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Cancelled' || status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Approved') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Pending Approval') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export default function ProductTransformationPanel() {
  const [records, setRecords] = useState<ProductTransformation[]>([]);
  const [selected, setSelected] = useState<ProductTransformation | null>(null);
  const [inputLines, setInputLines] = useState<ProductTransformationInputLine[]>([]);
  const [outputLines, setOutputLines] = useState<ProductTransformationOutputLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

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

  const summary = useMemo(() => {
    return {
      draft: records.filter((item) => item.status === 'Draft').length,
      pending: records.filter((item) => item.status === 'Pending Approval').length,
      approved: records.filter((item) => item.status === 'Approved').length,
      completed: records.filter((item) => item.status === 'Completed').length
    };
  }, [records]);

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
    setNotice(`${draft.transformationNumber} created as draft.`);
    await refresh();
    await loadTransformationDetail(draft);
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
            Select a transformation and review input/output lines. Build 2K-05 is read-only detail mode.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 bg-[#1e222b] hover:bg-black text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Transformation
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="border border-orange-300 bg-orange-50 p-4 text-[9.5px] uppercase font-black text-slate-800">
        Read-only detail view. No stock movement, approval, cancellation, or posting logic is triggered from this build.
      </div>

      {createOpen && (
        <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <span className="text-[10px] uppercase font-black text-[#1e222b]">Create Transformation Draft</span>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <label className="block">
            <span className="block text-[8.5px] uppercase font-black text-slate-500 mb-1">Notes</span>
            <textarea
              value={draftNotes}
              onChange={(event) => setDraftNotes(event.target.value)}
              className="w-full min-h-[90px] border border-[#b1b5c2] bg-white p-3 text-[10px] uppercase font-bold outline-none focus:border-orange-500 rounded-none"
              placeholder="Describe the transformation, batch, repack, kit, or production job."
            />
          </label>

          <button
            type="button"
            onClick={() => void handleCreateDraft()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer"
          >
            Save Draft
          </button>
        </div>
      )}

      {notice && (
        <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <POMetric label="Draft Jobs" value={summary.draft} />
        <POMetric label="Pending Approval" value={summary.pending} />
        <POMetric label="Approved" value={summary.approved} />
        <POMetric label="Completed" value={summary.completed} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-5 procurement-table-scroll pos-custom-scroll">
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
                <tr>
                  <td colSpan={3} className="py-8 text-center uppercase font-bold text-slate-500">
                    No product transformations found.
                  </td>
                </tr>
              ) : records.map((record) => (
                <tr key={record.transformationId} className="hover:bg-slate-50 transition-colors h-11">
                  <td className="py-2 px-3">
                    <div className="font-black text-orange-700">{record.transformationNumber}</div>
                    <div className="text-[8px] uppercase font-bold text-slate-500">{record.transformationDate} | {record.branchId}</div>
                    <div className="text-[8px] uppercase font-bold text-slate-500">{record.requestedByStaffName || record.requestedByStaffId}</div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => void loadTransformationDetail(record)}
                      className="inline-flex items-center gap-1 px-2 py-1 border border-[#b1b5c2] bg-white hover:bg-slate-50 text-[8px] uppercase font-black"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-7 border border-[#b1b5c2] bg-white p-4 space-y-4">
          {selected ? (
            <>
              <div className="border-b border-gray-150 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] uppercase font-black text-[#1e222b]">{selected.transformationNumber}</h3>
                    <p className="text-[9px] uppercase font-bold text-slate-500">{selected.notes || 'No notes captured.'}</p>
                  </div>
                  <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-[9px] uppercase font-bold text-slate-700">
                  <div><span className="block text-slate-400">Date</span>{selected.transformationDate}</div>
                  <div><span className="block text-slate-400">Branch</span>{selected.branchId}</div>
                  <div><span className="block text-slate-400">Requested</span>{selected.requestedByStaffName || selected.requestedByStaffId}</div>
                  <div><span className="block text-slate-400">Completed</span>{selected.completedByStaffId || 'N/A'}</div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-black text-[#1e222b] mb-2">Input Materials</h4>
                <div className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputLines.length === 0 ? (
                        <tr><td colSpan={5} className="p-3 text-center text-slate-500 font-bold">No input lines captured.</td></tr>
                      ) : inputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-2 text-right font-mono">{line.qtyConsumed}</td>
                          <td className="p-2 text-right font-mono">{line.unitCost.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{line.totalCost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] uppercase font-black text-[#1e222b] mb-2">Output Products</h4>
                <div className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputLines.length === 0 ? (
                        <tr><td colSpan={5} className="p-3 text-center text-slate-500 font-bold">No output lines captured.</td></tr>
                      ) : outputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-2 text-right font-mono">{line.qtyProduced}</td>
                          <td className="p-2 text-right font-mono">{line.unitCost.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{line.totalValue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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
            <div className="py-16 text-center uppercase font-black text-slate-500 text-[10px]">
              Select a transformation to view input and output lines.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
