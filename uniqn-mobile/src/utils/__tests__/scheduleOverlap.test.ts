import {
  detectScheduleOverlaps,
  formatOverlapWarning,
  type OverlapCandidate,
} from '@/utils/scheduleOverlap';

function shift(overrides: Partial<OverlapCandidate> & { id: string }): OverlapCandidate {
  return {
    date: '2026-07-27',
    timeSlot: '18:00-23:00',
    type: 'confirmed',
    jobPostingName: '강남 홀덤펍',
    ...overrides,
  };
}

describe('detectScheduleOverlaps', () => {
  it('겹치는 확정 근무를 양쪽 모두 표시한다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'a', timeSlot: '18:00-23:00' }),
      shift({ id: 'b', timeSlot: '20:00-02:00', jobPostingName: '역삼 홀덤펍' }),
    ]);

    expect(overlaps.get('a')?.map((s) => s.id)).toEqual(['b']);
    expect(overlaps.get('b')?.map((s) => s.id)).toEqual(['a']);
  });

  // 반열림 구간 — 앞 근무가 끝나는 시각에 다음 근무가 시작하는 건 겹침이 아니다.
  it('경계가 맞닿기만 하면 겹침이 아니다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'a', timeSlot: '12:00-18:00' }),
      shift({ id: 'b', timeSlot: '18:00-23:00' }),
    ]);

    expect(overlaps.size).toBe(0);
  });

  it('자정을 넘는 근무도 정확히 겹침을 잡는다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'night', timeSlot: '22:00-06:00' }),
      shift({ id: 'late', timeSlot: '23:00-03:00' }),
    ]);

    expect(overlaps.has('night')).toBe(true);
  });

  it('날짜가 다르면 겹치지 않는다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'a' }),
      shift({ id: 'b', date: '2026-07-28' }),
    ]);

    expect(overlaps.size).toBe(0);
  });

  // 지원 중은 확정될지 모른다 — 경고하면 소음이다.
  it('확정이 아닌 건은 보지 않는다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'a' }),
      shift({ id: 'b', type: 'applied' }),
    ]);

    expect(overlaps.size).toBe(0);
  });

  it('시간을 해석할 수 없으면 판정하지 않는다', () => {
    const overlaps = detectScheduleOverlaps([
      shift({ id: 'a', timeSlot: '협의' }),
      shift({ id: 'b', timeSlot: null }),
    ]);

    expect(overlaps.size).toBe(0);
  });
});

describe('formatOverlapWarning', () => {
  it('겹침이 없으면 null', () => {
    expect(formatOverlapWarning([])).toBeNull();
  });

  it('1건이면 상대 공고명을 밝힌다', () => {
    expect(formatOverlapWarning([shift({ id: 'b', jobPostingName: '역삼 홀덤펍' })])).toBe(
      '역삼 홀덤펍와 시간이 겹쳐요'
    );
  });

  it('여러 건이면 대표 1건 + 나머지 수로 줄인다', () => {
    expect(
      formatOverlapWarning([
        shift({ id: 'b', jobPostingName: '역삼 홀덤펍' }),
        shift({ id: 'c', jobPostingName: '선릉 홀덤펍' }),
      ])
    ).toBe('역삼 홀덤펍 외 1건과 시간이 겹쳐요');
  });

  it('공고명이 없으면 건수만 말한다', () => {
    expect(formatOverlapWarning([shift({ id: 'b', jobPostingName: '' })])).toBe(
      '다른 확정 근무 1건과 시간이 겹쳐요'
    );
  });
});
