import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, firebaseReady } from '../../firebase/firebaseApp';
import type { SalesMigrationCanonicalReferences, SalesMigrationReceipt, SalesMigrationErrorCode } from './types';

export class SalesMigrationReceiptConflict extends Error { constructor(message: string) { super(message); this.name = 'SalesMigrationReceiptConflict'; } }
export interface SalesMigrationReceiptStore {
  claim(receipt: SalesMigrationReceipt): Promise<{ state: 'claimed' | 'completed' | 'processing'; receipt: SalesMigrationReceipt }>;
  complete(receiptId: string, vendorId: string, fingerprint: string, result: SalesMigrationCanonicalReferences): Promise<void>;
  fail(receiptId: string, vendorId: string, fingerprint: string, code: SalesMigrationErrorCode): Promise<void>;
}
const receiptPath = (vendorId: string, receiptId: string) => `vendors/${vendorId}/salesMigrationReceipts/${receiptId}`;

export class FirestoreSalesMigrationReceiptStore implements SalesMigrationReceiptStore {
  async claim(receipt: SalesMigrationReceipt) {
    if (!firebaseReady || !db) throw new Error('Firestore migration receipt store is unavailable.');
    return runTransaction(db, async transaction => {
      const ref = doc(db!, receiptPath(receipt.vendorId, receipt.receiptId)); const snapshot = await transaction.get(ref);
      if (snapshot.exists()) {
        const existing = snapshot.data() as SalesMigrationReceipt;
        if (existing.sourceFingerprint !== receipt.sourceFingerprint || existing.destinationSaleId !== receipt.destinationSaleId) throw new SalesMigrationReceiptConflict('Migration receipt identity conflicts with another source payload.');
        if (existing.status === 'completed') return { state: 'completed' as const, receipt: existing };
        if (existing.status === 'processing' && Date.parse(existing.leaseExpiresAt) > Date.now()) return { state: 'processing' as const, receipt: existing };
        const reclaimed = { ...existing, status: 'processing' as const, attemptCount: Number(existing.attemptCount || 0) + 1, leaseExpiresAt: receipt.leaseExpiresAt };
        transaction.set(ref, { ...reclaimed, updatedAt: serverTimestamp() }, { merge: true });
        return { state: 'claimed' as const, receipt: reclaimed };
      }
      transaction.set(ref, { ...receipt, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      return { state: 'claimed' as const, receipt };
    });
  }
  async complete(receiptId: string, vendorId: string, fingerprint: string, result: SalesMigrationCanonicalReferences) {
    if (!db) throw new Error('Firestore migration receipt store is unavailable.');
    await runTransaction(db, async transaction => { const ref = doc(db!, receiptPath(vendorId, receiptId)); const snap = await transaction.get(ref); if (!snap.exists() || snap.data().sourceFingerprint !== fingerprint) throw new SalesMigrationReceiptConflict('Migration completion receipt is missing or conflicting.'); if (snap.data().status === 'completed') return; transaction.update(ref, { status: 'completed', result, updatedAt: serverTimestamp(), completedAt: serverTimestamp() }); });
  }
  async fail(receiptId: string, vendorId: string, fingerprint: string, code: SalesMigrationErrorCode) {
    if (!db) throw new Error('Firestore migration receipt store is unavailable.');
    await runTransaction(db, async transaction => { const ref = doc(db!, receiptPath(vendorId, receiptId)); const snap = await transaction.get(ref); if (!snap.exists() || snap.data().sourceFingerprint !== fingerprint || snap.data().status === 'completed') return; transaction.update(ref, { status: 'failed', failureCode: code, updatedAt: serverTimestamp() }); });
  }
}

export class MemorySalesMigrationReceiptStore implements SalesMigrationReceiptStore {
  readonly receipts = new Map<string, SalesMigrationReceipt>();
  async claim(receipt: SalesMigrationReceipt) { const current = this.receipts.get(receipt.receiptId); if (current) { if (current.sourceFingerprint !== receipt.sourceFingerprint || current.destinationSaleId !== receipt.destinationSaleId) throw new SalesMigrationReceiptConflict('fingerprint conflict'); if (current.status === 'completed') return { state: 'completed' as const, receipt: current }; if (current.status === 'processing' && Date.parse(current.leaseExpiresAt) > Date.now()) return { state: 'processing' as const, receipt: current }; const reclaimed = { ...current, status: 'processing' as const, attemptCount: current.attemptCount + 1, leaseExpiresAt: receipt.leaseExpiresAt, updatedAt: receipt.updatedAt }; this.receipts.set(receipt.receiptId, reclaimed); return { state: 'claimed' as const, receipt: reclaimed }; } this.receipts.set(receipt.receiptId, receipt); return { state: 'claimed' as const, receipt }; }
  async complete(id: string, _vendor: string, fingerprint: string, result: SalesMigrationCanonicalReferences) { const current = this.receipts.get(id); if (!current || current.sourceFingerprint !== fingerprint) throw new SalesMigrationReceiptConflict('completion conflict'); this.receipts.set(id, { ...current, status: 'completed', result, completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
  async fail(id: string, _vendor: string, _fingerprint: string, code: SalesMigrationErrorCode) { const current = this.receipts.get(id); if (current && current.status !== 'completed') this.receipts.set(id, { ...current, status: 'failed', failureCode: code, updatedAt: new Date().toISOString() }); }
}
