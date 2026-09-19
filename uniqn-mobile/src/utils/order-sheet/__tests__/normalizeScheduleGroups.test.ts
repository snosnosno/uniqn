/**
 * normalizeScheduleGroups 유닛 — 조건 유도 그룹핑 정규화 (T1/E1/E3)
 *
 * 설계 정본: docs/planning/2026-08-06-condition-derived-grouping-design.md §3.1 규칙 0~4 · §9.1
 * 이 함수가 폼 뮤테이션과 draft 복원의 **단일 정규화 소스**다 — 재진입 병합 서프라이즈가
 * "UI 규칙 = 저장 규칙"으로 정의상 소멸한다.
 */
import {
  normalizeScheduleGroups,
  setRunGrouped,
  slotsSignature,
  type ScheduleGroup,
  type ScheduleGroupSlots,
} from '../normalizeScheduleGroups';

const slot = (
  startTime: string,
  roles: ScheduleGroupSlots[number]['roles'] = [{ role: 'dealer', count: 1 }]
): ScheduleGroupSlots[number] => ({ startTime, roles });

const g = (dates: string[], timeSlots: ScheduleGroupSlots, grouped = false): ScheduleGroup => ({
  dates,
  timeSlots,
  grouped,
});

/** 19:00 딜러1 — 시그니처 A */
const A: ScheduleGroupSlots = [slot('19:00')];
/** 21:00 딜러1 — 시그니처 B */
const B: ScheduleGroupSlots = [slot('21:00')];

describe('규칙 0 — dates 가 빈 그룹은 평탄화에서 제외하고 원형 보존 (Eng F-2)', () => {
  it('빈 dates 그룹은 조건을 잃지 않고 결과 뒤에 남는다 — 템플릿 프리셋 2번째 조건 침묵 유실 차단', () => {
    const input = [g([], A), g([], B)];
    expect(normalizeScheduleGroups(input)).toEqual([g([], A), g([], B)]);
  });

  it('날짜 있는 그룹과 섞여도 빈 그룹은 뒤로 보존된다', () => {
    const result = normalizeScheduleGroups([g([], B), g(['2026-08-10'], A)]);
    expect(result).toEqual([g(['2026-08-10'], A), g([], B)]);
  });

  it('빈 입력은 빈 출력 — 시드 책임은 호출자(fixed 는 scheduleGroups=[] 계약)', () => {
    expect(normalizeScheduleGroups([])).toEqual([]);
  });
});

describe('slotsSignature — 정준(키 순서 무관) 직렬화 (CEO-S2·S6 적대 케이스)', () => {
  it('키 순서만 다른 동등 슬롯은 같은 시그니처다', () => {
    const canonical = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];
    const shuffled = [{ roles: [{ count: 2, role: 'dealer' as const }], startTime: '19:00' }];
    expect(slotsSignature(shuffled)).toBe(slotsSignature(canonical));
  });

  it('키 순서만 다른 동등 슬롯은 유령 카드로 갈라지지 않는다', () => {
    const canonical = [{ startTime: '19:00', roles: [{ role: 'dealer' as const, count: 2 }] }];
    const shuffled = [{ roles: [{ count: 2, role: 'dealer' as const }], startTime: '19:00' }];
    const result = normalizeScheduleGroups([
      g(['2026-08-10'], canonical),
      g(['2026-08-11'], shuffled),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.dates).toEqual(['2026-08-10', '2026-08-11']);
  });

  it('시간 미정 슬롯과 시각 슬롯은 다른 시그니처다 (미정↔시각 오병합 차단)', () => {
    const tba: ScheduleGroupSlots = [
      { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
    ];
    expect(slotsSignature(tba)).not.toBe(slotsSignature(A));
  });

  it('미정 슬롯의 잔존 startTime 은 시그니처에서 무시된다 (저장 형식 정합 — toPostingTimeSlots 가 드롭)', () => {
    const tbaClean: ScheduleGroupSlots = [
      { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
    ];
    const tbaStale: ScheduleGroupSlots = [
      { startTime: '19:00', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
    ];
    expect(slotsSignature(tbaStale)).toBe(slotsSignature(tbaClean));
  });

  it("role!=='other' 의 잔존 customRole 은 시그니처에서 무시된다 (저장이 드롭하는 필드)", () => {
    const clean: ScheduleGroupSlots = [slot('19:00', [{ role: 'dealer', count: 1 }])];
    const stale: ScheduleGroupSlots = [
      slot('19:00', [{ role: 'dealer', customRole: '유령', count: 1 }]),
    ];
    expect(slotsSignature(stale)).toBe(slotsSignature(clean));
  });

  it("role==='other' 의 customRole 은 시그니처를 가른다", () => {
    const bar: ScheduleGroupSlots = [
      slot('19:00', [{ role: 'other', customRole: '바텐더', count: 1 }]),
    ];
    const kitchen: ScheduleGroupSlots = [
      slot('19:00', [{ role: 'other', customRole: '주방', count: 1 }]),
    ];
    expect(slotsSignature(bar)).not.toBe(slotsSignature(kitchen));
  });

  it('역할 순서가 다르면 다른 시그니처다 (저장이 순서를 보존하므로 왕복 안정성 우선)', () => {
    const dealerFirst: ScheduleGroupSlots = [
      slot('19:00', [
        { role: 'dealer', count: 1 },
        { role: 'floor', count: 1 },
      ]),
    ];
    const floorFirst: ScheduleGroupSlots = [
      slot('19:00', [
        { role: 'floor', count: 1 },
        { role: 'dealer', count: 1 },
      ]),
    ];
    expect(slotsSignature(floorFirst)).not.toBe(slotsSignature(dealerFirst));
  });
});

describe('규칙 2 — grouped run 분리와 강등', () => {
  it('연속 + 동일 시그니처 grouped 날짜는 하나의 묶음 그룹이 된다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10'], A, true),
      g(['2026-08-11'], A, true),
    ]);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11'], A, true)]);
  });

  it('시그니처가 바뀌면 run 이 끊긴다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10', '2026-08-11'], A, true),
      g(['2026-08-12', '2026-08-13'], B, true),
    ]);
    expect(result).toEqual([
      g(['2026-08-10', '2026-08-11'], A, true),
      g(['2026-08-12', '2026-08-13'], B, true),
    ]);
  });

  it('날짜가 비연속이면 run 이 끊긴다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10', '2026-08-11'], A, true),
      g(['2026-08-14', '2026-08-15'], A, true),
    ]);
    expect(result).toEqual([
      g(['2026-08-10', '2026-08-11'], A, true),
      g(['2026-08-14', '2026-08-15'], A, true),
    ]);
  });

  it('run 길이 1 은 grouped=false 로 강등된다 — 신설 정규형(F-1). 해제 불가한 좀비 카드 차단', () => {
    const result = normalizeScheduleGroups([g(['2026-08-10'], A, true)]);
    expect(result).toEqual([g(['2026-08-10'], A, false)]);
  });

  it('강등된 싱글턴은 동일 시그니처 shared 그룹에 흡수된다 (멱등 정합)', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10'], A, true), // 비연속 싱글턴 → 강등
      g(['2026-08-14'], A, false),
    ]);
    expect(result).toEqual([g(['2026-08-10', '2026-08-14'], A, false)]);
  });

  it('묶음 run 과 같은 조건의 낱개 날짜는 별도 카드로 남는다 (토글 ON 결과 = 카드 분리)', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10', '2026-08-11'], A, true),
      g(['2026-08-13'], A, false),
    ]);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-13'], A, false)]);
  });
});

describe('규칙 3 — 시그니처 병합', () => {
  it('비연속이어도 동일 조건이면 한 그룹으로 병합된다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10'], A),
      g(['2026-08-12'], A),
      g(['2026-08-15'], A),
    ]);
    expect(result).toEqual([g(['2026-08-10', '2026-08-12', '2026-08-15'], A, false)]);
  });

  it('조건이 다르면 분리를 유지한다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10', '2026-08-12'], A),
      g(['2026-08-11'], B),
    ]);
    expect(result).toEqual([
      g(['2026-08-10', '2026-08-12'], A, false),
      g(['2026-08-11'], B, false),
    ]);
  });
});

describe('규칙 4 — 결정적 정렬', () => {
  it('그룹은 최소 날짜 오름차순, 각 그룹 dates 도 오름차순이다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-20', '2026-08-15'], B),
      g(['2026-08-10'], A),
    ]);
    expect(result.map((x) => x.dates)).toEqual([['2026-08-10'], ['2026-08-15', '2026-08-20']]);
  });

  it('입력 순서가 달라도 같은 결과를 낸다', () => {
    const forward = normalizeScheduleGroups([
      g(['2026-08-10'], A),
      g(['2026-08-11'], B),
      g(['2026-08-12'], A),
    ]);
    const reversed = normalizeScheduleGroups([
      g(['2026-08-12'], A),
      g(['2026-08-11'], B),
      g(['2026-08-10'], A),
    ]);
    expect(reversed).toEqual(forward);
  });
});

describe('중복 날짜 dedupe (Eng F-4 — Undo 재삽입 경로)', () => {
  it('그룹 간 중복 날짜는 뒤에 온 그룹이 이긴다 (승자 결정성)', () => {
    const result = normalizeScheduleGroups([g(['2026-08-10'], A), g(['2026-08-10'], B)]);
    expect(result).toEqual([g(['2026-08-10'], B, false)]);
  });

  it('중복 날짜를 제거해도 나머지 날짜는 살아남는다', () => {
    const result = normalizeScheduleGroups([
      g(['2026-08-10', '2026-08-11'], A),
      g(['2026-08-11'], B),
    ]);
    expect(result).toEqual([g(['2026-08-10'], A, false), g(['2026-08-11'], B, false)]);
  });
});

describe('멱등성 property — normalize∘normalize = normalize (CEO-S6)', () => {
  it('시그니처 2종 × grouped 2종의 전 조합(256)에서 멱등이다', () => {
    const dates = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-14'];
    const sigs = [A, B];
    let checked = 0;
    for (let mask = 0; mask < 1 << (dates.length * 2); mask += 1) {
      const input = dates.map((date, i) =>
        g(
          [date],
          sigs[(mask >> (i * 2)) & 1] as ScheduleGroupSlots,
          ((mask >> (i * 2 + 1)) & 1) === 1
        )
      );
      const once = normalizeScheduleGroups(input);
      expect(normalizeScheduleGroups(once)).toEqual(once);
      checked += 1;
    }
    expect(checked).toBe(256);
  });

  it('빈 그룹이 섞여도 멱등이다', () => {
    const once = normalizeScheduleGroups([g([], B), g(['2026-08-10'], A, true), g([], A)]);
    expect(normalizeScheduleGroups(once)).toEqual(once);
  });
});

describe('입력 불변성 (전역 코딩 규칙 — 뮤테이션 금지)', () => {
  it('입력 그룹·날짜 배열·슬롯을 변형하지 않는다', () => {
    const input = [g(['2026-08-11', '2026-08-10'], A, true), g(['2026-08-12'], A, true)];
    const snapshot = structuredClone(input);
    normalizeScheduleGroups(input);
    expect(input).toEqual(snapshot);
  });

  it('결과 슬롯은 입력 슬롯과 참조를 공유하지 않는다 (그룹 간 오염 차단)', () => {
    const input = [g(['2026-08-10'], A)];
    const result = normalizeScheduleGroups(input);
    expect(result[0]?.timeSlots[0]).not.toBe(input[0]?.timeSlots[0]);
    expect(result[0]?.timeSlots[0]?.roles[0]).not.toBe(input[0]?.timeSlots[0]?.roles[0]);
  });
});

describe('setRunGrouped — run 부분 토글 선분할 헬퍼 (Eng F-6)', () => {
  it('ON: 카드 안의 연속 run 만 묶음 그룹으로 분리하고 나머지는 남긴다', () => {
    const groups = [g(['2026-08-10', '2026-08-11', '2026-08-13'], A)];
    const result = setRunGrouped(groups, 0, ['2026-08-10', '2026-08-11'], true);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-13'], A, false)]);
  });

  it('OFF: 묶음이 풀리며 동일 조건 카드로 재병합된다', () => {
    const groups = [g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-13'], A, false)];
    const result = setRunGrouped(groups, 0, ['2026-08-10', '2026-08-11'], false);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11', '2026-08-13'], A, false)]);
  });

  it('run 이 카드 전체면 카드가 통째로 전환된다', () => {
    const groups = [g(['2026-08-10', '2026-08-11'], A)];
    const result = setRunGrouped(groups, 0, ['2026-08-10', '2026-08-11'], true);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11'], A, true)]);
  });

  it('다른 카드는 건드리지 않는다', () => {
    const groups = [g(['2026-08-10', '2026-08-11'], A), g(['2026-08-20'], B)];
    const result = setRunGrouped(groups, 0, ['2026-08-10', '2026-08-11'], true);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-20'], B, false)]);
  });

  it('없는 카드 인덱스는 no-op(정규화만) — 방어', () => {
    const groups = [g(['2026-08-10'], A)];
    expect(setRunGrouped(groups, 7, ['2026-08-10'], true)).toEqual(normalizeScheduleGroups(groups));
  });

  it('토글 연타는 멱등이다 (같은 상태 재적용)', () => {
    const groups = [g(['2026-08-10', '2026-08-11'], A)];
    const once = setRunGrouped(groups, 0, ['2026-08-10', '2026-08-11'], true);
    const twice = setRunGrouped(once, 0, ['2026-08-10', '2026-08-11'], true);
    expect(twice).toEqual(once);
  });
});
