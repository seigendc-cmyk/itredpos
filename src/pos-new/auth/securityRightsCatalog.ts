import type { PermissionArea, PermissionRiskLevel, SecurityPermissionRight, SecurityRoleKey } from './permissionMatrixTypes';

const owner: SecurityRoleKey[] = ['Owner', 'SysAdmin'];
const manager: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager'];
const supervisor: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'Supervisor'];
const cashier: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'Supervisor', 'Cashier'];
const stock: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'StockController'];
const delivery: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'Supervisor', 'DeliveryStaff'];
const accountant: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'Accountant'];
const viewer: SecurityRoleKey[] = ['Owner', 'SysAdmin', 'Manager', 'Supervisor', 'Accountant', 'StockController', 'Cashier', 'DeliveryStaff', 'Viewer'];

const highRisk = new Set([
  'sales.void',
  'sales.return',
  'sales.cashDrawer.open',
  'sales.endOfDay.run',
  'stockAdjustment.post',
  'stocktake.post',
  'openingBalance.post',
  'goodsReceiving.post',
  'delivery.cashReview',
  'accounting.approve',
  'sync.conflict.resolve'
]);

const criticalRisk = new Set(['settings.permissions.edit', 'staff.permissions.assign', 'sync.clearSynced', 'audit.lockedDayReview']);

const labels: Record<string, string> = {
  view: 'View',
  open: 'Open',
  complete: 'Complete',
  hold: 'Hold',
  discount: 'Discount',
  priceChange: 'Price Change',
  void: 'Void',
  return: 'Return',
  reprintReceipt: 'Reprint Receipt',
  createRequest: 'Create Request',
  createDirect: 'Create Direct',
  edit: 'Edit',
  creditView: 'Credit View',
  purchaseHistoryView: 'Purchase History',
  create: 'Create',
  activate: 'Activate',
  block: 'Block',
  map: 'Map',
  validate: 'Validate',
  approve: 'Approve',
  import: 'Import',
  send: 'Send',
  post: 'Post',
  assign: 'Assign',
  broadcast: 'Broadcast',
  track: 'Track',
  verifyCode: 'Verify Code',
  cancel: 'Cancel',
  export: 'Export',
  override: 'Override',
  reject: 'Reject',
  retry: 'Retry',
  run: 'Run',
  disable: 'Disable',
  resetPin: 'Reset PIN',
  unlock: 'Unlock',
  configure: 'Configure'
};

const titleCase = (value: string) => value.split('.').map((part) => labels[part] || part.replace(/([A-Z])/g, ' $1').replace(/\b\w/g, (letter) => letter.toUpperCase()).trim()).join(' ');

const riskFor = (permissionKey: string): PermissionRiskLevel => {
  if (criticalRisk.has(permissionKey)) return 'Critical';
  if (highRisk.has(permissionKey)) return 'High';
  if (permissionKey.includes('approve') || permissionKey.includes('edit') || permissionKey.includes('create') || permissionKey.includes('export')) return 'Medium';
  return 'Low';
};

let sortCounter = 0;
const right = (area: PermissionArea, permissionKey: string, defaultRoles: SecurityRoleKey[], description: string, systemLocked = false): SecurityPermissionRight => {
  const riskLevel = riskFor(permissionKey);
  return {
    permissionKey,
    label: titleCase(permissionKey),
    area,
    description,
    riskLevel,
    requiresApproval: riskLevel === 'High' || riskLevel === 'Critical',
    systemLocked,
    defaultRoles,
    warningNote: riskLevel === 'High' || riskLevel === 'Critical' ? 'Changing this right affects high-risk operational controls.' : undefined,
    sortOrder: sortCounter += 10
  };
};

export const securityRightsCatalog: SecurityPermissionRight[] = [
  right('Dashboard', 'dashboard.view', viewer, 'Open the main dashboard overview.', true),
  right('Dashboard', 'ownerDesk.view', owner, 'Open the owner review desk.'),
  right('Dashboard', 'bi.summary.view', manager, 'View summarized BI cards and risk indicators.'),

  right('Sales', 'sales.open', cashier, 'Open and use the sales terminal.'),
  right('Sales', 'sales.complete', cashier, 'Complete a sale and issue the receipt.'),
  right('Sales', 'sales.hold', cashier, 'Place a sale on hold.'),
  right('Sales', 'sales.discount', supervisor, 'Apply a discount to a sale.'),
  right('Sales', 'sales.priceChange', supervisor, 'Change a selling price at the terminal.'),
  right('Sales', 'sales.void', supervisor, 'Void a sale or sale line.'),
  right('Sales', 'sales.return', supervisor, 'Process a return or refund request.'),
  right('Sales', 'sales.reprintReceipt', cashier, 'Reprint a receipt.'),
  right('Sales', 'sales.viewHistory', viewer, 'View sales history records.'),
  right('Sales', 'sales.cashDrawer.open', supervisor, 'Open the cash drawer outside the normal sale flow.'),
  right('Sales', 'sales.endOfDay.run', manager, 'Run end-of-day sales close routines.'),

  right('Customers', 'customers.view', viewer, 'View customer records and lookup results.'),
  right('Customers', 'customers.createRequest', cashier, 'Request creation of a customer record.'),
  right('Customers', 'customers.createDirect', supervisor, 'Create a customer record directly.'),
  right('Customers', 'customers.edit', supervisor, 'Edit approved customer records.'),
  right('Customers', 'customers.creditView', accountant, 'View customer credit status and exposure.'),
  right('Customers', 'customers.purchaseHistoryView', viewer, 'View customer purchase history.'),

  right('Inventory', 'inventory.view', stock, 'View inventory and stock balances.'),
  right('Inventory', 'productMaster.view', stock, 'View product master records.'),
  right('Inventory', 'productMaster.create', stock, 'Create product master records.'),
  right('Inventory', 'productMaster.edit', stock, 'Edit product master records.'),
  right('Inventory', 'productMaster.activate', manager, 'Activate product master records.'),
  right('Inventory', 'productMaster.block', manager, 'Block product master records.'),
  right('Inventory', 'productImport.view', stock, 'View product import batches.'),
  right('Inventory', 'productImport.create', stock, 'Create product import batches.'),
  right('Inventory', 'productImport.map', stock, 'Map product import columns.'),
  right('Inventory', 'productImport.validate', stock, 'Validate product import rows.'),
  right('Inventory', 'productImport.approve', manager, 'Approve product import batches.'),
  right('Inventory', 'productImport.import', manager, 'Post approved product import batches.'),

  right('Procurement', 'purchaseOrder.view', stock, 'View purchase orders.'),
  right('Procurement', 'purchaseOrder.create', stock, 'Create purchase orders.'),
  right('Procurement', 'purchaseOrder.approve', manager, 'Approve purchase orders.'),
  right('Procurement', 'purchaseOrder.send', manager, 'Send purchase orders to suppliers.'),
  right('Procurement', 'goodsReceiving.view', stock, 'View goods receiving notes.'),
  right('Procurement', 'goodsReceiving.create', stock, 'Create goods receiving notes.'),
  right('Procurement', 'goodsReceiving.post', manager, 'Post goods receiving into stock.'),
  right('Procurement', 'supplierReturn.view', stock, 'View supplier returns.'),
  right('Procurement', 'supplierReturn.create', stock, 'Create supplier returns.'),
  right('Procurement', 'supplierReturn.post', manager, 'Post supplier returns.'),

  right('Stock Control', 'stockAdjustment.view', stock, 'View stock adjustments.'),
  right('Stock Control', 'stockAdjustment.create', stock, 'Create stock adjustments.'),
  right('Stock Control', 'stockAdjustment.approve', manager, 'Approve stock adjustments.'),
  right('Stock Control', 'stockAdjustment.post', manager, 'Post stock adjustments.'),
  right('Stock Control', 'stocktake.view', stock, 'View stocktakes.'),
  right('Stock Control', 'stocktake.create', stock, 'Create stocktakes.'),
  right('Stock Control', 'stocktake.approve', manager, 'Approve stocktakes.'),
  right('Stock Control', 'stocktake.post', manager, 'Post stocktakes.'),
  right('Stock Control', 'stockTransfer.view', stock, 'View stock transfers.'),
  right('Stock Control', 'stockTransfer.create', stock, 'Create stock transfers.'),
  right('Stock Control', 'stockTransfer.dispatch', stock, 'Dispatch stock transfers.'),
  right('Stock Control', 'stockTransfer.receive', stock, 'Receive stock transfers.'),
  right('Stock Control', 'openingBalance.view', stock, 'View opening balances.'),
  right('Stock Control', 'openingBalance.create', stock, 'Create opening balances.'),
  right('Stock Control', 'openingBalance.approve', manager, 'Approve opening balances.'),
  right('Stock Control', 'openingBalance.post', manager, 'Post opening balances.'),

  right('Delivery', 'delivery.view', delivery, 'View delivery requests.'),
  right('Delivery', 'delivery.create', cashier, 'Create delivery requests from sales.'),
  right('Delivery', 'delivery.assign', supervisor, 'Assign deliveries.'),
  right('Delivery', 'delivery.broadcast', manager, 'Broadcast delivery requests.'),
  right('Delivery', 'delivery.track', delivery, 'Track assigned deliveries.'),
  right('Delivery', 'delivery.verifyCode', delivery, 'Verify customer delivery code.'),
  right('Delivery', 'delivery.complete', delivery, 'Complete assigned deliveries.'),
  right('Delivery', 'delivery.cancel', supervisor, 'Cancel delivery requests.'),
  right('Delivery', 'delivery.cashReview', accountant, 'Review cash collected by delivery staff.'),
  right('Delivery', 'delivery.providerManage', manager, 'Manage delivery providers.'),

  right('Accounting', 'accounting.view', accountant, 'View accounting readiness data.'),
  right('Accounting', 'accounting.readinessReview', accountant, 'Review accounting readiness records.'),
  right('Accounting', 'accounting.approve', manager, 'Approve accounting readiness records.'),
  right('Accounting', 'accounting.export', accountant, 'Export accounting readiness records.'),
  right('Accounting', 'chartOfAccounts.view', accountant, 'View chart of accounts.'),
  right('Accounting', 'chartOfAccounts.edit', owner, 'Edit chart of accounts placeholders.'),

  right('Reports', 'reports.view', viewer, 'View reports.'),
  right('Reports', 'reports.sales', supervisor, 'View sales reports.'),
  right('Reports', 'reports.inventory', stock, 'View inventory reports.'),
  right('Reports', 'reports.delivery', delivery, 'View delivery reports.'),
  right('Reports', 'reports.accounting', accountant, 'View accounting reports.'),
  right('Reports', 'reports.export', accountant, 'Export reports.'),

  right('Approvals', 'approvals.view', supervisor, 'View approval requests.'),
  right('Approvals', 'approvals.approveLowRisk', supervisor, 'Approve low-risk requests.'),
  right('Approvals', 'approvals.approveHighRisk', manager, 'Approve high-risk requests.'),
  right('Approvals', 'approvals.override', manager, 'Override approval rules.'),
  right('Approvals', 'approvals.reject', supervisor, 'Reject approval requests.'),

  right('Sync', 'sync.view', viewer, 'View sync desk status.'),
  right('Sync', 'sync.retry', stock, 'Retry failed sync records.'),
  right('Sync', 'sync.batch.create', stock, 'Create sync batches.'),
  right('Sync', 'sync.batch.run', manager, 'Run sync batches.'),
  right('Sync', 'sync.conflict.view', supervisor, 'View sync conflicts.'),
  right('Sync', 'sync.conflict.resolve', manager, 'Resolve sync conflicts.'),
  right('Sync', 'sync.export', accountant, 'Export sync reports.'),
  right('Sync', 'sync.clearSynced', owner, 'Clear synced local queue records.'),

  right('Settings', 'settings.view', manager, 'View Settings.'),
  right('Settings', 'settings.business.edit', owner, 'Edit business settings.'),
  right('Settings', 'settings.hardware.edit', owner, 'Edit hardware settings.'),
  right('Settings', 'settings.tax.edit', owner, 'Edit tax settings.'),
  right('Settings', 'settings.staff.edit', owner, 'Edit staff settings.'),
  right('Settings', 'settings.permissions.edit', owner, 'Edit role permission matrix.', true),
  right('Settings', 'businessProfile.view', viewer, 'View basic business profile details.'),
  right('Settings', 'businessProfile.edit', manager, 'Edit business profile details.'),
  right('Settings', 'businessRegistration.view', ['Owner', 'SysAdmin', 'Manager', 'Accountant'], 'View business registration details.'),
  right('Settings', 'businessRegistration.edit', owner, 'Edit business registration details.'),
  right('Settings', 'businessRegistration.dashboardView', ['Owner', 'SysAdmin', 'Manager', 'Accountant'], 'Show registration details on the dashboard.'),
  right('Settings', 'businessTax.view', ['Owner', 'SysAdmin', 'Manager', 'Accountant'], 'View VAT and tax details.'),
  right('Settings', 'businessTax.edit', owner, 'Edit VAT and tax details.'),
  right('Settings', 'businessAdministrator.view', ['Owner', 'SysAdmin', 'Manager', 'Accountant'], 'View accountant and administrator contacts.'),
  right('Settings', 'businessAdministrator.edit', owner, 'Edit accountant and administrator contacts.'),

  right('Staff Access', 'staff.view', manager, 'View staff access records.'),
  right('Staff Access', 'staff.create', owner, 'Create staff users.'),
  right('Staff Access', 'staff.edit', owner, 'Edit staff users.'),
  right('Staff Access', 'staff.disable', owner, 'Disable staff users.'),
  right('Staff Access', 'staff.resetPin', owner, 'Reset staff PIN placeholders.'),
  right('Staff Access', 'staff.permissions.assign', owner, 'Assign security rights.', true),
  right('Staff Access', 'staff.session.unlock', owner, 'Unlock staff sessions.'),

  right('Hardware', 'hardware.view', manager, 'View hardware status.'),
  right('Hardware', 'hardware.cashDrawer.configure', owner, 'Configure cash drawer.'),
  right('Hardware', 'hardware.printer.configure', owner, 'Configure receipt printer.'),
  right('Hardware', 'hardware.scanner.configure', owner, 'Configure barcode scanner.'),
  right('Hardware', 'hardware.fiscalDevice.configure', owner, 'Configure fiscal device placeholder.'),

  right('BI', 'bi.view', manager, 'View BI desk.'),
  right('BI', 'bi.riskReview', manager, 'Review BI risk signals.'),
  right('BI', 'bi.export', accountant, 'Export BI outputs.'),
  right('BI', 'bi.rules.manage', owner, 'Manage BI rules placeholders.'),

  right('Audit', 'audit.view', owner, 'View audit events.'),
  right('Audit', 'audit.export', owner, 'Export audit events.'),
  right('Audit', 'audit.lockedDayReview', owner, 'Review locked-day audit exceptions.', true)
];

export const securityPermissionAreas: PermissionArea[] = Array.from(new Set(securityRightsCatalog.map((right) => right.area)));
