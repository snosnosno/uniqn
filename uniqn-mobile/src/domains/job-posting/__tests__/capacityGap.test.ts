import type { JobPosting } from '@/types';
import type { PostingDateRequirement } from '@/types/jobPosting';
import {
  CAPACITY_GAP_WARNING_OFFSETS,
  aggregateDateFilledFromSubmap,
  aggregatePostingDateRequired,
  formatCapacityGapLabel,
  selectPostingCapacityGaps,
  toCapacityGapByDate,
} from '../capacityGap';

/**
 * S3-1 근무일 D-day 정원 미달 판정.
 *
 * 이 판정은 서버 크론(`fn_notify_posting_capacity_gap`, 마이그 20260813110000)과 **같은 축**이어야
 * 한다. 축이 갈라지면 알림과 화면이 다른 숫자를 말하는데, 그건 어느 쪽도 에러를 내지 않으므로
 * 사용자가 신고하기 전까지 아무도 모른다. pgTAP(posting_capacity_gap_notification.test.sql)이
 * 서버 쪽을 고정하고, 이 파일이 클라 쪽을 같은 케이스로 고정한다.
 */

const TODAY = '2026-08-13';
const D1 = '2026-08-14';
const D2 = '2026-08-15';
const D3 = '2026-08-16';

function makeRequirement(date: string | null, counts: number[]): PostingDateRequirement {
  return {
    date,
    timeSlots: [
      {
        startTime: '19:00',
        roles: counts.map((count, index) => ({ role: 'dealer' as const, count, id: `r${index}` })),
      },
    ],
  };
}

function makeDatedPosting(requirements: PostingDateRequirement[]): JobPosting {
  return {
    schedule: {
      kind: 'dated',
      primaryDate: requirements[0]?.date ?? TODAY,
      allDates: requirements.map((r) => r.date ?? '').filter(Boolean),
      requirements,
    },
  } as unknown as JobPosting;
}

describe('aggregatePostingDateRequired', () => {
  it('날짜별로 좌석 수를 합산한다 (슬롯·역할 차원을 접는다)', () => {
    const posting = makeDatedPosting([makeRequirement(D1, [2, 1]), makeRequirement(D2, [3])]);

    const result = aggregatePostingDateRequired(posting);

    expect(result.get(D1)).toBe(3);
    expect(result.get(D2)).toBe(3);
  });

  it('같은 날짜가 여러 requirement 로 쪼개져 있어도 하나로 합친다', () => {
    const posting = makeDatedPosting([makeRequirement(D1, [2]), makeRequirement(D1, [5])]);

    // 뒤 requirement 가 앞을 덮어쓰면 2 또는 5 가 나온다 — 합산이어야 7 이다.
    expect(aggregatePostingDateRequired(posting).get(D1)).toBe(7);
  });

  it('고정 공고(kind=fixed)는 근무일이 특정되지 않아 판정 대상이 아니다', () => {
    const posting = {
      schedule: { kind: 'fixed', requirements: [makeRequirement('FIXED_SCHEDULE', [9])] },
    } as unknown as JobPosting;

    expect(aggregatePostingDateRequired(posting).size).toBe(0);
  });

  it('날짜 형식이 아닌 센티널은 건너뛴다 (서버의 정규식 가드와 같은 역할)', () => {
    const posting = makeDatedPosting([
      makeRequirement('FIXED_SCHEDULE', [9]),
      makeRequirement(null, [4]),
      makeRequirement(D1, [1]),
    ]);

    const result = aggregatePostingDateRequired(posting);

    expect(result.size).toBe(1);
    expect(result.get(D1)).toBe(1);
  });

  it('존재하지 않는 날짜(2026-02-31)는 이월시키지 않고 버린다', () => {
    const posting = makeDatedPosting([makeRequirement('2026-02-31', [3])]);

    expect(aggregatePostingDateRequired(posting).size).toBe(0);
  });
});

describe('aggregateDateFilledFromSubmap', () => {
  it('`date__slot__role` 키에서 날짜만 남기고 합산한다', () => {
    const submap = new Map<string, number>([
      [`${D1}__19:00__dealer`, 1],
      [`${D1}__19:00__floor`, 2],
      [`${D2}__19:00__dealer`, 1],
    ]);

    const result = aggregateDateFilledFromSubmap(submap);

    expect(result.get(D1)).toBe(3);
    expect(result.get(D2)).toBe(1);
  });

  it("역할키가 '__' 를 품어도 날짜를 잘못 읽지 않는다 (other:custom 형식)", () => {
    const submap = new Map<string, number>([[`${D1}__19:00__other:a__b`, 2]]);

    expect(aggregateDateFilledFromSubmap(submap).get(D1)).toBe(2);
  });

  it('세그먼트가 모자란 키는 무시한다', () => {
    const submap = new Map<string, number>([
      [`${D1}__19:00`, 9],
      [`${D1}__19:00__dealer`, 1],
    ]);

    expect(aggregateDateFilledFromSubmap(submap).get(D1)).toBe(1);
  });

  it('submap 이 없으면 빈 맵', () => {
    expect(aggregateDateFilledFromSubmap(undefined).size).toBe(0);
  });
});

describe('selectPostingCapacityGaps', () => {
  it('D-1 이 미달이면 그 날짜만 경고한다 (날짜별 판정 — 공고 합계가 아니다)', () => {
    // D-1 은 2명 필요 · 1명 확정 → 1자리 부족. D-2 는 1명 필요 · 1명 확정 → 충족.
    // 공고 합계로 보면 3명 필요 · 2명 확정이라 "1자리 부족"이 어느 날인지 사라진다.
    const posting = makeDatedPosting([makeRequirement(D1, [2]), makeRequirement(D2, [1])]);
    const submap = new Map<string, number>([
      [`${D1}__19:00__dealer`, 1],
      [`${D2}__19:00__dealer`, 1],
    ]);

    const gaps = selectPostingCapacityGaps(posting, submap, TODAY);

    expect(gaps).toEqual([{ date: D1, required: 2, filled: 1, missing: 1, dOffset: 1 }]);
  });

  it('오늘(D-0)과 D-3 이후는 경고 대상이 아니다', () => {
    // 오늘은 이미 손쓸 수 없고, D-3 은 아직 급하지 않다 — 매일 경고하면 알림이 배경음이 된다.
    const posting = makeDatedPosting([
      makeRequirement(TODAY, [5]),
      makeRequirement(D3, [5]),
      makeRequirement(D2, [5]),
    ]);

    const gaps = selectPostingCapacityGaps(posting, undefined, TODAY);

    expect(gaps.map((g) => g.date)).toEqual([D2]);
  });

  it('D-1 과 D-2 가 모두 미달이면 급한 것(D-1)이 먼저 온다', () => {
    const posting = makeDatedPosting([makeRequirement(D2, [2]), makeRequirement(D1, [2])]);

    const gaps = selectPostingCapacityGaps(posting, undefined, TODAY);

    expect(gaps.map((g) => g.dOffset)).toEqual([1, 2]);
  });

  it('정확히 채웠거나 초과 확정이면 경고하지 않는다', () => {
    const posting = makeDatedPosting([makeRequirement(D1, [2])]);
    const exact = new Map<string, number>([[`${D1}__19:00__dealer`, 2]]);
    const over = new Map<string, number>([[`${D1}__19:00__dealer`, 3]]);

    expect(selectPostingCapacityGaps(posting, exact, TODAY)).toEqual([]);
    expect(selectPostingCapacityGaps(posting, over, TODAY)).toEqual([]);
  });

  it('확정이 하나도 없으면 필요 인원 전체가 부족분이다', () => {
    const posting = makeDatedPosting([makeRequirement(D1, [3])]);

    expect(selectPostingCapacityGaps(posting, undefined, TODAY)).toEqual([
      { date: D1, required: 3, filled: 0, missing: 3, dOffset: 1 },
    ]);
  });

  it('월말을 넘어가도 D-1 을 옳게 센다', () => {
    const posting = makeDatedPosting([makeRequirement('2026-09-01', [1])]);

    const gaps = selectPostingCapacityGaps(posting, undefined, '2026-08-31');

    expect(gaps).toEqual([
      { date: '2026-09-01', required: 1, filled: 0, missing: 1, dOffset: 1 },
    ]);
  });

  it('오늘 날짜가 형식에 안 맞으면 아무것도 경고하지 않는다 (거짓 경고 방지)', () => {
    const posting = makeDatedPosting([makeRequirement(D1, [3])]);

    expect(selectPostingCapacityGaps(posting, undefined, 'not-a-date')).toEqual([]);
  });

  it('경고 오프셋은 서버 크론과 같은 범위다', () => {
    // 서버 함수는 `(v_today + 1, v_today + 2)` 를 본다. 한쪽만 바꾸면 조용히 갈라진다.
    expect([...CAPACITY_GAP_WARNING_OFFSETS].sort()).toEqual([1, 2]);
  });
});

describe('toCapacityGapByDate / formatCapacityGapLabel', () => {
  it('날짜로 바로 찾을 수 있게 맵으로 만든다', () => {
    const gaps = [
      { date: D1, required: 2, filled: 1, missing: 1, dOffset: 1 },
      { date: D2, required: 3, filled: 0, missing: 3, dOffset: 2 },
    ];

    const byDate = toCapacityGapByDate(gaps);

    expect(byDate.get(D1)?.missing).toBe(1);
    expect(byDate.get(D2)?.missing).toBe(3);
    expect(byDate.get(D3)).toBeUndefined();
  });

  it('문구는 서버 알림 제목과 같은 어휘를 쓴다', () => {
    expect(formatCapacityGapLabel({ date: D1, required: 2, filled: 1, missing: 1, dOffset: 1 })).toBe(
      'D-1 · 1자리 비었어요'
    );
  });
});
