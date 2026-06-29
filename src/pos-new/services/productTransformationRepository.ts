import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where
} from 'firebase/firestore';
import { db, firebaseReady } from '../firebase/firebaseApp';
import type {
  ProductTransformation,
  ProductTransformationInputLine,
  ProductTransformationOutputLine
} from '../types';

const TRANSFORMATION_COLLECTION = 'productTransformations';
const INPUT_LINE_COLLECTION = 'productTransformationInputLines';
const OUTPUT_LINE_COLLECTION = 'productTransformationOutputLines';

export function canUseProductTransformationFirestore(): boolean {
  return Boolean(firebaseReady && db);
}

export async function readFirestoreTransformations(): Promise<ProductTransformation[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];

  const snapshot = await getDocs(collection(db, TRANSFORMATION_COLLECTION));
  return snapshot.docs.map((row) => row.data() as ProductTransformation);
}

export async function writeFirestoreTransformation(record: ProductTransformation): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) return;

  await setDoc(doc(db, TRANSFORMATION_COLLECTION, record.transformationId), record, { merge: true });
}

export async function readFirestoreInputLines(transformationId: string): Promise<ProductTransformationInputLine[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];

  const q = query(
    collection(db, INPUT_LINE_COLLECTION),
    where('transformationId', '==', transformationId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((row) => row.data() as ProductTransformationInputLine);
}

export async function writeFirestoreInputLine(record: ProductTransformationInputLine): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) return;

  await setDoc(doc(db, INPUT_LINE_COLLECTION, record.lineId), record, { merge: true });
}

export async function readFirestoreOutputLines(transformationId: string): Promise<ProductTransformationOutputLine[]> {
  if (!canUseProductTransformationFirestore() || !db) return [];

  const q = query(
    collection(db, OUTPUT_LINE_COLLECTION),
    where('transformationId', '==', transformationId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((row) => row.data() as ProductTransformationOutputLine);
}

export async function writeFirestoreOutputLine(record: ProductTransformationOutputLine): Promise<void> {
  if (!canUseProductTransformationFirestore() || !db) return;

  await setDoc(doc(db, OUTPUT_LINE_COLLECTION, record.lineId), record, { merge: true });
}
