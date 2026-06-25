# Master Entity SOT v1.0

## Purpose

Master entities are the shared identity backbone of the seiGEN Commerce Operating System.

Every application must use the same identifiers so that iTredPOS, iDeliver, Vendor Discovery, Console, Licensing, and BI can work as one commerce ecosystem.

---

## Core Master Entities

vendors

branches

warehouses

staff

roles

permissions

terminals

products

productCategories

customers

suppliers

taxes

currencies

units

plans

licenses

deliveryDrivers

deliveryVehicles

---

## Identity Rules

vendorId is the top-level tenant identifier.

branchId belongs to one vendorId.

warehouseId belongs to one vendorId and may belong to one branchId.

terminalId belongs to one branchId.

staffId belongs to one vendorId.

productId belongs to one vendorId.

customerId belongs to one vendorId unless a future shared customer identity layer is approved.

supplierId belongs to one vendorId unless a future supplier network layer is approved.

licenseId controls access to paid modules.

deliveryId belongs to iDeliver but may reference saleId or orderId.

transformationId belongs to product transformation and inventory conversion flows.

---

## Shared Identifier Standard

Approved identifiers:

vendorId

branchId

warehouseId

staffId

roleId

permissionId

terminalId

productId

productCategoryId

customerId

supplierId

taxId

currencyId

unitId

planId

licenseId

deliveryId

driverId

vehicleId

saleId

orderId

transformationId

correlationId

---

## Ownership Rules

Vendor Discovery may create and maintain vendor discovery profiles.

iTredPOS may maintain POS operational extensions for vendors, branches, staff, terminals, products, stock, customers, and suppliers.

Console may govern tenants, subscriptions, plans, licensing, and administration.

iDeliver may maintain delivery drivers, delivery vehicles, delivery zones, delivery assignments, and delivery performance records.

Commerce BI may read master entities but must not mutate them.

---

## Application Access Rules

Applications may read shared master entities.

Applications must not write to another application's owned operational records.

Cross-application updates must happen through approved services or events.

No module may invent new identifier names where approved identifiers already exist.

---

## Master Entity Integration Flow

Vendor Created

?

Branch Created

?

Staff Created

?

Terminal Registered

?

Product Created

?

POS Sale

?

Delivery Request

?

BI Event

?

Console Dashboard

---

## Forbidden Practices

Do not use mixed identifiers for the same entity.

Examples to avoid:

vendor

vendor_id

vendorID

businessId

merchantId

Use vendorId only.

Do not create branchCode where branchId is required.

Do not create terminalCode where terminalId is required.

Do not create staffCode where staffId is required.

Codes may exist as display fields, but system relationships must use approved IDs.

---

## Build Rule

Before building any new module, check this SOT and reuse approved identifiers.
