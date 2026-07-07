import type { AccessContext, AccessStage, AccessStageResult } from './accessTypes';

export function resolveAccessStage(context: AccessContext): AccessStageResult {
  if (!context.licenseTokenCode || context.licenseStatus !== 'Active') {
    return { stage: 'licenseRequired', context };
  }

  if (!context.businessProfileCreated) {
    return { stage: 'businessProfileRequired', context };
  }

  if (!context.ownerCreated) {
    return { stage: 'ownerSetupRequired', context };
  }

  if (!context.staffAuthenticated) {
    return { stage: 'staffAccessRequired', context };
  }

  return { stage: 'posReady', context };
}
