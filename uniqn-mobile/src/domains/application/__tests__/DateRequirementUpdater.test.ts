import {
  FIXED_DATE_MARKER,
  FIXED_TIME_MARKER,
  type Assignment,
  type PostingSchedule,
} from '@/types';
import { updatePostingScheduleFilled } from '../DateRequirementUpdater';

describe('updatePostingScheduleFilled', () => {
  it('increments and decrements dated custom roles using the raw assignment role name', () => {
    const schedule: PostingSchedule = {
      kind: 'dated',
      primaryDate: '2025-01-10',
      allDates: ['2025-01-10'],
      requirements: [
        {
          date: '2025-01-10',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'other', customRole: '사회자', count: 2, filled: 0 }],
            },
          ],
        },
      ],
    };

    const assignments: Assignment[] = [
      {
        roleIds: ['사회자'],
        timeSlot: '18:00~22:00',
        dates: ['2025-01-10'],
        isGrouped: false,
      },
    ];

    const incremented = updatePostingScheduleFilled(schedule, assignments, 'increment');
    expect(incremented.kind).toBe('dated');
    const incrementedRole =
      incremented.kind === 'dated'
        ? incremented.requirements[0]?.timeSlots[0]?.roles[0]
        : undefined;
    expect(incrementedRole?.filled).toBe(1);

    const decremented = updatePostingScheduleFilled(incremented, assignments, 'decrement');
    expect(decremented.kind).toBe('dated');
    const decrementedRole =
      decremented.kind === 'dated'
        ? decremented.requirements[0]?.timeSlots[0]?.roles[0]
        : undefined;
    expect(decrementedRole?.filled).toBe(0);
  });

  it('matches fixed custom roles using the raw assignment role name', () => {
    const schedule: PostingSchedule = {
      kind: 'fixed',
      roleRequirements: [{ role: 'other', customRole: '사회자', count: 1, filled: 0 }],
    };

    const assignments: Assignment[] = [
      {
        roleIds: ['사회자'],
        timeSlot: FIXED_TIME_MARKER,
        dates: [FIXED_DATE_MARKER],
        isGrouped: false,
      },
    ];

    const updated = updatePostingScheduleFilled(schedule, assignments, 'increment');
    expect(updated.kind).toBe('fixed');
    const filled = updated.kind === 'fixed' ? updated.roleRequirements?.[0]?.filled : undefined;
    expect(filled).toBe(1);
  });
});
