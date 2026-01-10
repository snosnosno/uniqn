/**
 * UNIQN Mobile - Navigation Tracking Hook
 *
 * @description 화면 전환 추적 및 Analytics 연동
 * @version 1.0.0
 *
 * 기능:
 * - 화면 전환 자동 추적
 * - Analytics 이벤트 전송
 * - 네비게이션 로깅
 * - Crashlytics breadcrumb 기록
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSegments } from 'expo-router';
import { logger } from '@/utils/logger';
import { analyticsService } from '@/services/analyticsService';
import { crashlyticsService } from '@/services/crashlyticsService';
import { recordNavigationTime } from '@/services/performanceService';

// ============================================================================
// Types
// ============================================================================

interface NavigationState {
  previousPath: string | null;
  currentPath: string;
  timestamp: number;
  transitionCount: number;
}

interface ScreenInfo {
  name: string;
  class: string;
  params?: Record<string, string>;
}

// ============================================================================
// Route Name Mapping
// ============================================================================

/**
 * 경로를 사용자 친화적인 화면 이름으로 변환
 */
const ROUTE_NAMES: Record<string, string> = {
  // 루트
  '/': '홈',
  '/index': '홈',

  // 인증
  '/(auth)/login': '로그인',
  '/(auth)/signup': '회원가입',
  '/(auth)/forgot-password': '비밀번호 찾기',

  // 공개 페이지
  '/(public)/jobs': '공고 목록',
  '/(public)/jobs/[id]': '공고 상세',

  // 메인 앱 - 탭
  '/(app)/(tabs)': '홈',
  '/(app)/(tabs)/index': '홈',
  '/(app)/(tabs)/schedule': '스케줄',
  '/(app)/(tabs)/qr': 'QR 코드',
  '/(app)/(tabs)/profile': '프로필',

  // 메인 앱 - 기능
  '/(app)/jobs/[id]/apply': '지원하기',
  '/(app)/notifications': '알림',
  '/(app)/settings': '설정',
  '/(app)/settings/my-data': '내 데이터',
  '/(app)/settings/delete-account': '계정 삭제',

  // 구인자 기능
  '/(app)/(tabs)/employer': '내 공고',
  '/(employer)/my-postings/create': '공고 작성',
  '/(employer)/my-postings/[id]': '공고 상세',
  '/(employer)/my-postings/[id]/edit': '공고 수정',
  '/(employer)/my-postings/[id]/applicants': '지원자 관리',
  '/(employer)/my-postings/[id]/settlements': '정산 관리',

  // 404
  '/+not-found': '페이지 없음',
};

/**
 * 경로에서 화면 정보 추출
 */
function getScreenInfo(pathname: string, segments: string[]): ScreenInfo {
  // 동적 라우트 처리 ([id] 등)
  const normalizedPath = pathname.replace(/\/[^/]+$/, '/[id]');

  // 정확한 매칭 먼저 시도
  let name = ROUTE_NAMES[pathname];

  // 정규화된 경로로 재시도
  if (!name) {
    name = ROUTE_NAMES[normalizedPath];
  }

  // 없으면 경로 기반으로 생성
  if (!name) {
    // 세그먼트에서 화면 이름 추출
    const lastSegment = segments[segments.length - 1] || 'Unknown';
    name = lastSegment
      .replace(/[()[\]]/g, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  // 화면 클래스 (Firebase Analytics용)
  const screenClass = pathname
    .replace(/[()[\]]/g, '')
    .replace(/\//g, '_')
    .replace(/-/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  // 동적 파라미터 추출
  const params: Record<string, string> = {};
  segments.forEach((segment, index) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      const paramName = segment.slice(1, -1);
      const nextSegment = pathname.split('/')[index + 1];
      if (nextSegment && !nextSegment.startsWith('(')) {
        params[paramName] = nextSegment;
      }
    }
  });

  return {
    name,
    class: screenClass || 'UNKNOWN',
    params: Object.keys(params).length > 0 ? params : undefined,
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Navigation Tracking Hook
 *
 * 사용법:
 * ```tsx
 * function RootLayout() {
 *   useNavigationTracking();
 *   return <Stack />;
 * }
 * ```
 */
export function useNavigationTracking(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const navigationState = useRef<NavigationState>({
    previousPath: null,
    currentPath: '',
    timestamp: Date.now(),
    transitionCount: 0,
  });

  /**
   * 화면 전환 로깅
   */
  const logNavigation = useCallback(
    (screenInfo: ScreenInfo, from: string | null, to: string) => {
      const duration =
        navigationState.current.timestamp > 0
          ? Date.now() - navigationState.current.timestamp
          : 0;

      // 로거로 기록
      logger.info('화면 전환', {
        component: 'NavigationTracking',
        action: 'screen_change',
        from: from || 'initial',
        to,
        screenName: screenInfo.name,
        screenClass: screenInfo.class,
        params: screenInfo.params,
        duration: `${duration}ms`,
        transitionCount: navigationState.current.transitionCount,
      });

      // 성능 추적: 네비게이션 시간 기록
      if (from) {
        recordNavigationTime(from, to, duration);
      }
    },
    []
  );

  /**
   * Analytics 이벤트 전송
   */
  const trackScreenView = useCallback(
    async (screenInfo: ScreenInfo, pathname: string) => {
      try {
        // Firebase Analytics
        await analyticsService.trackScreenView(screenInfo.name, screenInfo.class);

        // Crashlytics breadcrumb
        crashlyticsService.leaveBreadcrumb('screen_view', {
          screen_name: screenInfo.name,
          screen_class: screenInfo.class,
          path: pathname,
          ...(screenInfo.params || {}),
        });
      } catch (error) {
        // Analytics 에러는 앱 동작에 영향 없도록 조용히 처리
        logger.debug('Analytics 전송 실패', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    []
  );

  /**
   * 경로 변경 감지 및 처리
   */
  useEffect(() => {
    // 같은 경로면 무시
    if (pathname === navigationState.current.currentPath) {
      return;
    }

    // 화면 정보 추출
    const screenInfo = getScreenInfo(pathname, segments);

    // 이전 경로 저장
    const previousPath = navigationState.current.currentPath || null;

    // 상태 업데이트
    navigationState.current = {
      previousPath,
      currentPath: pathname,
      timestamp: Date.now(),
      transitionCount: navigationState.current.transitionCount + 1,
    };

    // 로깅 및 Analytics
    logNavigation(screenInfo, previousPath, pathname);
    trackScreenView(screenInfo, pathname);
  }, [pathname, segments, logNavigation, trackScreenView]);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 현재 화면 정보 가져오기 (수동 사용용)
 */
export function useCurrentScreen(): ScreenInfo {
  const pathname = usePathname();
  const segments = useSegments();
  return getScreenInfo(pathname, segments);
}

/**
 * 화면 전환 횟수 가져오기 (디버깅용)
 */
export function useNavigationCount(): number {
  const countRef = useRef(0);
  const pathname = usePathname();

  useEffect(() => {
    countRef.current += 1;
  }, [pathname]);

  return countRef.current;
}

export default useNavigationTracking;
