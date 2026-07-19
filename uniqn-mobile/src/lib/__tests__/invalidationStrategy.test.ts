import { queryClient } from '../queryClient';
import { invalidateRelated } from '../invalidationStrategy';

jest.mock('../queryClient', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
  queryKeys: {
    applications: {
      all: ['applications'],
      mine: () => ['applications', 'mine'],
      byJobPosting: (jobPostingId: string) => ['applications', 'byJobPosting', jobPostingId],
    },
    jobPostings: {
      all: ['jobPostings'],
      details: () => ['jobPostings', 'detail'],
      detail: (jobPostingId: string) => ['jobPostings', 'detail', jobPostingId],
      mine: () => ['jobPostings', 'mine'],
    },
    schedules: {
      all: ['schedules'],
      mine: () => ['schedules', 'mine'],
    },
    workLogs: {
      all: ['workLogs'],
      mine: () => ['workLogs', 'mine'],
    },
    confirmedStaff: {
      all: ['confirmedStaff'],
      byJobPosting: (jobPostingId: string) => ['confirmedStaff', 'byJobPosting', jobPostingId],
    },
    settlement: {
      all: ['settlement'],
      byJobPosting: (jobPostingId: string) => ['settlement', 'byJobPosting', jobPostingId],
    },
    applicantManagement: {
      all: ['applicantManagement'],
      byJobPosting: (jobPostingId: string, ownerId?: string, statusFilterKey?: string) =>
        ownerId === undefined && statusFilterKey === undefined
          ? ['applicantManagement', 'byJobPosting', jobPostingId]
          : [
              'applicantManagement',
              'byJobPosting',
              jobPostingId,
              ownerId ?? 'anonymous',
              statusFilterKey ?? 'all',
            ],
      cancellationRequests: (jobPostingId: string, ownerId?: string) =>
        ownerId === undefined
          ? ['applicantManagement', 'cancellationRequests', jobPostingId]
          : ['applicantManagement', 'cancellationRequests', jobPostingId, ownerId],
    },
    notifications: {
      all: ['notifications'],
      unreadCount: () => ['notifications', 'unreadCount'],
    },
    user: {
      all: ['user'],
      profile: (userId: string) => ['user', 'profile', userId],
    },
    reviews: {
      all: ['reviews'],
      byWorkLog: (workLogId: string) => ['reviews', 'byWorkLog', workLogId],
      myGiven: () => ['reviews', 'myGiven'],
      pending: () => ['reviews', 'pending'],
      bubbleScore: (revieweeId: string) => ['reviews', 'bubbleScore', revieweeId],
    },
    tournaments: {
      all: ['tournaments'],
    },
    announcements: {
      all: ['announcements'],
    },
    admin: {
      all: ['admin'],
    },
    weeklyGrid: {
      all: ['weeklyGrid'],
    },
  },
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    warn: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}));

const mockedQueryClient = queryClient as unknown as {
  invalidateQueries: jest.Mock;
};

describe('invalidationStrategy', () => {
  beforeEach(() => {
    mockedQueryClient.invalidateQueries.mockClear();
  });

  it('invalidates cancellation request queries when an employer reviews a cancellation', () => {
    invalidateRelated('applicant.reviewCancellation', {
      jobPostingId: 'job-1',
      userId: 'employer-1',
    });

    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['applicantManagement', 'byJobPosting', 'job-1'],
    });
    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['applicantManagement', 'cancellationRequests', 'job-1', 'employer-1'],
    });
    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['reviews', 'pending'],
    });
  });

  // 파생 집계(인원 카운트·주간 그리드)는 work_logs 를 서버에서 집계한 값이라,
  // 확정 뮤테이션이 이 둘을 같이 씻어내지 않으면 화면 숫자만 옛값으로 남는다.
  it('invalidates derived aggregates (filled counts, weekly grid) when an applicant is confirmed', () => {
    invalidateRelated('applicant.confirm', { jobPostingId: 'job-1' });

    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['postingFilledCounts'],
    });
    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['weeklyGrid'],
    });
  });

  it('invalidates the weekly grid when a job posting requirement changes', () => {
    invalidateRelated('jobPosting.update', { jobPostingId: 'job-1' });

    expect(mockedQueryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['weeklyGrid'],
    });
  });
});
