export type SimpleAuthStage = 'idle' | 'loading' | 'ready' | 'error';

export interface SimpleOwnerAuthContext {
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

export interface SimpleAuthState {
  stage: SimpleAuthStage;
  context: SimpleOwnerAuthContext | null;
  error: string | null;
}
