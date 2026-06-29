import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, firebaseReady } from '../../pos-new/firebase/firebaseApp';
import type { AuditLog } from './writeAuditLog';

export async function readAuditLogsForEntity(entityId: string): Promise<AuditLog[]> {
  if (!entityId) return [];

  if (!firebaseReady || !db) {
    console.info('[AuditLog:read-local]', { entityId });
    return [];
  }

  try {
    const q = query(
      collection(db, 'auditLogs'),
      where('entityId', '==', entityId)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs
      .map((doc) => doc.data() as AuditLog)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  } catch (error) {
    console.warn('[AuditLog:read-failed]', error);
    return [];
  }
}
