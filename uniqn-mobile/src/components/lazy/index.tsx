/**
 * UNIQN Mobile - Lazy Loading Components
 *
 * 무거운 컴포넌트들의 동적 import를 위한 유틸리티
 *
 * @description
 * React Native에서 코드 스플리팅을 위한 래퍼
 * - React.lazy()와 Suspense를 사용한 동적 로딩
 * - 에러 바운더리와 폴백 UI 포함
 * - 웹과 네이티브 모두 지원
 *
 * @usage
 * ```tsx
 * import { LazyCalendarView, withSuspense } from '@/components/lazy';
 *
 * // 방법 1: 직접 Suspense 사용
 * <Suspense fallback={<Loading />}>
 *   <LazyCalendarView {...props} />
 * </Suspense>
 *
 * // 방법 2: withSuspense HOC 사용
 * const CalendarWithSuspense = withSuspense(LazyCalendarView);
 * <CalendarWithSuspense {...props} />
 * ```
 */

import React, { lazy, Suspense, ComponentType, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { logger } from '@/utils/logger';

// =============================================================================
// 기본 Fallback 컴포넌트
// =============================================================================

/**
 * 기본 로딩 폴백 UI
 */
export const DefaultFallback: React.FC<{ message?: string }> = ({ message = '로딩 중...' }) => (
  <View style={styles.fallbackContainer}>
    <ActivityIndicator size="large" color="#A855F7" />
    <Text style={styles.fallbackText}>{message}</Text>
  </View>
);

/**
 * 스켈레톤 폴백 (리스트용)
 */
export const SkeletonFallback: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <View style={styles.skeletonContainer}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={styles.skeletonItem} />
    ))}
  </View>
);

// =============================================================================
// Lazy Loading 유틸리티
// =============================================================================

/**
 * Suspense와 함께 사용하는 HOC
 *
 * @param LazyComponent - lazy()로 래핑된 컴포넌트
 * @param fallback - 로딩 중 표시할 UI (기본: DefaultFallback)
 */
export function withSuspense<P extends object>(
  LazyComponent: React.LazyExoticComponent<ComponentType<P>>,
  fallback: ReactNode = <DefaultFallback />
): React.FC<P> {
  const SuspenseWrapper: React.FC<P> = (props) => (
    <Suspense fallback={fallback}>
      <LazyComponent {...props} />
    </Suspense>
  );

  // displayName 설정 (디버깅용)
  const componentName =
    (LazyComponent as unknown as { _payload?: { _result?: { name?: string } } })?._payload?._result
      ?.name || 'LazyComponent';
  SuspenseWrapper.displayName = `withSuspense(${componentName})`;

  return SuspenseWrapper;
}

/**
 * 에러 경계가 있는 Suspense HOC
 */
export function withErrorBoundary<P extends object>(
  LazyComponent: React.LazyExoticComponent<ComponentType<P>>,
  fallback: ReactNode = <DefaultFallback />,
  errorFallback?: ReactNode
): React.FC<P> {
  const ErrorBoundaryWrapper: React.FC<P> = (props) => (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    </ErrorBoundary>
  );

  return ErrorBoundaryWrapper;
}

// =============================================================================
// Lazy Components
// =============================================================================

/**
 * CalendarView - 스케줄 캘린더 (무거운 react-native-calendars 포함)
 */
export const LazyCalendarView = lazy(() => import('@/components/schedule/CalendarView'));

/**
 * QRCodeScanner - QR 스캐너 (expo-camera 포함)
 */
export const LazyQRCodeScanner = lazy(() => import('@/components/qr/QRCodeScanner'));

/**
 * ScheduleDetailSheet - 스케줄 상세 BottomSheet
 */
export const LazyScheduleDetailSheet = lazy(
  () => import('@/components/schedule/ScheduleDetailSheet')
);

/**
 * SettlementList - 정산 목록 (구인자용)
 */
export const LazySettlementList = lazy(() => import('@/components/employer/SettlementList'));

/**
 * ApplicantList - 지원자 목록 (구인자용)
 */
export const LazyApplicantList = lazy(() => import('@/components/employer/ApplicantList'));

/**
 * JobFilters - 공고 필터
 */
export const LazyJobFilters = lazy(() => import('@/components/jobs/JobFilters'));

/**
 * ApplicationForm - 지원 폼 (Assignment 선택 포함)
 */
export const LazyApplicationForm = lazy(() => import('@/components/jobs/ApplicationForm'));

/**
 * Job Posting Scroll Form - 공고 작성 스크롤 폼
 */
export const LazyJobPostingScrollForm = lazy(
  () => import('@/components/employer/job-form/JobPostingScrollForm')
);

/**
 * Admin Components - 관리자용
 */
export const LazyUserList = lazy(() => import('@/components/admin/UserList'));
export const LazyUserDetail = lazy(() => import('@/components/admin/UserDetail'));

/**
 * Chart Components - 관리자 통계용 (react-native-chart-kit 포함)
 * @description 무거운 차트 라이브러리를 동적으로 로드하여 번들 크기 최적화
 */
export const LazyTrendChart = lazy(() => import('@/components/admin/stats/TrendChart'));
export const LazyRoleDistributionChart = lazy(
  () => import('@/components/admin/stats/RoleDistributionChart')
);

// =============================================================================
// 간단한 Error Boundary (React Native용)
// =============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('LazyComponent 렌더링 오류', error, {
      component: 'LazyComponent',
      componentStack: errorInfo.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>컴포넌트를 불러올 수 없습니다</Text>
          </View>
        )
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 200,
  },
  fallbackText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  skeletonContainer: {
    padding: 16,
  },
  skeletonItem: {
    height: 80,
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    marginBottom: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
  },
});

// =============================================================================
// Default Export
// =============================================================================

export default {
  // Utilities
  withSuspense,
  withErrorBoundary,
  DefaultFallback,
  SkeletonFallback,

  // Lazy Components
  LazyCalendarView,
  LazyQRCodeScanner,
  LazyScheduleDetailSheet,
  LazySettlementList,
  LazyApplicantList,
  LazyJobFilters,
  LazyApplicationForm,
  LazyJobPostingScrollForm,
  LazyUserList,
  LazyUserDetail,
  LazyTrendChart,
  LazyRoleDistributionChart,
};
