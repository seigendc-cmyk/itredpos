import { POSSettings } from '../types/posTypes';
import { mockSettings } from '../mock/mockPosData';

const SETTINGS_KEY = 'itred_pos_settings_central';

export const settingsService = {
  getPOSSettings: async (vendorId?: string): Promise<POSSettings> => {
    const local = localStorage.getItem(SETTINGS_KEY);
    if (!local) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(mockSettings));
      return mockSettings;
    }
    try {
      return JSON.parse(local);
    } catch {
      return mockSettings;
    }
  },

  savePOSSettings: async (settings: POSSettings): Promise<POSSettings> => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }
};
