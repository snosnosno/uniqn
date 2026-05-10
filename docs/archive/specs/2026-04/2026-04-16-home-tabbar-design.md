# 홈 화면 하단 탭바 추가 — 설계 문서

- 작성일: 2026-04-16
- 상태: 설계 승인 대기
- 작성자: Claude (brainstorming)

## 배경

현재 `app/(app)/home.tsx`의 HomeDashboard는 스택 스크린으로 구성되어 **하단 탭바가 없다**. 반면 `(tabs)/` 하위 5개 화면(구인구직/내 스케줄/게시판/내 공고/프로필)은 expo-router `<Tabs>`로 탭바를 가진다. 사용자는 홈 화면에서 다른 탭 화면으로 이동하려면 현재는 헤더 중앙의 UNIQN 로고를 누르거나 별도 경로가 없어 불편하다.

## 목표

홈 화면 하단에 탭바 UI를 표시하여, 홈에서 다른 탭 화면으로 바로 이동할 수 있게 한다.

## 범위 결정 (브레인스토밍 합의)

- **방향 C:** 홈은 탭이 아님. 스택 스크린 그대로 유지하고 탭바 UI만 표시 전용으로 추가
- **활성 상태 C-3:** 모든 탭 비활성. 현재 위치 표시는 헤더 `"홈"` 타이틀이 담당
- **QR 노출:** 홈 헤더에 QR 버튼 노출 (기존 `showQR={false}` → `true`)
- **왼쪽 영역:** `TabHeader` 기본 구조(왼쪽=탭 제목) 유지. 추가 아이콘 없음

## 아키텍처

```
app/(app)/home.tsx (스택 스크린, 탭 아님)
 ├ TabHeader (title="홈", showQR=true)
 ├ DashboardViewToggle (employer만)
 ├ StaffDashboard | EmployerDashboard
 │    └ ScrollView (contentContainerStyle.paddingBottom = TAB_BAR_HEIGHT + insets.bottom)
 └ HomeTabBar (신규, 표시 전용, router.push로 이동)
```

- expo-router `<Tabs>` 레이아웃은 홈에서 재사용 불가 (홈은 `(tabs)/` 밖에 있음)
- `HomeTabBar`는 시각·스타일 토큰만 기존 탭바와 동일하게 맞춘 커스텀 컴포넌트
- 대시보드 ScrollView의 마지막 카드가 탭바에 가리지 않도록 bottomPadding 확보

## 파일 변경

### 신규

**`src/components/home/HomeTabBar.tsx`**
- props: 없음
- 표시 탭 5개
  - 구인구직 → `/(app)/(tabs)` (push)
  - 내 스케줄 → `/(app)/(tabs)/schedule`
  - 게시판 → `/(app)/(tabs)/board`
  - 내 공고 → `/(app)/(tabs)/employer`
  - 프로필 → `/(app)/(tabs)/profile`
- 스타일 토큰 (`getLayoutColor(isDark, ...)`)
  - 배경: `tabBarBg`
  - 상단 경계선: `tabBarBorder`
  - 아이콘/텍스트 색상: `tabBarInactive` (전부 비활성 고정)
- 높이: `LAYOUT.TAB_BAR_HEIGHT + insets.bottom` (SafeArea 반영)
- 아이콘: `@/components/icons` 재사용 (HomeIcon/CalendarIcon/MessageIcon/BriefcaseIcon/UserIcon)
- 접근성: 각 `Pressable`에 `accessibilityRole="button"`, `accessibilityLabel="{title} 탭으로 이동"`

**`src/components/home/__tests__/HomeTabBar.test.tsx`**
- 각 탭 press → `router.push` 인자 검증 (5 케이스)
- 다크모드 토큰 적용 스냅샷

### 수정

**`app/(app)/home.tsx`**
- `TabHeader`: `title="" showQR={false}` → `title="홈" showQR={true}` (로딩 상태 포함)
- `<HomeTabBar />` 추가
- `useSafeAreaInsets`로 bottomPadding 계산, `StaffDashboard`/`EmployerDashboard`에 prop으로 전달

**`src/components/home/StaffDashboard.tsx`**
- props 추가: `bottomPadding?: number`
- `ScrollView contentContainerStyle`에 `paddingBottom: bottomPadding ?? 0` 반영

**`src/components/home/EmployerDashboard.tsx`**
- 위와 동일

## 네비게이션 규칙

- `router.push` 사용 (stack에 쌓임) → 뒤로가기로 홈 복귀 가능
- 이미 해당 탭 화면에 진입한 뒤 홈으로 돌아오는 경로는 기존 방식(헤더 UNIQN 로고 = `router.push('/(app)/home')`) 유지
- 탭바에 `qr.tsx`는 표시하지 않음 (기존 `(tabs)/_layout.tsx`의 `href: null` 관례 그대로)

## 다크/라이트 테마

- 모든 색상은 `getLayoutColor(isDark, ...)` 토큰으로만 가져와 `dark:` 적용 일관성 유지
- 탭바 배경/경계선/아이콘 색상 모두 토큰 기반

## 접근성

- 각 탭 버튼: `accessibilityRole="button"`, `accessibilityLabel`은 한글 "{탭이름} 탭으로 이동"
- 헤더 UNIQN 로고의 기존 `accessibilityLabel="UNIQN 홈으로 이동"` 유지

## 테스트 & 검증

**단위 테스트 (`HomeTabBar.test.tsx`)**
- 탭 5개 각각 press 시 `router.push`가 올바른 경로로 호출되는지 검증
- 다크/라이트 모드 스냅샷

**수동 QA (SESSION-GUIDE 플로우 반영)**
- [ ] 홈 진입 → 하단 탭바 5개 보임, 모두 inactive 색상
- [ ] 헤더 왼쪽 "홈" 타이틀, 우측 QR+알림 아이콘 노출
- [ ] 대시보드 스크롤 시 마지막 카드가 탭바에 가리지 않음
- [ ] 각 탭 press → 해당 화면 진입 → 뒤로가기 → 홈 복귀 정상
- [ ] QR 아이콘 press → QR 화면 정상 진입
- [ ] 다크/라이트 전환 시 탭바 색상 토큰 전환 확인
- [ ] 웹/iOS/Android 3플랫폼 SafeArea 하단 여백 자연스러움

## 위험 & 고려사항

- `(tabs)/_layout.tsx`에 있던 웹 aria-hidden blur 로직은 홈엔 불필요 (탭 컨테이너가 아니므로 state 이벤트 없음)
- 스택 푸시 방식이라 탭 화면에서 또다시 홈으로 돌아와 탭을 누르면 스택이 쌓일 수 있음 — 과도하게 쌓이면 메모리/뒤로가기 UX 영향. 필요 시 `router.replace` 고려 가능하나 **현 범위에선 push로 시작**, 실사용 QA 후 조정

## 범위 외 (Out of Scope)

- 탭바 활성 상태 로직 추가 (홈은 영원히 비활성 합의)
- 전체 `TabHeader` 구조 변경 (왼쪽 아이콘 추가 등)
- 홈을 `(tabs)/` 내부로 이동시키는 구조 변경
- 피처플래그 `home_dashboard_enabled` 로직 수정

## 수용 기준

1. 홈 화면 하단에 5개 탭이 있는 탭바가 렌더링된다
2. 탭을 누르면 해당 탭 화면으로 이동하고, 뒤로가기로 홈 복귀가 된다
3. 헤더 왼쪽 타이틀이 "홈"으로 표시된다
4. 헤더 우측에 QR 아이콘이 노출된다
5. 대시보드 스크롤 시 탭바에 가려지는 콘텐츠가 없다
6. 다크/라이트 모드 색상 토큰이 모두 적용된다
7. 단위 테스트 5 케이스(탭별 router.push 인자) 통과
8. `npm run quality` 통과 (typecheck + lint + format)
