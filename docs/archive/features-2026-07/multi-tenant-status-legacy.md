> ⚠️ 아카이브 — 레거시 웹앱(app2)/Firebase 시절 문서. 현행 아님.

# 멀티 테넌트 아키텍처 구현 현황

**최종 업데이트**: 2026-04-18
**버전**: v1.0.0 (모바일앱 중심 / Supabase 기반)
**상태**: ✅ **100% 완료**

> **참고**: 이 문서는 레거시 웹앱(app2/)의 멀티테넌트 구현 현황(Firebase 시절)입니다.
> 모바일앱(uniqn-mobile/)은 Supabase PostgreSQL + RLS와 Repository 패턴, Zustand를 활용한 새로운 아키텍처를 사용합니다.
> 아래의 Firestore 경로 기반 설명은 레거시 기록이며, 현재 운영 기준은 PostgreSQL 테이블 + RLS 정책 조합입니다.

---

## 📊 전체 진행 상황

**구현 단계**: Phase 6/6 (100% 완료) 🎉

| Phase | 내용 | 상태 | 완료일 |
|-------|------|------|--------|
| Phase 1 | Store & Context에 userId 추가 | ✅ 완료 | 2025-01-17 |
| Phase 2 | Hook 시그니처 변경 | ✅ 완료 | 2025-01-17 |
| Phase 3 | 페이지 컴포넌트 수정 | ✅ 완료 | 2025-01-17 |
| Phase 4 | Hook 내부 구현 (일부) | ✅ 완료 | 2025-01-17 |
| Phase 5 | 테스트 및 검증 | ✅ 완료 | 2025-01-17 |
| Phase 6 | useTables 리팩토링 | ✅ 완료 | 2025-01-17 |

---

## ✅ 완료된 작업

### 1. TournamentContext & Store
**파일**: `src/contexts/TournamentContextAdapter.tsx`, `src/stores/tournamentStore.ts`

- ✅ `userId` 필드 추가
- ✅ AuthContext의 `currentUser` 변경 시 자동 동기화
- ✅ 모든 하위 컴포넌트에 userId 전파

```typescript
// TournamentContextAdapter.tsx (Lines 44-53)
useEffect(() => {
  if (currentUser?.uid && currentUser.uid !== store.userId) {
    logger.info('TournamentProvider: userId 업데이트', {
      component: 'TournamentContextAdapter',
      data: { userId: currentUser.uid }
    });
    store.setTournament({ userId: currentUser.uid });
  }
}, [currentUser, store]);
```

---

### 2. Hook 시그니처 변경

#### 2.1 useParticipants ✅
**파일**: `src/hooks/useParticipants.ts`

**시그니처**:
```typescript
export const useParticipants = (
  userId: string | null,
  tournamentId: string | null
) => { ... }
```

**멀티 테넌트 경로**:
```typescript
const participantsPath = `users/${userId}/tournaments/${tournamentId}/participants`;
```

**상태**: ✅ **완전 멀티 테넌트 구현 완료**
- Read: ✅
- Create: ✅
- Update: ✅
- Delete: ✅

---

#### 2.2 useSettings ✅
**파일**: `src/hooks/useSettings.ts`

**시그니처**:
```typescript
export const useSettings = (
  userId: string | null,
  tournamentId: string | null
) => { ... }
```

**멀티 테넌트 경로**:
```typescript
const settingsDocRef = doc(
  db,
  `users/${userId}/tournaments/${tournamentId}/settings`,
  'tournament'
);
```

**상태**: ✅ **완전 멀티 테넌트 구현 완료**
- Read: ✅
- Update: ✅

---

#### 2.3 useTables ✅
**파일**: `src/hooks/useTables.ts`

**시그니처**:
```typescript
export const useTables = (
  userId: string | null,
  tournamentId: string | null
) => { ... }
```

**상태**: ✅ **완전 멀티 테넌트 구현 완료 (레거시 Firestore 기록)**
- 21개 Firestore 경로 모두 멀티 테넌트 경로로 변경 (현재는 PostgreSQL 테이블 `tables`, `participants`, `tournament_settings` + `user_id` / `tournament_id` 컬럼 + RLS로 대체)
- Read: ✅ (useEffect 구독)
- Create: ✅ (openNewTable)
- Update: ✅ (updateTableDetails, updateTablePosition, updateTableOrder, activateTable)
- Delete: ✅ (closeTable)
- Complex: ✅ (moveSeat, bustOutParticipant, updateTableMaxSeats, rebalanceAndAssignAll, autoBalanceByChips)

**멀티 테넌트 경로 (현재)**:
```typescript
const tablesCollectionRef = collection(db, `users/${userId}/tournaments/${tournamentId}/tables`);
const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, tableId);
const settingsDocRef = doc(db, `users/${userId}/tournaments/${tournamentId}/settings`, 'config');
```

---

### 3. 페이지 컴포넌트 수정

#### 3.1 ParticipantsPage ✅
**파일**: `src/pages/ParticipantsPage.tsx`

```typescript
const { state } = useTournament();
const { participants, ... } = useParticipants(state.userId, state.tournamentId);
const { tables, ... } = useTables(state.userId, state.tournamentId);
```

**상태**: ✅ 완료

---

#### 3.2 TablesPage ✅
**파일**: `src/pages/TablesPage.tsx`

```typescript
const { state } = useTournament();
const { ... } = useTables(state.userId, state.tournamentId);
const { ... } = useParticipants(state.userId, state.tournamentId);
const { settings, ... } = useSettings(state.userId, state.tournamentId);
```

**상태**: ✅ 완료

---

#### 3.3 ShiftSchedulePage ✅
**파일**: `src/pages/ShiftSchedulePage.tsx`

```typescript
const { state: tournamentState } = useTournament();
const { tables, ... } = useTables(tournamentState.userId, tournamentState.tournamentId);
```

**변수명 충돌 해결**: `state` → `tournamentState`로 rename하여 `useUnifiedData`의 `state`와 충돌 방지

**상태**: ✅ 완료

---

## 🔍 검증 결과

### 1. TypeScript 타입 체크
```bash
npm run type-check
```
**결과**: ✅ **에러 0개**

---

### 2. 데이터 흐름 검증

#### AuthContext → TournamentContext
```
AuthContext.currentUser.uid
  ↓ (useEffect 자동 동기화)
TournamentContext.state.userId
  ↓ (prop drilling)
useParticipants(userId, tournamentId)
useSettings(userId, tournamentId)
useTables(userId, tournamentId) ← 아직 내부 레거시
```

**상태**: ✅ 데이터 흐름 정상

---

### 3. Firestore 경로 검증 (레거시 — 참고용)

| Hook | 레거시 Firestore 경로 | 상태 |
|------|------------------|------|
| useParticipants | `users/{userId}/tournaments/{tournamentId}/participants` | ✅ |
| useSettings | `users/{userId}/tournaments/{tournamentId}/settings/tournament` | ✅ |
| useTables | `users/{userId}/tournaments/{tournamentId}/tables` | ✅ |

**현재(Supabase) 대응**: PostgreSQL 테이블 `participants`, `tournament_settings`, `tables`에 `user_id`, `tournament_id` 컬럼 + RLS 정책 `using (auth.uid() = user_id)`으로 동일한 격리 효과.

---

## ⚠️ 알려진 이슈

~~### Issue #1: useTables 레거시 경로~~ ✅ **해결됨 (2025-01-17)**
**설명**: useTables가 여전히 글로벌 'tables' 컬렉션 사용

**해결 완료**:
- ✅ 21개 Firestore 경로 모두 멀티 테넌트 경로로 변경
- ✅ Type-check 통과
- ✅ Build 성공
- ✅ 모든 CRUD 작업 멀티 테넌트 경로 사용

---

## 📈 마이그레이션 영향 분석

### 데이터베이스 구조 변화

#### Before (레거시 — Firestore 시절)
```
Firestore
├── participants/          ← 모든 사용자 공유
├── settings/              ← 모든 사용자 공유
└── tables/                ← 모든 사용자 공유
```

#### Intermediate (레거시 멀티 테넌트 — Firestore)
```
Firestore
└── users/
    └── {userId}/
        └── tournaments/
            └── {tournamentId}/
                ├── participants/    ✅ 격리됨
                ├── settings/        ✅ 격리됨
                └── tables/          ✅ 격리됨
```

#### 현재 (Supabase PostgreSQL + RLS)
```
PostgreSQL (public schema)
├── participants (user_id, tournament_id, ...)        + RLS
├── tournament_settings (user_id, tournament_id, ...) + RLS
└── tables (user_id, tournament_id, ...)              + RLS
```

모든 테이블은 `user_id = auth.uid()` 기반 RLS 정책으로 격리됩니다.

---

### 데이터 마이그레이션 필요 여부

**현재 상황**:
- useParticipants, useSettings는 새 경로 사용
- 기존 데이터가 레거시 경로에 있을 경우 마이그레이션 필요

**마이그레이션 전략** (향후 — 참고용):
1. Supabase Edge Function 또는 SQL 마이그레이션 스크립트 작성
2. 레거시 데이터 → 새 PostgreSQL 테이블(user_id/tournament_id 컬럼 포함)로 INSERT
3. RLS 검증 후 레거시 데이터 삭제

*참고*: 2026-04-11 Firebase→Supabase 이전에서 실데이터 마이그레이션은 별도 계획으로 진행되었습니다.

---

## 🎯 다음 단계

### ✅ 완료된 작업 (2025-01-17)
- ✅ Phase 1-6 완료 및 검증됨
- ✅ 멀티 테넌트 아키텍처 100% 구현 완료
- ✅ useTables 리팩토링 완료 (21개 경로 변경)
- ✅ Type-check 통과
- ✅ Build 성공

### 향후 작업 (프로덕션 배포 전)
- [ ] **데이터 마이그레이션 스크립트** (현재 데이터 없음 - 필요 시 진행)
  - Supabase Edge Function 또는 SQL 스크립트 작성
  - 레거시 데이터 → PostgreSQL 테이블(user_id/tournament_id 컬럼)로 INSERT
  - 검증 및 롤백 전략 수립

- [ ] **통합 테스트 강화**
  - E2E 테스트 시나리오 작성
  - 멀티 테넌트 격리 검증
  - 성능 테스트 및 최적화

- ✅ **보안 규칙 업데이트** (레거시 완료 - 2025-01-17 / Supabase 이전 후 RLS로 대체됨)
  - ✅ (레거시) Firestore Security Rules 작성
  - ✅ (현재) Supabase RLS 정책으로 사용자별 데이터 격리 강제
  - ✅ 권한 검증 로직: `auth.uid() = user_id` 기반 RLS
  - ✅ 레거시 ruleset: 12925291-b09f-49bd-a478-9da7b54e6823 (현재는 사용하지 않음)

---

## 📝 커밋 이력

### 2025-01-17: Security Rules 배포 완료 🔒 (레거시 — Firestore)
```
feat: Firestore Security Rules 멀티 테넌트 지원 추가

**주요 변경사항** (레거시):
- users/{userId}/tournaments/{tournamentId} 경로에 대한 보안 규칙 추가
- Participants, Tables, Settings 서브컬렉션 권한 설정
- 본인 데이터만 접근 가능하도록 격리 (관리자는 모든 데이터 접근 가능)
- isOwner() 함수를 활용한 소유권 검증

**보안 정책** (레거시):
- 읽기: isSignedIn() && (isOwner(userId) || isPrivileged())
- 쓰기: isSignedIn() && (isOwner(userId) || isPrivileged())
- 삭제: Settings는 관리자만 가능

**배포** (레거시):
- Ruleset ID: 12925291-b09f-49bd-a478-9da7b54e6823
- 배포 일시: 2025-01-17

*현재 운영 기준*: 2026-04-11 Supabase 이전 이후 RLS 정책으로 대체됨.
예) `create policy "owner_only" on participants for all using (auth.uid() = user_id)`
```

### 2025-01-17: Phase 6 완료 🎉
```
feat: Phase 6 - useTables 멀티 테넌트 리팩토링 완료

**주요 변경사항**:
- useTables Hook 내 21개 Firestore 경로 모두 멀티 테넌트 경로로 변경
- useEffect 구독: tables, settings 모두 멀티 테넌트 경로
- CRUD 작업: Create, Read, Update, Delete 모두 변경
- Complex 작업: moveSeat, bustOutParticipant, closeTable 등 모두 변경
- 의존성 배열: 모든 함수에 userId, tournamentId 추가
- 가드 체크: 모든 함수에 `if (!userId || !tournamentId) return` 추가

**검증**:
- TypeScript 타입 체크 통과 ✅
- Build 성공 (307.35 kB main bundle) ✅
- 21개 수정 지점 모두 완료 ✅
```

### 2025-01-17: Phase 3 완료
```
feat: Phase 3 - 멀티 테넌트 아키텍처 페이지 컴포넌트 수정 완료

**주요 변경사항**:
- ParticipantsPage: state.userId, state.tournamentId 전달
- TablesPage: state.userId, state.tournamentId 전달
- ShiftSchedulePage: tournamentState.userId, tournamentState.tournamentId 전달
- ShiftSchedulePage 변수명 충돌 해결 (state → tournamentState)

**검증**:
- TypeScript 타입 체크 통과 ✅
- 모든 페이지가 TournamentContext에서 userId/tournamentId 가져옴
```

### 이전 커밋
- Phase 1: Store & Context에 userId 추가
- Phase 2: Hook 시그니처 변경

---

## 🔗 관련 문서

- [DEVELOPMENT_GUIDE.md](../core/DEVELOPMENT_GUIDE.md) - 개발 가이드
- [CLAUDE.md](../../CLAUDE.md) - 프로젝트 전체 가이드

---

*마지막 업데이트: 2026-04-18*
*작성자: Claude Code*
*상태: **Production Ready - 모바일앱 v1.0.0 (Supabase)** 🎉*
