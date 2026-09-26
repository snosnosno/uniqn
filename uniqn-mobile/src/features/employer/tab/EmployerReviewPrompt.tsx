/**
 * EmployerReviewPrompt — 내 공고 탭의 "작성할 평가" 안내 (UX 감사 H)
 *
 * 구인자가 써야 할 평가 대기 건은 `usePendingReviews` 가 이미 세고 있었지만, 그 신호가 뜨는
 * 자리는 '내 스케줄' 탭(스태프 관점 화면) 하나뿐이었다. 사장은 '내 공고' 탭에 머무므로
 * 평가 요청이 있다는 걸 알 길이 알림뿐이었다.
 *
 * - 구인자 몫(`reviewerType === 'employer'`)만 센다 — 스태프로 일한 근무 평가는 스케줄 탭 몫이다.
 * - 공고 목록의 헤더로 들어간다(스크롤과 함께 밀려난다). 탭 상단 고정 영역은 이미 밀도 예산
 *   (impeccable §34-3, 210px)을 넘겨 있어 고정 배너를 더 얹지 않는다.
 * - 0건이면 렌더하지 않는다.
 * - 알고 둔 것: 필터 결과가 0건이면 목록 대신 빈 상태가 그려져 이 안내도 같이 빠진다('전체'
 *   필터에선 공고가 있으면 늘 보인다). 훅은 스태프 몫 쿼리도 함께 돌리지만 캐시 키를 스케줄 탭과
 *   공유해 중복 요청은 아니다.
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import ReviewPromptBanner from '@/components/review/ReviewPromptBanner';
import { usePendingReviews } from '@/hooks/useReviews';

export function EmployerReviewPrompt() {
  const { pendingReviews } = usePendingReviews();
  const employerPendingCount = useMemo(
    () => pendingReviews.filter((item) => item.reviewerType === 'employer').length,
    [pendingReviews]
  );

  if (employerPendingCount === 0) return null;

  return (
    <View className="pb-2">
      <ReviewPromptBanner
        pendingCount={employerPendingCount}
        onPress={() => router.push('/(app)/reviews/history')}
      />
    </View>
  );
}
