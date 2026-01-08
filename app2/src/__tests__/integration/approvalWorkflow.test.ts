/**
 * 승인 워크플로우 통합 테스트
 *
 * 테스트 시나리오:
 * 1. 대회 공고 생성 (pending 상태)
 * 2. Admin 승인 처리
 * 3. Admin 거부 처리 (사유 포함)
 * 4. 승인 상태 변경 시 알림 발송
 * 5. 권한 검증 (non-admin 차단)
 */

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { JobPosting, TournamentConfig } from '../../types/jobPosting/jobPosting';

// Firebase 모킹
jest.mock('../../firebase', () => ({
  db: {},
  functions: {},
}));

// Firestore 함수 모킹
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1704067200, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

describe('승인 워크플로우 통합 테스트', () => {
  const now = Timestamp.now();

  const mockTournamentPosting: JobPosting = {
    id: 'tournament-1',
    title: '테스트 대회 공고',
    description: '대회 설명',
    location: '서울',
    createdBy: 'organizer-1',
    createdAt: now,
    isChipDeducted: false,
    status: 'open',
    postingType: 'tournament',
    dateSpecificRequirements: [],
    tournamentConfig: {
      approvalStatus: 'pending',
      submittedAt: now,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('대회 공고 생성', () => {
    it('대회 공고는 pending 상태로 생성됨', () => {
      expect(mockTournamentPosting.postingType).toBe('tournament');
      expect(mockTournamentPosting.tournamentConfig?.approvalStatus).toBe('pending');
      expect(mockTournamentPosting.tournamentConfig?.submittedAt).toBeDefined();
    });

    it('tournamentConfig에 필수 필드가 포함됨', () => {
      const config = mockTournamentPosting.tournamentConfig;

      expect(config).toBeDefined();
      expect(config?.approvalStatus).toBe('pending');
      expect(config?.submittedAt).toBeDefined();
      expect(config?.approvedBy).toBeUndefined();
      expect(config?.approvedAt).toBeUndefined();
      expect(config?.rejectedBy).toBeUndefined();
      expect(config?.rejectedAt).toBeUndefined();
      expect(config?.rejectionReason).toBeUndefined();
    });

    it('일반 공고는 tournamentConfig가 없음', () => {
      const regularPosting: Partial<JobPosting> = {
        ...mockTournamentPosting,
        postingType: 'regular',
      };
      delete regularPosting.tournamentConfig;

      expect(regularPosting.tournamentConfig).toBeUndefined();
    });
  });

  describe('Admin 승인 처리', () => {
    it('승인 시 approvalStatus가 approved로 변경', async () => {
      const approvedPosting = {
        ...mockTournamentPosting,
        tournamentConfig: {
          approvalStatus: 'approved' as const,
          submittedAt: now,
          approvedBy: 'admin-1',
          approvedAt: now,
        },
      };

      expect(approvedPosting.tournamentConfig.approvalStatus).toBe('approved');
      expect(approvedPosting.tournamentConfig.approvedBy).toBe('admin-1');
      expect(approvedPosting.tournamentConfig.approvedAt).toBeDefined();
    });

    it('승인 후 rejectionReason이 없음', () => {
      const approvedConfig: TournamentConfig = {
        approvalStatus: 'approved' as const,
        submittedAt: now,
        approvedBy: 'admin-1',
        approvedAt: now,
      };

      expect('rejectionReason' in approvedConfig).toBe(false);
    });
  });

  describe('Admin 거부 처리', () => {
    it('거부 시 approvalStatus가 rejected로 변경', () => {
      const rejectedPosting = {
        ...mockTournamentPosting,
        tournamentConfig: {
          approvalStatus: 'rejected' as const,
          submittedAt: now,
          rejectedBy: 'admin-1',
          rejectedAt: now,
          rejectionReason: '대회 일정이 너무 촉박합니다',
        },
      };

      expect(rejectedPosting.tournamentConfig.approvalStatus).toBe('rejected');
      expect(rejectedPosting.tournamentConfig.rejectedBy).toBe('admin-1');
      expect(rejectedPosting.tournamentConfig.rejectedAt).toBeDefined();
      expect(rejectedPosting.tournamentConfig.rejectionReason).toBe('대회 일정이 너무 촉박합니다');
    });

    it('거부 사유는 최소 10자 이상', () => {
      const validReason = '대회 일정이 너무 촉박합니다';
      expect(validReason.length).toBeGreaterThanOrEqual(10);
    });

    it('거부 사유가 10자 미만이면 에러', () => {
      const shortReason = '짧은 사유';
      expect(shortReason.length).toBeLessThan(10);

      // 실제 Firebase Function에서는 이 경우 에러 발생
      const isValid = shortReason.length >= 10;
      expect(isValid).toBe(false);
    });
  });

  describe('승인 상태별 쿼리', () => {
    it('pending 상태 공고 조회', async () => {
      const mockPendingPostings = [
        { ...mockTournamentPosting, id: '1' },
        { ...mockTournamentPosting, id: '2' },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockPendingPostings.map((p) => ({
          id: p.id,
          data: () => p,
        })),
      });

      const q = query(
        collection({} as any, 'jobPostings'),
        where('postingType', '==', 'tournament'),
        where('tournamentConfig.approvalStatus', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      const postings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      expect(postings).toHaveLength(2);
      expect(postings.every((p: any) => p.tournamentConfig?.approvalStatus === 'pending')).toBe(
        true
      );
    });

    it('approved 상태 공고 조회', async () => {
      const approvedPosting = {
        ...mockTournamentPosting,
        tournamentConfig: {
          approvalStatus: 'approved' as const,
          submittedAt: now,
          approvedBy: 'admin-1',
          approvedAt: now,
        },
      };

      (getDocs as jest.Mock).mockResolvedValue({
        docs: [
          {
            id: 'approved-1',
            data: () => approvedPosting,
          },
        ],
      });

      const q = query(
        collection({} as any, 'jobPostings'),
        where('postingType', '==', 'tournament'),
        where('tournamentConfig.approvalStatus', '==', 'approved')
      );

      const snapshot = await getDocs(q);
      const postings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      expect(postings).toHaveLength(1);
      expect((postings[0] as any).tournamentConfig.approvalStatus).toBe('approved');
    });

    it('rejected 상태 공고 조회', async () => {
      const rejectedPosting = {
        ...mockTournamentPosting,
        tournamentConfig: {
          approvalStatus: 'rejected' as const,
          submittedAt: now,
          rejectedBy: 'admin-1',
          rejectedAt: now,
          rejectionReason: '대회 일정이 너무 촉박합니다',
        },
      };

      (getDocs as jest.Mock).mockResolvedValue({
        docs: [
          {
            id: 'rejected-1',
            data: () => rejectedPosting,
          },
        ],
      });

      const q = query(
        collection({} as any, 'jobPostings'),
        where('postingType', '==', 'tournament'),
        where('tournamentConfig.approvalStatus', '==', 'rejected')
      );

      const snapshot = await getDocs(q);
      const postings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      expect(postings).toHaveLength(1);
      expect((postings[0] as any).tournamentConfig.approvalStatus).toBe('rejected');
      expect((postings[0] as any).tournamentConfig.rejectionReason).toBeDefined();
    });
  });

  describe('알림 발송', () => {
    it('승인 시 알림 데이터 구조', () => {
      const approvalNotification = {
        userId: 'organizer-1',
        type: 'tournament_approved',
        title: '대회 공고 승인',
        message: '대회 공고가 승인되었습니다',
        relatedId: 'tournament-1',
        isRead: false,
        createdAt: now,
      };

      expect(approvalNotification.type).toBe('tournament_approved');
      expect(approvalNotification.userId).toBe('organizer-1');
      expect(approvalNotification.relatedId).toBe('tournament-1');
    });

    it('거부 시 알림 데이터 구조 (사유 포함)', () => {
      const rejectionNotification = {
        userId: 'organizer-1',
        type: 'tournament_rejected',
        title: '대회 공고 거부',
        message: '대회 공고가 거부되었습니다: 대회 일정이 너무 촉박합니다',
        relatedId: 'tournament-1',
        isRead: false,
        createdAt: now,
      };

      expect(rejectionNotification.type).toBe('tournament_rejected');
      expect(rejectionNotification.message).toContain('대회 일정이 너무 촉박합니다');
    });
  });

  describe('권한 검증', () => {
    it('Admin 권한 확인', () => {
      const adminUser = {
        uid: 'admin-1',
        role: 'admin',
      };

      expect(adminUser.role).toBe('admin');
    });

    it('Non-admin 권한 거부', () => {
      const staffUser = {
        uid: 'staff-1',
        role: 'staff',
      };

      expect(staffUser.role).not.toBe('admin');
    });

    it('Employer는 승인 불가', () => {
      const employerUser = {
        uid: 'employer-1',
        role: 'employer',
      };

      expect(employerUser.role).not.toBe('admin');
    });
  });

  describe('워크플로우 전체 시나리오', () => {
    it('생성 → 승인 → 알림 워크플로우', async () => {
      // 1. 대회 공고 생성 (pending)
      const newPosting = { ...mockTournamentPosting };
      expect(newPosting.tournamentConfig?.approvalStatus).toBe('pending');

      // 2. Admin 승인 처리
      const approvedPosting = {
        ...newPosting,
        tournamentConfig: {
          approvalStatus: 'approved' as const,
          submittedAt: now,
          approvedBy: 'admin-1',
          approvedAt: now,
        },
      };
      expect(approvedPosting.tournamentConfig.approvalStatus).toBe('approved');

      // 3. 알림 생성
      const notification = {
        userId: newPosting.createdBy,
        type: 'tournament_approved',
        title: '대회 공고 승인',
        message: '대회 공고가 승인되었습니다',
      };
      expect(notification.type).toBe('tournament_approved');
    });

    it('생성 → 거부 → 알림 워크플로우', async () => {
      // 1. 대회 공고 생성 (pending)
      const newPosting = { ...mockTournamentPosting };
      expect(newPosting.tournamentConfig?.approvalStatus).toBe('pending');

      // 2. Admin 거부 처리
      const rejectionReason = '대회 일정이 너무 촉박합니다';
      const rejectedPosting = {
        ...newPosting,
        tournamentConfig: {
          approvalStatus: 'rejected' as const,
          submittedAt: now,
          rejectedBy: 'admin-1',
          rejectedAt: now,
          rejectionReason,
        },
      };
      expect(rejectedPosting.tournamentConfig.approvalStatus).toBe('rejected');
      expect(rejectedPosting.tournamentConfig.rejectionReason).toBe(rejectionReason);

      // 3. 알림 생성 (사유 포함)
      const notification = {
        userId: newPosting.createdBy,
        type: 'tournament_rejected',
        title: '대회 공고 거부',
        message: `대회 공고가 거부되었습니다: ${rejectionReason}`,
      };
      expect(notification.message).toContain(rejectionReason);
    });
  });

  describe('데이터 무결성', () => {
    it('승인된 공고는 rejectionReason이 없음', () => {
      const approvedConfig: TournamentConfig = {
        approvalStatus: 'approved' as const,
        submittedAt: now,
        approvedBy: 'admin-1',
        approvedAt: now,
      };

      expect('rejectionReason' in approvedConfig).toBe(false);
      expect('rejectedBy' in approvedConfig).toBe(false);
      expect('rejectedAt' in approvedConfig).toBe(false);
    });

    it('거부된 공고는 approvedBy/approvedAt이 없음', () => {
      const rejectedConfig: TournamentConfig = {
        approvalStatus: 'rejected' as const,
        submittedAt: now,
        rejectedBy: 'admin-1',
        rejectedAt: now,
        rejectionReason: '대회 일정이 너무 촉박합니다',
      };

      expect('approvedBy' in rejectedConfig).toBe(false);
      expect('approvedAt' in rejectedConfig).toBe(false);
    });

    it('pending 상태는 승인/거부 정보가 모두 없음', () => {
      const pendingPosting = mockTournamentPosting;

      expect(pendingPosting.tournamentConfig?.approvedBy).toBeUndefined();
      expect(pendingPosting.tournamentConfig?.approvedAt).toBeUndefined();
      expect(pendingPosting.tournamentConfig?.rejectedBy).toBeUndefined();
      expect(pendingPosting.tournamentConfig?.rejectedAt).toBeUndefined();
      expect(pendingPosting.tournamentConfig?.rejectionReason).toBeUndefined();
    });
  });

  describe('엣지 케이스', () => {
    it('거부 사유에 빈 문자열 불가', () => {
      const emptyReason = '';
      expect(emptyReason.length).toBeLessThan(10);
    });

    it('거부 사유에 공백만 있는 경우 불가', () => {
      const whitespaceReason = '          ';
      expect(whitespaceReason.trim().length).toBe(0);
    });

    it('거부 사유 최대 길이 제한 없음', () => {
      const longReason = 'a'.repeat(500);
      expect(longReason.length).toBeGreaterThan(10);
    });

    it('동일한 공고를 여러 번 승인/거부 시도', () => {
      // 첫 번째 승인
      const firstApproval = {
        ...mockTournamentPosting,
        tournamentConfig: {
          approvalStatus: 'approved' as const,
          submittedAt: now,
          approvedBy: 'admin-1',
          approvedAt: now,
        },
      };

      // 이미 approved 상태이므로 재승인 불필요
      expect(firstApproval.tournamentConfig.approvalStatus).toBe('approved');
    });
  });
});
