/**
 * scheduleNotices — 암묵 동작 고지 진단 (T4/E4 · 설계 §3.9 F6, Eng F-3·F-4)
 *
 * 정규화는 사장이 지시하지 않은 일을 한다(병합·강등·dedupe). 그걸 침묵으로 넘기면
 * "내가 만든 카드가 사라졌다"가 되므로 한 뮤테이션당 **가장 손실이 큰 사건 하나**를 알린다.
 * 우선순위: 카드 소멸 > 묶음 해제 > 병합 > 승계.
 */
import { diagnoseScheduleChange } from '../scheduleNotices';
import type { ScheduleGroup, ScheduleGroupSlots } from '../normalizeScheduleGroups';

const A: ScheduleGroupSlots = [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }];
const B: ScheduleGroupSlots = [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }];

const g = (dates: string[], timeSlots: ScheduleGroupSlots, grouped = false): ScheduleGroup => ({
  dates,
  timeSlots,
  grouped,
});

describe('우선순위 — 한 뮤테이션당 최대 1건', () => {
  it('카드 소멸이 다른 무엇보다 먼저다 (정보 손실이 가장 크다)', () => {
    const before = [g(['2026-08-10'], A), g(['2026-08-20'], B, false)];
    const after = [g(['2026-08-10'], A)];
    const notice = diagnoseScheduleChange(before, after, {
      removedCards: [g(['2026-08-20'], B)],
      inheritedDates: ['2026-08-11'],
    });
    expect(notice?.kind).toBe('cardRemoved');
  });

  it('묶음 해제가 병합·승계보다 먼저다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-20'], B)];
    const after = [g(['2026-08-10', '2026-08-11', '2026-08-20'], A, false)];
    const notice = diagnoseScheduleChange(before, after, { inheritedDates: ['2026-08-20'] });
    expect(notice?.kind).toBe('bundleReleased');
  });

  it('병합이 승계보다 먼저다', () => {
    const before = [g(['2026-08-10'], A), g(['2026-08-20'], A)];
    const after = [g(['2026-08-10', '2026-08-20'], A)];
    const notice = diagnoseScheduleChange(before, after, { inheritedDates: ['2026-08-20'] });
    expect(notice?.kind).toBe('merged');
  });

  it('아무 일도 없었으면 침묵한다 (토스트 소음 억제)', () => {
    const before = [g(['2026-08-10'], A)];
    const after = [g(['2026-08-10', '2026-08-11'], A)];
    expect(diagnoseScheduleChange(before, after, {})).toBeNull();
  });
});

describe('카드 소멸 (F6)', () => {
  it('사라진 카드의 날짜를 문구에 담는다', () => {
    const notice = diagnoseScheduleChange([], [], {
      removedCards: [g(['2026-08-20', '2026-08-21'], B)],
    });
    expect(notice?.kind).toBe('cardRemoved');
    expect(notice?.message).toContain('8/20~21');
    expect(notice?.message).toContain('조건이 함께 삭제');
  });

  it('여러 카드가 사라져도 한 문구로 합친다', () => {
    const notice = diagnoseScheduleChange([], [], {
      removedCards: [g(['2026-08-20'], B), g(['2026-08-25'], A)],
    });
    expect(notice?.message).toContain('8/20');
    expect(notice?.message).toContain('8/25');
  });
});

describe('묶음 해제 (§3.5 자동 해제 고지)', () => {
  it('묶음 run 이 사라지면 알린다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A, true)];
    const after = [g(['2026-08-10'], A, false)];
    const notice = diagnoseScheduleChange(before, after, {});
    expect(notice?.kind).toBe('bundleReleased');
    expect(notice?.message).toContain('묶음지원');
  });

  it('묶음이 그대로면 알리지 않는다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A, true)];
    const after = [g(['2026-08-10', '2026-08-11'], A, true)];
    expect(diagnoseScheduleChange(before, after, {})).toBeNull();
  });

  it('사용자가 직접 끈 경우는 알리지 않는다 (자기가 한 일을 되읽어주지 않는다)', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A, true)];
    const after = [g(['2026-08-10', '2026-08-11'], A, false)];
    expect(diagnoseScheduleChange(before, after, { bundleToggledByUser: true })).toBeNull();
  });

  // 🔑 리뷰 MEDIUM 6 회귀 가드 — `bundleToggledByUser` 가 ②(묶음해제)만 건너뛰고
  //    ③(자동병합)은 그대로 타던 구멍. 토글을 **켜면** 카드가 실제로 합쳐져
  //    `after.length < before.length` 가 참이 되고, 사용자가 방금 누른 스위치의 결과가
  //    "같은 조건이라 하나로 합쳐졌어요" 로 되읽힌다. 계기판 order_sheet.auto_merge 도 오염된다.
  it('묶음 토글을 켜서 카드가 합쳐진 경우는 자동병합으로 알리지 않는다', () => {
    const before = [g(['2026-08-10'], A, false), g(['2026-08-11'], A, false)];
    const after = [g(['2026-08-10', '2026-08-11'], A, true)];
    expect(diagnoseScheduleChange(before, after, { bundleToggledByUser: true })).toBeNull();
  });

  // 그 반대편 — 토글과 무관한 조용한 날짜 삭제(dedupe)는 **여전히** 알린다.
  // 이 단언이 없으면 "토글 시 전부 침묵"으로 넓혀도 위 테스트가 통과한다(Eng F-4 무고지 삭제 금지).
  it('토글을 조작해도 날짜가 조용히 사라지면 병합으로 알린다', () => {
    const before = [g(['2026-08-10'], A, false), g(['2026-08-11'], A, false)];
    const after = [g(['2026-08-10'], A, true)];
    expect(
      diagnoseScheduleChange(before, after, {
        bundleToggledByUser: true,
        datesTouched: true,
        expectedDateCount: 2,
      })?.kind
    ).toBe('merged');
  });

  // 리뷰 MEDIUM 회귀 가드 — 개수 비교로 되돌리면 여기서 잡힌다.
  // 5일 묶음에서 하루를 해제하면 묶음 날짜 수는 5→4 로 줄지만 **묶음은 살아 있다**.
  it('묶음 카드에서 날짜만 줄어도 묶음이 살아 있으면 해제라고 하지 않는다', () => {
    const before = [g(['2026-08-10', '2026-08-11', '2026-08-12'], A, true)];
    const after = [g(['2026-08-10', '2026-08-11'], A, true)];
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 2 })
    ).toBeNull();
  });

  it('묶음 가운데가 빠져 둘로 갈라져도 둘 다 묶음이면 해제가 아니다', () => {
    const before = [g(['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13'], A, true)];
    const after = [g(['2026-08-10', '2026-08-11'], A, true), g(['2026-08-13'], A, true)];
    // 카드 수가 늘었으므로 병합도 아니다 — 아무 고지도 나오면 안 된다.
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 3 })
    ).toBeNull();
  });

  it('묶여 있던 날짜가 남아 있는데 묶음이 풀렸으면 그때는 알린다', () => {
    const before = [g(['2026-08-10', '2026-08-11', '2026-08-12'], A, true)];
    const after = [g(['2026-08-10', '2026-08-11', '2026-08-12'], A, false)];
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 3 })?.kind
    ).toBe('bundleReleased');
  });

  it('묶음이 새로 생기는 것은 알리지 않는다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A, false)];
    const after = [g(['2026-08-10', '2026-08-11'], A, true)];
    expect(diagnoseScheduleChange(before, after, {})).toBeNull();
  });
});

describe('자동 병합 (P1 암묵 동작)', () => {
  it('카드 수가 줄면 합쳐졌다고 알린다', () => {
    const before = [g(['2026-08-10'], A), g(['2026-08-20'], A)];
    const after = [g(['2026-08-10', '2026-08-20'], A)];
    const notice = diagnoseScheduleChange(before, after, {});
    expect(notice?.kind).toBe('merged');
    expect(notice?.message).toContain('합쳐');
  });

  it('중복 날짜 제거(dedupe)도 병합으로 고지한다 — 무고지 삭제 금지 (Eng F-4)', () => {
    const before = [g(['2026-08-10'], A), g(['2026-08-10'], B)];
    const after = [g(['2026-08-10'], B)];
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 2 })?.kind
    ).toBe('merged');
  });

  it('날짜를 해제하기만 한 것은 병합이 아니다 — 자기가 한 일을 되읽어주지 않는다', () => {
    // 날짜 수 감소는 dedupe 의 신호이기도 하고 **사용자가 해제한** 신호이기도 하다.
    // 사용자가 고른 수(expectedDateCount)를 기준으로 둘을 가른다.
    const before = [g(['2026-08-10', '2026-08-11'], A)];
    const after = [g(['2026-08-10'], A)];
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 1 })
    ).toBeNull();
  });

  it('여러 카드에서 일부만 해제해도 병합으로 오인하지 않는다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A), g(['2026-08-20'], B)];
    const after = [g(['2026-08-10'], A), g(['2026-08-20'], B)];
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 2 })
    ).toBeNull();
  });

  it('사용자가 고른 수보다 적게 남으면 정규화가 지운 것이므로 고지한다', () => {
    const before = [g(['2026-08-10'], A)];
    const after = [g(['2026-08-10'], A)];
    // 사장은 2개를 골랐는데 정규화 뒤 1개만 남았다 = 조용한 삭제
    expect(
      diagnoseScheduleChange(before, after, { datesTouched: true, expectedDateCount: 2 })?.kind
    ).toBe('merged');
  });

  it('카드가 늘어나는 것(예외 추출)은 병합이 아니다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A)];
    const after = [g(['2026-08-10'], A), g(['2026-08-11'], B)];
    expect(diagnoseScheduleChange(before, after, {})).toBeNull();
  });
});

describe('새 날짜 승계 고지 (F10)', () => {
  it('추가한 날짜가 어느 조건을 받았는지 말한다', () => {
    const before = [g(['2026-08-10', '2026-08-11'], A), g(['2026-08-20'], B)];
    const after = [g(['2026-08-10', '2026-08-11', '2026-08-14'], A), g(['2026-08-20'], B)];
    const notice = diagnoseScheduleChange(before, after, { inheritedDates: ['2026-08-14'] });
    expect(notice?.kind).toBe('inherited');
    expect(notice?.message).toContain('8/14');
    expect(notice?.message).toContain('8/10~11');
    expect(notice?.message).toContain('조건으로 추가');
  });

  // 리뷰 MEDIUM 회귀 가드 — 날것 나열로 되돌리면 30일 대회에서 213자 토스트가 뜬다(실측).
  it('추가 날짜가 많아도 요약해서 말한다 — 토스트가 화면을 덮지 않는다', () => {
    const many = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const before = [g(['2026-08-10'], A), g([], B)];
    const after = [g(['2026-08-10', ...many], A), g([], B)];
    const notice = diagnoseScheduleChange(before, after, { inheritedDates: many });
    expect(notice?.kind).toBe('inherited');
    expect(notice?.message).toContain('9/1~30');
    expect(notice!.message.length).toBeLessThan(40);
  });

  it('카드가 하나뿐이면 승계를 알리지 않는다 (고를 여지가 없다)', () => {
    const before = [g(['2026-08-10'], A)];
    const after = [g(['2026-08-10', '2026-08-14'], A)];
    expect(diagnoseScheduleChange(before, after, { inheritedDates: ['2026-08-14'] })).toBeNull();
  });

  it('승계 고지는 어느 카드가 받았는지도 담는다 — "다른 조건으로" 를 누를 근거', () => {
    const before = [g(['2026-08-10'], A), g(['2026-08-20'], B)];
    const after = [g(['2026-08-10'], A), g(['2026-08-20', '2026-08-21'], B)];
    const notice = diagnoseScheduleChange(before, after, { inheritedDates: ['2026-08-21'] });
    expect(notice?.kind).toBe('inherited');
    expect(notice?.inheritedCardIndex).toBe(1);
  });
});
