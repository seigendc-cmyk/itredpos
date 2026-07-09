import React from 'react';
import { Building2, AlertTriangle } from 'lucide-react';
import type { ResolvedVendorSummary } from '../auth/tenantResolutionTypes';

interface VendorTenantSelectorPanelProps {
  vendors: ResolvedVendorSummary[];
  warning?: string;
  onSelect: (vendor: ResolvedVendorSummary) => void;
}

/**
 * Safe tenant selector shown when one Google owner account resolves to more than
 * one vendor. Only vendors returned by the ownerUid query are selectable; manual
 * vendorId entry is never allowed.
 */
export default function VendorTenantSelectorPanel({ vendors, warning, onSelect }: VendorTenantSelectorPanelProps) {
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-orange-500" />
          SELECT BUSINESS TENANT
        </span>
        <span className="text-[9px] text-orange-400 uppercase bg-slate-950 px-1 border border-slate-900">
          DEV / ADMIN
        </span>
      </div>

      <p className="text-[10px] text-slate-400 uppercase leading-relaxed">
        This Google account owns or manages more than one vendor. Select the business tenant you want to use for this POS session.
      </p>

      {warning && (
        <div className="p-3 bg-slate-950 border border-amber-500/40 text-amber-400 font-mono text-[10px] uppercase flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{warning}</span>
        </div>
      )}

      {vendors.length === 0 ? (
        <div className="p-3 bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[10px] uppercase">
          No vendors available to select.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {vendors.map((vendor) => {
            const location = [vendor.city, vendor.suburb].filter(Boolean).join(', ');
            return (
              <div
                key={vendor.vendorId}
                className="bg-slate-950 border border-slate-800 p-3 flex flex-col gap-2"
              >
                <div className="text-white font-bold text-[12px] uppercase tracking-wide break-words">
                  {vendor.vendorName}
                </div>
                <div className="text-[9px] text-slate-500 uppercase font-mono break-words">
                  ID: {vendor.vendorId}
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                  <Field label="Status" value={vendor.accountStatus || vendor.verificationStatus || '—'} />
                  <Field label="Plan" value={vendor.planCode || '—'} />
                  <Field label="Location" value={location || '—'} />
                </div>
                <button
                  type="button"
                  onClick={() => onSelect(vendor)}
                  className="mt-1 bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 text-[10px] font-black uppercase"
                >
                  Select
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] text-slate-500 uppercase">{label}</span>
      <span className="text-slate-200 break-words">{value}</span>
    </div>
  );
}
