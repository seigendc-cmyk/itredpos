import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Shield, 
  UserCheck, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Send, 
  User, 
  Plus, 
  Phone, 
  MapPin, 
  MessageSquare,
  Key,
  Database
} from 'lucide-react';
import { PosSession, DeliveryOrder, DeliveryPerson, WalkInCollection, DeliveryEvent, DeliveryFailureReason, VehicleType, DeliveryStatus, DeliveryMethod } from '../types/posTypes';
import { 
  getDeliveryOrders, 
  getDeliveryPersons, 
  getWalkInCollections, 
  getDeliveryEvents,
  assignDelivery,
  generateDeliveryCode,
  updateCodeStatus,
  verifyDeliveryCode,
  markDeliveryFailed,
  generateCollectionCode,
  verifyCollectionCode
} from '../services/deliveryService';
import { addLocalQueueItem } from '../utils/localQueueStore';

interface PosDeliveryDeskProps {
  session?: PosSession;
}

export default function PosDeliveryDesk({ session }: PosDeliveryDeskProps) {
  const activeBranch = session?.branch || 'Harare Main';
  const staffName = session?.staffName || 'Admin Operator';
  const vendorName = session?.vendor || 'SCI Logistics Ltd';
  const terminalName = session?.terminal || 'Term-A';

  // Core component states
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<DeliveryPerson[]>([]);
  const [collections, setCollections] = useState<WalkInCollection[]>([]);
  const [events, setEvents] = useState<DeliveryEvent[]>([]);

  // Search/Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selected Delivery for action
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Active form state for tabs inside the Action Console
  const [activeActionTab, setActiveActionTab] = useState<'assign' | 'verify' | 'collect' | 'fail' | 'driver'>('assign');

  // Feedback notifications
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  // --- FORM STATES ---
  // Assignment Form State
  const [assignForm, setAssignForm] = useState({
    id: '',
    receiptNumber: '',
    customerName: '',
    customerWhatsApp: '',
    deliveryAddress: '',
    district: 'Harare CBD',
    suburb: 'CBD',
    deliveryMethod: 'Vendor Delivery' as DeliveryMethod,
    deliveryPersonId: 'DRV-001',
    vehicleType: 'Bike' as VehicleType,
    vehicleRegistration: 'ACD-1234',
    driverPhone: '+263776000001',
    deliveryCharge: 5,
    notes: ''
  });

  // Code Verification Form State
  const [verifyForm, setVerifyForm] = useState({
    deliveryId: '',
    code: '',
    recipientName: '',
    deliveryNote: ''
  });

  // Walk-in Collection Form State
  const [collectForm, setCollectForm] = useState({
    receiptNumber: '',
    customerName: '',
    customerWhatsApp: '',
    code: '',
    collectedBy: '',
    notes: ''
  });

  // Failure Form State
  const [failureForm, setFailureForm] = useState({
    deliveryId: '',
    failedReason: 'Customer unavailable' as DeliveryFailureReason,
    nextAction: 'Retry Delivery',
    notes: ''
  });

  // Register Driver Form State
  const [newDriverForm, setNewDriverForm] = useState({
    name: '',
    phone: '',
    vehicleType: 'Bike' as VehicleType,
    vehicleRegistration: '',
    licenceNumber: '',
    nationalIdPlaceholder: '',
    serviceArea: '',
    status: 'Active' as const
  });

  // Load all local storage or mock values initially
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const o = await getDeliveryOrders();
      const d = await getDeliveryPersons();
      const c = await getWalkInCollections();
      const ev = await getDeliveryEvents();
      
      setOrders(o);
      setDrivers(d);
      setCollections(c);
      setEvents(ev);
    } catch (err) {
      console.error('Error loading delivery desk state:', err);
    }
  };

  const showFeedback = (type: 'success' | 'warning' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 6000);
  };

  // Populate driver fields in assignment form when a driver option is picked
  const handleDriverSelectChange = (driverId: string) => {
    const selectedDriver = drivers.find(d => d.driverId === driverId);
    if (selectedDriver) {
      setAssignForm(prev => ({
        ...prev,
        deliveryPersonId: driverId,
        vehicleType: selectedDriver.vehicleType,
        vehicleRegistration: selectedDriver.vehicleRegistration,
        driverPhone: selectedDriver.phone
      }));
    }
  };

  // --- ACTIONS ---

  // Handle Order Assignment
  const handleAssignDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.receiptNumber || !assignForm.customerName || !assignForm.deliveryAddress) {
      showFeedback('error', 'Please enter receipt number, customer name and delivery address.');
      return;
    }

    try {
      const nextId = assignForm.id || 'DEL-00' + (orders.length + 1);
      const updated = await assignDelivery({
        ...assignForm,
        id: nextId,
        operator: staffName
      });

      showFeedback('success', `Delivery ${nextId} successfully assigned to ${drivers.find(d => d.driverId === assignForm.deliveryPersonId)?.name || 'driver'}.`);
      
      // Clear or Reset Form
      setAssignForm({
        id: '',
        receiptNumber: '',
        customerName: '',
        customerWhatsApp: '',
        deliveryAddress: '',
        district: 'Harare CBD',
        suburb: 'CBD',
        deliveryMethod: 'Vendor Delivery',
        deliveryPersonId: 'DRV-001',
        vehicleType: 'Bike',
        vehicleRegistration: 'ACD-1234',
        driverPhone: '+263776000001',
        deliveryCharge: 5,
        notes: ''
      });
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Delivery assignment failed.');
    }
  };

  // Generate Customer Secret Code
  const handleGenerateSecretCode = async (deliveryId: string) => {
    if (!deliveryId) {
      showFeedback('error', 'Select a delivery order first.');
      return;
    }

    try {
      const code = await generateDeliveryCode(deliveryId, staffName);
      showFeedback('success', `Customer secret code generated (${code}). In production this will be sent by WhatsApp/SMS.`);
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Failed to generate customer code.');
    }
  };

  // Send WhatsApp Code Placeholder
  const handleSendWhatsAppPlaceholder = async (deliveryId: string) => {
    try {
      await updateCodeStatus(deliveryId, 'Code Sent', staffName);
      showFeedback('success', 'WhatsApp code message placeholder processed and simulated successfully.');
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Failed to send code message.');
    }
  };

  // Verify and Complete Delivery
  const handleVerifyCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyForm.deliveryId || !verifyForm.code) {
      showFeedback('error', 'Ensure Delivery ID and Customer Secret Code are entered.');
      return;
    }

    try {
      const res = await verifyDeliveryCode({
        ...verifyForm,
        operator: staffName
      });

      if (res.success) {
        showFeedback('success', res.message);
        addLocalQueueItem({
          domain: 'Delivery',
          eventType: 'DELIVERY_COMPLETED',
          reference: verifyForm.deliveryId,
          createdBy: staffName,
          risk: 'Low',
          payload: JSON.stringify({
            deliveryId: verifyForm.deliveryId,
            code: verifyForm.code,
            recipientName: verifyForm.recipientName,
            note: verifyForm.deliveryNote
          })
        });
        setVerifyForm({ deliveryId: '', code: '', recipientName: '', deliveryNote: '' });
        loadAllData();
      } else {
        showFeedback('warning', res.message);
        loadAllData();
      }
    } catch (err) {
      showFeedback('error', 'Code verification error.');
    }
  };

  // Walk-In Collection Code Generator
  const handleGenerateCollectionCodeBtn = async (receiptNum: string) => {
    if (!receiptNum) {
      showFeedback('error', 'Please enter a valid receipt number.');
      return;
    }
    try {
      const code = await generateCollectionCode(receiptNum, staffName);
      setCollectForm(prev => ({ ...prev, receiptNumber: receiptNum, code }));
      showFeedback('success', `Walk-in collection code generated: ${code}. Sent to customer's terminal device.`);
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Could not generate collection code.');
    }
  };

  // Confirm Walk-in Collection
  const handleConfirmCollectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectForm.receiptNumber || !collectForm.code) {
      showFeedback('error', 'Receipt Number and Collection Code are required.');
      return;
    }

    try {
      const res = await verifyCollectionCode({
        receiptNumber: collectForm.receiptNumber,
        code: collectForm.code,
        collectedBy: collectForm.collectedBy || collectForm.customerName || 'Customer Self',
        notes: collectForm.notes || 'Walk-in collection verified.',
        operator: staffName
      });

      if (res.success) {
        showFeedback('success', res.message);
        setCollectForm({ receiptNumber: '', customerName: '', customerWhatsApp: '', code: '', collectedBy: '', notes: '' });
        loadAllData();
      } else {
        showFeedback('warning', res.message);
        loadAllData();
      }
    } catch (err) {
      showFeedback('error', 'Collection processing error.');
    }
  };

  // Fail Delivery Mark Submit
  const handleFailDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failureForm.deliveryId || !failureForm.failedReason) {
      showFeedback('error', 'Provide Delivery ID and Failure Reason.');
      return;
    }

    try {
      await markDeliveryFailed({
        ...failureForm,
        operator: staffName
      });

      showFeedback('success', `Delivery ${failureForm.deliveryId} is marked failed (Next Step: ${failureForm.nextAction}).`);
      setFailureForm({ deliveryId: '', failedReason: 'Customer unavailable', nextAction: 'Retry Delivery', notes: '' });
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Error logging failure.');
    }
  };

  // Add New Driver Submit
  const handleRegisterDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverForm.name || !newDriverForm.phone) {
      showFeedback('error', 'Please fill in Name and Phone number for the driver.');
      return;
    }

    try {
      const currentDrivers = await getDeliveryPersons();
      const newD: DeliveryPerson = {
        driverId: 'DRV-00' + (currentDrivers.length + 1),
        ...newDriverForm
      };
      
      const updated = [newD, ...currentDrivers];
      localStorage.setItem('sci_pos_delivery_persons', JSON.stringify(updated));
      showFeedback('success', `New driver ${newDriverForm.name} successfully registered.`);
      setNewDriverForm({
        name: '',
        phone: '',
        vehicleType: 'Bike',
        vehicleRegistration: '',
        licenceNumber: '',
        nationalIdPlaceholder: '',
        serviceArea: '',
        status: 'Active'
      });
      loadAllData();
    } catch (err) {
      showFeedback('error', 'Driver registration error.');
    }
  };

  // Quick Action: Fill assignment form fields from delivery slot
  const selectOrderAndFillForm = (order: DeliveryOrder) => {
    setSelectedOrderId(order.id);
    
    // Fill active forms based on current state or action clicked
    setAssignForm({
      id: order.id,
      receiptNumber: order.receiptNumber,
      customerName: order.customerName,
      customerWhatsApp: order.customerWhatsApp,
      deliveryAddress: order.deliveryAddress,
      district: order.district || 'Harare CBD',
      suburb: order.suburb || 'CBD',
      deliveryMethod: order.deliveryMethod || 'Vendor Delivery',
      deliveryPersonId: order.deliveryPersonId || 'DRV-001',
      vehicleType: order.vehicleType || 'Bike',
      vehicleRegistration: order.vehicleRegistration || 'ACD-1234',
      driverPhone: order.driverPhone || '+263776000001',
      deliveryCharge: order.deliveryCharge || 5,
      notes: order.notes || ''
    });

    setVerifyForm(prev => ({
      ...prev,
      deliveryId: order.id,
      recipientName: order.customerName
    }));

    setCollectForm(prev => ({
      ...prev,
      receiptNumber: order.receiptNumber,
      customerName: order.customerName,
      customerWhatsApp: order.customerWhatsApp,
      code: order.secretCode || ''
    }));

    setFailureForm({
      deliveryId: order.id,
      failedReason: 'Customer unavailable',
      nextAction: 'Retry Delivery',
      notes: order.notes || ''
    });
  };

  // --- DYNAMIC METRIC CALCULATIONS ---
  const pendingCount = orders.filter(o => o.status === 'Pending Assignment').length;
  const assignedCount = orders.filter(o => o.status === 'Assigned').length;
  const outForDeliveryCount = orders.filter(o => o.status === 'Out for Delivery').length;
  const completedTodayCount = orders.filter(o => o.status === 'Completed').length;
  const failedCount = orders.filter(o => o.status === 'Failed').length;
  const codePendingCount = orders.filter(o => o.codeStatus === 'Code Pending' || o.codeStatus === 'Code Generated').length;
  const collectionCount = orders.filter(o => o.deliveryMethod === 'Customer Collection').length;
  
  // Risk triggers: failed code attempts or failed deliveries or unassigned critical orders
  const riskCount = orders.filter(o => o.status === 'Failed' || o.codeStatus === 'Not Generated').length;

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerWhatsApp.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'ALL') return matchesSearch;
    return o.status === statusFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 font-mono text-xs text-[#111827] select-none pb-12">
      
      {/* PART 2: PAGE HEADER */}
      <div className="bg-white border-2 border-[#b1b5c2] p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-[9px] font-black text-orange-600 uppercase tracking-widest">SCI COURIER LOGISTICS CHANNEL</div>
          <h1 className="text-sm font-black text-[#1e222b] uppercase flex items-center gap-2 mt-1">
            <Truck className="w-5 h-5 text-orange-500" />
            Delivery Desk & Customer Secret Code Verification
          </h1>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1">
              <strong>Tenant Vendor:</strong> <span className="bg-slate-100 text-[#1e222b] font-bold px-1.5 py-0.2">{vendorName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Branch Node:</strong> <span className="text-[#1e222b] font-bold">{activeBranch}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Terminal:</strong> <span className="bg-orange-100 text-[#1e222b] font-bold px-1">{terminalName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Active Clerk:</strong> <span className="text-emerald-600 font-bold">{staffName}</span>
            </span>
            <span className="flex items-center gap-1">
              <strong>Operating Mode:</strong> <span className="bg-blue-50 text-blue-700 font-bold px-1">Local Prototype</span>
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-l-4 border-l-emerald-500 border border-[#b1b5c2]">
          <Shield className="w-4 h-4 text-emerald-600 animate-pulse" />
          <div>
            <span className="text-[8px] text-slate-500 font-bold block uppercase tracking-wider">Gate Authentication</span>
            <span className="text-[10px] font-black text-emerald-700 uppercase">Secure Code Layer Active</span>
          </div>
        </div>
      </div>

      {/* FEEDBACK STATUS NOTIFICATION */}
      {feedback && (
        <div className={`p-4 border-l-4 rounded-none h-auto flex items-start gap-3 transition-all duration-300 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-l-emerald-600 border border-[#b1b5c2] text-emerald-800' 
            : feedback.type === 'warning' 
            ? 'bg-amber-50 border-l-amber-500 border border-[#b1b5c2] text-amber-800'
            : 'bg-rose-50 border-l-rose-600 border border-[#b1b5c2] text-rose-800'
        }`}>
          {feedback.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {feedback.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
          {feedback.type === 'error' && <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
          <div>
            <span className="font-extrabold uppercase text-[10px] block mb-1">
              System Response Alert ({feedback.type})
            </span>
            <p className="text-xs font-semibold leading-relaxed">{feedback.message}</p>
          </div>
        </div>
      )}

      {/* PART 3: STATIC DELIVERY SUMMARY PANELS */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Pending Deliveries', count: pendingCount, desc: 'Awaiting assignment', color: 'border-l-blue-500 bg-blue-50/25' },
          { label: 'Assigned Deliveries', count: assignedCount, desc: 'Driver booked', color: 'border-l-amber-500 bg-amber-50/25' },
          { label: 'Out for Delivery', count: outForDeliveryCount, desc: 'In physical transit', color: 'border-l-purple-500 bg-purple-50/25' },
          { label: 'Completed Today', count: completedTodayCount, desc: 'Verified by signature/code', color: 'border-l-emerald-600 bg-emerald-50/25' },
          { label: 'Failed Deliveries', count: failedCount, desc: 'Require supervisor follow-up', color: 'border-l-rose-600 bg-rose-50/25' },
          { label: 'Code Pending', count: codePendingCount, desc: 'Generated but unconfirmed', color: 'border-l-orange-500 bg-orange-50/25' },
          { label: 'Walk-In Collections', count: collectionCount, desc: 'Customer collecting', color: 'border-l-teal-600 bg-teal-50/25' },
          { label: 'Delivery Risk Flags', count: riskCount, desc: 'Failed code audits', color: 'border-l-red-600 bg-red-50/25 font-bold text-rose-700' }
        ].map((met) => (
          <div key={met.label} className={`bg-white border border-[#b1b5c2] border-l-4 ${met.color} p-3 flex flex-col justify-between h-[85px]`}>
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tight leading-tight block truncate" title={met.label}>
              {met.label}
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-black text-[#1e222b] mt-1">{met.count}</span>
              <span className="text-[7.5px] text-slate-400 font-semibold uppercase">DRV-NODE</span>
            </div>
            <span className="text-[8px] text-slate-400 truncate leading-none block">{met.desc}</span>
          </div>
        ))}
      </div>

      {/* MAIN LAYOUT SPLIT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: CONTROL CONSOLE, ORDERS, DRIVERS (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* ACTIVE ACTION CONTROL CONSOLE BLOCK */}
          <div className="bg-white border-2 border-[#b1b5c2] p-0 shadow-sm">
            <div className="bg-[#1e222b] text-white p-3 font-extrabold flex items-center justify-between">
              <span className="uppercase text-[10px] tracking-widest flex items-center gap-2">
                <Database className="w-4 h-4 text-orange-500 animate-pulse" />
                CENTRAL COURIER EXECUTION DESK
              </span>
              <span className="text-[8px] bg-orange-600 text-white px-2 py-0.5 text-right font-black">
                ACTIVE PORT: 3000
              </span>
            </div>

            {/* TAB SELECTORS */}
            <div className="flex border-b border-[#b1b5c2] bg-slate-100 select-none">
              {[
                { id: 'assign', label: 'Assign Driver (1)', icon: UserCheck },
                { id: 'verify', label: 'Verify Code (2)', icon: Key },
                { id: 'collect', label: 'Walk-In Collection (3)', icon: User },
                { id: 'fail', label: 'Log Failure (4)', icon: AlertTriangle },
                { id: 'driver', label: 'Register Driver (5)', icon: Plus }
              ].map((tab) => {
                const isActive = activeActionTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveActionTab(tab.id as any)}
                    className={`flex-1 py-3 px-2 border-r border-[#b1b5c2] text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all text-center rounded-none cursor-pointer hover:bg-slate-200 ${
                      isActive 
                        ? 'bg-white border-b-2 border-b-orange-600 text-[#1e222b]' 
                        : 'text-slate-500 bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-orange-500' : 'text-slate-400'}`} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT PANELS */}
            <div className="p-5">
              
              {/* PART 5 & 6: DELIVERY ASSIGNMENT FORM */}
              {activeActionTab === 'assign' && (
                <form onSubmit={handleAssignDeliverySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Receipt Number</label>
                      <input 
                        type="text" 
                        value={assignForm.receiptNumber} 
                        onChange={(e) => setAssignForm({ ...assignForm, receiptNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] uppercase"
                        placeholder="RCT-0006"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer Name</label>
                      <input 
                        type="text" 
                        value={assignForm.customerName} 
                        onChange={(e) => setAssignForm({ ...assignForm, customerName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Memory Chikore"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp Phone</label>
                      <input 
                        type="text" 
                        value={assignForm.customerWhatsApp} 
                        onChange={(e) => setAssignForm({ ...assignForm, customerWhatsApp: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="+263774000004"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Destination Address</label>
                      <input 
                        type="text" 
                        value={assignForm.deliveryAddress} 
                        onChange={(e) => setAssignForm({ ...assignForm, deliveryAddress: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Unit L, Chitungwiza"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Charge ($)</label>
                      <input 
                        type="number" 
                        value={assignForm.deliveryCharge} 
                        onChange={(e) => setAssignForm({ ...assignForm, deliveryCharge: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">District</label>
                      <input 
                        type="text" 
                        value={assignForm.district} 
                        onChange={(e) => setAssignForm({ ...assignForm, district: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Chitungwiza"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Suburb</label>
                      <input 
                        type="text" 
                        value={assignForm.suburb} 
                        onChange={(e) => setAssignForm({ ...assignForm, suburb: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Seke"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Method</label>
                      <select 
                        value={assignForm.deliveryMethod} 
                        onChange={(e) => setAssignForm({ ...assignForm, deliveryMethod: e.target.value as DeliveryMethod })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] uppercase"
                      >
                        <option value="Vendor Delivery">Vendor Delivery</option>
                        <option value="External Delivery">External Delivery</option>
                        <option value="Customer Collection">Customer Collection</option>
                        <option value="Courier Placeholder">Courier Placeholder</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-[#b1b5c2] space-y-3">
                    <h3 className="text-[10px] font-black text-[#1e222b] uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-orange-500" />
                      PHYSICAL DRIVER SEED & TEAMS
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Delivery Driver</label>
                        <select 
                          value={assignForm.deliveryPersonId} 
                          onChange={(e) => handleDriverSelectChange(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-[#b1b5c2] text-[11px] text-[#1e222b]"
                        >
                          {drivers.map(d => (
                            <option key={d.driverId} value={d.driverId}>{d.name} ({d.status})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Vehicle Type</label>
                        <select 
                          value={assignForm.vehicleType} 
                          onChange={(e) => setAssignForm({ ...assignForm, vehicleType: e.target.value as VehicleType })}
                          className="w-full px-2 py-1.5 bg-white border border-[#b1b5c2] text-[11px] text-[#1e222b]"
                        >
                          <option value="Bike">Bike</option>
                          <option value="Car">Car</option>
                          <option value="Kombi">Kombi</option>
                          <option value="Lorry">Lorry</option>
                          <option value="Walking Courier">Walking Courier</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Vehicle Plate</label>
                        <input 
                          type="text" 
                          value={assignForm.vehicleRegistration} 
                          onChange={(e) => setAssignForm({ ...assignForm, vehicleRegistration: e.target.value })}
                          className="w-full px-2 py-1 bg-white border border-[#b1b5c2] text-[11px] text-[#1e222b] uppercase"
                          placeholder="ABC-1234"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Driver Phone</label>
                        <input 
                          type="text" 
                          value={assignForm.driverPhone} 
                          onChange={(e) => setAssignForm({ ...assignForm, driverPhone: e.target.value })}
                          className="w-full px-2 py-1 bg-white border border-[#b1b5c2] text-[11px] text-[#1e222b]"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Dispatch Notes</label>
                    <textarea 
                      value={assignForm.notes} 
                      onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] h-12 resize-none"
                      placeholder="Add dispatch priority, parcel dimensions, packaging info..."
                    />
                  </div>

                  {assignForm.id && (
                    <div className="bg-amber-100 border border-amber-300 p-2 text-[9px] text-[#1e222b] font-bold flex items-center justify-between">
                      <span>EDITING MODE: Updating active delivery order [{assignForm.id}].</span>
                      <button 
                        type="button" 
                        onClick={() => setAssignForm(prev => ({ ...prev, id: '' }))}
                        className="text-amber-700 underline"
                      >
                        Reset to Register New
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5 text-white" />
                      {assignForm.id ? 'Save & Update Dispatch' : 'Assign Delivery Order'}
                    </button>

                    {assignForm.id && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleGenerateSecretCode(assignForm.id)}
                          className="px-4 py-2 bg-[#1e222b] hover:bg-zinc-800 text-orange-400 font-bold uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1 border border-orange-500/20"
                        >
                          <Key className="w-3.5 h-3.5 text-orange-400" />
                          Generate Customer Code
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendWhatsAppPlaceholder(assignForm.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-white" />
                          Send WhatsApp Code Placeholder
                        </button>
                      </>
                    )}
                  </div>
                </form>
              )}

              {/* PART 7: DELIVERY COMPLETION BY CODE */}
              {activeActionTab === 'verify' && (
                <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
                  <div className="p-3 bg-amber-500/10 border border-orange-300/40 text-[9.5px] leading-relaxed text-amber-950 font-semibold mb-2">
                    <strong>SECURITY INSTRUCTION:</strong> Do not release physical goods to carriers or external drivers until the Customer provides their unique 6-digit WhatsApp secret confirmation code. Entering the code will securely close the sale cycle.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery ID (Reference)</label>
                      <select 
                        value={verifyForm.deliveryId} 
                        onChange={(e) => {
                          const order = orders.find(o => o.id === e.target.value);
                          setVerifyForm(prev => ({ 
                            ...prev, 
                            deliveryId: e.target.value,
                            recipientName: order ? order.customerName : '' 
                          }));
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                      >
                        <option value="">-- Choose Active Delivery --</option>
                        {orders.filter(o => o.status !== 'Completed').map(o => (
                          <option key={o.id} value={o.id}>{o.id} - {o.customerName} ({o.status})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-orange-600 uppercase mb-1 font-black">Enter Customer Code</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        value={verifyForm.code} 
                        onChange={(e) => setVerifyForm({ ...verifyForm, code: e.target.value })}
                        className="w-full px-3 py-2 bg-orange-50 border-2 border-orange-400 text-xs text-orange-950 font-black tracking-widest placeholder-orange-300/60"
                        placeholder="6-Digit Secret Code"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivered By / Recipient</label>
                      <input 
                        type="text" 
                        value={verifyForm.recipientName} 
                        onChange={(e) => setVerifyForm({ ...verifyForm, recipientName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Name of individual receiving"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Verification Note</label>
                    <textarea 
                      value={verifyForm.deliveryNote} 
                      onChange={(e) => setVerifyForm({ ...verifyForm, deliveryNote: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] h-12"
                      placeholder="Add ID verification numbers, exact time of drop, or customer remarks."
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4 text-white" />
                      Complete & Verify Delivery
                    </button>
                    
                    {verifyForm.deliveryId && (
                      <button
                        type="button"
                        onClick={() => {
                          const order = orders.find(o => o.id === verifyForm.deliveryId);
                          if (order && order.secretCode) {
                            showFeedback('success', `Admins-Only Diagnostic Override: Secret Code for ${order.id} is [${order.secretCode}]`);
                          } else {
                            showFeedback('warning', 'No secret code is generated yet for this order. Generate one inside the Assign tab.');
                          }
                        }}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold uppercase text-[10px]"
                      >
                        Reveal Code (Debug Override)
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* PART 8: WALK-IN COLLECTION CODE PANEL */}
              {activeActionTab === 'collect' && (
                <form onSubmit={handleConfirmCollectionSubmit} className="space-y-4">
                  <div className="p-3 bg-teal-500/10 border border-teal-300 text-[9.5px] leading-relaxed text-teal-950 font-semibold mb-2">
                    <strong>WALK-IN COUNTER METHOD:</strong> For customer pickups, enter the receipt number, generate/send a collection code, and enter it once they arrive to sign off in the terminal logs.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Receipt Number</label>
                      <input 
                        type="text" 
                        value={collectForm.receiptNumber} 
                        onChange={(e) => setCollectForm({ ...collectForm, receiptNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] uppercase"
                        placeholder="RCT-0005"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Customer / Depositor Name</label>
                      <input 
                        type="text" 
                        value={collectForm.customerName} 
                        onChange={(e) => setCollectForm({ ...collectForm, customerName: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Farai Sithole"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp Phone</label>
                      <input 
                        type="text" 
                        value={collectForm.customerWhatsApp} 
                        onChange={(e) => setCollectForm({ ...collectForm, customerWhatsApp: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="+263773000003"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Collected By / ID Placeholder</label>
                      <input 
                        type="text" 
                        value={collectForm.collectedBy} 
                        onChange={(e) => setCollectForm({ ...collectForm, collectedBy: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="National ID or Phone Confirmation"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold text-teal-700 uppercase mb-1">Collection Code</label>
                      <input 
                        type="text" 
                        value={collectForm.code} 
                        onChange={(e) => setCollectForm({ ...collectForm, code: e.target.value })}
                        className="w-full px-3 py-2 bg-teal-50 border-2 border-teal-500 text-xs font-black text-teal-950 tracking-widest placeholder-teal-300"
                        placeholder="6-Digit Code"
                      />
                    </div>

                    <div className="flex items-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleGenerateCollectionCodeBtn(collectForm.receiptNumber)}
                        className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-teal-400 font-extrabold uppercase text-[9.5px] rounded-none cursor-pointer flex items-center justify-center gap-1 border border-teal-500/20"
                      >
                        <Key className="w-3.5 h-3.5 text-teal-400" />
                        Generate Code
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Log & Collection Notes</label>
                    <textarea 
                      value={collectForm.notes} 
                      onChange={(e) => setCollectForm({ ...collectForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] h-12"
                      placeholder="Add walk-in details, representative identification..."
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-white" />
                      Confirm Collection Completed
                    </button>

                    {collectForm.receiptNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          const col = collections.find(c => c.receiptNumber === collectForm.receiptNumber);
                          const matchingOrder = orders.find(o => o.receiptNumber === collectForm.receiptNumber);
                          const existingCode = col?.collectionCode || matchingOrder?.secretCode;
                          
                          if (existingCode) {
                            showFeedback('success', `Admins-Only Collection Diagnostic: Code is [${existingCode}]`);
                          } else {
                            showFeedback('warning', 'No collection code found. Click generate collection code first.');
                          }
                        }}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold uppercase text-[10px]"
                      >
                        Reveal Pick Code
                      </button>
                    )}
                  </div>
                </form>
              )}

              {/* PART 10: DELIVERY FAILURE HANDLING PANEL */}
              {activeActionTab === 'fail' && (
                <form onSubmit={handleFailDeliverySubmit} className="space-y-4">
                  <div className="p-3 bg-rose-500/10 border border-rose-300 text-[9.5px] leading-relaxed text-rose-950 font-semibold mb-2">
                    <strong>FAILURE MITIGATION DESK:</strong> If a carrier reports delivery unsuccessful or the customer code fails verification, document the incident logs immediately to flag the transaction context.
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery ID (Reference)</label>
                      <select 
                        value={failureForm.deliveryId} 
                        onChange={(e) => setFailureForm({ ...failureForm, deliveryId: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                      >
                        <option value="">-- Choose Target Delivery --</option>
                        {orders.filter(o => o.status !== 'Completed').map(o => (
                          <option key={o.id} value={o.id}>{o.id} - {o.customerName} ({o.status})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Failure Reason</label>
                      <select 
                        value={failureForm.failedReason} 
                        onChange={(e) => setFailureForm({ ...failureForm, failedReason: e.target.value as DeliveryFailureReason })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                      >
                        <option value="Customer unavailable">Customer unavailable</option>
                        <option value="Wrong address">Wrong address</option>
                        <option value="Customer rejected delivery">Customer rejected delivery</option>
                        <option value="Delivery person failed to confirm code">Delivery person failed to confirm code</option>
                        <option value="Vehicle breakdown">Vehicle breakdown</option>
                        <option value="Product issue">Product issue</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Mitigating Action</label>
                      <select 
                        value={failureForm.nextAction} 
                        onChange={(e) => setFailureForm({ ...failureForm, nextAction: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                      >
                        <option value="Retry Delivery">Retry Delivery</option>
                        <option value="Customer Collection">Customer Collection</option>
                        <option value="Refund Review">Refund Review</option>
                        <option value="Manager Follow-Up">Manager Follow-Up</option>
                        <option value="Cancel Delivery">Cancel Delivery</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Incident Report Notes</label>
                    <textarea 
                      value={failureForm.notes} 
                      onChange={(e) => setFailureForm({ ...failureForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] h-12"
                      placeholder="Explain what transpired, conversations had, vehicle telemetry, etc..."
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5 text-white" />
                      Mark Delivery as Failed
                    </button>
                  </div>
                </form>
              )}

              {/* NEW DRIVER INJECTOR */}
              {activeActionTab === 'driver' && (
                <form onSubmit={handleRegisterDriverSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">New Driver Name</label>
                      <input 
                        type="text" 
                        value={newDriverForm.name} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="John Sithole"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone Number</label>
                      <input 
                        type="text" 
                        value={newDriverForm.phone} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="+263776000004"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">National ID Reference</label>
                      <input 
                        type="text" 
                        value={newDriverForm.nationalIdPlaceholder} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, nationalIdPlaceholder: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="48-129087-C-18"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle Type</label>
                      <select 
                        value={newDriverForm.vehicleType} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, vehicleType: e.target.value as VehicleType })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs"
                      >
                        <option value="Bike">Bike</option>
                        <option value="Car">Car</option>
                        <option value="Kombi">Kombi</option>
                        <option value="Lorry">Lorry</option>
                        <option value="Walking Courier">Walking Courier</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Vehicle Reg Number</label>
                      <input 
                        type="text" 
                        value={newDriverForm.vehicleRegistration} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, vehicleRegistration: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] uppercase"
                        placeholder="AGE-8120"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Driver Licence Number</label>
                      <input 
                        type="text" 
                        value={newDriverForm.licenceNumber} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, licenceNumber: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b] uppercase"
                        placeholder="DL-77291"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Courier Service Area</label>
                      <input 
                        type="text" 
                        value={newDriverForm.serviceArea} 
                        onChange={(e) => setNewDriverForm({ ...newDriverForm, serviceArea: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-[#b1b5c2] text-xs focus:bg-white text-[#1e222b]"
                        placeholder="Chitungwiza Urban"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase text-[10px] tracking-wider rounded-none cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5 text-white" />
                      Register Active Courier Node
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>

          {/* PART 4: DELIVERY ORDERS TABLE */}
          <div className="bg-white border-2 border-[#b1b5c2] shadow-sm p-5 space-y-4">
            
            {/* Header controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div>
                <h2 className="text-xs font-black text-[#1e222b] uppercase tracking-wider flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-orange-500" />
                  STATION CLEARANCE: DELIVERY ORDERS LEDGER
                </h2>
                <p className="text-[9px] text-slate-400">Search and manage delivery codes, assignments, and fail reports below</p>
              </div>

              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-48">
                  <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-[#b1b5c2] text-[10px] focus:bg-white rounded-none"
                    placeholder="Search receipt, name, address..."
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-[#b1b5c2] text-[10px] rounded-none focus:outline-none"
                >
                  <option value="ALL">ALL STATUSES</option>
                  <option value="Pending Assignment">Pending Assignment</option>
                  <option value="Assigned">Assigned</option>
                  <option value="Out for Delivery">Out for Delivery</option>
                  <option value="Completed">Completed</option>
                  <option value="Failed">Failed</option>
                  <option value="Waiting Collection">Waiting Collection</option>
                </select>

                <button 
                  onClick={loadAllData}
                  className="p-1.5 bg-slate-100 hover:bg-slate-250 border border-[#b1b5c2] text-slate-600 rounded-none cursor-pointer"
                  title="Reload ledger data"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Table wrapper */}
            <div className="overflow-x-auto border border-[#b1b5c2]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1e222b] text-white text-[8.5px] uppercase tracking-wider">
                    <th className="p-2.5 border-r border-[#b1b5c2]/20">Delivery ID</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20">Receipt No</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20">Customer Name</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20">WhatsApp Contacts</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20 font-light">Destination Address</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20">Delivery Method</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20 text-center">Status</th>
                    <th className="p-2.5 border-r border-[#b1b5c2]/20 text-center">Secret Code Status</th>
                    <th className="p-2.5 text-center">Action commands</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-semibold uppercase text-[10px] bg-slate-50/55">
                        No delivery entries match the selected filters or search text.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => {
                      const isSelected = selectedOrderId === ord.id;
                      return (
                        <tr 
                          key={ord.id} 
                          className={`hover:bg-slate-50 font-mono text-[10px] transition-colors ${
                            isSelected ? 'bg-orange-600/5 border-l-2 border-l-orange-500' : ''
                          }`}
                        >
                          <td className="p-2.5 font-bold text-[#1e222b] border-r border-slate-200">{ord.id}</td>
                          <td className="p-2.5 border-r border-slate-200 font-extrabold text-slate-600">{ord.receiptNumber}</td>
                          <td className="p-2.5 border-r border-slate-200 font-black">{ord.customerName}</td>
                          <td className="p-2.5 border-r border-slate-200 text-teal-700">{ord.customerWhatsApp}</td>
                          <td className="p-2.5 border-r border-slate-200 max-w-[130px] truncate" title={`${ord.deliveryAddress}, ${ord.suburb}, ${ord.district}`}>
                            {ord.deliveryAddress}, <span className="text-slate-400">{ord.suburb}</span>
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-bold uppercase text-[9px]">
                            {ord.deliveryMethod}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            <span className={`px-1.5 py-0.5 text-[8.5px] uppercase font-black tracking-tighter ${
                              ord.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                              ord.status === 'Out for Delivery' ? 'bg-purple-100 text-purple-800' :
                              ord.status === 'Assigned' ? 'bg-amber-100 text-amber-800' :
                              ord.status === 'Failed' ? 'bg-rose-100 text-rose-800 animate-pulse' :
                              ord.status === 'Waiting Collection' ? 'bg-teal-100 text-teal-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`px-1 py-px text-[7.5px] uppercase font-bold leading-none ${
                                ord.codeStatus === 'Code Confirmed' ? 'bg-emerald-600 text-white' :
                                ord.codeStatus === 'Code Sent' ? 'bg-teal-600 text-white' :
                                ord.codeStatus === 'Code Generated' ? 'bg-amber-500 text-[#1e222b]' :
                                'bg-slate-300 text-slate-700'
                              }`}>
                                {ord.codeStatus}
                              </span>
                              {ord.secretCode && ord.codeStatus !== 'Code Confirmed' && (
                                <span className="text-[7.5px] font-bold text-slate-300 hover:text-slate-600 select-all" title="Secret security string">
                                  ••••••
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-2 py-1.5 text-center flex flex-wrap justify-center items-center gap-1">
                            <button
                              onClick={() => {
                                selectOrderAndFillForm(ord);
                                setActiveActionTab('assign');
                                showFeedback('success', `Selected Order ${ord.id} - details mapped to Assign Driver panel`);
                              }}
                              className="px-1.5 py-1 bg-[#1e222b] hover:bg-zinc-800 text-white hover:text-orange-400 font-extrabold text-[8.5px] uppercase transition-colors"
                              title="Assign Driver"
                            >
                              Assign
                            </button>
                            
                            {ord.codeStatus === 'Not Generated' && ord.status !== 'Completed' && (
                              <button
                                onClick={() => handleGenerateSecretCode(ord.id)}
                                className="px-1.5 py-1 bg-amber-500 hover:bg-amber-600 text-[#1e222b] font-black text-[8.5px] uppercase"
                                title="Generate Code"
                              >
                                Code
                              </button>
                            )}

                            {ord.codeStatus === 'Code Generated' && ord.status !== 'Completed' && (
                              <button
                                onClick={() => handleSendWhatsAppPlaceholder(ord.id)}
                                className="px-1.5 py-1 bg-teal-600 hover:bg-teal-700 text-white font-black text-[8.5px] uppercase"
                                title="Send WhatsApp Secure Code"
                              >
                                Send
                              </button>
                            )}

                            {ord.status !== 'Completed' && (
                              <button
                                onClick={() => {
                                  selectOrderAndFillForm(ord);
                                  setActiveActionTab('verify');
                                }}
                                className="px-1.5 py-1 bg-orange-600 hover:bg-orange-700 text-white font-black text-[8.5px] uppercase"
                                title="Verify Code"
                              >
                                Verify
                              </button>
                            )}

                            {ord.status !== 'Failed' && ord.status !== 'Completed' && (
                              <button
                                onClick={() => {
                                  selectOrderAndFillForm(ord);
                                  setActiveActionTab('fail');
                                }}
                                className="px-1.5 py-1 bg-rose-605 bg-rose-600 hover:bg-rose-700 text-white font-black text-[8.5px] uppercase"
                                title="Mark Failed"
                              >
                                Fail
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

            {/* Note on code protection */}
            <div className="text-[9.5px] text-slate-500 italic bg-slate-50 p-2.5 border-l-2 border-l-slate-400">
              * Note: For strict security compliance, local delivery drivers must not have visual access to the codes generated on screen. Only the checkout terminal and the receiving client possess this payload.
            </div>
          </div>

          {/* PART 9: DELIVERY PERSONS TABLE */}
          <div className="bg-white border-2 border-[#b1b5c2] shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-xs font-black text-[#1e222b] uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-orange-500" />
                ACTIVE DISPATCH FLEET: COURIERS & CARRIERS
              </h2>
              <p className="text-[9px] text-slate-400 font-mono">Register vehicle details and check active status values below</p>
            </div>

            <div className="overflow-x-auto border border-[#b1b5c2]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 text-[8.5px] uppercase tracking-wider border-b border-[#b1b5c2]">
                    <th className="p-2 border-r border-[#b1b5c2]/40">Driver ID</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Staff Name</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Driver WhatsApp</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Vehicle Model</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Registration Plate</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Licence ID</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">National ID</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40">Primary Area</th>
                    <th className="p-2 border-r border-[#b1b5c2]/40 text-center">Status</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {drivers.map(drv => (
                    <tr key={drv.driverId} className="hover:bg-slate-50 font-mono text-[9.5px]">
                      <td className="p-2 font-black border-r border-slate-200 text-[#1e222b]">{drv.driverId}</td>
                      <td className="p-2 border-r border-slate-200 font-semibold">{drv.name}</td>
                      <td className="p-2 border-r border-slate-200 text-teal-700">{drv.phone}</td>
                      <td className="p-2 border-r border-slate-200 uppercase font-black text-slate-600">{drv.vehicleType}</td>
                      <td className="p-2 border-r border-slate-200 uppercase">{drv.vehicleRegistration || 'N/A'}</td>
                      <td className="p-2 border-r border-slate-200 text-xs font-bold text-slate-500">{drv.licenceNumber}</td>
                      <td className="p-2 border-r border-slate-200 font-light">{drv.nationalIdPlaceholder}</td>
                      <td className="p-2 border-r border-slate-200">{drv.serviceArea}</td>
                      <td className="p-2 border-r border-slate-200 text-center">
                        <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase ${
                          drv.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                          drv.status === 'Pending Verification' ? 'bg-amber-100 text-amber-970' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          {drv.status}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            // Populate into active assignment form
                            setAssignForm(prev => ({
                              ...prev,
                              deliveryPersonId: drv.driverId,
                              vehicleType: drv.vehicleType,
                              vehicleRegistration: drv.vehicleRegistration,
                              driverPhone: drv.phone
                            }));
                            setActiveActionTab('assign');
                            showFeedback('success', `Selected ${drv.name} - mapped to Assignment Form`);
                          }}
                          className="px-1 py-0.5 bg-slate-900 text-orange-400 hover:bg-slate-800 font-black uppercase text-[8px] transition-colors"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: DIAGNOSTICS, LOGS & FEEDS (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* PART 11: DELIVERY BI ALERTS */}
          <div className="bg-white border-2 border-[#b1b5c2] shadow-sm p-4 space-y-3">
            <h3 className="text-[10px] font-black text-[#1e222b] uppercase tracking-widest border-b border-slate-200 pb-2 flex items-center gap-1">
              <Shield className="w-4 h-4 text-orange-500 shrink-0" />
              COURIER BI ALERTS & AUDITS
            </h3>

            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {[
                { type: 'DELIVERY_CODE_PENDING', severity: 'Medium', desc: 'Delivery code generated but not confirmed yet for Tapiwa Moyo (DEL-001).' },
                { type: 'FAILED_DELIVERY_CONFIRMATION', severity: 'High', desc: 'Wrong customer code entered for DEL-005 in Mbare depot context.' },
                { type: 'DELIVERY_FAILURE_REVIEW_REQUIRED', severity: 'High', desc: 'Failed delivery DEL-005 requires supervisor follow-up & re-assignment.' },
                { type: 'DELIVERY_CONFIRMED_BY_CUSTOMER_CODE', severity: 'Low', desc: 'Completed delivery for DEL-001 by verification on WhatsApp loop.' },
                { type: 'CUSTOMER_COLLECTION_CONFIRMED', severity: 'Low', desc: 'Walk-in collection completed by receipt customer code verification.' },
                { type: 'DELIVERY_PERSON_VERIFICATION_PENDING', severity: 'Medium', desc: 'Driver External Courier is registered and pending licence confirmation.' }
              ].map((al) => {
                const badgeColor = 
                  al.severity === 'High' ? 'bg-rose-500 text-white' :
                  al.severity === 'Medium' ? 'bg-amber-500 text-slate-900' :
                  'bg-slate-500 text-white';

                return (
                  <div key={al.type} className="p-2.5 bg-slate-50 border border-slate-200 h-auto space-y-1 font-mono text-[9.5px]">
                    <div className="flex justify-between items-center text-[8px]">
                      <span className="font-black text-slate-800 tracking-tighter truncate max-w-[200px]" title={al.type}>{al.type}</span>
                      <span className={`px-1 py-px font-black uppercase text-[7px] leading-none ${badgeColor}`}>{al.severity}</span>
                    </div>
                    <p className="text-slate-500 text-[8.5px] leading-relaxed select-text font-sans">{al.desc}</p>
                  </div>
                );
              })}
            </div>
            
            <div className="pt-2 border-t border-slate-100 text-[7.5px] text-slate-400 text-right uppercase">
              REPORTS RECALCULATING...
            </div>
          </div>

          {/* PART 12: DELIVERY ACTIVITY FEED */}
          <div className="bg-[#1e222b] text-white border-2 border-[#b1b5c2] p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-slate-700 pb-2">
              <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 text-orange-400">
                <Truck className="w-4 h-4 text-orange-500 shrink-0" />
                DELIVERY ACTIVITY FEED
              </h3>
              <span className="text-[8px] bg-slate-800 text-white px-2 py-0.5 font-bold">LIVE STREAM</span>
            </div>

            <div className="space-y-2.5 max-h-[400px] overflow-y-auto scrollbar-thin pr-1 select-text">
              {events.length === 0 ? (
                <div className="text-slate-500 text-center py-6">No recent events logged.</div>
              ) : (
                events.map((ev) => {
                  const tagColor = 
                    ev.eventType === 'DELIVERY_COMPLETED' || ev.eventType === 'WALK_IN_COLLECTION_COMPLETED' ? 'text-emerald-400' :
                    ev.eventType === 'DELIVERY_FAILED' || ev.eventType === 'DELIVERY_CODE_FAILED' || ev.eventType === 'COLLECTION_CODE_FAILED' ? 'text-rose-400 font-bold' :
                    'text-amber-400';

                  const timeStr = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '';

                  return (
                    <div key={ev.id} className="text-[9px] border-b border-slate-800 pb-2 font-mono hover:bg-slate-800/40 p-1">
                      <div className="flex justify-between text-slate-400 text-[8px] mb-0.5">
                        <span className={`font-black uppercase truncate ${tagColor}`}>{ev.eventType}</span>
                        <span>{timeStr || 'LIVE'}</span>
                      </div>
                      <p className="text-slate-300 leading-normal text-[8.5px] font-sans">{ev.message}</p>
                      <div className="text-slate-500 text-[7.5px] mt-0.5 flex justify-between items-center">
                        <span>Ref ID: <span className="text-slate-400">{ev.id}</span></span>
                        <span>Op: <strong className="text-emerald-500">{ev.operator}</strong></span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 text-center">
              <button 
                onClick={loadAllData}
                className="text-[8px] text-orange-400 font-extrabold hover:underline uppercase inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3 animate-spin" />
                Refresh Diagnostic Feed
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
