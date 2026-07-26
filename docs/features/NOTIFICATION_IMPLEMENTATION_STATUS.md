> 최종 검증: 2026-07-05 (문서 대수술 — 5파일 동일 복제본 해체)

# 알림 시스템 구현 상태

**최종 업데이트**: 2026-04-18
**버전**: v1.0.0 (모바일앱 중심 / Supabase 기반)
**문서 버전**: 3.1.0

> **모바일앱 알림**: uniqn-mobile/은 FCM(APNs) + expo-notifications를 통해 푸시 알림을 지원합니다. 서버 측은 Supabase Edge Functions + PostgreSQL 트리거 기반입니다.
>
> 📚 **관련 문서 (역할별 참조)**:
> - 💻 **모바일앱 구현 상세**: `specs/react-native-app/10-notifications.md` (2026-07-26 제거 — 원본은 git `82cee067e`, 복원법은 `specs/react-native-app/README.md` 참조). 현행 구현은 `uniqn-mobile/src/services/notification/` 코드와 이 문서를 기준으로 확인하세요.
> - 💼 **운영 가이드**: [NOTIFICATION_OPERATIONS.md](../operations/NOTIFICATION_OPERATIONS.md) (운영팀용 — Edge Functions 관리, 모니터링)
>
> 이 문서는 **구현 현황 추적용**입니다. Phase 진행도, 테스트 결과, 해결된 이슈에 집중합니다.

---

## 📊 구현 현황 요약

### 전체 진행률
- **프론트엔드**: 100% ✅ (완성)
- **백엔드 (Supabase Edge Functions + PostgreSQL Triggers)**: 100% ✅ (Phase 1 완성 - 5개 Functions)
- **전체 시스템**: 100% ✅ (Phase 1 완성)

### 배포 상태
- ✅ Supabase Edge Functions 배포 완료 (5개 Functions)
- ✅ 프로덕션 환경에서 실시간 알림 작동 중 (Supabase Realtime)
- ✅ FCM/APNs 푸시 알림 전송 가능
- ✅ 타임존 처리 완료 (UTC → KST 변환)
- ✅ 모든 알림 타입 테스트 완료
- ✅ FCM 토큰 저장: PostgreSQL `fcm_tokens` 테이블 (user_id FK)

---

## 🎯 알림 타입 상세 (8가지)

### 1. System 카테고리 (4개)

#### 1.1 공고별 공지 전송 (job_posting_announcement) ✅

**기본 정보**
- 아이콘: 📢
- 우선순위: High
- 색상: Blue
- 설명: 특정 공고의 확정된 스태프에게 공지사항 전송
- 라우팅: /app/admin/job-postings/{jobPostingId}
- 구현 상태: ✅ 완성 (2025-10-15)

**백엔드 구현**
- Function: `send-job-posting-announcement` (Supabase Edge Function, HTTP)
- 트리거: 관리자/매니저가 공고 상세 페이지에서 공지 전송 버튼 클릭
- 수신자: 해당 공고의 확정된 스태프 전원
- 파일: `uniqn-mobile/supabase/functions/send-job-posting-announcement/index.ts`

**주요 기능**
- ✅ 권한 검증 (admin, manager만 가능 — `auth.users.raw_app_meta_data.role` 확인)
- ✅ 공지 제목/내용 입력 (최대 50자/500자)
- ✅ 공고 제목 자동 prefix ([공고제목] 공지내용)
- ✅ FCM 멀티캐스트 전송 (500명 단위 배치)
- ✅ PostgreSQL `notifications` 테이블에 알림 행 생성
- ✅ 전송 결과 추적 (성공/실패 건수)

---

#### 1.2 신규 공고 등록 (new_job_posting) ✅

**기본 정보**
- 아이콘: 🎯
- 우선순위: Medium
- 색상: Blue
- 설명: 새로운 구인공고가 등록되면 모든 사용자에게 알림
- 라우팅: /app/jobs/{postingId}
- 구현 상태: ✅ 완성 (2025-10-15)

**백엔드 구현**
- Function: `broadcast-new-job-posting` (Supabase Edge Function, PG trigger webhook)
- 트리거: PostgreSQL `job_postings` 테이블 INSERT 트리거 → Edge Function 호출 (pg_net / database webhook)
- 조건: `status = 'open'` (공개 상태 공고만)
- 수신자: 모든 사용자
- 파일: `uniqn-mobile/supabase/functions/broadcast-new-job-posting/index.ts`

**주요 기능**
- ✅ 공고 정보 유효성 검증
- ✅ 공고 제목, 지역, 시급 정보 포함
- ✅ FCM 푸시 알림 배치 전송 (500명 단위, `fcm_tokens` 조회)
- ✅ 모든 사용자에게 `notifications` 행 자동 생성
- ✅ 전송 결과 로깅 (성공/실패 건수)

---

#### 1.3 시스템 공지 (system_announcement) ⏳

**기본 정보**
- 아이콘: 🔔
- 우선순위: Medium
- 색상: Blue
- 설명: 전체 시스템 공지사항
- 라우팅: /app/announcements
- 구현 상태: ⏳ UI만 완성 (백엔드 미구현)

---

#### 1.4 앱 업데이트 (app_update) ⏳

**기본 정보**
- 아이콘: 🔄
- 우선순위: Low
- 색상: Blue
- 설명: 앱 업데이트 알림
- 라우팅: /app/announcements
- 구현 상태: ⏳ UI만 완성 (백엔드 미구현)

---

### 2. Work 카테고리 (3개)

#### 2.1 지원서 제출 (job_application) ✅

**기본 정보**
- 아이콘: 📝
- 우선순위: Medium
- 색상: Green
- 설명: 스태프가 공고에 지원하면 고용주에게 알림
- 라우팅: /applications/{applicationId}
- 구현 상태: ✅ 완성 (2025-10-15)

**백엔드 구현**
- Function: `on-application-submitted` (Supabase Edge Function, PG trigger webhook)
- 트리거: PostgreSQL `applications` 테이블 INSERT 트리거
- 수신자: 공고 작성자 (고용주)
- 파일: `uniqn-mobile/supabase/functions/on-application-submitted/index.ts`

**주요 기능**
- ✅ 공고 정보 조회 및 검증
- ✅ 고용주 정보 조회
- ✅ 지원자 이름, 공고 제목 포함
- ✅ 고용주에게 FCM 푸시 알림 전송
- ✅ PostgreSQL `notifications` 테이블에 알림 저장

---

#### 2.2 지원 확정 (staff_approval) ✅

**기본 정보**
- 아이콘: ✅
- 우선순위: High
- 색상: Green
- 설명: 지원이 확정되면 지원자에게 알림
- 라우팅: /app/my-schedule
- 구현 상태: ✅ 완성 (2025-10-15)

**백엔드 구현**
- Function: `on-application-status-changed` (Supabase Edge Function, PG trigger webhook)
- 트리거: PostgreSQL `applications` 테이블 UPDATE 트리거 (`status` 컬럼 변경)
- 조건: `status: 'applied' → 'confirmed'`
- 수신자: 지원자
- 파일: `uniqn-mobile/supabase/functions/on-application-status-changed/index.ts`

**주요 기능**
- ✅ 공고 정보 조회
- ✅ 지원자 정보 조회
- ✅ 지원자에게 FCM 푸시 알림 전송
- ✅ PostgreSQL `notifications` 테이블에 알림 저장

---

#### 2.3 지원 취소 (staff_rejection) ✅

**기본 정보**
- 아이콘: ❌
- 우선순위: Medium
- 색상: Red
- 설명: 지원이 취소되면 지원자에게 알림
- 라우팅: /app/my-schedule
- 구현 상태: ✅ 완성 (2025-10-15)

**백엔드 구현**
- Function: `on-application-status-changed` (Supabase Edge Function, PG trigger webhook)
- 조건: `status: 'applied' → 'cancelled'` 또는 `'confirmed' → 'cancelled'`
- 파일: `uniqn-mobile/supabase/functions/on-application-status-changed/index.ts`

---

### 3. Schedule 카테고리 (1개)

#### 3.1 근무시간 변경 (schedule_change) ✅

**기본 정보**
- 아이콘: 📅
- 우선순위: High
- 색상: Orange
- 설명: 근무 시간이 변경되면 해당 스태프에게 알림
- 라우팅: /app/my-schedule
- 구현 상태: ✅ 완성 (2025-10-15) - 타임존 수정 완료 ⭐

**백엔드 구현**
- Function: `on-work-time-changed` (Supabase Edge Function, PG trigger webhook)
- 트리거: PostgreSQL `work_logs` 테이블 UPDATE 트리거 (시간 컬럼 변경)
- 조건: `scheduled_start_time` 또는 `scheduled_end_time` 변경
- 수신자: 해당 근무 기록의 스태프
- 파일: `uniqn-mobile/supabase/functions/on-work-time-changed/index.ts`

**주요 기능**
- ✅ 시간 변경 감지 (timestamptz 비교)
- ✅ 타임존 변환 (UTC → KST) ⭐ 핵심 수정 완료
- ✅ staffId 파싱 ({userId}_{index} 형식 처리)
- ✅ 변경 전/후 시간 비교 정보 포함
- ✅ 스태프에게 FCM 푸시 알림 전송
- ✅ PostgreSQL `notifications` 테이블에 알림 저장

**타임존 처리 (중요! ⭐)**
PostgreSQL `timestamptz`도 UTC로 저장되므로 KST(UTC+9)로 변환 필요:
- formatTime 함수에서 UTC 시간에 9시간 추가 (또는 `AT TIME ZONE 'Asia/Seoul'`)
- 변경 전/후 시간 모두 KST로 변환하여 표시
- 예: UTC 05:00 → KST 14:00

**해결된 이슈**
1. ✅ staffId 파싱: {userId}_{index}에서 실제 userId 추출
2. ✅ 타임존 불일치: UTC → KST 변환으로 정확한 시간 표시

---

## 🚀 배포 상태

### Supabase Edge Functions 배포 현황

| Function | 타입 | 트리거 | 버전 | 배포일 | 상태 |
|----------|------|--------|------|--------|------|
| send-job-posting-announcement | Edge Function (HTTP) | HTTPS 요청 | v1.0.0 | 2026-04-11 | ✅ 작동 중 |
| broadcast-new-job-posting | Edge Function + PG Trigger | job_postings INSERT | v1.0.0 | 2026-04-11 | ✅ 작동 중 |
| on-application-submitted | Edge Function + PG Trigger | applications INSERT | v1.0.0 | 2026-04-11 | ✅ 작동 중 |
| on-application-status-changed | Edge Function + PG Trigger | applications UPDATE | v1.0.0 | 2026-04-11 | ✅ 작동 중 |
| on-work-time-changed | Edge Function + PG Trigger | work_logs UPDATE | v1.0.0 | 2026-04-11 | ✅ 작동 중 (KST) |

*이전 배포 (2025-10-15)는 Firebase Functions 기반이었으며, 2026-04-11 Supabase 이전 시 Edge Functions로 재배포되었습니다.*

---

## 🧪 테스트 결과 (2025-10-15)

### ✅ 백엔드 테스트 완료

**공고 공지 전송**
- [x] 권한 검증
- [x] 입력 데이터 검증
- [x] FCM 멀티캐스트 전송
- [x] 알림 문서 생성
- [x] 전송 결과 추적

**신규 공고 브로드캐스트**
- [x] 공고 상태 검증
- [x] 모든 사용자 알림
- [x] FCM 배치 전송
- [x] 전송 결과 로깅

**지원서 제출 알림**
- [x] 공고/고용주 조회
- [x] FCM 푸시 전송
- [x] 알림 문서 생성

**지원 상태 변경 알림**
- [x] 확정 알림
- [x] 취소 알림
- [x] FCM 푸시 전송

**근무시간 변경 알림**
- [x] 시간 변경 감지
- [x] 타임존 변환 (UTC → KST) ⭐
- [x] staffId 파싱
- [x] KST 시간 정확 표시 (14:00 → 15:00)
- [x] FCM 푸시 전송

### ✅ 프론트엔드 테스트 완료
- [x] 알림 드롭다운 UI
- [x] 알림 센터 페이지
- [x] 실시간 구독
- [x] 알림 클릭 라우팅
- [x] KST 시간 표시

---

## 🐛 해결된 이슈

### 1. staffId 파싱 문제 ✅

**문제**: staffId가 {userId}_{index} 형식인데 users 컬렉션 쿼리 시 전체 문자열 사용

**해결**: actualUserId 추출 후 쿼리

### 2. 타임존 불일치 문제 ✅

**문제**: PostgreSQL `timestamptz`가 UTC로 직렬화되어 그대로 표시됨 (14:00 → 05:00)

**해결**: formatTime 함수에 KST(UTC+9) 변환 로직 추가 (또는 SQL에서 `AT TIME ZONE 'Asia/Seoul'`)

**테스트 결과**: 14:00 → 15:00 KST 시간으로 정확하게 표시 ✅

---

## 🔮 향후 계획 (Phase 2)

### 추가 알림 타입
- Finance 카테고리: payment_processed, payment_delayed
- Reminder 카테고리: shift_reminder, attendance_alert

### 기능 개선
- 이메일/SMS 알림 통합
- 알림 히스토리 검색
- 알림 통계 대시보드
- 예약 발송 기능

### 성능 최적화
- FCM 토큰 자동 정리 (`fcm_tokens` 테이블 + PG cron)
- `notifications` 테이블 자동 아카이빙 (파티션/오래된 행 정리)
- 배치 전송 최적화

---

*최종 수정: 2026-04-18*  
*Phase 1 완성: 5개 Supabase Edge Functions 배포 및 테스트 완료 (2026-04-11 이전 포팅)*
