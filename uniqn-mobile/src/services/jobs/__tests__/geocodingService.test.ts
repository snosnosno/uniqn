/**
 * geocodingService — Edge Function 응답 경계 검증 (주소 검색 2단계 B2).
 *
 * 🔴 이 모듈은 **절대 throw 하지 않는다.** 던지면 좌표 하나 때문에 공고 저장 전체가 무너진다.
 * 🔴 경계 밖 좌표는 여기서 버려야 한다 — 통과시키면 DB `chk_job_postings_geo_bounds` 가
 *    23514 로 거부해 **공고 INSERT/UPDATE 자체가 실패**한다(부가 기능이 본 기능을 죽인다).
 */
import { geocodeAddress, isGeoPointInKorea } from '../geocodingService';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabaseFunctions', () => ({
  invokeEdgeFunction: (...args: unknown[]) => mockInvoke(...args),
}));

const GANGNAM = { lat: 37.5000242, lng: 127.0365086 };

beforeEach(() => jest.clearAllMocks());

describe('isGeoPointInKorea', () => {
  it.each([
    ['강남', 37.5000242, 127.0365086],
    ['서귀포 중문(남쪽 실측 경계)', 33.254218, 126.411434],
    ['판교', 37.402048, 127.10869],
  ])('%s 은 경계 안이다', (_label, lat, lng) => {
    expect(isGeoPointInKorea({ lat, lng })).toBe(true);
  });

  it.each([
    ['도쿄', 35.6762, 139.6503],
    ['적도 0,0', 0, 0],
    ['위도 NaN', Number.NaN, 127],
    ['경도 Infinity', 37.5, Number.POSITIVE_INFINITY],
  ])('%s 은 경계 밖이다', (_label, lat, lng) => {
    expect(isGeoPointInKorea({ lat, lng })).toBe(false);
  });
});

describe('geocodeAddress', () => {
  it('EF 가 준 좌표를 그대로 돌려준다', async () => {
    mockInvoke.mockResolvedValue({ data: { coordinates: GANGNAM }, error: null });

    await expect(geocodeAddress('서울 강남구 테헤란로 152')).resolves.toEqual(GANGNAM);
    expect(mockInvoke).toHaveBeenCalledWith('geocode-address', {
      body: { address: '서울 강남구 테헤란로 152' },
    });
  });

  it('빈 주소는 호출조차 하지 않는다', async () => {
    await expect(geocodeAddress('   ')).resolves.toBeNull();
    await expect(geocodeAddress(undefined)).resolves.toBeNull();
    await expect(geocodeAddress(null)).resolves.toBeNull();

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('앞뒤 공백을 다듬어 보낸다', async () => {
    mockInvoke.mockResolvedValue({ data: { coordinates: GANGNAM }, error: null });

    await geocodeAddress('  서울 강남구 테헤란로 152  ');

    expect(mockInvoke).toHaveBeenCalledWith('geocode-address', {
      body: { address: '서울 강남구 테헤란로 152' },
    });
  });

  it('EF 오류는 throw 하지 않고 null 로 접는다', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('401 Unauthorized') });

    await expect(geocodeAddress('서울 강남구 테헤란로 152')).resolves.toBeNull();
  });

  it('무매칭(coordinates:null)은 null 이다', async () => {
    mockInvoke.mockResolvedValue({ data: { coordinates: null, reason: 'no_match' }, error: null });

    await expect(geocodeAddress('없는주소')).resolves.toBeNull();
  });

  it('🔴 경계 밖 좌표는 버린다 — 통과하면 DB CHECK 가 공고 저장 전체를 막는다', async () => {
    mockInvoke.mockResolvedValue({
      data: { coordinates: { lat: 35.6762, lng: 139.6503 } },
      error: null,
    });

    await expect(geocodeAddress('도쿄')).resolves.toBeNull();
  });

  it('좌표가 숫자가 아니면 버린다(상류 계약 변형 방어)', async () => {
    mockInvoke.mockResolvedValue({
      data: { coordinates: { lat: '37.5', lng: '127.03' } },
      error: null,
    });

    await expect(geocodeAddress('서울 강남구 테헤란로 152')).resolves.toBeNull();
  });

  it('응답 본문이 통째로 비어도 throw 하지 않는다', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(geocodeAddress('서울 강남구 테헤란로 152')).resolves.toBeNull();
  });

  // 🔴 supabase-js functions.invoke 에는 기본 타임아웃이 없다. 상한이 없으면 EF 콜드스타트나
  //    상류 지연이 공고 저장 버튼을 무한정 붙잡는다 — 부가 정보가 본 기능을 인질로 잡는 꼴이다.
  it('🔴 EF 가 응답하지 않으면 상한에서 포기하고 null 로 접는다', async () => {
    jest.useFakeTimers();
    try {
      // 절대 resolve 되지 않는 호출 = 멈춘 EF
      mockInvoke.mockReturnValue(new Promise(() => undefined));

      const pending = geocodeAddress('서울 강남구 테헤란로 152');
      jest.advanceTimersByTime(8_000);

      await expect(pending).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('상한 안에 응답이 오면 좌표를 그대로 돌려준다(상한이 정상 응답을 자르지 않는다)', async () => {
    jest.useFakeTimers();
    try {
      mockInvoke.mockResolvedValue({ data: { coordinates: GANGNAM }, error: null });

      const pending = geocodeAddress('서울 강남구 테헤란로 152');
      await expect(pending).resolves.toEqual(GANGNAM);
    } finally {
      jest.useRealTimers();
    }
  });
});
