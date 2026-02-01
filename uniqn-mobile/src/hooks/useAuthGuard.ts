/**
 * UNIQN Mobile - useAuthGuard Hook
 *
 * @description 라우트 보호 및 권한 확인
 * @version 1.0.0
 */

import { useEffect, useRef } from 'react';
import { useRouter, useSegments, usePathname } from 'expo-router';
import { useAuthStore, hasPermission, selectIsLoading, selectProfile } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

type RouteGroup = '(auth)' | '(app)' | '(employer)' | '(admin)' | '(public)';

interface RouteConfig {
  requiredAuth: boolean;
  requiredRole?: UserRole;
  redirectTo?: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 라우트 그룹별 설정
 */
const ROUTE_CONFIGS: Record<RouteGroup, RouteConfig> = {
  '(public)': {
    requiredAuth: false,
  },
  '(auth)': {
    requiredAuth: false,
    redirectTo: '/(app)/(tabs)', // 이미 로그인된 경우 리다이렉트
  },
  '(app)': {
    requiredAuth: true,
    requiredRole: 'staff', // 최소 staff 권한 필요 (로그인만 되어 있으면 됨)
  },
  '(employer)': {
    requiredAuth: true,
    requiredRole: 'employer', // employer 이상 권한 필요 (구인자)
  },
  '(admin)': {
    requiredAuth: true,
    requiredRole: 'admin',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 세그먼트에서 라우트 그룹 추출
 */
function extractRouteGroup(segments: string[]): RouteGroup | null {
  const firstSegment = segments[0] as RouteGroup | undefined;

  if (firstSegment && firstSegment in ROUTE_CONFIGS) {
    return firstSegment;
  }

  return null;
}

// ============================================================================
// Hook
// ============================================================================

export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  // Selector를 사용하여 필요한 상태만 구독 (무한 루프 방지)
  const isLoading = useAuthStore(selectIsLoading);
  const profile = useAuthStore(selectProfile);
  const user = useAuthStore((state) => state.user);

  // ⚠️ 중요: store.isAuthenticated는 MMKV rehydration 후 업데이트가 지연될 수 있으므로
  // user 존재 여부로 직접 판단
  const isAuthenticated = !!user;
  const userRole = profile?.role ?? null;

  // router를 ref로 저장하여 의존성 배열에서 제외 (안정적인 참조)
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    // 로딩 중에는 처리하지 않음
    if (isLoading) return;

    const routeGroup = extractRouteGroup(segments);

    // 라우트 그룹이 있으면 해당 그룹의 권한 체크로 넘어감
    // (pathname이 '/'여도 segments에 라우트 그룹이 있으면 그룹 내 index 페이지)
    if (!routeGroup) {
      // 라우트 그룹이 없고 루트 경로인 경우에만 리다이렉트
      if (pathname === '/' || pathname === '/index') {
        if (isAuthenticated) {
          logger.debug('인증됨 - 메인으로 이동', {
            component: 'useAuthGuard',
            pathname,
          });
          routerRef.current.replace('/(app)/(tabs)');
        }
      }
      return;
    }

    const config = ROUTE_CONFIGS[routeGroup];

    // (auth) 그룹: 이미 로그인되어 있으면 리다이렉트
    if (routeGroup === '(auth)' && isAuthenticated) {
      logger.debug('이미 인증됨 - 앱으로 리다이렉트', {
        component: 'useAuthGuard',
        pathname,
      });
      routerRef.current.replace(config.redirectTo || '/(app)/(tabs)');
      return;
    }

    // 인증 필요 라우트 체크
    if (config.requiredAuth && !isAuthenticated) {
      logger.debug('인증 필요 - 로그인으로 리다이렉트', {
        component: 'useAuthGuard',
        pathname,
        routeGroup,
      });
      routerRef.current.replace('/(auth)/login');
      return;
    }

    // 권한 체크 (requiredRole이 없으면 권한 체크 생략)
    const hasRequiredPermission = config.requiredRole
      ? hasPermission(userRole, config.requiredRole)
      : true;
    if (config.requiredRole && !hasRequiredPermission) {
      logger.warn('권한 부족', {
        component: 'useAuthGuard',
        pathname,
        userRole,
        requiredRole: config.requiredRole,
      });

      // 권한이 부족하면 가능한 가장 높은 권한의 페이지로 리다이렉트
      if (isAuthenticated) {
        routerRef.current.replace('/(app)/(tabs)');
      } else {
        routerRef.current.replace('/(auth)/login');
      }
      return;
    }
    // router를 의존성에서 제외하여 무한 루프 방지
    // user 변경 시 isAuthenticated도 재계산됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, userRole, segments, pathname]);
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 권한 확인 유틸리티 훅
 */
export function useHasPermission(requiredRole: UserRole): boolean {
  const { profile } = useAuthStore();
  const userRole = profile?.role ?? null;

  return hasPermission(userRole, requiredRole);
}

/**
 * 관리자 권한 확인
 */
export function useIsAdmin(): boolean {
  return useHasPermission('admin');
}

/**
 * 구인자 권한 확인
 */
export function useIsEmployer(): boolean {
  return useHasPermission('employer');
}

/**
 * 스태프 이상 권한 확인
 */
export function useIsStaff(): boolean {
  return useHasPermission('staff');
}

export default useAuthGuard;
