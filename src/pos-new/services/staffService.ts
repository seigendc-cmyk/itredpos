import { StaffMember } from '../types/posTypes';
import { mockStaff } from '../mock/mockPosData';

export const staffService = {
  getStaff: async (): Promise<StaffMember[]> => {
    return mockStaff;
  },

  getStaffByVendor: async (vendorId: string): Promise<StaffMember[]> => {
    return mockStaff;
  },

  validateStaffAccess: async (staffId: string, pass: string): Promise<StaffMember | null> => {
    const member = mockStaff.find(s => s.id === staffId && s.pass === pass);
    return member || null;
  }
};
