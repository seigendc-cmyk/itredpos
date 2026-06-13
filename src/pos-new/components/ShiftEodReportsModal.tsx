import { FileText, Printer, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ShiftEodPrintPayload } from '../services/shiftEodReportService';
import ShiftEodReportDocument from './ShiftEodReportDocument';

interface ShiftEodReportsModalProps {
  open: boolean;
  payload: ShiftEodPrintPayload | null;
  onClose: () => void;
  onReportEvent?: (eventType: string, message: string) => void;
}

export default function ShiftEodReportsModal({ open, payload, onClose, onReportEvent }: ShiftEodReportsModalProps) {
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    if (!open || !payload) return;
    setStatusMessage('');
    onReportEvent?.('SHIFT_EOD_REPORT_PREVIEW_OPENED', `${payload.reportNumber} preview opened.`);
  }, [onReportEvent, open, payload]);

  if (!open) return null;

  const handlePrint = (mode: 'print' | 'pdf') => {
    if (!payload) {
      setStatusMessage('Generate EOD report before printing.');
      onReportEvent?.('SHIFT_EOD_REPORT_PRINT_FAILED', 'Shift EOD report print blocked because no report payload exists.');
      return;
    }
    const eventType = mode === 'pdf' ? 'SHIFT_EOD_REPORT_PDF_PRINT_STARTED' : 'SHIFT_EOD_REPORT_PRINT_STARTED';
    setStatusMessage(mode === 'pdf' ? payload.pdfInstruction : 'Preparing Shift EOD report for print.');
    onReportEvent?.('SHIFT_EOD_REPORT_PRINT_PREPARED', `${payload.reportNumber} print area prepared.`);
    window.setTimeout(() => {
      try {
        onReportEvent?.(eventType, `${payload.reportNumber} print dialog opened.`);
        window.print();
      } catch {
        setStatusMessage('Print dialog could not be opened for this device.');
        onReportEvent?.('SHIFT_EOD_REPORT_PRINT_FAILED', `${payload.reportNumber} print dialog failed.`);
      }
    }, 50);
  };

  return (
    <div className="shift-control-modal-backdrop shift-eod-print-host" role="presentation">
      <section className="shift-control-modal shift-control-modal--wide shift-eod-report-card" role="dialog" aria-modal="true" aria-labelledby="shift-eod-title">
        <header className="shift-control-modal__header no-print">
          <div>
            <p className="sci-pos-eyebrow">{payload?.businessName || 'iTred Commerce POS'}</p>
            <h2 id="shift-eod-title">Shift EOD Reports</h2>
          </div>
          <button type="button" className="sci-icon-button" onClick={onClose} aria-label="Close EOD reports">
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="shift-eod-report-toolbar no-print">
          <div>
            <strong>{payload ? payload.reportNumber : 'No report generated'}</strong>
            <span>{statusMessage || 'Preview is ready for device print output.'}</span>
          </div>
          <div className="shift-eod-report-toolbar__actions">
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handlePrint('print')} disabled={!payload}>
              <Printer size={16} aria-hidden="true" />
              Print EOD Report
            </button>
            <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => handlePrint('pdf')} disabled={!payload}>
              <FileText size={16} aria-hidden="true" />
              Save as PDF via device print dialog
            </button>
            <button type="button" className="sci-pos-button sci-pos-button--primary" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="shift-control-modal__body shift-eod-report-body">
          {payload ? (
            <div className="shift-eod-report-preview">
              <ShiftEodReportDocument payload={payload} />
            </div>
          ) : (
            <div className="sci-pos-empty-cell">Generate EOD report before printing.</div>
          )}
        </div>
      </section>
    </div>
  );
}
