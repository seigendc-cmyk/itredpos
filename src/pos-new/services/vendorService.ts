import { Vendor } from '../types/posTypes';
import { mockVendors } from '../mock/mockPosData';

const VENDOR_KEY = 'itred_pos_business_profile';

const DEFAULT_VENDOR: Vendor = mockVendors[0];

export const vendorService = {
  getVendors: async (): Promise<Vendor[]> => {
    return mockVendors;
  },

  getVendorById: async (vendorId: string): Promise<Vendor | null> => {
    return mockVendors.find(v => v.id === vendorId) || null;
  },

  getVendorProfile: async (): Promise<Vendor> => {
    const local = localStorage.getItem(VENDOR_KEY);
    if (!local) {
      localStorage.setItem(VENDOR_KEY, JSON.stringify(DEFAULT_VENDOR));
      return DEFAULT_VENDOR;
    }
    try {
      const parsed = JSON.parse(local);
      return { ...DEFAULT_VENDOR, ...parsed };
    } catch {
      return DEFAULT_VENDOR;
    }
  },

  updateVendorProfile: async (profile: Partial<Vendor>): Promise<Vendor> => {
    const current = await vendorService.getVendorProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(VENDOR_KEY, JSON.stringify(updated));
    return updated;
  }
};
