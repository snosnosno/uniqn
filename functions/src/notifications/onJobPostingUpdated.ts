/**
 * 공고 수정 알림 Firebase Functions
 *
 * @description
 * 공고 주요 필드가 수정되면 해당 공고에 지원한 지원자들에게 FCM 푸시 알림 전송
 * - 알림 대상 필드: title, location, workDate, startTime, endTime, hourlyRate
 * - 알림 대상: confirmed, pending 상태의 지원자들
 *
 * @trigger Firestore onUpdate
 * @collection jobPostings/{jobPostingId}
 * @version 3.0.0
 * @since 2025-01-18
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { broadcastNotification } from '../utils/notificationUtils';

const db = admin.firestore();

// ============================================================================
// Types
// ============================================================================

interface ApplicationData {
  applicantId: string;
  status: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 알림 대상 필드 (이 필드가 변경되면 알림 발송)
 */
const NOTIFY_FIELDS = [
  'title',
  'location',
  'district',
  'workDate',
  'startDate',
  'endDate',
  'timeSlots',
  'hourlyRate',
  'salary',
];

// ============================================================================
// Triggers
// ============================================================================

/**
 * 공고 수정 알림 트리거
 *
 * @description
 * - 공고 주요 필드 변경 감지
 * - 해당 공고에 지원한 지원자들에게 broadcastNotification으로 일괄 알림
 */
export const onJobPostingUpdated = functions.region('asia-northeast3').firestore
  .document('jobPostings/{jobPostingId}')
  .onUpdate(async (change, context) => {
    const jobPostingId = context.params.jobPostingId;
    const before = change.before.data();
    const after = change.after.data();

    // 주요 필드 변경 확인
    const changedFields = NOTIFY_FIELDS.filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
    );

    if (changedFields.length === 0) {
      return; // 주요 필드 변경 없음
    }

    functions.logger.info('공고 수정 감지', {
      jobPostingId,
      changedFields,
    });

    try {
      // 1. 해당 공고의 지원자들 조회 (confirmed, pending, applied 상태만)
      const applicationsSnap = await db
        .collection('applications')
        .where('jobPostingId', '==', jobPostingId)
        .where('status', 'in', ['confirmed', 'pending', 'applied'])
        .get();

      if (applicationsSnap.empty) {
        functions.logger.info('알림 대상 지원자가 없습니다', { jobPostingId });
        return;
      }

      // 2. 지원자 ID 목록 추출 (중복 제거)
      const applicantIds = [...new Set(
        applicationsSnap.docs.map((doc) => (doc.data() as ApplicationData).applicantId)
      )];

      functions.logger.info('알림 대상 지원자 수', {
        jobPostingId,
        count: applicantIds.length,
      });

      // 3. broadcastNotification으로 일괄 전송
      const results = await broadcastNotification(
        applicantIds,
        'job_updated',
        '📝 공고 수정 안내',
        `'${after.title || '공고'}' 공고가 수정되었습니다. 변경 내용을 확인하세요.`,
        {
          link: `/jobs/${jobPostingId}`,
          data: {
            jobPostingId,
            jobPostingTitle: after.title || '',
            changedFields: changedFields.join(', '),
          },
        }
      );

      // 4. 결과 로깅
      let totalSuccess = 0;
      let totalFailure = 0;
      results.forEach((result) => {
        totalSuccess += result.successCount;
        totalFailure += result.failureCount;
      });

      functions.logger.info('공고 수정 알림 전체 처리 완료', {
        jobPostingId,
        totalApplicants: applicantIds.length,
        totalSuccess,
        totalFailure,
      });
    } catch (error) {
      functions.logger.error('공고 수정 알림 처리 중 오류 발생', {
        jobPostingId,
        error: error instanceof Error ? error.stack : String(error),
      });
    }
  });
