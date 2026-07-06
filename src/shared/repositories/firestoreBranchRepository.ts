import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../pos-new/firebase/firebaseApp";
import type { BranchRecord } from "../schemas";
import { FIRESTORE_COLLECTIONS } from "./firestoreCollections";

function assertDb() {
  if (!db) throw new Error("Firebase is not ready.");
}

export async function upsertBranchRecord(branch: BranchRecord): Promise<void> {
  assertDb();
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.branches, branch.branchId), branch, { merge: true });
}

export async function getBranchById(branchId: string): Promise<BranchRecord | null> {
  assertDb();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.branches, branchId));
  return snap.exists() ? snap.data() as BranchRecord : null;
}

export async function updateBranchRecord(branchId: string, patch: Partial<BranchRecord>): Promise<void> {
  assertDb();
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.branches, branchId), {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}
