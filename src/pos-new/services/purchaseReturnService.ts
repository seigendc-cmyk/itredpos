import {
  approveSupplierReturn,
  cancelSupplierReturn,
  closeSupplierReturn,
  createSupplierReturnFromGRN,
  exportSupplierReturnPlaceholder,
  getSupplierReturnActivityEvents,
  getSupplierReturnById,
  getSupplierReturnLines,
  getSupplierReturns,
  getSupplierReturnSummary,
  markDispatchedToSupplier,
  postSupplierReturn,
  recordReplacementExpected,
  recordSupplierCreditNotePlaceholder,
  submitSupplierReturnForApproval,
  updateSupplierReturnDraft,
  updateSupplierReturnLine,
  type SupplierReturnPostingResult
} from './supplierReturnService';

export {
  approveSupplierReturn as approvePurchaseReturn,
  cancelSupplierReturn as cancelPurchaseReturn,
  closeSupplierReturn as closePurchaseReturn,
  createSupplierReturnFromGRN as createPurchaseReturnFromGoodsReceipt,
  exportSupplierReturnPlaceholder as exportPurchaseReturnPlaceholder,
  getSupplierReturnActivityEvents as getPurchaseReturnActivityEvents,
  getSupplierReturnById as getPurchaseReturnById,
  getSupplierReturnLines as getPurchaseReturnLines,
  getSupplierReturns as getPurchaseReturns,
  getSupplierReturnSummary as getPurchaseReturnSummary,
  markDispatchedToSupplier as markPurchaseReturnDispatched,
  postSupplierReturn as postPurchaseReturn,
  recordReplacementExpected as recordPurchaseReturnReplacementExpected,
  recordSupplierCreditNotePlaceholder as recordPurchaseReturnCreditNote,
  submitSupplierReturnForApproval as submitPurchaseReturnForApproval,
  updateSupplierReturnDraft as updatePurchaseReturnDraft,
  updateSupplierReturnLine as updatePurchaseReturnLine
};

export type PurchaseReturnPostingResult = SupplierReturnPostingResult;
