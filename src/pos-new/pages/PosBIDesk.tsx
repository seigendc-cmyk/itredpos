import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Sliders, 
  HelpCircle, 
  BookOpen, 
  Lock, 
  Radio, 
  ClipboardCheck, 
  Database,
  Search,
  Filter,
  Check,
  AlertCircle,
  Truck,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { Transaction, Product, BiEvent, PosSession } from '../types';
import { mockBIEvents } from '../mock/mockPosData';

interface PosBIDeskProps {
  transactions: Transaction[];
  products: Product[];
  biEvents: BiEvent[];
  onLogBiEvent: (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: any,
    severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'Low' | 'Medium' | 'High' | 'Critical'
  ) => void;
  session?: PosSession | null;
}

interface BiAlertRow {
  id: string;
  eventType: string;
  domain: 'Anti-Theft' | 'Stock Health' | 'Cash Control' | 'Staff Behaviour' | 'Sales Integrity' | 'Approval' | 'Delivery Verification';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  trigger: string;
  description: string;
  recommendedAction: string;
  status: 'Open' | 'Pending Approval' | 'Resolved' | 'Completed' | 'Reminder Created' | 'Stocktake Initiated' | 'Followed Up';
  actionLabel: 'Review' | 'Approve' | 'Start Stocktake' | 'Create Task' | 'Follow Up' | 'Done';
}

interface ActivityLogItem {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION';
}

export default function PosBIDesk({
  transactions,
  products,
  biEvents,
  onLogBiEvent,
  session
}: PosBIDeskProps) {

  // Session context integration
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const branchName = session?.branch || 'Harare Main';
  const terminalName = session?.terminal || 'Term-A';
  const staffName = session?.staffName || 'Admin User';

  // State for metrics (Square panels) to allow dynamic decrementing/updating
  const [criticalCount, setCriticalCount] = useState(3);
  const [highRiskCount, setHighRiskCount] = useState(7);
  const [mediumCount, setMediumCount] = useState(12);
  const [staffFlags, setStaffFlags] = useState(4);
  const [stockFlags, setStockFlags] = useState(9);
  const [cashFlags, setCashFlags] = useState(3);
  const [spotChecks, setSpotChecks] = useState(5);
  const [supervisorReviews, setSupervisorReviews] = useState(6);

  // Active Category rule tab
  const [activeTab, setActiveTab] = useState<'Anti-Theft' | 'Stock Health' | 'Cash Control' | 'Staff Behaviour' | 'Sales Integrity' | 'Delivery Verification'>('Anti-Theft');

  // Search and Filter within alerts
  const [alertsSearch, setAlertsSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  // --- BI ACTIVITY FEED STATE ---
  const [activityFeed, setActivityFeed] = useState<ActivityLogItem[]>([
    {
      id: 'BIA-1',
      timestamp: '16:05:22',
      message: 'Rule evaluated: SALE_BLOCKED_ZERO_STOCK (Gate: Blocked transaction output)',
      type: 'INFO'
    },
    {
      id: 'BIA-2',
      timestamp: '15:45:11',
      message: 'Supervisor review opened for cash variance: USD -5.00 on register 01',
      type: 'WARNING'
    },
    {
      id: 'BIA-3',
      timestamp: '14:30:15',
      message: 'Price override approved by mock manager: Radiator discount authorized at 15%',
      type: 'SUCCESS'
    },
    {
      id: 'BIA-4',
      timestamp: '13:10:05',
      message: 'Major stocktake recommendation created for low velocity category Motor Spares',
      type: 'ACTION'
    },
    {
      id: 'BIA-5',
      timestamp: '11:32:00',
      message: 'Delivery code follow-up assigned to supervisor: Ref GD6 Pending verification code',
      type: 'ACTION'
    }
  ]);

  // --- BI ALERTS TABLE STATE ---
  const [alertsTable, setAlertsTable] = useState<BiAlertRow[]>(() => {
    return mockBIEvents.map(e => {
      let domain: BiAlertRow['domain'] = 'Anti-Theft';
      let trigger = 'Pattern flag activated';
      let recommendedAction = 'Investigate operator logs';
      let actionLabel: BiAlertRow['actionLabel'] = 'Review';

      if (e.eventType === 'CASH_VARIANCE_FOUND') {
        domain = 'Cash Control';
        trigger = 'Declared cash does not match expected cash';
        recommendedAction = 'Supervisor review before shift closure';
      } else if (e.eventType === 'SALE_BLOCKED_ZERO_STOCK') {
        domain = 'Stock Health';
        trigger = 'Product quantity is zero';
        recommendedAction = 'Block sale and require stock review';
      } else if (e.eventType === 'PRICE_OVERRIDE_REQUESTED') {
        domain = 'Sales Integrity';
        trigger = 'Discount above allowed cashier threshold';
        recommendedAction = 'Manager approval required';
        actionLabel = 'Approve';
      } else if (e.eventType === 'FAILED_TERMINAL_LOGIN') {
        domain = 'Staff Behaviour';
        trigger = 'Multiple failed access attempts';
        recommendedAction = 'Verify staff identity and terminal use';
      } else if (e.eventType === 'STOCK_ADJUSTMENT_REQUESTED') {
        domain = 'Stock Health';
        trigger = 'Manual adjustment requested';
        recommendedAction = 'Require supervisor approval';
        actionLabel = 'Approve';
      } else if (e.eventType === 'DELIVERY_CODE_PENDING') {
        domain = 'Delivery Verification';
        trigger = 'Verification code not entered';
        recommendedAction = 'Verify dispatch with customer';
        actionLabel = 'Follow Up';
      } else if (e.eventType === 'SUSPICIOUS_MOVEMENT_ALERT') {
        domain = 'Anti-Theft';
        trigger = 'Drawer opened manually';
        recommendedAction = 'Check security footage near register';
      } else if (e.eventType === 'RECOMMEND_MAJOR_STOCKTAKE') {
        domain = 'Stock Health';
        trigger = 'Variance risk increasing';
        recommendedAction = 'Schedule major stocktake';
        actionLabel = 'Start Stocktake';
      }

      const sevMapped = (e.severity === 'Critical' || e.severity === 'CRITICAL') ? 'Critical' :
                        (e.severity === 'High' ? 'High' : 
                        ((e.severity === 'Medium' || e.severity === 'WARNING') ? 'Medium' : 'Low'));

      return {
        id: e.id,
        eventType: e.eventType,
        domain,
        severity: sevMapped as any,
        trigger,
        description: e.payload?.details || 'Rule activation logged',
        recommendedAction,
        status: 'Open',
        actionLabel
      };
    });
  });

  // Handle action click
  const handleAlertAction = (rowId: string, actionType: BiAlertRow['actionLabel']) => {
    setAlertsTable(prev => prev.map(row => {
      if (row.id === rowId) {
        let nextStatus: BiAlertRow['status'] = 'Resolved';
        if (actionType === 'Approve') nextStatus = 'Completed';
        if (actionType === 'Start Stocktake') nextStatus = 'Stocktake Initiated';
        if (actionType === 'Create Task') nextStatus = 'Reminder Created';
        if (actionType === 'Follow Up') nextStatus = 'Followed Up';

        // Add to activity feed
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        const newFeedItem: ActivityLogItem = {
          id: `F-${Date.now()}`,
          timestamp: timeStr,
          message: `User triggered [${actionType}] on ${row.eventType}: ${row.description.slice(0, 45)}... status updated to [${nextStatus}]`,
          type: actionType === 'Approve' ? 'SUCCESS' : 'ACTION'
        };
        setActivityFeed(f => [newFeedItem, ...f]);

        // Adjust metric panels accordingly
        if (row.severity === 'Critical') {
          setCriticalCount(c => Math.max(0, c - 1));
        } else if (row.severity === 'High') {
          setHighRiskCount(h => Math.max(0, h - 1));
        } else if (row.severity === 'Medium') {
          setMediumCount(m => Math.max(0, m - 1));
        }

        if (row.domain === 'Staff Behaviour') setStaffFlags(sf => Math.max(0, sf - 1));
        if (row.domain === 'Stock Health') setStockFlags(sk => Math.max(0, sk - 1));
        if (row.domain === 'Cash Control') setCashFlags(cf => Math.max(0, cf - 1));

        return {
          ...row,
          status: nextStatus,
          actionLabel: 'Done'
        };
      }
      return row;
    }));
  };

  // Predefined Rule Cards grouped by category
  const rulesMap = {
    'Anti-Theft': [
      { rule: 'Block sale when stock is zero', details: 'Prevents negative stock indices and manual count overrides on nonexistent parts.' },
      { rule: 'Flag repeated price overrides', details: 'Logs cashier accounts attempting over 3 manual price updates in a single hour.' },
      { rule: 'Flag suspicious stock adjustments', details: 'Triggers audit requirements when items are adjusted without a valid reference invoice.' },
      { rule: 'Flag cash drawer variance', details: 'Logs a High-Risk warning if declared terminal float is +/- 2.00 USD off formula.' },
      { rule: 'Flag repeated failed staff logins', details: 'Alerts security if staff credentials fail 3 consecutive times in 10 minutes.' }
    ],
    'Stock Health': [
      { rule: 'Low stock reminder', details: 'Triggers system notice when inventory item falls below safety stock margins.' },
      { rule: 'Out of stock alert', details: 'Logs Critical-level alarm immediately when high-velocity parts fall to zero.' },
      { rule: 'Dead stock warning', details: 'Identifies inventory sitting over 90 days with zero sales. Highlights potential discount path.' },
      { rule: 'Slow moving item warning', details: 'Logs notification for parts with turnover cycles exceeding Bulawayo warehouse targets.' },
      { rule: 'Variance risk warning', details: 'Signals risk when warehouse counts deviate from theoretical receipt balances.' },
      { rule: 'Recommend major stocktake', details: 'Assembles stocktake instructions when audit counts flag repeated negative records.' }
    ],
    'Cash Control': [
      { rule: 'Variance requires supervisor review', details: 'Blocks cashiers from closing shift with unresolved drawer variance.' },
      { rule: 'Cash out requires authorization', details: 'Forces second operator PIN code verification for any payout or banking drop.' },
      { rule: 'Shift cannot close with unresolved variance', details: 'Restricts terminal unlock functions until supervisor logs override keys.' },
      { rule: 'Drawer movement must be logged', details: 'System records every mechanical solenoid open and links to Transaction ID.' }
    ],
    'Staff Behaviour': [
      { rule: 'Failed login monitoring', details: 'Performs lockouts and registers warning logs for out-of-branch logins.' },
      { rule: 'High override frequency', details: 'Identifies clerks whose override ratio exceeds 8% of total customer tickets.' },
      { rule: 'Frequent void/refund requests', details: 'Highlights clerks showing an outlying rate of voided tickets post-print.' },
      { rule: 'Terminal activity outside assigned branch', details: 'Signals cross-border or incorrect branch logins immediately.' }
    ],
    'Sales Integrity': [
      { rule: 'Block sale when stock is zero', details: 'Maintains catalog integrity; prevents arbitrary checkout of imaginary parts.' },
      { rule: 'Flag price deviations', details: 'Identifies margin leakage by monitoring products sold below specified distributor cost.' },
      { rule: 'Mandate supervisor PIN for custom quotes', details: 'Demands double signature keys for invoice prices adjusted manually on-screen.' },
      { rule: 'Flag frequent bulk discounts', details: 'Identifies large commercial orders processed without prior account registration.' }
    ],
    'Delivery Verification': [
      { rule: 'Delivery completion requires customer secret code', details: 'Enforces entering six-digit confirmation SMS code at the site of dispatch.' },
      { rule: 'Pending delivery code must be followed up', details: 'Generates warnings if driver dispatches are on-transit for more than 4 hours.' },
      { rule: 'Failed delivery confirmation is flagged', details: 'Alerts depot manager if customer rejects parts or code fails to authorize.' }
    ]
  };

  // Filter alerts by search term and severity
  const filteredAlerts = alertsTable.filter(row => {
    const matchesSearch = row.eventType.toLowerCase().includes(alertsSearch.toLowerCase()) ||
                          row.description.toLowerCase().includes(alertsSearch.toLowerCase()) ||
                          row.domain.toLowerCase().includes(alertsSearch.toLowerCase());
    
    const matchesSeverity = severityFilter === 'ALL' || row.severity.toLowerCase() === severityFilter.toLowerCase();
    
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12" id="bi-desk-root">
      
      {/* 1. PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI COGNITIVE REGISTRY</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <Sliders className="w-5 h-5 text-orange-500" />
            Rule-Based POS Intelligence Desk
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500 font-bold">
            <span className="flex items-center gap-1">
              <strong>Corporate Vendor:</strong> <span className="text-[#13151a] font-black">{vendorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Branch:</strong> <span className="bg-slate-100 text-[#13151a] px-1.5 py-0.2">{branchName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Terminal:</strong> <span className="text-[#13151a] font-extrabold">{terminalName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Current BI Mode:</strong> <span className="text-orange-600">Local Prototype Rules</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Last Evaluation:</strong> <span className="text-slate-800">Today (Real-time scan)</span>
            </span>
          </div>
        </div>

        {/* Current status tag */}
        <div className="flex items-center gap-2 px-4 py-2 border border-[#b1b5c2] bg-[#1e222b] text-white">
          <Radio className="w-4 h-4 text-orange-500 animate-pulse" />
          <div>
            <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider">Scout Engine status</span>
            <span className="text-[10px] font-black text-white uppercase">DETERMINISTIC ACTIVE</span>
          </div>
        </div>
      </div>

      {/* 2. BI SUMMARY PANELS (Square Metric Panels) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-4">
        
        {/* Metric 1 */}
        <div className={`p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2] ${criticalCount > 0 ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-[#1e222b]'}`}>
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Critical Alerts</span>
          <div className="mt-2 text-right">
            <span className={`text-base font-black block ${criticalCount > 0 ? 'text-red-500 animate-pulse' : 'text-[#1e222b]'}`}>{criticalCount}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">high hazard locks</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2] border-l-4 border-l-orange-500">
          <span className="text-[9px] text-orange-600 font-black uppercase tracking-wider block">High Risk Alerts</span>
          <div className="mt-2 text-right">
            <span className="text-base font-black text-orange-600 block">{highRiskCount}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">require supervisor pin</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Medium Alerts</span>
          <div className="mt-2 text-right">
            <span className="text-base font-black text-slate-800 block">{mediumCount}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">general audit anomalies</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Staff Risk Flags</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-800 block">{staffFlags}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">credential/override anomalies</span>
          </div>
        </div>

        {/* Metric 5 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Stock Risk Flags</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-[#1e222b] block">{stockFlags}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">shrinkage/out of stock</span>
          </div>
        </div>

        {/* Metric 6 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Cash Risk Flags</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-800 block">{cashFlags}</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">drawer drift counts</span>
          </div>
        </div>

        {/* Metric 7 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Spot Checks</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-800 block">{spotChecks} Recommended</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">bin recount tasks</span>
          </div>
        </div>

        {/* Metric 8 */}
        <div className="p-4 border bg-white flex flex-col justify-between h-[100px] border-[#b1b5c2]">
          <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Pending Reviews</span>
          <div className="mt-2 text-right">
            <span className="text-sm font-black text-slate-800 block">{supervisorReviews} Reviews</span>
            <span className="text-[8px] text-slate-400 font-bold uppercase block">supervisor ledger signs</span>
          </div>
        </div>

      </div>

      {/* THREE SECTION GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Rule Explanation and Rule Category Tabs (5 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* A. RULE EXPLANATION PANEL */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-orange-500" />
                How SCI BI Rules Work
              </span>
              <span className="text-[8px] bg-orange-650/20 border border-orange-500 text-orange-500 px-1.5 py-0.2 font-mono">DETERMINISTIC LOGIC</span>
            </div>

            <div className="space-y-3 font-sans text-[#111827] leading-relaxed">
              <p className="text-[11px]">
                The **BI Desk** evaluates POS logs against strict corporate rulesets rather than statistical models or unverified blackbox AI calculations:
              </p>
              
              <ul className="space-y-1.5 pl-4 list-disc text-[10.5px] text-slate-600 font-medium">
                <li>
                  <strong className="text-slate-900">Deterministic Reading:</strong> Automatically monitors physical and computational solenoids, float declarations, and terminal keystrokes.
                </li>
                <li>
                  <strong className="text-slate-900">Risk Assessment:</strong> Scans real-time triggers to isolate outliers in cash declarations, stock levels, system overrides, and delivery codes.
                </li>
                <li>
                  <strong className="text-slate-900">Local Customization:</strong> In production, parameters can be customized dynamically by branch administrators to prevent shrinkage.
                </li>
              </ul>

              <div className="bg-slate-100 p-2.5 border border-slate-200 mt-2 font-mono text-[9px] uppercase text-slate-500">
                <span>SYSTEM MODE: NO AUTOMATED TRAINING MODEL IN USE</span>
              </div>
            </div>
          </div>

          {/* B. BI RULE CATEGORIES TAB CONTAINER */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-orange-500" />
                BI Rule Categories
              </span>
              <span className="text-[8px] text-slate-400 font-mono">ACTIVE SCAN</span>
            </div>

            <p className="text-[10px] text-slate-400 font-medium pb-1.5 border-b border-slate-100">
              Select an operational threshold ruleset below to audit card indexes:
            </p>

            <div className="flex flex-col gap-1.5">
              {(Object.keys(rulesMap) as Array<keyof typeof rulesMap>).map(catName => {
                const isActive = activeTab === catName;
                return (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => setActiveTab(catName)}
                    className={`px-3 py-2.5 text-left text-[10.5px] font-bold uppercase transition-all flex justify-between items-center cursor-pointer ${
                      isActive 
                        ? 'bg-[#f97316] text-white border-l-4 border-l-black border border-orange-650' 
                        : 'bg-slate-50 text-[#1e222b] hover:bg-slate-100 border border-slate-250'
                    }`}
                  >
                    <span>{catName}</span>
                    <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>

            {/* Display list of Rule Cards for active category tab */}
            <div className="mt-4 pt-4 border-t border-slate-150 space-y-3">
              <span className="font-black text-[#1e222b] text-[9.5px] block uppercase tracking-wide">
                Active Rules ({activeTab}):
              </span>
              
              <div className="space-y-2.5">
                {rulesMap[activeTab].map((item, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 border border-slate-200">
                    <span className="font-black text-[#1e222b] uppercase text-[10px] block">{item.rule}</span>
                    <p className="text-[9.5px] text-slate-500 font-sans lowercase mt-0.5 leading-normal">
                      {item.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

        {/* Right Side: BI Alerts Table, Search filters, and BI Activity Logs (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* A. BI ALERTS TABLE */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-orange-500" />
                POS Compliance Alarm Ledger
              </span>
              <span className="text-[8px] bg-red-650/20 border border-red-500 text-red-500 px-1.5 py-0.2 font-mono">SEC_BUFFER</span>
            </div>

            {/* Combined Toolbar Filter */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-slate-50 p-2.5 border border-slate-200">
              
              <div className="relative w-full sm:w-auto flex-1">
                <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="SEARCH TRIGGERS, DOMAINS OR DESCRIPTIONS..."
                  className="w-full bg-white border border-[#b1b5c2] focus:border-orange-500 pl-8 pr-2.5 py-1.5 font-bold uppercase text-[9.5px]"
                  value={alertsSearch}
                  onChange={e => setAlertsSearch(e.target.value)}
                />
              </div>

              <div className="flex gap-2 items-center w-full sm:w-auto">
                <span className="text-[9.5px] font-black uppercase text-slate-500 shrink-0">Severity filter:</span>
                <select
                  value={severityFilter}
                  onChange={e => setSeverityFilter(e.target.value)}
                  className="bg-white border border-[#b1b5c2] px-2 py-1.5 text-[9.5px] font-bold cursor-pointer uppercase outline-none"
                >
                  <option value="ALL">All Severities</option>
                  <option value="Critical">Critical Only</option>
                  <option value="High">High Only</option>
                  <option value="Medium">Medium Only</option>
                </select>
              </div>

            </div>

            {/* The Main Alerts Table */}
            <div className="overflow-x-auto pos-custom-scroll">
              <table className="w-full text-left border-collapse text-[10px]">
                <thead>
                  <tr className="border-b border-[#b1b5c2] bg-slate-55/65 font-mono text-[8.5px] text-slate-500 uppercase tracking-wider font-extrabold">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Domain</th>
                    <th className="py-2.5 px-3 text-center">Risk Level</th>
                    <th className="py-2.5 px-3">Rule Trigger</th>
                    <th className="py-2.5 px-3">Incident Description</th>
                    <th className="py-2.5 px-3">Recommended Resolve Path</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Gate Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 font-mono text-[10.5px]">
                  {filteredAlerts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 font-bold uppercase">
                        No active matching compliance alerts in local memory buffer.
                      </td>
                    </tr>
                  ) : (
                    filteredAlerts.map(row => {
                      // Custom Risk Level Styling
                      let badgeColor = 'bg-slate-100 text-slate-600 border-slate-350';
                      if (row.severity === 'Critical') {
                        badgeColor = 'bg-red-100 text-red-800 border-red-300 font-extrabold';
                      } else if (row.severity === 'High') {
                        badgeColor = 'bg-orange-100 text-orange-850 border-orange-300 font-bold';
                      } else if (row.severity === 'Medium') {
                        badgeColor = 'bg-amber-100 text-[#1e222b] border-amber-300';
                      }

                      const isDone = row.status !== 'Open' && row.status !== 'Pending Approval';

                      return (
                        <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-extrabold text-slate-800">{row.eventType}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-bold uppercase text-[9px]">{row.domain}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-1.5 py-0.2 border rounded-none uppercase text-[8px] ${badgeColor}`}>
                              {row.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium lowercase font-sans max-w-[130px] truncate">{row.trigger}</td>
                          <td className="py-2.5 px-3 text-slate-800 font-semibold max-w-[170px] truncate">{row.description}</td>
                          <td className="py-2.5 px-3 text-slate-500 font-sans lowercase leading-relaxed max-w-[170px] truncate">{row.recommendedAction}</td>
                          
                          {/* Status Tag */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-1.5 py-0.2 border text-[8px] font-black uppercase ${
                              isDone 
                                ? 'bg-emerald-50 border-emerald-355 text-emerald-822' 
                                : 'bg-red-50 border-red-305 text-red-755 animate-pulse'
                            }`}>
                              {row.status}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="py-2.5 px-3 text-right">
                            {isDone ? (
                              <span className="text-[9px] text-slate-400 font-bold uppercase flex items-center justify-end gap-1">
                                <Check className="w-3 h-3 text-emerald-600" /> Done
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAlertAction(row.id, row.actionLabel)}
                                className="px-2.5 py-1 bg-[#1e222b] hover:bg-slate-850 hover:text-orange-500 text-white font-black text-[9px] uppercase rounded-none transition-colors cursor-pointer border border-[#1e222b] whitespace-nowrap"
                              >
                                {row.actionLabel}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* B. BI ACTIVITY RECENT LOGS */}
          <div className="bg-white border border-[#b1b5c2] p-5 space-y-4">
            
            <div className="bg-[#1e222b] p-3 -mx-5 -mt-5 text-white flex items-center justify-between border-b-2 border-slate-900 select-none">
              <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-orange-500" />
                Deductive Scanner Activity Feed
              </span>
              <span className="text-[8px] text-slate-400 font-mono">REACTIVE_NVRAM</span>
            </div>

            <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1 pos-custom-scroll">
              {activityFeed.map(feed => {
                let textCol = 'text-slate-600';
                let indicatorCol = 'bg-slate-400';

                if (feed.type === 'SUCCESS') {
                  textCol = 'text-emerald-700 font-bold';
                  indicatorCol = 'bg-emerald-500';
                } else if (feed.type === 'WARNING') {
                  textCol = 'text-red-700 font-black animate-pulse';
                  indicatorCol = 'bg-red-500';
                } else if (feed.type === 'ACTION') {
                  textCol = 'text-orange-700 font-bold';
                  indicatorCol = 'bg-orange-500';
                }

                return (
                  <div key={feed.id} className="p-2 border border-slate-200 bg-slate-50/50 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                    <span className="text-[8.5px] text-slate-400 font-mono pt-0.5 whitespace-nowrap">{feed.timestamp}</span>
                    <span className={`w-1.5 h-1.5 rounded-none mt-1 shrink-0 ${indicatorCol}`} />
                    <p className={`text-[10px] font-mono leading-normal select-text uppercase flex-1 ${textCol}`}>
                      {feed.message}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="bg-slate-100 p-2 border border-slate-250 flex justify-between items-center text-[8px] text-slate-500 font-mono uppercase select-none">
              <span>Memory Segment: ROM_INTELLIGENCE_BLOCK_22</span>
              <span>PARITY: REGISTER_OK</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
