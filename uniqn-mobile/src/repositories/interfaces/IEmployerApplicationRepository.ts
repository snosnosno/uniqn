/**
 * UNIQN Mobile - Employer Application Repository Interface
 *
 * @description 구인자 등록 신청 CRUD + RPC 호출 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. DB 직접 의존 제거 → 테스트 용이성
 * 2. 구인자 신청 조회/승인/거부 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 *
 * 도메인 타입(EmployerApplication 등)은 구현체 모듈에 정의되어 있으므로
 * 여기서 type import 후 인터페이스 시그니처에만 사용한다.
 */

import type {
  ApproveRejectResult,
  EmployerApplication,
  EmployerApplicationRejectionCategory,
  FetchApplicationsOptions,
  FetchApplicationsResult,
  RegisterAsEmployerResult,
} from '../supabase/EmployerApplicationRepository';

// ============================================================================
// Interface
// ============================================================================

/**
 * Employer Application Repository 인터페이스
 *
 * 구현체:
 * - SupabaseEmployerApplicationRepository (프로덕션)
 */
export interface IEmployerApplicationRepository {
  /**
   * 구인자 신청 생성 (유저)
   * @param agreementsSnapshot - 약관 동의 스냅샷
   * @param intro - 신청 소개글
   */
  register(
    agreementsSnapshot: Record<string, unknown>,
    intro: string
  ): Promise<RegisterAsEmployerResult>;

  /**
   * 최신 신청 조회 (유저 본인 또는 admin)
   * @param userId - 미지정 시 RPC가 auth.uid() 사용
   */
  getLatest(userId?: string): Promise<EmployerApplication | null>;

  /**
   * 신청 목록 조회 (admin)
   * @param options - status 필터, 페이지 크기, 커서
   */
  listForAdmin(options?: FetchApplicationsOptions): Promise<FetchApplicationsResult>;

  /**
   * 신청 상세 조회 (admin)
   * @param applicationId - 신청 ID
   */
  getById(applicationId: string): Promise<EmployerApplication | null>;

  /**
   * 신청 승인 (admin)
   * @param applicationId - 신청 ID
   */
  approve(applicationId: string): Promise<ApproveRejectResult>;

  /**
   * 신청 거부 (admin)
   * @param applicationId - 신청 ID
   * @param reason - 거부 사유 (자유 텍스트, XSS 검증 후 전달)
   * @param category - 거부 분류
   */
  reject(
    applicationId: string,
    reason?: string,
    category?: EmployerApplicationRejectionCategory
  ): Promise<ApproveRejectResult>;

  /**
   * SLA 모니터링: 임계 시간 경과 pending 건수 (admin)
   * @param hoursThreshold - 기본 24시간
   */
  countOverduePending(hoursThreshold?: number): Promise<number>;
}
