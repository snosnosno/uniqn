/**
 * UNIQN Mobile - Mock Factories Tests
 *
 * @description Tests for mock data factories
 */

import {
  createMockUser,
  createMockStaff,
  createMockJobPosting,
  createMockApplication,
  createMockWorkLog,
  createMockNotification,
  createMockUsers,
  createMockStaffList,
  createMockJobPostings,
  createMockAdmin,
  createMockManager,
  createMockDealer,
  createActiveJobPosting,
  createClosedJobPosting,
  createAcceptedApplication,
  createRejectedApplication,
  createCheckedInWorkLog,
  createCompletedWorkLog,
  createUnreadNotification,
  createReadNotification,
  resetCounters,
} from './factories';

describe('Mock Factories', () => {
  beforeEach(() => {
    resetCounters();
  });

  describe('createMockUser', () => {
    it('should create a user with default values', () => {
      const user = createMockUser();

      expect(user.uid).toBe('user-1');
      expect(user.email).toBe('user1@example.com');
      expect(user.displayName).toBe('테스트 유저 1');
      expect(user.emailVerified).toBe(true);
    });

    it('should allow overriding default values', () => {
      const user = createMockUser({
        displayName: '커스텀 이름',
        email: 'custom@example.com',
      });

      expect(user.displayName).toBe('커스텀 이름');
      expect(user.email).toBe('custom@example.com');
    });

    it('should increment IDs for multiple users', () => {
      const user1 = createMockUser();
      const user2 = createMockUser();
      const user3 = createMockUser();

      expect(user1.uid).toBe('user-1');
      expect(user2.uid).toBe('user-2');
      expect(user3.uid).toBe('user-3');
    });
  });

  describe('createMockStaff', () => {
    it('should create staff with default values', () => {
      const staff = createMockStaff();

      expect(staff.id).toBe('staff-1');
      expect(staff.role).toBe('staff');
      expect(staff.name).toBe('스태프 1');
      expect(staff.createdAt).toBeDefined();
    });

    it('should allow overriding role', () => {
      const staff = createMockStaff({ role: 'admin' });

      expect(staff.role).toBe('admin');
    });
  });

  describe('createMockJobPosting', () => {
    it('should create job posting with default values', () => {
      const job = createMockJobPosting();

      expect(job.id).toBe('job-1');
      expect(job.status).toBe('active');
      expect(job.applicantCount).toBe(0);
      expect(job.maxApplicants).toBe(10);
      expect(job.salary).toBeGreaterThan(0);
    });

    it('should allow overriding status', () => {
      const job = createMockJobPosting({ status: 'closed' });

      expect(job.status).toBe('closed');
    });
  });

  describe('createMockApplication', () => {
    it('should create application with default values', () => {
      const application = createMockApplication();

      expect(application.id).toBe('application-1');
      expect(application.status).toBe('pending');
    });

    it('should allow overriding status', () => {
      const application = createMockApplication({ status: 'accepted' });

      expect(application.status).toBe('accepted');
    });
  });

  describe('createMockWorkLog', () => {
    it('should create work log with default values', () => {
      const workLog = createMockWorkLog();

      expect(workLog.id).toBe('worklog-1');
      expect(workLog.status).toBe('scheduled');
      expect(workLog.checkInTime).toBeNull();
    });

    it('should allow setting check-in time', () => {
      const checkInTime = new Date().toISOString();
      const workLog = createMockWorkLog({
        status: 'checked_in',
        checkInTime,
      });

      expect(workLog.status).toBe('checked_in');
      expect(workLog.checkInTime).toBe(checkInTime);
    });
  });

  describe('createMockNotification', () => {
    it('should create notification with default values', () => {
      const notification = createMockNotification();

      expect(notification.id).toBe('notification-1');
      expect(notification.type).toBe('system');
      expect(notification.isRead).toBe(false);
    });

    it('should allow overriding type', () => {
      const notification = createMockNotification({ type: 'application' });

      expect(notification.type).toBe('application');
    });
  });

  describe('Batch factories', () => {
    it('should create multiple users', () => {
      const users = createMockUsers(5);

      expect(users).toHaveLength(5);
      expect(users[0].uid).toBe('user-1');
      expect(users[4].uid).toBe('user-5');
    });

    it('should create multiple staff', () => {
      const staffList = createMockStaffList(3);

      expect(staffList).toHaveLength(3);
    });

    it('should create multiple job postings', () => {
      const jobs = createMockJobPostings(4);

      expect(jobs).toHaveLength(4);
    });
  });

  describe('Specialized factories', () => {
    it('should create admin staff', () => {
      const admin = createMockAdmin();

      expect(admin.role).toBe('admin');
      expect(admin.name).toBe('관리자');
    });

    it('should create manager staff', () => {
      const manager = createMockManager();

      expect(manager.role).toBe('manager');
      expect(manager.name).toBe('매니저');
    });

    it('should create dealer staff', () => {
      const dealer = createMockDealer();

      expect(dealer.role).toBe('dealer');
      expect(dealer.name).toBe('딜러');
    });

    it('should create active job posting', () => {
      const job = createActiveJobPosting();

      expect(job.status).toBe('active');
    });

    it('should create closed job posting', () => {
      const job = createClosedJobPosting();

      expect(job.status).toBe('closed');
    });

    it('should create accepted application', () => {
      const application = createAcceptedApplication();

      expect(application.status).toBe('accepted');
    });

    it('should create rejected application', () => {
      const application = createRejectedApplication();

      expect(application.status).toBe('rejected');
    });

    it('should create checked-in work log', () => {
      const workLog = createCheckedInWorkLog();

      expect(workLog.status).toBe('checked_in');
      expect(workLog.checkInTime).not.toBeNull();
    });

    it('should create completed work log', () => {
      const workLog = createCompletedWorkLog();

      expect(workLog.status).toBe('completed');
      expect(workLog.checkInTime).not.toBeNull();
      expect(workLog.checkOutTime).not.toBeNull();
    });

    it('should create unread notification', () => {
      const notification = createUnreadNotification();

      expect(notification.isRead).toBe(false);
    });

    it('should create read notification', () => {
      const notification = createReadNotification();

      expect(notification.isRead).toBe(true);
    });
  });

  describe('resetCounters', () => {
    it('should reset all counters', () => {
      // Create some mocks
      createMockUser();
      createMockUser();
      createMockStaff();

      // Reset
      resetCounters();

      // Create new mocks - should start from 1 again
      const user = createMockUser();
      const staff = createMockStaff();

      expect(user.uid).toBe('user-1');
      expect(staff.id).toBe('staff-1');
    });
  });
});
