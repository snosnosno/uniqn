import React from 'react';
import { render } from '@testing-library/react-native';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useAuthStore } from '@/stores';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { JobDetail } from '../JobDetail';

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
  PostingCompensationContent: () => null,
  PostingScheduleContent: () => null,
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
    mockUseUserProfile.mockReturnValue({
      userProfile: null,
      isLoading: false,
      displayName: '테스트 구인처',
      profilePhotoURL: undefined,
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
    });

    const { getByText } = render(<JobDetail job={{} as JobPosting} />);

    expect(mockUseUserProfile).toHaveBeenCalledWith({
      userId: 'owner-1',
      enabled: true,
    });
    expect(getByText('bubble:88')).toBeTruthy();
  });
});
