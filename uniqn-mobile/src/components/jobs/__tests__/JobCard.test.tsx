/**
 * UNIQN Mobile - JobCard Component Tests
 */

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { JobPostingCard } from '@/types';
import { JobCard } from '../JobCard';

const mockToggleBookmark = jest.fn();
const mockIsBookmarked = jest.fn(() => false);

jest.mock('@/hooks/useBookmarks', () => ({
  useBookmarks: () => ({
    isBookmarked: mockIsBookmarked,
    toggleBookmark: mockToggleBookmark,
  }),
}));

const mockShareJobById = jest.fn();

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    shareJob: jest.fn(),
    shareJobById: mockShareJobById,
    share: jest.fn(),
    isSharing: false,
  }),
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text testID={`badge-${variant || 'default'}`}>{children}</Text>;
  },
}));

jest.mock('../PostingTypeBadge', () => ({
  PostingTypeBadge: ({ type }: { type: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text testID={`posting-type-${type}`}>{type}</Text>;
  },
}));

function createRoleAvailability(roles: string[]): JobPostingCard['roleAvailability'] {
  const items = roles.map((roleKey) => {
    const isCustom = roleKey === 'custom';

    return {
      key: isCustom ? 'other:custom' : roleKey,
      role: (isCustom
        ? 'other'
        : roleKey) as JobPostingCard['roleAvailability']['items'][number]['role'],
      customRole: isCustom ? 'custom' : undefined,
      roleLabel: roleKey,
      count: 1,
      filled: 0,
      remaining: 1,
      isAvailable: true,
    };
  });

  return {
    items,
    availableItems: items,
    totalCount: items.length,
    filledCount: 0,
    remainingCount: items.length,
    hasAvailableRoles: items.length > 0,
  };
}

function createJobCard(overrides: Partial<JobPostingCard> = {}): JobPostingCard {
  const roles = overrides.roles ?? ['dealer', 'manager'];
  const dateRequirements = overrides.dateRequirements ?? [
    {
      date: '2025-01-15',
      timeSlots: [
        {
          startTime: '18:00',
          roles: [
            { role: 'dealer', count: 3, filled: 1, salary: { type: 'daily', amount: 150000 } },
            { role: 'manager', count: 2, filled: 0, salary: { type: 'daily', amount: 150000 } },
          ],
        },
      ],
    },
  ];
  const defaultSalary = overrides.defaultSalary ?? { type: 'daily', amount: 150000 };
  const salaryRows = overrides.salaryRows ?? [
    {
      key: 'dealer-daily-150000',
      role: 'dealer',
      roleLabel: '딜러',
      salary: { type: 'daily', amount: 150000 },
      text: '일급 ₩150,000',
    },
    {
      key: 'manager-daily-150000',
      role: 'manager',
      roleLabel: '매니저',
      salary: { type: 'daily', amount: 150000 },
      text: '일급 ₩150,000',
    },
  ];
  const useSameSalary = overrides.useSameSalary ?? true;
  const workflow = overrides.workflow ?? {
    scheduleKind: 'dated',
    isFixed: false,
    isDated: true,
    isTournament: overrides.postingType === 'tournament',
    isUrgent: overrides.isUrgent ?? false,
    recruitmentType: 'event',
    usesGroupedDateRanges: overrides.postingType === 'tournament',
  };
  const roleAvailability = overrides.roleAvailability ?? createRoleAvailability(roles);
  const salaryOverflowCount =
    overrides.salaryOverflowCount ??
    Math.max(0, (overrides.fullSalaryRows ?? salaryRows).length - salaryRows.length);
  const scheduleDisplay = overrides.scheduleDisplay ?? {
    variant: workflow.isFixed ? 'fixed' : 'dated_requirements',
    dateRequirements,
    dateGroups: [],
    workDate: overrides.workDate ?? '2025-01-15',
    timeSlot: overrides.timeSlot ?? '18:00 - 02:00',
    fixed: workflow.isFixed
      ? {
          daysPerWeek: overrides.daysPerWeek,
          startTime: overrides.startTime,
        }
      : undefined,
  };
  const salaryDisplay = overrides.salaryDisplay ?? {
    defaultSalary,
    rows: overrides.fullSalaryRows ?? salaryRows,
    previewRows: salaryRows,
    overflowCount: salaryOverflowCount,
    useSameSalary,
    hasRoleSpecificSalary: !useSameSalary && (overrides.fullSalaryRows ?? salaryRows).length > 0,
  };
  const applicationEligibility = overrides.applicationEligibility ?? {
    canApply: true,
    selectionMode: workflow.isFixed ? 'fixed_role' : 'dated_assignment',
    requiresRoleSelection: workflow.isFixed,
    requiresAssignmentSelection: !workflow.isFixed,
    requiresPreQuestions: false,
    fixedAssignmentTimeSlot: workflow.isFixed
      ? (overrides.startTime ?? overrides.timeSlot ?? '-')
      : '-',
    availableRoleOptions: roleAvailability.availableItems,
  };

  const baseCard: JobPostingCard = {
    id: 'job-1',
    title: '테스트 공고',
    location: '서울 강남구',
    fullLocation: '서울 강남구 역삼동 123-45',
    workDate: '2025-01-15',
    timeSlot: '18:00 - 02:00',
    roles,
    dateRequirements,
    defaultSalary,
    allowanceLabels: [],
    salaryRows,
    salaryOverflowCount,
    useSameSalary,
    status: 'active',
    isUrgent: false,
    totalApplicants: 5,
    workflow,
    scheduleDisplay,
    salaryDisplay,
    roleAvailability,
    applicationEligibility,
  };

  return {
    ...baseCard,
    ...overrides,
    roles,
    dateRequirements,
    defaultSalary,
    salaryRows,
    salaryOverflowCount,
    useSameSalary,
    workflow,
    scheduleDisplay,
    salaryDisplay,
    roleAvailability,
    applicationEligibility,
  };
}

describe('JobCard', () => {
  const mockOnPress = jest.fn();
  const mockJob = createJobCard();

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBookmarked.mockReturnValue(false);
  });

  it('renders the title and location', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    expect(getByText('테스트 공고')).toBeTruthy();
    expect(getByText(/서울 강남구/)).toBeTruthy();
  });

  it('renders date and time from schedule display', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    expect(getByText(/1\/15\(수\)/)).toBeTruthy();
    expect(getByText(/18:00/)).toBeTruthy();
  });

  it('renders salary using the shared salary projection', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    expect(getByText(/일급 ₩150,000/)).toBeTruthy();
  });

  it('renders hourly and monthly salary formats', () => {
    const hourlyJob = createJobCard({
      defaultSalary: { type: 'hourly', amount: 15000 },
    });
    const monthlyJob = createJobCard({
      defaultSalary: { type: 'monthly', amount: 3000000 },
    });

    const hourly = render(<JobCard job={hourlyJob} onPress={mockOnPress} />);
    const monthly = render(<JobCard job={monthlyJob} onPress={mockOnPress} />);

    expect(hourly.getByText(/시급 ₩15,000/)).toBeTruthy();
    expect(monthly.getByText(/월급 ₩3,000,000/)).toBeTruthy();
  });

  it('renders role counts from the schedule projection', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    expect(getByText(/딜러 3명 \(1\/3\)/)).toBeTruthy();
    expect(getByText(/매니저 2명 \(0\/2\)/)).toBeTruthy();
  });

  it('renders the urgent badge only when urgent', () => {
    const urgentJob = createJobCard({ isUrgent: true });

    const urgent = render(<JobCard job={urgentJob} onPress={mockOnPress} />);
    const normal = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    expect(urgent.getByText('긴급')).toBeTruthy();
    expect(normal.queryByText('긴급')).toBeNull();
  });

  it('renders grouped allowances when provided', () => {
    const jobWithAllowances = createJobCard({
      allowances: {
        meal: 10000,
        transportation: 5000,
      },
      allowanceLabels: ['식비 10,000원', '교통비 5,000원'],
    });

    const { getByText } = render(<JobCard job={jobWithAllowances} onPress={mockOnPress} />);

    expect(getByText(/식비 10,000원/)).toBeTruthy();
    expect(getByText(/교통비 5,000원/)).toBeTruthy();
  });

  it('supports multi-date dated schedules', () => {
    const multiDateJob = createJobCard({
      dateRequirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role: 'dealer', count: 3, filled: 1 }],
            },
          ],
        },
        {
          date: '2025-01-16',
          timeSlots: [
            {
              startTime: '19:00',
              roles: [{ role: 'dealer', count: 2, filled: 0 }],
            },
          ],
        },
      ],
    });

    const { getByText } = render(<JobCard job={multiDateJob} onPress={mockOnPress} />);

    expect(getByText(/1\/15\(수\)/)).toBeTruthy();
    expect(getByText(/1\/16\(목\)/)).toBeTruthy();
  });

  it('calls onPress with the job id', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    fireEvent.press(getByText('테스트 공고'));

    expect(mockOnPress).toHaveBeenCalledWith('job-1');
  });
  it('keeps the canonical workDate when bookmarking a focused grouped card', () => {
    const focusedJob = createJobCard({
      workDate: '2025-01-15',
      workflow: {
        scheduleKind: 'dated',
        isFixed: false,
        isDated: true,
        isTournament: false,
        isUrgent: false,
        recruitmentType: 'event',
        usesGroupedDateRanges: false,
      },
      dateRequirements: [
        {
          date: '2025-01-16',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [{ role: 'dealer', count: 1, filled: 0 }],
            },
          ],
        },
      ],
      scheduleDisplay: {
        variant: 'dated_requirements',
        workDate: '2025-01-15',
        timeSlot: '18:00 - 02:00',
        fixed: undefined,
        dateRequirements: [
          {
            date: '2025-01-16',
            timeSlots: [
              {
                startTime: '09:00',
                roles: [{ role: 'dealer', count: 1, filled: 0 }],
              },
            ],
          },
        ],
        dateGroups: [],
      },
      displayContext: {
        focusedDate: '2025-01-16',
        wasGroupedRange: true,
      },
    });

    const { getAllByRole } = render(<JobCard job={focusedJob} onPress={mockOnPress} />);

    fireEvent.press(getAllByRole('button')[1]);

    expect(mockToggleBookmark).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'job-1',
        title: focusedJob.title,
        location: focusedJob.fullLocation,
        workDate: '2025-01-15',
      })
    );
  });
});

describe('JobCard role labels', () => {
  const mockOnPress = jest.fn();

  const createJobWithRole = (role: string): JobPostingCard =>
    createJobCard({
      location: '서울',
      fullLocation: '서울',
      roles: [role],
      dateRequirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            {
              startTime: '18:00',
              roles: [{ role, count: 1, filled: 0, salary: { type: 'daily', amount: 150000 } }],
            },
          ],
        },
      ],
      salaryRows: [
        {
          key: `${role}-daily-150000`,
          role,
          roleLabel: role,
          salary: { type: 'daily', amount: 150000 },
          text: '일급 ₩150,000',
        },
      ],
    });

  it('renders dealer as 딜러', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('dealer')} onPress={mockOnPress} />
    );

    expect(getByText(/딜러/)).toBeTruthy();
  });

  it('renders manager as 매니저', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('manager')} onPress={mockOnPress} />
    );

    expect(getByText(/매니저/)).toBeTruthy();
  });

  it('renders serving as 서빙', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('serving')} onPress={mockOnPress} />
    );

    expect(getByText(/서빙/)).toBeTruthy();
  });

  // 공고 카드는 직무 문맥이라 '직원'이 맞다. 공고 작성 화면(STAFF_ROLES 칩)이
  // 이미 '직원'을 쓰고 있어, 과거 '일반' 표시는 같은 역할이 화면마다 갈라져
  // 보이는 불일치였다 (2026-07-19 정리).
  it('renders staff as 직원', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('staff')} onPress={mockOnPress} />
    );

    expect(getByText(/직원/)).toBeTruthy();
  });

  it('renders custom roles as-is', () => {
    const { getByText } = render(
      <JobCard job={createJobWithRole('custom')} onPress={mockOnPress} />
    );

    expect(getByText(/custom/)).toBeTruthy();
  });
});

describe('JobCard accessibility', () => {
  const mockOnPress = jest.fn();
  const mockJob = createJobCard({
    fullLocation: '서울 강남구',
    roles: ['dealer'],
    dateRequirements: [
      {
        date: '2025-01-15',
        timeSlots: [
          {
            startTime: '18:00',
            roles: [
              { role: 'dealer', count: 1, filled: 0, salary: { type: 'daily', amount: 150000 } },
            ],
          },
        ],
      },
    ],
    salaryRows: [
      {
        key: 'dealer-daily-150000',
        role: 'dealer',
        roleLabel: '딜러',
        salary: { type: 'daily', amount: 150000 },
        text: '일급 ₩150,000',
      },
    ],
  });

  it('remains pressable', () => {
    const { getByText } = render(<JobCard job={mockJob} onPress={mockOnPress} />);

    fireEvent.press(getByText('테스트 공고'));

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
