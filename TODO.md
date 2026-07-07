# TODO - Google Auth activation flow fix

- [ ] AUTH root cause: Google button currently calls placeholder that uses signInWithRedirect, while gate expects redirect result on mount; also missing UI error state.
- [ ] Update src/pos-new/auth/firebaseAuthShell.ts:
  - [ ] Replace signInWithGooglePlaceholder with real signInWithGoogle (use signInWithPopup on localhost; signInWithPopup preferred per requirements)
  - [ ] Ensure disabled/not configured Firebase returns explicit error messages
  - [ ] Keep handleGoogleRedirectResult subscription logic compatible (do not change routing)
- [ ] Update src/pos-new/auth/PosVendorAuthGate.tsx:
  - [ ] Add googleError state and render error message on the same page
  - [ ] On Continue with Google click, call sign-in shell and show errors if sign-in fails
  - [ ] Ensure on successful sign-in we immediately update context with googleUid/googleEmail and stage: resolveNextAuthStage(updatedContext)
  - [ ] Ensure subscribeToFirebaseAuthState updates context when a Google session already exists
- [ ] Run npm run build
- [ ] Manual test steps:
  - [ ] Clear localStorage sci_pos_vendor_auth_context
  - [ ] Reload /pos-prototype
  - [ ] Click Continue with Google
  - [ ] Choose Google account
  - [ ] Verify activation landing page appears

