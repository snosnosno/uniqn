/**
 * SlotCard — 슬롯 카드 테스트 (아코디언 펼침/접힘)
 *
 * 검증: (1) 접힘=요약만+편집기 미마운트, (2) 접힘 탭=onExpand(무상태), (3) 펼침=시간 트리거+역할 편집기,
 * (4) 삭제 버튼 노출 조건, (5) 요약은 한글 라벨, (6) 역할 변경 배선, (7) 동작 줄이기 분기.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React, { useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import { SlotCard } from '../SlotCard';
import type { SlotRoles } from '../RoleCountEditor';

const baseProps = {
  index: 0,
  removable: false,
  onExpand: jest.fn(),
  onPressTime: jest.fn(),
  onChangeRoles: jest.fn(),
  onRemove: jest.fn(),
};

/**
 * 부모가 expanded 를 소유하는 하네스 — 접힘→펼침 재개 시 편집기가 **리마운트**되는지 검증용.
 * 숨김(display:none 등)으로 계약을 위반하면 편집기 내부 state 가 살아남아 red 가 된다.
 */
function ExpandHarness() {
  const [expanded, setExpanded] = useState(true);
  return (
    <>
      <SlotCard
        {...baseProps}
        expanded={expanded}
        onExpand={() => setExpanded(true)}
        slot={{ startTime: '19:00', roles: [] }}
      />
      <Pressable testID="harness-collapse" onPress={() => setExpanded(false)}>
        <Text>접기</Text>
      </Pressable>
    </>
  );
}

describe('SlotCard', () => {
  it('접힘 상태는 요약만 보이고 역할 편집기는 렌더되지 않는다', () => {
    const { getByText, queryByTestId } = render(
      <SlotCard
        {...baseProps}
        expanded={false}
        slot={{ startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] }}
      />
    );
    expect(getByText('22:00 · 딜러 1명')).toBeTruthy();
    // includeHiddenElements: true 필수 — 기본 쿼리는 display:none 하위를 건너뛰므로
    // "숨겨서 마운트"한 위반 구현도 통과시킨다(실측). 계약은 *미마운트*다.
    expect(queryByTestId('order-role-chip-dealer', { includeHiddenElements: true })).toBeNull();
  });

  it('접힘→펼침 재개 시 편집기가 리마운트된다 (편집 state 미승계)', () => {
    const { getByTestId, queryByTestId } = render(<ExpandHarness />);
    // 펼침 상태에서 '＋ 직접 입력' 패널을 열어 편집기 내부 state 를 더럽힌다
    fireEvent.press(getByTestId('order-role-custom-open'));
    expect(getByTestId('order-sheet-role-custom')).toBeTruthy();

    fireEvent.press(getByTestId('harness-collapse'));
    fireEvent.press(getByTestId('order-time-roles-0'));

    // 언마운트됐다면 customOpen 이 초기화돼 패널이 닫혀 있어야 한다
    expect(queryByTestId('order-sheet-role-custom', { includeHiddenElements: true })).toBeNull();
  });

  it('접힘 카드 탭 → onExpand 호출', () => {
    const onExpand = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        onExpand={onExpand}
        expanded={false}
        slot={{ startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] }}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-0'));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('무상태 — 접힘 카드를 탭해도 스스로 펼치지 않는다 (펼침은 부모 소유)', () => {
    const { getByTestId, queryByTestId } = render(
      <SlotCard {...baseProps} expanded={false} slot={{ startTime: '22:00', roles: [] }} />
    );
    fireEvent.press(getByTestId('order-time-roles-0'));
    // expanded prop 이 그대로면 펼침 전용 요소는 나타나지 않아야 한다 (내부 useState 금지)
    expect(queryByTestId('order-time-start-0', { includeHiddenElements: true })).toBeNull();
    expect(getByTestId('order-time-roles-0')).toBeTruthy();
  });

  it('펼침 상태는 시간 트리거와 역할 편집기를 렌더한다', () => {
    const { getByTestId, getByText } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간 미설정이면 --:-- 로 표시', () => {
    const { getByText } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '', roles: [] }} />
    );
    expect(getByText('출근 --:--')).toBeTruthy();
  });

  it('시간 트리거 탭 → onPressTime 호출', () => {
    const onPressTime = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        onPressTime={onPressTime}
        expanded
        slot={{ startTime: '19:00', roles: [] }}
      />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    expect(onPressTime).toHaveBeenCalledTimes(1);
  });

  it('removable=false 면 삭제 버튼이 없다', () => {
    const { queryByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });

  it('removable=true 면 삭제 버튼 탭 시 onRemove 호출', () => {
    const onRemove = jest.fn();
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        removable
        onRemove={onRemove}
        expanded
        slot={{ startTime: '19:00', roles: [] }}
      />
    );
    fireEvent.press(getByTestId('order-time-remove-0'));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('접힘 요약은 한글 라벨 — raw key(dealer) 노출 금지', () => {
    const { getByText, queryByText } = render(
      <SlotCard
        {...baseProps}
        expanded={false}
        slot={{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }}
      />
    );
    expect(getByText('19:00 · 딜러 2명')).toBeTruthy();
    expect(queryByText('19:00 · dealer 2명')).toBeNull();
  });

  it('역할이 없으면 접힘 요약에 안내 문구', () => {
    const { getByText } = render(
      <SlotCard {...baseProps} expanded={false} slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(getByText('19:00 · 역할 미설정')).toBeTruthy();
  });

  it("여러 역할은 ' · ' 로 잇고 'other' 는 customRole 을 쓴다", () => {
    const { getByText } = render(
      <SlotCard
        {...baseProps}
        expanded={false}
        slot={{
          startTime: '19:00',
          roles: [
            { role: 'dealer', count: 2 },
            { role: 'other', customRole: '칩카운터', count: 1 },
          ],
        }}
      />
    );
    expect(getByText('19:00 · 딜러 2명 · 칩카운터 1명')).toBeTruthy();
  });

  it('역할 편집기의 변경이 onChangeRoles 로 전달되고 원본 배열은 변형되지 않는다', () => {
    const onChangeRoles = jest.fn();
    const roles: SlotRoles = [{ role: 'floor', count: 2 }];
    const { getByTestId } = render(
      <SlotCard
        {...baseProps}
        onChangeRoles={onChangeRoles}
        expanded
        slot={{ startTime: '19:00', roles }}
      />
    );
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    expect(onChangeRoles).toHaveBeenCalledWith([
      { role: 'floor', count: 2 },
      { role: 'dealer', count: 1 },
    ]);
    expect(roles).toEqual([{ role: 'floor', count: 2 }]); // 불변성
  });

  it('index 가 0 이 아니어도 testID 가 인덱스를 따른다', () => {
    const { getByTestId, queryByTestId } = render(
      <SlotCard
        {...baseProps}
        index={2}
        removable
        expanded
        slot={{ startTime: '19:00', roles: [] }}
      />
    );
    expect(getByTestId('order-time-start-2')).toBeTruthy();
    expect(getByTestId('order-time-remove-2')).toBeTruthy();
    expect(queryByTestId('order-time-start-0')).toBeNull();
  });
});

describe('SlotCard — 동작 줄이기', () => {
  afterEach(() => jest.restoreAllMocks());

  it('동작 줄이기 ON 이어도 펼침 내용은 정상 렌더된다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { getByText, findByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(await findByTestId('order-role-chip-dealer')).toBeTruthy();
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  it('동작 줄이기 OFF 에서도 펼침 내용은 정상 렌더된다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    const { getByText, findByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    expect(await findByTestId('order-role-chip-dealer')).toBeTruthy();
    expect(getByText('출근 19:00')).toBeTruthy();
  });

  // 위 두 건은 "렌더가 안 깨진다"만 보므로 useEffect 를 통째로 지워도 통과한다(공허 단언).
  // 실제로 OS 설정을 조회하는 배선이 살아있는지는 호출 자체로 검증한다.
  it('펼침 시 OS 동작 줄이기 설정을 실제로 조회한다', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { findByTestId } = render(
      <SlotCard {...baseProps} expanded slot={{ startTime: '19:00', roles: [] }} />
    );
    await findByTestId('order-role-chip-dealer');
    expect(spy).toHaveBeenCalled();
  });
});
