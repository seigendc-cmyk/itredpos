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
  | 'approvals.reject'
  | 'hardware.configure'
  | 'payment.capture'
  | 'reports.view'
  | 'reports.export'
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
  | 'settings.view'
  | 'settings.manage'
  | 'bi.view'
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
  | 'bi.shelfStocktake.assign'
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
  'approvals.reject',
  'hardware.configure',
  'payment.capture',
  'reports.view',
  'reports.export',
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
  'settings.view',
  'settings.manage',
  'bi.view',
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
  'bi.shelfStocktake.assign',
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
  Owner: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  SysAdmin: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Manager: ['DASHBOARD', 'OWNER_DESK', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK', 'SETTINGS'],
  Supervisor: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'STOCK', 'TASK_DESK', 'APPROVALS', 'SHIFT', 'CASH', 'BI_DESK', 'SYNC_DESK'],
  Cashier: ['DASHBOARD', 'SALES', 'SALES_HISTORY', 'CUSTOMER_CENTRE', 'DELIVERY', 'SHIFT', 'TASK_DESK', 'SYNC_DESK'],
  'Stock Controller': ['DASHBOARD', 'STOCK', 'TASK_DESK', 'APPROVALS', 'BI_DESK', 'SYNC_DESK'],
  'Delivery Staff': ['DASHBOARD', 'DELIVERY', 'TASK_DESK', 'SYNC_DESK']
};

const ROLE_PERMISSIONS: Record<Role, PermissionKey[]> = {
  Owner: ALL_PERMISSIONS,
  SysAdmin: ALL_PERMISSIONS,
  Manager: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt', 'receipt.pdf', 'receipt.whatsappShare',
    'sales.return', 'sales.creditNote', 'sales.duplicateReceipt', 'sales.paymentDetail.view',
    'sales.creditRedeem', 'sales.loyalty', 'sales.accountSale',
    'sales.profitSnapshot.view', 'sales.profitSnapshot.generate', 'sales.profitSnapshot.export', 'sales.profitSnapshot.print',
    'sales.miscellaneous.create', 'sales.miscellaneous.review', 'sales.miscellaneous.approve',
    'returns.request', 'returns.approve', 'creditNotes.request', 'creditNotes.approve',
    'terminal.activate', 'terminal.deactivate', 'terminal.readinessCheck', 'terminal.history.view',
    'shift.view', 'shift.open', 'shift.close', 'shift.forceClose', 'shift.eodReport.view', 'shift.eodReport.print', 'shift.recovery.restore', 'shift.override',
    'cashDrawer.assign', 'cashDrawer.release',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.edit', 'customers.suspend', 'customers.reactivate',
    'customers.notes.view', 'customers.notes.create', 'customers.purchaseHistory.view', 'customers.creditView', 'customers.creditReview',
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
    'approvals.view', 'approvals.approve', 'approvals.reject',
    'reports.view', 'reports.export',
    'accounting.view', 'accounting.review', 'accounting.approve', 'accounting.postPlaceholder', 'accounting.export',
    'inventoryAccounting.view', 'inventoryAccounting.review', 'inventoryAccounting.approve', 'inventoryAccounting.hold', 'inventoryAccounting.reject', 'inventoryAccounting.export',
    'settings.view',
    'bi.view', 'bi.review', 'bi.riskReview', 'bi.export',
    'bi.advice.view', 'bi.advice.generate', 'bi.advice.assign', 'bi.advice.resolve', 'bi.advice.dismiss', 'bi.advice.escalate', 'bi.advice.createTask',
    'bi.shelfStocktake.assign', 'bi.reorderBlock.review', 'bi.reorderBlock.override',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.batch.run', 'sync.conflict.view', 'sync.conflict.resolve', 'sync.conflict.hold', 'sync.export', 'sync.clearSynced',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate', 'productImport.approve', 'productImport.import', 'productImport.export'
  ],
  Supervisor: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.discount', 'sales.priceOverride', 'sales.void', 'sales.reprintReceipt', 'receipt.whatsappShare',
    'sales.return', 'sales.paymentDetail.view',
    'sales.loyalty',
    'sales.miscellaneous.create', 'sales.miscellaneous.review',
    'returns.request', 'returns.approve', 'creditNotes.request',
    'shift.view', 'shift.open', 'shift.close', 'shift.eodReport.view', 'terminal.readinessCheck', 'terminal.history.view', 'shift.recovery.restore',
    'cashDrawer.assign', 'cashDrawer.release',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.edit', 'customers.notes.view', 'customers.notes.create',
    'customers.useInSale', 'customers.requests.create', 'customers.creditView',
    'inventory.view',
    'productMaster.view', 'productMaster.create', 'productMaster.edit',
    'openingBalance.view', 'openingBalance.create',
    'stockBalances.view',
    'inventoryReports.view', 'stockHealth.view', 'stockHealth.review', 'reorderRecommendations.create', 'stocktakeRecommendations.create', 'transferRecommendations.create', 'supplierPerformance.view',
    'stockAdjustments.view', 'stockAdjustments.create', 'stockAdjustments.edit', 'stockAdjustments.post',
    'inventoryMovements.view', 'productLedger.view',
    'purchaseOrders.view', 'purchaseOrders.create', 'purchaseOrders.edit', 'purchaseOrders.receive',
    'goodsReceiving.view', 'goodsReceiving.create', 'goodsReceiving.edit', 'goodsReceiving.post',
    'supplierReturns.view', 'supplierReturns.create', 'supplierReturns.edit', 'supplierReturns.post', 'supplierReturns.dispatch',
    'stocktake.view', 'stocktake.create', 'stocktake.count', 'stocktake.submit', 'stocktake.post',
    'stockTransfers.view', 'stockTransfers.create', 'stockTransfers.edit', 'stockTransfers.dispatch', 'stockTransfers.receive', 'stockTransfers.postReceipt', 'stockTransfers.export',
    'delivery.broadcast', 'delivery.review',
    'delivery.view', 'delivery.assign', 'delivery.track', 'delivery.verifyCode', 'delivery.complete', 'delivery.cashReview',
    'tasks.view', 'tasks.assign', 'tasks.close',
    'approvals.view', 'approvals.approve', 'approvals.reject',
    'reports.view',
    'accounting.view', 'accounting.review',
    'inventoryAccounting.view', 'inventoryAccounting.review',
    'bi.view', 'bi.review', 'bi.riskReview', 'bi.advice.view', 'bi.advice.generate', 'bi.advice.resolve', 'bi.advice.createTask', 'bi.shelfStocktake.assign', 'bi.reorderBlock.review',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.conflict.view', 'sync.conflict.hold',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate', 'productImport.export'
  ],
  Cashier: [
    'sales.open', 'sales.create', 'sales.complete', 'sales.hold', 'sales.viewHistory', 'sales.reprintReceipt', 'receipt.whatsappShare',
    'sales.paymentDetail.view',
    'sales.miscellaneous.create',
    'returns.request', 'creditNotes.request',
    'shift.view', 'shift.open', 'shift.close', 'terminal.history.view', 'shift.recovery.restore',
    'payment.capture',
    'customers.view', 'customers.createRequest', 'customers.createDirect', 'customers.useInSale', 'customers.requests.create',
    'delivery.view', 'delivery.create',
    'tasks.view',
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
    'accounting.view',
    'inventoryAccounting.view',
    'bi.view', 'bi.advice.view', 'bi.advice.generate', 'bi.shelfStocktake.assign', 'bi.reorderBlock.review',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry', 'sync.batch.create', 'sync.conflict.view', 'sync.export',
    'productImport.view', 'productImport.create', 'productImport.map', 'productImport.validate'
  ],
  'Delivery Staff': [
    'delivery.view', 'delivery.track', 'delivery.verifyCode', 'delivery.complete', 'delivery.cashReview',
    'customers.view',
    'tasks.view',
    'sync.view', 'sync.run', 'sync.queue.view', 'sync.retry'
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
