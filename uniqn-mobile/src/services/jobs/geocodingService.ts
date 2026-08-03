/**
 * 주소 → 좌표. `geocode-address` Edge Function 호출 래퍼.
 *
 * 카카오 REST 키는 EF 시크릿에만 있다 — 클라이언트는 키를 모른다(번들·OTA 노출 차단).
 * 호출은 **공고 저장 시점 1회**뿐이라 읽기 경로에는 아무 비용도 붙지 않는다.
 *
 * 🔴 이 모듈은 **절대 throw 하지 않는다.** 지오코딩은 부가 기능이고, 여기서 던지면 실패한
 *    좌표 하나 때문에 공고 저장 전체가 무너진다. 실패는 전부 `null`(좌표 없음)로 접히고
 *    길찾기는 기존 주소 텍스트 검색으로 폴백한다.
 */
import type { PostingGeoPoint } from '@/types';
import { invokeEdgeFunction } from '@/lib/supabaseFunctions';
import { logger } from '@/utils/logger';

const GEOCODE_FUNCTION = 'geocode-address';

/**
 * 대한민국 경계 박스.
 *
 * 🔴 세 곳이 같은 값이어야 한다 — 여기 · EF `KOREA_BOUNDS` · DB `chk_job_postings_geo_bounds`
 *    (`20260803160000_job_postings_geocode_columns.sql`). DB 가 최종 권위이고, 여기서 못 거른
 *    값이 DB CHECK 에 걸리면 23514 로 **공고 저장 자체가 실패한다**. 부가 기능이 본 기능을
 *    죽이는 형태라 클라이언트에서 한 번 더 막는다.
 * 실측 하한: 서귀포 중문 lat 33.25 / lng 126.41.
 */
const KOREA_BOUNDS = { minLat: 32.5, maxLat: 39.0, minLng: 124.0, maxLng: 132.5 } as const;

export function isGeoPointInKorea(point: { lat: number; lng: number }): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= KOREA_BOUNDS.minLat &&
    point.lat <= KOREA_BOUNDS.maxLat &&
    point.lng >= KOREA_BOUNDS.minLng &&
    point.lng <= KOREA_BOUNDS.maxLng
  );
}

interface GeocodeResponse {
  coordinates?: { lat?: unknown; lng?: unknown } | null;
  matchedAddress?: unknown;
  reason?: unknown;
}

/**
 * 클라이언트 측 상한.
 *
 * 🔴 이게 없으면 EF 콜드스타트나 상류 지연이 **공고 저장을 무한정 붙잡는다** —
 *    `supabase-js` 의 `functions.invoke` 는 기본 타임아웃이 없다. 좌표는 부가 정보인데
 *    그것 때문에 저장 버튼이 안 끝나는 것은 명백히 잘못된 교환이다.
 *    EF 안쪽 상류 타임아웃(5s)보다 넉넉히 잡아, 정상 응답은 이 상한에 걸리지 않게 한다.
 */
const CLIENT_TIMEOUT_MS = 8_000;

const TIMED_OUT = Symbol('geocode-timeout');

/**
 * 주소 문자열을 좌표로 바꾼다. 실패·무매칭·빈 주소·시간 초과는 전부 `null`.
 *
 * 입력은 B1 우편번호 위젯이 준 도로명주소다(`서울 강남구 테헤란로 152` 꼴). 축약형 시도
 * 표기도 카카오가 그대로 매칭하므로 정규화 없이 넘긴다(2026-08-03 prod 실호출로 확인).
 */
export async function geocodeAddress(address?: string | null): Promise<PostingGeoPoint | null> {
  const query = address?.trim();
  if (!query) return null;

  // 🔴 "절대 throw 하지 않는다"는 계약을 **코드로** 만든다. 주석으로만 두면 다음 사람이 여기에
  //    `await` 하나만 더 넣어도 조용히 깨진다. 실제 위험 원천이 이미 있다 —
  //    `invokeEdgeFunction` 이 부르는 `supabase.auth.getSession()` 은 스토리지 어댑터(MMKV)
  //    읽기 예외를 그대로 던지고, 그게 올라가면 `handleServiceError` 가 잡아 **공고 생성 전체가
  //    실패한다**. 부가 기능이 본 기능을 죽이는, 이 모듈이 존재하는 이유와 정반대 형태다.
  try {
    return await requestGeocode(query);
  } catch (error) {
    logger.warn('지오코딩 중 예외 — 좌표 없이 저장한다', {
      component: 'geocodingService',
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function requestGeocode(query: string): Promise<PostingGeoPoint | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    invokeEdgeFunction<GeocodeResponse>(GEOCODE_FUNCTION, { body: { address: query } }),
    new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), CLIENT_TIMEOUT_MS);
    }),
  ]).finally(() => {
    // 어느 쪽이 이기든 타이머를 반드시 정리한다 — RN 은 미해제 타이머를 경고로 남긴다.
    if (timer !== undefined) clearTimeout(timer);
  });

  if (result === TIMED_OUT) {
    logger.warn('지오코딩 시간 초과 — 좌표 없이 저장한다', {
      component: 'geocodingService',
      timeoutMs: CLIENT_TIMEOUT_MS,
    });
    return null;
  }

  const { data, error } = result;

  if (error) {
    // 인증 만료·네트워크·429 전부 여기로 온다. 저장을 막지 않는다.
    logger.warn('지오코딩 실패 — 좌표 없이 저장한다', {
      component: 'geocodingService',
      message: error.message,
    });
    return null;
  }

  const raw = data?.coordinates;
  if (!raw || typeof raw !== 'object') {
    if (data?.reason) {
      logger.info('지오코딩 무매칭', {
        component: 'geocodingService',
        reason: String(data.reason),
      });
    }
    return null;
  }

  const lat = typeof raw.lat === 'number' ? raw.lat : NaN;
  const lng = typeof raw.lng === 'number' ? raw.lng : NaN;
  if (!isGeoPointInKorea({ lat, lng })) {
    logger.warn('지오코딩 결과가 경계 밖 — 좌표를 버린다', { component: 'geocodingService' });
    return null;
  }

  return { lat, lng };
}
