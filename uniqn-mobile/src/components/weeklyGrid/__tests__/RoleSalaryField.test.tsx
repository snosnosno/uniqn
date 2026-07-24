import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import {
  RoleSalaryField,
  defaultVenueSalaryDraft,
  type VenueSalaryDraft,
} from '../RoleSalaryField';

describe('defaultVenueSalaryDraft', () => {
  it('역할별 시급 기본값(딜러 2만/플로어 3만/그 외 2만)', () => {
    expect(defaultVenueSalaryDraft('dealer')).toEqual({ type: 'hourly', amount: 20000 });
    expect(defaultVenueSalaryDraft('floor')).toEqual({ type: 'hourly', amount: 30000 });
    expect(defaultVenueSalaryDraft('other')).toEqual({ type: 'hourly', amount: 20000 });
  });
});

describe('RoleSalaryField', () => {
  const value = { type: 'hourly' as const, amount: 20000 };
  it('역할명 안내 + 타입 세그먼트 3종(협의 없음)을 렌더한다', () => {
    const { getByText, queryByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={jest.fn()} />
    );
    expect(getByText(/딜러/)).toBeTruthy();
    expect(getByText('시급')).toBeTruthy();
    expect(getByText('일급')).toBeTruthy();
    expect(getByText('월급')).toBeTruthy();
    expect(queryByText('협의')).toBeNull();
  });
  it('시급 스테퍼 ±1,000', () => {
    const onChange = jest.fn();
    const { getByLabelText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={onChange} />
    );
    fireEvent.press(getByLabelText('금액 올리기'));
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 21000 });
    fireEvent.press(getByLabelText('금액 내리기'));
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 19000 });
  });
  it('타입 전환 시 해당 타입 기본 금액으로 재시드', () => {
    const onChange = jest.fn();
    const { getByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={onChange} />
    );
    fireEvent.press(getByText('일급'));
    expect(onChange).toHaveBeenCalledWith({ type: 'daily', amount: 200000 });
  });
  it('onDismiss 제공 시 "나중에 설정" 노출·탭 전달', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <RoleSalaryField roleLabel="딜러" value={value} onChange={jest.fn()} onDismiss={onDismiss} />
    );
    fireEvent.press(getByText('나중에 설정'));
    expect(onDismiss).toHaveBeenCalled();
  });

  // 직접입력(editing)이 열린 상태에서 타입 세그먼트를 탭하면, blur 시점에 stale draftText 가
  // 타입 전환으로 재시드된 금액을 덮어쓰던 desync 회귀. 타입 전환은 editing 을 닫아야 한다.
  it('직접입력 열린 상태에서 타입 전환 시 재시드 금액이 유지된다(desync 회귀)', () => {
    function Harness() {
      const [current, setCurrent] = React.useState<VenueSalaryDraft>({
        type: 'hourly',
        amount: 20000,
      });
      return <RoleSalaryField roleLabel="딜러" value={current} onChange={setCurrent} />;
    }
    const { getByLabelText, getByText, queryByLabelText } = render(<Harness />);

    // 직접입력 열기 → draftText 가 현재 금액(20,000)으로 시드된다.
    fireEvent.press(getByLabelText('금액 직접 입력 열기'));
    expect(getByLabelText('금액 직접 입력')).toBeTruthy();

    // 타입 전환(일급) → 200,000 재시드. editing 이 닫혀 stale draftText 의 blur 덮어쓰기가 사라진다.
    fireEvent.press(getByText('일급'));
    expect(queryByLabelText('금액 직접 입력')).toBeNull();
    expect(getByText('200,000원')).toBeTruthy();
  });
});

describe('RoleSalaryField 직접입력 commit', () => {
  const value = { type: 'hourly' as const, amount: 20000 };

  function openEditing() {
    const onChange = jest.fn();
    const utils = render(<RoleSalaryField roleLabel="딜러" value={value} onChange={onChange} />);
    fireEvent.press(utils.getByLabelText('금액 직접 입력 열기'));
    return { onChange, input: utils.getByLabelText('금액 직접 입력') };
  }

  it('정상 숫자 입력은 그대로 반영한다', () => {
    const { onChange, input } = openEditing();
    fireEvent.changeText(input, '25000');
    fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 25000 });
  });

  it('상한(1억) 초과 입력은 상한으로 클램프한다', () => {
    const { onChange, input } = openEditing();
    fireEvent.changeText(input, '999999999');
    fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 100000000 });
  });

  it('하한(0) 입력은 0으로 반영한다', () => {
    const { onChange, input } = openEditing();
    fireEvent.changeText(input, '0');
    fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith({ type: 'hourly', amount: 0 });
  });

  it('비숫자 입력(NaN)은 onChange 를 호출하지 않는다', () => {
    const { onChange, input } = openEditing();
    fireEvent.changeText(input, 'abc');
    fireEvent(input, 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
});
