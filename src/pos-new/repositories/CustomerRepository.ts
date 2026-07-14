import type { SharedCustomerAddressRecord, SharedCustomerInteractionRecord, SharedCustomerRecord, SharedCustomerRequestRecord } from '../firebase/commerceDataContract';
import type { RepositoryOperationContext, RepositorySubscription } from './repositoryContext';
import type { RepositoryListResult, RepositoryResult } from './repositoryTypes';

export interface CustomerListFilters { status?: string; customerType?: string; }
export interface CustomerRequestFilters { customerId?: string; status?: string; requestType?: string; }

export interface CustomerRepository {
  getCustomer(context: RepositoryOperationContext, customerId: string): Promise<RepositoryResult<SharedCustomerRecord>>;
  getCustomerByPhone(context: RepositoryOperationContext, phone: string): Promise<RepositoryResult<SharedCustomerRecord>>;
  getCustomerByEmail(context: RepositoryOperationContext, email: string): Promise<RepositoryResult<SharedCustomerRecord>>;
  listCustomers(context: RepositoryOperationContext, filters?: CustomerListFilters): Promise<RepositoryListResult<SharedCustomerRecord>>;
  searchCustomers(context: RepositoryOperationContext, searchTerm: string, filters?: CustomerListFilters): Promise<RepositoryListResult<SharedCustomerRecord>>;
  createCustomer(context: RepositoryOperationContext, customer: SharedCustomerRecord): Promise<RepositoryResult<SharedCustomerRecord>>;
  updateCustomer(context: RepositoryOperationContext, customerId: string, changes: Partial<SharedCustomerRecord>): Promise<RepositoryResult<SharedCustomerRecord>>;
  deactivateCustomer(context: RepositoryOperationContext, customerId: string): Promise<RepositoryResult<SharedCustomerRecord>>;
  listAddresses(context: RepositoryOperationContext, customerId: string): Promise<RepositoryListResult<SharedCustomerAddressRecord>>;
  createAddress(context: RepositoryOperationContext, address: SharedCustomerAddressRecord): Promise<RepositoryResult<SharedCustomerAddressRecord>>;
  updateAddress(context: RepositoryOperationContext, addressId: string, changes: Partial<SharedCustomerAddressRecord>): Promise<RepositoryResult<SharedCustomerAddressRecord>>;
  deactivateAddress(context: RepositoryOperationContext, addressId: string): Promise<RepositoryResult<SharedCustomerAddressRecord>>;
  listInteractions(context: RepositoryOperationContext, customerId: string): Promise<RepositoryListResult<SharedCustomerInteractionRecord>>;
  appendInteraction(context: RepositoryOperationContext, interaction: SharedCustomerInteractionRecord): Promise<RepositoryResult<SharedCustomerInteractionRecord>>;
  listCustomerRequests(context: RepositoryOperationContext, filters?: CustomerRequestFilters): Promise<RepositoryListResult<SharedCustomerRequestRecord>>;
  createCustomerRequest(context: RepositoryOperationContext, request: SharedCustomerRequestRecord): Promise<RepositoryResult<SharedCustomerRequestRecord>>;
  updateCustomerRequest(context: RepositoryOperationContext, requestId: string, changes: Partial<SharedCustomerRequestRecord>): Promise<RepositoryResult<SharedCustomerRequestRecord>>;
  subscribeCustomers(context: RepositoryOperationContext, listener: (records: SharedCustomerRecord[]) => void): RepositorySubscription;
  subscribeCustomerRequests(context: RepositoryOperationContext, listener: (records: SharedCustomerRequestRecord[]) => void): RepositorySubscription;
}
