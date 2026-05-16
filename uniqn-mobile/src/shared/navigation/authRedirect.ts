import type { UserProfile } from '@/types';
import { featureFlags } from '@/config/featureFlags';

export const AUTH_ENTRY_ROUTES = {
  appTabs: '/(app)/(tabs)',
  appHome: (featureFlags.home_dashboard_enabled ? '/(app)/home' : '/(app)/(tabs)') as string,
  signup: '/(auth)/signup',
  socialSignup: '/(auth)/signup?mode=social',
  identityReverify: '/(auth)/signup?mode=reverify',
  profileSetup: '/(app)/profile-setup',
} as const;

export const AUTH_LOGIN_ROUTE = '/(auth)/login';

const ALLOWED_POST_AUTH_REDIRECT_PREFIXES = ['/(app)', '/(employer)', '/(admin)'] as const;

type AuthEntryRoute = (typeof AUTH_ENTRY_ROUTES)[keyof typeof AUTH_ENTRY_ROUTES];

interface AuthenticatedEntryRouteParams {
  socialProvider?: UserProfile['socialProvider'] | null;
  phoneVerified?: boolean | null;
  profileCompleted?: boolean | null;
  /**
   * 본인인증(KG이니시스) 완료 여부.
   * 명시적으로 false 일 때만 재인증을 강제한다 (undefined/null/true → 통과).
   * 옛 가입자(컬럼이 NULL)는 영향 없도록 false 만 차단.
   */
  identityVerified?: boolean | null;
}

interface ResolvedAuthenticatedRouteParams extends AuthenticatedEntryRouteParams {
  redirect?: string | null;
}

export function normalizePostAuthRedirect(redirect?: string | null): string | null {
  if (typeof redirect !== 'string') {
    return null;
  }

  const trimmed = redirect.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    return null;
  }

  const [pathname] = trimmed.split(/[?#]/, 1);
  const isAllowedInternalRoute = ALLOWED_POST_AUTH_REDIRECT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return isAllowedInternalRoute ? trimmed : null;
}

export function buildPostAuthRedirectFromSegments(segments: string[]): string | null {
  if (!Array.isArray(segments) || segments.length === 0) {
    return null;
  }

  const normalizedSegments = segments.filter(
    (segment): segment is string => typeof segment === 'string' && segment.length > 0
  );

  if (normalizedSegments.length === 0) {
    return null;
  }

  return normalizePostAuthRedirect(`/${normalizedSegments.join('/')}`);
}

export function appendRedirectToRoute(route: string, redirect?: string | null): string {
  const normalizedRedirect = normalizePostAuthRedirect(redirect);

  if (!normalizedRedirect) {
    return route;
  }

  if (route === AUTH_ENTRY_ROUTES.appTabs || route === AUTH_ENTRY_ROUTES.appHome) {
    return normalizedRedirect;
  }

  const separator = route.includes('?') ? '&' : '?';
  return `${route}${separator}redirect=${encodeURIComponent(normalizedRedirect)}`;
}

export function getLoginRoute(redirect?: string | null): string {
  return appendRedirectToRoute(AUTH_LOGIN_ROUTE, redirect);
}

export function getAuthenticatedEntryRoute(params: AuthenticatedEntryRouteParams): AuthEntryRoute {
  const { socialProvider, phoneVerified, profileCompleted, identityVerified } = params;

  // 신규 가입 안전망 — phone 인증조차 안 한 사용자는 reverify 가 아니라 가입 흐름.
  // 2026-05-16 사건: handle_new_user trigger 가 social_provider 누락 + edge function
  // 실패 시 social_provider=null + phone_verified=false + identity_verified=false 인
  // 신규 row 가 reverify trap 으로 빠지던 회귀. socialProvider truthy 의존만으로는
  // 옛 사용자(phoneVerified=true, identityVerified=false)와 신규 미완성 사용자를
  // 구분하지 못함.
  if (phoneVerified !== true && identityVerified === false) {
    return socialProvider ? AUTH_ENTRY_ROUTES.socialSignup : AUTH_ENTRY_ROUTES.signup;
  }

  // 소셜 신규 사용자 — 본인인증 단계로 (signup?mode=social)
  if (socialProvider && phoneVerified !== true) {
    return AUTH_ENTRY_ROUTES.socialSignup;
  }

  // 본인인증 명시적 false — KG이니시스 재인증 강제 (signup?mode=reverify)
  // phoneVerified=true 인 옛 사용자(Firebase 시절 phone 인증만 완료 + PortOne 미완료)
  // 만 이 분기에 도달. 신규 미완성 사용자는 위 안전망에서 가입 흐름으로 분기.
  if (identityVerified === false) {
    return AUTH_ENTRY_ROUTES.identityReverify;
  }

  // 닉네임 미설정 — profile-setup
  // (profileCompleted 의 의미는 "닉네임 입력 완료" 이지 본인인증과 별개. UserProfile 타입 주석 참고.)
  if (profileCompleted === false) {
    return AUTH_ENTRY_ROUTES.profileSetup;
  }

  return AUTH_ENTRY_ROUTES.appHome as AuthEntryRoute;
}

export function getResolvedAuthenticatedRoute(params: ResolvedAuthenticatedRouteParams): string {
  const { redirect, ...routeParams } = params;
  return appendRedirectToRoute(getAuthenticatedEntryRoute(routeParams), redirect);
}
