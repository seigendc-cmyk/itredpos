import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createRepositoryBundle, type RepositoryBundle } from '../repositories/repositoryFactory';
import type { RepositoryOperationContext, RepositorySubscription } from '../repositories/repositoryContext';
import type { ProductRepository, ProductListFilters } from '../repositories/ProductRepository';
import type { SharedProductRecord } from '../firebase/commerceDataContract';
import { validateRepositoryOperationContext } from '../repositories/repositoryContext';
import { loadProductMaster, searchProductMaster, createProductCommand, updateProductCommand, deactivateProductCommand, type ProductMasterResult } from '../services/productMasterService';

export interface UseProductMasterDataOptions {
  context: RepositoryOperationContext;
}

export interface UseProductMasterDataReturn {
  products: SharedProductRecord[];
  loading: boolean;
  synchronizing: boolean;
  error: string | null;
  filters: ProductListFilters;
  setFilters: (filters: ProductListFilters) => void;
  search: (term: string) => Promise<SharedProductRecord[]>;
  refresh: () => Promise<void>;
  createProduct: (product: Partial<SharedProductRecord>) => Promise<ProductMasterResult<SharedProductRecord>>;
  updateProduct: (productId: string, changes: Partial<SharedProductRecord>) => Promise<ProductMasterResult<SharedProductRecord>>;
  deactivateProduct: (productId: string) => Promise<ProductMasterResult<SharedProductRecord>>;
}

export function useProductMasterData(options: UseProductMasterDataOptions): UseProductMasterDataReturn {
  const { context } = options;
  const [products, setProducts] = useState<SharedProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [synchronizing, setSynchronizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ProductListFilters>({});

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
      const result = await loadProductMaster(operationContext, filters);
      if (!mountedRef.current) return;
      if (result.success) {
        setProducts(result.records);
      }
      if (!result.success && result.errorMessage) {
        setError(result.errorMessage);
      }
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : 'Failed to load product master.');
    } finally {
      if (mountedRef.current) { setSynchronizing(false); setLoading(false); }
    }
  }, [filters, operationContext, validationMessage]);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    setLoading(true);
    setError(null);

    void refresh();

    if (validationMessage) return () => { active = false; mountedRef.current = false; unsubscribeAll(); };
    const productRepo = bundle.products as ProductRepository;
    const subscription = productRepo.subscribeProducts(operationContext, (records) => {
      if (active) setProducts(records);
    });
    subscriptionsRef.current.push(subscription);

    return () => {
      active = false;
      mountedRef.current = false;
      unsubscribeAll();
    };
  }, [bundle, operationContext, refresh, unsubscribeAll, validationMessage]);

  const search = useCallback(async (term: string): Promise<SharedProductRecord[]> => {
    setSynchronizing(true);
    try {
      if (validationMessage) return [];
      const result = await searchProductMaster(operationContext, term, filters);
      if (!result.success && result.errorMessage) {
        setError(result.errorMessage);
      }
      return result.records;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed.';
      setError(message);
      return [];
    } finally {
      setSynchronizing(false);
    }
  }, [filters, operationContext, validationMessage]);

  const createProductHandler = useCallback(async (product: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      if (validationMessage) return { success: false, errorMessage: validationMessage };
      const result = await createProductCommand(operationContext, product);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to create product.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [operationContext, validationMessage]);

  const updateProductHandler = useCallback(async (productId: string, changes: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      if (validationMessage) return { success: false, errorMessage: validationMessage };
      const result = await updateProductCommand(operationContext, productId, changes);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to update product.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [operationContext, validationMessage]);

  const deactivateProductHandler = useCallback(async (productId: string): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      if (validationMessage) return { success: false, errorMessage: validationMessage };
      const result = await deactivateProductCommand(operationContext, productId);
      if (!result.success) {
        setError(result.errorMessage || 'Failed to deactivate product.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to deactivate product.';
      setError(message);
      return { success: false, errorMessage: message };
    } finally {
      setSynchronizing(false);
    }
  }, [operationContext, validationMessage]);

  return {
    products,
    loading,
    synchronizing,
    error,
    filters,
    setFilters,
    search,
    refresh,
    createProduct: createProductHandler,
    updateProduct: updateProductHandler,
    deactivateProduct: deactivateProductHandler
  };
}
