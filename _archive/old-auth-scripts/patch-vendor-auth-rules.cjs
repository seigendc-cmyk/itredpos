const fs = require("fs");

function patchFile(path, patcher) {
  if (!fs.existsSync(path)) {
    console.log("Missing:", path);
    return;
  }
  const before = fs.readFileSync(path, "utf8");
  const after = patcher(before);
  if (before === after) {
    console.log("No change:", path);
    return;
  }
  fs.writeFileSync(path, after, "utf8");
  console.log("Patched:", path);
}

// 1. Patch Firestore rules if firestore.rules exists
patchFile("firestore.rules", (text) => {
  text = text.replace(
`    match /vendors/{vendorId} {
      allow create: if isSignedIn() && (request.auth.uid == vendorId || isConsoleAdmin());

      allow get, list: if isPublicPublished()
        || (
          isSignedIn() &&
          (
            request.auth.uid == resource.data.get('ownerUid', '') ||
            request.auth.uid == resource.data.get('vendorId', '') ||
            isVendorUser(resource.data.get('vendorId', '')) ||
            isConsoleAdmin()
          )
        );`,
`    match /vendors/{vendorId} {
      allow create: if isSignedIn() && (
        request.auth.uid == vendorId ||
        request.auth.uid == incoming().get('ownerUid', '') ||
        request.auth.uid == incoming().get('googleUid', '') ||
        request.auth.token.email == incoming().get('ownerEmail', '') ||
        isConsoleAdmin()
      );

      allow get, list: if isPublicPublished()
        || (
          isSignedIn() &&
          (
            request.auth.uid == resource.data.get('ownerUid', '') ||
            request.auth.uid == resource.data.get('googleUid', '') ||
            request.auth.uid == resource.data.get('vendorId', '') ||
            request.auth.token.email == resource.data.get('ownerEmail', '') ||
            isVendorUser(resource.data.get('vendorId', '')) ||
            isConsoleAdmin()
          )
        );`
  );
  return text;
});

// 2. Patch POS vendor provisioning service to include ownerUid
patchFile("src/pos-new/vendor/vendorProvisioningService.ts", (text) => {
  if (text.includes("ownerUid: authContext.googleUid")) return text;

  text = text.replace(
    `googleUid: authContext.googleUid || undefined,`,
    `googleUid: authContext.googleUid || undefined,
    ownerUid: authContext.googleUid || undefined,`
  );

  return text;
});

// 3. Patch SCI Firebase service to write ownerUid + vendorUsers where possible
patchFile("src/sci-auth/VendorFirebaseService.ts", (text) => {
  if (!text.includes("ownerUid") && text.includes("googleUid:")) {
    text = text.replace(
      `googleUid: profile.uid,`,
      `googleUid: profile.uid,
      ownerUid: profile.uid,`
    );
  }

  if (!text.includes("vendorUsers") && text.includes("writeBatch")) {
    text = text.replace(
      /(batch\.set\([^;]+vendors[^;]+;\s*)/,
      `$1
  batch.set(doc(db, "vendorUsers", profile.uid), {
    uid: profile.uid,
    vendorId,
    email: profile.email,
    role: "owner",
    status: "active",
    permissions: ["*"],
    createdAt: now,
    updatedAt: now
  });
`
    );
  }

  return text;
});

console.log("Patch complete.");
