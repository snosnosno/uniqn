/**
 * Mock 데이터 for UnifiedDataContext 테스트
 * Feature: 002-unifieddatacontext-tests
 */

import { Timestamp } from 'firebase/firestore';
import { Staff, WorkLog, AttendanceRecord, Application } from '../../../types/unifiedData';
import { ScheduleEvent } from '../../../types/schedule';
import { toISODateString } from '../../../utils/dateUtils';

// ===========================
// Mock Staff Data
// ===========================
export const mockStaff: Map<string, Staff> = new Map([
  ['staff1', {
    id: 'staff1',
    staffId: 'staff1',
    name: 'John Doe',
    role: 'dealer',
    phone: '010-1234-5678',
    email: 'john@example.com',
    assignedRole: 'dealer',
    assignedTime: '09:00~18:00',
    assignedDate: '2025-11-06',
    userId: 'user1',
    gender: 'male',
    age: 28,
    experience: '2년',
    nationality: 'KR',
    region: 'seoul',
    bankName: '국민은행',
    bankAccount: '123-456-789',
  }],
  ['staff2', {
    id: 'staff2',
    staffId: 'staff2',
    name: 'Jane Smith',
    role: 'manager',
    phone: '010-8765-4321',
    email: 'jane@example.com',
    assignedRole: 'manager',
    assignedTime: '08:00~17:00',
    assignedDate: '2025-11-06',
    userId: 'user2',
    gender: 'female',
    age: 32,
    experience: '5년',
    nationality: 'KR',
    region: 'gyeonggi',
  }],
  ['staff3', {
    id: 'staff3',
    staffId: 'staff3',
    name: 'Bob Johnson',
    role: 'dealer',
    phone: '010-1111-2222',
    assignedRole: 'dealer',
    assignedTime: '10:00~19:00',
    assignedDate: '2025-11-07',
    userId: 'user3',
  }],
]);

// ===========================
// Mock WorkLog Data
// ===========================
export const mockWorkLogs: Map<string, WorkLog> = new Map([
  ['log1', {
    id: 'log1',
    staffId: 'staff1',
    staffName: 'John Doe',
    eventId: 'event1',
    date: '2025-11-06',
    staffInfo: {
      userId: 'user1',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '010-1234-5678',
      userRole: 'staff',
      jobRole: ['dealer'],
      isActive: true,
      bankName: '국민은행',
      accountNumber: '123-456-789',
      gender: 'male',
      age: 28,
      experience: '2년',
      nationality: 'KR',
      region: 'seoul',
    },
    assignmentInfo: {
      role: 'dealer',
      assignedRole: 'dealer',
      assignedTime: '09:00~18:00',
      assignedDate: '2025-11-06',
      postingId: 'posting1',
      type: 'staff',
    },
    status: 'checked_in',
    hoursWorked: 8,
    scheduledStartTime: Timestamp.fromDate(new Date('2025-11-06T09:00:00')),
    scheduledEndTime: Timestamp.fromDate(new Date('2025-11-06T18:00:00')),
  }],
  ['log2', {
    id: 'log2',
    staffId: 'staff2',
    staffName: 'Jane Smith',
    eventId: 'event1',
    date: '2025-11-06',
    staffInfo: {
      userId: 'user2',
      name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '010-8765-4321',
      userRole: 'manager',
      jobRole: ['manager'],
      isActive: true,
    },
    assignmentInfo: {
      role: 'manager',
      assignedRole: 'manager',
      assignedTime: '08:00~17:00',
      assignedDate: '2025-11-06',
      postingId: 'posting1',
      type: 'staff',
    },
    status: 'completed',
    hoursWorked: 9,
  }],
]);

// ===========================
// Mock AttendanceRecord Data
// ===========================
export const mockAttendanceRecords: Map<string, AttendanceRecord> = new Map([
  ['att1', {
    id: 'att1',
    staffId: 'staff1',
    workLogId: 'log1',
    eventId: 'event1',
    status: 'checked_in',
    checkInTime: Timestamp.fromDate(new Date('2025-11-06T09:05:00')),
  }],
  ['att2', {
    id: 'att2',
    staffId: 'staff2',
    workLogId: 'log2',
    eventId: 'event1',
    status: 'checked_out',
    checkInTime: Timestamp.fromDate(new Date('2025-11-06T08:00:00')),
    checkOutTime: Timestamp.fromDate(new Date('2025-11-06T17:00:00')),
  }],
]);

// ===========================
// Mock Application Data
// ===========================
export const mockApplications: Map<string, Application> = new Map([
  ['app1', {
    id: 'app1',
    eventId: 'event1',
    applicantId: 'user4',
    applicantName: 'User 4',
    postId: 'post1',
    postTitle: 'Dealer',
    status: 'applied',
    assignments: [],
  } as any],
  ['app2', {
    id: 'app2',
    eventId: 'event1',
    applicantId: 'user5',
    applicantName: 'User 5',
    postId: 'post1',
    postTitle: 'Manager',
    status: 'confirmed',
    assignments: [],
  } as any],
  ['app3', {
    id: 'app3',
    eventId: 'event2',
    applicantId: 'user6',
    applicantName: 'User 6',
    postId: 'post2',
    postTitle: 'Dealer',
    status: 'cancelled',
    assignments: [],
    notes: 'Insufficient experience',
  } as any],
]);

// ===========================
// Mock ScheduleEvent Data
// ===========================
export const mockScheduleEvents: ScheduleEvent[] = [
  {
    id: 'event1',
    title: '월례 토너먼트',
    date: '2025-11-06',
    startTime: '09:00',
    endTime: '18:00',
    location: '강남 홀덤펍',
    description: '매월 첫째 주 토너먼트',
    type: 'tournament' as any,
    status: 'scheduled' as any,
    createdAt: Timestamp.fromDate(new Date('2025-10-20')),
  } as any,
  {
    id: 'event2',
    title: '딜러 트레이닝',
    date: '2025-11-07',
    startTime: '10:00',
    endTime: '12:00',
    location: '교육장',
    type: 'training' as any,
    status: 'scheduled' as any,
  } as any,
  {
    id: 'event3',
    title: '스태프 미팅',
    date: toISODateString(new Date()) || '', // 오늘 날짜
    startTime: '14:00',
    endTime: '15:00',
    location: '회의실',
    type: 'meeting' as any,
    status: 'in_progress' as any,
  } as any,
];

// ===========================
// 대량 데이터 생성 헬퍼 (성능 테스트용)
// ===========================
export const generateLargeStaffData = (count: number): Map<string, Staff> => {
  const data = new Map<string, Staff>();
  for (let i = 0; i < count; i++) {
    data.set(`staff${i}`, {
      id: `staff${i}`,
      staffId: `staff${i}`,
      name: `Staff ${i}`,
      role: i % 2 === 0 ? 'dealer' : 'manager',
      phone: `010-${String(i).padStart(4, '0')}-0000`,
      userId: `user${i}`,
    });
  }
  return data;
};

export const generateLargeWorkLogData = (count: number): Map<string, WorkLog> => {
  const data = new Map<string, WorkLog>();
  for (let i = 0; i < count; i++) {
    data.set(`log${i}`, {
      id: `log${i}`,
      staffId: `staff${i % 10}`,
      staffName: `Staff ${i % 10}`,
      eventId: `event${i % 3}`,
      date: '2025-11-06',
      staffInfo: {
        userId: `user${i % 10}`,
        name: `Staff ${i % 10}`,
      },
      assignmentInfo: {
        role: 'dealer',
        postingId: 'posting1',
      },
      status: 'completed',
      hoursWorked: 8,
    });
  }
  return data;
};

// ===========================
// Export all mock data
// ===========================
export const fullTestDataSet = {
  staff: mockStaff,
  workLogs: mockWorkLogs,
  attendanceRecords: mockAttendanceRecords,
  applications: mockApplications,
  scheduleEvents: mockScheduleEvents,
};
