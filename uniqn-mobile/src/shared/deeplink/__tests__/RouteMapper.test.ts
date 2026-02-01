/**
 * RouteMapper 테스트
 *
 * @description DeepLinkRoute → Expo Router 경로 변환 테스트
 */

import { RouteMapper } from '../RouteMapper';
import { EXPO_ROUTES } from '../RouteRegistry';
import type { DeepLinkRoute } from '../types';

describe('RouteMapper', () => {
  describe('toExpoPath', () => {
    describe('공개 라우트', () => {
      it('home → /(app)/(tabs)', () => {
        const route: DeepLinkRoute = { name: 'home' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.home);
      });

      it('jobs → /(app)/(tabs) (홈=구인구직)', () => {
        const route: DeepLinkRoute = { name: 'jobs' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.home);
      });

      it('job → /(app)/jobs/[id]', () => {
        const route: DeepLinkRoute = { name: 'job', params: { id: 'job123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(app)/jobs/job123');
      });
    });

    describe('인증 필요 라우트', () => {
      it('notifications → /(app)/notifications', () => {
        const route: DeepLinkRoute = { name: 'notifications' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.notifications);
      });

      it('schedule → /(app)/(tabs)/schedule', () => {
        const route: DeepLinkRoute = { name: 'schedule' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.schedule);
      });

      it('profile → /(app)/(tabs)/profile', () => {
        const route: DeepLinkRoute = { name: 'profile' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.profile);
      });

      it('settings → /(app)/settings', () => {
        const route: DeepLinkRoute = { name: 'settings' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.settings);
      });

      it('support → /(app)/support', () => {
        const route: DeepLinkRoute = { name: 'support' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.support);
      });

      it('notices → /(app)/notices', () => {
        const route: DeepLinkRoute = { name: 'notices' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.notices);
      });
    });

    describe('구인자 라우트', () => {
      it('employer/my-postings → /(app)/(tabs)/employer', () => {
        const route: DeepLinkRoute = { name: 'employer/my-postings' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.employerTab);
      });

      it('employer/posting → /(employer)/my-postings/[id]', () => {
        const route: DeepLinkRoute = { name: 'employer/posting', params: { id: 'posting123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(employer)/my-postings/posting123');
      });

      it('employer/applicants → /(employer)/my-postings/[id]/applicants', () => {
        const route: DeepLinkRoute = { name: 'employer/applicants', params: { jobId: 'job123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(employer)/my-postings/job123/applicants');
      });

      it('employer/settlement → /(employer)/my-postings/[id]/settlements', () => {
        const route: DeepLinkRoute = { name: 'employer/settlement', params: { jobId: 'job123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(employer)/my-postings/job123/settlements');
      });
    });

    describe('관리자 라우트', () => {
      it('admin/dashboard → /(admin)', () => {
        const route: DeepLinkRoute = { name: 'admin/dashboard' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.adminDashboard);
      });

      it('admin/reports → /(admin)/reports', () => {
        const route: DeepLinkRoute = { name: 'admin/reports' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.adminReports);
      });

      it('admin/report → /(admin)/reports/[id]', () => {
        const route: DeepLinkRoute = { name: 'admin/report', params: { id: 'report123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(admin)/reports/report123');
      });

      it('admin/inquiries → /(admin)/inquiries', () => {
        const route: DeepLinkRoute = { name: 'admin/inquiries' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.adminInquiries);
      });

      it('admin/inquiry → /(admin)/inquiries/[id]', () => {
        const route: DeepLinkRoute = { name: 'admin/inquiry', params: { id: 'inquiry123' } };
        expect(RouteMapper.toExpoPath(route)).toBe('/(admin)/inquiries/inquiry123');
      });

      it('admin/tournaments → /(admin)/tournaments', () => {
        const route: DeepLinkRoute = { name: 'admin/tournaments' };
        expect(RouteMapper.toExpoPath(route)).toBe(EXPO_ROUTES.adminTournaments);
      });
    });
  });

  describe('requiresAuth', () => {
    it('공개 라우트는 인증 불필요', () => {
      expect(RouteMapper.requiresAuth('home')).toBe(false);
      expect(RouteMapper.requiresAuth('jobs')).toBe(false);
      expect(RouteMapper.requiresAuth('job')).toBe(false);
    });

    it('인증 필요 라우트는 true 반환', () => {
      expect(RouteMapper.requiresAuth('notifications')).toBe(true);
      expect(RouteMapper.requiresAuth('schedule')).toBe(true);
      expect(RouteMapper.requiresAuth('profile')).toBe(true);
      expect(RouteMapper.requiresAuth('settings')).toBe(true);
    });

    it('구인자 라우트는 인증 필요', () => {
      expect(RouteMapper.requiresAuth('employer/my-postings')).toBe(true);
      expect(RouteMapper.requiresAuth('employer/posting')).toBe(true);
    });

    it('관리자 라우트는 인증 필요', () => {
      expect(RouteMapper.requiresAuth('admin/dashboard')).toBe(true);
      expect(RouteMapper.requiresAuth('admin/reports')).toBe(true);
    });
  });

  describe('getRequiredRole', () => {
    it('일반 라우트는 역할 제한 없음', () => {
      expect(RouteMapper.getRequiredRole('home')).toBeNull();
      expect(RouteMapper.getRequiredRole('notifications')).toBeNull();
      expect(RouteMapper.getRequiredRole('schedule')).toBeNull();
    });

    it('구인자 라우트는 employer 역할 필요', () => {
      expect(RouteMapper.getRequiredRole('employer/my-postings')).toBe('employer');
      expect(RouteMapper.getRequiredRole('employer/posting')).toBe('employer');
      expect(RouteMapper.getRequiredRole('employer/applicants')).toBe('employer');
      expect(RouteMapper.getRequiredRole('employer/settlement')).toBe('employer');
    });

    it('관리자 라우트는 admin 역할 필요', () => {
      expect(RouteMapper.getRequiredRole('admin/dashboard')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/reports')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/report')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/inquiries')).toBe('admin');
      expect(RouteMapper.getRequiredRole('admin/tournaments')).toBe('admin');
    });
  });
});
