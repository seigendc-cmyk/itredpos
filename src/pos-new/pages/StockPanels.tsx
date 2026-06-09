import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Plus, 
  Minus, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ShoppingBag, 
  ClipboardList, 
  Sliders, 
  ArrowRightLeft, 
  Eye, 
  PlusCircle, 
  Shield, 
  AlertCircle,
  HelpCircle,
  Download
} from 'lucide-react';
import { 
  Product, 
  Role, 
  PurchaseOrder, 
  GRNLine, 
  GoodsReceivedNote, 
  SupplierReturn, 
  StockAdjustmentRequest, 
  StocktakeLine, 
  ApprovalRequest, 
  ApprovalRequestType 
} from '../types';

interface StockProduct extends Product {
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Dead Stock' | 'Variance Risk' | 'Fast Moving' | 'Slow Moving';
}

interface StockPanelsProps {
  localStock: StockProduct[];
  setLocalStock: (stock: StockProduct[]) => void;
  saveLocalStockState: (stock: StockProduct[]) => void;
  staffName: string;
  activeBranch: string;
  simulatedRole: Role;
  setSimulatedRole: (role: Role) => void;
  triggerNewActivityEvent: (type: any, message: string, severity: 'Low' | 'Medium' | 'High' | 'Critical') => void;
  stockApprovals: ApprovalRequest[];
  setStockApprovals: React.Dispatch<React.SetStateAction<ApprovalRequest[]>>;
  canApprove: (reqType: ApprovalRequestType, role: Role) => boolean;
  onUpdateStock: (productId: string, newStock: number) => void;
  activeTab: 'Stock List' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake';
  setActiveTab: (tab: 'Stock List' | 'Goods Receiving' | 'Purchase Orders' | 'Supplier Returns' | 'Stock Adjustments' | 'Stocktake') => void;
}

export default function StockPanels({
  localStock,
  setLocalStock,
  saveLocalStockState,
  staffName,
  activeBranch,
  simulatedRole,
  setSimulatedRole,
  triggerNewActivityEvent,
  stockApprovals,
  setStockApprovals,
  canApprove,
  onUpdateStock,
  activeTab,
  setActiveTab
}: StockPanelsProps) {

  // --- LOCAL PERSISTENCE STORAGE FOR SUB-PAGES ---
  
  // 1. Purchase Orders State
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
    const cached = localStorage.getItem('sci_pos_purchase_orders');
    return cached ? JSON.parse(cached) : [
      {
        poNumber: 'PO-1001',
        supplierName: 'ABC Motor Spares Supplier',
        createdDate: '2026-06-07',
        expectedDate: '2026-06-12',
        itemsCount: 4,
        totalCost: 680.00,
        status: 'Open',
        items: [
          { sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', quantity: 20, cost: 7.00 },
          { sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', quantity: 10, cost: 18.00 },
          { sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', quantity: 5, cost: 32.00 },
          { sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', quantity: 4, cost: 40.00 }
        ]
      },
      {
        poNumber: 'PO-1002',
        supplierName: 'Harare Lubricants Ltd',
        createdDate: '2026-06-06',
        expectedDate: '2026-06-09',
        itemsCount: 1,
        totalCost: 240.00,
        status: 'Partially Received',
        items: [
          { sku: 'SLV-D24', productName: 'Solenoid Valve 24V DC', quantity: 6, cost: 40.00 }
        ]
      },
      {
        poNumber: 'PO-1003',
        supplierName: 'Toyota Parts Wholesale',
        createdDate: '2026-06-01',
        expectedDate: '2026-06-08',
        itemsCount: 1,
        totalCost: 875.00,
        status: 'Closed',
        items: [
          { sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', quantity: 50, cost: 17.50 }
        ]
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('sci_pos_purchase_orders', JSON.stringify(purchaseOrders));
  }, [purchaseOrders]);

  // Selected PO details modal target
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // 2. Goods Receiving Form and Lines State
  const [grnNumber, setGrnNumber] = useState(() => `GRN-2026-${Math.floor(Math.random() * 8999 + 1000)}`);
  const [grnSupplier, setGrnSupplier] = useState('ABC Motor Spares Supplier');
  const [grnInvoiceNo, setGrnInvoiceNo] = useState('');
  const [grnPoRef, setGrnPoRef] = useState('PO-1001');
  const [grnBranch, setGrnBranch] = useState('Harare Main');
  const [grnWarehouse, setGrnWarehouse] = useState('Main Warehouse');
  const [grnNotes, setGrnNotes] = useState('');
  
  // Loading default mock items for receiving
  const [grnLines, setGrnLines] = useState<GRNLine[]>([
    { sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', orderedQty: 20, receivedQty: 20, costPrice: 7.00, prevCostPrice: 6.80, currentPrice: 12.00, suggestedPrice: 13.00, status: 'Matched', accepted: false, rejected: false, priceUpdated: false, flagged: false },
    { sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', orderedQty: 10, receivedQty: 8, costPrice: 18.00, prevCostPrice: 17.50, currentPrice: 28.00, suggestedPrice: 30.00, status: 'Short Received', accepted: false, rejected: false, priceUpdated: false, flagged: false },
    { sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', orderedQty: 5, receivedQty: 5, costPrice: 32.00, prevCostPrice: 30.00, currentPrice: 45.00, suggestedPrice: 48.00, status: 'Matched', accepted: false, rejected: false, priceUpdated: false, flagged: false },
    { sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', orderedQty: 4, receivedQty: 6, costPrice: 40.00, prevCostPrice: 38.00, currentPrice: 65.00, suggestedPrice: 70.00, status: 'Over Received', accepted: false, rejected: false, priceUpdated: false, flagged: false }
  ]);

  // Handle updates on active fields in GRN Table
  const updateGRNLineField = (sku: string, field: keyof GRNLine, value: any) => {
    setGrnLines(prev => prev.map(line => {
      if (line.sku === sku) {
        const updated = { ...line, [field]: value };
        
        // Dynamic Status Checking
        const ordered = updated.orderedQty;
        const received = updated.receivedQty;
        const cost = updated.costPrice;
        const prevCost = updated.prevCostPrice;
        
        // Base variance status
        let status = 'Matched';
        if (received < ordered) {
          status = 'Short Received';
        } else if (received > ordered) {
          status = 'Over Received';
        }

        // Cost price spike rule (15%)
        const costSpikePct = (cost - prevCost) / prevCost;
        if (costSpikePct > 0.15) {
          status = 'Cost Spike (' + (costSpikePct * 100).toFixed(0) + '%)';
        }

        return { ...updated, status };
      }
      return line;
    }));
  };

  const [grnFeedback, setGrnFeedback] = useState<{ type: 'success' | 'error' | 'warning', msg: string } | null>(null);

  // 3. Supplier Returns State & Form Binding
  const [supplierReturns, setSupplierReturns] = useState<SupplierReturn[]>(() => {
    const cached = localStorage.getItem('sci_pos_supplier_returns');
    return cached ? JSON.parse(cached) : [
      {
        id: 'RET-001',
        supplierName: 'ABC Motor Spares Supplier',
        originalGrn: 'GRN-2026-9041',
        sku: 'BJ-CBHO49',
        productName: 'Ball Joint Honda Fit GD1',
        quantityReturned: 2,
        reason: 'Wrong item supplied',
        condition: 'Resellable',
        status: 'Draft',
        createdDate: '2026-06-08',
        requestedBy: 'Stock Controller'
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('sci_pos_supplier_returns', JSON.stringify(supplierReturns));
  }, [supplierReturns]);

  const [retSupplier, setRetSupplier] = useState('ABC Motor Spares Supplier');
  const [retGrn, setRetGrn] = useState('');
  const [retSku, setRetSku] = useState('BJ-CBHO49');
  const [retQty, setRetQty] = useState('1');
  const [retReason, setRetReason] = useState('Wrong item supplied');
  const [retCondition, setRetCondition] = useState('Resellable');
  const [retFeedback, setRetFeedback] = useState<string | null>(null);

  // 4. Stock Adjustments State & Form Binding
  const [adjSku, setAdjSku] = useState('BJ-CBHO49');
  const [adjType, setAdjType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjCountQty, setAdjCountQty] = useState('');
  const [adjReasonCode, setAdjReasonCode] = useState('Stocktake variance');
  const [adjNotes, setAdjNotes] = useState('');
  const [adjFeedback, setAdjFeedback] = useState<{ type: 'success' | 'error' | 'warning', msg: string } | null>(null);

  // 5. Stocktake State Layout
  const [stocktakeLines, setStocktakeLines] = useState<StocktakeLine[]>([
    { sku: 'BJ-CBHO49', productName: 'Ball Joint Honda Fit GD1', systemQty: 25, countedQty: 25, variance: 0, riskLevel: 'Low', status: 'Pending' },
    { sku: 'BP-GD6-F', productName: 'Brake Pads Toyota GD6 Front', systemQty: 8, countedQty: 8, variance: 0, riskLevel: 'High', status: 'Pending' },
    { sku: 'CLT-N16', productName: 'Clutch Plate Nissan N16', systemQty: 12, countedQty: 12, variance: 0, riskLevel: 'Low', status: 'Pending' },
    { sku: 'RAD-COROLLA', productName: 'Radiator Toyota Corolla', systemQty: 15, countedQty: 15, variance: 0, riskLevel: 'High', status: 'Pending' }
  ]);
  const [stocktakeActive, setStocktakeActive] = useState(false);
  const [stocktakeFeedback, setStocktakeFeedback] = useState<string | null>(null);

  // Sync Stocktake lines Counted qty from original localStock quantities
  useEffect(() => {
    if (!stocktakeActive) {
      setStocktakeLines(prev => prev.map(line => {
        const match = localStock.find(p => p.code === line.sku);
        return {
          ...line,
          systemQty: match ? match.stock : line.systemQty,
          countedQty: match ? match.stock : line.countedQty,
          variance: 0
        };
      }));
    }
  }, [localStock, stocktakeActive]);

  // Helper to log BI Events globally in localStorage to reflect on PosBIDesk.tsx
  const logGlobalBiEvent = (eventType: string, payload: any, severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL') => {
    try {
      const cached = localStorage.getItem('itred_pos_bi_events');
      const events = cached ? JSON.parse(cached) : [];
      const newEvent = {
        id: 'BI-EV-' + Math.floor(Math.random() * 89999 + 10000),
        timestamp: new Date().toISOString(),
        eventType,
        operator: staffName,
        terminal: 'TERMINAL_STOCK_DESK',
        payload,
        severity
      };
      localStorage.setItem('itred_pos_bi_events', JSON.stringify([newEvent, ...events]));
    } catch (e) {
      console.error("Failed to append global BI event:", e);
    }
  };


  // =========================================================================
  // SUB-PAGES ACTIONS
  // =========================================================================

  // A. RECEIVE PO DISPATCHER: Prefills GRN Form from a PO and switches tab
  const handleQuickReceivePO = (po: PurchaseOrder) => {
    setGrnPoRef(po.poNumber);
    setGrnSupplier(po.supplierName);
    
    // Convert PO Items to GRNLine layout matching existing products
    const loadedLines: GRNLine[] = po.items.map(poItem => {
      const matchInStock = localStock.find(p => p.code === poItem.sku);
      return {
        sku: poItem.sku,
        productName: poItem.productName,
        orderedQty: poItem.quantity,
        receivedQty: poItem.quantity,
        costPrice: poItem.cost,
        prevCostPrice: matchInStock ? matchInStock.cost : poItem.cost - 0.50,
        currentPrice: matchInStock ? matchInStock.price : poItem.cost * 1.5,
        suggestedPrice: matchInStock ? matchInStock.price : poItem.cost * 1.5,
        status: 'Matched',
        accepted: false,
        rejected: false,
        priceUpdated: false,
        flagged: false
      };
    });

    setGrnLines(loadedLines);
    setGrnFeedback({ type: 'warning', msg: `Prepopulated Goods Receiving form with ${po.poNumber} items. Edit to register differences.` });
    setActiveTab('Goods Receiving');
  };

  // Close PO Action
  const handleClosePO = (poNo: string) => {
    setPurchaseOrders(prev => prev.map(p => p.poNumber === poNo ? { ...p, status: 'Closed' } : p));
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Purchase Order ${poNo} closed by operator manually.`, 'Low');
  };

  // Flag PO Delay Action
  const handleFlagPOOverdue = (poNo: string) => {
    setPurchaseOrders(prev => prev.map(p => p.poNumber === poNo ? { ...p, status: 'Overdue' } : p));
    triggerNewActivityEvent('LOW_STOCK_REMINDER', `Purchase Order ${poNo} flagged as Delayed (Overdue).`, 'Medium');
    logGlobalBiEvent('PURCHASE_ORDER_DELAYED', { poNumber: poNo, reason: 'Expected date exceeded supply dock receipt' }, 'WARNING');
  };


  // B. GRN GOODS INTAKE SUBMIT ACTION
  const handleGRNSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGrnFeedback(null);

    // Form Discipline Rule 5: Empty Invoice number blocking
    if (!grnInvoiceNo.trim()) {
      setGrnFeedback({ type: 'error', msg: 'Supplier invoice number is required to submit Goods Received Note.' });
      return;
    }

    // Form Discipline Rule 4: Selling price below cost check
    const sellingBelowCostLine = grnLines.find(line => !line.rejected && line.suggestedPrice < line.costPrice);
    if (sellingBelowCostLine) {
      setGrnFeedback({
        type: 'error',
        msg: `BLOCKED: For item [${sellingBelowCostLine.sku}] ${sellingBelowCostLine.productName}, Suggested selling price (USD ${sellingBelowCostLine.suggestedPrice.toFixed(2)}) is lower than Cost Price (USD ${sellingBelowCostLine.costPrice.toFixed(2)}).`
      });
      logGlobalBiEvent('SELLING_BELOW_COST_BLOCKED', { sku: sellingBelowCostLine.sku, cost: sellingBelowCostLine.costPrice, requestedSelling: sellingBelowCostLine.suggestedPrice }, 'HIGH');
      triggerNewActivityEvent('SALE_BLOCKED_ZERO_STOCK', `Procurement blocked: Suggested selling price below Cost price for SKU ${sellingBelowCostLine.sku}`, 'High');
      return;
    }

    // Check for quantity variances or cost spikes
    const hasQuantityVariance = grnLines.some(line => !line.rejected && line.receivedQty !== line.orderedQty);
    
    // Cost Spike check (higher than previous cost by more than 15%)
    const spikeLine = grnLines.find(line => {
      if (line.rejected) return false;
      const pctIncrease = (line.costPrice - line.prevCostPrice) / line.prevCostPrice;
      return pctIncrease > 0.15;
    });

    // Determine the required actions
    if (hasQuantityVariance || spikeLine) {
      // Rule 6: Require Supervisor/Manager approval
      const isSupervisorClearedLog = canApprove('GRN Variance Approval', simulatedRole);
      
      const reqId = 'APR-GRN-' + Math.floor(Math.random() * 8999 + 1000);
      const notes = `GRN [${grnNumber}] Invoice [${grnInvoiceNo}] has variance/spikes. ` +
        (hasQuantityVariance ? 'Quantity discrepancy. ' : '') + 
        (spikeLine ? `Cost Spike detected on SKU ${spikeLine.sku} (+${(((spikeLine.costPrice - spikeLine.prevCostPrice) / spikeLine.prevCostPrice) * 100).toFixed(0)}%).` : '');

      const newApproval: ApprovalRequest = {
        id: reqId,
        type: spikeLine ? 'Cost Spike Approval' : 'GRN Variance Approval',
        status: isSupervisorClearedLog ? 'Approved' : 'Pending',
        requestedBy: staffName,
        notes: notes,
        createdAt: new Date().toISOString(),
        payload: {
          grnNumber,
          grnSupplier,
          grnInvoiceNo,
          grnPoRef,
          notes: grnNotes,
          items: grnLines
        } as any
      };

      if (!isSupervisorClearedLog) {
        // Appends to pending queue
        setStockApprovals(prev => [newApproval, ...prev]);
        setGrnFeedback({
          type: 'warning',
          msg: `QUEUED FOR APPROVAL: GRN ${grnNumber} contains discrepancies (Variance or Price Spike). Submitted to Authorization Queue. Stock will NOT update until Approved by a Supervisor.`
        });
        
        // Audit logs
        triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `GRN ${grnNumber} queued for approval due to discrepancies.`, 'High');
        if (hasQuantityVariance) {
          logGlobalBiEvent('PURCHASE_VARIANCE_FOUND', { grnNumber, invoiceNo: grnInvoiceNo, poRef: grnPoRef }, 'HIGH');
          triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `Quantity variance flagged during intake of GRN ${grnNumber}`, 'Medium');
        }
        if (spikeLine) {
          logGlobalBiEvent('COST_PRICE_SPIKE', { grnNumber, sku: spikeLine.sku, oldCost: spikeLine.prevCostPrice, newCost: spikeLine.costPrice }, 'HIGH');
          triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `Cost speed spike detected (+15%) on SKU ${spikeLine.sku}`, 'High');
        }
        
        // Move back PO status to partially received if it exists
        if (grnPoRef) {
          setPurchaseOrders(prev => prev.map(p => p.poNumber === grnPoRef ? { ...p, status: 'Partially Received' } : p));
        }
        return;
      } else {
        // Supervisor role override is active, we can self-approve directly!
        applyGRNToStock(grnLines, grnNumber);
        setGrnFeedback({
          type: 'success',
          msg: `SUCCESS (Self-Approved by Authorised Role): GRN ${grnNumber} successfully posted and system inventory updated.`
        });
        return;
      }
    }

    // Standard Clean Submit: Apply to Stock immediately
    applyGRNToStock(grnLines, grnNumber);
    setGrnFeedback({ type: 'success', msg: `SUCCESS: Goods Received Note ${grnNumber} successfully registered into database and quantities incremented.` });
  };

  // Helper function to update products with received items
  const applyGRNToStock = (lines: GRNLine[], grnRef: string) => {
    let updatedCatalog = [...localStock];
    lines.forEach(line => {
      if (line.rejected) return;
      updatedCatalog = updatedCatalog.map(item => {
        if (item.code === line.sku) {
          const nextStock = item.stock + line.receivedQty;
          
          let healthStatus = item.healthStatus;
          if (nextStock > item.minStock) {
            healthStatus = 'In Stock' as any;
          }

          // Update cost and sell prices
          return {
            ...item,
            stock: nextStock,
            cost: line.costPrice,
            price: line.suggestedPrice,
            healthStatus: healthStatus,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return item;
      });

      // Call parent onUpdateStock prop
      const match = localStock.find(p => p.code === line.sku);
      if (match) {
        onUpdateStock(match.id, match.stock + line.receivedQty);
      }
    });

    saveLocalStockState(updatedCatalog);
    
    // Log successes
    triggerNewActivityEvent('GOODS_RECEIVED', `Posted GRN ${grnRef} with ${lines.length} lines. Inventory incremented.`, 'Low');
    logGlobalBiEvent('GOODS_RECEIVED', { grnRef, totalLines: lines.length }, 'INFO');

    // Mark PO closed if it matches
    if (grnPoRef) {
      setPurchaseOrders(prev => prev.map(p => p.poNumber === grnPoRef ? { ...p, status: 'Closed' } : p));
    }

    // Reset Form completely
    setGrnNumber(`GRN-2026-${Math.floor(Math.random() * 8999 + 1000)}`);
    setGrnInvoiceNo('');
    setGrnNotes('');
  };


  // C. SUPPLIER RETURN ACTION
  const handleSupplierReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRetFeedback(null);

    const matchProduct = localStock.find(p => p.code === retSku);
    if (!matchProduct) return;

    const qty = parseInt(retQty) || 0;
    if (qty <= 0) {
      setRetFeedback("Error: Quantity returned must be greater than zero.");
      return;
    }

    if (qty > matchProduct.stock) {
      setRetFeedback(`Blocked: Product catalog only holds ${matchProduct.stock} units. Cannot return ${qty} units.`);
      return;
    }

    // Subcontracting return
    const id = 'RET-' + Math.floor(Math.random() * 899 + 100);
    const newReturn: SupplierReturn = {
      id,
      supplierName: retSupplier,
      originalGrn: retGrn || 'GRN-MANUAL-ENTRY',
      sku: retSku,
      productName: matchProduct.name,
      quantityReturned: qty,
      reason: retReason,
      condition: retCondition,
      status: 'Draft',
      createdDate: new Date().toISOString().substring(0, 10),
      requestedBy: staffName
    };

    setSupplierReturns(prev => [newReturn, ...prev]);
    setRetFeedback(`Supplier Return Request ${id} created in 'Draft' state. Dispatch or Apply Credits to continue.`);
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Created return draft ${id} for SKU ${retSku}`, 'Low');
    logGlobalBiEvent('SUPPLIER_RETURN_CREATED', { returnId: id, sku: retSku, qty }, 'INFO');

    // Reset selector quantities
    setRetQty('1');
    setRetGrn('');
  };

  // Ship Return & Deduct Inventory Stock
  const handleShipAndDeductStock = (ret: SupplierReturn) => {
    const matchProduct = localStock.find(p => p.code === ret.sku);
    if (!matchProduct) return;

    if (matchProduct.stock < ret.quantityReturned) {
      alert(`Cannot dispatch: Stock on hand (${matchProduct.stock}) is less than return qty (${ret.quantityReturned}).`);
      return;
    }

    // Deduct stock levels in system catalog
    const updatedStock = localStock.map(p => {
      if (p.code === ret.sku) {
        const nextStock = p.stock - ret.quantityReturned;
        const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
        return {
          ...p,
          stock: nextStock,
          healthStatus: status as any,
          lastMovementDate: new Date().toISOString().substring(0, 10)
        };
      }
      return p;
    });

    saveLocalStockState(updatedStock);
    onUpdateStock(matchProduct.id, matchProduct.stock - ret.quantityReturned);

    // Update return status to Shipped
    setSupplierReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'Shipped' } : r));

    // Log telemetry events
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Supplier Return ${ret.id} dispatched. Deducted ${ret.quantityReturned} from store.`, 'Medium');
    logGlobalBiEvent('STOCK_TRANSFERRED', { returnId: ret.id, sku: ret.sku, qty: ret.quantityReturned }, 'WARNING');
  };

  // Credited mark
  const handleCompleteCredit = (retId: string) => {
    setSupplierReturns(prev => prev.map(r => r.id === retId ? { ...r, status: 'Credited' } : r));
    triggerNewActivityEvent('STOCK_TRANSFERRED', `Marked Return ${retId} as Credited by supplier. Credits ready for purchase invoices.`, 'Low');
    logGlobalBiEvent('SUPPLIER_CREDIT_PENDING', { returnId: retId }, 'INFO');
  };


  // D. STOCK ADJUSTMENTS SUBMISSION RULES
  const handleAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdjFeedback(null);

    const qty = parseInt(adjCountQty) || 0;
    if (qty <= 0) {
      setAdjFeedback({ type: 'error', msg: 'Adjustment quantity must be a positive integer.' });
      return;
    }

    // Rule 1: Cashier is completely blocked
    if (simulatedRole === 'Cashier') {
      setAdjFeedback({ type: 'error', msg: 'ACCESS DENIED: Operators with Cashier roles are not authorized to make or request stock adjustments.' });
      return;
    }

    const matchProduct = localStock.find(p => p.code === adjSku);
    if (!matchProduct) return;

    const currentQty = matchProduct.stock;
    const finalQtyStatus = adjType === 'ADD' ? currentQty + qty : currentQty - qty;

    if (finalQtyStatus < 0) {
      setAdjFeedback({ type: 'error', msg: `Invalid adjustment: Cannot deduct ${qty} units; catalog only holds ${currentQty}.` });
      return;
    }

    // Check Approval Level Requirements (Rule rule checks)
    const isNegative = adjType === 'DEDUCT';
    const isSensitiveLoss = isNegative && qty > 3;

    // Check roles
    if (simulatedRole === 'Stock Controller') {
      // Stock Controller ALWAYS requests, never applies directly!
      const reqId = 'APR-ADJ-' + Math.floor(Math.random() * 8999 + 1000);
      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stock Adjustment Approval',
        status: 'Pending',
        requestedBy: staffName,
        notes: `Stock adjustment for ${matchProduct.name} (Delta: ${isNegative ? '-' : '+'}${qty}). Reason: ${adjReasonCode}.`,
        createdAt: new Date().toISOString(),
        payload: { sku: adjSku, delta: isNegative ? -qty : qty, reason: adjReasonCode, notes: adjNotes } as any
      };
      setStockApprovals(prev => [newApproval, ...prev]);
      setAdjFeedback({ type: 'warning', msg: `Approval request ${reqId} queued. Stock Controller roles require Supervisor validation to adjust inventory.` });
      
      triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `Adjustment request filed for SKU ${adjSku}`, 'Medium');
      logGlobalBiEvent('STOCK_ADJUSTMENT_REQUESTED', { sku: adjSku, delta: isNegative ? -qty : qty }, 'INFO');
      return;
    }

    if (simulatedRole === 'Supervisor' && isSensitiveLoss) {
      // Supervisor cannot approve negative adjustments > 3 items!
      const reqId = 'APR-ADJ-' + Math.floor(Math.random() * 8999 + 1000);
      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stock Adjustment Approval',
        status: 'Pending',
        requestedBy: staffName,
        notes: `Manager Needed: Negative adjustment of ${qty} items (exceeds Supervisor cap of 3) for SKU ${adjSku}.`,
        createdAt: new Date().toISOString(),
        payload: { sku: adjSku, delta: -qty, reason: adjReasonCode, notes: adjNotes } as any
      };
      setStockApprovals(prev => [newApproval, ...prev]);
      setAdjFeedback({ type: 'warning', msg: `QUEUED FOR MANAGER: Negative adjustments greater than 3 units require Manager or Owner authorization. Queuing request ${reqId}.` });
      return;
    }

    // Qualified Role (Supervisor <=3, Manager / Owner / SysAdmin all): Apply directly
    const updatedStock = localStock.map(p => {
      if (p.code === adjSku) {
        const nextStock = finalQtyStatus;
        const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
        return {
          ...p,
          stock: nextStock,
          healthStatus: status as any,
          lastMovementDate: new Date().toISOString().substring(0, 10)
        };
      }
      return p;
    });

    saveLocalStockState(updatedStock);
    onUpdateStock(matchProduct.id, finalQtyStatus);

    triggerNewActivityEvent('STOCK_RECEIVED', `Stock Adjusted directly: ${matchProduct.name} set to ${finalQtyStatus} (${isNegative ? '-' : '+'}${qty}).`, 'Medium');
    logGlobalBiEvent('STOCK_RECEIVED', { sku: adjSku, change: isNegative ? -qty : qty, finalQtyStatus }, 'WARNING');

    if (adjReasonCode === 'Theft suspicion') {
      logGlobalBiEvent('SUSPICIOUS_STOCK_LOSS', { sku: adjSku, qtyLoss: qty, description: adjNotes || 'No notes left' }, 'HIGH');
      triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', `High risk theft-suspected shrinkage adjusted on SKU ${adjSku}`, 'High');
    }

    setAdjFeedback({ type: 'success', msg: `SUCCESS: Product ${adjSku} inventory adjusted successfully to ${finalQtyStatus}.` });
    setAdjCountQty('');
    setAdjNotes('');
  };


  // E. SPOT STOCKTAKE SUBMIT ACTION
  const handleSpotStocktakeLineChange = (sku: string, counted: string) => {
    const val = parseInt(counted) || 0;
    setStocktakeLines(prev => prev.map(line => {
      if (line.sku === sku) {
        const variance = val - line.systemQty;
        const riskLevel = variance === 0 ? 'Low' : (Math.abs(variance) > 5 ? 'Critical' : 'High');
        return {
          ...line,
          countedQty: val,
          variance,
          riskLevel: riskLevel as any,
          status: 'Counted'
        };
      }
      return line;
    }));
  };

  const handleStartStocktakeSession = () => {
    setStocktakeActive(true);
    setStocktakeFeedback("Audit Spot session STARTED. Key in observed quantities.");
  };

  // Spot check randomizer
  const handleRandomSpotCheck = () => {
    setStocktakeActive(true);
    setStocktakeLines(prev => prev.map(line => {
      if (Math.random() > 0.4) {
        const deviation = Math.floor(Math.random() * 5) - 2; // -2 to +2
        const finalCount = Math.max(0, line.systemQty + deviation);
        return {
          ...line,
          countedQty: finalCount,
          variance: finalCount - line.systemQty,
          riskLevel: finalCount - line.systemQty === 0 ? 'Low' : 'High',
          status: 'Counted'
        };
      }
      return line;
    }));
    setStocktakeFeedback("Random Spot count simulations generated. Review variances before posting.");
  };

  const handleRecommendMajorAudit = () => {
    logGlobalBiEvent('RECOMMEND_MAJOR_STOCKTAKE', { reason: 'Auditor recommendation' }, 'HIGH');
    triggerNewActivityEvent('RECOMMEND_MAJOR_STOCKTAKE', "Major physical stocktake recommended: Audit logs flag discrepancy risks.", 'High');
    alert("[RECOMMENDATION REGISTERED]\n===========================\nLogging Request: Recommend complete operational shutdown for full physical auditing.");
  };

  const handlePostStocktakeResults = () => {
    const totalLinesWithDiscrepancy = stocktakeLines.filter(l => l.variance !== 0);
    
    if (totalLinesWithDiscrepancy.length > 0) {
      const isCleared = canApprove('Stocktake Variance Approval', simulatedRole);
      
      const reqId = 'APR-STK-' + Math.floor(Math.random() * 8999 + 1000);
      const description = `Stocktake discrepancies found on ${totalLinesWithDiscrepancy.length} items. Target variance: ` + 
        totalLinesWithDiscrepancy.map(l => `${l.sku} (${l.variance > 0 ? '+' : ''}${l.variance})`).join(', ');

      const newApproval: ApprovalRequest = {
        id: reqId,
        type: 'Stocktake Variance Approval',
        status: isCleared ? 'Approved' : 'Pending',
        requestedBy: staffName,
        notes: description,
        createdAt: new Date().toISOString(),
        payload: { lines: stocktakeLines } as any
      };

      if (!isCleared) {
        setStockApprovals(prev => [newApproval, ...prev]);
        setStocktakeFeedback(`SUBMISSION FLAG: Posted counts contain variances. Request ${reqId} queued for Supervisor authorization before applying to database.`);
        logGlobalBiEvent('VARIANCE_RISK_FOUND', { totalDiscrepantLines: totalLinesWithDiscrepancy.length }, 'HIGH');
        triggerNewActivityEvent('STOCK_ADJUSTMENT_REQUESTED', `Variance discrepancy found in stocktake audit. Filed request.`, 'High');
        return;
      }
    }

    // matched or supervisor auto-approves
    applyStocktakeToStock(stocktakeLines);
    setStocktakeFeedback("SUCCESS: Spot checks validated and posted to Ledger database. Quantities synched.");
    setStocktakeActive(false);
  };

  const applyStocktakeToStock = (lines: StocktakeLine[]) => {
    let updatedCatalog = [...localStock];
    lines.forEach(line => {
      updatedCatalog = updatedCatalog.map(p => {
        if (p.code === line.sku) {
          const nextStock = line.countedQty;
          const status = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : 'In Stock');
          return {
            ...p,
            stock: nextStock,
            healthStatus: status as any,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return p;
      });

      const match = localStock.find(p => p.code === line.sku);
      if (match) {
        onUpdateStock(match.id, line.countedQty);
      }
    });

    saveLocalStockState(updatedCatalog);
    triggerNewActivityEvent('STOCKTAKE_SUBMITTED', "Stocktake audit post completed successfully.", 'Low');
    logGlobalBiEvent('STOCKTAKE_SUBMITTED', { linesCount: lines.length }, 'INFO');
  };


  // =========================================================================
  // ENFORCED APPROVAL ACTIONS PANEL SUB-UTILITIES
  // =========================================================================
  const handleProcessApprovalInQueue = (req: ApprovalRequest, verdict: 'Approved' | 'Rejected') => {
    // 1. Update queue status
    setStockApprovals(prev => prev.map(r => r.id === req.id ? { ...r, status: verdict } : r));

    if (verdict === 'Rejected') {
      triggerNewActivityEvent('STOCK_TRANSFERRED', `Request ${req.id} (${req.type}) REJECTED by ${simulatedRole}`, 'Low');
      return;
    }

    // 2. Apply the payload to core databases depending on type
    const payload = req.payload as any;
    
    if (req.type === 'Stock Adjustment Approval' && payload) {
      const match = localStock.find(p => p.code === payload.sku);
      if (match) {
        const nextQty = match.stock + payload.delta;
        const updated = localStock.map(p => {
          if (p.code === payload.sku) {
            const status = nextQty === 0 ? 'Out of Stock' : (nextQty <= p.minStock ? 'Low Stock' : 'In Stock');
            return {
              ...p,
              stock: nextQty,
              healthStatus: status as any,
              lastMovementDate: new Date().toISOString().substring(0, 10)
            };
          }
          return p;
        });

        saveLocalStockState(updated);
        onUpdateStock(match.id, nextQty);
        
        triggerNewActivityEvent('STOCK_RECEIVED', `APPROVAL CLEAR: Adjustment of ${payload.sku} applied to count ${nextQty}.`, 'Medium');
        logGlobalBiEvent('GOODS_RECEIVED', { sku: payload.sku, delta: payload.delta, verdict: 'APPROVED' }, 'INFO');
      }
    } 
    else if ((req.type === 'GRN Variance Approval' || req.type === 'Cost Spike Approval') && payload) {
      applyGRNToStock(payload.items, payload.grnNumber);
      triggerNewActivityEvent('GOODS_RECEIVED', `APPROVAL CLEAR: Divergent GRN ${payload.grnNumber} authorized and posted by ${simulatedRole}.`, 'High');
    }
    else if (req.type === 'Supplier Return Approval' && payload) {
      triggerNewActivityEvent('STOCK_TRANSFERRED', `APPROVAL CLEAR: Return request authorized by ${simulatedRole}.`, 'Medium');
    }
    else if (req.type === 'Stocktake Variance Approval' && payload) {
      applyStocktakeToStock(payload.lines);
      triggerNewActivityEvent('STOCKTAKE_SUBMITTED', `APPROVAL CLEAR: Stocktake count discrepancy authorized and applied to Ledger.`, 'High');
    }
  };


  return (
    <div className="space-y-6">

      {/* OPERATOR ACCESS & MOCK ROLE OVERRIDE SELECTOR - Highly Visual Enforced Check */}
      <div className="bg-[#1e222b] text-white p-3.5 border-b-4 border-b-orange-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[8.5px] text-orange-400 font-black uppercase tracking-wider block">SCI AUTHORIZATION INTEGRITY CHAMBER</span>
          <p className="text-[10px] text-slate-350 mt-0.5">Simulate role clearances globally to verify strict purchase discipline rules and gate logic.</p>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-[10px] uppercase font-black">Active Clearance:</span>
          <select
            id="mock-reviewer-role-picker"
            value={simulatedRole}
            onChange={(e) => setSimulatedRole(e.target.value as Role)}
            className="bg-slate-800 text-white font-black uppercase text-[10px] px-2 py-1 border border-slate-700 focus:border-orange-500 outline-none rounded-none cursor-pointer"
          >
            <option value="Stock Controller">Stock Controller</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Manager">Manager</option>
            <option value="Owner">Owner</option>
            <option value="SysAdmin">SysAdmin</option>
            <option value="Cashier">Cashier (Blocked)</option>
          </select>
        </div>
      </div>


      {/* TAB SUB-PAGES SWAP ROUTERS */}
      {activeTab === 'Goods Receiving' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Receiving Form */}
          <form onSubmit={handleGRNSubmit} className="lg:col-span-8 bg-white border border-[#b1b5c2] p-5 space-y-5">
            <div className="flex justify-between items-center border-b border-gray-150 pb-2.5">
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-500" />
                GOODS RECEIVED NOTE ENTRY FORM (Purchase Discipline)
              </span>
              <span className="text-[9px] font-bold font-mono text-slate-400 uppercase">SYS-REGISTRY ACTIVE</span>
            </div>

            {grnFeedback && (
              <div className={`p-3 border text-[10px] uppercase font-bold flex gap-2 items-center rounded-none ${
                grnFeedback.type === 'error' ? 'bg-red-50 text-red-800 border-red-350 animate-pulse' :
                grnFeedback.type === 'warning' ? 'bg-amber-50 text-amber-800 border-amber-350' : 'bg-emerald-50 text-emerald-800 border-emerald-350'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{grnFeedback.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">GRN Ref Number</label>
                <input
                  type="text"
                  required
                  value={grnNumber}
                  onChange={(e) => setGrnNumber(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-black text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Supplier Match</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parts Supplier Co"
                  value={grnSupplier}
                  onChange={(e) => setGrnSupplier(e.target.value)}
                  className="w-full bg-white border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-bold text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-amber-600 uppercase block">Supplier Invoice No *</label>
                <input
                  type="text"
                  required
                  placeholder="Invoice Required (*)"
                  value={grnInvoiceNo}
                  onChange={(e) => setGrnInvoiceNo(e.target.value.toUpperCase())}
                  className="w-full bg-white border-2 border-amber-500/55 px-2.5 py-1.5 uppercase font-black text-[11px] rounded-none outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Purchase Order Ref</label>
                <select
                  value={grnPoRef}
                  onChange={(e) => setGrnPoRef(e.target.value)}
                  className="w-full bg-white border border-[#b1b5c2] px-2.5 py-1.5 uppercase font-bold text-[11px] h-8 cursor-pointer rounded-none outline-none focus:border-orange-500"
                >
                  <option value="">MANUAL PROCUREMENT ENTRY</option>
                  {purchaseOrders.filter(p => p.status !== 'Closed').map(po => (
                    <option key={po.poNumber} value={po.poNumber}>{po.poNumber} ({po.supplierName})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Branch Port</label>
                <input
                  type="text"
                  readOnly
                  value={grnBranch}
                  className="w-full bg-slate-100 border border-gray-300 px-2.5 py-1.5 font-bold text-[11px] rounded-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase block">Warehouse Location</label>
                <input
                  type="text"
                  readOnly
                  value={grnWarehouse}
                  className="w-full bg-slate-100 border border-gray-300 px-2.5 py-1.5 font-bold text-[11px] rounded-none cursor-not-allowed"
                />
              </div>
            </div>

            {/* Product receiving grid */}
            <div className="space-y-2 pt-2">
              <span className="text-[9.5px] font-black uppercase text-[#1e222b] block border-b border-dashed border-gray-200 pb-1">DELIVERED PART LINES CHECK</span>
              <div className="overflow-x-auto pos-custom-scroll">
                <table className="w-full text-[10px] text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-8">
                      <th className="py-1 px-2.5">SKU</th>
                      <th className="py-1 px-2.5">Description</th>
                      <th className="py-1 px-2.5 text-right w-[65px]">Ordered</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Received</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Cost Price (USD)</th>
                      <th className="py-1 px-2.5 text-right w-[85px]">Suggested Selling</th>
                      <th className="py-1 px-2.5 text-right w-[65px]">Variance</th>
                      <th className="py-1 px-2.5 text-center">Rule Status</th>
                      <th className="py-1 px-2.5 text-center w-[120px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {grnLines.map((line) => {
                      const variance = line.receivedQty - line.orderedQty;
                      const hasVariance = variance !== 0;
                      const isCostSpike = line.status.toLowerCase().includes('spike');
                      const isSellingUnderCost = line.suggestedPrice < line.costPrice;

                      let rowBg = '';
                      if (line.rejected) rowBg = 'bg-red-50/50 line-through text-slate-400';
                      else if (isCostSpike) rowBg = 'bg-orange-50/30';
                      else if (hasVariance) rowBg = 'bg-amber-50/30';

                      return (
                        <tr key={line.sku} className={`h-11 hover:bg-slate-50/70 transition-colors ${rowBg}`}>
                          <td className="py-1 px-2.5 font-bold text-slate-800">{line.sku}</td>
                          <td className="py-1 px-2.5 max-w-[140px] truncate">
                            <span className="uppercase font-extrabold">{line.productName}</span>
                            <div className="text-[7.5px] text-slate-400">Prev Cost: USD {line.prevCostPrice.toFixed(2)}</div>
                          </td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-600">{line.orderedQty}</td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              value={line.receivedQty}
                              onChange={(e) => updateGRNLineField(line.sku, 'receivedQty', parseInt(e.target.value) || 0)}
                              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              step="0.01"
                              value={line.costPrice}
                              onChange={(e) => updateGRNLineField(line.sku, 'costPrice', parseFloat(e.target.value) || 0)}
                              className="w-full bg-white text-[#1e222b] border border-[#b1b5c2] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed"
                            />
                          </td>
                          <td className="py-1 px-2.5">
                            <input
                              type="number"
                              disabled={line.rejected || line.accepted}
                              min={0}
                              step="0.01"
                              value={line.suggestedPrice}
                              onChange={(e) => updateGRNLineField(line.sku, 'suggestedPrice', parseFloat(e.target.value) || 0)}
                              className={`w-full bg-white text-[#1e222b] text-right font-black text-xs px-1.5 py-0.5 rounded-none outline-none disabled:bg-slate-50 disabled:cursor-not-allowed border ${
                                isSellingUnderCost ? 'border-red-500 font-bold bg-red-100 text-red-900' : 'border-[#b1b5c2]'
                              }`}
                            />
                          </td>
                          <td className="py-1 px-2.5 text-right font-black font-mono">
                            <span className={variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {variance > 0 ? `+${variance}` : variance}
                            </span>
                          </td>
                          <td className="py-1 px-2.5 text-center whitespace-nowrap">
                            {line.rejected ? (
                              <span className="bg-red-500 text-white font-black text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide">REJECTED</span>
                            ) : isSellingUnderCost ? (
                              <span className="bg-red-100 text-red-800 border border-red-350 font-black text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide animate-pulse">Selling Under Cost</span>
                            ) : line.status !== 'Matched' ? (
                              <span className="bg-amber-100 text-amber-800 border border-amber-350 font-extrabold text-[7.5px] px-1 py-0.5 uppercase tracking-wide">
                                {line.status.toUpperCase()}
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[7.5px] px-1.5 py-0.5 uppercase tracking-wide">MATCHED</span>
                            )}
                          </td>
                          <td className="py-1 px-2.5">
                            <div className="flex gap-1 justify-center">
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', false);
                                  updateGRNLineField(line.sku, 'flagged', false);
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  !line.rejected && !line.flagged ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', false);
                                  updateGRNLineField(line.sku, 'flagged', true);
                                  triggerNewActivityEvent('STOCKTAKE_SUBMITTED', `Variance manually flagged on intake for line ${line.sku}`, 'Medium');
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  line.flagged ? 'border-amber-500 text-amber-700 font-bold bg-amber-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Flag
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateGRNLineField(line.sku, 'rejected', true);
                                  updateGRNLineField(line.sku, 'flagged', false);
                                  triggerNewActivityEvent('STOCK_TRANSFERRED', `Deliverable line rejected dynamically: SKU ${line.sku}`, 'High');
                                }}
                                className={`text-[8.5px] px-1.5 py-1 border hover:bg-slate-100 uppercase ${
                                  line.rejected ? 'border-red-500 text-red-650 font-bold bg-red-50' : 'border-[#b1b5c2] text-slate-500 bg-white'
                                }`}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-slate-500 uppercase block">Receiving Notes / Discrepancy Remarks</label>
              <textarea
                rows={2}
                value={grnNotes}
                onChange={(e) => setGrnNotes(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1.5 text-[10.5px] rounded-none outline-none font-sans uppercase font-bold"
                placeholder="e.g. Supplier shorted brake pads on physical count. Logged for variance tracking."
              />
            </div>

            <div className="flex justify-between items-center bg-slate-50 border-t border-gray-150 p-4">
              <div className="text-[9px] text-slate-500 font-black uppercase">
                STRICT DISCIPLINE: DELIVERIES PASS PRICE & QTY CHECKS
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10.5px] cursor-pointer rounded-none tracking-wider border border-orange-700 transition-colors"
              >
                Submit Goods Received Note
              </button>
            </div>

          </form>

          {/* Side panel with informational details */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border-2 border-[#1e222b] p-4.5 space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
                <Shield className="w-5 h-5 text-orange-500 shrink-0" />
                <span className="font-extrabold text-[10px] uppercase text-[#1e222b] tracking-wider">PURCHASE DISCIPLINE DIRECTIVES</span>
              </div>
              
              <ul className="space-y-2.5 text-[9.5px] text-slate-600 uppercase list-none pl-0">
                <li className="flex gap-2 items-start">
                  <span className="bg-orange-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 1</span>
                  <span>Invoice matching is mandatory. GRN submissions block if empty.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-orange-500 text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 2</span>
                  <span>Suggested selling price below cost price is mathematically blocked.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-[#1e222b] text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 3</span>
                  <span>Variances trigger warnings. GRN routes to Supervisor Approval.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="bg-[#1e222b] text-white font-bold text-[8px] px-1 py-0.2 shrink-0">RULE 4</span>
                  <span>Cost Spike increase &gt; 15% requires Manager validation.</span>
                </li>
              </ul>

              <div className="bg-slate-50 border border-gray-200 p-3 mt-4 text-[9px] font-mono text-slate-500 uppercase leading-snug">
                <strong>Database Sync Engine:</strong> Local browser persistent memory acts as staging store. Approval clearing triggers atomic catalog writes.
              </div>
            </div>
          </div>

        </div>
      )}


      {activeTab === 'Purchase Orders' && (
        <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-gray-150 pb-2">
            <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              Active Procurement Purchase Orders
            </span>
            <span className="text-[9px] font-bold font-mono text-slate-400">LEDGER PO STATUS</span>
          </div>

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="w-full text-[10.5px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-9 select-none">
                  <th className="py-2 px-3">PO Number</th>
                  <th className="py-2 px-3">Supplier Name</th>
                  <th className="py-2 px-3">Date Drafted</th>
                  <th className="py-2 px-3">Expected Intake</th>
                  <th className="py-2 px-3 text-right">Items Count</th>
                  <th className="py-2 px-3 text-right">Estimated Cost (USD)</th>
                  <th className="py-2 px-3 text-center">Status</th>
                  <th className="py-2 px-3 text-center">Intake Registry Dispatch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchaseOrders.map((po) => {
                  let statusBg = 'bg-gray-100 text-slate-700';
                  if (po.status === 'Open') statusBg = 'bg-sky-50 text-sky-800 border border-sky-305 font-bold';
                  else if (po.status === 'Partially Received') statusBg = 'bg-amber-50 text-amber-805 border border-amber-300 font-extrabold';
                  else if (po.status === 'Closed') statusBg = 'bg-green-50 text-green-800 border border-green-300 font-bold';
                  else if (po.status === 'Overdue') statusBg = 'bg-red-50 text-red-800 border border-red-300 font-black animate-pulse';

                  return (
                    <tr key={po.poNumber} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-black text-[#1e222b]">{po.poNumber}</td>
                      <td className="py-2 px-3 uppercase font-extrabold text-[#111827]">{po.supplierName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{po.createdDate}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{po.expectedDate}</td>
                      <td className="py-2 px-3 text-right font-bold">{po.itemsCount}</td>
                      <td className="py-2 px-3 text-right font-black font-mono">USD {po.totalCost.toFixed(2)}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 text-[8px] uppercase tracking-wide rounded-none ${statusBg}`}>
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button
                            onClick={() => setSelectedPO(po)}
                            className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#1e222b] border border-[#b1b5c2] font-bold uppercase text-[8.5px] rounded-none cursor-pointer"
                          >
                            Details
                          </button>
                          
                          {po.status !== 'Closed' && (
                            <button
                              onClick={() => handleQuickReceivePO(po)}
                              className="px-2 py-1 bg-[#f97316] hover:bg-[#ea580c] text-white font-black uppercase text-[8.5px] border border-orange-600 rounded-none cursor-pointer"
                            >
                              Receive
                            </button>
                          )}

                          {po.status !== 'Closed' && (
                            <button
                              onClick={() => handleClosePO(po.poNumber)}
                              className="px-2 py-1 bg-white hover:bg-red-50 text-red-650 border border-[#b1b5c2] uppercase font-bold text-[8.5px] rounded-none cursor-pointer"
                            >
                              Close
                            </button>
                          )}

                          {po.status === 'Open' && (
                            <button
                              onClick={() => handleFlagPOOverdue(po.poNumber)}
                              className="px-2 py-1 bg-white text-rose-650 hover:bg-rose-50 border border-red-200 uppercase font-black text-[8.5px] rounded-none cursor-pointer animate-pulse"
                              title="Flag Intake Delayed"
                            >
                              Flag Delay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {activeTab === 'Supplier Returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Create Supplier Return Form */}
          <form onSubmit={handleSupplierReturnSubmit} className="lg:col-span-4 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <ArrowRightLeft className="w-4 h-4 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase text-[#1e222b] tracking-widest">SUBMIT SUPPLIER RETURN</span>
            </div>

            {retFeedback && (
              <div className="p-2.5 bg-sky-50 text-sky-900 border border-sky-200 font-bold uppercase text-[9.5px] rounded-none">
                {retFeedback}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Supplier Name</label>
              <select
                value={retSupplier}
                onChange={(e) => setRetSupplier(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="ABC Motor Spares Supplier">ABC Motor Spares Supplier</option>
                <option value="Harare Lubricants Ltd">Harare Lubricants Ltd</option>
                <option value="Toyota Parts Wholesale">Toyota Parts Wholesale</option>
                <option value="Apex Gaskets Co.">Apex Gaskets Co.</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Original GRN Ref</label>
              <input
                type="text"
                required
                placeholder="e.g. GRN-2026-904"
                value={retGrn}
                onChange={(e) => setGrnPoRef(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 font-bold uppercase text-[10.5px] rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Material SKU</label>
              <select
                value={retSku}
                onChange={(e) => setRetSku(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                {localStock.map(p => (
                  <option key={p.id} value={p.code}>[{p.code}] {p.name} (Hold: {p.stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Quantity to Return</label>
              <input
                type="number"
                min={1}
                required
                value={retQty}
                onChange={(e) => setRetQty(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1 text-right font-black text-[11px] rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Reason of Return</label>
              <select
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Wrong item supplied">Wrong item supplied</option>
                <option value="Damaged item">Damaged item</option>
                <option value="Short expiry">Short expiry</option>
                <option value="Warranty claim">Warranty claim</option>
                <option value="Over supplied">Over supplied</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Condition Check</label>
              <select
                value={retCondition}
                onChange={(e) => setRetCondition(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Resellable">Resellable</option>
                <option value="Damaged">Damaged/Leaking</option>
                <option value="Repair needed">Repair required</option>
                <option value="Scrap">Scrap Metal</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 border border-orange-700 text-white font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer rounded-none"
            >
              Post Supplier Return
            </button>
          </form>

          {/* Supplier Returns List Table */}
          <div className="lg:col-span-8 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-150 pb-2">
              <span className="font-extrabold text-[#111827] text-[11px] uppercase">REGISTRY: SUPPLIER RETURNS DISPATCH LEDGER</span>
              <span className="text-[8.5px] font-black bg-amber-500/10 text-[#f97316] border border-[#f97316]/20 px-2 py-0.2">STAGE RECORD</span>
            </div>

            <div className="overflow-x-auto pos-custom-scroll">
              <table className="w-full text-[10px] text-left border-collapse min-w-[550px]">
                <thead>
                  <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-8 select-none">
                    <th className="py-1 px-2.5">Return ID</th>
                    <th className="py-1 px-2.5">Supplier</th>
                    <th className="py-1 px-2.5">Original GRN</th>
                    <th className="py-1 px-2.5">SKU / Item</th>
                    <th className="py-1 px-2.5 text-right">Qty</th>
                    <th className="py-1 px-2.5">Reason</th>
                    <th className="py-1 px-2.5 text-center">Dispatch Status</th>
                    <th className="py-1 px-2.5 text-center w-[150px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {supplierReturns.map((ret) => {
                    let badgeBg = 'bg-gray-100 text-slate-700';
                    if (ret.status === 'Draft') badgeBg = 'bg-yellow-50 text-amber-800 border border-amber-250 font-bold';
                    else if (ret.status === 'Shipped') badgeBg = 'bg-sky-50 text-indigo-805 border border-indigo-250 font-extrabold';
                    else if (ret.status === 'Credited') badgeBg = 'bg-emerald-50 text-green-800 border border-emerald-300 font-bold';

                    return (
                      <tr key={ret.id} className="hover:bg-slate-50 transition-colors h-11">
                        <td className="py-2 px-2.5 font-bold text-slate-800">{ret.id}</td>
                        <td className="py-2 px-2.5 uppercase font-bold text-slate-700">{ret.supplierName}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-500">{ret.originalGrn}</td>
                        <td className="py-2 px-2.5">
                          <span className="font-bold text-[#1e222b]">{ret.sku}</span>
                          <span className="text-[8px] text-slate-400 block truncate max-w-[120px] uppercase">{ret.productName}</span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-black font-mono text-slate-800">{ret.quantityReturned}</td>
                        <td className="py-2 px-2.5 uppercase text-[8.5px] text-slate-500">{ret.reason} / {ret.condition}</td>
                        <td className="py-2 px-2.5 text-center whitespace-nowrap">
                          <span className={`inline-block px-1.5 py-0.2 text-[8px] uppercase tracking-wide rounded-none ${badgeBg}`}>
                            {ret.status}
                          </span>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="flex justify-center gap-1">
                            {ret.status === 'Draft' && (
                              <button
                                onClick={() => handleShipAndDeductStock(ret)}
                                className="px-2 py-0.5 bg-[#f97316] hover:bg-[#ea580c] border border-orange-600 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                title="Ship from warehouse and deduct stock"
                              >
                                Ship Out
                              </button>
                            )}

                            {ret.status === 'Shipped' && (
                              <button
                                onClick={() => handleCompleteCredit(ret.id)}
                                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white font-black uppercase text-[8px] rounded-none cursor-pointer"
                                title="Acknowledge supplier credit note received"
                              >
                                Clear Credit
                              </button>
                            )}
                            
                            <span className="text-slate-400 text-[8px] font-mono select-none">ID: {ret.requestedBy}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}


      {activeTab === 'Stock Adjustments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main adjustment request form */}
          <form onSubmit={handleAdjustmentSubmit} className="lg:col-span-5 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <Sliders className="w-5 h-5 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase text-[#1e222b] tracking-wider">STOCK QUANTITY CORRECTION GATE</span>
            </div>

            {adjFeedback && (
              <div className={`p-3 border text-[10px] uppercase font-bold flex gap-2 items-center rounded-none ${
                adjFeedback.type === 'error' ? 'bg-red-50 text-red-800 border-red-350' :
                adjFeedback.type === 'warning' ? 'bg-amber-50 text-amber-805 border-amber-350' : 'bg-emerald-50 text-emerald-800 border-emerald-350'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjFeedback.msg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Target Catalog SKU</label>
              <select
                value={adjSku}
                onChange={(e) => setAdjSku(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                {localStock.map(p => (
                  <option key={p.id} value={p.code}>[{p.code}] {p.name} (Hold: {p.stock} {p.unit})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Quantities Operational Vector</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjType('ADD')}
                  className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1 cursor-pointer ${
                    adjType === 'ADD'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-500 font-extrabold'
                      : 'bg-white text-slate-500 border-[#b1b5c2]'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add (+) Assets
                </button>
                <button
                  type="button"
                  onClick={() => setAdjType('DEDUCT')}
                  className={`p-2 font-black uppercase text-[10px] border transition-colors rounded-none flex items-center justify-center gap-1 cursor-pointer ${
                    adjType === 'DEDUCT'
                      ? 'bg-rose-50 text-red-800 border-red-500 font-extrabold'
                      : 'bg-white text-slate-500 border-[#b1b5c2]'
                  }`}
                >
                  <Minus className="w-3.5 h-3.5" />
                  Deduct (-) Shrinkage
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Adjustment Delta Count</label>
              <input
                type="number"
                min={1}
                required
                placeholder="e.g. 5"
                value={adjCountQty}
                onChange={(e) => setAdjCountQty(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2.5 py-1 text-right font-black text-sm rounded-none outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Authorization Reasons Dropdown</label>
              <select
                value={adjReasonCode}
                onChange={(e) => setAdjReasonCode(e.target.value)}
                className="w-full bg-white text-slate-800 border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10.5px] font-bold rounded-none cursor-pointer outline-none"
              >
                <option value="Stocktake variance">Stocktake variance delta</option>
                <option value="Damaged stock">Damaged / Obsolete material</option>
                <option value="Lost stock">Lost / Missing stock</option>
                <option value="Found stock">Found surplus stock</option>
                <option value="Data correction">Clerical data correction</option>
                <option value="Supplier issue">Supplier discrepancy on dock</option>
                <option value="Theft suspicion">Theft suspicion (High Risk Event)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[8.5px] uppercase font-black text-slate-550 block">Explanation / Notes</label>
              <textarea
                rows={2}
                value={adjNotes}
                onChange={(e) => setAdjNotes(e.target.value)}
                className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 px-2 py-1.5 text-[10px] font-bold uppercase rounded-none resize-none outline-none"
                placeholder="Required explanations..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#f97316] hover:bg-[#ea580c] text-white border border-orange-600 font-black uppercase text-[10px] tracking-wider transition-colors cursor-pointer rounded-none"
            >
              Commit Stock Adjustment
            </button>
          </form>

          {/* Guidelines info */}
          <div className="lg:col-span-7 bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-150 pb-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <span className="font-extrabold text-[10.5px] uppercase">ADJUSTMENT AUTHORISATION LIMIT MATRICES</span>
            </div>
            
            <div className="space-y-4 text-[10px] text-zinc-600 uppercase">
              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">CASHIER ROLES (Blocked)</span>
                <span>Cannot execute or propose any physical adjustments. Prohibited action.</span>
              </div>
              
              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">STOCK CONTROLLER Clearance (Restricted)</span>
                <span>Fills the adjustment form, but submissions are automatically held in pending stage queue for Supervisor/Manager approval. Stock levels do not alter.</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">SUPERVISOR Clearance (Tiered Cap)</span>
                <span>Can post positive counts and negative counts CAP-LIMITED to 3 units. Deductions &gt; 3 units automatically elevate to Manager clearance level.</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-205">
                <span className="font-black text-slate-800 text-[10px] block mb-1">MANAGERS / OWNERS (Full)</span>
                <span>Complete administrative clearance. Bypasses queues; registers directly to stock.</span>
              </div>
            </div>
          </div>

        </div>
      )}


      {activeTab === 'Stocktake' && (
        <div className="bg-white border border-[#b1b5c2] p-5 space-y-5">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-150 pb-3">
            <div>
              <span className="font-extrabold text-[#111827] text-[11px] uppercase flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-orange-500" />
                Physical Stocktake Spot Check Audits
              </span>
              <p className="text-[9.5px] text-slate-400 mt-0.5 uppercase">Review counted quantities against system balances to sync the general ledger.</p>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleStartStocktakeSession}
                className={`px-3 py-1.5 font-bold uppercase text-[9.5px] border cursor-pointer rounded-none transition-colors ${
                  stocktakeActive ? 'bg-orange-50 text-orange-600 border-orange-500' : 'bg-white text-slate-700 border-[#b1b5c2] hover:bg-slate-50'
                }`}
              >
                {stocktakeActive ? '● Audit Live' : 'Open Spot Session'}
              </button>
              <button
                onClick={handleRandomSpotCheck}
                className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#b1b5c2] font-semibold uppercase text-[9.5px] rounded-none cursor-pointer"
              >
                Simulate Counts
              </button>
              <button
                onClick={handleRecommendMajorAudit}
                className="px-3 py-1.5 bg-white text-orange-600 hover:bg-orange-50 border border-orange-200 font-extrabold uppercase text-[9.5px] rounded-none cursor-pointer"
              >
                Recommend Full Audit
              </button>
            </div>
          </div>

          {stocktakeFeedback && (
            <div className="p-3 bg-amber-500/10 border-l-4 border-l-orange-500 border border-[#b1b5c2] uppercase font-black text-[9.5px] text-slate-800">
              {stocktakeFeedback}
            </div>
          )}

          <div className="overflow-x-auto pos-custom-scroll">
            <table className="w-full text-[10.5px] text-left border-collapse">
              <thead>
                <tr className="bg-[#1e222b] text-white font-black uppercase text-[8px] h-8 select-none">
                  <th className="py-2 px-3">SKU</th>
                  <th className="py-2 px-3">Part Description</th>
                  <th className="py-2 px-3 text-right">System Recorded</th>
                  <th className="py-2 px-3 text-right w-[140px]">Observed Physical Count</th>
                  <th className="py-2 px-3 text-right">Delta (Variance)</th>
                  <th className="py-2 px-3 text-center">Calculated Risk</th>
                  <th className="py-2 px-3 text-center">Line Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stocktakeLines.map((line) => {
                  let riskBg = 'bg-gray-100 text-slate-600';
                  if (line.riskLevel === 'High') riskBg = 'bg-orange-100 text-orange-800 font-bold border border-orange-250';
                  else if (line.riskLevel === 'Critical') riskBg = 'bg-red-100 text-red-800 font-black border border-red-300 animate-pulse';

                  return (
                    <tr key={line.sku} className="hover:bg-slate-50 transition-colors h-11">
                      <td className="py-2 px-3 font-bold text-[#1e222b]">{line.sku}</td>
                      <td className="py-2 px-3 uppercase font-extrabold">{line.productName}</td>
                      <td className="py-2 px-3 text-right font-bold text-slate-600">{line.systemQty}</td>
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          disabled={!stocktakeActive}
                          min={0}
                          value={line.countedQty}
                          onChange={(e) => handleSpotStocktakeLineChange(line.sku, e.target.value)}
                          className="w-full bg-white disabled:bg-slate-50 border border-[#b1b5c2] text-right font-black text-xs px-2 py-0.5 rounded-none outline-none focus:border-orange-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-black font-mono">
                        <span className={line.variance === 0 ? 'text-slate-400' : line.variance > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {line.variance > 0 ? `+${line.variance}` : line.variance}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap text-[9px]">
                        <span className={`inline-block px-1.5 py-0.2 uppercase tracking-wide rounded-none ${riskBg}`}>
                          {line.riskLevel}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        {line.variance !== 0 ? (
                          <span className="bg-red-50 text-red-800 border-red-200 font-bold text-[8px] px-1.5 py-0.2 uppercase">Discrepancy</span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-800 border-emerald-200 font-medium text-[8px] px-1.5 py-0.2 uppercase">Matched</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-gray-150">
            <span className="text-[9px] text-slate-400 uppercase font-bold">Physical Audit verification dispatch rules apply.</span>
            <button
              onClick={handlePostStocktakeResults}
              disabled={!stocktakeActive}
              className="px-6 py-2.5 bg-orange-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-300 hover:bg-orange-700 text-white font-black uppercase text-[10.5px] border border-orange-700 rounded-none cursor-pointer"
            >
              Post Count Ledger Dispatches
            </button>
          </div>

        </div>
      )}


      {/* ========================================================================= */}
      {/* 🛡️ CENTRALIZED STOCK CONTROL APPROVALS DEFLATOR QUEUE */}
      {/* ========================================================================= */}
      <div className="bg-white border text-xs border-[#b1b5c2]">
        
        {/* Header bar banner */}
        <div className="bg-[#1e222b] text-white p-3.5 flex justify-between items-center border-b-2 border-slate-900 select-none">
          <span className="font-extrabold text-[10.5px] uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-500" />
            STOCK OPERATIONS SECURITY AUTHORISATION QUEUE
          </span>
          <span className="text-[8px] bg-red-500 text-white font-black px-2 py-0.5 uppercase tracking-wide animate-pulse">
            {stockApprovals.filter(r => r.status === 'Pending').length} Pending review
          </span>
        </div>

        {/* List content queue */}
        <div className="p-4 space-y-3.5">
          {stockApprovals.length === 0 ? (
            <div className="py-6 text-center text-slate-400 font-bold uppercase bg-slate-50/50 border border-dashed border-gray-200">
              No pending stock control operational approvals detected. System statuses high integrity.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {stockApprovals.map((req) => {
                let statusBg = 'bg-yellow-50 text-yellow-805 border-yellow-250';
                if (req.status === 'Approved') statusBg = 'bg-green-50 text-green-800 border-green-300';
                else if (req.status === 'Rejected') statusBg = 'bg-red-50 text-red-800 border-red-350';

                const isPermitted = canApprove(req.type, simulatedRole);

                return (
                  <div 
                    key={req.id} 
                    className={`border p-3.5 space-y-3 bg-slate-50 hover:border-orange-500 transition-colors rounded-none ${
                      req.status === 'Pending' ? 'border-amber-400 bg-amber-500/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center border-b border-dashed border-slate-200 pb-1.5">
                      <span className="font-black text-orange-600 text-[9.5px] uppercase">{req.type}</span>
                      <span className="text-slate-400 font-mono text-[8px]">{req.createdAt ? new Date(req.createdAt).toLocaleTimeString() : 'N/A'}</span>
                    </div>

                    <p className="text-[#111827] font-sans font-bold uppercase text-[9.5px] leading-snug">
                      {req.notes}
                    </p>

                    <div className="text-[8.5px] text-slate-500 space-y-0.5 font-mono">
                      <div><strong>REQUESTED BY:</strong> {req.requestedBy}</div>
                      <div><strong>REQUEST ID:</strong> {req.id}</div>
                    </div>

                    <div className="flex justify-between items-center pt-2.5 border-t border-gray-150">
                      <span className={`inline-block border px-1.5 py-0.2 text-[8px] uppercase tracking-wide rounded-none font-bold ${statusBg}`}>
                        {req.status}
                      </span>

                      {req.status === 'Pending' && (
                        <div className="flex gap-1.5">
                          {isPermitted ? (
                            <>
                              <button
                                onClick={() => handleProcessApprovalInQueue(req, 'Approved')}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white border border-green-700 font-black uppercase text-[8px] rounded-none cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleProcessApprovalInQueue(req, 'Rejected')}
                                className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-750 font-black uppercase text-[8px] rounded-none cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span 
                              className="text-red-500 font-black text-[7.5px] flex items-center gap-1 uppercase select-none"
                              title="Active simulated role has insufficient access keys to resolve this queue item."
                            >
                              <Shield className="w-3 h-3 text-red-500 animate-pulse" />
                              Role Locked
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>


      {/* VIEW DRILLDOWN MODAL FOR PURCHASE ORDER */}
      {selectedPO && (
        <div className="fixed inset-0 bg-slate-950/70 z-[950] flex items-center justify-center p-4">
          <div className="w-full max-w-[500px] bg-white border-2 border-[#1e222b] shadow-2xl flex flex-col justify-between text-xs tracking-wide rounded-none">
            
            <div className="h-10.5 bg-[#1e222b] text-white px-4 flex items-center justify-between border-b-2 border-orange-500">
              <span className="font-black text-[10.5px] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-orange-500" />
                PO Audit Details: {selectedPO.poNumber}
              </span>
              <button 
                type="button" 
                onClick={() => setSelectedPO(null)} 
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 font-mono">
                <div><strong>SUPPLIER:</strong> <span className="text-[#1e222b] font-bold">{selectedPO.supplierName}</span></div>
                <div><strong>CREATED AT:</strong> <span>{selectedPO.createdDate}</span></div>
                <div><strong>EXPECTED DELIV:</strong> <span>{selectedPO.expectedDate}</span></div>
                <div><strong>EST TOTAL BASIS:</strong> <span className="text-[#1e222b] font-bold">USD {selectedPO.totalCost.toFixed(2)}</span></div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[8px] text-slate-400 uppercase font-black block">Line Items (Ordered)</span>
                <div className="border border-gray-200">
                  <table className="w-full text-[9.5px] text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1e222b] text-white font-bold uppercase text-[7px] h-7">
                        <th className="py-1 px-2.5">SKU</th>
                        <th className="py-1 px-2.5">Part Description</th>
                        <th className="py-1 px-2.5 text-right">Qty</th>
                        <th className="py-1 px-2.5 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {selectedPO.items.map((item, i) => (
                        <tr key={i} className="h-8 hover:bg-slate-50">
                          <td className="py-1 px-2.5 font-bold">{item.sku}</td>
                          <td className="py-1 px-2.5 text-slate-650 uppercase truncate max-w-[150px]">{item.productName}</td>
                          <td className="py-1 px-2.5 text-right font-bold text-slate-700">{item.quantity}</td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold">USD {item.cost.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border-t border-gray-150 p-4 shrink-0 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setSelectedPO(null)}
                className="px-4 py-1.5 border border-[#b1b5c2] hover:bg-slate-100 text-slate-800 font-bold uppercase text-[9.5px] cursor-pointer rounded-none"
              >
                Close View
              </button>
              {selectedPO.status !== 'Closed' && (
                <button
                  type="button"
                  onClick={() => {
                    handleQuickReceivePO(selectedPO);
                    setSelectedPO(null);
                  }}
                  className="px-4 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white border border-orange-600 font-black uppercase text-[9.5px] cursor-pointer rounded-none"
                >
                  Receive Parts
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
