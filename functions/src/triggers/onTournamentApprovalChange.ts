import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { STATUS } from '../constants/status';

/**
 * 대회 공고 승인/거부 알림 Trigger
 * tournamentConfig.approvalStatus 변경 감지 → 작성자에게 알림 전송
 */
export const onTournamentApprovalChange = onDocumentUpdated(
  { document: 'jobPostings/{postingId}', region: 'asia-northeast3' },
  async (event) => {
    const postingId = event.params.postingId;
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // 1. 데이터 검증
    if (!before || !after) {
      logger.warn('onTournamentApprovalChange: 데이터 없음', { postingId });
      return;
    }

    // 2. 대회 공고만 처리
    if (after.postingType !== 'tournament') {
      return;
    }

    // 3. approvalStatus 변경 감지
    const beforeStatus = before.tournamentConfig?.approvalStatus;
    const afterStatus = after.tournamentConfig?.approvalStatus;

    if (beforeStatus === afterStatus) {
      return; // 상태 변경 없음
    }

    // 4. 승인 또는 거부 처리
    if (afterStatus === STATUS.TOURNAMENT.APPROVED) {
      await sendApprovalNotification(postingId, after);
    } else if (afterStatus === STATUS.TOURNAMENT.REJECTED) {
      await sendRejectionNotification(postingId, after);
    }
  });

/**
 * 승인 알림 전송
 */
async function sendApprovalNotification(postingId: string, posting: FirebaseFirestore.DocumentData) {
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const userId = posting.createdBy;
  const title = posting.title;
  const approvedBy = posting.tournamentConfig?.approvedBy;

  if (!userId) {
    logger.error('sendApprovalNotification: userId 없음', { postingId });
    return;
  }

  try {
    await db.collection('notifications').add({
      userId,
      type: 'system',
      title: '대회 공고 승인 완료',
      message: `"${title}" 공고가 승인되었습니다. 이제 게시판에 표시됩니다.`,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      data: {
        postingId,
        postingTitle: title,
        approvedBy,
        action: 'approved'
      }
    });

    logger.info('sendApprovalNotification: 알림 전송 완료', {
      postingId,
      userId
    });
  } catch (error) {
    logger.error('sendApprovalNotification: 알림 전송 실패', {
      error,
      postingId,
      userId
    });
  }
}

/**
 * 거부 알림 전송
 */
async function sendRejectionNotification(postingId: string, posting: FirebaseFirestore.DocumentData) {
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const userId = posting.createdBy;
  const title = posting.title;
  const rejectedBy = posting.tournamentConfig?.rejectedBy;
  const reason = posting.tournamentConfig?.rejectionReason;

  if (!userId) {
    logger.error('sendRejectionNotification: userId 없음', { postingId });
    return;
  }

  try {
    await db.collection('notifications').add({
      userId,
      type: 'system',
      title: '대회 공고 거부됨',
      message: `"${title}" 공고가 거부되었습니다.\n거부 사유: ${reason}`,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
      data: {
        postingId,
        postingTitle: title,
        rejectedBy,
        rejectionReason: reason,
        action: 'rejected'
      }
    });

    logger.info('sendRejectionNotification: 알림 전송 완료', {
      postingId,
      userId
    });
  } catch (error) {
    logger.error('sendRejectionNotification: 알림 전송 실패', {
      error,
      postingId,
      userId
    });
  }
}
