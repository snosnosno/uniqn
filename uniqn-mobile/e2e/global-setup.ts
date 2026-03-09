/**
 * Playwright Global Setup
 * - 기존 Expo 서버 프로세스 정리 (emulator 환경변수 보장)
 * - Firebase Emulator 상태 확인
 * - 테스트 계정 시딩
 * - 테스트 데이터 시딩 (공고, 지원서, 근무기록, 알림, 공지사항, 리뷰, 신고)
 * - storageState 생성 (Firebase Auth REST API 기반 + 온보딩 플래그)
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { TEST_ACCOUNTS, createTestProfile, type TestAccount } from './fixtures/test-accounts';
import { createTestJob, createClosedJob, createFullJob } from './factories/job.factory';
import {
  createTestApplication,
  createConfirmedApplication,
  createRejectedApplication,
} from './factories/application.factory';
import {
  createTestWorkLog,
  createCompletedWorkLog,
  createCheckedInWorkLog,
} from './factories/work-log.factory';
import { createUnreadNotifications, createNotification } from './factories/notification.factory';
import { createReviewHistoryItem } from './factories/review.factory';
import { E2E_CONFIG } from './config';

const EMULATOR_PROJECT_ID = E2E_CONFIG.projectId;
const AUTH_EMULATOR_HOST = E2E_CONFIG.emulator.authHost;
const FIRESTORE_EMULATOR_HOST = E2E_CONFIG.emulator.firestoreHost;

// ============================================================================
// 고정 ID (테스트 간 참조용)
// ============================================================================

const JOB_IDS = {
  urgent: 'seed-job-urgent-001',
  regular: 'seed-job-regular-002',
  tournament: 'seed-job-tournament-003',
  closed: 'seed-job-closed-004',
  full: 'seed-job-full-005',
} as const;

const APPLICATION_IDS = {
  applied: 'seed-app-applied-001',
  confirmed: 'seed-app-confirmed-002',
  rejected: 'seed-app-rejected-003',
} as const;

const WORKLOG_IDS = {
  pending: 'seed-worklog-pending-001',
  completed: 'seed-worklog-completed-002',
  checkedIn: 'seed-worklog-checkedin-003',
} as const;

const ANNOUNCEMENT_IDS = {
  published1: 'seed-announcement-pub-001',
  published2: 'seed-announcement-pub-002',
  draft: 'seed-announcement-draft-003',
} as const;

const REVIEW_IDS = {
  positive: 'seed-review-positive-001',
  neutral: 'seed-review-neutral-002',
} as const;

const REPORT_IDS = {
  pending: 'seed-report-pending-001',
  resolved: 'seed-report-resolved-002',
} as const;

// ============================================================================
// 데이터 시딩 함수
// ============================================================================

/**
 * 공고 데이터 시딩
 */
async function seedJobPostings(db: Firestore): Promise<void> {
  const employerUid = TEST_ACCOUNTS.employer.uid;

  const jobs = [
    {
      ...createTestJob({
        title: '긴급 딜러 모집',
        postingType: 'urgent',
        ownerId: employerUid,
        ownerName: TEST_ACCOUNTS.employer.displayName,
        workDate: '2026-04-01',
      }),
      id: JOB_IDS.urgent,
    },
    {
      ...createTestJob({
        title: '정규 딜러/플로어 모집',
        postingType: 'regular',
        ownerId: employerUid,
        ownerName: TEST_ACCOUNTS.employer.displayName,
        workDate: '2026-04-05',
      }),
      id: JOB_IDS.regular,
    },
    {
      ...createTestJob({
        title: '토너먼트 스태프 모집',
        postingType: 'tournament',
        ownerId: employerUid,
        ownerName: TEST_ACCOUNTS.employer.displayName,
        workDate: '2026-04-10',
        roles: [
          { role: 'dealer', count: 4, filled: 1 },
          { role: 'floor', count: 2, filled: 0 },
          { role: 'serving', count: 2, filled: 0 },
        ],
      }),
      id: JOB_IDS.tournament,
    },
    {
      ...createClosedJob({
        title: '마감된 딜러 모집',
        ownerId: employerUid,
        ownerName: TEST_ACCOUNTS.employer.displayName,
        workDate: '2026-03-15',
      }),
      id: JOB_IDS.closed,
    },
    {
      ...createFullJob({
        title: '정원마감 딜러 모집',
        ownerId: employerUid,
        ownerName: TEST_ACCOUNTS.employer.displayName,
        workDate: '2026-04-02',
      }),
      id: JOB_IDS.full,
    },
  ];

  const batch = db.batch();
  for (const job of jobs) {
    const { id, ...data } = job;
    batch.set(db.collection('jobPostings').doc(id), data);
  }
  await batch.commit();
}

/**
 * 지원서 데이터 시딩
 */
async function seedApplications(db: Firestore): Promise<void> {
  const staffUid = TEST_ACCOUNTS.staff.uid;

  const applications = [
    {
      ...createTestApplication({
        jobPostingId: JOB_IDS.urgent,
        applicantId: staffUid,
        applicantName: TEST_ACCOUNTS.staff.displayName,
        status: 'applied',
        role: 'dealer',
      }),
      id: APPLICATION_IDS.applied,
      jobPostingTitle: '긴급 딜러 모집',
    },
    {
      ...createConfirmedApplication({
        jobPostingId: JOB_IDS.regular,
        applicantId: staffUid,
        applicantName: TEST_ACCOUNTS.staff.displayName,
        role: 'dealer',
      }),
      id: APPLICATION_IDS.confirmed,
      jobPostingTitle: '정규 딜러/플로어 모집',
    },
    {
      ...createRejectedApplication({
        jobPostingId: JOB_IDS.tournament,
        applicantId: staffUid,
        applicantName: TEST_ACCOUNTS.staff.displayName,
        role: 'floor',
      }),
      id: APPLICATION_IDS.rejected,
      jobPostingTitle: '토너먼트 스태프 모집',
    },
  ];

  const batch = db.batch();
  for (const app of applications) {
    const { id, ...data } = app;
    batch.set(db.collection('applications').doc(id), data);
  }
  await batch.commit();
}

/**
 * 근무기록 데이터 시딩
 */
async function seedWorkLogs(db: Firestore): Promise<void> {
  const staffUid = TEST_ACCOUNTS.staff.uid;

  const workLogs = [
    {
      ...createTestWorkLog({
        jobPostingId: JOB_IDS.urgent,
        staffId: staffUid,
        staffName: TEST_ACCOUNTS.staff.displayName,
        role: 'dealer',
        payrollStatus: 'pending',
        workDate: '2026-03-20',
      }),
      id: WORKLOG_IDS.pending,
    },
    {
      ...createCompletedWorkLog({
        jobPostingId: JOB_IDS.regular,
        staffId: staffUid,
        staffName: TEST_ACCOUNTS.staff.displayName,
        role: 'dealer',
        workDate: '2026-03-15',
      }),
      id: WORKLOG_IDS.completed,
    },
    {
      ...createCheckedInWorkLog({
        jobPostingId: JOB_IDS.tournament,
        staffId: staffUid,
        staffName: TEST_ACCOUNTS.staff.displayName,
        role: 'floor',
        workDate: '2026-03-25',
      }),
      id: WORKLOG_IDS.checkedIn,
    },
  ];

  const batch = db.batch();
  for (const log of workLogs) {
    const { id, ...data } = log;
    batch.set(db.collection('workLogs').doc(id), data);
  }
  await batch.commit();
}

/**
 * 알림 데이터 시딩 (서브컬렉션: users/{uid}/notifications)
 */
async function seedNotifications(db: Firestore): Promise<void> {
  const staffUid = TEST_ACCOUNTS.staff.uid;
  const employerUid = TEST_ACCOUNTS.employer.uid;

  // Staff: 읽지 않은 알림 3개
  const staffNotifications = createUnreadNotifications(3);
  const staffBatch = db.batch();
  for (const notification of staffNotifications) {
    const { id, ...data } = notification;
    staffBatch.set(db.collection('users').doc(staffUid).collection('notifications').doc(id), data);
  }
  await staffBatch.commit();

  // Employer: 알림 2개 (1개 읽음, 1개 안 읽음)
  const employerNotifications = [
    createNotification({
      id: 'employer-notif-001',
      type: 'application_received',
      title: '새 지원서 도착',
      body: '테스트스태프님이 긴급 딜러 모집에 지원했습니다',
      isRead: false,
      data: { jobPostingId: JOB_IDS.urgent, applicationId: APPLICATION_IDS.applied },
    }),
    createNotification({
      id: 'employer-notif-002',
      type: 'review_request',
      title: '리뷰 작성 요청',
      body: '근무가 완료되었습니다. 스태프 리뷰를 작성해주세요',
      isRead: true,
      data: { workLogId: WORKLOG_IDS.completed },
    }),
  ];

  const employerBatch = db.batch();
  for (const notification of employerNotifications) {
    const { id, ...data } = notification;
    employerBatch.set(
      db.collection('users').doc(employerUid).collection('notifications').doc(id),
      data
    );
  }
  await employerBatch.commit();
}

/**
 * 공지사항 데이터 시딩
 */
async function seedAnnouncements(db: Firestore): Promise<void> {
  const adminUid = TEST_ACCOUNTS.admin.uid;

  const announcements = [
    {
      id: ANNOUNCEMENT_IDS.published1,
      title: '서비스 이용 안내',
      content: '유니큐엔 서비스 이용에 감사드립니다. 주요 기능을 안내합니다.',
      category: 'notice' as const,
      status: 'published' as const,
      priority: 1 as const,
      isPinned: true,
      targetAudience: { type: 'all' as const },
      authorId: adminUid,
      authorName: TEST_ACCOUNTS.admin.displayName,
      viewCount: 42,
      publishedAt: new Date('2026-03-01T09:00:00Z'),
      createdAt: new Date('2026-03-01T09:00:00Z'),
      updatedAt: new Date('2026-03-01T09:00:00Z'),
    },
    {
      id: ANNOUNCEMENT_IDS.published2,
      title: '앱 업데이트 v2.0 안내',
      content: '새로운 기능이 추가되었습니다. 업데이트해주세요.',
      category: 'update' as const,
      status: 'published' as const,
      priority: 0 as const,
      isPinned: false,
      targetAudience: { type: 'all' as const },
      authorId: adminUid,
      authorName: TEST_ACCOUNTS.admin.displayName,
      viewCount: 15,
      publishedAt: new Date('2026-03-05T10:00:00Z'),
      createdAt: new Date('2026-03-05T10:00:00Z'),
      updatedAt: new Date('2026-03-05T10:00:00Z'),
    },
    {
      id: ANNOUNCEMENT_IDS.draft,
      title: '점검 안내 (초안)',
      content: '서버 점검이 예정되어 있습니다.',
      category: 'maintenance' as const,
      status: 'draft' as const,
      priority: 2 as const,
      isPinned: false,
      targetAudience: { type: 'roles' as const, roles: ['admin', 'employer'] },
      authorId: adminUid,
      authorName: TEST_ACCOUNTS.admin.displayName,
      viewCount: 0,
      createdAt: new Date('2026-03-07T14:00:00Z'),
      updatedAt: new Date('2026-03-07T14:00:00Z'),
    },
  ];

  const batch = db.batch();
  for (const announcement of announcements) {
    const { id, ...data } = announcement;
    batch.set(db.collection('announcements').doc(id), data);
  }
  await batch.commit();
}

/**
 * 리뷰 데이터 시딩
 */
async function seedReviews(db: Firestore): Promise<void> {
  const reviews = [
    {
      ...createReviewHistoryItem({
        sentiment: 'positive',
        reviewerName: TEST_ACCOUNTS.employer.displayName,
        reviewerType: 'employer',
        tags: ['성실함', '시간 엄수', '친절함'],
        comment: '매우 성실하게 근무해주셨습니다.',
        createdAt: '2026-03-15T10:00:00Z',
      }),
      id: REVIEW_IDS.positive,
      reviewerId: TEST_ACCOUNTS.employer.uid,
      revieweeId: TEST_ACCOUNTS.staff.uid,
      revieweeName: TEST_ACCOUNTS.staff.displayName,
      jobPostingId: JOB_IDS.regular,
      jobPostingTitle: '정규 딜러/플로어 모집',
      workLogId: WORKLOG_IDS.completed,
      workDate: '2026-03-15',
    },
    {
      ...createReviewHistoryItem({
        sentiment: 'neutral',
        reviewerName: TEST_ACCOUNTS.employer.displayName,
        reviewerType: 'employer',
        tags: ['보통'],
        comment: '',
        createdAt: '2026-03-20T11:00:00Z',
      }),
      id: REVIEW_IDS.neutral,
      reviewerId: TEST_ACCOUNTS.employer.uid,
      revieweeId: TEST_ACCOUNTS.staff.uid,
      revieweeName: TEST_ACCOUNTS.staff.displayName,
      jobPostingId: JOB_IDS.urgent,
      jobPostingTitle: '긴급 딜러 모집',
      workLogId: WORKLOG_IDS.pending,
      workDate: '2026-03-20',
    },
  ];

  const batch = db.batch();
  for (const review of reviews) {
    const { id, ...data } = review;
    batch.set(db.collection('reviews').doc(id), data);
  }
  await batch.commit();
}

/**
 * 신고 데이터 시딩
 */
async function seedReports(db: Firestore): Promise<void> {
  const reports = [
    {
      id: REPORT_IDS.pending,
      type: 'tardiness' as const,
      reporterType: 'employer' as const,
      reporterId: TEST_ACCOUNTS.employer.uid,
      reporterName: TEST_ACCOUNTS.employer.displayName,
      targetId: TEST_ACCOUNTS.staff.uid,
      targetName: TEST_ACCOUNTS.staff.displayName,
      jobPostingId: JOB_IDS.urgent,
      jobPostingTitle: '긴급 딜러 모집',
      workLogId: WORKLOG_IDS.pending,
      workDate: '2026-03-20',
      description: '약속된 시간보다 30분 지각하여 출근하였습니다.',
      status: 'pending' as const,
      severity: 'low' as const,
      createdAt: new Date('2026-03-20T19:00:00Z'),
      updatedAt: new Date('2026-03-20T19:00:00Z'),
    },
    {
      id: REPORT_IDS.resolved,
      type: 'false_posting' as const,
      reporterType: 'employee' as const,
      reporterId: TEST_ACCOUNTS.staff.uid,
      reporterName: TEST_ACCOUNTS.staff.displayName,
      targetId: TEST_ACCOUNTS.employer.uid,
      targetName: TEST_ACCOUNTS.employer.displayName,
      jobPostingId: JOB_IDS.closed,
      jobPostingTitle: '마감된 딜러 모집',
      description: '공고 내용과 실제 근무 조건이 달랐습니다.',
      status: 'resolved' as const,
      severity: 'high' as const,
      reviewerId: TEST_ACCOUNTS.admin.uid,
      reviewerNotes: '확인 후 해당 구인자에게 경고 조치 완료',
      reviewedAt: new Date('2026-03-18T14:00:00Z'),
      createdAt: new Date('2026-03-16T08:00:00Z'),
      updatedAt: new Date('2026-03-18T14:00:00Z'),
    },
  ];

  const batch = db.batch();
  for (const report of reports) {
    const { id, ...data } = report;
    batch.set(db.collection('reports').doc(id), data);
  }
  await batch.commit();
}

/**
 * 알림 카운터 문서 시딩 (users/{uid}/counters/notifications)
 * 이 문서가 없으면 앱 초기화 시 initializeUnreadCounter Cloud Function을 호출하여
 * Functions 에뮬레이터에서 응답하지 않아 무한 대기 발생
 */
async function seedNotificationCounters(db: Firestore): Promise<void> {
  const batch = db.batch();
  for (const [, account] of Object.entries(TEST_ACCOUNTS)) {
    batch.set(db.collection('users').doc(account.uid).collection('counters').doc('notifications'), {
      unreadCount: 0,
    });
  }
  await batch.commit();
}

/**
 * 모든 테스트 데이터 시딩
 */
async function seedTestData(db: Firestore): Promise<void> {
  await seedJobPostings(db);
  await seedApplications(db);
  await seedWorkLogs(db);
  await seedNotifications(db);
  await seedNotificationCounters(db);
  await seedAnnouncements(db);
  await seedReviews(db);
  await seedReports(db);
}

// ============================================================================
// 포트 정리 (기존 Expo 서버 종료)
// ============================================================================

/**
 * 지정 포트를 점유하는 프로세스 종료
 * reuseExistingServer가 기존 서버를 재사용하면
 * EXPO_PUBLIC_USE_EMULATOR 환경변수가 누락될 수 있으므로
 * global-setup에서 미리 정리하여 Playwright가 새 서버를 시작하게 한다.
 * NOTE: killPort는 reuseExistingServer 도입으로 더 이상 사용하지 않아 제거됨.
 */

// ============================================================================
// 온보딩 UID 해싱 (앱과 동일한 알고리즘)
// ============================================================================

/**
 * src/utils/hash.ts의 hashUID와 동일한 해싱 함수
 * localStorage에 온보딩/튜토리얼 완료 플래그를 저장할 때 사용
 *
 * 이중 해시(djb2a 변형)로 ~64비트 공간 확보하여 충돌 저항성 강화
 *
 * SYNC: src/utils/hash.ts hashUID()와 동일 알고리즘 유지 필수
 * 어느 한쪽을 변경하면 다른 쪽도 반드시 동기화할 것
 */
function hashUID(uid: string): string {
  if (!uid) {
    throw new Error('hashUID: uid must be non-empty');
  }

  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < uid.length; i++) {
    const char = uid.charCodeAt(i);
    hash1 = ((hash1 << 5) + hash1) ^ char;
    hash2 = ((hash2 << 5) + hash2) ^ char;
  }

  return `${Math.abs(hash1).toString(36)}_${Math.abs(hash2).toString(36)}`;
}

// ============================================================================
// .env.local 파서
// ============================================================================

function readFirebaseApiKey(): string {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local 파일이 없습니다. .env.example을 참고하여 생성하세요.');
  }
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('EXPO_PUBLIC_FIREBASE_API_KEY=')) {
      return trimmed.split('=').slice(1).join('=');
    }
  }
  throw new Error('.env.local에 EXPO_PUBLIC_FIREBASE_API_KEY가 없습니다.');
}

// ============================================================================
// storageState 생성 (Firebase Auth REST API)
// ============================================================================

interface SignInResponse {
  idToken: string;
  email: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  registered: boolean;
}

/**
 * Firebase Auth Emulator REST API로 로그인하고 storageState JSON 생성
 *
 * UI를 통한 로그인 대신 REST API를 직접 호출하여
 * 앱 초기화(useAppInitialize)에 의존하지 않는다.
 */
async function generateStorageStates(apiKey: string): Promise<void> {
  const isCI = !!process.env.CI;
  const baseURL = isCI ? 'http://localhost:3000' : 'http://localhost:8081';
  const storageStatesDir = path.join(__dirname, 'fixtures', 'storage-states');

  fs.mkdirSync(storageStatesDir, { recursive: true });

  for (const [roleName, account] of Object.entries(TEST_ACCOUNTS)) {
    // 1. Firebase Auth Emulator REST API로 로그인
    const signInUrl = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

    const response = await fetch(signInUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        returnSecureToken: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firebase Auth 로그인 실패 (${roleName}): ${response.status} ${errorText}`);
    }

    const signInData = (await response.json()) as SignInResponse;

    // 2. Firebase Auth localStorage 엔트리 구성
    const firebaseAuthKey = `firebase:authUser:${apiKey}:[DEFAULT]`;
    const firebaseAuthValue = buildFirebaseAuthEntry(signInData, account, apiKey);

    // 3. 온보딩/튜토리얼 완료 플래그 생성 (모달 방지)
    const userHash = hashUID(account.uid);
    const onboardingKey = `onboarding:notification_permission:${userHash}`;
    const onboardingVersionKey = `onboarding:version:${userHash}`;

    // 튜토리얼 완료 플래그
    // SYNC: src/constants/tutorials/index.ts TUTORIAL_KEY_MAP (키) + TUTORIAL_VERSIONS (버전)
    // 키 또는 버전 변경 시 여기도 반드시 업데이트할 것
    const tutorialTypes = ['app_intro', 'posting_guide', 'settlement', 'qr_checkin'] as const;
    // 현재 모든 튜토리얼 버전은 1 — TUTORIAL_VERSIONS 변경 시 동기화 필요
    const tutorialEntries = tutorialTypes.flatMap((type) => [
      { name: `tutorial:${type}:${userHash}`, value: 'true' },
      { name: `tutorial:version:${type}:${userHash}`, value: '1' },
    ]);

    // 4. Zustand auth-storage 사전 설정 (hydration 가속)
    const authStorageValue = {
      state: {
        status: 'authenticated',
        user: {
          uid: signInData.localId,
          email: signInData.email,
          displayName: account.displayName,
          photoURL: null,
        },
        profile: {
          uid: account.uid,
          email: account.email,
          name: account.displayName,
          nickname: account.displayName,
          displayName: account.displayName,
          role: account.role,
          status: 'active',
          isActive: true,
          phoneNumber: account.phoneNumber,
          phoneVerified: true,
          profileCompleted: true,
          emailVerified: true,
        },
        lastActivity: new Date().toISOString(),
      },
      version: 0,
    };

    // 5. 자동 로그인 플래그 설정 (secureStorage 형식: uniqn_secure_ + key)
    const autoLoginStorageValue = JSON.stringify({
      value: true,
      storedAt: Date.now(),
    });

    // 6. storageState JSON 생성
    const storageState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: firebaseAuthKey, value: JSON.stringify(firebaseAuthValue) },
            { name: 'auth-storage', value: JSON.stringify(authStorageValue) },
            { name: onboardingKey, value: 'true' },
            { name: onboardingVersionKey, value: '1' },
            ...tutorialEntries,
            { name: 'uniqn_secure_autoLoginEnabled', value: autoLoginStorageValue },
          ],
        },
      ],
    };

    const filePath = path.join(storageStatesDir, `${roleName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(storageState, null, 2));
  }
}

function buildFirebaseAuthEntry(signInData: SignInResponse, account: TestAccount, apiKey: string) {
  return {
    uid: signInData.localId,
    email: signInData.email,
    emailVerified: true,
    displayName: account.displayName,
    isAnonymous: false,
    providerData: [
      {
        providerId: 'password',
        uid: signInData.email,
        displayName: account.displayName,
        email: signInData.email,
        phoneNumber: account.phoneNumber,
        photoURL: null,
      },
    ],
    stsTokenManager: {
      refreshToken: signInData.refreshToken,
      accessToken: signInData.idToken,
      expirationTime: Date.now() + parseInt(signInData.expiresIn, 10) * 1000,
    },
    createdAt: String(Date.now()),
    lastLoginAt: String(Date.now()),
    apiKey,
    appName: '[DEFAULT]',
  };
}

// ============================================================================
// Global Setup
// ============================================================================

async function globalSetup() {
  // NOTE: killPort(8081) 제거 — .env.local에 EXPO_PUBLIC_USE_EMULATOR=true 설정으로
  // Expo 서버는 항상 에뮬레이터 모드로 시작됨. 포트 킬하면 reuseExistingServer가 재사용할
  // 서버를 죽여서 ERR_CONNECTION_REFUSED 발생.

  // 1. Firebase Admin SDK 초기화 (에뮬레이터 연결)
  process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_EMULATOR_HOST;

  const app = initializeApp({
    projectId: EMULATOR_PROJECT_ID,
  });

  const adminAuth = getAuth(app);
  const adminDb = getFirestore(app);
  adminDb.settings({ ignoreUndefinedProperties: true });

  // 에뮬레이터 연결 확인
  try {
    await adminAuth.listUsers(1);
  } catch (error) {
    throw new Error(
      `Firebase Emulator에 연결할 수 없습니다.\n` +
        `먼저 에뮬레이터를 시작하세요: firebase emulators:start\n` +
        `원본 에러: ${error}`
    );
  }

  // 테스트 계정 시딩
  for (const [_roleName, account] of Object.entries(TEST_ACCOUNTS)) {
    try {
      await adminAuth.getUser(account.uid);
    } catch {
      await adminAuth.createUser({
        uid: account.uid,
        email: account.email,
        password: account.password,
        displayName: account.displayName,
        phoneNumber: account.phoneNumber,
        emailVerified: true,
      });
    }

    // Custom Claims 설정 (역할)
    await adminAuth.setCustomUserClaims(account.uid, { role: account.role });

    // Firestore 프로필 시딩
    const profile = createTestProfile(account);
    await adminDb.collection('users').doc(account.uid).set(profile, { merge: true });
  }

  // 테스트 데이터 시딩
  await seedTestData(adminDb);

  // storageState 생성 (Firebase REST API 기반)
  const apiKey = readFirebaseApiKey();
  await generateStorageStates(apiKey);

  // Admin SDK 정리
  await deleteApp(app);
}

export default globalSetup;
