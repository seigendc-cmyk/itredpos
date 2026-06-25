# Event Naming Convention SOT (Source of Truth)

This document defines the naming convention for all `CommerceEventType` values used within the system. A consistent naming scheme is crucial for event routing, consumption, and analysis.

## Convention Rules

All event types must follow the **`{Entity}{Action}`** pattern in **PascalCase**.

1.  **Entity**: The name of the business domain object the event relates to.
    - *Examples: `Sale`, `Shift`, `Stock`, `Delivery`*

2.  **Action**: A past-tense verb describing what happened to the entity.
    - *Examples: `Created`, `Completed`, `Cancelled`, `Opened`, `Closed`, `Adjusted`*

## Examples

- **`SaleCompleted`**: A `Sale` entity has been `Completed`.
- **`ShiftOpened`**: A `Shift` entity has been `Opened`.
- **`StockAdjusted`**: A `Stock` entity has been `Adjusted`.
- **`DriverAssigned`**: A `Driver` has been `Assigned` to a delivery.

## Rationale

This convention is clear, predictable, and easy to parse for both humans and automated systems (like BI consumers or event routers). It groups related events by their primary entity while clearly stating the change of state. All event types listed in `commerceEvents.ts` must adhere to this standard.