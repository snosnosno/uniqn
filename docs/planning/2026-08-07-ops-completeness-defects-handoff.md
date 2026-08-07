# 대회운영(ops) 완성도 결함 — 다음 세션 착수 프롬프트 (2026-08-07)

> 이 문서는 **새 세션에 그대로 붙여넣는 프롬프트**다. 상단 "프롬프트" 블록만 복사해도 되고, 전체를 읽혀도 된다.
> 선행 세션 산출물: 브랜치 `fix/ops-web-origin-20260807` (커밋 `4d0c105db`, `499fd7657`) — 아래 §0 참조.

---

## 프롬프트 (복사해서 새 세션에 붙여넣기)

```
대회운영(ops) 엔진의 완성도 결함을 분석하고 수정한다.

배경: 엔진은 서버 RPC 42종·콘솔 탭 7종·실시간 8테이블까지 만들어져 있으나
프로덕션 플래그(app_config.ops_hub_enabled)가 OFF 이고 실사용이 사실상 0이다
(대회 1 / 참가자 1 / 이벤트 2 / 스태프·상금·프리셋 전부 0). 즉 "기능을 더 만드는"
문제가 아니라 "라이브 운영 루프의 구멍을 막고 켤 수 있는 상태로 만드는" 문제다.

먼저 docs/planning/2026-08-07-ops-completeness-defects-handoff.md 를 읽어라.
결함 7건의 증거(파일:줄, prod 실측)와 금지사항, 권장 착수 순서가 정리돼 있다.

착수 규칙:
- 전용 워크트리에서 작업한다. 메인 체크아웃은 읽기·계획 전용.
- 결함 ①(칩 카운트 입력 부재)부터. 나머지는 그 다음.
- 새 RPC 는 반드시 기존 ops SECDEF 규약을 따른다(actor 바인딩·advisory lock →
  대회행 FOR UPDATE·P0001·ops_events append·anon REVOKE). 규약 전문은
  wiki/architecture/ops-engine.md.
- 완료 주장 전에 이 세션에서 실행한 검증 출력을 제시한다.

먼저 결함 ①의 수정 설계(서버 RPC 시그니처 + 이벤트 타입 + UI 진입점)를 제시하고
승인을 받은 뒤 구현하라.
```

---

## §0. 선행 세션이 이미 고친 것 (중복 착수 금지)

브랜치 `fix/ops-web-origin-20260807` (origin/master 기반, **아직 push·PR 안 함**).

| 커밋 | 내용 | 전달 경로 |
|---|---|---|
| `4d0c105db` | ops 공개 링크 폴백을 죽은 도메인(`ops.uniqn.app`)에서 `APP_WEB_ORIGIN` 으로. `deploy:ops` 별칭 제거, 회귀 테스트 6종 신설 | OTA 가능 |
| `499fd7657` | Android App Links 를 전 경로(`pathPrefix: '/'`)에서 iOS AASA 와 같은 7경로로 축소. AASA 에 `/jobs` 추가. **version 1.0.5 → 1.0.6** | 🔴 **새 스토어 빌드 필요**(OTA 불가) |

⚠️ **배포 순서**: 새 빌드 → 웹 배포(AASA 갱신분) → OTA → 그 다음에야 `ops_hub_enabled` ON.
역순이면 현장 QR 이 죽은 주소로 나가거나 공개 링크가 앱에 갇힌다.

---

## §1. 확인된 사실 (2026-08-07 실측)

| 항목 | 값 | 근거 |
|---|---|---|
| prod 플래그 | `ops_hub_enabled = {"enabled": false}` (2026-07-19 이후) | `app_config` 조회 |
| 빌드타임 fallback | `false` | `src/config/featureFlags.ts` |
| prod 실사용 | 대회 1 · 참가자 1 · 이벤트 2 · 테이블 1 · 스태프 0 · 상금 0 · 프리셋 0 · 신고 0 | 카운트 쿼리 |
| 서버 RPC | `ops_*` 42종 | `pg_proc` |
| realtime | `ops_tournaments/participants/tables/seats/clock/blind_levels/live_stats/staff` 8종 | `pg_publication_tables` |
| 테스트 | ops 관련 Jest 파일 62개 / 전체 643 | `jest --listTests` |
| E2E | ops 스펙 **0건** | `e2e/` |

---

## §2. 결함 목록 (심각도 순)

### ① 칩 카운트를 입력할 방법이 없다 — CRITICAL, 여기부터

`chips` 를 바꾸는 경로가 **리바이/애드온의 고정 증분과 bust 뿐**이다. 수동 칩카운트 RPC 도 UI 도 없다.

- 근거: `ops_add_rebuy` prosrc — `chips = chips + COALESCE(v_rebuy_chips, 0)`
- 그런데 칩드래프트 재배치는 `p.chips` 로 정렬한다 — `src/components/ops/RedrawModal.tsx:114`
- 현황·전광판은 `totalChips` 를 표시한다 — `src/components/ops/LiveStatsPanel.tsx:51`

**결과**: 칩 관련 표시와 밸런싱이 전부 **명목값**이다. 실제 대회에서 "칩 카운트 후 테이블 밸런싱"이 성립하지 않는다.

설계 시 고려할 것:
- RPC 명 후보 `ops_set_participant_chips(p_participant_id, p_actor_id, p_chips, p_reason)`
- 이벤트 타입 신설 필요(`ops_event_type` enum ADD VALUE — additive)
- `ops_live_stats` 트리거 재계산 경로에 걸리는지 확인(1f 에서 DEFERRED CONSTRAINT TRIGGER 로 전환된 이력)
- 진입점: `OpsParticipantActionSheet` (행 탭 → 액션시트) 가 자연스럽다
- 상한/하한 검증(음수 금지, 대회 총칩 대비 이상치 경고 여부는 판단 사항)

### ② 노쇼 처리 경로가 없다 — HIGH

`ops_participant_status` enum 에 `no_show` 가 있으나 **이 값을 쓰는 ops RPC 가 0개**다
(`ops_assign_seat`·`ops_redraw_waitlist_fill` 은 제외 필터로만 참조).
등록 후 안 온 참가자를 표시할 방법이 없다.

참고: `checked_in` 은 도달 가능하다 — `ops_register_participant` 가 좌석 배정 실패 시 부여한다(대기 상태).
즉 **미도달인 것은 `registered` 와 `no_show` 뿐**이므로 enum 정리도 함께 판단하라.

### ③ 참가자 정정·삭제, 대회 삭제가 불가능 — HIGH

- 참가자 수정/삭제 RPC 없음 → 오등록을 되돌릴 수 없다(이름 오타조차)
- `ops_*` 42종에 대회 delete 없고 UI 도 없다 → 테스트로 만든 대회가 목록에 영구 잔존
  (prod 의 대회 1건이 그 사례로 보인다)

삭제 대신 `archived` 상태 추가가 나을 수 있다 — `ops_events` 가 append-only 감사 로그라 CASCADE 삭제와 충돌하는지 먼저 확인하라.

### ④ 대회 날짜가 무검증 자유 텍스트 — MEDIUM (가장 싸게 고칠 수 있음)

- `app/(ops)/tournaments/new.tsx:196-203` — TextInput 손입력
- `src/schemas/opsTournament.schema.ts:46` — `eventDate: z.string().optional()`
- `src/domains/ops/resume/selectResumeTournament.ts` — '오늘' 판정이 KST +9h 하드코딩,
  앱 표준 `getTodayString()`(로컬)과 이원화

**결과**: "7/1" 로 저장돼도 성공하고, '이어서 운영' 카드는 정확 문자열 비교라 영영 안 뜬다. 조용한 실패.
앱에 이미 `DatePickerModal` 이 있으므로 교체 + 스키마 `YYYY-MM-DD` 강제 + KST 하드코딩 통일.

### ⑤ `ops_unclaim_participant` 죽은 회로 — LOW

DB 에 있으나 클라 참조 0건(생성된 `src/types/supabase.ts` 제외).
클레임이 잘못 걸린 참가자를 해제할 UI 가 없다. **배선하거나 제거하거나** 결정하라.

### ⑥ `(ops)` 라우트가 플래그를 안 본다 — 판단 필요

`app/(ops)/_layout.tsx` 는 인증만 검사한다. 플래그 OFF 인데 딥링크·직접 URL 로 아무 로그인 사용자나 진입 가능하다.
"플래그만 켜면 오픈"이라는 전제와 실제 접근성이 어긋난다.

두 선택지 중 하나를 **명시적으로 결정**하고 문서에 남겨라:
(a) 레이아웃에 플래그 게이트 추가 (b) "라우트는 의도적으로 열려 있다"를 주석·문서로 확정

### ⑦ 통합 공백 — 설계 판단

- 알림 연동 0건 (`src/services/ops`·`src/hooks/ops` 에 notification 참조 없음)
- 근무기록/정산 write-back 0건 — 스태프는 공고 `work_logs` 에서 **단방향 스냅샷 import** 만
  (`opsStaffService.ts:33`)
- 오프라인 내성 0 — offline/queue 참조 0건. 현장 와이파이가 불안정하면 그대로 실패
- E2E 0건

이건 결함이라기보다 **범위 결정**이다. ①~④ 를 닫기 전에는 착수하지 마라.

---

## §3. 금지사항

- `mcp__supabase__*` 로 **기존 마이그레이션을 수정하지 마라**. 신규 마이그만 추가한다.
- prod 에 이미 적용된 마이그를 재적용하지 마라 — 착수 전 `list_migrations` 로 실측하라.
- ops 의 **anon 실행 가능 SECDEF 는 정확히 2개**(`ops_get_monitor_snapshot`·`ops_get_player_view`)라는
  불변 계약을 깨지 마라. 신규 함수는 PUBLIC/anon EXECUTE 를 상속하므로 **매번 명시 REVOKE** 하고,
  카탈로그 카운트로 회귀를 가드하라.
- 돈-흐름(바이인 결제·상금 지급 레일)에는 관여하지 마라 — `wiki/decisions/ops-no-money-flow.md` 결정.
- 상수·enum·사용자 문구를 바꾸면 `e2e/` 를 **별도 grep** 하라(eslint ignores 라 `npm run quality` 범위 밖).

---

## §4. 검증 요건

- 신규 RPC 는 pgTAP 또는 로컬 Supabase 에서 **실행 결과**로 증명하라.
  ⚠️ RLS 테이블의 pgTAP "0건"은 "행이 없다"가 아니라 "안 보인다"일 수 있다 — 단언은 행이 보이는 역할에서.
- 회귀 테스트는 **Red-Green** 을 확인하라(수정을 되돌리면 실패하는지).
- 완료 주장 전 `npm run quality` + 관련 jest 출력을 제시하라.

---

## §5. 참고 문서

- 엔진 구조·쓰기 경계·불변 계약: `wiki/architecture/ops-engine.md`
- 돈-흐름 경계 결정: `wiki/decisions/ops-no-money-flow.md`
- 전체 앱 감사(ops 항목 포함): `docs/analysis/2026-08-07-full-app-audit.md`
- 5레이어 쓰기 경계: `wiki/architecture/layers.md`
