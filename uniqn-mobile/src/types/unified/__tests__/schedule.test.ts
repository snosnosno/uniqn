import { createFixedSchedule, formatDateDisplay, formatFixedScheduleDisplay } from '../schedule';

describe('types/unified/schedule', () => {
  it('keeps fixed schedule HH:mm display unchanged', () => {
    const schedule = createFixedSchedule(5, [], {
      startTime: '09:00',
      isStartTimeNegotiable: false,
    });

    expect(formatFixedScheduleDisplay(schedule)).toContain('09:00');
  });

  it('falls back to the raw date string for invalid input', () => {
    expect(formatDateDisplay('invalid-date')).toBe('invalid-date');
  });
});
