import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../../pos-new/firebase/firebaseApp";
import type { TerminalRecord } from "../schemas";
import { FIRESTORE_COLLECTIONS } from "./firestoreCollections";

function assertDb() {
  if (!db) throw new Error("Firebase is not ready.");
}

export async function upsertTerminalRecord(terminal: TerminalRecord): Promise<void> {
  assertDb();
  await setDoc(doc(db, FIRESTORE_COLLECTIONS.terminals, terminal.terminalId), terminal, { merge: true });
}

export async function getTerminalById(terminalId: string): Promise<TerminalRecord | null> {
  assertDb();
  const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.terminals, terminalId));
  return snap.exists() ? snap.data() as TerminalRecord : null;
}

export async function updateTerminalRecord(terminalId: string, patch: Partial<TerminalRecord>): Promise<void> {
  assertDb();
  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.terminals, terminalId), {
    ...patch,
    updatedAt: new Date().toISOString()
  });
}
