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
  if (balance.qtyDamaged > 0 && balance.locationType === 'Damaged Stock') return 'Damaged';
  if (balance.qtyAvailable <= 0) return 'Out of Stock';
  if (balance.qtyAvailable <= balance.reorderLevel) return 'Low Stock';
  return 'Available';
}

export async function getProductStockBalances(productId?: string): Promise<ProductStockBalance[]> {
  const balances = readBalances();
  return (productId ? balances.filter((balance) => balance.productId === productId) : balances)
    .sort((a, b) => `${a.productName}-${a.branchName}-${a.locationName}`.localeCompare(`${b.productName}-${b.branchName}-${b.locationName}`));
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
    totalQtyInTransit: balances.reduce((sum, balance) => sum + balance.qtyInTransit, 0),
    lowStockLocations: balances.filter((balance) => balance.status === 'Low Stock').length,
    outOfStockLocations: balances.filter((balance) => balance.status === 'Out of Stock').length,
    stocktakeReviewLocations: balances.filter((balance) => balance.status === 'Stocktake Review').length
  };
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
    const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged);
    updated = {
      ...balance,
      qtyOnHand,
      qtyAvailable,
      status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }),
      lastMovementDate: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return updated;
  });
  writeBalances(next);
  void notes;
  return updated;
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
    const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged);
    const updated: ProductStockBalance = {
      ...balance,
      qtyOnHand,
      qtyAvailable,
      status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }),
      lastMovementDate: movement.movementDate,
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
      const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged);
      nextFrom = { ...balance, qtyOnHand, qtyAvailable, status: classifyBalance({ ...balance, qtyOnHand, qtyAvailable }), updatedAt: new Date().toISOString() };
      return nextFrom;
    }
    if (balance.balanceId === toBalanceId) {
      const qtyOnHand = balance.qtyOnHand + quantity;
      const qtyAvailable = Math.max(0, qtyOnHand - balance.qtyReserved - balance.qtyDamaged);
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
