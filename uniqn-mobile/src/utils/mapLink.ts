/**
 * 근무지 주소 → 지도 앱 길찾기 링크.
 *
 * 처음 가는 홀덤펍에 정시 도착해야 하는 스태프가 앱을 나가 지도 앱에 주소를 손으로 다시
 * 치고 있었다. 같은 화면에서 전화번호는 탭 한 번에 걸리는데 주소만 막혀 있어 비일관성이
 * 더 크게 느껴진다. 신규 네이티브 의존성 없이 expo-linking 만으로 처리한다.
 */
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
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
 * 공백 경계로 둘러싸인 **완전 토큰** 포함인지.
 *
 * 단순 `includes` 면 `'강남구청길 5'` 가 `'강남구'` 를 품은 것으로 판정돼 시·구가 조용히 사라진다.
 */
function containsAsToken(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(haystack);
}

/**
 * 주소 + 상세주소를 사람이 읽을 한 줄로 합친다. 지도 검색어와 화면 표시가 **같은 규칙**을
 * 써야 해서 여기 한 곳에 둔다(따로 두면 한쪽만 고쳐지고 조용히 어긋난다).
 *
 * 규칙 순서:
 * 1. 한쪽이 다른 쪽을 **완전 토큰으로** 품고 있으면 넓은 쪽만 쓴다 — 자유입력 시절 데이터에서
 *    '강남구 서울 강남구 테헤란로 1' 같은 중복이 생기는 것을 막는다
 * 2. 주소가 **주소 꼴이 아니면**(장소 별칭 등 자유 텍스트) 덧붙이지 않는다 — 별칭을 지도에
 *    던지면 전혀 다른 곳으로 안내한다(위 실사고와 같은 클래스). 이 경우 예전 규칙 그대로 상세주소만
 * 3. 그 외에는 주소 뒤에 상세주소를 붙인다. B1 이후 상세주소는 '3층 301호' 조각이라
 *    단독으로는 어디인지 알 수 없다
 */
export function composeFullAddress(
  address?: string | null,
  detailedAddress?: string | null
): string {
  const addr = address?.trim();
  const detailed = detailedAddress?.trim();

  if (!addr) return detailed ?? '';
  if (!detailed) return addr;

  if (containsAsToken(detailed, addr)) return detailed;
  if (containsAsToken(addr, detailed)) return addr;
  if (!looksLikeAddress(addr)) return detailed;

  return `${addr} ${detailed}`;
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

// ─────────────────────────────────────────────────────────────────────────────
// 좌표 승격 (주소 검색 2단계 — B2)
// ─────────────────────────────────────────────────────────────────────────────
// 텍스트 검색은 핀이 뭉개진다 — '서울 강남구 테헤란로 152' 를 던지면 지도 앱이 나름대로
// 해석해 건물이 아니라 도로나 동네를 잡는 일이 흔하다. 좌표가 있으면 그 해석 단계가 통째로
// 사라진다. 그래서 좌표가 있으면 좌표 후보를 **앞에** 놓되, 텍스트 후보를 뒤에 남겨 둔다 —
// 스킴이 안 열리는 기기에서도 예전 동작이 그대로 살아 있어야 하기 때문이다.

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapDestination {
  /** 텍스트 검색어. 좌표가 없을 때의 유일한 근거 (`resolveMapQuery` 결과) */
  query: string | null;
  /** 근무지 좌표. 있으면 정밀 핀으로 승격된다 */
  coordinates?: MapCoordinates | null;
  /** 핀 라벨(장소명). 좌표 경로에서만 쓰인다 */
  label?: string;
}

function hasUsableCoordinates(value?: MapCoordinates | null): value is MapCoordinates {
  return Boolean(value) && Number.isFinite(value!.lat) && Number.isFinite(value!.lng);
}

/** 소수 6자리 ≈ 0.11m. 카카오가 주는 12자리를 그대로 URL 에 실을 이유가 없다. */
function formatDegrees(value: number): string {
  return value.toFixed(6);
}

/**
 * 좌표 URL 의 이름 자리에 넣을 라벨.
 *
 * 🔴 **쉼표와 괄호를 지운다.** 두 문자가 각각 다른 URL 형식의 구분자다:
 *    - 카카오 `link/to/{이름},{위도},{경도}` — 쉼표가 필드 구분자다. `encodeURIComponent` 가
 *      `%2C` 로 감싸 주긴 하지만, 상류가 경로를 디코드한 뒤 쉼표로 가르면 되살아나 좌표 자리가
 *      밀린다. 인코딩에 기대지 않고 값 자체에서 없앤다.
 *    - Android `geo:{lat},{lng}?q={lat},{lng}({라벨})` — 괄호가 라벨 구분자인데
 *      `encodeURIComponent` 는 `(`·`)` 를 인코딩하지 않는다. '라운더스(강남)' 이면 라벨이
 *      조기에 닫혀 URI 가 뭉개진다.
 *    둘 다 에러 없이 조용히 틀리는 종류의 실패다.
 */
function sanitizeLabel(label: string | undefined, fallback: string): string {
  const cleaned = label?.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

/** 좌표 기반 후보 URL. 지도 앱이 해석할 여지 없이 그 지점을 연다. */
export function buildMapCoordinateUrls(
  coordinates: MapCoordinates,
  label: string | undefined,
  platform: 'ios' | 'android' | 'web'
): string[] {
  if (!hasUsableCoordinates(coordinates)) return [];

  const lat = formatDegrees(coordinates.lat);
  const lng = formatDegrees(coordinates.lng);
  const name = sanitizeLabel(label, '근무지');
  const encodedName = encodeURIComponent(name);
  // 카카오 길찾기 목적지 — 웹·모바일 어디서나 열리는 공통 최후 후보.
  const kakaoTo = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;

  if (platform === 'ios') {
    // 🔴 여기에 `nmap://` 를 두지 않는다. iOS 는 `LSApplicationQueriesSchemes` 에 선언하지 않은
    //    스킴에 대해 `canOpenURL` 이 **설치 여부와 무관하게 false** 를 돌려주고, 이 앱에는 그
    //    선언이 없다(`app.config.ts` infoPlist). 그래서 네이버 후보는 게이트에 걸려 한 번도
    //    열린 적이 없었다 — 목록에만 있고 죽어 있는 후보였다. 네이버로 가고 싶으면 사용자가
    //    직접 고르는 경로(`buildMapUrlsForApp`)를 쓴다. 그쪽은 canOpenURL 을 아예 안 거친다.
    return [
      // 기본 지도 — 항상 열린다. `ll` 이 핀 위치, `q` 는 라벨.
      `https://maps.apple.com/?ll=${lat},${lng}&q=${encodedName}`,
      kakaoTo,
    ];
  }

  if (platform === 'android') {
    return [
      // geo: URI 표준 — `q=위도,경도(라벨)` 이어야 지도 앱이 검색이 아니라 핀으로 받는다.
      `geo:${lat},${lng}?q=${lat},${lng}(${encodedName})`,
      kakaoTo,
    ];
  }

  return [kakaoTo];
}

/**
 * 목적지 → 열어볼 URL 목록. 좌표 후보가 앞, 텍스트 후보가 뒤(폴백).
 *
 * 좌표가 없으면 B1 이전과 완전히 같은 동작이다.
 */
export function buildMapUrls(
  destination: MapDestination,
  platform: 'ios' | 'android' | 'web'
): string[] {
  const textUrls = destination.query ? buildMapSearchUrls(destination.query, platform) : [];
  if (!hasUsableCoordinates(destination.coordinates)) return textUrls;

  const label = destination.label ?? destination.query ?? undefined;
  return [...buildMapCoordinateUrls(destination.coordinates, label, platform), ...textUrls];
}

/** 지도 앱 후보 URL 목록. 앞에서부터 열 수 있는 첫 번째를 쓴다. */
export function buildMapSearchUrls(query: string, platform: 'ios' | 'android' | 'web'): string[] {
  const encoded = encodeURIComponent(query.trim());
  if (!encoded) return [];

  if (platform === 'ios') {
    // `nmap://` 를 두지 않는 이유는 `buildMapCoordinateUrls` 의 주석과 같다 — canOpenURL 게이트.
    return [`https://maps.apple.com/?q=${encoded}`]; // 기본 지도 — 항상 열린다
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

// ─────────────────────────────────────────────────────────────────────────────
// 지도 앱 선택 (사용자가 실제로 쓰는 지도로 열기)
// ─────────────────────────────────────────────────────────────────────────────
// 기본 경로(`buildMapUrls`)는 "기기가 기본으로 정한 지도"로 간다. 그런데 국내 사용자 대부분은
// 카카오맵·네이버지도를 쓰고, 기본 지도(Apple 지도 / Google 지도)는 국내 상호 검색이 약하다.
// 그래서 **사용자가 직접 고르는 경로**를 따로 둔다.
//
// 🔑 이 경로는 `canOpenURL` 을 **일부러 거치지 않는다**:
//   - iOS: `LSApplicationQueriesSchemes` 미선언 스킴은 설치돼 있어도 false (기본 경로가 이것 때문에
//     네이버를 못 열었다). `openURL` 은 그 제약을 받지 않는다.
//   - Android: API 30+ 패키지 가시성은 **조회(queryIntentActivities)** 만 막고 **실행(startActivity)**
//     은 막지 않는다. 즉 `canOpenURL` 만 거짓말하고 `openURL` 은 정상 동작한다.
//   대신 미설치 앱을 미리 걸러낼 수 없으므로, 후보 마지막은 반드시 **항상 열리는 웹 링크**여야 한다.

export type MapAppId = 'kakao' | 'naver' | 'system';

/** 선택 시트에 노출할 순서 — 국내 사용률 순, 기본 지도는 탈출구로 맨 뒤. */
export const MAP_APP_CHOICES = ['kakao', 'naver', 'system'] as const;

export const MAP_APP_LABELS: Record<MapAppId, string> = {
  kakao: '카카오맵',
  naver: '네이버지도',
  system: '기본 지도',
};

/** 저장소에서 읽은 값을 그대로 믿지 않는다 — 구버전 키·손상된 값이 그대로 URL 로 흘러가면 안 된다. */
export function isMapAppId(value: unknown): value is MapAppId {
  return MAP_APP_CHOICES.includes(value as MapAppId);
}

/**
 * 네이버 URL 스킴의 `appname` — **모든 nmap:// URL 에 필수**다.
 * 빠지면 네이버 앱이 에러 화면을 띄운다. 못 얻으면 네이티브 후보를 통째로 빼는 쪽이 낫다.
 */
function resolveNaverAppName(platform: 'ios' | 'android' | 'web'): string | null {
  const identifier =
    platform === 'ios'
      ? Constants.expoConfig?.ios?.bundleIdentifier
      : Constants.expoConfig?.android?.package;

  return identifier ? encodeURIComponent(identifier) : null;
}

/**
 * 카카오맵 후보.
 *
 * ⚠️ `route` 의 출발지(`sp`)를 생략해 현위치를 쓰게 한다. 공식 문서 예제에는 `sp` 가 늘 있고
 *    생략 가능 여부는 명시돼 있지 않다 — 인식되지 않으면 카카오맵 홈이 열린다(문서: "지원하지
 *    않는 액션은 지도앱 열기와 동일 처리"). 목적지를 잃는 게 아니라 한 단계 덜 간 상태라
 *    허용 가능한 열화지만, **실기기 확인이 필요한 지점**이다.
 * @see https://apis.map.kakao.com/ios_v2/docs/getting-started/urlscheme/
 */
function buildKakaoUrls(
  destination: MapDestination,
  platform: 'ios' | 'android' | 'web'
): string[] {
  const urls: string[] = [];
  const isNative = platform !== 'web';

  if (hasUsableCoordinates(destination.coordinates)) {
    const lat = formatDegrees(destination.coordinates.lat);
    const lng = formatDegrees(destination.coordinates.lng);
    const name = sanitizeLabel(destination.label ?? destination.query ?? undefined, '근무지');

    if (isNative) {
      urls.push(`kakaomap://route?ep=${lat},${lng}&by=car`);
      // 길찾기가 안 잡혀도 최소한 그 지점 지도는 연다.
      urls.push(`kakaomap://look?p=${lat},${lng}`);
    }
    urls.push(`https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`);
  }

  const query = destination.query?.trim();
  if (query) {
    const encoded = encodeURIComponent(query);
    if (isNative) urls.push(`kakaomap://search?q=${encoded}`);
    urls.push(`https://map.kakao.com/link/search/${encoded}`);
  }

  return urls;
}

/**
 * 네이버지도 후보.
 *
 * 출발지(`slat`/`slng`)는 싣지 않는다 — 생략하면 현위치가 출발지가 된다. 도착지 좌표를 실수로
 * 출발지 자리에 넣으면 "현재 위치에서 현재 위치로" 가 되어 길찾기가 조용히 무의미해진다.
 * @see https://guide.ncloud-docs.com/docs/maps-url-scheme
 */
function buildNaverUrls(
  destination: MapDestination,
  platform: 'ios' | 'android' | 'web'
): string[] {
  const urls: string[] = [];
  const appName = platform === 'web' ? null : resolveNaverAppName(platform);
  const query = destination.query?.trim();

  if (hasUsableCoordinates(destination.coordinates)) {
    const lat = formatDegrees(destination.coordinates.lat);
    const lng = formatDegrees(destination.coordinates.lng);
    const name = sanitizeLabel(destination.label ?? query ?? undefined, '근무지');
    const encodedName = encodeURIComponent(name);

    if (appName) {
      urls.push(`nmap://route/car?dlat=${lat}&dlng=${lng}&dname=${encodedName}&appname=${appName}`);
      urls.push(`nmap://place?lat=${lat}&lng=${lng}&name=${encodedName}&appname=${appName}`);
    }
  }

  if (query) {
    const encoded = encodeURIComponent(query);
    if (appName) urls.push(`nmap://search?query=${encoded}&appname=${appName}`);
    // 네이버 웹 지도는 좌표 딥링크 규격이 공개돼 있지 않다 — 주소 텍스트가 있을 때만 쓴다.
    urls.push(`https://map.naver.com/p/search/${encoded}`);
  }

  // 네이버 웹으로 못 보내는 경우(좌표만 있는 공고)에도 무반응으로 끝나면 안 된다.
  // 카카오 웹 링크는 좌표를 그대로 받으므로 최후 착지점으로 쓴다.
  if (urls.length === 0 || !urls[urls.length - 1].startsWith('https://')) {
    urls.push(...buildKakaoUrls(destination, 'web'));
  }

  return urls;
}

/** 특정 지도 앱으로 열 후보 URL 목록. 앞에서부터 열리는 첫 번째를 쓴다. */
export function buildMapUrlsForApp(
  destination: MapDestination,
  platform: 'ios' | 'android' | 'web',
  app: MapAppId
): string[] {
  if (app === 'kakao') return buildKakaoUrls(destination, platform);
  if (app === 'naver') return buildNaverUrls(destination, platform);
  return buildMapUrls(destination, platform);
}

/**
 * 목적지로 지도 앱을 연다. 좌표가 있으면 정밀 핀, 없으면 주소 텍스트 검색.
 *
 * @param app 사용자가 고른 지도 앱. 생략하면 기기 기본 지도 경로(예전 동작 그대로).
 * @returns 하나라도 열렸으면 true. 전부 실패하면 false (호출부가 안내를 띄운다)
 */
export async function openMapDestination(
  destination: MapDestination,
  app?: MapAppId
): Promise<boolean> {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  if (app && app !== 'system') {
    // 사용자가 명시적으로 고른 앱 — canOpenURL 을 거치면 설치돼 있어도 걸러진다(위 주석).
    return openFirstAvailable(buildMapUrlsForApp(destination, platform, app), { probe: false });
  }

  return openFirstAvailable(buildMapUrls(destination, platform), { probe: true });
}

// 주소 텍스트 전용 진입점(`openMapSearch`)은 두지 않는다 — `openMapDestination({ query })` 가
// 정확히 같은 일을 하고, 좌표가 생겼을 때 호출부가 옛 진입점에 머무르면 승격이 조용히 누락된다.

async function openFirstAvailable(
  urls: string[],
  { probe }: { probe: boolean } = { probe: true }
): Promise<boolean> {
  for (const url of urls) {
    try {
      // 웹 https 링크는 canOpenURL 이 false 를 돌려주는 환경이 있어 마지막 후보는 그냥 시도한다.
      const isLast = url === urls[urls.length - 1];
      if (probe && !isLast && !(await Linking.canOpenURL(url))) continue;

      await Linking.openURL(url);
      return true;
    } catch (error) {
      logger.warn('지도 앱 열기 실패 — 다음 후보 시도', { url, message: (error as Error).message });
    }
  }

  return false;
}
