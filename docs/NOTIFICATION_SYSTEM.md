# 📱 T-HOLDEM 알림 시스템 완전 가이드

> T-HOLDEM 구인구직 플랫폼의 종합 알림 시스템 문서
> **버전**: v1.0.0 | **최종 업데이트**: 2025-10-15

---

## 📌 목차

1. [시스템 개요](#-시스템-개요)
2. [아키텍처](#-아키텍처)
3. [구현 상태](#-구현-상태)
4. [미구현 기능 로드맵](#-미구현-기능-로드맵)
5. [구현 가이드](#-구현-가이드)
6. [운영 및 모니터링](#-운영-및-모니터링)

---

## 🎯 시스템 개요

### 프로젝트 배경

T-HOLDEM은 홀덤 포커 토너먼트 운영을 위한 구인구직 플랫폼으로, **실시간 알림 시스템**을 통해 고용주와 구직자(딜러/스태프) 간 효율적인 커뮤니케이션을 지원합니다.

### 기술 스택

```yaml
플랫폼: React 18 + TypeScript + Capacitor 7.4.3
알림_인프라:
  - FCM 푸시: @capacitor/push-notifications (v7.0.3)
  - 로컬 알림: @capacitor/local-notifications (v7.0.3)
  - Toast 시스템: 커스텀 구현 (77개 alert() 교체 완료)
백엔드: Firebase Firestore + Firebase Functions
```

### 핵심 지표

#### ✅ **구현 완료**
- **10개 알림 타입**: System(3), Work(3), Schedule(3), Finance(1)
- **7개 파일 생성**: 1,414줄
- **4개 UI 컴포넌트**: Badge, Item, Dropdown, Page
- **실시간 Firestore 구독**: 최대 50개, 자동 정렬
- **다국어 지원**: 한국어/영어

#### 🚧 **구현 필요**
- **Firebase Functions**: 5개 (지원서, 승인, 근무, 출석 관련)
- **알림 타입 연동**: 9개 타입 미연결
- **알림 설정 UI**: 사용자별 ON/OFF 기능

#### 📊 **품질 검증**
- ✅ TypeScript: 0 에러 (strict mode)
- ✅ ESLint: 0 경고 (알림 관련)
- ✅ 프로덕션 빌드: 성공
- ✅ 번들 크기: 299.92 KB (+8.46 KB)

---

## 🏗️ 아키텍처

### 알림 타입 시스템 (10개)

#### **카테고리 분류**

```typescript
type NotificationCategory =
  | 'system'      // 시스템 공지, 업데이트
  | 'work'        // 지원, 승인, 근무 관련
  | 'schedule'    // 일정, 출석, 리마인더
  | 'finance';    // 급여, 정산
```

#### **알림 타입 목록**

| 카테고리 | 타입 | 아이콘 | 우선순위 | 라우팅 | 구현 상태 |
|---------|------|--------|---------|--------|----------|
| **System** | `job_posting_announcement` | 📢 | high | /app/jobs | ✅ **완전 구현** |
| System | `system_announcement` | 🔔 | medium | /app/announcements | ⚠️ UI만 구현 |
| System | `app_update` | 🔄 | low | /app/announcements | ⚠️ UI만 구현 |
| **Work** | `job_application` | 📝 | medium | /app/my-schedule | ⚠️ 부분 구현 |
| Work | `staff_approval` | ✅ | high | /app/my-schedule | ⚠️ 미연결 |
| Work | `staff_rejection` | ❌ | medium | /app/jobs | ❌ 미구현 |
| **Schedule** | `schedule_reminder` | ⏰ | high | /app/my-schedule | ⚠️ 부분 구현 |
| Schedule | `schedule_change` | 📅 | high | /app/my-schedule | ❌ 미구현 |
| Schedule | `attendance_reminder` | 📍 | medium | /app/attendance | ⚠️ 부분 구현 |
| **Finance** | `salary_notification` | 💰 | high | /app/staff | ⚠️ 부분 구현 |

**참고**: Social 카테고리(comment, like, mention)와 bonus_notification은 Phase 3로 연기되어 현재 타입 정의에서 제거됨.

---

### 핵심 컴포넌트 구조

```
📦 알림 시스템
├── 📁 타입 정의
│   ├── src/types/notification.ts (163줄)
│   └── src/config/notificationConfig.ts (155줄)
│
├── 📁 데이터 관리
│   └── src/hooks/useNotifications.ts (358줄)
│       ├── Firestore 실시간 구독
│       ├── 필터링 (카테고리, 우선순위, 날짜)
│       └── 액션 (읽음, 삭제, 통계)
│
├── 📁 UI 컴포넌트
│   ├── src/components/notifications/NotificationBadge.tsx (70줄)
│   ├── src/components/notifications/NotificationItem.tsx (224줄)
│   ├── src/components/notifications/NotificationDropdown.tsx (202줄)
│   └── src/pages/NotificationsPage.tsx (208줄)
│
├── 📁 푸시 알림 인프라
│   ├── src/services/notifications.ts (177줄)
│   │   ├── FCM 토큰 관리
│   │   ├── 푸시 알림 수신
│   │   └── 알림 액션 라우팅
│   └── src/services/localNotifications.ts (314줄)
│       ├── 로컬 알림 스케줄링
│       └── 웹 브라우저 Notification 폴백
│
└── 📁 공지 전송 시스템
    ├── src/hooks/useJobPostingAnnouncement.ts (169줄)
    └── src/types/announcement.ts (205줄)
```

---

### Firestore 데이터 구조

#### `notifications` 컬렉션

```typescript
interface Notification {
  // 기본 정보
  id: string;
  userId: string;              // 필수, 인덱스

  // 분류
  type: NotificationType;      // 10가지 타입
  category: NotificationCategory;
  priority: NotificationPriority;

  // 내용
  title: string;
  body: string;
  imageUrl?: string;

  // 액션
  action: {
    type: 'navigate' | 'open_modal' | 'external_link' | 'none';
    target?: string;
    params?: Record<string, any>;
  };

  // 메타데이터
  relatedId?: string;
  senderId?: string;
  data?: Record<string, any>;

  // 상태
  isRead: boolean;
  isSent: boolean;
  isLocal: boolean;

  // 타임스탬프
  createdAt: Timestamp;        // 필수, 인덱스
  sentAt?: Timestamp;
  readAt?: Timestamp;
}
```

#### **필수 Firestore 인덱스**

```
컬렉션: notifications
필드:
  - userId (Ascending)
  - createdAt (Descending)
```

#### `users` 컬렉션 (FCM 토큰)

```typescript
{
  fcmToken: {
    token: string;
    platform: 'ios' | 'android' | 'web';
    timestamp: Date;
  },
  fcmTokens: {
    ios?: { token, platform, timestamp },
    android?: { token, platform, timestamp }
  }
}
```

---

## 📊 구현 상태

### ✅ 완전 구현된 기능

#### **1. 알림 센터 UI 시스템**

```typescript
// NotificationBadge
- count, max, variant (count/dot)
- 읽지 않은 개수 실시간 표시

// NotificationItem
- 타입별 아이콘 및 색상
- 상대 시간 표시 (date-fns)
- 클릭 시 자동 라우팅 + 읽음 처리

// NotificationDropdown (헤더)
- 최근 5개 미리보기
- 외부 클릭 + ESC 닫기

// NotificationsPage
- 탭: 전체 / 안읽음 / 읽음
- 카테고리 필터링
- 일괄 작업 (모두 읽음, 삭제)
```

#### **2. 데이터 관리**

```typescript
// useNotifications Hook
const {
  notifications,     // 알림 목록
  unreadCount,       // 읽지 않은 개수
  stats,             // 통계 (카테고리/우선순위별)
  markAsRead,        // 개별 읽음 처리
  markAllAsRead,     // 전체 읽음 처리
  deleteNotification, // 개별 삭제
  deleteAllRead,     // 읽은 알림 모두 삭제
  filter,            // 필터 상태
  setFilter,         // 필터 설정
} = useNotifications();
```

**특징**:
- ✅ Firestore 실시간 구독 (`onSnapshot`)
- ✅ 최대 50개 자동 제한
- ✅ 생성일시 역순 정렬
- ✅ 필터링 (isRead, category, priority, date range)
- ✅ Batch 처리 최적화

#### **3. 공지 전송 시스템**

```typescript
// useJobPostingAnnouncement Hook
const {
  sendAnnouncement,  // 공지 전송
  isSending,         // 전송 중 상태
  error,             // 에러
  result,            // 전송 결과
} = useJobPostingAnnouncement();

await sendAnnouncement(
  eventId,           // 공고 ID
  title,             // 공지 제목
  message,           // 공지 내용
  targetStaffIds,    // 수신 스태프 ID 목록
  jobPostingTitle    // 공고 제목 (자동 prefix)
);
```

**특징**:
- ✅ Firebase Functions 호출 (`sendJobPostingAnnouncement`)
- ✅ 공고별 스태프 일괄 전송
- ✅ 공고 제목 자동 prefix 기능
- ✅ 전송 결과 통계 (성공/실패)

#### **4. 푸시 알림 인프라**

```typescript
// src/services/notifications.ts
export const initializePushNotifications = async (userId: string) => {
  // 권한 요청
  // FCM 토큰 등록 및 Firestore 저장
  // 알림 수신 리스너 (foreground/background)
  // 액션 기반 네비게이션
};
```

**특징**:
- ✅ Capacitor Push Notifications 통합
- ✅ FCM 토큰 관리 (플랫폼별 저장)
- ✅ 포그라운드/백그라운드 알림 수신
- ✅ 알림 액션 라우팅 처리

#### **5. 로컬 알림**

```typescript
// src/services/localNotifications.ts
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  scheduledAt: Date,
  data?: Record<string, any>
) => {
  // 예약 알림 스케줄링
  // 웹 브라우저 알림 폴백
};
```

**특화 함수**:
- ✅ `notifyApprovalRequest` (승인 요청)
- ✅ `notifyScheduleReminder` (일정 리마인더)
- ✅ `notifySalaryPayment` (급여 지급)
- ✅ `notifyAttendanceReminder` (출석 체크)

---

### ⚠️ 부분 구현된 기능

#### **알림 타입별 연동 부족**

| 타입 | 문제점 | 필요 작업 |
|------|--------|----------|
| `job_application` | Firebase Functions 트리거 미구현 | onCreate(applications/{id}) |
| `staff_approval` | 승인 시 알림 전송 미연결 | onUpdate(applications/{id}) |
| `schedule_reminder` | 로컬 알림 함수만 있음 | 실제 호출 부분 연결 |
| `attendance_reminder` | 출석 시스템 미연결 | Scheduled Functions |
| `salary_notification` | 급여 정산 시 미연결 | onCreate(salaries/{id}) |

#### **Firebase Functions 부족**

현재 구현된 Functions:
- ✅ `sendJobPostingAnnouncement` (공지 전송)

미구현 Functions (80%):
- ❌ `onApplicationSubmitted` (지원서 제출)
- ❌ `onApplicationStatusChanged` (승인/거절)
- ❌ `onStaffConfirmed` (근무 확정)
- ❌ `checkAttendanceStatus` (출석 체크 스케줄러)

---

### ❌ 미구현 기능

#### **Phase 1 (Core) 미완료**

**1. 지원서 제출 알림 (고용주)**
```yaml
트리거: Firestore onCreate(applications/{id})
내용: 지원자 정보 포함, FCM 푸시 전송
우선순위: 🔴 최우선
예상 작업: 4-6시간
```

**2. 지원 승인/거절 알림 (지원자)**
```yaml
트리거: Firestore onUpdate(applications/{id})
조건: status 변경 (pending → approved/rejected)
액션: 지도 열기, 캘린더 추가 버튼
우선순위: 🔴 최우선
예상 작업: 4-6시간
```

**3. 근무 확정 알림 (지원자)**
```yaml
트리거: Firestore onCreate(staff/{id})
자동 예약: 1시간 전, 15분 전 로컬 알림
우선순위: 🔴 최우선
예상 작업: 6-8시간
```

**4. 출석 체크 요청 (근무자)**
```yaml
트리거: Firebase Functions Scheduled
반복: 미체크 시 5분마다 재전송 (최대 3회)
우선순위: 🔴 최우선
예상 작업: 8-10시간
```

#### **Phase 2 (Enhanced) 미완료**

- 📅 공고 마감 임박 알림 (Cloud Scheduler)
- 💰 급여 계산/지급 알림
- ⚠️ 지각 경고 알림
- ⏳ 지원 검토 대기 리마인더

#### **Phase 3 (Advanced) 미완료**

- 💬 채팅 메시지 알림
- 📢 공지사항 브로드캐스트
- 🎯 맞춤형 공고 추천
- 📊 알림 분석 대시보드
- ⚙️ 알림 설정 UI

---

## 🚀 미구현 기능 로드맵

### **Phase 1: Core (즉시 구현 - 2주)**

**목표**: 구인구직 핵심 프로세스 알림 완성

#### **작업 항목**

**1. Firebase Functions 개발** (40-60시간)

```typescript
// 1-1. 지원서 제출 알림 (6시간)
functions/src/notifications/onApplicationSubmitted.ts
- 고용주 정보 조회
- FCM 토큰 확인
- 푸시 알림 전송
- Firestore notifications 문서 생성

// 1-2. 지원 승인/거절 알림 (6시간)
functions/src/notifications/onApplicationStatusChanged.ts
- status 변경 감지
- 승인 시 로컬 알림 예약 (1시간 전, 15분 전)
- FCM 푸시 전송

// 1-3. 근무 확정 알림 (8시간)
functions/src/notifications/onStaffConfirmed.ts
- 근무 확정 알림 전송
- 자동 로컬 알림 예약
- 퇴근 체크 리마인더 예약

// 1-4. 출석 체크 요청 스케줄러 (10시간)
functions/src/notifications/checkAttendanceStatus.ts
- Cloud Scheduler 설정 (every 5 minutes)
- 근무 시작 시간 도래 확인
- 미체크 시 알림 재전송 (최대 3회)

// 1-5. 퇴근 체크 리마인더 (4시간)
functions/src/notifications/scheduleCheckOutReminder.ts
- 근무 종료 시간 로컬 알림
```

#### **테스트 계획**

- 단위 테스트: Jest + Firebase Functions Test SDK
- 통합 테스트: Firestore Emulator
- E2E 테스트: Playwright

#### **배포 계획**

1. **Staging 배포** (1일)
   - Firebase Functions 배포
   - Firestore 인덱스 생성
   - 테스트 데이터 생성

2. **Production 배포** (1일)
   - 점진적 롤아웃 (10% → 50% → 100%)
   - 모니터링 (Cloud Logging, Analytics)

---

### **Phase 2: Enhanced (안정화 후 - 2-3주)**

**목표**: 사용자 경험 개선 및 리마인더 강화

#### **작업 항목** (30-40시간)

1. 📅 공고 마감 임박 알림 (8시간)
   - Cloud Scheduler + Firebase Functions
   - 마감 24시간 전 자동 알림

2. 💰 급여 계산/지급 알림 (6시간)
   - onCreate(salaries/{id})
   - 상세 명세서 링크

3. ⚠️ 지각 경고 알림 (8시간)
   - 근무 시작 15분 후 미체크 감지
   - 실시간 알림 전송

4. ⏳ 지원 검토 대기 리마인더 (6시간)
   - 지원서 제출 24시간 후 미확인 건

5. 📢 신규 공고 등록 알림 (12시간)
   - FCM 토픽 구독 기능
   - 지역별, 직종별 타겟팅

---

### **Phase 3: Advanced (고도화 - 3-4주)**

**목표**: AI 기반 맞춤형 알림 및 커뮤니케이션 강화

#### **작업 항목** (60-80시간)

1. 💬 채팅 메시지 알림 (20시간)
   - 실시간 메시징 시스템
   - 읽지 않은 메시지 배지

2. 📢 공지사항 브로드캐스트 (16시간)
   - 관리자 공지 시스템
   - 역할별, 지역별 타겟팅

3. 🎯 맞춤형 공고 추천 (24시간)
   - 머신러닝 기반 추천 알고리즘

4. ⚙️ 알림 설정 UI (12시간)
   - 사용자별 알림 ON/OFF
   - 카테고리별 푸시/이메일 설정

5. 📊 알림 분석 대시보드 (8시간)
   - 알림 오픈율, 클릭률 추적

---

## 🔧 구현 가이드

### Firebase Functions 구현 예제

#### **지원서 제출 알림 Functions**

```typescript
// functions/src/notifications/onApplicationSubmitted.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onApplicationSubmitted = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const applicationId = context.params.applicationId;

    // 1. 고용주 정보 조회
    const jobPostingDoc = await admin.firestore()
      .collection('jobPostings')
      .doc(application.eventId)
      .get();

    const jobPosting = jobPostingDoc.data();
    const employerId = jobPosting?.createdBy;

    if (!employerId) {
      console.error('고용주 정보 없음:', applicationId);
      return;
    }

    // 2. 지원자 정보 조회
    const applicantDoc = await admin.firestore()
      .collection('users')
      .doc(application.applicantId)
      .get();

    const applicant = applicantDoc.data();

    // 3. 알림 문서 생성
    const notificationId = admin.firestore().collection('notifications').doc().id;
    const notification = {
      id: notificationId,
      userId: employerId,
      type: 'job_application',
      category: 'work',
      priority: 'high',

      title: '📨 새로운 지원서 도착',
      body: `👤 ${applicant?.name}님이 '${jobPosting?.title}'에 지원했습니다.`,

      action: {
        type: 'navigate',
        target: `/applications/${applicationId}`,
      },

      relatedId: applicationId,
      senderId: application.applicantId,

      isRead: false,
      isSent: false,
      isLocal: false,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // 4. Firestore에 알림 저장
    await admin.firestore()
      .collection('notifications')
      .doc(notificationId)
      .set(notification);

    // 5. FCM 토큰 조회
    const employerDoc = await admin.firestore()
      .collection('users')
      .doc(employerId)
      .get();

    const fcmToken = employerDoc.data()?.fcmToken?.token;

    if (!fcmToken) {
      console.warn('FCM 토큰 없음:', employerId);
      return;
    }

    // 6. FCM 푸시 알림 전송
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId,
        type: notification.type,
        target: `/applications/${applicationId}`,
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'work',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      await admin.messaging().send(message);

      // 7. 전송 성공 로그
      await admin.firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          isSent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log('알림 전송 성공:', notificationId);
    } catch (error) {
      console.error('알림 전송 실패:', error);

      // 8. 에러 로그
      await admin.firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({
          error: {
            code: (error as any).code || 'UNKNOWN',
            message: (error as any).message || '알 수 없는 오류',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
    }
  });
```

---

### 로컬 알림 스케줄링 예제

#### **근무 리마인더 예약**

```typescript
// app2/src/services/workNotifications.ts
import { scheduleLocalNotification } from './localNotifications';
import { logger } from '@/utils/logger';
import type { WorkLog, JobPosting } from '@/types';

/**
 * 근무 확정 시 자동으로 리마인더 알림 예약
 */
export const scheduleWorkReminders = async (
  workLog: WorkLog,
  jobPosting: JobPosting
) => {
  try {
    const workStartTime = new Date(workLog.date + ' ' + workLog.startTime);

    // 1시간 전 알림
    const oneHourBefore = new Date(workStartTime.getTime() - 60 * 60 * 1000);
    await scheduleLocalNotification(
      '⏰ 1시간 후 근무 시작',
      `📍 ${jobPosting.location}\n🕐 출근 시간: ${workLog.startTime}\n출발 준비하세요!`,
      oneHourBefore,
      {
        notificationId: `work_1h_${workLog.id}`,
        type: 'schedule_reminder',
        workLogId: workLog.id,
        target: '/attendance/check-in',
      }
    );

    // 15분 전 알림
    const fifteenMinsBefore = new Date(workStartTime.getTime() - 15 * 60 * 1000);
    await scheduleLocalNotification(
      '🚨 곧 출근 시간입니다!',
      '15분 후 근무 시작입니다.\n출석 체크를 잊지 마세요!',
      fifteenMinsBefore,
      {
        notificationId: `work_15m_${workLog.id}`,
        type: 'schedule_reminder',
        workLogId: workLog.id,
        target: '/attendance/check-in',
        sound: true,
        vibrate: true,
      }
    );

    // 근무 종료 시간 퇴근 체크 리마인더
    const workEndTime = new Date(workLog.date + ' ' + workLog.endTime);
    await scheduleLocalNotification(
      '🏁 퇴근 체크를 잊지 마세요!',
      '근무 종료 시간입니다.\n정확한 근무 시간 기록을 위해 퇴근 체크해주세요.',
      workEndTime,
      {
        notificationId: `work_end_${workLog.id}`,
        type: 'attendance_reminder',
        workLogId: workLog.id,
        target: '/attendance/check-out',
      }
    );

    logger.info('근무 리마인더 예약 완료', {
      workLogId: workLog.id,
      reminders: ['1h', '15m', 'end'],
    });
  } catch (error) {
    logger.error('근무 리마인더 예약 실패', error as Error);
    throw error;
  }
};
```

---

### 확장 방법: 새 알림 타입 추가 (3단계)

#### **1단계: 타입 정의** ([src/types/notification.ts](../app2/src/types/notification.ts))

```typescript
export type NotificationType =
  | 'existing_types...'
  | 'new_notification_type';  // ← 추가
```

#### **2단계: 설정 추가** ([src/config/notificationConfig.ts](../app2/src/config/notificationConfig.ts))

```typescript
new_notification_type: {
  icon: '🆕',
  color: 'blue',
  defaultPriority: 'medium',
  category: 'system',
  route: (relatedId) => `/app/route/${relatedId}`,
}
```

#### **3단계: 다국어 추가** (`public/locales/*/translation.json`)

```json
{
  "notifications": {
    "types": {
      "new_notification_type": "새 알림 타입"
    }
  }
}
```

**완료!** - 나머지는 자동 동작

---

## 📊 운영 및 모니터링

### 성능 지표 (목표)

| 지표 | 목표 | 측정 방법 |
|-----|------|----------|
| FCM 전송 성공률 | ≥ 98% | Firebase Console + Cloud Logging |
| 알림 오픈율 | ≥ 40% | Custom Analytics |
| 알림 클릭률 | ≥ 20% | Custom Analytics |
| 평균 전송 지연 시간 | < 3초 | Cloud Monitoring |
| 로컬 알림 예약 성공률 | ≥ 99% | Client-side Logging |

### 모니터링 구현

```typescript
// Firebase Analytics 커스텀 이벤트
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/firebase';

// 알림 전송 추적
export const trackNotificationSent = (
  notificationId: string,
  type: NotificationType,
  userId: string
) => {
  logEvent(analytics, 'notification_sent', {
    notification_id: notificationId,
    notification_type: type,
    user_id: userId,
  });
};

// 알림 열람 추적
export const trackNotificationOpened = (
  notificationId: string,
  type: NotificationType
) => {
  logEvent(analytics, 'notification_opened', {
    notification_id: notificationId,
    notification_type: type,
  });
};

// 알림 액션 클릭 추적
export const trackNotificationAction = (
  notificationId: string,
  action: string
) => {
  logEvent(analytics, 'notification_action', {
    notification_id: notificationId,
    action_type: action,
  });
};
```

---

### 보안 및 프라이버시

#### **1. 개인정보 보호**
- **알림 내용**: 민감한 개인정보(주민번호, 계좌번호 등) 절대 포함 금지
- **데이터 암호화**: Firestore 문서 암호화 (민감 데이터)
- **토큰 관리**: FCM 토큰 안전하게 저장 및 주기적 갱신

#### **2. Firestore Security Rules**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 알림 문서: 본인만 읽기 가능
    match /notifications/{notificationId} {
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow write: if false; // Functions에서만 생성
    }

    // 사용자 FCM 토큰: 본인만 수정 가능
    match /users/{userId} {
      allow update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['fcmToken', 'notificationSettings']);
    }
  }
}
```

#### **3. 스팸 방지**
- **속도 제한 (Rate Limiting)**: 동일 유형 알림 5분 내 최대 3회
- **중복 제거 (Deduplication)**: 동일 내용 알림 1분 내 1회만 전송
- **사용자 차단**: 스팸 신고 시 알림 전송 차단

---

## 📚 참고 문서

### 내부 문서
- [구현 로드맵](./NOTIFICATION_IMPLEMENTATION_ROADMAP.md) - 미구현 기능 상세 계획
- [개발 가이드](./DEVELOPMENT_GUIDE.md) - 프로젝트 전체 개발 가이드
- [CLAUDE.md](../CLAUDE.md) - Claude Code 전용 개발 가이드

### Firebase 공식 문서
- [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Functions 트리거](https://firebase.google.com/docs/functions/firestore-events)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)

### Capacitor 공식 문서
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Local Notifications Plugin](https://capacitorjs.com/docs/apis/local-notifications)

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 사항 | 작성자 |
|------|------|----------|--------|
| 1.0.0 | 2025-10-15 | 통합 마스터 문서 초안 작성 (3개 문서 통합) | Claude Code |

---

*마지막 업데이트: 2025년 10월 15일*
*작성자: T-HOLDEM Development Team*
