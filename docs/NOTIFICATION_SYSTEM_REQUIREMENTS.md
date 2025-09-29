# T-HOLDEM 알림 시스템 요구사항 명세서

> T-HOLDEM 구인구직 플랫폼을 위한 종합 알림 시스템 설계 문서

**작성일**: 2025-09-30
**버전**: 1.0.0
**관련 문서**: [CAPACITOR_MIGRATION_GUIDE.md](./CAPACITOR_MIGRATION_GUIDE.md)

---

## 📌 개요

### 프로젝트 배경
T-HOLDEM은 홀덤 포커 토너먼트 운영을 위한 구인구직 플랫폼으로, 고용주와 구직자(딜러/스태프) 간 효율적인 커뮤니케이션을 위해 **실시간 알림 시스템**이 필수적입니다.

### 기술 스택
```yaml
플랫폼: React 18 + TypeScript + Capacitor 7.4.3
알림_인프라:
  - FCM 푸시 알림: @capacitor/push-notifications (v7.0.3)
  - 로컬 알림: @capacitor/local-notifications (v7.0.3)
  - Toast 시스템: 커스텀 구현 (77개 alert() 교체 완료)
백엔드: Firebase Firestore + Firebase Functions
```

### 문서 목적
1. 구인구직 프로세스에서 필요한 **모든 알림 유형** 정의
2. **우선순위** 및 **구현 단계** 명확화
3. **Firestore 데이터 구조** 및 **코드 예제** 제공

---

## 🔧 알림 인프라 현황

### ✅ 구현 완료된 시스템 (Phase 2 완료)

#### 1. **FCM 푸시 알림** (`src/services/notifications.ts`)
```typescript
export const initializePushNotifications = async (userId: string) => {
  // 권한 요청, FCM 토큰 등록, Firestore 저장
  // 플랫폼별 처리 (iOS/Android)
  // Toast 알림 통합, 네비게이션 액션 처리
};
```

**주요 기능**:
- 권한 요청 및 FCM 토큰 관리
- Firestore에 토큰 저장 (`users/{userId}/fcmToken`)
- 알림 수신 리스너 (foreground/background)
- 액션 기반 네비게이션 처리

#### 2. **로컬 알림** (`src/services/localNotifications.ts`)
```typescript
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  scheduledAt: Date,
  data?: Record<string, any>
) => {
  // 예약 알림 스케줄링
  // 웹 브라우저 알림 폴백 처리
};
```

**주요 기능**:
- 즉시 알림 및 예약 알림
- 다양한 알림 유형 지원 (승인 요청, 리마인더, 급여 등)
- 웹 환경 폴백 처리

#### 3. **Toast 시스템** (`src/components/Toast.tsx`)
```typescript
export const showToast = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning' = 'info',
  duration?: number
) => {
  // 앱 내 실시간 알림
  // 77개 alert() → Toast 교체 완료
};
```

**주요 기능**:
- 4가지 유형 (성공, 에러, 정보, 경고)
- 자동 닫힘 (기본 3초)
- 스택형 알림 지원

---

## 📋 알림 유형 상세 명세

### 1️⃣ **구인공고 관련**

#### 📢 **신규 공고 등록 알림**
```yaml
알림_ID: job_post_created
대상_사용자: 관심 지역 구직자들 (추후 토픽 구독 기능)
알림_타입: FCM 푸시 + 로컬 알림
우선순위: 보통 (normal)

제목: "🎯 새로운 홀덤 딜러 구인공고"
내용: |
  📍 {지역명} | 💰 시급 {급여}원
  📅 {근무일} {근무시간}
  지금 바로 지원하세요!

액션:
  type: navigate
  target: /job-postings/{jobPostingId}

트리거:
  Firestore: jobPostings/{id} onCreate
  조건: 공고 상태가 'active'

구현_우선순위: Phase 2 (Enhanced)
```

#### ⏰ **공고 마감 임박 알림**
```yaml
알림_ID: job_post_deadline_approaching
대상_사용자: 고용주 본인
알림_타입: 로컬 알림 (예약)
우선순위: 높음 (high)

제목: "⏰ 공고 마감 임박"
내용: |
  '{공고명}' 마감까지 24시간 남았습니다.
  📊 현재 지원자: {N}명
  지원자를 확인하고 빠르게 결정하세요.

예약_시간: 공고 마감일 - 24시간

액션:
  type: navigate
  target: /applications?jobPostingId={id}

트리거:
  Firebase Functions: Scheduled (Cron Job)
  조건: 마감 24시간 전 && 지원자 존재

구현_우선순위: Phase 2 (Enhanced)
```

---

### 2️⃣ **지원서 관련**

#### 📝 **지원서 제출 알림** (구직자 → 고용주)
```yaml
알림_ID: application_submitted
대상_사용자: 고용주
알림_타입: FCM 푸시 + Toast (앱 실행 중일 경우)
우선순위: 높음 (high)

제목: "📨 새로운 지원서 도착"
내용: |
  👤 {지원자명}님이 '{공고명}'에 지원했습니다.
  ⭐ 경력: {경력} | 📞 연락처: {전화번호}
  지금 확인하고 빠르게 답변하세요!

액션:
  type: navigate
  target: /applications/{applicationId}

트리거:
  Firestore: applications/{id} onCreate
  조건: status === 'pending'

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

#### ✅ **지원 승인 알림** (고용주 → 구직자)
```yaml
알림_ID: application_approved
대상_사용자: 지원자
알림_타입: FCM 푸시 + 로컬 알림
우선순위: 매우 높음 (critical)

제목: "🎉 지원이 승인되었습니다!"
내용: |
  축하합니다! '{공고명}' 지원이 승인되었습니다.
  📅 근무일: {날짜} {시간}
  📍 위치: {장소명} (지도 보기)
  출근 1시간 전 다시 알려드립니다.

액션:
  type: navigate
  target: /job-postings/{jobPostingId}
  buttons:
    - label: "지도 열기"
      action: open_map
    - label: "캘린더 추가"
      action: add_to_calendar

트리거:
  Firestore: applications/{id} onUpdate
  조건: status 변경 (pending → approved)

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

#### ❌ **지원 거절 알림** (고용주 → 구직자)
```yaml
알림_ID: application_rejected
대상_사용자: 지원자
알림_타입: FCM 푸시 (선택적, 사용자 설정)
우선순위: 낮음 (low)

제목: "지원 결과 안내"
내용: |
  😔 '{공고명}' 지원이 불합격 처리되었습니다.
  다른 좋은 기회를 찾아보세요. 화이팅!

액션:
  type: navigate
  target: /job-postings (추천 공고 목록)

트리거:
  Firestore: applications/{id} onUpdate
  조건: status 변경 (pending → rejected)

구현_우선순위: Phase 2 (Enhanced)

참고_사항: |
  사용자 설정에서 '거절 알림 수신' 옵션 추가 필요
  기본값은 수신(true)으로 설정
```

#### ⏳ **지원 검토 대기 알림** (자동 리마인더)
```yaml
알림_ID: application_pending_reminder
대상_사용자: 고용주
알림_타입: 로컬 알림 (예약)
우선순위: 보통 (normal)

제목: "⏳ 미확인 지원서 알림"
내용: |
  검토 대기 중인 지원서가 {N}건 있습니다.
  지원자를 기다리게 하지 마세요!

예약_시간: 지원서 제출 후 24시간

액션:
  type: navigate
  target: /applications?status=pending

트리거:
  Firebase Functions: Scheduled
  조건: 생성 후 24시간 경과 && status === 'pending'

구현_우선순위: Phase 2 (Enhanced)
```

---

### 3️⃣ **근무 확정 관련**

#### 🗓️ **근무 확정 알림** (고용주 → 구직자)
```yaml
알림_ID: work_confirmed
대상_사용자: 승인된 지원자 (staff로 전환됨)
알림_타입: FCM 푸시 + 로컬 알림
우선순위: 매우 높음 (critical)

제목: "✅ 근무가 확정되었습니다!"
내용: |
  📅 {날짜} {시간}
  📍 {장소명}
  🚗 출발 1시간 전 알림을 드립니다.

액션:
  type: navigate
  target: /work-logs/{workLogId}
  buttons:
    - label: "지도 열기"
      action: open_map
    - label: "캘린더 추가"
      action: add_to_calendar

트리거:
  Firestore: staff/{id} onCreate
  또는 workLogs/{id} onCreate

자동_예약: |
  근무 시작 1시간 전 로컬 알림 자동 예약
  근무 시작 15분 전 로컬 알림 자동 예약

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

#### ⏰ **근무 시작 리마인더** (시스템 → 근무자)
```yaml
알림_ID: work_start_reminder
대상_사용자: 근무 예정 스태프
알림_타입: 로컬 알림 (2단계 예약)
우선순위: 매우 높음 (critical)

1단계_알림:
  예약_시간: 근무 시작 - 1시간
  제목: "⏰ 1시간 후 근무 시작"
  내용: |
    📍 {장소명}
    🕐 출근 시간: {시간}
    출발 준비하세요!

2단계_알림:
  예약_시간: 근무 시작 - 15분
  제목: "🚨 곧 출근 시간입니다!"
  내용: |
    15분 후 근무 시작입니다.
    출석 체크를 잊지 마세요!

액션:
  type: navigate
  target: /attendance/check-in

사운드: true
진동: true

트리거:
  근무 확정 시 자동 예약 (work_confirmed 알림 발송 시)

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

---

### 4️⃣ **출석/근무 관련**

#### 📍 **출석 체크 요청** (시스템 → 근무자)
```yaml
알림_ID: attendance_check_in_request
대상_사용자: 근무 시작 시간 도래한 스태프
알림_타입: FCM 푸시 + Toast
우선순위: 매우 높음 (critical)

제목: "✋ 출석 체크를 해주세요!"
내용: |
  🕐 근무 시작 시간입니다.
  QR 코드를 스캔하거나 수동으로 체크하세요.

액션:
  type: navigate
  target: /attendance/check-in
  buttons:
    - label: "QR 스캔"
      action: open_qr_scanner
    - label: "수동 체크"
      action: manual_check_in

트리거:
  Firebase Functions: Scheduled (실시간 모니터링)
  조건: 근무 시작 시간 도래 && attendance 미등록

반복_알림: |
  출석 체크하지 않을 경우 5분마다 알림 재전송 (최대 3회)

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

#### ⚠️ **지각 경고 알림** (시스템 → 고용주)
```yaml
알림_ID: attendance_late_warning
대상_사용자: 고용주
알림_타입: FCM 푸시
우선순위: 높음 (high)

제목: "⚠️ 지각 발생"
내용: |
  👤 {스태프명}님이 아직 출석 체크하지 않았습니다.
  🕐 근무 시작: {시간}
  ⏱️ 현재 지각: {N}분

액션:
  type: navigate
  target: /staff/{staffId}/attendance

트리거:
  Firebase Functions: Scheduled
  조건: 근무 시작 후 15분 경과 && attendance 미등록

구현_우선순위: Phase 2 (Enhanced)
```

#### 🏁 **퇴근 체크 리마인더** (시스템 → 근무자)
```yaml
알림_ID: attendance_check_out_reminder
대상_사용자: 출근 체크한 스태프
알림_타입: 로컬 알림 (예약)
우선순위: 높음 (high)

제목: "🏁 퇴근 체크를 잊지 마세요!"
내용: |
  근무 종료 시간입니다.
  정확한 근무 시간 기록을 위해 퇴근 체크해주세요.

예약_시간: 근무 종료 시간

액션:
  type: navigate
  target: /attendance/check-out

트리거:
  근무 시작 시 자동 예약

구현_우선순위: Phase 1 (Core) ✅ 최우선
```

---

### 5️⃣ **급여 정산 관련**

#### 💰 **급여 계산 완료 알림** (시스템 → 근무자)
```yaml
알림_ID: salary_calculated
대상_사용자: 급여 정산 대상 스태프
알림_타입: FCM 푸시 + 로컬 알림
우선순위: 높음 (high)

제목: "💰 {월}월 급여가 계산되었습니다!"
내용: |
  💸 총 급여: {금액}원
  ⏱️ 근무 시간: {시간}
  📊 근무 일수: {일수}일
  앱에서 상세 내역을 확인하세요.

액션:
  type: navigate
  target: /salary/{salaryId}

트리거:
  Firestore: salaries/{id} onCreate
  또는 Firebase Functions: 급여 계산 완료 시

구현_우선순위: Phase 2 (Enhanced)
```

#### 💸 **급여 지급 완료 알림** (고용주 → 근무자)
```yaml
알림_ID: salary_paid
대상_사용자: 급여 지급 대상 스태프
알림_타입: FCM 푸시
우선순위: 높음 (high)

제목: "✅ 급여가 지급되었습니다!"
내용: |
  💸 지급 금액: {금액}원
  📅 지급일: {날짜}
  수고하셨습니다!

액션:
  type: navigate
  target: /salary/{salaryId}

트리거:
  Firestore: salaries/{id} onUpdate
  조건: status 변경 (calculated → paid)

구현_우선순위: Phase 2 (Enhanced)
```

---

### 6️⃣ **커뮤니케이션 관련**

#### 💬 **채팅 메시지 알림** (사용자 간)
```yaml
알림_ID: chat_message_received
대상_사용자: 메시지 수신자
알림_타입: FCM 푸시
우선순위: 보통 (normal)

제목: "💬 {발신자명}님의 메시지"
내용: "{메시지 미리보기...}"

액션:
  type: navigate
  target: /chats/{chatRoomId}

트리거:
  Firestore: messages/{id} onCreate
  조건: 수신자가 앱을 사용 중이지 않을 때

구현_우선순위: Phase 3 (Advanced)

참고_사항: |
  앱 사용 중일 경우 Toast 알림만 표시
  푸시 알림은 백그라운드/종료 상태일 때만 전송
```

#### 📢 **공지사항 알림** (시스템 → 사용자)
```yaml
알림_ID: announcement
대상_사용자: 전체 또는 특정 그룹 (역할별, 지역별)
알림_타입: FCM 푸시 + 로컬 알림
우선순위: 높음 (high)

제목: "📢 새로운 공지사항"
내용: "{공지 제목}"

액션:
  type: navigate
  target: /announcements/{announcementId}

트리거:
  관리자가 공지사항 발행 시

토픽_구독:
  - all_users (전체 사용자)
  - employers (고용주)
  - staff (스태프)
  - region_seoul (서울 지역)

구현_우선순위: Phase 3 (Advanced)
```

---

## 🔔 알림 우선순위 매트릭스

| 우선순위 | 알림 유형 | 즉시 전송 | 예약 가능 | 사운드 | 진동 | 배지 | 구현 Phase |
|---------|----------|----------|----------|--------|------|------|-----------|
| 🔴 **매우 높음 (critical)** | 지원 승인, 근무 확정, 출석 요청, 근무 리마인더 | ✅ | ✅ | ✅ | ✅ | ✅ | Phase 1 |
| 🟠 **높음 (high)** | 지원서 도착, 급여 계산/지급, 지각 경고, 퇴근 체크 | ✅ | ✅ | ✅ | ❌ | ✅ | Phase 1-2 |
| 🟡 **보통 (normal)** | 신규 공고, 검토 대기 리마인더, 채팅 메시지 | ✅ | ✅ | ❌ | ❌ | ✅ | Phase 2-3 |
| 🟢 **낮음 (low)** | 지원 거절, 일반 정보 | ❌ | ✅ | ❌ | ❌ | ❌ | Phase 2-3 |

### 우선순위별 동작 방식

#### 🔴 매우 높음 (Critical)
- **즉시 전송**: FCM 우선순위 'high' 설정
- **사운드/진동**: 필수 적용
- **배지 카운트**: +1
- **재전송**: 미확인 시 5분마다 최대 3회
- **예**: 지원 승인, 근무 리마인더, 출석 체크

#### 🟠 높음 (High)
- **즉시 전송**: FCM 우선순위 'high' 설정
- **사운드**: 적용, 진동 없음
- **배지 카운트**: +1
- **예**: 지원서 도착, 급여 알림, 지각 경고

#### 🟡 보통 (Normal)
- **즉시 전송**: FCM 우선순위 'normal' 설정
- **사운드/진동**: 없음 (Silent)
- **배지 카운트**: +1
- **예**: 신규 공고, 리마인더, 채팅

#### 🟢 낮음 (Low)
- **예약 전송**: 사용자 활동 시간대에만 전송
- **사운드/진동**: 없음
- **배지 카운트**: 미적용
- **예**: 지원 거절, 일반 정보

---

## 💾 Firestore 데이터 구조

### `notifications` 컬렉션 스키마

```typescript
/**
 * 알림 문서 타입 정의
 *
 * @example
 * /notifications/{notificationId}
 */
interface Notification {
  // 기본 식별자
  id: string;                          // 알림 고유 ID
  userId: string;                      // 수신자 User ID

  // 알림 분류
  type: NotificationType;              // 알림 유형
  category: NotificationCategory;      // 알림 카테고리
  priority: NotificationPriority;      // 우선순위

  // 알림 내용
  title: string;                       // 제목 (최대 50자)
  body: string;                        // 본문 (최대 200자)
  imageUrl?: string;                   // 이미지 URL (선택)

  // 액션 데이터
  action?: NotificationAction;         // 탭 시 실행할 액션

  // 관련 데이터
  relatedId?: string;                  // 관련 문서 ID (jobPostingId, applicationId 등)
  senderId?: string;                   // 발신자 ID (있을 경우)
  metadata?: Record<string, any>;      // 추가 메타데이터

  // 상태 관리
  isRead: boolean;                     // 읽음 여부
  isSent: boolean;                     // FCM 전송 완료 여부
  isLocal: boolean;                    // 로컬 알림 여부

  // 예약 발송
  scheduledAt?: Timestamp;             // 예약 시간 (로컬 알림용)

  // 타임스탬프
  createdAt: Timestamp;                // 생성 시간
  sentAt?: Timestamp;                  // 전송 시간
  readAt?: Timestamp;                  // 읽은 시간

  // 에러 추적
  error?: {
    code: string;
    message: string;
    timestamp: Timestamp;
  };
}

// 알림 유형
type NotificationType =
  // 구인공고
  | 'job_post_created'
  | 'job_post_deadline_approaching'
  // 지원서
  | 'application_submitted'
  | 'application_approved'
  | 'application_rejected'
  | 'application_pending_reminder'
  // 근무
  | 'work_confirmed'
  | 'work_start_reminder'
  // 출석
  | 'attendance_check_in_request'
  | 'attendance_late_warning'
  | 'attendance_check_out_reminder'
  // 급여
  | 'salary_calculated'
  | 'salary_paid'
  // 커뮤니케이션
  | 'chat_message_received'
  | 'announcement';

// 알림 카테고리
type NotificationCategory =
  | 'job_post'        // 구인공고
  | 'application'     // 지원서
  | 'work'            // 근무
  | 'attendance'      // 출석
  | 'salary'          // 급여
  | 'message'         // 메시지
  | 'system';         // 시스템

// 우선순위
type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

// 액션 타입
interface NotificationAction {
  type: 'navigate' | 'open_url' | 'open_map' | 'add_to_calendar' | 'custom';
  target: string;                      // 화면 경로 또는 URL
  params?: Record<string, any>;        // 추가 파라미터
  buttons?: NotificationButton[];      // 액션 버튼 (최대 2개)
}

// 액션 버튼
interface NotificationButton {
  id: string;
  label: string;
  action: string;
  params?: Record<string, any>;
}
```

### Firestore 컬렉션 구조
```
📁 firestore
├── 📄 users/{userId}
│   ├── fcmToken: string              # FCM 토큰
│   ├── notificationSettings: {       # 알림 설정
│   │   enabled: boolean
│   │   types: {                      # 유형별 수신 여부
│   │     job_post: boolean
│   │     application: boolean
│   │     work: boolean
│   │     ...
│   │   }
│   │ }
│   └── ...
│
├── 📁 notifications/{notificationId}  # 알림 문서
│   ├── id, userId, type, title, body
│   ├── priority, isRead, isSent
│   ├── createdAt, sentAt, readAt
│   └── ...
│
└── 📁 notificationLogs/{logId}        # 전송 로그 (디버깅용)
    ├── notificationId
    ├── status: 'success' | 'failed'
    ├── error?: { code, message }
    └── timestamp
```

---

## 🚀 구현 우선순위 및 로드맵

### Phase 1: Core (즉시 구현 - 1-2주)
> **목표**: 구인구직 핵심 프로세스 알림 완성

**구현 항목**:
1. ✅ **지원서 제출 알림** (고용주)
   - Firebase Functions: `onCreate(applications/{id})`
   - FCM 푸시 전송 로직
   - Toast 알림 (앱 실행 중)

2. ✅ **지원 승인/거절 알림** (지원자)
   - Firebase Functions: `onUpdate(applications/{id})`
   - status 변경 감지 (pending → approved/rejected)
   - 액션 버튼 (지도 열기, 캘린더 추가)

3. ✅ **근무 확정 알림** (지원자)
   - Firebase Functions: `onCreate(staff/{id})`
   - 자동 로컬 알림 예약 (1시간 전, 15분 전)

4. ✅ **근무 시작 리마인더** (근무자)
   - 2단계 로컬 알림 (1시간 전, 15분 전)
   - 사운드 + 진동 필수

5. ✅ **출석 체크 요청** (근무자)
   - Firebase Functions: Scheduled (실시간 모니터링)
   - 미체크 시 5분마다 재전송 (최대 3회)

6. ✅ **퇴근 체크 리마인더** (근무자)
   - 로컬 알림 (근무 종료 시간)

**예상 작업량**: 40-60시간
**테스트**: 단위 테스트 + E2E 테스트
**배포**: Staging → Production

---

### Phase 2: Enhanced (안정화 후 - 2-3주)
> **목표**: 사용자 경험 개선 및 리마인더 강화

**구현 항목**:
1. 📅 **공고 마감 임박 알림** (고용주)
   - Cloud Scheduler + Firebase Functions
   - 매시간 마감 24시간 이내 공고 확인

2. 💰 **급여 계산/지급 알림** (근무자)
   - 급여 계산 완료 시 자동 전송
   - 상세 명세서 링크 제공

3. ⚠️ **지각 경고 알림** (고용주)
   - 근무 시작 15분 후 미체크 감지
   - 실시간 알림 전송

4. ⏳ **지원 검토 대기 리마인더** (고용주)
   - 지원서 제출 24시간 후 미확인 건
   - 일일 1회 자동 전송

5. 📢 **신규 공고 등록 알림** (구직자)
   - 토픽 구독 기능 (지역별, 직종별)
   - 관심 설정 기반 푸시

**예상 작업량**: 30-40시간
**테스트**: 통합 테스트 + 부하 테스트
**배포**: A/B 테스트 → Production

---

### Phase 3: Advanced (고도화 - 3-4주)
> **목표**: AI 기반 맞춤형 알림 및 커뮤니케이션 강화

**구현 항목**:
1. 💬 **채팅 메시지 알림**
   - 실시간 메시징 시스템
   - 읽지 않은 메시지 배지

2. 📢 **공지사항 브로드캐스트**
   - 관리자 공지 시스템
   - 역할별, 지역별 타겟팅

3. 🎯 **맞춤형 공고 추천**
   - 머신러닝 기반 추천 알고리즘
   - 사용자 선호도 학습

4. 📊 **알림 분석 대시보드**
   - 알림 오픈율, 클릭률 추적
   - 사용자 참여도 분석

5. 🤖 **스마트 알림 타이밍**
   - 사용자 활동 패턴 분석
   - 최적 발송 시간 자동 조정

**예상 작업량**: 60-80시간
**테스트**: 성능 테스트 + 사용자 피드백
**배포**: 베타 테스트 → Production

---

## 🔧 기술적 구현 가이드

### 1. Firebase Functions 트리거 구현

#### **지원서 제출 알림 예제**
```typescript
// functions/src/notifications/applicationSubmitted.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const onApplicationSubmitted = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    const applicationId = context.params.applicationId;

    // 고용주 정보 조회
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

    // 지원자 정보 조회
    const applicantDoc = await admin.firestore()
      .collection('users')
      .doc(application.applicantId)
      .get();

    const applicant = applicantDoc.data();

    // 알림 문서 생성
    const notification = {
      id: admin.firestore().collection('notifications').doc().id,
      userId: employerId,
      type: 'application_submitted',
      category: 'application',
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

    // Firestore에 알림 저장
    await admin.firestore()
      .collection('notifications')
      .doc(notification.id)
      .set(notification);

    // FCM 토큰 조회
    const employerDoc = await admin.firestore()
      .collection('users')
      .doc(employerId)
      .get();

    const fcmToken = employerDoc.data()?.fcmToken;

    if (!fcmToken) {
      console.warn('FCM 토큰 없음:', employerId);
      return;
    }

    // FCM 푸시 알림 전송
    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId: notification.id,
        type: notification.type,
        target: `/applications/${applicationId}`,
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'application',
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

      // 전송 성공 로그
      await admin.firestore()
        .collection('notifications')
        .doc(notification.id)
        .update({
          isSent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log('알림 전송 성공:', notification.id);
    } catch (error) {
      console.error('알림 전송 실패:', error);

      // 에러 로그
      await admin.firestore()
        .collection('notifications')
        .doc(notification.id)
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

### 2. 로컬 알림 스케줄링

#### **근무 리마인더 예제**
```typescript
// app2/src/services/workNotifications.ts
import { scheduleLocalNotification } from './localNotifications';
import { logger } from '@/utils/logger';

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
        type: 'work_start_reminder',
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
        type: 'work_start_reminder',
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
        type: 'attendance_check_out_reminder',
        workLogId: workLog.id,
        target: '/attendance/check-out',
      }
    );

    logger.info('근무 리마인더 예약 완료', {
      workLogId: workLog.id,
      reminders: ['1h', '15m', 'end'],
    });
  } catch (error) {
    logger.error('근무 리마인더 예약 실패', { error });
    throw error;
  }
};
```

---

### 3. FCM 토픽 구독 (지역별 공고 알림)

#### **토픽 구독 관리**
```typescript
// app2/src/services/topicSubscription.ts
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { logger } from '@/utils/logger';

/**
 * FCM 토픽 구독 관리
 * 지역별, 역할별 브로드캐스트 알림용
 */
export const subscribeToTopics = async (topics: string[]) => {
  if (!Capacitor.isNativePlatform()) {
    logger.warn('웹 환경에서는 토픽 구독 불가');
    return;
  }

  try {
    for (const topic of topics) {
      // 토픽명 정규화 (영문 소문자, 숫자, 하이픈만 허용)
      const normalizedTopic = topic.toLowerCase().replace(/[^a-z0-9-]/g, '_');

      // TODO: Native 플러그인 호출 (Android/iOS)
      // Android: FirebaseMessaging.getInstance().subscribeToTopic(topic)
      // iOS: Messaging.messaging().subscribe(toTopic: topic)

      logger.info('토픽 구독 완료', { topic: normalizedTopic });
    }
  } catch (error) {
    logger.error('토픽 구독 실패', { error, topics });
    throw error;
  }
};

/**
 * 사용자 설정 기반 자동 구독
 */
export const autoSubscribeUserTopics = async (user: User) => {
  const topics: string[] = [];

  // 전체 사용자
  topics.push('all_users');

  // 역할별
  if (user.role === 'employer') {
    topics.push('employers');
  } else if (user.role === 'staff') {
    topics.push('staff');
  }

  // 지역별 (사용자 설정)
  if (user.preferredRegions && user.preferredRegions.length > 0) {
    user.preferredRegions.forEach(region => {
      topics.push(`region_${region}`);
    });
  }

  await subscribeToTopics(topics);
};

/**
 * Firebase Functions에서 토픽 브로드캐스트 예제
 */
// functions/src/notifications/broadcastJobPosting.ts
export const broadcastNewJobPosting = async (
  jobPosting: JobPosting
) => {
  const topic = `region_${jobPosting.location}`;

  const message = {
    topic,
    notification: {
      title: '🎯 새로운 홀덤 딜러 구인공고',
      body: `📍 ${jobPosting.location} | 💰 시급 ${jobPosting.hourlyRate}원`,
    },
    data: {
      type: 'job_post_created',
      jobPostingId: jobPosting.id,
      target: `/job-postings/${jobPosting.id}`,
    },
  };

  await admin.messaging().send(message);
  logger.info('공고 브로드캐스트 완료', { topic, jobPostingId: jobPosting.id });
};
```

---

### 4. 알림 권한 관리 UI

#### **사용자 설정 화면**
```typescript
// app2/src/pages/Settings/NotificationSettings.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { showToast } from '@/components/Toast';

interface NotificationSettings {
  enabled: boolean;
  types: {
    job_post: boolean;
    application: boolean;
    work: boolean;
    attendance: boolean;
    salary: boolean;
    message: boolean;
    system: boolean;
  };
}

export const NotificationSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    enabled: true,
    types: {
      job_post: true,
      application: true,
      work: true,
      attendance: true,
      salary: true,
      message: true,
      system: true,
    },
  });

  useEffect(() => {
    if (user?.notificationSettings) {
      setSettings(user.notificationSettings);
    }
  }, [user]);

  const handleToggle = async (key: keyof NotificationSettings['types']) => {
    const newSettings = {
      ...settings,
      types: {
        ...settings.types,
        [key]: !settings.types[key],
      },
    };

    setSettings(newSettings);

    try {
      await updateDoc(doc(db, 'users', user!.id), {
        notificationSettings: newSettings,
      });

      showToast('알림 설정이 저장되었습니다.', 'success');
    } catch (error) {
      showToast('설정 저장에 실패했습니다.', 'error');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">알림 설정</h1>

      <div className="space-y-4">
        {/* 구인공고 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">구인공고 알림</h3>
            <p className="text-sm text-gray-500">신규 공고 등록 시 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.job_post}
            onChange={() => handleToggle('job_post')}
            className="toggle"
          />
        </div>

        {/* 지원서 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">지원서 알림</h3>
            <p className="text-sm text-gray-500">지원서 제출/승인/거절 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.application}
            onChange={() => handleToggle('application')}
            className="toggle"
          />
        </div>

        {/* 근무 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">근무 알림</h3>
            <p className="text-sm text-gray-500">근무 확정 및 리마인더 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.work}
            onChange={() => handleToggle('work')}
            className="toggle"
          />
        </div>

        {/* 출석 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">출석 알림</h3>
            <p className="text-sm text-gray-500">출퇴근 체크 요청 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.attendance}
            onChange={() => handleToggle('attendance')}
            className="toggle"
          />
        </div>

        {/* 급여 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">급여 알림</h3>
            <p className="text-sm text-gray-500">급여 계산/지급 완료 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.salary}
            onChange={() => handleToggle('salary')}
            className="toggle"
          />
        </div>

        {/* 메시지 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">메시지 알림</h3>
            <p className="text-sm text-gray-500">채팅 메시지 수신 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.message}
            onChange={() => handleToggle('message')}
            className="toggle"
          />
        </div>

        {/* 시스템 알림 */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg">
          <div>
            <h3 className="font-semibold">시스템 알림</h3>
            <p className="text-sm text-gray-500">공지사항 및 중요 알림</p>
          </div>
          <input
            type="checkbox"
            checked={settings.types.system}
            onChange={() => handleToggle('system')}
            className="toggle"
          />
        </div>
      </div>
    </div>
  );
};
```

---

## 📊 성능 및 모니터링

### 알림 성능 지표

| 지표 | 목표 | 측정 방법 |
|-----|------|----------|
| **FCM 전송 성공률** | ≥ 98% | Firebase Console + Cloud Logging |
| **알림 오픈율 (Open Rate)** | ≥ 40% | Custom Analytics |
| **알림 클릭률 (CTR)** | ≥ 20% | Custom Analytics |
| **평균 전송 지연 시간** | < 3초 | Cloud Monitoring |
| **로컬 알림 예약 성공률** | ≥ 99% | Client-side Logging |

### 모니터링 대시보드 구성

```typescript
// Firebase Analytics 커스텀 이벤트
import { logEvent } from 'firebase/analytics';
import { analytics } from '@/firebase';

/**
 * 알림 전송 추적
 */
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

/**
 * 알림 열람 추적
 */
export const trackNotificationOpened = (
  notificationId: string,
  type: NotificationType
) => {
  logEvent(analytics, 'notification_opened', {
    notification_id: notificationId,
    notification_type: type,
  });
};

/**
 * 알림 액션 클릭 추적
 */
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

## 🧪 테스트 전략

### 1. 단위 테스트
```typescript
// __tests__/services/notifications.test.ts
import { scheduleLocalNotification } from '@/services/localNotifications';

describe('로컬 알림 스케줄링', () => {
  it('1시간 후 알림 예약 성공', async () => {
    const scheduledTime = new Date(Date.now() + 60 * 60 * 1000);

    const result = await scheduleLocalNotification(
      '테스트 알림',
      '테스트 내용',
      scheduledTime,
      { notificationId: 'test_1' }
    );

    expect(result).toBeTruthy();
  });

  it('과거 시간 예약 시 에러 발생', async () => {
    const pastTime = new Date(Date.now() - 60 * 60 * 1000);

    await expect(
      scheduleLocalNotification('테스트', '내용', pastTime)
    ).rejects.toThrow();
  });
});
```

### 2. 통합 테스트
```typescript
// __tests__/functions/applicationSubmitted.test.ts
import * as admin from 'firebase-admin';
import * as functionsTest from 'firebase-functions-test';

const test = functionsTest();

describe('지원서 제출 알림 Functions', () => {
  afterAll(() => {
    test.cleanup();
  });

  it('고용주에게 FCM 푸시 전송', async () => {
    const snap = test.firestore.makeDocumentSnapshot(
      {
        eventId: 'job_1',
        applicantId: 'user_1',
        status: 'pending',
      },
      'applications/app_1'
    );

    const wrapped = test.wrap(onApplicationSubmitted);
    await wrapped(snap);

    // Firestore 알림 문서 생성 확인
    const notificationSnap = await admin.firestore()
      .collection('notifications')
      .where('relatedId', '==', 'app_1')
      .get();

    expect(notificationSnap.empty).toBe(false);
  });
});
```

### 3. E2E 테스트 (Playwright)
```typescript
// e2e/notifications.spec.ts
import { test, expect } from '@playwright/test';

test('지원서 제출 후 고용주 알림 수신', async ({ page, context }) => {
  // 1. 구직자 로그인
  await page.goto('/login');
  await page.fill('[name="email"]', 'dealer@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // 2. 공고 지원
  await page.goto('/job-postings');
  await page.click('.job-card:first-child');
  await page.click('button:has-text("지원하기")');

  // 3. 고용주 계정으로 전환
  const employerPage = await context.newPage();
  await employerPage.goto('/login');
  await employerPage.fill('[name="email"]', 'employer@example.com');
  await employerPage.fill('[name="password"]', 'password');
  await employerPage.click('button[type="submit"]');

  // 4. 알림 확인 (Toast 또는 알림 센터)
  await employerPage.waitForSelector('.toast:has-text("새로운 지원서")');

  const notificationText = await employerPage.textContent('.toast');
  expect(notificationText).toContain('지원했습니다');
});
```

---

## 🔐 보안 및 프라이버시

### 1. 개인정보 보호
- **알림 내용**: 민감한 개인정보(주민번호, 계좌번호 등) 절대 포함 금지
- **데이터 암호화**: Firestore 문서 암호화 (민감 데이터)
- **토큰 관리**: FCM 토큰 안전하게 저장 및 주기적 갱신

### 2. 권한 관리
```typescript
// Firestore Security Rules
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

### 3. 스팸 방지
- **속도 제한 (Rate Limiting)**: 동일 유형 알림 5분 내 최대 3회
- **중복 제거 (Deduplication)**: 동일 내용 알림 1분 내 1회만 전송
- **사용자 차단**: 스팸 신고 시 알림 전송 차단

---

## 📚 참고 자료

### Firebase 공식 문서
- [Firebase Cloud Messaging (FCM)](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Functions 트리거](https://firebase.google.com/docs/functions/firestore-events)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs)

### Capacitor 공식 문서
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Local Notifications Plugin](https://capacitorjs.com/docs/apis/local-notifications)

### 관련 프로젝트 문서
- [CAPACITOR_MIGRATION_GUIDE.md](./CAPACITOR_MIGRATION_GUIDE.md) - Phase 2 완료 (알림 인프라 구축)
- [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md) - 개발 가이드

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 사항 | 작성자 |
|------|------|----------|--------|
| 1.0.0 | 2025-09-30 | 초안 작성 | T-HOLDEM Team |

---

## 🤝 기여 가이드

이 문서는 T-HOLDEM 개발팀의 공동 작업 산물입니다.

**문서 수정 시**:
1. 변경 이력에 버전 및 변경 사항 기록
2. 관련 개발자에게 리뷰 요청
3. 최종 승인 후 커밋

**질문 및 피드백**:
- GitHub Issues에 등록
- 팀 Slack 채널 #t-holdem-dev

---

*마지막 업데이트: 2025년 9월 30일*
*작성자: T-HOLDEM Development Team*