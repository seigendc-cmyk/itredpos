import { PaymentReceiptRow, PaymentReportEventType } from '../types/posTypes';
import { mockPaymentReceiptRows } from '../mock/mockPosData';

export async function getPaymentReceiptRows(): Promise<PaymentReceiptRow[]> {
  return mockPaymentReceiptRows;
}

export async function recordPaymentReportEvent(eventType: PaymentReportEventType, operator: string): Promise<void> {
  const existing = localStorage.getItem('sci_pos_payment_report_events');
  const events = existing ? JSON.parse(existing) as Array<{ id: string; eventType: PaymentReportEventType; operator: string; createdAt: string }> : [];
  events.unshift({
    id: `PAY-EV-${Math.floor(10000 + Math.random() * 90000)}`,
    eventType,
    operator,
    createdAt: new Date().toISOString()
  });
  localStorage.setItem('sci_pos_payment_report_events', JSON.stringify(events.slice(0, 40)));
}
