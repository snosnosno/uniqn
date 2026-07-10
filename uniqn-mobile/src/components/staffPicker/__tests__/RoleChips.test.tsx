/**
 * RoleChips — 역할 칩 그룹 프리미티브 단위 테스트
 *
 * 전체 STAFF_ROLES 렌더, 칩 탭 콜백(key 전달), 선택 칩 a11y selected 상태를 검증한다.
 */
import { render, fireEvent, screen } from '@testing-library/react-native';
import React from 'react';
import { RoleChips } from '../RoleChips';
import { STAFF_ROLES } from '@/constants';

describe('RoleChips', () => {
  it('모든 STAFF_ROLES 칩을 렌더한다', () => {
    render(<RoleChips value="" onChange={jest.fn()} />);

    for (const role of STAFF_ROLES) {
      expect(screen.getByText(`${role.icon} ${role.name}`)).toBeTruthy();
    }
  });

  it('칩을 탭하면 해당 역할 key로 onChange가 호출된다', () => {
    const onChange = jest.fn();
    render(<RoleChips value="" onChange={onChange} />);

    fireEvent.press(screen.getByText('🃏 딜러'));

    expect(onChange).toHaveBeenCalledWith('dealer');
  });

  it('선택된 칩만 selected a11y 상태를 노출한다', () => {
    render(<RoleChips value="dealer" onChange={jest.fn()} />);

    const selected = screen
      .getAllByRole('button')
      .filter((node) => node.props.accessibilityState?.selected);

    expect(selected).toHaveLength(1);
  });
});
