/**
 * 근무지 주소 → 지도 앱 길찾기 링크.
 *
 * 처음 가는 홀덤펍에 정시 도착해야 하는 스태프가 앱을 나가 지도 앱에 주소를 손으로 다시
 * 치고 있었다. 같은 화면에서 전화번호는 탭 한 번에 걸리는데 주소만 막혀 있어 비일관성이
 * 더 크게 느껴진다. 신규 네이티브 의존성 없이 expo-linking 만으로 처리한다.
 */
import { Linking, Platform } from 'react-native';
import { logger } from './logger';

/**
 * 주소 꼴 판정.
 *
 * 행정구역·도로명 어미가 있거나, 번지 숫자를 낀 두 토막 이상이면 주소로 본다.
 * '홈'·'홈게임' 같은 장소 별칭을 지도에 던지면 전혀 다른 곳으로 안내하므로(실사고),
 * 확신이 없으면 검색하지 않는 쪽을 택한다.
 */
function looksLikeAddress(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  const hasAdministrativeSuffix =
    /(특별시|광역시|시|도|군|구|읍|면|동|리|로|길|가|번지)(\s|$)/.test(trimmed);
  const hasBuildingNumber = /\d/.test(trimmed) && trimmed.split(/\s+/).length >= 2;

  return hasAdministrativeSuffix || hasBuildingNumber;
}

export interface MapQueryInput {
  /** 공고 장소명 (예: '라운더스 홀덤펍') — 주소가 아닐 수 있다 */
  placeName?: string;
  /**
   * 공고 상세주소. 주소 검색 도입(B1) 이후로는 **층/호 조각**('3층 301호')이다.
   * 그 이전 자유입력 공고에는 번지까지 담긴 사실상 전체 주소가 들어 있다 — 둘 다 살아 있다.
   */
  detailedAddress?: string;
  /** 공고 주소(주문서 주소 검색 결과 = 도로명주소. canonical 에서는 district 로 저장된다) */
  address?: string;
}

/**
 * 주소 + 상세주소를 사람이 읽을 한 줄로 합친다. 지도 검색어와 화면 표시가 **같은 규칙**을
 * 써야 해서 여기 한 곳에 둔다(따로 두면 한쪽만 고쳐지고 조용히 어긋난다).
 *
 * - 상세주소가 이미 주소를 통째로 품고 있으면(자유입력 시절 데이터) 덧붙이지 않는다 —
 *   '강남구 서울 강남구 테헤란로 1' 같은 중복이 생긴다
 * - 그 외에는 주소 뒤에 상세주소를 붙인다. B1 이후 상세주소는 '3층 301호' 조각이라
 *   단독으로는 어디인지 알 수 없다
 */
export function composeFullAddress(
  address?: string | null,
  detailedAddress?: string | null
): string {
  const addr = address?.trim();
  const detailed = detailedAddress?.trim();

  if (!addr) return detailed ?? '';
  if (!detailed) return addr;
  return detailed.includes(addr) ? detailed : `${addr} ${detailed}`;
}

/**
 * 지도 검색어 결정. 안내할 수 있는 근거가 없으면 null 을 돌려 호출부가 길찾기를 감춘다.
 *
 * 주소와 상세주소가 둘 다 있으면 **합친다**. 어느 한쪽만 던지면 어딘가에서 틀리기 때문:
 * - 상세주소만 → B1 이후 데이터에서는 '3층 301호' 를 지도에 던지게 된다(위 실사고와 같은 클래스)
 * - 주소만 → 레거시 데이터에서는 '강남구' 같은 구 단위만 남아 핀이 뭉개진다
 *
 * 단, 상세주소가 이미 주소를 통째로 품고 있으면(자유입력 시절 데이터) 덧붙여봐야
 * '강남구 서울 강남구 테헤란로 1' 처럼 중복만 생기므로 상세주소를 그대로 쓴다.
 * 부분 문자열 포함 검사라 추측이 아니다 — '101동 502호' 같은 조각을 주소로 오인하지 않는다.
 *
 * 폴백: 주소·상세주소가 전혀 없을 때만 (주소 꼴인 경우에 한해) 장소명.
 */
export function resolveMapQuery({
  placeName,
  detailedAddress,
  address,
}: MapQueryInput): string | null {
  const composed = composeFullAddress(address, detailedAddress);
  if (composed) return composed;

  const name = placeName?.trim();
  if (name && looksLikeAddress(name)) return name;

  return null;
}

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
