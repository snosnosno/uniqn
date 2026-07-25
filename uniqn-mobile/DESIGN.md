# Design System — UNIQN

## Product Context

- **What this is:** 홀덤펍·대회 스태프 관리 모바일 앱 (스케줄, 구인, 출퇴근, 정산)
- **Who it's for:** 홀덤펍·대회 사업주(employer) + 딜러/스태프(dealer, floor, serving)
- **Space/industry:** 홀덤펍 / 홀덤 대회 인력 관리
- **Project type:** Mobile app (Expo / React Native / NativeWind)

## Aesthetic Direction

- **Direction:** Industrial/Utilitarian + subtle Luxury — "Midnight Craft"
- **Decoration level:** Intentional — 타이포그래피와 여백이 주력, 미세한 텍스처로 깊이감
- **Mood:** 밤에 일하는 프로를 위한 업무 도구. 무겁지 않지만 가벼워 보이지도 않는.
- **Anti-patterns:** 이모지 상태 표시, 과한 라운딩(rounded-full), 파스텔 틴트, 보라색

## Typography

- **Display/Hero:** Outfit — 기하학적이고 모던, 한국어와 어울리는 라운드 형태
- **Body/UI/Numbers:** Plus Jakarta Sans — 가독성 높고 친근, 숫자도 동일 폰트
- **Code (개발 전용):** Geist Mono — 앱 UI에는 사용하지 않음
- **Loading:** expo-font (useFonts hook, @expo-google-fonts/\*)

### 롤아웃 현황 (2026-04-12 기준)

| Stage   | 범위                                                    | 상태    | 커밋        |
| ------- | ------------------------------------------------------- | ------- | ----------- |
| Stage 1 | 폰트 설치 + 초기 적용 (Outfit + Plus Jakarta Sans)      | ✅ 완료 | `21deded1c` |
| Stage 2 | 헤딩 73개 파일 — H1~H5 fontFamily 일괄 적용             | ✅ 완료 | `d455a1989` |
| Stage 3 | 네이티브 Stack 헤더 fontFamily 주입                     | ✅ 완료 | `c32991172` |
| Stage 4 | 본문/캡션 Text 요소 (~1,800개) — Plus Jakarta Sans 적용 | ✅ 완료 | `f3599214d` |

- **Scale:**
  - H1: 36px / weight 800
  - H2: 28px / weight 700
  - H3: 22px / weight 600
  - H4: 18px / weight 600
  - H5: 15px / weight 600
  - Body: 14px / weight 400
  - Caption: 12px / weight 500
  - Micro: 10px / weight 600

## Color

### Dark Mode (기본)

- **Approach:** Restrained — 골드 액센트는 CTA와 금액 표시에만 절제 사용
- **Gold (Accent):** #D4AF37 — CTA, 금액, 활성 탭 전용. 선명하고 눈에 띄어야 함.
- **Gold Light:** #E8C84E
- **Gold Dark:** #B8962E
- **Gold Subtle:** rgba(212,175,55,0.06)
- **Gold Subtle Strong:** rgba(212,175,55,0.12)
- **Surface (page):** #0B0B0E — Option B (LCD smearing 방지, 순흑 회피)
- **Surface Card:** #141418 — 카드 기본 배경, page 대비 ΔL≈+9
- **Surface Elevated:** #1C1C22 — sheet/popover, card보다 높은 단계
- **Surface Overlay:** #26262C — modal 배경
- **Surface Hover:** #2E2E34 — pressed/hover
- **Surface Dark (splash):** #07070A — page 아래 단계, splash/오버스크롤
- **Text Primary:** #F0F0F2
- **Text Secondary:** #C0C0C8 (뉴트럴 그레이 — 보조 정보. 무채색 중립.)
- **Text Muted:** #9898A0 (뉴트럴 그레이 — 플레이스홀더, 캡션. 더 뮤트.)
- **Text On Gold:** #09090B
- **Border:** #222228
- **Border Subtle:** #1C1C22
- **Success:** #22C55E / subtle rgba(34,197,94,0.08)
- **Warning:** #D4A017 / subtle rgba(212,160,23,0.08)
- **Error:** #DC2626 / subtle rgba(220,38,38,0.08)
- **Info:** #2563EB / subtle rgba(37,99,235,0.08)

### Light Mode

- **Background:** #F5F5F2 (웜 틴트 — 다크모드와 톤 통일)
- **Card Background:** #FFFFFF
- **Card Border:** #D6D2CA (웜 보더)
- **Gold (Accent):** #8A7228 — CTA, 금액 전용
- **Gold Light:** #A68A3E
- **Gold Dark:** #6E5A1E
- **Gold Subtle:** rgba(138,114,40,0.08)
- **Gold Subtle Strong:** rgba(138,114,40,0.14)
- **Text Primary:** #09090B
- **Text Secondary:** #606068 (뉴트럴 그레이 — 라이트모드 보조 정보)
- **Text Muted:** #888890 (뉴트럴 그레이 — 라이트모드 플레이스홀더, 캡션)
- **Border:** #D6D2CA
- **Border Subtle:** #E8E4DC
- **Surface Overlay:** #EDEBE6
- **Success:** #16A34A / subtle rgba(22,163,74,0.10)
- **Warning:** #A16207 / subtle rgba(161,98,7,0.10)
- **Error:** #B91C1C / subtle rgba(185,28,28,0.10)
- **Info:** #1D4ED8 / subtle rgba(29,78,216,0.10)

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- **Touch target:** 최소 40px (WCAG)

## Layout

- **Approach:** Grid-disciplined — 스케줄, 정산, 리스트 데이터가 많은 앱
- **Border radius:** xs: 4px, sm: 6px, md: 8px, lg: 10px (rounded-full 사용 금지, 아바타 포함)
  - **예외 — 필터 칩/필(pill)만 `rounded-full` 허용** (2026-07-25 결정): 가로 스크롤 필터 행은
    알약 형태가 "선택 가능한 토글"이라는 관례적 어포던스를 만든다. 컨테이너·카드·배지·아바타에는
    여전히 금지. 해당 범위: `PostingTypeChips`, `FilterBar`, 각 필터 시트의 선택 칩.
- **Max content width:** 모바일 앱이므로 화면 너비 기준

## Motion

- **Approach:** Minimal-functional — 상태 전환 애니메이션만
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-350ms)

## Component Rules

### 상태 배지

- 이모지 사용 금지 — 텍스트 + 컬러로만 상태 표현
- border-radius: 4px (xs) — rounded-full 금지
- 배경: dark mode rgba(color, 0.08), light mode rgba(color, 0.10)

### 알림/Alert

- 왼쪽 2px 보더 라인 스타일 — 둥근 박스 + 이모지 금지
- 배경: surface-overlay 단색

### 버튼

- border-radius: 6px (sm)
- Primary: 골드 배경, 블랙 텍스트
- min-height: 40px

### 카드

- border-radius: 8px (md)
- 1px solid border
- hover시 border-color 변경 (배경색 변경 아님)

### 아바타

- 정사각형 + border-radius 6px (sm) — 원형 금지

### 아이콘

- **Lucide**(공식 채택) — stroke 2.0, outline 기본
- Import 경로: `@/components/icons` 단일 소스(ESLint로 `lucide-react-native` 직접 import 차단)
- Size 허용: 14 / 16 / 18 / 20 / 24 / 28 / 32 (중간값 금지)
- Filled 토글: Heart, Bookmark, Star 한정
- 상세: `.claude/rules/impeccable-design.md` §27

## Decisions Log

| Date       | Decision                                            | Rationale                                                                                                                                                                                |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-11 | 블랙/골드 디자인 시스템 생성                        | 기존 보라/골드가 AI 생성 전형 + 유아틱 피드백                                                                                                                                            |
| 2026-04-11 | 이모지 상태 배지 제거                               | 유아틱한 분위기의 핵심 원인                                                                                                                                                              |
| 2026-04-11 | rounded-full 금지                                   | 과한 라운딩이 장난감 느낌 유발                                                                                                                                                           |
| 2026-04-11 | 파스텔 틴트 제거                                    | 어두운 rgba 틴트로 교체, 캔디 같은 색감 제거                                                                                                                                             |
| 2026-04-11 | 숫자 폰트 시스템 기본 유지                          | 기존 앱 폰트와 일관성 유지                                                                                                                                                               |
| 2026-04-11 | 라이트모드 골드/텍스트 진하게                       | 가독성 확보 (#7A6420 골드, #3F3F46 보조 텍스트)                                                                                                                                          |
| 2026-04-13 | 보조 텍스트 뉴트럴 그레이로 전환                    | 골드 틴트 제거, 무채색 중립 그레이 적용 (A옵션: Secondary #C0C0C8, Muted #9898A0)                                                                                                        |
| 2026-04-13 | FlashList 래퍼에 `dark:bg-surface` 명시 필수        | CSS var 해소 실패 시 NativeWind가 dark 값 대신 light 값으로 고정되는 문제 방지                                                                                                           |
| 2026-04-17 | Lucide 공식 채택, 커스텀 SVG 아이콘 라이브러리 폐기 | 90+ 커스텀 아이콘의 stroke·광학 밸런스 불일치 → Lucide로 통일(stroke 2.0, outline 기본). `@/components/icons` 래핑 유지로 호출부 0 수정. KRW 심볼은 Lucide 부재로 커스텀 SVG 1건만 유지. |
