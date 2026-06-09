import { Terminal } from '../types/posTypes';
import { mockTerminals } from '../mock/mockPosData';

export const terminalService = {
  getTerminals: async (): Promise<Terminal[]> => {
    return mockTerminals;
  },

  getTerminalsByBranch: async (branchId: string): Promise<Terminal[]> => {
    return mockTerminals.filter(t => t.branchId.toUpperCase() === branchId.toUpperCase());
  },

  getTerminalById: async (terminalId: string): Promise<Terminal | null> => {
    return mockTerminals.find(t => t.id === terminalId) || null;
  }
};
