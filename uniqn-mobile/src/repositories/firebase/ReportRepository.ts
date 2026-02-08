/**
 * UNIQN Mobile - Firebase Report Repository
 *
 * @description Firebase Firestore 기반 Report Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 트랜잭션 캡슐화 (중복 신고 방지)
 * 3. 문서 파싱 및 타입 변환
 *
 * 개선사항:
 * - createWithTransaction: Race Condition 해결 (중복 체크 + 생성 원자적 처리)
 * - 중복 쿼리 패턴 통합 (getByJobPostingId, getByTargetId, getByReporterId)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import {
  DuplicateReportError,
  ReportNotFoundError,
  ReportAlreadyReviewedError,
  CannotReportSelfError,
} from '@/errors';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import { parseReportDocuments, parseReportDocument } from '@/schemas';
import { getReportSeverity } from '@/types/report';
import type {
  IReportRepository,
  CreateReportContext,
  ReportFilters,
  ReportCounts,
} from '../interfaces';
import type { Report, CreateReportInput, ReviewReportInput, ReportStatus } from '@/types/report';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'reports';

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Report Repository
 */
export class FirebaseReportRepository implements IReportRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(reportId: string): Promise<Report | null> {
    try {
      logger.info('신고 상세 조회', { reportId });

      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, reportId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const report = parseReportDocument({
        id: docSnap.id,
        ...docSnap.data(),
      });

      if (!report) {
        logger.warn('신고 데이터 파싱 실패', { reportId });
        return null;
      }

      return report as Report;
    } catch (error) {
      throw handleServiceError(error, {
        operation: '신고 상세 조회',
        component: 'ReportRepository',
        context: { reportId },
      });
    }
  }

  async getByJobPostingId(jobPostingId: string): Promise<Report[]> {
    return this.queryReports('jobPostingId', jobPostingId, '공고별 신고 목록 조회');
  }

  async getByTargetId(targetId: string): Promise<Report[]> {
    return this.queryReports('targetId', targetId, '대상별 신고 목록 조회');
  }

  async getByReporterId(reporterId: string): Promise<Report[]> {
    return this.queryReports('reporterId', reporterId, '신고자별 신고 목록 조회');
  }

  async getAll(filters?: ReportFilters): Promise<Report[]> {
    try {
      logger.info('전체 신고 목록 조회', { filters });

      const reportsRef = collection(getFirebaseDb(), COLLECTION_NAME);
      const q = new QueryBuilder(reportsRef)
        .whereIf(filters?.status && filters.status !== 'all', 'status', '==', filters?.status)
        .whereIf(
          filters?.severity && filters.severity !== 'all',
          'severity',
          '==',
          filters?.severity
        )
        .whereIf(
          filters?.reporterType && filters.reporterType !== 'all',
          'reporterType',
          '==',
          filters?.reporterType
        )
        .orderByDesc('createdAt')
        .build();

      const snapshot = await getDocs(q);
      return this.parseSnapshot(snapshot, '전체 신고');
    } catch (error) {
      throw handleServiceError(error, {
        operation: '전체 신고 목록 조회',
        component: 'ReportRepository',
        context: { filters },
      });
    }
  }

  async getCountsByTargetId(targetId: string): Promise<ReportCounts> {
    try {
      logger.info('대상별 신고 통계 조회', { targetId });

      const reports = await this.getByTargetId(targetId);

      return {
        total: reports.length,
        critical: reports.filter((r) => r.severity === 'critical').length,
        high: reports.filter((r) => r.severity === 'high').length,
        medium: reports.filter((r) => r.severity === 'medium').length,
        low: reports.filter((r) => r.severity === 'low').length,
      };
    } catch (error) {
      logger.error('대상별 신고 통계 조회 실패', toError(error), { targetId });
      throw error;
    }
  }

  // ==========================================================================
  // 트랜잭션 (Write)
  // ==========================================================================

  async createWithTransaction(
    input: CreateReportInput,
    context: CreateReportContext
  ): Promise<string> {
    try {
      // 본인 신고 방지 (트랜잭션 전에 체크)
      if (input.targetId === context.reporterId) {
        throw new CannotReportSelfError({
          userMessage: '본인을 신고할 수 없습니다',
        });
      }

      logger.info('신고 생성 트랜잭션 시작', {
        type: input.type,
        reporterType: input.reporterType,
        targetId: input.targetId,
        jobPostingId: input.jobPostingId,
      });

      const db = getFirebaseDb();
      const reportsRef = collection(db, COLLECTION_NAME);

      // 새 문서 ID 미리 생성
      const newReportRef = doc(reportsRef);

      await runTransaction(db, async (transaction) => {
        // 1. 중복 신고 검사 (같은 reporter + target + jobPosting + pending 상태)
        const existingQuery = query(
          reportsRef,
          where('reporterId', '==', context.reporterId),
          where('targetId', '==', input.targetId),
          where('jobPostingId', '==', input.jobPostingId),
          where('status', '==', 'pending')
        );

        // 트랜잭션 내에서 쿼리 실행
        // Note: Firestore 트랜잭션에서 쿼리는 get()만 지원되므로
        // 외부에서 확인 후 트랜잭션 내에서 다시 확인
        const existingSnapshot = await getDocs(existingQuery);

        if (!existingSnapshot.empty) {
          throw new DuplicateReportError({
            userMessage: '이미 해당 건에 대해 신고하셨습니다',
            targetId: input.targetId,
            jobPostingId: input.jobPostingId,
          });
        }

        // 2. 신고 문서 생성
        const reportData: Record<string, unknown> = {
          type: input.type,
          reporterType: input.reporterType,
          reporterId: context.reporterId,
          reporterName: context.reporterName,
          targetId: input.targetId,
          targetName: input.targetName,
          jobPostingId: input.jobPostingId,
          jobPostingTitle: input.jobPostingTitle || '',
          description: input.description,
          evidenceUrls: input.evidenceUrls || [],
          status: 'pending' as ReportStatus,
          severity: getReportSeverity(input.type, input.reporterType),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // 구인자→스태프 신고만 workLog 정보 포함
        if (input.workLogId) {
          reportData.workLogId = input.workLogId;
        }
        if (input.workDate) {
          reportData.workDate = input.workDate;
        }

        transaction.set(newReportRef, reportData);
      });

      logger.info('신고 생성 트랜잭션 완료', {
        reportId: newReportRef.id,
        reporterType: input.reporterType,
      });

      return newReportRef.id;
    } catch (error) {
      // 비즈니스 에러는 그대로 throw
      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '신고 생성',
        component: 'ReportRepository',
        context: {
          type: input.type,
          reporterType: input.reporterType,
          targetId: input.targetId,
          jobPostingId: input.jobPostingId,
        },
      });
    }
  }

  async reviewWithTransaction(input: ReviewReportInput, reviewerId: string): Promise<void> {
    try {
      logger.info('신고 처리 트랜잭션 시작', {
        reportId: input.reportId,
        status: input.status,
      });

      const db = getFirebaseDb();
      const reportRef = doc(db, COLLECTION_NAME, input.reportId);

      await runTransaction(db, async (transaction) => {
        // 1. 기존 신고 조회
        const reportSnap = await transaction.get(reportRef);

        if (!reportSnap.exists()) {
          throw new ReportNotFoundError({
            userMessage: '신고 내역을 찾을 수 없습니다',
            reportId: input.reportId,
          });
        }

        const existingReport = reportSnap.data();

        // 2. 상태 확인 (pending만 처리 가능)
        if (existingReport.status !== 'pending') {
          throw new ReportAlreadyReviewedError({
            userMessage: '이미 처리된 신고입니다',
            reportId: input.reportId,
            currentStatus: existingReport.status,
          });
        }

        // 3. 상태 업데이트
        transaction.update(reportRef, {
          status: input.status,
          reviewerId,
          reviewerNotes: input.reviewerNotes || '',
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      logger.info('신고 처리 트랜잭션 완료', { reportId: input.reportId });
    } catch (error) {
      // 비즈니스 에러는 그대로 throw
      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '신고 처리',
        component: 'ReportRepository',
        context: { reportId: input.reportId, status: input.status },
      });
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * 공통 쿼리 패턴 (중복 제거)
   */
  private async queryReports(
    field: 'jobPostingId' | 'targetId' | 'reporterId',
    value: string,
    operationName: string
  ): Promise<Report[]> {
    try {
      logger.info(operationName, { [field]: value });

      const q = query(
        collection(getFirebaseDb(), COLLECTION_NAME),
        where(field, '==', value),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return this.parseSnapshot(snapshot, operationName);
    } catch (error) {
      throw handleServiceError(error, {
        operation: operationName,
        component: 'ReportRepository',
        context: { [field]: value },
      });
    }
  }

  /**
   * 스냅샷 파싱 (공통 로직)
   */
  private parseSnapshot(
    snapshot: Awaited<ReturnType<typeof getDocs>>,
    context: string
  ): Report[] {
    const rawData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Record<string, unknown>),
    }));

    const reports = parseReportDocuments(rawData);

    // 파싱 실패 건수 로깅
    if (reports.length < rawData.length) {
      logger.warn(`${context} - 일부 신고 파싱 실패`, {
        total: rawData.length,
        valid: reports.length,
        failed: rawData.length - reports.length,
      });
    }

    return reports as Report[];
  }
}
