import React, { useState } from 'react';
import { 
  TrendingUp, 
  Layers, 
  Lock, 
  Unlock, 
  Users, 
  Monitor, 
  ShieldAlert, 
  DollarSign, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Building, 
  AlertTriangle, 
  ArrowRight, 
  Check, 
  Database,
  Zap,
  Package,
  ClipboardList,
  PlusCircle,
  Truck,
  FileCheck,
  RotateCcw,
  RefreshCw,
  Eye,
  ShieldCheck,
  FileText,
  Download,
  X
} from 'lucide-react';
import { Product, Transaction, Shift, CashLog, PosSession, PosPageId, BusinessProfile } from '../types';
import { getBusinessProfileDashboardSummary } from '../services/businessProfileService';
import { normalizeSecurityRole, roleHasPermission } from '../auth/permissionMatrixService';

interface PosDashboardProps {
  products: Product[];
  transactions: Transaction[];
  activeShift: Shift | null;
  cashLogs: CashLog[];
  onNavigate: (page: PosPageId) => void;
  session?: PosSession | null;
  businessProfile?: BusinessProfile;
}

export default function PosDashboard({
  products,
  transactions,
  activeShift,
  cashLogs,
  onNavigate,
  session,
  businessProfile
}: PosDashboardProps) {

  // Retrieve current active operator name
  const staffName = session?.staffName || 'Admin User';
  const roleName = session?.role || 'Owner';
  const vendorName = session?.vendor || 'Demo Vendor';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'POS-01';
  const businessSummary = getBusinessProfileDashboardSummary(
    (permissionKey) => roleHasPermission(normalizeSecurityRole(roleName), permissionKey),
    businessProfile
  );

  // State to simulate system notification feedback when quick actions are clicked
  const [consoleNotification, setConsoleNotification] = useState<string>('Sync Status: Fully Synchronized');
  const [notificationType, setNotificationType] = useState<'info' | 'success' | 'warning'>('info');

  // Local state for approval queue cards to allow interactive approving
  const [overridesCount, setOverridesCount] = useState(2);
  const [refundsCount, setRefundsCount] = useState(1);
  const [adjustmentsCount, setAdjustmentsCount] = useState(3);
  const [varianceCount, setVarianceCount] = useState(0);
  const [analyticsModal, setAnalyticsModal] = useState<'trading' | 'stock' | null>(null);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysTransactions = React.useMemo(() => transactions.filter((transaction) => (transaction.date || '').slice(0, 10) === todayKey), [todayKey, transactions]);
  const tradingSummary = React.useMemo(() => {
    const saleRows = todaysTransactions.length > 0 ? todaysTransactions : transactions;
    const grossSales = saleRows.reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const transactionCount = saleRows.length;
    const itemsSold = saleRows.reduce((sum, transaction) => sum + (transaction.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0);
    const cashSales = saleRows.filter((transaction) => transaction.paymentMethod === 'CASH').reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const cardSales = saleRows.filter((transaction) => transaction.paymentMethod === 'CARD').reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const splitSales = saleRows.filter((transaction) => transaction.paymentMethod === 'SPLIT').reduce((sum, transaction) => sum + (transaction.total || 0), 0);
    const estimatedCost = saleRows.reduce((sum, transaction) => {
      return sum + (transaction.items?.reduce((itemSum, item) => {
        const product = products.find((row) => row.id === item.productId || row.code === item.code);
        const unitCost = product?.cost ?? item.price * 0.62;
        return itemSum + unitCost * item.quantity;
      }, 0) || 0);
    }, 0);
    const grossProfit = Math.max(0, grossSales - estimatedCost);
    return {
      grossSales,
      transactionCount,
      averageBasket: transactionCount > 0 ? grossSales / transactionCount : 0,
      itemsSold,
      cashSales,
      cardSales,
      splitSales,
      grossProfit,
      grossMargin: grossSales > 0 ? (grossProfit / grossSales) * 100 : 0
    };
  }, [todaysTransactions, transactions, products]);
  const stockHealthSummary = React.useMemo(() => {
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const stockLevel = (product: Product) => product.stock ?? product.qtyOnHand ?? product.availableStock ?? 0;
    const lowStockRows = products.filter((product) => stockLevel(product) > 0 && stockLevel(product) <= (product.minStock || 5));
    const outOfStockRows = products.filter((product) => stockLevel(product) <= 0);
    const deadStockRows = products.filter((product) => {
      const lastMovement = product.lastMovementDate ? new Date(product.lastMovementDate).getTime() : 0;
      return lastMovement > 0 && lastMovement < ninetyDaysAgo;
    });
    const fastMovers = products
      .filter((product) => (product.healthStatus === 'Fast Moving' || stockLevel(product) > (product.minStock || 5) * 3) && stockLevel(product) > 0)
      .slice(0, 6);
    const reorderRows = products.filter((product) => stockLevel(product) <= (product.minStock || 5));
    return {
      lowStock: lowStockRows.length,
      outOfStock: outOfStockRows.length,
      deadStock: deadStockRows.length,
      varianceRisk: Math.max(0, products.filter((product) => product.healthStatus === 'Low Stock' || product.healthStatus === 'Out of Stock').length),
      slowMovers: deadStockRows.length,
      fastMovers: fastMovers.length,
      reorderRequired: reorderRows.length,
      lowStockRows,
      outOfStockRows,
      deadStockRows,
      fastMoverRows: fastMovers,
      reorderRows
    };
  }, [products]);

  const money = (value: number) => `USD ${value.toFixed(2)}`;
  type AnalyticsSection = { title: string; rows: string[][] };
  const analyticsSections = (kind: 'trading' | 'stock'): AnalyticsSection[] => {
    if (kind === 'trading') {
      return [
        {
          title: 'Sales Breakdown',
          rows: [
            ['Gross sales', money(tradingSummary.grossSales)],
            ['Cash sales', money(tradingSummary.cashSales)],
            ['Card sales', money(tradingSummary.cardSales)],
            ['Split payments', money(tradingSummary.splitSales)],
            ['Items sold', String(tradingSummary.itemsSold)]
          ]
        },
        {
          title: 'Profit Breakdown',
          rows: [
            ['Estimated gross profit', money(tradingSummary.grossProfit)],
            ['Estimated margin', `${tradingSummary.grossMargin.toFixed(1)}%`],
            ['Discount impact', money(Math.max(0, transactions.reduce((sum, transaction) => sum + (transaction.discount || 0), 0)))],
            ['Average basket value', money(tradingSummary.averageBasket)]
          ]
        },
        {
          title: 'Transaction Analysis',
          rows: [
            ['Transaction count', String(tradingSummary.transactionCount)],
            ['Average units per sale', tradingSummary.transactionCount > 0 ? (tradingSummary.itemsSold / tradingSummary.transactionCount).toFixed(1) : '0.0'],
            ['Active branch', branchName],
            ['Active terminal', terminalName]
          ]
        }
      ];
    }
    return [
      {
        title: 'Stock Risk',
        rows: [
          ['Low stock', String(stockHealthSummary.lowStock)],
          ['Out of stock', String(stockHealthSummary.outOfStock)],
          ['Variance risk', String(stockHealthSummary.varianceRisk)],
          ['Dead stock', String(stockHealthSummary.deadStock)]
        ]
      },
      {
        title: 'Slow Movers',
        rows: stockHealthSummary.deadStockRows.slice(0, 6).map((product) => [
          product.name || product.productName || product.code,
          `${product.stock ?? product.qtyOnHand ?? product.availableStock ?? 0} on hand`
        ]).concat(stockHealthSummary.deadStockRows.length === 0 ? [['No slow movers', '0 items']] : [])
      },
      {
        title: 'Fast Movers',
        rows: stockHealthSummary.fastMoverRows.map((product) => [
          product.name || product.productName || product.code,
          `${product.stock ?? product.qtyOnHand ?? product.availableStock ?? 0} on hand`
        ]).concat(stockHealthSummary.fastMoverRows.length === 0 ? [['No fast movers', '0 items']] : [])
      },
      {
        title: 'Reorder Analysis',
        rows: [
          ['Products requiring reorder', String(stockHealthSummary.reorderRequired)],
          ['Critical zero stock', String(stockHealthSummary.outOfStock)],
          ['Low stock watchlist', String(stockHealthSummary.lowStock)],
          ['Recommended action', stockHealthSummary.reorderRequired > 0 ? 'Create supplier reorder review' : 'Maintain current stock levels']
        ]
      }
    ];
  };
  const exportRows = (kind: 'trading' | 'stock'): string[][] => {
    return [['Section', 'Metric', 'Value'], ...analyticsSections(kind).flatMap((section) => section.rows.map(([metric, value]) => [section.title, metric, value]))];
  };
  const exportExcel = (kind: 'trading' | 'stock') => {
    const rows = exportRows(kind);
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind === 'trading' ? 'today-trading-summary' : 'stock-health'}-${todayKey}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    triggerNotification(`${kind === 'trading' ? 'Trading summary' : 'Stock health'} Excel export prepared.`, 'success');
  };
  const exportPdf = (kind: 'trading' | 'stock') => {
    const title = kind === 'trading' ? 'Today Trading Summary' : 'Stock Health';
    const sections = analyticsSections(kind);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      triggerNotification('PDF export blocked by browser popup settings.', 'warning');
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
            h1 { color: #f26a1b; font-size: 22px; margin-bottom: 4px; }
            p { color: #475569; margin-top: 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #fff7ed; color: #9a3412; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p>${vendorName} | ${branchName} | ${todayKey}</p>
          ${sections.map((section) => `
            <h2>${section.title}</h2>
            <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>
              ${section.rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}
            </tbody></table>
          `).join('')}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    triggerNotification(`${title} PDF export prepared.`, 'success');
  };

  // Alert simulation triggers
  const triggerNotification = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setConsoleNotification(message);
    setNotificationType(type);
    setTimeout(() => {
      setConsoleNotification('Sync Status: Fully Synchronized');
      setNotificationType('info');
    }, 4000);
  };

  // Handle local approval actions
  const approvePriceOverride = () => {
    if (overridesCount > 0) {
      setOverridesCount(prev => prev - 1);
      triggerNotification(`APPROVED: Price override bypass granted for operator.`, 'success');
    } else {
      triggerNotification(`No price overrides pending in approval queue.`, 'info');
    }
  };

  const approveRefund = () => {
    if (refundsCount > 0) {
      setRefundsCount(prev => prev - 1);
      triggerNotification(`APPROVED: Customer refund of USD 45.00 authorized.`, 'success');
    } else {
      triggerNotification(`No active refunds pending.`, 'info');
    }
  };

  const approveAdjustment = () => {
    if (adjustmentsCount > 0) {
      setAdjustmentsCount(prev => prev - 1);
      triggerNotification(`APPROVED: Inventory write-in stock correction processed.`, 'success');
    } else {
      triggerNotification(`No pending stock adjustments.`, 'info');
    }
  };

  // Exact BI alerts mandated by the user specification
  const BI_ALERTS = [
    {
      id: 'AL-109',
      type: 'LOW_STOCK_REMINDER',
      severity: 'Medium',
      message: 'Brake Pads Toyota GD6 below reorder level',
      time: '15:48:12',
    },
    {
      id: 'AL-110',
      type: 'PRICE_OVERRIDE_REQUESTED',
      severity: 'High',
      message: 'Cashier requested 15% discount on radiator',
      time: '15:40:02',
    },
    {
      id: 'AL-111',
      type: 'SALE_BLOCKED_ZERO_STOCK',
      severity: 'Critical',
      message: 'Attempted sale of out-of-stock clutch plate',
      time: '15:21:49',
    },
    {
      id: 'AL-112',
      type: 'FAILED_TERMINAL_LOGIN',
      severity: 'Medium',
      message: 'Failed access attempt on POS-02',
      time: '14:55:01',
    },
    {
      id: 'AL-113',
      type: 'RECOMMEND_MAJOR_STOCKTAKE',
      severity: 'High',
      message: 'Branch stock variance risk increasing',
      time: '14:30:15',
    }
  ];

  return (
    <div className="space-y-6 select-none font-mono text-xs text-slate-300">
      
      {/* 0. Top Operational Context Banner */}
      <div id="dashboard-context-banner" className="bg-[#0f131a] border border-slate-800 p-4 relative overflow-hidden">
        {/* Corner machinery visual lines */}
        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-amber-500"></div>
        <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-amber-500"></div>
        <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-amber-500"></div>
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-amber-500"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 animate-pulse shrink-0"></div>
            <div>
              <div className="text-[10px] text-slate-550 font-black uppercase tracking-widest leading-none">
                ACTIVE OPERATIONAL SITE IDENTITY CONTEXT
              </div>
              <div className="text-slate-100 font-bold text-xs mt-1 uppercase flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>VENDOR: <strong className="text-amber-500">{vendorName}</strong></span>
                <span className="text-slate-700 font-normal">|</span>
                <span>BRANCH: <strong className="text-[#00f0ff]">{branchName}</strong></span>
                <span className="text-slate-700 font-normal">|</span>
                <span>TERMINAL: <strong className="text-slate-200">{terminalName}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 shrink-0">
            <div className="bg-amber-500/10 border border-amber-500/30 p-2 shrink-0">
              <Users className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest leading-none">
                AUTHENTICATED OPERATOR
              </div>
              <div className="text-slate-200 font-bold text-xs mt-1 uppercase">
                {staffName} <span className="text-amber-400 font-normal">[{roleName}]</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status notification feedback */}
      <div className={`p-3 border text-[10px] tracking-wide uppercase transition-all duration-300 flex items-center justify-between ${
        notificationType === 'success' ? 'bg-emerald-950/30 border-emerald-800 text-emerald-400' :
        notificationType === 'warning' ? 'bg-amber-950/30 border-amber-800 text-amber-400' :
        'bg-slate-950 border-slate-850 text-sky-400'
      }`}>
        <div className="flex items-center gap-2">
          {notificationType === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> :
           notificationType === 'warning' ? <ShieldAlert className="w-4 h-4 shrink-0" /> :
           <Activity className="w-4 h-4 shrink-0 animate-pulse" />}
          <span>{consoleNotification}</span>
        </div>
        <div className="text-[9px] text-slate-600 font-black">
          UTC: {new Date().toISOString().substring(11, 19)}
        </div>
      </div>

      <div className="bg-white border-2 border-[#b1b5c2] p-3 text-[#1e222b]">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[9px] text-orange-600 uppercase font-black">Business Profile</p>
            <h3 className="text-sm font-black uppercase">Registration Summary</h3>
          </div>
          {!businessSummary.canViewRegistration && <span className="border border-orange-400 bg-orange-50 text-orange-950 px-2 py-1 text-[9px] font-black uppercase">Registration details hidden by permission</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {businessSummary.canViewRegistration ? (
            <>
              <DashboardBusinessMetric label="Registered Name" value={businessSummary.registration.registeredBusinessName} />
              <DashboardBusinessMetric label="Trading Name" value={businessSummary.registration.tradingName || '-'} />
              <DashboardBusinessMetric label="Registration No" value={businessSummary.registration.registrationNumber || '-'} />
              <DashboardBusinessMetric label="Registration Date" value={businessSummary.registration.registrationDate || '-'} />
              <DashboardBusinessMetric label="Registration Place" value={businessSummary.registration.registrationPlace || '-'} />
              <DashboardBusinessMetric label="VAT Status" value={businessSummary.registration.vatStatus} />
              <DashboardBusinessMetric label="Tax Registration" value={businessSummary.registration.taxRegistrationNumber || '-'} />
              <DashboardBusinessMetric label="Admin / Accountant" value={businessSummary.registration.accountantOrAdministratorName || '-'} />
              <DashboardBusinessMetric label="Admin Phone" value={businessSummary.registration.accountantOrAdministratorPhone || '-'} />
            </>
          ) : (
            <>
              <DashboardBusinessMetric label="Business Name" value={businessSummary.basic.businessName || '-'} />
              <DashboardBusinessMetric label="Trading Name" value={businessSummary.basic.tradingName || '-'} />
              <DashboardBusinessMetric label="City / Town" value={businessSummary.basic.cityTown || '-'} />
              <DashboardBusinessMetric label="Industrial Sector" value={businessSummary.basic.industrialSector || '-'} />
              <DashboardBusinessMetric label="Status" value={businessSummary.basic.status || '-'} />
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Left Side Operations (cols-2), Right Side BI Alerts (cols-1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN SPANS */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Today Trading Summary */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              1. Today Trading Summary
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              
              {/* Metric 1 */}
              <div className="dashboard-analytics-card bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all" onDoubleClick={() => setAnalyticsModal('trading')} title="Double click for trading analytics">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Gross Sales (USD)
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  {money(tradingSummary.grossSales)}
                </div>
                <div className="text-[9px] text-emerald-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-none shrink-0" />
                  +12.8% VS PRIOR
                </div>
              </div>

              {/* Metric 2 */}
              <div className="dashboard-analytics-card bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all" onDoubleClick={() => setAnalyticsModal('trading')} title="Double click for trading analytics">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Transactions
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  {tradingSummary.transactionCount} sales
                </div>
                <div className="text-[9px] text-indigo-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-none shrink-0" />
                  LEDGER POSTED
                </div>
              </div>

              {/* Metric 3 */}
              <div className="dashboard-analytics-card bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all" onDoubleClick={() => setAnalyticsModal('trading')} title="Double click for trading analytics">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Average Basket
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  {money(tradingSummary.averageBasket)}
                </div>
                <div className="text-[9px] text-cyan-400 uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-none shrink-0" />
                  STABLE RANGE
                </div>
              </div>

              {/* Metric 4 */}
              <div className="dashboard-analytics-card bg-[#10141e] border border-slate-800 p-4 relative flex flex-col justify-between h-28 hover:border-[#00f0ff] transition-all" onDoubleClick={() => setAnalyticsModal('trading')} title="Double click for trading analytics">
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                  Items Sold
                </div>
                <div className="text-lg font-black text-slate-50 font-mono tracking-tight my-1">
                  {tradingSummary.itemsSold} pcs
                </div>
                <div className="text-[9px] text-[#00f0ff] uppercase font-black tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#00f0ff] rounded-none shrink-0" />
                  DISPATCH ORDERED
                </div>
              </div>

            </div>
            <div className="dashboard-export-actions">
              <button type="button" onClick={() => exportPdf('trading')}><FileText className="w-3.5 h-3.5" /> PDF</button>
              <button type="button" onClick={() => exportExcel('trading')}><Download className="w-3.5 h-3.5" /> Excel</button>
            </div>
          </div>

          {/* 2 & 3: Shift Status & Stock Health in Double Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 2. Shift Status */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                2. Shift Status
              </h3>

              <div className="bg-[#0f131a] border border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-slate-500 uppercase font-bold text-[10px]">Active Shift Lock:</span>
                  <span className="bg-emerald-950/60 border border-emerald-800 text-emerald-400 px-2 py-0.5 text-[9px] font-black tracking-widest uppercase">
                    [Open / Active]
                  </span>
                </div>

                <div className="space-y-2 text-[10.5px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opened By:</span>
                    <span className="text-slate-200 font-bold uppercase">{staffName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opening Float:</span>
                    <span className="text-slate-200 font-mono">USD 50.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expected Cash:</span>
                    <span className="text-amber-500 font-mono font-bold">USD 710.00</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-900/50 pt-2 text-[10px]">
                    <span className="text-slate-500">Declared Cash:</span>
                    <span className="text-slate-400 italic">Pending Reconcile</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Variance:</span>
                    <span className="text-slate-400 italic">Pending Audit</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-900">
                  <button
                    onClick={() => onNavigate('SHIFT')}
                    className="w-full text-center py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[#00f0ff] hover:text-[#4df5ff] transition-colors text-[9px] uppercase font-bold tracking-wider"
                  >
                    Manage Shift Registers &rarr;
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Stock Health */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-[#00f0ff]" />
                3. Stock Health
              </h3>

              <div className="bg-[#0f131a] border border-slate-800 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3.5">
                  
                  <div className="dashboard-analytics-card bg-slate-950 p-2.5 border border-slate-800 hover:border-amber-500/50 transition-colors" onDoubleClick={() => setAnalyticsModal('stock')} title="Double click for stock health analytics">
                    <div className="text-[9px] text-amber-500 uppercase font-black tracking-wider leading-none">
                      Low Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      {stockHealthSummary.lowStock} items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">BELOW SAFETY VAL</span>
                  </div>

                  <div className="dashboard-analytics-card bg-slate-950 p-2.5 border border-slate-800 hover:border-rose-500/50 transition-colors" onDoubleClick={() => setAnalyticsModal('stock')} title="Double click for stock health analytics">
                    <div className="text-[9px] text-rose-500 uppercase font-black tracking-wider leading-none">
                      Out of Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      {stockHealthSummary.outOfStock} items
                    </div>
                    <span className="text-[8px] text-rose-400 block uppercase font-bold animate-pulse">0 BAL SHUTDOWN</span>
                  </div>

                  <div className="dashboard-analytics-card bg-slate-950 p-2.5 border border-slate-800 hover:border-slate-700 transition-colors" onDoubleClick={() => setAnalyticsModal('stock')} title="Double click for stock health analytics">
                    <div className="text-[9px] text-slate-500 uppercase font-black tracking-wider leading-none">
                      Dead Stock
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      {stockHealthSummary.deadStock} items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">NO MVMNT &gt; 90D</span>
                  </div>

                  <div className="dashboard-analytics-card bg-slate-950 p-2.5 border border-slate-800 hover:border-amber-500 transition-colors" onDoubleClick={() => setAnalyticsModal('stock')} title="Double click for stock health analytics">
                    <div className="text-[9px] text-yellow-500 uppercase font-black tracking-wider leading-none">
                      Variance Risk
                    </div>
                    <div className="text-lg font-black text-slate-100 font-mono mt-1">
                      {stockHealthSummary.varianceRisk} items
                    </div>
                    <span className="text-[8px] text-slate-500 block uppercase">DRIFT SUSPICION</span>
                  </div>

                </div>

                <div className="pt-1">
                  <div className="dashboard-export-actions dashboard-export-actions--stock">
                    <button type="button" onClick={() => exportPdf('stock')}><FileText className="w-3.5 h-3.5" /> PDF</button>
                    <button type="button" onClick={() => exportExcel('stock')}><Download className="w-3.5 h-3.5" /> Excel</button>
                  </div>
                  <button
                    onClick={() => onNavigate('STOCK')}
                    className="w-full text-center py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-[#00f0ff] hover:text-[#4df5ff] transition-colors text-[9px] uppercase font-bold tracking-wider"
                  >
                    Open Stock Control Log &rarr;
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* 4. Approval Queue */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              4. Price & Transaction Approval Queue
            </h3>

            <div className="bg-[#0f131a] border border-slate-800 p-4">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-3 leading-none">
                Approval Requests From Active Terminals:
              </div>

              <div className="space-y-2.5">
                
                {/* Override Queue Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        PRICE OVERRIDE
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{overridesCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Cashier is requesting manually set 15% discount override on Radiators.</p>
                  </div>
                  <button
                    onClick={approvePriceOverride}
                    disabled={overridesCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {overridesCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Refund Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        REFUND QUEUE
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{refundsCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Cash refund request for 20 M12 Heavy Hex Bolts returned due to size error.</p>
                  </div>
                  <button
                    onClick={approveRefund}
                    disabled={refundsCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {refundsCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Stock write-in Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        STOCK ADJUSTMENT
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{adjustmentsCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Manual write-in request to adjust Steel Thread Tapes counts upwards (+5 units).</p>
                  </div>
                  <button
                    onClick={approveAdjustment}
                    disabled={adjustmentsCount === 0}
                    className="bg-amber-500 hover:bg-amber-600 disabled:bg-slate-850 text-slate-950 disabled:text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    {adjustmentsCount > 0 ? 'Review & Sign' : 'Cleared'}
                  </button>
                </div>

                {/* Cash Variance Row */}
                <div className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                        CASH VARIANCE REVIEWS
                      </span>
                      <strong className="text-slate-200 text-[10.5px] font-mono">{varianceCount} Active Request(s)</strong>
                    </div>
                    <p className="text-[9px] text-slate-500 max-w-md truncate">Drawer discrepancy flagged beneath allowed standard float bounds.</p>
                  </div>
                  <button
                    disabled
                    className="bg-slate-850 text-slate-600 px-3 py-1.5 font-bold uppercase transition-colors shrink-0 text-[10px]"
                  >
                    No Alerts
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* 6. Quick Actions */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
              <TableActionsIcon className="w-4 h-4 text-emerald-400" />
              6. Quick Actions
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              
              <button
                onClick={() => onNavigate('SALES')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-[#00f0ff] p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <PlusCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">New Sale</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">OPEN TERMINAL</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('STOCK');
                  triggerNotification('STOCKTAKE UTILITY LOADED: Initiating visual scanner sequence.', 'info');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-amber-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <ClipboardList className="w-6 h-6 text-amber-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Open Stocktake</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">INVENTORY COUNT</span>
              </button>

              <button
                onClick={() => {
                  onNavigate('STOCK');
                  triggerNotification('Goods receiving workspace opened. Fill incoming stock details below.', 'info');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-sky-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Truck className="w-6 h-6 text-sky-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Receive Goods</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">STOCK RECEIVING</span>
              </button>

              <button
                onClick={() => onNavigate('CASH')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-emerald-500 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <FileCheck className="w-6 h-6 text-emerald-500 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Cash Count</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">VERIFY CASH FLOAT</span>
              </button>

              <button
                onClick={() => {
                  triggerNotification('Approval request sent to branch supervisors.', 'warning');
                }}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-amber-400 p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Zap className="w-6 h-6 text-amber-400 mx-auto mb-2 group-hover:scale-105 transition-transform animate-pulse" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">Request Approval</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">SUBMIT APPROVAL</span>
              </button>

              <button
                onClick={() => onNavigate('BI_DESK')}
                className="bg-[#141822] hover:bg-[#1a2130] border border-slate-800 hover:border-[#00f0ff] p-4 text-center cursor-pointer group transition-all text-slate-200"
              >
                <Eye className="w-6 h-6 text-[#00f0ff] mx-auto mb-2 group-hover:scale-105 transition-transform" />
                <span className="block font-bold uppercase text-[10px] tracking-wider text-slate-100">View BI Desk</span>
                <span className="text-[8.5px] text-slate-550 block mt-1">LIVE ACTIVITY FEED</span>
              </button>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 5. BI ALERTS READOUT (1 Col) */}
        <div className="space-y-3">
          <h3 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
            5. BI Risk Alerts
          </h3>

          <div className="bg-[#0f131a] border border-slate-800 p-4 h-[730px] flex flex-col justify-between relative overflow-hidden">
            {/* Fine framing indicators */}
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-slate-700"></div>
            <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-slate-700"></div>
            <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-slate-700"></div>
            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-slate-700"></div>

            <div className="space-y-4">
              <div className="border-b border-slate-900 pb-2">
                <div className="text-[10px] font-black text-slate-100 uppercase tracking-widest flex items-center justify-between">
                  <span>Live Activity Feed</span>
                  <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 animate-pulse">
                    LIVE STREAM
                  </span>
                </div>
                <p className="text-[9px] text-slate-500 mt-1 leading-normal">
                  Realtime notification stream mapping core hardware interaction faults, bypasses, price corrections, and zero stock events.
                </p>
              </div>

              {/* Precise vertical list mapping the 5 specific alerts */}
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1 pos-custom-scroll">
                
                {BI_ALERTS.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 border text-[10.5px] relative group hover:bg-slate-900/40 transition-colors ${
                      alert.severity === 'Critical' ? 'bg-rose-950/10 border-rose-900/60' :
                      alert.severity === 'High' ? 'bg-amber-950/10 border-amber-900/60' :
                      'bg-slate-950 border-slate-850'
                    }`}
                  >
                    {/* Tiny accent decoration representing active alert sync */}
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      alert.severity === 'Critical' ? 'bg-rose-500' :
                      alert.severity === 'High' ? 'bg-amber-500' :
                      'bg-indigo-500'
                    }`} />

                    <div className="pl-2.5">
                      <div className="flex items-center justify-between text-[8px] uppercase font-black text-slate-500 mb-1">
                        <span>ID: {alert.id} • HRE_M3</span>
                        <span className={`px-1.5 py-0.5 font-bold ${
                          alert.severity === 'Critical' ? 'bg-rose-950 border border-rose-800 text-rose-400' :
                          alert.severity === 'High' ? 'bg-amber-950 border border-amber-800 text-amber-400' :
                          'bg-indigo-950 border border-indigo-900 text-indigo-400'
                        }`}>
                          {alert.severity}
                        </span>
                      </div>

                      <div className="text-[10px] font-black text-slate-200 uppercase tracking-wide flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-none inline-block shrink-0 bg-slate-550" />
                        {alert.type}
                      </div>

                      <p className="text-[10px] text-slate-300 font-medium leading-relaxed mt-1 text-slate-300">
                        {alert.message}
                      </p>

                      <div className="mt-2 pt-1 border-t border-slate-900 flex justify-between items-center text-[8.5px] text-slate-500">
                        <span>STATION ID: {terminalName}</span>
                        <span>⌛ {alert.time}</span>
                      </div>
                    </div>
                  </div>
                ))}

              </div>
            </div>

            {/* Total count footer log */}
            <div className="border-t border-slate-900 pt-3 flex items-center justify-between text-[9px] text-slate-600 font-black">
              <span>ALERT STREAM BUFFER: 5 RECORDS</span>
              <span>STATE: OPERATIONAL</span>
            </div>
          </div>
        </div>

      </div>

      {/* Modern Industrial Footer Diagnostics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-slate-800 bg-slate-950 p-4 font-mono text-[10px] uppercase text-slate-400">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">LOCALIZED REGISTRY DATE</div>
            <div className="text-slate-300 font-bold">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t md:border-t-0 md:border-x border-slate-800 py-2 md:py-0 md:px-4">
          <Database className="w-4 h-4 text-indigo-400 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">Data Storage Status</div>
            <div className="text-slate-200 font-bold">SOLID_STATE LOCALBYPASS BUFFER</div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t md:border-t-0 py-2 md:py-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <div className="text-slate-600 text-[9px]">DIAGNOSTIC STATUS</div>
            <div className="text-emerald-400 font-bold">Terminal Ready</div>
          </div>
        </div>
      </div>

      {analyticsModal && (
        <DashboardAnalyticsModal
          title={analyticsModal === 'trading' ? 'Today Trading Summary' : 'Stock Health'}
          subtitle={`${vendorName} | ${branchName} | ${todayKey}`}
          sections={analyticsSections(analyticsModal)}
          onExportPdf={() => exportPdf(analyticsModal)}
          onExportExcel={() => exportExcel(analyticsModal)}
          onClose={() => setAnalyticsModal(null)}
        />
      )}

    </div>
  );
}

// Compact helper components to keep compilation smooth & type-safe
function TableActionsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="0" />
      <path d="M21 9H3" />
      <path d="M21 15H3" />
      <path d="M12 3v18" />
    </svg>
  );
}

function DashboardBusinessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d6d9e0] bg-slate-50 p-2 min-h-14">
      <span className="block text-[8px] text-slate-500 uppercase font-black">{label}</span>
      <strong className="block text-[10px] text-[#1e222b] uppercase break-words">{value}</strong>
    </div>
  );
}

function DashboardAnalyticsModal({
  title,
  subtitle,
  sections,
  onExportPdf,
  onExportExcel,
  onClose
}: {
  title: string;
  subtitle: string;
  sections: Array<{ title: string; rows: string[][] }>;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onClose: () => void;
}) {
  return (
    <div className="dashboard-analytics-backdrop" onClick={onClose}>
      <section className="dashboard-analytics-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div>
            <p>Analytics</p>
            <h2>{title}</h2>
            <span>{subtitle}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close analytics"><X className="w-4 h-4" /></button>
        </header>
        <div className="dashboard-analytics-grid dashboard-analytics-grid--sections">
          {sections.map((section) => (
            <section key={section.title} className="dashboard-analytics-section">
              <h3>{section.title}</h3>
              <div>
                {section.rows.map(([label, value]) => (
                  <p key={`${section.title}-${label}`}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onExportPdf}><FileText className="w-4 h-4" /> Export PDF</button>
          <button type="button" onClick={onExportExcel}><Download className="w-4 h-4" /> Export Excel</button>
          <button type="button" onClick={onClose}>Close</button>
        </footer>
      </section>
    </div>
  );
}
