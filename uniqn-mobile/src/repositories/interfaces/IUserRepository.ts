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
   * 여러 사용자 ID로 프로필 배치 조회 (N+1 최적화)
   * @param userIds - 사용자 ID 배열
   * @returns 사용자 프로필 Map (userId -> profile)
   */
  getByIdBatch(userIds: string[]): Promise<Map<string, FirestoreUserProfile>>;

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
   * 사용자 문서 생성 또는 병합 (setDoc with merge:true)
   *
   * @description 문서가 없으면 생성, 있으면 기존 필드를 유지하면서 병합
   * @param userId - 사용자 ID
   * @param profile - 저장할 프로필 데이터
   */
  createOrMerge(userId: string, profile: Record<string, unknown>): Promise<void>;

  /**
   * 사용자 필드 업데이트 (updatedAt 자동 추가)
   *
   * @description updateDoc + serverTimestamp 자동 추가
   * @param userId - 사용자 ID
   * @param updates - 변경할 필드 (updatedAt은 자동 추가됨)
   */
  updateFields(userId: string, updates: Record<string, unknown>): Promise<void>;

  /**
   * 프로필 업데이트
   * @param userId - 사용자 ID
   * @param updates - 변경할 필드
   */
  updateProfile(userId: string, updates: Partial<MyDataEditableFields>): Promise<void>;

  /**
   * 회원탈퇴 요청 저장
   * @param userId - 사용자 ID
   * @param request - 탈퇴 요청 정보
   */
  requestDeletion(userId: string, request: Omit<DeletionRequest, 'userId'>): Promise<void>;

  /**
   * 회원탈퇴 요청 취소
   * @param userId - 사용자 ID
   */
  cancelDeletion(userId: string): Promise<void>;

  // ==========================================================================
  // 특수 작업 (Transaction)
  // ==========================================================================

  /**
   * 고아 계정 마킹 (삭제 실패 시 Firestore에 기록)
   *
   * @description Cloud Function Scheduler가 주기적으로 정리
   * @param uid - 사용자 ID
   * @param reason - 마킹 사유
   * @param phone - 전화번호 (선택)
   * @param platform - 플랫폼 정보
   */
  markAsOrphan(uid: string, reason: string, phone?: string, platform?: string): Promise<void>;

  /**
   * 구인자 등록 (Transaction으로 원자적 처리)
   *
   * @description staff → employer 역할 전환
   * - 현재 역할 검증 (이미 employer/admin이면 에러)
   * - 전화번호 인증 확인
   * - 역할 업데이트 + 동의 기록
   *
   * @param userId - 사용자 ID
   * @returns 업데이트된 프로필
   */
  registerAsEmployer(userId: string): Promise<FirestoreUserProfile>;

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
