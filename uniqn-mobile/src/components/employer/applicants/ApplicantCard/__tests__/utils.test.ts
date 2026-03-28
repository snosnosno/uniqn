import { formatTimeSlotDisplay } from '../utils';

describe('ApplicantCard utils', () => {
  it('shows 미정 when time is not fixed', () => {
    expect(formatTimeSlotDisplay('', true)).toBe('미정');
  });

  it('includes the tentative description when provided', () => {
    expect(formatTimeSlotDisplay('', true, '현장 공지')).toBe('미정 (현장 공지)');
  });
});
