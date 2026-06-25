/**
 * 미작성 평가 화면은 평점관리 허브(history)의 '미작성' 탭으로 통합됨.
 * 기존 reviews/pending 딥링크 호환을 위해 허브로 redirect.
 */
import { Redirect } from 'expo-router';

export default function PendingReviewsRedirect() {
  return <Redirect href="/(app)/reviews/history" />;
}
