import { ApprovalNotificationChannel, ApprovalNotificationRecord, OperationalApprovalRequest } from '../types';
import { recordApprovalAuditEvent } from './approvalService';

const APPROVAL_NOTIFICATION_KEY = 'itred_pos_approval_notifications_v1';

function readNotifications(): ApprovalNotificationRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(APPROVAL_NOTIFICATION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ApprovalNotificationRecord[] : [];
  } catch {
    return [];
  }
}

function saveNotifications(rows: ApprovalNotificationRecord[]): ApprovalNotificationRecord[] {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(APPROVAL_NOTIFICATION_KEY, JSON.stringify(rows));
  }
  return rows;
}

function makeId(): string {
  return `APR-NOT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanPhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

export function prepareWhatsAppApprovalMessage(approval: OperationalApprovalRequest, recipientName: string): { body: string; waLink: string } {
  const body = `Approval ${approval.id}: ${approval.title || approval.category} is ${approval.status}. Related record: ${approval.relatedRecordLabel || approval.relatedRecord}. Risk: ${approval.risk}.`;
  return {
    body,
    waLink: `https://wa.me/${cleanPhone(recipientName)}?text=${encodeURIComponent(body)}`
  };
}

export function prepareEmailApprovalPreview(approval: OperationalApprovalRequest, recipientName: string): { subject: string; body: string } {
  return {
    subject: `Approval ${approval.id} - ${approval.title || approval.category}`,
    body: [
      `Hello ${recipientName || 'team'},`,
      '',
      `Approval ${approval.id} requires attention.`,
      `Type: ${approval.title || approval.category}`,
      `Related record: ${approval.relatedRecordLabel || approval.relatedRecord}`,
      `Risk: ${approval.risk}`,
      `Status: ${approval.status}`,
      `Context: ${approval.context}`
    ].join('\n')
  };
}

export async function prepareApprovalNotification(input: {
  approval: OperationalApprovalRequest;
  channel: ApprovalNotificationChannel;
  recipientName: string;
  recipientAddress: string;
  preparedBy: string;
}): Promise<ApprovalNotificationRecord[]> {
  const emailPreview = prepareEmailApprovalPreview(input.approval, input.recipientName);
  const whatsapp = input.channel === 'WhatsAppLink' ? prepareWhatsAppApprovalMessage(input.approval, input.recipientAddress) : null;
  const row: ApprovalNotificationRecord = {
    id: makeId(),
    approvalId: input.approval.id,
    channel: input.channel,
    recipientName: input.recipientName,
    recipientAddress: input.recipientAddress,
    subject: emailPreview.subject,
    body: whatsapp?.body || emailPreview.body,
    status: 'Prepared',
    preparedBy: input.preparedBy,
    preparedAt: nowIso(),
    waLink: whatsapp?.waLink
  };
  const next = saveNotifications([row, ...readNotifications()].slice(0, 120));
  await recordApprovalAuditEvent({
    approvalId: input.approval.id,
    eventType: 'APPROVAL_NOTIFICATION_PREPARED',
    operator: input.preparedBy,
    message: `${input.channel} notification prepared for ${input.recipientName}.`
  });
  return next;
}

export async function sendApprovalNotificationLocal(notificationId: string, operator: string): Promise<ApprovalNotificationRecord[]> {
  const next = readNotifications().map((item) => item.id === notificationId ? { ...item, status: 'SentLocal' as const, sentAt: nowIso() } : item);
  const sent = next.find((item) => item.id === notificationId);
  saveNotifications(next);
  if (sent) {
    await recordApprovalAuditEvent({
      approvalId: sent.approvalId,
      eventType: 'APPROVAL_NOTIFICATION_SENT_LOCAL',
      operator,
      message: `${sent.channel} notification marked sent locally for ${sent.recipientName}.`
    });
  }
  return next;
}

export async function createInAppApprovalNotification(input: {
  approval: OperationalApprovalRequest;
  recipientName: string;
  preparedBy: string;
  body: string;
}): Promise<ApprovalNotificationRecord[]> {
  const rows = await prepareApprovalNotification({
    approval: input.approval,
    channel: 'InApp',
    recipientName: input.recipientName,
    recipientAddress: input.recipientName,
    preparedBy: input.preparedBy
  });
  return saveNotifications(rows.map((row, index) => index === 0 ? { ...row, body: input.body || row.body } : row));
}

export function getApprovalNotifications(approvalId?: string): ApprovalNotificationRecord[] {
  const rows = readNotifications();
  return approvalId ? rows.filter((row) => row.approvalId === approvalId) : rows;
}

export function getApprovalNotificationOutbox(): ApprovalNotificationRecord[] {
  return readNotifications();
}

export function markApprovalNotificationRead(notificationId: string): ApprovalNotificationRecord[] {
  return saveNotifications(readNotifications().map((item) => item.id === notificationId ? { ...item, status: 'Read', readAt: nowIso() } : item));
}
