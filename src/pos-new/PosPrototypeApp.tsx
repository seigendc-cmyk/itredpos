import { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';

import { readPosAuthContext, savePosAuthContext } from './auth/posVendorAuthState';
import { AlertTriangle } from 'lucide-react';
import PosShell from './layout/PosShell';
import PosDashboard from './pages/PosDashboard';
import PosSales from './pages/PosSales';
import PosStock from './pages/PosStock';
import PosShift from './pages/PosShift';
import PosCash from './pages/PosCash';
import PosFinancialControl from './pages/PosFinancialControl';
import PosBIDesk from './pages/PosBIDesk';
import PosSettings from './pages/PosSettings';
import PosStaffAccess from './pages/PosStaffAccess';
import PosDeliveryDesk from './pages/PosDeliveryDesk';
import PosSyncDesk from './pages/PosSyncDesk';
import PosOwnerDesk from './pages/PosOwnerDesk';
import PosSalesHistory from './pages/PosSalesHistory';
import PosTaskDesk from './pages/PosTaskDesk';
import PosApprovals from './pages/PosApprovals';
import PosCustomerDesk from './pages/PosCustomerDesk';
import PosCreditors from './pages/PosCreditors';
import PosPurchaseDiscipline from './pages/PosPurchaseDiscipline';
import PosHelpDesk from './pages/PosHelpDesk';
import { 
  Product, 
  Transaction, 
  Shift, 
  CashLog, 
  PosPageId, 
  PosSession, 
  BiEvent,
  BusinessProfile,
  BranchSetting,
  WarehouseSetting,
  TerminalSetting,
  StaffSetting,
  HardwareSetting,
  TaxSetting,
  ReceiptSetting
} from './types';
import { 
  mockProducts, 
  mockBranches, 
  mockWarehouses, 
  mockTerminals, 
  mockStaff, 
  mockRecentSales, 
  mockHeldTransactions, 
  mockShift, 
  mockCashMovements, 
  mockBIEvents, 
  mockSettings 
} from './mock/mockPosData';
import { getEffectivePageIdsForRole, normalizeRoleKey } from './auth/effectivePermissionService';
import { recordSecurityMatrixEvent } from './auth/permissionMatrixService';
import { getCurrentFirebaseUserProfile, signInWithGooglePlaceholder, subscribeToFirebaseAuthState, signOutFirebasePlaceholder, handleGoogleRedirectResult } from './auth/firebaseAuthShell';
import { applyPOSActivationToTenantSession, createTenantSessionFromFirebaseUser, getCurrentTenantSession, recordAuthActivity } from './auth/tenantSessionService';
import { clearActivePOSActivation, getSavedPOSSession, validatePOSActivationForEmail, type POSActivationValidationResult } from './auth/posActivationService';
import { loadLocalProducts, POS_PRODUCT_STORE_EVENT, saveLocalProducts, updateLocalProductStock } from './utils/localProductStore';
import { ENABLE_MOCK_SEED_DATA, getVendorScopedStorageKey, initializeEmptyVendorOperationalStores } from './utils/vendorDataMode';
import { firebaseReady } from './firebase/firebaseApp';
import {
  mergeVendorLicenseIntoAuthContext,
  readSavedVendorLicenseSnapshot,
  subscribeToVendorLicense,
  type VendorLicenseRuntimeSnapshot
} from './auth/vendorLicenseRuntimeService';
import {
  getNextPlanCode,
  getLockedPlanPages,
  getPlanFeatureAccess,
  isLimitReached,
  type PlanFeatureAccess
} from './auth/planFeatureGate';
import UpgradeRequiredPanel, { type UpgradeRequiredVendorContext } from './components/UpgradeRequiredPanel';
import './posNew.css';

const PosReports = lazy(() => import('./pages/PosReports'));
const SHOW_DEV_BADGES = false;
const FIREBASE_WRITE_MODE_KEY = 'itred_pos_firebase_write_mode';

// Seed data is opt-in only. New vendors start with live empty stores.
const INITIAL_PRODUCTS: Product[] = ENABLE_MOCK_SEED_DATA ? mockProducts : [];

const INITIAL_TRANSACTIONS: Transaction[] = ENABLE_MOCK_SEED_DATA ? mockRecentSales : [];

const INITIAL_CASH_LOGS: CashLog[] = ENABLE_MOCK_SEED_DATA ? mockCashMovements : [];

const INITIAL_BI_EVENTS: BiEvent[] = ENABLE_MOCK_SEED_DATA ? mockBIEvents : [];

const DEFAULT_RECEIPT_SETTING: ReceiptSetting = {
  header: 'iTred Commerce POS',
  footer: 'Thank you for shopping with us.',
  slipWidth: '32_COLUMNS (STANDARD_SLIP)',
  showTaxBreakdown: true,
  layout: 'Thermal Receipt Roll',
  headerMessage: '',
  footerMessage: 'Thank you for shopping with us.',
  termsAndConditions: 'Goods may be returned according to store policy with a valid receipt.',
  businessAddress: '',
  contactNumbers: '',
  emailAddress: '',
  socialMediaHandles: '',
  contactInformation: '',
  socialMediaInformation: ''
};

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredText(key: string, fallback: string): string {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function isFirebaseWriteReady(): boolean {
  return firebaseReady && readStoredText(FIREBASE_WRITE_MODE_KEY, 'disabled') === 'enabled';
}

function resolveRuntimeStorageMode(): string {
  return isFirebaseWriteReady() ? 'firebase' : 'local';
}

function getTrialDaysRemaining(): number | null {
  const authContext = readPosAuthContext();
  const expiresAt = authContext?.trialExpiresAt || authContext?.demoExpiresAt;
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  if (!Number.isFinite(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

function writeStoredValue(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    }
  } catch {
    // Storage fallback: ignore write failures and keep in-memory React state.
  }
}

function removeStoredValue(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    // Storage fallback: ignore removal failures.
  }
}

const VENDOR_PLACEHOLDER_NAMES = new Set([
  'vendor n/a',
  'sci logistics ltd',
  'sci auto spares'
]);

function displayText(value?: string | null): string {
  return String(value || '').trim();
}

function isPlaceholderVendorName(value?: string | null): boolean {
  const text = displayText(value);
  return !text || VENDOR_PLACEHOLDER_NAMES.has(text.toLowerCase());
}

function firstVendorDisplayName(...values: Array<string | undefined | null>): string {
  return values.map(displayText).find((value) => !isPlaceholderVendorName(value)) || 'Business';
}

function resolveVendorDisplayName(
  businessProfile?: Partial<BusinessProfile> | null,
  vendorAuth?: ReturnType<typeof readPosAuthContext>,
  session?: Partial<PosSession> | null
): string {
  return firstVendorDisplayName(
    businessProfile?.legalName,
    businessProfile?.tradingName,
    businessProfile?.businessName,
    vendorAuth?.vendorName,
    session?.vendor,
    session?.vendorId
  );
}

function resolveStoredBranchName(branchId?: string, fallback?: string): string {
  const id = displayText(branchId);
  if (!id) return displayText(fallback) || 'main-branch';
  const branches = readStoredValue<BranchSetting[]>('itred_pos_branches', []);
  return branches.find((branch) => branch.id === id)?.name || displayText(fallback) || id;
}

function resolveStoredTerminalName(terminalId?: string, fallback?: string): string {
  const id = displayText(terminalId);
  if (!id) return displayText(fallback) || 'TERM-MAIN-001';
  const terminals = readStoredValue<TerminalSetting[]>('itred_pos_terminals', []);
  return terminals.find((terminal) => terminal.id === id)?.name || displayText(fallback) || id;
}

function normalizeSessionForVendorRuntime(
  session: PosSession,
  businessProfile?: Partial<BusinessProfile> | null,
  vendorAuth?: ReturnType<typeof readPosAuthContext>
): PosSession {
  const isOnboardedVendorSession = Boolean(vendorAuth?.vendorId && vendorAuth?.vendorName);
  const branchId = vendorAuth?.branchId || session.branchId || 'main-branch';
  const terminalId = session.terminalId || (isOnboardedVendorSession ? 'TERM-MAIN-001' : undefined);
  const planId = vendorAuth?.planCode || session.planId || (isOnboardedVendorSession ? 'DEMO' : undefined);
  const licenseMode = vendorAuth?.licenseMode || session.licenseMode || (isOnboardedVendorSession ? 'demo' : undefined);

  return {
    ...session,
    vendor: resolveVendorDisplayName(businessProfile, vendorAuth, session),
    vendorId: vendorAuth?.vendorId || session.vendorId,
    branchId,
    branch: resolveStoredBranchName(branchId, session.branch),
    terminalId,
    terminal: resolveStoredTerminalName(terminalId, session.terminal),
    planId,
    licenseMode,
    storageMode: resolveRuntimeStorageMode(),
    licenseId: isOnboardedVendorSession ? (session.licenseId || `${vendorAuth?.vendorId || 'vendor'}-license`) : session.licenseId,
    activationId: isOnboardedVendorSession ? (session.activationId || `${vendorAuth?.vendorId || 'vendor'}-activation`) : session.activationId
  };
}

function licenseBlockTitle(snapshot: VendorLicenseRuntimeSnapshot): string {
  if (snapshot.blockReason === 'AccountSuspended') return 'Account Suspended';
  if (snapshot.blockReason === 'VerificationRejected') return 'Vendor Registration Rejected';
  return 'License Required';
}

function profileText(profile: Partial<BusinessProfile> | null | undefined, ...keys: string[]): string {
  const row = (profile || {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = displayText(row[key] as string);
    if (value) return value;
  }
  return '';
}

function buildUpgradeVendorContext(
  businessProfile: Partial<BusinessProfile> | null | undefined,
  vendorAuth?: ReturnType<typeof readPosAuthContext>,
  session?: Partial<PosSession> | null
): UpgradeRequiredVendorContext {
  return {
    vendorName: resolveVendorDisplayName(businessProfile, vendorAuth, session),
    vendorId: displayText(vendorAuth?.vendorId || session?.vendorId) || 'unassigned-vendor',
    ownerName: profileText(businessProfile, 'ownerName', 'contactPerson', 'administratorName'),
    ownerPhone: profileText(businessProfile, 'ownerContact', 'ownerPhone', 'businessPhone', 'phone', 'phoneNumber1'),
    ownerWhatsapp: profileText(businessProfile, 'businessWhatsapp', 'whatsapp', 'ownerWhatsApp', 'whatsAppNumber1'),
    city: profileText(businessProfile, 'city', 'cityTown'),
    suburb: profileText(businessProfile, 'suburb', 'districtSuburb', 'district')
  };
}

export default function PosPrototypeApp() {
  const [activePage, setActivePage] = useState<PosPageId>('DASHBOARD');

  // Client Session Identity Tracking
  const [authUser, setAuthUser] = useState(getCurrentFirebaseUserProfile());
  const [googleAuthMessage, setGoogleAuthMessage] = useState('Sign in with Google to continue to Staff Access.');
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [activationChecking, setActivationChecking] = useState(false);
  const [activationDecision, setActivationDecision] = useState<POSActivationValidationResult | null>(null);
  const activationRunRef = useRef(0);
  const googleAuthProfile = authUser;
  const authLoading = checkingAuth;
  const activationResult = activationDecision;

  const validateAndApplyPOSActivation = async (profile: NonNullable<ReturnType<typeof getCurrentFirebaseUserProfile>>) => {
    const runId = activationRunRef.current + 1;
    activationRunRef.current = runId;
    setActivationChecking(true);
    setActivationDecision(null);
    setLicenseChecked(false);
    createTenantSessionFromFirebaseUser(profile);
    try {
      const result = await validatePOSActivationForEmail(profile.email || '');
      if (activationRunRef.current !== runId) return;
      setActivationDecision(result);
      recordAuthActivity({
        eventType: 'ACTIVATION_VALIDATED',
        label: 'Activation Validated',
        message: `${result.reasonCode}: ${result.message}`,
        vendorId: result.activation?.vendorId,
        staffId: profile.email
      });
      if (result.allowed && result.activation) {
        applyPOSActivationToTenantSession(profile, result.activation);
        recordAuthActivity({
          eventType: 'POS_LOGIN_ALLOWED',
          label: 'POS Login Allowed',
          message: `POS login allowed for ${profile.email}.`,
          vendorId: result.activation.vendorId,
          staffId: profile.email
        });
        setLicenseChecked(true);
        setAuthError(null);
        setGoogleAuthMessage(`${result.message} Continue with Staff Access.`);
      } else {
        recordAuthActivity({
          eventType: 'POS_LOGIN_BLOCKED',
          label: 'POS Login Blocked',
          message: `${profile.email || 'Unknown Google account'} blocked: ${result.reasonCode}.`,
          vendorId: result.activation?.vendorId,
          staffId: profile.email
        });
        setLicenseChecked(false);
        setActiveSession(null);
        setGoogleAuthMessage(result.message);
      }
    } catch (error) {
      if (activationRunRef.current !== runId) return;
      const message = error instanceof Error ? error.message : 'Activation validation failed.';
      setActivationDecision({
        allowed: false,
        reasonCode: 'NO_ACTIVATION_FOUND',
        message
      });
      setAuthError(message);
      recordAuthActivity({
        eventType: 'POS_LOGIN_BLOCKED',
        label: 'POS Login Blocked',
        message: `${profile.email || 'Unknown Google account'} blocked: ${message}`,
        staffId: profile.email
      });
      setLicenseChecked(false);
      setActiveSession(null);
      clearActivePOSActivation();
      setGoogleAuthMessage(message);
    } finally {
      if (activationRunRef.current === runId) {
        setActivationChecking(false);
      }
    }
  };

  // Automatically restore active session state on reload
  useEffect(() => {
    let active = true;
    let unsubscribe = () => undefined;

    const restoreGoogleSession = async () => {
      setCheckingAuth(true);
      try {
        const redirectRes = await handleGoogleRedirectResult();
        if (redirectRes && !redirectRes.ok && active) {
          setAuthError(redirectRes.error || redirectRes.message || 'Google redirect sign-in failed.');
          setGoogleAuthMessage(redirectRes.message || 'Google redirect sign-in failed.');
        }
      } catch (e) {
        if (active) {
          const message = e instanceof Error ? e.message : 'Google redirect callback handling failed.';
          setAuthError(message);
          setGoogleAuthMessage(message);
        }
      }

      if (!active) return;
      unsubscribe = subscribeToFirebaseAuthState((profile) => {
        if (!active) return;
        setAuthUser(profile);
        if (profile) {
          setAuthError(null);
          setGoogleAuthMessage('Google session found. Checking POS activation...');
          void validateAndApplyPOSActivation(profile);
        } else {
          setGoogleAuthMessage('Sign in with Google to continue to Staff Access.');
          setActivationDecision(null);
          setActivationChecking(false);
          setLicenseChecked(false);
          setActiveSession(null);
        }
        setCheckingAuth(false);
      });
    };

    void restoreGoogleSession();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  function createPosSessionFromVendorAuthContext(): PosSession | null {
    const vendorAuth = readPosAuthContext();
    if (!vendorAuth || vendorAuth.stage !== 'posReady') {
      return null;
    }
    const storedBusinessProfile = readStoredValue<BusinessProfile | null>('itred_pos_business_profile', null);
    const branchId = vendorAuth.branchId || 'main-branch';
    const terminalId = 'TERM-MAIN-001';
    return normalizeSessionForVendorRuntime({
      staffId: vendorAuth.staffId || 'owner-staff',
      staffName: 'Owner',
      role: (vendorAuth.staffRole || 'Owner') as PosSession['role'],
      vendor: resolveVendorDisplayName(storedBusinessProfile, vendorAuth),
      branch: resolveStoredBranchName(branchId),
      terminal: resolveStoredTerminalName(terminalId),
      vendorId: vendorAuth.vendorId || 'demo-vendor',
      branchId,
      terminalId,
      licenseId: `${vendorAuth.vendorId || 'vendor'}-license`,
      planId: vendorAuth.planCode || 'DEMO',
      licenseMode: vendorAuth.licenseMode || 'demo',
      storageMode: resolveRuntimeStorageMode(),
      activationId: `${vendorAuth.vendorId || 'vendor'}-activation`,
      dashboardType: 'POS',
      openedAt: new Date().toISOString(),
      googleEmail: vendorAuth.googleEmail || ''
    }, storedBusinessProfile, vendorAuth);
  }

  const [activeSession, setActiveSession] = useState<PosSession | null>(() => {
    const vendorAuth = readPosAuthContext();
    const storedBusinessProfile = readStoredValue<BusinessProfile | null>('itred_pos_business_profile', null);
    const storedSession = readStoredValue<PosSession | null>('itred_pos_active_session', null);
    if (storedSession) {
      return normalizeSessionForVendorRuntime(storedSession, storedBusinessProfile, vendorAuth);
    }
    return createPosSessionFromVendorAuthContext();
  });
  const [runtimeLicense, setRuntimeLicense] = useState<VendorLicenseRuntimeSnapshot | null>(() => {
    const vendorId = readPosAuthContext()?.vendorId;
    return vendorId ? readSavedVendorLicenseSnapshot(vendorId) : null;
  });

  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => {
    return readStoredValue<BusinessProfile>('itred_pos_business_profile', mockSettings.businessProfile);
  });

  useEffect(() => {
    if (activeSession) return;

    const vendorAuth = readPosAuthContext();

    if (!vendorAuth || vendorAuth.stage !== 'posReady') return;
    const storedBusinessProfile = readStoredValue<BusinessProfile | null>('itred_pos_business_profile', null);
    const branchId = vendorAuth.branchId || 'main-branch';
    const terminalId = 'TERM-MAIN-001';

    const bridgedSession: PosSession = normalizeSessionForVendorRuntime({
      staffId: vendorAuth.staffId || 'owner-staff',
      staffName: 'Owner',
      role: (vendorAuth.staffRole || 'Owner') as PosSession['role'],
      vendor: resolveVendorDisplayName(storedBusinessProfile, vendorAuth),
      branch: resolveStoredBranchName(branchId),
      terminal: resolveStoredTerminalName(terminalId),
      vendorId: vendorAuth.vendorId || 'demo-vendor',
      branchId,
      terminalId,
      licenseId: `${vendorAuth.vendorId || 'vendor'}-license`,
      planId: vendorAuth.planCode || 'DEMO',
      licenseMode: vendorAuth.licenseMode || 'demo',
      storageMode: resolveRuntimeStorageMode(),
      activationId: `${vendorAuth.vendorId || 'vendor'}-activation`,
      dashboardType: 'POS',
      openedAt: new Date().toISOString(),
      googleEmail: vendorAuth.googleEmail || ''
    }, storedBusinessProfile, vendorAuth);

    setActiveSession(bridgedSession);
  }, [activeSession]);

  useEffect(() => {
    const vendorId = activeSession?.vendorId || readPosAuthContext()?.vendorId;
    if (!vendorId) return undefined;

    return subscribeToVendorLicense(vendorId, (licenseSnapshot) => {
      setRuntimeLicense(licenseSnapshot);
      const currentAuth = readPosAuthContext() || {
        stage: licenseSnapshot.allowed ? 'posReady' : 'licenseRequired',
        vendorId
      };
      const nextAuth = mergeVendorLicenseIntoAuthContext(currentAuth, licenseSnapshot);
      savePosAuthContext(nextAuth);

      setActiveSession((currentSession) => {
        if (!currentSession) return currentSession;
        const nextSession = normalizeSessionForVendorRuntime({
          ...currentSession,
          planId: licenseSnapshot.planCode,
          licenseMode: licenseSnapshot.licenseMode,
          licenseId: currentSession.licenseId || `${vendorId}-license`,
          activationId: currentSession.activationId || `${vendorId}-activation`
        }, businessProfile, nextAuth);
        const changed =
          nextSession.planId !== currentSession.planId ||
          nextSession.licenseMode !== currentSession.licenseMode ||
          nextSession.storageMode !== currentSession.storageMode ||
          nextSession.licenseId !== currentSession.licenseId ||
          nextSession.activationId !== currentSession.activationId;
        return changed ? nextSession : currentSession;
      });
    });
  }, [activeSession?.vendorId, businessProfile]);

  // Clear active staff session when the Google profile email changes (tenant isolation enforcement)
  useEffect(() => {
    if (googleAuthProfile) {
      const session = getCurrentTenantSession();
      if (activeSession && session.googleEmail !== googleAuthProfile.email) {
        setActiveSession(null);
      }
    }
  }, [googleAuthProfile?.email]);

  // Shared database states (re-hydrating from localStorage if present to maintain feel)
  const [products, setProducts] = useState<Product[]>(() => {
    return loadLocalProducts();
  });
  const planAccess: PlanFeatureAccess = useMemo(() => {
    return getPlanFeatureAccess(runtimeLicense || readPosAuthContext() || activeSession);
  }, [runtimeLicense, activeSession?.planId, activeSession?.licenseMode]);
  const planLockedPages = useMemo(() => getLockedPlanPages(planAccess), [planAccess]);
  const productLimitReached = isLimitReached(products.length, planAccess.limits.maxProducts);
  const productLimitMessage = 'Product limit reached for your current plan.';
  const [planLimitNotice, setPlanLimitNotice] = useState('');

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return readStoredValue<Transaction[]>(getVendorScopedStorageKey('itred_pos_transactions'), INITIAL_TRANSACTIONS);
  });

  const [cashLogs, setCashLogs] = useState<CashLog[]>(() => {
    return readStoredValue<CashLog[]>(getVendorScopedStorageKey('itred_pos_cash_logs'), INITIAL_CASH_LOGS);
  });

  // Current Shift State
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    return readStoredValue<Shift | null>(getVendorScopedStorageKey('itred_pos_active_shift'), ENABLE_MOCK_SEED_DATA ? mockShift : null);
  });

  const [shiftHistory, setShiftHistory] = useState<Shift[]>(() => {
    return readStoredValue<Shift[]>(getVendorScopedStorageKey('itred_pos_shifthistory'), ENABLE_MOCK_SEED_DATA ? [
      {
        id: 'SHIFT-2026-06-07-01',
        operator: 'NIGHT_RECR',
        status: 'CLOSED',
        startTime: '2026-06-07T14:00:00Z',
        endTime: '2026-06-07T22:30:00Z',
        startingCash: 200.00,
        expectedCash: 850.50,
        actualCash: 850.50,
        difference: 0.00,
        salesCount: 15,
        totalSales: 650.50
      },
      {
        id: 'SHIFT-2026-06-07-02',
        operator: 'AUX_T6',
        status: 'CLOSED',
        startTime: '2026-06-07T06:00:00Z',
        endTime: '2026-06-07T14:00:00Z',
        startingCash: 200.00,
        expectedCash: 530.00,
        actualCash: 526.00,
        difference: -4.00, // variance
        salesCount: 8,
        totalSales: 330.00
      }
    ] : []);
  });

  // Business Intelligence Events Cache State
  const [biEvents, setBiEvents] = useState<BiEvent[]>(() => {
    return readStoredValue<BiEvent[]>(getVendorScopedStorageKey('itred_pos_bi_events'), INITIAL_BI_EVENTS);
  });

  // Business Settings States
  const [branches, setBranches] = useState<BranchSetting[]>(() => {
    return readStoredValue<BranchSetting[]>('itred_pos_branches', mockBranches);
  });

  const [warehouses, setWarehouses] = useState<WarehouseSetting[]>(() => {
    return readStoredValue<WarehouseSetting[]>('itred_pos_warehouses', mockWarehouses);
  });

  const [terminalsSetting, setTerminalsSetting] = useState<TerminalSetting[]>(() => {
    return readStoredValue<TerminalSetting[]>('itred_pos_terminals', mockTerminals);
  });

  const [staffSetting, setStaffSetting] = useState<StaffSetting[]>(() => {
    return readStoredValue<StaffSetting[]>('itred_pos_staff', mockStaff);
  });

  const [hardwareSetting, setHardwareSetting] = useState<HardwareSetting>(() => {
    return readStoredValue<HardwareSetting>('itred_pos_hardware_setting', {
      laserFocus: 'LASER_FOCUS: INTENSE_RED',
      drawerSignal: '12VDC_ELECTRO_M_PULSE'
    });
  });

  const [taxSetting, setTaxSetting] = useState<TaxSetting>(() => {
    return readStoredValue<TaxSetting>('itred_pos_tax_setting', {
      vatRatePct: 10,
      surtaxPct: 2,
      inclusive: true
    });
  });

  const [receiptSetting, setReceiptSetting] = useState<ReceiptSetting>(() => {
    return {
      ...DEFAULT_RECEIPT_SETTING,
      ...readStoredValue<ReceiptSetting>('itred_pos_receipt_setting', DEFAULT_RECEIPT_SETTING)
    };
  });

  // Setup options (States)
  const [receiptHeader, setReceiptHeader] = useState(() => {
    return readStoredText('itred_pos_conf_receipt_head', 'iTred Commerce POS');
  });

  const [terminalUnit, setTerminalUnit] = useState(() => {
    const storedTerminal = readStoredText('itred_pos_conf_term_id', 'TERM-MAIN-001');
    return storedTerminal === 'REGISTER_UNIT_NORTH_B2' ? 'TERM-MAIN-001' : storedTerminal;
  });

  const [activeOperatorName, setActiveOperatorName] = useState(() => {
    const storedOperator = readStoredText('itred_pos_conf_operator', 'Owner');
    return storedOperator === 'SYS_ADMIN' ? 'Owner' : storedOperator;
  });

  // Synchronise localStorage writes on mutations
  useEffect(() => {
    saveLocalProducts(products, false, activeSession?.vendorId);
  }, [activeSession?.vendorId, products]);

  useEffect(() => {
    const refreshProducts = () => setProducts(loadLocalProducts(activeSession?.vendorId));
    window.addEventListener(POS_PRODUCT_STORE_EVENT, refreshProducts);
    return () => window.removeEventListener(POS_PRODUCT_STORE_EVENT, refreshProducts);
  }, [activeSession?.vendorId]);

  useEffect(() => {
    writeStoredValue(getVendorScopedStorageKey('itred_pos_transactions', activeSession?.vendorId), transactions);
  }, [activeSession?.vendorId, transactions]);

  useEffect(() => {
    writeStoredValue(getVendorScopedStorageKey('itred_pos_cash_logs', activeSession?.vendorId), cashLogs);
  }, [activeSession?.vendorId, cashLogs]);

  useEffect(() => {
    if (activeShift) {
      writeStoredValue(getVendorScopedStorageKey('itred_pos_active_shift', activeSession?.vendorId), activeShift);
    } else {
      removeStoredValue(getVendorScopedStorageKey('itred_pos_active_shift', activeSession?.vendorId));
    }
  }, [activeSession?.vendorId, activeShift]);

  useEffect(() => {
    writeStoredValue(getVendorScopedStorageKey('itred_pos_shifthistory', activeSession?.vendorId), shiftHistory);
  }, [activeSession?.vendorId, shiftHistory]);

  useEffect(() => {
    writeStoredValue(getVendorScopedStorageKey('itred_pos_bi_events', activeSession?.vendorId), biEvents);
  }, [activeSession?.vendorId, biEvents]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_receipt_head', receiptHeader);
  }, [receiptHeader]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_term_id', terminalUnit);
  }, [terminalUnit]);

  useEffect(() => {
    writeStoredValue('itred_pos_conf_operator', activeOperatorName);
  }, [activeOperatorName]);

  useEffect(() => {
    if (activeSession) {
      initializeEmptyVendorOperationalStores(activeSession.vendorId);
      writeStoredValue('itred_pos_active_session', activeSession);
      setActiveOperatorName(activeSession.staffName);
      setTerminalUnit(activeSession.terminal);
    } else {
      removeStoredValue('itred_pos_active_session');
    }
  }, [activeSession]);

  useEffect(() => {
    if (!activeSession) return;
    const vendorAuth = readPosAuthContext();
    const normalizedSession = normalizeSessionForVendorRuntime(activeSession, businessProfile, vendorAuth);
    const changed =
      normalizedSession.vendor !== activeSession.vendor ||
      normalizedSession.vendorId !== activeSession.vendorId ||
      normalizedSession.branch !== activeSession.branch ||
      normalizedSession.branchId !== activeSession.branchId ||
      normalizedSession.terminal !== activeSession.terminal ||
      normalizedSession.terminalId !== activeSession.terminalId ||
      normalizedSession.planId !== activeSession.planId ||
      normalizedSession.licenseMode !== activeSession.licenseMode ||
      normalizedSession.storageMode !== activeSession.storageMode;

    if (changed) {
      setActiveSession(normalizedSession);
    }
  }, [activeSession, businessProfile]);

  useEffect(() => {
    writeStoredValue('itred_pos_business_profile', businessProfile);
  }, [businessProfile]);

  useEffect(() => {
    writeStoredValue('itred_pos_branches', branches);
  }, [branches]);

  useEffect(() => {
    writeStoredValue('itred_pos_warehouses', warehouses);
  }, [warehouses]);

  useEffect(() => {
    writeStoredValue('itred_pos_terminals', terminalsSetting);
  }, [terminalsSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_staff', staffSetting);
  }, [staffSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_hardware_setting', hardwareSetting);
  }, [hardwareSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_tax_setting', taxSetting);
  }, [taxSetting]);

  useEffect(() => {
    writeStoredValue('itred_pos_receipt_setting', receiptSetting);
  }, [receiptSetting]);

  // Dynamic authorization check & routing redirect logic. Staff Access Rights is the single source.
  useEffect(() => {
    const userRole = activeSession ? activeSession.role : 'SysAdmin';
    const allowed = getEffectivePageIdsForRole(userRole);
    if (allowed && !allowed.includes(activePage)) {
      if (allowed.length > 0) {
        setActivePage(allowed[0]);
      }
    }
  }, [activeSession, activePage]);

  useEffect(() => {
    recordSecurityMatrixEvent({
      eventType: 'PERMISSION_SOURCE_UNIFIED',
      label: 'Permission Source Unified',
      message: 'Navigation now uses Staff Access Rights effective permissions instead of the retired Roles & Permissions state.'
    });
    recordSecurityMatrixEvent({
      eventType: 'DUPLICATE_PERMISSION_STATE_DISABLED',
      label: 'Duplicate Permission State Disabled',
      message: 'Legacy role permission checkbox state is no longer used for access control.'
    });
  }, []);

  useEffect(() => {
    const role = activeSession?.role || 'SysAdmin';
    recordSecurityMatrixEvent({
      eventType: 'ROLE_MENU_ACCESS_RECALCULATED',
      label: 'Role Menu Access Recalculated',
      message: `Menu access recalculated from Staff Access Rights for ${role}.`,
      roleKey: normalizeRoleKey(role)
    });
    recordSecurityMatrixEvent({
      eventType: 'STAFF_ROLE_NAVIGATION_APPLIED',
      label: 'Staff Role Navigation Applied',
      message: `Navigation links applied for ${role} using effective permissions.`,
      roleKey: normalizeRoleKey(role)
    });
  }, [activeSession?.role]);


  // Mutators exposed to pages
  const handleUpdateProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
  };

  const handleProductStockChange = (productId: string, quantitySold: number) => {
    setProducts(updateLocalProductStock(productId, -quantitySold));
  };

  const handleUpdateStockLevel = (productId: string, nextStock: number) => {
    setProducts(prev => 
      prev.map(p => {
        if (p.id === productId) {
          const nextStatus = nextStock === 0 ? 'Out of Stock' : (nextStock <= p.minStock ? 'Low Stock' : p.healthStatus || 'In Stock');
          return {
            ...p,
            stock: nextStock,
            healthStatus: nextStatus as any,
            lastMovementDate: new Date().toISOString().substring(0, 10)
          };
        }
        return p;
      })
    );
  };

  const handleUpdateMinStockThreshold = (productId: string, nextMin: number) => {
    setProducts(prev => 
      prev.map(p => p.id === productId ? { ...p, minStock: nextMin } : p)
    );
  };

  const handleAddProduct = (newProd: Omit<Product, 'id'>) => {
    if (productLimitReached) {
      setPlanLimitNotice(productLimitMessage);
      window.setTimeout(() => setPlanLimitNotice(''), 4500);
      return;
    }
    const id = 'prod-' + Math.floor(Math.random() * 89999 + 10000);
    setProducts(prev => [...prev, { ...newProd, id }]);
  };

  const handleAddTransaction = (newTxData: Omit<Transaction, 'id' | 'invoiceNo' | 'date'>) => {
    const id = 'TXN-' + Math.floor(Math.random() * 89999 + 10000);
    const invoiceNo = 'INV-' + Math.floor(Math.random() * 899999 + 100000);
    const date = new Date().toISOString();

    const completeTx: Transaction = {
      ...newTxData,
      id,
      invoiceNo,
      date
    };

    setTransactions(prev => [...prev, completeTx]);

    // Also update active shift tally registers if shift is active!
    if (activeShift) {
      setActiveShift(prev => {
        if (!prev) return null;
        return {
          ...prev,
          salesCount: prev.salesCount + 1,
          totalSales: prev.totalSales + completeTx.total
        };
      });
    }

    // Write cash log row automated if the payment was CASH! Let's link it!
    if (completeTx.paymentMethod === 'CASH') {
      const logId = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
      const cashLogData: CashLog = {
        id: logId,
        timestamp: date,
        type: 'PAY_IN',
        amount: completeTx.total,
        reason: `AUTO SALE CASH_FLOW INVOICE: [${invoiceNo}]`,
        operator: completeTx.operator
      };
      setCashLogs(prev => [...prev, cashLogData]);
    }
  };

  const handleLogBiEvent = (
    eventType: BiEvent['eventType'],
    operator: string,
    terminal: string,
    payload: BiEvent['payload'],
    severity: BiEvent['severity']
  ) => {
    const newEvent: BiEvent = {
      id: 'BI-EV-' + Math.floor(Math.random() * 89999 + 10000),
      timestamp: new Date().toISOString(),
      eventType,
      operator,
      terminal,
      payload,
      severity
    };
    setBiEvents(prev => [newEvent, ...prev]);
  };

  // Cash solenoid flow triggers
  const handleAddCashLog = (type: CashLog['type'], amount: number, reason: string) => {
    const id = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
    const date = new Date().toISOString();
    const newLog: CashLog = {
      id,
      timestamp: date,
      type,
      amount,
      reason,
      operator: activeOperatorName
    };

    setCashLogs(prev => [...prev, newLog]);
  };

  // Shift gates functions
  const handleOpenShift = (operatorName: string, startingFloat: number) => {
    const id = 'SHIFT-' + new Date().toISOString().substring(0, 10) + '-' + Math.floor(Math.random() * 90 + 10);
    const newShift: Shift = {
      id,
      operator: operatorName,
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      startingCash: startingFloat,
      expectedCash: startingFloat,
      salesCount: 0,
      totalSales: 0
    };

    setActiveShift(newShift);
    
    // Clear today's operational transactions and write initial logs to make the session fully clean!
    setTransactions([]);
    
    const logId = 'CL-' + Math.floor(Math.random() * 8999 + 1000);
    const initialLog: CashLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      type: 'INITIAL',
      amount: startingFloat,
      reason: `SHIFT BOOT INITIAL REGISTRY FLOAT ENTRY FOR OP [${operatorName}]`,
      operator: operatorName
    };
    setCashLogs([initialLog]);

    // Log BI Event
    handleLogBiEvent(
      'SHIFT_OPENED',
      operatorName,
      terminalUnit,
      { floatAmount: startingFloat, details: `Shift opened on terminal ${terminalUnit}` },
      'INFO'
    );
  };

  const handleCloseShift = (actualFloat: number) => {
    if (!activeShift) return;

    // Calculate actual drawer cash sales
    const todayCashSales = transactions
      .filter(t => t.status === 'COMPLETED' && t.paymentMethod === 'CASH')
      .reduce((sum, t) => sum + t.total, 0);

    const payInEvents = cashLogs.filter(l => l.type === 'PAY_IN').reduce((sum, l) => sum + l.amount, 0);
    const payOutEvents = cashLogs.filter(l => l.type === 'PAY_OUT' || l.type === 'SAFE_DROP').reduce((sum, l) => sum + l.amount, 0);

    const computedExpected = activeShift.startingCash + todayCashSales + payInEvents - payOutEvents;
    const difference = actualFloat - computedExpected;

    const finalizedShift: Shift = {
      ...activeShift,
      status: 'CLOSED',
      endTime: new Date().toISOString(),
      expectedCash: computedExpected,
      actualCash: actualFloat,
      difference: difference
    };

    setShiftHistory(prev => [finalizedShift, ...prev]);
    setActiveShift(null);
    setTransactions([]); // flush registers for lockout state
    setCashLogs([]); // flush logs

    // Log BI Shift Closed Event
    handleLogBiEvent(
      'SHIFT_CLOSED',
      activeShift.operator,
      terminalUnit,
      {
        floatAmount: activeShift.startingCash,
        salesTotal: activeShift.totalSales,
        expectedCash: computedExpected,
        actualCash: actualFloat,
        difference: difference,
        details: `Shift closed on terminal ${terminalUnit}. Expected cash sum: $${computedExpected.toFixed(2)}, Counted actual: $${actualFloat.toFixed(2)}`
      },
      difference !== 0 ? 'WARNING' : 'INFO'
    );

    // If there is ANY cash variance, also log a specialized CASH_VARIANCE_FOUND BI alert!
    if (difference !== 0) {
      handleLogBiEvent(
        'CASH_VARIANCE_FOUND',
        activeShift.operator,
        terminalUnit,
        {
          expectedCash: computedExpected,
          actualCash: actualFloat,
          difference: difference,
          details: `Shift closed with a cash mismatch. Variance calculated: $${difference.toFixed(2)}`
        },
        'CRITICAL'
      );
    }
  };

  // Hard Reset Core
  const handleResetAllState = () => {
    [
      'itred_pos_products',
      'itred_pos_transactions',
      'itred_pos_cash_logs',
      'itred_pos_active_shift',
      'itred_pos_shifthistory',
      'itred_pos_conf_receipt_head',
      'itred_pos_conf_term_id',
      'itred_pos_conf_operator',
      'itred_pos_bi_events',
      'itred_pos_business_profile',
      'itred_pos_branches',
      'itred_pos_warehouses',
      'itred_pos_terminals',
      'itred_pos_staff',
      'itred_pos_role_permissions',
      'itred_pos_hardware_setting',
      'itred_pos_tax_setting',
      'itred_pos_receipt_setting'
    ].forEach((key) => {
      removeStoredValue(key);
      removeStoredValue(getVendorScopedStorageKey(key, activeSession?.vendorId));
    });

    setProducts(INITIAL_PRODUCTS);
    setTransactions(INITIAL_TRANSACTIONS);
    setCashLogs(INITIAL_CASH_LOGS);
    setShiftHistory([]);
    setBiEvents(INITIAL_BI_EVENTS);
    setActiveShift(null);
    setReceiptHeader('iTred Commerce POS');
    setTerminalUnit('TERM-MAIN-001');
    setActiveOperatorName('Owner');

    setBusinessProfile(ENABLE_MOCK_SEED_DATA ? mockSettings.businessProfile : businessProfile);
    setBranches(ENABLE_MOCK_SEED_DATA ? mockBranches : branches);
    setWarehouses(ENABLE_MOCK_SEED_DATA ? mockWarehouses : warehouses);
    setTerminalsSetting(ENABLE_MOCK_SEED_DATA ? mockTerminals : terminalsSetting);
    setStaffSetting(ENABLE_MOCK_SEED_DATA ? mockStaff : staffSetting);
    setHardwareSetting({
      laserFocus: 'LASER_FOCUS: INTENSE_RED',
      drawerSignal: '12VDC_ELECTRO_M_PULSE'
    });
    setTaxSetting({
      vatRatePct: 10,
      surtaxPct: 2,
      inclusive: true
    });
    setReceiptSetting({
      ...DEFAULT_RECEIPT_SETTING
    });

    setActivePage('DASHBOARD');
  };

  const handleGoogleAuthBeforeStaffAccess = async () => {
    const existingProfile = getCurrentFirebaseUserProfile();
    if (existingProfile) {
      setAuthUser(existingProfile);
      setGoogleAuthMessage('Google session found. Checking POS activation...');
      await validateAndApplyPOSActivation(existingProfile);
      return;
    }

    setGoogleAuthMessage('Opening Google sign-in...');
    setAuthError(null);
    const result = await signInWithGooglePlaceholder();

    if (!result.ok) {
      setAuthError(result.error || result.message || 'Google sign-in failed. Check Firebase Auth configuration.');
      setGoogleAuthMessage(result.message || 'Google sign-in failed. Check Firebase Auth configuration.');
      return;
    }
  };

  const handlePOSSignOut = async () => {
    await signOutFirebasePlaceholder();
    setAuthUser(null);
    setAuthError(null);
    setLicenseChecked(false);
    setActivationDecision(null);
    clearActivePOSActivation();
    setActiveSession(null);
  };

  // Render loading state while authenticating
  if (false && authLoading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-orange-500/40 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">iTred Commerce POS</p>
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
            <h1 className="text-lg font-black uppercase text-white">Checking Google session...</h1>
          </div>
          <p className="text-xs text-slate-400">Verifying authentication token and secure keys...</p>
        </section>
      </main>
    );
  }

  // Guard the operational register with Google Auth before staff access
  if (false && !googleAuthProfile) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-orange-500/40 bg-slate-900 p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">iTred Commerce POS</p>
          <h1 className="mt-3 text-2xl font-black uppercase text-white">Vendor Sign In</h1>
          <p className="mt-3 text-sm text-slate-300">
            Sign in with Google first. After vendor verification, the normal Staff Access form will open.
          </p>
          <div className="mt-5 border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
            {authError || googleAuthMessage}
          </div>
          <button
            type="button"
            onClick={() => void handleGoogleAuthBeforeStaffAccess()}
            className="mt-5 w-full border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-black uppercase text-slate-950 hover:bg-orange-400"
          >
            Sign in with Google
          </button>
        </section>
      </main>
    );
  }

  if (SHOW_DEV_BADGES && googleAuthProfile && !activationChecking && activationResult && !activationResult.allowed) {
    const blockedActivation = activationResult.activation;
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-lg border border-rose-500/40 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-400">POS License Blocked</p>
          <h1 className="text-xl font-black uppercase text-white">POS Access Denied</h1>
          <div className="border border-rose-700 bg-slate-950 p-3 text-xs text-rose-300 font-bold">
            {activationResult.message}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            <div className="border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300 font-black uppercase">
              <span className="block text-slate-500">Authenticated Google Email</span>
              <span className="text-slate-100 normal-case break-all">{googleAuthProfile.email || 'Unknown'}</span>
            </div>
            <div className="border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300 font-black uppercase">
              <span className="block text-slate-500">Reason</span>
              <span className="text-rose-300">{activationResult.reasonCode}</span>
            </div>
            <div className="border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300 font-black uppercase">
              <span className="block text-slate-500">License Status</span>
              <span className="text-slate-100">{blockedActivation?.status || 'Not available'}</span>
            </div>
            <div className="border border-slate-700 bg-slate-950 p-3 text-[10px] text-slate-300 font-black uppercase">
              <span className="block text-slate-500">Expiry</span>
              <span className="text-slate-100">{blockedActivation?.expiresAt || 'Not available'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Contact an administrator to link this Google account or correct the activation record.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handlePOSSignOut()}
              className="w-full border border-slate-600 bg-slate-800 hover:bg-slate-700 px-4 py-3 text-sm font-black uppercase text-white"
            >
              Sign Out
            </button>
            <button
              type="button"
              onClick={() => void handlePOSSignOut()}
              className="w-full border border-rose-500 bg-rose-600 hover:bg-rose-500 px-4 py-3 text-sm font-black uppercase text-white"
            >
              Try Another Account
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (SHOW_DEV_BADGES && googleAuthProfile && (activationChecking || !licenseChecked)) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <section className="w-full max-w-md border border-emerald-500/40 bg-slate-900 p-6 shadow-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">POS Activation</p>
          <h1 className="mt-3 text-2xl font-black uppercase text-white">Checking Activation</h1>
          <div className="mt-5 border border-emerald-700 bg-slate-950 p-3 text-xs text-emerald-300 font-bold text-center">
            Reading sci_pos_activations for {googleAuthProfile.email}
          </div>
          <p className="mt-4 text-xs text-slate-400 leading-relaxed">
            POS access opens only when the activation record is active, unexpired, and compatible with the requested storage mode.
          </p>
        </section>
      </main>
    );
  }

  // Guard the operational register with our heavy security staff access screen
  if (!activeSession) {
    return (
      <PosStaffAccess 
        onLoginSuccess={(session) => {
          const tenant = getCurrentTenantSession();
          const posSession = getSavedPOSSession();
          setActiveSession(normalizeSessionForVendorRuntime({
            ...session,
            vendorId: tenant.vendorId,
            branchId: tenant.branchId,
            terminalId: tenant.terminalId,
            licenseId: tenant.licenseId,
            planId: tenant.planId,
            licenseMode: tenant.licenseMode,
            storageMode: tenant.storageMode,
            activationId: tenant.activationId,
            dashboardType: posSession?.dashboardType || 'POS',
            openedAt: posSession?.openedAt || new Date().toISOString()
          }, businessProfile, readPosAuthContext()));
        }}
        onBackToBios={() => {
          window.history.pushState({}, '', '/');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }}
      />
    );
  }

  const authContextForUpgrade = readPosAuthContext();
  const upgradeVendorContext = buildUpgradeVendorContext(businessProfile, authContextForUpgrade, activeSession);

  if (runtimeLicense && !runtimeLicense.allowed) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] p-6">
        <UpgradeRequiredPanel
          featureName={licenseBlockTitle(runtimeLicense)}
          currentPlan={planAccess.planCode}
          requiredPlan={getNextPlanCode(planAccess.planCode)}
          vendor={upgradeVendorContext}
          detail={runtimeLicense.noticeDetail || 'Contact SCI support to restore POS access.'}
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      </main>
    );
  }

  const allowedForAccess = getEffectivePageIdsForRole(activeSession.role);
  const isPageRestricted = !allowedForAccess.includes(activePage);
  const activePagePlanAccess = planAccess.pageAccess[activePage];
  const isPagePlanLocked = !isPageRestricted && Boolean(activePagePlanAccess && !activePagePlanAccess.allowed);
  const posTenantName = resolveVendorDisplayName(businessProfile, readPosAuthContext(), activeSession);
  const authContextForNotice = authContextForUpgrade;
  const trialDaysRemaining = getTrialDaysRemaining();
  const licenseNotice = runtimeLicense && runtimeLicense.noticeKind !== 'active'
    ? {
      title: runtimeLicense.noticeTitle,
      detail: runtimeLicense.noticeDetail,
      kind: runtimeLicense.noticeKind
    }
    : (activeSession.licenseMode === 'trial' || activeSession.licenseMode === 'demo')
      ? {
        title: 'Trial Plan Active',
        detail: trialDaysRemaining === null ? 'Trial access enabled' : `${trialDaysRemaining} Days Remaining`,
        kind: 'trial'
      }
      : authContextForNotice?.activationStatus === 'PendingConsoleVerification'
        ? {
          title: 'Account Pending Verification',
          detail: 'Trial access remains available while SCI reviews your registration.',
          kind: 'pending'
        }
        : null;

  return (
    <PosShell
      activePage={activePage}
      onPageChange={setActivePage}
      terminalId={terminalUnit}
      activeOperator={activeOperatorName}
      activeShiftStatus={activeShift ? 'ACTIVE' : 'CLOSED'}
      activeSession={activeSession}
      onSignOut={() => void handlePOSSignOut()}
      allowedPages={allowedForAccess}
      planLockedPages={planLockedPages}
      tenantName={posTenantName}
      tenantLogo={receiptSetting.logoDataUrl}
    >
      {licenseNotice && (
        SHOW_DEV_BADGES ? (
          <>
            <div className="pos-demo-watermark" aria-hidden="true">Diagnostics</div>
            <div className="pos-demo-mode-chip">
              Diagnostics enabled
            </div>
          </>
        ) : (
          <div className="pos-trial-plan-chip" role="status">
            <strong>{licenseNotice.title}</strong>
            <span>{licenseNotice.detail}</span>
          </div>
        )
      )}
      {planLimitNotice && (
        <UpgradeRequiredPanel
          featureName="Plan Limit"
          currentPlan={planAccess.planCode}
          requiredPlan={getNextPlanCode(planAccess.planCode)}
          vendor={upgradeVendorContext}
          detail={planLimitNotice}
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      )}
      {!planLimitNotice && activePage === 'DASHBOARD' && licenseNotice && (licenseNotice.kind === 'trial' || licenseNotice.kind === 'pending') && (
        <UpgradeRequiredPanel
          featureName="Plan Upgrade"
          currentPlan={planAccess.planCode}
          requiredPlan={getNextPlanCode(planAccess.planCode)}
          vendor={upgradeVendorContext}
          detail={licenseNotice.detail}
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      )}
      {/* Dynamic page switches */}
      {isPageRestricted ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] border border-rose-800 bg-slate-950/60 p-8 font-mono space-y-4 max-w-xl mx-auto my-12">
          <div className="p-3 bg-rose-950/20 border border-rose-500/40 text-rose-500 animate-pulse">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-sm font-black text-rose-500 tracking-wider uppercase">SECURITY CLEARANCE ALERT</h2>
            <p className="text-xs text-slate-450 uppercase leading-relaxed">
              Access restricted for your current role. <span className="text-amber-500 font-bold">({activeSession?.role})</span>
            </p>
          </div>
          <div className="w-full h-px bg-slate-900 my-2"></div>
          <p className="text-[9px] text-slate-500 text-center uppercase tracking-wider">
            AUTHENTICATION LOG SYSTEM RE-ROUTE ATTEMPT REGISTERED / GATEWAY IS LOCK_ON
          </p>
          <button 
            onClick={() => setActivePage('DASHBOARD')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-[#00f0ff] uppercase tracking-wider font-bold cursor-pointer transition-colors"
          >
            Return to Operator Dashboard
          </button>
        </div>
      ) : isPagePlanLocked ? (
        <UpgradeRequiredPanel
          featureName={activePagePlanAccess.featureName}
          currentPlan={planAccess.planCode}
          requiredPlan={String(activePagePlanAccess.requiredPlan)}
          vendor={upgradeVendorContext}
          detail="This feature is not included in your current plan."
          onActivated={(result) => setPlanLimitNotice(result.message)}
        />
      ) : (
        <>
          {activePage === 'DASHBOARD' && (
            <PosDashboard 
              products={products}
              transactions={transactions}
              activeShift={activeShift}
              cashLogs={cashLogs}
              onNavigate={(page) => setActivePage(page as PosPageId)}
              session={activeSession}
              businessProfile={businessProfile}
            />
          )}

      {activePage === 'OWNER_DESK' && (
        <PosOwnerDesk 
          session={activeSession}
        />
      )}

      {activePage === 'SALES' && (
        <PosSales 
          products={products}
          onProductStockChange={handleProductStockChange}
          onAddTransaction={handleAddTransaction}
          onNavigate={(page) => setActivePage(page as PosPageId)}
          activeShiftOperator={activeShift ? activeShift.operator : null}
          session={activeSession}
        />
      )}

      {activePage === 'SALES_HISTORY' && (
        <PosSalesHistory session={activeSession} onNavigate={(page) => setActivePage(page as PosPageId)} />
      )}

      {activePage === 'CUSTOMER_CENTRE' && (
        <PosCustomerDesk session={activeSession} onNavigate={(page) => setActivePage(page as PosPageId)} />
      )}

      {activePage === 'DELIVERY' && (
        <PosDeliveryDesk 
          session={activeSession}
        />
      )}

      {activePage === 'STOCK' && (
        <PosStock 
          products={products}
          onAddProduct={handleAddProduct}
          onUpdateStock={handleUpdateStockLevel}
          onUpdateMinStock={handleUpdateMinStockThreshold}
          onUpdateProduct={handleUpdateProduct}
          session={activeSession}
          planAccess={planAccess}
          productLimitReached={productLimitReached}
          productLimitMessage={productLimitMessage}
        />
      )}

      {activePage === 'CREDITORS' && (
        <PosCreditors session={activeSession} />
      )}

      {activePage === 'PURCHASE_DISCIPLINE' && (
        <PosPurchaseDiscipline session={activeSession} />
      )}

      {activePage === 'TASK_DESK' && (
        <PosTaskDesk session={activeSession} onNavigate={(page) => setActivePage(page)} />
      )}

      {activePage === 'APPROVALS' && (
        <PosApprovals session={activeSession} onNavigate={(page) => setActivePage(page)} />
      )}

      {activePage === 'SHIFT' && (
        <PosShift 
          activeShift={activeShift}
          shiftHistory={shiftHistory}
          transactions={transactions}
          onOpenShift={handleOpenShift}
          onCloseShift={handleCloseShift}
          terminalId={terminalUnit}
          activeOperator={activeOperatorName}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          cashLogs={cashLogs}
          session={activeSession}
          onNavigate={(page) => setActivePage(page as PosPageId)}
        />
      )}

      {activePage === 'CASH' && (
        <PosCash 
          cashLogs={cashLogs}
          activeShift={activeShift}
          onAddCashLog={handleAddCashLog}
          terminalId={terminalUnit}
          activeOperator={activeOperatorName}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          transactions={transactions}
          session={activeSession}
        />
      )}

      {activePage === 'FINANCIAL_CONTROL' && (
        <PosFinancialControl session={activeSession} />
      )}

      {activePage === 'REPORTS' && (
        <Suspense fallback={<div className="sci-pos-card pos-lazy-loading">Loading reports...</div>}>
          <PosReports
            products={products}
            transactions={transactions}
            cashLogs={cashLogs}
            session={activeSession}
            businessProfile={businessProfile}
          />
        </Suspense>
      )}

      {activePage === 'BI_DESK' && (
        <PosBIDesk 
          transactions={transactions}
          products={products}
          biEvents={biEvents}
          onLogBiEvent={handleLogBiEvent}
          session={activeSession}
        />
      )}

      {activePage === 'SYNC_DESK' && (
        <PosSyncDesk 
          session={activeSession}
        />
      )}

      {activePage === 'HELP_DESK' && (
        <PosHelpDesk
          session={activeSession}
          onNavigate={(page) => setActivePage(page)}
        />
      )}

      {activePage === 'SETTINGS' && (
        <PosSettings 
          businessProfile={businessProfile}
          onUpdateBusinessProfile={setBusinessProfile}
          branches={branches}
          onUpdateBranches={setBranches}
          warehouses={warehouses}
          onUpdateWarehouses={setWarehouses}
          terminals={terminalsSetting}
          onUpdateTerminals={setTerminalsSetting}
          staff={staffSetting}
          onUpdateStaff={setStaffSetting}
          hardwareSetting={hardwareSetting}
          onUpdateHardwareSetting={setHardwareSetting}
          taxSetting={taxSetting}
          onUpdateTaxSetting={setTaxSetting}
          receiptSetting={receiptSetting}
          onUpdateReceiptSetting={setReceiptSetting}
          receiptHeader={receiptHeader}
          onUpdateReceiptHeader={setReceiptHeader}
          terminalUnit={terminalUnit}
          onUpdateTerminalUnit={setTerminalUnit}
          onResetAllState={handleResetAllState}
          activeOperatorName={activeOperatorName}
          onUpdateOperatorName={setActiveOperatorName}
          activeRole={activeSession?.role}
          planAccess={planAccess}
        />
      )}
        </>
      )}
    </PosShell>
  );
}




