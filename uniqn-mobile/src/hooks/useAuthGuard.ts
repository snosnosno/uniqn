/**
 * UNIQN Mobile - useAuthGuard Hook
 *
 * Route protection and authenticated entry routing.
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { getAuthenticatedEntryRoute } from '@/shared/navigation/authRedirect';
import { RoleResolver } from '@/shared/role';
import { useAuthStore, selectIsLoading, selectProfile } from '@/stores/authStore';
import type { UserRole } from '@/types';
import { logger } from '@/utils/logger';

type RouteGroup = '(auth)' | '(app)' | '(employer)' | '(admin)' | '(public)';

interface RouteConfig {
  requiredAuth: boolean;
  requiredRole?: UserRole;
}

const ROUTE_CONFIGS: Record<RouteGroup, RouteConfig> = {
  '(public)': {
    requiredAuth: false,
  },
  '(auth)': {
    requiredAuth: false,
  },
  '(app)': {
    requiredAuth: true,
    requiredRole: 'staff',
  },
  '(employer)': {
    requiredAuth: true,
    requiredRole: 'employer',
  },
  '(admin)': {
    requiredAuth: true,
    requiredRole: 'admin',
  },
};

function extractRouteGroup(segments: string[]): RouteGroup | null {
  const firstSegment = segments[0] as RouteGroup | undefined;

  if (firstSegment && firstSegment in ROUTE_CONFIGS) {
    return firstSegment;
  }

  return null;
}

export function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const isLoading = useAuthStore(selectIsLoading);
  const profile = useAuthStore(selectProfile);
  const user = useAuthStore((state) => state.user);

  const isAuthenticated = !!user;
  const userRole = profile?.role ?? null;
  const socialProvider = profile?.socialProvider ?? null;
  const phoneVerified = profile?.phoneVerified ?? null;
  const profileCompleted = profile?.profileCompleted ?? null;

  const authenticatedEntryRoute = getAuthenticatedEntryRoute({
    socialProvider,
    phoneVerified,
    profileCompleted,
  });

  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (isLoading || (isAuthenticated && !profile)) return;

    const routeGroup = extractRouteGroup(segments);
    const isOnSignup = segments.includes('signup' as never);
    const isOnProfileSetup = pathname === '/profile-setup' || pathname === '/(app)/profile-setup';

    if (!routeGroup) {
      if ((pathname === '/' || pathname === '/index') && isAuthenticated) {
        logger.debug('Authenticated user entered root route', {
          component: 'useAuthGuard',
          pathname,
          authenticatedEntryRoute,
        });
        routerRef.current.replace(authenticatedEntryRoute);
      }
      return;
    }

    const config = ROUTE_CONFIGS[routeGroup];

    if (routeGroup === '(auth)' && isAuthenticated) {
      if (authenticatedEntryRoute.includes('/signup') && isOnSignup) {
        return;
      }

      logger.debug('Authenticated user entered auth group', {
        component: 'useAuthGuard',
        pathname,
        authenticatedEntryRoute,
      });
      routerRef.current.replace(authenticatedEntryRoute);
      return;
    }

    if (isAuthenticated && authenticatedEntryRoute.includes('/signup') && !isOnSignup) {
      logger.debug('Incomplete social signup detected', {
        component: 'useAuthGuard',
        pathname,
        socialProvider,
      });
      routerRef.current.replace(authenticatedEntryRoute);
      return;
    }

    if (
      isAuthenticated &&
      authenticatedEntryRoute.includes('/profile-setup') &&
      !isOnProfileSetup
    ) {
      logger.debug('Incomplete profile detected', {
        component: 'useAuthGuard',
        pathname,
      });
      routerRef.current.replace(authenticatedEntryRoute);
      return;
    }

    if (config.requiredAuth && !isAuthenticated) {
      logger.debug('Unauthenticated access to protected route', {
        component: 'useAuthGuard',
        pathname,
        routeGroup,
      });
      routerRef.current.replace('/(auth)/login');
      return;
    }

    const hasRequiredPermission = config.requiredRole
      ? RoleResolver.hasPermission(userRole, config.requiredRole)
      : true;

    if (config.requiredRole && !hasRequiredPermission) {
      logger.warn('Insufficient role for route', {
        component: 'useAuthGuard',
        pathname,
        userRole,
        requiredRole: config.requiredRole,
      });

      routerRef.current.replace(isAuthenticated ? authenticatedEntryRoute : '/(auth)/login');
    }
  }, [
    authenticatedEntryRoute,
    isAuthenticated,
    isLoading,
    pathname,
    profile,
    segments,
    socialProvider,
    userRole,
  ]);
}

export function useHasPermission(requiredRole: UserRole): boolean {
  const { profile } = useAuthStore();
  const userRole = profile?.role ?? null;

  return RoleResolver.hasPermission(userRole, requiredRole);
}

export function useIsAdmin(): boolean {
  return useHasPermission('admin');
}

export function useIsEmployer(): boolean {
  return useHasPermission('employer');
}

export function useIsStaff(): boolean {
  return useHasPermission('staff');
}

export default useAuthGuard;
