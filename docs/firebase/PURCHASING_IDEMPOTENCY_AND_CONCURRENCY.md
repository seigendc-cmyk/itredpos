# Purchasing Idempotency and Concurrency

## Durable identity

Every posted purchasing mutation carries a fixed vendor-scoped key in the form `purchasing:{operation}:{vendorId}:{stableRequestId}` and a deterministic correlation ID. Key components are URI-encoded so distinct identifiers cannot collapse to the same key. Retries of the same business action reuse these values. Request fingerprints are SHA-256 digests of canonically sorted business fields. Numbers, identifiers, and business dates are normalized; volatile client/server timestamps and retry counters are excluded.

The repository stores completed receipts at `vendors/{vendorId}/mutationReceipts/{idempotencyKey}`. A matching completed receipt returns the existing business record. Reusing a key with a different fingerprint returns `PURCHASING_IDEMPOTENCY_CONFLICT`. Receipt completion occurs in the same Firestore transaction as business, inventory, balance, audit, and BI writes; an aborted transaction therefore cannot leave a false completed receipt.

## Transaction boundaries

- PO approval reads the receipt and latest PO, permits only `Submitted → Approved`, writes deterministic audit/BI events, and completes the receipt atomically.
- GRN posting reads the receipt, GRN, PO, PO lines, supplier, products, stock balances, optional invoice, and supplier balance before writing. It updates all PO lines, stock balances, append-only movements, GRN documents, PO status, optional invoice/liability projection, audit/BI events, and receipt together.
- Supplier returns read original GRN lines, cumulative returned quantities, stock and supplier balance before atomically posting the return, movements, credit evidence, projection, events, and receipt.
- Supplier payments and reversals read current invoice and balance projections. Their source records, invoice effects, versioned supplier balance, events, and receipts commit together.
- Standalone supplier credit notes use the same receipt contract and update their source record, reconciled supplier projection, audit event, and BI event atomically.

## Concurrency and invariants

Firestore retries transactions when read documents change. Concurrent receipts therefore re-read current PO-line received quantities; over-receipt is rejected and two valid partial receipts can reach `Completed` without a stale overwrite. Returns use the current cumulative returned quantity, and reversal identity is the original payment ID so two reversal attempts cannot both create records.

Inventory movements are immutable and uniquely derived from source document and source line. Each contains opening balance, delta, closing balance, source IDs, correlation ID, idempotency key, posting actor, and server posting timestamp. The repository asserts `opening + delta = closing` before writing.

Supplier balances reconcile as:

`invoiceTotal - paymentTotal + reversalTotal - creditNoteTotal - returnCreditTotal = outstandingBalance`

Every mutation increments `version` using the transaction-read projection.

## Capacity and retry behavior

A GRN is limited to 40 unique PO-line references and an estimated 450 transaction documents. Oversized or duplicate-line documents fail before a transaction starts; a governed GRN is never silently split.

UI submission locking is a convenience control. Durable receipts remain authoritative across retries, terminals, browser restarts, and eventual offline replay. Validation, permission, over-receipt, return-limit, already-reversed, and fingerprint-conflict errors are non-retryable. Firestore unavailable, deadline, and transaction-abort failures may be retried with the original key.

Operational troubleshooting starts with the mutation receipt, then its `resultPath`, correlation-matched audit/BI events, and source inventory movements. Never delete a completed receipt to force re-execution.
