/**
 * UNIQN Mobile - User Repository Interface
 *
 * @description 사용자(User) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 담당 기능:
 * - 사용자 프로필 조회/수정
 * - 회원탈퇴 요청/취소/상태 관리
 * - 개인정보 내보내기
 * - 계정 완전 삭제
 */

import type { Timestamp } from 'firebase/firestore';
import type { FirestoreUserProfile, MyDataEditableFields } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 회원탈퇴 사유
 */
export type DeletionReason =
  | 'no_longer_needed'
  | 'found_better_service'
  | 'privacy_concerns'
  | 'too_many_notifications'
  | 'difficult_to_use'
  | 'other';

/**
 * 회원탈퇴 요청 정보
 */
export interface DeletionRequest {
  userId: string;
  reason: DeletionReason;
  reasonDetail?: string;
  requestedAt: Timestamp;
  scheduledDeletionAt: Timestamp;
  status: 'pending' | 'cancelled' | 'completed';
}

/**
 * 사용자 데이터 내보내기 결과
 */
export interface UserDataExport {
  profile: FirestoreUserProfile;
  applications: {
    id: string;
    jobPostingTitle: string;
    status: string;
    createdAt: string;
  }[];
  workLogs: {
    id: string;
    date: string;
    checkInAt?: string;
    checkOutAt?: string;
  }[];
  exportedAt: string;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * User Repository 인터페이스
 *
 * 구현체:
 * - FirebaseUserRepository (프로덕션)
 * - MockUserRepository (테스트)
 */
export interface IUserRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 사용자 조회
   * @param userId - 사용자 ID
   * @returns 사용자 프로필 또는 null
   */
  getById(userId: string): Promise<FirestoreUserProfile | null>;

  /**
   * 사용자 존재 여부 확인
   * @param userId - 사용자 ID
   */
  exists(userId: string): Promise<boolean>;

  /**
   * 회원탈퇴 요청 상태 조회
   * @param userId - 사용자 ID
   * @returns 탈퇴 요청 정보 또는 null
   */
  getDeletionStatus(userId: string): Promise<DeletionRequest | null>;

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  /**
   * 프로필 업데이트
   * @param userId - 사용자 ID
   * @param updates - 변경할 필드
   */
  updateProfile(
    userId: string,
    updates: Partial<MyDataEditableFields>
  ): Promise<void>;

  /**
   * 회원탈퇴 요청 저장
   * @param userId - 사용자 ID
   * @param request - 탈퇴 요청 정보
   */
  requestDeletion(
    userId: string,
    request: Omit<DeletionRequest, 'userId'>
  ): Promise<void>;

  /**
   * 회원탈퇴 요청 취소
   * @param userId - 사용자 ID
   */
  cancelDeletion(userId: string): Promise<void>;

  // ==========================================================================
  // 데이터 내보내기 / 삭제
  // ==========================================================================

  /**
   * 사용자 관련 데이터 내보내기 조회
   * @param userId - 사용자 ID
   * @returns 지원 내역, 근무 기록 포함
   */
  getExportData(userId: string): Promise<UserDataExport>;

  /**
   * 계정 완전 삭제 (배치 처리)
   *
   * 처리 내용:
   * - 지원 내역 익명화 (applicantId → '[deleted]')
   * - 근무 기록 익명화 (staffId → '[deleted]')
   * - 알림 삭제
   * - 사용자 문서 삭제
   *
   * @param userId - 사용자 ID
   */
  permanentlyDeleteWithBatch(userId: string): Promise<void>;
}
