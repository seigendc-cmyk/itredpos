import { CommerceEvent, CommerceEventInput } from './commerceEvents';

/**
 * Publishes a commerce event.
 * In the future, this will write to the 'commerceEvents' Firestore collection.
 * For now, it logs to the console for local build-development.
 * @param eventInput The event data to publish.
 */
export async function publishCommerceEvent(eventInput: CommerceEventInput): Promise<void> {
  const event: CommerceEvent = {
    ...eventInput,
    sourceApp: 'iTredPOS',
    riskScore: eventInput.riskScore || 0,
    createdAt: new Date().toISOString()
  };

  console.log('Publishing Commerce Event:', event);
  // In the future, this will be replaced with:
  // await firestore.collection('commerceEvents').add(event);
}