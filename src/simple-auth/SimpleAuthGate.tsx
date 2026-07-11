import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import SimpleAuthLandingPage from './SimpleAuthLandingPage';
import { readSimpleAuthContext, clearSimpleAuthContext } from './simpleAuthStorage';

// Deprecated: retained for reference only. App.tsx now routes through src/sci-auth/VendorAuthGate.tsx.
interface SimpleAuthGateProps {
  children: ReactNode;
}

const TENANT_SESSION_KEY = 'itred_pos_tenant_session';

export default function SimpleAuthGate({ children }: SimpleAuthGateProps) {
  const initialized = useRef(false);

  if (!initialized.current) {
    initialized.current = true;
    const existing = readSimpleAuthContext();
    if (!existing) {
      return <SimpleAuthLandingPage />;
    }

    const existingTenantSession = (() => {
      try {
        const raw = localStorage.getItem(TENANT_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (!existingTenantSession || existingTenantSession.vendorId !== existing.vendorId) {
      const tenantSession = {
        sessionId: `session-${existing.vendorId}-${Date.now()}`,
        authProvider: 'Google',
        status: 'Tenant Resolved',
        vendorId: existing.vendorId,
        vendorName: existing.vendorName,
        membershipId: `MEM-${existing.vendorId}-POS`,
        membershipRole: 'VendorOwner',
        vendorEmail: existing.ownerEmail,
        firebaseUid: existing.ownerUid,
        googleEmail: existing.ownerEmail,
        staffId: undefined,
        staffName: undefined,
        staffRole: undefined,
        branchId: existing.branchId,
        branchName: 'Main Branch',
        terminalId: 'TERM-MAIN-001',
        terminalName: 'Main POS Terminal',
        licenseId: `${existing.vendorId}-license`,
        planId: 'DEMO',
        licenseMode: 'demo',
        storageMode: 'cloud',
        activationId: `${existing.vendorId}-activation`,
        permissions: ['*'],
        isBuildDevelopmentSession: false,
        authRequired: false,
        tenantResolved: true,
        staffAuthenticated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: 'Simple auth owner session. Staff login still required.'
      };

      localStorage.setItem(TENANT_SESSION_KEY, JSON.stringify(tenantSession));
    }
  }

  return <>{children}</>;
}
