import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Recycle, RotateCcw, X } from 'lucide-react';
import { ProductTransformation } from '../types';
import { createTransformationDraft, getTransformations } from '../services/productTransformationService';

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
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');

  const refresh = async () => {
    const rows = await getTransformations({});
    setRecords(rows);
    setNotice(`Loaded ${rows.length} transformation record(s).`);
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
            Convert input materials into finished goods. Build 2K-04 creates draft records only.
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
        Draft creation only. No stock movement, audit event, or posting logic is triggered from this screen.
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

      <div className="procurement-table-scroll pos-custom-scroll">
        <table className="procurement-table">
          <thead>
            <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
              <th className="py-2 px-3">Transformation No.</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Branch</th>
              <th className="py-2 px-3">Requested By</th>
              <th className="py-2 px-3">Approved By</th>
              <th className="py-2 px-3">Completed By</th>
              <th className="py-2 px-3 text-center">Status</th>
              <th className="py-2 px-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center uppercase font-bold text-slate-500">
                  No product transformations found.
                </td>
              </tr>
            ) : records.map((record) => (
              <tr key={record.transformationId} className="hover:bg-slate-50 transition-colors h-11">
                <td className="py-2 px-3 font-black text-orange-700">{record.transformationNumber}</td>
                <td className="py-2 px-3 font-mono text-slate-600">{record.transformationDate}</td>
                <td className="py-2 px-3 uppercase">{record.branchId}</td>
                <td className="py-2 px-3 uppercase">{record.requestedByStaffName || record.requestedByStaffId}</td>
                <td className="py-2 px-3 uppercase">{record.approvedByStaffId || 'N/A'}</td>
                <td className="py-2 px-3 uppercase">{record.completedByStaffId || 'N/A'}</td>
                <td className="py-2 px-3 text-center whitespace-nowrap">
                  <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(record.status)}`}>
                    {record.status}
                  </span>
                </td>
                <td className="py-2 px-3 uppercase">{record.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
