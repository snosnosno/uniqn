/**
 * 길찾기에 쓸 지도 앱 취향 저장.
 *
 * 근무지로 가는 길은 한 사람이 반복해서 여는 동작이라, 매번 어떤 지도로 열지 고르게 하면
 * 그 자체가 마찰이 된다. 한 번 고르면 기억하고 다음부터는 바로 연다.
 *
 * 사용자 스코프가 아니라 **기기 스코프**다 — "나는 카카오맵을 쓴다" 는 계정이 아니라 손에
 * 붙은 습관이라, 로그아웃해도 지우지 않는다.
 */
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/mmkvStorage';
import { isMapAppId, type MapAppId } from '@/utils/mapLink';

/**
 * 저장된 지도 앱. 없거나 알 수 없는 값이면 null — 호출부가 선택 시트를 띄운다.
 *
 * 🔑 `isMapAppId` 로 거른다. 저장소 값은 앱 구버전이 남긴 것일 수 있고, 검증 없이 통과시키면
 *    URL 빌더가 조용히 기본 경로로 떨어져 "고른 앱이 안 열린다" 는 재현 어려운 버그가 된다.
 */
export function getMapAppPreference(): MapAppId | null {
  const stored = getStorageItem<unknown>(STORAGE_KEYS.MAP_APP_PREFERENCE);
  return isMapAppId(stored) ? stored : null;
}

export function setMapAppPreference(app: MapAppId): void {
  setStorageItem(STORAGE_KEYS.MAP_APP_PREFERENCE, app);
}
