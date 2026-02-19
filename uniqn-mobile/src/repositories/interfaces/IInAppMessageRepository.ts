/**
 * UNIQN Mobile - InAppMessage Repository Interface
 *
 * @description 인앱 메시지(InAppMessage) 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 인앱 메시지 읽기 전용 작업 캡슐화
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { InAppMessage } from '@/types/inAppMessage';

// ============================================================================
// Interface
// ============================================================================

/**
 * InAppMessage Repository 인터페이스
 *
 * 구현체:
 * - FirebaseInAppMessageRepository (프로덕션)
 * - MockInAppMessageRepository (테스트)
 */
export interface IInAppMessageRepository {
  /**
   * 활성 인앱 메시지 조회
   *
   * @description isActive=true인 메시지를 priority desc 순으로 최대 20건 조회
   * @returns 활성 인앱 메시지 배열
   */
  fetchActiveMessages(): Promise<InAppMessage[]>;
}
