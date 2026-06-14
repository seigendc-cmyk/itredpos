import { PosPageId, Role } from '../types';

/**
 * During build-development, Owner has full access. Commercial feature enforcement
 * will be implemented later from internal backend services.
 */
export const OWNER_BUILD_DEVELOPMENT_FULL_ACCESS = true;

export type PermissionKey =
  | 'sales.open'
  | 'sales.create'
  | 'sales.complete'
  | 'sales.hold'
  | 'sales.viewHistory'
  | 'sales.discount'
  | 'sales.priceOverride'
  | 'sales.void'
  | 'sales.reprintReceipt'
  | 'receipt.pdf'
  | 'receipt.whatsappShare'
  | 'sales.return'
  | 'sales.creditNote'
  | 'sales.duplicateReceipt'
  | 'sales.paymentDetail.view'
  | 'sales.creditRedeem'
  | 'sales.creditSale'
  | 'sales.creditSale.override'
  | 'sales.loyalty'
  | 'sales.accountSale'
  | 'sales.profitSnapshot.view'
  | 'sales.profitSnapshot.generate'
  | 'sales.profitSnapshot.export'
  | 'sales.profitSnapshot.print'
  | 'sales.miscellaneous.create'
  | 'sales.miscellaneous.review'
  | 'sales.miscellaneous.approve'
  | 'returns.request'
  | 'returns.approve'
  | 'creditNotes.request'
  | 'creditNotes.approve'
  | 'terminal.activate'
  | 'terminal.deactivate'
  | 'terminal.readinessCheck'
  | 'terminal.history.view'
  | 'shift.view'
  | 'shift.open'
  | 'shift.close'
  | 'shift.forceClose'
  | 'shift.eodReport.view'
  | 'shift.eodReport.print'
  | 'shift.recovery.restore'
  | 'shift.override'
  | 'cashDrawer.assign'
  | 'cashDrawer.release'
  | 'cashControl.view'
  | 'cashControl.reconcile'
  | 'cashControl.count'
  | 'cashControl.approve'
  | 'cashControl.varianceReview'
  | 'cashControl.expense.create'
  | 'cashControl.expense.approve'
  | 'cashControl.cashDrop.create'
  | 'cashControl.cashDrop.confirm'
  | 'cashControl.debtorPayments.view'
  | 'cashControl.debtorPayments.linkDrawer'
  | 'cashControl.deliveryCash.view'
  | 'cashControl.deliveryCash.confirm'
  | 'cashControl.print'
  | 'cashControl.export'
  | 'cashControl.policy.manage'
  | 'ownerDesk.view'
  | 'ownerDesk.cashReconciliation.view'
  | 'ownerDesk.cashReconciliation.reviewVariance'
  | 'ownerDesk.cashReconciliation.markBalanced'
  | 'ownerDesk.cashReconciliation.addOwnerNote'
  | 'ownerDesk.cashReconciliation.print'
  | 'ownerDesk.cashReconciliation.export'
  | 'ownerDesk.cashReconciliation.escalate'
  | 'ownerDesk.cashReconciliation.createBIWarning'
  | 'ownerDesk.eodReconciliation.view'
  | 'ownerDesk.eodReconciliation.manage'
  | 'ownerDesk.paymentSummary.view'
  | 'ownerDesk.paymentSummary.manage'
  | 'ownerDesk.shiftClosing.view'
  | 'ownerDesk.shiftClosing.manage'
  | 'ownerDesk.inventoryClosing.view'
  | 'ownerDesk.inventoryClosing.manage'
  | 'ownerDesk.deliveryClosing.view'
  | 'ownerDesk.deliveryClosing.manage'
  | 'ownerDesk.biReview.view'
  | 'ownerDesk.biReview.manage'
  | 'ownerDesk.accountingDesk.view'
  | 'ownerDesk.accountingDesk.manage'
  | 'ownerDesk.accountingDesk.coa.view'
  | 'ownerDesk.accountingDesk.coa.create'
  | 'ownerDesk.accountingDesk.coa.editDraft'
  | 'ownerDesk.accountingDesk.coa.markInactive'
  | 'ownerDesk.accountingDesk.coa.reactivate'
  | 'ownerDesk.accountingDesk.coa.print'
  | 'ownerDesk.accountingDesk.coa.export'
  | 'ownerDesk.accountingDesk.coa.addNote'
  | 'ownerDesk.print'
  | 'ownerDesk.export'
  | 'ownerDesk.escalate'
  | 'ownerDesk.createBIWarning'
  | 'ownerDesk.createTask'
  | 'customers.createRequest'
  | 'customers.createDirect'
  | 'customers.view'
  | 'customers.edit'
  | 'customers.suspend'
  | 'customers.reactivate'
  | 'customers.notes.view'
  | 'customers.notes.create'
  | 'customers.purchaseHistory.view'
  | 'customers.creditView'
  | 'customers.credit.view'
  | 'customers.credit.manage'
  | 'customers.credit.setLimit'
  | 'customers.credit.policyManage'
  | 'customers.credit.suspend'
  | 'customers.credit.recordPayment'
  | 'customers.credit.writeOff'
  | 'customers.credit.ageing.view'
  | 'customers.credit.ageing.configure'
  | 'customers.credit.statement.view'
  | 'customers.credit.statement.print'
  | 'customers.credit.statement.whatsapp'
  | 'customers.debtorsDesk.view'
  | 'customers.credit.application.view'
  | 'customers.credit.application.create'
  | 'customers.credit.application.approve'
  | 'customers.credit.block'
  | 'customers.credit.release'
  | 'customers.credit.depositRequired'
  | 'customers.credit.cashOnly'
  | 'customers.promiseToPay.view'
  | 'customers.promiseToPay.create'
  | 'customers.promiseToPay.update'
  | 'customers.collectionDiary.view'
  | 'customers.collectionDiary.manage'
  | 'customers.statement.acknowledge'
  | 'customers.statement.dispute'
  | 'customers.debtDispute.view'
  | 'customers.debtDispute.manage'
  | 'customers.debtors.openingBalance.view'
  | 'customers.debtors.openingBalance.create'
  | 'customers.debtors.openingBalance.approve'
  | 'customers.debtors.openingBalance.post'
  | 'customers.debtors.openingBalance.reverse'
  | 'customers.debtors.paymentAllocation.view'
  | 'customers.debtors.paymentAllocation.manage'
  | 'customers.debtors.paymentAllocation.reverse'
  | 'customers.deposit.view'
  | 'customers.deposit.receive'
  | 'customers.deposit.apply'
  | 'customers.deposit.refund'
  | 'customers.creditNote.view'
  | 'customers.creditNote.create'
  | 'customers.creditNote.approve'
  | 'customers.creditNote.apply'
  | 'customers.creditNote.cancel'
  | 'customers.bulkCollections.view'
  | 'customers.bulkCollections.generate'
  | 'customers.bulkCollections.export'
  | 'customers.debtorRiskHeatMap.view'
  | 'customers.debtors.periodLock.view'
  | 'customers.debtors.periodLock.lock'
  | 'customers.debtors.periodLock.unlock'
  | 'customers.debtors.periodLock.adjust'
  | 'customers.creditWorthiness.view'
  | 'customers.behaviourAnalytics.view'
  | 'customers.whatsappReminder'
  | 'customers.credit.export'
  | 'customers.creditReview'
  | 'customers.export'
  | 'customers.whatsappMessage'
  | 'customers.useInSale'
  | 'customers.requests.create'
  | 'customers.requests.approve'
  | 'customers.approve'
  | 'inventory.view'
  | 'inventory.import'
  | 'inventory.approveImport'
  | 'inventory.adjust'
  | 'inventory.approveAdjustment'
  | 'productMaster.view'
  | 'productMaster.create'
  | 'productMaster.edit'
  | 'productMaster.activate'
  | 'productMaster.block'
  | 'productMaster.export'
  | 'openingBalance.view'
  | 'openingBalance.create'
  | 'openingBalance.approve'
  | 'openingBalance.post'
  | 'openingBalance.cancel'
  | 'stockBalances.view'
  | 'stockBalances.adjust'
  | 'stockBalances.transfer'
  | 'inventoryReports.view'
  | 'inventoryReports.export'
  | 'stockHealth.view'
  | 'stockHealth.review'
  | 'reorderRecommendations.create'
  | 'stocktakeRecommendations.create'
  | 'transferRecommendations.create'
  | 'supplierPerformance.view'
  | 'stockAdjustments.view'
  | 'stockAdjustments.create'
  | 'stockAdjustments.edit'
  | 'stockAdjustments.approve'
  | 'stockAdjustments.post'
  | 'stockAdjustments.cancel'
  | 'stockAdjustments.reverse'
  | 'inventoryMovements.view'
  | 'inventoryMovements.export'
  | 'productLedger.view'
  | 'purchaseOrders.view'
  | 'purchaseOrders.create'
  | 'purchaseOrders.edit'
  | 'purchaseOrders.approve'
  | 'purchaseOrders.cancel'
  | 'purchaseOrders.receive'
  | 'purchaseOrders.export'
  | 'goodsReceiving.view'
  | 'goodsReceiving.create'
  | 'goodsReceiving.edit'
  | 'goodsReceiving.approve'
  | 'goodsReceiving.post'
  | 'goodsReceiving.cancel'
  | 'goodsReceiving.reverse'
  | 'supplierReturns.view'
  | 'supplierReturns.create'
  | 'supplierReturns.edit'
  | 'supplierReturns.approve'
  | 'supplierReturns.post'
  | 'supplierReturns.cancel'
  | 'supplierReturns.dispatch'
  | 'supplierReturns.close'
  | 'stocktake.view'
  | 'stocktake.create'
  | 'stocktake.count'
  | 'stocktake.submit'
  | 'stocktake.approve'
  | 'stocktake.post'
  | 'stocktake.cancel'
  | 'stocktake.export'
  | 'stocktake.approveAdjustment'
  | 'stockTransfers.view'
  | 'stockTransfers.create'
  | 'stockTransfers.edit'
  | 'stockTransfers.approve'
  | 'stockTransfers.dispatch'
  | 'stockTransfers.receive'
  | 'stockTransfers.postReceipt'
  | 'stockTransfers.cancel'
  | 'stockTransfers.closeOutstanding'
  | 'stockTransfers.export'
  | 'ideliver.createProvider'
  | 'delivery.broadcast'
  | 'delivery.review'
  | 'delivery.view'
  | 'delivery.create'
  | 'delivery.assign'
  | 'delivery.track'
  | 'delivery.verifyCode'
  | 'delivery.complete'
  | 'delivery.cancel'
  | 'delivery.cashReview'
  | 'delivery.providerManage'
  | 'delivery.export'
  | 'audit.view'
  | 'audit.export'
  | 'tasks.view'
  | 'tasks.assign'
  | 'tasks.close'
  | 'approvals.view'
  | 'approvals.approve'
  | 'approvals.credit.approve'
  | 'approvals.reject'
  | 'hardware.configure'
  | 'payment.capture'
  | 'reports.view'
  | 'reports.export'
  | 'reports.creditors.view'
  | 'reports.creditors.print'
  | 'reports.creditors.export'
  | 'reports.cogsReserve.view'
  | 'reports.cogsReserve.print'
  | 'reports.cogsReserve.export'
  | 'reports.purchaseDiscipline.view'
  | 'reports.purchaseDiscipline.print'
  | 'reports.purchaseDiscipline.export'
  | 'reports.supplierStatements.view'
  | 'reports.supplierStatements.print'
  | 'reports.supplierStatements.export'
  | 'reports.ownerFinancialControl.view'
  | 'reports.audit.view'
  | 'reports.audit.export'
  | 'accounting.view'
  | 'accounting.post'
  | 'accounting.review'
  | 'accounting.approve'
  | 'accounting.postPlaceholder'
  | 'accounting.export'
  | 'inventoryAccounting.view'
  | 'inventoryAccounting.review'
  | 'inventoryAccounting.approve'
  | 'inventoryAccounting.hold'
  | 'inventoryAccounting.reject'
  | 'inventoryAccounting.export'
  | 'creditors.view'
  | 'creditors.supplierProfile.view'
  | 'creditors.supplierProfile.manage'
  | 'creditors.supplierBill.view'
  | 'creditors.supplierBill.create'
  | 'creditors.supplierBill.post'
  | 'creditors.supplierBill.dispute'
  | 'creditors.supplierBill.reverse'
  | 'creditors.supplierPayment.view'
  | 'creditors.supplierPayment.create'
  | 'creditors.supplierPayment.approve'
  | 'creditors.supplierPayment.pay'
  | 'creditors.supplierPayment.allocate'
  | 'creditors.ageing.view'
  | 'creditors.statement.view'
  | 'creditors.statement.print'
  | 'creditors.export'
  | 'cogsReserve.view'
  | 'cogsReserve.adjust'
  | 'cogsReserve.approve'
  | 'cogsReserve.release'
  | 'cogsReserve.leakageReview'
  | 'cogsReserve.print'
  | 'cogsReserve.export'
  | 'purchaseCommitments.view'
  | 'purchaseCommitments.manage'
  | 'purchaseDiscipline.view'
  | 'purchaseDiscipline.request.create'
  | 'purchaseDiscipline.request.approve'
  | 'purchaseDiscipline.request.reject'
  | 'purchaseDiscipline.request.convertToPO'
  | 'purchaseDiscipline.risk.view'
  | 'purchaseDiscipline.risk.override'
  | 'purchaseDiscipline.commitments.view'
  | 'purchaseDiscipline.commitments.manage'
  | 'purchaseDiscipline.rules.view'
  | 'purchaseDiscipline.rules.manage'
  | 'purchaseDiscipline.cogsBuying.view'
  | 'purchaseDiscipline.cogsBuying.override'
  | 'purchaseDiscipline.print'
  | 'purchaseDiscipline.export'
  | 'settings.view'
  | 'settings.manage'
  | 'bi.view'
  | 'bi.management.view'
  | 'bi.management.generate'
  | 'bi.review'
  | 'bi.riskReview'
  | 'bi.rules.manage'
  | 'bi.export'
  | 'bi.advice.view'
  | 'bi.advice.generate'
  | 'bi.advice.assign'
  | 'bi.advice.resolve'
  | 'bi.advice.dismiss'
  | 'bi.advice.escalate'
  | 'bi.advice.createTask'
  | 'bi.actionPoints.view'
  | 'bi.actionPoints.manage'
  | 'bi.reorderProtection.view'
  | 'bi.reorderProtection.override'
  | 'bi.shelfStocktake.assign'
  | 'bi.cashRisk.view'
  | 'bi.staffRisk.view'
  | 'bi.taxReadiness.view'
  | 'bi.profitSnapshot.view'
  | 'bi.reorderBlock.review'
  | 'bi.reorderBlock.override'
  | 'sync.view'
  | 'sync.run'
  | 'sync.queue.view'
  | 'sync.retry'
  | 'sync.batch.create'
  | 'sync.batch.run'
  | 'sync.conflict.view'
  | 'sync.conflict.resolve'
  | 'sync.conflict.hold'
  | 'sync.export'
  | 'sync.clearSynced'
  | 'productImport.view'
  | 'productImport.create'
  | 'productImport.map'
  | 'productImport.validate'
  | 'productImport.approve'
  | 'productImport.import'
  | 'productImport.cancel'
  | 'productImport.export';

export type PosAction =
  | PermissionKey
  | 'COMPLETE_SALE'
  | 'APPLY_DISCOUNT'
  | 'APPROVE_OVERRIDE'
  | 'VIEW_BI'
  | 'OPEN_SETTINGS'
  | 'CLOSE_SHIFT'
  | 'RECORD_CASH_MOVEMENT'
  | 'STOCK_ADJUSTMENT'
  | 'STOCKTAKE'
  | 'OWNER_FINANCIAL_EXPORT';

const ALL_PERMISSIONS: PermissionKey[] = [
  'sales.open',
  'sales.create',
  'sales.complete',
  'sales.hold',
  'sales.viewHistory',
  'sales.discount',
  'sales.priceOverride',
  'sales.void',
  'sales.reprintReceipt',
  'receipt.pdf',
  'receipt.whatsappShare',
  'sales.return',
  'sales.creditNote',
  'sales.duplicateReceipt',
  'sales.paymentDetail.view',
  'sales.creditRedeem',
  'sales.creditSale',
  'sales.creditSale.override',
  'sales.loyalty',
  'sales.accountSale',
  'sales.profitSnapshot.view',
  'sales.profitSnapshot.generate',
  'sales.profitSnapshot.export',
  'sales.profitSnapshot.print',
  'sales.miscellaneous.create',
  'sales.miscellaneous.review',
  'sales.miscellaneous.approve',
  'returns.request',
  'returns.approve',
  'creditNotes.request',
  'creditNotes.approve',
  'terminal.activate',
  'terminal.deactivate',
  'terminal.readinessCheck',
  'terminal.history.view',
  'shift.view',
  'shift.open',
  'shift.close',
  'shift.forceClose',
  'shift.eodReport.view',
  'shift.eodReport.print',
  'shift.recovery.restore',
  'shift.override',
  'cashDrawer.assign',
  'cashDrawer.release',
  'cashControl.view',
  'cashControl.reconcile',
  'cashControl.count',
  'cashControl.approve',
  'cashControl.varianceReview',
  'cashControl.expense.create',
  'cashControl.expense.approve',
  'cashControl.cashDrop.create',
  'cashControl.cashDrop.confirm',
  'cashControl.debtorPayments.view',
  'cashControl.debtorPayments.linkDrawer',
  'cashControl.deliveryCash.view',
  'cashControl.deliveryCash.confirm',
  'cashControl.print',
  'cashControl.export',
  'cashControl.policy.manage',
  'ownerDesk.view',
  'ownerDesk.cashReconciliation.view',
  'ownerDesk.cashReconciliation.reviewVariance',
  'ownerDesk.cashReconciliation.markBalanced',
  'ownerDesk.cashReconciliation.addOwnerNote',
  'ownerDesk.cashReconciliation.print',
  'ownerDesk.cashReconciliation.export',
  'ownerDesk.cashReconciliation.escalate',
  'ownerDesk.cashReconciliation.createBIWarning',
  'ownerDesk.eodReconciliation.view',
  'ownerDesk.eodReconciliation.manage',
  'ownerDesk.paymentSummary.view',
  'ownerDesk.paymentSummary.manage',
  'ownerDesk.shiftClosing.view',
  'ownerDesk.shiftClosing.manage',
  'ownerDesk.inventoryClosing.view',
  'ownerDesk.inventoryClosing.manage',
  'ownerDesk.deliveryClosing.view',
  'ownerDesk.deliveryClosing.manage',
  'ownerDesk.biReview.view',
  'ownerDesk.biReview.manage',
  'ownerDesk.accountingDesk.view',
  'ownerDesk.accountingDesk.manage',
  'ownerDesk.accountingDesk.coa.view',
  'ownerDesk.accountingDesk.coa.create',
  'ownerDesk.accountingDesk.coa.editDraft',
  'ownerDesk.accountingDesk.coa.markInactive',
  'ownerDesk.accountingDesk.coa.reactivate',
  'ownerDesk.accountingDesk.coa.print',
  'ownerDesk.accountingDesk.coa.export',
  'ownerDesk.accountingDesk.coa.addNote',
  'ownerDesk.print',
  'ownerDesk.export',
  'ownerDesk.escalate',
  'ownerDesk.createBIWarning',
  'ownerDesk.createTask',
  'customers.createRequest',
  'customers.createDirect',
  'customers.view',
  'customers.edit',
  'customers.suspend',
  'customers.reactivate',
  'customers.notes.view',
  'customers.notes.create',
  'customers.purchaseHistory.view',
  'customers.creditView',
  'customers.credit.view',
  'customers.credit.manage',
  'customers.credit.setLimit',
  'customers.credit.policyManage',
  'customers.credit.suspend',
  'customers.credit.recordPayment',
  'customers.credit.writeOff',
  'customers.credit.ageing.view',
  'customers.credit.ageing.configure',
  'customers.credit.statement.view',
  'customers.credit.statement.print',
  'customers.credit.statement.whatsapp',
  'customers.debtorsDesk.view',
  'customers.credit.application.view',
  'customers.credit.application.create',
  'customers.credit.application.approve',
  'customers.credit.block',
  'customers.credit.release',
  'customers.credit.depositRequired',
  'customers.credit.cashOnly',
  'customers.promiseToPay.view',
  'customers.promiseToPay.create',
  'customers.promiseToPay.update',
  'customers.collectionDiary.view',
  'customers.collectionDiary.manage',
  'customers.statement.acknowledge',
  'customers.statement.dispute',
  'customers.debtDispute.view',
  'customers.debtDispute.manage',
  'customers.debtors.openingBalance.view',
  'customers.debtors.openingBalance.create',
  'customers.debtors.openingBalance.approve',
  'customers.debtors.openingBalance.post',
  'customers.debtors.openingBalance.reverse',
  'customers.debtors.paymentAllocation.view',
  'customers.debtors.paymentAllocation.manage',
  'customers.debtors.paymentAllocation.reverse',
  'customers.deposit.view',
  'customers.deposit.receive',
  'customers.deposit.apply',
  'customers.deposit.refund',
  'customers.creditNote.view',
  'customers.creditNote.create',
  'customers.creditNote.approve',
  'customers.creditNote.apply',
  'customers.creditNote.cancel',
  'customers.bulkCollections.view',
  'customers.bulkCollections.generate',
  'customers.bulkCollections.export',
  'customers.debtorRiskHeatMap.view',
  'customers.debtors.periodLock.view',
  'customers.debtors.periodLock.lock',
  'customers.debtors.periodLock.unlock',
  'customers.debtors.periodLock.adjust',
  'customers.creditWorthiness.view',
  'customers.behaviourAnalytics.view',
  'customers.whatsappReminder',
  'customers.credit.export',
  'customers.creditReview',
  'customers.export',
  'customers.whatsappMessage',
  'customers.useInSale',
  'customers.requests.create',
  'customers.requests.approve',
  'customers.approve',
  'inventory.view',
  'inventory.import',
  'inventory.approveImport',
  'inventory.adjust',
  'inventory.approveAdjustment',
  'productMaster.view',
  'productMaster.create',
  'productMaster.edit',
  'productMaster.activate',
  'productMaster.block',
  'productMaster.export',
  'openingBalance.view',
  'openingBalance.create',
  'openingBalance.approve',
  'openingBalance.post',
  'openingBalance.cancel',
  'stockBalances.view',
  'stockBalances.adjust',
  'stockBalances.transfer',
  'inventoryReports.view',
  'inventoryReports.export',
  'stockHealth.view',
  'stockHealth.review',
  'reorderRecommendations.create',
  'stocktakeRecommendations.create',
  'transferRecommendations.create',
  'supplierPerformance.view',
  'stockAdjustments.view',
  'stockAdjustments.create',
  'stockAdjustments.edit',
  'stockAdjustments.approve',
  'stockAdjustments.post',
  'stockAdjustments.cancel',
  'stockAdjustments.reverse',
  'inventoryMovements.view',
  'inventoryMovements.export',
  'productLedger.view',
  'purchaseOrders.view',
  'purchaseOrders.create',
  'purchaseOrders.edit',
  'purchaseOrders.approve',
  'purchaseOrders.cancel',
  'purchaseOrders.receive',
  'purchaseOrders.export',
  'goodsReceiving.view',
  'goodsReceiving.create',
  'goodsReceiving.edit',
  'goodsReceiving.approve',
  'goodsReceiving.post',
  'goodsReceiving.cancel',
  'goodsReceiving.reverse',
  'supplierReturns.view',
  'supplierReturns.create',
  'supplierReturns.edit',
  'supplierReturns.approve',
  'supplierReturns.post',
  'supplierReturns.cancel',
  'supplierReturns.dispatch',
  'supplierReturns.close',
  'stocktake.view',
  'stocktake.create',
  'stocktake.count',
  'stocktake.submit',
  'stocktake.approve',
  'stocktake.post',
  'stocktake.cancel',
  'stocktake.export',
  'stocktake.approveAdjustment',
  'stockTransfers.view',
  'stockTransfers.create',
  'stockTransfers.edit',
  'stockTransfers.approve',
  'stockTransfers.dispatch',
  'stockTransfers.receive',
  'stockTransfers.postReceipt',
  'stockTransfers.cancel',
  'stockTransfers.closeOutstanding',
  'stockTransfers.export',
  'ideliver.createProvider',
  'delivery.broadcast',
  'delivery.review',
  'delivery.view',
  'delivery.create',
  'delivery.assign',
  'delivery.track',
  'delivery.verifyCode',
  'delivery.complete',
  'delivery.cancel',
  'delivery.cashReview',
  'delivery.providerManage',
  'delivery.export',
  'audit.view',
  'audit.export',
  'tasks.view',
  'tasks.assign',
  'tasks.close',
  'approvals.view',
  'approvals.approve',
  'approvals.credit.approve',
  'approvals.reject',
  'hardware.configure',
  'payment.capture',
  'reports.view',
  'reports.export',
  'reports.creditors.view',
  'reports.creditors.print',
  'reports.creditors.export',
  'reports.cogsReserve.view',
  'reports.cogsReserve.print',
  'reports.cogsReserve.export',
  'reports.purchaseDiscipline.view',
  'reports.purchaseDiscipline.print',
  'reports.purchaseDiscipline.export',
  'reports.supplierStatements.view',
  'reports.supplierStatements.print',
  'reports.supplierStatements.export',
  'reports.ownerFinancialControl.view',
  'reports.audit.view',
  'reports.audit.export',
  'accounting.view',
  'accounting.post',
  'accounting.review',
  'accounting.approve',
  'accounting.postPlaceholder',
  'accounting.export',
  'inventoryAccounting.view',
  'inventoryAccounting.review',
  'inventoryAccounting.approve',
  'inventoryAccounting.hold',
  'inventoryAccounting.reject',
  'inventoryAccounting.export',
  'creditors.view',
  'creditors.supplierProfile.view',
  'creditors.supplierProfile.manage',
  'creditors.supplierBill.view',
  'creditors.supplierBill.create',
  'creditors.supplierBill.post',
  'creditors.supplierBill.dispute',
  'creditors.supplierBill.reverse',
  'creditors.supplierPayment.view',
  'creditors.supplierPayment.create',
  'creditors.supplierPayment.approve',
  'creditors.supplierPayment.pay',
  'creditors.supplierPayment.allocate',
  'creditors.ageing.view',
  'creditors.statement.view',
  'creditors.statement.print',
  'creditors.export',
  'cogsReserve.view',
  'cogsReserve.adjust',
  'cogsReserve.approve',
  'cogsReserve.release',
  'cogsReserve.leakageReview',
  'cogsReserve.print',
  'cogsReserve.export',
  'purchaseCommitments.view',
  'purchaseCommitments.manage',
  'purchaseDiscipline.view',
  'purchaseDiscipline.request.create',
  'purchaseDiscipline.request.approve',
  'purchaseDiscipline.request.reject',
  'purchaseDiscipline.request.convertToPO',
  'purchaseDiscipline.risk.view',
  'purchaseDiscipline.risk.override',
  'purchaseDiscipline.commitments.view',
  'purchaseDiscipline.commitments.manage',
  'purchaseDiscipline.rules.view',
  'purchaseDiscipline.rules.manage',
  'purchaseDiscipline.cogsBuying.view',
  'purchaseDiscipline.cogsBuying.override',
  'purchaseDiscipline.print',
  'purchaseDiscipline.export',
  'settings.view',
  'settings.manage',
  'bi.view',
  'bi.management.view',
  'bi.management.generate',
  'bi.review',
  'bi.riskReview',
  'bi.rules.manage',
  'bi.export',
  'bi.advice.view',
  'bi.advice.generate',
  'bi.advice.assign',
  'bi.advice.resolve',
  'bi.advice.dismiss',
  'bi.advice.escalate',
  'bi.advice.createTask',
  'bi.actionPoints.view',
  'bi.actionPoints.manage',
  'bi.reorderProtection.view',
  'bi.reorderProtection.override',
  'bi.shelfStocktake.assign',
  'bi.cashRisk.view',
  'bi.staffRisk.view',
  'bi.taxReadiness.view',
  'bi.profitSnapshot.view',
  'bi.reorderBlock.review',
  'bi.reorderBlock.override',
  'sync.view',
  'sync.run',
  'sync.queue.view',
  'sync.retry',
  'sync.batch.create',
  'sync.batch.run',
  'sync.conflict.view',
  'sync.conflict.resolve',
  'sync.conflict.hold',
  'sync.export',
  'sync.clearSynced',
  'productImport.view',
  'productImport.create',
  'productImport.map',
  'productImport.validate',
  'productImport.approve',
  'productImport.import',
  'productImport.cancel',
  'productImport.export'
];

const ROLE_MENUS: Record<Role, PosPageId[]> = {
  Owner: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  SysAdmin: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Manager: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Supervisor: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'PURCHASE_DISCIPLINE', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  Cashier: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'SHIFT', 'CASH', 'TASK_DESK', 'SYNC_DESK'],
  'Stock Controller': ['DASHBOARD', 'STOCK', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'TASK_DESK', 'APPROVALS', 'BI_DESK', 'SYNC_DESK'],
  'Delivery Staff': ['DASHBOARD', 'DELIVERY', 'TASK_DESK', 'SYNC_DESK'],
  Accountant: ['DASHBOARD', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'PURCHASE_DISCIPLINE', 'CREDITORS', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  Viewer: ['DASHBOARD', 'CUSTOMER_CENTRE']
};

const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  Owner: ALL_PERMISSIONS,
  SysAdmin: ALL_PERMISSIONS,
  Manager: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt', 'receipt.pdf', 'receipt.whatsappShare',
    'sales.return', 'sales.creditNote', 'sales.duplicateReceipt', 'sales.paymentDetail.view',
    'sales.creditRedeem', 'sales.creditSale', 'sales.creditSale.override', 'sales.loyalty', 'sales.accountSale',
    'sales.profitSnapshot.view', 'sales.profitSnapshot.generate', 'sales.profitSnapshot.export', 'sales.profitSnapshot.print',
    'sales.miscellaneous.create', 'sales.miscellaneous.review', 'sales.miscellaneous.approve',
    'returns.request', 'returns.approve', 'creditNotes.request', 'creditNotes.approve',
    'terminal.activate', 'terminal.deactivate', 'terminal.readinessCheck', 'terminal.history.view',
    'shift.view', 'shift.open', 'shift.close', 'shift.forceClose', 'shift.eodReport.view', 'shift.eodReport.print', 'shift.recovery.restore', 'shift.override',
    'cashDrawer.assign', 'cashDrawer.release',
    'cashControl.view', 'cashControl.reconcile', 'cashControl.count', 'cashControl.approve', 'cashControl.varianceReview',
    'cashControl.expense.create', 'cashControl.expense.approve', 'cashControl.cashDrop.create', 'cashControl.cashDrop.confirm',
    'cashControl.debtorPayments.view', 'cashControl.debtorPayments.linkDrawer', 'cashControl.deliveryCash.view', 'cashControl.deliveryCash.confirm',
    'cashControl.print', 'cashControl.export', 'cashControl.policy.manage',
    'ownerDesk.view', 'ownerDesk.cashReconciliation.view', 'ownerDesk.cashReconciliation.reviewVariance',
    'ownerDesk.cashReconciliation.escalate',
    'ownerDesk.eodReconciliation.view', 'ownerDesk.eodReconciliation.manage',
    'ownerDesk.paymentSummary.view', 'ownerDesk.paymentSummary.manage',
    'ownerDesk.shiftClosing.view', 'ownerDesk.shiftClosing.manage',
    'ownerDesk.inventoryClosing.view', 'ownerDesk.inventoryClosing.manage',
    'ownerDesk.deliveryClosing.view', 'ownerDesk.deliveryClosing.manage',
    'ownerDesk.biReview.view', 'ownerDesk.biReview.manage',
    'ownerDesk.accountingDesk.view',
    'ownerDesk.accountingDesk.coa.view',
    'ownerDesk.print', 'ownerDesk.export', 'ownerDesk.escalate', 'ownerDesk.createBIWarning', 'ownerDesk.createTask',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.edit', 'customers.suspend', 'customers.reactivate',
    'customers.notes.view', 'customers.notes.create', 'customers.purchaseHistory.view', 'customers.creditView', 'customers.credit.view', 'customers.credit.manage', 'customers.credit.setLimit', 'customers.credit.policyManage', 'customers.credit.suspend', 'customers.credit.recordPayment', 'customers.credit.writeOff', 'customers.credit.ageing.view', 'customers.credit.ageing.configure', 'customers.credit.statement.view', 'customers.credit.statement.print', 'customers.credit.statement.whatsapp', 'customers.debtorsDesk.view',
    'customers.credit.application.view', 'customers.credit.application.create', 'customers.credit.application.approve', 'customers.credit.block', 'customers.credit.release', 'customers.credit.depositRequired', 'customers.credit.cashOnly',
    'customers.promiseToPay.view', 'customers.promiseToPay.create', 'customers.promiseToPay.update', 'customers.collectionDiary.view', 'customers.collectionDiary.manage', 'customers.statement.acknowledge', 'customers.statement.dispute', 'customers.debtDispute.view', 'customers.debtDispute.manage',
    'customers.debtors.openingBalance.view', 'customers.debtors.openingBalance.create', 'customers.debtors.openingBalance.approve', 'customers.debtors.openingBalance.post', 'customers.debtors.openingBalance.reverse',
    'customers.debtors.paymentAllocation.view', 'customers.debtors.paymentAllocation.manage', 'customers.debtors.paymentAllocation.reverse',
    'customers.deposit.view', 'customers.deposit.receive', 'customers.deposit.apply', 'customers.deposit.refund',
    'customers.creditNote.view', 'customers.creditNote.create', 'customers.creditNote.approve', 'customers.creditNote.apply', 'customers.creditNote.cancel',
    'customers.bulkCollections.view', 'customers.bulkCollections.generate', 'customers.bulkCollections.export', 'customers.debtorRiskHeatMap.view',
    'customers.debtors.periodLock.view', 'customers.debtors.periodLock.lock', 'customers.debtors.periodLock.unlock', 'customers.debtors.periodLock.adjust',
    'customers.creditWorthiness.view', 'customers.behaviourAnalytics.view', 'customers.whatsappReminder', 'customers.credit.export', 'customers.creditReview',
    'customers.export', 'customers.whatsappMessage', 'customers.useInSale', 'customers.requests.create', 'customers.requests.approve', 'customers.approve',
    'inventory.view', 'inventory.import', 'inventory.approveImport', 'inventory.adjust', 'inventory.approveAdjustment',
    'productMaster.view', 'productMaster.create', 'productMaster.edit', 'productMaster.activate', 'productMaster.block', 'productMaster.export',
    'openingBalance.view', 'openingBalance.create', 'openingBalance.approve', 'openingBalance.post', 'openingBalance.cancel',
    'stockBalances.view', 'stockBalances.adjust', 'stockBalances.transfer',
    'inventoryReports.view', 'inventoryReports.export', 'stockHealth.view', 'stockHealth.review', 'reorderRecommendations.create', 'stocktakeRecommendations.create', 'transferRecommendations.create', 'supplierPerformance.view',
    'stockAdjustments.view', 'stockAdjustments.create', 'stockAdjustments.edit', 'stockAdjustments.approve', 'stockAdjustments.post', 'stockAdjustments.cancel', 'stockAdjustments.reverse',
    'inventoryMovements.view', 'inventoryMovements.export', 'productLedger.view',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit', 'purchaseOrders.approve', 'purchaseOrders.cancel', 'purchaseOrders.receive', 'purchaseOrders.export',
    'goodsReceiving.view', 'goodsReceiving.create', 'goodsReceiving.edit', 'goodsReceiving.approve', 'goodsReceiving.post', 'goodsReceiving.cancel',
    'supplierReturns.view', 'supplierReturns.create', 'supplierReturns.edit', 'supplierReturns.approve', 'supplierReturns.post', 'supplierReturns.cancel', 'supplierReturns.dispatch', 'supplierReturns.close',
    'stocktake.view', 'stocktake.create', 'stocktake.count', 'stocktake.submit', 'stocktake.approve', 'stocktake.post', 'stocktake.cancel', 'stocktake.export', 'stocktake.approveAdjustment',
    'stockTransfers.view', 'stockTransfers.create', 'stockTransfers.edit', 'stockTransfers.approve', 'stockTransfers.dispatch', 'stockTransfers.receive', 'stockTransfers.postReceipt', 'stockTransfers.cancel', 'stockTransfers.closeOutstanding', 'stockTransfers.export',
    'ideliver.createProvider', 'delivery.broadcast', 'delivery.review',
    'delivery.view', 'delivery.create', 'delivery.assign', 'delivery.track', 'delivery.verifyCode', 'delivery.complete', 'delivery.cancel', 'delivery.cashReview', 'delivery.providerManage', 'delivery.export',
    'audit.view', 'audit.export',
    'tasks.view', 'tasks.assign', 'tasks.close',
    'approvals.view', 'approvals.approve', 'approvals.credit.approve', 'approvals.reject',
    'reports.view', 'reports.export',
    'reports.creditors.view', 'reports.creditors.print', 'reports.creditors.export',
    'reports.cogsReserve.view', 'reports.cogsReserve.print', 'reports.cogsReserve.export',
    'reports.purchaseDiscipline.view', 'reports.purchaseDiscipline.print', 'reports.purchaseDiscipline.export',
    'reports.supplierStatements.view', 'reports.supplierStatements.print', 'reports.supplierStatements.export',
    'reports.ownerFinancialControl.view', 'reports.audit.view', 'reports.audit.export',
    'accounting.view', 'accounting.review', 'accounting.approve', 'accounting.postPlaceholder', 'accounting.export',
    'inventoryAccounting.view', 'inventoryAccounting.review', 'inventoryAccounting.approve', 'inventoryAccounting.hold', 'inventoryAccounting.reject', 'inventoryAccounting.export',
    'creditors.view', 'creditors.supplierProfile.view', 'creditors.supplierProfile.manage',
    'creditors.supplierBill.view', 'creditors.supplierBill.create', 'creditors.supplierBill.post', 'creditors.supplierBill.dispute', 'creditors.supplierBill.reverse',
    'creditors.supplierPayment.view', 'creditors.supplierPayment.create', 'creditors.supplierPayment.approve', 'creditors.supplierPayment.pay', 'creditors.supplierPayment.allocate',
    'creditors.ageing.view', 'creditors.statement.view', 'creditors.statement.print', 'creditors.export',
    'cogsReserve.view', 'cogsReserve.adjust', 'cogsReserve.approve', 'cogsReserve.release', 'cogsReserve.leakageReview', 'cogsReserve.print', 'cogsReserve.export',
    'purchaseCommitments.view', 'purchaseCommitments.manage',
    'purchaseDiscipline.view', 'purchaseDiscipline.request.create', 'purchaseDiscipline.request.approve', 'purchaseDiscipline.request.reject', 'purchaseDiscipline.request.convertToPO',
    'purchaseDiscipline.risk.view', 'purchaseDiscipline.risk.override', 'purchaseDiscipline.commitments.view', 'purchaseDiscipline.commitments.manage',
    'purchaseDiscipline.rules.view', 'purchaseDiscipline.rules.manage', 'purchaseDiscipline.cogsBuying.view', 'purchaseDiscipline.cogsBuying.override',
    'purchaseDiscipline.print', 'purchaseDiscipline.export',
    'settings.view',
    'bi.view', 'bi.management.view', 'bi.management.generate', 'bi.review', 'bi.riskReview', 'bi.export',
    'bi.advice.view', 'bi.advice.generate', 'bi.advice.assign', 'bi.advice.resolve', 'bi.advice.dismiss', 'bi.advice.escalate', 'bi.advice.createTask',
    'bi.actionPoints.view', 'bi.actionPoints.manage', 'bi.reorderProtection.view', 'bi.reorderProtection.override',
    'bi.shelfStocktake.assign', 'bi.cashRisk.view', 'bi.staffRisk.view', 'bi.taxReadiness.view', 'bi.profitSnapshot.view', 'bi.reorderBlock.review', 'bi.reorderBlock.override',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.batch.run', 'sync.conflict.view', 'sync.conflict.resolve', 'sync.conflict.hold', 'sync.export', 'sync.clearSynced',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate', 'productImport.approve', 'productImport.import', 'productImport.export'
  ],
  Supervisor: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt', 'receipt.whatsappShare',
    'sales.return', 'sales.paymentDetail.view',
    'sales.creditSale', 'sales.creditSale.override', 'sales.loyalty',
    'sales.miscellaneous.create', 'sales.miscellaneous.review',
    'returns.request', 'returns.approve', 'creditNotes.request',
    'shift.view', 'shift.open', 'shift.close', 'shift.eodReport.view', 'terminal.readinessCheck', 'terminal.history.view', 'shift.recovery.restore',
    'cashDrawer.assign', 'cashDrawer.release',
    'cashControl.view', 'cashControl.reconcile', 'cashControl.count', 'cashControl.varianceReview',
    'cashControl.expense.create', 'cashControl.cashDrop.create', 'cashControl.debtorPayments.view',
    'cashControl.debtorPayments.linkDrawer', 'cashControl.deliveryCash.view', 'cashControl.deliveryCash.confirm',
    'cashControl.print', 'cashControl.export',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.edit', 'customers.notes.view', 'customers.notes.create',
    'customers.useInSale', 'customers.requests.create', 'customers.creditView', 'customers.credit.view', 'customers.credit.ageing.view', 'customers.credit.statement.view', 'customers.debtorsDesk.view', 'customers.credit.recordPayment',
    'customers.promiseToPay.view', 'customers.promiseToPay.create', 'customers.promiseToPay.update', 'customers.collectionDiary.view', 'customers.collectionDiary.manage', 'customers.debtDispute.view',
    'customers.deposit.view', 'customers.deposit.apply', 'customers.bulkCollections.view', 'customers.bulkCollections.generate',
    'customers.debtors.paymentAllocation.view', 'customers.debtors.paymentAllocation.manage',
    'customers.creditWorthiness.view', 'customers.behaviourAnalytics.view', 'customers.whatsappReminder',
    'inventory.view',
    'productMaster.view', 'productMaster.create', 'productMaster.edit',
    'openingBalance.view', 'openingBalance.create',
    'stockBalances.view',
    'inventoryReports.view', 'stockHealth.view', 'stockHealth.review', 'reorderRecommendations.create', 'stocktakeRecommendations.create', 'transferRecommendations.create', 'supplierPerformance.view',
    'stockAdjustments.view', 'stockAdjustments.create', 'stockAdjustments.edit', 'stockAdjustments.post',
    'inventoryMovements.view', 'productLedger.view',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit', 'purchaseOrders.receive',
    'purchaseDiscipline.view', 'purchaseDiscipline.request.create', 'purchaseDiscipline.request.approve', 'purchaseDiscipline.risk.view', 'purchaseDiscipline.commitments.view', 'purchaseDiscipline.cogsBuying.view',
    'goodsReceiving.view', 'goodsReceiving.create', 'goodsReceiving.edit', 'goodsReceiving.post',
    'supplierReturns.view', 'supplierReturns.create', 'supplierReturns.edit', 'supplierReturns.post', 'supplierReturns.dispatch',
    'stocktake.view', 'stocktake.create', 'stocktake.count', 'stocktake.submit', 'stocktake.post',
    'stockTransfers.view', 'stockTransfers.create', 'stockTransfers.edit', 'stockTransfers.dispatch', 'stockTransfers.receive', 'stockTransfers.postReceipt', 'stockTransfers.export',
    'delivery.broadcast', 'delivery.review',
    'delivery.view', 'delivery.assign', 'delivery.track', 'delivery.verifyCode', 'delivery.complete', 'delivery.cashReview',
    'tasks.view', 'tasks.assign', 'tasks.close',
    'approvals.view', 'approvals.approve', 'approvals.credit.approve', 'approvals.reject',
    'reports.view',
    'reports.creditors.view', 'reports.cogsReserve.view', 'reports.purchaseDiscipline.view', 'reports.supplierStatements.view', 'reports.audit.view',
    'accounting.view', 'accounting.review',
    'inventoryAccounting.view', 'inventoryAccounting.review',
    'bi.view', 'bi.review', 'bi.riskReview', 'bi.advice.view', 'bi.advice.generate', 'bi.advice.resolve', 'bi.advice.createTask',
    'bi.actionPoints.view', 'bi.shelfStocktake.assign', 'bi.reorderProtection.view', 'bi.reorderBlock.review',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.conflict.view', 'sync.conflict.hold',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate', 'productImport.export'
  ],
  Cashier: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.reprintReceipt', 'receipt.whatsappShare',
    'sales.paymentDetail.view', 'sales.creditSale',
    'sales.miscellaneous.create',
    'returns.request', 'creditNotes.request',
    'shift.view', 'shift.open', 'shift.close', 'terminal.history.view', 'shift.recovery.restore',
    'cashControl.view', 'cashControl.count',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.useInSale', 'customers.requests.create', 'customers.credit.view', 'customers.deposit.view', 'customers.deposit.apply',
    'delivery.view', 'delivery.create',
    'tasks.view',
    'bi.advice.view',
    'sync.view', 'sync.queue.view', 'sync.conflict.view'
  ],
  'Stock Controller': [
    'sales.viewHistory',
    'inventory.view', 'inventory.import', 'inventory.adjust',
    'productMaster.view', 'productMaster.create', 'productMaster.edit', 'productMaster.export',
    'openingBalance.view', 'openingBalance.create',
    'stockBalances.view', 'stockBalances.adjust', 'stockBalances.transfer',
    'inventoryReports.view', 'inventoryReports.export', 'stockHealth.view', 'stockHealth.review', 'reorderRecommendations.create', 'stocktakeRecommendations.create', 'transferRecommendations.create', 'supplierPerformance.view',
    'stockAdjustments.view', 'stockAdjustments.create', 'stockAdjustments.edit',
    'inventoryMovements.view', 'productLedger.view',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit', 'purchaseOrders.receive',
    'goodsReceiving.view', 'goodsReceiving.create', 'goodsReceiving.edit',
    'supplierReturns.view', 'supplierReturns.create', 'supplierReturns.edit',
    'stocktake.view', 'stocktake.create', 'stocktake.count', 'stocktake.submit', 'stocktake.export',
    'stockTransfers.view', 'stockTransfers.create', 'stockTransfers.edit', 'stockTransfers.dispatch', 'stockTransfers.receive', 'stockTransfers.export',
    'tasks.view',
    'approvals.view',
    'reports.view',
    'reports.creditors.view', 'reports.cogsReserve.view', 'reports.purchaseDiscipline.view', 'reports.supplierStatements.view',
    'accounting.view',
    'inventoryAccounting.view',
    'creditors.view', 'creditors.supplierProfile.view', 'creditors.supplierBill.view', 'creditors.supplierBill.create',
    'creditors.ageing.view', 'creditors.statement.view', 'creditors.export',
    'cogsReserve.view', 'purchaseCommitments.view', 'purchaseCommitments.manage',
    'purchaseDiscipline.view', 'purchaseDiscipline.request.create', 'purchaseDiscipline.risk.view', 'purchaseDiscipline.commitments.view', 'purchaseDiscipline.cogsBuying.view',
    'bi.view', 'bi.advice.view', 'bi.advice.generate', 'bi.actionPoints.view', 'bi.shelfStocktake.assign', 'bi.reorderProtection.view', 'bi.reorderBlock.review',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.conflict.view', 'sync.export',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate'
  ],
  'Delivery Staff': [
    'delivery.view', 'delivery.track', 'delivery.verifyCode', 'delivery.complete', 'delivery.cashReview',
    'cashControl.deliveryCash.view', 'cashControl.deliveryCash.confirm',
    'customers.view',
    'tasks.view',
    'bi.advice.view',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry'
  ],
  Accountant: [
    'sales.viewHistory', 'receipt.pdf',
    'customers.view', 'customers.notes.view', 'customers.purchaseHistory.view',
    'customers.creditView', 'customers.credit.view', 'customers.credit.recordPayment', 'customers.credit.ageing.view',
    'customers.credit.statement.view', 'customers.credit.statement.print', 'customers.credit.statement.whatsapp',
    'customers.debtorsDesk.view', 'customers.credit.application.view', 'customers.promiseToPay.view', 'customers.promiseToPay.create', 'customers.promiseToPay.update',
    'customers.collectionDiary.view', 'customers.collectionDiary.manage', 'customers.statement.acknowledge', 'customers.statement.dispute', 'customers.debtDispute.view', 'customers.debtDispute.manage',
    'customers.debtors.openingBalance.view', 'customers.debtors.openingBalance.create', 'customers.debtors.openingBalance.approve', 'customers.debtors.openingBalance.post',
    'customers.debtors.paymentAllocation.view', 'customers.debtors.paymentAllocation.manage', 'customers.deposit.view', 'customers.deposit.receive', 'customers.deposit.apply', 'customers.deposit.refund',
    'customers.creditNote.view', 'customers.creditNote.create', 'customers.creditNote.approve', 'customers.creditNote.apply', 'customers.creditNote.cancel',
    'customers.bulkCollections.view', 'customers.bulkCollections.generate', 'customers.bulkCollections.export', 'customers.debtorRiskHeatMap.view',
    'customers.debtors.periodLock.view', 'customers.debtors.periodLock.lock', 'customers.debtors.periodLock.adjust',
    'customers.creditWorthiness.view', 'customers.behaviourAnalytics.view',
    'customers.whatsappReminder', 'customers.credit.export', 'customers.export',
    'payment.capture',
    'cashControl.view', 'cashControl.reconcile', 'cashControl.count', 'cashControl.varianceReview',
    'cashControl.expense.create', 'cashControl.cashDrop.create', 'cashControl.debtorPayments.view',
    'cashControl.debtorPayments.linkDrawer', 'cashControl.deliveryCash.view', 'cashControl.print', 'cashControl.export',
    'approvals.view',
    'reports.view', 'reports.export',
    'reports.creditors.view', 'reports.creditors.print', 'reports.creditors.export',
    'reports.cogsReserve.view', 'reports.cogsReserve.print', 'reports.cogsReserve.export',
    'reports.purchaseDiscipline.view', 'reports.purchaseDiscipline.print', 'reports.purchaseDiscipline.export',
    'reports.supplierStatements.view', 'reports.supplierStatements.print', 'reports.supplierStatements.export',
    'reports.ownerFinancialControl.view', 'reports.audit.view', 'reports.audit.export',
    'accounting.view', 'accounting.review', 'accounting.postPlaceholder', 'accounting.export',
    'ownerDesk.accountingDesk.view', 'ownerDesk.accountingDesk.coa.view', 'ownerDesk.accountingDesk.coa.create',
    'ownerDesk.accountingDesk.coa.editDraft', 'ownerDesk.accountingDesk.coa.print', 'ownerDesk.accountingDesk.coa.export',
    'inventoryAccounting.view', 'inventoryAccounting.review', 'inventoryAccounting.export',
    'creditors.view', 'creditors.supplierProfile.view',
    'creditors.supplierBill.view', 'creditors.supplierBill.create', 'creditors.supplierBill.post', 'creditors.supplierBill.dispute',
    'creditors.supplierPayment.view', 'creditors.supplierPayment.create', 'creditors.supplierPayment.approve', 'creditors.supplierPayment.pay', 'creditors.supplierPayment.allocate',
    'creditors.ageing.view', 'creditors.statement.view', 'creditors.statement.print', 'creditors.export',
    'cogsReserve.view', 'cogsReserve.adjust', 'cogsReserve.print', 'cogsReserve.export',
    'purchaseCommitments.view',
    'purchaseDiscipline.view', 'purchaseDiscipline.risk.view', 'purchaseDiscipline.commitments.view', 'purchaseDiscipline.cogsBuying.view', 'purchaseDiscipline.print', 'purchaseDiscipline.export',
    'bi.view', 'bi.advice.view', 'bi.advice.generate', 'bi.advice.createTask',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.export'
  ],
  Viewer: [
    'customers.view', 'customers.notes.view', 'customers.purchaseHistory.view',
    'customers.credit.view', 'customers.credit.ageing.view', 'customers.credit.statement.view',
    'customers.debtorsDesk.view', 'customers.credit.application.view', 'customers.promiseToPay.view', 'customers.collectionDiary.view', 'customers.debtDispute.view',
    'customers.debtors.openingBalance.view', 'customers.debtors.paymentAllocation.view', 'customers.deposit.view', 'customers.creditNote.view', 'customers.bulkCollections.view', 'customers.debtorRiskHeatMap.view', 'customers.debtors.periodLock.view', 'customers.creditWorthiness.view',
    'cashControl.view', 'cashControl.debtorPayments.view', 'cashControl.deliveryCash.view',
    'creditors.view', 'creditors.supplierProfile.view', 'creditors.supplierBill.view', 'creditors.ageing.view', 'creditors.statement.view', 'cogsReserve.view', 'purchaseCommitments.view',
    'purchaseDiscipline.view', 'purchaseDiscipline.risk.view', 'purchaseDiscipline.commitments.view', 'purchaseDiscipline.rules.view', 'purchaseDiscipline.cogsBuying.view',
    'reports.view', 'reports.creditors.view', 'reports.cogsReserve.view', 'reports.purchaseDiscipline.view', 'reports.supplierStatements.view', 'reports.audit.view', 'bi.view', 'bi.advice.view'
  ]
};

const LEGACY_ACTION_PERMISSION: Record<Exclude<PosAction, PermissionKey>, PermissionKey> = {
  COMPLETE_SALE: 'sales.complete',
  APPLY_DISCOUNT: 'sales.discount',
  APPROVE_OVERRIDE: 'sales.priceOverride',
  VIEW_BI: 'bi.view',
  OPEN_SETTINGS: 'settings.view',
  CLOSE_SHIFT: 'shift.close',
  RECORD_CASH_MOVEMENT: 'accounting.review',
  STOCK_ADJUSTMENT: 'inventory.adjust',
  STOCKTAKE: 'stocktake.count',
  OWNER_FINANCIAL_EXPORT: 'reports.export'
};

export function getPermissionsForRole(role: Role): PermissionKey[] {
  if (role === 'Owner' && OWNER_BUILD_DEVELOPMENT_FULL_ACCESS) {
    return ALL_PERMISSIONS;
  }
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: Role, permission: PermissionKey): boolean {
  return getPermissionsForRole(role).includes(permission);
}

export function getAllowedMenusForRole(role: Role): PosPageId[] {
  return ROLE_MENUS[role] || ['DASHBOARD'];
}

export function canAccessMenu(role: Role, menuKey: PosPageId): boolean {
  return getAllowedMenusForRole(role).includes(menuKey);
}

export function canPerformAction(role: Role, actionKey: PosAction): boolean {
  const permission = LEGACY_ACTION_PERMISSION[actionKey as Exclude<PosAction, PermissionKey>] || actionKey;
  return hasPermission(role, permission as PermissionKey);
}
