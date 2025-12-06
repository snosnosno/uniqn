/**
 * penaltyUtils - 패널티 관련 유틸리티 함수
 *
 * @version 1.0
 * @since 2025-01-01
 */

/**
 * 패널티 남은 시간 계산
 * @param endDate 종료일 (Firestore Timestamp 또는 null)
 * @param t 번역 함수
 * @returns 남은 시간 문자열
 */
export const getRemainingTime = (
  endDate: { toDate: () => Date } | null,
  t: (key: string, options?: Record<string, unknown>) => string
): string => {
  // 영구 차단
  if (!endDate) {
    return t('penalty.permanent', { defaultValue: '영구 차단' });
  }

  const now = new Date();
  const end = endDate.toDate();
  const diffMs = end.getTime() - now.getTime();

  // 이미 만료됨
  if (diffMs <= 0) {
    return t('penalty.expiringNow', { defaultValue: '곧 해제 예정' });
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return t('penaltyBanner.remaining', { days: diffDays });
  } else {
    return t('penaltyBanner.remainingHours', { hours: diffHours || 1 });
  }
};
