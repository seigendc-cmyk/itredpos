import React from 'react';
import { Recycle } from 'lucide-react';

function POMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <span className="block text-[8.5px] uppercase font-black text-slate-500">{label}</span>
      <strong className="block mt-1 text-[16px] font-black text-[#1e222b]">{value}</strong>
    </div>
  );
}

export default function ProductTransformationPanel() {
  return (
    <div className="industrial-section p-5 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
        <div>
          <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
            <Recycle className="w-4 h-4 text-orange-500" />
            Product Transformation
          </span>
          <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">
            Convert input materials into finished goods. This Build 2K-02 panel is a safe UI component only.
          </p>
        </div>
      </div>

      <div className="border border-orange-300 bg-orange-50 p-4 text-[9.5px] uppercase font-black text-slate-800">
        Product Transformation workspace is being introduced in controlled build stages. No stock movement, audit event, or posting logic is triggered from this panel.
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <POMetric label="Draft Jobs" value="--" />
        <POMetric label="Pending Approval" value="--" />
        <POMetric label="Completed" value="--" />
        <POMetric label="Yield" value="--" />
      </div>
    </div>
  );
}
