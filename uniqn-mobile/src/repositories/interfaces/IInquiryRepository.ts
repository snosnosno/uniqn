/**
 * UNIQN Mobile - Inquiry Repository Interface
 *
 * @description 문의(Inquiry) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. DB 직접 의존 제거 → 테스트 용이성
 * 2. 문의 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type {
  Inquiry,
  InquiryStatus,
  CreateInquiryInput,
  RespondInquiryInput,
  InquiryFilters,
  InquiryAttachment,
  LocalInquiryAttachment,
} from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 페이지네이션 커서 (구현체 의존 없는 opaque 타입)
 */
export type InquiryPaginationCursor = unknown;

export interface FetchInquiriesOptions {
  filters?: InquiryFilters;
  pageSize?: number;
  cursor?: InquiryPaginationCursor;
}

export interface FetchInquiriesResult {
  inquiries: Inquiry[];
  nextCursor: InquiryPaginationCursor | null;
  hasMore: boolean;
}

export interface CreateInquiryContext {
  userId: string;
  userEmail: string;
  userName: string;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Inquiry Repository 인터페이스
 *
 * 구현체:
 * - SupabaseInquiryRepository (프로덕션)
 * - MockInquiryRepository (테스트)
 */
export interface IInquiryRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * 문의 상세 조회
   * @param inquiryId - 문의 ID
   * @returns 문의 또는 null
   */
  getById(inquiryId: string): Promise<Inquiry | null>;

  /**
   * 사용자별 문의 목록 조회
   * @param userId - 사용자 ID
   * @param options - 페이지 크기, 커서
   * @returns 페이지네이션된 문의 목록
   */
  getByUserId(userId: string, options?: FetchInquiriesOptions): Promise<FetchInquiriesResult>;

  /**
   * 전체 문의 목록 조회 (관리자용)
   * @param options - 필터, 페이지 크기, 커서
   * @returns 페이지네이션된 문의 목록
   */
  getAll(options?: FetchInquiriesOptions): Promise<FetchInquiriesResult>;

  /**
   * 미답변 문의 수 조회
   * @returns 미답변 문의 수
   */
  getUnansweredCount(): Promise<number>;

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  /**
   * 문의 생성
   * @param context - 생성자 정보 (userId, userEmail, userName)
   * @param input - 문의 입력 데이터
   * @returns 생성된 문의 ID
   */
  create(context: CreateInquiryContext, input: CreateInquiryInput): Promise<string>;

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  /**
   * 문의 응답 (관리자) - 트랜잭션으로 상태 전이 검증
   * @param inquiryId - 문의 ID
   * @param responderId - 응답자 ID
   * @param responderName - 응답자 이름
   * @param input - 응답 입력 데이터
   */
  respond(
    inquiryId: string,
    responderId: string,
    responderName: string,
    input: RespondInquiryInput
  ): Promise<void>;

  /**
   * 문의 상태 변경 (관리자) - 트랜잭션으로 상태 전이 검증
   * @param inquiryId - 문의 ID
   * @param status - 변경할 상태
   */
  updateStatus(inquiryId: string, status: InquiryStatus): Promise<void>;

  // ==========================================================================
  // 첨부파일 (Attachments)
  // ==========================================================================

  /**
   * 첨부파일 순차 업로드 (Storage). 실패 시 이미 업로드된 파일을 rollback한다.
   *
   * 경로: {userId}/{inquiryId}/{timestamp}-{random}.{ext}
   *
   * @returns 업로드된 InquiryAttachment 배열 (모두 성공한 경우)
   * @throws 한 장이라도 실패하면 이미 업로드된 파일 삭제 후 에러 throw
   */
  uploadAttachments(
    userId: string,
    inquiryId: string,
    files: LocalInquiryAttachment[]
  ): Promise<InquiryAttachment[]>;

  /**
   * 문의 attachments JSONB 컬럼 갱신 (교체)
   */
  updateAttachments(inquiryId: string, attachments: InquiryAttachment[]): Promise<void>;

  /**
   * Storage에서 첨부파일 경로 목록 삭제 (rollback 또는 문의 삭제 cascade)
   */
  removeAttachmentsFromStorage(paths: string[]): Promise<void>;

  /**
   * Storage 경로에 대한 signed URL 발급 (조회용)
   * @param expiresInSeconds - 기본 3600(1시간)
   */
  getSignedAttachmentUrl(path: string, expiresInSeconds?: number): Promise<string>;

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  /**
   * 사용자가 자기 문의 삭제 (rollback 또는 사용자 명시적 삭제)
   *
   * 가드: 본인 소유 + status = 'open' 만 허용. 그 외는 에러.
   * DB 레벨 RLS 정책으로 한 번 더 방어되지만 Repository도 명시적 체크.
   */
  deleteInquiry(inquiryId: string, userId: string): Promise<void>;
}
