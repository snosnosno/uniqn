import { TimeNormalizer } from '../time/TimeNormalizer';
import type { NormalizedWorkTime } from '../time/types';

describe('TimeNormalizer', () => {
  describe('normalize', () => {
    it('maps actual check-in and check-out times', () => {
      const input = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: new Date('2025-01-20T18:00:00'),
      };

      const normalized = TimeNormalizer.normalize(input);

      expect(normalized.actualStart).toEqual(input.checkInTime);
      expect(normalized.actualEnd).toEqual(input.checkOutTime);
      expect(normalized.isEstimate).toBe(false);
    });

    it('derives scheduled time from timeSlot and date', () => {
      const normalized = TimeNormalizer.normalize({
        timeSlot: '09:00~18:30',
        date: '2025-01-20',
      });

      expect(normalized.scheduledStart?.getHours()).toBe(9);
      expect(normalized.scheduledStart?.getMinutes()).toBe(0);
      expect(normalized.scheduledEnd?.getHours()).toBe(18);
      expect(normalized.scheduledEnd?.getMinutes()).toBe(30);
      expect(normalized.isEstimate).toBe(true);
    });

    it('falls back to projection startTime and endTime', () => {
      const normalized = TimeNormalizer.normalize({
        startTime: '09:00',
        endTime: '18:00',
      });

      expect(normalized.scheduledStart?.getHours()).toBe(9);
      expect(normalized.scheduledEnd?.getHours()).toBe(18);
    });

    it('supports ISO string inputs (post-schema 정규화)', () => {
      // Task 4 이후: Firebase Timestamp-shaped 입력은 timestampSchema가 ISO string으로 정규화함.
      const date = new Date('2025-01-20T09:00:00');
      const normalized = TimeNormalizer.normalize({
        checkInTime: date.toISOString(),
      });

      expect(normalized.actualStart).toEqual(date);
    });

    it('returns null fields for empty input', () => {
      const normalized = TimeNormalizer.normalize({});

      expect(normalized).toEqual({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      });
    });
  });

  describe('calculateHours', () => {
    it('calculates actual hours', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T17:45:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBeCloseTo(8.75, 2);
    });

    it('returns 0 when actual times are incomplete', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBe(0);
    });
  });

  describe('calculateHoursFromScheduled', () => {
    it('calculates scheduled hours', () => {
      const normalized = TimeNormalizer.normalize({
        timeSlot: '09:00~18:00',
        date: '2025-01-20',
      });

      expect(TimeNormalizer.calculateHoursFromScheduled(normalized)).toBe(9);
    });

    it('supports cross-midnight time slots', () => {
      const normalized = TimeNormalizer.normalize({
        timeSlot: '18:00~02:00',
        date: '2025-01-20',
      });

      expect(TimeNormalizer.calculateHoursFromScheduled(normalized)).toBe(8);
    });
  });

  describe('getEffectiveHours', () => {
    it('prefers actual hours when both actual times exist', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: new Date('2025-01-20T09:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'),
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T17:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.getEffectiveHours(normalized)).toBe(8);
    });

    it('falls back to scheduled hours when actual times are missing', () => {
      const normalized = TimeNormalizer.normalize({
        timeSlot: '09:00~18:00',
        date: '2025-01-20',
      });

      expect(TimeNormalizer.getEffectiveHours(normalized)).toBe(9);
    });
  });

  describe('state helpers', () => {
    it('reports actual presence correctly', () => {
      const normalized = TimeNormalizer.normalize({
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: new Date('2025-01-20T18:00:00'),
      });

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(true);
      expect(TimeNormalizer.isCheckedIn(normalized)).toBe(true);
      expect(TimeNormalizer.isCheckedOut(normalized)).toBe(true);
    });

    it('reports partial actual state correctly', () => {
      const normalized = TimeNormalizer.normalize({
        checkInTime: new Date('2025-01-20T09:00:00'),
      });

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(false);
      expect(TimeNormalizer.isCheckedIn(normalized)).toBe(true);
      expect(TimeNormalizer.isCheckedOut(normalized)).toBe(false);
    });
  });

  describe('parseTime', () => {
    it('parses HH:mm:ss strings', () => {
      const parsed = TimeNormalizer.parseTime('09:15:30');

      expect(parsed).not.toBeNull();
      expect(parsed?.getHours()).toBe(9);
      expect(parsed?.getMinutes()).toBe(15);
      expect(parsed?.getSeconds()).toBe(30);
    });

    it('returns null for out-of-range time strings', () => {
      expect(TimeNormalizer.parseTime('25:00')).toBeNull();
      expect(TimeNormalizer.parseTime('09:61')).toBeNull();
    });
  });
});
