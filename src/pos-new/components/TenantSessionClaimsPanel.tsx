import type { TenantSessionClaims } from '../auth/tenantResolutionTypes';

export default function TenantSessionClaimsPanel({ claims }: { claims: TenantSessionClaims }) {
  return (
    <div className="border border-[#b1b5c2] bg-slate-50 p-3 space-y-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-[9px] text-slate-500 uppercase font-black">Session Claims</div>
          <p className="text-[10px] font-bold uppercase text-slate-700">Local build-development claims only. Production custom claims are not active.</p>
        </div>
        <Badge value={claims.posAccessStatus} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
        <Metric label="Mode" value={claims.mode} />
        <Metric label="Email" value={claims.signedInEmail || '-'} />
        <Metric label="Vendor" value={claims.vendorName} />
        <Metric label="Membership" value={claims.membershipId || '-'} />
        <Metric label="Role" value={claims.membershipRole || '-'} />
        <Metric label="Staff" value={claims.staffName || '-'} />
        <Metric label="Branch" value={claims.branchName || '-'} />
        <Metric label="Terminal" value={claims.terminalName || '-'} />
        <Metric label="Permissions" value={String(claims.permissions.length)} />
        <Metric label="Updated" value={claims.updatedAt.replace('T', ' ').slice(0, 16)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d6d9e0] bg-white p-2 min-h-14"><span className="block text-[8px] uppercase font-black text-slate-500">{label}</span><strong className="block text-[10px] uppercase text-[#1e222b] break-words">{value}</strong></div>;
}

function Badge({ value }: { value: string }) {
  return <span className="px-2 py-1 border text-[9px] font-black uppercase whitespace-nowrap bg-emerald-50 border-emerald-400 text-emerald-800">{value}</span>;
}
