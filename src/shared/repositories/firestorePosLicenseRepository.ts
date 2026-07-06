import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../pos-new/firebase/firebaseApp";
import type { PosLicenseRecord } from "../schemas";
import { FIRESTORE_COLLECTIONS } from "./firestoreCollections";

function assertDb() {
  if (!db) throw new Error("Firebase is not ready.");
}

export async function upsertPosLicenseRecord(license: PosLicenseRecord): Promise<void> {
  assertDb();
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.posLicenses, license.licenseId), license, { merge: true });
}

export async function getPosLicenseById(licenseId: string): Promise<PosLicenseRecord | null> {
  assertDb();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.posLicenses, licenseId));
  return snap.exists() ? snap.data() as PosLicenseRecord : null;
}

export async function updatePosLicenseRecord(licenseId: string, patch: Partial<PosLicenseRecord>): Promise<void> {
  assertDb();
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.posLicenses, licenseId), {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}
