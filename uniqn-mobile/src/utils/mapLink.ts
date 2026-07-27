/**
 * 근무지 주소 → 지도 앱 길찾기 링크.
 *
 * 처음 가는 홀덤펍에 정시 도착해야 하는 스태프가 앱을 나가 지도 앱에 주소를 손으로 다시
 * 치고 있었다. 같은 화면에서 전화번호는 탭 한 번에 걸리는데 주소만 막혀 있어 비일관성이
 * 더 크게 느껴진다. 신규 네이티브 의존성 없이 expo-linking 만으로 처리한다.
 */
import { Linking, Platform } from 'react-native';
import { logger } from './logger';

/** 지도 앱 후보 URL 목록. 앞에서부터 열 수 있는 첫 번째를 쓴다. */
export function buildMapSearchUrls(query: string, platform: 'ios' | 'android' | 'web'): string[] {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) return [];

  if (platform === 'ios') {
    return [
      `nmap://search?query=${encoded}`, // 네이버 지도 (국내 사용률 1위)
      `https://maps.apple.com/?q=${encoded}`, // 기본 지도 — 항상 열린다
    ];
  }

  if (platform === 'android') {
    return [
      `geo:0,0?q=${encoded}`, // 설치된 지도 앱 선택 다이얼로그
      `https://map.kakao.com/link/search/${encoded}`,
    ];
  }

  // 웹 빌드는 새 탭으로 지도 검색을 연다.
  return [`https://map.kakao.com/link/search/${encoded}`];
}

/**
 * 주소로 지도 앱을 연다.
 *
 * @returns 하나라도 열렸으면 true. 전부 실패하면 false (호출부가 안내를 띄운다)
 */
export async function openMapSearch(query: string): Promise<boolean> {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const urls = buildMapSearchUrls(query, platform);

  for (const url of urls) {
    try {
      // 웹 https 링크는 canOpenURL 이 false 를 돌려주는 환경이 있어 마지막 후보는 그냥 시도한다.
      const isLast = url === urls[urls.length - 1];
      if (!isLast && !(await Linking.canOpenURL(url))) continue;

      await Linking.openURL(url);
      return true;
    } catch (error) {
      logger.warn('지도 앱 열기 실패 — 다음 후보 시도', { url, message: (error as Error).message });
    }
  }

  return false;
}
