import { db, firebaseReady } from '../pos-new/firebase/firebaseApp';
import { collection, getDocs } from 'firebase/firestore';
import { mockRecentSales, mockProducts, mockStockAdjustments, mockDeliveryOrders, mockBIEvents, mockBranches } from '../pos-new/mock/mockPosData';
import { Sale, Product, StockAdjustment, DeliveryRequest, BiEvent, Branch } from '../pos-new/types';

export interface BIFilterState {
  branchId?: string;
  startDate?: string;
  endDate?: string;
  staffId?: string;
  productId?: string;
}

export interface BIDrillDownLog {
  id: string;
  timestamp: string;
  description: string;
  operator?: string;
  branchName?: string;
  terminal?: string;
  productName?: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface BIDashboardMetrics {
  stockRiskScore: number;
  cashierRiskScore: number;
  theftVarianceAlerts: number;
  lowStockAlerts: number;
  deadStockWarnings: number;
  fastMovingStock: number;
  suspiciousDiscountsCount: number;
  deliveryCompletionScore: number;
  cashReceivedConfirmationStatus: {
    status: 'All Confirmed' | 'Pending Confirmations' | 'Missing Handover';
    missingCount: number;
  };
  branchPerformance: {
    branchId: string;
    branchName: string;
    salesCount: number;
    totalSales: number;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
  drillDowns: Record<string, {
    reason: string;
    recommendedAction: string;
    logs: BIDrillDownLog[];
  }>;
}

// Helpers to load data with LocalStorage and mock fallbacks
function loadLocalData<T>(key: string, fallback: T[]): T[] {
  if (typeof localStorage === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

async function fetchFirestoreCollection<T>(vendorId: string, collectionName: string): Promise<T[]> {
  if (!firebaseReady || !db) return [];
  try {
    const colRef = collection(db, 'vendors', vendorId, collectionName);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as T);
  } catch (error) {
    console.warn(`Firestore read failed for ${collectionName}, using local fallback.`, error);
    return [];
  }
}

export const biService = {
  getBIDashboardMetrics: async (
    vendorId: string,
    activeBranchId?: string,
    filters: BIFilterState = {}
  ): Promise<BIDashboardMetrics> => {
    // 1. Fetch data sources from Firestore or local state
    let sales: Sale[] = [];
    let products: Product[] = [];
    let adjustments: StockAdjustment[] = [];
    let deliveries: DeliveryRequest[] = [];
    let biEvents: BiEvent[] = [];
    let branches: Branch[] = [];

    if (firebaseReady) {
      sales = await fetchFirestoreCollection<Sale>(vendorId, 'salesReceipts');
      products = await fetchFirestoreCollection<Product>(vendorId, 'productMaster');
      adjustments = await fetchFirestoreCollection<StockAdjustment>(vendorId, 'stockAdjustments');
      deliveries = await fetchFirestoreCollection<DeliveryRequest>(vendorId, 'deliveryRequests');
      biEvents = await fetchFirestoreCollection<BiEvent>(vendorId, 'biEvents');
      branches = await fetchFirestoreCollection<Branch>(vendorId, 'branches');
    }

    // Fallback to local storage if empty or Firestore not ready
    if (sales.length === 0) sales = loadLocalData<Sale>('itred_pos_transactions', mockRecentSales);
    if (products.length === 0) products = loadLocalData<Product>('itred_pos_products', mockProducts);
    if (adjustments.length === 0) adjustments = loadLocalData<StockAdjustment>('sci_pos_stock_adjustments', mockStockAdjustments);
    if (deliveries.length === 0) deliveries = loadLocalData<DeliveryRequest>('itred_pos_delivery_requests', mockDeliveryOrders as unknown as DeliveryRequest[]);
    if (biEvents.length === 0) biEvents = loadLocalData<BiEvent>('itred_pos_bi_events', mockBIEvents);
    if (branches.length === 0) branches = loadLocalData<Branch>('itred_pos_branches', mockBranches);

    // Apply active menu / user filters
    const finalBranchId = filters.branchId || activeBranchId;
    
    const filterRecord = <T extends { branch?: string; branchId?: string; date?: string; requestedAt?: string; timestamp?: string; operator?: string; staffId?: string; cashierStaffId?: string }>(row: T): boolean => {
      // Branch filter
      if (finalBranchId) {
        const rowBranch = row.branch || row.branchId;
        if (rowBranch && rowBranch !== finalBranchId) return false;
      }
      // Date filter
      const rowDate = row.date || row.requestedAt || row.timestamp || '';
      if (filters.startDate && rowDate && new Date(rowDate) < new Date(filters.startDate)) return false;
      if (filters.endDate && rowDate && new Date(rowDate) > new Date(filters.endDate)) return false;
      // Cashier/Staff filter
      if (filters.staffId) {
        const rowStaff = row.operator || row.staffId || row.cashierStaffId;
        if (rowStaff && rowStaff !== filters.staffId) return false;
      }
      return true;
    };

    const filteredProducts = products.filter(p => {
      if (filters.productId && p.id !== filters.productId) return false;
      return true;
    });

    const filteredSales = sales.filter(filterRecord);
    const filteredAdjustments = adjustments.filter(filterRecord);
    const filteredDeliveries = deliveries.filter(filterRecord);
    const filteredBiEvents = biEvents.filter(filterRecord);

    // 2. Initialize Drilldown details
    const drillDowns: BIDashboardMetrics['drillDowns'] = {
      stockRisk: { reason: 'No risk issues detected.', recommendedAction: 'Continue standard monitoring.', logs: [] },
      cashierRisk: { reason: 'No risk issues detected.', recommendedAction: 'Continue standard monitoring.', logs: [] },
      theftAlerts: { reason: 'No alerts detected.', recommendedAction: 'Continue standard monitoring.', logs: [] },
      lowStock: { reason: 'No low stock detected.', recommendedAction: 'Reorder rules satisfied.', logs: [] },
      deadStock: { reason: 'No dead stock detected.', recommendedAction: 'Clean inventory rotation.', logs: [] },
      fastMoving: { reason: 'No fast moving stock registered.', recommendedAction: 'Check sales catalog frequencies.', logs: [] },
      suspiciousDiscounts: { reason: 'No suspicious transactions.', recommendedAction: 'Standard margins preserved.', logs: [] },
      deliveryScore: { reason: 'Outstanding fulfilment rate.', recommendedAction: 'Maintain current dispatch routes.', logs: [] },
      cashConfirmation: { reason: 'All delivery cash fully reconciled.', recommendedAction: 'None.', logs: [] },
    };

    // 3. Compute Deterministic Rules & Metrics

    // --- Rule: Stock Risk Score ---
    let stockRiskScore = 0;
    const stockRiskLogs: BIDrillDownLog[] = [];
    const stockReasons: string[] = [];

    // Negative stock check
    const negativeStockCount = filteredProducts.filter(p => ((p.availableStock ?? p.stock) || 0) < 0).length;
    if (negativeStockCount > 0) {
      stockRiskScore += negativeStockCount * 15;
      stockReasons.push(`${negativeStockCount} product(s) have negative stock balances.`);
      filteredProducts.filter(p => ((p.availableStock ?? p.stock) || 0) < 0).forEach(p => {
        stockRiskLogs.push({
          id: `STOCK-NEG-${p.id}`,
          timestamp: p.lastMovementDate || new Date().toISOString(),
          description: `Product ${p.productName || p.name} (${p.sku || p.code}) stock balance is negative: ${p.availableStock ?? p.stock}`,
          productName: p.productName || p.name,
          severity: 'High'
        });
      });
    }

    // Unapproved stock adjustments
    const unapprovedAdjustments = filteredAdjustments.filter(a => a.status !== 'Approved');
    if (unapprovedAdjustments.length > 0) {
      stockRiskScore += unapprovedAdjustments.length * 20;
      stockReasons.push(`${unapprovedAdjustments.length} adjustment request(s) pending supervisor approvals.`);
      unapprovedAdjustments.forEach(a => {
        stockRiskLogs.push({
          id: a.adjustmentId,
          timestamp: a.adjustmentDate || a.createdAt,
          description: `Unapproved adjustment #${a.adjustmentNumber} (${a.reason}) requested by ${a.requestedByStaffName}`,
          operator: a.requestedByStaffName,
          severity: 'Medium'
        });
      });
    }

    stockRiskScore = Math.min(100, stockRiskScore);
    drillDowns.stockRisk = {
      reason: stockReasons.join(' ') || 'Stock balances match expected theoretical quantities. No unapproved stock adjustments.',
      recommendedAction: stockRiskScore > 0 ? 'Supervisor must review pending stock adjustments and run a stocktake recount on negative items.' : 'Maintain current control procedures.',
      logs: stockRiskLogs
    };


    // --- Rule: Cashier Risk Score ---
    let cashierRiskScore = 0;
    const cashierRiskLogs: BIDrillDownLog[] = [];
    const cashierReasons: string[] = [];

    // Calculate per-cashier refund/void counts
    const staffStats: Record<string, { refunds: number; voids: number; highDiscounts: number; totalSales: number }> = {};
    
    filteredSales.forEach(sale => {
      const op = sale.operator || 'Unknown';
      if (!staffStats[op]) {
        staffStats[op] = { refunds: 0, voids: 0, highDiscounts: 0, totalSales: 0 };
      }
      
      staffStats[op].totalSales++;

      if (sale.status === 'REFUNDED' || sale.status === 'RETURNED') {
        staffStats[op].refunds++;
      }
      if (sale.status === 'VOIDED') {
        staffStats[op].voids++;
      }
      // Discount above configured threshold (15%)
      const discountPercentage = sale.total > 0 ? (sale.discount / (sale.total + sale.discount)) * 100 : 0;
      if (discountPercentage > 15) {
        staffStats[op].highDiscounts++;
      }
    });

    Object.entries(staffStats).forEach(([staff, stats]) => {
      if (stats.refunds > 2) {
        cashierRiskScore += 25;
        cashierReasons.push(`Cashier ${staff} has processed high refund volume (${stats.refunds} refunds).`);
        cashierRiskLogs.push({
          id: `CASHIER-REF-${staff}`,
          timestamp: new Date().toISOString(),
          description: `Cashier ${staff} refund count (${stats.refunds}) is above threshold of 2.`,
          operator: staff,
          severity: 'High'
        });
      }
      if (stats.voids > 1) {
        cashierRiskScore += 20;
        cashierReasons.push(`Cashier ${staff} has performed repeated void overrides (${stats.voids} voids).`);
        cashierRiskLogs.push({
          id: `CASHIER-VOID-${staff}`,
          timestamp: new Date().toISOString(),
          description: `Cashier ${staff} performed ${stats.voids} void actions.`,
          operator: staff,
          severity: 'Medium'
        });
      }
      if (stats.highDiscounts > 0) {
        cashierRiskScore += stats.highDiscounts * 10;
        cashierReasons.push(`Cashier ${staff} has applied discounts exceeding 15% threshold (${stats.highDiscounts} times).`);
        cashierRiskLogs.push({
          id: `CASHIER-DISC-${staff}`,
          timestamp: new Date().toISOString(),
          description: `Cashier ${staff} applied custom discount above 15% threshold on ${stats.highDiscounts} receipt(s).`,
          operator: staff,
          severity: 'Medium'
        });
      }
    });

    cashierRiskScore = Math.min(100, cashierRiskScore);
    drillDowns.cashierRisk = {
      reason: cashierReasons.join(' ') || 'Standard refund, void, and discount distributions observed across all cashiers.',
      recommendedAction: cashierRiskScore > 0 ? 'Supervisor review cashier override permissions and pull activity shift audit tapes.' : 'None.',
      logs: cashierRiskLogs
    };


    // --- Rule: Theft/Variance Alerts Count ---
    const theftLogs: BIDrillDownLog[] = [];
    // Alerts are derived from biEvents, auditEvents, and adjustments
    let theftVarianceAlerts = 0;

    filteredBiEvents.forEach(e => {
      const isVariance = e.eventType.includes('VARIANCE') || e.eventType.includes('THEFT') || e.eventType.includes('SUSPICIOUS');
      if (isVariance) {
        theftVarianceAlerts++;
        theftLogs.push({
          id: e.id || `EV-${Math.random()}`,
          timestamp: e.timestamp || new Date().toISOString(),
          description: (e.payload?.details || e.payload?.message || `Theft/Variance trigger logged: ${e.eventType}`) as string,
          operator: e.operator,
          severity: 'Critical'
        });
      }
    });

    drillDowns.theftAlerts = {
      reason: theftVarianceAlerts > 0 ? `Detected ${theftVarianceAlerts} repeated variance or drawer anomalies.` : 'No critical cash variances or suspicious drawer signals recorded.',
      recommendedAction: theftVarianceAlerts > 0 ? 'Conduct immediate cash drawer recount and check local surveillance logs.' : 'Ensure regular daily reconciliations.',
      logs: theftLogs
    };


    // --- Rule: Low Stock Alerts ---
    const lowStockItems = filteredProducts.filter(p => ((p.availableStock ?? p.stock) || 0) <= (p.minStock || 0) && ((p.availableStock ?? p.stock) || 0) > 0);
    const lowStockLogs: BIDrillDownLog[] = lowStockItems.map(p => ({
      id: `LOW-${p.id}`,
      timestamp: p.lastMovementDate || new Date().toISOString(),
      description: `Product ${p.productName || p.name} (${p.sku || p.code}) is below minimum level. On Hand: ${p.availableStock ?? p.stock}, Minimum: ${p.minStock}`,
      productName: p.productName || p.name,
      severity: 'Medium'
    }));

    drillDowns.lowStock = {
      reason: lowStockItems.length > 0 ? `${lowStockItems.length} products have fallen below configured minimum safety stock levels.` : 'All product lines are above safety reorder stock indexes.',
      recommendedAction: lowStockItems.length > 0 ? 'Initiate purchase requisition orders for replenishment.' : 'No immediate reorder necessary.',
      logs: lowStockLogs
    };


    // --- Rule: Dead Stock Warnings ---
    // Dead stock is defined by no movement in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deadStockItems = filteredProducts.filter(p => {
      const movementDate = p.lastMovementDate ? new Date(p.lastMovementDate) : null;
      // If never moved, or last movement is older than 30 days, it is dead stock
      return ((p.availableStock ?? p.stock) || 0) > 0 && (!movementDate || movementDate < thirtyDaysAgo);
    });

    const deadStockLogs: BIDrillDownLog[] = deadStockItems.map(p => ({
      id: `DEAD-${p.id}`,
      timestamp: p.lastMovementDate || 'Never Moved',
      description: `Product ${p.productName || p.name} has zero movements in the last 30 days. Stock: ${p.availableStock ?? p.stock}`,
      productName: p.productName || p.name,
      severity: 'Low'
    }));

    drillDowns.deadStock = {
      reason: deadStockItems.length > 0 ? `${deadStockItems.length} stock item(s) showing zero sales movements for over 30 days.` : 'Good inventory turnover rate. No stale stock detected.',
      recommendedAction: deadStockItems.length > 0 ? 'Review pricing discounts or prepare clear-out promotional campaigns.' : 'Continue inventory rotation.',
      logs: deadStockLogs
    };


    // --- Rule: Fast Moving Stock ---
    // Identifies products sold frequently (e.g., > 3 times in transactions log)
    const productFrequency: Record<string, { name: string; count: number; lastSold: string }> = {};
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productFrequency[item.productId]) {
          productFrequency[item.productId] = { name: item.name, count: 0, lastSold: sale.date };
        }
        productFrequency[item.productId].count += item.quantity;
        if (new Date(sale.date) > new Date(productFrequency[item.productId].lastSold)) {
          productFrequency[item.productId].lastSold = sale.date;
        }
      });
    });

    const fastMovingItems = Object.entries(productFrequency)
      .filter(([_, stats]) => stats.count >= 3)
      .map(([id, stats]) => ({ id, ...stats }));

    const fastMovingLogs: BIDrillDownLog[] = fastMovingItems.map(item => ({
      id: `FAST-${item.id}`,
      timestamp: item.lastSold,
      description: `Product ${item.name} is fast moving with ${item.count} units sold recently.`,
      productName: item.name,
      severity: 'Low'
    }));

    drillDowns.fastMoving = {
      reason: fastMovingItems.length > 0 ? `${fastMovingItems.length} high-velocity stock line(s) identified by transaction frequency.` : 'No specific product lines met the fast-moving sales frequency threshold.',
      recommendedAction: 'Adjust reorder rules to increase safety stocks on these high-velocity product lines.',
      logs: fastMovingLogs
    };


    // --- Rule: Suspicious Discounts/Voids/Refunds ---
    const suspiciousLogs: BIDrillDownLog[] = [];
    let suspiciousDiscountsCount = 0;

    filteredSales.forEach(sale => {
      const discountPercentage = sale.total > 0 ? (sale.discount / (sale.total + sale.discount)) * 100 : 0;
      if (sale.status === 'VOIDED' || sale.status === 'REFUNDED' || discountPercentage > 20) {
        suspiciousDiscountsCount++;
        suspiciousLogs.push({
          id: sale.id,
          timestamp: sale.date,
          description: `Suspicious action: ${sale.status} sale #${sale.invoiceNo} with discount value of $${sale.discount} (${discountPercentage.toFixed(1)}%)`,
          operator: sale.operator,
          branchName: sale.branch,
          terminal: sale.terminal,
          severity: discountPercentage > 20 ? 'High' : 'Medium'
        });
      }
    });

    drillDowns.suspiciousDiscounts = {
      reason: suspiciousDiscountsCount > 0 ? `Flagged ${suspiciousDiscountsCount} transactions exceeding standard operating safety metrics.` : 'All discounts and returns reside within normal variance ratios.',
      recommendedAction: suspiciousDiscountsCount > 0 ? 'Supervisor must pull invoices for flagged transactions and review authorization logs.' : 'No actions required.',
      logs: suspiciousLogs
    };


    // --- Rule: Delivery Score ---
    let deliveryCompletionScore = 100;
    const deliveryScoreLogs: BIDrillDownLog[] = [];
    let lateDeliveriesCount = 0;
    let completedDeliveries = 0;

    filteredDeliveries.forEach(d => {
      if (d.deliveryStatus === 'COMPLETED' || d.deliveredAt) {
        completedDeliveries++;
        const reqTime = new Date(d.requestedAt).getTime();
        const delTime = new Date(d.deliveredAt || d.updatedAt).getTime();
        const hours = (delTime - reqTime) / (1000 * 60 * 60);
        if (hours > 2) {
          lateDeliveriesCount++;
          deliveryScoreLogs.push({
            id: d.deliveryId,
            timestamp: d.deliveredAt || d.updatedAt,
            description: `Delivery request #${d.deliveryNumber} completed late. Duration: ${hours.toFixed(1)} hours (Threshold: 2.0 hrs)`,
            operator: d.driverName,
            branchName: d.branchName,
            severity: 'Medium'
          });
        }
      }
    });

    if (completedDeliveries > 0) {
      const lateRate = lateDeliveriesCount / completedDeliveries;
      deliveryCompletionScore = Math.max(0, Math.round(100 - (lateRate * 100)));
    }

    drillDowns.deliveryScore = {
      reason: lateDeliveriesCount > 0 ? `${lateDeliveriesCount} out of ${completedDeliveries} completed deliveries exceeded the 2-hour completion threshold.` : 'All dispatches completed within target timelines.',
      recommendedAction: lateDeliveriesCount > 0 ? 'Review driver dispatch routes and optimization schedules.' : 'None.',
      logs: deliveryScoreLogs
    };


    // --- Rule: Cash Received Confirmation Status ---
    let missingHandoverCount = 0;
    const cashConfirmationLogs: BIDrillDownLog[] = [];

    filteredDeliveries.forEach(d => {
      // If delivery request cash status is pending handover but status is COMPLETED
      if (d.paymentMode === 'CASH' && (d.deliveryStatus === 'COMPLETED' || d.deliveryStatus === 'DELIVERED') && d.cashStatus !== 'Confirmed') {
        missingHandoverCount++;
        cashConfirmationLogs.push({
          id: d.deliveryId,
          timestamp: d.updatedAt || d.createdAt,
          description: `Delivery #${d.deliveryNumber} is Delivered, but Cash status is '${d.cashStatus}' (not Confirmed). Cash expected: $${d.cashToCollect}`,
          operator: d.driverName,
          branchName: d.branchName,
          severity: 'High'
        });
      }
    });

    const cashReceivedConfirmationStatus = {
      status: (missingHandoverCount > 0 ? 'Pending Confirmations' : 'All Confirmed') as 'All Confirmed' | 'Pending Confirmations' | 'Missing Handover',
      missingCount: missingHandoverCount
    };

    drillDowns.cashConfirmation = {
      reason: missingHandoverCount > 0 ? `Detected ${missingHandoverCount} dispatches completed with missing cashier-remitted cash handovers.` : 'All cash deliveries fully remitted and supervisor-confirmed.',
      recommendedAction: missingHandoverCount > 0 ? 'Mandate immediate driver cash-remittance audit reconciliation.' : 'None.',
      logs: cashConfirmationLogs
    };


    // --- Rule: Branch Performance Summary ---
    const branchPerformance: BIDashboardMetrics['branchPerformance'] = branches.map(b => {
      // Calculate sales for this branch
      const branchSales = filteredSales.filter(s => s.branch === b.branchName || s.branch === b.branchId);
      const totalSales = branchSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const salesCount = branchSales.length;

      // Deterministic risk score per branch
      // Derived from suspicious transactions in this branch
      const branchSuspicious = branchSales.filter(s => {
        const discountPercentage = s.total > 0 ? (s.discount / (s.total + s.discount)) * 100 : 0;
        return s.status === 'VOIDED' || s.status === 'REFUNDED' || discountPercentage > 20;
      }).length;

      const riskScore = salesCount > 0 ? Math.min(100, Math.round((branchSuspicious / salesCount) * 100)) : 0;
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (riskScore >= 75) riskLevel = 'CRITICAL';
      else if (riskScore >= 45) riskLevel = 'HIGH';
      else if (riskScore >= 15) riskLevel = 'MEDIUM';

      return {
        branchId: b.branchId,
        branchName: b.branchName,
        salesCount,
        totalSales: Number(totalSales.toFixed(2)),
        riskScore,
        riskLevel
      };
    });

    return {
      stockRiskScore,
      cashierRiskScore,
      theftVarianceAlerts,
      lowStockAlerts: lowStockItems.length,
      deadStockWarnings: deadStockItems.length,
      fastMovingStock: fastMovingItems.length,
      suspiciousDiscountsCount,
      deliveryCompletionScore,
      cashReceivedConfirmationStatus,
      branchPerformance,
      drillDowns
    };
  }
};
