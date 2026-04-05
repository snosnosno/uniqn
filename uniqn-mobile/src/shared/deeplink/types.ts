export type DeepLinkRoute =
  | { name: 'home' }
  | { name: 'jobs' }
  | { name: 'job'; params: { id: string } }
  | { name: 'login' }
  | { name: 'signup' }
  | { name: 'forgot-password' }
  | { name: 'notifications' }
  | { name: 'schedule' }
  | { name: 'board' }
  | { name: 'board/post'; params: { postId: string } }
  | { name: 'profile' }
  | { name: 'settings' }
  | { name: 'settings/profile' }
  | { name: 'settings/change-password' }
  | { name: 'settings/delete-account' }
  | { name: 'settings/privacy' }
  | { name: 'settings/terms' }
  | { name: 'settings/employer-terms' }
  | { name: 'settings/liability-waiver' }
  | { name: 'settings/my-data' }
  | { name: 'settings/business-info' }
  | { name: 'support' }
  | { name: 'support/faq' }
  | { name: 'support/create-inquiry' }
  | { name: 'support/my-inquiries' }
  | { name: 'support/inquiry'; params: { id: string } }
  | { name: 'notices' }
  | { name: 'notice'; params: { id: string } }
  | { name: 'employer/my-postings' }
  | { name: 'employer/posting-create' }
  | { name: 'employer/posting'; params: { id: string } }
  | { name: 'employer/posting-edit'; params: { id: string } }
  | { name: 'employer/applicants'; params: { jobId: string } }
  | { name: 'employer/settlement'; params: { jobId: string } }
  | { name: 'admin/dashboard' }
  | { name: 'admin/users' }
  | { name: 'admin/user'; params: { id: string } }
  | { name: 'admin/stats' }
  | { name: 'admin/reports' }
  | { name: 'admin/report'; params: { id: string } }
  | { name: 'admin/announcements' }
  | { name: 'admin/announcement-create' }
  | { name: 'admin/announcement'; params: { id: string } }
  | { name: 'admin/announcement-edit'; params: { id: string } }
  | { name: 'admin/inquiries' }
  | { name: 'admin/inquiry'; params: { id: string } }
  | { name: 'admin/tournaments' }
  | { name: 'reviews/detail'; params: { workLogId: string } }
  | { name: 'reviews/pending' };

export interface ParsedDeepLink {
  url: string;
  path: string;
  queryParams: Record<string, string>;
  route: DeepLinkRoute | null;
  isValid: boolean;
}

export interface NavigationContext {
  source: 'deeplink' | 'notification';
  type?: string;
  url?: string;
}

export const ROUTE_GROUPS = {
  public: '(public)',
  auth: '(auth)',
  app: '(app)',
  employer: '(employer)',
  admin: '(admin)',
} as const;

export type RouteGroup = (typeof ROUTE_GROUPS)[keyof typeof ROUTE_GROUPS];
