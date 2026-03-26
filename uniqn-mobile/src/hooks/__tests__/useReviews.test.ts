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

  it('includes fixed undated employer worklogs in pending reviews', () => {
    const items = buildPendingReviewItems({
      staffWorkLogs: [],
      employerWorkLogs: [
        createWorkLog({
          id: 'wl-employer-1',
          staffId: 'staff-2',
          staffName: 'Bob',
        }),
      ],
      givenReviews: [],
      isEmployerReviewer: true,
      jobPostingMap: new Map([
        ['job-1', { title: 'Fixed Job', ownerName: '호스트', location: { name: 'Seoul' } }],
      ]),
      currentUserId: 'owner-1',
    });

    expect(items).toEqual([
      expect.objectContaining({
        workLogId: 'wl-employer-1',
        reviewerType: 'employer',
        workDate: '',
        location: 'Seoul',
        revieweeId: 'staff-2',
        revieweeName: 'Bob',
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

  it('sorts pending reviews by earliest review deadline regardless of source order', () => {
    const newerStaffWorkLog = createWorkLog({
      id: 'wl-2',
      date: '2026-03-25',
      checkOutTime: new Date('2026-03-25T18:00:00Z') as never,
    });
    const olderEmployerWorkLog = createWorkLog({
      id: 'wl-1',
      staffId: 'staff-2',
      staffName: 'Bob',
      date: '2026-03-20',
      checkOutTime: new Date('2026-03-20T18:00:00Z') as never,
    });

    const items = buildPendingReviewItems({
      staffWorkLogs: [newerStaffWorkLog],
      employerWorkLogs: [olderEmployerWorkLog],
      givenReviews: [],
      isEmployerReviewer: true,
      jobPostingMap: new Map([
        ['job-1', { title: 'Fixed Job', ownerName: 'Host', location: { name: 'Seoul' } }],
      ]),
    });

    expect(items.map((item) => item.workLogId)).toEqual(['wl-1', 'wl-2']);
    expect(items.map((item) => item.reviewerType)).toEqual(['employer', 'staff']);
  });

  it('excludes self-review items so the list matches review eligibility rules', () => {
    const items = buildPendingReviewItems({
      staffWorkLogs: [createWorkLog({ ownerId: 'user-1' })],
      employerWorkLogs: [
        createWorkLog({
          id: 'wl-2',
          staffId: 'user-1',
          staffName: 'Self Staff',
        }),
      ],
      givenReviews: [],
      isEmployerReviewer: true,
      jobPostingMap: new Map(),
      currentUserId: 'user-1',
    });

    expect(items).toEqual([]);
  });

  it('skips employer review items that are missing staff linkage or not reviewable', () => {
    const items = buildPendingReviewItems({
      staffWorkLogs: [],
      employerWorkLogs: [
        createWorkLog({
          id: 'wl-missing-staff',
          staffId: '',
        }),
        createWorkLog({
          id: 'wl-scheduled',
          staffId: 'staff-2',
          status: 'scheduled',
        }),
      ],
      givenReviews: [],
      isEmployerReviewer: true,
      jobPostingMap: new Map(),
      currentUserId: 'owner-1',
    });

    expect(items).toEqual([]);
  });
});
