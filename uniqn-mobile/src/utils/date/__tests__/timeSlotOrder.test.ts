import { sortTimeSlotsByStart } from '@/utils/date/timeSlotOrder';

describe('sortTimeSlotsByStart', () => {
  it('시작시간 오름차순 정렬 (스크린샷 재현: 10:00, 11:00, 10:30)', () => {
    const slots = [{ startTime: '10:00' }, { startTime: '11:00' }, { startTime: '10:30' }];
    expect(sortTimeSlotsByStart(slots).map((s) => s.startTime)).toEqual([
      '10:00',
      '10:30',
      '11:00',
    ]);
  });

  it('TBA(미정) 슬롯은 항상 맨 뒤, 범위 문자열은 시작시각 기준', () => {
    const slots = [
      { startTime: '', isTimeToBeAnnounced: true },
      { startTime: '14:00~22:00' },
      { startTime: '09:30' },
    ];
    expect(sortTimeSlotsByStart(slots).map((s) => s.isTimeToBeAnnounced ?? false)).toEqual([
      false,
      false,
      true,
    ]);
    expect(sortTimeSlotsByStart(slots)[0]!.startTime).toBe('09:30');
  });

  it('원본 배열을 변형하지 않는다', () => {
    const slots = [{ startTime: '11:00' }, { startTime: '10:00' }];
    const copy = [...slots];
    sortTimeSlotsByStart(slots);
    expect(slots).toEqual(copy);
  });
});
