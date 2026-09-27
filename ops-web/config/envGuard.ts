/**
 * 빌드 시점 환경 가드 — 설계 §8 (리뷰 C2).
 *
 * 정적 SPA 라 Supabase URL 이 번들에 박힌다. 그래서 "어느 DB 를 가리키는 빌드인가" 를
 * 빌드 단계에서 막는다:
 * - 운영이 아닌 빌드가 prod 프로젝트를 가리키면 → 개발 중 실데이터 오염 위험
 * - 운영 빌드가 prod 가 아닌 곳을 가리키면 → 배포된 사이트가 동작하지 않거나 엉뚱한 DB 에 붙음
 *
 * 운영 판정은 **허용 목록**(prod 호스트 정확 일치)이다 — "localhost 가 아니면 통과" 식의
 * 차단 목록은 `localhost.`·오타 시크릿·다른 프로젝트 URL 을 놓친다(W0 코드 리뷰 M3).
 */
export const PROD_SUPABASE_PROJECT_REF = 'ygfxukhktpqymahfrvbz';

const PROD_HOST = `${PROD_SUPABASE_PROJECT_REF}.supabase.co`;

interface SupabaseTarget {
  mode: string;
  url: string | undefined;
}

/** URL 을 파싱해 비교용 호스트명을 돌려준다. 끝의 점(FQDN 표기)은 떼어낸다(리뷰 M2). */
function toComparableHost(url: string | undefined): string {
  if (!url) {
    throw new Error(
      'VITE_SUPABASE_URL 이 설정되지 않았습니다. ops-web/.env.example 을 참고하세요.'
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`VITE_SUPABASE_URL 형식이 올바르지 않습니다: ${url}`);
  }
  return parsed.hostname.replace(/\.+$/, '');
}

export function assertSafeSupabaseTarget({ mode, url }: SupabaseTarget): void {
  const isProdHost = toComparableHost(url) === PROD_HOST;
  const isProduction = mode === 'production';

  if (!isProduction && isProdHost) {
    throw new Error(
      `운영이 아닌 빌드(mode=${mode})가 prod Supabase 를 가리킵니다. 로컬 Supabase 를 쓰세요.`
    );
  }
  if (isProduction && !isProdHost) {
    throw new Error(
      `운영 빌드가 prod Supabase(${PROD_HOST})가 아닌 곳을 가리킵니다. 시크릿 값을 확인하세요.`
    );
  }
}
