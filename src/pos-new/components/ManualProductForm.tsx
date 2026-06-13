import React, { useMemo, useState } from 'react';
import { Maximize2, Minimize2, Save, Search, Square, X } from 'lucide-react';
import {
  IndustrialSectorCode,
  ManualProductDraft,
  ManualProductValidationIssue,
  OpeningBalanceDraft,
  ProductCreationActivityEvent,
  ProductMasterRecord,
  ProductCreationStatus
} from '../types';

type ManualProductTab = 'Product Identity' | 'Sector Attributes' | 'Pricing' | 'Supplier Link' | 'Stock Setup' | 'Validation' | 'Activity';

interface ManualProductFormProps {
  draft: ManualProductDraft;
  validationIssues: ManualProductValidationIssue[];
  activity: ProductCreationActivityEvent[];
  openingBalanceDrafts: OpeningBalanceDraft[];
  savedProduct: ProductMasterRecord | null;
  duplicateProduct: ProductMasterRecord | null;
  notice?: string | null;
  onChange: (patch: Partial<ManualProductDraft>) => void;
  onSaveDraft: () => void;
  onActivate: () => void;
  onCreateOpeningBalance: () => void;
  onCheckDuplicate: () => void;
  onClear: () => void;
  onClose: () => void;
}

const tabs: ManualProductTab[] = ['Product Identity', 'Sector Attributes', 'Pricing', 'Supplier Link', 'Stock Setup', 'Validation', 'Activity'];
const sectors: IndustrialSectorCode[] = ['MOTOR_SPARES', 'HARDWARE', 'SOLAR_PRODUCTS', 'GENERAL_RETAIL', 'GROCERY', 'AGRICULTURE', 'CLOTHING', 'FURNITURE', 'ELECTRONICS', 'LUBRICANTS', 'PHARMACY', 'BUILDING_MATERIALS', 'OTHER'];

export default function ManualProductForm({
  draft,
  validationIssues,
  activity,
  openingBalanceDrafts,
  savedProduct,
  duplicateProduct,
  notice,
  onChange,
  onSaveDraft,
  onActivate,
  onCreateOpeningBalance,
  onCheckDuplicate,
  onClear,
  onClose
}: ManualProductFormProps) {
  const [activeTab, setActiveTab] = useState<ManualProductTab>('Product Identity');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const hasErrors = validationIssues.some((issue) => issue.severity === 'Error');
  const margin = useMemo(() => {
    const selling = Number(draft.sellingPrice || 0);
    const cost = Number(draft.costPrice || 0);
    return selling > 0 ? Math.round(((selling - cost) / selling) * 100) : 0;
  }, [draft.costPrice, draft.sellingPrice]);
  const markup = useMemo(() => {
    const selling = Number(draft.sellingPrice || 0);
    const cost = Number(draft.costPrice || 0);
    return cost > 0 ? Math.round(((selling - cost) / cost) * 100) : 0;
  }, [draft.costPrice, draft.sellingPrice]);

  const setNumber = (key: keyof ManualProductDraft, value: string) => onChange({ [key]: value === '' ? undefined : Number(value) } as Partial<ManualProductDraft>);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4 overflow-auto flex items-start justify-center">
      <div className={`bg-[#f4f6f8] border border-[#111827] shadow-xl rounded-none w-full ${isMaximized ? 'max-w-none min-h-[calc(100vh-2rem)]' : 'max-w-7xl'}`}>
        <div className="bg-[#252a31] text-white px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase text-orange-300 font-black">New Product</div>
            <h2 className="text-base font-black uppercase">Create product identity, sector attributes, pricing, supplier link, and opening balance draft.</h2>
            <p className="text-[10px] text-slate-200 uppercase mt-1">Product creation does not post stock. Opening quantity creates a draft until approved and posted.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsMinimized(true)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Minimize"><Minimize2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsMinimized(false)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Restore"><Square className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsMaximized((current) => !current)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Maximize"><Maximize2 className="w-4 h-4" /></button>
            <button type="button" onClick={onClose} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {isMinimized ? (
          <div className="bg-white p-4 flex items-center justify-between">
            <span className="text-xs font-black uppercase">New Product form minimized</span>
            <button type="button" onClick={() => setIsMinimized(false)} className="px-3 py-2 bg-orange-600 border border-orange-700 text-white text-[10px] font-black uppercase rounded-none">Restore</button>
          </div>
        ) : (
        <>
          <div className="bg-white border-b border-[#d7dce5] px-4 py-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-3 py-2 border text-[9px] font-black uppercase rounded-none ${activeTab === tab ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b8c0cc] text-[#252a31]'}`}>{tab}</button>
            ))}
          </div>

          {notice && <div className="m-4 mb-0 border border-orange-300 bg-orange-50 p-3 text-[10px] font-black uppercase text-slate-800">{notice}</div>}

          <div className="p-4 min-h-[470px]">
            {activeTab === 'Product Identity' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input wide label="Product Name" value={draft.productName} onChange={(value) => onChange({ productName: value })} />
                <Input label="SKU" value={draft.sku || ''} onChange={(value) => onChange({ sku: value })} />
                <Input label="Barcode" value={draft.barcode || ''} onChange={(value) => onChange({ barcode: value })} />
                <Input label="ALU" value={draft.alu || ''} onChange={(value) => onChange({ alu: value })} />
                <Input label="Vendor SKU" value={draft.vendorSku || ''} onChange={(value) => onChange({ vendorSku: value })} />
                <Input label="Product Numeric Number" value={draft.productNumericNumber || ''} onChange={(value) => onChange({ productNumericNumber: value })} />
                <Input label="Brand" value={draft.brand || ''} onChange={(value) => onChange({ brand: value })} />
                <Input label="Manufacturer" value={draft.manufacturer || ''} onChange={(value) => onChange({ manufacturer: value })} />
                <Select label="Industrial Sector" value={draft.industrialSector} options={sectors} onChange={(value) => onChange({ industrialSector: value })} />
                <Input label="Category" value={draft.category || ''} onChange={(value) => onChange({ category: value })} />
                <Input label="Subcategory" value={draft.subcategory || ''} onChange={(value) => onChange({ subcategory: value })} />
                <Input label="Unit of Measure" value={draft.unitOfMeasure || ''} onChange={(value) => onChange({ unitOfMeasure: value })} />
                <Input label="Condition" value={draft.condition || ''} onChange={(value) => onChange({ condition: value })} />
                <Input label="Colour" value={draft.colour || ''} onChange={(value) => onChange({ colour: value })} />
                <Select label="Product Status" value={draft.productStatus} options={['Draft', 'Active', 'Pending Review', 'Blocked', 'Rejected']} onChange={(value) => onChange({ productStatus: value as ProductCreationStatus })} />
                <Input wide label="Tags" value={(draft.tags || []).join(', ')} onChange={(value) => onChange({ tags: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
                <TextArea wide label="Description" value={draft.description || ''} onChange={(value) => onChange({ description: value })} />
                <div className="md:col-span-4 flex flex-wrap gap-2">
                  <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onChange({ sku: draft.sku || `SKU-${Date.now().toString().slice(-6)}` })}>Generate SKU Placeholder</button>
                  <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCheckDuplicate}><Search className="w-4 h-4" /> Check Duplicate</button>
                  <button type="button" className="sci-pos-button" onClick={onSaveDraft}><Save className="w-4 h-4" /> Save Draft</button>
                  {duplicateProduct && <span className="border border-orange-300 bg-orange-50 px-3 py-2 text-[10px] font-black uppercase text-orange-900">Duplicate risk: {duplicateProduct.productName}</span>}
                </div>
              </div>
            )}

            {activeTab === 'Sector Attributes' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {draft.industrialSector === 'MOTOR_SPARES' && <>
                  <Input label="Make" value={draft.make || ''} onChange={(value) => onChange({ make: value })} />
                  <Input label="Model" value={draft.model || ''} onChange={(value) => onChange({ model: value })} />
                  <Input label="Year From" value={draft.yearFrom || ''} onChange={(value) => onChange({ yearFrom: value })} />
                  <Input label="Year To" value={draft.yearTo || ''} onChange={(value) => onChange({ yearTo: value })} />
                  <Input label="Side" value={draft.side || ''} onChange={(value) => onChange({ side: value })} />
                  <Input label="Part Number" value={draft.partNumber || ''} onChange={(value) => onChange({ partNumber: value })} />
                  <Input label="OEM Number" value={draft.oemNumber || ''} onChange={(value) => onChange({ oemNumber: value })} />
                  <Input label="Engine Code Placeholder" value={draft.engineCode || ''} onChange={(value) => onChange({ engineCode: value })} />
                  <Input label="Chassis Code Placeholder" value={draft.chassisCode || ''} onChange={(value) => onChange({ chassisCode: value })} />
                </>}
                {['HARDWARE', 'GENERAL_RETAIL'].includes(draft.industrialSector) && <>
                  <Input label="Size" value={draft.size || ''} onChange={(value) => onChange({ size: value })} />
                  <Input label="Material" value={draft.material || ''} onChange={(value) => onChange({ material: value })} />
                  <Input label="Grade" value={draft.grade || ''} onChange={(value) => onChange({ grade: value })} />
                  <Input label="Product Type" value={draft.productType || ''} onChange={(value) => onChange({ productType: value })} />
                  {draft.industrialSector === 'GENERAL_RETAIL' && <Input label="Colour" value={draft.colour || ''} onChange={(value) => onChange({ colour: value })} />}
                </>}
                {draft.industrialSector === 'SOLAR_PRODUCTS' && <>
                  <Input label="Wattage" value={draft.wattage || ''} onChange={(value) => onChange({ wattage: value })} />
                  <Input label="Voltage" value={draft.voltage || ''} onChange={(value) => onChange({ voltage: value })} />
                  <Input label="Battery Capacity" value={draft.batteryCapacity || ''} onChange={(value) => onChange({ batteryCapacity: value })} />
                  <Input label="Panel Type" value={draft.panelType || ''} onChange={(value) => onChange({ panelType: value })} />
                  <Input label="Inverter Type" value={draft.inverterType || ''} onChange={(value) => onChange({ inverterType: value })} />
                </>}
                {!['MOTOR_SPARES', 'HARDWARE', 'GENERAL_RETAIL', 'SOLAR_PRODUCTS'].includes(draft.industrialSector) && <div className="md:col-span-4 border border-[#d7dce5] bg-white p-4 text-xs uppercase font-bold text-slate-600">No special sector fields required for this sector in build-development.</div>}
              </div>
            )}

            {activeTab === 'Pricing' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input label="Cost Price" type="number" value={String(draft.costPrice ?? '')} onChange={(value) => setNumber('costPrice', value)} />
                <Input label="Selling Price" type="number" value={String(draft.sellingPrice ?? '')} onChange={(value) => setNumber('sellingPrice', value)} />
                <Select label="Tax Mode" value={draft.taxMode || 'VAT Registered'} options={['VAT Registered', 'VAT Exempt', 'Zero Rated', 'Inclusive VAT']} onChange={(value) => onChange({ taxMode: value })} />
                <Input label="VAT Rate" type="number" value={String(draft.vatRate ?? 15)} onChange={(value) => setNumber('vatRate', value)} />
                <ReadOnly label="Margin Placeholder" value={`${margin}%`} />
                <ReadOnly label="Markup Placeholder" value={`${markup}%`} />
                <Input label="Price Effective Date" type="date" value={draft.priceEffectiveDate || ''} onChange={(value) => onChange({ priceEffectiveDate: value })} />
                <Input label="Price Notes" value={draft.priceNotes || ''} onChange={(value) => onChange({ priceNotes: value })} />
                <div className="md:col-span-4 border border-orange-200 bg-orange-50 p-3 text-[10px] uppercase font-black text-orange-900">Price changes do not affect stock quantities.</div>
              </div>
            )}

            {activeTab === 'Supplier Link' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input label="Supplier Name" value={draft.supplierName || ''} onChange={(value) => onChange({ supplierName: value })} />
                <Input label="Supplier Item Code" value={draft.supplierItemCode || ''} onChange={(value) => onChange({ supplierItemCode: value })} />
                <Input label="Supplier Contact" value={draft.supplierContact || ''} onChange={(value) => onChange({ supplierContact: value })} />
                <Input label="Supplier Phone" value={draft.supplierPhone || ''} onChange={(value) => onChange({ supplierPhone: value })} />
                <Input label="Supplier Email" value={draft.supplierEmail || ''} onChange={(value) => onChange({ supplierEmail: value })} />
                <Input label="Last Cost" type="number" value={String(draft.lastCost ?? '')} onChange={(value) => setNumber('lastCost', value)} />
                <Input label="Lead Time Days" type="number" value={String(draft.leadTimeDays ?? '')} onChange={(value) => setNumber('leadTimeDays', value)} />
                <Input label="Minimum Order Qty" type="number" value={String(draft.minimumOrderQty ?? '')} onChange={(value) => setNumber('minimumOrderQty', value)} />
                <label className="border border-[#d7dce5] bg-white p-3 flex items-center gap-2 text-[10px] font-black uppercase"><input type="checkbox" checked={draft.preferredSupplier ?? true} onChange={(event) => onChange({ preferredSupplier: event.target.checked })} /> Preferred Supplier</label>
                <TextArea wide label="Notes" value={draft.supplierNotes || ''} onChange={(value) => onChange({ supplierNotes: value })} />
              </div>
            )}

            {activeTab === 'Stock Setup' && (
              <div className="space-y-3">
                <div className="border border-orange-300 bg-orange-50 p-3 text-[10px] uppercase font-black text-orange-900">Opening quantity does not post stock immediately. It creates an Opening Balance Draft that must be approved and posted.</div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Input label="Branch" value={draft.branchId || ''} onChange={(value) => onChange({ branchId: value })} />
                  <Input label="Warehouse" value={draft.warehouseId || ''} onChange={(value) => onChange({ warehouseId: value })} />
                  <Input label="Shelf / Location" value={draft.shelfLocation || ''} onChange={(value) => onChange({ shelfLocation: value })} />
                  <Input label="Opening Qty" type="number" value={String(draft.openingQty ?? '')} onChange={(value) => setNumber('openingQty', value)} />
                  <Input label="Unit Cost" type="number" value={String(draft.openingUnitCost ?? '')} onChange={(value) => setNumber('openingUnitCost', value)} />
                  <Input label="Reorder Level" type="number" value={String(draft.reorderLevel ?? '')} onChange={(value) => setNumber('reorderLevel', value)} />
                  <Input label="Reorder Qty" type="number" value={String(draft.reorderQty ?? '')} onChange={(value) => setNumber('reorderQty', value)} />
                  <Select label="Location Type" value={draft.locationType || 'Main Warehouse'} options={['Main Warehouse', 'Branch Warehouse', 'Sales Floor', 'Back Store', 'Shelf', 'Other']} onChange={(value) => onChange({ locationType: value as ManualProductDraft['locationType'] })} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="sci-pos-button" onClick={onCreateOpeningBalance}>Create Opening Balance Draft</button>
                  <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onChange({ notes: 'Stock Adjustment Placeholder opened from manual product form.' })}>Open Stock Adjustment Placeholder</button>
                </div>
                <SimpleTable headers={['Draft No.', 'Date', 'Product', 'SKU', 'Branch', 'Warehouse', 'Shelf', 'Qty', 'Unit Cost', 'Value Estimate', 'Status', 'Created By']}>
                  {openingBalanceDrafts.map((draftRow) => <tr key={draftRow.openingBalanceId}><Td>{draftRow.openingBalanceNumber}</Td><Td>{draftRow.createdAt.slice(0, 10)}</Td><Td>{draftRow.productName}</Td><Td>{draftRow.sku}</Td><Td>{draftRow.branchId}</Td><Td>{draftRow.warehouseId}</Td><Td>{draftRow.shelfLocation || '-'}</Td><Td>{draftRow.qty}</Td><Td>{draftRow.unitCost}</Td><Td>{draftRow.valueEstimate}</Td><Td><Badge value={draftRow.status} /></Td><Td>{draftRow.createdByStaffName}</Td></tr>)}
                </SimpleTable>
              </div>
            )}

            {activeTab === 'Validation' && (
              <SimpleTable headers={['Field', 'Severity', 'Message', 'Suggested Fix']}>
                {validationIssues.map((issue) => <tr key={issue.issueId}><Td>{issue.field}</Td><Td><Badge value={issue.severity} /></Td><Td>{issue.message}</Td><Td>{issue.suggestedFix}</Td></tr>)}
                {validationIssues.length === 0 && <tr><td colSpan={4} className="p-4 text-xs font-bold uppercase text-slate-600">No validation issues.</td></tr>}
              </SimpleTable>
            )}

            {activeTab === 'Activity' && (
              <SimpleTable headers={['Date', 'Event', 'Message', 'Staff']}>
                {activity.map((event) => <tr key={event.eventId}><Td>{event.createdAt}</Td><Td>{event.eventType}</Td><Td>{event.message}</Td><Td>{event.staffName || event.staffId || '-'}</Td></tr>)}
              </SimpleTable>
            )}
          </div>

          <div className="p-4 bg-white border-t border-[#d7dce5] flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] uppercase font-black text-slate-700">{savedProduct ? `Saved product: ${savedProduct.sku}` : 'No product saved yet'} {hasErrors ? '| Activation blocked by errors' : ''}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCheckDuplicate}>Check Duplicate</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClear}>Clear Form</button>
              <button type="button" className="sci-pos-button" onClick={onSaveDraft}>Save Draft</button>
              <button type="button" className="sci-pos-button bg-[#252a31] border-[#111827]" onClick={onActivate}>Activate Product</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCreateOpeningBalance}>Create Opening Balance Draft</button>
              <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onClose}>Close</button>
            </div>
          </div>
        </>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', wide }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return <label className={`block border border-[#d7dce5] bg-white p-3 ${wide ? 'md:col-span-2' : ''}`}><span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500" /></label>;
}

function TextArea({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={`block border border-[#d7dce5] bg-white p-3 ${wide ? 'md:col-span-4' : ''}`}><span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500" /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="block border border-[#d7dce5] bg-white p-3"><span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d7dce5] bg-slate-50 p-3"><span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span><strong className="block text-sm mt-1">{value}</strong></div>;
}

function SimpleTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-auto border border-[#d7dce5] bg-white"><table className="w-full text-xs"><thead className="bg-[#252a31] text-white"><tr>{headers.map((header) => <th key={header} className="p-2 text-left text-[9px] uppercase font-black">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-2 border-t border-[#e5e7eb] text-[#252a31]">{children}</td>;
}

function Badge({ value }: { value: string }) {
  const danger = ['Error', 'Cancelled', 'Blocked', 'Rejected'].includes(value);
  const warn = ['Warning', 'Draft', 'Pending Approval', 'Approved', 'Pending Review'].includes(value);
  return <span className={`px-2 py-1 border text-[8px] font-black uppercase ${danger ? 'bg-red-50 text-red-700 border-red-200' : warn ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{value}</span>;
}
