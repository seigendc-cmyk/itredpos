export * from '../../licensing/posActivationConsumer';

export {
  getDeviceId,
  readLocalActivation,
  saveLocalActivation,
  clearLocalActivation,
  validateActivationCode,
  consumeActivationCode,
  hasValidPOSActivation
} from './posActivationCodeService';
export type {
  POSActivationSnapshotLocal,
  ActivationCodeRecord,
  POSActivationCodeResult
} from './posActivationCodeService';
