import React from 'react';
import { render } from '@testing-library/react-native';
import { DateRequirementList } from '../DateRequirementList';

describe('DateRequirementList crash safety', () => {
  it('renders without throwing when a requirement date is invalid', () => {
    expect(() =>
      render(
        <DateRequirementList
          requirements={
            [
              {
                date: 'invalid-date',
                timeSlots: [
                  {
                    startTime: '09:00',
                    roles: [{ role: 'dealer', headcount: 1 }],
                  },
                ],
              },
            ] as never
          }
        />
      )
    ).not.toThrow();
  });
});
