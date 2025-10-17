/**
 * 알림 시스템 테스트 스크립트
 * Firebase Admin SDK를 사용하여 모든 알림 타입을 테스트합니다.
 *
 * 실행 방법:
 * node test-notifications.js <userId>
 */

const admin = require('firebase-admin');
const serviceAccount = require('../tholdem-ebc18-firebase-adminsdk-mvv4i-8c97c99e1e.json');

// Firebase Admin 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://tholdem-ebc18.firebaseio.com'
});

const db = admin.firestore();

// 테스트할 userId (명령줄 인자로 받음)
const userId = process.argv[2];

if (!userId) {
  console.error('❌ 사용법: node test-notifications.js <userId>');
  process.exit(1);
}

console.log(`\n🧪 알림 시스템 테스트 시작...`);
console.log(`📧 대상 사용자: ${userId}\n`);

// 14가지 알림 타입 테스트 데이터
const testNotifications = [
  // 1. 시스템 알림 (3개)
  {
    type: 'job_posting_announcement',
    category: 'system',
    priority: 'high',
    title: '[신규 구인] 강남 홀덤펍 토너먼트',
    body: '5월 15일 강남점에서 딜러 3명을 모집합니다',
    action: {
      type: 'navigate',
      target: '/app/my-schedule'
    },
    relatedId: 'test-job-posting-123',
    data: {},
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'system_announcement',
    category: 'system',
    priority: 'urgent',
    title: '[긴급 공지] 5월 휴무 안내',
    body: '5월 5일 어린이날은 전체 휴무입니다',
    action: {
      type: 'navigate',
      target: '/app/announcements'
    },
    relatedId: null,
    data: {},
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'app_update',
    category: 'system',
    priority: 'medium',
    title: '[업데이트] 새로운 기능이 추가되었습니다',
    body: 'v0.2.3: 알림 센터 기능이 추가되었습니다',
    action: {
      type: 'navigate',
      target: '/app/settings'
    },
    relatedId: null,
    data: { version: '0.2.3' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },

  // 2. 근무 알림 (3개)
  {
    type: 'job_application',
    category: 'work',
    priority: 'medium',
    title: '[지원 완료] 강남점 토너먼트 지원 완료',
    body: '귀하의 지원서가 접수되었습니다',
    action: {
      type: 'navigate',
      target: '/app/my-applications'
    },
    relatedId: 'test-application-456',
    data: {},
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'staff_approval',
    category: 'work',
    priority: 'high',
    title: '[확정] 5월 15일 강남점 스태프 확정',
    body: '축하합니다! 스태프로 확정되었습니다',
    action: {
      type: 'navigate',
      target: '/app/my-schedule'
    },
    relatedId: 'test-event-789',
    data: { eventDate: '2025-05-15' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'staff_rejection',
    category: 'work',
    priority: 'medium',
    title: '[거절] 5월 15일 강남점 지원 불승인',
    body: '아쉽지만 이번에는 선정되지 못했습니다',
    action: {
      type: 'navigate',
      target: '/app/job-postings'
    },
    relatedId: 'test-event-790',
    data: {},
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },

  // 3. 일정 알림 (3개)
  {
    type: 'schedule_reminder',
    category: 'schedule',
    priority: 'high',
    title: '[리마인더] 1시간 후 근무 시작',
    body: '오후 6시부터 강남점에서 근무가 시작됩니다',
    action: {
      type: 'navigate',
      target: '/app/my-schedule'
    },
    relatedId: 'test-schedule-111',
    data: { scheduleTime: '18:00' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'schedule_change',
    category: 'schedule',
    priority: 'urgent',
    title: '[일정 변경] 5월 15일 근무 시간 변경',
    body: '근무 시작 시간이 오후 5시로 변경되었습니다',
    action: {
      type: 'navigate',
      target: '/app/my-schedule'
    },
    relatedId: 'test-schedule-222',
    data: { oldTime: '18:00', newTime: '17:00' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'attendance_reminder',
    category: 'schedule',
    priority: 'high',
    title: '[출석 체크] 출석 확인을 해주세요',
    body: '아직 출석 체크를 하지 않으셨습니다',
    action: {
      type: 'navigate',
      target: '/app/attendance'
    },
    relatedId: 'test-attendance-333',
    data: {},
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },

  // 4. 급여 알림 (2개)
  {
    type: 'salary_notification',
    category: 'finance',
    priority: 'high',
    title: '[급여 지급] 5월 급여가 지급되었습니다',
    body: '총 1,500,000원이 입금되었습니다',
    action: {
      type: 'navigate',
      target: '/app/payroll'
    },
    relatedId: 'test-salary-444',
    data: { amount: 1500000, month: '2025-05' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'bonus_notification',
    category: 'finance',
    priority: 'high',
    title: '[보너스 지급] 성과급이 지급되었습니다',
    body: '우수 근무로 200,000원이 추가 지급되었습니다',
    action: {
      type: 'navigate',
      target: '/app/payroll'
    },
    relatedId: 'test-bonus-555',
    data: { amount: 200000 },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },

  // 5. 소셜 알림 (3개)
  {
    type: 'comment',
    category: 'social',
    priority: 'low',
    title: '[댓글] 홍길동님이 댓글을 남겼습니다',
    body: '좋은 정보 감사합니다!',
    action: {
      type: 'navigate',
      target: '/app/posts/test-post-666'
    },
    relatedId: 'test-post-666',
    data: { commenterId: 'user-123', commenterName: '홍길동' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'like',
    category: 'social',
    priority: 'low',
    title: '[좋아요] 김철수님이 좋아요를 눌렀습니다',
    body: '귀하의 게시글에 좋아요가 추가되었습니다',
    action: {
      type: 'navigate',
      target: '/app/posts/test-post-777'
    },
    relatedId: 'test-post-777',
    data: { likerId: 'user-456', likerName: '김철수' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    type: 'mention',
    category: 'social',
    priority: 'medium',
    title: '[멘션] 이영희님이 회원님을 언급했습니다',
    body: '@홍길동 이 정보 참고하세요',
    action: {
      type: 'navigate',
      target: '/app/posts/test-post-888'
    },
    relatedId: 'test-post-888',
    data: { mentionerId: 'user-789', mentionerName: '이영희' },
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

// 알림 생성 함수
async function createNotification(notificationData) {
  try {
    const docRef = await db.collection('notifications').add({
      userId,
      ...notificationData
    });
    console.log(`✅ ${notificationData.title}`);
    return docRef.id;
  } catch (error) {
    console.error(`❌ ${notificationData.title}:`, error.message);
    return null;
  }
}

// 메인 테스트 함수
async function runTests() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📢 시스템 알림 (3개)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 0; i < 3; i++) {
    await createNotification(testNotifications[i]);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💼 근무 알림 (3개)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 3; i < 6; i++) {
    await createNotification(testNotifications[i]);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📅 일정 알림 (3개)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 6; i < 9; i++) {
    await createNotification(testNotifications[i]);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 급여 알림 (2개)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 9; i < 11; i++) {
    await createNotification(testNotifications[i]);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💬 소셜 알림 (3개)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (let i = 11; i < 14; i++) {
    await createNotification(testNotifications[i]);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 테스트 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 총 ${testNotifications.length}개의 알림이 생성되었습니다.`);
  console.log(`🔔 앱에서 알림을 확인하세요!\n`);
}

// 실행
runTests()
  .then(() => {
    console.log('🎉 모든 테스트가 완료되었습니다.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 테스트 실패:', error);
    process.exit(1);
  });
