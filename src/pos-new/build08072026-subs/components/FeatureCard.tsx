import type { Key } from 'react';

interface FeatureCardProps {
  key?: Key;
  label: string;
  enabled?: boolean;
}

export default function FeatureCard({ label, enabled = true }: FeatureCardProps) {
  return (
    <div
      className={`flex items-center justify-between gap-2 border px-2 py-1.5 text-[11px] font-semibold ${
        enabled
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-slate-200 bg-slate-50 text-slate-500 line-through opacity-70'
      }`}
    >
      <span>{label}</span>
      <span className="text-[9px] font-black uppercase px-1">{enabled ? 'Included' : 'Locked'}</span>
    </div>
  );
}
