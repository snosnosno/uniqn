/**
 * mapLink 좌표 승격 회귀 테스트 (주소 검색 2단계 — B2).
 *
 * 텍스트 검색은 지도 앱이 주소를 나름대로 해석하는 단계를 거쳐 핀이 뭉개진다. 좌표가 있으면
 * 그 단계가 사라진다. 여기서 고정하는 것은 **조용히 틀리는** 실패들이다:
 *   - 위도/경도 자리 바꿔 넣기(카카오는 x=경도, y=위도라 직관과 반대다)
 *   - 장소명의 쉼표가 카카오 `link/map/{이름},{위도},{경도}` 의 필드 구분자를 깨는 것
 *   - 좌표 후보만 남기고 텍스트 폴백을 잃는 것
 */
import { buildMapCoordinateUrls, buildMapUrls } from '@/utils/mapLink';

// 실측값(2026-08-03 prod 지오코딩): '서울 강남구 테헤란로 152'
const GANGNAM = { lat: 37.5000242405515, lng: 127.036508620542 };

describe('buildMapCoordinateUrls', () => {
  it('카카오 지도 링크는 이름,위도,경도 순서로 만든다', () => {
    const urls = buildMapCoordinateUrls(GANGNAM, '라운더스', 'web');

    expect(urls).toEqual([
      'https://map.kakao.com/link/map/%EB%9D%BC%EC%9A%B4%EB%8D%94%EC%8A%A4,37.500024,127.036509',
    ]);
  });

  it('🔴 위도와 경도를 바꿔 싣지 않는다', () => {
    const [url] = buildMapCoordinateUrls(GANGNAM, '라운더스', 'web');
    const [, lat, lng] = url.split('/link/map/')[1].split(',');

    // 위도는 37 대, 경도는 127 대. 뒤집히면 지구 반대편이 열린다.
    expect(Number(lat)).toBeCloseTo(37.5, 1);
    expect(Number(lng)).toBeCloseTo(127.04, 1);
  });

  // ⚠️ `split(',').toHaveLength(3)` 로는 이 결함을 못 잡는다 — `encodeURIComponent` 가 쉼표를
  //    `%2C` 로 이스케이프해서 sanitize 를 통째로 떼도 필드 수가 3이다(실측). 실효 불변식은
  //    "인코딩된 쉼표가 남아 있지 않다"이다. 카카오가 경로를 디코드한 뒤 쉼표로 가르면
  //    `%2C` 가 구분자로 되살아나 좌표 자리가 밀린다.
  it('🔴 장소명의 쉼표를 지운다 — 디코드 후 필드 구분자로 되살아난다', () => {
    const [url] = buildMapCoordinateUrls(GANGNAM, '라운더스, 강남점', 'web');
    const fields = url.split('/link/map/')[1].split(',');

    expect(url).not.toContain('%2C');
    expect(decodeURIComponent(fields[0])).toBe('라운더스 강남점');
    expect(decodeURIComponent(fields[0])).not.toContain(',');
  });

  it('🔴 장소명의 괄호를 지운다 — Android geo: 는 괄호가 라벨 구분자인데 인코딩되지 않는다', () => {
    const [first] = buildMapCoordinateUrls(GANGNAM, '라운더스(강남)', 'android');
    const label = first.slice(first.indexOf('(') + 1, first.lastIndexOf(')'));

    // 괄호가 남으면 여기서 조기 종료돼 라벨이 잘린다.
    expect(decodeURIComponent(label)).toBe('라운더스 강남');
    expect(first).not.toContain('%28');
    expect(first.split('(')).toHaveLength(2);
  });

  it('라벨이 비면 기본 라벨로 대체한다(빈 필드로 링크가 깨지지 않게)', () => {
    const [url] = buildMapCoordinateUrls(GANGNAM, '   ', 'web');
    const fields = url.split('/link/map/')[1].split(',');

    expect(decodeURIComponent(fields[0])).toBe('근무지');
  });

  it('Android 는 geo: URI 를 좌표 핀 형태로 만든다(검색이 아니라 핀)', () => {
    const [first] = buildMapCoordinateUrls(GANGNAM, '라운더스', 'android');

    expect(first).toMatch(/^geo:37\.500024,127\.036509\?q=37\.500024,127\.036509\(/);
  });

  it('iOS 는 항상 열리는 Apple 지도 좌표 링크를 포함한다', () => {
    const urls = buildMapCoordinateUrls(GANGNAM, '라운더스', 'ios');

    expect(urls.some((u) => u.startsWith('https://maps.apple.com/?ll=37.500024,127.036509'))).toBe(
      true
    );
    // canOpenURL 게이트에 걸려 죽어 있던 nmap:// 후보는 기본 경로에서 뺐다(사용자 선택 경로로 이관).
    expect(urls.some((u) => u.startsWith('nmap://'))).toBe(false);
  });

  it('유한하지 않은 좌표는 후보를 만들지 않는다', () => {
    expect(buildMapCoordinateUrls({ lat: Number.NaN, lng: 127 }, '라운더스', 'web')).toEqual([]);
  });
});

describe('buildMapUrls', () => {
  it('좌표가 없으면 예전 텍스트 검색 후보 그대로다', () => {
    const urls = buildMapUrls({ query: '서울 강남구 테헤란로 152' }, 'web');

    expect(urls).toEqual([
      'https://map.kakao.com/link/search/' + encodeURIComponent('서울 강남구 테헤란로 152'),
    ]);
  });

  it('🔴 좌표가 있어도 텍스트 폴백을 잃지 않는다 — 스킴이 안 열리는 기기가 있다', () => {
    const urls = buildMapUrls(
      { query: '서울 강남구 테헤란로 152', coordinates: GANGNAM, label: '라운더스' },
      'android'
    );

    expect(urls[0]).toMatch(/^geo:37\.500024,127\.036509/);
    expect(urls[urls.length - 1]).toContain('/link/search/');
  });

  it('라벨이 없으면 검색어를 라벨로 쓴다', () => {
    const urls = buildMapUrls({ query: '서울 강남구 테헤란로 152', coordinates: GANGNAM }, 'web');

    expect(decodeURIComponent(urls[0])).toContain('서울 강남구 테헤란로 152,37.500024,127.036509');
  });

  it('좌표만 있고 검색어가 없어도 안내할 수 있다', () => {
    const urls = buildMapUrls({ query: null, coordinates: GANGNAM, label: '라운더스' }, 'web');

    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/link/map/');
  });

  it('둘 다 없으면 후보가 비어 호출부가 버튼을 감춘다', () => {
    expect(buildMapUrls({ query: null }, 'web')).toEqual([]);
  });
});
