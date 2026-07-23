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
    schedule: { kind: 'dated', items: [] },
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
      kind: 'dated' as const,
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
    // 직무 배정 문맥이라 StaffRole 라벨('직원')이 맞다 (2026-07-19 용어 정리).
    expect(screen.getByText('직원(0/1)')).toBeTruthy();
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

    expect(screen.getByText('선택된 직원 1건')).toBeTruthy();
  });

  it('passes the selected slot id into simple assignments', () => {
    const onSelectionChange = jest.fn();

    useJobSchedule.mockReturnValue(
      createBaseScheduleResult({
        datedSchedules: [
          {
            kind: 'dated',
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
            kind: 'dated',
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
            kind: 'dated',
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

  describe('확정 집계 주입 (하루 기준·C안)', () => {
    const GROUP_ID = '2026-08-22-2026-08-23';

    // grouped 2일(2026-08-22~23), dealer 5명/일 픽스처. dead counter(filledCount=0)로 시작.
    function createGroupedDealerSchedules() {
      const makeDay = (date: string) => ({
        kind: 'dated' as const,
        date,
        timeSlots: [
          {
            id: `slot-${date}`,
            startTime: '18:00',
            isTimeToBeAnnounced: false,
            roles: [
              {
                roleId: 'dealer',
                displayName: 'Dealer',
                filledCount: 0,
                requiredCount: 5,
              },
            ],
          },
        ],
      });
      return [makeDay('2026-08-22'), makeDay('2026-08-23')];
    }

    // 기존 렌더 헬퍼 패턴을 재사용하되 filledCounts 만 주입. 실제 그룹화 대신
    // hydrate 결과를 그대로 group.dates/timeSlots 로 통과시켜 전 파이프라인(주입→hydrate→그룹 max)을 검증.
    function renderSelector({ filledCounts }: { filledCounts?: Map<string, number> }) {
      buildPostingFacts.mockReturnValue({
        workflow: { isTournament: true, usesGroupedDateRanges: true },
        postingType: 'tournament',
      });
      useJobSchedule.mockReturnValue(
        createBaseScheduleResult({ datedSchedules: createGroupedDealerSchedules() })
      );
      groupDatedSchedules.mockImplementation(
        (schedules: ReturnType<typeof createGroupedDealerSchedules>) => [
          {
            id: GROUP_ID,
            startDate: '2026-08-22',
            endDate: '2026-08-23',
            label: '8/22 ~ 8/23',
            dates: schedules,
            timeSlots: schedules[0]!.timeSlots,
          },
        ]
      );

      return render(
        <AssignmentSelector
          jobPosting={{ id: 'job-1' } as JobPosting}
          selectedAssignments={[]}
          onSelectionChange={jest.fn()}
          filledCounts={filledCounts}
        />
      );
    }

    it('그룹 역할이 만석(5/5)이면 마감 배지가 보이고 체크박스는 여전히 선택 가능하다(대기 지원)', () => {
      const filledCounts = new Map<string, number>([
        ['2026-08-22__18:00__dealer', 5],
        ['2026-08-23__18:00__dealer', 1],
      ]);
      const { getByText, getByRole } = renderSelector({ filledCounts });
      expect(getByText(/\(5\/5\)/)).toBeTruthy(); // 분자 = 날짜별 max (합 6 아님)
      // 마감 뱃지 문구 확장(사용자 결정 2026-07-24): '마감' → '마감 · 대기 지원 가능'
      expect(getByText('마감 · 대기 지원 가능')).toBeTruthy();
      const checkbox = getByRole('checkbox');
      expect(checkbox.props.accessibilityState.disabled).toBe(false); // 대기 지원 허용
    });

    it('불균등(2,1)은 (2/5)로 표시되고 마감이 아니다', () => {
      const filledCounts = new Map<string, number>([
        ['2026-08-22__18:00__dealer', 2],
        ['2026-08-23__18:00__dealer', 1],
      ]);
      const { getByText, queryByText } = renderSelector({ filledCounts });
      expect(getByText(/\(2\/5\)/)).toBeTruthy();
      expect(queryByText('마감 · 대기 지원 가능')).toBeNull();
    });

    it('filledCounts 미주입 시 기존 동작(0/N) 완전 보존', () => {
      const { getByText } = renderSelector({});
      expect(getByText(/\(0\/5\)/)).toBeTruthy();
    });
  });
});
