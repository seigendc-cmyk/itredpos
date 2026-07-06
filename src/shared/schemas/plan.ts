export interface PlanLimits {
  maxBranches: number;
  maxTerminals: number;
  maxStaff: number;
  maxProducts: number;
}

export interface PlanFeatureFlags {
  salesEnabled: boolean;
  inventoryEnabled: boolean;
  reportsEnabled: boolean;
  deliveryEnabled: boolean;
  purchasingEnabled: boolean;
  creditorsEnabled: boolean;
  biEnabled: boolean;
}

export interface PlanRecord {
  planId: string;
  planCode: string;
  planName: string;
  billingCycle: "Demo" | "Monthly" | "Quarterly" | "Yearly";
  price: number;
  currency: string;
  limits: PlanLimits;
  featureFlags: PlanFeatureFlags;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}
