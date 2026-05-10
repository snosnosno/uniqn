import React from 'react';
import { render } from '@testing-library/react-native';
import { StaffDashboard } from '../StaffDashboard';

jest.mock('@/components/home/widgets/NextWorkWidget', () => ({
  NextWorkWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="next-work-widget" />;
  },
}));

jest.mock('@/components/home/widgets/ApplicationStatusWidget', () => ({
  ApplicationStatusWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="application-status-widget" />;
  },
}));

jest.mock('@/components/home/widgets/MonthSummaryWidget', () => ({
  MonthSummaryWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="month-summary-widget" />;
  },
}));

jest.mock('@/components/home/widgets/RecentNoticesWidget', () => ({
  RecentNoticesWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="recent-notices-widget" />;
  },
}));

jest.mock('@/components/home/widgets/MonthlyPayrollWidget', () => ({
  MonthlyPayrollWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="monthly-payroll-widget" />;
  },
}));

describe('StaffDashboard', () => {
  it('5개 위젯이 모두 렌더된다', () => {
    const { getByTestId } = render(<StaffDashboard />);
    expect(getByTestId('next-work-widget')).toBeTruthy();
    expect(getByTestId('application-status-widget')).toBeTruthy();
    expect(getByTestId('month-summary-widget')).toBeTruthy();
    expect(getByTestId('recent-notices-widget')).toBeTruthy();
    expect(getByTestId('monthly-payroll-widget')).toBeTruthy();
  });

  it('ScrollView로 래핑되어 있다', () => {
    const { UNSAFE_getByType } = render(<StaffDashboard />);
    const { ScrollView } = jest.requireActual('react-native') as typeof import('react-native');
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });
});
