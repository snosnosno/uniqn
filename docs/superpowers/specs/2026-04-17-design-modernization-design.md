# Design Modernization — UNIQN Mobile

> **작성일**: 2026-04-17
> **상태**: Draft (사용자 리뷰 대기)
> **범위**: Staff + Employer + Admin 전 화면
> **접근**: L1 표면만 재스킨 + 홈 V2 (예외) + 폴리시 10개 중 9개 도입

---

## 1. Product Context

포커룸 스태프 관리 앱(Expo 55 / RN 0.83.4 / NativeWind 4.2 / Supabase). 사용자 요청은
"블라인드·당근·배달의민족 같은 최신 앱 느낌"이지만, UNIQN은 B2B 업무 도구
(새벽 근무 전문가 툴)이므로 **블라인드식 전문성·타이포 위계**를 주축으로
흡수한다. 기존 `DESIGN.md`의 Midnight Craft(Industrial/Utilitarian + subtle
Luxury) 정체성을 보강하는 방향.

## 2. Goals / Non-goals

### Goals

- G1. 현대 전문가 툴 톤(블라인드식 B 카드 언어)을 전 화면에 확립
- G2. 홈 대시보드를 히어로 + 섹션 헤더 기반(V2)으로 승격
- G3. Impeccable v2 룰 v1(1~15)·v2(16~27) PR 체크리스트 27항목 전 화면 통과
- G4. 폴리시 인프라(Skeleton·OfflineBanner·Haptics·blurhash·Formatters)를 리스트·
  상세·결정 지점에 **도입** (구현은 대부분 완성됨)

### Non-goals

- NG1. 네비게이션 계층·탭 구성 변경 (6탭 승격, 알림 탭 독립 등 L3 요소 제외)
- NG2. Sticky 섹션 헤더(P9) — 레이아웃 추가 요소라 제외
- NG3. Visual regression 자동화(Chromatic/Percy), Storybook 도입
- NG4. A/B 실험 · Feature Flag 점진 롤아웃 — 한 번에 교체
- NG5. DB 스키마 변경, 비즈니스 로직 변경, 라우트 경로 변경

## 3. Design Direction (확정)

### 3.1 핵심 언어 — "B (블라인드식)"

| 요소 | 규칙 |
| ---- | ---- |
| **Edge stripe** | 카드 좌측 3px 골드 스트라이프 (테두리 대신). 색상으로 상태 암시: 골드=일반·대기, 블루=지원완료·확정, 그레이=마감·캐시·완료, 워닝=취소 요청, 에러=신고 |
| **Title** | 15~17px / weight 800 / `letter-spacing: -0.02em` |
| **Chip 태그** | uppercase / `letter-spacing: 0.06em` / weight 700 / radius 3px |
| **Numerics** | 금액·시간·카운트 전부 `tabular-nums` |
| **Money alignment** | 리스트 카드에서 우측 정렬 (좌 정보 / 우 숫자) |
| **Footer pattern** | `UPPERCASE 라벨` + 값 2컬럼 |
| **TabBar 활성** | 상단 2px 골드 underbar + 아이콘·라벨 골드 |

### 3.2 홈 V2 (유일한 레이아웃 변경)

- **NextWork 히어로 승격**: 그라디언트 배경(`linear-gradient(180deg, #1A1710 0%,
  #09090B 100%)`), D-Day 배지 14px/900 gold, 제목 20px/900 letter-spacing -0.03em
- **나머지 3개 위젯(ApplicationStatus / MonthSummary / RecentNotices)**: 카드 제거 →
  섹션 헤더(uppercase label + 디바이더) + 인라인 콘텐츠
- **ApplicationStatus 4열 스트립**: 세로 divider + tabular-nums
- **MonthSummary**: 좌측 대형 금액(28px/900 gold) + 우측 부가정보
- **RecentNotices**: 도트(unread=gold / read=muted) + 부제(출처)

### 3.3 L1 베이스라인 (홈 제외 전 화면)

- 기존 화면 레이아웃 **100% 유지**
- 토큰·타이포·칩·스트라이프 스타일만 교체
- 컴포넌트 props 시그니처 불변

## 4. Token & Primitive Changes

### 4.1 Tailwind (`tailwind.config.js`)

```js
// 기존 유지 + 아래만 추가
extend: {
  letterSpacing: {
    'card-title': '-0.02em',
    'chip': '0.06em',
  },
  fontVariantNumeric: {
    'tabular': 'tabular-nums',
  },
}
```

**추가 안 함**: 새 색상 없음 — DESIGN.md 팔레트 재사용.

### 4.2 `Badge` → Chip variant 추가

`src/components/ui/Badge.tsx` 에 `variant: 'chip'` 추가:

```tsx
// uppercase + tracking-chip + weight 700 + radius 3px
```

기존 `dot`, `size`, `variant: success|error|warning|info` 유지.

### 4.3 신설 프리미티브

- **`src/components/ui/CardStripe.tsx`** — 좌측 3px 엣지 스트라이프 wrapper
  ```tsx
  <CardStripe tone="gold|info|muted|warning|error"> {children} </CardStripe>
  ```
- **`src/components/ui/PressableCard.tsx`** — Pressed 역방향 + Focus ring
  내장 공용 Pressable:
  ```tsx
  <PressableCard onPress={...} accessibilityLabel={...}>
    {children}
  </PressableCard>
  ```
  내부 로직:
  - `pressed` → `dark:bg-surface-hover` (밝아지는 방향)
  - `android_ripple` dark/light 분기
  - `focused` → `border-2 border-info-blue` outset (margin -2px)

### 4.4 `HomeTabBar` 수정

`src/components/home/HomeTabBar.tsx` 와 `app/(app)/(tabs)/_layout.tsx` expo-router
`<Tabs>` 양쪽:

- active 탭 상단 2px 골드 underbar 추가
- 활성 색상 골드(`#D4AF37`)로
- 구조·순서·라벨 불변

### 4.5 타이포 — H5·Body 인접 금지 규칙

Impeccable §2의 1.07 비율 문제를 **스케일 변경 없이** 해결:

- H5 사용 시 Body 인접 배치 금지
- 위계가 필요하면 `text-base font-sans-bold text-content-primary` (weight·color
  축)

### 4.6 Tabular-nums 적용

- 대상: `formatCurrency`, `formatDate`, `formatPhone`, `formatDuration`,
  카운트(N명, N/N), D-day 배지 출력 전체
- 방식: `<Text style={{ fontVariant: ['tabular-nums'] }}>` 또는
  NativeWind `font-variant-tabular` 유틸
- 호출부 약 40~50곳 (grep으로 확정)

## 5. Screen Matrix (L1 적용)

### 5.1 Tier A — 핵심 (풀 폴리시)

토큰 + 프리미티브 + P1~P8·P10 전부 적용.

| 화면 | 파일 | 주요 변경 |
| ---- | ---- | -------- |
| 홈 (V2 예외) | `app/(app)/home.tsx` | Hero 위젯 + 섹션 헤더, `DashboardWidgetShell` 변형 추가 |
| 구인구직 | `app/(app)/(tabs)/index.tsx` + `src/components/jobs/JobList.tsx` | JobCard B + Skeleton + 오프라인 배너 + PTR 골드 |
| 공고 상세 | `app/(app)/jobs/[id]/index.tsx` + `JobDetail.tsx` | 헤더·섹션 restyle, CTA 골드, 햅틱 |
| 지원 | `app/(app)/jobs/[id]/apply.tsx` + `ApplicationForm.tsx` | Form primitives, 키보드 UX |
| 스케줄 | `app/(app)/(tabs)/schedule.tsx` + `ScheduleCard.tsx` | stripe(상태별), Skeleton, PTR |
| 지원자 관리 | `app/(employer)/my-postings/[id]/applicants.tsx` + `ApplicantCard/*` | Chip 태그, stripe(대기·확정·완료), 햅틱(승인/거절) |
| 정산 | `app/(employer)/my-postings/[id]/settlements.tsx` + `SettlementCard.tsx` | 금액 tabular-nums 우정렬, stripe |
| 프로필 | `app/(app)/(tabs)/profile.tsx` | 아바타 square 6px 유지, 타이포 restyle |

### 5.2 Tier B — 일반 (주요 폴리시)

토큰 + 프리미티브 + P1·P3·P5·P8·P10. P2·P4·P6·P7 선택 적용.

| 화면 | 파일 |
| ---- | ---- |
| 게시판 리스트 | `app/(app)/(tabs)/board/index.tsx`, `[boardType].tsx` |
| 게시판 글/작성/편집 | `board/post/[postId].tsx`, `write.tsx`, `edit/[postId].tsx` |
| 알림 | `app/(app)/notifications.tsx` |
| 공지 목록/상세 | `app/(app)/notices/index.tsx`, `[id].tsx` |
| 내 공고 리스트 | `app/(app)/(tabs)/employer.tsx` + `src/components/employer/posting/*` |
| 공고 작성/편집 | `my-postings/create.tsx`, `edit.tsx` + `JobPostingScrollForm.tsx` |
| 취소 요청 | `my-postings/[id]/cancellation-requests.tsx` + `CancellationRequestCard.tsx` |
| 리뷰 전체 | `app/(app)/reviews/*` (pending, history, write, [workLogId]) |
| 지원 취소 | `app/(app)/applications/[id]/cancel.tsx` |

### 5.3 Tier C — 저빈도 (베이스라인만)

토큰 + Chip + Typography + tabular-nums + Pressed 역방향.

- **설정**: `app/(app)/settings/*` (10 화면 — profile, business-info,
  change-password, delete-account, my-data, privacy, terms, employer-terms,
  liability-waiver, index)
- **문의**: `app/(app)/support/*` (5 화면)
- **Employer 진입**: `employer-register.tsx`, `employer-application-status.tsx`,
  `profile-setup.tsx`
- **Admin 전체**: `app/(admin)/*` (18 화면 — index, users, reports,
  board-reports, employer-applications, inquiries, announcements(3), stats,
  tournaments)
  - `src/components/admin/stats/{RoleDistributionChart,TrendChart,StatsSummaryCard}.tsx`
    차트 토큰 참조로 리팩 (하드코딩 색 제거)

### 5.4 공통 적용 (모든 화면)

- StatusBar 분기 (`statusBarStyle: 'light'|'dark'`)
- 에러 메시지 공식 (Impeccable §10): 무엇 + 왜 + 어떻게
- 버튼 라벨 (§11): 구체 동사 + 목적어
- 빈 상태 (§9): 인지 + 가치 + 행동 3단

**총 화면 수**: Staff 25 + Employer 6 + Admin 18 = **49**

## 6. Polish Items (P1~P10)

P9(sticky 섹션 헤더) **제외**. 나머지 9개 도입.

| # | 항목 | 인프라 상태 | 작업 |
| - | ---- | ----------- | ---- |
| P1 | Skeleton | ✅ `src/components/ui/Skeleton.tsx` v3.0.0 | 화면별 `<ScreenSkeleton>` composer 신설 (리스트 9개) |
| P2 | PTR 골드 틴트 | — | `<RefreshControl tintColor={GOLD} colors={[GOLD]} />` 통일 (리스트 8개) |
| P3 | OfflineBanner | ✅ `src/components/ui/OfflineBanner.tsx` + `useNetworkStatus` | 4개 stack `_layout.tsx`에 단일 마운트 |
| P4 | Haptics | ✅ `src/utils/haptics.ts` (throttle 완비) | 결정 지점 15~20곳 호출 심기 (승인/거절/삭제/결제) |
| P5 | Pressed 역방향 | — | `PressableCard` 프리미티브로 통일 |
| P6 | Blurhash | ✅ 클라이언트 선계산 파이프라인 완성 (`0a974920d`), DB 컬럼 존재 | `<Image placeholder={{blurhash}} transition={200} />` 썸네일 8곳 치환 |
| P7 | Focus ring | — | `PressableCard`/`Button`/`Input`에 `{focused}` 분기, outset 2px |
| P8 | StatusBar | — | `Stack.Screen` options `statusBarStyle` 각 stack `_layout.tsx` 5개 |
| P10 | tabular-nums | ✅ Formatters barrel `2cdc0c1b8` | 호출부 40~50곳 `fontVariant: ['tabular-nums']` |

### 6.1 P3 OfflineBanner — 단일 마운트

```tsx
// app/(app)/_layout.tsx, (employer)/_layout.tsx, (admin)/_layout.tsx,
// (auth)/_layout.tsx 각각
<SafeAreaView>
  <OfflineBanner />
  <Stack ... />
</SafeAreaView>
```

### 6.2 P5 PressableCard 구현 패턴

```tsx
<Pressable
  className={({ pressed, focused }) =>
    [
      'rounded-md m-[-2px] border-2 border-transparent',
      pressed && 'bg-surface-hover dark:bg-surface-hover',
      focused && 'border-[#2563EB]',
    ]
      .filter(Boolean)
      .join(' ')
  }
  android_ripple={{ color: isDark ? '#333' : '#E5E5E5' }}
/>
```

### 6.3 폴리시 적용 순서 (의존성)

1. 토큰 추가 → 2. CardStripe/Chip/PressableCard → 3. 화면별 restyle
4. P10 tabular-nums → 5. P3 OfflineBanner 마운트 → 6. P8 StatusBar
7. P6 blurhash 치환 → 8. P2+P1 (리스트) → 9. P4+P7 (결정 지점·프리미티브)

## 7. Verification Strategy

### 7.1 검증 항목

| 범주 | 방법 | 근거 |
| ---- | ---- | ---- |
| 타입 안정성 | `npm run quality` 0 에러 | golden §10 |
| 테스트 | `npm test` 전체 통과 (snapshot `-u` 후) | — |
| 스냅샷 | 마지막 커밋에서 일괄 갱신 | — |
| 접근성 | `accessibilityLabel` / `accessibilityRole` / `accessibilityLiveRegion` 누락 없음 | Impeccable §16·§25 |
| 다크·라이트 | 양쪽 모드 Tier A·B 수동 QA, WCAG AA 4.5:1 유지 | Impeccable §21 |
| Reduce Motion | Skeleton·전환 애니메이션 분기 확인 | Impeccable §8 |
| PR 체크리스트 | Impeccable v2 27항목 | `.claude/rules/impeccable-design.md` |

### 7.2 핵심 시나리오 (수동 QA)

1. **Jobs 리스트** — 초기 스켈레톤 → 데이터 도착 → PTR 골드 → 오프라인 → 배너
   등장(VoiceOver 읽기) → 복구 → 2초 후 dismiss
2. **Employer 승인/거절** — 승인 Medium 햅틱 + 옵티미스틱 제거 + 되돌리기 토스트
   5초
3. **홈 V2** — Hero 렌더 → 3 섹션 스크롤 → tabular-nums 정렬 확인
4. **외부 키보드** — Tab 키 포커스 이동 → Info 블루 2px ring → layout shift 없음
5. **blurhash** — 느린 네트워크 → placeholder → 200ms fade-in

## 8. Risk Register

| 리스크 | 영향 | 완화 |
| ------ | ---- | ---- |
| 스냅샷 대량 갱신 | Review 부담 | 마지막 커밋에서 `jest -u` 일괄, PR에 "스타일 토큰 변경" 명시 |
| tabular-nums 폰트 지원 편차 | iOS/Android 차이 가능 | 샘플 검증 후 `font-variant-numeric` 유지 |
| Focus ring 2px outset | 인접 요소 겹침 | Card·Button·Input 3개 프리미티브만 적용, 남용 금지 |
| blurhash 누락 레거시 이미지 | fallback 필요 | null → `bg-surface-overlay` 단색 (파이프라인에 이미 포함) |
| 한 번 롤아웃 큰 PR | 리뷰 부담 | 물리 커밋 8개로 분리, 머지는 한 번 |
| FlashList `dark:bg-surface` 누락 재발 | 다크 토글 버그 | `.claude/rules/nativewind-patterns.md` 룰 PR 체크 강제 |
| Admin 차트 하드코딩 색 | 토큰 미적용 | `RoleDistributionChart`·`TrendChart`·`StatsSummaryCard` 소스 리팩 |

## 9. Rollout Plan (물리 커밋 분리)

```
c1: feat(design): 토큰·Chip variant·CardStripe·PressableCard 프리미티브
c2: refactor(layouts): OfflineBanner·StatusBar 4개 stack layout 주입
c3: feat(home): V2 대시보드 (DashboardWidgetShell 변형 + Hero)
c4: refactor(tier-a): 구인·공고상세·스케줄·지원자·정산 restyle
c5: refactor(tier-b): 게시판·알림·공지·내공고·리뷰 restyle
c6: refactor(tier-c): 설정·문의·admin restyle (+ stats 차트 토큰화)
c7: feat(polish): Skeleton composer·PTR gold·blurhash·haptics·focus ring·tabular-nums
c8: chore(test): jest snapshot -u + 수동 QA 체크리스트
```

## 10. Success Criteria

- [ ] `npm run quality` 0 에러·0 경고
- [ ] `npm test` 전체 통과 (snapshot 갱신 후)
- [ ] Impeccable v2 PR 체크리스트 27항목 통과
- [ ] Tier A 10 화면 다크·라이트 수동 QA
- [ ] Admin stats 차트 토큰 적용
- [ ] 외부 키보드 포커스 링 layout shift 없음
- [ ] OfflineBanner VoiceOver aria-live 1회 확인
- [ ] Haptics 200ms throttle 대량 액션에서 확인
- [ ] EAS 내부 테스트 빌드 성공

## 11. Files Affected (요약)

**신설**
- `src/components/ui/CardStripe.tsx`
- `src/components/ui/PressableCard.tsx`
- 화면별 `<ScreenSkeleton>` composer (9개)

**수정 (핵심)**
- `tailwind.config.js`
- `src/components/ui/Badge.tsx` (chip variant 추가)
- `src/components/home/HomeTabBar.tsx`
- `app/(app)/(tabs)/_layout.tsx`
- `app/(app)/_layout.tsx`, `(employer)/_layout.tsx`, `(admin)/_layout.tsx`,
  `(auth)/_layout.tsx`
- `app/(app)/home.tsx` + `src/components/home/DashboardWidgetShell.tsx`
- 위젯 4개: `NextWorkWidget`, `ApplicationStatusWidget`, `MonthSummaryWidget`,
  `RecentNoticesWidget`
- `src/components/jobs/{JobCard,JobDetail,JobList,SearchBar,ApplicationForm}.tsx`
- `src/components/schedule/{ScheduleCard,GroupedScheduleCard}.tsx`
- `src/components/employer/applicants/ApplicantCard/*`
- `src/components/employer/settlement/{SettlementCard,GroupedSettlementCard}.tsx`
- `src/components/admin/stats/{RoleDistributionChart,TrendChart,StatsSummaryCard}.tsx`
- 포맷터 호출부 약 40~50곳 (tabular-nums)

**총합**: 신설 약 12개 + 수정 약 80~100개 파일 (호출부 tabular-nums 포함).

## 12. Out of Scope (명시적 제외)

- 레이아웃 재구성 (홈 V2만 예외)
- 네비게이션 변경 (탭 수·순서·라우트)
- Sticky 섹션 헤더(P9)
- Visual regression 자동화 / Storybook
- A/B 실험 · Feature Flag
- DB 스키마 / 비즈니스 로직
- 레거시 호환 shim (L1이라 props 불변)

---

**References**
- `DESIGN.md` (Midnight Craft 디자인 시스템)
- `.claude/rules/impeccable-design.md` (v1 1~15 + v2 16~27)
- `.claude/rules/nativewind-patterns.md`
- `.claude/rules/supabase-patterns.md`
- `CLAUDE.md` (프로젝트 핵심 규칙)
