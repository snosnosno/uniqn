import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoleSalaryField, defaultVenueSalaryDraft } from '../RoleSalaryField';

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
});
