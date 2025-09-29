import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { Suspense } from 'react';
// import { lazyWithRetry } from './utils/lazyWithRetry';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth pages - load immediately for better UX
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import RequireEmailVerification from './components/auth/RequireEmailVerification';

import FirebaseErrorBoundary from './components/errors/FirebaseErrorBoundary';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import PrivateRoute from './components/auth/PrivateRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';
import { ToastContainer } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import NetworkStatusIndicator from './components/NetworkStatusIndicator';
import PWAUpdateNotification from './components/PWAUpdateNotification';
import PWAInstallPrompt from './components/PWAInstallPrompt';
// Zustand 마이그레이션: Context 대신 Adapter 사용
import { TournamentProvider } from './contexts/TournamentContextAdapter';
// UnifiedDataContext - 통합 데이터 관리
import { UnifiedDataProvider } from './contexts/UnifiedDataContext';
import { firebaseConnectionManager } from './utils/firebaseConnectionManager';
import { performanceMonitor } from './utils/performanceMonitor';
import { initializePerformance } from './utils/firebasePerformance';
import { preloadCriticalImages } from './utils/imagePreloader';
import { initializeFontOptimization } from './utils/fontOptimizer';
import { initializeOfflineSupport } from './utils/offlineSupport';
import { registerSW } from './utils/serviceWorker';

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
  // PrizesPage, // 비활성화 - 추후 업데이트 예정
  ShiftSchedulePage,
} = tournamentChunk;

const {
  LandingPage,
  ProfilePage,
  SupportPage,
} = coreChunk;


// A component to handle role-based redirection for authenticated users
const AppRedirect: React.FC = () => {
  const { isAdmin } = useAuth(); // isAdmin is kept for compatibility
  return isAdmin ? <Navigate to="/app/admin/ceo-dashboard" replace /> : <Navigate to="/app/profile" replace />;
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
      console.debug('이미지 프리로딩이 비활성화되었습니다 (성능 최적화)');

      // Service Worker 등록 (마지막에 실행)
      registerSW({
        onSuccess: () => {
          console.log('Service Worker 등록 성공 - 앱이 오프라인에서도 작동합니다.');
        },
        onUpdate: () => {
          console.log('새로운 버전이 available합니다. 페이지를 새로고침해주세요.');
        },
        onOfflineReady: () => {
          console.log('앱이 오프라인 사용을 위해 준비되었습니다.');
        },
      });
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
          <AuthProvider>
            <CapacitorInitializer>
              <UnifiedDataProvider>
                <TournamentProvider>
                  {/* 네트워크 상태 및 PWA 관련 UI */}
                  <NetworkStatusIndicator position="top" />
                  <PWAUpdateNotification />
                  <PWAInstallPrompt autoShow showDelay={5000} />

              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Suspense fallback={<LoadingSpinner />}><LandingPage /></Suspense>} />
                <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />

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
                      
                      {/* Dealer facing routes */}
                      <Route path="jobs" element={<Suspense fallback={<LoadingSpinner />}><JobBoardPage /></Suspense>} />
                      <Route path="my-schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="attendance" element={<Suspense fallback={<LoadingSpinner />}><AttendancePage /></Suspense>} />
                      <Route path="available-times" element={<Suspense fallback={<LoadingSpinner />}><AvailableTimesPage /></Suspense>} />
                      <Route path="support" element={<Suspense fallback={<LoadingSpinner />}><SupportPage /></Suspense>} />

                      {/* Admin & Manager Routes */}
                      <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
                        <Route path="staff/new" element={<Suspense fallback={<LoadingSpinner />}><StaffNewPage /></Suspense>} />
                        <Route path="shift-schedule" element={<Suspense fallback={<LoadingSpinner />}><ShiftSchedulePage /></Suspense>} />
                        <Route path="participants" element={<Suspense fallback={<LoadingSpinner />}><ParticipantsPage /></Suspense>} />
                        <Route path="tables" element={<Suspense fallback={<LoadingSpinner />}><TablesPage /></Suspense>} />
                        {/* 상금관리 페이지 - 추후 업데이트 예정 */}
                        <Route path="prizes" element={
                          <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
                            <div className="text-center max-w-md">
                              <div className="text-6xl mb-4">🚧</div>
                              <h2 className="text-3xl font-bold text-gray-800 mb-4">준비 중입니다</h2>
                              <p className="text-gray-600 mb-6">
                                상금관리 기능은 현재 업데이트 중입니다.
                                <br />
                                추후 다시 공개될 예정입니다.
                              </p>
                              <button
                                onClick={() => window.history.back()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                              >
                                돌아가기
                              </button>
                            </div>
                          </div>
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
                      </Route>
                    </Route>
                  </Route>
                </Routes>
                </TournamentProvider>
              </UnifiedDataProvider>
            </CapacitorInitializer>
          </AuthProvider>
          <ToastContainer />
        </QueryClientProvider>
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;