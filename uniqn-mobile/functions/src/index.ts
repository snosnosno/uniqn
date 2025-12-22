/**
 * UNIQN Mobile - Firebase Cloud Functions
 *
 * @description 서버리스 백엔드 함수 모음
 * @version 1.0.0
 *
 * 기능:
 * - 알림 트리거 (지원, 출퇴근, 정산)
 * - 스케줄 작업 (리마인더, No-show 체크)
 * - 데이터 정리 (계정 삭제, 오래된 알림)
 */

import * as admin from 'firebase-admin';

// Firebase Admin 초기화
admin.initializeApp();

// ============================================================================
// 알림 트리거 함수
// ============================================================================

export {
  onApplicationCreated,
  onApplicationStatusChanged,
} from './triggers/applicationTriggers';

export {
  onCheckIn,
  onCheckOut,
  onWorkTimeChanged,
} from './triggers/workLogTriggers';

export {
  onSettlementCompleted,
} from './triggers/settlementTriggers';

// ============================================================================
// 스케줄 함수
// ============================================================================

export {
  sendCheckinReminders,
  checkNoShow,
  cleanupOldNotifications,
} from './scheduled/scheduledTasks';

// ============================================================================
// Callable 함수
// ============================================================================

export {
  deleteUserAccount,
  exportUserData,
} from './callable/accountFunctions';
