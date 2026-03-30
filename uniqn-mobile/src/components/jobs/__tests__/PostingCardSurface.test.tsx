import React from 'react';
import { render } from '@testing-library/react-native';
import type { PostingCardViewModel } from '@/types';
import { PostingCardSurface } from '../shared';

describe('PostingCardSurface', () => {
  it('adds the focused group hint to the accessibility label', () => {
    const card: PostingCardViewModel = {
      id: 'job-1',
      title: 'Focused grouped job',
      location: 'Seoul',
      fullLocation: 'Seoul Gangnam',
      workDate: '2026-04-01',
      timeSlot: '10:00',
      roles: ['dealer'],
      dateRequirements: [
        {
          date: '2026-04-02',
          timeSlots: [{ startTime: '09:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
        },
      ],
      defaultSalary: { type: 'daily' as const, amount: 150000 },
      allowanceLabels: [],
      status: 'active' as const,
      postingType: 'regular' as const,
      salaryRows: [],
      salaryOverflowCount: 0,
      workflow: {
        scheduleKind: 'dated',
        isFixed: false,
        isDated: true,
        isTournament: false,
        isUrgent: false,
        recruitmentType: 'event',
        usesGroupedDateRanges: false,
      },
      scheduleDisplay: {
        variant: 'dated_requirements' as const,
        workDate: '2026-04-01',
        timeSlot: '10:00',
        fixed: undefined,
        dateRequirements: [
          {
            date: '2026-04-02',
            timeSlots: [{ startTime: '09:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
          },
        ],
        dateGroups: [],
      },
      salaryDisplay: {
        defaultSalary: { type: 'daily' as const, amount: 150000 },
        rows: [],
        previewRows: [],
        overflowCount: 0,
        useSameSalary: true,
        hasRoleSpecificSalary: false,
      },
      roleAvailability: {
        items: [],
        availableItems: [],
        totalCount: 0,
        filledCount: 0,
        remainingCount: 0,
        hasAvailableRoles: false,
      },
      applicationEligibility: {
        canApply: true,
        selectionMode: 'dated_assignment' as const,
        requiresRoleSelection: false,
        requiresAssignmentSelection: true,
        requiresPreQuestions: false,
        fixedAssignmentTimeSlot: '미정',
        availableRoleOptions: [],
      },
      displayContext: {
        focusedDate: '2026-04-02',
        wasGroupedRange: true,
      },
    };

    const { getByRole } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

    expect(getByRole('button').props.accessibilityLabel).toContain('그룹 일정 중 선택 날짜만 표시');
  });
});
