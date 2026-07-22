/**
 * 비밀번호 복구 진입 스냅샷.
 *
 * 배경(2026-07-22): `redirectTo` 없이 발송된 메일(구 번들·Site URL 폴백)은 앱
 * 루트(`/`)로 착지한다. 이미 로그인된 사용자는 그대로 앱 홈으로 흘러가 비밀번호를
 * 바꿀 화면을 못 본다. 루트에서 복구 진입을 감지해 재설정 화면으로 넘긴다.
 *
 * ⚠️ 스냅샷은 **모듈 로드 시점 1회**만 읽는다. supabase-js 의 `detectSessionInUrl`
 * 이 해시를 소비한 뒤 `history.replaceState` 로 지워버리므로, 나중에 읽으면 이미
 * 사라진 뒤다.
 */
import { Platform } from 'react-native';

/** 해시·쿼리 문자열이 비밀번호 복구 링크 착지인지 판정 (순수 함수 — 테스트 대상). */
export function detectRecoveryEntry(hash: string, search: string): boolean {
  return (
    hash.includes('type=recovery') ||
    search.includes('type=recovery') ||
    hash.includes('error_code=otp_expired') ||
    search.includes('error_code=otp_expired')
  );
}

/** 복구 링크 착지가 실패(만료·재사용)였는지 판정 (순수 함수 — 테스트 대상). */
export function detectRecoveryLinkError(hash: string, search: string): boolean {
  return (
    hash.includes('error_code=') ||
    search.includes('error_code=') ||
    hash.includes('error=') ||
    search.includes('error=')
  );
}

export type RecoveryUrlParseResult =
  | { kind: 'tokens'; accessToken: string; refreshToken: string }
  | { kind: 'error' }
  | { kind: 'none' };

/**
 * 복구 링크 URL 에서 세션 토큰을 추출 (순수 함수 — 테스트 대상).
 *
 * Android 는 intentFilter(pathPrefix '/')가 uniqn.app 전 경로를 가로채 링크가
 * 네이티브 앱에서 열리는데, supabase-js 의 `detectSessionInUrl` 은 웹 전용이라
 * 네이티브는 URL 프래그먼트에서 직접 토큰을 꺼내 세션을 채택해야 한다.
 */
export function parseRecoveryUrl(url: string): RecoveryUrlParseResult {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = beforeHash.indexOf('?');
  const search = queryIndex >= 0 ? beforeHash.slice(queryIndex) : '';

  if (!detectRecoveryEntry(hash, search)) {
    return { kind: 'none' };
  }

  if (detectRecoveryLinkError(hash, search)) {
    return { kind: 'error' };
  }

  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (!accessToken || !refreshToken) {
    return { kind: 'error' };
  }

  return { kind: 'tokens', accessToken, refreshToken };
}

/**
 * 네이티브 딥링크로 들어온 복구 URL 을 처리해야 하는지.
 * 한 번 처리한 URL 은 재처리하지 않는다 — useURL 은 세션 내내 마지막 링크를
 * 유지하므로, 소비 표시가 없으면 로그아웃 후 재마운트 등에서 재설정 화면으로
 * 잘못 끌려간다.
 */
let handledNativeRecoveryUrl: string | null = null;

export function shouldHandleNativeRecoveryUrl(url: string | null | undefined): boolean {
  if (Platform.OS === 'web' || !url || url === handledNativeRecoveryUrl) {
    return false;
  }

  return parseRecoveryUrl(url).kind !== 'none';
}

export function markNativeRecoveryUrlHandled(url: string): void {
  handledNativeRecoveryUrl = url;
}

function readInitialLocation(): { hash: string; search: string } {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { hash: '', search: '' };
  }

  return { hash: window.location?.hash ?? '', search: window.location?.search ?? '' };
}

const initialLocation = readInitialLocation();

let pendingRecoveryEntry = detectRecoveryEntry(initialLocation.hash, initialLocation.search);

/**
 * 진입 시점 URL 이 실패 해시였는지.
 * 루트에서 재설정 화면으로 넘어오면 해시가 유실되므로, 화면에서 현재 URL 만 보면
 * 만료된 링크를 "정상 진입"으로 오판한다(이미 로그인된 사용자는 세션이 있으므로).
 */
export function isRecoveryLinkErrorEntry(): boolean {
  return detectRecoveryLinkError(initialLocation.hash, initialLocation.search);
}

/** 이번 웹 진입이 비밀번호 복구 링크였는지. 재설정 화면 도착 전까지 true 를 유지한다. */
export function isPasswordRecoveryEntry(): boolean {
  return pendingRecoveryEntry;
}

/** 재설정 화면에 도착한 뒤 호출 — 이후 일반 라우팅 규칙을 복원한다. */
export function clearPasswordRecoveryEntry(): void {
  pendingRecoveryEntry = false;
}
