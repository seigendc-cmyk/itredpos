require("dotenv").config();

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const vendorId = "test-vendor-001";
  const now = new Date().toISOString();

  await setDoc(doc(db, "vendorRegistrations", vendorId), {
    vendorId,
    businessName: "Test Vendor 001",
    tradingName: "Test Vendor 001",
    ownerName: "Build Owner",
    ownerEmail: "owner@build.local",
    phone: "0770000000",
    whatsapp: "0770000000",
    city: "Harare",
    suburb: "Southview",
    status: "Pending",
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  await setDoc(doc(db, "vendors", vendorId), {
    vendorId,
    businessName: "Test Vendor 001",
    tradingName: "Test Vendor 001",
    ownerName: "Build Owner",
    ownerEmail: "owner@build.local",
    phone: "0770000000",
    whatsapp: "0770000000",
    city: "Harare",
    suburb: "Southview",
    status: "Verified",
    verificationStatus: "Verified",
    syncStatus: "Synced",
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  await setDoc(doc(db, "vendorLicenses", vendorId), {
    vendorId,
    vendorName: "Test Vendor 001",
    planCode: "STARTER",
    licenseMode: "trial",
    status: "PendingActivation",
    activationStatus: "Pending",
    createdAt: now,
    updatedAt: now
  }, { merge: true });

  console.log("Seeded test vendor:", vendorId);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
