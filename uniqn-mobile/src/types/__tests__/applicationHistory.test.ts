/**
 * UNIQN Mobile - ApplicationHistory 타입 유틸리티 테스트
 *
 * @description createHistoryEntry, addCancellationToEntry, findActiveConfirmation,
 *   countConfirmations, countCancellations, createHistorySummary 함수 테스트
 */

import { Timestamp } from 'firebase/firestore';
import type { Assignment } from '../assignment';
import type { ConfirmationHistoryEntry } from '../applicationHistory';
import {
  createHistoryEntry,
  addCancellationToEntry,
  findActiveConfirmation,
  countConfirmations,
  countCancellations,
  createHistorySummary,
} from '../applicationHistory';

// =============================================================================
// Helper: 테스트용 mock assignment
// =============================================================================
const mockAssignment = (overrides = {}): Assignment => ({
  roleIds: ['dealer'],
  timeSlot: '18:00~02:00',
  dates: ['2025-03-01'],
  isGrouped: false,
  ...overrides,
});

const createMockEntry = (overrides: Partial<ConfirmationHistoryEntry> = {}): ConfirmationHistoryEntry => ({
  confirmedAt: Timestamp.fromDate(new Date('2025-03-01T10:00:00Z')),
  assignments: [mockAssignment()],
  ...overrides,
});

// =============================================================================
// Tests
// =============================================================================

describe('applicationHistory', () => {
  // ===========================================================================
  // createHistoryEntry
  // ===========================================================================
  describe('createHistoryEntry', () => {
    it('should create entry with assignments and confirmedAt timestamp', () => {
      const assignments = [mockAssignment()];
      const entry = createHistoryEntry(assignments);

      expect(entry.assignments).toEqual(assignments);
      expect(entry.confirmedAt).toBeInstanceOf(Timestamp);
      expect(entry.confirmedBy).toBeUndefined();
      expect(entry.cancelledAt).toBeUndefined();
      expect(entry.cancelReason).toBeUndefined();
    });

    it('should include confirmedBy when provided', () => {
      const assignments = [mockAssignment()];
      const entry = createHistoryEntry(assignments, 'employer-123');

      expect(entry.confirmedBy).toBe('employer-123');
    });

    it('should work with empty assignments array', () => {
      const entry = createHistoryEntry([]);
      expect(entry.assignments).toEqual([]);
    });

    it('should work with multiple assignments', () => {
      const assignments = [
        mockAssignment({ id: 'a1' }),
        mockAssignment({ id: 'a2' }),
        mockAssignment({ id: 'a3' }),
      ];
      const entry = createHistoryEntry(assignments, 'employer-1');

      expect(entry.assignments).toHaveLength(3);
    });
  });

  // ===========================================================================
  // addCancellationToEntry
  // ===========================================================================
  describe('addCancellationToEntry', () => {
    it('should add cancellation info to an existing entry', () => {
      const original = createMockEntry();
      const cancelled = addCancellationToEntry(original, '개인 사정', 'employer-1');

      expect(cancelled.cancelledAt).toBeInstanceOf(Timestamp);
      expect(cancelled.cancelReason).toBe('개인 사정');
      expect(cancelled.cancelledBy).toBe('employer-1');
      // Should preserve original fields
      expect(cancelled.confirmedAt).toBe(original.confirmedAt);
      expect(cancelled.assignments).toBe(original.assignments);
    });

    it('should work without cancelReason and cancelledBy', () => {
      const original = createMockEntry();
      const cancelled = addCancellationToEntry(original);

      expect(cancelled.cancelledAt).toBeInstanceOf(Timestamp);
      expect(cancelled.cancelReason).toBeUndefined();
      expect(cancelled.cancelledBy).toBeUndefined();
    });

    it('should not mutate the original entry', () => {
      const original = createMockEntry();
      addCancellationToEntry(original, '사유');

      expect(original.cancelledAt).toBeUndefined();
      expect(original.cancelReason).toBeUndefined();
    });
  });

  // ===========================================================================
  // findActiveConfirmation
  // ===========================================================================
  describe('findActiveConfirmation', () => {
    it('should return the most recent uncancelled entry', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-01-01')),
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
          cancelReason: '취소',
        }),
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-02-01')),
        }),
      ];

      const active = findActiveConfirmation(entries);
      expect(active).toBe(entries[1]);
    });

    it('should return null if all entries are cancelled', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
        }),
        createMockEntry({
          cancelledAt: Timestamp.fromDate(new Date('2025-02-15')),
        }),
      ];

      expect(findActiveConfirmation(entries)).toBeNull();
    });

    it('should return null for empty history', () => {
      expect(findActiveConfirmation([])).toBeNull();
    });

    it('should return the last uncancelled entry when multiple exist', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-01-01')),
        }),
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-02-01')),
        }),
      ];

      // Should return the last one (index 1) since it traverses in reverse
      const active = findActiveConfirmation(entries);
      expect(active).toBe(entries[1]);
    });

    it('should skip cancelled entries and find active one earlier in array', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-01-01')),
        }),
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-02-01')),
          cancelledAt: Timestamp.fromDate(new Date('2025-02-15')),
        }),
      ];

      const active = findActiveConfirmation(entries);
      expect(active).toBe(entries[0]);
    });
  });

  // ===========================================================================
  // countConfirmations
  // ===========================================================================
  describe('countConfirmations', () => {
    it('should return total number of entries', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry(),
        createMockEntry(),
        createMockEntry(),
      ];

      expect(countConfirmations(entries)).toBe(3);
    });

    it('should return 0 for empty array', () => {
      expect(countConfirmations([])).toBe(0);
    });

    it('should count cancelled entries too (they were confirmed at some point)', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
        }),
        createMockEntry(),
      ];

      expect(countConfirmations(entries)).toBe(2);
    });
  });

  // ===========================================================================
  // countCancellations
  // ===========================================================================
  describe('countCancellations', () => {
    it('should count entries with cancelledAt', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
        }),
        createMockEntry(),
        createMockEntry({
          cancelledAt: Timestamp.fromDate(new Date('2025-03-15')),
        }),
      ];

      expect(countCancellations(entries)).toBe(2);
    });

    it('should return 0 when no entries are cancelled', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry(),
        createMockEntry(),
      ];

      expect(countCancellations(entries)).toBe(0);
    });

    it('should return 0 for empty array', () => {
      expect(countCancellations([])).toBe(0);
    });
  });

  // ===========================================================================
  // createHistorySummary
  // ===========================================================================
  describe('createHistorySummary', () => {
    it('should create correct summary for mixed history', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-01-01')),
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
        }),
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-02-01')),
        }),
      ];

      const summary = createHistorySummary(entries);

      expect(summary.totalConfirmations).toBe(2);
      expect(summary.cancellations).toBe(1);
      expect(summary.isCurrentlyConfirmed).toBe(true);
      expect(summary.lastConfirmedAt).toEqual(entries[1]!.confirmedAt);
      expect(summary.lastCancelledAt).toEqual(entries[0]!.cancelledAt);
    });

    it('should handle empty history', () => {
      const summary = createHistorySummary([]);

      expect(summary.totalConfirmations).toBe(0);
      expect(summary.cancellations).toBe(0);
      expect(summary.isCurrentlyConfirmed).toBe(false);
      expect(summary.lastConfirmedAt).toBeUndefined();
      expect(summary.lastCancelledAt).toBeUndefined();
    });

    it('should handle all cancelled history', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-01-01')),
          cancelledAt: Timestamp.fromDate(new Date('2025-01-15')),
        }),
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-02-01')),
          cancelledAt: Timestamp.fromDate(new Date('2025-02-15')),
        }),
      ];

      const summary = createHistorySummary(entries);

      expect(summary.totalConfirmations).toBe(2);
      expect(summary.cancellations).toBe(2);
      expect(summary.isCurrentlyConfirmed).toBe(false);
    });

    it('should handle single active confirmation', () => {
      const entries: ConfirmationHistoryEntry[] = [
        createMockEntry({
          confirmedAt: Timestamp.fromDate(new Date('2025-03-01')),
        }),
      ];

      const summary = createHistorySummary(entries);

      expect(summary.totalConfirmations).toBe(1);
      expect(summary.cancellations).toBe(0);
      expect(summary.isCurrentlyConfirmed).toBe(true);
      expect(summary.lastConfirmedAt).toEqual(entries[0]!.confirmedAt);
      expect(summary.lastCancelledAt).toBeUndefined();
    });
  });
});
