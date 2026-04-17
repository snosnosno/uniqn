import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HomeDashboard from '../home';

// Mock useAuth
const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock StaffDashboard
jest.mock('@/components/home/StaffDashboard', () => ({
  StaffDashboard: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="staff-dashboard" />;
  },
}));

// Mock EmployerDashboard
jest.mock('@/components/home/EmployerDashboard', () => ({
  EmployerDashboard: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="employer-dashboard" />;
  },
}));

// Mock TabHeader
jest.mock('@/components/headers', () => ({
  TabHeader: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="tab-header" />;
  },
}));

// Mock DashboardViewToggle
jest.mock('@/components/home/DashboardViewToggle', () => ({
  DashboardViewToggle: ({ onChange }: { value: string; onChange: (v: string) => void }) => {
    const { View, Text, Pressable } = jest.requireActual(
      'react-native'
    ) as typeof import('react-native');
    return (
      <View testID="view-toggle">
        <Pressable testID="toggle-staff" onPress={() => onChange('staff')}>
          <Text>스태프로</Text>
        </Pressable>
        <Pressable testID="toggle-employer" onPress={() => onChange('employer')}>
          <Text>내 업무</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('@/components/ui', () => ({
  Loading: () => {
    const { View } = jest.requireActual('react-native') as typeof import('react-native');
    return <View testID="loading" />;
  },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => false,
}));

jest.mock('@/constants', () => ({
  ...jest.requireActual('@/constants'),
  getLayoutColor: () => '#000000',
}));

jest.mock('@/constants/colors', () => ({
  ...jest.requireActual('@/constants/colors'),
  getLayoutColor: () => '#000000',
}));

describe('HomeDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isEmployer: false, isStaff: true });
    const { getByTestId } = render(<HomeDashboard />);
    expect(getByTestId('loading')).toBeTruthy();
  });

  it('shows StaffDashboard for staff user', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isEmployer: false, isStaff: true });
    const { getByTestId, queryByTestId } = render(<HomeDashboard />);
    expect(getByTestId('staff-dashboard')).toBeTruthy();
    expect(queryByTestId('employer-dashboard')).toBeNull();
    expect(queryByTestId('view-toggle')).toBeNull();
  });

  it('shows EmployerDashboard by default for employer user', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isEmployer: true, isStaff: false });
    const { getByTestId } = render(<HomeDashboard />);
    expect(getByTestId('employer-dashboard')).toBeTruthy();
    expect(getByTestId('view-toggle')).toBeTruthy();
  });

  it('toggles to StaffDashboard when employer clicks staff toggle', () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isEmployer: true, isStaff: false });
    const { getByTestId, queryByTestId } = render(<HomeDashboard />);
    fireEvent.press(getByTestId('toggle-staff'));
    expect(getByTestId('staff-dashboard')).toBeTruthy();
    expect(queryByTestId('employer-dashboard')).toBeNull();
  });
});
