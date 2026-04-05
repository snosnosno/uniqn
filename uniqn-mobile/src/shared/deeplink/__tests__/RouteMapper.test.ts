import { RouteMapper } from '../RouteMapper';
import { EXPO_ROUTES } from '../RouteRegistry';
import type { DeepLinkRoute } from '../types';
import { buildBoardNoticePostId } from '@/shared/board/boardIds';

describe('RouteMapper', () => {
  describe('toExpoPath', () => {
    it('maps public routes', () => {
      expect(RouteMapper.toExpoPath({ name: 'home' })).toBe(EXPO_ROUTES.home);
      expect(RouteMapper.toExpoPath({ name: 'jobs' })).toBe(EXPO_ROUTES.home);
      expect(RouteMapper.toExpoPath({ name: 'job', params: { id: 'job-123' } })).toBe(
        '/jobs/job-123'
      );
      expect(RouteMapper.toExpoPath({ name: 'login' })).toBe(EXPO_ROUTES.login);
      expect(RouteMapper.toExpoPath({ name: 'signup' })).toBe(EXPO_ROUTES.signup);
      expect(RouteMapper.toExpoPath({ name: 'forgot-password' })).toBe(EXPO_ROUTES.forgotPassword);
    });

    it('maps authenticated root routes', () => {
      expect(RouteMapper.toExpoPath({ name: 'notifications' })).toBe(EXPO_ROUTES.notifications);
      expect(RouteMapper.toExpoPath({ name: 'schedule' })).toBe(EXPO_ROUTES.schedule);
      expect(RouteMapper.toExpoPath({ name: 'board' })).toBe(EXPO_ROUTES.board);
      expect(RouteMapper.toExpoPath({ name: 'board/post', params: { postId: 'post-1' } })).toBe(
        '/(app)/(tabs)/board/post/post-1'
      );
      expect(RouteMapper.toExpoPath({ name: 'profile' })).toBe(EXPO_ROUTES.profile);
      expect(RouteMapper.toExpoPath({ name: 'settings' })).toBe(EXPO_ROUTES.settings);
      expect(RouteMapper.toExpoPath({ name: 'support' })).toBe(EXPO_ROUTES.support);
      expect(RouteMapper.toExpoPath({ name: 'notices' })).toBe(EXPO_ROUTES.notices);
    });

    it('maps nested settings routes', () => {
      const cases: [DeepLinkRoute, string][] = [
        [{ name: 'settings/profile' }, EXPO_ROUTES.settingsProfile],
        [{ name: 'settings/change-password' }, EXPO_ROUTES.settingsChangePassword],
        [{ name: 'settings/delete-account' }, EXPO_ROUTES.settingsDeleteAccount],
        [{ name: 'settings/privacy' }, EXPO_ROUTES.settingsPrivacy],
        [{ name: 'settings/terms' }, EXPO_ROUTES.settingsTerms],
        [{ name: 'settings/employer-terms' }, EXPO_ROUTES.settingsEmployerTerms],
        [{ name: 'settings/liability-waiver' }, EXPO_ROUTES.settingsLiabilityWaiver],
        [{ name: 'settings/my-data' }, EXPO_ROUTES.settingsMyData],
        [{ name: 'settings/business-info' }, EXPO_ROUTES.settingsBusinessInfo],
      ];

      cases.forEach(([route, expected]) => {
        expect(RouteMapper.toExpoPath(route)).toBe(expected);
      });
    });

    it('maps nested support and notices routes', () => {
      expect(RouteMapper.toExpoPath({ name: 'support/faq' })).toBe(EXPO_ROUTES.supportFaq);
      expect(RouteMapper.toExpoPath({ name: 'support/create-inquiry' })).toBe(
        EXPO_ROUTES.supportCreateInquiry
      );
      expect(RouteMapper.toExpoPath({ name: 'support/my-inquiries' })).toBe(
        EXPO_ROUTES.supportMyInquiries
      );
      expect(RouteMapper.toExpoPath({ name: 'support/inquiry', params: { id: 'inq-1' } })).toBe(
        '/(app)/support/inquiry/inq-1'
      );
      expect(RouteMapper.toExpoPath({ name: 'notice', params: { id: 'notice-1' } })).toBe(
        `/(app)/(tabs)/board/post/${buildBoardNoticePostId('notice-1')}`
      );
    });

    it('maps employer routes', () => {
      expect(RouteMapper.toExpoPath({ name: 'employer/my-postings' })).toBe(
        EXPO_ROUTES.employerTab
      );
      expect(RouteMapper.toExpoPath({ name: 'employer/posting-create' })).toBe(
        EXPO_ROUTES.postingCreate
      );
      expect(RouteMapper.toExpoPath({ name: 'employer/posting', params: { id: 'job-1' } })).toBe(
        '/(employer)/my-postings/job-1'
      );
      expect(
        RouteMapper.toExpoPath({ name: 'employer/posting-edit', params: { id: 'job-1' } })
      ).toBe('/(employer)/my-postings/job-1/edit');
      expect(
        RouteMapper.toExpoPath({ name: 'employer/applicants', params: { jobId: 'job-1' } })
      ).toBe('/(employer)/my-postings/job-1/applicants');
      expect(
        RouteMapper.toExpoPath({ name: 'employer/settlement', params: { jobId: 'job-1' } })
      ).toBe('/(employer)/my-postings/job-1/settlements');
    });

    it('maps admin routes, including stats and announcements', () => {
      const cases: [DeepLinkRoute, string][] = [
        [{ name: 'admin/dashboard' }, EXPO_ROUTES.adminDashboard],
        [{ name: 'admin/users' }, EXPO_ROUTES.adminUsers],
        [{ name: 'admin/user', params: { id: 'user-1' } }, '/(admin)/users/user-1'],
        [{ name: 'admin/stats' }, EXPO_ROUTES.adminStats],
        [{ name: 'admin/reports' }, EXPO_ROUTES.adminReports],
        [{ name: 'admin/report', params: { id: 'report-1' } }, '/(admin)/reports/report-1'],
        [{ name: 'admin/announcements' }, EXPO_ROUTES.adminAnnouncements],
        [{ name: 'admin/announcement-create' }, EXPO_ROUTES.adminAnnouncementCreate],
        [{ name: 'admin/announcement', params: { id: 'ann-1' } }, '/(admin)/announcements/ann-1'],
        [
          { name: 'admin/announcement-edit', params: { id: 'ann-1' } },
          '/(admin)/announcements/ann-1/edit',
        ],
        [{ name: 'admin/inquiries' }, EXPO_ROUTES.adminInquiries],
        [{ name: 'admin/inquiry', params: { id: 'inq-1' } }, '/(admin)/inquiries/inq-1'],
        [{ name: 'admin/tournaments' }, EXPO_ROUTES.adminTournaments],
      ];

      cases.forEach(([route, expected]) => {
        expect(RouteMapper.toExpoPath(route)).toBe(expected);
      });
    });
  });

  describe('requiresAuth', () => {
    it('keeps only share and auth helper routes public', () => {
      expect(RouteMapper.requiresAuth('home')).toBe(true);
      expect(RouteMapper.requiresAuth('jobs')).toBe(true);
      expect(RouteMapper.requiresAuth('job')).toBe(false);
      expect(RouteMapper.requiresAuth('login')).toBe(false);
      expect(RouteMapper.requiresAuth('signup')).toBe(false);
      expect(RouteMapper.requiresAuth('forgot-password')).toBe(false);
    });

    it('treats nested app, employer, and admin routes as authenticated', () => {
      expect(RouteMapper.requiresAuth('settings/change-password')).toBe(true);
      expect(RouteMapper.requiresAuth('support/faq')).toBe(true);
      expect(RouteMapper.requiresAuth('notice')).toBe(true);
      expect(RouteMapper.requiresAuth('employer/posting')).toBe(true);
      expect(RouteMapper.requiresAuth('admin/announcements')).toBe(true);
    });
  });

  describe('getRequiredRole', () => {
    it('keeps standard app routes unrestricted', () => {
      expect(RouteMapper.getRequiredRole('home')).toBeNull();
      expect(RouteMapper.getRequiredRole('settings/change-password')).toBeNull();
      expect(RouteMapper.getRequiredRole('support/faq')).toBeNull();
    });

    it('marks employer routes as employer-only', () => {
      expect(RouteMapper.getRequiredRole('employer/my-postings')).toBe('employer');
      expect(RouteMapper.getRequiredRole('employer/applicants')).toBe('employer');
    });

    it('marks admin routes as admin-only', () => {
      expect(RouteMapper.getRequiredRole('admin/users')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/stats')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/announcement-edit')).toBe('admin');
    });
  });
});
