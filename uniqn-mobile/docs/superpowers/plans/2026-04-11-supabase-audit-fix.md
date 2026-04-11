# Supabase 감사 수정 + Phase 4 Firebase 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 감사에서 발견된 타입 불일치, 성능 병목, dead code를 수정하고 Firebase를 완전히 제거한다.

**Architecture:** A1(에러 리네임) 완료 상태에서, 타입 정비(A4) → Realtime 최적화(B) → 쿼리 최적화(C) → Firebase 제거(D) → 테스트 정비(E) 순서로 진행. 각 Phase는 독립 커밋.

**Tech Stack:** TypeScript 5.9, Supabase PostgREST, TanStack Query 5, Zod 4, Jest 29

---

## Task 1: JobPostingStatus 타입 확장 (A4)

**Files:**

- Modify: `src/types/jobPosting.ts:29`
- Modify: `src/schemas/jobPosting.schema.ts:106,451`
- Modify: `src/constants/statusConfig.ts:227-244`
- Modify: `src/constants/statusValues.ts:37-41`
- Modify: `src/components/jobs/shared/postingSurfaceModel.ts:125-135`

- [ ] **Step 1: 타입 확장**

`src/types/jobPosting.ts:29`:

```typescript
export type JobPostingStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'active'
  | 'closed'
  | 'cancelled'
  | 'expired'
  | 'rejected';
```

- [ ] **Step 2: Zod 스키마 동기화**

`src/schemas/jobPosting.schema.ts` — 두 곳 모두 업데이트:

```typescript
// line 106 (filter schema)
status: z.enum(['draft', 'pending', 'approved', 'active', 'closed', 'cancelled', 'expired', 'rejected']).optional(),

// line 451 (document schema)
status: z.enum(['draft', 'pending', 'approved', 'active', 'closed', 'cancelled', 'expired', 'rejected']),
```

- [ ] **Step 3: 상수 업데이트**

`src/constants/statusValues.ts:37-41`:

```typescript
export const JOB_POSTING_STATUS_VALUES = {
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  REJECTED: 'rejected',
} as const satisfies Record<string, JobPostingStatusType>;
```

`src/constants/statusConfig.ts` — `JobPostingStatusType` 업데이트 + 5개 신규 상태에 UI 설정 추가:

```typescript
export type JobPostingStatusType = 'draft' | 'pending' | 'approved' | 'active' | 'closed' | 'cancelled' | 'expired' | 'rejected';

// JOB_POSTING_STATUS에 추가:
draft: { label: '임시저장', variant: 'outline', textColor: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-surface', hexColor: '#9CA3AF' },
pending: { label: '승인대기', variant: 'warning', textColor: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', hexColor: '#EAB308' },
approved: { label: '승인완료', variant: 'info', textColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30', hexColor: '#3B82F6' },
expired: { label: '만료됨', variant: 'default', textColor: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-surface', hexColor: '#6B7280' },
rejected: { label: '거절됨', variant: 'destructive', textColor: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', hexColor: '#EF4444' },
```

- [ ] **Step 4: switch-case 보강**

`src/components/jobs/shared/postingSurfaceModel.ts:125-135`:

```typescript
export function getPostingStatusMeta(status: JobPostingStatus): PostingStatusMeta {
  switch (status) {
    case 'draft':
      return { label: '임시저장', variant: 'outline' };
    case 'pending':
      return { label: '승인대기', variant: 'warning' };
    case 'approved':
      return { label: '승인완료', variant: 'info' };
    case 'closed':
    case 'expired':
      return { label: status === 'closed' ? '마감' : '만료됨', variant: 'default' };
    case 'cancelled':
    case 'rejected':
      return { label: status === 'cancelled' ? '취소됨' : '거절됨', variant: 'error' };
    case 'active':
    default:
      return { label: '모집중', variant: 'success' };
  }
}
```

- [ ] **Step 5: tsc 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/types/jobPosting.ts src/schemas/jobPosting.schema.ts src/constants/statusConfig.ts src/constants/statusValues.ts src/components/jobs/shared/postingSurfaceModel.ts
git commit -m "feat(mobile): JobPostingStatus 8개 enum 확장 (DB 스키마 동기화)"
```

---

## Task 2: Realtime 에러 핸들링 강화 (B1)

**Files:**

- Modify: `src/utils/supabase.ts:379-409`

- [ ] **Step 1: createRealtimeSubscription 에러 처리 추가**

`src/utils/supabase.ts` — 함수 시그니처에 `onError` 추가, subscribe 콜백에서 에러 상태 처리:

```typescript
export function createRealtimeSubscription(
  table: string,
  filter: string | undefined,
  callback: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void,
  onError?: (status: string) => void
): UnsubscribeFn {
  const channelName = `realtime:${table}:${filter ?? 'all'}`;

  const channelConfig = {
    event: '*' as const,
    schema: 'public' as const,
    table,
    ...(filter ? { filter } : {}),
  };

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      channelConfig,
      callback as (payload: RealtimePostgresChangesPayload<{ [key: string]: string }>) => void
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        logger.info('Realtime 구독 시작', { table, filter });
      } else if (status === 'CHANNEL_ERROR') {
        logger.error('Realtime 채널 에러', new Error(`CHANNEL_ERROR: ${table}`), { table, filter });
        onError?.('CHANNEL_ERROR');
      } else if (status === 'TIMED_OUT') {
        logger.warn('Realtime 구독 타임아웃', { table, filter });
        onError?.('TIMED_OUT');
      } else if (status === 'CLOSED') {
        logger.info('Realtime 채널 종료', { table, filter });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
```

- [ ] **Step 2: tsc 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors (onError는 optional이므로 기존 호출자 깨지지 않음)

---

## Task 3: WorkLog Realtime → polling 전환 (B2)

**Files:**

- Modify: `src/repositories/supabase/WorkLogRepository.ts:523-653`
- Modify: `src/repositories/interfaces/IWorkLogRepository.ts:200-273`
- Modify: `src/services/work/workLogService.ts:317-400`
- Modify: `src/services/work/scheduleService.ts:630`

- [ ] **Step 1: IWorkLogRepository 인터페이스에서 4개 subscribe → 일반 조회 메서드 문서화**

4개 subscribe 메서드(subscribeByDate, subscribeByStaffId, subscribeByStaffIdWithFilters, subscribeTodayActive)를 **삭제하지 않고** deprecated 표시. 기존 `getByDate`, `getByStaffId`, `getByStaffIdWithFilters` 조회 메서드가 이미 존재하므로 polling은 서비스/훅 레이어에서 `refetchInterval`로 구현.

- [ ] **Step 2: WorkLogRepository에서 4개 subscribe 메서드를 deprecated 처리**

`src/repositories/supabase/WorkLogRepository.ts` — 각 메서드에 `@deprecated` JSDoc 추가. 메서드 내부에서 기존 조회 메서드를 한 번 호출한 후 빈 unsubscribe 반환하도록 변경 (Realtime 구독 제거):

```typescript
/** @deprecated polling으로 전환됨. getByDate + refetchInterval 사용 */
subscribeByDate(
  staffId: string,
  date: string,
  onData: (workLogs: WorkLog[]) => void,
  onError: (error: Error) => void
): UnsubscribeFn {
  void this.getByDate(staffId, date).then(onData).catch(onError);
  return () => {};
}
```

나머지 3개(subscribeByStaffId, subscribeByStaffIdWithFilters, subscribeTodayActive)도 동일 패턴 적용.

- [ ] **Step 3: 서비스 레이어 polling 전환**

`src/services/work/workLogService.ts` — `subscribeToMyWorkLogs`과 `subscribeToTodayWorkStatus`에서 `RealtimeManager.subscribe` 대신 **초기 1회 호출**만 수행하고 반환. 실제 polling은 훅의 `refetchInterval`이 담당.

- [ ] **Step 4: tsc 검증**

Run: `npx tsc --noEmit`
Expected: 0 errors

---

## Task 4: 알림 캐시 증분 업데이트 (B3)

**Files:**

- Modify: `src/repositories/supabase/NotificationRepository.ts:577-629`

- [ ] **Step 1: Realtime 콜백에서 payload 기반 증분 업데이트**

`src/repositories/supabase/NotificationRepository.ts` — subscribeToNotifications의 Realtime 콜백을 payload 이벤트 타입별로 분기:

```typescript
const unsubscribe = createRealtimeSubscription(
  TABLES.NOTIFICATIONS,
  `recipient_id=eq.${userId}`,
  (payload) => {
    const eventType = payload.eventType;
    if (eventType === 'INSERT' && payload.new) {
      const newNotification = toNotification(payload.new as Record<string, unknown>);
      onNotifications(
        [newNotification, ...currentNotifications].slice(0, NOTIFICATION_REALTIME_LIMIT)
      );
      currentNotifications = [newNotification, ...currentNotifications].slice(
        0,
        NOTIFICATION_REALTIME_LIMIT
      );
    } else if (eventType === 'UPDATE' && payload.new) {
      const updated = toNotification(payload.new as Record<string, unknown>);
      currentNotifications = currentNotifications.map((n) => (n.id === updated.id ? updated : n));
      onNotifications(currentNotifications);
    } else if (eventType === 'DELETE' && payload.old) {
      const deletedId = (payload.old as Record<string, unknown>).id as string;
      currentNotifications = currentNotifications.filter((n) => n.id !== deletedId);
      onNotifications(currentNotifications);
    } else {
      // 알 수 없는 이벤트 — 전체 재조회 fallback
      void fullReload();
    }
  }
);
```

- [ ] **Step 2: tsc 검증 + 커밋**

Run: `npx tsc --noEmit`

```bash
git add src/utils/supabase.ts src/repositories/supabase/WorkLogRepository.ts src/repositories/supabase/NotificationRepository.ts src/services/work/workLogService.ts
git commit -m "perf(mobile): Realtime 최적화 — WorkLog polling + 알림 증분 캐시 + 에러 핸들링"
```

---

## Task 5: SELECT \* → 명시적 컬럼 (C1)

**Files:**

- Modify: 15개 `src/repositories/supabase/*.ts` 파일

- [ ] **Step 1: 각 Repository에 TABLE_COLUMNS 상수 정의**

`database.types.ts`의 Row 타입에서 컬럼 목록을 추출하여 각 Repository 상단에 상수로 정의. 예시:

```typescript
// UserRepository.ts
const USER_COLUMNS =
  'id,email,nickname,name,phone,photo_url,role,status,birth_date,career,bubble_score,fcm_tokens,created_at,updated_at' as const;
```

- [ ] **Step 2: .select('\*') → .select(TABLE_COLUMNS) 교체**

15개 파일의 80개 인스턴스를 일괄 교체. 단, 단일 필드만 필요한 쿼리(verifyOwnership 등)는 더 작은 컬럼 집합 사용.

- [ ] **Step 3: tsc 검증**

Run: `npx tsc --noEmit`

---

## Task 6: getStatsByOwnerId RPC (C2)

**Files:**

- Supabase DB: RPC 함수 생성
- Modify: `src/repositories/supabase/JobPostingRepository.ts:528-562`

- [ ] **Step 1: Supabase RPC 함수 생성**

Supabase SQL Editor 또는 migration:

```sql
CREATE OR REPLACE FUNCTION get_job_posting_stats(p_owner_id uuid)
RETURNS TABLE(total bigint, active bigint, closed bigint, cancelled bigint, total_applications bigint, total_views bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'active'),
    count(*) FILTER (WHERE status = 'closed'),
    count(*) FILTER (WHERE status = 'cancelled'),
    coalesce(sum((stats->>'totalApplicants')::int), 0),
    coalesce(sum(view_count), 0)
  FROM job_postings
  WHERE owner_id = p_owner_id
    AND status IN ('active', 'closed', 'cancelled');
$$;
```

- [ ] **Step 2: Repository 메서드 교체**

`src/repositories/supabase/JobPostingRepository.ts:528-562`:

```typescript
async getStatsByOwnerId(ownerId: string): Promise<JobPostingStats> {
  try {
    logger.info('소유자 공고 통계 조회', { ownerId });
    const { data, error } = await supabase.rpc('get_job_posting_stats', { p_owner_id: ownerId });
    if (error) handleSupabaseError(error, { operation: '소유자 공고 통계 조회', table: TABLE });

    const row = Array.isArray(data) ? data[0] : data;
    return {
      total: Number(row?.total ?? 0),
      active: Number(row?.active ?? 0),
      closed: Number(row?.closed ?? 0),
      cancelled: Number(row?.cancelled ?? 0),
      totalApplications: Number(row?.total_applications ?? 0),
      totalViews: Number(row?.total_views ?? 0),
    };
  } catch (error) {
    rethrowOrHandle(error, '소유자 공고 통계 조회', { ownerId });
  }
}
```

---

## Task 7: Json 필드 Zod 검증 (C3)

**Files:**

- Modify: `src/utils/supabase.ts` — safeParseJson 유틸 추가
- Modify: `src/repositories/supabase/BoardRepository.ts:60-120`
- Modify: 기타 Repository에서 Json 캐스팅 부분

- [ ] **Step 1: safeParseJson 유틸 추가**

`src/utils/supabase.ts`:

```typescript
import type { ZodType } from 'zod';

export function safeParseJson<T>(
  schema: ZodType<T>,
  data: unknown,
  fallback: T,
  context?: string
): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  logger.warn('Json 필드 파싱 실패', { context, errors: result.error.issues.slice(0, 3) });
  return fallback;
}
```

- [ ] **Step 2: BoardRepository Json 캐스팅 교체**

```typescript
// Before:
imageAttachments: (row.image_attachments as BoardImageAttachment[]) ?? [],

// After:
imageAttachments: safeParseJson(boardImageAttachmentsSchema, row.image_attachments, [], 'board_post.image_attachments'),
```

- [ ] **Step 3: 나머지 Repository 동일 패턴 적용**

ApplicationRepository, AnnouncementRepository, WorkLogRepository, UserRepository, NotificationRepository의 Json 필드에 동일 적용.

---

## Task 8: DB CHECK 제약조건 (C4)

**Files:**

- Supabase DB: migration

- [ ] **Step 1: CHECK 제약조건 마이그레이션**

```sql
ALTER TABLE board_posts ADD CONSTRAINT chk_board_post_status
  CHECK (status IN ('active', 'locked', 'hidden', 'archived'));

ALTER TABLE board_comments ADD CONSTRAINT chk_board_comment_status
  CHECK (status IN ('active', 'hidden', 'deleted'));

ALTER TABLE board_comments ADD CONSTRAINT chk_board_comment_author_role
  CHECK (author_role IN ('admin', 'employer', 'staff', 'system'));

ALTER TABLE reports ADD CONSTRAINT chk_report_status
  CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed'));

ALTER TABLE reports ADD CONSTRAINT chk_report_type
  CHECK (type IN ('spam', 'harassment', 'inappropriate', 'fraud', 'other'));
```

- [ ] **Step 2: 커밋**

```bash
git add src/utils/supabase.ts src/repositories/supabase/*.ts
git commit -m "perf(mobile): SELECT * 제거 + Json Zod 검증 + RPC 집계 + DB CHECK 제약"
```

---

## Task 9: Firebase 제거 — Repository + 유틸리티 (D1-D2)

**Files:**

- Delete: `src/repositories/firebase/` (전체 폴더)
- Delete: `src/lib/firebase.ts`
- Delete: `src/lib/emulatorMode.ts`
- Delete: `src/utils/firestore.ts`
- Delete: `src/utils/firestore/` (전체 폴더)
- Delete: `src/utils/authFirestoreSync.ts`

- [ ] **Step 1: Firebase Repository 폴더 삭제**

```bash
rm -rf src/repositories/firebase/
```

- [ ] **Step 2: Firebase 유틸리티 삭제**

```bash
rm src/lib/firebase.ts src/lib/emulatorMode.ts src/utils/firestore.ts src/utils/authFirestoreSync.ts
rm -rf src/utils/firestore/
```

- [ ] **Step 3: tsc 확인 — 깨지는 import 식별**

Run: `npx tsc --noEmit 2>&1 | head -100`
Expected: import 에러 목록 → 다음 Task에서 정리

---

## Task 10: Firebase 제거 — 에러 시스템 + 서비스 정리 (D3-D5)

**Files:**

- Delete: `src/errors/firebaseErrorMapper.ts`
- Modify: `src/errors/serviceErrorHandler.ts:32,188-207`
- Modify: `src/errors/errorUtils.ts:9,122-123,296-298`
- Modify: `src/errors/index.ts:69-75`
- Modify: `src/services/boardService.ts`
- Modify: `src/services/admin/tournamentApprovalService.ts`
- Modify: `src/services/jobs/applicantManagementService.ts`
- Modify: `src/services/observability/analyticsService.ts`
- Modify: `src/services/observability/performanceService.ts`

- [ ] **Step 1: 3개 서비스에서 mapFirebaseError 제거**

각 서비스의 try-catch에서 `mapFirebaseError` 호출을 제거. 에러는 이미 `handleServiceError` → `normalizeError`를 통해 처리됨.

- [ ] **Step 2: firebaseErrorMapper 삭제**

```bash
rm src/errors/firebaseErrorMapper.ts
rm src/errors/__tests__/firebaseErrorMapper.test.ts
```

- [ ] **Step 3: serviceErrorHandler에서 Firebase 분기 제거**

`src/errors/serviceErrorHandler.ts`:

```typescript
// 제거: import { mapFirebaseError, isFirebaseError } from './firebaseErrorMapper';

// 기존:
// if (isFirebaseError(error)) { appError = mapFirebaseError(error); }
// 변경:
let appError: AppError = normalizeError(error);
```

- [ ] **Step 4: errorUtils에서 Firebase 분기 제거**

`src/errors/errorUtils.ts` — `isFirebaseError` import 제거, normalizeError와 extractUserMessage에서 Firebase 분기 제거.

- [ ] **Step 5: errors/index.ts re-export 제거**

5개 함수 export 제거: `mapFirebaseError`, `mapFirebaseAuthError`, `mapFirebaseFirestoreError`, `mapFirebaseStorageError`, `isFirebaseError`

- [ ] **Step 6: Observability 서비스 Firebase 제거**

`analyticsService.ts`:

```typescript
// 제거: import { getFirebaseApp } from '@/lib/firebase';
// Analytics 호출 → logger.info 스텁으로 교체
```

`performanceService.ts`:

```typescript
// 제거: import { isPerformanceAvailable } from '@/lib/firebase';
const isPerformanceAvailable = (): boolean => false;
```

- [ ] **Step 7: tsc 검증**

Run: `npx tsc --noEmit`

---

## Task 11: Firebase 제거 — 패키지 + 환경변수 + 설정 (D6-D8)

**Files:**

- Modify: `src/lib/index.ts:9`
- Rename: `src/constants/firebase.ts` → `src/constants/database.ts`
- Modify: `src/lib/env.ts`
- Modify: `package.json`
- Modify: `.env.local`, `.env.example`

- [ ] **Step 1: lib/index.ts Firebase re-export 제거**

Line 9 삭제: `export { app, auth, db, storage, functions } from './firebase';`

- [ ] **Step 2: constants 리네임**

```bash
mv src/constants/firebase.ts src/constants/database.ts
```

파일 내부: `FIREBASE_LIMITS` → `DATABASE_LIMITS`, import 참조 업데이트.

- [ ] **Step 3: env.ts Firebase 필드 제거**

`src/lib/env.ts` — Zod 스키마에서 `EXPO_PUBLIC_FIREBASE_*` 12개 필드 전부 제거. `EXPO_PUBLIC_FIREBASE_REGION` 제거.

- [ ] **Step 4: .env 파일 정리**

`.env.local`, `.env.example`에서 FIREBASE 환경변수 제거.

- [ ] **Step 5: npm uninstall**

```bash
npm uninstall firebase @react-native-firebase/app @react-native-firebase/auth
npm uninstall -D firebase-admin
```

- [ ] **Step 6: tsc + lint 검증**

Run: `npm run quality`

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "chore(mobile): Firebase 전체 제거 (Phase 4 완료)"
```

---

## Task 12: 테스트 인프라 정비 (E1-E3)

**Files:**

- Modify: `jest.setup.js:125-237`
- Delete: `src/__tests__/mocks/MockTimestamp.js`
- Modify: ~12개 테스트 파일
- Create: `src/repositories/supabase/__tests__/` (5개 파일)

- [ ] **Step 1: jest.setup.js Firebase mock 제거**

Lines 125-237의 Firebase SDK mock 전체 삭제:

- `firebase/app`, `firebase/auth`, `firebase/firestore`, `firebase/storage`, `firebase/functions` mock
- `@/lib/firebase` mock
- `MockTimestamp` global 설정

- [ ] **Step 2: Supabase 글로벌 mock 추가**

jest.setup.js에 Supabase PostgREST 체이닝 mock 추가:

```javascript
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    functions: { invoke: jest.fn().mockResolvedValue({ data: null, error: null }) },
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((cb) => {
        cb?.('SUBSCRIBED');
        return {};
      }),
    })),
    removeChannel: jest.fn(),
  },
}));
```

- [ ] **Step 3: MockTimestamp 삭제 + 테스트 파일 ISO string 교체**

```bash
rm src/__tests__/mocks/MockTimestamp.js
```

12개 테스트에서 `Timestamp.fromDate(date)` → `date.toISOString()`, `Timestamp.now()` → `new Date().toISOString()` 교체.

- [ ] **Step 4: Supabase Repository 테스트 5개 작성**

`src/repositories/supabase/__tests__/` 디렉토리에 각 Repository의 핵심 메서드 테스트:

1. `UserRepository.test.ts` — getById, update, search
2. `JobPostingRepository.test.ts` — getList (pagination), getStatsByOwnerId (RPC)
3. `ApplicationRepository.test.ts` — create, updateStatus, loadApplication
4. `WorkLogRepository.test.ts` — getByDate, getByStaffId
5. `NotificationRepository.test.ts` — getByUserId, markAsRead

- [ ] **Step 5: 전체 테스트 실행**

Run: `npm test -- --silent`
Expected: 기존 통과 테스트 유지 + 신규 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "test(mobile): Supabase 테스트 인프라 + Repository 테스트 5개"
```

---

## Task 13: 최종 검증 (F)

- [ ] **Step 1: 품질 게이트**

```bash
npm run quality
```

- [ ] **Step 2: 전체 테스트**

```bash
npm test
```

- [ ] **Step 3: Firebase 잔존 확인**

```bash
grep -r "firebase" src/ --include="*.ts" --include="*.tsx" -l
```

Expected: 0건 (logger.firebase 메서드명만 예외)

- [ ] **Step 4: 최종 커밋 + 푸시**

```bash
git push origin master
```
