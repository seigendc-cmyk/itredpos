import { CashMovement } from '../types/posTypes';
import { mockCashMovements } from '../mock/mockPosData';

export const cashService = {
  getCashMovements: async (branchId: string, terminalId: string): Promise<CashMovement[]> => {
    return mockCashMovements;
  },

  recordCashMovement: async (payload: Omit<CashMovement, 'id' | 'timestamp'>): Promise<CashMovement> => {
    const nextMovement: CashMovement = {
      ...payload,
      id: `CL-${Math.floor(100 + Math.random() * 900)}`,
      timestamp: new Date().toISOString()
    };
    mockCashMovements.push(nextMovement);
    return nextMovement;
  }
};
