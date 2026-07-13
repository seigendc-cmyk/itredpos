import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';
import type { VendorRepository } from '../repositories/VendorRepository';
import type { SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord, SharedVendorAppAccessRecord } from '../firebase/commerceDataContract';
import { validateRepositoryOperationContext } from '../repositories/repositoryContext';
import { loadVendorLocationContext, createBranchCommand, updateBranchCommand, createWarehouseCommand, updateWarehouseCommand, createTerminalCommand, updateTerminalCommand } from '../services/vendorLocationService';

export interface UseVendorLocationDataOptions {
  context: RepositoryOperationContext;
}

export interface UseVendorLocationDataReturn {
  vendor: SharedVendorRecord | null;
  branches: SharedBranchRecord[];
  warehouses: SharedWarehouseRecord[];
  terminals: SharedTerminalRecord[];
  appAccess: SharedVendorAppAccessRecord[];
  loading: boolean;
  synchronizing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createBranch: (branch: SharedBranchRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateBranch: (branchId: string, changes: Partial<SharedBranchRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  createWarehouse: (warehouse: SharedWarehouseRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateWarehouse: (warehouseId: string, changes: Partial<SharedWarehouseRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  createTerminal: (terminal: SharedTerminalRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateTerminal: (branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
}

export function useVendorLocationData(options: UseVendorLocationDataOptions): UseVendorLocationDataReturn {
  const { context } = options;
  const [vendor, setVendor] = useState<SharedVendorRecord | null>(null);
  const [branches, setBranches] = useState<SharedBranchRecord[]>([]);
  const [warehouses, setWarehouses] = useState<SharedWarehouseRecord[]>([]);
  const [terminals, setTerminals] = useState<SharedTerminalRecord[]>([]);
  const [appAccess, setAppAccess] = useState<SharedVendorAppAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [synchronizing, setSynchronizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundleRef = useRef<RepositoryBundle | null>(null);
  const subscriptionsRef = useRef<RepositorySubscription[]>([]);

  try {
    validateRepositoryOperationContext(context);
  } catch {
    return {
      vendor: null,
      branches: [],
      warehouses: [],
      terminals: [],
      appAccess: [],
      loading: false,
      synchronizing: false,
      error: 'Invalid repository operation context.',
      refresh: async () => {},
      createBranch: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      updateBranch: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      createWarehouse: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      updateWarehouse: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      createTerminal: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      updateTerminal: async () => ({ success: false, errorMessage: 'Invalid context.' })
    };
  }

  const bundle = useMemo(() => {
    if (!bundleRef.current) {
      bundleRef.current = createRepositoryBundle();
    }
    return bundleRef.current;
  }, []);

  const unsubscribeAll = useCallback(() => {
    subscriptionsRef.current.forEach((subscription) => subscription.unsubscribe());
    subscriptionsRef.current = [];
  }, []);

  const refresh = useCallback(async () => {
    setSynchronizing(true);
    setError(null);
    try {
      const result = await loadVendorLocationContext(context);
      if (result.vendor.success && result.vendor.data) {
        setVendor(result.vendor.data);
      }
      if (result.branches.success) {
        setBranches(result.branches.records);
      }
      if (result.warehouses.success) {
        setWarehouses(result.warehouses.records);
      }
      if (result.terminals.success) {
        setTerminals(result.terminals.records);
      }
      if (result.appAccess.success) {
        setAppAccess(result.appAccess.records);
      }
      const firstError = [result.vendor, result.branches, result.warehouses, result.terminals, result.appAccess].find((r) => !r.success);
      if (firstError && (firstError.errorCode || firstError.errorMessage)) {
        setError(firstError.errorMessage || 'Failed to load vendor location data.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor location data.');
    } finally {
      setSynchronizing(false);
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void refresh();

    const vendorRepo = bundle.vendors as VendorRepository;

    const sub1 = vendorRepo.subscribeBranches(context, (records) => {
      if (active) setBranches(records);
    });
    subscriptionsRef.current.push(sub1);

    const sub2 = vendorRepo.subscribeWarehouses(context, (records) => {
      if (active) setWarehouses(records);
    });
    subscriptionsRef.current.push(sub2);

    const sub3 = vendorRepo.subscribeTerminals(context, (records) => {
      if (active) setTerminals(records);
    });
    subscriptionsRef.current.push(sub3);

    const sub4 = vendorRepo.subscribeVendorAppAccess(context, (records) => {
      if (active) setAppAccess(records);
    });
    subscriptionsRef.current.push(sub4);

    return () => {
      active = false;
      unsubscribeAll();
    };
  }, [bundle, context, refresh, unsubscribeAll]);

  const createBranchHandler = useCallback(async (branch: SharedBranchRecord) => {
    setSynchronizing(true);
    try {
      const result = await createBranchCommand(context, branch);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create branch.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create branch.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  const updateBranchHandler = useCallback(async (branchId: string, changes: Partial<SharedBranchRecord>) => {
    setSynchronizing(true);
    try {
      const result = await updateBranchCommand(context, branchId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update branch.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update branch.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  const createWarehouseHandler = useCallback(async (warehouse: SharedWarehouseRecord) => {
    setSynchronizing(true);
    try {
      const result = await createWarehouseCommand(context, warehouse);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create warehouse.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create warehouse.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  const updateWarehouseHandler = useCallback(async (warehouseId: string, changes: Partial<SharedWarehouseRecord>) => {
    setSynchronizing(true);
    try {
      const result = await updateWarehouseCommand(context, warehouseId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update warehouse.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update warehouse.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  const createTerminalHandler = useCallback(async (terminal: SharedTerminalRecord) => {
    setSynchronizing(true);
    try {
      const result = await createTerminalCommand(context, terminal);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create terminal.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create terminal.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  const updateTerminalHandler = useCallback(async (branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>) => {
    setSynchronizing(true);
    try {
      const result = await updateTerminalCommand(context, branchId, terminalId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update terminal.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update terminal.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [context]);

  return {
    vendor,
    branches,
    warehouses,
    terminals,
    appAccess,
    loading,
    synchronizing,
    error,
    refresh,
    createBranch: createBranchHandler,
    updateBranch: updateBranchHandler,
    createWarehouse: createWarehouseHandler,
    updateWarehouse: updateWarehouseHandler,
    createTerminal: createTerminalHandler,
    updateTerminal: updateTerminalHandler
  };
}
