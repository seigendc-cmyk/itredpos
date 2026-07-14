import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';
import type { VendorRepository } from '../repositories/VendorRepository';
import type { SharedVendorRecord, SharedBranchRecord, SharedWarehouseRecord, SharedTerminalRecord, SharedVendorAppAccessRecord } from '../firebase/commerceDataContract';
import { validateRepositoryOperationContext } from '../repositories/repositoryContext';
import { loadVendorLocationContext, updateVendorCommand, createBranchCommand, updateBranchCommand, deactivateBranchCommand, createWarehouseCommand, updateWarehouseCommand, deactivateWarehouseCommand, createTerminalCommand, updateTerminalCommand, deactivateTerminalCommand, updateVendorAppAccessCommand } from '../services/vendorLocationService';

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
  saving: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateVendor: (changes: Partial<SharedVendorRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  createBranch: (branch: SharedBranchRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateBranch: (branchId: string, changes: Partial<SharedBranchRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  deactivateBranch: (branchId: string) => Promise<{ success: boolean; errorMessage?: string }>;
  createWarehouse: (warehouse: SharedWarehouseRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateWarehouse: (warehouseId: string, changes: Partial<SharedWarehouseRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  deactivateWarehouse: (warehouseId: string) => Promise<{ success: boolean; errorMessage?: string }>;
  createTerminal: (terminal: SharedTerminalRecord) => Promise<{ success: boolean; errorMessage?: string }>;
  updateTerminal: (branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
  deactivateTerminal: (branchId: string, terminalId: string) => Promise<{ success: boolean; errorMessage?: string }>;
  updateAppAccess: (appCode: string, changes: Partial<SharedVendorAppAccessRecord>) => Promise<{ success: boolean; errorMessage?: string }>;
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundleRef = useRef<RepositoryBundle | null>(null);
  const subscriptionsRef = useRef<RepositorySubscription[]>([]);
  const mountedRef = useRef(false);
  const operationContext = useMemo<RepositoryOperationContext>(() => ({ ...context }), [context.vendorId, context.branchId, context.warehouseId, context.terminalId, context.staffId, context.actorId, context.actorRole, context.sourceApp, context.correlationId]);
  const validationMessage = useMemo(() => {
    try { validateRepositoryOperationContext(operationContext); return null; }
    catch (reason) { return reason instanceof Error ? reason.message : 'Invalid repository operation context.'; }
  }, [operationContext]);

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
    if (validationMessage) {
      if (mountedRef.current) { setError(validationMessage); setLoading(false); }
      return;
    }
    if (mountedRef.current) { setSynchronizing(true); setError(null); }
    try {
      const result = await loadVendorLocationContext(operationContext);
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load vendor location data.');
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setLoading(false); }
    }
  }, [operationContext, validationMessage]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    void refresh();

    if (validationMessage) return () => { active = false; mountedRef.current = false; unsubscribeAll(); };
    const vendorRepo = bundle.vendors as VendorRepository;

    const sub1 = vendorRepo.subscribeBranches(operationContext, (records) => {
      if (active) setBranches(records);
    });
    subscriptionsRef.current.push(sub1);

    const sub2 = vendorRepo.subscribeWarehouses(operationContext, (records) => {
      if (active) setWarehouses(records);
    });
    subscriptionsRef.current.push(sub2);

    const sub3 = vendorRepo.subscribeTerminals(operationContext, (records) => {
      if (active) setTerminals(records);
    });
    subscriptionsRef.current.push(sub3);

    const sub4 = vendorRepo.subscribeVendorAppAccess(operationContext, (records) => {
      if (active) setAppAccess(records);
    });
    subscriptionsRef.current.push(sub4);

    return () => {
      active = false;
      mountedRef.current = false;
      unsubscribeAll();
    };
  }, [bundle, operationContext, refresh, unsubscribeAll, validationMessage]);

  const createBranchHandler = useCallback(async (branch: SharedBranchRecord) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await createBranchCommand(operationContext, branch);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create branch.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create branch.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const updateBranchHandler = useCallback(async (branchId: string, changes: Partial<SharedBranchRecord>) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await updateBranchCommand(operationContext, branchId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update branch.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update branch.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const createWarehouseHandler = useCallback(async (warehouse: SharedWarehouseRecord) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await createWarehouseCommand(operationContext, warehouse);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create warehouse.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create warehouse.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const updateWarehouseHandler = useCallback(async (warehouseId: string, changes: Partial<SharedWarehouseRecord>) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await updateWarehouseCommand(operationContext, warehouseId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update warehouse.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update warehouse.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const createTerminalHandler = useCallback(async (terminal: SharedTerminalRecord) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await createTerminalCommand(operationContext, terminal);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create terminal.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create terminal.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const updateTerminalHandler = useCallback(async (branchId: string, terminalId: string, changes: Partial<SharedTerminalRecord>) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSynchronizing(true); setSaving(true); setError(null); }
    try {
      const result = await updateTerminalCommand(operationContext, branchId, terminalId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update terminal.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update terminal.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setSaving(false); }
    }
  }, [operationContext, validationMessage]);

  const runMutation = useCallback(async (operation: () => Promise<{ success: boolean; errorMessage?: string }>) => {
    if (validationMessage) return { success: false, errorMessage: validationMessage };
    if (mountedRef.current) { setSaving(true); setError(null); }
    try {
      const result = await operation();
      if (!result.success && mountedRef.current) setError(result.errorMessage || 'Vendor location operation failed.');
      if (result.success) await refresh();
      return result;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Vendor location operation failed.';
      if (mountedRef.current) setError(message);
      return { success: false, errorMessage: message };
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [refresh, validationMessage]);

  return {
    vendor,
    branches,
    warehouses,
    terminals,
    appAccess,
    loading,
    synchronizing,
    saving,
    error,
    refresh,
    updateVendor: (changes) => runMutation(() => updateVendorCommand(operationContext, changes)),
    createBranch: createBranchHandler,
    updateBranch: updateBranchHandler,
    deactivateBranch: (branchId) => runMutation(() => deactivateBranchCommand(operationContext, branchId)),
    createWarehouse: createWarehouseHandler,
    updateWarehouse: updateWarehouseHandler,
    deactivateWarehouse: (warehouseId) => runMutation(() => deactivateWarehouseCommand(operationContext, warehouseId)),
    createTerminal: createTerminalHandler,
    updateTerminal: updateTerminalHandler
    , deactivateTerminal: (branchId, terminalId) => runMutation(() => deactivateTerminalCommand(operationContext, branchId, terminalId))
    , updateAppAccess: (appCode, changes) => runMutation(() => updateVendorAppAccessCommand(operationContext, appCode, changes))
  };
}
