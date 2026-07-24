import React from 'react';
import { render } from '@testing-library/react-native';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuthStore } from '@/stores';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { JobDetail } from '../JobDetail';

const mockPostingCompensationContent = jest.fn((_props: unknown) => null);
const mockPostingScheduleContent = jest.fn((_props: unknown) => null);

jest.mock('@/domains/job-posting', () => ({
  buildPostingFacts: jest.fn(),
  projectPostingSurface: jest.fn(),
}));

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: jest.fn(),
}));

jest.mock('@/stores', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/components/review/BubbleScoreBadge', () => ({
  __esModule: true,
  default: ({ score }: { score: number }) => {
    const ReactLocal = jest.requireActual<typeof import('react')>('react');
    const { Text: MockText } = jest.requireActual<typeof import('react-native')>('react-native');
    return ReactLocal.createElement(MockText, null, `bubble:${score}`);
  },
}));

jest.mock('@/components/ui/Badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../PostingTypeBadge', () => ({
  PostingTypeBadge: () => null,
}));

jest.mock('../shared', () => ({
  PostingCompensationContent: (props: unknown) => mockPostingCompensationContent(props),
  PostingScheduleContent: (props: unknown) => mockPostingScheduleContent(props),
  PostingStatusBadge: () => null,
  shouldShowUrgentBadge: () => false,
}));

const mockBuildPostingFacts = jest.mocked(buildPostingFacts);
const mockProjectPostingSurface = jest.mocked(projectPostingSurface);
const mockUseUserProfile = useUserProfile as jest.MockedFunction<typeof useUserProfile>;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const baseDetail = {
  postingType: 'regular',
  isUrgent: false,
  status: 'active',
  title: 'CLD 12345678 Edit',
  salaryDisplay: '시급 11,000원',
  defaultSalary: null,
  allowanceLabels: [],
  taxLabel: null,
  description: '설명',
  locationLabel: '서울',
  workflow: 'single_day',
  scheduleDisplay: '내일 10:00',
  workDate: null,
  timeSlot: null,
  daysPerWeek: null,
  startTime: null,
  isStartTimeNegotiable: false,
  requiredRolesWithCount: [],
  contactPhone: null,
  questions: [],
  ownerId: 'owner-1',
  ownerName: '테스트 구인처',
  viewCount: 3,
  totalApplicants: 1,
} as unknown as PostingDetailViewModel;

describe('JobDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildPostingFacts.mockReturnValue({} as never);
    mockProjectPostingSurface.mockReturnValue(baseDetail);
    mockPostingCompensationContent.mockClear();
    mockPostingScheduleContent.mockClear();
    mockUseUserProfile.mockReturnValue({
      userProfile: null,
      isLoading: false,
      displayName: '테스트 구인처',
      profilePhotoURL: undefined,
      profilePhotoURLBlurhash: null,
    });
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ isAdmin: false, isEmployer: false })
    );
  });

  it('비권한 사용자에게는 owner profile 조회를 비활성화한다', () => {
    const { getByText } = render(<JobDetail job={{} as JobPosting} />);

    expect(getByText('테스트 구인처')).toBeTruthy();
    expect(mockUseUserProfile).toHaveBeenCalledWith({
      userId: 'owner-1',
      enabled: false,
    });
    expect(mockBuildPostingFacts).toHaveBeenCalledWith({});
    expect(mockProjectPostingSurface).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        audience: 'public',
        surface: 'detail',
      })
    );
  });

  it('권한 사용자는 bubble score를 렌더링한다', () => {
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({ isAdmin: false, isEmployer: true })
    );
    mockUseUserProfile.mockReturnValue({
      userProfile: {
        bubbleScore: {
          score: 88,
        },
      } as never,
      isLoading: false,
      displayName: '테스트 구인처',
      profilePhotoURL: undefined,
      profilePhotoURLBlurhash: null,
    });

    const { getByText } = render(<JobDetail job={{} as JobPosting} />);

    expect(mockUseUserProfile).toHaveBeenCalledWith({
      userId: 'owner-1',
      enabled: true,
    });
    expect(getByText('bubble:88')).toBeTruthy();
  });
  it('job.conditions 가 있으면 모집 조건 섹션에 복장·조건을 렌더한다', () => {
    const { getByText } = render(
      <JobDetail
        job={
          { conditions: { dressCode: '검정셔츠/슬랙스', experience: 'TDA 숙지자' } } as JobPosting
        }
      />
    );

    expect(getByText('모집 조건')).toBeTruthy();
    expect(getByText('복장')).toBeTruthy();
    expect(getByText('검정셔츠/슬랙스')).toBeTruthy();
    expect(getByText('조건')).toBeTruthy();
    expect(getByText('TDA 숙지자')).toBeTruthy();
  });

  it('job.conditions 가 없으면 모집 조건 섹션을 렌더하지 않는다', () => {
    const { queryByText } = render(<JobDetail job={{} as JobPosting} />);
    expect(queryByText('모집 조건')).toBeNull();
  });

  it('공백만 있는 conditions 값은 모집 조건 섹션을 렌더하지 않는다', () => {
    const { queryByText } = render(
      <JobDetail job={{ conditions: { dressCode: '   ', experience: '' } } as JobPosting} />
    );
    expect(queryByText('모집 조건')).toBeNull();
  });

  it('passes the full grouped schedule to detail content without focused card context', () => {
    const groupedDetail = {
      ...baseDetail,
      workflow: {
        scheduleKind: 'dated',
        isFixed: false,
        isDated: true,
        isTournament: false,
        isUrgent: false,
        recruitmentType: 'event',
        usesGroupedDateRanges: true,
      },
      scheduleDisplay: {
        variant: 'grouped_dates',
        workDate: '2026-04-01',
        timeSlot: '10:00',
        fixed: undefined,
        dateRequirements: [
          {
            date: '2026-04-01',
            isGrouped: true,
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
          },
          {
            date: '2026-04-02',
            isGrouped: true,
            timeSlots: [{ startTime: '09:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
          },
        ],
        dateGroups: [
          {
            id: 'group-a',
            startDate: '2026-04-01',
            endDate: '2026-04-02',
            timeSlots: [{ startTime: '10:00', roles: [{ role: 'dealer', count: 1, filled: 0 }] }],
          },
        ],
      },
      workDate: '2026-04-01',
      timeSlot: '10:00',
    } as unknown as PostingDetailViewModel;

    mockProjectPostingSurface.mockReturnValue(groupedDetail);

    render(<JobDetail job={{} as JobPosting} />);

    expect(mockPostingScheduleContent).toHaveBeenCalledWith(
      expect.objectContaining({
        display: 'detail',
        workflow: groupedDetail.workflow,
        scheduleDisplay: groupedDetail.scheduleDisplay,
        workDate: '2026-04-01',
        timeSlot: '10:00',
      })
    );

    const scheduleProps = mockPostingScheduleContent.mock.calls[0]?.[0] as unknown as {
      displayContext?: unknown;
      scheduleDisplay: {
        dateRequirements: { date: string }[];
        dateGroups: {
          id: string;
          startDate: string;
          endDate: string;
          timeSlots: { startTime: string }[];
        }[];
      };
    };

    expect(scheduleProps.displayContext).toBeUndefined();
    expect(
      scheduleProps.scheduleDisplay.dateRequirements.map((requirement) => requirement.date)
    ).toEqual(['2026-04-01', '2026-04-02']);
    expect(scheduleProps.scheduleDisplay.dateGroups).toHaveLength(1);
    expect(scheduleProps.scheduleDisplay.dateGroups[0]).toMatchObject({
      id: 'group-a',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
    });
    expect(scheduleProps.scheduleDisplay.dateGroups[0]?.timeSlots[0]?.startTime).toBe('10:00');
  });
});
