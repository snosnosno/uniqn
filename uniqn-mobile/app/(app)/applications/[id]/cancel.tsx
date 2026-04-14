/**
 * UNIQN Mobile - Application Cancel Redirect
 *
 * @description 레거시 딥링크/북마크 호환을 위한 redirect wrapper.
 *              실제 취소 요청 UI는 schedule 탭의 인라인 바텀시트로 통합되었습니다.
 *              (uniqn-mobile UX 통합 — C5/U3-b)
 */

import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function CancellationRequestRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    // no-op: rendering Redirect handles navigation
  }, []);

  if (!id) {
    return <Redirect href="/(app)/(tabs)/schedule" />;
  }

  return <Redirect href={`/(app)/(tabs)/schedule?cancelApplicationId=${id}`} />;
}
