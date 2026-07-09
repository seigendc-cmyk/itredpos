import { getActiveStaffByVendorAndBranch, getStaffById, validateStaffPin, getStaffByVendor } from './staffFirestoreService';
import { mapStaffRecordToStaffSetting } from './staffFirestoreService';
import type { StaffSetting } from '../types/posTypes';
import { recordStaffAuditEvent } from './staffAuditService';

export const staffService = {
  getStaff: async (): Promise<StaffSetting[]> => {
    const records = await getStaffByVendor('');
    return records.map(mapStaffRecordToStaffSetting);
  },

  getStaffByVendor: async (vendorId: string): Promise<StaffSetting[]> => {
    const records = await getStaffByVendor(vendorId);
    return records.map(mapStaffRecordToStaffSetting);
  },

  getActiveStaffByVendorAndBranch: async (vendorId: string, branchId: string): Promise<StaffSetting[]> => {
    const records = await getActiveStaffByVendorAndBranch(vendorId, branchId);
    return records.map(mapStaffRecordToStaffSetting);
  },

  getStaffById: async (staffId: string): Promise<StaffSetting | null> => {
    const record = await getStaffById(staffId);
    return record ? mapStaffRecordToStaffSetting(record) : null;
  },

  validateStaffAccess: async (staffId: string, pin: string): Promise<StaffSetting | null> => {
    const record = await validateStaffPin(staffId, pin);
    if (record) {
      await recordStaffAuditEvent({
        vendorId: record.vendorId,
        branchId: record.branchId,
        staffId: record.id,
        roleId: record.roleId,
        eventType: 'STAFF_LOGIN_SUCCESS',
        timestamp: new Date().toISOString(),
        metadata: { displayName: record.displayName }
      });
    } else {
      await recordStaffAuditEvent({
        vendorId: '',
        branchId: '',
        staffId,
        roleId: '',
        eventType: 'STAFF_LOGIN_FAILED',
        timestamp: new Date().toISOString(),
        metadata: { reason: 'Invalid PIN or staff not found' }
      });
    }
    return record ? mapStaffRecordToStaffSetting(record) : null;
  }
};
