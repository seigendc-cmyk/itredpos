import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../pos-new/firebase/firebaseApp";
import type { VendorRecord } from "../schemas";
import { FIRESTORE_COLLECTIONS } from "./firestoreCollections";

function assertDb() {
  if (!db) throw new Error("Firebase is not ready.");
}

export async function createVendorRecord(vendor: VendorRecord): Promise<void> {
  assertDb();
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, vendor.vendorId), vendor, { merge: false });
}

export async function upsertVendorRecord(vendor: VendorRecord): Promise<void> {
  assertDb();
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, vendor.vendorId), vendor, { merge: true });
}

export async function getVendorById(vendorId: string): Promise<VendorRecord | null> {
  assertDb();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, vendorId));
  return snap.exists() ? snap.data() as VendorRecord : null;
}

export async function updateVendorRecord(vendorId: string, patch: Partial<VendorRecord>): Promise<void> {
  assertDb();
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.vendors, vendorId), {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}
