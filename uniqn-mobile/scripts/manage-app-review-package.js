const fs = require('fs');
const path = require('path');
const { ensureFreshFirebaseAccessToken } = require('./firebase-tools-auth');

const projectRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(projectRoot, '..');
const envFilePath = path.join(projectRoot, '.env.local');
const outputPath = path.join(projectRoot, 'output', 'app-review', 'review-package.json');
const KST_OFFSET = '+09:00';

const REVIEW_DOC_IDS = {
  jobs: {
    freshApply: 'app-review-job-fresh-apply',
    applicantQueue: 'app-review-job-applicant-queue',
    confirmedStaff: 'app-review-job-confirmed-staff',
    settlement: 'app-review-job-settlement',
    tournamentPending: 'app-review-job-tournament-pending',
  },
  workLogs: {
    settlementPending: 'app-review-worklog-settlement-pending',
  },
  announcements: {
    published: 'app-review-announcement-published',
    draft: 'app-review-announcement-draft',
  },
  reports: {
    pending: 'app-review-report-pending',
  },
  inquiries: {
    open: 'app-review-inquiry-open',
    answered: 'app-review-inquiry-answered',
  },
};

function readEnvFile(filePath) {
  const entries = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries[key] = value;
  }

  return entries;
}

function requireValue(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ensureConfig() {
  const env = readEnvFile(envFilePath);
  return {
    projectId: requireValue('EXPO_PUBLIC_FIREBASE_PROJECT_ID', env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    apiKey: requireValue('EXPO_PUBLIC_FIREBASE_API_KEY', env.EXPO_PUBLIC_FIREBASE_API_KEY),
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function signUpWithEmailPassword(apiKey, email, password) {
  return requestJson(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
}

async function signInWithEmailPassword(apiKey, email, password) {
  return requestJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
}

async function lookupUserByEmail(projectId, accessToken, email) {
  const payload = await requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: [email] }),
    }
  );

  return payload.users?.[0] ?? null;
}

async function updateAuthUser(projectId, accessToken, uid, updates) {
  return requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid, ...updates }),
    }
  );
}

async function deleteAuthUser(projectId, accessToken, uid) {
  return requestJson(
    `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ localId: uid }),
    }
  );
}

function isAuthErrorPayload(error, expectedMessage) {
  return error?.payload?.error?.message === expectedMessage;
}

async function ensureEmailPasswordAccount({
  apiKey,
  projectId,
  accessToken,
  email,
  password,
  role,
}) {
  try {
    const created = await signUpWithEmailPassword(apiKey, email, password);
    await updateAuthUser(projectId, accessToken, created.localId, {
      emailVerified: true,
      password,
      disableUser: false,
      customAttributes: JSON.stringify({ role }),
    });
    return { uid: created.localId, email: created.email };
  } catch (error) {
    if (!isAuthErrorPayload(error, 'EMAIL_EXISTS')) {
      throw error;
    }

    try {
      const signedIn = await signInWithEmailPassword(apiKey, email, password);
      await updateAuthUser(projectId, accessToken, signedIn.localId, {
        emailVerified: true,
        password,
        disableUser: false,
        customAttributes: JSON.stringify({ role }),
      });
      return { uid: signedIn.localId, email: signedIn.email };
    } catch (signInError) {
      if (!isAuthErrorPayload(signInError, 'INVALID_PASSWORD')) {
        throw signInError;
      }

      const user = await lookupUserByEmail(projectId, accessToken, email);
      if (!user?.localId) {
        throw signInError;
      }

      await updateAuthUser(projectId, accessToken, user.localId, {
        emailVerified: true,
        password,
        disableUser: false,
        customAttributes: JSON.stringify({ role }),
      });
      const signedInAfterReset = await signInWithEmailPassword(apiKey, email, password);
      return { uid: signedInAfterReset.localId, email: signedInAfterReset.email };
    }
  }
}

function firestoreValue(value) {
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (value === null) {
    return { nullValue: null };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => firestoreValue(item)) } };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, innerValue]) => [key, firestoreValue(innerValue)])
        ),
      },
    };
  }
  throw new Error(`Unsupported Firestore value: ${String(value)}`);
}

function buildUpdateMask(data) {
  const keys = Object.keys(data);
  if (keys.length === 0) {
    return '';
  }
  return `?${keys.map((key) => `updateMask.fieldPaths=${encodeURIComponent(key)}`).join('&')}`;
}

async function upsertDocument(projectId, accessToken, documentPath, data) {
  return requestJson(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}${buildUpdateMask(
      data
    )}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])
        ),
      }),
    }
  );
}

async function deleteDocument(projectId, accessToken, documentPath) {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Firestore document ${documentPath}: ${response.status}`);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toKstDateTime(dateString, time = '18:00') {
  return `${dateString}T${time}:00${KST_OFFSET}`;
}

function getRoleKey(role) {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role;
}

function buildJobDocument({
  id,
  title,
  postingType,
  ownerId,
  ownerName,
  workDate,
  roles,
  filledPositions = 0,
  status = 'active',
  tournamentStatus,
}) {
  const now = new Date();
  const defaultSalary = { type: 'daily', amount: 180000 };
  const totalPositions = roles.reduce((sum, role) => sum + role.count, 0);
  const roleCatalog = roles.map((role) => ({
    role: role.role,
    ...(role.customRole ? { customRole: role.customRole } : {}),
    salary: defaultSalary,
  }));
  const roleKeys = Array.from(new Set(roleCatalog.map((role) => getRoleKey(role)).filter(Boolean)));
  const base = {
    id,
    schemaVersion: 3,
    title,
    description: `${title} review fixture`,
    status,
    ownerId,
    ownerName,
    postingType,
    workDate,
    workDates: [workDate],
    roleKeys,
    totalPositions,
    filledPositions,
    viewCount: 0,
    stats: {
      totalApplicants: 0,
      activeApplicants: 0,
      confirmedApplicants: 0,
      cancellationPendingApplicants: 0,
      filledPositions,
    },
    createdAt: now,
    updatedAt: now,
    contactPhone: '010-5550-0002',
    location: {
      name: 'UNIQN Review Venue',
      district: '강남구',
      detailedAddress: '서울 강남구 테헤란로 100',
    },
    schedule: {
      kind: 'dated',
      primaryDate: workDate,
      allDates: [workDate],
      requirements: [
        {
          date: workDate,
          timeSlots: [
            {
              id: `${id}-slot-1`,
              startTime: '18:00',
              roles: roles.map((role) => ({
                id: `${id}-${role.role}`,
                role: role.role,
                count: role.count,
                filled: role.filled ?? 0,
              })),
            },
          ],
        },
      ],
    },
    roleCatalog,
    compensation: {
      mode: 'shared',
      defaultSalary,
      allowances: {
        meal: 10000,
        transportation: 10000,
      },
      taxSettings: {
        type: 'rate',
        value: 3.3,
      },
    },
    questions: {
      items: [],
    },
  };

  if (postingType === 'urgent') {
    base.urgentConfig = { createdAt: now, priority: 'high' };
  }
  if (postingType === 'tournament') {
    base.tournamentConfig = { approvalStatus: tournamentStatus ?? 'pending', submittedAt: now };
  }
  if (status === 'closed') {
    base.closedAt = now;
    base.closedReason = 'manual';
  }

  return base;
}

function buildApplicationDocument({
  id,
  applicantId,
  applicantName,
  applicantEmail,
  jobPostingId,
  jobPostingTitle,
  jobPostingDate,
  status,
  role = 'dealer',
}) {
  const now = new Date();
  const doc = {
    id,
    applicantId,
    applicantName,
    applicantPhone: '010-5550-0003',
    applicantEmail,
    jobPostingId,
    jobPostingTitle,
    jobPostingDate,
    status,
    assignments: [
      {
        roleIds: [role],
        timeSlot: '18:00',
        dates: [jobPostingDate],
        isGrouped: false,
      },
    ],
    message: 'App Review fixture application',
    recruitmentType: 'event',
    createdAt: now,
    updatedAt: now,
    isRead: false,
  };

  if (status === 'confirmed' || status === 'completed') {
    doc.confirmedAt = now;
  }
  if (status === 'completed') {
    doc.processedAt = now;
  }

  return doc;
}

function buildWorkLogDocument({ id, staffId, staffName, jobPostingId, ownerId, date }) {
  const now = new Date();

  return {
    id,
    staffId,
    staffName,
    staffPhone: '010-5550-0003',
    jobPostingId,
    ownerId,
    role: 'dealer',
    date,
    workDate: date,
    timeSlot: '18:00',
    checkInTime: toKstDateTime(date, '18:00'),
    checkOutTime: toKstDateTime(date, '23:00'),
    status: 'checked_out',
    payrollStatus: 'pending',
    payrollAmount: null,
    payrollDate: null,
    payrollNotes: null,
    customSalaryInfo: null,
    customAllowances: null,
    customTaxSettings: null,
    settlementModificationHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildAnnouncementDocuments(adminAccount) {
  const now = new Date();
  const publishedAt = addDays(now, -1);

  return [
    {
      path: `announcements/${REVIEW_DOC_IDS.announcements.published}`,
      data: {
        title: 'Apple Review | 공지사항 테스트',
        content: 'Review fixture announcement for App Store review.',
        category: 'notice',
        status: 'published',
        priority: 1,
        isPinned: true,
        targetAudience: { type: 'all' },
        authorId: adminAccount.uid,
        authorName: adminAccount.name,
        viewCount: 0,
        publishedAt,
        createdAt: publishedAt,
        updatedAt: publishedAt,
        images: [],
      },
    },
    {
      path: `announcements/${REVIEW_DOC_IDS.announcements.draft}`,
      data: {
        title: 'Apple Review | 공지 초안',
        content: 'Draft announcement fixture for admin surfaces.',
        category: 'update',
        status: 'draft',
        priority: 0,
        isPinned: false,
        targetAudience: { type: 'roles', roles: ['admin', 'employer'] },
        authorId: adminAccount.uid,
        authorName: adminAccount.name,
        viewCount: 0,
        createdAt: now,
        updatedAt: now,
        images: [],
      },
    },
  ];
}

function buildReportDocument({ employerAccount, staffAccount, jobPostingId, jobPostingTitle }) {
  const now = new Date();

  return {
    path: `reports/${REVIEW_DOC_IDS.reports.pending}`,
    data: {
      type: 'tardiness',
      reporterType: 'employer',
      reporterId: employerAccount.uid,
      reporterName: employerAccount.name,
      targetId: staffAccount.uid,
      targetName: staffAccount.name,
      jobPostingId,
      jobPostingTitle,
      description: 'Review fixture report for admin report handling.',
      status: 'pending',
      severity: 'low',
      createdAt: now,
      updatedAt: now,
    },
  };
}

function buildInquiryDocuments({ adminAccount, staffAccount }) {
  const now = new Date();
  const respondedAt = addDays(now, -1);

  return [
    {
      path: `inquiries/${REVIEW_DOC_IDS.inquiries.open}`,
      data: {
        userId: staffAccount.uid,
        userEmail: staffAccount.email,
        userName: staffAccount.name,
        category: 'general',
        subject: 'Apple Review | 문의 접수 테스트',
        message: 'This open inquiry is prepared for admin review testing.',
        status: 'open',
        attachments: [],
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `inquiries/${REVIEW_DOC_IDS.inquiries.answered}`,
      data: {
        userId: staffAccount.uid,
        userEmail: staffAccount.email,
        userName: staffAccount.name,
        category: 'account',
        subject: 'Apple Review | 답변 완료 문의',
        message: 'This answered inquiry is prepared for staff/admin detail testing.',
        status: 'closed',
        response: 'This is the prepared admin response for App Review.',
        responderId: adminAccount.uid,
        responderName: adminAccount.name,
        respondedAt,
        attachments: [],
        createdAt: addDays(respondedAt, -1),
        updatedAt: respondedAt,
      },
    },
  ];
}

function buildNotificationDocument({
  recipientId,
  type,
  category,
  title,
  body,
  data = {},
  isRead = false,
}) {
  return {
    recipientId,
    type,
    category,
    title,
    body,
    data,
    isRead,
    priority: 'normal',
    createdAt: new Date(),
    ...(isRead ? { readAt: new Date() } : {}),
  };
}

function buildUserDocument(account) {
  const now = new Date();
  const profile = {
    uid: account.uid,
    email: account.email,
    name: account.name,
    nickname: account.name,
    displayName: account.name,
    role: account.role,
    status: 'active',
    isActive: true,
    phone: account.phone,
    phoneNumber: account.phone,
    phoneVerified: true,
    profileCompleted: true,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  };

  if (account.role === 'employer') {
    profile.employerAgreements = {
      termsAgreedAt: now,
      termsVersion: '1.0',
      liabilityWaiverAgreedAt: now,
      liabilityWaiverVersion: '1.0',
    };
    profile.employerRegisteredAt = now;
  }

  return profile;
}

function buildReviewPackage({ adminAccount, employerAccount, staffAccount }) {
  const today = startOfLocalDay();
  const dates = {
    freshApply: formatDateOnly(addDays(today, 2)),
    applicantQueue: formatDateOnly(addDays(today, 3)),
    confirmedStaff: formatDateOnly(addDays(today, 4)),
    settlement: formatDateOnly(addDays(today, -2)),
    tournamentPending: formatDateOnly(addDays(today, 5)),
  };

  const jobs = [
    {
      path: `jobPostings/${REVIEW_DOC_IDS.jobs.freshApply}`,
      data: buildJobDocument({
        id: REVIEW_DOC_IDS.jobs.freshApply,
        title: 'Apple Review | 신규 지원 테스트',
        postingType: 'regular',
        ownerId: employerAccount.uid,
        ownerName: employerAccount.name,
        workDate: dates.freshApply,
        roles: [
          { role: 'dealer', count: 1, filled: 0 },
          { role: 'floor', count: 1, filled: 0 },
        ],
      }),
    },
    {
      path: `jobPostings/${REVIEW_DOC_IDS.jobs.applicantQueue}`,
      data: buildJobDocument({
        id: REVIEW_DOC_IDS.jobs.applicantQueue,
        title: 'Apple Review | 지원자 관리 테스트',
        postingType: 'urgent',
        ownerId: employerAccount.uid,
        ownerName: employerAccount.name,
        workDate: dates.applicantQueue,
        roles: [{ role: 'dealer', count: 1, filled: 0 }],
      }),
    },
    {
      path: `jobPostings/${REVIEW_DOC_IDS.jobs.confirmedStaff}`,
      data: buildJobDocument({
        id: REVIEW_DOC_IDS.jobs.confirmedStaff,
        title: 'Apple Review | 확정 스태프 관리',
        postingType: 'regular',
        ownerId: employerAccount.uid,
        ownerName: employerAccount.name,
        workDate: dates.confirmedStaff,
        roles: [{ role: 'dealer', count: 1, filled: 1 }],
        filledPositions: 1,
      }),
    },
    {
      path: `jobPostings/${REVIEW_DOC_IDS.jobs.settlement}`,
      data: buildJobDocument({
        id: REVIEW_DOC_IDS.jobs.settlement,
        title: 'Apple Review | 정산 관리 테스트',
        postingType: 'regular',
        ownerId: employerAccount.uid,
        ownerName: employerAccount.name,
        workDate: dates.settlement,
        roles: [{ role: 'dealer', count: 1, filled: 1 }],
        status: 'closed',
        filledPositions: 1,
      }),
    },
    {
      path: `jobPostings/${REVIEW_DOC_IDS.jobs.tournamentPending}`,
      data: buildJobDocument({
        id: REVIEW_DOC_IDS.jobs.tournamentPending,
        title: 'Apple Review | 승인 대기 대회 공고',
        postingType: 'tournament',
        ownerId: employerAccount.uid,
        ownerName: employerAccount.name,
        workDate: dates.tournamentPending,
        roles: [{ role: 'dealer', count: 2, filled: 0 }],
        tournamentStatus: 'pending',
      }),
    },
  ];

  jobs[1].data.stats = {
    totalApplicants: 1,
    activeApplicants: 1,
    confirmedApplicants: 0,
    cancellationPendingApplicants: 0,
    filledPositions: 0,
  };
  jobs[2].data.stats = {
    totalApplicants: 1,
    activeApplicants: 1,
    confirmedApplicants: 1,
    cancellationPendingApplicants: 0,
    filledPositions: 1,
  };
  jobs[3].data.stats = {
    totalApplicants: 1,
    activeApplicants: 0,
    confirmedApplicants: 0,
    cancellationPendingApplicants: 0,
    filledPositions: 1,
  };

  const applications = [
    {
      path: `applications/${REVIEW_DOC_IDS.jobs.applicantQueue}_${staffAccount.uid}`,
      data: buildApplicationDocument({
        id: `${REVIEW_DOC_IDS.jobs.applicantQueue}_${staffAccount.uid}`,
        applicantId: staffAccount.uid,
        applicantName: staffAccount.name,
        applicantEmail: staffAccount.email,
        jobPostingId: REVIEW_DOC_IDS.jobs.applicantQueue,
        jobPostingTitle: 'Apple Review | 지원자 관리 테스트',
        jobPostingDate: dates.applicantQueue,
        status: 'applied',
      }),
    },
    {
      path: `applications/${REVIEW_DOC_IDS.jobs.confirmedStaff}_${staffAccount.uid}`,
      data: buildApplicationDocument({
        id: `${REVIEW_DOC_IDS.jobs.confirmedStaff}_${staffAccount.uid}`,
        applicantId: staffAccount.uid,
        applicantName: staffAccount.name,
        applicantEmail: staffAccount.email,
        jobPostingId: REVIEW_DOC_IDS.jobs.confirmedStaff,
        jobPostingTitle: 'Apple Review | 확정 스태프 관리',
        jobPostingDate: dates.confirmedStaff,
        status: 'confirmed',
      }),
    },
    {
      path: `applications/${REVIEW_DOC_IDS.jobs.settlement}_${staffAccount.uid}`,
      data: buildApplicationDocument({
        id: `${REVIEW_DOC_IDS.jobs.settlement}_${staffAccount.uid}`,
        applicantId: staffAccount.uid,
        applicantName: staffAccount.name,
        applicantEmail: staffAccount.email,
        jobPostingId: REVIEW_DOC_IDS.jobs.settlement,
        jobPostingTitle: 'Apple Review | 정산 관리 테스트',
        jobPostingDate: dates.settlement,
        status: 'completed',
      }),
    },
  ];

  const workLogs = [
    {
      path: `workLogs/${REVIEW_DOC_IDS.workLogs.settlementPending}`,
      data: buildWorkLogDocument({
        id: REVIEW_DOC_IDS.workLogs.settlementPending,
        staffId: staffAccount.uid,
        staffName: staffAccount.name,
        jobPostingId: REVIEW_DOC_IDS.jobs.settlement,
        ownerId: employerAccount.uid,
        date: dates.settlement,
      }),
    },
  ];

  const notifications = [
    {
      path: `users/${staffAccount.uid}/notifications/app-review-staff-announcement`,
      data: buildNotificationDocument({
        recipientId: staffAccount.uid,
        type: 'announcement',
        category: 'system',
        title: 'Apple Review | 공지 도착',
        body: '공지사항 페이지 검증용 알림입니다.',
        data: {
          announcementId: REVIEW_DOC_IDS.announcements.published,
          announcementTitle: 'Apple Review | 공지사항 테스트',
        },
      }),
    },
    {
      path: `users/${staffAccount.uid}/notifications/app-review-staff-confirmed`,
      data: buildNotificationDocument({
        recipientId: staffAccount.uid,
        type: 'application_confirmed',
        category: 'application',
        title: 'Apple Review | 지원 확정',
        body: '확정 스태프 관리 화면 검증용 알림입니다.',
        data: { jobPostingId: REVIEW_DOC_IDS.jobs.confirmedStaff },
      }),
    },
    {
      path: `users/${staffAccount.uid}/notifications/app-review-staff-inquiry-answered`,
      data: buildNotificationDocument({
        recipientId: staffAccount.uid,
        type: 'inquiry_answered',
        category: 'admin',
        title: 'Apple Review | 문의 답변 완료',
        body: '문의 상세 화면 검증용 알림입니다.',
        data: { inquiryId: REVIEW_DOC_IDS.inquiries.answered },
      }),
    },
    {
      path: `users/${employerAccount.uid}/notifications/app-review-employer-new-application`,
      data: buildNotificationDocument({
        recipientId: employerAccount.uid,
        type: 'new_application',
        category: 'application',
        title: 'Apple Review | 신규 지원 도착',
        body: '지원자 관리 화면 검증용 알림입니다.',
        data: { jobPostingId: REVIEW_DOC_IDS.jobs.applicantQueue },
      }),
    },
    {
      path: `users/${adminAccount.uid}/notifications/app-review-admin-new-report`,
      data: buildNotificationDocument({
        recipientId: adminAccount.uid,
        type: 'new_report',
        category: 'admin',
        title: 'Apple Review | 신규 신고',
        body: '신고 관리 화면 검증용 알림입니다.',
        data: { reportId: REVIEW_DOC_IDS.reports.pending },
      }),
    },
    {
      path: `users/${adminAccount.uid}/notifications/app-review-admin-new-inquiry`,
      data: buildNotificationDocument({
        recipientId: adminAccount.uid,
        type: 'new_inquiry',
        category: 'admin',
        title: 'Apple Review | 신규 문의',
        body: '문의 관리 화면 검증용 알림입니다.',
        data: { inquiryId: REVIEW_DOC_IDS.inquiries.open },
      }),
    },
    {
      path: `users/${adminAccount.uid}/notifications/app-review-admin-tournament`,
      data: buildNotificationDocument({
        recipientId: adminAccount.uid,
        type: 'tournament_approval_request',
        category: 'admin',
        title: 'Apple Review | 대회 승인 요청',
        body: '대회 승인 화면 검증용 알림입니다.',
        data: { jobPostingId: REVIEW_DOC_IDS.jobs.tournamentPending },
      }),
    },
  ];

  const counters = [
    { path: `users/${staffAccount.uid}/counters/notifications`, data: { unreadCount: 3 } },
    { path: `users/${employerAccount.uid}/counters/notifications`, data: { unreadCount: 1 } },
    { path: `users/${adminAccount.uid}/counters/notifications`, data: { unreadCount: 3 } },
  ];

  const users = [
    { path: `users/${adminAccount.uid}`, data: buildUserDocument(adminAccount) },
    { path: `users/${employerAccount.uid}`, data: buildUserDocument(employerAccount) },
    { path: `users/${staffAccount.uid}`, data: buildUserDocument(staffAccount) },
  ];

  return {
    dates,
    documents: [
      ...users,
      ...jobs,
      ...applications,
      ...workLogs,
      ...buildAnnouncementDocuments(adminAccount),
      buildReportDocument({
        employerAccount,
        staffAccount,
        jobPostingId: REVIEW_DOC_IDS.jobs.settlement,
        jobPostingTitle: 'Apple Review | 정산 관리 테스트',
      }),
      ...buildInquiryDocuments({ adminAccount, staffAccount }),
      ...notifications,
      ...counters,
    ],
  };
}

function buildReviewInstructions({ accounts, dates }) {
  return {
    recommendedPrimaryCredential: {
      role: 'employer',
      email: accounts.employer.email,
      password: accounts.employer.password,
    },
    appStoreConnectNote: [
      'UNIQN is a staffing and venue-operations management app. It does not provide real-money gaming.',
      '',
      'Please use the following live review accounts:',
      '1. Employer account',
      `   Email: ${accounts.employer.email}`,
      `   Password: ${accounts.employer.password}`,
      '   Use this account for posting creation and employer management flows.',
      '',
      '2. Staff account',
      `   Email: ${accounts.staff.email}`,
      `   Password: ${accounts.staff.password}`,
      '   Use this account to browse jobs, submit a fresh application, and review staff-side pages.',
      '',
      '3. Admin account',
      `   Email: ${accounts.admin.email}`,
      `   Password: ${accounts.admin.password}`,
      '   Use this account for users, reports, inquiries, announcements, and tournament approval.',
      '',
      'Prepared review fixtures:',
      `- "Apple Review | 신규 지원 테스트" (${dates.freshApply}): no existing application; use the staff account to submit a new application.`,
      `- "Apple Review | 지원자 관리 테스트" (${dates.applicantQueue}): already has one pending application for applicant-management review.`,
      `- "Apple Review | 확정 스태프 관리" (${dates.confirmedStaff}): already has one confirmed staff member for confirmed-staff review.`,
      `- "Apple Review | 정산 관리 테스트" (${dates.settlement}): contains a pending settlement work log for settlement review.`,
      `- "Apple Review | 승인 대기 대회 공고" (${dates.tournamentPending}): visible in the admin tournament approval screen.`,
      '',
      'No SMS/OTP or external approval is required for these review accounts.',
    ].join('\n'),
  };
}

function getConfiguredAccounts() {
  return {
    admin: {
      key: 'admin',
      role: 'admin',
      name: process.env.APP_REVIEW_ADMIN_NAME || 'App Review Admin',
      email: requireValue('APP_REVIEW_ADMIN_EMAIL', process.env.APP_REVIEW_ADMIN_EMAIL),
      password: requireValue('APP_REVIEW_ADMIN_PASSWORD', process.env.APP_REVIEW_ADMIN_PASSWORD),
      phone: process.env.APP_REVIEW_ADMIN_PHONE || '010-5550-0001',
    },
    employer: {
      key: 'employer',
      role: 'employer',
      name: process.env.APP_REVIEW_EMPLOYER_NAME || 'App Review Employer',
      email: requireValue('APP_REVIEW_EMPLOYER_EMAIL', process.env.APP_REVIEW_EMPLOYER_EMAIL),
      password: requireValue(
        'APP_REVIEW_EMPLOYER_PASSWORD',
        process.env.APP_REVIEW_EMPLOYER_PASSWORD
      ),
      phone: process.env.APP_REVIEW_EMPLOYER_PHONE || '010-5550-0002',
    },
    staff: {
      key: 'staff',
      role: 'staff',
      name: process.env.APP_REVIEW_STAFF_NAME || 'App Review Staff',
      email: requireValue('APP_REVIEW_STAFF_EMAIL', process.env.APP_REVIEW_STAFF_EMAIL),
      password: requireValue('APP_REVIEW_STAFF_PASSWORD', process.env.APP_REVIEW_STAFF_PASSWORD),
      phone: process.env.APP_REVIEW_STAFF_PHONE || '010-5550-0003',
    },
  };
}

async function createPackage() {
  const { projectId, apiKey } = ensureConfig();
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: workspaceRoot });
  const configuredAccounts = getConfiguredAccounts();
  const accounts = {};

  for (const account of Object.values(configuredAccounts)) {
    const ensured = await ensureEmailPasswordAccount({
      apiKey,
      projectId,
      accessToken,
      email: account.email,
      password: account.password,
      role: account.role,
    });

    accounts[account.key] = {
      ...account,
      uid: ensured.uid,
    };
  }

  const reviewPackage = buildReviewPackage({
    adminAccount: accounts.admin,
    employerAccount: accounts.employer,
    staffAccount: accounts.staff,
  });

  for (const document of reviewPackage.documents) {
    await upsertDocument(projectId, accessToken, document.path, document.data);
  }

  const payload = {
    createdAt: new Date().toISOString(),
    projectId,
    accounts,
    documents: reviewPackage.documents.map((item) => item.path),
    dates: reviewPackage.dates,
    instructions: buildReviewInstructions({ accounts, dates: reviewPackage.dates }),
  };

  writeJson(outputPath, payload);
  process.stdout.write(`${outputPath}\n`);
}

async function cleanupPackage() {
  if (!fs.existsSync(outputPath)) {
    process.stdout.write('No app review package file found.\n');
    return;
  }

  const { projectId } = ensureConfig();
  const accessToken = ensureFreshFirebaseAccessToken({ cwd: workspaceRoot });
  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const documentPaths = Array.isArray(payload.documents) ? [...payload.documents] : [];
  documentPaths.sort((left, right) => right.split('/').length - left.split('/').length);

  for (const documentPath of documentPaths) {
    await deleteDocument(projectId, accessToken, documentPath);
  }

  for (const account of Object.values(payload.accounts || {})) {
    if (account?.uid) {
      await deleteAuthUser(projectId, accessToken, account.uid);
    }
  }

  fs.unlinkSync(outputPath);
  process.stdout.write('cleaned\n');
}

async function main() {
  const mode = process.argv[2];

  if (mode === 'create') {
    await createPackage();
    return;
  }
  if (mode === 'cleanup') {
    await cleanupPackage();
    return;
  }

  throw new Error('Usage: node scripts/manage-app-review-package.js <create|cleanup>');
}

main().catch((error) => {
  console.error(error.payload || error);
  process.exit(1);
});
