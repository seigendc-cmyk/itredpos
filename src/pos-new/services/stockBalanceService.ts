import {
  InventoryMovement,
  ProductStockBalance,
  ProductStockBalanceSummary,
  StockBalanceStatus
} from '../types/posTypes';
import { mockProductStockBalances } from '../mock/mockPosData';

const STOCK_BALANCE_KEY = 'sci_pos_product_stock_balances';

let memoryBalances: ProductStockBalance[] = [...mockProductStockBalances];

function readBalances(): ProductStockBalance[] {
  try {
    const cached = localStorage.getItem(STOCK_BALANCE_KEY);
    if (!cached) {
      localStorage.setItem(STOCK_BALANCE_KEY, JSON.stringify(mockProductStockBalances));
      memoryBalances = [...mockProductStockBalances];
      return memoryBalances;
    }
    memoryBalances = JSON.parse(cached) as ProductStockBalance[];
    return memoryBalances;
  } catch {
    return memoryBalances;
  }
}

function writeBalances(balances: ProductStockBalance[]): ProductStockBalance[] {
  memoryBalances = balances;
  try {
    localStorage.setItem(STOCK_BALANCE_KEY, JSON.stringify(balances));
  } catch {
    // localStorage may be unavailable in some test contexts.
  }
  return balances;
}

function classifyBalance(balance: ProductStockBalance): StockBalanceStatus {
  if (balance.qtyInTransit > 0 && balance.locationType === 'In Transit') return 'In Transit';
  if (balance.qtyDamaged > 0 && (balance.locationType === 'Damaged Holding' || balance.locationType === 'Damaged Stock')) return 'Damaged';
  if ((balance.qtyReturnHolding || 0) > 0 && balance.locationType === 'Return Holding') return 'Return Holding';
  if ((balance.qtyBlocked || 0) > 0) return 'Blocked';
  if (balance.qtyAvailable <= 0) return 'Out Of Stock';
  if (balance.qtyAvailable <= balance.reorderLevel) return 'Reorder Required';
  return 'Available';
}

type StockBalanceFilter = Partial<Pick<ProductStockBalance, 'productId' | 'branchId' | 'warehouseId' | 'locationType' | 'status'>>;

function applyStockBalanceFilters(balances: ProductStockBalance[], filters: StockBalanceFilter = {}): ProductStockBalance[] {
  return balances.filter((balance) => (
    (!filters.productId || balance.productId === filters.productId) &&
    (!filters.branchId || balance.branchId === filters.branchId) &&
    (!filters.warehouseId || balance.warehouseId === filters.warehouseId) &&
    (!filters.locationType || balance.locationType === filters.locationType) &&
    (!filters.status || balance.status === filters.status)
  ));
}

export function calculateAvailableQty(balance: ProductStockBalance): number {
  return Math.max(
    0,
    balance.qtyOnHand -
      balance.qtyReserved -
      balance.qtyDamaged -
      (balance.qtyReturnHolding || 0) -
      (balance.qtyBlocked || 0)
  );
}

export async function getStockBalances(filters: StockBalanceFilter = {}): Promise<ProductStockBalance[]> {
  return applyStockBalanceFilters(readBalances(), filters)
    .sort((a, b) => `${a.productName}-${a.branchName}-${a.locationName}`.localeCompare(`${b.productName}-${b.branchName}-${b.locationName}`));
}

export async function getProductStockBalances(productId?: string): Promise<ProductStockBalance[]> {
  if (!productId) return getStockBalances();
  return getStockBalances({ productId });
}

export async function getStockBalanceByProduct(productId: string): Promise<ProductStockBalance[]> {
  return getProductStockBalances(productId);
}

export async function getStockBalanceByLocation(branchId: string, warehouseId: string, locationType?: ProductStockBalance['locationType']): Promise<ProductStockBalance[]> {
  return getStockBalances({ branchId, warehouseId, locationType });
}

export async function calculateTotalProductStock(productId: string): Promise<{ onHand: number; available: number; reserved: number; damaged: number; returnHolding: number; inTransit: number; blocked: number }> {
  const balances = readBalances();
  const productBalances = balances.filter((balance) => balance.productId === productId);
  return {
    onHand: productBalances.reduce((sum, balance) => sum + balance.qtyOnHand, 0),
    available: productBalances.reduce((sum, balance) => sum + calculateAvailableQty(balance), 0),
    reserved: productBalances.reduce((sum, balance) => sum + balance.qtyReserved, 0),
    damaged: productBalances.reduce((sum, balance) => sum + balance.qtyDamaged, 0),
    returnHolding: productBalances.reduce((sum, balance) => sum + (balance.qtyReturnHolding || 0), 0),
    inTransit: productBalances.reduce((sum, balance) => sum + balance.qtyInTransit, 0),
    blocked: productBalances.reduce((sum, balance) => sum + (balance.qtyBlocked || 0), 0)
  };
}

export async function getProductTotalAvailableStock(productId: string, branchId?: string): Promise<number> {
  const balances = await getProductStockBalances(productId);
  return balances
    .filter((balance) => !branchId || balance.branchId === branchId)
    .reduce((sum, balance) => sum + Math.max(0, balance.qtyAvailable), 0);
}

export async function getProductStockBalanceSummary(productId?: string): Promise<ProductStockBalanceSummary> {
  const balances = await getProductStockBalances(productId);
  return {
    totalLocations: balances.length,
    totalQtyOnHand: balances.reduce((sum, balance) => sum + balance.qtyOnHand, 0),
    totalQtyAvailable: balances.reduce((sum, balance) => sum + balance.qtyAvailable, 0),
    totalQtyReserved: balances.reduce((sum, balance) => sum + balance.qtyReserved, 0),
    totalQtyDamaged: balances.reduce((sum, balance) => sum + balance.qtyDamaged, 0),
    totalQtyReturnHolding: balances.reduce((sum, balance) => sum + (balance.qtyReturnHolding || 0), 0),
    totalQtyInTransit: balances.reduce((sum, balance) => sum + balance.qtyInTransit, 0),
    totalQtyBlocked: balances.reduce((sum, balance) => sum + (balance.qtyBlocked || 0), 0),
    lowStockLocations: balances.filter((balance) => balance.status === 'Reorder Required').length,
    outOfStockLocations: balances.filter((balance) => balance.status === 'Out Of Stock' || balance.status === 'Out of Stock').length,
    reorderRequiredLocations: balances.filter((balance) => balance.status === 'Reorder Required').length,
    stocktakeReviewLocations: balances.filter((balance) => balance.status === 'Stocktake Review').length
  };
}

function updateMatchingBalance(
  productId: string,
  branchId: string,
  warehouseId: string,
  updater: (balance: ProductStockBalance) => ProductStockBalance | null
): ProductStockBalance | null {
  let updated: ProductStockBalance | null = null;
  const next = readBalances().map((balance) => {
    if (balance.productId !== productId || balance.branchId !== branchId || balance.warehouseId !== warehouseId) return balance;
    const nextBalance = updater(balance);
    if (!nextBalance) return balance;
    updated = {
      ...nextBalance,
      qtyAvailable: calculateAvailableQty(nextBalance),
      status: classifyBalance({ ...nextBalance, qtyAvailable: calculateAvailableQty(nextBalance) }),
      updatedAt: new Date().toISOString()
    };
    return updated;
  });
  writeBalances(next);
  return updated;
}

export async function adjustStockBalancePlaceholder(
  productId: string,
  branchId: string,
  warehouseId: string,
  qtyDelta: number,
  notes: string
): Promise<ProductStockBalance | null> {
  let updated: ProductStockBalance | null = null;
  const next = readBalances().map((balance) => {
    if (balance.productId !== productId || balance.branchId !== branchId || balance.warehouseId !== warehouseId) return balance;
    const qtyOnHand = Math.max(0, balance.qtyOnHand + qtyDelta);
    const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged - (balance.qtyReturnHolding || 0) - (balance.qtyBlocked || 0));
    updated = {
      ...balance,
      qtyOnHand,
      qtyAvailable,
      status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }),
      lastMovementDate: new Date().toISOString(),
      lastMovementAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return updated;
  });
  writeBalances(next);
  void notes;
  return updated;
}

export async function reserveStock(productId: string, branchId: string, warehouseId: string, qty: number, reference: string): Promise<ProductStockBalance | null> {
  void reference;
  return updateMatchingBalance(productId, branchId, warehouseId, (balance) => {
    if (qty <= 0 || calculateAvailableQty(balance) < qty) return null;
    return { ...balance, qtyReserved: balance.qtyReserved + qty, lastMovementAt: new Date().toISOString() };
  });
}

export async function releaseReservedStock(productId: string, branchId: string, warehouseId: string, qty: number, reference: string): Promise<ProductStockBalance | null> {
  void reference;
  return updateMatchingBalance(productId, branchId, warehouseId, (balance) => {
    if (qty <= 0) return null;
    return { ...balance, qtyReserved: Math.max(0, balance.qtyReserved - qty), lastMovementAt: new Date().toISOString() };
  });
}

export async function moveToDamagedHolding(productId: string, branchId: string, warehouseId: string, qty: number, reference: string): Promise<ProductStockBalance | null> {
  void reference;
  return updateMatchingBalance(productId, branchId, warehouseId, (balance) => {
    if (qty <= 0 || calculateAvailableQty(balance) < qty) return null;
    return { ...balance, qtyDamaged: balance.qtyDamaged + qty, lastMovementAt: new Date().toISOString() };
  });
}

export async function moveToReturnHolding(productId: string, branchId: string, warehouseId: string, qty: number, reference: string): Promise<ProductStockBalance | null> {
  void reference;
  return updateMatchingBalance(productId, branchId, warehouseId, (balance) => {
    if (qty <= 0 || calculateAvailableQty(balance) < qty) return null;
    return { ...balance, qtyReturnHolding: (balance.qtyReturnHolding || 0) + qty, lastMovementAt: new Date().toISOString() };
  });
}

export async function updateStockBalanceFromMovement(movement: InventoryMovement): Promise<ProductStockBalance | null> {
  if (movement.status !== 'Posted') return null;
  const qtyDelta = movement.qtyIn - movement.qtyOut;
  const balances = readBalances();
  const matching = balances.find((balance) =>
    balance.productId === movement.productId &&
    (balance.branchId === movement.branchId || balance.branchName === movement.branchId) &&
    (balance.warehouseId === movement.warehouseId || balance.warehouseName === movement.warehouseId)
  ) || balances.find((balance) => balance.productId === movement.productId && balance.locationType === 'Main Warehouse');

  if (!matching) return null;

  const next = balances.map((balance) => {
    if (balance.balanceId !== matching.balanceId) return balance;
    const qtyOnHand = Math.max(0, balance.qtyOnHand + qtyDelta);
    const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged - (balance.qtyReturnHolding || 0) - (balance.qtyBlocked || 0));
    const updated: ProductStockBalance = {
      ...balance,
      qtyOnHand,
      qtyAvailable,
      status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }),
      lastMovementDate: movement.movementDate,
      lastMovementAt: movement.movementDate,
      updatedAt: new Date().toISOString()
    };
    return updated;
  });
  writeBalances(next);
  return next.find((balance) => balance.balanceId === matching.balanceId) || null;
}

export async function transferStockBalancePlaceholder(
  productId: string,
  fromBalanceId: string,
  toBalanceId: string,
  quantity: number
): Promise<{ from: ProductStockBalance | null; to: ProductStockBalance | null; message: string }> {
  const balances = readBalances();
  const fromBalance = balances.find((balance) => balance.balanceId === fromBalanceId && balance.productId === productId);
  const toBalance = balances.find((balance) => balance.balanceId === toBalanceId && balance.productId === productId);
  if (!fromBalance || !toBalance || quantity <= 0 || fromBalance.qtyAvailable < quantity) {
    return { from: fromBalance || null, to: toBalance || null, message: 'Stock transfer placeholder could not be applied.' };
  }

  let nextFrom: ProductStockBalance | null = null;
  let nextTo: ProductStockBalance | null = null;
  const next = balances.map((balance) => {
    if (balance.balanceId === fromBalanceId) {
      const qtyOnHand = Math.max(0, balance.qtyOnHand - quantity);
      const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged - (balance.qtyReturnHolding || 0) - (balance.qtyBlocked || 0));
      nextFrom = { ...balance, qtyOnHand, qtyAvailable, status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }), updatedAt: new Date().toISOString() };
      return nextFrom;
    }
    if (balance.balanceId === toBalanceId) {
      const qtyOnHand = balance.qtyOnHand + quantity;
      const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged - (balance.qtyReturnHolding || 0) - (balance.qtyBlocked || 0));
      nextTo = { ...balance, qtyOnHand, qtyAvailable, status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }), updatedAt: new Date().toISOString() };
      return nextTo;
    }
    return balance;
  });
  writeBalances(next);
  return { from: nextFrom, to: nextTo, message: 'Stock transfer placeholder applied locally.' };
}

export async function exportStockBalancesPlaceholder(productId?: string): Promise<{ message: string; productId?: string }> {
  return { message: 'Stock balance export placeholder prepared locally.', productId };
}

export async function getLowStockBalances(filters: StockBalanceFilter = {}): Promise<ProductStockBalance[]> {
  return getStockBalances(filters).then((balances) => balances.filter((balance) => balance.status === 'Reorder Required'));
}

export async function getOutOfStockBalances(filters: StockBalanceFilter = {}): Promise<ProductStockBalance[]> {
  return getStockBalances(filters).then((balances) => balances.filter((balance) => balance.status === 'Out Of Stock' || balance.status === 'Out of Stock'));
}

export async function getReorderRequiredBalances(filters: StockBalanceFilter = {}): Promise<ProductStockBalance[]> {
  return getLowStockBalances(filters);
}
