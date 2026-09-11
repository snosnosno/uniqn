---
paths:
  - "uniqn-mobile/src/components/**/*.tsx"
  - "uniqn-mobile/app/**/*.tsx"
---

# NativeWind 패턴 규칙

## 1. FlashList 래퍼 — 다크모드 배경 명시 필수 (CRITICAL)

NativeWind가 CSS 변수(`bg-surface-page`) 컴파일 시 dark 값 대신 light 값으로 고정될 수 있음.
FlashList 내부 컨테이너에는 반드시 `dark:bg-surface`를 명시적으로 추가:

```tsx
// ✅ CORRECT — dark 배경 명시로 NativeWind 컴파일 강제
<View className="flex-1 bg-surface-page dark:bg-surface">
  <FlashList ... />
</View>

// ❌ WRONG — CSS var만 사용 시 다크모드에서 밝은 배경(#F5F5F2)으로 보임
<View className="flex-1 bg-surface-page">
  <FlashList ... />
</View>
```

**적용 대상**: 전체화면 리스트 컨테이너 (JobList, ApplicantList, SettlementList 등)

## 2. CSS 변수 웹 주입 — `_layout.tsx`

NativeWind가 웹에서 CSS 변수를 생성하지 않는 경우 `_layout.tsx`에서 직접 주입:

```tsx
// app/_layout.tsx
<style>{`
  /* 다크모드 명시 오버라이드 (CSS var 해소 실패 대비) */
  .dark .bg-surface-page, .dark.bg-surface-page { background-color: #09090B !important; }
  .dark .bg-surface-card, .dark.bg-surface-card { background-color: #111113 !important; }
  .dark .border-divider, .dark.border-divider   { border-color: #222228 !important; }

  /* placeholder 색상 (NativeWind가 var() 룰 미생성) */
  .placeholder\\:text-content-placeholder::placeholder { color: var(--color-content-placeholder) !important; }
  input::placeholder, textarea::placeholder           { color: var(--color-content-placeholder); }
`}</style>
```

## 3. dark: 클래스 항상 함께 작성

모든 색상 관련 Tailwind 클래스는 `dark:` 쌍을 함께 작성:

```tsx
// ✅ CORRECT
<Text className="text-content-primary dark:text-content-primary">
<View className="bg-surface-elevated dark:bg-surface-elevated">

// ❌ WRONG — 라이트모드만 명시
<Text className="text-content-primary">
```

## 4. 시맨틱 디자인 토큰 사용

raw Tailwind 색상 클래스 대신 프로젝트 디자인 토큰 사용:

```tsx
// ✅ CORRECT — 디자인 시스템 토큰
className="bg-surface text-content-primary border-border"
className="text-gold"           // 금액, CTA
className="text-content-secondary" // 보조 텍스트 (#C0C0C8)

// ❌ WRONG — raw Tailwind
className="bg-zinc-900 text-gray-100 border-gray-700"
className="text-yellow-500"
```

## 5. 보라색 / 파스텔 금지

```
금지: purple-*, indigo-*, violet-*, pink-* (파스텔 계열)
허용: gold (#D4AF37), surface (#09090B~), content-*, border-*
```

RefreshControl `tintColor`, 아이콘 `color` 등 인라인 색상도 동일:

```tsx
// ✅ CORRECT
<RefreshControl tintColor="#D4AF37" />
<CalendarIcon color={isToday ? '#D4AF37' : SECONDARY_PALETTE[500]} />

// ❌ WRONG — 보라색 하드코딩
<RefreshControl tintColor="#6366F1" />
<CalendarIcon color="#6366F1" />
```

## 6. 혼합 타입 리스트 — `getItemType` 필수 (CRITICAL)

한 리스트가 **서로 다른 레이아웃의 아이템**을 렌더하면 `getItemType` 을 반드시 준다.
FlashList 는 아이템 뷰를 재활용하는데, 타입 구분이 없으면 높이 85px 짜리 단일 알림 뷰가
2줄짜리 그룹 알림으로 재활용되면서 매 스크롤마다 레이아웃을 다시 잰다.

```tsx
// ❌ WRONG — renderItem 안에서 분기만 하고 재활용 풀은 하나
const renderItem = useCallback(({ item }) => {
  if (isGroupedNotification(item)) {
    return <NotificationGroupItem group={item} />;
  }
  return <NotificationItem notification={item} />;
}, [...]);

<AppFlashList data={notifications} renderItem={renderItem} estimatedItemSize={85} />

// ✅ CORRECT — 타입별로 재활용 풀을 나눈다
const getItemType = useCallback(
  (item: NotificationListItem) => (isGroupedNotification(item) ? 'group' : 'single'),
  []
);

<AppFlashList
  data={notifications}
  renderItem={renderItem}
  getItemType={getItemType}
  estimatedItemSize={85}
/>
```

**판별법**: `renderItem` 안에 `if` 로 다른 컴포넌트를 반환하는 분기가 있으면 대상이다.
`estimatedItemSize` 가 하나뿐인데 실제 높이가 타입마다 다르면 그 값은 어느 쪽에도 안 맞는다.

**선례**: `board/post/[postId].tsx` 가 `getItemType={(item) => item.type}` 로 이미 옳게 쓰고 있다.

## 7. `renderItem` 은 `useCallback` + deps 명시 (이미 정착한 관행 — 명문화)

`renderItem` 을 인라인 화살표로 넘기면 부모가 리렌더될 때마다 리스트 전체가 새 함수를 받아
메모이제이션이 깨진다. 이 저장소는 이미 전 리스트가 이 관행을 지키고 있다
(`JobList` · `ApplicantList` · `NotificationList` 등) — 새 리스트도 같게 쓴다.

`renderItem` **내부에서** 아이템별 콜백(`onPress={() => handle(item.id)}`)이나
인라인 스타일 객체(`style={{ ... }}`)를 만들지 않는다. 매 렌더 새 참조가 생겨
자식의 `memo()` 가 무력화된다. 콜백은 리스트 루트에서 하나 만들어 아이템이 자기 id 로
호출하게 하고, 스타일은 모듈 스코프 상수로 뺀다.
