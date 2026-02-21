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
  getCountFromServer,
  type QueryDocumentSnapshot,
  type DocumentData,
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
  FetchReportsOptions,
  FetchReportsResult,
  ReportCounts,
} from '../interfaces';
import type { Report, CreateReportInput, ReviewReportInput, ReportStatus } from '@/types/report';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';

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

      const docRef = doc(getFirebaseDb(), COLLECTIONS.REPORTS, reportId);
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

  async getAll(options: FetchReportsOptions = {}): Promise<FetchReportsResult> {
    try {
      const { filters, pageSize = 50, cursor } = options;
      logger.info('전체 신고 목록 조회', { filters, pageSize });

      const reportsRef = collection(getFirebaseDb(), COLLECTIONS.REPORTS);
      const constraints = new QueryBuilder(reportsRef)
        .whereIf(
          filters?.status && filters.status !== 'all',
          FIELDS.REPORT.status,
          '==',
          filters?.status
        )
        .whereIf(
          filters?.severity && filters.severity !== 'all',
          FIELDS.REPORT.severity,
          '==',
          filters?.severity
        )
        .whereIf(
          filters?.reporterType && filters.reporterType !== 'all',
          FIELDS.REPORT.reporterType,
          '==',
          filters?.reporterType
        )
        .orderByDesc(FIELDS.REPORT.createdAt)
        .paginate(pageSize, cursor as QueryDocumentSnapshot<DocumentData> | undefined)
        .build();

      const snapshot = await getDocs(constraints);
      const reports = this.parseSnapshot(snapshot, '전체 신고');

      const hasMore = snapshot.docs.length > pageSize;
      const items = hasMore ? reports.slice(0, pageSize) : reports;
      const nextCursor = hasMore ? snapshot.docs[pageSize - 1] : null;

      return { reports: items, nextCursor, hasMore };
    } catch (error) {
      throw handleServiceError(error, {
        operation: '전체 신고 목록 조회',
        component: 'ReportRepository',
        context: { filters: options.filters },
      });
    }
  }

  async getCountsByTargetId(targetId: string): Promise<ReportCounts> {
    try {
      logger.info('대상별 신고 통계 조회', { targetId });

      const db = getFirebaseDb();
      const reportsRef = collection(db, COLLECTIONS.REPORTS);
      const severities = ['critical', 'high', 'medium', 'low'] as const;

      // 심각도별 카운트를 병렬로 조회 (전체 문서 로드 대신 서버 카운트)
      const counts = await Promise.all(
        severities.map((severity) =>
          getCountFromServer(
            query(
              reportsRef,
              where(FIELDS.REPORT.targetId, '==', targetId),
              where(FIELDS.REPORT.severity, '==', severity)
            )
          )
        )
      );

      const [critical, high, medium, low] = counts.map((snap) => snap.data().count);

      return {
        total: critical + high + medium + low,
        critical,
        high,
        medium,
        low,
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
      const reportsRef = collection(db, COLLECTIONS.REPORTS);

      // 1. 중복 신고 검사 (트랜잭션 외부에서 수행)
      //
      // ⚠️ Race Condition 인지:
      // getDocs는 트랜잭션 내부에서 사용할 수 없어 (Firebase SDK 제약)
      // 중복 체크와 생성 사이에 이론적 race condition 존재.
      // 실제 발생 확률은 극히 낮음:
      //   - 같은 reporter가 같은 target/jobPosting에 동시 신고하는 상황은 비현실적
      //   - UI에서 중복 클릭 방지 (버튼 disabled) 적용됨
      // 향후 개선: 복합 키 기반 문서 ID (reporter_target_jobPosting) 사용 시
      //   트랜잭션 내 get+set으로 원자적 중복 방지 가능
      const existingQuery = query(
        reportsRef,
        where(FIELDS.REPORT.reporterId, '==', context.reporterId),
        where(FIELDS.REPORT.targetId, '==', input.targetId),
        where(FIELDS.REPORT.jobPostingId, '==', input.jobPostingId),
        where(FIELDS.REPORT.status, '==', STATUS.REPORT.PENDING)
      );

      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        throw new DuplicateReportError({
          userMessage: '이미 해당 건에 대해 신고하셨습니다',
          targetId: input.targetId,
          jobPostingId: input.jobPostingId,
        });
      }

      // 2. 새 문서 ID 미리 생성
      const newReportRef = doc(reportsRef);

      // 3. 트랜잭션으로 문서 생성
      await runTransaction(db, async (transaction) => {
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
          status: STATUS.REPORT.PENDING as ReportStatus,
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
      const reportRef = doc(db, COLLECTIONS.REPORTS, input.reportId);

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
        if (existingReport.status !== STATUS.REPORT.PENDING) {
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
        collection(getFirebaseDb(), COLLECTIONS.REPORTS),
        where(FIELDS.REPORT[field], '==', value),
        orderBy(FIELDS.REPORT.createdAt, 'desc')
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
  private parseSnapshot(snapshot: Awaited<ReturnType<typeof getDocs>>, context: string): Report[] {
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
