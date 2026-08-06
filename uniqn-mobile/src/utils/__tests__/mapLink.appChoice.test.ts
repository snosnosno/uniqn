/**
 * mapLink 지도 앱 선택 회귀 테스트.
 *
 * 배경: 길찾기가 항상 기기 기본 지도로만 열렸다. iOS 후보 목록에는 `nmap://` 가 맨 앞에
 * 있었지만 `Linking.canOpenURL` 게이트에 걸려 **한 번도 열린 적이 없다** — iOS 는
 * `LSApplicationQueriesSchemes` 에 선언하지 않은 스킴에 대해 설치 여부와 무관하게 false 를
 * 돌려주고, `app.config.ts` 에는 그 선언이 없다.
 *
 * 여기서 고정하는 불변식:
 *   1. 사용자가 고른 앱의 후보는 **네이티브 스킴이 먼저**여야 한다(웹이 먼저면 브라우저로 샌다)
 *   2. 마지막 후보는 항상 열리는 웹 링크여야 한다 — 앱 미설치가 무반응으로 끝나면 안 된다
 *   3. 네이버는 `appname` 이 **필수**다. 못 얻으면 네이티브 후보를 통째로 빼야 한다
 *      (빠진 채로 열면 네이버 앱이 에러 화면을 띄운다 — 다음 후보보다 나쁘다)
 *   4. 좌표가 있으면 좌표 후보가 텍스트 후보보다 앞
 */
import { buildMapUrlsForApp, isMapAppId, MAP_APP_CHOICES } from '@/utils/mapLink';

// 실측값(2026-08-03 prod 지오코딩): '서울 강남구 테헤란로 152'
const GANGNAM = { lat: 37.5000242405515, lng: 127.036508620542 };
const DEST = { query: '서울 강남구 테헤란로 152', coordinates: GANGNAM, label: '라운더스' };

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      ios: { bundleIdentifier: 'app.uniqn.mobile' },
      android: { package: 'app.uniqn.mobile' },
    },
  },
}));

describe('isMapAppId', () => {
  it('알려진 앱 id 만 통과시킨다 — 저장소에서 읽은 값을 그대로 믿으면 안 된다', () => {
    expect(MAP_APP_CHOICES.every(isMapAppId)).toBe(true);
    expect(isMapAppId('tmap')).toBe(false);
    expect(isMapAppId(null)).toBe(false);
    expect(isMapAppId(undefined)).toBe(false);
  });
});

describe('buildMapUrlsForApp — 카카오맵', () => {
  it('네이티브 길찾기 스킴이 먼저, 웹 링크가 마지막이다', () => {
    const urls = buildMapUrlsForApp(DEST, 'android', 'kakao');

    expect(urls[0]).toBe('kakaomap://route?ep=37.500024,127.036509&by=car');
    expect(urls[urls.length - 1]).toContain('https://map.kakao.com/link/');
  });

  it('🔴 좌표 순서는 위도,경도다 — 뒤집히면 지구 반대편이 열린다', () => {
    const [first] = buildMapUrlsForApp(DEST, 'ios', 'kakao');
    const [lat, lng] = first.split('ep=')[1].split('&')[0].split(',');

    expect(Number(lat)).toBeCloseTo(37.5, 1);
    expect(Number(lng)).toBeCloseTo(127.04, 1);
  });

  it('좌표가 없으면 텍스트 검색 스킴으로 간다', () => {
    const urls = buildMapUrlsForApp({ query: '서울 강남구 테헤란로 152' }, 'android', 'kakao');

    expect(urls[0]).toBe(`kakaomap://search?q=${encodeURIComponent('서울 강남구 테헤란로 152')}`);
    expect(urls[urls.length - 1]).toContain('/link/search/');
  });
});

describe('buildMapUrlsForApp — 네이버지도', () => {
  it('네이티브 길찾기 스킴이 먼저이고 appname 을 싣는다', () => {
    const urls = buildMapUrlsForApp(DEST, 'ios', 'naver');

    expect(urls[0]).toContain('nmap://route/car?');
    expect(urls[0]).toContain('dlat=37.500024');
    expect(urls[0]).toContain('dlng=127.036509');
    expect(urls[0]).toContain('appname=app.uniqn.mobile');
  });

  it('🔴 도착지 좌표를 slat/slng 에 싣지 않는다 — 출발지 자리에 들어가면 길찾기가 무의미해진다', () => {
    const [first] = buildMapUrlsForApp(DEST, 'android', 'naver');

    expect(first).not.toContain('slat=');
    expect(first).not.toContain('slng=');
  });

  it('앱 미설치 대비 웹 지도 링크로 끝난다', () => {
    const urls = buildMapUrlsForApp(DEST, 'ios', 'naver');
    const last = urls[urls.length - 1];

    expect(last.startsWith('https://')).toBe(true);
  });
});

describe('buildMapUrlsForApp — 기본 지도', () => {
  it('iOS 는 Apple 지도로 간다 — 네이버 스킴은 canOpenURL 게이트에 막혀 열린 적이 없다', () => {
    const urls = buildMapUrlsForApp(DEST, 'ios', 'system');

    expect(urls.some((u) => u.startsWith('nmap://'))).toBe(false);
    expect(urls[0]).toContain('https://maps.apple.com/?ll=');
  });

  it('Android 는 geo: 로 OS 기본 지도에 넘긴다', () => {
    const urls = buildMapUrlsForApp(DEST, 'android', 'system');

    expect(urls[0]).toMatch(/^geo:37\.500024,127\.036509/);
  });
});

describe('buildMapUrlsForApp — 공통', () => {
  it.each(MAP_APP_CHOICES)('%s: 안내 근거가 전혀 없으면 후보가 비어 있다', (app) => {
    expect(buildMapUrlsForApp({ query: null }, 'android', app)).toEqual([]);
  });

  it.each(MAP_APP_CHOICES)('%s: 좌표 후보가 텍스트 후보보다 앞이다', (app) => {
    const urls = buildMapUrlsForApp(DEST, 'android', app);
    const firstTextIndex = urls.findIndex((u) => u.includes(encodeURIComponent(DEST.query)));

    // 좌표 후보가 하나 이상 앞에 있어야 한다(텍스트가 0번이면 좌표 승격이 통째로 빠진 것).
    expect(firstTextIndex).toBeGreaterThan(0);
  });
});
