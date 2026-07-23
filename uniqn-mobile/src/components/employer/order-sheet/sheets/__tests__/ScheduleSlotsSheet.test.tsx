/**
 * ScheduleSlotsSheet — 시간·역할 통합 시트 테스트
 *
 * SheetModal 은 children+footer+overlay 렌더로, TimeWheelPicker 는 확인 스텁으로 모킹(기존 관례 승계).
 * 검증: (1) 빈 값이면 기본 슬롯 1개 펼침, (2) 시트 안에서 시간·역할을 모두 편집,
 * (3) 아코디언 활성 전환, (4) 첫 미완성 슬롯 자동 펼침, (5) 추가/삭제, (6) 확인 배출.
 */
import { render, fireEvent, act } from '@testing-library/react-native';
import React from 'react';
import { ScheduleSlotsSheet } from '../ScheduleSlotsSheet';

jest.mock('@/components/ui/SheetModal', () => {
  const { View } = require('react-native');
  return {
    SheetModal: ({ visible, children, footer, overlay }: any) =>
      visible ? (
        <View>
          {children}
          {footer}
          {overlay}
        </View>
      ) : null,
  };
});

// 목이 받은 value 를 mock-time-seed 로 노출한다 — 피커가 어떤 시각으로 열리는지 단언하기 위해.
// onConfirmTBA(시간 미정)는 전달됐을 때만 mock-time-tba 로 노출한다(실물 TbaButton 조건부 렌더 미러).
jest.mock('@/components/ui/TimeWheelPicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    TimeWheelPicker: ({ visible, value, onConfirm, onConfirmTBA }: any) =>
      visible ? (
        <>
          <Text testID="mock-time-seed">{`${value?.hour}:${value?.minute}`}</Text>
          <Pressable testID="mock-time-confirm" onPress={() => onConfirm({ hour: 20, minute: 30 })}>
            <Text>MockPicker</Text>
          </Pressable>
          {onConfirmTBA ? (
            <Pressable testID="mock-time-tba" onPress={onConfirmTBA}>
              <Text>MockTBA</Text>
            </Pressable>
          ) : null}
        </>
      ) : null,
  };
});

describe('ScheduleSlotsSheet', () => {
  it('빈 값이면 기본 슬롯 1개(19:00)가 펼쳐진 채로 시작', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByTestId('order-role-chip-dealer')).toBeTruthy();
  });

  it('시간과 역할을 같은 시트에서 편집해 확인까지 간다 (통합의 핵심)', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '20:30', roles: [{ role: 'dealer', count: 1 }] },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('진입 시 첫 미완성 슬롯이 펼쳐진다 (역할 0개인 두 번째)', () => {
    const { getByText, queryByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('출근 22:00')).toBeTruthy();
    expect(queryByText('출근 19:00')).toBeNull(); // 첫 슬롯은 접힘
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy();
  });

  it('모두 완성이면 첫 카드가 펼쳐진다', () => {
    const { getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    expect(getByText('출근 19:00')).toBeTruthy();
    expect(getByText('22:00 · 딜러 1명')).toBeTruthy();
  });

  it('접힌 카드를 탭하면 그 카드가 펼쳐지고 기존 카드는 접힌다', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-1'));
    expect(getByText('출근 22:00')).toBeTruthy();
    expect(getByText('19:00 · 딜러 1명')).toBeTruthy();
  });

  it('시간대 추가 → 새 카드가 펼쳐지고 직전 카드는 접힌다', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot'));
    expect(getByText('출근 --:--')).toBeTruthy();
    expect(getByText('19:00 · 딜러 2명')).toBeTruthy();
  });

  // 최종 리뷰 이월 회귀 가드 — addSlot 이 클로저의 `slots` 를 읽어 `setSlots(next)` 하면 red 가 된다.
  // 같은 배치에서 두 번 호출되면 두 번째 호출이 첫 번째의 갱신을 보지 못해 slots 만 1개만 늘고,
  // 함수형으로 갱신되던 slotIds 는 2개가 늘어 두 배열의 길이가 어긋난다.
  it('한 배치에서 시간대 추가를 2회 눌러도 슬롯이 2개 늘어난다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    act(() => {
      fireEvent.press(getByTestId('order-time-add-slot'));
      fireEvent.press(getByTestId('order-time-add-slot'));
    });
    // 마지막(세 번째) 카드가 펼쳐져 있어야 한다 — 앞의 두 장은 접힘 요약만 렌더한다.
    expect(getByTestId('order-time-roles-1')).toBeTruthy();
    expect(getByTestId('order-time-start-2')).toBeTruthy();
    // 새 슬롯 2개는 시간이 비어 확인이 잠긴다(게이팅) — 미정으로 채워 확정까지 간다.
    fireEvent.press(getByTestId('order-time-start-2'));
    fireEvent.press(getByTestId('mock-time-tba'));
    fireEvent.press(getByTestId('order-time-roles-1')); // 두 번째 카드 펼침
    fireEvent.press(getByTestId('order-time-start-1'));
    fireEvent.press(getByTestId('mock-time-tba'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm.mock.calls[0][0]).toHaveLength(3);
  });

  it('새 슬롯은 첫 슬롯의 역할을 깊은복사로 시드받는다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot'));
    // 새 슬롯은 시간이 비어 확인이 잠긴다(게이팅) — 미정으로 채운다. setTimeTBA 는
    // roles 참조를 보존하므로({ ...s } 스프레드) 아래 시드 참조 단언은 유효하다.
    fireEvent.press(getByTestId('order-time-start-1'));
    fireEvent.press(getByTestId('mock-time-tba'));

    // 참조 비동일성은 **역할 편집 전에** 확인해야 한다 — 편집 후에는 불변 갱신(map+spread)이
    // 어차피 새 배열·새 객체를 만들어 얕은 시드였어도 참조가 갈라지므로 단언이 무력해진다.
    fireEvent.press(getByText('확인'));
    const seeded = onConfirm.mock.calls[0][0];
    expect(seeded[1].roles).not.toBe(seeded[0].roles);
    expect(seeded[1].roles[0]).not.toBe(seeded[0].roles[0]);

    // 새 카드에서 인원을 바꿔도 첫 슬롯이 오염되지 않아야 한다
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenLastCalledWith([
      { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] },
      { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 3 }] },
    ]);
  });

  it('한 슬롯의 시간을 바꿔도 다른 슬롯의 시간은 그대로다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    // 두 번째 카드를 펼쳐 그 슬롯의 시간만 편집한다 (목 피커는 항상 20:30 확정)
    fireEvent.press(getByTestId('order-time-roles-1'));
    fireEvent.press(getByTestId('order-time-start-1'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
      { startTime: '20:30', roles: [{ role: 'dealer', count: 1 }] },
    ]);
  });

  // Task 6 리뷰 이월 — `slots[i]?.startTime ?? DEFAULT_START` 로 되돌리면 red('0:0') 가 되어야 한다.
  // 새 슬롯의 startTime 은 ''(빈 문자열)이라 `??` 를 그냥 통과해 휠이 00:00 으로 열렸다.
  it('새 시간대의 피커는 00:00 이 아니라 기본값 19:00 으로 열린다', () => {
    const { getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-add-slot')); // 새 슬롯은 startTime=''
    fireEvent.press(getByTestId('order-time-start-1'));
    expect(getByTestId('mock-time-seed').props.children).toBe('19:0');
  });

  it('슬롯이 1개면 삭제 버튼이 없다', () => {
    const { queryByTestId } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={jest.fn()} onClose={jest.fn()} />
    );
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });

  // Task 5 리뷰 예고 회귀 가드 — key={i} 로 되돌리면 red 가 되어야 한다.
  // 펼친 슬롯을 삭제하면 승계 슬롯이 같은 React 인스턴스를 재사용해
  // RoleCountEditor 의 내부 상태(customOpen/customName)를 물려받는 결함.
  it('펼친 슬롯을 삭제해도 승계 슬롯이 편집기 상태를 물려받지 않는다', () => {
    const { getByTestId, queryByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 첫 미완성 = index 0 이 펼쳐진 상태. 기타 직접입력 패널을 열고 이름을 입력해 둔다.
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    // 그 펼친 슬롯을 삭제 — index 0 을 22:00 슬롯이 승계한다
    fireEvent.press(getByTestId('order-time-remove-0'));
    // 승계 슬롯의 편집기는 깨끗해야 한다(입력 패널이 열려 있으면 안 된다)
    expect(queryByTestId('order-sheet-role-custom')).toBeNull();
  });

  // removeSlot 의 인덱스 보정(clamp) 회귀 가드 — `setExpanded` 줄을 지우거나
  // `Math.min(cur, next.length - 1)` 을 `cur` 로 되돌리면 red 가 되어야 한다.
  // 기존 삭제 테스트 2건은 전부 "index 0 삭제"라 보정식을 그냥 통과시킨다.
  // 무가드 증상: 마지막(펼친) 슬롯을 삭제하면 expanded 가 사라진 인덱스를 계속 가리켜
  // 남은 카드가 접힌 채로 남고 펼친 카드가 0개가 된다(사용자가 한 번 더 탭해야 함).
  it('마지막(펼친) 슬롯을 삭제하면 남은 슬롯이 펼쳐진다', () => {
    const { getByText, getByTestId } = render(
      <ScheduleSlotsSheet
        visible
        // 두 슬롯 모두 완성 — firstIncomplete 가 0 을 고르므로
        // 그 뒤 명시적으로 마지막 카드를 펼치는 시나리오가 성립한다.
        value={[
          { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-roles-1')); // 마지막 카드 펼침
    fireEvent.press(getByTestId('order-time-remove-1'));
    expect(getByText('출근 19:00')).toBeTruthy(); // 남은 카드가 펼쳐져야 한다
  });

  it('슬롯 2개에서 펼친 카드를 삭제하면 1개로 줄고 삭제 버튼이 사라진다', () => {
    const { getByTestId, queryByTestId } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '19:00', roles: [] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 첫 미완성 = index 0 이 펼쳐짐
    fireEvent.press(getByTestId('order-time-remove-0'));
    expect(queryByTestId('order-time-remove-0')).toBeNull();
  });
});

describe('확인 게이팅 (2026-07-23) — 무효 슬롯 확정 차단', () => {
  // 역할 0개로 확정되면 연쇄가 급여 시트(역할 0개면 확인 잠김)로 이송되는 데드엔드가 생긴다 —
  // 다른 시트들(TitleSheet·RolesSheet·SalarySheet)과 동일하게 근원(확인 버튼)에서 차단한다.
  it('역할 0개 슬롯이 있으면 확인이 비활성 — 눌러도 확정되지 않는다', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    const { getByText } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={onConfirm} onClose={onClose} />
    );
    // 기본 시드 슬롯은 시간(19:00)은 있지만 역할이 0개다
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('시간 미선택(빈 startTime) 슬롯이 있으면 확인이 비활성', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[{ startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] }]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    // 새 슬롯은 startTime='' (역할은 첫 슬롯에서 시드되므로 시간만 무효)
    fireEvent.press(getByTestId('order-time-add-slot'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('시간 미정(isTimeToBeAnnounced) 슬롯은 유효 — 역할만 있으면 확인이 활성', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
    ]);
  });

  it('무효 슬롯을 채우면 확인이 다시 활성화된다 (복구 경로)', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByText('확인')); // 역할 0개 — 차단
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 역할 추가 → 유효
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '19:00', roles: [{ role: 'dealer', count: 1 }] },
    ]);
  });
});

describe('시간 미정 (2026-07-22)', () => {
  it('피커에서 시간 미정 선택 → 슬롯이 "출근 미정"으로 바뀌고 미정 플래그로 확정된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet visible value={[]} onConfirm={onConfirm} onClose={jest.fn()} />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-tba'));
    expect(getByText('출근 미정')).toBeTruthy();
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
    ]);
  });

  it('미정 슬롯에서 시각을 다시 고르면 미정이 해제된다', () => {
    const onConfirm = jest.fn();
    const { getByTestId, getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
        ]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />
    );
    fireEvent.press(getByTestId('order-time-start-0'));
    fireEvent.press(getByTestId('mock-time-confirm'));
    fireEvent.press(getByText('확인'));
    expect(onConfirm).toHaveBeenCalledWith([
      { startTime: '20:30', roles: [{ role: 'dealer', count: 1 }] },
    ]);
  });

  it('미정 슬롯은 완성으로 간주된다 — 접힘 요약도 "미정 · 딜러 1명"', () => {
    const { getByText } = render(
      <ScheduleSlotsSheet
        visible
        value={[
          { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] },
          { startTime: '22:00', roles: [] },
        ]}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
      />
    );
    // 두 번째(역할 0)가 첫 미완성 → 펼침. 미정 슬롯은 접힘 요약으로 표시.
    expect(getByText('출근 22:00')).toBeTruthy();
    expect(getByText('미정 · 딜러 1명')).toBeTruthy();
  });
});
