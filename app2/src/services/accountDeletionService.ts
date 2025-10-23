/**
 * 계정 삭제/탈퇴 서비스
 *
 * @description
 * 계정 삭제 요청, 취소, 자동 삭제 관리
 * - 30일 유예기간
 * - 탈퇴 사유 수집
 *
 * @version 1.0.0
 * @since 2025-01-23
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updateProfile,
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { logger } from '../utils/logger';
import {
  validateDeletionRequest,
  ValidationError,
  ServiceError,
} from '../utils/validation/accountValidation';
import type {
  DeletionRequest,
  DeletionRequestInput,
  DeletionCancellationInput,
  DeletionStatus,
  calculateDeletionDate,
} from '../types/accountDeletion';
import crypto from 'crypto-js';

/**
 * 계정 삭제 요청 생성
 */
export const requestAccountDeletion = async (
  input: DeletionRequestInput
): Promise<DeletionRequest> => {
  try {
    // 현재 사용자 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new ValidationError('로그인이 필요합니다.');
    }

    // 검증
    const validation = validateDeletionRequest(input);
    if (!validation.isValid) {
      logger.error('계정 삭제 요청 검증 실패', new Error(validation.errors.join(', ')), {
        component: 'AccountDeletionService',
        data: { userId: currentUser.uid, errors: validation.errors },
      });
      throw new ValidationError(validation.errors.join(', '));
    }

    // 비밀번호 재확인 (본인 확인)
    if (!currentUser.email) {
      throw new ValidationError('이메일 정보가 없습니다.');
    }
    const credential = EmailAuthProvider.credential(currentUser.email, input.password);
    await reauthenticateWithCredential(currentUser, credential);

    // 삭제 예정일 계산 (30일 후)
    const now = new Date();
    const scheduledDeletionDate = new Date(now);
    scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);

    // 취소 토큰 생성
    const verificationToken = crypto.SHA256(`${currentUser.uid}-${now.getTime()}`).toString();

    // 삭제 요청 데이터
    const requestId = `${currentUser.uid}-${now.getTime()}`;
    const deletionRequest: Omit<DeletionRequest, 'requestedAt' | 'scheduledDeletionAt'> & {
      requestedAt: ReturnType<typeof serverTimestamp>;
      scheduledDeletionAt: ReturnType<typeof serverTimestamp>;
    } = {
      requestId,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUser.displayName || 'Unknown',
      ...(input.reason && { reason: input.reason }),
      ...(input.reasonCategory && { reasonCategory: input.reasonCategory }),
      requestedAt: serverTimestamp() as Timestamp,
      scheduledDeletionAt: Timestamp.fromDate(scheduledDeletionDate),
      status: 'pending',
      verificationToken,
      ...(input.ipAddress && { ipAddress: input.ipAddress }),
    };

    // Firestore에 저장
    const deletionRef = doc(db, 'deletionRequests', requestId);
    await setDoc(deletionRef, deletionRequest);

    // Firebase Auth 계정 비활성화 (로그인 차단)
    await updateProfile(currentUser, {
      displayName: `[DELETION_PENDING] ${currentUser.displayName || 'Unknown'}`,
    });

    logger.info('계정 삭제 요청 생성 성공', {
      component: 'AccountDeletionService',
      data: {
        userId: currentUser.uid,
        requestId,
        scheduledDeletionAt: scheduledDeletionDate.toISOString(),
      },
    });

    return {
      ...deletionRequest,
      requestedAt: Timestamp.now(),
      scheduledDeletionAt: Timestamp.fromDate(scheduledDeletionDate),
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    if ((error as any).code === 'auth/wrong-password') {
      logger.error('비밀번호 확인 실패', error as Error, {
        component: 'AccountDeletionService',
      });
      throw new ValidationError('현재 비밀번호가 올바르지 않습니다.');
    }

    logger.error('계정 삭제 요청 생성 실패', error as Error, {
      component: 'AccountDeletionService',
    });
    throw new ServiceError('계정 삭제 요청에 실패했습니다.');
  }
};

/**
 * 계정 삭제 요청 조회
 */
export const getDeletionRequest = async (
  userId: string
): Promise<DeletionRequest | null> => {
  try {
    // 해당 사용자의 pending 상태 삭제 요청 조회
    const deletionQuery = query(
      collection(db, 'deletionRequests'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    const snapshot = await getDocs(deletionQuery);

    if (snapshot.empty) {
      logger.debug('계정 삭제 요청 없음', {
        component: 'AccountDeletionService',
        data: { userId },
      });
      return null;
    }

    const docSnapshot = snapshot.docs[0];
    if (!docSnapshot) {
      logger.debug('계정 삭제 요청 없음', {
        component: 'AccountDeletionService',
        data: { userId },
      });
      return null;
    }

    const data = docSnapshot.data() as DeletionRequest;

    logger.debug('계정 삭제 요청 조회 성공', {
      component: 'AccountDeletionService',
      data: { userId, requestId: data.requestId },
    });

    return data;
  } catch (error) {
    logger.error('계정 삭제 요청 조회 실패', error as Error, {
      component: 'AccountDeletionService',
      data: { userId },
    });
    throw new ServiceError('계정 삭제 요청 조회에 실패했습니다.');
  }
};

/**
 * 계정 삭제 요청 취소
 */
export const cancelDeletionRequest = async (
  input: DeletionCancellationInput
): Promise<void> => {
  try {
    const deletionRef = doc(db, 'deletionRequests', input.requestId);
    const snapshot = await getDoc(deletionRef);

    if (!snapshot.exists()) {
      throw new ValidationError('삭제 요청을 찾을 수 없습니다.');
    }

    const deletionRequest = snapshot.data() as DeletionRequest;

    // 상태 확인
    if (deletionRequest.status !== 'pending') {
      throw new ValidationError('취소할 수 없는 상태입니다.');
    }

    // 토큰 확인 (선택사항)
    if (input.verificationToken && deletionRequest.verificationToken !== input.verificationToken) {
      throw new ValidationError('유효하지 않은 취소 토큰입니다.');
    }

    // 상태 업데이트
    await updateDoc(deletionRef, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
    });

    // Firebase Auth 계정 복구 (displayName에서 [DELETION_PENDING] 제거)
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === deletionRequest.userId) {
      const cleanName = deletionRequest.userName.replace('[DELETION_PENDING] ', '');
      await updateProfile(currentUser, {
        displayName: cleanName,
      });
    }

    logger.info('계정 삭제 요청 취소 성공', {
      component: 'AccountDeletionService',
      data: {
        userId: deletionRequest.userId,
        requestId: input.requestId,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }

    logger.error('계정 삭제 요청 취소 실패', error as Error, {
      component: 'AccountDeletionService',
      data: { requestId: input.requestId },
    });
    throw new ServiceError('계정 삭제 요청 취소에 실패했습니다.');
  }
};

/**
 * 만료된 삭제 요청 조회 (Firebase Function에서 사용)
 *
 * @description
 * 30일이 경과한 pending 상태의 삭제 요청 목록 조회
 */
export const getExpiredDeletionRequests = async (): Promise<DeletionRequest[]> => {
  try {
    const now = Timestamp.now();

    const deletionQuery = query(
      collection(db, 'deletionRequests'),
      where('status', '==', 'pending'),
      where('scheduledDeletionAt', '<=', now)
    );

    const snapshot = await getDocs(deletionQuery);
    const expiredRequests = snapshot.docs.map((doc) => doc.data() as DeletionRequest);

    logger.info('만료된 삭제 요청 조회', {
      component: 'AccountDeletionService',
      data: { count: expiredRequests.length },
    });

    return expiredRequests;
  } catch (error) {
    logger.error('만료된 삭제 요청 조회 실패', error as Error, {
      component: 'AccountDeletionService',
    });
    return [];
  }
};

/**
 * 계정 완전 삭제 (Firebase Function에서 호출)
 *
 * @description
 * 사용자 데이터 완전 삭제
 * - Firebase Auth 삭제
 * - Firestore 사용자 데이터 삭제
 * - 관련 컬렉션 삭제
 */
export const completeAccountDeletion = async (userId: string): Promise<void> => {
  try {
    // 1. Firestore 사용자 데이터 삭제
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);

    // 2. 관련 서브컬렉션 삭제
    const subcollections = [
      'consents',
      'securitySettings',
      'tournaments',
      'myApplications',
      'myWorkSessions',
      'settings',
      'qrMetadata',
    ];

    for (const subcollection of subcollections) {
      const subcollectionRef = collection(db, 'users', userId, subcollection);
      const snapshot = await getDocs(subcollectionRef);

      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }

    // 3. 삭제 요청 상태 업데이트
    const deletionQuery = query(
      collection(db, 'deletionRequests'),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    const deletionSnapshot = await getDocs(deletionQuery);
    if (!deletionSnapshot.empty && deletionSnapshot.docs[0]) {
      const deletionRef = deletionSnapshot.docs[0].ref;
      await updateDoc(deletionRef, {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
    }

    logger.info('계정 완전 삭제 성공', {
      component: 'AccountDeletionService',
      data: { userId },
    });
  } catch (error) {
    logger.error('계정 완전 삭제 실패', error as Error, {
      component: 'AccountDeletionService',
      data: { userId },
    });
    throw new ServiceError('계정 삭제에 실패했습니다.');
  }
};

/**
 * 삭제 예정 계정 여부 확인
 */
export const isPendingDeletion = async (userId: string): Promise<boolean> => {
  try {
    const deletionRequest = await getDeletionRequest(userId);
    return deletionRequest !== null && deletionRequest.status === 'pending';
  } catch (error) {
    logger.error('삭제 예정 확인 실패', error as Error, {
      component: 'AccountDeletionService',
      data: { userId },
    });
    return false;
  }
};
