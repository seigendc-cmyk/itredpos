import { Shift } from '../types/posTypes';
import { mockShift } from '../mock/mockPosData';
import { publishCommerceEvent } from '../../commerce-integration/events/publishCommerceEvent';
import { writeAuditLog } from '../../commerce-integration/audit/writeAuditLog';

/**
 * Provides the necessary context for shift operations, including
 * identifiers for tenancy, location, and the acting staff member.
 */
export interface ShiftContext {
  vendorId: string;
  branchId: string;
  terminalId: string;
  staffId: string;
  correlationId?: string;
}

export const shiftService = {
  getCurrentShift: async (branchId: string, terminalId: string): Promise<Shift | null> => {
    return mockShift;
  },

  openShift: async (
    payload: { operator: string; startingCash: number },
    context?: ShiftContext
  ): Promise<Shift> => {
    mockShift.operator = payload.operator;
    mockShift.startingCash = payload.startingCash;
    mockShift.expectedCash = payload.startingCash;
    mockShift.status = 'ACTIVE';
    mockShift.startTime = new Date().toISOString();
    mockShift.salesCount = 0;
    mockShift.totalSales = 0;

    // Eventing and Auditing will only occur if context is provided.
    if (context) {
      // Publish ShiftOpened event after the core transaction succeeds.
      void publishCommerceEvent({
        eventType: 'ShiftOpened',
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        correlationId: context.correlationId,
        module: 'Operations',
        entityType: 'Shift',
        entityId: mockShift.id,
        payload: {
          summary: `Shift opened by ${payload.operator} with starting float ${payload.startingCash}.`,
          amount: payload.startingCash,
          currency: 'USD',
          metadata: { operator: payload.operator },
        },
      });

      // Write an audit log for the shift opening.
      void writeAuditLog({
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        correlationId: context.correlationId,
        module: 'Operations',
        action: 'ShiftOpened',
        entityType: 'Shift',
        entityId: mockShift.id,
        after: { status: 'ACTIVE', startingCash: payload.startingCash },
      });
    }

    return mockShift;
  },

  closeShift: async (
    payload: { actualCash: number; difference: number },
    context?: ShiftContext
  ): Promise<Shift> => {
    mockShift.status = 'CLOSED';
    mockShift.actualCash = payload.actualCash;
    mockShift.difference = payload.difference;
    mockShift.endTime = new Date().toISOString();

    if (context) {
      void publishCommerceEvent({
        eventType: 'ShiftClosed',
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        correlationId: context.correlationId,
        module: 'Operations',
        entityType: 'Shift',
        entityId: mockShift.id,
        payload: {
          summary: `Shift closed with variance ${payload.difference}.`,
          amount: payload.actualCash,
          metadata: { expected: mockShift.expectedCash, difference: payload.difference },
        },
      });

      void writeAuditLog({
        vendorId: context.vendorId,
        branchId: context.branchId,
        terminalId: context.terminalId,
        staffId: context.staffId,
        correlationId: context.correlationId,
        module: 'Operations',
        action: 'ShiftClosed',
        entityType: 'Shift',
        entityId: mockShift.id,
        after: { status: 'CLOSED', actualCash: payload.actualCash, variance: payload.difference },
      });
    }

    return mockShift;
  }
};
