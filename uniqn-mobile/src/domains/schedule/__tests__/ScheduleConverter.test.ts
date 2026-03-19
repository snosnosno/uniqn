import { ScheduleConverter } from '../ScheduleConverter';

describe('ScheduleConverter.parseTimeSlotToTimestamp', () => {
  it('parses valid time slots through the shared date utility path', () => {
    const timestamp = ScheduleConverter.parseTimeSlotToTimestamp(
      '09:00~18:00',
      '2025-01-15',
      'start'
    );

    expect(timestamp).not.toBeNull();
    expect(timestamp?.toDate().getFullYear()).toBe(2025);
    expect(timestamp?.toDate().getMonth()).toBe(0);
    expect(timestamp?.toDate().getDate()).toBe(15);
    expect(timestamp?.toDate().getHours()).toBe(9);
  });

  it('returns null for invalid date input', () => {
    expect(
      ScheduleConverter.parseTimeSlotToTimestamp('09:00~18:00', 'invalid-date', 'start')
    ).toBeNull();
    expect(
      ScheduleConverter.parseTimeSlotToTimestamp('09:00~18:00', '2025-02-30', 'start')
    ).toBeNull();
  });
});
