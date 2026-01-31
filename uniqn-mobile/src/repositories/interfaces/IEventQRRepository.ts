/**
 * UNIQN Mobile - Event QR Repository Interface
 *
 * @description 이벤트 QR 코드 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. QR 코드 CRUD 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { EventQRCode, QRCodeAction } from '@/types';

// ============================================================================
// Interface
// ============================================================================

/**
 * Event QR Repository 인터페이스
 *
 * 구현체:
 * - FirebaseEventQRRepository (프로덕션)
 * - MockEventQRRepository (테스트)
 */
export interface IEventQRRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  /**
   * ID로 QR 코드 조회
   * @param qrId - QR 코드 문서 ID
   * @returns QR 코드 또는 null
   */
  getById(qrId: string): Promise<EventQRCode | null>;

  /**
   * 공고/날짜/액션별 활성 QR 코드 조회
   * @param jobPostingId - 공고 ID
   * @param date - 날짜 (YYYY-MM-DD)
   * @param action - 출근/퇴근
   * @returns 활성 QR 코드 또는 null (만료 시 자동 비활성화)
   */
  getActiveByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction
  ): Promise<EventQRCode | null>;

  /**
   * 보안 코드 검증
   * @description 서버 측 QR 검증 시 사용
   * @returns 유효한 QR 코드 또는 null
   */
  validateSecurityCode(
    jobPostingId: string,
    date: string,
    action: QRCodeAction,
    securityCode: string
  ): Promise<EventQRCode | null>;

  // ==========================================================================
  // 생성 (Create)
  // ==========================================================================

  /**
   * QR 코드 생성
   * @param data - QR 코드 데이터 (id 제외)
   * @returns 생성된 문서 ID
   */
  create(data: Omit<EventQRCode, 'id'>): Promise<string>;

  // ==========================================================================
  // 업데이트 (Update)
  // ==========================================================================

  /**
   * QR 코드 비활성화
   * @param qrId - QR 코드 문서 ID
   */
  deactivate(qrId: string): Promise<void>;

  /**
   * 공고/날짜/액션별 기존 QR 코드 비활성화
   * @description 새 QR 생성 전 기존 활성 QR 비활성화
   * @returns 비활성화된 QR 코드 수
   */
  deactivateByJobAndDate(
    jobPostingId: string,
    date: string,
    action: QRCodeAction
  ): Promise<number>;

  // ==========================================================================
  // 정리 (Cleanup)
  // ==========================================================================

  /**
   * 만료된 QR 코드 일괄 비활성화
   * @description 백그라운드 작업용
   * @returns 비활성화된 QR 코드 수
   */
  deactivateExpired(): Promise<number>;
}
