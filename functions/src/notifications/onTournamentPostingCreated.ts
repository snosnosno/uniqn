/**
 * 대회공고 승인 요청 알림 Firebase Functions
 *
 * @description
 * 대회공고(tournament)가 생성되면 모든 관리자에게 승인 요청 알림 전송
 *
 * @trigger Firestore onCreate
 * @collection jobPostings/{jobPostingId}
 * @version 1.0.0
 * @since 2025-02-01
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { broadcastNotification } from '../utils/notificationUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface JobPostingData {
  title: string;
  description?: string;
  postingType?: string;
  createdBy: string;
  status: string;
  tournamentConfig?: {
    approvalStatus?: string;
    submittedAt?: admin.firestore.Timestamp;
  };
}

interface UserData {
  name?: string;
  email?: string;
}

// ============================================================================
// Triggers
// ============================================================================

/**
 * 대회공고 승인 요청 알림 트리거
 *
 * @description
 * - 대회공고(postingType === 'tournament')가 생성되면 실행
 * - 모든 관리자에게 승인 요청 알림 전송
 */
export const onTournamentPostingCreated = functions.region('asia-northeast3').firestore
  .document('jobPostings/{jobPostingId}')
  .onCreate(async (snap, context) => {
    const jobPostingId = context.params.jobPostingId;
    const jobPosting = snap.data() as JobPostingData;

    // tournament 타입만 처리
    if (jobPosting.postingType !== 'tournament') {
      return;
    }

    functions.logger.info('대회공고 승인 요청', {
      jobPostingId,
      title: jobPosting.title,
      createdBy: jobPosting.createdBy,
    });

    try {
      // 1. 구인자 정보 조회
      const employerDoc = await db
        .collection('users')
        .doc(jobPosting.createdBy)
        .get();

      const employerData = employerDoc.exists
        ? (employerDoc.data() as UserData)
        : null;
      const employerName = employerData?.name || '알 수 없음';

      // 2. 모든 관리자 조회
      const adminUsersSnap = await db
        .collection('users')
        .where('role', '==', 'admin')
        .get();

      if (adminUsersSnap.empty) {
        functions.logger.warn('관리자가 없습니다');
        return;
      }

      const adminIds = adminUsersSnap.docs.map((doc) => doc.id);

      functions.logger.info('알림 대상 관리자 수', {
        count: adminIds.length,
      });

      // 3. 알림 전송 (broadcastNotification 사용)
      const results = await broadcastNotification(
        adminIds,
        'tournament_approval_request',
        '🏆 대회공고 승인 요청',
        `${employerName}님이 '${jobPosting.title}' 대회공고 승인을 요청했습니다.`,
        {
          link: `/admin/tournaments/${jobPostingId}`,
          priority: 'high',
          data: {
            jobPostingId,
            jobTitle: jobPosting.title,
            employerName,
            employerId: jobPosting.createdBy,
          },
        }
      );

      // 4. 결과 로깅
      let successCount = 0;
      let failureCount = 0;

      results.forEach((result) => {
        if (result.fcmSent) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      functions.logger.info('대회공고 승인 요청 알림 전송 완료', {
        jobPostingId,
        totalAdmins: adminIds.length,
        successCount,
        failureCount,
      });
    } catch (error: any) {
      functions.logger.error('대회공고 승인 요청 알림 처리 중 오류 발생', {
        jobPostingId,
        error: error.message,
        stack: error.stack,
      });
    }
  });
