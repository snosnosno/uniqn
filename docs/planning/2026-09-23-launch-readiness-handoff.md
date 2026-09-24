# 출시 준비도 점검 — 인계 (2026-09-23)

> 이 파일 하나로 이어받는다. 출처 세션: 출시 준비도 점검 → 9·10번(계측·DAU) 구현·머지.

## 1. 착지한 것

- **핵심 퍼널 영속화 + 관리자 DAU** — 브랜치 `claude/uniqn-launch-readiness-j9330d` → master squash 머지 (PR #512, **`89eff192b`**).
  - 마이그 `uniqn-mobile/supabase/migrations/20260923100000_analytics_core_funnel_events_and_dau.sql`
  - pgTAP `uniqn-mobile/supabase/tests/analytics_core_funnel_dau.test.sql`
  - 파리티 기대값 225 → **226** (`parity_baseline_guard.test.sql` 단언 + `PARITY_EXPECT_FUNCS` 마커 동시 갱신)
  - 상세 = `CHANGELOG.md` [Unreleased] Added 첫 항목 · `wiki/log.md` 2026-09-23 항목

## 2. 🔴 사용자 게이트 (사람이 해야 함)

| # | 할 일 | 누가 | 왜 |
|---|---|---|---|
| G1 ✅ prod 적용 2026-09-24 | **prod 에 마이그 `20260923100000` 적용** (Supabase MCP `apply_migration` 또는 `/deploy`) | 운영자 | 이 세션 컨테이너는 Supabase MCP 연결 실패(ERR_PROXY_TUNNEL)로 prod 에 붙지 못했다. **적용 전까지 주간 parity-smoke 가 함수 수 1 차이(225≠226)로 red.** → `prod-migrate` run 35986584185 로 적용. 실측: 기록 1행 · 함수 1 · CHECK 1개(신규 8종 포함) · anon EXECUTE false · 인덱스 1 · public 함수 **226**. |
| G2 ✅ 2026-09-24 | G1 **다음에** 클라 OTA | 운영자 | #441 교훈 — 서버 먼저. 역순이어도 앱은 정상(이벤트가 CHECK 로 조용히 거부, DAU 는 '집계 불가' 표시)이지만 그동안 계측이 비어 버린다. → production OTA group `5267408f-98d2-4a71-81ea-0c4dda5fab5b`(runtime 1.0.7, commit `89eff192b`) · 웹 CF `a1da8810`(uniqn.app 새 index 해시 서빙 확인). |
| G3 ⏳ | G1 후 실측: `SELECT event, count(*) FROM analytics_events WHERE created_at > now() - interval '1 day' GROUP BY 1;` 에 `login`/`job_view` 가 보이는지, 관리자 통계 화면에 DAU 차트가 뜨는지 | 운영자 | 로컬은 PG16 스텁 검증뿐 — 실 Supabase(PG17)·실 JWT 경로는 prod 에서 처음 확인된다. 배포 직후(09-24 10:2x UTC)엔 `app_session_start` 만 있고 퍼널 이벤트 0 — 새 번들 로그인 대기. |

⚠️ **재적용 금지 표기**: G1 을 수행한 세션은 이 표에 `✅ prod 적용 <날짜>` 를 적을 것. 표기가 없으면 다음 세션이 다시 적용하려 한다(마이그 자체는 CHECK 를 정의로 찾아 1개만 교체하므로 재실행해도 안전하지만, 기록 혼선을 막기 위해).

## 3. ⚠️ 알려진 한계 (의도적)

- DAU = 그 날 `analytics_events` 에 행을 남긴 로그인 사용자. `app_session_start` 는 콜드 스타트 1회라 **백그라운드 복귀만 한 날은 안 센다**(과소 추정). 필요하면 포그라운드 복귀 이벤트를 화이트리스트에 추가.
- 퍼널 이벤트는 **배포 이후부터** 쌓인다. 과거 7일 DAU 는 `app_session_start` 기반.
- 사용자당 시간당 240건 상한(`fn_analytics_events_guard`)을 모든 이벤트가 공유한다. `job_view` 를 공고당 1회로 막은 이유.

## 4. 🔴 미착수 출시 과제 (점검 결과 1~8번)

| # | 과제 | 착수점 | 비고 |
|---|---|---|---|
| 1 | 카카오/Google 로그인 (Android 는 이메일만) | `src/services/auth/socialLoginService.ts:672-685` · `app/(auth)/login.tsx` | 가입 전환 최우선 |
| 2 | 앱 내 메시지(채팅) 부재 | — (신규 설계) | 규모 큼, 설계 먼저 |
| 3 | 스태프 계좌 입력처 없음 — 정산이 앱 밖에서 끝남 | `src/types/admin.ts:56` 외 없음 | 개인정보 저장 → `/guard` 먼저 |
| 4 | 검색이 최근 300건 메모리 필터·페이지 없음 | `src/services/jobs/jobService.ts:183-194` | 서버 검색(RPC/FTS)으로 |
| 5 | 공고 작성 기간 선택(range) | `CalendarPicker` · `TODOS.md` "기간 템플릿 프리셋" | P2 |
| 6 | 공고 복제 | `TODOS.md` "공고 복제 버튼" | P3 |
| 7 | 근무표에 대회 출처 표식 없음 | `venueDayDetailMapping.ts` 매퍼 투영 | `TODOS.md` (a)안 S |
| 8 | ops 허브 반공개(`ops_hub_enabled=false`)·`/monitor` 앱링크 부재 | `src/config/featureFlags.ts:26` · AASA | 제품 결정 필요 |
| – | 웹에서 `tel:` 직접 `Linking.openURL` 3곳 | `app/jobs/[id].tsx:70` · `app/(app)/jobs/[id]/apply.tsx:107` · `src/components/jobs/JobDetail.tsx:94` | `openExternalUrl` 로 통일, S |

## 5. 메모리

이 세션은 클라우드 컨테이너라 로컬 메모리(`memory/MEMORY.md`)에 접근하지 못했다. 로컬 세션에서
`/memory-sync` 로 한 줄 추가 권장: "계측 계약 = CHECK 화이트리스트 ↔ PersistedAnalyticsEvent ↔ CORE_FUNNEL_EVENTS 1:1 (20260923100000), prod 적용 여부는 이 인계 §2 G1".
