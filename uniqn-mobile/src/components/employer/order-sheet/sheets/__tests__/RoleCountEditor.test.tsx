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

describe('RoleCountEditor — 인원 숫자 직접 입력', () => {
  it('숫자 입력 후 blur → 값이 반영된다 (blur 전에는 raw 문자열이 그대로 표시된다)', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '12');
    // Minor-3 — 이 태스크의 헤드라인 계약: 편집 중에는 clamp/포맷하지 않은 raw 문자열을 표시한다.
    // 이 단언이 없으면 렌더의 `editing?.key === rowKey ? editing.text : String(r.count)`
    // 분기를 통째로 지워도 테스트가 전부 통과한다(중간 상태 "1" 이 즉시 되돌려져 두 자리 입력 불가).
    expect(getByTestId('order-role-count-input-0').props.value).toBe('12');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  it('세 자리 입력은 두 자리로 잘려 상한 99를 넘지 않는다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '999');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });

  it('빈 문자열로 blur → 직전 값이 복구된다 (0명 저장 방지)', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 5 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 5 }]);
  });

  it('0 입력 → 직전 값이 복구된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 5 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '0');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 5 }]);
  });

  it('숫자가 아닌 문자는 무시된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 1 }]} />);
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '1a2');
    fireEvent(input, 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 12 }]);
  });

  // Minor-2 회귀 가드 — 칩 해제로 기억된 인원이 범위 밖이어도 재선택 시 clamp 되어야 한다.
  // (레거시 draft 의 count=150 같은 값이 하이드레이션으로 흘러들어오는 경로)
  it('범위 밖 인원을 기억했다가 재선택하면 99로 clamp 된다', () => {
    const { getByTestId } = render(<Harness initial={[{ role: 'dealer', count: 150 }]} />);
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 해제 → lastCount=150 기억
    fireEvent.press(getByTestId('order-role-chip-dealer')); // 재선택 → clamp
    expect(dump(getByTestId)).toEqual([{ role: 'dealer', count: 99 }]);
  });
});

/**
 * Important 회귀 가드 — 편집 중인 값이 *다른 역할*에 커밋되는 오데이터.
 *
 * 뿌리는 blur/focus 순서가 아니라 인덱스가 불안정 식별자라는 점이다. 오염 값이
 * zod min(1).max(99) 안이라 스키마가 못 잡는 조용한 오데이터라서 회귀 가드가 필수다.
 * 또 `keyboardShouldPersistTaps="handled"` 때문에 "blur 없이 옆 버튼 탭"은 정상 경로다.
 */
describe('RoleCountEditor — 편집 중 행이 바뀌어도 다른 역할에 커밋되지 않는다', () => {
  it('A. 다른 행으로 포커스를 옮긴 뒤 도착한 blur 는 커밋되지 않는다', () => {
    const { getByTestId } = render(
      <Harness
        initial={[
          { role: 'dealer', count: 3 },
          { role: 'floor', count: 7 },
        ]}
      />
    );
    fireEvent(getByTestId('order-role-count-input-0'), 'focus');
    fireEvent.changeText(getByTestId('order-role-count-input-0'), '12');
    fireEvent(getByTestId('order-role-count-input-1'), 'focus'); // 편집 슬롯이 floor 로 이동
    fireEvent(getByTestId('order-role-count-input-0'), 'blur'); // 늦게 도착한 dealer 의 blur
    // 수정 전: floor 의 값 7 이 dealer 에 커밋되어 dealer:7 이 된다.
    expect(dump(getByTestId)).toEqual([
      { role: 'dealer', count: 3 },
      { role: 'floor', count: 7 },
    ]);
  });

  it('B. 편집 중 다른 행을 삭제했다가 칩으로 되살려도 부활한 행이 값을 받지 않는다', () => {
    const { getByTestId, getByLabelText } = render(
      <Harness
        initial={[
          { role: 'dealer', count: 2 },
          { role: 'floor', count: 5 },
        ]}
      />
    );
    fireEvent(getByTestId('order-role-count-input-1'), 'focus'); // floor 편집 시작
    fireEvent.changeText(getByTestId('order-role-count-input-1'), '12');
    fireEvent.press(getByLabelText('딜러 삭제')); // blur 없이 dealer 제거 → floor 가 index 0 으로
    fireEvent.press(getByTestId('order-role-chip-dealer')); // dealer 부활 → index 1 을 차지
    // 수정 전: 부활한 dealer 행이 편집 문자열 '12' 를 표시한다.
    expect(getByTestId('order-role-count-input-1').props.value).toBe('2');
    fireEvent(getByTestId('order-role-count-input-1'), 'blur');
    // 수정 전: dealer:12 로 커밋된다.
    expect(dump(getByTestId)).toEqual([
      { role: 'floor', count: 5 },
      { role: 'dealer', count: 2 },
    ]);
  });

  it('C. 편집 중인 행을 blur 없이 삭제해도 인덱스를 승계한 행에 커밋되지 않는다', () => {
    const { getByTestId, getByLabelText } = render(
      <Harness
        initial={[
          { role: 'dealer', count: 3 },
          { role: 'floor', count: 5 },
        ]}
      />
    );
    fireEvent(getByTestId('order-role-count-input-0'), 'focus'); // dealer 편집 시작
    fireEvent.changeText(getByTestId('order-role-count-input-0'), '12');
    fireEvent.press(getByLabelText('딜러 삭제')); // blur 없이 편집 중인 행 자체를 삭제
    // 수정 전: index 0 을 승계한 floor 가 dealer 의 편집 문자열 '12' 를 표시한다.
    expect(getByTestId('order-role-count-input-0').props.value).toBe('5');
    fireEvent(getByTestId('order-role-count-input-0'), 'blur');
    // 수정 전: floor:12 로 커밋된다(단순 index 가드는 i=0, editing.index=0 이라 통과해 못 막는다).
    expect(dump(getByTestId)).toEqual([{ role: 'floor', count: 5 }]);
  });

  it("'기타' 는 customRole 까지 포함해 구분된다 — 다른 커스텀 역할에 커밋되지 않는다", () => {
    const { getByTestId, getByLabelText } = render(
      <Harness
        initial={[
          { role: 'other', customRole: '칩카운터', count: 3 },
          { role: 'other', customRole: '안내', count: 5 },
        ]}
      />
    );
    fireEvent(getByTestId('order-role-count-input-0'), 'focus');
    fireEvent.changeText(getByTestId('order-role-count-input-0'), '12');
    fireEvent.press(getByLabelText('칩카운터 삭제'));
    expect(getByTestId('order-role-count-input-0').props.value).toBe('5');
    fireEvent(getByTestId('order-role-count-input-0'), 'blur');
    expect(dump(getByTestId)).toEqual([{ role: 'other', customRole: '안내', count: 5 }]);
  });
});

/**
 * Minor-1 회귀 가드 — 경계에서 값이 그대로면 onChange 를 emit 하지 않아야 한다.
 * Harness 는 emit 여부를 관측할 수 없어(값이 같으면 dump 도 동일) onChange 를 직접 spy 한다.
 * 부모가 form.setValue(..., { shouldValidate: true }) 로 받으면 no-op emit 이
 * 폼 전체 zod 재검증을 유발하므로 값이 아니라 '호출 자체'를 단언한다.
 */
describe('RoleCountEditor — 경계 no-op emit 차단', () => {
  it('인원 1에서 − 를 눌러도 onChange 가 호출되지 않는다', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RoleCountEditor roles={[{ role: 'dealer', count: 1 }]} onChange={onChange} />
    );
    fireEvent.press(getByTestId('order-role-count-minus-0'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('인원 99에서 ＋ 를 눌러도 onChange 가 호출되지 않는다', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RoleCountEditor roles={[{ role: 'dealer', count: 99 }]} onChange={onChange} />
    );
    fireEvent.press(getByTestId('order-role-count-plus-0'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('같은 숫자를 입력하고 blur 해도 onChange 가 호출되지 않는다', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <RoleCountEditor roles={[{ role: 'dealer', count: 5 }]} onChange={onChange} />
    );
    const input = getByTestId('order-role-count-input-0');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, '5');
    fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
});
