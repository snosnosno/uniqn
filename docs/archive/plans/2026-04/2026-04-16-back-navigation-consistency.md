# 뒤로가기 일관성 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 내부 라우트 화면의 뒤로가기 헤더를 `StackHeader` 단일 컴포넌트로 통일하고, 뒤로가기가 누락된 화면을 복구한다.

**Architecture:** "레이아웃은 헤더를 끄고, 화면은 `StackHeader`를 켠다." 모든 `_layout.tsx`는 `headerShown: false`로 통일, 모든 내부 라우트 화면은 `<StackHeader title="..." fallbackHref="..." />`를 최상단에 렌더한다. `profile-setup`, 탭 루트, 인증 화면은 예외.

**Tech Stack:** Expo Router (file-based routing) · React Native 0.83.4 · NativeWind 4.2 · TypeScript strict · Jest · 기존 `src/components/headers/StackHeader.tsx` · `src/components/navigation/HeaderBackButton.tsx`

**Spec Reference:** `docs/superpowers/specs/2026-04-16-back-navigation-consistency-design.md`

---

## 공통 마이그레이션 패턴

### 패턴 A — 레이아웃 `_layout.tsx` 변경

**Before (네이티브 헤더 사용 레이아웃):**
```tsx
import { Stack } from 'expo-router';
import { HeaderBackButton } from '@/components/navigation';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function GroupLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: getLayoutColor(isDark, 'header') },
        headerTintColor: getLayoutColor(isDark, 'headerTint'),
        headerTitleStyle: { fontFamily: 'Outfit_600SemiBold', fontWeight: '600' },
        headerLeft: () => (
          <HeaderBackButton
            tintColor={getLayoutColor(isDark, 'headerTint')}
            fallbackHref="/(app)/(tabs)"
          />
        ),
        contentStyle: { backgroundColor: getLayoutColor(isDark, 'content') },
      }}
    />
  );
}
```

**After (헤더 off, 콘텐츠 배경만 유지):**
```tsx
import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function GroupLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: getLayoutColor(isDark, 'content') },
      }}
    />
  );
}
```

### 패턴 B — 화면에 `StackHeader` 추가

**Before (레이아웃 네이티브 헤더에 의존하는 화면):**
```tsx
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <View>{/* 본문 */}</View>
    </SafeAreaView>
  );
}
```

**After:**
```tsx
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';

export default function SomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <StackHeader title="화면 제목" fallbackHref="/(app)/settings" />
      <View>{/* 본문 */}</View>
    </SafeAreaView>
  );
}
```

### 패턴 C — 기존 `Stack.Screen`의 `headerRight`/`headerTitle` 함수 이관

`Stack.Screen options={{ headerRight: () => <X /> }}` 사용처는 해당 화면에서 `<StackHeader rightAction={<X />} />`로 이관하고, 해당 `<Stack.Screen>` 블록은 제거한다.

### 패턴 D — 레이아웃이 `SafeAreaView`를 미제공인 경우

`bg-surface-page`와 `edges={['top']}`가 StackHeader 상단 패딩에 필수. 화면이 이미 다른 래퍼를 쓰고 있으면 그대로 두되, `<StackHeader>`가 화면 최상단에 위치해야 함.

---

## 파일 구조

**수정 대상 (레이아웃 8):**
- `app/(app)/_layout.tsx`
- `app/(employer)/_layout.tsx`
- `app/(admin)/_layout.tsx`
- `app/(app)/settings/_layout.tsx`
- `app/(app)/support/_layout.tsx`
- `app/(app)/reviews/_layout.tsx`
- `app/(app)/notices/_layout.tsx`
- `app/(employer)/my-postings/[id]/_layout.tsx`

**수정 대상 (화면 48+2):** §Task별로 명시

**삭제 검토:** `src/components/jobs/JobDetailHeader.tsx` + `src/components/jobs/__tests__/JobDetailHeader.test.tsx` (Task 9에서 결정)

**변경 없음 (이미 `StackHeader` 사용, 4):**
- `app/(app)/(tabs)/board/write.tsx` · `board/post/[postId].tsx` · `board/edit/[postId].tsx` · `notifications.tsx`

---

## Task 1: 사전 조사 (O1/O2 해소)

**Files:**
- Read: `uniqn-mobile/src/components/jobs/JobDetailHeader.tsx` (확인 완료 — `title`/`onShare`/`isSharing`/`fallbackHref` 4 props)
- Read: `uniqn-mobile/app/(app)/jobs/[id]/index.tsx` — `JobDetailHeader` 사용처 확인
- Read: `uniqn-mobile/app/jobs/[id].tsx` — alias 경로 확인
- Scan: `app/**/*.tsx`에서 `headerRight`/`headerTitle` 사용처 (이미 5개 파일 확인 완료 — `(app)/(tabs)/board/[boardType].tsx`, `(employer)/my-postings/[id]/_layout.tsx`, `(admin)/announcements/[id]/index.tsx`, `(app)/notifications.tsx`, `(admin)/announcements/index.tsx`)

- [ ] **Step 1: `JobDetailHeader` 소비처 정리**

다음 정보를 메모에 기록:
  - `(app)/jobs/[id]/index.tsx`: `title={post.title}`, `onShare={handleShare}`, `isSharing={isSharing}`, `fallbackHref` 지정 여부
  - `app/jobs/[id].tsx`: alias인지 실제 사용인지

Run: `grep -rn "JobDetailHeader" uniqn-mobile/app uniqn-mobile/src`

- [ ] **Step 2: 각 `headerRight`/`headerTitle` 사용처의 구체 내용 파악**

5개 파일의 해당 블록을 읽고 표로 정리 (이관 대상 UI):

| 파일 | headerRight/Title 내용 |
|---|---|
| `(app)/notifications.tsx` | 이미 `StackHeader` — 변경 없음 |
| `(app)/(tabs)/board/[boardType].tsx` | 탭 루트, 본 계획 범위 외 |
| `(employer)/my-postings/[id]/_layout.tsx` | 동적 타이틀 — Task 8에서 `titleSuffix`로 이관 |
| `(admin)/announcements/[id]/index.tsx` | 액션 버튼 — Task 7에서 `rightAction`으로 이관 |
| `(admin)/announcements/index.tsx` | 생성 버튼 — Task 7에서 `rightAction`으로 이관 |

Run: 각 파일 Read 후 위 표 업데이트.

- [ ] **Step 3: 조사 결과 커밋 없음, 다음 Task로 진행**

이 Task는 조사만 수행. 실제 코드 변경 없음.

---

## Task 2: Notices 그룹 (파일럿 — 가장 작음)

**Files:**
- Modify: `uniqn-mobile/app/(app)/notices/_layout.tsx`
- Modify: `uniqn-mobile/app/(app)/notices/[id].tsx`
- Note: `uniqn-mobile/app/(app)/notices/index.tsx`는 `<Redirect>`만 있음 — 변경 없음

- [ ] **Step 1: `_layout.tsx`에 패턴 A 적용**

파일 전체를 다음으로 교체:

```tsx
/**
 * UNIQN Mobile - 공지사항 레이아웃
 */

import { Stack } from 'expo-router';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

export default function NoticesLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: getLayoutColor(isDark, 'content'),
        },
      }}
    />
  );
}
```

- [ ] **Step 2: `[id].tsx` 읽고 패턴 B 적용**

```bash
cat uniqn-mobile/app/\(app\)/notices/\[id\].tsx
```

화면 최상단에 `<StackHeader title="공지사항" fallbackHref="/(app)/(tabs)/board/notice" />` 추가. 기존 컴포넌트 구조에 따라 `SafeAreaView` 래핑 필요 시 추가.

- [ ] **Step 3: 타입 체크**

Run: `cd uniqn-mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: 린트**

Run: `cd uniqn-mobile && npx eslint app/\(app\)/notices`
Expected: 0 errors

- [ ] **Step 5: 커밋**

```bash
cd C:/Users/user/Desktop/T-HOLDEM
git add uniqn-mobile/app/\(app\)/notices
git commit -m "refactor(mobile): 공지사항 헤더를 StackHeader로 통일"
```

---

## Task 3: Support 그룹

**Files (모두 `uniqn-mobile/app/(app)/support/` 하위):**
- Modify: `_layout.tsx` (패턴 A)
- Modify 5 화면:
  - `index.tsx` — title "고객지원", fallbackHref `/(app)/(tabs)/profile`
  - `create-inquiry.tsx` — title "문의 작성", fallbackHref `/(app)/support`
  - `faq.tsx` — title "자주 묻는 질문", fallbackHref `/(app)/support`
  - `inquiry/[id].tsx` — title "문의 상세", fallbackHref `/(app)/support/my-inquiries`
  - `my-inquiries.tsx` — title "내 문의 내역", fallbackHref `/(app)/support`

- [ ] **Step 1: `_layout.tsx`에 패턴 A 적용**

`uniqn-mobile/app/(app)/support/_layout.tsx`를 파일 상단 **§공통 마이그레이션 패턴 — 패턴 A**의 "After" 템플릿으로 전체 교체. 함수명만 `SupportLayout`으로 변경.

- [ ] **Step 2: 각 화면에 패턴 B 적용**

각 파일을 Read한 후, 화면 최상단에 다음 형태를 삽입:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';

// ...return 블록 최상단:
<SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
  <StackHeader title="..." fallbackHref="..." />
  {/* 기존 본문 */}
</SafeAreaView>
```

이미 `SafeAreaView`를 사용하는 화면은 래핑 중복하지 말고 `<StackHeader />` 한 줄만 추가. `title`과 `fallbackHref`는 위 파일 목록 표 그대로.

- [ ] **Step 3: 타입 체크 + 린트**

Run: `cd uniqn-mobile && npm run quality`
Expected: type-check/lint/format 전부 통과.

- [ ] **Step 4: Jest**

Run: `cd uniqn-mobile && npx jest app/\(app\)/support`
Expected: 기존 테스트 통과 (변경 없음이 원칙).

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/support
git commit -m "refactor(mobile): 고객지원 헤더를 StackHeader로 통일"
```

---

## Task 4: Reviews 그룹

**Files (모두 `uniqn-mobile/app/(app)/reviews/` 하위):**
- Modify: `_layout.tsx` (패턴 A)
- Modify 4 화면:
  - `history.tsx` — title "리뷰 기록", fallbackHref `/(app)/(tabs)/profile`
  - `pending.tsx` — title "리뷰 대기", fallbackHref `/(app)/(tabs)/profile`
  - `write.tsx` — title "리뷰 작성", fallbackHref `/(app)/reviews/pending`
  - `[workLogId].tsx` — title "리뷰 상세", fallbackHref `/(app)/reviews/history`

- [ ] **Step 1: `_layout.tsx`에 패턴 A 적용 (함수명 `ReviewsLayout`)**

파일 상단 **§공통 마이그레이션 패턴 — 패턴 A**의 "After" 템플릿으로 전체 교체. 함수명만 `ReviewsLayout`으로 변경.

- [ ] **Step 2: 각 화면에 패턴 B 적용 (위 표의 title/fallbackHref)**

- [ ] **Step 3: 기존 Jest 스냅샷 업데이트 (필요 시)**

리뷰는 기존 테스트가 있다:
- `__tests__/ReviewDetailScreen.test.tsx`
- `__tests__/ReviewWriteScreen.test.tsx`

Run: `cd uniqn-mobile && npx jest app/\(app\)/reviews --updateSnapshot`
Expected: 테스트 통과, 스냅샷 업데이트.

- [ ] **Step 4: 품질 검사**

Run: `cd uniqn-mobile && npm run quality`

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/reviews
git commit -m "refactor(mobile): 리뷰 헤더를 StackHeader로 통일"
```

---

## Task 5: Settings 그룹

**Files (모두 `uniqn-mobile/app/(app)/settings/` 하위):**
- Modify: `_layout.tsx` (패턴 A, 함수명 `SettingsLayout`)
- Modify 10 화면:
  - `index.tsx` — title "설정", fallbackHref `/(app)/(tabs)/profile`
  - `profile.tsx` — title "프로필 수정", fallbackHref `/(app)/settings`
  - `business-info.tsx` — title "사업자 정보", fallbackHref `/(app)/settings`
  - `change-password.tsx` — title "비밀번호 변경", fallbackHref `/(app)/settings`
  - `my-data.tsx` — title "내 데이터", fallbackHref `/(app)/settings`
  - `privacy.tsx` — title "개인정보처리방침", fallbackHref `/(app)/settings`
  - `terms.tsx` — title "이용약관", fallbackHref `/(app)/settings`
  - `employer-terms.tsx` — title "구인자 이용약관", fallbackHref `/(app)/settings`
  - `liability-waiver.tsx` — title "면책 동의서", fallbackHref `/(app)/settings`
  - `delete-account.tsx` — title "회원 탈퇴", fallbackHref `/(app)/settings` (현재 `HeaderBackButton` 직접 사용 중 — 제거하고 `StackHeader`로 대체)

- [ ] **Step 1: `_layout.tsx` 패턴 A 적용**

- [ ] **Step 2: 10개 화면에 패턴 B 적용**

`delete-account.tsx`는 기존에 `HeaderBackButton`을 화면에서 직접 import해 Stack.Screen.options.headerLeft로 넘기고 있을 수 있음. Read 후:
- 해당 `Stack.Screen` 블록 제거
- 화면 최상단에 `<StackHeader />` 추가
- `HeaderBackButton` import가 더 이상 필요 없으면 제거

- [ ] **Step 3: 품질 검사 + 테스트**

Run: `cd uniqn-mobile && npm run quality && npx jest app/\(app\)/settings`

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/settings
git commit -m "refactor(mobile): 설정 화면 헤더를 StackHeader로 통일"
```

---

## Task 6: `(app)` 상위 레이아웃 + 흩어진 루트 화면

**Files:**
- Modify: `uniqn-mobile/app/(app)/_layout.tsx` (패턴 A)
- Modify: `uniqn-mobile/app/(app)/home.tsx` — title "홈", fallbackHref `/(app)/(tabs)` (또는 본문 내용에 따라 조정)
- Modify: `uniqn-mobile/app/(app)/employer-register.tsx` — title "구인자 등록", fallbackHref `/(app)/(tabs)`
- Modify: `uniqn-mobile/app/(app)/employer-application-status.tsx` — title "구인자 신청 현황", fallbackHref `/(app)/(tabs)`
- Note: `profile-setup.tsx`는 예외 — 변경 금지

**주의:** `(app)/_layout.tsx`의 `screenOptions`는 **직속 화면**(`home`, `employer-register`, `employer-application-status`, `profile-setup` 등)에만 영향을 준다. 하위 그룹(`settings`, `support`, `reviews`, `notices`, `jobs`, `applications`, `(tabs)`)은 각자 `_layout.tsx`로 별도의 `<Stack>`을 렌더하므로 이 레이아웃의 옵션을 상속받지 않는다. 따라서 Task 2~5 완료 후 안전하게 이 Task를 실행한다.

- [ ] **Step 1: `(app)/_layout.tsx` 현재 상태 Read**

Run: `cat uniqn-mobile/app/\(app\)/_layout.tsx`

이 레이아웃이 다른 로직(인증 가드 등)을 포함할 수 있음. 헤더 관련 `screenOptions`만 변경하고 나머지 로직은 보존한다.

- [ ] **Step 2: `screenOptions`의 `headerShown`, `headerStyle`, `headerTintColor`, `headerTitleStyle`, `headerLeft`를 제거하고 `headerShown: false`와 `contentStyle`만 남긴다**

변경 후 예시 (기존 인증 가드는 보존):
```tsx
// ...기존 인증 가드 코드 유지
<Stack
  screenOptions={{
    headerShown: false,
    contentStyle: { backgroundColor: getLayoutColor(isDark, 'content') },
  }}
/>
```

- [ ] **Step 3: `home.tsx`, `employer-register.tsx`, `employer-application-status.tsx`에 패턴 B 적용**

각각 title/fallbackHref는 위 파일 목록 그대로.

- [ ] **Step 4: `profile-setup.tsx`가 변경되지 않았는지 확인**

Run: `git diff uniqn-mobile/app/\(app\)/profile-setup.tsx`
Expected: 변경 없음 (예외 화면).

- [ ] **Step 5: 품질 검사**

Run: `cd uniqn-mobile && npm run quality`

- [ ] **Step 6: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/_layout.tsx uniqn-mobile/app/\(app\)/home.tsx uniqn-mobile/app/\(app\)/employer-register.tsx uniqn-mobile/app/\(app\)/employer-application-status.tsx
git commit -m "refactor(mobile): (app) 루트 레이아웃과 직속 화면 헤더 통일"
```

---

## Task 7: Admin 그룹

**Files:**
- Modify: `uniqn-mobile/app/(admin)/_layout.tsx` (패턴 A, 함수명 `AdminLayout`)
- Modify 17 화면 (하위 표 참고)

| 파일 | title | fallbackHref |
|---|---|---|
| `(admin)/index.tsx` | "관리자" | `/(app)/(tabs)` |
| `(admin)/announcements/index.tsx` | "공지사항 관리" | `/(admin)` |
| `(admin)/announcements/create.tsx` | "공지사항 작성" | `/(admin)/announcements` |
| `(admin)/announcements/[id]/index.tsx` | "공지사항 상세" | `/(admin)/announcements` |
| `(admin)/announcements/[id]/edit.tsx` | "공지사항 수정" | `` `/(admin)/announcements/${id}` `` |
| `(admin)/board-reports/index.tsx` | "게시글 신고 관리" | `/(admin)` |
| `(admin)/board-reports/[id].tsx` | "신고 상세" | `/(admin)/board-reports` |
| `(admin)/inquiries/index.tsx` | "문의 관리" | `/(admin)` |
| `(admin)/inquiries/[id].tsx` | "문의 상세" | `/(admin)/inquiries` |
| `(admin)/reports/index.tsx` | "리포트" | `/(admin)` |
| `(admin)/reports/[id].tsx` | "리포트 상세" | `/(admin)/reports` |
| `(admin)/tournaments/index.tsx` | "토너먼트 관리" | `/(admin)` |
| `(admin)/users/index.tsx` | "사용자 관리" | `/(admin)` |
| `(admin)/users/[id].tsx` | "사용자 상세" | `/(admin)/users` |
| `(admin)/stats/index.tsx` | "통계" | `/(admin)` |
| `(admin)/employer-applications/index.tsx` | "구인자 신청 관리" | `/(admin)` |
| `(admin)/employer-applications/[id].tsx` | "구인자 신청 상세" | `/(admin)/employer-applications` |

**중요 — `headerRight` 이관 (Task 1 Step 2 조사 결과 기반):**
- `(admin)/announcements/index.tsx`의 "생성" 버튼 → `<StackHeader rightAction={<해당 Pressable />} />`
- `(admin)/announcements/[id]/index.tsx`의 액션 버튼 → 동일하게 `rightAction`으로 이관

- [ ] **Step 1: `_layout.tsx` 패턴 A 적용**

- [ ] **Step 2: 17개 화면에 패턴 B 일괄 적용**

표의 title/fallbackHref 그대로. 헤더에 우측 액션이 있는 2개 화면(Task 1 표 확인)은 기존 JSX를 추출해 `rightAction` prop으로 전달.

**예 — `(admin)/announcements/index.tsx`:**

Before (예상 패턴):
```tsx
<Stack.Screen
  options={{
    title: '공지사항 관리',
    headerRight: () => (
      <Pressable onPress={() => router.push('/(admin)/announcements/create')}>
        <PlusIcon />
      </Pressable>
    ),
  }}
/>
```

After:
```tsx
<StackHeader
  title="공지사항 관리"
  fallbackHref="/(admin)"
  rightAction={
    <Pressable onPress={() => router.push('/(admin)/announcements/create')}>
      <PlusIcon />
    </Pressable>
  }
/>
```

- [ ] **Step 3: 품질 검사 + 관련 테스트**

Run: `cd uniqn-mobile && npm run quality && npx jest app/\(admin\)`

- [ ] **Step 4: 커밋**

```bash
git add uniqn-mobile/app/\(admin\)
git commit -m "refactor(mobile): 관리자 전체 화면 헤더를 StackHeader로 통일"
```

---

## Task 8: Employer 그룹 (루트 + my-postings 중첩)

**Files:**
- Modify: `uniqn-mobile/app/(employer)/_layout.tsx` (패턴 A, 함수명 `EmployerLayout`)
- Modify: `uniqn-mobile/app/(employer)/my-postings/[id]/_layout.tsx` (패턴 A, 함수명 `MyPostingDetailLayout`)
- Modify 6 화면:

| 파일 | title | fallbackHref |
|---|---|---|
| `my-postings/create.tsx` | "공고 작성" | `/(app)/(tabs)/employer` |
| `my-postings/[id]/index.tsx` | "내 공고 상세" | `/(app)/(tabs)/employer` |
| `my-postings/[id]/applicants.tsx` | "지원자 목록" | `` `/(employer)/my-postings/${id}` `` |
| `my-postings/[id]/cancellation-requests.tsx` | "취소 요청" | `` `/(employer)/my-postings/${id}` `` |
| `my-postings/[id]/edit.tsx` | "공고 수정" | `` `/(employer)/my-postings/${id}` `` |
| `my-postings/[id]/settlements.tsx` | "정산" | `` `/(employer)/my-postings/${id}` `` |

**주의 — `[id]/_layout.tsx`의 동적 타이틀:**
Task 1 Step 2 조사 결과 이 레이아웃은 동적 `headerTitle`(공고 제목 표시)을 사용할 가능성. StackHeader로 이관 시 각 자식 화면이 `useQuery`로 공고 제목을 fetch해 `titleSuffix={<Text>공고명</Text>}`로 전달한다.

- [ ] **Step 1: `(employer)/_layout.tsx` 패턴 A 적용**

- [ ] **Step 2: `my-postings/[id]/_layout.tsx` 패턴 A 적용 (동적 타이틀 제거)**

- [ ] **Step 3: 6개 화면에 패턴 B 적용**

동적 공고명이 필요한 화면은 다음 형태로:
```tsx
const { data: job } = useJob(id);
// ...
<StackHeader
  title="내 공고 상세"
  titleSuffix={job ? <Text className="text-sm text-text-muted"> · {job.title}</Text> : null}
  fallbackHref="/(app)/(tabs)/employer"
/>
```

- [ ] **Step 4: 품질 검사**

Run: `cd uniqn-mobile && npm run quality`

- [ ] **Step 5: 커밋**

```bash
git add uniqn-mobile/app/\(employer\)
git commit -m "refactor(mobile): 구인자 공고 관리 헤더를 StackHeader로 통일"
```

---

## Task 9: Jobs 그룹 (Critical — 신규 복구 포함)

**Files:**
- Modify: `uniqn-mobile/app/(app)/jobs/_layout.tsx` — 이미 `headerShown: false`인지 확인 후 패턴 A로 정리
- Modify: `uniqn-mobile/app/(app)/jobs/[id]/index.tsx` — `JobDetailHeader` → `StackHeader`로 교체
- Create 헤더: `uniqn-mobile/app/(app)/jobs/[id]/apply.tsx` — `StackHeader` 신규 추가 (뒤로가기 복구)
- Consider Delete: `uniqn-mobile/src/components/jobs/JobDetailHeader.tsx` + 해당 테스트

- [ ] **Step 1: `jobs/_layout.tsx` 현황 확인 및 패턴 A 정리**

Run: `cat uniqn-mobile/app/\(app\)/jobs/_layout.tsx`

이미 `headerShown: false`일 경우 `contentStyle` 등 표준화만 수행. 함수명 `JobsLayout`.

- [ ] **Step 2: `jobs/[id]/index.tsx`에서 `JobDetailHeader` → `StackHeader` 교체**

Before (예상):
```tsx
<JobDetailHeader
  title={post.title}
  onShare={handleShare}
  isSharing={isSharing}
  fallbackHref="/(app)/(tabs)"
/>
```

After:
```tsx
<StackHeader
  title="공고 상세"
  titleSuffix={
    post?.title ? (
      <Text
        className="text-sm font-sans"
        style={{ color: secondaryTextColor }}
        numberOfLines={1}
      >
        · {post.title}
      </Text>
    ) : null
  }
  fallbackHref="/(app)/(tabs)"
  rightAction={
    <Pressable
      onPress={handleShare}
      disabled={isSharing}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="공고 공유하기"
      accessibilityRole="button"
    >
      <ShareIcon size={22} color={secondaryTextColor} />
    </Pressable>
  }
/>
```

필요 import: `StackHeader from '@/components/headers'`, `ShareIcon from '@/components/icons'`, `Pressable, Text from 'react-native'`, `getIconColor from '@/constants'`. `JobDetailHeader` import는 제거.

- [ ] **Step 3: `jobs/[id]/apply.tsx`에 `StackHeader` 신규 추가 (뒤로가기 복구)**

파일 Read 후 화면 최상단에 추가:
```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
// ...
return (
  <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
    <StackHeader title="지원하기" fallbackHref={`/(app)/jobs/${id}`} />
    {/* 기존 본문 */}
  </SafeAreaView>
);
```

기존 화면에 `headerShown: false` Stack.Screen 옵션이 있으면 그대로 두어도 무방 (레이아웃에서 이미 꺼져 있음).

- [ ] **Step 4: 기존 테스트 검토 및 업데이트**

Run: `cd uniqn-mobile && npx jest app/\(app\)/jobs src/components/jobs`
- `app/(app)/jobs/[id]/__tests__/JobDetailScreen.test.tsx` — `JobDetailHeader` 셀렉터가 있으면 `StackHeader`로 업데이트
- `src/components/jobs/__tests__/JobDetailHeader.test.tsx` — `JobDetailHeader` 컴포넌트 자체가 제거될 수 있으므로 Step 6 참조

- [ ] **Step 5: `app/jobs/[id].tsx` (alias) 확인**

이 파일은 alias로 `(app)/jobs/[id]/index.tsx`로 리다이렉트하거나 동일 컴포넌트를 렌더함. `JobDetailHeader`를 참조하고 있다면 함께 업데이트.

Run: `cat uniqn-mobile/app/jobs/\[id\].tsx`

참조가 남아 있으면 Step 2와 동일한 교체를 수행. 전체 파일이 `<Redirect>`만 쓰면 변경 없음.

- [ ] **Step 6: `JobDetailHeader` 컴포넌트 제거 판단**

Run: `grep -rn "JobDetailHeader" uniqn-mobile/app uniqn-mobile/src`
모든 사용처가 제거되었다면:
- `src/components/jobs/JobDetailHeader.tsx` 삭제
- `src/components/jobs/__tests__/JobDetailHeader.test.tsx` 삭제
- `src/components/jobs/index.ts`에서 export 제거

남아있으면 이 Step은 건너뛴다.

- [ ] **Step 7: 품질 검사**

Run: `cd uniqn-mobile && npm run quality && npx jest`

- [ ] **Step 8: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/jobs uniqn-mobile/src/components/jobs uniqn-mobile/app/jobs/\[id\].tsx
git commit -m "feat(mobile): 공고 상세/지원 화면 뒤로가기 복구 및 StackHeader 통일"
```

`JobDetailHeader` 파일을 실제로 삭제했다면 커밋 메시지에 "JobDetailHeader 제거" 추가.

---

## Task 10: Applications + Public/Jobs 잔여 화면

**Files:**
- Check: `uniqn-mobile/app/(app)/applications/_layout.tsx` — 이미 `headerShown: false`일 가능성. 표준화.
- Check: `uniqn-mobile/app/(app)/applications/[id]/cancel.tsx` — Spec §4.2에 의해 redirect-only라면 변경 없음.
- Modify: `uniqn-mobile/app/(public)/_layout.tsx` — 필요 시 헤더 정리
- Modify: `uniqn-mobile/app/(public)/jobs/index.tsx` — title "공고", fallbackHref `/(auth)/login` 또는 `/`
- Alias 확인: `uniqn-mobile/app/jobs/_layout.tsx`, `uniqn-mobile/app/jobs/index.tsx`

- [ ] **Step 1: `applications/_layout.tsx` Read 후 패턴 A 정리**

- [ ] **Step 2: `applications/[id]/cancel.tsx` Read 후 확인**

Spec §4.2에서 이 파일은 redirect/UI 없음으로 분류되어 변경 대상에서 제외. Read 후 실제로 `<Redirect>` 또는 즉시 `router.replace`/`router.back` 호출만 있는지 확인. 예상과 다르게 UI 렌더가 있다면 **Stop** — 사용자에게 에스컬레이션 후 title/fallbackHref 결정. 예상대로면 변경 없음.

- [ ] **Step 3: `(public)/_layout.tsx` Read 후 결정**

Run: `cat uniqn-mobile/app/\(public\)/_layout.tsx`

네이티브 헤더 옵션을 사용하고 있으면 패턴 A 적용 (함수명 `PublicLayout`). 이미 `headerShown: false`라면 표준화만 수행.

- [ ] **Step 4: `(public)/jobs/index.tsx`에 `StackHeader` 추가**

`fallbackHref="/"`로 설정 (루트 라우터 `app/index.tsx`가 인증 상태에 맞게 재라우팅하므로 로그인/비로그인 모두 안전):

```tsx
<StackHeader title="공고" fallbackHref="/" />
```

- [ ] **Step 5: `app/jobs/` alias 확인**

Run: `cat uniqn-mobile/app/jobs/_layout.tsx uniqn-mobile/app/jobs/index.tsx`

`<Redirect>`만 있으면 변경 없음.

- [ ] **Step 6: 품질 검사**

Run: `cd uniqn-mobile && npm run quality`

- [ ] **Step 7: 커밋**

```bash
git add uniqn-mobile/app/\(app\)/applications uniqn-mobile/app/\(public\) uniqn-mobile/app/jobs
git commit -m "refactor(mobile): 지원/공개 공고/alias 경로 헤더 정리"
```

---

## Task 11: 최종 검증 + 문서 업데이트

**Files:**
- Read-only: 전체 `app/**/*.tsx`
- Update: `docs/superpowers/specs/2026-04-16-back-navigation-consistency-design.md` (완료 상태 표기)

- [ ] **Step 1: 전역 grep — 누락된 네이티브 헤더 잔재 검출**

Run:
```bash
cd uniqn-mobile
grep -rn "headerShown: true\|headerLeft:\|HeaderBackButton" app --include="*.tsx" | grep -v "profile-setup\|node_modules\|__tests__"
```
Expected: 결과 없음. 있으면 해당 파일 수정 후 다시 돌림.

- [ ] **Step 2: 전역 grep — `StackHeader` 미사용 내부 화면 검출**

Run:
```bash
cd uniqn-mobile
# 내부 라우트(탭/auth/profile-setup 제외) 중 StackHeader import가 없는 파일 찾기
find app -name "*.tsx" ! -path "*__tests__*" ! -path "*tabs*" ! -path "*(auth)*" ! -name "_layout.tsx" ! -name "profile-setup.tsx" ! -name "index.tsx" ! -name "+not-found.tsx" | while read f; do
  grep -L "StackHeader\|Redirect" "$f"
done
```
Expected: 결과 없음 (모든 내부 화면이 `StackHeader` 또는 `Redirect`를 포함).

- [ ] **Step 3: 전체 품질 검사**

Run: `cd uniqn-mobile && npm run quality && npm test`
Expected: 전부 통과.

- [ ] **Step 4: 스모크 체크리스트 수동 확인 (실기기 또는 시뮬레이터)**

Spec §6.3 체크리스트 실행:
| 그룹 | 체크 화면 |
|---|---|
| Settings | `/settings/profile` → `/settings` 뒤로가기 확인 |
| Reviews | `/reviews/write` → `/reviews/pending` 한글 타이틀 |
| Jobs | `/jobs/[id]/apply` → `/jobs/[id]` **신규 복구** 확인 |
| Employer | `/my-postings/[id]/applicants` 중첩 fallback |
| Admin | `/users/[id]` → `/users` 전체 동작 |
| Board | `/board/write` 기존 동작 유지 |

다크/라이트 모드 각 1회 확인.

- [ ] **Step 5: 스펙 문서 완료 상태 표기**

`docs/superpowers/specs/2026-04-16-back-navigation-consistency-design.md` 상단 메타데이터의 "상태: 설계 승인 대기"를 "상태: 구현 완료 (2026-04-16)"로 변경.

- [ ] **Step 6: 최종 커밋**

```bash
git add docs/superpowers/specs/2026-04-16-back-navigation-consistency-design.md
git commit -m "docs: 뒤로가기 일관성 통일 구현 완료 기록"
```

---

## 전체 커밋 구조 (롤백 용이)

Task 별 독립 커밋:
1. Notices
2. Support
3. Reviews
4. Settings
5. (app) 루트 + 직속 화면
6. Admin
7. Employer (my-postings 포함)
8. Jobs (Critical + 신규)
9. Applications + Public + alias
10. 최종 검증 + 문서

문제 발견 시 해당 그룹만 `git revert`로 롤백.

---

## 예외 화면 재확인 (변경 금지)

- `app/index.tsx` (루트 리다이렉트)
- `app/+not-found.tsx`
- `app/(auth)/login.tsx`, `signup.tsx`, `forgot-password.tsx`
- `app/(app)/profile-setup.tsx`
- `app/(app)/(tabs)/index.tsx`, `employer.tsx`, `qr.tsx`, `schedule.tsx`, `profile.tsx`, `board/*`
- `app/admin/index.tsx`, `admin/[...slug].tsx`
- `app/employer/index.tsx`, `employer/[...slug].tsx`
- `app/(app)/notices/index.tsx` (Redirect-only)
- `app/(app)/applications/[id]/cancel.tsx` (UI 없음 확인 시)

각 Task 완료 후 `git diff`로 이들 파일이 변경되지 않았는지 점검.
