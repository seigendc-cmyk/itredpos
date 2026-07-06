import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../pos-new/firebase/firebaseApp";
import { FIRESTORE_COLLECTIONS } from "../backend";

export interface VendorContext {
  vendorId: string;
  vendor: Record<string, unknown> | null;
  plan: Record<string, unknown> | null;
  license: Record<string, unknown> | null;
  branches: Record<string, unknown>[];
  warehouses: Record<string, unknown>[];
  staff: Record<string, unknown>[];
  loadedAt: string;
}

function assertDb() {
  if (!db) throw new Error("Firebase is not ready.");
}

async function getById(collectionName: string, id: string): Promise<Record<string, unknown> | null> {
  assertDb();
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? snap.data() as Record<string, unknown> : null;
}

async function listByVendorId(collectionName: string, vendorId: string): Promise<Record<string, unknown>[]> {
  assertDb();
  const snap = await getDocs(query(
    collection(db, collectionName),
    where("vendorId", "==", vendorId)
  ));
  return snap.docs.map((item) => item.data() as Record<string, unknown>);
}

export async function resolveVendorContext(vendorId: string): Promise<VendorContext> {
  const cleanVendorId = String(vendorId || "").trim();

  if (!cleanVendorId) {
    throw new Error("Vendor ID is required.");
  }

  const vendor = await getById(FIRESTORE_COLLECTIONS.vendors, cleanVendorId);
  const plan = await getById(FIRESTORE_COLLECTIONS.vendorPlans, cleanVendorId);
  const license = await getById(FIRESTORE_COLLECTIONS.vendorLicenses, cleanVendorId);

  const branches = await listByVendorId(FIRESTORE_COLLECTIONS.vendorBranches, cleanVendorId);
  const warehouses = await listByVendorId(FIRESTORE_COLLECTIONS.vendorWarehouses, cleanVendorId);
  const staff = await listByVendorId(FIRESTORE_COLLECTIONS.vendorStaff, cleanVendorId);

  return {
    vendorId: cleanVendorId,
    vendor,
    plan,
    license,
    branches,
    warehouses,
    staff,
    loadedAt: new Date().toISOString()
  };
}
