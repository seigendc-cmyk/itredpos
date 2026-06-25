/**
 * Writes an audit log.
 * In the future, this will write to the 'auditLogs' Firestore collection.
 * For now, it logs to the console for local build-development.
 * @param logEntry The audit log entry to write.
 */
export async function writeAuditLog(logEntry: {
  vendorId: string;
  actor: string;
  action: string;
  message: string;
  details: Record<string, any>;
}) {
  console.log('Writing Audit Log:', { ...logEntry, timestamp: new Date().toISOString() });
  // In the future, this will be replaced with:
  // await firestore.collection('auditLogs').add({ ...logEntry, timestamp: new Date().toISOString() });
}