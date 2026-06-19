import React, { useState } from 'react';
import { Download, Maximize2, Minimize2, Square, X } from 'lucide-react';
import {
  AccountingMappingRule,
  ChartOfAccountsPlaceholder,
  InventoryAccountingReadinessLine,
  InventoryAccountingReadinessRecord
} from '../types';

interface Props {
  record: InventoryAccountingReadinessRecord;
  lines: InventoryAccountingReadinessLine[];
  accounts: ChartOfAccountsPlaceholder[];
  mappingRules: AccountingMappingRule[];
  onClose: () => void;
  onReview: (notes: string) => void;
  onApprove: (notes: string) => void;
  onHold: (notes: string) => void;
  onReject: (notes: string) => void;
  onMarkPosted: (notes: string) => void;
  onExport: () => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="border border-[#d7dce5] bg-white p-3">
      <div className="text-[9px] uppercase text-slate-500 font-black">{label}</div>
      <div className="text-xs text-[#1f2937] font-semibold mt-1 break-words">{value || '-'}</div>
    </div>
  );
}

function Badge({ value }: { value: string }) {
  const tone = value.includes('Critical') || value.includes('Rejected')
    ? 'bg-red-50 text-red-800 border-red-300'
    : value.includes('High') || value.includes('Hold') || value.includes('Pending')
      ? 'bg-orange-50 text-orange-800 border-orange-300'
      : 'bg-emerald-50 text-emerald-800 border-emerald-300';
  return <span className={`px-2 py-1 border text-[9px] font-black uppercase ${tone}`}>{value}</span>;
}

export default function InventoryAccountingReadinessForm({
  record,
  lines,
  accounts,
  mappingRules,
  onClose,
  onReview,
  onApprove,
  onHold,
  onReject,
  onMarkPosted,
  onExport
}: Props) {
  const [notes, setNotes] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-auto flex items-start justify-center">
      <div className={`bg-[#f4f6f8] border border-[#111827] shadow-xl rounded-none w-full ${isMaximized ? 'max-w-none min-h-[calc(100vh-2rem)]' : 'max-w-6xl'}`}>
        <div className="bg-[#252a31] text-white px-4 py-3 flex justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase text-orange-300 font-black">Inventory Accounting Readiness</div>
            <h2 className="text-lg font-black">{record.readinessNumber}</h2>
            <div className="text-[10px] text-slate-200 font-semibold">Review inventory value impact before accounting posting.</div>
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
            <span className="text-xs font-black uppercase">{record.readinessNumber} minimized</span>
            <button type="button" onClick={() => setIsMinimized(false)} className="px-3 py-2 bg-orange-600 text-white text-[10px] font-black uppercase rounded-none">Restore</button>
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-orange-200 bg-orange-50 text-[10px] uppercase font-black text-orange-900">
              This is a review layer only. No cashbook, bank, supplier payment, customer payment, stock quantity, or final journal is posted in this build.
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label="Readiness Number" value={record.readinessNumber} />
              <Field label="Source Type" value={record.sourceType} />
              <Field label="Source Number" value={record.sourceNumber} />
              <Field label="Movement Type" value={record.movementType} />
              <Field label="Impact Type" value={record.impactType} />
              <Field label="Branch" value={record.branchName} />
              <Field label="Warehouse" value={record.warehouseName} />
              <Field label="Status" value={<Badge value={record.status} />} />
              <Field label="Risk Level" value={<Badge value={record.riskLevel} />} />
              <Field label="Total Value Impact" value={money(record.totalValueImpact)} />
              <Field label="Currency" value={record.currency} />
              <Field label="Reviewed By" value={record.reviewedByStaffName} />
              <Field label="Approved By" value={record.approvedByStaffName} />
              <div className="md:col-span-3"><Field label="Notes" value={record.notes} /></div>
            </div>

            <div className="px-4 pb-4 space-y-4">
              <Table title="Readiness Lines" headers={['SKU', 'Product', 'Movement Type', 'Qty In', 'Qty Out', 'Unit Cost', 'Value Impact', 'Debit Account', 'Credit Account', 'Mapping Status', 'Notes']} rows={lines.map((line) => [line.sku, line.productName, line.movementType, line.qtyIn, line.qtyOut, money(line.unitCost), money(line.valueImpact), `${line.debitAccountCode || '-'} ${line.debitAccountName || ''}`, `${line.creditAccountCode || '-'} ${line.creditAccountName || ''}`, line.mappingStatus, line.notes])} />
              <Table title="Chart Of Accounts Preview" headers={['Account Code', 'Account Name', 'Account Type', 'Normal Balance', 'Linked Domain', 'Status']} rows={accounts.map((account) => [account.accountCode, account.accountName, account.accountType, account.normalBalance, account.linkedDomain, account.status])} />
              <Table title="Impact Mapping Rules" headers={['Movement Type', 'Impact Type', 'Debit', 'Credit', 'Mapping Status', 'Notes']} rows={mappingRules.map((rule) => [rule.movementType, rule.impactType, rule.debitAccountCode || '-', rule.creditAccountCode || '-', rule.mappingStatus, rule.notes])} />

              <label className="block">
                <span className="text-[9px] uppercase text-slate-500 font-black">Action Notes</span>
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full mt-1 border border-[#b1b5c2] p-2 text-xs rounded-none min-h-[72px]" />
              </label>
            </div>

            <div className="p-4 bg-white border-t border-[#d7dce5] flex flex-wrap justify-end gap-2">
              <Action onClick={() => onReview(notes)} label="Review" />
              <Action onClick={() => onApprove(notes)} label="Approve For Posting" primary />
              <Action onClick={() => onHold(notes)} label="Hold" />
              <Action onClick={() => onReject(notes)} label="Reject" />
              <Action onClick={() => onMarkPosted(notes)} label="Mark Posted Preview" />
              <button type="button" onClick={onExport} className="px-3 py-2 border border-[#b1b5c2] text-[#252a31] text-[10px] font-black uppercase rounded-none flex items-center gap-2"><Download className="w-4 h-4" /> Prepare Export</button>
              <Action onClick={onClose} label="Close" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Action({ label, onClick, primary = false }: { label: string; onClick: () => void; primary?: boolean }) {
  return <button type="button" onClick={onClick} className={`px-3 py-2 border text-[10px] font-black uppercase rounded-none ${primary ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b1b5c2] text-[#252a31]'}`}>{label}</button>;
}

function Table({ title, headers, rows }: { title: string; headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="border border-[#d7dce5] bg-white overflow-auto">
      <div className="bg-[#252a31] text-white px-3 py-2 text-[10px] font-black uppercase">{title}</div>
      <table className="w-full text-xs">
        <thead><tr>{headers.map((header) => <th key={header} className="p-2 text-left text-[9px] uppercase font-black bg-slate-100">{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[#e5e7eb]">{row.map((cell, cellIndex) => <td key={cellIndex} className="p-2 text-[#252a31]">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
