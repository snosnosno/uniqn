import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { JobPosting } from '@/types';
import { createSimpleAssignment } from '@/types/assignment';
import type { UseJobScheduleResult } from '@/hooks/useJobSchedule';
import type { ScheduleGroup } from '@/utils/assignment';
import { AssignmentSelector } from '../AssignmentSelector';

jest.mock('@/hooks', () => ({
  useJobSchedule: jest.fn(),
}));

jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: jest.fn(),
  createPostingLegacyDateRequirements: jest.fn(),
}));

jest.mock('@/utils/assignment', () => ({
  groupDatedSchedules: jest.fn(),
  makeSelectionKey: (date: string, timeSlot: string, role: string) => `${date}|${timeSlot}|${role}`,
}));

const { useJobSchedule } = jest.requireMock('@/hooks') as {
  useJobSchedule: jest.MockedFunction<(job: JobPosting | null) => UseJobScheduleResult>;
};

const { buildPostingFacts, createPostingLegacyDateRequirements } = jest.requireMock(
  '@/domains/job-posting'
) as {
  buildPostingFacts: jest.Mock;
  createPostingLegacyDateRequirements: jest.Mock;
};

const { groupDatedSchedules } = jest.requireMock('@/utils/assignment') as {
  groupDatedSchedules: jest.Mock;
};

function createBaseScheduleResult(
  overrides: Partial<UseJobScheduleResult> = {}
): UseJobScheduleResult {
  return {
    schedule: { type: 'dated', items: [] },
    isFixed: false,
    isDated: true,
    allDates: [],
    allRoles: [],
    totalRequired: 0,
    totalFilled: 0,
    isClosed: false,
    fixedSchedule: null,
    datedSchedules: [],
    ...overrides,
  };
}

function createSingleDateSchedule() {
  return [
    {
      type: 'dated' as const,
      date: '2026-04-01',
      timeSlots: [
        {
          id: 'slot-a',
          startTime: '09:00',
          isTimeToBeAnnounced: false,
          roles: [
            {
              roleId: 'staff',
              displayName: 'Staff',
              filledCount: 0,
              requiredCount: 1,
            },
          ],
        },
      ],
    },
  ];
}

describe('AssignmentSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    buildPostingFacts.mockReturnValue({
      workflow: {
        isTournament: false,
      },
      postingType: 'regular',
    });
    createPostingLegacyDateRequirements.mockReturnValue([]);
    groupDatedSchedules.mockReturnValue([]);
  });

  it('renders readable Korean labels for date, time, and role', () => {
    useJobSchedule.mockReturnValue(
      createBaseScheduleResult({
        datedSchedules: createSingleDateSchedule(),
      })
    );

    render(
      <AssignmentSelector
        jobPosting={{ id: 'job-1' } as JobPosting}
        selectedAssignments={[]}
        onSelectionChange={jest.fn()}
      />
    );

    expect(screen.getByText(/날짜 및 역할 선택/)).toBeTruthy();
    expect(screen.getByText('4/1(수)')).toBeTruthy();
    expect(screen.getByText('09:00')).toBeTruthy();
    expect(screen.getByText('일반(0/1)')).toBeTruthy();
  });

  it('renders a readable Korean selection summary', () => {
    useJobSchedule.mockReturnValue(
      createBaseScheduleResult({
        datedSchedules: createSingleDateSchedule(),
      })
    );

    render(
      <AssignmentSelector
        jobPosting={{ id: 'job-1' } as JobPosting}
        selectedAssignments={[createSimpleAssignment('staff', '09:00', '2026-04-01')]}
        onSelectionChange={jest.fn()}
      />
    );

    expect(screen.getByText('선택된 일반 1건')).toBeTruthy();
  });

  it('passes the selected slot id into simple assignments', () => {
    const onSelectionChange = jest.fn();

    useJobSchedule.mockReturnValue(
      createBaseScheduleResult({
        datedSchedules: [
          {
            type: 'dated',
            date: '2026-04-01',
            timeSlots: [
              {
                id: 'slot-a',
                startTime: '09:00',
                isTimeToBeAnnounced: false,
                roles: [
                  {
                    roleId: 'dealer',
                    displayName: 'Dealer',
                    filledCount: 0,
                    requiredCount: 1,
                  },
                ],
              },
            ],
          },
        ],
      })
    );

    render(
      <AssignmentSelector
        jobPosting={{ id: 'job-1' } as JobPosting}
        selectedAssignments={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.press(screen.getByRole('checkbox'));

    expect(onSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({
        roleIds: ['dealer'],
        timeSlot: '09:00',
        dates: ['2026-04-01'],
        isGrouped: false,
        checkMethod: 'individual',
        groupId: 'slot-a',
      }),
    ]);
  });

  it('keeps per-date slot ids when tournament groups expand into assignments', () => {
    const onSelectionChange = jest.fn();

    buildPostingFacts.mockReturnValue({
      workflow: {
        isTournament: true,
        usesGroupedDateRanges: true,
      },
      postingType: 'tournament',
    });

    const groupedSchedules: ScheduleGroup[] = [
      {
        id: '2026-04-01-2026-04-02',
        startDate: '2026-04-01',
        endDate: '2026-04-02',
        label: '4/1 ~ 4/2',
        dates: [
          {
            type: 'dated',
            date: '2026-04-01',
            timeSlots: [
              {
                id: 'slot-day-1',
                startTime: '18:00',
                isTimeToBeAnnounced: false,
                roles: [
                  {
                    roleId: 'dealer',
                    displayName: 'Dealer',
                    filledCount: 0,
                    requiredCount: 1,
                  },
                ],
              },
            ],
          },
          {
            type: 'dated',
            date: '2026-04-02',
            timeSlots: [
              {
                id: 'slot-day-2',
                startTime: '18:00',
                isTimeToBeAnnounced: false,
                roles: [
                  {
                    roleId: 'dealer',
                    displayName: 'Dealer',
                    filledCount: 0,
                    requiredCount: 1,
                  },
                ],
              },
            ],
          },
        ],
        timeSlots: [
          {
            id: 'slot-day-1',
            startTime: '18:00',
            isTimeToBeAnnounced: false,
            roles: [
              {
                roleId: 'dealer',
                displayName: 'Dealer',
                filledCount: 0,
                requiredCount: 1,
              },
            ],
          },
        ],
      },
    ];

    useJobSchedule.mockReturnValue(
      createBaseScheduleResult({
        datedSchedules: groupedSchedules[0]!.dates,
      })
    );
    groupDatedSchedules.mockReturnValue(groupedSchedules);

    render(
      <AssignmentSelector
        jobPosting={{ id: 'job-1' } as JobPosting}
        selectedAssignments={[]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.press(screen.getAllByRole('checkbox')[0]!);

    expect(onSelectionChange).toHaveBeenCalledWith([
      expect.objectContaining({
        dates: ['2026-04-01'],
        timeSlot: '18:00',
        groupId: 'slot-day-1',
      }),
      expect.objectContaining({
        dates: ['2026-04-02'],
        timeSlot: '18:00',
        groupId: 'slot-day-2',
      }),
    ]);
  });
});
