import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import FirebaseErrorBoundary from './components/FirebaseErrorBoundary';
import { Layout } from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import RoleBasedRoute from './components/RoleBasedRoute'; // Import the new RoleBasedRoute
import { ToastContainer } from './components/Toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { TournamentProvider } from './contexts/TournamentContext';

// Page Imports
import ApprovalPage from './pages/admin/Approval';
import DashboardPage from './pages/admin/DashboardPage';
import PayrollAdminPage from './pages/admin/PayrollAdminPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import AttendancePage from './pages/AttendancePage';
import AvailableTimesPage from './pages/AvailableTimesPage';
import BlindsPage from './pages/BlindsPage';
import DealerRotationPage from './pages/DealerRotationPage';
import ForgotPassword from './pages/ForgotPassword';
import HistoryDetailPage from './pages/HistoryDetailPage';
import HistoryPage from './pages/HistoryPage';
import JobBoardPage from './pages/JobBoardPage';
import JobPostingAdminPage from './pages/JobPostingAdminPage';
import JobPostingDetailPage from './pages/JobPostingDetailPage';
import Login from './pages/Login';
import ParticipantLivePage from './pages/ParticipantLivePage';
import ParticipantsPage from './pages/ParticipantsPage';
import PayrollPage from './pages/PayrollPage';
import PrizesPage from './pages/PrizesPage';
import ProfilePage from './pages/ProfilePage';
import ShiftSchedulePage from './pages/ShiftSchedulePage';
import SignUp from './pages/SignUp';
import StaffListPage from './pages/StaffListPage';
import StaffNewPage from './pages/StaffNewPage';
import TablesPage from './pages/TablesPage';

// Admin Pages

// Dealer Pages

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
  return (
    <FirebaseErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <TournamentProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/live/:tournamentId" element={<ParticipantLivePage />} />
                
                {/* Authenticated Routes */}
                <Route element={<PrivateRoute />}>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomeRedirect />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="profile/:userId" element={<ProfilePage />} />
                    <Route path="payroll" element={<PayrollPage />} />
                    <Route path="payroll/:userId" element={<PayrollPage />} />
                    
                    {/* Dealer facing routes */}
                    <Route path="jobs" element={<JobBoardPage />} />
                    <Route path="attendance" element={<AttendancePage />} />
                    <Route path="available-times" element={<AvailableTimesPage />} />

                    {/* Admin & Manager Routes */}
                    <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager']} />}>
                      <Route path="dashboard" element={<DashboardPage />} />
                      <Route path="staff" element={<StaffListPage />} />
                      <Route path="staff/new" element={<StaffNewPage />} />
                      <Route path="dealer-rotation" element={<DealerRotationPage />} />
                      <Route path="shift-schedule" element={<ShiftSchedulePage />} />
                      <Route path="payroll" element={<PayrollAdminPage />} />
                      <Route path="participants" element={<ParticipantsPage />} />
                      <Route path="tables" element={<TablesPage />} />
                      <Route path="blinds" element={<BlindsPage />} />
                      <Route path="prizes" element={<PrizesPage />} />
                      <Route path="announcements" element={<AnnouncementsPage />} />
                      <Route path="history" element={<HistoryPage />} />
                      <Route path="history/:logId" element={<HistoryDetailPage />} />
                    </Route>

                    {/* Job Posting Management - Admin, Manager, Staff with permission */}
                    <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin', 'manager', 'staff']} />}>
                      <Route path="job-postings" element={<JobPostingAdminPage />} />
                      <Route path="job-posting/:id" element={<JobPostingDetailPage />} />
                    </Route>

                    {/* Admin Only Route */}
                    <Route path="admin" element={<RoleBasedRoute allowedRoles={['admin']} />}>
                        <Route path="approvals" element={<ApprovalPage />} />
                        <Route path="user-management" element={<UserManagementPage />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </TournamentProvider>
          </AuthProvider>
          <ToastContainer />
        </ToastProvider>
      </QueryClientProvider>
    </FirebaseErrorBoundary>
  );
}

export default App;