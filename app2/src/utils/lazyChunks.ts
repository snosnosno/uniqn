import { lazy } from 'react';

// Admin 기능 그룹 - 하나의 청크로 묶음
export const adminChunk = {
  UserManagementPage: lazy(() => import('../pages/admin/UserManagementPage')),
  InquiryManagementPage: lazy(() => import('../pages/admin/InquiryManagementPage')),
};

// 토너먼트 운영 관리 그룹
export const tournamentChunk = {
  TournamentsPage: lazy(() => import('../pages/TournamentsPage')),
  ParticipantsPage: lazy(() => import('../pages/ParticipantsPage')),
  TablesPage: lazy(() => import('../pages/TablesPage')),
  PrizesPage: lazy(() => import('../pages/PrizesPage')),
  ShiftSchedulePage: lazy(() => import('../pages/ShiftSchedulePage')),
};

// 기본 페이지 그룹
export const coreChunk = {
  LandingPage: lazy(() => import('../pages/LandingPage')),
  ProfilePage: lazy(() => import('../pages/ProfilePage')),
  SupportPage: lazy(() => import('../pages/SupportPage')),
};
