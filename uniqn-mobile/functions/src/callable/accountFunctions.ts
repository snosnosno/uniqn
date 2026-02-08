/**
 * UNIQN Functions - 계정 관련 Callable 함수
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { sendNotification } from '../utils/notifications';

const db = admin.firestore();
const auth = admin.auth();

interface DeleteAccountRequest {
  reason?: string;
}

interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

interface ExportDataResponse {
  success: boolean;
  data?: {
    user: Record<string, unknown>;
    applications: Record<string, unknown>[];
    workLogs: Record<string, unknown>[];
    notifications: Record<string, unknown>[];
  };
  error?: string;
}

/**
 * 계정 삭제 (회원탈퇴)
 *
 * 처리 순서:
 * 1. 관련 데이터 익명화/삭제
 * 2. Firebase Auth 계정 삭제
 * 3. 완료 알림 (이메일)
 */
export const deleteUserAccount = functions
  .region('asia-northeast3')
  .https
  .onCall(async (data: DeleteAccountRequest, context): Promise<DeleteAccountResponse> => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const userId = context.auth.uid;
    const userEmail = context.auth.token.email;
    const reason = data.reason || '사유 미기재';

    console.log(`Account deletion requested by: ${userId}, reason: ${reason}`);

    try {
      // 1. 진행 중인 스케줄/지원이 있는지 확인
      const activeApplications = await db.collection('applications')
        .where('applicantId', '==', userId)
        .where('status', 'in', ['pending', 'confirmed'])
        .limit(1)
        .get();

      if (!activeApplications.empty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '진행 중인 지원이 있습니다. 모든 지원을 취소하거나 완료 후 탈퇴해주세요.'
        );
      }

      const activeSchedules = await db.collection('schedules')
        .where('staffId', '==', userId)
        .where('status', 'in', ['scheduled', 'checked_in'])
        .limit(1)
        .get();

      if (!activeSchedules.empty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '진행 중인 스케줄이 있습니다. 모든 근무를 완료 후 탈퇴해주세요.'
        );
      }

      // 미정산 급여 확인
      const pendingSettlements = await db.collection('workLogs')
        .where('staffId', '==', userId)
        .where('settlementStatus', 'in', ['pending', 'calculated'])
        .limit(1)
        .get();

      if (!pendingSettlements.empty) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          '미정산 급여가 있습니다. 정산 완료 후 탈퇴해주세요.'
        );
      }

      // 2. 데이터 익명화/삭제
      const batch = db.batch();

      // 사용자 문서 익명화
      const userRef = db.collection('users').doc(userId);
      batch.update(userRef, {
        email: `deleted_${userId}@uniqn.app`,
        name: '탈퇴한 사용자',
        phone: '',
        profileImage: '',
        fcmTokens: {},
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletionReason: reason,
        isDeleted: true,
      });

      // 알림 삭제
      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .get();

      notificationsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // 탈퇴 기록 저장 (분석용, 익명화)
      const deletionLogRef = db.collection('deletionLogs').doc();
      batch.set(deletionLogRef, {
        anonymizedUserId: userId.slice(0, 8) + '****',
        reason,
        userRole: context.auth?.token.role || 'unknown',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await batch.commit();

      // 3. Firebase Auth 계정 삭제 (30일 후 완전 삭제를 위해 비활성화만)
      await auth.updateUser(userId, {
        disabled: true,
      });

      // 4. 탈퇴 완료 이메일 발송 (별도 구현 필요)
      // await sendDeletionConfirmationEmail(userEmail);

      console.log(`Account deleted successfully: ${userId}`);

      return {
        success: true,
        message: '계정이 성공적으로 삭제되었습니다.',
      };
    } catch (error) {
      console.error('Error deleting account:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        '계정 삭제 중 오류가 발생했습니다. 다시 시도해주세요.'
      );
    }
  });

/**
 * 사용자 데이터 내보내기 (개인정보 열람)
 */
export const exportUserData = functions
  .region('asia-northeast3')
  .https
  .onCall(async (_data, context): Promise<ExportDataResponse> => {
    // 인증 확인
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        '로그인이 필요합니다.'
      );
    }

    const userId = context.auth.uid;

    try {
      // 1. 사용자 기본 정보
      const userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', '사용자를 찾을 수 없습니다.');
      }

      const userData = userDoc.data() || {};
      // 민감 정보 제외
      delete userData.fcmTokens;

      // 2. 지원 내역
      const applicationsSnapshot = await db.collection('applications')
        .where('applicantId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const applications = applicationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 3. 근무 기록
      const workLogsSnapshot = await db.collection('workLogs')
        .where('staffId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const workLogs = workLogsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 4. 알림 (최근 50개)
      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const notifications = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      console.log(`Data exported for user: ${userId}`);

      return {
        success: true,
        data: {
          user: {
            id: userId,
            ...userData,
          },
          applications,
          workLogs,
          notifications,
        },
      };
    } catch (error) {
      console.error('Error exporting user data:', error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        'internal',
        '데이터 내보내기 중 오류가 발생했습니다.'
      );
    }
  });
