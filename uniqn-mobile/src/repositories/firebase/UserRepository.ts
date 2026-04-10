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
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  writeBatch,
  serverTimestamp,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, ERROR_CODES, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseUserDocument } from '@/schemas';
import type {
  IUserRepository,
  DeletionRequest,
  UserDataExport,
  EmployerRegistrationInput,
} from '../interfaces';
import type { FirestoreUserProfile, MyDataEditableFields } from '@/types';
import { COLLECTIONS, FIELDS, FIREBASE_LIMITS, STATUS } from '@/constants';
import { toDate } from '@/utils/date';
import { TimeNormalizer } from '@/shared/time';

// ============================================================================
// Repository Implementation
// ============================================================================

const LEGACY_DELETION_REQUESTS_SUBCOLLECTION = 'deletionRequests';

function findPreferredLegacyDeletionRequest(requests: DeletionRequest[]): DeletionRequest | null {
  return (
    requests.find((request) => request.status === STATUS.DELETION_REQUEST.PENDING) ??
    requests[0] ??
    null
  );
}

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

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      const data = userDoc.data() as FirestoreUserProfile;
      const parsed = parseUserDocument(data);
      if (!parsed) {
        logger.warn('사용자 문서 파싱 실패', { userId });
        return null;
      }
      return parsed;
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
      const usersRef = collection(getFirebaseDb(), COLLECTIONS.USERS);
      const profileMap = new Map<string, FirestoreUserProfile>();

      // Firestore whereIn은 최대 30개 제한
      const BATCH_SIZE = FIREBASE_LIMITS.WHERE_IN_MAX_ITEMS;
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
            const data = docSnapshot.data() as FirestoreUserProfile;
            const parsed = parseUserDocument(data);
            if (!parsed) {
              logger.warn('사용자 문서 파싱 실패', { userId: docSnapshot.id });
              continue;
            }
            profileMap.set(docSnapshot.id, parsed);
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
      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
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

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return null;
      }

      const userData = userDoc.data();
      const inlineDeletionRequest = (userData.deletionRequest as DeletionRequest) ?? null;
      if (inlineDeletionRequest) {
        return inlineDeletionRequest;
      }

      const legacyRequestsSnapshot = await getDocs(
        collection(
          getFirebaseDb(),
          COLLECTIONS.USERS,
          userId,
          LEGACY_DELETION_REQUESTS_SUBCOLLECTION
        )
      );
      const legacyDeletionRequests = legacyRequestsSnapshot.docs.map(
        (docSnapshot) => docSnapshot.data() as DeletionRequest
      );

      return findPreferredLegacyDeletionRequest(legacyDeletionRequests);
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

  async createOrMerge(userId: string, profile: Record<string, unknown>): Promise<void> {
    try {
      logger.info('사용자 문서 생성/병합', { userId, fields: Object.keys(profile) });

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      await setDoc(userRef, profile, { merge: true });

      logger.info('사용자 문서 생성/병합 완료', { userId });
    } catch (error) {
      logger.error('사용자 문서 생성/병합 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '사용자 문서 생성/병합',
        component: 'UserRepository',
        context: { userId, fields: Object.keys(profile) },
      });
    }
  }

  async updateFields(userId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      logger.info('사용자 필드 업데이트', { userId, fields: Object.keys(updates) });

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      logger.info('사용자 필드 업데이트 완료', { userId });
    } catch (error) {
      logger.error('사용자 필드 업데이트 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '사용자 필드 업데이트',
        component: 'UserRepository',
        context: { userId, fields: Object.keys(updates) },
      });
    }
  }

  async updateProfile(userId: string, updates: Partial<MyDataEditableFields>): Promise<void> {
    try {
      logger.info('프로필 업데이트', { userId, fields: Object.keys(updates) });

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
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

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
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
        scheduledDeletionAt: toDate(request.scheduledDeletionAt)?.toISOString() ?? null,
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

      const userRef = doc(getFirebaseDb(), COLLECTIONS.USERS, userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
        });
      }

      const userData = userDoc.data();
      const deletionRequest = userData.deletionRequest as DeletionRequest | undefined;
      const legacyRequestsSnapshot = await getDocs(
        collection(
          getFirebaseDb(),
          COLLECTIONS.USERS,
          userId,
          LEGACY_DELETION_REQUESTS_SUBCOLLECTION
        )
      );
      const pendingLegacyDeletionDocs = legacyRequestsSnapshot.docs.filter((docSnapshot) => {
        const legacyDeletionRequest = docSnapshot.data() as Partial<DeletionRequest>;
        return legacyDeletionRequest.status === STATUS.DELETION_REQUEST.PENDING;
      });
      const effectiveDeletionRequest =
        deletionRequest ??
        (pendingLegacyDeletionDocs[0]?.data() as DeletionRequest | undefined) ??
        undefined;

      if (
        !effectiveDeletionRequest ||
        effectiveDeletionRequest.status !== STATUS.DELETION_REQUEST.PENDING
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '진행 중인 탈퇴 요청이 없습니다',
        });
      }

      // 유예 기간 확인
      const scheduledDeletionAt = toDate(effectiveDeletionRequest.scheduledDeletionAt);
      if (!scheduledDeletionAt || scheduledDeletionAt < new Date()) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '탈퇴 유예 기간이 만료되었습니다',
        });
      }

      await updateDoc(userRef, {
        status: 'active',
        deletionRequest: {
          ...effectiveDeletionRequest,
          status: STATUS.DELETION_REQUEST.CANCELLED,
        },
        updatedAt: serverTimestamp(),
      });

      for (
        let i = 0;
        i < pendingLegacyDeletionDocs.length;
        i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS
      ) {
        const batch = writeBatch(getFirebaseDb());
        const batchDocs = pendingLegacyDeletionDocs.slice(
          i,
          i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS
        );

        batchDocs.forEach((docSnapshot) => {
          batch.update(docSnapshot.ref, {
            status: STATUS.DELETION_REQUEST.CANCELLED,
          });
        });

        await batch.commit();
      }

      logger.info('회원탈퇴 철회 완료', { userId });
    } catch (error) {
      if (isAppError(error)) {
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
  // 특수 작업 (Transaction)
  // ==========================================================================

  async markAsOrphan(
    uid: string,
    reason: string,
    _phone?: string,
    platform?: string
  ): Promise<void> {
    try {
      const db = getFirebaseDb();
      await setDoc(doc(db, 'orphanAccounts', uid), {
        uid,
        reason,
        createdAt: serverTimestamp(),
        platform: platform || null,
      });
      logger.warn('고아 계정 마킹 완료 (수동 정리 필요)', { uid, reason });
    } catch (error) {
      logger.error('고아 계정 마킹 실패', toError(error), { uid, reason });
      // 마킹 실패는 throw하지 않음 (원래 동작 유지)
    }
  }

  async registerAsEmployer(
    userId: string,
    input: EmployerRegistrationInput
  ): Promise<FirestoreUserProfile> {
    try {
      const db = getFirebaseDb();
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      const consentRef = doc(db, COLLECTIONS.USERS, userId, 'consents', 'employer_registration');

      // Transaction으로 원자적 처리 (Race Condition 방지)
      const updatedProfile = await runTransaction(db, async (transaction) => {
        // 1. 현재 프로필 조회 (Transaction 내에서)
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '사용자 정보를 찾을 수 없습니다',
          });
        }

        const profile = userDoc.data() as FirestoreUserProfile;

        // 2. 이미 구인자인 경우
        if (profile.role === 'employer' || profile.role === 'admin') {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 구인자로 등록되어 있습니다',
          });
        }

        // 3. 전화번호 인증 확인
        if (!profile.phoneVerified) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '전화번호 인증을 먼저 완료해주세요',
          });
        }

        // 4. Firestore 업데이트
        const now = serverTimestamp();
        const updateData = {
          role: 'employer' as const,
          employerAgreements: {
            termsAgreedAt: now,
            termsVersion: input.termsVersion,
            liabilityWaiverAgreedAt: now,
            liabilityWaiverVersion: input.liabilityWaiverVersion,
          },
          employerRegisteredAt: now,
          updatedAt: now,
        };

        transaction.update(userRef, updateData);
        transaction.set(consentRef, {
          kind: 'employer_registration',
          userId,
          agreedAt: now,
          terms: {
            agreed: true,
            version: input.termsVersion,
            agreedAt: now,
          },
          liabilityWaiver: {
            agreed: true,
            version: input.liabilityWaiverVersion,
            agreedAt: now,
          },
        });

        // 5. 업데이트된 프로필 반환 (serverTimestamp는 실제 값으로 대체)
        const timestamp = Timestamp.now();
        return {
          ...profile,
          role: 'employer' as const,
          employerAgreements: {
            termsAgreedAt: timestamp,
            termsVersion: input.termsVersion,
            liabilityWaiverAgreedAt: timestamp,
            liabilityWaiverVersion: input.liabilityWaiverVersion,
          },
          employerRegisteredAt: timestamp,
          updatedAt: timestamp,
        } as unknown as FirestoreUserProfile;
      });

      return updatedProfile;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      throw handleServiceError(error, {
        operation: '구인자 등록 (Transaction)',
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
      const applicationsRef = collection(getFirebaseDb(), COLLECTIONS.APPLICATIONS);
      const applicationsQuery = query(
        applicationsRef,
        where(FIELDS.APPLICATION.applicantId, '==', userId)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);

      const applications = applicationsSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          jobPostingTitle: data.jobPostingTitle ?? '',
          status: data.status,
          createdAt: toDate(data.createdAt)?.toISOString() ?? '',
        };
      });

      // 3. 근무 기록
      const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);
      const workLogsQuery = query(workLogsRef, where(FIELDS.WORK_LOG.staffId, '==', userId));
      const workLogsSnapshot = await getDocs(workLogsQuery);

      const workLogs = workLogsSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          date: data.date ?? '',
          checkInAt: TimeNormalizer.parseTime(data.checkInTime)?.toISOString(),
          checkOutAt: TimeNormalizer.parseTime(data.checkOutTime)?.toISOString(),
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
      if (isAppError(error)) {
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

      const db = getFirebaseDb();
      const operationQueue: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];

      // 1. 지원 내역 익명화
      const applicationsRef = collection(db, COLLECTIONS.APPLICATIONS);
      const applicationsQuery = query(
        applicationsRef,
        where(FIELDS.APPLICATION.applicantId, '==', userId)
      );
      const applicationsSnapshot = await getDocs(applicationsQuery);

      applicationsSnapshot.docs.forEach((docSnapshot) => {
        operationQueue.push((batch) => {
          batch.update(docSnapshot.ref, {
            applicantId: '[deleted]',
            applicantName: '[탈퇴한 사용자]',
            applicantPhone: null,
          });
        });
      });

      // 2. 근무 기록 익명화
      const workLogsRef = collection(db, COLLECTIONS.WORK_LOGS);
      const workLogsQuery = query(workLogsRef, where(FIELDS.WORK_LOG.staffId, '==', userId));
      const workLogsSnapshot = await getDocs(workLogsQuery);

      workLogsSnapshot.docs.forEach((docSnapshot) => {
        operationQueue.push((batch) => {
          batch.update(docSnapshot.ref, {
            staffId: '[deleted]',
            staffName: '[탈퇴한 사용자]',
          });
        });
      });

      // 3. 알림 삭제
      const notificationsRef = collection(db, COLLECTIONS.NOTIFICATIONS);
      const notificationsQuery = query(
        notificationsRef,
        where(FIELDS.NOTIFICATION.recipientId, '==', userId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);

      notificationsSnapshot.docs.forEach((docSnapshot) => {
        operationQueue.push((batch) => {
          batch.delete(docSnapshot.ref);
        });
      });

      // 4. 사용자 하위 문서 삭제
      const userSubcollections = ['consents', 'notificationSettings', 'counters'] as const;
      for (const subcollectionName of userSubcollections) {
        const subcollectionSnapshot = await getDocs(
          collection(db, COLLECTIONS.USERS, userId, subcollectionName)
        );

        subcollectionSnapshot.docs.forEach((docSnapshot) => {
          operationQueue.push((batch) => {
            batch.delete(docSnapshot.ref);
          });
        });
      }

      // 5. 사용자 문서 삭제
      const userRef = doc(db, COLLECTIONS.USERS, userId);
      operationQueue.push((batch) => {
        batch.delete(userRef);
      });

      // Firestore 배치 한도(500)를 넘지 않도록 청크 단위로 커밋
      let committedBatchCount = 0;
      for (let i = 0; i < operationQueue.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
        const batch = writeBatch(db);
        const batchOperations = operationQueue.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS);

        batchOperations.forEach((operation) => operation(batch));
        await batch.commit();
        committedBatchCount++;
      }

      logger.info('계정 완전 삭제 완료', {
        userId,
        operations: operationQueue.length,
        committedBatchCount,
      });
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
