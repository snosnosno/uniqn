/**
 * UNIQN Mobile - 라우트 레지스트리
 *
 * @description 실제 Expo Router 파일 구조와 동기화된 라우트 정의 (SSOT)
 * @version 2.0.0
 *
 * 중요: 이 파일은 app/ 폴더 구조와 100% 동기화되어야 함
 * 새 라우트 추가 시 반드시 실제 파일 존재 여부 확인 필요
 */

// ============================================================================
// Expo Routes - 실제 앱 라우트 정의
// ============================================================================

/**
 * 실제 Expo Router 파일 구조 기반 라우트 매핑
 *
 * @description 모든 딥링크 경로의 단일 소스 of truth (SSOT)
 */
export const EXPO_ROUTES = {
  // === 루트 ===
  root: '/',

  // === 탭 (app)/(tabs) ===
  home: '/(app)/(tabs)',
  schedule: '/(app)/(tabs)/schedule',
  profile: '/(app)/(tabs)/profile',
  employerTab: '/(app)/(tabs)/employer',
  qr: '/(app)/(tabs)/qr',

  // === 앱 (app) - 인증 필요 ===
  notifications: '/(app)/notifications',
  jobDetail: '/(app)/jobs/[id]',
  jobApply: '/(app)/jobs/[id]/apply',
  settings: '/(app)/settings',
  settingsProfile: '/(app)/settings/profile',
  settingsChangePassword: '/(app)/settings/change-password',
  settingsDeleteAccount: '/(app)/settings/delete-account',
  settingsPrivacy: '/(app)/settings/privacy',
  settingsTerms: '/(app)/settings/terms',
  settingsEmployerTerms: '/(app)/settings/employer-terms',
  settingsLiabilityWaiver: '/(app)/settings/liability-waiver',
  settingsMyData: '/(app)/settings/my-data',
  applicationCancel: '/(app)/applications/[id]/cancel',
  employerRegister: '/(app)/employer-register',

  // === 공지사항 ===
  notices: '/(app)/notices',
  noticeDetail: '/(app)/notices/[id]',

  // === 고객지원 ===
  support: '/(app)/support',
  supportFaq: '/(app)/support/faq',
  supportCreateInquiry: '/(app)/support/create-inquiry',
  supportMyInquiries: '/(app)/support/my-inquiries',
  supportInquiryDetail: '/(app)/support/inquiry/[id]',

  // === 구인자 (employer) ===
  myPostings: '/(employer)/my-postings',
  postingCreate: '/(employer)/my-postings/create',
  postingDetail: '/(employer)/my-postings/[id]',
  postingEdit: '/(employer)/my-postings/[id]/edit',
  postingApplicants: '/(employer)/my-postings/[id]/applicants',
  postingSettlements: '/(employer)/my-postings/[id]/settlements',
  postingCancellationRequests: '/(employer)/my-postings/[id]/cancellation-requests',

  // === 관리자 (admin) ===
  adminDashboard: '/(admin)',
  adminUsers: '/(admin)/users',
  adminUserDetail: '/(admin)/users/[id]',
  adminReports: '/(admin)/reports',
  adminReportDetail: '/(admin)/reports/[id]',
  adminAnnouncements: '/(admin)/announcements',
  adminAnnouncementCreate: '/(admin)/announcements/create',
  adminAnnouncementDetail: '/(admin)/announcements/[id]',
  adminAnnouncementEdit: '/(admin)/announcements/[id]/edit',
  adminTournaments: '/(admin)/tournaments',
  adminInquiries: '/(admin)/inquiries',
  adminInquiryDetail: '/(admin)/inquiries/[id]',
  adminStats: '/(admin)/stats',
  adminSettings: '/(admin)/settings',

  // === 공개 (public) ===
  publicJobs: '/(public)/jobs',
  publicJobDetail: '/(public)/jobs/[id]',

  // === 인증 (auth) ===
  login: '/(auth)/login',
  signup: '/(auth)/signup',
  forgotPassword: '/(auth)/forgot-password',
} as const;

export type ExpoRouteName = keyof typeof EXPO_ROUTES;
export type ExpoRoutePath = (typeof EXPO_ROUTES)[ExpoRouteName];

// ============================================================================
// Route Metadata - 라우트 메타데이터
// ============================================================================

/**
 * 인증이 필요한 라우트 목록
 */
export const AUTH_REQUIRED_ROUTES: ExpoRouteName[] = [
  'notifications',
  'schedule',
  'profile',
  'settings',
  'support',
  'notices',
  'jobApply',
  'applicationCancel',
  'employerRegister',
  'myPostings',
  'postingCreate',
  'postingDetail',
  'postingEdit',
  'postingApplicants',
  'postingSettlements',
  'postingCancellationRequests',
];

/**
 * 구인자 권한이 필요한 라우트 목록
 */
export const EMPLOYER_REQUIRED_ROUTES: ExpoRouteName[] = [
  'myPostings',
  'postingCreate',
  'postingDetail',
  'postingEdit',
  'postingApplicants',
  'postingSettlements',
  'postingCancellationRequests',
];

/**
 * 관리자 권한이 필요한 라우트 목록
 */
export const ADMIN_REQUIRED_ROUTES: ExpoRouteName[] = [
  'adminDashboard',
  'adminUsers',
  'adminUserDetail',
  'adminReports',
  'adminReportDetail',
  'adminAnnouncements',
  'adminAnnouncementCreate',
  'adminAnnouncementDetail',
  'adminAnnouncementEdit',
  'adminTournaments',
  'adminInquiries',
  'adminInquiryDetail',
  'adminStats',
  'adminSettings',
];
