/**
 * 구인자 신청 거절 사유 라벨 (신청자에게 보이는 말).
 *
 * 🔑 DB 트리거 `notify_employer_application_change()` 의 거절 알림 본문과 **같은 문자열**이어야 한다
 *    (마이그 20260927100000). 여기만 바꾸면 화면과 푸시가 서로 다른 말을 한다.
 *    키 집합 = DB CHECK `employer_applications_rejection_category_check` 4값.
 */
export const EMPLOYER_REJECTION_CATEGORY_LABELS: Record<string, string> = {
  duplicate: '중복 계정',
  dummy: '실사용 확인이 어려운 계정',
  identity_mismatch: '본인인증 불일치',
  other: '기타',
};

/** 알 수 없는 값(향후 추가 등)은 코드를 노출하지 않고 '기타'로 접는다. */
export function getEmployerRejectionCategoryLabel(category: string): string {
  return EMPLOYER_REJECTION_CATEGORY_LABELS[category] ?? '기타';
}
