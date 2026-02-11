/**
 * UNIQN Mobile - applicationHelpers Tests
 *
 * @description Tests for application helper utility functions
 */

import {
  getAppliedDateInfo,
  getPrimaryRole,
  getAllRoles,
  getFirstAppliedDate,
  getFirstTimeSlot,
  hasValidAssignments,
  getFormattedSchedule,
} from '../applicationHelpers';
import type { Application } from '@/types/application';
import type { Assignment } from '@/types/assignment';
import type { StaffRole } from '@/types/role';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockApplication(assignments: Assignment[]): Application {
  return {
    id: 'app-1',
    applicantId: 'user-1',
    applicantName: '홍길동',
    jobPostingId: 'job-1',
    status: 'applied',
    assignments,
  } as Application;
}

function createMockAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    roleIds: ['dealer'],
    timeSlot: '18:00~02:00',
    dates: ['2024-03-15'],
    isGrouped: false,
    ...overrides,
  } as Assignment;
}

describe('applicationHelpers', () => {
  // ============================================================================
  // getAppliedDateInfo
  // ============================================================================

  describe('getAppliedDateInfo', () => {
    it('should extract dates and timeSlots from assignments', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15'],
          timeSlot: '18:00~02:00',
        }),
        createMockAssignment({
          dates: ['2024-03-16'],
          timeSlot: '19:00~03:00',
        }),
      ]);

      const { dates, timeSlots } = getAppliedDateInfo(app);

      expect(dates).toEqual(['2024-03-15', '2024-03-16']);
      expect(timeSlots).toEqual(['18:00~02:00', '19:00~03:00']);
    });

    it('should return empty arrays for empty assignments', () => {
      const app = createMockApplication([]);

      const { dates, timeSlots } = getAppliedDateInfo(app);

      expect(dates).toEqual([]);
      expect(timeSlots).toEqual([]);
    });

    it('should flatten multiple dates from a single assignment', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15', '2024-03-16', '2024-03-17'],
          timeSlot: '18:00~02:00',
        }),
      ]);

      const { dates, timeSlots } = getAppliedDateInfo(app);

      expect(dates).toEqual(['2024-03-15', '2024-03-16', '2024-03-17']);
      expect(timeSlots).toEqual(['18:00~02:00']);
    });

    it('should filter out undefined timeSlots', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15'],
          timeSlot: undefined as unknown as string,
        }),
        createMockAssignment({
          dates: ['2024-03-16'],
          timeSlot: '19:00~03:00',
        }),
      ]);

      const { timeSlots } = getAppliedDateInfo(app);

      expect(timeSlots).toEqual(['19:00~03:00']);
    });

    it('should handle assignments with empty dates array', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: undefined as unknown as string[],
          timeSlot: '18:00~02:00',
        }),
      ]);

      const { dates } = getAppliedDateInfo(app);

      // flatMap on undefined dates should return empty due to ?? []
      expect(dates).toEqual([]);
    });
  });

  // ============================================================================
  // getPrimaryRole
  // ============================================================================

  describe('getPrimaryRole', () => {
    it('should return first role from first assignment', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['dealer'] }),
      ]);

      expect(getPrimaryRole(app)).toBe('dealer');
    });

    it('should return first role when multiple roles exist', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['floor', 'dealer'] }),
      ]);

      expect(getPrimaryRole(app)).toBe('floor');
    });

    it('should return "other" for empty assignments', () => {
      const app = createMockApplication([]);

      expect(getPrimaryRole(app)).toBe('other');
    });

    it('should return "other" when roleIds is empty', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: [] }),
      ]);

      expect(getPrimaryRole(app)).toBe('other');
    });

    it('should return role from first assignment only', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['dealer'] }),
        createMockAssignment({ roleIds: ['floor'] }),
      ]);

      expect(getPrimaryRole(app)).toBe('dealer');
    });
  });

  // ============================================================================
  // getAllRoles
  // ============================================================================

  describe('getAllRoles', () => {
    it('should collect all roles from all assignments', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['dealer'] }),
        createMockAssignment({ roleIds: ['floor'] }),
      ]);

      const roles = getAllRoles(app);

      expect(roles).toContain('dealer');
      expect(roles).toContain('floor');
      expect(roles).toHaveLength(2);
    });

    it('should remove duplicate roles', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['dealer'] }),
        createMockAssignment({ roleIds: ['dealer'] }),
        createMockAssignment({ roleIds: ['floor'] }),
      ]);

      const roles = getAllRoles(app);

      expect(roles).toEqual(['dealer', 'floor']);
    });

    it('should return empty array for empty assignments', () => {
      const app = createMockApplication([]);

      expect(getAllRoles(app)).toEqual([]);
    });

    it('should handle multi-role assignments', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: ['dealer', 'floor'] }),
      ]);

      const roles = getAllRoles(app);

      expect(roles).toContain('dealer');
      expect(roles).toContain('floor');
    });

    it('should handle assignments with undefined roleIds', () => {
      const app = createMockApplication([
        createMockAssignment({ roleIds: undefined as unknown as StaffRole[] }),
      ]);

      const roles = getAllRoles(app);

      // flatMap on undefined roleIds should return empty due to ?? []
      expect(roles).toEqual([]);
    });
  });

  // ============================================================================
  // getFirstAppliedDate
  // ============================================================================

  describe('getFirstAppliedDate', () => {
    it('should return first date', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15', '2024-03-16'],
        }),
      ]);

      expect(getFirstAppliedDate(app)).toBe('2024-03-15');
    });

    it('should return undefined for empty assignments', () => {
      const app = createMockApplication([]);

      expect(getFirstAppliedDate(app)).toBeUndefined();
    });
  });

  // ============================================================================
  // getFirstTimeSlot
  // ============================================================================

  describe('getFirstTimeSlot', () => {
    it('should return first time slot', () => {
      const app = createMockApplication([
        createMockAssignment({ timeSlot: '18:00~02:00' }),
        createMockAssignment({ timeSlot: '19:00~03:00' }),
      ]);

      expect(getFirstTimeSlot(app)).toBe('18:00~02:00');
    });

    it('should return undefined for empty assignments', () => {
      const app = createMockApplication([]);

      expect(getFirstTimeSlot(app)).toBeUndefined();
    });
  });

  // ============================================================================
  // hasValidAssignments
  // ============================================================================

  describe('hasValidAssignments', () => {
    it('should return true for non-empty assignments', () => {
      const app = createMockApplication([createMockAssignment()]);

      expect(hasValidAssignments(app)).toBe(true);
    });

    it('should return false for empty assignments', () => {
      const app = createMockApplication([]);

      expect(hasValidAssignments(app)).toBe(false);
    });

    it('should return true for multiple assignments', () => {
      const app = createMockApplication([
        createMockAssignment(),
        createMockAssignment(),
      ]);

      expect(hasValidAssignments(app)).toBe(true);
    });
  });

  // ============================================================================
  // getFormattedSchedule
  // ============================================================================

  describe('getFormattedSchedule', () => {
    it('should format date and time slot', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15'],
          timeSlot: '18:00~02:00',
        }),
      ]);

      const result = getFormattedSchedule(app);

      expect(result).toBe('3/15 18:00~02:00');
    });

    it('should handle date with leading zeros', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-01-05'],
          timeSlot: '18:00~02:00',
        }),
      ]);

      const result = getFormattedSchedule(app);

      // parseInt removes leading zeros
      expect(result).toBe('1/5 18:00~02:00');
    });

    it('should return empty string for empty assignments', () => {
      const app = createMockApplication([]);

      expect(getFormattedSchedule(app)).toBe('');
    });

    it('should return just date when timeSlot is empty', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15'],
          timeSlot: '',
        }),
      ]);

      const result = getFormattedSchedule(app);

      // Empty timeSlot is falsy, so only date should appear
      expect(result).toBe('3/15');
    });

    it('should use first date and first time slot from multiple assignments', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-03-15'],
          timeSlot: '18:00~02:00',
        }),
        createMockAssignment({
          dates: ['2024-03-16'],
          timeSlot: '19:00~03:00',
        }),
      ]);

      const result = getFormattedSchedule(app);

      expect(result).toBe('3/15 18:00~02:00');
    });

    it('should handle December dates', () => {
      const app = createMockApplication([
        createMockAssignment({
          dates: ['2024-12-25'],
          timeSlot: '10:00~18:00',
        }),
      ]);

      const result = getFormattedSchedule(app);

      expect(result).toBe('12/25 10:00~18:00');
    });
  });
});
