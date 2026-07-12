import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseApp';
import { isPOSFirebaseWritesAllowed } from '../auth/posActivationService';
import { firestorePaths } from '../firebase/firestorePaths';
import type {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine
} from '../types';

export function canUseProductTransformationFirestore(): boolean {
  return Boolean(firebaseReady && db);
}

export async function readFirestoreTransformations(vendorId: string): Promise<ProductTransformation[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];
  if (!vendorId) throw new Error('A vendorId is required to read product transformations.');

  const snapshot = await getDocs(collection(db, firestorePaths.productTransformations(vendorId)));
  return snapshot.docs.map((row) => row.data() as ProductTransformation);
}

export async function writeFirestoreTransformation(record: ProductTransformation): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) throw new Error('Firestore is unavailable for product transformation persistence.');
  if (!isPOSFirebaseWritesAllowed()) throw new Error('Product transformation Firestore writes are not allowed for this session.');
  if (!record.vendorId || !record.branchId) throw new Error('Product transformation writes require vendorId and branchId.');

  await setDoc(doc(db, firestorePaths.productTransformations(record.vendorId), record.transformationId), record, { merge: true });
}

export async function readFirestoreInputLines(vendorId: string, transformationId: string): Promise<ProductTransformationInputLine[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];
  if (!vendorId) throw new Error('A vendorId is required to read transformation input lines.');

  const q = query(
    collection(db, firestorePaths.productTransformationInputLines(vendorId)),
    where('transformationId', '==', transformationId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((row) => row.data() as ProductTransformationInputLine);
}

export async function writeFirestoreInputLine(record: ProductTransformationInputLine): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) throw new Error('Firestore is unavailable for transformation input persistence.');
  if (!isPOSFirebaseWritesAllowed()) throw new Error('Transformation input Firestore writes are not allowed for this session.');
  if (!record.vendorId || !record.branchId || !record.sourceWarehouseId) throw new Error('Transformation input writes require vendorId, branchId and sourceWarehouseId.');

  await setDoc(doc(db, firestorePaths.productTransformationInputLines(record.vendorId), record.lineId), record, { merge: true });
}

export async function readFirestoreOutputLines(vendorId: string, transformationId: string): Promise<ProductTransformationOutputLine[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];
  if (!vendorId) throw new Error('A vendorId is required to read transformation output lines.');

  const q = query(
    collection(db, firestorePaths.productTransformationOutputLines(vendorId)),
    where('transformationId', '==', transformationId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((row) => row.data() as ProductTransformationOutputLine);
}

export async function writeFirestoreOutputLine(record: ProductTransformationOutputLine): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) throw new Error('Firestore is unavailable for transformation output persistence.');
  if (!isPOSFirebaseWritesAllowed()) throw new Error('Transformation output Firestore writes are not allowed for this session.');
  if (!record.vendorId || !record.branchId || !record.destinationWarehouseId) throw new Error('Transformation output writes require vendorId, branchId and destinationWarehouseId.');

  await setDoc(doc(db, firestorePaths.productTransformationOutputLines(record.vendorId), record.lineId), record, { merge: true });
}
export async function deleteFirestoreInputLine(vendorId: string, lineId: string): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) throw new Error('Firestore is unavailable for transformation input deletion.');
  if (!isPOSFirebaseWritesAllowed()) throw new Error('Transformation input Firestore deletes are not allowed for this session.');
  if (!vendorId || !lineId) throw new Error('Transformation input deletion requires vendorId and lineId.');

  await deleteDoc(doc(db, firestorePaths.productTransformationInputLines(vendorId), lineId));
}

export async function deleteFirestoreOutputLine(vendorId: string, lineId: string): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) throw new Error('Firestore is unavailable for transformation output deletion.');
  if (!isPOSFirebaseWritesAllowed()) throw new Error('Transformation output Firestore deletes are not allowed for this session.');
  if (!vendorId || !lineId) throw new Error('Transformation output deletion requires vendorId and lineId.');

  await deleteDoc(doc(db, firestorePaths.productTransformationOutputLines(vendorId), lineId));
}
export function subscribeToTransformations(
  vendorId: string,
  callback: (rows: ProductTransformation[]) => void
): (() => void) | null {
  if (!canUseProductTransformationFirestore() || !db) {
    return null;
  }

  return onSnapshot(
    collection(db, firestorePaths.productTransformations(vendorId)),
    snapshot => {
      const rows = snapshot.docs.map(d => d.data() as ProductTransformation);
      callback(rows);
    },
    error => {
      console.error('[Firestore Transformation Listener]', error);
    }
  );
}
export function subscribeToInputLines(
  vendorId: string,
  transformationId: string,
  callback: (rows: ProductTransformationInputLine[]) => void
): (() => void) | null {

  if (!canUseProductTransformationFirestore() || !db) {
    return null;
  }

  const q = query(
    collection(db, firestorePaths.productTransformationInputLines(vendorId)),
    where('transformationId','==',transformationId)
  );

  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => d.data() as ProductTransformationInputLine));
  });
}

export function subscribeToOutputLines(
  vendorId: string,
  transformationId: string,
  callback: (rows: ProductTransformationOutputLine[]) => void
): (() => void) | null {

  if (!canUseProductTransformationFirestore() || !db) {
    return null;
  }

  const q = query(
    collection(db, firestorePaths.productTransformationOutputLines(vendorId)),
    where('transformationId','==',transformationId)
  );

  return onSnapshot(q, snapshot => {
    callback(snapshot.docs.map(d => d.data() as ProductTransformationOutputLine));
  });
}

