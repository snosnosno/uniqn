import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { Suspense } from 'react';
// import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, Navigate } from 'react-router-dom';

// Feature Flags
import { FEATURE_FLAGS, MAINTENANCE_ALLOWED_ROLES } from './config/features';

// Auth pages - load immediately for better UX
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import ConsentPage from './pages/ConsentPage';
import RequireEmailVerification from './components/auth/RequireEmailVerification';

// Coming Soon page
import ComingSoon from './components/ComingSoon';

// Maintenance page
import MaintenancePage from './pages/MaintenancePage';

import FirebaseErrorBoundary from './components/errors/FirebaseErrorBoundary';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import PrivateRoute from './components/auth/PrivateRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';
import { ToastContainer } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
// Zustand 마이그레이션: Context 대신 Adapter 사용
import { TournamentProvider } from './contexts/TournamentContextAdapter';
// UnifiedDataInitializer - Zustand Store 초기화
import { UnifiedDataInitializer } from './components/UnifiedDataInitializer';
// TournamentDataContext - 토너먼트 데이터 전역 관리
import { TournamentDataProvider } from './contexts/TournamentDataContext';
// DateFilterStore - 날짜 선택 상태 관리 (Zustand, Provider 불필요)
// ThemeContext - 다크모드 지원
import { ThemeProvider } from './contexts/ThemeContext';
import { firebaseConnectionManager } from './utils/firebaseConnectionManager';
import { performanceMonitor } from './utils/performanceMonitor';
import { initializePerformance } from './utils/firebasePerformance';
import { initializeFontOptimization } from './utils/fontOptimizer';
import { initializeOfflineSupport } from './utils/offlineSupport';
import { logger } from './utils/logger';

// Capacitor 네이티브 서비스 초기화 컴포넌트
import CapacitorInitializer from './components/capacitor/CapacitorInitializer';



// Import grouped lazy chunks for optimized bundle splitting
import {
  adminChunk,
  staffChunk,
  jobManagementChunk,
  tournamentChunk,
  coreChunk
} from './utils/lazyChunks';

// Notification Pages
const NotificationTestPage = React.lazy(() => import('./pages/NotificationTestPage'));
const AnnouncementsPage = React.lazy(() => import('./pages/AnnouncementsPage'));
const NotificationSettingsPage = React.lazy(() => import('./pages/NotificationSettingsPage'));

// Job Posting Approval Page (Admin Only)
const ApprovalManagementPage = React.lazy(() => import('./pages/ApprovalManagementPage'));

// Settings & Legal Pages
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/legal/TermsOfServicePage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/legal/PrivacyPolicyPage'));

// Extract components from chunks
const {
  ApprovalPage,
  CEODashboard,
  UserManagementPage,
  InquiryManagementPage,
} = adminChunk;

const {
  AttendancePage,
  AvailableTimesPage,
  MySchedulePage,
} = staffChunk;

const {
  JobBoardPage,
  JobPostingAdminPage,
  JobPostingDetailPage,
  StaffNewPage,
} = jobManagementChunk;

const {
  ParticipantsPage,
  TablesPage,
  TournamentsPage,
  // PrizesPage, // 비활성화 - 추후 업데이트 예정
  ShiftSchedulePage,
} = tournamentChunk;

const {
  LandingPage,
  ProfilePage,
  SupportPage,
} = coreChunk;

// 알림 페이지 (Lazy Load)
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));


// A component to handle role-based redirection for authenticated users
const AppRedirect: React.FC = () => {
  const { isAdmin } = useAuth(); // isAdmin is kept for compatibility
  return isAdmin ? <Navigate to="/app/admin/ceo-dashboard" replace /> : <Navigate to="/app/profile" replace />;
};

// Maintenance mode checker component
const MaintenanceModeCheck: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, role, loading } = useAuth();

  // 로딩 중이면 로딩 스피너 표시
  if (loading) {
    return <LoadingSpinner />;
  }

  // 점검 모드가 활성화되어 있고, 사용자가 로그인했으며, 허용된 역할이 아닌 경우
  if (
    FEATURE_FLAGS.MAINTENANCE_MODE &&
    currentUser &&
    !MAINTENANCE_ALLOWED_ROLES.includes(role as typeof MAINTENANCE_ALLOWED_ROLES[number])
  ) {
    return <MaintenancePage />;
  }

  // 정상적으로 앱 렌더링
  return <>{children}</>;
};

// Create a client with optimized cache settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  // Firebase 자동 복구 활성화 및 성능 모니터링
  React.useEffect(() => {
    const initializeApp = async () => {
      firebaseConnectionManager.enableAutoRecovery();

      // Firebase Performance 초기화
      initializePerformance();

      // 폰트 최적화 초기화 (가장 먼저 실행)
      initializeFontOptimization();

      // Firebase 오프라인 지원 초기화
      await initializeOfflineSupport({
        enablePersistence: true,
        synchronizeTabs: false, // 다중 탭 지원은 비활성화 (안정성을 위해)
        cacheSizeBytes: 40 * 1024 * 1024, // 40MB 캐시
      });

      // 성능 모니터링 시작
      performanceMonitor.measureWebVitals();
      performanceMonitor.measureMemory();

      // 이미지 프리로딩 비활성화 (preload 경고 방지)
      // 이미지는 실제 사용 시점에 로딩됨
      logger.debug('이미지 프리로딩이 비활성화되었습니다 (성능 최적화)');
    };

    initializeApp();

    // 페이지 로드 완료 후 번들 크기 분석
    window.addEventListener('load', () => {
      performanceMonitor.analyzeBundleSize();
    });

    return () => {
      performanceMonitor.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <FirebaseErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <MaintenanceModeCheck>
                <CapacitorInitializer>
                  <UnifiedDataInitializer>
                    <TournamentProvider>
                      <TournamentDataProvider>
                        {/* DateFilterProvider 제거 - Zustand Store 사용 */}
                        {/* 네트워크 상태 표시 */}
                        <NetworkStatusIndicator position="top" />

                <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Suspense fallback={<LoadingSpinner />}><LandingPage /></Suspense>} />
                <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/consent" element={<ConsentPage />} />

                  {/* Legal Documents - Public Access (회원가입 시 확인 가능해야 함) */}
                  <Route path="/terms-of-service" element={<Suspense fallback={<LoadingSpinner />}><TermsOfServicePage /></Suspense>} />
                  <Route path="/privacy-policy" element={<Suspense fallback={<LoadingSpinner />}><PrivacyPolicyPage /></Suspense>} />

                  {/* Authenticated Routes */}
                  <Route path="/app" element={<PrivateRoute />}>
                    <Route path="/app" element={
                      <RequireEmailVerification>
                        <Layout />
                      </RequireEmailVerification>
                    }>
                      <Route index element={<AppRedirect />} />
                      <Route path="profile" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />
                      <Route path="profile/:userId" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />

                      {/* 알림 센터 */}
                      <Route path="notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationsPage /></Suspense>} />
                      <Route path="notification-settings" element={<Suspense fallback={<LoadingSpinner />}><NotificationSettingsPage /></Suspense>} />
                      <Route path="test-notifications" element={<Suspense fallback={<LoadingSpinner />}><NotificationTestPage /></Suspense>} />
                      <Route path="announcements" element={<Suspense fallback={<LoadingSpinner />}><AnnouncementsPage /></Suspense>} />

                      {/* 설정 */}
                      <Route path="settings" element={<Suspense fallback={<LoadingSpinner />}><SettingsPage /></Suspense>} />

                      {/* Dealer facing routes */}
                      <Route path="jobs" element={<Suspense fallback={<LoadingSpinner />}><JobBoardPage /></Suspense>} />
                      <Route path="my-schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="attendance" element={<Suspense fallback={<LoadingSpinner />}><AttendancePage /></Suspense>} />
                      <Route path="available-times" element={<Suspense fallback={<LoadingSpinner />}><AvailableTimesPage /></Suspense>} />
                      <Route path="support" element={<Suspense fallback={<LoadingSpinner />}><SupportPage /></Suspense>} />

                      {/* Tournament Management - All authenticated users */}
                      <Route path="tournaments" element={
                        FEATURE_FLAGS.TOURNAMENTS ? (
                          <Suspense fallback={<LoadingSpinner />}><TournamentsPage /></Suspense>
                        ) : (
                          <ComingSoon feature="토너먼트 관리" />
                        )
                      } />
                      <Route path="participants" element={
                        FEATURE_FLAGS.PARTICIPANTS ? (
                          <Suspense fallback={<LoadingSpinner />}><ParticipantsPage /></Suspense>
                        ) : (
                          <ComingSoon feature="참가자 관리" />
                        )
                      } />
                      <Route path="tables" element={
                        FEATURE_FLAGS.TABLES ? (
                          <Suspense fallback={<LoadingSpinner />}><TablesPage /></Suspense>
                        ) : (
                          <ComingSoon feature="테이블 관리" />
                        )
                      } />

                      {/* Admin & Manager Routes */}
                      <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
                        <Route path="staff/new" element={<Suspense fallback={<LoadingSpinner />}><StaffNewPage /></Suspense>} />
                        <Route path="shift-schedule" element={
                          FEATURE_FLAGS.SHIFT_SCHEDULE ? (
                            <Suspense fallback={<LoadingSpinner />}><ShiftSchedulePage /></Suspense>
                          ) : (
                            <ComingSoon feature="교대 관리" />
                          )
                        } />
                        {/* 상금관리 페이지 - 추후 업데이트 예정 */}
                        <Route path="prizes" element={
                          FEATURE_FLAGS.PRIZES ? (
                            <ComingSoon feature="상금 관리" />
                          ) : (
                            <ComingSoon feature="상금 관리" />
                          )
                        } />
                      </Route>

                      {/* Job Posting Management - Admin, Manager, Staff with permission */}
                      <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager', 'staff']} />}>
                        <Route path="job-postings" element={<Suspense fallback={<LoadingSpinner />}><JobPostingAdminPage /></Suspense>} />
                        <Route path="job-posting/:id" element={<Suspense fallback={<LoadingSpinner />}><JobPostingDetailPage /></Suspense>} />
                      </Route>

                      {/* Admin Only Route */}
                      <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin']} />}>
                          <Route path="ceo-dashboard" element={<Suspense fallback={<LoadingSpinner />}><CEODashboard /></Suspense>} />
                          <Route path="approvals" element={<Suspense fallback={<LoadingSpinner />}><ApprovalPage /></Suspense>} />
                          <Route path="user-management" element={<Suspense fallback={<LoadingSpinner />}><UserManagementPage /></Suspense>} />
                          <Route path="inquiries" element={<Suspense fallback={<LoadingSpinner />}><InquiryManagementPage /></Suspense>} />
                          <Route path="job-posting-approvals" element={<Suspense fallback={<LoadingSpinner />}><ApprovalManagementPage /></Suspense>} />
                      </Route>
                    </Route>
                  </Route>
                </Routes>
                      </TournamentDataProvider>
                    </TournamentProvider>
                  </UnifiedDataInitializer>
                </CapacitorInitializer>
              </MaintenanceModeCheck>
            </AuthProvider>
            <ToastContainer />
          </ThemeProvider>
        </QueryClientProvider>
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;