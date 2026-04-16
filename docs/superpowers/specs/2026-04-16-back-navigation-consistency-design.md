# 뒤로가기 일관성 통일 설계 (Back Navigation Consistency)

- 작성일: 2026-04-16
- 작성자: Claude (superpowers:brainstorming)
- 대상 프로젝트: `uniqn-mobile`
- 상태: **구현 완료 (2026-04-16)** — 9개 그룹 단위 커밋으로 브랜치 `worktree-back-nav-consistency`에 반영. 전체 Jest 3523 테스트 통과, tsc/eslint 0 에러.

## 1. 배경

현재 앱에는 두 가지 뒤로가기 헤더 전략이 혼재한다.

1. **Expo Router 네이티브 헤더** — `Stack.Screen`의 `headerShown: true` + `headerLeft` 사용
   - 적용 위치: `(app)/_layout.tsx`, `(employer)/_layout.tsx`, `(admin)/_layout.tsx`, `(app)/settings/_layout.tsx`, `(app)/support/_layout.tsx`, `(app)/reviews/_layout.tsx`, `(app)/notices/_layout.tsx` 등
   - 문제: `options.title`을 누락하면 라우트 파일명(`employer-terms`)이 그대로 제목으로 노출되는 사고가 발생함. 다크모드/Black & Gold 테마 제어가 제한적.
2. **커스텀 `StackHeader` 컴포넌트** — `src/components/headers/StackHeader.tsx`
   - 적용 위치: Board 하위(`write`, `post/[postId]`, `edit/[postId]`), `notifications.tsx`
   - 장점: `title` prop 필수 → 파일명 노출 사고 구조적 방지. 테마/다크모드 일관 제어. `rightAction` 슬롯 지원.

또한 일부 내부 화면은 헤더 자체가 없어 **뒤로가기 경로가 완전히 누락**되어 있다 (예: `app/(app)/jobs/[id]/apply.tsx`).

## 2. 목표

- 모든 내부 라우트 화면의 뒤로가기 UX를 `StackHeader`로 단일화한다.
- 레이아웃은 `headerShown: false`로 통일하여 중복 헤더/파일명 노출 사고를 구조적으로 차단한다.
- 뒤로가기가 완전히 누락된 화면(`jobs/[id]/apply.tsx`)을 복구한다.
- `JobDetailHeader`처럼 중복된 헤더 추상화를 제거하거나 `StackHeader`로 수렴시킨다.

## 3. 비목표 (Out of Scope)

- `profile-setup.tsx`의 강제 온보딩 정책 변경 — 헤더 없음 상태 유지.
- 탭 루트(`(app)/(tabs)/*`)의 헤더 구조 변경 — 탭 자체가 최상위 네비게이션이므로 유지.
- 인증 화면(`(auth)/login`, `signup`, `forgot-password`)의 헤더 구조 변경 — 진입 화면이므로 현 상태 유지.
- 모달/시트 컴포넌트의 `onClose` 패턴 변경.
- `HeaderBackButton` 내부 동작(`canGoBack` → `fallbackHref` 체인) 변경.

## 4. 아키텍처

원칙: **"레이아웃은 헤더를 끄고, 화면은 `StackHeader`를 켠다."**

```
Stack.Screen (Expo Router)
└─ headerShown: false           ← 모든 내부 라우트 레이아웃
   └─ <SafeAreaView>
      └─ <StackHeader title="..." fallbackHref="..." rightAction={...} />
      └─ <본문>
```

### 4.1 적용 대상 그룹

- `(app)/` 하위 모든 내부 라우트(탭 제외)
- `(employer)/` 하위 모든 내부 라우트
- `(admin)/` 하위 모든 내부 라우트
- `(public)/` 중 뒤로가기 필요한 화면(예: `jobs/index.tsx`)

### 4.2 예외 (헤더 없음 유지)

- 탭 루트: `(app)/(tabs)/index.tsx`, `employer.tsx`, `qr.tsx`, `schedule.tsx`, `profile.tsx`, `board/index.tsx`, `board/[boardType].tsx`
- `(app)/home.tsx` — 인증 진입점. `TabHeader`(로고/QR/알림 배지) 유지 (구현 중 발견)
- `profile-setup.tsx` (강제 온보딩)
- 인증 화면: `(auth)/login.tsx`, `signup.tsx`, `forgot-password.tsx`
- 리다이렉트/에일리어스 전용: `app/index.tsx`, `+not-found.tsx`, `admin/index.tsx`, `admin/[...slug].tsx`, `employer/index.tsx`, `employer/[...slug].tsx`, `jobs/index.tsx`, `jobs/[id].tsx`는 실제론 UI 렌더 (에일리어스 아님, 마이그레이션 적용됨), `(public)/jobs/index.tsx` (redirect-only 판명), `applications/[id]/cancel.tsx` (redirect-only 확인)

### 4.3 `StackHeader` 표준 스펙 (현행 유지)

현재 `src/components/headers/StackHeader.tsx`의 Props를 그대로 사용한다.

```typescript
interface StackHeaderProps {
  title: string;                  // 필수 — 한글 타이틀 강제
  titleSuffix?: React.ReactNode;  // 타이틀 옆 보조 UI (배지 등)
  showBack?: boolean;             // 기본값: true
  fallbackHref?: string;          // 기본값: '/(app)/(tabs)'
  rightAction?: React.ReactNode;  // 공유/신고/저장 등
}
```

### 4.4 `fallbackHref` 가이드라인

- 내부 화면: 논리적 부모 경로 지정 (예: `/settings/profile` → `fallbackHref="/settings"`).
- 딥링크 진입 시 백스택이 비어도 `HeaderBackButton`이 `canGoBack` 체크 후 `fallbackHref`로 폴백.
- `(public)/jobs/index.tsx`는 비로그인 접근 가능 → `fallbackHref="/(auth)/login"` 또는 `/` 신중 결정.

## 5. 변경 범위

### 5.1 레이아웃 변경 (8개 파일 — 전부 `headerShown: false`)

| 파일 |
|---|
| `app/(app)/_layout.tsx` |
| `app/(employer)/_layout.tsx` |
| `app/(admin)/_layout.tsx` |
| `app/(app)/settings/_layout.tsx` |
| `app/(app)/support/_layout.tsx` |
| `app/(app)/reviews/_layout.tsx` |
| `app/(app)/notices/_layout.tsx` |
| `app/(employer)/my-postings/[id]/_layout.tsx` |

### 5.2 `StackHeader` 신규 적용 (Critical, 2개)

| 파일 | 타이틀 후보 | fallbackHref |
|---|---|---|
| `app/(app)/jobs/[id]/apply.tsx` | "지원하기" | `/(app)/jobs/${id}` |
| `app/(app)/jobs/[id]/index.tsx` | "공고 상세" | `/(app)/(tabs)` (공고 리스트는 `(tabs)/index.tsx`) |

- `jobs/[id]/index.tsx`의 기존 `JobDetailHeader`는 `rightAction` 슬롯으로 이관하고 컴포넌트 자체는 제거 검토 (오픈 이슈 O1).

### 5.3 네이티브 헤더 → `StackHeader` 마이그레이션 (약 48개)

- **Settings 10**: `business-info`, `change-password`, `employer-terms`, `liability-waiver`, `my-data`, `privacy`, `profile`, `terms`, `delete-account`, `index`
- **Support 5**: `index`, `create-inquiry`, `faq`, `inquiry/[id]`, `my-inquiries`
- **Reviews 4**: `history`, `pending`, `write`, `[workLogId]`
- **Notices 2**: `index`, `[id]`
- **Admin 17**: `index`, `announcements/index`, `announcements/create`, `announcements/[id]/index`, `announcements/[id]/edit`, `board-reports/index`, `board-reports/[id]`, `inquiries/index`, `inquiries/[id]`, `reports/index`, `reports/[id]`, `tournaments/index`, `users/index`, `users/[id]`, `stats/index`, `employer-applications/index`, `employer-applications/[id]`
- **Employer my-postings 6**: `create`, `[id]/index`, `[id]/applicants`, `[id]/cancellation-requests`, `[id]/edit`, `[id]/settlements`
- **기타 4**: `(app)/employer-register`, `(app)/employer-application-status`, `(app)/home`, `(public)/jobs/index`

### 5.4 변경 없음 (이미 `StackHeader` 사용, 4개)

- `app/(app)/(tabs)/board/write.tsx`
- `app/(app)/(tabs)/board/post/[postId].tsx`
- `app/(app)/(tabs)/board/edit/[postId].tsx`
- `app/(app)/notifications.tsx`

**총 변경 규모: 레이아웃 8 + 화면 48 + 신규 `StackHeader` 추가 2 ≈ 58개 파일**

## 6. 테스트/검증 전략

### 6.1 정적 검증 (필수)

```bash
cd uniqn-mobile
npm run quality   # type-check + lint + format:check
npm test          # Jest
```

`StackHeader`의 `title`이 필수 prop이므로 누락 시 TypeScript 에러로 차단된다.

### 6.2 구조적 Lint 스크립트 (신규, 선택)

- `app/**/_layout.tsx`에서 `headerShown: true` 또는 `headerLeft` 사용 검출 시 경고 (예외 목록 제외).
- 내부 라우트 화면에 `StackHeader` import/렌더 존재 여부 검사.

### 6.3 수동 스모크 체크리스트 (PR 템플릿화)

| 그룹 | 체크 화면 | 검증 포인트 |
|---|---|---|
| Settings | `/settings/profile` → `/settings` | 뒤로 + fallbackHref |
| Reviews | `/reviews/write` → `/reviews/pending` | 한글 타이틀 표시 |
| Jobs | `/jobs/[id]/apply` → `/jobs/[id]` | **신규 추가 확인** |
| Employer | `/my-postings/[id]/applicants` | 중첩 레이아웃 폴백 |
| Admin | `/users/[id]` → `/users` | 전체 그룹 동작 |
| Board | `/board/write` | 기존 동작 유지 확인 |

Dark/Light 모드 각 1회 확인 필요.

### 6.4 하드웨어 백 버튼

`HeaderBackButton` 내부 `canGoBack → router.back() / fallbackHref` 체인 기존 유지 — 별도 테스트 추가 불필요.

### 6.5 롤백 전략

레이아웃/화면 변경이 독립적 → **그룹 단위 커밋**으로 분리 (Settings, Support, Reviews, Notices, Admin, Employer, Jobs). 문제 발견 시 해당 그룹만 revert.

## 7. 리스크

| # | 리스크 | 대응 |
|---|---|---|
| R1 | `fallbackHref` 오타/잘못된 경로 → 엉뚱한 화면 이동 | PR 체크리스트에 각 화면 `fallbackHref` 명시, 스모크 테스트로 검증 |
| R2 | 기존 네이티브 `headerRight`(공유/신고/저장 버튼)의 액션 유실 | 마이그레이션 전 `headerRight` 사용처 grep → `rightAction` prop으로 1:1 이관 |
| R3 | `JobDetailHeader` 제거 시 고유 UI 손실 | 컴포넌트 스펙 선조사, 이식 가능 확인 후 진행 (오픈 이슈 O1) |
| R4 | 딥링크 진입 시 백스택이 비어 `router.back()` 실패 | `HeaderBackButton`의 `canGoBack` 폴백 로직 기존 유지 |
| R5 | Alias/redirect 라우트 오변경 | 변경 범위에서 명시적 제외 (§4.2) |
| R6 | `(public)/jobs/index.tsx` 비로그인 진입 시 fallbackHref | 비로그인 기본 진입점(`/` 또는 `(auth)/login`) 신중 결정 |

## 8. 오픈 이슈

- **O1**: `src/components/headers/JobDetailHeader.tsx`의 현재 렌더 내용(`rightAction` 이식 가능 여부) 확인. 실행 계획 작성 단계에서 첫 태스크로 조사.
- **O2**: Admin/Employer 그룹 레이아웃에 화면별 커스터마이즈(동적 `headerTitle` 함수 등)가 있는지 사전 조사. 있다면 `titleSuffix` 또는 `title` 동적 계산으로 이식.

## 9. 다음 단계

1. 본 스펙 사용자 승인 후 `superpowers:writing-plans` 스킬 호출하여 실행 계획 작성.
2. 실행 계획에서 O1/O2 해소를 가장 먼저 수행하는 태스크로 배치.
3. 그룹 단위 PR 롤아웃 계획 수립.
