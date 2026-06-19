import React, { useMemo, useState } from 'react';
import { Maximize2, Minimize2, Save, Search, Square, Upload, X } from 'lucide-react';
import {
  IndustrialSectorCode,
  ManualProductDraft,
  ManualProductValidationIssue,
  OpeningBalanceDraft,
  ProductCreationActivityEvent,
  ProductCreationStatus,
  ProductMasterRecord
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

type FieldConfig = {
  key: keyof ManualProductDraft;
  label: string;
  type?: 'text' | 'number' | 'date' | 'textarea' | 'checkbox';
  options?: string[];
  wide?: boolean;
};

const tabs: ManualProductTab[] = ['Product Identity', 'Sector Attributes', 'Pricing', 'Supplier Link', 'Stock Setup', 'Validation', 'Activity'];
const sectors: IndustrialSectorCode[] = ['MOTOR_SPARES', 'HARDWARE', 'GROCERY', 'AGRICULTURE', 'PHARMACY', 'CLOTHING', 'ELECTRONICS', 'LOGISTICS_WAREHOUSING', 'SOLAR_PRODUCTS', 'GENERAL_RETAIL', 'FURNITURE', 'LUBRICANTS', 'BUILDING_MATERIALS', 'OTHER'];
const statusOptions = ['Active', 'Inactive', 'Draft', 'Blocked'];

const sectorFieldMap: Record<string, FieldConfig[]> = {
  GROCERY: [
    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { key: 'batchNumber', label: 'Batch Number' },
    { key: 'packSize', label: 'Pack Size' },
    { key: 'perishableFlag', label: 'Perishable Flag', type: 'checkbox' }
  ],
  HARDWARE: [
    { key: 'material', label: 'Material' },
    { key: 'size', label: 'Size' },
    { key: 'grade', label: 'Grade' },
    { key: 'weight', label: 'Weight' },
    { key: 'warranty', label: 'Warranty' }
  ],
  AGRICULTURE: [
    { key: 'seedVariety', label: 'Seed Variety' },
    { key: 'chemicalActiveIngredient', label: 'Chemical Active Ingredient', wide: true },
    { key: 'applicationRate', label: 'Application Rate' },
    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { key: 'regulatoryNotes', label: 'Regulatory Notes', type: 'textarea', wide: true }
  ],
  MOTOR_SPARES: [
    { key: 'vehicleMake', label: 'Vehicle Make' },
    { key: 'vehicleModel', label: 'Vehicle Model' },
    { key: 'yearRange', label: 'Year Range' },
    { key: 'partNumber', label: 'Part Number' },
    { key: 'oemNumber', label: 'OEM Number' }
  ],
  PHARMACY: [
    { key: 'dosage', label: 'Dosage' },
    { key: 'strength', label: 'Strength' },
    { key: 'batchNumber', label: 'Batch Number' },
    { key: 'expiryDate', label: 'Expiry Date', type: 'date' },
    { key: 'prescriptionRequired', label: 'Prescription Required', type: 'checkbox' }
  ],
  CLOTHING: [
    { key: 'size', label: 'Size' },
    { key: 'colour', label: 'Colour' },
    { key: 'gender', label: 'Gender', options: ['Unspecified', 'Male', 'Female', 'Unisex', 'Kids'] },
    { key: 'fabric', label: 'Fabric' },
    { key: 'style', label: 'Style' }
  ],
  ELECTRONICS: [
    { key: 'modelNumber', label: 'Model Number' },
    { key: 'serialNumberSupport', label: 'Serial Number Support', type: 'checkbox' },
    { key: 'warranty', label: 'Warranty Period' },
    { key: 'powerRating', label: 'Power Rating' }
  ],
  LOGISTICS_WAREHOUSING: [
    { key: 'weight', label: 'Weight' },
    { key: 'dimensions', label: 'Dimensions' },
    { key: 'fragileFlag', label: 'Fragile Flag', type: 'checkbox' },
    { key: 'storageRequirement', label: 'Storage Requirement', type: 'textarea', wide: true }
  ],
  SOLAR_PRODUCTS: [
    { key: 'modelNumber', label: 'Model Number' },
    { key: 'wattage', label: 'Wattage' },
    { key: 'voltage', label: 'Voltage' },
    { key: 'batteryCapacity', label: 'Battery Capacity' },
    { key: 'powerRating', label: 'Power Rating' }
  ]
};

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
  const setBoolean = (key: keyof ManualProductDraft, value: boolean) => onChange({ [key]: value } as Partial<ManualProductDraft>);
  const sectorFields = sectorFieldMap[draft.industrialSector] || [];

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onChange({ imageUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-3 md:p-4 overflow-auto flex items-start justify-center">
      <div className={`bg-[#f4f6f8] border border-[#111827] shadow-xl rounded-none w-full ${isMaximized ? 'max-w-none min-h-[calc(100vh-1.5rem)]' : 'max-w-[1280px]'}`}>
        <div className="bg-[#252a31] text-white px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-orange-300 font-black">Product Master</div>
            <h2 className="text-base font-black uppercase">New Product Setup</h2>
            <p className="text-[10px] text-slate-200 uppercase mt-1">Create product identity, sector attributes, pricing, supplier links, and opening balance drafts.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`px-3 py-2 border text-[9px] font-black uppercase rounded-none ${activeTab === tab ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b8c0cc] text-[#252a31]'}`}>
                  {tab}
                </button>
              ))}
            </div>

            {notice && <div className="m-4 mb-0 border border-orange-300 bg-orange-50 p-3 text-[10px] font-black uppercase text-slate-800">{notice}</div>}

            <div className="p-4 h-[min(72vh,920px)] overflow-y-auto overflow-x-hidden space-y-4">
              {activeTab === 'Product Identity' && (
                <>
                  <SectionCard title="Base Product Identity" description="Core product details saved into the product record and product master.">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input label="Product Name" value={draft.productName} onChange={(value) => onChange({ productName: value })} wide />
                      <Input label="SKU" value={draft.sku || ''} onChange={(value) => onChange({ sku: value })} />
                      <Input label="Barcode" value={draft.barcode || ''} onChange={(value) => onChange({ barcode: value })} />
                      <Input label="ALU" value={draft.alu || ''} onChange={(value) => onChange({ alu: value })} />
                      <Input label="Category" value={draft.category || ''} onChange={(value) => onChange({ category: value })} />
                      <Input label="Brand" value={draft.brand || ''} onChange={(value) => onChange({ brand: value })} />
                      <Input label="Unit of Measure" value={draft.unitOfMeasure || ''} onChange={(value) => onChange({ unitOfMeasure: value })} />
                      <Input label="Pack Size" value={draft.packSize || ''} onChange={(value) => onChange({ packSize: value })} />
                      <Select label="Industrial Sector" value={draft.industrialSector} options={sectors} onChange={(value) => onChange({ industrialSector: value as IndustrialSectorCode })} />
                      <Input label="Supplier" value={draft.supplierName || ''} onChange={(value) => onChange({ supplierName: value })} />
                      <Input label="Branch / Warehouse" value={draft.businessLocation || ''} onChange={(value) => onChange({ businessLocation: value })} />
                      <Select label="Status" value={draft.status || 'Active'} options={statusOptions} onChange={(value) => onChange({ status: value })} />
                      <Input label="Subcategory" value={draft.subcategory || ''} onChange={(value) => onChange({ subcategory: value })} />
                      <Input label="Manufacturer" value={draft.manufacturer || ''} onChange={(value) => onChange({ manufacturer: value })} />
                      <Input label="Product Numeric Number" value={draft.productNumericNumber || ''} onChange={(value) => onChange({ productNumericNumber: value })} />
                      <Input label="Vendor SKU" value={draft.vendorSku || ''} onChange={(value) => onChange({ vendorSku: value })} />
                      <TextArea label="Description" value={draft.description || ''} onChange={(value) => onChange({ description: value })} wide />
                    </div>
                  </SectionCard>

                  <SectionCard title="Product Image" description="Image is stored locally in the product record for Product Master display.">
                    <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-4 items-start">
                      <div className="border border-[#d7dce5] bg-slate-50 aspect-square flex items-center justify-center overflow-hidden">
                        {draft.imageUrl ? <img src={draft.imageUrl} alt="Product preview" className="w-full h-full object-cover" /> : <span className="text-[10px] font-black uppercase text-slate-500">No image</span>}
                      </div>
                      <div className="space-y-3 min-w-0">
                        <label className="inline-flex items-center gap-2 px-3 py-2 border border-[#b8c0cc] bg-white text-[10px] font-black uppercase cursor-pointer">
                          <Upload className="w-4 h-4" />
                          Upload Product Image
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </label>
                        <Input label="Tags" value={(draft.tags || []).join(', ')} onChange={(value) => onChange({ tags: value.split(',').map((item) => item.trim()).filter(Boolean) })} wide />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onChange({ sku: draft.sku || `SKU-${Date.now().toString().slice(-6)}` })}>Generate SKU</button>
                          <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={onCheckDuplicate}><Search className="w-4 h-4" /> Check Duplicate</button>
                          <button type="button" className="sci-pos-button" onClick={onSaveDraft}><Save className="w-4 h-4" /> Save Draft</button>
                        </div>
                        {duplicateProduct && <div className="border border-orange-300 bg-orange-50 px-3 py-2 text-[10px] font-black uppercase text-orange-900">Duplicate risk: {duplicateProduct.productName}</div>}
                      </div>
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Sector Attributes' && (
                <>
                  <SectionCard title="Sector Rules" description={`Fields shown here follow the selected sector: ${humanizeSector(draft.industrialSector)}.`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      {sectorFields.map((field) => (
                        <DynamicField key={String(field.key)} field={field} draft={draft} onChange={onChange} setNumber={setNumber} setBoolean={setBoolean} />
                      ))}
                      {sectorFields.length === 0 && (
                        <div className="xl:col-span-4 border border-[#d7dce5] bg-white p-4 text-xs uppercase font-bold text-slate-600">
                          No dedicated sector template is configured for this sector. Use the Notes field below for additional setup details.
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <SectionCard title="Common Sector Metadata" description="Shared operational attributes for sectors that need extra control.">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input label="Colour" value={draft.colour || ''} onChange={(value) => onChange({ colour: value })} />
                      <Input label="Condition" value={draft.condition || ''} onChange={(value) => onChange({ condition: value })} />
                      <Input label="Model" value={draft.model || ''} onChange={(value) => onChange({ model: value })} />
                      <Input label="Make" value={draft.make || ''} onChange={(value) => onChange({ make: value })} />
                      <Input label="Year From" value={draft.yearFrom || ''} onChange={(value) => onChange({ yearFrom: value })} />
                      <Input label="Year To" value={draft.yearTo || ''} onChange={(value) => onChange({ yearTo: value })} />
                      <Input label="Side" value={draft.side || ''} onChange={(value) => onChange({ side: value })} />
                      <Input label="Product Type" value={draft.productType || ''} onChange={(value) => onChange({ productType: value })} />
                      <TextArea label="Notes" value={draft.notes || ''} onChange={(value) => onChange({ notes: value })} wide />
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Pricing' && (
                <>
                  <SectionCard title="Commercial Pricing" description="Pricing attributes are stored on the product record and price setup.">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input label="Cost Price" type="number" value={String(draft.costPrice ?? '')} onChange={(value) => setNumber('costPrice', value)} />
                      <Input label="Selling Price" type="number" value={String(draft.sellingPrice ?? '')} onChange={(value) => setNumber('sellingPrice', value)} />
                      <Select label="VAT / Tax Category" value={draft.taxMode || 'VAT Registered'} options={['VAT Registered', 'VAT Exempt', 'Zero Rated', 'Inclusive VAT']} onChange={(value) => onChange({ taxMode: value })} />
                      <Input label="VAT Rate" type="number" value={String(draft.vatRate ?? 15)} onChange={(value) => setNumber('vatRate', value)} />
                      <ReadOnly label="Margin" value={`${margin}%`} />
                      <ReadOnly label="Markup" value={`${markup}%`} />
                      <Input label="Price Effective Date" type="date" value={draft.priceEffectiveDate || ''} onChange={(value) => onChange({ priceEffectiveDate: value })} />
                      <Input label="Price Notes" value={draft.priceNotes || ''} onChange={(value) => onChange({ priceNotes: value })} />
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Supplier Link' && (
                <>
                  <SectionCard title="Supplier Link" description="Supplier details are saved into the product supplier link and preferred supplier setup.">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input label="Supplier Name" value={draft.supplierName || ''} onChange={(value) => onChange({ supplierName: value })} />
                      <Input label="Supplier Item Code" value={draft.supplierItemCode || ''} onChange={(value) => onChange({ supplierItemCode: value })} />
                      <Input label="Contact Numbers" value={draft.supplierPhone || ''} onChange={(value) => onChange({ supplierPhone: value })} />
                      <Input label="Email Address" value={draft.supplierEmail || ''} onChange={(value) => onChange({ supplierEmail: value })} />
                      <Input label="Supplier Contact" value={draft.supplierContact || ''} onChange={(value) => onChange({ supplierContact: value })} />
                      <Input label="Last Cost" type="number" value={String(draft.lastCost ?? '')} onChange={(value) => setNumber('lastCost', value)} />
                      <Input label="Lead Time Days" type="number" value={String(draft.leadTimeDays ?? '')} onChange={(value) => setNumber('leadTimeDays', value)} />
                      <Input label="Minimum Order Qty" type="number" value={String(draft.minimumOrderQty ?? '')} onChange={(value) => setNumber('minimumOrderQty', value)} />
                      <Checkbox label="Preferred Supplier" checked={draft.preferredSupplier ?? true} onChange={(value) => onChange({ preferredSupplier: value })} />
                      <TextArea label="Supplier Notes" value={draft.supplierNotes || ''} onChange={(value) => onChange({ supplierNotes: value })} wide />
                    </div>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Stock Setup' && (
                <>
                  <SectionCard title="Stock Setup" description="Opening stock creates a draft. It does not post inventory until approval and posting.">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <Input label="Branch" value={draft.branchId || ''} onChange={(value) => onChange({ branchId: value })} />
                      <Input label="Warehouse" value={draft.warehouseId || ''} onChange={(value) => onChange({ warehouseId: value })} />
                      <Input label="Opening Stock" type="number" value={String(draft.openingQty ?? '')} onChange={(value) => setNumber('openingQty', value)} />
                      <Input label="Unit Cost" type="number" value={String(draft.openingUnitCost ?? '')} onChange={(value) => setNumber('openingUnitCost', value)} />
                      <Input label="Reorder Level" type="number" value={String(draft.reorderLevel ?? '')} onChange={(value) => setNumber('reorderLevel', value)} />
                      <Input label="Reorder Qty" type="number" value={String(draft.reorderQty ?? '')} onChange={(value) => setNumber('reorderQty', value)} />
                      <Input label="Shelf / Location" value={draft.shelfLocation || ''} onChange={(value) => onChange({ shelfLocation: value })} />
                      <Select label="Location Type" value={draft.locationType || 'Main Warehouse'} options={['Main Warehouse', 'Branch Warehouse', 'Sales Floor', 'Back Store', 'Shelf', 'Other']} onChange={(value) => onChange({ locationType: value as ManualProductDraft['locationType'] })} />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" className="sci-pos-button" onClick={onCreateOpeningBalance}>Create Opening Balance Draft</button>
                      <button type="button" className="sci-pos-button sci-pos-button--secondary" onClick={() => onChange({ notes: 'Stock Adjustment placeholder opened from New Product form.' })}>Open Stock Adjustment Placeholder</button>
                    </div>
                  </SectionCard>

                  <SectionCard title="Opening Balance Drafts" description="Existing drafts created from Product Master remain non-posting until approved and posted.">
                    <SimpleTable headers={['Draft No.', 'Date', 'Product', 'SKU', 'Branch', 'Warehouse', 'Shelf', 'Qty', 'Unit Cost', 'Value Estimate', 'Status', 'Created By']}>
                      {openingBalanceDrafts.map((draftRow) => (
                        <tr key={draftRow.openingBalanceId}>
                          <Td>{draftRow.openingBalanceNumber}</Td>
                          <Td>{draftRow.createdAt.slice(0, 10)}</Td>
                          <Td>{draftRow.productName}</Td>
                          <Td>{draftRow.sku}</Td>
                          <Td>{draftRow.branchId}</Td>
                          <Td>{draftRow.warehouseId}</Td>
                          <Td>{draftRow.shelfLocation || '-'}</Td>
                          <Td>{draftRow.qty}</Td>
                          <Td>{draftRow.unitCost}</Td>
                          <Td>{draftRow.valueEstimate}</Td>
                          <Td><Badge value={draftRow.status} /></Td>
                          <Td>{draftRow.createdByStaffName}</Td>
                        </tr>
                      ))}
                      {openingBalanceDrafts.length === 0 && <tr><td colSpan={12} className="p-4 text-xs font-bold uppercase text-slate-600">No opening balance drafts found.</td></tr>}
                    </SimpleTable>
                  </SectionCard>
                </>
              )}

              {activeTab === 'Validation' && (
                <SectionCard title="Validation Desk" description="Review blocking errors and sector warnings before activation.">
                  <SimpleTable headers={['Field', 'Severity', 'Message', 'Suggested Fix']}>
                    {validationIssues.map((issue) => (
                      <tr key={issue.issueId}>
                        <Td>{issue.field}</Td>
                        <Td><Badge value={issue.severity} /></Td>
                        <Td>{issue.message}</Td>
                        <Td>{issue.suggestedFix}</Td>
                      </tr>
                    ))}
                    {validationIssues.length === 0 && <tr><td colSpan={4} className="p-4 text-xs font-bold uppercase text-slate-600">No validation issues.</td></tr>}
                  </SimpleTable>
                </SectionCard>
              )}

              {activeTab === 'Activity' && (
                <SectionCard title="Creation Activity" description="Recent local Product Master activity related to manual product creation.">
                  <SimpleTable headers={['Date', 'Event', 'Message', 'Staff']}>
                    {activity.map((event) => (
                      <tr key={event.eventId}>
                        <Td>{event.createdAt}</Td>
                        <Td>{event.eventType}</Td>
                        <Td>{event.message}</Td>
                        <Td>{event.staffName || event.staffId || '-'}</Td>
                      </tr>
                    ))}
                    {activity.length === 0 && <tr><td colSpan={4} className="p-4 text-xs font-bold uppercase text-slate-600">No product creation activity found.</td></tr>}
                  </SimpleTable>
                </SectionCard>
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

function DynamicField({
  field,
  draft,
  onChange,
  setNumber,
  setBoolean
}: {
  field: FieldConfig;
  draft: ManualProductDraft;
  onChange: (patch: Partial<ManualProductDraft>) => void;
  setNumber: (key: keyof ManualProductDraft, value: string) => void;
  setBoolean: (key: keyof ManualProductDraft, value: boolean) => void;
}) {
  if (field.type === 'checkbox') {
    return <Checkbox label={field.label} checked={Boolean(draft[field.key])} onChange={(value) => setBoolean(field.key, value)} wide={field.wide} />;
  }
  if (field.type === 'textarea') {
    return <TextArea label={field.label} value={String(draft[field.key] || '')} onChange={(value) => onChange({ [field.key]: value } as Partial<ManualProductDraft>)} wide={field.wide} />;
  }
  if (field.options) {
    return <Select label={field.label} value={String(draft[field.key] || field.options[0] || '')} options={field.options} onChange={(value) => onChange({ [field.key]: value } as Partial<ManualProductDraft>)} />;
  }
  if (field.type === 'number') {
    return <Input label={field.label} type="number" value={String(draft[field.key] ?? '')} onChange={(value) => setNumber(field.key, value)} wide={field.wide} />;
  }
  return <Input label={field.label} type={field.type || 'text'} value={String(draft[field.key] || '')} onChange={(value) => onChange({ [field.key]: value } as Partial<ManualProductDraft>)} wide={field.wide} />;
}

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="border border-[#d7dce5] bg-white">
      <div className="border-b border-[#d7dce5] px-4 py-3 bg-slate-50">
        <h3 className="text-[11px] font-black uppercase text-[#252a31]">{title}</h3>
        <p className="text-[9px] font-bold uppercase text-slate-500 mt-1">{description}</p>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function humanizeSector(sector: string): string {
  return sector.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function Input({ label, value, onChange, type = 'text', wide }: { label: string; value: string; onChange: (value: string) => void; type?: string; wide?: boolean }) {
  return (
    <label className={`block border border-[#d7dce5] bg-white p-3 min-w-0 ${wide ? 'md:col-span-2' : ''}`}>
      <span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500" />
    </label>
  );
}

function TextArea({ label, value, onChange, wide }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return (
    <label className={`block border border-[#d7dce5] bg-white p-3 min-w-0 ${wide ? 'md:col-span-2 xl:col-span-4' : ''}`}>
      <span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500 resize-y" />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block border border-[#d7dce5] bg-white p-3 min-w-0">
      <span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-2 py-2 text-xs rounded-none outline-none focus:border-orange-500">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Checkbox({ label, checked, onChange, wide }: { label: string; checked: boolean; onChange: (value: boolean) => void; wide?: boolean }) {
  return (
    <label className={`border border-[#d7dce5] bg-white p-3 flex items-center gap-2 text-[10px] font-black uppercase min-h-[76px] ${wide ? 'md:col-span-2' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div className="border border-[#d7dce5] bg-slate-50 p-3"><span className="block text-[9px] uppercase text-[#6b7280] font-black">{label}</span><strong className="block text-sm mt-1 break-words">{value}</strong></div>;
}

function SimpleTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto overflow-y-hidden border border-[#d7dce5] bg-white"><table className="w-full text-xs"><thead className="bg-[#252a31] text-white"><tr>{headers.map((header) => <th key={header} className="p-2 text-left text-[9px] uppercase font-black whitespace-nowrap">{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="p-2 border-t border-[#e5e7eb] text-[#252a31] align-top">{children}</td>;
}

function Badge({ value }: { value: string }) {
  const danger = ['Error', 'Cancelled', 'Blocked', 'Rejected'].includes(value);
  const warn = ['Warning', 'Draft', 'Pending Approval', 'Approved', 'Pending Review'].includes(value);
  return <span className={`px-2 py-1 border text-[8px] font-black uppercase ${danger ? 'bg-red-50 text-red-700 border-red-200' : warn ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{value}</span>;
}
