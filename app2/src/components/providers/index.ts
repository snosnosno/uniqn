/**
 * Provider 그룹 모듈
 *
 * Provider 중첩을 줄이고 Suspense 경계를 명확히 하여
 * 성능을 최적화합니다.
 *
 * 기존 구조 (9단계 중첩):
 * ErrorBoundary > FirebaseErrorBoundary > QueryClientProvider >
 * ThemeProvider > AuthProvider > MaintenanceModeCheck >
 * CapacitorInitializer > UnifiedDataInitializer >
 * TournamentProvider > TournamentDataProvider
 *
 * 최적화된 구조 (그룹별 Suspense 경계):
 * CoreProviders (5개) > FeatureProviders (2개) > DataProviders (3개)
 *
 * 각 그룹은 독립적인 Suspense 경계를 가지므로
 * 부분적인 렌더링 및 에러 격리가 가능합니다.
 */

export { CoreProviders } from './CoreProviders';
export { DataProviders } from './DataProviders';
