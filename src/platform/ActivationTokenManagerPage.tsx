import { useState, useEffect } from 'react';
import {
  listActivationTokens,
  issueActivationToken,
  revokeActivationToken,
  listTokenEligibleVendors,
  listTokenEligiblePlans,
  getVendorForToken
} from './activationTokenConsoleService';
import type {
  ActivationTokenRecord,
  PlanCode
} from '../shared/backend';
import {
  Layers,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
  Database,
  CheckCircle,
  XCircle,
  Copy,
  MessageCircle,
  Compass,
  AlertTriangle,
  Users,
  Search,
  Plus,
  Trash2,
  Trash
} from 'lucide-react';

export default function ActivationTokenManagerPage() {
  const [tokens, setTokens] = useState<ActivationTokenRecord[]>([]);
  const [eligibleVendors, setEligibleVendors] = useState<{ vendorId: string; vendorName: string }[]>([]);
  const [eligiblePlans, setEligiblePlans] = useState<PlanCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errMessage, setErrMessage] = useState<string | null>(null);

  // Form states
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('STANDARD');
  const [expiryDays, setExpiryDays] = useState(30);
  const [note, setNote] = useState('');
  const [adminName, setAdminName] = useState('Console Admin');
  const [isIssuing, setIsIssuing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'All' | 'Unused' | 'Used' | 'Expired' | 'Revoked'>('All');
  const [vendorSearch, setVendorSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'All' | PlanCode>('All');

  const fetchTokensData = async () => {
    setIsLoading(true);
    setErrMessage(null);
    try {
      const allTokens = await listActivationTokens();
      setTokens(allTokens);

      try {
        const [vendors, plans] = await Promise.all([
          listTokenEligibleVendors(),
          listTokenEligiblePlans()
        ]);
        setEligibleVendors(vendors);
        if (vendors.length > 0) {
          setSelectedVendorId(vendors[0].vendorId);
        }
        setEligiblePlans(plans);
      } catch (childErr) {
        console.warn('Failed to load eligible lists:', childErr);
      }
    } catch (err) {
      console.error(err);
      setErrMessage("Activation tokens manager is unavailable. Check Firebase connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokensData();
  }, []);

  const handleIssueToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      alert("Please select a vendor.");
      return;
    }
    setIsIssuing(true);
    try {
      await issueActivationToken(selectedVendorId, selectedPlan, expiryDays, adminName, note || undefined);
      setNote('');
      await fetchTokensData();
      alert("Activation token issued successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to issue token.');
    } finally {
      setIsIssuing(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this activation code? This action is permanent.")) return;
    try {
      await revokeActivationToken(tokenId, adminName);
      await fetchTokensData();
      alert("Activation token revoked successfully!");
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke token.');
    }
  };

  const getEffectiveStatus = (token: ActivationTokenRecord): string => {
    if (token.status === 'Unused') {
      const now = new Date().toISOString();
      if (token.expiresAt && token.expiresAt < now) {
        return 'Expired';
      }
    }
    return token.status;
  };

  const buildWhatsAppMessageText = (token: ActivationTokenRecord): string => {
    const expiryDateStr = token.expiresAt 
      ? new Date(token.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' }) 
      : 'N/A';
    return `Your iTredPOS activation code is ${token.tokenCode}. Open iTredPOS → Settings → Subscription → Enter Activation Code. Plan: ${token.planCode}. Expires: ${expiryDateStr}.`;
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert(`Copied activation code to clipboard: ${code}`);
    } catch {
      alert("Failed to copy code to clipboard.");
    }
  };

  const handleCopyWhatsAppMsg = async (token: ActivationTokenRecord) => {
    const text = buildWhatsAppMessageText(token);
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied WhatsApp message text to clipboard!");
    } catch {
      alert("Failed to copy message text.");
    }
  };

  const handleOpenWhatsApp = async (token: ActivationTokenRecord) => {
    const textMessage = buildWhatsAppMessageText(token);
    const vendorDetails = await getVendorForToken(token.vendorId);
    const rawNumber = vendorDetails?.whatsapp || vendorDetails?.phone || '';
    const cleanNumber = rawNumber.replace(/[\s\+\(\)-]+/g, '');

    if (!cleanNumber) {
      alert("Vendor WhatsApp number is missing.");
      return;
    }

    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(textMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Filter token list
  const getFilteredTokens = () => {
    return tokens.filter(token => {
      const effectiveStatus = getEffectiveStatus(token);

      // Status Filter
      if (statusFilter !== 'All' && effectiveStatus !== statusFilter) {
        return false;
      }

      // Plan Filter
      if (planFilter !== 'All' && token.planCode !== planFilter) {
        return false;
      }

      // Search Query
      if (vendorSearch.trim()) {
        const queryStr = vendorSearch.toLowerCase().trim();
        const matchesId = token.vendorId.toLowerCase().includes(queryStr);
        const matchesName = (token.vendorName || '').toLowerCase().includes(queryStr);
        const matchesCode = token.tokenCode.toLowerCase().includes(queryStr);
        if (!matchesId && !matchesName && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredTokens = getFilteredTokens();

  // Custom route navigation matching App.tsx
  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-800 antialiased pb-12">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white p-6 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigateTo('/platform/firebase-readiness')}
              className="p-2 bg-slate-800/80 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700/50"
              title="Back to Platform Readiness"
            >
              <ArrowLeft className="w-5 h-5 text-slate-300" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[9px] bg-orange-600 text-white rounded font-bold uppercase tracking-wider">Console</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Activation Center</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-wide uppercase mt-1">
                Activation Token Manager
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <label className="text-[10px] font-bold text-slate-400 uppercase mr-1">Admin:</label>
              <input
                type="text"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
                className="bg-transparent text-sm text-white font-bold outline-none border-b border-transparent focus:border-orange-500 w-32"
              />
            </div>

            <button
              onClick={fetchTokensData}
              className="bg-slate-800 hover:bg-slate-750 text-white border border-slate-755 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all active:scale-[0.98]"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Sub navigation bar */}
      <div className="bg-white border-b border-gray-200 py-3 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
            <Compass className="w-4 h-4 text-gray-400" />
            Console Modules:
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigateTo('/platform/vendor-verification')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Vendor Verification Queue
            </button>
            <button
              onClick={() => navigateTo('/platform/pricing-plans')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Pricing Plans Manager
            </button>
            <button
              onClick={() => navigateTo('/platform/firebase-readiness')}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 rounded-lg text-xs font-bold uppercase transition-colors"
            >
              Platform Readiness
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Issue Token Form */}
        <div className="lg:col-span-4 bg-white border border-gray-150 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-gray-100 pb-3">
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block">Core Operations</span>
            <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider mt-1 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-orange-500" />
              Issue New Token Code
            </h2>
          </div>

          {eligibleVendors.length === 0 ? (
            <div className="p-4 bg-amber-50 text-amber-700 text-xs rounded-xl font-medium border border-amber-250">
              No registered vendor accounts available for token assignment. Verify registrations first.
            </div>
          ) : (
            <form onSubmit={handleIssueToken} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Target Vendor Business:</label>
                <select
                  value={selectedVendorId}
                  onChange={e => setSelectedVendorId(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500"
                >
                  {eligibleVendors.map(vendor => (
                    <option key={vendor.vendorId} value={vendor.vendorId}>
                      {vendor.vendorName} ({vendor.vendorId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Plan Assignment:</label>
                <div className="grid grid-cols-2 gap-2">
                  {eligiblePlans.map(plan => (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => setSelectedPlan(plan)}
                      className={`py-2 px-3 text-[10px] font-black uppercase rounded-lg border text-center transition-all cursor-pointer ${
                        selectedPlan === plan
                          ? 'bg-orange-100 border-orange-200 text-orange-850'
                          : 'bg-white border-gray-300 text-gray-600 hover:border-orange-400'
                      }`}
                    >
                      {plan}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Expiry Days Duration:</label>
                <select
                  value={expiryDays}
                  onChange={e => setExpiryDays(Number(e.target.value))}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500"
                >
                  <option value={7}>7 Days (Short Trial)</option>
                  <option value={15}>15 Days</option>
                  <option value={30}>30 Days (Standard)</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>365 Days (Annual)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">Administrative Note:</label>
                <textarea
                  placeholder="E.g., Special promotion trial code or invoice reference"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500 h-20 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isIssuing}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-black text-xs uppercase py-3 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                {isIssuing ? 'Generating Token...' : 'Generate Code'}
              </button>
            </form>
          )}
        </div>

        {/* Right Column: Tokens List */}
        <div className="lg:col-span-8 space-y-6">
          {/* Filters Card */}
          <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendor or code..."
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500"
              />
            </div>

            {/* Status dropdown */}
            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500"
              >
                <option value="All">Filter Status (All)</option>
                <option value="Unused">Unused Only</option>
                <option value="Used">Used Only</option>
                <option value="Expired">Expired Only</option>
                <option value="Revoked">Revoked Only</option>
              </select>
            </div>

            {/* Plan filter dropdown */}
            <div>
              <select
                value={planFilter}
                onChange={e => setPlanFilter(e.target.value as any)}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-800 outline-none focus:border-orange-500"
              >
                <option value="All">Filter Plan (All)</option>
                <option value="STARTER">Starter</option>
                <option value="STANDARD">Standard</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
          </div>

          {errMessage ? (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-xl p-6 shadow-sm flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
              <div>
                <h3 className="font-extrabold text-red-900 uppercase text-sm tracking-wider">Access Blocked</h3>
                <p className="text-sm text-red-700 font-semibold mt-1">{errMessage}</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
              <p className="text-sm text-gray-500 font-bold uppercase tracking-wider">Loading token records...</p>
            </div>
          ) : filteredTokens.length === 0 ? (
            <div className="bg-white border border-gray-150 rounded-2xl py-16 px-6 text-center shadow-sm">
              <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="font-black text-gray-700 uppercase text-sm tracking-wider">No Tokens Registered</h3>
              <p className="text-sm text-gray-400 mt-1">There are no token codes found matching the filter selection.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTokens.map(token => {
                const status = getEffectiveStatus(token);

                return (
                  <div key={token.tokenId} className="bg-white rounded-2xl border border-gray-150 shadow-[0_4px_20px_rgb(0,0,0,0.015)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] transition-all p-6 space-y-4">
                    <div className="flex flex-wrap justify-between items-start gap-4 border-b border-gray-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-gray-800 tracking-wide font-mono">
                            {token.tokenCode}
                          </h3>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                            status === 'Used'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : status === 'Unused'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : status === 'Expired'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {status}
                          </span>
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-black text-[9px] uppercase tracking-wider">
                            {token.planCode}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold mt-1 uppercase">
                          Vendor: <span className="text-gray-800 font-black">{token.vendorName || token.vendorId}</span>
                        </p>
                      </div>

                      {status === 'Unused' && (
                        <button
                          onClick={() => handleRevokeToken(token.tokenId)}
                          className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-150 p-2 rounded-lg transition-colors cursor-pointer"
                          title="Revoke Token Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Metadata dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold text-gray-500">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Issued At</span>
                        <span className="text-gray-800">
                          {new Date(token.issuedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase block">Expires At</span>
                        <span className="text-gray-800">
                          {new Date(token.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      {token.usedAt && (
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase block">Used At</span>
                          <span className="text-blue-800">
                            {new Date(token.usedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {(token as any).note && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2.5 border border-gray-150 rounded-lg">
                        <span className="text-[9px] text-gray-450 font-bold uppercase block mb-0.5">Admin Note</span>
                        {(token as any).note}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      <button
                        onClick={() => handleCopyCode(token.tokenCode)}
                        className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        Copy Code
                      </button>

                      <button
                        onClick={() => handleCopyWhatsAppMsg(token)}
                        className="bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-700 font-bold text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-gray-500" />
                        Copy Message
                      </button>

                      <button
                        onClick={() => handleOpenWhatsApp(token)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-white" />
                        Send WhatsApp
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
