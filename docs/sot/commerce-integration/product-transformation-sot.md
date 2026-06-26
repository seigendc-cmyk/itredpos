# Product Transformation: Source of Truth

This document outlines the business rules, data flow, and instrumentation requirements for the Product Transformation module. This module is responsible for all processes that convert input materials into output products, including batch production, kitting, repacking, blending, and Bill of Materials (BOM) based manufacturing.

## 1. Raw Material Input Consumption

- **Rule:** Input materials (raw goods, components) must be deducted from inventory upon successful posting of a transformation.
- **Implementation:** For each `ProductTransformationInputLine`, a corresponding `InventoryMovement` record is created.
- **Inventory Movement Type:** `RAW_TO_FINISHED_OUT`
- **Effect:** Decreases the `qtyOnHand` and `qtyAvailable` for the specified product at the `sourceWarehouseId`.
- **Timing:** This occurs only when the `postTransformation()` function is successfully executed.

## 2. Finished Goods Output Creation

- **Rule:** Output products (finished goods) must be added to inventory upon successful posting of a transformation.
- **Implementation:** For each `ProductTransformationOutputLine`, a corresponding `InventoryMovement` record is created.
- **Inventory Movement Type:** `RAW_TO_FINISHED_IN`
- **Effect:** Increases the `qtyOnHand` and `qtyAvailable` for the specified product at the `destinationWarehouseId`.
- **Timing:** This occurs only when the `postTransformation()` function is successfully executed.

## 3. Batch Number

- **Rule:** Every transformation job represents a unique production batch and must be traceable.
- **Implementation:** The `ProductTransformation.transformationNumber` field serves as the unique batch number.
- **Traceability:** This `transformationNumber` must be populated in the `referenceNumber` field of all associated `RAW_TO_FINISHED_OUT` and `RAW_TO_FINISHED_IN` inventory movements.

## 4. Yield Calculation

- **Rule:** The system must be able to calculate the yield of a transformation process.
- **Formula:** `Yield % = (Total Quantity of All Outputs / Total Quantity of All Inputs) * 100`
- **Implementation:** This is a BI calculation derived from the completed transformation's input and output lines.

## 5. Waste and Shrinkage

- **Rule:** The difference between input and output quantities is considered waste or shrinkage. The value of this waste must be quantifiable.
- **Formula:** `Waste Value = Total Input Cost - Total Output Value`
- **Implementation:** Waste is the value of input materials not converted into finished goods value. It is calculated after the output unit costs have been allocated. Shrinkage is unaccounted loss, which is a component of the total waste value.

## 6. Unit Cost Allocation

- **Rule:** The total cost of all consumed inputs must be allocated to the produced outputs to determine their new unit cost.
- **Formula (Total Input Cost):** `TIC = SUM(input.qtyConsumed * input.unitCost)`
- **Formula (Output Unit Cost):** The `unitCost` for each `ProductTransformationOutputLine` is calculated as: `output.unitCost = TIC / SUM(output.qtyProduced)`.
- **Implementation:** This calculation happens within the `postTransformation()` function. The resulting `output.unitCost` is used for the `RAW_TO_FINISHED_IN` inventory movement, which will influence the moving average cost of the finished product.

## 7. Approval Before Posting

- **Rule:** High-value or high-risk transformations must be approved before they can be posted.
- **Implementation:** A `ProductTransformation` must have a status of `Approved` to be eligible for posting via `postTransformation()`.
- **Trigger:** A transformation automatically requires approval if the total value of its inputs (`TIC`) exceeds a system-configurable threshold (e.g., $500) or if it involves specially flagged materials.

## 8. Inventory Movement Types

- **`RAW_TO_FINISHED_OUT`**: Used for consuming input materials from a source warehouse. This is a `qtyOut` movement.
- **`RAW_TO_FINISHED_IN`**: Used for creating finished goods in a destination warehouse. This is a `qtyIn` movement.

## 9. Audit Requirements

- **Rule:** All significant state changes in the transformation lifecycle must be recorded in an immutable audit log.
- **Implementation:** The `writeAuditLog()` function from `commerce-integration` must be called upon the successful completion of the following operations:
  - `createTransformationDraft()` -> `action: 'TransformationCreated'`
  - `cancelTransformation()` -> `action: 'TransformationCancelled'`
  - `postTransformation()` -> `action: 'TransformationCompleted'`
  - `approveTransformation()` -> `action: 'TransformationApproved'`
  - `rejectTransformation()` -> `action: 'TransformationRejected'`

## 10. Commerce Events

- **Rule:** Key business operations must publish events for consumption by other subsystems (e.g., BI, accounting, notifications).
- **Implementation:** The `publishCommerceEvent()` function must be called upon successful completion of the operation.

#### `TransformationCreated`
- **Trigger:** After `createTransformationDraft()` succeeds.
- **Purpose:** To notify systems that a new production job has been initiated.
- **Payload:** Should include the draft transformation details.

#### `TransformationCompleted`
- **Trigger:** After `postTransformation()` succeeds and all inventory movements are posted.
- **Purpose:** To signal the end of a production run and the availability of new stock.
- **Payload:** Should include the completed transformation, a summary of input/output values, and a list of the generated inventory movement IDs.

#### `TransformationCancelled`
- **Trigger:** After `cancelTransformation()` succeeds.
- **Purpose:** To notify systems that a planned production job will not proceed.
- **Payload:** Should include the cancelled transformation details and the reason for cancellation.

## 11. BI Metrics

These metrics should be calculated from the data captured in `ProductTransformation`, its lines, and the resulting `InventoryMovement` records.

- **Transformation Cost:**
  - **Definition:** The total value of all input materials consumed.
  - **Formula:** `SUM(input.qtyConsumed * input.unitCost)`

- **Output Value:**
  - **Definition:** The total value of all finished goods produced, based on the allocated cost.
  - **Formula:** `SUM(output.qtyProduced * output.unitCost)` (This should equal Transformation Cost).

- **Waste Value:**
  - **Definition:** The value of inputs lost during transformation.
  - **Formula:** `Transformation Cost - Output Value` (Should be close to zero if cost allocation is perfect, but can be non-zero with rounding or other models).

- **Yield Percentage:**
  - **Definition:** The ratio of output quantity to input quantity.
  - **Formula:** `(SUM(output.qtyProduced) / SUM(input.qtyConsumed)) * 100`

- **Variance:**
  - **Definition:** The difference between the expected output from a BOM and the actual output.
  - **Formula:** `Actual Output Qty - Expected Output Qty`

- **Transformation Profit:**
  - **Definition:** The potential profit generated by the transformation, comparing the value of the outputs at selling price to the cost of the inputs.
  - **Formula:** `SUM(output.qtyProduced * output.sellingPrice) - Transformation Cost`