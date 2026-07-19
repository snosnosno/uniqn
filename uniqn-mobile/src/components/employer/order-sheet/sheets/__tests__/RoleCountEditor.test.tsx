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
