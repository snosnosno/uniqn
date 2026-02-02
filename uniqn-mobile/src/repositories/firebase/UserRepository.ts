/**
 * UNIQN Mobile - Firebase User Repository
 *
 * @description Firebase Firestore 기반 User Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 사용자 프로필 조회/수정
 * 2. 회원탈퇴 요청/취소/상태 관리
 * 3. 개인정보 내보내기
 * 4. 계정 완전 삭제 (배치 처리)
 */

import {
  doc,
  documentId,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import type { IUserRepository, DeletionRequest, UserDataExport } from '../interfaces';
import type { FirestoreUserProfile, MyDataEditableFields } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const USERS_COLLECTION = 'users';
const APPLICATIONS_COLLECTION = 'applications';
const WORK_LOGS_COLLECTION = 'workLogs';
const NOTIFICATIONS_COLLECTION = 'notifications';

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase User Repository
 */
export class FirebaseUserRepository implements IUserRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(userId: string): Promise<FirestoreUserProfile | null> {
    try {
      logger.info('사용자 조회', { userId });

      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      return userDoc.data() as FirestoreUserProfile;
    } catch (error) {
      logger.error('사용자 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '사용자 조회',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }

  async getByIdBatch(userIds: string[]): Promise<Map<string, FirestoreUserProfile>> {
    try {
      if (userIds.length === 0) {
        return new Map();
      }

      logger.info('사용자 배치 조회', { count: userIds.length });

      const uniqueIds = [...new Set(userIds)];
      const usersRef = collection(getFirebaseDb(), USERS_COLLECTION);
      const profileMap = new Map<string, FirestoreUserProfile>();

      // Firestore whereIn은 최대 30개 제한
      const BATCH_SIZE = 30;
      const chunks: string[][] = [];

      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        chunks.push(uniqueIds.slice(i, i + BATCH_SIZE));
      }

      // 병렬 처리
      const results = await Promise.allSettled(
        chunks.map(async (chunk) => {
          const q = query(usersRef, where(documentId(), 'in', chunk));
          return getDocs(q);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const docSnapshot of result.value.docs) {
            const profile = docSnapshot.data() as FirestoreUserProfile;
            profileMap.set(docSnapshot.id, profile);
          }
        } else {
          logger.warn('사용자 배치 조회 일부 실패', { error: result.reason });
        }
      }

      logger.info('사용자 배치 조회 완료', {
        requested: userIds.length,
        found: profileMap.size,
      });

      return profileMap;
    } catch (error) {
      logger.error('사용자 배치 조회 실패', toError(error), {
        count: userIds.length,
      });
      throw handleServiceError(error, {
        operation: '사용자 배치 조회',
        component: 'UserRepository',
        context: { count: userIds.length },
      });
    }
  }

  async exists(userId: string): Promise<boolean> {
    try {
      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      return userDoc.exists();
    } catch (error) {
      logger.error('사용자 존재 여부 확인 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '사용자 존재 여부 확인',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }

  async getDeletionStatus(userId: string): Promise<DeletionRequest | null> {
    try {
      logger.info('탈퇴 상태 조회', { userId });

      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      return (userData.deletionRequest as DeletionRequest) ?? null;
    } catch (error) {
      logger.error('탈퇴 상태 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '탈퇴 상태 조회',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async updateProfile(userId: string, updates: Partial<MyDataEditableFields>): Promise<void> {
    try {
      logger.info('프로필 업데이트', { userId, fields: Object.keys(updates) });

      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      logger.info('프로필 업데이트 완료', { userId });
    } catch (error) {
      logger.error('프로필 업데이트 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '프로필 업데이트',
        component: 'UserRepository',
        context: { userId, fields: Object.keys(updates) },
      });
    }
  }

  async requestDeletion(userId: string, request: Omit<DeletionRequest, 'userId'>): Promise<void> {
    try {
      logger.info('회원탈퇴 요청 저장', { userId, reason: request.reason });

      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      const deletionRequest: DeletionRequest = {
        userId,
        ...request,
      };

      await updateDoc(userRef, {
        status: 'deactivated',
        deletionRequest,
        updatedAt: serverTimestamp(),
      });

      logger.info('회원탈퇴 요청 저장 완료', {
        userId,
        scheduledDeletionAt: request.scheduledDeletionAt.toDate().toISOString(),
      });
    } catch (error) {
      logger.error('회원탈퇴 요청 저장 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '회원탈퇴 요청 저장',
        component: 'UserRepository',
        context: { userId, reason: request.reason },
      });
    }
  }

  async cancelDeletion(userId: string): Promise<void> {
    try {
      logger.info('회원탈퇴 철회', { userId });

      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
        });
      }

      const userData = userDoc.data();
      const deletionRequest = userData.deletionRequest as DeletionRequest | undefined;

      if (!deletionRequest || deletionRequest.status !== 'pending') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '진행 중인 탈퇴 요청이 없습니다',
        });
      }

      // 유예 기간 확인
      if (deletionRequest.scheduledDeletionAt.toDate() < new Date()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '탈퇴 유예 기간이 만료되었습니다',
        });
      }

      await updateDoc(userRef, {
        status: 'active',
        'deletionRequest.status': 'cancelled',
        updatedAt: serverTimestamp(),
      });

      logger.info('회원탈퇴 철회 완료', { userId });
    } catch (error) {
      if (error instanceof BusinessError) {
        throw error;
      }
      logger.error('회원탈퇴 철회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '회원탈퇴 철회',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }

  // ==========================================================================
  // 데이터 내보내기 / 삭제
  // ==========================================================================

  async getExportData(userId: string): Promise<UserDataExport> {
    try {
      logger.info('데이터 내보내기 조회', { userId });

      // 1. 프로필 정보
      const profile = await this.getById(userId);
      if (!profile) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
        });
      }

      // 2. 지원 내역
      const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
      const applicationsQuery = query(applicationsRef, where('applicantId', '==', userId));
      const applicationsSnapshot = await getDocs(applicationsQuery);

      const applications = applicationsSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          jobPostingTitle: data.jobPostingTitle ?? '',
          status: data.status,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
        };
      });

      // 3. 근무 기록
      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
      const workLogsQuery = query(workLogsRef, where('staffId', '==', userId));
      const workLogsSnapshot = await getDocs(workLogsQuery);

      const workLogs = workLogsSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
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

      logger.info('데이터 내보내기 조회 완료', {
        userId,
        applicationsCount: applications.length,
        workLogsCount: workLogs.length,
      });

      return exportData;
    } catch (error) {
      if (error instanceof BusinessError) {
        throw error;
      }
      logger.error('데이터 내보내기 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '데이터 내보내기 조회',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }

  async permanentlyDeleteWithBatch(userId: string): Promise<void> {
    try {
      logger.info('계정 완전 삭제 (배치)', { userId });

      const batch = writeBatch(getFirebaseDb());

      // 1. 지원 내역 익명화
      const applicationsRef = collection(getFirebaseDb(), APPLICATIONS_COLLECTION);
      const applicationsQuery = query(applicationsRef, where('applicantId', '==', userId));
      const applicationsSnapshot = await getDocs(applicationsQuery);

      applicationsSnapshot.docs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, {
          applicantId: '[deleted]',
          applicantName: '[탈퇴한 사용자]',
          applicantPhone: null,
        });
      });

      // 2. 근무 기록 익명화
      const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
      const workLogsQuery = query(workLogsRef, where('staffId', '==', userId));
      const workLogsSnapshot = await getDocs(workLogsQuery);

      workLogsSnapshot.docs.forEach((docSnapshot) => {
        batch.update(docSnapshot.ref, {
          staffId: '[deleted]',
          staffName: '[탈퇴한 사용자]',
        });
      });

      // 3. 알림 삭제
      const notificationsRef = collection(getFirebaseDb(), NOTIFICATIONS_COLLECTION);
      const notificationsQuery = query(notificationsRef, where('userId', '==', userId));
      const notificationsSnapshot = await getDocs(notificationsQuery);

      notificationsSnapshot.docs.forEach((docSnapshot) => {
        batch.delete(docSnapshot.ref);
      });

      // 4. 사용자 문서 삭제
      const userRef = doc(getFirebaseDb(), USERS_COLLECTION, userId);
      batch.delete(userRef);

      // 배치 실행
      await batch.commit();

      logger.info('계정 완전 삭제 완료', { userId });
    } catch (error) {
      logger.error('계정 완전 삭제 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '계정 완전 삭제',
        component: 'UserRepository',
        context: { userId },
      });
    }
  }
}
