import { ApplicationStatusMachine } from '../ApplicationStatusMachine';
import type { StatusAction } from '../ApplicationStatusMachine';

describe('ApplicationStatusMachine', () => {
  const machine = new ApplicationStatusMachine();

  describe('canTransition', () => {
    it.each([
      ['applied', 'CONFIRM', 'confirmed'],
      ['applied', 'REJECT', 'rejected'],
      ['applied', 'CANCEL', 'cancelled'],
      ['confirmed', 'REQUEST_CANCEL', 'cancellation_pending'],
      ['cancellation_pending', 'APPROVE_CANCEL', 'cancelled'],
      ['cancellation_pending', 'REJECT_CANCEL', 'confirmed'],
    ] as const)('%s + %s -> %s', (current, action, expected) => {
      const result = machine.canTransition(current, action as StatusAction);
      expect(result.allowed).toBe(true);
      expect(result.nextStatus).toBe(expected);
    });

    it.each([
      ['rejected', 'CONFIRM'],
      ['rejected', 'CANCEL'],
      ['cancelled', 'CONFIRM'],
      ['cancelled', 'REQUEST_CANCEL'],
      ['completed', 'CANCEL'],
      ['completed', 'CONFIRM'],
      ['applied', 'REQUEST_CANCEL'],
      ['applied', 'COMPLETE'],
      ['confirmed', 'CANCEL'],
      ['confirmed', 'CONFIRM'],
      ['cancellation_pending', 'CANCEL'],
    ] as const)('%s + %s should be rejected', (current, action) => {
      const result = machine.canTransition(current, action as StatusAction);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe('transition', () => {
    it('returns next status for valid transition', () => {
      expect(machine.transition('applied', 'CONFIRM')).toBe('confirmed');
    });

    it('throws for invalid transition', () => {
      expect(() => machine.transition('rejected', 'CONFIRM')).toThrow();
    });
  });

  describe('available actions', () => {
    it('returns expected actions for applied', () => {
      expect(machine.getAvailableActions('applied')).toEqual(
        expect.arrayContaining(['CONFIRM', 'REJECT', 'CANCEL'])
      );
    });

    it('returns expected actions for confirmed', () => {
      expect(machine.getAvailableActions('confirmed')).toEqual(
        expect.arrayContaining(['REQUEST_CANCEL'])
      );
    });

    it('returns no actions for terminal states', () => {
      expect(machine.getAvailableActions('rejected')).toHaveLength(0);
      expect(machine.getAvailableActions('cancelled')).toHaveLength(0);
      expect(machine.getAvailableActions('completed')).toHaveLength(0);
    });
  });

  describe('staff actions', () => {
    it('applied can cancel directly', () => {
      expect(machine.getAvailableStaffActions('applied')).toContain('CANCEL');
      expect(machine.canStaffDirectCancel('applied')).toBe(true);
    });

    it('confirmed can only request cancel', () => {
      expect(machine.getAvailableStaffActions('confirmed')).toContain('REQUEST_CANCEL');
      expect(machine.canStaffRequestCancel('confirmed')).toBe(true);
      expect(machine.canStaffDirectCancel('confirmed')).toBe(false);
    });

    it('terminal states expose no staff actions', () => {
      expect(machine.getAvailableStaffActions('rejected')).toHaveLength(0);
      expect(machine.getAvailableStaffActions('cancelled')).toHaveLength(0);
      expect(machine.getAvailableStaffActions('completed')).toHaveLength(0);
    });
  });

  describe('employer actions', () => {
    it('applied can confirm or reject', () => {
      const actions = machine.getAvailableEmployerActions('applied');
      expect(actions).toEqual(expect.arrayContaining(['CONFIRM', 'REJECT']));
    });

    it('cancellation_pending can review cancellation', () => {
      const actions = machine.getAvailableEmployerActions('cancellation_pending');
      expect(actions).toEqual(expect.arrayContaining(['APPROVE_CANCEL', 'REJECT_CANCEL']));
    });
  });

  describe('metadata', () => {
    it.each([
      'applied',
      'confirmed',
      'rejected',
      'cancelled',
      'completed',
      'cancellation_pending',
    ] as const)('returns metadata for %s', (status) => {
      const metadata = machine.getStatusMetadata(status);
      expect(metadata.label).toBeTruthy();
      expect(metadata.labelEn).toBeTruthy();
      expect(metadata.color).toBeTruthy();
      expect(metadata.bgColor).toBeTruthy();
    });
  });

  describe('final status checks', () => {
    it.each([
      ['rejected', true],
      ['cancelled', true],
      ['completed', true],
      ['applied', false],
      ['confirmed', false],
      ['cancellation_pending', false],
    ] as const)('%s final=%s', (status, expected) => {
      expect(machine.isFinalStatus(status)).toBe(expected);
    });
  });
});
