import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, MessageSquare, Search, Truck } from 'lucide-react';
import DeliveryRequestForm from '../components/DeliveryRequestForm';
import {
  DeliveryActivityEvent,
  DeliveryCashCollection,
  DeliveryFilterState,
  DeliveryProvider,
  DeliveryRequest,
  DeliveryRequestLine,
  DeliverySummary,
  DeliveryTrackingEvent,
  DeliveryWhatsAppMessageDraft,
  PosSession,
  Role
} from '../types';
import {
  acceptDelivery,
  addTrackingEvent,
  assignVendorDriver,
  broadcastToIDeliver,
  cancelDelivery,
  confirmDeliveryCashReceived,
  createWhatsAppMessageDraft,
  exportDeliveryPlaceholder,
  getDeliveryActivityEvents,
  getDeliveryCashCollection,
  getDeliveryProviders,
  getDeliveryRequestLines,
  getDeliveryRequests,
  getDeliverySummary,
  getDeliveryTrackingEvents,
  getDeliveryWhatsAppMessageDrafts,
  markArrived,
  markDelivered,
  markPickedUp,
  recordCashCollectedByDriver,
  recordDeliveryFailure,
  selectDeliveryProvider,
  verifyDeliveryCode
} from '../services/deliveryService';
import { canPerformAction } from '../utils/posPermissions';

interface PosDeliveryDeskProps {
  session?: PosSession;
}

type DeliveryTab = 'Delivery Queue' | 'iDeliver Broadcasts' | 'Vendor Deliveries' | 'Tracking' | 'Cash Collection' | 'Failed / Returned' | 'Providers' | 'Delivery Activity';

const tabs: DeliveryTab[] = ['Delivery Queue', 'iDeliver Broadcasts', 'Vendor Deliveries', 'Tracking', 'Cash Collection', 'Failed / Returned', 'Providers', 'Delivery Activity'];

const emptySummary: DeliverySummary = {
  pendingAssignment: 0,
  broadcastToIDeliver: 0,
  assigned: 0,
  inTransit: 0,
  deliveredToday: 0,
  failedDeliveries: 0,
  cashPendingReview: 0,
  codeVerificationPending: 0,
  returnedToVendor: 0,
  urgentDeliveries: 0
};

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function humanize(value: string): string {
  return value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function PosDeliveryDesk({ session }: PosDeliveryDeskProps) {
  const role = (session?.role || 'Owner') as Role;
  const staffId = session?.staffName || 'Admin User';
  const [activeTab, setActiveTab] = useState<DeliveryTab>('Delivery Queue');
  const [filters, setFilters] = useState<DeliveryFilterState>({ deliveryMethod: 'ALL', deliveryStatus: 'ALL', cashStatus: 'ALL', confirmationStatus: 'ALL', priority: 'ALL' });
  const [requests, setRequests] = useState<DeliveryRequest[]>([]);
  const [summary, setSummary] = useState<DeliverySummary>(emptySummary);
  const [providers, setProviders] = useState<DeliveryProvider[]>([]);
  const [activity, setActivity] = useState<DeliveryActivityEvent[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DeliveryRequest | null>(null);
  const [selectedLines, setSelectedLines] = useState<DeliveryRequestLine[]>([]);
  const [selectedTracking, setSelectedTracking] = useState<DeliveryTrackingEvent[]>([]);
  const [selectedCash, setSelectedCash] = useState<DeliveryCashCollection | undefined>();
  const [selectedDrafts, setSelectedDrafts] = useState<DeliveryWhatsAppMessageDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const [nextRequests, nextSummary, nextProviders, nextActivity] = await Promise.all([
      getDeliveryRequests(filters),
      getDeliverySummary(filters),
      getDeliveryProviders(),
      getDeliveryActivityEvents(filters)
    ]);
    setRequests(nextRequests);
    setSummary(nextSummary);
    setProviders(nextProviders);
    setActivity(nextActivity);
  };

  useEffect(() => {
    void load();
  }, [filters]);

  const show = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 5000);
  };

  const allowed = (permission: Parameters<typeof canPerformAction>[1]) => {
    if (!canPerformAction(role, permission)) {
      show('You do not have permission to perform this action.');
      return false;
    }
    return true;
  };

  const openRequest = async (request: DeliveryRequest) => {
    if (!allowed('delivery.view')) return;
    const [lines, tracking, cash, drafts] = await Promise.all([
      getDeliveryRequestLines(request.deliveryId),
      getDeliveryTrackingEvents(request.deliveryId),
      getDeliveryCashCollection(request.deliveryId),
      getDeliveryWhatsAppMessageDrafts(request.deliveryId)
    ]);
    setSelectedRequest(request);
    setSelectedLines(lines);
    setSelectedTracking(tracking);
    setSelectedCash(cash);
    setSelectedDrafts(drafts);
  };

  const refreshSelected = async (deliveryId = selectedRequest?.deliveryId) => {
    await load();
    if (!deliveryId) return;
    const next = (await getDeliveryRequests({})).find((row) => row.deliveryId === deliveryId);
    if (next) await openRequest(next);
  };

  const visibleRequests = useMemo(() => {
    if (activeTab === 'iDeliver Broadcasts') return requests.filter((row) => row.deliveryMethod === 'iDeliver Service');
    if (activeTab === 'Vendor Deliveries') return requests.filter((row) => row.deliveryMethod === 'Vendor Delivery');
    if (activeTab === 'Tracking') return requests.filter((row) => ['Picked Up', 'In Transit', 'Arrived'].includes(row.deliveryStatus));
    if (activeTab === 'Cash Collection') return requests.filter((row) => row.cashStatus !== 'Not Required');
    if (activeTab === 'Failed / Returned') return requests.filter((row) => ['Delivery Failed', 'Returned To Vendor', 'Cancelled'].includes(row.deliveryStatus));
    return requests.filter((row) => row.deliveryMethod !== 'No Delivery' && row.deliveryMethod !== 'Customer Collection');
  }, [activeTab, requests]);

  const runAction = async (permission: Parameters<typeof canPerformAction>[1], action: () => Promise<void>, message: string) => {
    if (!allowed(permission)) return;
    await action();
    await refreshSelected();
    show(message);
  };

  return (
    <div className="space-y-5 text-xs industrial-font-sans">
      <div className="bg-white border border-[#b1b5c2] p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div>
          <div className="text-[10px] text-orange-600 font-black uppercase tracking-wider flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Delivery Desk
          </div>
          <h1 className="text-xl font-black text-[#1e222b] uppercase mt-1">Delivery Desk</h1>
          <p className="text-[11px] text-slate-600 font-bold uppercase mt-1">POS delivery fulfilment, iDeliver requests, tracking, confirmation codes, and cash handover review.</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 text-orange-900 p-2 text-[10px] font-bold uppercase max-w-xl">
          Delivery is linked to completed receipts only. Completion does not change stock, receipt totals, cashbook, bank, or accounting journals.
        </div>
      </div>

      {notice && <div className="bg-orange-50 border border-orange-300 text-orange-900 px-3 py-2 font-bold uppercase">{notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
        {[
          ['Pending Assignment', summary.pendingAssignment],
          ['Broadcast To iDeliver', summary.broadcastToIDeliver],
          ['Assigned', summary.assigned],
          ['In Transit', summary.inTransit],
          ['Delivered Today', summary.deliveredToday],
          ['Failed Deliveries', summary.failedDeliveries],
          ['Cash Pending Review', summary.cashPendingReview],
          ['Code Verification Pending', summary.codeVerificationPending],
          ['Returned To Vendor', summary.returnedToVendor],
          ['Urgent Deliveries', summary.urgentDeliveries]
        ].map(([label, value]) => <Metric key={label} label={String(label)} value={String(value)} />)}
      </div>

      <div className="industrial-toolbar">
        {tabs.map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`industrial-tab ${activeTab === tab ? 'active' : ''}`}>{tab}</button>
        ))}
      </div>

      <div className="bg-white border border-[#b1b5c2] p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <FilterInput label="Delivery Number" value={filters.deliveryNumber || ''} onChange={(value) => setFilters({ ...filters, deliveryNumber: value })} />
          <FilterInput label="Receipt Number" value={filters.receiptNumber || ''} onChange={(value) => setFilters({ ...filters, receiptNumber: value })} />
          <FilterInput label="Customer" value={filters.customer || ''} onChange={(value) => setFilters({ ...filters, customer: value })} />
          <FilterInput label="Phone / WhatsApp" value={filters.phone || ''} onChange={(value) => setFilters({ ...filters, phone: value })} />
          <FilterSelect label="Delivery Method" value={filters.deliveryMethod || 'ALL'} options={['ALL', 'No Delivery', 'Customer Collection', 'Vendor Delivery', 'iDeliver Service']} onChange={(value) => setFilters({ ...filters, deliveryMethod: value as DeliveryFilterState['deliveryMethod'] })} />
          <FilterSelect label="Delivery Status" value={filters.deliveryStatus || 'ALL'} options={['ALL', 'Pending Assignment', 'Broadcast To iDeliver', 'Provider Selected', 'Assigned', 'Accepted By Driver', 'Picked Up', 'In Transit', 'Arrived', 'Delivered', 'Delivery Failed', 'Cancelled', 'Returned To Vendor', 'Cash Pending Review', 'Closed']} onChange={(value) => setFilters({ ...filters, deliveryStatus: value as DeliveryFilterState['deliveryStatus'] })} />
          <FilterInput label="Provider" value={filters.provider || ''} onChange={(value) => setFilters({ ...filters, provider: value })} />
          <FilterInput label="Driver" value={filters.driver || ''} onChange={(value) => setFilters({ ...filters, driver: value })} />
          <FilterSelect label="Cash Status" value={filters.cashStatus || 'ALL'} options={['ALL', 'Not Required', 'Pending Collection', 'Collected By Driver', 'Confirmed By Vendor', 'Variance Review', 'Missing Cash', 'Closed']} onChange={(value) => setFilters({ ...filters, cashStatus: value as DeliveryFilterState['cashStatus'] })} />
          <FilterSelect label="Code Status" value={filters.confirmationStatus || 'ALL'} options={['ALL', 'Code Pending', 'Code Sent', 'Code Verified', 'Code Failed', 'Manual Override Required']} onChange={(value) => setFilters({ ...filters, confirmationStatus: value as DeliveryFilterState['confirmationStatus'] })} />
          <FilterInput label="Date From" value={filters.dateFrom || ''} onChange={(value) => setFilters({ ...filters, dateFrom: value })} type="date" />
          <FilterInput label="Date To" value={filters.dateTo || ''} onChange={(value) => setFilters({ ...filters, dateTo: value })} type="date" />
          <FilterSelect label="Priority" value={filters.priority || 'ALL'} options={['ALL', 'Normal', 'High', 'Urgent']} onChange={(value) => setFilters({ ...filters, priority: value as DeliveryFilterState['priority'] })} />
          <button type="button" onClick={() => runAction('delivery.export', async () => { await exportDeliveryPlaceholder(filters); }, 'Delivery export prepared.')} className="px-3 py-2 bg-orange-600 text-white border border-orange-700 font-black uppercase text-[9px] rounded-none self-end flex items-center gap-2"><Download className="w-4 h-4" /> Prepare Export</button>
        </div>
      </div>

      {activeTab === 'Providers' ? (
        <Panel title="Delivery Providers">
          <Table headers={['Provider ID', 'Provider Name', 'Provider Type', 'Phone', 'Vehicle / Bike', 'Active', 'Rating', 'Completed', 'Failed', 'Cash Variance', 'Action']}>
            {providers.map((provider) => (
              <tr key={provider.providerId} className="border-t border-[#d6d9e0]">
                <Td strong>{provider.providerId}</Td><Td>{provider.providerName}</Td><Td>{provider.providerType}</Td><Td>{provider.phone}</Td><Td>{provider.vehiclePlaceholder}</Td><Td>{provider.active ? 'Active' : 'Inactive'}</Td><Td>{provider.ratingPlaceholder}</Td><Td>{provider.completedDeliveries}</Td><Td>{provider.failedDeliveries}</Td><Td>{provider.cashVarianceCount}</Td>
                <Td><ActionButton label="View Provider Detail" onClick={() => show('Provider detail opened.')} /></Td>
              </tr>
            ))}
            {providers.length === 0 && <EmptyTableRow colSpan={11} label="No delivery providers captured yet." />}
          </Table>
          <button type="button" onClick={() => show('Add provider form opened.')} className="mt-3 px-3 py-2 bg-orange-600 text-white font-black uppercase text-[9px]">Add Provider</button>
        </Panel>
      ) : activeTab === 'Delivery Activity' ? (
        <Panel title="Delivery Activity">
          <Table headers={['Date / Time', 'Event', 'Delivery', 'Receipt', 'User', 'Notes']}>
            {activity.map((event) => <tr key={event.id} className="border-t border-[#d6d9e0]"><Td>{event.createdAt}</Td><Td strong>{humanize(event.eventType)}</Td><Td>{event.deliveryNumber || '-'}</Td><Td>{event.receiptNumber || '-'}</Td><Td>{event.staffId || '-'}</Td><Td>{event.notes || event.message}</Td></tr>)}
            {activity.length === 0 && <EmptyTableRow colSpan={6} label="No delivery activity recorded yet." />}
          </Table>
        </Panel>
      ) : (
        <Panel title={activeTab}>
          <Table headers={['Delivery No.', 'Receipt No.', 'Customer', 'Phone', 'Method', 'Address', 'Provider / Driver', 'Fee', 'Cash To Collect', 'Delivery Status', 'Cash Status', 'Code Status', 'Requested At', 'Action']}>
            {visibleRequests.map((request) => (
              <tr key={request.deliveryId} className="border-t border-[#d6d9e0] hover:bg-slate-50" onDoubleClick={() => void openRequest(request)}>
                <Td strong>{request.deliveryNumber}</Td>
                <Td>{request.receiptNumber}</Td>
                <Td>{request.customerName}</Td>
                <Td>{request.customerPhone || request.customerWhatsapp}</Td>
                <Td>{request.deliveryMethod}</Td>
                <Td>{request.deliveryAddress}</Td>
                <Td>{request.providerName || request.driverName || 'Pending'}</Td>
                <Td>{money(request.deliveryFee)}</Td>
                <Td>{money(request.cashToCollect)}</Td>
                <Td><Badge value={request.deliveryStatus} /></Td>
                <Td><Badge value={request.cashStatus} /></Td>
                <Td><Badge value={request.confirmationStatus} /></Td>
                <Td>{request.requestedAt.replace('T', ' ').replace('Z', '')}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <ActionButton label="View" onClick={() => void openRequest(request)} />
                    <ActionButton label="Broadcast To iDeliver" onClick={() => runAction('delivery.broadcast', async () => { await broadcastToIDeliver(request.deliveryId, staffId); }, 'iDeliver broadcast prepared.')} />
                    <ActionButton label="Assign Driver" onClick={() => runAction('delivery.assign', async () => { await assignVendorDriver(request.deliveryId, providers[0]?.providerId || 'DPROV-001', staffId); }, 'Vendor driver assigned.')} />
                    <ActionButton label="Track" onClick={() => runAction('delivery.track', async () => { await addTrackingEvent(request.deliveryId, { status: 'En Route', locationText: 'Tracking update', notes: 'Tracking update recorded.', updatedByStaffId: staffId }); }, 'Tracking update added.')} />
                    <ActionButton label="Cancel" onClick={() => runAction('delivery.cancel', async () => { await cancelDelivery(request.deliveryId, staffId, 'Cancelled from Delivery Queue.'); }, 'Delivery cancelled.')} />
                  </div>
                </Td>
              </tr>
            ))}
            {visibleRequests.length === 0 && <EmptyTableRow colSpan={14} label="No delivery requests yet." />}
          </Table>
        </Panel>
      )}

      {selectedRequest && (
        <DeliveryRequestForm
          request={selectedRequest}
          lines={selectedLines}
          providers={providers}
          trackingEvents={selectedTracking}
          cashCollection={selectedCash}
          drafts={selectedDrafts}
          activity={activity.filter((event) => event.deliveryId === selectedRequest.deliveryId)}
          canSeeFullCode={role === 'Owner' || role === 'Manager' || role === 'Supervisor'}
          onClose={() => setSelectedRequest(null)}
          onBroadcast={() => runAction('delivery.broadcast', async () => { await broadcastToIDeliver(selectedRequest.deliveryId, staffId); }, 'iDeliver broadcast prepared.')}
          onSelectProvider={(providerId) => runAction('delivery.assign', async () => { await selectDeliveryProvider(selectedRequest.deliveryId, providerId, staffId); }, 'Delivery provider selected.')}
          onAssignDriver={(providerId) => runAction('delivery.assign', async () => { await assignVendorDriver(selectedRequest.deliveryId, providerId, staffId); }, 'Vendor driver assigned.')}
          onAccept={() => runAction('delivery.track', async () => { await acceptDelivery(selectedRequest.deliveryId, staffId); }, 'Driver acceptance recorded.')}
          onPickedUp={() => runAction('delivery.track', async () => { await markPickedUp(selectedRequest.deliveryId, staffId); }, 'Delivery marked picked up.')}
          onInTransit={() => runAction('delivery.track', async () => { await addTrackingEvent(selectedRequest.deliveryId, { status: 'En Route', locationText: 'Delivery en route', notes: 'Delivery tracking update recorded.', updatedByStaffId: staffId }); }, 'Delivery tracking set to in transit.')}
          onArrived={() => runAction('delivery.track', async () => { await markArrived(selectedRequest.deliveryId, staffId); }, 'Delivery marked arrived.')}
          onVerifyCode={(code) => runAction('delivery.verifyCode', async () => { await verifyDeliveryCode(selectedRequest.deliveryId, code, staffId); }, 'Delivery code verification processed.')}
          onMarkDelivered={() => runAction('delivery.complete', async () => { await markDelivered(selectedRequest.deliveryId, staffId, { overrideCode: role === 'Owner' || role === 'Supervisor', notes: 'Completed from Delivery Fulfilment form.' }); }, 'Delivery completion processed.')}
          onRecordFailure={(reason) => runAction('delivery.cancel', async () => { await recordDeliveryFailure(selectedRequest.deliveryId, staffId, reason); }, 'Delivery failure recorded.')}
          onCancel={(reason) => runAction('delivery.cancel', async () => { await cancelDelivery(selectedRequest.deliveryId, staffId, reason); }, 'Delivery cancelled locally.')}
          onCashCollected={(amount, notes) => runAction('delivery.cashReview', async () => { await recordCashCollectedByDriver(selectedRequest.deliveryId, staffId, amount, notes); }, 'Driver cash collection recorded for EOD review.')}
          onCashConfirmed={(amount, notes) => runAction('delivery.cashReview', async () => { await confirmDeliveryCashReceived(selectedRequest.deliveryId, staffId, amount, notes); }, 'Delivery cash confirmation recorded for EOD review.')}
          onPrepareMessage={(messageType) => runAction('delivery.create', async () => { await createWhatsAppMessageDraft(selectedRequest.deliveryId, messageType); }, 'WhatsApp delivery message draft prepared.')}
          onExport={() => runAction('delivery.export', async () => { await exportDeliveryPlaceholder(filters); }, 'Delivery export prepared.')}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-white border border-[#b1b5c2] border-l-4 border-l-orange-500 p-3 h-[84px] flex flex-col justify-between"><span className="text-[8px] font-black text-slate-500 uppercase">{label}</span><span className="text-xl font-black text-[#1e222b]">{value}</span><span className="text-[8px] text-slate-400 uppercase">Delivery control</span></div>;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="industrial-section"><div className="industrial-section-header"><span className="industrial-section-title">{title}</span></div><div className="p-4">{children}</div></div>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="industrial-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Td({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <td className={strong ? 'font-black text-[#1e222b]' : 'font-semibold'}>{children}</td>;
}

function EmptyTableRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan} className="py-8 text-center text-slate-500 font-black uppercase">{label}</td></tr>;
}

function Badge({ value }: { value: string }) {
  const risk = value.includes('Failed') || value.includes('Variance') || value.includes('Missing') || value.includes('Cancelled');
  const warn = value.includes('Pending') || value.includes('Broadcast') || value.includes('Review') || value.includes('Sent');
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[8px] uppercase font-black ${risk ? 'bg-rose-50 text-rose-800 border-rose-300' : warn ? 'bg-orange-50 text-orange-800 border-orange-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}>{risk && <AlertTriangle className="w-3 h-3" />}{value}</span>;
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="border border-[#b1b5c2] bg-white hover:bg-orange-50 px-2 py-1 text-[8px] font-black uppercase">{label}</button>;
}

function FilterInput({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="space-y-1"><span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold" /></label>;
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="space-y-1"><span className="block text-[9px] text-slate-500 font-black uppercase">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full border border-[#b1b5c2] px-2.5 py-2 text-[11px] font-bold">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}
