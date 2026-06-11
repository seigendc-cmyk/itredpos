import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  Lock,
  ShieldCheck,
  Terminal as TerminalIcon,
  Unlock,
  Wallet
} from 'lucide-react';
import {
  BiEvent,
  CashDrawerAssignment,
  CashLog,
  PosSession,
  Role,
  Shift,
  ShiftSessionControl,
  TerminalActivationRequest,
  TerminalControlEvent,
  TerminalLifecycleRecord,
  Transaction
} from '../types';
import {
  approveTerminalActivation,
  assignCashDrawer,
  closeShift,
  deactivateTerminal,
  forceCloseShift,
  getCashDrawerAssignments,
  getShiftSessionControl,
  getTerminalActivationRequests,
  getTerminalControlEvents,
  getTerminalLifecycle,
  lockTerminal,
  openShift,
  requestTerminalActivation,
  requestTerminalReactivation,
  runTerminalControlCheck,
  unassignCashDrawer
} from '../services/terminalControlService';
import { canPerformAction } from '../utils/posPermissions';

interface PosShiftProps {
  activeShift: Shift | null;
  shiftHistory: Shift[];
  transactions: Transaction[];
  onOpenShift: (operatorName: string, startingFloat: number) => void;
  onCloseShift: (actualFloat: number) => void;
  terminalId: string;
  activeOperator: string;
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: any,
    severity: 'INFO' | 'WARNING' | 'CRITICAL'
  ) => void;
  cashLogs: CashLog[];
  session?: PosSession | null;
}

type ShiftTab =
  | 'Shift Status'
  | 'Open Shift'
  | 'Close Shift'
  | 'Terminal Activation'
  | 'Cash Drawer Assignment'
  | 'Shift Activity';

const VENDOR_ID = 'SCI-LOG-ZW';
const permissionBlockedMessage = 'You do not have permission to perform this action.';
const tabs: ShiftTab[] = [
  'Shift Status',
  'Open Shift',
  'Close Shift',
  'Terminal Activation',
  'Cash Drawer Assignment',
  'Shift Activity'
];

function branchIdFromName(branchName: string): string {
  return branchName.toLowerCase().includes('bulawayo') ? 'BR-BYO' : 'BR-HARARE';
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function staffIdFromName(staffName: string): string {
  return staffName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'STAFF-LOCAL';
}

function eventTitle(value: string): string {
  const titles: Record<string, string> = {
    ACTIVATE_TERMINAL: 'Terminal Activated',
    DEACTIVATE_TERMINAL: 'Terminal Deactivated',
    LOCK_TERMINAL: 'Terminal Locked',
    REQUEST_REACTIVATION: 'Reactivation Requested',
    OPEN_SHIFT: 'Shift Opened',
    CLOSE_SHIFT: 'Shift Closed',
    FORCE_CLOSE_SHIFT: 'Shift Force Closed',
    ASSIGN_CASH_DRAWER: 'Cash Drawer Assigned',
    UNASSIGN_CASH_DRAWER: 'Cash Drawer Unassigned',
    SALE_BLOCKED_SHIFT_OR_TERMINAL: 'Sale Blocked: Terminal or Shift'
  };
  return titles[value] || value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export default function PosShift({
  activeShift,
  shiftHistory,
  transactions,
  onOpenShift,
  onCloseShift,
  terminalId: parentTerminalId,
  activeOperator,
  biEvents,
  onLogBiEvent,
  cashLogs,
  session
}: PosShiftProps) {
  const branchName = session?.branch || 'Harare Main';
  const branchId = branchIdFromName(branchName);
  const terminalId = session?.terminal || parentTerminalId || 'POS-01';
  const terminalName = terminalId;
  const staffName = session?.staffName || activeOperator || 'Mary Cashier';
  const staffId = staffIdFromName(staffName);
  const roleName = (session?.role || 'Owner') as Role;

  const [activeTab, setActiveTab] = useState<ShiftTab>('Shift Status');
  const [terminal, setTerminal] = useState<TerminalLifecycleRecord | null>(null);
  const [shift, setShift] = useState<ShiftSessionControl | null>(null);
  const [activationRequests, setActivationRequests] = useState<TerminalActivationRequest[]>([]);
  const [drawerAssignments, setDrawerAssignments] = useState<CashDrawerAssignment[]>([]);
  const [controlEvents, setControlEvents] = useState<TerminalControlEvent[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [openingFloat, setOpeningFloat] = useState('120.00');
  const [openNote, setOpenNote] = useState('Opening float counted and shift ready.');
  const [declaredCash, setDeclaredCash] = useState('120.00');
  const [activationTerminalId, setActivationTerminalId] = useState('POS-03');
  const [activationReason, setActivationReason] = useState('Terminal activation requested from Shift Control.');
  const [drawerId, setDrawerId] = useState('DRAWER-POS-01-A');
  const [drawerFloat, setDrawerFloat] = useState('120.00');
  const [drawerNotes, setDrawerNotes] = useState('Drawer counted and assigned for cash sales.');

  const loadControlData = async () => {
    const [terminalRecord, shiftRecord, requests, events, drawers] = await Promise.all([
      getTerminalLifecycle(VENDOR_ID, branchId, terminalId),
      getShiftSessionControl(VENDOR_ID, branchId, terminalId, staffId),
      getTerminalActivationRequests(VENDOR_ID, branchId),
      getTerminalControlEvents(VENDOR_ID, branchId),
      getCashDrawerAssignments(VENDOR_ID, branchId, terminalId)
    ]);
    await runTerminalControlCheck({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      terminalName,
      staffId,
      staffName,
      role: roleName,
      requiresCashDrawer: true
    });
    setTerminal(terminalRecord);
    setShift(shiftRecord);
    setActivationRequests(requests);
    setControlEvents(events);
    setDrawerAssignments(drawers);
  };

  useEffect(() => {
    void loadControlData();
  }, [branchId, terminalId, roleName, staffId]);

  const currentDrawer = drawerAssignments.find((assignment) => assignment.status === 'Assigned') || null;
  const cashSalesTotal = useMemo(() => transactions
    .filter((transaction) => transaction.paymentMethod === 'CASH' || transaction.paymentMethod === 'Cash')
    .reduce((sum, transaction) => sum + transaction.total, 0), [transactions]);
  const expectedCash = (shift?.openingFloat || Number(openingFloat) || 0) + cashSalesTotal;
  const saleAllowed = terminal?.status === 'Active' && shift?.status === 'Open';

  const requirePermission = (permission: Parameters<typeof canPerformAction>[1]): boolean => {
    if (canPerformAction(roleName, permission)) return true;
    setStatusMessage(permissionBlockedMessage);
    return false;
  };

  const handleOpenShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!requirePermission('shift.open')) return;
    const amount = Math.max(0, Number(openingFloat) || 0);
    await openShift({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      terminalName,
      staffId,
      staffName,
      openingFloat: amount,
      notes: openNote
    });
    onOpenShift(staffName, amount);
    onLogBiEvent('SHIFT_OPENED', staffName, terminalId, { floatAmount: amount, details: openNote }, 'INFO');
    setStatusMessage('Shift opened.');
    await loadControlData();
  };

  const handleCloseShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!requirePermission('shift.close')) return;
    if (!shift || shift.status !== 'Open') {
      setStatusMessage('Shift is not open.');
      return;
    }
    const amount = Math.max(0, Number(declaredCash) || 0);
    const closed = await closeShift(shift.id, amount, staffName);
    if (closed) {
      onCloseShift(amount);
      onLogBiEvent('SHIFT_CLOSED', staffName, terminalId, { actualCash: amount, expectedCash: closed.expectedCash, difference: closed.variance }, 'INFO');
      setStatusMessage('Shift closed.');
    }
    await loadControlData();
  };

  const handleForceClose = async () => {
    if (!requirePermission('shift.forceClose')) return;
    if (!shift) return;
    await forceCloseShift(shift.id, staffName);
    setStatusMessage('Shift force closed.');
    await loadControlData();
  };

  const handleRequestActivation = async (event: FormEvent) => {
    event.preventDefault();
    await requestTerminalActivation({
      vendorId: VENDOR_ID,
      branchId,
      terminalId: activationTerminalId,
      terminalName: activationTerminalId,
      requestedBy: staffName,
      reason: activationReason
    });
    setStatusMessage('Terminal activation requested.');
    await loadControlData();
  };

  const handleApproveActivation = async (requestId: string) => {
    if (!requirePermission('terminal.activate')) return;
    await approveTerminalActivation(requestId, staffName);
    setStatusMessage('Terminal activation approved.');
    await loadControlData();
  };

  const handleLockTerminal = async () => {
    if (!requirePermission('terminal.deactivate')) return;
    await lockTerminal({ vendorId: VENDOR_ID, branchId, terminalId, staffName });
    setStatusMessage('Terminal is locked pending review.');
    await loadControlData();
  };

  const handleDeactivateTerminal = async () => {
    if (!requirePermission('terminal.deactivate')) return;
    await deactivateTerminal({ vendorId: VENDOR_ID, branchId, terminalId, staffName });
    setStatusMessage('Terminal deactivated.');
    await loadControlData();
  };

  const handleRequestReactivation = async () => {
    await requestTerminalReactivation({ vendorId: VENDOR_ID, branchId, terminalId, terminalName, staffName });
    setStatusMessage('Terminal reactivation requested.');
    await loadControlData();
  };

  const handleAssignDrawer = async (event: FormEvent) => {
    event.preventDefault();
    if (!requirePermission('hardware.configure')) return;
    await assignCashDrawer({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      terminalName,
      drawerId,
      staffId,
      staffName,
      openingFloat: Math.max(0, Number(drawerFloat) || 0),
      notes: drawerNotes
    });
    setStatusMessage('Cash drawer assigned.');
    await loadControlData();
  };

  const handleUnassignDrawer = async (assignmentId: string) => {
    if (!requirePermission('hardware.configure')) return;
    await unassignCashDrawer(assignmentId, staffName);
    setStatusMessage('Cash drawer unassigned.');
    await loadControlData();
  };

  return (
    <div className="space-y-6">
      <header className="sci-page-header sci-page-header--compact">
        <div>
          <p className="sci-pos-eyebrow">Terminal and Shift Control</p>
          <h1>Shift Control</h1>
          <p>Local terminal activation, shift status, cash drawer assignment, and sale readiness checks.</p>
        </div>
        <div className="sci-page-header__actions">
          <span className={`sci-status-pill ${saleAllowed ? 'sci-status-pill--success' : 'sci-status-pill--danger'}`}>
            Sales {saleAllowed ? 'Allowed' : 'Blocked'}
          </span>
        </div>
      </header>

      {statusMessage && <div className="sci-pos-alert" role="status">{statusMessage}</div>}

      <div className="pos-shift-tabs" role="tablist" aria-label="Shift control sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`pos-shift-tab ${activeTab === tab ? 'pos-shift-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Shift Status' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Current Session</p>
              <h2>Shift Status</h2>
            </div>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="pos-control-summary-grid">
            <div>
              <TerminalIcon size={18} aria-hidden="true" />
              <span>Terminal</span>
              <strong>{terminalId}</strong>
              <small>{terminal?.status || 'Registered'}</small>
            </div>
            <div>
              <Unlock size={18} aria-hidden="true" />
              <span>Shift</span>
              <strong>{shift?.status || 'Not Opened'}</strong>
              <small>{shift?.staffName || staffName}</small>
            </div>
            <div>
              <Wallet size={18} aria-hidden="true" />
              <span>Drawer</span>
              <strong>{currentDrawer ? 'Assigned' : 'Not Assigned'}</strong>
              <small>{currentDrawer?.drawerId || 'Cash sales require a drawer'}</small>
            </div>
            <div>
              <DollarSign size={18} aria-hidden="true" />
              <span>Expected Cash</span>
              <strong>{money(expectedCash)}</strong>
              <small>{transactions.length} transaction records</small>
            </div>
          </div>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead>
                <tr>
                  <th>Terminal</th>
                  <th>Branch</th>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Parent Shift</th>
                  <th>History</th>
                  <th>BI Events</th>
                  <th>Cash Logs</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{terminalId}</td>
                  <td>{branchName}</td>
                  <td>{staffName}</td>
                  <td>{roleName}</td>
                  <td>{activeShift?.status || 'CLOSED'}</td>
                  <td>{shiftHistory.length}</td>
                  <td>{biEvents.length}</td>
                  <td>{cashLogs.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === 'Open Shift' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Start Work</p>
              <h2>Open Shift</h2>
            </div>
            <Unlock size={18} aria-hidden="true" />
          </div>
          <form className="pos-control-form" onSubmit={handleOpenShift}>
            <label>
              Cashier
              <input value={staffName} readOnly />
            </label>
            <label>
              Opening Float
              <input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => setOpeningFloat(event.target.value)} />
            </label>
            <label>
              Note
              <textarea rows={3} value={openNote} onChange={(event) => setOpenNote(event.target.value)} />
            </label>
            <button type="submit" className="sci-pos-button sci-pos-button--primary">
              <Unlock size={16} aria-hidden="true" />
              Open Shift
            </button>
          </form>
        </section>
      )}

      {activeTab === 'Close Shift' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">End Work</p>
              <h2>Close Shift</h2>
            </div>
            <Lock size={18} aria-hidden="true" />
          </div>
          <form className="pos-control-form" onSubmit={handleCloseShift}>
            <label>
              Expected Cash
              <input value={money(expectedCash)} readOnly />
            </label>
            <label>
              Declared Cash
              <input type="number" min="0" step="0.01" value={declaredCash} onChange={(event) => setDeclaredCash(event.target.value)} />
            </label>
            <button type="submit" className="sci-pos-button sci-pos-button--primary">
              <Lock size={16} aria-hidden="true" />
              Close Shift
            </button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleForceClose}>
              <AlertTriangle size={16} aria-hidden="true" />
              Force Close Shift
            </button>
          </form>
        </section>
      )}

      {activeTab === 'Terminal Activation' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Terminal Lifecycle</p>
              <h2>Terminal Activation</h2>
            </div>
            <TerminalIcon size={18} aria-hidden="true" />
          </div>
          <form className="pos-control-form" onSubmit={handleRequestActivation}>
            <label>
              Terminal ID
              <input value={activationTerminalId} onChange={(event) => setActivationTerminalId(event.target.value)} />
            </label>
            <label>
              Reason
              <textarea rows={3} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} />
            </label>
            <button type="submit" className="sci-pos-button sci-pos-button--primary">
              <CheckCircle size={16} aria-hidden="true" />
              Request Activation
            </button>
          </form>
          <div className="sci-pos-table-wrap">
            <table className="sci-pos-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Terminal</th>
                  <th>Status</th>
                  <th>Requested By</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activationRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.id}</td>
                    <td>{request.terminalId}</td>
                    <td>{request.status}</td>
                    <td>{request.requestedBy}</td>
                    <td>{request.reason}</td>
                    <td>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handleApproveActivation(request.id)}>
                        Activate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pos-control-actions">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleLockTerminal}>Lock Terminal</button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleDeactivateTerminal}>Deactivate Terminal</button>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleRequestReactivation}>Request Reactivation</button>
          </div>
        </section>
      )}

      {activeTab === 'Cash Drawer Assignment' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Cash Control</p>
              <h2>Cash Drawer Assignment</h2>
            </div>
            <Wallet size={18} aria-hidden="true" />
          </div>
          <form className="pos-control-form" onSubmit={handleAssignDrawer}>
            <label>
              Drawer ID
              <input value={drawerId} onChange={(event) => setDrawerId(event.target.value)} />
            </label>
            <label>
              Opening Float
              <input type="number" min="0" step="0.01" value={drawerFloat} onChange={(event) => setDrawerFloat(event.target.value)} />
            </label>
            <label>
              Notes
              <textarea rows={3} value={drawerNotes} onChange={(event) => setDrawerNotes(event.target.value)} />
            </label>
            <button type="submit" className="sci-pos-button sci-pos-button--primary">
              <Wallet size={16} aria-hidden="true" />
              Assign Cash Drawer
            </button>
          </form>
          {currentDrawer && (
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handleUnassignDrawer(currentDrawer.id)}>
              Unassign Cash Drawer
            </button>
          )}
        </section>
      )}

      {activeTab === 'Shift Activity' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Audit</p>
              <h2>Shift Activity</h2>
            </div>
            <Activity size={18} aria-hidden="true" />
          </div>
          <div className="pos-audit-feed">
            {controlEvents.map((event) => (
              <div key={event.id}>
                <strong>{eventTitle(event.eventType)}</strong>
                <span>{event.message}</span>
                <small>{new Date(event.createdAt).toLocaleString()}</small>
              </div>
            ))}
            {controlEvents.length === 0 && <div className="sci-pos-empty-cell">No shift activity recorded.</div>}
          </div>
        </section>
      )}
    </div>
  );
}
