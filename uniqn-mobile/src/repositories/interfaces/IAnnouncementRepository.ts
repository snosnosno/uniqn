/**
 * UNIQN Mobile - Announcement Repository Interface
 *
 * @description 공지사항(Announcement) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 공지사항 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type {
  Announcement,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilters,
} from '@/types';
import type { UserRole } from '@/types/role';

// ============================================================================
// Types
// ============================================================================

export interface FetchAnnouncementsOptions {
  filters?: AnnouncementFilters;
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

export interface FetchAnnouncementsResult {
  announcements: Announcement[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface AnnouncementCountByStatus {
  draft: number;
  published: number;
  archived: number;
  total: number;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Announcement Repository 인터페이스
 *
 * 구현체:
 * - FirebaseAnnouncementRepository (프로덕션)
 * - MockAnnouncementRepository (테스트)
 */
export interface IAnnouncementRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 공지사항 조회
   * @param announcementId - 공지사항 ID
   * @returns 공지사항 또는 null
   */
  getById(announcementId: string): Promise<Announcement | null>;

  /**
   * 발행된 공지사항 목록 조회 (사용자용)
   * @param userRole - 사용자 역할 (대상 필터링용)
   * @param options - 페이지 크기, 커서
   * @returns 페이지네이션된 공지사항 목록
   */
  getPublished(
    userRole: UserRole | null,
    options?: FetchAnnouncementsOptions
  ): Promise<FetchAnnouncementsResult>;

  /**
   * 전체 공지사항 목록 조회 (관리자용)
   * @param options - 필터, 페이지 크기, 커서
   * @returns 페이지네이션된 공지사항 목록
   */
  getAll(options?: FetchAnnouncementsOptions): Promise<FetchAnnouncementsResult>;

  /**
   * 상태별 공지사항 수 조회 (관리자)
   * @returns 상태별 개수
   */
  getCountByStatus(): Promise<AnnouncementCountByStatus>;

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  /**
   * 공지사항 생성 (관리자)
   * @param authorId - 작성자 ID
   * @param authorName - 작성자 이름
   * @param input - 생성 입력 데이터
   * @returns 생성된 공지사항 ID
   */
  create(authorId: string, authorName: string, input: CreateAnnouncementInput): Promise<string>;

  // ==========================================================================
  // 수정 (Update)
  // ==========================================================================

  /**
   * 공지사항 수정 (관리자)
   * @param announcementId - 공지사항 ID
   * @param input - 수정 입력 데이터
   */
  update(announcementId: string, input: UpdateAnnouncementInput): Promise<void>;

  /**
   * 공지사항 발행 (관리자)
   * @param announcementId - 공지사항 ID
   */
  publish(announcementId: string): Promise<void>;

  /**
   * 공지사항 보관 (관리자)
   * @param announcementId - 공지사항 ID
   */
  archive(announcementId: string): Promise<void>;

  /**
   * 조회수 증가
   * @param announcementId - 공지사항 ID
   */
  incrementViewCount(announcementId: string): Promise<void>;

  // ==========================================================================
  // 삭제 (Delete)
  // ==========================================================================

  /**
   * 공지사항 삭제 (관리자)
   * @param announcementId - 공지사항 ID
   */
  delete(announcementId: string): Promise<void>;
}
