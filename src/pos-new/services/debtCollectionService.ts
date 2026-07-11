import { assertCanonicalCustomerContext, type CanonicalCustomerContext } from './customerContextService';
import type { PosSession } from '../types';
import { readVendorScopedList, writeVendorScopedList } from '../utils/vendorDataMode';

export const CUSTOMER_COLLECTION_ACTIONS_COLLECTION = 'customer_collection_actions';
export const CUSTOMER_PROMISES_COLLECTION = 'customer_promises';

export type CollectionActionType =
  | 'PHONE_CALL'
  | 'WHATSAPP'
  | 'EMAIL'
  | 'VISIT'
  | 'REMINDER'
  | 'PROMISE_TO_PAY'
  | 'DISPUTE'
  | 'ESCALATION'
  | 'CREDIT_BLOCK'
  | 'WRITE_OFF_REVIEW';

export type PromiseToPayCanonicalStatus = 'Active' | 'PartiallyFulfilled' | 'Fulfilled' | 'Broken' | 'Cancelled';

export interface CustomerCollectionAction {
  collectionActionId: string;
  vendorId: string;
  customerId: string;
  actionType: CollectionActionType;
  actionDate: string;
  staffId: string;
  channel: string;
  outcome: string;
  promiseAmount?: number;
  promiseDate?: string;
  nextFollowUpDate?: string;
  notes: string;
  status: 'Open' | 'Completed' | 'Escalated' | 'Cancelled';
}

export interface CustomerPromiseToPay {
  promiseId: string;
  vendorId: string;
  customerId: string;
  promisedAmount: number;
  promiseDate: string;
  recordedBy: string;
  recordedAt: string;
  status: PromiseToPayCanonicalStatus;
  fulfilledAmount: number;
  fulfilledAt?: string;
  notes: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanId(value: string): string {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
}

function roundMoney(value: number): number {
  return Number((Math.round((Number(value) + Number.EPSILON) * 100) / 100).toFixed(2));
}

function readActions(vendorId: string): CustomerCollectionAction[] {
  return readVendorScopedList<CustomerCollectionAction>(CUSTOMER_COLLECTION_ACTIONS_COLLECTION, [], vendorId);
}

function readPromises(vendorId: string): CustomerPromiseToPay[] {
  return readVendorScopedList<CustomerPromiseToPay>(CUSTOMER_PROMISES_COLLECTION, [], vendorId);
}

export function getCustomerCollectionActions(vendorId: string, customerId?: string): CustomerCollectionAction[] {
  return readActions(vendorId).filter((row) => !customerId || row.customerId === customerId);
}

export function getCustomerPromises(vendorId: string, customerId?: string): CustomerPromiseToPay[] {
  return readPromises(vendorId).filter((row) => !customerId || row.customerId === customerId);
}

export function recordCollectionAction(input: {
  customerId: string;
  actionType: CollectionActionType;
  channel: string;
  outcome: string;
  promiseAmount?: number;
  promiseDate?: string;
  nextFollowUpDate?: string;
  notes?: string;
  status?: CustomerCollectionAction['status'];
}, session?: PosSession | CanonicalCustomerContext | null): CustomerCollectionAction {
  const context = assertCanonicalCustomerContext(session);
  const action: CustomerCollectionAction = {
    collectionActionId: cleanId(`${context.vendorId}_${input.customerId}_${input.actionType}_${nowIso()}`),
    vendorId: context.vendorId,
    customerId: input.customerId,
    actionType: input.actionType,
    actionDate: nowIso(),
    staffId: context.staffId,
    channel: input.channel,
    outcome: input.outcome,
    promiseAmount: input.promiseAmount,
    promiseDate: input.promiseDate,
    nextFollowUpDate: input.nextFollowUpDate,
    notes: input.notes || input.outcome,
    status: input.status || 'Completed'
  };
  writeVendorScopedList(CUSTOMER_COLLECTION_ACTIONS_COLLECTION, [action, ...readActions(context.vendorId)], context.vendorId);
  return action;
}

export function recordPromiseToPay(input: {
  customerId: string;
  promisedAmount: number;
  promiseDate: string;
  notes?: string;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerPromiseToPay {
  const context = assertCanonicalCustomerContext(session);
  const amount = roundMoney(input.promisedAmount);
  if (amount <= 0) throw new Error('Promise amount must be above zero.');
  if (input.promiseDate < new Date().toISOString().slice(0, 10)) throw new Error('Promise date must be today or later.');
  const promise: CustomerPromiseToPay = {
    promiseId: cleanId(`${context.vendorId}_${input.customerId}_PROMISE_${input.promiseDate}_${amount}`),
    vendorId: context.vendorId,
    customerId: input.customerId,
    promisedAmount: amount,
    promiseDate: input.promiseDate,
    recordedBy: context.staffId,
    recordedAt: nowIso(),
    status: 'Active',
    fulfilledAmount: 0,
    notes: input.notes || 'Promise to pay recorded.'
  };
  writeVendorScopedList(CUSTOMER_PROMISES_COLLECTION, [promise, ...readPromises(context.vendorId).filter((row) => row.promiseId !== promise.promiseId)], context.vendorId);
  recordCollectionAction({
    customerId: input.customerId,
    actionType: 'PROMISE_TO_PAY',
    channel: 'Customer account',
    outcome: `Promised USD ${amount.toFixed(2)} by ${input.promiseDate}.`,
    promiseAmount: amount,
    promiseDate: input.promiseDate,
    nextFollowUpDate: input.promiseDate,
    notes: promise.notes
  }, context);
  return promise;
}

export function applyPaymentToPromises(input: {
  customerId: string;
  amount: number;
  paymentDate?: string;
}, session?: PosSession | CanonicalCustomerContext | null): CustomerPromiseToPay[] {
  const context = assertCanonicalCustomerContext(session);
  let remaining = roundMoney(input.amount);
  const rows = readPromises(context.vendorId);
  const updated = rows.map((promise) => {
    if (promise.customerId !== input.customerId || promise.status !== 'Active' || remaining <= 0) return promise;
    const applied = Math.min(remaining, promise.promisedAmount - promise.fulfilledAmount);
    remaining = roundMoney(remaining - applied);
    const fulfilledAmount = roundMoney(promise.fulfilledAmount + applied);
    return {
      ...promise,
      fulfilledAmount,
      fulfilledAt: input.paymentDate || nowIso(),
      status: fulfilledAmount >= promise.promisedAmount ? 'Fulfilled' as const : 'PartiallyFulfilled' as const
    };
  });
  writeVendorScopedList(CUSTOMER_PROMISES_COLLECTION, updated, context.vendorId);
  return updated.filter((promise) => promise.customerId === input.customerId);
}

export function markBrokenPromises(asOfDate = new Date().toISOString().slice(0, 10), session?: PosSession | CanonicalCustomerContext | null): CustomerPromiseToPay[] {
  const context = assertCanonicalCustomerContext(session);
  const rows = readPromises(context.vendorId);
  const updated = rows.map((promise) =>
    promise.status === 'Active' && promise.promiseDate < asOfDate
      ? { ...promise, status: 'Broken' as const, notes: `${promise.notes} Promise broken on ${asOfDate}.` }
      : promise
  );
  writeVendorScopedList(CUSTOMER_PROMISES_COLLECTION, updated, context.vendorId);
  updated
    .filter((promise) => promise.status === 'Broken' && promise.promiseDate < asOfDate)
    .forEach((promise) => recordCollectionAction({
      customerId: promise.customerId,
      actionType: 'ESCALATION',
      channel: 'Customer account',
      outcome: 'Broken promise detected.',
      notes: promise.notes,
      status: 'Escalated'
    }, context));
  return updated;
}
