import { BIEvent } from '../types/posTypes';
import { mockBIEvents } from '../mock/mockPosData';

const BI_EVENTS_KEY = 'itred_pos_bi_events';

export const biEventService = {
  getBIEvents: async (): Promise<BIEvent[]> => {
    const local = localStorage.getItem(BI_EVENTS_KEY);
    if (!local) {
      localStorage.setItem(BI_EVENTS_KEY, JSON.stringify(mockBIEvents));
      return mockBIEvents;
    }
    try {
      return JSON.parse(local);
    } catch {
      return mockBIEvents;
    }
  },

  getBiEvents: async (): Promise<BIEvent[]> => {
    return biEventService.getBIEvents();
  },

  recordBIEvent: async (event: Omit<BIEvent, 'id' | 'timestamp'>): Promise<BIEvent> => {
    const list = await biEventService.getBIEvents();
    const newEvent: BIEvent = {
      ...event,
      id: `BI-EV-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString()
    };
    list.push(newEvent);
    localStorage.setItem(BI_EVENTS_KEY, JSON.stringify(list));
    return newEvent;
  },

  createBiEvent: async (event: Omit<BIEvent, 'id' | 'timestamp'>): Promise<BIEvent> => {
    return biEventService.recordBIEvent(event);
  },

  updateBIEventStatus: async (eventId: string, status: string): Promise<BIEvent | null> => {
    const list = await biEventService.getBIEvents();
    const event = list.find(e => e.id === eventId);
    if (event) {
      if (!event.payload) {
        event.payload = {};
      }
      event.payload.status = status;
      localStorage.setItem(BI_EVENTS_KEY, JSON.stringify(list));
      return event;
    }
    return null;
  }
};
