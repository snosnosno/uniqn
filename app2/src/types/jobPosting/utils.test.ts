/**
 * JobPostingUtils 테스트
 * 특히 v2.1 업데이트된 getConfirmedStaffCount 메서드 테스트
 */

import { JobPostingUtils } from './utils';
import { JobPosting } from './jobPosting';
import { ConfirmedStaff } from './base';
import { Timestamp } from 'firebase/firestore';

// 테스트용 목 데이터
const createMockJobPosting = (confirmedStaff: ConfirmedStaff[] = []): JobPosting => ({
  id: 'test-job-1',
  title: 'Test Job Posting',
  description: 'Test description',
  location: 'Test location',
  dateSpecificRequirements: [],
  createdAt: Timestamp.now(),
  createdBy: 'test-user',
  status: 'open',
  confirmedStaff
});

describe('JobPostingUtils v2.1 - getConfirmedStaffCount', () => {

  test('빈 confirmedStaff 배열일 때 0을 반환해야 함', () => {
    const jobPosting = createMockJobPosting([]);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(0);
  });

  test('기존 데이터(applicationId 없음)는 정상적으로 카운트해야 함', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now()
      },
      {
        userId: 'user2',
        name: 'User 2',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now()
      }
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(2);
  });

  test('같은 applicationId를 가진 스태프들은 1개로만 카운트해야 함 (멀티데이 중복 방지)', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-123',
        applicationType: 'multi'
      },
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-123',  // 같은 applicationId
        applicationType: 'multi'
      }
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(1); // 중복 제거되어 1개만 카운트
  });

  test('다른 applicationId를 가진 스태프들은 각각 카운트해야 함', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-123',
        applicationType: 'single'
      },
      {
        userId: 'user2',
        name: 'User 2',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-456',  // 다른 applicationId
        applicationType: 'multi'
      }
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(2); // 각각 카운트
  });

  test('기존 데이터(applicationId 없음)와 신규 데이터(applicationId 있음)를 함께 카운트해야 함', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      // 기존 데이터 (applicationId 없음)
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now()
      },
      // 신규 데이터 (applicationId 있음)
      {
        userId: 'user2',
        name: 'User 2',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-123',
        applicationType: 'single'
      }
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(2); // 기존 1개 + 신규 1개
  });

  test('다른 날짜, 시간대, 역할은 카운트하지 않아야 함', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      {
        userId: 'user1',
        name: 'User 1',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-23', // 다른 날짜
        confirmedAt: Timestamp.now(),
        applicationId: 'app-123'
      },
      {
        userId: 'user2',
        name: 'User 2',
        role: 'dealer',
        timeSlot: '18:00-02:00', // 다른 시간대
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-456'
      },
      {
        userId: 'user3',
        name: 'User 3',
        role: 'floor', // 다른 역할
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-789'
      }
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );
    expect(count).toBe(0); // 조건에 맞는 스태프 없음
  });

  test('실제 시나리오: 멀티데이 확정 시 단일일에 영향주지 않아야 함', () => {
    const confirmedStaff: ConfirmedStaff[] = [
      // 멀티데이 지원 (09-20~23)의 09-22
      {
        userId: 'user123',
        name: 'Test User',
        role: 'dealer',
        timeSlot: '10:00-18:00',
        date: '2025-09-22',
        confirmedAt: Timestamp.now(),
        applicationId: 'app-multi-123',
        applicationType: 'multi',
        applicationGroupId: 'group-456'
      },
      // 단일일 지원 (09-22만)은 아직 확정 안됨 상태
    ];

    const jobPosting = createMockJobPosting(confirmedStaff);
    const count = JobPostingUtils.getConfirmedStaffCount(
      jobPosting,
      '2025-09-22',
      '10:00-18:00',
      'dealer'
    );

    // 멀티데이 확정이 있어도 1개로만 카운트 (단일일 지원과 구분됨)
    expect(count).toBe(1);
  });
});