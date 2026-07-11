import type { BIWarning } from './biWarningService';
export type BusinessRiskDomain = 'Cash' | 'Inventory' | 'Customer Credit' | 'Supplier Pressure' | 'Delivery' | 'Staff Activity' | 'Synchronization' | 'Compliance';
export interface BusinessRiskScore { vendorId: string; branchId?: string; riskDomain: BusinessRiskDomain; score: number; level: 'Low' | 'Moderate' | 'High' | 'Critical'; mainDrivers: string[]; recommendedActions: string[]; calculatedAt: string; }
const weights = { Info: 0, Low: 1, Medium: 2, High: 4, Critical: 7 } as const;
export function calculateBusinessRiskScore(vendorId: string, riskDomain: BusinessRiskDomain, warnings: BIWarning[], branchId?: string): BusinessRiskScore {
  const relevant = warnings.filter((w) => w.vendorId === vendorId && (!branchId || w.branchId === branchId) && w.status !== 'Resolved' && w.status !== 'Dismissed' && domainOf(w.category) === riskDomain);
  const raw = relevant.reduce((sum, warning) => sum + weights[warning.severity], 0); const score = Math.min(100, Math.round(raw * 5));
  const level = score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Moderate' : 'Low';
  return { vendorId, branchId, riskDomain, score, level, mainDrivers: relevant.sort((a,b) => weights[b.severity] - weights[a.severity]).slice(0,3).map((w) => w.summary), recommendedActions: [...new Set(relevant.flatMap((w) => w.recommendedActions))].slice(0,3), calculatedAt: new Date().toISOString() };
}
function domainOf(category: string): BusinessRiskDomain { const value = category.toLowerCase(); if (value.includes('cash')) return 'Cash'; if (value.includes('stock') || value.includes('inventory')) return 'Inventory'; if (value.includes('customer') || value.includes('credit')) return 'Customer Credit'; if (value.includes('supplier') || value.includes('purchase')) return 'Supplier Pressure'; if (value.includes('delivery')) return 'Delivery'; if (value.includes('staff')) return 'Staff Activity'; if (value.includes('sync')) return 'Synchronization'; return 'Compliance'; }
