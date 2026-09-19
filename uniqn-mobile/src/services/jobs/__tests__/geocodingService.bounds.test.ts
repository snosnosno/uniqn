/**
 * 대한민국 경계 박스 3중 정의 동기화 가드 (주소 검색 2단계 — B2).
 *
 * 같은 네 숫자가 세 곳에 산다:
 *   ① 클라  `src/services/jobs/geocodingService.ts` `KOREA_BOUNDS`
 *   ② EF    `supabase/functions/geocode-address/index.ts` `KOREA_BOUNDS`
 *   ③ DB    `20260803160000_job_postings_geocode_columns.sql` `chk_job_postings_geo_bounds`
 *
 * 🔴 어긋나는 방향이 위험하다 — ①②가 ③보다 **넓으면** 통과시킨 좌표가 DB CHECK 에 23514 로
 *    걸리고, 그러면 좌표가 아니라 **공고 저장 자체가 실패한다**(부가 기능이 본 기능을 죽인다).
 *    세 파일 주석이 전부 "같아야 한다"고 경고하지만 강제하는 것이 없었다. 이 테스트가 그 강제다.
 *
 * 파일을 직접 읽어 숫자를 뽑는 이유: EF 는 Deno 모듈이라 import 할 수 없고, SQL 은 애초에
 * 실행 없이 값을 알 수 없다. 텍스트 대조가 유일하게 세 원천을 한자리에서 볼 수 있는 방법이다.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isGeoPointInKorea } from '../geocodingService';

const ROOT = join(__dirname, '..', '..', '..', '..');

function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

/** `KOREA_BOUNDS = { minLat: 32.5, maxLat: 39.0, ... }` 에서 네 숫자를 뽑는다. */
function parseTsBounds(source: string): Record<string, number> {
  const block = source.match(/KOREA_BOUNDS\s*=\s*\{([^}]+)\}/)?.[1];
  if (!block) throw new Error('KOREA_BOUNDS 선언을 찾지 못했다');
  const bounds: Record<string, number> = {};
  for (const [, key, value] of block.matchAll(/(minLat|maxLat|minLng|maxLng)\s*:\s*(-?[\d.]+)/g)) {
    bounds[key] = Number(value);
  }
  return bounds;
}

/** CHECK 제약의 `geo_lat >= 32.5 AND geo_lat <= 39.0` 형태에서 네 숫자를 뽑는다. */
function parseSqlBounds(source: string): Record<string, number> {
  const pick = (column: string, op: string): number => {
    const found = source.match(new RegExp(`${column}\\s*${op}\\s*(-?[\\d.]+)`));
    if (!found) throw new Error(`${column} ${op} 경계를 찾지 못했다`);
    return Number(found[1]);
  };
  return {
    minLat: pick('geo_lat', '>='),
    maxLat: pick('geo_lat', '<='),
    minLng: pick('geo_lng', '>='),
    maxLng: pick('geo_lng', '<='),
  };
}

const CLIENT = parseTsBounds(readSource('src/services/jobs/geocodingService.ts'));
const EDGE_FUNCTION = parseTsBounds(readSource('supabase/functions/geocode-address/index.ts'));
const DATABASE = parseSqlBounds(
  readSource('supabase/migrations/20260803160000_job_postings_geocode_columns.sql')
);

describe('경계 박스 3중 정의', () => {
  it('네 숫자를 세 곳에서 모두 파싱한다(파싱 자체가 깨지면 이 가드가 무력해진다)', () => {
    for (const bounds of [CLIENT, EDGE_FUNCTION, DATABASE]) {
      expect(Object.keys(bounds).sort()).toEqual(['maxLat', 'maxLng', 'minLat', 'minLng']);
    }
  });

  it('🔴 클라이언트와 Edge Function 이 같은 값이다', () => {
    expect(EDGE_FUNCTION).toEqual(CLIENT);
  });

  it('🔴 클라이언트와 DB CHECK 가 같은 값이다 — 클라가 더 넓으면 23514 로 공고 저장이 죽는다', () => {
    expect(DATABASE).toEqual(CLIENT);
  });

  it('실제 판정 함수가 그 경계를 쓴다(상수만 맞고 로직이 다른 것을 막는다)', () => {
    expect(isGeoPointInKorea({ lat: CLIENT.minLat, lng: CLIENT.minLng })).toBe(true);
    expect(isGeoPointInKorea({ lat: CLIENT.maxLat, lng: CLIENT.maxLng })).toBe(true);
    expect(isGeoPointInKorea({ lat: CLIENT.minLat - 0.1, lng: CLIENT.minLng })).toBe(false);
    expect(isGeoPointInKorea({ lat: CLIENT.maxLat, lng: CLIENT.maxLng + 0.1 })).toBe(false);
  });

  // 국토 극점이 박스 밖으로 나가면 그 지역 공고가 좌표를 못 갖는다(무증상 폴백).
  it.each([
    ['마라도(최남단)', 33.06, 126.27],
    ['독도(최동단)', 37.24, 131.87],
    ['백령도(최서단)', 37.96, 124.63],
    ['강원 고성(최북단)', 38.45, 128.36],
  ])('%s 를 포함한다', (_label, lat, lng) => {
    expect(isGeoPointInKorea({ lat, lng })).toBe(true);
  });
});
