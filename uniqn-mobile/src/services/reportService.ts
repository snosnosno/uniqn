/**
 * UNIQN Mobile - 신고 서비스
 *
 * @description 양방향 신고 비즈니스 로직
 *   - 구인자 → 스태프 (employer)
 *   - 구직자 → 구인자 (employee)
 * @version 1.2.0 - Zod 스키마 검증 + BusinessError 적용
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  createReportInputSchema,
  reviewReportInputSchema,
  parseReportDocuments,
  parseReportDocument,
} from '@/schemas';
import {
  mapFirebaseError,
  AuthError,
  ValidationError,
  DuplicateReportError,
  ReportNotFoundError,
  ReportAlreadyReviewedError,
  CannotReportSelfError,
  ERROR_CODES,
  toError,
} from '@/errors';
import type {
  Report,
  CreateReportInput,
  ReviewReportInput,
  ReportStatus,
  ReporterType,
} from '@/types/report';
import { getReportSeverity } from '@/types/report';

// ============================================================================
// Constants
// ============================================================================

const REPORTS_COLLECTION = 'reports';

// ============================================================================
// Create Report
// ============================================================================

/**
 * 신고 생성 (양방향 지원)
 */
export async function createReport(input: CreateReportInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  // 1. Zod 스키마 검증
  const validationResult = createReportInputSchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const validatedInput = validationResult.data;

  // 2. 본인 신고 방지
  if (validatedInput.targetId === user.uid) {
    throw new CannotReportSelfError({
      userMessage: '본인을 신고할 수 없습니다',
    });
  }

  logger.info('Creating report', {
    type: validatedInput.type,
    reporterType: validatedInput.reporterType,
    targetId: validatedInput.targetId,
    jobPostingId: validatedInput.jobPostingId,
  });

  try {
    // 3. 중복 신고 검사 (같은 공고, 같은 대상, pending 상태)
    const existingQuery = query(
      collection(db, REPORTS_COLLECTION),
      where('reporterId', '==', user.uid),
      where('targetId', '==', validatedInput.targetId),
      where('jobPostingId', '==', validatedInput.jobPostingId),
      where('status', '==', 'pending')
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      throw new DuplicateReportError({
        userMessage: '이미 해당 건에 대해 신고하셨습니다',
        targetId: validatedInput.targetId,
        jobPostingId: validatedInput.jobPostingId,
      });
    }

    // 4. Firestore에서 프로필 조회하여 이름 가져오기
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userProfile = userDoc.exists() ? userDoc.data() : null;
    const reporterName = userProfile?.name || userProfile?.nickname || '익명';

    // 5. 문서 데이터 구성 (검증된 데이터 사용)
    const reportData: Record<string, unknown> = {
      type: validatedInput.type,
      reporterType: validatedInput.reporterType,
      reporterId: user.uid,
      reporterName,
      targetId: validatedInput.targetId,
      targetName: validatedInput.targetName,
      jobPostingId: validatedInput.jobPostingId,
      jobPostingTitle: validatedInput.jobPostingTitle || '',
      description: validatedInput.description,
      evidenceUrls: validatedInput.evidenceUrls || [],
      status: 'pending' as ReportStatus,
      severity: getReportSeverity(validatedInput.type, validatedInput.reporterType),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 구인자→스태프 신고만 workLog 정보 포함
    if (validatedInput.workLogId) {
      reportData.workLogId = validatedInput.workLogId;
    }
    if (validatedInput.workDate) {
      reportData.workDate = validatedInput.workDate;
    }

    const docRef = await addDoc(collection(db, REPORTS_COLLECTION), reportData);

    logger.info('Report created', {
      reportId: docRef.id,
      reporterType: validatedInput.reporterType,
    });

    return docRef.id;
  } catch (error) {
    // 이미 처리된 비즈니스 에러는 그대로 throw
    if (
      error instanceof DuplicateReportError ||
      error instanceof CannotReportSelfError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    const firebaseError = error as { code?: string; message?: string };
    logger.error('Failed to create report', toError(error), {
      input: validatedInput,
      errorCode: firebaseError.code,
      errorMessage: firebaseError.message,
      reportData: {
        type: validatedInput.type,
        reporterType: validatedInput.reporterType,
        targetId: validatedInput.targetId,
        jobPostingId: validatedInput.jobPostingId,
      },
    });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// Get Reports (타입 안전성 개선)
// ============================================================================

/**
 * 공고별 신고 목록 조회
 */
export async function getReportsByJobPosting(jobPostingId: string): Promise<Report[]> {
  logger.info('Getting reports by job posting', { jobPostingId });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('jobPostingId', '==', jobPostingId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    // 타입 안전 파싱 (as 단언 제거)
    const rawData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const reports = parseReportDocuments(rawData);

    // 파싱 실패 건수 로깅
    if (reports.length < rawData.length) {
      logger.warn('Some reports failed validation', {
        total: rawData.length,
        valid: reports.length,
        failed: rawData.length - reports.length,
      });
    }

    return reports as Report[];
  } catch (error) {
    logger.error('Failed to get reports by job posting', toError(error), { jobPostingId });
    throw mapFirebaseError(error);
  }
}

/**
 * 스태프별 신고 목록 조회
 */
export async function getReportsByStaff(staffId: string): Promise<Report[]> {
  logger.info('Getting reports by staff', { staffId });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('targetId', '==', staffId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    const rawData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const reports = parseReportDocuments(rawData);

    if (reports.length < rawData.length) {
      logger.warn('Some reports failed validation', {
        total: rawData.length,
        valid: reports.length,
        failed: rawData.length - reports.length,
      });
    }

    return reports as Report[];
  } catch (error) {
    logger.error('Failed to get reports by staff', toError(error), { staffId });
    throw mapFirebaseError(error);
  }
}

/**
 * 내가 신고한 목록 조회
 */
export async function getMyReports(): Promise<Report[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  logger.info('Getting my reports', { userId: user.uid });

  try {
    const q = query(
      collection(db, REPORTS_COLLECTION),
      where('reporterId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);

    const rawData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const reports = parseReportDocuments(rawData);

    if (reports.length < rawData.length) {
      logger.warn('Some reports failed validation', {
        total: rawData.length,
        valid: reports.length,
        failed: rawData.length - reports.length,
      });
    }

    return reports as Report[];
  } catch (error) {
    logger.error('Failed to get my reports', toError(error));
    throw mapFirebaseError(error);
  }
}

/**
 * 신고 상세 조회
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  logger.info('Getting report by id', { reportId });

  try {
    const docRef = doc(db, REPORTS_COLLECTION, reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const rawData = {
      id: docSnap.id,
      ...docSnap.data(),
    };

    const report = parseReportDocument(rawData);

    if (!report) {
      logger.warn('Report document failed validation', { reportId });
      return null;
    }

    return report as Report;
  } catch (error) {
    logger.error('Failed to get report by id', toError(error), { reportId });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// Review Report (Admin)
// ============================================================================

/**
 * 신고 처리 (관리자용)
 */
export async function reviewReport(input: ReviewReportInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  // 1. Zod 스키마 검증
  const validationResult = reviewReportInputSchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
    });
  }

  const validatedInput = validationResult.data;

  logger.info('Reviewing report', {
    reportId: validatedInput.reportId,
    status: validatedInput.status,
  });

  try {
    // 2. 기존 신고 상태 확인
    const docRef = doc(db, REPORTS_COLLECTION, validatedInput.reportId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new ReportNotFoundError({
        userMessage: '신고 내역을 찾을 수 없습니다',
        reportId: validatedInput.reportId,
      });
    }

    const existingReport = docSnap.data();

    // 이미 처리된 신고인지 확인
    if (existingReport.status !== 'pending') {
      throw new ReportAlreadyReviewedError({
        userMessage: '이미 처리된 신고입니다',
        reportId: validatedInput.reportId,
        currentStatus: existingReport.status,
      });
    }

    // 3. 업데이트
    await updateDoc(docRef, {
      status: validatedInput.status,
      reviewerId: user.uid,
      reviewerNotes: validatedInput.reviewerNotes || '',
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('Report reviewed', { reportId: validatedInput.reportId });
  } catch (error) {
    // 이미 처리된 비즈니스 에러는 그대로 throw
    if (
      error instanceof ReportNotFoundError ||
      error instanceof ReportAlreadyReviewedError ||
      error instanceof ValidationError
    ) {
      throw error;
    }

    logger.error('Failed to review report', toError(error), { input: validatedInput });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * 스태프별 신고 횟수 조회
 */
export async function getReportCountByStaff(staffId: string): Promise<{
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}> {
  logger.info('Getting report count by staff', { staffId });

  try {
    const reports = await getReportsByStaff(staffId);

    return {
      total: reports.length,
      critical: reports.filter((r) => r.severity === 'critical').length,
      high: reports.filter((r) => r.severity === 'high').length,
      medium: reports.filter((r) => r.severity === 'medium').length,
      low: reports.filter((r) => r.severity === 'low').length,
    };
  } catch (error) {
    logger.error('Failed to get report count by staff', toError(error), { staffId });
    throw error;
  }
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * 신고 필터 옵션 (관리자용)
 */
export interface GetAllReportsFilters {
  /** 신고 상태 필터 */
  status?: ReportStatus | 'all';
  /** 심각도 필터 */
  severity?: 'low' | 'medium' | 'high' | 'critical' | 'all';
  /** 신고자 유형 필터 */
  reporterType?: ReporterType | 'all';
}

/**
 * 전체 신고 목록 조회 (관리자용)
 *
 * @description 관리자가 모든 신고를 조회하고 처리할 수 있도록
 * 필터링 및 정렬 기능을 제공합니다.
 */
export async function getAllReports(filters: GetAllReportsFilters = {}): Promise<Report[]> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  logger.info('Getting all reports (admin)', { filters });

  try {
    const constraints: QueryConstraint[] = [];

    // 상태 필터
    if (filters.status && filters.status !== 'all') {
      constraints.push(where('status', '==', filters.status));
    }

    // 심각도 필터
    if (filters.severity && filters.severity !== 'all') {
      constraints.push(where('severity', '==', filters.severity));
    }

    // 신고자 유형 필터
    if (filters.reporterType && filters.reporterType !== 'all') {
      constraints.push(where('reporterType', '==', filters.reporterType));
    }

    // 정렬: 최신순
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, REPORTS_COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    const rawData = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    const reports = parseReportDocuments(rawData);

    logger.info('Got all reports', {
      count: reports.length,
      filters,
    });

    return reports as Report[];
  } catch (error) {
    logger.error('Failed to get all reports', toError(error), { filters });
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// Export
// ============================================================================

export const reportService = {
  createReport,
  getReportsByJobPosting,
  getReportsByStaff,
  getMyReports,
  getReportById,
  reviewReport,
  getReportCountByStaff,
  getAllReports,
};

export default reportService;
