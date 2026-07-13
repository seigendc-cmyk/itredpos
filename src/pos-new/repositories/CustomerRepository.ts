import type { SharedCustomerRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';

export interface CustomerRepository {
  getCustomer(context: RepositoryOperationContext, customerId: string): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }>;
  listCustomers(context: RepositoryOperationContext): Promise<{ success: boolean; records: SharedCustomerRecord[]; errorCode?: string; errorMessage?: string }>;
  createCustomer(context: RepositoryOperationContext, customer: SharedCustomerRecord): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }>;
  updateCustomer(context: RepositoryOperationContext, customerId: string, changes: Partial<SharedCustomerRecord>): Promise<{ success: boolean; data?: SharedCustomerRecord; errorCode?: string; errorMessage?: string }>;
  subscribeCustomers(context: RepositoryOperationContext, listener: (records: SharedCustomerRecord[]) => void): RepositorySubscription;
}
