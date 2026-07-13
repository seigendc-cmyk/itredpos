import type { SharedProductRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface ProductRepository {
  getProduct(context: RepositoryOperationContext, productId: string): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }>;
  listProducts(context: RepositoryOperationContext): Promise<{ success: boolean; records: SharedProductRecord[]; errorCode?: string; errorMessage?: string }>;
  createProduct(context: RepositoryOperationContext, product: SharedProductRecord): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }>;
  updateProduct(context: RepositoryOperationContext, productId: string, changes: Partial<SharedProductRecord>): Promise<{ success: boolean; data?: SharedProductRecord; errorCode?: string; errorMessage?: string }>;
  subscribeProducts(context: RepositoryOperationContext, listener: (records: SharedProductRecord[]) => void): RepositorySubscription;
}
