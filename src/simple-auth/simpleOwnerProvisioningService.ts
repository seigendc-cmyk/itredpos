export interface SimpleOwnerProfile {
  ownerUid: string;
  ownerEmail: string;
  ownerName: string;
  vendorId: string;
  vendorName: string;
  branchId: string;
  warehouseId: string;
  role: string;
  permissions: string[];
  signedInAt: string;
}

export function createDefaultOwnerProfile(uid: string, email: string, displayName: string): SimpleOwnerProfile {
  const ownerUid = uid;
  const ownerEmail = email;
  const ownerName = displayName || email.split('@')[0];
  const vendorId = `vendor-${uid.slice(0, 8)}`;
  const vendorName = 'New Business';
  const branchId = 'main-branch';
  const warehouseId = 'main-warehouse';
  const role = 'Owner';
  const permissions = ['*'];
  const signedInAt = new Date().toISOString();

  return {
    ownerUid,
    ownerEmail,
    ownerName,
    vendorId,
    vendorName,
    branchId,
    warehouseId,
    role,
    permissions,
    signedInAt
  };
}
