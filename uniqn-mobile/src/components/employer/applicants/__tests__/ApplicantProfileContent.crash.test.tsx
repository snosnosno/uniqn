import React from 'react';
import { render } from '@testing-library/react-native';
import { STATUS } from '@/constants';
import { ApplicantProfileContent } from '../ApplicantProfileContent';

describe('ApplicantProfileContent crash safety', () => {
  it('renders without throwing when confirmation history timestamps are malformed', () => {
    expect(() =>
      render(
        <ApplicantProfileContent
          applicant={
            {
              status: STATUS.APPLICATION.CONFIRMED,
              confirmationHistory: [
                {
                  confirmedAt: { toDate: () => new Date('invalid-date') },
                  assignments: [],
                },
              ],
            } as never
          }
          userProfile={null}
        />
      )
    ).not.toThrow();
  });
});
