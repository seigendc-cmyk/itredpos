import { getActiveVendorId, readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';
import type { BIRule } from './biRuleEngine';
import type { BIWarning } from './biWarningService';
import { updateBIWarning } from './biWarningService';

export type BIActionRouteStatus = 'Assigned' | 'Accepted' | 'InProgress' | 'Escalated' | 'Completed' | 'Unassigned';
export interface BIActiveStaff { staffId: string; vendorId: string; branchId?: string; roles: string[]; active: boolean; permissions?: string[]; }
export interface BIActionRoute { routeId: string; vendorId: string; warningId: string; assignedRole: string; assignedStaffId?: string; assignedAt: string; dueAt: string; escalationRole: string; escalationAt?: string; status: BIActionRouteStatus; history: Array<{ action: string; by: string; at: string; note?: string }>; }
const ROUTES_KEY = 'itred_pos_bi_action_routes_v1';
export function getBIActionRoutes(vendorId = getActiveVendorId()): BIActionRoute[] { return readVendorScopedList<BIActionRoute>(ROUTES_KEY, [], vendorId).filter((row) => row.vendorId === vendorId); }
export function routeBIWarning(warning: BIWarning, rule: BIRule, staff: BIActiveStaff[] = []): BIActionRoute {
  const existing = getBIActionRoutes(warning.vendorId).find((row) => row.warningId === warning.warningId);
  if (existing) return existing;
  const candidate = staff.find((person) => person.active && person.vendorId === warning.vendorId && person.roles.includes(rule.assignedRole) && (!warning.branchId || !person.branchId || person.branchId === warning.branchId) && (!person.permissions || person.permissions.includes('bi.actions.manage')));
  const now = new Date().toISOString();
  const route: BIActionRoute = { routeId: `BIR-${warning.warningId}`, vendorId: warning.vendorId, warningId: warning.warningId, assignedRole: rule.assignedRole, assignedStaffId: candidate?.staffId, assignedAt: now, dueAt: warning.dueAt, escalationRole: rule.escalationRole, status: candidate ? 'Assigned' : 'Unassigned', history: [{ action: candidate ? 'Assigned' : 'UnassignedCriticalVisibleToOwner', by: 'BI', at: now }] };
  writeVendorScopedList(ROUTES_KEY, [route, ...getBIActionRoutes(warning.vendorId)], warning.vendorId);
  updateBIWarning(warning.warningId, { status: candidate ? 'Assigned' : 'Open', assignedStaffId: candidate?.staffId }, warning.vendorId);
  return route;
}
export function reassignBIAction(routeId: string, staff: BIActiveStaff, actorId: string, note: string, vendorId = getActiveVendorId()): BIActionRoute {
  if (!staff.active || staff.vendorId !== vendorId) throw new Error('Actions may only be assigned to active staff in this business.');
  let updated!: BIActionRoute; const rows = getBIActionRoutes(vendorId).map((route) => route.routeId === routeId ? (updated = { ...route, assignedStaffId: staff.staffId, assignedRole: staff.roles[0] || route.assignedRole, assignedAt: new Date().toISOString(), status: 'Assigned', history: [...route.history, { action: 'Reassigned', by: actorId, at: new Date().toISOString(), note }] }) : route);
  if (!updated) throw new Error('Action route not found.'); writeVendorScopedList(ROUTES_KEY, rows, vendorId); updateBIWarning(updated.warningId, { status: 'Assigned', assignedStaffId: staff.staffId, assignedRole: updated.assignedRole }, vendorId); return updated;
}
export function escalateOverdueBIActions(now = new Date(), vendorId = getActiveVendorId()): BIActionRoute[] {
  const changed: BIActionRoute[] = []; const rows = getBIActionRoutes(vendorId).map((route) => {
    if (route.status === 'Completed' || route.status === 'Escalated' || new Date(route.dueAt) >= now) return route;
    const next = { ...route, status: 'Escalated' as const, escalationAt: now.toISOString(), history: [...route.history, { action: 'Escalated', by: 'BI', at: now.toISOString(), note: `Overdue action escalated to ${route.escalationRole}.` }] }; changed.push(next); updateBIWarning(route.warningId, { status: 'Escalated', escalatedAt: now.toISOString(), assignedRole: route.escalationRole }, vendorId); return next;
  }); writeVendorScopedList(ROUTES_KEY, rows, vendorId); return changed;
}
