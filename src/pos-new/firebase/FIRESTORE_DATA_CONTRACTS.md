# Firestore Data Contracts

This build defines contracts only. It does not enable Firestore reads, Firestore writes, Auth login, Storage upload, data migration, plan enforcement, or iTredVD Console access.

## Tenant-First Model

All operational POS documents are scoped under `/vendors/{vendorId}`. Branch and terminal context is stored on documents with `branchId` and `terminalId`, and branch terminal records may also live under `/vendors/{vendorId}/branches/{branchId}/terminals/{terminalId}`.

Tenant vendors must never access iTredVD Console, pricing management, subscription management, plan management, or backend console controls from this app.

## Required Scoping

Every operational document must include `vendorId`. Branch-specific records must include `branchId` where practical. Terminal-originated records must include `terminalId` when they come from a POS session or offline queue item.

Staff permissions remain enforced by the app during build-development. Firestore Security Rules will be added later before live repositories are activated.

## Offline Sync Strategy

Offline queue records map to `/vendors/{vendorId}/offlineSyncQueue`. They preserve the source entity type, operation type, payload snapshot, branch, terminal, staff, retry state, and conflict status. Live sync remains disabled until repositories and conflict rules are activated.

## Conflict Resolution

Sync conflicts map to `/vendors/{vendorId}/syncConflicts`. Conflict records keep the local reference, remote reference placeholder, risk level, recommended resolution, staff decision, and audit trail. No remote overwrite behavior is enabled in this build.

## Product Import Strategy

Import batches and rows map to vendor-scoped collections. Imported products remain drafts/opening-balance drafts until validated and posted by existing local services. Firestore import persistence is contract-only.

## Stock Movement Source Of Truth

Posted inventory movements are the future stock ledger source of truth. Product ledger rows can be derived from inventory movements or stored separately under `/vendors/{vendorId}/productLedger` if needed for query speed. Current mock/local services still produce all movement data.

## Accounting Readiness

Accounting readiness documents stage inventory, sales, cash, and supplier impacts before any accounting post. They do not post cashbook, GL, COGS, or inventory asset value in this build.

## Delivery And iDeliver

Delivery requests, providers, and tracking events have vendor-scoped contract paths. iDeliver broadcast remains a placeholder and no network delivery dispatch is activated.

## Build 18D Sandbox Policy

Sandbox reads and writes are enabled only for test collections:

- `/sandboxConnectivityTests`
- `/sandboxRepositoryTests`
- `/vendors/{vendorId}/sandboxNotes`
- `/vendors/{vendorId}/sandboxRepositoryTests`

Business Firestore reads and writes remain disabled. The sandbox blocks business collections including sales receipts, payments, product master, stock balances, inventory movements, product ledger, customers, delivery requests, approvals, accounting readiness, offline sync queue, stock adjustments, stocktakes, stock transfers, purchase orders, goods receiving notes, and supplier returns.

The next step is Auth and tenant session preparation, followed by controlled repository activation for one low-risk module at a time.

## Build 19A Auth and Tenant Session Preparation

Firebase Auth shell exists but is not mandatory. Google sign-in is prepared as a placeholder shell and is not production-enforced. The app does not add a forced route guard and does not block Dashboard, Sales, Inventory, Delivery, Sync Desk, or Settings.

Tenant resolution is placeholder-only. It returns a build-development vendor identity until controlled tenant resolution and staff profile mapping are activated. Staff access flow is prepared so a vendor can later authenticate first, then select staff, branch, terminal, and staff PIN/password.

Vendor business data remains mock/local. Firestore business reads and writes remain disabled. The Firebase sandbox remains limited to sandbox collections only. iTredVD Console remains internal only for Digital Commerce / SCI company staff and is not exposed to tenant vendors.

Next step: controlled tenant resolution and staff profile mapping before any production Auth gate or business repository activation.

## Build 19B Tenant Resolution Contracts

Tenant resolution now has local contracts for the future production lookup path:

- `/vendorMemberships/{membershipId}`
- `/vendors/{vendorId}/staffProfiles`
- `/vendors/{vendorId}/branchAccess`
- `/vendors/{vendorId}/terminalAccess`
- `/vendors/{vendorId}/rolePermissionProfiles`
- `/vendors/{vendorId}/sessionAuditEvents`

The current implementation uses a mock tenant directory only. Signed-in email, vendor membership, POS access status, staff profile, branch access, terminal access, and session claims can be inspected from the Auth and Tenant Session panel. Session claims are local build-development claims and are not Firebase custom claims.

Tenant roles map to existing POS permission keys through the tenant permission mapping layer. `VendorOwner` keeps Owner build-development full access, while staff roles map to the existing POS permission model for Cashier, Supervisor, Stock Controller, Delivery Staff, Manager, and limited Viewer access.

Production Firestore tenant lookup remains disabled. No production login gate is enforced, no business workflows are connected to Firestore, no Storage upload is added, and iTredVD Console remains internal-only.

## Build 19C Staff PIN Gate and Role Menu Readiness

Staff PIN gate preparation exists in preview mode only. The gate is enabled for inspection, but it is not mandatory and does not block the app during build-development.

PIN verification uses local mock demo credentials only. The demo credentials are not production credential logic, are not hashed, and are not connected to Firestore or Firebase Auth token claims.

Role menu mapping and role action permission previews are prepared so Owner, Manager, Supervisor, Cashier, Stock Controller, Delivery Staff, Accountant, and Viewer access can be inspected before route guards are enforced. Strict permission enforcement remains disabled.

Owner build-development bypass remains active. Owner retains full menu and action access and cannot be locked out by the preview Staff PIN gate.

Production Firestore staff credential rules, credential hashing, custom claims, audit repositories, and tenant security rules will be designed later. This build does not connect staff profiles, PIN credentials, products, sales, inventory, delivery, accounting, approvals, or offline sync to Firestore.

Vendor users still have no access to internal iTredVD Console, subscription management, pricing management, plan management, or company staff administration.
