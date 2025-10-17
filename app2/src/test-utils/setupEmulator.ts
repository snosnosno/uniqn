/**
 * Firebase Emulator 테스트 데이터 설정
 * 멀티유저 테스트를 위한 초기 데이터 생성
 */

import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  query
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { logger } from '../utils/logger';

export interface TestUser {
  uid: string;
  email: string;
  password: string;
  role: 'admin' | 'staff' | 'applicant' | 'user';
  name: string;
  phone?: string;
}

export interface TestJobPosting {
  id: string;
  title: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  roles: string[];
  maxStaff: number;
  hourlyWage: number;
  description: string;
  status: 'active' | 'closed';
  createdAt: Timestamp;
  creatorId: string;
}

// 테스트 사용자 데이터
export const TEST_USERS: TestUser[] = [
  {
    uid: 'admin-test-1',
    email: 'admin@test.com',
    password: 'testpass123',
    role: 'admin',
    name: '관리자',
    phone: '010-1234-5678'
  },
  ...Array.from({ length: 10 }, (_, i) => ({
    uid: `staff-test-${i + 1}`,
    email: `staff${i + 1}@test.com`,
    password: 'testpass123',
    role: 'staff' as const,
    name: `스태프${i + 1}`,
    phone: `010-1111-${String(i + 1).padStart(4, '0')}`
  })),
  ...Array.from({ length: 5 }, (_, i) => ({
    uid: `applicant-test-${i + 1}`,
    email: `applicant${i + 1}@test.com`,
    password: 'testpass123',
    role: 'applicant' as const,
    name: `지원자${i + 1}`,
    phone: `010-2222-${String(i + 1).padStart(4, '0')}`
  }))
];

// 테스트 구인공고 데이터
export const TEST_JOB_POSTINGS: Omit<TestJobPosting, 'id' | 'createdAt'>[] = [
  {
    title: '강남 홀덤 토너먼트 딜러 모집',
    location: 'seoul',
    date: '2025-01-20',
    startTime: '18:00',
    endTime: '23:00',
    roles: ['dealer', 'floorman'],
    maxStaff: 8,
    hourlyWage: 30000,
    description: '강남 지역 홀덤 토너먼트 운영 스태프를 모집합니다.',
    status: 'active',
    creatorId: 'admin-test-1'
  },
  {
    title: '홍대 포커 대회 스태프 모집',
    location: 'seoul',
    date: '2025-01-21',
    startTime: '19:00',
    endTime: '02:00',
    roles: ['dealer', 'supervisor'],
    maxStaff: 6,
    hourlyWage: 28000,
    description: '홍대 지역 포커 대회 운영진을 모집합니다.',
    status: 'active',
    creatorId: 'admin-test-1'
  },
  {
    title: '부산 홀덤 클럽 정규 스태프',
    location: 'busan',
    date: '2025-01-22',
    startTime: '20:00',
    endTime: '03:00',
    roles: ['dealer'],
    maxStaff: 4,
    hourlyWage: 25000,
    description: '부산 지역 홀덤 클럽 정규 스태프 모집',
    status: 'active',
    creatorId: 'admin-test-1'
  },
  {
    title: '대구 포커 토너먼트 운영진',
    location: 'daegu',
    date: '2025-01-23',
    startTime: '17:00',
    endTime: '22:00',
    roles: ['dealer', 'floorman', 'supervisor'],
    maxStaff: 10,
    hourlyWage: 32000,
    description: '대구 지역 대형 포커 토너먼트 운영진 모집',
    status: 'active',
    creatorId: 'admin-test-1'
  },
  {
    title: '인천 홀덤 클럽 주말 스태프',
    location: 'incheon',
    date: '2025-01-25',
    startTime: '15:00',
    endTime: '21:00',
    roles: ['dealer'],
    maxStaff: 5,
    hourlyWage: 27000,
    description: '인천 지역 홀덤 클럽 주말 스태프 모집',
    status: 'active',
    creatorId: 'admin-test-1'
  }
];

/**
 * Firebase Emulator 연결 확인
 */
export const checkEmulatorConnection = async (): Promise<boolean> => {
  try {
    // Firestore 연결 테스트
    const _testDoc = doc(db, 'test', 'connection'); // 연결 테스트용
    await getDocs(query(collection(db, 'test')));

    logger.info('Emulator 연결 성공', { component: 'TestSetup' });
    return true;
  } catch (error) {
    logger.error('Emulator 연결 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    return false;
  }
};

/**
 * 테스트 데이터 초기화 (기존 데이터 삭제)
 */
export const clearTestData = async (): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 컬렉션 목록
    const collections = ['users', 'jobPostings', 'applications', 'workLogs', 'attendanceRecords'];

    for (const collectionName of collections) {
      const snapshot = await getDocs(collection(db, collectionName));
      snapshot.docs.forEach(document => {
        batch.delete(document.ref);
      });
    }

    await batch.commit();
    logger.info('테스트 데이터 초기화 완료', { component: 'TestSetup' });
  } catch (error) {
    logger.error('테스트 데이터 초기화 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    throw error;
  }
};

/**
 * 테스트 사용자 계정 생성
 */
export const createTestUsers = async (): Promise<void> => {
  try {
    logger.info('테스트 사용자 생성 시작', { component: 'TestSetup' });

    for (const user of TEST_USERS) {
      try {
        // Firebase Auth에 사용자 생성
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          user.email,
          user.password
        );

        // Firestore에 사용자 프로필 생성
        const userDoc = doc(db, 'users', userCredential.user.uid);
        const batch = writeBatch(db);

        batch.set(userDoc, {
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          experience: user.role === 'staff' ? '2년' : '1년 미만',
          region: 'seoul',
          createdAt: Timestamp.now(),
          rating: user.role === 'staff' ? 4.5 : undefined,
          ratingCount: user.role === 'staff' ? 10 : undefined
        });

        await batch.commit();

        // 로그아웃
        await signOut(auth);


      } catch (error: any) {
        if (error?.code === 'auth/email-already-in-use') {

        } else {
          logger.error(`사용자 생성 실패: ${user.email}`, error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
        }
      }
    }

    logger.info('테스트 사용자 생성 완료', { component: 'TestSetup' });
  } catch (error) {
    logger.error('테스트 사용자 생성 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    throw error;
  }
};

/**
 * 테스트 구인공고 생성
 */
export const createTestJobPostings = async (): Promise<string[]> => {
  try {
    logger.info('테스트 구인공고 생성 시작', { component: 'TestSetup' });

    const batch = writeBatch(db);
    const eventIds: string[] = [];

    for (let i = 0; i < TEST_JOB_POSTINGS.length; i++) {
      const jobData = TEST_JOB_POSTINGS[i];
      const docRef = doc(collection(db, 'jobPostings'));

      batch.set(docRef, {
        ...jobData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        eventId: docRef.id
      });

      eventIds.push(docRef.id);
    }

    await batch.commit();

    logger.info(`테스트 구인공고 ${eventIds.length}개 생성 완료`, { component: 'TestSetup' });
    return eventIds;
  } catch (error) {
    logger.error('테스트 구인공고 생성 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    throw error;
  }
};

/**
 * 테스트 지원서 생성
 */
export const createTestApplications = async (eventIds: string[]): Promise<void> => {
  try {
    logger.info('테스트 지원서 생성 시작', { component: 'TestSetup' });

    const batch = writeBatch(db);
    const applicantUsers = TEST_USERS.filter(user => user.role === 'applicant');

    // 각 구인공고에 무작위로 지원자들이 지원
    for (const eventId of eventIds) {
      const numApplicants = Math.floor(Math.random() * applicantUsers.length) + 1;
      const selectedApplicants = applicantUsers
        .sort(() => 0.5 - Math.random())
        .slice(0, numApplicants);

      for (const applicant of selectedApplicants) {
        const applicationRef = doc(collection(db, 'applications'));

        batch.set(applicationRef, {
          eventId: eventId,
          applicantId: applicant.uid,
          applicantEmail: applicant.email,
          applicantName: applicant.name,
          status: 'pending',
          appliedAt: Timestamp.now(),
          coverLetter: `안녕하세요. ${applicant.name}입니다. 성실히 근무하겠습니다.`
        });
      }
    }

    await batch.commit();

    logger.info('테스트 지원서 생성 완료', { component: 'TestSetup' });
  } catch (error) {
    logger.error('테스트 지원서 생성 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    throw error;
  }
};

/**
 * 테스트 출석 기록 생성
 */
export const createTestAttendanceRecords = async (): Promise<void> => {
  try {
    logger.info('테스트 출석 기록 생성 시작', { component: 'TestSetup' });

    const batch = writeBatch(db);
    const staffUsers = TEST_USERS.filter(user => user.role === 'staff');

    // 최근 7일간의 출석 기록 생성
    for (let day = 0; day < 7; day++) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const dateString = date.toISOString().split('T')[0];

      for (const staff of staffUsers.slice(0, 5)) { // 5명의 스태프만
        const attendanceRef = doc(collection(db, 'attendanceRecords'));

        const statuses = ['present', 'absent', 'late'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        batch.set(attendanceRef, {
          staffId: staff.uid,
          date: dateString,
          status,
          checkInTime: status !== 'absent' ? '18:00' : null,
          checkOutTime: status !== 'absent' ? '23:00' : null,
          notes: status === 'late' ? '교통 지연' : '',
          createdAt: Timestamp.now()
        });
      }
    }

    await batch.commit();

    logger.info('테스트 출석 기록 생성 완료', { component: 'TestSetup' });
  } catch (error) {
    logger.error('테스트 출석 기록 생성 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    throw error;
  }
};

/**
 * 전체 테스트 데이터 설정
 */
export const setupTestData = async (): Promise<{
  success: boolean;
  eventIds: string[];
  userCount: number;
}> => {
  try {
    logger.info('테스트 데이터 설정 시작', { component: 'TestSetup' });

    // 1. Emulator 연결 확인
    const isConnected = await checkEmulatorConnection();
    if (!isConnected) {
      throw new Error('Firebase Emulator 연결 실패');
    }

    // 2. 기존 데이터 초기화
    await clearTestData();

    // 3. 테스트 사용자 생성
    await createTestUsers();

    // 4. 테스트 구인공고 생성
    const eventIds = await createTestJobPostings();

    // 5. 테스트 지원서 생성
    await createTestApplications(eventIds);

    // 6. 테스트 출석 기록 생성
    await createTestAttendanceRecords();

    logger.info('테스트 데이터 설정 완료', {
      component: 'TestSetup',
      userCount: TEST_USERS.length,
      jobPostingCount: eventIds.length
    });

    return {
      success: true,
      eventIds,
      userCount: TEST_USERS.length
    };
  } catch (error) {
    logger.error('테스트 데이터 설정 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    return {
      success: false,
      eventIds: [],
      userCount: 0
    };
  }
};

/**
 * 테스트 사용자로 로그인
 */
export const loginAsTestUser = async (userType: 'admin' | 'staff' | 'applicant', index = 1): Promise<string | null> => {
  try {
    const email = userType === 'admin'
      ? 'admin@test.com'
      : `${userType}${index}@test.com`;

    const userCredential = await signInWithEmailAndPassword(auth, email, 'testpass123');

    logger.info(`테스트 사용자 로그인: ${email}`, { component: 'TestSetup' });
    return userCredential.user.uid;
  } catch (error) {
    logger.error(`테스트 사용자 로그인 실패: ${userType}${index}`, error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
    return null;
  }
};

/**
 * 테스트 완료 후 정리
 */
export const cleanupTestData = async (): Promise<void> => {
  try {
    await signOut(auth);
    await clearTestData();
    logger.info('테스트 데이터 정리 완료', { component: 'TestSetup' });
  } catch (error) {
    logger.error('테스트 데이터 정리 실패', error instanceof Error ? error : new Error(String(error)), { component: 'TestSetup' });
  }
};