import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Ban, Boxes, CheckCircle, CheckCircle2, Eye, FilePlus, Package, Plus, Recycle, RotateCcw, Search, Send, ShieldAlert, Trash2, X } from 'lucide-react';
import {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine
} from '../types';
import {
  addInputLine,
  addOutputLine,
  approveTransformation,
  cancelTransformation,
  createTransformationDraft,
  getInputLines,
  getOutputLines,
  getTransformations,
  postTransformation,
  removeInputLine,
  removeOutputLine,
  updateInputLine,
  updateOutputLine
} from '../services/productTransformationService';
import {
  POProductSearchResult,
  searchProductsAnyOrder
} from '../services/purchaseOrderProductService';import { getProductTotalAvailableStock } from '../services/stockBalanceService';
import {
  canUseProductTransformationFirestore,
  subscribeToTransformations,
  subscribeToInputLines,
  subscribeToOutputLines
} from '../services/productTransformationRepository';

function POMetric({ label, value }: { label: string; value: string | number }) {

  return (
    <div className="border border-[#b1b5c2] bg-white p-3">
      <span className="block text-[8.5px] uppercase font-black text-slate-500">{label}</span>
      <strong className="block mt-1 text-[16px] font-black text-[#1e222b]">{value}</strong>
    </div>
  );
}

function fieldClass() {
  return 'w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none';
}

function statusClass(status: ProductTransformation['status']) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Cancelled' || status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Approved') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'Pending Approval') return 'bg-orange-50 text-orange-800 border-orange-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

type PickerMode = 'Input' | 'Output';

type TimelineItem = {
  key: string;
  label: string;
  detail: string;
  tone: string;
  icon: React.ReactNode;
};


export default function ProductTransformationPanel() {
  const [records, setRecords] = useState<ProductTransformation[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const inputSubscription = React.useRef<(() => void) | null>(null);
  const outputSubscription = React.useRef<(() => void) | null>(null);
  const [selected, setSelected] = useState<ProductTransformation | null>(null);
  const [inputLines, setInputLines] = useState<ProductTransformationInputLine[]>([]);
  const [outputLines, setOutputLines] = useState<ProductTransformationOutputLine[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<POProductSearchResult[]>([]);
  const [inputSearchQuery, setInputSearchQuery] = useState('');
  const [inputSearchResults, setInputSearchResults] = useState<POProductSearchResult[]>([]);
  const [outputSearchQuery, setOutputSearchQuery] = useState('');
  const [outputSearchResults, setOutputSearchResults] = useState<POProductSearchResult[]>([]);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const rows = await getTransformations({});
    setRecords(rows);
    setNotice(`Loaded ${rows.length} transformation record(s).`);

    if (selected) {
      const refreshed = rows.find((item) => item.transformationId === selected.transformationId) || null;
      setSelected(refreshed);
    }
    setLastRefresh(new Date().toLocaleTimeString());
    setLoading(false);
  };

  const loadTransformationDetail = async (record: ProductTransformation) => {
    inputSubscription.current?.();
    outputSubscription.current?.();

    setSelected(record);

    const inputUnsubscribe = subscribeToInputLines(
      record.transformationId,
      rows => setInputLines(rows)
    );

    const outputUnsubscribe = subscribeToOutputLines(
      record.transformationId,
      rows => setOutputLines(rows)
    );

    inputSubscription.current = inputUnsubscribe;
    outputSubscription.current = outputUnsubscribe;

    if (!inputUnsubscribe || !outputUnsubscribe) {
      const [inputs, outputs] = await Promise.all([
        getInputLines(record.transformationId),
        getOutputLines(record.transformationId)
      ]);

      setInputLines(inputs);
      setOutputLines(outputs);
    }

    setNotice(`${record.transformationNumber} loaded.`);
  };

  useEffect(() => {

    void refresh();

    const unsubscribe =
      subscribeToTransformations((rows) => {

        setRecords(rows);
        setLastRefresh(new Date().toLocaleTimeString());

        if (selected) {
          const refreshed =
            rows.find(
              item =>
                item.transformationId ===
                selected.transformationId
            ) || null;

          setSelected(refreshed);
        }

      });

    return () => {
      unsubscribe?.();
      inputSubscription.current?.();
      outputSubscription.current?.();
    };

  }, []);

  const editable = selected?.status === 'Draft';

  const bomTemplates = [
    {
      templateId: 'bom-radiator-basic',
      templateName: 'Radiator Assembly Basic',
      description: 'Sample conversion recipe for radiator assembly build.',
      inputs: [
        { productId: 'mat-radiator-core', sku: 'RAD-CORE', productName: 'Radiator Core', qtyConsumed: 1, unitCost: 25, sourceWarehouseId: 'MAIN' },
        { productId: 'mat-side-tank', sku: 'SIDE-TANK', productName: 'Side Tank', qtyConsumed: 2, unitCost: 8, sourceWarehouseId: 'MAIN' }
      ],
      outputs: [
        { productId: 'fg-radiator-assembly', sku: 'RAD-ASSY', productName: 'Radiator Assembly', qtyProduced: 1, unitCost: 41, destinationWarehouseId: 'MAIN' }
      ]
    },
    {
      templateId: 'bom-kit-basic',
      templateName: 'Basic Kit Pack',
      description: 'Sample kit recipe for bundling multiple parts into one sellable pack.',
      inputs: [
        { productId: 'mat-part-a', sku: 'PART-A', productName: 'Component A', qtyConsumed: 1, unitCost: 5, sourceWarehouseId: 'MAIN' },
        { productId: 'mat-part-b', sku: 'PART-B', productName: 'Component B', qtyConsumed: 1, unitCost: 7, sourceWarehouseId: 'MAIN' }
      ],
      outputs: [
        { productId: 'fg-basic-kit', sku: 'KIT-BASIC', productName: 'Basic Kit Pack', qtyProduced: 1, unitCost: 12, destinationWarehouseId: 'MAIN' }
      ]
    }
  ];


  const getBomTemplateInputCost = (template: typeof bomTemplates[number]) =>
    template.inputs.reduce((sum, line) => sum + line.qtyConsumed * line.unitCost, 0);

  const getBomTemplateOutputValue = (template: typeof bomTemplates[number]) =>
    template.outputs.reduce((sum, line) => sum + line.qtyProduced * line.unitCost, 0);

  const getBomTemplateVariance = (template: typeof bomTemplates[number]) =>
    getBomTemplateOutputValue(template) - getBomTemplateInputCost(template);
  const handleApplyBomTemplate = async (template: typeof bomTemplates[number]) => {
    if (!selected || !editable) {
      setNotice('Select a draft transformation before loading a recipe template.');
      return;
    }

    const existingInputSkus = inputLines.map((line) => line.sku);
    const existingOutputSkus = outputLines.map((line) => line.sku);

    const duplicateInput = template.inputs.find((line) => existingInputSkus.includes(line.sku));
    const duplicateOutput = template.outputs.find((line) => existingOutputSkus.includes(line.sku));

    if (duplicateInput || duplicateOutput) {
      setNotice('Recipe blocked: one or more template products already exist in this draft.');
      return;
    }

    for (const input of template.inputs) {
      await addInputLine(selected.transformationId, input);
    }

    for (const output of template.outputs) {
      await addOutputLine(selected.transformationId, output);
    }

    setInputSearchQuery('');
    setInputSearchResults([]);
    setOutputSearchQuery('');
    setOutputSearchResults([]);
    await reloadSelected();
    setNotice(`${template.templateName} recipe loaded into draft.`);
  };

  const summary = useMemo(() => {
    const total = records.length;
    const draft = records.filter((item) => item.status === 'Draft').length;
    const pending = records.filter((item) => item.status === 'Pending Approval').length;
    const approved = records.filter((item) => item.status === 'Approved').length;
    const completed = records.filter((item) => item.status === 'Completed').length;
    const cancelled = records.filter((item) => item.status === 'Cancelled').length;
    const active = draft + pending + approved;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return {
      total,
      draft,
      pending,
      approved,
      completed,
      cancelled,
      active,
      completionRate
    };
  }, [records]);

  const detailSummary = useMemo(() => {
    const inputQty = inputLines.reduce((sum, line) => sum + line.qtyConsumed, 0);
    const outputQty = outputLines.reduce((sum, line) => sum + line.qtyProduced, 0);
    const inputCost = inputLines.reduce((sum, line) => sum + line.totalCost, 0);
    const outputValue = outputLines.reduce((sum, line) => sum + line.totalValue, 0);
    const yieldPercent = inputQty > 0 ? (outputQty / inputQty) * 100 : 0;
    const quantityVariance = outputQty - inputQty;
    const valueVariance = outputValue - inputCost;

    return {
      inputQty,
      outputQty,
      inputCost,
      outputValue,
      yieldPercent,
      quantityVariance,
      valueVariance
    };
  }, [inputLines, outputLines]);

  const firestoreStatus = useMemo(() => ({
    connected: canUseProductTransformationFirestore(),
    transformations: records.length,
    inputLines: inputLines.length,
    outputLines: outputLines.length,
    lastRefresh
  }), [records, inputLines, outputLines, lastRefresh]);
  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!selected) return [];

    const items: TimelineItem[] = [
      {
        key: 'draft-created',
        label: 'Draft Created',
        detail: `${selected.transformationDate} | ${selected.requestedByStaffName || selected.requestedByStaffId}`,
        tone: 'border-slate-300 bg-slate-50 text-slate-700',
        icon: <FilePlus className="w-4 h-4" />
      }
    ];

    inputLines.forEach((line) => {
      items.push({
        key: `input-${line.lineId}`,
        label: 'Input Added',
        detail: `${line.productName} | Qty ${line.qtyConsumed} | Cost ${line.totalCost.toFixed(2)}`,
        tone: 'border-orange-200 bg-orange-50 text-orange-800',
        icon: <Package className="w-4 h-4" />
      });
    });

    outputLines.forEach((line) => {
      items.push({
        key: `output-${line.lineId}`,
        label: 'Output Added',
        detail: `${line.productName} | Qty ${line.qtyProduced} | Value ${line.totalValue.toFixed(2)}`,
        tone: 'border-blue-200 bg-blue-50 text-blue-800',
        icon: <Boxes className="w-4 h-4" />
      });
    });

    if (selected.status === 'Approved' || selected.status === 'Completed') {
      items.push({
        key: 'approved',
        label: 'Approved',
        detail: selected.approvedByStaffId || 'Approval captured',
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
        icon: <BadgeCheck className="w-4 h-4" />
      });
    }

    if (selected.status === 'Cancelled') {
      items.push({
        key: 'cancelled',
        label: 'Cancelled',
        detail: 'Transformation cancelled before posting',
        tone: 'border-red-200 bg-red-50 text-red-800',
        icon: <Ban className="w-4 h-4" />
      });
    }

    if (selected.status === 'Rejected') {
      items.push({
        key: 'rejected',
        label: 'Rejected',
        detail: 'Transformation rejected',
        tone: 'border-red-200 bg-red-50 text-red-800',
        icon: <ShieldAlert className="w-4 h-4" />
      });
    }

    if (selected.status === 'Completed') {
      items.push({
        key: 'posted',
        label: 'Posted',
        detail: 'Inventory movements generated and transformation completed',
        tone: 'border-blue-200 bg-blue-50 text-blue-800',
        icon: <CheckCircle2 className="w-4 h-4" />
      });
    }

    return items;
  }, [selected, inputLines, outputLines]);

  const handleCreateDraft = async () => {
    const draft = await createTransformationDraft({
      vendorId: 'LOCAL_VENDOR',
      branchId: 'LOCAL_BRANCH',
      requestedByStaffId: 'LOCAL_STAFF',
      requestedByStaffName: 'Local Operator',
      notes: draftNotes.trim() || 'Product transformation draft created from POS workspace.'
    });

    setCreateOpen(false);
    setDraftNotes('');
    await loadTransformationDetail(draft);
    await refresh();
    setSelected(draft);
    setNotice(`${draft.transformationNumber} draft created and loaded.`);
  };

  const reloadSelected = async () => {
    if (!selected) return;
    await loadTransformationDetail(selected);
  };

  const openPicker = (mode: PickerMode) => {
    if (!selected || !editable) return;
    setPickerMode(mode);
    setProductQuery('');
    setProductResults([]);
  };

  const handleProductSearch = async () => {
    const rows = await searchProductsAnyOrder(productQuery);
    setProductResults(rows);
    setNotice(`${rows.length} product match(es) found.`);
  };

  const handleSelectProduct = async (result: POProductSearchResult) => {
    if (!selected || !pickerMode || !editable) return;

    const product = result.product;
    const warehouse = result.shelfLocation || 'MAIN';
    const unitCost =
      (product as any).costPrice ||
      (product as any).cost ||
      (product as any).averageCost ||
      0;

    const mode = pickerMode.toLowerCase();
    let successMessage = '';

    if (mode === 'input') {
      const line = await addInputLine(selected.transformationId, {
        productId: product.productId,
        sku: product.sku || product.productCode,
        productName: product.productName,
        qtyConsumed: 1,
        unitCost,
        sourceWarehouseId: warehouse,
        sourceShelfLocation: result.shelfLocation
      });

      if (!line) {
        setNotice('Input product could not be added.');
        return;
      }
      const available = await getProductTotalAvailableStock(product.productId);
      if (available < 1) {
        successMessage = `Warning: Available stock for ${product.productName} is ${available}, which is less than the consumed quantity of 1.`;
      } else {
        successMessage = 'Input material added.';
      }
    }

    if (mode === 'output') {
      const line = await addOutputLine(selected.transformationId, {
        productId: product.productId,
        sku: product.sku || product.productCode,
        productName: product.productName,
        qtyProduced: 1,
        unitCost,
        destinationWarehouseId: warehouse,
        destinationShelfLocation: result.shelfLocation
      });

      if (!line) {
        setNotice('Output product could not be added.');
        return;
      }
      successMessage = 'Output product added.';
    }

    setPickerMode(null);
    setProductQuery('');
    setProductResults([]);
    await reloadSelected();
    if (successMessage) {
      setNotice(successMessage);
    }
    setTimeout(() => {
      if (mode === 'input') {
        document.getElementById('input-materials-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (mode === 'output') {
        document.getElementById('output-products-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
  };

  const handleInputSearch = async (query: string) => {
    setInputSearchQuery(query);
    if (!query.trim()) {
      setInputSearchResults([]);
      return;
    }
    const rows = await searchProductsAnyOrder(query);
    setInputSearchResults(rows);
  };

  const handleOutputSearch = async (query: string) => {
    setOutputSearchQuery(query);
    if (!query.trim()) {
      setOutputSearchResults([]);
      return;
    }
    const rows = await searchProductsAnyOrder(query);
    setOutputSearchResults(rows);
  };

  const handleAddInputProduct = async (result: POProductSearchResult) => {
    if (!selected || !editable) return;
    const product = result.product;
    const warehouse = result.shelfLocation || 'MAIN';
    const unitCost =
      (product as any).costPrice ||
      (product as any).cost ||
      (product as any).averageCost ||
      0;

    const line = await addInputLine(selected.transformationId, {
      productId: product.productId,
      sku: product.sku || product.productCode,
      productName: product.productName,
      qtyConsumed: 1,
      unitCost,
      sourceWarehouseId: warehouse,
      sourceShelfLocation: result.shelfLocation
    });

    if (!line) {
      setNotice('Input product could not be added.');
      return;
    }

    setInputSearchQuery('');
    setInputSearchResults([]);
    await reloadSelected();

    const available = await getProductTotalAvailableStock(product.productId);
    if (available < 1) {
      setNotice(`Warning: Available stock for ${product.productName} is ${available}, which is less than the consumed quantity of 1.`);
    } else {
      setNotice('Input material added.');
    }

    setTimeout(() => {
      document.getElementById('input-materials-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleAddOutputProduct = async (result: POProductSearchResult) => {
    if (!selected || !editable) return;
    const product = result.product;
    const warehouse = result.shelfLocation || 'MAIN';
    const unitCost =
      (product as any).costPrice ||
      (product as any).cost ||
      (product as any).averageCost ||
      0;

    const line = await addOutputLine(selected.transformationId, {
      productId: product.productId,
      sku: product.sku || product.productCode,
      productName: product.productName,
      qtyProduced: 1,
      unitCost,
      destinationWarehouseId: warehouse,
      destinationShelfLocation: result.shelfLocation
    });

    if (!line) {
      setNotice('Output product could not be added.');
      return;
    }

    setOutputSearchQuery('');
    setOutputSearchResults([]);
    await reloadSelected();
    setNotice('Output product added.');

    setTimeout(() => {
      document.getElementById('output-products-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleUpdateInput = async (lineId: string, patch: Partial<ProductTransformationInputLine>) => {
    if (!selected || !editable) return;

    if (patch.qtyConsumed !== undefined && patch.qtyConsumed < 0) {
      setNotice('Quantity cannot be negative.');
      return;
    }
    if (patch.unitCost !== undefined && patch.unitCost < 0) {
      setNotice('Unit cost cannot be negative.');
      return;
    }

    const updated = await updateInputLine(selected.transformationId, lineId, patch);
    if (!updated) return;
    setInputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));

    if (patch.qtyConsumed !== undefined) {
      const available = await getProductTotalAvailableStock(updated.productId);
      if (available < patch.qtyConsumed) {
        setNotice(`Warning: Available stock for ${updated.productName} is ${available}, which is less than the consumed quantity of ${patch.qtyConsumed}.`);
      } else {
        setNotice(null);
      }
    }
  };

  const handleUpdateOutput = async (lineId: string, patch: Partial<ProductTransformationOutputLine>) => {
    if (!selected || !editable) return;

    if (patch.qtyProduced !== undefined && patch.qtyProduced < 0) {
      setNotice('Quantity cannot be negative.');
      return;
    }
    if (patch.unitCost !== undefined && patch.unitCost < 0) {
      setNotice('Unit cost cannot be negative.');
      return;
    }

    const updated = await updateOutputLine(selected.transformationId, lineId, patch);
    if (!updated) return;
    setOutputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));
  };

  const handleRemoveInput = async (lineId: string) => {
    if (!selected || !editable) return;
    const removed = await removeInputLine(selected.transformationId, lineId);
    if (removed) setInputLines((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const handleRemoveOutput = async (lineId: string) => {
    if (!selected || !editable) return;
    const removed = await removeOutputLine(selected.transformationId, lineId);
    if (removed) setOutputLines((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const handleApprove = async () => {
    if (!selected || selected.status !== 'Draft') return;
    const updated = await approveTransformation(selected.transformationId, 'LOCAL_STAFF');
    if (!updated) {
      setNotice('Unable to approve transformation.');
      return;
    }
    await refresh();
    await loadTransformationDetail(updated);
    setNotice(`${updated.transformationNumber} approved.`);
  };

  const handleCancel = async () => {
    if (!selected || selected.status === 'Completed' || selected.status === 'Cancelled') return;
    const updated = await cancelTransformation(selected.transformationId);
    if (!updated) {
      setNotice('Unable to cancel transformation.');
      return;
    }
    await refresh();
    await loadTransformationDetail(updated);
    setNotice(`${updated.transformationNumber} cancelled.`);
  };

  const handlePost = async () => {
    if (!selected || selected.status !== 'Approved') return;

    const result = await postTransformation(selected.transformationId);
    setNotice(result.stockPosted ? 'Transformation posted successfully.' : result.message);

    await refresh();

    const refreshed = (await getTransformations({})).find((item) => item.transformationId === selected.transformationId);
    if (refreshed) {
      await loadTransformationDetail(refreshed);
    }
  };

  return (
    <div className="industrial-section p-5 space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
        <div>
          <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
            <Recycle className="w-4 h-4 text-orange-500" />
            Product Transformation
          </span>
          <p className="text-[9.5px] text-slate-700 mt-0.5 uppercase font-semibold">
            Product picker enabled. Build 2K-07 selects products from Product Master.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Transformation
          </button>
          <button type="button" onClick={() => void refresh()} className="px-4 py-2 bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="border border-orange-300 bg-orange-50 p-4 text-[9.5px] uppercase font-black text-slate-800">
        Product picker only. No approval, cancellation, posting, audit, or stock movement is triggered from this build.
      </div>

      {createOpen && (
        <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <span className="text-[10px] uppercase font-black text-[#1e222b]">Create Transformation Draft</span>
            <button type="button" onClick={() => setCreateOpen(false)} className="text-slate-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} className="w-full min-h-[90px] border border-[#b1b5c2] bg-white p-3 text-[10px] uppercase font-bold outline-none focus:border-orange-500 rounded-none" placeholder="Describe the transformation, batch, repack, kit, or production job." />
          <button type="button" onClick={() => void handleCreateDraft()} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer">
            Save Draft
          </button>
        </div>
      )}

      {pickerMode && (
        <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 pb-2">
            <span className="text-[10px] uppercase font-black text-[#1e222b]">
              Select Product For {pickerMode} Line
            </span>
            <button type="button" onClick={() => setPickerMode(null)} className="text-slate-500 hover:text-red-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              className={fieldClass()}
              placeholder="Search SKU, product name, barcode, brand, part number..."
            />
            <button
              type="button"
              onClick={() => void handleProductSearch()}
              className="px-4 py-2 bg-[#1e222b] text-white font-black uppercase text-[9px] flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>

          <div className="border border-gray-200 overflow-x-auto max-h-[260px] pos-custom-scroll">
            <table className="w-full text-[9px] uppercase">
              <thead className="bg-slate-100 text-slate-700 font-black sticky top-0">
                <tr>
                  <th className="p-2 text-left">SKU</th>
                  <th className="p-2 text-left">Product</th>
                  <th className="p-2 text-right">Available</th>
                  <th className="p-2 text-right">Cost</th>
                  <th className="p-2 text-left">Shelf</th>
                  <th className="p-2 text-center">Select</th>
                </tr>
              </thead>
              <tbody>
                {productResults.length === 0 ? (
                  <tr><td colSpan={6} className="p-3 text-center text-slate-500 font-bold">Search for a product.</td></tr>
                ) : productResults.map((row) => (
                  <tr key={row.product.productId} className="border-t border-gray-100">
                    <td className="p-2 font-bold">{row.product.sku || row.product.productCode}</td>
                    <td className="p-2 font-bold">{row.product.productName}</td>
                    <td className="p-2 text-right font-mono">{row.currentStock}</td>
                    <td className="p-2 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>
                    <td className="p-2 font-bold">{row.shelfLocation || '-'}</td>
                    <td className="p-2 text-center">
                      <button type="button" onClick={() => void handleSelectProduct(row)} className="px-2 py-1 bg-orange-500 text-white text-[8px] uppercase font-black">
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {notice && <div className="border border-[#b1b5c2] bg-slate-50 p-3 text-[9.5px] uppercase font-black text-slate-800">{notice}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <POMetric label="Total Jobs" value={summary.total} />
        <POMetric label="Active Jobs" value={summary.active} />
        <POMetric label="Draft Jobs" value={summary.draft} />
        <POMetric label="Pending Approval" value={summary.pending} />
        <POMetric label="Approved" value={summary.approved} />
        <POMetric label="Completed" value={summary.completed} />
        <POMetric label="Cancelled" value={summary.cancelled} />
        <POMetric label="Completion %" value={summary.completionRate.toFixed(2)} />
      </div>

      <div className="border border-slate-300 bg-white p-3 mb-4">
        <div className="text-[10px] font-black uppercase mb-2">
          Firestore Verification
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <POMetric label="Bridge" value={firestoreStatus.connected ? 'READY' : 'OFFLINE'} />
          <POMetric label="Jobs" value={firestoreStatus.transformations} />
          <POMetric label="Inputs" value={firestoreStatus.inputLines} />
          <POMetric label="Outputs" value={firestoreStatus.outputLines} />
          <POMetric label="Refresh" value={firestoreStatus.lastRefresh || '--'} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <div className="xl:col-span-4 procurement-table-scroll pos-custom-scroll">
          <table className="procurement-table">
            <thead>
              <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                <th className="py-2 px-3">Transformation</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="py-8 text-center uppercase font-bold text-slate-500">Loading Product Transformations...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center uppercase font-bold text-slate-500">No Product Transformations Found<br /><span className="text-[8px] text-slate-400">Create your first transformation draft to begin converting raw materials into finished products.</span></td></tr>
              ) : records.map((record) => (
                <tr key={record.transformationId} className="hover:bg-slate-50 transition-colors h-11">
                  <td className="py-2 px-3">
                    <div className="font-black text-orange-700">{record.transformationNumber}</div>
                    <div className="text-[8px] uppercase font-bold text-slate-500">{record.transformationDate} | {record.branchId}</div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(record.status)}`}>{record.status}</span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <button type="button" onClick={() => void loadTransformationDetail(record)} className="inline-flex items-center gap-1 px-2 py-1 border border-[#b1b5c2] bg-white hover:bg-slate-50 text-[8px] uppercase font-black">
                      <Eye className="w-3 h-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="xl:col-span-8 border border-[#b1b5c2] bg-white p-4 space-y-4">
          {selected ? (
            <>
              <div className="border-b border-gray-150 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[13px] uppercase font-black text-[#1e222b]">{selected.transformationNumber}</h3>
                    <p className="text-[9px] uppercase font-bold text-slate-500">{selected.notes || 'No notes captured.'}</p>
                  </div>
                  <span className={`inline-block px-2 py-0.5 border text-[8px] uppercase tracking-wide rounded-none ${statusClass(selected.status)}`}>{selected.status}</span>
                </div>
              </div>

              <div className="border border-orange-300 bg-orange-50 p-3 space-y-3">
                <div>
                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Recipe / BOM Templates</h4>
                  <p className="text-[8.5px] uppercase font-bold text-slate-600">Load a controlled recipe into this draft transformation.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {bomTemplates.map((template) => (
                    <div key={template.templateId} className="bg-white border border-[#b1b5c2] p-3">
                      <div className="text-[10px] uppercase font-black text-[#1e222b]">{template.templateName}</div>
                      <div className="text-[8.5px] uppercase font-bold text-slate-500 mt-1">{template.description}</div>
                      <div className="text-[8px] uppercase font-black text-slate-600 mt-2">
                        Inputs: {template.inputs.length} | Outputs: {template.outputs.length}
                      </div>
                      <div className="grid grid-cols-3 gap-1 mt-2 text-[8px] uppercase font-black">
                        <div className="border border-slate-200 bg-slate-50 p-1">
                          <span className="block text-slate-500">Input Cost</span>
                          <strong className="text-[#1e222b]">USD {getBomTemplateInputCost(template).toFixed(2)}</strong>
                        </div>
                        <div className="border border-slate-200 bg-slate-50 p-1">
                          <span className="block text-slate-500">Output Value</span>
                          <strong className="text-[#1e222b]">USD {getBomTemplateOutputValue(template).toFixed(2)}</strong>
                        </div>
                        <div className="border border-slate-200 bg-slate-50 p-1">
                          <span className="block text-slate-500">Variance</span>
                          <strong className={getBomTemplateVariance(template) < 0 ? 'text-red-700' : 'text-emerald-700'}>
                            USD {getBomTemplateVariance(template).toFixed(2)}
                          </strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedTemplateId(expandedTemplateId === template.templateId ? null : template.templateId)}
                        className="mt-3 mr-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#b1b5c2] text-[#1e222b] font-black uppercase text-[8.5px] rounded-none"
                      >
                        {expandedTemplateId === template.templateId ? 'Hide Detail' : 'View Detail'}
                      </button>
                      <button
                        type="button"
                        disabled={!editable}
                        onClick={() => void handleApplyBomTemplate(template)}
                        className="mt-3 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[8.5px] rounded-none disabled:bg-slate-300 disabled:border-slate-300"
                      >
                        Load Recipe
                      </button>

                      {expandedTemplateId === template.templateId && (
                        <div className="mt-3 border border-[#b1b5c2] bg-slate-50 p-2 space-y-2">
                          <div>
                            <div className="text-[8px] uppercase font-black text-slate-600 mb-1">Input Materials</div>
                            {template.inputs.map((line) => (
                              <div key={`${template.templateId}-input-${line.sku}`} className="flex justify-between gap-2 border-b border-slate-200 py-1 text-[8px] uppercase font-bold">
                                <span>{line.sku} - {line.productName}</span>
                                <span>{line.qtyConsumed} x USD {line.unitCost.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-[8px] uppercase font-black text-slate-600 mb-1">Output Products</div>
                            {template.outputs.map((line) => (
                              <div key={`${template.templateId}-output-${line.sku}`} className="flex justify-between gap-2 border-b border-slate-200 py-1 text-[8px] uppercase font-bold">
                                <span>{line.sku} - {line.productName}</span>
                                <span>{line.qtyProduced} x USD {line.unitCost.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Input Materials</h4>
                  <button type="button" disabled={!editable} onClick={() => openPicker('Input')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none disabled:bg-slate-300 disabled:border-slate-300 cursor-pointer">+ Add Input</button>
                </div>

                <div className="mb-3 space-y-2">
                  <input
                    disabled={!selected || !editable}
                    value={inputSearchQuery}
                    onChange={(event) => void handleInputSearch(event.target.value)}
                    className="w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none disabled:bg-slate-100 text-[#1e222b]"
                    placeholder="Search input material by SKU, product name, brand, barcode, part number..."
                  />
                  {inputSearchResults.length > 0 && (
                    <div className="border border-[#b1b5c2] bg-slate-50 max-h-[150px] overflow-y-auto pos-custom-scroll p-1">
                      <table className="w-full text-[8.5px] uppercase">
                        <thead>
                          <tr className="border-b border-gray-250 text-slate-600 font-bold">
                            <th className="p-1 text-left">SKU</th>
                            <th className="p-1 text-left">Product Name</th>
                            <th className="p-1 text-right">Available Qty</th>
                            <th className="p-1 text-right">Cost</th>
                            <th className="p-1 text-left">Shelf</th>
                            <th className="p-1 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inputSearchResults.map((row) => (
                            <tr key={row.product.productId} className="border-b border-gray-100 last:border-0 text-[#1e222b]">
                              <td className="p-1 font-bold">{row.product.sku || row.product.productCode}</td>
                              <td className="p-1 font-bold">{row.product.productName}</td>
                              <td className="p-1 text-right font-mono">{row.currentStock}</td>
                              <td className="p-1 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>
                              <td className="p-1 font-bold">{row.shelfLocation || '-'}</td>
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => void handleAddInputProduct(row)}
                                  className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                >
                                  Add
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div id="input-materials-table" className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-left">Warehouse</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Total</th>
                        <th className="p-2 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inputLines.length === 0 ? (
                        <tr><td colSpan={7} className="p-3 text-center text-slate-500 font-bold">No input lines captured.</td></tr>
                      ) : inputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-1"><input disabled={!editable} className={fieldClass()} value={line.sourceWarehouseId} onChange={(event) => void handleUpdateInput(line.lineId, { sourceWarehouseId: event.target.value })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.qtyConsumed} onChange={(event) => void handleUpdateInput(line.lineId, { qtyConsumed: Number(event.target.value) })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.unitCost} onChange={(event) => void handleUpdateInput(line.lineId, { unitCost: Number(event.target.value) })} /></td>
                          <td className="p-2 text-right font-mono">{line.totalCost.toFixed(2)}</td>
                          <td className="p-2 text-center"><button disabled={!editable} type="button" onClick={() => void handleRemoveInput(line.lineId)} className="text-red-600 disabled:text-slate-300"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Output Products</h4>
                  <button type="button" disabled={!editable} onClick={() => openPicker('Output')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none disabled:bg-slate-300 disabled:border-slate-300 cursor-pointer">+ Add Output</button>
                </div>

                <div className="mb-3 space-y-2">
                  <input
                    disabled={!selected || !editable}
                    value={outputSearchQuery}
                    onChange={(event) => void handleOutputSearch(event.target.value)}
                    className="w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none disabled:bg-slate-100 text-[#1e222b]"
                    placeholder="Search output product by SKU, product name, brand, barcode, part number..."
                  />
                  {outputSearchResults.length > 0 && (
                    <div className="border border-[#b1b5c2] bg-slate-50 max-h-[150px] overflow-y-auto pos-custom-scroll p-1">
                      <table className="w-full text-[8.5px] uppercase">
                        <thead>
                          <tr className="border-b border-gray-250 text-slate-600 font-bold">
                            <th className="p-1 text-left">SKU</th>
                            <th className="p-1 text-left">Product Name</th>
                            <th className="p-1 text-right">Available Qty</th>
                            <th className="p-1 text-right">Cost</th>
                            <th className="p-1 text-left">Shelf</th>
                            <th className="p-1 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outputSearchResults.map((row) => (
                            <tr key={row.product.productId} className="border-b border-gray-100 last:border-0 text-[#1e222b]">
                              <td className="p-1 font-bold">{row.product.sku || row.product.productCode}</td>
                              <td className="p-1 font-bold">{row.product.productName}</td>
                              <td className="p-1 text-right font-mono">{row.currentStock}</td>
                              <td className="p-1 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>
                              <td className="p-1 font-bold">{row.shelfLocation || '-'}</td>
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => void handleAddOutputProduct(row)}
                                  className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                >
                                  Add
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div id="output-products-table" className="border border-gray-200 overflow-x-auto">
                  <table className="w-full text-[9px] uppercase">
                    <thead className="bg-slate-100 text-slate-700 font-black">
                      <tr>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Product</th>
                        <th className="p-2 text-left">Warehouse</th>
                        <th className="p-2 text-right">Qty Produced</th>
                        <th className="p-2 text-right">Unit Cost</th>
                        <th className="p-2 text-right">Output Value</th>
                        <th className="p-2 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputLines.length === 0 ? (
                        <tr><td colSpan={7} className="p-3 text-center text-slate-500 font-bold">No output lines captured.</td></tr>
                      ) : outputLines.map((line) => (
                        <tr key={line.lineId} className="border-t border-gray-100">
                          <td className="p-2 font-bold">{line.sku}</td>
                          <td className="p-2 font-bold">{line.productName}</td>
                          <td className="p-1"><input disabled={!editable} className={fieldClass()} value={line.destinationWarehouseId} onChange={(event) => void handleUpdateOutput(line.lineId, { destinationWarehouseId: event.target.value })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.qtyProduced} onChange={(event) => void handleUpdateOutput(line.lineId, { qtyProduced: Number(event.target.value) })} /></td>
                          <td className="p-1"><input disabled={!editable} type="number" className={fieldClass()} value={line.unitCost} onChange={(event) => void handleUpdateOutput(line.lineId, { unitCost: Number(event.target.value) })} /></td>
                          <td className="p-2 text-right font-mono">{line.totalValue.toFixed(2)}</td>
                          <td className="p-2 text-center"><button disabled={!editable} type="button" onClick={() => void handleRemoveOutput(line.lineId)} className="text-red-600 disabled:text-slate-300"><Trash2 className="w-3 h-3" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border border-[#b1b5c2] bg-slate-50 p-3">
                <button
                  type="button"
                  disabled={!selected || selected.status !== 'Draft'}
                  onClick={() => void handleApprove()}
                  className="px-4 py-2 bg-emerald-600 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </button>

                <button
                  type="button"
                  disabled={!selected || selected.status === 'Completed' || selected.status === 'Cancelled'}
                  onClick={() => void handleCancel()}
                  className="px-4 py-2 bg-red-600 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!selected || selected.status !== 'Approved'}
                  onClick={() => void handlePost()}
                  className="px-4 py-2 bg-orange-500 disabled:bg-slate-300 text-white font-black uppercase text-[9px] rounded-none cursor-pointer flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Post
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                <POMetric label="Input Qty" value={detailSummary.inputQty} />
                <POMetric label="Output Qty" value={detailSummary.outputQty} />
                <POMetric label="Qty Variance" value={detailSummary.quantityVariance} />
                <POMetric label="Input Cost" value={detailSummary.inputCost.toFixed(2)} />
                <POMetric label="Output Value" value={detailSummary.outputValue.toFixed(2)} />
                <POMetric label="Value Variance" value={detailSummary.valueVariance.toFixed(2)} />
                <POMetric label="Yield %" value={detailSummary.yieldPercent.toFixed(2)} />
              </div>

              <div className="border border-[#b1b5c2] bg-white p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                  <span className="text-[10px] uppercase font-black text-[#1e222b]">Transformation Activity Timeline</span>
                  <span className="text-[8px] uppercase font-black text-slate-400">{timelineItems.length} Event(s)</span>
                </div>

                <div className="space-y-2">
                  {timelineItems.length === 0 ? (
                    <div className="py-6 text-center uppercase font-black text-slate-500 text-[9px]">No activity captured.</div>
                  ) : timelineItems.map((item) => (
                    <div key={item.key} className={`flex items-start gap-3 border p-3 ${item.tone}`}>
                      <div className="mt-0.5">{item.icon}</div>
                      <div>
                        <div className="text-[9.5px] uppercase font-black">{item.label}</div>
                        <div className="text-[8.5px] uppercase font-bold opacity-80">{item.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-16 text-center uppercase font-black text-slate-500 text-[10px]">Select a transformation to view input and output lines.</div>
          )}
        </div>
      </div>
    </div>
  );
}

