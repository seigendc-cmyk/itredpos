import React, { useState } from 'react';
import { Download, FileText, Maximize2, Minimize2, Save, ShieldAlert, Square, X } from 'lucide-react';
import {
  InventoryMovement,
  ProductBarcodeRecord,
  ProductMasterRecord,
  ProductPriceRecord,
  ProductReorderRule,
  ProductStockBalance,
  ProductSupplierLink
} from '../types';

type ProductMasterTab =
  | 'Product Details'
  | 'Sector Attributes'
  | 'Pricing'
  | 'Supplier Links'
  | 'Stock Balances'
  | 'Reorder Rules'
  | 'Product Ledger'
  | 'Audit';

interface ProductAuditRow {
  id: string;
  productId: string;
  eventType: string;
  message: string;
  staffId: string;
  createdAt: string;
}

interface ProductMasterFormProps {
  product: ProductMasterRecord;
  balances: ProductStockBalance[];
  barcodes: ProductBarcodeRecord[];
  prices: ProductPriceRecord[];
  supplierLinks: ProductSupplierLink[];
  reorderRules: ProductReorderRule[];
  ledgerEntries: InventoryMovement[];
  auditRows: ProductAuditRow[];
  onClose: () => void;
  onSave: (patch: Partial<ProductMasterRecord>) => void;
  onBlock: () => void;
  onMarkInactive: () => void;
  onExport: () => void;
}

function money(value: number): string {
  return `USD ${value.toFixed(2)}`;
}

function Badge({ value }: { value: string }) {
  const tone = value.includes('Blocked') || value.includes('Out') || value.includes('Damaged')
    ? 'bg-red-50 text-red-700 border-red-200'
    : value.includes('Low') || value.includes('Review') || value.includes('Pending')
      ? 'bg-orange-50 text-orange-800 border-orange-200'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`px-2 py-1 border text-[9px] font-black uppercase ${tone}`}>{value}</span>;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="border border-[#d7dce5] bg-white p-3">
      <div className="text-[9px] uppercase text-[#6b7280] font-black">{label}</div>
      <div className="text-xs text-[#1f2937] font-semibold mt-1 break-words">{value || '-'}</div>
    </div>
  );
}

export default function ProductMasterForm({
  product,
  balances,
  barcodes,
  prices,
  supplierLinks,
  reorderRules,
  ledgerEntries,
  auditRows,
  onClose,
  onSave,
  onBlock,
  onMarkInactive,
  onExport
}: ProductMasterFormProps) {
  const [activeTab, setActiveTab] = useState<ProductMasterTab>('Product Details');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [draftName, setDraftName] = useState(product.productName);
  const [draftSellingPrice, setDraftSellingPrice] = useState(String(product.defaultSellingPrice));
  const [draftCostPrice, setDraftCostPrice] = useState(String(product.defaultCostPrice));
  const tabs: ProductMasterTab[] = ['Product Details', 'Sector Attributes', 'Pricing', 'Supplier Links', 'Stock Balances', 'Reorder Rules', 'Product Ledger', 'Audit'];

  const handleSave = () => {
    const selling = Number(draftSellingPrice);
    const cost = Number(draftCostPrice);
    onSave({
      productName: draftName.trim() || product.productName,
      defaultSellingPrice: Number.isFinite(selling) ? selling : product.defaultSellingPrice,
      defaultCostPrice: Number.isFinite(cost) ? cost : product.defaultCostPrice,
      marginPercent: Number.isFinite(selling) && selling > 0 && Number.isFinite(cost) ? Math.round(((selling - cost) / selling) * 100) : product.marginPercent
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className={`bg-[#f4f6f8] border border-[#111827] w-full shadow-xl rounded-none ${isMaximized ? 'max-w-none min-h-[calc(100vh-2rem)]' : 'max-w-6xl'}`}>
        <div className="bg-[#252a31] text-white px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase text-orange-300 font-black">Product Master</div>
            <h2 className="text-lg font-black">{product.productName}</h2>
            <div className="text-[10px] text-slate-200 font-semibold mt-0.5">Product identity, sector attributes, supplier links, pricing, and stock balance view.</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setIsMinimized(true)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Minimize"><Minimize2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsMinimized(false)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Restore"><Square className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsMaximized((current) => !current)} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Maximize"><Maximize2 className="w-4 h-4" /></button>
            <button type="button" onClick={onClose} className="p-2 border border-white/30 hover:bg-white/10 rounded-none" title="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {isMinimized ? (
          <div className="p-4 bg-white border-t border-[#d7dce5] flex items-center justify-between">
            <span className="text-xs font-black uppercase text-[#252a31]">{product.sku} minimized</span>
            <button type="button" onClick={() => setIsMinimized(false)} className="px-3 py-2 bg-orange-600 border border-orange-700 text-white text-[10px] font-black uppercase rounded-none">Restore</button>
          </div>
        ) : (
        <>
        <div className="px-4 py-3 bg-white border-b border-[#d7dce5] flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-2 border text-[10px] font-black uppercase rounded-none ${activeTab === tab ? 'bg-orange-600 border-orange-700 text-white' : 'bg-white border-[#b8c0cc] text-[#252a31]'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-4">
          {activeTab === 'Product Details' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-2 border border-[#d7dce5] bg-white p-3">
                <label className="text-[9px] uppercase text-[#6b7280] font-black">Product Name</label>
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-3 py-2 text-sm rounded-none" />
              </div>
              <Field label="SKU" value={product.sku} />
              <Field label="Product Code" value={product.productCode} />
              <Field label="Barcode" value={product.barcode} />
              <Field label="ALU" value={product.alu} />
              <Field label="Vendor SKU" value={product.vendorSku} />
              <Field label="Numeric No." value={product.productNumericNumber} />
              <Field label="Description" value={product.description || product.shortDescription} />
              <Field label="Brand" value={product.brand || product.sectorAttributes.brand} />
              <Field label="Manufacturer" value={product.manufacturer || product.sectorAttributes.manufacturer} />
              <Field label="Condition" value={product.condition} />
              <Field label="Colour" value={product.colour || product.sectorAttributes.colour} />
              <Field label="Status" value={<Badge value={product.productStatus || product.status} />} />
              <Field label="Risk" value={<Badge value={product.riskStatus} />} />
              <Field label="Unit" value={product.unitOfMeasure} />
              <Field label="Tags" value={(product.tags || []).join(', ')} />
              <Field label="Tax Code" value={product.taxCode} />
              <Field label="Sales COA" value={product.salesAccountCOA} />
              <Field label="Asset COA" value={product.assetAccountCOA} />
            </div>
          )}

          {activeTab === 'Sector Attributes' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(product.sectorAttributes).map(([key, value]) => (
                <Field key={key} label={key.replace(/([A-Z])/g, ' $1')} value={typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '-')} />
              ))}
              {barcodes.map((barcode) => <Field key={barcode.barcodeId} label={`${barcode.barcodeType} Barcode`} value={`${barcode.barcode} Pack ${barcode.packSize}`} />)}
            </div>
          )}

          {activeTab === 'Pricing' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="border border-[#d7dce5] bg-white p-3">
                <label className="text-[9px] uppercase text-[#6b7280] font-black">Selling Price</label>
                <input value={draftSellingPrice} onChange={(event) => setDraftSellingPrice(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-3 py-2 text-sm rounded-none" />
              </div>
              <div className="border border-[#d7dce5] bg-white p-3">
                <label className="text-[9px] uppercase text-[#6b7280] font-black">Cost Price</label>
                <input value={draftCostPrice} onChange={(event) => setDraftCostPrice(event.target.value)} className="w-full mt-1 border border-[#b8c0cc] px-3 py-2 text-sm rounded-none" />
              </div>
              <Field label="Margin" value={`${product.marginPercent}%`} />
              <div className="lg:col-span-3 overflow-auto border border-[#d7dce5] bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-[#252a31] text-white"><tr><th className="p-2 text-left">Price List</th><th className="p-2 text-left">Sell</th><th className="p-2 text-left">Cost</th><th className="p-2 text-left">Tax</th><th className="p-2 text-left">VAT</th><th className="p-2 text-left">Margin</th><th className="p-2 text-left">Markup</th><th className="p-2 text-left">Status</th></tr></thead>
                  <tbody>{prices.map((price) => <tr key={price.priceId} className="border-t"><td className="p-2">{price.priceListName}</td><td className="p-2">{money(price.sellingPrice)}</td><td className="p-2">{money(price.costPrice)}</td><td className="p-2">{price.taxMode || product.taxMode || 'VAT Registered'}</td><td className="p-2">{price.vatRate ?? product.vatRate ?? 15}%</td><td className="p-2">{price.marginPercent}%</td><td className="p-2">{price.markupPercent ?? Math.round(((price.sellingPrice - price.costPrice) / Math.max(1, price.costPrice)) * 100)}%</td><td className="p-2"><Badge value={price.status} /></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'Supplier Links' && (
            <Table headers={['Supplier', 'Supplier Item Code', 'Last Cost', 'Lead Time Days', 'Minimum Order Qty', 'Preferred Supplier', 'Status', 'Action']} rows={supplierLinks.map((link) => [link.supplierName, link.supplierItemCode || link.supplierSku || '-', money(link.lastCost), link.leadTimeDays, link.minimumOrderQty, link.isPreferred ? 'Yes' : 'No', link.status, 'Edit Link Placeholder'])} />
          )}

          {activeTab === 'Stock Balances' && (
            <Table headers={['Branch', 'Warehouse', 'Location Type', 'Shelf', 'On Hand', 'Reserved', 'Available', 'Damaged', 'Return Holding', 'In Transit', 'Blocked', 'Reorder Level', 'Status', 'Last Movement', 'Action']} rows={balances.map((balance) => [balance.branchName, balance.warehouseName, balance.locationType, balance.shelfLocation || '-', balance.qtyOnHand, balance.qtyReserved, balance.qtyAvailable, balance.qtyDamaged, balance.qtyReturnHolding || 0, balance.qtyInTransit, balance.qtyBlocked || 0, balance.reorderLevel, balance.status, balance.lastMovementAt || balance.lastMovementDate || '-', 'Create Adjustment Placeholder'])} />
          )}

          {activeTab === 'Reorder Rules' && (
            <Table headers={['Branch', 'Warehouse', 'Location Type', 'Reorder Level', 'Reorder Qty', 'Preferred Supplier', 'Auto PO Recommendation', 'Status', 'Action']} rows={reorderRules.map((rule) => [rule.branchId, rule.warehouseId, rule.locationType || 'Main Warehouse', rule.minQty, rule.reorderQty, rule.preferredSupplierName || rule.preferredSupplierId || '-', 'Placeholder', rule.status || (rule.isActive ? 'Active' : 'Inactive'), 'Create PO Recommendation Placeholder'])} />
          )}

          {activeTab === 'Product Ledger' && (
            <Table headers={['Date / Time', 'Movement Type', 'Reference', 'Branch', 'Warehouse', 'Qty In', 'Qty Out', 'Balance Before', 'Balance After', 'Unit Cost', 'Value Impact', 'Staff', 'Notes']} rows={ledgerEntries.slice(0, 20).map((entry) => [entry.movementDate, entry.movementType, entry.referenceNumber, entry.branchId, entry.warehouseId, entry.qtyIn, entry.qtyOut, entry.balanceBefore, entry.balanceAfter, money(entry.unitCost), money(entry.totalCostImpact), entry.staffName, entry.notes])} emptyMessage="No ledger rows found for this product yet." />
          )}

          {activeTab === 'Audit' && (
            <Table headers={['Date', 'Event', 'Staff', 'Message']} rows={auditRows.map((row) => [row.createdAt, row.eventType, row.staffId, row.message])} emptyMessage="No audit rows found for this product yet." />
          )}
        </div>

        <div className="p-4 bg-white border-t border-[#d7dce5] flex flex-wrap gap-2 justify-end">
          <button type="button" onClick={onExport} className="px-3 py-2 border border-[#b8c0cc] text-[#252a31] text-[10px] font-black uppercase rounded-none flex items-center gap-2"><Download className="w-4 h-4" /> Export Placeholder</button>
          <button type="button" onClick={onMarkInactive} className="px-3 py-2 border border-orange-300 bg-orange-50 text-orange-800 text-[10px] font-black uppercase rounded-none flex items-center gap-2"><FileText className="w-4 h-4" /> Mark Inactive</button>
          <button type="button" onClick={onBlock} className="px-3 py-2 border border-red-300 bg-red-50 text-red-700 text-[10px] font-black uppercase rounded-none flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Block Product</button>
          <button type="button" onClick={handleSave} className="px-3 py-2 bg-orange-600 border border-orange-700 text-white text-[10px] font-black uppercase rounded-none flex items-center gap-2"><Save className="w-4 h-4" /> Save Draft Placeholder</button>
          <button type="button" onClick={handleSave} className="px-3 py-2 bg-[#252a31] border border-[#111827] text-white text-[10px] font-black uppercase rounded-none flex items-center gap-2"><Save className="w-4 h-4" /> Save Product</button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function Table({ headers, rows, emptyMessage = 'No rows found.' }: { headers: string[]; rows: Array<Array<React.ReactNode>>; emptyMessage?: string }) {
  return (
    <div className="overflow-auto border border-[#d7dce5] bg-white">
      <table className="w-full text-xs">
        <thead className="bg-[#252a31] text-white">
          <tr>{headers.map((header) => <th key={header} className="p-2 text-left font-black uppercase text-[9px]">{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="p-3 text-[#6b7280]" colSpan={headers.length}>{emptyMessage}</td></tr>
          ) : rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-[#e5e7eb]">
              {row.map((cell, cellIndex) => <td key={cellIndex} className="p-2 text-[#252a31]">{typeof cell === 'string' && ['Active', 'Available', 'Low Stock', 'Out of Stock', 'Damaged', 'Blocked', 'Pending Review', 'Inactive'].includes(cell) ? <Badge value={cell} /> : cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
