# 알림 시스템 운영 가이드

**최종 업데이트**: 2025년 11월 27일
**버전**: v0.2.4 (Production Ready + 구인공고 4타입)
**상태**: ✅ **Production Ready**

> 📚 **관련 문서**:
> - 📋 **기능 명세**: [NOTIFICATION_IMPLEMENTATION_STATUS.md](../features/NOTIFICATION_IMPLEMENTATION_STATUS.md)
> - 🔧 **API 참조**: [API_REFERENCE.md](../reference/API_REFERENCE.md)

---

## 📋 목차

1. [알림 시스템 개요](#-알림-시스템-개요)
2. [알림 타입 및 트리거](#-알림-타입-및-트리거)
3. [사용자 알림 설정](#-사용자-알림-설정)
4. [Firebase Functions 관리](#-firebase-functions-관리)
5. [모니터링 및 대시보드](#-모니터링-및-대시보드)
6. [문제 해결](#-문제-해결)
7. [운영 체크리스트](#-운영-체크리스트)

---

## 🔔 알림 시스템 개요

### 아키텍처

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  User Action     │ ──▶ │  Firestore       │ ──▶ │  Cloud Function  │
│  (지원, 배정 등)  │     │  (onWrite 트리거) │     │  (알림 생성)      │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  React App       │ ◀── │  notifications   │
                         │  (onSnapshot)    │     │  컬렉션           │
                         └──────────────────┘     └──────────────────┘
```

### 핵심 컬렉션

```typescript
// Firestore 경로
users/{userId}/notifications/{notificationId}

// 알림 스키마
interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Timestamp;
  data?: Record<string, unknown>;  // 추가 데이터
  actionUrl?: string;              // 클릭 시 이동 URL
}
```

---

## 📨 알림 타입 및 트리거

### 시스템 알림 (system)

| 알림 | 트리거 | 대상 | 함수명 |
|------|--------|------|--------|
| 시스템 점검 공지 | 관리자 수동 | 전체 사용자 | `sendSystemNotification` |
| 업데이트 알림 | 관리자 수동 | 전체 사용자 | `sendSystemNotification` |

### 근무 알림 (work)

| 알림 | 트리거 | 대상 | 함수명 |
|------|--------|------|--------|
| 근무 배정 알림 | staff 문서 업데이트 | 해당 스태프 | `sendWorkAssignmentNotification` |
| 근무 취소 알림 | staff 문서 삭제 | 해당 스태프 | `sendWorkCancellationNotification` |

### 일정 알림 (schedule)

| 알림 | 트리거 | 대상 | 함수명 |
|------|--------|------|--------|
| 일정 변경 알림 | event 문서 업데이트 | 배정된 스태프 | `sendScheduleChangeNotification` |
| 일정 리마인더 | Cloud Scheduler (D-1) | 배정된 스태프 | `sendScheduleReminderNotification` |

### 지원 알림 (application)

| 알림 | 트리거 | 대상 | 함수명 |
|------|--------|------|--------|
| 지원 상태 변경 | application.status 변경 | 지원자 | `sendApplicationStatusNotification` |
| 공고 공지 발송 | 관리자 수동 | 지원자 전체 | `sendJobPostingAnnouncement` |

---

## ⚙️ 사용자 알림 설정

### 설정 스키마

```typescript
// users/{userId}/settings/notifications
interface NotificationSettings {
  // 채널별 ON/OFF
  email: boolean;       // 이메일 알림
  push: boolean;        // 푸시 알림
  inApp: boolean;       // 인앱 알림 (항상 true)

  // 타입별 ON/OFF
  system: boolean;      // 시스템 공지
  work: boolean;        // 근무 관련
  schedule: boolean;    // 일정 관련
  finance: boolean;     // 급여/정산

  // 조용한 시간대
  quietHours: {
    enabled: boolean;
    start: string;      // "22:00"
    end: string;        // "08:00"
  };
}
```

### 기본값

```typescript
const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email: true,
  push: true,
  inApp: true,
  system: true,
  work: true,
  schedule: true,
  finance: true,
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00"
  }
};
```

### 설정 변경 API

```typescript
// 사용자 설정 업데이트
await updateDoc(doc(db, 'users', userId, 'settings', 'notifications'), {
  work: false,  // 근무 알림 OFF
});
```

---

## 🔧 Firebase Functions 관리

### 배포된 함수 목록

```bash
# 함수 목록 확인
firebase functions:list

# 출력 예시
┌───────────────────────────────────────┬─────────┬───────────────┐
│ Function                               │ Trigger │ Region        │
├───────────────────────────────────────┼─────────┼───────────────┤
│ sendWorkAssignmentNotification         │ onWrite │ asia-northeast3│
│ sendApplicationStatusNotification      │ onUpdate│ asia-northeast3│
│ sendScheduleChangeNotification         │ onUpdate│ asia-northeast3│
│ sendScheduleReminderNotification       │ pubsub  │ asia-northeast3│
│ sendJobPostingAnnouncement            │ onCall  │ asia-northeast3│
└───────────────────────────────────────┴─────────┴───────────────┘
```

### 함수 로그 확인

```bash
# 실시간 로그 (모든 알림 함수)
firebase functions:log --only sendWorkAssignmentNotification,sendApplicationStatusNotification

# 최근 100개 로그
firebase functions:log --limit 100

# 에러만 필터링
firebase functions:log | grep "ERROR"
```

### 함수 재배포

```bash
# 특정 함수만 배포
firebase deploy --only functions:sendWorkAssignmentNotification

# 모든 알림 함수 배포
firebase deploy --only functions
```

---

## 📊 모니터링 및 대시보드

### Firebase Console 확인 항목

1. **Functions > 대시보드**
   - 호출 횟수 (invocations)
   - 에러율 (error rate)
   - 실행 시간 (execution time)

2. **Firestore > 사용량**
   - notifications 컬렉션 문서 수
   - 읽기/쓰기 횟수

### 주요 모니터링 지표

| 지표 | 정상 범위 | 경고 임계값 |
|------|----------|------------|
| 함수 에러율 | < 1% | > 5% |
| 함수 실행 시간 | < 1000ms | > 5000ms |
| 일일 알림 발송 수 | 100-1000 | > 10000 |
| 미읽음 알림 비율 | < 50% | > 80% |

### 알림 통계 쿼리

```typescript
// 최근 7일 알림 발송 통계
const stats = await getDocs(
  query(
    collectionGroup(db, 'notifications'),
    where('createdAt', '>=', sevenDaysAgo),
    orderBy('createdAt', 'desc')
  )
);

// 타입별 집계
const byType = stats.docs.reduce((acc, doc) => {
  const type = doc.data().type;
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {});
```

---

## 🔥 문제 해결

### 일반적인 문제

#### 1. 알림이 생성되지 않음

**증상**: 트리거 액션 후 알림이 나타나지 않음

**진단 단계**:
```bash
# 1. 함수 로그 확인
firebase functions:log --only sendWorkAssignmentNotification

# 2. Firestore 직접 확인
# Firebase Console > Firestore > users/{userId}/notifications
```

**해결 방법**:
- 함수가 배포되었는지 확인
- 트리거 조건이 맞는지 확인 (onWrite vs onUpdate)
- userId가 올바른지 확인

#### 2. 알림이 중복 발송됨

**원인**: 함수 재시도 또는 중복 트리거

**해결 방법**:
```typescript
// 멱등성 보장 코드 추가
const notificationRef = doc(db, 'users', userId, 'notifications', uniqueId);
const existing = await getDoc(notificationRef);
if (existing.exists()) {
  logger.info('알림 이미 존재, 스킵');
  return;
}
```

#### 3. 실시간 구독이 작동하지 않음

**증상**: 새 알림이 UI에 즉시 반영되지 않음

**진단 단계**:
```typescript
// 브라우저 콘솔에서 확인
console.log('onSnapshot 연결 상태:', snapshot.metadata.fromCache);
```

**해결 방법**:
- 네트워크 연결 상태 확인
- Firestore Security Rules 확인
- 구독 해제 후 재구독

### 긴급 대응

#### 알림 폭주 시

```bash
# 1. 함수 일시 비활성화
firebase functions:delete sendWorkAssignmentNotification --force

# 2. 원인 파악 후 수정

# 3. 함수 재배포
firebase deploy --only functions:sendWorkAssignmentNotification
```

#### 대량 알림 삭제

```typescript
// Admin SDK로 대량 삭제
const batch = db.batch();
const notifications = await getDocs(
  query(
    collection(db, 'users', userId, 'notifications'),
    where('createdAt', '<', cutoffDate),
    limit(500)
  )
);
notifications.forEach(doc => batch.delete(doc.ref));
await batch.commit();
```

---

## ✅ 운영 체크리스트

### 일일 점검

- [ ] Firebase Functions 대시보드 에러율 확인
- [ ] 알림 발송 수 이상 여부 확인

### 주간 점검

- [ ] 미읽음 알림 비율 확인 (80% 초과 시 UX 개선 필요)
- [ ] 함수 실행 시간 추이 확인
- [ ] 사용자 피드백 검토

### 월간 점검

- [ ] 오래된 알림 정리 (90일 이상)
- [ ] 알림 타입별 발송 통계 분석
- [ ] 사용자 설정 기본값 검토

### 배포 전 점검

- [ ] 스테이징 환경에서 알림 발송 테스트
- [ ] Security Rules 변경 시 영향도 확인
- [ ] 함수 타임아웃 설정 확인 (기본: 60초)

---

## 📝 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2025-11-27 | 1.0.0 | 초기 문서 작성 |

---

*작성자: Claude (Sonnet 4.5)*
*최종 검토: 2025년 11월 27일*
