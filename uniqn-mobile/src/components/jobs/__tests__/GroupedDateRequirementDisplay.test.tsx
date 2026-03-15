import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupedDateRequirementDisplay } from '../GroupedDateRequirementDisplay';

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/icons', () => ({
  ChevronDownIcon: () => null,
  ChevronUpIcon: () => null,
}));

describe('GroupedDateRequirementDisplay', () => {
  it('shows every time slot in the summary', () => {
    const requirements = [
      {
        date: '2026-03-31',
        timeSlots: [
          {
            startTime: '09:00',
            roles: [{ role: 'dealer', headcount: 1, filled: 0 }],
          },
          {
            startTime: '13:00',
            roles: [
              { role: 'dealer', headcount: 1, filled: 0 },
              { role: 'floor', headcount: 1, filled: 0 },
            ],
          },
        ],
      },
    ];

    const { getByText } = render(
      <GroupedDateRequirementDisplay requirements={requirements} showFilledCount={true} />
    );

    expect(getByText(/09:00/)).toBeTruthy();
    expect(getByText(/13:00/)).toBeTruthy();
  });
});
