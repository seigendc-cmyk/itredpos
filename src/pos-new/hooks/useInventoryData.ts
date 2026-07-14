import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SharedInventoryBalanceRecord, SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import type {
  AdjustStockCommand,
  InventoryBalanceFilters,
  InventoryCommandResult,
  InventoryMovementFilters,
  PostStocktakeVarianceCommand,
  ReceiveStockCommand,
  TransferStockCommand
} from '../repositories/InventoryRepository';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';

export interface UseInventoryDataOptions {
  context: RepositoryOperationContext;
  balanceFilters?: InventoryBalanceFilters;
  movementFilters?: InventoryMovementFilters;
}

export interface UseInventoryDataReturn {
  balances: SharedInventoryBalanceRecord[];
  movements: SharedInventoryMovementRecord[];
  loading: boolean;
  synchronizing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  receiveStock: (command: ReceiveStockCommand) => Promise<InventoryCommandResult>;
  adjustStock: (command: AdjustStockCommand) => Promise<InventoryCommandResult>;
  transferStock: (command: TransferStockCommand) => Promise<InventoryCommandResult>;
  postStocktakeVariance: (command: PostStocktakeVarianceCommand) => Promise<InventoryCommandResult>;
}

export function useInventoryData({ context, balanceFilters, movementFilters }: UseInventoryDataOptions): UseInventoryDataReturn {
  const [balances, setBalances] = useState<SharedInventoryBalanceRecord[]>([]);
  const [movements, setMovements] = useState<SharedInventoryMovementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [synchronizing, setSynchronizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bundleRef = useRef<RepositoryBundle | null>(null);
  const subscriptionRef = useRef<RepositorySubscription | null>(null);
  const bundle = useMemo(() => bundleRef.current ||= createRepositoryBundle(), []);

  const matchesBalanceFilters = useCallback((record: SharedInventoryBalanceRecord) => (
    (!balanceFilters?.productId || record.productId === balanceFilters.productId)
    && (!balanceFilters?.branchId || record.branchId === balanceFilters.branchId)
    && (!balanceFilters?.warehouseId || record.warehouseId === balanceFilters.warehouseId)
    && (!balanceFilters?.locationId || record.warehouseId === balanceFilters.locationId || record.branchId === balanceFilters.locationId)
  ), [balanceFilters]);

  const refresh = useCallback(async () => {
    setSynchronizing(true);
    setError(null);
    try {
      const [balanceResult, movementResult] = await Promise.all([
        bundle.inventory.listBalances(context, balanceFilters),
        bundle.inventory.listMovements(context, movementFilters)
      ]);
      if (balanceResult.success) setBalances(balanceResult.records);
      if (movementResult.success) setMovements(movementResult.records);
      const message = balanceResult.errorMessage || movementResult.errorMessage;
      if (!balanceResult.success || !movementResult.success) setError(message || 'Inventory synchronization failed.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Inventory synchronization failed.');
    } finally {
      setLoading(false);
      setSynchronizing(false);
    }
  }, [balanceFilters, bundle, context, movementFilters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refresh();
    subscriptionRef.current?.unsubscribe();
    subscriptionRef.current = bundle.inventory.subscribeBalances(context, (records) => {
      if (active) setBalances(records.filter(matchesBalanceFilters));
    });
    return () => {
      active = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [bundle, context, matchesBalanceFilters, refresh]);

  const run = useCallback(async (operation: () => Promise<InventoryCommandResult>) => {
    setSynchronizing(true);
    setError(null);
    try {
      const result = await operation();
      if (!result.success) setError(result.errorMessage || 'Inventory operation failed.');
      else await refresh();
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Inventory operation failed.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [refresh]);

  return {
    balances,
    movements,
    loading,
    synchronizing,
    error,
    refresh,
    receiveStock: (command) => run(() => bundle.inventory.receiveStock(context, command)),
    adjustStock: (command) => run(() => bundle.inventory.adjustStock(context, command)),
    transferStock: (command) => run(() => bundle.inventory.transferStock(context, command)),
    postStocktakeVariance: (command) => run(() => bundle.inventory.postStocktakeVariance(context, command))
  };
}
