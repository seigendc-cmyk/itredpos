import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  FileText,
  History,
  Lock,
  Play,
  ShieldCheck,
  Terminal as TerminalIcon,
  Unlock,
  Wallet
} from 'lucide-react';
import CashDrawerAssignmentModal from '../components/CashDrawerAssignmentModal';
import CloseShiftModal from '../components/CloseShiftModal';
import OpenShiftModal from '../components/OpenShiftModal';
import ShiftStartWizardModal from '../components/ShiftStartWizardModal';
import ShiftEodReportsModal from '../components/ShiftEodReportsModal';
import TerminalShiftHistoryModal from '../components/TerminalShiftHistoryModal';
import RowActionMenu from '../components/RowActionMenu';
import {
  prepareShiftEodPrintPayload,
  ShiftEodPrintPayload
} from '../services/shiftEodReportService';
import {
  clearPendingShiftProcess,
  clearShiftRecoveryState,
  getPendingShiftProcess,
  getShiftRecoveryState,
  hasRecoverableShiftState,
  makePendingShiftProcess,
  markRecoveryCheckpoint,
  recoverShiftState,
  savePendingShiftProcess,
  saveShiftRecoveryState
} from '../services/shiftRecoveryService';
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
  logTerminalControlEvent,
  openShift,
  requestTerminalActivation,
  requestTerminalReactivation,
  runTerminalControlCheck,
  unassignCashDrawer
} from '../services/terminalControlService';
import {
  BiEvent,
  CashDrawerAssignment,
  CashLog,
  PosSession,
  Role,
  Shift,
  ShiftSessionControl,
  TerminalActivationRequest,
  TerminalControlCheck,
  TerminalControlEvent,
  TerminalLifecycleRecord,
  Transaction
} from '../types';
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
  onNavigate?: (page: string) => void;
}

type ShiftAction = 'open' | 'close' | 'drawer' | null;
type ShiftSection = 'Status' | 'Terminal Activation' | 'Shift Activity';

const DEFAULT_VENDOR_ID = 'unassigned-vendor';
const SHIFT_START_INTENT_KEY = 'itred_pos_open_shift_start_wizard_v1';
const permissionBlockedMessage = 'You do not have permission to perform this action.';
const processWarning = 'A shift process is still in progress. Finish or cancel the process before exiting.';

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
    SHIFT_OPEN_STARTED: 'Shift Open Started',
    SHIFT_OPENED: 'Shift Opened',
    SHIFT_OPEN_FAILED: 'Shift Open Failed',
    SHIFT_CLOSE_STARTED: 'Shift Close Started',
    SHIFT_EOD_PREVIEW_GENERATED: 'Shift EOD Preview Generated',
    SHIFT_EOD_REPORT_PREVIEW_OPENED: 'Shift EOD Report Preview Opened',
    SHIFT_EOD_REPORT_PRINT_PREPARED: 'Shift EOD Report Print Prepared',
    SHIFT_EOD_REPORT_PRINT_STARTED: 'Shift EOD Report Print Started',
    SHIFT_EOD_REPORT_PDF_PRINT_STARTED: 'Shift EOD Report PDF Print Started',
    SHIFT_EOD_REPORT_PRINT_FAILED: 'Shift EOD Report Print Failed',
    SHIFT_CLOSED: 'Shift Closed',
    SHIFT_CLOSE_BLOCKED: 'Shift Close Blocked',
    CASH_DRAWER_ASSIGNMENT_STARTED: 'Cash Drawer Assignment Started',
    CASH_DRAWER_ASSIGNED: 'Cash Drawer Assigned',
    CASH_DRAWER_RELEASED: 'Cash Drawer Released',
    TERMINAL_HISTORY_OPENED: 'Terminal History Opened',
    TERMINAL_ACTIVATION_GUIDE_OPENED: 'Terminal Activation Guide Opened',
    TERMINAL_READINESS_CHECK_RUN: 'Terminal Readiness Check Run',
    TERMINAL_ACTIVATED: 'Terminal Activated',
    TERMINAL_SHIFT_OPEN_FLOW_STARTED: 'Terminal Shift Open Flow Started',
    START_SELLING_CLICKED: 'Start Selling Clicked',
    SHIFT_START_WIZARD_OPENED: 'Shift Start Wizard Opened',
    SHIFT_START_TERMINAL_CHECK_RUN: 'Shift Start Terminal Check Run',
    SHIFT_START_TERMINAL_ACTIVATED: 'Shift Start Terminal Activated',
    SHIFT_START_RECOVERY_FOUND: 'Shift Start Recovery Found',
    SHIFT_START_RECOVERY_RESTORED: 'Shift Start Recovery Restored',
    SHIFT_START_DRAWER_ASSIGNED: 'Shift Start Drawer Assigned',
    SHIFT_START_SHIFT_OPENED: 'Shift Start Shift Opened',
    SHIFT_START_READY_TO_SELL: 'Shift Start Ready To Sell',
    SHIFT_START_NAVIGATED_TO_SALES: 'Shift Start Navigated To Sales',
    SHIFT_START_CANCELLED: 'Shift Start Cancelled',
    SHIFT_START_BLOCKED: 'Shift Start Blocked',
    SHIFT_RECOVERY_STATE_SAVED: 'Shift Recovery Saved',
    SHIFT_RECOVERY_STATE_FOUND: 'Shift Recovery Found',
    SHIFT_RECOVERY_STATE_RESTORED: 'Shift Recovery Restored',
    SHIFT_RECOVERY_STATE_CLEARED: 'Shift Recovery Cleared',
    SHIFT_EXIT_BLOCKED_PENDING_PROCESS: 'Shift Exit Blocked'
  };
  return titles[value] || value.toLowerCase().split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function latestRecoveryStatus(): string {
  const state = getShiftRecoveryState();
  const pending = getPendingShiftProcess();
  if (pending) return `Pending ${pending.label}`;
  if (state?.shift?.status === 'Open') return 'Open shift recoverable';
  if (state) return 'Recovery state saved';
  return 'No recovery state';
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
  session,
  onNavigate
}: PosShiftProps) {
  const branchName = session?.branch || 'Main Branch';
  const branchId = branchIdFromName(branchName);
  const terminalId = session?.terminal || parentTerminalId || 'POS-01';
  const terminalName = terminalId;
  const staffName = session?.staffName || activeOperator || 'Cashier';
  const staffId = staffIdFromName(staffName);
  const roleName = (session?.role || 'Owner') as Role;
  const VENDOR_ID = session?.vendorId || DEFAULT_VENDOR_ID;

  const [activeSection, setActiveSection] = useState<ShiftSection>('Status');
  const [activeModal, setActiveModal] = useState<ShiftAction>(null);
  const [modalDirty, setModalDirty] = useState(false);
  const [terminal, setTerminal] = useState<TerminalLifecycleRecord | null>(null);
  const [shift, setShift] = useState<ShiftSessionControl | null>(null);
  const [activationRequests, setActivationRequests] = useState<TerminalActivationRequest[]>([]);
  const [drawerAssignments, setDrawerAssignments] = useState<CashDrawerAssignment[]>([]);
  const [controlEvents, setControlEvents] = useState<TerminalControlEvent[]>([]);
  const [readiness, setReadiness] = useState<TerminalControlCheck | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [recoverable, setRecoverable] = useState(hasRecoverableShiftState());
  const [showRecoveryDetails, setShowRecoveryDetails] = useState(false);
  const [selectedHistoryShift, setSelectedHistoryShift] = useState<Shift | null>(null);
  const [eodPayload, setEodPayload] = useState<ShiftEodPrintPayload | null>(null);
  const [eodOpen, setEodOpen] = useState(false);
  const [activationTerminalId, setActivationTerminalId] = useState('POS-03');
  const [activationReason, setActivationReason] = useState('Terminal activation requested from Shift Control.');
  const [openTerminalActionMenuId, setOpenTerminalActionMenuId] = useState<string | null>(null);
  const [startWizardOpen, setStartWizardOpen] = useState(false);
  const [startWizardDirty, setStartWizardDirty] = useState(false);

  const currentDrawer = drawerAssignments.find((assignment) => assignment.status === 'Assigned') || null;
  const cashSalesTotal = useMemo(() => transactions
    .filter((transaction) => transaction.paymentMethod === 'CASH' || transaction.paymentMethod === 'Cash')
    .reduce((sum, transaction) => sum + transaction.total, 0), [transactions]);
  const expectedCash = (shift?.openingFloat || activeShift?.startingCash || 0) + cashSalesTotal;
  const salesTotal = useMemo(() => transactions
    .filter((transaction) => transaction.status === 'COMPLETED')
    .reduce((sum, transaction) => sum + transaction.total, 0), [transactions]);
  const vatTotal = useMemo(() => transactions
    .filter((transaction) => transaction.status === 'COMPLETED')
    .reduce((sum, transaction) => sum + (transaction.tax || 0), 0), [transactions]);
  const paymentTotal = salesTotal;
  const saleAllowed = readiness?.allowed ?? (terminal?.status === 'Active' && shift?.status === 'Open' && Boolean(currentDrawer));
  const shiftReadinessStatus = recoverable ? 'Recovery Required'
    : terminal?.status !== 'Active' ? 'Needs Terminal Activation'
      : !currentDrawer ? 'Needs Drawer Assignment'
        : shift?.status !== 'Open' ? 'Needs Open Shift'
          : saleAllowed ? 'Ready to Sell'
            : 'Sales Blocked';
  const shiftReadinessReason = shiftReadinessStatus === 'Recovery Required'
    ? 'Previous shift state found. Recover or clear it before continuing sales.'
    : shiftReadinessStatus === 'Needs Terminal Activation'
      ? 'Activate this terminal before opening shift.'
      : shiftReadinessStatus === 'Needs Drawer Assignment'
        ? 'Assign a cash drawer before cash sales.'
        : shiftReadinessStatus === 'Needs Open Shift'
          ? 'Open a shift to begin sales.'
          : shiftReadinessStatus === 'Ready to Sell'
            ? 'Terminal, shift, and drawer are ready.'
            : readiness?.message || 'One or more required steps are incomplete.';
  const salesReadinessLabel = saleAllowed
    ? 'Ready'
    : readiness?.reasons.find((reason) => reason.includes('drawer')) ? 'Needs Drawer'
      : readiness?.reasons.find((reason) => reason.includes('Shift') || reason.includes('shift')) ? 'Needs Shift'
        : readiness?.reasons.find((reason) => reason.includes('Terminal') || reason.includes('terminal')) ? 'Needs Terminal Activation'
          : 'Blocked';
  const terminalRegistered = terminal?.status === 'Active' || terminal?.status === 'Registered';
  const canOverride = canPerformAction(roleName, 'shift.override');
  const statusCards = [
    { icon: TerminalIcon, label: 'Terminal', value: terminal?.status || 'Registered', help: terminalId },
    { icon: Unlock, label: 'Shift', value: shift?.status || activeShift?.status || 'Not Opened', help: shift?.staffName || activeShift?.operator || staffName },
    { icon: Wallet, label: 'Drawer', value: currentDrawer ? 'Assigned' : 'Not Assigned', help: currentDrawer?.drawerId || 'Cash sales require a drawer' },
    { icon: DollarSign, label: 'Expected Cash', value: money(expectedCash), help: `${transactions.length} transaction records` },
    { icon: ShieldCheck, label: 'Sales Readiness', value: salesReadinessLabel, help: readiness?.message || 'Local terminal control check' },
    { icon: Activity, label: 'Recovery Status', value: recoverable ? 'Recoverable' : 'Clean', help: latestRecoveryStatus() }
  ];

  const loadControlData = async () => {
    const [terminalRecord, shiftRecord, requests, events, drawers] = await Promise.all([
      getTerminalLifecycle(VENDOR_ID, branchId, terminalId),
      getShiftSessionControl(VENDOR_ID, branchId, terminalId, staffId),
      getTerminalActivationRequests(VENDOR_ID, branchId),
      getTerminalControlEvents(VENDOR_ID, branchId),
      getCashDrawerAssignments(VENDOR_ID, branchId, terminalId)
    ]);
    const check = await runTerminalControlCheck({
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
    setReadiness(check);
    setRecoverable(hasRecoverableShiftState());
  };

  useEffect(() => {
    void loadControlData();
  }, [branchId, terminalId, roleName, staffId]);

  useEffect(() => {
    try {
      if (localStorage.getItem(SHIFT_START_INTENT_KEY) !== 'open') return;
      localStorage.removeItem(SHIFT_START_INTENT_KEY);
      void handleStartSelling();
    } catch {
      // Shift start intent is best-effort local navigation state.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeModal && !startWizardOpen && !getPendingShiftProcess()) return;
      event.preventDefault();
      event.returnValue = processWarning;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeModal, startWizardOpen]);

  useEffect(() => {
    if (recoverable) {
      void logTerminalControlEvent({
        vendorId: VENDOR_ID,
        branchId,
        terminalId,
        staffId,
        staffName,
        eventType: 'SHIFT_RECOVERY_STATE_FOUND',
        message: 'Recoverable Shift State Found on this device.',
        severity: 'WARNING'
      });
    }
  }, [branchId, recoverable, staffId, staffName, terminalId]);

  const requirePermission = (permission: Parameters<typeof canPerformAction>[1]): boolean => {
    if (canPerformAction(roleName, permission)) return true;
    setStatusMessage(permissionBlockedMessage);
    return false;
  };

  const guardedCloseModal = () => {
    if (modalDirty && !window.confirm(processWarning)) {
      void logTerminalControlEvent({
        vendorId: VENDOR_ID,
        branchId,
        terminalId,
        staffId,
        staffName,
        eventType: 'SHIFT_EXIT_BLOCKED_PENDING_PROCESS',
        message: processWarning,
        severity: 'WARNING'
      });
      return;
    }
    clearPendingShiftProcess();
    setModalDirty(false);
    setActiveModal(null);
  };

  const guardedCloseStartWizard = () => {
    if ((startWizardDirty || getPendingShiftProcess()) && !window.confirm('A shift start process is in progress. Finish or cancel before exiting.')) {
      void logTerminalControlEvent({
        vendorId: VENDOR_ID,
        branchId,
        terminalId,
        staffId,
        staffName,
        eventType: 'SHIFT_START_BLOCKED',
        message: 'Shift start wizard exit blocked by confirmation.',
        severity: 'WARNING'
      });
      return;
    }
    clearPendingShiftProcess();
    setStartWizardDirty(false);
    setStartWizardOpen(false);
    void logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_CANCELLED', message: 'Start Selling flow cancelled.', severity: 'INFO' });
  };

  const openActionModal = (modal: ShiftAction) => {
    if (modal === 'open' && !requirePermission('shift.open')) return;
    if (modal === 'close' && !requirePermission('shift.close')) return;
    if (modal === 'drawer' && !requirePermission('cashDrawer.assign')) return;
    const label = modal === 'open' ? 'opening shift' : modal === 'close' ? 'closing shift' : 'cash drawer assignment';
    const eventType = modal === 'open' ? 'SHIFT_OPEN_STARTED' : modal === 'close' ? 'SHIFT_CLOSE_STARTED' : 'CASH_DRAWER_ASSIGNMENT_STARTED';
    savePendingShiftProcess(makePendingShiftProcess({ type: modal === 'open' ? 'opening-shift' : modal === 'close' ? 'closing-shift' : 'drawer-assignment', label, terminalId, staffName }));
    void logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType, message: `${eventTitle(eventType)}.`, severity: 'INFO' });
    setModalDirty(false);
    setActiveModal(modal);
  };

  const recoveryContext = (nextShift: ShiftSessionControl | null = shift, nextDrawer: CashDrawerAssignment | null = currentDrawer, nextReadiness: TerminalControlCheck | null = readiness) => ({
    savedAt: new Date().toISOString(),
    vendorId: VENDOR_ID,
    branchId,
    branchName,
    terminalId,
    terminalName,
    staffId,
    staffName,
    roleName,
    shift: nextShift,
    drawerAssignment: nextDrawer,
    readiness: nextReadiness,
    statusMessage
  });

  const handleOpenShift = async (payload: { openingFloat: number; drawerId: string; notes: string }) => {
    try {
      const opened = await openShift({
        vendorId: VENDOR_ID,
        branchId,
        terminalId,
        terminalName,
        staffId,
        staffName,
        openingFloat: payload.openingFloat,
        notes: payload.notes
      });
      let drawer = currentDrawer;
      if (!drawer && payload.drawerId) {
        drawer = await assignCashDrawer({
          vendorId: VENDOR_ID,
          branchId,
          terminalId,
          terminalName,
          drawerId: payload.drawerId,
          staffId,
          staffName,
          openingFloat: payload.openingFloat,
          notes: 'Drawer assigned during shift open.'
        });
      }
      onOpenShift(staffName, payload.openingFloat);
      onLogBiEvent('SHIFT_OPENED', staffName, terminalId, { floatAmount: payload.openingFloat, details: payload.notes }, 'INFO');
      saveShiftRecoveryState(recoveryContext(opened, drawer));
      markRecoveryCheckpoint('SHIFT_OPENED', { shiftId: opened.id, drawerId: drawer?.drawerId });
      clearPendingShiftProcess();
      setStatusMessage('Shift opened successfully.');
      setActiveModal(null);
      setStartWizardOpen(false);
      setModalDirty(false);
      setStartWizardDirty(false);
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_SHIFT_OPENED', message: 'Shift opened from Start Selling flow or Open Shift modal.', severity: 'INFO' });
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_READY_TO_SELL', message: 'Shift opened. Sales Terminal is ready.', severity: 'INFO' });
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_NAVIGATED_TO_SALES', message: 'Navigated to Sales Terminal after shift open.', severity: 'INFO' });
      await loadControlData();
      onNavigate?.('SALES');
    } catch {
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_OPEN_FAILED', message: 'Shift open failed during local workflow.', severity: 'WARNING' });
      setStatusMessage('Shift could not be opened.');
    }
  };

  const buildEodContext = (countedCash?: number, cashNotes?: string) => ({
    vendorId: VENDOR_ID,
    branchId,
    branchName,
    terminalId,
    terminalName,
    staffId,
    staffName,
    roleName,
    shift: shift || activeShift,
    transactions,
    cashLogs,
    drawerAssignment: currentDrawer,
    countedCash,
    cashNotes
  });

  const handleGenerateEodPreview = async (payload: { countedCash: number; cashNotes: string; closingNotes: string }) => {
    const report = await prepareShiftEodPrintPayload(buildEodContext(payload.countedCash, payload.cashNotes));
    setEodPayload(report);
    setStatusMessage('EOD preview generated.');
    markRecoveryCheckpoint('SHIFT_EOD_PREVIEW_GENERATED', { shiftId: report.summary.shiftId, countedCash: payload.countedCash });
    savePendingShiftProcess(makePendingShiftProcess({ type: 'eod-preview', label: 'EOD report generation', terminalId, staffName, payload }));
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_EOD_PREVIEW_GENERATED', message: 'Shift EOD preview generated locally.', severity: 'INFO' });
  };

  const handleCloseShift = async (payload: { countedCash: number; cashNotes: string; closingNotes: string }) => {
    if (!shift || shift.status !== 'Open') {
      setStatusMessage('Shift is not open.');
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_CLOSE_BLOCKED', message: 'Shift close blocked because no open shift exists.', severity: 'WARNING' });
      return;
    }
    const closed = await closeShift(shift.id, payload.countedCash, staffName);
    if (closed) {
      const report = eodPayload || await prepareShiftEodPrintPayload(buildEodContext(payload.countedCash, payload.cashNotes));
      setEodPayload(report);
      setEodOpen(true);
      onCloseShift(payload.countedCash);
      onLogBiEvent('SHIFT_CLOSED', staffName, terminalId, { actualCash: payload.countedCash, expectedCash: closed.expectedCash, difference: closed.variance, closingNotes: payload.closingNotes }, 'INFO');
      saveShiftRecoveryState(recoveryContext(closed, currentDrawer));
      markRecoveryCheckpoint('SHIFT_CLOSED', { shiftId: closed.id, countedCash: payload.countedCash, variance: closed.variance });
      clearPendingShiftProcess();
      setStatusMessage('Shift closed. EOD reports generated.');
      setActiveModal(null);
      setModalDirty(false);
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

  const handleAssignDrawer = async (payload: { drawerId: string; openingFloat: number; cashSalesEnabled: boolean; notes: string }) => {
    if (!requirePermission('cashDrawer.assign')) return;
    const drawer = await assignCashDrawer({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      terminalName,
      drawerId: payload.drawerId,
      staffId,
      staffName,
      openingFloat: payload.openingFloat,
      notes: payload.notes
    });
    saveShiftRecoveryState(recoveryContext(shift, drawer));
    markRecoveryCheckpoint('CASH_DRAWER_ASSIGNED', { drawerId: drawer.drawerId });
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_DRAWER_ASSIGNED', message: `${drawer.drawerId} assigned from shift start flow.`, severity: 'INFO' });
    clearPendingShiftProcess();
    setStatusMessage('Cash drawer assigned.');
    setActiveModal(null);
    setModalDirty(false);
    await loadControlData();
  };

  const handleUnassignDrawer = async () => {
    if (!requirePermission('cashDrawer.release')) return;
    if (!currentDrawer) return;
    await unassignCashDrawer(currentDrawer.id, staffName);
    markRecoveryCheckpoint('CASH_DRAWER_RELEASED', { drawerId: currentDrawer.drawerId });
    clearPendingShiftProcess();
    setStatusMessage('Cash drawer released.');
    setActiveModal(null);
    setModalDirty(false);
    await loadControlData();
  };

  const handleRequestActivation = async () => {
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

  const handleStartSelling = async () => {
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'START_SELLING_CLICKED', message: 'Start Selling clicked from Shift Control.', severity: 'INFO' });
    savePendingShiftProcess(makePendingShiftProcess({ type: 'opening-shift', label: 'start selling flow', terminalId, staffName }));
    setStartWizardOpen(true);
    setStartWizardDirty(false);
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_WIZARD_OPENED', message: 'Start Selling wizard opened.', severity: 'INFO' });
    if (recoverable) {
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_RECOVERY_FOUND', message: 'Previous Shift State Found.', severity: 'WARNING' });
    }
    if (canPerformAction(roleName, 'terminal.readinessCheck')) {
      const check = await runTerminalControlCheck({ vendorId: VENDOR_ID, branchId, terminalId, terminalName, staffId, staffName, role: roleName, requiresCashDrawer: true });
      setReadiness(check);
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_TERMINAL_CHECK_RUN', message: check.message, severity: check.allowed ? 'INFO' : 'WARNING' });
    }
  };

  const handleWizardRunTerminalCheck = async () => {
    if (!requirePermission('terminal.readinessCheck')) return;
    const check = await runTerminalControlCheck({ vendorId: VENDOR_ID, branchId, terminalId, terminalName, staffId, staffName, role: roleName, requiresCashDrawer: true });
    setReadiness(check);
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_TERMINAL_CHECK_RUN', message: check.message, severity: check.allowed ? 'INFO' : 'WARNING' });
    await loadControlData();
  };

  const handleWizardActivateTerminal = async () => {
    if (!requirePermission('terminal.activate')) return;
    const request = await requestTerminalActivation({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      terminalName,
      requestedBy: staffName,
      reason: 'Activated from Start Selling flow.'
    });
    await approveTerminalActivation(request.id, staffName);
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_TERMINAL_ACTIVATED', message: `${terminalId} activated from Start Selling flow.`, severity: 'INFO' });
    setStatusMessage('Terminal activated. Continue Start Selling.');
    await loadControlData();
  };

  const handleWizardRecoverShift = async () => {
    await handleRecoverShift();
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_RECOVERY_RESTORED', message: 'Recovery restored from Start Selling flow.', severity: 'INFO' });
  };

  const handleWizardClearRecovery = async () => {
    if (!canPerformAction(roleName, 'shift.override')) {
      setStatusMessage(permissionBlockedMessage);
      return;
    }
    clearShiftRecoveryState();
    clearPendingShiftProcess();
    setRecoverable(false);
    setShowRecoveryDetails(false);
    setStatusMessage('Recovery state cleared.');
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_RECOVERY_STATE_CLEARED', message: 'Recovery state cleared from Start Selling flow.', severity: 'INFO' });
    await loadControlData();
  };

  const handleWizardGoToSales = async () => {
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_START_NAVIGATED_TO_SALES', message: 'Go to Sales Terminal clicked from Start Selling flow.', severity: 'INFO' });
    clearPendingShiftProcess();
    setStartWizardOpen(false);
    setStartWizardDirty(false);
    onNavigate?.('SALES');
  };

  const handleApproveActivation = async (requestId: string) => {
    if (!requirePermission('terminal.activate')) return;
    await approveTerminalActivation(requestId, staffName);
    setStatusMessage('Terminal activation approved.');
    await loadControlData();
  };

  const handleTerminalActionMenu = (requestId: string) => {
    setOpenTerminalActionMenuId((current) => current === requestId ? null : requestId);
    void logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'TERMINAL_ACTIVATION_MENU_OPENED', message: 'Terminal activation action menu opened.', severity: 'INFO' });
  };

  const handleOpenTerminalActivationGuide = async (target: 'activation' | 'shift' | 'drawer') => {
    setActiveSection('Terminal Activation');
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'TERMINAL_ACTIVATION_GUIDE_OPENED', message: `Terminal activation guide CTA opened ${target}.`, severity: 'INFO' });
    if (target === 'shift') {
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'TERMINAL_SHIFT_OPEN_FLOW_STARTED', message: 'Open Shift flow started from terminal activation guide.', severity: 'INFO' });
      openActionModal('open');
      return;
    }
    if (target === 'drawer') {
      openActionModal('drawer');
      return;
    }
    setStatusMessage('Terminal Activation guide opened.');
  };

  const handleTerminalMenuAction = async (requestId: string, action: string) => {
    const request = activationRequests.find((item) => item.id === requestId);
    setOpenTerminalActionMenuId(null);
    if (!request) return;
    if (action === 'Activate Terminal') {
      await handleApproveActivation(request.id);
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId: request.terminalId, staffId, staffName, eventType: 'TERMINAL_ACTIVATED', message: `${request.terminalId} activated from terminal activation menu.`, severity: 'INFO' });
      setStatusMessage('Terminal activated successfully.');
      return;
    }
    if (action === 'Deactivate Terminal') {
      if (!requirePermission('terminal.deactivate')) return;
      await deactivateTerminal({ vendorId: VENDOR_ID, branchId, terminalId: request.terminalId, staffName }, 'Deactivated from terminal activation menu.');
      setStatusMessage(`${request.terminalId} deactivated locally.`);
      await loadControlData();
      return;
    }
    if (action === 'Run Readiness Check') {
      if (!requirePermission('terminal.readinessCheck')) return;
      const check = await runTerminalControlCheck({ vendorId: VENDOR_ID, branchId, terminalId: request.terminalId, terminalName: request.terminalName, staffId, staffName, role: roleName, requiresCashDrawer: true });
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId: request.terminalId, staffId, staffName, eventType: 'TERMINAL_READINESS_CHECK_RUN', message: check.message, severity: check.allowed ? 'INFO' : 'WARNING' });
      setStatusMessage(`Readiness: ${check.message}`);
      setReadiness(check);
      return;
    }
    if (action === 'Assign Drawer') {
      openActionModal('drawer');
      return;
    }
    if (action === 'Open Shift') {
      await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'TERMINAL_SHIFT_OPEN_FLOW_STARTED', message: 'Open Shift flow started from terminal activation menu.', severity: 'INFO' });
      openActionModal('open');
      return;
    }
    if (action === 'View Active Period History') {
      setActiveSection('Shift Activity');
      setStatusMessage(`${request.terminalId} active period history opened.`);
      return;
    }
    if (action === 'Recover Last State') {
      await handleRecoverShift();
      return;
    }
    setStatusMessage(`${action}: ${request.terminalId} shift action opened.`);
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

  const handleRecoverShift = async () => {
    if (!requirePermission('shift.recovery.restore')) return;
    const recovered = recoverShiftState();
    if (!recovered) {
      setStatusMessage('No recovery state found.');
      return;
    }
    setStatusMessage('Recoverable shift state restored for review.');
    setRecoverable(hasRecoverableShiftState());
    setShowRecoveryDetails(true);
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_RECOVERY_STATE_RESTORED', message: 'Recovery state restored for local review.', severity: 'INFO' });
  };

  const handleClearRecovery = async () => {
    if (!window.confirm('Clear the saved recovery state from this device? Completed shift history will not be deleted.')) return;
    clearShiftRecoveryState();
    clearPendingShiftProcess();
    setRecoverable(false);
    setShowRecoveryDetails(false);
    setStatusMessage('Recovery state cleared.');
    await logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'SHIFT_RECOVERY_STATE_CLEARED', message: 'Recovery state cleared from this device.', severity: 'INFO' });
  };

  const handleOpenHistory = (historyShift: Shift) => {
    if (!requirePermission('terminal.history.view')) return;
    setSelectedHistoryShift(historyShift);
    void logTerminalControlEvent({ vendorId: VENDOR_ID, branchId, terminalId, staffId, staffName, eventType: 'TERMINAL_HISTORY_OPENED', message: `${historyShift.id} terminal history opened.`, severity: 'INFO' });
  };

  const handleEodReportEvent = useCallback((eventType: string, message: string) => {
    void logTerminalControlEvent({
      vendorId: VENDOR_ID,
      branchId,
      terminalId,
      staffId,
      staffName,
      eventType,
      message,
      severity: eventType === 'SHIFT_EOD_REPORT_PRINT_FAILED' ? 'WARNING' : 'INFO'
    });
  }, [branchId, staffId, staffName, terminalId]);

  return (
    <div className="shift-control-page">
      <header className="shift-control-header">
        <div>
          <p className="sci-pos-eyebrow">Terminal and Shift Control</p>
          <h1>Shift Control</h1>
          <p>Responsive local shift control, drawer readiness, recovery, terminal history, and EOD reports.</p>
        </div>
        <div className="shift-header-actions">
          <span className={`sci-status-pill ${saleAllowed ? 'sci-status-pill--success' : 'sci-status-pill--danger'}`}>
            Sales {saleAllowed ? 'Allowed' : 'Blocked'}
          </span>
          <button type="button" className="sci-pos-button sci-pos-button--primary shift-start-primary-button" onClick={() => void handleStartSelling()}>
            <Play size={16} aria-hidden="true" />
            Start Selling
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => openActionModal('open')}>
            <Unlock size={16} aria-hidden="true" />
            Open Shift
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => openActionModal('close')}>
            <Lock size={16} aria-hidden="true" />
            Close Shift
          </button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => openActionModal('drawer')}>
            <Wallet size={16} aria-hidden="true" />
            Drawer
          </button>
        </div>
      </header>

      {recoverable && (
        <section className="shift-recovery-banner">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>Recoverable Shift State Found</strong>
            <span>The previous terminal session was interrupted. You can recover the last shift state from this device.</span>
          </div>
          <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleRecoverShift}>Recover Shift</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setShowRecoveryDetails((current) => !current)}>Review Recovery Details</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleClearRecovery}>Clear Recovery State</button>
        </section>
      )}

      {showRecoveryDetails && (
        <section className="sci-pos-card shift-history-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Device Recovery</p>
              <h2>Recovery Details</h2>
            </div>
            <FileText size={18} aria-hidden="true" />
          </div>
          <div className="shift-history-detail-grid">
            <div><span>Terminal</span><strong>{getShiftRecoveryState()?.terminalName || terminalName}</strong></div>
            <div><span>Staff</span><strong>{getShiftRecoveryState()?.staffName || staffName}</strong></div>
            <div><span>Shift</span><strong>{getShiftRecoveryState()?.shift?.status || 'Review required'}</strong></div>
            <div><span>Saved At</span><strong>{getShiftRecoveryState()?.savedAt ? new Date(getShiftRecoveryState()!.savedAt).toLocaleString() : 'Not recorded'}</strong></div>
          </div>
        </section>
      )}

      {statusMessage && <div className="sci-pos-alert" role="status">{statusMessage}</div>}

      <section className={`shift-readiness-banner shift-readiness-banner--${shiftReadinessStatus.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{shiftReadinessStatus}</strong>
          <span>{shiftReadinessReason}</span>
        </div>
        <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void handleStartSelling()}>
          Start Selling
        </button>
      </section>

      <section className="shift-status-grid" aria-label="Shift status cards">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="shift-status-card">
              <Icon size={19} aria-hidden="true" />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.help}</small>
            </article>
          );
        })}
      </section>

      <nav className="shift-control-tabs" aria-label="Shift control sections">
        {(['Status', 'Terminal Activation', 'Shift Activity'] as ShiftSection[]).map((section) => (
          <button key={section} type="button" className={`shift-control-tab ${activeSection === section ? 'shift-control-tab--active' : ''}`} onClick={() => setActiveSection(section)}>
            {section}
          </button>
        ))}
      </nav>

      {activeSection === 'Status' && (
        <section className="shift-main-grid">
          <article className="sci-pos-card shift-history-card">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Terminal Periods</p>
                <h2>Closed Terminal History</h2>
              </div>
              <History size={18} aria-hidden="true" />
            </div>
            <div className="shift-history-list">
              {shiftHistory.map((historyShift) => (
                <button key={historyShift.id} type="button" className="shift-history-row" onClick={() => handleOpenHistory(historyShift)}>
                  <span>{historyShift.id}</span>
                  <strong>{historyShift.operator}</strong>
                  <small>{historyShift.endTime ? new Date(historyShift.endTime).toLocaleString() : 'Open'} / {money(historyShift.totalSales || 0)}</small>
                </button>
              ))}
              {shiftHistory.length === 0 && <div className="sci-pos-empty-cell">No closed shift history recorded yet.</div>}
            </div>
          </article>

          <article className="sci-pos-card shift-eod-report-card">
            <div className="sci-pos-card__bar">
              <div>
                <p className="sci-pos-eyebrow">Close Reports</p>
                <h2>EOD Report Readiness</h2>
              </div>
              <FileText size={18} aria-hidden="true" />
            </div>
            <div className="shift-history-detail-grid">
              <div><span>EOD Summary</span><strong>{eodPayload ? 'Generated' : 'Waiting for close'}</strong></div>
              <div><span>VAT Summary</span><strong>{eodPayload ? money(eodPayload.vat.vatAmount) : 'Not generated'}</strong></div>
              <div><span>Cash Variance</span><strong>{eodPayload ? money(eodPayload.cashVariance.variance) : 'Not generated'}</strong></div>
              <div><span>Drawer Reconciliation</span><strong>{eodPayload ? eodPayload.drawer.drawerId : currentDrawer?.drawerId || 'No drawer'}</strong></div>
            </div>
            <div className="pos-control-actions">
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => eodPayload && setEodOpen(true)} disabled={!eodPayload}>
                View EOD Reports
              </button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={handleForceClose}>
                <AlertTriangle size={16} aria-hidden="true" />
                Force Close Shift
              </button>
            </div>
          </article>
        </section>
      )}

      {activeSection === 'Terminal Activation' && (
        <section className="sci-pos-card">
          <div className="sci-pos-card__bar">
            <div>
              <p className="sci-pos-eyebrow">Terminal Lifecycle</p>
              <h2>Terminal Activation</h2>
            </div>
            <TerminalIcon size={18} aria-hidden="true" />
          </div>
          <div className="terminal-activation-guide-panel">
            <div>
              <p className="sci-pos-eyebrow">Terminal Activation Guide</p>
              <h3>How to Activate This Terminal</h3>
            </div>
            <ol>
              <li>Open Shift Control.</li>
              <li>Go to Terminal Activation.</li>
              <li>Open the terminal row three-dot menu.</li>
              <li>Select Run Readiness Check.</li>
              <li>Select Activate Terminal.</li>
              <li>Go to Open Shift.</li>
              <li>Assign cash drawer if required.</li>
              <li>Open Shift.</li>
              <li>App will move to Sales Terminal.</li>
            </ol>
            <div className="terminal-activation-guide-actions">
              <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => void handleOpenTerminalActivationGuide('activation')}>Open Terminal Activation</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void handleOpenTerminalActivationGuide('shift')}>Open Shift</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => void handleOpenTerminalActivationGuide('drawer')}>Assign Drawer</button>
            </div>
          </div>
          <div className="pos-control-form">
            <label>
              Terminal ID
              <input value={activationTerminalId} onChange={(event) => setActivationTerminalId(event.target.value)} />
            </label>
            <label>
              Reason
              <textarea rows={3} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} />
            </label>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={handleRequestActivation}>
              <CheckCircle size={16} aria-hidden="true" />
              Request Activation
            </button>
          </div>
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
                      <RowActionMenu
                        rowId={request.id}
                        ariaLabel={`Terminal activation actions for ${request.terminalId}`}
                        open={openTerminalActionMenuId === request.id}
                        onOpen={() => handleTerminalActionMenu(request.id)}
                        onOpenChange={(open) => setOpenTerminalActionMenuId(open ? request.id : null)}
                        items={['View Terminal Details', 'Run Readiness Check', 'Activate Terminal', 'Deactivate Terminal', 'Assign Drawer', 'Open Shift', 'View Active Period History', 'Recover Last State'].map((action) => ({
                          id: action,
                          label: action,
                          danger: action === 'Deactivate Terminal',
                          separatorBefore: action === 'Assign Drawer' || action === 'View Active Period History',
                          onClick: () => void handleTerminalMenuAction(request.id, action)
                        }))}
                      />
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

      {activeSection === 'Shift Activity' && (
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

      <OpenShiftModal
        open={activeModal === 'open'}
        staffName={staffName}
        branchName={branchName}
        terminalName={terminalName}
        drawerId={currentDrawer?.drawerId}
        terminalRegistered={terminalRegistered}
        staffSessionActive={Boolean(session)}
        hasOpenShift={shift?.status === 'Open'}
        cashSalesEnabled
        onCancel={guardedCloseModal}
        onSubmit={handleOpenShift}
        onDirtyChange={setModalDirty}
      />
      <CloseShiftModal
        open={activeModal === 'close'}
        expectedCash={expectedCash}
        salesTotal={salesTotal}
        paymentTotal={paymentTotal}
        vatTotal={vatTotal}
        pendingDeliveryCash={0}
        hasActiveSale={false}
        canOverride={canOverride}
        eodPreview={eodPayload}
        onGeneratePreview={handleGenerateEodPreview}
        onCloseShift={handleCloseShift}
        onCancel={guardedCloseModal}
        onDirtyChange={setModalDirty}
      />
      <CashDrawerAssignmentModal
        open={activeModal === 'drawer'}
        staffName={staffName}
        branchName={branchName}
        terminalName={terminalName}
        currentDrawerId={currentDrawer?.drawerId}
        cashSalesEnabled
        canRelease={Boolean(currentDrawer)}
        onAssign={handleAssignDrawer}
        onRelease={handleUnassignDrawer}
        onCancel={guardedCloseModal}
        onDirtyChange={setModalDirty}
      />
      <TerminalShiftHistoryModal
        open={Boolean(selectedHistoryShift)}
        shift={selectedHistoryShift}
        terminalId={terminalId}
        branchName={branchName}
        staffName={staffName}
        roleName={roleName}
        transactions={transactions}
        biEvents={biEvents}
        cashLogs={cashLogs}
        controlEvents={controlEvents}
        onClose={() => setSelectedHistoryShift(null)}
      />
      <ShiftEodReportsModal
        open={eodOpen}
        payload={eodPayload}
        onClose={() => setEodOpen(false)}
        onReportEvent={handleEodReportEvent}
      />
      <ShiftStartWizardModal
        open={startWizardOpen}
        staffName={staffName}
        branchName={branchName}
        terminalName={terminalName}
        terminal={terminal}
        shift={shift}
        currentDrawer={currentDrawer}
        readiness={readiness}
        recoverable={recoverable}
        cashSalesRequireDrawer
        canActivateTerminal={canPerformAction(roleName, 'terminal.activate')}
        canRunReadinessCheck={canPerformAction(roleName, 'terminal.readinessCheck')}
        canAssignDrawer={canPerformAction(roleName, 'cashDrawer.assign')}
        canOpenShift={canPerformAction(roleName, 'shift.open')}
        canRecoverShift={canPerformAction(roleName, 'shift.recovery.restore')}
        canOverrideRecovery={canPerformAction(roleName, 'shift.override')}
        onRunTerminalCheck={handleWizardRunTerminalCheck}
        onActivateTerminal={handleWizardActivateTerminal}
        onRecoverState={handleWizardRecoverShift}
        onReviewRecovery={() => setShowRecoveryDetails(true)}
        onClearRecovery={handleWizardClearRecovery}
        onAssignDrawer={handleAssignDrawer}
        onOpenShift={handleOpenShift}
        onGoToSales={handleWizardGoToSales}
        onCancel={guardedCloseStartWizard}
        onDirtyChange={setStartWizardDirty}
      />
    </div>
  );
}
