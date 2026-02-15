/**
 * UNIQN Mobile - Firebase JobPosting Repository
 *
 * @description Firebase Firestore 기반 JobPosting Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 문서 파싱 및 타입 변환
 * 3. 기본적인 CRUD 연산 캡슐화
 *
 * 비즈니스 로직:
 * - 공고 생성/수정 → jobManagementService
 * - 필터링/검색 → jobService
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  updateDoc,
  increment,
  serverTimestamp,
  runTransaction,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, BusinessError, PermissionError, ERROR_CODES, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseJobPostingDocument, parseJobPostingDocuments } from '@/schemas';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import { COLLECTIONS, FIELDS, FIREBASE_LIMITS, STATUS } from '@/constants';
import type {
  IJobPostingRepository,
  PaginatedJobPostings,
  PostingTypeCounts,
  CreateJobPostingContext,
  CreateJobPostingResult,
  JobPostingStats,
} from '../interfaces';
import type {
  JobPosting,
  JobPostingFilters,
  JobPostingStatus,
  CreateJobPostingInput,
  UpdateJobPostingInput,
  TournamentApprovalStatus,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase JobPosting Repository
 */
export class FirebaseJobPostingRepository implements IJobPostingRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(jobPostingId: string): Promise<JobPosting | null> {
    try {
      logger.info('공고 상세 조회', { jobPostingId });

      const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const jobPosting = parseJobPostingDocument({
        id: docSnap.id,
        ...docSnap.data(),
      });

      if (!jobPosting) {
        logger.warn('공고 데이터 파싱 실패', { jobPostingId });
        return null;
      }

      return jobPosting;
    } catch (error) {
      logger.error('공고 상세 조회 실패', toError(error), { jobPostingId });
      throw handleServiceError(error, {
        operation: '공고 상세 조회',
        component: 'JobPostingRepository',
        context: { jobPostingId },
      });
    }
  }

  async getByIdBatch(jobPostingIds: string[]): Promise<JobPosting[]> {
    try {
      if (jobPostingIds.length === 0) {
        return [];
      }

      logger.info('공고 배치 조회', { count: jobPostingIds.length });

      const uniqueIds = [...new Set(jobPostingIds)];
      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const items: JobPosting[] = [];

      // Firestore whereIn은 최대 30개 제한
      const BATCH_SIZE = 30;
      const chunks: string[][] = [];

      for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        chunks.push(uniqueIds.slice(i, i + BATCH_SIZE));
      }

      // 병렬 처리
      const results = await Promise.allSettled(
        chunks.map(async (chunk) => {
          const q = query(jobPostingsRef, where(documentId(), 'in', chunk));
          return getDocs(q);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          for (const docSnapshot of result.value.docs) {
            const jobPosting = parseJobPostingDocument({
              id: docSnapshot.id,
              ...docSnapshot.data(),
            });

            if (jobPosting) {
              items.push(jobPosting);
            }
          }
        } else {
          logger.warn('공고 배치 조회 일부 실패', { error: result.reason });
        }
      }

      logger.info('공고 배치 조회 완료', {
        requested: jobPostingIds.length,
        found: items.length,
      });

      return items;
    } catch (error) {
      logger.error('공고 배치 조회 실패', toError(error), {
        count: jobPostingIds.length,
      });
      throw handleServiceError(error, {
        operation: '공고 배치 조회',
        component: 'JobPostingRepository',
        context: { count: jobPostingIds.length },
      });
    }
  }

  async getList(
    filters?: JobPostingFilters,
    pageSize: number = DEFAULT_PAGE_SIZE,
    lastDocument?: QueryDocumentSnapshot<DocumentData>
  ): Promise<PaginatedJobPostings> {
    try {
      logger.info('공고 목록 조회', { filters, pageSize });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);

      // QueryBuilder로 쿼리 구성
      const qb = new QueryBuilder(jobPostingsRef)
        // 기본 필터: status
        .whereEqual(FIELDS.JOB_POSTING.status, filters?.status || STATUS.JOB_POSTING.ACTIVE)
        // 역할 필터 (최대 10개)
        .whereArrayContainsAny('roles', filters?.roles?.slice(0, 10))
        // 지역 필터
        .whereIf(!!filters?.district, FIELDS.JOB_POSTING.locationDistrict, '==', filters?.district)
        // 긴급 공고 필터
        .whereIf(
          filters?.isUrgent !== undefined,
          FIELDS.JOB_POSTING.isUrgent,
          '==',
          filters?.isUrgent
        )
        // 구인자 필터 (내 공고)
        .whereIf(!!filters?.ownerId, FIELDS.JOB_POSTING.ownerId, '==', filters?.ownerId)
        // 날짜 범위 필터
        .whereDateRange(FIELDS.JOB_POSTING.workDate, filters?.dateRange);

      // 공고 타입 필터
      if (filters?.postingType === 'tournament') {
        // 대회 공고는 승인된(approved) 것만 일반 목록에 노출
        qb.whereEqual(FIELDS.JOB_POSTING.postingType, 'tournament');
        qb.whereEqual(FIELDS.JOB_POSTING.tournamentApprovalStatus, STATUS.TOURNAMENT.APPROVED);
      } else if (filters?.postingType) {
        qb.whereEqual(FIELDS.JOB_POSTING.postingType, filters.postingType);
      }

      // 단일 날짜 필터 (workDates 배열에서 array-contains 쿼리)
      qb.whereIf(
        !!filters?.workDate && !filters?.dateRange,
        'workDates',
        'array-contains',
        filters?.workDate
      );

      // 정렬 및 페이지네이션
      const q = qb
        .orderByDesc(FIELDS.JOB_POSTING.workDate)
        .orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
        .paginate(pageSize, lastDocument)
        .build();

      const snapshot = await getDocs(q);

      const items: JobPosting[] = [];
      let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
      let hasMore = false;

      snapshot.docs.forEach((docSnapshot, index) => {
        // 마지막 요소는 hasMore 확인용
        if (index === pageSize) {
          hasMore = true;
          return;
        }

        const jobPosting = parseJobPostingDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (jobPosting) {
          items.push(jobPosting);
          lastDoc = docSnapshot;
        }
      });

      logger.info('공고 목록 조회 완료', {
        count: items.length,
        hasMore,
      });

      return { items, lastDoc, hasMore };
    } catch (error) {
      logger.error('공고 목록 조회 실패', toError(error), { filters });
      throw handleServiceError(error, {
        operation: '공고 목록 조회',
        component: 'JobPostingRepository',
        context: { filters },
      });
    }
  }

  async getByOwnerId(ownerId: string, status?: JobPostingStatus): Promise<JobPosting[]> {
    try {
      logger.info('소유자별 공고 조회', { ownerId, status });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);

      let builder = new QueryBuilder(jobPostingsRef).whereEqual(
        FIELDS.JOB_POSTING.ownerId,
        ownerId
      );

      if (status) {
        builder = builder.whereEqual(FIELDS.JOB_POSTING.status, status);
      }

      const q = builder.orderByDesc(FIELDS.JOB_POSTING.createdAt).build();
      const snapshot = await getDocs(q);

      const items: JobPosting[] = [];

      for (const docSnapshot of snapshot.docs) {
        const jobPosting = parseJobPostingDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (jobPosting) {
          items.push(jobPosting);
        }
      }

      logger.info('소유자별 공고 조회 완료', {
        ownerId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('소유자별 공고 조회 실패', toError(error), { ownerId });
      throw handleServiceError(error, {
        operation: '소유자별 공고 조회',
        component: 'JobPostingRepository',
        context: { ownerId, status },
      });
    }
  }

  async getTypeCounts(filters?: Pick<JobPostingFilters, 'status'>): Promise<PostingTypeCounts> {
    try {
      logger.info('공고 타입별 개수 조회', { filters });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const status = filters?.status ?? STATUS.JOB_POSTING.ACTIVE;

      const q = query(jobPostingsRef, where(FIELDS.JOB_POSTING.status, '==', status));

      const snapshot = await getDocs(q);

      const counts: PostingTypeCounts = {
        regular: 0,
        urgent: 0,
        fixed: 0,
        tournament: 0,
        total: 0,
      };

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const postingType = data.postingType as string;

        // 대회공고는 승인된 것만 카운팅
        if (postingType === 'tournament') {
          if (data.tournamentConfig?.approvalStatus === STATUS.TOURNAMENT.APPROVED) {
            counts.tournament++;
            counts.total++;
          }
          continue;
        }

        counts.total++;

        switch (postingType) {
          case 'regular':
            counts.regular++;
            break;
          case 'urgent':
            counts.urgent++;
            break;
          case 'fixed':
            counts.fixed++;
            break;
        }
      }

      logger.info('공고 타입별 개수 조회 완료', { counts });

      return counts;
    } catch (error) {
      logger.error('공고 타입별 개수 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '공고 타입별 개수 조회',
        component: 'JobPostingRepository',
        context: { filters },
      });
    }
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async incrementViewCount(jobPostingId: string): Promise<void> {
    try {
      const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

      await updateDoc(docRef, {
        viewCount: increment(1),
      });

      logger.debug('조회수 증가', { jobPostingId });
    } catch (error) {
      // 조회수 증가 실패는 무시 (사용자 경험에 영향 없음)
      logger.warn('조회수 증가 실패', { jobPostingId, error: toError(error) });
    }
  }

  async updateStatus(jobPostingId: string, status: JobPostingStatus): Promise<void> {
    try {
      logger.info('공고 상태 변경', { jobPostingId, status });

      const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);

      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp(),
      });

      logger.info('공고 상태 변경 완료', { jobPostingId, status });
    } catch (error) {
      logger.error('공고 상태 변경 실패', toError(error), {
        jobPostingId,
        status,
      });
      throw handleServiceError(error, {
        operation: '공고 상태 변경',
        component: 'JobPostingRepository',
        context: { jobPostingId, status },
      });
    }
  }

  // ==========================================================================
  // 트랜잭션 (Write - Transaction)
  // ==========================================================================

  async createWithTransaction(
    input: CreateJobPostingInput,
    context: CreateJobPostingContext
  ): Promise<CreateJobPostingResult> {
    try {
      logger.info('공고 생성 (트랜잭션)', {
        ownerId: context.ownerId,
        title: input.title,
      });

      const jobsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const newDocRef = doc(jobsRef);
      const now = serverTimestamp();

      // startTime은 string이므로 분리 (JobPosting.startTime은 Timestamp)
      const { startTime: inputStartTime, ...restInput } = input;

      // 서비스 레이어에서 변환된 roles 사용 (roles는 RoleRequirement[] 형태로 전달됨)
      const totalPositions = restInput.roles.reduce((sum, role) => sum + role.count, 0);

      // dateSpecificRequirements에서 날짜만 추출 (array-contains 쿼리용)
      const workDates = (restInput.dateSpecificRequirements ?? [])
        .map((req) => {
          if (typeof req.date === 'string') return req.date;
          if (req.date && 'toDate' in req.date) {
            return (req.date as Timestamp).toDate().toISOString().split('T')[0] ?? '';
          }
          if (req.date && 'seconds' in req.date) {
            return (
              new Date((req.date as { seconds: number }).seconds * 1000)
                .toISOString()
                .split('T')[0] ?? ''
            );
          }
          return '';
        })
        .filter(Boolean);

      // undefined 필드 제거
      const removeUndefined = <T extends Record<string, unknown>>(obj: T): T => {
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => {
              if (v && typeof v === 'object' && !Array.isArray(v)) {
                return [k, removeUndefined(v as Record<string, unknown>)];
              }
              return [k, v];
            })
        ) as T;
      };

      // Note: roles는 서비스 레이어에서 RoleRequirement[] 형태로 변환되어 전달됨
      const jobPostingData = removeUndefined({
        ...restInput,
        roles: restInput.roles as JobPosting['roles'],
        status: STATUS.JOB_POSTING.ACTIVE,
        ownerId: context.ownerId,
        ownerName: context.ownerName,
        createdBy: context.ownerId,
        description: restInput.description || '',
        postingType: restInput.postingType || 'regular',
        totalPositions,
        filledPositions: 0,
        viewCount: 0,
        applicationCount: 0,
        workDate: restInput.workDate || '',
        timeSlot: restInput.timeSlot || (inputStartTime ? `${inputStartTime}~` : ''),
        workDates: workDates.length > 0 ? workDates : undefined,
        // 대회공고 승인 대기
        ...(input.postingType === 'tournament' && {
          tournamentConfig: {
            approvalStatus: STATUS.TOURNAMENT.PENDING,
            submittedAt: now as Timestamp,
          },
        }),
        // 고정공고 게시 기간
        ...(input.postingType === 'fixed' && {
          fixedConfig: {
            durationDays: 7 as const,
            createdAt: Timestamp.now(),
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          },
        }),
        createdAt: now as Timestamp,
        updatedAt: now as Timestamp,
      });

      await setDoc(newDocRef, jobPostingData);

      const jobPosting: JobPosting = {
        id: newDocRef.id,
        ...jobPostingData,
      };

      logger.info('공고 생성 완료', { id: newDocRef.id });

      return { id: newDocRef.id, jobPosting };
    } catch (error) {
      logger.error('공고 생성 실패', toError(error), {
        ownerId: context.ownerId,
      });
      throw handleServiceError(error, {
        operation: '공고 생성',
        component: 'JobPostingRepository',
        context: { ownerId: context.ownerId },
      });
    }
  }

  async updateWithTransaction(
    jobPostingId: string,
    input: UpdateJobPostingInput,
    ownerId: string
  ): Promise<JobPosting> {
    try {
      logger.info('공고 수정 (트랜잭션)', { jobPostingId, ownerId });

      const result = await runTransaction(getFirebaseDb(), async (transaction) => {
        const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 공고입니다',
          });
        }

        const currentData = parseJobPostingDocument({
          id: jobDoc.id,
          ...jobDoc.data(),
        });
        if (!currentData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '공고 데이터가 올바르지 않습니다',
          });
        }

        // 본인 확인
        if (currentData.ownerId !== ownerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 수정할 수 있습니다',
          });
        }

        // 확정된 지원자가 있는 경우 일정/역할 수정 불가
        const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
        if (hasConfirmedApplicants) {
          if (input.workDate || input.timeSlot || input.roles) {
            throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
              userMessage: '확정된 지원자가 있는 경우 일정 및 역할을 수정할 수 없습니다',
            });
          }
        }

        // 총 모집 인원 재계산 (역할이 변경된 경우)
        let totalPositions = currentData.totalPositions;
        if (input.roles) {
          totalPositions = input.roles.reduce((sum, role) => sum + role.count, 0);
        }

        // undefined 필드 제거
        const removeUndefined = <T extends Record<string, unknown>>(obj: T): T => {
          return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
        };

        const updateData = removeUndefined({
          ...input,
          totalPositions,
          updatedAt: serverTimestamp(),
        });

        transaction.update(jobRef, updateData);

        return {
          ...currentData,
          ...updateData,
          id: jobPostingId,
        } as JobPosting;
      });

      logger.info('공고 수정 완료', { jobPostingId });

      return result;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('공고 수정 실패', toError(error), { jobPostingId });
      throw handleServiceError(error, {
        operation: '공고 수정',
        component: 'JobPostingRepository',
        context: { jobPostingId },
      });
    }
  }

  async deleteWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 삭제 (트랜잭션)', { jobPostingId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 공고입니다',
          });
        }

        const currentData = parseJobPostingDocument({
          id: jobDoc.id,
          ...jobDoc.data(),
        });
        if (!currentData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '공고 데이터가 올바르지 않습니다',
          });
        }

        // 본인 확인
        if (currentData.ownerId !== ownerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 삭제할 수 있습니다',
          });
        }

        // 확정된 지원자가 있는 경우 삭제 불가
        const hasConfirmedApplicants = (currentData.filledPositions ?? 0) > 0;
        if (hasConfirmedApplicants) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '확정된 지원자가 있는 공고는 삭제할 수 없습니다. 마감 처리를 해주세요',
          });
        }

        // Soft Delete: status를 cancelled로 변경
        transaction.update(jobRef, {
          status: STATUS.JOB_POSTING.CANCELLED,
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('공고 삭제 완료', { jobPostingId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('공고 삭제 실패', toError(error), { jobPostingId });
      throw handleServiceError(error, {
        operation: '공고 삭제',
        component: 'JobPostingRepository',
        context: { jobPostingId },
      });
    }
  }

  async closeWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 마감 (트랜잭션)', { jobPostingId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 공고입니다',
          });
        }

        const currentData = parseJobPostingDocument({
          id: jobDoc.id,
          ...jobDoc.data(),
        });
        if (!currentData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '공고 데이터가 올바르지 않습니다',
          });
        }

        // 본인 확인
        if (currentData.ownerId !== ownerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 마감할 수 있습니다',
          });
        }

        // 이미 마감된 경우
        if (currentData.status === STATUS.JOB_POSTING.CLOSED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 마감된 공고입니다',
          });
        }

        transaction.update(jobRef, {
          status: STATUS.JOB_POSTING.CLOSED,
          closedAt: serverTimestamp(),
          closedReason: 'manual',
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('공고 마감 완료', { jobPostingId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('공고 마감 실패', toError(error), { jobPostingId });
      throw handleServiceError(error, {
        operation: '공고 마감',
        component: 'JobPostingRepository',
        context: { jobPostingId },
      });
    }
  }

  async reopenWithTransaction(jobPostingId: string, ownerId: string): Promise<void> {
    try {
      logger.info('공고 재오픈 (트랜잭션)', { jobPostingId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
        const jobDoc = await transaction.get(jobRef);

        if (!jobDoc.exists()) {
          throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
            userMessage: '존재하지 않는 공고입니다',
          });
        }

        const currentData = parseJobPostingDocument({
          id: jobDoc.id,
          ...jobDoc.data(),
        });
        if (!currentData) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '공고 데이터가 올바르지 않습니다',
          });
        }

        // 본인 확인
        if (currentData.ownerId !== ownerId) {
          throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
            userMessage: '본인의 공고만 재오픈할 수 있습니다',
          });
        }

        // 활성 상태인 경우
        if (currentData.status === STATUS.JOB_POSTING.ACTIVE) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '이미 활성 상태인 공고입니다',
          });
        }

        // 취소된 공고는 재오픈 불가
        if (currentData.status === STATUS.JOB_POSTING.CANCELLED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '삭제된 공고는 재오픈할 수 없습니다. 새 공고를 작성해주세요',
          });
        }

        // 고정공고인 경우 expiresAt 갱신
        const updateData: Record<string, unknown> = {
          status: STATUS.JOB_POSTING.ACTIVE,
          updatedAt: serverTimestamp(),
        };

        if (currentData.postingType === 'fixed') {
          updateData.fixedConfig = {
            ...currentData.fixedConfig,
            durationDays: 7,
            expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
          };
        }

        transaction.update(jobRef, updateData);
      });

      logger.info('공고 재오픈 완료', { jobPostingId });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('공고 재오픈 실패', toError(error), { jobPostingId });
      throw handleServiceError(error, {
        operation: '공고 재오픈',
        component: 'JobPostingRepository',
        context: { jobPostingId },
      });
    }
  }

  async getStatsByOwnerId(ownerId: string): Promise<JobPostingStats> {
    try {
      logger.info('소유자별 공고 통계 조회', { ownerId });

      const jobsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const q = query(jobsRef, where(FIELDS.JOB_POSTING.ownerId, '==', ownerId));

      const snapshot = await getDocs(q);
      const jobPostings = parseJobPostingDocuments(
        snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
      );

      const stats: JobPostingStats = {
        total: 0,
        active: 0,
        closed: 0,
        cancelled: 0,
        totalApplications: 0,
        totalViews: 0,
      };

      jobPostings.forEach((data) => {
        stats.total++;
        stats.totalApplications += data.applicationCount ?? 0;
        stats.totalViews += data.viewCount ?? 0;

        switch (data.status) {
          case STATUS.JOB_POSTING.ACTIVE:
            stats.active++;
            break;
          case STATUS.JOB_POSTING.CLOSED:
            stats.closed++;
            break;
          case STATUS.JOB_POSTING.CANCELLED:
            stats.cancelled++;
            break;
        }
      });

      logger.info('소유자별 공고 통계 조회 완료', { ownerId, stats });

      return stats;
    } catch (error) {
      logger.error('소유자별 공고 통계 조회 실패', toError(error), { ownerId });
      throw handleServiceError(error, {
        operation: '소유자별 공고 통계 조회',
        component: 'JobPostingRepository',
        context: { ownerId },
      });
    }
  }

  async bulkUpdateStatus(
    jobPostingIds: string[],
    status: JobPostingStatus,
    ownerId: string
  ): Promise<number> {
    try {
      logger.info('공고 상태 일괄 변경', {
        count: jobPostingIds.length,
        status,
        ownerId,
      });

      let successCount = 0;

      // Firestore 배치 작업 제한
      for (let i = 0; i < jobPostingIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
        const batch = jobPostingIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS);

        await runTransaction(getFirebaseDb(), async (transaction) => {
          for (const jobPostingId of batch) {
            const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
            const jobDoc = await transaction.get(jobRef);

            if (jobDoc.exists()) {
              const data = parseJobPostingDocument({
                id: jobDoc.id,
                ...jobDoc.data(),
              });
              if (data && data.ownerId === ownerId) {
                transaction.update(jobRef, {
                  status,
                  updatedAt: serverTimestamp(),
                });
                successCount++;
              }
            }
          }
        });
      }

      logger.info('공고 상태 일괄 변경 완료', { successCount });

      return successCount;
    } catch (error) {
      logger.error('공고 상태 일괄 변경 실패', toError(error), {
        status,
        ownerId,
      });
      throw handleServiceError(error, {
        operation: '공고 상태 일괄 변경',
        component: 'JobPostingRepository',
        context: { status, ownerId },
      });
    }
  }

  async verifyOwnership(jobPostingId: string, ownerId: string): Promise<boolean> {
    try {
      logger.debug('공고 소유권 검증', { jobPostingId, ownerId });

      const docRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobPostingId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return false;
      }

      const jobPosting = parseJobPostingDocument({
        id: docSnap.id,
        ...docSnap.data(),
      });

      if (!jobPosting) {
        return false;
      }

      // ownerId 또는 createdBy로 소유권 확인
      const postingOwnerId = jobPosting.ownerId ?? jobPosting.createdBy;
      return postingOwnerId === ownerId;
    } catch (error) {
      logger.error('공고 소유권 검증 실패', toError(error), { jobPostingId, ownerId });
      return false;
    }
  }

  // ==========================================================================
  // 대회공고 (Tournament)
  // ==========================================================================

  async getByPostingTypeAndApprovalStatus(
    postingType: string,
    approvalStatus: TournamentApprovalStatus
  ): Promise<JobPosting[]> {
    try {
      logger.info('공고 타입/승인상태별 조회', { postingType, approvalStatus });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const q = query(
        jobPostingsRef,
        where(FIELDS.JOB_POSTING.postingType, '==', postingType),
        where(FIELDS.JOB_POSTING.tournamentApprovalStatus, '==', approvalStatus),
        orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
      );

      const snapshot = await getDocs(q);
      const postings: JobPosting[] = [];

      for (const docSnapshot of snapshot.docs) {
        const jobPosting = parseJobPostingDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
        if (jobPosting) {
          postings.push(jobPosting);
        }
      }

      logger.info('공고 타입/승인상태별 조회 완료', {
        postingType,
        approvalStatus,
        count: postings.length,
      });

      return postings;
    } catch (error) {
      logger.error('공고 타입/승인상태별 조회 실패', toError(error), {
        postingType,
        approvalStatus,
      });
      throw handleServiceError(error, {
        operation: '공고 타입/승인상태별 조회',
        component: 'JobPostingRepository',
        context: { postingType, approvalStatus },
      });
    }
  }

  async getByOwnerAndPostingType(
    ownerId: string,
    postingType: string,
    approvalStatuses: TournamentApprovalStatus[]
  ): Promise<JobPosting[]> {
    try {
      logger.info('소유자/공고타입별 조회', {
        ownerId,
        postingType,
        approvalStatuses,
      });

      const jobPostingsRef = collection(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS);
      const q = query(
        jobPostingsRef,
        where(FIELDS.JOB_POSTING.postingType, '==', postingType),
        where(FIELDS.JOB_POSTING.ownerId, '==', ownerId),
        where(FIELDS.JOB_POSTING.tournamentApprovalStatus, 'in', approvalStatuses),
        orderBy(FIELDS.JOB_POSTING.createdAt, 'desc')
      );

      const snapshot = await getDocs(q);
      const postings: JobPosting[] = [];

      for (const docSnapshot of snapshot.docs) {
        const jobPosting = parseJobPostingDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });
        if (jobPosting) {
          postings.push(jobPosting);
        }
      }

      logger.info('소유자/공고타입별 조회 완료', {
        ownerId,
        postingType,
        count: postings.length,
      });

      return postings;
    } catch (error) {
      logger.error('소유자/공고타입별 조회 실패', toError(error), {
        ownerId,
        postingType,
      });
      throw handleServiceError(error, {
        operation: '소유자/공고타입별 조회',
        component: 'JobPostingRepository',
        context: { ownerId, postingType, approvalStatuses },
      });
    }
  }
}
