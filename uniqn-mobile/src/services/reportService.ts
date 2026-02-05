/**
 * UNIQN Mobile - 신고 서비스
 *
 * @description 양방향 신고 비즈니스 로직
 *   - 구인자 → 스태프 (employer)
 *   - 구직자 → 구인자 (employee)
 * @version 2.0.0 - Repository 패턴 적용
 *
 * 변경사항:
 * - Firebase 직접 호출 제거 → reportRepository 사용
 * - Race Condition 해결 (createWithTransaction)
 * - 중복 쿼리 패턴 제거 (Repository에서 통합)
 */

import { auth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { reportRepository, userRepository } from '@/repositories';
import { createReportInputSchema, reviewReportInputSchema } from '@/schemas';
import { AuthError, ValidationError, ERROR_CODES, toError } from '@/errors';
import type {
  Report,
  CreateReportInput,
  ReviewReportInput,
  ReportStatus,
  ReporterType,
} from '@/types/report';

// ============================================================================
// Types (Repository에서 재사용)
// ============================================================================

export type { ReportFilters } from '@/repositories';

// ============================================================================
// Create Report
// ============================================================================

/**
 * 신고 생성 (양방향 지원)
 *
 * @description Repository의 트랜잭션으로 Race Condition 해결
 * - 중복 체크 + 생성이 원자적으로 처리됨
 */
export async function createReport(input: CreateReportInput): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  // 1. Zod 스키마 검증 (비즈니스 로직: Service에서 처리)
  const validationResult = createReportInputSchema.safeParse(input);
  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      userMessage: firstError?.message || '입력값을 확인해주세요',
      errors: validationResult.error.flatten().fieldErrors as Record<string, string[]>,
    });
  }

  const validatedInput = validationResult.data;

  logger.info('Creating report', {
    type: validatedInput.type,
    reporterType: validatedInput.reporterType,
    targetId: validatedInput.targetId,
    jobPostingId: validatedInput.jobPostingId,
  });

  // 2. 신고자 이름 조회 (userRepository 사용)
  let reporterName = '익명';
  try {
    const userProfile = await userRepository.getById(user.uid);
    if (userProfile) {
      reporterName = userProfile.name || userProfile.nickname || '익명';
    }
  } catch (error) {
    // 프로필 조회 실패 시 익명으로 진행
    logger.warn('신고자 프로필 조회 실패, 익명으로 진행', { error: toError(error) });
  }

  // 3. Repository 트랜잭션 호출
  // - 본인 신고 방지
  // - 중복 신고 검사 + 생성 (원자적)
  const reportId = await reportRepository.createWithTransaction(validatedInput, {
    reporterId: user.uid,
    reporterName,
  });

  return reportId;
}

// ============================================================================
// Get Reports
// ============================================================================

/**
 * 공고별 신고 목록 조회
 */
export async function getReportsByJobPosting(jobPostingId: string): Promise<Report[]> {
  logger.info('Getting reports by job posting', { jobPostingId });
  return reportRepository.getByJobPostingId(jobPostingId);
}

/**
 * 스태프별 신고 목록 조회
 */
export async function getReportsByStaff(staffId: string): Promise<Report[]> {
  logger.info('Getting reports by staff', { staffId });
  return reportRepository.getByTargetId(staffId);
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
  return reportRepository.getByReporterId(user.uid);
}

/**
 * 신고 상세 조회
 */
export async function getReportById(reportId: string): Promise<Report | null> {
  logger.info('Getting report by id', { reportId });
  return reportRepository.getById(reportId);
}

// ============================================================================
// Review Report (Admin)
// ============================================================================

/**
 * 신고 처리 (관리자용)
 *
 * @description Repository의 트랜잭션으로 상태 검증 + 업데이트 원자적 처리
 */
export async function reviewReport(input: ReviewReportInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new AuthError(ERROR_CODES.AUTH_SESSION_EXPIRED, {
      userMessage: '인증이 필요합니다',
    });
  }

  // 1. Zod 스키마 검증 (비즈니스 로직: Service에서 처리)
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

  // 2. Repository 트랜잭션 호출
  // - 존재 확인
  // - 상태 검증 (pending만 처리 가능)
  // - 업데이트 (원자적)
  await reportRepository.reviewWithTransaction(validatedInput, user.uid);
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
  return reportRepository.getCountsByTargetId(staffId);
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
  return reportRepository.getAll(filters);
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
