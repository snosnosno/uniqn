import React from 'react';
import { render } from '@testing-library/react-native';
import { JobDetailHeader } from '../JobDetailHeader';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
  },
}));

jest.mock('@/stores', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

jest.mock('@/components/icons', () => ({
  ChevronLeftIcon: () => null,
  ShareIcon: () => null,
}));

describe('JobDetailHeader', () => {
  it('renders the job title with a stable test id', () => {
    const { getByTestId } = render(<JobDetailHeader title="CLD 12345678 Edit" />);

    expect(getByTestId('job-detail-title')).toBeTruthy();
    expect(getByTestId('job-detail-title').props.children).toBe('CLD 12345678 Edit');
  });
});
