import { Branch } from '../types/posTypes';
import { mockBranches } from '../mock/mockPosData';

export const branchService = {
  getBranches: async (): Promise<Branch[]> => {
    return mockBranches;
  },

  getBranchesByVendor: async (vendorId: string): Promise<Branch[]> => {
    // For mock prototype, return all branches
    return mockBranches;
  },

  getBranchById: async (branchId: string): Promise<Branch | null> => {
    return mockBranches.find(b => b.id.toUpperCase() === branchId.toUpperCase()) || null;
  }
};
