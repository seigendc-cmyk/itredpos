const fs = require("fs");
const path = "src/pos-new/auth/firebaseAuthShell.ts";
let text = fs.readFileSync(path, "utf8");

text = text.replace(
  "GoogleAuthProvider, onAuthStateChanged, signInWithRedirect, getRedirectResult, signOut, type User",
  "GoogleAuthProvider, onAuthStateChanged, signInWithPopup, getRedirectResult, signOut, type User"
);

text = text.replace(
`    const provider = new GoogleAuthProvider();
    await signInWithRedirect(auth, provider);
    return { ok: true, status: 'Signed In', message: 'Google redirect initiated.' };`,
`    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    currentProfile = buildFirebaseUserProfile(result.user);
    return { ok: true, status: 'Signed In', message: 'Google sign-in completed.', profile: currentProfile };`
);

text = text.replaceAll("GOOGLE_SIGN_IN_REDIRECT_STARTED", "GOOGLE_SIGN_IN_POPUP_STARTED");
text = text.replaceAll("Google Sign-In Redirect Started", "Google Sign-In Popup Started");
text = text.replaceAll("Google sign-in redirect started.", "Google sign-in popup started.");
text = text.replaceAll("GOOGLE_SIGN_IN_REDIRECT_FAILED", "GOOGLE_SIGN_IN_POPUP_FAILED");
text = text.replaceAll("Google Sign-In Redirect Failed", "Google Sign-In Popup Failed");
text = text.replaceAll("Google redirect failed.", "Google popup failed.");

fs.writeFileSync(path, text, "utf8");
console.log("Google Auth switched from redirect to popup.");
