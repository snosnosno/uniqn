import React from 'react';
import { render } from '@testing-library/react-native';
import type { PostingCardViewModel } from '@/types';
import { PostingCardSurface } from '../shared';

const buildBaseCard = (): PostingCardViewModel => ({
  id: 'job-base',
  title: '기본 카드',
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
});

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

  // S3 카드 조건 표시 (설계 §S3): 복지 줄 다음에 conditionLabels ' · ' 조인 렌더,
  // 값 없으면 줄 자체 생략. a11y label에는 미포함(카드 소음 억제 — 상세에서 읽힘).
  describe('조건(conditions) 줄', () => {
    it('conditionLabels가 있으면 " · " 조인으로 렌더한다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        conditionLabels: ['복장 검정 셔츠', '경력 6개월 이상'],
      };

      const { getByText } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(getByText('복장 검정 셔츠 · 경력 6개월 이상')).toBeTruthy();
    });

    it('conditionLabels가 비면 조건 줄을 렌더하지 않는다', () => {
      const card: PostingCardViewModel = { ...buildBaseCard(), conditionLabels: [] };

      const { queryByText } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(queryByText(/복장|경력/)).toBeNull();
    });

    it('conditionLabels 미정의(구 뷰모델)여도 크래시 없이 생략한다', () => {
      const card = buildBaseCard();

      const { queryByText } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(queryByText(/복장|경력/)).toBeNull();
    });

    it('조건 줄은 복지 줄 다음에 위치한다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        allowanceLabels: ['식사 제공'],
        taxLabel: undefined,
        conditionLabels: ['복장 정장'],
      };

      const { toJSON } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);
      const tree = JSON.stringify(toJSON());

      expect(tree.indexOf('식사 제공')).toBeGreaterThan(-1);
      expect(tree.indexOf('복장 정장')).toBeGreaterThan(tree.indexOf('식사 제공'));
    });

    it('조건은 접근성 라벨에 포함하지 않는다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        conditionLabels: ['복장 정장'],
      };

      const { getByRole } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(getByRole('button').props.accessibilityLabel).not.toContain('복장');
    });
  });
});
