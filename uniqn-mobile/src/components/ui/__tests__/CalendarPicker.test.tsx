/**
 * CalendarPicker — 다중 선택 상한 가드 (W1-12 / ORDER-8).
 *
 * @description `if (maxSelections && …)` 는 **0 을 falsy 로 흘려보낸다**. 남은 자리가 0개일 때
 *   상한이 통째로 무력화돼 사용자가 날짜를 계속 고를 수 있었고, 호출부(DatePickerModal)가
 *   그제야 '최대 0개까지 선택할 수 있습니다' 라는 사람이 안 쓰는 문장을 띄웠다.
 *
 * ⚠️ 감사 문서는 이 파일을 `src/components/jobs/DateCalendar/CalendarPicker.tsx` 로 적었지만
 *    그 경로에는 CalendarPicker 가 없다. 실제 위치는 여기다 — 감사의 완료 증명 명령을 그대로
 *    실행하면 **전혀 다른 컴포넌트**의 테스트가 green 을 내는 거짓 증거가 된다.
 */
import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

import { CalendarPicker } from '../CalendarPicker';

// 달력은 `value ?? new Date()` 의 달을 연다 — 고정 날짜를 쓰면 그 달이 보이지 않아
// 셀을 누를 수 없다. 실행 시점의 현재 달 안에서 반드시 존재하는 날(10·15)만 쓴다.
const now = new Date();
const day = (n: number) => new Date(now.getFullYear(), now.getMonth(), n);

function renderPicker(props: Partial<React.ComponentProps<typeof CalendarPicker>> = {}) {
  const onMultiSelectChange = jest.fn();
  const utils = render(
    <CalendarPicker
      multiSelect
      selectedDates={[]}
      onMultiSelectChange={onMultiSelectChange}
      {...props}
    />
  );
  return { ...utils, onMultiSelectChange };
}

describe('maxSelections 상한', () => {
  it('🔒 남은 자리가 0개면 아무 날짜도 고를 수 없다 (0 이 falsy 로 새지 않는다)', () => {
    const { getByText, onMultiSelectChange } = renderPicker({ maxSelections: 0 });

    fireEvent.press(getByText('15'));

    expect(onMultiSelectChange).not.toHaveBeenCalled();
  });

  it('남은 자리가 있으면 정상적으로 고를 수 있다', () => {
    const { getByText, onMultiSelectChange } = renderPicker({ maxSelections: 2 });

    fireEvent.press(getByText('15'));

    expect(onMultiSelectChange).toHaveBeenCalledTimes(1);
  });

  it('상한에 도달하면 더 고를 수 없다', () => {
    const { getByText, onMultiSelectChange } = renderPicker({
      maxSelections: 1,
      selectedDates: [day(10)],
    });

    fireEvent.press(getByText('15'));

    expect(onMultiSelectChange).not.toHaveBeenCalled();
  });

  it('상한에 도달해도 이미 고른 날짜는 해제할 수 있다 (막다른 길 방지)', () => {
    const { getByText, onMultiSelectChange } = renderPicker({
      maxSelections: 1,
      selectedDates: [day(10)],
    });

    fireEvent.press(getByText('10'));

    expect(onMultiSelectChange).toHaveBeenCalledWith([]);
  });

  it('maxSelections 미지정이면 상한이 없다', () => {
    const { getByText, onMultiSelectChange } = renderPicker({ selectedDates: [day(10)] });

    fireEvent.press(getByText('15'));

    expect(onMultiSelectChange).toHaveBeenCalledTimes(1);
  });
});
