import { buildPendingReviewItems } from '../useReviews';
import type { WorkLog } from '@/types';
import type { Review } from '@/types/review';

function createWorkLog(overrides?: Partial<WorkLog>): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    ownerId: 'owner-1',
    jobPostingId: 'job-1',
    jobPostingName: 'Fixed Job',
    staffName: 'Alice',
    date: '',
    role: 'dealer',
    status: 'checked_out',
    checkOutTime: new Date() as never,
    isFixedPosting: true,
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    ...overrides,
  } as WorkLog;
}

describe('buildPendingReviewItems', () => {
  it('includes fixed undated staff worklogs in pending reviews', () => {
    const items = buildPendingReviewItems({
      staffWorkLogs: [createWorkLog()],
      employerWorkLogs: [],
      givenReviews: [],
      isEmployerReviewer: false,
      jobPostingMap: new Map([
        [
          'job-1',
          {
            title: 'Fixed Job',
            ownerName: '홀덤클럽',
            location: { name: 'Seoul' },
          },
        ],
      ]),
    });

    expect(items).toEqual([
      expect.objectContaining({
        workLogId: 'wl-1',
        reviewerType: 'staff',
        workDate: '',
        location: 'Seoul',
        revieweeId: 'owner-1',
        revieweeName: '홀덤클럽',
      }),
    ]);
  });

  it('excludes worklogs that already have a staff review', () => {
    const givenReviews = [
      {
        workLogId: 'wl-1',
        reviewerType: 'staff',
      },
    ] as Review[];

    const items = buildPendingReviewItems({
      staffWorkLogs: [createWorkLog()],
      employerWorkLogs: [],
      givenReviews,
      isEmployerReviewer: false,
      jobPostingMap: new Map(),
    });

    expect(items).toEqual([]);
  });
});
