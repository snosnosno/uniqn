/**
 * scheduleCardEdits — 조건 카드 편집 연산 (D1/T3 · 설계 §3.3·§3.4·§3.9 F6·F10)
 *
 * 화면은 얇게 두고 "날짜 확정이 카드들을 어떻게 바꾸는가"를 여기서 정한다.
 * 전부 정규화를 통과한 결과를 낸다 — 호출부가 normalize 를 잊는 실수를 구조적으로 막는다.
 */
import { applyDateSelection, extractException } from '../scheduleCardEdits';
import type { ScheduleGroup, ScheduleGroupSlots } from '../normalizeScheduleGroups';

const A: ScheduleGroupSlots = [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }];
const B: ScheduleGroupSlots = [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }];

const g = (dates: string[], timeSlots: ScheduleGroupSlots, grouped = false): ScheduleGroup => ({
  dates,
  timeSlots,
  grouped,
});

describe('applyDateSelection — 카드 1개(최빈)', () => {
  it('날짜를 교체해도 조건은 그대로 남는다 — 소멸이 아니라 편집이다', () => {
    const result = applyDateSelection([g(['2026-08-10'], A)], ['2026-08-20', '2026-08-21']);
    expect(result.groups).toEqual([g(['2026-08-20', '2026-08-21'], A, false)]);
    expect(result.removedCards).toEqual([]);
  });

  it('빈 카드에 첫 날짜를 넣으면 그 카드가 채워진다', () => {
    const result = applyDateSelection([g([], [])], ['2026-08-10']);
    expect(result.groups[0]?.dates).toEqual(['2026-08-10']);
  });

  it('날짜를 모두 지워도 조건 카드는 남는다 (시드 계약)', () => {
    const result = applyDateSelection([g(['2026-08-10'], A)], []);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.dates).toEqual([]);
    expect(result.groups[0]?.timeSlots).toEqual(A);
  });

  it('결과 슬롯은 입력과 참조를 공유하지 않는다', () => {
    const input = [g(['2026-08-10'], A)];
    const result = applyDateSelection(input, ['2026-08-10', '2026-08-11']);
    expect(result.groups[0]?.timeSlots[0]).not.toBe(input[0]?.timeSlots[0]);
  });
});

describe('applyDateSelection — 카드 2개 이상: 해제', () => {
  const two = [g(['2026-08-10', '2026-08-11'], A), g(['2026-08-20'], B)];

  it('해제한 날짜만 해당 카드에서 빠진다', () => {
    const result = applyDateSelection(two, ['2026-08-10', '2026-08-20']);
    expect(result.groups).toEqual([g(['2026-08-10'], A, false), g(['2026-08-20'], B, false)]);
    expect(result.removedCards).toEqual([]);
  });

  it('카드의 마지막 날짜가 빠지면 그 카드가 사라지고 소멸 카드로 보고된다 (F6 — 조건 유실)', () => {
    const result = applyDateSelection(two, ['2026-08-10', '2026-08-11']);
    expect(result.groups).toEqual([g(['2026-08-10', '2026-08-11'], A, false)]);
    expect(result.removedCards).toHaveLength(1);
    expect(result.removedCards[0]?.dates).toEqual(['2026-08-20']);
  });

  it('여러 카드가 한 번에 사라져도 전부 보고한다 (1 뮤테이션 1 토스트의 재료)', () => {
    const three = [...two, g(['2026-08-25'], A)];
    const result = applyDateSelection(three, ['2026-08-10']);
    expect(result.removedCards).toHaveLength(2);
  });

  it('원래부터 날짜가 없던 조건 카드(템플릿)는 소멸로 보고하지 않는다', () => {
    const withTemplate = [g(['2026-08-10'], A), g([], B)];
    const result = applyDateSelection(withTemplate, ['2026-08-10']);
    expect(result.removedCards).toEqual([]);
    expect(result.groups.some((x) => x.dates.length === 0)).toBe(true);
  });
});

describe('applyDateSelection — 카드 2개 이상: 승계 (F10 인접 휴리스틱)', () => {
  const two = [g(['2026-08-10', '2026-08-11'], A), g(['2026-08-20'], B)];

  it('추가 날짜는 연속으로 인접한 카드가 받는다', () => {
    const result = applyDateSelection(two, [
      '2026-08-10',
      '2026-08-11',
      '2026-08-20',
      '2026-08-21',
    ]);
    const cardB = result.groups.find((x) => x.dates.includes('2026-08-21'));
    expect(cardB?.dates).toEqual(['2026-08-20', '2026-08-21']);
    expect(cardB?.timeSlots).toEqual(B);
  });

  it('인접한 카드가 없으면 첫 카드가 받는다', () => {
    const result = applyDateSelection(two, [
      '2026-08-10',
      '2026-08-11',
      '2026-08-20',
      '2026-08-30',
    ]);
    const owner = result.groups.find((x) => x.dates.includes('2026-08-30'));
    expect(owner?.timeSlots).toEqual(A);
  });

  it('승계 판정은 추가 전 상태로 고정한다 — 방금 넣은 날짜가 다음 판정을 흔들지 않는다', () => {
    const single = [g(['2026-08-10'], A), g(['2026-08-20'], B)];
    // 8/21 은 8/20(카드B)과 인접, 8/22 는 추가 전 상태 기준으로는 어느 카드와도 비인접 → 첫 카드
    const result = applyDateSelection(single, [
      '2026-08-10',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
    ]);
    expect(result.groups.find((x) => x.dates.includes('2026-08-21'))?.timeSlots).toEqual(B);
    expect(result.groups.find((x) => x.dates.includes('2026-08-22'))?.timeSlots).toEqual(A);
  });

  it('모든 카드가 비게 되고 새 날짜만 남으면 첫 카드 조건을 이어받는다', () => {
    const result = applyDateSelection(two, ['2026-09-01']);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.timeSlots).toEqual(A);
    expect(result.groups[0]?.dates).toEqual(['2026-09-01']);
    expect(result.removedCards).toHaveLength(1); // 조건이 실제로 유실된 카드 B
  });
});

describe('applyDateSelection — 정규화 통과', () => {
  it('같은 조건 카드로 수렴하면 병합된 결과를 낸다', () => {
    const two = [g(['2026-08-10'], A), g(['2026-08-20'], A)];
    const result = applyDateSelection(two, ['2026-08-10', '2026-08-20']);
    expect(result.groups).toHaveLength(1);
  });

  it('묶음 카드의 연속이 깨지면 grouped 가 강등된다', () => {
    const grouped = [g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-20'], B)];
    const result = applyDateSelection(grouped, ['2026-08-10', '2026-08-20']);
    expect(result.groups.find((x) => x.dates.includes('2026-08-10'))?.grouped).toBe(false);
  });
});

describe('extractException — 일부 날짜만 다른 조건으로', () => {
  const card = [g(['2026-08-10', '2026-08-11', '2026-08-13'], A)];

  it('고른 날짜만 새 조건으로 갈라지고 나머지는 원래 조건에 남는다', () => {
    const result = extractException(card, 0, ['2026-08-11'], B);
    expect(result).not.toBeNull();
    expect(result?.find((x) => x.dates.includes('2026-08-11'))?.timeSlots).toEqual(B);
    expect(result?.find((x) => x.dates.includes('2026-08-10'))?.timeSlots).toEqual(A);
    expect(result?.find((x) => x.dates.includes('2026-08-10'))?.dates).toEqual([
      '2026-08-10',
      '2026-08-13',
    ]);
  });

  it('여러 날짜를 한 번에 갈라도 카드는 하나만 생긴다 (다중 예외 1회 입력)', () => {
    const result = extractException(card, 0, ['2026-08-11', '2026-08-13'], B);
    expect(result?.filter((x) => x.timeSlots[0]?.startTime === '21:00')).toHaveLength(1);
  });

  it('전 날짜를 고르면 카드 전체 편집과 같아진다', () => {
    const result = extractException(card, 0, ['2026-08-10', '2026-08-11', '2026-08-13'], B);
    expect(result).toEqual([g(['2026-08-10', '2026-08-11', '2026-08-13'], B, false)]);
  });

  it('원래 조건으로 되돌리면 정규화가 즉시 재병합한다 (재진입 서프라이즈 소멸)', () => {
    const split = extractException(card, 0, ['2026-08-11'], B)!;
    const exceptionIndex = split.findIndex((x) => x.dates.includes('2026-08-11'));
    const merged = extractException(split, exceptionIndex, ['2026-08-11'], A)!;
    expect(merged).toHaveLength(1);
    expect(merged[0]?.dates).toEqual(['2026-08-10', '2026-08-11', '2026-08-13']);
  });

  it('카드가 이미 사라졌으면 null — 조용히 엉뚱한 카드에 쓰지 않는다', () => {
    expect(extractException(card, 5, ['2026-08-11'], B)).toBeNull();
  });

  it('고른 날짜가 카드에 더 이상 없으면 null (stale confirm)', () => {
    expect(extractException(card, 0, ['2026-09-09'], B)).toBeNull();
  });

  it('카드에 남아 있는 날짜만 골라 적용한다 — 사라진 날짜는 버린다', () => {
    const result = extractException(card, 0, ['2026-08-11', '2026-09-09'], B);
    expect(result?.find((x) => x.timeSlots[0]?.startTime === '21:00')?.dates).toEqual([
      '2026-08-11',
    ]);
  });
});
