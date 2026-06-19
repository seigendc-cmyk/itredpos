import type {
  RelatedRecordLink,
  TaskSourceModule,
  WorkflowNotificationChannel,
  WorkflowNotificationRecord,
  WorkflowNotificationStatus
} from '../types';
import { createTask } from './taskService';
import { createRelatedRecordLink, getRelatedRecordLabel } from './workflowRoutingService';

const NOTIFICATIONS_KEY = 'itred_pos_workflow_notifications_v1';

const now = () => new Date().toISOString();
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function readNotifications(): WorkflowNotificationRecord[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkflowNotificationRecord[];
  } catch {
    return [];
  }
}

function saveNotifications(rows: WorkflowNotificationRecord[]): WorkflowNotificationRecord[] {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(rows));
  } catch {
    // Local notification previews remain usable for the current session if storage is blocked.
  }
  return rows;
}

function previewFor(channel: WorkflowNotificationChannel, title: string, message: string, address?: string): Pick<WorkflowNotificationRecord, 'previewBody' | 'previewAddress' | 'waLink'> {
  if (channel === 'WhatsAppPreview') {
    const body = `${title}\n\n${message}`;
    return {
      previewBody: body,
      previewAddress: address,
      waLink: address ? `https://wa.me/${address.replace(/\D/g, '')}?text=${encodeURIComponent(body)}` : undefined
    };
  }
  if (channel === 'EmailPreview') {
    return { previewBody: `Subject: ${title}\n\n${message}`, previewAddress: address };
  }
  if (channel === 'SMSPreview') {
    return { previewBody: `${title}: ${message}`.slice(0, 160), previewAddress: address };
  }
  return { previewBody: message, previewAddress: address };
}

export function getWorkflowNotifications(filters: {
  targetStaffId?: string;
  targetRole?: string;
  status?: WorkflowNotificationStatus | 'All';
  channel?: WorkflowNotificationChannel | 'All';
} = {}): WorkflowNotificationRecord[] {
  return readNotifications().filter((row) =>
    (!filters.targetStaffId || row.targetStaffId === filters.targetStaffId) &&
    (!filters.targetRole || row.targetRole === filters.targetRole) &&
    (!filters.status || filters.status === 'All' || row.status === filters.status) &&
    (!filters.channel || filters.channel === 'All' || row.channel === filters.channel)
  );
}

export function createWorkflowNotification(input: {
  targetStaffId?: string;
  targetRole?: string;
  sourceModule: string;
  relatedRecord: RelatedRecordLink;
  title: string;
  message: string;
  channel?: WorkflowNotificationChannel;
  previewAddress?: string;
}): WorkflowNotificationRecord[] {
  const channel = input.channel || 'InApp';
  const row: WorkflowNotificationRecord = {
    notificationId: makeId('WFN'),
    targetStaffId: input.targetStaffId,
    targetRole: input.targetRole,
    sourceModule: input.sourceModule,
    relatedRecord: createRelatedRecordLink(input.relatedRecord),
    title: input.title,
    message: input.message,
    channel,
    status: 'Unread',
    createdAt: now(),
    ...previewFor(channel, input.title, input.message, input.previewAddress)
  };
  return saveNotifications([row, ...readNotifications()].slice(0, 240));
}

export function markWorkflowNotificationRead(notificationId: string): WorkflowNotificationRecord[] {
  return saveNotifications(readNotifications().map((row) =>
    row.notificationId === notificationId ? { ...row, status: 'Read', readAt: now() } : row
  ));
}

export function dismissWorkflowNotification(notificationId: string): WorkflowNotificationRecord[] {
  return saveNotifications(readNotifications().map((row) =>
    row.notificationId === notificationId ? { ...row, status: 'Dismissed', dismissedAt: now() } : row
  ));
}

export async function createTaskFromWorkflowNotification(notificationId: string, staffName = 'Task Desk'): Promise<WorkflowNotificationRecord[]> {
  const rows = readNotifications();
  const notification = rows.find((row) => row.notificationId === notificationId);
  if (!notification) return rows;
  await createTask({
    title: notification.title,
    description: notification.message,
    relatedModule: notification.relatedRecord.module as TaskSourceModule,
    relatedRecordId: notification.relatedRecord.recordId,
    relatedRecordLabel: getRelatedRecordLabel(notification.relatedRecord),
    assignedStaffId: notification.targetStaffId || staffName.toUpperCase().replace(/\s+/g, '-'),
    assignedStaffName: notification.targetStaffId || staffName,
    createdBy: notification.sourceModule
  });
  return markWorkflowNotificationRead(notificationId);
}
