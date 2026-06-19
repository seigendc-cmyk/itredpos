import type { OperationalApprovalRequest, PosPageId, PosSession, RelatedRecordLink, TaskRecord } from '../types';

export interface RelatedRecordRoute {
  canOpen: boolean;
  targetPage?: PosPageId;
  targetTab?: string;
  targetAction?: string;
  label: string;
  notice: string;
}

export interface RelatedRecordNavigationContext {
  navigate?: (page: PosPageId) => void;
  setNotice?: (message: string) => void;
  currentStaff?: PosSession;
}

const now = () => new Date().toISOString();

const modulePageMap: Record<string, PosPageId> = {
  'customer centre': 'CUSTOMER_CENTRE',
  'customer approval': 'CUSTOMER_CENTRE',
  debtors: 'CUSTOMER_CENTRE',
  'sales terminal': 'SALES',
  sales: 'SALES',
  'sales history': 'SALES_HISTORY',
  inventory: 'STOCK',
  'stocktake desk': 'STOCK',
  stocktake: 'STOCK',
  'purchase order': 'STOCK',
  'goods receiving': 'STOCK',
  grn: 'STOCK',
  'supplier return': 'STOCK',
  'purchase discipline': 'PURCHASE_DISCIPLINE',
  creditors: 'CREDITORS',
  'cash control': 'CASH',
  cash: 'CASH',
  'financial control': 'FINANCIAL_CONTROL',
  'accounting desk': 'FINANCIAL_CONTROL',
  'cogs reserve': 'FINANCIAL_CONTROL',
  'owner desk': 'OWNER_DESK',
  'task desk': 'TASK_DESK',
  approvals: 'APPROVALS',
  'bi desk': 'BI_DESK',
  'delivery desk': 'DELIVERY',
  delivery: 'DELIVERY',
  settings: 'SETTINGS',
  'sync desk': 'SYNC_DESK',
  'help desk': 'HELP_DESK'
};

function normalizeModule(module?: string): string {
  return (module || '').trim().toLowerCase();
}

function routePageFor(module?: string): PosPageId | undefined {
  return modulePageMap[normalizeModule(module)];
}

function isTaskRecord(record: unknown): record is TaskRecord {
  return Boolean(record && typeof record === 'object' && 'taskId' in record && 'relatedModule' in record);
}

function isApprovalRecord(record: unknown): record is OperationalApprovalRequest {
  return Boolean(record && typeof record === 'object' && 'id' in record && 'category' in record && 'relatedModule' in record);
}

export function createRelatedRecordLink(record: RelatedRecordLink | TaskRecord | OperationalApprovalRequest): RelatedRecordLink {
  if (isTaskRecord(record)) {
    return {
      module: record.relatedModule,
      recordType: record.relatedModule,
      recordId: record.relatedRecordId,
      recordNumber: record.relatedRecordLabel,
      label: record.relatedRecordLabel,
      title: record.title,
      description: record.description,
      sourceModule: 'Task Desk',
      sourceRecordId: record.taskId,
      targetPage: routePageFor(record.relatedModule),
      createdAt: record.createdAt || now()
    };
  }

  if (isApprovalRecord(record)) {
    const module = record.relatedModule || record.category || 'Approvals';
    const recordId = record.relatedRecordId || record.relatedRecord || record.id;
    return {
      module,
      recordType: record.category || record.approvalType || 'Approval',
      recordId,
      recordNumber: record.relatedRecordLabel || record.relatedRecord || recordId,
      label: record.relatedRecordLabel || record.relatedRecord || record.title || record.id,
      title: record.title || record.category || record.approvalType,
      description: record.context || record.reason,
      sourceModule: 'Approvals',
      sourceRecordId: record.id,
      targetPage: routePageFor(module),
      createdAt: record.createdAt || now()
    };
  }

  return {
    ...record,
    targetPage: record.targetPage || routePageFor(String(record.module)),
    createdAt: record.createdAt || now()
  };
}

export function getRelatedRecordLabel(relatedRecord: RelatedRecordLink | TaskRecord | OperationalApprovalRequest): string {
  const link = createRelatedRecordLink(relatedRecord);
  return link.label || link.recordNumber || link.title || link.recordId || 'Related record';
}

export function createFallbackRelatedRecordNotice(relatedRecord: RelatedRecordLink | TaskRecord | OperationalApprovalRequest): string {
  const link = createRelatedRecordLink(relatedRecord);
  return `${getRelatedRecordLabel(link)} is linked to ${link.module}. No direct local route is available, so use the source desk search to open the record.`;
}

export function resolveRelatedRecordRoute(relatedRecord: RelatedRecordLink | TaskRecord | OperationalApprovalRequest): RelatedRecordRoute {
  const link = createRelatedRecordLink(relatedRecord);
  const targetPage = link.targetPage || routePageFor(String(link.module));
  const label = getRelatedRecordLabel(link);
  if (!targetPage) {
    return {
      canOpen: false,
      label,
      notice: createFallbackRelatedRecordNotice(link)
    };
  }
  return {
    canOpen: true,
    targetPage,
    targetTab: link.targetTab,
    targetAction: link.targetAction,
    label,
    notice: `${label} opened in ${link.module}.`
  };
}

export function canOpenRelatedRecord(relatedRecord: RelatedRecordLink | TaskRecord | OperationalApprovalRequest, currentStaff?: PosSession): boolean {
  void currentStaff;
  return resolveRelatedRecordRoute(relatedRecord).canOpen;
}

export function openRelatedRecord(
  relatedRecord: RelatedRecordLink | TaskRecord | OperationalApprovalRequest,
  navigationContext: RelatedRecordNavigationContext = {}
): RelatedRecordRoute {
  const route = resolveRelatedRecordRoute(relatedRecord);
  if (!route.canOpen || !route.targetPage || !navigationContext.navigate) {
    navigationContext.setNotice?.(route.notice);
    return route;
  }
  navigationContext.navigate(route.targetPage);
  navigationContext.setNotice?.(route.notice);
  return route;
}
