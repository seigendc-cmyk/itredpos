import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import { getBIWarnings, updateBIWarning } from './biWarningService';
export type BIResolutionType = 'ActionCompleted' | 'ApprovedRisk' | 'FalsePositive' | 'CustomerResolved' | 'SupplierResolved' | 'CashExplained' | 'StockCorrected' | 'DeliveryResolved' | 'Deferred' | 'Dismissed';
export interface BIResolution { resolutionId: string; vendorId: string; warningId: string; resolutionType: BIResolutionType; resolutionNote: string; evidence: string[]; resolvedBy: string; resolvedAt: string; outcome: string; followUpDate?: string; }
const KEY = 'itred_pos_bi_resolutions_v1';
export function getBIResolutions(warningId?: string, vendorId = getActiveVendorId()): BIResolution[] { return readVendorScopedList<BIResolution>(KEY, [], vendorId).filter((row) => row.vendorId === vendorId && (!warningId || row.warningId === warningId)); }
export function resolveBIWarning(input: Omit<BIResolution, 'resolutionId' | 'vendorId' | 'resolvedAt'> & { vendorId?: string }): BIResolution {
  const vendorId = input.vendorId || getActiveVendorId(); const warning = getBIWarnings(vendorId).find((row) => row.warningId === input.warningId); if (!warning) throw new Error('Warning not found.');
  if ((warning.severity === 'High' || warning.severity === 'Critical') && input.resolutionNote.trim().length < 10) throw new Error('High and critical warnings require a meaningful resolution note.');
  const now = new Date().toISOString(); const resolution: BIResolution = { ...input, vendorId, resolutionId: `BIRE-${input.warningId}-${Date.now()}`, resolvedAt: now };
  writeVendorScopedList(KEY, [...getBIResolutions(undefined, vendorId), resolution], vendorId); updateBIWarning(warning.warningId, { status: input.resolutionType === 'Dismissed' ? 'Dismissed' : 'Resolved', resolvedAt: now, resolutionNote: input.resolutionNote }, vendorId); return resolution;
}
export function reopenBIWarning(warningId: string, actorId: string, note: string, vendorId = getActiveVendorId()) { if (note.trim().length < 5) throw new Error('A reopening reason is required.'); return updateBIWarning(warningId, { status: 'Reopened', resolvedAt: undefined, resolutionNote: `Reopened by ${actorId}: ${note}` }, vendorId); }
