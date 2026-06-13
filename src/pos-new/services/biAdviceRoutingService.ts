import type { BIAdviceRecord } from '../types';

const ROUTING_KEY = 'itred_pos_bi_advice_routes_v1';
const SEEN_KEY = 'itred_pos_bi_advice_seen_v1';

interface BIAdviceRoute {
  routeId: string;
  adviceId: string;
  staffId?: string;
  role?: string;
  deskKey: string;
  createdAt: string;
}

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function readList<T>(key: string): T[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, value: T[]): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local routing is best-effort.
  }
}

function makeRoute(advice: BIAdviceRecord, deskKey: string, role?: string, staffId?: string): BIAdviceRoute {
  return {
    routeId: `BIROUTE-${advice.adviceId}-${deskKey.replace(/\s+/g, '-')}-${role || staffId || 'desk'}`,
    adviceId: advice.adviceId,
    staffId,
    role,
    deskKey,
    createdAt: new Date().toISOString()
  };
}

function deskRoutesForAdvice(advice: BIAdviceRecord): BIAdviceRoute[] {
  const routes: BIAdviceRoute[] = [];
  if (advice.assignedDesk) routes.push(makeRoute(advice, advice.assignedDesk, advice.assignedToRole, advice.assignedToStaffId));
  if (advice.category === 'Stock Health' || advice.category === 'Inventory Risk') routes.push(makeRoute(advice, 'Stock Desk', 'Stock Controller'));
  if (advice.category === 'Reorder Control') {
    routes.push(makeRoute(advice, 'Manager Desk', 'Manager'));
    routes.push(makeRoute(advice, 'Stock Desk', 'Stock Controller'));
  }
  if (advice.category === 'Shelf Stocktake') routes.push(makeRoute(advice, 'Stock Desk', 'Stock Controller', advice.assignedToStaffId));
  if (advice.category === 'Cash Control') {
    routes.push(makeRoute(advice, 'Cash Control', 'Manager'));
    routes.push(makeRoute(advice, 'Owner Desk', 'Owner'));
  }
  if (advice.category === 'Staff Behaviour') {
    routes.push(makeRoute(advice, 'Owner Desk', 'Owner'));
    routes.push(makeRoute(advice, 'Manager Desk', 'Manager'));
  }
  if (advice.category === 'Delivery Verification') {
    routes.push(makeRoute(advice, 'Delivery Desk', 'Delivery Staff'));
    routes.push(makeRoute(advice, 'Manager Desk', 'Manager'));
  }
  if (advice.riskLevel === 'High' || advice.riskLevel === 'Critical') {
    routes.push(makeRoute(advice, 'Approvals Desk', 'Manager'));
    routes.push(makeRoute(advice, 'BI Desk', 'Manager'));
  }
  return routes;
}

export async function routeBIAdviceToDesk(advice: BIAdviceRecord): Promise<BIAdviceRoute[]> {
  const current = readList<BIAdviceRoute>(ROUTING_KEY);
  const currentIds = new Set(current.map((route) => route.routeId));
  const routes = deskRoutesForAdvice(advice).filter((route) => !currentIds.has(route.routeId));
  saveList(ROUTING_KEY, [...routes, ...current]);
  return routes;
}

export async function getBIAdviceForStaff(staffId: string): Promise<string[]> {
  return readList<BIAdviceRoute>(ROUTING_KEY).filter((route) => route.staffId === staffId).map((route) => route.adviceId);
}

export async function getBIAdviceForRole(role: string): Promise<string[]> {
  return readList<BIAdviceRoute>(ROUTING_KEY).filter((route) => route.role === role).map((route) => route.adviceId);
}

export async function getBIAdviceForDesk(deskKey: string): Promise<string[]> {
  return readList<BIAdviceRoute>(ROUTING_KEY).filter((route) => route.deskKey === deskKey).map((route) => route.adviceId);
}

export async function markAdviceSeenByStaff(adviceId: string, staffId: string): Promise<void> {
  const seen = readList<{ adviceId: string; staffId: string; seenAt: string }>(SEEN_KEY);
  if (seen.some((item) => item.adviceId === adviceId && item.staffId === staffId)) return;
  saveList(SEEN_KEY, [{ adviceId, staffId, seenAt: new Date().toISOString() }, ...seen]);
}

export async function getStaffDeskAdviceSummary(staffId: string, role: string): Promise<{ assigned: number; role: number; unseen: number }> {
  const routes = readList<BIAdviceRoute>(ROUTING_KEY);
  const seen = readList<{ adviceId: string; staffId: string }>(SEEN_KEY);
  const staffAdvice = routes.filter((route) => route.staffId === staffId);
  const roleAdvice = routes.filter((route) => route.role === role);
  const seenIds = new Set(seen.filter((item) => item.staffId === staffId).map((item) => item.adviceId));
  return {
    assigned: staffAdvice.length,
    role: roleAdvice.length,
    unseen: [...staffAdvice, ...roleAdvice].filter((route) => !seenIds.has(route.adviceId)).length
  };
}
