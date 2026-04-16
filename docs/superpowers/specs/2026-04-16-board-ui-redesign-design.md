# 게시판 UI 리디자인 (블라인드 밀도형)

- **작성일**: 2026-04-16
- **대상**: `uniqn-mobile/app/(app)/(tabs)/board/*`, `uniqn-mobile/src/components/board/BoardPostCard.tsx`
- **참고 앱**: 블라인드(직장인커뮤니티), 포커고수
- **방향**: 밀도형 리스트 + 큐레이션 홈 + 맥락 있는 메타

## 1. 배경과 목적

### 1.1 현재 문제
- 홈 화면의 2×3 진입 카드가 세로 공간을 과하게 차지 — 정작 게시글은 스크롤을 한참 내려야 보임
- `BoardPostCard`가 **제목 + 본문 2줄 + 메타 5종**으로 카드형. 한 화면에 3개밖에 안 보여 탐색 효율이 낮음
- 카테고리 리스트(`[boardType].tsx`) 진입 후 다른 게시판으로 이동하려면 뒤로가기 필수 — 카테고리 간 스위칭 비용이 큼
- 공지/자유/TDA/대타가 모두 같은 카드 레이아웃 — 게시판 성격에 관계없이 좋아요/싫어요/조회수 아이콘이 항상 노출되어 시각 노이즈

### 1.2 목적
- 한 화면에 **7-8개 게시글**을 노출하는 정보 밀도 확보 (현재 3개 → 2배 이상)
- 어디서든 **한 번의 탭으로 다른 게시판**으로 이동할 수 있는 지속 네비게이션
- 홈은 "지금 봐야 할 것" 중심의 **큐레이션** (고정공지 → 인기글 → 내 일정)
- 게시판 성격을 **뱃지 색상**으로 즉시 구분

## 2. 브레인스토밍 결론 요약

| 항목 | 선택 | 다른 대안 대비 이유 |
|------|------|--------------------|
| 전체 방향 | **밀도형 리스트** (블라인드) | 카드형(포커고수) 대비 정보 밀도 2배↑ — 스태프 앱 사용 맥락(빠른 훑기) |
| 홈 구조 | **큐레이션 홈** (섹션 3개) | 통합 피드 대비 "지금 꼭 봐야 할 것" 명확화 |
| 리스트 밀도 | **미니멀** (제목 1줄 + 메타 1줄) | 표준/상세 대비 한 화면 7-8개 노출 |
| 메타 표시 | **전체 4종 유지** | 댓글·조회수·좋아요·싫어요 모두 표시 (현재와 동일) |
| 탭 바 | **두 화면 공통 고정** | 홈과 카테고리 리스트 모두 동일 탭 — 스위칭 비용 제거 |

## 3. 화면 구성

### 3.1 네비게이션 (양 화면 공통)

**상단 구조:**
```
┌──────────────────────────────────┐
│ {화면 타이틀}              [+]   │ ← TabHeader (글쓰기 아이콘)
├──────────────────────────────────┤
│ [홈][공지][일정][자유][TDA][대타]  │ ← BoardTabBar (수평 스크롤)
└──────────────────────────────────┘
```

- **타이틀**: 홈에서는 "게시판", 카테고리에서는 `BOARD_TYPE_LABELS[boardType]`
- **탭 바**: pill 스타일 (border-radius 14px), 활성 탭은 `bg-primary-500 text-black font-bold`, 비활성은 `bg-surface-elevated text-content-muted`
- **탭 순서**: `홈 → 공지 → 일정 → 자유 → TDA → 대타` (정보 중요도 순)
- **탭 클릭 동작**: 홈 탭은 `/board`, 나머지는 `/board/{boardType}`로 `router.replace()` (뒤로가기 스택에 쌓지 않음)

### 3.2 홈 화면 (`board/index.tsx`)

```
상단 탭 (홈 활성)
─────────────────
📌 고정 공지 (있을 때만)
  ├ {가장 최근 고정 공지 1건} — 좌측 골드 세로바 강조
─────────────────
🔥 인기글                              더보기 ›
  ├ 게시글 1 (커뮤니티 인기글)
  ├ 게시글 2
  └ 게시글 3
─────────────────
🕒 {역할별 섹션 타이틀}                더보기 ›
  ├ 일정 활동 1
  ├ 일정 활동 2
  └ 일정 활동 3
```

- **섹션 타이틀**: 10px, 골드 강조, uppercase. 우측 "더보기 ›" (있을 때만)
- **섹션별 표시 개수**: 고정공지 **최대 2건** (`data.pinnedNotices.slice(0, 2)`), 인기글 3건, 내 일정 활동 3건
- **고정 공지 블록**: 리스트 아이템과 별개로 `배경 #151008 + border-left 2px 골드`로 시각 구분
- **역할별 "최근 활동" 섹션 타이틀** (기존 로직 유지):
  - admin: `최근 일정 활동`
  - employer: `내 공고 최근 활동`
  - staff: `내 일정 최근 활동`
- **"더보기 ›"** 탭: 해당 카테고리 탭으로 이동

### 3.3 카테고리 리스트 화면 (`board/[boardType].tsx`)

```
상단 탭 ({boardType} 활성)
─────────────────
게시글 1
게시글 2
게시글 3
...
                                  [+] FAB (우하단, 자유/TDA만)
```

- **탭 바는 홈과 동일하게 고정** — 현재 보고 있는 게시판 탭이 활성
- **글쓰기 진입**: 헤더 우측 `+` 아이콘 + 우하단 **플로팅 FAB** (42×42, 골드 배경). FAB은 `free`/`tda`에서만 표시
- **빈 상태**: 현재 `EmptyState` 유지

## 4. 리스트 아이템 설계 (`BoardPostCard` 개편)

### 4.1 레이아웃

```
┌─────────────────────────────────────────────────────┐
│ [뱃지] 제목 한 줄 (ellipsis)                          │
│ 작성자 · MM.DD · 💬N · 👁N · ♥N · ✖N                  │
└─────────────────────────────────────────────────────┘
padding: 10px 4px / border-bottom: 1px solid #1c1c1c
```

- **제목**: `text-base font-sans-semibold text-content-primary dark:text-secondary-100`, 1줄 ellipsis
- **본문 미리보기**: **완전 제거** (밀도 우선)
- **우측 썸네일**: **제거** (이미지 있는 글에 아이콘 표시 안 함 — 밀도 우선)
- **메타 라인**: `text-xs text-secondary-500 dark:text-secondary-400`, flex-row, gap 6px
  - `💬` 댓글: 골드 강조 (`#D4AF37`, font-semibold)
  - `👁` 조회수: secondary-400 (중간 톤)
  - `♥` 좋아요: success-500 녹색
  - `✖` 싫어요: danger-500 빨강
- **핀/잠금 아이콘**: 현재 로직 유지 (제목 옆 표시). 뱃지와 동일 라인

### 4.2 뱃지 색상 (게시판 타입별 구분)

| 타입 | 배경 | 텍스트 | 기반 |
|------|------|--------|------|
| `notice` 공지 | `#1f2a3a` | `#93C5FD` | 파랑 (정보/공식) |
| `schedule` 일정 | `#1a2a1f` | `#6EE7B7` | 초록 (진행/OK) |
| `free` 자유 | `#2a2118` | `#D4AF37` | 골드 (브랜드/커뮤니티 메인) |
| `tda` TDA | `#2a1f2a` | `#E879F9` | 보라 (토론/전문) |
| `substitute` 대타 | `#2a1a1a` | `#FCA5A5` | 빨강 (긴급/구인) |

- 기존 `Badge` 컴포넌트의 `variant="primary" | "secondary"` 대신 **`boardType` 기반 색상 맵**으로 전환
- 공통 스타일: `text-xs font-semibold`, `padding: 1px 6px`, `border-radius: 3px`

### 4.3 메타 포맷
- **날짜**: `MM.DD` (같은 해면 월.일만, 이전 해면 `YYYY.MM.DD`)
- **카운트 표기**: 1000 미만은 숫자 그대로, 1000 이상은 `1.2k` 형태. 기존 프로젝트 포맷터(`src/utils/` 하위)를 우선 검색해 재사용하고, 없으면 `BoardPostCard` 내부 헬퍼 함수로 추가 (외부 의존성 없이 소수점 1자리 반올림)
- **공지글**은 댓글 수 항상 표시하되 0이면 `💬0`도 표시 (일관성 — `showEngagementMetrics` 분기 제거)

## 5. 신규/변경 컴포넌트

### 5.1 신규: `BoardTabBar`
- **위치**: `uniqn-mobile/src/components/board/BoardTabBar.tsx`
- **Props**:
  ```ts
  interface BoardTabBarProps {
    activeTab: 'home' | BoardType;
    onTabPress: (tab: 'home' | BoardType) => void;
  }
  ```
- **렌더링**: `ScrollView horizontal` + 탭 pill 6개 (`홈 / 공지 / 일정 / 자유 / TDA / 대타`)
- **접근성**: 각 탭 `accessibilityRole="tab"`, `accessibilityState={{ selected: boolean }}`
- **다크모드**: NativeWind `dark:` prefix 필수

### 5.2 개편: `BoardPostCard`
- `Card` 래퍼 제거 → `Pressable`에 `border-bottom` 적용한 리스트 아이템으로 전환
- 본문 `<Text numberOfLines={2}>` 섹션 삭제
- `showEngagementMetrics` 분기 제거 — 4종 메타 전부 항상 표시
- 뱃지를 `Badge` 컴포넌트 대신 신규 **`BoardTypeBadge`** (내부 색상 맵)로 교체
  - `uniqn-mobile/src/components/board/BoardTypeBadge.tsx` 신규 파일
- 기존 `BoardPostCard` 테스트(`__tests__/BoardPostCard.test.tsx`)는 새 레이아웃에 맞게 업데이트

### 5.3 홈 `BoardSection` 수정 (`board/index.tsx`)
- 섹션 타이틀 스타일 변경: 현재 `text-lg font-display-semibold` → `text-xs uppercase text-secondary-500 tracking-wider`
- "더보기 ›" 링크 추가: 카테고리 탭으로 `router.push('/board/{type}')`
- 진입 카드 2×3 그리드 **완전 제거** (탭 바로 대체)
- 고정공지 블록: 별도 컴포넌트 `PinnedNoticeBanner`로 분리

### 5.4 글쓰기 FAB
- 신규: `uniqn-mobile/src/components/board/BoardWriteFab.tsx`
- `position: absolute`, `right: 16`, `bottom: 16`, 42×42 원형
- `safe-area-insets` 고려 (iPhone 홈 인디케이터 회피)
- `free` / `tda` 카테고리에서만 표시

## 6. 라우팅 변경

### 6.1 탭 이동 시 `replace` 사용
- 현재: `router.push()` — 뒤로가기 스택에 계속 쌓임
- 변경: `router.replace()` — 탭 간 이동은 스택을 쌓지 않음 (네이티브 탭 UX와 일치)
- 게시글 상세 진입(`post/[postId]`)은 `push` 유지

### 6.2 홈 탭 처리
- `/board` = 홈 (index.tsx)
- 홈 탭 활성 조건: `activeTab === 'home'`
- 카테고리 탭에서 홈 탭 클릭 → `router.replace('/(app)/(tabs)/board')`

## 7. 아키텍처 가드레일

- **Presentation → Hooks → Service → Repository → Supabase** 구조 유지
- 신규 Hook 불필요 — 기존 `useBoardHome`, `useBoardPosts` 그대로 사용
- **다크모드**: 모든 신규 스타일에 `dark:` prefix 필수 (`project rules`: nativewind-patterns.md)
- **로깅**: 런타임 로그는 `logger.info()` 사용 (CLAUDE.md 규칙)
- **한글 문자열**: 탭 라벨/섹션 타이틀은 i18n 대비 상수로 분리 가능하나, 현 프로젝트 패턴상 인라인 유지

## 8. 테스트 전략

### 8.1 유닛 테스트
- `BoardTabBar.test.tsx` — 탭 6개 렌더링, 활성 상태 표시, `onTabPress` 호출
- `BoardPostCard.test.tsx` — 기존 테스트 업데이트 (본문 2줄 단언 제거, 4종 메타 단언 추가)
- `BoardTypeBadge.test.tsx` — 5개 타입별 스타일 분기

### 8.2 E2E (기존 `e2e/tests/p2-standard/board.spec.ts` 확장)
- 홈 → 자유 탭 → TDA 탭 → 대타 탭 순회 시 **뒤로가기 없이** 이동 가능 확인
- 홈 섹션의 "더보기 ›" 클릭 시 해당 카테고리로 이동
- FAB 탭 시 글쓰기 화면 진입 (free/tda만)

### 8.3 접근성
- 각 탭에 `accessibilityRole="tab"`, `accessibilityState={{ selected }}`
- FAB에 `accessibilityLabel="글쓰기"`
- 뱃지는 텍스트 라벨 유지 (색상만으로 구분 X — WCAG 2.4.6)

## 9. 성공 기준

1. **정보 밀도**: 자유게시판 첫 스크롤 없이 게시글 **7개 이상** 노출
2. **카테고리 스위칭**: 어느 화면에서든 다른 게시판으로 **1 탭** 이동 가능
3. **시각 구분**: 뱃지 색상만으로 게시판 타입 즉시 식별 가능 (5개 타입)
4. **기존 기능 회귀 없음**: 글쓰기 / 상세 / 좋아요 / 댓글 흐름 모두 동작
5. **다크모드 일관성**: 모든 신규 요소에서 라이트/다크 모두 정상

## 10. Non-goals (이번 스코프 밖)

- 게시글 정렬 옵션 (최신순/인기순 토글) — 후속 과제
- 검색 기능 — 별도 스펙
- 이미지 썸네일 표시 — 밀도 우선 결정에 따라 이번엔 제외
- 무한 스크롤 개선 — 현재 50건 제한 유지
- 알림 뱃지(미읽음 카운트) 탭 — 후속 과제
- 푸터 탭 바 네비게이션 변경 — 게시판 내부만 다룸

## 11. 영향 범위 체크리스트

수정 파일:
- `app/(app)/(tabs)/board/index.tsx` (홈 화면)
- `app/(app)/(tabs)/board/[boardType].tsx` (카테고리 리스트)
- `src/components/board/BoardPostCard.tsx` (리스트 아이템)
- `src/components/board/__tests__/BoardPostCard.test.tsx`

신규 파일:
- `src/components/board/BoardTabBar.tsx`
- `src/components/board/BoardTabBar.test.tsx`
- `src/components/board/BoardTypeBadge.tsx`
- `src/components/board/BoardTypeBadge.test.tsx`
- `src/components/board/BoardWriteFab.tsx`
- `src/components/board/PinnedNoticeBanner.tsx`

영향 없음 (읽기 전용):
- `src/hooks/useBoard.ts`
- `src/services/boardService.ts`
- `src/repositories/supabase/BoardRepository.ts`
- `src/types/board.ts` (`BOARD_TYPE_LABELS` 활용만)
