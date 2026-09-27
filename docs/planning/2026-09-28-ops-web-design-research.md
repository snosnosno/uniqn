---
title: ops 웹 디자인 조사 종합 — 경쟁사 3곳 + 웹 조사 + 독립 디자인 의견
date: 2026-09-28
status: D1 입력 자료
related:
  - docs/planning/2026-09-27-ops-web-design.md
source: 사용자 수집 스크린샷 `Desktop/UNIQN 사업/경쟁업체/{apis,k-holdem,와홀덤}` 42장 + 엑셀 1 · WebSearch
---

# ops 웹 디자인 조사 종합

> **결론**: 국내외 어느 제품도 "태블릿 가로 + 키보드/터치 몇 번에 끝나는 속도"를 설계 원칙으로 삼지 않았다.
> 사용자가 고른 기억될 한 가지 = **극강의 속도감**, 브랜드 = **UNIQN 과 별도 서브브랜드**.

## 1. 경쟁사 3곳 요약

| | APIS LIVE | kHoldem | 와홀덤 |
|---|---|---|---|
| 정체 | **플레이어용** 조회 앱(홀덤펍 게임·대회 디렉토리 + 라이브 트래커) | **운영자용** 대회 운영 SW(iOS 플로어 앱 + TV 클라이언트). APT 등 실제 프로덕션 사용 | **운영자용** PC 웹 백오피스(스트럭처·대회등록·TV 스킨 CMS). 전국 1,138 매장 |
| 구조 | 하단탭 5 → 게임 상세 6탭(메인/블라인드/프라이즈/포스터/PLAYERS/매장) | 대회 목록 → **Status/Tables/Players/Levels/Payouts/History 6탭** | 좌→우 설정 마법사형(스트럭처→대회등록→스킨→배경→색상) |
| 시각 | 순검정 + 레드/오렌지 CTA + 골드 상금 | TV 남색 그라데이션·크림 숫자 / 앱 진녹색 헤더·스큐어모픽 아이콘 | 검정 + 마젠타·보라·옐로·시안 |
| 잘한 점 | 대형 볼드 숫자 위계, 원형 좌석도, 블라인드표에 브레이크 인라인 | 좌석 롱프레스 액션시트, 사용자+기기 감사로그, TV 클라이언트 분리, 탈락 시 순위·상금 자동 팝업 | TV 클럭 배치(중앙 시계+주변 통계), 레벨 일괄적용, 모바일 표기명 분리 |
| 약점(속도) | 핵심 정보가 6탭에 분산 | 6탭×좌우화살표 순회, 숫자에 굵기 대비 없음 | 옵션 폭발(색상 피커 8종), 스텝 없는 긴 폼 |

🔑 **현 UNIQN ops 는 kHoldem 과 구조가 거의 같다**(6탭, 테이블 잠금·우선순위). 같은 기능을 "더 빠르게" 가 차별점이다.

## 2. 현장 실태 — 엑셀로 새는 일

kHoldem 사용 현장의 `슈퍼컵 Day2 진출명단.xlsx`(6시트): Day1 플라이트 A~D + 여러 매장 위성대회 결과를
**손으로 이어 붙여** Day2 진출자·칩순위·평균칩을 만든다. 앱이 멀티 플라이트 통합을 못 해서다.
→ **플라이트/위성 → Day2 통합**은 제품 기회(서버 RPC 필요 — 디자인 범위 밖, 백로그).

## 3. 업계 공통 기대(안전한 선택)

- TV 클럭: 시간 > 현재 블라인드 > 인원 > 평균스택 > 상금 > 다음 브레이크. 다크 + 초대형 숫자.
- 등록→리바이→애드온→탈락→지급 단일 흐름, 감사 로그, 역할별 권한, 블라인드 템플릿.
- 멀티 디바이스 실시간 동기화(콘솔·TV·플레이어 폰).

## 4. 이길 틈

1. **태블릿 가로 1순위** — 조사 대상 중 명시한 곳 없음.
2. **키보드 퍼스트·낙관적 UI(50~100ms 반응)** — 업계 도구는 클릭 중심, 조작 지연 불만 존재.
3. **확인창 대신 실행취소** — 오조작 복구가 업계 반복 불만.
4. **다크 TV 클럭 + 플레이어 QR 개인화면 통합** — 국내 미확인.
5. **TV 스킨은 프리셋 3~4개**(와홀덤식 색상 피커 나열의 반대).

## 5. 우리에게 없는 기능 후보(제품 백로그 — 이번 디자인 범위 밖)

- 다중 이벤트(플라이트) 동시 운영 목록 + 날짜·장소 필터
- 플라이트/위성 → Day2 통합
- 탈락 시 ITM 순위·상금 즉시 표시(현 앱 보유 여부 W6 동등성 점검에서 확인)
- 감사 로그에 기기명
- 좌석 원터치 액션(탈락/이동/비우기/체크인) — 현 앱 RPC 는 있음, UI 로 노출

## 6. 출처

- 경쟁사: 사용자 수집 자료(위 경로). 개인정보는 분석 보고에서 마스킹.
- 웹: [LetsPoker](https://lets.poker/platform-features/) · [Poker Hawk](https://www.pokerhawk.io/tournament-clock) · [Blind Valet](https://blindvalet.com/) · [PokerAtlas TableCaptain](https://www.pokeratlas.com/info/table-captain) · [Tournament Director](https://thetournamentdirector.net/) · [와홀덤](https://waholdem.com/) · [스마트홀덤](https://www.smartholdem.co.kr/) · [홀딕스](https://holdix.webflow.io/) · [Superhuman 속도 원칙](https://blakecrosley.com/guides/design/superhuman) · [Linear 속도](https://performance.dev/how-is-linear-so-fast-a-technical-breakdown) · [TD 사용자 불만](https://www.pokerchipforum.com/threads/not-really-impressed-with-tournament-director-software-any-interest-in-this.69632/)
- 미확인: Kahuna·TDM·Swiss Poker TD 는 검색으로 실체 확인 불가.
