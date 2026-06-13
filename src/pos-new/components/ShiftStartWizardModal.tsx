import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle, RotateCcw, ShieldCheck, Unlock, Wallet, X } from 'lucide-react';
import type { CashDrawerAssignment, ShiftSessionControl, TerminalControlCheck, TerminalLifecycleRecord } from '../types';

interface ShiftStartWizardModalProps {
  open: boolean;
  staffName: string;
  branchName: string;
  terminalName: string;
  terminal: TerminalLifecycleRecord | null;
  shift: ShiftSessionControl | null;
  currentDrawer: CashDrawerAssignment | null;
  readiness: TerminalControlCheck | null;
  recoverable: boolean;
  cashSalesRequireDrawer: boolean;
  canActivateTerminal: boolean;
  canRunReadinessCheck: boolean;
  canAssignDrawer: boolean;
  canOpenShift: boolean;
  canRecoverShift: boolean;
  canOverrideRecovery: boolean;
  onRunTerminalCheck: () => Promise<void>;
  onActivateTerminal: () => Promise<void>;
  onRecoverState: () => Promise<void>;
  onReviewRecovery: () => void;
  onClearRecovery: () => Promise<void>;
  onAssignDrawer: (payload: { drawerId: string; openingFloat: number; cashSalesEnabled: boolean; notes: string }) => Promise<void>;
  onOpenShift: (payload: { openingFloat: number; drawerId: string; notes: string }) => Promise<void>;
  onGoToSales: () => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

type WizardStep = 'terminal' | 'recovery' | 'drawer' | 'shift' | 'ready';

const stepOrder: WizardStep[] = ['terminal', 'recovery', 'drawer', 'shift', 'ready'];
const stepLabels: Record<WizardStep, string> = {
  terminal: 'Terminal Check',
  recovery: 'Recovery Check',
  drawer: 'Drawer Assignment',
  shift: 'Open Shift',
  ready: 'Ready to Sell'
};

function permissionMessage(hasPermission: boolean): string {
  return hasPermission ? '' : 'You do not have permission to perform this shift action.';
}

export default function ShiftStartWizardModal({
  open,
  staffName,
  branchName,
  terminalName,
  terminal,
  shift,
  currentDrawer,
  readiness,
  recoverable,
  cashSalesRequireDrawer,
  canActivateTerminal,
  canRunReadinessCheck,
  canAssignDrawer,
  canOpenShift,
  canRecoverShift,
  canOverrideRecovery,
  onRunTerminalCheck,
  onActivateTerminal,
  onRecoverState,
  onReviewRecovery,
  onClearRecovery,
  onAssignDrawer,
  onOpenShift,
  onGoToSales,
  onCancel,
  onDirtyChange
}: ShiftStartWizardModalProps) {
  const [activeStep, setActiveStep] = useState<WizardStep>('terminal');
  const [drawerId, setDrawerId] = useState(currentDrawer?.drawerId || 'DRAWER-POS-01-A');
  const [openingFloat, setOpeningFloat] = useState('120.00');
  const [drawerNotes, setDrawerNotes] = useState('Drawer counted and assigned for cash sales.');
  const [shiftNotes, setShiftNotes] = useState('Opening float counted and shift ready.');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const terminalActive = terminal?.status === 'Active';
  const shiftOpen = shift?.status === 'Open';
  const drawerReady = !cashSalesRequireDrawer || Boolean(currentDrawer);
  const readyToSell = Boolean(readiness?.allowed && terminalActive && shiftOpen && drawerReady && !recoverable);

  const recommendedStep = useMemo<WizardStep>(() => {
    if (!terminalActive) return 'terminal';
    if (recoverable) return 'recovery';
    if (!drawerReady) return 'drawer';
    if (!shiftOpen) return 'shift';
    return 'ready';
  }, [drawerReady, recoverable, shiftOpen, terminalActive]);

  useEffect(() => {
    if (!open) return;
    setActiveStep(recommendedStep);
    setDrawerId(currentDrawer?.drawerId || 'DRAWER-POS-01-A');
    setMessage('');
    onDirtyChange?.(false);
  }, [currentDrawer?.drawerId, onDirtyChange, open, recommendedStep]);

  if (!open) return null;

  const markDirty = () => onDirtyChange?.(true);

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
      onDirtyChange?.(false);
    } finally {
      setSaving(false);
    }
  };

  const submitDrawer = async (event: FormEvent) => {
    event.preventDefault();
    if (!canAssignDrawer) {
      setMessage(permissionMessage(false));
      return;
    }
    if (cashSalesRequireDrawer && !drawerId.trim()) {
      setMessage('Assign a cash drawer before allowing cash sales.');
      return;
    }
    await runAction(
      () => onAssignDrawer({
        drawerId: drawerId.trim(),
        openingFloat: Math.max(0, Number(openingFloat) || 0),
        cashSalesEnabled: cashSalesRequireDrawer,
        notes: drawerNotes.trim()
      }),
      'Cash drawer assigned.'
    );
    setActiveStep('shift');
  };

  const submitOpenShift = async (event: FormEvent) => {
    event.preventDefault();
    if (!canOpenShift) {
      setMessage(permissionMessage(false));
      return;
    }
    if (!staffName.trim()) {
      setMessage('Select a staff member before opening shift.');
      return;
    }
    if (!branchName.trim()) {
      setMessage('Select a branch before opening shift.');
      return;
    }
    if (!terminalName.trim()) {
      setMessage('Select a terminal before opening shift.');
      return;
    }
    if (!terminalActive) {
      setMessage('Activate this terminal before opening shift.');
      return;
    }
    if (shiftOpen) {
      setMessage('A shift is already open for this terminal.');
      setActiveStep('ready');
      return;
    }
    if (recoverable) {
      setMessage('Recover or clear previous shift state before opening a new shift.');
      setActiveStep('recovery');
      return;
    }
    if (cashSalesRequireDrawer && !currentDrawer && !drawerId.trim()) {
      setMessage('Assign a cash drawer before allowing cash sales.');
      setActiveStep('drawer');
      return;
    }
    await runAction(
      () => onOpenShift({
        openingFloat: Math.max(0, Number(openingFloat) || 0),
        drawerId: currentDrawer?.drawerId || drawerId.trim(),
        notes: shiftNotes.trim()
      }),
      'Shift opened. Sales Terminal is ready.'
    );
    setActiveStep('ready');
  };

  return (
    <div className="shift-control-modal-backdrop" role="presentation">
      <section className="shift-control-modal shift-start-wizard" role="dialog" aria-modal="true" aria-labelledby="shift-start-wizard-title">
        <header className="shift-control-modal__header">
          <div>
            <p className="sci-pos-eyebrow">Guided Shift Start</p>
            <h2 id="shift-start-wizard-title">Start Selling</h2>
            <span>We will check the terminal, drawer, and shift so you can begin sales safely.</span>
          </div>
          <button type="button" className="sci-icon-button" onClick={onCancel} aria-label="Cancel start selling">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="shift-control-modal__body">
          <div className="shift-start-steps" aria-label="Start selling steps">
            {stepOrder.map((step) => (
              <button key={step} type="button" className={activeStep === step ? 'active' : ''} onClick={() => setActiveStep(step)}>
                {stepLabels[step]}
              </button>
            ))}
          </div>

          {activeStep === 'terminal' && (
            <section className="shift-start-step-card">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>Terminal Check</strong>
                <span>{terminalName} / {branchName}</span>
                <p>Status: {terminalActive ? 'Active' : 'Not Active'}. {readiness?.message || 'Run a quick check before opening shift.'}</p>
              </div>
              <div className="shift-start-actions">
                <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => runAction(onRunTerminalCheck, 'Terminal check complete.')} disabled={saving || !canRunReadinessCheck}>
                  Check Terminal
                </button>
                {!terminalActive && (
                  <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => runAction(onActivateTerminal, 'Terminal activated.')} disabled={saving || !canActivateTerminal}>
                    Activate Terminal
                  </button>
                )}
                {terminalActive && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setActiveStep(recoverable ? 'recovery' : drawerReady ? 'shift' : 'drawer')}>Next</button>}
              </div>
            </section>
          )}

          {activeStep === 'recovery' && (
            <section className="shift-start-step-card">
              <RotateCcw size={22} aria-hidden="true" />
              <div>
                <strong>Recovery Check</strong>
                <span>{recoverable ? 'Previous Shift State Found' : 'No recovery issue found.'}</span>
                <p>{recoverable ? 'This device was interrupted during a shift process. Recover the last state before continuing sales.' : 'No interrupted shift process is blocking this terminal.'}</p>
              </div>
              <div className="shift-start-actions">
                {recoverable && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => runAction(onRecoverState, 'Previous shift state recovered.')} disabled={saving || !canRecoverShift}>Recover Last State</button>}
                {recoverable && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onReviewRecovery}>Review Recovery Details</button>}
                {recoverable && <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => runAction(onClearRecovery, 'Recovery state cleared.')} disabled={saving || !canOverrideRecovery}>Clear Recovery</button>}
                {!recoverable && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setActiveStep(drawerReady ? 'shift' : 'drawer')}>Next</button>}
              </div>
            </section>
          )}

          {activeStep === 'drawer' && (
            <form className="shift-start-step-card" onSubmit={submitDrawer}>
              <Wallet size={22} aria-hidden="true" />
              <div>
                <strong>Drawer Assignment</strong>
                <span>{drawerReady ? `Drawer ready: ${currentDrawer?.drawerId || 'Not required'}` : 'Cash drawer required'}</span>
                <p>{cashSalesRequireDrawer ? 'Assign a drawer so cash sales can be processed safely.' : 'Drawer assignment is not required for this shift.'}</p>
                {!drawerReady && (
                  <div className="shift-modal-grid shift-start-inline-form">
                    <label>Drawer<input value={drawerId} onChange={(event) => { setDrawerId(event.target.value); markDirty(); }} /></label>
                    <label>Opening Float<input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => { setOpeningFloat(event.target.value); markDirty(); }} /></label>
                    <label className="shift-modal-span">Notes<textarea rows={3} value={drawerNotes} onChange={(event) => { setDrawerNotes(event.target.value); markDirty(); }} /></label>
                  </div>
                )}
              </div>
              <div className="shift-start-actions">
                {!drawerReady && <button type="submit" className="sci-pos-button sci-pos-button--primary" disabled={saving || !canAssignDrawer}>Assign Drawer</button>}
                {drawerReady && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setActiveStep('shift')}>Next</button>}
              </div>
            </form>
          )}

          {activeStep === 'shift' && (
            <form className="shift-start-step-card" onSubmit={submitOpenShift}>
              <Unlock size={22} aria-hidden="true" />
              <div>
                <strong>Open Shift</strong>
                <span>{shiftOpen ? 'Shift is already open.' : 'Open the shift for sales.'}</span>
                <div className="shift-modal-grid shift-start-inline-form">
                  <label>Staff<input value={staffName} readOnly /></label>
                  <label>Branch<input value={branchName} readOnly /></label>
                  <label>Terminal<input value={terminalName} readOnly /></label>
                  <label>Opening Float<input type="number" min="0" step="0.01" value={openingFloat} onChange={(event) => { setOpeningFloat(event.target.value); markDirty(); }} /></label>
                  <label className="shift-modal-span">Shift Notes<textarea rows={3} value={shiftNotes} onChange={(event) => { setShiftNotes(event.target.value); markDirty(); }} /></label>
                </div>
              </div>
              <div className="shift-start-actions">
                {!shiftOpen && <button type="submit" className="sci-pos-button sci-pos-button--primary" disabled={saving || !canOpenShift}>Open Shift</button>}
                {shiftOpen && <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={() => setActiveStep('ready')}>Next</button>}
              </div>
            </form>
          )}

          {activeStep === 'ready' && (
            <section className="shift-start-step-card shift-start-ready">
              <CheckCircle size={24} aria-hidden="true" />
              <div>
                <strong>Ready to Sell</strong>
                <span>{readyToSell ? 'Shift is open. Terminal is ready.' : 'One more check is required before sales.'}</span>
                <p>{readyToSell ? 'Product search and cart checkout are active for this terminal.' : readiness?.message || 'Run Start Selling again after completing the required step.'}</p>
              </div>
              <div className="shift-start-actions">
                <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onGoToSales} disabled={!readyToSell}>Go to Sales Terminal</button>
              </div>
            </section>
          )}

          {message && <div className={`sci-pos-alert ${message.includes('permission') || message.includes('before') ? 'sci-pos-alert--danger' : ''}`} role="status">{message}</div>}
        </div>
        <footer className="shift-control-modal__footer">
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => setActiveStep(recommendedStep)} disabled={saving}>Go to Next Required Step</button>
        </footer>
      </section>
    </div>
  );
}
