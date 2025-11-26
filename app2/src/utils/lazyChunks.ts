import { lazyWithRetry } from './lazyWithRetry';

// Admin 기능 그룹 - 하나의 청크로 묶음
export const adminChunk = {
  ApprovalPage: lazyWithRetry(() => import('../pages/admin/Approval')),
  UserManagementPage: lazyWithRetry(() => import('../pages/admin/UserManagementPage')),
  InquiryManagementPage: lazyWithRetry(() => import('../pages/admin/InquiryManagementPage')),
};

// 직원 기능 그룹 - 하나의 청크로 묶음
export const staffChunk = {
  AttendancePage: lazyWithRetry(() => import('../pages/AttendancePage')),
  AvailableTimesPage: lazyWithRetry(() => import('../pages/AvailableTimesPage')),
  MySchedulePage: lazyWithRetry(() => import('../pages/MySchedulePage')),
};

// 구인/스태프 관리 그룹
export const jobManagementChunk = {
  JobBoardPage: lazyWithRetry(() => import('../pages/JobBoardPage')),
  JobPostingAdminPage: lazyWithRetry(() => import('../pages/JobPostingAdminPage')),
  JobPostingDetailPage: lazyWithRetry(() => import('../pages/JobPostingDetailPage')),
  StaffNewPage: lazyWithRetry(() => import('../pages/StaffNewPage')),
};

// 토너먼트 운영 관리 그룹
export const tournamentChunk = {
  TournamentsPage: lazyWithRetry(() => import('../pages/TournamentsPage')),
  ParticipantsPage: lazyWithRetry(() => import('../pages/ParticipantsPage')),
  TablesPage: lazyWithRetry(() => import('../pages/TablesPage')),
  PrizesPage: lazyWithRetry(() => import('../pages/PrizesPage')),
  ShiftSchedulePage: lazyWithRetry(() => import('../pages/ShiftSchedulePage')),
};

// 기본 페이지 그룹
export const coreChunk = {
  LandingPage: lazyWithRetry(() => import('../pages/LandingPage')),
  ProfilePage: lazyWithRetry(() => import('../pages/ProfilePage')),
  SupportPage: lazyWithRetry(() => import('../pages/SupportPage')),
};