# Firebase → Supabase 이전 전 타입 추상화 + 레거시 정리 계획

## Context

Supabase 이전 전, Firebase 타입이 인터페이스/도메인 모델/서비스 레이어에 누출되어 있어 구현체 교체가 불가능한 상태. 이 작업은 **Firebase가 정상 동작하는 상태를 유지하면서** 인터페이스 경계를 깨끗하게 만드는 사전 작업.

**목표**: Repository 인터페이스와 도메인 모델에서 Firebase 직접 의존성 0개 달성

---

## 사용자 사전 설정 (이전 작업 시작 전 필요)

### Supabase 프로젝트 생성

```
1. https://supabase.com 접속 → New Project
2. 리전: Northeast Asia (Seoul) - ap-northeast-2
3. 데이터베이스 비밀번호 설정 (안전하게 보관)
4. Project URL과 anon key 메모
```

### Supabase Auth 프로바이더 설정

```
Dashboard → Authentication → Providers:

1. Email: 활성화 (기본)
2. Apple:
   - Apple Developer Console → Services IDs 생성
   - Redirect URL: https://<project-ref>.supabase.co/auth/v1/callback
   - Service ID, Secret Key, Key ID, Team ID 입력
3. Phone (선택):
   - Twilio 계정 생성 → Account SID, Auth Token, Phone Number
   - 또는 PortOne 본인인증으로 대체 (현재 이미 구현)
```

### 환경 변수 준비

```bash
# uniqn-mobile/.env.local에 추가 (기존 Firebase 변수 유지)
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Twilio 설정 (Phone SMS 사용 시)

```
1. https://twilio.com → 계정 생성
2. Phone Number 구매 (한국 발신용)
3. Supabase Dashboard → Auth → Phone → Twilio 연동
4. 비용: SMS 1건당 약 $0.05~0.10 (한국)
```

### Edge Functions 로컬 개발 환경

```bash
# Supabase CLI 설치
npm install -g supabase

# 프로젝트 초기화 (uniqn-mobile/ 내부에서)
supabase init

# 로컬 개발 서버
supabase start  # Docker 필요
supabase functions serve
```

### npm 패키지 사전 설치

```bash
cd uniqn-mobile
npm install @supabase/supabase-js
```

---

## Phase 0: 공용 추상 타입 정의 (위험도: 0)

**기존 코드에 영향 없음. 새 파일/타입 추가만.**

### 0-1. 범용 타입 파일 생성

**파일**: `src/types/common.ts` (기존 파일에 추가)

```typescript
// Firebase-agnostic types for repository abstraction
export type UnsubscribeFn = () => void;
export type PaginationCursor = unknown;
```

### 0-2. Timestamp 변환 유틸 생성

**파일**: `src/utils/timestamp.ts` (신규)

```typescript
// Firestore Timestamp → Date 변환 (양방향)
// Repository 내부에서만 사용
export function toDate(value: unknown): Date | null { ... }
export function toDateRequired(value: unknown): Date { ... }
```

**검증**: `npm run quality` 통과

---

## Phase 1: Unsubscribe 타입 교체 (위험도: 낮음)

**영향**: 5개 인터페이스 + 1개 서비스 파일

### 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/repositories/interfaces/IApplicationRepository.ts:25` | `Unsubscribe` → `UnsubscribeFn` |
| `src/repositories/interfaces/IJobPostingRepository.ts:8` | `Unsubscribe` → `UnsubscribeFn` |
| `src/repositories/interfaces/IWorkLogRepository.ts:8` | `Unsubscribe` → `UnsubscribeFn` |
| `src/repositories/interfaces/IConfirmedStaffRepository.ts:1` | `Unsubscribe` → `UnsubscribeFn` |
| `src/services/work/workLogService.ts:15` | `Unsubscribe` → `UnsubscribeFn` |

**호환성**: Firebase의 `Unsubscribe`는 이미 `() => void`이므로 구현체 변경 불필요.

**검증**: `npm run quality` 통과

---

## Phase 2: QueryDocumentSnapshot 교체 (위험도: 낮음)

**영향**: 2개 인터페이스 + 1개 서비스 타입 파일

### 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `src/repositories/interfaces/IJobPostingRepository.ts:8,28,116` | `QueryDocumentSnapshot<DocumentData>` → `PaginationCursor` |
| `src/repositories/interfaces/INotificationRepository.ts:13,28` | `QueryDocumentSnapshot<DocumentData>` → `PaginationCursor` |
| `src/services/notifications/internal/notificationServiceTypes.ts:1,4` | `NotificationPageCursor` = `PaginationCursor` |

**Firebase 구현체**: 내부에서 `as QueryDocumentSnapshot<DocumentData>` 캐스팅 추가.

**검증**: `npm run quality` 통과

---

## Phase 3: Timestamp 교체 (위험도: 높음 — 단계적 진행)

### 3-1. Repository 변환 레이어 추가

Firebase Repository 구현체 내부에 Timestamp↔Date 변환 로직 추가.
**외부로 나가는 모든 데이터를 Date로 변환.**

대상 파일 (20개 구현체):
- `repositories/firebase/UserRepository.ts` (693줄)
- `repositories/firebase/application/*.ts` (4개 파일)
- `repositories/firebase/jobPosting/*.ts` (3개 파일)
- `repositories/firebase/workLog/*.ts` (4개 파일)
- `repositories/firebase/NotificationRepository.ts` (681줄)
- 나머지 8개 Repository

### 3-2. 도메인 모델 타입 변경 (8개 파일)

| 파일 | Timestamp 사용 위치 | 변경 |
|------|---------------------|------|
| `src/types/user.ts:15,147` | `FirestoreUserProfile = UserProfile<Timestamp>` | `<Date>` 또는 제네릭 제거 |
| `src/types/application.ts:1,12,75-78` | `CancellationRequestTimestamp`, `processedAt` 등 | `Date`로 통일 |
| `src/types/applicationHistory.ts` | 테스트 픽스처 | `new Date()` |
| `src/types/board.ts:1` | `import type { Timestamp }` | 제거 |
| `src/types/common.ts:11` | `import type { Timestamp }` | 제거 |
| `src/types/report.ts:10` | `import type { Timestamp }` | 제거 |
| `src/types/review.ts:10` | `import type { Timestamp }` | 제거 |
| `src/types/jobTemplate.ts:1` | `import type { Timestamp }` | 제거 |

### 3-3. Zod 스키마 수정

| 파일 | 변경 |
|------|------|
| `src/schemas/common.ts:32-48,88-100` | `timestampSchema` → Date 기반으로 변경 |

### 3-4. 서비스 레이어 Timestamp 직접 사용 제거

| 파일 | 현재 | 변경 |
|------|------|------|
| `src/services/work/eventQRService.ts:115-116` | `Timestamp.fromMillis()` | `new Date(ms)` |
| `src/services/offline/criticalOfflineCache.ts:63` | `.toDate()` | 이미 Date이므로 제거 |
| `src/utils/date/core.ts:79` | `.toDate()` | 타입 가드로 변경 |

### 3-5. 테스트 파일 Timestamp 사용 제거 (30+ 파일)

`Timestamp.now()` → `new Date()`
`Timestamp.fromDate(d)` → `d` (이미 Date)

**검증**: `npm run quality` + `npm test` + 앱 실행 확인

---

## Phase 4: 아키텍처 위반 정리 (위험도: 중간)

### 서비스 레이어의 Firebase 직접 import 현황 (25+ 파일)

**Auth 서비스** (허용 예외 — CLAUDE.md 규칙):
- `authCoreService.ts` — Firebase Auth 직접 호출 허용 (인증 전용)
- `socialLoginService.ts` — 허용
- `appleAuthService.ts` — 허용
- `authorizationService.ts` — 허용

**비Auth 서비스 위반** (정리 대상):

| 파일 | 위반 내용 | 해결 |
|------|----------|------|
| `services/work/eventQRService.ts` | `import { Timestamp }` | Phase 3에서 해결 |
| `services/work/confirmedStaffService.ts` | Firestore 직접 import | Repository 경유로 변경 |
| `services/work/scheduleService.ts` | Firestore import | Repository 경유로 변경 |
| `services/work/workLogService.ts` | `Unsubscribe` import | Phase 1에서 해결 |
| `services/notifications/internal/notificationReadStateService.ts` | Firestore import | Repository 경유로 변경 |
| `services/notifications/internal/notificationMessageNormalizer.ts` | Firestore import | Timestamp 제거로 해결 |
| `services/jobs/jobService.ts` | Firestore import | Repository 경유로 변경 |
| `services/jobs/applicantManagementService.ts` | Firestore import | Repository 경유로 변경 |
| `services/jobs/applicationHistoryService.ts` | Firestore import | Repository 경유로 변경 |
| `services/admin/tournamentApprovalService.ts` | Firestore import | Repository 경유로 변경 |
| `services/observability/sessionService.ts` | Firebase import | Repository 경유로 변경 |

---

## Phase 5: 레거시 코드 정리 (위험도: 낮음)

### 5-1. 레거시 파일 삭제

| 파일 | 이유 |
|------|------|
| `repositories/firebase/workLog/legacyBridgeMerger.ts` | 레거시 WorkLog 브릿지 |

### 5-2. 레거시 Schedule variant 제거 (6곳)

| 파일 | 위치 |
|------|------|
| `components/jobs/shared/PostingCardSurface.tsx:121` | `variant === 'legacy'` |
| `components/jobs/shared/PostingScheduleContent.tsx:61` | `variant === 'legacy'` |
| `components/jobs/shared/postingSurfaceModel.ts:109,229` | `variant: 'legacy'` |
| `domains/job-posting/facts.ts:70` | `'legacy'` |
| `domains/job-posting/projections.ts:142` | `variant === 'legacy'` |
| `domains/job-posting/selectors.ts:115` | `'legacy'` |

### 5-3. Deprecated 상수 제거

| 파일 | 위치 | 내용 |
|------|------|------|
| `constants/jobPosting.ts:76` | `@deprecated` StaffRole 관련 |
| `constants/jobPosting.ts:115` | `@deprecated` STAFF_ROLES 관련 |

---

## 실행 순서 & 안전장치

```
Phase 0 → commit → quality ✓
Phase 1 → commit → quality ✓
Phase 2 → commit → quality ✓
Phase 3-1 → commit → quality ✓ → 앱 실행 확인
Phase 3-2 → commit → quality ✓ → 앱 실행 확인
Phase 3-3 → commit → quality ✓
Phase 3-4 → commit → quality ✓
Phase 3-5 → commit → quality ✓ → test ✓
Phase 4 → commit → quality ✓
Phase 5 → commit → quality ✓
```

**매 commit = 롤백 포인트**. 문제 발생 시 `git revert` 가능.

## 검증 방법

- 매 Phase 후: `npm run quality` (type-check + lint + format:check)
- Phase 3 완료 후: `npm test` (전체 테스트)
- Phase 5 완료 후: 앱 실행 + 주요 플로우 수동 확인
- 최종: `grep -r "from 'firebase" src/types/ src/repositories/interfaces/` → 결과 0건

## 완료 기준

- [ ] `src/types/` 에서 `firebase` import 0건
- [ ] `src/repositories/interfaces/` 에서 `firebase` import 0건
- [ ] `src/services/` (auth 제외)에서 `firebase/firestore` import 0건
- [ ] 레거시 코드 정리 완료
- [ ] `npm run quality` 통과
- [ ] `npm test` 통과
