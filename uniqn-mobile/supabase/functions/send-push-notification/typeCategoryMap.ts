// =============================================================================
// 알림 타입 → 카테고리 매핑 (서버 사본)
// =============================================================================
// SSOT: uniqn-mobile/src/types/notification.ts 의 NOTIFICATION_TYPE_TO_CATEGORY.
// Edge Function(Deno)은 앱 번들을 import할 수 없어 사본을 둔다.
// 드리프트 가드: src/services/notifications/internal/__tests__/typeCategoryMapDrift.test.ts
// 가 이 파일과 SSOT의 완전 일치를 jest로 강제한다 — 타입 추가/변경 시 양쪽 함께 수정.
//
// 주의: Deno 전용 문법 금지(jest에서도 import되는 순수 상수 파일).

export const TYPE_CATEGORY_MAP: Record<string, string> = {
  // 지원 관련
  new_application: 'application',
  application_cancelled: 'application',
  application_confirmed: 'application',
  confirmation_cancelled: 'application',
  application_rejected: 'application',
  cancellation_approved: 'application',
  cancellation_rejected: 'application',
  cancellation_requested: 'application',

  // 출퇴근/스케줄 관련
  staff_checked_in: 'attendance',
  staff_checked_out: 'attendance',
  check_in_confirmed: 'attendance',
  check_out_confirmed: 'attendance',
  checkin_reminder: 'attendance',
  no_show_alert: 'attendance',
  schedule_change: 'attendance',
  schedule_created: 'attendance',
  schedule_cancelled: 'attendance',

  // 정산 관련
  settlement_completed: 'settlement',
  settlement_requested: 'settlement',
  negative_settlement_alert: 'admin',

  // 공고 관련
  job_updated: 'job',
  job_cancelled: 'job',
  job_closed: 'job',
  fixed_posting_expired: 'job',
  work_date_expired: 'job',

  // 시스템
  announcement: 'system',
  maintenance: 'system',
  app_update: 'system',
  board_comment: 'system',
  board_reply: 'system',
  board_mention: 'system',
  board_locked: 'system',

  // 관리자
  inquiry_answered: 'admin',
  report_resolved: 'admin',
  new_report: 'admin',
  new_inquiry: 'admin',
  tournament_approval_request: 'admin',
  employer_app_submitted: 'system',
  employer_app_approved: 'system',
  employer_app_rejected: 'system',
  new_employer_application: 'admin',
  role_changed: 'system',

  // 리뷰/평가 관련
  review_request: 'review',
  review_received: 'review',
  review_reminder: 'review',

  // 워크스페이스 협업
  workspace_invitation: 'system',
};
