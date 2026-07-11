import { InventoryMovement } from '../types/posTypes';
import { mockInventoryMovements } from '../mock/mockPosData';
import { ENABLE_MOCK_SEED_DATA, readVendorScopedList, writeVendorScopedList } from './vendorDataMode';

const STORE_KEY = 'sci_pos_inventory_movements';
let memoryMovements: InventoryMovement[] = ENABLE_MOCK_SEED_DATA ? [...mockInventoryMovements] : [];

export function loadInventoryMovements(): InventoryMovement[] {
  memoryMovements = readVendorScopedList<InventoryMovement>(STORE_KEY, mockInventoryMovements);
  return memoryMovements;
}

export function saveInventoryMovements(movements: InventoryMovement[]): InventoryMovement[] {
  memoryMovements = movements;
  return writeVendorScopedList(STORE_KEY, movements);
}

export function addInventoryMovement(movement: InventoryMovement): InventoryMovement {
  const existing = loadInventoryMovements();
  const duplicate = existing.find((row) => row.movementId === movement.movementId);
  if (duplicate) return duplicate;
  const next = [movement, ...existing];
  saveInventoryMovements(next);
  return movement;
}

export function updateInventoryMovement(movementId: string, patch: Partial<InventoryMovement>): InventoryMovement[] {
  const next = loadInventoryMovements().map((movement) => (
    movement.movementId === movementId
      ? { ...movement, ...patch, updatedAt: new Date().toISOString() }
      : movement
  ));
  return saveInventoryMovements(next);
}

export function clearInventoryMovementDrafts(): InventoryMovement[] {
  const next = loadInventoryMovements().filter((movement) => movement.status !== 'Draft');
  return saveInventoryMovements(next);
}
