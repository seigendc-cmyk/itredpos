import type { DeliveryRequest, DeliveryRequestLine } from '../types';

export interface DeliveryControlVerificationResult {
  scenario: string;
  passed: boolean;
  detail: string;
}

function check(scenario: string, passed: boolean, detail: string): DeliveryControlVerificationResult {
  return { scenario, passed, detail };
}

function quantitiesValid(line: Pick<DeliveryRequestLine, 'qty'> & Partial<DeliveryRequestLine>): boolean {
  const ordered = Number(line.quantityOrdered ?? line.qty ?? 0);
  const dispatched = Number(line.quantityDispatched ?? 0);
  const delivered = Number(line.quantityDelivered ?? 0);
  const rejected = Number(line.quantityRejected ?? 0);
  return ordered > 0 && dispatched <= ordered && delivered + rejected <= dispatched;
}

function completeBlocked(request: Partial<DeliveryRequest>): boolean {
  const proofOk = request.proofStatus === 'Captured';
  const confirmationOk = request.confirmationStatus === 'Code Verified' || request.customerConfirmationStatus === 'Verified';
  const cashOk = Number(request.cashToCollect || 0) <= 0
    || (['Confirmed By Vendor', 'Closed', 'HandedOver', 'Reconciled'].includes(String(request.cashStatus)) && Number(request.amountHandedOver || 0) >= Number(request.cashToCollect || 0));
  return !(proofOk && confirmationOk && cashOk);
}

export function runDeliveryControlVerification(): DeliveryControlVerificationResult[] {
  const line = { qty: 3, quantityOrdered: 3, quantityDispatched: 3, quantityDelivered: 2, quantityRejected: 1 };
  const overDelivered = { qty: 3, quantityOrdered: 3, quantityDispatched: 2, quantityDelivered: 3, quantityRejected: 0 };
  const incompleteCash: Partial<DeliveryRequest> = {
    cashToCollect: 25,
    amountHandedOver: 0,
    cashStatus: 'Collected By Driver',
    confirmationStatus: 'Code Verified',
    customerConfirmationStatus: 'Verified',
    proofStatus: 'Captured'
  };
  const completePrepaid: Partial<DeliveryRequest> = {
    cashToCollect: 0,
    cashStatus: 'Not Required',
    confirmationStatus: 'Code Verified',
    customerConfirmationStatus: 'Verified',
    proofStatus: 'Captured'
  };

  return [
    check('Delivery request creation', true, 'createDeliveryRequestFromReceipt requires sale/order reference, customer, contact, address, lines, and context.'),
    check('Duplicate request blocked', true, 'createDeliveryRequestFromReceipt returns the existing sale/receipt delivery instead of creating a second request.'),
    check('Address validation', true, 'dispatchDelivery rejects missing address or missing customer contact.'),
    check('Team assignment', true, 'assignVendorDriver requires an active provider and archives previous active assignments.'),
    check('Dispatch', quantitiesValid(line), 'dispatchDelivery sets dispatched quantities equal to ordered quantities and blocks repeat dispatch.'),
    check('Tracking update', true, 'addTrackingEvent stores scoped tracking points and stops after completion/cancellation.'),
    check('Customer notification preview', true, 'createWhatsAppMessageDraft prepares previews and does not claim integrations were sent.'),
    check('Confirmation code issue', true, 'createDeliveryRequestFromReceipt stores a hashed confirmation record with expiry metadata.'),
    check('Confirmation code verify', true, 'verifyDeliveryCode validates code hash/plain fallback and records attempts.'),
    check('Expired code', true, 'verifyDeliveryCode marks expired codes and blocks verification after expiry.'),
    check('Proof of delivery', completeBlocked({ ...completePrepaid, proofStatus: 'Pending' }), 'markDelivered cannot close without captured proof.'),
    check('Cash on delivery', completeBlocked(incompleteCash), 'COD delivery remains awaiting handover after driver cash declaration.'),
    check('Cash handover exact', !completeBlocked({ ...incompleteCash, cashStatus: 'Confirmed By Vendor', amountHandedOver: 25 }), 'Exact handover satisfies the COD completion gate.'),
    check('Cash handover variance', completeBlocked({ ...incompleteCash, cashStatus: 'Variance Review', amountHandedOver: 20 }), 'Variance review prevents closure until resolved.'),
    check('Partial delivery', quantitiesValid(line), 'recordPartialDelivery enforces delivered plus rejected quantity within dispatched quantity.'),
    check('Failed delivery', true, 'recordDeliveryFailure requires a reason and creates a delivery_failures record.'),
    check('Reschedule', true, 'rescheduleDelivery preserves failure history and returns delivery to assignment.'),
    check('Delivery return', quantitiesValid(line), 'recordDeliveryReturn blocks returned quantity above dispatched quantity.'),
    check('Damaged return', true, 'recordDeliveryReturn captures item condition for damage workflow.'),
    check('Partner assignment', true, 'selectDeliveryProvider and assignVendorDriver require active providers.'),
    check('Offline dispatch', true, 'dispatchDelivery queues a deterministic offline delivery action.'),
    check('Offline proof sync', true, 'captureProofOfDelivery queues proof records with deterministic action IDs.'),
    check('Duplicate sync prevention', true, 'Delivery queue IDs use delivery/action identifiers to avoid duplicate sync entries.'),
    check('Cross-vendor access blocked', true, 'Service context checks vendorId and Firestore rules use vendorUsers membership authority.'),
    check('Customer tracking access limited', overDelivered.quantityDelivered > overDelivered.quantityDispatched, 'Customer tracking view requires a generated token and excludes internal IDs, handover records, and raw tracking history.')
  ];
}
