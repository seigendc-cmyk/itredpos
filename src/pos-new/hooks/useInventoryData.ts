import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SharedInventoryBalanceRecord, SharedInventoryMovementRecord } from '../firebase/commerceDataContract';
import type { AdjustStockCommand, InventoryBalanceFilters, InventoryCommandResult, InventoryMovementFilters, PostStocktakeVarianceCommand, ReceiveStockCommand, TransferStockCommand } from '../repositories/InventoryRepository';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import { validateRepositoryOperationContext, type RepositoryOperationContext, type RepositorySubscription } from '../repositories/repositoryContext';

export interface UseInventoryDataOptions {
  context: RepositoryOperationContext;
  balanceFilters?: InventoryBalanceFilters;
  movementFilters?: InventoryMovementFilters;
}

export interface UseInventoryDataReturn {
  balances: SharedInventoryBalanceRecord[];
  movements: SharedInventoryMovementRecord[];
  loading: boolean;
  balancesLoading: boolean;
  movementsLoading: boolean;
  synchronizing: boolean;
  saving: boolean;
  posting: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  receiveStock: (command: ReceiveStockCommand) => Promise<InventoryCommandResult>;
  adjustStock: (command: AdjustStockCommand) => Promise<InventoryCommandResult>;
  transferStock: (command: TransferStockCommand) => Promise<InventoryCommandResult>;
  postStocktakeVariance: (command: PostStocktakeVarianceCommand) => Promise<InventoryCommandResult>;
}

function contextError(context: RepositoryOperationContext): string | null {
  try { validateRepositoryOperationContext(context); return null; }
  catch (error) { return error instanceof Error ? error.message : 'Invalid inventory repository context.'; }
}

export function useInventoryData({ context, balanceFilters, movementFilters }: UseInventoryDataOptions): UseInventoryDataReturn {
  const [balances, setBalances] = useState<SharedInventoryBalanceRecord[]>([]);
  const [movements, setMovements] = useState<SharedInventoryMovementRecord[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [synchronizing, setSynchronizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const subscriptionRef = useRef<RepositorySubscription | null>(null);
  const bundleRef = useRef<RepositoryBundle | null>(null);
  const bundle = useMemo(() => bundleRef.current ||= createRepositoryBundle(), []);
  const operationContext = useMemo<RepositoryOperationContext>(() => ({ ...context }), [context.vendorId, context.branchId, context.warehouseId, context.terminalId, context.staffId, context.actorId, context.actorRole, context.sourceApp, context.correlationId]);
  const stableBalanceFilters = useMemo<InventoryBalanceFilters | undefined>(() => balanceFilters ? { ...balanceFilters } : undefined, [balanceFilters?.productId, balanceFilters?.branchId, balanceFilters?.warehouseId, balanceFilters?.locationId]);
  const stableMovementFilters = useMemo<InventoryMovementFilters | undefined>(() => movementFilters ? { ...movementFilters } : undefined, [movementFilters?.productId, movementFilters?.movementType, movementFilters?.branchId, movementFilters?.warehouseId, movementFilters?.referenceId, movementFilters?.referenceType]);
  const validationMessage = useMemo(() => contextError(operationContext), [operationContext]);

  const matchesBalanceFilters = useCallback((record: SharedInventoryBalanceRecord): boolean => (
    (!stableBalanceFilters?.productId || record.productId === stableBalanceFilters.productId)
    && (!stableBalanceFilters?.branchId || record.branchId === stableBalanceFilters.branchId)
    && (!stableBalanceFilters?.warehouseId || record.warehouseId === stableBalanceFilters.warehouseId)
    && (!stableBalanceFilters?.locationId || record.warehouseId === stableBalanceFilters.locationId || record.branchId === stableBalanceFilters.locationId)
  ), [stableBalanceFilters]);

  const refresh = useCallback(async (): Promise<void> => {
    if (validationMessage) {
      if (mountedRef.current) { setError(validationMessage); setBalancesLoading(false); setMovementsLoading(false); }
      return;
    }
    if (mountedRef.current) { setSynchronizing(true); setBalancesLoading(true); setMovementsLoading(true); setError(null); }
    try {
      const [balanceResult, movementResult] = await Promise.all([
        bundle.inventory.listBalances(operationContext, stableBalanceFilters),
        bundle.inventory.listMovements(operationContext, stableMovementFilters)
      ]);
      if (!mountedRef.current) return;
      if (balanceResult.success) setBalances(balanceResult.records);
      if (movementResult.success) setMovements(movementResult.records);
      if (!balanceResult.success || !movementResult.success) setError(balanceResult.errorMessage || movementResult.errorMessage || 'Inventory synchronization failed.');
    } catch (reason) {
      if (mountedRef.current) setError(reason instanceof Error ? reason.message : 'Inventory synchronization failed.');
    } finally {
      if (mountedRef.current) { setBalancesLoading(false); setMovementsLoading(false); setSynchronizing(false); }
    }
  }, [bundle, operationContext, stableBalanceFilters, stableMovementFilters, validationMessage]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    subscriptionRef.current?.unsubscribe();
    if (!validationMessage) {
      subscriptionRef.current = bundle.inventory.subscribeBalances(operationContext, (records) => {
        if (mountedRef.current) setBalances(records.filter(matchesBalanceFilters));
      });
    }
    return () => {
      mountedRef.current = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [bundle, matchesBalanceFilters, operationContext, refresh, validationMessage]);

  const runPostingOperation = useCallback(async (operation: () => Promise<InventoryCommandResult>): Promise<InventoryCommandResult> => {
    if (validationMessage) return { success: false, errorCode: 'REPOSITORY_FAILED_PRECONDITION', errorMessage: validationMessage };
    if (mountedRef.current) { setSaving(true); setError(null); }
    try {
      const result = await operation();
      if (!result.success) { if (mountedRef.current) setError(result.errorMessage || 'Inventory operation failed.'); }
      else await refresh();
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Inventory operation failed.';
      if (mountedRef.current) setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [refresh, validationMessage]);

  return {
    balances,
    movements,
    loading: balancesLoading || movementsLoading,
    balancesLoading,
    movementsLoading,
    synchronizing,
    saving,
    posting: saving,
    error,
    refresh,
    receiveStock: (command) => runPostingOperation(() => bundle.inventory.receiveStock(operationContext, command)),
    adjustStock: (command) => runPostingOperation(() => bundle.inventory.adjustStock(operationContext, command)),
    transferStock: (command) => runPostingOperation(() => bundle.inventory.transferStock(operationContext, command)),
    postStocktakeVariance: (command) => runPostingOperation(() => bundle.inventory.postStocktakeVariance(operationContext, command))
  };
}
