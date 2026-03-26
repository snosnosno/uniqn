import { resolveAdminAliasHref, resolveEmployerAliasHref } from '../webRouteAliases';

describe('webRouteAliases', () => {
  describe('resolveAdminAliasHref', () => {
    it('maps the admin root to the admin dashboard', () => {
      expect(resolveAdminAliasHref()).toBe('/(admin)');
      expect(resolveAdminAliasHref([])).toBe('/(admin)');
      expect(resolveAdminAliasHref(['dashboard'])).toBe('/(admin)');
    });

    it('maps admin child routes to internal admin screens', () => {
      expect(resolveAdminAliasHref(['reports'])).toBe('/(admin)/reports');
      expect(resolveAdminAliasHref(['reports', 'report-1'])).toBe('/(admin)/reports/report-1');
      expect(resolveAdminAliasHref(['inquiries', 'inq-1'])).toBe('/(admin)/inquiries/inq-1');
      expect(resolveAdminAliasHref(['announcements', 'create'])).toBe(
        '/(admin)/announcements/create'
      );
      expect(resolveAdminAliasHref(['announcements', 'ann-1', 'edit'])).toBe(
        '/(admin)/announcements/ann-1/edit'
      );
    });
  });

  describe('resolveEmployerAliasHref', () => {
    it('maps the employer root to the employer tab', () => {
      expect(resolveEmployerAliasHref()).toBe('/(app)/(tabs)/employer');
      expect(resolveEmployerAliasHref([])).toBe('/(app)/(tabs)/employer');
    });

    it('maps employer child routes to internal employer screens', () => {
      expect(resolveEmployerAliasHref(['my-postings'])).toBe('/(app)/(tabs)/employer');
      expect(resolveEmployerAliasHref(['my-postings', 'create'])).toBe(
        '/(employer)/my-postings/create'
      );
      expect(resolveEmployerAliasHref(['my-postings', 'job-1'])).toBe(
        '/(employer)/my-postings/job-1'
      );
      expect(resolveEmployerAliasHref(['applicants', 'job-2'])).toBe(
        '/(employer)/my-postings/job-2/applicants'
      );
      expect(resolveEmployerAliasHref(['settlement', 'job-3'])).toBe(
        '/(employer)/my-postings/job-3/settlements'
      );
    });
  });
});
