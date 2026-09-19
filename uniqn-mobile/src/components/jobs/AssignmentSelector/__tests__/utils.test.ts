import { getEffectiveRoleId, getRoleCheckboxKey, getSlotSelectionTime } from '../utils';

/**
 * 🔴 이 함수는 세 화면(AssignmentSelector·DateSelection·DateGroupSelection)에 **같은 식이
 *    복제**돼 있던 것을 하나로 모은 정본이다. 반환값은 `Assignment.timeSlot` 이 되어 서버로
 *    나가고, 동시에 선택 키 비교에도 쓰인다 — 두 용도가 갈리면 "선택은 됐는데 항상 마감"이 난다.
 */
describe('getSlotSelectionTime', () => {
  it('TBA 슬롯은 미정', () => {
    expect(getSlotSelectionTime({ isTimeToBeAnnounced: true, startTime: '19:00' })).toBe('미정');
  });

  it('시각이 있으면 그 값', () => {
    expect(getSlotSelectionTime({ isTimeToBeAnnounced: false, startTime: '19:00' })).toBe('19:00');
  });

  // 🔴 폴백을 `?? ''` 로 되돌리면 빈 문자열이 다시 서버로 나가 "미정을 뜻하는 값"이 또 늘어난다.
  //    서버가 흡수해 주므로 사용자 가시 결함은 아니지만, 이 재설계가 없애려는 분열 그 자체다.
  it.each(['', null])('startTime 이 %p 면 미정 문자열로 보낸다', (startTime) => {
    expect(getSlotSelectionTime({ isTimeToBeAnnounced: false, startTime })).toBe('미정');
  });

  it('startTime 키 자체가 없어도 미정', () => {
    expect(getSlotSelectionTime({ isTimeToBeAnnounced: false, startTime: null })).toBe('미정');
  });
});

describe('AssignmentSelector utils', () => {
  it('returns customName as the effective role id for custom roles', () => {
    expect(
      getEffectiveRoleId({
        roleId: 'other',
        customName: '사회자',
      })
    ).toBe('사회자');
  });

  it('builds distinct checkbox keys for multiple custom roles', () => {
    const firstKey = getRoleCheckboxKey(
      {
        roleId: 'other',
        customName: '사회자',
      },
      0
    );
    const secondKey = getRoleCheckboxKey(
      {
        roleId: 'other',
        customName: '조명담당',
      },
      1
    );

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain('사회자');
    expect(secondKey).toContain('조명담당');
  });
});
