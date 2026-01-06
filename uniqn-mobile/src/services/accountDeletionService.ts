/**
 * UNIQN Mobile - 회원탈퇴 서비스
 *
 * @description Firebase 기반 회원탈퇴 및 개인정보 관리 서비스
 * @version 1.0.0
 *
 * 법적 요구사항:
 * - 회원탈퇴 기능 제공 (개인정보보호법)
 * - 30일 유예 기간 후 완전 삭제
 * - 개인정보 열람/수정/삭제 권리
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError, AuthError } from '@/errors';

// ============================================================================
// Constants
// ============================================================================

const USERS_COLLECTION = 'users';
const APPLICATIONS_COLLECTION = 'applications';
const WORK_LOGS_COLLECTION = 'workLogs';
const NOTIFICATIONS_COLLECTION = 'notifications';

/** 회원탈퇴 유예 기간 (일) */
const DELETION_GRACE_PERIOD_DAYS = 30;

// ============================================================================
// Types
// ============================================================================

export type DeletionReason =
  | 'no_longer_needed'
  | 'found_better_service'
  | 'privacy_concerns'
  | 'too_many_notifications'
  | 'difficult_to_use'
  | 'other';

export interface DeletionRequest {
  userId: string;
  reason: DeletionReason;
  reasonDetail?: string;
  requestedAt: Timestamp;
  scheduledDeletionAt: Timestamp;
  status: 'pending' | 'cancelled' | 'completed';
}

export interface UserData {
  uid: string;
  email: string;
  displayName: string | null;
  phoneNumber: string | null;
  role: string;
  createdAt: Timestamp;
  lastLoginAt?: Timestamp;
}

export interface UserDataExport {
  profile: UserData;
  applications: {
    id: string;
    jobPostingTitle: string;
    status: string;
    createdAt: string;
  }[];
  workLogs: {
    id: string;
    date: string;
    checkInAt?: string;
    checkOutAt?: string;
  }[];
  exportedAt: string;
}

// ============================================================================
// Deletion Reasons (Korean labels)
// ============================================================================

export const DELETION_REASONS: Record<DeletionReason, string> = {
  no_longer_needed: '더 이상 서비스를 이용하지 않아요',
  found_better_service: '다른 서비스를 이용하게 되었어요',
  privacy_concerns: '개인정보가 걱정돼요',
  too_many_notifications: '알림이 너무 많아요',
  difficult_to_use: '사용하기 어려워요',
  other: '기타',
};

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 회원탈퇴 요청
 *
 * 1. 비밀번호 재인증 (보안)
 * 2. 계정 비활성화 (즉시)
 * 3. 30일 후 완전 삭제 예약
 */
export async function requestAccountDeletion(
  reason: DeletionReason,
  password: string,
  reasonDetail?: string
): Promise<DeletionRequest> {
  const currentUser = getFirebaseAuth().currentUser;

  if (!currentUser || !currentUser.email) {
    throw new AuthError('E2001', {
      userMessage: '로그인이 필요합니다',
    });
  }

  try {
    logger.info('회원탈퇴 요청 시작', { userId: currentUser.uid, reason });

    // 1. 비밀번호 재인증
    const credential = EmailAuthProvider.credential(currentUser.email, password);
    await reauthenticateWithCredential(currentUser, credential);

    // 2. 탈퇴 요청 정보 저장
    const now = Timestamp.now();
    const scheduledDeletion = Timestamp.fromDate(
      new Date(Date.now() + DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    );

    const deletionRequest: DeletionRequest = {
      userId: currentUser.uid,
      reason,
      reasonDetail,
      requestedAt: now,
      scheduledDeletionAt: scheduledDeletion,
      status: 'pending',
    };

    // 3. 사용자 문서 업데이트 (비활성화)
    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, currentUser.uid);
    await updateDoc(userRef, {
      status: 'deactivated',
      deletionRequest,
      updatedAt: serverTimestamp(),
    });

    logger.info('회원탈퇴 요청 완료', {
      userId: currentUser.uid,
      scheduledDeletionAt: scheduledDeletion.toDate().toISOString(),
    });

    // 4. 로그아웃은 호출자에서 처리

    return deletionRequest;
  } catch (error) {
    logger.error('회원탈퇴 요청 실패', error as Error, {
      userId: currentUser.uid,
    });

    // 비밀번호 틀린 경우
    if ((error as { code?: string }).code === 'auth/wrong-password') {
      throw new AuthError('E2002', {
        userMessage: '비밀번호가 올바르지 않습니다',
      });
    }

    throw mapFirebaseError(error);
  }
}

/**
 * 회원탈퇴 철회 (유예 기간 내)
 */
export async function cancelAccountDeletion(userId: string): Promise<void> {
  try {
    logger.info('회원탈퇴 철회 요청', { userId });

    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    const userData = userDoc.data();
    const deletionRequest = userData.deletionRequest as DeletionRequest | undefined;

    if (!deletionRequest || deletionRequest.status !== 'pending') {
      throw new Error('진행 중인 탈퇴 요청이 없습니다');
    }

    // 유예 기간 확인
    if (deletionRequest.scheduledDeletionAt.toDate() < new Date()) {
      throw new Error('탈퇴 유예 기간이 만료되었습니다');
    }

    // 탈퇴 취소
    await updateDoc(userRef, {
      status: 'active',
      'deletionRequest.status': 'cancelled',
      updatedAt: serverTimestamp(),
    });

    logger.info('회원탈퇴 철회 완료', { userId });
  } catch (error) {
    logger.error('회원탈퇴 철회 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 내 개인정보 조회
 */
export async function getMyData(userId: string): Promise<UserData | null> {
  try {
    logger.info('개인정보 조회', { userId });

    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    const data = userDoc.data();
    return {
      uid: userDoc.id,
      email: data.email,
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      role: data.role,
      createdAt: data.createdAt,
      lastLoginAt: data.lastLoginAt,
    };
  } catch (error) {
    logger.error('개인정보 조회 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 개인정보 수정
 */
export async function updateMyData(
  userId: string,
  updates: Partial<Pick<UserData, 'displayName' | 'phoneNumber'>>
): Promise<void> {
  try {
    logger.info('개인정보 수정', { userId, fields: Object.keys(updates) });

    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    logger.info('개인정보 수정 완료', { userId });
  } catch (error) {
    logger.error('개인정보 수정 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 내 데이터 내보내기 (JSON)
 */
export async function exportMyData(userId: string): Promise<UserDataExport> {
  try {
    logger.info('데이터 내보내기 시작', { userId });

    // 1. 프로필 정보
    const profile = await getMyData(userId);
    if (!profile) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    // 2. 지원 내역
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const applicationsQuery = query(applicationsRef, where('applicantId', '==', userId));
    const applicationsSnapshot = await getDocs(applicationsQuery);

    const applications = applicationsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        jobPostingTitle: data.jobPostingTitle ?? '',
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
      };
    });

    // 3. 근무 기록
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const workLogsQuery = query(workLogsRef, where('staffId', '==', userId));
    const workLogsSnapshot = await getDocs(workLogsQuery);

    const workLogs = workLogsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date ?? '',
        checkInAt: data.checkInTime?.toDate?.()?.toISOString(),
        checkOutAt: data.checkOutTime?.toDate?.()?.toISOString(),
      };
    });

    const exportData: UserDataExport = {
      profile,
      applications,
      workLogs,
      exportedAt: new Date().toISOString(),
    };

    logger.info('데이터 내보내기 완료', {
      userId,
      applicationsCount: applications.length,
      workLogsCount: workLogs.length,
    });

    return exportData;
  } catch (error) {
    logger.error('데이터 내보내기 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 계정 완전 삭제 (Cloud Functions에서 호출)
 * 유예 기간 후 실제 삭제 처리
 *
 * @internal 이 함수는 Cloud Functions에서만 호출해야 합니다
 */
export async function permanentlyDeleteAccount(userId: string): Promise<void> {
  try {
    logger.info('계정 완전 삭제 시작', { userId });

    const batch = writeBatch(getFirebaseDb());

    // 1. 지원 내역 익명화
    const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
    const applicationsQuery = query(applicationsRef, where('applicantId', '==', userId));
    const applicationsSnapshot = await getDocs(applicationsQuery);

    applicationsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        applicantId: '[deleted]',
        applicantName: '[탈퇴한 사용자]',
        applicantPhone: null,
      });
    });

    // 2. 근무 기록 익명화
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const workLogsQuery = query(workLogsRef, where('staffId', '==', userId));
    const workLogsSnapshot = await getDocs(workLogsQuery);

    workLogsSnapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        staffId: '[deleted]',
        staffName: '[탈퇴한 사용자]',
      });
    });

    // 3. 알림 삭제
    const notificationsRef = collection(getFirebaseDb(), NOTIFICATIONS_COLLECTION);
    const notificationsQuery = query(notificationsRef, where('userId', '==', userId));
    const notificationsSnapshot = await getDocs(notificationsQuery);

    notificationsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // 4. 사용자 문서 삭제
    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
    batch.delete(userRef);

    // 배치 실행
    await batch.commit();

    // 5. Firebase Auth 계정 삭제 (이미 로그아웃된 상태일 수 있음)
    // Note: 실제로는 Cloud Functions에서 Admin SDK로 처리해야 함

    logger.info('계정 완전 삭제 완료', { userId });
  } catch (error) {
    logger.error('계정 완전 삭제 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}

/**
 * 탈퇴 상태 확인
 */
export async function getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
  try {
    const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    return (userData.deletionRequest as DeletionRequest) ?? null;
  } catch (error) {
    logger.error('탈퇴 상태 확인 실패', error as Error, { userId });
    throw mapFirebaseError(error);
  }
}
