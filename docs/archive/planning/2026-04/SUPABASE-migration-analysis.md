# Firebase → Supabase 이전을 위한 코드베이스 분석

> `SUPABASE 이전계획.md`의 Phase별 실행을 위한 상세 분석 자료

---

## 1. Repository 패턴 분석 (Phase 2 핵심)

### 스왑 포인트: `src/repositories/index.ts` (451줄)

**패턴**: Singleton 인스턴스 직접 내보내기 (DI 컨테이너 아님)

```typescript
export const applicationRepository = new FirebaseApplicationRepository();
export const jobPostingRepository = new FirebaseJobPostingRepository();
export const workLogRepository = new FirebaseWorkLogRepository();
// ... 14개 총 singleton
```

**이전 방법**: 이 파일 하나만 수정하면 전체 앱의 데이터 레이어가 교체됨.

---

### 16개 Repository 인터페이스 목록

| # | 인터페이스 | 메서드 수 | 실시간 구독 | 트랜잭션 | Firebase 타입 누출 |
|---|-----------|----------|------------|---------|-------------------|
| 1 | IApplicationRepository | 26 | 2 (subscribe) | 7 (WithTransaction) | Unsubscribe, Timestamp |
| 2 | IJobPostingRepository | 21 | 1 | 5 | Unsubscribe, QueryDocumentSnapshot |
| 3 | IWorkLogRepository | 26 | 5 | 3 | Unsubscribe (5개) |
| 4 | IUserRepository | 13 | 0 | 1 (batch) | Timestamp (DeletionRequest) |
| 5 | INotificationRepository | 16 | 2 | 0 | QueryDocumentSnapshot |
| 6 | IBoardRepository | 30 | 0 | 여러 개 | 없음 |
| 7 | ISettlementRepository | 5 | 0 | 4 | 없음 |
| 8 | IConfirmedStaffRepository | 7 | 1 | 3 | Unsubscribe |
| 9 | IAnnouncementRepository | 11 | 0 | 0 | 없음 |
| 10 | IReportRepository | 10 | 0 | 2 | 없음 |
| 11 | IReviewRepository | 5 | 0 | 1 | 없음 |
| 12 | IAdminRepository | 9 | 0 | 0 | 없음 |
| 13 | IInquiryRepository | 8 | 0 | 1 | 없음 |
| 14 | ITemplateRepository | 5 | 0 | 0 | 없음 |
| 15 | IEventQRRepository | 7 | 0 | 0 | 없음 |
| **합계** | **~199** | **11** | **~27** | |

---

### Firebase 타입 누출 (이전 전 해결 필요)

#### 1. `Unsubscribe` 타입 (5개 인터페이스, 11개 메서드)
- 소스: `firebase/firestore`의 `Unsubscribe`
- **해결**: `type UnsubscribeFn = () => void` 추상 타입으로 교체

#### 2. `QueryDocumentSnapshot` (2개 인터페이스)
- `IJobPostingRepository.getList()` → 페이지네이션 커서로 사용
- `INotificationRepository.getByUserId()` → 옵션 파라미터
- **해결**: `type PaginationCursor = unknown` 추상 타입으로 교체

#### 3. `Timestamp` (16개 도메인 모델 파일)
- `application.ts`, `user.ts`, `jobPosting.ts`, `board.ts`, `notification.ts` 등
- 모든 `createdAt`, `updatedAt` 필드에 사용
- **해결**: `Date` 또는 `string (ISO 8601)`로 통일. Supabase는 `timestamptz` → JS `Date` 자동 변환

**영향받는 도메인 모델 파일** (16개):
```
src/types/annotation.ts, application.ts, applicationHistory.ts, auth.ts,
board.ts, common.ts, inquiry.ts, jobPosting.ts, jobPosting/dateRequirement.ts,
jobTemplate.ts, notification.ts, postingConfig.ts, report.ts, review.ts,
schedule.ts, user.ts
```

---

### Firebase 구현체 파일 크기 (큰 순)

| 파일 | 줄 수 | 주요 Firestore 연산 |
|------|-------|-------------------|
| jobPosting/jobPostingTransactions.ts | 927 | runTransaction, where, orderBy |
| BoardRepository.ts | 897 | where, onSnapshot, runTransaction |
| application/applicationTransactions.ts | 819 | runTransaction, batch |
| workLog/workLogQueries.ts | 744 | query, where, orderBy, collectionGroup |
| SettlementRepository.ts | 718 | runTransaction |
| UserRepository.ts | 693 | getDoc, setDoc, writeBatch |
| NotificationRepository.ts | 681 | query, onSnapshot |
| AnnouncementRepository.ts | 537 | query, setDoc, updateDoc |
| AdminRepository.ts | 499 | collection, getDocs, query |
| ConfirmedStaffRepository.ts | 484 | query, onSnapshot, runTransaction |
| application/applicationQueries.ts | 457 | query, where, orderBy |
| ReportRepository.ts | 451 | query, runTransaction, writeBatch |
| workLog/workLogMutations.ts | 388 | getDoc, updateDoc, runTransaction |
| application/applicationHistoryTransactions.ts | 379 | runTransaction, batch |
| jobPosting/jobPostingQueries.ts | 377 | query, where, orderBy |
| InquiryRepository.ts | 354 | query, runTransaction |
| ReviewRepository.ts | 350 | getDoc, runTransaction |
| EventQRRepository.ts | 317 | query, where, getDocs |
| workLog/workLogSubscriptions.ts | 266 | onSnapshot, query |
| **합계** | **~10,000줄** | |

---

### 공용 유틸리티 (`src/utils/firestore.ts`, 492줄)

| 함수 | 용도 | Supabase 대응 |
|------|------|---------------|
| `runSingleDocTransaction()` | 단일 문서 트랜잭션 | `supabase.rpc()` |
| `runOptimisticTransaction()` | 낙관적 동시성 + 재시도 | PostgreSQL 트랜잭션 (MVCC) |
| `runBatchedTransaction()` | 대량 트랜잭션 (배치) | 단일 PostgreSQL 트랜잭션 |
| `runBatchWrite()` | 배치 쓰기 (비트랜잭션) | `supabase.from().insert([...])` |
| `documentExists()` | 문서 존재 확인 | `supabase.from().select().single()` |
| `normalizeTimestamp()` | Timestamp 정규화 | 불필요 (PostgreSQL은 Date 네이티브) |
| `timestampToDate()` | Timestamp→Date 변환 | 불필요 |

### QueryBuilder (`src/utils/firestore/queryBuilder.ts`, 409줄)

| 메서드 | Supabase PostgREST 대응 |
|--------|------------------------|
| `.where(field, op, value)` | `.eq()`, `.gt()`, `.lt()` 등 |
| `.whereIn(field, values)` | `.in(field, values)` |
| `.whereArrayContains()` | `.contains()` |
| `.orderBy(field, dir)` | `.order(field, { ascending })` |
| `.limit(count)` | `.limit(count)` |
| `.startAfter(doc)` | `.range(from, to)` 또는 keyset |
| `.paginate(size, cursor)` | `.range()` + `.limit()` |

---

## 2. Firebase 설정 & Auth 시스템 (Phase 1 핵심)

### Firebase 프로젝트 정보

| 항목 | 값 |
|------|-----|
| Project ID | `tholdem-ebc18` |
| Region | `asia-northeast3` (서울) |
| Auth Domain | `tholdem-ebc18.firebaseapp.com` |
| Runtime | Node.js 22 |
| SDK 버전 | Web: 12.6.0, Native: 23.8.6, Admin: 13.7.0 |

### 환경 변수 (`.env.local`)

```
EXPO_PUBLIC_FIREBASE_API_KEY=<redacted — 폐기된 Firebase 웹 키>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tholdem-ebc18.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tholdem-ebc18
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tholdem-ebc18.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=296074758861
EXPO_PUBLIC_FIREBASE_APP_ID (Web/iOS/Android 분리)
EXPO_PUBLIC_FIREBASE_REGION=asia-northeast3
EXPO_PUBLIC_RECAPTCHA_SITE_KEY=6LcmmngsAAAAAJTvgc4b17aL-W8RKOIMORkwY9hr
EXPO_PUBLIC_SENTRY_DSN=...
```

**Supabase 전환 시 필요한 환경 변수**:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 초기화 시스템 (`src/lib/firebase.ts`, 486줄)

**패턴**: Lazy Proxy + Singleton

```
Exports (전부 교체 대상):
├── app: FirebaseApp          → 삭제
├── auth: Auth                → supabase.auth
├── db: Firestore             → supabase (client)
├── storage: FirebaseStorage  → supabase.storage
├── functions: Functions      → supabase.functions
├── getFirebaseRemoteConfig() → DB 테이블 조회
└── 에뮬레이터 연결 로직       → supabase start (로컬)
```

### Dual SDK 문제 (Supabase에서 해소)

**현재 문제**: Native SDK(`@react-native-firebase/auth`)와 Web SDK(`firebase/auth`)가 Auth 상태를 공유하지 않아 `authBridge.ts`(161줄)로 동기화 필요.

**Supabase 이전 후**: `supabase-js` 단일 SDK → `authBridge.ts` 완전 삭제 가능.

### Auth 인증 플로우 상세

#### 이메일/비밀번호

```
[현재 Firebase]
Web: signInWithEmailAndPassword(auth, email, password)
Native: nativeSignInWithEmailAndPassword() → syncToWebAuth(email, password)

[Supabase 전환]
supabase.auth.signInWithPassword({ email, password })
→ 플랫폼 무관 단일 호출
```

#### Apple 로그인

```
[현재 Firebase]
1. expo-apple-authentication → nonce + identityToken
2. OAuthProvider.credential('apple.com', idToken, rawNonce)
3. signInWithCredential(auth, credential)

[Supabase 전환]
1. expo-apple-authentication → nonce + identityToken (동일)
2. supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce })
```

#### Phone SMS

```
[현재 Firebase]
Web: RecaptchaVerifier → signInWithPhoneNumber → confirm(OTP)
Native: nativeVerifyPhoneNumber → PhoneAuthListener → auto-complete/manual OTP

[Supabase 전환]
supabase.auth.signInWithOtp({ phone }) → Twilio SMS → supabase.auth.verifyOtp({ phone, token })
→ Twilio 별도 설정 + 비용 발생
```

### Auth 상태 관리

**Zustand Store** (`src/stores/authStore.ts`, 300+ 줄):
```typescript
interface AuthState {
  user: AuthUser | null;         // → Supabase User
  profile: UserProfile | null;   // → users 테이블 조회
  status: AuthStatus;
  isAdmin / isEmployer / isStaff; // → app_metadata.role 기반
}
```

**Persistence**: MMKV 암호화 저장소 → Supabase에서도 동일하게 사용 가능

### 앱 초기화 시퀀스 (`useAppInitialize.ts`, 600+ 줄)

```
현재:
1. validateEnv() → Firebase 환경 변수 검증
2. tryInitializeFirebase() → App/Auth/DB/Storage/Functions 초기화
3. ensureDualSdkSync() → Native+Web Auth 동기화
4. waitForInitialAuthUser(5000ms) → Auth 상태 복원
5. loadLatestProfile(uid) → MMKV 캐시 → Firestore 프로필
6. checkForceUpdate() → Remote Config 버전 체크

Supabase 전환 후:
1. validateEnv() → Supabase URL + Anon Key 검증
2. createClient(url, key) → 단일 클라이언트 초기화
3. (삭제) → Dual SDK 불필요
4. supabase.auth.getSession() → 세션 복원
5. supabase.from('users').select() → 프로필 로드
6. supabase.from('app_config').select() → 버전 체크
```

---

## 3. Cloud Functions 전체 목록 (Phase 3 핵심)

### Callable Functions (28개)

#### 인증 (7개) → Edge Functions

| 함수 | Rate Limit | reCAPTCHA | 컬렉션 | 외부 호출 |
|------|-----------|-----------|--------|----------|
| `checkEmailExists` | 3/min (IP) | ✅ | users (R) | — |
| `checkNicknameExists` | 3/min (IP) | ✅ | users (R) | — |
| `checkPhoneExists` | 3/min (IP) | ✅ | users (R) | — |
| `verifyAndSaveProfile` | 3(anon)/5(auth)/min | — | users (RW), consents (W) | Firebase Auth, OTP API |
| `verifyPortOneIdentity` | — | — | users (R) | PortOne SDK |
| `verifyAndSavePortOneProfile` | — | — | users (RW) | PortOne SDK |
| `revokeAppleToken` | — | — | — | Apple API |

#### 관리자 (6개) → Edge Functions (admin 권한)

| 함수 | 컬렉션 | 외부 호출 |
|------|--------|----------|
| `requestRegistration` | users (W) | Firebase Auth create |
| `processRegistration` | users (RW) | Firebase Auth update |
| `createUserAccount` | users (W) | Firebase Auth create |
| `getDashboardStats` | events, users (R) | — |
| `updateUser` | users (W) | — |
| `deleteUser` | users (RW) | Firebase Auth delete |

#### 공고 (3개) → Edge Functions

| 함수 | 컬렉션 |
|------|--------|
| `approveJobPosting` | jobPostings (W), announcements (W) |
| `rejectJobPosting` | jobPostings (W) |
| `resubmitJobPosting` | jobPostings (W) |

#### 알림 (5개) → Edge Functions

| 함수 | 외부 호출 |
|------|----------|
| `decrementUnreadCounter` | — |
| `initializeUnreadCounter` | — |
| `resetUnreadCounter` | — |
| `sendJobPostingAnnouncement` | Expo Push SDK |
| `sendSystemAnnouncement` | Expo Push SDK |

#### 계정 (3개) → Edge Functions

| 함수 | 컬렉션 |
|------|--------|
| `forceDeleteAccount` | users + 하위 전체 (D) |
| `recordLoginFailure` | loginFailures (W) |
| `sendLoginNotification` | loginHistory (W), Expo Push |

#### 텔레메트리 (2개) → Edge Functions 또는 직접 INSERT

| 함수 | 타입 |
|------|------|
| `logAction` | onCall |
| `logActionHttp` | onRequest (HTTP) |

---

### Firestore 트리거 (21개) → PG Trigger + Database Webhook

| 트리거 | 문서 경로 | 동작 | Supabase 대응 |
|--------|----------|------|---------------|
| `onUserRoleChange` | users/{uid} | Role → Custom Claims 동기화 | PG trigger → `auth.users.raw_app_meta_data` 업데이트 |
| `onApplicationSubmitted` | applications/{id} | 알림 발송 | PG trigger → Edge Function (push) |
| `onApplicationStatusChanged` | applications/{id} | 상태 변경 알림 | PG trigger → Edge Function |
| `onCheckInOut` | workLogs/{id} | 출퇴근 알림 | PG trigger → Edge Function |
| `onNoShow` | workLogs/{id} | 노쇼 알림 | PG trigger → Edge Function |
| `onJobPostingUpdated` | jobPostings/{id} | 공고 변경 알림 | PG trigger → Edge Function |
| `onJobPostingClosed` | jobPostings/{id} | 마감 알림 | PG trigger → Edge Function |
| `onJobPostingCancelled` | jobPostings/{id} | 취소 알림 | PG trigger → Edge Function |
| `onSettlementCompleted` | settlements/{id} | 정산 완료 알림 | PG trigger → Edge Function |
| `onNotificationRead` | notifications/{id} | 카운터 감소 | PG trigger (SQL만으로 처리 가능) |
| `onNotificationDeleted` | notifications/{id} | 카운터 감소 | PG trigger |
| `onBoardCommentCreated` | boardPosts/{id}/comments | 댓글 알림 | PG trigger → Edge Function |
| `onReviewCreated` | reviews/{id} | 리뷰 알림 | PG trigger → Edge Function |
| `onInquiryCreated` | inquiries/{id} | 문의 알림 | PG trigger → Edge Function |
| `onReportCreated` | reports/{id} | 신고 알림 | PG trigger → Edge Function |
| `onTournamentApprovalChange` | jobPostings/{id} | 승인 상태 변경 | PG trigger → Edge Function |
| `onFixedPostingExpired` | jobPostings/{id} | 만료 처리 | PG trigger |
| `onWorkDateExpired` | jobPostings/{id} | 근무일 만료 | PG trigger |
| `onJobPostingOGSync` | jobPostings/{id} | OG 메타 동기화 | PG trigger (SQL) |
| `onBoardPostLocked` | boardPosts/{id} | 잠금 알림 | PG trigger → Edge Function |
| `syncApplicationCompletionFromWorkLogs` | workLogs/{id} | 근무 완료 → 지원 상태 동기화 | PG trigger (크로스 테이블) |

---

### 스케줄 함수 (8개) → `pg_cron`

| 함수 | 스케줄 | 타임존 | Supabase 대응 |
|------|--------|--------|---------------|
| `cleanupExpiredTokens` | `0 3 * * *` | Asia/Seoul | pg_cron + SQL (fcmTokens 정리) |
| `cleanupRateLimits` | `0 0 * * *` | Asia/Seoul | pg_cron + SQL (rateLimits 삭제) |
| `expireFixedPostings` | 매 1시간 | Asia/Seoul | pg_cron + SQL (status 업데이트) |
| `expireByLastWorkDate` | 주기적 | Asia/Seoul | pg_cron + SQL |
| `processScheduledDeletions` | `0 18 * * *` | UTC | pg_cron + Edge Function (Auth 삭제) |
| `sendReviewReminders` | `0 1 * * *` | Asia/Seoul | pg_cron + Edge Function (push) |
| `retryFailedCounterOps` | 주기적 | Asia/Seoul | pg_cron + SQL |
| `cleanupOrphanAccounts` | 주기적 | Asia/Seoul | pg_cron + Edge Function |

---

## 4. 보안 규칙 매핑 (Phase 1~2)

### Firestore Rules 헬퍼 함수 → RLS 함수

| Firestore 헬퍼 | 로직 | PostgreSQL RLS 대응 |
|----------------|------|-------------------|
| `isSignedIn()` | `request.auth.uid != null` | `auth.uid() IS NOT NULL` |
| `isOwner(userId)` | `request.auth.uid == userId` | `auth.uid() = user_id` |
| `isAdmin()` | Firestore에서 role 조회 | `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` |
| `isPrivileged()` | role in ['admin', 'employer'] | `... IN ('admin', 'employer')` |
| `hasValidRole()` | role in ['admin', 'employer', 'staff'] | `... IN ('admin', 'employer', 'staff')` |
| `getUserRole()` | `get(users/{uid}).data.role` | `auth.jwt() -> 'app_metadata' ->> 'role'` |
| `isSafeText(text, maxLen)` | 문자열 + XSS 검사 | PostgreSQL CHECK + trigger function |
| `hasNoXSS(text)` | `<script`, `javascript:` 등 차단 | trigger function 내 정규식 검사 |

### XSS 검증 패턴 (보안 규칙에서 사용)

```
차단 패턴: <script, javascript:, onXXX=, <iframe, <object, <embed, <link, data:, expression()
```

→ PostgreSQL trigger function으로 이전:
```sql
CREATE FUNCTION check_xss() RETURNS trigger AS $$
BEGIN
  IF NEW.content ~ '<script|javascript:|on\w+=|<iframe|<object|<embed' THEN
    RAISE EXCEPTION 'XSS pattern detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Storage Rules → Supabase Storage Policy

| 경로 | 읽기 | 쓰기 | 크기 | Supabase Bucket |
|------|------|------|------|-----------------|
| `profile-images/{userId}/*` | 공개 | 본인 | 5MB | `profile-images` (public) |
| `job-postings/{postingId}/*` | 인증 | employer/admin | 10MB | `job-postings` (private) |
| `announcements/{userId}/*` | 공개 | 본인/관리자 | 5MB | `announcements` (public) |
| `chat/{conversationId}/*` | 인증 | 인증 | 20MB | `chat` (private) |
| `id-verification/{userId}/*` | 본인/관리자 | 본인 | 10MB | `id-verification` (private) |
| `qr-codes/{userId}/*` | 본인/관리자 | 본인 | 1MB | `qr-codes` (private) |
| `receipts/{userId}/*` | 본인/관리자 | Functions만 | — | `receipts` (private, service role) |
| `exports/{userId}/*` | 본인 | Functions만 | — | `exports` (private, service role) |
| `temp/{userId}/*` | 본인 | 본인 | 20MB | `temp` (private) |

---

## 5. Firestore 컬렉션 → PostgreSQL 테이블 매핑

| Firestore 컬렉션 | PostgreSQL 테이블 | 인덱스 수 | 비고 |
|------------------|------------------|----------|------|
| `users` | `users` | 3+ | FK: auth.users |
| `jobPostings` | `job_postings` | 13 | 가장 많은 복합 인덱스 |
| `applications` | `applications` | 9 | FK: users, job_postings |
| `workLogs` | `work_logs` | 5 | FK: users, job_postings |
| `notifications` | `notifications` | 5 | FK: users |
| `boardPosts` | `board_posts` | 3 | |
| `boardMemberships` | `board_memberships` | 5 | FK: users, board_posts |
| `announcements` | `announcements` | 2 | |
| `reviews` | `reviews` | 2 | FK: work_logs, users |
| `reports` | `reports` | 2 | FK: users |
| `inquiries` | `inquiries` | 1 | FK: users |
| `settlements` | `settlements` | 1 | FK: work_logs |
| `eventQRCodes` | `event_qr_codes` | 1 | FK: job_postings |
| `mobileJobPostingTemplates` | `job_posting_templates` | 1 | FK: users |
| `rateLimits` | `rate_limits` | 1 | 스케줄 정리 대상 |
| `actionLogs` | `action_logs` | 0 | 텔레메트리 |
| — (서브컬렉션) `users/{uid}/consents` | `user_consents` | 0 | FK: users |
| — (서브컬렉션) `boardPosts/{id}/comments` | `board_comments` | 1 | FK: board_posts, users |
| — (서브컬렉션) `boardPosts/{id}/votes` | `board_votes` | 0 | FK: board_posts, users |
| **합계** | **~20 테이블** | **~55 인덱스** | |

---

## 6. 미들웨어 & 보안 패턴

### callableGuard (Cloud Functions 미들웨어)

```typescript
withCallableGuard(request, {
  operation: string,
  rateLimit: { maxRequests, keyPrefix, authenticatedMaxRequests? },
  requireRecaptcha?: boolean,
}, handler)
```

**Supabase 대응**: Edge Function 내부에서 직접 구현 또는 공용 미들웨어 모듈

### Rate Limiting (Firestore 기반 Token Bucket)

| 카테고리 | 제한 | Supabase 대응 |
|----------|------|---------------|
| IP 기반 | 100/min | Edge Function + `rate_limits` 테이블 또는 Redis |
| Payment | 5/min | RPC function + 테이블 |
| Refund | 3/min | RPC function + 테이블 |
| General | 30/min | RPC function + 테이블 |
| Abuse Detection | 위험 점수 0.7 이상 차단 | RPC function |

### 에러 코드 체계

```
E1xxx 네트워크 / E2xxx 인증 / E3xxx 검증 / E4xxx Firebase→Supabase / E5xxx 보안 / E6xxx 비즈니스 / E7xxx 알 수 없음
```

→ 에러 코드는 Firebase 무관 (그대로 유지 가능)

---

## 7. 이전 전 사전 작업 체크리스트

### Phase 1 시작 전

- [ ] Supabase 프로젝트 생성 (ap-northeast-2)
- [ ] 환경 변수 파일 준비 (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] Twilio 계정 생성 (Phone SMS용) 또는 PortOne 본인인증으로 대체 결정
- [ ] Apple Developer에서 Supabase Auth callback URL 등록
- [ ] 도메인 모델 Timestamp → Date 일괄 변환 (16개 파일)
- [ ] `Unsubscribe` → `UnsubscribeFn = () => void` 추상 타입 생성
- [ ] `QueryDocumentSnapshot` → `PaginationCursor = unknown` 추상 타입 생성

### Phase 2 시작 전

- [ ] PostgreSQL 스키마 DDL 작성 및 리뷰
- [ ] RLS 정책 작성 (firestore.rules 1:1 대조)
- [ ] `src/repositories/supabase/` 디렉토리 생성
- [ ] Supabase Realtime 구독 패턴 프로토타입

### Phase 3 시작 전

- [ ] Edge Functions 프로젝트 (`supabase/functions/`) 초기화
- [ ] `@portone/server-sdk`, `expo-server-sdk` Deno 호환 확인
- [ ] `pg_cron` 활성화 확인 (Supabase 대시보드)
- [ ] Database Webhook 설정 테스트

---

*분석일: 2026-04-10*
