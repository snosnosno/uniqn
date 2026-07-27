import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { JobPostingCard } from '../JobPostingCard';
import type { JobPosting } from '@/types';

jest.mock('@/components/ui/Card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require('react-native');
    return <Text>{children}</Text>;
  },
}));

jest.mock('@/components/jobs/PostingTypeBadge', () => ({
  PostingTypeBadge: () => null,
}));

jest.mock('@/components/jobs/TournamentStatusBadge', () => ({
  TournamentStatusBadge: () => null,
}));

jest.mock('@/components/jobs/FixedScheduleDisplay', () => ({
  FixedScheduleDisplay: () => null,
}));

jest.mock('@/components/icons', () => ({
  UsersIcon: () => null,
  QrCodeIcon: () => null,
  ShareIcon: () => null,
}));

jest.mock('@/hooks/useShare', () => ({
  useShare: () => ({
    shareJob: jest.fn(),
    shareJobById: jest.fn(),
    share: jest.fn(),
    isSharing: false,
  }),
}));

describe('JobPostingCard', () => {
  const basePosting: JobPosting = {
    id: 'posting-1',
    schemaVersion: 3,
    title: 'Test Posting',
    status: 'active',
    location: {
      name: 'Gimpo',
      district: 'Gimpo',
      detailedAddress: '123-45',
    },
    workDate: '2026-03-31',
    roleCatalog: [
      { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
      { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
    ],
    schedule: {
      kind: 'dated',
      primaryDate: '2026-03-31',
      allDates: ['2026-03-31'],
      requirements: [
        {
          date: '2026-03-31',
          timeSlots: [
            {
              startTime: '09:00',
              roles: [{ role: 'dealer', count: 1 }],
            },
            {
              startTime: '13:00',
              roles: [
                { role: 'dealer', count: 1 },
                { role: 'floor', count: 1 },
              ],
            },
          ],
        },
      ],
    },
    compensation: {
      mode: 'by_role',
      defaultSalary: { type: 'hourly', amount: 20000 },
      taxSettings: {
        type: 'rate',
        value: 3.3,
      },
    },
    questions: {
      items: [],
    },
    totalPositions: 3,
    filledPositions: 0,
    ownerId: 'owner-1',
    ownerName: 'Owner',
    stats: {
      totalApplicants: 1,
      activeApplicants: 1,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions: 0,
    },
    createdAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date('2026-03-01') } as never,
    updatedAt: { seconds: 0, nanoseconds: 0, toDate: () => new Date('2026-03-01') } as never,
  };

  it('renders every time slot in the employer card schedule summary', () => {
    const { getByText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(getByText(/09:00/)).toBeTruthy();
    expect(getByText(/13:00/)).toBeTruthy();
  });

  it('renders tax settings like the public card', () => {
    const { getByText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(getByText(/3.3%/)).toBeTruthy();
  });

  it('전역 filledCounts 맵에서 이 공고 서브맵을 추출해 확정 인원을 표시한다 (P1 0/N 회귀 가드)', () => {
    // 전역 키공간은 `${jobPostingId}__${date}__${slot}__${role}` — 카드가 posting.id 접두를
    // 제거(extractPostingFilledSubmap)하지 않고 전역맵을 그대로 넘기면 모델 조회 키
    // (`date__slot__role`)와 미스매치해 전건 0/N 으로 렌더된다 (#243 이 고친 P1 회귀).
    const filledCounts = new Map<string, number>([
      ['posting-1__2026-03-31__09:00__dealer', 1],
      ['other-posting__2026-03-31__09:00__dealer', 9],
    ]);

    const { getByText, queryByText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
        filledCounts={filledCounts}
      />
    );

    // 09:00 딜러 1명 슬롯이 (1/1) 로 hydrate — 서브맵 추출이 빠지면 (0/1) 이 되어 실패한다
    expect(getByText(/\(1\/1\)/)).toBeTruthy();
    // 다른 공고(other-posting) 카운트는 새지 않는다
    expect(queryByText(/\(9\//)).toBeNull();
  });

  // ==========================================================================
  // QR 진입점 게이트 (고정 공고 회귀 가드)
  //
  // 고정 공고의 work_log 는 confirm_application 이 dates:['FIXED_SCHEDULE'] 한 원소만
  // flat INSERT 하므로 스태프·공고당 1행이고, 그 행을 scheduled 로 되돌리는 코드가 없다.
  // → D일 출근·퇴근 후 D+1 부터 모든 스캔이 "이미 퇴근 처리됐습니다"로 영구 실패한다.
  // 행 수명 재설계 전까지 고정 공고에는 QR 진입점을 노출하지 않는다.
  // ==========================================================================

  const fixedPosting: JobPosting = {
    ...basePosting,
    id: 'posting-fixed',
    schedule: {
      kind: 'fixed',
      daysPerWeek: 3,
      startTime: '18:00',
      requirements: [
        {
          date: null,
          timeSlots: [{ isTimeToBeAnnounced: false, roles: [{ role: 'dealer', count: 2 }] }],
        },
      ],
    },
  } as JobPosting;

  it('날짜형(dated) 공고 카드에는 QR 아이콘이 보인다', () => {
    const { queryByLabelText } = render(
      <JobPostingCard
        posting={basePosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(queryByLabelText('현장 QR 표시')).not.toBeNull();
  });

  it('고정(fixed) 공고 카드에는 QR 아이콘이 보이지 않는다', () => {
    const { queryByLabelText } = render(
      <JobPostingCard
        posting={fixedPosting}
        onPress={jest.fn()}
        onClose={jest.fn()}
        onReopen={jest.fn()}
        onShowQR={jest.fn()}
        isClosing={false}
        isReopening={false}
      />
    );

    expect(queryByLabelText('현장 QR 표시')).toBeNull();
  });

  describe('묶음 공유 선택 모드', () => {
    const selectionProps = {
      onPress: jest.fn(),
      onClose: jest.fn(),
      onReopen: jest.fn(),
      onShowQR: jest.fn(),
      isClosing: false,
      isReopening: false,
    };

    beforeEach(() => jest.clearAllMocks());

    it('선택 모드에서는 개별 공유·QR·마감 액션을 감춘다 (오조작 방지)', () => {
      const { queryByLabelText } = render(
        <JobPostingCard posting={basePosting} {...selectionProps} selectionMode />
      );

      expect(queryByLabelText('공고 공유하기')).toBeNull();
      expect(queryByLabelText('현장 QR 표시')).toBeNull();
      expect(queryByLabelText(/공고 마감하기/)).toBeNull();
    });

    it('카드 전체 탭이 선택 토글로 동작한다 (상세 이동 아님)', () => {
      const onToggleSelect = jest.fn();
      const { getByLabelText } = render(
        <JobPostingCard
          posting={basePosting}
          {...selectionProps}
          selectionMode
          onToggleSelect={onToggleSelect}
        />
      );

      fireEvent.press(getByLabelText('Test Posting 공고 선택'));

      expect(onToggleSelect).toHaveBeenCalledWith(basePosting);
      expect(selectionProps.onPress).not.toHaveBeenCalled();
    });

    it('공유 불가 공고(selectable=false)는 탭해도 선택되지 않는다', () => {
      const onToggleSelect = jest.fn();
      const { getByLabelText } = render(
        <JobPostingCard
          posting={basePosting}
          {...selectionProps}
          selectionMode
          selectable={false}
          onToggleSelect={onToggleSelect}
        />
      );

      fireEvent.press(getByLabelText('Test Posting 공고 선택'));

      expect(onToggleSelect).not.toHaveBeenCalled();
    });

    it('선택 모드가 아니면 기존대로 상세로 이동한다', () => {
      const { getByLabelText } = render(
        <JobPostingCard posting={basePosting} {...selectionProps} />
      );

      fireEvent.press(getByLabelText('Test Posting 공고 상세보기'));

      expect(selectionProps.onPress).toHaveBeenCalledWith(basePosting);
    });
  });
});
