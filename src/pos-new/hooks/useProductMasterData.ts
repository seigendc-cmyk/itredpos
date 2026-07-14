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

  try {
    validateRepositoryOperationContext(context);
  } catch {
    return {
      products: [],
      loading: false,
      synchronizing: false,
      error: 'Invalid repository operation context.',
      filters: {},
      setFilters: () => {},
      search: async () => [],
      refresh: async () => {},
      createProduct: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      updateProduct: async () => ({ success: false, errorMessage: 'Invalid context.' }),
      deactivateProduct: async () => ({ success: false, errorMessage: 'Invalid context.' })
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
      const result = await loadProductMaster(context, filters);
      if (result.success) {
        setProducts(result.records);
      }
      if (!result.success && result.errorMessage) {
        setError(result.errorMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product master.');
    } finally {
      setSynchronizing(false);
      setLoading(false);
    }
  }, [context, filters]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void refresh();

    const productRepo = bundle.products as ProductRepository;
    const subscription = productRepo.subscribeProducts(context, (records) => {
      if (active) setProducts(records);
    });
    subscriptionsRef.current.push(subscription);

    return () => {
      active = false;
      unsubscribeAll();
    };
  }, [bundle, context, refresh, unsubscribeAll]);

  const search = useCallback(async (term: string): Promise<SharedProductRecord[]> => {
    setSynchronizing(true);
    try {
      const result = await searchProductMaster(context, term, filters);
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
  }, [context, filters]);

  const createProductHandler = useCallback(async (product: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      const result = await createProductCommand(context, product);
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
  }, [context]);

  const updateProductHandler = useCallback(async (productId: string, changes: Partial<SharedProductRecord>): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      const result = await updateProductCommand(context, productId, changes);
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
  }, [context]);

  const deactivateProductHandler = useCallback(async (productId: string): Promise<ProductMasterResult<SharedProductRecord>> => {
    setSynchronizing(true);
    try {
      const result = await deactivateProductCommand(context, productId);
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
  }, [context]);

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
