import type { PosPageId } from '../types';

export interface HelpFunctionLink {
  label: string;
  targetPage: PosPageId;
  targetTab?: string;
  targetAction?: string;
  description: string;
  permissionNote?: string;
}

export interface HelpBodySection {
  heading: string;
  text: string;
}

export interface HelpArticle {
  articleId: string;
  title: string;
  chapter: string;
  relationshipGroup: string;
  summary: string;
  bodySections: HelpBodySection[];
  steps: string[];
  bestPractices: string[];
  warnings: string[];
  relatedMenus: string[];
  relatedFunctions: HelpFunctionLink[];
  relatedArticles: string[];
  tags: string[];
  searchKeywords: string[];
  lastUpdated: string;
  buildModeNote?: string;
}

export interface HelpRelationshipGroup {
  groupId: string;
  groupName: string;
  description: string;
  relatedModules: string[];
  articles: string[];
}

const updated = '2026-06-14';

export const helpRelationshipGroups: HelpRelationshipGroup[] = [
  { groupId: 'getting-started', groupName: 'Getting Started', description: 'Session, roles, sidebar groups, dashboard, and local build-development mode.', relatedModules: ['Dashboard', 'Settings', 'Help Desk'], articles: [] },
  { groupId: 'sales-customer-flow', groupName: 'Sales and Customer Flow', description: 'How sales, carts, receipts, customer selection, returns, and sales history connect.', relatedModules: ['Sales Terminal', 'Sales History', 'Customer Centre'], articles: [] },
  { groupId: 'customers-debtors', groupName: 'Customers and Debtors', description: 'Customer profiles, credit control, statements, deposits, promise-to-pay, and ageing.', relatedModules: ['Customer Centre', 'Cash Control', 'Financial Control'], articles: [] },
  { groupId: 'stock-inventory-import', groupName: 'Stock, Inventory, and Importing', description: 'Product master data, stock balances, imports, stocktake, costs, and adjustments.', relatedModules: ['Inventory', 'Approvals', 'BI Desk'], articles: [] },
  { groupId: 'purchasing-creditors', groupName: 'Purchasing, Suppliers, and Creditors', description: 'Purchase discipline, supplier bills, GRN, payments, statements, and supplier credit.', relatedModules: ['Purchase Discipline', 'Creditors', 'Financial Control'], articles: [] },
  { groupId: 'cash-bank-finance', groupName: 'Cash, Bank, and Financial Control', description: 'Cash Control, Money In, Money Out, COA cash/bank accounts, CashPlan, checks, and journals.', relatedModules: ['Cash Control', 'Financial Control', 'Owner Desk'], articles: [] },
  { groupId: 'cogs-reserve', groupName: 'COGS Reserve and Business Seed Protection', description: 'How replacement stock seed is protected from sales through purchasing and supplier payments.', relatedModules: ['Purchase Discipline', 'Financial Control', 'BI Desk'], articles: [] },
  { groupId: 'owner-closing', groupName: 'Owner Desk and Day Closing', description: 'Owner review, EOD readiness, cash reconciliation, payment summary, closing pages, and day lock.', relatedModules: ['Owner Desk', 'Cash Control', 'Approvals'], articles: [] },
  { groupId: 'tasks-approvals', groupName: 'Tasks, Approvals, and Decisions', description: 'Task routing, approval decisions, decision files, notifications, and local live chat.', relatedModules: ['Task Desk', 'Approvals', 'BI Desk'], articles: [] },
  { groupId: 'delivery-fulfilment', groupName: 'Delivery and Fulfilment', description: 'Delivery requests, fulfilment code, delivery cash handover, and failed-delivery handling.', relatedModules: ['Delivery Desk', 'Sales Terminal', 'Cash Control'], articles: [] },
  { groupId: 'bi-risk-control', groupName: 'BI, Alerts, and Risk Control', description: 'BI advice, risk rules, sales integrity, stock integrity, cash, debtor, creditor, and financial warnings.', relatedModules: ['BI Desk', 'Task Desk', 'Approvals'], articles: [] },
  { groupId: 'sync-settings-system', groupName: 'Sync, Settings, and System Control', description: 'Sync queue, offline records, staff access rights, terminal setup, hardware, and permissions.', relatedModules: ['Sync Desk', 'Settings', 'Staff Access Rights'], articles: [] }
];

const groupById = Object.fromEntries(helpRelationshipGroups.map((group) => [group.groupId, group.groupName]));

function link(label: string, targetPage: PosPageId, description: string, targetTab?: string, targetAction?: string): HelpFunctionLink {
  return { label, targetPage, description, targetTab, targetAction };
}

function article(input: Omit<HelpArticle, 'lastUpdated'>): HelpArticle {
  return { ...input, lastUpdated: updated };
}

function menuArticle(
  articleId: string,
  title: string,
  groupId: string,
  targetPage: PosPageId,
  summary: string,
  keyTabs: string[],
  records: string[],
  mistakes: string[],
  tags: string[]
): HelpArticle {
  return article({
    articleId,
    title,
    chapter: 'Menu Guide',
    relationshipGroup: groupById[groupId],
    summary,
    bodySections: [
      { heading: 'What this menu does', text: summary },
      { heading: 'When to use it', text: `Use ${title.replace('How to use ', '')} when your work touches ${records.join(', ')}. It is part of the ${groupById[groupId]} relationship group, so changes here can affect the connected modules shown on this article.` },
      { heading: 'Who should use it', text: 'Use this page according to your staff role. If a function button is restricted, ask the Owner or Manager to grant the correct Staff Access Right instead of sharing another staff PIN.' },
      { heading: 'Key tabs and buttons', text: keyTabs.join(', ') || 'Open the page and follow the visible tabs, row actions, print buttons, export buttons, and local workflow prompts.' },
      { heading: 'Records affected', text: records.join(', ') },
      { heading: 'Related controls', text: 'Related modules are shown on the right side of the Help Desk article. Open them only when the business record has reached the correct stage.' }
    ],
    steps: [
      'Confirm the active vendor, branch, terminal, staff member, and shift status.',
      `Open ${title.replace('How to use ', '')} from the sidebar or the function link in this article.`,
      'Read the page filters and tabs before changing records.',
      'Use row actions or primary buttons only after checking the status, amount, branch, and reviewer fields.',
      'Print, export, or create a task when a manager needs evidence.'
    ],
    bestPractices: [
      'Keep one responsible staff member on each record at a time.',
      'Use notes to explain decisions in plain language.',
      'Review BI warnings before approving risky stock, cash, customer, or supplier actions.',
      'Do not use screenshots as the only control record; use the page workflow and audit trail.'
    ],
    warnings: mistakes,
    relatedMenus: records,
    relatedFunctions: [link(`Open ${title.replace('How to use ', '')}`, targetPage, `Navigate to ${title.replace('How to use ', '')}.`)],
    relatedArticles: [],
    tags,
    searchKeywords: [...tags, ...keyTabs, ...records, title],
    buildModeNote: 'This help article describes the local/mock build-development workflow. External business services are not connected here.'
  });
}

const menuArticles: HelpArticle[] = [
  menuArticle('menu-dashboard', 'How to use Dashboard', 'getting-started', 'DASHBOARD', 'Dashboard is the landing page for active session status, role-aware navigation, operational summaries, and quick access into the POS.', ['Quick cards', 'active session', 'navigation'], ['Active Session', 'BI summaries', 'module links'], ['Do not treat dashboard totals as final accounting reports without closing checks.'], ['dashboard', 'session', 'navigation', 'getting started']),
  menuArticle('menu-owner-desk', 'How to use Owner Desk', 'owner-closing', 'OWNER_DESK', 'Owner Desk is for final operational review, EOD reconciliation, cash review, payment summary, inventory/delivery closing, BI review, and accounting desk readiness.', ['Cash Reconciliation', 'EOD Reconciliation', 'Payment Summary', 'Accounting Desk'], ['EOD rows', 'cash variance', 'payment summary', 'accounting readiness'], ['Do not lock a day before reviewing cash, inventory, delivery, and payment exceptions.'], ['owner', 'closing', 'day lock', 'accounting desk']),
  menuArticle('menu-sales-terminal', 'How to use Sales Terminal', 'sales-customer-flow', 'SALES', 'Sales Terminal is where cashiers search products, build a cart, select customers, capture payment, and create receipts.', ['Product Search', 'Cart Items', 'Payment', 'Customer'], ['sales', 'cart lines', 'receipts', 'payments', 'customer balances'], ['Do not complete a credit sale for an unapproved customer.', 'Do not ignore stock or price warnings.'], ['sales', 'cart', 'payment', 'receipt', 'credit sale']),
  menuArticle('menu-sales-history', 'How to use Sales History', 'sales-customer-flow', 'SALES_HISTORY', 'Sales History lets staff review completed sales, receipts, returns, credit notes, selected-sale details, and receipt reprint workflows.', ['Receipt review', 'returns', 'credit notes', 'filters'], ['sales receipts', 'return requests', 'credit notes'], ['Do not reprint or WhatsApp receipts without checking the correct invoice and customer.'], ['sales history', 'receipt', 'return', 'credit note']),
  menuArticle('menu-customer-centre', 'How to use Customer Centre', 'customers-debtors', 'CUSTOMER_CENTRE', 'Customer Centre manages customer profiles, credit status, debtor ageing, statements, deposits, reminders, and collection diary work.', ['Customers', 'Credit', 'Debtors', 'Statements', 'Deposits'], ['customers', 'debtors', 'statements', 'payments', 'promises'], ['Do not raise a credit sale before checking ageing and credit limit.', 'Do not adjust debtor records without a note.'], ['customer', 'debtor', 'ageing', 'statement', 'deposit']),
  menuArticle('menu-delivery-desk', 'How to use Delivery Desk', 'delivery-fulfilment', 'DELIVERY', 'Delivery Desk controls delivery requests, assignments, fulfilment codes, status updates, failures, and delivery cash handover review.', ['Delivery queue', 'tracking', 'code confirmation', 'cash handover'], ['delivery requests', 'drivers', 'confirmation codes', 'delivery cash'], ['Do not complete delivery without customer fulfilment confirmation.', 'Do not mix delivery cash with drawer cash without handover review.'], ['delivery', 'fulfilment code', 'cash handover']),
  menuArticle('menu-inventory', 'How to use Inventory', 'stock-inventory-import', 'STOCK', 'Inventory manages product master data, stock balances, imports, movements, stock adjustments, stocktake, purchase receiving, transfers, and reports.', ['Product List', 'Product Master', 'Product Import Desk', 'Stock Adjustments', 'Stocktake'], ['products', 'stock balances', 'imports', 'stock movements'], ['Do not import products without mapping required columns.', 'Do not post stock corrections without reason and approval where required.'], ['inventory', 'stock', 'import', 'mapping', 'stocktake']),
  menuArticle('menu-purchase-discipline', 'How to use Purchase Discipline', 'purchasing-creditors', 'PURCHASE_DISCIPLINE', 'Purchase Discipline helps managers check buying pressure, reorder risk, COGS reserve, supplier commitments, and safe buying capacity before purchasing.', ['Risk review', 'Commitments', 'COGS Buying Control', 'Reorder Protection'], ['purchase requests', 'supplier commitments', 'reserve warnings'], ['Do not buy stock using money that belongs to operating expenses or tax.', 'Do not ignore reserve protection warnings.'], ['purchase', 'supplier', 'reserve', 'reorder']),
  menuArticle('menu-creditors', 'How to use Creditors', 'purchasing-creditors', 'CREDITORS', 'Creditors manages supplier profiles, supplier bills, supplier payments, ageing, statements, returns, credit notes, and payable controls.', ['Supplier Bills', 'Payments', 'Ageing', 'Statements', 'Returns'], ['supplier bills', 'supplier payments', 'supplier statements', 'credit notes'], ['Do not pay suppliers before checking outstanding bills, reserve impact, and statement balance.'], ['creditors', 'supplier payment', 'supplier statement']),
  menuArticle('menu-task-desk', 'How to use Task Desk', 'tasks-approvals', 'TASK_DESK', 'Task Desk routes work that needs review, follow-up, evidence, approval, or completion across sales, stock, cash, finance, delivery, and BI.', ['Task queue', 'workflow actions', 'related record', 'audit'], ['tasks', 'notes', 'related records', 'BI warnings'], ['Do not close a task without recording what was done.'], ['task', 'workflow', 'follow up']),
  menuArticle('menu-approvals', 'How to use Approvals', 'tasks-approvals', 'APPROVALS', 'Approvals Command Centre is the decision queue for price overrides, discounts, customer approvals, cash variance reviews, inventory imports, purchasing, delivery, and accounting decisions.', ['Approval queue', 'Decision File', 'Notifications', 'Live Chat'], ['approval requests', 'decision files', 'audit trail'], ['Do not approve without reading the decision file, risk, reason, and related record.'], ['approval', 'decision file', 'notify', 'live chat']),
  menuArticle('menu-shift-control', 'How to use Shift Control', 'owner-closing', 'SHIFT', 'Shift Control opens, closes, reviews, and recovers terminal shifts, readiness checks, and end-of-day reporting.', ['Open Shift', 'Close Shift', 'EOD Report', 'Terminal Readiness'], ['shifts', 'cash drawer', 'terminal status'], ['Do not start selling before opening the shift.', 'Do not close a shift without counting cash.'], ['shift', 'terminal', 'eod']),
  menuArticle('menu-cash-control', 'How to use Cash Control', 'cash-bank-finance', 'CASH', 'Cash Control handles drawer counts, reconciliations, cash drops, expenses, debtor payment linking, delivery cash, and cash movement review.', ['Drawer Count', 'Reconcile', 'Debtor Payments', 'Delivery Cash'], ['cash logs', 'cash variances', 'drawer counts', 'payments'], ['Do not record supplier payments as drawer cash.', 'Do not leave unexplained cash variance.'], ['cash', 'drawer', 'variance', 'reconcile']),
  menuArticle('menu-financial-control', 'How to use Financial Control', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Financial Control is a management preview for COA-driven cash and bank accounts, Money In, Money Out, CashPlan, profitability, reserve protection, checks, payees, and journal entry readiness.', ['Accounts', 'Money In', 'Money Out', 'CashPlan', 'Check Writer', 'Journal Entry'], ['cash accounts', 'bank accounts', 'cash plan', 'checks', 'journals'], ['Do not treat management preview as final statutory accounting posting.', 'Do not confuse available cash with profit.'], ['financial control', 'cashplan', 'check writer', 'journal']),
  menuArticle('menu-bi-desk', 'How to use BI Desk', 'bi-risk-control', 'BI_DESK', 'BI Desk shows deterministic local warnings, advice, domain risk scores, and action points for sales, stock, cash, debtors, creditors, purchasing, delivery, and finance.', ['BI Advice Flow', 'Risk Domains', 'Action Points', 'Triggers'], ['BI warnings', 'risk scores', 'action points'], ['Do not dismiss a BI warning without checking the source record.'], ['bi', 'risk', 'warning', 'alerts']),
  menuArticle('menu-sync-desk', 'How to use Sync Desk', 'sync-settings-system', 'SYNC_DESK', 'Sync Desk reviews local offline queue records, sync batches, conflicts, terminal health, and local snapshots in build-development mode.', ['Offline Queue', 'Batches', 'Conflicts', 'Terminal Health'], ['sync queue', 'conflicts', 'local snapshots'], ['Do not assume sync is real cloud posting in build-development mode.'], ['sync', 'offline', 'conflict']),
  menuArticle('menu-settings', 'How to use Settings', 'sync-settings-system', 'SETTINGS', 'Settings controls business profile, registration details, branches, warehouses, terminals, hardware, tax, staff access rights, receipts, and check writer settings.', ['Business Profile', 'Staff Access Rights', 'Hardware', 'Tax', 'Check Writer Settings'], ['settings', 'staff rights', 'business profile', 'hardware'], ['Do not change access rights during a live shift without management approval.'], ['settings', 'staff access', 'permissions', 'hardware']),
  menuArticle('menu-help-desk', 'How to use Help Desk', 'getting-started', 'HELP_DESK', 'Help Desk Book is the searchable in-app manual for menus, workflows, relationships, function links, daily routines, and build-development guidance.', ['Search', 'Chapters', 'Articles', 'Related Functions'], ['help articles', 'local issue reports', 'guidance copies'], ['Do not use Help Desk as a replacement for manager approval where controls require it.'], ['help', 'manual', 'guide', 'training'])
];

function actionArticle(articleId: string, title: string, groupId: string, targetPage: PosPageId, actionName: string, summary: string, tags: string[], targetTab?: string): HelpArticle {
  return article({
    articleId,
    title,
    chapter: 'Action Guide',
    relationshipGroup: groupById[groupId],
    summary,
    bodySections: [
      { heading: 'What this action does', text: summary },
      { heading: 'Before you click', text: 'Check the record status, amount, branch, customer or supplier, and any warning messages. If the action changes money, stock, debt, supplier balance, or approval status, leave a clear note.' },
      { heading: 'What happens after', text: `The system records the local/mock workflow result for ${actionName}. Related modules may show a task, approval, warning, payment line, stock movement, or review item depending on the page.` }
    ],
    steps: [
      `Open the page for ${actionName}.`,
      'Find the correct record using filters or search.',
      'Open the action button, tab, or row menu.',
      'Confirm the details and enter a plain-language note if requested.',
      'Review the result message, audit trail, or follow-up task.'
    ],
    bestPractices: [
      'Use the action only when the business document is ready.',
      'Attach or record evidence where the page asks for a decision reason.',
      'Escalate unusual cash, stock, supplier, or customer-credit risk instead of forcing it through.'
    ],
    warnings: [
      'Do not click workflow actions just to test them on a live operating day.',
      'Do not bypass approvals by using another staff member role.'
    ],
    relatedMenus: [targetPage, actionName],
    relatedFunctions: [link(`Open ${actionName}`, targetPage, `Navigate to the page where ${actionName} is performed.`, targetTab, actionName)],
    relatedArticles: [],
    tags,
    searchKeywords: [...tags, actionName, title, targetTab || ''],
    buildModeNote: 'This action uses local/mock behaviour unless the page says otherwise.'
  });
}

const actionArticles: HelpArticle[] = [
  actionArticle('action-add-to-cart', 'Add to Cart', 'sales-customer-flow', 'SALES', 'Add to Cart', 'Adds a selected product to the current sale cart so the cashier can confirm quantity, price, customer, and payment.', ['add to cart', 'cart items', 'product search']),
  actionArticle('action-complete-sale', 'Complete Sale', 'sales-customer-flow', 'SALES', 'Complete Sale', 'Finalises a sale after cart, customer, payment method, and warnings have been checked.', ['complete sale', 'receive payment', 'receipt']),
  actionArticle('action-hold-sale', 'Hold Sale', 'sales-customer-flow', 'SALES', 'Hold Sale', 'Temporarily parks a sale when a customer pauses, fetches money, or needs confirmation before payment.', ['hold sale', 'park sale']),
  actionArticle('action-use-customer-sale', 'Use Customer in Sale', 'sales-customer-flow', 'SALES', 'Use Customer in Sale', 'Links a registered customer to the current cart for credit checks, statements, deposits, and purchase history.', ['customer sale', 'credit sale']),
  actionArticle('action-print-receipt', 'Print or WhatsApp Receipt', 'sales-customer-flow', 'SALES_HISTORY', 'Print Receipt', 'Prints or prepares a receipt share for the correct completed transaction.', ['print receipt', 'whatsapp receipt']),
  actionArticle('action-open-cat', 'Open CAT Form', 'sales-customer-flow', 'SALES_HISTORY', 'Open CAT', 'Opens the customer action trail review from selected sale context where available.', ['cat form', 'customer action trail']),
  actionArticle('action-new-customer', 'New Customer', 'customers-debtors', 'CUSTOMER_CENTRE', 'New Customer', 'Creates or requests a customer profile before selling, delivery, deposit, or credit work.', ['new customer', 'customer profile']),
  actionArticle('action-credit-sale', 'Credit Sale', 'customers-debtors', 'SALES', 'Credit Sale', 'Completes a sale against an approved customer account with credit control rules.', ['credit sale', 'customer credit', 'ageing']),
  actionArticle('action-record-debt-payment', 'Record Debt Payment', 'customers-debtors', 'CUSTOMER_CENTRE', 'Record Debt Payment', 'Records a debtor payment locally and links it to customer credit control where available.', ['debt payment', 'debtor payment', 'ageing']),
  actionArticle('action-print-statement', 'Print Statement', 'customers-debtors', 'CUSTOMER_CENTRE', 'Print Statement', 'Prepares a customer statement for review, acknowledgement, or collection follow-up.', ['statement', 'print statement']),
  actionArticle('action-promise-pay', 'Promise to Pay', 'customers-debtors', 'CUSTOMER_CENTRE', 'Promise to Pay', 'Records a customer promise date and follow-up note for collection diary control.', ['promise to pay', 'collection diary']),
  actionArticle('action-block-credit', 'Block Credit', 'customers-debtors', 'CUSTOMER_CENTRE', 'Block Credit', 'Stops risky account sales until a manager reviews the customer balance and behaviour.', ['block credit', 'cash only']),
  actionArticle('action-customer-deposit', 'Customer Deposit', 'customers-debtors', 'CUSTOMER_CENTRE', 'Customer Deposit', 'Records customer money held for later sale allocation or refund control.', ['deposit', 'customer deposit']),
  actionArticle('action-import-products', 'Import Products', 'stock-inventory-import', 'STOCK', 'Import Products', 'Starts the inventory import mapping wizard for bulk product or opening stock setup.', ['import products', 'mapping wizard'], 'Product Import Desk'),
  actionArticle('action-map-columns', 'Map Columns', 'stock-inventory-import', 'STOCK', 'Map Columns', 'Matches spreadsheet or pasted CSV columns to accepted iTred product, supplier, stock, tax, and price fields.', ['map columns', 'inventory import'], 'Product Import Desk'),
  actionArticle('action-validate-import', 'Validate Import', 'stock-inventory-import', 'STOCK', 'Validate Import', 'Checks imported rows for missing required fields, duplicate risk, invalid numbers, and posting readiness.', ['validate import', 'duplicate risk'], 'Product Import Desk'),
  actionArticle('action-submit-import', 'Submit Import for Approval', 'stock-inventory-import', 'STOCK', 'Submit Import for Approval', 'Queues a risky or important import for supervisor approval before stock records are posted.', ['submit import approval'], 'Product Import Desk'),
  actionArticle('action-post-import', 'Post Import', 'stock-inventory-import', 'STOCK', 'Post Import', 'Posts validated import rows locally into the preview stock workflow when permission and status allow.', ['post import', 'product import'], 'Product Import Desk'),
  actionArticle('action-stock-adjustment', 'Stock Adjustment', 'stock-inventory-import', 'STOCK', 'Stock Adjustment', 'Records a controlled stock correction with reason, approval status, and movement impact.', ['stock adjustment'], 'Stock Adjustments'),
  actionArticle('action-stocktake', 'Stocktake', 'stock-inventory-import', 'STOCK', 'Stocktake', 'Counts stock physically and compares counted quantities with system balances.', ['stocktake', 'variance'], 'Stocktake'),
  actionArticle('action-grn', 'Goods Receiving Note', 'purchasing-creditors', 'STOCK', 'GRN', 'Receives supplier goods against purchase/order context and updates receiving readiness locally.', ['grn', 'goods receiving'], 'Goods Receiving'),
  actionArticle('action-reorder-request', 'Reorder Request', 'purchasing-creditors', 'PURCHASE_DISCIPLINE', 'Reorder Request', 'Starts replenishment review while checking reserve and buying risk.', ['reorder request']),
  actionArticle('action-purchase-risk-review', 'Purchase Risk Review', 'purchasing-creditors', 'PURCHASE_DISCIPLINE', 'Purchase Risk Review', 'Reviews whether buying is safe based on cash, stock velocity, reserve, and commitments.', ['purchase risk', 'safe buying']),
  actionArticle('action-supplier-bill', 'Create Supplier Bill', 'purchasing-creditors', 'CREDITORS', 'Create Supplier Bill', 'Records a supplier payable from invoice or GRN evidence.', ['supplier bill', 'invoice']),
  actionArticle('action-supplier-payment', 'Record Supplier Payment', 'purchasing-creditors', 'CREDITORS', 'Record Supplier Payment', 'Records supplier payment intent or payment allocation while checking reserve and outstanding bills.', ['supplier payment', 'creditors']),
  actionArticle('action-supplier-statement', 'Generate Supplier Statement', 'purchasing-creditors', 'CREDITORS', 'Generate Supplier Statement', 'Prepares a supplier statement to compare bills, payments, returns, and credit notes.', ['supplier statement']),
  actionArticle('action-check-cogs-reserve', 'Check COGS Reserve', 'cogs-reserve', 'PURCHASE_DISCIPLINE', 'Check COGS Reserve', 'Checks whether sales have protected enough replacement seed before buying or paying suppliers.', ['cogs reserve', 'stock seed']),
  actionArticle('action-money-in', 'Money In', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Money In', 'Records incoming business money into a cash or bank management preview account.', ['money in', 'bank']),
  actionArticle('action-money-out', 'Money Out', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Money Out', 'Records planned or actual outgoing money while separating operating cash from stock seed.', ['money out', 'expense']),
  actionArticle('action-cashplan', 'CashPlan Forecast', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'CashPlan Forecast', 'Shows management preview of expected cash pressure, upcoming commitments, and safe buying capacity.', ['cashplan', 'forecast']),
  actionArticle('action-profitability', 'Profitability', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Profitability', 'Reviews margin and profitability preview without treating it as final accounting profit.', ['profitability', 'margin']),
  actionArticle('action-reserve-protection', 'Reserve Protection', 'cogs-reserve', 'FINANCIAL_CONTROL', 'Reserve Protection', 'Protects the part of sales that must replace stock before it is spent elsewhere.', ['reserve protection', 'stock seed']),
  actionArticle('action-write-check', 'Write Check', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Write Check', 'Prepares an A5 local check preview with payee, amount in words, account, and approval status.', ['check writer', 'payee']),
  actionArticle('action-payee-register', 'Payee Register', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Payee Register', 'Manages local payee records used by check writer workflows.', ['payee register']),
  actionArticle('action-journal-entry', 'Journal Entry', 'cash-bank-finance', 'FINANCIAL_CONTROL', 'Journal Entry', 'Prepares balanced debit and credit journal entry readiness records.', ['journal entry', 'balance check']),
  actionArticle('action-approval-start', 'Start Review', 'tasks-approvals', 'APPROVALS', 'Start Review', 'Moves an approval into review and assigns reviewer context.', ['start review', 'approval']),
  actionArticle('action-approve', 'Approve', 'tasks-approvals', 'APPROVALS', 'Approve', 'Records a local approval decision after risk and evidence have been checked.', ['approve', 'decision file']),
  actionArticle('action-reject', 'Reject', 'tasks-approvals', 'APPROVALS', 'Reject', 'Records a rejected decision with a reason so staff know what must change.', ['reject', 'approval']),
  actionArticle('action-request-info', 'Request Info', 'tasks-approvals', 'APPROVALS', 'Request Info', 'Asks the requester for more evidence before approving or rejecting.', ['request info']),
  actionArticle('action-notify', 'Notify', 'tasks-approvals', 'APPROVALS', 'Notify', 'Prepares local/mock in-app, staff inbox, WhatsApp link, email preview, or SMS preview notification.', ['notify', 'notification']),
  actionArticle('action-live-chat', 'Open Live Chat', 'tasks-approvals', 'APPROVALS', 'Open Live Chat', 'Opens the local approval room chat for decision discussion and evidence requests.', ['live chat', 'approval room']),
  actionArticle('action-close-task', 'Close Task', 'tasks-approvals', 'TASK_DESK', 'Close Task', 'Closes a task after the required work or review is complete.', ['close task']),
  actionArticle('action-escalate-task', 'Escalate Task', 'tasks-approvals', 'TASK_DESK', 'Escalate Task', 'Raises task priority when the current role cannot resolve it or risk is increasing.', ['escalate task']),
  actionArticle('action-eod-readiness', 'EOD Readiness', 'owner-closing', 'OWNER_DESK', 'EOD Readiness', 'Checks whether sales, cash, payments, inventory, delivery, BI, and accounting are ready for day close.', ['eod readiness']),
  actionArticle('action-cash-reconciliation', 'Cash Reconciliation', 'owner-closing', 'OWNER_DESK', 'Cash Reconciliation', 'Reviews expected versus actual cash and records variance actions.', ['cash reconciliation', 'variance']),
  actionArticle('action-payment-summary', 'Payment Summary', 'owner-closing', 'OWNER_DESK', 'Payment Summary', 'Reviews payment totals, channels, exceptions, and owner closing notes.', ['payment summary']),
  actionArticle('action-day-lock', 'Day Lock', 'owner-closing', 'OWNER_DESK', 'Day Lock', 'Final owner control step after operational exceptions have been reviewed.', ['day lock', 'closing'])
];

function narrativeArticle(articleId: string, title: string, groupId: string, summary: string, steps: string[], warnings: string[], tags: string[], relatedFunctions: HelpFunctionLink[]): HelpArticle {
  return article({
    articleId,
    title,
    chapter: 'Business Routine Guide',
    relationshipGroup: groupById[groupId],
    summary,
    bodySections: [
      { heading: 'Purpose', text: summary },
      { heading: 'How the modules work together', text: 'iTred is designed so sales, stock, cash, customers, suppliers, approvals, tasks, BI, and owner closing support each other. A good routine means each page leaves enough evidence for the next person to make a correct decision.' },
      { heading: 'Business result', text: 'The goal is not only to complete a screen. The goal is to protect cash, protect stock, protect customer/supplier relationships, and make the owner closing routine easier.' }
    ],
    steps,
    bestPractices: [
      'Work in the same order every day.',
      'Use notes and task routing for exceptions.',
      'Review warnings before they become losses.',
      'Use print/export only after checking filters and dates.'
    ],
    warnings,
    relatedMenus: relatedFunctions.map((item) => item.label),
    relatedFunctions,
    relatedArticles: [],
    tags,
    searchKeywords: [...tags, title],
    buildModeNote: 'Routine guidance is written for local/mock build-development workflows and will remain useful when services are connected later.'
  });
}

const narrativeArticles: HelpArticle[] = [
  narrativeArticle('routine-cashier-daily', 'Daily POS Routine for Cashier', 'sales-customer-flow', 'A cashier should open the shift, check the terminal, sell with correct product and customer details, receive payment carefully, and close with a clean drawer count.', ['Confirm active shift and terminal.', 'Search product and add to cart.', 'Select customer when needed.', 'Confirm payment method and complete sale.', 'Print or share receipt.', 'Report stock, price, or cash issues immediately.'], ['Do not sell before the shift is open.', 'Do not use generic customers for credit sales.'], ['daily cashier', 'sales routine'], [link('Open Sales Terminal', 'SALES', 'Start selling.'), link('Open Shift Control', 'SHIFT', 'Check shift state.')]),
  narrativeArticle('routine-owner-closing', 'Daily Owner Closing Routine', 'owner-closing', 'The owner should review sales, cash, payments, inventory, delivery, BI warnings, and accounting readiness before locking the day.', ['Open Owner Desk.', 'Review EOD readiness.', 'Review cash reconciliation.', 'Review payment summary.', 'Review inventory and delivery closing.', 'Resolve BI warnings or create tasks.', 'Proceed to day lock only when exceptions are explained.'], ['Do not close the day with unexplained cash or stock variance.'], ['owner closing', 'day lock'], [link('Open Owner Desk', 'OWNER_DESK', 'Review closing.'), link('Open Approvals', 'APPROVALS', 'Review decisions.')]),
  narrativeArticle('routine-cogs-reserve', 'How to Protect Stock Seed with COGS Reserve', 'cogs-reserve', 'COGS Reserve protects the replacement cost inside sales money so the business can buy stock again instead of spending stock seed on expenses.', ['Review reserve protection.', 'Check purchase discipline before buying.', 'Compare supplier commitments with reserve available.', 'Do not approve supplier payments that drain replacement seed unless owner accepts the risk.'], ['Cash in the drawer is not all profit.', 'Supplier payment pressure can damage future stock availability.'], ['cogs reserve', 'stock seed', 'supplier payment reserve'], [link('Open Purchase Discipline', 'PURCHASE_DISCIPLINE', 'Review buying pressure.'), link('Open Financial Control', 'FINANCIAL_CONTROL', 'Review reserve protection.')]),
  narrativeArticle('routine-customer-credit', 'How to Manage Customer Credit Safely', 'customers-debtors', 'Customer credit should increase sales only when limits, ageing, payment promises, and statements are controlled.', ['Register the customer correctly.', 'Check credit status and ageing before sale.', 'Record payments and promises.', 'Send reminders when due.', 'Block credit when risk becomes high.'], ['Do not extend credit to unknown customers.', 'Do not ignore old balances because a customer is buying today.'], ['customer credit', 'debtors', 'ageing'], [link('Open Customer Centre', 'CUSTOMER_CENTRE', 'Review customer credit.'), link('Open Sales Terminal', 'SALES', 'Use customer in sale.')]),
  narrativeArticle('routine-supplier-credit', 'How to Manage Supplier Credit Safely', 'purchasing-creditors', 'Supplier credit is controlled by bills, payments, returns, statements, and reserve capacity. Paying the wrong bill can hide true cash pressure.', ['Review supplier statement.', 'Match bills against GRN or invoice evidence.', 'Check reserve and cash plan.', 'Record payment allocation.', 'Follow up disputed or returned goods.'], ['Do not pay without matching outstanding bill evidence.', 'Do not pay from protected stock seed unless approved.'], ['supplier credit', 'creditors', 'supplier payment'], [link('Open Creditors', 'CREDITORS', 'Review supplier records.'), link('Open Purchase Discipline', 'PURCHASE_DISCIPLINE', 'Check buying risk.')]),
  narrativeArticle('routine-cashplan', 'How to Use CashPlan Without Confusing Cash and Profit', 'cash-bank-finance', 'CashPlan is a management forecast. It shows pressure and commitments, but cash balance is not the same as profit.', ['Review Money In and Money Out.', 'Check upcoming commitments.', 'Check COGS reserve.', 'Compare forecast with actual cash/bank position.', 'Use BI warnings for risks.'], ['Do not spend all visible cash.', 'Do not call sales cash profit before stock replacement, tax, supplier, and expense needs are known.'], ['cashplan', 'cash', 'profit'], [link('Open Financial Control', 'FINANCIAL_CONTROL', 'Review CashPlan.')]),
  narrativeArticle('routine-inventory-import', 'How to Avoid Bad Inventory Imports', 'stock-inventory-import', 'A good import protects product master quality by mapping columns, validating rows, checking duplicate risk, and requesting approval before posting.', ['Paste or select data.', 'Map required columns.', 'Validate warnings and errors.', 'Fix duplicate or missing-cost rows.', 'Submit for approval if needed.', 'Post only ready rows.'], ['Do not import unknown products with no cost.', 'Do not map supplier, tax, or quantity columns casually.'], ['inventory import', 'mapping', 'bad import'], [link('Open Inventory Import Wizard', 'STOCK', 'Open Product Import Desk.', 'Product Import Desk')]),
  narrativeArticle('routine-approvals', 'How to Handle Approvals Professionally', 'tasks-approvals', 'Approvals should be handled with evidence, reason, risk review, and a clear decision note.', ['Open the decision file.', 'Read reason and related record.', 'Start review.', 'Request info if evidence is weak.', 'Approve or reject with a note.', 'Notify staff when action is recorded.'], ['Do not approve based on verbal instruction only.', 'Do not reject without explaining what must change.'], ['approvals', 'decision file'], [link('Open Approvals', 'APPROVALS', 'Review approval queue.')]),
  narrativeArticle('routine-bi-warnings', 'How to Use BI Warnings', 'bi-risk-control', 'BI warnings are early risk signals. They help managers route tasks, request approval, and prevent losses before closing.', ['Open BI Desk.', 'Read source trigger.', 'Open related record.', 'Create task or approval if action is needed.', 'Resolve or dismiss only after review.'], ['Do not dismiss warnings to clean the screen.', 'Do not ignore repeated low-risk warnings.'], ['bi warnings', 'risk control'], [link('Open BI Desk', 'BI_DESK', 'Review BI warnings.'), link('Open Task Desk', 'TASK_DESK', 'Route action points.')]),
  narrativeArticle('routine-day-lock', 'How to Prepare for Day Lock', 'owner-closing', 'Day lock should happen only after sales, cash, payments, stock, delivery, BI, and accounting readiness are reviewed.', ['Finish all sales.', 'Close and count shifts.', 'Review cash and payment summaries.', 'Review inventory and delivery exceptions.', 'Resolve approvals and tasks.', 'Record owner notes.', 'Lock the day when records are explained.'], ['Do not lock before cash variance review.', 'Do not leave import, delivery, or approval exceptions unresolved.'], ['day lock', 'eod', 'owner'], [link('Open Owner Desk', 'OWNER_DESK', 'Prepare day lock.'), link('Open Cash Control', 'CASH', 'Review cash.')]),
  narrativeArticle('routine-build-mode', 'Understanding Build Development Mode', 'getting-started', 'Build-development mode uses local/mock services. It is designed to prove workflows before real business integrations are connected.', ['Use local workflows normally.', 'Read notices that say preview, placeholder, or local/mock.', 'Treat WhatsApp, email, SMS, and accounting posting as prepared previews unless the page says real service is connected.', 'Use Help Desk to learn intended operating discipline.'], ['Do not assume Firestore business data is connected.', 'Do not treat accounting readiness as final statutory posting.'], ['build development', 'local mock', 'firestore not connected'], [link('Open Help Desk', 'HELP_DESK', 'Read local guide.'), link('Open Settings', 'SETTINGS', 'Review settings.')])
];

export const helpArticles: HelpArticle[] = [...menuArticles, ...actionArticles, ...narrativeArticles].map((item) => ({
  ...item,
  relatedArticles: item.relatedArticles.length ? item.relatedArticles : []
}));

export const helpChapters = Array.from(new Set(helpArticles.map((article) => article.chapter)));
export const helpRelationshipGroupNames = helpRelationshipGroups.map((group) => group.groupName);
export const popularHelpArticleIds = [
  'routine-cashier-daily',
  'routine-owner-closing',
  'routine-cogs-reserve',
  'routine-inventory-import',
  'routine-approvals',
  'routine-build-mode'
];
