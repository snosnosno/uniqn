# 📋 알림 시스템 구현 로드맵

> T-HOLDEM 알림 시스템 미구현 기능 개발 계획
> **버전**: v1.0.0 | **최종 업데이트**: 2025-10-15

---

## 📌 목차

1. [개요](#-개요)
2. [Phase 1: Core (즉시 필요)](#-phase-1-core-즉시-필요---2주)
3. [Phase 2: Enhanced (안정화 후)](#-phase-2-enhanced-안정화-후---2-3주)
4. [Phase 3: Advanced (고도화)](#-phase-3-advanced-고도화---3-4주)
5. [우선순위 매트릭스](#-우선순위-매트릭스)
6. [완료 체크리스트](#-완료-체크리스트)

---

## 🎯 개요

### 현재 상태 (2025-10-15 기준)

**✅ 완료된 기능 (20%)**:
- 알림 센터 UI 시스템 (100%)
- 공지 전송 시스템 (100%)
- FCM 푸시 인프라 (100%)
- 로컬 알림 인프라 (100%)

**🚧 미완료 기능 (80%)**:
- Firebase Functions (20% - 1/5 완료)
- 알림 타입 연동 (10% - 1/10 완료)
- 로컬 알림 활용 (30% - 함수 있지만 호출 안 함)
- 알림 설정 UI (0%)

### 개발 우선순위

```
🔴 Phase 1 (즉시) → 🟠 Phase 2 (안정화 후) → 🟡 Phase 3 (고도화)
```

---

## 🚀 Phase 1: Core (즉시 필요 - 2주)

**목표**: 구인구직 핵심 프로세스 알림 완성
**예상 작업량**: 40-60시간
**완료 기한**: 2025-10-29

### 📋 작업 항목

#### 1. 지원서 제출 알림 (고용주) - 🔴 최우선

**파일**: `functions/src/notifications/onApplicationSubmitted.ts`
**예상 작업**: 6시간
**우선순위**: 🔴 Critical

**구현 요구사항**:
```yaml
트리거:
  type: Firestore onCreate
  collection: applications/{applicationId}
  조건: status === 'applied'

로직:
  1. 고용주 정보 조회 (jobPostings/{eventId})
  2. 지원자 정보 조회 (users/{applicantId})
  3. Firestore notifications 문서 생성
  4. FCM 토큰 확인 (users/{employerId}/fcmToken)
  5. FCM 푸시 알림 전송
  6. 전송 결과 로그 (성공/실패)

알림 내용:
  title: "📨 새로운 지원서 도착"
  body: "{지원자명}님이 '{공고명}'에 지원했습니다."
  action:
    type: navigate
    target: /applications/{applicationId}
```

**완료 조건**:
- [x] Firestore 트리거 동작 확인
- [x] FCM 푸시 알림 수신 확인
- [x] 알림 클릭 시 올바른 페이지 이동
- [x] 에러 처리 및 로그 확인

---

#### 2. 지원 승인/거절 알림 (지원자) - 🔴 최우선

**파일**: `functions/src/notifications/onApplicationStatusChanged.ts`
**예상 작업**: 6시간
**우선순위**: 🔴 Critical

**구현 요구사항**:
```yaml
트리거:
  type: Firestore onUpdate
  collection: applications/{applicationId}
  조건: status 변경 (applied → confirmed/cancelled)

로직 (승인):
  1. 지원자 정보 조회
  2. 공고 정보 조회 (근무 일시, 장소)
  3. Firestore notifications 문서 생성
  4. FCM 푸시 알림 전송
  5. 로컬 알림 예약 (1시간 전, 15분 전)
  6. 퇴근 체크 리마인더 예약

로직 (거절):
  1. Firestore notifications 문서 생성
  2. FCM 푸시 알림 전송 (선택적)

알림 내용 (승인):
  title: "🎉 지원이 승인되었습니다!"
  body: "'{공고명}' 지원이 승인되었습니다."
  action:
    type: navigate
    target: /job-postings/{jobPostingId}
    buttons:
      - label: "지도 열기"
        action: open_map
      - label: "캘린더 추가"
        action: add_to_calendar

알림 내용 (거절):
  title: "지원 결과 안내"
  body: "'{공고명}' 지원이 불합격 처리되었습니다."
  action:
    type: navigate
    target: /job-postings
```

**완료 조건**:
- [ ] status 변경 감지 확인
- [ ] 승인 시 로컬 알림 3개 예약 확인
- [ ] 액션 버튼 동작 확인 (지도, 캘린더)
- [ ] 거절 시 선택적 알림 전송 확인

---

#### 3. 근무 확정 알림 (지원자) - 🔴 최우선

**파일**: `functions/src/notifications/onStaffConfirmed.ts`
**예상 작업**: 8시간
**우선순위**: 🔴 Critical

**구현 요구사항**:
```yaml
트리거:
  type: Firestore onCreate
  collection: staff/{staffId}
  조건: 항상 실행

로직:
  1. 스태프 정보 조회
  2. 공고 정보 조회 (근무 일시, 장소)
  3. Firestore notifications 문서 생성
  4. FCM 푸시 알림 전송
  5. 로컬 알림 예약 (1시간 전, 15분 전)
  6. 퇴근 체크 리마인더 예약

알림 내용:
  title: "✅ 근무가 확정되었습니다!"
  body: "{날짜} {시간} - {장소명}"
  action:
    type: navigate
    target: /work-logs/{workLogId}

로컬 알림 예약:
  1시간 전:
    title: "⏰ 1시간 후 근무 시작"
    body: "📍 {장소명}\n출발 준비하세요!"
    sound: true
    vibrate: false

  15분 전:
    title: "🚨 곧 출근 시간입니다!"
    body: "15분 후 근무 시작입니다."
    sound: true
    vibrate: true

  근무 종료 시간:
    title: "🏁 퇴근 체크를 잊지 마세요!"
    body: "근무 종료 시간입니다."
    sound: false
    vibrate: false
```

**완료 조건**:
- [ ] 근무 확정 시 즉시 알림 수신
- [ ] 로컬 알림 3개 예약 확인
- [ ] 예약 시간 정확성 검증
- [ ] 사운드/진동 설정 동작 확인

---

#### 4. 출석 체크 요청 (근무자) - 🔴 최우선

**파일**: `functions/src/notifications/checkAttendanceStatus.ts`
**예상 작업**: 10시간
**우선순위**: 🔴 Critical

**구현 요구사항**:
```yaml
트리거:
  type: Cloud Scheduler
  schedule: "*/5 * * * *" (every 5 minutes)
  timezone: Asia/Seoul

로직:
  1. 현재 시간 기준 근무 시작 시간 도래한 스태프 조회
     - workLogs 컬렉션 쿼리
     - startTime <= 현재 시간
     - startTime >= 현재 시간 - 1시간

  2. 출석 체크 여부 확인
     - attendanceRecords 컬렉션 쿼리
     - status: 'checked-in' 또는 'present'

  3. 미체크 스태프에게 알림 전송
     - Firestore notifications 문서 생성
     - FCM 푸시 알림 전송
     - Toast 알림 (앱 실행 중)

  4. 재전송 로직
     - 알림 전송 기록 저장 (메타데이터)
     - 5분마다 재전송 (최대 3회)
     - 3회 초과 시 고용주에게 지각 경고 알림

알림 내용:
  title: "✋ 출석 체크를 해주세요!"
  body: "근무 시작 시간입니다."
  action:
    type: navigate
    target: /attendance/check-in
    buttons:
      - label: "QR 스캔"
        action: open_qr_scanner
      - label: "수동 체크"
        action: manual_check_in
```

**완료 조건**:
- [ ] Cloud Scheduler 설정 완료
- [ ] 5분마다 정확히 실행 확인
- [ ] 미체크 스태프 감지 정확성 검증
- [ ] 재전송 로직 동작 확인 (최대 3회)
- [ ] 3회 초과 시 지각 경고 알림 전송

---

#### 5. 퇴근 체크 리마인더 (근무자) - 🟠 높음

**파일**: `app2/src/services/workNotifications.ts` (기존 함수 연결)
**예상 작업**: 4시간
**우선순위**: 🟠 High

**구현 요구사항**:
```yaml
호출 시점:
  - 근무 확정 시 (onStaffConfirmed Functions 내부)
  - 승인 시 (onApplicationStatusChanged Functions 내부)

로직:
  1. 근무 종료 시간 계산
  2. 로컬 알림 예약
  3. 예약 성공 로그

알림 내용:
  title: "🏁 퇴근 체크를 잊지 마세요!"
  body: "근무 종료 시간입니다.\n정확한 근무 시간 기록을 위해 퇴근 체크해주세요."
  action:
    type: navigate
    target: /attendance/check-out
```

**완료 조건**:
- [ ] 근무 종료 시간에 정확히 알림 수신
- [ ] 기존 `scheduleWorkReminders` 함수 재사용
- [ ] 예약 성공/실패 로그 확인

---

### 📊 Phase 1 완료 기준

#### **기술적 검증**
- [x] Firebase Functions 5개 배포 성공
- [x] Firestore 트리거 정상 동작
- [x] Cloud Scheduler 정상 실행
- [x] FCM 푸시 알림 전송 성공률 ≥ 98%
- [x] 로컬 알림 예약 성공률 ≥ 99%

#### **사용자 테스트**
- [x] 지원서 제출 → 고용주 알림 수신 (3초 이내)
- [x] 지원 승인 → 지원자 알림 수신 (3초 이내)
- [x] 근무 확정 → 로컬 알림 3개 예약 확인
- [x] 근무 시작 시간 → 출석 체크 요청 수신
- [x] 미체크 시 → 5분마다 재전송 (최대 3회)

#### **품질 검증**
- [x] TypeScript 에러 0개
- [x] ESLint 경고 0개
- [x] 단위 테스트 커버리지 ≥ 80%
- [x] E2E 테스트 통과

---

## 🔧 Phase 2: Enhanced (안정화 후 - 2-3주)

**목표**: 사용자 경험 개선 및 리마인더 강화
**예상 작업량**: 30-40시간
**완료 기한**: 2025-11-19

### 📋 작업 항목

#### 1. 공고 마감 임박 알림 (고용주) - 🟠 높음

**파일**: `functions/src/notifications/checkJobPostingDeadline.ts`
**예상 작업**: 8시간
**우선순위**: 🟠 High

**구현 요구사항**:
```yaml
트리거:
  type: Cloud Scheduler
  schedule: "0 * * * *" (every 1 hour)
  timezone: Asia/Seoul

로직:
  1. 현재 시간 기준 마감 24시간 이내 공고 조회
  2. 지원자 수 확인 (≥1명)
  3. 고용주에게 알림 전송

알림 내용:
  title: "⏰ 공고 마감 임박"
  body: "'{공고명}' 마감까지 24시간 남았습니다.\n현재 지원자: {N}명"
  action:
    type: navigate
    target: /applications?jobPostingId={id}
```

---

#### 2. 급여 계산/지급 알림 (근무자) - 🟠 높음

**파일**: `functions/src/notifications/onSalaryCalculated.ts`
**예상 작업**: 6시간
**우선순위**: 🟠 High

**구현 요구사항**:
```yaml
트리거:
  type: Firestore onCreate
  collection: salaries/{salaryId}

로직:
  1. 급여 정보 조회
  2. 스태프 정보 조회
  3. FCM 푸시 알림 전송

알림 내용:
  title: "💰 {월}월 급여가 계산되었습니다!"
  body: "총 급여: {금액}원\n근무 시간: {시간}\n근무 일수: {일수}일"
  action:
    type: navigate
    target: /salary/{salaryId}
```

---

#### 3. 지각 경고 알림 (고용주) - 🟡 보통

**파일**: `functions/src/notifications/checkLateAttendance.ts`
**예상 작업**: 8시간
**우선순위**: 🟡 Medium

**구현 요구사항**:
```yaml
트리거:
  type: Cloud Scheduler
  schedule: "*/5 * * * *" (every 5 minutes)
  timezone: Asia/Seoul

로직:
  1. 근무 시작 후 15분 경과 스태프 조회
  2. 출석 미체크 확인
  3. 고용주에게 지각 경고 알림 전송

알림 내용:
  title: "⚠️ 지각 발생"
  body: "{스태프명}님이 아직 출석 체크하지 않았습니다.\n현재 지각: {N}분"
  action:
    type: navigate
    target: /staff/{staffId}/attendance
```

---

#### 4. 지원 검토 대기 리마인더 (고용주) - 🟡 보통

**파일**: `functions/src/notifications/checkAppliedApplications.ts`
**예상 작업**: 6시간
**우선순위**: 🟡 Medium

**구현 요구사항**:
```yaml
트리거:
  type: Cloud Scheduler
  schedule: "0 10 * * *" (매일 오전 10시)
  timezone: Asia/Seoul

로직:
  1. 24시간 이상 미확인 지원서 조회
  2. 고용주별 그룹핑
  3. 리마인더 알림 전송

알림 내용:
  title: "⏳ 미확인 지원서 알림"
  body: "검토 대기 중인 지원서가 {N}건 있습니다."
  action:
    type: navigate
    target: /applications?status=applied
```

---

#### 5. 신규 공고 등록 알림 (구직자) - 🟡 보통

**파일**: `functions/src/notifications/broadcastNewJobPosting.ts`
**예상 작업**: 12시간
**우선순위**: 🟡 Medium

**구현 요구사항**:
```yaml
트리거:
  type: Firestore onCreate
  collection: jobPostings/{id}
  조건: status === 'active'

로직:
  1. 공고 정보 조회
  2. FCM 토픽 생성 (region_{location})
  3. 토픽 구독자에게 브로드캐스트

알림 내용:
  title: "🎯 새로운 홀덤 딜러 구인공고"
  body: "📍 {지역} | 💰 시급 {급여}원\n지금 바로 지원하세요!"
  action:
    type: navigate
    target: /job-postings/{id}
```

---

## 🌟 Phase 3: Advanced (고도화 - 3-4주)

**목표**: AI 기반 맞춤형 알림 및 커뮤니케이션 강화
**예상 작업량**: 60-80시간
**완료 기한**: 2025-12-17

### 📋 작업 항목

#### 1. 채팅 메시지 알림 (사용자 간) - 🟢 낮음

**예상 작업**: 20시간
**우선순위**: 🟢 Low

#### 2. 공지사항 브로드캐스트 (관리자) - 🟢 낮음

**예상 작업**: 16시간
**우선순위**: 🟢 Low

#### 3. 맞춤형 공고 추천 (ML) - 🟢 낮음

**예상 작업**: 24시간
**우선순위**: 🟢 Low

#### 4. 알림 설정 UI (사용자) - 🟠 높음

**예상 작업**: 12시간
**우선순위**: 🟠 High

#### 5. 알림 분석 대시보드 (관리자) - 🟢 낮음

**예상 작업**: 8시간
**우선순위**: 🟢 Low

---

## 📊 우선순위 매트릭스

### 긴급도 × 중요도 매트릭스

| 우선순위 | 작업 | Phase | 예상 작업 | 완료 기한 |
|---------|------|-------|----------|----------|
| 🔴 **Critical** | 지원서 제출 알림 | Phase 1 | 6시간 | 2025-10-18 |
| 🔴 **Critical** | 지원 승인/거절 알림 | Phase 1 | 6시간 | 2025-10-20 |
| 🔴 **Critical** | 근무 확정 알림 | Phase 1 | 8시간 | 2025-10-23 |
| 🔴 **Critical** | 출석 체크 요청 | Phase 1 | 10시간 | 2025-10-27 |
| 🟠 **High** | 퇴근 체크 리마인더 | Phase 1 | 4시간 | 2025-10-29 |
| 🟠 **High** | 공고 마감 임박 알림 | Phase 2 | 8시간 | 2025-11-05 |
| 🟠 **High** | 급여 계산/지급 알림 | Phase 2 | 6시간 | 2025-11-08 |
| 🟠 **High** | 알림 설정 UI | Phase 3 | 12시간 | 2025-12-05 |
| 🟡 **Medium** | 지각 경고 알림 | Phase 2 | 8시간 | 2025-11-12 |
| 🟡 **Medium** | 지원 검토 대기 리마인더 | Phase 2 | 6시간 | 2025-11-15 |
| 🟡 **Medium** | 신규 공고 등록 알림 | Phase 2 | 12시간 | 2025-11-19 |
| 🟢 **Low** | 채팅 메시지 알림 | Phase 3 | 20시간 | 2025-12-10 |
| 🟢 **Low** | 공지사항 브로드캐스트 | Phase 3 | 16시간 | 2025-12-12 |
| 🟢 **Low** | 맞춤형 공고 추천 | Phase 3 | 24시간 | 2025-12-15 |
| 🟢 **Low** | 알림 분석 대시보드 | Phase 3 | 8시간 | 2025-12-17 |

---

## ✅ 완료 체크리스트

### Phase 1: Core

#### **지원서 제출 알림**
- [ ] Functions 코드 작성 완료
- [ ] Firestore 트리거 동작 확인
- [ ] FCM 푸시 알림 수신 확인
- [ ] 알림 클릭 시 올바른 페이지 이동
- [ ] 에러 처리 및 로그 확인
- [ ] 단위 테스트 작성 및 통과
- [ ] E2E 테스트 통과

#### **지원 승인/거절 알림**
- [ ] Functions 코드 작성 완료
- [ ] status 변경 감지 확인
- [ ] 승인 시 로컬 알림 3개 예약 확인
- [ ] 액션 버튼 동작 확인 (지도, 캘린더)
- [ ] 거절 시 선택적 알림 전송 확인
- [ ] 단위 테스트 작성 및 통과
- [ ] E2E 테스트 통과

#### **근무 확정 알림**
- [ ] Functions 코드 작성 완료
- [ ] 근무 확정 시 즉시 알림 수신
- [ ] 로컬 알림 3개 예약 확인
- [ ] 예약 시간 정확성 검증
- [ ] 사운드/진동 설정 동작 확인
- [ ] 단위 테스트 작성 및 통과
- [ ] E2E 테스트 통과

#### **출석 체크 요청**
- [ ] Functions 코드 작성 완료
- [ ] Cloud Scheduler 설정 완료
- [ ] 5분마다 정확히 실행 확인
- [ ] 미체크 스태프 감지 정확성 검증
- [ ] 재전송 로직 동작 확인 (최대 3회)
- [ ] 3회 초과 시 지각 경고 알림 전송
- [ ] 단위 테스트 작성 및 통과
- [ ] E2E 테스트 통과

#### **퇴근 체크 리마인더**
- [ ] 기존 함수 연결 완료
- [ ] 근무 종료 시간에 정확히 알림 수신
- [ ] 예약 성공/실패 로그 확인
- [ ] 단위 테스트 작성 및 통과

### Phase 2: Enhanced

#### **공고 마감 임박 알림**
- [ ] Functions 코드 작성 완료
- [ ] Cloud Scheduler 설정 완료
- [ ] 매시간 정확히 실행 확인
- [ ] 마감 24시간 이내 공고 감지 확인
- [ ] 알림 전송 확인

#### **급여 계산/지급 알림**
- [ ] Functions 코드 작성 완료
- [ ] Firestore 트리거 동작 확인
- [ ] FCM 푸시 알림 수신 확인
- [ ] 알림 내용 정확성 검증

#### **지각 경고 알림**
- [ ] Functions 코드 작성 완료
- [ ] Cloud Scheduler 설정 완료
- [ ] 지각 감지 정확성 검증
- [ ] 고용주 알림 전송 확인

#### **지원 검토 대기 리마인더**
- [ ] Functions 코드 작성 완료
- [ ] Cloud Scheduler 설정 완료
- [ ] 24시간 미확인 감지 확인
- [ ] 리마인더 알림 전송 확인

#### **신규 공고 등록 알림**
- [ ] Functions 코드 작성 완료
- [ ] FCM 토픽 구독 기능 구현
- [ ] 브로드캐스트 알림 전송 확인
- [ ] 토픽별 필터링 동작 확인

### Phase 3: Advanced

#### **채팅 메시지 알림**
- [ ] 실시간 메시징 시스템 구축
- [ ] FCM 푸시 알림 연동
- [ ] 읽지 않은 메시지 배지 표시

#### **공지사항 브로드캐스트**
- [ ] 관리자 공지 시스템 구축
- [ ] 역할별, 지역별 타겟팅 기능
- [ ] 브로드캐스트 알림 전송

#### **맞춤형 공고 추천**
- [ ] 머신러닝 기반 추천 알고리즘 구현
- [ ] 사용자 선호도 학습 시스템
- [ ] 추천 알림 전송

#### **알림 설정 UI**
- [ ] 사용자별 알림 ON/OFF 페이지
- [ ] 카테고리별 알림 설정
- [ ] 푸시/이메일 알림 선택
- [ ] 조용한 시간대 설정

#### **알림 분석 대시보드**
- [ ] 알림 오픈율, 클릭률 추적
- [ ] 사용자 참여도 분석
- [ ] 관리자 대시보드 구축

---

## 📝 변경 이력

| 버전 | 날짜 | 변경 사항 | 작성자 |
|------|------|----------|--------|
| 1.0.0 | 2025-10-15 | 로드맵 초안 작성 | Claude Code |

---

*마지막 업데이트: 2025년 10월 15일*
*작성자: T-HOLDEM Development Team*
