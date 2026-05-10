import React from 'react';
import { render } from '@testing-library/react-native';
import { EmployerDashboard } from '../EmployerDashboard';

jest.mock('@/components/home/widgets/WeeklyStaffWidget', () => ({
  WeeklyStaffWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="weekly-staff-widget" />;
  },
}));

jest.mock('@/components/home/widgets/PostingOverviewWidget', () => ({
  PostingOverviewWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="posting-overview-widget" />;
  },
}));

jest.mock('@/components/home/widgets/CancellationWidget', () => ({
  CancellationWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="cancellation-widget" />;
  },
}));

jest.mock('@/components/home/widgets/RecentNoticesWidget', () => ({
  RecentNoticesWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="recent-notices-widget" />;
  },
}));

jest.mock('@/components/home/widgets/SettlementSummaryWidget', () => ({
  SettlementSummaryWidget: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="settlement-summary-widget" />;
  },
}));

describe('EmployerDashboard', () => {
  it('5개 위젯이 모두 렌더된다', () => {
    const { getByTestId } = render(<EmployerDashboard />);
    expect(getByTestId('weekly-staff-widget')).toBeTruthy();
    expect(getByTestId('posting-overview-widget')).toBeTruthy();
    expect(getByTestId('cancellation-widget')).toBeTruthy();
    expect(getByTestId('recent-notices-widget')).toBeTruthy();
    expect(getByTestId('settlement-summary-widget')).toBeTruthy();
  });

  it('ScrollView로 래핑되어 있다', () => {
    const { UNSAFE_getByType } = render(<EmployerDashboard />);
    const { ScrollView } = jest.requireActual('react-native') as typeof import('react-native');
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });
});
