warning: in the working copy of 'src/pos-new/components/ProductTransformationPanel.tsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/pos-new/components/ProductTransformationPanel.tsx b/src/pos-new/components/ProductTransformationPanel.tsx[m
[1mindex 81e18e6..ad51a77 100644[m
[1m--- a/src/pos-new/components/ProductTransformationPanel.tsx[m
[1m+++ b/src/pos-new/components/ProductTransformationPanel.tsx[m
[36m@@ -23,7 +23,7 @@[m [mimport {[m
 import {[m
   POProductSearchResult,[m
   searchProductsAnyOrder[m
[31m-} from '../services/purchaseOrderProductService';[m
[32m+[m[32m} from '../services/purchaseOrderProductService';import { getProductTotalAvailableStock } from '../services/stockBalanceService';[m
 import {[m
   canUseProductTransformationFirestore,[m
   subscribeToTransformations,[m
[36m@@ -79,6 +79,10 @@[m [mexport default function ProductTransformationPanel() {[m
   const [pickerMode, setPickerMode] = useState<PickerMode | null>(null);[m
   const [productQuery, setProductQuery] = useState('');[m
   const [productResults, setProductResults] = useState<POProductSearchResult[]>([]);[m
[32m+[m[32m  const [inputSearchQuery, setInputSearchQuery] = useState('');[m
[32m+[m[32m  const [inputSearchResults, setInputSearchResults] = useState<POProductSearchResult[]>([]);[m
[32m+[m[32m  const [outputSearchQuery, setOutputSearchQuery] = useState('');[m
[32m+[m[32m  const [outputSearchResults, setOutputSearchResults] = useState<POProductSearchResult[]>([]);[m
 [m
   const refresh = async () => {[m
     setLoading(true);[m
[36m@@ -159,6 +163,55 @@[m [mexport default function ProductTransformationPanel() {[m
 [m
   const editable = selected?.status === 'Draft';[m
 [m
[32m+[m[32m  const bomTemplates = [[m
[32m+[m[32m    {[m
[32m+[m[32m      templateId: 'bom-radiator-basic',[m
[32m+[m[32m      templateName: 'Radiator Assembly Basic',[m
[32m+[m[32m      description: 'Sample conversion recipe for radiator assembly build.',[m
[32m+[m[32m      inputs: [[m
[32m+[m[32m        { productId: 'mat-radiator-core', sku: 'RAD-CORE', productName: 'Radiator Core', qtyConsumed: 1, unitCost: 25, sourceWarehouseId: 'MAIN' },[m
[32m+[m[32m        { productId: 'mat-side-tank', sku: 'SIDE-TANK', productName: 'Side Tank', qtyConsumed: 2, unitCost: 8, sourceWarehouseId: 'MAIN' }[m
[32m+[m[32m      ],[m
[32m+[m[32m      outputs: [[m
[32m+[m[32m        { productId: 'fg-radiator-assembly', sku: 'RAD-ASSY', productName: 'Radiator Assembly', qtyProduced: 1, unitCost: 41, destinationWarehouseId: 'MAIN' }[m
[32m+[m[32m      ][m
[32m+[m[32m    },[m
[32m+[m[32m    {[m
[32m+[m[32m      templateId: 'bom-kit-basic',[m
[32m+[m[32m      templateName: 'Basic Kit Pack',[m
[32m+[m[32m      description: 'Sample kit recipe for bundling multiple parts into one sellable pack.',[m
[32m+[m[32m      inputs: [[m
[32m+[m[32m        { productId: 'mat-part-a', sku: 'PART-A', productName: 'Component A', qtyConsumed: 1, unitCost: 5, sourceWarehouseId: 'MAIN' },[m
[32m+[m[32m        { productId: 'mat-part-b', sku: 'PART-B', productName: 'Component B', qtyConsumed: 1, unitCost: 7, sourceWarehouseId: 'MAIN' }[m
[32m+[m[32m      ],[m
[32m+[m[32m      outputs: [[m
[32m+[m[32m        { productId: 'fg-basic-kit', sku: 'KIT-BASIC', productName: 'Basic Kit Pack', qtyProduced: 1, unitCost: 12, destinationWarehouseId: 'MAIN' }[m
[32m+[m[32m      ][m
[32m+[m[32m    }[m
[32m+[m[32m  ];[m
[32m+[m
[32m+[m[32m  const handleApplyBomTemplate = async (template: typeof bomTemplates[number]) => {[m
[32m+[m[32m    if (!selected || !editable) {[m
[32m+[m[32m      setNotice('Select a draft transformation before loading a recipe template.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    for (const input of template.inputs) {[m
[32m+[m[32m      await addInputLine(selected.transformationId, input);[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    for (const output of template.outputs) {[m
[32m+[m[32m      await addOutputLine(selected.transformationId, output);[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    setInputSearchQuery('');[m
[32m+[m[32m    setInputSearchResults([]);[m
[32m+[m[32m    setOutputSearchQuery('');[m
[32m+[m[32m    setOutputSearchResults([]);[m
[32m+[m[32m    await reloadSelected();[m
[32m+[m[32m    setNotice(`${template.templateName} recipe loaded into draft.`);[m
[32m+[m[32m  };[m
[32m+[m
   const summary = useMemo(() => {[m
     const total = records.length;[m
     const draft = records.filter((item) => item.status === 'Draft').length;[m
[36m@@ -293,10 +346,12 @@[m [mexport default function ProductTransformationPanel() {[m
       notes: draftNotes.trim() || 'Product transformation draft created from POS workspace.'[m
     });[m
 [m
[31m-    setDraftNotes('');[m
     setCreateOpen(false);[m
[31m-    await refresh();[m
[32m+[m[32m    setDraftNotes('');[m
     await loadTransformationDetail(draft);[m
[32m+[m[32m    await refresh();[m
[32m+[m[32m    setSelected(draft);[m
[32m+[m[32m    setNotice(`${draft.transformationNumber} draft created and loaded.`);[m
   };[m
 [m
   const reloadSelected = async () => {[m
[36m@@ -322,9 +377,16 @@[m [mexport default function ProductTransformationPanel() {[m
 [m
     const product = result.product;[m
     const warehouse = result.shelfLocation || 'MAIN';[m
[31m-    const unitCost = product.defaultCostPrice || 0;[m
[32m+[m[32m    const unitCost =[m
[32m+[m[32m      (product as any).costPrice ||[m
[32m+[m[32m      (product as any).cost ||[m
[32m+[m[32m      (product as any).averageCost ||[m
[32m+[m[32m      0;[m
 [m
[31m-    if (pickerMode === 'Input') {[m
[32m+[m[32m    const mode = pickerMode.toLowerCase();[m
[32m+[m[32m    let successMessage = '';[m
[32m+[m
[32m+[m[32m    if (mode === 'input') {[m
       const line = await addInputLine(selected.transformationId, {[m
         productId: product.productId,[m
         sku: product.sku || product.productCode,[m
[36m@@ -339,9 +401,15 @@[m [mexport default function ProductTransformationPanel() {[m
         setNotice('Input product could not be added.');[m
         return;[m
       }[m
[32m+[m[32m      const available = await getProductTotalAvailableStock(product.productId);[m
[32m+[m[32m      if (available < 1) {[m
[32m+[m[32m        successMessage = `Warning: Available stock for ${product.productName} is ${available}, which is less than the consumed quantity of 1.`;[m
[32m+[m[32m      } else {[m
[32m+[m[32m        successMessage = 'Input material added.';[m
[32m+[m[32m      }[m
     }[m
 [m
[31m-    if (pickerMode === 'Output') {[m
[32m+[m[32m    if (mode === 'output') {[m
       const line = await addOutputLine(selected.transformationId, {[m
         productId: product.productId,[m
         sku: product.sku || product.productCode,[m
[36m@@ -356,23 +424,159 @@[m [mexport default function ProductTransformationPanel() {[m
         setNotice('Output product could not be added.');[m
         return;[m
       }[m
[32m+[m[32m      successMessage = 'Output product added.';[m
     }[m
 [m
     setPickerMode(null);[m
     setProductQuery('');[m
     setProductResults([]);[m
     await reloadSelected();[m
[32m+[m[32m    if (successMessage) {[m
[32m+[m[32m      setNotice(successMessage);[m
[32m+[m[32m    }[m
[32m+[m[32m    setTimeout(() => {[m
[32m+[m[32m      if (mode === 'input') {[m
[32m+[m[32m        document.getElementById('input-materials-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });[m
[32m+[m[32m      } else if (mode === 'output') {[m
[32m+[m[32m        document.getElementById('output-products-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });[m
[32m+[m[32m      }[m
[32m+[m[32m    }, 100);[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  const handleInputSearch = async (query: string) => {[m
[32m+[m[32m    setInputSearchQuery(query);[m
[32m+[m[32m    if (!query.trim()) {[m
[32m+[m[32m      setInputSearchResults([]);[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m[32m    const rows = await searchProductsAnyOrder(query);[m
[32m+[m[32m    setInputSearchResults(rows);[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  const handleOutputSearch = async (query: string) => {[m
[32m+[m[32m    setOutputSearchQuery(query);[m
[32m+[m[32m    if (!query.trim()) {[m
[32m+[m[32m      setOutputSearchResults([]);[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m[32m    const rows = await searchProductsAnyOrder(query);[m
[32m+[m[32m    setOutputSearchResults(rows);[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  const handleAddInputProduct = async (result: POProductSearchResult) => {[m
[32m+[m[32m    if (!selected || !editable) return;[m
[32m+[m[32m    const product = result.product;[m
[32m+[m[32m    const warehouse = result.shelfLocation || 'MAIN';[m
[32m+[m[32m    const unitCost =[m
[32m+[m[32m      (product as any).costPrice ||[m
[32m+[m[32m      (product as any).cost ||[m
[32m+[m[32m      (product as any).averageCost ||[m
[32m+[m[32m      0;[m
[32m+[m
[32m+[m[32m    const line = await addInputLine(selected.transformationId, {[m
[32m+[m[32m      productId: product.productId,[m
[32m+[m[32m      sku: product.sku || product.productCode,[m
[32m+[m[32m      productName: product.productName,[m
[32m+[m[32m      qtyConsumed: 1,[m
[32m+[m[32m      unitCost,[m
[32m+[m[32m      sourceWarehouseId: warehouse,[m
[32m+[m[32m      sourceShelfLocation: result.shelfLocation[m
[32m+[m[32m    });[m
[32m+[m
[32m+[m[32m    if (!line) {[m
[32m+[m[32m      setNotice('Input product could not be added.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    setInputSearchQuery('');[m
[32m+[m[32m    setInputSearchResults([]);[m
[32m+[m[32m    await reloadSelected();[m
[32m+[m
[32m+[m[32m    const available = await getProductTotalAvailableStock(product.productId);[m
[32m+[m[32m    if (available < 1) {[m
[32m+[m[32m      setNotice(`Warning: Available stock for ${product.productName} is ${available}, which is less than the consumed quantity of 1.`);[m
[32m+[m[32m    } else {[m
[32m+[m[32m      setNotice('Input material added.');[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    setTimeout(() => {[m
[32m+[m[32m      document.getElementById('input-materials-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });[m
[32m+[m[32m    }, 100);[m
[32m+[m[32m  };[m
[32m+[m
[32m+[m[32m  const handleAddOutputProduct = async (result: POProductSearchResult) => {[m
[32m+[m[32m    if (!selected || !editable) return;[m
[32m+[m[32m    const product = result.product;[m
[32m+[m[32m    const warehouse = result.shelfLocation || 'MAIN';[m
[32m+[m[32m    const unitCost =[m
[32m+[m[32m      (product as any).costPrice ||[m
[32m+[m[32m      (product as any).cost ||[m
[32m+[m[32m      (product as any).averageCost ||[m
[32m+[m[32m      0;[m
[32m+[m
[32m+[m[32m    const line = await addOutputLine(selected.transformationId, {[m
[32m+[m[32m      productId: product.productId,[m
[32m+[m[32m      sku: product.sku || product.productCode,[m
[32m+[m[32m      productName: product.productName,[m
[32m+[m[32m      qtyProduced: 1,[m
[32m+[m[32m      unitCost,[m
[32m+[m[32m      destinationWarehouseId: warehouse,[m
[32m+[m[32m      destinationShelfLocation: result.shelfLocation[m
[32m+[m[32m    });[m
[32m+[m
[32m+[m[32m    if (!line) {[m
[32m+[m[32m      setNotice('Output product could not be added.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    setOutputSearchQuery('');[m
[32m+[m[32m    setOutputSearchResults([]);[m
[32m+[m[32m    await reloadSelected();[m
[32m+[m[32m    setNotice('Output product added.');[m
[32m+[m
[32m+[m[32m    setTimeout(() => {[m
[32m+[m[32m      document.getElementById('output-products-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });[m
[32m+[m[32m    }, 100);[m
   };[m
 [m
   const handleUpdateInput = async (lineId: string, patch: Partial<ProductTransformationInputLine>) => {[m
     if (!selected || !editable) return;[m
[32m+[m
[32m+[m[32m    if (patch.qtyConsumed !== undefined && patch.qtyConsumed < 0) {[m
[32m+[m[32m      setNotice('Quantity cannot be negative.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m[32m    if (patch.unitCost !== undefined && patch.unitCost < 0) {[m
[32m+[m[32m      setNotice('Unit cost cannot be negative.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m
     const updated = await updateInputLine(selected.transformationId, lineId, patch);[m
     if (!updated) return;[m
     setInputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));[m
[32m+[m
[32m+[m[32m    if (patch.qtyConsumed !== undefined) {[m
[32m+[m[32m      const available = await getProductTotalAvailableStock(updated.productId);[m
[32m+[m[32m      if (available < patch.qtyConsumed) {[m
[32m+[m[32m        setNotice(`Warning: Available stock for ${updated.productName} is ${available}, which is less than the consumed quantity of ${patch.qtyConsumed}.`);[m
[32m+[m[32m      } else {[m
[32m+[m[32m        setNotice(null);[m
[32m+[m[32m      }[m
[32m+[m[32m    }[m
   };[m
 [m
   const handleUpdateOutput = async (lineId: string, patch: Partial<ProductTransformationOutputLine>) => {[m
     if (!selected || !editable) return;[m
[32m+[m
[32m+[m[32m    if (patch.qtyProduced !== undefined && patch.qtyProduced < 0) {[m
[32m+[m[32m      setNotice('Quantity cannot be negative.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m[32m    if (patch.unitCost !== undefined && patch.unitCost < 0) {[m
[32m+[m[32m      setNotice('Unit cost cannot be negative.');[m
[32m+[m[32m      return;[m
[32m+[m[32m    }[m
[32m+[m
     const updated = await updateOutputLine(selected.transformationId, lineId, patch);[m
     if (!updated) return;[m
     setOutputLines((prev) => prev.map((line) => line.lineId === lineId ? updated : line));[m
[36m@@ -442,7 +646,7 @@[m [mexport default function ProductTransformationPanel() {[m
         </div>[m
 [m
         <div className="flex flex-wrap gap-2">[m
[31m-          <button type="button" onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-[#1e222b] hover:bg-black text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">[m
[32m+[m[32m          <button type="button" onClick={() => setCreateOpen(true)} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[9.5px] rounded-none cursor-pointer flex items-center gap-2">[m
             <Plus className="w-4 h-4" />[m
             New Transformation[m
           </button>[m
[36m@@ -611,12 +815,83 @@[m [mexport default function ProductTransformationPanel() {[m
                 </div>[m
               </div>[m
 [m
[32m+[m[32m              <div className="border border-orange-300 bg-orange-50 p-3 space-y-3">[m
[32m+[m[32m                <div>[m
[32m+[m[32m                  <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Recipe / BOM Templates</h4>[m
[32m+[m[32m                  <p className="text-[8.5px] uppercase font-bold text-slate-600">Load a controlled recipe into this draft transformation.</p>[m
[32m+[m[32m                </div>[m
[32m+[m[32m                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">[m
[32m+[m[32m                  {bomTemplates.map((template) => ([m
[32m+[m[32m                    <div key={template.templateId} className="bg-white border border-[#b1b5c2] p-3">[m
[32m+[m[32m                      <div className="text-[10px] uppercase font-black text-[#1e222b]">{template.templateName}</div>[m
[32m+[m[32m                      <div className="text-[8.5px] uppercase font-bold text-slate-500 mt-1">{template.description}</div>[m
[32m+[m[32m                      <div className="text-[8px] uppercase font-black text-slate-600 mt-2">[m
[32m+[m[32m                        Inputs: {template.inputs.length} | Outputs: {template.outputs.length}[m
[32m+[m[32m                      </div>[m
[32m+[m[32m                      <button[m
[32m+[m[32m                        type="button"[m
[32m+[m[32m                        disabled={!editable}[m
[32m+[m[32m                        onClick={() => void handleApplyBomTemplate(template)}[m
[32m+[m[32m                        className="mt-3 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[8.5px] rounded-none disabled:bg-slate-300 disabled:border-slate-300"[m
[32m+[m[32m                      >[m
[32m+[m[32m                        Load Recipe[m
[32m+[m[32m                      </button>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                  ))}[m
[32m+[m[32m                </div>[m
[32m+[m[32m              </div>[m
               <div>[m
                 <div className="flex items-center justify-between mb-2">[m
                   <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Input Materials</h4>[m
[31m-                  <button type="button" disabled={!editable} onClick={() => openPicker('Input')} className="px-3 py-1 bg-[#1e222b] disabled:bg-slate-300 text-white text-[8px] uppercase font-black">+ Add Input</button>[m
[32m+[m[32m                  <button type="button" disabled={!editable} onClick={() => openPicker('Input')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none disabled:bg-slate-300 disabled:border-slate-300 cursor-pointer">+ Add Input</button>[m
[32m+[m[32m                </div>[m
[32m+[m
[32m+[m[32m                <div className="mb-3 space-y-2">[m
[32m+[m[32m                  <input[m
[32m+[m[32m                    disabled={!selected || !editable}[m
[32m+[m[32m                    value={inputSearchQuery}[m
[32m+[m[32m                    onChange={(event) => void handleInputSearch(event.target.value)}[m
[32m+[m[32m                    className="w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none disabled:bg-slate-100 text-[#1e222b]"[m
[32m+[m[32m                    placeholder="Search input material by SKU, product name, brand, barcode, part number..."[m
[32m+[m[32m                  />[m
[32m+[m[32m                  {inputSearchResults.length > 0 && ([m
[32m+[m[32m                    <div className="border border-[#b1b5c2] bg-slate-50 max-h-[150px] overflow-y-auto pos-custom-scroll p-1">[m
[32m+[m[32m                      <table className="w-full text-[8.5px] uppercase">[m
[32m+[m[32m                        <thead>[m
[32m+[m[32m                          <tr className="border-b border-gray-250 text-slate-600 font-bold">[m
[32m+[m[32m                            <th className="p-1 text-left">SKU</th>[m
[32m+[m[32m                            <th className="p-1 text-left">Product Name</th>[m
[32m+[m[32m                            <th className="p-1 text-right">Available Qty</th>[m
[32m+[m[32m                            <th className="p-1 text-right">Cost</th>[m
[32m+[m[32m                            <th className="p-1 text-left">Shelf</th>[m
[32m+[m[32m                            <th className="p-1 text-center">Action</th>[m
[32m+[m[32m                          </tr>[m
[32m+[m[32m                        </thead>[m
[32m+[m[32m                        <tbody>[m
[32m+[m[32m                          {inputSearchResults.map((row) => ([m
[32m+[m[32m                            <tr key={row.product.productId} className="border-b border-gray-100 last:border-0 text-[#1e222b]">[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.product.sku || row.product.productCode}</td>[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.product.productName}</td>[m
[32m+[m[32m                              <td className="p-1 text-right font-mono">{row.currentStock}</td>[m
[32m+[m[32m                              <td className="p-1 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.shelfLocation || '-'}</td>[m
[32m+[m[32m                              <td className="p-1 text-center">[m
[32m+[m[32m                                <button[m
[32m+[m[32m                                  type="button"[m
[32m+[m[32m                                  onClick={() => void handleAddInputProduct(row)}[m
[32m+[m[32m                                  className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"[m
[32m+[m[32m                                >[m
[32m+[m[32m                                  Add[m
[32m+[m[32m                                </button>[m
[32m+[m[32m                              </td>[m
[32m+[m[32m                            </tr>[m
[32m+[m[32m                          ))}[m
[32m+[m[32m                        </tbody>[m
[32m+[m[32m                      </table>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                  )}[m
                 </div>[m
[31m-                <div className="border border-gray-200 overflow-x-auto">[m
[32m+[m[32m                <div id="input-materials-table" className="border border-gray-200 overflow-x-auto">[m
                   <table className="w-full text-[9px] uppercase">[m
                     <thead className="bg-slate-100 text-slate-700 font-black">[m
                       <tr>[m
[36m@@ -651,18 +926,64 @@[m [mexport default function ProductTransformationPanel() {[m
               <div>[m
                 <div className="flex items-center justify-between mb-2">[m
                   <h4 className="text-[10px] uppercase font-black text-[#1e222b]">Output Products</h4>[m
[31m-                  <button type="button" disabled={!editable} onClick={() => openPicker('Output')} className="px-3 py-1 bg-[#1e222b] disabled:bg-slate-300 text-white text-[8px] uppercase font-black">+ Add Output</button>[m
[32m+[m[32m                  <button type="button" disabled={!editable} onClick={() => openPicker('Output')} className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[9px] rounded-none disabled:bg-slate-300 disabled:border-slate-300 cursor-pointer">+ Add Output</button>[m
                 </div>[m
[31m-                <div className="border border-gray-200 overflow-x-auto">[m
[32m+[m
[32m+[m[32m                <div className="mb-3 space-y-2">[m
[32m+[m[32m                  <input[m
[32m+[m[32m                    disabled={!selected || !editable}[m
[32m+[m[32m                    value={outputSearchQuery}[m
[32m+[m[32m                    onChange={(event) => void handleOutputSearch(event.target.value)}[m
[32m+[m[32m                    className="w-full border border-[#b1b5c2] bg-white px-2 py-1 text-[9px] uppercase font-bold outline-none focus:border-orange-500 rounded-none disabled:bg-slate-100 text-[#1e222b]"[m
[32m+[m[32m                    placeholder="Search output product by SKU, product name, brand, barcode, part number..."[m
[32m+[m[32m                  />[m
[32m+[m[32m                  {outputSearchResults.length > 0 && ([m
[32m+[m[32m                    <div className="border border-[#b1b5c2] bg-slate-50 max-h-[150px] overflow-y-auto pos-custom-scroll p-1">[m
[32m+[m[32m                      <table className="w-full text-[8.5px] uppercase">[m
[32m+[m[32m                        <thead>[m
[32m+[m[32m                          <tr className="border-b border-gray-250 text-slate-600 font-bold">[m
[32m+[m[32m                            <th className="p-1 text-left">SKU</th>[m
[32m+[m[32m                            <th className="p-1 text-left">Product Name</th>[m
[32m+[m[32m                            <th className="p-1 text-right">Available Qty</th>[m
[32m+[m[32m                            <th className="p-1 text-right">Cost</th>[m
[32m+[m[32m                            <th className="p-1 text-left">Shelf</th>[m
[32m+[m[32m                            <th className="p-1 text-center">Action</th>[m
[32m+[m[32m                          </tr>[m
[32m+[m[32m                        </thead>[m
[32m+[m[32m                        <tbody>[m
[32m+[m[32m                          {outputSearchResults.map((row) => ([m
[32m+[m[32m                            <tr key={row.product.productId} className="border-b border-gray-100 last:border-0 text-[#1e222b]">[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.product.sku || row.product.productCode}</td>[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.product.productName}</td>[m
[32m+[m[32m                              <td className="p-1 text-right font-mono">{row.currentStock}</td>[m
[32m+[m[32m                              <td className="p-1 text-right font-mono">{row.product.defaultCostPrice.toFixed(2)}</td>[m
[32m+[m[32m                              <td className="p-1 font-bold">{row.shelfLocation || '-'}</td>[m
[32m+[m[32m                              <td className="p-1 text-center">[m
[32m+[m[32m                                <button[m
[32m+[m[32m                                  type="button"[m
[32m+[m[32m                                  onClick={() => void handleAddOutputProduct(row)}[m
[32m+[m[32m                                  className="px-2 py-0.5 bg-orange-500 hover:bg-orange-600 border border-orange-500 hover:border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"[m
[32m+[m[32m                                >[m
[32m+[m[32m                                  Add[m
[32m+[m[32m                                </button>[m
[32m+[m[32m                              </td>[m
[32m+[m[32m                            </tr>[m
[32m+[m[32m                          ))}[m
[32m+[m[32m                        </tbody>[m
[32m+[m[32m                      </table>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                  )}[m
[32m+[m[32m                </div>[m
[32m+[m[32m                <div id="output-products-table" className="border border-gray-200 overflow-x-auto">[m
                   <table className="w-full text-[9px] uppercase">[m
                     <thead className="bg-slate-100 text-slate-700 font-black">[m
                       <tr>[m
                         <th className="p-2 text-left">SKU</th>[m
                         <th className="p-2 text-left">Product</th>[m
                         <th className="p-2 text-left">Warehouse</th>[m
[31m-                        <th className="p-2 text-right">Qty</th>[m
[32m+[m[32m                        <th className="p-2 text-right">Qty Produced</th>[m
                         <th className="p-2 text-right">Unit Cost</th>[m
[31m-                        <th className="p-2 text-right">Value</th>[m
[32m+[m[32m                        <th className="p-2 text-right">Output Value</th>[m
                         <th className="p-2 text-center">Delete</th>[m
                       </tr>[m
                     </thead>[m
