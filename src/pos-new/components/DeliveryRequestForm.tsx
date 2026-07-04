import React, { useMemo, useState } from 'react';
import { Copy, Maximize2, Minimize2, Square, X } from 'lucide-react';
import {
  DeliveryActivityEvent,
  DeliveryCashCollection,
  DeliveryProvider,
  DeliveryRequest,
  DeliveryRequestLine,
  DeliveryTrackingEvent,
  DeliveryWhatsAppMessageDraft
} from '../types';
import { maskDeliveryCode } from '../utils/deliveryCodeUtils';

type DeliveryFormTab = 'Delivery Details' | 'Receipt Items' | 'Assignment' | 'Tracking' | 'Confirmation Code' | 'Cash Collection' | 'WhatsApp Drafts' | 'Activity';

interface DeliveryRequestFormProps {
  request: DeliveryRequest;
  lines: DeliveryRequestLine[];
  providers: DeliveryProvider[];
  trackingEvents: DeliveryTrackingEvent[];
  cashCollection?: DeliveryCashCollection;
  drafts: DeliveryWhatsAppMessageDraft[];
  activity: DeliveryActivityEvent[];
  canSeeFullCode: boolean;
  onClose: () => void;
  onBroadcast: () => void;
  onSelectProvider: (providerId: string) => void;
  onAssignDriver: (providerId: string) => void;
  onAccept: () => void;
  onPickedUp: () => void;
  onInTransit: () => void;
  onArrived: () => void;
  onVerifyCode: (code: string) => void;
  onMarkDelivered: () => void;
  onRecordFailure: (reason: string) => void;
  onCancel: (reason: string) => void;
  onCashCollected: (amount: number, notes: string) => void;
  onCashConfirmed: (amount: number, notes: string) => void;
  onPrepareMessage: (messageType: DeliveryWhatsAppMessageDraft['messageType']) => void;
  onExport: () => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function humanize(value: string): string {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function DeliveryRequestForm({
  request,
  lines,
  providers,
  trackingEvents,
  cashCollection,
  drafts,
  activity,
  canSeeFullCode,
  onClose,
  onBroadcast,
  onSelectProvider,
  onAssignDriver,
  onAccept,
  onPickedUp,
  onInTransit,
  onArrived,
  onVerifyCode,
  onMarkDelivered,
  onRecordFailure,
  onCancel,
  onCashCollected,
  onCashConfirmed,
  onPrepareMessage,
  onExport
}: DeliveryRequestFormProps) {
  const [activeTab, setActiveTab] = useState<DeliveryFormTab>('Delivery Details');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState(providers[0]?.providerId || '');
  const [enteredCode, setEnteredCode] = useState('');
  const [reason, setReason] = useState('');
  const [cashAmount, setCashAmount] = useState(String(request.cashToCollect || 0));
  const [cashNotes, setCashNotes] = useState('');

  const tabs: DeliveryFormTab[] = ['Delivery Details', 'Receipt Items', 'Assignment', 'Tracking', 'Confirmation Code', 'Cash Collection', 'WhatsApp Drafts', 'Activity'];
  const visibleCode = canSeeFullCode ? request.confirmationCode : maskDeliveryCode(request.confirmationCode);
  const selectedProvider = useMemo(() => providers.find((provider) => provider.providerId === selectedProviderId), [providers, selectedProviderId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/45 p-4 overflow-auto flex items-start justify-center">
      <div className={`bg-[#f4f6f8] border border-[#111827] shadow-xl rounded-none w-full ${isMaximized ? 'max-w-none min-h-[calc(100vh-2rem)]' : 'max-w-6xl'}`}>
        <div className="bg-[#252a31] text-white px-4 py-3 flex justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase text-orange-300 font-black">Delivery Fulfilment</div>
            <h2 className="text-lg font-black">{request.deliveryNumber}</h2>
            <div className="text-[10px] text-slate-200 font-semibold">Receipt delivery tracking, confirmation, and cash handover control.</div>
          </div>
          <div className="flex gap-2">
            <button type="button" title="Minimize" onClick={() => setIsMinimized(true)} className="p-2 border border-white/30 rounded-none"><Minimize2 className="w-4 h-4" /></button>
            <button type="button" title="Restore" onClick={() => setIsMinimized(false)} className="p-2 border border-white/30 rounded-none"><Square className="w-4 h-4" /></button>
            <button type="button" title="Maximize" onClick={() => setIsMaximized((value) => !value)} className="p-2 border border-white/30 rounded-none"><Maximize2 className="w-4 h-4" /></button>
            <button type="button" title="Close" onClick={onClose} className="p-2 border border-white/30 rounded-none"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {isMinimized ? (
          <div className="p-4 bg-white flex justify-between">
            <span className="text-xs font-black uppercase">{request.deliveryNumber} minimized</span>
            <button type="button" onClick={() => setIsMinimized(false)} className="px-3 py-2 bg-orange-600 text-white text-[10px] font-black uppercase rounded-none">Restore</button>
          </div>
        ) : (
          <>
            <div className="p-3 bg-orange-50 border-b border-orange-200 text-[10px] text-orange-950 font-bold uppercase">
              Delivery does not change posted sale totals, stock, cashbook, bank, supplier, customer, or final accounting journals in this build.
            </div>
            <div className="flex flex-wrap bg-white border-b border-[#b1b5c2]">
              {tabs.map((tab) => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-3 py-2 border-r border-[#b1b5c2] text-[9px] uppercase font-black rounded-none ${activeTab === tab ? 'bg-orange-600 text-white' : 'bg-white text-[#252a31]'}`}>{tab}</button>
              ))}
            </div>
            <div className="p-4 bg-[#f4f6f8] max-h-[68vh] overflow-y-auto pos-custom-scroll">
              {activeTab === 'Delivery Details' && (
                <div className="space-y-4">
                  <FieldGrid rows={[
                    ['Delivery Number', request.deliveryNumber], ['Receipt Number', request.receiptNumber], ['Customer Name', request.customerName], ['Phone', request.customerPhone], ['WhatsApp', request.customerWhatsapp], ['Delivery Method', request.deliveryMethod], ['Priority', request.priority], ['Address', request.deliveryAddress], ['Suburb', request.deliverySuburb || '-'], ['City / Town', request.deliveryCityTown || '-'], ['Delivery Fee', money(request.deliveryFee)], ['Receipt Total', money(request.totalReceiptAmount)], ['Delivery Status', request.deliveryStatus], ['Requested At', request.requestedAt]
                  ]} />
                  <Field label="Delivery Notes" value={request.deliveryNotes || '-'} />
                  <label className="block">
                    <span className="text-[9px] uppercase text-slate-500 font-black">Failure / Cancellation Reason</span>
                    <input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full border border-[#b1b5c2] p-2 text-xs rounded-none" placeholder="Required for failed or cancelled delivery" />
                  </label>
                  <ActionRow>
                    <Action label="Save Draft" onClick={() => window.alert(`${request.deliveryNumber} draft saved.`)} />
                    <Action label="Broadcast To iDeliver" onClick={onBroadcast} primary />
                    <Action label="Record Failure" onClick={() => onRecordFailure(reason || 'Failure reason captured from Delivery Fulfilment form.')} />
                    <Action label="Cancel Delivery" onClick={() => onCancel(reason || 'Cancelled from Delivery Fulfilment form.')} />
                    <Action label="Prepare Export" onClick={onExport} />
                  </ActionRow>
                </div>
              )}

              {activeTab === 'Receipt Items' && (
                <Table title="Receipt Items" headers={['SKU', 'Product', 'Qty', 'Receipt Line', 'Line Status', 'Notes']} rows={lines.map((line) => [line.sku, line.productName, line.qty, line.receiptLineId || '-', line.lineStatus, line.notes])} footer={<Action label="View Receipt / CAT Form" onClick={() => window.alert(`Receipt ${request.receiptNumber} opened in local preview.`)} />} />
              )}

              {activeTab === 'Assignment' && (
                <div className="space-y-4">
                  <FieldGrid rows={[
                    ['Provider Type', selectedProvider?.providerType || '-'], ['Provider Name', request.providerName || selectedProvider?.providerName || '-'], ['Driver Name', request.driverName || '-'], ['Driver Phone', request.driverPhone || selectedProvider?.phone || '-'], ['Vehicle / Bike Placeholder', selectedProvider?.vehiclePlaceholder || '-'], ['Assigned At', request.assignedAt || '-'], ['Accepted At', request.acceptedAt || '-']
                  ]} />
                  <label className="block">
                    <span className="text-[9px] uppercase text-slate-500 font-black">Provider</span>
                    <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)} className="mt-1 w-full border border-[#b1b5c2] p-2 text-xs rounded-none">
                      {providers.map((provider) => <option key={provider.providerId} value={provider.providerId}>{provider.providerName} - {provider.providerType}</option>)}
                    </select>
                  </label>
                  <ActionRow>
                    <Action label="Select Provider" onClick={() => onSelectProvider(selectedProviderId)} />
                    <Action label="Assign Vendor Driver" onClick={() => onAssignDriver(selectedProviderId)} primary />
                    <Action label="Driver Accepted" onClick={onAccept} />
                    <Action label="Reassign" onClick={() => onAssignDriver(selectedProviderId)} />
                    <Action label="Broadcast To iDeliver" onClick={onBroadcast} />
                  </ActionRow>
                </div>
              )}

              {activeTab === 'Tracking' && (
                <div className="space-y-4">
                  <div className="border border-orange-200 bg-orange-50 text-orange-950 p-3 text-[10px] font-bold uppercase">Google Maps live tracking integration will be connected later.</div>
                  <Table title="Tracking Events" headers={['Date / Time', 'Status', 'Location Text', 'Latitude', 'Longitude', 'Notes', 'Updated By']} rows={trackingEvents.map((event) => [event.dateTime, event.status, event.locationText, event.latitudePlaceholder || '-', event.longitudePlaceholder || '-', event.notes, event.updatedByStaffId])} />
                  <ActionRow>
                    <Action label="Add Tracking Event" onClick={onInTransit} />
                    <Action label="Open Map Preview" onClick={() => window.alert(`Map preview opened for ${request.deliveryNumber}.`)} />
                    <Action label="Mark Picked Up" onClick={onPickedUp} />
                    <Action label="Mark In Transit" onClick={onInTransit} />
                    <Action label="Mark Arrived" onClick={onArrived} />
                  </ActionRow>
                </div>
              )}

              {activeTab === 'Confirmation Code' && (
                <div className="space-y-4">
                  <FieldGrid rows={[
                    ['Confirmation Code Status', request.confirmationStatus], ['Code Sent To Customer', request.confirmationStatus === 'Code Sent' || request.confirmationStatus === 'Code Verified' ? 'Yes' : 'Pending'], ['Masked Code', visibleCode], ['Verification Attempts', String(request.verificationAttempts || 0)], ['Verified At', request.verifiedAt || '-'], ['Verified By', request.verifiedByStaffId || '-']
                  ]} />
                  <label className="block">
                    <span className="text-[9px] uppercase text-slate-500 font-black">Enter Delivery Code</span>
                    <input value={enteredCode} maxLength={6} onChange={(event) => setEnteredCode(event.target.value)} className="mt-1 w-full border border-[#b1b5c2] p-2 text-xs rounded-none tracking-widest font-black" />
                  </label>
                  <ActionRow>
                    <Action label="Generate Code" onClick={() => onPrepareMessage('Customer Code')} />
                    <Action label="Prepare Customer WhatsApp Code Message" onClick={() => onPrepareMessage('Customer Code')} />
                    <Action label="Verify Code" onClick={() => onVerifyCode(enteredCode)} primary />
                    <Action label="Mark Delivered" onClick={onMarkDelivered} />
                    <Action label="Manual Override" onClick={onMarkDelivered} />
                  </ActionRow>
                </div>
              )}

              {activeTab === 'Cash Collection' && (
                <div className="space-y-4">
                  <FieldGrid rows={[
                    ['Payment Mode', request.paymentMode], ['Cash To Collect', money(request.cashToCollect)], ['Delivery Fee Cash', money(request.paymentMode === 'Delivery Fee Cash' ? request.deliveryFee : 0)], ['Amount Collected By Driver', money(cashCollection?.amountCollectedByDriver || 0)], ['Vendor Cash Confirmed', cashCollection?.vendorCashConfirmed ? 'Yes' : 'No'], ['Vendor Confirmed Amount', money(cashCollection?.vendorConfirmedAmount || 0)], ['Cash Variance', money(cashCollection?.cashVariance || 0)], ['Cash Status', request.cashStatus]
                  ]} />
                  <input value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="w-full border border-[#b1b5c2] p-2 text-xs rounded-none" />
                  <textarea value={cashNotes} onChange={(event) => setCashNotes(event.target.value)} className="w-full border border-[#b1b5c2] p-2 text-xs rounded-none min-h-[58px]" placeholder="Driver or vendor cash notes" />
                  <ActionRow>
                    <Action label="Record Cash Collected By Driver" onClick={() => onCashCollected(Number(cashAmount) || 0, cashNotes)} />
                    <Action label="Confirm Cash Received By Vendor" onClick={() => onCashConfirmed(Number(cashAmount) || 0, cashNotes)} primary />
                    <Action label="Flag Cash Variance" onClick={() => onCashConfirmed(Number(cashAmount) || 0, cashNotes || 'Cash variance flagged.')} />
                    <Action label="Send To EOD Review" onClick={() => window.alert(`${request.deliveryNumber} sent to EOD review locally.`)} />
                  </ActionRow>
                </div>
              )}

              {activeTab === 'WhatsApp Drafts' && (
                <div className="space-y-4">
                  <ActionRow>
                    <Action label="Prepare Customer Message" onClick={() => onPrepareMessage('Customer Status')} />
                    <Action label="Prepare Driver Message" onClick={() => onPrepareMessage('Driver Assignment')} />
                    <Action label="Open WhatsApp Preview" onClick={() => onPrepareMessage('Customer Code')} />
                  </ActionRow>
                  <Table title="WhatsApp Drafts" headers={['Type', 'Recipient', 'Message', 'Status', 'Action']} rows={drafts.map((draft) => [draft.messageType, draft.recipient, draft.messageText, draft.status, <button key={draft.draftId} type="button" className="px-2 py-1 border border-[#b1b5c2] rounded-none text-[9px] font-black uppercase inline-flex items-center gap-1"><Copy className="w-3 h-3" /> Copy Message</button>])} />
                </div>
              )}

              {activeTab === 'Activity' && (
                <Table title="Delivery Activity" headers={['Date / Time', 'Event', 'User', 'Notes']} rows={activity.map((event) => [event.createdAt, humanize(event.eventType), event.staffId || '-', event.notes || event.message])} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FieldGrid({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return <div className="grid grid-cols-1 md:grid-cols-4 gap-3">{rows.map(([label, value]) => <Field key={label} label={label} value={value} />)}</div>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border border-[#d7dce5] bg-white p-3"><div className="text-[9px] uppercase text-slate-500 font-black">{label}</div><div className="text-xs text-[#1f2937] font-semibold mt-1 break-words">{value}</div></div>;
}

function ActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" onClick={onClick} className={`px-3 py-2 border text-[10px] font-black uppercase rounded-none ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#252a31]'}`}>{label}</button>;
}

function Table({ title, headers, rows, footer }: { title: string; headers: string[]; rows: Array<Array<React.ReactNode>>; footer?: React.ReactNode }) {
  return (
    <div className="border border-[#d7dce5] bg-white overflow-auto">
      <div className="bg-[#252a31] text-white px-3 py-2 text-[10px] font-black uppercase">{title}</div>
      <table className="w-full text-xs">
        <thead><tr>{headers.map((header) => <th key={header} className="p-2 text-left text-[9px] uppercase font-black bg-slate-100">{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#e5e7eb]">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-2 text-[#252a31] align-top">{cell}</td>)}</tr>)}</tbody>
      </table>
      {footer && <div className="p-3 border-t border-[#d7dce5]">{footer}</div>}
    </div>
  );
}
