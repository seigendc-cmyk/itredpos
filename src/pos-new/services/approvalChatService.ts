import { ApprovalChatMessage, ApprovalChatMessageType } from '../types';
import { recordApprovalAuditEvent } from './approvalService';

const APPROVAL_CHAT_KEY = 'itred_pos_approval_chat_messages_v1';

function readMessages(): ApprovalChatMessage[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(APPROVAL_CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as ApprovalChatMessage[] : [];
  } catch {
    return [];
  }
}

function saveMessages(rows: ApprovalChatMessage[]): ApprovalChatMessage[] {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(APPROVAL_CHAT_KEY, JSON.stringify(rows));
  }
  return rows;
}

function makeId(): string {
  return `APR-CHAT-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getApprovalChatMessages(approvalId: string): ApprovalChatMessage[] {
  return readMessages()
    .filter((message) => message.approvalId === approvalId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function sendApprovalChatMessage(input: {
  approvalId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  messageType?: ApprovalChatMessageType;
}): Promise<ApprovalChatMessage[]> {
  const trimmed = input.message.trim();
  if (!trimmed) return getApprovalChatMessages(input.approvalId);
  const row: ApprovalChatMessage = {
    id: makeId(),
    approvalId: input.approvalId,
    senderId: input.senderId,
    senderName: input.senderName,
    senderRole: input.senderRole,
    message: trimmed,
    messageType: input.messageType || 'Text',
    createdAt: nowIso(),
    readByStaffIds: [input.senderId]
  };
  saveMessages([...readMessages(), row].slice(-300));
  await recordApprovalAuditEvent({
    approvalId: input.approvalId,
    eventType: 'APPROVAL_CHAT_MESSAGE_SENT',
    operator: input.senderName,
    message: `Chat message sent by ${input.senderName}.`
  });
  return getApprovalChatMessages(input.approvalId);
}

export async function createApprovalSystemMessage(
  approvalId: string,
  message: string,
  operator = 'System'
): Promise<ApprovalChatMessage[]> {
  return sendApprovalChatMessage({
    approvalId,
    senderId: 'system',
    senderName: operator,
    senderRole: 'System',
    message,
    messageType: 'System'
  });
}

export function markApprovalChatRead(approvalId: string, staffId: string): ApprovalChatMessage[] {
  const next = readMessages().map((message) => {
    if (message.approvalId !== approvalId) return message;
    const readBy = new Set(message.readByStaffIds || []);
    readBy.add(staffId);
    return { ...message, readByStaffIds: Array.from(readBy) };
  });
  saveMessages(next);
  return getApprovalChatMessages(approvalId);
}

export function getApprovalUnreadChatCount(approvalId: string, staffId: string): number {
  return readMessages().filter((message) => message.approvalId === approvalId && !(message.readByStaffIds || []).includes(staffId)).length;
}
