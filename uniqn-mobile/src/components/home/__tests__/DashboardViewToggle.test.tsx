import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DashboardViewToggle } from '../DashboardViewToggle';

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
}));

describe('DashboardViewToggle', () => {
  it('value="employer"일 때 "내 업무" 탭이 선택 스타일로 렌더된다', () => {
    const onChange = jest.fn();
    const { getByText } = render(<DashboardViewToggle value="employer" onChange={onChange} />);
    const employerTab = getByText('내 업무');
    const staffTab = getByText('스태프로');
    expect(employerTab).toBeTruthy();
    expect(staffTab).toBeTruthy();
  });

  it('value="staff"일 때 "스태프로" 탭이 선택 스타일로 렌더된다', () => {
    const onChange = jest.fn();
    const { getByText } = render(<DashboardViewToggle value="staff" onChange={onChange} />);
    const staffTab = getByText('스태프로');
    expect(staffTab).toBeTruthy();
  });

  it('"스태프로" 탭 탭 시 onChange("staff")를 호출한다', () => {
    const onChange = jest.fn();
    const { getByText } = render(<DashboardViewToggle value="employer" onChange={onChange} />);
    fireEvent.press(getByText('스태프로'));
    expect(onChange).toHaveBeenCalledWith('staff');
  });
});
