import { 
  DeliveryOrder, 
  DeliveryPerson, 
  WalkInCollection, 
  DeliveryEvent, 
  DeliveryStatus, 
  DeliveryMethod, 
  VehicleType, 
  DeliveryFailureReason 
} from '../types/posTypes';
import { 
  mockDeliveryOrders, 
  mockDeliveryPersons, 
  mockWalkInCollections, 
  mockDeliveryEvents 
} from '../mock/mockPosData';

const COLLECTION_KEY = 'sci_pos_walk_in_collections';
const ORDER_KEY = 'sci_pos_delivery_orders';
const PERSON_KEY = 'sci_pos_delivery_persons';
const EVENT_KEY = 'sci_pos_delivery_events';

function getStored<T>(key: string, backup: T[]): T[] {
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      console.error('Failed parsing cached data for ' + key, e);
    }
  }
  localStorage.setItem(key, JSON.stringify(backup));
  return backup;
}

function saveStored<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

export async function getDeliveryOrders(): Promise<DeliveryOrder[]> {
  return getStored<DeliveryOrder>(ORDER_KEY, mockDeliveryOrders);
}

export async function getDeliveryPersons(): Promise<DeliveryPerson[]> {
  return getStored<DeliveryPerson>(PERSON_KEY, mockDeliveryPersons);
}

export async function getWalkInCollections(): Promise<WalkInCollection[]> {
  return getStored<WalkInCollection>(COLLECTION_KEY, mockWalkInCollections);
}

export async function getDeliveryEvents(): Promise<DeliveryEvent[]> {
  return getStored<DeliveryEvent>(EVENT_KEY, mockDeliveryEvents);
}

// Service mutations

export async function assignDelivery(payload: {
  id: string;
  receiptNumber: string;
  customerName: string;
  customerWhatsApp: string;
  deliveryAddress: string;
  district: string;
  suburb: string;
  deliveryMethod: DeliveryMethod;
  deliveryPersonId: string;
  vehicleType: VehicleType;
  vehicleRegistration: string;
  driverPhone: string;
  deliveryCharge: number;
  notes?: string;
  operator: string;
}): Promise<DeliveryOrder> {
  const orders = await getDeliveryOrders();
  const drivers = await getDeliveryPersons();
  
  // Find driver name
  const driver = drivers.find(d => d.driverId === payload.deliveryPersonId);
  const driverName = driver ? driver.name : 'Unknown Driver';

  const orderIndex = orders.findIndex(o => o.id === payload.id);
  
  const updatedOrder: DeliveryOrder = {
    id: payload.id || 'DEL-' + Math.floor(1000 + Math.random() * 9000),
    receiptNumber: payload.receiptNumber,
    customerName: payload.customerName,
    customerWhatsApp: payload.customerWhatsApp,
    deliveryAddress: payload.deliveryAddress,
    district: payload.district,
    suburb: payload.suburb,
    deliveryMethod: payload.deliveryMethod,
    status: 'Assigned', // transition to Assigned as assigned
    codeStatus: 'Not Generated',
    deliveryPersonId: payload.deliveryPersonId,
    vehicleType: payload.vehicleType,
    vehicleRegistration: payload.vehicleRegistration,
    driverPhone: payload.driverPhone,
    deliveryCharge: payload.deliveryCharge,
    notes: payload.notes || ''
  };

  if (orderIndex >= 0) {
    // If we are editing/reassigning an existing order
    updatedOrder.status = 'Assigned';
    updatedOrder.codeStatus = orders[orderIndex].codeStatus;
    updatedOrder.secretCode = orders[orderIndex].secretCode;
    orders[orderIndex] = updatedOrder;
  } else {
    orders.push(updatedOrder);
  }

  saveStored(ORDER_KEY, orders);

  // Add event
  const events = await getDeliveryEvents();
  const newEvent: DeliveryEvent = {
    id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
    timestamp: new Date().toISOString(),
    eventType: 'DELIVERY_ASSIGNED',
    message: `Driver ${driverName} assigned to receipt ${payload.receiptNumber}`,
    operator: payload.operator
  };
  events.unshift(newEvent);
  saveStored(EVENT_KEY, events);

  return updatedOrder;
}

export async function generateDeliveryCode(deliveryId: string, operator: string): Promise<string> {
  const orders = await getDeliveryOrders();
  const index = orders.findIndex(o => o.id === deliveryId);
  if (index === -1) {
    throw new Error(`Delivery matching ID ${deliveryId} not found`);
  }

  // Generate 6 digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  orders[index].secretCode = code;
  orders[index].codeStatus = 'Code Generated';
  saveStored(ORDER_KEY, orders);

  // Add event
  const events = await getDeliveryEvents();
  const newEvent: DeliveryEvent = {
    id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
    timestamp: new Date().toISOString(),
    eventType: 'DELIVERY_SECRET_CODE_GENERATED',
    message: `Customer code generated for ${deliveryId}`,
    operator
  };
  events.unshift(newEvent);
  saveStored(EVENT_KEY, events);

  return code;
}

export async function updateCodeStatus(deliveryId: string, status: 'Code Sent' | 'Code Pending' | 'Code Confirmed', operator: string): Promise<void> {
  const orders = await getDeliveryOrders();
  const index = orders.findIndex(o => o.id === deliveryId);
  if (index !== -1) {
    orders[index].codeStatus = status;
    saveStored(ORDER_KEY, orders);
  }

  if (status === 'Code Sent') {
    const events = await getDeliveryEvents();
    const newEvent: DeliveryEvent = {
      id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
      timestamp: new Date().toISOString(),
      eventType: 'DELIVERY_CODE_SENT_PENDING_CONFIRMATION',
      message: `WhatsApp code placeholder created for ${orders[index]?.customerName || deliveryId}`,
      operator
    };
    events.unshift(newEvent);
    saveStored(EVENT_KEY, events);
  }
}

export async function verifyDeliveryCode(payload: {
  deliveryId: string;
  code: string;
  recipientName: string;
  deliveryNote: string;
  operator: string;
}): Promise<{ success: boolean; message: string }> {
  const orders = await getDeliveryOrders();
  const index = orders.findIndex(o => o.id === payload.deliveryId);
  
  if (index === -1) {
    return { success: false, message: `Delivery ID ${payload.deliveryId} not found` };
  }

  const order = orders[index];

  if (!order.secretCode) {
    return { success: false, message: 'No customer code has been generated for this delivery.' };
  }

  const events = await getDeliveryEvents();

  if (order.secretCode === payload.code) {
    orders[index].status = 'Completed';
    orders[index].codeStatus = 'Code Confirmed';
    orders[index].recipientName = payload.recipientName;
    orders[index].notes = (orders[index].notes || '') + ' | Note: ' + payload.deliveryNote;
    saveStored(ORDER_KEY, orders);

    const newEvent: DeliveryEvent = {
      id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
      timestamp: new Date().toISOString(),
      eventType: 'DELIVERY_COMPLETED',
      message: `Delivery ${payload.deliveryId} completed by code validation`,
      operator: payload.operator
    };
    events.unshift(newEvent);
    saveStored(EVENT_KEY, events);

    return { success: true, message: 'Delivery completed and verified by customer code.' };
  } else {
    const newEvent: DeliveryEvent = {
      id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
      timestamp: new Date().toISOString(),
      eventType: 'DELIVERY_CODE_FAILED',
      message: `Incorrect code entered for ${payload.deliveryId}`,
      operator: payload.operator
    };
    events.unshift(newEvent);
    saveStored(EVENT_KEY, events);

    return { success: false, message: 'Incorrect code. Delivery cannot be completed.' };
  }
}

export async function markDeliveryFailed(payload: {
  deliveryId: string;
  failedReason: DeliveryFailureReason;
  nextAction: string;
  notes: string;
  operator: string;
}): Promise<void> {
  const orders = await getDeliveryOrders();
  const index = orders.findIndex(o => o.id === payload.deliveryId);
  if (index !== -1) {
    orders[index].status = 'Failed';
    orders[index].failedReason = payload.failedReason;
    orders[index].nextAction = payload.nextAction;
    orders[index].notes = (orders[index].notes || '') + ' | Failed: ' + payload.notes;
    saveStored(ORDER_KEY, orders);
  }

  const events = await getDeliveryEvents();
  const newEvent: DeliveryEvent = {
    id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
    timestamp: new Date().toISOString(),
    eventType: 'DELIVERY_FAILED',
    message: `Delivery ${payload.deliveryId} marked failed due to: ${payload.failedReason}`,
    operator: payload.operator
  };
  events.unshift(newEvent);
  saveStored(EVENT_KEY, events);
}

export async function generateCollectionCode(receiptNumber: string, operator: string): Promise<string> {
  const collections = await getWalkInCollections();
  
  // Find or create walk in collection
  let index = collections.findIndex(c => c.receiptNumber === receiptNumber);
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  if (index === -1) {
    const newCollection: WalkInCollection = {
      receiptNumber,
      customerName: 'Customer (' + receiptNumber + ')',
      customerWhatsApp: '+263770000000',
      collectionCode: code,
      status: 'Pending'
    };
    collections.push(newCollection);
  } else {
    collections[index].collectionCode = code;
    collections[index].status = 'Pending';
  }

  saveStored(COLLECTION_KEY, collections);

  // Change code on Delivery list too if any matching customer collection DEL exists
  const orders = await getDeliveryOrders();
  const orderIndex = orders.findIndex(o => o.receiptNumber === receiptNumber && o.deliveryMethod === 'Customer Collection');
  if (orderIndex !== -1) {
    orders[orderIndex].secretCode = code;
    orders[orderIndex].codeStatus = 'Code Generated';
    saveStored(ORDER_KEY, orders);
  }

  // Add event
  const events = await getDeliveryEvents();
  const newEvent: DeliveryEvent = {
    id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
    timestamp: new Date().toISOString(),
    eventType: 'DELIVERY_SECRET_CODE_GENERATED',
    message: `Collection code generated for receipt ${receiptNumber}`,
    operator
  };
  events.unshift(newEvent);
  saveStored(EVENT_KEY, events);

  return code;
}

export async function verifyCollectionCode(payload: {
  receiptNumber: string;
  code: string;
  collectedBy: string;
  notes: string;
  operator: string;
}): Promise<{ success: boolean; message: string }> {
  const collections = await getWalkInCollections();
  let index = collections.findIndex(c => c.receiptNumber === payload.receiptNumber);

  // Fallback check against deliveries: maybe there is a Customer Collection Delivery item
  const orders = await getDeliveryOrders();
  const orderIndex = orders.findIndex(o => o.receiptNumber === payload.receiptNumber && o.deliveryMethod === 'Customer Collection');

  const correctCode = index !== -1 
    ? collections[index].collectionCode 
    : (orderIndex !== -1 ? orders[orderIndex].secretCode : undefined);

  if (!correctCode) {
    return { success: false, message: 'No customer collection code has been generated for this receipt.' };
  }

  const events = await getDeliveryEvents();

  if (correctCode === payload.code) {
    if (index !== -1) {
      collections[index].status = 'Completed';
      collections[index].collectedBy = payload.collectedBy;
      collections[index].notes = payload.notes;
      saveStored(COLLECTION_KEY, collections);
    }
    
    if (orderIndex !== -1) {
      orders[orderIndex].status = 'Completed';
      orders[orderIndex].codeStatus = 'Code Confirmed';
      orders[orderIndex].recipientName = payload.collectedBy;
      orders[orderIndex].notes = (orders[orderIndex].notes || '') + ' | Note: ' + payload.notes;
      saveStored(ORDER_KEY, orders);
    }

    const newEvent: DeliveryEvent = {
      id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
      timestamp: new Date().toISOString(),
      eventType: 'WALK_IN_COLLECTION_COMPLETED',
      message: `Walk-in collection confirmed for ${payload.receiptNumber} by code validation`,
      operator: payload.operator
    };
    events.unshift(newEvent);
    saveStored(EVENT_KEY, events);

    return { success: true, message: 'Collection verified and completed successfully!' };
  } else {
    const newEvent: DeliveryEvent = {
      id: 'DLE-' + (events.length + 100 + Math.floor(Math.random() * 900)),
      timestamp: new Date().toISOString(),
      eventType: 'COLLECTION_CODE_FAILED',
      message: `Incorrect collection code entered for ${payload.receiptNumber}`,
      operator: payload.operator
    };
    events.unshift(newEvent);
    saveStored(EVENT_KEY, events);

    return { success: false, message: 'Incorrect collection code. Walk-in collection denied.' };
  }
}
