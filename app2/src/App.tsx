import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Auth pages - load immediately for better UX
import ForgotPassword from './pages/ForgotPassword';
import Login from './pages/Login';
import SignUp from './pages/SignUp';

import FirebaseErrorBoundary from './components/errors/FirebaseErrorBoundary';
import ErrorBoundary from './components/errors/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import PrivateRoute from './components/auth/PrivateRoute';
import RoleBasedRoute from './components/auth/RoleBasedRoute';
import { ToastContainer } from './components/Toast';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
// Zustand 마이그레이션: Context 대신 Adapter 사용
import { TournamentProvider } from './contexts/TournamentContextAdapter';
// UnifiedDataContext - 통합 데이터 관리
import { UnifiedDataProvider } from './contexts/UnifiedDataContext';
import { firebaseConnectionManager } from './utils/firebaseConnectionManager';
import { performanceMonitor } from './utils/performanceMonitor';
import { initializePerformance } from './utils/firebasePerformance';


// Lazy load admin pages
const ApprovalPage = lazy(() => import('./pages/admin/Approval'));
const CEODashboard = lazy(() => import('./pages/admin/CEODashboard'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));

// Lazy load main pages
const AttendancePage = lazy(() => import('./pages/AttendancePage'));
const AvailableTimesPage = lazy(() => import('./pages/AvailableTimesPage'));
const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));
const JobPostingAdminPage = lazy(() => import('./pages/JobPostingAdminPage'));
const JobPostingDetailPage = lazy(() => import('./pages/JobPostingDetailPage'));
const MySchedulePage = lazy(() => import('./pages/MySchedulePage'));
const ParticipantsPage = lazy(() => import('./pages/ParticipantsPage'));
const PrizesPage = lazy(() => import('./pages/PrizesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ShiftSchedulePage = lazy(() => import('./pages/ShiftSchedulePage'));
const StaffNewPage = lazy(() => import('./pages/StaffNewPage'));
const TablesPage = lazy(() => import('./pages/TablesPage'));


// A component to handle role-based redirection
const HomeRedirect: React.FC = () => {
  const { isAdmin } = useAuth(); // isAdmin is kept for compatibility
  return isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/profile" replace />;
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
    firebaseConnectionManager.enableAutoRecovery();
    
    // Firebase Performance 초기화
    initializePerformance();
    
    // 성능 모니터링 시작
    performanceMonitor.measureWebVitals();
    performanceMonitor.measureMemory();
    
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
            <UnifiedDataProvider>
              <TournamentProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  
                  {/* Authenticated Routes */}
                  <Route element={<PrivateRoute />}>
                    <Route path="/" element={<Layout />}>
                      <Route index element={<HomeRedirect />} />
                      <Route path="profile" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />
                      <Route path="profile/:userId" element={<Suspense fallback={<LoadingSpinner />}><ProfilePage /></Suspense>} />
                      
                      {/* Dealer facing routes */}
                      <Route path="jobs" element={<Suspense fallback={<LoadingSpinner />}><JobBoardPage /></Suspense>} />
                      <Route path="my-schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="schedule" element={<Suspense fallback={<LoadingSpinner />}><MySchedulePage /></Suspense>} />
                      <Route path="attendance" element={<Suspense fallback={<LoadingSpinner />}><AttendancePage /></Suspense>} />
                      <Route path="available-times" element={<Suspense fallback={<LoadingSpinner />}><AvailableTimesPage /></Suspense>} />

                      {/* Admin & Manager Routes */}
                      <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
                        <Route path="dashboard" element={<Suspense fallback={<LoadingSpinner />}><DashboardPage /></Suspense>} />
                        <Route path="staff/new" element={<Suspense fallback={<LoadingSpinner />}><StaffNewPage /></Suspense>} />
                        <Route path="shift-schedule" element={<Suspense fallback={<LoadingSpinner />}><ShiftSchedulePage /></Suspense>} />
                        <Route path="participants" element={<Suspense fallback={<LoadingSpinner />}><ParticipantsPage /></Suspense>} />
                        <Route path="tables" element={<Suspense fallback={<LoadingSpinner />}><TablesPage /></Suspense>} />
                        <Route path="prizes" element={<Suspense fallback={<LoadingSpinner />}><PrizesPage /></Suspense>} />
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
                      </Route>
                    </Route>
                  </Route>
                </Routes>
              </TournamentProvider>
            </UnifiedDataProvider>
          </AuthProvider>
          </QueryClientProvider>
          <ToastContainer />
      </FirebaseErrorBoundary>
    </ErrorBoundary>
  );
}

export default App;