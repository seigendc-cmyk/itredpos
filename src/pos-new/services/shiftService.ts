import { Shift } from '../types/posTypes';
import { mockShift } from '../mock/mockPosData';

export const shiftService = {
  getCurrentShift: async (branchId: string, terminalId: string): Promise<Shift | null> => {
    return mockShift;
  },

  openShift: async (payload: { operator: string; startingCash: number }): Promise<Shift> => {
    mockShift.operator = payload.operator;
    mockShift.startingCash = payload.startingCash;
    mockShift.expectedCash = payload.startingCash;
    mockShift.status = 'ACTIVE';
    mockShift.startTime = new Date().toISOString();
    mockShift.salesCount = 0;
    mockShift.totalSales = 0;
    return mockShift;
  },

  closeShift: async (payload: { actualCash: number; difference: number }): Promise<Shift> => {
    mockShift.status = 'CLOSED';
    mockShift.actualCash = payload.actualCash;
    mockShift.difference = payload.difference;
    mockShift.endTime = new Date().toISOString();
    return mockShift;
  }
};
