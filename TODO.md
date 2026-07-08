# TODO - SCI-AUTH-05

- [ ] Update `src/App.tsx` to ensure only `VendorAuthGate` wraps `/pos-prototype` and remove unused old-gate imports.
- [x] Update `src/App.tsx` to ensure only `VendorAuthGate` wraps `/pos-prototype` and remove unused old-gate imports.
- [ ] Update `src/pos-new/pages/PosStaffAccess.tsx`:

  - [x] Remove `tenantSessionService` dependency.
  - [x] Use only `sci_vendor_owner_session` + `authenticateStaffAccess` (PIN `040369`).
  - [x] Ensure wrong PIN blocks POS open.
- [ ] Update `src/pos-new/PosPrototypeApp.tsx`:
  - [x] Remove tenantSessionService usage in `PosStaffAccess` success path.
  - [ ] Ensure POS opens immediately after successful Staff Access.
  - [ ] Remove/avoid any blocking Upgrade/license auth UI on entry.

- [ ] Run `npm run build`.
- [ ] Report changed files + runtime flow + build result.

