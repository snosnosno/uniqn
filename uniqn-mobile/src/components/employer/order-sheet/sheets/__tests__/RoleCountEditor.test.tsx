/**
 * RoleCountEditor — 역할·인원 편집기 테스트 (칩 토글 + 스테퍼)
 *
 * controlled 컴포넌트이므로 Harness 로 state 를 쥐고 dump 로 결과를 검증한다.
 * 검증: (1) 칩 탭=1명 추가, (2) 재탭=해제, (3) 스테퍼 ±, (4) 하한 1, (5) 해제 후 인원 복원, (6) 삭제.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { RoleCountEditor } from '../RoleCountEditor';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type SlotRoles = OrderSheetValues['scheduleGroups'][number]['timeSlots'][number]['roles'];

function Harness({ initial = [] as SlotRoles }) {
  const [roles, setRoles] = useState<SlotRoles>(initial);
  return (
    <>
      <RoleCountEditor roles={roles} onChange={setRoles} />
      <Text testID="dump">{JSON.stringify(roles)}</Text>
    </>
  );
}

const dump = (getByTestId: (id: string) => { props: { children: string } }) =>
  JSON.parse(getByTestId('dump').props.children) as SlotRoles;

describe('RoleCountEditor — 칩 토글', () => {
  it('딜러 칩 탭 → 1명으로 추가된다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 1 }]);
  });

  it('선택된 칩 재탭 → 해제된다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    fireEvent.press(getByTestId('order-role-chip-dealer'));
    expect(dump(getByTestId)).toEqual([]);
  });

  it("'기타'는 토글 칩으로 노출되지 않는다 (＋ 직접 입력 액션으로 분리)", () => {
    const { queryByTestId } = render(<Harness />);
    expect(queryByTestId('order-role-chip-other')).toBeNull();
  });

  it('직원 칩 라벨은 "직원" (스태프 아님)', () => {
    const { getByText } = render(<Harness />);
    expect(getByText('직원')).toBeTruthy();
  });

  it('스테퍼 + → 인원 증가', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 2 }]);
  });

  it('스테퍼 − 는 1 밑으로 내려가지 않는다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    fireEvent.press(getByTestId('order-role-count-minus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 1 }]);
  });

  it('스테퍼 + 는 99를 넘지 않는다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 99 }]} />);
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });

  it('칩 해제 후 재선택 → 직전 인원이 복원된다 (오조작 복구)', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 12 }]} />);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 해제
    expect(dump(getByTestId)).toEqual([]);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 재선택
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  it('삭제 버튼 → 해당 행 제거', () => {
    const { getByTestId, getByLabelText } = render(
      <Harness
        initial={[
          { role: 'dealer', count: 2 },
          { role: 'floor', count: 1 },
        ]}
      />
    );
    fireEvent.press(getByLabelText('딜러 삭제'));
    expect(dump(getByTestId)).toEqual([{ role: 'floor', count: 1 }]);
  });
});

describe('RoleCountEditor — 기타 직접 입력', () => {
  it('＋ 직접 입력 → 이름 입력 → 추가 시 other+customRole 로 담긴다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '  칩카운터  ');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 1 }]);
  });

  it('이름이 다른 커스텀 역할을 여러 개 담을 수 있다 (기능 보존)', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '안내');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([
      { role: 'other', customRole: '칩카운터', count: 1 },
      { role: 'other', customRole: '안내', count: 1 },
    ]);
  });

  it('이름이 비면 추가되지 않는다', () => {
    const { getByTestId } = render(<Harness />);
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([]);
  });

  it('같은 이름을 다시 추가하면 중복 행이 생기지 않는다', () => {
    const { getByTestId } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 3 }]} />
    );
    fireEvent.press(getByTestId('order-role-custom-open'));
    fireEvent.changeText(getByTestId('order-sheet-role-custom'), '칩카운터');
    fireEvent.press(getByTestId('order-role-add'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 3 }]);
  });

  it('커스텀 역할도 스테퍼로 인원 조정된다', () => {
    const { getByTestId } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 1 }]} />
    );
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '칩카운터', count: 2 }]);
  });

  // roleLabel 의 'other' 분기(= roleName 위임의 핵심 갈래) 직접 커버.
  // Task 1 리뷰 지적: 이 분기가 레포 어디에서도 단언되지 않고 있었다.
  it("커스텀 역할은 이름이 그대로 표시된다 (roleLabel 'other' 분기)", () => {
    const { getByText, getByLabelText } = render(
      <Harness initial={[{ role: 'other', customRole: '칩카운터', count: 1 }]} />
    );
    expect(getByText('칩카운터')).toBeTruthy();
    expect(getByLabelText('칩카운터 인원 늘리기')).toBeTruthy();
  });

  it("customRole 이 없는 'other' 는 '기타'로 표시된다", () => {
    const { getByText } = render(<Harness initial={[{ role: 'other', count: 1 }]} />);
    expect(getByText('기타')).toBeTruthy();
  });
});
