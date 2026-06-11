import { InventoryMovement } from '../types/posTypes';
import { mockInventoryMovements } from '../mock/mockPosData';

const STORE_KEY = 'sci_pos_inventory_movements';
let memoryMovements: InventoryMovement[] = [...mockInventoryMovements];

function canUseLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function loadInventoryMovements(): InventoryMovement[] {
  if (!canUseLocalStorage()) return memoryMovements;

  const cached = localStorage.getItem(STORE_KEY);
  if (!cached) {
    localStorage.setItem(STORE_KEY, JSON.stringify(mockInventoryMovements));
    memoryMovements = [...mockInventoryMovements];
    return memoryMovements;
  }

  try {
    memoryMovements = JSON.parse(cached) as InventoryMovement[];
    return memoryMovements;
  } catch {
    memoryMovements = [...mockInventoryMovements];
    return memoryMovements;
  }
}

export function saveInventoryMovements(movements: InventoryMovement[]): InventoryMovement[] {
  memoryMovements = movements;
  if (canUseLocalStorage()) {
    localStorage.setItem(STORE_KEY, JSON.stringify(movements));
  }
  return movements;
}

export function addInventoryMovement(movement: InventoryMovement): InventoryMovement {
  const next = [movement, ...loadInventoryMovements()];
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
