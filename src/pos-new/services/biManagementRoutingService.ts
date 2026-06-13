import type { BIManagementAdvice, BIManagementDesk, BIDomain } from '../types';

const ROUTE_KEY = 'itred_pos_bi_management_routes_v1';

interface BIManagementRoute {
  routeId: string;
  adviceId: string;
  domain: BIDomain;
  desk: BIManagementDesk;
  role: string;
  staffId?: string;
  createdAt: string;
}

function readRoutes(): BIManagementRoute[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as BIManagementRoute[] : [];
  } catch {
    return [];
  }
}

function saveRoutes(routes: BIManagementRoute[]): BIManagementRoute[] {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(ROUTE_KEY, JSON.stringify(routes));
  } catch {
    return routes;
  }
  return routes;
}

function routeId(advice: BIManagementAdvice, desk: BIManagementDesk, role: string): string {
  return `BIMROUTE-${advice.adviceId}-${desk}-${role}`.replace(/[^A-Z0-9-]/gi, '-');
}

function route(advice: BIManagementAdvice, desk: BIManagementDesk, role: string, staffId?: string): BIManagementRoute {
  return {
    routeId: routeId(advice, desk, role),
    adviceId: advice.adviceId,
    domain: advice.domain,
    desk,
    role,
    staffId,
    createdAt: new Date().toISOString()
  };
}

function domainRoutes(advice: BIManagementAdvice): BIManagementRoute[] {
  const routes = [route(advice, advice.assignedDesk, advice.assignedRole, advice.assignedStaffId)];
  if (advice.domain === 'Sales Integrity') routes.push(route(advice, 'Manager Desk', 'Manager'), route(advice, 'Owner Desk', 'Owner'), route(advice, 'BI Desk', 'Manager'));
  if (advice.domain === 'Stock Integrity') routes.push(route(advice, 'Stock Controller Desk', 'Stock Controller'), route(advice, 'Inventory', 'Stock Controller'), route(advice, 'Manager Desk', 'Manager'));
  if (advice.domain === 'Cash Control') routes.push(route(advice, 'Cash Control', 'Manager'), route(advice, 'Owner Desk', 'Owner'));
  if (advice.domain === 'Staff Behaviour') routes.push(route(advice, 'Manager Desk', 'Manager'), route(advice, 'Owner Desk', 'Owner'));
  if (advice.domain === 'Shift / EOD Control') routes.push(route(advice, 'Shift Control', 'Supervisor'), route(advice, 'Cash Control', 'Manager'), route(advice, 'Manager Desk', 'Manager'));
  if (advice.domain === 'Delivery Fulfilment') routes.push(route(advice, 'Delivery Desk', 'Delivery Staff'), route(advice, 'Manager Desk', 'Manager'));
  if (advice.domain === 'Customer and Credit Risk') routes.push(route(advice, 'Customer Centre', 'Manager'), route(advice, 'Approvals', 'Manager'), route(advice, 'Manager Desk', 'Manager'));
  if (advice.domain === 'Tax / VAT Readiness') routes.push(route(advice, 'Accounting / Finance', 'Manager'), route(advice, 'Owner Desk', 'Owner'));
  if (advice.domain === 'Offline Sync Risk') routes.push(route(advice, 'Sync Desk', 'Manager'), route(advice, 'Owner Desk', 'Owner'));
  return routes;
}

export async function routeBIManagementAdvice(advice: BIManagementAdvice): Promise<BIManagementRoute[]> {
  const current = readRoutes();
  const currentIds = new Set(current.map((item) => item.routeId));
  const fresh = domainRoutes(advice).filter((item) => !currentIds.has(item.routeId));
  saveRoutes([...fresh, ...current]);
  return fresh;
}

export async function getBIManagementRoutesForDesk(desk: BIManagementDesk): Promise<string[]> {
  return readRoutes().filter((routeRow) => routeRow.desk === desk).map((routeRow) => routeRow.adviceId);
}

export async function getBIManagementRoutesForRole(role: string): Promise<string[]> {
  return readRoutes().filter((routeRow) => routeRow.role === role).map((routeRow) => routeRow.adviceId);
}
