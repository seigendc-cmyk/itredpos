# Shared Commerce Collection Contract

Authoritative reference for vendor-scoped Firestore collections shared across iTredPOS, iTred Vendor Discovery, Marketspace, iDeliver, BI, Cashplan, Poolwise and future SCI applications.

## Authoritative Collections

| Firestore Collection | JS Key | Authority | Owning Domain | Shared With | Notes |
|---|---|---|---|---|---|
| `vendors` | `vendors` | SHARED_MASTER | POS | All apps | Root tenant record. |
| `branches` | `branches` | SHARED_MASTER | POS | POS, Console, iDeliver, SYSTEM | |
| `warehouses` | `warehouses` | SHARED_MASTER | POS | POS, Console, iDeliver, SYSTEM | Added Build 02. |
| `terminals` | `terminals` | SHARED_MASTER | POS | POS, SYSTEM | |
| `productMaster` | `productMaster` | SHARED_MASTER | POS | All apps | Authoritative product catalog. |
| `productStockBalances` | `productStockBalances` | DERIVED_READ_MODEL | POS | All apps | Derived from inventory movements. |
| `customers` | `customers` | SHARED_MASTER | POS | POS, Console, Marketspace, iDeliver, SYSTEM | |
| `inventoryMovements` | `inventoryMovements` | OPERATIONAL_LEDGER | POS | POS, Console, iDeliver, SYSTEM | Source of truth for stock. |
| `salesReceipts` | `salesReceipts` | OPERATIONAL_LEDGER | POS | POS, Console, Cashplan, SYSTEM | |
| `payments` | `payments` | OPERATIONAL_LEDGER | POS | POS, Console, Cashplan, SYSTEM | |
| `marketplaceListings` | `marketplaceListings` | SHARED_MASTER | Marketspace | POS, Console, Marketspace, SYSTEM | Marketplace view of products. Not authoritative stock balance. |
| `marketplaceOrders` | `marketplaceOrders` | OPERATIONAL_LEDGER | Marketspace | POS, Console, Marketspace, iDeliver, SYSTEM | |
| `deliveries` | `deliveries` | OPERATIONAL_LEDGER | iDeliver | POS, iDeliver, SYSTEM | |
| `biEvents` | `biEvents` | OPERATIONAL_LEDGER | BI | All apps | |
| `audit_logs` | `auditLogs` | AUDIT_LOG | SYSTEM | All apps | See naming conflict below. |
| `offlineSyncQueue` | `offlineSyncQueue` | SYNC_QUEUE | POS | POS, SYSTEM | |

### Naming Conflicts

#### `auditLogs` (JS) vs `audit_logs` (Firestore)

The internal TypeScript key is `auditLogs`, but the live Firestore collection name is `audit_logs`.

- **Authoritative collection**: `audit_logs`
- **Legacy / alternate name**: `auditLogs`
- **Migration strategy**: Retain both. Do not rename the Firestore collection. Continue using `auditLogs` as the JS property key and map to `audit_logs` in `firestoreCollectionNames`.
- **Applications consuming it**: All apps via shared audit pipeline.
- **Data classification**: AUDIT_LOG

#### Delivery snake_case collections

Several delivery-related collections use snake_case in Firestore but camelCase JS keys:

- `deliveryLines` → `delivery_lines`
- `deliveryAddresses` → `delivery_addresses`
- `deliveryAssignments` → `delivery_assignments`
- `deliveryTracking` → `delivery_tracking`
- `deliveryConfirmations` → `delivery_confirmations`
- `proofOfDelivery` → `proof_of_delivery`
- `deliveryCashCollections` → `delivery_cash_collections`
- `deliveryCashHandovers` → `delivery_cash_handovers`
- `deliveryFailures` → `delivery_failures`
- `deliveryReturns` → `delivery_returns`
- `deliveryPartners` → `delivery_partners`
- `deliveryPerformance` → `delivery_performance`

- **Authoritative collection**: snake_case Firestore name
- **Legacy / alternate name**: camelCase JS key
- **Migration strategy**: Retain existing mapping. Do not rename Firestore collections.
- **Applications consuming it**: iDeliver, POS
- **Data classification**: OPERATIONAL_LEDGER

## Governance Rules

See `src/pos-new/firebase/collectionGovernance.ts` for the machine-readable governance table.

### Authority Definitions

- **SHARED_MASTER**: Authoritative data owned by one domain, readable by others. Writes go through the owning domain service.
- **OPERATIONAL_LEDGER**: Append-only operational records. Immutable after creation.
- **DERIVED_READ_MODEL**: Computed or aggregated data. Authoritative source is elsewhere.
- **AUDIT_LOG**: Immutable audit trail. Append-only.
- **SYNC_QUEUE**: Offline sync queue. Transient until processed.

## Compatibility Requirements

- Existing `firestorePaths` are preserved.
- Existing collection names (`productMaster`, `productStockBalances`, `salesReceipts`, `audit_logs`) are not renamed.
- Authentication, tenancy resolution, Firestore security rules, and UI pages are not modified in this build.
- No direct Firestore calls are added to components.

## Migration Strategy

No data migration is performed in Build 02. Collections are extended contractually. Future builds will activate repositories and security rules per domain.
