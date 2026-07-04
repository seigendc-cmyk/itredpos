import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { ApprovalChatMessage } from '../types';
import {
  getApprovalChatMessages,
  markApprovalChatRead,
  sendApprovalChatMessage
} from '../services/approvalChatService';

interface ApprovalLiveChatPanelProps {
  approvalId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  canSend: boolean;
  onActivity?: () => void;
}

const quickMessages = [
  'Please attach supporting evidence.',
  'I am reviewing this approval now.',
  'Decision recorded locally.',
  'Escalating for owner review.'
];

function timeLabel(value: string): string {
  return new Date(value).toLocaleString();
}

export default function ApprovalLiveChatPanel({
  approvalId,
  staffId,
  staffName,
  staffRole,
  canSend,
  onActivity
}: ApprovalLiveChatPanelProps) {
  const [messages, setMessages] = useState<ApprovalChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const loadMessages = () => {
    setMessages(markApprovalChatRead(approvalId, staffId));
  };

  useEffect(() => {
    loadMessages();
  }, [approvalId, staffId]);

  const handleSend = async (message = draft) => {
    if (!canSend || !message.trim()) return;
    const next = await sendApprovalChatMessage({
      approvalId,
      senderId: staffId,
      senderName: staffName,
      senderRole: staffRole,
      message
    });
    setMessages(next);
    setDraft('');
    onActivity?.();
  };

  return (
    <section className="sci-pos-card approval-chat-panel">
      <div className="sci-pos-card__bar">
        <div>
          <p className="sci-pos-eyebrow">Live Chat</p>
          <h3>Approval Room</h3>
        </div>
        <MessageSquare size={18} aria-hidden="true" />
      </div>
      <div className="approval-chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`approval-chat-message ${message.senderId === staffId ? 'approval-chat-message--own' : ''}`}>
            <strong>{message.senderName}</strong>
            <span>{message.message}</span>
            <small>{message.senderRole} • {timeLabel(message.createdAt)}</small>
          </div>
        ))}
        {messages.length === 0 && <div className="sci-pos-empty-cell">No chat messages yet.</div>}
      </div>
      <div className="approval-chat-quick">
        {quickMessages.map((message) => (
          <button key={message} type="button" className="pos-shift-tab" onClick={() => void handleSend(message)} disabled={!canSend}>
            {message}
          </button>
        ))}
      </div>
      <div className="approval-chat-compose">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write an approval message"
          disabled={!canSend}
        />
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void handleSend()} disabled={!canSend || !draft.trim()} title="Send chat message">
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
