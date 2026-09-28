---
title: ops 웹 ↔ 모바일 ops 기능 동등성 체크리스트
date: 2026-09-28
status: 진행 중 (W3 작성 · W4~W7 에서 채움 · W6 완료 기준 = 100%)
related:
  - docs/planning/2026-09-27-ops-web-design.md
  - uniqn-mobile/app/(ops)/**
  - uniqn-mobile/src/components/ops/**
---

# ops 웹 ↔ 모바일 기능 동등성 체크리스트

> 원본: 모바일 `uniqn-mobile` ops UI 전수 조사(2026-09-28, 코드 확인분만). 웹 열은 슬라이스 완료 시 ✅ 와 검증 근거(E2E 파일·단계)를 적는다.
> 표기: ✅ 동등 · ➕ 웹이 더 나음(이유) · ⏭ 의도적 차이(이유) · ⬜ 미구현.
> 공유 계층: RPC 매핑·경계 검증·에러 문구는 **동기화 사본**(`ops-web/src/core`)이라 두 앱이 같은 코드를 쓴다 — 여기선 **화면 동작**만 대조한다.

## 1. 목록 / 생성 (W3)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 대회 목록(전 회원 개방, RLS 단일 진실) | `tournaments/index.tsx` | ✅ | `e2e/w3-tournaments.mjs` 목록 단계 |
| LOADING / EMPTY / ERROR / 부분실패 배너 | 5상태 매트릭스 | ✅ | `TournamentsPage.tsx` (스켈레톤·빈 상태·재시도·배너) |
| "이어서 운영" 재개(진행 중 최신 우선) | `ResumeCard` + `selectResumeTournament` | ✅ | 같은 도메인 함수 사본 · E2E 재개 단계 |
| 공고별 필터 `?postingId=` (정리 액션 숨김) | 클라 필터 | ✅ | E2E 필터 단계 |
| 대회 복제(완료 대회만, 확인창, 오늘 KST 날짜) | `DuplicateButton` | ✅ | E2E 복제 단계(확인창 Enter) |
| 보관(확인창) / 복원(확인 없이 1탭) | `ArchiveButton` | ✅ ➕ | 웹은 낙관적 반영(0ms) — E2E 보관 단계 |
| 보관함 토글(보관분 있을 때만) | 토글 | ✅ | E2E |
| 대회 생성(이름 필수, 기본값) | `new.tsx` | ✅ | E2E 생성 단계 · 서비스 사본 zod |
| 생성 직후 기본 블라인드 시드(기다리지 않음, 실패해도 대회 유지) | `onSuccess` fire-and-forget | ✅ | E2E: 블라인드 ≥20레벨 확인(비동기라 폴링) |
| 생성 시 공고 연결(선택, `?postingId=` 프리셋) | `PostingPickerSheet` | ✅ | E2E: job_posting_id 확인 |
| 날짜는 달력 입력만 | `DatePicker` | ✅ | `<input type=date>` |
| 허브 진입 계측 `ops_hub_entered`(피커 모드 제외) · 생성 계측 `ops_tournament_created` | 훅 | ✅ ⏭ | 이벤트명·props 동일 + 웹은 `surface: 'web'` 추가(퍼널 분모 `ops_hub_impression` 이 웹엔 없어 집계 시 구분 필요). E2E analytics_events 확인 |
| ops 허브 1회성 안내 카드 | `OpsHubIntroCard` | ⏭ | 웹 전용 도메인이라 허브 개방 안내가 불필요(웹 진입 자체가 의도적) |
| 새 대회 단축키 | — | ➕ | `N` (useHotkey) |
| 관리 공고 목록 범위 | 활성 워크스페이스 | ⏭ | 웹은 워크스페이스 선택 UI 가 없어 **소유 ∪ 소속 워크스페이스 전체**(서버 `is_workspace_member` 와 같은 정의). 연결 권한은 서버 RPC 가 최종 판정 |

## 2. 콘솔 셸 / 상시 표시 (W4)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 상시 클럭 스트립(레벨·남은 시간, 탭→제어), 완료 대회 숨김 | `OpsClockStrip` | ✅ | `ConsoleClock.tsx` · e2e/w4 |
| 서버시각 offset 보정 | 운영자 클럭 `serverOffsetMs=0` | ➕ | 응답 Date 헤더 구간 교집합(새 RPC 0). e2e/w4: 기기 시계 +90초 브라우저가 ±2초 이내(레드: 보정 끄면 90초 차) |
| 상시 요약(PLAYING·ENTRY·AVG) | `OpsSummaryStrip` | ✅ | 클럭 스트립에 통합(남은 인원·평균 스택·상금 풀) |
| 탭 7종 | 폰 5+더보기 2 / 태블릿 7 | ✅ ➕ | ≥1024 레일 · 640–1023 상단 탭 · <640 하단 5+더보기, 숫자키 1–7 |
| 대회 상태 전환(한 방향) | `OpsStatusTab` | ✅ ➕ | 웹은 **종료에 확인창**(되돌릴 수 없음) |
| 등록 열림/마감 토글(완료 대회 숨김) | `OpsStatusTab` | ✅ | 낙관적 반영 |
| 라이브 통계 패널(9~10칸) | `LiveStatsPanel` | ✅ | 같은 항목·순서 |
| realtime 8종 + 재접속·탭 복귀 무효화 | `createRealtimeSubscription` | ✅ ➕ | e2e/w4: 두 브라우저 반영 · 오프라인→복귀 동기화 · 66분 방치 후 반영(`e2e/w4-idle.mjs`) · 연결 상태 표시 |

## 3. 참가자 (W4)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 목록(엔트리·칩·R/A·KO·노쇼·탈락 순위) | `PlayersTab` | ✅ ➕ | 표 + 검색(`/`), ↑↓ 선택 |
| 참가 등록 | 시트 | ✅ ➕ | `N` · **연속 등록**(창 유지·이름 칸 초기화) · e2e/w4 두 브라우저 |
| 리바이 / 애드온(확인 없음) | 액션시트 | ✅ ➕ | `R`/`A` 단축키 · 낙관적 +1 · e2e/w4 |
| 탈락(확인창, 우승/ITM/일반 안내) | `useBustParticipant` | ✅ ➕ | `X` · 확인창에 **예상 순위·상금**(서버 산식과 같음) · 결과 토스트 |
| 탈락(바운티 KO 지정, 2단 확인) | 피커→확인 | ✅ | KO 검색 대화상자 → 확인창 |
| 탈락 취소(확인창, 완료 대회 숨김) | `useUndoBust` | ✅ ➕ | + 탈락 직후 **5초 되돌리기 토스트**(우승 확정 탈락 제외) · e2e/w4 |
| 재진입 / 노쇼 표시(확인) / 노쇼 취소(즉시) | 액션시트 | ✅ | `participantActions` 테스트로 노출 조건 고정 |
| 칩 카운트(델타 미리보기·동일값 no-op) | `ChipCountSheet` | ✅ | `C` · e2e/w4 |
| 정보 수정(빈칸=지움) | `ParticipantEditSheet` | ✅ | `E` |
| 등록 취소(비가역, 조건부) | 액션시트 | ✅ | 확인창 |
| 플레이어 링크·PIN 발급/재발급(재발급 확인, PIN 1회) | `PlayerClaimButton` | ✅ | + 링크만 복사(PIN 유지) |
| 플레이어 계정 연결 해제(확인) | 액션시트 | ✅ | |
| ITM 탈락 후 "상금 화면 보기" | 액션시트 | ✅ | |

## 4. 테이블 / 좌석 (W5)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 테이블 목록(좌석/빈/착석, 잠금·우선순위·상태·딜러) | `TablesTab`·`TableRow` | ➕ | 행렬표 한 화면(시안 A 승인 09-28) — 목록→상세 2단계가 없다 · `e2e/w5-tables.mjs` |
| 테이블 추가(좌석 1~11) | `AddTableForm` | ✅ | `AddTableDialog` |
| 좌석표(점유=이름, 빈=+) | `SeatGrid` | ➕ | 칸에 칩도 표시 · 빈자리 점선 |
| 좌석 배정 / 이동(moveMode) / 비우기 | `useAssignSeat`·`useMoveSeat`·`useFreeSeat` | ➕ | 낙관적 반영 · 이동은 M + "T5-2" 입력도 가능 |
| 잠금(없음/잠금/피처)·우선순위(없음/1~5)·상태(오픈/대기/마감) | 피커 | ✅ | `TableSettingsDialog`(행 머리 클릭) |
| 딜러 지정/해제 | `DealerPickerSheet` | ✅ | 딜러 우선 정렬 동일 |
| 빈자리 채움(미리보기·다시 계산) | `RedrawModal` waitlist_fill | ✅ | 단축키 W |
| 전원 재배치(랜덤/칩 드래프트, 확인창, 좌석 부족 시 비활성) | `RedrawModal` | ✅ | 잠금 테이블 점유자 유지 E2E 확인 |

## 5. 블라인드 / 클럭 (W4·W5)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 레벨 편집(추가/수정/삭제, 최대 100, 휴식 행) | `BlindLevelsTab`·`BlindLevelForm` | ✅ ➕ | 행마다 폼 대신 **표에서 바로 편집** · e2e/w56 |
| 구조 저장(진행 중이면 재계산 확인) | `useSetBlindLevels` | ✅ | e2e/w56 |
| 프리셋 적용(교체 확인)·저장·삭제(확인) | `BlindPresetSheet` | ✅ | e2e/w56(기본 30레벨 적용→저장) |
| 클럭 시작/일시정지·이전/다음·±1분 | `ClockControl` | ✅ | 스트립 클릭·현황 탭 |
| 다음 브레이크 카운트다운 | `findNextBreakFromLevels` | ✅ | `clock.ts` 테스트 |

## 6. 상금 / 지급 (W6)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 구조 편집(금액/% 모드, 풀 기준 환산) | `PayoutStructureEditor` | ✅ | `payoutDraft` 테스트 · e2e/w56 |
| 템플릿 추천(ITM 10/15/20%) | `recommendPayoutCurve` | ✅ | 사본 함수 |
| 구조 저장(진행 중 소급 안 됨 확인) | `useSetPrizeStructure` | ✅ | e2e/w56 |
| 지급 대장(정정 행 강조) | `PayoutLedger` | ✅ | 사본 `buildLedgerRows` |
| 지급 완료 토글(확인 없음, 배정 행만) | `useSetPrizePaid` | ✅ | e2e/w56 |
| 상금 정정(사유) · 회수(확인) | `PrizeCorrectSheet` | ✅ | e2e/w56 정정 |
| 바운티 적립 섹션 | `PayoutLedger` | ✅ | |
| 완료 대회 결과(우승 = 1위만) | `TournamentResultCard` | ✅ | 상금 탭 상단 |

## 7. 스태프 (W6)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 연결 공고 표시 · 연결/변경(owner) · 해제(확인) | `StaffTab` | ✅ | e2e/w56 표시 |
| 확정 스태프 가져오기(확인, 전체 기간 토글) | `useImportOpsStaff` | ✅ | |
| 로스터 · 근태 · 테이블 지정 · 삭제(확인, 배정 해제 동반) | `StaffTab` | ✅ | e2e/w56 |
| 근태 기록(fail-closed 사유 안내 · 확인 · 알림 경고) · 취소 | `StaffAttendanceSheet` | ✅ | 사유 문구 **동기화 발췌** · e2e/w56(수동 추가 → not_linked 안내·버튼 없음) |
| 수동 추가(닉네임 검색 2~15자, 역할·기타) | `StaffAddSheet` | ✅ | e2e/w56 |

## 8. 이력 (W6)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 이벤트 로그(한글 라벨+요약, 30s + 변이 후 무효화) | `HistoryTab` | ✅ | 라벨표·요약 함수 **동기화 발췌** · e2e/w56 |

## 9. 전광판 (W7)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 모니터 링크 발급/공유(멱등) | `MonitorLinkButton` | ⬜ | |
| TV 구성(프리셋 3종 + 5슬롯, 9종 모듈) | `MonitorConfigCard` | ⬜ | 시안 승인 필요 |
| 공개 전광판(anon 폴링 4s, 항상 다크, Wake Lock) | `monitor/[token].tsx` | ⬜ | anon RPC 2개 불변 |
| 프라이즈 패널 · 연결 불안정 배너(토큰 무효 vs 일시 장애) | 전광판 | ⬜ | `publicPollingPolicy` 사본 |
| 익명 신고(사유 3종, rate limit) | `PublicReportSheet` | ⬜ | |

## 10. 플레이어뷰 (W7)

| 기능 | 모바일 | 웹 | 근거 |
|---|---|---|---|
| 공개 플레이어뷰(본인 안전 필드만) | `live/[view_token].tsx` | ⬜ | |
| 내 자리·스택·상태·리바이/애드온/재진입·바운티 | 화면 | ⬜ | |
| 탈락 시 순위+상금 | 화면 | ⬜ | |
| 라이브 클럭(모니터와 같은 offset) | 화면 | ⬜ | |
| 계정 연결(claim, PIN 8자, 비가역) | `useClaimParticipant` | ⬜ | 웹: ops 로그인 → 복귀 왕복 |
| 익명 신고 | `PublicReportSheet` | ⬜ | |

## 진행 요약

| 영역 | 상태 |
|---|---|
| 목록/생성 · 콘솔 셸 · 참가자 · 블라인드/클럭 · 상금 · 스태프 · 이력 | ✅ 동등 이상 |
| 테이블/좌석(§4) | ⬜ 좌석표 시안 승인 대기(사람 게이트) |
| 전광판 · 플레이어뷰(§9·§10) | ⬜ W7(시안 승인 대기) |
