import React from 'react';
import { render } from '@testing-library/react-native';
import { JobDetailHeader } from '../JobDetailHeader';

const mockHeaderBackButton = jest.fn((_props?: unknown) => null);

jest.mock('@/components/navigation', () => ({
  HeaderBackButton: (props: unknown) => mockHeaderBackButton(props),
}));

jest.mock('@/stores', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

describe('JobDetailHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title and passes the fallback route to HeaderBackButton', () => {
    const { getByText, getByTestId } = render(
      <JobDetailHeader title="CLD 12345678 Edit" fallbackHref="/jobs" />
    );

    expect(getByText('공고 상세')).toBeTruthy();
    expect(getByTestId('job-detail-title').props.children).toBe('CLD 12345678 Edit');
    expect(mockHeaderBackButton).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackHref: '/jobs',
      })
    );
  });
});
