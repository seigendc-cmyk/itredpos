import { DeliveryRequest } from '../types';

export function generateDeliveryConfirmationCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function maskDeliveryCode(code: string): string {
  if (!code) return '------';
  return `${code.slice(0, 2)}**${code.slice(-2)}`;
}

export function verifyDeliveryConfirmationCode(expectedCode: string, enteredCode: string): boolean {
  return expectedCode.trim() === enteredCode.trim();
}

export function createDeliveryMessageText(payload: Pick<DeliveryRequest, 'customerName' | 'receiptNumber' | 'confirmationCode' | 'deliveryStatus'> & { messageType?: 'code' | 'status' }): string {
  if (payload.messageType === 'status') {
    return `Hello ${payload.customerName}, your order ${payload.receiptNumber} is now ${payload.deliveryStatus}. Thank you for buying from us.`;
  }
  return `Hello ${payload.customerName}, your order ${payload.receiptNumber} is ready for delivery. Your delivery confirmation code is ${payload.confirmationCode}. Please give this code to the delivery person only after receiving your goods.`;
}

export function createDriverMessageText(payload: Pick<DeliveryRequest, 'deliveryNumber' | 'customerName' | 'deliveryAddress' | 'receiptNumber' | 'cashToCollect'>): string {
  return `Delivery assigned: ${payload.deliveryNumber}. Customer: ${payload.customerName}. Address: ${payload.deliveryAddress}. Receipt: ${payload.receiptNumber}. Cash to collect: ${payload.cashToCollect}.`;
}
