# TODO - AUTH-GOOGLE-01 (auth-google-open-pos-clean)

- [x] Wire Firebase Google auth redirect handling + auth-state subscription into `src/pos-new/auth/PosVendorAuthGate.tsx`.
- [x] Ensure `sci_pos_vendor_auth_context` is populated with `googleUid` and `googleEmail` after Google sign-in.
- [x] Preserve onboarding stage transitions: business setup if no vendor profile, staff access if vendor profile exists, pos if `posReady`.
- [x] Do not reintroduce legacy activation-block screens (no changes to activation/console gating logic).
- [x] Run `npm run build`.
- [ ] Produce report: files changed, auth flow before/after, build result, manual test checklist.


