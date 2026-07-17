# 오프라인 UI 교체 설계 — OfflineBanner → OfflineStatusBar 승격 (2026-07-16)

## 배경 / 문제

전역 오프라인 표시가 `OfflineBanner variant="banner"`(`app/_layout.tsx:178`)인데:

- 진한 빨간(`bg-error-600`) 블록이 시스템 상태바 영역까지 덮음 (`paddingTop: insets.top + 12`)
- 일반 플로우 요소라서 나타날 때 **헤더 포함 화면 전체를 아래로 밀어냄** (레이아웃 점프)
- 애니메이션 없음 — 갑자기 등장/소멸
- 사용자 피드백: "너무 구리고 헤더쪽에 있어서 이상해"

한편 impeccable v2 §25 스펙을 준수하는 `OfflineStatusBar`(`src/components/ui/OfflineStatusBar.tsx`)가
이미 구현·단위테스트까지 갖춰져 있으나 **어디에도 마운트되지 않은 죽은 코드** 상태.

## 결정 (사용자 확정 3건)

| 질문 | 결정 |
|------|------|
| 위치/형태 | **상단 얇은 오버레이** — OfflineStatusBar 재활용, 헤더 안 밀고 상태바 안 침범 |
| 재시도 버튼 | **완전 패시브** — NetInfo 자동 감지 + 재연결 자동 refetch가 이미 있어 버튼은 플라시보 |
| 구 OfflineBanner | **완전 삭제** — 3변형(banner/fullscreen/toast) 전부, git 이력으로 복원 가능 |

2026-04-17 결정(메모리 `project_offline_ui_decision.md`, "OfflineBanner 전역 유지")을 뒤집는다.
당시 결정문 자체가 "UX 변경 요구가 생기면 재검토 + E2E 먼저 업데이트"를 명시했고, 이번이 그 경우다.

## 설계

### 1. 교체 (마운트 지점)

- `app/_layout.tsx:178` `<OfflineBanner variant="banner" />` → `<OfflineStatusBar />`
- 기존 자리 유지 → 로그인 전/후 모두 커버
- absolute 오버레이(`top: insets.top`, zIndex 1000), `pointerEvents="none"` — 콘텐츠 터치 통과

### 2. OfflineStatusBar 마감 개선 (§25 완성)

현재 두 phase(offline/reconnected) 모두 warning(앰버) 토큰을 쓰는데, §25는 복구 시 success 톤:

- **reconnected phase 전용 토큰 추가**:
  - 배경 `rgba(34,197,94,0.15)` (STATUS_COLORS.success `#22C55E` 기반, warning과 동일 0.15 알파)
  - 아이콘/텍스트 색: dark `#22C55E` / light `#16A34A` (tailwind success-600 계열, 구현 시 config 실값 확인)
- **복구 아이콘 교체**: `WifiOff` → `Wifi` (`@/components/icons` 경유, 없으면 icons/index 추가)
- 유지: 40px 높이, entrance 300ms / exit 225ms(75% 규칙), reduce-motion 분기,
  `accessibilityRole="alert"` + `accessibilityLiveRegion="polite"`, 2초 auto-dismiss

### 3. 삭제 (죽은 코드 정리)

- `src/components/ui/OfflineBanner.tsx` 삭제
- `src/components/ui/index.ts:183` export 제거
- `app/_layout.tsx:23` import 제거
- 세션 메모리 `project_offline_ui_decision.md` 갱신 (구현 완료 시점에)

### 4. 테스트

- **단위** `src/components/ui/__tests__/OfflineStatusBar.test.tsx` (현재 7/7 GREEN):
  - reconnected phase에서 success 토큰 배경/아이콘 렌더 케이스 추가
  - offline phase는 기존 warning 토큰 유지 검증
- **E2E** `e2e/tests/p4-stretch/offline-network.spec.ts`:
  - 시나리오 3(재시도 버튼 가시성/활성화) **삭제**
  - 시나리오 1·2(표시/복구)를 `testID="offline-status-bar"` / `role="alert"` 기준으로 수정
  - 복구 시 "온라인으로 돌아왔어요" 표시 → 2초 후 사라짐 검증 추가

### 5. 리스크 / 트레이드오프 (수용)

- RN `Modal` 표시 중엔 오버레이 배너가 네이티브 모달 레이어 뒤에 가려짐.
  기존 배너는 레이아웃을 밀어 항상 보였으나, 오프라인 인지는 진입 시 1회로 충분 — 수용.
- `pointerEvents="none"`이라 배너가 헤더 상단을 40px 덮어도 헤더 터치는 통과 —
  단, 시각적으로 헤더 타이틀과 겹치는 화면이 있는지 구현 시 스모크 확인.
- 서버 무변경, 변경 파일 ~5개, OTA 배포 가능 범위.

## 검증 게이트

- `npx jest src/components/ui/__tests__/OfflineStatusBar.test.tsx` GREEN
- `npm run quality` (type-check + lint + format) EXIT 0
- knip에 OfflineBanner 잔존 참조 0건
- E2E offline-network.spec 수정본 로컬 실행 (러너 가용 시)
