/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render } from '@testing-library/react-native';
import { WorkLogList } from '../WorkLogList';
import type { WorkLog } from '@/types';

jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    FlashList: ({ data, renderItem, ListHeaderComponent, ListFooterComponent }: any) => (
      <View>
        {ListHeaderComponent}
        {data.map((item: unknown, index: number) => (
          <React.Fragment key={index}>{renderItem({ item, index })}</React.Fragment>
        ))}
        {typeof ListFooterComponent === 'function' ? <ListFooterComponent /> : ListFooterComponent}
      </View>
    ),
  };
});

jest.mock('@/components/ui', () => {
  const React = require('react');
  const { Text, View } = require('react-native');

  return {
    Badge: ({ children }: any) => <Text>{children}</Text>,
    Skeleton: () => <View />,
    EmptyState: ({ title, description }: any) => (
      <View>
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
      </View>
    ),
  };
});

jest.mock('@/components/icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockIcon = () => <View />;

  return {
    CalendarIcon: MockIcon,
    ClockIcon: MockIcon,
    BriefcaseIcon: MockIcon,
    CurrencyDollarIcon: MockIcon,
    CheckCircleIcon: MockIcon,
  };
});

describe('WorkLogList', () => {
  const baseWorkLog: WorkLog = {
    id: 'work-log-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    role: 'dealer',
    status: 'completed',
    timeSlot: '18:00~02:00',
    checkInTime: null,
    checkOutTime: null,
    payrollAmount: 0,
  };

  it('야간 근무 시간을 자정 넘김 기준으로 표시한다', () => {
    const { getByText } = render(<WorkLogList workLogs={[baseWorkLog]} isLoading={false} />);

    expect(getByText('18:00 - 02:00')).toBeTruthy();
    expect(getByText('8시간')).toBeTruthy();
  });
});
