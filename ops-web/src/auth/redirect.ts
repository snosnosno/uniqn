/**
 * 로그인 후 복귀 경로 정규화 — 설계 §4.1.
 *
 * 규칙은 모바일 `normalizePostAuthRedirect`(core/shared/navigation/authRedirect.ts)와 같다:
 * `/` 로 시작, `//`·`\` 금지. 모바일은 허용 접두사 목록(/(app) 등)도 보지만 ops 웹엔 그 그룹이 없어
 * 대신 **URL 파서로 해석한 결과**를 돌려준다 — 원문을 그대로 넘기면 `/.//evil`·`/%2e%2e//evil` 처럼
 * 해석 후 경로가 `//evil` 이 되는 값이 라우터 내부 구현(중복 슬래시 제거)에만 기대게 된다(리뷰 W2).
 */
export const DEFAULT_AFTER_LOGIN = '/tournaments';

/** 복귀하면 루프가 되는 인증 화면(소문자·끝 슬래시 제거 후 비교 — 라우터가 둘 다 무시하고 매칭한다). */
const AUTH_PATHS = ['/login', '/forgot-password', '/reset-password'];

const PROBE_ORIGIN = 'https://ops.invalid';

export function normalizeOpsRedirect(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_AFTER_LOGIN;
  const trimmed = raw.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    // 브라우저 URL 파서는 탭·개행을 지운다 → `/\t/evil` 이 `//evil` 로 바뀐다.
    // oxlint-disable-next-line no-control-regex
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return DEFAULT_AFTER_LOGIN;
  }

  let url: URL;
  try {
    url = new URL(trimmed, PROBE_ORIGIN);
  } catch {
    return DEFAULT_AFTER_LOGIN;
  }
  if (url.origin !== PROBE_ORIGIN) return DEFAULT_AFTER_LOGIN;
  // 해석 후 경로가 `//` 로 시작하면 다음 이동에서 프로토콜 상대 URL 이 된다.
  if (url.pathname.startsWith('//')) return DEFAULT_AFTER_LOGIN;

  const comparable = url.pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (AUTH_PATHS.includes(comparable)) return DEFAULT_AFTER_LOGIN;

  return `${url.pathname}${url.search}${url.hash}`;
}

/** 가드가 비로그인 사용자를 보낼 로그인 경로. */
export function buildLoginPath(currentPath: string): string {
  const target = normalizeOpsRedirect(currentPath);
  if (target === DEFAULT_AFTER_LOGIN) return '/login';
  return `/login?redirect=${encodeURIComponent(target)}`;
}
