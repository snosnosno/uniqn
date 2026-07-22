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

  // 복지·조건 메타 표시 (2026-07-22 개편): 급여 컬럼 아래 오른쪽 정렬 flex-wrap 블록.
  // 항목 단위 줄바꿈 — 각 라벨은 개별 <Text>(중간 절단 금지), 항목 사이 ' ·' 후행 구분자.
  // 값 없으면 블록 자체 생략. a11y label에는 미포함(카드 소음 억제 — 상세에서 읽힘).
  describe('복지·조건 메타 블록', () => {
    it('항목들이 개별 텍스트로 렌더된다 (전체 조인 문자열 아님)', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        conditionLabels: ['복장 검정 셔츠', '경력 6개월 이상'],
      };

      const { getByText, queryByText } = render(
        <PostingCardSurface card={card} onPress={jest.fn()} />
      );

      // 구 렌더(한 덩어리 조인)는 사라져야 한다 — 항목 단위 줄바꿈이 불가능했다
      expect(queryByText('복장 검정 셔츠 · 경력 6개월 이상')).toBeNull();
      expect(getByText(/복장 검정 셔츠/)).toBeTruthy();
      expect(getByText('경력 6개월 이상')).toBeTruthy();
    });

    it('복지·세금·조건이 한 메타 블록에 순서대로 모인다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        allowanceLabels: ['식사 제공'],
        taxLabel: '세전',
        conditionLabels: ['복장 정장'],
      };

      const { getByTestId, toJSON } = render(
        <PostingCardSurface card={card} onPress={jest.fn()} />
      );

      expect(getByTestId('posting-card-meta')).toBeTruthy();
      const tree = JSON.stringify(toJSON());
      const idxMeal = tree.indexOf('식사 제공');
      const idxTax = tree.indexOf('세전');
      const idxDress = tree.indexOf('복장 정장');
      expect(idxMeal).toBeGreaterThan(-1);
      expect(idxTax).toBeGreaterThan(idxMeal);
      expect(idxDress).toBeGreaterThan(idxTax);
    });

    it('메타 블록은 급여 컬럼 내부(급여 텍스트 뒤)에 렌더된다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        allowanceLabels: ['식사 제공'],
      };

      const { toJSON } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);
      const tree = JSON.stringify(toJSON());

      // 급여(150,000) 텍스트 다음에 메타가 오고, 하단 푸터 이전이어야 한다
      expect(tree.indexOf('식사 제공')).toBeGreaterThan(tree.indexOf('150,000'));
    });

    it('라벨이 전부 비면 메타 블록을 렌더하지 않는다', () => {
      const card: PostingCardViewModel = {
        ...buildBaseCard(),
        allowanceLabels: [],
        conditionLabels: [],
      };

      const { queryByTestId } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(queryByTestId('posting-card-meta')).toBeNull();
    });

    it('conditionLabels 미정의(구 뷰모델)여도 크래시 없이 생략한다', () => {
      const card = buildBaseCard();

      const { queryByText } = render(<PostingCardSurface card={card} onPress={jest.fn()} />);

      expect(queryByText(/복장|경력/)).toBeNull();
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
