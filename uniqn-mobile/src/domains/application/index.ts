/**
 * UNIQN Mobile - 지원(application) 도메인 파사드
 *
 * ⚠️ **실제로 `@/domains/application` 경로로 소비되는 심볼만** 재수출한다.
 * 타입·헬퍼 대부분은 `@/types/application`·`@/types/assignment` 등 원산지 경로로 직접
 * 쓰이며, 안 쓰이는 재수출을 쌓아두면 진짜 죽은 코드가 묻힌다. 필요해지면 그때 추가하라.
 */

export { TBA_TIME_MARKER, getAssignmentRoles } from '@/types/assignment';

export {
  PRE_QUESTION_TYPE_LABELS,
  findUnansweredRequired,
  initializePreQuestionAnswers,
  updateAnswer,
  validateRequiredAnswers,
} from '@/types/preQuestion';

export { createHistoryEntry, findActiveConfirmation } from '@/types/applicationHistory';

export { applicationValidator } from './ApplicationValidator';

export { validateAssignmentSlotCapacity } from './slotCapacity';

// ApplicationStatusMachine 은 제거됐다(2026-07-27). 전이표·상태 메타·취소 가드를 담고 있었지만
// 앱 어디서도 소비하지 않았고, 같은 규칙이 ApplicationRepository 에 독립 구현돼 그쪽만 실행됐다.
// 규칙이 두 벌이면 다음 수정자가 죽은 쪽을 고칠 위험이 있어 단일화했다.
